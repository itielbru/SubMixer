// Estimate a global subtitle offset by cross-correlating subtitle "speech
// present" intervals against the audio energy envelope (the same peaks the
// timeline already renders). Pure and unit-testable: no Electron/React.
//
// The returned offset is in the app's convention — a positive value means the
// subtitles should be delayed (shifted later) to line up with the audio.

import type { SrtCue } from './types';

export interface PeaksLike {
  /** Per-sample minimum amplitude (negative). */
  min: Float32Array;
  /** Per-sample maximum amplitude (positive). */
  max: Float32Array;
  /** Samples per second in `min`/`max`. */
  peaksPerSec: number;
  /** Audio duration in seconds. */
  duration: number;
}

export interface AutoSyncOptions {
  /** Maximum offset to search in each direction (seconds). */
  maxShiftSec?: number;
  /** Working resolution in bins per second. */
  resolution?: number;
  /** Audio is "active" when its envelope exceeds this fraction of the peak. */
  activityThreshold?: number;
}

export interface AutoSyncResult {
  /** Offset to apply, in seconds (positive = delay subtitles). */
  offsetSec: number;
  /** Normalized correlation score of the chosen offset (0–1). */
  score: number;
}

const DEFAULTS = {
  maxShiftSec: 20,
  resolution: 8,
  activityThreshold: 0.12,
};

/**
 * Returns the best-fit offset, or `null` when there isn't enough signal
 * (no cues, silent audio, or zero duration) to estimate one.
 */
export function estimateSubtitleOffset(
  cues: SrtCue[],
  peaks: PeaksLike,
  options: AutoSyncOptions = {}
): AutoSyncResult | null {
  const maxShiftSec = options.maxShiftSec ?? DEFAULTS.maxShiftSec;
  const res = options.resolution ?? DEFAULTS.resolution;
  const threshold = options.activityThreshold ?? DEFAULTS.activityThreshold;

  if (cues.length === 0 || peaks.duration <= 0 || peaks.peaksPerSec <= 0) return null;

  const n = Math.ceil(peaks.duration * res);
  if (n <= 0) return null;

  // Audio activity envelope, resampled to `res` bins/sec and binarized.
  const audio = new Float32Array(n);
  let maxAmp = 0;
  for (let i = 0; i < n; i++) {
    const k = Math.min(peaks.min.length - 1, Math.floor((i / res) * peaks.peaksPerSec));
    if (k < 0) continue;
    const amp = Math.max(Math.abs(peaks.min[k] ?? 0), Math.abs(peaks.max[k] ?? 0));
    audio[i] = amp;
    if (amp > maxAmp) maxAmp = amp;
  }
  if (maxAmp <= 0) return null;
  const cutoff = maxAmp * threshold;
  let audioActive = 0;
  for (let i = 0; i < n; i++) {
    const on = audio[i] >= cutoff ? 1 : 0;
    audio[i] = on;
    audioActive += on;
  }
  // No contrast (uniform loud or uniform quiet) → nothing to align against.
  if (audioActive === 0 || audioActive === n) return null;

  // Subtitle "speech present" bins.
  const sub = new Uint8Array(n);
  let subActive = 0;
  for (const c of cues) {
    const a = Math.max(0, Math.floor(c.start * res));
    const b = Math.min(n, Math.ceil(c.end * res));
    for (let i = a; i < b; i++) {
      if (sub[i] === 0) subActive++;
      sub[i] = 1;
    }
  }
  if (subActive === 0) return null;

  const maxShift = Math.round(maxShiftSec * res);
  let bestShift = 0;
  let bestScore = -1;
  for (let shift = -maxShift; shift <= maxShift; shift++) {
    let overlap = 0;
    for (let j = 0; j < n; j++) {
      if (sub[j] === 0) continue;
      const idx = j + shift;
      if (idx >= 0 && idx < n) overlap += audio[idx];
    }
    const score = overlap / subActive;
    if (score > bestScore) {
      bestScore = score;
      bestShift = shift;
    }
  }

  return { offsetSec: bestShift / res, score: Math.max(0, bestScore) };
}
