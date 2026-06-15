import React, { useMemo, useState } from 'react';
import type { SrtCue } from '@shared/types';
import { computeVisualSync } from '@shared/cue-sync';
import { fmtTimeMs } from '../../lib/format';
import { Ico, I } from '../ui/Icons';
import { useT } from '../../hooks/useTranslation';
import { Modal } from '../ui/Modal';

interface Props {
  cues: SrtCue[];
  previewT: number;
  onSeek: (t: number) => void;
  onApply: (offset: number, speed: number) => void;
  onClose: () => void;
}

export function VisualSyncModal({ cues, previewT, onSeek, onApply, onClose }: Props) {
  const { t } = useT();
  const [startIdx, setStartIdx] = useState(0);
  const [endIdx, setEndIdx] = useState(() => Math.max(0, cues.length - 1));
  const [mediaStart, setMediaStart] = useState<number | null>(null);
  const [mediaEnd, setMediaEnd] = useState<number | null>(null);

  const startCue = cues[startIdx];
  const endCue = cues[endIdx];

  const result = useMemo(() => {
    if (!startCue || !endCue || mediaStart === null || mediaEnd === null) return null;
    return computeVisualSync({
      fileStart: startCue.start,
      fileEnd: endCue.end,
      mediaStart,
      mediaEnd,
    });
  }, [startCue, endCue, mediaStart, mediaEnd]);

  const canApply = result !== null && startIdx <= endIdx;

  return (
    <Modal onClose={onClose} label={t('visual_sync_title')} className="modal-wide">
      <div className="modal-h">
        <div className="modal-t">{t('visual_sync_title')}</div>
        <button className="icon-btn" type="button" onClick={onClose} aria-label={t('close')}>
          <Ico d={I.x} />
        </button>
      </div>
      <div className="modal-b sync-wizard">
        <p className="sync-hint">{t('visual_sync_hint')}</p>

        <div className="sync-block">
          <div className="sync-block-title">{t('visual_sync_start')}</div>
          <label className="sync-field">
            <span>{t('visual_sync_cue')}</span>
            <select
              value={startIdx}
              onChange={(e) => {
                const i = Number(e.target.value);
                setStartIdx(i);
                if (i > endIdx) setEndIdx(i);
              }}
            >
              {cues.map((c, i) => (
                <option key={i} value={i}>
                  #{i + 1} · {fmtTimeMs(c.start)}
                </option>
              ))}
            </select>
          </label>
          {startCue && (
            <div className="sync-cue-preview mono" dir="auto">
              {startCue.text.slice(0, 80)}
              {startCue.text.length > 80 ? '…' : ''}
            </div>
          )}
          <div className="sync-actions">
            <button
              className="btn ghost compact"
              type="button"
              onClick={() => startCue && onSeek(startCue.start)}
            >
              {t('visual_sync_goto_cue')}
            </button>
            <button
              className="btn primary compact"
              type="button"
              onClick={() => setMediaStart(previewT)}
            >
              {t('visual_sync_capture')}
              {mediaStart !== null && <span className="mono"> ({fmtTimeMs(mediaStart)})</span>}
            </button>
          </div>
        </div>

        <div className="sync-block">
          <div className="sync-block-title">{t('visual_sync_end')}</div>
          <label className="sync-field">
            <span>{t('visual_sync_cue')}</span>
            <select
              value={endIdx}
              onChange={(e) => {
                const i = Number(e.target.value);
                setEndIdx(i);
                if (i < startIdx) setStartIdx(i);
              }}
            >
              {cues.map((c, i) => (
                <option key={i} value={i}>
                  #{i + 1} · {fmtTimeMs(c.end)}
                </option>
              ))}
            </select>
          </label>
          {endCue && (
            <div className="sync-cue-preview mono" dir="auto">
              {endCue.text.slice(0, 80)}
              {endCue.text.length > 80 ? '…' : ''}
            </div>
          )}
          <div className="sync-actions">
            <button
              className="btn ghost compact"
              type="button"
              onClick={() => endCue && onSeek(endCue.end)}
            >
              {t('visual_sync_goto_cue')}
            </button>
            <button
              className="btn primary compact"
              type="button"
              onClick={() => setMediaEnd(previewT)}
            >
              {t('visual_sync_capture')}
              {mediaEnd !== null && <span className="mono"> ({fmtTimeMs(mediaEnd)})</span>}
            </button>
          </div>
        </div>

        {result && (
          <div className="sync-preview mono">
            <div>
              {t('knob_offset')}: {result.offset >= 0 ? '+' : ''}
              {result.offset.toFixed(4)}s
            </div>
            <div>
              {t('knob_speed')}: {result.speed.toFixed(6)}x
            </div>
          </div>
        )}

        {mediaStart !== null && mediaEnd !== null && !result && (
          <div className="sync-err">{t('visual_sync_invalid')}</div>
        )}

        <div className="modal-actions">
          <button className="btn ghost" type="button" onClick={onClose}>
            {t('cancel')}
          </button>
          <button
            className="btn primary"
            type="button"
            disabled={!canApply || !result}
            onClick={() => {
              if (result) {
                onApply(result.offset, result.speed);
                onClose();
              }
            }}
          >
            {t('visual_sync_apply')}
          </button>
        </div>
      </div>
    </Modal>
  );
}
