import React, { useState } from 'react';
import { Ico, I } from '../ui/Icons';
import { useT } from '../../hooks/useTranslation';
import { Modal } from '../ui/Modal';

interface Props {
  cueCount: number;
  selectedCueIdx: number;
  onApply: (deltaSec: number, fromIdx: number, speed: number) => void;
  onClose: () => void;
}

export function AdjustAllTimesModal({ cueCount, selectedCueIdx, onApply, onClose }: Props) {
  const { t } = useT();
  const [ms, setMs] = useState(0);
  const [speed, setSpeed] = useState(1);
  const [partial, setPartial] = useState(false);
  const [fromIdx, setFromIdx] = useState(() => (selectedCueIdx >= 0 ? selectedCueIdx : 0));

  const apply = (): void => {
    onApply(ms / 1000, partial ? fromIdx : 0, speed);
    onClose();
  };

  return (
    <Modal onClose={onClose} label={t('adjust_all_times_title')}>
      <div className="modal-h">
        <div className="modal-t">{t('adjust_all_times_title')}</div>
        <button className="icon-btn" type="button" onClick={onClose}>
          <Ico d={I.x} />
        </button>
      </div>
      <div className="modal-b">
        <p className="sync-hint">{t('adjust_all_times_hint')}</p>
        <label className="field">
          <span>{t('adjust_all_times_ms')}</span>
          <input
            type="number"
            step={50}
            value={ms}
            onChange={(e) => setMs(Number(e.target.value) || 0)}
          />
        </label>
        <div className="quick-row">
          <button className="btn ghost compact" type="button" onClick={() => setMs((v) => v - 500)}>
            −500
          </button>
          <button className="btn ghost compact" type="button" onClick={() => setMs((v) => v - 100)}>
            −100
          </button>
          <button className="btn ghost compact" type="button" onClick={() => setMs(0)}>
            0
          </button>
          <button className="btn ghost compact" type="button" onClick={() => setMs((v) => v + 100)}>
            +100
          </button>
          <button className="btn ghost compact" type="button" onClick={() => setMs((v) => v + 500)}>
            +500
          </button>
        </div>

        <label className="field" style={{ marginTop: 14 }}>
          <span>{t('adjust_all_speed')}</span>
          <input
            type="number"
            min={0.5}
            max={2}
            step={0.01}
            value={speed}
            onChange={(e) => setSpeed(Math.min(2, Math.max(0.5, Number(e.target.value) || 1)))}
          />
        </label>
        <div className="quick-row">
          <button
            className="btn ghost compact"
            type="button"
            onClick={() => setSpeed((v) => Math.max(0.5, Math.round((v - 0.05) * 100) / 100))}
          >
            −5%
          </button>
          <button
            className="btn ghost compact"
            type="button"
            onClick={() => setSpeed((v) => Math.max(0.5, Math.round((v - 0.01) * 100) / 100))}
          >
            −1%
          </button>
          <button className="btn ghost compact" type="button" onClick={() => setSpeed(1)}>
            1×
          </button>
          <button
            className="btn ghost compact"
            type="button"
            onClick={() => setSpeed((v) => Math.min(2, Math.round((v + 0.01) * 100) / 100))}
          >
            +1%
          </button>
          <button
            className="btn ghost compact"
            type="button"
            onClick={() => setSpeed((v) => Math.min(2, Math.round((v + 0.05) * 100) / 100))}
          >
            +5%
          </button>
        </div>

        <label className="cb mt12">
          <span className={`cb-box ${partial ? 'on' : ''}`} onClick={() => setPartial((p) => !p)}>
            {partial && <Ico d={I.check} size={10} />}
          </span>
          <span onClick={() => setPartial((p) => !p)}>{t('adjust_all_times_partial')}</span>
        </label>

        {partial && (
          <label className="field">
            <span>{t('adjust_all_times_from_cue')}</span>
            <select value={fromIdx} onChange={(e) => setFromIdx(Number(e.target.value))}>
              {Array.from({ length: cueCount }, (_, i) => (
                <option key={i} value={i}>
                  #{i + 1}
                </option>
              ))}
            </select>
          </label>
        )}

        <div className="modal-actions">
          <button className="btn ghost" type="button" onClick={onClose}>
            {t('cancel')}
          </button>
          <button className="btn primary" type="button" onClick={apply}>
            {t('ok')}
          </button>
        </div>
      </div>
    </Modal>
  );
}
