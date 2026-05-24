/**
 * Download FFmpeg essentials (Windows x64) into ffmpeg-bin/.
 * Usage: node scripts/setup-ffmpeg.cjs
 */
const https = require('https');
const http = require('http');
const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const ROOT = path.join(__dirname, '..');
const DEST = path.join(ROOT, 'ffmpeg-bin');
const ZIP_URL = 'https://www.gyan.dev/ffmpeg/builds/ffmpeg-release-essentials.zip';
const ZIP_PATH = path.join(ROOT, '.ffmpeg-download.zip');
const EXTRACT_DIR = path.join(ROOT, '.ffmpeg-extract');

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
        return reject(new Error(`Download failed: HTTP ${res.statusCode}`));
      }
      res.pipe(file);
      file.on('finish', () => file.close(resolve));
    }).on('error', (err) => {
      file.close();
      fs.unlink(dest, () => reject(err));
    });
  });
}

function findBinDir(dir) {
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  for (const e of entries) {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) {
      if (e.name === 'bin') return p;
      const nested = findBinDir(p);
      if (nested) return nested;
    }
  }
  return null;
}

async function main() {
  fs.mkdirSync(DEST, { recursive: true });

  const existing = ['ffmpeg.exe', 'ffprobe.exe'].every((f) => fs.existsSync(path.join(DEST, f)));
  if (existing) {
    console.log('ffmpeg-bin/ already contains ffmpeg.exe and ffprobe.exe — skipping download.');
    return;
  }

  console.log('Downloading FFmpeg essentials…');
  await download(ZIP_URL, ZIP_PATH);

  console.log('Extracting…');
  if (fs.existsSync(EXTRACT_DIR)) fs.rmSync(EXTRACT_DIR, { recursive: true, force: true });
  fs.mkdirSync(EXTRACT_DIR, { recursive: true });
  execSync(
    `powershell -NoProfile -Command "Expand-Archive -Path '${ZIP_PATH.replace(/'/g, "''")}' -DestinationPath '${EXTRACT_DIR.replace(/'/g, "''")}' -Force"`,
    { stdio: 'inherit' }
  );

  const binDir = findBinDir(EXTRACT_DIR);
  if (!binDir) throw new Error('Could not find bin/ inside the downloaded archive');

  for (const exe of ['ffmpeg.exe', 'ffprobe.exe']) {
    fs.copyFileSync(path.join(binDir, exe), path.join(DEST, exe));
    console.log(`Installed ${exe}`);
  }

  fs.unlinkSync(ZIP_PATH);
  fs.rmSync(EXTRACT_DIR, { recursive: true, force: true });
  console.log('Done. FFmpeg binaries are ready in ffmpeg-bin/');
}

main().catch((err) => {
  console.error(err.message || err);
  process.exit(1);
});
