# RetroPlaningStudio — Feature list

Status vocabulary, used strictly:

| Status | Meaning |
|---|---|
| **Wired** | Works today in the running app, end to end. |
| **Built** | Code and tests exist and pass, but no UI reaches it yet. Scheduled for the UI wiring phase. |
| **Planned** | Specified, not yet written. |
| **Cut** | Existed in the generated original, deliberately removed. Reason given. |

Last updated 2026-09-20 22:55. Test counts are from `npm test`.

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
| **Backward scheduling** — move the target date and shift the whole plan with it | Built | `setTargetDeliveryDate(date, 'shift-all')` shifts every phase, task and milestone by the delta. The original only stored the date while claiming to "recalculate buffers". |
| **Real critical path** from task dependencies | Built | `computeCriticalPath` — longest path by estimated hours, cycle-safe. The original had a boolean flag someone typed by hand. |
| **Honest project health** (days remaining, overdue count, slack, schedule-overruns-target) | Built | `computeProjectHealth`. Replaces the invented "94% safe" and "6d buffer" literals. |
| Dependency arrows on the timeline | Planned | Dependencies are stored and used by the critical path, but never drawn. |
| Drag and resize bars on the timeline | Planned | |
| Edit an existing task | Planned | The original had no edit-task UI at all: create only. |
| Real zoom (pixels per day) | Planned | The original zoom control only changed the number of axis ticks. |

## 2. Documents

| Feature | Status | Notes |
|---|---|---|
| Markdown documents per project, create, edit, delete, save | Wired | |
| Drag-and-drop import of `.md` notes | Wired | Files only, not folders. |
| Live preview | Wired | Headings, checkboxes, bullets, bold, inline code. No tables, fenced code, links or images yet. |
| Quick-insert snippets | Wired | |
| Full markdown parser (tables, code fences, links) | Planned | |
| Unsaved-changes guard when switching documents | Planned | Edits are currently discarded silently. |

## 3. AI

Every AI feature runs through one provider-agnostic layer, so the same button works with a cloud
provider or a model on your own LAN. 119 tests.

| Feature | Status | Notes |
|---|---|---|
| Google Gemini | Built | REST `generateContent`, `x-goog-api-key`, JSON mode, model listing. |
| OpenAI | Built | `/chat/completions`, JSON mode, model listing. |
| Anthropic | Built | `/v1/messages`, direct browser access header, turn merging. |
| Mistral | Built | OpenAI wire format. |
| Any OpenAI-compatible server | Built | Ollama, LM Studio, LiteLLM, vLLM. |
| **LlmOnLan LAN farms** | Built | See [LLMONLAN.md](dev/LLMONLAN.md). Auto-discovery over the UDP beacon, optional master key, model list from the farm. |
| Structure raw notes into a plan ("crunch") | Built | Ported off the Express proxy onto the provider layer. |
| Dependency and bottleneck analysis | Built | |
| Assistant chat with project context | Built | |
| Local fallback when no provider is configured | Built | Labelled "Local heuristic (no AI provider configured)". The original faked a successful AI answer instead. |
| Provider settings UI (add, key, base URL, model picker, test connection) | Planned | The UI wiring phase. |
| Farm picker with discovered farms | Planned | Same phase. |

## 4. Cloud sync — the drive is the source of truth

93 tests. Files you create in the cloud folder appear in the app; documents you write in the app
appear in the cloud folder.

| Feature | Status | Notes |
|---|---|---|
| Google Drive provider | Built | Drive v3: paged listing, upload, update, Google Docs exported as text, Sheets conversion. |
| Microsoft OneDrive provider | Built | Graph v1.0: delta-friendly listing, upload, 4 MB simple-upload guard. |
| OAuth 2.0 with PKCE | Built | Loopback server on desktop, popup plus `postMessage` on web. You supply your own client ID. |
| Token storage | Built | Encrypted by the OS keychain in the desktop app, localStorage on web. |
| Folder layout `RetroPlaningStudio/<project>/{docs,exports}` | Built | `project.json` plus one `.md` per document with YAML frontmatter. |
| Two-way reconciliation with conflict handling | Built | `planSync` is a pure function over local and remote listings; conflicts keep both copies. |
| Open a project that was created in the cloud | Built | `listCloudProjects` finds folders containing a `project.json`. |
| Sync panel, status chip, periodic sync | Planned | UI wiring phase. |
| Real-time collaboration | Cut | Never existed. The original advertised "real-time sync" and shipped localStorage. |

## 5. Exports

45 tests, including a round-trip of the generated workbook back through the spreadsheet parser.

| Feature | Status | Notes |
|---|---|---|
| Excel workbook: Tasks, Phases, Milestones, Gantt, Summary | Built | The Gantt sheet is a real day-column chart with coloured fills, merged month headers, weekend shading, milestone diamonds, frozen panes. |
| Upload to Google Sheets | Built | Converts on upload, returns the link. |
| Upload to OneDrive for Excel Online | Built | |
| CSV (tasks, phases, milestones) | Built | RFC-4180 escaping, optional BOM so Excel reads UTF-8. |
| Markdown export and Mermaid Gantt | Built | |
| Timeline as SVG, and PNG in the browser | Built | |
| JSON export and import | Built | |
| Export menu in the UI | Planned | UI wiring phase. |

## 6. Desktop application

| Feature | Status | Notes |
|---|---|---|
| Electron shell, main plus isolated preload bridge | Built | 8 tests. |
| CORS-free network calls from the renderer | Built | Needed for LAN farms and provider APIs. |
| UDP farm discovery | Built | Only possible in the desktop build: browsers cannot receive multicast. |
| OAuth loopback server | Built | Avoids the web popup flow entirely. |
| OS-encrypted secret storage | Built | |
| Native save dialog | Built | |
| macOS build, Apple Silicon and Intel | Built | dmg plus zip per architecture. Signature verified by a build gate. |
| Windows build | Built | NSIS installer, x64. |
| Notarization | Cut | No Apple developer account. First launch needs right-click then Open. Documented. |

## 7. Team

| Feature | Status | Notes |
|---|---|---|
| Team member list, roles, workload | Wired | |
| Comments on a project | Wired | |
| History log with actor and diff | Wired | |
| Undo for destructive actions | Built | Replaces a "revert" button that silently did nothing on most rows. |
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
