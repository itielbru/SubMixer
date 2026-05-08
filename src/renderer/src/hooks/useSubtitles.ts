import { useState, useEffect, useCallback, useRef } from 'react';
import type { ExternalSub, SrtCue } from '@shared/types';
import type { ToastKind } from './useToasts';

export function useSubtitles(toast: (msg: string, kind?: ToastKind) => void) {
  const [extSubs, setExtSubs] = useState<ExternalSub[]>([]);
  const [activeSubId, setActiveSubId] = useState<string | null>(null);
  const [cues, setCues] = useState<SrtCue[]>([]);
  const undoStack = useRef<ExternalSub[][]>([]);

  // Reload SRT cues when active subtitle changes (ASS files have no parsed cues)
  useEffect(() => {
    const sub = extSubs.find((s) => s.id === activeSubId);
    if (!sub || sub.format !== 'srt') {
      setCues([]);
      return;
    }
    void window.api.srt.read(sub.path).then((r) => {
      if (r.ok && r.cues) setCues(r.cues);
      else setCues([]);
    });
  }, [activeSubId, extSubs]);

  const pickSrtFiles = useCallback(async () => {
    const paths = await window.api.dialog.openSrt();
    for (const p of paths) {
      const r = await window.api.srt.add(p);
      if (r.ok && r.sub) {
        setExtSubs((s) => [...s, r.sub!]);
        setActiveSubId(r.sub!.id);
        toast(`נוספו כתוביות: ${r.sub!.name}`, 'ok');
      } else {
        toast(r.error || 'שגיאה', 'err');
      }
    }
  }, [toast]);

  const updateSub = useCallback((id: string, patch: Partial<ExternalSub>) => {
    setExtSubs((prev) => {
      undoStack.current = [...undoStack.current, prev].slice(-20);
      return prev.map((x) => (x.id === id ? { ...x, ...patch } : x));
    });
  }, []);

  const removeSub = useCallback(
    (id: string) => {
      setExtSubs((s) => {
        const rest = s.filter((x) => x.id !== id);
        if (activeSubId === id) setActiveSubId(rest[0]?.id ?? null);
        return rest;
      });
    },
    [activeSubId]
  );

  const undoSub = useCallback(() => {
    const stack = undoStack.current;
    if (stack.length === 0) return false;
    const prev = stack[stack.length - 1];
    undoStack.current = stack.slice(0, -1);
    setExtSubs(prev);
    return true;
  }, []);

  const resetSubs = useCallback(() => {
    setExtSubs([]);
    setActiveSubId(null);
    setCues([]);
    undoStack.current = [];
  }, []);

  const activeSub = extSubs.find((s) => s.id === activeSubId);

  return {
    extSubs,
    activeSubId,
    setActiveSubId,
    cues,
    activeSub,
    pickSrtFiles,
    updateSub,
    removeSub,
    resetSubs,
    undoSub,
  };
}
