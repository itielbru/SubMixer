import { useMemo } from 'react';
import { useExportStore } from '../state/exportStore';
import { useAppEnvStore } from '../state/appEnvStore';
import { joinPath } from '../lib/path';

export function useOutPath(exportUseContentFolder: boolean) {
  const isWin = useAppEnvStore((s) => s.isWin);
  const contentType = useExportStore((s) => s.contentType);
  const title = useExportStore((s) => s.title);
  const year = useExportStore((s) => s.year);
  const season = useExportStore((s) => s.season);
  const episode = useExportStore((s) => s.episode);
  const container = useExportStore((s) => s.container);
  const destFolder = useExportStore((s) => s.destFolder);
  const overrideName = useExportStore((s) => s.overrideName);
  const customName = useExportStore((s) => s.customName);

  const outName = useMemo(() => {
    const c = container.toLowerCase();
    if (overrideName) {
      const stem = customName.trim() || title.trim();
      if (stem) return `${stem}.${c}`;
    }
    if (contentType === 'movie') return `${title} (${year}).${c}`;
    return `${title} - S${season}E${episode}.${c}`;
  }, [overrideName, customName, container, contentType, title, year, season, episode]);

  const outPath = useMemo(() => {
    if (!exportUseContentFolder) {
      return joinPath(isWin, destFolder, outName);
    }
    const base = contentType === 'movie' ? `${title} (${year})` : `${title} S${season}E${episode}`;
    return joinPath(isWin, destFolder, base, outName);
  }, [
    isWin,
    destFolder,
    contentType,
    title,
    year,
    season,
    episode,
    outName,
    exportUseContentFolder,
  ]);

  return { outName, outPath };
}
