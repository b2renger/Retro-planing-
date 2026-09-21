/**
 * Loads the built app in headless Chromium and captures every view in both themes.
 *
 * This exists because nothing in this project had ever been looked at: 498 unit tests cover the logic
 * and none of them renders a pixel. The theme system in particular was converted across nineteen
 * components blind. Run it after any visual change.
 *
 *   npm run build:web && node scripts/screenshots.mjs
 *
 * Writes PNGs to .tmp/shots/ and prints any console error or failed request it saw, which is usually
 * how a broken screen announces itself.
 */
import { chromium } from 'playwright';
import { createServer } from 'node:http';
import { readFile, mkdir } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import path from 'node:path';

const DIST = path.resolve('dist');
const OUT = path.resolve('.tmp/shots');
const PORT = 4183;

const MIME = {
  '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css',
  '.json': 'application/json', '.svg': 'image/svg+xml', '.png': 'image/png',
  '.woff2': 'font/woff2', '.ico': 'image/x-icon',
};

if (!existsSync(DIST)) {
  console.error('dist/ is missing — run `npm run build:web` first.');
  process.exit(1);
}

const server = createServer(async (req, res) => {
  const urlPath = decodeURIComponent((req.url || '/').split('?')[0]);
  let file = path.join(DIST, urlPath === '/' ? 'index.html' : urlPath);
  if (!existsSync(file) || (await readFile(file).catch(() => null)) === null) file = path.join(DIST, 'index.html');
  try {
    const body = await readFile(file);
    res.writeHead(200, { 'Content-Type': MIME[path.extname(file)] || 'application/octet-stream' });
    res.end(body);
  } catch {
    res.writeHead(404).end('not found');
  }
});
await new Promise((r) => server.listen(PORT, r));
await mkdir(OUT, { recursive: true });

// Tabs are addressed by their visible label; the app has no router.
const TABS = [
  ['triage', 'Triage & Actions'],
  ['retroplanning', 'Rétroplanning'],
  ['hardware', 'Hardware'],
  ['tasks', 'Tasks & Deliverables'],
  ['markdown', 'Markdown Studio'],
  ['team', 'Team & Workload'],
  ['audit', 'Audit Trail'],
];

const problems = [];
const browser = await chromium.launch();

for (const theme of ['dark', 'light']) {
  const ctx = await browser.newContext({
    viewport: { width: 1440, height: 900 },
    colorScheme: theme,
    deviceScaleFactor: 1,
  });
  const page = await ctx.newPage();
  page.on('console', (m) => {
    if (m.type() === 'error') problems.push(`[${theme}] console: ${m.text().slice(0, 300)}`);
  });
  page.on('pageerror', (e) => problems.push(`[${theme}] pageerror: ${String(e).slice(0, 300)}`));
  page.on('requestfailed', (r) => {
    const u = r.url();
    if (!u.startsWith('data:')) problems.push(`[${theme}] requestfailed: ${u.slice(0, 200)}`);
  });

  await page.goto(`http://localhost:${PORT}/`, { waitUntil: 'networkidle' });
  // Force the theme explicitly rather than relying on the OS preference alone.
  await page.evaluate((t) => {
    try {
      localStorage.setItem('rps_v1_ui', JSON.stringify({ theme: t }));
    } catch {}
  }, theme);
  await page.reload({ waitUntil: 'networkidle' });
  await page.waitForTimeout(600);

  for (const [name, tab] of TABS) {
    const el = page.getByRole('button', { name: new RegExp(tab.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i') }).first();
    if (await el.count()) {
      await el.click().catch(() => problems.push(`[${theme}] could not click tab ${tab}`));
      await page.waitForTimeout(450);
    } else {
      problems.push(`[${theme}] tab not found: ${tab}`);
      continue;
    }
    await page.screenshot({ path: path.join(OUT, `${theme}-${name}.png`), fullPage: false });
  }
  await ctx.close();
}

await browser.close();
server.close();

if (problems.length) {
  console.log('PROBLEMS:');
  for (const p of [...new Set(problems)]) console.log(' -', p);
} else {
  console.log('no console errors or failed requests');
}
console.log(`shots in ${OUT}`);
