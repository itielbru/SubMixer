import { describe, it, expect } from 'vitest';
import {
  transformCues,
  transformedCueTimes,
  findCueAtMediaTime,
  findCueIndexAtMediaTime,
  mediaTimeForCueStart,
  fileTimeFromMediaTime,
  computeVisualSync,
} from './cue-sync';
import type { SrtCue } from './types';

const cue = (idx: number, start: number, end: number): SrtCue => ({
  idx,
  start,
  end,
  text: `cue ${idx}`,
});

describe('transformCues', () => {
  it('returns the same array reference when offset=0 and speed=1', () => {
    const cues = [cue(1, 1, 2)];
    expect(transformCues(cues, { offset: 0, speed: 1 })).toBe(cues);
  });

  it('applies start*speed + offset', () => {
    const cues = [cue(1, 10, 20)];
    const out = transformCues(cues, { offset: 5, speed: 2 });
    expect(out[0].start).toBe(25);
    expect(out[0].end).toBe(45);
  });

  it('clamps negative results to 0', () => {
    const out = transformCues([cue(1, 1, 2)], { offset: -100, speed: 1 });
    expect(out[0].start).toBe(0);
    expect(out[0].end).toBe(0);
  });

  it('does not mutate the input cues', () => {
    const cues = [cue(1, 10, 20)];
    transformCues(cues, { offset: 5, speed: 1 });
    expect(cues[0].start).toBe(10);
  });
});

describe('transformedCueTimes', () => {
  it('matches the transformCues formula for a single cue', () => {
    const t = transformedCueTimes(cue(1, 10, 20), { offset: -3, speed: 1.5 });
    expect(t.start).toBeCloseTo(12);
    expect(t.end).toBeCloseTo(27);
  });
});

describe('findCueAtMediaTime / index', () => {
  const cues = [cue(1, 0, 2), cue(2, 5, 7)];

  it('finds the cue at a media time with no transform', () => {
    expect(findCueAtMediaTime(cues, 6, { offset: 0, speed: 1 })?.idx).toBe(2);
    expect(findCueAtMediaTime(cues, 3, { offset: 0, speed: 1 })).toBeUndefined();
  });

  it('accounts for offset/speed when matching', () => {
    // cue 2 at file time 5..7 with offset +10 → media 15..17
    const found = findCueAtMediaTime(cues, 16, { offset: 10, speed: 1 });
    expect(found?.idx).toBe(2);
    expect(findCueIndexAtMediaTime(cues, 16, { offset: 10, speed: 1 })).toBe(1);
  });
});

describe('media/file time conversions are inverse', () => {
  it('mediaTimeForCueStart and fileTimeFromMediaTime round-trip', () => {
    const opts = { offset: 4, speed: 1.25 };
    const media = mediaTimeForCueStart(10, opts);
    expect(fileTimeFromMediaTime(media, opts)).toBeCloseTo(10);
  });
});

describe('computeVisualSync', () => {
  it('derives offset/speed mapping file points to media points', () => {
    const res = computeVisualSync({
      fileStart: 0,
      fileEnd: 100,
      mediaStart: 2,
      mediaEnd: 202,
    });
    expect(res).not.toBeNull();
    expect(res!.speed).toBeCloseTo(2);
    expect(res!.offset).toBeCloseTo(2);
  });

  it('returns null for a degenerate (zero) span', () => {
    expect(
      computeVisualSync({ fileStart: 5, fileEnd: 5, mediaStart: 0, mediaEnd: 10 }),
    ).toBeNull();
  });
});
