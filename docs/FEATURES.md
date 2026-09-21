# RetroPlaningStudio — Feature list

Status vocabulary, used strictly:

| Status | Meaning |
|---|---|
| **Wired** | Works today in the running app, end to end. |
| **Built** | Code and tests exist and pass, but no UI reaches it yet. Scheduled for the UI wiring phase. |
| **Planned** | Specified, not yet written. |
| **Cut** | Existed in the generated original, deliberately removed. Reason given. |

Last updated 2026-09-21 05:40. Test counts are from `npm test`.

---

## 1. Projects, planning and scheduling

| Feature | Status | Notes |
|---|---|---|
| Multiple projects, switcher, per-project workspace | Wired | |
| Create project (title, client, description, target delivery date) | Wired | Phases were hardcoded to Oct/Nov 2026 regardless of the date chosen; fixed in the state refactor. |
| Phases with colour, window, buffer days | Wired | |
| Tasks: title, description, status, priority, assignee, dates, estimate, deliverables, checklist, tags | Wired | |
| Milestones with hard-deadline flag and completion | Wired | |
| Gantt timeline: phase bands, task bars, milestone flags, today line, target line | Wired | Read-only. |
| Kanban board by status, table view, search and phase filter | Wired | |
| Immediate-action triage: overdue and due-soon, quick done, inline checklist | Wired | |
| Per-assignee workload | Wired | |
| **Backward scheduling** — move the target date and shift the whole plan with it | Wired | `setTargetDeliveryDate(date, 'shift-all')` shifts every phase, task and milestone by the delta. The original only stored the date while claiming to "recalculate buffers". |
| **Real critical path** from task dependencies | Wired | `computeCriticalPath` — longest path by estimated hours, cycle-safe. The original had a boolean flag someone typed by hand. |
| **Honest project health** (days remaining, overdue count, slack, schedule-overruns-target) | Wired | `computeProjectHealth`. Replaces the invented "94% safe" and "6d buffer" literals. |
| Dependency arrows on the timeline | Wired | Dependencies are stored and used by the critical path, but never drawn. |
| Drag and resize bars on the timeline | Wired | |
| Edit an existing task | Wired | The original had no edit-task UI at all: create only. |
| Real zoom (pixels per day) | Wired | The original zoom control only changed the number of axis ticks. |

## 2. Documents

| Feature | Status | Notes |
|---|---|---|
| Markdown documents per project, create, edit, delete, save | Wired | |
| Drag-and-drop import of `.md` notes | Wired | Files only, not folders. |
| Live preview | Wired | Full GitHub-flavoured markdown: tables, fenced code, links, images, task lists, strikethrough. Loaded on demand. |
| Quick-insert snippets | Wired | |
| Link and image safety | Wired | Scheme-allowlisted; script-scheme links render as text and remote images do not auto-fetch. |
| Unsaved-changes guard when switching documents | Planned | Edits are currently discarded silently. |

## 3. AI

Every AI feature runs through one provider-agnostic layer, so the same button works with a cloud
provider or a model on your own LAN. 119 tests.

| Feature | Status | Notes |
|---|---|---|
| Google Gemini | Wired | REST `generateContent`, `x-goog-api-key`, JSON mode, model listing. |
| OpenAI | Wired | `/chat/completions`, JSON mode, model listing. |
| Anthropic | Wired | `/v1/messages`, direct browser access header, turn merging. |
| Mistral | Wired | OpenAI wire format. |
| Any OpenAI-compatible server | Wired | Ollama, LM Studio, LiteLLM, vLLM. |
| **LlmOnLan LAN farms** | Wired | See [LLMONLAN.md](dev/LLMONLAN.md). Auto-discovery over the UDP beacon, optional master key, model list from the farm. |
| Structure raw notes into a plan ("crunch") | Wired | Ported off the Express proxy onto the provider layer. |
| Dependency and bottleneck analysis | Wired | |
| Assistant chat with project context | Wired | |
| Local fallback when no provider is configured | Wired | Labelled "Local heuristic (no AI provider configured)". The original faked a successful AI answer instead. |
| Provider settings UI (add, key, base URL, model picker, test connection) | Wired | Settings, AI providers. |
| Farm picker with discovered farms | Wired | Scan on desktop; manual address with a reachability probe everywhere. |

## 4. Cloud sync — the drive is the source of truth

93 tests. Files you create in the cloud folder appear in the app; documents you write in the app
appear in the cloud folder.

| Feature | Status | Notes |
|---|---|---|
| Google Drive provider | Wired | Drive v3: paged listing, upload, update, Google Docs exported as text, Sheets conversion. |
| Microsoft OneDrive provider | Wired | Graph v1.0: delta-friendly listing, upload, 4 MB simple-upload guard. |
| OAuth 2.0 with PKCE | Wired | Loopback server on desktop, popup plus `postMessage` on web. You supply your own client ID. |
| Token storage | Wired | Encrypted by the OS keychain in the desktop app, localStorage on web. |
| Folder layout `RetroPlaningStudio/<project>/{docs,exports}` | Wired | `project.json` plus one `.md` per document with YAML frontmatter. |
| Two-way reconciliation with conflict handling | Wired | `planSync` is a pure function over local and remote listings; conflicts keep both copies. |
| Open a project that was created in the cloud | Wired | `listCloudProjects` finds folders containing a `project.json`. |
| Sync panel, status chip, periodic sync | Wired | Syncs on mount, on focus and every 60s, backing off on failure. |
| Real-time collaboration | Cut | Never existed. The original advertised "real-time sync" and shipped localStorage. |

## 5. Exports

45 tests, including a round-trip of the generated workbook back through the spreadsheet parser.

| Feature | Status | Notes |
|---|---|---|
| Excel workbook: Tasks, Phases, Milestones, Gantt, Summary | Wired | The Gantt sheet is a real day-column chart with coloured fills, merged month headers, weekend shading, milestone diamonds, frozen panes. |
| Upload to Google Sheets | Wired | Converts on upload, returns the link. |
| Upload to OneDrive for Excel Online | Wired | |
| CSV (tasks, phases, milestones) | Wired | RFC-4180 escaping, optional BOM so Excel reads UTF-8. |
| Markdown export and Mermaid Gantt | Wired | |
| Timeline as SVG, and PNG in the browser | Wired | |
| JSON export and import | Wired | |
| Export menu in the UI | Wired | In the project header; loads the spreadsheet library on demand. |

## 6. Desktop application

The desktop build exists because two things are impossible in a browser: receiving the UDP beacon
that finds LAN farms, and calling one at all from a secure page. Everything else works in both.

| Feature | Status | Notes |
|---|---|---|
| Electron shell, main plus isolated preload bridge | Wired | 8 tests. Every renderer capability check goes through `src/capabilities.ts`. |
| CORS-free network calls from the renderer | Wired | Used by every network call in the app. |
| UDP farm discovery | Wired | Scan button in AI settings. Desktop only: browsers cannot receive multicast. |
| OAuth loopback server | Wired | Used by Connect in cloud settings on desktop; the web build uses a popup. |
| OS-encrypted secret storage | Wired | Holds API keys and OAuth tokens on desktop. |
| Native save dialog | Wired | Every export goes through it on desktop. |
| macOS build, Apple Silicon and Intel | Wired | dmg plus zip per architecture; `npm run package:mac`. A build gate fails the build if the signature is invalid. |
| Windows build | Wired | NSIS installer, x64; `npm run package:win`. |
| Notarization | Cut | No Apple developer account. First launch needs right-click then Open. Documented. |

## 7. Team

| Feature | Status | Notes |
|---|---|---|
| Team member list, roles, workload | Wired | |
| Comments on a project | Wired | |
| History log with actor and diff | Wired | |
| Undo for destructive actions | Wired | Replaces a "revert" button that silently did nothing on most rows. |
| Invitations | Cut down to local | The original added the member instantly, marked the invitation "accepted", and sent no email. It is now a local list, labelled as such. Real invitations need a server. |
| Permissions | Cut | Stored but never enforced anywhere. Misleading. |

## 8. Removed from the original

| What | Why |
|---|---|
| "Database tester" with 8 live tests | Tests asserted arithmetic on inline constants and read a storage key the app never used, then reported "zero data loss". |
| "Implementation plan" verification matrix | 13 items hardcoded to `verified`, header claiming "12/12 goals verified". |
| Fake Google sign-in | Invented a token like `ya29.<timestamp>`, and the app booted already "connected". |
| Fake Drive sync | Called the real API with the fake token, swallowed the error, reported success. |
| `InteractiveTutorialModal` | Dead file, never imported. |
| Firebase config with a live API key and OAuth client id | Committed secret. Removed; **rotate it in Google Cloud**, it remains in git history. |
| Marketing copy: "100% durable", "zero data loss", "production verified", "real-time" | None of it was true. |
