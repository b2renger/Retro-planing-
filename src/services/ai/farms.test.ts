import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { discoverFarms, farmToProviderConfig, probeFarm } from './farms';
import { hangUntilAbort, jsonResponse, mockFetch, requestAt, restoreMocks, type FetchMock } from './test-helpers';

let fetchMock: FetchMock;
beforeEach(() => {
  fetchMock = mockFetch();
});
afterEach(() => {
  vi.useRealTimers();
  restoreMocks();
});

describe('discoverFarms', () => {
  it('returns [] when there is no desktop bridge', async () => {
    expect(typeof window).toBe('undefined');
    expect(await discoverFarms(10)).toEqual([]);
  });

  it('maps bridge results and normalises endpoints', async () => {
    const discover = vi.fn().mockResolvedValue([{ endpoint: '192.168.1.20', host: '192.168.1.20', name: 'Studio', model: 'qwen', raw: {}, lastSeen: 'x' }]);
    vi.stubGlobal('window', { desktop: { discoverFarms: discover } });
    try {
      const farms = await discoverFarms(1234);
      expect(discover).toHaveBeenCalledWith(1234);
      expect(farms).toEqual([{ endpoint: 'http://192.168.1.20:4000/v1', host: '192.168.1.20', name: 'Studio', model: 'qwen' }]);
    } finally {
      vi.unstubAllGlobals();
    }
  });
});

describe('probeFarm', () => {
  it('reports reachable with the model list on success', async () => {
    fetchMock.mockResolvedValue(jsonResponse({ data: [{ id: 'qwen' }, { id: 'llama' }] }));
    const r = await probeFarm('192.168.1.20', 'master');
    const req = requestAt(fetchMock);
    expect(req.url).toBe('http://192.168.1.20:4000/v1/models');
    expect(req.headers['authorization']).toBe('Bearer master');
    expect(r).toEqual({ reachable: true, models: ['qwen', 'llama'], latencyMs: expect.any(Number) });
  });

  it('reports unreachable on HTTP error without throwing', async () => {
    fetchMock.mockResolvedValue(jsonResponse({}, 503));
    const r = await probeFarm('http://10.0.0.5:4000/v1');
    expect(r.reachable).toBe(false);
    expect(r.error).toContain('503');
  });

  it('times out after 4 s', async () => {
    vi.useFakeTimers();
    fetchMock.mockImplementation(hangUntilAbort());
    const pending = probeFarm('http://10.0.0.5:4000/v1');
    await vi.advanceTimersByTimeAsync(4000);
    const r = await pending;
    expect(r.reachable).toBe(false);
    expect(r.error).toMatch(/timed out/i);
  });
});

describe('farmToProviderConfig', () => {
  it('uses the beacon model without probing', async () => {
    const c = await farmToProviderConfig({ endpoint: '192.168.1.20', host: '192.168.1.20', name: 'Studio', model: 'qwen' }, 'master');
    expect(fetchMock).not.toHaveBeenCalled();
    expect(c).toMatchObject({ providerId: 'llmonlan', label: 'Studio', apiKey: 'master', baseUrl: 'http://192.168.1.20:4000/v1', model: 'qwen', enabled: true });
    expect(c.id).toMatch(/\S+/);
  });

  it('probes for the first model when the beacon has none', async () => {
    fetchMock.mockResolvedValue(jsonResponse({ data: [{ id: 'first' }, { id: 'second' }] }));
    const c = await farmToProviderConfig({ endpoint: 'http://192.168.1.21:4000/v1', host: '192.168.1.21' });
    expect(c.model).toBe('first');
    expect(c.label).toBe('LlmOnLan farm @ 192.168.1.21');
    expect(c.apiKey).toBeUndefined();
  });
});
