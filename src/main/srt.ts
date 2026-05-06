import { promises as fs } from 'fs';
import * as path from 'path';
import { app } from 'electron';
import * as chardet from 'chardet';
import * as iconv from 'iconv-lite';
import type { SrtCue } from '@shared/types';

// SRT timestamp helpers ──────────────────────────────────────────────────────

function parseTs(ts: string): number {
  // 00:00:01,234 or 00:00:01.234
  const m = ts.trim().match(/^(\d+):(\d+):(\d+)[,.](\d+)$/);
  if (!m) return 0;
  const [, h, mn, s, ms] = m;
  return Number(h) * 3600 + Number(mn) * 60 + Number(s) + Number(ms) / 1000;
}

function fmtTs(sec: number): string {
  if (sec < 0) sec = 0;
  const h = Math.floor(sec / 3600);
  const m = Math.floor((sec % 3600) / 60);
  const s = Math.floor(sec % 60);
  const ms = Math.round((sec - Math.floor(sec)) * 1000);
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')},${String(ms).padStart(3, '0')}`;
}

// Parse / serialize ─────────────────────────────────────────────────────────

export function parseSrt(text: string): SrtCue[] {
  // Normalize newlines and BOM
  const clean = text.replace(/^\uFEFF/, '').replace(/\r\n/g, '\n').replace(/\r/g, '\n').trim();
  if (!clean) return [];

  const blocks = clean.split(/\n\s*\n/);
  const cues: SrtCue[] = [];
  for (const block of blocks) {
    const lines = block.split('\n').map((l) => l.replace(/\s+$/, ''));
    let cursor = 0;
    let idx = 0;
    if (/^\d+$/.test(lines[cursor]?.trim() ?? '')) {
      idx = Number(lines[cursor].trim());
      cursor++;
    } else {
      idx = cues.length + 1;
    }
    const tsLine = lines[cursor];
    if (!tsLine) continue;
    const tsMatch = tsLine.match(/(\S+)\s*-->\s*(\S+)/);
    if (!tsMatch) continue;
    const start = parseTs(tsMatch[1]);
    const end = parseTs(tsMatch[2]);
    cursor++;
    const text = lines.slice(cursor).join('\n').trim();
    if (!text) continue;
    cues.push({ idx, start, end, text });
  }
  return cues;
}

export function serializeSrt(cues: SrtCue[]): string {
  const out: string[] = [];
  cues.forEach((c, i) => {
    out.push(String(i + 1));
    out.push(`${fmtTs(c.start)} --> ${fmtTs(c.end)}`);
    out.push(c.text);
    out.push('');
  });
  return out.join('\n');
}

export function applyTransform(
  cues: SrtCue[],
  opts: { offset: number; speed: number }
): SrtCue[] {
  const { offset, speed } = opts;
  return cues.map((c) => ({
    ...c,
    start: Math.max(0, c.start * speed + offset),
    end: Math.max(0, c.end * speed + offset),
  }));
}

// Read with encoding detection ──────────────────────────────────────────────

export async function readSrtFile(filePath: string): Promise<{
  cues: SrtCue[];
  encoding: string;
  size: number;
}> {
  const buf = await fs.readFile(filePath);
  const detected = (chardet.detect(buf) || 'UTF-8').toString();

  // Some Hebrew files come as Windows-1255 — chardet gets it sometimes wrong;
  // if it isn't UTF-8 we use the detection, else default to UTF-8.
  let text: string;
  try {
    if (iconv.encodingExists(detected)) {
      text = iconv.decode(buf, detected);
    } else {
      text = buf.toString('utf-8');
    }
  } catch {
    text = buf.toString('utf-8');
  }

  return {
    cues: parseSrt(text),
    encoding: detected,
    size: buf.byteLength,
  };
}

// Build a transformed SRT for export ─────────────────────────────────────────

const tempDir = () => path.join(app.getPath('userData'), 'temp', 'srt');

export async function writeTransformedSrt(
  sourcePath: string,
  opts: { offset: number; speed: number; encoding?: string }
): Promise<string> {
  const dir = tempDir();
  await fs.mkdir(dir, { recursive: true });

  const { cues } = await readSrtFile(sourcePath);
  const transformed =
    opts.offset === 0 && opts.speed === 1 ? cues : applyTransform(cues, opts);
  const text = serializeSrt(transformed);

  const outPath = path.join(
    dir,
    `${Date.now()}-${path.basename(sourcePath, path.extname(sourcePath))}.srt`
  );
  await fs.writeFile(outPath, '\uFEFF' + text, 'utf-8');
  return outPath;
}

export async function clearTempSrt(): Promise<void> {
  try {
    const dir = tempDir();
    const files = await fs.readdir(dir);
    await Promise.all(files.map((f) => fs.unlink(path.join(dir, f)).catch(() => null)));
  } catch {
    // ignore
  }
}
