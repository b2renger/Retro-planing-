# RetroPlaningStudio

Plan a project backwards from the day it has to be finished.

You give it a delivery date and your rough notes. It turns those into phases, tasks and milestones
laid out on a timeline, keeps the files in your own Google Drive or OneDrive, exports the plan to a
spreadsheet your client can open, and can run the AI parts on a machine on your own network instead
of somebody else's cloud.

Built for design and media-installation work, where the opening night does not move and everything
else has to be arranged around it.

---

## What you get

- **A timeline that reads backwards.** Move the delivery date and the whole plan moves with it.
- **Tasks, a board, and triage.** Kanban by status, a table, and a view that shows only what is
  overdue or due next.
- **Markdown documents** that live beside the plan, and can be edited from the cloud folder or the app.
- **AI that is optional and pluggable.** Gemini, OpenAI, Anthropic, Mistral, any OpenAI-compatible
  server, or a LAN farm. Without a provider configured the app still works and says so, instead of
  pretending an AI answered.
- **Your drive is the source of truth.** Not a database you cannot see. Drop a `.md` file in the
  project folder and it shows up in the app.
- **Spreadsheet export** with a real Gantt sheet, straight into Google Sheets or Excel.
- **A desktop app** for Windows, Apple Silicon and Intel Macs.

The full inventory, including what is not finished yet, is in [docs/FEATURES.md](docs/FEATURES.md).
It marks every feature as wired, built, planned or cut, and says why for the cut ones.

---

## Running it

Requires Node 20 or newer. Node 24 is what it is developed against.

```bash
npm install
npm run dev
```

Open http://localhost:3000.

### The desktop app

```bash
npm run build:all        # renderer + electron bundles
npm run package:mac      # dmg and zip, Apple Silicon and Intel
npm run package:win      # NSIS installer, x64
```

Builds land in `release/`.

### First launch on macOS — required, it will not open otherwise

The app is signed ad-hoc, not notarized, because there is no paid Apple developer account behind it.
Gatekeeper therefore **rejects it outright**: `spctl -a` returns `rejected`, and macOS shows a refusal
dialog. This is verified behaviour on macOS 26, not a theoretical warning.

On macOS 15 and later, right-clicking and choosing Open **no longer bypasses this** — Apple removed
that path. Drag the app to Applications, then run once:

```bash
xattr -dr com.apple.quarantine /Applications/RetroPlaningStudio.app
```

The app then opens normally, every time. The signature itself is valid (`codesign --verify --deep
--strict` passes); what it lacks is an Apple-issued Developer ID, which only a paid account provides.

If macOS says the app is **damaged**, that is a different and more serious problem — a broken
signature rather than a missing one. Report it rather than working around it.

**On Windows**, SmartScreen will warn about an unknown publisher for the same reason. More Info, then
Run anyway. Note that the Windows builds have never been launched by anyone — they are built and
packaged, not tested.

---

## Connecting things

### AI providers

Settings, AI providers, Add. Paste a key, pick a model, press Test connection. Keys are stored
encrypted by the OS keychain in the desktop app; in the browser they sit in local storage, which the
settings screen tells you plainly.

### A model on your own network

If you run [LlmOnLan](https://github.com/b2renger/LlmOnLan) on a machine with a GPU, the desktop app
finds it by itself: Add provider, LlmOnLan farm, Scan. Nothing leaves your network. The full
integration guide, including why discovery needs the desktop build, is in
[docs/dev/LLMONLAN.md](docs/dev/LLMONLAN.md).

### Google Drive or OneDrive

You supply your own OAuth client id, so the data belongs to you and there is no middleman server.
Settings, Cloud sync has the steps and the exact scopes. The app creates
`RetroPlaningStudio/<project>/` with `project.json`, a `docs/` folder of markdown files, and an
`exports/` folder. Edit a document in either place; the app reconciles both directions and keeps both
copies when it cannot decide.

---

## Documentation

| Document | For |
|---|---|
| [docs/FEATURES.md](docs/FEATURES.md) | What exists, what does not, what was removed and why |
| [docs/HUMAN-TESTS.md](docs/HUMAN-TESTS.md) | A checklist to verify a build by hand |
| [docs/dev/LLMONLAN.md](docs/dev/LLMONLAN.md) | LAN inference integration |
| [docs/dev/ELECTRON.md](docs/dev/ELECTRON.md) | Desktop architecture and the macOS signing trap |
| [docs/dev/STATE-API.md](docs/dev/STATE-API.md) | Application state contract |
| [docs/audit/FEATURE-AUDIT.md](docs/audit/FEATURE-AUDIT.md) | Audit of the original generated code |
| [docs/dev/PROGRESS.md](docs/dev/PROGRESS.md) | Build journal |

---

## Development

```bash
npm test              # vitest
npm run typecheck     # tsc --noEmit
npm run build         # web build
```

### Where things live

```
src/services/ai/       AI providers behind one interface
src/services/cloud/    Drive and OneDrive, OAuth, sync engine
src/services/export/   Gantt model, xlsx, csv, svg, markdown
src/state/             Reducer, persistence, secrets, theme
src/components/        Views and modals
electron/              Main process, preload bridge, LAN discovery
```

Network calls go through `src/services/http/httpClient.ts`, which uses the Electron main process
when it is available so that LAN endpoints and provider APIs are reachable without CORS headers, and
`window.fetch` otherwise. Nothing should call `fetch` directly.

---

## History

This started as a Google AI Studio generation. A lot of it presented convincing interfaces for things
that did not happen: a sign-in that invented its own token, a sync that swallowed the API error and
reported success, a panel of eight database tests that asserted arithmetic on constants. Those are
gone. What replaced them is smaller and does less, but what it says it did, it did.
