import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  webCallbackUrl, buildAuthorizeUrl, codeChallengeS256, exchangeCode, generateCodeVerifier, isExpired, parseRedirect, PROVIDER_OAUTH, randomState, refreshTokens, runAuthFlow } from './oauth';
import { CloudError } from './types';
import { fetchCall, jsonResponse } from './testFixtures';

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe('PKCE', () => {
  it('derives the RFC 7636 appendix B challenge from the known verifier', async () => {
    await expect(codeChallengeS256('dBjftJeZ4CVP-mB92K27uhbUJU1p1r_wW1gFWFOEjXk')).resolves.toBe('E9Melhoa2OwvFrEMTJguCHaoeK1t8URWbuGJSstw-cM');
  });

  it('generates base64url verifiers and states of the expected length', () => {
    const v = generateCodeVerifier();
    expect(v).toMatch(/^[A-Za-z0-9_-]{43}$/);
    expect(generateCodeVerifier()).not.toBe(v);
    expect(randomState()).toMatch(/^[A-Za-z0-9_-]{22}$/);
  });
});

describe('buildAuthorizeUrl', () => {
  it('encodes scopes, PKCE and extra params', () => {
    const url = new URL(
      buildAuthorizeUrl({
        authorizeEndpoint: PROVIDER_OAUTH.google.authorizeEndpoint,
        clientId: 'cid',
        redirectUri: 'http://127.0.0.1:5555/callback',
        scopes: PROVIDER_OAUTH.google.scopes,
        responseType: 'code',
        codeChallenge: 'chal',
        state: 'st',
        extraParams: { access_type: 'offline', prompt: 'consent' },
      })
    );
    expect(url.origin + url.pathname).toBe('https://accounts.google.com/o/oauth2/v2/auth');
    expect(url.searchParams.get('scope')).toBe(PROVIDER_OAUTH.google.scopes.join(' '));
    expect(url.search).toContain('scope=https%3A%2F%2Fwww.googleapis.com%2Fauth%2Fdrive+https');
    expect(url.searchParams.get('code_challenge')).toBe('chal');
    expect(url.searchParams.get('code_challenge_method')).toBe('S256');
    expect(url.searchParams.get('redirect_uri')).toBe('http://127.0.0.1:5555/callback');
    expect(url.searchParams.get('access_type')).toBe('offline');
    expect(url.searchParams.get('prompt')).toBe('consent');
    expect(url.searchParams.get('state')).toBe('st');
  });

  it('omits the challenge for implicit flows', () => {
    const url = new URL(buildAuthorizeUrl({ authorizeEndpoint: 'https://a/b', clientId: 'c', redirectUri: 'r', scopes: ['x'], responseType: 'token', state: 's' }));
    expect(url.searchParams.get('response_type')).toBe('token');
    expect(url.searchParams.has('code_challenge')).toBe(false);
  });
});

describe('parseRedirect', () => {
  it('reads the code and state from the query', () => {
    expect(parseRedirect('http://127.0.0.1:5555/callback?code=abc%2F1&state=xyz')).toMatchObject({ code: 'abc/1', state: 'xyz' });
  });

  it('reads implicit tokens from the fragment', () => {
    const r = parseRedirect('http://localhost/oauth/callback.html#access_token=tok&token_type=Bearer&expires_in=3599&state=s1');
    expect(r).toMatchObject({ accessToken: 'tok', expiresIn: 3599, state: 's1' });
    expect(r.code).toBeUndefined();
  });

  it('reads error responses', () => {
    expect(parseRedirect('http://localhost/cb?error=access_denied&error_description=User%20said%20no&state=s')).toMatchObject({
      error: 'access_denied',
      errorDescription: 'User said no',
      state: 's',
    });
  });
});

describe('exchangeCode', () => {
  it('posts a form-encoded body without a secret for public clients', async () => {
    const fetchMock = vi.fn().mockResolvedValue(jsonResponse({ access_token: 'at', refresh_token: 'rt', expires_in: 3600, token_type: 'Bearer', scope: 'a b' }));
    vi.stubGlobal('fetch', fetchMock);
    const before = Date.now();
    const tokens = await exchangeCode({ tokenEndpoint: PROVIDER_OAUTH.onedrive.tokenEndpoint, clientId: 'cid', code: 'the code', codeVerifier: 'ver', redirectUri: 'http://x/cb' });
    const { url, init } = fetchCall(fetchMock);
    expect(url).toBe('https://login.microsoftonline.com/common/oauth2/v2.0/token');
    expect(init.method).toBe('POST');
    expect((init.headers as Record<string, string>)['Content-Type']).toBe('application/x-www-form-urlencoded');
    expect(typeof init.body).toBe('string');
    expect(init.body).toBe('grant_type=authorization_code&client_id=cid&code=the+code&code_verifier=ver&redirect_uri=http%3A%2F%2Fx%2Fcb');
    expect(tokens).toMatchObject({ accessToken: 'at', refreshToken: 'rt', tokenType: 'Bearer', scope: 'a b' });
    expect(tokens.expiresAt).toBeGreaterThanOrEqual(before + 3600_000);
  });

  it('includes the secret when given (Google desktop client)', async () => {
    const fetchMock = vi.fn().mockResolvedValue(jsonResponse({ access_token: 'at', expires_in: 10 }));
    vi.stubGlobal('fetch', fetchMock);
    await exchangeCode({ tokenEndpoint: 'https://t', clientId: 'cid', clientSecret: 'sec', code: 'c', codeVerifier: 'v', redirectUri: 'r' });
    expect(fetchCall(fetchMock).init.body).toContain('client_secret=sec');
  });

  it('turns an invalid_grant response into an auth CloudError', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(jsonResponse({ error: 'invalid_grant', error_description: 'Bad code' }, 400)));
    const err = await exchangeCode({ tokenEndpoint: 'https://t', clientId: 'c', code: 'c', codeVerifier: 'v', redirectUri: 'r' }).catch((e: unknown) => e);
    expect(err).toBeInstanceOf(CloudError);
    expect((err as CloudError).kind).toBe('auth');
    expect((err as CloudError).message).toContain('Bad code');
  });
});

describe('refreshTokens', () => {
  it('keeps the previous refresh token when the response omits one', async () => {
    const fetchMock = vi.fn().mockResolvedValue(jsonResponse({ access_token: 'new', expires_in: 3600 }));
    vi.stubGlobal('fetch', fetchMock);
    const tokens = await refreshTokens({ tokenEndpoint: 'https://t', clientId: 'cid', refreshToken: 'old-rt' });
    expect(fetchCall(fetchMock).init.body).toBe('grant_type=refresh_token&client_id=cid&refresh_token=old-rt');
    expect(tokens.accessToken).toBe('new');
    expect(tokens.refreshToken).toBe('old-rt');
  });

  it('adopts a rotated refresh token', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(jsonResponse({ access_token: 'new', refresh_token: 'rotated', expires_in: 3600 })));
    const tokens = await refreshTokens({ tokenEndpoint: 'https://t', clientId: 'cid', refreshToken: 'old-rt' });
    expect(tokens.refreshToken).toBe('rotated');
  });
});

describe('isExpired', () => {
  it('applies the skew', () => {
    const now = 1_000_000;
    expect(isExpired({ accessToken: 'a', expiresAt: now + 30_000 }, 60_000, now)).toBe(true);
    expect(isExpired({ accessToken: 'a', expiresAt: now + 90_000 }, 60_000, now)).toBe(false);
  });
});

describe('runAuthFlow', () => {
  it('refuses to run without a window', async () => {
    await expect(runAuthFlow('google', { clientId: 'c' })).rejects.toMatchObject({ kind: 'auth' });
  });

  it('reports a blocked popup clearly', async () => {
    vi.stubGlobal('window', { location: { origin: 'http://localhost:3000' }, open: () => null, addEventListener() {}, removeEventListener() {} });
    await expect(runAuthFlow('google', { clientId: 'c' })).rejects.toThrow(/popup was blocked/);
  });

  it('completes the implicit web flow from the callback message', async () => {
    let listener: ((ev: { origin: string; data: unknown }) => void) | undefined;
    let openedUrl = '';
    const popup = { closed: false, close() {} };
    vi.stubGlobal('window', {
      location: { origin: 'http://localhost:3000' },
      open: (url: string) => {
        openedUrl = url;
        return popup;
      },
      addEventListener: (_: string, fn: typeof listener) => {
        listener = fn;
      },
      removeEventListener() {},
    });
    const pending = runAuthFlow('google', { clientId: 'cid' });
    await Promise.resolve();
    const opened = new URL(openedUrl);
    expect(opened.searchParams.get('response_type')).toBe('token');
    expect(opened.searchParams.get('redirect_uri')).toBe('http://localhost:3000/oauth/callback.html');
    const state = opened.searchParams.get('state')!;
    // A message from another origin must be ignored.
    listener!({ origin: 'https://evil.example', data: { type: 'rps-oauth', url: `http://localhost:3000/oauth/callback.html#access_token=evil&state=${state}` } });
    listener!({ origin: 'http://localhost:3000', data: { type: 'rps-oauth', url: `http://localhost:3000/oauth/callback.html#access_token=good&expires_in=100&state=${state}` } });
    const tokens = await pending;
    expect(tokens.accessToken).toBe('good');
    expect(tokens.refreshToken).toBeUndefined();
    expect(tokens.expiresAt).toBeGreaterThan(Date.now());
  });

  it('rejects a redirect with the wrong state', async () => {
    let listener: ((ev: { origin: string; data: unknown }) => void) | undefined;
    vi.stubGlobal('window', {
      location: { origin: 'http://localhost:3000' },
      open: () => ({ closed: false, close() {} }),
      addEventListener: (_: string, fn: typeof listener) => {
        listener = fn;
      },
      removeEventListener() {},
    });
    const pending = runAuthFlow('google', { clientId: 'cid' });
    await Promise.resolve();
    listener!({ origin: 'http://localhost:3000', data: { type: 'rps-oauth', url: 'http://localhost:3000/oauth/callback.html#access_token=x&state=wrong' } });
    await expect(pending).rejects.toThrow(/state mismatch/);
  });

  it('uses the desktop loopback bridge when present', async () => {
    const fetchMock = vi.fn().mockResolvedValue(jsonResponse({ access_token: 'desk', refresh_token: 'rt', expires_in: 3600 }));
    vi.stubGlobal('fetch', fetchMock);
    let authUrl = '';
    vi.stubGlobal('window', {
      desktop: {
        oauthLoopback: async (build: (uri: string) => string) => {
          authUrl = build('http://127.0.0.1:4242/callback');
          const state = new URL(authUrl).searchParams.get('state');
          return { redirectUrl: `http://127.0.0.1:4242/callback?code=C0DE&state=${state}`, redirectUri: 'http://127.0.0.1:4242/callback' };
        },
      },
    });
    const tokens = await runAuthFlow('google', { clientId: 'cid', clientSecret: 'sec' });
    const opened = new URL(authUrl);
    expect(opened.searchParams.get('response_type')).toBe('code');
    expect(opened.searchParams.get('access_type')).toBe('offline');
    expect(opened.searchParams.get('code_challenge_method')).toBe('S256');
    const body = String(fetchCall(fetchMock).init.body);
    expect(body).toContain('code=C0DE');
    expect(body).toContain('client_secret=sec');
    expect(body).toContain('redirect_uri=http%3A%2F%2F127.0.0.1%3A4242%2Fcallback');
    expect(tokens).toMatchObject({ accessToken: 'desk', refreshToken: 'rt' });
  });
});

describe('webCallbackUrl', () => {
  it('resolves next to the app when it is served from the site root', () => {
    expect(webCallbackUrl('https://plan.example.com/')).toBe('https://plan.example.com/oauth/callback.html');
  });

  it('keeps the sub-path when the app is served from one, as on GitHub Pages', () => {
    expect(webCallbackUrl('https://b2renger.github.io/RetroPlaningStudio/')).toBe(
      'https://b2renger.github.io/RetroPlaningStudio/oauth/callback.html'
    );
  });

  it('resolves against a full page URL, not just an origin', () => {
    expect(webCallbackUrl('https://b2renger.github.io/RetroPlaningStudio/index.html')).toBe(
      'https://b2renger.github.io/RetroPlaningStudio/oauth/callback.html'
    );
  });
});
