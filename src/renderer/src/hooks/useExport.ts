import { useState, useEffect, useCallback, useRef } from 'react';
import type { ExportPlan, ExportProgress, ReplaceRule } from '@shared/types';

export interface UseExportApi {
  exporting: boolean;
  progress: number;
  eta: string;
  start: (
    plan: ExportPlan,
    durationSec: number,
    externalSubs: { path: string; offset: number; speed: number; encoding?: string; replacements?: ReplaceRule[] }[]
  ) => Promise<{ ok: boolean; cancelled: boolean; error?: string; stderrTail?: string }>;
  cancel: () => Promise<void>;
}

export function useExport(onLog?: (line: string) => void): UseExportApi {
  const [exporting, setExporting] = useState(false);
  const [progress, setProgress] = useState(0);
  const [eta, setEta] = useState('00:00');
  const onLogRef = useRef(onLog);
  onLogRef.current = onLog;

  useEffect(() => {
    const off1 = window.api.exporting.onProgress((p: ExportProgress) => {
      setProgress(p.percent);
      setEta(p.eta || '00:00');
    });
    const off2 = window.api.exporting.onLog((line) => onLogRef.current?.(line));
    return () => {
      off1();
      off2();
    };
  }, []);

  const start = useCallback<UseExportApi['start']>(async (plan, durationSec, externalSubs) => {
    setExporting(true);
    setProgress(0);
    setEta('00:00');
    try {
      const r = await window.api.exporting.run(plan, durationSec, externalSubs);
      return r as { ok: boolean; cancelled: boolean; error?: string; stderrTail?: string };
    } finally {
      setExporting(false);
      setProgress(0);
      setEta('00:00');
    }
  }, []);

  const cancel = useCallback(async () => {
    await window.api.exporting.cancel();
  }, []);

  return { exporting, progress, eta, start, cancel };
}
