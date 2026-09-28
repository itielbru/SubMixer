import { describe, it, expect } from 'vitest';
import { buildExportArgs, escapeFilterPath, inferTitle } from './ffmpeg';
import type { ExportPlan } from '@shared/types';

function plan(overrides: Partial<ExportPlan> = {}): ExportPlan {
  return {
    inputFile: '/in/movie.mkv',
    externalSubs: [],
    videoTrackId: 0,
    audioTracks: [],
    embeddedSubs: [],
    outputPath: '/out/movie.mkv',
    metadataTitle: 'movie',
    container: 'mkv',
    burnInSubIndex: null,
    ...overrides,
  };
}

const ext = (lang: string, def = false) => ({
  path: `/subs/${lang}.srt`,
  lang,
  def,
  forced: false,
  offset: 0,
  speed: 1,
  trackName: lang,
  encoding: 'UTF-8',
});

/** Value that follows `flag` in the args list. */
function valueOf(args: string[], flag: string): string | undefined {
  const i = args.indexOf(flag);
  return i >= 0 ? args[i + 1] : undefined;
}

describe('buildExportArgs dispositions', () => {
  it('writes an explicit disposition for every audio and subtitle track', () => {
    const args = buildExportArgs(
      plan({
        audioTracks: [
          { id: 1, lang: 'eng', def: false, forced: false },
          { id: 2, lang: 'heb', def: true, forced: false },
        ],
        embeddedSubs: [{ id: 3, lang: 'eng', def: false, forced: true }],
        externalSubs: [ext('heb', true)],
      }),
      ['/tmp/heb.srt']
    );
    // "0" clears a default flag inherited from the source stream.
    expect(valueOf(args, '-disposition:a:0')).toBe('0');
    expect(valueOf(args, '-disposition:a:1')).toBe('default');
    expect(valueOf(args, '-disposition:s:0')).toBe('forced');
    expect(valueOf(args, '-disposition:s:1')).toBe('default');
  });
});

describe('buildExportArgs burn-in', () => {
  it('burns the chosen sub and still muxes the other external subs', () => {
    const args = buildExportArgs(
      plan({ externalSubs: [ext('heb'), ext('eng')], burnInSubIndex: 0 }),
      ['/tmp/heb.srt', '/tmp/eng.srt']
    );
    const inputs = args.filter((_, i) => args[i - 1] === '-i');
    expect(inputs).toEqual(['/in/movie.mkv', '/tmp/eng.srt']);
    expect(args).toContain('1:0');
    expect(valueOf(args, '-vf')).toContain('subtitles=filename=/tmp/heb.srt');
    expect(valueOf(args, '-metadata:s:s:0')).toBe('language=eng');
    expect(args.join(' ')).not.toContain('language=heb');
  });

  it('muxes all external subs when not burning', () => {
    const args = buildExportArgs(plan({ externalSubs: [ext('heb'), ext('eng')] }), [
      '/tmp/heb.srt',
      '/tmp/eng.srt',
    ]);
    expect(args).toContain('1:0');
    expect(args).toContain('2:0');
    expect(valueOf(args, '-c:v')).toBe('copy');
  });
});

describe('escapeFilterPath', () => {
  it('escapes Windows drive colons, apostrophes, and filtergraph separators', () => {
    expect(escapeFilterPath("C:\\Users\\O'Brien\\a.srt")).toBe("C\\\\:/Users/O\\\\\\'Brien/a.srt");
    expect(escapeFilterPath('/tmp/a,b[1];c.srt')).toBe('/tmp/a\\,b\\[1\\]\\;c.srt');
  });
});

describe('inferTitle', () => {
  it.each([
    ['The Movie (2024).mkv', 'The Movie', '2024'],
    ['The.Movie.2024.1080p.BluRay.x264.mkv', 'The Movie', '2024'],
    ['The_Movie_1999_720p.mp4', 'The Movie', '1999'],
    ['Blade Runner 2049 (2017).mkv', 'Blade Runner 2049', '2017'],
    ['Movie.1080p.mkv', 'Movie 1080p', ''],
    ['2012.mkv', '2012', ''],
    ['2001.A.Space.Odyssey.1968.mkv', '2001 A Space Odyssey', '1968'],
    ['Blade.Runner.2049.2017.1080p.mkv', 'Blade Runner 2049', '2017'],
  ])('%s → %s / %s', (name, title, year) => {
    expect(inferTitle(name)).toEqual({ title, year });
  });
});
