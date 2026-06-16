# Security Policy

## Reporting a Vulnerability

If you discover a security issue in SubMixer, please report it privately:

- Open a [GitHub Security Advisory](https://github.com/itielbru/SubMixer/security/advisories/new), or
- Email the maintainer at **bru.itiel@gmail.com** with the details.

Please do **not** open a public issue for security problems. We aim to acknowledge
reports within a few days and to ship a fix as soon as practical.

## Scope

SubMixer is an offline Windows desktop app. It does not collect or transmit usage
data, and it has no backend service. The most relevant attack surface is:

- Processing of untrusted media/subtitle files via the bundled FFmpeg/FFprobe.
- The Electron main/renderer boundary (IPC).

### Hardening in place

- `contextIsolation: true`, `nodeIntegration: false`, and `sandbox: true` for the renderer.
- A curated preload `api` surface — the renderer cannot invoke arbitrary IPC channels.
- A strict Content-Security-Policy (see `src/renderer/index.html`).
- All file-path IPC inputs are validated (absolute-path assertions).
- Custom `submixer://` protocol routes are bounds-checked against allowed roots.

## Known accepted risks (build tooling only)

`npm audit` reports a small number of **high** advisories in `esbuild`, pulled in
transitively by `vite`/`electron-vite` (dev/build tooling). These affect only the
local dev server (`npm run dev`) and a Deno-specific code path that SubMixer does
not use. They are **not** present in the shipped installer — `esbuild`, `vite`, and
`vitest` are `devDependencies` and are never bundled into the app.

`npm audit --omit=dev` (production dependencies) reports **0 vulnerabilities**, and
CI gates on that. The residual dev-only advisories will clear once `electron-vite`
supports `vite@8` (which carries the patched `esbuild`).
