import { contextBridge, ipcRenderer, IpcRendererEvent } from 'electron';
import type {
  AppSettings,
  ProbeResult,
  AddSubResult,
  ExportPlan,
  ExportProgress,
  ExportRecord,
  FFmpegStatus,
  SrtCue,
} from '../shared/types';

const api = {
  ffmpeg: {
    status: (force = false): Promise<FFmpegStatus> =>
      ipcRenderer.invoke('ffmpeg:status', force),
    openInstallPage: (): Promise<void> => ipcRenderer.invoke('ffmpeg:openInstallPage'),
  },

  media: {
    probe: (filePath: string): Promise<ProbeResult> => ipcRenderer.invoke('media:probe', filePath),
  },

  dialog: {
    openVideo: (): Promise<string | null> => ipcRenderer.invoke('dialog:openVideo'),
    openSrt: (): Promise<string[]> => ipcRenderer.invoke('dialog:openSrt'),
    chooseFolder: (current?: string): Promise<string | null> =>
      ipcRenderer.invoke('dialog:chooseFolder', current),
  },

  srt: {
    add: (filePath: string): Promise<AddSubResult> => ipcRenderer.invoke('srt:add', filePath),
    read: (filePath: string): Promise<{ ok: boolean; cues?: SrtCue[]; encoding?: string; size?: number; error?: string }> =>
      ipcRenderer.invoke('srt:read', filePath),
  },

  preview: {
    extract: (
      filePath: string,
      trackIndex: number,
      durationSec: number
    ): Promise<{ ok: boolean; path?: string; url?: string; error?: string }> =>
      ipcRenderer.invoke('preview:extract', { filePath, trackIndex, durationSec }),
    onProgress: (cb: (p: ExportProgress) => void): (() => void) => {
      const handler = (_e: IpcRendererEvent, p: ExportProgress) => cb(p);
      ipcRenderer.on('preview:progress', handler);
      return () => ipcRenderer.removeListener('preview:progress', handler);
    },
    peaks: (
      filePath: string,
      trackIndex: number,
      durationSec: number,
      buckets?: number
    ): Promise<{ ok: boolean; peaks?: number[]; error?: string }> =>
      ipcRenderer.invoke('preview:peaks', { filePath, trackIndex, durationSec, buckets }),
  },

  exporting: {
    run: (
      plan: ExportPlan,
      durationSec: number,
      externalSubs: { path: string; offset: number; speed: number; encoding?: string; replacements?: import('@shared/types').ReplaceRule[]; cueOverrides?: Record<number, { dStart: number; dEnd: number }> }[]
    ): Promise<{ ok: boolean; code: number | null; cancelled: boolean; error?: string }> =>
      ipcRenderer.invoke('export:run', plan, durationSec, externalSubs),
    cancel: (): Promise<boolean> => ipcRenderer.invoke('export:cancel'),
    cmdString: (plan: ExportPlan, externalSubPaths: string[]): Promise<string> =>
      ipcRenderer.invoke('export:cmdString', plan, externalSubPaths),
    onProgress: (cb: (p: ExportProgress) => void): (() => void) => {
      const handler = (_e: IpcRendererEvent, p: ExportProgress) => cb(p);
      ipcRenderer.on('export:progress', handler);
      return () => ipcRenderer.removeListener('export:progress', handler);
    },
    onLog: (cb: (line: string) => void): (() => void) => {
      const handler = (_e: IpcRendererEvent, line: string) => cb(line);
      ipcRenderer.on('export:log', handler);
      return () => ipcRenderer.removeListener('export:log', handler);
    },
  },

  settings: {
    get: (): Promise<AppSettings> => ipcRenderer.invoke('settings:get'),
    setOne: <K extends keyof AppSettings>(key: K, value: AppSettings[K]): Promise<AppSettings> =>
      ipcRenderer.invoke('settings:setOne', key, value),
    setMany: (patch: Partial<AppSettings>): Promise<AppSettings> =>
      ipcRenderer.invoke('settings:setMany', patch),
  },

  history: {
    list: (): Promise<ExportRecord[]> => ipcRenderer.invoke('history:list'),
    clear: (): Promise<AppSettings> => ipcRenderer.invoke('history:clear'),
  },

  shellOps: {
    openPath: (p: string): Promise<string> => ipcRenderer.invoke('shell:openPath', p),
    showItem: (p: string): Promise<void> => ipcRenderer.invoke('shell:showItem', p),
    userDataPath: (): Promise<string> => ipcRenderer.invoke('shell:userData'),
  },

  menu: {
    on: (channel: string, cb: () => void): (() => void) => {
      const handler = () => cb();
      ipcRenderer.on(channel, handler);
      return () => ipcRenderer.removeListener(channel, handler);
    },
  },

  app: {
    platform: (): Promise<string> => ipcRenderer.invoke('app:platform'),
    version: (): Promise<string> => ipcRenderer.invoke('app:version'),
  },
};

export type SubMixerApi = typeof api;

contextBridge.exposeInMainWorld('api', api);

// Also expose a tiny `electron` namespace for compatibility helpers
contextBridge.exposeInMainWorld('electron', {
  ipcRenderer: {
    invoke: (...args: Parameters<typeof ipcRenderer.invoke>) => ipcRenderer.invoke(...args),
  },
});
