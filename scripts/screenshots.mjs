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

/** Clicks a view tab by its visible label. */
const openTab = async (page, label) => {
  await page.getByRole('button', { name: new RegExp(label, 'i') }).first().click();
  await page.waitForTimeout(400);
};

/**
 * The states a tab shot cannot reach: the dialogs, the other two timeline modes, the table
 * board. Each is opened from a freshly reloaded page so one shot cannot leak state into the
 * next. The tutorial goes last because starting it writes a sandbox project.
 */
const OVERLAYS = [
  [
    'retroplanning-days',
    async (page) => {
      await openTab(page, 'Rétroplanning');
      await page.getByRole('button', { name: /^Days$/ }).first().click();
      await page.mouse.wheel(0, 260);
    },
  ],
  [
    'retroplanning-months',
    async (page) => {
      await openTab(page, 'Rétroplanning');
      await page.getByRole('button', { name: /^Months$/ }).first().click();
      await page.mouse.wheel(0, 260);
    },
  ],
  [
    'retroplanning-runway',
    async (page) => {
      await openTab(page, 'Rétroplanning');
      await page.click('#mode-runway-btn');
    },
  ],
  [
    'retroplanning-workload',
    async (page) => {
      await openTab(page, 'Rétroplanning');
      await page.click('#mode-workload-btn');
    },
  ],
  [
    'tasks-table',
    async (page) => {
      await openTab(page, 'Tasks & Deliverables');
      await page.getByRole('button', { name: /^Table$/ }).first().click();
    },
  ],
  [
    'hardware-media',
    async (page) => {
      await openTab(page, 'Hardware');
      await page.getByRole('button', { name: /^Media \(/ }).first().click();
    },
  ],
  [
    'settings',
    async (page) => {
      await page.click('#app-menu-btn');
      await page.getByRole('menuitem', { name: /^Settings/ }).click();
    },
  ],
  ['cloud', async (page) => page.click('#header-drive-folder-btn')],
  ['ai-assistant', async (page) => page.click('#ai-assistant-btn')],
  ['task-editor', async (page) => page.click('[data-tour="new-task"]')],
  [
    'task-inspector',
    async (page) => {
      await openTab(page, 'Rétroplanning');
      await page.locator('[data-tour="gantt"] button[aria-label^="Venue Booking"]').first().click();
    },
  ],
  [
    'tutorial',
    async (page) => {
      await page.click('#app-menu-btn');
      await page.getByRole('menuitem', { name: /Tutorial/ }).click();
    },
  ],
];

/** Dismisses the first-run tutorial invitation, which otherwise covers the bottom-left corner. */
async function dismissInvite(page) {
  const notNow = page.getByRole('button', { name: /^Not now$/ });
  if (await notNow.count()) await notNow.first().click().catch(() => {});
  await page.waitForTimeout(150);
}

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
  await dismissInvite(page);

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
    // The page itself must never scroll sideways; only the Gantt scrolls inside its own box.
    const overflow = await page.evaluate(
      () => document.documentElement.scrollWidth - document.documentElement.clientWidth
    );
    if (overflow > 0) problems.push(`[${theme}] ${name}: the page scrolls horizontally by ${overflow}px`);
  }

  for (const [name, open] of OVERLAYS) {
    await page.reload({ waitUntil: 'networkidle' });
    await page.waitForTimeout(500);
    await dismissInvite(page);
    try {
      await open(page);
    } catch (err) {
      problems.push(`[${theme}] could not open ${name}: ${String(err).slice(0, 160)}`);
      continue;
    }
    await page.waitForTimeout(500);
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
