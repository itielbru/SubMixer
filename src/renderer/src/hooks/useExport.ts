import { useState, useEffect, useCallback } from 'react';
import type { ExportPlan, ExportProgress } from '@shared/types';

export interface BatchJob {
  plan: ExportPlan;
  durationSec: number;
  extSubs: { path: string; offset: number; speed: number; encoding?: string }[];
}

export interface UseExportApi {
  exporting: boolean;
  progress: number;
  eta: string;
  start: (
    plan: ExportPlan,
    durationSec: number,
    externalSubs: { path: string; offset: number; speed: number; encoding?: string }[],
  ) => Promise<{ ok: boolean; cancelled: boolean; error?: string }>;
  cancel: () => Promise<void>;
  runBatch: (
    jobs: BatchJob[],
    onJobDone?: (idx: number, ok: boolean, cancelled: boolean, error?: string) => void,
  ) => Promise<void>;
}

export function useExport(onLog?: (line: string) => void): UseExportApi {
  const [exporting, setExporting] = useState(false);
  const [progress, setProgress] = useState(0);
  const [eta, setEta] = useState('00:00');

  useEffect(() => {
    const off1 = window.api.exporting.onProgress((p: ExportProgress) => {
      setProgress(p.percent);
      setEta(p.eta || '00:00');
    });
    const off2 = window.api.exporting.onLog((line) => onLog?.(line));
    return () => {
      off1();
      off2();
    };
  }, [onLog]);

  const start = useCallback<UseExportApi['start']>(async (plan, durationSec, externalSubs) => {
    setExporting(true);
    setProgress(0);
    setEta('00:00');
    try {
      const r = await window.api.exporting.run(plan, durationSec, externalSubs);
      return r;
    } finally {
      setExporting(false);
      setProgress(0);
      setEta('00:00');
    }
  }, []);

  const cancel = useCallback(async () => {
    await window.api.exporting.cancel();
  }, []);

  const runBatch = useCallback(
    async (
      jobs: BatchJob[],
      onJobDone?: (idx: number, ok: boolean, cancelled: boolean, error?: string) => void,
    ): Promise<void> => {
      for (let i = 0; i < jobs.length; i++) {
        const j = jobs[i];
        const r = await start(j.plan, j.durationSec, j.extSubs);
        onJobDone?.(i, r.ok, r.cancelled, r.error);
        if (r.cancelled) break;
      }
    },
    [start],
  );

  return { exporting, progress, eta, start, cancel, runBatch };
}
