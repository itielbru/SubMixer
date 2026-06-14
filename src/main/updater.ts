import { app, BrowserWindow } from 'electron';
import pkg from 'electron-updater';
import log from './logger';

// electron-updater ships as CommonJS; destructure the default export for ESM.
const { autoUpdater } = pkg;

/**
 * Wire up auto-updates against the GitHub Releases provider configured in
 * `electron-builder.yml`. Only runs in packaged builds — in dev there is no
 * update feed and `app.isPackaged` is false.
 *
 * Updates download in the background and install on the next quit. Note: on
 * Windows, applying an update requires the build to be code-signed and
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
    BrowserWindow.getAllWindows()[0]?.webContents.send('update:available', info?.version ?? '');
  });
  autoUpdater.on('update-not-available', () => log.info('No update available'));
  autoUpdater.on('update-downloaded', (info) => log.info('Update downloaded', info?.version));
  autoUpdater.on('error', (err) => log.warn('Auto-update error', err?.message ?? String(err)));

  autoUpdater
    .checkForUpdatesAndNotify()
    .catch((err) => log.warn('checkForUpdates failed', err?.message ?? String(err)));
}
