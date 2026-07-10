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

const baseUrl = process.env.E2E_BASE_URL ?? 'http://127.0.0.1:8165';
const outDir = path.dirname(fileURLToPath(import.meta.url));
const telemetry = createTelemetry();
const browser = await launchBrowser();
const context = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 1 });
await seedPrivateEnvelope(context);
const page = await context.newPage();
attachTelemetry(page, telemetry, baseUrl, 'one-shot-retry');

let result;
try {
  await page.goto(`${baseUrl}/shelf`, { waitUntil: 'domcontentloaded', timeout: 60_000 });
  await page
    .getByText('Your private data could not open.', { exact: true })
    .waitFor({ timeout: 60_000 });

  const beforeText = await bodyText(page);
  const beforeStorage = await snapshotPrivateSeed(page);
  const beforeHashes = assertPrivateSeedPreserved(beforeStorage, 'one-shot before retry');
  const retry = page.getByRole('button', { name: 'Try again', exact: true });
  const retryBox = await retry.boundingBox();
  assert.ok(retryBox && retryBox.height >= 56, 'One-shot retry target below 56px');
  assert.equal(await page.getByRole('tab').count(), 0, 'Tabs mounted before successful retry');
  assert.ok(!beforeText.includes('Scan a barcode'), 'Shelf content mounted before successful retry');
  await page.screenshot({ path: path.join(outDir, 'retry-before-modern-390x844.png'), fullPage: true });

  await retry.click();
  await page.getByText('Shelf', { exact: true }).first().waitFor({ timeout: 20_000 });
  await page.getByRole('tab', { name: 'Shelf tab', exact: true }).waitFor();

  const afterText = await bodyText(page);
  const afterStorage = await snapshotPrivateSeed(page);
  const afterHashes = assertPrivateSeedPreserved(afterStorage, 'one-shot after retry');
  const geometry = await pageGeometry(page);
  assert.equal(await page.getByText('Your private data could not open.', { exact: true }).count(), 0);
  assert.equal(new URL(page.url()).pathname, '/shelf');
  assert.ok(afterText.includes('Scan a barcode'), 'Requested Shelf route did not mount');
  assert.ok(geometry.scrollWidth <= geometry.clientWidth, 'Recovered Shelf has horizontal overflow');
  await page.screenshot({ path: path.join(outDir, 'retry-after-modern-390x844.png'), fullPage: true });

  result = {
    requestedUrl: '/shelf',
    finalUrl: page.url(),
    viewport: { width: 390, height: 844 },
    beforeText,
    afterText,
    retryBox,
    geometry,
    beforeHashes,
    afterHashes,
    ciphertextByteIdentical: beforeStorage.envelope === afterStorage.envelope,
    contentKeyByteIdentical: beforeStorage.contentKey === afterStorage.contentKey,
  };
} finally {
  await context.close();
  await browser.close();
}

const derivedTelemetry = assertTelemetryClean(telemetry, 'one-shot retry');
await writeJson(outDir, 'retry-result.json', result);
await writeTelemetry(outDir, 'retry', telemetry, derivedTelemetry);
process.stdout.write('One-shot private-data recovery E2E passed.\n');
