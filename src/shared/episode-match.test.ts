import { describe, it, expect } from 'vitest';
import { parseEpisodeToken, matchSubsToVideos } from './episode-match';

describe('parseEpisodeToken', () => {
  it('parses SxxExx', () => {
    expect(parseEpisodeToken('Show.S01E02.1080p.mkv')).toEqual({ season: 1, episode: 2 });
    expect(parseEpisodeToken('show s1e10.mp4')).toEqual({ season: 1, episode: 10 });
  });

  it('parses 1x02', () => {
    expect(parseEpisodeToken('Show 2x05 title.mkv')).toEqual({ season: 2, episode: 5 });
  });

  it('parses Season/Episode words', () => {
    expect(parseEpisodeToken('My Show Season 3 Episode 7.mkv')).toEqual({ season: 3, episode: 7 });
  });

  it('parses episode-only tokens', () => {
    expect(parseEpisodeToken('Show - E04.srt')).toEqual({ season: null, episode: 4 });
    expect(parseEpisodeToken('Show.Episode.12.srt')).toEqual({ season: null, episode: 12 });
  });

  it('returns nulls when nothing matches', () => {
    expect(parseEpisodeToken('a movie 2021.mkv')).toEqual({ season: null, episode: null });
  });
});

describe('matchSubsToVideos', () => {
  it('matches by season+episode regardless of order', () => {
    const videos = ['Show.S01E01.mkv', 'Show.S01E02.mkv'];
    const subs = ['Show.S01E02.heb.srt', 'Show.S01E01.heb.srt'];
    const pairs = matchSubsToVideos(videos, subs);
    expect(pairs[0]).toMatchObject({ video: 'Show.S01E01.mkv', sub: 'Show.S01E01.heb.srt', episode: 1 });
    expect(pairs[1]).toMatchObject({ video: 'Show.S01E02.mkv', sub: 'Show.S01E02.heb.srt', episode: 2 });
  });

  it('matches episode-only subs to SxxExx videos', () => {
    const pairs = matchSubsToVideos(['Show.S02E03.mkv'], ['Show E03.srt']);
    expect(pairs[0].sub).toBe('Show E03.srt');
  });

  it('does not reuse a subtitle for two videos', () => {
    const pairs = matchSubsToVideos(['A.S01E01.mkv', 'B.S01E01.mkv'], ['only.S01E01.srt']);
    const matched = pairs.filter((p) => p.sub != null);
    expect(matched).toHaveLength(1);
  });

  it('falls back to sorted pairing when no tokens match but counts are equal', () => {
    const videos = ['ep_alpha.mkv', 'ep_beta.mkv'];
    const subs = ['sub_beta.srt', 'sub_alpha.srt'];
    const pairs = matchSubsToVideos(videos, subs);
    expect(pairs.every((p) => p.sub != null)).toBe(true);
  });

  it('leaves sub null when there is no match and counts differ', () => {
    const pairs = matchSubsToVideos(['Show.S01E09.mkv'], ['Show.S01E01.srt', 'Show.S01E02.srt']);
    expect(pairs[0].sub).toBeNull();
  });
});
