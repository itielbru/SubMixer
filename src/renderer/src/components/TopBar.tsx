import React from 'react';
import type { MediaFile } from '@shared/types';
import { Ico, I } from './ui/Icons';
import { useT } from '../hooks/useTranslation';

interface Props {
  file: MediaFile | null;
  contentType: 'movie' | 'series';
  title: string;
  year: string;
  season: string;
  episode: string;
  appVersion: string;
  ffVersion: string;
  onOpenFile: () => void;
  onOpenSeries: () => void;
  onOpenHistory: () => void;
  onOpenSettings: () => void;
}

export function TopBar({
  file,
  contentType,
  title,
  year,
  season,
  episode,
  appVersion,
  ffVersion,
  onOpenFile,
  onOpenSeries,
  onOpenHistory,
  onOpenSettings,
}: Props) {
  const { t } = useT();

  return (
    <header className="topbar">
      <div className="brand">
        <div className="mark">S</div>
        <div className="brand-txt">
          <div className="name">{t('app_title')}</div>
          <div className="ver">{appVersion} · {ffVersion || 'FFmpeg —'}</div>
        </div>
      </div>
      <button className="btn ghost" onClick={onOpenFile}>
        <Ico d={I.folder} /> {t('open_file')}
      </button>
      <button className="btn ghost" onClick={onOpenSeries} title={t('series_desc')}>
        <Ico d={I.zap} /> {t('series_open')}
      </button>
      <div className="crumbs">
        <span>{contentType === 'movie' ? t('movie') : t('series')}</span>
        <Ico d={I.arrowL} size={11} />
        <b>{title || t('no_title')}</b>
        {contentType === 'movie' && year && <em>{year}</em>}
        {contentType === 'series' && (
          <em>
            S{season}E{episode}
          </em>
        )}
      </div>
      <div style={{ flex: 1 }}></div>
      {file && (
        <div className="topbar-stats">
          <div className="stat">
            <span className="k">DUR</span>
            <span className="v mono">{file.duration}</span>
          </div>
          <div className="stat">
            <span className="k">RES</span>
            <span className="v mono">{file.res}</span>
          </div>
          <div className="stat">
            <span className="k">FPS</span>
            <span className="v mono">{file.fps}</span>
          </div>
        </div>
      )}
      <button className="icon-btn" title={t('export_history')} onClick={onOpenHistory}>
        <Ico d={I.history} size={15} />
      </button>
      <button className="icon-btn" title={t('settings')} onClick={onOpenSettings}>
        <Ico d={I.cog} size={15} />
      </button>
    </header>
  );
}
