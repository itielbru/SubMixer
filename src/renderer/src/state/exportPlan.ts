/**
 * Pure export plan helpers.
 *
 * No React, no DOM — these can be tested headlessly in Vitest.
 */

import { joinPath } from '../lib/path';

export interface OutNameParams {
  overrideName: boolean;
  customName: string;
  contentType: 'movie' | 'series';
  title: string;
  year: string;
  season: string;
  episode: string;
  container: string;
}

export function buildOutName({
  overrideName,
  customName,
  contentType,
  title,
  year,
  season,
  episode,
  container,
}: OutNameParams): string {
  const c = container.toLowerCase();
  if (overrideName) {
    const stem = customName.trim() || title.trim();
    if (stem) return `${stem}.${c}`;
  }
  if (contentType === 'movie') return `${title} (${year}).${c}`;
  return `${title} - S${season}E${episode}.${c}`;
}

export function buildOutPath(
  isWin: boolean,
  destFolder: string,
  contentType: 'movie' | 'series',
  title: string,
  year: string,
  season: string,
  episode: string,
  outName: string,
  useContentFolder: boolean,
): string {
  if (!useContentFolder) {
    return joinPath(isWin, destFolder, outName);
  }
  const base = contentType === 'movie' ? `${title} (${year})` : `${title} S${season}E${episode}`;
  return joinPath(isWin, destFolder, base, outName);
}
