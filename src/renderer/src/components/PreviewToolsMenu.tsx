import React, { useEffect, useRef, useState } from 'react';
import { useT } from '../hooks/useTranslation';

interface Props {
  disabled?: boolean;
  canDelete: boolean;
  onFindReplace: () => void;
  onAdjustAllTimes: () => void;
  onDuplicate: () => void;
  onDelete: () => void;
}

export function PreviewToolsMenu({
  disabled,
  canDelete,
  onFindReplace,
  onAdjustAllTimes,
  onDuplicate,
  onDelete,
}: Props) {
  const { t } = useT();
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onDoc = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', onDoc);
    return () => document.removeEventListener('mousedown', onDoc);
  }, [open]);

  const pick = (fn: () => void) => {
    setOpen(false);
    fn();
  };

  return (
    <div className={`tools-dd ${open ? 'open' : ''}`} ref={ref}>
      <button
        type="button"
        className="speed-btn"
        disabled={disabled}
        onClick={() => setOpen((v) => !v)}
        title={t('tools_menu_btn')}
      >
        {t('tools_menu_btn')}
      </button>
      {open && (
        <div className="tools-dd-menu">
          <div className="tools-dd-cat">{t('tools_cat_text')}</div>
          <button type="button" className="tools-dd-item" onClick={() => pick(onFindReplace)}>
            {t('find_replace_btn')}
          </button>
          <div className="tools-dd-div" />
          <div className="tools-dd-cat">{t('tools_cat_timing')}</div>
          <button type="button" className="tools-dd-item" onClick={() => pick(onAdjustAllTimes)}>
            {t('adjust_all_times_btn')}
          </button>
          <div className="tools-dd-div" />
          <div className="tools-dd-cat">{t('tools_cat_rows')}</div>
          <button type="button" className="tools-dd-item" onClick={() => pick(onDuplicate)}>
            {t('duplicate_cue')}
          </button>
          <button
            type="button"
            className="tools-dd-item danger"
            disabled={!canDelete}
            onClick={() => pick(onDelete)}
          >
            {t('tools_delete_cue')}
          </button>
        </div>
      )}
    </div>
  );
}
