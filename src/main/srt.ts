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
  const clean = text
    .replace(/^\uFEFF/, '')
    .replace(/\r\n/g, '\n')
    .replace(/\r/g, '\n')
    .trim();
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

function fmtVttTs(sec: number): string {
  if (sec < 0) sec = 0;
  const h = Math.floor(sec / 3600);
  const m = Math.floor((sec % 3600) / 60);
  const s = Math.floor(sec % 60);
  const ms = Math.round((sec - Math.floor(sec)) * 1000);
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}.${String(ms).padStart(3, '0')}`;
}

export function serializeVtt(cues: SrtCue[]): string {
  const out: string[] = ['WEBVTT', ''];
  cues.forEach((c, i) => {
    out.push(String(i + 1));
    out.push(`${fmtVttTs(c.start)} --> ${fmtVttTs(c.end)}`);
    out.push(c.text);
    out.push('');
  });
  return out.join('\n');
}

function fmtAssTs(sec: number): string {
  if (sec < 0) sec = 0;
  const h = Math.floor(sec / 3600);
  const m = Math.floor((sec % 3600) / 60);
  const s = Math.floor(sec % 60);
  const cs = Math.round((sec - Math.floor(sec)) * 100);
  return `${h}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}.${String(cs).padStart(2, '0')}`;
}

export function serializeAss(cues: SrtCue[]): string {
  const header = [
    '[Script Info]',
    'ScriptType: v4.00+',
    'PlayResX: 384',
    'PlayResY: 288',
    'ScaledBorderAndShadow: yes',
    '',
    '[V4+ Styles]',
    'Format: Name, Fontname, Fontsize, PrimaryColour, SecondaryColour, OutlineColour, BackColour, Bold, Italic, Underline, StrikeOut, ScaleX, ScaleY, Spacing, Angle, BorderStyle, Outline, Shadow, Alignment, MarginL, MarginR, MarginV, Encoding',
    'Style: Default,Arial,20,&H00FFFFFF,&H000000FF,&H00000000,&H80000000,0,0,0,0,100,100,0,0,1,2,2,2,10,10,10,1',
    '',
    '[Events]',
    'Format: Layer, Start, End, Style, Name, MarginL, MarginR, MarginV, Effect, Text',
  ].join('\n');

  const dialogues = cues
    .map((c) => {
      const text = c.text.replace(/\n/g, '\\N');
      return `Dialogue: 0,${fmtAssTs(c.start)},${fmtAssTs(c.end)},Default,,0,0,0,,${text}`;
    })
    .join('\n');

  return `${header}\n${dialogues}\n`;
}

import { transformCues } from '@shared/cue-sync';

export { transformCues as applyTransform };

export async function writeCuesToFile(cues: SrtCue[], baseName: string): Promise<string> {
  const dir = tempDir();
  await fs.mkdir(dir, { recursive: true });
  const text = serializeSrt(cues);
  const safeBase = baseName.replace(/[^\w.-]+/g, '_').slice(0, 80) || 'cues';
  const outPath = path.join(dir, `${Date.now()}-edit-${safeBase}.srt`);
  await fs.writeFile(outPath, '\uFEFF' + text, 'utf-8');
  return outPath;
}

// Parse VTT format to SrtCue
export function parseVtt(text: string): SrtCue[] {
  const clean = text
    .replace(/^\uFEFF/, '')
    .replace(/\r\n/g, '\n')
    .replace(/\r/g, '\n')
    .trim();
  if (!clean) return [];

  function parseVttTs(ts: string): number {
    const cleanTs = ts.trim().split(/\s+/)[0]; // strip settings
    const parts = cleanTs.split(':');
    let h = 0,
      m = 0,
      s = 0,
      ms = 0;
    if (parts.length === 2) {
      const sParts = parts[1].split(/[.,]/);
      m = Number(parts[0]);
      s = Number(sParts[0]);
      ms = Number(sParts[1] || 0);
    } else if (parts.length === 3) {
      const sParts = parts[2].split(/[.,]/);
      h = Number(parts[0]);
      m = Number(parts[1]);
      s = Number(sParts[0]);
      ms = Number(sParts[1] || 0);
    }
    return h * 3600 + m * 60 + s + ms / 1000;
  }

  const blocks = clean.split(/\n\s*\n/);
  const cues: SrtCue[] = [];
  for (const block of blocks) {
    const lines = block.split('\n').map((l) => l.replace(/\s+$/, ''));
    if (lines.length === 0) continue;

    // Ignore WEBVTT header block, STYLE block, REGION block, NOTE block
    const firstLine = lines[0].toUpperCase();
    if (
      firstLine.startsWith('WEBVTT') ||
      firstLine.startsWith('STYLE') ||
      firstLine.startsWith('REGION') ||
      firstLine.startsWith('NOTE')
    ) {
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

    const rawText = lines
      .slice(tsLineIdx + 1)
      .join('\n')
      .trim();
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
  const clean = text
    .replace(/^\uFEFF/, '')
    .replace(/\r\n/g, '\n')
    .replace(/\r/g, '\n')
    .trim();
  if (!clean) return [];

  const lines = clean.split('\n');
  const cues: SrtCue[] = [];

  const parseAssTs = (ts: string) => {
    const m = ts.trim().match(/^(\d+):(\d+):(\d+)[,.](\d+)$/);
    if (!m) return 0;
    const [, h, mn, s, cs] = m;
    // cs can be 2 digits (centiseconds) or 3 digits
    const msFactor = cs.length === 2 ? 100 : 1000;
    return Number(h) * 3600 + Number(mn) * 60 + Number(s) + Number(cs) / msFactor;
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
        const text = textStr
          .replace(/\{[^}]+\}/g, '')
          .replace(/\\N/g, '\n')
          .trim();
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

// Parse SUB/MicroDVD format to SrtCue
export function parseSub(text: string, defaultFps = 25): SrtCue[] {
  const clean = text
    .replace(/^\uFEFF/, '')
    .replace(/\r\n/g, '\n')
    .replace(/\r/g, '\n')
    .trim();
  if (!clean) return [];

  const lines = clean.split('\n');
  const cues: SrtCue[] = [];
  let fps = defaultFps;

  for (const line of lines) {
    const m = line.match(/^\{(\d+)\}\{(\d+)\}(.*)$/);
    if (!m) continue;
    const startFrame = Number(m[1]);
    const endFrame = Number(m[2]);
    const rawText = m[3];

    // {1}{1}fps header line
    if (startFrame === 1 && endFrame === 1) {
      const parsedFps = Number(rawText.trim());
      if (parsedFps > 0) fps = parsedFps;
      continue;
    }

    const text = rawText.replace(/\|/g, '\n').trim();
    if (!text) continue;

    cues.push({
      idx: cues.length + 1,
      start: startFrame / fps,
      end: endFrame / fps,
      text,
    });
  }
  return cues;
}

// Parse TTML/DFXP format to SrtCue
export function parseTtml(text: string): SrtCue[] {
  const clean = text
    .replace(/^\uFEFF/, '')
    .replace(/\r\n/g, '\n')
    .replace(/\r/g, '\n');
  if (!clean.trim()) return [];

  // Extract frameRate from root tt element for SMPTE timing
  const frameRateMatch = clean.match(/frameRate\s*=\s*["'](\d+)["']/);
  const frameRate = frameRateMatch ? Number(frameRateMatch[1]) : 30;

  const parseTtmlTs = (ts: string): number => {
    if (!ts) return 0;
    // HH:MM:SS.mmm or HH:MM:SS,mmm
    const ms = ts.match(/^(\d+):(\d{2}):(\d{2})[.,](\d+)$/);
    if (ms) {
      const frac = ms[4].length <= 2 ? Number(ms[4]) * 10 : Number(ms[4]);
      return Number(ms[1]) * 3600 + Number(ms[2]) * 60 + Number(ms[3]) + frac / 1000;
    }
    // HH:MM:SS:FF (SMPTE frames)
    const smpte = ts.match(/^(\d+):(\d{2}):(\d{2}):(\d{2})$/);
    if (smpte) {
      return (
        Number(smpte[1]) * 3600 +
        Number(smpte[2]) * 60 +
        Number(smpte[3]) +
        Number(smpte[4]) / frameRate
      );
    }
    return 0;
  };

  const cues: SrtCue[] = [];
  // Match <p ...> elements; use a simple regex rather than a full XML parser
  const pRe = /<p\b([^>]*)>([\s\S]*?)<\/p>/gi;
  let match: RegExpExecArray | null;
  while ((match = pRe.exec(clean)) !== null) {
    const attrs = match[1];
    const inner = match[2];

    const beginM = attrs.match(/\bbegin\s*=\s*["']([^"']+)["']/);
    const endM = attrs.match(/\bend\s*=\s*["']([^"']+)["']/);
    if (!beginM || !endM) continue;

    const start = parseTtmlTs(beginM[1]);
    const end = parseTtmlTs(endM[1]);

    // Strip XML tags; replace <br> variants with newline
    const textRaw = inner
      .replace(/<br\s*\/?>/gi, '\n')
      .replace(/<[^>]+>/g, '')
      .replace(/&amp;/g, '&')
      .replace(/&lt;/g, '<')
      .replace(/&gt;/g, '>')
      .replace(/&apos;/g, "'")
      .replace(/&quot;/g, '"')
      .trim();
    if (!textRaw) continue;

    cues.push({ idx: cues.length + 1, start, end, text: textRaw });
  }
  return cues;
}

// Read with encoding detection and format checking

const HEBREW_ENCODINGS = ['windows-1255', 'ISO-8859-8', 'ISO-8859-8-I', 'CP1255'];

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

function looksLikeHebrewBytes(buf: Buffer): boolean {
  let high = 0;
  for (const b of buf) {
    if (b >= 0xe0 && b <= 0xfb) high++;
  }
  return high > 8;
}

function pickBestText(buf: Buffer, preferred?: string): { text: string; encoding: string } {
  const candidates: string[] = [];
  if (preferred) candidates.push(preferred);
  const detected = (chardet.detect(buf) || 'UTF-8').toString();
  if (!candidates.includes(detected)) candidates.push(detected);
  for (const enc of HEBREW_ENCODINGS) {
    if (!candidates.includes(enc)) candidates.push(enc);
  }
  if (!candidates.includes('UTF-8')) candidates.push('UTF-8');

  let best = { text: decodeBuffer(buf, candidates[0]), encoding: candidates[0] };
  let bestScore = /[\u0590-\u05FF]/.test(best.text) ? 2 : 0;

  for (const enc of candidates.slice(1)) {
    const text = decodeBuffer(buf, enc);
    const score = (/[\u0590-\u05FF]/.test(text) ? 2 : 0) + (text.includes('\ufffd') ? -1 : 0);
    if (score > bestScore) {
      best = { text, encoding: enc };
      bestScore = score;
    }
  }

  if (bestScore === 0 && looksLikeHebrewBytes(buf)) {
    for (const enc of HEBREW_ENCODINGS) {
      const text = decodeBuffer(buf, enc);
      if (/[\u0590-\u05FF]/.test(text)) {
        return { text, encoding: enc };
      }
    }
  }

  return best;
}

export async function readSrtFile(
  filePath: string,
  preferredEncoding?: string,
): Promise<{
  cues: SrtCue[];
  encoding: string;
  size: number;
}> {
  const buf = await fs.readFile(filePath);
  const { text, encoding: detected } = pickBestText(buf, preferredEncoding);

  const ext = path.extname(filePath).toLowerCase();
  let cues: SrtCue[] = [];
  if (ext === '.vtt') {
    cues = parseVtt(text);
  } else if (ext === '.ass' || ext === '.ssa') {
    cues = parseAss(text);
  } else if (ext === '.sub') {
    cues = parseSub(text);
  } else if (ext === '.ttml' || ext === '.dfxp' || ext === '.xml') {
    cues = parseTtml(text);
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
  opts: { offset: number; speed: number; encoding?: string },
): Promise<string> {
  const dir = tempDir();
  await fs.mkdir(dir, { recursive: true });

  const { cues } = await readSrtFile(sourcePath, opts.encoding);
  if (cues.length === 0) {
    throw new Error(`No subtitle cues found in ${path.basename(sourcePath)}`);
  }
  const transformed = opts.offset === 0 && opts.speed === 1 ? cues : transformCues(cues, opts);
  const text = serializeSrt(transformed);

  const outPath = path.join(
    dir,
    `${Date.now()}-${path.basename(sourcePath, path.extname(sourcePath))}.srt`,
  );
  await fs.writeFile(outPath, '\uFEFF' + text, 'utf-8');
  return outPath;
}

export async function exportTransformedSrt(
  sourcePath: string,
  destPath: string,
  opts: { offset: number; speed: number; encoding?: string },
): Promise<void> {
  const { cues } = await readSrtFile(sourcePath, opts.encoding);
  const transformed = opts.offset === 0 && opts.speed === 1 ? cues : transformCues(cues, opts);
  const ext = path.extname(destPath).toLowerCase();
  let text: string;
  let bom = false;
  if (ext === '.vtt') {
    text = serializeVtt(transformed);
  } else if (ext === '.ass' || ext === '.ssa') {
    text = serializeAss(transformed);
  } else {
    text = serializeSrt(transformed);
    bom = true;
  }
  await fs.writeFile(destPath, bom ? '\uFEFF' + text : text, 'utf-8');
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
