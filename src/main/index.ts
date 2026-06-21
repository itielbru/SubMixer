import { app, BrowserWindow, shell, dialog, protocol } from 'electron';
import { join } from 'path';
import { electronApp, optimizer, is } from '@electron-toolkit/utils';
import { registerIpc, registerPreviewProtocol } from './ipc';
import { buildMenu } from './menu';
import { findBinaries, killActiveProcesses } from './ffmpeg';
import { clearTempSrt } from './srt';
import { getSettings } from './store';
import { initLogger } from './logger';
import { runStartupMaintenance } from './maintenance';
import { initAutoUpdate } from './updater';
import log from './logger';
import { t } from '@shared/i18n';

initLogger();

// Register the custom protocol BEFORE app is ready so it's privileged.
protocol.registerSchemesAsPrivileged([
  {
    scheme: 'submixer',
    privileges: { standard: true, secure: true, supportFetchAPI: true, stream: true },
  },
]);

let mainWindow: BrowserWindow | null = null;

async function createWindow(): Promise<void> {
  mainWindow = new BrowserWindow({
    width: 1440,
    height: 900,
    minWidth: 1100,
    minHeight: 680,
    // Treat the sizes above as the web viewport (content), not the outer frame,
    // so the renderer never receives a smaller area than expected and clips its
    // fixed-width columns.
    useContentSize: true,
    show: false,
    autoHideMenuBar: false,
    backgroundColor: '#0d0e11',
    title: 'SubMixer',
    icon: join(__dirname, '../../build/icon.ico'),
    webPreferences: {
      preload: join(__dirname, '../preload/index.js'),
      sandbox: false,
      contextIsolation: true,
      nodeIntegration: false,
    },
  });

  mainWindow.on('ready-to-show', () => {
    mainWindow?.show();
  });

  mainWindow.webContents.setWindowOpenHandler((details) => {
    shell.openExternal(details.url);
    return { action: 'deny' };
  });

  if (is.dev && process.env['ELECTRON_RENDERER_URL']) {
    mainWindow.loadURL(process.env['ELECTRON_RENDERER_URL']);
  } else {
    mainWindow.loadFile(join(__dirname, '../renderer/index.html'));
  }

  const s = await getSettings();
  buildMenu(mainWindow, s.lang);
}

app.whenReady().then(async () => {
  electronApp.setAppUserModelId('com.itiel.submixer');

  app.on('browser-window-created', (_, window) => {
    optimizer.watchWindowShortcuts(window);
  });

  registerPreviewProtocol();
  registerIpc();

  createWindow();

  // Best-effort housekeeping (orphaned temp files, cache quotas). Non-blocking.
  void runStartupMaintenance();

  // Check for updates in the background (packaged builds only).
  initAutoUpdate();

  // Check FFmpeg availability AFTER first paint, so the user sees the UI
  // and a non-blocking dialog if it's missing.
  setTimeout(async () => {
    try {
      const status = await findBinaries();
      if (!status.available && mainWindow) {
        const lang = (await getSettings()).lang;
        const choice = await dialog.showMessageBox(mainWindow, {
          type: 'warning',
          title: t(lang, 'ffmpeg_missing_title'),
          message: t(lang, 'ffmpeg_missing_msg'),
          detail: t(lang, 'ffmpeg_missing_detail'),
          buttons: [t(lang, 'btn_download_site'), t(lang, 'btn_continue_without'), t(lang, 'btn_exit')],
          defaultId: 0,
          cancelId: 1,
        });
        if (choice.response === 0) {
          await shell.openExternal('https://www.gyan.dev/ffmpeg/builds/');
        } else if (choice.response === 2) {
          app.quit();
        }
      }
    } catch {
      // ignore — the renderer can still call ffmpeg:status
    }
  }, 1500);

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});

// Never leave orphaned ffmpeg children behind when the app exits.
app.on('before-quit', () => {
  log.info('App quitting — terminating active ffmpeg processes');
  killActiveProcesses();
  // Best-effort: drop any leftover transformed-SRT temp files on the way out.
  void clearTempSrt();
});
