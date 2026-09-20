import type { ClarificationQuestion, Milestone, Phase, Project, Task, TaskPriority, TaskStatus } from '../../types';
import { chat, chatJson } from './client';
import { generateFallbackAnalysis, generateSmartFallbackStructure, isIsoDate, LOCAL_HEURISTIC_LABEL, resolveTargetDate } from './fallbacks';
import { toAiError } from './errors';
import type { AiProviderConfig, ChatMessage, CrunchResult, DependencyAnalysisResult } from './types';

/** Value of `source` when no provider answered. */
export const LOCAL_SOURCE = 'local-heuristic';

const DOMAIN_SYSTEM_PROMPT =
  'You are a senior producer for design and media-installation studios (exhibitions, interactive installations, projection, sound, web and motion). ' +
  'You plan by retro-planning: work backward from the delivery date, protect review and QA buffers, and make hardware, content and integration dependencies explicit. ' +
  'Be concrete and practical; never invent facts about the project that are not in the input.';

const STATUSES: TaskStatus[] = ['todo', 'in-progress', 'in-review', 'blocked', 'done'];
const PRIORITIES: TaskPriority[] = ['low', 'medium', 'high', 'urgent'];

function str(v: unknown, fallback = ''): string {
  return typeof v === 'string' ? v : typeof v === 'number' ? String(v) : fallback;
}
/** Finite number from a number or a numeric string (models often emit `"8"`); NaN/Infinity/garbage → fallback. */
function num(v: unknown, fallback: number): number {
  if (typeof v === 'number') return Number.isFinite(v) ? v : fallback;
  if (typeof v === 'string' && v.trim()) {
    const n = Number(v);
    if (Number.isFinite(n)) return n;
  }
  return fallback;
}
function nonNegative(v: unknown, fallback: number): number {
  return Math.max(0, num(v, fallback));
}
function bool(v: unknown, fallback = false): boolean {
  return typeof v === 'boolean' ? v : fallback;
}
function strArray(v: unknown): string[] {
  return Array.isArray(v) ? v.filter((x): x is string => typeof x === 'string') : [];
}
function objArray(v: unknown): Record<string, unknown>[] {
  return Array.isArray(v) ? v.filter((x): x is Record<string, unknown> => typeof x === 'object' && x !== null) : [];
}
function oneOf<T extends string>(v: unknown, allowed: T[], fallback: T): T {
  return typeof v === 'string' && (allowed as string[]).includes(v) ? (v as T) : fallback;
}
function dateOr(v: unknown, fallback: string): string {
  return isIsoDate(v) ? v : fallback;
}

/** Return a unique-id generator: repeated ids get `-2`, `-3`… suffixes; empty ids get `${prefix}-n`. */
function uniqueIds(prefix: string) {
  const seen = new Set<string>();
  return (raw: unknown, index: number): string => {
    let id = str(raw).trim() || `${prefix}-${index + 1}`;
    let n = 2;
    const base = id;
    while (seen.has(id)) id = `${base}-${n++}`;
    seen.add(id);
    return id;
  };
}

function normalizeClarifications(raw: unknown, prefix: string): ClarificationQuestion[] {
  const nextId = uniqueIds(prefix);
  return objArray(raw)
    .filter((q) => str(q.question).trim())
    .map((q, i) => ({
      id: nextId(q.id, i),
      question: str(q.question).trim(),
      reason: str(q.reason),
      suggestedOptions: strArray(q.suggestedOptions),
      resolved: bool(q.resolved),
      userResponse: typeof q.userResponse === 'string' ? q.userResponse : undefined,
    }));
}

/**
 * Coerce an untrusted model reply into a valid CrunchResult: arrays always present, ids unique, dates
 * `YYYY-MM-DD` (invalid dates fall back to the target), enums clamped, tasks without a title dropped,
 * dependencies pointing at unknown tasks removed, phaseIds pointing at unknown phases re-homed to the
 * first phase (one is synthesised when the model returned tasks but no phases).
 */
export function normalizeCrunchResult(raw: unknown, ctx: { targetDeliveryDate?: string; projectName?: string }): CrunchResult {
  const r: Record<string, unknown> = typeof raw === 'object' && raw !== null ? (raw as Record<string, unknown>) : {};
  const target = resolveTargetDate(dateOr(r.targetDeliveryDate, resolveTargetDate(ctx.targetDeliveryDate)));

  const phaseId = uniqueIds('phase');
  const phases: Phase[] = objArray(r.phases).map((p, i) => {
    const endDate = dateOr(p.endDate, target);
    return {
      id: phaseId(p.id, i),
      name: str(p.name, `Phase ${i + 1}`),
      color: str(p.color, '#3B82F6'),
      startDate: dateOr(p.startDate, endDate),
      endDate,
      order: num(p.order, i + 1),
      bufferDays: nonNegative(p.bufferDays, 0),
      isCriticalPath: bool(p.isCriticalPath),
    };
  });
  const phaseIds = new Set(phases.map((p) => p.id));

  const msId = uniqueIds('ms');
  const milestones: Milestone[] = objArray(r.milestones)
    .filter((m) => str(m.title).trim())
    .map((m, i) => ({
      id: msId(m.id, i),
      title: str(m.title).trim(),
      targetDate: dateOr(m.targetDate, target),
      isHardDeadline: bool(m.isHardDeadline),
      completed: bool(m.completed),
      description: str(m.description),
      deliverableCount: nonNegative(m.deliverableCount, 0),
    }));

  const taskId = uniqueIds('task');
  const rawTasks = objArray(r.tasks).filter((t) => str(t.title).trim());
  const tasks: Task[] = rawTasks.map((t, i) => {
    const dueDate = dateOr(t.dueDate, target);
    const wanted = str(t.phaseId);
    const checkId = uniqueIds(`c-${i + 1}`);
    return {
      id: taskId(t.id, i),
      projectId: str(t.projectId),
      phaseId: phaseIds.has(wanted) ? wanted : phases[0]?.id ?? wanted,
      title: str(t.title).trim(),
      description: str(t.description),
      status: oneOf(t.status, STATUSES, 'todo'),
      priority: oneOf(t.priority, PRIORITIES, 'medium'),
      assigneeId: str(t.assigneeId),
      startDate: dateOr(t.startDate, dueDate),
      dueDate,
      estimatedHours: nonNegative(t.estimatedHours, 0),
      dependencies: strArray(t.dependencies),
      deliverables: strArray(t.deliverables),
      checklist: objArray(t.checklist)
        .filter((c) => str(c.text).trim())
        .map((c, j) => ({ id: checkId(c.id, j), text: str(c.text).trim(), completed: bool(c.completed) })),
      tags: strArray(t.tags),
      isCriticalPath: bool(t.isCriticalPath),
    };
  });
  const taskIds = new Set(tasks.map((t) => t.id));
  for (const t of tasks) t.dependencies = t.dependencies.filter((d) => d !== t.id && taskIds.has(d));

  if (!phases.length && tasks.length) {
    const dates = tasks.flatMap((t) => [t.startDate, t.dueDate]).sort();
    const only: Phase = {
      id: phaseId('phase-1', 0),
      name: 'Phase 1',
      color: '#3B82F6',
      startDate: dates[0],
      endDate: dates[dates.length - 1] > target ? dates[dates.length - 1] : target,
      order: 1,
      bufferDays: 0,
      isCriticalPath: false,
    };
    phases.push(only);
    for (const t of tasks) t.phaseId = only.id;
  }

  return {
    projectTitle: str(r.projectTitle).trim() || ctx.projectName || 'Project',
    summary: str(r.summary),
    retroplanningScore: Math.max(0, Math.min(100, num(r.retroplanningScore, 0))),
    targetDeliveryDate: target,
    phases,
    milestones,
    tasks,
    clarificationQuestions: normalizeClarifications(r.clarificationQuestions, 'q'),
    structuredMarkdown: str(r.structuredMarkdown),
  };
}

/** Notes to structure into a plan. */
export interface CrunchInput {
  markdownContent: string;
  targetDeliveryDate: string;
  projectName?: string;
}

/** A CrunchResult plus where it came from. */
export interface CrunchOutcome {
  data: CrunchResult;
  /** True when the result came from the local heuristic rather than a provider. */
  fallback: boolean;
  /** Model id that answered, or `local-heuristic`. */
  source: string;
  error?: string;
}

function crunchPrompt(input: CrunchInput, target: string): string {
  return `Analyze these unstructured notes/markdown for the project "${input.projectName || 'Project'}".
Target delivery date: ${target}.

Structure them into a retro-planning schedule: phases, milestones and actionable tasks scheduled backward from the target so that reviews, QA, hardware tests and hand-over keep a buffer. Every date must be YYYY-MM-DD and no later than the target.

Input notes:
"""
${input.markdownContent}
"""

Return a JSON object with exactly this shape:
{
  "projectTitle": "string",
  "summary": "string overview of scope and objectives",
  "retroplanningScore": number 0-100 (buffer health),
  "targetDeliveryDate": "YYYY-MM-DD",
  "phases": [{ "id": "phase-1", "name": "string", "color": "#RRGGBB", "startDate": "YYYY-MM-DD", "endDate": "YYYY-MM-DD", "bufferDays": number, "isCriticalPath": boolean }],
  "milestones": [{ "id": "ms-1", "title": "string", "targetDate": "YYYY-MM-DD", "isHardDeadline": boolean, "deliverableCount": number, "description": "string" }],
  "tasks": [{ "id": "task-1", "phaseId": "phase-1", "title": "string", "description": "string", "status": "todo|in-progress|in-review|blocked|done", "priority": "low|medium|high|urgent", "assigneeId": "user-1", "startDate": "YYYY-MM-DD", "dueDate": "YYYY-MM-DD", "estimatedHours": number, "dependencies": ["task-id"], "deliverables": ["string"], "checklist": [{ "id": "c1", "text": "string", "completed": false }], "tags": ["string"], "isCriticalPath": boolean }],
  "clarificationQuestions": [{ "id": "q-1", "question": "string", "reason": "string", "suggestedOptions": ["string"], "resolved": false }],
  "structuredMarkdown": "clean markdown version of the notes with checklists"
}`;
}

/** Turn raw notes into a structured plan through the configured provider, or the local heuristic. */
export async function crunchMarkdownNotes(input: CrunchInput, cfg: AiProviderConfig | null): Promise<CrunchOutcome> {
  const target = resolveTargetDate(input.targetDeliveryDate);
  const local = (error?: string): CrunchOutcome => ({
    data: generateSmartFallbackStructure(input.markdownContent, target, input.projectName),
    fallback: true,
    source: LOCAL_SOURCE,
    error,
  });
  if (!cfg) return local();
  try {
    const { data, result } = await chatJson<unknown>(cfg, [
      { role: 'system', content: `${DOMAIN_SYSTEM_PROMPT} Output strict JSON only.` },
      { role: 'user', content: crunchPrompt(input, target) },
    ]);
    return { data: normalizeCrunchResult(data, { targetDeliveryDate: target, projectName: input.projectName }), fallback: false, source: result.model };
  } catch (err) {
    const error = toAiError(err, cfg.providerId);
    console.warn(`[ai] crunchMarkdownNotes fell back to the local heuristic: ${error.message}`);
    return local(error.message);
  }
}

/** Tasks to analyse for critical path and missing links. */
export interface DependencyInput {
  tasks: Task[];
  targetDeliveryDate: string;
  projectName?: string;
}

/** A DependencyAnalysisResult plus where it came from. */
export interface DependencyOutcome {
  analysis: DependencyAnalysisResult;
  fallback: boolean;
  source: string;
  error?: string;
}

function compactTasks(tasks: Task[]): unknown[] {
  return tasks.map((t) => ({
    id: t.id,
    title: t.title,
    phaseId: t.phaseId,
    status: t.status,
    priority: t.priority,
    startDate: t.startDate,
    dueDate: t.dueDate,
    estimatedHours: t.estimatedHours,
    dependencies: t.dependencies,
    isCriticalPath: t.isCriticalPath,
  }));
}

function normalizeAnalysis(raw: unknown): DependencyAnalysisResult {
  const r: Record<string, unknown> = typeof raw === 'object' && raw !== null ? (raw as Record<string, unknown>) : {};
  return {
    criticalPathTaskIds: strArray(r.criticalPathTaskIds),
    bottlenecks: objArray(r.bottlenecks).map((b) => ({
      taskId: str(b.taskId),
      issue: str(b.issue),
      recommendation: str(b.recommendation),
      severity: oneOf(b.severity, ['high', 'medium', 'low'], 'medium'),
    })),
    dependencySuggestions: objArray(r.dependencySuggestions).map((d) => ({
      sourceTaskId: str(d.sourceTaskId),
      targetTaskId: str(d.targetTaskId),
      reason: str(d.reason),
    })),
    clarifications: normalizeClarifications(r.clarifications, 'q-dep'),
    bufferHealthScore: Math.max(0, Math.min(100, num(r.bufferHealthScore, 0))),
    executiveSummary: str(r.executiveSummary),
  };
}

/** Critical path, bottlenecks and missing links through the configured provider, or the local heuristic. */
export async function analyzeDependencies(input: DependencyInput, cfg: AiProviderConfig | null): Promise<DependencyOutcome> {
  const target = resolveTargetDate(input.targetDeliveryDate);
  const local = (error?: string): DependencyOutcome => ({
    analysis: generateFallbackAnalysis(input.tasks, target),
    fallback: true,
    source: LOCAL_SOURCE,
    error,
  });
  if (!cfg) return local();
  const prompt = `Analyze the tasks of the project "${input.projectName || 'Project'}" (target delivery ${target}) for retro-planning.
Tasks: ${JSON.stringify(compactTasks(input.tasks), null, 2)}

Provide:
1. The critical path and its bottlenecks.
2. Missing dependencies that should be linked (e.g. content approved before integration, hardware delivered before on-site tests, client sign-off before production).
3. 2-3 clarification questions about missing assets, review turnaround or scope ambiguities.
4. In each bottleneck's recommendation, the schedule change that protects the delivery buffer.

Return a JSON object with exactly this shape:
{
  "criticalPathTaskIds": ["task-id"],
  "bottlenecks": [{ "taskId": "task-id", "issue": "string", "recommendation": "string", "severity": "high|medium|low" }],
  "dependencySuggestions": [{ "sourceTaskId": "task-id", "targetTaskId": "task-id", "reason": "string" }],
  "clarifications": [{ "id": "q-1", "question": "string", "reason": "string", "suggestedOptions": ["string"] }],
  "bufferHealthScore": number 0-100,
  "executiveSummary": "string"
}`;
  try {
    const { data, result } = await chatJson<unknown>(cfg, [
      { role: 'system', content: `${DOMAIN_SYSTEM_PROMPT} Output strict JSON only.` },
      { role: 'user', content: prompt },
    ]);
    return { analysis: normalizeAnalysis(data), fallback: false, source: result.model };
  } catch (err) {
    const error = toAiError(err, cfg.providerId);
    console.warn(`[ai] analyzeDependencies fell back to the local heuristic: ${error.message}`);
    return local(error.message);
  }
}

/** A question for the copilot with the project it is about. */
export interface AssistantInput {
  query: string;
  projectContext: Partial<Project>;
  history?: ChatMessage[];
}

/** The copilot's reply plus where it came from. */
export interface AssistantOutcome {
  reply: string;
  fallback: boolean;
  source: string;
  error?: string;
}

/** Keep the prompt small: drop document bodies, history and comments from the project context. */
function compactProject(p: Partial<Project>): unknown {
  return {
    title: p.title,
    clientName: p.clientName,
    description: p.description,
    status: p.status,
    startDate: p.startDate,
    targetDeliveryDate: p.targetDeliveryDate,
    phases: p.phases?.map((ph) => ({ id: ph.id, name: ph.name, startDate: ph.startDate, endDate: ph.endDate, bufferDays: ph.bufferDays })),
    milestones: p.milestones?.map((m) => ({ id: m.id, title: m.title, targetDate: m.targetDate, isHardDeadline: m.isHardDeadline, completed: m.completed })),
    tasks: p.tasks ? compactTasks(p.tasks) : undefined,
    openQuestions: p.clarificationQuestions?.filter((q) => !q.resolved).map((q) => q.question),
    documents: p.documents?.map((d) => d.title),
  };
}

function localAssistantReply(input: AssistantInput): string {
  const p = input.projectContext;
  const tasks = p.tasks ?? [];
  const target = p.targetDeliveryDate;
  const open = tasks.filter((t) => t.status !== 'done');
  const late = isIsoDate(target) ? open.filter((t) => isIsoDate(t.dueDate) && t.dueDate > target) : [];
  const lines = [
    `${LOCAL_HEURISTIC_LABEL} — this reply cannot analyse your question "${input.query}".`,
    p.title ? `Project "${p.title}"${target ? ` targets ${target}` : ''}: ${tasks.length} task(s), ${open.length} not done${late.length ? `, ${late.length} due after the target` : ''}.` : '',
    'Configure an AI provider in Settings (Gemini, OpenAI, Anthropic, Mistral, or a local/LAN server) to get real answers.',
  ];
  return lines.filter(Boolean).join('\n');
}

/** Retro-planning copilot: concise, practical answers grounded in the project context. */
export async function askAssistant(input: AssistantInput, cfg: AiProviderConfig | null): Promise<AssistantOutcome> {
  const local = (error?: string): AssistantOutcome => ({ reply: localAssistantReply(input), fallback: true, source: LOCAL_SOURCE, error });
  if (!cfg) return local();
  const messages: ChatMessage[] = [
    {
      role: 'system',
      content: `${DOMAIN_SYSTEM_PROMPT} Answer concisely and practically (short paragraphs or bullet lists, markdown allowed). Give actionable next steps and timeline adjustments when relevant.\n\nProject context:\n${JSON.stringify(compactProject(input.projectContext), null, 2)}`,
    },
    ...(input.history ?? []).filter((m) => m.role !== 'system'),
    { role: 'user', content: input.query },
  ];
  try {
    const result = await chat(cfg, messages);
    return { reply: result.text.trim() || 'No reply.', fallback: false, source: result.model };
  } catch (err) {
    const error = toAiError(err, cfg.providerId);
    console.warn(`[ai] askAssistant fell back to the local reply: ${error.message}`);
    return local(error.message);
  }
}
