import { afterEach, describe, expect, it, vi } from 'vitest';
import { bytesToBase64, downloadBytes, safeFilename } from './download';

interface WindowStub {
  desktop?: { saveFile: (opts: { defaultPath: string; dataBase64: string; mimeType?: string }) => Promise<{ saved: boolean; path?: string }> };
}

const setWindow = (value: WindowStub | undefined): void => {
  if (value === undefined) {
    delete (globalThis as { window?: unknown }).window;
  } else {
    Object.defineProperty(globalThis, 'window', { value, configurable: true, writable: true });
  }
};

afterEach(() => setWindow(undefined));

describe('safeFilename', () => {
  it('folds accents, lower-cases, joins words with dashes and appends the extension', () => {
    expect(safeFilename('Immersive Media Installation: Echoes & Light', 'xlsx')).toBe('immersive-media-installation-echoes-light.xlsx');
    expect(safeFilename('Rétro-planning été 2026', '.md')).toBe('retro-planning-ete-2026.md');
    expect(safeFilename('   ', 'json')).toBe('export.json');
    expect(safeFilename('x'.repeat(200), 'csv')).toHaveLength(84);
  });
});

describe('bytesToBase64', () => {
  it('encodes large buffers without recursion limits', () => {
    const bytes = new Uint8Array(200_000).map((_, i) => i % 251);
    const b64 = bytesToBase64(bytes);
    expect(Buffer.from(b64, 'base64').equals(Buffer.from(bytes))).toBe(true);
  });
});

describe('downloadBytes', () => {
  it('routes through window.desktop.saveFile when available', async () => {
    const saveFile = vi.fn(async () => ({ saved: true, path: '/tmp/out.csv' }));
    setWindow({ desktop: { saveFile } });
    const result = await downloadBytes('out.csv', 'a,b\r\n', 'text/csv');
    expect(result).toEqual({ saved: true, path: '/tmp/out.csv', method: 'desktop' });
    expect(saveFile).toHaveBeenCalledWith({ defaultPath: 'out.csv', dataBase64: Buffer.from('a,b\r\n').toString('base64'), mimeType: 'text/csv' });
  });

  it('rejects when neither the desktop bridge nor a DOM is available', async () => {
    setWindow({});
    await expect(downloadBytes('x.bin', new Uint8Array([1, 2, 3]))).rejects.toThrow(/no browser or desktop environment/);
  });
});
