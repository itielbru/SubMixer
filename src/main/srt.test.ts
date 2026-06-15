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
  serializeVtt,
  serializeAss,
  readSrtFile,
} from './srt';

describe('parseSrt', () => {
  it('parses numbered blocks with comma timestamps', () => {
    const cues = parseSrt(
      '1\n00:00:01,000 --> 00:00:02,500\nHello\n\n2\n00:00:03,000 --> 00:00:04,000\nWorld',
    );
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

describe('serializeVtt', () => {
  it('emits WEBVTT header and dot-separated timestamps', () => {
    const vtt = serializeVtt([{ idx: 1, start: 1.5, end: 3, text: 'Hi' }]);
    expect(vtt.startsWith('WEBVTT\n')).toBe(true);
    expect(vtt).toContain('00:00:01.500 --> 00:00:03.000');
    expect(vtt).toContain('Hi');
  });

  it('round-trips through parseVtt', () => {
    const input = [
      { idx: 1, start: 1, end: 2, text: 'Hello' },
      { idx: 2, start: 3, end: 4, text: 'line one\nline two' },
    ];
    const reparsed = parseVtt(serializeVtt(input));
    expect(reparsed[0]).toMatchObject({ start: 1, end: 2, text: 'Hello' });
    expect(reparsed[1].text).toBe('line one\nline two');
  });
});

describe('serializeAss', () => {
  it('emits ASS header sections and Dialogue lines', () => {
    const ass = serializeAss([{ idx: 1, start: 61.5, end: 63, text: 'Test' }]);
    expect(ass).toContain('[Script Info]');
    expect(ass).toContain('[Events]');
    expect(ass).toContain('Dialogue: 0,0:01:01.50,0:01:03.00,Default,,0,0,0,,Test');
  });

  it('converts newlines to \\N in dialogue text', () => {
    const ass = serializeAss([{ idx: 1, start: 0, end: 1, text: 'line one\nline two' }]);
    expect(ass).toContain('line one\\Nline two');
  });

  it('round-trips through parseAss', () => {
    const input = [{ idx: 1, start: 1.5, end: 3.25, text: 'Hello' }];
    const reparsed = parseAss(serializeAss(input));
    expect(reparsed[0].start).toBeCloseTo(1.5);
    expect(reparsed[0].end).toBeCloseTo(3.25);
    expect(reparsed[0].text).toBe('Hello');
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
