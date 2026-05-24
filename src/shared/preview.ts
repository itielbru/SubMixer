/** Seconds of audio extracted first for fast preview playback. */
export const PREVIEW_QUICK_SECONDS = 90;

export type PreviewExtractPhase = 'quick' | 'full';

export type PreviewAudioTier = 'full' | 'quick';

export interface PreviewExtractResult {
  ok: boolean;
  path?: string;
  url?: string;
  error?: string;
  cached?: boolean;
  /** Present when playback uses a partial extract. */
  tier?: PreviewAudioTier;
  limitSec?: number;
}

export interface PreviewProgress {
  phase: PreviewExtractPhase;
  percent: number;
  eta: string;
  timeSec: number;
}
