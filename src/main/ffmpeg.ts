import { spawn, ChildProcessWithoutNullStreams, execFile } from 'child_process';
import { promisify } from 'util';
import { promises as fs } from 'fs';
import * as path from 'path';
import { app } from 'electron';
import type {
  MediaFile,
  Track,
  TrackKind,
  FFmpegStatus,
  ExportPlan,
  ExportProgress,
} from '@shared/types';

const execFileAsync = promisify(execFile);

let cachedStatus: FFmpegStatus | null = null;
let cachedStatusPromise: Promise<FFmpegStatus> | null = null;

// ── Binary discovery ────────────────────────────────────────────────────────

async function findLocalBinary(binary: string): Promise<string | null> {
  const isWin = process.platform === 'win32';
  const name = isWin ? `${binary}.exe` : binary;

  const candidates = [
    // Dev / project root bundled binaries
    path.join(app.getAppPath(), 'ffmpeg-bin', name),
    // Packaged app extraResources
    path.join(process.resourcesPath, 'ffmpeg', name),
    // Legacy path
    path.join(app.getAppPath(), 'ffmpeg', name),
    // User-managed copy
    path.join(app.getPath('userData'), 'bin', name),
  ];

  for (const p of candidates) {
    try {
      await fs.access(p);
      return p;
    } catch {
      // try next
    }
  }

  return null;
}

async function findOnPath(binary: string): Promise<string | null> {
  const cmd = process.platform === 'win32' ? 'where' : 'which';
  try {
    const { stdout } = await execFileAsync(cmd, [binary], { windowsHide: true });
    const first = stdout.split(/\r?\n/).map((s) => s.trim()).filter(Boolean)[0];
    return first || null;
  } catch {
    return null;
  }
}

export async function findBinaries(force = false): Promise<FFmpegStatus> {
  // Reuse an in-flight discovery so concurrent callers don't double-spawn
  // `where/which` + `-version`. `force` recomputes from scratch.
  if (!force && cachedStatusPromise) return cachedStatusPromise;

  cachedStatusPromise = (async (): Promise<FFmpegStatus> => {
    // Search local/embedded paths first, fallback to system PATH
    let ffmpegPath = await findLocalBinary('ffmpeg');
    if (!ffmpegPath) {
      ffmpegPath = await findOnPath('ffmpeg');
    }

    let ffprobePath = await findLocalBinary('ffprobe');
    if (!ffprobePath) {
      ffprobePath = await findOnPath('ffprobe');
    }

    let version: string | null = null;
    if (ffmpegPath) {
      try {
        const { stdout } = await execFileAsync(ffmpegPath, ['-version'], { windowsHide: true });
        version = stdout.split('\n')[0]?.trim() ?? null;
      } catch {
        // ignore
      }
    }
    cachedStatus = {
      available: !!(ffmpegPath && ffprobePath),
      ffmpegPath,
      ffprobePath,
      version,
    };
    return cachedStatus;
  })();

  return cachedStatusPromise;
}

function ensure(status: FFmpegStatus): asserts status is FFmpegStatus & {
  ffmpegPath: string;
  ffprobePath: string;
} {
  if (!status.available || !status.ffmpegPath || !status.ffprobePath) {
    throw new Error(
      'FFmpeg / FFprobe לא נמצאו במשתנה הסביבה PATH.\n' +
        'התקן מ: https://www.gyan.dev/ffmpeg/builds/'
    );
  }
}

// ── Probe ───────────────────────────────────────────────────────────────────

interface FFProbeStream {
  index: number;
  codec_type: 'video' | 'audio' | 'subtitle' | string;
  codec_name?: string;
  codec_long_name?: string;
  profile?: string;
  width?: number;
  height?: number;
  r_frame_rate?: string;
  avg_frame_rate?: string;
  bit_rate?: string;
  channels?: number;
  channel_layout?: string;
  sample_rate?: string;
  tags?: Record<string, string>;
  disposition?: Record<string, number>;
}

interface FFProbeFormat {
  duration?: string;
  size?: string;
  bit_rate?: string;
  format_name?: string;
  format_long_name?: string;
}

interface FFProbeOutput {
  streams: FFProbeStream[];
  format: FFProbeFormat;
}

const VIDEO_EXT_TO_CONTAINER: Record<string, string> = {
  '.mkv': 'MKV',
  '.mp4': 'MP4',
  '.m4v': 'MP4',
  '.mov': 'MOV',
  '.avi': 'AVI',
  '.webm': 'WEBM',
  '.ts': 'TS',
};

function fmtBytes(bytes: number): string {
  if (!bytes || !isFinite(bytes)) return '—';
  if (bytes >= 1024 ** 3) return (bytes / 1024 ** 3).toFixed(2) + ' GB';
  if (bytes >= 1024 ** 2) return (bytes / 1024 ** 2).toFixed(1) + ' MB';
  if (bytes >= 1024) return (bytes / 1024).toFixed(1) + ' KB';
  return bytes + ' B';
}

function fmtDuration(sec: number): string {
  if (!sec || !isFinite(sec)) return '—';
  const h = Math.floor(sec / 3600);
  const m = Math.floor((sec % 3600) / 60);
  const s = Math.floor(sec % 60);
  return h > 0
    ? `${h}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`
    : `${m}:${String(s).padStart(2, '0')}`;
}

function evalFraction(frac: string | undefined): number {
  if (!frac) return 0;
  const [n, d] = frac.split('/').map(Number);
  return d ? n / d : Number(frac) || 0;
}

function inferTitle(filename: string): { title: string; year: string } {
  const base = filename.replace(/\.[^.]+$/, '');
  const yearMatch = base.match(/(19|20)\d{2}/);
  const year = yearMatch ? yearMatch[0] : '';
  const title = base
    .split(/[._]/)
    .slice(0, yearMatch ? base.split(/[._]/).findIndex((p) => p === yearMatch[0]) : undefined)
    .join(' ')
    .trim() || base;
  return { title, year };
}

function streamToTrack(stream: FFProbeStream, isFirstVideo: boolean): Track | null {
  const kindMap: Record<string, TrackKind> = {
    video: 'V',
    audio: 'A',
    subtitle: 'S',
  };
  const kind = kindMap[stream.codec_type];
  if (!kind) return null;

  const tags = stream.tags ?? {};
  const disp = stream.disposition ?? {};
  const lang = (tags.language || tags.LANGUAGE || 'und').toLowerCase();
  const title = tags.title || tags.TITLE || '';

  let name = title;
  let info = '';
  const codec = (stream.codec_name || '').toUpperCase();
  const codecLong = stream.codec_long_name || '';

  if (kind === 'V') {
    name = name || 'וידאו ראשי';
    const fps = evalFraction(stream.r_frame_rate || stream.avg_frame_rate);
    const res = `${stream.width ?? '?'}×${stream.height ?? '?'}`;
    const br = stream.bit_rate ? `${(Number(stream.bit_rate) / 1_000_000).toFixed(1)} Mb/s` : '';
    info = [codec || codecLong, res, fps ? `${fps.toFixed(3)} fps` : '', br]
      .filter(Boolean)
      .join(' · ');
  } else if (kind === 'A') {
    if (!name) {
      const langName: Record<string, string> = {
        eng: 'English',
        heb: 'עברית',
        ara: 'العربية',
        spa: 'Español',
        fre: 'Français',
        fra: 'Français',
        ger: 'Deutsch',
        deu: 'Deutsch',
        rus: 'Русский',
        jpn: '日本語',
      };
      name = langName[lang] || lang.toUpperCase();
    }
    const ch = stream.channels
      ? stream.channel_layout
        ? `${stream.channel_layout}`
        : `${stream.channels}ch`
      : '';
    const br = stream.bit_rate ? `${Math.round(Number(stream.bit_rate) / 1000)} kb/s` : '';
    info = [codec || codecLong, ch, br].filter(Boolean).join(' · ');
  } else {
    if (!name) {
      const langName: Record<string, string> = {
        eng: 'English',
        heb: 'עברית',
        ara: 'العربية',
        spa: 'Español',
        fre: 'Français',
        fra: 'Français',
      };
      name = langName[lang] || lang.toUpperCase();
    }
    if (disp.forced) name += ' · Forced';
    info = codec || codecLong || 'subtitle';
  }

  return {
    id: stream.index,
    kind,
    codec,
    codecName: stream.codec_name,
    name: name || '—',
    info,
    lang,
    def: !!disp.default || (kind === 'V' && isFirstVideo),
    forced: !!disp.forced,
    keep: true,
    locked: kind === 'V' && isFirstVideo,
    bitrate: stream.bit_rate ? Number(stream.bit_rate) : undefined,
  };
}

export async function probe(filePath: string): Promise<MediaFile> {
  const status = await findBinaries();
  ensure(status);
  const args = [
    '-v', 'quiet',
    '-print_format', 'json',
    '-show_format',
    '-show_streams',
    filePath,
  ];
  const { stdout } = await execFileAsync(status.ffprobePath, args, {
    windowsHide: true,
    maxBuffer: 32 * 1024 * 1024,
  });
  const out: FFProbeOutput = JSON.parse(stdout);

  let firstVideoSeen = false;
  const tracks: Track[] = [];
  for (const s of out.streams) {
    const isFirstVideo = s.codec_type === 'video' && !firstVideoSeen;
    if (isFirstVideo) firstVideoSeen = true;
    const tr = streamToTrack(s, isFirstVideo);
    if (tr) tracks.push(tr);
  }

  const stat = await fs.stat(filePath);
  const ext = path.extname(filePath).toLowerCase();
  const container = VIDEO_EXT_TO_CONTAINER[ext] || ext.replace('.', '').toUpperCase() || 'FILE';

  const v = tracks.find((t) => t.kind === 'V');
  const vStream = out.streams.find((s) => s.codec_type === 'video');
  const fps = evalFraction(vStream?.r_frame_rate || vStream?.avg_frame_rate);
  const durationSec = Number(out.format.duration ?? 0);

  const fileName = path.basename(filePath);
  const baseName = fileName.replace(/\.[^.]+$/, '');
  const { year } = inferTitle(fileName);

  return {
    path: filePath,
    name: fileName,
    title: baseName,
    year,
    container,
    size: fmtBytes(stat.size),
    sizeBytes: stat.size,
    video: v?.codec || (vStream?.codec_name || '').toUpperCase() || '—',
    res: vStream ? `${vStream.width}×${vStream.height}` : '—',
    fps: fps ? fps.toFixed(3).replace(/\.?0+$/, '') : '—',
    duration: fmtDuration(durationSec),
    durationSec,
    tracks,
  };
}

// ── Audio preview extraction ────────────────────────────────────────────────

const previewDir = () => path.join(app.getPath('userData'), 'temp', 'preview');

let activePreview: ChildProcessWithoutNullStreams | null = null;

export async function extractAudioPreview(
  filePath: string,
  trackIndex: number,
  jobId: string,
  onProgress?: (p: ExportProgress) => void,
  totalDur = 0,
  limitSec?: number
): Promise<string> {
  const status = await findBinaries();
  ensure(status);
  const dir = previewDir();
  await fs.mkdir(dir, { recursive: true });
  // AAC/M4A (not VBR MP3): MP3 VBR seeks imprecisely in Chromium via the coarse
  // Xing TOC, so a timeline jump lands the audio off from previewT and the
  // subtitle overlay drifts out of sync. M4A carries a sample-accurate seek table.
  const outPath = path.join(dir, `${jobId}.m4a`);

  // Cancel any in-flight extraction first
  if (activePreview && !activePreview.killed) {
    try { activePreview.kill('SIGINT'); } catch { /* */ }
    activePreview = null;
  }

  const capDur =
    limitSec && limitSec > 0
      ? totalDur > 0
        ? Math.min(limitSec, totalDur)
        : limitSec
      : totalDur;

  const args = [
    '-y',
    '-hide_banner',
    '-loglevel', 'info',
    '-stats',
    '-i', filePath,
    '-map', `0:${trackIndex}`,
    '-vn',
  ];
  if (limitSec && limitSec > 0) {
    args.push('-t', String(limitSec));
  }
  args.push('-c:a', 'aac', '-b:a', '160k', '-movflags', '+faststart', outPath);

  return new Promise((resolveP, rejectP) => {
    const child = spawn(status.ffmpegPath, args, { windowsHide: true });
    activePreview = child;

    const timer = setTimeout(() => {
      try { child.kill('SIGINT'); } catch { /* */ }
      rejectP(new Error('FFmpeg preview timed out after 3 minutes'));
    }, 180_000);

    child.stderr.on('data', (chunk: Buffer) => {
      const text = chunk.toString();
      const m = text.match(/time=(\d+):(\d+):(\d+)\.(\d+)/);
      if (m && onProgress) {
        const [, h, mn, s, ms] = m;
        const t = Number(h) * 3600 + Number(mn) * 60 + Number(s) + Number(ms) / 100;
        const pct = capDur > 0 ? Math.min(100, (t / capDur) * 100) : 0;
        onProgress({
          percent: pct,
          eta: '',
          timeSec: t,
        });
      }
    });

    child.on('error', (err) => {
      clearTimeout(timer);
      // Remove any partial output so cancelled/failed extractions don't leak.
      fs.unlink(outPath).catch(() => undefined);
      rejectP(err);
    });
    child.on('close', (code) => {
      clearTimeout(timer);
      activePreview = null;
      if (code === 0) resolveP(outPath);
      else {
        // Cancelled (SIGINT) or failed: drop the partial M4A.
        fs.unlink(outPath).catch(() => undefined);
        rejectP(new Error(`ffmpeg exited with code ${code}`));
      }
    });
  });
}

// ── Fast peaks extraction (PCM stream → min/max bins) ──────────────────────

export interface PeaksData {
  peaksPerSec: number;
  durationSec: number;
  min: Float32Array;
  max: Float32Array;
}

export async function extractPeaks(
  filePath: string,
  trackIndex: number,
  durationSec: number,
  onProgress?: (pct: number) => void,
  peaksPerSec = 100
): Promise<PeaksData> {
  const status = await findBinaries();
  ensure(status);

  const srcRate = 1000;
  const samplesPerPeak = Math.max(1, Math.floor(srcRate / peaksPerSec));
  const estimatedPeaks = Math.max(1, Math.ceil(durationSec * peaksPerSec));
  let min = new Float32Array(estimatedPeaks);
  let max = new Float32Array(estimatedPeaks);
  let peakCount = 0;
  let carry = Buffer.alloc(0);
  let binMin = 1;
  let binMax = -1;
  let binFilled = 0;

  const args = [
    '-hide_banner',
    '-loglevel', 'error',
    '-i', filePath,
    '-map', `0:${trackIndex}`,
    '-vn',
    '-ac', '1',
    '-ar', String(srcRate),
    '-f', 's16le',
    'pipe:1',
  ];

  return new Promise<PeaksData>((resolveP, rejectP) => {
    const child = spawn(status.ffmpegPath, args, { windowsHide: true });
    let stderr = '';
    child.stderr?.on('data', (b) => {
      stderr += b.toString();
    });

    const timer = setTimeout(() => {
      try { child.kill('SIGINT'); } catch { /* */ }
      rejectP(new Error('FFmpeg peaks extraction timed out after 2 minutes'));
    }, 120_000);

    const ensureCapacity = (need: number): void => {
      if (need <= min.length) return;
      let cap = min.length;
      while (cap < need) cap *= 2;
      const nMin = new Float32Array(cap);
      const nMax = new Float32Array(cap);
      nMin.set(min);
      nMax.set(max);
      min = nMin;
      max = nMax;
    };

    child.stdout.on('data', (chunk: Buffer) => {
      const buf = carry.length ? Buffer.concat([carry, chunk]) : chunk;
      const sampleBytes = 2;
      const sampleCount = Math.floor(buf.length / sampleBytes);

      for (let i = 0; i < sampleCount; i++) {
        const v = buf.readInt16LE(i * sampleBytes) / 32768;
        if (v < binMin) binMin = v;
        if (v > binMax) binMax = v;
        binFilled++;
        if (binFilled >= samplesPerPeak) {
          ensureCapacity(peakCount + 1);
          min[peakCount] = binMin;
          max[peakCount] = binMax;
          peakCount++;
          binMin = 1;
          binMax = -1;
          binFilled = 0;
        }
      }

      const consumed = sampleCount * sampleBytes;
      carry =
        buf.length > consumed ? Buffer.from(buf.subarray(consumed)) : Buffer.alloc(0);

      if (onProgress && durationSec > 0) {
        onProgress(Math.min(99, (peakCount / peaksPerSec / durationSec) * 100));
      }
    });

    child.on('error', (err) => { clearTimeout(timer); rejectP(err); });
    child.on('close', (code) => {
      clearTimeout(timer);
      if (code !== 0) {
        return rejectP(
          new Error(`ffmpeg peaks failed (${code}): ${stderr.trim().slice(0, 400)}`)
        );
      }
      if (binFilled > 0) {
        ensureCapacity(peakCount + 1);
        min[peakCount] = binMin;
        max[peakCount] = binMax;
        peakCount++;
      }
      onProgress?.(100);
      resolveP({
        peaksPerSec,
        durationSec,
        min: min.subarray(0, peakCount).slice(),
        max: max.subarray(0, peakCount).slice(),
      });
    });
  });
}

// ── Export ──────────────────────────────────────────────────────────────────

export interface ActiveExport {
  child: ChildProcessWithoutNullStreams;
  cancel: () => void;
}

let activeExport: ActiveExport | null = null;

const MP4_AUDIO_COPY = new Set([
  'aac',
  'mp3',
  'mp2',
  'ac3',
  'eac3',
  'alac',
  'opus',
]);

function mp4AudioCopySafe(codecName?: string): boolean {
  const c = (codecName || '').toLowerCase();
  return !c || MP4_AUDIO_COPY.has(c);
}

function isBitmapSubCodec(codecName?: string): boolean {
  const c = (codecName || '').toLowerCase();
  return (
    c.includes('pgs') ||
    c.includes('dvd_subtitle') ||
    c.includes('dvb_subtitle') ||
    c.includes('xsub') ||
    c === 'hdmv_pgs_subtitle'
  );
}

export function validateExportPlan(plan: ExportPlan): string | null {
  if (!plan.outputPath?.trim()) {
    return 'Output path is missing';
  }
  if (plan.container === 'mp4') {
    for (const s of plan.embeddedSubs) {
      if (isBitmapSubCodec(s.codecName)) {
        return 'Bitmap subtitles (PGS/DVB) cannot be muxed into MP4. Remove them or choose MKV.';
      }
    }
  }
  const hasVideo = plan.videoTrackId !== null;
  const hasAudio = plan.audioTracks.length > 0;
  const hasSubs = plan.embeddedSubs.length > 0 || plan.externalSubs.length > 0;
  if (!hasVideo && !hasAudio && !hasSubs) {
    return 'Nothing selected to export';
  }
  return null;
}

function parseFfmpegError(stderr: string): string {
  // Check common patterns directly on full stderr first for precise matching
  if (/no space left on device/i.test(stderr))
    return 'Export failed — disk is full. Free up space and try again.';
  if (/permission denied/i.test(stderr))
    return 'Export failed — permission denied. Check that the destination folder is writable.';
  if (/codec not currently supported in container/i.test(stderr))
    return 'Export failed — one or more tracks use a codec not supported by the chosen container. Switch to MKV or remove the incompatible track.';
  if (/moov atom not found|invalid data found when processing input|end of file/i.test(stderr))
    return 'Export failed — the source file appears to be corrupt or incomplete.';
  if (/output file.*already exists|overwriting/i.test(stderr))
    return 'Export failed — output file already exists and overwriting was refused.';

  const lines = stderr
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter(Boolean);
  const errLines = lines.filter((l) =>
    /error|invalid|failed|not supported|does not match|could not|unable to/i.test(l)
  );
  if (errLines.length > 0) {
    const joined = errLines.slice(-2).join(' · ');
    if (/invalid utf-8|sub_charenc/i.test(joined))
      return 'Subtitle encoding error — the external subtitle file could not be read. Try re-adding it or save it as UTF-8 SRT.';
    return joined;
  }
  return 'FFmpeg export failed — open the FFmpeg command log for details.';
}

/** Escape a path for use inside the ffmpeg `subtitles=` filter value (wrapped in
 *  single quotes by the caller): forward slashes, escaped drive colon, and
 *  escaped single quotes so paths containing an apostrophe don't break the
 *  filter graph. */
function escapeSubtitlesFilterPath(p: string): string {
  return p
    .replace(/\\/g, '/')
    .replace(/'/g, "\\'")
    .replace(/:/g, '\\:');
}

/** Convert a `#rrggbb` hex string to an ASS colour literal `&HAABBGGRR`
 *  (alpha 00 = fully opaque in ASS). Falls back to opaque white. */
function hexToAssColor(hex: string): string {
  const m = /^#?([0-9a-fA-F]{6})$/.exec((hex || '').trim());
  if (!m) return '&H00FFFFFF';
  const r = m[1].slice(0, 2);
  const g = m[1].slice(2, 4);
  const b = m[1].slice(4, 6);
  return `&H00${b}${g}${r}`.toUpperCase();
}

/** Build a libass `force_style` string from the user's subtitle appearance so a
 *  burned-in subtitle matches the live preview. */
function buildForceStyle(style: ExportPlan['burnInStyle']): string {
  const color = hexToAssColor(style?.color ?? '#ffffff');
  // Preview scales a clamped font; 24pt is a sane SD baseline to scale from.
  const fontSize = Math.max(8, Math.round(24 * (style?.fontScale ?? 1)));
  // 2 = bottom-center, 8 = top-center (libass numpad alignment).
  const alignment = style?.position === 'top' ? 8 : 2;
  const parts = [`PrimaryColour=${color}`, `FontSize=${fontSize}`, `Alignment=${alignment}`];
  switch (style?.style) {
    case 'box':
      parts.push('BorderStyle=3', 'Outline=1', 'Shadow=0');
      break;
    case 'none':
      parts.push('BorderStyle=1', 'Outline=0', 'Shadow=1');
      break;
    case 'outline':
    default:
      parts.push('BorderStyle=1', 'Outline=2', 'Shadow=0');
      break;
  }
  return parts.join(',');
}

export function buildExportArgs(plan: ExportPlan, processedSubPaths: string[]): string[] {
  const args: string[] = ['-y', '-hide_banner', '-stats'];

  const burnIdx = plan.burnInSubIndex;
  const burning =
    burnIdx !== null &&
    burnIdx >= 0 &&
    burnIdx < processedSubPaths.length &&
    plan.videoTrackId !== null;

  args.push('-i', plan.inputFile);
  // External subs become inputs only when soft-muxing. A burned sub is read
  // directly by the subtitles filter, so it is not added as an input.
  if (!burning) {
    for (const p of processedSubPaths) {
      args.push('-sub_charenc', 'UTF-8');
      args.push('-i', p);
    }
  }

  if (plan.videoTrackId !== null) {
    args.push('-map', `0:${plan.videoTrackId}`);
  }
  for (const a of plan.audioTracks) {
    args.push('-map', `0:${a.id}`);
  }
  for (const s of plan.embeddedSubs) {
    args.push('-map', `0:${s.id}`);
  }
  if (!burning) {
    for (let i = 0; i < plan.externalSubs.length; i++) {
      args.push('-map', `${i + 1}:0`);
    }
  }

  if (plan.videoTrackId !== null) {
    if (burning) {
      const esc = escapeSubtitlesFilterPath(processedSubPaths[burnIdx]);
      const forceStyle = buildForceStyle(plan.burnInStyle);
      args.push('-vf', `subtitles='${esc}':force_style='${forceStyle}'`);
      args.push('-c:v', 'libx264', '-preset', 'faster', '-crf', '20', '-pix_fmt', 'yuv420p');
    } else {
      args.push('-c:v', 'copy');
    }
  }

  plan.audioTracks.forEach((a, idx) => {
    if (plan.container === 'mp4' && !mp4AudioCopySafe(a.codecName)) {
      args.push(`-c:a:${idx}`, 'aac');
      args.push(`-b:a:${idx}`, '192k');
    } else {
      args.push(`-c:a:${idx}`, 'copy');
    }
  });

  const externalSubCodec = plan.container === 'mp4' ? 'mov_text' : 'copy';
  let subOutIdx = 0;
  for (const s of plan.embeddedSubs) {
    if (isBitmapSubCodec(s.codecName)) {
      args.push(`-c:s:${subOutIdx}`, 'copy');
    } else if (plan.container === 'mp4') {
      args.push(`-c:s:${subOutIdx}`, 'mov_text');
    } else {
      args.push(`-c:s:${subOutIdx}`, 'copy');
    }
    subOutIdx++;
  }
  if (!burning) {
    for (let i = 0; i < plan.externalSubs.length; i++) {
      args.push(`-c:s:${subOutIdx + i}`, externalSubCodec);
    }
  }

  // Audio metadata + dispositions
  plan.audioTracks.forEach((a, idx) => {
    args.push(`-metadata:s:a:${idx}`, `language=${a.lang}`);
    const disp: string[] = [];
    if (a.def) disp.push('default');
    if (a.forced) disp.push('forced');
    if (disp.length) args.push(`-disposition:a:${idx}`, disp.join('+'));
  });

  // Subtitle metadata + dispositions (embedded first, then external)
  subOutIdx = 0;
  for (const s of plan.embeddedSubs) {
    args.push(`-metadata:s:s:${subOutIdx}`, `language=${s.lang}`);
    const disp: string[] = [];
    if (s.def) disp.push('default');
    if (s.forced) disp.push('forced');
    if (disp.length) args.push(`-disposition:s:${subOutIdx}`, disp.join('+'));
    subOutIdx++;
  }
  if (!burning) {
    for (const s of plan.externalSubs) {
      args.push(`-metadata:s:s:${subOutIdx}`, `language=${s.lang}`);
      if (s.trackName) {
        args.push(`-metadata:s:s:${subOutIdx}`, `title=${s.trackName}`);
      }
      const disp: string[] = [];
      if (s.def) disp.push('default');
      if (s.forced) disp.push('forced');
      if (disp.length) args.push(`-disposition:s:${subOutIdx}`, disp.join('+'));
      subOutIdx++;
    }
  }

  if (plan.metadataTitle.trim()) {
    args.push('-metadata', `title=${plan.metadataTitle.trim()}`);
  }

  args.push(plan.outputPath);
  return args;
}

export async function runExport(
  plan: ExportPlan,
  processedSubPaths: string[],
  totalDurationSec: number,
  onProgress: (p: ExportProgress) => void,
  onLog: (line: string) => void
): Promise<{ ok: boolean; code: number | null; cancelled: boolean; error?: string }> {
  const status = await findBinaries();
  ensure(status);

  const validationError = validateExportPlan(plan);
  if (validationError) {
    return { ok: false, code: null, cancelled: false, error: validationError };
  }

  if (plan.externalSubs.length !== processedSubPaths.length) {
    return {
      ok: false,
      code: null,
      cancelled: false,
      error: 'External subtitle preparation failed — try re-adding the subtitle file.',
    };
  }

  await fs.mkdir(path.dirname(plan.outputPath), { recursive: true });

  const args = buildExportArgs(plan, processedSubPaths);

  return new Promise((resolveP) => {
    const child = spawn(status.ffmpegPath, args, { windowsHide: true });
    let cancelled = false;
    let stderrBuf = '';
    activeExport = {
      child,
      cancel: () => {
        cancelled = true;
        try { child.kill('SIGINT'); } catch { /* */ }
      },
    };

    const startTime = Date.now();

    child.stderr.on('data', (chunk: Buffer) => {
      const text = chunk.toString();
      stderrBuf += text;
      onLog(text.trim());
      const lines = text.split(/\r|\n/);
      for (const line of lines) {
        const m = line.match(/time=(\d+):(\d+):(\d+)\.(\d+)/);
        if (m) {
          const [, h, mn, s, ms] = m;
          const t = Number(h) * 3600 + Number(mn) * 60 + Number(s) + Number(ms) / 100;
          const pct = totalDurationSec > 0 ? Math.min(100, (t / totalDurationSec) * 100) : 0;
          const elapsed = (Date.now() - startTime) / 1000;
          const remain = pct > 0 ? (elapsed / pct) * (100 - pct) : 0;
          const etaMin = Math.floor(remain / 60);
          const etaSec = Math.floor(remain % 60);
          onProgress({
            percent: pct,
            eta: `${String(etaMin).padStart(2, '0')}:${String(etaSec).padStart(2, '0')}`,
            timeSec: t,
          });
        }
      }
    });

    child.on('error', (err) => {
      onLog(`error: ${err.message}`);
      activeExport = null;
      resolveP({ ok: false, code: null, cancelled, error: err.message });
    });

    child.on('close', (code) => {
      activeExport = null;
      const ok = code === 0;
      const parsedErr = ok || cancelled ? undefined : parseFfmpegError(stderrBuf);
      resolveP({
        ok,
        code,
        cancelled,
        error: parsedErr,
      });
    });
  });
}

export function cancelActiveExport(): boolean {
  if (activeExport) {
    activeExport.cancel();
    return true;
  }
  return false;
}

/**
 * Force-terminate any in-flight ffmpeg child (preview extraction or export).
 * Used on app quit so we never leave orphaned ffmpeg processes behind.
 */
export function killActiveProcesses(): void {
  if (activePreview && !activePreview.killed) {
    try {
      activePreview.kill();
    } catch {
      /* */
    }
    activePreview = null;
  }
  if (activeExport) {
    try {
      activeExport.child.kill();
    } catch {
      /* */
    }
    activeExport = null;
  }
}

/** Build the same string the user would copy-paste */
export function buildCommandString(plan: ExportPlan, processedSubPaths: string[]): string {
  const status = cachedStatus;
  const ff = status?.ffmpegPath ? path.basename(status.ffmpegPath) : 'ffmpeg';
  const args = buildExportArgs(plan, processedSubPaths);
  const isWin = process.platform === 'win32';
  const quoted = args
    .map((a) => {
      if (!/[\s"'\\]/.test(a)) return a;
      if (isWin) {
        // cmd/PowerShell: double-quote and escape inner quotes + backslashes so
        // paths like C:\temp\file.srt survive a copy-paste verbatim.
        return `"${a.replace(/\\/g, '\\\\').replace(/"/g, '\\"')}"`;
      }
      // POSIX shells: single-quote, closing/reopening around any inner quote.
      return `'${a.replace(/'/g, "'\\''")}'`;
    })
    .join(' ');
  return `${ff} ${quoted}`;
}
