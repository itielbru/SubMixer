import React from 'react';
import type { AppSettings } from '@shared/types';
import { Ico, I } from '../ui/Icons';
import { ACCENTS } from '../../lib/theme';
import { Dropdown } from '../ui/Dropdown';

interface Props {
  settings: AppSettings;
  onClose: () => void;
  onChange: <K extends keyof AppSettings>(key: K, value: AppSettings[K]) => Promise<void>;
  onChooseFolder: () => Promise<string | null>;
}

export function SettingsModal({ settings, onClose, onChange, onChooseFolder }: Props) {
  return (
    <div className="modal-bg" onClick={onClose}>
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        <div className="modal-h">
          <div className="modal-t">הגדרות</div>
          <button className="icon-btn" onClick={onClose}>
            <Ico d={I.x} />
          </button>
        </div>
        <div className="modal-b">
          <div className="settings-grid">
            <label>ערכת נושא</label>
            <div className="seg-mode">
              <button
                className={settings.theme === 'dark' ? 'on' : ''}
                onClick={() => onChange('theme', 'dark')}
              >
                כהה
              </button>
              <button
                className={settings.theme === 'light' ? 'on' : ''}
                onClick={() => onChange('theme', 'light')}
              >
                בהיר
              </button>
            </div>

            <label>צבע אקצנט</label>
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

            <label>גופן</label>
            <Dropdown
              value={settings.font}
              onChange={(v) => onChange('font', v as AppSettings['font'])}
              options={['Heebo', 'Assistant']}
            />

            <label>תיקיית יעד ברירת־מחדל</label>
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

            {import.meta.env.DEV && (
              <>
                <label>פיתוח</label>
                <div className="mono small" style={{ opacity: 0.85, lineHeight: 1.5 }}>
                  מצב dev: DevTools, Reload ו‑Force Reload זמינים בתפריט &quot;תצוגה&quot;.
                </div>
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
