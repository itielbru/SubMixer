import React, { useState } from 'react';
import type { ExternalSub } from '@shared/types';
import { Dropdown } from './ui/Dropdown';
import { HelpTip } from './ui/HelpTip';
import { Knob } from './ui/Knob';
import { Ico, I } from './ui/Icons';
import { useT } from '../hooks/useTranslation';

interface Props {
  extSubs: ExternalSub[];
  activeSubId: string | null;
  fileEdited?: boolean;
  onSelectSub: (id: string) => void;
  onAddSubs: () => void;
  onRemoveSub: (id: string) => void;
  onUpdateSub: (id: string, patch: Partial<ExternalSub>) => void;
  onExportSrt?: (sub: ExternalSub) => void;
  onVisualSync?: () => void;
}

export function SubsDrawer({
  extSubs,
  activeSubId,
  fileEdited,
  onSelectSub,
  onAddSubs,
  onRemoveSub,
  onUpdateSub,
  onExportSrt,
  onVisualSync,
}: Props) {
  const { t } = useT();
  const [manualOpen, setManualOpen] = useState(false);
  const sub = extSubs.find((s) => s.id === activeSubId);

  const globalActive =
    sub && (Math.abs(sub.offset) > 1e-6 || Math.abs(sub.speed - 1) > 1e-5);

  return (
    <aside className="col-right">
      <div className="ext-head">
        <div className="ext-title">{t('ext_subs_title')}</div>
        <button className="icon-btn small" type="button" onClick={onAddSubs}>
          <Ico d={I.plus} size={13} />
        </button>
      </div>

      <div className="ext-list">
        {extSubs.map((s) => (
          <div
            key={s.id}
            className={`ext-item ${s.id === activeSubId ? 'active' : ''}`}
            onClick={() => onSelectSub(s.id)}
          >
            <span className="tag tag-sub">
              {s.name.split('.').pop()?.toUpperCase() || 'SRT'}
            </span>
            <div className="ext-i">
              <div className="ext-n">{s.name}</div>
              <div className="ext-m mono">
                {s.size} · {s.cues.toLocaleString()} cues · {s.encoding}
              </div>
            </div>
            <button
              className="icon-btn small ghost"
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                onRemoveSub(s.id);
              }}
            >
              <Ico d={I.trash} size={12} />
            </button>
          </div>
        ))}
        {extSubs.length === 0 && (
          <div className="ext-empty">
            <div className="ext-empty-i">
              <Ico d={I.upload} size={22} />
            </div>
            <div>{t('no_ext_subs')}</div>
            <button className="btn ghost mt8" type="button" onClick={onAddSubs}>
              <Ico d={I.plus} size={12} /> {t('add_short')}
            </button>
          </div>
        )}
      </div>

      {sub && (
        <>
          <div className="ext-sect">{t('sync_section')}</div>
          <p className="sync-layer-hint">{t('sync_global_hint')}</p>

          <div className="sync-status-bar">
            <div className="sync-status-lines">
              <div className="sync-status-line mono">
                <span className="sync-status-k">{t('knob_offset')}:</span>
                <span>
                  {sub.offset >= 0 ? '+' : ''}
                  {sub.offset.toFixed(3)}s
                </span>
              </div>
              <div className="sync-status-line mono">
                <span className="sync-status-k">{t('knob_speed')}:</span>
                <span>{sub.speed.toFixed(4)}x</span>
              </div>
              {fileEdited && (
                <div className="sync-status-badge">{t('file_edited_badge')}</div>
              )}
            </div>
            <button
              className="btn ghost compact sync-reset-btn"
              type="button"
              title={t('master_reset_tip')}
              onClick={() => onUpdateSub(sub.id, { offset: 0, speed: 1 })}
              disabled={!globalActive}
            >
              <Ico d={I.reset} size={11} /> {t('master_reset_btn')}
            </button>
          </div>

          <button
            className="btn primary compact full-width"
            type="button"
            onClick={onVisualSync}
          >
            {t('visual_sync_btn')}
          </button>

          <button
            className="btn ghost compact full-width manual-toggle"
            type="button"
            onClick={() => setManualOpen((v) => !v)}
          >
            {manualOpen ? t('manual_tune_collapse') : t('manual_tune_expand')}
          </button>

          {manualOpen && (
            <div className="manual-tune-panel">
              <div className="ext-sect small">{t('manual_tune_section')}</div>
              <div className="knob-row">
                <Knob
                  label={t('knob_offset')}
                  value={sub.offset}
                  unit="s"
                  step={0.05}
                  min={-30}
                  max={30}
                  onChange={(v) => onUpdateSub(sub.id, { offset: v })}
                  format={(v) => (v >= 0 ? '+' : '') + v.toFixed(3)}
                  onReset={() => onUpdateSub(sub.id, { offset: 0 })}
                />
                <Knob
                  label={t('knob_speed')}
                  value={sub.speed}
                  unit="x"
                  step={0.001}
                  min={0.5}
                  max={2}
                  onChange={(v) => onUpdateSub(sub.id, { speed: v })}
                  format={(v) => v.toFixed(6)}
                  onReset={() => onUpdateSub(sub.id, { speed: 1 })}
                />
              </div>
              <div className="quick-row">
                <button
                  className="btn ghost compact"
                  type="button"
                  onClick={() => onUpdateSub(sub.id, { offset: sub.offset - 0.5 })}
                >
                  -0.5s
                </button>
                <button
                  className="btn ghost compact"
                  type="button"
                  onClick={() => onUpdateSub(sub.id, { offset: sub.offset - 0.1 })}
                >
                  -0.1s
                </button>
                <button
                  className="btn ghost compact"
                  type="button"
                  onClick={() => onUpdateSub(sub.id, { offset: sub.offset + 0.1 })}
                >
                  +0.1s
                </button>
                <button
                  className="btn ghost compact"
                  type="button"
                  onClick={() => onUpdateSub(sub.id, { offset: sub.offset + 0.5 })}
                >
                  +0.5s
                </button>
              </div>
            </div>
          )}

          <div className="ext-sect">{t('metadata_section')}</div>
          <div className="field">
            <label>{t('sub_lang')}</label>
            <Dropdown
              value={sub.lang}
              onChange={(v) => onUpdateSub(sub.id, { lang: v })}
              options={[
                { value: 'heb', label: 'עברית · heb' },
                { value: 'eng', label: 'English · eng' },
                { value: 'spa', label: 'Español · spa' },
                { value: 'ara', label: 'العربية · ara' },
                { value: 'fre', label: 'Français · fre' },
                { value: 'ger', label: 'Deutsch · ger' },
                { value: 'jpn', label: '日本語 · jpn' },
                { value: 'rus', label: 'Русский · rus' },
              ]}
            />
          </div>
          <div className="field">
            <label>{t('sub_track_name')}</label>
            <input
              value={sub.trackName}
              onChange={(e) => onUpdateSub(sub.id, { trackName: e.target.value })}
            />
          </div>
          <div className="field">
            <label>{t('sub_encoding')}</label>
            <Dropdown
              value={sub.encoding}
              onChange={(v) => onUpdateSub(sub.id, { encoding: v })}
              options={['UTF-8', 'Windows-1255', 'Windows-1252', 'UTF-16']}
            />
          </div>
          <div className="flag-row">
            <label className="cb" onClick={() => onUpdateSub(sub.id, { def: !sub.def })}>
              <span className={`cb-box ${sub.def ? 'on' : ''}`}>
                {sub.def && <Ico d={I.check} size={10} />}
              </span>
              <span>{t('sub_default')}</span>
              <HelpTip>{t('sub_default_tip')}</HelpTip>
            </label>
            <label className="cb" onClick={() => onUpdateSub(sub.id, { forced: !sub.forced })}>
              <span className={`cb-box ${sub.forced ? 'on' : ''}`}>
                {sub.forced && <Ico d={I.check} size={10} />}
              </span>
              <span>{t('sub_forced')}</span>
              <HelpTip>{t('sub_forced_tip')}</HelpTip>
            </label>
          </div>

          <div className="ext-action-row mt16">
            <button
              className="btn primary full-width"
              type="button"
              onClick={() => onExportSrt && onExportSrt(sub)}
            >
              <Ico d={I.download} size={13} /> {t('save_synced_srt')}
            </button>
          </div>
        </>
      )}
    </aside>
  );
}
