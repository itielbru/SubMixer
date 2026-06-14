import React from 'react';
import type { ExportPlan } from '@shared/types';
import { Ico, I } from '../ui/Icons';
import { Modal } from '../ui/Modal';
import { useT } from '../../hooks/useTranslation';

export interface BatchItem {
  id: string;
  label: string;
  plan: ExportPlan;
  durationSec: number;
  extSubs: { path: string; offset: number; speed: number; encoding?: string }[];
  status: 'pending' | 'running' | 'done' | 'failed';
  error?: string;
}

interface Props {
  items: BatchItem[];
  exporting: boolean;
  onRemove: (id: string) => void;
  onRunAll: () => void;
  onClearDone: () => void;
  onClose: () => void;
}

export function BatchQueueModal({
  items,
  exporting,
  onRemove,
  onRunAll,
  onClearDone,
  onClose,
}: Props) {
  const { t } = useT();
  const hasPending = items.some((x) => x.status === 'pending');
  const hasDone = items.some((x) => x.status === 'done' || x.status === 'failed');

  return (
    <Modal onClose={onClose} label={t('batch_queue_title')}>
      <div className="modal-h">
        <div className="modal-t">{t('batch_queue_title')}</div>
        <div style={{ display: 'flex', gap: 8 }}>
          {hasDone && (
            <button className="btn ghost compact" type="button" onClick={onClearDone}>
              <Ico d={I.trash} size={12} /> {t('history_clear_btn')}
            </button>
          )}
          <button className="icon-btn" type="button" onClick={onClose}>
            <Ico d={I.x} />
          </button>
        </div>
      </div>
      <div className="modal-b">
        {items.length === 0 ? (
          <div className="hist-empty">{t('batch_empty')}</div>
        ) : (
          <div className="batch-list">
            {items.map((item) => (
              <div key={item.id} className={`batch-row batch-${item.status}`}>
                <div className={`batch-dot ${item.status}`} />
                <div className="batch-info">
                  <div className="batch-label">{item.label}</div>
                  {item.status === 'failed' && item.error && (
                    <div className="batch-err mono">{item.error}</div>
                  )}
                </div>
                <div className="batch-tag">
                  {item.status === 'running' && t('batch_running')}
                  {item.status === 'done' && t('batch_done')}
                  {item.status === 'failed' && t('batch_failed')}
                </div>
                {item.status === 'pending' && !exporting && (
                  <button
                    className="btn ghost compact"
                    type="button"
                    onClick={() => onRemove(item.id)}
                  >
                    {t('batch_remove')}
                  </button>
                )}
              </div>
            ))}
          </div>
        )}
        <div className="modal-actions">
          <button className="btn ghost" type="button" onClick={onClose}>
            {t('cancel')}
          </button>
          <button
            className="btn primary"
            type="button"
            disabled={!hasPending || exporting}
            onClick={onRunAll}
          >
            {t('batch_run_all')}
          </button>
        </div>
      </div>
    </Modal>
  );
}
