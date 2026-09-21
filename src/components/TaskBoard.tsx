import React, { useState } from 'react';
import { useApp, useActiveProject } from '../context/AppContext';
import { resolveAssignee, shortAssigneeName } from './assignee';
import {
  Kanban,
  List,
  Plus,
  Pencil,
  User,
  Zap,
} from 'lucide-react';
import { TaskStatus } from '../types';
import { TASK_STATUSES, TASK_STATUS_ACCENTS, TASK_STATUS_LABELS } from './taskFields';

export const TaskBoard: React.FC = () => {
  const {
    updateTaskStatus,
    setIsCreateTaskModalOpen,
    setEditingTaskId,
    teamMembers,
  } = useApp();
  const activeProject = useActiveProject();

  const [viewMode, setViewMode] = useState<'kanban' | 'table'>('kanban');
  const [selectedPhase, setSelectedPhase] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState('');

  const columns: { id: TaskStatus; label: string; color: string }[] = TASK_STATUSES.map((id) => ({
    id,
    label: TASK_STATUS_LABELS[id],
    color: TASK_STATUS_ACCENTS[id],
  }));

  const filteredTasks = activeProject.tasks.filter((t) => {
    const matchesPhase = selectedPhase === 'all' || t.phaseId === selectedPhase;
    const matchesSearch =
      t.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
      t.description.toLowerCase().includes(searchQuery.toLowerCase()) ||
      t.tags.some((tag) => tag.toLowerCase().includes(searchQuery.toLowerCase()));
    return matchesPhase && matchesSearch;
  });

  const getAssignee = (userId: string) => resolveAssignee(userId, teamMembers);

  const getPhase = (phaseId: string) => {
    return activeProject.phases.find((p) => p.id === phaseId);
  };

  return (
    <div className="w-full max-w-7xl mx-auto p-3 sm:p-6 space-y-4 sm:space-y-6 overflow-hidden">
      {/* Task Board Controls */}
      <div className="bg-card border border-line rounded-2xl p-4 sm:p-5 shadow-sm dark:shadow-lg flex flex-col lg:flex-row lg:items-center justify-between gap-4 transition-colors">
        <div className="flex items-center gap-3 flex-wrap flex-1">
          {/* Search Input */}
          <input
            type="text"
            placeholder="Search tasks, tags, deliverables..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="px-3.5 py-2 rounded-xl bg-elevated border border-line text-xs text-fg placeholder-fg-subtle focus:outline-none focus:border-purple-500 min-w-[220px] transition-colors"
          />

          {/* Phase Filter Dropdown */}
          <select
            value={selectedPhase}
            onChange={(e) => setSelectedPhase(e.target.value)}
            className="px-3 py-2 rounded-xl bg-elevated border border-line text-xs text-fg focus:outline-none focus:border-purple-500"
          >
            <option value="all" className="bg-card text-fg">All Phases ({activeProject.phases.length})</option>
            {activeProject.phases.map((p) => (
              <option key={p.id} value={p.id} className="bg-card text-fg">
                {p.name}
              </option>
            ))}
          </select>
        </div>

        <div className="flex items-center gap-3">
          {/* View Toggle */}
          <div className="flex items-center bg-elevated border border-line rounded-xl p-1 text-xs">
            <button
              onClick={() => setViewMode('kanban')}
              className={`px-3 py-1.5 rounded-lg flex items-center gap-1.5 font-medium transition-colors ${
                viewMode === 'kanban' ? 'bg-purple-600 text-white' : 'text-fg-muted hover:text-fg'
              }`}
            >
              <Kanban className="w-3.5 h-3.5" />
              <span>Kanban</span>
            </button>
            <button
              onClick={() => setViewMode('table')}
              className={`px-3 py-1.5 rounded-lg flex items-center gap-1.5 font-medium transition-colors ${
                viewMode === 'table' ? 'bg-purple-600 text-white' : 'text-fg-muted hover:text-fg'
              }`}
            >
              <List className="w-3.5 h-3.5" />
              <span>Table</span>
            </button>
          </div>

          <button
            data-tour="new-task"
            onClick={() => setIsCreateTaskModalOpen(true)}
            className="px-3.5 py-2 rounded-xl bg-purple-600 hover:bg-purple-500 text-white text-xs font-semibold flex items-center gap-1.5 shadow-md shadow-purple-500/20 transition-all cursor-pointer"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>Add Task</span>
          </button>
        </div>
      </div>

      {/* Kanban View */}
      {viewMode === 'kanban' ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 gap-4 sm:gap-5 items-start">
          {columns.map((col) => {
            const colTasks = filteredTasks.filter((t) => t.status === col.id);
            return (
              <div
                key={col.id}
                className="bg-card border border-line rounded-2xl p-4 space-y-3 shadow-sm dark:shadow-md transition-colors"
              >
                {/* Column Header */}
                <div className="flex items-center justify-between pb-2 border-b border-line">
                  <div className="flex items-center gap-2">
                    <span className="font-semibold text-xs text-fg">{col.label}</span>
                    <span className="text-[10px] font-semibold px-2 py-0.2 rounded-full bg-elevated text-fg-muted">
                      {colTasks.length}
                    </span>
                  </div>
                </div>

                {/* Cards */}
                <div className="space-y-3 min-h-[150px]">
                  {colTasks.length === 0 ? (
                    <div className="p-6 text-center text-fg-subtle text-xs border border-dashed border-line rounded-xl">
                      Empty column
                    </div>
                  ) : (
                    colTasks.map((task) => {
                      const assignee = getAssignee(task.assigneeId);
                      const phase = getPhase(task.phaseId);

                      return (
                        <div
                          key={task.id}
                          className="bg-elevated/70 hover:bg-elevated border border-line hover:border-purple-300 dark:hover:border-purple-500/30 rounded-xl p-3.5 space-y-2.5 transition-all shadow-sm group"
                        >
                          <div className="flex items-start justify-between gap-2">
                            <button
                              type="button"
                              onClick={() => setEditingTaskId(task.id)}
                              title="Edit this task"
                              className="text-left font-semibold text-xs text-fg group-hover:text-purple-600 dark:group-hover:text-purple-300 transition-colors"
                            >
                              {task.title}
                            </button>
                            <span
                              className={`text-[9px] font-semibold px-1.5 py-0.2 rounded uppercase shrink-0 ${
                                task.priority === 'urgent'
                                  ? 'bg-rose-100 dark:bg-rose-500/20 text-rose-700 dark:text-rose-300 border border-rose-200 dark:border-rose-500/30'
                                  : task.priority === 'high'
                                  ? 'bg-amber-100 dark:bg-amber-500/20 text-amber-700 dark:text-amber-300 border border-amber-200 dark:border-amber-500/30'
                                  : 'bg-line text-fg-muted'
                              }`}
                            >
                              {task.priority}
                            </span>
                          </div>

                          <p className="text-[11px] text-fg-muted line-clamp-2 leading-relaxed">
                            {task.description}
                          </p>

                          {/* Phase tag & Critical Path */}
                          <div className="flex items-center gap-1.5 flex-wrap">
                            {phase && (
                              <span
                                className="text-[9px] font-medium px-2 py-0.5 rounded-full"
                                style={{
                                  backgroundColor: `${phase.color}20`,
                                  color: phase.color,
                                }}
                              >
                                {phase.name}
                              </span>
                            )}
                            {task.isCriticalPath && (
                              <span className="text-[9px] font-semibold px-2 py-0.5 rounded-full bg-rose-100 dark:bg-rose-500/20 text-rose-700 dark:text-rose-300 border border-rose-200 dark:border-rose-500/30 flex items-center gap-1">
                                <Zap className="w-2.5 h-2.5" />
                                Critical
                              </span>
                            )}
                          </div>

                          {/* Checklists */}
                          {task.checklist.length > 0 && (
                            <div className="text-[10px] text-fg-muted flex items-center justify-between pt-1">
                              <span>Subtasks:</span>
                              <span className="font-mono text-purple-600 dark:text-purple-300">
                                {task.checklist.filter((c) => c.completed).length}/{task.checklist.length}
                              </span>
                            </div>
                          )}

                          {/* Bottom Card Controls: Assignee, Due Date & Quick Move */}
                          <div className="flex items-center justify-between pt-2 border-t border-line text-[11px] text-fg-muted">
                            <div className="flex items-center gap-1.5" title={assignee.name}>
                              {assignee.avatar ? (
                                <img src={assignee.avatar} alt="" className="w-4 h-4 rounded-full object-cover" />
                              ) : (
                                <User className="w-3.5 h-3.5 text-fg-subtle shrink-0" aria-hidden="true" />
                              )}
                              <span className={`truncate max-w-[80px] ${assignee.known ? '' : 'italic text-fg-subtle'}`}>
                                {shortAssigneeName(assignee)}
                              </span>
                            </div>

                            {/* Status mover select */}
                            <select
                              value={task.status}
                              onChange={(e) => updateTaskStatus(task.id, e.target.value as TaskStatus)}
                              className="bg-line/80 text-fg text-[10px] rounded px-2 py-0.5 border border-line-strong focus:outline-none focus:border-purple-500"
                            >
                              {TASK_STATUSES.map((s) => (
                                <option key={s} value={s} className="bg-card">
                                  {TASK_STATUS_LABELS[s]}
                                </option>
                              ))}
                            </select>
                          </div>
                        </div>
                      );
                    })
                  )}
                </div>
              </div>
            );
          })}
        </div>
      ) : (
        /* Table View */
        <div className="bg-card border border-line rounded-2xl overflow-hidden shadow-sm dark:shadow-xl transition-colors">
          <table className="w-full text-left text-xs text-fg">
            <thead className="bg-elevated border-b border-line text-[11px] uppercase font-semibold text-fg-muted">
              <tr>
                <th className="p-3.5">Task & Deliverables</th>
                <th className="p-3.5">Phase</th>
                <th className="p-3.5">Assignee</th>
                <th className="p-3.5">Priority</th>
                <th className="p-3.5">Status</th>
                <th className="p-3.5">Due Date</th>
                <th className="p-3.5">Hours</th>
                <th className="p-3.5 text-right">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-line">
              {filteredTasks.map((t) => {
                const assignee = getAssignee(t.assigneeId);
                const phase = getPhase(t.phaseId);
                return (
                  <tr key={t.id} className="hover:bg-elevated/60 transition-colors">
                    <td className="p-3.5 font-medium text-fg">
                      <div>{t.title}</div>
                      <div className="text-[10px] text-fg-muted truncate max-w-xs">{t.description}</div>
                    </td>
                    <td className="p-3.5">
                      {phase && (
                        <span
                          className="text-[10px] font-medium px-2 py-0.5 rounded-full"
                          style={{
                            backgroundColor: `${phase.color}20`,
                            color: phase.color,
                          }}
                        >
                          {phase.name}
                        </span>
                      )}
                    </td>
                    <td className="p-3.5">
                      <div className="flex items-center gap-1.5">
                        {assignee.avatar ? (
                          <img src={assignee.avatar} alt="" className="w-4 h-4 rounded-full object-cover" />
                        ) : (
                          <User className="w-3.5 h-3.5 text-fg-subtle shrink-0" aria-hidden="true" />
                        )}
                        <span className={assignee.known ? '' : 'italic text-fg-subtle'}>{assignee.name}</span>
                      </div>
                    </td>
                    <td className="p-3.5">
                      <span className="uppercase text-[10px] font-semibold text-fg-muted">{t.priority}</span>
                    </td>
                    <td className="p-3.5">
                      <select
                        value={t.status}
                        onChange={(e) => updateTaskStatus(t.id, e.target.value as TaskStatus)}
                        className="bg-elevated text-fg text-xs rounded px-2 py-1 border border-line-strong"
                      >
                        {TASK_STATUSES.map((s) => (
                          <option key={s} value={s} className="bg-card">
                            {TASK_STATUS_LABELS[s]}
                          </option>
                        ))}
                      </select>
                    </td>
                    <td className="p-3.5 font-mono text-amber-600 dark:text-amber-400">{t.dueDate}</td>
                    <td className="p-3.5 font-mono">{t.estimatedHours}h</td>
                    <td className="p-3.5 text-right">
                      <button
                        onClick={() => setEditingTaskId(t.id)}
                        className="inline-flex items-center gap-1 p-1 text-fg-muted hover:text-purple-600 dark:hover:text-purple-400 transition-colors cursor-pointer"
                        title="Edit or delete this task"
                      >
                        <Pencil className="w-3.5 h-3.5" />
                        <span className="text-[11px]">Edit</span>
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
};
