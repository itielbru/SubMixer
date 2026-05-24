# Changelog

All notable changes to SubMixer are documented here. This project adheres to
[Semantic Versioning](https://semver.org/) and the format of
[Keep a Changelog](https://keepachangelog.com/en/1.1.0/).

## [Unreleased]

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
