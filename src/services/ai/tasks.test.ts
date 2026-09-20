import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { analyzeDependencies, askAssistant, crunchMarkdownNotes, LOCAL_SOURCE, normalizeCrunchResult } from './tasks';
import { LOCAL_HEURISTIC_LABEL } from './fallbacks';
import { cfg, jsonResponse, mockFetch, requestAt, restoreMocks, type FetchMock } from './test-helpers';

let fetchMock: FetchMock;
beforeEach(() => {
  fetchMock = mockFetch();
  vi.spyOn(console, 'warn').mockImplementation(() => undefined);
});
afterEach(restoreMocks);

const openai = cfg('openai', { apiKey: 'sk', model: 'gpt-5-mini' });
const reply = (content: unknown) => jsonResponse({ model: 'gpt-5-mini', choices: [{ message: { content: typeof content === 'string' ? content : JSON.stringify(content) } }] });

describe('normalizeCrunchResult', () => {
  it('fills missing arrays and falls back to the context', () => {
    const r = normalizeCrunchResult({}, { targetDeliveryDate: '2027-05-01', projectName: 'Show' });
    expect(r).toEqual({
      projectTitle: 'Show', summary: '', retroplanningScore: 0, targetDeliveryDate: '2027-05-01',
      phases: [], milestones: [], tasks: [], clarificationQuestions: [], structuredMarkdown: '',
    });
    expect(normalizeCrunchResult(null, { targetDeliveryDate: '2027-05-01' }).targetDeliveryDate).toBe('2027-05-01');
  });

  it('dedupes ids, drops untitled tasks, fixes dates, clamps enums and re-homes phases', () => {
    const r = normalizeCrunchResult(
      {
        targetDeliveryDate: '2027-05-01',
        retroplanningScore: 140,
        phases: [
          { id: 'phase-1', name: 'A', startDate: '2027-04-01', endDate: '2027-04-10' },
          { id: 'phase-1', name: 'B', startDate: 'bad', endDate: '2027-04-20' },
        ],
        milestones: [{ id: 'ms-1', title: 'M', targetDate: '01/05/2027' }, { title: '' }],
        tasks: [
          { id: 't1', phaseId: 'phase-1', title: 'One', status: 'weird', priority: 'urgent', startDate: '2027-04-01', dueDate: '2027-04-05', dependencies: ['t1', 't2', 'ghost'], checklist: [{ text: 'do' }, { text: '' }] },
          { id: 't1', phaseId: 'nope', title: ' Two ', dueDate: '2027-13-40' },
          { id: 't3', title: '   ' },
          { phaseId: 'phase-1-2', title: 'Four' },
        ],
        clarificationQuestions: [{ question: 'Q?', suggestedOptions: ['a', 1] }, { question: '' }],
      },
      { targetDeliveryDate: '2027-01-01' }
    );
    expect(r.targetDeliveryDate).toBe('2027-05-01');
    expect(r.retroplanningScore).toBe(100);
    expect(r.phases.map((p) => [p.id, p.startDate, p.order])).toEqual([['phase-1', '2027-04-01', 1], ['phase-1-2', '2027-04-20', 2]]);
    expect(r.milestones).toEqual([{ id: 'ms-1', title: 'M', targetDate: '2027-05-01', isHardDeadline: false, completed: false, description: '', deliverableCount: 0 }]);
    expect(r.tasks.map((t) => t.id)).toEqual(['t1', 't1-2', 'task-3']);
    expect(r.tasks.map((t) => t.title)).toEqual(['One', 'Two', 'Four']);
    expect(r.tasks[0]).toMatchObject({ status: 'todo', priority: 'urgent', dependencies: [], checklist: [{ id: 'c-1-1', text: 'do', completed: false }] });
    expect(r.tasks[1]).toMatchObject({ phaseId: 'phase-1', startDate: '2027-05-01', dueDate: '2027-05-01' });
    expect(r.tasks[2].phaseId).toBe('phase-1-2');
    expect(r.clarificationQuestions).toEqual([{ id: 'q-1', question: 'Q?', reason: '', suggestedOptions: ['a'], resolved: false, userResponse: undefined }]);
  });
});

describe('normalizeCrunchResult numbers and phases', () => {
  it('accepts numeric strings, never yields NaN or negative hours, and clamps the score', () => {
    const r = normalizeCrunchResult(
      {
        retroplanningScore: '75',
        phases: [{ id: 'p', name: 'P', bufferDays: -3, startDate: '2027-01-01', endDate: '2027-02-01' }],
        milestones: [{ title: 'M', deliverableCount: 'many' }],
        tasks: [{ title: 'A', estimatedHours: '12' }, { title: 'B', estimatedHours: NaN }, { title: 'C', estimatedHours: -4 }, { title: 'D', estimatedHours: 'lots' }],
      },
      { targetDeliveryDate: '2027-03-01' }
    );
    expect(r.retroplanningScore).toBe(75);
    expect(r.phases[0].bufferDays).toBe(0);
    expect(r.milestones[0].deliverableCount).toBe(0);
    expect(r.tasks.map((t) => t.estimatedHours)).toEqual([12, 0, 0, 0]);
    expect(r.tasks.every((t) => Number.isFinite(t.estimatedHours))).toBe(true);
  });

  it('synthesises one phase when tasks came back without any, so every phaseId resolves', () => {
    const r = normalizeCrunchResult(
      { tasks: [{ title: 'A', phaseId: 'ghost', startDate: '2027-01-10', dueDate: '2027-01-20' }, { title: 'B', dueDate: '2027-02-05' }] },
      { targetDeliveryDate: '2027-02-01' }
    );
    expect(r.phases).toHaveLength(1);
    expect(r.phases[0]).toMatchObject({ id: 'phase-1', startDate: '2027-01-10', endDate: '2027-02-05', order: 1 });
    expect(r.tasks.map((t) => t.phaseId)).toEqual(['phase-1', 'phase-1']);
  });
});

describe('crunchMarkdownNotes', () => {
  const input = { markdownContent: '- [ ] Do it', targetDeliveryDate: '2027-05-01', projectName: 'Show' };

  it('uses the local heuristic when no provider is configured', async () => {
    const out = await crunchMarkdownNotes(input, null);
    expect(out.fallback).toBe(true);
    expect(out.source).toBe(LOCAL_SOURCE);
    expect(out.data.tasks[0].title).toBe('Do it');
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('sends a json-mode prompt with the notes and normalises the reply', async () => {
    fetchMock.mockResolvedValue(reply({ projectTitle: 'X', tasks: [{ id: 'a', title: 'T', dueDate: 'bad' }] }));
    const out = await crunchMarkdownNotes(input, openai);
    const req = requestAt(fetchMock);
    const body = req.body as { messages: { role: string; content: string }[]; response_format: unknown };
    expect(body.response_format).toEqual({ type: 'json_object' });
    expect(body.messages[0].role).toBe('system');
    expect(body.messages[1].content).toContain('- [ ] Do it');
    expect(body.messages[1].content).toContain('2027-05-01');
    expect(out).toMatchObject({ fallback: false, source: 'gpt-5-mini' });
    expect(out.data.tasks[0]).toMatchObject({ id: 'a', title: 'T', dueDate: '2027-05-01' });
  });

  it('falls back with the error message when the provider fails', async () => {
    fetchMock.mockResolvedValue(jsonResponse({ error: { message: 'quota' } }, 429));
    const out = await crunchMarkdownNotes(input, openai);
    expect(out.fallback).toBe(true);
    expect(out.error).toContain('quota');
    expect(out.data.summary).toContain(LOCAL_HEURISTIC_LABEL);
  });
});

describe('analyzeDependencies', () => {
  const tasks = [{ id: 't1', title: 'A', dueDate: '2027-01-01', dependencies: [] }] as never;

  it('returns the local analysis without a provider', async () => {
    const out = await analyzeDependencies({ tasks, targetDeliveryDate: '2027-02-01' }, null);
    expect(out.fallback).toBe(true);
    expect(out.analysis.executiveSummary).toContain(LOCAL_HEURISTIC_LABEL);
  });

  it('normalises the provider reply', async () => {
    fetchMock.mockResolvedValue(reply({ criticalPathTaskIds: ['t1'], bottlenecks: [{ taskId: 't1', severity: 'huge' }], bufferHealthScore: -5, clarifications: [{ question: 'Q' }] }));
    const out = await analyzeDependencies({ tasks, targetDeliveryDate: '2027-02-01', projectName: 'P' }, openai);
    expect(out.fallback).toBe(false);
    expect(out.analysis).toMatchObject({ criticalPathTaskIds: ['t1'], bufferHealthScore: 0, bottlenecks: [{ taskId: 't1', severity: 'medium' }] });
    expect(out.analysis.clarifications[0]).toMatchObject({ id: 'q-dep-1', resolved: false });
    expect((requestAt(fetchMock).body as { messages: { content: string }[] }).messages[1].content).toContain('"t1"');
  });
});

describe('askAssistant', () => {
  it('replies locally and plainly without a provider', async () => {
    const out = await askAssistant({ query: 'What next?', projectContext: { title: 'P', targetDeliveryDate: '2027-01-01', tasks: [] } }, null);
    expect(out.fallback).toBe(true);
    expect(out.reply).toContain(LOCAL_HEURISTIC_LABEL);
    expect(out.reply).not.toMatch(/8-day buffer/);
  });

  it('includes history between the system context and the query', async () => {
    fetchMock.mockResolvedValue(reply('Do the thing.'));
    const out = await askAssistant(
      { query: 'And then?', projectContext: { title: 'P', tasks: [] }, history: [{ role: 'user', content: 'first' }, { role: 'assistant', content: 'reply' }, { role: 'system', content: 'ignored' }] },
      openai
    );
    expect(out).toEqual({ reply: 'Do the thing.', fallback: false, source: 'gpt-5-mini' });
    const msgs = (requestAt(fetchMock).body as { messages: { role: string; content: string }[] }).messages;
    expect(msgs.map((m) => m.role)).toEqual(['system', 'user', 'assistant', 'user']);
    expect(msgs[0].content).toContain('"title": "P"');
    expect(msgs[0].content).toMatch(/concise/i);
    expect(msgs[3].content).toBe('And then?');
  });

  it('falls back on failure', async () => {
    fetchMock.mockResolvedValue(jsonResponse({}, 500));
    const out = await askAssistant({ query: 'x', projectContext: {} }, openai);
    expect(out.fallback).toBe(true);
    expect(out.error).toBeDefined();
  });
});
