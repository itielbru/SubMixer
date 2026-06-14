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
import type { PreviewExtractPhase, PreviewExtractResult, PreviewProgress } from '../shared/preview';

const api = {
  ffmpeg: {
    status: (force = false): Promise<FFmpegStatus> => ipcRenderer.invoke('ffmpeg:status', force),
    openInstallPage: (): Promise<void> => ipcRenderer.invoke('ffmpeg:openInstallPage'),
  },

  media: {
    probe: (filePath: string): Promise<ProbeResult> => ipcRenderer.invoke('media:probe', filePath),
    url: (filePath: string): string => `submixer://media?path=${encodeURIComponent(filePath)}`,
  },

  dialog: {
    openVideo: (): Promise<string | null> => ipcRenderer.invoke('dialog:openVideo'),
    openSrt: (): Promise<string[]> => ipcRenderer.invoke('dialog:openSrt'),
    chooseFolder: (current?: string): Promise<string | null> =>
      ipcRenderer.invoke('dialog:chooseFolder', current),
    saveSrt: (defaultName?: string): Promise<string | null> =>
      ipcRenderer.invoke('dialog:saveSrt', defaultName),
  },

  srt: {
    add: (filePath: string): Promise<AddSubResult> => ipcRenderer.invoke('srt:add', filePath),
    read: (
      filePath: string,
    ): Promise<{
      ok: boolean;
      cues?: SrtCue[];
      encoding?: string;
      size?: number;
      error?: string;
    }> => ipcRenderer.invoke('srt:read', filePath),
    save: (args: {
      sourcePath: string;
      destPath: string;
      offset: number;
      speed: number;
      encoding?: string;
    }): Promise<{ ok: boolean; error?: string }> => ipcRenderer.invoke('srt:save', args),
    writeCues: (
      cues: SrtCue[],
      baseName: string,
    ): Promise<{ ok: boolean; path?: string; error?: string }> =>
      ipcRenderer.invoke('srt:writeCues', cues, baseName),
  },

  preview: {
    extract: (
      filePath: string,
      trackIndex: number,
      durationSec: number,
      phase: PreviewExtractPhase = 'full',
    ): Promise<PreviewExtractResult> =>
      ipcRenderer.invoke('preview:extract', { filePath, trackIndex, durationSec, phase }),
    onProgress: (cb: (p: PreviewProgress) => void): (() => void) => {
      const handler = (_e: IpcRendererEvent, p: PreviewProgress) => cb(p);
      ipcRenderer.on('preview:progress', handler);
      return () => ipcRenderer.removeListener('preview:progress', handler);
    },
  },

  peaks: {
    get: (
      filePath: string,
      trackIndex: number,
      durationSec: number,
    ): Promise<{
      ok: boolean;
      fromCache?: boolean;
      peaksPerSec?: number;
      durationSec?: number;
      min?: Float32Array;
      max?: Float32Array;
      error?: string;
    }> => ipcRenderer.invoke('peaks:get', { filePath, trackIndex, durationSec }),
    onProgress: (cb: (pct: number) => void): (() => void) => {
      const handler = (_e: IpcRendererEvent, pct: number) => cb(pct);
      ipcRenderer.on('peaks:progress', handler);
      return () => ipcRenderer.removeListener('peaks:progress', handler);
    },
  },

  exporting: {
    run: (
      plan: ExportPlan,
      durationSec: number,
      externalSubs: { path: string; offset: number; speed: number; encoding?: string }[],
    ): Promise<{ ok: boolean; code: number | null; cancelled: boolean; error?: string }> =>
      ipcRenderer.invoke('export:run', plan, durationSec, externalSubs),
    cancel: (): Promise<boolean> => ipcRenderer.invoke('export:cancel'),
    cmdString: (plan: ExportPlan): Promise<string> => ipcRenderer.invoke('export:cmdString', plan),
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

  fs: {
    exists: (p: string): Promise<boolean> => ipcRenderer.invoke('fs:exists', p),
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
    nativeTheme: (): Promise<'dark' | 'light'> => ipcRenderer.invoke('app:nativeTheme'),
    onNativeThemeUpdated: (cb: (theme: 'dark' | 'light') => void): (() => void) => {
      const handler = (_: Electron.IpcRendererEvent, t: 'dark' | 'light') => cb(t);
      ipcRenderer.on('nativeTheme:updated', handler);
      return () => ipcRenderer.removeListener('nativeTheme:updated', handler);
    },
  },

  update: {
    download: (): Promise<void> => ipcRenderer.invoke('update:download'),
    install: (): Promise<void> => ipcRenderer.invoke('update:install'),
    onAvailable: (cb: (version: string) => void): (() => void) => {
      const handler = (_: Electron.IpcRendererEvent, v: string) => cb(v);
      ipcRenderer.on('update:available', handler);
      return () => ipcRenderer.removeListener('update:available', handler);
    },
    onProgress: (cb: (percent: number) => void): (() => void) => {
      const handler = (_: Electron.IpcRendererEvent, p: number) => cb(p);
      ipcRenderer.on('update:progress', handler);
      return () => ipcRenderer.removeListener('update:progress', handler);
    },
    onDownloaded: (cb: (version: string) => void): (() => void) => {
      const handler = (_: Electron.IpcRendererEvent, v: string) => cb(v);
      ipcRenderer.on('update:downloaded', handler);
      return () => ipcRenderer.removeListener('update:downloaded', handler);
    },
    onError: (cb: (message: string) => void): (() => void) => {
      const handler = (_: Electron.IpcRendererEvent, m: string) => cb(m);
      ipcRenderer.on('update:error', handler);
      return () => ipcRenderer.removeListener('update:error', handler);
    },
  },

  debug: {
    log: (payload: import('../shared/agent-debug').AgentDebugPayload): Promise<void> =>
      ipcRenderer.invoke('debug:agentLog', payload),
  },
};

export type SubMixerApi = typeof api;

contextBridge.exposeInMainWorld('api', api);
