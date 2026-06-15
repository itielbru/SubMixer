/**
 * Zustand store for the open document: video file, tracks, external
 * subtitles, per-sub cue lists, edited-sub set, and the undo/redo stacks.
 *
 * Undo/redo stacks are stored in the same Zustand store as the doc data
 * so that undo and redo are atomic (one `set()` call updates both the
 * doc state and the stack). No React component subscribes to the stack
 * arrays themselves, so they don't trigger unnecessary re-renders.
 *
 * The `getState()` escape-hatch is used by the global keydown handler so
 * it always reads current values without needing React state mirrors.
 */

import { create } from 'zustand';
import type { MediaFile, ExternalSub, SrtCue, Track } from '@shared/types';
import { HISTORY_LIMIT } from './undoLogic';
import type { HistoryEntry } from './undoLogic';

function cloneTracks(t: Track[]): Track[] {
  return t.map((x) => ({ ...x }));
}

export interface DocState {
  // ── Document ──────────────────────────────────────────────────────────────
  file: MediaFile | null;
  tracks: Track[];
  extSubs: ExternalSub[];
  activeSubId: string | null;
  cuesBySubId: Record<string, SrtCue[]>;
  editedSubIds: Set<string>;

  // ── Undo/redo (no component should subscribe to these) ───────────────────
  undoStack: HistoryEntry[];
  redoStack: HistoryEntry[];
  coalesceKey: string | null;

  // ── Setters (low-level) ───────────────────────────────────────────────────
  setFile: (f: MediaFile | null) => void;
  setTracks: (t: Track[] | ((prev: Track[]) => Track[])) => void;
  setExtSubs: (s: ExternalSub[] | ((prev: ExternalSub[]) => ExternalSub[])) => void;
  setActiveSubId: (id: string | null) => void;
  setCuesBySubId: (
    m: Record<string, SrtCue[]> | ((prev: Record<string, SrtCue[]>) => Record<string, SrtCue[]>),
  ) => void;
  setEditedSubIds: (s: Set<string> | ((prev: Set<string>) => Set<string>)) => void;

  // ── Undo/redo helpers ─────────────────────────────────────────────────────
  /**
   * Push a tracks snapshot before mutating tracks.
   * Clears the redo stack.
   */
  pushUndo: () => void;

  /**
   * Push a cues snapshot before mutating cues for `subId`.
   * Pass a `key` to coalesce consecutive identical edits (e.g. drag).
   */
  snapshotCues: (subId: string, key: string | null) => void;

  /** Undo the last operation (atomic: updates doc state + stacks at once). */
  undo: () => void;

  /** Redo the last undone operation. */
  redo: () => void;

  /** Reset to a clean state (called when a new file is opened). */
  resetDoc: () => void;
}

export const useDocStore = create<DocState>((set, get) => ({
  file: null,
  tracks: [],
  extSubs: [],
  activeSubId: null,
  cuesBySubId: {},
  editedSubIds: new Set(),
  undoStack: [],
  redoStack: [],
  coalesceKey: null,

  setFile: (f) => set({ file: f }),

  setTracks: (t) => set((s) => ({ tracks: typeof t === 'function' ? t(s.tracks) : t })),

  setExtSubs: (fn) => set((s) => ({ extSubs: typeof fn === 'function' ? fn(s.extSubs) : fn })),

  setActiveSubId: (id) => set({ activeSubId: id }),

  setCuesBySubId: (fn) =>
    set((s) => ({ cuesBySubId: typeof fn === 'function' ? fn(s.cuesBySubId) : fn })),

  setEditedSubIds: (fn) =>
    set((s) => ({ editedSubIds: typeof fn === 'function' ? fn(s.editedSubIds) : fn })),

  pushUndo: () =>
    set((s) => {
      const entry: HistoryEntry = { kind: 'tracks', tracks: cloneTracks(s.tracks) };
      const next = [...s.undoStack, entry];
      if (next.length > HISTORY_LIMIT) next.shift();
      return { undoStack: next, redoStack: [], coalesceKey: null };
    }),

  snapshotCues: (subId, key) => {
    const { coalesceKey, cuesBySubId, undoStack } = get();
    if (key && coalesceKey === key) return;
    const current = cuesBySubId[subId];
    if (!current) return;
    const entry: HistoryEntry = { kind: 'cues', subId, cues: current };
    const next = [...undoStack, entry];
    if (next.length > HISTORY_LIMIT) next.shift();
    set({ undoStack: next, redoStack: [], coalesceKey: key });
  },

  undo: () => {
    const { undoStack, redoStack, tracks, cuesBySubId, extSubs } = get();
    if (undoStack.length === 0) return;
    const entry = undoStack[undoStack.length - 1];
    const remaining = undoStack.slice(0, -1);

    if (entry.kind === 'tracks') {
      const inverse: HistoryEntry = { kind: 'tracks', tracks: cloneTracks(tracks) };
      set({
        tracks: entry.tracks,
        undoStack: remaining,
        redoStack: [...redoStack, inverse],
        coalesceKey: null,
      });
    } else {
      const current = cuesBySubId[entry.subId];
      const inverse: HistoryEntry | null = current
        ? { kind: 'cues', subId: entry.subId, cues: current }
        : null;
      set({
        activeSubId: entry.subId,
        cuesBySubId: { ...cuesBySubId, [entry.subId]: entry.cues },
        extSubs: extSubs.map((s) => (s.id === entry.subId ? { ...s, cues: entry.cues.length } : s)),
        undoStack: remaining,
        redoStack: inverse ? [...redoStack, inverse] : redoStack,
        coalesceKey: null,
      });
    }
  },

  redo: () => {
    const { undoStack, redoStack, tracks, cuesBySubId, extSubs } = get();
    if (redoStack.length === 0) return;
    const entry = redoStack[redoStack.length - 1];
    const remaining = redoStack.slice(0, -1);

    if (entry.kind === 'tracks') {
      const inverse: HistoryEntry = { kind: 'tracks', tracks: cloneTracks(tracks) };
      set({
        tracks: entry.tracks,
        undoStack: [...undoStack, inverse],
        redoStack: remaining,
        coalesceKey: null,
      });
    } else {
      const current = cuesBySubId[entry.subId];
      const inverse: HistoryEntry | null = current
        ? { kind: 'cues', subId: entry.subId, cues: current }
        : null;
      set({
        activeSubId: entry.subId,
        cuesBySubId: { ...cuesBySubId, [entry.subId]: entry.cues },
        extSubs: extSubs.map((s) => (s.id === entry.subId ? { ...s, cues: entry.cues.length } : s)),
        undoStack: inverse ? [...undoStack, inverse] : undoStack,
        redoStack: remaining,
        coalesceKey: null,
      });
    }
  },

  resetDoc: () =>
    set({
      file: null,
      tracks: [],
      extSubs: [],
      activeSubId: null,
      cuesBySubId: {},
      editedSubIds: new Set(),
      undoStack: [],
      redoStack: [],
      coalesceKey: null,
    }),
}));
