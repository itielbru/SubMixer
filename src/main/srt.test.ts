import { describe, it, expect } from 'vitest';
import { promises as fs } from 'fs';
import * as os from 'os';
import * as path from 'path';
import * as iconv from 'iconv-lite';
import {
  parseSrt,
  parseVtt,
  parseAss,
  serializeSrt,
  readSrtFile,
  fmtTs,
  pickBestText,
  isPlausibleHebrew,
  removeTempFiles,
} from './srt';

describe('parseSrt', () => {
  it('parses numbered blocks with comma timestamps', () => {
    const cues = parseSrt('1\n00:00:01,000 --> 00:00:02,500\nHello\n\n2\n00:00:03,000 --> 00:00:04,000\nWorld');
    expect(cues).toHaveLength(2);
    expect(cues[0]).toMatchObject({ idx: 1, start: 1, end: 2.5, text: 'Hello' });
    expect(cues[1].text).toBe('World');
  });

  it('strips a leading BOM and handles CRLF newlines', () => {
    const cues = parseSrt('﻿1\r\n00:00:00,000 --> 00:00:01,000\r\nHi\r\n');
    expect(cues).toHaveLength(1);
    expect(cues[0].text).toBe('Hi');
  });

  it('accepts dot as the millisecond separator', () => {
    const cues = parseSrt('1\n00:00:01.250 --> 00:00:02.000\nText');
    expect(cues[0].start).toBeCloseTo(1.25);
  });

  it('keeps multi-line cue text', () => {
    const cues = parseSrt('1\n00:00:01,000 --> 00:00:02,000\nline one\nline two');
    expect(cues[0].text).toBe('line one\nline two');
  });

  it('returns an empty array for empty input', () => {
    expect(parseSrt('')).toEqual([]);
  });
});

describe('parseVtt', () => {
  it('skips the WEBVTT header and strips formatting tags', () => {
    const cues = parseVtt('WEBVTT\n\n00:01.000 --> 00:02.000\n<c.yellow>Hi</c>');
    expect(cues).toHaveLength(1);
    expect(cues[0].text).toBe('Hi');
    expect(cues[0].start).toBeCloseTo(1);
  });

  it('parses HH:MM:SS timestamps', () => {
    const cues = parseVtt('WEBVTT\n\n01:00:00.000 --> 01:00:02.000\nLate');
    expect(cues[0].start).toBeCloseTo(3600);
  });
});

describe('parseAss', () => {
  it('parses Dialogue lines with centisecond timestamps and strips style tags', () => {
    const ass = [
      '[Events]',
      'Format: Layer, Start, End, Style, Name, MarginL, MarginR, MarginV, Effect, Text',
      'Dialogue: 0,0:00:01.00,0:00:03.50,Default,,0,0,0,,{\\an8}Hello\\Nthere',
    ].join('\n');
    const cues = parseAss(ass);
    expect(cues).toHaveLength(1);
    expect(cues[0].start).toBeCloseTo(1);
    expect(cues[0].end).toBeCloseTo(3.5);
    expect(cues[0].text).toBe('Hello\nthere');
  });
});

describe('serializeSrt', () => {
  it('round-trips through parseSrt', () => {
    const input = [
      { idx: 1, start: 1, end: 2.5, text: 'Hello' },
      { idx: 2, start: 3, end: 4, text: 'World' },
    ];
    const reparsed = parseSrt(serializeSrt(input));
    expect(reparsed).toHaveLength(2);
    expect(reparsed[0]).toMatchObject({ start: 1, end: 2.5, text: 'Hello' });
    expect(reparsed[1].text).toBe('World');
  });

  it('renumbers cues sequentially', () => {
    const out = serializeSrt([{ idx: 99, start: 0, end: 1, text: 'x' }]);
    expect(out.startsWith('1\n')).toBe(true);
  });
});

describe('readSrtFile encoding detection', () => {
  it('decodes a Hebrew windows-1255 subtitle correctly', async () => {
    const hebrew = 'שלום עולם';
    const content = `1\n00:00:01,000 --> 00:00:02,000\n${hebrew}`;
    const buf = iconv.encode(content, 'windows-1255');
    const file = path.join(os.tmpdir(), `submixer-test-${Date.now()}.srt`);
    await fs.writeFile(file, buf);
    try {
      const res = await readSrtFile(file);
      expect(res.cues).toHaveLength(1);
      expect(res.cues[0].text).toContain('שלום');
    } finally {
      await fs.unlink(file).catch(() => null);
    }
  });

  it('reads a UTF-8 subtitle and reports its size', async () => {
    const file = path.join(os.tmpdir(), `submixer-test-utf8-${Date.now()}.srt`);
    const content = '1\n00:00:01,000 --> 00:00:02,000\nHello';
    await fs.writeFile(file, content, 'utf-8');
    try {
      const res = await readSrtFile(file);
      expect(res.cues[0].text).toBe('Hello');
      expect(res.size).toBeGreaterThan(0);
    } finally {
      await fs.unlink(file).catch(() => null);
    }
  });
});

describe('timestamp precision', () => {
  it('carries rounding into the next second instead of printing ,1000', () => {
    expect(fmtTs(1.9996)).toBe('00:00:02,000');
    expect(fmtTs(59.9999)).toBe('00:01:00,000');
    expect(fmtTs(3599.9996)).toBe('01:00:00,000');
  });

  it('formats normal values and clamps negatives', () => {
    expect(fmtTs(3723.456)).toBe('01:02:03,456');
    expect(fmtTs(-5)).toBe('00:00:00,000');
  });

  it('reads short fractional parts as fractions of a second', () => {
    const cues = parseSrt('1\n00:00:01,5 --> 00:00:02,50\nx');
    expect(cues[0].start).toBeCloseTo(1.5);
    expect(cues[0].end).toBeCloseTo(2.5);
    const vtt = parseVtt('WEBVTT\n\n00:01.5 --> 00:02.25\nx');
    expect(vtt[0].start).toBeCloseTo(1.5);
    expect(vtt[0].end).toBeCloseTo(2.25);
  });
});

describe('pickBestText', () => {
  const srt = (line: string) => `1\n00:00:01,000 --> 00:00:02,000\n${line}\n`;
  const cases: { name: string; text: string; encoding: string }[] = [
    { name: 'Hebrew windows-1255', text: 'שלום, מה שלומך היום? אני בסדר גמור, תודה רבה.', encoding: 'windows-1255' },
    { name: 'short Hebrew windows-1255', text: 'שלום', encoding: 'windows-1255' },
    { name: 'Hebrew UTF-8', text: 'שלום, מה שלומך היום?', encoding: 'utf-8' },
    { name: 'French UTF-8', text: "C'est déjà l'été, très réussi.", encoding: 'utf-8' },
    { name: 'French latin1', text: "C'est déjà l'été, très réussi. Ça va très bien, merci beaucoup.", encoding: 'latin1' },
    { name: 'Russian UTF-8', text: 'Привет, как дела? Всё хорошо.', encoding: 'utf-8' },
    { name: 'Russian windows-1251', text: 'Привет, как дела? Всё хорошо, спасибо большое.', encoding: 'windows-1251' },
    { name: 'Arabic windows-1256', text: 'مرحبا، كيف حالك اليوم؟ أنا بخير شكرا جزيلا.', encoding: 'windows-1256' },
  ];

  for (const c of cases) {
    it(`decodes ${c.name}`, () => {
      const res = pickBestText(iconv.encode(srt(c.text), c.encoding));
      expect(res.text).toContain(c.text);
    });
  }

  it('decodes UTF-8 and UTF-16 files with a BOM', () => {
    const text = srt('שלום עולם');
    const utf8 = pickBestText(Buffer.concat([Buffer.from([0xef, 0xbb, 0xbf]), Buffer.from(text, 'utf-8')]));
    expect(utf8.encoding).toBe('UTF-8');
    expect(utf8.text).toContain('שלום עולם');
    const utf16 = pickBestText(Buffer.concat([Buffer.from([0xff, 0xfe]), iconv.encode(text, 'utf-16le')]));
    expect(utf16.text).toContain('שלום עולם');
  });

  it("always honours the user's chosen encoding", () => {
    const buf = iconv.encode(srt('Привет, как дела?'), 'windows-1251');
    expect(pickBestText(buf, 'windows-1251').text).toContain('Привет');
    expect(pickBestText(buf, 'windows-1255').encoding).toBe('windows-1255');
  });
});

describe('isPlausibleHebrew', () => {
  it('accepts real Hebrew and rejects other scripts decoded as windows-1255', () => {
    expect(isPlausibleHebrew('שלום, מה שלומך היום?')).toBe(true);
    const russianAs1255 = iconv.decode(iconv.encode('Привет, как дела? Всё хорошо.', 'windows-1251'), 'windows-1255');
    expect(isPlausibleHebrew(russianAs1255)).toBe(false);
    const frenchAs1255 = iconv.decode(iconv.encode("C'est déjà l'été.", 'latin1'), 'windows-1255');
    expect(isPlausibleHebrew(frenchAs1255)).toBe(false);
  });
});

describe('removeTempFiles', () => {
  it('deletes only the listed files', async () => {
    const dir = await fs.mkdtemp(path.join(os.tmpdir(), 'submixer-rm-'));
    const mine = path.join(dir, 'export.srt');
    const pending = path.join(dir, 'batch-edit.srt');
    await fs.writeFile(mine, 'a');
    await fs.writeFile(pending, 'b');
    try {
      await removeTempFiles([mine, path.join(dir, 'missing.srt')]);
      await expect(fs.access(mine)).rejects.toThrow();
      await expect(fs.access(pending)).resolves.toBeUndefined();
    } finally {
      await fs.rm(dir, { recursive: true, force: true });
    }
  });
});
