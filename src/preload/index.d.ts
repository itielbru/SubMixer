import type { SubMixerApi } from './index';

declare global {
  interface Window {
    api: SubMixerApi;
    electron: {
      ipcRenderer: {
        invoke(channel: string, ...args: unknown[]): Promise<unknown>;
      };
    };
  }
}

export {};
