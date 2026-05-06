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

// ── Binary discovery ────────────────────────────────────────────────────────

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
  if (cachedStatus && !force) return cachedStatus;
  const ffmpegPath = await findOnPath('ffmpeg');
  const ffprobePath = await findOnPath('ffprobe');
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
  const { title, year } = inferTitle(fileName);

  return {
    path: filePath,
    name: fileName,
    title,
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
  totalDur = 0
): Promise<string> {
  const status = await findBinaries();
  ensure(status);
  const dir = previewDir();
  await fs.mkdir(dir, { recursive: true });
  const outPath = path.join(dir, `${jobId}.mp3`);

  // Cancel any in-flight extraction first
  if (activePreview && !activePreview.killed) {
    try { activePreview.kill('SIGINT'); } catch { /* */ }
    activePreview = null;
  }

  const args = [
    '-y',
    '-hide_banner',
    '-loglevel', 'info',
    '-stats',
    '-i', filePath,
    '-map', `0:${trackIndex}`,
    '-vn',
    '-c:a', 'libmp3lame',
    '-q:a', '5',
    outPath,
  ];

  return new Promise((resolveP, rejectP) => {
    const child = spawn(status.ffmpegPath, args, { windowsHide: true });
    activePreview = child;

    child.stderr.on('data', (chunk: Buffer) => {
      const text = chunk.toString();
      const m = text.match(/time=(\d+):(\d+):(\d+)\.(\d+)/);
      if (m && onProgress) {
        const [, h, mn, s, ms] = m;
        const t = Number(h) * 3600 + Number(mn) * 60 + Number(s) + Number(ms) / 100;
        const pct = totalDur > 0 ? Math.min(100, (t / totalDur) * 100) : 0;
        onProgress({
          percent: pct,
          eta: '',
          timeSec: t,
        });
      }
    });

    child.on('error', rejectP);
    child.on('close', (code) => {
      activePreview = null;
      if (code === 0) resolveP(outPath);
      else rejectP(new Error(`ffmpeg exited with code ${code}`));
    });
  });
}

// ── Export ──────────────────────────────────────────────────────────────────

export interface ActiveExport {
  child: ChildProcessWithoutNullStreams;
  cancel: () => void;
}

let activeExport: ActiveExport | null = null;

export function buildExportArgs(plan: ExportPlan, processedSubPaths: string[]): string[] {
  const args: string[] = ['-y', '-hide_banner', '-stats'];

  args.push('-i', plan.inputFile);
  for (const p of processedSubPaths) {
    args.push('-i', p);
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
  for (let i = 0; i < plan.externalSubs.length; i++) {
    args.push('-map', `${i + 1}:0`);
  }

  args.push('-c:v', 'copy');
  args.push('-c:a', 'copy');
  if (plan.container === 'mp4') {
    args.push('-c:s', 'mov_text');
  } else {
    args.push('-c:s', 'srt');
  }

  // Audio metadata + dispositions
  plan.audioTracks.forEach((a, idx) => {
    args.push(`-metadata:s:a:${idx}`, `language=${a.lang}`);
    const disp: string[] = [];
    if (a.def) disp.push('default');
    if (a.forced) disp.push('forced');
    args.push(`-disposition:a:${idx}`, disp.length ? disp.join('+') : '0');
  });

  // Subtitle metadata + dispositions (embedded first, then external)
  let subIdx = 0;
  for (const s of plan.embeddedSubs) {
    args.push(`-metadata:s:s:${subIdx}`, `language=${s.lang}`);
    const disp: string[] = [];
    if (s.def) disp.push('default');
    if (s.forced) disp.push('forced');
    args.push(`-disposition:s:${subIdx}`, disp.length ? disp.join('+') : '0');
    subIdx++;
  }
  for (const s of plan.externalSubs) {
    args.push(`-metadata:s:s:${subIdx}`, `language=${s.lang}`);
    if (s.trackName) {
      args.push(`-metadata:s:s:${subIdx}`, `title=${s.trackName}`);
    }
    const disp: string[] = [];
    if (s.def) disp.push('default');
    if (s.forced) disp.push('forced');
    args.push(`-disposition:s:${subIdx}`, disp.length ? disp.join('+') : '0');
    subIdx++;
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
): Promise<{ ok: boolean; code: number | null; cancelled: boolean }> {
  const status = await findBinaries();
  ensure(status);

  await fs.mkdir(path.dirname(plan.outputPath), { recursive: true });

  const args = buildExportArgs(plan, processedSubPaths);

  return new Promise((resolveP) => {
    const child = spawn(status.ffmpegPath, args, { windowsHide: true });
    let cancelled = false;
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
      resolveP({ ok: false, code: null, cancelled });
    });

    child.on('close', (code) => {
      activeExport = null;
      resolveP({ ok: code === 0, code, cancelled });
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

/** Build the same string the user would copy-paste */
export function buildCommandString(plan: ExportPlan, processedSubPaths: string[]): string {
  const status = cachedStatus;
  const ff = status?.ffmpegPath ? path.basename(status.ffmpegPath) : 'ffmpeg';
  const args = buildExportArgs(plan, processedSubPaths);
  const quoted = args
    .map((a) => (/[\s"']/.test(a) ? `"${a.replace(/"/g, '\\"')}"` : a))
    .join(' ');
  return `${ff} ${quoted}`;
}
