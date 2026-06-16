import { defineConfig } from 'vitest/config';
import { resolve } from 'path';

export default defineConfig({
  resolve: {
    alias: {
      '@shared': resolve(__dirname, 'src/shared'),
      '@renderer': resolve(__dirname, 'src/renderer/src'),
      // Stub Electron so main-process modules that import it can be unit-tested
      // in a plain Node environment without launching Electron.
      electron: resolve(__dirname, 'tests/stubs/electron.ts'),
    },
  },
  test: {
    environment: 'node',
    include: ['src/**/*.test.ts', 'tests/**/*.test.ts'],
    coverage: {
      provider: 'v8',
      include: [
        'src/shared/**',
        'src/renderer/src/lib/**',
        'src/main/srt.ts',
        'src/main/peaks-cache.ts',
        'src/main/maintenance.ts',
      ],
      // Exclude type-only / barrel files and browser-only utilities (DOM/canvas/
      // JSX) that require a jsdom environment we don't run. The gate therefore
      // reflects the pure, node-testable surface.
      exclude: [
        'src/shared/types.ts',
        'src/shared/preview.ts',
        'src/shared/agent-debug.ts',
        'src/renderer/src/lib/theme.ts',
        'src/renderer/src/lib/waveform.ts',
        'src/renderer/src/lib/sub-format.tsx',
        'src/renderer/src/lib/notify.ts',
        'src/renderer/src/lib/path.ts',
      ],
      reporter: ['text', 'html'],
      // Guard the pure, well-tested core. Raise as more logic is extracted into
      // pure modules (see Sprint 4).
      thresholds: {
        lines: 80,
        functions: 78,
        branches: 68,
        statements: 76,
      },
    },
  },
});
