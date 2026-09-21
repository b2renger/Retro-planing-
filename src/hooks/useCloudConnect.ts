/**
 * The one sign-in path, shared by every surface that can start it: the settings panel, the
 * project cloud panel and the navbar chip's Reconnect.
 *
 * Signing in has four steps that must succeed together — run the OAuth flow, persist the tokens,
 * fetch the account, record it. If any of them fails the tokens are cleared again, so the app
 * never shows a provider as connected when it is not. Keeping that in one hook is what makes
 * "Reconnect" from the chip identical to "Connect" from settings.
 */
import { useCallback, useState } from 'react';
import { useApp } from '../context/AppContext';
import { runAuthFlow } from '../services/cloud/oauth';
import { clearTokens, saveTokens } from '../services/cloud/tokenStore';
import type { CloudProviderId } from '../services/cloud/types';
import { createProvider, oauthConfig, PROVIDER_LABELS } from './cloudClient';

/** What a connect surface needs to render itself. */
export interface CloudConnect {
  /** The provider a flow is currently running for, or `null`. */
  busy: CloudProviderId | null;
  /** Last failure, already turned into a sentence. `null` while nothing has gone wrong. */
  error: string | null;
  /** Runs the interactive sign-in. Resolves `true` only when the account was actually fetched. */
  connect: (providerId: CloudProviderId) => Promise<boolean>;
  /** Forgets the tokens for a provider on this device. */
  disconnect: (providerId: CloudProviderId) => Promise<void>;
  clearError: () => void;
}

export function useCloudConnect(): CloudConnect {
  const { cloudSettings, setCloudAccount, setCloudStatus, addNotification } = useApp();
  const [busy, setBusy] = useState<CloudProviderId | null>(null);
  const [error, setError] = useState<string | null>(null);

  const connect = useCallback(
    async (providerId: CloudProviderId): Promise<boolean> => {
      setError(null);
      setBusy(providerId);
      try {
        const tokens = await runAuthFlow(providerId, oauthConfig(cloudSettings, providerId));
        await saveTokens(providerId, tokens);
        const account = await createProvider(cloudSettings, providerId).getAccount();
        setCloudAccount(providerId, account);
        // A successful sign-in clears an "expired" banner; the next sync writes the real status.
        setCloudStatus({ state: 'idle' });
        addNotification({
          title: `${PROVIDER_LABELS[providerId]} connected`,
          message: `Signed in as ${account.email || account.name}.`,
          type: 'status_update',
        });
        return true;
      } catch (err) {
        // Nothing is marked connected when any step fails — including the account lookup.
        await clearTokens(providerId).catch(() => undefined);
        setCloudAccount(providerId, null);
        setError(err instanceof Error ? err.message : String(err));
        return false;
      } finally {
        setBusy(null);
      }
    },
    [cloudSettings, setCloudAccount, setCloudStatus, addNotification]
  );

  const disconnect = useCallback(
    async (providerId: CloudProviderId): Promise<void> => {
      setBusy(providerId);
      try {
        await clearTokens(providerId);
        setCloudAccount(providerId, null);
        setError(null);
      } catch (err) {
        setError(err instanceof Error ? err.message : String(err));
      } finally {
        setBusy(null);
      }
    },
    [setCloudAccount]
  );

  return { busy, error, connect, disconnect, clearError: useCallback(() => setError(null), []) };
}
