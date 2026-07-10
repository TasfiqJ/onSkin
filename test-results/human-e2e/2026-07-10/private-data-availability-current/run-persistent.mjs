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

const baseUrl = process.env.E2E_BASE_URL ?? 'http://127.0.0.1:8164';
const outDir = path.dirname(fileURLToPath(import.meta.url));
const viewports = [
  { name: 'supported-floor-360x640', width: 360, height: 640 },
  { name: 'modern-390x844', width: 390, height: 844 },
];
const routes = [
  { name: 'today', url: '/today' },
  { name: 'shelf', url: '/shelf' },
  { name: 'routine-plan', url: '/routine/plan' },
  { name: 'settings-privacy', url: '/settings/privacy' },
  { name: 'progress', url: '/progress' },
];
const blockedMarkers = [
  'Add products',
  'Scan a barcode',
  'Start today',
  'Take a progress photo',
  'Take my first photo',
  'Privacy controls',
];

const browser = await launchBrowser();
const telemetry = createTelemetry();
const results = [];

try {
  for (const viewport of viewports) {
    for (const route of routes) {
      const scenario = `${route.name}-${viewport.name}`;
      const context = await browser.newContext({
        viewport: { width: viewport.width, height: viewport.height },
        deviceScaleFactor: 1,
      });
      await seedPrivateEnvelope(context);
      const page = await context.newPage();
      attachTelemetry(page, telemetry, baseUrl, scenario);

      try {
        await page.goto(`${baseUrl}${route.url}`, {
          waitUntil: 'domcontentloaded',
          timeout: 60_000,
        });
        await page
          .getByText('Your private data could not open.', { exact: true })
          .waitFor({ timeout: 60_000 });

        const beforeText = await bodyText(page);
        const beforeStorage = await snapshotPrivateSeed(page);
        const beforeHashes = assertPrivateSeedPreserved(beforeStorage, `${scenario} before retry`);
        const retry = page.getByRole('button', { name: 'Try again', exact: true });
        const retryBox = await retry.boundingBox();

        assert.ok(retryBox && retryBox.height >= 56, `${scenario}: retry target below 56px`);
        assert.equal(await page.getByRole('button').count(), 1, `${scenario}: route action mounted`);
        assert.equal(await page.getByRole('tab').count(), 0, `${scenario}: tab navigation mounted`);
        assert.equal(
          await page.getByText('Locked. Unlock to continue', { exact: true }).count(),
          0,
          `${scenario}: app remained locked before private recovery`,
        );
        assert.ok(!beforeText.includes('E2E_PRIVATE_STORAGE_UNAVAILABLE'), `${scenario}: raw error visible`);
        assert.ok(!beforeText.includes(beforeStorage.envelope), `${scenario}: ciphertext visible`);
        for (const marker of blockedMarkers) {
          assert.ok(!beforeText.includes(marker), `${scenario}: blocked route marker visible: ${marker}`);
        }

        await retry.click();
        await page
          .getByText('It is still unavailable. Your encrypted data remains unchanged.', { exact: true })
          .waitFor();

        const afterText = await bodyText(page);
        const afterStorage = await snapshotPrivateSeed(page);
        const afterHashes = assertPrivateSeedPreserved(afterStorage, `${scenario} after retry`);
        const retryAfterBox = await page
          .getByRole('button', { name: 'Try again', exact: true })
          .boundingBox();
        const geometry = await pageGeometry(page);

        assert.ok(retryAfterBox && retryAfterBox.height >= 56, `${scenario}: retry disappeared`);
        assert.equal(await page.getByRole('button').count(), 1, `${scenario}: extra action after retry`);
        assert.equal(await page.getByRole('tab').count(), 0, `${scenario}: tabs appeared after retry`);
        assert.ok(geometry.scrollWidth <= geometry.clientWidth, `${scenario}: horizontal overflow`);
        for (const marker of blockedMarkers) {
          assert.ok(!afterText.includes(marker), `${scenario}: route marker appeared after retry: ${marker}`);
        }

        const snapshot = {
          scenario,
          requestedUrl: route.url,
          finalUrl: page.url(),
          viewport,
          beforeText,
          afterText,
          retryBox,
          retryAfterBox,
          geometry,
          beforeHashes,
          afterHashes,
          ciphertextByteIdentical: beforeStorage.envelope === afterStorage.envelope,
          contentKeyByteIdentical: beforeStorage.contentKey === afterStorage.contentKey,
        };
        await page.screenshot({ path: path.join(outDir, `${scenario}.png`), fullPage: true });
        await writeJson(outDir, `${scenario}.json`, snapshot);
        results.push(snapshot);
      } finally {
        await context.close();
      }
    }
  }
} finally {
  await browser.close();
}

const derivedTelemetry = assertTelemetryClean(telemetry, 'persistent route matrix');
await writeJson(outDir, 'persistent-results.json', results);
await writeTelemetry(outDir, 'persistent', telemetry, derivedTelemetry);

process.stdout.write(`Persistent private-data gate E2E passed ${results.length}/10.\n`);
