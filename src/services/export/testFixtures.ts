/**
 * Minimal project factory for the export unit tests (not part of the app bundle: only test
 * files import it).
 */
import type { Milestone, Phase, Project, Task } from '../../types';

/** A task with every required field filled; override what the test cares about. */
export function makeTask(overrides: Partial<Task> & { id: string }): Task {
  return {
    projectId: 'p',
    phaseId: 'ph1',
    title: `Task ${overrides.id}`,
    description: '',
    status: 'todo',
    priority: 'medium',
    assigneeId: '',
    startDate: '2026-03-02',
    dueDate: '2026-03-04',
    estimatedHours: 8,
    dependencies: [],
    deliverables: [],
    checklist: [],
    tags: [],
    ...overrides,
  };
}

/** A phase with every required field filled. */
export function makePhase(overrides: Partial<Phase> & { id: string }): Phase {
  return {
    name: `Phase ${overrides.id}`,
    color: '#3B82F6',
    startDate: '2026-03-02',
    endDate: '2026-03-06',
    order: 1,
    bufferDays: 0,
    isCriticalPath: false,
    ...overrides,
  };
}

/** A milestone with every required field filled. */
export function makeMilestone(overrides: Partial<Milestone> & { id: string }): Milestone {
  return {
    title: `Milestone ${overrides.id}`,
    targetDate: '2026-03-06',
    isHardDeadline: true,
    completed: false,
    description: '',
    deliverableCount: 0,
    ...overrides,
  };
}

/** An empty-but-valid project; pass phases/tasks/milestones as needed. */
export function makeProject(overrides: Partial<Project> = {}): Project {
  return {
    id: 'p',
    workspaceId: 'ws',
    title: 'Test project',
    clientName: 'Client',
    description: '',
    status: 'on-track',
    targetDeliveryDate: '2026-03-06',
    startDate: '2026-03-02',
    phases: [],
    tasks: [],
    milestones: [],
    documents: [],
    history: [],
    comments: [],
    clarificationQuestions: [],
    retroplanningScore: 50,
    tags: [],
    ...overrides,
  };
}
