import React from 'react';
import { AlertTriangle, Check, CloudOff, HardDrive, Loader2, LogIn, RefreshCw } from 'lucide-react';
import { useApp } from '../context/AppContext';
import { useCloudConnect } from '../hooks/useCloudConnect';
import { relativeTime } from '../utils/time';

/** Re-renders every 30 s so "synced 4 min ago" stays true without a global timer. */
function useTick(intervalMs = 30_000): void {
  const [, setNow] = React.useState(0);
  React.useEffect(() => {
    const id = window.setInterval(() => setNow((n) => n + 1), intervalMs);
    return () => window.clearInterval(id);
  }, [intervalMs]);
}

/**
 * The project's cloud folder: state and the way in, in one control. It reports only what actually
 * happened — an unlinked project says so, and a "synced" label appears only when a sync really
 * produced a timestamp.
 */
export const CloudStatusChip: React.FC<{ id?: string }> = ({ id = 'cloud-status-chip' }) => {
  const { cloudStatus, activeProject, setIsCloudPanelOpen } = useApp();
  const { busy, connect } = useCloudConnect();
  useTick();

  const link = activeProject?.cloud ?? null;
  // An expired sign-in is the one state where the chip does something other than open the panel:
  // it IS the fix, so one click runs the flow. The click is a real user gesture, which is what the
  // web popup needs anyway.
  const expiredFor = cloudStatus.state === 'expired' ? (cloudStatus.providerId ?? link?.providerId ?? null) : null;
  const reconnecting = expiredFor !== null && busy === expiredFor;
  const lastSyncAt = cloudStatus.lastSyncAt ?? link?.lastSyncAt;
  const ago = relativeTime(lastSyncAt);

  let icon = <HardDrive className="w-3.5 h-3.5 text-fg-muted shrink-0" />;
  let label = 'Cloud';
  let tone = 'bg-elevated hover:bg-line border-line text-fg-muted';
  let title = 'Cloud sync';

  if (!activeProject) {
    label = 'Cloud';
    title = 'Open a project to link a cloud folder';
  } else if (!link) {
    icon = <CloudOff className="w-3.5 h-3.5 text-fg-muted shrink-0" />;
    label = 'Not linked';
    title = 'This project is not linked to a cloud folder';
  } else if (cloudStatus.state === 'syncing') {
    icon = <RefreshCw className="w-3.5 h-3.5 text-blue-600 dark:text-blue-400 shrink-0 animate-spin" />;
    label = 'Syncing…';
    tone = 'bg-blue-500/10 hover:bg-blue-500/20 border-blue-500/30 text-blue-700 dark:text-blue-300';
    title = 'A sync is running';
  } else if (expiredFor) {
    icon = reconnecting ? (
      <Loader2 className="w-3.5 h-3.5 text-amber-600 dark:text-amber-400 shrink-0 animate-spin" />
    ) : (
      <LogIn className="w-3.5 h-3.5 text-amber-600 dark:text-amber-400 shrink-0" />
    );
    label = reconnecting ? 'Signing in…' : 'Reconnect';
    tone = 'bg-amber-500/10 hover:bg-amber-500/20 border-amber-500/30 text-amber-700 dark:text-amber-300';
    title = 'Your sign-in has expired. Click to sign in again — nothing was lost and nothing needs re-entering.';
  } else if (cloudStatus.state === 'error') {
    icon = <AlertTriangle className="w-3.5 h-3.5 text-rose-600 dark:text-rose-400 shrink-0" />;
    label = 'Sync error';
    tone = 'bg-rose-500/10 hover:bg-rose-500/20 border-rose-500/30 text-rose-700 dark:text-rose-300';
    title = cloudStatus.message ?? 'The last sync failed';
  } else if (ago) {
    icon = <Check className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400 shrink-0" />;
    label = `synced ${ago}`;
    tone = 'bg-emerald-500/10 hover:bg-emerald-500/20 border-emerald-500/30 text-emerald-700 dark:text-emerald-300';
    title = cloudStatus.message ? `${cloudStatus.message} — ${lastSyncAt}` : `Last sync: ${lastSyncAt}`;
  } else {
    label = 'Linked, not synced yet';
    title = 'Linked to a cloud folder; no sync has completed yet';
  }

  return (
    <button
      id={id}
      type="button"
      onClick={() => (expiredFor ? void connect(expiredFor) : setIsCloudPanelOpen(true))}
      title={title}
      disabled={reconnecting}
      aria-label={expiredFor ? 'Sign-in expired. Sign in again.' : `${label}. Open the cloud panel.`}
      className={`flex items-center gap-1.5 px-2 sm:px-2.5 py-1.5 rounded-lg border text-[11px] font-semibold transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 ${tone}`}
    >
      {icon}
      <span className="hidden md:inline whitespace-nowrap">{label}</span>
    </button>
  );
};
