/**
 * TYPES ONLY. The Gemini-specific service was removed; AI calls go through `src/services/ai/tasks.ts`
 * with a user-configured provider. These two result shapes are still imported by the AI layer
 * (`ai/tasks.ts`, `ai/fallbacks.ts`) and the Markdown studio, so they stay here until the AI
 * module owns them.
 */
import type { ClarificationQuestion, Milestone, Phase, Task } from '../types';

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
