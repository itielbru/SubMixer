import log from 'electron-log/main';
import { app } from 'electron';
import * as path from 'path';

let initialized = false;

/**
 * Structured logging for the main process, backed by electron-log.
 *
 * - Writes to `userData/logs/main.log` with size-based rotation.
 * - Mirrors renderer logs sent over the built-in electron-log IPC bridge.
 * - Captures uncaughtException / unhandledRejection to the log file.
 *
 * Remote crash reporting (e.g. Sentry) is an intentional extension point:
 * add an `errorHandler.onError` hook here, gated on an opt-in setting and a
 * configured DSN, when a reporting backend is chosen.
 */
export function initLogger(): void {
  if (initialized) return;
  initialized = true;

  log.transports.file.resolvePathFn = () => path.join(app.getPath('userData'), 'logs', 'main.log');
  log.transports.file.level = 'info';
  log.transports.file.maxSize = 5 * 1024 * 1024; // 5 MB then rotate
  log.transports.console.level = app.isPackaged ? 'warn' : 'debug';

  // Enable log forwarding from the renderer (electron-log/renderer).
  log.initialize();

  // Persist crashes instead of failing silently.
  log.errorHandler.startCatching({ showDialog: false });

  log.info('Logger initialized', {
    version: app.getVersion(),
    platform: process.platform,
    packaged: app.isPackaged,
  });
}

export default log;
