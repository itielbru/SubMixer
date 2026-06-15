import { useState, useEffect, useCallback, useRef } from 'react';
import type { AppSettings } from '@shared/types';
import { applyTheme } from '../lib/theme';

const DEFAULT: AppSettings = {
  theme: 'system',
  accent: 'indigo',
  font: 'Heebo',
  lang: 'he',
  defaultDestFolder: '',
  exportUseContentFolder: false,
  recentFiles: [],
  history: [],
  minCueDurationSec: 1.2,
  maxCueDurationSec: 8,
  maxCps: 25,
  hardMaxCps: 35,
  minGapSec: 0.12,
  subFontScale: 1,
  subColor: '#ffffff',
  subStyle: 'outline',
  subPosition: 'bottom',
  burnInSubs: false,
  defaultContainer: 'mkv',
  encodePreset: 'faster',
  encodeCrf: 20,
  mp4AudioBitrate: 192,
  burnInFontSize: 24,
  burnInPrimaryColor: '#ffffff',
  burnInOutline: 2,
  lastSeenVersion: '',
  keybindings: {},
};

export function useSettings(): [
  AppSettings,
  <K extends keyof AppSettings>(key: K, value: AppSettings[K]) => Promise<void>,
  (patch: Partial<AppSettings>) => Promise<void>,
] {
  const [settings, setSettings] = useState<AppSettings>(DEFAULT);
  const resolvedNativeRef = useRef<'dark' | 'light' | null>(null);

  useEffect(() => {
    let mounted = true;
    window.api.settings.get().then(async (s) => {
      if (!mounted) return;
      setSettings(s);
      if (s.theme === 'system') {
        const resolved = await window.api.app.nativeTheme();
        resolvedNativeRef.current = resolved;
        if (mounted) applyTheme(s, resolved);
      } else {
        applyTheme(s);
      }
    });
    return () => {
      mounted = false;
    };
  }, []);

  useEffect(() => {
    if (settings.theme === 'system') {
      window.api.app.nativeTheme().then((resolved) => {
        resolvedNativeRef.current = resolved;
        applyTheme(settings, resolved);
      });
    } else {
      applyTheme(settings);
    }
    // Re-apply theme only when the visual settings change, not on every settings write.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [settings.theme, settings.accent, settings.font]);

  useEffect(() => {
    return window.api.app.onNativeThemeUpdated((resolved) => {
      resolvedNativeRef.current = resolved;
      setSettings((s) => {
        if (s.theme === 'system') applyTheme(s, resolved);
        return s;
      });
    });
  }, []);

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
