// Episode/season parsing + video↔subtitle matching for Series mode.
// Dependency-free (no node imports) so it runs in both main and renderer and is
// trivially unit-testable.

export interface EpisodeToken {
  season: number | null;
  episode: number | null;
}

export interface MatchedPair {
  video: string;
  /** Matched subtitle path, or null if none could be paired. */
  sub: string | null;
  season: number | null;
  episode: number | null;
}

/** Strip a directory prefix without depending on node's `path`. */
export function baseName(p: string): string {
  return p.split(/[/\\]/).pop() ?? p;
}

function toInt(s: string | undefined): number | null {
  if (s == null) return null;
  const n = parseInt(s, 10);
  return Number.isFinite(n) ? n : null;
}

// Ordered most-specific → least-specific. First match wins.
const SEASON_EP_PATTERNS: RegExp[] = [
  /[Ss](\d{1,2})[\s._-]*[Ee](\d{1,3})/, // S01E02, s1e2, S01.E02
  /[Ss]eason[\s._-]*(\d{1,2})[\s._-]*[Ee]pisode[\s._-]*(\d{1,3})/i, // Season 1 Episode 2
  /(?:^|[\s._-])(\d{1,2})[xX](\d{1,3})(?:[\s._-]|$)/, // 1x02
];

const EP_ONLY_PATTERNS: RegExp[] = [
  /[Ee]pisode[\s._-]*(\d{1,3})/, // Episode 2
  /(?:^|[\s._-])[Ee][Pp]?[\s._-]*(\d{1,3})(?:[\s._-]|$)/, // E02, Ep 2
];

/** Extract season/episode numbers from a file name (extension ignored). */
export function parseEpisodeToken(name: string): EpisodeToken {
  const base = baseName(name).replace(/\.[^.]+$/, '');
  for (const re of SEASON_EP_PATTERNS) {
    const m = re.exec(base);
    if (m) return { season: toInt(m[1]), episode: toInt(m[2]) };
  }
  for (const re of EP_ONLY_PATTERNS) {
    const m = re.exec(base);
    if (m) return { season: null, episode: toInt(m[1]) };
  }
  return { season: null, episode: null };
}

/**
 * Pair each video with its best-matching subtitle:
 *  1. by (season, episode) — episode must match; season matches when both known
 *  2. fallback: when no token-based matches were made and the lists are the same
 *     length, pair by index after sorting both by parsed episode then name.
 */
export function matchSubsToVideos(videos: string[], subs: string[]): MatchedPair[] {
  const subTokens = subs.map((s) => ({ path: s, ...parseEpisodeToken(s) }));
  const used = new Set<number>();

  const pairs: MatchedPair[] = videos.map((v) => {
    const vt = parseEpisodeToken(v);
    let subIdx = -1;
    if (vt.episode != null) {
      subIdx = subTokens.findIndex(
        (s, i) =>
          !used.has(i) &&
          s.episode === vt.episode &&
          (vt.season == null || s.season == null || s.season === vt.season)
      );
    }
    if (subIdx >= 0) used.add(subIdx);
    return {
      video: v,
      sub: subIdx >= 0 ? subTokens[subIdx].path : null,
      season: vt.season,
      episode: vt.episode,
    };
  });

  const matchedAny = pairs.some((p) => p.sub != null);
  if (!matchedAny && videos.length > 0 && videos.length === subs.length) {
    const order = (a: { episode: number | null; path: string }, b: typeof a) => {
      if (a.episode != null && b.episode != null) return a.episode - b.episode;
      return baseName(a.path).localeCompare(baseName(b.path));
    };
    const vSorted = videos
      .map((path) => ({ path, episode: parseEpisodeToken(path).episode }))
      .sort(order);
    const sSorted = [...subTokens].sort(order);
    const byVideo = new Map<string, string>();
    vSorted.forEach((vv, i) => byVideo.set(vv.path, sSorted[i].path));
    return pairs.map((p) => ({ ...p, sub: byVideo.get(p.video) ?? null }));
  }

  return pairs;
}
