import React from 'react';
import type { MediaFile } from '@shared/types';
import { Ico, I } from './ui/Icons';

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
  onOpenHistory,
  onOpenSettings,
}: Props) {
  return (
    <header className="topbar">
      <div className="brand">
        <div className="mark">S</div>
        <div className="brand-txt">
          <div className="name">SubMixer</div>
          <div className="ver">{appVersion} · {ffVersion || 'FFmpeg —'}</div>
        </div>
      </div>
      <button className="btn ghost" onClick={onOpenFile}>
        <Ico d={I.folder} /> פתח קובץ
      </button>
      <div className="crumbs">
        <span>{contentType === 'movie' ? 'סרט' : 'סדרה'}</span>
        <Ico d={I.arrowL} size={11} />
        <b>{title || 'ללא כותרת'}</b>
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
      <button className="icon-btn" title="היסטוריה" onClick={onOpenHistory}>
        <Ico d={I.history} size={15} />
      </button>
      <button className="icon-btn" title="הגדרות" onClick={onOpenSettings}>
        <Ico d={I.cog} size={15} />
      </button>
    </header>
  );
}
