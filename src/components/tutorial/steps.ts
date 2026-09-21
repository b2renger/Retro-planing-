/**
 * The tutorial, as data.
 *
 * Every step points at a REAL element of the app (an existing `id`, or a `data-tour` attribute
 * added to the component) and finishes when the user actually did the thing: `isComplete` compares
 * a snapshot taken when the step opened with the live one. No step is ever completed by a timer.
 *
 * Everything in this file is pure, so `steps.test.ts` can run the predicates against fixtures.
 */
import type { Project, ViewTab } from '../../types';

export type Placement = 'top' | 'bottom' | 'left' | 'right' | 'center';

/** What the app looked like at one moment. Cheap to compute, cheap to compare. */
export interface TutorialSnapshot {
  targetDeliveryDate: string;
  taskCount: number;
  /** `id:start:due` per task — changes when a bar is dragged, resized or re-dated in the editor. */
  taskDates: string;
  /** Everything else about a task that the editor can change. */
  taskFields: string;
  dependencyCount: number;
  documentCount: number;
  /** Title + content length + last-modified stamp per document. */
  documentDigest: string;
  aiProviderCount: number;
}

/** Things that are not in the project: panels the user opened. */
export interface TutorialFlags {
  settingsOpen: boolean;
  cloudPanelOpen: boolean;
  /** Read from the DOM (`#header-export-btn[aria-expanded]`) by the controller. */
  exportMenuOpen: boolean;
}

export interface TutorialContext {
  /** Snapshot taken when the step became current. */
  before: TutorialSnapshot;
  now: TutorialSnapshot;
  flags: TutorialFlags;
}

export const EMPTY_SNAPSHOT: TutorialSnapshot = {
  targetDeliveryDate: '',
  taskCount: 0,
  taskDates: '',
  taskFields: '',
  dependencyCount: 0,
  documentCount: 0,
  documentDigest: '',
  aiProviderCount: 0,
};

export const EMPTY_FLAGS: TutorialFlags = { settingsOpen: false, cloudPanelOpen: false, exportMenuOpen: false };

/** Derives a snapshot from the live project. `null` (no project) gives the empty one. */
export function snapshotProject(project: Project | null, aiProviderCount: number): TutorialSnapshot {
  if (!project) return { ...EMPTY_SNAPSHOT, aiProviderCount };
  const tasks = [...project.tasks].sort((a, b) => a.id.localeCompare(b.id));
  const docs = [...project.documents].sort((a, b) => a.id.localeCompare(b.id));
  return {
    targetDeliveryDate: project.targetDeliveryDate,
    taskCount: tasks.length,
    taskDates: tasks.map((t) => `${t.id}:${t.startDate}:${t.dueDate}`).join('|'),
    taskFields: tasks.map((t) => `${t.id}:${t.title}:${t.status}:${t.priority}:${t.phaseId}:${t.assigneeId}:${t.estimatedHours}`).join('|'),
    dependencyCount: tasks.reduce((n, t) => n + (t.dependencies?.length ?? 0), 0),
    documentCount: docs.length,
    documentDigest: docs.map((d) => `${d.id}:${d.title}:${d.content.length}:${d.lastModified}`).join('|'),
    aiProviderCount,
  };
}

export interface TutorialStepDef {
  id: string;
  title: string;
  /** What the feature is FOR, then which control does it. Two sentences at most. */
  body: string;
  /** The view to switch to, or `null` to stay where the user is (header and navbar controls). */
  tab: ViewTab | null;
  /** CSS selector of the real element to spotlight. Missing element → centred card. */
  anchor: string;
  placement: Placement;
  /** One imperative line: what to do now. */
  task: string;
  /** True when the user did it. Pure over before/after state. */
  isComplete: (ctx: TutorialContext) => boolean;
  /** Steps that need something the user may not have (an API key) can be passed over. */
  optional?: boolean;
}

export const TUTORIAL_STEPS: readonly TutorialStepDef[] = [
  {
    id: 'backward-planning',
    title: 'Plan backwards from the delivery date',
    body: 'The whole plan hangs off one date: the day the work has to be delivered. Open the target-delivery control and pick a new date — it asks whether to move the anchor alone or shift every phase, task and milestone with it.',
    tab: 'retroplanning',
    anchor: '#retroplanning-target-date-input',
    placement: 'bottom',
    task: 'Change the target delivery date and choose one of the two modes.',
    isComplete: ({ before, now }) => now.targetDeliveryDate !== before.targetDeliveryDate,
  },
  {
    id: 'timeline',
    title: 'Read and reschedule on the timeline',
    body: 'The Gantt view shows phases, tasks and milestones on a real day scale, so you can see what overlaps and what slips. Change the zoom, then drag a task bar sideways to give it new dates (the arrow keys nudge it by a day).',
    tab: 'retroplanning',
    anchor: '[data-tour="gantt"]',
    placement: 'top',
    task: 'Drag a task bar to different dates.',
    isComplete: ({ before, now }) => now.taskDates !== before.taskDates,
  },
  {
    id: 'dependencies',
    title: 'Dependencies and the critical path',
    body: 'Saying which task waits for which turns a list into a schedule: the critical path is then computed from those links, not typed in by hand. Click a task bar to open it and tick a task it depends on.',
    tab: 'retroplanning',
    anchor: '[data-tour="task-dependencies"]',
    placement: 'left',
    task: 'Open a task and add a dependency under "Depends on".',
    isComplete: ({ before, now }) => now.dependencyCount > before.dependencyCount,
  },
  {
    id: 'tasks',
    title: 'Tasks and deliverables',
    body: 'The task board is the same data as the timeline, grouped by status instead of by date, which is the better view when you are working rather than planning. Add a task, or open one and change its status.',
    tab: 'tasks',
    anchor: '[data-tour="new-task"]',
    placement: 'bottom',
    task: 'Add a task, or change an existing one.',
    isComplete: ({ before, now }) => now.taskCount !== before.taskCount || now.taskFields !== before.taskFields,
  },
  {
    id: 'documents',
    title: 'Notes and briefs in Markdown',
    body: 'Briefs, technical notes and meeting minutes live with the project as Markdown documents, and they travel with every export and cloud sync. Create a document, or type into one and save it.',
    tab: 'markdown',
    anchor: '[data-tour="new-document"]',
    placement: 'right',
    task: 'Create a document, or edit one and save.',
    isComplete: ({ before, now }) => now.documentCount !== before.documentCount || now.documentDigest !== before.documentDigest,
  },
  {
    id: 'ai',
    title: 'AI, if you want it',
    body: 'An AI provider lets the app turn a brief into a proposed schedule and analyse dependencies; it works with a cloud provider (OpenAI, Anthropic, Gemini, Mistral) or with a model running on your own network through LlmOnLan. Without one the app falls back to a local heuristic planner, so you can skip this step and lose nothing.',
    tab: null,
    anchor: '[data-tour="ai-settings"]',
    placement: 'bottom',
    task: 'Open Settings and add a provider — or skip this step.',
    isComplete: ({ before, now }) => now.aiProviderCount > before.aiProviderCount,
    optional: true,
  },
  {
    id: 'cloud',
    title: 'Cloud folder',
    body: 'Linking a project to a Google Drive or OneDrive folder keeps its documents and exports in a place your collaborators can read, on your account and nobody else’s. Open the cloud panel to see what linking would do — nothing is connected for you here.',
    tab: null,
    anchor: '#header-drive-folder-btn',
    placement: 'bottom',
    task: 'Open the cloud panel.',
    isComplete: ({ flags }) => flags.cloudPanelOpen,
  },
  {
    id: 'export',
    title: 'Export the plan',
    body: 'A plan is only useful when the people who are not in this app can read it, so the whole project goes out as a spreadsheet, Markdown, a Gantt image or JSON. Open the export menu and pick a format.',
    tab: null,
    anchor: '#header-export-btn',
    placement: 'bottom',
    task: 'Open the export menu.',
    isComplete: ({ flags }) => flags.exportMenuOpen,
  },
];

export const FIRST_STEP_ID = TUTORIAL_STEPS[0].id;

export function stepIndex(stepId: string | null): number {
  const i = TUTORIAL_STEPS.findIndex((s) => s.id === stepId);
  return i === -1 ? 0 : i;
}

export function stepById(stepId: string | null): TutorialStepDef {
  return TUTORIAL_STEPS[stepIndex(stepId)];
}
