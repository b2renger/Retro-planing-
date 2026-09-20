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
