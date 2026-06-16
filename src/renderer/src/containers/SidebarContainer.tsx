import React from 'react';
import type { AppSettings } from '@shared/types';
import { SourcePanel } from '../components/SourcePanel';
import { ContentDetails } from '../components/ContentDetails';
import { useT } from '../hooks/useTranslation';
import { useOutPath } from '../hooks/useOutPath';
import { useDocStore } from '../state/docStore';
import { useExportStore } from '../state/exportStore';
import { useModalStore } from '../state/modalStore';

interface Props {
  settings: AppSettings;
  setOne: <K extends keyof AppSettings>(key: K, value: AppSettings[K]) => Promise<void>;
}

export function SidebarContainer({ settings, setOne }: Props) {
  const { t } = useT();
  const file = useDocStore((s) => s.file);
  const contentType = useExportStore((s) => s.contentType);
  const setContentType = useExportStore((s) => s.setContentType);
  const title = useExportStore((s) => s.title);
  const setTitle = useExportStore((s) => s.setTitle);
  const year = useExportStore((s) => s.year);
  const setYear = useExportStore((s) => s.setYear);
  const season = useExportStore((s) => s.season);
  const setSeason = useExportStore((s) => s.setSeason);
  const episode = useExportStore((s) => s.episode);
  const setEpisode = useExportStore((s) => s.setEpisode);
  const container = useExportStore((s) => s.container);
  const setContainer = useExportStore((s) => s.setContainer);
  const destFolder = useExportStore((s) => s.destFolder);
  const setDestFolder = useExportStore((s) => s.setDestFolder);
  const overrideName = useExportStore((s) => s.overrideName);
  const setOverrideName = useExportStore((s) => s.setOverrideName);
  const customName = useExportStore((s) => s.customName);
  const setCustomName = useExportStore((s) => s.setCustomName);
  const openModal = useModalStore((s) => s.openModal);

  const { outName, outPath } = useOutPath(settings.exportUseContentFolder);

  const browseDest = async () => {
    const d = await window.api.dialog.chooseFolder(destFolder);
    if (d) setDestFolder(d);
  };

  return (
    <aside className="col-left">
      <SourcePanel file={file} onOpenFile={() => openModal('open')} />
      <ContentDetails
        contentType={contentType}
        onContentType={setContentType}
        title={title}
        onTitle={(v) => {
          setTitle(v);
          if (overrideName) setCustomName(v);
        }}
        year={year}
        onYear={setYear}
        season={season}
        onSeason={setSeason}
        episode={episode}
        onEpisode={setEpisode}
        container={container}
        onContainer={(c) => {
          setContainer(c);
          void setOne('defaultContainer', c.toLowerCase() as 'mkv' | 'mp4');
        }}
        destFolder={destFolder}
        onDestFolder={setDestFolder}
        onBrowseFolder={() => void browseDest()}
        exportUseContentFolder={settings.exportUseContentFolder}
        onExportUseContentFolder={(v) => void setOne('exportUseContentFolder', v)}
        overrideName={overrideName}
        onOverrideName={(v) => {
          setOverrideName(v);
          if (v && !customName.trim()) {
            const stem = outName.replace(/\.[^.]+$/, '');
            setCustomName(stem);
            setTitle(stem);
          }
        }}
        customName={customName}
        onCustomName={(v) => {
          setCustomName(v);
          if (overrideName) setTitle(v);
        }}
      />
      <div className="out-card">
        <div className="out-l">{t('will_save_as')}</div>
        <div className="out-n mono" title={outPath}>
          {outName}
        </div>
        <div className="out-path mono">{outPath}</div>
      </div>
    </aside>
  );
}
