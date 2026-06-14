import {
  ipcMain,
  dialog,
  app,
  shell,
  BrowserWindow,
  IpcMainInvokeEvent,
  protocol,
  nativeTheme,
} from 'electron';
import { promises as fs, createReadStream } from 'fs';
import { Readable } from 'stream';
import { createHash } from 'crypto';
import * as path from 'path';
import {
  findBinaries,
  probe,
  extractAudioPreview,
  extractPeaks,
  runExport,
  cancelActiveExport,
  buildCommandString,
  validateExportPlan,
} from './ffmpeg';
import { loadCached, saveCached } from './peaks-cache';
import {
  readSrtFile,
  writeTransformedSrt,
  exportTransformedSrt,
  writeCuesToFile,
  clearTempSrt,
} from './srt';
import { buildMenu } from './menu';
import {
  getSettings,
  setSetting,
  setSettings,
  addRecentFile,
  addHistoryEntry,
  clearHistory,
  userDataPath,
} from './store';
import type {
  AppSettings,
  ExportPlan,
  ProbeResult,
  AddSubResult,
  ExternalSub,
  SrtCue,
} from '@shared/types';
import { t } from '@shared/i18n';
import type { AgentDebugPayload } from '@shared/agent-debug';
import { PREVIEW_QUICK_SECONDS, type PreviewProgress } from '@shared/preview';
import log from './logger';

function fmtSize(bytes: number): string {
  if (!bytes) return '—';
  if (bytes >= 1024 ** 3) return (bytes / 1024 ** 3).toFixed(2) + ' GB';
  if (bytes >= 1024 ** 2) return (bytes / 1024 ** 2).toFixed(1) + ' MB';
  return (bytes / 1024).toFixed(1) + ' KB';
}

function senderWindow(event: IpcMainInvokeEvent): BrowserWindow | null {
  return BrowserWindow.fromWebContents(event.sender);
}

function assertString(v: unknown, name: string): asserts v is string {
  if (typeof v !== 'string' || v.length === 0) throw new Error(`${name} must be a non-empty string`);
}

function assertAbsPath(v: string, name: string): void {
  if (!path.isAbsolute(v)) throw new Error(`${name} must be an absolute path`);
}

let nextSubId = 1;
let peaksInFlight = false;

const allowedMediaPaths = new Set<string>();

async function previewCacheId(filePath: string, trackIndex: number): Promise<string> {
  const stat = await fs.stat(filePath);
  const h = createHash('sha1');
  h.update(filePath);
  h.update('::');
  h.update(String(stat.size));
  h.update('::');
  h.update(String(Math.floor(stat.mtimeMs)));
  h.update('::');
  h.update(String(trackIndex));
  return h.digest('hex');
}

async function prepareExternalSubs(
  externalSubs: { path: string; offset: number; speed: number; encoding?: string }[]
): Promise<string[]> {
  const processed: string[] = [];
  for (const s of externalSubs) {
    const out = await writeTransformedSrt(s.path, {
      offset: s.offset,
      speed: s.speed,
      encoding: s.encoding,
    });
    processed.push(out);
  }
  return processed;
}

export function registerIpc(): void {
  // Forward structured renderer diagnostics into the main log file.
  ipcMain.handle('debug:agentLog', async (_e, payload: AgentDebugPayload) => {
    log.debug('[renderer]', payload.location, payload.message, payload.data ?? '');
  });

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
      assertString(filePath, 'filePath');
      assertAbsPath(filePath, 'filePath');
      const file = await probe(filePath);
      allowedMediaPaths.add(path.resolve(filePath));
      await addRecentFile(filePath);
      return { ok: true, file };
    } catch (err) {
      return { ok: false, error: (err as Error).message };
    }
  });

  ipcMain.handle('peaks:get', async (event, args: {
    filePath: string;
    trackIndex: number;
    durationSec: number;
  }) => {
    if (peaksInFlight) return { ok: false, error: 'peaks extraction already running' };
    peaksInFlight = true;
    try {
      assertString(args?.filePath, 'filePath');
      assertAbsPath(args.filePath, 'filePath');
      const win = senderWindow(event);
      const cached = await loadCached(args.filePath, args.trackIndex);
      if (cached) {
        return {
          ok: true,
          fromCache: true,
          peaksPerSec: cached.peaksPerSec,
          durationSec: cached.durationSec,
          min: cached.min,
          max: cached.max,
        };
      }
      const data = await extractPeaks(
        args.filePath,
        args.trackIndex,
        args.durationSec,
        (pct) => win?.webContents.send('peaks:progress', pct)
      );
      await saveCached(args.filePath, args.trackIndex, {
        peaksPerSec: data.peaksPerSec,
        durationSec: data.durationSec,
        min: data.min,
        max: data.max,
      });
      return {
        ok: true,
        fromCache: false,
        peaksPerSec: data.peaksPerSec,
        durationSec: data.durationSec,
        min: data.min,
        max: data.max,
      };
    } catch (err) {
      return { ok: false, error: (err as Error).message };
    } finally {
      peaksInFlight = false;
    }
  });

  // ── Open dialogs ─────────────────────────────────────────────────────────
  ipcMain.handle('dialog:openVideo', async (event) => {
    const win = senderWindow(event);
    const lang = (await getSettings()).lang;
    const result = await dialog.showOpenDialog(win!, {
      title: t(lang, 'dialog_video_title'),
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
    const lang = (await getSettings()).lang;
    const result = await dialog.showOpenDialog(win!, {
      title: t(lang, 'dialog_subs_title'),
      filters: [
        { name: 'Subtitles', extensions: ['srt', 'vtt', 'ass', 'ssa'] },
        { name: 'All files', extensions: ['*'] },
      ],
      properties: ['openFile', 'multiSelections'],
    });
    if (result.canceled || result.filePaths.length === 0) return [];
    return result.filePaths;
  });

  ipcMain.handle('dialog:chooseFolder', async (event, current?: string) => {
    const win = senderWindow(event);
    const lang = (await getSettings()).lang;
    const result = await dialog.showOpenDialog(win!, {
      title: t(lang, 'choose_folder'),
      defaultPath: current || app.getPath('videos'),
      properties: ['openDirectory', 'createDirectory'],
    });
    if (result.canceled || result.filePaths.length === 0) return null;
    return result.filePaths[0];
  });

  // ── SRT ──────────────────────────────────────────────────────────────────
  ipcMain.handle('srt:add', async (_e, filePath: string): Promise<AddSubResult> => {
    try {
      assertString(filePath, 'filePath');
      assertAbsPath(filePath, 'filePath');
      const stat = await fs.stat(filePath);
      const { cues, encoding } = await readSrtFile(filePath);

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

      const sub: ExternalSub = {
        id: `s${Date.now()}-${nextSubId++}`,
        path: filePath,
        name: path.basename(filePath),
        size: fmtSize(stat.size),
        sizeBytes: stat.size,
        cues: cues.length,
        lang: lang === 'fra' ? 'fre' : lang === 'deu' ? 'ger' : lang,
        trackName: langName[lang] || lang.toUpperCase(),
        offset: 0,
        speed: 1,
        def: false,
        forced: false,
        encoding,
      };
      return { ok: true, sub, cues };
    } catch (err) {
      return { ok: false, error: (err as Error).message };
    }
  });

  ipcMain.handle('srt:read', async (_e, filePath: string) => {
    try {
      assertString(filePath, 'filePath');
      assertAbsPath(filePath, 'filePath');
      const { cues, encoding, size } = await readSrtFile(filePath);
      return { ok: true, cues, encoding, size };
    } catch (err) {
      return { ok: false, error: (err as Error).message };
    }
  });

  ipcMain.handle('srt:writeCues', async (_e, cues: SrtCue[], baseName: string) => {
    try {
      const out = await writeCuesToFile(cues, baseName);
      return { ok: true, path: out };
    } catch (err) {
      return { ok: false, error: (err as Error).message };
    }
  });

  ipcMain.handle('dialog:saveSrt', async (event, defaultName?: string) => {
    const win = senderWindow(event);
    const lang = (await getSettings()).lang;
    const result = await dialog.showSaveDialog(win!, {
      title: t(lang, 'dialog_save_subs_title'),
      defaultPath: defaultName || 'subtitle.srt',
      filters: [
        { name: 'Subtitles', extensions: ['srt'] },
        { name: 'All files', extensions: ['*'] },
      ],
    });
    if (result.canceled) return null;
    return result.filePath;
  });

  ipcMain.handle('srt:save', async (_e, args: {
    sourcePath: string;
    destPath: string;
    offset: number;
    speed: number;
    encoding?: string;
  }) => {
    try {
      await exportTransformedSrt(args.sourcePath, args.destPath, {
        offset: args.offset,
        speed: args.speed,
        encoding: args.encoding,
      });
      return { ok: true };
    } catch (err) {
      return { ok: false, error: (err as Error).message };
    }
  });

  // ── Audio preview ────────────────────────────────────────────────────────
  ipcMain.handle('preview:extract', async (event, args: {
    filePath: string;
    trackIndex: number;
    durationSec: number;
    phase?: 'quick' | 'full';
  }) => {
    try {
      assertString(args?.filePath, 'filePath');
      assertAbsPath(args.filePath, 'filePath');
      if (!Number.isInteger(args.trackIndex) || args.trackIndex < 0) {
        throw new Error('trackIndex must be a non-negative integer');
      }
      const id = await previewCacheId(args.filePath, args.trackIndex);
      const win = senderWindow(event);
      const previewRoot = path.join(userDataPath(), 'temp', 'preview');
      const fullPath = path.join(previewRoot, `${id}.m4a`);
      const quickPath = path.join(previewRoot, `${id}.quick.m4a`);
      const phase = args.phase ?? 'full';
      log.debug('preview:extract', {
        phase,
        trackIndex: args.trackIndex,
        durationSec: args.durationSec,
      });
      const quickSec = Math.min(
        PREVIEW_QUICK_SECONDS,
        Math.max(1, args.durationSec || PREVIEW_QUICK_SECONDS)
      );

      const sendProgress = (p: { percent: number; eta: string; timeSec: number }, progPhase: 'quick' | 'full') => {
        const payload: PreviewProgress = { ...p, phase: progPhase };
        win?.webContents.send('preview:progress', payload);
      };

      const fullCached = async () => {
        try {
          await fs.access(fullPath);
          return {
            ok: true as const,
            path: fullPath,
            url: 'submixer://preview?path=' + encodeURIComponent(fullPath),
            cached: true,
            tier: 'full' as const,
          };
        } catch {
          return null;
        }
      };

      if (phase === 'quick') {
        const hit = await fullCached();
        if (hit) return hit;

        try {
          await fs.access(quickPath);
          return {
            ok: true,
            path: quickPath,
            url: 'submixer://preview?path=' + encodeURIComponent(quickPath),
            cached: true,
            tier: 'quick',
            limitSec: quickSec,
          };
        } catch {
          /* extract quick */
        }

        const outPath = await extractAudioPreview(
          args.filePath,
          args.trackIndex,
          `${id}.quick`,
          (p) => sendProgress(p, 'quick'),
          args.durationSec,
          quickSec
        );
        return {
          ok: true,
          path: outPath,
          url: 'submixer://preview?path=' + encodeURIComponent(outPath),
          cached: false,
          tier: 'quick',
          limitSec: quickSec,
        };
      }

      const hit = await fullCached();
      if (hit) return hit;

      const outPath = await extractAudioPreview(
        args.filePath,
        args.trackIndex,
        id,
        (p) => sendProgress(p, 'full'),
        args.durationSec
      );
      return {
        ok: true,
        path: outPath,
        url: 'submixer://preview?path=' + encodeURIComponent(outPath),
        cached: false,
        tier: 'full',
      };
    } catch (err) {
      log.warn('preview:extract failed', {
        phase: args.phase ?? 'full',
        error: (err as Error).message,
      });
      return { ok: false, error: (err as Error).message };
    }
  });

  // ── Export ───────────────────────────────────────────────────────────────
  ipcMain.handle('export:run', async (event, plan: ExportPlan, durationSec: number, externalSubs: {
    path: string; offset: number; speed: number; encoding?: string;
  }[]) => {
    const win = senderWindow(event);
    try {
      assertString(plan?.inputFile, 'plan.inputFile');
      assertAbsPath(plan.inputFile, 'plan.inputFile');
      assertString(plan?.outputPath, 'plan.outputPath');
      assertAbsPath(plan.outputPath, 'plan.outputPath');
      const planError = validateExportPlan(plan);
      if (planError) {
        return { ok: false, code: null, cancelled: false, error: planError };
      }

      // Normalize external subs to temp SRT (handles VTT/ASS + offset/speed + encoding)
      const processed = await prepareExternalSubs(externalSubs);

      const result = await runExport(
        plan,
        processed,
        durationSec,
        (p) => win?.webContents.send('export:progress', p),
        (line) => win?.webContents.send('export:log', line)
      );

      // Reconstruct plan with original sub paths for history (temp paths are gone after clearTempSrt)
      const planForHistory = {
        ...plan,
        externalSubs: plan.externalSubs.map((s, i) => ({
          ...s,
          path: externalSubs[i]?.path ?? s.path,
        })),
      };
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
          plan: planForHistory,
          durationSec,
        });
      } else if (!result.cancelled) {
        const now = new Date();
        await addHistoryEntry({
          name: path.basename(plan.outputPath),
          path: plan.outputPath,
          size: '—',
          time: now.toTimeString().slice(0, 8),
          ok: false,
          plan: planForHistory,
          durationSec,
        });
      }
      // Clean up the temp SRTs after export
      await clearTempSrt();
      return {
        ok: result.ok,
        code: result.code,
        cancelled: result.cancelled,
        error: result.error,
      };
    } catch (err) {
      return { ok: false, code: null, cancelled: false, error: (err as Error).message };
    }
  });

  ipcMain.handle('export:cancel', async () => {
    return cancelActiveExport();
  });

  ipcMain.handle('export:cmdString', async (_e, plan: ExportPlan) => {
    const processed = await prepareExternalSubs(plan.externalSubs);
    try {
      return buildCommandString(plan, processed);
    } finally {
      await clearTempSrt();
    }
  });

  // ── Settings + history ───────────────────────────────────────────────────
  ipcMain.handle('settings:get', async () => getSettings());
  ipcMain.handle('settings:setOne', async <K extends keyof AppSettings>(event: IpcMainInvokeEvent, key: K, value: AppSettings[K]) => {
    const updated = await setSetting(key, value);
    if (key === 'lang') {
      const win = senderWindow(event);
      if (win) buildMenu(win, value as 'he' | 'en');
    }
    return updated;
  });
  ipcMain.handle('settings:setMany', async (event, patch: Partial<AppSettings>) => {
    const updated = await setSettings(patch);
    if (patch.lang !== undefined) {
      const win = senderWindow(event);
      if (win) buildMenu(win, patch.lang);
    }
    return updated;
  });

  ipcMain.handle('history:list', async () => (await getSettings()).history);
  ipcMain.handle('history:clear', async () => clearHistory());

  ipcMain.handle('shell:openPath', async (_e, p: string) => shell.openPath(p));
  ipcMain.handle('shell:showItem', async (_e, p: string) => shell.showItemInFolder(p));
  ipcMain.handle('shell:userData', async () => userDataPath());

  ipcMain.handle('app:platform', async () => process.platform);
  ipcMain.handle('app:version', async () => app.getVersion());

  ipcMain.handle('app:nativeTheme', async () =>
    nativeTheme.shouldUseDarkColors ? 'dark' : 'light'
  );

  nativeTheme.on('updated', () => {
    const resolved = nativeTheme.shouldUseDarkColors ? 'dark' : 'light';
    BrowserWindow.getAllWindows().forEach((w) =>
      w.webContents.send('nativeTheme:updated', resolved)
    );
  });
}

const MEDIA_MIME: Record<string, string> = {
  '.mkv': 'video/webm',
  '.webm': 'video/webm',
  '.mp4': 'video/mp4',
  '.m4v': 'video/mp4',
  '.mov': 'video/quicktime',
  '.avi': 'video/x-msvideo',
  '.ts': 'video/mp2t',
};

const PREVIEW_MIME: Record<string, string> = {
  '.mp3': 'audio/mpeg',
  '.m4a': 'audio/mp4',
  '.aac': 'audio/aac',
  '.ogg': 'audio/ogg',
};

async function servePreview(filePath: string, request: Request): Promise<Response> {
  const root = path.resolve(userDataPath());
  const resolved = path.resolve(filePath);
  const rel = path.relative(root, resolved);
  if (!rel || rel.startsWith('..') || path.isAbsolute(rel)) {
    return new Response('Forbidden', { status: 403 });
  }
  let stat;
  try {
    stat = await fs.stat(resolved);
  } catch {
    return new Response('Not found', { status: 404 });
  }
  const total = stat.size;
  const ext = path.extname(resolved).toLowerCase();
  const contentType = PREVIEW_MIME[ext] || 'application/octet-stream';

  const rangeHeader = request.headers.get('range');
  let start = 0;
  let end = total - 1;
  let status = 200;
  if (rangeHeader) {
    const m = rangeHeader.match(/bytes=(\d*)-(\d*)/);
    if (m) {
      if (m[1]) start = parseInt(m[1], 10);
      if (m[2]) end = parseInt(m[2], 10);
      if (Number.isNaN(start) || Number.isNaN(end) || start > end || start >= total) {
        return new Response('Range Not Satisfiable', {
          status: 416,
          headers: { 'Content-Range': `bytes */${total}` },
        });
      }
      if (end >= total) end = total - 1;
      status = 206;
    }
  }

  const length = end - start + 1;
  const nodeStream = createReadStream(resolved, { start, end });
  const webStream = Readable.toWeb(nodeStream) as unknown as ReadableStream;

  const headers: Record<string, string> = {
    'Content-Type': contentType,
    'Accept-Ranges': 'bytes',
    'Content-Length': String(length),
    'Cache-Control': 'no-store',
  };
  if (status === 206) {
    headers['Content-Range'] = `bytes ${start}-${end}/${total}`;
  }
  return new Response(webStream, { status, headers });
}

async function serveMedia(filePath: string, request: Request): Promise<Response> {
  const resolved = path.resolve(filePath);
  if (!allowedMediaPaths.has(resolved)) {
    return new Response('Forbidden', { status: 403 });
  }
  let stat;
  try {
    stat = await fs.stat(resolved);
  } catch {
    return new Response('Not found', { status: 404 });
  }
  const total = stat.size;
  const ext = path.extname(resolved).toLowerCase();
  const contentType = MEDIA_MIME[ext] || 'application/octet-stream';

  const rangeHeader = request.headers.get('range');
  let start = 0;
  let end = total - 1;
  let status = 200;
  if (rangeHeader) {
    const m = rangeHeader.match(/bytes=(\d*)-(\d*)/);
    if (m) {
      if (m[1]) start = parseInt(m[1], 10);
      if (m[2]) end = parseInt(m[2], 10);
      if (Number.isNaN(start) || Number.isNaN(end) || start > end || start >= total) {
        return new Response('Range Not Satisfiable', {
          status: 416,
          headers: { 'Content-Range': `bytes */${total}` },
        });
      }
      if (end >= total) end = total - 1;
      status = 206;
    }
  }

  const length = end - start + 1;
  const nodeStream = createReadStream(resolved, { start, end });
  const webStream = Readable.toWeb(nodeStream) as unknown as ReadableStream;

  const headers: Record<string, string> = {
    'Content-Type': contentType,
    'Accept-Ranges': 'bytes',
    'Content-Length': String(length),
    'Cache-Control': 'no-store',
  };
  if (status === 206) {
    headers['Content-Range'] = `bytes ${start}-${end}/${total}`;
  }
  return new Response(webStream, { status, headers });
}

/** Register `submixer://` — preview audio under userData, video via whitelist. */
export function registerPreviewProtocol(): void {
  protocol.handle('submixer', async (request) => {
    try {
      const url = new URL(request.url);
      const route = url.hostname || 'preview';
      const fromQuery = url.searchParams.get('path');
      const fromPath = decodeURIComponent(url.pathname.replace(/^\//, ''));
      const filePath = fromQuery ?? fromPath;
      if (!filePath) return new Response('Missing path', { status: 400 });

      if (route === 'media') return serveMedia(filePath, request);
      return servePreview(filePath, request);
    } catch (err) {
      return new Response((err as Error).message, { status: 500 });
    }
  });
}
