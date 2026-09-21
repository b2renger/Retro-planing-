import React, { useCallback, useRef, useState } from 'react';
import { CheckCircle2, ChevronDown, Plus } from 'lucide-react';
import { useApp } from '../context/AppContext';
import { NotificationCenter } from './NotificationCenter';
import { AppMenu } from './navbar/AppMenu';
import { useDismiss } from './navbar/useDismiss';

type Panel = 'menu' | 'notifications';

/**
 * App-scoped chrome only: the brand, the workspace switcher and ONE menu holding settings, the
 * tutorial, invitations, the theme, notifications and the acting persona.
 *
 * Everything that belongs to the open project — new task, export, cloud folder, AI assistant —
 * lives in `ProjectHeader`, so no action is offered twice on the same screen.
 */
export const Navbar: React.FC = () => {
  const { currentUser, workspaces, activeWorkspace, setActiveWorkspaceId, unreadCount, setIsCreateProjectModalOpen } = useApp();

  const [panel, setPanel] = useState<Panel | null>(null);
  const [isWorkspaceDropdownOpen, setIsWorkspaceDropdownOpen] = useState(false);

  const menuRef = useRef<HTMLDivElement>(null);
  const workspaceRef = useRef<HTMLDivElement>(null);
  const closePanel = useCallback(() => setPanel(null), []);
  const closeWorkspaces = useCallback(() => setIsWorkspaceDropdownOpen(false), []);
  useDismiss(menuRef, closePanel, panel !== null);
  useDismiss(workspaceRef, closeWorkspaces, isWorkspaceDropdownOpen);

  return (
    <header className="bg-card/95 backdrop-blur-md border-b border-line text-fg sticky top-0 z-40 px-3 sm:px-4 py-2 w-full max-w-full transition-colors duration-200">
      <div className="max-w-7xl mx-auto flex items-center justify-between gap-2 min-w-0">
        {/* Brand and workspace */}
        <div className="flex items-center gap-2 sm:gap-3 min-w-0">
          <div className="flex items-center gap-2 shrink-0">
            <div className="w-7 h-7 sm:w-8 sm:h-8 rounded-lg sm:rounded-xl bg-gradient-to-tr from-purple-600 via-indigo-600 to-blue-500 flex items-center justify-center shadow-md shadow-purple-500/20 text-white font-bold text-xs sm:text-sm tracking-tight shrink-0">
              RP
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-1 sm:gap-1.5 leading-none">
                <span className="font-semibold text-fg tracking-tight text-xs sm:text-sm truncate">RetroPlan</span>
                <span className="text-[9px] sm:text-[10px] font-semibold px-1 sm:px-1.5 py-0.2 sm:py-0.5 rounded-full bg-purple-100 dark:bg-purple-500/10 text-purple-700 dark:text-purple-400 border border-purple-200 dark:border-purple-500/20 shrink-0">
                  STUDIO
                </span>
              </div>
              <p className="text-[9px] sm:text-[10px] text-fg-muted leading-none mt-0.5 sm:mt-1 truncate hidden xs:block">
                Design Ops &amp; Retroplanning
              </p>
            </div>
          </div>

          <div className="h-4 w-px bg-line hidden md:block" />

          <div className="relative hidden md:block" ref={workspaceRef}>
            <button
              id="workspace-switcher-btn"
              type="button"
              aria-haspopup="menu"
              aria-expanded={isWorkspaceDropdownOpen}
              onClick={() => setIsWorkspaceDropdownOpen((open) => !open)}
              className="flex items-center gap-2 px-2.5 py-1.5 rounded-lg bg-elevated hover:bg-line border border-line text-xs font-medium transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-purple-500"
            >
              <span className="w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: activeWorkspace.color }} />
              <span className="text-fg truncate max-w-[120px]">{activeWorkspace.name}</span>
              <ChevronDown className="w-3 h-3 text-fg-muted shrink-0" />
            </button>

            {isWorkspaceDropdownOpen && (
              <div role="menu" aria-label="Workspaces" className="absolute top-full left-0 mt-1.5 w-64 bg-card border border-line rounded-xl shadow-xl dark:shadow-2xl p-1.5 z-50 animate-fadeIn">
                <div className="text-[10px] font-semibold text-fg-muted px-2 py-1 uppercase tracking-wider">Workspaces</div>
                {workspaces.map((ws) => (
                  <button
                    key={ws.id}
                    type="button"
                    role="menuitem"
                    onClick={() => {
                      setActiveWorkspaceId(ws.id);
                      setIsWorkspaceDropdownOpen(false);
                    }}
                    className={`w-full flex items-center justify-between px-2.5 py-2 rounded-lg text-xs text-left transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-purple-500 ${
                      ws.id === activeWorkspace.id
                        ? 'bg-purple-100 dark:bg-purple-600/20 text-purple-700 dark:text-purple-300 font-semibold'
                        : 'text-fg hover:bg-elevated'
                    }`}
                  >
                    <span className="flex items-center gap-2 truncate">
                      <span className="w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: ws.color }} />
                      <span className="truncate">{ws.name}</span>
                    </span>
                    {ws.id === activeWorkspace.id && <CheckCircle2 className="w-3.5 h-3.5 shrink-0 ml-2" />}
                  </button>
                ))}
                <div className="border-t border-line my-1" />
                <button
                  type="button"
                  role="menuitem"
                  onClick={() => {
                    setIsWorkspaceDropdownOpen(false);
                    setIsCreateProjectModalOpen(true);
                  }}
                  className="w-full flex items-center gap-2 px-2.5 py-1.5 rounded-lg text-xs text-purple-700 dark:text-purple-400 hover:bg-purple-50 dark:hover:bg-purple-500/10 font-medium focus:outline-none focus-visible:ring-2 focus-visible:ring-purple-500"
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>New project</span>
                </button>
              </div>
            )}
          </div>
        </div>

        {/* The one app menu. Its trigger is also the tutorial's anchor for "open Settings". */}
        <div className="relative shrink-0" ref={menuRef}>
          <button
            id="app-menu-btn"
            type="button"
            data-tour="ai-settings"
            aria-haspopup="menu"
            aria-expanded={panel !== null}
            aria-label={unreadCount > 0 ? `Menu, ${unreadCount} unread notifications` : 'Menu'}
            onClick={() => setPanel((p) => (p === null ? 'menu' : null))}
            className="flex items-center gap-1.5 p-1 pr-2 rounded-lg border border-line bg-elevated hover:bg-line transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-purple-500"
          >
            <span className="relative shrink-0">
              <img src={currentUser.avatar} alt="" className="w-6 h-6 sm:w-7 sm:h-7 rounded-full object-cover ring-1 ring-line-strong" />
              {unreadCount > 0 && (
                <span className="absolute -top-1 -right-1 w-3.5 h-3.5 rounded-full bg-rose-500 text-[9px] font-bold text-white flex items-center justify-center">
                  {unreadCount}
                </span>
              )}
            </span>
            <ChevronDown className="w-3 h-3 text-fg-muted shrink-0" />
          </button>

          {panel === 'menu' && <AppMenu onClose={closePanel} onOpenNotifications={() => setPanel('notifications')} />}
          {panel === 'notifications' && <NotificationCenter onClose={closePanel} />}
        </div>
      </div>
    </header>
  );
};
