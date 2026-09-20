/**
 * In-memory `CloudProvider` for tests, demos and offline UI development.
 * Timestamps are deterministic: every mutation advances an internal clock by one second.
 */
import { CloudError, type CloudAccount, type CloudFile, type CloudProvider, type CloudProviderId, type UploadBinaryOptions, type WriteTextOptions } from './types';

interface MemoryNode {
  file: CloudFile;
  content: string | Uint8Array;
}

/** A recorded provider call, for assertions. */
export interface MemoryCall {
  method: string;
  args: unknown[];
}

/** Options for `MemoryCloudProvider`. */
export interface MemoryProviderOptions {
  providerId?: CloudProviderId;
  /** Start of the fake clock (epoch ms). */
  startTime?: number;
  account?: Omit<CloudAccount, 'providerId'>;
}

/** Fake provider with a `root` folder; see `mkdir` / `put` to seed content. */
export class MemoryCloudProvider implements CloudProvider {
  readonly id: CloudProviderId;
  /** Every call made through the `CloudProvider` interface, oldest first. */
  readonly calls: MemoryCall[] = [];
  private readonly nodes = new Map<string, MemoryNode>();
  private clock: number;
  private seq = 0;
  private failures: Array<{ method: string; error: CloudError }> = [];
  private readonly account: Omit<CloudAccount, 'providerId'>;

  constructor(opts: MemoryProviderOptions = {}) {
    this.id = opts.providerId ?? 'google';
    this.clock = opts.startTime ?? Date.UTC(2024, 0, 1, 12, 0, 0);
    this.account = opts.account ?? { name: 'Test User', email: 'test@example.com', connectedAt: new Date(this.clock).toISOString() };
  }

  // ----- test helpers -------------------------------------------------------

  /** Current fake time as ISO. */
  now(): string {
    return new Date(this.clock).toISOString();
  }

  /** Advances the fake clock (default one second) and returns the new ISO time. */
  tick(ms = 1000): string {
    this.clock += ms;
    return this.now();
  }

  /** Makes the next call to `method` throw `error` (queued; one failure per call). */
  failNext(method: keyof CloudProvider, error: CloudError = new CloudError('network', `simulated ${method} failure`)): void {
    this.failures.push({ method, error });
  }

  /** Creates a folder directly (no call recorded). */
  mkdir(parentId: string | 'root', name: string): CloudFile {
    return this.insert(parentId, name, true, '', 'application/vnd.folder');
  }

  /** Creates or overwrites a text file directly (no call recorded). Returns the file. */
  put(parentId: string | 'root', name: string, content: string, mimeType = 'text/plain'): CloudFile {
    const existing = this.childByName(parentId, name);
    if (existing) return this.overwrite(existing.id, content, mimeType);
    return this.insert(parentId, name, false, content, mimeType);
  }

  /** Raw content of a file, or `undefined` when absent. */
  contentOf(fileId: string): string | Uint8Array | undefined {
    return this.nodes.get(fileId)?.content;
  }

  /** Metadata of a file, or `undefined` when absent. */
  fileOf(fileId: string): CloudFile | undefined {
    return this.nodes.get(fileId)?.file;
  }

  /** Every file whose parent is `parentId` (direct call, nothing recorded). */
  childrenOf(parentId: string | 'root'): CloudFile[] {
    return [...this.nodes.values()].map((n) => n.file).filter((f) => f.parentId === parentId);
  }

  // ----- internals ----------------------------------------------------------

  private record(method: string, args: unknown[]): void {
    this.calls.push({ method, args });
    const idx = this.failures.findIndex((f) => f.method === method);
    if (idx >= 0) {
      const [f] = this.failures.splice(idx, 1);
      throw f.error;
    }
  }

  private childByName(parentId: string | 'root', name: string): CloudFile | undefined {
    return this.childrenOf(parentId).find((f) => f.name === name);
  }

  private insert(parentId: string | 'root', name: string, isFolder: boolean, content: string | Uint8Array, mimeType: string): CloudFile {
    if (parentId !== 'root' && !this.nodes.get(parentId)?.file.isFolder) {
      throw new CloudError('not-found', `Parent folder ${parentId} does not exist`);
    }
    const id = `mem-${++this.seq}`;
    const file: CloudFile = {
      id,
      name,
      isFolder,
      mimeType,
      modifiedTime: this.tick(),
      size: typeof content === 'string' ? content.length : content.byteLength,
      etag: `etag-${this.seq}-1`,
      webUrl: `memory://${id}`,
      parentId,
    };
    this.nodes.set(id, { file, content });
    return file;
  }

  private overwrite(fileId: string, content: string | Uint8Array, mimeType: string): CloudFile {
    const node = this.nodes.get(fileId);
    if (!node) throw new CloudError('not-found', `File ${fileId} does not exist`);
    const file: CloudFile = {
      ...node.file,
      mimeType,
      modifiedTime: this.tick(),
      size: typeof content === 'string' ? content.length : content.byteLength,
      etag: `${node.file.etag?.split('-').slice(0, 2).join('-') ?? 'etag'}-${++this.seq}`,
    };
    this.nodes.set(fileId, { file, content });
    return file;
  }

  private require(fileId: string): MemoryNode {
    const node = this.nodes.get(fileId);
    if (!node) throw new CloudError('not-found', `File ${fileId} does not exist`, 404);
    return node;
  }

  // ----- CloudProvider ------------------------------------------------------

  async listFolder(folderId: string | 'root'): Promise<CloudFile[]> {
    this.record('listFolder', [folderId]);
    if (folderId !== 'root') this.require(folderId);
    return this.childrenOf(folderId).map((f) => ({ ...f }));
  }

  async findChildByName(parentId: string | 'root', name: string): Promise<CloudFile | null> {
    this.record('findChildByName', [parentId, name]);
    const f = this.childByName(parentId, name);
    return f ? { ...f } : null;
  }

  async ensureFolder(parentId: string | 'root', name: string): Promise<CloudFile> {
    this.record('ensureFolder', [parentId, name]);
    const existing = this.childByName(parentId, name);
    if (existing?.isFolder) return { ...existing };
    return { ...this.insert(parentId, name, true, '', 'application/vnd.folder') };
  }

  async getFile(fileId: string): Promise<CloudFile> {
    this.record('getFile', [fileId]);
    return { ...this.require(fileId).file };
  }

  async readText(fileId: string): Promise<string> {
    this.record('readText', [fileId]);
    const { content } = this.require(fileId);
    return typeof content === 'string' ? content : new TextDecoder().decode(content);
  }

  async writeText(opts: WriteTextOptions): Promise<CloudFile> {
    this.record('writeText', [opts]);
    if (opts.existingFileId) return { ...this.overwrite(opts.existingFileId, opts.content, opts.mimeType) };
    const clash = this.childByName(opts.parentId, opts.name);
    if (clash) return { ...this.overwrite(clash.id, opts.content, opts.mimeType) };
    return { ...this.insert(opts.parentId, opts.name, false, opts.content, opts.mimeType) };
  }

  async uploadBinary(opts: UploadBinaryOptions): Promise<CloudFile> {
    this.record('uploadBinary', [opts]);
    const mime = opts.convertTo === 'google-sheet' ? 'application/vnd.google-apps.spreadsheet' : opts.mimeType;
    const clash = this.childByName(opts.parentId, opts.name);
    if (clash) return { ...this.overwrite(clash.id, opts.bytes, mime) };
    return { ...this.insert(opts.parentId, opts.name, false, opts.bytes, mime) };
  }

  async deleteFile(fileId: string): Promise<void> {
    this.record('deleteFile', [fileId]);
    this.require(fileId);
    const doomed = [fileId];
    while (doomed.length) {
      const id = doomed.pop()!;
      for (const child of this.childrenOf(id)) doomed.push(child.id);
      this.nodes.delete(id);
    }
  }

  async getAccount(): Promise<CloudAccount> {
    this.record('getAccount', []);
    return { providerId: this.id, ...this.account };
  }
}
