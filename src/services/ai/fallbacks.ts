import { addDays, format, isValid, parseISO, subDays } from 'date-fns';
import type { Task } from '../../types';
import type { CrunchResult, DependencyAnalysisResult } from './types';

/** Label every fallback carries so the UI can never mistake it for AI output. */
export const LOCAL_HEURISTIC_LABEL = 'Local heuristic (no AI provider configured)';
const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
const PHASE_LENGTH_DAYS = 21;

/** True for a well-formed, valid `YYYY-MM-DD` string. */
export function isIsoDate(value: unknown): value is string {
  return typeof value === 'string' && DATE_RE.test(value) && isValid(parseISO(value));
}

/** Resolve the target date: the given ISO date when valid, otherwise 60 days from today. */
export function resolveTargetDate(targetDate?: string): string {
  return isIsoDate(targetDate) ? targetDate : format(addDays(new Date(), 60), 'yyyy-MM-dd');
}

interface PhaseWindow {
  startDate: string;
  endDate: string;
}

/**
 * Three ~3-week phases scheduled backward from the target: phase 3 ends on the target, phase 2 ends
 * 26 days before, phase 1 ends 47 days before.
 */
export function backwardPhaseWindows(targetDate: string): [PhaseWindow, PhaseWindow, PhaseWindow] {
  const target = parseISO(targetDate);
  const end3 = target;
  const end2 = subDays(target, 26);
  const end1 = subDays(target, 47);
  const d = (x: Date) => format(x, 'yyyy-MM-dd');
  return [
    { startDate: d(subDays(end1, PHASE_LENGTH_DAYS - 1)), endDate: d(end1) },
    { startDate: d(addDays(end1, 1)), endDate: d(end2) },
    { startDate: d(addDays(end2, 1)), endDate: d(end3) },
  ];
}

const BULLET_RE = /^\s*[-*]\s*(\[[ xX]\]\s*)?/;

function extractTasks(text: string, windows: PhaseWindow[], projectName: string): Task[] {
  const lines = (text || '').split('\n').filter((l) => l.trim().length > 0);
  const tasks: Task[] = [];
  lines.forEach((line, idx) => {
    if (!BULLET_RE.test(line)) return;
    const isDone = /\[[xX]\]/.test(line);
    const title = line.replace(BULLET_RE, '').trim();
    if (title.length <= 3) return;
    const n = tasks.length;
    const phaseIdx = n % 3;
    const win = windows[phaseIdx];
    tasks.push({
      id: `task-gen-${n + 1}`,
      projectId: '',
      phaseId: `phase-${phaseIdx + 1}`,
      title,
      description: `Extracted from the notes for ${projectName} (line ${idx + 1}).`,
      status: isDone ? 'done' : 'todo',
      priority: phaseIdx === 2 ? 'high' : 'medium',
      assigneeId: `user-${(n % 4) + 1}`,
      startDate: win.startDate,
      dueDate: win.endDate,
      estimatedHours: 8,
      dependencies: n > 0 ? [`task-gen-${n}`] : [],
      deliverables: [],
      checklist: [],
      tags: ['Extracted'],
      isCriticalPath: phaseIdx === 2,
    });
  });
  return tasks;
}

function defaultTasks(windows: PhaseWindow[]): Task[] {
  const base = { projectId: '', deliverables: [], checklist: [], tags: ['Template'] as string[] };
  return [
    {
      ...base,
      id: 'task-gen-1',
      phaseId: 'phase-1',
      title: 'Discovery, brief and technical constraints',
      description: 'Clarify scope, venue or platform constraints, and the deliverables list.',
      status: 'todo',
      priority: 'high',
      assigneeId: 'user-1',
      startDate: windows[0].startDate,
      dueDate: windows[0].endDate,
      estimatedHours: 16,
      dependencies: [],
      isCriticalPath: true,
    },
    {
      ...base,
      id: 'task-gen-2',
      phaseId: 'phase-2',
      title: 'Design, prototyping and content production',
      description: 'Produce the design system, media assets and interactive prototypes.',
      status: 'todo',
      priority: 'high',
      assigneeId: 'user-2',
      startDate: windows[1].startDate,
      dueDate: windows[1].endDate,
      estimatedHours: 40,
      dependencies: ['task-gen-1'],
      isCriticalPath: true,
    },
    {
      ...base,
      id: 'task-gen-3',
      phaseId: 'phase-3',
      title: 'Integration, QA and delivery',
      description: 'Install, test on the target hardware, fix, and hand over.',
      status: 'todo',
      priority: 'urgent',
      assigneeId: 'user-3',
      startDate: windows[2].startDate,
      dueDate: windows[2].endDate,
      estimatedHours: 32,
      dependencies: ['task-gen-2'],
      isCriticalPath: true,
    },
  ];
}

/**
 * Structure raw notes into a CrunchResult without any AI: bullet/checklist lines become tasks
 * spread over three phases scheduled backward from `targetDate`.
 */
export function generateSmartFallbackStructure(text: string, targetDate?: string, projectName = 'Project'): CrunchResult {
  const target = resolveTargetDate(targetDate);
  const windows = backwardPhaseWindows(target);
  const extracted = extractTasks(text, windows, projectName);
  const tasks = extracted.length ? extracted : defaultTasks(windows);
  const names = ['1. Discovery & Brief', '2. Design & Production', '3. Integration, QA & Delivery'];
  const colors = ['#3B82F6', '#8B5CF6', '#10B981'];

  return {
    projectTitle: projectName,
    summary: `${LOCAL_HEURISTIC_LABEL}: ${tasks.length} task(s) ${extracted.length ? 'extracted from the notes' : 'created as a starting template'} and spread over 3 phases scheduled backward from ${target}. Review every date before relying on it.`,
    retroplanningScore: 50,
    targetDeliveryDate: target,
    phases: windows.map((w, i) => ({
      id: `phase-${i + 1}`,
      name: names[i],
      color: colors[i],
      startDate: w.startDate,
      endDate: w.endDate,
      order: i + 1,
      bufferDays: 0,
      isCriticalPath: true,
    })),
    milestones: [
      { id: 'ms-1', title: 'Brief validated', targetDate: windows[0].endDate, isHardDeadline: false, completed: false, deliverableCount: 0, description: 'Scope and constraints agreed with the client.' },
      { id: 'ms-2', title: 'Design & content frozen', targetDate: windows[1].endDate, isHardDeadline: false, completed: false, deliverableCount: 0, description: 'No new design or media after this point.' },
      { id: 'ms-3', title: 'Delivery', targetDate: target, isHardDeadline: true, completed: false, deliverableCount: tasks.length, description: 'Target delivery date.' },
    ],
    tasks,
    clarificationQuestions: [
      {
        id: 'q-fallback-1',
        question: 'Which dates in the notes are hard deadlines (venue, client review, press)?',
        reason: 'Without an AI provider the phases were spread evenly; hard dates should anchor them instead.',
        suggestedOptions: ['Only the delivery date', 'Client reviews are fixed too', 'Add dates to the notes'],
        resolved: false,
      },
    ],
    structuredMarkdown: `# ${projectName}\n\nTarget delivery: \`${target}\`\n\n> ${LOCAL_HEURISTIC_LABEL}\n\n## Tasks\n${tasks
      .map((t) => `- [${t.status === 'done' ? 'x' : ' '}] **${t.title}** (${t.startDate} → ${t.dueDate}, ${t.estimatedHours}h)`)
      .join('\n')}\n`,
  };
}

/** Dependency analysis without AI: consecutive tasks are chained, nothing is invented about buffers. */
export function generateFallbackAnalysis(tasks: Task[] = [], targetDeliveryDate?: string): DependencyAnalysisResult {
  const target = resolveTargetDate(targetDeliveryDate);
  const ordered = [...tasks].sort((a, b) => (a.dueDate || '').localeCompare(b.dueDate || ''));
  const late = ordered.filter((t) => isIsoDate(t.dueDate) && t.dueDate > target);
  const orphans = ordered.filter((t, i) => i > 0 && (!t.dependencies || t.dependencies.length === 0));

  return {
    criticalPathTaskIds: ordered.filter((t) => t.isCriticalPath).map((t) => t.id),
    bottlenecks: late.map((t) => ({
      taskId: t.id,
      issue: `Due ${t.dueDate}, after the target delivery ${target}.`,
      recommendation: 'Move the due date before the target or split the task.',
      severity: 'high' as const,
    })),
    dependencySuggestions: orphans.map((t) => ({
      sourceTaskId: ordered[ordered.indexOf(t) - 1].id,
      targetTaskId: t.id,
      reason: 'Consecutive by due date and no dependency declared.',
    })),
    clarifications: [
      {
        id: 'q-dep-1',
        question: 'Which tasks need client sign-off before the next one can start?',
        reason: 'Sign-off turnaround is the usual hidden delay in a backward schedule.',
        suggestedOptions: ['None', 'Design reviews only', 'Every milestone'],
        resolved: false,
      },
    ],
    bufferHealthScore: late.length ? 30 : 50,
    executiveSummary: `${LOCAL_HEURISTIC_LABEL}: ${tasks.length} task(s) checked against target ${target}; ${late.length} due after it, ${orphans.length} without dependencies.`,
  };
}
