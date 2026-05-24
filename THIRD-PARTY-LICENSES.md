# Third-Party Licenses

SubMixer bundles and depends on third-party software. This document lists those
components and their license obligations. SubMixer's own source code is licensed
separately (see `package.json` / `LICENSE`).

---

## FFmpeg — **GPL v3** ⚠️ (action required for commercial distribution)

SubMixer ships FFmpeg binaries (`ffmpeg.exe`, `ffprobe.exe`) and invokes them as
**separate external processes** (via `child_process.spawn`); it does **not** link
against the FFmpeg libraries.

- **Build bundled:** `ffmpeg-release-essentials` from <https://www.gyan.dev/ffmpeg/builds/>
  (downloaded by `scripts/setup-ffmpeg.cjs`).
- **License:** This is a **GPLv3** build (it includes GPL components such as
  libx264 / libx265). The GPL text: <https://www.gnu.org/licenses/gpl-3.0.html>.

### Obligations when distributing this build

1. **Include the license:** ship the GPLv3 text alongside the binaries.
2. **Offer the corresponding source:** provide, or include a written offer for,
   the exact FFmpeg source the binary was built from. gyan.dev publishes the
   build sources; mirror them or link to the exact versioned source archive.
3. **Preserve notices:** keep FFmpeg's copyright and attribution notices.

> Because invocation is process-level (not linking), the GPL of `ffmpeg.exe` does
> **not** by itself force SubMixer's own code to become GPL. It does, however,
> impose the obligations above on the **bundled FFmpeg binary**.

### Status: open-source project

SubMixer is a free, open-source project (MIT — see `LICENSE`) published on
GitHub. The GPL "corresponding source" obligation for the bundled FFmpeg is
satisfied by linking to the exact gyan.dev build and its published sources;
keep the license text and attribution shipped with releases. No relicensing of
FFmpeg is required for this distribution model.

---

## Electron — MIT

<https://github.com/electron/electron/blob/main/LICENSE>. Electron bundles
Chromium and Node.js, which carry their own licenses (BSD, MIT, and others); the
full set is available in Electron's `LICENSES.chromium.html`, shipped inside the
packaged app's resources.

---

## Runtime npm dependencies

| Package                     | License | Notes                          |
| --------------------------- | ------- | ------------------------------ |
| `electron-log`              | MIT     | Main/renderer logging          |
| `chardet`                   | MIT     | Subtitle encoding detection    |
| `iconv-lite`                | MIT     | Subtitle decoding              |
| `@electron-toolkit/preload` | MIT     | Preload helpers                |
| `@electron-toolkit/utils`   | MIT     | Main-process helpers           |
| `react`, `react-dom`        | MIT     | Renderer UI                    |

Full, up-to-date license texts for the npm dependency tree can be regenerated
with a tool such as `license-checker` or `npm-license-crawler` at release time.

---

## Fonts

The UI uses **Heebo** (and system fonts as fallback). Heebo is licensed under the
**SIL Open Font License 1.1**. If the font is bundled rather than loaded from a
CDN, include the OFL license text with the distributed app.
