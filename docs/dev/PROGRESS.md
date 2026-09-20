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
