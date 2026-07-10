import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const require = createRequire(import.meta.url);
const { chromium } = require('playwright');

const baseUrl = process.env.E2E_BASE_URL ?? 'http://127.0.0.1:8155';
const browserExecutable =
  process.env.E2E_BROWSER_EXECUTABLE ?? 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
const outDir = path.dirname(fileURLToPath(import.meta.url));
const viewports = [
  { name: 'supported-floor-360x640', width: 360, height: 640 },
  { name: 'modern-390x844', width: 390, height: 844 },
];
const routes = [
  { name: 'progress-tab', url: '/progress' },
  { name: 'capture', url: '/progress/capture' },
  {
    name: 'review',
    url: '/progress/review?capturedUri=data%3Aimage%2Fpng%3Bbase64%2CaA%3D%3D&takenLocalDate=2026-07-10',
  },
  { name: 'detail', url: '/progress/e2e-front-2026-04-01' },
];
const sensitiveMarkers = [
  '12 weeks · 3 photos',
  'Front · weekly',
  'Save to my phone',
  'Capture checks recorded',
  'Your note',
  'Review ·',
];

await mkdir(outDir, { recursive: true });
const browser = await chromium.launch({ executablePath: browserExecutable, headless: true });
const results = [];
const allLogs = [];
const allRequests = [];
const allDialogs = [];
const allPageErrors = [];

try {
  for (const viewport of viewports) {
    for (const route of routes) {
      const context = await browser.newContext({
        viewport: { width: viewport.width, height: viewport.height },
        deviceScaleFactor: 1,
      });
      const page = await context.newPage();
      const prefix = `${route.name}-${viewport.name}`;

      page.on('console', (message) => {
        allLogs.push({ route: route.name, viewport: viewport.name, type: message.type(), text: message.text() });
      });
      page.on('dialog', async (dialog) => {
        allDialogs.push({ route: route.name, viewport: viewport.name, type: dialog.type(), message: dialog.message() });
        await dialog.dismiss();
      });
      page.on('pageerror', (error) => {
        allPageErrors.push({ route: route.name, viewport: viewport.name, message: error.message });
      });
      page.on('request', (request) => {
        const url = request.url();
        if (!url.startsWith(baseUrl) && !url.startsWith('data:')) {
          allRequests.push({ route: route.name, viewport: viewport.name, method: request.method(), url });
        }
      });

      await page.goto(`${baseUrl}${route.url}`, { waitUntil: 'domcontentloaded', timeout: 60_000 });
      await page.getByText('Your timeline is locked.', { exact: true }).waitFor({ timeout: 60_000 });
      await page.waitForTimeout(250);

      const bodyText = (await page.locator('body').innerText()).replace(/\r/g, '');
      const unlock = page.getByRole('button', { name: 'Unlock', exact: true });
      const unlockCount = await unlock.count();
      const unlockBox = unlockCount === 1 ? await unlock.boundingBox() : null;
      const geometry = await page.evaluate(() => ({
        clientWidth: document.documentElement.clientWidth,
        scrollWidth: document.documentElement.scrollWidth,
        innerWidth: window.innerWidth,
      }));
      const visibleButtons = await page.getByRole('button').evaluateAll((elements) =>
        elements.map((element) => {
          const rect = element.getBoundingClientRect();
          return {
            name: element.getAttribute('aria-label') ?? element.textContent?.trim() ?? '',
            width: rect.width,
            height: rect.height,
          };
        }),
      );
      const snapshot = {
        route: route.name,
        requestedUrl: route.url,
        finalUrl: page.url(),
        viewport,
        bodyText,
        geometry,
        unlockBox,
        unlockCount,
        visibleButtons,
      };

      assert.equal(unlockCount, 1, `${prefix}: expected one timeline Unlock button`);
      assert.ok(unlockBox && unlockBox.height >= 44, `${prefix}: Unlock must meet 44px target`);
      assert.ok(bodyText.includes('Device-only photo storage'), `${prefix}: storage boundary missing`);
      assert.ok(bodyText.includes('Cloud backup is not available'), `${prefix}: backup boundary missing`);
      assert.ok(geometry.scrollWidth <= geometry.clientWidth, `${prefix}: horizontal overflow`);
      for (const marker of sensitiveMarkers) {
        assert.ok(!bodyText.includes(marker), `${prefix}: sensitive marker visible before unlock: ${marker}`);
      }

      await page.screenshot({ path: path.join(outDir, `${prefix}.png`), fullPage: true });
      await writeFile(path.join(outDir, `${prefix}.json`), `${JSON.stringify(snapshot, null, 2)}\n`);
      results.push(snapshot);
      await context.close();
    }
  }
} finally {
  await browser.close();
}

const disallowedLogs = allLogs.filter(
  (entry) =>
    entry.type === 'error' &&
    !entry.text.includes('EXPO_PUBLIC_SUPABASE') &&
    !entry.text.includes('Using placeholder'),
);
assert.deepEqual(allDialogs, [], 'No JavaScript dialogs expected');
assert.deepEqual(allPageErrors, [], 'No page errors expected');
assert.deepEqual(disallowedLogs, [], 'No unexpected browser errors expected');
assert.equal(
  allRequests.some((entry) => /supabase|posthog|sentry/i.test(entry.url)),
  false,
  'Locked routes must not call privacy-sensitive vendors',
);

await writeFile(path.join(outDir, 'locked-summary.json'), `${JSON.stringify(results, null, 2)}\n`);
await writeFile(path.join(outDir, 'browser-logs.json'), `${JSON.stringify(allLogs, null, 2)}\n`);
await writeFile(path.join(outDir, 'browser-disallowed-logs.json'), `${JSON.stringify(disallowedLogs, null, 2)}\n`);
await writeFile(path.join(outDir, 'network-requests.json'), `${JSON.stringify(allRequests, null, 2)}\n`);
await writeFile(path.join(outDir, 'dialogs.json'), `${JSON.stringify(allDialogs, null, 2)}\n`);
await writeFile(path.join(outDir, 'page-errors.json'), `${JSON.stringify(allPageErrors, null, 2)}\n`);

process.stdout.write(`Locked direct-route E2E passed ${results.length}/${viewports.length * routes.length}.\n`);
