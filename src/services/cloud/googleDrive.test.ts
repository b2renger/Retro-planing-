import { afterEach, describe, expect, it, vi } from 'vitest';
import { GoogleDriveProvider, MULTIPART_BOUNDARY } from './googleDrive';
import { CloudError } from './types';
import { fetchCall, jsonResponse, textResponse } from './testFixtures';

afterEach(() => {
  vi.unstubAllGlobals();
});

const provider = new GoogleDriveProvider(async () => 'TOKEN');

function stub(...responses: Response[]) {
  const mock = vi.fn();
  for (const r of responses) mock.mockResolvedValueOnce(r);
  vi.stubGlobal('fetch', mock);
  return mock;
}

describe('GoogleDriveProvider.listFolder', () => {
  it('queries children with the expected fields and follows nextPageToken', async () => {
    const mock = stub(
      jsonResponse({ nextPageToken: 'p2', files: [{ id: 'f1', name: 'a.md', mimeType: 'text/markdown', modifiedTime: '2024-01-01T00:00:00.000Z', size: '12', parents: ['folder1'] }] }),
      jsonResponse({ files: [{ id: 'd1', name: 'docs', mimeType: 'application/vnd.google-apps.folder', modifiedTime: '2024-01-02T00:00:00.000Z' }] })
    );
    const files = await provider.listFolder('folder1');
    expect(mock).toHaveBeenCalledTimes(2);
    const first = new URL(fetchCall(mock, 0).url);
    expect(first.origin + first.pathname).toBe('https://www.googleapis.com/drive/v3/files');
    expect(first.searchParams.get('q')).toBe("'folder1' in parents and trashed=false");
    expect(first.searchParams.get('fields')).toBe('nextPageToken,files(id,name,mimeType,modifiedTime,size,webViewLink,parents,md5Checksum)');
    expect(first.searchParams.get('pageSize')).toBe('1000');
    expect((fetchCall(mock, 0).init.headers as Record<string, string>).Authorization).toBe('Bearer TOKEN');
    expect(new URL(fetchCall(mock, 1).url).searchParams.get('pageToken')).toBe('p2');
    expect(files).toEqual([
      { id: 'f1', name: 'a.md', isFolder: false, mimeType: 'text/markdown', modifiedTime: '2024-01-01T00:00:00.000Z', size: 12, etag: undefined, webUrl: undefined, parentId: 'folder1' },
      expect.objectContaining({ id: 'd1', isFolder: true }),
    ]);
  });
});

describe('GoogleDriveProvider.readText', () => {
  it('downloads regular files with alt=media', async () => {
    const mock = stub(jsonResponse({ id: 'f1', name: 'a.md', mimeType: 'text/markdown', modifiedTime: 'x' }), textResponse('# hello'));
    await expect(provider.readText('f1')).resolves.toBe('# hello');
    expect(fetchCall(mock, 1).url).toBe('https://www.googleapis.com/drive/v3/files/f1?alt=media');
  });

  it('exports Google Docs as plain text and strips the BOM', async () => {
    const mock = stub(jsonResponse({ id: 'g1', name: 'Doc', mimeType: 'application/vnd.google-apps.document', modifiedTime: 'x' }), textResponse('﻿exported'));
    await expect(provider.readText('g1')).resolves.toBe('exported');
    expect(fetchCall(mock, 1).url).toBe('https://www.googleapis.com/drive/v3/files/g1/export?mimeType=text%2Fplain');
  });
});

describe('GoogleDriveProvider.writeText', () => {
  it('creates with a multipart POST carrying parents', async () => {
    const mock = stub(jsonResponse({ id: 'new', name: 'a.md', mimeType: 'text/markdown', modifiedTime: '2024-01-01T00:00:00.000Z' }));
    const file = await provider.writeText({ parentId: 'folder1', name: 'a.md', content: '# hi', mimeType: 'text/markdown' });
    const { url, init } = fetchCall(mock);
    expect(url).toBe('https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart&fields=id%2Cname%2CmimeType%2CmodifiedTime%2Csize%2CwebViewLink%2Cparents%2Cmd5Checksum');
    expect(init.method).toBe('POST');
    expect((init.headers as Record<string, string>)['Content-Type']).toBe(`multipart/related; boundary=${MULTIPART_BOUNDARY}`);
    expect(init.body).toBe(
      `--${MULTIPART_BOUNDARY}\r\nContent-Type: application/json; charset=UTF-8\r\n\r\n` +
        '{"name":"a.md","mimeType":"text/markdown","parents":["folder1"]}\r\n' +
        `--${MULTIPART_BOUNDARY}\r\nContent-Type: text/markdown\r\n\r\n# hi\r\n--${MULTIPART_BOUNDARY}--`
    );
    expect(file.id).toBe('new');
  });

  it('updates with a multipart PATCH on the file id and no parents', async () => {
    const mock = stub(jsonResponse({ id: 'f1', name: 'a.md', mimeType: 'text/markdown', modifiedTime: 'x' }));
    await provider.writeText({ parentId: 'folder1', name: 'a.md', content: 'v2', mimeType: 'text/markdown', existingFileId: 'f1' });
    const { url, init } = fetchCall(mock);
    expect(url.startsWith('https://www.googleapis.com/upload/drive/v3/files/f1?uploadType=multipart')).toBe(true);
    expect(init.method).toBe('PATCH');
    expect(init.body).toContain('{"name":"a.md","mimeType":"text/markdown"}');
    expect(init.body).not.toContain('parents');
  });
});

describe('GoogleDriveProvider.uploadBinary', () => {
  it('sends a base64 media part and asks for Sheets conversion', async () => {
    const mock = stub(jsonResponse({ id: 's1', name: 'x.xlsx', mimeType: 'application/vnd.google-apps.spreadsheet', modifiedTime: 'x' }));
    await provider.uploadBinary({ parentId: 'exports', name: 'x.xlsx', bytes: new Uint8Array([1, 2, 3, 250]), mimeType: 'application/octet-stream', convertTo: 'google-sheet' });
    const body = String(fetchCall(mock).init.body);
    expect(body).toContain('{"name":"x.xlsx","parents":["exports"],"mimeType":"application/vnd.google-apps.spreadsheet"}');
    expect(body).toContain('Content-Type: application/octet-stream\r\nContent-Transfer-Encoding: base64\r\n\r\nAQID+g==\r\n');
  });
});

describe('GoogleDriveProvider folders and account', () => {
  it('ensureFolder returns the existing folder or creates one', async () => {
    const mock = stub(
      jsonResponse({ files: [] }),
      jsonResponse({ id: 'nf', name: 'docs', mimeType: 'application/vnd.google-apps.folder', modifiedTime: 'x' })
    );
    const folder = await provider.ensureFolder('p', 'docs');
    expect(folder).toMatchObject({ id: 'nf', isFolder: true });
    expect(new URL(fetchCall(mock, 0).url).searchParams.get('q')).toBe("'p' in parents and name = 'docs' and trashed=false");
    const create = fetchCall(mock, 1);
    expect(create.init.method).toBe('POST');
    expect(JSON.parse(String(create.init.body))).toEqual({ name: 'docs', mimeType: 'application/vnd.google-apps.folder', parents: ['p'] });
  });

  it('escapes quotes in name lookups', async () => {
    const mock = stub(jsonResponse({ files: [] }));
    await provider.findChildByName('root', "O'Brien");
    expect(new URL(fetchCall(mock).url).searchParams.get('q')).toBe("'root' in parents and name = 'O\\'Brien' and trashed=false");
  });

  it('deleteFile trashes the file', async () => {
    const mock = stub(jsonResponse({ id: 'f1', name: 'x', trashed: true }));
    await provider.deleteFile('f1');
    const { url, init } = fetchCall(mock);
    expect(url).toBe('https://www.googleapis.com/drive/v3/files/f1');
    expect(init.method).toBe('PATCH');
    expect(JSON.parse(String(init.body))).toEqual({ trashed: true });
  });

  it('getAccount reads userinfo', async () => {
    const mock = stub(jsonResponse({ name: 'Ada', email: 'ada@example.com' }));
    const account = await provider.getAccount();
    expect(fetchCall(mock).url).toBe('https://www.googleapis.com/oauth2/v3/userinfo');
    expect(account).toMatchObject({ providerId: 'google', name: 'Ada', email: 'ada@example.com' });
  });
});

describe('GoogleDriveProvider error mapping', () => {
  const kindOf = async (p: Promise<unknown>) => {
    const err = await p.catch((e: unknown) => e);
    expect(err).toBeInstanceOf(CloudError);
    return err as CloudError;
  };

  it('maps 401 to auth', async () => {
    stub(jsonResponse({ error: { message: 'Invalid Credentials' } }, 401));
    const err = await kindOf(provider.listFolder('x'));
    expect(err.kind).toBe('auth');
    expect(err.status).toBe(401);
    expect(err.message).toContain('Invalid Credentials');
  });

  it('maps 404 to not-found', async () => {
    stub(jsonResponse({ error: { message: 'File not found' } }, 404));
    expect((await kindOf(provider.getFile('x'))).kind).toBe('not-found');
  });

  it('maps 403 storageQuotaExceeded to quota', async () => {
    stub(jsonResponse({ error: { errors: [{ reason: 'storageQuotaExceeded' }], message: 'The user has exceeded their Drive storage quota' } }, 403));
    expect((await kindOf(provider.writeText({ parentId: 'p', name: 'n', content: 'c', mimeType: 'text/plain' }))).kind).toBe('quota');
  });

  it('maps transport failures to network', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new TypeError('Failed to fetch')));
    expect((await kindOf(provider.listFolder('x'))).kind).toBe('network');
  });
});
