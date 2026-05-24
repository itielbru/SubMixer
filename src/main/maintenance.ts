import { promises as fs } from 'fs';
import * as path from 'path';
import { app } from 'electron';
import log from './logger';
import { clearTempSrt } from './srt';

// Caches are reusable across sessions, so we evict by age only when over budget
// instead of wiping them on every launch.
const PREVIEW_CACHE_MAX = 500 * 1024 * 1024; // 500 MB (extracted audio previews)
const PEAKS_CACHE_MAX = 200 * 1024 * 1024; // 200 MB (waveform peaks)

/** Delete oldest files in `dir` until its total size is under `maxBytes`. */
async function enforceCacheQuota(dir: string, maxBytes: number): Promise<void> {
  let names: string[];
  try {
    names = await fs.readdir(dir);
  } catch {
    return; // dir not created yet
  }

  const files: { full: string; size: number; mtime: number }[] = [];
  let total = 0;
  for (const name of names) {
    const full = path.join(dir, name);
    try {
      const st = await fs.stat(full);
      if (!st.isFile()) continue;
      files.push({ full, size: st.size, mtime: st.mtimeMs });
      total += st.size;
    } catch {
      /* ignore unreadable entries */
    }
  }

  if (total <= maxBytes) return;

  files.sort((a, b) => a.mtime - b.mtime); // oldest first
  let evicted = 0;
  for (const f of files) {
    if (total <= maxBytes) break;
    try {
      await fs.unlink(f.full);
      total -= f.size;
      evicted++;
    } catch {
      /* ignore */
    }
  }
  log.info('Cache quota enforced', { dir, evicted, remainingBytes: total });
}

/**
 * Best-effort housekeeping at startup: remove orphaned transient files left by
 * a crash mid-export, and keep reusable caches within their size budgets.
 * Never throws — failures are logged and ignored.
 */
export async function runStartupMaintenance(): Promise<void> {
  const userData = app.getPath('userData');
  try {
    await clearTempSrt(); // ephemeral transformed SRTs (safe to drop)
    await enforceCacheQuota(path.join(userData, 'temp', 'preview'), PREVIEW_CACHE_MAX);
    await enforceCacheQuota(path.join(userData, 'peaks-cache'), PEAKS_CACHE_MAX);
  } catch (err) {
    log.warn('Startup maintenance failed', (err as Error).message);
  }
}
