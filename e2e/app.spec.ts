/**
 * E2E smoke tests for SubMixer.
 *
 * Prerequisites:
 *   npx electron-vite build   (produces out/main/index.js)
 *
 * Run:
 *   npm run test:e2e
 */

import { test, expect } from '@playwright/test';
import { _electron as electron } from 'playwright';
import type { ElectronApplication, Page } from 'playwright';
import * as path from 'path';

let app: ElectronApplication;
let window: Page;

test.beforeAll(async () => {
  app = await electron.launch({
    args: [path.join(__dirname, '..', 'out', 'main', 'index.js')],
    cwd: path.join(__dirname, '..'),
  });
  window = await app.firstWindow();
  await window.waitForLoadState('domcontentloaded');
});

test.afterAll(async () => {
  await app.close();
});

test('window has correct title', async () => {
  expect(await window.title()).toBe('SubMixer');
});

test('app root mounts', async () => {
  await expect(window.locator('[data-testid="app-root"]')).toBeVisible();
});

test('shows empty source panel when no file is loaded', async () => {
  // .src-empty is the no-file state inside SourcePanel
  await expect(window.locator('.src-empty')).toBeVisible({ timeout: 5000 });
});

test('export button is present and initially disabled', async () => {
  await expect(window.locator('[data-testid="export-btn"]')).toBeVisible();
  await expect(window.locator('[data-testid="export-btn"]')).toBeDisabled();
});
