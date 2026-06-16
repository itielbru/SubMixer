import React, { useRef, useState } from 'react';
import type { CueWarningThresholds, SrtCue } from '@shared/types';
import { Ico, I } from './ui/Icons';
import { fmtTimeMs } from '../lib/format';
import { BIDI_CHARS, reverseRtlPunctuation } from '../lib/rtl';
import { computeWarnings } from '../lib/cue-warnings';
import { warningReasonText } from '../lib/warning-text';
import { useT } from '../hooks/useTranslation';

interface Props {
  cues: SrtCue[];
  selectedIdx: number;
  warnThresholds: CueWarningThresholds;
  onSelect: (idx: number) => void;
  onUpdateCue: (idx: number, patch: Partial<SrtCue>) => void;
  onDeleteCue: (idx: number) => void;
  onSeek: (t: number) => void;
  rtl?: boolean;
}

const NUDGE_BIG = 0.05;
const NUDGE_SMALL = 0.01;

export function CueEditor({
  cues,
  selectedIdx,
  warnThresholds,
  onSelect,
  onUpdateCue,
  onDeleteCue,
  onSeek,
  rtl,
}: Props) {
  const { t } = useT();
  const textRef = useRef<HTMLTextAreaElement | null>(null);
  const [showBidi, setShowBidi] = useState(false);
  if (selectedIdx < 0 || !cues[selectedIdx]) return null;
  const cue = cues[selectedIdx];
  const prev = cues[selectedIdx - 1];
  const next = cues[selectedIdx + 1];
  const w = computeWarnings(cue, prev, next, warnThresholds);
  const reasonText = warningReasonText(w, t);

  const nudge = (target: 'start' | 'end' | 'both', delta: number) => {
    const minDur = 0.05;
    if (target === 'start') {
      const newStart = Math.max(prev ? prev.end : 0, Math.min(cue.end - minDur, cue.start + delta));
      onUpdateCue(selectedIdx, { start: newStart });
    } else if (target === 'end') {
      const newEnd = Math.max(
        cue.start + minDur,
        Math.min(next ? next.start : Infinity, cue.end + delta),
      );
      onUpdateCue(selectedIdx, { end: newEnd });
    } else {
      const span = cue.end - cue.start;
      const minS = prev ? prev.end : 0;
      const maxS = (next ? next.start : Infinity) - span;
      const newStart = Math.max(minS, Math.min(maxS, cue.start + delta));
      onUpdateCue(selectedIdx, { start: newStart, end: newStart + span });
    }
  };

  const goTo = (idx: number) => {
    if (idx < 0 || idx >= cues.length) return;
    onSelect(idx);
    onSeek(cues[idx].start);
  };

  const insertAtCursor = (chunk: string): void => {
    const ta = textRef.current;
    if (!ta) return;
    const start = ta.selectionStart;
    const end = ta.selectionEnd;
    const text = ta.value;
    const next = text.slice(0, start) + chunk + text.slice(end);
    onUpdateCue(selectedIdx, { text: next });
    // Restore caret after React applies the new value
    setTimeout(() => {
      if (textRef.current) {
        textRef.current.focus();
        const pos = start + chunk.length;
        textRef.current.setSelectionRange(pos, pos);
      }
    }, 0);
  };

  const doReversePunct = (): void => {
    onUpdateCue(selectedIdx, { text: reverseRtlPunctuation(cue.text) });
  };

  return (
    <div className="ce">
      <div className="ce-head">
        <div className="ce-title">
          <span className="ce-num mono">#{selectedIdx + 1}</span>
          <span className="ce-total mono">/ {cues.length}</span>
          {w.level !== 'ok' && (
            <span className={`ce-warn lvl-${w.level}`} title={reasonText}>
              {w.level === 'err' ? '⛔' : '⚠'} {reasonText}
            </span>
          )}
        </div>
        <div className="ce-nav">
          <button
            className="vp-btn"
            type="button"
            onClick={() => goTo(selectedIdx - 1)}
            disabled={selectedIdx <= 0}
            title="cue הקודם"
          >
            <Ico d={I.arrowR} size={11} />
          </button>
          <button
            className="vp-btn"
            type="button"
            onClick={() => onSeek(cue.start)}
            title="קפוץ להתחלת ה־cue"
          >
            ⤓
          </button>
          <button
            className="vp-btn"
            type="button"
            onClick={() => goTo(selectedIdx + 1)}
            disabled={selectedIdx >= cues.length - 1}
            title="cue הבא"
          >
            <Ico d={I.arrowL} size={11} />
          </button>
        </div>
        <button
          className="vp-btn danger"
          type="button"
          onClick={() => onDeleteCue(selectedIdx)}
          title="מחק (Delete)"
        >
          <Ico d={I.trash} size={12} />
        </button>
      </div>

      <textarea
        ref={textRef}
        className="ce-text-edit"
        dir={rtl ? 'rtl' : 'ltr'}
        value={cue.text}
        onChange={(e) => onUpdateCue(selectedIdx, { text: e.target.value })}
        rows={2}
      />

      <div className="ce-text-tools">
        <button
          className="speed-btn"
          type="button"
          onClick={() => setShowBidi((v) => !v)}
          title="תווי כיוון (LRM/RLM/...)"
        >
          {showBidi ? '−' : '+'} כיוון
        </button>
        {showBidi && (
          <div className="ce-bidi">
            {(Object.keys(BIDI_CHARS) as Array<keyof typeof BIDI_CHARS>).map((k) => (
              <button
                key={k}
                className="bidi-btn mono"
                type="button"
                onClick={() => insertAtCursor(BIDI_CHARS[k])}
                title={k}
              >
                {k}
              </button>
            ))}
          </div>
        )}
        <button
          className="speed-btn"
          type="button"
          onClick={doReversePunct}
          title="הזז סוגריים/פיסוק לצד הנכון ב־RTL"
        >
          תקן פיסוק RTL
        </button>
      </div>

      <div className="ce-grid">
        <div className="ce-row">
          <span className="ce-label">התחלה</span>
          <span className="ce-time mono">{fmtTimeMs(cue.start)}</span>
          <div className="ce-nudges">
            <button className="nudge" type="button" onClick={() => nudge('start', -NUDGE_BIG)}>
              −50
            </button>
            <button className="nudge" type="button" onClick={() => nudge('start', -NUDGE_SMALL)}>
              −10
            </button>
            <button className="nudge" type="button" onClick={() => nudge('start', NUDGE_SMALL)}>
              +10
            </button>
            <button className="nudge" type="button" onClick={() => nudge('start', NUDGE_BIG)}>
              +50
            </button>
          </div>
        </div>
        <div className="ce-row">
          <span className="ce-label">סיום</span>
          <span className="ce-time mono">{fmtTimeMs(cue.end)}</span>
          <div className="ce-nudges">
            <button className="nudge" type="button" onClick={() => nudge('end', -NUDGE_BIG)}>
              −50
            </button>
            <button className="nudge" type="button" onClick={() => nudge('end', -NUDGE_SMALL)}>
              −10
            </button>
            <button className="nudge" type="button" onClick={() => nudge('end', NUDGE_SMALL)}>
              +10
            </button>
            <button className="nudge" type="button" onClick={() => nudge('end', NUDGE_BIG)}>
              +50
            </button>
          </div>
        </div>
        <div className="ce-row">
          <span className="ce-label">שניהם</span>
          <span className="ce-time mono">
            {(cue.end - cue.start).toFixed(2)}s · {w.cps > 0 ? w.cps.toFixed(0) : '—'} CPS
          </span>
          <div className="ce-nudges">
            <button className="nudge" type="button" onClick={() => nudge('both', -NUDGE_BIG)}>
              −50
            </button>
            <button className="nudge" type="button" onClick={() => nudge('both', -NUDGE_SMALL)}>
              −10
            </button>
            <button className="nudge" type="button" onClick={() => nudge('both', NUDGE_SMALL)}>
              +10
            </button>
            <button className="nudge" type="button" onClick={() => nudge('both', NUDGE_BIG)}>
              +50
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
