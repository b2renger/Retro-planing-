import React from 'react';
import { Check, Cloud, Copy, ExternalLink, Loader2, Plug, Unplug } from 'lucide-react';
import { capabilities } from '../../capabilities';
import { useApp } from '../../context/AppContext';
import { runAuthFlow } from '../../services/cloud/oauth';
import { clearTokens, saveTokens } from '../../services/cloud/tokenStore';
import type { CloudProviderId } from '../../services/cloud/types';
import {
  createProvider,
  oauthConfig,
  openCloudUrl,
  PROVIDER_CONSOLE,
  PROVIDER_LABELS,
  redirectAdvice,
  scopeExplanations,
} from '../../hooks/cloudClient';
import { relativeTime } from '../../utils/time';
import { BTN_DANGER, BTN_PRIMARY, BTN_SECONDARY, Field, INPUT_CLASS, LINK_CLASS, PanelHeading } from './controls';

const PROVIDERS: CloudProviderId[] = ['google', 'onedrive'];

/** A read-only value with a Copy button — used for the redirect URI, which must match exactly. */
const CopyableValue: React.FC<{ id: string; value: string; label: string }> = ({ id, value, label }) => {
  const [copied, setCopied] = React.useState(false);

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(value);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2000);
    } catch {
      // Clipboard denied (insecure origin, permissions): the field is selectable, so select it.
      document.getElementById(id)?.focus();
      (document.getElementById(id) as HTMLInputElement | null)?.select();
    }
  };

  return (
    <div className="flex items-center gap-1.5">
      <input id={id} readOnly value={value} aria-label={label} className={`${INPUT_CLASS} font-mono`} onFocus={(e) => e.currentTarget.select()} />
      <button type="button" onClick={copy} className={`${BTN_SECONDARY} shrink-0`} aria-label={`Copy ${label}`}>
        {copied ? <Check className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
        <span>{copied ? 'Copied' : 'Copy'}</span>
      </button>
    </div>
  );
};

/** Connection state + client registration for one provider. */
const ProviderCard: React.FC<{ providerId: CloudProviderId }> = ({ providerId }) => {
  const { cloudSettings, updateCloudSettings, cloudAccounts, setCloudAccount, secretsReady, addNotification } = useApp();
  const account = cloudAccounts[providerId] ?? null;
  const console_ = PROVIDER_CONSOLE[providerId];
  const advice = React.useMemo(() => redirectAdvice(providerId), [providerId]);
  const scopes = React.useMemo(() => scopeExplanations(providerId), [providerId]);

  const [busy, setBusy] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [confirmDisconnect, setConfirmDisconnect] = React.useState(false);

  const clientId = providerId === 'google' ? cloudSettings.google.clientId : cloudSettings.onedrive.clientId;
  const clientSecret = cloudSettings.google.clientSecret ?? '';
  const setClientId = (value: string) => updateCloudSettings(providerId === 'google' ? { google: { clientId: value } } : { onedrive: { clientId: value } });

  const connect = async () => {
    setError(null);
    setBusy(true);
    try {
      const cfg = oauthConfig(cloudSettings, providerId);
      const tokens = await runAuthFlow(providerId, cfg);
      await saveTokens(providerId, tokens);
      const provider = createProvider(cloudSettings, providerId);
      const fetched = await provider.getAccount();
      setCloudAccount(providerId, fetched);
      addNotification({ title: `${PROVIDER_LABELS[providerId]} connected`, message: `Signed in as ${fetched.email || fetched.name}.`, type: 'status_update' });
    } catch (err) {
      // Nothing is marked connected when any step fails — including the account lookup.
      await clearTokens(providerId).catch(() => undefined);
      setCloudAccount(providerId, null);
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setBusy(false);
    }
  };

  const disconnect = async () => {
    setConfirmDisconnect(false);
    setBusy(true);
    try {
      await clearTokens(providerId);
      setCloudAccount(providerId, null);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setBusy(false);
    }
  };

  const connectedAgo = relativeTime(account?.connectedAt);

  return (
    <section className="rounded-xl border border-line bg-elevated p-4 space-y-4">
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
            <p className="text-xs text-fg-muted mt-1">Not connected. Nothing is uploaded or downloaded until you sign in.</p>
          )}
        </div>
        <div className="shrink-0 flex items-center gap-1.5">
          {account ? (
            confirmDisconnect ? (
              <>
                <button type="button" onClick={disconnect} className={BTN_DANGER} disabled={busy}>
                  Confirm disconnect
                </button>
                <button type="button" onClick={() => setConfirmDisconnect(false)} className={BTN_SECONDARY}>
                  Cancel
                </button>
              </>
            ) : (
              <button type="button" onClick={() => setConfirmDisconnect(true)} className={BTN_SECONDARY} disabled={busy}>
                <Unplug className="w-3.5 h-3.5" />
                <span>Disconnect</span>
              </button>
            )
          ) : (
            <button type="button" onClick={connect} className={BTN_PRIMARY} disabled={busy || !clientId.trim() || !secretsReady}>
              {busy ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Plug className="w-3.5 h-3.5" />}
              <span>{busy ? 'Signing in…' : 'Connect'}</span>
            </button>
          )}
        </div>
      </div>

      {confirmDisconnect && (
        <p className="text-[11px] text-amber-700 dark:text-amber-300">
          Disconnecting forgets the stored tokens on this device. Files stay in the drive and projects stay linked — they simply stop syncing until you connect again.
        </p>
      )}

      {error && (
        <p role="alert" className="text-[11px] text-rose-700 dark:text-rose-300 bg-rose-500/10 border border-rose-500/30 rounded-lg px-2.5 py-2 leading-relaxed">
          {error}
        </p>
      )}

      <div className="space-y-3">
        <Field
          label="OAuth client ID"
          suffix="required"
          htmlFor={`cloud-${providerId}-client-id`}
          hint={
            <>
              This app has no shared credentials: it calls {PROVIDER_LABELS[providerId]} as <em>your own</em> OAuth application, so the quota and the consent
              screen are yours. Create one in{' '}
              <button type="button" onClick={() => openCloudUrl(console_.url)} className={LINK_CLASS}>
                {console_.label} <ExternalLink className="w-3 h-3 inline align-[-1px]" />
              </button>
              .
            </>
          }
        >
          <input
            id={`cloud-${providerId}-client-id`}
            type="text"
            value={clientId}
            onChange={(e) => setClientId(e.target.value)}
            placeholder={providerId === 'google' ? '1234567890-abc.apps.googleusercontent.com' : '00000000-0000-0000-0000-000000000000'}
            className={`${INPUT_CLASS} font-mono`}
            spellCheck={false}
            autoComplete="off"
          />
        </Field>

        {providerId === 'google' && (
          <Field
            label="Client secret"
            suffix="desktop app only"
            htmlFor="cloud-google-client-secret"
            hint={
              advice.loopback
                ? 'A Google “Desktop app” client is issued with a secret and the loopback token exchange needs it. It never leaves this machine.'
                : 'Leave empty. The web build uses the implicit flow and never sends a secret — a secret in a browser bundle would not be secret.'
            }
          >
            <input
              id="cloud-google-client-secret"
              type="password"
              value={clientSecret}
              onChange={(e) => updateCloudSettings({ google: { clientSecret: e.target.value } })}
              placeholder={secretsReady ? 'GOCSPX-…' : 'Loading…'}
              disabled={!secretsReady}
              className={`${INPUT_CLASS} font-mono`}
              spellCheck={false}
              autoComplete="off"
            />
          </Field>
        )}

        <Field
          label="Redirect URI to register"
          suffix={advice.loopback ? 'loopback' : 'exact match'}
          htmlFor={`cloud-${providerId}-redirect`}
          hint={advice.detail}
        >
          <CopyableValue id={`cloud-${providerId}-redirect`} value={advice.value} label={`${PROVIDER_LABELS[providerId]} redirect URI`} />
        </Field>

        <div className="space-y-1.5">
          <p className="text-[11px] font-semibold uppercase tracking-wide text-fg-muted">What sign-in will ask for</p>
          <ul className="space-y-1.5">
            {scopes.map(({ scope, meaning }) => (
              <li key={scope} className="text-[11px] text-fg-muted leading-relaxed">
                <span className="font-mono text-fg">{scope}</span>
                <span className="block">{meaning}</span>
              </li>
            ))}
          </ul>
        </div>
      </div>
    </section>
  );
};

/**
 * Settings → Cloud sync. One card per provider: the OAuth client the user registers themselves,
 * the redirect URI for this exact build, the scopes requested, and Connect / Disconnect.
 * A provider is shown as connected only after its account has actually been fetched.
 */
export const CloudSyncPanel: React.FC = () => {
  const { setIsCloudPanelOpen, activeProject } = useApp();
  const { secretsBackend } = capabilities();

  return (
    <div className="space-y-4">
      <PanelHeading
        title="Cloud sync"
        description="Link a project to a folder in your own Google Drive or OneDrive. The folder is the source of truth: on first contact the cloud copy wins, and afterwards the newer side wins per file."
      />

      {secretsBackend === 'localStorage' && (
        <p className="text-[11px] text-amber-700 dark:text-amber-300 bg-amber-500/10 border border-amber-500/30 rounded-lg px-2.5 py-2 leading-relaxed">
          This build has no OS secure store, so the client secret and the OAuth tokens are kept in this browser’s local storage in clear text.
        </p>
      )}

      {PROVIDERS.map((id) => (
        <ProviderCard key={id} providerId={id} />
      ))}

      <div className="rounded-xl border border-line bg-elevated p-4 space-y-2">
        <h4 className="text-sm font-bold text-fg">Linking a project</h4>
        <p className="text-xs text-fg-muted leading-relaxed">
          Connecting an account does not sync anything on its own. Each project is linked to its own folder from the project’s cloud panel.
          {activeProject?.cloud
            ? ` “${activeProject.title}” is linked to ${PROVIDER_LABELS[activeProject.cloud.providerId]}.`
            : activeProject
              ? ` “${activeProject.title}” is not linked to a cloud folder yet.`
              : ''}
        </p>
        <button type="button" onClick={() => setIsCloudPanelOpen(true)} className={BTN_SECONDARY} disabled={!activeProject}>
          Open the project cloud panel
        </button>
      </div>
    </div>
  );
};
