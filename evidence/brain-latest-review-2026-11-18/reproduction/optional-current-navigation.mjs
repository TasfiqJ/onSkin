// Local synthetic Expo-web evidence driver. No native or release qualification.
import assert from 'node:assert/strict';
import { spawn, execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { existsSync, mkdirSync, mkdtempSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { setTimeout as delay } from 'node:timers/promises';
import * as b from 'file:///[LOCAL_USER_HOME]/Documents/ChatGPT/MasterV2Code/c16-candidate/scripts/e2e/cat04-catalog-recovery-audit.mjs';

const repo = "[LOCAL_USER_HOME]\\Documents\\ChatGPT\\MasterV2Code\\c16-candidate";
const out = path.resolve(process.env.ONSKIN_CHANGE_EVIDENCE ?? path.join(repo, '../ENGINEERING21_EVIDENCE/optional-browser'));
mkdirSync(path.dirname(out), { recursive: true });
mkdirSync(out, { recursive: false }); // Preserve every prior run, including failures.
const browserPath = process.env.BROWSER_PATH ?? 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe';
assert(existsSync(browserPath), 'The existing local Edge browser is required.');
const draftKey = 'layerwell.optionalChangeDrafts.v1';
const sourceFiles = [
  'scripts/e2e/optional-change-drafts21.mjs',
  'apps/mobile/src/features/today/OptionalChangePanel41.tsx',
  'apps/mobile/src/features/today/OptionalChangeDraftInventory.tsx',
  'apps/mobile/src/features/today/optionalChangeDraftCodec.ts',
  'apps/mobile/src/features/today/optionalChangeDraftStore.ts',
  'apps/mobile/src/features/today/completionsStore.ts',
  'apps/mobile/src/features/today/optionalChange41.ts',
  'apps/mobile/src/features/today/optionalChangeJournal41.ts',
];
const git = (...args) => execFileSync('git', args, { cwd: repo, encoding: 'utf8', windowsHide: true }).trim();
const sha256 = bytes => createHash('sha256').update(bytes).digest('hex');
const appPort = await b.findAvailablePort(8500);
const debugPort = await b.findAvailablePort(9500);
const baseUrl = `http://localhost:${appPort}`;
const userDataDir = mkdtempSync(path.join(tmpdir(), '[TEMP_BROWSER_PROFILE]-'));
const receipt = {
  startedAt: new Date().toISOString(),
  surface: 'Actual local Expo web in Edge; synthetic local owner and storage only',
  head: git('rev-parse', 'HEAD'), tree: git('rev-parse', 'HEAD^{tree}'),
  status: git('status', '--porcelain=v1'),
  sourceSha256: Object.fromEntries(sourceFiles.map(file => [file, sha256(readFileSync(path.join(repo, file)))])),
  userDataDir, viewports: [], blockedRemoteRequests: [], pass: false,
  excluded: ['native builds and devices', 'real owners and provider services', 'hosted CI', 'paid operations', 'release acceptance'],
};
const json = (name, value) => writeFileSync(path.join(out, name), JSON.stringify(value, null, 2) + '\n');
const steps = [];
let server, browser, client, secondary;
const labels = {
  save: 'Save change draft on this device', inventory: 'Saved change drafts',
  saved: 'Draft saved on this device. Only this saved revision survives reload; no history event was recorded.',
  resume: 'Resume saved change draft', empty: 'No saved change drafts.',
  refresh: 'Refresh saved change drafts', back: 'Back to optional changes',
  discard: 'Review change draft discard', keep: 'Keep change draft', confirmDiscard: 'Confirm change draft discard',
};
function step(action, detail = '') {
  steps.push({ at: new Date().toISOString(), action, detail });
  console.log(action + (detail ? `: ${detail}` : ''));
}
async function capture(name, page = client) {
  const state = await b.evaluate(page, `({path:location.pathname,text:document.body.innerText,width:innerWidth,height:innerHeight,overflow:Math.max(0,document.documentElement.scrollWidth-innerWidth),inputs:[...document.querySelectorAll('input,textarea')].map(n=>({label:n.getAttribute('aria-label'),value:n.value})),choices:[...document.querySelectorAll('[role="radio"]')].map(n=>({label:n.getAttribute('aria-label'),checked:n.getAttribute('aria-checked')}))})`);
  json(name + '.json', state);
  const shot = await page.send('Page.captureScreenshot', { format: 'png', captureBeyondViewport: false });
  writeFileSync(path.join(out, name + '.png'), Buffer.from(shot.data, 'base64'));
  assert.equal(state.overflow, 0, 'Horizontal overflow');
  return state;
}
async function tap(label, page = client) {
  step('Activate control', label);
  await b.scrollControlIntoView(page, label);
  await b.clickByText(page, label);
}
async function tapContains(label) {
  step('Activate control containing', label);
  await b.scrollControlIntoView(client, label, { exact: false });
  await b.clickByText(client, label, { exact: false });
}
async function fill(label, value) {
  step('Enter synthetic value', label);
  await b.fillByLabel(client, label, value);
}
async function keyboard(label, height, page = client) {
  step('Keyboard activate control', label);
  await b.scrollControlIntoView(page, label);
  const geometry = await b.evaluate(page, `(()=>{const n=[...document.querySelectorAll('[role="button"],button')].filter(n=>n.getClientRects().length&&!n.closest('[aria-hidden="true"],[inert]')).find(n=>n.textContent.trim()===${JSON.stringify(label)}||n.getAttribute('aria-label')===${JSON.stringify(label)});if(!n)throw new Error('Missing visible control');n.focus();const r=n.getBoundingClientRect();return {focus:document.activeElement===n,w:r.width,h:r.height,y:r.y,hit:n.contains(document.elementFromPoint(r.x+r.width/2,r.y+r.height/2))}})()`);
  assert(geometry.focus && geometry.hit && geometry.h >= 44 && geometry.y >= 0 && geometry.y + geometry.h <= height, `${label} keyboard target must be visible and at least 44px high`);
  await page.send('Input.dispatchKeyEvent', { type: 'keyDown', key: 'Enter', code: 'Enter', windowsVirtualKeyCode: 13, text: '\r' });
  await page.send('Input.dispatchKeyEvent', { type: 'keyUp', key: 'Enter', code: 'Enter', windowsVirtualKeyCode: 13 });
  return geometry;
}
async function connect(width, height, url = baseUrl) {
  const page = await b.connectToPage(debugPort, url);
  for (const method of ['Page.enable', 'Runtime.enable', 'Network.enable', 'Log.enable']) await page.send(method);
  page.ws.addEventListener('message', event => {
    const message = JSON.parse(event.data);
    if (message.method !== 'Fetch.requestPaused') return;
    const { requestId, request } = message.params;
    const target = new URL(request.url);
    if (target.origin === baseUrl) {
      void page.send('Fetch.continueRequest', { requestId }).catch(() => {});
    } else {
      receipt.blockedRemoteRequests.push({ method: request.method, origin: target.origin });
      void page.send('Fetch.failRequest', { requestId, errorReason: 'BlockedByClient' }).catch(() => {});
    }
  });
  await page.send('Fetch.enable', { patterns: [{ urlPattern: 'http://*' }, { urlPattern: 'https://*' }] });
  await b.setViewport(page, { width, height });
  return page;
}
async function inventory() {
  await tap(labels.inventory);
  await b.waitForText(client, 'Unconfirmed factual notes, corrections and retractions saved on this device.');
}
async function inspectEncryptedDraft() {
  const raw = await b.evaluate(client, `localStorage.getItem(${JSON.stringify(draftKey)})`);
  assert(raw && raw.includes('purpose-bound:v2'), 'Draft must use purpose-bound ciphertext');
  assert(!raw.includes('Synthetic') && !raw.includes('correction'), 'Draft text must not be plaintext');
  return { bytes: Buffer.byteLength(raw), sha256: sha256(raw) };
}
async function closePage(page) {
  const id = (await page.send('Target.getTargetInfo')).targetInfo.targetId;
  await page.send('Target.closeTarget', { targetId: id }).catch(() => {});
  page.close();
}

// Keep the launcher incapable of inheriting configured external credentials.
for (const key of Object.keys(process.env)) {
  if (key.startsWith('EXPO_PUBLIC_') || /(TOKEN|SECRET|PASSWORD|CREDENTIAL|API_KEY|PRIVATE_KEY|ACCESS_KEY)/i.test(key)) delete process.env[key];
}
// Expo 57 does not derive this flag from CI/EXPO_OFFLINE. It disables the
// debugger-shell background dotslash fetch before middleware is constructed.
Object.assign(process.env, { EXPO_OFFLINE: '1', EXPO_UNSTABLE_HEADLESS: '1', EXPO_NO_DOTENV: '1', EXPO_NO_TELEMETRY: '1', TURBO_TELEMETRY_DISABLED: '1', CI: '1' });

// Read-only canonical inspection follows the existing optional-change41 driver.
// No UI action is replaced with an internal append, grant, seed, or correction.
const moduleExpression = `const mod = (suffix) => {
  const entry = [...__r.getModules().values()].find(m => (m.verboseName ?? '').replaceAll('\\\\', '/').endsWith(suffix));
  if (!entry?.publicModule?.exports) throw new Error('Missing loaded local observation module');
  return entry.publicModule.exports;
}; const store = mod('/features/today/completionsStore.ts'); const admission = mod('/lib/consent/healthDataWriteAdmission.ts');`;
async function readCanonical() {
  return b.evaluate(client, `(async()=>{${moduleExpression}
    const lease=admission.captureHealthDataWriteLease();
    const snapshot=await store.getOptionalChanges41(lease);
    const raw=await mod('/lib/storage/privateKV.ts').getPrivateItem('layerwell.completions.v1');
    const envelope=raw===null?null:JSON.parse(raw);
    const optionalBytes=envelope?.version===5?envelope.completionBytes:raw;
    const optional=optionalBytes===null?null:JSON.parse(optionalBytes);
    const coreBytes=optional?.version===4?optional.completionBytes:optionalBytes;
    const drafts=await mod('/features/today/optionalChangeDraftStore.ts').loadOptionalChangeDrafts(lease);
    admission.assertOriginalHealthDataWriteLease(lease);
    return {snapshot,owner:lease.ownerUserId,epoch:lease.epoch,coreBytes,version:envelope?.version??null,
      actual:envelope?.version===5?envelope.actualRoutine:null,drafts};})()`, true);
}
const canonicalReceipts = [];
async function canonicalReceipt(name) {
  const current = await readCanonical();
  canonicalReceipts.push({ name, at: new Date().toISOString(), version: current.version,
    ownerSha256: sha256(current.owner), epoch: current.epoch, revision: current.snapshot.revision,
    originalCompletionBytesSha256: sha256(current.coreBytes ?? ''), actualSha256: sha256(JSON.stringify(current.actual)),
    events: current.snapshot.events.map(({ id, contentHash, kind, category, text, targetEventId, observedOn, revision }) =>
      ({ id, contentHash, kind, category, text, targetEventId, observedOn, revision })),
    drafts: current.drafts.drafts.map(({ id, revision, contentHash, fields }) => ({ id, revision, contentHash, fields })),
  });
  json('canonical-readbacks.json', canonicalReceipts);
  return current;
}
function assertHistory(current, initial, expectedRevision) {
  assert.equal(current.owner, initial.owner);
  assert.equal(current.epoch, initial.epoch);
  assert.equal(current.snapshot.revision, expectedRevision);
  assert.equal(current.snapshot.events.length, expectedRevision);
  assert.equal(new Set(current.snapshot.events.map(event => event.id)).size, expectedRevision, 'No duplicate event IDs');
  assert.equal(current.coreBytes, initial.coreBytes, 'Optional records must preserve original completion bytes');
  assert.deepEqual(current.actual, initial.actual, 'Optional records must preserve actual routine history');
}
async function openPanel() {
  await b.waitForText(client, 'Record a change (optional)', 30_000);
  if (!await b.evaluate(client, `!!document.querySelector('[aria-label="Find recorded changes"]')`)) {
    await tap('Record a change (optional)');
    await b.waitForText(client, 'Your optional change notes');
  }
  await b.waitForCondition(client, b.enabledControlExpression('Record a change (optional)'), 30_000, 'current optional history');
}
async function reloadInventory() {
  await client.send('Page.reload'); await openPanel(); await inventory();
}
async function assertFreshReviewRequired() {
  assert(!await b.evaluate(client, b.enabledControlExpression('Confirm and save this change')), 'Recovered draft must require a fresh review');
}
async function startDraft(action, text, { category = 'Other personal note', observed = null } = {}) {
  await tap(action);
  if (category !== null) await tap(category);
  if (observed) await fill('Observed local date', observed);
  await fill(action.startsWith('Retract') ? 'Retraction reason' : 'Your factual note', text);
}
async function confirm(height) {
  await tap('Review this change');
  const geometry = await keyboard('Confirm and save this change', height);
  await b.waitForText(client, 'Saved on this device and read back.');
  return geometry;
}
async function finishFreeOnboarding(id) {
  // The optional panel depends on a confirmed profile and routine. Follow the
  // existing first-session browser journey; do not inject either source.
  await tapContains('Clear skin'); await tap('Continue');
  await b.waitForPath(client, '/onboarding/quiz');
  const answers = ['Shiny in places', 'Rarely', 'Often stings, burns, or reddens',
    'Frequently', 'Yes, noticeably', 'Weeks or longer', 'Fine lines or firmness changes are visible',
    'A lot over time', 'Sometimes burns', 'Tone 4', 'None that I know of', 'No'];
  for (const [index, answer] of answers.entries()) {
    await b.waitForText(client, answer); await tap(answer);
    await tap(index < answers.length - 1 ? 'Next' : 'See my profile');
  }
  await b.waitForText(client, "What's on your shelf?");
  await fill('Product name', 'Synthetic21 routine cleanser');
  if (await b.evaluate(client, b.enabledControlExpression('Choose product category'))) {
    await tapContains('Choose product category'); await b.waitForText(client, 'Product category');
  }
  await tap('Cleanser');
  await tap('Add to shelf'); await b.waitForText(client, 'When did you open it?');
  await tap('Just opened it'); await tap('Add to shelf'); await b.waitForText(client, 'Synthetic21 routine cleanser');
  await tap('Continue with 1 product'); await b.waitForText(client, 'YOUR SKIN PROFILE', 45_000);
  await tap('Continue'); await b.waitForPath(client, '/onboarding/notifications'); await tap('Not now');
  await b.waitForText(client, 'Reminders are off. Your choice was saved.'); await tap('Continue');
  await b.waitForPath(client, '/onboarding/account'); await tap('Not now');
  await b.waitForPath(client, '/onboarding/paywall'); await tapContains('Continue with the free plan');
  await b.waitForPath(client, '/today'); await capture(id + '-free-onboarding-today');
}

try {
  server = b.startExpoServer({ appPort, evidenceDir: out, group: { id: 'e21-optional-drafts', env: {
    EXPO_PUBLIC_E2E_FIRST_SESSION_AUTH: 'anonymous_owner', EXPO_PUBLIC_NATIVE_CAMERA_ENABLED: 'false',
  } } });
  browser = spawn(browserPath, ['--headless=new', `--remote-debugging-port=${debugPort}`, `--user-data-dir=${userDataDir}`,
    '--no-first-run', '--no-default-browser-check', '--disable-background-networking', '--disable-extensions', '--disable-sync',
    '--host-resolver-rules=MAP * ~NOTFOUND, EXCLUDE localhost, EXCLUDE 127.0.0.1', 'about:blank'], { stdio: 'ignore', windowsHide: true });
  json('owned-processes.json', { serverPid: server.pid, browserPid: browser.pid, appPort, debugPort });
  await b.waitForUrl(baseUrl);
  for (const [width, height] of [[375, 667], [390, 844], [430, 932]]) {
    client = await connect(width, height);
    const id = `${width}x${height}`;
    step('Start actual optional recovery journey', id);
    await client.send('Page.navigate', { url: baseUrl + '/?e2eReset=local' });
    await b.waitForText(client, 'Begin', 60_000); await tap('Begin');
    await b.waitForPath(client, '/onboarding/age');
    await fill('Day of birth', '01'); await fill('Month of birth', '01'); await fill('Year of birth', '1990');
    await tap('Continue'); await b.waitForPath(client, '/onboarding/consent');
    await tap('I agree. Continue'); await b.waitForPath(client, '/onboarding/goals');
    await b.waitForText(client, 'What brings you here?');
    await capture(id + '-adult-consent');
    await finishFreeOnboarding(id);
    await client.send('Page.navigate', { url: baseUrl + '/today?routine=AM' });
    await openPanel(); await b.waitForText(client, 'Nothing recorded');
    await inventory(); await b.waitForText(client, labels.empty); await capture(id + '-empty-inventory');
    const initial = await canonicalReceipt(id + '-initial');
    assertHistory(initial, initial, 0);
    await tap(labels.back);

    const noteText = '  Synthetic21: I used my usual cleanser.\nOriginal wording retained.  ';
    await startDraft('Record a change (optional)', noteText, { observed: '2026-10-01' });
    const saveGeometry = await keyboard(labels.save, height);
    await b.waitForText(client, labels.saved); await capture(id + '-note-saved');
    const noteSaved = await canonicalReceipt(id + '-note-draft');
    assertHistory(noteSaved, initial, 0);
    assert.equal(noteSaved.drafts.drafts.length, 1);
    assert.equal(noteSaved.drafts.drafts[0].fields.text, noteText);
    const noteId = noteSaved.drafts.drafts[0].fields.eventId;
    const noteCiphertext = await inspectEncryptedDraft();
    await fill('Your factual note', 'Unsaved later synthetic note edit.');
    await b.waitForText(client, 'Unsaved changes'); await capture(id + '-note-unsaved');
    await reloadInventory(); await b.waitForText(client, 'Original wording retained.');
    assert(!await b.evaluate(client, `document.body.innerText.includes('Unsaved later synthetic note edit.')`));
    await tap(labels.resume); await b.waitForInputValue(client, 'Your factual note', noteText);
    await b.waitForInputValue(client, 'Observed local date', '2026-10-01');
    await assertFreshReviewRequired(); await capture(id + '-note-resumed-original');
    assertHistory(await canonicalReceipt(id + '-note-before-confirm'), initial, 0);
    const confirmGeometry = await confirm(height);
    const noted = await canonicalReceipt(id + '-note-recorded');
    assertHistory(noted, initial, 1);
    assert.equal(noted.snapshot.events[0].id, noteId);
    assert.equal(noted.snapshot.events[0].text, noteText);
    assert.equal(noted.drafts.drafts.length, 0, 'Confirmed exact draft must retire');
    const original = noted.snapshot.events[0];
    await client.send('Page.reload'); await openPanel();
    assertHistory(await canonicalReceipt(id + '-note-reloaded-once'), initial, 1);

    // A separate explicit note advances history while a correction stays saved.
    // Recovery must preserve its target and require an explicit refresh/review.
    const correctionText = 'Synthetic21 correction: I used less cleanser that day.';
    await startDraft('Correct entry 1', correctionText);
    await tap(labels.save); await b.waitForText(client, labels.saved);
    const correctionSaved = await canonicalReceipt(id + '-correction-draft');
    const correctionDraft = correctionSaved.drafts.drafts[0];
    assert.equal(correctionDraft.fields.targetEventId, original.id);
    assert.equal(correctionDraft.fields.targetContentHash, original.contentHash);
    await tap('Cancel draft');
    await startDraft('Record a change (optional)', 'Synthetic21 later factual note reviewed separately.');
    await confirm(height);
    assertHistory(await canonicalReceipt(id + '-intervening-note'), initial, 2);
    await reloadInventory(); await b.waitForText(client, correctionText); await capture(id + '-correction-inventory');
    await tap(labels.resume); await b.waitForInputValue(client, 'Your factual note', correctionText);
    await b.waitForText(client, 'History changed since this draft was saved.');
    assert(!await b.evaluate(client, b.enabledControlExpression('Review this change')));
    await assertFreshReviewRequired(); await capture(id + '-history-conflict-kept');
    const conflicted = await canonicalReceipt(id + '-history-conflict');
    assertHistory(conflicted, initial, 2);
    assert.deepEqual(conflicted.drafts.drafts[0], correctionDraft, 'Reopening must not silently refresh a saved draft');
    await keyboard('Refresh changes', height);
    await b.waitForText(client, 'Draft kept. Current history was read. Review your change again');
    await assertFreshReviewRequired();
    const refreshed = await canonicalReceipt(id + '-explicit-refresh');
    assert.equal(refreshed.drafts.drafts[0].fields.targetEventId, original.id);
    assert.equal(refreshed.drafts.drafts[0].fields.targetContentHash, original.contentHash);
    assert.equal(refreshed.drafts.drafts[0].fields.text, correctionText);
    await confirm(height);
    const corrected = await canonicalReceipt(id + '-correction-recorded');
    assertHistory(corrected, initial, 3);
    assert.deepEqual(corrected.snapshot.events[0], original);
    assert.equal(corrected.snapshot.events[2].targetEventId, original.id);
    assert.equal(corrected.snapshot.events[2].id, correctionDraft.fields.eventId);
    assert.equal(corrected.snapshot.events[2].text, correctionText);
    assert.equal(corrected.drafts.drafts.length, 0);

    const reason = 'Synthetic21 retraction reason: I no longer stand by that correction.';
    await startDraft('Retract entry 3', reason, { category: null });
    await tap(labels.save); await b.waitForText(client, labels.saved);
    const retractionSaved = await canonicalReceipt(id + '-retraction-draft');
    const retractionDraft = retractionSaved.drafts.drafts[0];
    assert.equal(retractionDraft.fields.targetEventId, corrected.snapshot.events[2].id);
    assert.equal(retractionDraft.fields.targetContentHash, corrected.snapshot.events[2].contentHash);
    await reloadInventory(); await tap(labels.resume);
    await b.waitForInputValue(client, 'Retraction reason', reason);
    await b.waitForInputValue(client, 'Observed local date', '2026-10-01');
    await assertFreshReviewRequired(); await capture(id + '-retraction-resumed-original');
    assertHistory(await canonicalReceipt(id + '-retraction-before-confirm'), initial, 3);
    await confirm(height);
    const retracted = await canonicalReceipt(id + '-retraction-recorded');
    assertHistory(retracted, initial, 4);
    assert.equal(retracted.snapshot.events[3].id, retractionDraft.fields.eventId);
    assert.equal(retracted.snapshot.events[3].targetEventId, corrected.snapshot.events[2].id);
    assert.equal(retracted.snapshot.events[3].category, 'personal_note');
    assert.equal(retracted.snapshot.events[3].text, reason);
    assert.deepEqual(retracted.snapshot.events.slice(0, 3), corrected.snapshot.events);
    assert.equal(retracted.drafts.drafts.length, 0);
    await capture(id + '-retained-correction-retraction');

    const laterCorrection = 'Synthetic21 deliberate correction of the earlier retained original.';
    await startDraft('Correct entry 1', laterCorrection);
    await tap(labels.save); await b.waitForText(client, labels.saved);
    await reloadInventory(); await tap(labels.resume);
    await b.waitForInputValue(client, 'Your factual note', laterCorrection);
    await assertFreshReviewRequired(); await confirm(height);
    const earlierCorrected = await canonicalReceipt(id + '-earlier-retained-correction');
    assertHistory(earlierCorrected, initial, 5);
    assert.equal(earlierCorrected.snapshot.events[4].targetEventId, original.id);
    assert.deepEqual(earlierCorrected.snapshot.events.slice(0, 4), retracted.snapshot.events);
    assert.equal(earlierCorrected.drafts.drafts.length, 0);

    await startDraft('Record a change (optional)', 'Synthetic21 draft selected for explicit discard.');
    await tap(labels.save); await b.waitForText(client, labels.saved); await tap('Cancel draft');
    await inventory(); await tap(labels.discard); await tap(labels.keep);
    await tap(labels.discard); const discardGeometry = await keyboard(labels.confirmDiscard, height);
    await b.waitForText(client, labels.empty); await capture(id + '-draft-discarded');
    assertHistory(await canonicalReceipt(id + '-after-discard'), initial, 5);

    await b.evaluate(client, `(()=>{globalThis.__changeOriginalGet=Storage.prototype.getItem;Storage.prototype.getItem=function(key){if(key===${JSON.stringify(draftKey)})throw new Error('SYNTHETIC_SOURCE_UNAVAILABLE');return globalThis.__changeOriginalGet.call(this,key)}})()`);
    await tap(labels.refresh); await b.waitForText(client, 'Saved change draft storage is unavailable or unreadable.');
    assert(!await b.evaluate(client, `document.body.innerText.includes(${JSON.stringify(labels.empty)})`));
    await capture(id + '-unavailable-storage');
    await b.evaluate(client, `Storage.prototype.getItem=globalThis.__changeOriginalGet;delete globalThis.__changeOriginalGet`);
    await keyboard(labels.refresh, height); await b.waitForText(client, labels.empty);
    const unsupported = await b.evaluate(client, `(()=>{const key=${JSON.stringify(draftKey)};globalThis.__changeOriginalBytes=localStorage.getItem(key);const row=JSON.parse(globalThis.__changeOriginalBytes);row.version='xchacha20poly1305:purpose-bound:v999';const value=JSON.stringify(row);localStorage.setItem(key,value);return value})()`);
    await tap(labels.refresh); await b.waitForText(client, 'Saved change data is unsupported or invalid.');
    assert.equal(await b.evaluate(client, `localStorage.getItem(${JSON.stringify(draftKey)})`), unsupported);
    assert(!await b.evaluate(client, `document.body.innerText.includes(${JSON.stringify(labels.empty)})`));
    await capture(id + '-unsupported-storage');
    await b.evaluate(client, `localStorage.setItem(${JSON.stringify(draftKey)},globalThis.__changeOriginalBytes);delete globalThis.__changeOriginalBytes`);
    await tap(labels.refresh); await b.waitForText(client, labels.empty);
    await capture(id + '-storage-recovered');
    const final = await canonicalReceipt(id + '-final');
    assertHistory(final, initial, 5);
    assert.deepEqual(final.snapshot.events, earlierCorrected.snapshot.events);
    const requests = client.events.filter(event => event.method === 'Network.requestWillBeSent').map(event => event.params.request);
    for (const request of requests) for (const privateText of [noteText, correctionText, reason, laterCorrection]) {
      assert(!String(request.postData ?? '').includes(privateText) && !request.url.includes(encodeURIComponent(privateText)), 'Optional text must not enter network requests');
    }
    const network = requests.map(request => ({ method: request.method, url: request.url.split('?')[0], hasBody: Boolean(request.postData) }));
    json(id + '-network.json', network);
    assert(network.every(request => new URL(request.url).origin === baseUrl));
    assert.equal(receipt.blockedRemoteRequests.length, 0);
    json(id + '-console.json', client.events.filter(event => ['Runtime.consoleAPICalled', 'Runtime.exceptionThrown', 'Log.entryAdded'].includes(event.method)));
    receipt.viewports.push({ width, height, explicitAgeConsent: true, noteCiphertext, originalTextRecovered: true,
      unsavedEditNotRestored: true, notesCorrectionsRetractionsRecovered: true, explicitRefreshAndReviewRequired: true,
      exactTargetsPreserved: true, earlierRetainedEventCorrectionAllowed: true, noDuplicateEventId: true,
      originalCompletionAndActualRoutineUnchanged: true, savedDraftsRetiredAfterCanonicalReadback: true,
      discardReviewCancelConfirm: true, unavailableAndUnsupportedNeverEmpty: true, saveGeometry, confirmGeometry, discardGeometry });
    await closePage(client); client = undefined;
  }
  receipt.pass = true;
  step('PASS optional change recovery journeys', '375x667, 390x844, 430x932');
} catch (error) {
  receipt.error = error instanceof Error ? error.message : String(error);
  if (client) await capture('FAILURE').catch(() => {});
  throw error;
} finally {
  receipt.endedAt = new Date().toISOString(); json('summary.json', receipt); json('steps.json', steps);
  client?.close(); secondary?.close();
  await b.stopProcessBestEffort(browser); await b.stopProcessBestEffort(server);
}
