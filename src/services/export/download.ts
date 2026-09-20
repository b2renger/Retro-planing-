/**
 * Hands an export to the user: through the Electron bridge (`window.desktop.saveFile`) when
 * present, otherwise through a Blob + anchor click in the browser.
 */

/** Outcome of `downloadBytes`. */
export interface DownloadResult {
  /** `false` when the user cancelled the desktop save dialog. */
  saved: boolean;
  /** Absolute path chosen in the desktop save dialog, when available. */
  path?: string;
  method: 'desktop' | 'browser';
}

/** Encodes bytes as base64 without blowing the call stack on large buffers. */
export function bytesToBase64(bytes: Uint8Array): string {
  let binary = '';
  const chunk = 0x8000;
  for (let i = 0; i < bytes.length; i += chunk) {
    binary += String.fromCharCode(...bytes.subarray(i, i + chunk));
  }
  return btoa(binary);
}

/** Copies a (possibly offset) view into a standalone `ArrayBuffer`, as `Blob` wants. */
export function toArrayBuffer(bytes: Uint8Array): ArrayBuffer {
  const copy = new Uint8Array(bytes.byteLength);
  copy.set(bytes);
  return copy.buffer;
}

function toBytes(data: Uint8Array | string): Uint8Array {
  return typeof data === 'string' ? new TextEncoder().encode(data) : data;
}

/**
 * Saves `bytes` (or a UTF-8 string) as `filename`. Uses the desktop save dialog when running
 * in Electron, else triggers a browser download. Rejects outside of any UI environment.
 */
export async function downloadBytes(
  filename: string,
  bytes: Uint8Array | string,
  mimeType = 'application/octet-stream'
): Promise<DownloadResult> {
  const data = toBytes(bytes);
  const desktop = typeof window !== 'undefined' ? window.desktop : undefined;
  if (desktop?.saveFile) {
    const res = await desktop.saveFile({ defaultPath: filename, dataBase64: bytesToBase64(data), mimeType });
    return { saved: res.saved, path: res.path, method: 'desktop' };
  }
  if (typeof document === 'undefined' || typeof URL === 'undefined' || typeof URL.createObjectURL !== 'function') {
    throw new Error('downloadBytes: no browser or desktop environment available');
  }
  const blob = new Blob([toArrayBuffer(data)], { type: mimeType });
  const url = URL.createObjectURL(blob);
  try {
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    a.rel = 'noopener';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  } finally {
    // Defer revocation so slow browsers still get to read the blob.
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }
  return { saved: true, method: 'browser' };
}

/**
 * Turns a free-form title into a portable file name: ASCII-folded, lower-case, words joined
 * by `-`, at most 80 characters, with `ext` appended (leading dot optional).
 */
export function safeFilename(title: string, ext: string): string {
  const base = (title ?? '')
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 80)
    .replace(/-+$/g, '');
  const extension = ext.replace(/^\.+/, '').toLowerCase();
  return `${base || 'export'}${extension ? '.' + extension : ''}`;
}
