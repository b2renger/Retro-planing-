/**
 * Small encrypted key/value store for tokens and API keys.
 *
 * Backed by `<userData>/secure-store.json`. Values are encrypted with Electron's `safeStorage` (Keychain on
 * macOS, DPAPI on Windows, libsecret/kwallet on Linux) and stored as `enc:<base64>`. When the OS keyring is
 * unavailable, values are stored as `plain:<value>` and a warning is logged once.
 */
import { app, safeStorage } from 'electron';
import fs from 'node:fs';
import path from 'node:path';

const FILE_NAME = 'secure-store.json';
const ENC_PREFIX = 'enc:';
const PLAIN_PREFIX = 'plain:';

let warnedPlain = false;
let cache: Record<string, string> | null = null;

export function storePath(): string {
  return path.join(app.getPath('userData'), FILE_NAME);
}

function load(): Record<string, string> {
  if (cache) return cache;
  try {
    const raw = fs.readFileSync(storePath(), 'utf8');
    const parsed: unknown = JSON.parse(raw);
    cache = typeof parsed === 'object' && parsed !== null && !Array.isArray(parsed) ? (parsed as Record<string, string>) : {};
  } catch {
    cache = {};
  }
  return cache;
}

function persist(data: Record<string, string>): void {
  const file = storePath();
  fs.mkdirSync(path.dirname(file), { recursive: true });
  const tmp = `${file}.${process.pid}.tmp`;
  fs.writeFileSync(tmp, JSON.stringify(data, null, 2), { mode: 0o600 });
  fs.renameSync(tmp, file);
}

function encryptionAvailable(): boolean {
  try {
    return safeStorage.isEncryptionAvailable();
  } catch {
    return false;
  }
}

export function secureGet(key: string): string | null {
  const stored = load()[key];
  if (typeof stored !== 'string') return null;
  if (stored.startsWith(PLAIN_PREFIX)) return stored.slice(PLAIN_PREFIX.length);
  if (stored.startsWith(ENC_PREFIX)) {
    if (!encryptionAvailable()) {
      console.warn(`[secureStore] "${key}" is encrypted but OS encryption is unavailable — treating as missing`);
      return null;
    }
    try {
      return safeStorage.decryptString(Buffer.from(stored.slice(ENC_PREFIX.length), 'base64'));
    } catch (err) {
      console.warn(`[secureStore] failed to decrypt "${key}": ${(err as Error).message}`);
      return null;
    }
  }
  // Legacy / hand-edited value without prefix: return as-is.
  return stored;
}

export function secureSet(key: string, value: string): void {
  const data = load();
  if (encryptionAvailable()) {
    data[key] = ENC_PREFIX + safeStorage.encryptString(value).toString('base64');
  } else {
    if (!warnedPlain) {
      warnedPlain = true;
      console.warn('[secureStore] OS encryption unavailable — secrets are stored in plain text in secure-store.json');
    }
    data[key] = PLAIN_PREFIX + value;
  }
  persist(data);
}

export function secureDelete(key: string): void {
  const data = load();
  if (key in data) {
    delete data[key];
    persist(data);
  }
}
