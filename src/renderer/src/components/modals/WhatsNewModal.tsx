import React from 'react';
import { CHANGELOG_NOTES } from '@shared/changelog-notes';
import { Ico, I } from '../ui/Icons';
import { useT } from '../../hooks/useTranslation';
import { Modal } from '../ui/Modal';

interface Props {
  version: string;
  onClose: () => void;
}

export function WhatsNewModal({ version, onClose }: Props) {
  const { t } = useT();
  const notes = CHANGELOG_NOTES[version];

  return (
    <Modal onClose={onClose} label={t('whatsnew_title')}>
      <div className="modal-h">
        <div className="modal-t">
          {t('whatsnew_title')} — v{version}
        </div>
        <button className="icon-btn" type="button" onClick={onClose} aria-label={t('close')}>
          <Ico d={I.x} />
        </button>
      </div>
      <div className="modal-b">
        {notes && notes.length > 0 ? (
          <ul className="whatsnew-list">
            {notes.map((note, i) => (
              <li key={i} className="whatsnew-item">
                {note}
              </li>
            ))}
          </ul>
        ) : (
          <p className="whatsnew-empty">{t('whatsnew_no_notes')}</p>
        )}
        <div className="whatsnew-footer">
          <button className="btn primary" type="button" onClick={onClose}>
            {t('ok')}
          </button>
        </div>
      </div>
    </Modal>
  );
}
