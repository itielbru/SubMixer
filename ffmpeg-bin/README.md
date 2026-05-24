# FFmpeg binaries (Windows)

Place **ffmpeg.exe** and **ffprobe.exe** in this folder for local development and packaging.

## Quick setup

From the project root:

```powershell
npm run setup:ffmpeg
```

This downloads the FFmpeg essentials build and extracts the two executables here.

## Manual setup

1. Download [FFmpeg essentials for Windows](https://www.gyan.dev/ffmpeg/builds/ffmpeg-release-essentials.zip).
2. Extract the archive.
3. Copy `bin/ffmpeg.exe` and `bin/ffprobe.exe` into this `ffmpeg-bin/` folder.

## Fallback

If binaries are not present here, SubMixer falls back to **ffmpeg** and **ffprobe** on your system **PATH**.
