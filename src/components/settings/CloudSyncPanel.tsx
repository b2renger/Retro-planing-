import React from 'react';
import { capabilities } from '../../capabilities';
import { useApp } from '../../context/AppContext';
import type { CloudProviderId } from '../../services/cloud/types';
import { CLOUD_SETUP_DOC_URL, openCloudUrl, PROVIDER_LABELS } from '../../hooks/cloudClient';
import { BTN_SECONDARY, LINK_CLASS, PanelHeading } from './controls';
import { CloudProviderCard } from './CloudProviderCard';

const PROVIDERS: CloudProviderId[] = ['google', 'onedrive'];

/**
 * Settings → Cloud sync. One card per provider, each one button wide: the app owns the OAuth
 * clients, so connecting is a click and a browser sign-in — no console, no client id, no redirect
 * URI. Those fields still exist for anyone who wants their own application, folded into the
 * Advanced disclosure inside each card.
 *
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
          This build has no OS secure store, so the OAuth tokens are kept in this browser’s local storage in clear text.
        </p>
      )}

      {PROVIDERS.map((id) => (
        <CloudProviderCard key={id} providerId={id} />
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

      <p className="text-[11px] text-fg-muted leading-relaxed">
        Google signs out every seven days while the app is unverified, so expect to press Reconnect about once a week. Nothing is lost when that happens. The
        reason, and the one-time console setup behind these buttons, are in{' '}
        <button type="button" onClick={() => openCloudUrl(CLOUD_SETUP_DOC_URL)} className={LINK_CLASS}>
          docs/CLOUD-SETUP.md
        </button>
        .
      </p>
    </div>
  );
};
