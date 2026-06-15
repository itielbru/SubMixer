import { describe, it, expect } from 'vitest';
import { buildOutName, buildOutPath } from './exportPlan';

describe('buildOutName', () => {
  const base = {
    overrideName: false,
    customName: '',
    contentType: 'movie' as const,
    title: 'The Matrix',
    year: '1999',
    season: '01',
    episode: '01',
    container: 'MKV',
  };

  it('builds movie name', () => {
    expect(buildOutName(base)).toBe('The Matrix (1999).mkv');
  });

  it('builds series name', () => {
    const p = { ...base, contentType: 'series' as const };
    expect(buildOutName(p)).toBe('The Matrix - S01E01.mkv');
  });

  it('uses customName when overrideName and customName set', () => {
    const p = { ...base, overrideName: true, customName: 'My Custom' };
    expect(buildOutName(p)).toBe('My Custom.mkv');
  });

  it('falls back to title when overrideName but customName empty', () => {
    const p = { ...base, overrideName: true, customName: '   ' };
    expect(buildOutName(p)).toBe('The Matrix.mkv');
  });

  it('lowercases the container extension', () => {
    const p = { ...base, container: 'MP4' };
    expect(buildOutName(p)).toBe('The Matrix (1999).mp4');
  });
});

describe('buildOutPath', () => {
  it('builds flat path (no content folder)', () => {
    const p = buildOutPath(
      false,
      '/dest',
      'movie',
      'Film',
      '2000',
      '01',
      '01',
      'Film (2000).mkv',
      false,
    );
    expect(p).toBe('/dest/Film (2000).mkv');
  });

  it('builds movie content-folder path on posix', () => {
    const p = buildOutPath(
      false,
      '/dest',
      'movie',
      'Film',
      '2000',
      '01',
      '01',
      'Film (2000).mkv',
      true,
    );
    expect(p).toBe('/dest/Film (2000)/Film (2000).mkv');
  });

  it('builds series content-folder path on posix', () => {
    const p = buildOutPath(
      false,
      '/dest',
      'series',
      'Show',
      '2020',
      '02',
      '03',
      'Show - S02E03.mkv',
      true,
    );
    expect(p).toBe('/dest/Show S02E03/Show - S02E03.mkv');
  });

  it('uses backslash separator on Windows', () => {
    const p = buildOutPath(
      true,
      'C:\\Videos',
      'movie',
      'Film',
      '2000',
      '01',
      '01',
      'Film (2000).mkv',
      false,
    );
    expect(p).toBe('C:\\Videos\\Film (2000).mkv');
  });

  it('builds Windows content-folder path', () => {
    const p = buildOutPath(
      true,
      'C:\\Videos',
      'movie',
      'Film',
      '2000',
      '01',
      '01',
      'Film (2000).mkv',
      true,
    );
    expect(p).toBe('C:\\Videos\\Film (2000)\\Film (2000).mkv');
  });
});
