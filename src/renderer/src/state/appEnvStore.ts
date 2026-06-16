/**
 * Zustand store for app-environment state that is loaded once at startup
 * and rarely changes: platform flag, versions, ffmpeg status, waveform
 * peaks, and export history.
 *
 * Replaces the corresponding useState calls in App.tsx (isWin, appVer,
 * ffLine, ffmpegOk, peaks, peaksLoading, peaksPct, history).
 */

import { create } from 'zustand';
import type { ExportRecord } from '@shared/types';

interface PeaksData {
  min: Float32Array;
  max: Float32Array;
  peaksPerSec: number;
  duration: number;
}

export interface AppEnvState {
  isWin: boolean;
  appVer: string;
  ffLine: string;
  ffmpegOk: boolean;
  peaks: PeaksData | null;
  peaksLoading: boolean;
  peaksPct: number;
  history: ExportRecord[];

  setIsWin: (v: boolean) => void;
  setAppVer: (v: string) => void;
  setFfLine: (v: string) => void;
  setFfmpegOk: (v: boolean) => void;
  setPeaks: (v: PeaksData | null) => void;
  setPeaksLoading: (v: boolean) => void;
  setPeaksPct: (v: number) => void;
  setHistory: (v: ExportRecord[]) => void;
}

export const useAppEnvStore = create<AppEnvState>((set) => ({
  isWin: true,
  appVer: '',
  ffLine: '',
  ffmpegOk: true,
  peaks: null,
  peaksLoading: false,
  peaksPct: 0,
  history: [],

  setIsWin: (v) => set({ isWin: v }),
  setAppVer: (v) => set({ appVer: v }),
  setFfLine: (v) => set({ ffLine: v }),
  setFfmpegOk: (v) => set({ ffmpegOk: v }),
  setPeaks: (v) => set({ peaks: v }),
  setPeaksLoading: (v) => set({ peaksLoading: v }),
  setPeaksPct: (v) => set({ peaksPct: v }),
  setHistory: (v) => set({ history: v }),
}));
