import { execFileSync } from 'node:child_process';
import { existsSync } from 'node:fs';
import { createServer } from 'node:http';
import { copyFile, mkdtemp, mkdir, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import process from 'node:process';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const DIST = join(ROOT, 'dist');
const OUTPUT = join(ROOT, 'images', 'store');
const WIDTH = 1280;
const HEIGHT = 800;

function chromeExecutable() {
  const candidates = [process.env.CHROME_PATH, chromium.executablePath()];
  const executable = candidates.find((candidate) => candidate && existsSync(candidate));
  if (!executable) {
    throw new Error(
      'Playwright Chromium was not found. Run `npm run screenshots:setup` or set CHROME_PATH.',
    );
  }
  return executable;
}

const DEMOS = [
  {
    host: 'atlas.test',
    title: 'Atlas Design System',
    eyebrow: 'Component library',
    heading: 'Build with a shared visual language.',
    note: 'Foundations · Components · Patterns',
    colors: ['#17324d', '#4bb3a7', '#f4c95d'],
    group: 'Projects',
  },
  {
    host: 'signal.test',
    title: 'Signal Analytics',
    eyebrow: 'Weekly pulse',
    heading: 'Conversion is up 18% this week.',
    note: '24.8k active visitors',
    colors: ['#25233a', '#ef8354', '#f6f2e9'],
    group: 'Projects',
  },
  {
    host: 'canvas.test',
    title: 'Canvas — Product Roadmap',
    eyebrow: 'Autumn roadmap',
    heading: 'Make complex work feel simple.',
    note: '12 initiatives · 4 shipping',
    colors: ['#f4f1ea', '#1f6f5c', '#d95d39'],
    group: 'Projects',
  },
  {
    host: 'fieldnotes.test',
    title: 'Field Notes',
    eyebrow: 'Reading list',
    heading: 'Notes on calm, focused software.',
    note: 'Issue 42 · 8 min read',
    colors: ['#f0eadf', '#273043', '#d4a373'],
    group: 'Research',
  },
  {
    host: 'reference.test',
    title: 'Frontend Reference',
    eyebrow: 'Documentation',
    heading: 'Patterns for resilient interfaces.',
    note: 'Updated today',
    colors: ['#172a3a', '#75dddd', '#f9f7f3'],
    group: 'Research',
  },
  {
    host: 'calendar.test',
    title: 'Studio Calendar',
    eyebrow: 'Monday, September 21',
    heading: 'Three clear hours to make progress.',
    note: 'Next: Design review at 2:30 PM',
    colors: ['#fff8ed', '#2f4858', '#ee6c4d'],
  },
  {
    host: 'inbox.test',
    title: 'Inbox — All caught up',
    eyebrow: 'Inbox zero',
    heading: 'Nothing needs your attention.',
    note: 'Last checked just now',
    colors: ['#e8f3f1', '#245953', '#e9b44c'],
  },
];

function escapeHtml(value) {
  return value.replace(/[&<>"']/g, (character) => {
    const entities = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' };
    return entities[character];
  });
}

function demoHtml(demo) {
  const [background, accent, paper] = demo.colors;
  return `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1">
    <title>${escapeHtml(demo.title)}</title>
    <link rel="icon" href="/favicon.svg">
    <style>
      * { box-sizing: border-box; }
      body { margin: 0; min-height: 100vh; background: ${background}; color: ${paper}; font-family: Georgia, 'Times New Roman', serif; }
      main { min-height: 100vh; display: grid; grid-template-columns: 1.15fr .85fr; }
      section { padding: 72px 140px; display: flex; flex-direction: column; justify-content: space-between; }
      .eyebrow { font: 700 13px/1.2 ui-monospace, monospace; text-transform: uppercase; letter-spacing: .14em; color: ${accent}; }
      h1 { max-width: 560px; margin: 40px 0; font-size: clamp(48px, 6vw, 76px); line-height: .98; letter-spacing: -.04em; }
      footer { font: 500 15px/1.4 ui-sans-serif, sans-serif; opacity: .72; }
      aside { position: relative; overflow: hidden; background: ${accent}; }
      aside::before, aside::after { content: ''; position: absolute; border: 2px solid ${paper}; opacity: .72; }
      aside::before { width: 56%; aspect-ratio: 1; border-radius: 50%; inset: 15% auto auto 17%; }
      aside::after { width: 72%; height: 24%; inset: auto 9% 18% auto; transform: rotate(-8deg); }
    </style>
  </head>
  <body><main><section><span class="eyebrow">${escapeHtml(demo.eyebrow)}</span><h1>${escapeHtml(demo.heading)}</h1><footer>${escapeHtml(demo.note)}</footer></section><aside></aside></main></body>
</html>`;
}

function faviconSvg(demo) {
  const [, accent, paper] = demo.colors;
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64"><rect width="64" height="64" rx="14" fill="${accent}"/><path d="M18 19h28v7H18zm0 12h20v7H18zm0 12h24v7H18z" fill="${paper}"/></svg>`;
}

function promoHtml(size) {
  const marquee = size === 'marquee';
  return `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8">
    <style>
      * { box-sizing: border-box; }
      html, body { margin: 0; width: 100%; height: 100%; overflow: hidden; }
      body {
        display: flex;
        align-items: center;
        justify-content: ${marquee ? 'space-between' : 'center'};
        gap: 52px;
        padding: ${marquee ? '64px 110px' : '34px'};
        color: #f7f7f4;
        background-color: #17212a;
        background-image:
          linear-gradient(rgba(255, 255, 255, .055) 1px, transparent 1px),
          linear-gradient(90deg, rgba(255, 255, 255, .055) 1px, transparent 1px);
        background-size: 28px 28px;
        font-family: ui-rounded, 'SF Pro Rounded', 'Segoe UI', sans-serif;
      }
      .brand { display: flex; align-items: center; gap: ${marquee ? '34px' : '22px'}; }
      .mark { display: grid; grid-template-columns: repeat(2, 1fr); gap: ${marquee ? '12px' : '8px'}; flex: none; }
      .mark i { display: block; width: ${marquee ? '58px' : '40px'}; aspect-ratio: 1; border-radius: ${marquee ? '13px' : '9px'}; background: #ff66b7; }
      h1 { margin: 0; font-size: ${marquee ? '72px' : '42px'}; line-height: 1; letter-spacing: 0; }
      p { margin: ${marquee ? '18px' : '12px'} 0 0; color: #ffbf69; font-size: ${marquee ? '25px' : '17px'}; line-height: 1.25; letter-spacing: 0; }
      .tiles { display: ${marquee ? 'grid' : 'none'}; grid-template-columns: repeat(2, 210px); gap: 16px; transform: rotate(-2deg); }
      .tile { height: 150px; overflow: hidden; border: 1px solid rgba(255,255,255,.18); border-radius: 8px; background: #f7f3ea; box-shadow: 0 16px 36px rgba(0,0,0,.28); }
      .tile::before { content: ''; display: block; height: 106px; background: var(--color); }
      .tile::after { content: ''; display: block; width: 65%; height: 8px; margin: 17px; border-radius: 4px; background: #39444d; opacity: .72; }
    </style>
  </head>
  <body>
    <div class="brand">
      <span class="mark" aria-hidden="true"><i></i><i></i><i></i><i></i></span>
      <div><h1>Tabulous</h1><p>Every tab. One clear view.</p></div>
    </div>
    <div class="tiles" aria-hidden="true">
      <span class="tile" style="--color:#4bb3a7"></span>
      <span class="tile" style="--color:#ef8354"></span>
      <span class="tile" style="--color:#f4c95d"></span>
      <span class="tile" style="--color:#2f6f62"></span>
    </div>
  </body>
</html>`;
}

async function startDemoServer() {
  const server = createServer((request, response) => {
    const host = (request.headers.host ?? '').split(':')[0];
    const demo = DEMOS.find((candidate) => candidate.host === host) ?? DEMOS[0];
    if (request.url === '/favicon.svg') {
      response.writeHead(200, { 'Content-Type': 'image/svg+xml', 'Cache-Control': 'no-store' });
      response.end(faviconSvg(demo));
      return;
    }
    response.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8', 'Cache-Control': 'no-store' });
    response.end(demoHtml(demo));
  });
  await new Promise((resolvePromise, reject) => {
    server.once('error', reject);
    server.listen(0, '127.0.0.1', resolvePromise);
  });
  return server;
}

function serverPort(server) {
  const address = server.address();
  if (!address || typeof address === 'string') throw new Error('Demo server did not expose a port');
  return address.port;
}

async function waitForExtensionWorker(context) {
  const existing = context.serviceWorkers().find((worker) => worker.url().startsWith('chrome-extension://'));
  if (existing) return existing;
  return context.waitForEvent('serviceworker', {
    predicate: (worker) => worker.url().startsWith('chrome-extension://'),
    timeout: 15_000,
  });
}

async function seedPreviews(dashboard, previews) {
  await dashboard.evaluate(async (records) => {
    const database = await new Promise((resolvePromise, reject) => {
      const request = indexedDB.open('tiles-view', 1);
      request.onupgradeneeded = () => {
        const db = request.result;
        if (!db.objectStoreNames.contains('thumbnails')) {
          const store = db.createObjectStore('thumbnails', { keyPath: 'tabId' });
          store.createIndex('capturedAt', 'capturedAt');
        }
      };
      request.onsuccess = () => resolvePromise(request.result);
      request.onerror = () => reject(request.error);
    });

    const thumbnails = records.map((record) => {
      const binary = atob(record.base64);
      const bytes = Uint8Array.from(binary, (character) => character.charCodeAt(0));
      return { ...record, blob: new Blob([bytes], { type: 'image/jpeg' }) };
    });
    const transaction = database.transaction('thumbnails', 'readwrite');
    const store = transaction.objectStore('thumbnails');
    for (const record of thumbnails) {
      store.put({
        tabId: record.tabId,
        url: record.url,
        blob: record.blob,
        capturedAt: Date.now(),
      });
    }
    await new Promise((resolvePromise, reject) => {
      transaction.oncomplete = resolvePromise;
      transaction.onerror = () => reject(transaction.error);
    });
  }, previews);
}

async function capture(page, name, width = WIDTH, height = HEIGHT) {
  await page.setViewportSize({ width, height });
  const path = join(OUTPUT, name);
  const image = await page.screenshot({ path, type: 'png', animations: 'disabled' });
  if (image.readUInt32BE(16) !== width || image.readUInt32BE(20) !== height) {
    throw new Error(`${name} was not captured at ${width}x${height}`);
  }
  process.stdout.write(`Created images/store/${name} (${width}x${height})\n`);
}

async function main() {
  execFileSync('npm', ['run', 'build'], { cwd: ROOT, stdio: 'inherit' });
  await mkdir(OUTPUT, { recursive: true });
  await copyFile(join(ROOT, 'src', 'assets', 'icon-128.png'), join(OUTPUT, 'store-icon.png'));
  const server = await startDemoServer();
  const profile = await mkdtemp(join(tmpdir(), 'tabulous-screenshots-'));
  let context;

  try {
    const port = serverPort(server);
    context = await chromium.launchPersistentContext(profile, {
      executablePath: chromeExecutable(),
      headless: true,
      viewport: { width: WIDTH, height: HEIGHT },
      args: [
        `--disable-extensions-except=${DIST}`,
        `--load-extension=${DIST}`,
        `--host-resolver-rules=MAP *.test 127.0.0.1`,
      ],
    });

    const worker = await waitForExtensionWorker(context);
    const extensionId = new URL(worker.url()).hostname;
    const initialPages = context.pages();
    const previews = [];

    for (const demo of DEMOS) {
      const url = `http://${demo.host}:${port}/`;
      const page = await context.newPage();
      await page.goto(url, { waitUntil: 'networkidle' });
      const [{ id: tabId }] = await worker.evaluate(
        (pageUrl) => chrome.tabs.query({ url: pageUrl }),
        url,
      );
      if (tabId === undefined) throw new Error(`Could not find Chrome tab for ${url}`);
      previews.push({
        tabId,
        url,
        base64: (await page.screenshot({ type: 'jpeg', quality: 82 })).toString('base64'),
      });
    }

    for (const page of initialPages) await page.close();

    await worker.evaluate(async (demos) => {
      const tabs = await chrome.tabs.query({});
      for (const groupName of ['Projects', 'Research']) {
        const tabIds = demos
          .filter((demo) => demo.group === groupName)
          .map((demo) => tabs.find((tab) => tab.url?.startsWith(`http://${demo.host}:`))?.id)
          .filter((tabId) => tabId !== undefined);
        if (tabIds.length === 0) continue;
        const groupId = await chrome.tabs.group({ tabIds });
        await chrome.tabGroups.update(groupId, {
          title: groupName,
          color: groupName === 'Projects' ? 'cyan' : 'yellow',
        });
      }
    }, DEMOS.map(({ host, group }) => ({ host, group })));

    const dashboardUrl = `chrome-extension://${extensionId}/src/dashboard/index.html`;
    const dashboardPage = context.waitForEvent('page');
    const dashboardTab = await worker.evaluate(
      (url) => chrome.tabs.create({ url, active: true, pinned: true }),
      dashboardUrl,
    );
    const dashboard = await dashboardPage;
    await dashboard.waitForURL(dashboardUrl);
    if (!dashboardTab.pinned || dashboardTab.index !== 0) {
      throw new Error('Tabulous dashboard was not created as the first pinned tab');
    }
    await worker.evaluate(async () => {
      const tabs = await chrome.tabs.query({});
      const strayTabIds = tabs
        .filter(
          (tab) =>
            !tab.url ||
            tab.url === 'about:blank' ||
            tab.url.startsWith('chrome://newtab') ||
            tab.url.startsWith('chrome://new-tab-page'),
        )
        .map((tab) => tab.id)
        .filter((tabId) => tabId !== undefined);
      if (strayTabIds.length > 0) await chrome.tabs.remove(strayTabIds);
    });
    await dashboard.locator('.tile').first().waitFor();
    await seedPreviews(dashboard, previews);
    await dashboard.reload({ waitUntil: 'domcontentloaded' });
    await dashboard.locator('.tile').first().waitFor();
    await dashboard.locator('#permission-dismiss').click();
    await dashboard.waitForTimeout(500);
    const firstTileTitle = await dashboard.locator('.tile .tile__title').first().textContent();
    if (firstTileTitle !== 'Tabulous') {
      throw new Error(`Expected Tabulous to render first, found ${firstTileTitle ?? 'no tile'}`);
    }

    await capture(dashboard, '01-overview.png');

    await dashboard.locator('#theme').selectOption('dark');
    await dashboard.waitForTimeout(250);
    await capture(dashboard, '02-dark-groups.png');

    await dashboard.locator('#theme').selectOption('light');
    const detailButton = dashboard.locator('.tile:not([data-tab-id=""]) .tile__disclosure').nth(1);
    await detailButton.click();
    await dashboard.locator('.tile__details:popover-open').evaluate((details) => {
      const values = {
        'Open for': '42 minutes',
        Opened: 'November 5, 1955 at 10:00 AM',
        'Last used': 'November 5, 1955  at 10:42 AM',
        Address: 'http://atlas.test/',
        Window: '#1',
      };
      for (const term of details.querySelectorAll('dt')) {
        const value = values[term.textContent];
        if (value === undefined) continue;
        const description = term.nextElementSibling;
        if (description) description.textContent = value;
      }
    });
    await dashboard.waitForTimeout(250);
    await capture(dashboard, '03-tab-details.png');

    const promo = await context.newPage();
    await promo.setContent(promoHtml('small'));
    await capture(promo, 'promo-small.png', 440, 280);
    await promo.setContent(promoHtml('marquee'));
    await capture(promo, 'promo-marquee.png', 1400, 560);
  } finally {
    await context?.close();
    await new Promise((resolvePromise) => server.close(resolvePromise));
    await rm(profile, { recursive: true, force: true });
  }
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
