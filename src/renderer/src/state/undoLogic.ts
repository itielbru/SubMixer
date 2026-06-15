/**
 * Pure undo/redo stack logic.
 *
 * The stack stores history entries; each push may evict the oldest entry when
 * the limit is hit. Consecutive edits with the same key are coalesced so
 * dragging a cue doesn't flood the undo buffer.
 *
 * All functions are pure (no side effects, no React deps) — testable headlessly.
 */

import type { SrtCue, Track } from '@shared/types';

export type HistoryEntry =
  | { kind: 'tracks'; tracks: Track[] }
  | { kind: 'cues'; subId: string; cues: SrtCue[] };

export interface UndoState {
  undoStack: HistoryEntry[];
  redoStack: HistoryEntry[];
  coalesceKey: string | null;
}

export const HISTORY_LIMIT = 100;

export function pushUndoEntry(
  state: UndoState,
  entry: HistoryEntry,
  coalesceKey: string | null = null,
): UndoState {
  if (coalesceKey && state.coalesceKey === coalesceKey) {
    return state; // coalesce: drop redundant entry
  }
  const next = [...state.undoStack, entry];
  if (next.length > HISTORY_LIMIT) next.shift();
  return { undoStack: next, redoStack: [], coalesceKey };
}

export function popUndo(state: UndoState): { state: UndoState; entry: HistoryEntry } | null {
  if (state.undoStack.length === 0) return null;
  const entry = state.undoStack[state.undoStack.length - 1];
  return {
    state: {
      undoStack: state.undoStack.slice(0, -1),
      redoStack: state.redoStack,
      coalesceKey: null,
    },
    entry,
  };
}

export function popRedo(state: UndoState): { state: UndoState; entry: HistoryEntry } | null {
  if (state.redoStack.length === 0) return null;
  const entry = state.redoStack[state.redoStack.length - 1];
  return {
    state: {
      undoStack: state.undoStack,
      redoStack: state.redoStack.slice(0, -1),
      coalesceKey: null,
    },
    entry,
  };
}

export function pushRedoEntry(state: UndoState, entry: HistoryEntry): UndoState {
  return {
    undoStack: state.undoStack,
    redoStack: [...state.redoStack, entry],
    coalesceKey: null,
  };
}
