import { Menu, BrowserWindow, app, shell, MenuItemConstructorOptions } from 'electron';
import { userDataPath } from './store';

export function buildMenu(win: BrowserWindow): Menu {
  const isMac = process.platform === 'darwin';

  const send = (channel: string, ...args: unknown[]) => {
    win.webContents.send(channel, ...args);
  };

  const template: MenuItemConstructorOptions[] = [
    ...(isMac
      ? ([
          {
            label: app.name,
            submenu: [
              { role: 'about' },
              { type: 'separator' },
              { role: 'services' },
              { type: 'separator' },
              { role: 'hide' },
              { role: 'hideOthers' },
              { role: 'unhide' },
              { type: 'separator' },
              { role: 'quit' },
            ],
          },
        ] as MenuItemConstructorOptions[])
      : []),
    {
      label: 'קובץ',
      submenu: [
        {
          label: 'פתח קובץ וידאו…',
          accelerator: 'CmdOrCtrl+O',
          click: () => send('menu:openFile'),
        },
        {
          label: 'הוסף כתוביות SRT…',
          accelerator: 'CmdOrCtrl+Shift+O',
          click: () => send('menu:addSrt'),
        },
        { type: 'separator' },
        {
          label: 'ייצא קובץ',
          accelerator: 'CmdOrCtrl+E',
          click: () => send('menu:export'),
        },
        {
          label: 'בטל ייצוא',
          accelerator: 'Escape',
          click: () => send('menu:cancelExport'),
        },
        { type: 'separator' },
        {
          label: 'פתח תיקיית הגדרות',
          click: () => shell.openPath(userDataPath()),
        },
        { type: 'separator' },
        isMac ? { role: 'close' } : { role: 'quit' },
      ],
    },
    {
      label: 'תצוגה',
      submenu: [
        {
          label: 'פתח/סגור פאנל כתוביות',
          accelerator: 'CmdOrCtrl+B',
          click: () => send('menu:toggleDrawer'),
        },
        {
          label: 'היסטוריית ייצוא',
          accelerator: 'CmdOrCtrl+H',
          click: () => send('menu:history'),
        },
        {
          label: 'פקודת FFmpeg…',
          accelerator: 'CmdOrCtrl+K',
          click: () => send('menu:ffmpegCmd'),
        },
        { type: 'separator' },
        { role: 'reload' },
        { role: 'forceReload' },
        { role: 'toggleDevTools' },
        { type: 'separator' },
        { role: 'resetZoom' },
        { role: 'zoomIn' },
        { role: 'zoomOut' },
        { type: 'separator' },
        { role: 'togglefullscreen' },
      ],
    },
    {
      label: 'עזרה',
      submenu: [
        {
          label: 'אתר FFmpeg להורדה',
          click: () => shell.openExternal('https://www.gyan.dev/ffmpeg/builds/'),
        },
        {
          label: 'בדוק זמינות FFmpeg',
          click: () => send('menu:checkFFmpeg'),
        },
        { type: 'separator' },
        {
          label: 'אודות SubMixer',
          click: () => send('menu:about'),
        },
      ],
    },
  ];

  const menu = Menu.buildFromTemplate(template);
  Menu.setApplicationMenu(menu);
  return menu;
}
