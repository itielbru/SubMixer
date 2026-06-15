/** Release notes keyed by version, shown in the "What's New" modal. */
export const CHANGELOG_NOTES: Readonly<Record<string, readonly string[]>> = {
  '1.1.1': [
    'System Diagnostics (Help menu) — app/Electron/Node versions, FFmpeg path, cache sizes',
    'Update notifications — banner prompts to download and restart when a new version is ready',
    'Disk-space pre-check before export — clear warning if the drive is too full',
    'Help menu: Open Logs Folder and Report a Bug with pre-filled system info',
    'Security: sandboxed renderer, curated IPC surface, CodeQL scanning, Dependabot',
    'CI gates: format check, audit, coverage thresholds, pre-commit hooks',
    'FFprobe timeout (60 s) prevents hangs on malformed media files',
  ],
  '1.1.0': [
    'Batch export queue — queue multiple jobs, run them sequentially',
    'Desktop notifications on export or batch complete',
    'Re-export from history — repeat a previous export without reloading the file',
    'Drag and drop subtitle files onto the drawer to add them',
    'Overrun warning for cues that extend past the video end',
    'System theme support — follows OS dark/light mode',
    'Electron 42 with Chromium 130+ and Node 22+',
  ],
};
