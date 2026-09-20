import React, { useState } from 'react';
import { useApp, useActiveProject } from '../context/AppContext';
import { TaskPriority, TaskStatus } from '../types';
import { Modal } from './ui/Modal';

const FORM_ID = 'create-task-form';

export const CreateTaskModal: React.FC = () => {
  const {
    isCreateTaskModalOpen,
    setIsCreateTaskModalOpen,
    addTask,
    teamMembers,
  } = useApp();
  const activeProject = useActiveProject();

  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [phaseId, setPhaseId] = useState(activeProject.phases[0]?.id || '');
  const [assigneeId, setAssigneeId] = useState(teamMembers[0]?.id || '');
  const [priority, setPriority] = useState<TaskPriority>('medium');
  const [status, setStatus] = useState<TaskStatus>('todo');
  const [startDate, setStartDate] = useState('2026-09-25');
  const [dueDate, setDueDate] = useState('2026-10-05');
  const [estimatedHours, setEstimatedHours] = useState(16);
  const [deliverablesInput, setDeliverablesInput] = useState('Figma Component, Token export');
  const [isCriticalPath, setIsCriticalPath] = useState(false);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim()) return;

    addTask({
      projectId: activeProject.id,
      title,
      description,
      phaseId: phaseId || activeProject.phases[0]?.id || 'phase-1',
      assigneeId: assigneeId || teamMembers[0].id,
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
    <Modal
      open={isCreateTaskModalOpen}
      onClose={() => setIsCreateTaskModalOpen(false)}
      title="Create New Design Task"
      subtitle="Define deliverables and backward schedule deadlines."
      size="lg"
      footer={
        <div className="flex items-center justify-end gap-2">
          <button
            type="button"
            onClick={() => setIsCreateTaskModalOpen(false)}
            className="px-3.5 py-2 rounded-xl bg-elevated hover:bg-line text-fg-muted text-xs font-medium transition-colors"
          >
            Cancel
          </button>
          <button
            type="submit"
            form={FORM_ID}
            className="px-4 py-2 rounded-xl bg-purple-600 hover:bg-purple-500 text-white text-xs font-semibold shadow-md shadow-purple-500/20 transition-all cursor-pointer"
          >
            Create Task
          </button>
        </div>
      }
    >
      <form id={FORM_ID} onSubmit={handleSubmit} className="space-y-3.5 text-xs">
          <div>
            <label className="text-fg-muted font-semibold block mb-1">Task Title *</label>
            <input
              type="text"
              required
              placeholder="e.g. Design Tokens & Semantic Variables Specification"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              className="w-full px-3.5 py-2 rounded-xl bg-elevated border border-line text-fg placeholder-fg-subtle focus:outline-none focus:border-purple-500 transition-colors"
            />
          </div>

          <div>
            <label className="text-fg-muted font-semibold block mb-1">Description</label>
            <textarea
              rows={2}
              placeholder="Deliverable specifications, acceptance criteria..."
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              className="w-full px-3.5 py-2 rounded-xl bg-elevated border border-line text-fg placeholder-fg-subtle focus:outline-none focus:border-purple-500 resize-none transition-colors"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-fg-muted font-semibold block mb-1">Phase</label>
              <select
                value={phaseId}
                onChange={(e) => setPhaseId(e.target.value)}
                className="w-full px-3 py-2 rounded-xl bg-elevated border border-line text-fg focus:outline-none focus:border-purple-500"
              >
                {activeProject.phases.map((p) => (
                  <option key={p.id} value={p.id} className="bg-card text-fg">
                    {p.name}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="text-fg-muted font-semibold block mb-1">Assignee</label>
              <select
                value={assigneeId}
                onChange={(e) => setAssigneeId(e.target.value)}
                className="w-full px-3 py-2 rounded-xl bg-elevated border border-line text-fg focus:outline-none focus:border-purple-500"
              >
                {teamMembers.map((u) => (
                  <option key={u.id} value={u.id} className="bg-card text-fg">
                    {u.name} ({u.role})
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div className="grid grid-cols-3 gap-3">
            <div>
              <label className="text-fg-muted font-semibold block mb-1">Priority</label>
              <select
                value={priority}
                onChange={(e) => setPriority(e.target.value as TaskPriority)}
                className="w-full px-3 py-2 rounded-xl bg-elevated border border-line text-fg focus:outline-none focus:border-purple-500"
              >
                <option value="urgent" className="bg-card text-fg">Urgent</option>
                <option value="high" className="bg-card text-fg">High</option>
                <option value="medium" className="bg-card text-fg">Medium</option>
                <option value="low" className="bg-card text-fg">Low</option>
              </select>
            </div>

            <div>
              <label className="text-fg-muted font-semibold block mb-1">Start Date</label>
              <input
                type="date"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
                className="w-full px-3 py-2 rounded-xl bg-elevated border border-line text-fg focus:outline-none focus:border-purple-500"
              />
            </div>

            <div>
              <label className="text-fg-muted font-semibold block mb-1">Due Date</label>
              <input
                type="date"
                value={dueDate}
                onChange={(e) => setDueDate(e.target.value)}
                className="w-full px-3 py-2 rounded-xl bg-elevated border border-line text-fg focus:outline-none focus:border-purple-500"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-fg-muted font-semibold block mb-1">Estimated Hours</label>
              <input
                type="number"
                min="1"
                max="200"
                value={estimatedHours}
                onChange={(e) => setEstimatedHours(Number(e.target.value))}
                className="w-full px-3 py-2 rounded-xl bg-elevated border border-line text-fg focus:outline-none focus:border-purple-500"
              />
            </div>

            <div>
              <label className="text-fg-muted font-semibold block mb-1">Deliverables (comma-separated)</label>
              <input
                type="text"
                placeholder="Figma Prototype, Styleguide"
                value={deliverablesInput}
                onChange={(e) => setDeliverablesInput(e.target.value)}
                className="w-full px-3 py-2 rounded-xl bg-elevated border border-line text-fg placeholder-fg-subtle focus:outline-none focus:border-purple-500"
              />
            </div>
          </div>

          <div className="pt-1">
            <label className="flex items-center gap-2 cursor-pointer text-fg-muted">
              <input
                type="checkbox"
                checked={isCriticalPath}
                onChange={(e) => setIsCriticalPath(e.target.checked)}
                className="rounded border-line-strong text-rose-500 focus:ring-0 w-3.5 h-3.5"
              />
              <span className="text-xs font-medium">Mark as Critical Path Deliverable</span>
            </label>
          </div>
      </form>
    </Modal>
  );
};
