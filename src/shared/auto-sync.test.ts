import { describe, it, expect } from 'vitest';
import { estimateSubtitleOffset, type PeaksLike } from './auto-sync';
import type { SrtCue } from './types';

// Build peaks that are "loud" during the given [start,end] second intervals.
function peaksWithSpeech(duration: number, intervals: [number, number][]): PeaksLike {
  const pps = 10;
  const n = duration * pps;
  const min = new Float32Array(n);
  const max = new Float32Array(n);
  for (let i = 0; i < n; i++) {
    const t = i / pps;
    const loud = intervals.some(([a, b]) => t >= a && t < b);
    max[i] = loud ? 0.9 : 0.02;
    min[i] = loud ? -0.9 : -0.02;
  }
  return { min, max, peaksPerSec: pps, duration };
}

function cue(start: number, end: number, idx = 1): SrtCue {
  return { idx, start, end, text: 'x' };
}

describe('estimateSubtitleOffset', () => {
  it('returns null without cues', () => {
    expect(estimateSubtitleOffset([], peaksWithSpeech(30, [[10, 12]]))).toBeNull();
  });

  it('returns null on silent audio', () => {
    expect(estimateSubtitleOffset([cue(10, 12)], peaksWithSpeech(30, []))).toBeNull();
  });

  it('returns null for zero duration', () => {
    const p: PeaksLike = { min: new Float32Array(), max: new Float32Array(), peaksPerSec: 10, duration: 0 };
    expect(estimateSubtitleOffset([cue(1, 2)], p)).toBeNull();
  });

  it('finds zero offset when already aligned', () => {
    const peaks = peaksWithSpeech(40, [[10, 12], [20, 22]]);
    const cues = [cue(10, 12, 1), cue(20, 22, 2)];
    const r = estimateSubtitleOffset(cues, peaks);
    expect(r).not.toBeNull();
    expect(Math.abs(r!.offsetSec)).toBeLessThanOrEqual(0.5);
    expect(r!.score).toBeGreaterThan(0.8);
  });

  it('recovers a positive offset when subtitles run early', () => {
    const peaks = peaksWithSpeech(40, [[10, 12], [20, 22]]);
    // subtitles 3s ahead of the audio → should suggest +3s
    const cues = [cue(7, 9, 1), cue(17, 19, 2)];
    const r = estimateSubtitleOffset(cues, peaks);
    expect(r).not.toBeNull();
    expect(r!.offsetSec).toBeGreaterThan(2.4);
    expect(r!.offsetSec).toBeLessThan(3.6);
  });

  it('recovers a negative offset when subtitles run late', () => {
    const peaks = peaksWithSpeech(40, [[10, 12], [25, 27]]);
    // subtitles 4s behind the audio → should suggest -4s
    const cues = [cue(14, 16, 1), cue(29, 31, 2)];
    const r = estimateSubtitleOffset(cues, peaks);
    expect(r).not.toBeNull();
    expect(r!.offsetSec).toBeLessThan(-3.4);
    expect(r!.offsetSec).toBeGreaterThan(-4.6);
  });

  it('respects the maxShiftSec search bound', () => {
    const peaks = peaksWithSpeech(60, [[40, 42]]);
    const cues = [cue(10, 12)];
    const r = estimateSubtitleOffset(cues, peaks, { maxShiftSec: 5 });
    expect(r).not.toBeNull();
    expect(Math.abs(r!.offsetSec)).toBeLessThanOrEqual(5);
  });
});
