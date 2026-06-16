/**
 * Zustand store for export output metadata and batch queue.
 *
 * Replaces the useState calls in App.tsx for the output metadata fields
 * (contentType, title, year, season, episode, container, destFolder,
 * overrideName, customName) and the batchQueue array.
 *
 * App.tsx reads these values via useExportStore() selectors instead of
 * local state; ContentDetails and BottomBar continue to receive them as
 * props from App.tsx (prop-drilling is removed in a later step).
 */

import { create } from 'zustand';
import type { BatchItem } from '../components/modals/BatchQueueModal';

export interface ExportMeta {
  contentType: 'movie' | 'series';
  title: string;
  year: string;
  season: string;
  episode: string;
  container: string;
  destFolder: string;
  overrideName: boolean;
  customName: string;
}

export interface ExportStoreState extends ExportMeta {
  batchQueue: BatchItem[];

  // Metadata setters
  setContentType: (v: 'movie' | 'series') => void;
  setTitle: (v: string) => void;
  setYear: (v: string) => void;
  setSeason: (v: string) => void;
  setEpisode: (v: string) => void;
  setContainer: (v: string) => void;
  setDestFolder: (v: string) => void;
  setOverrideName: (v: boolean) => void;
  setCustomName: (v: string) => void;
  setMeta: (patch: Partial<ExportMeta>) => void;

  // Batch queue actions
  addBatchItems: (items: BatchItem[]) => void;
  updateBatchItem: (id: string, patch: Partial<BatchItem>) => void;
  removeBatchItem: (id: string) => void;
  clearDoneBatch: () => void;
  setBatchQueue: (items: BatchItem[]) => void;
}

export const useExportStore = create<ExportStoreState>((set) => ({
  contentType: 'movie',
  title: '',
  year: '',
  season: '01',
  episode: '01',
  container: 'MKV',
  destFolder: '',
  overrideName: false,
  customName: '',
  batchQueue: [],

  setContentType: (v) => set({ contentType: v }),
  setTitle: (v) => set({ title: v }),
  setYear: (v) => set({ year: v }),
  setSeason: (v) => set({ season: v }),
  setEpisode: (v) => set({ episode: v }),
  setContainer: (v) => set({ container: v }),
  setDestFolder: (v) => set({ destFolder: v }),
  setOverrideName: (v) => set({ overrideName: v }),
  setCustomName: (v) => set({ customName: v }),
  setMeta: (patch) => set(patch),

  addBatchItems: (items) => set((s) => ({ batchQueue: [...s.batchQueue, ...items] })),
  updateBatchItem: (id, patch) =>
    set((s) => ({
      batchQueue: s.batchQueue.map((x) => (x.id === id ? { ...x, ...patch } : x)),
    })),
  removeBatchItem: (id) => set((s) => ({ batchQueue: s.batchQueue.filter((x) => x.id !== id) })),
  clearDoneBatch: () =>
    set((s) => ({
      batchQueue: s.batchQueue.filter((x) => x.status === 'pending' || x.status === 'running'),
    })),
  setBatchQueue: (items) => set({ batchQueue: items }),
}));
