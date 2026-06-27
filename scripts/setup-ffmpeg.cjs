/**
 * Download FFmpeg + FFprobe static builds into ffmpeg-bin/ for the current OS.
 *
 *   node scripts/setup-ffmpeg.cjs
 *
 * Per-platform sources:
 *   - Windows x64 : gyan.dev release-essentials zip (ffmpeg.exe + ffprobe.exe)
 *   - macOS       : evermeet.cx — one zip per binary
 *   - Linux x64   : johnvansickle.com amd64 static tarball (both binaries)
 *
 * If the platform's binaries already exist in ffmpeg-bin/, the download is
 * skipped. On macOS/Linux a system ffmpeg on PATH is also a valid fallback
 * (see findBinaries in src/main/ffmpeg.ts), so this script is optional there.
 */
const https = require('https');
const http = require('http');
const fs = require('fs');
const path = require('path');
const os = require('os');
const { execSync } = require('child_process');

const ROOT = path.join(__dirname, '..');
const DEST = path.join(ROOT, 'ffmpeg-bin');
const isWin = process.platform === 'win32';
const isMac = process.platform === 'darwin';
const exe = isWin ? '.exe' : '';

// Each source is one archive to fetch; `binaries` lists which executables to
// pull out of it. `kind` selects the extractor.
const SOURCES = {
  win32: [
    {
      url: 'https://www.gyan.dev/ffmpeg/builds/ffmpeg-release-essentials.zip',
      kind: 'zip',
      binaries: ['ffmpeg.exe', 'ffprobe.exe'],
    },
  ],
  darwin: [
    { url: 'https://evermeet.cx/ffmpeg/getrelease/ffmpeg/zip', kind: 'zip', binaries: ['ffmpeg'] },
    { url: 'https://evermeet.cx/ffmpeg/getrelease/ffprobe/zip', kind: 'zip', binaries: ['ffprobe'] },
  ],
  linux: [
    {
      url: 'https://johnvansickle.com/ffmpeg/releases/ffmpeg-release-amd64-static.tar.xz',
      kind: 'tar',
      binaries: ['ffmpeg', 'ffprobe'],
    },
  ],
};

function platformKey() {
  if (isWin) return 'win32';
  if (isMac) return 'darwin';
  return 'linux';
}

function download(url, dest) {
  return new Promise((resolve, reject) => {
    const file = fs.createWriteStream(dest);
    const get = url.startsWith('https') ? https.get : http.get;
    get(url, (res) => {
      if (res.statusCode && res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
        file.close();
        fs.unlinkSync(dest);
        return resolve(download(res.headers.location, dest));
      }
      if (res.statusCode !== 200) {
        file.close();
        fs.unlinkSync(dest);
        return reject(new Error(`Download failed: HTTP ${res.statusCode} for ${url}`));
      }
      res.pipe(file);
      file.on('finish', () => file.close(resolve));
    }).on('error', (err) => {
      file.close();
      fs.unlink(dest, () => reject(err));
    });
  });
}

function extract(kind, archivePath, outDir) {
  fs.mkdirSync(outDir, { recursive: true });
  if (kind === 'zip') {
    if (isWin) {
      execSync(
        `powershell -NoProfile -Command "Expand-Archive -Path '${archivePath.replace(/'/g, "''")}' -DestinationPath '${outDir.replace(/'/g, "''")}' -Force"`,
        { stdio: 'inherit' }
      );
    } else {
      execSync(`unzip -o "${archivePath}" -d "${outDir}"`, { stdio: 'inherit' });
    }
  } else if (kind === 'tar') {
    execSync(`tar -xf "${archivePath}" -C "${outDir}"`, { stdio: 'inherit' });
  } else {
    throw new Error(`Unknown archive kind: ${kind}`);
  }
}

function findFile(dir, name) {
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  for (const e of entries) {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) {
      const nested = findFile(p, name);
      if (nested) return nested;
    } else if (e.name === name) {
      return p;
    }
  }
  return null;
}

async function main() {
  fs.mkdirSync(DEST, { recursive: true });

  const wanted = [`ffmpeg${exe}`, `ffprobe${exe}`];
  if (wanted.every((f) => fs.existsSync(path.join(DEST, f)))) {
    console.log(`ffmpeg-bin/ already contains ${wanted.join(' + ')} — skipping download.`);
    return;
  }

  const sources = SOURCES[platformKey()];
  if (!sources) {
    console.error(`Unsupported platform: ${process.platform}. Install ffmpeg/ffprobe on PATH.`);
    process.exit(1);
  }

  const work = fs.mkdtempSync(path.join(os.tmpdir(), 'submixer-ffmpeg-'));
  try {
    for (let i = 0; i < sources.length; i++) {
      const src = sources[i];
      const archive = path.join(work, `dl-${i}`);
      const outDir = path.join(work, `ex-${i}`);
      console.log(`Downloading ${src.url} …`);
      await download(src.url, archive);
      console.log('Extracting…');
      extract(src.kind, archive, outDir);

      for (const bin of src.binaries) {
        const found = findFile(outDir, bin);
        if (!found) throw new Error(`Could not find ${bin} inside ${src.url}`);
        const target = path.join(DEST, bin);
        fs.copyFileSync(found, target);
        if (!isWin) fs.chmodSync(target, 0o755);
        console.log(`Installed ${bin}`);
      }
    }
    console.log('Done. FFmpeg binaries are ready in ffmpeg-bin/');
  } finally {
    fs.rmSync(work, { recursive: true, force: true });
  }
}

main().catch((err) => {
  console.error(err.message || err);
  process.exit(1);
});
