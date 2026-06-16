# Contributing to SubMixer

Thanks for your interest in improving SubMixer! This is a Windows-targeted
Electron app for muxing video tracks with external subtitles.

## Development setup

```powershell
npm install
npm run setup:ffmpeg   # download ffmpeg.exe + ffprobe.exe into ffmpeg-bin/
npm run dev
```

## Quality gates (run before opening a PR)

All of these run in CI and must pass:

```powershell
npm run typecheck      # tsc, main + renderer projects
npm run lint           # eslint, fails on any warning (--max-warnings 0)
npm run format:check   # prettier
npm run test:coverage  # vitest, enforces coverage thresholds
npm run test:e2e       # playwright smoke (requires a build)
```

A Husky pre-commit hook runs `lint-staged` (eslint + prettier on staged files),
so most issues are caught before you commit.

## Project layout

- `src/main/` — Electron main process (FFmpeg, IPC, store, updater, maintenance).
- `src/preload/` — the curated `window.api` bridge (the only renderer↔main surface).
- `src/renderer/src/` — React UI (components, hooks, `lib/` utilities, `state/`).
- `src/shared/` — types and pure logic shared by both processes (incl. `i18n.ts`).
- `tests/`, `e2e/` — unit stubs and Playwright specs.

## Conventions

- **Testing:** prefer extracting logic into pure functions in `src/shared/` or
  `lib/`/`state/` and unit-testing them in the node/vitest setup (no jsdom).
  Browser/DOM/canvas code is excluded from coverage by design.
- **i18n:** every user-facing string goes in `src/shared/i18n.ts` under both
  `he` and `en` (the key type is derived from the `he` block).
- **Security:** the renderer is sandboxed and may only use the curated preload
  `api`. Do not add a generic IPC passthrough. Validate all path inputs in main.
- **Commits:** use clear, scoped messages (e.g. `feat(export): ...`,
  `fix(preview): ...`, `chore(ci): ...`).

## Pull requests

Open PRs against `main` as drafts until CI is green. Describe the change and how
you verified it. For UI/behavioral changes, include a short manual test note.
