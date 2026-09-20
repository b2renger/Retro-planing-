import { afterEach, describe, expect, it, vi } from 'vitest';
import { OneDriveProvider } from './oneDrive';
import { CloudError } from './types';
import { fetchCall, jsonResponse, textResponse } from './testFixtures';

afterEach(() => {
  vi.unstubAllGlobals();
});

const provider = new OneDriveProvider(async () => 'MSTOKEN');

function stub(...responses: Response[]) {
  const mock = vi.fn();
  for (const r of responses) mock.mockResolvedValueOnce(r);
  vi.stubGlobal('fetch', mock);
  return mock;
}

const item = (over: Record<string, unknown>) => ({ lastModifiedDateTime: '2024-01-01T00:00:00Z', eTag: '"e1"', webUrl: 'https://1drv.ms/x', parentReference: { id: 'parent' }, ...over });

describe('OneDriveProvider.listFolder', () => {
  it('lists the root children and follows @odata.nextLink', async () => {
    const mock = stub(
      jsonResponse({ '@odata.nextLink': 'https://graph.microsoft.com/v1.0/me/drive/root/children?$skiptoken=abc', value: [item({ id: 'a', name: 'docs', folder: { childCount: 2 }, size: 0 })] }),
      jsonResponse({ value: [item({ id: 'b', name: 'Brief.md', file: { mimeType: 'text/markdown' }, size: 42 })] })
    );
    const files = await provider.listFolder('root');
    expect(fetchCall(mock, 0).url).toBe('https://graph.microsoft.com/v1.0/me/drive/root/children?$top=200');
    expect((fetchCall(mock, 0).init.headers as Record<string, string>).Authorization).toBe('Bearer MSTOKEN');
    expect(fetchCall(mock, 1).url).toContain('$skiptoken=abc');
    expect(files).toEqual([
      { id: 'a', name: 'docs', isFolder: true, mimeType: undefined, modifiedTime: '2024-01-01T00:00:00Z', size: 0, etag: '"e1"', webUrl: 'https://1drv.ms/x', parentId: 'parent' },
      expect.objectContaining({ id: 'b', name: 'Brief.md', isFolder: false, mimeType: 'text/markdown', size: 42 }),
    ]);
  });

  it('lists a folder by item id', async () => {
    const mock = stub(jsonResponse({ value: [] }));
    await provider.listFolder('01ABC');
    expect(fetchCall(mock).url).toBe('https://graph.microsoft.com/v1.0/me/drive/items/01ABC/children?$top=200');
  });
});

describe('OneDriveProvider.findChildByName / ensureFolder', () => {
  it('filters by name with OData escaping', async () => {
    const mock = stub(jsonResponse({ value: [] }));
    await expect(provider.findChildByName('p1', "O'Brien.md")).resolves.toBeNull();
    expect(fetchCall(mock).url).toBe("https://graph.microsoft.com/v1.0/me/drive/items/p1/children?$filter=name%20eq%20'O''Brien.md'");
  });

  it('creates a folder with conflictBehavior=fail when missing', async () => {
    const mock = stub(jsonResponse({ value: [] }), jsonResponse(item({ id: 'nf', name: 'docs', folder: {} }), 201));
    const folder = await provider.ensureFolder('root', 'docs');
    expect(folder).toMatchObject({ id: 'nf', isFolder: true });
    const create = fetchCall(mock, 1);
    expect(create.url).toBe('https://graph.microsoft.com/v1.0/me/drive/root/children');
    expect(create.init.method).toBe('POST');
    expect(JSON.parse(String(create.init.body))).toEqual({ name: 'docs', folder: {}, '@microsoft.graph.conflictBehavior': 'fail' });
  });
});

describe('OneDriveProvider content', () => {
  it('reads text through /content', async () => {
    const mock = stub(textResponse('﻿# hi'));
    await expect(provider.readText('f1')).resolves.toBe('# hi');
    expect(fetchCall(mock).url).toBe('https://graph.microsoft.com/v1.0/me/drive/items/f1/content');
  });

  it('writes text with a PUT under the parent path', async () => {
    const mock = stub(jsonResponse(item({ id: 'w1', name: 'Brief.md', file: { mimeType: 'text/markdown' } }), 201));
    const file = await provider.writeText({ parentId: 'docs1', name: 'My Brief.md', content: '# hi', mimeType: 'text/markdown' });
    const { url, init } = fetchCall(mock);
    expect(url).toBe('https://graph.microsoft.com/v1.0/me/drive/items/docs1:/My%20Brief.md:/content');
    expect(init.method).toBe('PUT');
    expect((init.headers as Record<string, string>)['Content-Type']).toBe('text/markdown');
    expect(init.body).toBe('# hi');
    expect(file.id).toBe('w1');
  });

  it('overwrites an existing item by id', async () => {
    const mock = stub(jsonResponse(item({ id: 'w1', name: 'Brief.md', file: {} })));
    await provider.writeText({ parentId: 'docs1', name: 'Brief.md', content: 'v2', mimeType: 'text/markdown', existingFileId: 'w1' });
    expect(fetchCall(mock).url).toBe('https://graph.microsoft.com/v1.0/me/drive/items/w1/content');
  });

  it('uploads binary bytes with PUT', async () => {
    const mock = stub(jsonResponse(item({ id: 'b1', name: 'x.xlsx', file: {} }), 201));
    const bytes = new Uint8Array([1, 2, 3]);
    await provider.uploadBinary({ parentId: 'exp', name: 'x.xlsx', bytes, mimeType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
    const { url, init } = fetchCall(mock);
    expect(url).toBe('https://graph.microsoft.com/v1.0/me/drive/items/exp:/x.xlsx:/content');
    expect(init.body).toBe(bytes);
  });

  it('refuses simple uploads above 4 MB', async () => {
    const mock = stub();
    const big = new Uint8Array(4 * 1024 * 1024 + 1);
    await expect(provider.uploadBinary({ parentId: 'p', name: 'big.bin', bytes: big, mimeType: 'application/octet-stream' })).rejects.toThrow(/4 MB/);
    expect(mock).not.toHaveBeenCalled();
  });

  it('deletes by item id', async () => {
    const mock = stub(new Response(null, { status: 204 }));
    await provider.deleteFile('f1');
    expect(fetchCall(mock)).toMatchObject({ url: 'https://graph.microsoft.com/v1.0/me/drive/items/f1', init: { method: 'DELETE' } });
  });
});

describe('OneDriveProvider account and errors', () => {
  it('reads /me and prefers mail over userPrincipalName', async () => {
    stub(jsonResponse({ displayName: 'Ada', mail: null, userPrincipalName: 'ada@contoso.com' }));
    await expect(provider.getAccount()).resolves.toMatchObject({ providerId: 'onedrive', name: 'Ada', email: 'ada@contoso.com' });
  });

  it('maps Graph errors', async () => {
    stub(jsonResponse({ error: { code: 'itemNotFound', message: 'The resource could not be found.' } }, 404));
    const err = await provider.getFile('nope').catch((e: unknown) => e);
    expect(err).toBeInstanceOf(CloudError);
    expect((err as CloudError).kind).toBe('not-found');
    expect((err as CloudError).message).toContain('could not be found');
  });
});
