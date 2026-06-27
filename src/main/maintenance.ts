import { promises as fs } from 'fs';
import * as path from 'path';
import { app } from 'electron';
import log from './logger';
import { clearTempSrt } from './srt';
import {
  PREVIEW_CACHE_MAX_BYTES as PREVIEW_CACHE_MAX,
  PEAKS_CACHE_MAX_BYTES as PEAKS_CACHE_MAX,
  PEAKS_CACHE_TTL_MS as PEAKS_TTL_MS,
} from '@shared/config';

// Caches are reusable across sessions, so we evict by age only when over budget
// instead of wiping them on every launch.

/** Delete cache files older than `maxAgeMs` (by whichever of mtime/atime is more recent). */
export async function evictByAge(dir: string, maxAgeMs: number): Promise<void> {
  let names: string[];
  try {
    names = await fs.readdir(dir);
  } catch {
    return;
  }
  const cutoff = Date.now() - maxAgeMs;
  let evicted = 0;
  for (const name of names) {
    const full = path.join(dir, name);
    try {
      const st = await fs.stat(full);
      if (!st.isFile()) continue;
      if (Math.max(st.atimeMs, st.mtimeMs) < cutoff) {
        await fs.unlink(full);
        evicted++;
      }
    } catch {
      /* ignore */
    }
  }
  if (evicted > 0) log.info('TTL eviction', { dir, evicted });
}

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
    await evictByAge(path.join(userData, 'peaks-cache'), PEAKS_TTL_MS);
    await enforceCacheQuota(path.join(userData, 'temp', 'preview'), PREVIEW_CACHE_MAX);
    await enforceCacheQuota(path.join(userData, 'peaks-cache'), PEAKS_CACHE_MAX);
  } catch (err) {
    log.warn('Startup maintenance failed', (err as Error).message);
  }
}
