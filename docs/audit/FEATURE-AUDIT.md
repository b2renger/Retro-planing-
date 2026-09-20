# RetroPlaningStudio — Feature Audit

Audit date: 2026-09-20. Tree audited: HEAD `dd705a2` (components/context/data/services unchanged since `949b750`).
Scope: every file in `src/components/*.tsx`, `src/data/mockData.ts`, plus `src/context/AppContext.tsx`, `src/services/*`, `server.ts`, `index.html`, `src/index.css` for cross-checks. All paths relative to repo root.

Status legend: **REAL** works end-to-end on real data · **SIMULATED** UI pretends (fake tokens, canned results, hardcoded numbers) · **BROKEN** code path cannot work as intended · **DEAD** never rendered / never called.

---

## 1. Feature inventory

| # | Feature | Where | Status | Evidence |
|---|---|---|---|---|
| 1 | Project selector dropdown | `src/components/ProjectHeader.tsx:120-203` | REAL | `setActiveProjectId(p.id)` :167; lists all `projects` :163 (ignores workspace) |
| 2 | Create project | `src/components/CreateProjectModal.tsx:19-147` → `src/context/AppContext.tsx:641-670` | REAL | Project is created, but phases are hardcoded to Oct/Nov 2026 regardless of chosen date :36-65; `retroplanningScore: 94` :31; the modal's `id` is discarded and regenerated :643 |
| 3 | View tabs (7) + badges | `src/components/ProjectHeader.tsx:69-111, 360-390` | REAL | `setActiveViewTab(tab.id)` :369 |
| 4 | Header metrics strip | `src/components/ProjectHeader.tsx:290-358` | SIMULATED | "Buffer Safety … (6d margin)" :315-318 is a static `retroplanningScore` + hardcoded "6d"; "Zero Slack" :333 hardcoded |
| 5 | Change target delivery date | `src/components/RetroplanningTimeline.tsx:195-201` → `AppContext.tsx:688-704` | REAL (store only) | Only `targetDeliveryDate` is written :690; nothing else recomputed (see §2) |
| 6 | Backward scheduling engine | claimed at `AppContext.tsx:695,700`, `mockData.ts:69,75`, `CreateProjectModal.tsx:206` | SIMULATED | No function recomputes phase/task/milestone dates anywhere; the only "math" is `storageService.ts:281-286` on constants |
| 7 | Gantt chart (phases, task bars, milestone flags) | `RetroplanningTimeline.tsx:409-562` | REAL (read-only) | Positions from `getPositionPercentage` :75-84; all bars of a phase share one 56px row (`absolute top-2 bottom-2` :505) so overlapping tasks stack on top of each other |
| 8 | Zoom days/weeks/months | `RetroplanningTimeline.tsx:347-359` | SIMULATED | Only changes tick count (18/8/4) :101; scale/width never changes :410-411 |
| 9 | Critical path toggle/highlight | `RetroplanningTimeline.tsx:226-237, 499, 509` | SIMULATED | Highlights the boolean `task.isCriticalPath` set by mock data / checkbox; no CPM computed (see §2) |
| 10 | AI Retroplan Optimizer | `RetroplanningTimeline.tsx:135-160` | SIMULATED | Result only becomes a notification :144-149; on error posts a fake success "Calculated 6-day backward buffer" :151-156; `criticalPathTaskIds` never applied |
| 11 | Add milestone | `RetroplanningTimeline.tsx:162-176, 373-405` → `AppContext.tsx:799-811` | REAL | description and `deliverableCount: 4` hardcoded :170-171 |
| 12 | Toggle milestone complete | `RetroplanningTimeline.tsx:429, 583` → `AppContext.tsx:813-827` | REAL | |
| 13 | Timeline filters (phase/assignee) + reset | `RetroplanningTimeline.tsx:127-133, 305-342` | REAL | |
| 14 | Task inspector modal | `RetroplanningTimeline.tsx:725-823` | BROKEN | `selectedTask` is a stale copy (:504); checklist clicks :780 update the project but the modal's checkboxes never refresh; status `<select>` lacks `in-review` :808-810 so an in-review task displays "To Do" |
| 15 | Milestone runway + countdown | `RetroplanningTimeline.tsx:565-665` | REAL (read-only) | "Zero Critical Path Slacks" :657 and the buffer bar :643-649 are hardcoded/static |
| 16 | Workload curve (hours per phase) | `RetroplanningTimeline.tsx:668-722` | REAL | |
| 17 | Triage list + filters | `src/components/ImmediateActionView.tsx:44-82, 200-394` | REAL | "all" comparator :76-80 is non-transitive → unstable order |
| 18 | Quick done toggle | `ImmediateActionView.tsx:273-285` | REAL | |
| 19 | Checklist toggle (inline) | `ImmediateActionView.tsx:339-353` | REAL | `<label onClick>` around a `readOnly` checkbox fires twice per click; works only because both calls compute the same stale patch |
| 20 | Scope clarification resolve | `ImmediateActionView.tsx:461-469` → `AppContext.tsx:1014-1032` | REAL | Questions are static mock data (`mockData.ts:956-973`), only replaced by crunch |
| 21 | Gemini Schedule Audit | `ImmediateActionView.tsx:86-117` | SIMULATED | Report mixes API output with hardcoded lines about a task ("Checkout Flow Wireframes") that does not exist :105,112; `suggestDependencies` itself returns canned suggestions on error `geminiService.ts:132-143` |
| 22 | Milestone sequence card | `ImmediateActionView.tsx:502-524` | REAL | |
| 23 | Kanban board (status via `<select>`) | `src/components/TaskBoard.tsx:120-238` | REAL | No drag-and-drop exists (no `draggable`/`onDragStart`), although tutorial promises "drag tasks across workflow columns" `mockData.ts:124` |
| 24 | Table view + delete task | `TaskBoard.tsx:241-315` | REAL | Delete :303 has no confirmation; delete is unavailable in Kanban view |
| 25 | Task search + phase filter | `TaskBoard.tsx:40-47` | REAL | |
| 26 | Create task modal | `src/components/CreateTaskModal.tsx` → `AppContext.tsx:707-730` | BROKEN | Component stays mounted (`App.tsx:49`) so `phaseId` state :17 is initialised once from the first project; after switching project the task is created with a foreign `phaseId` (:37 uses the stale truthy value) and never appears in any lane. `status` state :20 has no UI. Dates/deliverables/checklist are invented defaults :21-24, 49-52. Assignee list is `MOCK_USERS` :123, not `teamMembers` |
| 27 | Document list / create / delete / select | `src/components/MarkdownStudio.tsx:357-401` → `AppContext.tsx:846-884` | REAL | Delete :390-398 hidden until hover, no confirm |
| 28 | Markdown editor + Save | `MarkdownStudio.tsx:60-69, 468-550` | REAL | Unsaved edits are discarded when another doc is selected :52-58 (no dirty check); with 0 docs `handleSave` silently no-ops :61 |
| 29 | Markdown preview ("WYSIWYG") | `MarkdownStudio.tsx:160-253` | REAL (partial) | Supports H1-H3, checkboxes, bullets, `code`, **bold**, hex chips. No tables, fenced code, links, images, italics, ordered lists — the "SLA Milestone Table" and "JSON block" snippets :442,452 cannot be previewed |
| 30 | Drop / upload notes | `MarkdownStudio.tsx:115-152` → `AppContext.tsx:886-908` | REAL (files only) | "Drop Notes or Folders" :417 — `dataTransfer.files` does not recurse folders; no `accept`, no size cap |
| 31 | Crunch with Gemini | `MarkdownStudio.tsx:71-97` → `server.ts:91-208` | SIMULATED (default) | Without a key the server returns a hardcoded plan (`server.ts:322-488`, dates Sept–Oct 2026, `retroplanningScore: 94`) flagged `fallback:true`, which the UI never reads :80; custom key from settings is not passed :74-78 |
| 32 | Apply AI structure to project | `MarkdownStudio.tsx:99-113` → `AppContext.tsx:910-954` | REAL (destructive) | Replaces phases/milestones/tasks/questions :933-939 with no confirm and no revert path |
| 33 | Quick-insert snippets | `MarkdownStudio.tsx:429-459` | REAL | |
| 34 | Hardware manifest & media roster | `src/components/HardwareMediaView.tsx:280-381` | SIMULATED | Read-only render of `mockData.ts:188-347`; no add/edit/status handlers; "100% Booked & Confirmed" :171, "12 To-Do Checkpoints" :194,426, "6 Days Safety Margin" :210, phase windows :389,424,467 and "Status: Completed" :391 are hardcoded strings |
| 35 | Booking/Testing/Review tabs | `HardwareMediaView.tsx:44-47, 383-492` | BROKEN (non-mock projects) | Tasks matched by `phaseId.includes('booking')` etc.; any project created in-app has ids `p-<ts>-1` → always empty, no empty state |
| 36 | History list + filters | `src/components/HistoryAuditView.tsx:22-26, 110-135` | REAL | User filter lists `MOCK_USERS` :129, not `teamMembers` |
| 37 | Revert state | `HistoryAuditView.tsx:186-193` → `AppContext.tsx:996-1012` | BROKEN | Silent no-op unless `entry.diff` exists :997 (only status changes and target-date shifts have one); task lookup is by title :1000; button is shown on every row |
| 38 | Team workload cards | `src/components/TeamCollaborationView.tsx:41-51, 128-215` | REAL | "Live Storage Active" ping :100-106 decorative; presence dot :144-148 derives from static `user.status` |
| 39 | Switch persona | `TeamCollaborationView.tsx:172`, `Navbar.tsx:296-315`, `InviteCollaboratorsModal.tsx:460-471` | REAL | Not persisted; resets to `MOCK_USERS[0]` on reload `AppContext.tsx:157` |
| 40 | Remove member | `TeamCollaborationView.tsx:180-184` → `AppContext.tsx:532-539` | REAL (partial) | Only `teamMembers` updated; `workspaces[].members` and task `assigneeId` keep the ghost; `ImmediateActionView`/`TaskBoard` fall back to `MOCK_USERS[0]` :120/:50 |
| 41 | Comments feed + post | `TeamCollaborationView.tsx:53-65, 286-328` → `AppContext.tsx:956-979` | REAL | Every post creates two notifications (:58 and `AppContext.tsx:973`) in the same tick → same `notif-<ms>` id |
| 42 | Invite by email | `src/components/InviteCollaboratorsModal.tsx:69-82` → `AppContext.tsx:465-530` | SIMULATED | No email sent; member appended to `teamMembers` immediately with `status: 'accepted'` :500 while also listed under "Pending" (`TeamCollaborationView.tsx:225`); `permissions` stored but never checked anywhere |
| 43 | Direct invite link | `InviteCollaboratorsModal.tsx:61, 321-395` | SIMULATED | Link `?invite_ws=…&token=…` — nothing reads `location.search`/`URLSearchParams` in the codebase |
| 44 | Pending invitations (copy/revoke) | `TeamCollaborationView.tsx:220-268`, `InviteCollaboratorsModal.tsx:497-545` | SIMULATED | Seeded "Sarah Lin" invitation `AppContext.tsx:200-218`; copy uses `alert()` :526 |
| 45 | Update member role | `InviteCollaboratorsModal.tsx:445-456` → `AppContext.tsx:541-550` | REAL | Fires a notification on every `<select>` change |
| 46 | Gemini assistant chat | `src/components/GeminiAssistantModal.tsx` → `server.ts:277-319` | SIMULATED (default) | Without key server returns canned text :284-289; on any network error the client returns canned text `geminiService.ts:172`, so the modal's error branch :68-76 is unreachable; custom key never passed :52-58 |
| 47 | Google login | `src/components/GoogleLoginModal.tsx:20-26` → `AppContext.tsx:376-396` | SIMULATED | 600 ms `setTimeout`, token `ya29.${Date.now()}_client_oauth_token` :382; app boots already "Connected" with a fake token `mockData.ts:42-54`; "OAuth2 Verified" :125 |
| 48 | Drive folder browser / preview | `src/components/GoogleDriveModal.tsx:243-365` | REAL (in-memory) | Structure generated client-side `googleDriveService.ts:27-173`; sizes "4.2 KB"/"3.8 KB" hardcoded :143,151 |
| 49 | Sync project to Drive | `GoogleDriveModal.tsx:69-104` → `googleDriveService.ts:176-261` | SIMULATED | Real REST call with fake token → error swallowed :248-250 → "success" fallback :253-260; UI then sets `driveSynced: true` :76-83 and shows "Synchronized N files" |
| 50 | "Open in Drive" link | `GoogleDriveModal.tsx:213-222` | SIMULATED | URL built from `drive-folder-<projectId>` `googleDriveService.ts:30-31` |
| 51 | Download file / Export JSON | `GoogleDriveModal.tsx:119-138`, `googleDriveService.ts:264-281` | REAL | |
| 52 | Import Drive file to notes | `GoogleDriveModal.tsx:106-117` | REAL | Re-imports the project's own documents as duplicates |
| 53 | API settings: source/model/save | `src/components/ApiSettingsModal.tsx:22-33` → `AppContext.tsx:413-435` | BROKEN | `handleSave` calls `updateApiSettings` then `testCurrentApiKey`, which reads `apiSettings` from the *previous* render :419-420 → tests the old key/model. Default status is `'connected'` before any test `mockData.ts:60-62` |
| 54 | Ping test | `ApiSettingsModal.tsx:35-46` → `geminiService.ts:33-57` → `server.ts:52-88` | REAL (same stale-read caveat) | |
| 55 | Notification center | `src/components/NotificationCenter.tsx` | REAL (local) | Title "Real-Time" :26; timestamps are the literal `'Just now'` forever `AppContext.tsx:369`; no per-item dismiss |
| 56 | Theme toggle | `Navbar.tsx:229-241` → `AppContext.tsx:160-182` | REAL | Toggles `.dark` on `<html>`; light theme unreadable in most components (§4) |
| 57 | Workspace switcher | `Navbar.tsx:88-140` | SIMULATED | One workspace `mockData.ts:1012-1022`; changing it filters nothing (`ProjectHeader.tsx:163` lists all projects) |
| 58 | Mobile menu | `Navbar.tsx:333-516` | REAL | Dark-only styling |
| 59 | Database tester ("8 live tests") | `src/components/DatabaseTesterModal.tsx` → `src/services/storageService.ts:132-414` | SIMULATED | Tests 5-7 assert arithmetic on inline constants :274-373; tests 4 & 8 read/write key `retroplan_projects_v3` :24, which the app does not use (`AppContext.tsx:147` uses `…_v4_media`) |
| 60 | "Test Live Write" | `DatabaseTesterModal.tsx:50-59` | BROKEN | Writes `projects` to the orphan `v3` key, reports "zero data loss"; `testTaskTitle` unused |
| 61 | Download JSON backup | `DatabaseTesterModal.tsx:61-70` | REAL | No restore/import path anywhere |
| 62 | Implementation plan matrix | `src/components/ImplementationPlanModal.tsx` | SIMULATED | 13 items all hardcoded `status: 'verified'` :48-179; header says "12/12 Goals Verified (100%)" :211 and "All Requirements (12)" :238; badge "Gemini 2.5" :97 |
| 63 | Tutorial drawer | `src/components/TutorialDrawer.tsx` | REAL | Steps navigate + mark complete :35-38; only reachable via mobile menu (`Navbar.tsx:458-470`) or the Implementation Plan modal :282-291 |
| 64 | Interactive tour guide (floating dock) | `src/components/InteractiveTourGuide.tsx` | REAL (walkthrough) | Forces tab switch per step :50-56 |
| 65 | "Watch Live Demo" | `AppContext.tsx:562-638` | SIMULATED | Mostly posts notifications; `tut-1` really flips the target date :570-579 and `tut-3` inserts a demo task into the user's project :587-615 (pollutes real data) |
| 66 | Persist state to localStorage | `AppContext.tsx:307-346, 185-289` | REAL | Write failures ignored (§5) |
| 67 | Notification click navigation | `NotificationCenter.tsx:80-87` | REAL | Mapping arbitrary: any `ai_insight` (e.g. "Tutorial Started") opens Markdown tab |
| 68 | `InteractiveTutorialModal` | `src/components/InteractiveTutorialModal.tsx` | DEAD | Not imported anywhere (only `InteractiveTourGuide` is, `App.tsx:22,55`) |
| 69 | `deleteProject` | `AppContext.tsx:678-686` | DEAD | Exposed :1124, no caller |
| 70 | `updatePhaseDates` | `AppContext.tsx:785-797` | DEAD | Destructured in `RetroplanningTimeline.tsx:36`, never invoked → no phase drag/resize |
| 71 | `exportProjectAsMarkdown` | `AppContext.tsx:1034-1065` | DEAD | No caller; tutorial promises "markdown and PDF export" `mockData.ts:148` |
| 72 | Backup snapshot + `getItem` recovery | `storageService.ts:45-58, 69-97` | DEAD | Snapshot only written when `key === 'retroplan_projects_v3'` :46; AppContext never calls `getItem` (:237 uses raw `localStorage`) |
| 73 | `targetElementId`, `demoActionKey` | `mockData.ts:72,76,…` | DEAD | Never read; `header-db-tests-btn` (:174) does not exist in any component |
| 74 | `isTutorialActive` | `AppContext.tsx:291, 1102` | DEAD | Never read |
| 75 | `Task.dependencies` | `src/types/index.ts:64` | DEAD | Never rendered or edited; only ever set to `[]` (`CreateTaskModal.tsx:44`) |
| 76 | `TaskStatus 'blocked'` | `types/index.ts:42` | DEAD | No column/option anywhere |
| 77 | CSS tokens `--bg-card` etc. | `src/index.css:5-24` | DEAD | No component references `var(--…)` |
| 78 | `httpClient.ts` | `src/services/http/httpClient.ts` | DEAD (new, unwired) | Nothing imports it yet; all AI calls still use raw `fetch('/api/…')` `geminiService.ts:43,72,102,158` |

**Totals: REAL 42 · SIMULATED 19 · BROKEN 6 · DEAD 11** (78 rows).

Reachability of `App.tsx` imports: all 21 imported components render (`App.tsx:30-60`). The only component file never imported is `InteractiveTutorialModal.tsx`.

---

## 2. Timeline / retroplanning engine

**Does changing `targetDeliveryDate` recompute anything?** No.
`updateTargetDeliveryDate` (`AppContext.tsx:688-704`) does exactly three things: `updateProject({ targetDeliveryDate })` :690, a history entry whose text says "Recalculating retroplanning buffers" :695, and a notification saying "Backwards schedule refreshed" :700. Phases, tasks, milestones and `retroplanningScore` are untouched. The only visible effect is that `timelineEnd` (`RetroplanningTimeline.tsx:58-72`) moves, so the axis stretches while every bar keeps its absolute dates. A project can have a target date before its last phase ends with no warning.

**Where do dates come from?** Entirely from data: mock (`mockData.ts:370-411, 450-731`), the hardcoded phase set in `CreateProjectModal.tsx:34-65`, the server's canned plan (`server.ts:418-446`) or Gemini's JSON. `bufferDays` is a stored number displayed as "(Nd backward buffer)" (`RetroplanningTimeline.tsx:472`); nothing consumes it. `retroplanningScore` is stored (94 in mock :357, 94 in new projects `CreateProjectModal.tsx:31`, `|| 92` after crunch `AppContext.tsx:938`) and displayed as "% Safe" in four places; it is never computed. The strings "6d Buffer"/"6 days safety margin" are literals (`RetroplanningTimeline.tsx:220,557`, `ProjectHeader.tsx:318`, `HardwareMediaView.tsx:210`, `ImmediateActionView.tsx:111`).

**Drag / resize:** none. No `draggable`, `onMouseDown`, `onPointerDown` in `RetroplanningTimeline.tsx` or `TaskBoard.tsx`. `updatePhaseDates` exists (`AppContext.tsx:785`) but has no caller. Task dates can only be set at creation (`CreateTaskModal.tsx:148-165`) — there is no edit-task UI at all.

**Dependencies:** `Task.dependencies` is populated in mock data (`mockData.ts:489,512,537,…`) and by the server prompt, but never rendered (no arrows, no list, no validation). Circular/backward dependencies are not detected.

**Critical path:** a boolean flag `isCriticalPath` on tasks and phases (`types/index.ts:69,80`). The toggle (`RetroplanningTimeline.tsx:226-237`) only switches the red styling of flagged bars :499-509; the header badge counts flagged tasks (`ProjectHeader.tsx:65`). No float/slack is computed. The "AI Retroplan Optimizer" receives `criticalPathTaskIds` from the server (`server.ts:492`, `geminiService.ts:130`) and discards them (`RetroplanningTimeline.tsx:138-149`).

**Rendering quality issues:** all tasks of a phase are absolutely positioned in one 56px track (`RetroplanningTimeline.tsx:482-532`), so overlapping tasks (e.g. the four `p2-media` tasks Oct 6-28) hide each other. Milestone flags at close dates overlap in a 44px bar with `overflow-hidden` :423. `getWidthPercentage` clamps to 3% minimum :92 so a 1-day task looks like 3-4 days on a 70-day scale. Zoom does not zoom (§1 row 8). The tick labels are `en-US` locale :105 while the UI says "Rétroplanning".

Verdict: the "backward scheduling engine" advertised throughout the copy, tutorial and Implementation Plan does not exist. The timeline is a static Gantt renderer of stored dates.

---

## 3. UX / UI critique (ranked)

### P0
- **Light theme is unreadable on always-visible surfaces.** `ProjectHeader.tsx` container is themed (:114) but every child uses dark-only tokens (`text-slate-100` :127, `bg-white/[0.03] border-white/10` :123,209, `text-slate-400` :132, metrics :290-358, tabs :372-376). Same for `RetroplanningTimeline.tsx` (0 `dark:` variants, 83 dark-only tokens), all 10 modals, and the right half of `Navbar.tsx` (:145-267). See §4.
- **Destructive actions without confirmation or undo:** delete task `TaskBoard.tsx:303`; delete document `MarkdownStudio.tsx:390-398`; "Apply Structure to Project" replaces all phases/tasks/milestones `MarkdownStudio.tsx:315-320` → `AppContext.tsx:933-939`; "Watch Live Demo" writes into the user's real project (`AppContext.tsx:573, 609`). Revert (`HistoryAuditView.tsx:186`) cannot undo any of these.
- **Fake status everywhere the user looks:** green "connected" dots before any check (`Navbar.tsx:197`, `ProjectHeader.tsx:267`, `mockData.ts:60-62`), "Synced" Drive badge on a fake token (`GoogleDriveModal.tsx:201`, `mockData.ts:362-367`), "Production Verified"/"zero data loss" (`DatabaseTesterModal.tsx:87,54`), "0% Data Loss" (`InviteCollaboratorsModal.tsx:552`), "12/12 Goals Verified" (`ImplementationPlanModal.tsx:211`), "Zero Critical Path Slacks" (`RetroplanningTimeline.tsx:657`), "100% Booked & Confirmed" (`HardwareMediaView.tsx:171`), "Your key is kept safe in browser session storage and proxied securely" (`ApiSettingsModal.tsx:124`) while the key is written to `localStorage` in clear (`AppContext.tsx:330-334`). A user cannot tell what is real.
- **Duplicate, competing navigation.** Navbar quick actions (Invite, Feature Tour, DB Tests, Audit Plan, API, Google, AI, theme, Drive, bell, avatar — `Navbar.tsx:143-328`) and ProjectHeader actions (Invite, Drive Folder, Feature Tour, DB Active, Crunch Notes, New Task — `ProjectHeader.tsx:206-287`) overlap; "Invite" appears 3 times on one screen (`Navbar.tsx:146`, `ProjectHeader.tsx:222`, `TeamCollaborationView.tsx:92`), "DB tests" 4 times (`Navbar.tsx:166,444`, `ProjectHeader.tsx:260`, `ImmediateActionView.tsx:153`). Two tutorial systems (drawer vs floating tour) plus an "Audit Plan" modal.

### P1
- **Notification spam:** almost every mutation posts one (`AppContext.tsx:664,698,723,524,534,545,554,902,948,973,1027,391,406,450,574-631`; `GoogleDriveModal.tsx:89,109,132`; `MarkdownStudio.tsx:81,88`; `RetroplanningTimeline.tsx:144,151`), including on every role `<select>` change and twice per comment (`TeamCollaborationView.tsx:58` + `AppContext.tsx:973`). Notifications never expire, timestamp is always "Just now" (`AppContext.tsx:369`), no per-item dismiss (`NotificationCenter.tsx`).
- **Accessibility:** zero `role="dialog"`, no focus trap, no `Escape` handling, no backdrop-click close in any modal (`grep onKeyDown` → 0 hits; only one `aria-label`, `Navbar.tsx:234`). Clickable `<div>`s with no keyboard path: milestones (`RetroplanningTimeline.tsx:427-433, 581-589`), task bars :502, inspector checklist :778, doc list (`MarkdownStudio.tsx:376-378`), notifications (`NotificationCenter.tsx:78-91`), tutorial cards (`TutorialDrawer.tsx:111-119`). Dropdowns don't close on outside click (`Navbar.tsx:102,286`, `ProjectHeader.tsx:157`). `index.html:5` sets `maximum-scale=1.0, user-scalable=no` (blocks zoom, WCAG 1.4.4). Native `alert()`/`window.confirm()` (`InviteCollaboratorsModal.tsx:477,526`, `TeamCollaborationView.tsx:181`).
- **Empty states missing:** timeline with no phases/tasks renders an empty card (`RetroplanningTimeline.tsx:457`); hardware view for any non-mock project shows "0 Items Listed / 100% Booked & Confirmed" (`HardwareMediaView.tsx:168-171`) and empty Booking/Testing/Review tabs :395,430,473; Markdown Studio with 0 docs stays editable but Save is a no-op (`MarkdownStudio.tsx:61`).
- **Data invented on the user's behalf:** new task gets two fake checklist items and "Figma Component, Token export" deliverables (`CreateTaskModal.tsx:24,49-52`); new milestone gets "Designer retroplanning milestone checkpoint" / 4 deliverables (`RetroplanningTimeline.tsx:170-171`); new project gets three Oct/Nov 2026 phases, a demo task, a clarification question (`CreateProjectModal.tsx:34-142`).
- **Hardware & Media tab is a brochure for one project** (`HardwareMediaView.tsx`) — read-only, hardcoded copy "Dual 20K Projection • 8.1 Spatial Dante" :131, phase windows :389,424,467. Either make it editable or drop the tab.
- **Mobile:** `TutorialDrawer` is fixed `w-96` (`TutorialDrawer.tsx:43`) — wider than small phones; `GeminiAssistantModal` fixed `h-[600px]` :84 with no `max-h`; comments pane fixed `h-[560px]` (`TeamCollaborationView.tsx:273`); Gantt forces `min-w-[800px]` :411 (acceptable, scrolls).
- **French/English mix:** "Rétroplanning" (`Navbar.tsx:80`, `ProjectHeader.tsx:72`, `RetroplanningTimeline.tsx:192,557`, `CreateProjectModal.tsx:196`, `AppContext.tsx:699`, `InviteCollaboratorsModal.tsx:235,255`) vs "Retroplan"/"retroplanning" everywhere else; "Vernissage" (`mockData.ts:442`); dates formatted `en-US` (`RetroplanningTimeline.tsx:105`, `HistoryAuditView.tsx:81`).
- **Emojis in UI strings** (38 hits): `RetroplanningTimeline.tsx:767`, `InteractiveTourGuide.tsx:242`, `MarkdownStudio.tsx:297`, `HardwareMediaView.tsx:391`, `InviteCollaboratorsModal.tsx:440`, `GoogleDriveModal.tsx:90`, `AppContext.tsx:451,525,575,582,591,611,621`, `mockData.ts:442,985,994,1003`, Drive folder name `googleDriveService.ts:29`.
- **Broken Tailwind classes:** `bg-slate-850` / `border-slate-750` / `hover:bg-slate-750` do not exist in the default palette → transparent chips and no borders (`GeminiAssistantModal.tsx:112,118,124,151,172`, `MarkdownStudio.tsx:283,366,435,445,455`). `xs:` breakpoint is not defined in `src/index.css` → "Crunch Notes" label never shows and "Notes" always shows (`ProjectHeader.tsx:275-276`); Navbar tagline is permanently hidden (`Navbar.tsx:79`).

### P2
- Inconsistent modal shells: three backdrop styles (`bg-slate-950/70 backdrop-blur-sm` `CreateTaskModal.tsx:61`; `bg-black/80 backdrop-blur-md` `ApiSettingsModal.tsx:49`; `bg-slate-950/80` `DatabaseTesterModal.tsx:75`), two card colours (`bg-[#0D121F]` vs `bg-slate-900` `GeminiAssistantModal.tsx:84`), `DatabaseTesterModal` takes props while all others read context (`App.tsx:57-60`).
- Status `<select>` options differ between views (`TaskBoard.tsx:224-227` has `in-review`; `RetroplanningTimeline.tsx:808-810` doesn't).
- PII in source: `berenger.recoules@gmail.com` (`mockData.ts:7,45`, `AppContext.tsx:376`, `GoogleLoginModal.tsx:14-15`); avatars fetched from unsplash (offline → broken images).
- Persona switcher lets anyone impersonate anyone (`Navbar.tsx:296-315`) — fine for a demo, misleading for a "team" product.
- Tutorial step 1 is pre-completed (`mockData.ts:74`), so progress starts at 14%.

---

## 4. Dark / light theme audit

Method: per file, counted (a) hardcoded dark hex backgrounds `bg/border/from/via/to-[#…]`, (b) dark-only tokens without a `dark:` prefix (`bg-[#…]`, `text-slate-100/200/300`, `border-white/N`, `bg-white/N`, `bg-black/N`), (c) `dark:` variants. `index.css:3` defines the class-based variant (`@variant dark (&:where(.dark, .dark *))` — Tailwind 4 documents this directive as `@custom-variant`; verify the build actually emits `.dark` selectors, otherwise the toggle is a no-op everywhere).

| Component | hex bg | dark-only tokens (no `dark:`) | `dark:` variants | Works in light? |
|---|---|---|---|---|
| ApiSettingsModal | 5 | 34 | 0 | no (dark-only) |
| CreateProjectModal | 1 | 15 | 0 | no |
| CreateTaskModal | 7 | 47 | 0 | no |
| DatabaseTesterModal | 1 | 24 | 0 | no |
| GeminiAssistantModal | 0 | 4 (+`bg-slate-900/950` fixed) | 0 | no (+ missing 750/850 shades) |
| GoogleDriveModal | 4 | 35 | 0 | no |
| GoogleLoginModal | 4 | 26 | 0 | no |
| HardwareMediaView | 9 (all under `dark:`) | 0 | 168 | yes |
| HistoryAuditView | 15 (all under `dark:`) | 1 | 39 | partial — action badges :32-73 (`text-purple-300`, `bg-slate-700 text-slate-300`) low contrast on white |
| ImmediateActionView | 11 (under `dark:`) | 0 | 141 | yes |
| ImplementationPlanModal | 3 | 21 | 0 | no |
| InteractiveTourGuide | 3 | 14 | 0 | no |
| InteractiveTutorialModal | 1 | 22 | 0 | no (dead file) |
| InviteCollaboratorsModal | 14 | 68 | 0 | no |
| MarkdownStudio | 0 | 1 | 96 | partial — inline `bg-slate-800` chips :231,239 and `<strong class="text-slate-100">` :246 invisible on light |
| Navbar | 14 | 59 | 41 | partial — brand/workspace/user menu themed; quick actions :145-183, right-side buttons :188-267, mobile drawer :333-516 dark-only |
| NotificationCenter | 0 | 3 | 22 | partial — item title/body `text-slate-100/300` :110,115 and footer `bg-slate-950/80` :127 |
| ProjectHeader | 3 | 19 | 3 | **no** — themed shell :114, unthemed content (worst offender, always visible) |
| RetroplanningTimeline | 14 | 83 | 0 | no (entire main tab) |
| TaskBoard | 16 (under `dark:`) | 0 | 79 | yes |
| TeamCollaborationView | 6 (under `dark:`) | 0 | 75 | yes |
| TutorialDrawer | 4 | 15 | 0 | no |

Also dark-only outside components: `index.html:2` `class="dark bg-[#070A10]"` on `<html>`, `index.html:14-15` body/root `bg-[#070A10] text-slate-100`, `theme-color #070A10` :12; `App.tsx:28` is themed correctly. Net: 4 of 7 views work in light; the header, the main timeline tab, the navbar's right half and every modal do not.

**Distinct hardcoded hex colours in `src/components` (occurrences):**

| Hex | Count | Role today |
|---|---|---|
| `#0D121F` | 82 | card / modal background |
| `#141B2D` | 21 | inner panel / hover |
| `#131927` | 21 | input / select background |
| `#3B82F6` | 5 | brand blue (phase colour, snippets) |
| `#4285F4` `#34A853` `#FBBC05` `#EA4335` | 3 each | Google "G" logo (duplicated in `Navbar.tsx:207-210`, `GoogleLoginModal.tsx:42-56,172-186`) |
| `#0B0F17` | 3 | header/navbar background, avatar ring |
| `#080C14` | 3 | code/spec block background |
| `#8B5CF6` | 2 | brand purple |
| `#EC4899` | 1 | phase pink |
| `#151D2F` | 1 | task bar |
| `#0A0E1A` | 1 | Drive preview pane |
| `#090D15` | 1 | modal footer |
| `#070A12` | 1 | Drive file preview |
| `#070A10` | 1 | mobile drawer backdrop |

Outside components: `#070A10` ×5 (`index.html`, `index.css`), `#3B82F6` ×4, `#EC4899`/`#8B5CF6`/`#10B981` ×3, light tokens `#F8FAFC #FFFFFF #F1F5F9 #E2E8F0 #0F172A #64748B` and dark tokens `#0D121F #131929 #94A3B8` defined in `index.css:5-24` but unused; `#F59E0B #06B6D4` (`AppContext.tsx:488`).
Token proposal derived from usage: `bg-app` (#070A10 / #F8FAFC), `bg-card` (#0D121F / #FFFFFF), `bg-elevated` (#141B2D / #F1F5F9), `bg-input` (#131927 / #FFFFFF), `bg-code` (#080C14 / #F1F5F9), `border-line` (white/10 / #E2E8F0), `fg` (slate-100 / #0F172A), `fg-muted` (slate-400 / #64748B); accents unchanged.

---

## 5. Resilience critique

**Data safety (localStorage only).**
- Keys: AppContext writes `retroplan_*_v4_media` (`AppContext.tsx:147-154`); `storageService.ts:23-31` still defines `*_v3` keys. Consequence: `RobustStorageService.setItem` only snapshots when `key === 'retroplan_projects_v3'` (:46) → **the backup snapshot is never written for live data**; `getItem` with backup recovery (:69-97) is never called by AppContext (:235-246 uses raw `localStorage.getItem`) → **never read**. `DatabaseTesterModal.tsx:52` writes projects to the `v3` key → a second, diverging copy. "Dual Snapshot Active" (`DatabaseTesterModal.tsx:127`) is false. No migration code exists despite the header comment `storageService.ts:1-5`.
- Quota: `RobustStorageService.setItem` returns `false` on failure; `AppContext.tsx:321` ignores the return value; other writers swallow errors (`:310,316,327,333,339,345`). Full document contents, unbounded history (prepend on every action `AppContext.tsx:993`) and unbounded notifications (:372) all live in the same ~5 MB origin quota. Dropped files have no size cap (`MarkdownStudio.tsx:125-152`). On overflow the user sees nothing and loses everything since last successful write.
- Not persisted: `activeProjectId`, `activeViewTab`, `activeDocumentId`, `currentUser` (`AppContext.tsx:157,248-250`) → every reload returns to the mock project's Gantt as Berenger.
- Latent trap: `activeProject` falls back to `projects[0]` (:349) but `updateProject` matches on `activeProjectId` (:674). If the id ever points to a missing project, every update is silently dropped while the UI keeps showing `projects[0]`.
- No restore/import of the JSON backup; `importDroppedFiles` only creates documents (`AppContext.tsx:886-908`).

**Error handling on fetch.** Every AI path masks failure as success: `geminiService.ts:132-143` (`suggestDependencies` returns canned suggestions with `success: true`), `:170-173` (assistant returns canned advice), server fallbacks return `success: true` (`server.ts:98-104, 194-207, 218-224, 265-273, 284-289, 311-318`); `GoogleDriveModal.tsx:99-101` turns an exception into "Drive sync completed"; `googleDriveService.ts:248-260` swallows API errors. `res.ok` is checked but the server returns HTTP 200 for invalid keys (`server.ts:82-87`). No timeouts, no AbortController (the new `httpClient.ts` has one but is unused).

**Stale closures / race conditions — is the `addTask → addHistoryLog → addNotification` overwrite real?** *Not for that sequence.* `updateProject` (`AppContext.tsx:672-676`) uses a functional `setProjects(prev => …)` and merges a **partial patch**: `addTask` queues `{tasks: [...stale.tasks, newTask]}` (:713-714) and `addHistoryLog` queues `{history: [entry, ...stale.history]}` (:993). React applies both updaters in order against the latest `prev`; the patches touch different fields, and neither field was modified by anything else in that tick, so both land. The bug **is real whenever two calls in the same tick patch the same field from the stale snapshot**:
- `MarkdownStudio.tsx:99-113` `handleApplyAiPlan`: `applyAiStructuredData` adds an `ai_restructure` history entry (:941-946), then `saveDocument` adds an `update` entry (:838-843) computed from the same stale `activeProject.history` → the `ai_restructure` entry is overwritten and lost. Concretely reproducible.
- `ApiSettingsModal.tsx:22-33`: `updateApiSettings(newSettings)` then `testCurrentApiKey()` which reads `apiSettings` from the closure (`AppContext.tsx:419-420`) → validates the previous key/model; the result banner refers to the wrong configuration.
- `RetroplanningTimeline.tsx:504,780,804`: the inspector keeps a copied `selectedTask`; the checklist toggle updates the store but not the copy → visual desync until reopened.
- `GoogleDriveModal.tsx:57-63`: effect depends on the `activeProject` object identity, which changes on every store write → selection resets to the first file of subfolder 0 while `activeSubfolderIndex` stays → preview shows a file from a different folder than the one highlighted.
- `GeminiAssistantModal.tsx:18`: greeting captures the project title at mount; wrong after switching projects.
- `CreateTaskModal.tsx:17`: `phaseId` initialised once at app mount (see §1 row 26).
The context value object is rebuilt every render (`AppContext.tsx:1072-1157`) with no `useMemo`/`useCallback`, so every consumer re-renders on any state change.

**ID generation.** 28 `Date.now()`-based ids. Collisions that actually occur: two notifications per comment (`TeamCollaborationView.tsx:58` + `AppContext.tsx:973`) → duplicate `notif-<ms>` React keys; `CreateProjectModal.tsx:24,36,46,56,68-70,91,100,111,123,136` calls `Date.now()` ~12 times to build cross-referencing ids (`task.projectId`, `task.phaseId`) — a millisecond rollover between calls breaks the references; `AppContext.tsx:643` then discards the modal's project id anyway, so `task.projectId` (:69) never equals the stored project id unless both calls hit the same ms. Use `crypto.randomUUID()`.

**Input validation.** None on date order (`CreateTaskModal.tsx:148-165` allows due < start; no check against phase or target date); target date may be in the past (`CreateProjectModal.tsx:198-204`) while phases stay hardcoded to Oct/Nov 2026; milestone dates outside the range are clamped to 0/100% (`RetroplanningTimeline.tsx:80`) and drawn at the edge; `estimatedHours` NaN silently becomes 8 (`CreateTaskModal.tsx:43`); email validation is `includes('@')` (`InviteCollaboratorsModal.tsx:71`); `phase.color + '20'` assumes 6-digit hex (`ImmediateActionView.tsx:297`, `TaskBoard.tsx:182`) — a named colour from the AI yields an invalid value; AI JSON is spread into state with minimal defaults (`AppContext.tsx:914-931`) and no schema check on `phases`/`milestones` (:934-935).

**Secrets.** `firebase-applet-config.json` (Firebase API key + OAuth client id) was deleted in `1b1bf43` but remains in history at `949b750` and `397bcaf` (`git show 949b750:firebase-applet-config.json`). Rotate/restrict the key in Google Cloud and, if the repo is or will be shared, rewrite history. `.env*` is git-ignored (`.gitignore`); `.env.example` is clean. The Gemini key entered in the UI is stored in `localStorage` in clear (`AppContext.tsx:330-334`), contrary to the modal's copy. `server.ts:538` binds `0.0.0.0` with no auth or rate limit → with `GEMINI_API_KEY` set it is an open Gemini proxy for the LAN.

**XSS.** Markdown is rendered by building React elements line by line (`MarkdownStudio.tsx:160-253`); no `dangerouslySetInnerHTML`/`innerHTML` anywhere. Drive preview uses `<pre>{content}</pre>` (`GoogleDriveModal.tsx:353-355`). AI-provided `phase.color` goes into inline `style` (`RetroplanningTimeline.tsx:469,489-490`) — harmless. Safe.

**Electron readiness.** Relative `fetch('/api/…')` (`geminiService.ts:43,72,102,158`) resolves to `file:///api/…` under `file://` → all AI calls fail unless a base URL is injected (the unused `httpClient.ts` is the right hook). `window.location.origin` used for invite links (`InviteCollaboratorsModal.tsx:61,524`, `TeamCollaborationView.tsx:68`) → `file://`. `alert`/`confirm` (`InviteCollaboratorsModal.tsx:477,526`, `TeamCollaborationView.tsx:181`) become blocking native dialogs. Blob `<a download>` (`googleDriveService.ts:264-274`, `DatabaseTesterModal.tsx:61-70`) works but bypasses a native save dialog. Avatars from `images.unsplash.com` need network. `process.env` is only used in `server.ts`/`vite.config.ts` (fine). `localStorage` as the sole store is fragile for a desktop app (cleared with app data, not user-visible, ~5 MB); a file in `userData` is the appropriate target. `index.html:2` hardcodes `class="dark"` before React applies the persisted theme (`AppContext.tsx:173-182`) → flash for light-theme users.

---

## 6. Code quality quick notes

- **God context:** `AppContext.tsx` (1168 lines) exposes ~90 values/functions in one provider, no memoisation (:1072-1157); mixes persistence, tutorial scripting, fake OAuth, AI demo actions and domain mutations. Split into `projects`, `ui/modals`, `team`, `settings`, `tutorial` stores; move mutations into pure reducer functions so `addTask/addHistoryLog` compose without stale snapshots.
- **Very large components:** `RetroplanningTimeline.tsx` 826, `InviteCollaboratorsModal.tsx` 564, `MarkdownStudio.tsx` 556, `ImmediateActionView.tsx` 549, `Navbar.tsx` 519, `HardwareMediaView.tsx` 495. Each embeds 2-5 sub-views inline.
- **Duplicated logic:** `calculateDaysRemaining` (`ProjectHeader.tsx:47-57` = `RetroplanningTimeline.tsx:113-122`); `getAssignee/getPhase` (`ImmediateActionView.tsx:119-125` = `TaskBoard.tsx:49-55`); Google "G" SVG ×3 (`Navbar.tsx:206-211`, `GoogleLoginModal.tsx:40-57,170-187`); `stepIcons` (`InteractiveTourGuide.tsx:83-91` = `InteractiveTutorialModal.tsx:43-51`); status option lists ×3; modal chrome (backdrop + card + header + close) ×10; workload aggregation (`TeamCollaborationView.tsx:41-51` ≈ `InviteCollaboratorsModal.tsx:85-89`); revoke-member confirm ×2 (`TeamCollaborationView.tsx:180-184`, `InviteCollaboratorsModal.tsx:476-480`); Drive/JSON export (`googleDriveService.ts:264-281` ≈ `DatabaseTesterModal.tsx:61-70`).
- **Mock leakage into components:** `MOCK_USERS` imported directly by `Navbar`, `ImmediateActionView`, `TaskBoard`, `HistoryAuditView`, `CreateTaskModal`, `RetroplanningTimeline` instead of `teamMembers` from context → invited members can't be assigned, filtered or displayed.
- **Hardcoded project-specific copy** in generic views (`HardwareMediaView.tsx:131,171,194,210,389-391,424-426,467-469`; `ImmediateActionView.tsx:105,112`; `GeminiAssistantModal.tsx:123`; `TUTORIAL_STEPS` text `mockData.ts:65-185`).
- **Unused imports / state:** many lucide icons (e.g. `RetroplanningTimeline.tsx:5-29` imports `Clock, AlertCircle, ChevronLeft, ChevronRight, CheckCircle2, ArrowRight, Zap, SlidersHorizontal, TrendingUp, User, Users` unused; `HardwareMediaView.tsx:3-27` `Plus, ExternalLink, Sliders, Play, RotateCcw, Eye, Radio, AlertCircle, HardDrive`); `updatePhaseDates` (`RetroplanningTimeline.tsx:36`), `updateTeamMemberRole` (`TeamCollaborationView.tsx:31`), `Project` (`CreateProjectModal.tsx:4` used), `status` state (`CreateTaskModal.tsx:20`), `testTaskTitle` (`DatabaseTesterModal.tsx:51`), `resetTutorial` (`InteractiveTourGuide.tsx:34`). Enable `noUnusedLocals` in `tsconfig.json`.
- **Types vs UI drift:** `TaskStatus 'blocked'` (`types/index.ts:42`) has no UI; `Phase.order` required but AI output omits it; `Milestone.completed` required but server prompt omits it (`server.ts:137-146`); `HistoryEntry.actionType 'comment'` never emitted.
- **Dead files to delete:** `InteractiveTutorialModal.tsx`, `ImplementationPlanModal.tsx`, `DatabaseTesterModal.tsx` + `storageService.runLiveDatabaseTests`, fake invitations seed, `deleteProject`/`exportProjectAsMarkdown` until wired, CSS vars in `index.css` until adopted (Phase 2 of `docs/PLAN.md`).
- **Leftovers of the generator:** `vite.config.ts:14-19` AI Studio HMR comments; `metadata.json` removed but `index.html:7-11` still carries marketing meta ("real-time sync"); brand string "RetroPlan STUDIO" (`Navbar.tsx:73-76`) vs new name.

---

## Top 15 fixes by impact

1. **Delete the fake trust surfaces** — `DatabaseTesterModal` + `runLiveDatabaseTests` (`storageService.ts:132-414`), `ImplementationPlanModal`, `InteractiveTutorialModal`, seeded invitation (`AppContext.tsx:200-218`), fake Google account default (`mockData.ts:42-54`), `status: 'connected'` default (`mockData.ts:60`), every "zero data loss / verified / live" string. Relabel remaining local features as local.
2. **Make persistence honest and safe** — one versioned key set, surface `setItem` failures (`AppContext.tsx:321`), cap history/notifications, add JSON import/restore, persist `activeProjectId`/`activeViewTab`/`currentUser`; for Electron move to a file in `userData`.
3. **Theme system** — replace the 82× `#0D121F` / 21× `#141B2D` / 21× `#131927` and `text-slate-1xx`/`border-white/N` tokens in `ProjectHeader`, `RetroplanningTimeline`, `Navbar`, all modals with semantic tokens; verify `index.css:3` variant syntax; remove `class="dark"` from `index.html:2`.
4. **Implement or rename the retroplanning engine** — compute phase/task dates backward from `targetDeliveryDate` using durations + `bufferDays` (`AppContext.tsx:688-704`), compute critical path/float from `dependencies`, derive `retroplanningScore` from real slack; until then remove "6d buffer", "% Safe", "Zero slack" literals.
5. **Fix stale-closure mutations** — express `addTask/addHistoryLog/updateTask/…` as reducer actions applied to `prev` inside `setProjects` (fixes the lost `ai_restructure` entry in `MarkdownStudio.tsx:99-113`, the wrong-key test in `ApiSettingsModal.tsx:22-33`, and the `activeProjectId` latent trap).
6. **Confirm + undo for destructive actions** — delete task (`TaskBoard.tsx:303`), delete doc (`MarkdownStudio.tsx:393`), apply AI plan (`MarkdownStudio.tsx:315`), demo actions that write data (`AppContext.tsx:573,609`); make `revertHistoryState` handle every entry or hide the button.
7. **One navigation model** — keep view tabs in `ProjectHeader`, move Invite/Drive/AI/Settings into a single Navbar menu, drop duplicate buttons (`ProjectHeader.tsx:206-287`, `Navbar.tsx:143-183`), one tutorial surface.
8. **Task editing** — an edit-task modal (dates, phase, assignee, dependencies) and fix `CreateTaskModal` mount-time state (`CreateTaskModal.tsx:17-25`); use `teamMembers` instead of `MOCK_USERS` in all six components.
9. **Gantt lanes** — stack overlapping tasks in rows per phase, real zoom (px/day), draggable bars wired to `updatePhaseDates`/task dates, render dependency links, empty state.
10. **Route the custom API key everywhere** (`GeminiAssistantModal.tsx:52`, `MarkdownStudio.tsx:74`, `RetroplanningTimeline.tsx:138`) and stop masking failures as success (`geminiService.ts:132-143,170-173`, `server.ts` fallbacks); show `fallback:true` to the user.
11. **Real Google auth or none** — remove `GoogleLoginModal` fake OAuth (`AppContext.tsx:376-396`) and the fake sync success (`googleDriveService.ts:253-260`); keep JSON/Markdown/CSV export as "Export" until Drive is real (Phase 4 of `docs/PLAN.md`).
12. **Notifications** — emit only for cross-user or scheduled events, real timestamps, dismiss, dedupe the double comment notification (`TeamCollaborationView.tsx:58`), stable ids via `crypto.randomUUID()`.
13. **Accessibility baseline** — shared `<Modal>` with `role="dialog"`, focus trap, Escape/backdrop close; buttons instead of clickable divs; outside-click for dropdowns; remove `user-scalable=no` (`index.html:5`); replace `alert/confirm`.
14. **Markdown** — real parser (e.g. `marked` + sanitiser or `react-markdown`) so tables/code fences/links render; dirty-state guard on doc switch (`MarkdownStudio.tsx:52-58`); fix `bg-slate-800`/`text-slate-100` inline tokens.
15. **Hygiene** — rotate the leaked Firebase key (history `949b750`), wire `httpClient.ts` with a configurable base URL for Electron, `noUnusedLocals`, remove `MOCK_USERS` from components, pick one language for the UI, strip emojis from titles.
