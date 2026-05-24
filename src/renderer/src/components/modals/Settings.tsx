import React from 'react';
import type { AppSettings } from '@shared/types';
import { Ico, I } from '../ui/Icons';
import { ACCENTS } from '../../lib/theme';
import { Dropdown } from '../ui/Dropdown';
import { useT } from '../../hooks/useTranslation';

interface Props {
  settings: AppSettings;
  onClose: () => void;
  onChange: <K extends keyof AppSettings>(key: K, value: AppSettings[K]) => Promise<void>;
  onChooseFolder: () => Promise<string | null>;
}

export function SettingsModal({ settings, onClose, onChange, onChooseFolder }: Props) {
  const { t } = useT();

  return (
    <div className="modal-bg" onClick={onClose}>
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        <div className="modal-h">
          <div className="modal-t">{t('settings_title')}</div>
          <button className="icon-btn" onClick={onClose}>
            <Ico d={I.x} />
          </button>
        </div>
        <div className="modal-b">
          <div className="settings-grid">
            <label>{t('settings_theme')}</label>
            <div className="seg-mode">
              <button
                className={settings.theme === 'dark' ? 'on' : ''}
                onClick={() => onChange('theme', 'dark')}
              >
                {t('theme_dark')}
              </button>
              <button
                className={settings.theme === 'light' ? 'on' : ''}
                onClick={() => onChange('theme', 'light')}
              >
                {t('theme_light')}
              </button>
            </div>

            <label>{t('settings_accent')}</label>
            <div className="swatches">
              {(Object.keys(ACCENTS) as (keyof typeof ACCENTS)[]).map((k) => (
                <button
                  key={k}
                  type="button"
                  className={`swatch ${settings.accent === k ? 'on' : ''}`}
                  title={ACCENTS[k].name}
                  style={{ background: ACCENTS[k].hex }}
                  onClick={() => onChange('accent', k)}
                />
              ))}
            </div>

            <label>{t('settings_font')}</label>
            <Dropdown
              value={settings.font}
              onChange={(v) => onChange('font', v as AppSettings['font'])}
              options={['Heebo', 'Assistant']}
            />

            <label>{t('settings_lang')}</label>
            <Dropdown
              value={settings.lang}
              onChange={(v) => onChange('lang', v as AppSettings['lang'])}
              options={[
                { value: 'he', label: t('lang_he') },
                { value: 'en', label: t('lang_en') },
              ]}
            />

            <label>{t('settings_default_dest')}</label>
            <div className="grp" style={{ display: 'flex', gap: 6 }}>
              <input
                value={settings.defaultDestFolder}
                onChange={(e) => onChange('defaultDestFolder', e.target.value)}
              />
              <button
                className="btn ghost compact"
                onClick={async () => {
                  const dir = await onChooseFolder();
                  if (dir) onChange('defaultDestFolder', dir);
                }}
              >
                <Ico d={I.folder} size={13} />
              </button>
            </div>

            <label>{t('settings_export_content_folder')}</label>
            <label className="cb" style={{ margin: 0 }}>
              <span
                className={`cb-box ${settings.exportUseContentFolder ? 'on' : ''}`}
                onClick={() => onChange('exportUseContentFolder', !settings.exportUseContentFolder)}
              >
                {settings.exportUseContentFolder && <Ico d={I.check} size={10} />}
              </span>
              <span onClick={() => onChange('exportUseContentFolder', !settings.exportUseContentFolder)}>
                {t('export_content_folder')}
              </span>
            </label>
            <div className="small" style={{ opacity: 0.75, gridColumn: '1 / -1', marginTop: -8 }}>
              {t('export_content_folder_hint')}
            </div>

            <label className="settings-section">{t('settings_cue_warnings')}</label>
            <label>{t('settings_min_duration')}</label>
            <input
              type="number"
              min={0.1}
              max={10}
              step={0.1}
              value={settings.minCueDurationSec}
              onChange={(e) =>
                onChange('minCueDurationSec', Math.max(0.1, Number(e.target.value) || 1.2))
              }
            />
            <label>{t('settings_max_duration')}</label>
            <input
              type="number"
              min={1}
              max={30}
              step={0.5}
              value={settings.maxCueDurationSec}
              onChange={(e) =>
                onChange('maxCueDurationSec', Math.max(1, Number(e.target.value) || 8))
              }
            />
            <label>{t('settings_max_cps')}</label>
            <input
              type="number"
              min={5}
              max={50}
              step={1}
              value={settings.maxCps}
              onChange={(e) => onChange('maxCps', Math.max(5, Number(e.target.value) || 25))}
            />
            <label>{t('settings_hard_max_cps')}</label>
            <input
              type="number"
              min={10}
              max={60}
              step={1}
              value={settings.hardMaxCps}
              onChange={(e) => onChange('hardMaxCps', Math.max(10, Number(e.target.value) || 35))}
            />
            <label>{t('settings_min_gap')}</label>
            <input
              type="number"
              min={0}
              max={2}
              step={0.01}
              value={settings.minGapSec}
              onChange={(e) => onChange('minGapSec', Math.max(0, Number(e.target.value) || 0.12))}
            />

            <label className="settings-section">{t('settings_sub_appearance')}</label>
            <label>{t('settings_sub_size')}</label>
            <input
              type="number"
              min={0.5}
              max={2.5}
              step={0.1}
              value={settings.subFontScale}
              onChange={(e) =>
                onChange('subFontScale', Math.min(2.5, Math.max(0.5, Number(e.target.value) || 1)))
              }
            />
            <label>{t('settings_sub_color')}</label>
            <input
              type="color"
              className="color-input"
              value={settings.subColor}
              onChange={(e) => onChange('subColor', e.target.value)}
            />
            <label>{t('settings_sub_style')}</label>
            <div className="seg-mode seg-3">
              <button
                className={settings.subStyle === 'outline' ? 'on' : ''}
                onClick={() => onChange('subStyle', 'outline')}
              >
                {t('sub_style_outline')}
              </button>
              <button
                className={settings.subStyle === 'box' ? 'on' : ''}
                onClick={() => onChange('subStyle', 'box')}
              >
                {t('sub_style_box')}
              </button>
              <button
                className={settings.subStyle === 'none' ? 'on' : ''}
                onClick={() => onChange('subStyle', 'none')}
              >
                {t('sub_style_none')}
              </button>
            </div>
            <label>{t('settings_sub_position')}</label>
            <Dropdown
              value={settings.subPosition}
              onChange={(v) => onChange('subPosition', v as AppSettings['subPosition'])}
              options={[
                { value: 'bottom', label: t('sub_pos_bottom') },
                { value: 'top', label: t('sub_pos_top') },
              ]}
            />

            <label>{t('settings_burn_in')}</label>
            <label className="cb" style={{ margin: 0 }}>
              <span
                className={`cb-box ${settings.burnInSubs ? 'on' : ''}`}
                onClick={() => onChange('burnInSubs', !settings.burnInSubs)}
              >
                {settings.burnInSubs && <Ico d={I.check} size={10} />}
              </span>
              <span onClick={() => onChange('burnInSubs', !settings.burnInSubs)}>
                {t('burn_in_label')}
              </span>
            </label>
            <div className="small" style={{ opacity: 0.75, gridColumn: '1 / -1', marginTop: -8 }}>
              {t('burn_in_hint')}
            </div>

            {import.meta.env.DEV && (
              <>
                <label>{t('dev_mode')}</label>
                <div className="mono small" style={{ opacity: 0.85, lineHeight: 1.5 }}>
                  {t('dev_mode_hint')}
                </div>
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
