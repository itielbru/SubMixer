import { defineConfig } from '@playwright/test';

export default defineConfig({
  testDir: './e2e',
  timeout: 30_000,
  // Single unnamed project — Electron tests use electron.launch() directly,
  // so no browser is configured, but at least one project is required.
  projects: [{ name: 'electron' }],
  // Collect traces on first retry so CI failures are diagnosable.
  use: {
    trace: 'on-first-retry',
  },
});
