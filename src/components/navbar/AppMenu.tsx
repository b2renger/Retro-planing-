import React from 'react';
import { Bell, CheckCircle2, GraduationCap, Key, Monitor, Moon, Plus, Sun, UserPlus } from 'lucide-react';
import { useApp } from '../../context/AppContext';
import { FIRST_STEP_ID } from '../tutorial/steps';

const THEME_OPTIONS = [
  { value: 'dark' as const, label: 'Dark theme', icon: Moon },
  { value: 'light' as const, label: 'Light theme', icon: Sun },
  { value: 'system' as const, label: 'Follow system theme', icon: Monitor },
];

const ITEM =
  'w-full flex items-center justify-between gap-3 px-2 py-2 rounded-lg text-xs text-left font-medium text-fg hover:bg-elevated transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-purple-500';
const SECTION = 'text-[10px] font-semibold text-fg-muted px-2 py-1 uppercase tracking-wider';

export interface AppMenuProps {
  /** Close the menu (the caller owns the open state and the anchor). */
  onClose: () => void;
  /** Switch the panel to the notification list, which shares this trigger. */
  onOpenNotifications: () => void;
}

/**
 * The single app-scoped menu: account, notifications, settings, tutorial, invite, theme and — on
 * small screens, where the bar has no room for the switcher — workspaces.
 *
 * Everything that is not about the open project lives here and nowhere else, so the navbar, the
 * project header and the views stopped offering three paths to the same dialog.
 */
export const AppMenu: React.FC<AppMenuProps> = ({ onClose, onOpenNotifications }) => {
  const {
    currentUser,
    setCurrentUser,
    teamMembers,
    theme,
    setTheme,
    unreadCount,
    activeAiProvider,
    workspaces,
    activeWorkspace,
    setActiveWorkspaceId,
    setIsSettingsOpen,
    setIsInviteModalOpen,
    setIsCreateProjectModalOpen,
    tutorial,
    startTutorial,
  } = useApp();

  const tutorialLabel = tutorial.currentStepId && tutorial.status !== 'running' ? 'Resume the tutorial' : 'Tutorial';

  const run = (action: () => void) => () => {
    onClose();
    action();
  };

  return (
    <div
      role="menu"
      aria-label="Application menu"
      className="absolute top-full right-0 mt-1.5 w-[min(20rem,calc(100vw-1.5rem))] bg-card border border-line rounded-xl shadow-xl dark:shadow-2xl p-2 z-50 animate-fadeIn max-h-[80vh] overflow-y-auto"
    >
      <div className="px-2 py-1.5 border-b border-line mb-1">
        <p className="text-[11px] font-semibold text-fg">{currentUser.name}</p>
        <p className="text-[10px] text-fg-muted font-mono truncate">{currentUser.email}</p>
        <p className="text-[10px] text-purple-600 dark:text-purple-400 font-medium mt-0.5">{currentUser.role}</p>
      </div>

      <button type="button" role="menuitem" onClick={run(onOpenNotifications)} className={ITEM}>
        <span className="flex items-center gap-2.5">
          <Bell className="w-4 h-4 text-blue-600 dark:text-blue-400 shrink-0" />
          <span>Notifications</span>
        </span>
        {unreadCount > 0 && (
          <span className="shrink-0 rounded-full bg-rose-500 px-1.5 text-[10px] font-bold text-white">{unreadCount}</span>
        )}
      </button>

      {/* The tutorial's `ai-settings` anchor is the menu trigger, not this item: a coachmark can
          only point at something that is on screen, and this item is behind a closed menu. */}
      <button type="button" role="menuitem" onClick={run(() => setIsSettingsOpen(true))} className={ITEM}>
        <span className="flex items-center gap-2.5">
          <Key className="w-4 h-4 text-amber-600 dark:text-amber-400 shrink-0" />
          <span>Settings</span>
        </span>
        <span className={`shrink-0 font-mono text-[10px] ${activeAiProvider ? 'text-emerald-700 dark:text-emerald-400' : 'text-fg-muted'}`}>
          {activeAiProvider ? activeAiProvider.model : 'No AI provider'}
        </span>
      </button>

      <button type="button" role="menuitem" onClick={run(() => startTutorial(tutorial.currentStepId ?? FIRST_STEP_ID))} className={ITEM}>
        <span className="flex items-center gap-2.5">
          <GraduationCap className="w-4 h-4 text-purple-600 dark:text-purple-400 shrink-0" />
          <span>{tutorialLabel}</span>
        </span>
      </button>

      <button type="button" role="menuitem" onClick={run(() => setIsInviteModalOpen(true))} className={ITEM}>
        <span className="flex items-center gap-2.5">
          <UserPlus className="w-4 h-4 text-purple-600 dark:text-purple-400 shrink-0" />
          <span>Invite collaborators</span>
        </span>
      </button>

      <div className="border-t border-line my-1" />

      <div className={SECTION}>Theme</div>
      <div role="radiogroup" aria-label="Colour theme" className="flex items-center gap-0.5 p-0.5 mx-1 mb-1 rounded-lg bg-elevated border border-line">
        {THEME_OPTIONS.map((opt) => {
          const Icon = opt.icon;
          const selected = theme === opt.value;
          return (
            <button
              key={opt.value}
              type="button"
              role="radio"
              aria-checked={selected}
              aria-label={opt.label}
              title={opt.label}
              onClick={() => setTheme(opt.value)}
              className={`flex-1 py-1.5 rounded-md transition-colors flex items-center justify-center focus:outline-none focus-visible:ring-2 focus-visible:ring-purple-500 ${
                selected ? 'bg-card text-fg shadow-sm' : 'text-fg-muted hover:text-fg hover:bg-line'
              }`}
            >
              <Icon className="w-3.5 h-3.5" />
            </button>
          );
        })}
      </div>

      <div className="border-t border-line my-1 md:hidden" />
      <div className={`${SECTION} md:hidden`}>Workspace</div>
      <div className="md:hidden">
        {workspaces.map((ws) => (
          <button
            key={ws.id}
            type="button"
            role="menuitem"
            onClick={run(() => setActiveWorkspaceId(ws.id))}
            className={`${ITEM} ${ws.id === activeWorkspace.id ? 'text-purple-800 dark:text-purple-300 font-semibold' : ''}`}
          >
            <span className="flex items-center gap-2.5 truncate">
              <span className="w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: ws.color }} />
              <span className="truncate">{ws.name}</span>
            </span>
            {ws.id === activeWorkspace.id && <CheckCircle2 className="w-3.5 h-3.5 shrink-0" />}
          </button>
        ))}
        <button type="button" role="menuitem" onClick={run(() => setIsCreateProjectModalOpen(true))} className={ITEM}>
          <span className="flex items-center gap-2.5 text-purple-700 dark:text-purple-400">
            <Plus className="w-4 h-4 shrink-0" />
            <span>New project</span>
          </span>
        </button>
      </div>

      <div className="border-t border-line my-1" />
      <div className={SECTION}>Acting as</div>
      {teamMembers.map((user) => (
        <button
          key={user.id}
          type="button"
          role="menuitem"
          onClick={run(() => setCurrentUser(user.id))}
          className={`${ITEM} ${user.id === currentUser.id ? 'bg-purple-100 dark:bg-purple-600/20' : ''}`}
        >
          <span className="flex items-center gap-2.5 truncate">
            <img src={user.avatar} alt="" className="w-6 h-6 rounded-full object-cover shrink-0" />
            <span className="truncate">
              <span className="block truncate">{user.name}</span>
              <span className="block text-[10px] text-fg-muted truncate">{user.role}</span>
            </span>
          </span>
          {user.id === currentUser.id && <CheckCircle2 className="w-3.5 h-3.5 shrink-0 text-purple-600 dark:text-purple-400" />}
        </button>
      ))}
    </div>
  );
};
