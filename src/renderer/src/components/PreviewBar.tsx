import React from 'react';
import type { SrtCue } from '@shared/types';
import { Ico, I } from './ui/Icons';
import { fmtTime, fmtTimeMs } from '../lib/format';

interface Props {
  durationSec: number;
  previewT: number;
  onPreviewT: (t: number) => void;
  playing: boolean;
  onTogglePlay: () => void;
  prepLoading: boolean;
  prepPct: number;
  audioReady: boolean;
  audioRef: React.RefObject<HTMLAudioElement>;
  audioUrl: string | null;
  cues: SrtCue[];
  /** Sub offset / speed — adjust displayed sync row */
  subOffset: number;
  subSpeed: number;
}

function findCue(cues: SrtCue[], t: number): SrtCue | undefined {
  return cues.find((c) => t >= c.start && t <= c.end);
}

export function PreviewBar({
  durationSec,
  previewT,
  onPreviewT,
  playing,
  onTogglePlay,
  prepLoading,
  prepPct,
  audioReady,
  audioRef,
  audioUrl,
  cues,
  subOffset,
  subSpeed,
}: Props) {
  const currentCue = findCue(cues, previewT);
  const adjT = previewT * subSpeed + subOffset;
  const adjCue = findCue(cues, adjT);
  const idx = currentCue ? cues.indexOf(currentCue) : -1;
  const dur = Math.max(0.001, durationSec);

  return (
    <div className="preview-bar">
      <audio ref={audioRef} src={audioUrl || undefined} preload="auto" />

      <div className="pv-head">
        <div className="pv-title">תצוגה מקדימה · אודיו + כתוביות</div>
        <div className="pv-info mono">
          {prepLoading && <>מכין אודיו… {Math.round(prepPct)}%</>}
          {!prepLoading && currentCue && (
            <>
              Cue {idx + 1}/{cues.length}
            </>
          )}
          {!prepLoading && !currentCue && cues.length > 0 && '—'}
          {!prepLoading && cues.length === 0 && 'אין SRT נטען'}
        </div>
      </div>
      <div className="pv-body">
        <button
          className="pv-play"
          type="button"
          disabled={prepLoading || !audioReady}
          onClick={onTogglePlay}
          title={audioReady ? '' : 'בחר מסלול אודיו ולחץ לחילוץ תצוגה'}
        >
          <Ico d={playing ? I.pause : I.play} size={14} />
        </button>
        <div className="pv-time mono">{fmtTime(previewT)}</div>
        <div
          className="pv-scrub"
          onPointerDown={(e) => {
            const el = e.currentTarget;
            el.setPointerCapture(e.pointerId);
            const update = (clientX: number) => {
              const r = el.getBoundingClientRect();
              const ratio = Math.max(0, Math.min(1, (r.right - clientX) / r.width));
              onPreviewT(ratio * dur);
            };
            update(e.clientX);
            const move = (ev: PointerEvent) => update(ev.clientX);
            const up = () => {
              el.removeEventListener('pointermove', move);
              el.removeEventListener('pointerup', up);
              el.removeEventListener('pointercancel', up);
            };
            el.addEventListener('pointermove', move);
            el.addEventListener('pointerup', up);
            el.addEventListener('pointercancel', up);
          }}
        >
          <div className="pv-track"></div>
          <div
            className="pv-fill"
            style={{ insetInlineStart: 0, width: `${(previewT / dur) * 100}%` }}
          ></div>
          <div
            className="pv-thumb"
            style={{ insetInlineStart: `${(previewT / dur) * 100}%` }}
          ></div>
          {cues.map((c, i) => (
            <div
              key={i}
              className="pv-tick"
              style={{ insetInlineStart: `${(c.start / dur) * 100}%` }}
            />
          ))}
        </div>
        <div className="pv-time mono faint">{fmtTime(durationSec)}</div>
      </div>
      <div className="pv-cue">
        <div className="pv-cue-row">
          <span className="pv-cue-label">מקורי</span>
          <span className="pv-cue-time mono">
            {currentCue
              ? `${fmtTimeMs(currentCue.start)} → ${fmtTimeMs(currentCue.end)}`
              : '—'}
          </span>
          <span className="pv-cue-text">{currentCue ? currentCue.text : 'אין כתובית בנקודה זו'}</span>
        </div>
        {(subOffset !== 0 || subSpeed !== 1) && (
          <div className="pv-cue-row adj">
            <span className="pv-cue-label">מסונכרן</span>
            <span className="pv-cue-time mono">
              {adjCue
                ? `${fmtTimeMs(adjCue.start)} → ${fmtTimeMs(adjCue.end)}`
                : '—'}
            </span>
            <span className="pv-cue-text">{adjCue ? adjCue.text : '—'}</span>
          </div>
        )}
      </div>
    </div>
  );
}
