/**
 * Microsoft OneDrive implementation of `CloudProvider` over Microsoft Graph v1.0.
 */
import { cloudFetch, isRecord, num, str } from './httpErrors';
import { getValidAccessToken } from './tokenStore';
import { CloudError, type CloudAccount, type CloudFile, type CloudOAuthConfig, type CloudProvider, type UploadBinaryOptions, type WriteTextOptions } from './types';
import type { AccessTokenSource } from './googleDrive';

const GRAPH = 'https://graph.microsoft.com/v1.0';

/** Graph simple upload limit; larger payloads need an upload session (not implemented). */
export const SIMPLE_UPLOAD_LIMIT = 4 * 1024 * 1024;

/** `/me/drive/root` or `/me/drive/items/{id}`. */
function itemPath(id: string | 'root'): string {
  return id === 'root' ? `${GRAPH}/me/drive/root` : `${GRAPH}/me/drive/items/${encodeURIComponent(id)}`;
}

/** Escapes a string literal for an OData `$filter` (single quotes are doubled). */
export function escapeODataLiteral(value: string): string {
  return value.replace(/'/g, "''");
}

/** Maps a Graph driveItem to a `CloudFile`. */
export function toCloudFile(raw: unknown): CloudFile {
  if (!isRecord(raw)) throw new CloudError('unknown', 'Graph returned a malformed driveItem');
  const id = str(raw, 'id');
  const name = str(raw, 'name');
  if (!id || name === undefined) throw new CloudError('unknown', 'Graph driveItem is missing id or name');
  const file = isRecord(raw.file) ? raw.file : undefined;
  const parentRef = isRecord(raw.parentReference) ? raw.parentReference : undefined;
  return {
    id,
    name,
    isFolder: isRecord(raw.folder),
    mimeType: file ? str(file, 'mimeType') : undefined,
    modifiedTime: str(raw, 'lastModifiedDateTime') ?? new Date(0).toISOString(),
    size: num(raw, 'size'),
    etag: str(raw, 'eTag'),
    webUrl: str(raw, 'webUrl'),
    parentId: parentRef ? str(parentRef, 'id') : undefined,
  };
}

/** OneDrive provider. Construct via `createOneDriveProvider` in app code. */
export class OneDriveProvider implements CloudProvider {
  readonly id = 'onedrive' as const;

  constructor(private readonly tokenSource: AccessTokenSource) {}

  private async authHeaders(extra: Record<string, string> = {}): Promise<Record<string, string>> {
    const token = await this.tokenSource();
    return { Authorization: `Bearer ${token}`, ...extra };
  }

  private async collect(firstUrl: string, context: string): Promise<CloudFile[]> {
    const files: CloudFile[] = [];
    let next: string | undefined = firstUrl;
    while (next) {
      const res = await cloudFetch(next, { headers: await this.authHeaders() }, context);
      const body: unknown = res.json();
      if (!isRecord(body)) throw new CloudError('unknown', `${context}: malformed body`);
      for (const item of Array.isArray(body.value) ? body.value : []) files.push(toCloudFile(item));
      next = str(body, '@odata.nextLink');
    }
    return files;
  }

  async listFolder(folderId: string | 'root'): Promise<CloudFile[]> {
    return this.collect(`${itemPath(folderId)}/children?$top=200`, 'OneDrive list');
  }

  async findChildByName(parentId: string | 'root', name: string): Promise<CloudFile | null> {
    const url = `${itemPath(parentId)}/children?$filter=${encodeURIComponent(`name eq '${escapeODataLiteral(name)}'`)}`;
    const list = await this.collect(url, 'OneDrive find');
    return list.find((f) => f.name === name) ?? list[0] ?? null;
  }

  async ensureFolder(parentId: string | 'root', name: string): Promise<CloudFile> {
    const existing = await this.findChildByName(parentId, name);
    if (existing && existing.isFolder) return existing;
    const res = await cloudFetch(
      `${itemPath(parentId)}/children`,
      { method: 'POST', headers: await this.authHeaders(), body: { name, folder: {}, '@microsoft.graph.conflictBehavior': 'fail' } },
      'OneDrive create folder'
    );
    return toCloudFile(res.json());
  }

  async getFile(fileId: string): Promise<CloudFile> {
    const res = await cloudFetch(itemPath(fileId), { headers: await this.authHeaders() }, 'OneDrive get');
    return toCloudFile(res.json());
  }

  /**
   * Graph answers `/content` with a 302 to a short-lived pre-authenticated download URL.
   * Browser `fetch` follows it transparently (dropping the Authorization header cross-origin,
   * which is what the storage endpoint expects). The Electron main-process fetch behind
   * `window.desktop.fetch` must also follow redirects for this to work.
   */
  async readText(fileId: string): Promise<string> {
    const res = await cloudFetch(`${itemPath(fileId)}/content`, { headers: await this.authHeaders() }, 'OneDrive download');
    return res.text.replace(/^\uFEFF/, '');
  }

  private uploadUrl(parentId: string, name: string): string {
    return `${itemPath(parentId)}:/${encodeURIComponent(name)}:/content`;
  }

  async writeText(opts: WriteTextOptions): Promise<CloudFile> {
    const bytes = new TextEncoder().encode(opts.content);
    if (bytes.length > SIMPLE_UPLOAD_LIMIT) {
      throw new CloudError('unknown', `"${opts.name}" is ${(bytes.length / 1048576).toFixed(1)} MB; OneDrive simple upload is limited to 4 MB`);
    }
    // When an existing id is known we address the item directly so a rename in the cloud is respected.
    const url = opts.existingFileId ? `${itemPath(opts.existingFileId)}/content` : this.uploadUrl(opts.parentId, opts.name);
    const res = await cloudFetch(
      url,
      { method: 'PUT', headers: await this.authHeaders({ 'Content-Type': opts.mimeType }), body: opts.content },
      'OneDrive upload'
    );
    return toCloudFile(res.json());
  }

  async uploadBinary(opts: UploadBinaryOptions): Promise<CloudFile> {
    if (opts.bytes.length > SIMPLE_UPLOAD_LIMIT) {
      throw new CloudError('unknown', `"${opts.name}" is ${(opts.bytes.length / 1048576).toFixed(1)} MB; OneDrive simple upload is limited to 4 MB`);
    }
    // OneDrive has no server-side conversion; `convertTo` is ignored and the raw file is stored.
    const res = await cloudFetch(
      this.uploadUrl(opts.parentId, opts.name),
      { method: 'PUT', headers: await this.authHeaders({ 'Content-Type': opts.mimeType }), body: opts.bytes },
      'OneDrive upload'
    );
    return toCloudFile(res.json());
  }

  /** Moves the item to the OneDrive recycle bin. */
  async deleteFile(fileId: string): Promise<void> {
    await cloudFetch(itemPath(fileId), { method: 'DELETE', headers: await this.authHeaders() }, 'OneDrive delete');
  }

  async getAccount(): Promise<CloudAccount> {
    const res = await cloudFetch(`${GRAPH}/me`, { headers: await this.authHeaders() }, 'Microsoft account');
    const body: unknown = res.json();
    if (!isRecord(body)) throw new CloudError('unknown', '/me returned a malformed body');
    const email = str(body, 'mail') ?? str(body, 'userPrincipalName') ?? '';
    return {
      providerId: 'onedrive',
      name: str(body, 'displayName') ?? email,
      email,
      connectedAt: new Date().toISOString(),
    };
  }
}

/** Creates a OneDrive provider backed by the persisted tokens of the `onedrive` provider. */
export function createOneDriveProvider(cfg: CloudOAuthConfig): OneDriveProvider {
  return new OneDriveProvider(() => getValidAccessToken('onedrive', cfg));
}
