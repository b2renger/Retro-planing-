import { describe, expect, it } from 'vitest';
import { canUseLanFarms, computeCapabilities, keyStorageNote, type CapabilityEnv } from './capabilities';

const env = (over: Partial<CapabilityEnv> = {}): CapabilityEnv => ({ hasDesktop: false, protocol: 'https:', ...over });

describe('canUseLanFarms — the four combinations', () => {
  it('desktop on an https page: yes, the main process makes the request', () => {
    expect(canUseLanFarms({ hasDesktop: true, protocol: 'https:' })).toBe(true);
  });

  it('desktop on an http page: yes', () => {
    expect(canUseLanFarms({ hasDesktop: true, protocol: 'http:' })).toBe(true);
  });

  it('browser on an http page: yes, same scheme as the farm', () => {
    expect(canUseLanFarms({ hasDesktop: false, protocol: 'http:' })).toBe(true);
  });

  it('browser on an https page: no, mixed content is blocked before the request leaves', () => {
    expect(canUseLanFarms({ hasDesktop: false, protocol: 'https:' })).toBe(false);
  });
});

describe('canUseLanFarms — other schemes', () => {
  it('treats the Electron file: page as usable (it has the bridge anyway)', () => {
    expect(canUseLanFarms({ hasDesktop: true, protocol: 'file:' })).toBe(true);
  });

  it('only https: blocks a browser', () => {
    expect(canUseLanFarms({ hasDesktop: false, protocol: 'file:' })).toBe(true);
  });
});

describe('computeCapabilities', () => {
  it('a plain browser can do none of the desktop-only things', () => {
    const caps = computeCapabilities(env({ protocol: 'http:' }));
    expect(caps).toMatchObject({
      hasDesktop: false,
      canDiscoverFarms: false,
      canOauthLoopback: false,
      canOpenExternal: false,
      canSaveNatively: false,
      platformLabel: 'Browser',
      buildLabel: 'Browser',
    });
  });

  it('the desktop build can', () => {
    const caps = computeCapabilities(env({ hasDesktop: true, protocol: 'file:' }));
    expect(caps).toMatchObject({
      canDiscoverFarms: true,
      canOauthLoopback: true,
      canOpenExternal: true,
      canSaveNatively: true,
      platformLabel: 'Desktop app',
    });
  });

  it('never claims a bridge feature the bridge does not expose', () => {
    const caps = computeCapabilities(env({ hasDesktop: true, protocol: 'file:', hasFarmDiscovery: false, hasSaveFile: false }));
    expect(caps.canDiscoverFarms).toBe(false);
    expect(caps.canSaveNatively).toBe(false);
    expect(caps.canOauthLoopback).toBe(true);
  });

  it('discovery stays false in a browser even if something else defines the flag', () => {
    expect(computeCapabilities(env({ hasFarmDiscovery: true })).canDiscoverFarms).toBe(false);
  });

  it('names the build with the Electron details when it has them', () => {
    const caps = computeCapabilities(env({ hasDesktop: true, protocol: 'file:', desktopPlatform: 'darwin', desktopVersion: '32.1.0' }));
    expect(caps.buildLabel).toBe('Desktop app (darwin, Electron 32.1.0)');
  });
});

describe('secrets backend', () => {
  it('is the keychain when the bridge exposes a secure store', () => {
    const caps = computeCapabilities(env({ hasDesktop: true, protocol: 'file:' }));
    expect(caps.secretsBackend).toBe('keychain');
    expect(caps.secretsPersisted).toBe(true);
    expect(caps.keyStorageNote).toMatch(/operating system keychain/);
  });

  it('is localStorage in a browser, and the copy says the keys are in clear text', () => {
    const caps = computeCapabilities(env({ protocol: 'http:' }));
    expect(caps.secretsBackend).toBe('localStorage');
    expect(caps.keyStorageNote).toMatch(/clear text/);
  });

  it('falls back to localStorage when the desktop build has no secure store', () => {
    expect(computeCapabilities(env({ hasDesktop: true, protocol: 'file:', hasSecureStore: false })).secretsBackend).toBe('localStorage');
  });

  it('says keys are not persisted at all when localStorage is unavailable', () => {
    const caps = computeCapabilities(env({ protocol: 'http:', hasLocalStorage: false }));
    expect(caps.secretsPersisted).toBe(false);
    expect(caps.keyStorageNote).toMatch(/memory only/);
  });
});

describe('keyStorageNote', () => {
  it('ignores the persisted flag for the keychain', () => {
    expect(keyStorageNote('keychain', false)).toMatch(/keychain/);
  });
});
