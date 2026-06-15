import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { CueWarningThresholds, SrtCue } from '@shared/types';
import type { PeaksResult } from '../lib/waveform';
import { nearestVolumePeakTime } from '../lib/waveform';
import { fmtTime } from '../lib/format';
import { computeWarnings } from '../lib/cue-warnings';
import { useT } from '../hooks/useTranslation';

interface Props {
  durationSec: number;
  cues: SrtCue[];
  currentT: number;
  /** When the user clicks empty space on the timeline */
  onSeek: (t: number) => void;
  /** When the user drags a cue or a handle. idx is the index in `cues`. */
  onUpdateCue: (idx: number, patch: Partial<SrtCue>) => void;
  selectedIdx: number;
  onSelect: (idx: number) => void;
  onDelete: (idx: number) => void;
  peaks: PeaksResult | null;
  /** True while the audio preview is decoding/extracting */
  loading?: boolean;
  /** 0..100; only shown when `loading` */
  loadingPct?: number;
  /** Snap dragged handles to volume peaks when true */
  volumeSnap?: boolean;
  warnThresholds?: CueWarningThresholds;
  /** Auto-scroll the view to keep the playhead visible while playing. */
  playing?: boolean;
}

type Drag =
  | { mode: 'seek' }
  | { mode: 'pan'; startX: number; startView: [number, number] }
  | { mode: 'move'; idx: number; startX: number; origStart: number; origEnd: number }
  | {
      mode: 'resize-l';
      idx: number;
      startX: number;
      origStart: number;
      minBound: number;
      maxBound: number;
    }
  | {
      mode: 'resize-r';
      idx: number;
      startX: number;
      origEnd: number;
      minBound: number;
      maxBound: number;
    };

const HANDLE_PX = 6;
const CUE_BLOCK_H = 28;
const RULER_H = 18;
const MIN_DUR = 0.05;
const MIN_VIEW_DUR = 0.5;
/** Default visible window when a file loads — a workable editing span, not the
 *  whole movie (a 2h fit makes every cue 1px wide). */
const DEFAULT_VIEW_SPAN = 30;
/** Magnetic snap distance in pixels — converted to seconds at the current zoom. */
const SNAP_PX = 6;

export function Timeline({
  durationSec,
  cues,
  currentT,
  onSeek,
  onUpdateCue,
  selectedIdx,
  onSelect,
  onDelete,
  peaks,
  loading,
  loadingPct = 0,
  volumeSnap,
  warnThresholds,
  playing,
}: Props) {
  const { t } = useT();
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const wrapRef = useRef<HTMLDivElement | null>(null);
  const [size, setSize] = useState({ w: 800, h: 140 });

  const dur = Math.max(MIN_VIEW_DUR, durationSec);
  const [view, setView] = useState<[number, number]>(() => [0, Math.min(dur, DEFAULT_VIEW_SPAN)]);
  const [follow, setFollow] = useState(true);

  // Reset view when the duration changes (new file).
  useEffect(() => {
    setView([0, Math.min(dur, DEFAULT_VIEW_SPAN)]);
  }, [dur]);

  const dragRef = useRef<Drag | null>(null);
  // Hovered cue index — purely for cursor feedback. We avoid putting it
  // in state when not drawn, to skip re-renders.
  const hoverRef = useRef<{ idx: number; zone: 'l' | 'r' | 'mid' } | null>(null);
  // Latest snap line in seconds — drawn over the timeline while a snap is active.
  const [snapLine, setSnapLine] = useState<number | null>(null);

  // ── sizing ────────────────────────────────────────────────────────────────
  useEffect(() => {
    const wrap = wrapRef.current;
    if (!wrap) return;
    const ro = new ResizeObserver((entries) => {
      for (const e of entries) {
        const cr = e.contentRect;
        setSize({ w: Math.max(200, Math.floor(cr.width)), h: Math.max(80, Math.floor(cr.height)) });
      }
    });
    ro.observe(wrap);
    return () => ro.disconnect();
  }, []);

  // ── auto-follow playhead ──────────────────────────────────────────────────
  // While playing, page the view forward when the playhead nears the right edge
  // (or falls outside), landing it ~25% in so there is lookahead. Skipped during
  // a drag so manual edits aren't fought.
  useEffect(() => {
    if (!follow || !playing || dragRef.current) return;
    const span = view[1] - view[0];
    if (currentT < view[0] || currentT > view[1] - span * 0.12) {
      let s = currentT - span * 0.25;
      let e = s + span;
      if (s < 0) {
        e -= s;
        s = 0;
      }
      if (e > durationSec) {
        s -= e - durationSec;
        e = durationSec;
        if (s < 0) s = 0;
      }
      setView([s, e]);
    }
    // view is read via closure (refreshed each currentT tick); excluding it
    // avoids re-running on manual zoom/pan.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentT, follow, playing, durationSec]);

  // ── coord helpers ─────────────────────────────────────────────────────────
  const tToX = useCallback(
    (t: number) => ((t - view[0]) / (view[1] - view[0])) * size.w,
    [view, size.w],
  );
  const xToT = useCallback(
    (x: number) => view[0] + (x / size.w) * (view[1] - view[0]),
    [view, size.w],
  );

  // ── hit testing ───────────────────────────────────────────────────────────
  const hitCue = useCallback(
    (x: number, y: number): { idx: number; zone: 'l' | 'r' | 'mid' } | null => {
      const cueY = size.h - RULER_H - CUE_BLOCK_H - 4;
      if (y < cueY || y > cueY + CUE_BLOCK_H) return null;
      // Iterate top→down so the topmost (= last drawn) wins.
      for (let i = cues.length - 1; i >= 0; i--) {
        const c = cues[i];
        const xs = tToX(c.start);
        const xe = tToX(c.end);
        if (xe < 0 || xs > size.w) continue;
        if (x < xs - 2 || x > xe + 2) continue;
        if (x - xs <= HANDLE_PX) return { idx: i, zone: 'l' };
        if (xe - x <= HANDLE_PX) return { idx: i, zone: 'r' };
        return { idx: i, zone: 'mid' };
      }
      return null;
    },
    [cues, tToX, size.h, size.w],
  );

  // ── drawing ───────────────────────────────────────────────────────────────
  const draw = useCallback(() => {
    const c = canvasRef.current;
    if (!c) return;
    const dpr = window.devicePixelRatio || 1;
    if (c.width !== size.w * dpr || c.height !== size.h * dpr) {
      c.width = size.w * dpr;
      c.height = size.h * dpr;
    }
    const ctx = c.getContext('2d');
    if (!ctx) return;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, size.w, size.h);

    const wavTop = 4;
    const wavBottom = size.h - RULER_H - CUE_BLOCK_H - 8;
    const wavH = wavBottom - wavTop;
    const wavMid = wavTop + wavH / 2;

    // Background panel for waveform
    ctx.fillStyle = readVar('--bg-2', '#15161b');
    ctx.fillRect(0, wavTop, size.w, wavH);

    // Waveform: symmetric min/max envelope (Subtitle-Edit style).
    if (peaks && peaks.max.length > 0) {
      const accent = readVar('--accent', '#5b6cf2');
      const half = wavH / 2;
      const start = view[0] * peaks.peaksPerSec;
      const end = view[1] * peaks.peaksPerSec;
      const stride = (end - start) / size.w;
      // Fill body (light) — closed path top→bottom.
      ctx.beginPath();
      // Top edge: left → right walking the max.
      for (let x = 0; x < size.w; x++) {
        const a = Math.max(0, Math.floor(start + x * stride));
        const b = Math.min(peaks.max.length - 1, Math.floor(start + (x + 1) * stride));
        let mx = -1;
        for (let p = a; p <= b; p++) {
          const v = peaks.max[p];
          if (v > mx) mx = v;
        }
        if (mx < 0) mx = 0;
        const y = wavMid - mx * half * 0.95;
        if (x === 0) ctx.moveTo(x, y);
        else ctx.lineTo(x, y);
      }
      // Bottom edge: right → left walking the min.
      for (let x = size.w - 1; x >= 0; x--) {
        const a = Math.max(0, Math.floor(start + x * stride));
        const b = Math.min(peaks.min.length - 1, Math.floor(start + (x + 1) * stride));
        let mn = 1;
        for (let p = a; p <= b; p++) {
          const v = peaks.min[p];
          if (v < mn) mn = v;
        }
        if (mn > 0) mn = 0;
        const y = wavMid - mn * half * 0.95;
        ctx.lineTo(x, y);
      }
      ctx.closePath();
      ctx.fillStyle = withAlpha(accent, 0.32);
      ctx.fill();
      // Edge stroke for crispness
      ctx.strokeStyle = withAlpha(accent, 0.95);
      ctx.lineWidth = 1;
      ctx.lineJoin = 'round';
      ctx.stroke();
    } else if (loading) {
      ctx.fillStyle = readVar('--text-3', '#71727a');
      ctx.font = '12px var(--mono)';
      ctx.textAlign = 'center';
      ctx.fillText(`${t('tl_peaks_loading')} ${Math.round(loadingPct)}%`, size.w / 2, wavMid + 4);
    } else {
      ctx.fillStyle = readVar('--text-3', '#71727a');
      ctx.font = '11px var(--mono)';
      ctx.textAlign = 'center';
      ctx.fillText(t('tl_peaks_hint'), size.w / 2, wavMid + 4);
    }

    // Center line
    ctx.fillStyle = readVar('--border', '#2a2c34');
    ctx.fillRect(0, wavMid, size.w, 1);

    // Selected-cue band across the waveform (Subtitle-Edit style) — makes the
    // active cue's span obvious against the audio for fine timing.
    if (selectedIdx >= 0 && cues[selectedIdx]) {
      const sc = cues[selectedIdx];
      const bx0 = tToX(sc.start);
      const bx1 = tToX(sc.end);
      if (bx1 >= 0 && bx0 <= size.w) {
        const acc = readVar('--accent', '#5b6cf2');
        ctx.fillStyle = withAlpha(acc, 0.14);
        ctx.fillRect(bx0, wavTop, bx1 - bx0, wavH);
        ctx.fillStyle = withAlpha(acc, 0.9);
        ctx.fillRect(bx0, wavTop, 1.5, wavH);
        ctx.fillRect(bx1 - 1.5, wavTop, 1.5, wavH);
      }
    }

    // Cue blocks
    const cueY = size.h - RULER_H - CUE_BLOCK_H - 4;
    const accent = readVar('--accent', '#5b6cf2');
    const warn = readVar('--warn', '#e8a24a');
    const danger = readVar('--danger', '#e87171');
    for (let i = 0; i < cues.length; i++) {
      const cue = cues[i];
      const xs = tToX(cue.start);
      const xe = tToX(cue.end);
      if (xe < -10 || xs > size.w + 10) continue;
      const w = Math.max(2, xe - xs);
      const selected = i === selectedIdx;
      // Pick a base colour per warning level.
      const lvl = computeWarnings(cue, cues[i - 1], cues[i + 1], warnThresholds).level;
      const base = lvl === 'err' ? danger : lvl === 'warn' ? warn : accent;
      ctx.fillStyle = selected ? withAlpha(base, 0.85) : withAlpha(base, 0.45);
      ctx.fillRect(xs, cueY, w, CUE_BLOCK_H);
      ctx.strokeStyle = selected ? base : withAlpha(base, 0.7);
      ctx.lineWidth = selected ? 1.5 : 1;
      ctx.strokeRect(xs + 0.5, cueY + 0.5, w - 1, CUE_BLOCK_H - 1);

      // Handles (visual hint, only if wide enough)
      if (w > 12) {
        ctx.fillStyle = withAlpha(base, selected ? 1 : 0.85);
        ctx.fillRect(xs, cueY, 2, CUE_BLOCK_H);
        ctx.fillRect(xe - 2, cueY, 2, CUE_BLOCK_H);
      }

      // Text label
      if (w > 30) {
        ctx.save();
        ctx.beginPath();
        ctx.rect(xs + 4, cueY, w - 8, CUE_BLOCK_H);
        ctx.clip();
        ctx.fillStyle = '#fff';
        ctx.font = '11px var(--font)';
        ctx.textAlign = 'start';
        ctx.textBaseline = 'middle';
        const txt = cue.text.replace(/\n/g, ' ⏎ ');
        ctx.fillText(txt, xs + 6, cueY + CUE_BLOCK_H / 2);
        ctx.restore();
      }
    }

    // Ruler
    const rulerY = size.h - RULER_H;
    ctx.fillStyle = readVar('--bg-2', '#15161b');
    ctx.fillRect(0, rulerY, size.w, RULER_H);
    ctx.fillStyle = readVar('--text-3', '#71727a');
    ctx.font = '10px var(--mono)';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    const span = view[1] - view[0];
    const stepSec = pickRulerStep(span, size.w);
    const first = Math.ceil(view[0] / stepSec) * stepSec;
    for (let t = first; t <= view[1]; t += stepSec) {
      const x = tToX(t);
      ctx.fillStyle = readVar('--border-2', '#383a44');
      ctx.fillRect(x, rulerY, 1, 4);
      ctx.fillStyle = readVar('--text-3', '#71727a');
      ctx.fillText(fmtTime(t), x, rulerY + RULER_H / 2 + 1);
    }

    // Snap indicator (during drag, when magnetized to a neighbor edge)
    if (snapLine !== null) {
      const sx = tToX(snapLine);
      if (sx >= -1 && sx <= size.w + 1) {
        ctx.fillStyle = readVar('--warn', '#e8a24a');
        ctx.fillRect(sx - 0.5, 0, 1, size.h - RULER_H);
      }
    }

    // Playhead
    const phX = tToX(currentT);
    if (phX >= -1 && phX <= size.w + 1) {
      ctx.fillStyle = readVar('--danger', '#e87171');
      ctx.fillRect(phX - 0.5, 0, 1.5, size.h - RULER_H);
      ctx.beginPath();
      ctx.moveTo(phX - 5, 0);
      ctx.lineTo(phX + 5, 0);
      ctx.lineTo(phX, 6);
      ctx.closePath();
      ctx.fill();
    }
  }, [
    cues,
    currentT,
    loading,
    loadingPct,
    peaks,
    selectedIdx,
    size.h,
    size.w,
    snapLine,
    tToX,
    view,
    t,
    warnThresholds,
  ]);

  useEffect(() => {
    draw();
  }, [draw]);

  // ── pointer handlers ──────────────────────────────────────────────────────
  const onPointerDown = (e: React.PointerEvent<HTMLCanvasElement>) => {
    const c = canvasRef.current!;
    c.setPointerCapture(e.pointerId);
    const rect = c.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;

    const hit = hitCue(x, y);
    if (hit) {
      onSelect(hit.idx);
      const cue = cues[hit.idx];
      // Cap movement by neighbors to keep ordering. Allow overlap if the user
      // explicitly drags into it, but cap start/end against the cue itself.
      const prev = cues[hit.idx - 1];
      const next = cues[hit.idx + 1];
      const minBound = prev ? prev.end : 0;
      const maxBound = next ? next.start : durationSec;
      if (hit.zone === 'mid') {
        dragRef.current = {
          mode: 'move',
          idx: hit.idx,
          startX: x,
          origStart: cue.start,
          origEnd: cue.end,
        };
      } else if (hit.zone === 'l') {
        dragRef.current = {
          mode: 'resize-l',
          idx: hit.idx,
          startX: x,
          origStart: cue.start,
          minBound,
          maxBound: cue.end - MIN_DUR,
        };
      } else {
        dragRef.current = {
          mode: 'resize-r',
          idx: hit.idx,
          startX: x,
          origEnd: cue.end,
          minBound: cue.start + MIN_DUR,
          maxBound,
        };
      }
      return;
    }

    // Middle-click or shift = pan; else seek.
    if (e.button === 1 || e.shiftKey) {
      dragRef.current = { mode: 'pan', startX: x, startView: [view[0], view[1]] };
    } else {
      dragRef.current = { mode: 'seek' };
      onSeek(clamp(xToT(x), 0, durationSec));
    }
  };

  const onPointerMove = (e: React.PointerEvent<HTMLCanvasElement>) => {
    const c = canvasRef.current!;
    const rect = c.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    const d = dragRef.current;

    if (!d) {
      const hit = hitCue(x, y);
      hoverRef.current = hit;
      c.style.cursor = hit ? (hit.zone === 'mid' ? 'grab' : 'ew-resize') : 'crosshair';
      return;
    }

    if (d.mode === 'seek') {
      onSeek(clamp(xToT(x), 0, durationSec));
      return;
    }
    if (d.mode === 'pan') {
      const dx = x - d.startX;
      const span = d.startView[1] - d.startView[0];
      const shift = -(dx / size.w) * span;
      let s = d.startView[0] + shift;
      let e2 = d.startView[1] + shift;
      if (s < 0) {
        e2 -= s;
        s = 0;
      }
      if (e2 > durationSec) {
        s -= e2 - durationSec;
        e2 = durationSec;
        if (s < 0) s = 0;
      }
      setView([s, e2]);
      return;
    }
    const span = view[1] - view[0];
    const secPerPx = span / size.w;
    const snapTol = SNAP_PX * secPerPx;
    const dxSec = (x - d.startX) * secPerPx;

    // Build snap targets from neighbor edges (skip the cue being dragged).
    const snapTargets = (skipIdx: number): number[] => {
      const out: number[] = [];
      for (let i = 0; i < cues.length; i++) {
        if (i === skipIdx) continue;
        const c = cues[i];
        // Only consider targets visible in the current view.
        if (c.end < view[0] - snapTol || c.start > view[1] + snapTol) continue;
        out.push(c.start, c.end);
      }
      return out;
    };
    const snap = (t: number, targets: number[]): { value: number; snapped: number | null } => {
      let best: number | null = null;
      let bestDelta = snapTol;
      for (const tg of targets) {
        const d2 = Math.abs(tg - t);
        if (d2 < bestDelta) {
          bestDelta = d2;
          best = tg;
        }
      }
      return best !== null ? { value: best, snapped: best } : { value: t, snapped: null };
    };
    const volSnap = (t: number): number => {
      if (!volumeSnap || !peaks) return t;
      return nearestVolumePeakTime(t, peaks, 0.05);
    };

    if (d.mode === 'move') {
      const cueSpan = d.origEnd - d.origStart;
      const prev = cues[d.idx - 1];
      const next = cues[d.idx + 1];
      const minS = prev ? prev.end : 0;
      const maxS = (next ? next.start : durationSec) - cueSpan;
      const targets = snapTargets(d.idx);
      // Try snapping both edges; pick the closer match.
      let newStart = d.origStart + dxSec;
      let newEnd = newStart + cueSpan;
      const sStart = snap(newStart, targets);
      const sEnd = snap(newEnd, targets);
      const dStart = sStart.snapped !== null ? Math.abs(sStart.snapped - newStart) : Infinity;
      const dEnd = sEnd.snapped !== null ? Math.abs(sEnd.snapped - newEnd) : Infinity;
      let line: number | null = null;
      if (dStart <= dEnd && dStart <= snapTol) {
        newStart = sStart.value;
        newEnd = newStart + cueSpan;
        line = newStart;
      } else if (dEnd < snapTol) {
        newEnd = sEnd.value;
        newStart = newEnd - cueSpan;
        line = newEnd;
      }
      newStart = volSnap(clamp(newStart, minS, Math.max(minS, maxS)));
      onUpdateCue(d.idx, { start: newStart, end: newStart + cueSpan });
      setSnapLine(line);
      return;
    }
    if (d.mode === 'resize-l') {
      const targets = snapTargets(d.idx);
      const raw = d.origStart + dxSec;
      const s = snap(raw, targets);
      const newStart = volSnap(clamp(s.value, d.minBound, d.maxBound));
      onUpdateCue(d.idx, { start: newStart });
      setSnapLine(s.snapped !== null ? newStart : null);
      return;
    }
    if (d.mode === 'resize-r') {
      const targets = snapTargets(d.idx);
      const raw = d.origEnd + dxSec;
      const s = snap(raw, targets);
      const newEnd = volSnap(clamp(s.value, d.minBound, d.maxBound));
      onUpdateCue(d.idx, { end: newEnd });
      setSnapLine(s.snapped !== null ? newEnd : null);
      return;
    }
  };

  const onPointerUp = (e: React.PointerEvent<HTMLCanvasElement>) => {
    const c = canvasRef.current!;
    if (c.hasPointerCapture(e.pointerId)) c.releasePointerCapture(e.pointerId);
    dragRef.current = null;
    setSnapLine(null);
  };

  // Wheel: ctrl/cmd = zoom centered on cursor; plain = pan
  const onWheel = (e: React.WheelEvent<HTMLCanvasElement>) => {
    // React's onWheel attaches a passive listener, so we can't preventDefault.
    // We listen via DOM in the effect below to get { passive: false }.
    void e;
  };

  useEffect(() => {
    const c = canvasRef.current;
    if (!c) return;
    const handler = (e: WheelEvent) => {
      e.preventDefault();
      const rect = c.getBoundingClientRect();
      const x = e.clientX - rect.left;
      const span = view[1] - view[0];
      if (e.ctrlKey || e.metaKey) {
        const factor = e.deltaY > 0 ? 1.2 : 1 / 1.2;
        let newSpan = clamp(span * factor, MIN_VIEW_DUR, durationSec);
        const cursorT = view[0] + (x / size.w) * span;
        let s = cursorT - (x / size.w) * newSpan;
        let eN = s + newSpan;
        if (s < 0) {
          eN -= s;
          s = 0;
        }
        if (eN > durationSec) {
          s -= eN - durationSec;
          eN = durationSec;
          if (s < 0) s = 0;
        }
        // Re-clamp span if it ended up larger than allowed.
        newSpan = eN - s;
        if (newSpan < MIN_VIEW_DUR) return;
        setView([s, eN]);
      } else {
        const shift = (e.deltaY / size.w) * span * 0.5 + (e.deltaX / size.w) * span;
        let s = view[0] + shift;
        let eN = view[1] + shift;
        if (s < 0) {
          eN -= s;
          s = 0;
        }
        if (eN > durationSec) {
          s -= eN - durationSec;
          eN = durationSec;
          if (s < 0) s = 0;
        }
        setView([s, eN]);
      }
    };
    c.addEventListener('wheel', handler, { passive: false });
    return () => c.removeEventListener('wheel', handler);
  }, [view, size.w, durationSec]);

  // Delete key removes the selected cue
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== 'Delete') return;
      if (selectedIdx < 0) return;
      const tag = (document.activeElement?.tagName || '').toLowerCase();
      if (tag === 'input' || tag === 'textarea') return;
      onDelete(selectedIdx);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [selectedIdx, onDelete]);

  // Arrow-key nudge/extend when the canvas is focused (a11y keyboard fallback).
  const NUDGE = 0.1;
  const onCanvasKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLCanvasElement>) => {
      if (selectedIdx < 0) return;
      const cue = cues[selectedIdx];
      if (!cue) return;
      if (e.key === 'ArrowLeft' || e.key === 'ArrowRight') {
        e.preventDefault();
        const delta = e.key === 'ArrowRight' ? NUDGE : -NUDGE;
        if (e.shiftKey) {
          // Extend/shrink end
          const newEnd = Math.max(cue.start + MIN_DUR, cue.end + delta);
          onUpdateCue(selectedIdx, { end: newEnd });
        } else {
          // Move whole cue
          const newStart = Math.max(0, cue.start + delta);
          const dur = cue.end - cue.start;
          onUpdateCue(selectedIdx, { start: newStart, end: newStart + dur });
        }
      }
    },
    [selectedIdx, cues, onUpdateCue],
  );

  // Toolbar: zoom in/out/fit
  const zoom = (factor: number) => {
    const span = view[1] - view[0];
    const center = (view[0] + view[1]) / 2;
    const newSpan = clamp(span * factor, MIN_VIEW_DUR, durationSec);
    let s = center - newSpan / 2;
    let eN = s + newSpan;
    if (s < 0) {
      eN -= s;
      s = 0;
    }
    if (eN > durationSec) {
      s -= eN - durationSec;
      eN = durationSec;
      if (s < 0) s = 0;
    }
    setView([s, eN]);
  };

  const fitView = () => setView([0, durationSec]);

  const centerOnPlayhead = () => {
    const span = view[1] - view[0];
    let s = currentT - span / 2;
    let eN = s + span;
    if (s < 0) {
      eN -= s;
      s = 0;
    }
    if (eN > durationSec) {
      s -= eN - durationSec;
      eN = durationSec;
      if (s < 0) s = 0;
    }
    setView([s, eN]);
  };

  const viewLabel = useMemo(() => `${fmtTime(view[0])} — ${fmtTime(view[1])}`, [view]);

  return (
    <div className="tl" dir="ltr">
      <div className="tl-toolbar">
        <button
          className="tl-btn"
          type="button"
          onClick={() => zoom(1 / 1.5)}
          title={t('tl_zoom_in')}
        >
          +
        </button>
        <button className="tl-btn" type="button" onClick={() => zoom(1.5)} title={t('tl_zoom_out')}>
          −
        </button>
        <button className="tl-btn" type="button" onClick={fitView} title={t('tl_fit')}>
          Fit
        </button>
        <button className="tl-btn" type="button" onClick={centerOnPlayhead} title={t('tl_center')}>
          ⤓
        </button>
        <button
          className={`tl-btn ${follow ? 'on' : ''}`}
          type="button"
          onClick={() => {
            const nv = !follow;
            setFollow(nv);
            if (nv) centerOnPlayhead();
          }}
          title={t('tl_follow_tip')}
        >
          ↳
        </button>
        <div className="tl-view mono">{viewLabel}</div>
        <div className="tl-help mono">{t('tl_help')}</div>
      </div>
      <div className="tl-canvas-wrap" ref={wrapRef}>
        <canvas
          ref={canvasRef}
          style={{ width: '100%', height: '100%', display: 'block' }}
          tabIndex={0}
          role="application"
          aria-label={t('tl_aria_label')}
          onPointerDown={onPointerDown}
          onPointerMove={onPointerMove}
          onPointerUp={onPointerUp}
          onPointerCancel={onPointerUp}
          onWheel={onWheel}
          onKeyDown={onCanvasKeyDown}
        />
      </div>
    </div>
  );
}

// ── helpers ─────────────────────────────────────────────────────────────────

function clamp(v: number, lo: number, hi: number): number {
  return Math.max(lo, Math.min(hi, v));
}

function readVar(name: string, fallback: string): string {
  if (typeof window === 'undefined') return fallback;
  const v = getComputedStyle(document.documentElement).getPropertyValue(name).trim();
  return v || fallback;
}

function withAlpha(color: string, a: number): string {
  // Accept #RGB / #RRGGBB. Anything else → use color-mix as a fallback string.
  const m = color.match(/^#([0-9a-f]{3}|[0-9a-f]{6})$/i);
  if (!m) return color;
  let h = m[1];
  if (h.length === 3)
    h = h
      .split('')
      .map((c) => c + c)
      .join('');
  const r = parseInt(h.slice(0, 2), 16);
  const g = parseInt(h.slice(2, 4), 16);
  const b = parseInt(h.slice(4, 6), 16);
  return `rgba(${r},${g},${b},${a})`;
}

function pickRulerStep(spanSec: number, widthPx: number): number {
  // Aim for ~80px per label
  const target = (spanSec / widthPx) * 80;
  const steps = [0.1, 0.5, 1, 2, 5, 10, 15, 30, 60, 120, 300, 600, 1800];
  for (const s of steps) if (s >= target) return s;
  return steps[steps.length - 1];
}
