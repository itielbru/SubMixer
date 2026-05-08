import { app, BrowserWindow, shell, dialog, protocol } from 'electron';
import { join } from 'path';
import { electronApp, optimizer, is } from '@electron-toolkit/utils';
import { registerIpc, registerPreviewProtocol } from './ipc';
import { buildMenu } from './menu';
import { findBinaries } from './ffmpeg';

// Register the custom protocol BEFORE app is ready so it's privileged.
protocol.registerSchemesAsPrivileged([
  {
    scheme: 'submixer',
    privileges: { standard: true, secure: true, supportFetchAPI: true, stream: true },
  },
]);

let mainWindow: BrowserWindow | null = null;

function createWindow(): void {
  mainWindow = new BrowserWindow({
    width: 1440,
    height: 900,
    minWidth: 1100,
    minHeight: 680,
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

  buildMenu(mainWindow);
}

app.whenReady().then(async () => {
  electronApp.setAppUserModelId('com.itiel.submixer');

  app.on('browser-window-created', (_, window) => {
    optimizer.watchWindowShortcuts(window);
  });

  registerPreviewProtocol();
  registerIpc();

  createWindow();

  // Check FFmpeg availability after the page finishes loading so the user
  // sees the UI before any blocking dialog appears.
  mainWindow!.webContents.once('did-finish-load', async () => {
    try {
      const status = await findBinaries();
      if (!status.available && mainWindow) {
        const choice = await dialog.showMessageBox(mainWindow, {
          type: 'warning',
          title: 'FFmpeg חסר',
          message: 'FFmpeg / FFprobe לא נמצאו במשתנה PATH של המערכת.',
          detail:
            'SubMixer דורש את FFmpeg כדי לבצע ניתוח קבצים, תצוגה מקדימה וייצוא.\n\n' +
            'התקן את FFmpeg והוסף אותו ל-PATH, ואז הפעל את האפליקציה מחדש.',
          buttons: ['פתח אתר ההורדה', 'המשך בלי', 'יציאה'],
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
  });

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});
