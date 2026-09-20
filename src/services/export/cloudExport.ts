/**
 * Pushes the planning workbook to a cloud folder: converted to a native Google Sheet on
 * Drive, or stored as `.xlsx` on OneDrive (which Excel Online opens in place).
 * Depends only on a minimal structural upload interface so it can be wired to any provider.
 */
import type { Project, User } from '../../types';
import { projectToXlsx } from './xlsx';

/** MIME type of an Office Open XML spreadsheet. */
export const XLSX_MIME_TYPE = 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';

/** Arguments of `ExportUploadProvider.uploadBinary` (a subset of the cloud layer's options). */
export interface ExportUploadRequest {
  parentId: string;
  name: string;
  bytes: Uint8Array;
  mimeType: string;
  /** Ask the provider to convert the upload into a native spreadsheet. */
  convertTo?: 'google-sheet';
}

/** What an upload resolves to (a subset of the cloud layer's `CloudFile`). */
export interface ExportUploadResult {
  id: string;
  name: string;
  webUrl?: string;
}

/** The only provider capability the exports need; every `CloudProvider` satisfies it. */
export interface ExportUploadProvider {
  uploadBinary(opts: ExportUploadRequest): Promise<ExportUploadResult>;
}

/** Location of the uploaded export. */
export interface CloudExportResult {
  fileId: string;
  webUrl?: string;
  name: string;
}

/**
 * `<title> - planning.xlsx`, with the characters no cloud file system accepts (`\ / : * ? " < > |`)
 * replaced by `-`.
 */
export function planningExportName(project: Project): string {
  const title = (project.title || 'Project').replace(/[\\/:*?"<>|]/g, '-').replace(/\s+/g, ' ').trim();
  return `${title} - planning.xlsx`;
}

async function upload(
  provider: ExportUploadProvider,
  exportsFolderId: string,
  project: Project,
  members: readonly User[],
  convertTo?: 'google-sheet'
): Promise<CloudExportResult> {
  const bytes = await projectToXlsx(project, members);
  const file = await provider.uploadBinary({
    parentId: exportsFolderId,
    name: planningExportName(project),
    bytes,
    mimeType: XLSX_MIME_TYPE,
    ...(convertTo ? { convertTo } : {}),
  });
  return { fileId: file.id, webUrl: file.webUrl, name: file.name };
}

/** Uploads the workbook to Google Drive converted to a native Google Sheet. */
export function exportToGoogleSheets(
  provider: ExportUploadProvider,
  exportsFolderId: string,
  project: Project,
  members: readonly User[] = []
): Promise<CloudExportResult> {
  return upload(provider, exportsFolderId, project, members, 'google-sheet');
}

/** Uploads the workbook to OneDrive as `.xlsx` (opens directly in Excel Online). */
export function exportToOneDriveExcel(
  provider: ExportUploadProvider,
  exportsFolderId: string,
  project: Project,
  members: readonly User[] = []
): Promise<CloudExportResult> {
  return upload(provider, exportsFolderId, project, members);
}
