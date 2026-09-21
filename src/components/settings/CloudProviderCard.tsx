import React from 'react';
import { AlertTriangle, Check, Cloud, ExternalLink, Loader2, LogIn, RefreshCw, Unplug } from 'lucide-react';
import { useApp } from '../../context/AppContext';
import type { CloudProviderId } from '../../services/cloud/types';
import {
  CLOUD_SETUP_DOC_URL,
  isDesktopRuntime,
  openCloudUrl,
  plainPermissions,
  providerCredentials,
  CONNECT_SUMMARY,
  PROVIDER_LABELS,
  PROVIDER_SHORT_LABELS,
} from '../../hooks/cloudClient';
import { useCloudConnect } from '../../hooks/useCloudConnect';
import { relativeTime } from '../../utils/time';
import { BTN_DANGER, BTN_PRIMARY, BTN_SECONDARY, LINK_CLASS } from './controls';
import { CloudAdvanced } from './CloudAdvanced';

/** The sign-in itself, in one sentence: what opens, and where. */
function flowNote(desktop: boolean, providerId: CloudProviderId): string {
  return desktop
    ? `Your web browser opens on the ${PROVIDER_SHORT_LABELS[providerId]} sign-in page and hands the result straight back to the app.`
    : `A sign-in window opens on the ${PROVIDER_SHORT_LABELS[providerId]} page and closes by itself when you are done.`;
}

/** One provider: connect with a single click, or the account that is already connected. */
export const CloudProviderCard: React.FC<{ providerId: CloudProviderId }> = ({ providerId }) => {
  const { cloudSettings, cloudAccounts, cloudStatus, secretsReady } = useApp();
  const { busy, error, connect, disconnect, clearError } = useCloudConnect();
  const account = cloudAccounts[providerId] ?? null;
  const credentials = providerCredentials(cloudSettings, providerId);
  const unconfigured = credentials.source === 'none';
  const desktop = isDesktopRuntime();
  const permissions = React.useMemo(() => plainPermissions(providerId), [providerId]);
  const [confirmDisconnect, setConfirmDisconnect] = React.useState(false);
  const working = busy === providerId;
  const expired = cloudStatus.state === 'expired' && cloudStatus.providerId === providerId;
  const connectedAgo = relativeTime(account?.connectedAt);

  return (
    <section className="rounded-xl border border-line bg-elevated p-4 space-y-3">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <h4 className="text-sm font-bold text-fg flex items-center gap-2">
            <Cloud className="w-4 h-4 text-blue-600 dark:text-blue-400 shrink-0" />
            {PROVIDER_LABELS[providerId]}
          </h4>
          {account ? (
            <p className="text-xs text-fg-muted mt-1">
              Connected as <span className="font-semibold text-fg">{account.name || account.email}</span>
              {account.email && account.name !== account.email ? <span className="font-mono"> ({account.email})</span> : null}
              {connectedAgo ? <span> · signed in {connectedAgo}</span> : null}
            </p>
          ) : (
            <p className="text-xs text-fg-muted mt-1 leading-relaxed">{CONNECT_SUMMARY[providerId]}</p>
          )}
        </div>

        <div className="shrink-0 flex items-center gap-1.5">
          {account ? (
            confirmDisconnect ? (
              <>
                <button
                  type="button"
                  onClick={() => {
                    setConfirmDisconnect(false);
                    void disconnect(providerId);
                  }}
                  className={BTN_DANGER}
                  disabled={working}
                >
                  Confirm disconnect
                </button>
                <button type="button" onClick={() => setConfirmDisconnect(false)} className={BTN_SECONDARY}>
                  Cancel
                </button>
              </>
            ) : (
              <button type="button" onClick={() => setConfirmDisconnect(true)} className={BTN_SECONDARY} disabled={working}>
                <Unplug className="w-3.5 h-3.5" />
                <span>Disconnect</span>
              </button>
            )
          ) : unconfigured ? null : (
            <button type="button" onClick={() => void connect(providerId)} className={BTN_PRIMARY} disabled={working || !secretsReady}>
              {working ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <LogIn className="w-3.5 h-3.5" />}
              <span>{working ? 'Signing in…' : `Connect ${PROVIDER_SHORT_LABELS[providerId]}`}</span>
            </button>
          )}
        </div>
      </div>

      {expired && account && (
        <div className="flex items-center justify-between gap-3 rounded-lg border border-amber-500/30 bg-amber-500/10 px-2.5 py-2">
          <p className="text-[11px] text-amber-700 dark:text-amber-300 leading-relaxed">
            This sign-in has expired — Google ends them every seven days while the app is unverified. Nothing was lost and nothing needs re-entering.
          </p>
          <button type="button" onClick={() => void connect(providerId)} className={`${BTN_PRIMARY} shrink-0`} disabled={working}>
            {working ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <RefreshCw className="w-3.5 h-3.5" />}
            <span>{working ? 'Signing in…' : 'Reconnect'}</span>
          </button>
        </div>
      )}

      {confirmDisconnect && (
        <p className="text-[11px] text-amber-700 dark:text-amber-300">
          Disconnecting forgets the stored tokens on this device. Files stay in the drive and projects stay linked — they simply stop syncing until you connect
          again.
        </p>
      )}

      {error && (
        <p role="alert" className="text-[11px] text-rose-700 dark:text-rose-300 bg-rose-500/10 border border-rose-500/30 rounded-lg px-2.5 py-2 leading-relaxed">
          {error}{' '}
          <button type="button" onClick={clearError} className={LINK_CLASS}>
            Dismiss
          </button>
        </p>
      )}

      {unconfigured && !account && (
        <div className="rounded-lg border border-amber-500/30 bg-amber-500/10 px-2.5 py-2 space-y-1">
          <p className="text-[11px] font-semibold text-amber-800 dark:text-amber-200 flex items-center gap-1.5">
            <AlertTriangle className="w-3.5 h-3.5 shrink-0" aria-hidden="true" />
            This build has no {PROVIDER_SHORT_LABELS[providerId]} credentials
          </p>
          <p className="text-[11px] text-amber-700 dark:text-amber-300 leading-relaxed">
            Whoever built the app did not bake in an OAuth client id, so there is nothing to sign in with. Follow{' '}
            <button type="button" onClick={() => openCloudUrl(CLOUD_SETUP_DOC_URL)} className={LINK_CLASS}>
              docs/CLOUD-SETUP.md <ExternalLink className="w-3 h-3 inline align-[-1px]" />
            </button>{' '}
            once, or paste your own client id below.
          </p>
        </div>
      )}

      {!account && !unconfigured && (
        <div className="space-y-1.5">
          <p className="text-[11px] text-fg-muted leading-relaxed">{flowNote(desktop, providerId)}</p>
          <p className="text-[11px] font-semibold uppercase tracking-wide text-fg-muted pt-1">{PROVIDER_SHORT_LABELS[providerId]} will ask you to allow</p>
          <ul className="space-y-1">
            {permissions.map((line) => (
              <li key={line} className="text-[11px] text-fg-muted leading-relaxed flex gap-1.5">
                <Check className="w-3 h-3 mt-0.5 shrink-0 text-emerald-600 dark:text-emerald-400" aria-hidden="true" />
                <span>{line}</span>
              </li>
            ))}
          </ul>
        </div>
      )}

      <CloudAdvanced providerId={providerId} defaultOpen={unconfigured && !account} />
    </section>
  );
};
