import assert from 'node:assert/strict';
import { mkdir, writeFile } from 'node:fs/promises';
import { createRequire } from 'node:module';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const require = createRequire(import.meta.url);
const { chromium } = require('playwright');

const baseUrl = process.env.E2E_BASE_URL ?? 'http://127.0.0.1:8162';
const browserExecutable =
  process.env.E2E_BROWSER_EXECUTABLE ??
  'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
const outDir = path.dirname(fileURLToPath(import.meta.url));
const viewports = [
  { name: 'supported-floor-360x640', width: 360, height: 640 },
  { name: 'modern-390x844', width: 390, height: 844 },
];
const routes = [
  { name: 'progress-tab', url: '/progress', direct: false },
  { name: 'capture', url: '/progress/capture', direct: true },
  {
    name: 'review',
    url: '/progress/review?capturedUri=data%3Aimage%2Fpng%3Bbase64%2CaA%3D%3D&takenLocalDate=2026-07-10',
    direct: true,
  },
  { name: 'detail', url: '/progress/e2e-front-2026-04-01', direct: true },
];
const blockedMarkers = [
  'Take my first photo',
  '12 weeks',
  'Take photos. On device only',
  'Save to my phone',
  'Your note',
  'This photo is no longer on this phone',
  'Capture checks recorded',
];

await mkdir(outDir, { recursive: true });
const browser = await chromium.launch({ executablePath: browserExecutable, headless: true });
const results = [];
const logs = [];
const requests = [];
const dialogs = [];
const pageErrors = [];
let exitRecovery = null;

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
        logs.push({ route: route.name, viewport: viewport.name, type: message.type(), text: message.text() });
      });
      page.on('dialog', async (dialog) => {
        dialogs.push({ route: route.name, viewport: viewport.name, type: dialog.type(), message: dialog.message() });
        await dialog.dismiss();
      });
      page.on('pageerror', (error) => {
        pageErrors.push({ route: route.name, viewport: viewport.name, message: error.message });
      });
      page.on('request', (request) => {
        const url = request.url();
        if (!url.startsWith(baseUrl) && !url.startsWith('data:')) {
          requests.push({ route: route.name, viewport: viewport.name, method: request.method(), url });
        }
      });

      await page.goto(`${baseUrl}${route.url}`, { waitUntil: 'domcontentloaded', timeout: 60_000 });
      await page.getByText('Your timeline could not open.', { exact: true }).waitFor({ timeout: 60_000 });

      const beforeRetryText = (await page.locator('body').innerText()).replace(/\r/g, '');
      const retry = page.getByRole('button', { name: 'Try again', exact: true });
      const retryBox = await retry.boundingBox();
      const exit = page.getByRole('button', { name: 'Back to Progress', exact: true });
      const exitCount = await exit.count();
      const exitBox = exitCount === 1 ? await exit.boundingBox() : null;

      assert.ok(retryBox && retryBox.height >= 56, `${prefix}: retry target must be at least 56px`);
      assert.equal(exitCount, route.direct ? 1 : 0, `${prefix}: direct-route exit mismatch`);
      if (route.direct) {
        assert.ok(exitBox && exitBox.height >= 48, `${prefix}: exit target must be at least 48px`);
      } else {
        assert.equal(await page.getByRole('tab', { name: 'Today tab', exact: true }).count(), 1);
      }
      for (const marker of blockedMarkers) {
        assert.ok(!beforeRetryText.includes(marker), `${prefix}: blocked marker visible: ${marker}`);
      }
      assert.ok(!beforeRetryText.includes('E2E_PROGRESS_STORAGE_UNAVAILABLE'), `${prefix}: raw error visible`);

      await retry.click();
      await page.getByText('It is still unavailable. Your timeline remains unchanged.', { exact: true }).waitFor();
      const afterRetryText = (await page.locator('body').innerText()).replace(/\r/g, '');
      const retryAfterBox = await page.getByRole('button', { name: 'Try again', exact: true }).boundingBox();
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

      assert.ok(retryAfterBox && retryAfterBox.height >= 56, `${prefix}: retry disappeared after failure`);
      assert.ok(geometry.scrollWidth <= geometry.clientWidth, `${prefix}: horizontal overflow`);
      for (const marker of blockedMarkers) {
        assert.ok(!afterRetryText.includes(marker), `${prefix}: blocked marker visible after retry: ${marker}`);
      }

      const snapshot = {
        route: route.name,
        requestedUrl: route.url,
        finalUrl: page.url(),
        viewport,
        beforeRetryText,
        afterRetryText,
        geometry,
        retryBox,
        retryAfterBox,
        exitBox,
        visibleButtons,
      };
      await page.screenshot({ path: path.join(outDir, `${prefix}.png`), fullPage: true });
      await writeFile(path.join(outDir, `${prefix}.json`), `${JSON.stringify(snapshot, null, 2)}\n`);
      results.push(snapshot);

      if (route.name === 'detail' && viewport.name === 'modern-390x844') {
        await exit.click();
        await page.getByText('Your timeline could not open.', { exact: true }).waitFor();
        assert.equal(new URL(page.url()).pathname, '/progress');
        assert.equal(await page.getByRole('tab', { name: 'Today tab', exact: true }).count(), 1);
        exitRecovery = {
          finalUrl: page.url(),
          bodyText: (await page.locator('body').innerText()).replace(/\r/g, ''),
        };
        await page.screenshot({
          path: path.join(outDir, 'detail-exit-recovery-modern-390x844.png'),
          fullPage: true,
        });
      }

      await context.close();
    }
  }
} finally {
  await browser.close();
}

const disallowedLogs = logs.filter(
  (entry) =>
    entry.type === 'error' &&
    !entry.text.includes('EXPO_PUBLIC_SUPABASE') &&
    !entry.text.includes('Using placeholder'),
);
const vendorRequests = requests.filter((entry) => /supabase|posthog|sentry/i.test(entry.url));
assert.deepEqual(dialogs, [], 'No JavaScript dialogs expected');
assert.deepEqual(pageErrors, [], 'No page errors expected');
assert.deepEqual(disallowedLogs, [], 'No unexpected browser errors expected');
assert.deepEqual(vendorRequests, [], 'Blocked Progress routes must not call privacy-sensitive vendors');
assert.ok(exitRecovery, 'Direct-route exit recovery was not exercised');

await writeFile(path.join(outDir, 'persistent-results.json'), `${JSON.stringify(results, null, 2)}\n`);
await writeFile(path.join(outDir, 'persistent-exit-recovery.json'), `${JSON.stringify(exitRecovery, null, 2)}\n`);
await writeFile(path.join(outDir, 'persistent-browser-logs.json'), `${JSON.stringify(logs, null, 2)}\n`);
await writeFile(path.join(outDir, 'persistent-browser-disallowed-logs.json'), `${JSON.stringify(disallowedLogs, null, 2)}\n`);
await writeFile(path.join(outDir, 'persistent-network-requests.json'), `${JSON.stringify(requests, null, 2)}\n`);
await writeFile(path.join(outDir, 'persistent-vendor-requests.json'), `${JSON.stringify(vendorRequests, null, 2)}\n`);
await writeFile(path.join(outDir, 'persistent-dialogs.json'), `${JSON.stringify(dialogs, null, 2)}\n`);
await writeFile(path.join(outDir, 'persistent-page-errors.json'), `${JSON.stringify(pageErrors, null, 2)}\n`);

process.stdout.write(`Persistent storage recovery E2E passed ${results.length}/${viewports.length * routes.length}.\n`);
