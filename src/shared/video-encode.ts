// Translate high-level video encode options into FFmpeg `-c:v …` arguments.
//
// Used only on the burn-in export path (subtitles filter forces a re-encode).
// Kept as a pure function so the per-encoder flag mapping is unit-testable and
// shared between the actual export and the "show command" preview.

import type { EncodePreset, VideoEncodeOptions, VideoEncoder } from './types';

export const DEFAULT_VIDEO_ENCODE: VideoEncodeOptions = {
  encoder: 'libx264',
  preset: 'fast',
  quality: 20,
};

/** Hardware encoders that should be offered only when ffmpeg reports them. */
export const HARDWARE_ENCODERS: VideoEncoder[] = [
  'h264_nvenc',
  'hevc_nvenc',
  'h264_qsv',
  'h264_amf',
  'h264_videotoolbox',
];

const X264_PRESET: Record<EncodePreset, string> = {
  fast: 'faster',
  medium: 'medium',
  slow: 'slow',
};

const NVENC_PRESET: Record<EncodePreset, string> = {
  fast: 'p2',
  medium: 'p4',
  slow: 'p6',
};

const QSV_PRESET: Record<EncodePreset, string> = {
  fast: 'veryfast',
  medium: 'medium',
  slow: 'veryslow',
};

const AMF_QUALITY: Record<EncodePreset, string> = {
  fast: 'speed',
  medium: 'balanced',
  slow: 'quality',
};

function clampQuality(q: number): number {
  if (!Number.isFinite(q)) return DEFAULT_VIDEO_ENCODE.quality;
  return Math.min(51, Math.max(0, Math.round(q)));
}

/**
 * Build the `-c:v <encoder>` plus preset/quality flags for the chosen encoder.
 * `-pix_fmt yuv420p` is appended for broad player compatibility.
 */
export function videoEncodeArgs(opts: VideoEncodeOptions = DEFAULT_VIDEO_ENCODE): string[] {
  const q = clampQuality(opts.quality);
  const preset = opts.preset;
  const args: string[] = ['-c:v', opts.encoder];

  switch (opts.encoder) {
    case 'libx264':
    case 'libx265':
      args.push('-preset', X264_PRESET[preset], '-crf', String(q));
      break;
    case 'h264_nvenc':
    case 'hevc_nvenc':
      // Constant-quality VBR; -cq mirrors CRF on NVENC.
      args.push('-preset', NVENC_PRESET[preset], '-rc', 'vbr', '-cq', String(q));
      break;
    case 'h264_qsv':
      args.push('-preset', QSV_PRESET[preset], '-global_quality', String(q));
      break;
    case 'h264_amf':
      args.push('-quality', AMF_QUALITY[preset], '-rc', 'cqp', '-qp_i', String(q), '-qp_p', String(q));
      break;
    case 'h264_videotoolbox':
      // VideoToolbox has no preset; -q:v is 1–100, higher = better, so invert.
      args.push('-q:v', String(Math.min(100, Math.max(1, 100 - q * 2))));
      break;
  }

  args.push('-pix_fmt', 'yuv420p');
  return args;
}
