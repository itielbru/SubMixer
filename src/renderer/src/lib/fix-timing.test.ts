import { describe, it, expect } from 'vitest';
import { fixOverlapsAndShortGaps } from './fix-timing';
import type { SrtCue } from '@shared/types';

const cue = (idx: number, start: number, end: number): SrtCue => ({
  idx,
  start,
  end,
  text: `cue ${idx}`,
});

const opts = { fixOverlaps: true, fixGaps: true, minGapSec: 0.12 };

describe('fixOverlapsAndShortGaps', () => {
  it('returns copies (not the same refs) for fewer than 2 cues', () => {
    const cues = [cue(1, 0, 1)];
    const res = fixOverlapsAndShortGaps(cues, opts);
    expect(res.changes).toEqual([]);
    expect(res.cues[0]).not.toBe(cues[0]);
    expect(res.cues[0]).toEqual(cues[0]);
  });

  it('pushes the later cue start to remove an overlap', () => {
    const cues = [cue(1, 0, 5), cue(2, 4, 8)];
    const res = fixOverlapsAndShortGaps(cues, opts);
    expect(res.cues[1].start).toBe(5);
    expect(res.changes).toHaveLength(1);
    expect(res.changes[0].kind).toBe('overlap');
  });

  it('opens a short gap to the minimum gap', () => {
    const cues = [cue(1, 0, 5), cue(2, 5.05, 8)];
    const res = fixOverlapsAndShortGaps(cues, opts);
    expect(res.cues[1].start).toBeCloseTo(5.12);
    expect(res.changes[0].kind).toBe('gap');
  });

  it('does nothing when both fixes are disabled', () => {
    const cues = [cue(1, 0, 5), cue(2, 4, 8)];
    const res = fixOverlapsAndShortGaps(cues, { ...opts, fixOverlaps: false, fixGaps: false });
    expect(res.changes).toEqual([]);
    expect(res.cues[1].start).toBe(4);
  });

  it('keeps a minimum duration when the shifted start would pass the end', () => {
    const cues = [cue(1, 0, 5), cue(2, 4, 4.5)];
    const res = fixOverlapsAndShortGaps(cues, opts);
    expect(res.cues[1].start).toBe(5);
    expect(res.cues[1].end).toBeGreaterThan(res.cues[1].start);
  });

  it('does not mutate the input cues', () => {
    const cues = [cue(1, 0, 5), cue(2, 4, 8)];
    fixOverlapsAndShortGaps(cues, opts);
    expect(cues[1].start).toBe(4);
  });
});
