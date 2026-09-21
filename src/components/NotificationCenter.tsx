import React, { useState } from 'react';
import { useApp } from '../context/AppContext';
import { timestampLabel } from '../utils/time';
import { Bell, Check, Clock, Sparkles, X } from 'lucide-react';

interface NotificationCenterProps {
  onClose: () => void;
}

export const NotificationCenter: React.FC<NotificationCenterProps> = ({ onClose }) => {
  const { notifications, markNotificationRead, markAllNotificationsRead, setActiveViewTab } = useApp();
  const [filter, setFilter] = useState<'all' | 'deadlines' | 'ai'>('all');

  const filtered = notifications.filter((n) => {
    if (filter === 'deadlines') return n.type === 'deadline_warning' || n.type === 'dependency_blocked';
    if (filter === 'ai') return n.type === 'ai_insight';
    return true;
  });

  return (
    <div className="absolute top-full right-0 mt-2 w-80 sm:w-96 bg-card border border-line rounded-xl shadow-xl dark:shadow-2xl z-50 overflow-hidden text-fg transition-colors">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-line bg-elevated">
        <div className="flex items-center gap-2">
          <Bell className="w-4 h-4 text-blue-600 dark:text-blue-400" />
          <span className="font-semibold text-xs tracking-tight text-fg">
            Real-Time Notifications & Alerts
          </span>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={markAllNotificationsRead}
            className="text-[11px] text-blue-600 dark:text-blue-400 hover:text-blue-500 font-medium transition-colors cursor-pointer"
          >
            Mark all read
          </button>
          <button onClick={onClose} className="text-fg-muted hover:text-fg cursor-pointer">
            <X className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Filter Tabs */}
      <div className="flex items-center gap-1 px-3 py-2 bg-elevated/80 border-b border-line text-xs">
        <button
          onClick={() => setFilter('all')}
          className={`px-2.5 py-1 rounded-md text-[11px] font-medium transition-colors cursor-pointer ${
            filter === 'all' ? 'bg-blue-600 text-white' : 'text-fg-muted hover:text-fg'
          }`}
        >
          All ({notifications.length})
        </button>
        <button
          onClick={() => setFilter('deadlines')}
          className={`px-2.5 py-1 rounded-md text-[11px] font-medium transition-colors cursor-pointer ${
            filter === 'deadlines' ? 'bg-amber-600 text-white' : 'text-fg-muted hover:text-fg'
          }`}
        >
          Deadlines & Blockers
        </button>
        <button
          onClick={() => setFilter('ai')}
          className={`px-2.5 py-1 rounded-md text-[11px] font-medium transition-colors cursor-pointer ${
            filter === 'ai' ? 'bg-purple-600 text-white' : 'text-fg-muted hover:text-fg'
          }`}
        >
          AI insights
        </button>
      </div>

      {/* List */}
      <div className="max-h-80 overflow-y-auto divide-y divide-line">
        {filtered.length === 0 ? (
          <div className="p-6 text-center text-fg-muted text-xs">
            No notifications in this filter.
          </div>
        ) : (
          filtered.map((n) => {
            const when = timestampLabel(n.timestamp);
            return (
            <div
              key={n.id}
              onClick={() => {
                markNotificationRead(n.id);
                if (n.type === 'deadline_warning' || n.type === 'dependency_blocked') {
                  setActiveViewTab('retroplanning');
                } else if (n.type === 'ai_insight') {
                  setActiveViewTab('markdown');
                }
              }}
              className={`p-3 text-left transition-colors cursor-pointer hover:bg-elevated flex items-start gap-3 ${
                !n.read ? 'bg-blue-500/10' : ''
              }`}
            >
              <div className="mt-0.5">
                {n.type === 'deadline_warning' ? (
                  <div className="w-6 h-6 rounded-lg bg-rose-500/10 border border-rose-500/30 flex items-center justify-center text-rose-600 dark:text-rose-400">
                    <Clock className="w-3.5 h-3.5" />
                  </div>
                ) : n.type === 'ai_insight' ? (
                  <div className="w-6 h-6 rounded-lg bg-purple-500/10 border border-purple-500/30 flex items-center justify-center text-purple-600 dark:text-purple-400">
                    <Sparkles className="w-3.5 h-3.5" />
                  </div>
                ) : (
                  <div className="w-6 h-6 rounded-lg bg-blue-500/10 border border-blue-500/30 flex items-center justify-center text-blue-600 dark:text-blue-400">
                    <Check className="w-3.5 h-3.5" />
                  </div>
                )}
              </div>

              <div className="flex-1 min-w-0">
                <div className="flex items-center justify-between gap-2">
                  <span className={`text-xs font-semibold truncate ${!n.read ? 'text-fg' : 'text-fg-muted'}`}>
                    {n.title}
                  </span>
                  {when && (
                    <time dateTime={n.timestamp} title={when.title} className="text-[10px] text-fg-muted shrink-0">
                      {when.text}
                    </time>
                  )}
                </div>
                <p className="text-[11px] text-fg-muted mt-0.5 line-clamp-2 leading-relaxed">{n.message}</p>
              </div>

              {!n.read && (
                <div className="w-2 h-2 rounded-full bg-blue-500 shrink-0 mt-1.5" />
              )}
            </div>
            );
          })
        )}
      </div>

      {/* Footer */}
      <div className="p-2.5 bg-elevated border-t border-line text-center">
        <span className="text-[11px] text-fg-muted">
          Schedule insights from the configured AI provider, or the local heuristic when none is set
        </span>
      </div>
    </div>
  );
};
