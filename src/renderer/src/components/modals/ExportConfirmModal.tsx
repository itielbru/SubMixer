import React from 'react';
import { Ico, I } from '../ui/Icons';
import { useT } from '../../hooks/useTranslation';
import { Modal } from '../ui/Modal';

interface Props {
  kind?: 'double-apply' | 'overwrite';
  onConfirm: () => void;
  onClose: () => void;
}

export function ExportConfirmModal({ kind = 'double-apply', onConfirm, onClose }: Props) {
  const { t } = useT();
  const title = kind === 'overwrite' ? t('export_overwrite_title') : t('export_double_apply_title');
  const body = kind === 'overwrite' ? t('export_overwrite_body') : t('export_double_apply_body');
  return (
    <Modal onClose={onClose} label={title}>
      <div className="modal-h">
        <div className="modal-t">{title}</div>
        <button className="icon-btn" type="button" onClick={onClose}>
          <Ico d={I.x} />
        </button>
      </div>
      <div className="modal-b">
        <p className="sync-hint">{body}</p>
        <div className="modal-actions">
          <button className="btn ghost" type="button" onClick={onClose}>
            {t('cancel')}
          </button>
          <button className="btn primary" type="button" onClick={onConfirm}>
            {kind === 'overwrite' ? t('export_overwrite_confirm') : t('export_continue')}
          </button>
        </div>
      </div>
    </Modal>
  );
}
