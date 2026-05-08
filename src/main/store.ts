import { promises as fs } from 'fs';
import * as path from 'path';
import { app } from 'electron';
import type { AppSettings, ExportRecord } from '@shared/types';

const DEFAULT_SETTINGS: AppSettings = {
  theme: 'dark',
  accent: 'indigo',
  font: 'Heebo',
  defaultDestFolder: '',
  recentFiles: [],
  history: [],
};

const settingsPath = () => path.join(app.getPath('userData'), 'settings.json');

let cache: AppSettings | null = null;

export async function getSettings(): Promise<AppSettings> {
  if (cache) return cache;
  try {
    const raw = await fs.readFile(settingsPath(), 'utf-8');
    const parsed = JSON.parse(raw);
    cache = { ...DEFAULT_SETTINGS, ...parsed };
  } catch {
    cache = {
      ...DEFAULT_SETTINGS,
      defaultDestFolder: app.getPath('videos'),
    };
    await save(cache);
  }
  return cache!;
}

async function save(s: AppSettings): Promise<void> {
  cache = s;
  const file = settingsPath();
  await fs.mkdir(path.dirname(file), { recursive: true });
  await fs.writeFile(file, JSON.stringify(s, null, 2), 'utf-8');
}

export async function setSetting<K extends keyof AppSettings>(
  key: K,
  value: AppSettings[K]
): Promise<AppSettings> {
  const s = await getSettings();
  const next = { ...s, [key]: value };
  await save(next);
  return next;
}

export async function setSettings(patch: Partial<AppSettings>): Promise<AppSettings> {
  const s = await getSettings();
  const next = { ...s, ...patch };
  await save(next);
  return next;
}

async function pruneRecentFiles(recentFiles: string[]): Promise<string[]> {
  const checks = await Promise.all(
    recentFiles.map((p) => fs.access(p).then(() => p).catch(() => null))
  );
  return checks.filter(Boolean) as string[];
}

export async function addRecentFile(filePath: string): Promise<AppSettings> {
  const s = await getSettings();
  const raw = [filePath, ...s.recentFiles.filter((p) => p !== filePath)].slice(0, 20);
  const recent = await pruneRecentFiles(raw);
  const next = { ...s, recentFiles: recent };
  await save(next);
  return next;
}

export async function getRecentFiles(): Promise<string[]> {
  const s = await getSettings();
  const pruned = await pruneRecentFiles(s.recentFiles);
  if (pruned.length !== s.recentFiles.length) {
    await save({ ...s, recentFiles: pruned });
  }
  return pruned;
}

export async function addHistoryEntry(record: ExportRecord): Promise<AppSettings> {
  const s = await getSettings();
  const history = [record, ...s.history].slice(0, 100);
  const next = { ...s, history };
  await save(next);
  return next;
}

export async function clearHistory(): Promise<AppSettings> {
  const s = await getSettings();
  const next = { ...s, history: [] };
  await save(next);
  return next;
}

export function userDataPath(): string {
  return app.getPath('userData');
}
