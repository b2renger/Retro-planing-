# Electron desktop build

RetroPlaningStudio ships as a desktop app so LAN LLM farms, OAuth loopbacks and provider APIs are
reachable without CORS or a proxy. The web build is unchanged: the renderer feature-detects
`window.desktop` and falls back to browser APIs when it is absent.

## Architecture

```
┌─────────────────────────┐   IPC (ipcMain.handle / ipcRenderer.invoke)   ┌────────────────────────┐
│ main process            │◄──────────────────────────────────────────────►│ preload (contextBridge)│
│ electron/main.ts        │                                                │ electron/preload.ts    │
│  BrowserWindow, menu    │                                                │  exposes window.desktop│
│  net.fetch, dgram, http │                                                └───────────┬────────────┘
│  safeStorage, dialog    │                                                            │ window.desktop
└─────────────────────────┘                                                ┌───────────▼────────────┐
                                                                            │ renderer (React, dist/)│
                                                                            │ src/ — untouched       │
                                                                            └────────────────────────┘
```

- **Renderer**: the Vite build in `dist/` (loaded via `file://` in production — hence `base: './'` in
  `vite.config.ts` — or `http://localhost:3000` in dev). `contextIsolation: true`, `nodeIntegration: false`.
- **Preload** (`electron/preload.ts`): implements every member of `DesktopBridge` from
  `src/types/desktop.d.ts` and exposes it as `window.desktop`. The app version is passed through
  `webPreferences.additionalArguments` (`--app-version=<x>`). `sandbox: false` so the preload can read
  `process.argv`.
- **Main** (`electron/main.ts`): window lifecycle, application menu, single-instance lock, and all
  IPC handlers. Helpers live in:
  - `electron/farmDiscovery.ts` — UDP multicast listener + pure `parseBeacon()` (tested in
    `electron/farmDiscovery.test.ts`).
  - `electron/oauthLoopback.ts` — 127.0.0.1 loopback HTTP server for OAuth redirects.
  - `electron/secureStore.ts` — `safeStorage`-encrypted key/value file.

### Bridge contract → IPC channels

| `window.desktop` member            | IPC channel                     | Notes |
| ---------------------------------- | ------------------------------- | ----- |
| `platform`, `version`              | — (set in preload)              | version via `--app-version` argv |
| `fetch(url, init)`                 | `desktop:fetch`                 | `net.fetch` in main: no CORS, follows redirects, `timeoutMs` via AbortController, `body` (text) or `bodyBase64`. Resolves for any HTTP status; rejects only on network errors / timeouts. Headers are returned lower-cased. http(s) only. |
| `discoverFarms(durationMs)`        | `desktop:discoverFarms`         | Joins `239.255.43.10:41998` on every non-internal IPv4 interface, collects JSON beacons for `durationMs` (default 3000, max 15000), dedupes by endpoint (latest wins). |
| `oauthLoopback(buildAuthUrl)`      | `desktop:oauth:start` → `desktop:oauth:open` (+ `desktop:oauth:cancel`) | `start` returns `{sessionId, redirectUri}`; the preload calls `buildAuthUrl(redirectUri)`, then `open` launches the browser and resolves with `{redirectUrl, redirectUri}` when `/callback` is hit. Fragment responses are forwarded by a tiny page to `/callback?fragment=…`. 5-minute timeout. |
| `openExternal(url)`                | `desktop:openExternal`          | http(s) only. |
| `secureStore.get/set/delete`       | `desktop:secureStore:get/set/delete` | see "Where data lives". |
| `saveFile({defaultPath, dataBase64, mimeType})` | `desktop:saveFile` | `dialog.showSaveDialog` + `fs.writeFile`; relative `defaultPath` lands in Downloads. |

Window-open requests and off-origin navigations are denied in-app and sent to the system browser.

## Dev workflow

1. `npm run dev` — starts the existing Express + Vite dev server on http://localhost:3000 (keep it
   running).
2. In another terminal: `npm run electron:dev` — bundles `electron/*.ts` with esbuild into
   `dist-electron/*.cjs` and launches `electron . --dev`, which loads `http://localhost:3000`.
   Setting `ELECTRON_RENDERER_URL` overrides the dev URL.
3. `npx vitest run electron` — unit tests for the pure parts (beacon parsing).
4. `npx tsc --noEmit` — the root tsconfig has no `include`, so `electron/` is type-checked with the rest.

Scripts:

| Script                | What it does |
| --------------------- | ------------ |
| `build:electron`      | esbuild `electron/main.ts` → `dist-electron/main.cjs`, `electron/preload.ts` → `dist-electron/preload.cjs` (CJS, node22 target, `electron` external, sourcemaps). `.cjs` because `package.json` is `"type": "module"`. |
| `build:all`           | `vite build` + `build:electron`. (The existing `build` script additionally bundles `server.ts` → `dist/server.cjs` for the web deployment; that file is excluded from the desktop package.) |
| `package:dir`         | Unpacked app in `release/` — fastest way to smoke-test packaging. |
| `package:mac`         | dmg + zip for arm64 and x64, then `verify:macsign`. |
| `package:win`         | NSIS installer (x64). Cross-building from macOS works for NSIS. |
| `package:all`         | mac + win, then `verify:macsign`. |
| `gen:icon`            | Regenerates `build/icon.png` (1024²) and `build/icon.ico` (256² PNG-in-ICO) with no dependencies. |
| `verify:macsign`      | `codesign --verify --deep --strict` on every `release/mac*/RetroPlaningStudio.app`; no-op off macOS. |

## Packaging (electron-builder)

Configured under `"build"` in `package.json`:

- `appId` `com.b2renger.retroplaningstudio`, `productName` `RetroPlaningStudio`,
  artifacts named `${productName}-${version}-${os}-${arch}.${ext}` in `release/`.
- `files`: `dist/**` (minus `dist/server.cjs*`), `dist-electron/**`, `package.json`, and
  `!node_modules/**` — everything the app needs is already bundled by Vite/esbuild, and the
  `dependencies` list (express, vite, …) is for the web server, not the desktop app.
  `npmRebuild: false` for the same reason.
- `asar: true`.
- `electronFuses: { runAsNode: false, resetAdHocDarwinSignature: true }`.
- mac: dmg + zip, arm64 + x64, `identity: "-"`, `hardenedRuntime: false`, icon `build/icon.png`.
- win: NSIS x64, icon `build/icon.ico`, `oneClick: false`, user-selectable install directory.
- Linux: not configured.

### The macOS signing / fuses catch (read before touching `build`)

electron-builder applies `electronFuses` **after** `afterPack` hooks and **right before** its own
signing step: flipping fuses rewrites bytes inside the Electron binary. Any signature applied earlier
(for example an ad-hoc `codesign` in an `afterPack` hook) is therefore invalidated. If no signing
identity is configured, electron-builder then re-signs nothing and the app ships with a *broken*
signature. On Apple Silicon a broken signature is fatal: macOS reports the app as "damaged", and
`xattr -dr com.apple.quarantine` does not help. This exact bug shipped in the sibling project artlux.

The rules that keep this build healthy:

1. Signing is done **by electron-builder** via `mac.identity: "-"` (ad-hoc), which runs after the fuse
   flip. Do not add `afterPack`/`afterSign` hooks that sign.
2. `hardenedRuntime: false` — hardened runtime requires a real Developer ID and entitlements; with an
   ad-hoc identity it is meaningless and can break the signature.
3. `electronFuses.resetAdHocDarwinSignature: true` — required whenever fuses are flipped on an
   ad-hoc-signed Electron binary.
4. `scripts/verify-mac-signature.cjs` gates `package:mac` / `package:all` with
   `codesign --verify --deep --strict`. A red build here is the tripwire; do not remove it.

## Where data lives

- `app.getPath('userData')`:
  - macOS `~/Library/Application Support/RetroPlaningStudio/`
  - Windows `%APPDATA%\RetroPlaningStudio\`
  - Linux `~/.config/RetroPlaningStudio/`
- `secure-store.json` in that folder holds the `secureStore` values. Each value is `enc:<base64>`
  encrypted with `safeStorage` (Keychain / DPAPI / libsecret) or, when the OS keyring is unavailable,
  `plain:<value>` with a one-time console warning. The file is written atomically with mode 0600.

## Known limitations

- **No notarization / no Developer ID.** macOS builds are ad-hoc signed. On first launch users must
  right-click → Open (and confirm), or run `xattr -dr com.apple.quarantine /Applications/RetroPlaningStudio.app`.
  If macOS says the app is *damaged* rather than *unidentified*, the signature is broken — see above.
- **Windows SmartScreen** will warn ("Windows protected your PC") because the installer is unsigned;
  users click "More info → Run anyway".
- `discoverFarms` is IPv4-only (`udp4`) and needs the multicast port 41998 to be bindable; another
  listener without `SO_REUSEADDR` makes the scan return an empty list (logged, never thrown).
- The OAuth loopback binds `127.0.0.1` on a random port; providers must allow loopback redirect URIs
  with an arbitrary port (RFC 8252 §7.3).
- Auto-update is not configured (`--publish never`).
