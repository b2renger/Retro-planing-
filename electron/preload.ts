/**
 * Preload: exposes the `window.desktop` bridge (src/types/desktop.d.ts) to the renderer.
 * Every method forwards to an `ipcMain.handle` channel registered in electron/main.ts.
 */
import { contextBridge, ipcRenderer } from 'electron';
import type { DesktopBridge, DesktopFetchInit, DesktopFetchResponse, DiscoveredFarm, OAuthLoopbackResult } from '../src/types/desktop';

const versionArg = process.argv.find((a) => a.startsWith('--app-version='));
const version = versionArg ? versionArg.slice('--app-version='.length) : '0.0.0';

const platform: DesktopBridge['platform'] =
  process.platform === 'darwin' || process.platform === 'win32' ? process.platform : 'linux';

const bridge: DesktopBridge = {
  platform,
  version,

  fetch: (url: string, init?: DesktopFetchInit): Promise<DesktopFetchResponse> => ipcRenderer.invoke('desktop:fetch', url, init ?? {}),

  discoverFarms: (durationMs?: number): Promise<DiscoveredFarm[]> => ipcRenderer.invoke('desktop:discoverFarms', durationMs),

  oauthLoopback: async (buildAuthUrl: (redirectUri: string) => string): Promise<OAuthLoopbackResult> => {
    const { sessionId, redirectUri } = (await ipcRenderer.invoke('desktop:oauth:start')) as { sessionId: string; redirectUri: string };
    let url: string;
    try {
      url = buildAuthUrl(redirectUri);
    } catch (err) {
      await ipcRenderer.invoke('desktop:oauth:cancel', sessionId);
      throw err;
    }
    return ipcRenderer.invoke('desktop:oauth:open', sessionId, url);
  },

  openExternal: (url: string): Promise<void> => ipcRenderer.invoke('desktop:openExternal', url),

  secureStore: {
    get: (key: string): Promise<string | null> => ipcRenderer.invoke('desktop:secureStore:get', key),
    set: (key: string, value: string): Promise<void> => ipcRenderer.invoke('desktop:secureStore:set', key, value),
    delete: (key: string): Promise<void> => ipcRenderer.invoke('desktop:secureStore:delete', key),
  },

  saveFile: (opts: { defaultPath: string; dataBase64: string; mimeType?: string }): Promise<{ saved: boolean; path?: string }> =>
    ipcRenderer.invoke('desktop:saveFile', opts),
};

contextBridge.exposeInMainWorld('desktop', bridge);
