/**
 * Google Drive v3 implementation of `CloudProvider`.
 * All requests go through `cloudFetch` (→ `httpFetch`) so they work in both web and Electron.
 */
import { cloudFetch, isRecord, num, str } from './httpErrors';
import { getValidAccessToken } from './tokenStore';
import { CloudError, type CloudAccount, type CloudFile, type CloudOAuthConfig, type CloudProvider, type UploadBinaryOptions, type WriteTextOptions } from './types';

const API = 'https://www.googleapis.com/drive/v3';
const UPLOAD_API = 'https://www.googleapis.com/upload/drive/v3';
const USERINFO = 'https://www.googleapis.com/oauth2/v3/userinfo';

/** MIME type of Drive folders. */
export const GOOGLE_FOLDER_MIME = 'application/vnd.google-apps.folder';
/** MIME type of native Google Docs (exported as text/plain by `readText`). */
export const GOOGLE_DOC_MIME = 'application/vnd.google-apps.document';
/** MIME type of native Google Sheets (target of `convertTo: 'google-sheet'`). */
export const GOOGLE_SHEET_MIME = 'application/vnd.google-apps.spreadsheet';

/** Fixed multipart boundary; the body is built by hand as a string so `httpFetch` can carry it. */
export const MULTIPART_BOUNDARY = 'rps_multipart_boundary_7f3a9c1e';

const FILE_FIELDS = 'id,name,mimeType,modifiedTime,size,webViewLink,parents,md5Checksum';

/** Supplies the bearer token for each request (injectable for tests). */
export type AccessTokenSource = () => Promise<string>;

/** Escapes a value for use inside a Drive `q` string literal. */
export function escapeDriveQuery(value: string): string {
  return value.replace(/\\/g, '\\\\').replace(/'/g, "\\'");
}

/** Maps a Drive `files` resource to a `CloudFile`. */
export function toCloudFile(raw: unknown): CloudFile {
  if (!isRecord(raw)) throw new CloudError('unknown', 'Drive returned a malformed file resource');
  const id = str(raw, 'id');
  const name = str(raw, 'name');
  if (!id || name === undefined) throw new CloudError('unknown', 'Drive file resource is missing id or name');
  const mimeType = str(raw, 'mimeType');
  const parents = Array.isArray(raw.parents) ? raw.parents.filter((p): p is string => typeof p === 'string') : [];
  return {
    id,
    name,
    isFolder: mimeType === GOOGLE_FOLDER_MIME,
    mimeType,
    modifiedTime: str(raw, 'modifiedTime') ?? new Date(0).toISOString(),
    size: num(raw, 'size'),
    etag: str(raw, 'md5Checksum'),
    webUrl: str(raw, 'webViewLink'),
    parentId: parents[0],
  };
}

function toBase64(bytes: Uint8Array): string {
  let bin = '';
  const chunk = 0x8000;
  for (let i = 0; i < bytes.length; i += chunk) bin += String.fromCharCode(...bytes.subarray(i, i + chunk));
  return btoa(bin);
}

/** Builds a `multipart/related` body with a JSON metadata part and a media part. */
export function buildMultipartBody(metadata: Record<string, unknown>, media: { mimeType: string; content: string; base64?: boolean }): string {
  const b = MULTIPART_BOUNDARY;
  const mediaHeaders = [`Content-Type: ${media.mimeType}`];
  if (media.base64) mediaHeaders.push('Content-Transfer-Encoding: base64');
  return (
    `--${b}\r\n` +
    'Content-Type: application/json; charset=UTF-8\r\n\r\n' +
    `${JSON.stringify(metadata)}\r\n` +
    `--${b}\r\n` +
    `${mediaHeaders.join('\r\n')}\r\n\r\n` +
    `${media.content}\r\n` +
    `--${b}--`
  );
}

/** Google Drive provider. Construct via `createGoogleDriveProvider` in app code. */
export class GoogleDriveProvider implements CloudProvider {
  readonly id = 'google' as const;

  constructor(private readonly tokenSource: AccessTokenSource) {}

  private async authHeaders(extra: Record<string, string> = {}): Promise<Record<string, string>> {
    const token = await this.tokenSource();
    return { Authorization: `Bearer ${token}`, ...extra };
  }

  async listFolder(folderId: string | 'root'): Promise<CloudFile[]> {
    const q = `'${escapeDriveQuery(folderId)}' in parents and trashed=false`;
    const files: CloudFile[] = [];
    let pageToken: string | undefined;
    do {
      const url = new URL(`${API}/files`);
      url.searchParams.set('q', q);
      url.searchParams.set('fields', `nextPageToken,files(${FILE_FIELDS})`);
      url.searchParams.set('pageSize', '1000');
      if (pageToken) url.searchParams.set('pageToken', pageToken);
      const res = await cloudFetch(url.toString(), { headers: await this.authHeaders() }, 'Drive list');
      const body: unknown = res.json();
      if (!isRecord(body)) throw new CloudError('unknown', 'Drive list returned a malformed body');
      for (const f of Array.isArray(body.files) ? body.files : []) files.push(toCloudFile(f));
      pageToken = str(body, 'nextPageToken');
    } while (pageToken);
    return files;
  }

  async findChildByName(parentId: string | 'root', name: string): Promise<CloudFile | null> {
    const q = `'${escapeDriveQuery(parentId)}' in parents and name = '${escapeDriveQuery(name)}' and trashed=false`;
    const url = new URL(`${API}/files`);
    url.searchParams.set('q', q);
    url.searchParams.set('fields', `files(${FILE_FIELDS})`);
    url.searchParams.set('pageSize', '10');
    const res = await cloudFetch(url.toString(), { headers: await this.authHeaders() }, 'Drive find');
    const body: unknown = res.json();
    const list = isRecord(body) && Array.isArray(body.files) ? body.files.map(toCloudFile) : [];
    return list.find((f) => f.name === name) ?? list[0] ?? null;
  }

  async ensureFolder(parentId: string | 'root', name: string): Promise<CloudFile> {
    const existing = await this.findChildByName(parentId, name);
    if (existing && existing.isFolder) return existing;
    const url = `${API}/files?fields=${encodeURIComponent(FILE_FIELDS)}`;
    const res = await cloudFetch(
      url,
      { method: 'POST', headers: await this.authHeaders(), body: { name, mimeType: GOOGLE_FOLDER_MIME, parents: [parentId] } },
      'Drive create folder'
    );
    return toCloudFile(res.json());
  }

  async getFile(fileId: string): Promise<CloudFile> {
    const url = `${API}/files/${encodeURIComponent(fileId)}?fields=${encodeURIComponent(FILE_FIELDS)}`;
    const res = await cloudFetch(url, { headers: await this.authHeaders() }, 'Drive get');
    return toCloudFile(res.json());
  }

  async readText(fileId: string): Promise<string> {
    const meta = await this.getFile(fileId);
    const id = encodeURIComponent(fileId);
    let url: string;
    if (meta.mimeType === GOOGLE_DOC_MIME) {
      // A Google Doc created by the user inside the folder is imported as plain text.
      url = `${API}/files/${id}/export?mimeType=${encodeURIComponent('text/plain')}`;
    } else if (meta.mimeType?.startsWith('application/vnd.google-apps.')) {
      throw new CloudError('unknown', `"${meta.name}" is a native Google file (${meta.mimeType}) that cannot be read as text`);
    } else {
      url = `${API}/files/${id}?alt=media`;
    }
    const res = await cloudFetch(url, { headers: await this.authHeaders() }, 'Drive download');
    // Google Docs exports start with a UTF-8 BOM.
    return res.text.replace(/^\uFEFF/, '');
  }

  private async multipartUpload(metadata: Record<string, unknown>, media: { mimeType: string; content: string; base64?: boolean }, existingFileId?: string): Promise<CloudFile> {
    const target = existingFileId ? `${UPLOAD_API}/files/${encodeURIComponent(existingFileId)}` : `${UPLOAD_API}/files`;
    const url = `${target}?uploadType=multipart&fields=${encodeURIComponent(FILE_FIELDS)}`;
    const res = await cloudFetch(
      url,
      {
        method: existingFileId ? 'PATCH' : 'POST',
        headers: await this.authHeaders({ 'Content-Type': `multipart/related; boundary=${MULTIPART_BOUNDARY}` }),
        body: buildMultipartBody(metadata, media),
      },
      existingFileId ? 'Drive update' : 'Drive upload'
    );
    return toCloudFile(res.json());
  }

  async writeText(opts: WriteTextOptions): Promise<CloudFile> {
    // `parents` is only valid on create; updates keep their location.
    const metadata: Record<string, unknown> = opts.existingFileId
      ? { name: opts.name, mimeType: opts.mimeType }
      : { name: opts.name, mimeType: opts.mimeType, parents: [opts.parentId] };
    return this.multipartUpload(metadata, { mimeType: opts.mimeType, content: opts.content }, opts.existingFileId);
  }

  async uploadBinary(opts: UploadBinaryOptions): Promise<CloudFile> {
    const metadata: Record<string, unknown> = { name: opts.name, parents: [opts.parentId] };
    if (opts.convertTo === 'google-sheet') metadata.mimeType = GOOGLE_SHEET_MIME;
    return this.multipartUpload(metadata, { mimeType: opts.mimeType, content: toBase64(opts.bytes), base64: true });
  }

  /** Moves the file to the Drive trash (recoverable by the user; trashed files are excluded from listings). */
  async deleteFile(fileId: string): Promise<void> {
    await cloudFetch(
      `${API}/files/${encodeURIComponent(fileId)}`,
      { method: 'PATCH', headers: await this.authHeaders(), body: { trashed: true } },
      'Drive delete'
    );
  }

  async getAccount(): Promise<CloudAccount> {
    const res = await cloudFetch(USERINFO, { headers: await this.authHeaders() }, 'Google account');
    const body: unknown = res.json();
    if (!isRecord(body)) throw new CloudError('unknown', 'userinfo returned a malformed body');
    const email = str(body, 'email') ?? '';
    return {
      providerId: 'google',
      name: str(body, 'name') ?? email,
      email,
      connectedAt: new Date().toISOString(),
    };
  }
}

/** Creates a Drive provider backed by the persisted tokens of the `google` provider. */
export function createGoogleDriveProvider(cfg: CloudOAuthConfig): GoogleDriveProvider {
  return new GoogleDriveProvider(() => getValidAccessToken('google', cfg));
}
