// E25 local synthetic Expo-web driver. Existing installed Node/Edge only.
import assert from 'node:assert/strict';
import { spawn, execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { existsSync, mkdirSync, mkdtempSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { setTimeout as delay } from 'node:timers/promises';
import * as b from '../c16-candidate/scripts/e2e/cat04-catalog-recovery-audit.mjs';

const evidence = path.dirname(fileURLToPath(import.meta.url));
const repo = path.resolve(evidence, '../c16-candidate');
const out = path.resolve(process.env.ONSKIN_RECOVERY_EVIDENCE ?? path.join(evidence, 'browser-r1'));
mkdirSync(out, { recursive: false }); // Never overwrite a prior run.
const browserPath = 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe';
assert(existsSync(browserPath), 'Installed local Edge required; no download fallback.');
const appPort = await b.findAvailablePort(8500), debugPort = await b.findAvailablePort(9500);
const baseUrl = `http://localhost:${appPort}`;
const userDataDir = mkdtempSync(path.join(tmpdir(), '[TEMP_BROWSER_PROFILE]-'));
const git = (...args) => execFileSync('git', args, { cwd: repo, encoding: 'utf8', windowsHide: true }).trim();
const sha = bytes => createHash('sha256').update(bytes).digest('hex');
const sourceFiles = ['apps/mobile/src/features/retainedRecovery/localEvidence.ts',
  'apps/mobile/src/features/retainedRecovery/LocalRecoverySection.tsx',
  'apps/mobile/src/lib/storage/privateKV.ts', 'apps/mobile/src/lib/storage/privateKVContentKey.ts'];
const receipt = { startedAt: new Date().toISOString(), head: git('rev-parse', 'HEAD'),
  tree: git('rev-parse', 'HEAD^{tree}'), status: git('status', '--porcelain=v1'),
  sourceSha256: Object.fromEntries(sourceFiles.map(name => [name, sha(readFileSync(path.join(repo, name)))])),
  surface: 'Actual local Expo web in installed Edge, fresh synthetic owner/profile only',
  userDataDir, viewports: [], blockedRemoteRequests: [], pass: false,
  limits: ['No native or device qualification', 'No provider or real private data', 'No acceptance or release qualification'] };
const rows = ['Shelf', 'Today check-offs', 'Reminder choices', 'Photo cleanup', 'Manual intake drafts', 'Optional change drafts'];
const privateMarkers = ['E25 PRIVATE MANUAL', 'E25 PRIVATE BRAND', 'E25 PRIVATE INGREDIENT', 'E25 PRIVATE NOTE'];
const manualKey = 'layerwell.manualIntakeDrafts.v1', optionalKey = 'layerwell.optionalChangeDrafts.v1';
const json = (name, value) => writeFileSync(path.join(out, name), JSON.stringify(value, null, 2) + '\n');
const steps = [];
let server, browser, client;
function step(action, detail = '') { steps.push({ at: new Date().toISOString(), action, detail }); console.log(action + (detail ? ': ' + detail : '')); }
async function tap(label, exact = true) { step('Activate control', label); await b.scrollControlIntoView(client, label, { exact }); await b.clickByText(client, label, { exact }); }
async function fill(label, value) { step('Enter synthetic fixture', label); await b.fillByLabel(client, label, value); }
async function navigate(route) { await client.send('Page.navigate', { url: baseUrl + route }); await b.waitForPath(client, route.split('?')[0]); }
const rowExpression = title => `(()=>{const n=document.querySelector('[aria-label='+${JSON.stringify(JSON.stringify('Check ' + title + ' again'))}+']');return n?.parentElement?.innerText??null})()`;
async function waitRow(title, status) { await b.waitForCondition(client, `(${rowExpression(title)})?.includes(${JSON.stringify(status)})`, 30_000, `${title} ${status}`); }
async function keyboard(label, height) {
  await b.scrollControlIntoView(client, label);
  const geometry = await b.evaluate(client, `(()=>{const n=[...document.querySelectorAll('[role="button"],button,a')].filter(n=>n.getClientRects().length&&!n.closest('[aria-hidden="true"],[inert]')).find(n=>n.getAttribute('aria-label')===${JSON.stringify(label)}||n.textContent.trim()===${JSON.stringify(label)});if(!n)throw new Error('Missing visible control');n.focus();const r=n.getBoundingClientRect();return {focus:document.activeElement===n,w:r.width,h:r.height,y:r.y,hit:n.contains(document.elementFromPoint(r.x+r.width/2,r.y+r.height/2))}})()`);
  assert(geometry.focus && geometry.hit && geometry.h >= 48 && geometry.y >= 0 && geometry.y + geometry.h <= height,
    `${label} must be keyboard reachable and at least 48px high`);
  await client.send('Input.dispatchKeyEvent', { type: 'keyDown', key: 'Enter', code: 'Enter', windowsVirtualKeyCode: 13, text: '\r' });
  await client.send('Input.dispatchKeyEvent', { type: 'keyUp', key: 'Enter', code: 'Enter', windowsVirtualKeyCode: 13 });
  return geometry;
}
async function connect(width, height) {
  client = await b.connectToPage(debugPort, baseUrl);
  for (const method of ['Page.enable', 'Runtime.enable', 'Network.enable', 'Log.enable', 'Accessibility.enable']) await client.send(method);
  client.ws.addEventListener('message', event => {
    const message = JSON.parse(event.data);
    if (message.method !== 'Fetch.requestPaused') return;
    const { requestId, request } = message.params, target = new URL(request.url);
    if (target.origin === baseUrl) void client.send('Fetch.continueRequest', { requestId }).catch(() => {});
    else { receipt.blockedRemoteRequests.push({ method: request.method, origin: target.origin }); void client.send('Fetch.failRequest', { requestId, errorReason: 'BlockedByClient' }).catch(() => {}); }
  });
  await client.send('Fetch.enable', { patterns: [{ urlPattern: 'http://*' }, { urlPattern: 'https://*' }] });
  await b.setViewport(client, { width, height });
}
async function onboarding() {
  await navigate('/?e2eReset=local'); await b.waitForText(client, 'Begin', 60_000); await tap('Begin');
  await b.waitForPath(client, '/onboarding/age');
  await fill('Day of birth', '01'); await fill('Month of birth', '01'); await fill('Year of birth', '1990');
  await tap('Continue'); await b.waitForPath(client, '/onboarding/consent');
  await tap('I agree. Continue'); await b.waitForPath(client, '/onboarding/goals');
  await b.waitForText(client, 'What brings you here?'); await tap('Clear skin', false); await tap('Continue');
  await b.waitForPath(client, '/onboarding/quiz');
  const answers = ['Shiny in places', 'Rarely', 'Often stings, burns, or reddens', 'Frequently', 'Yes, noticeably',
    'Weeks or longer', 'Fine lines or firmness changes are visible', 'A lot over time', 'Sometimes burns',
    'Tone 4', 'None that I know of', 'No'];
  for (const [index, answer] of answers.entries()) { await b.waitForText(client, answer); await tap(answer); await tap(index < answers.length - 1 ? 'Next' : 'See my profile'); }
  await b.waitForText(client, "What's on your shelf?"); await fill('Product name', 'Synthetic25 setup cleanser');
  if (await b.evaluate(client, b.enabledControlExpression('Choose product category'))) { await tap('Choose product category', false); await b.waitForText(client, 'Product category'); }
  await tap('Cleanser'); await tap('Add to shelf'); await b.waitForText(client, 'When did you open it?');
  await tap('Just opened it'); await tap('Add to shelf'); await b.waitForText(client, 'Synthetic25 setup cleanser');
  await tap('Continue with 1 product'); await b.waitForText(client, 'YOUR SKIN PROFILE', 45_000);
  await tap('Continue'); await b.waitForPath(client, '/onboarding/notifications'); await tap('Not now');
  await b.waitForText(client, 'Reminders are off. Your choice was saved.'); await tap('Continue');
  await b.waitForPath(client, '/onboarding/account'); await tap('Not now');
  await b.waitForPath(client, '/onboarding/paywall'); await tap('Continue with the free plan', false); await b.waitForPath(client, '/today');
}
async function openRecovery(navigateFirst = true) {
  if (navigateFirst) await navigate('/you');
  await b.waitForText(client, 'Local recovery');
  if (!await b.evaluate(client, `!!document.querySelector('[aria-label="Close local recovery"]')`)) await tap('Local recovery');
  for (const title of rows) await b.waitForCondition(client, `${rowExpression(title)}!==null&&!(${rowExpression(title)}).includes('Checking device.')`, 30_000, 'settled recovery ' + title);
}
async function overview(name, screenshotRows = true) {
  const state = await b.evaluate(client, `(()=>{const close=document.querySelector('[aria-label="Close local recovery"]');const root=close?.parentElement?.parentElement;if(!root)throw new Error('Local recovery is not open');const rows=${JSON.stringify(rows)}.map(title=>{const button=document.querySelector('[aria-label="Check '+title+' again"]');const r=button.parentElement;return {title,text:r.innerText,live:[...r.querySelectorAll('[aria-live]')].map(n=>({live:n.getAttribute('aria-live'),role:n.getAttribute('role'),text:n.innerText})),buttons:[...r.querySelectorAll('[role="button"],button')].map(n=>({name:n.getAttribute('aria-label'),role:n.getAttribute('role'),height:n.getBoundingClientRect().height}))}});return {path:location.pathname,width:innerWidth,height:innerHeight,overflow:Math.max(0,document.documentElement.scrollWidth-innerWidth),text:root.innerText,domText:root.textContent,accessibility:[...root.querySelectorAll('[aria-label]')].map(n=>n.getAttribute('aria-label')),rows}})()`);
  assert.equal(state.overflow, 0, 'No horizontal overflow');
  for (const marker of privateMarkers) assert(!JSON.stringify(state).includes(marker), 'Private fixture content must not enter overview DOM or accessibility');
  assert(!/layerwell\.|PRIVATE_KV_|synthetic-recovery|ownerUserId|eventId|contentHash/.test(JSON.stringify(state)), 'No internal paths, IDs or raw errors');
  for (const row of state.rows) { assert(row.live.some(live => live.live === 'polite'), 'Understandable polite live status'); assert(row.buttons.every(button => button.name && button.height >= 48), 'Named 48px row controls'); }
  json(name + '.json', state);
  if (screenshotRows) for (const title of rows) {
    const rect = await b.evaluate(client, `(()=>{const r=document.querySelector('[aria-label="Check '+${JSON.stringify(title)}+' again"]').parentElement;r.scrollIntoView({block:'center'});const b=r.getBoundingClientRect();return{x:b.x,y:b.y,width:b.width,height:b.height,scale:1}})()`);
    assert(rect.y >= 0 && rect.y + rect.height <= state.height && rect.width <= state.width, 'Entire generic row scrolls into view');
    const shot = await client.send('Page.captureScreenshot', { format: 'png', captureBeyondViewport: false, clip: rect });
    writeFileSync(path.join(out, name + '-' + title.toLowerCase().replaceAll(' ', '-') + '.png'), Buffer.from(shot.data, 'base64'));
  }
  return state;
}
async function savedFixtureDrafts(height) {
  await navigate('/shelf'); await b.waitForText(client, 'Add a product'); await tap('Add a product'); await b.waitForText(client, 'Add by hand');
  await fill('Product name', privateMarkers[0]); await fill('Brand', privateMarkers[1]); await fill('Ingredients', privateMarkers[2]);
  await keyboard('Save intake draft on this device', height); await b.waitForText(client, 'Saved on this device. Only this saved revision survives a reload.');
  await navigate('/today?routine=AM'); await b.waitForText(client, 'Record a change (optional)'); await tap('Record a change (optional)');
  await b.waitForText(client, 'Your optional change notes'); await tap('Record a change (optional)'); await tap('Other personal note');
  await fill('Your factual note', privateMarkers[3]); await keyboard('Save change draft on this device', height);
  await b.waitForText(client, 'Draft saved on this device. Only this saved revision survives reload; no history event was recorded.');
}
async function installReadMonitor() {
  await b.evaluate(client, `(()=>{const p=Storage.prototype;const get=p.getItem,set=p.setItem,remove=p.removeItem,clear=p.clear;window.__e25Monitor={writes:[],failKey:null,original:{get,set,remove,clear}};p.getItem=function(key){if(key===window.__e25Monitor.failKey)throw new Error('SYNTHETIC_E25_UNAVAILABLE');return get.call(this,key)};p.setItem=function(key,value){window.__e25Monitor.writes.push({method:'set',key});return set.call(this,key,value)};p.removeItem=function(key){window.__e25Monitor.writes.push({method:'remove',key});return remove.call(this,key)};p.clear=function(){window.__e25Monitor.writes.push({method:'clear'});return clear.call(this)}})()`);
}
async function checkNoWrites(name) { const calls = await b.evaluate(client, `window.__e25Monitor.writes`); json(name, calls); assert.deepEqual(calls, [], 'Status inspection must not mutate any storage/key'); }

for (const key of Object.keys(process.env)) if (key.startsWith('EXPO_PUBLIC_') || /(TOKEN|SECRET|PASSWORD|CREDENTIAL|API_KEY|PRIVATE_KEY|ACCESS_KEY)/i.test(key)) delete process.env[key];
Object.assign(process.env, { EXPO_OFFLINE: '1', EXPO_UNSTABLE_HEADLESS: '1', EXPO_NO_DOTENV: '1', EXPO_NO_TELEMETRY: '1', TURBO_TELEMETRY_DISABLED: '1', CI: '1' });
try {
  server = b.startExpoServer({ appPort, evidenceDir: out, group: { id: 'e25-local-recovery', env: { EXPO_PUBLIC_E2E_FIRST_SESSION_AUTH: 'anonymous_owner', EXPO_PUBLIC_NATIVE_CAMERA_ENABLED: 'false' } } });
  browser = spawn(browserPath, ['--headless=new', `--remote-debugging-port=${debugPort}`, `--user-data-dir=${userDataDir}`, '--no-first-run', '--no-default-browser-check', '--disable-background-networking', '--disable-extensions', '--disable-sync', '--host-resolver-rules=MAP * ~NOTFOUND, EXCLUDE localhost, EXCLUDE 127.0.0.1', 'about:blank'], { stdio: 'ignore', windowsHide: true });
  json('owned-processes.json', { serverPid: server.pid, browserPid: browser.pid, appPort, debugPort });
  await b.waitForUrl(baseUrl);
  for (const [width, height] of [[375, 667], [390, 844], [430, 932]]) {
    await connect(width, height); const id = `${width}x${height}`; step('Start recovery journey', id);
    await onboarding(); await openRecovery(); await waitRow('Manual intake drafts', 'Not configured'); await waitRow('Optional change drafts', 'Not configured');
    await overview(id + '-empty-drafts');
    await savedFixtureDrafts(height); await openRecovery(); await waitRow('Manual intake drafts', 'Saved on this device'); await waitRow('Optional change drafts', 'Saved on this device');
    await overview(id + '-saved-drafts'); await installReadMonitor();
    const geometry = {};
    for (const title of rows) { geometry[title] = await keyboard('Check ' + title + ' again', height); await b.waitForCondition(client, `!(${rowExpression(title)}).includes('Checking device.')`, 30_000, 'explicit retry settled'); }
    await checkNoWrites(id + '-check-again-zero-writes.json');
    await b.evaluate(client, `window.__e25Monitor.failKey=${JSON.stringify(manualKey)}`); await keyboard('Check Manual intake drafts again', height); await waitRow('Manual intake drafts', 'Unavailable'); await waitRow('Optional change drafts', 'Saved on this device');
    assert((await b.evaluate(client, rowExpression('Manual intake drafts'))).includes('Nothing was reset'));
    await overview(id + '-manual-unavailable'); await checkNoWrites(id + '-manual-unavailable-zero-writes.json');
    await b.evaluate(client, `window.__e25Monitor.failKey=${JSON.stringify(optionalKey)}`); await keyboard('Check Manual intake drafts again', height); await waitRow('Manual intake drafts', 'Saved on this device'); await keyboard('Check Optional change drafts again', height); await waitRow('Optional change drafts', 'Unavailable');
    await overview(id + '-optional-unavailable'); await checkNoWrites(id + '-optional-unavailable-zero-writes.json');
    await b.evaluate(client, `window.__e25Monitor.failKey=null`); await keyboard('Check Optional change drafts again', height); await waitRow('Optional change drafts', 'Saved on this device');
    geometry.manualLink = await keyboard('Open saved manual intake drafts', height); await b.waitForPath(client, '/shelf/intake-drafts'); await b.waitForText(client, 'Saved intake drafts'); await b.waitForText(client, 'Resume saved intake draft');
    await tap('Back to Shelf'); await b.waitForPath(client, '/shelf'); await tap('You'); await b.waitForPath(client, '/you'); await openRecovery(false); await waitRow('Manual intake drafts', 'Saved on this device');
    geometry.optionalLink = await keyboard('Open Today for saved change drafts', height); await b.waitForPath(client, '/today'); await b.waitForText(client, 'Record a change (optional)'); await tap('Record a change (optional)'); await b.waitForText(client, 'Your optional change notes'); await tap('Saved change drafts'); await b.waitForText(client, 'Resume saved change draft');
    await tap('You'); await b.waitForPath(client, '/you'); await openRecovery(false); await waitRow('Optional change drafts', 'Saved on this device'); await overview(id + '-returned-overview');
    const network = client.events.filter(e => e.method === 'Network.requestWillBeSent').map(e => ({ method: e.params.request.method, url: e.params.request.url.split('?')[0] }));
    json(id + '-network.json', network); assert(network.every(request => new URL(request.url).origin === baseUrl), 'Only localhost requests');
    json(id + '-console.json', client.events.filter(e => ['Runtime.consoleAPICalled', 'Runtime.exceptionThrown', 'Log.entryAdded'].includes(e.method)));
    json(id + '-geometry.json', geometry);
    receipt.viewports.push({ width, height, pass: true, sixRowsReachable: true, genericStatusesOnly: true, emptyAndSavedDrafts: true,
      independentUnavailableAndRetry: true, noStorageWritesOnInspection: true, bothExistingInventoryRoutes: true,
      returnRefresh: true, keyboardTargetsAtLeast48px: true, noHorizontalOverflow: true, privateOverviewDisclosure: false });
    const target = (await client.send('Target.getTargetInfo')).targetInfo.targetId;
    await client.send('Target.closeTarget', { targetId: target }); client.close(); client = undefined;
  }
  assert.equal(receipt.blockedRemoteRequests.length, 0, 'No external request should be attempted'); receipt.pass = true; step('PASS all recovery viewports');
} catch (error) {
  receipt.error = error instanceof Error ? error.message : String(error);
  if (client) { receipt.failurePath = await b.evaluate(client, 'location.pathname').catch(() => 'unknown'); if (receipt.failurePath === '/you') await overview('FAILURE', false).catch(() => {}); }
  throw error;
} finally {
  receipt.endedAt = new Date().toISOString(); json('summary.json', receipt); json('steps.json', steps);
  client?.close(); await b.stopProcessBestEffort(browser); await b.stopProcessBestEffort(server);
}
