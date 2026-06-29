# Changelog

All notable changes to SubMixer are documented here. This project adheres to
[Semantic Versioning](https://semver.org/) and the format of
[Keep a Changelog](https://keepachangelog.com/en/1.1.0/).

## [Unreleased]

### Changed

- **IPC result types**: unified the per-channel `{ ok; payload?; error? }` shapes
  into a generic discriminated `IpcResult<T>` union, so narrowing on `ok`
  guarantees the payload (no per-field null checks). Type-only, no behaviour change.

## [1.2.0] - 2026-06-29

### Added

- **Hardware-accelerated burn-in encoding**: when burning subtitles into the
  video, the encoder (x264/x265, NVIDIA NVENC, Intel QuickSync, AMD AMF, Apple
  VideoToolbox), speed/quality preset, and CRF/CQ quality are now selectable in
  Settings. Hardware encoders are offered only when `ffmpeg -encoders` reports
  them. Software x264 remains the default.
- **Audio-based auto-sync**: a one-click "Auto-sync" estimates a global subtitle
  offset by correlating subtitle timing against the audio energy envelope
  (available once a waveform has been extracted).
- **Cross-platform packaging**: `setup:ffmpeg` downloads the correct ffmpeg /
  ffprobe build per OS; electron-builder gains macOS (DMG + zip) and Linux
  (AppImage + deb) targets with `build:mac` / `build:linux` scripts.
- **`ROADMAP.md`** and **`docs/RELEASING.md`** documenting direction and the
  signed cross-platform release process.

### Improved

- **Dependency hygiene**: Dependabot (npm + GitHub Actions, grouped minor/patch)
  and a non-blocking dependency-audit job in CI.
- **Testability**: `ExportPlan` assembly extracted to a pure, unit-tested
  `src/shared/export-plan.ts`; coverage thresholds now enforced in CI.
- **Renderer structure**: undo/redo and cue-editing logic moved out of the
  `App.tsx` god-component into `useUndoRedo` / `useCueEditing` hooks
  (1427 → 1164 lines); operational constants centralized in `src/shared/config.ts`.

## [1.1.1] - 2026-06-15

### Added

- **Output overwrite guard**: before every export, the target path is checked; if a file already exists the user is asked to confirm before it is overwritten.
- **Manual release workflow**: a `workflow_dispatch` release path creates the tag, builds the Windows installer, and promotes the draft GitHub Release to public after a successful build.

### Improved

- **Clearer FFmpeg errors**: `parseFfmpegError` now recognizes disk-full, permission-denied, codec/container mismatch, corrupt-source, and subtitle-encoding failures, returning plain-language messages instead of raw ffmpeg output.

### Fixed

- **E2E job ran zero tests**: `playwright.config.ts` had an empty `projects: []`, so the CI E2E job reported "No tests found"; an `electron` project is now declared so the smoke suite actually runs.

## [1.1.0] - 2026-06-14

### Added

- **Batch export queue**: queue multiple export jobs and run them sequentially; dedicated BatchQueueModal with per-job progress and error display.
- **System desktop notifications**: a native notification fires when a single export or batch queue completes (permission requested once).
- **Re-export from history**: each successful history entry stores the original plan and surfaces a "Re-export" button to repeat the export without reloading the file.
- **Drag-and-drop subtitle files**: drag SRT/VTT/ASS files directly onto the subtitle drawer to add them; drop target highlights on hover.
- **Overrun warning**: cues that extend past the video's end time are flagged in the cue editor.
- **Peaks cache TTL eviction**: waveform cache entries older than 30 days are automatically removed on startup.
- **E2E smoke tests**: Playwright suite verifies the Electron app launches, the root mounts, the empty-state panel is visible, and the export button starts disabled.
- **Unit tests**: evictByAge (maintenance), cue-warnings overrun case.
- `data-testid` attributes on key interactive elements for test selectors.

### Changed

- **Electron 34 → 42** (Chromium 130+, Node 22+; updated `electron-builder` to v26).
- **electron-vite 2.3 → 5.0** (isolated build mode, Vite 7 internals).
- **Self-hosted fonts**: Google Fonts replaced with locally bundled woff2 files (`setup:fonts` script). CSP `style-src` and `font-src` no longer reference external domains.
- **Auto-update**: shows an update-available notification before downloading (was: silent background download).
- **System theme**: "System" option in Settings syncs with OS dark/light mode via Electron's `nativeTheme`.

### Improved

- **Modal accessibility**: all modals wrapped in WAI-ARIA `role="dialog"` + `aria-modal` with a Tab/Shift-Tab focus trap, Escape to close, and auto-focus on the first focusable element.
- **ARIA for lists and grids**: TracksList uses `role="list"` / `role="listitem"`; CueListView uses `role="grid"` with `aria-selected` and `aria-live="polite"` for screen readers.
- **Preview retry**: failed audio extraction shows a Retry button instead of a permanent error state.
- **Peaks IPC rate limit**: concurrent `peaks:get` calls are rejected early rather than spawning duplicate ffmpeg processes.
- **FFmpeg spawn timeouts**: preview extraction times out after 180 s, peaks after 120 s, to prevent hangs on corrupt or truncated media.
- **IPC input validation**: all sensitive IPC handlers assert string types and absolute paths before use.
- **Stronger peaks cache key**: first 64 KB of file content is now hashed alongside path + size + mtime, eliminating stale waveform risk when a file is replaced in-place.
- **CI**: Windows runner added (typecheck + test on `windows-latest`); separate E2E job on `windows-latest` after the build step.

### Fixed

- Export history entries now store original subtitle file paths (not ephemeral temp SRT paths) plus `durationSec`, making re-export reliable.

## [1.0.0] - 2026-06-13

### Added

- **Quality tooling:** ESLint (flat config) + Prettier + EditorConfig, with
  `lint`, `lint:fix`, `format`, and `format:check` scripts.
- **Test suite:** Vitest with unit tests for the core subtitle logic
  (`cue-sync`, `cue-warnings`, `fix-timing`, `format`, `rtl`), SRT/VTT/ASS
  parsing and encoding detection, and the peaks cache format. `npm test`.
- **CI:** GitHub Actions workflow running typecheck → lint → test → bundle build
  on every push and pull request.
- **Structured logging:** main-process logging via `electron-log`, written to
  `userData/logs/main.log` with rotation; uncaught exceptions and unhandled
  rejections are now captured.
- **Error boundary:** the renderer shows a recoverable fallback screen instead
  of a blank window when a render error occurs.
- **Startup maintenance:** orphaned temp files are cleaned and the preview/peaks
  caches are kept within size budgets on launch.
- **Third-party license documentation** (`THIRD-PARTY-LICENSES.md`), including
  FFmpeg GPL obligations.
- **Auto-update** via `electron-updater` against GitHub Releases (packaged builds
  only), and a `Release` GitHub Actions workflow that builds and publishes
  Windows artifacts on `v*` tags. Code signing activates automatically when
  `CSC_LINK` / `CSC_KEY_PASSWORD` secrets are configured.
- **Unified undo/redo** covering all cue edits (text, timing, delete, insert,
  shift, split, merge, duplicate, bulk modal operations) in addition to track
  toggles, with `Ctrl+Z` / `Ctrl+Y` / `Ctrl+Shift+Z` and drag coalescing.

### Changed

- Peaks cache binary format now carries a magic + version header so future
  format changes invalidate stale entries safely.

### Performance

- The cue list is now virtualized (only on-screen rows render) and memoized, so
  large subtitle files (1000+ cues) no longer lag during playback, scrolling, or
  editing. Row action buttons reveal via CSS instead of triggering a full-list
  re-render on hover.
- Removed leftover diagnostic instrumentation that ran on every playback tick.

### Removed

- Leftover debugging instrumentation that POSTed to a local debug-ingest server;
  diagnostics now route through the structured logger.

### Fixed

- ffmpeg child processes (preview extraction / export) are now terminated on app
  quit, preventing orphaned processes.
- Preview audio no longer shows spurious "audio.play(): NotSupportedError — The
  element has no supported sources" toasts. Playback now waits for the extracted
  audio source to be ready (`canplay`) and ignores benign abort/not-ready races
  during the quick→full extraction handoff.
