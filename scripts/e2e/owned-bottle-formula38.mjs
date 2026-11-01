import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { setTimeout as delay } from 'node:timers/promises';

// The same selector is exercised in real Chrome DOM negatives and in Expo web.
// A match is never enough: the active exact control must own its visible hit.
export function formulaControlExpression38(label, { role = 'button', path, scroll = false } = {}) {
  return `(${formulaControlDocument38.toString()})(${JSON.stringify({ label, role, path, scroll })})`;
}

function formulaControlDocument38({ label, role, path, scroll }) {
  const normalize = (value) => String(value ?? '').replace(/\s+/g, ' ').trim();
  const box = (node) => {
    const r = node.getBoundingClientRect();
    return { left: r.left, right: r.right, top: r.top, bottom: r.bottom,
      width: r.width, height: r.height, x: r.left + r.width / 2, y: r.top + r.height / 2 };
  };
  const active = (node) => {
    for (let p = node; p; p = p.parentElement) {
      const s = getComputedStyle(p);
      if (p.hidden || p.hasAttribute('inert') || p.getAttribute('aria-hidden') === 'true' ||
        s.display === 'none' || ['hidden', 'collapse'].includes(s.visibility) ||
        Number(s.opacity || 1) <= 0 || s.pointerEvents === 'none') return false;
    }
    return true;
  };
  const describe = (node) => {
    const implicit = ['INPUT', 'TEXTAREA'].includes(node.tagName) ? 'textbox' : node.tagName === 'BUTTON' ? 'button' : null;
    return { role: node.getAttribute('role') || implicit,
      label: normalize(node.getAttribute('aria-label') || node.getAttribute('accessibilitylabel') || node.textContent),
      rect: box(node), disabled: node.disabled === true || node.getAttribute('aria-disabled') === 'true' };
  };
  const candidates = [...document.querySelectorAll('button,[role],input,textarea')]
    .filter((node) => { const d = describe(node); return d.role === role && d.label === label && active(node); });
  const node = candidates.length === 1 ? candidates[0] : null;
  if (node && scroll) node.scrollIntoView({ block: 'center', inline: 'nearest' });
  let target = null;
  if (node) {
    const d = describe(node), r = d.rect;
    const clip = { left: 0, top: 0, right: innerWidth, bottom: innerHeight };
    for (let p = node.parentElement; p; p = p.parentElement) {
      const s = getComputedStyle(p), b = box(p);
      if (/(auto|scroll|hidden|clip)/.test(s.overflowX)) {
        clip.left = Math.max(clip.left, b.left); clip.right = Math.min(clip.right, b.right);
      }
      if (/(auto|scroll|hidden|clip)/.test(s.overflowY)) {
        clip.top = Math.max(clip.top, b.top); clip.bottom = Math.min(clip.bottom, b.bottom);
      }
    }
    const hit = document.elementFromPoint(r.x, r.y);
    target = { ...d, clip, active: true, hitOwned: hit !== null && (node === hit || node.contains(hit)),
      hitRole: hit?.getAttribute('role') || null,
      fullyVisible: r.width >= 44 && r.height >= 44 && r.left >= clip.left && r.right <= clip.right &&
        r.top >= clip.top && r.bottom <= clip.bottom };
  }
  return { path: location.pathname, expectedPath: path, documentVisible: document.visibilityState === 'visible',
    requestedLabel: label, requestedRole: role, exactCandidates: candidates.length, target };
}

export function selectFormulaControl38(snapshot) {
  assert.equal(snapshot?.path, snapshot?.expectedPath, 'Formula control route is not current.');
  assert.equal(snapshot?.documentVisible, true, 'Formula document is not foreground.');
  assert.equal(snapshot?.exactCandidates, 1, 'Formula control needs exactly one active accessible match.');
  const target = snapshot.target;
  assert.ok(target?.active && target.role === snapshot.requestedRole && target.label === snapshot.requestedLabel,
    'Formula control accessible identity changed.');
  assert.equal(target.disabled, false, 'Formula control is disabled.');
  assert.ok(target.fullyVisible && target.hitOwned && Number.isFinite(target.rect?.x) && Number.isFinite(target.rect?.y),
    'Formula control is offscreen, clipped or occluded.');
  return target;
}

export function formulaMessageExpression38(text) {
  return `(${formulaMessageDocument38.toString()})(${JSON.stringify(text)})`;
}

function formulaMessageDocument38(text) {
  const matches = [...document.querySelectorAll('[role="alert"]')]
    .filter((node) => node.textContent.includes(text));
  if (matches.length !== 1) return { matches: matches.length, visible: false };
  const node = matches[0], r = node.getBoundingClientRect();
  let left = 0, top = 0, right = innerWidth, bottom = innerHeight, active = true;
  for (let p = node; p; p = p.parentElement) {
    const s = getComputedStyle(p), b = p.getBoundingClientRect();
    if (p.hidden || p.hasAttribute('inert') || p.getAttribute('aria-hidden') === 'true' ||
      s.display === 'none' || ['hidden', 'collapse'].includes(s.visibility) || Number(s.opacity || 1) <= 0) active = false;
    if (p !== node && /(auto|scroll|hidden|clip)/.test(s.overflowX)) { left = Math.max(left, b.left); right = Math.min(right, b.right); }
    if (p !== node && /(auto|scroll|hidden|clip)/.test(s.overflowY)) { top = Math.max(top, b.top); bottom = Math.min(bottom, b.bottom); }
  }
  const hit = document.elementFromPoint(r.left + r.width / 2, r.top + r.height / 2);
  return { matches: 1, text: node.textContent, rect: { left: r.left, top: r.top, width: r.width, height: r.height },
    visible: document.visibilityState === 'visible' && active && r.width > 0 && r.height > 0 &&
      r.left >= left && r.right <= right && r.top >= top && r.bottom <= bottom &&
      hit !== null && (hit === node || node.contains(hit)) };
}

export function assertFormulaMessageVisible38(receipt) {
  assert.equal(receipt?.matches, 1, 'Formula status needs exactly one accessible alert.');
  assert.equal(receipt?.visible, true, 'Formula status is offscreen, hidden, clipped or occluded.');
}

export async function touchFormulaControl38({ label, path, role = 'button', inspect, send, record, guard }) {
  await guard();
  await inspect(label, { role, path, scroll: true });
  await delay(180);
  await guard();
  const receipt = await inspect(label, { role, path });
  await record(receipt);
  const target = selectFormulaControl38(receipt);
  await send('Input.dispatchTouchEvent', { type: 'touchStart',
    touchPoints: [{ id: 1, force: 1, radiusX: 2, radiusY: 2, x: target.rect.x, y: target.rect.y }] });
  await send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
  await delay(200);
  return target;
}

export async function runOwnedBottleFormula38(io) {
  const { client, evaluate, waitForText, waitForCondition, captureStep, writeJson, readAuthority } = io;
  const sourcePaths = ['apps/mobile/src/features/shelf/formulaVersion38.ts',
    'apps/mobile/src/features/shelf/ownedBottleVersion38.ts', 'apps/mobile/src/features/shelf/store.ts',
    'apps/mobile/src/features/shelf/mutations.ts', 'apps/mobile/src/features/shelf/useShelf.ts',
    'apps/mobile/src/app/shelf/formula-history.tsx',
    'apps/mobile/src/app/shelf/[id].tsx', 'apps/mobile/src/app/shelf/_layout.tsx',
    'scripts/e2e/onboarding-first-session.mjs', 'scripts/e2e/owned-bottle-formula38.mjs'];
  const sourceHashes = () => Object.fromEntries(sourcePaths.map((file) =>
    [file, createHash('sha256').update(readFileSync(new URL('../../' + file, import.meta.url))).digest('hex')]));
  const sourceBefore = sourceHashes();
  writeJson('C38-source-hashes.json', { before: sourceBefore, after: null, stable: null });
  const before = await readAuthority();
  assert.equal(before.sameOwner, true);
  assert.equal(before.currentConsent, true);
  assert.equal(before.proActive, false);
  const product = before.productIds37?.filter((p) => p.name === 'Mineral SPF 50');
  assert.equal(product?.length, 1);
  const id = product[0].id, detailPath = '/shelf/' + id, historyPath = '/shelf/formula-history';
  let currentEpoch = before.authority37;
  const traces = [], startEvent = client.events.length;
  const guard = async () => {
    const current = await readAuthority();
    assert.equal(current.sameOwner, true);
    assert.equal(current.currentConsent, true);
    assert.equal(current.proActive, false);
    assert.deepEqual(current.authority37, currentEpoch);
    assert.ok(current.productIds37.some((p) => p.id === id && p.name === 'Mineral SPF 50'));
  };
  const touch = (label, path = historyPath, role = 'button') => touchFormulaControl38({ label, path, role,
    inspect: (name, options) => evaluate(client, formulaControlExpression38(name, options)),
    send: (method, params) => client.send(method, params), guard,
    record: (snapshot) => { traces.push(snapshot); writeJson('C38-control-hit-receipts.json', traces); } });
  const capture = (name) => captureStep(client, 'C38-' + name, { assertClean: false });
  const waitCurrent = () => waitForCondition(client, '/current bottle version/i.test(document.body.innerText)', 60_000, 'current bottle version heading');
  const messageReceipts = [];
  const waitMessage = async (text) => {
    await waitForText(client, text);
    const expression = formulaMessageExpression38(text);
    await waitForCondition(client, `(${expression}).visible === true`, 30_000, 'actually visible formula status alert');
    const receipt = await evaluate(client, expression);
    assertFormulaMessageVisible38(receipt);
    messageReceipts.push(receipt); writeJson('C38-visible-status-alerts.json', messageReceipts);
  };
  const field = async (label, value) => {
    await touch(label, historyPath, 'textbox');
    await client.send('Input.dispatchKeyEvent', { type: 'keyDown', key: 'a', code: 'KeyA', modifiers: 2, windowsVirtualKeyCode: 65 });
    await client.send('Input.dispatchKeyEvent', { type: 'keyUp', key: 'a', code: 'KeyA', modifiers: 2, windowsVirtualKeyCode: 65 });
    await client.send('Input.dispatchKeyEvent', { type: 'keyDown', key: 'Backspace', code: 'Backspace', windowsVirtualKeyCode: 8 });
    await client.send('Input.dispatchKeyEvent', { type: 'keyUp', key: 'Backspace', code: 'Backspace', windowsVirtualKeyCode: 8 });
    if (value) await client.send('Input.insertText', { text: value });
    await delay(150);
  };
  const moduleExpression = `const mod = (suffix) => {
    const m = [...__r.getModules().values()].find(m => (m.verboseName ?? '').replaceAll('\\\\', '/').endsWith(suffix));
    if (!m?.publicModule?.exports) throw new Error('Missing loaded synthetic observation module');
    return m.publicModule.exports;
  }; const store = mod('/features/shelf/store.ts');`;
  const readHistory = () => evaluate(client, `(async () => { ${moduleExpression}
    return store.loadOwnedBottleHistory38(${JSON.stringify(id)}); })()`, true);
  const receipts = {};
  const saveReceipt = async (name) => {
    const snapshot = await readHistory();
    assert.equal(snapshot.productId, id); assert.equal(snapshot.localOnly, true);
    receipts[name] = snapshot; writeJson('C38-history-readbacks.json', receipts); return snapshot;
  };
  const navigationAuthorities = [];
  const acceptNavigationAuthority = async (boundary, { relaunch = false } = {}) => {
    const current = await readAuthority();
    assert.equal(current.sameOwner, true); assert.equal(current.currentConsent, true); assert.equal(current.proActive, false);
    for (const field of ['ownerBinding', 'epoch']) {
      assert.equal(current.authority37[field], before.authority37[field], 'Navigation changed owner/consent identity: ' + field);
    }
    for (const field of ['accountGeneration', 'identityGeneration']) {
      assert.ok(Number.isSafeInteger(current.authority37[field]) && current.authority37[field] >= 0);
      // These are in-memory runtime counters, not persisted owner identity.
      // Only an actual Page.reload below may begin a fresh runtime counter.
      if (!relaunch) assert.equal(current.authority37[field], currentEpoch[field], 'In-process navigation changed runtime authority: ' + field);
    }
    assert.deepEqual(current.productIds37, before.productIds37);
    currentEpoch = current.authority37;
    navigationAuthorities.push({ boundary, relaunch, authority: currentEpoch, noPro:true });
    writeJson('C38-navigation-authority-readbacks.json', navigationAuthorities);
  };
  const returnToDetail = async (stage) => {
    await touch('Back');
    await waitForCondition(client, `location.pathname === ${JSON.stringify(detailPath)} || location.pathname === '/shelf'`,
      30_000, 'safe history Back after browser navigation');
    await acceptNavigationAuthority(stage + '-back');
    if (await evaluate(client, 'location.pathname') === '/shelf') {
      await waitForText(client, '3 products'); await capture(stage + '-safe-back-fallback-shelf');
      await io.tapOwnedShelfProduct37({ name:'Mineral SPF 50', expectedNames:before.products,
        inspect: (label) => evaluate(client, io.shelfTargetExpression37('Mineral SPF 50', { label })),
        scroll: async (label) => { const result = await evaluate(client, io.shelfTargetExpression37('Mineral SPF 50', { label, scroll:true }));
          await delay(350); return result; },
        readAuthority, send:(method,params)=>client.send(method,params),
        waitForDetail: async (path) => { await waitForCondition(client, `location.pathname === ${JSON.stringify(path)}`,
          30_000, 'same owned unit reopened by actual Shelf touch'); return evaluate(client, '({path:location.pathname})'); },
        record:(recoveryStage,value)=> { traces.push({ recoveryStage,value }); writeJson('C38-control-hit-receipts.json',traces); } });
    }
    await waitForCondition(client, `location.pathname === ${JSON.stringify(detailPath)}`, 30_000, 'same original owned product detail');
    await acceptNavigationAuthority(stage + '-detail');
  };
  const date = await evaluate(client, `(() => { const d = new Date(); return [d.getFullYear(),String(d.getMonth()+1).padStart(2,'0'),String(d.getDate()).padStart(2,'0')].join('-'); })()`);
  const labelOne = 'Aqua, Glycerin, Squalane.';
  const edit = async ({ labelText = labelOne, market = 'Canada', variant = 'Calm lotion 01', observed = date } = {}) => {
    await touch('Record label observation'); await touch('I have the printed label');
    await field('Ingredient label as printed', labelText);
    await field('Variant as printed', variant); await field('Market as printed', market);
    await field('Date observed (YYYY-MM-DD)', observed);
  };
  const confirm = async () => {
    await touch('Confirm this bottle observation');
    await waitMessage('Saved on this device and read back.');
    await guard();
  };
  await touch('Bottle & formula history', detailPath);
  await waitForCondition(client, `location.pathname === ${JSON.stringify(historyPath)}`, 30_000, 'formula history route');
  await waitCurrent();
  const unknown = await saveReceipt('initialUnknown');
  assert.equal(unknown.revision, 0); assert.equal(unknown.currentVersionId, null);
  assert.deepEqual(unknown.versions, []);
  await capture('01-current-unknown');

  await edit();
  const unsaved = await saveReceipt('draftIsNotConfirmation');
  assert.deepEqual(unsaved, unknown);
  await capture('02-draft-no-confirmation');
  await touch('Cancel draft');
  assert.deepEqual(await saveReceipt('cancelPreservesUnknown'), unknown);
  await capture('03-cancelled-unknown');

  await edit(); await confirm();
  const first = await saveReceipt('explicitFirstLabel');
  assert.equal(first.revision, 1); assert.equal(first.versions.length, 1);
  assert.equal(first.currentVersion.formulaVersion.labelStatus, 'user_confirmed_label');
  assert.equal(first.currentVersion.formulaVersion.labelText, labelOne);
  assert.equal(first.currentVersion.formulaVersion.market, 'Canada');
  assert.equal(first.currentVersion.formulaVersion.variant, 'Calm lotion 01');
  const firstVersion = first.currentVersion;
  await capture('04-confirmed-label-readback');

  const browserHistory = await client.send('Page.getNavigationHistory');
  assert.ok(browserHistory.currentIndex > 0, 'Browser has no actual preceding history entry.');
  const previousEntry = browserHistory.entries[browserHistory.currentIndex - 1];
  const currentEntry = browserHistory.entries[browserHistory.currentIndex];
  assert.equal(new URL(previousEntry.url).pathname, detailPath, 'Browser Back would not return to this owned product.');
  assert.equal(new URL(currentEntry.url).pathname, historyPath);
  await client.send('Page.navigateToHistoryEntry', { entryId: previousEntry.id });
  await waitForCondition(client, `location.pathname === ${JSON.stringify(detailPath)}`, 30_000, 'actual browser Back to owned unit');
  assert.deepEqual(await saveReceipt('browserBackDoesNotRewriteHistory'), first);
  await capture('05a-browser-back-to-owned-unit');
  await client.send('Page.navigateToHistoryEntry', { entryId: currentEntry.id });
  await waitForCondition(client, `location.pathname === ${JSON.stringify(historyPath)}`, 30_000, 'actual browser Forward to history');
  await waitCurrent();
  assert.deepEqual(await saveReceipt('browserForwardRestoresSameHistory'), first);
  await acceptNavigationAuthority('browser-back-forward-complete-no-draft');
  await capture('05b-browser-forward-history-persisted');
  writeJson('C38-browser-history-navigation.json', { browserBack: { entryId: previousEntry.id, path: detailPath },
    browserForward: { entryId: currentEntry.id, path: historyPath }, sameOwner: true, sameVersion: first.currentVersionId });

  await returnToDetail('05c');
  await touch('Bottle & formula history', detailPath);
  await waitCurrent();
  await acceptNavigationAuthority('app-back-and-reentry-no-draft');
  assert.deepEqual(await saveReceipt('afterBackAndReenter'), first);
  await capture('05-back-reenter-persisted');
  await client.send('Page.reload', { ignoreCache: false });
  await waitCurrent();
  await acceptNavigationAuthority('same-owner-page-reload-no-draft', { relaunch:true });
  assert.deepEqual(await saveReceipt('coldReloadSameOwner'), first);
  await capture('06-reloaded-local-history');

  await client.send('Network.emulateNetworkConditions', { offline: true, latency: 0, downloadThroughput: -1, uploadThroughput: -1 });
  try {
    await edit(); await capture('07-offline-explicit-draft'); await confirm();
    assert.deepEqual(await saveReceipt('offlineIdenticalConfirmationIsIdempotent'), first);
    await capture('08-offline-idempotent-readback');
    await touch('Record label observation'); await touch('Keep label unknown');
    await field('Variant as printed', 'Calm lotion 02');
    await field('Market as printed', 'United Kingdom');
    await field('Date observed (YYYY-MM-DD)', '');
    await capture('09-offline-deliberate-unknown'); await confirm();
  } finally {
    await client.send('Network.emulateNetworkConditions', { offline: false, latency: 0, downloadThroughput: -1, uploadThroughput: -1 });
  }
  const second = await saveReceipt('unknownAppendsNewVersion');
  assert.equal(second.revision, 2); assert.equal(second.versions.length, 2);
  assert.equal(second.currentVersion.formulaVersion.labelStatus, 'unknown');
  assert.equal(second.currentVersion.formulaVersion.labelText, null);
  assert.equal(second.currentVersion.previousVersionId, first.currentVersionId);
  assert.deepEqual(second.versions.find((version) => version.id === firstVersion.id), firstVersion);
  await capture('10-current-unknown-prior-label-retained');

  await edit({ labelText: 'Aqua, Glycerin, Panthenol.', variant: 'Calm lotion 03' });
  // Deliberate local synthetic storage fault. It is scoped only to this private
  // Shelf key; the original prototype is restored before any subsequent flow.
  await evaluate(client, `(() => {
    if (globalThis.__formula38SetItem) throw new Error('Fixture already installed');
    globalThis.__formula38SetItem = Storage.prototype.setItem;
    globalThis.__formula38StorageRefused = false;
    Storage.prototype.setItem = function(key, value) {
      if (key === 'layerwell.shelf.v1' && !globalThis.__formula38StorageRefused) {
        globalThis.__formula38StorageRefused = true;
        throw new DOMException('Synthetic formula38 storage refusal', 'QuotaExceededError');
      }
      return globalThis.__formula38SetItem.call(this, key, value);
    }; return true;
  })()`);
  try {
    await touch('Confirm this bottle observation');
    await waitMessage('Storage did not confirm this observation.');
    assert.equal(await evaluate(client, 'globalThis.__formula38StorageRefused'), true);
    assert.deepEqual(await saveReceipt('storageRefusalRetainsExactHistory'), second);
    await capture('11-storage-refusal-draft-retained');
  } finally {
    await evaluate(client, `(() => { Storage.prototype.setItem = globalThis.__formula38SetItem;
      delete globalThis.__formula38SetItem; delete globalThis.__formula38StorageRefused; return true; })()`);
  }
  await touch('Refresh history');
  await confirm();
  const third = await saveReceipt('explicitRetryAfterStorageFailure');
  assert.equal(third.revision, 3); assert.equal(third.versions.length, 3);
  assert.equal(third.currentVersion.formulaVersion.variant, 'Calm lotion 03');
  assert.deepEqual(third.versions.find((version) => version.id === firstVersion.id), firstVersion);
  await capture('12-storage-retry-confirmed');

  await edit({ labelText: 'Aqua, Sodium Hyaluronate.', variant: 'Outdated draft' });
  // Deliberate synthetic concurrent-screen fixture: use the real CAS mutation
  // under this same anonymous owner. This is an injected race, never a UI PASS.
  const concurrent = { productId: id, expectedUpdatedAt: third.productUpdatedAt,
    expectedProductIdentityHash: third.productIdentityHash, expectedRevision: third.revision,
    expectedCurrentVersionId: third.currentVersionId, confirmation: 'confirm_label',
    labelText: 'Aqua, Glycerin.', market: 'Canada', variant: 'Concurrent synthetic screen', observedOn: date };
  await evaluate(client, `(async () => { ${moduleExpression}
    return store.confirmOwnedBottleVersion38(${JSON.stringify(concurrent)}); })()`, true);
  const concurrentSnapshot = await saveReceipt('injectedConcurrentScreenBeforeStaleTap');
  assert.equal(concurrentSnapshot.revision, 4);
  await touch('Confirm this bottle observation');
  await waitMessage('This draft is outdated.');
  assert.deepEqual(await saveReceipt('staleDraftCannotOverwrite'), concurrentSnapshot);
  await capture('13-outdated-draft-refused');
  await touch('Cancel draft'); await touch('Refresh history');
  await waitForText(client, 'Concurrent synthetic screen');
  await capture('14-refreshed-factual-current-and-prior');
  const shelfCipherHash = () => evaluate(client, `(async () => {
    const raw = localStorage.getItem('layerwell.shelf.v1');
    if (raw === null) throw new Error('Synthetic Shelf ciphertext missing');
    const hash = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(raw));
    return [...new Uint8Array(hash)].map(value=>value.toString(16).padStart(2,'0')).join(''); })()`, true);
  const privateCipherBefore = await shelfCipherHash();
  await edit({ labelText: 'Owner A private draft', variant: 'Retired owner draft' });
  // Deliberate hostile synthetic authority transitions, not real account
  // operations or an authenticated grant. The genuine fixture is restored by
  // reloading from its persisted owner proof; no positive owner B is admitted.
  const disabledLoadingStart = client.events.length;
  const closedRead = await evaluate(client, `(async () => { ${moduleExpression}
    mod('/lib/consent/healthProcessingEpoch.ts').clearActiveHealthProcessingEpoch();
    try { await store.loadOwnedBottleHistory38(${JSON.stringify(id)}); return 'UNEXPECTED_SUCCESS'; }
    catch (error) { return String(error.message); } })()`, true);
  assert.match(closedRead, /HEALTH_DATA_WRITE_ADMISSION_CLOSED/);
  try {
    await waitForCondition(client, `!document.body.innerText.includes(${JSON.stringify(labelOne)}) &&
      !document.body.innerText.includes('Concurrent synthetic screen') &&
      ![...document.querySelectorAll('input,textarea')].some(node=>String(node.value).includes('Owner A private draft'))`,
    30_000, 'closed epoch masks private history and draft');
  } catch (error) {
    writeJson('C38-closed-epoch-failure-state.json', await evaluate(client, `(() => { ${moduleExpression}
      return { lease: mod('/lib/consent/healthProcessingEpoch.ts').activeHealthProcessingLeaseSnapshot(),
        visibleText:document.body.innerText, inputValues:[...document.querySelectorAll('input,textarea')].map(node=>({label:node.getAttribute('aria-label'),value:node.value})) }; })()`));
    throw error;
  }
  await capture('15-closed-epoch-masked');
  const forged = await evaluate(client, `(async () => { ${moduleExpression}
    const health = mod('/lib/consent/healthProcessingEpoch.ts');
    health.setActiveHealthProcessingEpoch(${currentEpoch.epoch + 1}, { ownerUserId:'formula38-other-synthetic-owner',
      ownerBinding:'bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb',
      accountGeneration:${currentEpoch.accountGeneration}, identityGeneration:${currentEpoch.identityGeneration} });
    const results = {};
    try { await store.loadOwnedBottleHistory38(${JSON.stringify(id)}); results.read='UNEXPECTED_SUCCESS'; }
    catch (error) { results.read=String(error.message); }
    try { await store.confirmOwnedBottleVersion38(${JSON.stringify({ ...concurrent,
      expectedRevision: concurrentSnapshot.revision, expectedCurrentVersionId: concurrentSnapshot.currentVersionId })});
      results.write='UNEXPECTED_SUCCESS'; }
    catch (error) { results.write=String(error.message); }
    return results;
  })()`, true);
  assert.match(forged.read, /FORMULA38_OWNER_MISMATCH/);
  assert.match(forged.write, /FORMULA38_OWNER_MISMATCH/);
  await waitForCondition(client, `!document.body.innerText.includes(${JSON.stringify(labelOne)}) &&
    !document.body.innerText.includes('Concurrent synthetic screen') &&
    ![...document.querySelectorAll('input,textarea')].some(node=>String(node.value).includes('Owner A private draft'))`,
  30_000, 'forged owner masks history and previous-owner draft');
  await capture('16-forged-cross-owner-unavailable');
  assert.equal(await shelfCipherHash(), privateCipherBefore);
  const disabledLoadingRequests = client.events.slice(disabledLoadingStart)
    .filter((event) => event.method === 'Network.requestWillBeSent');
  assert.equal(disabledLoadingRequests.length, 0, 'Closed/forged-owner version loading made hidden network requests.');
  writeJson('C38-hostile-owner-fixture.json', { fixture: 'deliberate closed and forged synthetic health authority',
    closedRead, forged, cipherBefore: privateCipherBefore, cipherAfter: await shelfCipherHash(),
    qualifiedAccountSwitch: false, privateHistoryAndDraftHidden: true, disabledLoadingNetworkRequests: disabledLoadingRequests.length });
  await client.send('Page.reload', { ignoreCache: false });
  await waitCurrent();
  await acceptNavigationAuthority('genuine-fixture-reload-after-hostile-negative-no-draft', { relaunch:true });
  assert.deepEqual(await saveReceipt('genuineFixtureReloadAfterHostileOwnerNegative'), concurrentSnapshot);
  await capture('17-same-owner-restore-after-denial');
  let textPressure = null;
  if (process.argv.includes('--formula38-large-text')) {
    // This is the repository's direct computed-font CSS stress technique,
    // not native Dynamic Type or a physical-device accessibility claim.
    const pressureExpression = `(() => {
      const original = globalThis.__formula38TextStyles ??= new Map();
      for (const node of document.body.querySelectorAll('*')) {
        if (original.has(node) || node.closest('[role="tab"]')) continue;
        const text = [...node.childNodes].some(child=>child.nodeType===Node.TEXT_NODE && child.textContent.trim());
        if (!text && !['INPUT','TEXTAREA'].includes(node.tagName)) continue;
        const style = getComputedStyle(node), size = parseFloat(style.fontSize), line = parseFloat(style.lineHeight);
        if (!Number.isFinite(size) || size < 8 || size > 72) continue;
        original.set(node, node.getAttribute('style'));
        node.style.fontSize = (size*2) + 'px';
        if (Number.isFinite(line)) node.style.lineHeight = (line*2) + 'px';
      }
      for (const node of document.body.querySelectorAll('*')) {
        if (/(auto|scroll)/.test(getComputedStyle(node).overflowY)) node.scrollTop = 0;
      }
      return { textScale:2, styledNodes:original.size, overflowX:Math.max(0,document.documentElement.scrollWidth-innerWidth),
        technique:'computed-font CSS stress; not native Dynamic Type' };
    })()`;
    try {
      textPressure = await evaluate(client, pressureExpression);
      await capture('18-large-text-current-history');
      await touch('Record label observation');
      textPressure = await evaluate(client, pressureExpression);
      await touch('Cancel draft');
      await capture('19-large-text-cancel-reachable');
      assert.equal(textPressure.overflowX, 0, 'Large-text formula screen has horizontal overflow.');
      assert.deepEqual(await saveReceipt('largeTextDraftCancelPreservesHistory'), concurrentSnapshot);
      writeJson('C38-large-text-stress.json', { ...textPressure, recordAndCancelReachable:true, nativeOrVoiceOver:false });
    } finally {
      await evaluate(client, `(() => { for (const [node,style] of globalThis.__formula38TextStyles ?? []) {
        if (style === null) node.removeAttribute('style'); else node.setAttribute('style',style);
      } delete globalThis.__formula38TextStyles; return true; })()`);
    }
  }
  const outgoing = client.events.slice(startEvent).filter((event) => event.method === 'Network.requestWillBeSent');
  const privateTerms = [labelOne, 'Calm lotion 01', 'Calm lotion 02', 'Calm lotion 03', 'Concurrent synthetic screen',
    ...concurrentSnapshot.versions.map((version) => version.id)];
  assert.ok(outgoing.every((event) => !privateTerms.some((term) =>
    decodeURIComponent(String(event.params.request.url)).includes(term) || String(event.params.request.postData ?? '').includes(term))),
  'Formula or owned-unit content appeared in an outgoing request.');
  const requests = outgoing.map((event) => {
    const url = new URL(event.params.request.url);
    return { method: event.params.request.method, origin: url.origin, path: url.pathname };
  });
  const localOrigin = await evaluate(client, 'location.origin');
  assert.ok(requests.every((request) => request.origin === localOrigin || request.origin === 'null'),
    'Formula journey issued a nonlocal network request.');
  writeJson('C38-network-metadata.json', requests);
  await guard();
  const summary = { verdict: 'PASS', surface: 'Real Chrome CDP Expo web', id,
    syntheticOwner: true, noPro: true, viewport: await evaluate(client, '({width:innerWidth,height:innerHeight,dpr:devicePixelRatio})'),
    historyCounts: [0, 1, 2, 3, 4], currentVersionId: concurrentSnapshot.currentVersionId,
    observed: ['draft-no-write', 'cancel-no-write', 'explicit-label-confirmation', 'browser-back-forward-same-version', 'back-reentry', 'same-owner-page-reload',
      'offline-identical-idempotency', 'offline-explicit-unknown-append', 'old-version-immutable', 'injected-storage-refusal',
      'explicit-retry', 'injected-concurrent-screen', 'stale-draft-visible-refusal', 'refresh-readback',
      'injected-closed-epoch-masks-history-and-draft', 'forged-other-owner-read-write-refusal', 'ciphertext-preserved',
      'genuine-owner-reload-restores-history', 'disabled-loading-no-network', 'no-formula-network-content'],
    textPressure,
    limitations: ['browser is not native signed iPhone or VoiceOver', 'storage/concurrency/authority faults are deliberate synthetic fixtures',
      'real provider, cloud portability, clinical and whole C02 acceptance are unqualified'], sourceCandidateOnly: true, release: 'NO_GO' };
  await returnToDetail('20');
  await guard();
  const sourceAfter = sourceHashes();
  writeJson('C38-source-hashes.json', { before: sourceBefore, after: sourceAfter,
    stable: JSON.stringify(sourceBefore) === JSON.stringify(sourceAfter) });
  assert.deepEqual(sourceAfter, sourceBefore, 'Feature source changed during the browser journey.');
  writeJson('C38-summary.json', summary);
  return { verdict: 'PASS', currentVersionId: concurrentSnapshot.currentVersionId, revision: 4 };
}
