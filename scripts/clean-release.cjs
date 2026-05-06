/**
 * Removes release/ so electron-builder can repackage without fighting a locked app.asar.
 * Run manually if build fails: node scripts/clean-release.cjs
 */
const fs = require('fs');
const path = require('path');

const dir = path.join(__dirname, '..', 'release');

if (!fs.existsSync(dir)) {
  process.exit(0);
}

try {
  fs.rmSync(dir, { recursive: true, force: true });
  console.log('[clean-release] removed release/');
} catch (err) {
  const msg = err instanceof Error ? err.message : String(err);
  console.error('[clean-release] Could not remove release/: ' + msg);
  console.error('');
  console.error('Close SubMixer and any app run from release\\win-unpacked\\');
  console.error('Task Manager: end SubMixer.exe / Electron if still running.');
  console.error('Close Explorer windows on the SubMixer\\release folder, then retry.');
  process.exit(1);
}
