import type { SubMixerApi } from './index';

declare global {
  interface Window {
    api: SubMixerApi;
  }
}

export {};
