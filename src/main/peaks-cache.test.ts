import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { promises as fs } from 'fs';
import * as os from 'os';
import * as path from 'path';
import { loadCached, saveCached, type PeaksEntry } from './peaks-cache';

// A real source file is needed because the cache key includes its stat (size/mtime).
let srcFile: string;

beforeAll(async () => {
  srcFile = path.join(os.tmpdir(), `submixer-peaks-src-${Date.now()}.bin`);
  await fs.writeFile(srcFile, Buffer.from('audio-bytes'));
});

afterAll(async () => {
  await fs.unlink(srcFile).catch(() => null);
});

const entry = (): PeaksEntry => ({
  peaksPerSec: 100,
  durationSec: 12.5,
  min: new Float32Array([-0.1, -0.5, -0.9]),
  max: new Float32Array([0.2, 0.6, 1.0]),
});

describe('peaks-cache', () => {
  it('round-trips a saved entry through the versioned binary format', async () => {
    const e = entry();
    await saveCached(srcFile, 0, e);
    const loaded = await loadCached(srcFile, 0);
    expect(loaded).not.toBeNull();
    expect(loaded!.peaksPerSec).toBe(e.peaksPerSec);
    expect(loaded!.durationSec).toBeCloseTo(e.durationSec);
    expect(Array.from(loaded!.min)).toEqual(Array.from(e.min));
    expect(Array.from(loaded!.max)).toEqual(Array.from(e.max));
  });

  it('returns null for a missing entry', async () => {
    const loaded = await loadCached(srcFile, 999);
    expect(loaded).toBeNull();
  });
});
