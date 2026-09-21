import { describe, expect, it } from 'vitest';
import type { Project } from '../types';
import {
  BackupError,
  LEGACY_KEYS,
  MIGRATED_KEY,
  type StorageLike,
  exportAllJson,
  importAllJson,
  importProjectJson,
  keyFor,
  load,
  runStorageSelfTest,
  save,
  stripSecrets,
} from './persistence';

/** Map-backed localStorage stand-in. */
function memoryStorage(seed: Record<string, string> = {}): StorageLike & { map: Map<string, string> } {
  const map = new Map(Object.entries(seed));
  return {
    map,
    getItem: (k) => (map.has(k) ? map.get(k)! : null),
    setItem: (k, v) => void map.set(k, String(v)),
    removeItem: (k) => void map.delete(k),
    key: (i) => Array.from(map.keys())[i] ?? null,
    get length() {
      return map.size;
    },
  };
}

const project: Project = {
  id: 'p1',
  workspaceId: 'ws-1',
  title: 'Sample',
  clientName: 'Client',
  description: '',
  status: 'on-track',
  targetDeliveryDate: '2026-11-20',
  startDate: '2026-09-15',
  phases: [{ id: 'ph1', name: 'Phase', color: '#3B82F6', startDate: '2026-10-01', endDate: '2026-10-31', order: 1, bufferDays: 0, isCriticalPath: false }],
  tasks: [],
  milestones: [],
  documents: [],
  history: [],
  comments: [],
  clarificationQuestions: [],
  retroplanningScore: 100,
  tags: [],
};

describe('save / load roundtrip', () => {
  it('writes every slice under rps_v1_* and reads it back', () => {
    const st = memoryStorage();
    expect(save('projects', [project], st)).toEqual({ ok: true });
    expect(save('ui', { activeProjectId: 'p1', activeViewTab: 'tasks', theme: 'light' }, st)).toEqual({ ok: true });
    expect(save('aiSettings', { providers: [{ id: 'a', providerId: 'gemini', label: 'G', model: 'm', enabled: true, apiKey: 'k' }], defaultProviderId: 'a' }, st)).toEqual({ ok: true });
    expect(Array.from(st.map.keys())).toEqual([keyFor('projects'), keyFor('ui'), keyFor('aiSettings')]);

    const res = load(st);
    expect(res.migrated).toBe(false);
    expect(res.errors).toEqual([]);
    expect(res.state.projects).toEqual([project]);
    expect(res.state.ui).toEqual({ activeProjectId: 'p1', activeViewTab: 'tasks', theme: 'light' });
    expect(res.state.aiSettings?.providers[0].apiKey).toBe('k');
    expect(res.state.workspaces).toBeUndefined();
  });

  it('reports a failed write instead of throwing', () => {
    const st = memoryStorage();
    st.setItem = () => {
      throw new Error('QuotaExceededError: the quota has been exceeded');
    };
    const res = save('projects', [project], st);
    expect(res.ok).toBe(false);
    expect(res.error).toMatch(/quota exceeded/i);
    expect(save('projects', [project], null).ok).toBe(false);
  });

  it('skips a corrupted slice, keeps the others, and reports it', () => {
    const st = memoryStorage({ [keyFor('projects')]: '{not json', [keyFor('teamMembers')]: '{"not":"an array"}', [keyFor('tutorialState')]: '{}' });
    const res = load(st);
    expect(res.state.projects).toBeUndefined();
    expect(res.state.teamMembers).toBeUndefined();
    expect(res.state.tutorialState).toEqual({});
    expect(res.errors).toHaveLength(2);
    expect(res.errors[0]).toContain(keyFor('projects'));
  });
});

describe('migration from retroplan_*_v4_media', () => {
  const legacyProject = { ...project, driveSynced: true, driveFolderId: 'x', driveSyncStatus: 'synced', comments: [{ id: 'c1', authorId: 'u', authorName: 'U', authorAvatar: '', timestamp: 'Just now', content: 'hi', targetType: 'project', targetId: 'p1' }] };
  const seed = () =>
    memoryStorage({
      [LEGACY_KEYS.projects]: JSON.stringify([legacyProject]),
      [LEGACY_KEYS.notifications]: JSON.stringify([{ id: 'n1', title: 'T', message: 'M', timestamp: '10 min ago', type: 'status_update', read: false }]),
      [LEGACY_KEYS.invitations]: JSON.stringify([
        { id: 'inv-1', email: 'seed@example.com', name: 'Seed', role: 'r', permissions: {}, invitedAt: '2026-09-18', invitedBy: 'x', status: 'pending', token: 't' },
        { id: 'inv-2', email: 'real@example.com', name: 'Real', role: 'r', permissions: {}, invitedAt: '2026-09-19', invitedBy: 'x', status: 'pending', token: 't' },
      ]),
      [LEGACY_KEYS.apiSettings]: JSON.stringify({ useCustomKey: true, apiKey: 'AIza-secret', selectedModel: 'gemini-2.5-pro', status: 'connected' }),
      [LEGACY_KEYS.tutorial]: JSON.stringify([{ id: 'tut-1', completed: true }, { id: 'tut-2', completed: false }]),
      [LEGACY_KEYS.theme]: 'light',
    });

  it('runs once, converts the data, and leaves the old keys alone', () => {
    const st = seed();
    const res = load(st);
    expect(res.migrated).toBe(true);
    expect(res.errors).toEqual([]);

    const p = res.state.projects![0] as Project & Record<string, unknown>;
    expect(p.id).toBe('p1');
    expect(p.driveSynced).toBeUndefined();
    expect(p.driveFolderId).toBeUndefined();
    expect(p.comments[0].timestamp).toMatch(/^\d{4}-\d{2}-\d{2}T/);

    expect(res.state.notifications![0].timestamp).toMatch(/^\d{4}-\d{2}-\d{2}T/);
    expect(res.state.invitations!.map((i) => i.id)).toEqual(['inv-2']);
    expect(res.state.aiSettings!.providers[0]).toMatchObject({ providerId: 'gemini', apiKey: 'AIza-secret', model: 'gemini-2.5-pro', enabled: true });
    expect(res.state.aiSettings!.defaultProviderId).toBe(res.state.aiSettings!.providers[0].id);
    // The old step list is deliberately NOT migrated: the tutorial was rebuilt with new step ids.
    expect(res.state.tutorialState).toBeUndefined();
    expect(res.state.ui).toEqual({ theme: 'light' });

    // new keys written, marker set, old keys untouched
    expect(st.getItem(keyFor('projects'))).not.toBeNull();
    expect(st.getItem(MIGRATED_KEY)).toMatch(/^\d{4}-/);
    expect(st.getItem(LEGACY_KEYS.projects)).toBe(JSON.stringify([legacyProject]));

    // second boot: no migration, same data
    const again = load(st);
    expect(again.migrated).toBe(false);
    expect(again.state.projects).toEqual(res.state.projects);
  });

  it('does not migrate when the new namespace already has data', () => {
    const st = seed();
    st.setItem(keyFor('projects'), JSON.stringify([]));
    const res = load(st);
    expect(res.migrated).toBe(false);
    expect(res.state.projects).toEqual([]);
    expect(res.state.notifications).toBeUndefined();
  });

  it('does nothing on a clean install', () => {
    const res = load(memoryStorage());
    expect(res.migrated).toBe(false);
    expect(res.state).toEqual({});
  });
});

describe('backup export / import', () => {
  const full = {
    projects: [project],
    teamMembers: [{ id: 'u1', name: 'U', email: 'u@example.com', avatar: '', role: 'r', color: '#000', status: 'active' as const }],
    aiSettings: { providers: [{ id: 'a', providerId: 'gemini' as const, label: 'G', model: 'm', enabled: true, apiKey: 'SECRET' }], defaultProviderId: 'a' },
    cloudSettings: { google: { clientId: 'cid', clientSecret: 'SECRET2' }, onedrive: { clientId: 'oid' } },
    ui: { theme: 'dark' as const },
  };

  it('roundtrips and strips secrets', () => {
    const text = exportAllJson(full);
    expect(text).not.toContain('SECRET');
    const parsed = JSON.parse(text);
    expect(parsed.format).toBe('rps-backup');
    expect(parsed.version).toBe(1);
    const back = importAllJson(text);
    expect(back.projects).toEqual([project]);
    expect(back.teamMembers).toEqual(full.teamMembers);
    expect(back.aiSettings!.providers[0]).toEqual({ id: 'a', providerId: 'gemini', label: 'G', model: 'm', enabled: true });
    expect(back.cloudSettings).toEqual({ google: { clientId: 'cid' }, onedrive: { clientId: 'oid' } });
    expect(back.ui).toEqual({ theme: 'dark' });
    expect(stripSecrets(full).aiSettings!.providers[0].apiKey).toBeUndefined();
  });

  it.each([
    ['{oops', /Not valid JSON/],
    ['[]', /must be a JSON object/],
    ['{"format":"other","version":1,"data":{}}', /Not a RetroPlaningStudio backup/],
    ['{"format":"rps-backup","version":2,"data":{}}', /Unsupported backup version 2/],
    ['{"format":"rps-backup","version":1,"data":[]}', /"data" must be an object/],
    ['{"format":"rps-backup","version":1,"data":{"projects":{}}}', /"data.projects" must be an array/],
    ['{"format":"rps-backup","version":1,"data":{"ui":[]}}', /"data.ui" must be an object/],
    ['{"format":"rps-backup","version":1,"data":{"projects":[{"title":"no id"}]}}', /data\.projects\[0\].*"\$\.id"/],
    ['{"format":"rps-backup","version":1,"data":{"projects":[{"id":"p","title":"t","tasks":[{"id":"t1"}]}]}}', /tasks\[0\]\.title/],
    ['{"format":"rps-backup","version":1,"data":{"teamMembers":[{"name":"no id"}]}}', /"data.teamMembers\[0\]" must have a string id/],
    ['{"format":"rps-backup","version":1,"data":{"aiSettings":{"providers":"x"}}}', /aiSettings.providers/],
  ])('rejects %s', (text, pattern) => {
    expect(() => importAllJson(text)).toThrow(BackupError);
    expect(() => importAllJson(text)).toThrow(pattern);
  });

  it('importProjectJson accepts a single project export', () => {
    const p = importProjectJson(JSON.stringify(project));
    expect(p.id).toBe('p1');
    expect(() => importProjectJson('{"id":"x"}')).toThrow(/title/);
  });
});

describe('runStorageSelfTest', () => {
  it('probes write/read/remove and measures the namespace', () => {
    const st = memoryStorage({ other_key: 'ignored' });
    save('projects', [project], st);
    const res = runStorageSelfTest(st);
    expect(res.ok).toBe(true);
    expect(res.keyCount).toBe(1);
    expect(res.usedBytes).toBeGreaterThan(0);
    expect(st.getItem('rps_v1_probe')).toBeNull();
  });

  it('reports a broken storage', () => {
    const st = memoryStorage();
    st.setItem = () => {
      throw new Error('nope');
    };
    expect(runStorageSelfTest(st)).toMatchObject({ ok: false, message: expect.stringContaining('nope') });
    expect(runStorageSelfTest(null).ok).toBe(false);
  });
});
