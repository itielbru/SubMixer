import { describe, it, expect, beforeEach } from 'vitest';
import { useDocStore } from './docStore';
import type { SrtCue, Track } from '@shared/types';
import { HISTORY_LIMIT } from './undoLogic';

function resetStore() {
  useDocStore.getState().resetDoc();
}

function track(id: number, kind: 'V' | 'A' | 'S' = 'A'): Track {
  return {
    id,
    kind,
    codec: 'aac',
    info: '',
    lang: 'en',
    name: `Track ${id}`,
    keep: true,
    def: false,
    forced: false,
  };
}

function cue(start: number, end: number, text = 'x'): SrtCue {
  return { idx: 1, start, end, text };
}

beforeEach(() => resetStore());

describe('setTracks', () => {
  it('replaces tracks', () => {
    useDocStore.getState().setTracks([track(1), track(2)]);
    expect(useDocStore.getState().tracks).toHaveLength(2);
  });

  it('accepts a functional update', () => {
    useDocStore.getState().setTracks([track(1)]);
    useDocStore.getState().setTracks((prev) => [...prev, track(2)]);
    expect(useDocStore.getState().tracks).toHaveLength(2);
  });
});

describe('setCuesBySubId', () => {
  it('merges a new subId', () => {
    useDocStore.getState().setCuesBySubId({ a: [cue(0, 1)] });
    useDocStore.getState().setCuesBySubId((prev) => ({ ...prev, b: [cue(2, 3)] }));
    const state = useDocStore.getState();
    expect(Object.keys(state.cuesBySubId)).toHaveLength(2);
  });
});

describe('pushUndo', () => {
  it('snapshots current tracks and clears redo', () => {
    const s = useDocStore.getState();
    s.setTracks([track(1)]);
    // Seed a redo entry manually via setCuesBySubId (no built-in redo seed in public API)
    useDocStore.setState({ redoStack: [{ kind: 'tracks', tracks: [] }] });
    s.pushUndo();
    const after = useDocStore.getState();
    expect(after.undoStack).toHaveLength(1);
    expect(after.undoStack[0].kind).toBe('tracks');
    expect(after.redoStack).toHaveLength(0); // cleared
  });

  it('trims to HISTORY_LIMIT', () => {
    for (let i = 0; i < HISTORY_LIMIT + 5; i++) {
      useDocStore.getState().pushUndo();
    }
    expect(useDocStore.getState().undoStack).toHaveLength(HISTORY_LIMIT);
  });
});

describe('snapshotCues', () => {
  it('pushes a cue snapshot', () => {
    useDocStore.getState().setCuesBySubId({ sub1: [cue(0, 1)] });
    useDocStore.getState().snapshotCues('sub1', null);
    expect(useDocStore.getState().undoStack).toHaveLength(1);
    expect(useDocStore.getState().undoStack[0].kind).toBe('cues');
  });

  it('coalesces when key matches', () => {
    useDocStore.getState().setCuesBySubId({ sub1: [cue(0, 1)] });
    useDocStore.getState().snapshotCues('sub1', 'drag');
    useDocStore.getState().snapshotCues('sub1', 'drag');
    expect(useDocStore.getState().undoStack).toHaveLength(1);
  });

  it('does not coalesce when key changes', () => {
    useDocStore.getState().setCuesBySubId({ sub1: [cue(0, 1)] });
    useDocStore.getState().snapshotCues('sub1', 'drag');
    useDocStore.getState().snapshotCues('sub1', 'other');
    expect(useDocStore.getState().undoStack).toHaveLength(2);
  });
});

describe('undo', () => {
  it('does nothing on empty stack', () => {
    useDocStore.getState().setTracks([track(1)]);
    useDocStore.getState().undo();
    expect(useDocStore.getState().tracks).toHaveLength(1); // unchanged
  });

  it('restores tracks and pushes to redo', () => {
    useDocStore.getState().setTracks([track(1), track(2)]);
    useDocStore.getState().pushUndo(); // snapshot [t1, t2]
    useDocStore.getState().setTracks([track(3)]); // mutate to [t3]
    useDocStore.getState().undo();
    const after = useDocStore.getState();
    expect(after.tracks).toHaveLength(2); // restored
    expect(after.undoStack).toHaveLength(0);
    expect(after.redoStack).toHaveLength(1);
  });

  it('restores cues, sets activeSubId, and updates extSubs cue count', () => {
    const subId = 'sub1';
    useDocStore
      .getState()
      .setExtSubs([{ id: subId, cues: 0 } as import('@shared/types').ExternalSub]);
    useDocStore.getState().setCuesBySubId({ [subId]: [cue(0, 1)] });
    useDocStore.getState().snapshotCues(subId, null); // snapshot [c1]
    useDocStore.getState().setCuesBySubId({ [subId]: [cue(0, 1), cue(2, 3)] }); // now 2 cues
    useDocStore.getState().undo();
    const after = useDocStore.getState();
    expect(after.cuesBySubId[subId]).toHaveLength(1);
    expect(after.activeSubId).toBe(subId);
    expect(after.extSubs[0].cues).toBe(1);
  });
});

describe('redo', () => {
  it('does nothing on empty redo stack', () => {
    useDocStore.getState().setTracks([track(1)]);
    useDocStore.getState().redo();
    expect(useDocStore.getState().tracks).toHaveLength(1);
  });

  it('restores redone state and pushes back to undo', () => {
    useDocStore.getState().setTracks([track(1), track(2)]);
    useDocStore.getState().pushUndo();
    useDocStore.getState().setTracks([track(3)]);
    useDocStore.getState().undo();
    useDocStore.getState().redo();
    const after = useDocStore.getState();
    expect(after.tracks).toHaveLength(1); // [t3] restored
    expect(after.redoStack).toHaveLength(0);
    expect(after.undoStack).toHaveLength(1);
  });
});

describe('undo/redo round-trip', () => {
  it('edit → undo → redo restores to edited state', () => {
    const subId = 'sub1';
    useDocStore
      .getState()
      .setExtSubs([{ id: subId, cues: 0 } as import('@shared/types').ExternalSub]);
    const original = [cue(1, 2, 'original')];
    const edited = [cue(1, 2, 'edited'), cue(3, 4, 'new')];
    useDocStore.getState().setCuesBySubId({ [subId]: original });
    useDocStore.getState().snapshotCues(subId, null);
    useDocStore.getState().setCuesBySubId({ [subId]: edited });
    useDocStore.getState().undo();
    expect(useDocStore.getState().cuesBySubId[subId]).toHaveLength(1);
    useDocStore.getState().redo();
    expect(useDocStore.getState().cuesBySubId[subId]).toHaveLength(2);
    expect(useDocStore.getState().cuesBySubId[subId][1].text).toBe('new');
  });
});

describe('resetDoc', () => {
  it('clears all state', () => {
    useDocStore.getState().setTracks([track(1)]);
    useDocStore.getState().pushUndo();
    useDocStore.getState().resetDoc();
    const s = useDocStore.getState();
    expect(s.tracks).toHaveLength(0);
    expect(s.undoStack).toHaveLength(0);
    expect(s.file).toBeNull();
  });
});
