import {
  ipcMain,
  dialog,
  app,
  shell,
  BrowserWindow,
  IpcMainInvokeEvent,
  protocol,
} from 'electron';
import { promises as fs } from 'fs';
import * as path from 'path';
import { randomUUID } from 'crypto';
import {
  findBinaries,
  probe,
  extractAudioPreview,
  runExport,
  cancelActiveExport,
  buildCommandString,
} from './ffmpeg';
import { readSrtFile, countAssCues, writeTransformedSrt, clearTempSrt } from './srt';
import {
  getSettings,
  setSetting,
  setSettings,
  addRecentFile,
  addHistoryEntry,
  clearHistory,
  getRecentFiles,
  userDataPath,
} from './store';
import type {
  AppSettings,
  ExportPlan,
  ProbeResult,
  AddSubResult,
  ExternalSub,
} from '@shared/types';

function fmtSize(bytes: number): string {
  if (!bytes) return '—';
  if (bytes >= 1024 ** 3) return (bytes / 1024 ** 3).toFixed(2) + ' GB';
  if (bytes >= 1024 ** 2) return (bytes / 1024 ** 2).toFixed(1) + ' MB';
  return (bytes / 1024).toFixed(1) + ' KB';
}

function senderWindow(event: IpcMainInvokeEvent): BrowserWindow | null {
  return BrowserWindow.fromWebContents(event.sender);
}


export function registerIpc(): void {
  // ── FFmpeg discovery ─────────────────────────────────────────────────────
  ipcMain.handle('ffmpeg:status', async (_e, force?: boolean) => {
    return findBinaries(!!force);
  });

  ipcMain.handle('ffmpeg:openInstallPage', async () => {
    await shell.openExternal('https://www.gyan.dev/ffmpeg/builds/');
  });

  // ── Probe video ──────────────────────────────────────────────────────────
  ipcMain.handle('media:probe', async (_e, filePath: string): Promise<ProbeResult> => {
    try {
      const file = await probe(filePath);
      await addRecentFile(filePath);
      return { ok: true, file };
    } catch (err) {
      return { ok: false, error: (err as Error).message };
    }
  });

  // ── Open dialogs ─────────────────────────────────────────────────────────
  ipcMain.handle('dialog:openVideo', async (event) => {
    const win = senderWindow(event);
    const result = await dialog.showOpenDialog(win!, {
      title: 'בחר קובץ וידאו',
      filters: [
        { name: 'Video', extensions: ['mkv', 'mp4', 'm4v', 'mov', 'avi', 'webm', 'ts'] },
        { name: 'All files', extensions: ['*'] },
      ],
      properties: ['openFile'],
    });
    if (result.canceled || result.filePaths.length === 0) return null;
    return result.filePaths[0];
  });

  ipcMain.handle('dialog:openSrt', async (event) => {
    const win = senderWindow(event);
    const result = await dialog.showOpenDialog(win!, {
      title: 'הוסף קובץ כתוביות',
      filters: [
        { name: 'Subtitles', extensions: ['srt', 'ass', 'ssa'] },
        { name: 'All files', extensions: ['*'] },
      ],
      properties: ['openFile', 'multiSelections'],
    });
    if (result.canceled || result.filePaths.length === 0) return [];
    return result.filePaths;
  });

  ipcMain.handle('dialog:chooseFolder', async (event, current?: string) => {
    const win = senderWindow(event);
    const result = await dialog.showOpenDialog(win!, {
      title: 'בחר תיקיית יעד',
      defaultPath: current || app.getPath('videos'),
      properties: ['openDirectory', 'createDirectory'],
    });
    if (result.canceled || result.filePaths.length === 0) return null;
    return result.filePaths[0];
  });

  // ── SRT ──────────────────────────────────────────────────────────────────
  ipcMain.handle('srt:add', async (_e, filePath: string): Promise<AddSubResult> => {
    try {
      const stat = await fs.stat(filePath);
      const ext = path.extname(filePath).toLowerCase();
      const isAss = ext === '.ass' || ext === '.ssa';
      const format: 'srt' | 'ass' | 'ssa' = ext === '.ass' ? 'ass' : ext === '.ssa' ? 'ssa' : 'srt';

      const langMatch = path.basename(filePath).match(/\.(heb|eng|spa|ara|fre|fra|ger|deu|rus|jpn|por|ita|tur|nld|pol)\./i);
      const lang = langMatch ? langMatch[1].toLowerCase() : 'und';
      const langName: Record<string, string> = {
        heb: 'עברית',
        eng: 'English',
        spa: 'Español',
        ara: 'العربية',
        fre: 'Français',
        fra: 'Français',
        ger: 'Deutsch',
        deu: 'Deutsch',
        rus: 'Русский',
        jpn: '日本語',
      };

      let cueCount: number;
      let encoding: string;
      let cues;

      if (isAss) {
        const raw = await fs.readFile(filePath, 'utf-8');
        cueCount = countAssCues(raw);
        encoding = 'UTF-8';
        cues = [];
      } else {
        const result = await readSrtFile(filePath);
        cueCount = result.cues.length;
        encoding = result.encoding;
        cues = result.cues;
      }

      const normLang = lang === 'fra' ? 'fre' : lang === 'deu' ? 'ger' : lang;

      const sub: ExternalSub = {
        id: randomUUID(),
        path: filePath,
        name: path.basename(filePath),
        size: fmtSize(stat.size),
        sizeBytes: stat.size,
        cues: cueCount,
        lang: normLang,
        trackName: langName[lang] || lang.toUpperCase(),
        offset: 0,
        speed: 1,
        def: false,
        forced: false,
        encoding,
        format,
      };
      return { ok: true, sub, cues };
    } catch (err) {
      return { ok: false, error: (err as Error).message };
    }
  });

  ipcMain.handle('srt:read', async (_e, filePath: string) => {
    try {
      const { cues, encoding, size } = await readSrtFile(filePath);
      return { ok: true, cues, encoding, size };
    } catch (err) {
      return { ok: false, error: (err as Error).message };
    }
  });

  // ── Audio preview ────────────────────────────────────────────────────────
  ipcMain.handle('preview:extract', async (event, args: {
    filePath: string;
    trackIndex: number;
    durationSec: number;
  }) => {
    try {
      const id = `p${Date.now()}`;
      const win = senderWindow(event);
      const outPath = await extractAudioPreview(
        args.filePath,
        args.trackIndex,
        id,
        (p) => win?.webContents.send('preview:progress', p),
        args.durationSec
      );
      return {
        ok: true,
        path: outPath,
        url: 'submixer://preview?path=' + encodeURIComponent(outPath),
      };
    } catch (err) {
      return { ok: false, error: (err as Error).message };
    }
  });

  // ── Export ───────────────────────────────────────────────────────────────
  ipcMain.handle('export:run', async (event, plan: ExportPlan, durationSec: number, externalSubs: {
    path: string; offset: number; speed: number; encoding?: string;
  }[]) => {
    const win = senderWindow(event);
    try {
      // Process each external SRT (offset/speed) → temp files
      const processed: string[] = [];
      for (const s of externalSubs) {
        if (s.offset === 0 && s.speed === 1) {
          processed.push(s.path);
        } else {
          const out = await writeTransformedSrt(s.path, {
            offset: s.offset,
            speed: s.speed,
            encoding: s.encoding,
          });
          processed.push(out);
        }
      }

      const stderrLines: string[] = [];
      const result = await runExport(
        plan,
        processed,
        durationSec,
        (p) => win?.webContents.send('export:progress', p),
        (line) => {
          stderrLines.push(line);
          if (stderrLines.length > 80) stderrLines.shift();
          win?.webContents.send('export:log', line);
        }
      );

      if (result.ok) {
        const outStat = await fs.stat(plan.outputPath).catch(() => null);
        const sizeStr = outStat ? fmtSize(outStat.size) : '—';
        const now = new Date();
        const time = now.toTimeString().slice(0, 8);
        await addHistoryEntry({
          name: path.basename(plan.outputPath),
          path: plan.outputPath,
          size: sizeStr,
          time,
          ok: true,
        });
      } else if (!result.cancelled) {
        const now = new Date();
        await addHistoryEntry({
          name: path.basename(plan.outputPath),
          path: plan.outputPath,
          size: '—',
          time: now.toTimeString().slice(0, 8),
          ok: false,
        });
      }
      // Clean up the temp SRTs after export
      await clearTempSrt();
      if (!result.ok && !result.cancelled) {
        return { ...result, stderrTail: stderrLines.slice(-30).join('\n') };
      }
      return result;
    } catch (err) {
      return { ok: false, code: null, cancelled: false, error: (err as Error).message };
    }
  });

  ipcMain.handle('export:cancel', async () => {
    return cancelActiveExport();
  });

  ipcMain.handle('export:cmdString', async (_e, plan: ExportPlan, externalSubPaths: string[]) => {
    return buildCommandString(plan, externalSubPaths);
  });

  // ── Settings + history ───────────────────────────────────────────────────
  ipcMain.handle('settings:get', async () => {
    const s = await getSettings();
    const recentFiles = await getRecentFiles();
    return { ...s, recentFiles };
  });
  ipcMain.handle('settings:setOne', async <K extends keyof AppSettings>(_e: unknown, key: K, value: AppSettings[K]) => {
    return setSetting(key, value);
  });
  ipcMain.handle('settings:setMany', async (_e, patch: Partial<AppSettings>) => {
    return setSettings(patch);
  });

  ipcMain.handle('history:list', async () => (await getSettings()).history);
  ipcMain.handle('history:clear', async () => clearHistory());

  ipcMain.handle('shell:openPath', async (_e, p: string) => shell.openPath(p));
  ipcMain.handle('shell:showItem', async (_e, p: string) => shell.showItemInFolder(p));
  ipcMain.handle('shell:userData', async () => userDataPath());

  ipcMain.handle('app:platform', async () => process.platform);
  ipcMain.handle('app:version', async () => app.getVersion());
}

/** Register a `submixer://` protocol so the renderer can play extracted audio
 *  files from `app.getPath('userData')` without exposing arbitrary `file://`. */
export function registerPreviewProtocol(): void {
  protocol.handle('submixer', async (request) => {
    try {
      const url = new URL(request.url);
      const fromQuery = url.searchParams.get('path');
      const fromPath = decodeURIComponent(url.pathname.replace(/^\//, ''));
      const filePath = fromQuery ?? fromPath;
      if (!filePath) {
        return new Response('Missing path', { status: 400 });
      }
      // Restrict to within userData for safety
      const root = path.resolve(userDataPath());
      const resolved = path.resolve(filePath);
      const normRoot = root.toLowerCase().replace(/[/\\]+$/, '');
      const normResolved = resolved.toLowerCase();
      if (!normResolved.startsWith(normRoot)) {
        return new Response('Forbidden', { status: 403 });
      }
      const data = await fs.readFile(resolved);
      const ext = path.extname(resolved).toLowerCase();
      const mime: Record<string, string> = {
        '.mp3': 'audio/mpeg',
        '.m4a': 'audio/mp4',
        '.aac': 'audio/aac',
        '.ogg': 'audio/ogg',
      };
      return new Response(data, {
        headers: { 'Content-Type': mime[ext] || 'application/octet-stream' },
      });
    } catch (err) {
      return new Response((err as Error).message, { status: 500 });
    }
  });
}
