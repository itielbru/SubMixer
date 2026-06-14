import React from 'react';
import { Ico, I } from '../ui/Icons';
import { useT } from '../../hooks/useTranslation';
import { Modal } from '../ui/Modal';

interface Props {
  onConfirm: () => void;
  onClose: () => void;
}

export function ExportConfirmModal({ onConfirm, onClose }: Props) {
  const { t } = useT();
  return (
    <Modal onClose={onClose} label={t('export_double_apply_title')}>
      <div className="modal-h">
        <div className="modal-t">{t('export_double_apply_title')}</div>
        <button className="icon-btn" type="button" onClick={onClose}>
          <Ico d={I.x} />
        </button>
      </div>
      <div className="modal-b">
        <p className="sync-hint">{t('export_double_apply_body')}</p>
        <div className="modal-actions">
          <button className="btn ghost" type="button" onClick={onClose}>
            {t('cancel')}
          </button>
          <button className="btn primary" type="button" onClick={onConfirm}>
            {t('export_continue')}
          </button>
        </div>
      </div>
    </Modal>
  );
}
