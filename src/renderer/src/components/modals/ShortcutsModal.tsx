import React, { useCallback, useEffect, useState } from 'react';
import { Ico, I } from '../ui/Icons';
import { useT } from '../../hooks/useTranslation';
import type { I18nKey } from '@shared/i18n';
import { Modal } from '../ui/Modal';

interface Row {
  keys: string;
  labelKey: I18nKey;
}

const FIXED_ROWS: Row[] = [
  { keys: 'Space', labelKey: 'shortcut_play' },
  { keys: '← / →', labelKey: 'shortcut_prev_cue' },
  { keys: 'Shift+← / →', labelKey: 'shortcut_seek_100ms_back' },
  { keys: 'Alt+← / →', labelKey: 'shortcut_seek_10ms_back' },
  { keys: 'Ctrl+← / →', labelKey: 'shortcut_seek_1s_back' },
  { keys: 'Ctrl+Z', labelKey: 'shortcut_undo' },
  { keys: 'Ctrl+Y', labelKey: 'shortcut_redo' },
  { keys: '?', labelKey: 'shortcut_help' },
];

interface Rebindable {
  id: string;
  defaultKey: string;
  labelKey: I18nKey;
}

const REBINDABLE: Rebindable[] = [
  { id: 'set_start', defaultKey: 'F11', labelKey: 'shortcut_set_start' },
  { id: 'set_end', defaultKey: 'F12', labelKey: 'shortcut_set_end' },
  { id: 'insert_cue', defaultKey: 'Insert', labelKey: 'shortcut_insert_cue' },
  { id: 'delete_cue', defaultKey: 'Delete', labelKey: 'shortcut_delete' },
  { id: 'loop', defaultKey: 'Ctrl+L', labelKey: 'shortcut_loop' },
];

function fmtKey(raw: string, defaultKey: string): string {
  if (!raw) return defaultKey;
  return raw.charAt(0).toUpperCase() + raw.slice(1);
}

interface Props {
  keybindings?: Partial<Record<string, string>>;
  onSaveKeybinding?: (id: string, key: string) => void;
  onResetKeybinding?: (id: string) => void;
  onClose: () => void;
}

export function ShortcutsModal({
  keybindings = {},
  onSaveKeybinding,
  onResetKeybinding,
  onClose,
}: Props) {
  const { t } = useT();
  const [capturing, setCapturing] = useState<string | null>(null);

  const startCapture = (id: string) => setCapturing(id);

  const cancelCapture = useCallback(() => setCapturing(null), []);

  useEffect(() => {
    if (!capturing) return;
    const onKey = (e: KeyboardEvent) => {
      e.preventDefault();
      e.stopPropagation();
      if (e.key === 'Escape') {
        setCapturing(null);
        return;
      }
      // Ignore modifier-only presses
      if (['Control', 'Shift', 'Alt', 'Meta'].includes(e.key)) return;
      const key = e.key.toLowerCase() === ' ' ? 'space' : e.key.toLowerCase();
      onSaveKeybinding?.(capturing, key);
      setCapturing(null);
    };
    window.addEventListener('keydown', onKey, { capture: true });
    return () => window.removeEventListener('keydown', onKey, { capture: true });
  }, [capturing, onSaveKeybinding]);

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
          {FIXED_ROWS.map((r) => (
            <React.Fragment key={r.keys}>
              <kbd className="kbd">{r.keys}</kbd>
              <span className="kbd-label">{t(r.labelKey)}</span>
            </React.Fragment>
          ))}
        </div>
        {onSaveKeybinding && (
          <>
            <div className="kbd-section-label">{t('shortcuts_rebindable')}</div>
            <div className="kbd-grid kbd-rebind-grid">
              {REBINDABLE.map((r) => {
                const currentKey = keybindings[r.id];
                const displayKey = fmtKey(currentKey ?? '', r.defaultKey);
                const isCapturing = capturing === r.id;
                const isCustom = !!currentKey;
                return (
                  <React.Fragment key={r.id}>
                    <button
                      className={`kbd kbd-btn ${isCapturing ? 'capturing' : ''}`}
                      type="button"
                      onClick={() => (isCapturing ? cancelCapture() : startCapture(r.id))}
                      title={t('shortcuts_click_to_rebind')}
                    >
                      {isCapturing ? t('shortcuts_press_key') : displayKey}
                    </button>
                    <span className="kbd-label">
                      {t(r.labelKey)}
                      {isCustom && (
                        <button
                          className="kbd-reset-btn"
                          type="button"
                          onClick={() => onResetKeybinding?.(r.id)}
                          title={t('shortcuts_reset')}
                        >
                          ↺
                        </button>
                      )}
                    </span>
                  </React.Fragment>
                );
              })}
            </div>
          </>
        )}
      </div>
    </Modal>
  );
}
