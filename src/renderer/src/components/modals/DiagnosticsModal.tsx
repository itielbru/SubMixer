import React, { useEffect, useState } from 'react';
import type { DiagnosticsInfo } from '@shared/types';
import { Ico, I } from '../ui/Icons';
import { useT } from '../../hooks/useTranslation';
import { Modal } from '../ui/Modal';

function fmtBytes(n: number): string {
  if (n === 0) return '0 B';
  if (n >= 1024 ** 3) return (n / 1024 ** 3).toFixed(2) + ' GB';
  if (n >= 1024 ** 2) return (n / 1024 ** 2).toFixed(1) + ' MB';
  return (n / 1024).toFixed(1) + ' KB';
}

interface Props {
  onClose: () => void;
}

export function DiagnosticsModal({ onClose }: Props) {
  const { t } = useT();
  const [info, setInfo] = useState<DiagnosticsInfo | null>(null);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    window.api.diagnostics
      .get()
      .then(setInfo)
      .catch(() => {});
  }, []);

  function buildText(d: DiagnosticsInfo): string {
    const na = t('diag_not_available');
    return [
      `${t('diag_app_version')}: ${d.appVersion}`,
      `${t('diag_electron')}: ${d.electronVersion}`,
      `${t('diag_node')}: ${d.nodeVersion}`,
      `${t('diag_platform')}: ${d.platform} ${d.arch}`,
      `${t('diag_ffmpeg_status')}: ${d.ffmpegAvailable ? t('diag_ffmpeg_ok') : t('diag_ffmpeg_missing')}`,
      `${t('diag_ffmpeg_version')}: ${d.ffmpegVersion ?? na}`,
      `${t('diag_ffmpeg_path')}: ${d.ffmpegPath ?? na}`,
      `${t('diag_ffprobe_path')}: ${d.ffprobePath ?? na}`,
      `${t('diag_userdata')}: ${d.userDataPath}`,
      `${t('diag_preview_cache')}: ${fmtBytes(d.previewCacheSizeBytes)}`,
      `${t('diag_peaks_cache')}: ${fmtBytes(d.peaksCacheSizeBytes)}`,
      `${t('diag_logs')}: ${fmtBytes(d.logSizeBytes)}`,
    ].join('\n');
  }

  function copyAll() {
    if (!info) return;
    navigator.clipboard.writeText(buildText(info)).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  }

  const na = t('diag_not_available');

  return (
    <Modal onClose={onClose} label={t('diag_title')}>
      <div className="modal-h">
        <div className="modal-t">{t('diag_title')}</div>
        <div style={{ display: 'flex', gap: 8 }}>
          {info && (
            <button className="btn ghost compact" type="button" onClick={copyAll}>
              <Ico d={copied ? I.check : I.copy} size={12} />
              {copied ? t('diag_copied') : t('diag_copy')}
            </button>
          )}
          <button className="icon-btn" type="button" onClick={onClose} aria-label={t('close')}>
            <Ico d={I.x} />
          </button>
        </div>
      </div>
      <div className="modal-b">
        {!info ? (
          <div style={{ padding: '24px 0', textAlign: 'center', opacity: 0.5 }}>…</div>
        ) : (
          <div className="diag-table">
            <DiagRow label={t('diag_app_version')} value={info.appVersion} />
            <DiagRow label={t('diag_electron')} value={info.electronVersion} />
            <DiagRow label={t('diag_node')} value={info.nodeVersion} />
            <DiagRow label={t('diag_platform')} value={`${info.platform} ${info.arch}`} />
            <DiagRow
              label={t('diag_ffmpeg_status')}
              value={info.ffmpegAvailable ? t('diag_ffmpeg_ok') : t('diag_ffmpeg_missing')}
              accent={info.ffmpegAvailable ? 'ok' : 'err'}
            />
            <DiagRow label={t('diag_ffmpeg_version')} value={info.ffmpegVersion ?? na} mono />
            <DiagRow label={t('diag_ffmpeg_path')} value={info.ffmpegPath ?? na} mono wrap />
            <DiagRow label={t('diag_ffprobe_path')} value={info.ffprobePath ?? na} mono wrap />
            <DiagRow label={t('diag_userdata')} value={info.userDataPath} mono wrap />
            <DiagRow label={t('diag_preview_cache')} value={fmtBytes(info.previewCacheSizeBytes)} />
            <DiagRow label={t('diag_peaks_cache')} value={fmtBytes(info.peaksCacheSizeBytes)} />
            <DiagRow label={t('diag_logs')} value={fmtBytes(info.logSizeBytes)} />
          </div>
        )}
      </div>
    </Modal>
  );
}

function DiagRow({
  label,
  value,
  mono,
  wrap,
  accent,
}: {
  label: string;
  value: string;
  mono?: boolean;
  wrap?: boolean;
  accent?: 'ok' | 'err';
}) {
  return (
    <div className="diag-row">
      <span className="diag-label">{label}</span>
      <span
        className={`diag-val${mono ? ' mono' : ''}${accent ? ` diag-${accent}` : ''}`}
        style={wrap ? { wordBreak: 'break-all' } : undefined}
      >
        {value}
      </span>
    </div>
  );
}
