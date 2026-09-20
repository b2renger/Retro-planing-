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
