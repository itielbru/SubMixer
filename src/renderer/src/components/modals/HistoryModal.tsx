import React from 'react';
import type { ExportRecord } from '@shared/types';
import { Ico, I } from '../ui/Icons';

interface HistoryModalProps {
  history: ExportRecord[];
  onClose: () => void;
  onClear: () => void;
  onShow: (path: string) => void;
}

export function HistoryModal({ history, onClose, onClear, onShow }: HistoryModalProps) {
  return (
    <div className="modal-bg" onClick={onClose}>
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        <div className="modal-h">
          <div className="modal-t">היסטוריית ייצוא</div>
          <div style={{ display: 'flex', gap: 8 }}>
            {history.length > 0 && (
              <button className="btn ghost compact" onClick={onClear}>
                <Ico d={I.trash} size={12} /> נקה
              </button>
            )}
            <button className="icon-btn" onClick={onClose}>
              <Ico d={I.x} />
            </button>
          </div>
        </div>
        <div className="modal-b">
          {history.length === 0 ? (
            <div className="hist-empty">עדיין לא בוצע ייצוא</div>
          ) : (
            history.map((h, i) => (
              <div
                key={i}
                className="hist-row"
                onClick={() => h.ok && onShow(h.path)}
                style={h.ok ? { cursor: 'pointer' } : undefined}
              >
                <div className={`hist-dot ${h.ok ? 'ok' : 'err'}`}></div>
                <div className="hist-i">
                  <div className="hist-n">{h.name}</div>
                  <div className="hist-m mono">
                    {h.time} · {h.size}
                  </div>
                </div>
                <div className={`hist-tag ${h.ok ? 'ok' : 'err'}`}>
                  {h.ok ? '✓ הצליח' : '✗ נכשל'}
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}
