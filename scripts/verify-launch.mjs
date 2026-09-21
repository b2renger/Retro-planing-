/**
 * Launches the PACKAGED app and asserts it actually renders.
 *
 * This exists because v0.1.0 shipped after `codesign --verify` passed and nothing else was checked.
 * Signing is not running. A build can be perfectly signed and still show a blank window.
 *
 *   node scripts/verify-launch.mjs [path/to/binary]
 *
 * Defaults to the macOS arm64 build under release/. Exits non-zero on any failure, so it belongs in
 * the packaging pipeline, not in someone's memory.
 */
import { _electron as electron } from 'playwright';
import { existsSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import path from 'node:path';

const fallback = 'release/mac-arm64/RetroPlaningStudio.app/Contents/MacOS/RetroPlaningStudio';
const target = path.resolve(process.argv[2] || fallback);

if (!existsSync(target)) {
  console.error(`[verify-launch] binary not found: ${target}`);
  process.exit(1);
}

// The app takes a single-instance lock, so a copy left running from an earlier probe makes the next
// launch quit immediately. That looks identical to a broken build, so check for it and say so.
const running = spawnSync('pgrep', ['-f', target], { encoding: 'utf8' }).stdout.trim();
if (running) {
  console.error(`[verify-launch] an instance is already running (pid ${running.split('\n').join(', ')}).`);
  console.error('[verify-launch] it holds the single-instance lock, so a new launch would exit at once.');
  console.error(`[verify-launch] quit it, or: pkill -f ${JSON.stringify(target)}`);
  process.exit(2);
}

const problems = [];
let app;
try {
  app = await electron.launch({ executablePath: target, args: [] });
} catch (err) {
  console.error(`[verify-launch] the app failed to start: ${err}`);
  process.exit(1);
}

try {
  const win = await app.firstWindow({ timeout: 30000 });
  win.on('console', (m) => {
    if (m.type() === 'error') problems.push(`console error: ${m.text().slice(0, 300)}`);
  });
  win.on('pageerror', (e) => problems.push(`uncaught exception: ${String(e).slice(0, 300)}`));
  win.on('requestfailed', (r) => {
    if (!r.url().startsWith('data:')) problems.push(`failed request: ${r.url().slice(0, 160)}`);
  });

  await win.waitForTimeout(6000);

  const title = await win.title();
  const rootLen = await win.evaluate(() => document.getElementById('root')?.innerHTML.length ?? 0);
  console.log(`[verify-launch] window title: ${title}`);
  console.log(`[verify-launch] rendered DOM in #root: ${rootLen} chars`);

  // A blank window still has a title and a body; only a populated #root proves React mounted.
  if (rootLen < 2000) problems.push(`#root rendered only ${rootLen} chars — the window is effectively blank`);
  if (!title) problems.push('window has no title');

  await win.screenshot({ path: '.tmp/launch-verify.png' }).catch(() => {});
} catch (err) {
  problems.push(`no window appeared within 30s: ${err}`);
} finally {
  await app.close().catch(() => {});
}

if (problems.length) {
  console.error('[verify-launch] FAILED');
  for (const p of [...new Set(problems)]) console.error('  -', p);
  process.exit(1);
}
console.log('[verify-launch] OK — the packaged app starts and renders');
