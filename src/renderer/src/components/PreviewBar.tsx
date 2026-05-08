import React from 'react';
import type { SrtCue } from '@shared/types';
import { Ico, I } from './ui/Icons';
import { fmtTime, fmtTimeMs } from '../lib/format';
import { Waveform } from './Waveform';

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
  /** Source for waveform peaks */
  filePath: string | null;
  audioTrackIndex: number | null;
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
  filePath,
  audioTrackIndex,
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
        <div className="pv-wave-wrap">
          <Waveform
            filePath={filePath}
            audioTrackIndex={audioTrackIndex}
            durationSec={dur}
            previewT={previewT}
            cues={cues}
            onSeek={onPreviewT}
          />
        </div>
        <div className="pv-time mono faint">{fmtTime(durationSec)}</div>
      </div>
      <div className="pv-cue">
        <div className="pv-cue-row">
          <span className="pv-cue-label">מקורי</span>
          <div className="pv-cue-nav">
            <button
              type="button"
              className="icon-btn small ghost"
              disabled={cues.length === 0}
              title="הכתובית הקודמת"
              onClick={() => {
                const prev = [...cues].reverse().find((c) => c.start < previewT - 0.05);
                if (prev) onPreviewT(prev.start);
              }}
            >
              ‹
            </button>
            <button
              type="button"
              className="icon-btn small ghost"
              disabled={cues.length === 0}
              title="הכתובית הבאה"
              onClick={() => {
                const next = cues.find((c) => c.start > previewT + 0.05);
                if (next) onPreviewT(next.start);
              }}
            >
              ›
            </button>
          </div>
          <span
            className={`pv-cue-time mono ${currentCue ? 'jumpable' : ''}`}
            title={currentCue ? 'קפוץ לתחילת הכתובית' : ''}
            onClick={() => currentCue && onPreviewT(currentCue.start)}
          >
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
