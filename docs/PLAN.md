> **Historical.** This is the plan as written at the start of the build, kept because it records the
> reasoning behind each phase. It is not a status document and parts of it were superseded — the cloud
> and AI designs changed during implementation, and the phase order was revised. For what actually
> exists, read [FEATURES.md](FEATURES.md); for what happened and why, read [dev/PROGRESS.md](dev/PROGRESS.md).

# RetroPlaningStudio — Implementation Plan (night of 2026-09-20 → 07:00)

Goal: a testable desktop + web build with real (not simulated) integrations:
theme cleanup, multi-provider AI (cloud + LlmOnLan farms), Google Drive / OneDrive as the
source of truth, spreadsheet exports, tests, and Electron builds for Windows, macOS arm64 and macOS x64.

Working method: one phase at a time. Each phase = implement (subagent or orchestrator) →
critic subagent verifies claims against source → fix → `npm run typecheck && npm test && npm run build`
→ commit. Progress and decisions are journaled in `docs/dev/PROGRESS.md` so work survives context compaction.

## Phase 0 — Baseline (done)
- Repo moved to `/Users/b2renger/Documents/RetroPlaningStudio`, renamed, AI Studio leftovers removed.
- npm toolchain: Node 24, vite 8, TypeScript 7, Tailwind 4, React 19. `typecheck`, `build`, `test` scripts.

## Phase 1 — Audit & documentation
- `docs/audit/FEATURE-AUDIT.md`: feature inventory (REAL / SIMULATED / BROKEN / DEAD), timeline engine
  reality check, UX/UI critique, theme audit, resilience critique, top fixes.
- Decide what to delete (fake "database tester", fake "implementation plan" matrix, fake invitations),
  what to relabel as local-only, what to fix.

## Phase 2 — Theme system (dark / light / system)
- Semantic tokens in `src/index.css` via Tailwind 4 `@theme` + CSS variables switched by `.dark`:
  `bg-app`, `bg-card`, `bg-subtle`, `bg-elevated`, `border-line`, `text-fg`, `text-fg-muted`, `text-fg-subtle`,
  accent scale unchanged (purple/blue/emerald/amber/rose).
- Replace every hardcoded hex background / white-alpha border / slate text in components with tokens.
- Theme picker: dark / light / system (prefers-color-scheme), persisted, applied before first paint (no flash).
- Acceptance: every view and modal readable in both themes; no `bg-[#` left in components.

## Phase 3 — AI provider layer
- `src/services/ai/`: `types.ts` (ChatMessage, AiProviderConfig, AiClient), one adapter per provider:
  Gemini (REST `generativelanguage.googleapis.com`), OpenAI (`/v1/chat/completions`), Anthropic
  (`/v1/messages`, browser header), Mistral, OpenAI-compatible generic (Ollama, LM Studio, LlmOnLan farm).
- LlmOnLan: OpenAI-compatible at `http://<farm>:4000/v1`; optional `Authorization: Bearer <masterKey>`;
  `/v1/models` ungated → model picker. Discovery: Electron main listens to the UDP multicast beacon
  `239.255.43.10:41998` (JSON payload) and exposes `desktop.discoverFarms()`; web build = manual URL.
- All calls go through `httpClient` (window.fetch in web, IPC `net.fetch` in Electron to avoid CORS).
- Structured-output helper: JSON-mode where supported, else prompt + robust JSON extraction.
- Existing features (crunch markdown, dependency analysis, assistant) rewritten on top of the provider
  layer; the Express proxy becomes optional (kept for hosted deployments with a server key).
- Settings UI: provider list, key, base URL, model (fetched when the provider supports listing),
  "Test connection", default provider. Keys stored locally (localStorage; Electron: safeStorage-encrypted).
- Tests: adapters with mocked fetch (request shape, response parsing, error mapping), JSON extraction.

## Phase 4 — Cloud sync (Google Drive / OneDrive as source of truth)
- `src/services/cloud/`: `CloudProvider` interface (auth, listFolder, readFile, writeFile, createFolder,
  delete, changes since token), `googleDrive.ts` (Drive v3), `oneDrive.ts` (Graph v1.0).
- OAuth 2.0 PKCE: web = popup/redirect on `/oauth/callback`; Electron = loopback `http://127.0.0.1:<port>`
  server in main + system browser. User supplies their own client IDs in Settings (documented).
- Layout on the drive: `RetroPlaningStudio/<project>/project.json` + `docs/*.md` (+ `exports/`).
- Sync engine: poll (Drive `changes` / Graph delta) every 30s + on focus; per-file mtime/etag
  last-writer-wins; new `.md` in `docs/` → appears as a document in the app; app doc create/edit/delete
  → written to drive; conflict = keep both (`name (conflict).md`) + notification. Status chip in navbar.
- Tests: sync reconciliation logic (pure function over local/remote listings) with fixtures.

## Phase 5 — Exports
- `src/services/export/`: CSV, XLSX via exceljs (Tasks sheet, Phases, Milestones, Gantt sheet with
  day columns filled per phase/task colour), Markdown, JSON.
- "Send to Google Sheets" (Drive upload of xlsx with `convert` to Sheets MIME) and "Send to OneDrive
  (Excel)" (Graph upload into `exports/`), both returning the web link.
- Timeline PNG/SVG export of the Gantt view.
- Tests: workbook structure (sheet names, header rows, Gantt fill cells).

## Phase 6 — Electron
- `electron/main.ts`, `electron/preload.ts` bundled with esbuild; renderer = vite build with `base: './'`.
- IPC surface (`window.desktop`): `fetch` (CORS-free), `discoverFarms`, `oauthLoopback`, `secureStore`.
- electron-builder: mac `dmg`+`zip` for `arm64` and `x64` (separate artifacts, `artifactName` with
  `${arch}`), win `nsis` x64. macOS catches copied from artlux: `mac.identity: "-"` (ad-hoc sign by
  electron-builder AFTER fuse flip), `hardenedRuntime: false`, `electronFuses.resetAdHocDarwinSignature: true`,
  `runAsNode: false`, and `scripts/verify-mac-signature.cjs` gate (`codesign --verify --deep --strict`).
- `npm run package:mac`, `package:win`, `package:all`.

## Phase 7 — Tests, docs, human test plan
- `npm test` (vitest) green, `typecheck` clean, `build` clean, mac arm64 + x64 + win packages built.
- `README.md` (human), `docs/USER-GUIDE.md`, `docs/dev/ARCHITECTURE.md` (for future me), `docs/HUMAN-TESTS.md`
  (numbered manual acceptance tests), `docs/dev/PROGRESS.md` (journal).
- GitHub repo rename must be done by the owner (no `gh` CLI / token here): Settings → Rename →
  `RetroPlaningStudio`; then `git remote set-url origin https://github.com/b2renger/RetroPlaningStudio.git`.
