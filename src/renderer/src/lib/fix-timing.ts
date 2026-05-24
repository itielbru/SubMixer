import type { SrtCue } from '@shared/types';

const MIN_CUE_DUR = 0.05;

export interface TimingFixChange {
  cueIndex: number;
  lineA: number;
  lineB: number;
  newStartSec: number;
  kind: 'overlap' | 'gap';
  description: string;
}

export interface FixTimingOptions {
  fixOverlaps: boolean;
  fixGaps: boolean;
  minGapSec: number;
}

/** Fix overlaps and/or short gaps between adjacent cues. */
export function fixOverlapsAndShortGaps(
  cues: SrtCue[],
  opts: FixTimingOptions
): { cues: SrtCue[]; changes: TimingFixChange[] } {
  if (cues.length < 2) return { cues: cues.map((c) => ({ ...c })), changes: [] };
  const next = cues.map((c) => ({ ...c }));
  const changes: TimingFixChange[] = [];

  for (let i = 0; i < next.length - 1; i++) {
    const a = next[i];
    const b = next[i + 1];
    const gap = b.start - a.end;
    const isOverlap = gap < -1e-3;
    const isShortGap = !isOverlap && gap < opts.minGapSec - 1e-6;
    if (isOverlap && !opts.fixOverlaps) continue;
    if (isShortGap && !opts.fixGaps) continue;
    if (!isOverlap && !isShortGap) continue;

    const newStart = a.end + (isOverlap ? 0 : opts.minGapSec);
    b.start = isOverlap ? Math.max(a.end, newStart) : newStart;
    if (b.end <= b.start) b.end = b.start + MIN_CUE_DUR;
    changes.push({
      cueIndex: i + 1,
      lineA: i + 1,
      lineB: i + 2,
      newStartSec: b.start,
      kind: isOverlap ? 'overlap' : 'gap',
      description: '',
    });
  }

  return { cues: next, changes };
}
