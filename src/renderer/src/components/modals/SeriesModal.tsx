import { useState, useEffect, useCallback } from 'react';
import { Ico, I } from '../ui/Icons';
import { useT } from '../../hooks/useTranslation';
import { Modal } from '../ui/Modal';
import { Dropdown } from '../ui/Dropdown';
import type { SeriesScanItem } from '@shared/types';

export interface SeriesRunOptions {
  items: SeriesScanItem[];
  offset: number;
  speed: number;
  title: string;
  container: 'mkv' | 'mp4';
  outFolder: string;
}

interface Props {
  defaultDestFolder: string;
  onClose: () => void;
  onRun: (opts: SeriesRunOptions) => void;
}

function baseName(p: string): string {
  return p.split(/[/\\]/).pop() ?? p;
}

export function SeriesModal({ defaultDestFolder, onClose, onRun }: Props) {
  const { t } = useT();
  const [folder, setFolder] = useState('');
  const [scanning, setScanning] = useState(false);
  const [progress, setProgress] = useState({ done: 0, total: 0 });
  const [items, setItems] = useState<SeriesScanItem[]>([]);
  const [include, setInclude] = useState<Set<string>>(new Set());
  const [error, setError] = useState('');

  const [offset, setOffset] = useState(0);
  const [speed, setSpeed] = useState(1);
  const [title, setTitle] = useState('');
  const [container, setContainer] = useState<'mkv' | 'mp4'>('mkv');
  const [outFolder, setOutFolder] = useState(defaultDestFolder);

  useEffect(() => {
    return window.api.series.onScanProgress((p) => setProgress(p));
  }, []);

  const scan = useCallback(async (dir: string) => {
    setScanning(true);
    setError('');
    setItems([]);
    setProgress({ done: 0, total: 0 });
    const r = await window.api.series.scan(dir);
    setScanning(false);
    if (!r.ok || !r.items) {
      setError(r.error || t('series_scan_failed'));
      return;
    }
    setItems(r.items);
    setInclude(new Set(r.items.filter((i) => i.media).map((i) => i.videoPath)));
    if (!title) setTitle(baseName(dir));
    if (!outFolder) setOutFolder(dir);
  }, [t, title, outFolder]);

  const chooseFolder = async () => {
    const d = await window.api.dialog.chooseFolder(folder || defaultDestFolder);
    if (d) {
      setFolder(d);
      void scan(d);
    }
  };

  const chooseOut = async () => {
    const d = await window.api.dialog.chooseFolder(outFolder || folder);
    if (d) setOutFolder(d);
  };

  const toggle = (videoPath: string) => {
    setInclude((s) => {
      const n = new Set(s);
      if (n.has(videoPath)) n.delete(videoPath);
      else n.add(videoPath);
      return n;
    });
  };

  const selected = items.filter((i) => i.media && include.has(i.videoPath));
  const canRun = selected.length > 0 && !!outFolder && !!title.trim();

  const run = () => {
    if (!canRun) return;
    onRun({ items: selected, offset, speed, title: title.trim(), container, outFolder });
  };

  const epLabel = (it: SeriesScanItem): string => {
    if (it.season != null && it.episode != null)
      return `S${String(it.season).padStart(2, '0')}E${String(it.episode).padStart(2, '0')}`;
    if (it.episode != null) return `E${String(it.episode).padStart(2, '0')}`;
    return '—';
  };

  return (
    <Modal onClose={onClose} label={t('series_title')} className="modal-wide series-modal">
      <div className="modal-h">
        <div className="modal-t">{t('series_title')}</div>
        <button className="icon-btn" type="button" onClick={onClose}>
          <Ico d={I.x} />
        </button>
      </div>
      <div className="modal-b">
        <p className="dlg-hint">{t('series_desc')}</p>

        <div className="series-folder-row">
          <button className="btn" type="button" onClick={chooseFolder}>
            <Ico d={I.folder} size={13} /> {t('series_choose_folder')}
          </button>
          {folder && <span className="series-folder-path mono">{folder}</span>}
        </div>

        {scanning && (
          <div className="series-scan-status">
            {t('series_scanning')} {progress.total > 0 ? `${progress.done}/${progress.total}` : ''}
          </div>
        )}

        {error && <div className="sync-err">{error}</div>}

        {items.length > 0 && (
          <div className="series-list">
            {items.map((it) => (
              <div
                key={it.videoPath}
                className={`batch-row${it.error ? ' failed' : ''}`}
              >
                <label className="cb" style={{ margin: 0 }}>
                  <span
                    className={`cb-box ${include.has(it.videoPath) ? 'on' : ''}`}
                    onClick={() => it.media && toggle(it.videoPath)}
                  >
                    {include.has(it.videoPath) && <Ico d={I.check} size={10} />}
                  </span>
                </label>
                <span className="lang" style={{ flexShrink: 0 }}>{epLabel(it)}</span>
                <div className="batch-info">
                  <div className="batch-label">{it.videoName}</div>
                  <div className="batch-err" style={{ color: it.subName ? 'var(--text-3)' : 'var(--warn)' }}>
                    {it.error
                      ? it.error
                      : it.subName
                        ? `↳ ${it.subName}`
                        : t('series_no_sub_match')}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}

        {items.length > 0 && (
          <div className="series-options">
            <div className="settings-grid">
              <label>{t('series_field_title')}</label>
              <input value={title} onChange={(e) => setTitle(e.target.value)} />

              <label>{t('series_field_offset')}</label>
              <div className="grp">
                <input
                  type="number"
                  step={0.05}
                  value={offset}
                  onChange={(e) => setOffset(Number(e.target.value) || 0)}
                  className="mono"
                  style={{ width: 100 }}
                />
                <input
                  type="number"
                  step={0.001}
                  value={speed}
                  onChange={(e) => setSpeed(Number(e.target.value) || 1)}
                  className="mono"
                  style={{ width: 100 }}
                  title={t('series_field_speed')}
                />
                <span className="faint" style={{ fontSize: 11, alignSelf: 'center' }}>
                  {t('series_preset_hint')}
                </span>
              </div>

              <label>{t('series_field_container')}</label>
              <Dropdown
                value={container}
                onChange={(v) => setContainer(v === 'mp4' ? 'mp4' : 'mkv')}
                options={[
                  { value: 'mkv', label: 'MKV' },
                  { value: 'mp4', label: 'MP4' },
                ]}
              />

              <label>{t('series_field_out')}</label>
              <div className="grp">
                <input value={outFolder} onChange={(e) => setOutFolder(e.target.value)} />
                <button className="btn compact" type="button" onClick={chooseOut}>
                  {t('browse')}
                </button>
              </div>
            </div>
          </div>
        )}

        <div className="modal-actions">
          <button className="btn ghost" type="button" onClick={onClose}>
            {t('cancel')}
          </button>
          <button className="btn primary" type="button" onClick={run} disabled={!canRun}>
            <Ico d={I.play} size={12} /> {t('series_run')} ({selected.length})
          </button>
        </div>
      </div>
    </Modal>
  );
}
