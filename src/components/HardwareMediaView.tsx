import React, { useState } from 'react';
import { useApp, useActiveProject } from '../context/AppContext';
import {
  HardDrive,
  Tv,
  Volume2,
  Cpu,
  Layers,
  CheckCircle2,
  Clock,
  AlertCircle,
  FileText,
  Sparkles,
  Plus,
  Calendar,
  ShieldCheck,
  Zap,
  ExternalLink,
  Film,
  Music,
  Check,
  Radio,
  Sliders,
  Play,
  RotateCcw,
  Eye,
} from 'lucide-react';
import { HardwareItem, MediaAssetItem } from '../types';

export const HardwareMediaView: React.FC = () => {
  const { setActiveViewTab, setIsCloudPanelOpen, addNotification } = useApp();
  const activeProject = useActiveProject();
  const [activeSubTab, setActiveSubTab] = useState<'hardware' | 'media' | 'booking' | 'testing' | 'review'>('hardware');
  const [hardwareCategoryFilter, setHardwareCategoryFilter] = useState<string>('all');

  const hardwareList: HardwareItem[] = activeProject.hardwareItems || [];
  const mediaList: MediaAssetItem[] = activeProject.mediaAssets || [];

  const filteredHardware =
    hardwareCategoryFilter === 'all'
      ? hardwareList
      : hardwareList.filter((item) => item.category === hardwareCategoryFilter);

  // Group tasks by phase for quick reference
  const bookingTasks = activeProject.tasks.filter((t) => t.phaseId.includes('booking') || t.phaseId === 'p1-booking');
  const mediaTasks = activeProject.tasks.filter((t) => t.phaseId.includes('media') || t.phaseId === 'p2-media');
  const testingTasks = activeProject.tasks.filter((t) => t.phaseId.includes('testing') || t.phaseId === 'p3-testing');
  const reviewTasks = activeProject.tasks.filter((t) => t.phaseId.includes('review') || t.phaseId === 'p4-review');

  const getStatusBadge = (status: HardwareItem['status']) => {
    switch (status) {
      case 'booked':
        return (
          <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-blue-500/10 text-blue-600 dark:text-blue-400 border border-blue-500/20 flex items-center gap-1">
            <CheckCircle2 className="w-3 h-3" /> Booked
          </span>
        );
      case 'delivered':
        return (
          <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-purple-500/10 text-purple-700 dark:text-purple-300 border border-purple-500/20 flex items-center gap-1">
            <Zap className="w-3 h-3" /> Delivered
          </span>
        );
      case 'tested':
        return (
          <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20 flex items-center gap-1">
            <ShieldCheck className="w-3 h-3" /> Tested & Passed
          </span>
        );
      default:
        return (
          <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/20 flex items-center gap-1">
            <Clock className="w-3 h-3" /> Pending
          </span>
        );
    }
  };

  const getMediaStatusBadge = (status: MediaAssetItem['status']) => {
    switch (status) {
      case 'approved':
        return (
          <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20 flex items-center gap-1">
            <CheckCircle2 className="w-3 h-3" /> Master Approved
          </span>
        );
      case 'in-production':
        return (
          <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/20 flex items-center gap-1">
            <Clock className="w-3 h-3" /> In Production
          </span>
        );
      case 'rendered':
        return (
          <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-purple-500/10 text-purple-700 dark:text-purple-300 border border-purple-500/20 flex items-center gap-1">
            <Sparkles className="w-3 h-3" /> Rendered
          </span>
        );
      default:
        return (
          <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-slate-500/10 text-fg-muted border border-slate-500/20">
            Planning
          </span>
        );
    }
  };

  const getCategoryIcon = (category: HardwareItem['category']) => {
    switch (category) {
      case 'Projection':
        return <Tv className="w-4 h-4 text-blue-600 dark:text-blue-400" />;
      case 'Audio':
        return <Volume2 className="w-4 h-4 text-purple-600 dark:text-purple-400" />;
      case 'Media Server & Network':
        return <Cpu className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />;
      case 'Rigging & Power':
        return <Layers className="w-4 h-4 text-amber-600 dark:text-amber-400" />;
    }
  };

  return (
    <div className="space-y-4 max-w-7xl mx-auto pb-12">
      {/* Top Banner: Media Installation Specs Overview */}
      <div className="bg-card border border-line rounded-2xl p-4 sm:p-5 shadow-sm dark:shadow-xl transition-colors">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
          <div className="space-y-1.5 min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold tracking-wider uppercase bg-purple-100 dark:bg-purple-500/20 text-purple-700 dark:text-purple-300 border border-purple-200 dark:border-purple-500/30">
                Installation Cockpit
              </span>
              <span className="px-2.5 py-0.5 rounded-full text-[10px] font-medium bg-blue-100 dark:bg-blue-500/10 text-blue-800 dark:text-blue-300 border border-blue-200 dark:border-blue-500/20">
                Dual 20K Projection &bull; 8.1 Spatial Dante
              </span>
            </div>
            <h2 className="text-lg sm:text-xl font-bold text-fg tracking-tight">
              Hardware Manifest, Media Assets & Phase Execution
            </h2>
            <p className="text-xs text-fg-muted max-w-3xl leading-relaxed">
              Complete hardware inventory, booking confirmations, media production roster (4K video loops & 8.1 spatial stems), on-site testing checklists, and review milestones.
            </p>
          </div>

          <div className="flex items-center gap-2 shrink-0 flex-wrap">
            <button
              onClick={() => setActiveViewTab('markdown')}
              className="px-3 py-2 rounded-xl bg-purple-50 dark:bg-purple-600/20 hover:bg-purple-100 dark:hover:bg-purple-600/30 border border-purple-200 dark:border-purple-500/30 text-purple-800 dark:text-purple-200 text-xs font-semibold flex items-center gap-1.5 transition-colors cursor-pointer"
            >
              <FileText className="w-3.5 h-3.5 text-purple-600 dark:text-purple-400" />
              <span>Read Full Brief (.md)</span>
            </button>
            <button
              onClick={() => setIsCloudPanelOpen(true)}
              className="px-3 py-2 rounded-xl bg-blue-600 hover:bg-blue-500 text-white text-xs font-semibold flex items-center gap-1.5 shadow-md shadow-blue-600/20 transition-all cursor-pointer"
            >
              <HardDrive className="w-3.5 h-3.5" />
              <span>Cloud folder</span>
            </button>
          </div>
        </div>

        {/* Quick Metrics Bar */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mt-4 pt-4 border-t border-line">
          <div className="bg-elevated/60 border border-line p-3 rounded-xl">
            <div className="text-[10px] text-fg-muted font-semibold uppercase tracking-wider flex items-center gap-1.5">
              <Tv className="w-3 h-3 text-blue-600 dark:text-blue-400" />
              <span>Hardware Units</span>
            </div>
            <div className="text-base font-bold text-fg mt-1 font-mono">
              {hardwareList.length} Items Listed
            </div>
            <div className="text-[10px] text-emerald-600 dark:text-emerald-400 mt-0.5">
              100% Booked & Confirmed
            </div>
          </div>

          <div className="bg-elevated/60 border border-line p-3 rounded-xl">
            <div className="text-[10px] text-fg-muted font-semibold uppercase tracking-wider flex items-center gap-1.5">
              <Film className="w-3 h-3 text-purple-600 dark:text-purple-400" />
              <span>Media Assets</span>
            </div>
            <div className="text-base font-bold text-fg mt-1 font-mono">
              {mediaList.length} Tracks & Stems
            </div>
            <div className="text-[10px] text-purple-600 dark:text-purple-300 mt-0.5">
              4K ProRes & 8.1 Spatial WAV
            </div>
          </div>

          <div className="bg-elevated/60 border border-line p-3 rounded-xl">
            <div className="text-[10px] text-fg-muted font-semibold uppercase tracking-wider flex items-center gap-1.5">
              <ShieldCheck className="w-3 h-3 text-emerald-600 dark:text-emerald-400" />
              <span>Testing Phase</span>
            </div>
            <div className="text-base font-bold text-fg mt-1 font-mono">
              12 To-Do Checkpoints
            </div>
            <div className="text-[10px] text-blue-600 dark:text-blue-400 mt-0.5">
              Edge-Blend & Dante Delay
            </div>
          </div>

          <div className="bg-elevated/60 border border-line p-3 rounded-xl">
            <div className="text-[10px] text-fg-muted font-semibold uppercase tracking-wider flex items-center gap-1.5">
              <Calendar className="w-3 h-3 text-amber-600 dark:text-amber-400" />
              <span>Opening Night</span>
            </div>
            <div className="text-base font-bold text-amber-600 dark:text-amber-400 mt-1 font-mono">
              {activeProject.targetDeliveryDate}
            </div>
            <div className="text-[10px] text-fg-muted mt-0.5">
              6 Days Safety Margin
            </div>
          </div>
        </div>
      </div>

      {/* Sub-Navigation Tabs */}
      <div className="flex items-center gap-1.5 border-b border-line pb-2 overflow-x-auto">
        <button
          onClick={() => setActiveSubTab('hardware')}
          className={`px-3.5 py-2 rounded-xl text-xs font-semibold flex items-center gap-2 transition-all shrink-0 cursor-pointer ${
            activeSubTab === 'hardware'
              ? 'bg-blue-100 dark:bg-blue-600/20 text-blue-800 dark:text-blue-200 border border-blue-300 dark:border-blue-500/40 shadow-sm'
              : 'text-fg-muted hover:text-fg hover:bg-elevated'
          }`}
        >
          <Tv className="w-3.5 h-3.5 text-blue-600 dark:text-blue-400" />
          <span>Hardware Manifest ({hardwareList.length})</span>
        </button>

        <button
          onClick={() => setActiveSubTab('media')}
          className={`px-3.5 py-2 rounded-xl text-xs font-semibold flex items-center gap-2 transition-all shrink-0 cursor-pointer ${
            activeSubTab === 'media'
              ? 'bg-purple-100 dark:bg-purple-600/20 text-purple-800 dark:text-purple-200 border border-purple-300 dark:border-purple-500/40 shadow-sm'
              : 'text-fg-muted hover:text-fg hover:bg-elevated'
          }`}
        >
          <Film className="w-3.5 h-3.5 text-purple-600 dark:text-purple-400" />
          <span>Media Creation Roster ({mediaList.length})</span>
        </button>

        <button
          onClick={() => setActiveSubTab('booking')}
          className={`px-3.5 py-2 rounded-xl text-xs font-semibold flex items-center gap-2 transition-all shrink-0 cursor-pointer ${
            activeSubTab === 'booking'
              ? 'bg-emerald-100 dark:bg-emerald-600/20 text-emerald-800 dark:text-emerald-200 border border-emerald-300 dark:border-emerald-500/40 shadow-sm'
              : 'text-fg-muted hover:text-fg hover:bg-elevated'
          }`}
        >
          <Calendar className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />
          <span>Booking Phase ({bookingTasks.length} Tasks)</span>
        </button>

        <button
          onClick={() => setActiveSubTab('testing')}
          className={`px-3.5 py-2 rounded-xl text-xs font-semibold flex items-center gap-2 transition-all shrink-0 cursor-pointer ${
            activeSubTab === 'testing'
              ? 'bg-pink-100 dark:bg-pink-600/20 text-pink-800 dark:text-pink-200 border border-pink-300 dark:border-pink-500/40 shadow-sm'
              : 'text-fg-muted hover:text-fg hover:bg-elevated'
          }`}
        >
          <Zap className="w-3.5 h-3.5 text-pink-600 dark:text-pink-400" />
          <span>Testing Phase To-Dos ({testingTasks.length} Tasks)</span>
        </button>

        <button
          onClick={() => setActiveSubTab('review')}
          className={`px-3.5 py-2 rounded-xl text-xs font-semibold flex items-center gap-2 transition-all shrink-0 cursor-pointer ${
            activeSubTab === 'review'
              ? 'bg-amber-100 dark:bg-amber-600/20 text-amber-800 dark:text-amber-200 border border-amber-300 dark:border-amber-500/40 shadow-sm'
              : 'text-fg-muted hover:text-fg hover:bg-elevated'
          }`}
        >
          <ShieldCheck className="w-3.5 h-3.5 text-amber-600 dark:text-amber-400" />
          <span>Review & Rehearsal ({reviewTasks.length} Tasks)</span>
        </button>
      </div>

      {/* Tab 1: Hardware Manifest */}
      {activeSubTab === 'hardware' && (
        <div className="space-y-3 animate-fadeIn">
          {/* Category Filter Pills */}
          <div className="flex items-center gap-2 overflow-x-auto pb-1">
            {['all', 'Projection', 'Audio', 'Media Server & Network', 'Rigging & Power'].map((cat) => (
              <button
                key={cat}
                onClick={() => setHardwareCategoryFilter(cat)}
                className={`px-3 py-1 rounded-lg text-xs font-medium transition-colors shrink-0 cursor-pointer ${
                  hardwareCategoryFilter === cat
                    ? 'bg-elevated text-white dark:bg-line-strong dark:text-white font-semibold'
                    : 'text-fg-muted hover:text-fg hover:bg-elevated'
                }`}
              >
                {cat === 'all' ? 'All Hardware' : cat}
              </button>
            ))}
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {filteredHardware.map((item) => (
              <div
                key={item.id}
                className="bg-card border border-line hover:border-line-strong rounded-xl p-4 transition-all space-y-2.5 shadow-sm dark:shadow-none"
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="flex items-start gap-2.5">
                    <div className="w-8 h-8 rounded-lg bg-elevated border border-line flex items-center justify-center shrink-0 mt-0.5">
                      {getCategoryIcon(item.category)}
                    </div>
                    <div>
                      <h4 className="text-sm font-semibold text-fg">{item.name}</h4>
                      <div className="text-[11px] text-fg-muted flex items-center gap-2 mt-0.5">
                        <span className="font-mono text-purple-600 dark:text-purple-300">Qty: {item.quantity}</span>
                        <span>&bull;</span>
                        <span>{item.category}</span>
                      </div>
                    </div>
                  </div>
                  {getStatusBadge(item.status)}
                </div>

                <div className="bg-code p-2.5 rounded-lg text-xs text-fg font-mono text-[11px] border border-line">
                  {item.specs}
                </div>

                {item.vendor && (
                  <div className="flex items-center justify-between text-[11px] text-fg-muted pt-1 border-t border-line">
                    <span>Vendor: <strong className="text-fg">{item.vendor}</strong></span>
                    {item.notes && <span className="truncate max-w-[240px] text-fg-subtle italic">{item.notes}</span>}
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Tab 2: Media Creation Roster */}
      {activeSubTab === 'media' && (
        <div className="space-y-3 animate-fadeIn">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {mediaList.map((asset) => (
              <div
                key={asset.id}
                className="bg-card border border-line hover:border-line-strong rounded-xl p-4 transition-all space-y-3 shadow-sm dark:shadow-none"
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="flex items-start gap-2.5">
                    <div
                      className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 mt-0.5 ${
                        asset.type === 'video'
                          ? 'bg-blue-100 dark:bg-blue-600/20 text-blue-700 dark:text-blue-400 border border-blue-200 dark:border-blue-500/30'
                          : 'bg-purple-100 dark:bg-purple-600/20 text-purple-700 dark:text-purple-400 border border-purple-200 dark:border-purple-500/30'
                      }`}
                    >
                      {asset.type === 'video' ? <Film className="w-4 h-4" /> : <Music className="w-4 h-4" />}
                    </div>
                    <div>
                      <h4 className="text-sm font-semibold text-fg">{asset.title}</h4>
                      <div className="text-[11px] text-fg-muted flex items-center gap-2 mt-0.5">
                        <span className="capitalize font-medium text-fg">{asset.type} Track</span>
                        <span>&bull;</span>
                        <span className="font-mono text-purple-600 dark:text-purple-300">{asset.duration}</span>
                      </div>
                    </div>
                  </div>
                  {getMediaStatusBadge(asset.status)}
                </div>

                <div className="bg-code p-2.5 rounded-lg text-[11px] text-fg font-mono border border-line">
                  Format: {asset.format}
                </div>

                <p className="text-xs text-fg-muted leading-relaxed">
                  {asset.description}
                </p>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Tab 3: Booking Phase */}
      {activeSubTab === 'booking' && (
        <div className="space-y-3 animate-fadeIn">
          <div className="p-3 bg-blue-50 dark:bg-blue-950/20 border border-blue-200 dark:border-blue-500/30 rounded-xl text-xs text-blue-800 dark:text-blue-300 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Calendar className="w-4 h-4 text-blue-600 dark:text-blue-400" />
              <span>Phase 1: Booking & Procurement Window (Sept 15 &rarr; Oct 05, 2026)</span>
            </div>
            <span className="font-semibold text-blue-900 dark:text-blue-200">Status: Completed ✅</span>
          </div>

          <div className="space-y-2">
            {bookingTasks.map((t) => (
              <div key={t.id} className="bg-card border border-line rounded-xl p-3.5 space-y-2 shadow-sm dark:shadow-none">
                <div className="flex items-center justify-between">
                  <span className="font-semibold text-xs text-fg">{t.title}</span>
                  <span className="px-2 py-0.5 rounded text-[10px] bg-emerald-100 dark:bg-emerald-500/20 text-emerald-800 dark:text-emerald-300 font-semibold uppercase">
                    {t.status}
                  </span>
                </div>
                <p className="text-xs text-fg-muted">{t.description}</p>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5 pt-1">
                  {t.checklist.map((item) => (
                    <div key={item.id} className="flex items-center gap-2 text-[11px] text-fg bg-elevated/60 p-1.5 rounded-lg border border-line">
                      <CheckCircle2 className={`w-3.5 h-3.5 ${item.completed ? 'text-emerald-600 dark:text-emerald-400' : 'text-fg-subtle'}`} />
                      <span className={item.completed ? 'line-through text-fg-subtle' : ''}>{item.text}</span>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Tab 4: Testing Phase To-Dos */}
      {activeSubTab === 'testing' && (
        <div className="space-y-3 animate-fadeIn">
          <div className="p-3 bg-pink-50 dark:bg-pink-950/20 border border-pink-200 dark:border-pink-500/30 rounded-xl text-xs text-pink-800 dark:text-pink-300 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Zap className="w-4 h-4 text-pink-600 dark:text-pink-400" />
              <span>Phase 3: On-Site Testing & Calibration Window (Oct 29 &rarr; Nov 12, 2026)</span>
            </div>
            <span className="font-semibold text-pink-900 dark:text-pink-200">12 Checkpoint Verification To-Dos</span>
          </div>

          <div className="space-y-3">
            {testingTasks.map((t) => (
              <div key={t.id} className="bg-card border border-line rounded-xl p-4 space-y-3 shadow-sm dark:shadow-none">
                <div className="flex items-center justify-between gap-2">
                  <div>
                    <h4 className="font-semibold text-sm text-fg">{t.title}</h4>
                    <p className="text-xs text-fg-muted mt-0.5">{t.description}</p>
                  </div>
                  <span className="px-2.5 py-1 rounded-full text-xs font-semibold bg-amber-100 dark:bg-amber-500/10 text-amber-800 dark:text-amber-400 border border-amber-200 dark:border-amber-500/20 shrink-0">
                    {t.estimatedHours}h allocated
                  </span>
                </div>

                <div className="space-y-1.5 bg-code p-3 rounded-xl border border-line">
                  <div className="text-[10px] font-semibold text-fg-muted uppercase tracking-wider mb-2">
                    To-Do Calibration Checkpoints
                  </div>
                  {t.checklist.map((c) => (
                    <div key={c.id} className="flex items-start gap-2.5 text-xs text-fg">
                      <div className="w-4 h-4 rounded border border-line-strong flex items-center justify-center shrink-0 mt-0.5 bg-elevated">
                        {c.completed && <Check className="w-3 h-3 text-emerald-600 dark:text-emerald-400" />}
                      </div>
                      <span>{c.text}</span>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Tab 5: Review & Rehearsal */}
      {activeSubTab === 'review' && (
        <div className="space-y-3 animate-fadeIn">
          <div className="p-3 bg-emerald-50 dark:bg-emerald-950/20 border border-emerald-200 dark:border-emerald-500/30 rounded-xl text-xs text-emerald-800 dark:text-emerald-300 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <ShieldCheck className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
              <span>Phase 4: Rehearsal & Stakeholder Review (Nov 13 &rarr; Nov 20, 2026)</span>
            </div>
            <span className="font-semibold text-emerald-900 dark:text-emerald-200">Opening Night Target</span>
          </div>

          <div className="space-y-3">
            {reviewTasks.map((t) => (
              <div key={t.id} className="bg-card border border-line rounded-xl p-4 space-y-2 shadow-sm dark:shadow-none">
                <div className="flex items-center justify-between">
                  <h4 className="font-semibold text-sm text-fg">{t.title}</h4>
                  <span className="text-xs text-emerald-600 dark:text-emerald-400 font-mono">Due: {t.dueDate}</span>
                </div>
                <p className="text-xs text-fg-muted">{t.description}</p>
                <div className="space-y-1.5 pt-2">
                  {t.checklist.map((c) => (
                    <div key={c.id} className="flex items-center gap-2 text-xs text-fg">
                      <div className="w-3.5 h-3.5 rounded border border-line-strong flex items-center justify-center bg-elevated shrink-0" />
                      <span>{c.text}</span>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};
