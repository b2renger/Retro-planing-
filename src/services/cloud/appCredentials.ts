/**
 * Where the OAuth client credentials come from.
 *
 * The **app** owns the OAuth clients, not the user. One registration is done once by the
 * maintainer (see `docs/CLOUD-SETUP.md`); the ids are baked into the build through Vite env vars
 * and every user afterwards only clicks Connect. A per-user override survives for people who want
 * to call the providers as their own application — it lives behind the Advanced disclosure in
 * Settings → Cloud sync and wins over the built-in values when it is filled in.
 *
 * ## These values are not secrets, and shipping them is correct
 *
 * - A browser client id is visible in the authorize URL the moment the user signs in. There has
 *   never been a way to hide it, and OAuth does not ask you to: the redirect URI allow-list is
 *   what binds the client to this app.
 * - `VITE_GOOGLE_CLIENT_SECRET` is the secret issued with a Google **"Desktop app"** client.
 *   Google's own installed-app documentation states that this value "is not treated as a secret"
 *   — it cannot be, since it is compiled into every copy of the application. Security for that
 *   flow comes from PKCE plus the loopback redirect, not from the string.
 *
 * So: do not "fix" this by moving the ids to a server. There is no server, and removing them only
 * breaks one-click sign-in for every user.
 */
import type { CloudProviderId } from './types';

/** Which of the three resolution steps produced the credentials. */
export type CredentialSource = 'user' | 'built-in' | 'none';

/** The credentials a provider will actually authenticate with. */
export interface ResolvedCredentials {
  /** Empty string when `source` is `'none'`. */
  clientId: string;
  /** Only ever set for Google, and only used by the desktop loopback code exchange. */
  clientSecret?: string;
  source: CredentialSource;
}

/** The per-user override, shaped so `CloudSettings` is assignable to it. */
export interface CredentialOverrides {
  google?: { clientId?: string; clientSecret?: string };
  onedrive?: { clientId?: string };
}

/** The build-time values, read from `import.meta.env`. Every field is optional by design. */
export interface BuiltInEnv {
  VITE_GOOGLE_CLIENT_ID?: string;
  VITE_GOOGLE_CLIENT_SECRET?: string;
  VITE_MS_CLIENT_ID?: string;
}

/**
 * Trims a candidate and rejects anything that is not a usable value.
 *
 * The empty string matters: depending on how the build is run, Vite substitutes `""` for an env
 * var that was never defined rather than leaving `undefined`, and `""` must count as absent or a
 * build with no secrets configured would report itself configured and render a dead button.
 */
function usable(value: unknown): string | undefined {
  if (typeof value !== 'string') return undefined;
  const trimmed = value.trim();
  return trimmed === '' ? undefined : trimmed;
}

/** The build-time environment of the running bundle. Split out so tests can supply their own. */
export function builtInEnv(): BuiltInEnv {
  const env: unknown = import.meta.env;
  return (env ?? {}) as BuiltInEnv;
}

/** Nothing configured. */
const UNCONFIGURED: ResolvedCredentials = { clientId: '', source: 'none' };

/**
 * Resolves the credentials for one provider. First hit wins:
 * 1. the per-user override saved in settings (Advanced),
 * 2. the values baked into this build,
 * 3. nothing — the caller must report the provider as unconfigured rather than offer Connect.
 *
 * A user override supplies the whole credential: a user client id is never paired with the
 * built-in secret, because the two belong to different registrations.
 */
export function appCredentials(
  providerId: CloudProviderId,
  overrides?: CredentialOverrides,
  env: BuiltInEnv = builtInEnv()
): ResolvedCredentials {
  if (providerId === 'google') {
    const userId = usable(overrides?.google?.clientId);
    if (userId) return { clientId: userId, clientSecret: usable(overrides?.google?.clientSecret), source: 'user' };
    const builtInId = usable(env.VITE_GOOGLE_CLIENT_ID);
    if (builtInId) return { clientId: builtInId, clientSecret: usable(env.VITE_GOOGLE_CLIENT_SECRET), source: 'built-in' };
    return UNCONFIGURED;
  }
  const userId = usable(overrides?.onedrive?.clientId);
  if (userId) return { clientId: userId, source: 'user' };
  const builtInId = usable(env.VITE_MS_CLIENT_ID);
  if (builtInId) return { clientId: builtInId, source: 'built-in' };
  return UNCONFIGURED;
}

/** True when this build can offer a one-click Connect for the provider. */
export function isConfigured(credentials: ResolvedCredentials): boolean {
  return credentials.source !== 'none' && credentials.clientId !== '';
}
