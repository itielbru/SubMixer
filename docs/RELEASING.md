# Releasing SubMixer

This document covers building signed, cross-platform releases. The build config
(`electron-builder.yml`, `.github/workflows/release.yml`) is already prepared for
all of the below — the remaining work is operational (obtaining certificates and
credentials) rather than code.

## Targets

| OS      | Artifacts                | Script             |
| ------- | ------------------------ | ------------------ |
| Windows | NSIS installer, portable | `npm run build`    |
| macOS   | DMG + zip (arm64 + x64)  | `npm run build:mac`   |
| Linux   | AppImage + deb (x64)     | `npm run build:linux` |

Before any packaging, fetch the per-OS FFmpeg binaries:

```bash
npm run setup:ffmpeg   # downloads ffmpeg + ffprobe for the current platform
```

`scripts/setup-ffmpeg.cjs` detects the OS and pulls the matching static build
(Windows → gyan.dev, macOS → evermeet.cx, Linux → johnvansickle.com). On
macOS/Linux a system ffmpeg on `PATH` also works (the app falls back to it).

## Windows code signing (removes the SmartScreen warning)

Unsigned builds trigger a SmartScreen "unknown publisher" warning. To sign:

1. Obtain a code-signing certificate. An **OV** certificate is the cheapest; an
   **EV** certificate clears SmartScreen reputation immediately.
   [Azure Trusted Signing](https://learn.microsoft.com/azure/trusted-signing/)
   is a lower-cost alternative worth evaluating.
2. Add these GitHub Actions secrets (consumed by `release.yml`):
   - `CSC_LINK` — base64 of the `.pfx`, or a URL to it
   - `CSC_KEY_PASSWORD` — the certificate password
3. electron-builder signs automatically when those are present.
4. Once signing works, set `verifyUpdateCodeSignature: true` in
   `electron-builder.yml` so auto-update verifies signatures.

## macOS notarization

1. Enroll in the Apple Developer Program and create a "Developer ID Application"
   certificate.
2. Provide to the build environment:
   - `CSC_LINK` / `CSC_KEY_PASSWORD` — the Developer ID cert (as above)
   - `APPLE_ID`, `APPLE_APP_SPECIFIC_PASSWORD`, `APPLE_TEAM_ID` — for notarization
3. Flip `notarize: false` to `true` under `mac` in `electron-builder.yml` (or set
   it conditionally in CI when the Apple credentials are present).

## Cutting a release

`release.yml` runs on manual `workflow_dispatch`: it reads the version from
`package.json`, tags it, runs the quality gates, builds, and publishes the draft
GitHub Release, then promotes it to public. To ship a new version:

1. Bump `version` in `package.json` and update `CHANGELOG.md`.
2. Merge to `main`.
3. Trigger the **Release** workflow from the Actions tab.
