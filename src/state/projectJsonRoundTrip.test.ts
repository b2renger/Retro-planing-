/**
 * The Export menu's "Project JSON" entry and the empty state's "Import JSON" button must be two
 * ends of the same pipe. This exercises the real app path — `projectToJson` → `importProjectJson`
 * → the `project/restore` reducer action — rather than the serialiser alone.
 */
import { describe, expect, it } from 'vitest';
import { MEDIA_INSTALLATION_PROJECT } from '../data/mockData';
import { projectToJson } from '../services/export/json';
import { importProjectJson } from './persistence';
import { projectsActions, projectsReducer } from './projectsReducer';

const ACTOR = { id: 'user-1', name: 'Tester', avatar: '' };
const AT = '2026-01-01T00:00:00.000Z';

function reimport(text: string, existing = [] as ReturnType<typeof importProjectJson>[]) {
  const parsed = importProjectJson(text);
  const next = projectsReducer(existing, projectsActions.restoreProject({ projectId: parsed.id, actor: ACTOR, at: AT }, parsed));
  return { parsed, project: next.find((p) => p.id === parsed.id)!, projects: next };
}

describe('project JSON export → import round trip', () => {
  it('parses back to exactly what was exported', () => {
    expect(importProjectJson(projectToJson(MEDIA_INSTALLATION_PROJECT))).toEqual(MEDIA_INSTALLATION_PROJECT);
  });

  it('restores the project into the store with every collection intact', () => {
    const { project } = reimport(projectToJson(MEDIA_INSTALLATION_PROJECT));
    const source = MEDIA_INSTALLATION_PROJECT;
    expect(project.id).toBe(source.id);
    expect(project.title).toBe(source.title);
    expect(project.targetDeliveryDate).toBe(source.targetDeliveryDate);
    expect(project.tasks).toEqual(source.tasks);
    expect(project.phases).toEqual(source.phases);
    expect(project.milestones).toEqual(source.milestones);
    expect(project.documents).toEqual(source.documents);
    expect(project.history).toEqual(source.history);
    expect(project.comments).toEqual(source.comments);
    expect(project.clarificationQuestions).toEqual(source.clarificationQuestions);
    expect(project.tags).toEqual(source.tags);
    // `retroplanningScore` is derived, so the reducer recomputes it instead of trusting the file.
    expect(project.retroplanningScore).toBeGreaterThanOrEqual(0);
    expect(project.retroplanningScore).toBeLessThanOrEqual(100);
  });

  it('survives a second export of the imported project', () => {
    const once = reimport(projectToJson(MEDIA_INSTALLATION_PROJECT)).project;
    const twice = reimport(projectToJson(once)).project;
    expect(twice).toEqual(once);
  });

  it('replaces a project with the same id rather than duplicating it', () => {
    const first = reimport(projectToJson(MEDIA_INSTALLATION_PROJECT));
    const edited = { ...MEDIA_INSTALLATION_PROJECT, title: 'Renamed installation' };
    const second = reimport(projectToJson(edited), first.projects);
    expect(second.projects).toHaveLength(1);
    expect(second.project.title).toBe('Renamed installation');
  });

  it('drops the cloud link on import, so a shared export cannot point at someone else’s folder', () => {
    const linked = {
      ...MEDIA_INSTALLATION_PROJECT,
      cloud: {
        providerId: 'google' as const,
        folderId: 'folder-1',
        docsFolderId: 'docs-1',
        syncState: { providerId: 'google' as const, rootFolderId: 'r', projectFolderId: 'folder-1', docsFolderId: 'docs-1', files: {} },
      },
    };
    const text = projectToJson(linked);
    expect(JSON.parse(text).cloud.folderId).toBe('folder-1');
    const back = importProjectJson(text);
    expect(back.cloud).toBeUndefined();
    expect(back.documents.map((d) => d.id)).toEqual(MEDIA_INSTALLATION_PROJECT.documents.map((d) => d.id));
  });
});
