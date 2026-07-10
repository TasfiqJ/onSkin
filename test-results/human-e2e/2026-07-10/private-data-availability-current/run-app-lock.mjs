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

const baseUrl = process.env.E2E_BASE_URL ?? 'http://127.0.0.1:8167';
const outDir = path.dirname(fileURLToPath(import.meta.url));
const telemetry = createTelemetry();
const browser = await launchBrowser();
const context = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 1 });
await seedPrivateEnvelope(context);
const page = await context.newPage();
attachTelemetry(page, telemetry, baseUrl, 'app-lock-ordering');

let result;
try {
  await page.goto(`${baseUrl}/shelf`, { waitUntil: 'domcontentloaded', timeout: 60_000 });
  await page.getByText('Locked. Unlock to continue', { exact: true }).waitFor({ timeout: 60_000 });
  const beforeText = await bodyText(page);
  const beforeStorage = await snapshotPrivateSeed(page);
  const beforeHashes = assertPrivateSeedPreserved(beforeStorage, 'app lock before retry');

  assert.equal(
    await page.getByText('Your private data could not open.', { exact: true }).count(),
    0,
    'Private storage gate appeared before app unlock',
  );
  assert.equal(await page.getByRole('tab').count(), 0, 'Tabs mounted behind app lock');
  assert.ok(!beforeText.includes('Scan a barcode'), 'Shelf content mounted behind app lock');

  const unlock = page.getByRole('button', { name: 'Unlock', exact: true });
  await unlock.click();
  await page.waitForTimeout(200);
  await page.getByText('Locked. Unlock to continue', { exact: true }).waitFor();
  assert.equal(
    await page.getByText('Your private data could not open.', { exact: true }).count(),
    0,
    'Private storage gate appeared after rejected app authentication',
  );

  const afterText = await bodyText(page);
  const afterStorage = await snapshotPrivateSeed(page);
  const afterHashes = assertPrivateSeedPreserved(afterStorage, 'app lock after retry');
  const geometry = await pageGeometry(page);
  assert.ok(geometry.scrollWidth <= geometry.clientWidth, 'App lock has horizontal overflow');
  await page.screenshot({ path: path.join(outDir, 'app-lock-blocked-modern-390x844.png'), fullPage: true });

  result = {
    requestedUrl: '/shelf',
    finalUrl: page.url(),
    viewport: { width: 390, height: 844 },
    beforeText,
    afterText,
    geometry,
    beforeHashes,
    afterHashes,
    privateGateVisibleBeforeUnlock: false,
    privateGateVisibleAfterRejectedUnlock: false,
    ciphertextByteIdentical: beforeStorage.envelope === afterStorage.envelope,
    contentKeyByteIdentical: beforeStorage.contentKey === afterStorage.contentKey,
  };
} finally {
  await context.close();
  await browser.close();
}

const derivedTelemetry = assertTelemetryClean(telemetry, 'app-lock ordering');
await writeJson(outDir, 'app-lock-result.json', result);
await writeTelemetry(outDir, 'app-lock', telemetry, derivedTelemetry);
process.stdout.write('App-lock ordering E2E passed.\n');
