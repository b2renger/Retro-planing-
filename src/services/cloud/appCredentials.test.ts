import { describe, expect, it } from 'vitest';
import { appCredentials, builtInEnv, isConfigured, type BuiltInEnv } from './appCredentials';

const BUILT_IN: BuiltInEnv = {
  VITE_GOOGLE_CLIENT_ID: 'built-in.apps.googleusercontent.com',
  VITE_GOOGLE_CLIENT_SECRET: 'GOCSPX-built-in',
  VITE_MS_CLIENT_ID: '11111111-1111-1111-1111-111111111111',
};

describe('appCredentials — the user override', () => {
  it('prefers a user client id over the built-in one', () => {
    const got = appCredentials('google', { google: { clientId: 'mine.apps.googleusercontent.com' } }, BUILT_IN);
    expect(got).toEqual({ clientId: 'mine.apps.googleusercontent.com', clientSecret: undefined, source: 'user' });
  });

  it('carries the user secret, never the built-in one, alongside a user id', () => {
    const got = appCredentials('google', { google: { clientId: 'mine.apps.googleusercontent.com', clientSecret: 'GOCSPX-mine' } }, BUILT_IN);
    expect(got).toEqual({ clientId: 'mine.apps.googleusercontent.com', clientSecret: 'GOCSPX-mine', source: 'user' });
  });

  it('trims whitespace around a pasted id', () => {
    const got = appCredentials('onedrive', { onedrive: { clientId: '  2222  ' } }, BUILT_IN);
    expect(got).toEqual({ clientId: '2222', source: 'user' });
  });

  it('falls through to the built-in value when the override is blank', () => {
    const got = appCredentials('google', { google: { clientId: '   ' } }, BUILT_IN);
    expect(got.source).toBe('built-in');
  });
});

describe('appCredentials — the built-in build values', () => {
  it('uses the baked-in Google client and its desktop secret', () => {
    expect(appCredentials('google', {}, BUILT_IN)).toEqual({
      clientId: 'built-in.apps.googleusercontent.com',
      clientSecret: 'GOCSPX-built-in',
      source: 'built-in',
    });
  });

  it('uses the baked-in Microsoft client, which never has a secret', () => {
    expect(appCredentials('onedrive', {}, BUILT_IN)).toEqual({
      clientId: '11111111-1111-1111-1111-111111111111',
      source: 'built-in',
    });
  });

  it('is configured without a Google secret — the web build never sends one', () => {
    const got = appCredentials('google', {}, { VITE_GOOGLE_CLIENT_ID: 'web.apps.googleusercontent.com' });
    expect(got).toEqual({ clientId: 'web.apps.googleusercontent.com', clientSecret: undefined, source: 'built-in' });
    expect(isConfigured(got)).toBe(true);
  });

  it('works with no overrides argument at all', () => {
    expect(appCredentials('google', undefined, BUILT_IN).source).toBe('built-in');
  });
});

describe('appCredentials — nothing configured', () => {
  it('reports source "none" when neither the user nor the build supplied anything', () => {
    expect(appCredentials('google', {}, {})).toEqual({ clientId: '', source: 'none' });
    expect(appCredentials('onedrive', {}, {})).toEqual({ clientId: '', source: 'none' });
  });

  it('treats an empty-string env var as absent — Vite substitutes "" for an undefined var', () => {
    const blank: BuiltInEnv = { VITE_GOOGLE_CLIENT_ID: '', VITE_GOOGLE_CLIENT_SECRET: '', VITE_MS_CLIENT_ID: '' };
    expect(appCredentials('google', {}, blank).source).toBe('none');
    expect(appCredentials('onedrive', {}, blank).source).toBe('none');
  });

  it('treats a whitespace-only env var as absent too', () => {
    expect(appCredentials('onedrive', {}, { VITE_MS_CLIENT_ID: '  \n ' }).source).toBe('none');
  });

  it('isConfigured is false for the unconfigured result', () => {
    expect(isConfigured(appCredentials('google', {}, {}))).toBe(false);
  });
});

describe('builtInEnv', () => {
  it('returns an object, so a bundle built without any VITE_ vars still resolves', () => {
    expect(typeof builtInEnv()).toBe('object');
  });
});
