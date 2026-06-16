import React from 'react';
import { Ico, I } from '../ui/Icons';
import { useT } from '../../hooks/useTranslation';
import { Modal } from '../ui/Modal';

interface Props {
  cmd: string;
  onClose: () => void;
  onCopy: () => void;
}

export function FFmpegCommandModal({ cmd, onClose, onCopy }: Props) {
  const { t } = useT();

  return (
    <Modal onClose={onClose} label={t('ffmpeg_modal_title')} className="cmd-modal">
      <div className="modal-h">
        <div className="modal-t">{t('ffmpeg_modal_title')}</div>
        <button className="icon-btn" type="button" onClick={onClose} aria-label={t('close')}>
          <Ico d={I.x} />
        </button>
      </div>
      <div className="modal-b">
        <p className="dlg-hint">{t('ffmpeg_modal_desc')}</p>
        <pre className="cmd-pre mono">{cmd}</pre>
        <button
          className="btn primary mt12"
          type="button"
          onClick={() => {
            navigator.clipboard?.writeText(cmd);
            onCopy();
          }}
        >
          <Ico d={I.copy} size={12} /> {t('copy_cmd')}
        </button>
      </div>
    </Modal>
  );
}
