import { describe, expect, it } from 'vitest';
import { parseBeacon } from './farmDiscovery';

describe('parseBeacon', () => {
  it('reads the LlmOnLan proxy shape (proxy.port + models[])', () => {
    const farm = parseBeacon(
      JSON.stringify({
        name: 'studio-farm',
        proxy: { port: 4010 },
        models: [{ id: 'qwen2.5-coder:7b' }, { id: 'llama3' }],
        capacity: { slots: 4, clients: 1 },
      }),
      '192.168.1.20'
    );
    expect(farm).not.toBeNull();
    expect(farm!.endpoint).toBe('http://192.168.1.20:4010/v1');
    expect(farm!.host).toBe('192.168.1.20');
    expect(farm!.name).toBe('studio-farm');
    expect(farm!.model).toBe('qwen2.5-coder:7b');
    expect(farm!.capacity).toEqual({ slots: 4, clients: 1 });
    expect(typeof farm!.lastSeen).toBe('string');
    expect(farm!.raw).toMatchObject({ name: 'studio-farm' });
  });

  it('reads a flat shape (proxyPort as string, activeModel, hostname)', () => {
    const farm = parseBeacon(JSON.stringify({ hostname: 'mac-studio', proxyPort: '4000', activeModel: 'mistral' }), '10.0.0.5');
    expect(farm!.endpoint).toBe('http://10.0.0.5:4000/v1');
    expect(farm!.name).toBe('mac-studio');
    expect(farm!.model).toBe('mistral');
    expect(farm!.capacity).toBeUndefined();
  });

  it('uses host and port from a full endpoint URL and keeps an existing /v1 path', () => {
    const farm = parseBeacon(JSON.stringify({ farm: 'rack', endpoint: 'http://192.168.1.77:5000/v1/', defaultModel: 'gemma' }), '192.168.1.20');
    expect(farm!.endpoint).toBe('http://192.168.1.77:5000/v1');
    expect(farm!.host).toBe('192.168.1.77');
    expect(farm!.name).toBe('rack');
    expect(farm!.model).toBe('gemma');
  });

  it('replaces an unroutable URL host with the sender address', () => {
    const farm = parseBeacon(JSON.stringify({ endpoint: 'http://0.0.0.0:4321' }), '192.168.1.9');
    expect(farm!.endpoint).toBe('http://192.168.1.9:4321/v1');
  });

  it('falls back to port 4000 and the sender address when nothing is advertised', () => {
    const farm = parseBeacon(JSON.stringify({ model: 'phi', models: ['ignored'] }), '172.16.0.2');
    expect(farm!.endpoint).toBe('http://172.16.0.2:4000/v1');
    expect(farm!.model).toBe('phi');
    expect(farm!.name).toBeUndefined();
  });

  it('prefers proxy.port over a port mentioned elsewhere', () => {
    const farm = parseBeacon(JSON.stringify({ proxy: { port: 4100 }, port: 11434, endpoint: 'http://1.2.3.4:9999' }), '10.1.1.1');
    expect(farm!.endpoint).toBe('http://10.1.1.1:4100/v1');
  });

  it('returns null for invalid JSON, non-objects and empty senders', () => {
    expect(parseBeacon('not json', '10.0.0.1')).toBeNull();
    expect(parseBeacon('"just a string"', '10.0.0.1')).toBeNull();
    expect(parseBeacon('[1,2,3]', '10.0.0.1')).toBeNull();
    expect(parseBeacon('null', '10.0.0.1')).toBeNull();
    expect(parseBeacon('{}', '')).toBeNull();
  });

  it('ignores garbage port values', () => {
    const farm = parseBeacon(JSON.stringify({ port: 'eighty', proxy: { port: -3 } }), '10.0.0.1');
    expect(farm!.endpoint).toBe('http://10.0.0.1:4000/v1');
  });
});
