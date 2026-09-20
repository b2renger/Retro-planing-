/**
 * Collision-free ids. `crypto.randomUUID()` where available (browsers, Node 19+, Electron),
 * otherwise a time + random fallback that is still unique enough for a single user's store.
 */
export function newId(prefix: string): string {
  const c = (globalThis as { crypto?: { randomUUID?: () => string } }).crypto;
  const body =
    c && typeof c.randomUUID === 'function'
      ? c.randomUUID()
      : `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}-${Math.random().toString(36).slice(2, 6)}`;
  return prefix ? `${prefix}-${body}` : body;
}
