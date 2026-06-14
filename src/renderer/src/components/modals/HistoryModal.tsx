import React from 'react';
import type { ExportPlan, ExportRecord } from '@shared/types';
import { Ico, I } from '../ui/Icons';
import { useT } from '../../hooks/useTranslation';
import { Modal } from '../ui/Modal';

interface HistoryModalProps {
  history: ExportRecord[];
  onClose: () => void;
  onClear: () => void;
  onShow: (path: string) => void;
  onReExport?: (plan: ExportPlan, durationSec: number) => void;
}

export function HistoryModal({ history, onClose, onClear, onShow, onReExport }: HistoryModalProps) {
  const { t } = useT();

  return (
    <Modal onClose={onClose} label={t('history_title')}>
      <div className="modal-h">
        <div className="modal-t">{t('history_title')}</div>
        <div style={{ display: 'flex', gap: 8 }}>
          {history.length > 0 && (
            <button className="btn ghost compact" type="button" onClick={onClear}>
              <Ico d={I.trash} size={12} /> {t('history_clear_btn')}
            </button>
          )}
          <button className="icon-btn" type="button" onClick={onClose}>
            <Ico d={I.x} />
          </button>
        </div>
      </div>
      <div className="modal-b">
        {history.length === 0 ? (
          <div className="hist-empty">{t('history_empty')}</div>
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
                {h.ok ? t('hist_ok') : t('hist_fail')}
              </div>
              {h.ok && h.plan && onReExport && (
                <button
                  className="btn ghost compact"
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    onReExport(h.plan!, h.durationSec ?? 0);
                  }}
                >
                  {t('hist_reexport')}
                </button>
              )}
            </div>
          ))
        )}
      </div>
    </Modal>
  );
}
