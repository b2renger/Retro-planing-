/**
 * Shared types for the cloud storage layer (Google Drive / Microsoft OneDrive).
 * The cloud folder is the source of truth for project data; see `syncEngine.ts`.
 */

/** Supported cloud storage providers. */
export type CloudProviderId = 'google' | 'onedrive';

/** Provider-agnostic description of a file or folder. */
export interface CloudFile {
  id: string;
  name: string;
  isFolder: boolean;
  mimeType?: string;
  /** ISO 8601 timestamp of the last remote modification. */
  modifiedTime: string;
  size?: number;
  /** Provider change tag (Graph eTag, Drive md5Checksum) when available. */
  etag?: string;
  /** Link to open the file in the provider's web UI. */
  webUrl?: string;
  parentId?: string;
}

/** The signed-in account behind a provider connection. */
export interface CloudAccount {
  providerId: CloudProviderId;
  name: string;
  email: string;
  /** ISO 8601 timestamp of when the connection was established. */
  connectedAt: string;
}

/** OAuth 2.0 token set as persisted by `tokenStore.ts`. */
export interface OAuthTokens {
  accessToken: string;
  refreshToken?: string;
  /** Epoch milliseconds at which `accessToken` stops being valid. */
  expiresAt: number;
  scope?: string;
  tokenType?: string;
}

/**
 * User-supplied OAuth client registration.
 * `clientSecret` is only used by the Google desktop (loopback) flow; web and Microsoft
 * flows are public clients and never send it.
 */
export interface CloudOAuthConfig {
  clientId: string;
  clientSecret?: string;
}

/** Arguments for `CloudProvider.writeText`. */
export interface WriteTextOptions {
  parentId: string;
  name: string;
  content: string;
  mimeType: string;
  /** When set, the existing file is overwritten instead of a new one being created. */
  existingFileId?: string;
}

/** Arguments for `CloudProvider.uploadBinary`. */
export interface UploadBinaryOptions {
  parentId: string;
  name: string;
  bytes: Uint8Array;
  mimeType: string;
  /** Ask the provider to convert the upload into a native spreadsheet (Google Sheets). */
  convertTo?: 'google-sheet';
}

/** Minimal file-system-like surface every provider implements. */
export interface CloudProvider {
  readonly id: CloudProviderId;
  /** Lists the direct children of a folder (`'root'` = the drive root). */
  listFolder(folderId: string | 'root'): Promise<CloudFile[]>;
  /** Finds a direct child by exact name, or `null` when absent. */
  findChildByName(parentId: string | 'root', name: string): Promise<CloudFile | null>;
  /** Returns the child folder named `name`, creating it when missing. */
  ensureFolder(parentId: string | 'root', name: string): Promise<CloudFile>;
  /** Fetches metadata for one file. */
  getFile(fileId: string): Promise<CloudFile>;
  /** Downloads a file as UTF-8 text (native documents are exported as plain text). */
  readText(fileId: string): Promise<string>;
  /** Creates or overwrites a text file. */
  writeText(opts: WriteTextOptions): Promise<CloudFile>;
  /** Uploads a binary file, optionally converting it to a native format. */
  uploadBinary(opts: UploadBinaryOptions): Promise<CloudFile>;
  /** Permanently deletes (or trashes) a file. */
  deleteFile(fileId: string): Promise<void>;
  /** Returns the signed-in account. */
  getAccount(): Promise<CloudAccount>;
}

/** Category of failure, so the UI can decide between "reconnect", "retry" and "give up". */
export type CloudErrorKind = 'auth' | 'network' | 'not-found' | 'conflict' | 'quota' | 'unknown';

/** Error raised by every module of the cloud layer. */
export class CloudError extends Error {
  readonly kind: CloudErrorKind;
  readonly status?: number;

  constructor(kind: CloudErrorKind, message: string, status?: number) {
    super(message);
    this.name = 'CloudError';
    this.kind = kind;
    this.status = status;
  }
}

/** Type guard for `CloudError`. */
export function isCloudError(err: unknown): err is CloudError {
  return err instanceof CloudError;
}
