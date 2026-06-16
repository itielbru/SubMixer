/**
 * Pure cue-list transformations.
 *
 * All functions take the current list and return a new list (immutable). They
 * have no side effects and no React / DOM dependencies, so they can be tested
 * headlessly in Vitest without a jsdom environment.
 */

import type { SrtCue } from '@shared/types';
import { visibleLen } from '../lib/cue-warnings';
import { fileTimeFromMediaTime } from '@shared/cue-sync';

export function applyUpdateCue(list: SrtCue[], idx: number, patch: Partial<SrtCue>): SrtCue[] {
  if (!list[idx]) return list;
  const next = list.slice();
  next[idx] = { ...next[idx], ...patch };
  return next;
}

export function applyDeleteCue(list: SrtCue[], idx: number): SrtCue[] {
  if (!list[idx]) return list;
  const next = list.slice();
  next.splice(idx, 1);
  return next;
}

export function applyInsertCue(list: SrtCue[], atTime: number): { list: SrtCue[]; pos: number } {
  const start = Math.max(0, atTime);
  const end = start + 2;
  const newCue: SrtCue = { idx: list.length + 1, start, end, text: '' };
  const next = list.slice();
  let pos = next.findIndex((c) => c.start > start);
  if (pos < 0) pos = next.length;
  next.splice(pos, 0, newCue);
  return { list: next, pos };
}

export function applyShiftCues(list: SrtCue[], indices: number[], deltaSec: number): SrtCue[] {
  const next = list.slice();
  for (const i of indices) {
    if (i < 0 || i >= next.length) continue;
    const c = next[i];
    next[i] = { ...c, start: Math.max(0, c.start + deltaSec), end: Math.max(0, c.end + deltaSec) };
  }
  return next;
}

export function applyShiftAllCues(
  list: SrtCue[],
  fromIdx: number,
  deltaSec: number,
  speed = 1,
): SrtCue[] {
  const next = list.slice();
  for (let i = fromIdx; i < next.length; i++) {
    next[i] = {
      ...next[i],
      start: Math.max(0, next[i].start * speed + deltaSec),
      end: Math.max(0, next[i].end * speed + deltaSec),
    };
  }
  return next;
}

export function applySplitCue(
  list: SrtCue[],
  idx: number,
  mode: 'playhead' | 'newline',
  previewT: number,
  syncOpts: { offset: number; speed: number },
): SrtCue[] | null {
  const cue = list[idx];
  if (!cue) return null;

  let splitT: number;
  let textA: string;
  let textB: string;

  if (mode === 'newline') {
    const nl = cue.text.indexOf('\n');
    if (nl < 0) return null;
    textA = cue.text.slice(0, nl).trim();
    textB = cue.text.slice(nl + 1).trim();
    if (!textA || !textB) return null;
    const total = Math.max(1, visibleLen(cue.text));
    const ratio = visibleLen(textA) / total;
    splitT = cue.start + (cue.end - cue.start) * ratio;
  } else {
    splitT = fileTimeFromMediaTime(previewT, syncOpts);
    if (splitT <= cue.start + 0.05 || splitT >= cue.end - 0.05) return null;
    textA = cue.text;
    textB = '';
  }

  const next = list.slice();
  next[idx] = { ...cue, end: splitT, text: textA };
  next.splice(idx + 1, 0, { idx: cue.idx + 1, start: splitT, end: cue.end, text: textB });
  return next;
}

export function applyMergeCue(list: SrtCue[], idx: number): SrtCue[] | null {
  const a = list[idx];
  const b = list[idx + 1];
  if (!a || !b) return null;
  const text = a.text ? (b.text ? `${a.text}\n${b.text}` : a.text) : b.text;
  const next = list.slice();
  next[idx] = { ...a, end: b.end, text };
  next.splice(idx + 1, 1);
  return next;
}

export function applyDuplicateCue(list: SrtCue[], idx: number, offsetSec = 2): SrtCue[] | null {
  const cue = list[idx];
  if (!cue) return null;
  const dur = Math.max(0.05, cue.end - cue.start);
  const start = cue.end + offsetSec;
  const gap = list[idx + 1] ? Math.max(0, list[idx + 1].start - cue.end) : undefined;
  const end = gap !== undefined ? Math.min(start + dur, cue.end + gap + dur) : start + dur;
  const next = list.slice();
  next.splice(idx + 1, 0, { idx: cue.idx + 1, start, end, text: cue.text });
  return next;
}
