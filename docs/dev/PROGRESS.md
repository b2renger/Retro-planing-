# Progress journal (read this first after a context reset)

Conventions: absolute paths, npm (not bun), commit per phase, critic pass before commit.
Repo: /Users/b2renger/Documents/RetroPlaningStudio (remote still github.com/b2renger/Retro-planing-.git — owner must rename).

## 2026-09-20 21:30 — Phase 0 done
- Moved repo up one level, renamed package, removed firebase-applet-config.json/metadata.json/bun.lock.
- esbuild ^0.28 fixes npm ERESOLVE with vite 8. `npx tsc --noEmit` clean, `vite build` OK (543 kB chunk).
- Facts: server.ts = Express + Gemini proxy (`/api/gemini/*`) + vite middleware; all state in AppContext.tsx
  (localStorage keys `retroplan_*_v4_media`); Google Drive is mocked (fake token, default signed-in);
  storageService "live tests" are theater; TypeScript 7.0.2 / vite 8.3 / React 19.3 / Tailwind 4.3.
- LlmOnLan facts: OpenAI-compatible `http://<farm>:4000/v1`, optional Bearer masterKey, `/v1/models` open,
  UDP beacon multicast 239.255.43.10:41998 JSON every 5s, admin http :41997.
- artlux mac catch: sign via electron-builder `mac.identity:"-"` (fuses flipped before builder signing),
  `hardenedRuntime:false`, `electronFuses.resetAdHocDarwinSignature:true`, verify with codesign --deep --strict.

## Next
- Phase 1 audit agent running → docs/audit/FEATURE-AUDIT.md, then critic pass.

## 2026-09-20 21:50 — Phase 1/3/4/5/6 part A in flight (parallel agents, disjoint dirs)
- Audit agent → docs/audit/FEATURE-AUDIT.md (read-only on src/components + mockData).
- AI agent → src/services/ai/** (+tests). Cloud agent → src/services/cloud/** + public/oauth/callback.html (+tests).
- Export agent → src/services/export/** (+tests). Electron agent → electron/**, scripts/**, build/**, package.json build config, vite base './'.
- Shared foundation committed: src/services/http/httpClient.ts (httpFetch/assertOk, desktop-aware), src/types/desktop.d.ts (DesktopBridge contract), vitest.config.ts.
- After they land: critic pass per layer → commit each → then Phase 2 theme refactor + Phase 3/4/5 part B (UI wiring: settings, cloud panel, export menu), delete mocks (googleDriveService, geminiService, DatabaseTester, ImplementationPlanModal per audit).

## 2026-09-20 22:15 — Audit landed; state refactor started
- docs/audit/FEATURE-AUDIT.md: REAL 42 / SIMULATED 19 / BROKEN 6 / DEAD 11. Key: no backward-scheduling engine exists,
  light theme unreadable (header, timeline, navbar right half, all modals), fake trust surfaces (DB tester, impl. plan,
  fake Google account/token, seeded invitation), stale-closure history loss in MarkdownStudio apply-plan, v3/v4 storage key split.
- State agent (owns src/context, src/state, types, mockData, deletes fakes, minimal component compile fixes) → docs/dev/STATE-API.md.
- Plan after state + services land: critic pass on services → commit → parallel UI agents by component group
  (theme tokens + shared Modal + AI settings panel + CloudPanel + export menu + timeline honesty + task edit modal).

## 2026-09-20 22:40 — Budget correction: SEQUENTIAL from here
Usage was burning too fast with 5 parallel agents. New rules for the rest of the night:
- ONE agent at a time. No parallel fan-out. Orchestrator does small fixes itself (sed/Edit), no agent for <100-line jobs.
- Critic passes only on: AI layer (running) and cloud sync. Everything else is verified by `npm test` + `tsc` + `vite build` + my own read of the diff.
- Prefer fixing over re-generating. Prefer one large well-specified agent task over several small ones.
- In-flight when this rule was set: cloud sync, export, state refactor, AI critic. Let them finish, then serialize.
Remaining order (strict): 1) land+commit cloud/export/state 2) theme tokens pass (one agent, all components)
3) UI wiring: settings (AI+cloud), CloudPanel, export menu (one agent) 4) timeline honesty + task edit (one agent)
5) full test/build/package + docs + human test plan (orchestrator).

## STANDING RULE for every agent from 2026-09-20 23:10 (set by b2renger)
Usage limits are the binding constraint, not time. Therefore:
1. **Write to disk continuously, not at the end.** Land each file as soon as it compiles. A killed or
   context-exhausted agent must leave usable work behind, never an all-or-nothing batch.
2. **Document as you go.** Before finishing — and again whenever a phase of your own work completes —
   append to `docs/dev/PROGRESS.md`: what you changed, what is verified, what is half-done, and the
   exact next step someone else would take. Write it so a fresh session with no memory can resume.
3. **Design for sequential resumption.** Split work so it can stop at any file boundary. If you run low
   on context, stop early, write the handoff note, and report what remains rather than rushing the rest.
4. One agent at a time. Small fixes are done by the orchestrator with sed/Edit, never delegated.

## 2026-09-20 23:00 — HANDOFF: all service layers landed, UI wiring is what remains
Committed and pushed: 9e60058. Gate is green: 307 tests, `tsc --noEmit` clean, `vite build` clean,
`electron-builder --dir --mac --arm64` produced an app whose ad-hoc signature passes
`codesign --verify --deep --strict`.

### What exists (all tested, most NOT reachable from the UI yet)
- `src/services/ai/**` (119 tests) — Gemini/OpenAI/Anthropic/Mistral/openai-compatible/**llmonlan**.
  Entry points: `client.ts` chat/chatJson/listModels/testConnection, `tasks.ts` crunchMarkdownNotes/
  analyzeDependencies/askAssistant, `farms.ts` discoverFarms/probeFarm/farmToProviderConfig,
  `registry.ts` PROVIDER_CATALOG (drives the settings form: requiresKey/requiresBaseUrl/canListModels).
- `src/services/cloud/**` (93 tests) — googleDrive.ts / oneDrive.ts implement CloudProvider;
  `oauth.ts runAuthFlow(providerId, {clientId, clientSecret?})`; `syncEngine.ts syncProject/
  bootstrapProjectFolder/listCloudProjects`; `memoryProvider.ts` for UI dev without credentials.
- `src/services/export/**` (45 tests) — `buildGanttModel` + `computeCriticalPath` (reuse in the timeline!),
  projectToXlsx, tasksToCsv, projectToMarkdown, ganttToSvg, downloadBytes, exportToGoogleSheets/OneDrive.
  **Import the barrel dynamically** (`await import('../services/export')`) — exceljs is ~324 kB gzip.
- `src/state/**` (42 tests) + `src/context/AppContext.tsx` rewritten. Read `docs/dev/STATE-API.md` FIRST:
  it is the contract every UI change must use. `useActiveProject()` inside project views, `useApp()` elsewhere.
- `electron/**` (8 tests) — bridge is live; `window.desktop` types in `src/types/desktop.d.ts`.

### Known temporary things to clean during the UI pass (from the state agent's own report)
- `src/components/CloudPanel.tsx` is a placeholder; `ApiSettingsModal.tsx` is a stub bound to `isSettingsOpen`.
- `InteractiveTourGuide.tsx` unmounted from App.tsx — delete it or adopt it as the single tutorial surface.
- Raw ISO timestamps render in NotificationCenter / TeamCollaborationView / HistoryAuditView.
- `MOCK_USERS` still imported by ImmediateActionView, TaskBoard, HistoryAuditView, RetroplanningTimeline
  (should use `teamMembers`). CreateProjectModal still hardcodes Oct/Nov phases.
- `geminiService.ts` survives as a types-only shim (CrunchResult/DependencyAnalysisResult) — move those
  types into `src/services/ai/types.ts` and delete it.
- Unused lucide imports after button removals; `noUnusedLocals` is off.

### NEXT PHASES, strictly sequential, one agent each
1. **Theme pass** — semantic tokens in index.css (`bg-app/bg-card/bg-elevated/bg-input/bg-code/border-line/
   fg/fg-muted`), replace 82x `#0D121F`, 21x `#141B2D`, 21x `#131927`, `text-slate-1xx`, `border-white/N`
   across ALL components. Worst offenders: ProjectHeader, RetroplanningTimeline, Navbar right half, every modal.
   Acceptance: `grep -rn "bg-\[#" src/components` returns nothing; both themes readable.
2. **Settings UI** — AI providers (add/edit/remove, key, base URL, model picker via listModels, Test
   connection, default) + LlmOnLan Scan button (desktop only) + Cloud sync (client id, Connect, folder, status).
   Replaces the ApiSettingsModal stub. This is what makes the LlmOnLan feature visible to the user.
3. **CloudPanel + export menu** — real sync panel on syncEngine; export menu wired to the export barrel.
4. **Timeline honesty + task edit modal** — use buildGanttModel/computeCriticalPath, real zoom, lanes for
   overlapping tasks, dependency arrows, edit-task modal, shift-all date control.
5. **Final gate** — npm test, tsc, build:all, package:mac (arm64+x64) + package:win, docs/HUMAN-TESTS.md.

## 2026-09-20 23:55 — HANDOFF: theme-token pass + shared Modal + 3-way theme control DONE

### Step 1 finding (the `@variant` scare)
**The dark variant was never broken.** Tailwind 4.3.3 accepts `@variant name (...)` *and*
`@custom-variant name (...)` at the top level for defining a variant — verified by compiling a probe
stylesheet through `tailwindcss/dist/lib.js`: both emit `.dark\:bg-x:where(.dark, .dark *)`.
`index.css` now uses `@custom-variant` (the documented spelling) anyway. The 4 already-working
light-theme views were therefore genuinely working; the other 15 files were simply unconverted.

### What landed
- `src/index.css` — `@custom-variant dark`, `@theme inline` token layer, `--breakpoint-xs: 30rem`
  (the `xs:` breakpoint used by ProjectHeader/Navbar was previously undefined and silently dropped
  those labels). Tokens: `app card elevated input code line line-strong fg fg-muted fg-subtle`,
  defined as `--color-X: var(--s-X)` with `--s-X` re-bound under `html.dark`. `@theme inline` means
  utilities compile to `var(--s-X)` directly — no specificity race, no `dark:` prefix needed.
- `src/components/ui/Modal.tsx` — **new**. The single modal shell: themed chrome plus the P1
  accessibility baseline the audit asked for (`role="dialog"`, `aria-modal`, `aria-labelledby` /
  `aria-label`, Escape, backdrop click, focus-in on open, Tab trap, focus restore on close).
  API documented in `docs/dev/THEME.md` §5.
- **All 19 files** in `src/components` + `src/App.tsx` converted to tokens. Nothing is dark-only any
  more: header, whole timeline tab, navbar right half + mobile drawer, and every modal now read in
  both themes. Components that already used `dark:` correctly (HardwareMediaView, ImmediateActionView,
  TaskBoard, TeamCollaborationView, MarkdownStudio, HistoryAuditView, NotificationCenter, Navbar-left)
  were collapsed onto the same tokens — `bg-white dark:bg-[#0D121F]` → `bg-card` — so the app now has
  exactly one system.
- Broken classes fixed: `bg-slate-850`, `border-slate-750`, `hover:bg-slate-750` (not real Tailwind
  shades — they rendered as nothing) in GeminiAssistantModal/MarkdownStudio; the undefined `xs:`
  breakpoint is now defined rather than dropped.
- Low-contrast fixes from the audit: HistoryAuditView action badges (accent-700/dark:accent-300,
  neutral badges now `text-fg` on `bg-line-strong`/`bg-elevated`), MarkdownStudio inline chips and
  `<strong>`, NotificationCenter item title/body/footer. Dark-tuned accent surfaces
  (`bg-rose-950/90`, `from-purple-950/40`, `bg-emerald-950/80` on Gantt bars) got light twins.
  ~40 dead `hover:bg-elevated` on a `bg-elevated` base became `hover:bg-line` (real feedback).
- **Modals on the shared shell:** ApiSettingsModal, CloudPanel, CreateTaskModal, CreateProjectModal,
  GeminiAssistantModal, InviteCollaboratorsModal, and the task inspector inside RetroplanningTimeline.
  Footer submit buttons use `form={FORM_ID}` since the footer sits outside the `<form>`.
- **Theme control (Step 5):** Navbar's two-way toggle replaced by a three-way segmented
  `role="radiogroup"` (Moon / Sun / Monitor, `aria-label` per option) bound to `theme`/`setTheme`.
  It reflects the stored preference, so `system` is visible as its own state.
- `docs/dev/THEME.md` — token table, the accents-as-text rule, how to add a surface, Modal API,
  and the two guard-rail greps.

### Deliberately NOT converted
- `TutorialDrawer` stays a **non-modal docked panel** (bottom-right, z-40, no backdrop). Wrapping it
  in `Modal` would make it blocking and change behaviour. It got `role="complementary"` +
  `aria-label` and full token conversion instead.
- Two justified colour exceptions remain, both correct in either theme: `text-slate-950` on the solid
  `bg-amber-400` milestone chip (RetroplanningTimeline), and the neutral
  `bg-slate-500/10 … border-slate-500/20` badge (HardwareMediaView:101).
- `InteractiveTourGuide.tsx` is still unmounted/dead but was converted anyway so it does not
  reintroduce hex colours if someone re-adopts it.

### Verified
`npx tsc --noEmit` clean · `npx vitest run` 307/307 · `npx vite build` clean (88.3 kB CSS).
Emitted CSS checked by hand: `html.dark,:root.dark{--s-app:#070a10;…}` present, every token utility
compiles to `var(--s-…)`, `.xs\:inline` emits at `min-width:30rem`, opacity modifiers
(`bg-card/95`, `bg-app/98`) resolve via `color-mix`.
Acceptance greps both empty:
`grep -rn "bg-\[#\|border-white/\|bg-white/\|text-slate-[12]00" src/components src/App.tsx`
`grep -rn "slate-850\|slate-750" src/components`

### NOT verified (no browser in this environment)
No screenshot/visual pass — puppeteer/playwright are not installed and were not added. A human should
open both themes and check the Gantt tab and the AI Copilot modal in particular; those had the most
dark-tuned accent surfaces.

### Next phase (unchanged from the 23:00 handoff)
2. Settings UI (AI providers + LlmOnLan scan + cloud). `ApiSettingsModal` is still a stub — but it is
   now a 40-line `Modal` child, so the real form drops straight into its body/footer.
3. CloudPanel + export menu. Same: `CloudPanel` is now a `Modal` child.
4. Timeline honesty + task edit modal — build the edit modal on `ui/Modal`, not from scratch.

## 2026-09-20 22:35 — Settings UI landed; every AI feature now runs on the chosen provider
Gate green: `npx tsc --noEmit` clean · `npx vitest run` **324/324** (307 + 17 new) · `npx vite build` clean
(586 kB js / 91.6 kB css). Guard greps empty: `bg-\[#`, `border-white/`, `bg-white/`, `text-slate-[12]00`,
`slate-850|slate-750`, and `geminiService`.

### Added
- `src/components/settings/SettingsModal.tsx` — the real settings dialog on `ui/Modal`, bound to
  `isSettingsOpen`. Left tab rail (`role="tablist"`, vertical) → **AI providers · Cloud sync · Data · About**.
  Replaces `ApiSettingsModal.tsx` (deleted; `App.tsx` imports `SettingsModal`).
- `src/components/settings/AiProvidersPanel.tsx` — provider cards (status dot, Default badge / "In use
  (no default set)", Test · Edit · Remove with an **inline** confirm, Set as default), the empty state, the
  family picker (cards from `PROVIDER_CATALOG` + one-line blurbs) and the "Find a LlmOnLan farm" shortcut.
  The status dot is grey until a test has actually run in this session — never a pre-claimed "connected".
- `src/components/settings/ProviderForm.tsx` — add/edit form driven by the catalog entry: key field only
  when `requiresKey` (optional key field for open servers), base URL only when `requiresBaseUrl`, Load
  models → `<select>` + "Other…" free-text, Test connection rendering latency / answering model /
  `sampleReply` and, on failure, the layer's own error message verbatim.
- `src/components/settings/FarmDiscovery.tsx` — the LlmOnLan piece. Desktop: **Scan network** →
  `discoverFarms(4000)` with a "Listening for farms…" state and farm cards (name, endpoint, model, seats
  when the beacon carried them) → "Use this farm" → `farmToProviderConfig` pre-fills the form. Web: no dead
  button, just the note that browsers cannot receive multicast. Always: one manual address field
  (normalised through `normalizeLlmOnLanEndpoint` and echoed under the input) + **Check** → `probeFarm`
  (reachable / models / latency) + an optional master-key field. Empty scan = a help message naming the two
  usual causes, not an error.
- `src/components/settings/DataPanel.tsx` — export/restore backup (via `services/export/download`) and
  `runStorageSelfTest` (keys, bytes used) + the `storageError` line.
- `src/components/settings/AboutPanel.tsx`, `controls.tsx` (shared class strings + `Field`/`PanelHeading`),
  `helpers.ts` + `helpers.test.ts` (**17 tests**: `displayEndpoint`, `missingRequirements`, `canLoadModels`,
  `secretsStorageNote`, `uniqueLabel`, `formatBytes`, `draftToConfig`).
- `src/components/AiAnalysisPanel.tsx` — renders a `DependencyOutcome`: source line, fallback banner,
  executive summary, buffer health, bottlenecks with severity, suggested links, open questions.

### Changed
- `src/components/GeminiAssistantModal.tsx` → **`AiAssistantModal.tsx`** (`git mv`, component renamed,
  import updated in `App.tsx`). Real `history` is passed to `askAssistant`, the header names the active
  provider + model, fallback turns carry an "answered locally" banner with an Open-settings link, send is
  disabled in flight, and the old fake "trouble connecting to Gemini" message is gone.
- `src/components/MarkdownStudio.tsx` — holds the whole `CrunchOutcome`; the preview says whether the model
  or the local heuristic produced it, shows a fallback banner (with the provider error when there was one)
  and an Open-settings link, and **Apply → inline confirm** ("this replaces phases, tasks and milestones").
- `src/components/RetroplanningTimeline.tsx` — the optimizer result is rendered in `AiAnalysisPanel` instead
  of being discarded; a real failure shows the actual message and posts a failure notification (the old code
  posted a success-shaped notification on error).
- `src/components/Navbar.tsx` — the AI chip's green dot now reflects "a provider is configured" instead of
  being permanently green; titles/labels say "AI providers" instead of "Gemini API". Button id
  `gemini-assistant-btn` → `ai-assistant-btn` (nothing referenced the old id).
- `ImmediateActionView` ("AI schedule audit", "AI agent") and `NotificationCenter` ("AI insights", honest
  footer) lost the Gemini-only wording.
- `src/services/ai/types.ts` now owns `CrunchResult` / `DependencyAnalysisResult`; `tasks.ts`, `fallbacks.ts`
  and `MarkdownStudio` import from there; **`src/services/geminiService.ts` deleted**.
- `src/services/ai/farms.ts` — `FarmInfo.capacity` added and mapped from the beacon (additive; tests green).
- `tsconfig.json` — `resolveJsonModule: true` so About can read the version. The About panel imports the two
  **named** exports (`version`, `description`); importing the default would inline all of package.json into
  the bundle (verified: it did, now it does not).

### How the LlmOnLan flow reads end to end
Settings → AI providers → "Find a LlmOnLan farm" (or Add provider → LlmOnLan farm (LAN)) → on desktop, Scan
network listens 4 s for UDP beacons and lists farms; "Use this farm" fills address/model/label → optional
master key → Load models → Test connection → Add provider → Set as default. On the web build the scan
button is absent and the address is typed; Check probes `/v1/models` and reports reachable + models +
latency. Every AI feature then calls `activeAiProvider`.

### Not done / next
- The Cloud sync tab still renders placeholder copy (link state + `cloudStatus`) and a button that opens the
  old `CloudPanel` modal — the real cloud settings screen is the next UI job, alongside the export menu.
- No browser/visual pass was possible here: a human should open Settings in both themes, and on the desktop
  build run a real Scan against a farm (the scan path could only be reasoned about, not executed).
- `InteractiveTourGuide.tsx` is still dead code; `MOCK_USERS` is still imported by four views.

## 2026-09-21 00:05 — SCOPE CONFIRMED BY b2renger (supersedes the earlier phase list)
Decisions: **stay on Electron** (Tauri weighed and rejected for now — it wins on install size and idle
memory but needs the whole main process rewritten in Rust, adds a Safari-engine test matrix on macOS,
and cannot cross-build Windows from a Mac). **Ship a web build to GitHub Pages too**, WITHOUT LlmOnLan —
a HTTPS page cannot call an http:// LAN farm (mixed content is blocked before the request leaves, and a
private LAN address gets no localhost exemption). Cloud AI providers, Drive/OneDrive OAuth and exports
all work client-side, so Pages is viable for everything except LAN inference and UDP discovery.
Goal for 07:00: polished, working, clean UX/UI, with in-app interactive tutorials.

### Remaining phases, strictly sequential, one agent each
4. **(running)** Cloud sync panel + export menu + background sync hook.
5. **Timeline + task editing + navigation cleanup.** Use `buildGanttModel`/`computeCriticalPath` from
   `src/services/export/gantt.ts` (already tested — do not rewrite). Real zoom in px/day, lanes so
   overlapping tasks stop hiding each other, dependency arrows, drag/resize wired to `updatePhase`/
   `updateTask`, an edit-task modal (none exists today: create only), and the shift-all date control.
   Also audit P0 "duplicate, competing navigation": Invite appears 3x on one screen, DB-tests appeared 4x;
   consolidate into one model (tabs in ProjectHeader, everything else in one Navbar menu).
6. **Interactive in-app tutorial — explicitly requested.** ONE surface, not the two the original had
   (`TutorialDrawer` + the unmounted `InteractiveTourGuide` — delete or absorb the latter). Requirements:
   anchored coach-marks that point at the real element (not a modal describing it), steps that the user
   performs themselves and that detect completion from real state, skip/resume/restart, progress persisted,
   and a sandbox: the tutorial must NEVER write into the user's real project — the original's "Watch Live
   Demo" inserted a demo task and flipped the delivery date in live data. Use the sample project
   (`isTutorialTemplate: true`) or a scratch copy. Cover: backward planning, tasks, markdown + AI crunch,
   AI provider setup incl. a LAN farm, cloud sync, export.
7. **GitHub Pages deploy + capability gating.** `.github/workflows/pages.yml` (build, upload artifact,
   deploy). A single `src/capabilities.ts` (`hasDesktop`, `canDiscoverFarms`, `canUseLanFarms`,
   `secretsBackend`) so the web build hides LAN farm scan and any desktop-only affordance cleanly instead
   of showing dead buttons. Vite `base` already relative — verify under a Pages subpath. Document the
   OAuth origins/redirect URIs to register for the Pages URL.
8. **Final gate.** Full `npm test`, `tsc`, `build:all`, `package:mac` (arm64 + x64) and `package:win`,
   review every doc for drift, and write `docs/HUMAN-TESTS.md` — numbered manual acceptance tests a human
   follows to validate each feature, including the two theme spots never visually verified (Gantt tab and
   the AI assistant modal in light mode).

## 2026-09-21 00:30 — UI wiring agent: cloud sync + exports are reachable (DONE)

### Files added
- `src/hooks/cloudClient.ts` — the only glue between UI and `src/services/cloud/**`:
  `createProvider(settings, id)`, `oauthConfig`, `redirectAdvice(id, {desktop, origin})`,
  `scopeExplanations`, `compareDocuments(project, snapshot, syncState)`, `summaryLine`,
  `relativeTime`, `linkFromSyncState`, `lastLocalChangeOf`, `openCloudUrl`, PROVIDER_LABELS/CONSOLE.
- `src/hooks/cloudClient.test.ts` — 17 tests (redirect advice per build, scope copy, doc comparison,
  relative time, summary counters).
- `src/hooks/useCloudSync.ts` — `runProjectSync(project, deps, opts)` (snapshot → planSync →
  executeSync → applyCloudPatch + setCloudLink + setCloudStatus) **and** the `useCloudSync()` hook.
  This is the ONLY place a sync runs; the panel's "Sync now" calls the same function.
- `src/components/settings/CloudSyncPanel.tsx` — Settings → Cloud sync tab (replaces the placeholder).
- `src/components/settings/settingsTabs.ts` — `requestSettingsTab('cloud')` deep-link (CustomEvent).
- `src/components/cloud/CloudLinkSetup.tsx` — create folder / link existing folder.
- `src/components/cloud/CloudLinkedView.tsx` — folder + last sync + Sync now + file list + unlink.
- `src/components/CloudStatusChip.tsx` — navbar chip bound to `cloudStatus`.
- `src/components/ExportMenu.tsx` — project-header dropdown, **dynamic** `await import('../services/export')`.
- `src/state/projectJsonRoundTrip.test.ts` — 5 tests: export JSON → `importProjectJson` → reducer.

### Files changed
- `src/components/CloudPanel.tsx` rewritten (3 honest states + "needs reconnecting" banner).
- `src/components/settings/SettingsModal.tsx` — Cloud tab now `CloudSyncPanel`, listens for tab requests.
- `src/components/Navbar.tsx` — Drive button → `CloudStatusChip` (removed the dead `HardDrive` import).
- `src/components/ProjectHeader.tsx` — `<ExportMenu project={activeProject} />` next to the Cloud button.
- `src/App.tsx` — `useCloudSync()` mounted once in `AppContent`.

### Verified
`npx tsc --noEmit` clean · `npx vitest run` 346 passed / 32 files (was 324/30) ·
`npx vite build` clean, `dist/assets/index-*.js` **652.49 kB** (gzip 177.79) and a separate
`dist/assets/export-*.js` **956.68 kB** (gzip 267.11) that holds ExcelJS + jszip — verified by
grepping the chunks for `ExcelJS`/`jszip` markers (main chunk: none).
`grep -rn "bg-\[#" src/components` empty; no accent-as-text violations in the new files.

### Behaviour notes for whoever picks this up
- Nothing is shown as connected until `provider.getAccount()` actually returns; a failure anywhere in
  Connect clears the tokens and the account again.
- Background sync: mount + `focus` + `online` + 60 s, 5 min after 2 consecutive failures, single-flight,
  paused when `navigator.onLine === false`. Only the first failure of a streak raises a notification.
- The facade exposes **no `documentDirty` flag**, so `runProjectSync` instead filters
  `download-doc` / `conflict` / `delete-local-doc` actions for the document open in the Markdown tab
  and reports them as "deferred". Adding a real dirty flag to the facade would let this be exact.
- `parseProjectJson` does not carry `cloud` through, so a JSON export cannot point another machine at
  your folder. The round-trip test asserts that.

### Not done / next
- `ApiSettingsModal.tsx`, `InteractiveTourGuide.tsx`, raw ISO timestamps and the remaining `MOCK_USERS`
  imports are still open from the earlier handoff.
- `useCloudSync` has no test (it needs a DOM/timers harness; vitest runs in `node` and only picks up
  `*.test.ts`, not `.tsx`). `runProjectSync` is testable as-is if someone wants to add one.

### Orchestrator lesson (00:15)
Never `git add -A` while an agent is writing — it swept a half-written `src/hooks/cloudClient.ts` into a
docs commit (f5a912d). Commit docs with explicit paths while any agent is running.

## 2026-09-21 — Timeline rebuild + edit-task modal (DONE, not committed)

### Files added
Pure modules (all unit-tested, `src/**/*.test.ts` is what vitest collects):
- `src/components/timeline/scale.ts` — the real pixels-per-day scale. `ZOOM_PX_PER_DAY` (day 34 / week 13 /
  month 5), `daysBetween`, `shiftDay`, `xForDay`, `dayAtX`, `barGeometry` (inclusive, 1 day = 1×pxPerDay),
  `rangeWidth`, `deltaDaysFromPx` (symmetric snap — `Math.round` alone gives `-0` at exactly half a day),
  `moveInterval`, `resizeInterval` (clamped to ≥1 day), `axisTicks`, `formatDay`/`formatDayRange`,
  `resolveLocale()` = browser locale with `FALLBACK_LOCALE = 'en-GB'`.
- `src/components/timeline/layout.ts` — `packLanes` (greedy first-fit; a shared boundary day counts as an
  overlap), `buildRowLayout` (absolute `top`/`height` per row; the frozen label column and the grid read the
  same layout, which is what lets the arrows share the bars' coordinate space), `rowCenterY`,
  `stackMilestoneFlags` (stagger over N levels, then collapse into the previous chip's `+N`).
- `src/components/timeline/dependencies.ts` — `dependencyLinks` (dedupes, drops unknown/self, flags a
  violation when `predecessor.dueDate > successor.startDate`), `wouldCreateCycle`, `dependencyCandidates`.
- `src/components/editTask/draft.ts` — `TaskDraft`, `toDraft`, `validateDraft`, `applyDraft`, `moveChecklistItem`.
- Tests: `scale.test.ts` (19), `layout.test.ts` (17, incl. a regression test that the sample project's
  overlapping media tasks really need >1 lane), `dependencies.test.ts` (14), `editTask/draft.test.ts` (14).

React layer:
- `src/components/timeline/useTimelineScale.ts` — one memo: `buildGanttModel` + `computeCriticalPath` +
  filters + lane packing + row layout + visible dependency links + milestone flag placement.
- `src/components/timeline/useBarDrag.ts` — pointer (not mouse) drag/resize, 4 px threshold so a click stays
  a click, whole-day snapping, Escape cancels without committing, `consumeClick()` guard.
- `GanttChart.tsx`, `GanttRow.tsx` (PhaseBar / TaskBar / RowLabel), `TimelineToolbar.tsx`,
  `TargetDateControl.tsx`, `MilestoneRunway.tsx`, `WorkloadCurve.tsx`, `TaskInspector.tsx`,
  `TimelineNotices.tsx` (warning strip + empty state).
- `src/components/EditTaskModal.tsx` (287 lines) + `editTask/ChipEditor.tsx`, `editTask/ChecklistEditor.tsx`,
  `editTask/DependencyPicker.tsx`.
- `src/components/taskFields.ts` — the ONE status/priority list (`TASK_STATUSES` wraps `STATUS_LABELS` from
  `services/export/common`), status accents, `PHASE_PALETTE` for a newly created phase.

### Files changed
- `src/components/RetroplanningTimeline.tsx` 839 → 229 lines: view state + facade wiring only.
- `src/App.tsx` mounts `<EditTaskModal />`; `TaskBoard.tsx` (columns and both selects now come from
  `TASK_STATUSES`, so `blocked` finally has a column; title + row action open the editor; the unconfirmed
  table delete is gone — delete lives in the editor behind a confirm); `ImmediateActionView.tsx` (title
  opens the editor).

### Audit §2 defects fixed
Real zoom (px/day, horizontal scroll, frozen labels) · lanes (no hidden tasks) · dependency arrows with
violation styling + tooltip · critical path from `computeCriticalPath` (stored flag demoted to a manual
override, both explained in the legend) · drag/resize of tasks and phases (`updatePhaseDates` is wired at
last) · inspector reads the live task by id · `in-review` present everywhere · milestone flags staggered
with a `+N` overflow · one locale via `Intl` · "6d Buffer" / "Zero Critical Path Slacks" / the static
buffer bar replaced by `computeProjectHealth` · `buildGanttModel` warnings surfaced · empty state.

### Still open (deliberately out of scope)
- `ProjectHeader.tsx` still shows "Buffer Safety … (6d margin)" and "Zero Slack"; `HardwareMediaView.tsx`
  still has its hardcoded strings. They should read `computeProjectHealth` the same way.
- `CreateTaskModal.tsx` still invents a checklist/deliverables and reads `MOCK_USERS`; it is the obvious
  next file — it can now reuse `editTask/draft.ts` and `taskFields.ts`.
- `TaskBoard`/`ImmediateActionView` still resolve assignees through `MOCK_USERS`.
- No DOM test harness exists (vitest is `environment: 'node'` and collects `*.test.ts` only), so the drag
  gestures, keyboard nudge and the modal have no automated coverage — only the pure maths behind them.

### Verified
`npx tsc --noEmit` clean · `npx vitest run` **410 passed / 36 files** (was 346/32; +64) ·
`npx vite build` clean (index 699 kB, export chunk unchanged) ·
`grep -rn "bg-\[#" src/components` empty · `grep -rn "MOCK_USERS" src/components/timeline
src/components/EditTaskModal.tsx src/components/editTask` empty · every new file < 310 lines.
Not committed, as instructed.

## 2026-09-21 02:30 — In-app interactive tutorial (one system, sandboxed)

Replaced the two half-surfaces (`TutorialDrawer.tsx` docked panel, `InteractiveTourGuide.tsx`
floating dock — audit rows 63/64) with a single coachmark engine under `src/components/tutorial/`,
and rebuilt the tutorial store slice around a **sandbox** so audit row 65 ("Watch Live Demo" wrote a
demo task and flipped the real delivery date) can never happen again.

### Added
- `src/state/tutorial.ts` — `TutorialState`, `DEFAULT_TUTORIAL`, `reconcileTutorial(persisted, projects)`,
  `buildSandboxProject({workspaceId, at})` (deep copy of `MEDIA_INSTALLATION_PROJECT`: fresh
  `tutorial-…` id, `isTutorialTemplate`, no history/comments/cloud link). All pure.
- `src/components/tutorial/steps.ts` — 8 steps as data (`id, title, body, tab, anchor, placement,
  task, isComplete(ctx), optional?`) + `snapshotProject()` and the `TutorialSnapshot`/`TutorialFlags`
  types the predicates compare. No React, fully unit-tested.
- `placement.ts` (`computePlacement` flip/clamp/centre + `spotlightPanels`), `useAnchor.ts`
  (selector → live rect, first *rendered* match, rAF on scroll/resize + MutationObserver + 500 ms
  net, `scrollAnchorIntoView`), `Coachmark.tsx`, `TutorialController.tsx`, `TutorialBanner.tsx`
  (banner + first-run invite), `ExitDialog.tsx`.
- Tests: `src/components/tutorial/steps.test.ts` (12), `placement.test.ts` (13),
  `src/state/tutorial.test.ts` (12, incl. the byte-identity proof).

### Changed
- `appReducer.ts`: `tutorialSteps: TutorialStep[]` → `tutorial: TutorialState`; new actions
  `tutorial/start|goto|complete|end|reset|dismissInvite`. `start`/`end` add and remove the sandbox
  project inside the reducer — NOT via `createProject`/`deleteProject` — so no undo snapshot and no
  notification are produced.
- `persistence.ts`: slice `tutorial` (array) → `tutorialState` (object, key `rps_v1_tutorialState`);
  legacy `retroplan_tutorial_steps_v4_media` is no longer migrated (ids belonged to the old steps);
  `clearAll()` also sweeps the orphaned `rps_v1_tutorial`. Two assertions in `persistence.test.ts`
  updated accordingly.
- `AppContext.tsx`: facade is now `tutorial`, `startTutorial(firstStepId)`, `goToTutorialStep`,
  `completeTutorialStep`, `endTutorial({removeSandbox, completed})`, `resetTutorial`,
  `dismissTutorialInvite`. `isTutorialDrawerOpen` is gone.
- `types/index.ts` and `data/mockData.ts`: `TutorialStep` + `TUTORIAL_STEPS` deleted.
- Anchors added (attributes only): `data-tour="gantt"` (GanttChart), `task-dependencies`
  (editTask/DependencyPicker), `new-task` (ProjectHeader + TaskBoard), `new-document`
  (MarkdownStudio), `ai-settings` (Navbar desktop + mobile). Existing ids reused for the rest
  (`#retroplanning-target-date-input`, `#header-drive-folder-btn`, `#header-export-btn`).
- Entry points: Navbar menu item (desktop user menu + mobile drawer), Settings → About → “Restart
  the tutorial”, and the first-run invite. `ProjectHeader`’s “Feature Tour” button was removed, so
  there is exactly one way in per surface.
- `docs/dev/STATE-API.md` (tutorial + sandbox + persistence key), `docs/dev/THEME.md` (Modal users).

### Deleted
`src/components/InteractiveTourGuide.tsx`, `src/components/TutorialDrawer.tsx`.

### Verified
`npx tsc --noEmit` clean · `npx vitest run` **450 passed / 39 files** (was 413/36; +37) ·
`npx vite build` clean · `grep -rn "InteractiveTourGuide\|TutorialDrawer\|tutorialSteps" src` empty ·
`grep -rn "bg-\[#" src/components` empty · every new file < 210 lines. Not committed, as instructed.

### Known gaps / next steps
- **No DOM harness** (vitest is `environment: 'node'`, `*.test.ts` only), so the coachmark, the
  anchor tracking and the controller's auto-advance have no automated coverage — only the pure
  maths and the pure predicates. The first manual pass in a browser should check: step 1 does not
  self-complete on open (fixed by making the per-step baseline *state*, not a ref), the spotlight
  hole lands on the right element at each step, and Escape → remove sandbox → back on the previous
  project.
- The spotlight dim panels are `pointer-events-none`, i.e. the whole app stays clickable, not only
  the target. Deliberate (never trap the user), but it is not a strict modal spotlight.
- The mobile drawer is `z-[100]`, above the coachmark (`z-[62]`); the tutorial is a desktop-first
  experience for now.
- `docs/audit/FEATURE-AUDIT.md` rows 63-65 and 73-74 still describe the old surfaces; they are now
  historical.
