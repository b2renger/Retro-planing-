# State API (`useApp()`)

The store lives in `src/state/*`; `src/context/AppContext.tsx` wires it and exposes the `useApp()` facade. UI code must go through the facade. Every domain mutation is one reducer action applied to the current state, so two calls in the same tick never overwrite each other.

Files:

| File | Role |
|---|---|
| `src/state/ids.ts` | `newId(prefix)` via `crypto.randomUUID()` (time+random fallback). |
| `src/state/projectsReducer.ts` | Pure `projectsReducer(projects, action)`, action creators `projectsActions`, `computeProjectHealth`, `normalizeProject`, date helpers. |
| `src/state/appReducer.ts` | Root reducer (projects + team, notifications, tutorial, settings, ui, undo). |
| `src/state/tutorial.ts` | Tutorial progress + the sandbox: `TutorialState`, `DEFAULT_TUTORIAL`, `reconcileTutorial`, `buildSandboxProject`. |
| `src/state/persistence.ts` | localStorage namespace `rps_v1_*`, `load`/`save`, legacy migration, backup import/export, `runStorageSelfTest`. |
| `src/state/secrets.ts` | API keys / OAuth client secrets: OS secure store when available, else localStorage. |
| `src/state/themeBoot.ts` | Applies the theme to `<html>` before React renders; `applyTheme`, `resolveTheme`, `watchSystemTheme`. |
| `src/state/avatar.ts` | `initialsAvatar(name, color)` local SVG data URI (no network). |
| `src/context/AppContext.tsx` | `AppProvider`, `useApp()`, `useActiveProject()`, re-exports `computeProjectHealth`. |

## Rendering rule

`activeProject` is `Project | null`. `App.tsx` renders the project views, `ProjectHeader` and the project-scoped modals only when it is non-null and shows an empty state (create / import JSON) otherwise. Inside those views call `useActiveProject()` (returns `Project`, throws if rendered without one). `CreateProjectModal` and `settings/SettingsModal` are mounted in both branches.

## `useApp()` facade

People and workspaces
- `currentUser: User` — member selected by `ui.currentUserId`, else first member.
- `setCurrentUser(id)` — switch the acting persona (local simulation of multi-user).
- `teamMembers: User[]`, `invitations: TeamInvitation[]`.
- `inviteCollaborator(email, name, role, permissions, note?) => TeamInvitation` — creates a PENDING invitation only; nothing is sent, no member is added.
- `acceptInvitation(id)` — local simulation: adds a member (initials avatar) to the team and the active workspace, marks the invitation accepted. UI must label it as local.
- `revokeInvitation(id)` — removes the invitation.
- `removeTeamMember(userId)` — undoable; reassigns the member's tasks in every project to the current user (or the first other member when removing yourself), removes them from workspaces; refuses to remove the last member.
- `updateTeamMemberRole(userId, role)`.
- `workspaces`, `activeWorkspace`, `setActiveWorkspaceId(id)`.

Theme
- `theme: 'dark' | 'light' | 'system'`, `setTheme(theme)`, `resolvedTheme: 'dark' | 'light'` (what is applied right now; `system` follows the OS live).

Projects and navigation
- `projects: Project[]`, `activeProject: Project | null`, `setActiveProjectId(id)` (also clears `activeDocumentId`).
- `createProject(partial) => Project` — normalised (`normalizeProject`): id, dates, `phase.order`, `task.projectId`; becomes active; logs a `create` entry.
- `updateProject(patch)` — patch on the active project, no history entry.
- `deleteProject(id)` — undoable; the active project falls back to the first remaining one or `null`.
- `activeViewTab`, `setActiveViewTab(tab)`.

Tasks
- `addTask(taskWithoutId) => Task`, `updateTask(task)` (logs `status_change` with a diff when the status changed, else `update`), `deleteTask(id)` (undoable; dependency references are dropped), `updateTaskStatus(id, status)`, `toggleChecklistItem(taskId, itemId)` (no history entry).
- `editingTaskId`, `setEditingTaskId(id | null)` — reserved for an edit-task modal.

Phases and milestones
- `addPhase(phaseWithoutId) => Phase`, `updatePhase(id, patch)`, `deletePhase(id)` (undoable; its tasks move to the first remaining phase by `order`, or `phaseId: ''`), `updatePhaseDates(id, start, end)`.
- `addMilestone(msWithoutId) => Milestone`, `updateMilestone(id, patch)`, `deleteMilestone(id)` (undoable), `toggleMilestoneComplete(id)`.
- `updateTargetDeliveryDate(date, mode = 'anchor-only')` — `'anchor-only'` changes the target only (history: "Target date changed …; schedule not moved"); `'shift-all'` (undoable) shifts `startDate`, every phase, task and milestone by the calendar-day delta (history: "Shifted all dates by +5 days …"). Invalid dates are ignored.

Documents
- `activeDocument: MarkdownDoc | null` (selected, else first), `setActiveDocumentId(id | null)`.
- `saveDocument(doc)` (stamps `lastModified`/`lastModifiedBy`), `createDocument(docWithoutIdAndStamps) => MarkdownDoc` (becomes active), `deleteDocument(id)` (undoable; when the project has a cloud link the id is appended to `cloud.syncState.deletedDocIds`), `importDroppedFiles([{name, content}]) => MarkdownDoc[]` (tag `Imported`, first becomes active).
- `applyAiStructuredData(data, { replace })` — undoable. `data` is the AI layer's `CrunchResult` or anything alike; entities are normalised (fresh ids, `YYYY-MM-DD` dates or fallback to the target, `phase.order`, `milestone.completed=false`, unknown `assigneeId` → current user, unknown `phaseId` → first phase, dangling dependencies dropped). `replace: true` replaces phases/tasks/milestones/questions; `replace: false` appends.

Comments, history, questions
- `addComment(content, targetType, targetId)` — stored on the project with a `comment` history entry.
- `addHistoryLog(entry)` — `entry` is `HistoryEntry` without id/timestamp/user fields.
- `resolveClarification(questionId, response)`.

Notifications
- `notifications`, `unreadCount`, `addNotification({title, message, type, projectId?, taskId?})` (ISO timestamp, cap 100, identical title+message within 2 s is dropped), `markNotificationRead(id)`, `markAllNotificationsRead()`, `dismissNotification(id)`, `clearNotifications()`.
- The facade itself emits no notifications for the user's own actions; callers (cloud sync, AI results, scheduled checks) decide.

Tutorial (never writes to a project the user owns — see the sandbox below)
- `tutorial: TutorialState` — `{ status: 'idle' | 'running', currentStepId, completedStepIds, completedAt, inviteDismissed, sandbox }`. `completedAt` is the "tutorial finished at least once" flag the first-run invitation reads; `sandbox` is `{ projectId, returnProjectId, returnViewTab, startedAt }` or `null`.
- `startTutorial(firstStepId)` — builds a throwaway copy of the bundled sample project (`buildSandboxProject`), appends it, remembers the project and view the user came from, and switches to it. When a live sandbox already exists this is a **resume**: no second copy, the stored `currentStepId` is kept.
- `goToTutorialStep(id)`, `completeTutorialStep(id)` — navigation and progress only.
- `endTutorial({ removeSandbox, completed })` — leaves. `removeSandbox: true` (the UI default) deletes the practice project and puts the user back on `returnProjectId` / `returnViewTab`; `false` keeps it as an ordinary project. `completed: true` stamps `completedAt` and clears `currentStepId` so the next start begins at step 1.
- `resetTutorial()` — clears `completedStepIds`, `completedAt` and `currentStepId`; does not touch a running sandbox.
- `dismissTutorialInvite()` — hides the first-run invitation for good.

**The sandbox.** `tutorial/start` and `tutorial/end` add and remove the practice project *inside the reducer*, deliberately not through `createProject` / `deleteProject`: no undo snapshot is pushed, no notification is emitted, and the user's own `projects` come out of a full round trip byte-identical (proved in `src/state/tutorial.test.ts`). The copy is built from the `MEDIA_INSTALLATION_PROJECT` constant — never from the user's own copy of it — with a fresh id, `isTutorialTemplate: true`, an empty history, no comments and no cloud link. `reconcileTutorial` drops a sandbox whose project no longer exists at boot and stops the tutorial with it. Step content (`TUTORIAL_STEPS`, anchors, completion predicates) lives in `src/components/tutorial/steps.ts`; the store only ever holds step **ids**.

Modal flags (local state, not persisted)
- `isCloudPanelOpen`, `isAiAssistantOpen`, `isCreateTaskModalOpen`, `isCreateProjectModalOpen`, `isSettingsOpen`, `isInviteModalOpen` + their `setIs…(open)` setters.

Undo
- `undo()`, `canUndo`, `undoLabel` — see policy below.

Storage
- `storageError: string | null` — set when a `localStorage` write fails (quota, unavailable); cleared by the next successful write. App shows it as a banner.
- `exportBackup() => string` — whole store as JSON (secrets stripped).
- `importBackup(text) => {ok, error?}` — validates (`importAllJson`), undoable, replaces the slices present in the file.
- `importProjectFromJson(text) => {ok, error?, project?}` — single project (`parseProjectJson`), undoable, replaces a project with the same id or adds it; becomes active.

AI settings
- `aiSettings: { providers: AiProviderConfig[]; defaultProviderId: string | null }`.
- `activeAiProvider: AiProviderConfig | null` — the default provider if enabled, else the first enabled, else `null`. Pass it to `src/services/ai/tasks.ts` functions.
- `addAiProvider(cfgWithoutId) => AiProviderConfig` (first one becomes default), `updateAiProvider(id, patch)`, `removeAiProvider(id)`, `setDefaultAiProvider(id | null)`.
- `secretsReady: boolean` — false until keys have been re-hydrated from the secure store (Electron); UI should show a loading state for key fields until then.
- `secretsBackend: 'secure-store' | 'local-storage' | 'none'` — for the settings copy ("keys are stored in clear text in this browser" when `local-storage`).

Cloud
- `cloudSettings: { google: {clientId, clientSecret?}, onedrive: {clientId} }`, `updateCloudSettings({google?, onedrive?})`.
- `cloudAccounts: Partial<Record<CloudProviderId, CloudAccount>>`, `setCloudAccount(providerId, account | null)`.
- `cloudStatus: { state: 'idle' | 'syncing' | 'ok' | 'error'; message?; lastSyncAt? }`, `setCloudStatus(status)` (not persisted).
- `setCloudLink(projectId, link | null)` — writes `project.cloud` (`{providerId, folderId, docsFolderId, exportsFolderId?, projectFileId?, syncState, lastSyncAt?}`), no history entry.
- `applyCloudPatch(projectId, { documents?, projectPatch? })` — used by sync to apply remote changes, no history entry, score not recomputed.

Also exported from the context module: `computeProjectHealth(project, today?)` → `{ daysRemaining, overdueTasks, tasksDone, tasksTotal, scheduleEndsAfterTarget, slackDays, retroplanningScore }`. `project.retroplanningScore` is kept in sync by the reducer (`clamp(0,100, 100 − 10·overdue − (overrun ? 30 : 0))`); prefer the function in the UI.

## Reducer actions (`src/state/projectsReducer.ts`)

Every action carries `projectId`, `actor {id, name, avatar}` and `at` (ISO). Creators in `projectsActions` take `(ctx, ...args)` where `ctx = { projectId, actor, at? }`.

`project/create`, `project/update`, `project/delete`, `project/restore`, `task/add`, `task/update`, `task/delete`, `task/setStatus`, `task/toggleChecklistItem`, `phase/add`, `phase/update`, `phase/delete`, `milestone/add`, `milestone/update`, `milestone/delete`, `milestone/toggle`, `project/setTargetDeliveryDate` (`mode: 'anchor-only' | 'shift-all'`), `document/save`, `document/create`, `document/delete`, `document/import`, `project/applyAiStructure` (`replace`, `knownAssigneeIds`), `comment/add`, `history/add`, `clarification/resolve`, `cloud/setLink`, `cloud/applyPatch`.

Invariants: history is prepended and capped at 300 entries; timestamps are ISO; ids come from `newId`; unknown project / no-op returns the same array reference; the derived `retroplanningScore` is recomputed after every action except the two `cloud/*` ones.

Root actions (`src/state/appReducer.ts`): `projects` (wraps a projects action and repairs `ui.activeProjectId` when it no longer exists), `ui/patch`, `notifications/*`, `team/*`, `tutorial/start|goto|complete|end|reset|dismissInvite`, `ai/*`, `secrets/hydrate`, `cloud/*`, `undo/push`, `undo/pop`, `store/restoreAll`, `storage/error`.

## Persistence (`src/state/persistence.ts`)

Keys, all JSON: `rps_v1_projects`, `rps_v1_workspaces`, `rps_v1_teamMembers`, `rps_v1_invitations`, `rps_v1_notifications`, `rps_v1_aiSettings`, `rps_v1_cloudSettings`, `rps_v1_cloudAccounts`, `rps_v1_tutorialState`, `rps_v1_ui` (`{activeProjectId, activeViewTab, activeDocumentId, currentUserId, activeWorkspaceId, theme}`), plus the marker `rps_v1_migratedAt` and the secret index `rps_v1_secretIds`.

- Each slice is saved by its own effect in `AppProvider`; `save()` never throws and returns `{ok, error?}` → `storageError`.
- Boot: `load()` reads every slice (a corrupt slice is skipped and reported). Sample data (`INITIAL_PROJECTS`, `MOCK_USERS`, …) is used only for slices that were never saved; an empty saved `projects` array stays empty.
- Migration: on first run (no `rps_v1_*` key) the old `retroplan_*_v4_media` keys are converted once: fake Drive fields dropped, non-ISO timestamps replaced, the seeded demo invitation removed, a custom Gemini key becomes a `gemini` provider, `retroplan_theme` becomes `ui.theme`. Old keys are left untouched.
- `rps_v1_tutorialState` holds the whole `TutorialState` (progress + the sandbox reference), validated by `reconcileTutorial` at boot. The old `rps_v1_tutorial` step array is no longer read or written — its ids belonged to the previous tutorial — and the legacy `retroplan_tutorial_steps_v4_media` key is not migrated; `clearAll()` still sweeps both.
- Backup: `exportAllJson(state)` → `{format:'rps-backup', version:1, exportedAt, data}` with secrets stripped; `importAllJson(text)` validates (projects through `parseProjectJson`) and throws `BackupError` with the offending path; `importProjectJson(text)` = `parseProjectJson`.
- `runStorageSelfTest()` writes/reads/removes a probe key and reports `{ok, message, usedBytes, keyCount}` for a diagnostics panel. No fake test suite.

## Secrets policy (`src/state/secrets.ts`)

- Electron (`window.desktop.secureStore` present): `apiKey` of each AI provider and `cloudSettings.google.clientSecret` are written to the OS keychain-backed store under `ai:<providerId>` / `cloud:google:clientSecret`, STRIPPED from the localStorage copies, and re-hydrated on boot (`secretsReady` turns true).
- Web build: no secure store; the values stay inside `rps_v1_aiSettings` / `rps_v1_cloudSettings` in clear text. `secretsBackend` tells the UI which case applies so the copy can say so.
- Backups never contain secrets.

## Undo policy

A snapshot (`projects`, `teamMembers`, `workspaces`, `invitations`, active project/document ids) is pushed BEFORE: `deleteTask`, `deleteDocument`, `deletePhase`, `deleteMilestone`, `deleteProject`, `applyAiStructuredData`, `updateTargetDeliveryDate(…, 'shift-all')`, `removeTeamMember`, `importBackup`, `importProjectFromJson`. Stack depth 20, in memory only (lost on reload). `undo()` restores the top snapshot; `undoLabel` is the human label of what will be undone. Notifications and settings are not part of snapshots.

## Theme boot

`src/state/themeBoot.ts` is imported first by `main.tsx`. At import it reads `rps_v1_ui.theme` (fallback: legacy `retroplan_theme`, then `system`) and sets `dark`/`light` class, `color-scheme` and `data-theme` on `<html>` synchronously. `AppProvider` re-applies on `setTheme` and, for `system`, listens to `prefers-color-scheme` changes. `index.html` carries no hard-coded theme class or colours.
