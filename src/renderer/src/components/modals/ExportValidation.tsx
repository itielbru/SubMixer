import React from 'react';
import { Ico, I } from '../ui/Icons';

export type WarnLevel = 'info' | 'warn' | 'err';

export interface Warning {
  level: WarnLevel;
  msg: string;
}

interface Props {
  warnings: Warning[];
  onClose: () => void;
  onConfirm: () => void;
}

export function ExportValidationModal({ warnings, onClose, onConfirm }: Props) {
  const hasErr = warnings.some((w) => w.level === 'err');
  return (
    <div className="modal-bg" onClick={onClose}>
      <div className="modal validate-modal" onClick={(e) => e.stopPropagation()}>
        <div className="modal-h">
          <div className="modal-t">בדיקה לפני ייצוא</div>
          <button className="icon-btn" onClick={onClose}>
            <Ico d={I.x} />
          </button>
        </div>
        <div className="modal-b">
          <ul className="warn-list">
            {warnings.map((w, i) => (
              <li key={i} className={`warn-item lvl-${w.level}`}>
                <span className="warn-dot" />
                <span>{w.msg}</span>
              </li>
            ))}
          </ul>
          <div className="warn-actions">
            <button className="btn ghost" onClick={onClose}>
              חזרה לתקן
            </button>
            <button
              className={`btn ${hasErr ? 'danger' : 'primary'}`}
              onClick={onConfirm}
              disabled={hasErr}
              title={hasErr ? 'יש לתקן את השגיאות לפני המשך' : ''}
            >
              <Ico d={I.zap} size={12} /> ייצא בכל זאת
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
