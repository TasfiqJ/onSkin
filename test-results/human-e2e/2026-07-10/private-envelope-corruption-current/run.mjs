import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import {
  assertTelemetryClean,
  attachTelemetry,
  bodyText,
  createTelemetry,
  launchBrowser,
  pageGeometry,
  writeJson,
  writeTelemetry,
} from '../private-data-availability-current/support.mjs';

const baseUrl = process.env.E2E_BASE_URL ?? 'http://127.0.0.1:8297';
const outDir = path.dirname(fileURLToPath(import.meta.url));
const malformedEnvelopeKey = 'onskin.e2e.malformed_private_envelope.v1';
const malformedEnvelope =
  '{"version":"xchacha20poly1305:v1","nonceHex":"000000000000000000000000"';
const appLockKey = 'onskin.appLock.enabled';
const telemetry = createTelemetry();
const browser = await launchBrowser();
const results = [];

function sha256(value) {
  return createHash('sha256').update(value ?? '').digest('hex');
}

async function seedStorage(context, entries) {
  await context.addInitScript((seedEntries) => {
    for (const [key, value] of seedEntries) window.localStorage.setItem(key, value);
  }, entries);
}

async function storedValue(page, key) {
  return page.evaluate((storageKey) => window.localStorage.getItem(storageKey), key);
}

for (const viewport of [
  { name: 'supported-floor-360x640', width: 360, height: 640 },
  { name: 'modern-390x844', width: 390, height: 844 },
]) {
  const scenario = `malformed-envelope-${viewport.name}`;
  const context = await browser.newContext({
    viewport: { width: viewport.width, height: viewport.height },
    deviceScaleFactor: 1,
  });
  await seedStorage(context, [[malformedEnvelopeKey, malformedEnvelope]]);
  const page = await context.newPage();
  attachTelemetry(page, telemetry, baseUrl, scenario);

  try {
    await page.goto(`${baseUrl}/shelf`, { waitUntil: 'domcontentloaded', timeout: 60_000 });
    await page
      .getByText('Your private data could not open.', { exact: true })
      .waitFor({ timeout: 60_000 });

    const beforeText = await bodyText(page);
    const beforeRaw = await storedValue(page, malformedEnvelopeKey);
    const retry = page.getByRole('button', { name: 'Try again', exact: true });
    const retryBox = await retry.boundingBox();
    assert.equal(beforeRaw, malformedEnvelope, `${scenario}: malformed bytes changed before retry`);
    assert.ok(retryBox && retryBox.height >= 56, `${scenario}: retry target below 56px`);
    assert.equal(await page.getByRole('tab').count(), 0, `${scenario}: tabs mounted`);
    assert.equal(await page.getByText('Shelf', { exact: true }).count(), 0, `${scenario}: Shelf mounted`);
    assert.ok(!beforeText.includes('PRIVATE_KV_ENVELOPE_INVALID'), `${scenario}: raw error leaked`);

    await retry.click();
    await page
      .getByText('It is still unavailable. Your encrypted data remains unchanged.', { exact: true })
      .waitFor({ timeout: 30_000 });
    const afterRetryRaw = await storedValue(page, malformedEnvelopeKey);
    assert.equal(afterRetryRaw, malformedEnvelope, `${scenario}: retry changed malformed bytes`);

    const geometry = await pageGeometry(page);
    assert.ok(geometry.scrollWidth <= geometry.clientWidth, `${scenario}: horizontal overflow`);
    await page.screenshot({ path: path.join(outDir, `${scenario}.png`), fullPage: true });

    let recovered = false;
    if (viewport.name === 'modern-390x844') {
      await page.evaluate((storageKey) => window.localStorage.removeItem(storageKey), malformedEnvelopeKey);
      await page.getByRole('button', { name: 'Try again', exact: true }).click();
      await page.getByText('Shelf', { exact: true }).first().waitFor({ timeout: 30_000 });
      assert.equal(await storedValue(page, malformedEnvelopeKey), null, `${scenario}: fixture restored`);
      assert.equal(await page.getByRole('tab').count(), 4, `${scenario}: tabs did not recover`);
      recovered = true;
      await page.screenshot({
        path: path.join(outDir, `${scenario}-recovered.png`),
        fullPage: true,
      });
    }

    results.push({
      scenario,
      viewport,
      requestedUrl: '/shelf',
      finalUrl: page.url(),
      malformedEnvelopeSha256: sha256(malformedEnvelope),
      beforeRawSha256: sha256(beforeRaw),
      afterRetryRawSha256: sha256(afterRetryRaw),
      byteIdenticalThroughRetry: beforeRaw === afterRetryRaw,
      recovered,
      retryBox,
      geometry,
    });
  } finally {
    await context.close();
  }
}

{
  const scenario = 'malformed-app-lock-modern-390x844';
  const context = await browser.newContext({
    viewport: { width: 390, height: 844 },
    deviceScaleFactor: 1,
  });
  await seedStorage(context, [[appLockKey, 'enabled']]);
  const page = await context.newPage();
  attachTelemetry(page, telemetry, baseUrl, scenario);

  try {
    await page.goto(`${baseUrl}/shelf`, { waitUntil: 'domcontentloaded', timeout: 60_000 });
    await page
      .getByText(
        "The app-lock setting couldn't be read. Unlock this phone to reset only that setting.",
        { exact: true },
      )
      .waitFor({ timeout: 60_000 });
    const raw = await storedValue(page, appLockKey);
    const text = await bodyText(page);
    const reset = page.getByRole('button', { name: 'Unlock and reset app lock', exact: true });
    const resetBox = await reset.boundingBox();

    assert.equal(raw, 'enabled', 'Malformed app-lock preference was rewritten');
    assert.ok(resetBox && resetBox.height >= 48, 'Malformed app-lock reset target below 48px');
    assert.equal(await page.getByRole('tab').count(), 0, 'Tabs mounted behind malformed app lock');
    assert.equal(
      await page.getByText('Your private data could not open.', { exact: true }).count(),
      0,
      'Private-data gate mounted before app unlock',
    );
    assert.ok(!text.includes('Shelf'), 'Shelf content mounted behind malformed app lock');
    await page.screenshot({
      path: path.join(outDir, `${scenario}-blocked.png`),
      fullPage: true,
    });
    await reset.click();
    await page.getByText('Shelf', { exact: true }).first().waitFor({ timeout: 30_000 });
    await page.waitForTimeout(500);
    const recoveredRaw = await storedValue(page, appLockKey);
    const geometry = await pageGeometry(page);
    assert.equal(recoveredRaw, null, 'Explicit app-lock recovery did not remove the malformed setting');
    assert.equal(await page.getByRole('tab').count(), 4, 'App did not recover after app-lock reset');
    assert.ok(geometry.scrollWidth <= geometry.clientWidth, 'App-lock overlay overflowed');
    await page.screenshot({
      path: path.join(outDir, `${scenario}-recovered.png`),
      fullPage: true,
    });
    results.push({
      scenario,
      viewport: { width: 390, height: 844 },
      requestedUrl: '/shelf',
      finalUrl: page.url(),
      storedValueBeforeRecovery: raw,
      storedValueAfterRecovery: recoveredRaw,
      preferencePreservedBeforeExplicitRecovery: raw === 'enabled',
      recoveredAfterAuthenticatedReset: recoveredRaw === null,
      resetBox,
      geometry,
    });
  } finally {
    await context.close();
  }
}

await browser.close();
const derivedTelemetry = assertTelemetryClean(telemetry, 'private envelope corruption');
await writeJson(outDir, 'results.json', results);
await writeTelemetry(outDir, 'corruption', telemetry, derivedTelemetry);

const summary = {
  status: 'pass',
  date: '2026-07-10',
  scenarios: results.length,
  malformedEnvelopeScenarios: results.filter((item) => item.scenario.startsWith('malformed-envelope'))
    .length,
  appLockScenarios: results.filter((item) => item.scenario.startsWith('malformed-app-lock')).length,
  byteIdenticalRetries: results
    .filter((item) => item.byteIdenticalThroughRetry !== undefined)
    .every((item) => item.byteIdenticalThroughRetry),
  recoveryPassed: results.some((item) => item.recovered),
  malformedAppLockRecoveryPassed: results.some(
    (item) =>
      item.scenario.startsWith('malformed-app-lock') &&
      item.preferencePreservedBeforeExplicitRecovery &&
      item.recoveredAfterAuthenticatedReset,
  ),
  disallowedBrowserLogs: derivedTelemetry.disallowedLogs.length,
  vendorRequests: derivedTelemetry.vendorRequests.length,
  dialogs: telemetry.dialogs.length,
  pageErrors: telemetry.pageErrors.length,
};
await writeJson(outDir, 'summary.json', summary);
await writeFile(
  path.join(outDir, 'report.md'),
  `# Private Envelope Corruption E2E\n\n- Status: pass\n- Surface: Expo web in headless system Chrome\n- Viewports: 360 x 640 and 390 x 844\n- Covered: real truncated private envelope, repeated retry with byte-identical preservation, restored-record recovery to Shelf, and device-authenticated malformed app-lock reset\n- Privacy: no vendor requests, dialogs, page errors, or disallowed browser errors\n- Native follow-up: physical iOS Keychain and Android Keystore corruption/fault injection remains Tas-owned QA\n`,
);

process.stdout.write(`Private envelope corruption E2E passed ${results.length}/3.\n`);
