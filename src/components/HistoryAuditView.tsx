import React, { useState } from 'react';
import { useApp } from '../context/AppContext';
import { MOCK_USERS } from '../data/mockData';
import {
  GitCommit,
  Clock,
  RotateCcw,
  Sparkles,
  Calendar,
  FileText,
  User,
  Filter,
  CheckCircle2,
} from 'lucide-react';
import { HistoryEntry } from '../types';

export const HistoryAuditView: React.FC = () => {
  const { activeProject, revertHistoryState } = useApp();
  const [filterAction, setFilterAction] = useState<string>('all');
  const [filterUser, setFilterUser] = useState<string>('all');

  const filteredHistory = activeProject.history.filter((h) => {
    const matchesAction = filterAction === 'all' || h.actionType === filterAction;
    const matchesUser = filterUser === 'all' || h.userId === filterUser;
    return matchesAction && matchesUser;
  });

  const getActionBadge = (type: HistoryEntry['actionType']) => {
    switch (type) {
      case 'ai_restructure':
        return (
          <span className="px-2 py-0.5 rounded-full bg-purple-500/20 text-purple-300 border border-purple-500/30 text-[10px] font-bold flex items-center gap-1">
            <Sparkles className="w-2.5 h-2.5" />
            AI Restructure
          </span>
        );
      case 'retroplan_shift':
        return (
          <span className="px-2 py-0.5 rounded-full bg-amber-500/20 text-amber-300 border border-amber-500/30 text-[10px] font-bold flex items-center gap-1">
            <Calendar className="w-2.5 h-2.5" />
            Retroplan Shift
          </span>
        );
      case 'status_change':
        return (
          <span className="px-2 py-0.5 rounded-full bg-blue-500/20 text-blue-300 border border-blue-500/30 text-[10px] font-bold flex items-center gap-1">
            <CheckCircle2 className="w-2.5 h-2.5" />
            Status Change
          </span>
        );
      case 'create':
        return (
          <span className="px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 text-[10px] font-bold">
            Created
          </span>
        );
      case 'update':
        return (
          <span className="px-2 py-0.5 rounded-full bg-slate-700 text-slate-300 text-[10px] font-bold">
            Updated
          </span>
        );
      case 'delete':
        return (
          <span className="px-2 py-0.5 rounded-full bg-rose-500/20 text-rose-300 text-[10px] font-bold">
            Deleted
          </span>
        );
      default:
        return (
          <span className="px-2 py-0.5 rounded-full bg-slate-800 text-slate-400 text-[10px] font-bold">
            Event
          </span>
        );
    }
  };

  const formatTimestamp = (ts: string) => {
    try {
      const d = new Date(ts);
      return d.toLocaleDateString('en-US', {
        month: 'short',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
      });
    } catch {
      return ts;
    }
  };

  return (
    <div className="w-full max-w-7xl mx-auto p-3 sm:p-6 space-y-4 sm:space-y-6 overflow-hidden">
      {/* Header & Filter Controls */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4 sm:p-5 shadow-lg flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <GitCommit className="w-4 h-4 text-blue-400" />
            <h2 className="text-base sm:text-lg font-bold text-slate-100">
              Project Editing History & Version Audit Log
            </h2>
          </div>
          <p className="text-xs text-slate-400 mt-0.5">
            Full transparent audit trail tracking who modified what, when, and exact parameter diffs.
          </p>
        </div>

        {/* Filters */}
        <div className="flex items-center gap-2 flex-wrap">
          <select
            value={filterAction}
            onChange={(e) => setFilterAction(e.target.value)}
            className="px-3 py-1.5 rounded-xl bg-slate-850 border border-slate-750 text-xs text-slate-300 focus:outline-none"
          >
            <option value="all">All Actions</option>
            <option value="ai_restructure">AI Restructures</option>
            <option value="retroplan_shift">Retroplan Shifts</option>
            <option value="status_change">Status Changes</option>
            <option value="update">Updates</option>
            <option value="create">Creations</option>
          </select>

          <select
            value={filterUser}
            onChange={(e) => setFilterUser(e.target.value)}
            className="px-3 py-1.5 rounded-xl bg-slate-850 border border-slate-750 text-xs text-slate-300 focus:outline-none"
          >
            <option value="all">All Collaborators</option>
            {MOCK_USERS.map((u) => (
              <option key={u.id} value={u.id}>
                {u.name}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* History Stream */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 shadow-xl">
        {filteredHistory.length === 0 ? (
          <div className="p-8 text-center text-slate-400 text-xs">
            No history records match the selected filters.
          </div>
        ) : (
          <div className="relative pl-6 space-y-6 before:absolute before:left-2.5 before:top-2 before:bottom-2 before:w-0.5 before:bg-slate-800">
            {filteredHistory.map((entry) => (
              <div key={entry.id} className="relative group">
                <div className="absolute -left-6 top-1 w-3 h-3 rounded-full bg-blue-500 border-2 border-slate-900 ring-2 ring-blue-500/20" />

                <div className="bg-slate-850 hover:bg-slate-800/80 p-4 rounded-xl border border-slate-750/80 transition-all space-y-2">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                    <div className="flex items-center gap-2">
                      <img
                        src={entry.userAvatar}
                        alt={entry.userName}
                        className="w-5 h-5 rounded-full object-cover"
                      />
                      <span className="font-bold text-xs text-slate-100">{entry.userName}</span>
                      <span className="text-slate-500">&bull;</span>
                      {getActionBadge(entry.actionType)}
                    </div>

                    <div className="flex items-center gap-2 text-[11px] text-slate-400 font-mono">
                      <Clock className="w-3 h-3" />
                      <span>{formatTimestamp(entry.timestamp)}</span>
                    </div>
                  </div>

                  <p className="text-xs text-slate-300 leading-relaxed">{entry.description}</p>

                  {/* Diff Inspector if available */}
                  {entry.diff && (
                    <div className="p-2.5 rounded-lg bg-slate-900 border border-slate-800 font-mono text-[11px] grid grid-cols-1 sm:grid-cols-2 gap-2 mt-2">
                      <div className="text-rose-400 flex items-center gap-1 truncate">
                        <span className="text-slate-500">- Old ({entry.diff.field}):</span>
                        <span className="truncate">{entry.diff.oldVal}</span>
                      </div>
                      <div className="text-emerald-400 flex items-center gap-1 truncate">
                        <span className="text-slate-500">+ New ({entry.diff.field}):</span>
                        <span className="truncate">{entry.diff.newVal}</span>
                      </div>
                    </div>
                  )}

                  <div className="flex items-center justify-end pt-1">
                    <button
                      onClick={() => revertHistoryState(entry)}
                      className="text-[11px] font-medium text-slate-400 hover:text-blue-400 flex items-center gap-1 transition-colors"
                      title="Revert to state before this change"
                    >
                      <RotateCcw className="w-3 h-3" />
                      <span>Revert State</span>
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};
