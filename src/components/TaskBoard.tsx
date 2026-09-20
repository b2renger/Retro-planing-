import React, { useState } from 'react';
import { useApp, useActiveProject } from '../context/AppContext';
import { MOCK_USERS } from '../data/mockData';
import {
  Kanban,
  List,
  Plus,
  Filter,
  CheckCircle2,
  Clock,
  AlertTriangle,
  ChevronRight,
  MoreHorizontal,
  Trash2,
  User,
  Zap,
} from 'lucide-react';
import { Task, TaskStatus, TaskPriority } from '../types';

export const TaskBoard: React.FC = () => {
  const {
    updateTaskStatus,
    toggleChecklistItem,
    deleteTask,
    setIsCreateTaskModalOpen,
  } = useApp();
  const activeProject = useActiveProject();

  const [viewMode, setViewMode] = useState<'kanban' | 'table'>('kanban');
  const [selectedPhase, setSelectedPhase] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState('');

  const columns: { id: TaskStatus; label: string; color: string }[] = [
    { id: 'todo', label: 'To Do', color: 'border-slate-700' },
    { id: 'in-progress', label: 'In Progress', color: 'border-blue-500/40' },
    { id: 'in-review', label: 'In Review / QA', color: 'border-purple-500/40' },
    { id: 'done', label: 'Done', color: 'border-emerald-500/40' },
  ];

  const filteredTasks = activeProject.tasks.filter((t) => {
    const matchesPhase = selectedPhase === 'all' || t.phaseId === selectedPhase;
    const matchesSearch =
      t.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
      t.description.toLowerCase().includes(searchQuery.toLowerCase()) ||
      t.tags.some((tag) => tag.toLowerCase().includes(searchQuery.toLowerCase()));
    return matchesPhase && matchesSearch;
  });

  const getAssignee = (userId: string) => {
    return MOCK_USERS.find((u) => u.id === userId) || MOCK_USERS[0];
  };

  const getPhase = (phaseId: string) => {
    return activeProject.phases.find((p) => p.id === phaseId);
  };

  return (
    <div className="w-full max-w-7xl mx-auto p-3 sm:p-6 space-y-4 sm:space-y-6 overflow-hidden">
      {/* Task Board Controls */}
      <div className="bg-white dark:bg-[#0D121F] border border-slate-200 dark:border-white/10 rounded-2xl p-4 sm:p-5 shadow-sm dark:shadow-lg flex flex-col lg:flex-row lg:items-center justify-between gap-4 transition-colors">
        <div className="flex items-center gap-3 flex-wrap flex-1">
          {/* Search Input */}
          <input
            type="text"
            placeholder="Search tasks, tags, deliverables..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="px-3.5 py-2 rounded-xl bg-slate-100 dark:bg-white/[0.04] border border-slate-200 dark:border-white/10 text-xs text-slate-900 dark:text-slate-100 placeholder-slate-400 dark:placeholder-slate-500 focus:outline-none focus:border-purple-500 min-w-[220px] transition-colors"
          />

          {/* Phase Filter Dropdown */}
          <select
            value={selectedPhase}
            onChange={(e) => setSelectedPhase(e.target.value)}
            className="px-3 py-2 rounded-xl bg-slate-100 dark:bg-white/[0.04] border border-slate-200 dark:border-white/10 text-xs text-slate-700 dark:text-slate-300 focus:outline-none focus:border-purple-500"
          >
            <option value="all" className="bg-white dark:bg-[#0D121F] text-slate-900 dark:text-slate-200">All Phases ({activeProject.phases.length})</option>
            {activeProject.phases.map((p) => (
              <option key={p.id} value={p.id} className="bg-white dark:bg-[#0D121F] text-slate-900 dark:text-slate-200">
                {p.name}
              </option>
            ))}
          </select>
        </div>

        <div className="flex items-center gap-3">
          {/* View Toggle */}
          <div className="flex items-center bg-slate-100 dark:bg-white/[0.04] border border-slate-200 dark:border-white/10 rounded-xl p-1 text-xs">
            <button
              onClick={() => setViewMode('kanban')}
              className={`px-3 py-1.5 rounded-lg flex items-center gap-1.5 font-medium transition-colors ${
                viewMode === 'kanban' ? 'bg-purple-600 text-white' : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200'
              }`}
            >
              <Kanban className="w-3.5 h-3.5" />
              <span>Kanban</span>
            </button>
            <button
              onClick={() => setViewMode('table')}
              className={`px-3 py-1.5 rounded-lg flex items-center gap-1.5 font-medium transition-colors ${
                viewMode === 'table' ? 'bg-purple-600 text-white' : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200'
              }`}
            >
              <List className="w-3.5 h-3.5" />
              <span>Table</span>
            </button>
          </div>

          <button
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
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 sm:gap-5 items-start">
          {columns.map((col) => {
            const colTasks = filteredTasks.filter((t) => t.status === col.id);
            return (
              <div
                key={col.id}
                className="bg-white dark:bg-[#0D121F] border border-slate-200 dark:border-white/10 rounded-2xl p-4 space-y-3 shadow-sm dark:shadow-md transition-colors"
              >
                {/* Column Header */}
                <div className="flex items-center justify-between pb-2 border-b border-slate-200 dark:border-white/10">
                  <div className="flex items-center gap-2">
                    <span className="font-semibold text-xs text-slate-900 dark:text-slate-200">{col.label}</span>
                    <span className="text-[10px] font-semibold px-2 py-0.2 rounded-full bg-slate-100 dark:bg-white/5 text-slate-600 dark:text-slate-400">
                      {colTasks.length}
                    </span>
                  </div>
                </div>

                {/* Cards */}
                <div className="space-y-3 min-h-[150px]">
                  {colTasks.length === 0 ? (
                    <div className="p-6 text-center text-slate-400 dark:text-slate-500 text-xs border border-dashed border-slate-200 dark:border-white/10 rounded-xl">
                      Empty column
                    </div>
                  ) : (
                    colTasks.map((task) => {
                      const assignee = getAssignee(task.assigneeId);
                      const phase = getPhase(task.phaseId);

                      return (
                        <div
                          key={task.id}
                          className="bg-slate-50 dark:bg-[#141B2D]/70 hover:bg-slate-100 dark:hover:bg-[#141B2D] border border-slate-200 dark:border-white/10 hover:border-purple-300 dark:hover:border-purple-500/30 rounded-xl p-3.5 space-y-2.5 transition-all shadow-sm group"
                        >
                          <div className="flex items-start justify-between gap-2">
                            <span className="font-semibold text-xs text-slate-900 dark:text-slate-100 group-hover:text-purple-600 dark:group-hover:text-purple-300 transition-colors">
                              {task.title}
                            </span>
                            <span
                              className={`text-[9px] font-semibold px-1.5 py-0.2 rounded uppercase shrink-0 ${
                                task.priority === 'urgent'
                                  ? 'bg-rose-100 dark:bg-rose-500/20 text-rose-700 dark:text-rose-300 border border-rose-200 dark:border-rose-500/30'
                                  : task.priority === 'high'
                                  ? 'bg-amber-100 dark:bg-amber-500/20 text-amber-700 dark:text-amber-300 border border-amber-200 dark:border-amber-500/30'
                                  : 'bg-slate-200 dark:bg-white/5 text-slate-600 dark:text-slate-400'
                              }`}
                            >
                              {task.priority}
                            </span>
                          </div>

                          <p className="text-[11px] text-slate-600 dark:text-slate-400 line-clamp-2 leading-relaxed">
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
                            <div className="text-[10px] text-slate-500 dark:text-slate-400 flex items-center justify-between pt-1">
                              <span>Subtasks:</span>
                              <span className="font-mono text-purple-600 dark:text-purple-300">
                                {task.checklist.filter((c) => c.completed).length}/{task.checklist.length}
                              </span>
                            </div>
                          )}

                          {/* Bottom Card Controls: Assignee, Due Date & Quick Move */}
                          <div className="flex items-center justify-between pt-2 border-t border-slate-200 dark:border-white/5 text-[11px] text-slate-500 dark:text-slate-400">
                            <div className="flex items-center gap-1.5">
                              <img
                                src={assignee.avatar}
                                alt={assignee.name}
                                className="w-4 h-4 rounded-full object-cover"
                              />
                              <span className="truncate max-w-[80px]">{assignee.name.split(' ')[0]}</span>
                            </div>

                            {/* Status mover select */}
                            <select
                              value={task.status}
                              onChange={(e) => updateTaskStatus(task.id, e.target.value as TaskStatus)}
                              className="bg-slate-200/80 dark:bg-black/30 text-slate-800 dark:text-slate-300 text-[10px] rounded px-2 py-0.5 border border-slate-300 dark:border-white/10 focus:outline-none focus:border-purple-500"
                            >
                              <option value="todo" className="bg-white dark:bg-[#0D121F]">To Do</option>
                              <option value="in-progress" className="bg-white dark:bg-[#0D121F]">In Progress</option>
                              <option value="in-review" className="bg-white dark:bg-[#0D121F]">In Review</option>
                              <option value="done" className="bg-white dark:bg-[#0D121F]">Done</option>
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
        <div className="bg-white dark:bg-[#0D121F] border border-slate-200 dark:border-white/10 rounded-2xl overflow-hidden shadow-sm dark:shadow-xl transition-colors">
          <table className="w-full text-left text-xs text-slate-700 dark:text-slate-300">
            <thead className="bg-slate-100 dark:bg-[#141B2D] border-b border-slate-200 dark:border-white/10 text-[11px] uppercase font-semibold text-slate-600 dark:text-slate-400">
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
            <tbody className="divide-y divide-slate-200 dark:divide-white/5">
              {filteredTasks.map((t) => {
                const assignee = getAssignee(t.assigneeId);
                const phase = getPhase(t.phaseId);
                return (
                  <tr key={t.id} className="hover:bg-slate-50 dark:hover:bg-white/[0.02] transition-colors">
                    <td className="p-3.5 font-medium text-slate-900 dark:text-slate-100">
                      <div>{t.title}</div>
                      <div className="text-[10px] text-slate-500 dark:text-slate-400 truncate max-w-xs">{t.description}</div>
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
                        <img src={assignee.avatar} alt={assignee.name} className="w-4 h-4 rounded-full object-cover" />
                        <span>{assignee.name}</span>
                      </div>
                    </td>
                    <td className="p-3.5">
                      <span className="uppercase text-[10px] font-semibold text-slate-500 dark:text-slate-400">{t.priority}</span>
                    </td>
                    <td className="p-3.5">
                      <select
                        value={t.status}
                        onChange={(e) => updateTaskStatus(t.id, e.target.value as TaskStatus)}
                        className="bg-slate-100 dark:bg-black/30 text-slate-800 dark:text-slate-300 text-xs rounded px-2 py-1 border border-slate-300 dark:border-white/10"
                      >
                        <option value="todo" className="bg-white dark:bg-[#0D121F]">To Do</option>
                        <option value="in-progress" className="bg-white dark:bg-[#0D121F]">In Progress</option>
                        <option value="in-review" className="bg-white dark:bg-[#0D121F]">In Review</option>
                        <option value="done" className="bg-white dark:bg-[#0D121F]">Done</option>
                      </select>
                    </td>
                    <td className="p-3.5 font-mono text-amber-600 dark:text-amber-400">{t.dueDate}</td>
                    <td className="p-3.5 font-mono">{t.estimatedHours}h</td>
                    <td className="p-3.5 text-right">
                      <button
                        onClick={() => deleteTask(t.id)}
                        className="p-1 text-slate-400 hover:text-rose-600 dark:hover:text-rose-400 transition-colors cursor-pointer"
                        title="Delete Task"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
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
