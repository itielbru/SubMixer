import type { SrtCue } from './types';

export interface CueSyncOpts {
  offset: number;
  speed: number;
}

/** Match export transform: start' = start * speed + offset */
export function transformCues(cues: SrtCue[], opts: CueSyncOpts): SrtCue[] {
  const { offset, speed } = opts;
  if (offset === 0 && speed === 1) return cues;
  return cues.map((c) => ({
    ...c,
    start: Math.max(0, c.start * speed + offset),
    end: Math.max(0, c.end * speed + offset),
  }));
}

export function transformedCueTimes(
  cue: SrtCue,
  opts: CueSyncOpts,
): { start: number; end: number } {
  const { offset, speed } = opts;
  return {
    start: Math.max(0, cue.start * speed + offset),
    end: Math.max(0, cue.end * speed + offset),
  };
}

/** Cue visible at media playback time T after offset/speed (same as exported SRT). */
export function findCueAtMediaTime(
  cues: SrtCue[],
  mediaT: number,
  opts: CueSyncOpts,
): SrtCue | undefined {
  const { offset, speed } = opts;
  if (offset === 0 && speed === 1) {
    return cues.find((c) => mediaT >= c.start && mediaT <= c.end);
  }
  const invSpeed = speed !== 0 ? 1 / speed : 1;
  const fileT = (mediaT - offset) * invSpeed;
  return cues.find((c) => fileT >= c.start && fileT <= c.end);
}

export function findCueIndexAtMediaTime(cues: SrtCue[], mediaT: number, opts: CueSyncOpts): number {
  const cue = findCueAtMediaTime(cues, mediaT, opts);
  return cue ? cues.indexOf(cue) : -1;
}

/** Inverse: media time for a cue's file start (for seeking to cue). */
export function mediaTimeForCueStart(cueStart: number, opts: CueSyncOpts): number {
  return cueStart * opts.speed + opts.offset;
}

/** Media playback time → original cue file time (inverse of export transform). */
export function fileTimeFromMediaTime(mediaT: number, opts: CueSyncOpts): number {
  const { offset, speed } = opts;
  if (speed === 0) return mediaT - offset;
  return (mediaT - offset) / speed;
}

/** Two reference points for Visual Sync (Subtitle Edit style). */
export interface VisualSyncPoints {
  fileStart: number;
  fileEnd: number;
  mediaStart: number;
  mediaEnd: number;
}

/** Derive offset/speed so fileStart→mediaStart and fileEnd→mediaEnd after transform. */
export function computeVisualSync(
  points: VisualSyncPoints,
): { offset: number; speed: number } | null {
  const { fileStart, fileEnd, mediaStart, mediaEnd } = points;
  const fileSpan = fileEnd - fileStart;
  const mediaSpan = mediaEnd - mediaStart;
  if (fileSpan <= 1e-6 || mediaSpan <= 1e-6) return null;
  const speed = mediaSpan / fileSpan;
  if (!Number.isFinite(speed) || speed <= 0) return null;
  const offset = mediaStart - fileStart * speed;
  if (!Number.isFinite(offset)) return null;
  return { offset, speed };
}
