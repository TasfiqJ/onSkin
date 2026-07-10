import assert from 'node:assert/strict';
import { mkdir, writeFile } from 'node:fs/promises';
import { createRequire } from 'node:module';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const require = createRequire(import.meta.url);
const { chromium } = require('playwright');

const baseUrl = process.env.E2E_BASE_URL ?? 'http://127.0.0.1:8163';
const browserExecutable =
  process.env.E2E_BROWSER_EXECUTABLE ??
  'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
const outDir = path.dirname(fileURLToPath(import.meta.url));
const capturedUri =
  'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=';
const route = `/progress/review?capturedUri=${encodeURIComponent(capturedUri)}&takenLocalDate=2026-07-10&analysisFixture=unavailable`;

await mkdir(outDir, { recursive: true });
const browser = await chromium.launch({ executablePath: browserExecutable, headless: true });
const context = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 1 });
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

let before;
let after;
try {
  await page.goto(`${baseUrl}${route}`, { waitUntil: 'domcontentloaded', timeout: 60_000 });
  await page.getByText('Your timeline could not open.', { exact: true }).waitFor({ timeout: 60_000 });
  const beforeText = (await page.locator('body').innerText()).replace(/\r/g, '');
  const retry = page.getByRole('button', { name: 'Try again', exact: true });
  const retryBox = await retry.boundingBox();
  assert.ok(retryBox && retryBox.height >= 56, 'Retry must meet the 56px target');
  assert.ok(!beforeText.includes('Save to my phone'), 'Review content visible before storage retry');
  assert.ok(!beforeText.includes('Review'), 'Review label visible before storage retry');
  assert.ok(!beforeText.includes('E2E_PROGRESS_STORAGE_UNAVAILABLE'), 'Raw fixture error visible');
  before = { url: page.url(), bodyText: beforeText, retryBox };
  await page.screenshot({ path: path.join(outDir, 'retry-before-modern-390x844.png'), fullPage: true });

  await retry.click();
  const save = page.getByRole('button', { name: 'Save to my phone', exact: true });
  await save.waitFor({ timeout: 20_000 });
  const afterText = (await page.locator('body').innerText()).replace(/\r/g, '');
  const saveBox = await save.boundingBox();
  const geometry = await page.evaluate(() => ({
    clientWidth: document.documentElement.clientWidth,
    scrollWidth: document.documentElement.scrollWidth,
    innerWidth: window.innerWidth,
  }));
  assert.ok(saveBox && saveBox.height >= 56, 'Recovered Save action must meet the 56px target');
  assert.ok(afterText.includes('Review'), 'Review did not open after successful reread');
  assert.ok(afterText.includes('Save to my phone'), 'Save action missing after successful reread');
  assert.equal(await page.getByText('Your timeline could not open.', { exact: true }).count(), 0);
  assert.equal(new URL(page.url()).pathname, '/progress/review');
  assert.ok(geometry.scrollWidth <= geometry.clientWidth, 'Recovered review has horizontal overflow');
  after = { url: page.url(), bodyText: afterText, saveBox, geometry };
  await page.screenshot({ path: path.join(outDir, 'retry-after-modern-390x844.png'), fullPage: true });
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
const vendorRequests = requests.filter((entry) => /supabase|posthog|sentry/i.test(entry.url));
assert.deepEqual(dialogs, [], 'No JavaScript dialogs expected');
assert.deepEqual(pageErrors, [], 'No page errors expected');
assert.deepEqual(disallowedLogs, [], 'No unexpected browser errors expected');
assert.deepEqual(vendorRequests, [], 'Storage retry must not call privacy-sensitive vendors');

await writeFile(path.join(outDir, 'retry-before.json'), `${JSON.stringify(before, null, 2)}\n`);
await writeFile(path.join(outDir, 'retry-after.json'), `${JSON.stringify(after, null, 2)}\n`);
await writeFile(path.join(outDir, 'retry-browser-logs.json'), `${JSON.stringify(logs, null, 2)}\n`);
await writeFile(path.join(outDir, 'retry-browser-disallowed-logs.json'), `${JSON.stringify(disallowedLogs, null, 2)}\n`);
await writeFile(path.join(outDir, 'retry-network-requests.json'), `${JSON.stringify(requests, null, 2)}\n`);
await writeFile(path.join(outDir, 'retry-vendor-requests.json'), `${JSON.stringify(vendorRequests, null, 2)}\n`);
await writeFile(path.join(outDir, 'retry-dialogs.json'), `${JSON.stringify(dialogs, null, 2)}\n`);
await writeFile(path.join(outDir, 'retry-page-errors.json'), `${JSON.stringify(pageErrors, null, 2)}\n`);

process.stdout.write('One-shot Progress storage retry E2E passed.\n');
