import { describe, it, expect } from 'vitest';
import {
  applyUpdateCue,
  applyDeleteCue,
  applyInsertCue,
  applyShiftCues,
  applyShiftAllCues,
  applyMergeCue,
  applyDuplicateCue,
} from './cueOps';
import type { SrtCue } from '@shared/types';

function c(start: number, end: number, text = 'x'): SrtCue {
  return { idx: 1, start, end, text };
}

describe('applyUpdateCue', () => {
  it('patches the target cue', () => {
    const list = [c(1, 2, 'a'), c(3, 4, 'b')];
    const next = applyUpdateCue(list, 0, { text: 'z' });
    expect(next[0].text).toBe('z');
    expect(next[1].text).toBe('b');
    expect(list[0].text).toBe('a'); // immutable
  });

  it('returns original if index out of range', () => {
    const list = [c(1, 2)];
    expect(applyUpdateCue(list, 5, { text: 'z' })).toBe(list);
  });
});

describe('applyDeleteCue', () => {
  it('removes the cue at the index', () => {
    const list = [c(1, 2, 'a'), c(3, 4, 'b'), c(5, 6, 'c')];
    const next = applyDeleteCue(list, 1);
    expect(next).toHaveLength(2);
    expect(next[0].text).toBe('a');
    expect(next[1].text).toBe('c');
  });
});

describe('applyInsertCue', () => {
  it('inserts at the correct sorted position', () => {
    const list = [c(1, 2), c(5, 6)];
    const { list: next, pos } = applyInsertCue(list, 3);
    expect(next).toHaveLength(3);
    expect(pos).toBe(1);
    expect(next[1].start).toBe(3);
  });

  it('appends when at the end', () => {
    const list = [c(1, 2)];
    const { pos } = applyInsertCue(list, 10);
    expect(pos).toBe(1);
  });
});

describe('applyShiftCues', () => {
  it('shifts selected cues by delta', () => {
    const list = [c(1, 2), c(3, 4), c(5, 6)];
    const next = applyShiftCues(list, [0, 2], 1);
    expect(next[0].start).toBeCloseTo(2);
    expect(next[1].start).toBeCloseTo(3); // untouched
    expect(next[2].start).toBeCloseTo(6);
  });

  it('clamps to 0', () => {
    const list = [c(0.5, 1)];
    const next = applyShiftCues(list, [0], -2);
    expect(next[0].start).toBe(0);
    expect(next[0].end).toBe(0);
  });
});

describe('applyShiftAllCues', () => {
  it('shifts from fromIdx onward with speed 1', () => {
    const list = [c(1, 2), c(3, 4), c(5, 6)];
    const next = applyShiftAllCues(list, 1, 1);
    expect(next[0].start).toBeCloseTo(1); // unchanged
    expect(next[1].start).toBeCloseTo(4);
    expect(next[2].start).toBeCloseTo(6);
  });

  it('applies speed multiplier', () => {
    const list = [c(10, 12)];
    const next = applyShiftAllCues(list, 0, 0, 0.5);
    expect(next[0].start).toBeCloseTo(5);
    expect(next[0].end).toBeCloseTo(6);
  });
});

describe('applyMergeCue', () => {
  it('merges two adjacent cues', () => {
    const list = [c(1, 2, 'hello'), c(3, 5, 'world')];
    const next = applyMergeCue(list, 0)!;
    expect(next).toHaveLength(1);
    expect(next[0].end).toBe(5);
    expect(next[0].text).toBe('hello\nworld');
  });

  it('returns null if second cue missing', () => {
    expect(applyMergeCue([c(1, 2)], 0)).toBeNull();
  });
});

describe('applyDuplicateCue', () => {
  it('duplicates the cue after it', () => {
    const list = [c(1, 2, 'hi')];
    const next = applyDuplicateCue(list, 0, 1)!;
    expect(next).toHaveLength(2);
    expect(next[1].text).toBe('hi');
    expect(next[1].start).toBeCloseTo(3);
  });

  it('returns null for out-of-range index', () => {
    expect(applyDuplicateCue([], 0)).toBeNull();
  });
});
