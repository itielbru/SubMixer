import { promises as fs } from 'fs';
import * as path from 'path';
import { app } from 'electron';
import * as chardet from 'chardet';
import * as iconv from 'iconv-lite';
import type { SrtCue } from '@shared/types';

// SRT timestamp helpers ──────────────────────────────────────────────────────

/** Fractional-second digits → seconds: "5" and "500" are both 0.5 s. */
function fracSec(digits: string | undefined): number {
  return digits ? Number(`0.${digits}`) : 0;
}

function parseTs(ts: string): number {
  // 00:00:01,234 or 00:00:01.234
  const m = ts.trim().match(/^(\d+):(\d+):(\d+)[,.](\d+)$/);
  if (!m) return 0;
  const [, h, mn, s, frac] = m;
  return Number(h) * 3600 + Number(mn) * 60 + Number(s) + fracSec(frac);
}

export function fmtTs(sec: number): string {
  // Round once in whole milliseconds so 1.9996 becomes 00:00:02,000, never ",1000".
  const total = Math.max(0, Math.round(sec * 1000));
  const h = Math.floor(total / 3_600_000);
  const m = Math.floor((total % 3_600_000) / 60_000);
  const s = Math.floor((total % 60_000) / 1000);
  const ms = total % 1000;
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
    let idx: number;
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

import { transformCues } from '@shared/cue-sync';

export { transformCues as applyTransform };

/** Temp file names stay ASCII-safe: they end up inside ffmpeg filter strings. */
function safeTempBase(baseName: string): string {
  return baseName.replace(/[^\w.-]+/g, '_').slice(0, 80) || 'cues';
}

export async function writeCuesToFile(cues: SrtCue[], baseName: string): Promise<string> {
  const dir = tempDir();
  await fs.mkdir(dir, { recursive: true });
  const text = serializeSrt(cues);
  const outPath = path.join(dir, `${Date.now()}-edit-${safeTempBase(baseName)}.srt`);
  await fs.writeFile(outPath, '\uFEFF' + text, 'utf-8');
  return outPath;
}

// Parse VTT format to SrtCue
export function parseVtt(text: string): SrtCue[] {
  const clean = text.replace(/^\uFEFF/, '').replace(/\r\n/g, '\n').replace(/\r/g, '\n').trim();
  if (!clean) return [];

  function parseVttTs(ts: string): number {
    const cleanTs = ts.trim().split(/\s+/)[0]; // strip settings
    const parts = cleanTs.split(':');
    let h = 0, m = 0, s = 0, frac = 0;
    if (parts.length === 2) {
      const sParts = parts[1].split(/[.,]/);
      m = Number(parts[0]);
      s = Number(sParts[0]);
      frac = fracSec(sParts[1]);
    } else if (parts.length === 3) {
      const sParts = parts[2].split(/[.,]/);
      h = Number(parts[0]);
      m = Number(parts[1]);
      s = Number(sParts[0]);
      frac = fracSec(sParts[1]);
    }
    return h * 3600 + m * 60 + s + frac;
  }

  const blocks = clean.split(/\n\s*\n/);
  const cues: SrtCue[] = [];
  for (const block of blocks) {
    const lines = block.split('\n').map((l) => l.replace(/\s+$/, ''));
    if (lines.length === 0) continue;
    
    // Ignore WEBVTT header block, STYLE block, REGION block, NOTE block
    const firstLine = lines[0].toUpperCase();
    if (firstLine.startsWith('WEBVTT') || firstLine.startsWith('STYLE') || firstLine.startsWith('REGION') || firstLine.startsWith('NOTE')) {
      continue;
    }

    let tsLineIdx = -1;
    for (let i = 0; i < lines.length; i++) {
      if (lines[i].includes('-->')) {
        tsLineIdx = i;
        break;
      }
    }
    if (tsLineIdx === -1) continue;

    const tsMatch = lines[tsLineIdx].match(/(\S+)\s*-->\s*(\S+)/);
    if (!tsMatch) continue;
    const start = parseVttTs(tsMatch[1]);
    const end = parseVttTs(tsMatch[2]);

    const rawText = lines.slice(tsLineIdx + 1).join('\n').trim();
    // Strip WebVTT formatting tags (e.g. <b>, <i>, <c.yellow>)
    const text = rawText.replace(/<[^>]+>/g, '').trim();
    if (!text) continue;

    const idx = cues.length + 1;
    cues.push({ idx, start, end, text });
  }
  return cues;
}

// Parse ASS/SSA format to SrtCue
export function parseAss(text: string): SrtCue[] {
  const clean = text.replace(/^\uFEFF/, '').replace(/\r\n/g, '\n').replace(/\r/g, '\n').trim();
  if (!clean) return [];

  const lines = clean.split('\n');
  const cues: SrtCue[] = [];

  const parseAssTs = (ts: string) => {
    const m = ts.trim().match(/^(\d+):(\d+):(\d+)[,.](\d+)$/);
    if (!m) return 0;
    const [, h, mn, s, frac] = m;
    // Usually centiseconds (2 digits); fracSec handles any precision.
    return Number(h) * 3600 + Number(mn) * 60 + Number(s) + fracSec(frac);
  };

  for (const line of lines) {
    const cleanLine = line.trim();
    if (cleanLine.startsWith('Dialogue:')) {
      // Content format in ASS is: Dialogue: Layer, Start, End, Style, Name, MarginL, MarginR, MarginV, Effect, Text
      // Split the line into parts. Dialogue format has 9 commas before text
      const content = cleanLine.substring(9).trim();
      const parts = content.split(',');
      if (parts.length >= 9) {
        const startStr = parts[1];
        const endStr = parts[2];
        const textStr = parts.slice(9).join(',');
        
        // Remove style bracket tags {\an8}, {\i1}, etc. and replace \N with newline
        const text = textStr.replace(/\{[^}]+\}/g, '').replace(/\\N/g, '\n').trim();
        if (!text) continue;

        cues.push({
          idx: cues.length + 1,
          start: parseAssTs(startStr),
          end: parseAssTs(endStr),
          text,
        });
      }
    }
  }
  return cues;
}

// Read with encoding detection and format checking

function decodeBuffer(buf: Buffer, encoding: string): string {
  try {
    if (iconv.encodingExists(encoding)) {
      return iconv.decode(buf, encoding);
    }
  } catch {
    // fall through
  }
  return buf.toString('utf-8');
}

function isValidUtf8(buf: Buffer): boolean {
  try {
    new TextDecoder('utf-8', { fatal: true }).decode(buf);
    return true;
  } catch {
    return false;
  }
}

const HEB_FINALS = /[\u05DA\u05DD\u05DF\u05E3\u05E5]/; // ך ם ן ף ץ
const HEB_NON_FINAL_AT_END = /[\u05DB\u05DE\u05E0\u05E4\u05E6]$/; // כ מ נ פ צ

/**
 * Does `text` (a windows-1255 decode) read like real Hebrew? Other single-byte
 * encodings (Cyrillic, Arabic, Latin accents) also land on Hebrew code points
 * when decoded as 1255, but they break Hebrew spelling rules: final letter forms
 * appear mid-word and non-final forms end words. Real Hebrew almost never does.
 */
export function isPlausibleHebrew(text: string): boolean {
  const words = text.match(/[\u05D0-\u05EA]+/g);
  if (!words) return false;
  const hebLetters = words.reduce((n, w) => n + w.length, 0);
  const latinLetters = (text.match(/[A-Za-z]/g) || []).length;
  if (hebLetters < 3 || hebLetters <= latinLetters) return false;
  let broken = 0;
  for (const w of words) {
    if (HEB_FINALS.test(w.slice(0, -1))) broken++;
    else if (w.length > 1 && HEB_NON_FINAL_AT_END.test(w)) broken++;
  }
  return broken / words.length < 0.15;
}

/**
 * Pick the text encoding for a subtitle file. Order: BOM → the user's explicit
 * choice → valid UTF-8 → Hebrew (windows-1255) when chardet says so or the
 * decode reads like real Hebrew → chardet's best guess.
 */
export function pickBestText(buf: Buffer, preferred?: string): { text: string; encoding: string } {
  if (buf[0] === 0xef && buf[1] === 0xbb && buf[2] === 0xbf) {
    return { text: decodeBuffer(buf, 'UTF-8'), encoding: 'UTF-8' };
  }
  if (buf[0] === 0xff && buf[1] === 0xfe) {
    return { text: decodeBuffer(buf, 'UTF-16LE'), encoding: 'UTF-16LE' };
  }
  if (buf[0] === 0xfe && buf[1] === 0xff) {
    return { text: decodeBuffer(buf, 'UTF-16BE'), encoding: 'UTF-16BE' };
  }
  if (preferred && iconv.encodingExists(preferred)) {
    return { text: decodeBuffer(buf, preferred), encoding: preferred };
  }
  if (isValidUtf8(buf)) {
    return { text: decodeBuffer(buf, 'UTF-8'), encoding: 'UTF-8' };
  }

  const top = chardet.analyse(buf)[0];
  const hebrew = decodeBuffer(buf, 'windows-1255');
  if (top?.lang === 'he' || isPlausibleHebrew(hebrew)) {
    return { text: hebrew, encoding: 'windows-1255' };
  }
  const guess = top && iconv.encodingExists(top.name) ? top.name : 'windows-1252';
  return { text: decodeBuffer(buf, guess), encoding: guess };
}

export async function readSrtFile(
  filePath: string,
  preferredEncoding?: string
): Promise<{
  cues: SrtCue[];
  encoding: string;
  size: number;
}> {
  const buf = await fs.readFile(filePath);
  const { text, encoding: detected } = pickBestText(buf, preferredEncoding);

  const ext = path.extname(filePath).toLowerCase();
  let cues: SrtCue[];
  if (ext === '.vtt') {
    cues = parseVtt(text);
  } else if (ext === '.ass' || ext === '.ssa') {
    cues = parseAss(text);
  } else {
    cues = parseSrt(text);
  }

  return {
    cues,
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

  const { cues } = await readSrtFile(sourcePath, opts.encoding);
  if (cues.length === 0) {
    throw new Error(`No subtitle cues found in ${path.basename(sourcePath)}`);
  }
  const transformed =
    opts.offset === 0 && opts.speed === 1 ? cues : transformCues(cues, opts);
  const text = serializeSrt(transformed);

  const outPath = path.join(
    dir,
    `${Date.now()}-${safeTempBase(path.basename(sourcePath, path.extname(sourcePath)))}.srt`
  );
  await fs.writeFile(outPath, '\uFEFF' + text, 'utf-8');
  return outPath;
}

export async function exportTransformedSrt(
  sourcePath: string,
  destPath: string,
  opts: { offset: number; speed: number; encoding?: string }
): Promise<void> {
  const { cues } = await readSrtFile(sourcePath, opts.encoding);
  const transformed =
    opts.offset === 0 && opts.speed === 1 ? cues : transformCues(cues, opts);
  const text = serializeSrt(transformed);
  await fs.writeFile(destPath, '\uFEFF' + text, 'utf-8');
}

/**
 * Delete specific temp files (the ones one export produced). Unlike
 * clearTempSrt, this leaves other pending files alone, e.g. edited cues
 * written for jobs still waiting in the batch queue.
 */
export async function removeTempFiles(paths: string[]): Promise<void> {
  await Promise.all(paths.map((p) => fs.unlink(p).catch(() => null)));
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
