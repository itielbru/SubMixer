import { defineConfig } from '@playwright/test';

export default defineConfig({
  testDir: './e2e',
  timeout: 30_000,
  // No browser projects — Electron tests use electron.launch() directly.
  projects: [],
  // Collect traces on first retry so CI failures are diagnosable.
  use: {
    trace: 'on-first-retry',
  },
});
