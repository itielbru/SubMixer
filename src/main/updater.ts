import { app, BrowserWindow } from 'electron';
import pkg from 'electron-updater';
import log from './logger';

// electron-updater ships as CommonJS; destructure the default export for ESM.
const { autoUpdater } = pkg;

/** Send an update lifecycle event to the focused/first renderer window. */
function notifyRenderer(channel: string, payload?: unknown): void {
  BrowserWindow.getAllWindows()[0]?.webContents.send(channel, payload);
}

/**
 * Wire up auto-updates against the GitHub Releases provider configured in
 * `electron-builder.yml`. Only runs in packaged builds — in dev there is no
 * update feed and `app.isPackaged` is false.
 *
 * Flow: we check on startup and notify the renderer when an update is available.
 * Download is user-initiated (`downloadUpdate`) so the user stays in control;
 * once downloaded we notify again and the user can apply it via `installUpdate`.
 * Note: on Windows, applying an update requires the build to be code-signed and
 * `verifyUpdateCodeSignature` enabled; until a certificate is configured,
 * updates download but signature verification is skipped (see the yml).
 */
export function initAutoUpdate(): void {
  if (!app.isPackaged) {
    log.info('Auto-update disabled (not packaged)');
    return;
  }

  autoUpdater.logger = log;
  autoUpdater.autoDownload = false;
  autoUpdater.autoInstallOnAppQuit = true;

  autoUpdater.on('checking-for-update', () => log.info('Checking for updates…'));
  autoUpdater.on('update-available', (info) => {
    log.info('Update available', info?.version);
    notifyRenderer('update:available', info?.version ?? '');
  });
  autoUpdater.on('update-not-available', () => log.info('No update available'));
  autoUpdater.on('download-progress', (p) => {
    notifyRenderer('update:progress', Math.round(p?.percent ?? 0));
  });
  autoUpdater.on('update-downloaded', (info) => {
    log.info('Update downloaded', info?.version);
    notifyRenderer('update:downloaded', info?.version ?? '');
  });
  autoUpdater.on('error', (err) => {
    const msg = err?.message ?? String(err);
    log.warn('Auto-update error', msg);
    notifyRenderer('update:error', msg);
  });

  autoUpdater
    .checkForUpdates()
    .catch((err) => log.warn('checkForUpdates failed', err?.message ?? String(err)));
}

/** Begin downloading the available update (user-initiated). */
export function downloadUpdate(): void {
  autoUpdater.downloadUpdate().catch((err) => {
    const msg = err?.message ?? String(err);
    log.warn('downloadUpdate failed', msg);
    notifyRenderer('update:error', msg);
  });
}

/** Quit and apply a downloaded update. */
export function installUpdate(): void {
  autoUpdater.quitAndInstall();
}
