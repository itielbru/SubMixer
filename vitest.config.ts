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
      ],
      // Vitest 4 measures every file matched by `include`, even ones no test
      // imports. These are UI / side-effect modules (DOM notifications, theme
      // application, waveform canvas rendering, format helpers, debug logging,
      // preview) that carry no unit tests by design — exclude them so the
      // thresholds keep gating the tested core logic, matching pre-v4 behavior.
      exclude: [
        'src/renderer/src/lib/notify.ts',
        'src/renderer/src/lib/sub-format.tsx',
        'src/renderer/src/lib/theme.ts',
        'src/renderer/src/lib/waveform.ts',
        'src/shared/agent-debug.ts',
        'src/shared/preview.ts',
      ],
      reporter: ['text', 'html'],
      // Fail the suite (and CI) if coverage on the included core modules drops
      // below these floors. Set a few points under the current numbers so the
      // gate catches regressions without being brittle to small refactors.
      thresholds: {
        statements: 75,
        branches: 72,
        functions: 80,
        lines: 75,
      },
    },
  },
});
