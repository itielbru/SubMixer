import React, { useMemo, useState } from 'react';
import type { SrtCue } from '@shared/types';
import { fixOverlapsAndShortGaps } from '../../lib/fix-timing';
import { Ico, I } from '../ui/Icons';
import { useT } from '../../hooks/useTranslation';
import type { I18nKey } from '@shared/i18n';
import { Modal } from '../ui/Modal';

interface Props {
  cues: SrtCue[];
  minGapSec: number;
  onApply: (cues: SrtCue[]) => void;
  onClose: () => void;
}

function formatChange(
  t: (key: I18nKey) => string,
  kind: 'overlap' | 'gap',
  lineA: number,
  lineB: number,
  time: number,
): string {
  const key: I18nKey = kind === 'overlap' ? 'fix_preview_overlap' : 'fix_preview_gap';
  return t(key)
    .replace('{a}', String(lineA))
    .replace('{b}', String(lineB))
    .replace('{time}', time.toFixed(3));
}

export function FixCommonErrorsModal({ cues, minGapSec, onApply, onClose }: Props) {
  const { t } = useT();
  const [fixOverlaps, setFixOverlaps] = useState(true);
  const [fixGaps, setFixGaps] = useState(true);

  const preview = useMemo(
    () =>
      fixOverlapsAndShortGaps(cues, {
        fixOverlaps,
        fixGaps,
        minGapSec,
      }),
    [cues, minGapSec, fixOverlaps, fixGaps],
  );

  const readableChanges = useMemo(
    () => preview.changes.map((c) => formatChange(t, c.kind, c.lineA, c.lineB, c.newStartSec)),
    [preview.changes, t],
  );

  return (
    <Modal onClose={onClose} label={t('fix_errors_title')} className="modal-wide">
      <div className="modal-h">
        <div className="modal-t">{t('fix_errors_title')}</div>
        <button className="icon-btn" type="button" onClick={onClose}>
          <Ico d={I.x} />
        </button>
      </div>
      <div className="modal-b">
        <p className="sync-hint">{t('fix_errors_hint')}</p>
        <label className="cb">
          <span
            className={`cb-box ${fixOverlaps ? 'on' : ''}`}
            onClick={() => setFixOverlaps((v) => !v)}
          >
            {fixOverlaps && <Ico d={I.check} size={10} />}
          </span>
          <span onClick={() => setFixOverlaps((v) => !v)}>{t('fix_errors_overlaps')}</span>
        </label>
        <label className="cb">
          <span className={`cb-box ${fixGaps ? 'on' : ''}`} onClick={() => setFixGaps((v) => !v)}>
            {fixGaps && <Ico d={I.check} size={10} />}
          </span>
          <span onClick={() => setFixGaps((v) => !v)}>{t('fix_errors_gaps')}</span>
        </label>

        <div className="fix-preview mt12">
          <div className="fix-preview-title">
            {t('fix_errors_changes')}: {readableChanges.length}
          </div>
          {readableChanges.length === 0 ? (
            <div className="small">{t('fix_errors_none')}</div>
          ) : (
            <ul className="fix-list">
              {readableChanges.map((line, i) => (
                <li key={i}>{line}</li>
              ))}
            </ul>
          )}
        </div>

        <div className="modal-actions">
          <button className="btn ghost" type="button" onClick={onClose}>
            {t('cancel')}
          </button>
          <button
            className="btn primary"
            type="button"
            disabled={readableChanges.length === 0}
            onClick={() => {
              onApply(preview.cues);
              onClose();
            }}
          >
            {t('fix_errors_apply')}
          </button>
        </div>
      </div>
    </Modal>
  );
}
