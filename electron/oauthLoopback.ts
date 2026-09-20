/**
 * OAuth loopback redirect receiver (RFC 8252 §7.3).
 *
 * Two-step because the renderer builds the authorize URL from the redirect_uri:
 *   1. `startSession()`  → http server on 127.0.0.1:<random>, returns { sessionId, redirectUri }
 *   2. `openAndWait(sessionId, url)` → opens the system browser, resolves when /callback is hit.
 *
 * Providers that return the response in a URL fragment (implicit flow) never send the fragment to the
 * server, so a bare `/callback` request is answered with a tiny page that forwards `location.hash` to
 * `/callback?fragment=<hash>`.
 */
import http from 'node:http';
import { randomUUID } from 'node:crypto';
import { shell } from 'electron';
import type { OAuthLoopbackResult } from '../src/types/desktop';

export const OAUTH_TIMEOUT_MS = 5 * 60 * 1000;

interface Session {
  id: string;
  server: http.Server;
  redirectUri: string;
  promise: Promise<OAuthLoopbackResult>;
  resolve: (r: OAuthLoopbackResult) => void;
  reject: (e: Error) => void;
  timer: NodeJS.Timeout;
  done: boolean;
}

const sessions = new Map<string, Session>();

const escapeHtml = (s: string) => s.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c] as string);

function page(title: string, body: string, script = ''): string {
  return `<!doctype html><html><head><meta charset="utf-8"><title>${escapeHtml(title)}</title>
<style>body{font-family:-apple-system,Segoe UI,Helvetica,Arial,sans-serif;background:#0f1424;color:#e6e9f5;display:flex;align-items:center;justify-content:center;height:100vh;margin:0}
main{text-align:center;max-width:32rem;padding:2rem}h1{font-size:1.4rem;margin:0 0 .5rem}p{opacity:.8}</style></head>
<body><main><h1>${escapeHtml(title)}</h1><p>${body}</p></main>${script ? `<script>${script}</script>` : ''}</body></html>`;
}

const DONE_PAGE = page('RetroPlaningStudio', 'Sign-in complete. You can close this tab and return to the app.');
const FORWARD_PAGE = page(
  'RetroPlaningStudio',
  'Finishing sign-in…',
  `var h=location.hash;location.replace('/callback?'+(h&&h.length>1?'fragment='+encodeURIComponent(h.slice(1)):'empty=1'));`
);

function closeSession(s: Session): void {
  if (s.done) return;
  s.done = true;
  clearTimeout(s.timer);
  sessions.delete(s.id);
  try {
    s.server.close();
    s.server.closeAllConnections?.();
  } catch {
    /* ignore */
  }
}

function handleRequest(s: Session, req: http.IncomingMessage, res: http.ServerResponse): void {
  const url = new URL(req.url || '/', s.redirectUri);
  res.setHeader('Connection', 'close');
  res.setHeader('Cache-Control', 'no-store');
  if (url.pathname !== '/callback') {
    res.writeHead(404, { 'Content-Type': 'text/plain' });
    res.end('Not found');
    return;
  }
  if (!url.search) {
    // Fragment (or empty) response: let the page forward whatever is after '#'.
    res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
    res.end(FORWARD_PAGE);
    return;
  }
  res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
  res.end(DONE_PAGE, () => {
    s.resolve({ redirectUrl: url.toString(), redirectUri: s.redirectUri });
    closeSession(s);
  });
}

export function startSession(): Promise<{ sessionId: string; redirectUri: string }> {
  return new Promise((resolveStart, rejectStart) => {
    const id = randomUUID();
    const server = http.createServer();
    let resolve!: Session['resolve'];
    let reject!: Session['reject'];
    const promise = new Promise<OAuthLoopbackResult>((res, rej) => {
      resolve = res;
      reject = rej;
    });
    // Avoid unhandled-rejection noise if the renderer never calls open().
    promise.catch(() => undefined);

    server.once('error', (err) => rejectStart(new Error(`OAuth loopback server failed to start: ${err.message}`)));
    server.listen(0, '127.0.0.1', () => {
      const addr = server.address();
      if (!addr || typeof addr === 'string') {
        server.close();
        rejectStart(new Error('OAuth loopback server has no TCP address'));
        return;
      }
      const redirectUri = `http://127.0.0.1:${addr.port}/callback`;
      const session: Session = {
        id,
        server,
        redirectUri,
        promise,
        resolve,
        reject,
        done: false,
        timer: setTimeout(() => {
          reject(new Error('OAuth sign-in timed out after 5 minutes'));
          closeSession(session);
        }, OAUTH_TIMEOUT_MS),
      };
      server.on('request', (req, res) => handleRequest(session, req, res));
      sessions.set(id, session);
      resolveStart({ sessionId: id, redirectUri });
    });
  });
}

export async function openAndWait(sessionId: string, url: string): Promise<OAuthLoopbackResult> {
  const s = sessions.get(sessionId);
  if (!s) throw new Error('Unknown or expired OAuth session');
  if (!/^https?:\/\//i.test(url)) {
    s.reject(new Error('Authorize URL must be http(s)'));
    closeSession(s);
    return s.promise;
  }
  try {
    await shell.openExternal(url);
  } catch (err) {
    s.reject(new Error(`Could not open the browser: ${(err as Error).message}`));
    closeSession(s);
  }
  return s.promise;
}

export function cancelSession(sessionId: string): void {
  const s = sessions.get(sessionId);
  if (!s) return;
  s.reject(new Error('OAuth sign-in cancelled'));
  closeSession(s);
}
