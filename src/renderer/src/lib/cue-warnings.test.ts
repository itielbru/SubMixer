import { describe, it, expect } from 'vitest';
import { computeWarnings, visibleLen, DEFAULT_CUE_WARNING_THRESHOLDS } from './cue-warnings';
import type { SrtCue } from '@shared/types';

const cue = (start: number, end: number, text = 'hello'): SrtCue => ({
  idx: 1,
  start,
  end,
  text,
});

describe('visibleLen', () => {
  it('strips HTML-ish tags', () => {
    expect(visibleLen('<i>hello</i>')).toBe(5);
  });

  it('strips bidi direction marks', () => {
    expect(visibleLen('‎hello‏')).toBe(5);
  });

  it('collapses whitespace', () => {
    expect(visibleLen('a   b\n c')).toBe(5);
  });
});

describe('computeWarnings', () => {
  it('reports ok for a comfortable cue', () => {
    const w = computeWarnings(cue(0, 3, 'short text'), undefined, undefined);
    expect(w.level).toBe('ok');
    expect(w.reasonKey).toBeNull();
  });

  it('flags overlap with previous as an error', () => {
    const w = computeWarnings(cue(4, 6), cue(0, 5), undefined);
    expect(w.overlapsPrev).toBe(true);
    expect(w.level).toBe('err');
    expect(w.reasonKey).toBe('overlap');
  });

  it('flags overlap with next as an error', () => {
    const w = computeWarnings(cue(0, 6), undefined, cue(5, 8));
    expect(w.overlapsNext).toBe(true);
    expect(w.level).toBe('err');
    expect(w.reasonKey).toBe('overlap');
  });

  it('flags very high CPS as an error', () => {
    // 100 chars over 1s = 100 cps > hardMaxCps (35)
    const w = computeWarnings(cue(0, 1, 'x'.repeat(100)), undefined, undefined);
    expect(w.veryFastCps).toBe(true);
    expect(w.level).toBe('err');
    expect(w.reasonKey).toBe('veryFastCps');
  });

  it('flags moderately high CPS as a warning', () => {
    // 30 chars over 1s = 30 cps (between maxCps 25 and hardMaxCps 35)
    const w = computeWarnings(cue(0, 1, 'x'.repeat(30)), undefined, undefined);
    expect(w.fastCps).toBe(true);
    expect(w.veryFastCps).toBe(false);
    expect(w.level).toBe('warn');
    expect(w.reasonKey).toBe('fastCps');
  });

  it('flags a too-short cue as a warning', () => {
    const w = computeWarnings(cue(0, 0.5, 'hi'), undefined, undefined);
    expect(w.short).toBe(true);
    expect(w.level).toBe('warn');
    expect(w.reasonKey).toBe('short');
  });

  it('flags a too-long cue as a warning', () => {
    const w = computeWarnings(cue(0, 20, 'hi'), undefined, undefined);
    expect(w.long).toBe(true);
    expect(w.level).toBe('warn');
    expect(w.reasonKey).toBe('long');
  });

  it('flags a short gap to the next cue as a warning', () => {
    const w = computeWarnings(cue(0, 3, 'hi'), undefined, cue(3.05, 5));
    expect(w.shortGapNext).toBe(true);
    expect(w.level).toBe('warn');
    expect(w.reasonKey).toBe('shortGap');
  });

  it('reports the cue duration for display', () => {
    const w = computeWarnings(cue(1, 3.5), undefined, undefined);
    expect(w.durationSec).toBeCloseTo(2.5);
  });

  it('honours custom thresholds', () => {
    const relaxed = { ...DEFAULT_CUE_WARNING_THRESHOLDS, maxCps: 1000, hardMaxCps: 2000 };
    // 500 chars over 5s = 100 cps; duration is within the comfortable band.
    const w = computeWarnings(cue(0, 5, 'x'.repeat(500)), undefined, undefined, relaxed);
    expect(w.fastCps).toBe(false);
    expect(w.level).toBe('ok');
    expect(w.reasonKey).toBeNull();
  });

  describe('overrun (cue extends past video end)', () => {
    it('flags overrun as a warning when cue.end > videoDurationSec', () => {
      const w = computeWarnings(cue(58, 62, 'hi'), undefined, undefined, undefined, 60);
      expect(w.overrun).toBe(true);
      expect(w.level).toBe('warn');
      expect(w.reasonKey).toBe('overrun');
    });

    it('does not flag overrun when cue ends exactly at video duration', () => {
      const w = computeWarnings(cue(58, 60, 'hi'), undefined, undefined, undefined, 60);
      expect(w.overrun).toBe(false);
    });

    it('does not flag overrun when videoDurationSec is not provided', () => {
      const w = computeWarnings(cue(58, 62, 'hi'), undefined, undefined);
      expect(w.overrun).toBe(false);
      expect(w.level).toBe('ok');
    });

    it('overlap takes priority over overrun', () => {
      // Overlaps previous AND overruns — overlap should win (err level)
      const w = computeWarnings(cue(4, 62), cue(0, 5), undefined, undefined, 60);
      expect(w.overlapsPrev).toBe(true);
      expect(w.overrun).toBe(true);
      expect(w.level).toBe('err');
      expect(w.reasonKey).toBe('overlap');
    });
  });
});
