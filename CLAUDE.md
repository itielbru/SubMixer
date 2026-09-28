# SubMixer

Electron desktop app (Windows first; macOS/Linux builds supported) for muxing video tracks with external subtitle files, with offset and speed sync controls.

## Stack
- Electron 42 + electron-vite + electron-builder
- React 18 + TypeScript
- FFmpeg bundled via `ffmpeg-bin/` (fallback: system PATH)
- chardet + iconv-lite for subtitle encoding detection
- i18n: Hebrew + English (`src/shared/i18n.ts`)

## Dev
```powershell
npm install
npm run setup:ffmpeg   # download ffmpeg.exe + ffprobe.exe to ffmpeg-bin/
npm run dev
npm run typecheck
npm run lint
npm test            # vitest unit tests (coverage gate: npm run test:coverage)
```

## Build (Windows installer)
```powershell
npm run setup:ffmpeg   # required once before packaging if not on PATH
npm run build          # NSIS installer in release/
npm run build:portable
```

## Key dirs
- `src/` — main + preload + renderer source
- `src/shared/i18n.ts` — UI strings (he/en)
- `ffmpeg-bin/` — bundled ffmpeg/ffprobe executables (gitignored *.exe)
- `scripts/` — setup-ffmpeg.cjs, clean-release.cjs
- `out/` — compiled output (not committed)
- `release/` — built installers (not committed)

## Notes
- Primary target is Windows (NSIS + portable); `build:mac` / `build:linux` exist, see docs/RELEASING.md
- Subtitle formats: SRT, VTT, ASS/SSA
- Export synced subtitles as SRT without full mux
