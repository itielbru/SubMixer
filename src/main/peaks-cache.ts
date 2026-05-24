import { promises as fs } from 'fs';
import { createHash } from 'crypto';
import * as path from 'path';
import { app } from 'electron';

const cacheDir = (): string => path.join(app.getPath('userData'), 'peaks-cache');

async function hashKey(filePath: string, trackIndex: number): Promise<string> {
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

export interface PeaksEntry {
  peaksPerSec: number;
  durationSec: number;
  min: Float32Array;
  max: Float32Array;
}

// Layout: [u32 magic | u32 version | u32 peaksPerSec | f64 durationSec | u32 length
//          | f32 min[length] | f32 max[length]]
// The magic + version prefix lets us evolve the on-disk format safely: any
// mismatch is treated as a cache miss and the peaks are recomputed.
const MAGIC = 0x534d5046; // "SMPF"
const VERSION = 1;
const HEADER_SIZE = 4 + 4 + 4 + 8 + 4;

export async function loadCached(filePath: string, trackIndex: number): Promise<PeaksEntry | null> {
  try {
    const key = await hashKey(filePath, trackIndex);
    const file = path.join(cacheDir(), `${key}.bin`);
    const buf = await fs.readFile(file);
    if (buf.byteLength < HEADER_SIZE) return null;
    const dv = new DataView(buf.buffer, buf.byteOffset, buf.byteLength);
    if (dv.getUint32(0, true) !== MAGIC || dv.getUint32(4, true) !== VERSION) return null;
    const peaksPerSec = dv.getUint32(8, true);
    const durationSec = dv.getFloat64(12, true);
    const length = dv.getUint32(20, true);
    const need = HEADER_SIZE + length * 2 * 4;
    if (buf.byteLength < need) return null;
    // Float32Array views must be 4-byte aligned. Copy to a fresh buffer.
    const copy = new ArrayBuffer(length * 2 * 4);
    new Uint8Array(copy).set(new Uint8Array(buf.buffer, buf.byteOffset + HEADER_SIZE, length * 2 * 4));
    const min = new Float32Array(copy, 0, length);
    const max = new Float32Array(copy, length * 4, length);
    return { peaksPerSec, durationSec, min, max };
  } catch {
    return null;
  }
}

export async function saveCached(
  filePath: string,
  trackIndex: number,
  entry: PeaksEntry
): Promise<void> {
  try {
    await fs.mkdir(cacheDir(), { recursive: true });
    const key = await hashKey(filePath, trackIndex);
    const file = path.join(cacheDir(), `${key}.bin`);
    const length = entry.min.length;
    const buf = Buffer.alloc(HEADER_SIZE + length * 2 * 4);
    const dv = new DataView(buf.buffer, buf.byteOffset, buf.byteLength);
    dv.setUint32(0, MAGIC, true);
    dv.setUint32(4, VERSION, true);
    dv.setUint32(8, entry.peaksPerSec, true);
    dv.setFloat64(12, entry.durationSec, true);
    dv.setUint32(20, length, true);
    // Write min then max as contiguous f32 blocks.
    Buffer.from(entry.min.buffer, entry.min.byteOffset, length * 4).copy(buf, HEADER_SIZE);
    Buffer.from(entry.max.buffer, entry.max.byteOffset, length * 4).copy(buf, HEADER_SIZE + length * 4);
    await fs.writeFile(file, buf);
  } catch {
    // best-effort cache; ignore failures
  }
}
