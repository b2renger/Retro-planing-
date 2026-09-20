/**
 * LlmOnLan farm discovery: listen for UDP multicast beacons and turn them into DiscoveredFarm records.
 *
 * `parseBeacon` is pure (no sockets) so it can be unit-tested against the many beacon shapes seen in
 * the wild; `discoverFarms` is the socket-bound collector used by the `desktop:discoverFarms` IPC.
 */
import dgram from 'node:dgram';
import os from 'node:os';
import type { DiscoveredFarm } from '../src/types/desktop';

export const MULTICAST_GROUP = '239.255.43.10';
export const MULTICAST_PORT = 41998;
export const DEFAULT_PROXY_PORT = 4000;
export const DEFAULT_DURATION_MS = 3000;
export const MAX_DURATION_MS = 15000;

type Dict = Record<string, unknown>;

function isDict(v: unknown): v is Dict {
  return typeof v === 'object' && v !== null && !Array.isArray(v);
}

function asString(v: unknown): string | undefined {
  if (typeof v === 'string') {
    const s = v.trim();
    return s.length ? s : undefined;
  }
  return undefined;
}

function asPort(v: unknown): number | undefined {
  const n = typeof v === 'number' ? v : typeof v === 'string' && /^\d+$/.test(v.trim()) ? Number(v.trim()) : NaN;
  return Number.isInteger(n) && n > 0 && n <= 65535 ? n : undefined;
}

function asCount(v: unknown): number | undefined {
  const n = typeof v === 'number' ? v : typeof v === 'string' && /^\d+$/.test(v.trim()) ? Number(v.trim()) : NaN;
  return Number.isFinite(n) && n >= 0 ? n : undefined;
}

/** Hosts a beacon may advertise that are meaningless to a remote client — use the sender address instead. */
function isUnroutableHost(host: string): boolean {
  const h = host.replace(/^\[|\]$/g, '').toLowerCase();
  return h === '' || h === '0.0.0.0' || h === '::' || h === 'localhost' || h.startsWith('127.') || h === '::1';
}

function parseUrl(v: unknown): URL | null {
  const s = asString(v);
  if (!s || !/^https?:\/\//i.test(s)) return null;
  try {
    return new URL(s);
  } catch {
    return null;
  }
}

function pickModel(p: Dict): string | undefined {
  const direct = asString(p.model) ?? asString(p.activeModel) ?? asString(p.defaultModel);
  if (direct) return direct;
  if (Array.isArray(p.models) && p.models.length > 0) {
    const first: unknown = p.models[0];
    if (typeof first === 'string') return asString(first);
    if (isDict(first)) return asString(first.id) ?? asString(first.name) ?? asString(first.model);
  }
  return undefined;
}

function pickCapacity(p: Dict): DiscoveredFarm['capacity'] | undefined {
  if (!isDict(p.capacity)) return undefined;
  const slots = asCount(p.capacity.slots);
  const clients = asCount(p.capacity.clients);
  if (slots === undefined && clients === undefined) return undefined;
  const out: { slots?: number; clients?: number } = {};
  if (slots !== undefined) out.slots = slots;
  if (clients !== undefined) out.clients = clients;
  return out;
}

/**
 * Turn one beacon datagram into a farm record, or null when it is not a usable beacon.
 *
 * Endpoint resolution: `http://<host>:<port>/v1` where host is the datagram sender (unless the payload
 * carries a full URL with a routable host) and port comes from, in order: `proxy.port`, `proxyPort`,
 * `port`, `endpoint` (a full URL, or a bare port number), falling back to 4000.
 */
export function parseBeacon(text: string, senderAddress: string): DiscoveredFarm | null {
  let payload: unknown;
  try {
    payload = JSON.parse(text);
  } catch {
    return null;
  }
  if (!isDict(payload)) return null;
  const sender = asString(senderAddress);
  if (!sender) return null;

  let host = sender;
  let port: number | undefined;
  let protocol = 'http:';
  let path = '/v1';

  const proxy = isDict(payload.proxy) ? payload.proxy : undefined;
  port = (proxy && asPort(proxy.port)) ?? asPort(payload.proxyPort) ?? asPort(payload.port);

  if (port === undefined) {
    const url = parseUrl(payload.endpoint) ?? parseUrl(payload.url) ?? parseUrl(proxy?.url) ?? parseUrl(proxy?.endpoint);
    if (url) {
      protocol = url.protocol === 'https:' ? 'https:' : 'http:';
      if (!isUnroutableHost(url.hostname)) host = url.hostname;
      port = url.port ? Number(url.port) : protocol === 'https:' ? 443 : 80;
      const trimmed = url.pathname.replace(/\/+$/, '');
      path = trimmed.endsWith('/v1') ? trimmed : `${trimmed}/v1`;
    } else {
      port = asPort(payload.endpoint);
    }
  }
  if (port === undefined) port = DEFAULT_PROXY_PORT;

  const hostForUrl = host.includes(':') && !host.startsWith('[') ? `[${host}]` : host;
  const endpoint = `${protocol}//${hostForUrl}:${port}${path}`;

  const farm: DiscoveredFarm = {
    endpoint,
    host,
    raw: payload,
    lastSeen: new Date().toISOString(),
  };
  const name = asString(payload.name) ?? asString(payload.farm) ?? asString(payload.hostname);
  if (name) farm.name = name;
  const model = pickModel(payload);
  if (model) farm.model = model;
  const capacity = pickCapacity(payload);
  if (capacity) farm.capacity = capacity;
  return farm;
}

function localIPv4Addresses(): string[] {
  const out: string[] = [];
  for (const list of Object.values(os.networkInterfaces())) {
    for (const iface of list ?? []) {
      const isV4 = iface.family === 'IPv4' || (iface.family as unknown) === 4;
      if (isV4 && !iface.internal) out.push(iface.address);
    }
  }
  return out;
}

/**
 * Join the LlmOnLan multicast group on every non-internal IPv4 interface and collect beacons for
 * `durationMs` (default 3000, capped at 15000). Farms are de-duplicated by endpoint, latest wins.
 * Never rejects: socket errors end the scan early with whatever was collected.
 */
export function discoverFarms(durationMs?: number): Promise<DiscoveredFarm[]> {
  const duration = Math.min(MAX_DURATION_MS, Math.max(0, Number.isFinite(durationMs) ? Number(durationMs) : DEFAULT_DURATION_MS));
  const found = new Map<string, DiscoveredFarm>();

  return new Promise((resolve) => {
    let settled = false;
    let timer: NodeJS.Timeout | undefined;
    const socket = dgram.createSocket({ type: 'udp4', reuseAddr: true });

    const finish = () => {
      if (settled) return;
      settled = true;
      if (timer) clearTimeout(timer);
      try {
        socket.close();
      } catch {
        /* already closed */
      }
      resolve([...found.values()]);
    };

    socket.on('error', (err) => {
      console.warn(`[farmDiscovery] socket error: ${err.message}`);
      finish();
    });

    socket.on('message', (msg, rinfo) => {
      const farm = parseBeacon(msg.toString('utf8'), rinfo.address);
      if (farm) found.set(farm.endpoint, farm);
    });

    socket.bind(MULTICAST_PORT, () => {
      let joined = 0;
      const addresses = localIPv4Addresses();
      for (const address of addresses) {
        try {
          socket.addMembership(MULTICAST_GROUP, address);
          joined++;
        } catch (err) {
          const code = (err as NodeJS.ErrnoException).code;
          if (code !== 'EADDRINUSE' && code !== 'EADDRNOTAVAIL') {
            console.warn(`[farmDiscovery] addMembership(${address}) failed: ${(err as Error).message}`);
          }
        }
      }
      if (joined === 0) {
        // Fall back to the OS-chosen default interface.
        try {
          socket.addMembership(MULTICAST_GROUP);
        } catch (err) {
          console.warn(`[farmDiscovery] addMembership(default) failed: ${(err as Error).message}`);
        }
      }
      timer = setTimeout(finish, duration);
    });
  });
}
