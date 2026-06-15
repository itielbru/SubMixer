import { create } from 'zustand';
import type { ExternalSub, ProjectData } from '@shared/types';

export type ModalName =
  | 'open'
  | 'history'
  | 'cmd'
  | 'settings'
  | 'shortcuts'
  | 'visualSync'
  | 'adjustAll'
  | 'fixErrors'
  | 'findReplace'
  | 'batchQueue'
  | 'diagnostics';

export type ExportConfirmValue = 'mux' | 'overwrite' | { kind: 'srt'; sub: ExternalSub };

export interface FileInfo {
  size: number;
  mtimeMs: number;
}

const MODAL_KEYS: Record<ModalName, BooleanModalKey> = {
  open: 'showOpen',
  history: 'showHistory',
  cmd: 'showCmd',
  settings: 'showSettings',
  shortcuts: 'showShortcuts',
  visualSync: 'showVisualSync',
  adjustAll: 'showAdjustAll',
  fixErrors: 'showFixErrors',
  findReplace: 'showFindReplace',
  batchQueue: 'showBatchQueue',
  diagnostics: 'showDiagnostics',
};

type BooleanModalKey =
  | 'showOpen'
  | 'showHistory'
  | 'showCmd'
  | 'showSettings'
  | 'showShortcuts'
  | 'showVisualSync'
  | 'showAdjustAll'
  | 'showFixErrors'
  | 'showFindReplace'
  | 'showBatchQueue'
  | 'showDiagnostics';

export interface ModalStoreState {
  showOpen: boolean;
  showHistory: boolean;
  showCmd: boolean;
  showSettings: boolean;
  showShortcuts: boolean;
  showVisualSync: boolean;
  showAdjustAll: boolean;
  showFixErrors: boolean;
  showFindReplace: boolean;
  showBatchQueue: boolean;
  showDiagnostics: boolean;

  exportConfirm: ExportConfirmValue | null;
  overwriteFileInfo: FileInfo | null;
  whatsNewVersion: string | null;
  autosaveOffer: ProjectData | null;

  openModal: (name: ModalName) => void;
  closeModal: (name: ModalName) => void;
  setExportConfirm: (v: ExportConfirmValue | null) => void;
  setOverwriteFileInfo: (v: FileInfo | null) => void;
  setWhatsNewVersion: (v: string | null) => void;
  setAutosaveOffer: (v: ProjectData | null) => void;
}

export const useModalStore = create<ModalStoreState>((set) => ({
  showOpen: false,
  showHistory: false,
  showCmd: false,
  showSettings: false,
  showShortcuts: false,
  showVisualSync: false,
  showAdjustAll: false,
  showFixErrors: false,
  showFindReplace: false,
  showBatchQueue: false,
  showDiagnostics: false,

  exportConfirm: null,
  overwriteFileInfo: null,
  whatsNewVersion: null,
  autosaveOffer: null,

  openModal: (name) => set({ [MODAL_KEYS[name]]: true }),
  closeModal: (name) => set({ [MODAL_KEYS[name]]: false }),
  setExportConfirm: (v) => set({ exportConfirm: v }),
  setOverwriteFileInfo: (v) => set({ overwriteFileInfo: v }),
  setWhatsNewVersion: (v) => set({ whatsNewVersion: v }),
  setAutosaveOffer: (v) => set({ autosaveOffer: v }),
}));
