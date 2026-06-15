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
  /** File basename without extension (used as default output name/title) */
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
  externalSubs: {
    path: string;
    lang: string;
    def: boolean;
    forced: boolean;
    offset: number;
    speed: number;
    trackName: string;
    encoding: string;
  }[];
  videoTrackId: number | null;
  audioTracks: { id: number; lang: string; def: boolean; forced: boolean; codecName?: string }[];
  embeddedSubs: { id: number; lang: string; def: boolean; forced: boolean; codecName?: string }[];
  outputPath: string;
  /** Container metadata title (output filename without extension) */
  metadataTitle: string;
  container: 'mkv' | 'mp4';
  /** When set, burn this external sub (index into externalSubs) into the video
   *  instead of muxing it as a soft track. Requires re-encoding the video.
   *  null = normal soft-subtitle mux. */
  burnInSubIndex: number | null;
  /** Encode quality (only applies when burnInSubIndex !== null). */
  encodePreset: string;
  encodeCrf: number;
  /** Burn-in subtitle appearance (only applies when burnInSubIndex !== null). */
  burnInFontSize: number;
  burnInPrimaryColor: string;
  burnInOutline: number;
  /** MP4 audio bitrate override when transcoding is required (kbps). */
  mp4AudioBitrate: number;
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
  plan?: ExportPlan;
  durationSec?: number;
}

/** Subtitle quality warning thresholds (user configurable). */
export interface CueWarningThresholds {
  minCueDurationSec: number;
  maxCueDurationSec: number;
  maxCps: number;
  hardMaxCps: number;
  minGapSec: number;
}

export interface AppSettings {
  theme: 'dark' | 'light' | 'system';
  accent: 'indigo' | 'graphite' | 'emerald' | 'amber' | 'crimson';
  font: 'Heebo' | 'Assistant';
  lang: 'he' | 'en';
  defaultDestFolder: string;
  /** When true, export into a subfolder named after title/year or SxxExx */
  exportUseContentFolder: boolean;
  recentFiles: string[];
  history: ExportRecord[];
  minCueDurationSec: number;
  maxCueDurationSec: number;
  maxCps: number;
  hardMaxCps: number;
  minGapSec: number;
  /** Subtitle overlay appearance (preview only). */
  subFontScale: number;
  subColor: string;
  subStyle: SubStyleMode;
  subPosition: 'bottom' | 'top';
  /** Burn the active external subtitle into the video on export (re-encodes). */
  burnInSubs: boolean;
  /** Default output container for new exports. */
  defaultContainer: 'mkv' | 'mp4';
  /** x264 preset for burn-in encodes (speed ↔ quality trade-off). */
  encodePreset: 'ultrafast' | 'veryfast' | 'faster' | 'fast' | 'medium' | 'slow';
  /** CRF quality value for burn-in encodes (lower = higher quality). */
  encodeCrf: number;
  /** Audio bitrate in kbps when MP4 export must transcode the audio. */
  mp4AudioBitrate: number;
  /** Burn-in subtitle font size (scaled to video height by ffmpeg). */
  burnInFontSize: number;
  /** Burn-in primary text color as hex (#RRGGBB). */
  burnInPrimaryColor: string;
  /** Burn-in outline thickness (0 = none, 1–4 = thicker). */
  burnInOutline: number;
  /** Last version the user saw in the "What's New" modal; empty string on first run. */
  lastSeenVersion: string;
}

export type SubStyleMode = 'outline' | 'box' | 'none';

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

export interface DiagnosticsInfo {
  appVersion: string;
  electronVersion: string;
  nodeVersion: string;
  platform: string;
  arch: string;
  ffmpegAvailable: boolean;
  ffmpegPath: string | null;
  ffprobePath: string | null;
  ffmpegVersion: string | null;
  userDataPath: string;
  previewCacheSizeBytes: number;
  peaksCacheSizeBytes: number;
  logSizeBytes: number;
}

export interface AddSubResult {
  ok: boolean;
  sub?: ExternalSub;
  cues?: SrtCue[];
  error?: string;
}

export type LogLevel = 'info' | 'ok' | 'warn' | 'err';
