/**
 * OAuth 2.0 helpers (PKCE + implicit) shared by the Google Drive and OneDrive providers.
 * Uses WebCrypto (`crypto.subtle`), available in browsers, Electron and Node ≥ 20.
 */
import { CloudError, type CloudOAuthConfig, type CloudProviderId, type OAuthTokens } from './types';
import { cloudFetch, isRecord, num, str } from './httpErrors';

// ---------------------------------------------------------------------------
// Provider registry
// ---------------------------------------------------------------------------

/** Static OAuth endpoints and scopes per provider. */
export interface ProviderOAuthSpec {
  authorizeEndpoint: string;
  tokenEndpoint: string;
  scopes: string[];
  /** Response type used by the web (popup) flow. */
  webResponseType: 'token' | 'code';
  /** Response type used by the Electron loopback flow. */
  desktopResponseType: 'code';
}

/**
 * Per-provider OAuth configuration.
 *
 * Google: the full `https://www.googleapis.com/auth/drive` scope is REQUIRED (not `drive.file`).
 * With `drive.file` the app only sees files it created itself, so a Markdown file or a Google Doc
 * the user drops into the project folder from the Drive web UI would be invisible to the sync.
 * The web flow uses the implicit `token` response because Google "Web application" clients
 * require a client secret for the code exchange, which cannot be shipped in a browser bundle.
 * The desktop flow uses `code` + PKCE + secret (Google "Desktop app" clients) with
 * `access_type=offline&prompt=consent` so a refresh token is issued.
 *
 * Microsoft: `code` + PKCE for both web (SPA registration) and desktop (public client) —
 * no secret is ever sent. `offline_access` yields a refresh token.
 */
export const PROVIDER_OAUTH: Record<CloudProviderId, ProviderOAuthSpec> = {
  google: {
    authorizeEndpoint: 'https://accounts.google.com/o/oauth2/v2/auth',
    tokenEndpoint: 'https://oauth2.googleapis.com/token',
    scopes: [
      'https://www.googleapis.com/auth/drive',
      'https://www.googleapis.com/auth/userinfo.email',
      'https://www.googleapis.com/auth/userinfo.profile',
    ],
    webResponseType: 'token',
    desktopResponseType: 'code',
  },
  onedrive: {
    authorizeEndpoint: 'https://login.microsoftonline.com/common/oauth2/v2.0/authorize',
    tokenEndpoint: 'https://login.microsoftonline.com/common/oauth2/v2.0/token',
    scopes: ['Files.ReadWrite', 'User.Read', 'offline_access'],
    webResponseType: 'code',
    desktopResponseType: 'code',
  },
};

// ---------------------------------------------------------------------------
// PKCE primitives
// ---------------------------------------------------------------------------

/** Encodes bytes as base64url without padding (RFC 7636 §4). */
export function base64Url(bytes: Uint8Array): string {
  let bin = '';
  for (let i = 0; i < bytes.length; i++) bin += String.fromCharCode(bytes[i]);
  return btoa(bin).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

function randomBytes(length: number): Uint8Array {
  const bytes = new Uint8Array(length);
  crypto.getRandomValues(bytes);
  return bytes;
}

/** Generates a 43-character PKCE code verifier. */
export function generateCodeVerifier(): string {
  return base64Url(randomBytes(32));
}

/** Computes the S256 code challenge (`base64url(sha256(verifier))`). */
export async function codeChallengeS256(verifier: string): Promise<string> {
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(verifier));
  return base64Url(new Uint8Array(digest));
}

/** Generates an unguessable `state` value for CSRF protection. */
export function randomState(): string {
  return base64Url(randomBytes(16));
}

// ---------------------------------------------------------------------------
// Authorize URL / redirect parsing
// ---------------------------------------------------------------------------

/** Inputs for `buildAuthorizeUrl`. */
export interface AuthorizeUrlOptions {
  authorizeEndpoint: string;
  clientId: string;
  redirectUri: string;
  scopes: string[];
  responseType: 'code' | 'token';
  codeChallenge?: string;
  state: string;
  extraParams?: Record<string, string>;
}

/** Builds the authorization request URL (scopes are space-separated, everything URL-encoded). */
export function buildAuthorizeUrl(opts: AuthorizeUrlOptions): string {
  const url = new URL(opts.authorizeEndpoint);
  url.searchParams.set('client_id', opts.clientId);
  url.searchParams.set('redirect_uri', opts.redirectUri);
  url.searchParams.set('response_type', opts.responseType);
  url.searchParams.set('scope', opts.scopes.join(' '));
  url.searchParams.set('state', opts.state);
  if (opts.codeChallenge) {
    url.searchParams.set('code_challenge', opts.codeChallenge);
    url.searchParams.set('code_challenge_method', 'S256');
  }
  for (const [k, v] of Object.entries(opts.extraParams ?? {})) url.searchParams.set(k, v);
  return url.toString();
}

/** What an OAuth redirect URL carried back. */
export interface ParsedRedirect {
  code?: string;
  accessToken?: string;
  expiresIn?: number;
  state?: string;
  error?: string;
  errorDescription?: string;
}

/** Parses both `?code=` (authorization code) and `#access_token=` (implicit) redirects. */
export function parseRedirect(url: string): ParsedRedirect {
  const parsed = new URL(url);
  const params = new URLSearchParams(parsed.search);
  const fragment = new URLSearchParams(parsed.hash.startsWith('#') ? parsed.hash.slice(1) : parsed.hash);
  const pick = (key: string): string | undefined => fragment.get(key) ?? params.get(key) ?? undefined;
  const expiresRaw = pick('expires_in');
  const expiresIn = expiresRaw !== undefined && expiresRaw !== '' ? Number(expiresRaw) : undefined;
  return {
    code: pick('code'),
    accessToken: pick('access_token'),
    expiresIn: expiresIn !== undefined && Number.isFinite(expiresIn) ? expiresIn : undefined,
    state: pick('state'),
    error: pick('error'),
    errorDescription: pick('error_description'),
  };
}

// ---------------------------------------------------------------------------
// Token endpoint
// ---------------------------------------------------------------------------

function formEncode(fields: Record<string, string | undefined>): string {
  const p = new URLSearchParams();
  for (const [k, v] of Object.entries(fields)) if (v !== undefined) p.set(k, v);
  return p.toString();
}

/** Parses a token endpoint response body into `OAuthTokens`. */
export function parseTokenResponse(raw: unknown, previousRefreshToken?: string, now = Date.now()): OAuthTokens {
  if (!isRecord(raw)) throw new CloudError('auth', 'Token endpoint returned an unexpected body');
  const accessToken = str(raw, 'access_token');
  if (!accessToken) {
    const desc = str(raw, 'error_description') ?? str(raw, 'error') ?? 'no access_token in response';
    throw new CloudError('auth', `Token request failed: ${desc}`);
  }
  const expiresIn = num(raw, 'expires_in') ?? 3600;
  return {
    accessToken,
    refreshToken: str(raw, 'refresh_token') ?? previousRefreshToken,
    expiresAt: now + expiresIn * 1000,
    scope: str(raw, 'scope'),
    tokenType: str(raw, 'token_type'),
  };
}

async function postTokenRequest(tokenEndpoint: string, fields: Record<string, string | undefined>, context: string, previousRefreshToken?: string): Promise<OAuthTokens> {
  const res = await cloudFetch(
    tokenEndpoint,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded', Accept: 'application/json' },
      body: formEncode(fields),
    },
    context
  ).catch((err: unknown) => {
    // Token endpoint failures are auth failures regardless of HTTP status (400 invalid_grant etc.).
    if (err instanceof CloudError && err.kind !== 'network') throw new CloudError('auth', err.message, err.status);
    throw err;
  });
  let json: unknown;
  try {
    json = res.json();
  } catch {
    throw new CloudError('auth', `${context}: token endpoint returned non-JSON body`);
  }
  return parseTokenResponse(json, previousRefreshToken);
}

/** Inputs for `exchangeCode`. */
export interface ExchangeCodeOptions {
  tokenEndpoint: string;
  clientId: string;
  /** Sent only when present (Google desktop clients). Public clients omit it. */
  clientSecret?: string;
  code: string;
  codeVerifier: string;
  redirectUri: string;
}

/** Exchanges an authorization code (+ PKCE verifier) for tokens. */
export function exchangeCode(opts: ExchangeCodeOptions): Promise<OAuthTokens> {
  return postTokenRequest(
    opts.tokenEndpoint,
    {
      grant_type: 'authorization_code',
      client_id: opts.clientId,
      client_secret: opts.clientSecret,
      code: opts.code,
      code_verifier: opts.codeVerifier,
      redirect_uri: opts.redirectUri,
    },
    'OAuth code exchange'
  );
}

/** Inputs for `refreshTokens`. */
export interface RefreshTokensOptions {
  tokenEndpoint: string;
  clientId: string;
  clientSecret?: string;
  refreshToken: string;
}

/** Refreshes an access token; keeps the previous refresh token when the response omits one. */
export function refreshTokens(opts: RefreshTokensOptions): Promise<OAuthTokens> {
  return postTokenRequest(
    opts.tokenEndpoint,
    {
      grant_type: 'refresh_token',
      client_id: opts.clientId,
      client_secret: opts.clientSecret,
      refresh_token: opts.refreshToken,
    },
    'OAuth token refresh',
    opts.refreshToken
  );
}

/** True when the access token expires within `skewMs` (default 60 s). */
export function isExpired(tokens: OAuthTokens, skewMs = 60_000, now = Date.now()): boolean {
  return tokens.expiresAt - skewMs <= now;
}

// ---------------------------------------------------------------------------
// Interactive flows
// ---------------------------------------------------------------------------

/** Message posted by `public/oauth/callback.html` to the opener window. */
export const OAUTH_MESSAGE_TYPE = 'rps-oauth';

/** Path (under the app origin) of the popup callback page. */
export const WEB_CALLBACK_PATH = '/oauth/callback.html';

/**
 * Absolute URL of the popup callback page.
 *
 * Resolved against the document's base rather than `location.origin`, so the app keeps working when
 * it is served from a sub-path — a GitHub Pages site at `/RetroPlaningStudio/` being the case that
 * motivated this. Using the origin alone would register a redirect URI that 404s there.
 */
export function webCallbackUrl(baseHref?: string): string {
  const fromDocument = typeof document !== 'undefined' ? document.baseURI : undefined;
  const fromWindow =
    typeof window !== 'undefined' ? window.location?.href || window.location?.origin : undefined;
  const base = baseHref || fromDocument || fromWindow || 'http://localhost/';
  return new URL('oauth/callback.html', base).href;
}

const WEB_FLOW_TIMEOUT_MS = 5 * 60 * 1000;

function assertState(parsed: ParsedRedirect, expected: string): void {
  if (parsed.error) {
    throw new CloudError('auth', `Authorization refused: ${parsed.errorDescription ?? parsed.error}`);
  }
  if (parsed.state !== expected) {
    throw new CloudError('auth', 'OAuth state mismatch — the redirect did not come from this sign-in attempt');
  }
}

function desktopExtraParams(providerId: CloudProviderId): Record<string, string> {
  return providerId === 'google' ? { access_type: 'offline', prompt: 'consent' } : {};
}

async function runDesktopFlow(providerId: CloudProviderId, cfg: CloudOAuthConfig): Promise<OAuthTokens> {
  const spec = PROVIDER_OAUTH[providerId];
  const bridge = window.desktop!;
  const state = randomState();
  const verifier = generateCodeVerifier();
  const challenge = await codeChallengeS256(verifier);
  let usedRedirectUri = '';
  const result = await bridge.oauthLoopback((redirectUri) => {
    usedRedirectUri = redirectUri;
    return buildAuthorizeUrl({
      authorizeEndpoint: spec.authorizeEndpoint,
      clientId: cfg.clientId,
      redirectUri,
      scopes: spec.scopes,
      responseType: spec.desktopResponseType,
      codeChallenge: challenge,
      state,
      extraParams: desktopExtraParams(providerId),
    });
  });
  const parsed = parseRedirect(result.redirectUrl);
  assertState(parsed, state);
  if (!parsed.code) throw new CloudError('auth', 'Authorization redirect carried no code');
  return exchangeCode({
    tokenEndpoint: spec.tokenEndpoint,
    clientId: cfg.clientId,
    clientSecret: providerId === 'google' ? cfg.clientSecret : undefined,
    code: parsed.code,
    codeVerifier: verifier,
    redirectUri: result.redirectUri || usedRedirectUri,
  });
}

/** Opens a popup and waits for the callback page's `postMessage`. Resolves with the redirect URL. */
function waitForPopupRedirect(authorizeUrl: string): Promise<string> {
  return new Promise<string>((resolve, reject) => {
    const popup = window.open(authorizeUrl, 'rps-oauth', 'width=520,height=680,popup=yes');
    if (!popup) {
      reject(new CloudError('auth', 'The sign-in popup was blocked by the browser. Allow popups for this site and try again.'));
      return;
    }
    let settled = false;
    const cleanup = () => {
      settled = true;
      window.removeEventListener('message', onMessage);
      clearTimeout(timer);
      clearInterval(closedPoll);
    };
    const onMessage = (event: MessageEvent) => {
      if (event.origin !== window.location.origin) return;
      const data: unknown = event.data;
      if (!isRecord(data) || data.type !== OAUTH_MESSAGE_TYPE) return;
      const url = str(data, 'url');
      if (!url) return;
      cleanup();
      resolve(url);
    };
    const timer = setTimeout(() => {
      if (settled) return;
      cleanup();
      try {
        popup.close();
      } catch {
        /* cross-origin popup may refuse */
      }
      reject(new CloudError('auth', 'Sign-in timed out after 5 minutes'));
    }, WEB_FLOW_TIMEOUT_MS);
    // Detect the user closing the popup without completing the flow.
    const closedPoll = setInterval(() => {
      if (settled) return;
      let closed = false;
      try {
        closed = popup.closed;
      } catch {
        closed = false;
      }
      if (closed) {
        // Give a pending postMessage a moment to land before giving up.
        setTimeout(() => {
          if (settled) return;
          cleanup();
          reject(new CloudError('auth', 'The sign-in window was closed before authorization completed'));
        }, 500);
      }
    }, 500);
    window.addEventListener('message', onMessage);
  });
}

async function runWebFlow(providerId: CloudProviderId, cfg: CloudOAuthConfig): Promise<OAuthTokens> {
  const spec = PROVIDER_OAUTH[providerId];
  const redirectUri = webCallbackUrl();
  const state = randomState();
  const usePkce = spec.webResponseType === 'code';
  const verifier = usePkce ? generateCodeVerifier() : undefined;
  const challenge = verifier ? await codeChallengeS256(verifier) : undefined;
  const authorizeUrl = buildAuthorizeUrl({
    authorizeEndpoint: spec.authorizeEndpoint,
    clientId: cfg.clientId,
    redirectUri,
    scopes: spec.scopes,
    responseType: spec.webResponseType,
    codeChallenge: challenge,
    state,
  });
  const redirectUrl = await waitForPopupRedirect(authorizeUrl);
  const parsed = parseRedirect(redirectUrl);
  assertState(parsed, state);

  if (spec.webResponseType === 'token') {
    if (!parsed.accessToken) throw new CloudError('auth', 'Authorization redirect carried no access token');
    return {
      accessToken: parsed.accessToken,
      expiresAt: Date.now() + (parsed.expiresIn ?? 3600) * 1000,
      tokenType: 'Bearer',
    };
  }
  if (!parsed.code || !verifier) throw new CloudError('auth', 'Authorization redirect carried no code');
  return exchangeCode({
    tokenEndpoint: spec.tokenEndpoint,
    clientId: cfg.clientId,
    code: parsed.code,
    codeVerifier: verifier,
    redirectUri,
  });
}

/**
 * Runs the interactive sign-in for a provider.
 * - Electron (`window.desktop.oauthLoopback`): system browser + loopback redirect, code + PKCE.
 * - Web: popup to the authorize URL, `public/oauth/callback.html` posts the redirect URL back.
 */
export async function runAuthFlow(providerId: CloudProviderId, cfg: CloudOAuthConfig): Promise<OAuthTokens> {
  if (!cfg.clientId) throw new CloudError('auth', 'An OAuth client ID is required to connect this provider');
  if (typeof window === 'undefined') throw new CloudError('auth', 'Interactive sign-in requires a browser window');
  if (window.desktop?.oauthLoopback) return runDesktopFlow(providerId, cfg);
  return runWebFlow(providerId, cfg);
}
