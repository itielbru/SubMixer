import { useCallback } from 'react';
import type { SrtCue } from '@shared/types';
import { fileTimeFromMediaTime } from '@shared/cue-sync';
import { visibleLen } from '../lib/cue-warnings';
import { useDocStore } from '../state/docStore';

/**
 * All cue mutation operations for the active subtitle track.
 * Reads state and setters directly from docStore so App.tsx doesn't need
 * to thread them through.
 *
 * @param previewT Current playhead position in media time (seconds), used
 *   by splitCue when splitting at the playhead.
 */
export function useCueOps(previewT: number) {
  const activeSubId = useDocStore((s) => s.activeSubId);
  const cuesBySubId = useDocStore((s) => s.cuesBySubId);
  const extSubs = useDocStore((s) => s.extSubs);
  const snapshotCues = useDocStore((s) => s.snapshotCues);
  const setCuesBySubId = useDocStore((s) => s.setCuesBySubId);
  const setEditedSubIds = useDocStore((s) => s.setEditedSubIds);
  const setExtSubs = useDocStore((s) => s.setExtSubs);

  const markSubEdited = useCallback(() => {
    if (!activeSubId) return;
    setEditedSubIds((s) => {
      if (s.has(activeSubId)) return s;
      const n = new Set(s);
      n.add(activeSubId);
      return n;
    });
  }, [activeSubId, setEditedSubIds]);

  const updateCue = useCallback(
    (idx: number, patch: Partial<SrtCue>) => {
      if (!activeSubId) return;
      snapshotCues(activeSubId, `upd:${activeSubId}:${idx}`);
      setCuesBySubId((m) => {
        const list = m[activeSubId];
        if (!list || !list[idx]) return m;
        const next = list.slice();
        next[idx] = { ...next[idx], ...patch };
        return { ...m, [activeSubId]: next };
      });
      setEditedSubIds((s) => {
        if (s.has(activeSubId)) return s;
        const n = new Set(s);
        n.add(activeSubId);
        return n;
      });
    },
    [activeSubId, snapshotCues, setCuesBySubId, setEditedSubIds],
  );

  const deleteCue = useCallback(
    (idx: number) => {
      if (!activeSubId) return;
      snapshotCues(activeSubId, null);
      setCuesBySubId((m) => {
        const list = m[activeSubId];
        if (!list || !list[idx]) return m;
        const next = list.slice();
        next.splice(idx, 1);
        return { ...m, [activeSubId]: next };
      });
      setEditedSubIds((s) => {
        if (s.has(activeSubId)) return s;
        const n = new Set(s);
        n.add(activeSubId);
        return n;
      });
      setExtSubs((subs) =>
        subs.map((s) => (s.id === activeSubId ? { ...s, cues: Math.max(0, s.cues - 1) } : s)),
      );
    },
    [activeSubId, snapshotCues, setCuesBySubId, setEditedSubIds, setExtSubs],
  );

  const insertCue = useCallback(
    (atTime: number): number => {
      if (!activeSubId) return -1;
      snapshotCues(activeSubId, null);
      const list = cuesBySubId[activeSubId] || [];
      const start = Math.max(0, atTime);
      const end = start + 2;
      const newCue = { idx: list.length + 1, start, end, text: '' };
      const next = list.slice();
      let pos = next.findIndex((c) => c.start > start);
      if (pos < 0) pos = next.length;
      next.splice(pos, 0, newCue);
      setCuesBySubId((m) => ({ ...m, [activeSubId]: next }));
      setEditedSubIds((s) => {
        if (s.has(activeSubId)) return s;
        const n = new Set(s);
        n.add(activeSubId);
        return n;
      });
      setExtSubs((subs) =>
        subs.map((s) => (s.id === activeSubId ? { ...s, cues: s.cues + 1 } : s)),
      );
      return pos;
    },
    [activeSubId, cuesBySubId, snapshotCues, setCuesBySubId, setEditedSubIds, setExtSubs],
  );

  const shiftCues = useCallback(
    (deltaSec: number, indices: number[]): void => {
      if (!activeSubId || indices.length === 0) return;
      snapshotCues(activeSubId, `shift:${activeSubId}:${indices.join(',')}`);
      setCuesBySubId((m) => {
        const list = m[activeSubId];
        if (!list) return m;
        const next = list.slice();
        for (const i of indices) {
          if (i < 0 || i >= next.length) continue;
          const c = next[i];
          next[i] = {
            ...c,
            start: Math.max(0, c.start + deltaSec),
            end: Math.max(0, c.end + deltaSec),
          };
        }
        return { ...m, [activeSubId]: next };
      });
      markSubEdited();
    },
    [activeSubId, markSubEdited, snapshotCues, setCuesBySubId],
  );

  const shiftAllCues = useCallback(
    (deltaSec: number, fromIdx: number, speed = 1): void => {
      if (!activeSubId) return;
      snapshotCues(activeSubId, `shiftAll:${activeSubId}:${fromIdx}`);
      setCuesBySubId((m) => {
        const list = m[activeSubId];
        if (!list) return m;
        const next = list.slice();
        for (let i = fromIdx; i < next.length; i++) {
          next[i] = {
            ...next[i],
            start: Math.max(0, next[i].start * speed + deltaSec),
            end: Math.max(0, next[i].end * speed + deltaSec),
          };
        }
        return { ...m, [activeSubId]: next };
      });
      markSubEdited();
    },
    [activeSubId, markSubEdited, snapshotCues, setCuesBySubId],
  );

  const setCuesForActiveSub = useCallback(
    (next: SrtCue[]): void => {
      if (!activeSubId) return;
      snapshotCues(activeSubId, null);
      setCuesBySubId((m) => ({ ...m, [activeSubId]: next }));
      setExtSubs((subs) =>
        subs.map((s) => (s.id === activeSubId ? { ...s, cues: next.length } : s)),
      );
      markSubEdited();
    },
    [activeSubId, markSubEdited, snapshotCues, setCuesBySubId, setExtSubs],
  );

  const splitCue = useCallback(
    (idx: number, mode: 'playhead' | 'newline'): void => {
      if (!activeSubId) return;
      const list = cuesBySubId[activeSubId];
      const cue = list?.[idx];
      if (!cue) return;
      const sub = extSubs.find((s) => s.id === activeSubId);
      const syncOpts = { offset: sub?.offset ?? 0, speed: sub?.speed ?? 1 };

      let splitT: number;
      let textA: string;
      let textB: string;

      if (mode === 'newline') {
        const nl = cue.text.indexOf('\n');
        if (nl < 0) return;
        textA = cue.text.slice(0, nl).trim();
        textB = cue.text.slice(nl + 1).trim();
        if (!textA || !textB) return;
        const total = Math.max(1, visibleLen(cue.text));
        const ratio = visibleLen(textA) / total;
        splitT = cue.start + (cue.end - cue.start) * ratio;
      } else {
        splitT = fileTimeFromMediaTime(previewT, syncOpts);
        if (splitT <= cue.start + 0.05 || splitT >= cue.end - 0.05) return;
        textA = cue.text;
        textB = '';
      }

      const next = list.slice();
      next[idx] = { ...cue, end: splitT, text: textA };
      next.splice(idx + 1, 0, {
        idx: cue.idx + 1,
        start: splitT,
        end: cue.end,
        text: textB,
      });
      setCuesForActiveSub(next);
    },
    [activeSubId, cuesBySubId, extSubs, previewT, setCuesForActiveSub],
  );

  const mergeCue = useCallback(
    (idx: number): void => {
      if (!activeSubId) return;
      const list = cuesBySubId[activeSubId];
      const a = list?.[idx];
      const b = list?.[idx + 1];
      if (!a || !b) return;
      const text = a.text ? (b.text ? `${a.text}\n${b.text}` : a.text) : b.text;
      const next = list.slice();
      next[idx] = { ...a, end: b.end, text };
      next.splice(idx + 1, 1);
      setCuesForActiveSub(next);
    },
    [activeSubId, cuesBySubId, setCuesForActiveSub],
  );

  const duplicateCue = useCallback(
    (idx: number, offsetSec = 2): void => {
      if (!activeSubId) return;
      const list = cuesBySubId[activeSubId];
      const cue = list?.[idx];
      if (!cue) return;
      const dur = Math.max(0.05, cue.end - cue.start);
      const gap = 0.05;
      const copy: SrtCue = {
        ...cue,
        idx: cue.idx + 1,
        start: cue.end + gap + offsetSec,
        end: cue.end + gap + offsetSec + dur,
        text: cue.text,
      };
      const next = list.slice();
      next.splice(idx + 1, 0, copy);
      setCuesForActiveSub(next);
    },
    [activeSubId, cuesBySubId, setCuesForActiveSub],
  );

  return {
    updateCue,
    deleteCue,
    insertCue,
    shiftCues,
    shiftAllCues,
    setCuesForActiveSub,
    markSubEdited,
    splitCue,
    mergeCue,
    duplicateCue,
  };
}
