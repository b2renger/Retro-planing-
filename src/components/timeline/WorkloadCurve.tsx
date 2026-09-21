import React from 'react';
import { BarChart3 } from 'lucide-react';
import type { Project, User } from '../../types';

export interface WorkloadCurveProps {
  project: Project;
  teamMembers: readonly User[];
}

interface Bucket {
  id: string;
  label: string;
  color: string | null;
  hours: number;
  doneHours: number;
  count: number;
}

const hoursOf = (value: number | undefined): number =>
  typeof value === 'number' && Number.isFinite(value) && value > 0 ? value : 0;

/** Estimated hours per phase and per assignee — every figure is summed from the tasks. */
export const WorkloadCurve: React.FC<WorkloadCurveProps> = ({ project, teamMembers }) => {
  const byPhase: Bucket[] = project.phases.map((phase) => {
    const tasks = project.tasks.filter((t) => t.phaseId === phase.id);
    return {
      id: phase.id,
      label: phase.name,
      color: phase.color,
      hours: tasks.reduce((sum, t) => sum + hoursOf(t.estimatedHours), 0),
      doneHours: tasks.filter((t) => t.status === 'done').reduce((sum, t) => sum + hoursOf(t.estimatedHours), 0),
      count: tasks.length,
    };
  });

  const byMember: Bucket[] = teamMembers
    .map((member) => {
      const tasks = project.tasks.filter((t) => t.assigneeId === member.id);
      return {
        id: member.id,
        label: member.name,
        color: member.color ?? null,
        hours: tasks.reduce((sum, t) => sum + hoursOf(t.estimatedHours), 0),
        doneHours: tasks.filter((t) => t.status === 'done').reduce((sum, t) => sum + hoursOf(t.estimatedHours), 0),
        count: tasks.length,
      };
    })
    .filter((b) => b.count > 0);

  const total = project.tasks.reduce((sum, t) => sum + hoursOf(t.estimatedHours), 0);
  const peak = Math.max(1, ...byPhase.map((b) => b.hours), ...byMember.map((b) => b.hours));

  const renderBucket = (bucket: Bucket): React.ReactNode => {
    const ratio = bucket.hours > 0 ? Math.round((bucket.doneHours / bucket.hours) * 100) : 0;
    return (
      <div key={bucket.id} className="space-y-2 rounded-xl border border-line bg-elevated p-4">
        <div className="flex items-center justify-between gap-2">
          <div className="flex min-w-0 items-center gap-2">
            {bucket.color && (
              <span className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ backgroundColor: bucket.color }} />
            )}
            <span className="truncate text-xs font-bold text-fg">{bucket.label}</span>
          </div>
          <span className="shrink-0 font-mono text-xs font-bold text-purple-700 dark:text-purple-300">
            {bucket.hours}h
          </span>
        </div>

        <div className="h-1.5 w-full overflow-hidden rounded-full bg-line">
          <div
            className="h-full rounded-full bg-purple-500"
            style={{ width: `${Math.round((bucket.hours / peak) * 100)}%` }}
          />
        </div>

        <div className="flex justify-between text-[10px] text-fg-muted">
          <span>{bucket.count} tasks</span>
          {bucket.hours > 0 && (
            <span>
              {bucket.doneHours}/{bucket.hours}h done ({ratio}%)
            </span>
          )}
        </div>
      </div>
    );
  };

  return (
    <div className="space-y-5 rounded-2xl border border-line bg-card p-5 shadow-sm dark:shadow-xl sm:p-6">
      <div className="flex items-center justify-between border-b border-line pb-3">
        <h3 className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-fg">
          <BarChart3 className="h-4 w-4 text-purple-600 dark:text-purple-400" />
          Estimated hours
        </h3>
        <span className="font-mono text-xs text-purple-700 dark:text-purple-300">{total}h total</span>
      </div>

      {project.tasks.length === 0 ? (
        <p className="rounded-xl border border-dashed border-line p-6 text-center text-xs text-fg-muted">
          No task carries an estimate yet.
        </p>
      ) : (
        <>
          <section className="space-y-3">
            <h4 className="text-[10px] font-bold uppercase tracking-wider text-fg-muted">Per phase</h4>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">{byPhase.map(renderBucket)}</div>
          </section>

          {byMember.length > 0 && (
            <section className="space-y-3">
              <h4 className="text-[10px] font-bold uppercase tracking-wider text-fg-muted">Per assignee</h4>
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">{byMember.map(renderBucket)}</div>
            </section>
          )}
        </>
      )}
    </div>
  );
};
