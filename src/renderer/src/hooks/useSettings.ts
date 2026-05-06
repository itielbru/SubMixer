import { useState, useEffect, useCallback } from 'react';
import type { AppSettings } from '@shared/types';
import { applyTheme } from '../lib/theme';

const DEFAULT: AppSettings = {
  theme: 'dark',
  accent: 'indigo',
  font: 'Heebo',
  defaultDestFolder: '',
  recentFiles: [],
  history: [],
};

export function useSettings(): [
  AppSettings,
  <K extends keyof AppSettings>(key: K, value: AppSettings[K]) => Promise<void>,
  (patch: Partial<AppSettings>) => Promise<void>,
] {
  const [settings, setSettings] = useState<AppSettings>(DEFAULT);

  useEffect(() => {
    let mounted = true;
    window.api.settings.get().then((s) => {
      if (!mounted) return;
      setSettings(s);
      applyTheme(s);
    });
    return () => {
      mounted = false;
    };
  }, []);

  useEffect(() => {
    applyTheme(settings);
  }, [settings.theme, settings.accent, settings.font]);

  const setOne = useCallback(async <K extends keyof AppSettings>(key: K, value: AppSettings[K]) => {
    setSettings((s) => ({ ...s, [key]: value }));
    const updated = await window.api.settings.setOne(key, value);
    setSettings(updated);
  }, []);

  const setMany = useCallback(async (patch: Partial<AppSettings>) => {
    setSettings((s) => ({ ...s, ...patch }));
    const updated = await window.api.settings.setMany(patch);
    setSettings(updated);
  }, []);

  return [settings, setOne, setMany];
}
