import React from 'react';
import { AlertTriangle, CheckCircle2, Compass, Flag } from 'lucide-react';
import type { Milestone, Project } from '../../types';
import type { ProjectHealth } from '../../state/projectsReducer';
import { parseDay } from '../../services/export/common';
import { daysBetween, formatDay } from './scale';

export interface MilestoneRunwayProps {
  project: Project;
  health: ProjectHealth;
  locale: string;
  /** `YYYY-MM-DD` used as "today"; the container passes the Gantt model's own value. */
  today: string;
  onToggle: (id: string) => void;
  onReschedule: (id: string, date: string) => void;
}

const countdownLabel = (milestone: Milestone, today: string): string | null => {
  const days = daysBetween(today, milestone.targetDate);
  if (days === null) return null;
  if (milestone.completed) return 'Reached';
  if (days === 0) return 'Today';
  return days > 0 ? `in ${days}d` : `${Math.abs(days)}d late`;
};

/** Milestone list with a real countdown and the project's computed health — no static copy. */
export const MilestoneRunway: React.FC<MilestoneRunwayProps> = ({
  project,
  health,
  locale,
  today,
  onToggle,
  onReschedule,
}) => {
  const milestones = [...project.milestones].sort((a, b) => a.targetDate.localeCompare(b.targetDate));
  const reached = milestones.filter((m) => m.completed).length;
  const targetValid = Boolean(parseDay(project.targetDeliveryDate));

  return (
    <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
      <div className="space-y-4 rounded-2xl border border-line bg-card p-5 shadow-sm dark:shadow-xl lg:col-span-2">
        <div className="flex items-center justify-between border-b border-line pb-3">
          <h3 className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-fg">
            <Flag className="h-4 w-4 text-purple-600 dark:text-purple-400" />
            Milestones
          </h3>
          <span className="font-mono text-xs text-purple-700 dark:text-purple-300">
            {reached} / {milestones.length} reached
          </span>
        </div>

        {milestones.length === 0 ? (
          <p className="rounded-xl border border-dashed border-line p-6 text-center text-xs text-fg-muted">
            No milestone yet. Add one from the toolbar to mark a hard deadline.
          </p>
        ) : (
          <ul className="space-y-3">
            {milestones.map((ms, idx) => {
              const countdown = countdownLabel(ms, today);
              const late = !ms.completed && (daysBetween(today, ms.targetDate) ?? 0) < 0;
              return (
                <li
                  key={ms.id}
                  className={`rounded-xl border p-4 ${
                    ms.completed ? 'border-emerald-500/30 bg-emerald-500/10' : 'border-line bg-elevated'
                  }`}
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex items-start gap-3">
                      <button
                        type="button"
                        onClick={() => onToggle(ms.id)}
                        aria-pressed={ms.completed}
                        aria-label={`Mark ${ms.title} ${ms.completed ? 'not reached' : 'reached'}`}
                        className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-lg font-mono text-xs font-bold transition-colors ${
                          ms.completed
                            ? 'bg-emerald-500 text-white'
                            : 'border border-purple-500/30 bg-purple-600/20 text-purple-700 dark:text-purple-300'
                        }`}
                      >
                        {ms.completed ? <CheckCircle2 className="h-4 w-4" /> : idx + 1}
                      </button>
                      <div>
                        <h4 className="text-xs font-bold text-fg">{ms.title}</h4>
                        {ms.description && <p className="mt-0.5 text-xs text-fg-muted">{ms.description}</p>}
                        {ms.deliverableCount > 0 && (
                          <p className="mt-0.5 text-[10px] text-fg-muted">{ms.deliverableCount} deliverables</p>
                        )}
                      </div>
                    </div>

                    <div className="shrink-0 text-right">
                      <input
                        type="date"
                        aria-label={`Target date of ${ms.title}`}
                        value={ms.targetDate}
                        onChange={(e) => {
                          if (parseDay(e.target.value)) onReschedule(ms.id, e.target.value);
                        }}
                        className="rounded-lg border border-line bg-input px-2 py-1 text-right font-mono text-xs text-fg focus:border-purple-500 focus:outline-none"
                      />
                      {countdown && (
                        <div
                          className={`mt-1 text-[10px] font-semibold ${
                            late ? 'text-rose-600 dark:text-rose-400' : 'text-fg-muted'
                          }`}
                        >
                          {countdown}
                        </div>
                      )}
                    </div>
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </div>

      <div className="flex flex-col justify-between space-y-4 rounded-2xl border border-line bg-card p-5 shadow-sm dark:shadow-xl">
        <div className="space-y-3">
          <h3 className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-fg">
            <Compass className="h-4 w-4 text-amber-600 dark:text-amber-400" />
            Delivery runway
          </h3>

          {targetValid ? (
            <div className="space-y-1 rounded-xl border border-line bg-elevated p-4 text-center">
              <div className="font-mono text-4xl font-extrabold text-amber-600 dark:text-amber-400">
                {Math.abs(health.daysRemaining)}
              </div>
              <div className="text-xs font-semibold uppercase tracking-wider text-fg-muted">
                {health.daysRemaining >= 0 ? 'days until delivery' : 'days past delivery'}
              </div>
              <div className="pt-1 text-[11px] text-fg-muted">
                Target:{' '}
                <strong className="text-fg">
                  {formatDay(project.targetDeliveryDate, locale, { dateStyle: 'medium' })}
                </strong>
              </div>
            </div>
          ) : (
            <p className="rounded-xl border border-dashed border-line p-4 text-center text-xs text-fg-muted">
              No valid delivery date is set, so no countdown can be computed.
            </p>
          )}

          <dl className="space-y-2 text-xs">
            {targetValid && (project.phases.length > 0 || project.tasks.length > 0) && (
              <div className="flex justify-between">
                <dt className="text-fg-muted">
                  {health.scheduleEndsAfterTarget ? 'Schedule overruns target by' : 'Slack before target'}
                </dt>
                <dd
                  className={`font-bold ${
                    health.scheduleEndsAfterTarget
                      ? 'text-rose-600 dark:text-rose-400'
                      : 'text-emerald-600 dark:text-emerald-400'
                  }`}
                >
                  {Math.abs(health.slackDays)}d
                </dd>
              </div>
            )}
            {health.tasksTotal > 0 && (
              <div className="flex justify-between">
                <dt className="text-fg-muted">Deliverables done</dt>
                <dd className="font-bold text-fg">
                  {health.tasksDone} / {health.tasksTotal}
                </dd>
              </div>
            )}
            {health.overdueTasks > 0 && (
              <div className="flex justify-between">
                <dt className="flex items-center gap-1 text-fg-muted">
                  <AlertTriangle className="h-3 w-3 text-amber-600 dark:text-amber-400" />
                  Overdue tasks
                </dt>
                <dd className="font-bold text-amber-700 dark:text-amber-300">{health.overdueTasks}</dd>
              </div>
            )}
          </dl>
        </div>

        {health.scheduleEndsAfterTarget && (
          <p className="border-t border-line pt-3 text-[11px] leading-relaxed text-rose-700 dark:text-rose-300">
            The last dated item of the plan falls after the delivery date. Move the anchor or pull work
            forward before committing to it.
          </p>
        )}
      </div>
    </div>
  );
};
