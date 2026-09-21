import React from 'react';
import { Check, ChevronRight, Copy, ExternalLink } from 'lucide-react';
import { useApp } from '../../context/AppContext';
import type { CloudProviderId } from '../../services/cloud/types';
import { CLOUD_SETUP_DOC_URL, openCloudUrl, PROVIDER_CONSOLE, PROVIDER_LABELS, redirectAdvice, scopeExplanations } from '../../hooks/cloudClient';
import { BTN_SECONDARY, Field, INPUT_CLASS, LINK_CLASS } from './controls';

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
      const field = document.getElementById(id) as HTMLInputElement | null;
      field?.focus();
      field?.select();
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

/** The fields themselves, without the disclosure around them. */
const OwnClientFields: React.FC<{ providerId: CloudProviderId }> = ({ providerId }) => {
  const { cloudSettings, updateCloudSettings, secretsReady } = useApp();
  const advice = React.useMemo(() => redirectAdvice(providerId), [providerId]);
  const console_ = PROVIDER_CONSOLE[providerId];
  const scopes = React.useMemo(() => scopeExplanations(providerId), [providerId]);
  const clientId = providerId === 'google' ? cloudSettings.google.clientId : cloudSettings.onedrive.clientId;

  return (
    <div className="space-y-3 pt-1">
      <Field
        label="Your own OAuth client ID"
        suffix="optional"
        htmlFor={`cloud-${providerId}-client-id`}
        hint={
          <>
            Leave this empty to use the client built into the app. Fill it in to call {PROVIDER_LABELS[providerId]} as <em>your own</em> application, so the
            quota and the consent screen are yours. Create one in{' '}
            <button type="button" onClick={() => openCloudUrl(console_.url)} className={LINK_CLASS}>
              {console_.label} <ExternalLink className="w-3 h-3 inline align-[-1px]" />
            </button>{' '}
            — the steps are in{' '}
            <button type="button" onClick={() => openCloudUrl(CLOUD_SETUP_DOC_URL)} className={LINK_CLASS}>
              docs/CLOUD-SETUP.md
            </button>
            .
          </>
        }
      >
        <input
          id={`cloud-${providerId}-client-id`}
          type="text"
          value={clientId}
          onChange={(e) => updateCloudSettings(providerId === 'google' ? { google: { clientId: e.target.value } } : { onedrive: { clientId: e.target.value } })}
          placeholder={providerId === 'google' ? '1234567890-abc.apps.googleusercontent.com' : '00000000-0000-0000-0000-000000000000'}
          className={`${INPUT_CLASS} font-mono`}
          spellCheck={false}
          autoComplete="off"
        />
      </Field>

      {providerId === 'google' && (
        <Field
          label="Your client secret"
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
            value={cloudSettings.google.clientSecret ?? ''}
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
        <p className="text-[11px] font-semibold uppercase tracking-wide text-fg-muted">Scopes to grant your client</p>
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
  );
};

/**
 * The per-user OAuth client, folded away.
 *
 * Almost nobody needs this: the app ships its own clients and one click is the whole flow. It
 * stays for the person who wants their own quota and consent screen, and it opens by itself on a
 * build with no credentials at all, where it is the only way through.
 */
export const CloudAdvanced: React.FC<{ providerId: CloudProviderId; defaultOpen?: boolean }> = ({ providerId, defaultOpen = false }) => {
  const [open, setOpen] = React.useState(defaultOpen);
  const bodyId = `cloud-${providerId}-advanced`;

  return (
    <div className="border-t border-line pt-3">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        aria-controls={bodyId}
        className="flex items-center gap-1 text-[11px] font-semibold uppercase tracking-wide text-fg-muted hover:text-fg rounded-sm focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500"
      >
        <ChevronRight className={`w-3.5 h-3.5 transition-transform ${open ? 'rotate-90' : ''}`} aria-hidden="true" />
        <span>Advanced — use my own OAuth client</span>
      </button>
      <div id={bodyId} hidden={!open}>
        {open && <OwnClientFields providerId={providerId} />}
      </div>
    </div>
  );
};
