import React from 'react';
import { Ico, I } from '../ui/Icons';
import { useT } from '../../hooks/useTranslation';
import type { I18nKey } from '@shared/i18n';
import { Modal } from '../ui/Modal';

interface Row {
  keys: string;
  labelKey: I18nKey;
}

const ROWS: Row[] = [
  { keys: 'Space', labelKey: 'shortcut_play' },
  { keys: '← / →', labelKey: 'shortcut_prev_cue' },
  { keys: 'Shift+← / →', labelKey: 'shortcut_seek_100ms_back' },
  { keys: 'Alt+← / →', labelKey: 'shortcut_seek_10ms_back' },
  { keys: 'Ctrl+← / →', labelKey: 'shortcut_seek_1s_back' },
  { keys: 'F11', labelKey: 'shortcut_set_start' },
  { keys: 'F12', labelKey: 'shortcut_set_end' },
  { keys: 'Insert', labelKey: 'shortcut_insert_cue' },
  { keys: 'Delete', labelKey: 'shortcut_delete' },
  { keys: 'Ctrl+Z', labelKey: 'shortcut_undo' },
  { keys: 'Ctrl+Y', labelKey: 'shortcut_redo' },
  { keys: 'Ctrl+L', labelKey: 'shortcut_loop' },
  { keys: '?', labelKey: 'shortcut_help' },
];

interface Props {
  onClose: () => void;
}

export function ShortcutsModal({ onClose }: Props) {
  const { t } = useT();
  return (
    <Modal onClose={onClose} label={t('shortcuts_title')}>
      <div className="modal-h">
        <div className="modal-t">{t('shortcuts_title')}</div>
        <button className="icon-btn" type="button" onClick={onClose} aria-label={t('close')}>
          <Ico d={I.x} />
        </button>
      </div>
      <div className="modal-b">
        <div className="kbd-grid">
          {ROWS.map((r) => (
            <React.Fragment key={r.keys}>
              <kbd className="kbd">{r.keys}</kbd>
              <span className="kbd-label">{t(r.labelKey)}</span>
            </React.Fragment>
          ))}
        </div>
      </div>
    </Modal>
  );
}
