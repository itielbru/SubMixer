import React, { useMemo, useState } from 'react';
import type { ReplaceRule, SrtCue } from '@shared/types';
import { Ico, I } from '../ui/Icons';

interface Props {
  cues: SrtCue[];
  subName: string;
  onApply: (rule: ReplaceRule) => void;
  onClose: () => void;
}

export function FindReplaceModal({ cues, subName, onApply, onClose }: Props) {
  const [find, setFind] = useState('');
  const [replace, setReplace] = useState('');
  const [regex, setRegex] = useState(false);
  const [caseSensitive, setCaseSensitive] = useState(false);
  const [error, setError] = useState('');

  const matches = useMemo(() => {
    if (!find) return { count: 0, samples: [] as { idx: number; before: string; after: string }[] };
    let re: RegExp;
    try {
      if (regex) {
        re = new RegExp(find, 'g' + (caseSensitive ? '' : 'i'));
      } else {
        const esc = find.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
        re = new RegExp(esc, 'g' + (caseSensitive ? '' : 'i'));
      }
      setError('');
    } catch (err) {
      setError((err as Error).message);
      return { count: 0, samples: [] };
    }
    let count = 0;
    const samples: { idx: number; before: string; after: string }[] = [];
    for (const c of cues) {
      const found = c.text.match(re);
      if (found) {
        count += found.length;
        if (samples.length < 5) {
          samples.push({ idx: c.idx, before: c.text, after: c.text.replace(re, replace) });
        }
      }
    }
    return { count, samples };
  }, [find, replace, regex, caseSensitive, cues]);

  const apply = () => {
    if (!find || error) return;
    onApply({ find, replace, regex, caseSensitive });
    onClose();
  };

  return (
    <div className="modal-bg" onClick={onClose}>
      <div className="modal find-modal" onClick={(e) => e.stopPropagation()}>
        <div className="modal-h">
          <div className="modal-t">חפש והחלף · {subName}</div>
          <button className="icon-btn" onClick={onClose}>
            <Ico d={I.x} />
          </button>
        </div>
        <div className="modal-b">
          <div className="field">
            <label>חפש</label>
            <input
              autoFocus
              value={find}
              onChange={(e) => setFind(e.target.value)}
              placeholder={regex ? 'ביטוי רגולרי' : 'טקסט מילולי'}
            />
          </div>
          <div className="field">
            <label>החלף ב</label>
            <input
              value={replace}
              onChange={(e) => setReplace(e.target.value)}
              placeholder="(ריק = מחיקה)"
            />
          </div>
          <div className="flag-row" style={{ marginBottom: 12 }}>
            <label className="cb" onClick={() => setRegex(!regex)}>
              <span className={`cb-box ${regex ? 'on' : ''}`}>
                {regex && <Ico d={I.check} size={10} />}
              </span>
              <span>regex</span>
            </label>
            <label className="cb" onClick={() => setCaseSensitive(!caseSensitive)}>
              <span className={`cb-box ${caseSensitive ? 'on' : ''}`}>
                {caseSensitive && <Ico d={I.check} size={10} />}
              </span>
              <span>תלוי רישיות</span>
            </label>
          </div>
          {error ? (
            <div className="find-err">שגיאה: {error}</div>
          ) : (
            <div className="find-count">
              {find ? `${matches.count} התאמות ב-${matches.samples.length ? matches.samples.length : 0} cues` : 'הזן טקסט כדי לראות התאמות'}
            </div>
          )}
          {matches.samples.length > 0 && (
            <div className="find-preview">
              {matches.samples.map((s) => (
                <div key={s.idx} className="find-sample">
                  <div className="find-idx mono">#{s.idx}</div>
                  <div className="find-before">{s.before}</div>
                  <div className="find-arrow">→</div>
                  <div className="find-after">{s.after}</div>
                </div>
              ))}
            </div>
          )}
          <div className="warn-actions">
            <button className="btn ghost" onClick={onClose}>ביטול</button>
            <button
              className="btn primary"
              onClick={apply}
              disabled={!find || !!error || matches.count === 0}
            >
              <Ico d={I.check} size={12} /> החל ({matches.count})
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
