import assert from 'node:assert/strict';
import { mkdir, writeFile } from 'node:fs/promises';
import { createRequire } from 'node:module';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const require = createRequire(import.meta.url);
const { chromium } = require('playwright');

const baseUrl = process.env.E2E_BASE_URL ?? 'http://127.0.0.1:8156';
const browserExecutable =
  process.env.E2E_BROWSER_EXECUTABLE ?? 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
const outDir = path.dirname(fileURLToPath(import.meta.url));

await mkdir(outDir, { recursive: true });
const browser = await chromium.launch({ executablePath: browserExecutable, headless: true });
const context = await browser.newContext({ viewport: { width: 390, height: 844 } });
const page = await context.newPage();
const logs = [];
const requests = [];
const dialogs = [];
const pageErrors = [];

page.on('console', (message) => logs.push({ type: message.type(), text: message.text() }));
page.on('dialog', async (dialog) => {
  dialogs.push({ type: dialog.type(), message: dialog.message() });
  await dialog.dismiss();
});
page.on('pageerror', (error) => pageErrors.push({ message: error.message }));
page.on('request', (request) => {
  const url = request.url();
  if (!url.startsWith(baseUrl) && !url.startsWith('data:')) {
    requests.push({ method: request.method(), url });
  }
});

async function snapshot(name) {
  const bodyText = (await page.locator('body').innerText()).replace(/\r/g, '');
  const geometry = await page.evaluate(() => ({
    clientWidth: document.documentElement.clientWidth,
    scrollWidth: document.documentElement.scrollWidth,
    innerWidth: window.innerWidth,
  }));
  const buttons = await page.getByRole('button').evaluateAll((elements) =>
    elements.map((element) => {
      const rect = element.getBoundingClientRect();
      return {
        name: element.getAttribute('aria-label') ?? element.textContent?.trim() ?? '',
        width: rect.width,
        height: rect.height,
      };
    }),
  );
  const data = { name, url: page.url(), bodyText, geometry, buttons };
  assert.ok(geometry.scrollWidth <= geometry.clientWidth, `${name}: horizontal overflow`);
  await page.screenshot({ path: path.join(outDir, `${name}.png`), fullPage: true });
  await writeFile(path.join(outDir, `${name}.json`), `${JSON.stringify(data, null, 2)}\n`);
  return data;
}

try {
  await page.goto(`${baseUrl}/progress`, { waitUntil: 'domcontentloaded', timeout: 60_000 });
  await page.getByText('12 weeks · 3 photos · all on this phone', { exact: true }).waitFor({
    timeout: 60_000,
  });
  assert.equal(await page.getByText('Your timeline is locked.', { exact: true }).count(), 0);
  const unlocked = await snapshot('session-unlocked-progress-modern-390x844');

  await page.getByRole('button', { name: 'Timeline', exact: true }).click();
  await page.getByRole('button', { name: 'Photo Apr 1', exact: true }).click();
  await page.getByText('April 1', { exact: true }).waitFor({ timeout: 20_000 });
  assert.equal(await page.getByText('Your timeline is locked.', { exact: true }).count(), 0);
  const detail = await snapshot('session-shared-unlock-detail-modern-390x844');

  await page.getByRole('button', { name: 'Back', exact: true }).click();
  await page.getByText('12 weeks · 3 photos · all on this phone', { exact: true }).waitFor({
    timeout: 20_000,
  });
  await page.getByRole('button', { name: 'Take a progress photo', exact: true }).click();
  await page.getByText('Take photos. On device only', { exact: true }).waitFor({ timeout: 20_000 });
  assert.equal(await page.getByText('Your timeline is locked.', { exact: true }).count(), 0);
  const capture = await snapshot('session-shared-unlock-capture-modern-390x844');

  await page.getByRole('button', { name: 'Not now', exact: true }).click();
  await page.getByText('12 weeks · 3 photos · all on this phone', { exact: true }).waitFor({
    timeout: 20_000,
  });
  await page.evaluate(() => {
    Object.defineProperty(document, 'visibilityState', {
      configurable: true,
      get: () => 'hidden',
    });
    document.dispatchEvent(new Event('visibilitychange'));
  });
  await page.waitForTimeout(150);
  await page.evaluate(() => {
    Object.defineProperty(document, 'visibilityState', {
      configurable: true,
      get: () => 'visible',
    });
    document.dispatchEvent(new Event('visibilitychange'));
  });
  await page.getByText('Your timeline is locked.', { exact: true }).waitFor({ timeout: 20_000 });
  const relocked = await snapshot('session-background-relocked-modern-390x844');
  assert.ok(!relocked.bodyText.includes('12 weeks · 3 photos'), 'Timeline data visible after relock');
  assert.equal(await page.getByRole('button', { name: 'Unlock', exact: true }).count(), 1);

  assert.ok(unlocked.bodyText.includes('12 weeks · 3 photos'));
  assert.ok(detail.bodyText.toLowerCase().includes('your note'));
  assert.ok(capture.bodyText.includes('Take photos. On device only'));
} finally {
  await context.close();
  await browser.close();
}

const disallowedLogs = logs.filter(
  (entry) =>
    entry.type === 'error' &&
    !entry.text.includes('EXPO_PUBLIC_SUPABASE') &&
    !entry.text.includes('Using placeholder'),
);
assert.deepEqual(dialogs, [], 'No JavaScript dialogs expected');
assert.deepEqual(pageErrors, [], 'No page errors expected');
assert.deepEqual(disallowedLogs, [], 'No unexpected browser errors expected');
assert.equal(
  requests.some((entry) => /supabase|posthog|sentry/i.test(entry.url)),
  false,
  'Progress lock flow must not call privacy-sensitive vendors',
);

await writeFile(path.join(outDir, 'session-browser-logs.json'), `${JSON.stringify(logs, null, 2)}\n`);
await writeFile(
  path.join(outDir, 'session-browser-disallowed-logs.json'),
  `${JSON.stringify(disallowedLogs, null, 2)}\n`,
);
await writeFile(path.join(outDir, 'session-network-requests.json'), `${JSON.stringify(requests, null, 2)}\n`);
await writeFile(path.join(outDir, 'session-dialogs.json'), `${JSON.stringify(dialogs, null, 2)}\n`);
await writeFile(path.join(outDir, 'session-page-errors.json'), `${JSON.stringify(pageErrors, null, 2)}\n`);

process.stdout.write('Shared unlock and background relock E2E passed.\n');
