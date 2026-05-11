import React, { useEffect, useRef, useState } from 'react';
import type { SrtCue } from '@shared/types';

export type SyncMode = 'track' | 'cue';

interface Props {
  filePath: string | null;
  audioTrackIndex: number | null;
  durationSec: number;
  previewT: number;
  cues: SrtCue[];
  mode: SyncMode;
  onSeek: (t: number) => void;
  /** drag whole track: delta seconds from drag start */
  onTrackDelta: (delta: number, phase: 'start' | 'move' | 'end') => void;
  /** drag single cue: cue idx + delta */
  onCueDelta: (cueIdx: number, delta: number, phase: 'start' | 'move' | 'end') => void;
}

const HEIGHT = 64;

function canvasToTime(clientX: number, rect: DOMRect, durationSec: number): number {
  // RTL: right edge = t=0, left edge = t=durationSec
  const ratio = Math.max(0, Math.min(1, (rect.right - clientX) / rect.width));
  return ratio * durationSec;
}

function hitCue(t: number, cues: SrtCue[]): SrtCue | null {
  for (const c of cues) {
    if (t >= c.start && t <= c.end) return c;
  }
  return null;
}

export function Waveform({
  filePath,
  audioTrackIndex,
  durationSec,
  previewT,
  cues,
  mode,
  onSeek,
  onTrackDelta,
  onCueDelta,
}: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const [peaks, setPeaks] = useState<Float32Array | null>(null);
  const [loading, setLoading] = useState(false);
  const [width, setWidth] = useState(0);

  // drag state
  const dragRef = useRef<{
    kind: 'scrub' | 'track' | 'cue';
    startT: number;
    cueIdx?: number;
  } | null>(null);

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const update = () => setWidth(el.clientWidth);
    update();
    const ro = new ResizeObserver(update);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  useEffect(() => {
    setPeaks(null);
    if (!filePath || audioTrackIndex === null || durationSec <= 0) return;
    let cancelled = false;
    setLoading(true);
    void window.api.preview
      .peaks(filePath, audioTrackIndex, durationSec, 2000)
      .then((r) => {
        if (cancelled) return;
        if (r.ok && r.peaks) setPeaks(Float32Array.from(r.peaks));
        setLoading(false);
      })
      .catch(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [filePath, audioTrackIndex, durationSec]);

  useEffect(() => {
    const cv = canvasRef.current;
    if (!cv || width === 0) return;
    const dpr = window.devicePixelRatio || 1;
    cv.width = width * dpr;
    cv.height = HEIGHT * dpr;
    const ctx = cv.getContext('2d');
    if (!ctx) return;
    ctx.scale(dpr, dpr);
    ctx.clearRect(0, 0, width, HEIGHT);

    ctx.fillStyle = 'rgba(255,255,255,0.025)';
    ctx.fillRect(0, 0, width, HEIGHT);

    const mid = HEIGHT / 2;
    ctx.strokeStyle = 'rgba(255,255,255,0.06)';
    ctx.beginPath(); ctx.moveTo(0, mid); ctx.lineTo(width, mid); ctx.stroke();

    // Cue blocks
    if (durationSec > 0 && cues.length) {
      for (const c of cues) {
        // RTL: t=0 is at right, t=dur is at left
        const x1 = width - (c.end / durationSec) * width;
        const x2 = width - (c.start / durationSec) * width;
        ctx.fillStyle = mode === 'cue' ? 'rgba(99,102,241,0.25)' : 'rgba(99,102,241,0.18)';
        ctx.fillRect(x1, 4, Math.max(1, x2 - x1), HEIGHT - 8);
        if (mode === 'cue') {
          ctx.strokeStyle = 'rgba(99,102,241,0.6)';
          ctx.lineWidth = 1;
          ctx.strokeRect(x1, 4, Math.max(1, x2 - x1), HEIGHT - 8);
        }
      }
    }

    // Peaks
    if (peaks) {
      const buckets = peaks.length / 2;
      ctx.fillStyle = 'rgba(255,255,255,0.55)';
      for (let x = 0; x < width; x++) {
        const ratio = (width - x) / width; // RTL
        const bIdx = Math.min(buckets - 1, Math.max(0, Math.floor(ratio * buckets)));
        const min = peaks[bIdx * 2];
        const max = peaks[bIdx * 2 + 1];
        const y1 = mid - max * (mid - 2);
        const y2 = mid - min * (mid - 2);
        ctx.fillRect(x, y1, 1, Math.max(1, y2 - y1));
      }
    }

    // Progress + playhead (RTL)
    if (durationSec > 0) {
      const px = (previewT / durationSec) * width;
      ctx.fillStyle = 'rgba(99,102,241,0.10)';
      ctx.fillRect(width - px, 0, px, HEIGHT);
      ctx.fillStyle = 'rgb(99,102,241)';
      ctx.fillRect(width - px - 1, 0, 2, HEIGHT);
    }
  }, [peaks, width, cues, previewT, durationSec, mode]);

  const handlePointerDown = (e: React.PointerEvent<HTMLCanvasElement>) => {
    const cv = canvasRef.current;
    if (!cv || durationSec <= 0) return;
    cv.setPointerCapture(e.pointerId);
    const rect = cv.getBoundingClientRect();
    const t = canvasToTime(e.clientX, rect, durationSec);
    const hit = hitCue(t, cues);

    if (hit && mode !== 'track' && mode !== 'cue') {
      // fallthrough to scrub
    }

    if (hit && mode === 'track') {
      dragRef.current = { kind: 'track', startT: t };
      onTrackDelta(0, 'start');
    } else if (hit && mode === 'cue') {
      dragRef.current = { kind: 'cue', startT: t, cueIdx: hit.idx };
      onCueDelta(hit.idx, 0, 'start');
    } else {
      dragRef.current = { kind: 'scrub', startT: t };
      onSeek(t);
    }

    const onMove = (ev: PointerEvent) => {
      const r = cv.getBoundingClientRect();
      const curT = canvasToTime(ev.clientX, r, durationSec);
      const d = dragRef.current;
      if (!d) return;
      if (d.kind === 'scrub') {
        onSeek(curT);
      } else if (d.kind === 'track') {
        onTrackDelta(curT - d.startT, 'move');
      } else if (d.kind === 'cue' && d.cueIdx !== undefined) {
        onCueDelta(d.cueIdx, curT - d.startT, 'move');
      }
    };

    const onUp = (ev: PointerEvent) => {
      const r = cv.getBoundingClientRect();
      const curT = canvasToTime(ev.clientX, r, durationSec);
      const d = dragRef.current;
      if (d?.kind === 'track') onTrackDelta(curT - d.startT, 'end');
      else if (d?.kind === 'cue' && d.cueIdx !== undefined) onCueDelta(d.cueIdx, curT - d.startT, 'end');
      dragRef.current = null;
      cv.removeEventListener('pointermove', onMove);
      cv.removeEventListener('pointerup', onUp);
      cv.removeEventListener('pointercancel', onUp);
    };

    cv.addEventListener('pointermove', onMove);
    cv.addEventListener('pointerup', onUp);
    cv.addEventListener('pointercancel', onUp);
  };

  const cursor = mode === 'cue' || mode === 'track' ? 'grab' : 'pointer';

  return (
    <div className="waveform" ref={containerRef} style={{ height: HEIGHT }}>
      <canvas
        ref={canvasRef}
        style={{ width: '100%', height: HEIGHT, display: 'block', cursor }}
        onPointerDown={handlePointerDown}
      />
      {loading && <div className="waveform-loading mono">מחשב גל…</div>}
    </div>
  );
}
