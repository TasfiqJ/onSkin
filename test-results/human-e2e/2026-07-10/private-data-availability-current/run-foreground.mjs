import assert from 'node:assert/strict';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import {
  assertPrivateSeedPreserved,
  assertTelemetryClean,
  attachTelemetry,
  bodyText,
  createTelemetry,
  launchBrowser,
  pageGeometry,
  seedPrivateEnvelope,
  snapshotPrivateSeed,
  writeJson,
  writeTelemetry,
} from './support.mjs';

const baseUrl = process.env.E2E_BASE_URL ?? 'http://127.0.0.1:8166';
const outDir = path.dirname(fileURLToPath(import.meta.url));
const telemetry = createTelemetry();
const browser = await launchBrowser();
const context = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 1 });
await seedPrivateEnvelope(context);
const page = await context.newPage();
attachTelemetry(page, telemetry, baseUrl, 'foreground-recheck');

let result;
try {
  await page.goto(`${baseUrl}/shelf`, { waitUntil: 'domcontentloaded', timeout: 60_000 });
  await page.getByText('Shelf', { exact: true }).first().waitFor({ timeout: 60_000 });
  await page.getByRole('tab', { name: 'Shelf tab', exact: true }).waitFor();
  const initialStorage = await snapshotPrivateSeed(page);
  const initialHashes = assertPrivateSeedPreserved(initialStorage, 'foreground initial');
  await page.screenshot({ path: path.join(outDir, 'foreground-before-modern-390x844.png'), fullPage: true });

  await page.evaluate(() => {
    Object.defineProperty(document, 'visibilityState', {
      configurable: true,
      get: () => window.__onskinE2EVisibilityState,
    });
    window.__onskinE2EVisibilityState = 'hidden';
    document.dispatchEvent(new Event('visibilitychange'));
  });
  await page.waitForTimeout(100);
  await page.evaluate(() => {
    window.__onskinE2EVisibilityState = 'visible';
    document.dispatchEvent(new Event('visibilitychange'));
  });

  await page
    .getByText('Your private data could not open.', { exact: true })
    .waitFor({ timeout: 20_000 });
  const blockedText = await bodyText(page);
  const blockedStorage = await snapshotPrivateSeed(page);
  const blockedHashes = assertPrivateSeedPreserved(blockedStorage, 'foreground blocked');
  const retry = page.getByRole('button', { name: 'Try again', exact: true });
  const retryBox = await retry.boundingBox();
  assert.ok(retryBox && retryBox.height >= 56, 'Foreground retry target below 56px');
  assert.equal(await page.getByRole('tab').count(), 0, 'Tabs remained mounted after failed foreground audit');
  assert.ok(!blockedText.includes('Scan a barcode'), 'Shelf content remained visible after failed foreground audit');
  await page.screenshot({ path: path.join(outDir, 'foreground-blocked-modern-390x844.png'), fullPage: true });

  await retry.click();
  await page.waitForTimeout(1_000);
  const retryOutcome = {
    url: page.url(),
    bodyText: await bodyText(page),
    localStorage: await page.evaluate(() =>
      Object.fromEntries(
        Array.from({ length: window.localStorage.length }, (_, index) => {
          const key = window.localStorage.key(index) ?? '';
          return [key, window.localStorage.getItem(key)];
        }),
      ),
    ),
  };
  await writeJson(outDir, 'foreground-retry-outcome.json', retryOutcome);
  assert.ok(
    !retryOutcome.bodyText.includes('It is still unavailable.'),
    'Foreground retry performed another failed encrypted read',
  );
  await page.getByText('Shelf', { exact: true }).first().waitFor({ timeout: 20_000 });
  await page.getByRole('tab', { name: 'Shelf tab', exact: true }).waitFor();
  const recoveredStorage = await snapshotPrivateSeed(page);
  const recoveredHashes = assertPrivateSeedPreserved(recoveredStorage, 'foreground recovered');
  const recoveredText = await bodyText(page);
  const geometry = await pageGeometry(page);
  assert.equal(new URL(page.url()).pathname, '/shelf');
  assert.ok(recoveredText.includes('Scan a barcode'), 'Shelf did not recover after foreground retry');
  assert.ok(geometry.scrollWidth <= geometry.clientWidth, 'Foreground recovery has horizontal overflow');
  await page.screenshot({ path: path.join(outDir, 'foreground-recovered-modern-390x844.png'), fullPage: true });

  result = {
    requestedUrl: '/shelf',
    finalUrl: page.url(),
    viewport: { width: 390, height: 844 },
    blockedText,
    recoveredText,
    retryBox,
    geometry,
    initialHashes,
    blockedHashes,
    recoveredHashes,
    ciphertextByteIdentical:
      initialStorage.envelope === blockedStorage.envelope &&
      blockedStorage.envelope === recoveredStorage.envelope,
    contentKeyByteIdentical:
      initialStorage.contentKey === blockedStorage.contentKey &&
      blockedStorage.contentKey === recoveredStorage.contentKey,
  };
} finally {
  await context.close();
  await browser.close();
}

const derivedTelemetry = assertTelemetryClean(telemetry, 'foreground recheck');
await writeJson(outDir, 'foreground-result.json', result);
await writeTelemetry(outDir, 'foreground', telemetry, derivedTelemetry);
process.stdout.write('Foreground private-data recheck E2E passed.\n');
