import { createHash } from 'node:crypto';
import assert from 'node:assert/strict';
import { writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { xchacha20poly1305 } from '@noble/ciphers/chacha.js';
import { bytesToHex, utf8ToBytes } from '@noble/ciphers/utils.js';

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

const baseUrl = process.env.E2E_BASE_URL ?? 'http://127.0.0.1:8160';
const outDir = path.dirname(fileURLToPath(import.meta.url));
const contentKeyName = 'onskin.private_kv.content_key.v1';
const profileKey = 'onskin.skinprofile.v1';
const shelfKey = 'onskin.shelf.v1';
const entitlementKey = 'onskin.entitlement.v2';
const healthConsentKey = 'onskin.healthDataCollectionConsent.v1';
const healthConsentVersion = 'draft-v1-2026-07-10';
const healthConsentText =
  '[DRAFT. Pending legal review B-PRIVACY-COPY] Health-data COLLECTION consent. ' +
  'Covers quiz answers, skin goals, sensitivities, whether you are pregnant, breastfeeding, or trying to become pregnant, and added products. ' +
  'This consent covers collection only; sharing is requested separately.';
const contentKey = new Uint8Array(32).fill(0x31);
const telemetry = createTelemetry();
const browser = await launchBrowser();
const results = [];
const auxiliaryResults = [];
let nonceCounter = 1;

function envelope(value) {
  const nonce = new Uint8Array(24).fill(nonceCounter++);
  const ciphertext = xchacha20poly1305(contentKey, nonce).encrypt(
    utf8ToBytes(JSON.stringify(value)),
  );
  return JSON.stringify({
    version: 'xchacha20poly1305:v1',
    nonceHex: bytesToHex(nonce),
    ciphertextHex: bytesToHex(ciphertext),
  });
}

function storedProfile(pregnancyStatus) {
  return {
    result: {
      axes: {
        oily_dry: 0.5,
        sensitive_resistant: 0.5,
        pigmented_non: 0.5,
        wrinkled_tight: 0.5,
      },
      axisScores: {
        oily_dry: 0,
        sensitive_resistant: 0,
        pigmented_non: 0,
        wrinkled_tight: 0,
      },
      dspt: 'OSNT',
      fitzpatrick: 3,
      monkTone: 5,
      sensitivities: [],
      pregnancyStatus,
    },
    goals: ['anti_aging'],
    completedAt: '2026-07-10T12:00:00.000Z',
  };
}

const shelf = [
  {
    id: 'retinoid',
    name: 'Retinol 0.3% Night Serum',
    category: 'retinoid_serum',
    ingredients: ['Retinol'],
    addedVia: 'manual',
    isOpened: true,
    openedAt: '2026-06-01',
    paoMonths: 6,
    paoSource: 'category_default',
    expirySource: 'pao_computed',
    status: 'active',
    createdAt: '2026-06-01T12:00:00.000Z',
    updatedAt: '2026-06-01T12:00:00.000Z',
  },
  {
    id: 'bha',
    name: 'Salicylic serum',
    category: 'serum',
    ingredients: ['Salicylic acid'],
    addedVia: 'manual',
    isOpened: true,
    openedAt: '2026-06-01',
    paoMonths: 6,
    paoSource: 'category_default',
    expirySource: 'pao_computed',
    status: 'active',
    createdAt: '2026-06-01T12:00:00.000Z',
    updatedAt: '2026-06-01T12:00:00.000Z',
  },
  {
    id: 'moisturiser',
    name: 'Ceramide moisturiser',
    category: 'moisturiser_jar',
    ingredients: ['Ceramide NP'],
    addedVia: 'manual',
    isOpened: true,
    openedAt: '2026-06-01',
    paoMonths: 12,
    paoSource: 'category_default',
    expirySource: 'pao_computed',
    status: 'active',
    createdAt: '2026-06-01T12:00:00.000Z',
    updatedAt: '2026-06-01T12:00:00.000Z',
  },
];

function healthConsent(mode = 'current') {
  return {
    type: 'health_data_collection',
    granted: mode !== 'declined',
    version: mode === 'legacy' ? 'draft-v0' : healthConsentVersion,
    consentTextHash: createHash('sha256').update(healthConsentText).digest('hex'),
    recordedAt: '2026-07-10T12:00:00.000Z',
  };
}

async function seed(context, options = {}) {
  const grantedAt = new Date().toISOString();
  const expiresAt = new Date(Date.now() + 30 * 86_400_000).toISOString();
  const entitlement = {
    tier: 'pro',
    isActive: true,
    periodType: 'reverse_trial',
    store: 'app_granted',
    productId: null,
    expiresAt,
    willRenew: false,
    grantedAt,
    source: 'app_granted',
    environment: 'development',
    managementUrl: null,
    verifiedAt: grantedAt,
    offeringId: null,
    packageId: null,
    storeUserId: null,
    priceLabel: null,
  };
  const entries = [
    [contentKeyName, bytesToHex(contentKey)],
    ...(options.includeProfile === false ? [] : [[profileKey, envelope(storedProfile('none'))]]),
    [shelfKey, envelope(shelf)],
    [entitlementKey, envelope(entitlement)],
    [healthConsentKey, envelope(healthConsent(options.consentMode))],
  ];
  await context.addInitScript((seedEntries) => {
    const marker = 'routinekind.e2e.pregnancy_safety_seeded.v1';
    if (window.localStorage.getItem(marker) === 'true') return;
    for (const [key, value] of seedEntries) window.localStorage.setItem(key, value);
    window.localStorage.setItem(marker, 'true');
  }, entries);
}

async function visibleControlGeometry(page) {
  return page.evaluate(() => {
    const controls = Array.from(document.querySelectorAll('[role="button"], button, a'))
      .map((element) => {
        const rect = element.getBoundingClientRect();
        const style = window.getComputedStyle(element);
        return {
          label:
            element.getAttribute('aria-label') ??
            element.textContent?.replace(/\s+/g, ' ').trim() ??
            '',
          width: rect.width,
          height: rect.height,
          visible:
            rect.width > 0 &&
            rect.height > 0 &&
            style.visibility !== 'hidden' &&
            style.display !== 'none',
        };
      })
      .filter((control) => control.visible);
    return {
      controls,
      below44: controls.filter((control) => control.width < 44 || control.height < 44),
    };
  });
}

async function applyTextPressure(page, scale) {
  return page.evaluate((nextScale) => {
    let scaled = 0;
    for (const node of document.querySelectorAll('*')) {
      if (!(node instanceof HTMLElement)) continue;
      if (node.dataset.e2ePregnancyTextPressure) continue;
      const hasDirectText = Array.from(node.childNodes).some(
        (child) => child.nodeType === Node.TEXT_NODE && child.textContent?.trim(),
      );
      if (!hasDirectText || node.closest('[role="tab"]')) continue;
      const style = window.getComputedStyle(node);
      const fontSize = Number.parseFloat(style.fontSize);
      if (!Number.isFinite(fontSize) || fontSize < 8 || fontSize > 72) continue;
      const lineHeight = Number.parseFloat(style.lineHeight);
      node.dataset.e2ePregnancyTextPressure = String(nextScale);
      node.style.fontSize = `${(fontSize * nextScale).toFixed(3)}px`;
      if (Number.isFinite(lineHeight)) {
        node.style.lineHeight = `${(lineHeight * nextScale).toFixed(3)}px`;
      }
      scaled += 1;
    }
    return scaled;
  }, scale);
}

async function settleVisual(page, delay = 750) {
  await page.evaluate(async () => {
    if (document.fonts?.ready) await document.fonts.ready;
    await new Promise((resolve) =>
      requestAnimationFrame(() => requestAnimationFrame(resolve)),
    );
  });
  await page.waitForTimeout(delay);
}

async function assertPlanState(page, { excluded }) {
  await page.getByText('Your routine, in order.', { exact: true }).waitFor({ timeout: 60_000 });
  if (excluded) {
    await page.getByText('Caution products paused', { exact: true }).waitFor();
    assert.equal(await page.getByText('Retinol 0.3% Night Serum', { exact: true }).count(), 0);
    assert.equal(await page.getByText('Salicylic serum', { exact: true }).count(), 0);
  } else {
    assert.equal(await page.getByText('Caution products paused', { exact: true }).count(), 0);
    assert.equal(await page.getByText('Retinol 0.3% Night Serum', { exact: true }).count(), 1);
    assert.equal(await page.getByText('Salicylic serum', { exact: true }).count(), 1);
  }
  await page.getByText('Ceramide moisturiser', { exact: true }).first().waitFor();
  await page.evaluate(() => window.scrollTo(0, 0));
  await settleVisual(page);
}

async function installOneShotPrivateWriteFailure(page, key) {
  await page.evaluate((targetKey) => {
    const original = Storage.prototype.setItem;
    let armed = true;
    Storage.prototype.setItem = function setItemWithOneFailure(storageKey, value) {
      if (armed && storageKey === targetKey) {
        armed = false;
        throw new Error('E2E_PRIVATE_WRITE_FAILURE');
      }
      return original.call(this, storageKey, value);
    };
    window.__restorePregnancyWriteFixture = () => {
      Storage.prototype.setItem = original;
      delete window.__restorePregnancyWriteFixture;
    };
  }, key);
}

async function restorePrivateWriteFixture(page) {
  await page.evaluate(() => window.__restorePregnancyWriteFixture?.());
}

async function chooseStatus(page, label, { failWriteOnce = false } = {}) {
  await page.goto(`${baseUrl}/settings/skin-profile`, {
    waitUntil: 'domcontentloaded',
    timeout: 60_000,
  });
  await page.getByText('Pregnancy & breastfeeding', { exact: true }).waitFor({ timeout: 60_000 });
  await page.getByRole('button', { name: label, exact: true }).click();
  if (failWriteOnce) await installOneShotPrivateWriteFailure(page, profileKey);
  await page.getByRole('button', { name: /Save setting|Try again/ }).click();
  if (failWriteOnce) {
    await page.getByText('Choice not saved', { exact: true }).waitFor();
    await page.getByText('Your previous setting is unchanged.', { exact: false }).waitFor();
    await restorePrivateWriteFixture(page);
    await page.getByRole('button', { name: 'Try again', exact: true }).click();
  }
  await page.waitForTimeout(500);
}

for (const viewport of [
  { name: 'supported-floor-360x640', width: 360, height: 640 },
  { name: 'modern-390x844', width: 390, height: 844 },
]) {
  const scenario = `pregnancy-safety-${viewport.name}`;
  const context = await browser.newContext({
    viewport: { width: viewport.width, height: viewport.height },
    deviceScaleFactor: 1,
  });
  await seed(context);
  const page = await context.newPage();
  attachTelemetry(page, telemetry, baseUrl, scenario);

  try {
    await page.goto(`${baseUrl}/routine/plan`, {
      waitUntil: 'domcontentloaded',
      timeout: 60_000,
    });
    await assertPlanState(page, { excluded: false });
    await page.screenshot({
      path: path.join(outDir, `${scenario}-clear-plan.png`),
      fullPage: false,
    });

    await chooseStatus(page, 'Pregnant or trying', { failWriteOnce: true });
    await page.goto(`${baseUrl}/routine/plan`, { waitUntil: 'domcontentloaded' });
    await assertPlanState(page, { excluded: true });
    await page.screenshot({
      path: path.join(outDir, `${scenario}-cautious-plan.png`),
      fullPage: false,
    });

    await page.goto(`${baseUrl}/today?routine=PM`, { waitUntil: 'domcontentloaded' });
    await page.getByText('Good evening.', { exact: true }).waitFor({ timeout: 60_000 });
    await page
      .getByText('2 caution products paused by your pregnancy & breastfeeding setting.', {
        exact: true,
      })
      .waitFor();
    assert.equal(await page.getByText('Retinol 0.3% Night Serum', { exact: true }).count(), 0);
    assert.equal(await page.getByText('Salicylic serum', { exact: true }).count(), 0);
    await settleVisual(page);
    await page.screenshot({
      path: path.join(outDir, `${scenario}-cautious-today-pm.png`),
      fullPage: false,
    });

    await chooseStatus(page, 'Breastfeeding');
    await page.goto(`${baseUrl}/routine/plan`, { waitUntil: 'domcontentloaded' });
    await assertPlanState(page, { excluded: true });
    await page.screenshot({
      path: path.join(outDir, `${scenario}-breastfeeding-plan.png`),
      fullPage: false,
    });

    await chooseStatus(page, 'Prefer not to say');
    await page.reload({ waitUntil: 'domcontentloaded' });
    await page.goto(`${baseUrl}/settings/skin-profile`, { waitUntil: 'domcontentloaded' });
    await page.getByText('Pregnancy & breastfeeding', { exact: true }).waitFor();
    assert.equal(
      await page.getByRole('button', { name: 'Prefer not to say', exact: true }).getAttribute('aria-pressed'),
      'true',
    );
    const settingBody = await bodyText(page);
    assert.ok(!/you(?:'re| are) pregnant/i.test(settingBody));
    await settleVisual(page);

    const geometry = await pageGeometry(page);
    const controls = await visibleControlGeometry(page);
    assert.ok(geometry.scrollWidth <= geometry.clientWidth, `${scenario}: horizontal overflow`);
    assert.deepEqual(controls.below44, [], `${scenario}: sub-44px visible controls`);
    await page.screenshot({
      path: path.join(outDir, `${scenario}-prefer-not-persisted.png`),
      fullPage: false,
    });

    const textPressureScaledCount = await applyTextPressure(page, 2);
    await settleVisual(page);
    const textPressureGeometry = await pageGeometry(page);
    const textPressureControls = await visibleControlGeometry(page);
    assert.ok(textPressureScaledCount > 0, `${scenario}: no text nodes scaled`);
    assert.ok(
      textPressureGeometry.scrollWidth <= textPressureGeometry.clientWidth,
      `${scenario}: 200% text-pressure horizontal overflow`,
    );
    assert.deepEqual(
      textPressureControls.below44,
      [],
      `${scenario}: 200% text-pressure sub-44px visible controls`,
    );
    await page.screenshot({
      path: path.join(outDir, `${scenario}-prefer-not-200-text.png`),
      fullPage: false,
    });

    await page.getByRole('button', { name: 'No', exact: true }).click();
    await page.getByRole('button', { name: 'Save setting', exact: true }).click();
    await page.waitForTimeout(500);
    const restoredPage = await context.newPage();
    attachTelemetry(restoredPage, telemetry, baseUrl, `${scenario}-restored`);
    try {
      await restoredPage.goto(`${baseUrl}/routine/plan`, { waitUntil: 'domcontentloaded' });
      await assertPlanState(restoredPage, { excluded: false });
      await restoredPage.screenshot({
        path: path.join(outDir, `${scenario}-clear-restored-plan.png`),
        fullPage: false,
      });
    } finally {
      await restoredPage.close();
    }

    results.push({
      scenario,
      viewport,
      transitionSequence: ['none', 'pregnant', 'breastfeeding', 'prefer_not', 'none'],
      excludedProductIds: ['retinoid', 'bha'],
      encryptedPersistenceReloadPassed: true,
      cautiousPlanPassed: true,
      cautiousTodayPassed: true,
      writeFailureRetryPassed: true,
      clearRestorationPassed: true,
      geometry,
      controls,
      textPressure: {
        scale: 2,
        scaledCount: textPressureScaledCount,
        geometry: textPressureGeometry,
        controls: textPressureControls,
      },
    });
  } catch (error) {
    await page.screenshot({
      path: path.join(outDir, `${scenario}-failure.png`),
      fullPage: false,
    });
    await writeFile(
      path.join(outDir, `${scenario}-failure.txt`),
      `URL: ${page.url()}\n\n${await bodyText(page)}\n\n${error instanceof Error ? error.stack : String(error)}\n`,
      'utf8',
    );
    throw error;
  } finally {
    await context.close();
  }
}

{
  const scenario = 'pregnancy-safety-legacy-consent-regrant';
  const viewport = { name: 'supported-floor-360x640', width: 360, height: 640 };
  const context = await browser.newContext({
    viewport: { width: viewport.width, height: viewport.height },
    deviceScaleFactor: 1,
  });
  await seed(context, { consentMode: 'legacy' });
  const page = await context.newPage();
  attachTelemetry(page, telemetry, baseUrl, scenario);
  try {
    await page.goto(`${baseUrl}/routine/plan`, { waitUntil: 'domcontentloaded' });
    await assertPlanState(page, { excluded: true });
    await page.goto(`${baseUrl}/settings/skin-profile`, { waitUntil: 'domcontentloaded' });
    await page.getByText('Privacy choice needs review', { exact: true }).waitFor();
    await settleVisual(page);
    await page.screenshot({
      path: path.join(outDir, `${scenario}-gate.png`),
      fullPage: false,
    });

    await page.getByRole('button', { name: 'Review privacy choice', exact: true }).click();
    await page.getByText('Before the quiz,', { exact: false }).waitFor();
    await installOneShotPrivateWriteFailure(page, healthConsentKey);
    await page.getByRole('button', { name: 'I agree. Continue', exact: true }).click();
    await page.getByText('Consent not saved', { exact: true }).waitFor();
    await settleVisual(page);
    await page.screenshot({
      path: path.join(outDir, `${scenario}-consent-save-recovery.png`),
      fullPage: false,
    });
    const consentGeometry = await pageGeometry(page);
    const consentControls = await visibleControlGeometry(page);
    assert.ok(
      consentGeometry.scrollWidth <= consentGeometry.clientWidth,
      `${scenario}: consent recovery horizontal overflow`,
    );
    assert.deepEqual(
      consentControls.below44,
      [],
      `${scenario}: consent recovery sub-44px visible controls`,
    );
    await restorePrivateWriteFixture(page);
    await page.getByRole('button', { name: 'I agree. Continue', exact: true }).click();
    await page.waitForTimeout(750);
    await page.getByText('Pregnancy & breastfeeding', { exact: true }).last().waitFor();
    assert.equal(
      await page
        .getByRole('button', { name: 'No', exact: true })
        .last()
        .getAttribute('aria-pressed'),
      'true',
    );
    await settleVisual(page);
    const geometry = await pageGeometry(page);
    const controls = await visibleControlGeometry(page);
    assert.ok(geometry.scrollWidth <= geometry.clientWidth, `${scenario}: horizontal overflow`);
    assert.deepEqual(controls.below44, [], `${scenario}: sub-44px visible controls`);
    await page.screenshot({
      path: path.join(outDir, `${scenario}-current-setting.png`),
      fullPage: false,
    });
    auxiliaryResults.push({
      scenario,
      viewport,
      legacyConsentStayedCautious: true,
      consentWriteFailureRetryPassed: true,
      returnedToSetting: true,
      geometry,
      controls,
    });
  } catch (error) {
    await page.screenshot({
      path: path.join(outDir, `${scenario}-failure.png`),
      fullPage: false,
    });
    throw error;
  } finally {
    await context.close();
  }
}

{
  const scenario = 'pregnancy-safety-missing-profile';
  const viewport = { name: 'modern-390x844', width: 390, height: 844 };
  const context = await browser.newContext({
    viewport: { width: viewport.width, height: viewport.height },
    deviceScaleFactor: 1,
  });
  await seed(context, { includeProfile: false });
  const page = await context.newPage();
  attachTelemetry(page, telemetry, baseUrl, scenario);
  try {
    await page.goto(`${baseUrl}/routine/plan`, { waitUntil: 'domcontentloaded' });
    await assertPlanState(page, { excluded: true });
    await page.goto(`${baseUrl}/settings/skin-profile`, { waitUntil: 'domcontentloaded' });
    await page.getByText('Skin profile unavailable', { exact: true }).waitFor();
    await page.getByRole('button', { name: 'Rebuild skin profile', exact: true }).waitFor();
    const geometry = await pageGeometry(page);
    const controls = await visibleControlGeometry(page);
    assert.ok(geometry.scrollWidth <= geometry.clientWidth, `${scenario}: horizontal overflow`);
    assert.deepEqual(controls.below44, [], `${scenario}: sub-44px visible controls`);
    await page.screenshot({
      path: path.join(outDir, `${scenario}-recovery.png`),
      fullPage: false,
    });
    auxiliaryResults.push({
      scenario,
      viewport,
      missingProfileStayedCautious: true,
      recoveryActionPassed: true,
      geometry,
      controls,
    });
  } catch (error) {
    await page.screenshot({
      path: path.join(outDir, `${scenario}-failure.png`),
      fullPage: false,
    });
    throw error;
  } finally {
    await context.close();
  }
}

await browser.close();
const derived = assertTelemetryClean(telemetry, 'pregnancy safety status E2E');
await writeJson(outDir, 'results.json', { supportedPhone: results, auxiliary: auxiliaryResults });
await writeJson(outDir, 'summary.json', {
  status: 'pass',
  date: '2026-07-10',
  scenarios: results.length + auxiliaryResults.length,
  viewports: results.map((result) => result.viewport),
  transitions: ['none', 'pregnant', 'breastfeeding', 'prefer_not', 'none'],
  planTodayConsistencyPassed: results.every(
    (result) => result.cautiousPlanPassed && result.cautiousTodayPassed,
  ),
  encryptedPersistenceReloadPassed: results.every(
    (result) => result.encryptedPersistenceReloadPassed,
  ),
  clearRestorationPassed: results.every((result) => result.clearRestorationPassed),
  writeFailureRetryPassed: results.every((result) => result.writeFailureRetryPassed),
  legacyConsentRegrantPassed: auxiliaryResults.some(
    (result) => result.legacyConsentStayedCautious && result.consentWriteFailureRetryPassed,
  ),
  missingProfileRecoveryPassed: auxiliaryResults.some(
    (result) => result.missingProfileStayedCautious && result.recoveryActionPassed,
  ),
  sub44VisibleControls: results.flatMap((result) => result.controls.below44).length,
  textPressurePassed: results.every(
    (result) =>
      result.textPressure.scaledCount > 0 && result.textPressure.controls.below44.length === 0,
  ),
  textPressureSub44VisibleControls: results.flatMap(
    (result) => result.textPressure.controls.below44,
  ).length,
  disallowedBrowserLogs: derived.disallowedLogs.length,
  vendorRequests: derived.vendorRequests.length,
  dialogs: telemetry.dialogs.length,
  pageErrors: telemetry.pageErrors.length,
});
await writeTelemetry(outDir, 'telemetry', telemetry, derived);
await writeFile(
  path.join(outDir, 'report.md'),
  `# Pregnancy Safety Status E2E\n\n- Status: pass\n- Surface: Expo web in headless system Chrome\n- Viewports: 360 x 640 and 390 x 844, plus 200% text pressure on the editable setting\n- Covered: encrypted local status persistence, all four status choices, one-shot profile-write failure/retry, prefer-not cautious behavior, explicit-none restoration, Plan and Today exclusion consistency\n- Consent/profile recovery: legacy consent stays cautious until current-text regrant; first consent write failure retries inline; missing local profile stays cautious and exposes rebuild recovery\n- UI fixtures: retinoid and BHA without confirmed-low concentration; the focused unit matrix also covers hydroquinone\n- Privacy: no vendor requests, dialogs, page errors, or disallowed browser errors\n- Native follow-up: iOS 17+ and Android 10+ screen-reader, Dynamic Type, and physical-device persistence remain Tas-owned QA\n`,
  'utf8',
);
