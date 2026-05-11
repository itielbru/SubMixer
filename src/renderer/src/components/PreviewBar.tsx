import React, { useRef, useState } from 'react';
import type { SrtCue } from '@shared/types';
import { Ico, I } from './ui/Icons';
import { fmtTime, fmtTimeMs } from '../lib/format';
import { Waveform, type SyncMode } from './Waveform';

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
  subOffset: number;
  subSpeed: number;
  filePath: string | null;
  audioTrackIndex: number | null;
  activeSubId: string | null;
  onShiftAll: (delta: number) => void;
  onShiftCue: (cueIdx: number, dStart: number, dEnd: number) => void;
  onClearCueOverrides: () => void;
  hasCueOverrides: boolean;
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
  onShiftAll,
  onShiftCue,
  onClearCueOverrides,
  hasCueOverrides,
}: Props) {
  const [mode, setMode] = useState<SyncMode>('track');
  const dragBaseRef = useRef<number>(0);
  const cueDragBaseRef = useRef<{ cueIdx: number; origDStart: number; origDEnd: number } | null>(null);

  const currentCue = findCue(cues, previewT);
  const adjT = previewT * subSpeed + subOffset;
  const adjCue = findCue(cues, adjT);
  const idx = currentCue ? cues.indexOf(currentCue) : -1;
  const dur = Math.max(0.001, durationSec);

  const handleTrackDelta = (delta: number, phase: 'start' | 'move' | 'end') => {
    if (phase === 'start') {
      dragBaseRef.current = subOffset;
    }
    if (phase === 'move' || phase === 'end') {
      onShiftAll(dragBaseRef.current + delta);
    }
  };

  const handleCueDelta = (cueIdx: number, delta: number, phase: 'start' | 'move' | 'end') => {
    if (phase === 'start') {
      cueDragBaseRef.current = { cueIdx, origDStart: 0, origDEnd: 0 };
    }
    if ((phase === 'move' || phase === 'end') && cueDragBaseRef.current) {
      onShiftCue(cueIdx, cueDragBaseRef.current.origDStart + delta, cueDragBaseRef.current.origDEnd + delta);
    }
  };

  return (
    <div className="preview-bar">
      <audio ref={audioRef} src={audioUrl || undefined} preload="auto" />

      <div className="pv-head">
        <div className="pv-title">תצוגה מקדימה · אודיו + כתוביות</div>
        <div className="pv-mode-seg">
          <button
            type="button"
            className={`pv-mode-btn ${mode === 'scrub' ? 'active' : ''}`}
            onClick={() => setMode('scrub' as SyncMode)}
            title="גלילה בלבד"
          >גלול</button>
          <button
            type="button"
            className={`pv-mode-btn ${mode === 'track' ? 'active' : ''}`}
            onClick={() => setMode('track')}
            title="גרור כתובית = זזת כל הכתוביות"
          >טרק</button>
          <button
            type="button"
            className={`pv-mode-btn ${mode === 'cue' ? 'active' : ''}`}
            onClick={() => setMode('cue')}
            title="גרור משפט = תיקון נקודתי"
          >משפט</button>
        </div>
        {hasCueOverrides && (
          <button
            className="btn ghost compact"
            type="button"
            onClick={onClearCueOverrides}
            title="אפס תיקוני זמן פר-משפט"
          >
            <Ico d={I.reset} size={11} /> אפס פר-cue
          </button>
        )}
        <div className="pv-info mono">
          {prepLoading && <>מכין אודיו… {Math.round(prepPct)}%</>}
          {!prepLoading && currentCue && <>Cue {idx + 1}/{cues.length}</>}
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
            mode={mode}
            onSeek={onPreviewT}
            onTrackDelta={handleTrackDelta}
            onCueDelta={handleCueDelta}
          />
        </div>
        <div className="pv-time mono faint">{fmtTime(durationSec)}</div>
      </div>

      <div className="pv-cue">
        <div className="pv-cue-row">
          <span className="pv-cue-label">כתובית</span>
          <div className="pv-cue-nav">
            <button
              type="button"
              className="icon-btn small ghost"
              disabled={cues.length === 0}
              title="הקודמת"
              onClick={() => {
                const prev = [...cues].reverse().find((c) => c.start < previewT - 0.05);
                if (prev) onPreviewT(prev.start);
              }}
            >‹</button>
            <button
              type="button"
              className="icon-btn small ghost"
              disabled={cues.length === 0}
              title="הבאה"
              onClick={() => {
                const next = cues.find((c) => c.start > previewT + 0.05);
                if (next) onPreviewT(next.start);
              }}
            >›</button>
          </div>
          <span
            className={`pv-cue-time mono ${currentCue ? 'jumpable' : ''}`}
            onClick={() => currentCue && onPreviewT(currentCue.start)}
          >
            {currentCue ? `${fmtTimeMs(currentCue.start)} → ${fmtTimeMs(currentCue.end)}` : '—'}
          </span>
          <span className="pv-cue-text">{currentCue ? currentCue.text : 'אין כתובית בנקודה זו'}</span>
        </div>
        {(subOffset !== 0 || subSpeed !== 1) && (
          <div className="pv-cue-row adj">
            <span className="pv-cue-label">מסונכרן</span>
            <span className="pv-cue-time mono">
              {adjCue ? `${fmtTimeMs(adjCue.start)} → ${fmtTimeMs(adjCue.end)}` : '—'}
            </span>
            <span className="pv-cue-text">{adjCue ? adjCue.text : '—'}</span>
          </div>
        )}
      </div>
    </div>
  );
}
