import { Menu, BrowserWindow, app, shell, MenuItemConstructorOptions } from 'electron';
import { userDataPath } from './store';

export function buildMenu(win: BrowserWindow, lang: 'he' | 'en' = 'he'): Menu {
  const isMac = process.platform === 'darwin';

  const send = (channel: string, ...args: unknown[]) => {
    win.webContents.send(channel, ...args);
  };

  const isHe = lang === 'he';

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
      label: isHe ? 'קובץ' : 'File',
      submenu: [
        {
          label: isHe ? 'פתח קובץ וידאו…' : 'Open Video File…',
          accelerator: 'CmdOrCtrl+O',
          click: () => send('menu:openFile'),
        },
        {
          label: isHe ? 'הוסף כתוביות…' : 'Add Subtitles…',
          accelerator: 'CmdOrCtrl+Shift+O',
          click: () => send('menu:addSrt'),
        },
        { type: 'separator' },
        {
          label: isHe ? 'ייצא קובץ' : 'Export File',
          accelerator: 'CmdOrCtrl+E',
          click: () => send('menu:export'),
        },
        {
          label: isHe ? 'בטל ייצוא' : 'Cancel Export',
          accelerator: 'Escape',
          click: () => send('menu:cancelExport'),
        },
        { type: 'separator' },
        {
          label: isHe ? 'פתח תיקיית הגדרות' : 'Open Settings Directory',
          click: () => shell.openPath(userDataPath()),
        },
        { type: 'separator' },
        isMac ? { role: 'close' } : { role: 'quit' },
      ],
    },
    {
      label: isHe ? 'תצוגה' : 'View',
      submenu: [
        {
          label: isHe ? 'פתח/סגור פאנל כתוביות' : 'Toggle Subtitles Panel',
          accelerator: 'CmdOrCtrl+B',
          click: () => send('menu:toggleDrawer'),
        },
        {
          label: isHe ? 'היסטוריית ייצוא' : 'Export History',
          accelerator: 'CmdOrCtrl+H',
          click: () => send('menu:history'),
        },
        {
          label: isHe ? 'פקודת FFmpeg…' : 'FFmpeg Command…',
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
      label: isHe ? 'עזרה' : 'Help',
      submenu: [
        {
          label: isHe ? 'אתר FFmpeg להורדה' : 'FFmpeg Download Website',
          click: () => shell.openExternal('https://www.gyan.dev/ffmpeg/builds/'),
        },
        {
          label: isHe ? 'בדוק זמינות FFmpeg' : 'Check FFmpeg Availability',
          click: () => send('menu:checkFFmpeg'),
        },
        { type: 'separator' },
        {
          label: isHe ? 'אודות SubMixer' : 'About SubMixer',
          click: () => send('menu:about'),
        },
      ],
    },
  ];

  const menu = Menu.buildFromTemplate(template);
  Menu.setApplicationMenu(menu);
  return menu;
}
