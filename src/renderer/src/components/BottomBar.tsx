import React from 'react';
import { Ico, I } from './ui/Icons';
import { fmtSizeMB } from '../lib/format';
import { useT } from '../hooks/useTranslation';

interface LogLine {
  time: string;
  level: 'info' | 'ok' | 'warn' | 'err';
  msg: string;
}

interface Props {
  drawerOpen: boolean;
  onToggleDrawer: () => void;
  onShowFfmpeg: () => void;
  onOpenQueue: () => void;
  batchCount: number;
  logs: LogLine[];
  estMB: number;
  audioCount: number;
  subCount: number;
  exporting: boolean;
  progress: number;
  exportEta: string;
  onExport: () => void;
  onAddToQueue: () => void;
  onCancelExport: () => void;
  canExport: boolean;
}

export function BottomBar({
  drawerOpen,
  onToggleDrawer,
  onShowFfmpeg,
  onOpenQueue,
  batchCount,
  logs,
  estMB,
  audioCount,
  subCount,
  exporting,
  progress,
  exportEta,
  onExport,
  onAddToQueue,
  onCancelExport,
  canExport,
}: Props) {
  const { t } = useT();
  const last = logs.slice(-1)[0];

  return (
    <footer className="bottom">
      <div className="b-left">
        <button className="btn ghost compact" type="button" onClick={onToggleDrawer}>
          {drawerOpen ? t('close_drawer') : t('open_drawer')}
        </button>
        <button className="btn ghost compact" type="button" onClick={onShowFfmpeg}>
          <Ico d={I.copy} size={12} /> {t('ffmpeg_cmd')}
        </button>
        <button
          className="btn ghost compact"
          type="button"
          onClick={onOpenQueue}
          title={t('batch_queue_title')}
        >
          {t('batch_queue_btn')}{batchCount > 0 ? ` (${batchCount})` : ''}
        </button>
      </div>

      <div className="log-strip">
        {last && (
          <span className={`log-line lvl-${last.level}`}>
            <span className="log-time mono">[{last.time}]</span> {last.msg}
          </span>
        )}
      </div>

      <div className="b-right">
        <div className="est mono">~{fmtSizeMB(estMB)}</div>
        {exporting ? (
          <>
            <div className="progress">
              <div className="progress-fill" style={{ width: `${progress}%` }}></div>
              <div className="progress-text mono">
                {Math.floor(progress)}% · ETA {exportEta}
              </div>
            </div>
            <button className="btn danger" type="button" onClick={onCancelExport}>
              {t('cancel')}
            </button>
          </>
        ) : (
          <>
            <div className="counts">
              <span className="ct mono">{audioCount}A</span>
              <span className="ct mono">{subCount}S</span>
            </div>
            <button
              className="btn ghost compact"
              type="button"
              onClick={onAddToQueue}
              disabled={!canExport}
              title={t('batch_add_tip')}
            >
              + {t('batch_queue_btn')}
            </button>
            <button className="btn primary" type="button" onClick={onExport} disabled={!canExport} data-testid="export-btn">
              <Ico d={I.zap} size={13} /> {t('export_btn')}
            </button>
          </>
        )}
      </div>
    </footer>
  );
}
