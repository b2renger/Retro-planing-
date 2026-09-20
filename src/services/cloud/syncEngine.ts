/**
 * Two-way reconciliation between a local `Project` and its cloud folder.
 *
 * `planSync` is pure: it compares the local project, the remote listing and the last known sync
 * state and produces a list of actions. `executeSync` runs those actions against a provider,
 * tolerating per-action failures. The cloud folder is the source of truth on first contact.
 */
import type { MarkdownDoc, Project } from '../../types';
import {
  docFileName,
  docIdForCloudFile,
  DOCS_FOLDER_NAME,
  EXPORTS_FOLDER_NAME,
  isMarkdownName,
  JSON_MIME,
  MARKDOWN_MIME,
  parseDoc,
  parseProjectFile,
  PROJECT_FILE_NAME,
  ROOT_FOLDER_NAME,
  serializeDoc,
  serializeProject,
  slugify,
} from './layout';
import { CloudError, type CloudFile, type CloudProvider, type CloudProviderId } from './types';

// ---------------------------------------------------------------------------
// State & plan types
// ---------------------------------------------------------------------------

/** Per-document bookkeeping from the last successful sync. */
export interface SyncFileEntry {
  fileId: string;
  /** `CloudFile.modifiedTime` observed at last sync. */
  remoteModified: string;
  /** `doc.lastModified` at last sync. */
  localModified: string;
}

/** Persisted per-project sync state (store it next to the project). */
export interface SyncState {
  providerId: CloudProviderId;
  rootFolderId: string;
  projectFolderId: string;
  docsFolderId: string;
  exportsFolderId?: string;
  projectFileId?: string;
  /** project.json `modifiedTime` at last sync. */
  projectRemoteModified?: string;
  /** The `lastLocalChange` value passed to the last sync. */
  projectLocalModified?: string;
  files: Record<string, SyncFileEntry>;
  /** Ids of local documents deleted since the last sync (the app appends; the sync clears). */
  deletedDocIds?: string[];
  lastSyncAt?: string;
}

/** One reconciliation step. */
export type SyncAction =
  | { type: 'upload-doc'; docId: string; name: string; fileId?: string }
  | { type: 'download-doc'; fileId: string; name: string; remoteModified: string; docId?: string }
  | { type: 'delete-local-doc'; docId: string }
  | { type: 'delete-remote'; fileId: string; docId?: string }
  | { type: 'conflict'; docId: string; fileId: string; name: string; remoteModified: string }
  | { type: 'upload-project'; fileId?: string; localModified?: string }
  | { type: 'download-project'; fileId: string; remoteModified: string; localModified?: string }
  | { type: 'conflict-project'; fileId: string; remoteModified: string; localModified?: string };

/** Ordered list of actions produced by `planSync`. */
export type SyncPlan = SyncAction[];

/** Optional inputs of `planSync`. */
export interface PlanOptions {
  /**
   * ISO timestamp of the last local change to project-level data (tasks, phases, settings…).
   * Omit when unknown: project.json is then only uploaded when it does not exist remotely.
   */
  lastLocalChange?: string;
}

// ---------------------------------------------------------------------------
// planSync
// ---------------------------------------------------------------------------

function ts(iso: string | undefined): number {
  if (!iso) return 0;
  const n = Date.parse(iso);
  return Number.isFinite(n) ? n : 0;
}

/** True when `a` is strictly later than `b` (both ISO strings; missing = epoch). */
export function isLater(a: string | undefined, b: string | undefined): boolean {
  return ts(a) > ts(b);
}

/** Remote files in `docs/` that the sync treats as documents (Markdown, or a native Google Doc). */
export function isSyncableDoc(file: CloudFile): boolean {
  return !file.isFolder && (isMarkdownName(file.name) || file.mimeType === 'application/vnd.google-apps.document');
}

/**
 * Computes the actions needed to reconcile `project` with the cloud folder.
 *
 * Rules:
 * - First sync (no `lastSyncAt`) with an empty remote → upload every doc and project.json.
 * - First sync with a remote project.json → download it and every remote doc (remote wins).
 * - Afterwards, per document: changed on one side → copy that way; both → `conflict`;
 *   gone remotely and untouched locally → `delete-local-doc`; gone locally → `delete-remote`
 *   (unless the remote copy changed since, in which case it is downloaded again);
 *   new local doc → upload; new remote file → download.
 * - project.json follows the same one-side / both-sides logic using `lastLocalChange`.
 */
export function planSync(project: Project, remoteDocs: CloudFile[], remoteProjectFile: CloudFile | null, state: SyncState, opts: PlanOptions = {}): SyncPlan {
  const plan: SyncPlan = [];
  const remoteFiles = remoteDocs.filter(isSyncableDoc);
  const remoteById = new Map(remoteFiles.map((f) => [f.id, f]));
  const localById = new Map(project.documents.map((d) => [d.id, d]));
  const trackedFileIds = new Set(Object.values(state.files).map((e) => e.fileId));
  const deleted = new Set(state.deletedDocIds ?? []);
  const takenNames = new Set(remoteFiles.map((f) => f.name.toLowerCase()));
  const firstSync = !state.lastSyncAt && Object.keys(state.files).length === 0;

  const nameFor = (doc: MarkdownDoc): string => {
    const name = docFileName(doc.title, takenNames);
    takenNames.add(name.toLowerCase());
    return name;
  };

  if (firstSync && remoteProjectFile) {
    // Remote project exists and we have no history: the cloud is the source of truth.
    for (const f of remoteFiles) plan.push({ type: 'download-doc', fileId: f.id, name: f.name, remoteModified: f.modifiedTime });
    plan.push({ type: 'download-project', fileId: remoteProjectFile.id, remoteModified: remoteProjectFile.modifiedTime, localModified: opts.lastLocalChange });
    return plan;
  }

  // 1. Documents known from a previous sync.
  for (const [docId, entry] of Object.entries(state.files)) {
    const local = localById.get(docId);
    const remote = remoteById.get(entry.fileId);
    const localChanged = !!local && isLater(local.lastModified, entry.localModified);
    const remoteChanged = !!remote && isLater(remote.modifiedTime, entry.remoteModified);

    if (!local) {
      // Deleted locally (either recorded in deletedDocIds or simply absent).
      if (!remote) continue; // gone on both sides; state entry is dropped by the executor on next upload
      if (remoteChanged) plan.push({ type: 'download-doc', fileId: remote.id, name: remote.name, remoteModified: remote.modifiedTime, docId });
      else plan.push({ type: 'delete-remote', fileId: remote.id, docId });
      continue;
    }
    if (!remote) {
      if (localChanged) plan.push({ type: 'upload-doc', docId, name: nameFor(local) });
      else plan.push({ type: 'delete-local-doc', docId });
      continue;
    }
    if (localChanged && remoteChanged) {
      plan.push({ type: 'conflict', docId, fileId: remote.id, name: remote.name, remoteModified: remote.modifiedTime });
    } else if (localChanged) {
      plan.push({ type: 'upload-doc', docId, name: remote.name, fileId: remote.id });
    } else if (remoteChanged) {
      plan.push({ type: 'download-doc', fileId: remote.id, name: remote.name, remoteModified: remote.modifiedTime, docId });
    }
  }

  // 2. Remote files never seen before.
  for (const f of remoteFiles) {
    if (!trackedFileIds.has(f.id)) plan.push({ type: 'download-doc', fileId: f.id, name: f.name, remoteModified: f.modifiedTime });
  }

  // 3. Local docs never uploaded.
  for (const doc of project.documents) {
    if (!state.files[doc.id] && !deleted.has(doc.id)) plan.push({ type: 'upload-doc', docId: doc.id, name: nameFor(doc) });
  }

  // 4. project.json
  if (!remoteProjectFile) {
    plan.push({ type: 'upload-project', localModified: opts.lastLocalChange });
  } else {
    const remoteChanged = isLater(remoteProjectFile.modifiedTime, state.projectRemoteModified);
    const baseline = state.projectLocalModified ?? state.lastSyncAt;
    const localChanged = opts.lastLocalChange !== undefined && isLater(opts.lastLocalChange, baseline);
    const common = { fileId: remoteProjectFile.id, remoteModified: remoteProjectFile.modifiedTime, localModified: opts.lastLocalChange };
    if (remoteChanged && localChanged) plan.push({ type: 'conflict-project', ...common });
    else if (remoteChanged) plan.push({ type: 'download-project', ...common });
    else if (localChanged) plan.push({ type: 'upload-project', fileId: remoteProjectFile.id, localModified: opts.lastLocalChange });
  }

  return plan;
}

// ---------------------------------------------------------------------------
// executeSync
// ---------------------------------------------------------------------------

/** Callbacks the executor uses to push results into the app. */
export interface SyncHooks {
  /** Receives the merged local changes once the plan has run. */
  applyLocalChanges(patch: { documents?: MarkdownDoc[]; project?: Partial<Project> }): void | Promise<void>;
  /** User-facing progress / problem messages. */
  notify(message: string, level: 'info' | 'warning' | 'error'): void;
}

/** Counters returned by `executeSync`. */
export interface SyncSummary {
  uploaded: number;
  downloaded: number;
  conflicts: number;
  deleted: number;
}

/** Result of `executeSync`. */
export interface SyncResult {
  project: Project;
  state: SyncState;
  summary: SyncSummary;
  /** Per-action failures (the rest of the plan still ran). */
  errors: Array<{ action: SyncAction; message: string }>;
}

const CLOUD_AUTHOR = 'cloud';

function describe(action: SyncAction): string {
  switch (action.type) {
    case 'upload-doc':
      return `upload "${action.name}"`;
    case 'download-doc':
      return `download "${action.name}"`;
    case 'delete-local-doc':
      return `remove local document ${action.docId}`;
    case 'delete-remote':
      return `delete cloud file ${action.fileId}`;
    case 'conflict':
      return `resolve conflict on "${action.name}"`;
    case 'upload-project':
      return 'upload project.json';
    case 'download-project':
      return 'download project.json';
    case 'conflict-project':
      return 'resolve project.json conflict';
  }
}

/**
 * Runs a plan. Document actions run before project.json actions so the uploaded index reflects
 * the final document set. Every action is isolated: a failure is recorded and the rest proceeds.
 */
export async function executeSync(provider: CloudProvider, project: Project, state: SyncState, plan: SyncPlan, hooks: SyncHooks): Promise<SyncResult> {
  const docs: MarkdownDoc[] = project.documents.map((d) => ({ ...d }));
  const files: Record<string, SyncFileEntry> = { ...state.files };
  let projectPatch: Partial<Project> | undefined;
  const summary: SyncSummary = { uploaded: 0, downloaded: 0, conflicts: 0, deleted: 0 };
  const errors: SyncResult['errors'] = [];
  const deletedDocIds = new Set(state.deletedDocIds ?? []);
  let projectFileId = state.projectFileId;
  let projectRemoteModified = state.projectRemoteModified;
  let projectLocalModified = state.projectLocalModified;

  const currentProject = (): Project => ({ ...project, ...(projectPatch ?? {}), documents: docs });
  const findDoc = (id: string): MarkdownDoc | undefined => docs.find((d) => d.id === id);
  const upsertDoc = (doc: MarkdownDoc): void => {
    const i = docs.findIndex((d) => d.id === doc.id);
    if (i >= 0) docs[i] = doc;
    else docs.push(doc);
  };

  const uploadDoc = async (doc: MarkdownDoc, name: string, fileId?: string): Promise<void> => {
    const res = await provider.writeText({
      parentId: state.docsFolderId,
      name,
      content: serializeDoc(doc),
      mimeType: MARKDOWN_MIME,
      existingFileId: fileId,
    });
    files[doc.id] = { fileId: res.id, remoteModified: res.modifiedTime, localModified: doc.lastModified };
    summary.uploaded++;
  };

  const downloadDoc = async (fileId: string, name: string, remoteModified: string, docId?: string, forceNewId?: string): Promise<MarkdownDoc> => {
    const text = await provider.readText(fileId);
    const parsed = parseDoc(name, text);
    let id = forceNewId ?? docId ?? parsed.id ?? docIdForCloudFile(fileId);
    // A frontmatter id already bound to another cloud file must not hijack that document.
    if (!forceNewId && !docId && parsed.id && files[parsed.id] && files[parsed.id].fileId !== fileId) id = docIdForCloudFile(fileId);
    const existing = findDoc(id);
    const doc: MarkdownDoc = {
      ...(existing ?? { linkedTaskIds: [] }),
      id,
      title: parsed.title,
      tags: parsed.tags,
      content: parsed.content,
      path: parsed.path ?? existing?.path ?? `${DOCS_FOLDER_NAME}/${name}`,
      lastModified: remoteModified,
      lastModifiedBy: CLOUD_AUTHOR,
    };
    upsertDoc(doc);
    if (!forceNewId) files[id] = { fileId, remoteModified, localModified: remoteModified };
    summary.downloaded++;
    return doc;
  };

  const ordered = [...plan].sort((a, b) => Number(a.type.endsWith('project')) - Number(b.type.endsWith('project')));

  for (const action of ordered) {
    try {
      switch (action.type) {
        case 'upload-doc': {
          const doc = findDoc(action.docId);
          if (!doc) break;
          await uploadDoc(doc, action.name, action.fileId);
          break;
        }
        case 'download-doc':
          await downloadDoc(action.fileId, action.name, action.remoteModified, action.docId);
          break;
        case 'delete-local-doc': {
          const i = docs.findIndex((d) => d.id === action.docId);
          if (i >= 0) docs.splice(i, 1);
          delete files[action.docId];
          summary.deleted++;
          break;
        }
        case 'delete-remote': {
          try {
            await provider.deleteFile(action.fileId);
          } catch (err) {
            if (!(err instanceof CloudError && err.kind === 'not-found')) throw err;
          }
          for (const [docId, entry] of Object.entries(files)) if (entry.fileId === action.fileId) delete files[docId];
          if (action.docId) deletedDocIds.delete(action.docId);
          summary.deleted++;
          break;
        }
        case 'conflict': {
          const local = findDoc(action.docId);
          if (!local) break;
          const copyId = `${action.docId}-conflict-${Date.now().toString(36)}`;
          const copy = await downloadDoc(action.fileId, action.name, action.remoteModified, undefined, copyId);
          copy.title = `${copy.title} (conflict from cloud)`;
          upsertDoc(copy);
          await uploadDoc(local, action.name, action.fileId);
          summary.conflicts++;
          hooks.notify(`"${local.title}" changed both locally and in the cloud; the cloud version was kept as "${copy.title}".`, 'warning');
          break;
        }
        case 'upload-project': {
          const res = await provider.writeText({
            parentId: state.projectFolderId,
            name: PROJECT_FILE_NAME,
            content: serializeProject(currentProject()),
            mimeType: JSON_MIME,
            existingFileId: action.fileId ?? projectFileId,
          });
          projectFileId = res.id;
          projectRemoteModified = res.modifiedTime;
          projectLocalModified = action.localModified ?? projectLocalModified;
          summary.uploaded++;
          break;
        }
        case 'download-project':
        case 'conflict-project': {
          const text = await provider.readText(action.fileId);
          const remote = parseProjectFile(text);
          const { documents: _index, ...rest } = remote;
          projectPatch = { ...rest, id: project.id, workspaceId: project.workspaceId };
          projectFileId = action.fileId;
          projectRemoteModified = action.remoteModified;
          projectLocalModified = action.localModified ?? projectLocalModified;
          summary.downloaded++;
          if (action.type === 'conflict-project') {
            summary.conflicts++;
            hooks.notify('Project settings changed both locally and in the cloud; the cloud version was kept.', 'warning');
          }
          break;
        }
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      errors.push({ action, message });
      hooks.notify(`Could not ${describe(action)}: ${message}`, 'error');
    }
  }

  // Drop bookkeeping for docs deleted on both sides.
  for (const docId of Object.keys(files)) {
    if (!findDoc(docId) && !plan.some((a) => a.type === 'upload-doc' && a.docId === docId)) delete files[docId];
  }

  const nextState: SyncState = {
    ...state,
    files,
    projectFileId,
    projectRemoteModified,
    projectLocalModified,
    deletedDocIds: [...deletedDocIds].filter((id) => files[id] !== undefined),
    lastSyncAt: new Date().toISOString(),
  };

  const patch: { documents?: MarkdownDoc[]; project?: Partial<Project> } = { documents: docs };
  if (projectPatch) patch.project = projectPatch;
  await hooks.applyLocalChanges(patch);

  return { project: currentProject(), state: nextState, summary, errors };
}

// ---------------------------------------------------------------------------
// Folder helpers
// ---------------------------------------------------------------------------

/** Ids of the standard folders of a project. */
export interface ProjectFolderIds {
  rootFolderId: string;
  projectFolderId: string;
  docsFolderId: string;
  exportsFolderId: string;
  projectFileId?: string;
}

async function ensureProjectSubfolders(provider: CloudProvider, rootFolderId: string, projectFolderId: string): Promise<ProjectFolderIds> {
  const docs = await provider.ensureFolder(projectFolderId, DOCS_FOLDER_NAME);
  const exports = await provider.ensureFolder(projectFolderId, EXPORTS_FOLDER_NAME);
  const projectFile = await provider.findChildByName(projectFolderId, PROJECT_FILE_NAME);
  return { rootFolderId, projectFolderId, docsFolderId: docs.id, exportsFolderId: exports.id, projectFileId: projectFile?.id };
}

/** Ensures `RetroPlaningStudio/<slug>/docs` (+ `exports`) exists and returns the ids. */
export async function bootstrapProjectFolder(provider: CloudProvider, projectTitle: string): Promise<ProjectFolderIds> {
  const root = await provider.ensureFolder('root', ROOT_FOLDER_NAME);
  const folder = await provider.ensureFolder(root.id, slugify(projectTitle));
  return ensureProjectSubfolders(provider, root.id, folder.id);
}

/** Same as `bootstrapProjectFolder` for a project folder that already exists (see `listCloudProjects`). */
export async function bootstrapExistingFolder(provider: CloudProvider, projectFolderId: string): Promise<ProjectFolderIds> {
  const folder = await provider.getFile(projectFolderId);
  return ensureProjectSubfolders(provider, folder.parentId ?? 'root', projectFolderId);
}

/** Builds a fresh `SyncState` from folder ids (nothing synced yet). */
export function initialSyncState(providerId: CloudProviderId, ids: ProjectFolderIds): SyncState {
  return { providerId, ...ids, files: {} };
}

/** A project folder found in the cloud. */
export interface CloudProjectRef {
  folderId: string;
  name: string;
  projectFileId: string;
}

/** Lists the folders under `RetroPlaningStudio/` that contain a `project.json`. */
export async function listCloudProjects(provider: CloudProvider): Promise<CloudProjectRef[]> {
  const root = await provider.findChildByName('root', ROOT_FOLDER_NAME);
  if (!root || !root.isFolder) return [];
  const children = await provider.listFolder(root.id);
  const refs: CloudProjectRef[] = [];
  for (const folder of children.filter((c) => c.isFolder)) {
    const projectFile = await provider.findChildByName(folder.id, PROJECT_FILE_NAME);
    if (projectFile && !projectFile.isFolder) refs.push({ folderId: folder.id, name: folder.name, projectFileId: projectFile.id });
  }
  return refs;
}

/** What `planSync` needs from the cloud, fetched in one go. */
export interface RemoteSnapshot {
  remoteDocs: CloudFile[];
  remoteProjectFile: CloudFile | null;
}

/** Lists `docs/` and looks up `project.json` for a project. */
export async function fetchRemoteSnapshot(provider: CloudProvider, state: SyncState): Promise<RemoteSnapshot> {
  const [remoteDocs, remoteProjectFile] = await Promise.all([
    provider.listFolder(state.docsFolderId),
    provider.findChildByName(state.projectFolderId, PROJECT_FILE_NAME),
  ]);
  return { remoteDocs, remoteProjectFile };
}

/** Convenience: snapshot → plan → execute. */
export async function syncProject(provider: CloudProvider, project: Project, state: SyncState, hooks: SyncHooks, opts: PlanOptions = {}): Promise<SyncResult> {
  const { remoteDocs, remoteProjectFile } = await fetchRemoteSnapshot(provider, state);
  const plan = planSync(project, remoteDocs, remoteProjectFile, state, opts);
  return executeSync(provider, project, state, plan, hooks);
}
