import type { DiscoveredFarm } from '../../types/desktop';
import { httpFetch } from '../http/httpClient';
import { normalizeLlmOnLanEndpoint } from './providers/openaiCompatible';
import type { AiProviderConfig } from './types';

const PROBE_TIMEOUT_MS = 4_000;

/** A LlmOnLan farm seen on the LAN (UDP beacon relayed by the Electron main process). */
export interface FarmInfo {
  /** OpenAI-compatible base URL, e.g. http://192.168.1.20:4000/v1 */
  endpoint: string;
  host: string;
  name?: string;
  model?: string;
}

/** Listen for farm beacons for `durationMs`. Returns [] in the web build (no `window.desktop`). */
export async function discoverFarms(durationMs = 3000): Promise<FarmInfo[]> {
  const bridge = typeof window !== 'undefined' ? window.desktop : undefined;
  if (!bridge?.discoverFarms) return [];
  const farms: DiscoveredFarm[] = await bridge.discoverFarms(durationMs);
  return farms.map((f) => ({ endpoint: normalizeLlmOnLanEndpoint(f.endpoint), host: f.host, name: f.name, model: f.model }));
}

export interface FarmProbeResult {
  reachable: boolean;
  models: string[];
  latencyMs: number;
  error?: string;
}

/** `GET {endpoint}/models` with a 4 s timeout. Never throws. */
export async function probeFarm(endpoint: string, masterKey?: string): Promise<FarmProbeResult> {
  const base = normalizeLlmOnLanEndpoint(endpoint);
  const started = Date.now();
  try {
    const headers: Record<string, string> = masterKey ? { Authorization: `Bearer ${masterKey}` } : {};
    const res = await httpFetch(`${base}/models`, { headers, timeoutMs: PROBE_TIMEOUT_MS });
    const latencyMs = Date.now() - started;
    if (!res.ok) return { reachable: false, models: [], latencyMs, error: `HTTP ${res.status} ${res.statusText}` };
    let models: string[] = [];
    try {
      const data = (res.json<{ data?: unknown }>() ?? {}).data;
      if (Array.isArray(data)) {
        models = data.map((m: unknown) => (typeof m === 'object' && m !== null ? (m as { id?: unknown }).id : undefined)).filter((id): id is string => typeof id === 'string');
      }
    } catch {
      return { reachable: true, models: [], latencyMs, error: 'Invalid JSON from /models' };
    }
    return { reachable: true, models, latencyMs };
  } catch (err) {
    const name = err instanceof Error ? err.name : '';
    const message = name === 'AbortError' ? `Timed out after ${PROBE_TIMEOUT_MS} ms` : err instanceof Error ? err.message : String(err);
    return { reachable: false, models: [], latencyMs: Date.now() - started, error: message };
  }
}

function newId(): string {
  const c = globalThis.crypto;
  if (c && typeof c.randomUUID === 'function') return c.randomUUID();
  return `farm-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
}

/**
 * Build a provider config for a farm. Uses the beacon's model when present, else the first model the
 * farm reports on `/models` (empty when unreachable — the settings UI must then ask the user).
 */
export async function farmToProviderConfig(farm: FarmInfo, masterKey?: string): Promise<AiProviderConfig> {
  const endpoint = normalizeLlmOnLanEndpoint(farm.endpoint);
  let model = farm.model?.trim() || '';
  if (!model) {
    const probe = await probeFarm(endpoint, masterKey);
    model = probe.models[0] ?? '';
  }
  return {
    id: newId(),
    providerId: 'llmonlan',
    label: farm.name?.trim() || `LlmOnLan farm @ ${farm.host}`,
    apiKey: masterKey?.trim() || undefined,
    baseUrl: endpoint,
    model,
    enabled: true,
  };
}
