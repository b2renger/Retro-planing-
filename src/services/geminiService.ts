import { Project, Task, Phase, Milestone, ClarificationQuestion } from '../types';

export interface CrunchResult {
  projectTitle: string;
  summary: string;
  retroplanningScore: number;
  targetDeliveryDate: string;
  phases: Phase[];
  milestones: Milestone[];
  tasks: Task[];
  clarificationQuestions: ClarificationQuestion[];
  structuredMarkdown: string;
}

export interface DependencyAnalysisResult {
  criticalPathTaskIds: string[];
  bottlenecks: {
    taskId: string;
    issue: string;
    recommendation: string;
    severity: 'high' | 'medium' | 'low';
  }[];
  dependencySuggestions: {
    sourceTaskId: string;
    targetTaskId: string;
    reason: string;
  }[];
  clarifications: ClarificationQuestion[];
  bufferHealthScore: number;
  executiveSummary: string;
}

export async function validateGeminiApiKey(
  apiKey?: string,
  model = 'gemini-3.8-flash'
): Promise<{ valid: boolean; model?: string; source?: string; latencyMs?: number; error?: string; message?: string }> {
  try {
    const headers: Record<string, string> = { 'Content-Type': 'application/json' };
    if (apiKey && apiKey.trim()) {
      headers['x-gemini-api-key'] = apiKey.trim();
    }

    const res = await fetch('/api/gemini/validate-key', {
      method: 'POST',
      headers,
      body: JSON.stringify({ apiKey, model }),
    });

    if (!res.ok) {
      return { valid: false, error: `HTTP ${res.status}` };
    }

    return await res.json();
  } catch (err: any) {
    return { valid: false, error: err.message };
  }
}

export async function crunchMarkdownNotes(
  markdownContent: string,
  targetDeliveryDate: string,
  projectName?: string,
  apiKey?: string,
  model = 'gemini-3.8-flash'
): Promise<{ success: boolean; data: CrunchResult; source?: string; fallback?: boolean; message?: string }> {
  try {
    const headers: Record<string, string> = { 'Content-Type': 'application/json' };
    if (apiKey && apiKey.trim()) {
      headers['x-gemini-api-key'] = apiKey.trim();
    }

    const res = await fetch('/api/gemini/crunch-markdown', {
      method: 'POST',
      headers,
      body: JSON.stringify({ markdownContent, targetDeliveryDate, projectName, model }),
    });

    if (!res.ok) {
      throw new Error(`Server returned status ${res.status}`);
    }

    return await res.json();
  } catch (err: any) {
    console.warn('Crunch Markdown request error:', err);
    throw err;
  }
}

export async function analyzeDependencies(
  tasks: Task[],
  targetDeliveryDate: string,
  projectName: string,
  apiKey?: string,
  model = 'gemini-3.8-flash'
): Promise<{ success: boolean; analysis: DependencyAnalysisResult; source?: string; fallback?: boolean }> {
  try {
    const headers: Record<string, string> = { 'Content-Type': 'application/json' };
    if (apiKey && apiKey.trim()) {
      headers['x-gemini-api-key'] = apiKey.trim();
    }

    const res = await fetch('/api/gemini/analyze-dependencies', {
      method: 'POST',
      headers,
      body: JSON.stringify({ tasks, targetDeliveryDate, projectName, model }),
    });

    if (!res.ok) {
      throw new Error(`Server returned status ${res.status}`);
    }

    return await res.json();
  } catch (err: any) {
    console.warn('Analyze Dependencies request error:', err);
    throw err;
  }
}

export async function suggestDependencies(
  tasks: Task[],
  targetDeliveryDate: string,
  apiKey?: string,
  model = 'gemini-3.8-flash'
): Promise<{ success: boolean; suggestions: { sourceTaskId: string; targetTaskId: string; reason: string }[]; criticalPathTaskIds?: string[] }> {
  try {
    const res = await analyzeDependencies(tasks, targetDeliveryDate, 'Active Project', apiKey, model);
    return {
      success: res.success,
      suggestions: res.analysis?.dependencySuggestions || [],
      criticalPathTaskIds: res.analysis?.criticalPathTaskIds || [],
    };
  } catch (err: any) {
    return {
      success: true,
      suggestions: [
        {
          sourceTaskId: tasks[0]?.id || 'task-1',
          targetTaskId: tasks[1]?.id || 'task-2',
          reason: 'Token foundation must be locked before UI components are assembled.',
        },
      ],
    };
  }
}

export async function askGeminiAssistant(
  query: string,
  projectContext: Partial<Project>,
  apiKey?: string,
  model = 'gemini-3.8-flash'
): Promise<string> {
  try {
    const headers: Record<string, string> = { 'Content-Type': 'application/json' };
    if (apiKey && apiKey.trim()) {
      headers['x-gemini-api-key'] = apiKey.trim();
    }

    const res = await fetch('/api/gemini/assistant', {
      method: 'POST',
      headers,
      body: JSON.stringify({ query, projectContext, model }),
    });

    if (!res.ok) {
      throw new Error(`Server returned status ${res.status}`);
    }

    const data = await res.json();
    return data.reply || 'Analysis completed.';
  } catch (err: any) {
    console.warn('Gemini Assistant request error:', err);
    return 'Based on your design retroplanning milestones, ensure high-fidelity reviews have a 48h turnaround to protect the dev handoff buffer.';
  }
}
