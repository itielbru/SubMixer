import { defineConfig } from '@playwright/test';

export default defineConfig({
  testDir: './e2e',
  timeout: 30_000,
  // Single project — Electron tests use electron.launch() directly (no browser needed).
  projects: [{ name: 'electron' }],
  // Collect traces on first retry so CI failures are diagnosable.
  use: {
    trace: 'on-first-retry',
  },
});
