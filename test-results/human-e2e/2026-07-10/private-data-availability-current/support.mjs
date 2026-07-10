import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { mkdir, writeFile } from 'node:fs/promises';
import { createRequire } from 'node:module';

import { xchacha20poly1305 } from '@noble/ciphers/chacha.js';
import { bytesToHex, utf8ToBytes } from '@noble/ciphers/utils.js';

const require = createRequire(import.meta.url);
const { chromium } = require('playwright');

export const browserExecutable =
  process.env.E2E_BROWSER_EXECUTABLE ??
  'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
export const privateContentKeyStorageKey = 'onskin.private_kv.content_key.v1';
export const privateSeedStorageKey = 'onskin.e2e.private_seed.v1';

const privateContentKey = new Uint8Array(32).fill(0x11);
const privateNonce = new Uint8Array(24).fill(0x22);
const privateCiphertext = xchacha20poly1305(privateContentKey, privateNonce).encrypt(
  utf8ToBytes(JSON.stringify({ fixture: 'private-data-preservation-sentinel' })),
);

export const privateSeed = Object.freeze({
  contentKey: bytesToHex(privateContentKey),
  envelope: JSON.stringify({
    version: 'xchacha20poly1305:v1',
    nonceHex: bytesToHex(privateNonce),
    ciphertextHex: bytesToHex(privateCiphertext),
  }),
});

export async function launchBrowser() {
  return chromium.launch({ executablePath: browserExecutable, headless: true });
}

export async function seedPrivateEnvelope(context) {
  await context.addInitScript(
    ({ contentKeyName, contentKey, storageKey, envelope }) => {
      window.localStorage.setItem(contentKeyName, contentKey);
      window.localStorage.setItem(storageKey, envelope);
    },
    {
      contentKeyName: privateContentKeyStorageKey,
      contentKey: privateSeed.contentKey,
      storageKey: privateSeedStorageKey,
      envelope: privateSeed.envelope,
    },
  );
}

export async function snapshotPrivateSeed(page) {
  return page.evaluate(
    ({ contentKeyName, storageKey }) => ({
      contentKey: window.localStorage.getItem(contentKeyName),
      envelope: window.localStorage.getItem(storageKey),
    }),
    { contentKeyName: privateContentKeyStorageKey, storageKey: privateSeedStorageKey },
  );
}

function sha256(value) {
  return createHash('sha256').update(value ?? '').digest('hex');
}

export function assertPrivateSeedPreserved(snapshot, label) {
  assert.equal(snapshot.contentKey, privateSeed.contentKey, `${label}: content key changed`);
  assert.equal(snapshot.envelope, privateSeed.envelope, `${label}: encrypted envelope changed`);
  return {
    contentKeySha256: sha256(snapshot.contentKey),
    envelopeSha256: sha256(snapshot.envelope),
  };
}

export function createTelemetry() {
  return { logs: [], requests: [], dialogs: [], pageErrors: [] };
}

export function attachTelemetry(page, telemetry, baseUrl, scenario) {
  page.on('console', (message) => {
    telemetry.logs.push({ scenario, type: message.type(), text: message.text() });
  });
  page.on('dialog', async (dialog) => {
    telemetry.dialogs.push({ scenario, type: dialog.type(), message: dialog.message() });
    await dialog.dismiss();
  });
  page.on('pageerror', (error) => {
    telemetry.pageErrors.push({ scenario, message: error.message });
  });
  page.on('request', (request) => {
    const url = request.url();
    if (!url.startsWith(baseUrl) && !url.startsWith('data:') && !url.startsWith('blob:')) {
      telemetry.requests.push({ scenario, method: request.method(), url });
    }
  });
}

export function assertTelemetryClean(telemetry, label) {
  const disallowedLogs = telemetry.logs.filter(
    (entry) =>
      entry.type === 'error' &&
      !entry.text.includes('EXPO_PUBLIC_SUPABASE') &&
      !entry.text.includes('Using placeholder'),
  );
  const vendorRequests = telemetry.requests.filter((entry) =>
    /supabase|posthog|sentry/i.test(entry.url),
  );
  assert.deepEqual(telemetry.dialogs, [], `${label}: no JavaScript dialogs expected`);
  assert.deepEqual(telemetry.pageErrors, [], `${label}: no page errors expected`);
  assert.deepEqual(disallowedLogs, [], `${label}: no unexpected browser errors expected`);
  assert.deepEqual(vendorRequests, [], `${label}: no privacy-sensitive vendor requests expected`);
  return { disallowedLogs, vendorRequests };
}

export async function writeTelemetry(outDir, prefix, telemetry, derived) {
  await mkdir(outDir, { recursive: true });
  await Promise.all([
    writeJson(outDir, `${prefix}-browser-logs.json`, telemetry.logs),
    writeJson(outDir, `${prefix}-browser-disallowed-logs.json`, derived.disallowedLogs),
    writeJson(outDir, `${prefix}-network-requests.json`, telemetry.requests),
    writeJson(outDir, `${prefix}-vendor-requests.json`, derived.vendorRequests),
    writeJson(outDir, `${prefix}-dialogs.json`, telemetry.dialogs),
    writeJson(outDir, `${prefix}-page-errors.json`, telemetry.pageErrors),
  ]);
}

export async function pageGeometry(page) {
  return page.evaluate(() => ({
    clientWidth: document.documentElement.clientWidth,
    scrollWidth: document.documentElement.scrollWidth,
    innerWidth: window.innerWidth,
    innerHeight: window.innerHeight,
  }));
}

export async function bodyText(page) {
  return (await page.locator('body').innerText()).replace(/\r/g, '');
}

export async function writeJson(outDir, name, value) {
  await mkdir(outDir, { recursive: true });
  await writeFile(`${outDir}/${name}`, `${JSON.stringify(value, null, 2)}\n`);
}
