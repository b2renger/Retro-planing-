import { describe, expect, it } from 'vitest';
import { canLoadModels, displayEndpoint, draftToConfig, formatBytes, missingRequirements, secretsStorageNote, uniqueLabel } from './helpers';

describe('displayEndpoint', () => {
  it('is empty for empty input so the caller can hide the line', () => {
    expect(displayEndpoint('', 'llmonlan')).toBe('');
    expect(displayEndpoint('   ', 'openai-compatible')).toBe('');
  });

  it('defaults the LlmOnLan port to 4000 and appends /v1', () => {
    expect(displayEndpoint('192.168.1.20', 'llmonlan')).toBe('http://192.168.1.20:4000/v1');
  });

  it('keeps a port the user typed', () => {
    expect(displayEndpoint('192.168.1.20:8080', 'llmonlan')).toBe('http://192.168.1.20:8080/v1');
  });

  it('leaves an address that already ends in /v1 alone', () => {
    expect(displayEndpoint('http://box.local:4000/v1', 'llmonlan')).toBe('http://box.local:4000/v1');
  });

  it('does not invent a port for other OpenAI-compatible servers', () => {
    expect(displayEndpoint('localhost:11434', 'openai-compatible')).toBe('http://localhost:11434/v1');
    expect(displayEndpoint('my-server.lan', 'openai-compatible')).toBe('http://my-server.lan/v1');
  });
});

describe('missingRequirements', () => {
  it('asks for the key and the model of a hosted provider', () => {
    expect(missingRequirements('openai', {})).toEqual(['API key', 'Model']);
  });

  it('asks for the base URL of a self-hosted provider but not for a key', () => {
    expect(missingRequirements('llmonlan', { model: 'qwen' })).toEqual(['Base URL']);
  });

  it('is empty once everything needed is filled', () => {
    expect(missingRequirements('openai', { apiKey: 'sk-x', model: 'gpt-4o' })).toEqual([]);
  });
});

describe('canLoadModels', () => {
  it('is false until the credential the family needs is present', () => {
    expect(canLoadModels('openai', {})).toBe(false);
    expect(canLoadModels('openai', { apiKey: 'sk-x' })).toBe(true);
    expect(canLoadModels('llmonlan', {})).toBe(false);
    expect(canLoadModels('llmonlan', { baseUrl: '192.168.1.20' })).toBe(true);
  });
});

describe('secretsStorageNote', () => {
  it('names the OS keychain on desktop', () => {
    expect(secretsStorageNote('secure-store')).toMatch(/operating system keychain/);
  });

  it('says clear text on the web build', () => {
    expect(secretsStorageNote('local-storage')).toMatch(/clear text/);
  });
});

describe('uniqueLabel', () => {
  it('returns the base name when it is free', () => {
    expect(uniqueLabel('OpenAI', ['Gemini'])).toBe('OpenAI');
  });

  it('suffixes a number when taken, ignoring case and padding', () => {
    expect(uniqueLabel('OpenAI', ['openai '])).toBe('OpenAI 2');
    expect(uniqueLabel('OpenAI', ['OpenAI', 'OpenAI 2'])).toBe('OpenAI 3');
  });
});

describe('formatBytes', () => {
  it('formats bytes, kilobytes and megabytes', () => {
    expect(formatBytes(512)).toBe('512 B');
    expect(formatBytes(2048)).toBe('2.0 kB');
    expect(formatBytes(3 * 1024 * 1024)).toBe('3.0 MB');
  });

  it('refuses to guess at nonsense', () => {
    expect(formatBytes(Number.NaN)).toBe('—');
  });
});

describe('draftToConfig', () => {
  it('normalises the endpoint and drops an empty key', () => {
    const cfg = draftToConfig({ providerId: 'llmonlan', label: ' Studio ', apiKey: '  ', baseUrl: '192.168.1.20', model: ' qwen ' });
    expect(cfg).toMatchObject({ providerId: 'llmonlan', label: 'Studio', baseUrl: 'http://192.168.1.20:4000/v1', model: 'qwen', enabled: true });
    expect(cfg.apiKey).toBeUndefined();
  });

  it('falls back to the catalog base URL when the user typed none', () => {
    const cfg = draftToConfig({ providerId: 'openai', label: '', apiKey: 'sk-x', model: 'gpt-4o' });
    expect(cfg.label).toBe('OpenAI');
    expect(cfg.baseUrl).toBe('https://api.openai.com/v1');
  });
});
