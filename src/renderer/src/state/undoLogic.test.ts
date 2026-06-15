import { describe, it, expect } from 'vitest';
import { pushUndoEntry, popUndo, popRedo, pushRedoEntry, HISTORY_LIMIT } from './undoLogic';
import type { UndoState, HistoryEntry } from './undoLogic';

function emptyState(): UndoState {
  return { undoStack: [], redoStack: [], coalesceKey: null };
}

function tracksEntry(): HistoryEntry {
  return { kind: 'tracks', tracks: [] };
}

function cuesEntry(subId = 'a'): HistoryEntry {
  return { kind: 'cues', subId, cues: [] };
}

describe('pushUndoEntry', () => {
  it('appends entry and clears redo', () => {
    const s0 = { ...emptyState(), redoStack: [cuesEntry()] };
    const s1 = pushUndoEntry(s0, tracksEntry());
    expect(s1.undoStack).toHaveLength(1);
    expect(s1.redoStack).toHaveLength(0);
  });

  it('coalesces when key matches', () => {
    const s0 = pushUndoEntry(emptyState(), cuesEntry(), 'drag');
    const s1 = pushUndoEntry(s0, cuesEntry(), 'drag');
    expect(s1.undoStack).toHaveLength(1); // coalesced
  });

  it('does not coalesce when key changes', () => {
    const s0 = pushUndoEntry(emptyState(), cuesEntry(), 'drag');
    const s1 = pushUndoEntry(s0, cuesEntry(), 'other');
    expect(s1.undoStack).toHaveLength(2);
  });

  it('does not coalesce when no key', () => {
    const s0 = pushUndoEntry(emptyState(), cuesEntry(), 'drag');
    const s1 = pushUndoEntry(s0, cuesEntry()); // null key
    expect(s1.undoStack).toHaveLength(2);
  });

  it('trims to HISTORY_LIMIT', () => {
    let state = emptyState();
    for (let i = 0; i < HISTORY_LIMIT + 5; i++) {
      state = pushUndoEntry(state, cuesEntry(String(i)));
    }
    expect(state.undoStack).toHaveLength(HISTORY_LIMIT);
  });

  it('stores the coalesceKey', () => {
    const s1 = pushUndoEntry(emptyState(), cuesEntry(), 'mykey');
    expect(s1.coalesceKey).toBe('mykey');
  });
});

describe('popUndo', () => {
  it('returns null when stack is empty', () => {
    expect(popUndo(emptyState())).toBeNull();
  });

  it('pops the last entry', () => {
    const e1 = cuesEntry('x');
    const e2 = tracksEntry();
    let s = pushUndoEntry(emptyState(), e1);
    s = pushUndoEntry(s, e2);
    const result = popUndo(s)!;
    expect(result.entry).toBe(e2);
    expect(result.state.undoStack).toHaveLength(1);
  });

  it('clears coalesceKey', () => {
    const s0 = pushUndoEntry(emptyState(), cuesEntry(), 'drag');
    const result = popUndo(s0)!;
    expect(result.state.coalesceKey).toBeNull();
  });

  it('preserves redoStack', () => {
    const re = cuesEntry('redo');
    const s0: UndoState = { undoStack: [cuesEntry()], redoStack: [re], coalesceKey: null };
    const result = popUndo(s0)!;
    expect(result.state.redoStack).toHaveLength(1);
  });
});

describe('popRedo', () => {
  it('returns null when stack is empty', () => {
    expect(popRedo(emptyState())).toBeNull();
  });

  it('pops the last redo entry', () => {
    const re = cuesEntry('r');
    const s0: UndoState = { undoStack: [], redoStack: [re], coalesceKey: null };
    const result = popRedo(s0)!;
    expect(result.entry).toBe(re);
    expect(result.state.redoStack).toHaveLength(0);
  });

  it('clears coalesceKey', () => {
    const s0: UndoState = { undoStack: [], redoStack: [cuesEntry()], coalesceKey: 'drag' };
    const result = popRedo(s0)!;
    expect(result.state.coalesceKey).toBeNull();
  });
});

describe('pushRedoEntry', () => {
  it('appends to redo stack', () => {
    const s1 = pushRedoEntry(emptyState(), cuesEntry());
    expect(s1.redoStack).toHaveLength(1);
  });

  it('preserves undoStack', () => {
    const s0: UndoState = { undoStack: [tracksEntry()], redoStack: [], coalesceKey: null };
    const s1 = pushRedoEntry(s0, cuesEntry());
    expect(s1.undoStack).toHaveLength(1);
  });

  it('clears coalesceKey', () => {
    const s0: UndoState = { undoStack: [], redoStack: [], coalesceKey: 'drag' };
    const s1 = pushRedoEntry(s0, cuesEntry());
    expect(s1.coalesceKey).toBeNull();
  });
});

describe('undo/redo round-trip', () => {
  it('pushUndo → popUndo → pushRedo → popRedo restores entry', () => {
    const entry = cuesEntry('sub1');
    const s1 = pushUndoEntry(emptyState(), entry);
    const { state: s2, entry: e2 } = popUndo(s1)!;
    const s3 = pushRedoEntry(s2, e2);
    const { entry: e3 } = popRedo(s3)!;
    expect(e3).toBe(entry);
  });
});
