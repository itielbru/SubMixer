import type { CueWarningThresholds, SrtCue } from '@shared/types';

export const DEFAULT_CUE_WARNING_THRESHOLDS: CueWarningThresholds = {
  minCueDurationSec: 1.2,
  maxCueDurationSec: 8,
  maxCps: 25,
  hardMaxCps: 35,
  minGapSec: 0.12,
};

export type WarningLevel = 'ok' | 'warn' | 'err';

/** Stable identifier for the worst issue on a cue; localized at the UI layer. */
export type WarningReasonKey =
  | 'overlap'
  | 'veryFastCps'
  | 'fastCps'
  | 'short'
  | 'long'
  | 'shortGap';

export interface CueWarnings {
  level: WarningLevel;
  cps: number;
  /** Cue duration in seconds (for display alongside the reason). */
  durationSec: number;
  /** Key for the worst issue, or null if ok. Localize via `warningReasonText`. */
  reasonKey: WarningReasonKey | null;
  short: boolean;
  long: boolean;
  fastCps: boolean;
  veryFastCps: boolean;
  overlapsPrev: boolean;
  overlapsNext: boolean;
  shortGapPrev: boolean;
  shortGapNext: boolean;
}

export function visibleLen(text: string): number {
  // Drop simple HTML-ish tags and direction marks so CPS reflects what
  // a viewer actually reads.
  return text
    .replace(/<[^>]+>/g, '')
    .replace(/[‎‏‪-‮]/g, '')
    .replace(/\s+/g, ' ')
    .trim().length;
}

export function computeWarnings(
  cue: SrtCue,
  prev: SrtCue | undefined,
  next: SrtCue | undefined,
  thresholds: CueWarningThresholds = DEFAULT_CUE_WARNING_THRESHOLDS
): CueWarnings {
  const dur = Math.max(0, cue.end - cue.start);
  const chars = visibleLen(cue.text);
  const cps = dur > 0 ? chars / dur : 0;

  const short = dur < thresholds.minCueDurationSec;
  const long = dur > thresholds.maxCueDurationSec;
  const fastCps = cps > thresholds.maxCps;
  const veryFastCps = cps > thresholds.hardMaxCps;
  const overlapsPrev = !!prev && cue.start < prev.end - 1e-3;
  const overlapsNext = !!next && cue.end > next.start + 1e-3;
  const shortGapPrev =
    !!prev && !overlapsPrev && cue.start - prev.end < thresholds.minGapSec;
  const shortGapNext =
    !!next && !overlapsNext && next.start - cue.end < thresholds.minGapSec;

  let level: WarningLevel = 'ok';
  let reasonKey: WarningReasonKey | null = null;
  if (overlapsPrev || overlapsNext) {
    level = 'err';
    reasonKey = 'overlap';
  } else if (veryFastCps) {
    level = 'err';
    reasonKey = 'veryFastCps';
  } else if (fastCps) {
    level = 'warn';
    reasonKey = 'fastCps';
  } else if (short) {
    level = 'warn';
    reasonKey = 'short';
  } else if (long) {
    level = 'warn';
    reasonKey = 'long';
  } else if (shortGapPrev || shortGapNext) {
    level = 'warn';
    reasonKey = 'shortGap';
  }

  return {
    level,
    cps,
    durationSec: dur,
    reasonKey,
    short,
    long,
    fastCps,
    veryFastCps,
    overlapsPrev,
    overlapsNext,
    shortGapPrev,
    shortGapNext,
  };
}
