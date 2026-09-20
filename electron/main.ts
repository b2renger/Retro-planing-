/**
 * Electron main process for RetroPlaningStudio.
 *
 * Owns the BrowserWindow and implements the `window.desktop` bridge (see src/types/desktop.d.ts) over IPC.
 * Bundled by scripts/build-electron.mjs into dist-electron/main.cjs.
 */
import { app, BrowserWindow, dialog, ipcMain, Menu, net, shell } from 'electron';
import fs from 'node:fs';
import path from 'node:path';
import { discoverFarms } from './farmDiscovery';
import { cancelSession, openAndWait, startSession } from './oauthLoopback';
import { secureDelete, secureGet, secureSet } from './secureStore';
import type { DesktopFetchInit, DesktopFetchResponse } from '../src/types/desktop';

const APP_ID = 'com.b2renger.retroplaningstudio';
const DEV_URL = 'http://localhost:3000';

const devRendererUrl: string | null =
  process.env.ELECTRON_RENDERER_URL || (!app.isPackaged && process.argv.includes('--dev') ? DEV_URL : null);

let mainWindow: BrowserWindow | null = null;

// ---------------------------------------------------------------------------------------------
// Window
// ---------------------------------------------------------------------------------------------

function isHttpUrl(url: string): boolean {
  return /^https?:\/\//i.test(url);
}

function createWindow(): BrowserWindow {
  const iconPath = path.join(__dirname, '../build/icon.png');
  const win = new BrowserWindow({
    width: 1440,
    height: 900,
    minWidth: 1024,
    minHeight: 680,
    title: 'RetroPlaningStudio',
    show: false,
    ...(process.platform !== 'darwin' && fs.existsSync(iconPath) ? { icon: iconPath } : {}),
    webPreferences: {
      preload: path.join(__dirname, 'preload.cjs'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false,
      additionalArguments: [`--app-version=${app.getVersion()}`],
    },
  });

  win.once('ready-to-show', () => win.show());

  // Links that would open a new window go to the system browser instead.
  win.webContents.setWindowOpenHandler(({ url }) => {
    if (isHttpUrl(url)) void shell.openExternal(url);
    return { action: 'deny' };
  });
  // In-page navigation away from our own origin (file:// or the dev server) goes to the browser too.
  win.webContents.on('will-navigate', (event, url) => {
    const own = devRendererUrl ? url.startsWith(devRendererUrl) : url.startsWith('file:');
    if (!own) {
      event.preventDefault();
      if (isHttpUrl(url)) void shell.openExternal(url);
    }
  });

  if (devRendererUrl) {
    void win.loadURL(devRendererUrl);
  } else {
    void win.loadFile(path.join(__dirname, '../dist/index.html'));
  }

  win.on('closed', () => {
    if (mainWindow === win) mainWindow = null;
  });
  mainWindow = win;
  return win;
}

function buildMenu(): void {
  const isMac = process.platform === 'darwin';
  const template: Electron.MenuItemConstructorOptions[] = [
    ...(isMac
      ? [
          {
            label: app.name,
            submenu: [
              { role: 'about' as const },
              { type: 'separator' as const },
              { role: 'hide' as const },
              { role: 'hideOthers' as const },
              { role: 'unhide' as const },
              { type: 'separator' as const },
              { role: 'quit' as const },
            ],
          },
        ]
      : []),
    {
      label: 'File',
      submenu: [isMac ? { role: 'close' as const } : { role: 'quit' as const }],
    },
    {
      label: 'Edit',
      submenu: [
        { role: 'undo' },
        { role: 'redo' },
        { type: 'separator' },
        { role: 'cut' },
        { role: 'copy' },
        { role: 'paste' },
        { role: 'selectAll' },
      ],
    },
    {
      label: 'View',
      submenu: [
        { role: 'reload' },
        { role: 'forceReload' },
        { role: 'toggleDevTools' },
        { type: 'separator' },
        { role: 'resetZoom' },
        { role: 'zoomIn' },
        { role: 'zoomOut' },
        { type: 'separator' },
        { role: 'togglefullscreen' },
      ],
    },
    {
      label: 'Window',
      submenu: [{ role: 'minimize' }, { role: 'zoom' }, ...(isMac ? [{ type: 'separator' as const }, { role: 'front' as const }] : [{ role: 'close' as const }])],
    },
  ];
  Menu.setApplicationMenu(Menu.buildFromTemplate(template));
}

// ---------------------------------------------------------------------------------------------
// IPC: the DesktopBridge implementation
// ---------------------------------------------------------------------------------------------

function describeNetworkError(err: unknown, url: string): string {
  const e = err as { name?: string; message?: string; cause?: { code?: string; message?: string } };
  if (e?.name === 'AbortError') return `Request to ${url} timed out`;
  const cause = e?.cause?.code || e?.cause?.message;
  return `Network error for ${url}: ${e?.message || String(err)}${cause ? ` (${cause})` : ''}`;
}

async function desktopFetch(url: string, init: DesktopFetchInit = {}): Promise<DesktopFetchResponse> {
  if (typeof url !== 'string' || !isHttpUrl(url)) throw new Error(`desktop.fetch only accepts http(s) URLs, got: ${String(url).slice(0, 80)}`);
  const controller = new AbortController();
  const timer = init.timeoutMs && init.timeoutMs > 0 ? setTimeout(() => controller.abort(), init.timeoutMs) : undefined;
  try {
    let body: string | Uint8Array<ArrayBuffer> | undefined;
    if (typeof init.bodyBase64 === 'string') body = Buffer.from(init.bodyBase64, 'base64');
    else if (typeof init.body === 'string') body = init.body;

    const res = await net.fetch(url, {
      method: init.method || 'GET',
      headers: init.headers || {},
      body,
      signal: controller.signal,
      redirect: 'follow',
    });
    const text = await res.text();
    const headers: Record<string, string> = {};
    res.headers.forEach((v, k) => {
      headers[k.toLowerCase()] = v;
    });
    return { ok: res.ok, status: res.status, statusText: res.statusText, headers, body: text };
  } catch (err) {
    throw new Error(describeNetworkError(err, url));
  } finally {
    if (timer) clearTimeout(timer);
  }
}

function extensionFilter(defaultPath: string, mimeType?: string): Electron.FileFilter[] {
  const ext = path.extname(defaultPath).replace(/^\./, '').toLowerCase();
  const filters: Electron.FileFilter[] = [];
  if (ext) filters.push({ name: mimeType ? `${mimeType} (*.${ext})` : `*.${ext}`, extensions: [ext] });
  filters.push({ name: 'All Files', extensions: ['*'] });
  return filters;
}

function registerIpc(): void {
  ipcMain.handle('desktop:fetch', (_event, url: string, init?: DesktopFetchInit) => desktopFetch(url, init));

  ipcMain.handle('desktop:discoverFarms', (_event, durationMs?: number) => discoverFarms(durationMs));

  ipcMain.handle('desktop:oauth:start', () => startSession());
  ipcMain.handle('desktop:oauth:open', (_event, sessionId: string, url: string) => openAndWait(sessionId, url));
  ipcMain.handle('desktop:oauth:cancel', (_event, sessionId: string) => cancelSession(sessionId));

  ipcMain.handle('desktop:openExternal', async (_event, url: string) => {
    if (typeof url !== 'string' || !isHttpUrl(url)) throw new Error('openExternal only accepts http(s) URLs');
    await shell.openExternal(url);
  });

  ipcMain.handle('desktop:secureStore:get', (_event, key: string) => secureGet(String(key)));
  ipcMain.handle('desktop:secureStore:set', (_event, key: string, value: string) => secureSet(String(key), String(value)));
  ipcMain.handle('desktop:secureStore:delete', (_event, key: string) => secureDelete(String(key)));

  ipcMain.handle(
    'desktop:saveFile',
    async (event, opts: { defaultPath: string; dataBase64: string; mimeType?: string }): Promise<{ saved: boolean; path?: string }> => {
      const owner = BrowserWindow.fromWebContents(event.sender) ?? mainWindow ?? undefined;
      const defaultPath = typeof opts?.defaultPath === 'string' && opts.defaultPath ? opts.defaultPath : 'export';
      const options: Electron.SaveDialogOptions = {
        defaultPath: path.isAbsolute(defaultPath) ? defaultPath : path.join(app.getPath('downloads'), defaultPath),
        filters: extensionFilter(defaultPath, opts?.mimeType),
      };
      const result = owner ? await dialog.showSaveDialog(owner, options) : await dialog.showSaveDialog(options);
      if (result.canceled || !result.filePath) return { saved: false };
      await fs.promises.writeFile(result.filePath, Buffer.from(String(opts?.dataBase64 ?? ''), 'base64'));
      return { saved: true, path: result.filePath };
    }
  );
}

// ---------------------------------------------------------------------------------------------
// App lifecycle
// ---------------------------------------------------------------------------------------------

if (process.platform === 'win32') app.setAppUserModelId(APP_ID);

if (!app.requestSingleInstanceLock()) {
  app.quit();
} else {
  app.on('second-instance', () => {
    if (mainWindow) {
      if (mainWindow.isMinimized()) mainWindow.restore();
      mainWindow.focus();
    } else {
      createWindow();
    }
  });

  app.whenReady().then(() => {
    registerIpc();
    buildMenu();
    createWindow();

    app.on('activate', () => {
      if (BrowserWindow.getAllWindows().length === 0) createWindow();
    });
  });

  app.on('window-all-closed', () => {
    if (process.platform !== 'darwin') app.quit();
  });
}
