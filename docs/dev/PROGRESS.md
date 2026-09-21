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

## 2026-09-21 — Capability gating + the polish backlog (DONE, not committed)

Two jobs: make the web build honest about what it cannot do, and clear the backlog the previous
three handoffs left behind.

### Part 1 — `src/capabilities.ts`
One module, the only place `window.desktop` is read (`desktopBridge()`), the only place a build
capability is decided. `capabilities()` (memoised) → `{ hasDesktop, canDiscoverFarms, canUseLanFarms,
canOauthLoopback, canOpenExternal, canSaveNatively, secretsBackend: 'keychain' | 'localStorage',
secretsPersisted, keyStorageNote, platformLabel, buildLabel }`. `computeCapabilities(env)` is the
pure function behind it; `src/capabilities.test.ts` (16 tests) covers **all four**
`canUseLanFarms({hasDesktop, protocol})` combinations plus the bridge-feature and secrets cases.

`canUseLanFarms` is false **only** for a browser on an `https:` page: a secure page may not call
`http://192.168.1.20:4000`, the browser blocks it before it leaves. Desktop → true (main process
makes the call); browser on `http:` (local dev) → true.

Wired:
- `settings/LanFarmNotice.tsx` (new) — the explanation + link to the README's desktop-app section
  (`DESKTOP_DOWNLOAD_URL`). Rendered by `AiProvidersPanel` in place of the LlmOnLan card in the
  provider picker, and by `FarmDiscovery` in place of the whole farm form, when `!canUseLanFarms`.
  The "Find a LlmOnLan farm" shortcut buttons are not rendered then either.
- `FarmDiscovery` scan button → `canDiscoverFarms` (was its own `window.desktop?.discoverFarms` probe).
- `AboutPanel` build line → `caps.buildLabel`.
- Key-storage copy → `caps.keyStorageNote` in `AiProvidersPanel` + `ProviderForm`;
  `CloudSyncPanel` clear-text warning → `caps.secretsBackend === 'localStorage'`.
  `secretsStorageNote` is gone from `settings/helpers.ts` (its two tests moved to capabilities).
- `hooks/cloudClient.ts`: `isDesktopRuntime()` → `capabilities().canOauthLoopback`; `openCloudUrl`
  → `desktopBridge()`.
- The facade still exposes its own three-valued `secretsBackend` (`'secure-store' | 'local-storage'
  | 'none'`); **no component reads it any more**. Left in place rather than churn the facade.

### Part 2 — the backlog
1. **`MOCK_USERS` out of every component.** New pure `src/components/assignee.ts`
   (`resolveAssignee`, `shortAssigneeName`, `UNASSIGNED`) + 7 tests. An unknown `assigneeId` now
   renders **Unassigned** (italic, no avatar, a person icon instead), never the first mock user —
   that fallback made a removed member's tasks look like someone else's. Used by `TaskBoard` and
   `ImmediateActionView`. `HistoryAuditView`'s collaborator filter is built from `teamMembers` plus
   any actor in this project's history who is no longer a member (labelled "(removed)"), so their
   entries stay reachable.
2. **One task form.** `CreateTaskModal.tsx` and `EditTaskModal.tsx` are **deleted**; `TaskModal.tsx`
   serves both modes (create bound to `isCreateTaskModalOpen`, edit to `editingTaskId`; edit wins if
   both are set) over the shared `editTask/TaskFormFields.tsx`. One validation path (`validateDraft`).
   `editTask/draft.ts` gained `firstPhaseId`, `emptyDraft(project)` and `draftToNewTask(draft,
   projectId)` (+11 tests). Defaults are **empty** — no dates, hours, deliverables, checklist, tags
   or assignee — and the phase is the active project's first by `order`, recomputed on every open
   (the draft is re-seeded on a `seed` key that goes through `null` when the dialog closes), which is
   audit row 26. In create mode field errors appear after the first submit attempt, not on a blank form.
3. **No hardcoded scheduling claims.** `ProjectHeader`'s metric strip is entirely
   `computeProjectHealth`: target date + days remaining, slack/overrun + overdue, flagged-critical
   count, tasks done. `calculateDaysRemaining` (with its `catch { return 60 }`) is gone, as is
   "% Safe" in permanent green. With no valid target date the strip says "No target date set" /
   "Needs a target date" instead of showing a 0. Same in `HardwareMediaView`.
4. **Hardware & Media is editable (option a).** `updateProject({hardwareItems, mediaAssets})` already
   works, so the view now adds/edits/removes both lists through the facade: `hardware/manifest.ts`
   (pure: summaries, `upsertById`, `removeById`, validation — 12 tests), `hardware/HardwareEditor.tsx`
   and `hardware/MediaEditor.tsx` (shared `Modal`), `hardware/HardwareList.tsx`,
   `hardware/MediaList.tsx`, `hardware/listChrome.tsx`. Every number is counted from the two lists;
   "100% Booked & Confirmed", "Dual 20K Projection • 8.1 Spatial Dante", "12 To-Do Checkpoints" and
   "6 Days Safety Margin" are gone. **The Booking / Testing / Review tabs are deleted**: they matched
   tasks with `phaseId.includes('booking')` and were empty for every project created in the app
   (audit row 35). Tasks live on the board and the timeline; nothing reachable was lost.
5. **One navigation model.**
   - View tabs: `ProjectHeader` (unchanged, active tab was `text-white` on `bg-elevated` — fixed to `text-fg`).
   - Project-scoped action row in `ProjectHeader`: cloud folder (`CloudStatusChip`, which now takes an
     `id` prop and carries `#header-drive-folder-btn` — status *and* the way in, in one control),
     export, AI assistant (moved from the navbar), New task.
   - App-scoped: ONE navbar menu (`navbar/AppMenu.tsx`) — account + persona, notifications (the
     `NotificationCenter` opens from the same trigger), settings, tutorial, invite, theme, and
     workspaces below `md` where the bar has no switcher. `Navbar.tsx` is now 140 lines.
   - Deleted: the navbar's standalone Invite button, its AI-provider chip, its bell, its persona menu,
     its theme strip and the whole mobile drawer (which duplicated four view tabs); `ProjectHeader`'s
     Invite block and its "Crunch Notes" button (a second path to the Markdown tab).
   - `TeamCollaborationView`'s "Invite New Collaborator" stays: it is that view's own primary action,
     not chrome, so no action is now offered twice in the chrome on one screen.
   - `navbar/useDismiss.ts` (new) closes the app menu, the workspace dropdown and the project picker
     on Escape or an outside pointer press — audit P1 said none of them did.
   - Tutorial anchors preserved: `#header-drive-folder-btn`, `#header-export-btn`, `data-tour="new-task"`.
     `data-tour="ai-settings"` moved to the **menu trigger** — a coachmark can only point at something
     on screen, and the Settings item sits behind a closed menu. `src/components/tutorial/**` untouched.
6. **Timestamps.** `relativeTime` moved out of `hooks/cloudClient.ts` into `src/utils/time.ts`, which
   also has `absoluteTime` and `timestampLabel(iso) => {text, title} | null` (13 tests).
   `NotificationCenter`, `TeamCollaborationView` (comments + invitations) and `HistoryAuditView` now
   render `<time dateTime={iso} title={absolute}>4 min ago</time>`; the four cloud call sites import
   from the new module. `HistoryAuditView`'s `en-US` `formatTimestamp` is gone.
7. **`noUnusedLocals` / `noUnusedParameters` are on in `tsconfig.json`** and the tree is clean. 43
   findings fixed: ~35 dead lucide imports across 6 components, dead facade reads
   (`toggleChecklistItem` in `TaskBoard`, `updateTeamMemberRole` in `TeamCollaborationView`,
   `currentUser` in `ImmediateActionView`), dead locals (`unresolvedQuestions`, `upcomingMilestone`,
   `phaseIdx` in `server.ts`) and two unused `req` params in `server.ts` (now `_req`).

### Docs
`docs/dev/STATE-API.md`: new "Build capabilities" section, `capabilities.ts` + `utils/time.ts` in the
files table, `editingTaskId` now points at `TaskModal`. `docs/dev/THEME.md`: Modal users list
(`TaskModal`, `hardware/*Editor`), theme control now lives in the navbar menu.
The facade itself did **not** change.

### Verified
`npx tsc --noEmit` clean (with the two new strictness flags) · `npx vitest run` **498 passed / 43
files** (was 450/39) · `npx vite build` clean (index 709 kB, export chunk separate) ·
`grep -rn "MOCK_USERS" src/components` empty · `grep -rn "window\.desktop" src/components src/hooks`
empty · `grep -rn "bg-\[#" src/components` empty. Not committed, as instructed.

### Known gaps / next steps
- Still **no DOM test harness** (vitest is `environment: 'node'`, `*.test.ts` only). Everything new is
  covered at the pure-function level; the first manual pass should check, in a browser:
  the navbar menu (open, Escape, outside click, notifications panel from inside it), create-task in a
  second project landing in that project's first phase, hardware add/edit/remove round-tripping
  through `updateProject`, and the LlmOnLan notice on an https build.
- `capabilities()` is memoised for the process lifetime. Tests use `computeCapabilities`;
  `resetCapabilities()` exists if a future DOM harness needs it.
- `AiAssistantModal` still renders a `toLocaleTimeString` chat stamp (already formatted, not ISO) —
  left alone.
- `CreateProjectModal` still writes `retroplanningScore: 94` on create; the reducer recomputes the
  score immediately after, so nothing fake reaches the screen, but the literal should go.
- `docs/audit/FEATURE-AUDIT.md` rows 4, 26, 34, 35, 36, 40 and the P0 "Duplicate, competing
  navigation" bullet are now historical.

## 2026-09-21 — First visual pass: the app was looked at

`npm run build:web && node scripts/screenshots.mjs` now captures **38** PNGs (19 states × 2 themes)
into `.tmp/shots/` at 1440×900. Every fix below was found by opening those files, not by grep.

### Harness (`scripts/screenshots.mjs`)
- Dismisses the first-run tutorial invitation before the tab shots — it was covering the bottom-left
  corner of all fourteen of them.
- Asserts after each tab that `documentElement.scrollWidth === clientWidth`, so a page-level
  horizontal scrollbar is reported as a problem instead of being something you have to notice.
- Twelve new states, each from a freshly reloaded page: `retroplanning-days`,
  `retroplanning-months` (the axis has to be checked at all three zooms),
  `retroplanning-runway`, `retroplanning-workload`, `tasks-table`, `hardware-media`, `settings`
  (opens on the AI providers tab), `cloud`, `ai-assistant`, `task-editor`, `task-inspector`,
  `tutorial` (step 1 coachmark — last, because starting the tutorial writes a sandbox project).

### Fixed
1. **Axis labels collided** (`timeline/scale.ts`, `GanttChart.tsx`). At week zoom the range-start
   tick and the first Monday were 13 px apart and printed on top of each other ("Sep 13 14").
   `AxisTick` now carries `edge` and `showLabel`; `thinTickLabels` lets the regular cadence claim
   its space first and hands a label to the range-edge tick only if room is left. A tick always
   draws its grid line, labelled or not. `estimateTextWidth` is the shared estimator. 10 new tests
   including "no two visible labels overlap, at every zoom".
2. **Duplicate metric strip** (`timeline/TimelineToolbar.tsx`, `TargetDateControl.tsx`,
   `RetroplanningTimeline.tsx`). The toolbar repeated Target delivery / Slack / Deliverables from
   `ProjectHeader`, which is on screen on every tab. Both `HealthChip`s are gone, and the delivery
   anchor is now a compact "Target date" button that states the action instead of restating the
   date and countdown. `#retroplanning-target-date-input` (tutorial step 1) and the dialog are
   unchanged. `health` and `locale` dropped out of `TimelineToolbarProps` with them.
3. **Truncation** (`GanttChart.tsx`, `GanttRow.tsx`, `scale.ts`). Label column 224 → 300 px; phase
   rows and bars carry a `title`. `barLabelPlacement` puts a label outside a bar too narrow to show
   a readable run of it, and `outsideLabelWidth` caps that label at the gap to the next bar on the
   row (lanes are packed by start date, so that is the next id) — otherwise two 50 px bars printed
   their names over each other. 8 new tests.
4. **Gantt legend** sat inside the horizontally scrolling grid, so at day zoom it was as wide as the
   whole day range and its last three items were off screen. Moved below both columns.
5. **Phase chips were unreadable in light** (`taskFields.ts` `phaseChipStyle`, used by
   `ImmediateActionView` and `TaskBoard` ×2). A phase colour is data picked for a bar; emerald and
   amber as 9 px text on a white card are ~2:1. The chip now mixes the colour 60/40 toward
   `var(--s-fg)` with `color-mix`, which the browser resolves per theme — darker in light, lighter
   in dark — so no hex is duplicated per theme.
6. **Modal subtitles were cut mid-word** (`ui/Modal.tsx`): "…no AI provid…" in the assistant,
   "1. BOOKING & PROCUREMENT (VENUE, HARDW…" in the task inspector. `truncate` → `line-clamp-2`;
   the title keeps `truncate` and gained a `title` attribute.
7. **Workload cards**: phase name and hours touched when the name filled the row (`120h` welded to
   the name). Added the missing `gap-2`.
8. **Table board**: due dates wrapped mid-string ("2026-09-⏎24") and phase pills wrapped to two
   lines. Both `whitespace-nowrap`; the pill truncates at 180 px with a `title`.
9. **Kanban card titles** had no `min-w-0 flex-1`, so they wrapped inside whatever the priority
   badge left them rather than the column width.
10. **Hardware notes** were `text-fg-subtle` (~4:1 on the dark card) for real content — now
    `fg-muted`, and the truncated item name, vendor and note carry `title`.

### Verified
`npx tsc --noEmit` clean · `npx vitest run` **514 passed / 43 files** (was 498) · `npx vite build`
clean · `grep -rn "bg-\[#" src/components` empty · harness reports no console error, no failed
request and no page-level horizontal scroll in either theme. Not committed, as instructed.

### Seen and deliberately left
- A milestone chip on the last day of the range is centred on its date, so half of it hangs past the
  grid width; it is reachable by scrolling the chart, but a clamp would be better.
- `TeamCollaborationView`: the current user's row has no Switch/Revoke buttons, so its hours sit
  flush right while the other three rows' hours stop short of them. Aligning them needs either a
  reserved empty action slot or putting the actions before the figures; both are worse than the
  inconsistency.
- A bar under ~28 px with a neighbour right behind it now shows no label at all (only its tooltip).
  That is deliberate — the alternative was two names printed over each other.
- Kanban columns are narrow enough at 1440 px that a long title still wraps to five or six lines.
- `ProjectHeader` shows the raw ISO target date (`2026-11-20`); the toolbar used to show it
  formatted. Copy/format decision, not a defect.

## 2026-09-21 05:00 — Final gate status (orchestrator)
All three packages built from this tree and verified:
- `release/RetroPlaningStudio-0.1.0-mac-arm64.dmg` 121 MB, `-mac-x64.dmg` 128 MB, `-win-x64.exe` 107 MB
- `node scripts/verify-mac-signature.cjs` → OK, `Signature=adhoc`, valid on disk, satisfies its
  Designated Requirement. The artlux trap (fuses flipped after an afterPack signature) is avoided
  because electron-builder does the signing itself via `mac.identity: "-"`.
- Gate: 514 tests / 43 files, `tsc --noEmit` clean, `vite build` clean, screenshot harness reports no
  console errors, no failed requests, no page-level horizontal scroll in either theme.

### The screenshot harness is the most useful thing added late
`scripts/screenshots.mjs` — 38 states (7 views + 12 extra states incl. modals and the tutorial
coachmark) × 2 themes. It found 10 defects no grep could: colliding axis ticks, duplicated metric
strips, phase chips at ~2:1 contrast on white, bar labels welded together, the Gantt legend sized to
the whole scroll range. **Run it after any visual change and LOOK at the PNGs.**

### Still open, in rough priority order
1. Nothing has been run on Windows; the installer builds but has never been launched.
2. Markdown preview completeness — an agent is on it as of 04:55 (react-markdown, no innerHTML).
3. Invitations are local-only; permissions are stored but never enforced. Both are labelled in the UI.
4. No real-time collaboration; two people sync through the drive, not live.
5. The leaked Firebase key remains in git history at 949b750 and 397bcaf — rotate it in Google Cloud.
6. GitHub repo still named Retro-planing-; the owner must rename, then
   `git remote set-url origin https://github.com/b2renger/RetroPlaningStudio.git`.
7. Harness only covers 1440x900; hover/focus/animation and narrow windows unverified.

## 2026-09-21 05:40 — Markdown preview completed (react-markdown, still no HTML injection)

The hand-rolled line-by-line renderer in `MarkdownStudio` (headings 1-3, bullets, checkboxes, bold,
inline code, hex chips) is gone. `src/components/markdown/` now holds a real renderer:

- `MarkdownView.tsx` — react-markdown 10 + remark-gfm 4, mapped to theme tokens. Tables, fenced
  code, links, images, italics, ordered lists, blockquotes, rules and strikethrough all render; the
  app's own "SLA Milestone Table" and "Token Config JSON Block" snippets finally display.
- `urlSafety.ts` — scheme allowlist (http/https/mailto). Everything else, relative URLs included,
  renders as plain text. The scheme is read after stripping C0 controls, so `java<TAB>script:` and
  a leading-space `javascript:` are both caught.
- `rehypeHexChips.ts` — keeps the colour-swatch feature, as a rehype step on text nodes only; code
  and fences are skipped, so a hex in a JSON block stays source.
- `rehypeHardBreaks.ts` — opt-in (`breaks`), used only by the assistant bubble so the local
  fallback reply keeps its three lines. Documents follow markdown semantics.
- `LazyMarkdownView.tsx` — both call sites go through it.

**Why the library choice matters:** react-markdown builds React elements from an AST, so the "no
XSS surface" property the audit recorded still holds — there is no HTML-string injection anywhere in
`src`, and raw HTML passthrough is off (no rehype-raw), so `<script>` in a document shows up as
literal text. 23 tests cover it, including a `javascript:` link rendering as text and a remote image
not being fetched until clicked.

**Bundle:** the parser is ~48 kB gzip, above the 40 kB bar, so it is a dynamic `import()`:
main chunk 708.79 kB / 197.46 kB gzip before → 707.46 kB / 197.21 kB gzip after, with
`MarkdownView-*.js` 161.15 kB / 48.02 kB gzip loaded on demand.

**Also changed:** the assistant modal renders assistant replies through the same component (the
system prompt already says "markdown allowed"); the user's own bubble stays literal text.
`scripts/screenshots.mjs` gained a per-tab preparation hook — the markdown tab now clicks the app's
three Quick Insert buttons before its shot, because no sample document contains a code fence, plus a
full-width `markdown-preview` state. Both themes were looked at: chips, fence caption, table, quote,
link vs. refused link and the image placeholder all read correctly.

Not done: `MarkdownStudio.tsx` is still 512 lines (was 607) and could be split; the preview has no
heading anchors; a loaded remote image stays loaded for the session only.

## 2026-09-21 05:55 — DONE. Final state
32 commits, all pushed. Working tree clean. Gate: **537 tests / 44 files**, `tsc --noEmit` clean,
`vite build` clean, screenshot harness clean (38 states, no console errors, no page-level h-scroll).

Packages in `release/`, all rebuilt from the final tree, `verify-mac-signature` OK:
mac-arm64.dmg/zip 121 MB · mac-x64.dmg/zip 128 MB · win-x64.exe 107 MB · win-arm64.exe 101 MB · win.exe 207 MB.

Everything on b2renger's original list is done: rename, documentation, audit, theme, multi-provider AI
incl. Gemini, LlmOnLan LAN farms, Drive + OneDrive as source of truth, spreadsheet export, tests,
Electron builds for Windows/Apple Silicon/Intel, interactive tutorial, GitHub Pages workflow,
human test checklist.

### For whoever picks this up next
Read `docs/FEATURES.md` for what exists, `docs/HUMAN-TESTS.md` for what still needs a human, and the
"Still open" list in the 05:00 entry above. The single most useful habit: run
`npm run build:web && node scripts/screenshots.mjs` and LOOK at `.tmp/shots/`. Ten defects came out of
doing that once; none of them was findable by grep or by a unit test.

## 2026-09-21 06:40 — The builds did not open. Root cause and fix.
b2renger reported none of the builds worked. I had verified `codesign` and the signature gate and
called that done. **That was the mistake: I never launched a packaged app.** Signing is not running.

Diagnosis (all empirical, on macOS 26.6.2):
- Launched the packaged app under Playwright's Electron driver: it runs fine. URL resolves inside
  app.asar, title correct, `#root` renders ~70 KB of DOM, zero console errors. So the *code* is fine.
- Copied the app out of the dmg, applied the quarantine xattr a download gets, then:
  `spctl -a -vvv -t execute` → **rejected**. `codesign --verify --deep --strict` → valid.
  So: valid ad-hoc signature, no Apple Developer ID → Gatekeeper refuses.
- `xattr -dr com.apple.quarantine` → app launches and renders normally.

The README told users to right-click → Open. **Apple removed that bypass in macOS 15**, so the
instruction could never have worked on b2renger's machine. Fixed in README and HUMAN-TESTS, plus
`scripts/mac-first-run.sh`. Only notarization (paid Apple account) removes the step entirely.

Released v0.1.0 with the four installers attached and the workaround at the top of the notes:
https://github.com/b2renger/Retro-planing-/releases/tag/v0.1.0

### Lesson for next time
`npm run package:*` finishing green proves nothing about whether the app opens. Add a launch probe to
the gate: Playwright's `_electron.launch()` against the packaged binary, assert a window appears and
`#root` is non-empty. Windows still has NO such verification — those builds have never been run.

## 2026-09-21 09:55 — One-click cloud sign-in. The app owns the OAuth clients now.

### The problem
Connecting Drive or OneDrive required **each user** to open the Google Cloud or Azure console,
create an OAuth client, copy an id and register a redirect URI. The users are students and
designers. b2renger: "Just click a button, auth in browser and we are good to go."

### What changed
The app owns the OAuth clients. One registration is done once (see the new `docs/CLOUD-SETUP.md`),
the ids are baked into the build through Vite env vars, and every user afterwards clicks one
button. The per-user override survives, folded into an Advanced disclosure.

- **`src/services/cloud/appCredentials.ts`** — resolution order, first hit wins: a per-user
  override in settings → `VITE_GOOGLE_CLIENT_ID` / `VITE_GOOGLE_CLIENT_SECRET` / `VITE_MS_CLIENT_ID`
  → nothing, which reports `source: 'none'`. An empty-string env var counts as absent: Vite
  substitutes `""` for an undefined var in some setups, and treating that as configured would
  render a dead button. 13 tests cover all three branches. The module's header explains at length
  why shipping these values is correct and not a compromise — a browser client id is visible in the
  authorize URL, and Google documents an installed-app secret as not-a-secret. Do not "fix" it.
- **`CloudSyncPanel.tsx`** is now 65 lines and holds no fields. Per provider,
  `CloudProviderCard.tsx` shows one Connect button, one line of what connecting does, and the
  permissions in plain words (derived from `PROVIDER_OAUTH[id].scopes` so the list cannot drift
  from what is actually requested). `CloudAdvanced.tsx` holds the old client id / secret / redirect
  URI / scope table, collapsed — and opens by itself on a build with no credentials, which is the
  only state where fields appear by default.
- **`useCloudConnect.ts`** is the one sign-in path, shared by settings, the project cloud panel and
  the navbar chip. Four steps that must succeed together; any failure clears the tokens again, so
  a provider is never shown as connected when it is not.

### The weekly expiry, handled as a state rather than an error
The full `drive` scope is restricted, so the OAuth project stays in Testing and Google kills every
refresh token after seven days. `CloudError` gained a `code` field carrying the provider's machine
code (`invalid_grant`), `isExpiredSignIn()` in `services/cloud/types.ts` is the single predicate,
and `runProjectSync` maps it to a new `cloudStatus.state === 'expired'` — never `'error'`. The chip
turns amber and *becomes* the Reconnect button (one click runs the flow; the click is the user
gesture the web popup needs anyway); the cloud panel shows a calm band saying nothing was lost.
Tested at both levels: `tokenStore.test.ts` for the code surviving the refresh failure, and
`useCloudSync.test.ts` for the end-to-end mapping, including that a 500 still reports as an error.

### Verified
`npx tsc --noEmit` clean · `npx vitest run` 565 passing (was 537) · `npx vite build` clean with no
env set at all, which is the "unconfigured build still succeeds" case · theme guard greps empty ·
screenshots in both themes show one Connect button per provider and zero credential fields.

### What b2renger must still do, once
Follow `docs/CLOUD-SETUP.md`: two Google clients (Desktop app + Web application), one Entra
registration, then `.env` for the desktop builds and two repository secrets for Pages. Google's
Test users list (max 100) is what gates who can sign in at all.

### Note for next time
The screenshot harness's `cloud` shot now opens **Settings → Cloud sync**; the project panel moved
to `cloud-project`. A local `vite build` has no ids, so that shot shows the unconfigured state —
build with `VITE_GOOGLE_CLIENT_ID=… VITE_MS_CLIENT_ID=… npx vite build` to photograph the normal
one. I nearly signed off on the unconfigured screenshot as if it were the feature working.

---

## 2026-09-21 — "Dates found": tier 0 of local inference, built

`docs/dev/LOCAL-INFERENCE.md` argued that the cheapest tier covers most of the value and should be
built first regardless of whether a model ever follows. It is now built, for dates: the Markdown
Studio reads the commitments out of the user's own notes and offers to turn them into plan
structure. No model, no download, no API — `chrono-node` 2.10.1 (the only new dependency) plus
rules.

### What is there
`src/services/insight/` — `dates.ts` (`findDates`), `signals.ts` (the exported `SIGNALS`
vocabulary), `text.ts` (markdown regions and sentence extraction), `suggestions.ts`
(`suggestFromDocument`), `index.ts` (the `findDeadlines(doc) → { items, source }` boundary the
design note asks for). UI: `src/components/markdown/DatesPanel.tsx` + `datesPanelCopy.ts`, wired
into `MarkdownStudio` as a third grid column at `xl` that drops under the editor below it.

### The four things that were not obvious
1. **`chrono.en.casual` eats dates.** "Opening night on November 20, 2026" comes back as a single
   anchorless result starting at "night", with the date gone. Fix: any casual result with no
   certain date component is discarded and its span re-parsed with `strict`, which finds the real
   date inside it. This is the single highest-value rule in the file.
2. **Durations parse as dates.** "warm up for 20 minutes" and "for 4 hours" both resolve to today;
   the QA checklist document was full of them. A match naming only a sub-day unit, with no calendar
   word and no year, is thrown away.
3. **Picking one locale loses half a mixed document.** These users write French briefs with English
   hardware dates. Both parsers run; the one with more hits wins the overlaps and the loser may
   contribute only dates it is certain of — unfiltered it read "SAM GLM" in a speaker spec as
   *samedi*.
4. **Nothing in the store made `addMilestone` undoable.** The undo policy snapshots before
   destructive actions only, and the brief requires an accepted suggestion to be reversible. Rather
   than change the policy for every caller, `pushUndoSnapshot(label)` is now on the facade
   (documented in STATE-API.md) and the panel calls it immediately before each accepted action.

### Honesty, which is the whole point of the feature
Every finding shows the sentence it came from with the matched words marked. Confidence is words,
never a percentage. The panel says in its own header copy that this is pattern matching and not AI.
Code fences, inline code and frontmatter are skipped, but link targets, unanchored relative dates
and implausible years are **kept and flagged** rather than dropped — a silently missing finding is
exactly as opaque as a silently applied one.

### Sample data
The bundled brief was English-only, which made the panel a poor demo of a French-first feature and
a poor representation of its users. A "Calendrier de production" section was added to
`doc-brief` with montage, remise, filage, vernissage and démontage dates. Nothing asserts on that
document's prose, so no test moved.

### Verified
`npx tsc --noEmit` clean · `npx vitest run` 635 passing (was 565; 71 new in `src/services/insight`)
· `npx vite build` clean · `grep -rn "bg-\[#" src/components` empty · screenshots in both themes
show the panel with five real findings on the sample brief.

### Bundle
`chrono-node` imported as `chrono-node/fr` and `chrono-node/en` — **never the root entry**, which
pulls in all fourteen locales. Whole feature: +69.9 kB raw, **+21.8 kB gzip** in the main chunk
(199.23 → 221.06). Under the 60 kB gzip line, so it is a static import; if a future tier pushes it
over, split it the way `ExportMenu` splits `services/export`.

### Next, if anyone picks this up
Tier 0's other two halves are untouched: phase classification and risk scoring. `findDeadlines`
already answers in the `{ items, source }` shape they should share. The `SIGNALS` table is the
first place to look when a finding is wrong — it is data, and growing it needs no code change.
