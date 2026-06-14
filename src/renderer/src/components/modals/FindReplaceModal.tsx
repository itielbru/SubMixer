import React, { useMemo, useState } from 'react';
import type { SrtCue } from '@shared/types';
import { Ico, I } from '../ui/Icons';
import { useT } from '../../hooks/useTranslation';
import { Modal } from '../ui/Modal';

interface Props {
  cues: SrtCue[];
  selectedIdx: number;
  onApply: (cues: SrtCue[]) => void;
  onDuplicate: (idx: number) => void;
  onClose: () => void;
}

export function FindReplaceModal({
  cues,
  selectedIdx,
  onApply,
  onDuplicate,
  onClose,
}: Props) {
  const { t } = useT();
  const [find, setFind] = useState('');
  const [replace, setReplace] = useState('');
  const [fromSelected, setFromSelected] = useState(false);

  const matchCount = useMemo(() => {
    if (!find) return 0;
    let n = 0;
    const start = fromSelected && selectedIdx >= 0 ? selectedIdx : 0;
    for (let i = start; i < cues.length; i++) {
      if (cues[i].text.includes(find)) n++;
    }
    return n;
  }, [cues, find, fromSelected, selectedIdx]);

  const doReplaceAll = (): void => {
    if (!find) return;
    const start = fromSelected && selectedIdx >= 0 ? selectedIdx : 0;
    const next = cues.map((c, i) => {
      if (i < start) return c;
      if (!c.text.includes(find)) return c;
      return { ...c, text: c.text.split(find).join(replace) };
    });
    onApply(next);
  };

  return (
    <Modal onClose={onClose} label={t('find_replace_title')}>
      <div className="modal-h">
        <div className="modal-t">{t('find_replace_title')}</div>
        <button className="icon-btn" type="button" onClick={onClose}>
          <Ico d={I.x} />
        </button>
      </div>
      <div className="modal-b">
        <label className="field">
          <span>{t('find_replace_find')}</span>
          <input value={find} onChange={(e) => setFind(e.target.value)} />
        </label>
        <label className="field">
          <span>{t('find_replace_replace')}</span>
          <input value={replace} onChange={(e) => setReplace(e.target.value)} />
        </label>
        <label className="cb">
          <span
            className={`cb-box ${fromSelected ? 'on' : ''}`}
            onClick={() => setFromSelected((v) => !v)}
          >
            {fromSelected && <Ico d={I.check} size={10} />}
          </span>
          <span onClick={() => setFromSelected((v) => !v)}>
            {t('find_replace_from_selected')}
          </span>
        </label>
        {find && (
          <div className="small mono mt8">
            {t('find_replace_matches')}: {matchCount}
          </div>
        )}

        <div className="modal-actions">
          <button className="btn ghost" type="button" onClick={onClose}>
            {t('cancel')}
          </button>
          <button
            className="btn ghost"
            type="button"
            disabled={selectedIdx < 0}
            onClick={() => {
              onDuplicate(selectedIdx);
              onClose();
            }}
          >
            {t('duplicate_cue')}
          </button>
          <button
            className="btn primary"
            type="button"
            disabled={!find || matchCount === 0}
            onClick={() => {
              doReplaceAll();
              onClose();
            }}
          >
            {t('find_replace_apply')}
          </button>
        </div>
      </div>
    </Modal>
  );
}
