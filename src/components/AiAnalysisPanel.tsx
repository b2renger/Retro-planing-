import React from 'react';
import { AlertTriangle, ArrowRight, Settings, X } from 'lucide-react';
import type { Task } from '../types';
import type { DependencyOutcome } from '../services/ai/tasks';

const SEVERITY_CLASS: Record<'high' | 'medium' | 'low', string> = {
  high: 'bg-rose-500/15 border-rose-500/30 text-rose-700 dark:text-rose-300',
  medium: 'bg-amber-500/15 border-amber-500/30 text-amber-700 dark:text-amber-300',
  low: 'bg-blue-500/15 border-blue-500/30 text-blue-700 dark:text-blue-300',
};

export interface AiAnalysisPanelProps {
  outcome: DependencyOutcome;
  tasks: Task[];
  onDismiss: () => void;
  onOpenSettings: () => void;
}

/** Result of `analyzeDependencies`: summary, bottlenecks and suggested links, labelled by their source. */
export const AiAnalysisPanel: React.FC<AiAnalysisPanelProps> = ({ outcome, tasks, onDismiss, onOpenSettings }) => {
  const titleOf = (id: string) => tasks.find((t) => t.id === id)?.title ?? id;
  const { analysis } = outcome;

  return (
    <div className="bg-card border border-line rounded-2xl p-4 sm:p-5 space-y-4 shadow-sm dark:shadow-lg">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div className="space-y-0.5">
          <h3 className="text-sm font-bold text-fg">Dependency analysis</h3>
          <p className="text-[11px] text-fg-muted">
            {outcome.fallback ? 'Computed locally by the heuristic planner.' : `Computed by ${outcome.source}.`} Buffer health:{' '}
            {analysis.bufferHealthScore}% · {analysis.criticalPathTaskIds.length} task(s) on the critical path.
          </p>
        </div>
        <button
          type="button"
          onClick={onDismiss}
          aria-label="Dismiss the analysis"
          className="p-1.5 rounded-md text-fg-muted hover:text-fg hover:bg-elevated transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500"
        >
          <X className="w-4 h-4" />
        </button>
      </div>

      {outcome.fallback && (
        <div className="flex items-start gap-2 p-3 rounded-xl bg-amber-500/10 border border-amber-500/30 text-xs text-fg">
          <AlertTriangle className="w-4 h-4 text-amber-600 dark:text-amber-400 shrink-0 mt-px" />
          <div className="space-y-1">
            <p className="font-semibold">This analysis was computed locally, without AI.</p>
            <p className="text-fg-muted leading-relaxed">
              {outcome.error
                ? `The configured provider could not be used: ${outcome.error}`
                : 'No AI provider is configured, so the findings come from simple date and dependency rules.'}
            </p>
            <button
              type="button"
              onClick={onOpenSettings}
              className="inline-flex items-center gap-1 underline underline-offset-2 text-blue-700 dark:text-blue-400 focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 rounded-sm"
            >
              <Settings className="w-3 h-3" />
              <span>Open AI settings</span>
            </button>
          </div>
        </div>
      )}

      {analysis.executiveSummary && <p className="text-xs text-fg leading-relaxed">{analysis.executiveSummary}</p>}

      <div className="space-y-2">
        <h4 className="text-[11px] font-bold uppercase tracking-wide text-fg-muted">Bottlenecks ({analysis.bottlenecks.length})</h4>
        {analysis.bottlenecks.length === 0 ? (
          <p className="text-xs text-fg-muted">None reported.</p>
        ) : (
          <ul className="space-y-2">
            {analysis.bottlenecks.map((b, i) => (
              <li key={`${b.taskId}-${i}`} className="p-3 rounded-xl bg-elevated border border-line space-y-1">
                <div className="flex items-center gap-2">
                  <span className={`px-1.5 py-0.5 rounded-md border text-[10px] font-bold uppercase ${SEVERITY_CLASS[b.severity]}`}>{b.severity}</span>
                  <span className="text-xs font-semibold text-fg truncate">{titleOf(b.taskId)}</span>
                </div>
                {b.issue && <p className="text-[11px] text-fg-muted leading-relaxed">{b.issue}</p>}
                {b.recommendation && <p className="text-[11px] text-fg leading-relaxed">→ {b.recommendation}</p>}
              </li>
            ))}
          </ul>
        )}
      </div>

      {analysis.dependencySuggestions.length > 0 && (
        <div className="space-y-2">
          <h4 className="text-[11px] font-bold uppercase tracking-wide text-fg-muted">
            Suggested links ({analysis.dependencySuggestions.length})
          </h4>
          <ul className="space-y-1.5">
            {analysis.dependencySuggestions.map((d, i) => (
              <li key={`${d.sourceTaskId}-${d.targetTaskId}-${i}`} className="text-[11px] text-fg-muted leading-relaxed">
                <span className="inline-flex items-center gap-1 text-fg font-medium">
                  <span>{titleOf(d.sourceTaskId)}</span>
                  <ArrowRight className="w-3 h-3 shrink-0" />
                  <span>{titleOf(d.targetTaskId)}</span>
                </span>
                {d.reason ? ` — ${d.reason}` : ''}
              </li>
            ))}
          </ul>
          <p className="text-[11px] text-fg-subtle">Suggestions are not applied automatically; edit the tasks to accept one.</p>
        </div>
      )}

      {analysis.clarifications.length > 0 && (
        <div className="space-y-1.5">
          <h4 className="text-[11px] font-bold uppercase tracking-wide text-fg-muted">Open questions</h4>
          <ul className="list-disc pl-4 space-y-1">
            {analysis.clarifications.map((q) => (
              <li key={q.id} className="text-[11px] text-fg-muted leading-relaxed">
                {q.question}
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
};
