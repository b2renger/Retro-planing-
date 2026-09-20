import { describe, expect, it } from 'vitest';
import { MEDIA_INSTALLATION_PROJECT, MOCK_USERS } from '../../data/mockData';
import {
  XLSX_MIME_TYPE,
  exportToGoogleSheets,
  exportToOneDriveExcel,
  planningExportName,
  type ExportUploadProvider,
  type ExportUploadRequest,
} from './cloudExport';

function fakeProvider(): { provider: ExportUploadProvider; calls: ExportUploadRequest[] } {
  const calls: ExportUploadRequest[] = [];
  const provider: ExportUploadProvider = {
    async uploadBinary(opts) {
      calls.push(opts);
      return { id: `file-${calls.length}`, name: opts.name, webUrl: `https://example.test/${calls.length}` };
    },
  };
  return { provider, calls };
}

describe('planningExportName', () => {
  it('appends " - planning.xlsx" and strips characters cloud drives reject', () => {
    expect(planningExportName(MEDIA_INSTALLATION_PROJECT)).toBe(
      'Immersive Media Installation- Echoes & Light (Projection & 8.1 Sound) - planning.xlsx'
    );
  });
});

describe('exportToGoogleSheets', () => {
  it('uploads the xlsx bytes asking for a Google Sheet conversion', async () => {
    const { provider, calls } = fakeProvider();
    const result = await exportToGoogleSheets(provider, 'folder-1', MEDIA_INSTALLATION_PROJECT, MOCK_USERS);
    expect(calls).toHaveLength(1);
    expect(calls[0].parentId).toBe('folder-1');
    expect(calls[0].mimeType).toBe(XLSX_MIME_TYPE);
    expect(calls[0].convertTo).toBe('google-sheet');
    expect(calls[0].name.endsWith(' - planning.xlsx')).toBe(true);
    expect([calls[0].bytes[0], calls[0].bytes[1]]).toEqual([0x50, 0x4b]);
    expect(result).toEqual({ fileId: 'file-1', webUrl: 'https://example.test/1', name: calls[0].name });
  });
});

describe('exportToOneDriveExcel', () => {
  it('uploads the xlsx as-is without conversion', async () => {
    const { provider, calls } = fakeProvider();
    const result = await exportToOneDriveExcel(provider, 'folder-2', MEDIA_INSTALLATION_PROJECT);
    expect(calls).toHaveLength(1);
    expect(calls[0].parentId).toBe('folder-2');
    expect(calls[0].mimeType).toBe(XLSX_MIME_TYPE);
    expect('convertTo' in calls[0]).toBe(false);
    expect(result.fileId).toBe('file-1');
  });
});
