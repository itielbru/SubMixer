import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { promises as fs } from 'fs';
import * as os from 'os';
import * as path from 'path';
import { evictByAge } from './maintenance';

let tmpDir: string;

beforeAll(async () => {
  tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), 'submixer-maint-'));
});

afterAll(async () => {
  await fs.rm(tmpDir, { recursive: true, force: true }).catch(() => null);
});

async function writeFile(name: string, content = 'x'): Promise<string> {
  const p = path.join(tmpDir, name);
  await fs.writeFile(p, content);
  return p;
}

async function setMtime(filePath: string, msAgo: number): Promise<void> {
  const t = new Date(Date.now() - msAgo);
  await fs.utimes(filePath, t, t);
}

describe('evictByAge', () => {
  it('does nothing when dir does not exist', async () => {
    await expect(evictByAge(path.join(tmpDir, 'nonexistent'), 1000)).resolves.toBeUndefined();
  });

  it('deletes files older than maxAgeMs', async () => {
    const old = await writeFile('old.bin');
    await setMtime(old, 40 * 24 * 60 * 60 * 1000); // 40 days ago

    await evictByAge(tmpDir, 30 * 24 * 60 * 60 * 1000); // 30-day TTL

    await expect(fs.access(old)).rejects.toThrow();
  });

  it('keeps files newer than maxAgeMs', async () => {
    const fresh = await writeFile('fresh.bin');
    // mtime is now — well within TTL

    await evictByAge(tmpDir, 30 * 24 * 60 * 60 * 1000);

    await expect(fs.access(fresh)).resolves.toBeUndefined();
  });

  it('does not delete subdirectories', async () => {
    const subDir = path.join(tmpDir, 'subdir');
    await fs.mkdir(subDir, { recursive: true });
    // age the subdir's timestamps
    const t = new Date(Date.now() - 40 * 24 * 60 * 60 * 1000);
    await fs.utimes(subDir, t, t);

    await evictByAge(tmpDir, 1000); // very short TTL

    await expect(fs.access(subDir)).resolves.toBeUndefined();
  });
});
