import { describe, it, expect } from 'vitest';
import { buildExportPlan, type BuildPlanInput } from './export-plan';
import type { ExternalSub, MediaFile, Track } from './types';

function track(p: Partial<Track> & Pick<Track, 'id' | 'kind'>): Track {
  return {
    codec: 'h264',
    name: '',
    info: '',
    lang: 'und',
    def: false,
    forced: false,
    keep: true,
    ...p,
  };
}

function extSub(p: Partial<ExternalSub> & Pick<ExternalSub, 'id'>): ExternalSub {
  return {
    path: `/subs/${p.id}.srt`,
    name: `${p.id}.srt`,
    size: '1 KB',
    sizeBytes: 1024,
    cues: 10,
    lang: 'heb',
    trackName: '',
    offset: 0,
    speed: 1,
    def: false,
    forced: false,
    encoding: 'UTF-8',
    ...p,
  };
}

const file: MediaFile = {
  path: '/movies/movie.mkv',
  name: 'movie.mkv',
  title: 'movie',
  year: '2020',
  container: 'MKV',
  size: '1 GB',
  sizeBytes: 1_000_000_000,
  video: 'h264',
  res: '1920x1080',
  fps: '24',
  duration: '01:30:00',
  durationSec: 5400,
  tracks: [],
};

function input(overrides: Partial<BuildPlanInput> = {}): BuildPlanInput {
  return {
    file,
    tracks: [],
    extSubs: [],
    outPath: '/out/movie (2020).mkv',
    outName: 'movie (2020).mkv',
    container: 'MKV',
    burnInSubs: false,
    activeSubId: null,
    ...overrides,
  };
}

describe('buildExportPlan', () => {
  it('returns null when no file is loaded', () => {
    expect(buildExportPlan(input({ file: null }))).toBeNull();
  });

  it('picks the kept video track over an unkept one', () => {
    const plan = buildExportPlan(
      input({
        tracks: [
          track({ id: 0, kind: 'V', keep: false }),
          track({ id: 1, kind: 'V', keep: true }),
        ],
      })
    );
    expect(plan?.videoTrackId).toBe(1);
  });

  it('falls back to the first video track when none are kept', () => {
    const plan = buildExportPlan(
      input({ tracks: [track({ id: 3, kind: 'V', keep: false })] })
    );
    expect(plan?.videoTrackId).toBe(3);
  });

  it('includes only kept audio and embedded sub tracks', () => {
    const plan = buildExportPlan(
      input({
        tracks: [
          track({ id: 0, kind: 'V' }),
          track({ id: 1, kind: 'A', keep: true, lang: 'eng' }),
          track({ id: 2, kind: 'A', keep: false }),
          track({ id: 3, kind: 'S', keep: true, lang: 'heb' }),
          track({ id: 4, kind: 'S', keep: false }),
        ],
      })
    );
    expect(plan?.audioTracks.map((a) => a.id)).toEqual([1]);
    expect(plan?.embeddedSubs.map((s) => s.id)).toEqual([3]);
  });

  it('passes external subs through with sync metadata', () => {
    const plan = buildExportPlan(
      input({ extSubs: [extSub({ id: 'a', offset: 1.5, speed: 1.001, lang: 'heb' })] })
    );
    expect(plan?.externalSubs).toEqual([
      {
        path: '/subs/a.srt',
        lang: 'heb',
        def: false,
        forced: false,
        offset: 1.5,
        speed: 1.001,
        trackName: '',
        encoding: 'UTF-8',
      },
    ]);
  });

  it('derives the metadata title from the output name', () => {
    const plan = buildExportPlan(input({ outName: 'Show - S01E02.mkv' }));
    expect(plan?.metadataTitle).toBe('Show - S01E02');
  });

  it('uses mp4 only when explicitly chosen, otherwise mkv', () => {
    expect(buildExportPlan(input({ container: 'mp4' }))?.container).toBe('mp4');
    expect(buildExportPlan(input({ container: 'MP4' }))?.container).toBe('mp4');
    expect(buildExportPlan(input({ container: 'MKV' }))?.container).toBe('mkv');
    expect(buildExportPlan(input({ container: 'anything' }))?.container).toBe('mkv');
  });

  it('sets the burn-in index to the active external sub when enabled', () => {
    const plan = buildExportPlan(
      input({
        extSubs: [extSub({ id: 'a' }), extSub({ id: 'b' })],
        burnInSubs: true,
        activeSubId: 'b',
      })
    );
    expect(plan?.burnInSubIndex).toBe(1);
  });

  it('leaves burn-in null when disabled or no active sub', () => {
    expect(
      buildExportPlan(
        input({ extSubs: [extSub({ id: 'a' })], burnInSubs: false, activeSubId: 'a' })
      )?.burnInSubIndex
    ).toBeNull();
    expect(
      buildExportPlan(input({ extSubs: [extSub({ id: 'a' })], burnInSubs: true, activeSubId: null }))
        ?.burnInSubIndex
    ).toBeNull();
  });
});
