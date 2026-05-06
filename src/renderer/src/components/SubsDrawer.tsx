import React from 'react';
import type { ExternalSub } from '@shared/types';
import { Dropdown } from './ui/Dropdown';
import { HelpTip } from './ui/HelpTip';
import { Knob } from './ui/Knob';
import { Ico, I } from './ui/Icons';

interface Props {
  extSubs: ExternalSub[];
  activeSubId: string | null;
  onSelectSub: (id: string) => void;
  onAddSubs: () => void;
  onRemoveSub: (id: string) => void;
  onUpdateSub: (id: string, patch: Partial<ExternalSub>) => void;
}

export function SubsDrawer({
  extSubs,
  activeSubId,
  onSelectSub,
  onAddSubs,
  onRemoveSub,
  onUpdateSub,
}: Props) {
  const sub = extSubs.find((s) => s.id === activeSubId);
  return (
    <aside className="col-right">
      <div className="ext-head">
        <div className="ext-title">כתוביות חיצוניות</div>
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
            <span className="tag tag-sub">SRT</span>
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
            <div>גרור קובץ SRT לכאן או הוסף</div>
            <button className="btn ghost mt8" type="button" onClick={onAddSubs}>
              <Ico d={I.plus} size={12} /> הוסף
            </button>
          </div>
        )}
      </div>

      {sub && (
        <>
          <div className="ext-sect">סנכרון</div>
          <div className="knob-row">
            <Knob
              label="הזחה"
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
              label="מהירות"
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
              onClick={() => onUpdateSub(sub.id, { offset: 0, speed: 1 })}
            >
              <Ico d={I.reset} size={11} /> אפס
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

          <div className="ext-sect">מטא־דאטה</div>
          <div className="field">
            <label>שפה</label>
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
            <label>שם מסלול</label>
            <input
              value={sub.trackName}
              onChange={(e) => onUpdateSub(sub.id, { trackName: e.target.value })}
            />
          </div>
          <div className="field">
            <label>קידוד</label>
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
              <span>ברירת מחדל</span>
              <HelpTip>
                נבחר אוטומטית בעת הפעלת הקובץ. ניגון אחד בלבד מסוג זה יכול להיות ברירת מחדל.
              </HelpTip>
            </label>
            <label className="cb" onClick={() => onUpdateSub(sub.id, { forced: !sub.forced })}>
              <span className={`cb-box ${sub.forced ? 'on' : ''}`}>
                {sub.forced && <Ico d={I.check} size={10} />}
              </span>
              <span>כפויות</span>
              <HelpTip>
                כתוביות שמוצגות תמיד לרוב לתרגום קטעים בשפה זרה.
              </HelpTip>
            </label>
          </div>
        </>
      )}
    </aside>
  );
}
