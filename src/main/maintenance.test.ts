import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { promises as fs } from 'fs';
import * as os from 'os';
import * as path from 'path';
import { evictByAge, enforceCacheQuota } from './maintenance';

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

describe('enforceCacheQuota', () => {
  let quotaDir: string;

  beforeAll(async () => {
    quotaDir = await fs.mkdtemp(path.join(os.tmpdir(), 'submixer-quota-'));
  });

  afterAll(async () => {
    await fs.rm(quotaDir, { recursive: true, force: true }).catch(() => null);
  });

  const write = (name: string, bytes: number): Promise<void> =>
    fs.writeFile(path.join(quotaDir, name), 'x'.repeat(bytes));

  it('does nothing when dir does not exist', async () => {
    await expect(
      enforceCacheQuota(path.join(quotaDir, 'nonexistent'), 1000),
    ).resolves.toBeUndefined();
  });

  it('keeps all files when total size is under budget', async () => {
    await write('a.bin', 100);
    await write('b.bin', 100);

    await enforceCacheQuota(quotaDir, 10_000); // well above 200 bytes

    await expect(fs.access(path.join(quotaDir, 'a.bin'))).resolves.toBeUndefined();
    await expect(fs.access(path.join(quotaDir, 'b.bin'))).resolves.toBeUndefined();
  });

  it('evicts oldest files first until under budget', async () => {
    await fs.rm(quotaDir, { recursive: true, force: true });
    await fs.mkdir(quotaDir, { recursive: true });

    await write('old.bin', 600);
    await write('new.bin', 600);
    // make old.bin the oldest
    const past = new Date(Date.now() - 60 * 60 * 1000);
    await fs.utimes(path.join(quotaDir, 'old.bin'), past, past);

    await enforceCacheQuota(quotaDir, 1000); // total 1200 > 1000 → drop oldest

    await expect(fs.access(path.join(quotaDir, 'old.bin'))).rejects.toThrow();
    await expect(fs.access(path.join(quotaDir, 'new.bin'))).resolves.toBeUndefined();
  });

  it('ignores subdirectories when summing usage', async () => {
    await fs.rm(quotaDir, { recursive: true, force: true });
    await fs.mkdir(quotaDir, { recursive: true });
    await fs.mkdir(path.join(quotaDir, 'nested'), { recursive: true });
    await write('only.bin', 100);

    await enforceCacheQuota(quotaDir, 10_000);

    await expect(fs.access(path.join(quotaDir, 'only.bin'))).resolves.toBeUndefined();
    await expect(fs.access(path.join(quotaDir, 'nested'))).resolves.toBeUndefined();
  });
});
