import { useCallback, useEffect, useRef } from 'react';
import type { Dispatch, SetStateAction } from 'react';
import type { SrtCue, Track } from '@shared/types';

// Unified undo/redo for track toggles and cue edits in one chronological stack.
// Extracted from App.tsx so the (intertwined) stack logic lives in one place.

type HistoryEntry =
  | { kind: 'tracks'; tracks: Track[] }
  | { kind: 'cues'; subId: string; cues: SrtCue[] };

const HISTORY_LIMIT = 100;

function cloneTracks(t: Track[]): Track[] {
  return t.map((x) => ({ ...x }));
}

export interface UndoRedoState {
  tracks: Track[];
  cuesBySubId: Record<string, SrtCue[]>;
  setTracks: Dispatch<SetStateAction<Track[]>>;
  setActiveSubId: Dispatch<SetStateAction<string | null>>;
  setCuesBySubId: Dispatch<SetStateAction<Record<string, SrtCue[]>>>;
  setExtSubs: Dispatch<SetStateAction<import('@shared/types').ExternalSub[]>>;
}

export interface UndoRedoApi {
  /** Snapshot current tracks before a track mutation. */
  pushUndo: () => void;
  /**
   * Snapshot the active sub's cues before a mutation. Pass a `key` to coalesce
   * consecutive identical edits (e.g. dragging one cue); pass null for discrete
   * one-shot operations.
   */
  snapshotCues: (subId: string, key: string | null) => void;
  undo: () => void;
  redo: () => void;
}

export function useUndoRedo(state: UndoRedoState): UndoRedoApi {
  const { setTracks, setActiveSubId, setCuesBySubId, setExtSubs } = state;

  // Fresh-state mirrors so the global key handler (stable deps) reads current state.
  const tracksRef = useRef(state.tracks);
  tracksRef.current = state.tracks;
  const cuesRef = useRef(state.cuesBySubId);
  cuesRef.current = state.cuesBySubId;

  const undoStack = useRef<HistoryEntry[]>([]);
  const redoStack = useRef<HistoryEntry[]>([]);
  const coalesceKey = useRef<string | null>(null);

  const pushUndo = useCallback(() => {
    undoStack.current.push({ kind: 'tracks', tracks: cloneTracks(tracksRef.current) });
    if (undoStack.current.length > HISTORY_LIMIT) undoStack.current.shift();
    redoStack.current = [];
    coalesceKey.current = null;
  }, []);

  const snapshotCues = useCallback((subId: string, key: string | null) => {
    if (key && coalesceKey.current === key) return;
    const current = cuesRef.current[subId];
    if (!current) return;
    undoStack.current.push({ kind: 'cues', subId, cues: current });
    if (undoStack.current.length > HISTORY_LIMIT) undoStack.current.shift();
    redoStack.current = [];
    coalesceKey.current = key;
  }, []);

  const restoreEntry = useCallback(
    (entry: HistoryEntry): HistoryEntry | null => {
      if (entry.kind === 'tracks') {
        const inverse: HistoryEntry = { kind: 'tracks', tracks: cloneTracks(tracksRef.current) };
        setTracks(entry.tracks);
        return inverse;
      }
      const current = cuesRef.current[entry.subId];
      const inverse: HistoryEntry | null = current
        ? { kind: 'cues', subId: entry.subId, cues: current }
        : null;
      setActiveSubId(entry.subId);
      setCuesBySubId((m) => ({ ...m, [entry.subId]: entry.cues }));
      setExtSubs((subs) =>
        subs.map((s) => (s.id === entry.subId ? { ...s, cues: entry.cues.length } : s))
      );
      return inverse;
    },
    [setTracks, setActiveSubId, setCuesBySubId, setExtSubs]
  );

  const undo = useCallback(() => {
    const entry = undoStack.current.pop();
    if (!entry) return;
    const inverse = restoreEntry(entry);
    if (inverse) redoStack.current.push(inverse);
    coalesceKey.current = null;
  }, [restoreEntry]);

  const redo = useCallback(() => {
    const entry = redoStack.current.pop();
    if (!entry) return;
    const inverse = restoreEntry(entry);
    if (inverse) undoStack.current.push(inverse);
    coalesceKey.current = null;
  }, [restoreEntry]);

  // Ctrl+Z undo, Ctrl+Y / Ctrl+Shift+Z redo (tracks + cue edits).
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (!(e.ctrlKey || e.metaKey)) return;
      const k = e.key.toLowerCase();
      if (k === 'z' && !e.shiftKey) {
        e.preventDefault();
        undo();
      } else if (k === 'y' || (k === 'z' && e.shiftKey)) {
        e.preventDefault();
        redo();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [undo, redo]);

  return { pushUndo, snapshotCues, undo, redo };
}
