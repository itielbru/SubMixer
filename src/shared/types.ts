// Shared types between main and renderer.

export type TrackKind = 'V' | 'A' | 'S';

export interface Track {
  /** ffprobe stream index */
  id: number;
  kind: TrackKind;
  codec: string;
  /** Display name shown in the UI (auto-derived if title tag missing) */
  name: string;
  /** Sub-line shown in mono: codec · channels · bitrate · etc. */
  info: string;
  lang: string;
  def: boolean;
  forced: boolean;
  /** User intent: include in output */
  keep: boolean;
  /** Locked tracks (e.g. main video) cannot be dropped */
  locked?: boolean;
  /** Raw codec_name from ffprobe (mp4-friendly check) */
  codecName?: string;
  /** Bytes per second (estimated) — for size calc */
  bitrate?: number;
}

export interface MediaFile {
  /** Absolute path on disk */
  path: string;
  /** Just the file name */
  name: string;
  /** Inferred title (falls back to file basename) */
  title: string;
  /** Year extracted from name, "" if none */
  year: string;
  container: string;
  size: string;
  sizeBytes: number;
  video: string;
  res: string;
  fps: string;
  duration: string;
  durationSec: number;
  tracks: Track[];
}

export interface ExternalSub {
  id: string;
  /** Original path on disk (still UTF-8 text content cached in memory) */
  path: string;
  name: string;
  size: string;
  sizeBytes: number;
  cues: number;
  lang: string;
  trackName: string;
  offset: number;
  speed: number;
  def: boolean;
  forced: boolean;
  encoding: string;
}

export interface SrtCue {
  idx: number;
  start: number;
  end: number;
  text: string;
}

export interface ExportPlan {
  inputFile: string;
  externalSubs: { path: string; lang: string; def: boolean; forced: boolean; offset: number; speed: number; trackName: string; encoding: string; }[];
  videoTrackId: number | null;
  audioTracks: { id: number; lang: string; def: boolean; forced: boolean; }[];
  embeddedSubs: { id: number; lang: string; def: boolean; forced: boolean; }[];
  outputPath: string;
  container: 'mkv' | 'mp4';
}

export interface ExportProgress {
  /** 0–100 */
  percent: number;
  /** Like "00:23" */
  eta: string;
  /** ffmpeg's current time in seconds */
  timeSec: number;
}

export interface ExportRecord {
  name: string;
  path: string;
  size: string;
  time: string;
  ok: boolean;
}

export interface AppSettings {
  theme: 'dark' | 'light';
  accent: 'indigo' | 'graphite' | 'emerald' | 'amber' | 'crimson';
  font: 'Heebo' | 'Assistant';
  defaultDestFolder: string;
  recentFiles: string[];
  history: ExportRecord[];
}

export interface FFmpegStatus {
  available: boolean;
  ffmpegPath: string | null;
  ffprobePath: string | null;
  version: string | null;
}

export interface ProbeResult {
  ok: boolean;
  file?: MediaFile;
  error?: string;
}

export interface AddSubResult {
  ok: boolean;
  sub?: ExternalSub;
  cues?: SrtCue[];
  error?: string;
}

export type LogLevel = 'info' | 'ok' | 'warn' | 'err';
