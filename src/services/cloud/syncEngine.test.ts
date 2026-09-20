import { describe, expect, it, vi } from 'vitest';
import { MemoryCloudProvider } from './memoryProvider';
import { bootstrapProjectFolder, executeSync, fetchRemoteSnapshot, initialSyncState, listCloudProjects, planSync, syncProject, type SyncHooks, type SyncState } from './syncEngine';
import { parseDoc, serializeDoc, serializeProject } from './layout';
import { CloudError } from './types';
import { makeDoc, makeFile, makeProject } from './testFixtures';

const T0 = '2024-01-01T10:00:00.000Z';
const T1 = '2024-01-02T10:00:00.000Z';
const T2 = '2024-01-03T10:00:00.000Z';
const R0 = '2024-01-01T12:00:00.000Z';
const R1 = '2024-01-02T12:00:00.000Z';

function baseState(over: Partial<SyncState> = {}): SyncState {
  return { providerId: 'google', rootFolderId: 'root-id', projectFolderId: 'proj-id', docsFolderId: 'docs-id', files: {}, ...over };
}

const synced = (over: Partial<SyncState> = {}): SyncState =>
  baseState({
    lastSyncAt: T0,
    projectFileId: 'pj',
    projectRemoteModified: R0,
    projectLocalModified: T0,
    files: { 'doc-1': { fileId: 'f1', remoteModified: R0, localModified: T0 } },
    ...over,
  });

const remoteBrief = (modifiedTime = R0) => makeFile({ id: 'f1', name: 'Brief.md', modifiedTime });
const remoteProject = (modifiedTime = R0) => makeFile({ id: 'pj', name: 'project.json', modifiedTime });

describe('planSync', () => {
  it('first sync with an empty remote uploads everything', () => {
    const project = makeProject({ documents: [makeDoc(), makeDoc({ id: 'doc-2', title: 'Brief' })] });
    const plan = planSync(project, [], null, baseState(), { lastLocalChange: T0 });
    expect(plan).toEqual([
      { type: 'upload-doc', docId: 'doc-1', name: 'Brief.md' },
      { type: 'upload-doc', docId: 'doc-2', name: 'Brief (2).md' },
      { type: 'upload-project', localModified: T0 },
    ]);
  });

  it('first sync against an existing remote project downloads everything (remote is the source of truth)', () => {
    const plan = planSync(makeProject(), [remoteBrief(), makeFile({ id: 'g1', name: 'Doc', mimeType: 'application/vnd.google-apps.document' }), makeFile({ id: 'img', name: 'photo.png' })], remoteProject(), baseState());
    expect(plan).toEqual([
      { type: 'download-doc', fileId: 'f1', name: 'Brief.md', remoteModified: R0 },
      { type: 'download-doc', fileId: 'g1', name: 'Doc', remoteModified: R0 },
      { type: 'download-project', fileId: 'pj', remoteModified: R0, localModified: undefined },
    ]);
  });

  it('is a no-op when nothing changed', () => {
    expect(planSync(makeProject(), [remoteBrief()], remoteProject(), synced(), { lastLocalChange: T0 })).toEqual([]);
  });

  it('uploads a locally modified doc onto its existing file', () => {
    const project = makeProject({ documents: [makeDoc({ lastModified: T1 })] });
    expect(planSync(project, [remoteBrief()], remoteProject(), synced(), { lastLocalChange: T0 })).toEqual([{ type: 'upload-doc', docId: 'doc-1', name: 'Brief.md', fileId: 'f1' }]);
  });

  it('downloads a remotely modified doc', () => {
    expect(planSync(makeProject(), [remoteBrief(R1)], remoteProject(), synced(), { lastLocalChange: T0 })).toEqual([{ type: 'download-doc', fileId: 'f1', name: 'Brief.md', remoteModified: R1, docId: 'doc-1' }]);
  });

  it('flags a conflict when both sides changed', () => {
    const project = makeProject({ documents: [makeDoc({ lastModified: T1 })] });
    expect(planSync(project, [remoteBrief(R1)], remoteProject(), synced(), { lastLocalChange: T0 })).toEqual([{ type: 'conflict', docId: 'doc-1', fileId: 'f1', name: 'Brief.md', remoteModified: R1 }]);
  });

  it('downloads a brand-new remote file without a docId', () => {
    const plan = planSync(makeProject(), [remoteBrief(), makeFile({ id: 'f9', name: 'Notes.md', modifiedTime: R1 })], remoteProject(), synced(), { lastLocalChange: T0 });
    expect(plan).toEqual([{ type: 'download-doc', fileId: 'f9', name: 'Notes.md', remoteModified: R1 }]);
  });

  it('uploads a brand-new local doc avoiding remote name collisions', () => {
    const project = makeProject({ documents: [makeDoc(), makeDoc({ id: 'doc-2', title: 'brief' })] });
    expect(planSync(project, [remoteBrief()], remoteProject(), synced(), { lastLocalChange: T0 })).toEqual([{ type: 'upload-doc', docId: 'doc-2', name: 'brief (2).md' }]);
  });

  it('removes the local doc when the remote file disappeared and the local copy is untouched', () => {
    expect(planSync(makeProject(), [], remoteProject(), synced(), { lastLocalChange: T0 })).toEqual([{ type: 'delete-local-doc', docId: 'doc-1' }]);
  });

  it('re-uploads (as a new file) when the remote file disappeared but the local copy changed', () => {
    const project = makeProject({ documents: [makeDoc({ lastModified: T1 })] });
    expect(planSync(project, [], remoteProject(), synced(), { lastLocalChange: T0 })).toEqual([{ type: 'upload-doc', docId: 'doc-1', name: 'Brief.md' }]);
  });

  it('deletes the remote file when the doc was deleted locally', () => {
    const project = makeProject({ documents: [] });
    expect(planSync(project, [remoteBrief()], remoteProject(), synced({ deletedDocIds: ['doc-1'] }), { lastLocalChange: T0 })).toEqual([{ type: 'delete-remote', fileId: 'f1', docId: 'doc-1' }]);
  });

  it('resurrects a locally deleted doc when the remote file changed since', () => {
    const project = makeProject({ documents: [] });
    expect(planSync(project, [remoteBrief(R1)], remoteProject(), synced(), { lastLocalChange: T0 })).toEqual([{ type: 'download-doc', fileId: 'f1', name: 'Brief.md', remoteModified: R1, docId: 'doc-1' }]);
  });

  it('uploads project.json when it went missing remotely', () => {
    expect(planSync(makeProject(), [remoteBrief()], null, synced(), { lastLocalChange: T0 })).toEqual([{ type: 'upload-project', localModified: T0 }]);
  });

  it('uploads project.json after a local project change', () => {
    expect(planSync(makeProject(), [remoteBrief()], remoteProject(), synced(), { lastLocalChange: T1 })).toEqual([{ type: 'upload-project', fileId: 'pj', localModified: T1 }]);
  });

  it('downloads project.json after a remote change', () => {
    expect(planSync(makeProject(), [remoteBrief()], remoteProject(R1), synced(), { lastLocalChange: T0 })).toEqual([{ type: 'download-project', fileId: 'pj', remoteModified: R1, localModified: T0 }]);
  });

  it('flags a project conflict when both changed', () => {
    expect(planSync(makeProject(), [remoteBrief()], remoteProject(R1), synced(), { lastLocalChange: T2 })).toEqual([{ type: 'conflict-project', fileId: 'pj', remoteModified: R1, localModified: T2 }]);
  });

  it('never uploads project.json when the local change time is unknown and the remote exists', () => {
    expect(planSync(makeProject(), [remoteBrief()], remoteProject(), synced())).toEqual([]);
  });

  it('compares timestamps as instants, not strings', () => {
    // Same instant written without milliseconds must not count as a change.
    expect(planSync(makeProject(), [remoteBrief('2024-01-01T12:00:00Z')], remoteProject('2024-01-01T12:00:00Z'), synced(), { lastLocalChange: T0 })).toEqual([]);
  });
});

// ---------------------------------------------------------------------------

function hooks() {
  const applied: Array<Parameters<SyncHooks['applyLocalChanges']>[0]> = [];
  const notices: Array<[string, string]> = [];
  const h: SyncHooks = {
    applyLocalChanges: (patch) => {
      applied.push(patch);
    },
    notify: (message, level) => {
      notices.push([message, level]);
    },
  };
  return { h, applied, notices };
}

async function freshCloud() {
  const provider = new MemoryCloudProvider();
  const ids = await bootstrapProjectFolder(provider, 'Museum Show');
  return { provider, ids, state: initialSyncState('google', ids) };
}

describe('bootstrapProjectFolder / listCloudProjects', () => {
  it('creates RetroPlaningStudio/<slug>/docs and exports, idempotently', async () => {
    const { provider, ids } = await freshCloud();
    const root = provider.childrenOf('root');
    expect(root.map((f) => f.name)).toEqual(['RetroPlaningStudio']);
    const projectFolder = provider.childrenOf(root[0].id);
    expect(projectFolder.map((f) => f.name)).toEqual(['Museum Show']);
    expect(provider.childrenOf(projectFolder[0].id).map((f) => f.name).sort()).toEqual(['docs', 'exports']);
    expect(ids).toMatchObject({ rootFolderId: root[0].id, projectFolderId: projectFolder[0].id, projectFileId: undefined });
    const again = await bootstrapProjectFolder(provider, 'Museum Show');
    expect(again).toEqual(ids);
  });

  it('lists only folders that contain a project.json', async () => {
    const provider = new MemoryCloudProvider();
    expect(await listCloudProjects(provider)).toEqual([]);
    const root = provider.mkdir('root', 'RetroPlaningStudio');
    const a = provider.mkdir(root.id, 'Alpha');
    provider.mkdir(root.id, 'Empty');
    provider.put(root.id, 'stray.txt', 'x');
    const pj = provider.put(a.id, 'project.json', serializeProject(makeProject({ title: 'Alpha' })));
    expect(await listCloudProjects(provider)).toEqual([{ folderId: a.id, name: 'Alpha', projectFileId: pj.id }]);
  });
});

describe('executeSync (in-memory provider)', () => {
  it('uploads docs with frontmatter and project.json on first sync, then settles', async () => {
    const { provider, state, ids } = await freshCloud();
    const project = makeProject({ documents: [makeDoc(), makeDoc({ id: 'doc-2', title: 'Plan', content: 'plan', tags: [] })] });
    const { h, applied } = hooks();
    const result = await syncProject(provider, project, state, h, { lastLocalChange: T0 });
    expect(result.summary).toEqual({ uploaded: 3, downloaded: 0, conflicts: 0, deleted: 0 });
    expect(result.errors).toEqual([]);
    const docFiles = provider.childrenOf(ids.docsFolderId);
    expect(docFiles.map((f) => f.name).sort()).toEqual(['Brief.md', 'Plan.md']);
    const brief = docFiles.find((f) => f.name === 'Brief.md')!;
    expect(provider.contentOf(brief.id)).toBe(serializeDoc(makeDoc()));
    const projectJson = provider.childrenOf(ids.projectFolderId).find((f) => f.name === 'project.json')!;
    expect(String(provider.contentOf(projectJson.id))).not.toContain('Hello.');
    expect(result.state.files['doc-1']).toEqual({ fileId: brief.id, remoteModified: brief.modifiedTime, localModified: T0 });
    expect(result.state.projectFileId).toBe(projectJson.id);
    expect(result.state.lastSyncAt).toBeDefined();
    expect(applied).toHaveLength(1);
    expect(applied[0].documents).toHaveLength(2);
    expect(applied[0].project).toBeUndefined();

    // Second sync: nothing to do.
    const second = await syncProject(provider, result.project, result.state, h, { lastLocalChange: T0 });
    expect(second.summary).toEqual({ uploaded: 0, downloaded: 0, conflicts: 0, deleted: 0 });
  });

  it('imports a file the user created in the cloud folder and assigns a stable id', async () => {
    const { provider, state, ids } = await freshCloud();
    const { h } = hooks();
    const first = await syncProject(provider, makeProject(), state, h, { lastLocalChange: T0 });
    const created = provider.put(ids.docsFolderId, 'Meeting notes.md', '# Meeting\n\nfrom drive');
    const second = await syncProject(provider, first.project, first.state, h, { lastLocalChange: T0 });
    expect(second.summary.downloaded).toBe(1);
    const imported = second.project.documents.find((d) => d.title === 'Meeting notes')!;
    expect(imported).toMatchObject({ content: '# Meeting\n\nfrom drive', tags: [], path: 'docs/Meeting notes.md', lastModifiedBy: 'cloud', lastModified: created.modifiedTime });
    expect(imported.id).toMatch(/^doc-[0-9a-f]{8}$/);
    expect(second.state.files[imported.id].fileId).toBe(created.id);
    // Stable across syncs.
    const third = await syncProject(provider, second.project, second.state, h, { lastLocalChange: T0 });
    expect(third.summary).toEqual({ uploaded: 0, downloaded: 0, conflicts: 0, deleted: 0 });
  });

  it('pushes a local edit and pulls a remote edit', async () => {
    const { provider, state } = await freshCloud();
    const { h } = hooks();
    const first = await syncProject(provider, makeProject(), state, h, { lastLocalChange: T0 });
    const fileId = first.state.files['doc-1'].fileId;

    const edited = { ...first.project, documents: [{ ...first.project.documents[0], content: 'local v2', lastModified: T1 }] };
    const second = await syncProject(provider, edited, first.state, h, { lastLocalChange: T0 });
    expect(second.summary.uploaded).toBe(1);
    expect(parseDoc('Brief.md', String(provider.contentOf(fileId))).content).toBe('local v2');
    expect(provider.calls.filter((c) => c.method === 'writeText').at(-1)?.args[0]).toMatchObject({ existingFileId: fileId });

    provider.put(state.docsFolderId, 'Brief.md', serializeDoc({ id: 'doc-1', title: 'Brief renamed', tags: ['x'], content: 'remote v3' }));
    const third = await syncProject(provider, second.project, second.state, h, { lastLocalChange: T0 });
    expect(third.summary.downloaded).toBe(1);
    expect(third.project.documents[0]).toMatchObject({ id: 'doc-1', title: 'Brief renamed', tags: ['x'], content: 'remote v3' });
  });

  it('keeps both versions on a conflict', async () => {
    const { provider, state } = await freshCloud();
    const { h, notices } = hooks();
    const first = await syncProject(provider, makeProject(), state, h, { lastLocalChange: T0 });
    provider.put(state.docsFolderId, 'Brief.md', serializeDoc({ id: 'doc-1', title: 'Brief', tags: [], content: 'remote change' }));
    const edited = { ...first.project, documents: [{ ...first.project.documents[0], content: 'local change', lastModified: T1 }] };
    const second = await syncProject(provider, edited, first.state, h, { lastLocalChange: T0 });
    expect(second.summary.conflicts).toBe(1);
    expect(second.project.documents.map((d) => d.title)).toEqual(['Brief', 'Brief (conflict from cloud)']);
    expect(second.project.documents[1].content).toBe('remote change');
    expect(parseDoc('Brief.md', String(provider.contentOf(first.state.files['doc-1'].fileId))).content).toBe('local change');
    expect(notices.some(([, level]) => level === 'warning')).toBe(true);
    // The conflict copy is a new local doc: the next sync uploads it.
    const third = await syncProject(provider, second.project, second.state, h, { lastLocalChange: T0 });
    expect(third.summary.uploaded).toBe(1);
    expect(provider.childrenOf(state.docsFolderId).map((f) => f.name).sort()).toEqual(['Brief (conflict from cloud).md', 'Brief.md']);
  });

  it('propagates deletions both ways', async () => {
    const { provider, state } = await freshCloud();
    const { h } = hooks();
    const project = makeProject({ documents: [makeDoc(), makeDoc({ id: 'doc-2', title: 'Plan' })] });
    const first = await syncProject(provider, project, state, h, { lastLocalChange: T0 });

    // Local deletion of doc-1, remote deletion of doc-2.
    await provider.deleteFile(first.state.files['doc-2'].fileId);
    const local = { ...first.project, documents: first.project.documents.filter((d) => d.id === 'doc-2') };
    const stateWithDeleted = { ...first.state, deletedDocIds: ['doc-1'] };
    const second = await syncProject(provider, local, stateWithDeleted, h, { lastLocalChange: T0 });
    expect(second.summary.deleted).toBe(2);
    expect(second.project.documents).toEqual([]);
    expect(provider.childrenOf(state.docsFolderId)).toEqual([]);
    expect(second.state.files).toEqual({});
    expect(second.state.deletedDocIds).toEqual([]);
  });

  it('applies a remote project.json change while keeping local documents', async () => {
    const { provider, state } = await freshCloud();
    const { h, applied } = hooks();
    const first = await syncProject(provider, makeProject(), state, h, { lastLocalChange: T0 });
    const remote = makeProject({ id: 'other-id', title: 'Renamed in cloud', status: 'at-risk', documents: [] });
    provider.put(state.projectFolderId, 'project.json', serializeProject(remote));
    const second = await syncProject(provider, first.project, first.state, h, { lastLocalChange: T0 });
    expect(second.summary.downloaded).toBe(1);
    expect(second.project).toMatchObject({ id: 'proj-1', title: 'Renamed in cloud', status: 'at-risk' });
    expect(second.project.documents).toHaveLength(1);
    expect(applied.at(-1)?.project).toMatchObject({ title: 'Renamed in cloud' });
    expect(applied.at(-1)?.project).not.toHaveProperty('documents');
  });

  it('opens a project that only exists in the cloud', async () => {
    const provider = new MemoryCloudProvider();
    const root = provider.mkdir('root', 'RetroPlaningStudio');
    const folder = provider.mkdir(root.id, 'Cloud Born');
    const docs = provider.mkdir(folder.id, 'docs');
    provider.put(folder.id, 'project.json', serializeProject(makeProject({ title: 'Cloud Born', documents: [] })));
    provider.put(docs.id, 'Readme.md', 'hello');
    const ids = await bootstrapProjectFolder(provider, 'Cloud Born');
    expect(ids.projectFileId).toBeDefined();
    const { h } = hooks();
    const empty = makeProject({ id: 'local-new', title: 'placeholder', documents: [] });
    const result = await syncProject(provider, empty, initialSyncState('google', ids), h);
    expect(result.summary).toEqual({ uploaded: 0, downloaded: 2, conflicts: 0, deleted: 0 });
    expect(result.project.title).toBe('Cloud Born');
    expect(result.project.documents).toEqual([expect.objectContaining({ title: 'Readme', content: 'hello' })]);
  });

  it('continues after individual failures and reports them', async () => {
    const { provider, state } = await freshCloud();
    const { h, notices } = hooks();
    const project = makeProject({ documents: [makeDoc(), makeDoc({ id: 'doc-2', title: 'Plan' })] });
    provider.failNext('writeText', new CloudError('quota', 'Drive is full'));
    const snapshot = await fetchRemoteSnapshot(provider, state);
    const plan = planSync(project, snapshot.remoteDocs, snapshot.remoteProjectFile, state, { lastLocalChange: T0 });
    const result = await executeSync(provider, project, state, plan, h);
    expect(result.summary.uploaded).toBe(2);
    expect(result.errors).toHaveLength(1);
    expect(result.errors[0]).toMatchObject({ action: { type: 'upload-doc', docId: 'doc-1' }, message: 'Drive is full' });
    expect(notices).toContainEqual(['Could not upload "Brief.md": Drive is full', 'error']);
    expect(result.state.files['doc-1']).toBeUndefined();
    expect(result.state.files['doc-2']).toBeDefined();
    // The failed doc is retried on the next sync.
    const retry = await syncProject(provider, result.project, result.state, h, { lastLocalChange: T0 });
    expect(retry.summary.uploaded).toBe(1);
    expect(retry.state.files['doc-1']).toBeDefined();
  });

  it('runs project actions after document actions so the index is complete', async () => {
    const { provider, state } = await freshCloud();
    const { h } = hooks();
    const plan = planSync(makeProject(), [], null, state, { lastLocalChange: T0 });
    const reversed = [...plan].reverse();
    await executeSync(provider, makeProject(), state, reversed, h);
    const methods = provider.calls.filter((c) => c.method === 'writeText').map((c) => (c.args[0] as { name: string }).name);
    expect(methods).toEqual(['Brief.md', 'project.json']);
  });

  it('awaits async applyLocalChanges hooks', async () => {
    const { provider, state } = await freshCloud();
    const apply = vi.fn().mockResolvedValue(undefined);
    await syncProject(provider, makeProject(), state, { applyLocalChanges: apply, notify: () => {} }, { lastLocalChange: T0 });
    expect(apply).toHaveBeenCalledTimes(1);
  });
});
