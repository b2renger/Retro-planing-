import React, { useState } from 'react';
import { useApp } from '../context/AppContext';
import { MOCK_USERS } from '../data/mockData';
import { X } from 'lucide-react';
import { TaskPriority, TaskStatus } from '../types';

export const CreateTaskModal: React.FC = () => {
  const {
    activeProject,
    isCreateTaskModalOpen,
    setIsCreateTaskModalOpen,
    addTask,
  } = useApp();

  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [phaseId, setPhaseId] = useState(activeProject.phases[0]?.id || '');
  const [assigneeId, setAssigneeId] = useState(MOCK_USERS[0]?.id || '');
  const [priority, setPriority] = useState<TaskPriority>('medium');
  const [status, setStatus] = useState<TaskStatus>('todo');
  const [startDate, setStartDate] = useState('2026-09-25');
  const [dueDate, setDueDate] = useState('2026-10-05');
  const [estimatedHours, setEstimatedHours] = useState(16);
  const [deliverablesInput, setDeliverablesInput] = useState('Figma Component, Token export');
  const [isCriticalPath, setIsCriticalPath] = useState(false);

  if (!isCreateTaskModalOpen) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim()) return;

    addTask({
      projectId: activeProject.id,
      title,
      description,
      phaseId: phaseId || activeProject.phases[0]?.id || 'phase-1',
      assigneeId: assigneeId || MOCK_USERS[0].id,
      priority,
      status,
      startDate,
      dueDate,
      estimatedHours: Number(estimatedHours) || 8,
      dependencies: [],
      deliverables: deliverablesInput
        .split(',')
        .map((d) => d.trim())
        .filter(Boolean),
      checklist: [
        { id: `c-${Date.now()}-1`, text: 'Initial design review', completed: false },
        { id: `c-${Date.now()}-2`, text: 'Deliverable sign-off', completed: false },
      ],
      isCriticalPath,
      tags: ['Design', priority],
    });

    setIsCreateTaskModalOpen(false);
  };

  return (
    <div className="fixed inset-0 bg-slate-950/70 backdrop-blur-sm flex items-center justify-center p-4 z-50 animate-fadeIn">
      <div className="bg-[#0D121F] border border-white/10 rounded-2xl w-full max-w-lg shadow-2xl overflow-hidden text-slate-100 p-5 space-y-4">
        <div className="flex items-center justify-between pb-3 border-b border-white/10">
          <div>
            <h3 className="font-semibold text-sm text-slate-100">Create New Design Task</h3>
            <p className="text-[11px] text-slate-400 mt-0.5">Define deliverables and backward schedule deadlines.</p>
          </div>
          <button
            onClick={() => setIsCreateTaskModalOpen(false)}
            className="text-slate-400 hover:text-slate-200 p-1.5 rounded-lg hover:bg-white/5 transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-3.5 text-xs">
          <div>
            <label className="text-slate-400 font-semibold block mb-1">Task Title *</label>
            <input
              type="text"
              required
              placeholder="e.g. Design Tokens & Semantic Variables Specification"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              className="w-full px-3.5 py-2 rounded-xl bg-white/[0.04] border border-white/10 text-slate-100 placeholder-slate-500 focus:outline-none focus:border-purple-500 transition-colors"
            />
          </div>

          <div>
            <label className="text-slate-400 font-semibold block mb-1">Description</label>
            <textarea
              rows={2}
              placeholder="Deliverable specifications, acceptance criteria..."
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              className="w-full px-3.5 py-2 rounded-xl bg-white/[0.04] border border-white/10 text-slate-100 placeholder-slate-500 focus:outline-none focus:border-purple-500 resize-none transition-colors"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-slate-400 font-semibold block mb-1">Phase</label>
              <select
                value={phaseId}
                onChange={(e) => setPhaseId(e.target.value)}
                className="w-full px-3 py-2 rounded-xl bg-white/[0.04] border border-white/10 text-slate-200 focus:outline-none focus:border-purple-500"
              >
                {activeProject.phases.map((p) => (
                  <option key={p.id} value={p.id} className="bg-[#0D121F] text-slate-200">
                    {p.name}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="text-slate-400 font-semibold block mb-1">Assignee</label>
              <select
                value={assigneeId}
                onChange={(e) => setAssigneeId(e.target.value)}
                className="w-full px-3 py-2 rounded-xl bg-white/[0.04] border border-white/10 text-slate-200 focus:outline-none focus:border-purple-500"
              >
                {MOCK_USERS.map((u) => (
                  <option key={u.id} value={u.id} className="bg-[#0D121F] text-slate-200">
                    {u.name} ({u.role})
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div className="grid grid-cols-3 gap-3">
            <div>
              <label className="text-slate-400 font-semibold block mb-1">Priority</label>
              <select
                value={priority}
                onChange={(e) => setPriority(e.target.value as TaskPriority)}
                className="w-full px-3 py-2 rounded-xl bg-white/[0.04] border border-white/10 text-slate-200 focus:outline-none focus:border-purple-500"
              >
                <option value="urgent" className="bg-[#0D121F] text-slate-200">Urgent</option>
                <option value="high" className="bg-[#0D121F] text-slate-200">High</option>
                <option value="medium" className="bg-[#0D121F] text-slate-200">Medium</option>
                <option value="low" className="bg-[#0D121F] text-slate-200">Low</option>
              </select>
            </div>

            <div>
              <label className="text-slate-400 font-semibold block mb-1">Start Date</label>
              <input
                type="date"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
                className="w-full px-3 py-2 rounded-xl bg-white/[0.04] border border-white/10 text-slate-200 focus:outline-none focus:border-purple-500"
              />
            </div>

            <div>
              <label className="text-slate-400 font-semibold block mb-1">Due Date</label>
              <input
                type="date"
                value={dueDate}
                onChange={(e) => setDueDate(e.target.value)}
                className="w-full px-3 py-2 rounded-xl bg-white/[0.04] border border-white/10 text-slate-200 focus:outline-none focus:border-purple-500"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-slate-400 font-semibold block mb-1">Estimated Hours</label>
              <input
                type="number"
                min="1"
                max="200"
                value={estimatedHours}
                onChange={(e) => setEstimatedHours(Number(e.target.value))}
                className="w-full px-3 py-2 rounded-xl bg-white/[0.04] border border-white/10 text-slate-200 focus:outline-none focus:border-purple-500"
              />
            </div>

            <div>
              <label className="text-slate-400 font-semibold block mb-1">Deliverables (comma-separated)</label>
              <input
                type="text"
                placeholder="Figma Prototype, Styleguide"
                value={deliverablesInput}
                onChange={(e) => setDeliverablesInput(e.target.value)}
                className="w-full px-3 py-2 rounded-xl bg-white/[0.04] border border-white/10 text-slate-200 placeholder-slate-500 focus:outline-none focus:border-purple-500"
              />
            </div>
          </div>

          <div className="pt-2 flex items-center justify-between">
            <label className="flex items-center gap-2 cursor-pointer text-slate-300">
              <input
                type="checkbox"
                checked={isCriticalPath}
                onChange={(e) => setIsCriticalPath(e.target.checked)}
                className="rounded border-slate-700 text-rose-500 focus:ring-0 w-3.5 h-3.5"
              />
              <span className="text-xs font-medium">Mark as Critical Path Deliverable</span>
            </label>

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => setIsCreateTaskModalOpen(false)}
                className="px-3.5 py-2 rounded-xl bg-white/5 hover:bg-white/10 text-slate-300 font-medium transition-colors"
              >
                Cancel
              </button>
              <button
                type="submit"
                className="px-4 py-2 rounded-xl bg-purple-600 hover:bg-purple-500 text-white font-semibold shadow-md shadow-purple-500/20 transition-all cursor-pointer"
              >
                Create Task
              </button>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
};
