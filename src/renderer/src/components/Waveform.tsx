import React, { useEffect, useRef, useState } from 'react';
import type { SrtCue } from '@shared/types';

interface Props {
  filePath: string | null;
  audioTrackIndex: number | null;
  durationSec: number;
  previewT: number;
  cues: SrtCue[];
  onSeek: (t: number) => void;
}

const HEIGHT = 56;

export function Waveform({
  filePath,
  audioTrackIndex,
  durationSec,
  previewT,
  cues,
  onSeek,
}: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const [peaks, setPeaks] = useState<Float32Array | null>(null);
  const [loading, setLoading] = useState(false);
  const [width, setWidth] = useState(0);

  // Track container width for responsive rendering
  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const update = () => setWidth(el.clientWidth);
    update();
    const ro = new ResizeObserver(update);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  // Fetch peaks when file/track changes
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
      .catch(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [filePath, audioTrackIndex, durationSec]);

  // Draw waveform
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

    // Background
    ctx.fillStyle = 'rgba(255,255,255,0.025)';
    ctx.fillRect(0, 0, width, HEIGHT);

    // Center line
    const mid = HEIGHT / 2;
    ctx.strokeStyle = 'rgba(255,255,255,0.06)';
    ctx.beginPath();
    ctx.moveTo(0, mid);
    ctx.lineTo(width, mid);
    ctx.stroke();

    // Cue overlays
    if (durationSec > 0 && cues.length) {
      ctx.fillStyle = 'rgba(99, 102, 241, 0.18)';
      for (const c of cues) {
        const x1 = (c.start / durationSec) * width;
        const x2 = (c.end / durationSec) * width;
        ctx.fillRect(x1, 4, Math.max(1, x2 - x1), HEIGHT - 8);
      }
    }

    // Peaks (mirrored on RTL — draw from right)
    if (peaks && peaks.length > 0) {
      const buckets = peaks.length / 2;
      ctx.fillStyle = 'rgba(255,255,255,0.55)';
      for (let x = 0; x < width; x++) {
        const ratio = x / width;
        // RTL: x=0 corresponds to time=durationSec; flip
        const t = (1 - ratio) * durationSec;
        const bIdx = Math.min(buckets - 1, Math.max(0, Math.floor((t / durationSec) * buckets)));
        const min = peaks[bIdx * 2];
        const max = peaks[bIdx * 2 + 1];
        const y1 = mid - max * (mid - 2);
        const y2 = mid - min * (mid - 2);
        ctx.fillRect(x, y1, 1, Math.max(1, y2 - y1));
      }
    }

    // Progress fill (RTL: fill from right)
    if (durationSec > 0) {
      const px = (previewT / durationSec) * width;
      ctx.fillStyle = 'rgba(99, 102, 241, 0.10)';
      ctx.fillRect(width - px, 0, px, HEIGHT);
      // Playhead
      ctx.fillStyle = 'rgb(99, 102, 241)';
      ctx.fillRect(width - px - 1, 0, 2, HEIGHT);
    }
  }, [peaks, width, cues, previewT, durationSec]);

  const handlePointer = (e: React.PointerEvent<HTMLCanvasElement>) => {
    const cv = canvasRef.current;
    if (!cv || durationSec <= 0) return;
    cv.setPointerCapture(e.pointerId);
    const update = (clientX: number) => {
      const r = cv.getBoundingClientRect();
      const ratio = Math.max(0, Math.min(1, (r.right - clientX) / r.width));
      onSeek(ratio * durationSec);
    };
    update(e.clientX);
    const move = (ev: PointerEvent) => update(ev.clientX);
    const up = () => {
      cv.removeEventListener('pointermove', move);
      cv.removeEventListener('pointerup', up);
      cv.removeEventListener('pointercancel', up);
    };
    cv.addEventListener('pointermove', move);
    cv.addEventListener('pointerup', up);
    cv.addEventListener('pointercancel', up);
  };

  return (
    <div className="waveform" ref={containerRef} style={{ height: HEIGHT }}>
      <canvas
        ref={canvasRef}
        style={{ width: '100%', height: HEIGHT, display: 'block', cursor: 'pointer' }}
        onPointerDown={handlePointer}
      />
      {loading && <div className="waveform-loading mono">מחשב גל…</div>}
    </div>
  );
}
