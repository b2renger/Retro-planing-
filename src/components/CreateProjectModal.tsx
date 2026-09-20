import React, { useState } from 'react';
import { useApp } from '../context/AppContext';
import { Plus, X, Sparkles } from 'lucide-react';
import { Project } from '../types';

export const CreateProjectModal: React.FC = () => {
  const {
    isCreateProjectModalOpen,
    setIsCreateProjectModalOpen,
    createProject,
    currentUser,
  } = useApp();

  const [title, setTitle] = useState('');
  const [clientName, setClientName] = useState('');
  const [targetDeliveryDate, setTargetDeliveryDate] = useState('2026-12-15');

  if (!isCreateProjectModalOpen) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim()) return;

    const newProj: Project = {
      id: `proj-${Date.now()}`,
      workspaceId: 'ws-1',
      title,
      clientName: clientName || 'Enterprise Client',
      description: 'Design operations, component library and visual retroplanning workspace.',
      tags: ['Design', 'Retroplanning'],
      status: 'on-track',
      retroplanningScore: 94,
      targetDeliveryDate,
      startDate: new Date().toISOString().split('T')[0],
      phases: [
        {
          id: `p-${Date.now()}-1`,
          name: '1. Discovery & Design Strategy',
          color: '#3B82F6',
          startDate: '2026-10-01',
          endDate: '2026-10-14',
          bufferDays: 3,
          order: 1,
          isCriticalPath: true,
        },
        {
          id: `p-${Date.now()}-2`,
          name: '2. Wireframing & Design Systems',
          color: '#8B5CF6',
          startDate: '2026-10-15',
          endDate: '2026-11-05',
          bufferDays: 4,
          order: 2,
          isCriticalPath: true,
        },
        {
          id: `p-${Date.now()}-3`,
          name: '3. Hi-Fi Polish & Dev Handoff',
          color: '#EC4899',
          startDate: '2026-11-06',
          endDate: targetDeliveryDate,
          bufferDays: 5,
          order: 3,
          isCriticalPath: true,
        },
      ],
      tasks: [
        {
          id: `t-${Date.now()}-1`,
          projectId: `proj-${Date.now()}`,
          phaseId: `p-${Date.now()}-1`,
          title: 'Stakeholder Alignment & Design Audit',
          description: 'Initial review of requirements and competitive benchmarking.',
          assigneeId: 'user-1',
          priority: 'high',
          status: 'in-progress',
          startDate: '2026-10-01',
          dueDate: '2026-10-07',
          estimatedHours: 12,
          dependencies: [],
          deliverables: ['Audit Deck', 'Figma Moodboard'],
          checklist: [
            { id: 'c1', text: 'Brand questionnaire', completed: true },
            { id: 'c2', text: 'Audit competitive products', completed: false },
          ],
          isCriticalPath: true,
          tags: ['Discovery', 'Strategy'],
        },
      ],
      milestones: [
        {
          id: `m-${Date.now()}-1`,
          title: 'Design System Token Freeze',
          targetDate: '2026-11-01',
          isHardDeadline: true,
          completed: false,
          description: 'All color variables and typography scales locked.',
          deliverableCount: 6,
        },
        {
          id: `m-${Date.now()}-2`,
          title: 'Target Launch & Dev Handoff',
          targetDate: targetDeliveryDate,
          isHardDeadline: true,
          completed: false,
          description: 'Production-ready spec handoff to engineering.',
          deliverableCount: 12,
        },
      ],
      documents: [
        {
          id: `doc-${Date.now()}-1`,
          title: 'Project Brief & Scope.md',
          path: 'briefs/scope.md',
          content: `# ${title}\n\nTarget Delivery: ${targetDeliveryDate}\nClient: ${clientName}\n\n## Objectives\n- [ ] Deliver unified design system\n- [ ] Create high-fidelity interactive prototype\n`,
          tags: ['Brief'],
          lastModified: new Date().toISOString(),
          lastModifiedBy: 'Alex Rivera',
        },
      ],
      comments: [],
      history: [
        {
          id: `hist-${Date.now()}`,
          userId: currentUser.id,
          userName: currentUser.name,
          userAvatar: currentUser.avatar,
          actionType: 'create',
          targetType: 'project',
          targetTitle: title,
          description: `Initialized project "${title}" with target delivery ${targetDeliveryDate}`,
          timestamp: new Date().toISOString(),
        },
      ],
      clarificationQuestions: [
        {
          id: `q-${Date.now()}`,
          question: 'Are motion animations and micro-interactions required in scope?',
          suggestedOptions: ['Include Lottie Animations (Adds 12h)', 'Standard Transitions Only', 'Defer to Phase 2'],
          resolved: false,
          reason: 'Timeline buffer depends on animation complexity.',
        },
      ],
    };

    createProject(newProj);
    setIsCreateProjectModalOpen(false);
  };

  return (
    <div className="fixed inset-0 bg-slate-950/70 backdrop-blur-sm flex items-center justify-center p-4 z-50 animate-fadeIn">
      <div className="bg-[#0D121F] border border-white/10 rounded-2xl w-full max-w-lg shadow-2xl overflow-hidden text-slate-100 p-5 space-y-4">
        <div className="flex items-center justify-between pb-3 border-b border-white/10">
          <div className="flex items-center gap-2">
            <div className="w-7 h-7 rounded-lg bg-purple-600/20 text-purple-400 flex items-center justify-center border border-purple-500/30">
              <Plus className="w-4 h-4" />
            </div>
            <div>
              <h3 className="font-semibold text-sm text-slate-100">Create New Project</h3>
              <p className="text-[11px] text-slate-400 mt-0.5">Initialize retroplanning schedule and milestones.</p>
            </div>
          </div>
          <button
            onClick={() => setIsCreateProjectModalOpen(false)}
            className="text-slate-400 hover:text-slate-200 p-1.5 rounded-lg hover:bg-white/5 transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4 text-xs">
          <div>
            <label className="text-slate-400 font-semibold block mb-1">Project Name *</label>
            <input
              type="text"
              required
              placeholder="e.g. Fintech Mobile App Redesign"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              className="w-full px-3.5 py-2.5 rounded-xl bg-white/[0.04] border border-white/10 text-slate-100 placeholder-slate-500 focus:outline-none focus:border-purple-500 transition-colors"
            />
          </div>

          <div>
            <label className="text-slate-400 font-semibold block mb-1">Client / Stakeholder / Course</label>
            <input
              type="text"
              placeholder="e.g. Acme Corp / UX Capstone 2026"
              value={clientName}
              onChange={(e) => setClientName(e.target.value)}
              className="w-full px-3.5 py-2.5 rounded-xl bg-white/[0.04] border border-white/10 text-slate-100 placeholder-slate-500 focus:outline-none focus:border-purple-500 transition-colors"
            />
          </div>

          <div>
            <label className="text-slate-400 font-semibold block mb-1">
              Rétroplanning Launch Date (Target Delivery Anchor) *
            </label>
            <input
              type="date"
              required
              value={targetDeliveryDate}
              onChange={(e) => setTargetDeliveryDate(e.target.value)}
              className="w-full px-3.5 py-2.5 rounded-xl bg-white/[0.04] border border-white/10 text-amber-400 font-bold focus:outline-none focus:border-purple-500 transition-colors"
            />
            <span className="text-[10px] text-slate-400 mt-1 block">
              All phases and buffers will be reverse-calculated backwards from this hard date.
            </span>
          </div>

          <div className="pt-2 flex items-center justify-end gap-2">
            <button
              type="button"
              onClick={() => setIsCreateProjectModalOpen(false)}
              className="px-3.5 py-2 rounded-xl bg-white/5 hover:bg-white/10 text-slate-300 font-medium transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="px-4 py-2 rounded-xl bg-purple-600 hover:bg-purple-500 text-white font-semibold shadow-md shadow-purple-500/20 flex items-center gap-1.5 transition-all cursor-pointer"
            >
              <Sparkles className="w-3.5 h-3.5" />
              <span>Initialize Workspace</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
