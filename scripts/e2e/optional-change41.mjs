import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { setTimeout as delay } from 'node:timers/promises';
import { assertFormulaMessageVisible38, formulaControlExpression38, formulaMessageExpression38, selectFormulaControl38, touchFormulaControl38 } from './owned-bottle-formula38.mjs';

export function assertOptionalHistory41(snapshot, { revision, owner, original = null, target = null } = {}) {
  assert.equal(snapshot?.revision, revision, 'Wrong optional change revision.');
  assert.equal(snapshot?.events?.length, revision, 'History count disagrees with revision.');
  assert.equal(new Set(snapshot.events.map((event) => event.id)).size, revision, 'Duplicate event IDs.');
  snapshot.events.forEach((event, index) => {
    assert.equal(event.ownerUserId, owner, 'History has another owner.');
    assert.equal(event.revision, index + 1, 'History order changed.');
    assert.equal(event.expectedRevision, index, 'Revision predecessor changed.');
    assert.equal(event.actor, 'owner'); assert.equal(event.basis, 'owner_reported');
  });
  if (original) assert.deepEqual(snapshot.events[0], original, 'A correction rewrote its original.');
  if (target) {
    const last = snapshot.events.at(-1);
    assert.equal(last.targetEventId, target.id, 'Correction lineage is missing.');
    assert.equal(last.observedOn, target.observedOn, 'Correction changed original observed date.');
  }
}
export function assertNoChangeNetwork41(events, privateTexts) {
  const requests = events.filter((event) => event.method === 'Network.requestWillBeSent').map((event) => event.params.request);
  for (const request of requests) for (const text of privateTexts) {
    assert.ok(!String(request.postData ?? '').includes(text) && !String(request.url).includes(encodeURIComponent(text)),
      'Optional note content entered a network request.');
  }
  return requests.map((request) => ({ method: request.method, origin: new URL(request.url).origin, path: new URL(request.url).pathname, hasBody: !!request.postData }));
}

// Runs after unchanged C38 and retained completion controls, before the retained
// Shelf/consent recovery flow. Positive authority comes from genuine free
// onboarding; hostile fixtures below are negatives.
export async function runOptionalChange41(io) {
  const { client, evaluate, waitForText, waitForCondition, captureStep, writeJson, readAuthority } = io;
  const sourcePaths = ['apps/mobile/src/features/today/optionalChange41.ts', 'apps/mobile/src/features/today/optionalChangeJournal41.ts',
    'apps/mobile/src/features/today/OptionalChangePanel41.tsx', 'apps/mobile/src/features/today/completionsStore.ts',
    'apps/mobile/src/app/(tabs)/today.tsx', 'scripts/e2e/optional-change41.mjs', 'scripts/e2e/onboarding-first-session.mjs'];
  const sourceHashes = () => Object.fromEntries(sourcePaths.map((file) => [file,
    createHash('sha256').update(readFileSync(new URL('../../' + file, import.meta.url))).digest('hex')]));
  const sourceBefore = sourceHashes(); writeJson('C41-source-hashes.json', { before: sourceBefore });
  const firstAuthority = await readAuthority();
  assert.equal(firstAuthority.sameOwner, true); assert.equal(firstAuthority.currentConsent, true); assert.equal(firstAuthority.proActive, false);
  let currentAuthority = firstAuthority.authority37;
  const navigationAuthorities = [];
  const acceptNavigationAuthority = async (boundary, { relaunch = false } = {}) => {
    const current = await readAuthority();
    assert.equal(current.sameOwner, true); assert.equal(current.currentConsent, true); assert.equal(current.proActive, false);
    for (const field of ['ownerBinding', 'epoch']) assert.equal(current.authority37[field], firstAuthority.authority37[field], 'Navigation changed persisted owner/consent identity.');
    for (const field of ['accountGeneration', 'identityGeneration']) {
      assert.ok(Number.isSafeInteger(current.authority37[field]) && current.authority37[field] >= 0);
      if (!relaunch) assert.equal(current.authority37[field], currentAuthority[field], 'Navigation changed account identity.');
    }
    // As in C38, an actual navigation may revalidate health authority. This is a
    // fresh explicit intent with no editor; it never replaces a saved callback's lease.
    navigationAuthorities.push({ boundary, relaunch, previous: currentAuthority, current: current.authority37, noActiveDraft: true });
    writeJson('C41-navigation-authority-readbacks.json', navigationAuthorities);
    currentAuthority = current.authority37;
    return current;
  };
  const guard = async () => {
    const current = await readAuthority();
    assert.equal(current.sameOwner, true); assert.equal(current.currentConsent, true); assert.equal(current.proActive, false);
    assert.deepEqual(current.authority37, currentAuthority, 'Browser action authority changed.');
  };
  const traces = [];
  const inspect = (label, options) => evaluate(client, formulaControlExpression38(label, options));
  const touch = async (label, role = 'button') => touchFormulaControl38({ label, role, path: await evaluate(client, 'location.pathname'),
    inspect, guard, send: (method, params) => client.send(method, params),
    record: (receipt) => { traces.push(receipt); writeJson('C41-control-hit-receipts.json', traces); } });
  const field = async (label, value) => {
    await touch(label, 'textbox');
    const modifier = process.platform === 'darwin' ? 4 : 2;
    await client.send('Input.dispatchKeyEvent', { type: 'keyDown', key: 'a', code: 'KeyA', windowsVirtualKeyCode: 65, modifiers: modifier });
    await client.send('Input.dispatchKeyEvent', { type: 'keyUp', key: 'a', code: 'KeyA', windowsVirtualKeyCode: 65, modifiers: modifier });
    await client.send('Input.dispatchKeyEvent', { type: 'keyDown', key: 'Backspace', code: 'Backspace', windowsVirtualKeyCode: 8 });
    await client.send('Input.dispatchKeyEvent', { type: 'keyUp', key: 'Backspace', code: 'Backspace', windowsVirtualKeyCode: 8 });
    await client.send('Input.insertText', { text: value }); await delay(150);
  };
  const moduleExpression = `const mod = (suffix) => {
    const entry = [...__r.getModules().values()].find(m => (m.verboseName ?? '').replaceAll('\\\\', '/').endsWith(suffix));
    if (!entry?.publicModule?.exports) throw new Error('Missing loaded synthetic observation module');
    return entry.publicModule.exports;
  }; const store = mod('/features/today/completionsStore.ts'); const admission = mod('/lib/consent/healthDataWriteAdmission.ts');`;
  const read = () => evaluate(client, `(async () => { ${moduleExpression}
    const lease=admission.captureHealthDataWriteLease(); const snapshot=await store.getOptionalChanges41(lease);
    const raw=await mod('/lib/storage/privateKV.ts').getPrivateItem('layerwell.completions.v1');
    const envelope=raw===null?null:JSON.parse(raw); const coreBytes=envelope?.version===4?envelope.completionBytes:raw;
    return {snapshot,owner:lease.ownerUserId,coreBytes,core:coreBytes===null?null:JSON.parse(coreBytes),version:envelope?.version??null}; })()`, true);
  const receipts = {};
  const receipt = async (name) => {
    const value = await read();
    receipts[name] = { version: value.version, revision: value.snapshot.revision, owner: value.owner,
      sourceProof: value.snapshot.sourceProof, completionSha256: createHash('sha256').update(value.coreBytes ?? '').digest('hex'),
      events: value.snapshot.events.map(({ id, category, kind, targetEventId, observedOn, recordedAt, contentHash, revision }) =>
        ({ id, category, kind, targetEventId, observedOn, recordedAt, contentHash, revision })) };
    writeJson('C41-local-readback-receipts.json', receipts); return value;
  };
  const capture = async (name) => {
    const result = await captureStep(client, 'C41-' + name, { assertClean: false });
    assert.ok(result.overflowX <= 1, 'Optional notes caused horizontal overflow.'); return result;
  };
  const messages = [];
  const waitMessage = async (text) => {
    await waitForText(client, text);
    const expression = formulaMessageExpression38(text);
    await waitForCondition(client, `(${expression}).visible === true`, 30_000, 'actually visible optional change status alert');
    const message = await evaluate(client, expression);
    assertFormulaMessageVisible38(message); messages.push(message); writeJson('C41-visible-status-alerts.json', messages);
  };
  const enterTodayHonestly = async () => {
    for (let tries = 0; tries < 8; tries++) {
      const path = await evaluate(client, 'location.pathname');
      if (path === '/today') return;
      const target = await inspect('Today', { path, role: 'tab' });
      if (target.exactCandidates === 1) await touch('Today', 'tab');
      else await touch('Back');
      await delay(350);
      await acceptNavigationAuthority('actual-existing-Back-or-Tab-to-Today');
    }
    throw new Error('Actual Back/tab controls did not reach Today.');
  };
  const waitReady = async () => {
    await waitForText(client, 'Record a change (optional)', 60_000);
    if (!(await evaluate(client, `document.body.innerText.includes('Your optional change notes')`))) {
      await touch('Record a change (optional)');
      await waitForText(client, 'Your optional change notes', 60_000);
      await waitForText(client, 'Record a change (optional)', 60_000);
    }
  };
  const acceptRelaunch = async () => {
    await waitForText(client, 'Record a change (optional)', 60_000);
    const current = await acceptNavigationAuthority('actual-document-reload', { relaunch: true });
    await waitReady();
    return current;
  };
  await enterTodayHonestly(); await waitReady(); await guard();
  const initial = await receipt('beforeAnyNote');
  assertOptionalHistory41(initial.snapshot, { revision: 0, owner: initial.owner });
  assert.ok((await evaluate(client, 'document.body.innerText')).includes('Nothing recorded'));
  await touch('Record a change (optional)'); await touch('Other personal note'); await field('Your factual note', 'Synthetic canceled private draft41.');
  await capture('01-explicit-draft'); await touch('Cancel draft');
  assert.deepEqual((await read()).snapshot, initial.snapshot, 'Canceled draft changed history.');
  const firstText = 'Synthetic41: I used a different cleanser.';
  const correctedText = 'Synthetic41 correction: I used my usual cleanser.';
  const failedText = 'Synthetic41 private storage failure retry.';
  const date = await evaluate(client, `(() => {const d=new Date();d.setDate(d.getDate()-1);return [d.getFullYear(),String(d.getMonth()+1).padStart(2,'0'),String(d.getDate()).padStart(2,'0')].join('-')})()`);
  const startEvent = client.events.length;
  const draft = async (category, text = '', { action = 'Record a change (optional)', observed = null } = {}) => {
    await touch(action); if (category) await touch(category);
    if (observed) await field('Observed local date', observed);
    if (text) await field(action.startsWith('Retract') ? 'Retraction reason' : 'Your factual note', text);
    await touch('Review this change');
  };
  const confirm = async () => { await touch('Confirm and save this change'); await waitMessage('Saved on this device and read back.'); await guard(); };
  await draft('Used something different', firstText, { observed: date });
  assert.deepEqual((await read()).snapshot, initial.snapshot, 'Review created an event before confirmation.');
  await confirm(); const first = await receipt('firstExplicitSave');
  assertOptionalHistory41(first.snapshot, { revision: 1, owner: first.owner });
  assert.equal(first.version, 4); assert.equal(first.coreBytes, initial.coreBytes, 'Note upgrade altered original completion bytes.');
  assert.equal(first.snapshot.events[0].observedOn, date); const original = first.snapshot.events[0];
  await capture('02-first-save');
  await draft('Other personal note', correctedText, { action: 'Correct entry 1' }); await confirm();
  const corrected = await receipt('immutableCorrection');
  assertOptionalHistory41(corrected.snapshot, { revision: 2, owner: first.owner, original, target: original });
  assert.equal(corrected.coreBytes, initial.coreBytes);
  await draft('No change to report'); await confirm(); const affirmative = await receipt('affirmativeNoChange');
  assertOptionalHistory41(affirmative.snapshot, { revision: 3, owner: first.owner, original });
  assert.equal(affirmative.snapshot.events[2].category, 'no_change'); assert.equal(affirmative.snapshot.events[2].text, '');
  await draft(null, 'Synthetic41: I retract that no-change report.', { action: 'Retract entry 3' }); await confirm();
  const retracted = await receipt('appendRetraction');
  assertOptionalHistory41(retracted.snapshot, { revision: 4, owner: first.owner, original, target: affirmative.snapshot.events[2] });
  assert.equal(retracted.coreBytes, initial.coreBytes); await capture('03-correction-and-retraction-lineage');

  await draft('Other personal note', failedText);
  await evaluate(client, `(() => {globalThis.__change41SetItem=Storage.prototype.setItem;globalThis.__change41Refused=false;
    Storage.prototype.setItem=function(key,value){if(key==='layerwell.completions.v1'){globalThis.__change41Refused=true;throw new DOMException('Synthetic change41 storage refusal','QuotaExceededError');}
    return globalThis.__change41SetItem.call(this,key,value);};return true;})()`);
  try {
    await touch('Confirm and save this change'); await waitMessage('Storage did not confirm this save.');
    assert.equal(await evaluate(client, 'globalThis.__change41Refused'), true);
    assert.deepEqual((await read()).snapshot, retracted.snapshot, 'Refused storage claimed a commit.');
    await capture('04-truthful-storage-refusal');
  } finally {
    await evaluate(client, `(() => {Storage.prototype.setItem=globalThis.__change41SetItem;delete globalThis.__change41SetItem;delete globalThis.__change41Refused;return true;})()`);
  }
  await inspect('Confirm and save this change', { path: '/today', role: 'button', scroll: true }); await delay(180);
  const duplicateTarget = selectFormulaControl38(await inspect('Confirm and save this change', { path: '/today', role: 'button' }));
  await client.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ id: 1, x: duplicateTarget.rect.x, y: duplicateTarget.rect.y, force: 1, radiusX: 2, radiusY: 2 }] });
  await client.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
  const secondTouch = await inspect('Confirm and save this change', { path: '/today', role: 'button' });
  const sameControl = secondTouch.exactCandidates === 1 && secondTouch.target?.fullyVisible && secondTouch.target.hitOwned &&
    secondTouch.target.label === 'Confirm and save this change';
  const duplicateTouchOutcome = sameControl
    ? secondTouch.target.disabled ? 'SECOND_REAL_TOUCH_OWNED_BY_DISABLED_PENDING_CONFIRMATION' : 'SECOND_REAL_TOUCH_OWNED_BY_SAME_CONFIRMATION'
    : 'SECOND_TOUCH_REFUSED_BECAUSE_CONFIRMATION_WAS_ALREADY_REPLACED';
  writeJson('C41-duplicate-touch-ownership.json', { first: duplicateTarget, second: secondTouch, outcome: duplicateTouchOutcome });
  if (sameControl) {
    await guard();
    await client.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ id: 1, x: secondTouch.target.rect.x, y: secondTouch.target.rect.y, force: 1, radiusX: 2, radiusY: 2 }] });
    await client.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
  }
  await waitMessage('Saved on this device and read back.'); const retried = await receipt('duplicateRetrySingleEvent');
  assertOptionalHistory41(retried.snapshot, { revision: 5, owner: first.owner, original });
  assert.equal(retried.coreBytes, initial.coreBytes);

  // A later original check-off must keep notes and the original remote journal.
  const checkbox = await evaluate(client, `(() => {const n=[...document.querySelectorAll('[role="checkbox"]')].find(n=>n.getAttribute('aria-checked')!=='true'&&n.getAttribute('aria-disabled')!=='true');return n?.getAttribute('aria-label')??null;})()`);
  let laterCheckoff = 'NO_UNCHECKED_STEP_ON_CURRENT_PHASE';
  if (checkbox) {
    await touch(checkbox, 'checkbox');
    await waitForCondition(client, `document.querySelector('[role="checkbox"][aria-label='+${JSON.stringify(JSON.stringify(checkbox))}+']')?.getAttribute('aria-checked') === 'true'`, 30_000, 'original later check-off readback');
    const afterCheckoff = await receipt('originalCheckoffAfterV4');
    assert.deepEqual(afterCheckoff.snapshot.events, retried.snapshot.events, 'Original check-off changed notes.');
    assert.ok(afterCheckoff.core.sync.journal.length >= initial.core.sync.journal.length, 'Original remote journal was lost.');
    for (const prior of initial.core.sync.journal) assert.ok(afterCheckoff.core.sync.journal.some((event) => JSON.stringify(event) === JSON.stringify(prior)));
    laterCheckoff = 'ACTUAL_VISIBLE_CHECKBOX_PRESERVED_NOTES';
  }
  const beforeNavigation = await receipt('beforeNavigation');
  await touch('You', 'tab'); await waitForCondition(client, `location.pathname === '/you'`, 30_000, 'actual You tab');
  await acceptNavigationAuthority('actual-You-tab');
  const history = await client.send('Page.getNavigationHistory');
  const todayHistory = history.entries.slice(0, history.currentIndex).reverse().find((entry) => new URL(entry.url).pathname === '/today');
  assert.ok(todayHistory, 'Actual browser history has no Today entry.');
  const youHistory = history.entries[history.currentIndex];
  await client.send('Page.navigateToHistoryEntry', { entryId: todayHistory.id });
  await waitForCondition(client, `location.pathname === '/today'`, 30_000, 'actual browser Back to Today');
  await acceptNavigationAuthority('actual-browser-Back'); await waitReady();
  assert.deepEqual((await read()).snapshot.events, beforeNavigation.snapshot.events);
  await client.send('Page.navigateToHistoryEntry', { entryId: youHistory.id });
  await waitForCondition(client, `location.pathname === '/you'`, 30_000, 'actual browser Forward');
  await acceptNavigationAuthority('actual-browser-Forward');
  await touch('Today', 'tab'); await waitForCondition(client, `location.pathname === '/today'`, 30_000, 'actual Today tab reentry');
  await acceptNavigationAuthority('actual-Today-tab-reentry'); await waitReady(); await touch('Refresh changes'); await waitReady();
  await client.send('Page.reload', { ignoreCache: false }); await acceptRelaunch();
  assert.deepEqual((await receipt('actualBackRefreshReenterReload')).snapshot.events, beforeNavigation.snapshot.events);
  await capture('05-reloaded-private-lineage');

  // Deliberately hostile negatives: these never supply a happy-path owner.
  const cipherHash = () => evaluate(client, `(async()=>{const raw=localStorage.getItem('layerwell.completions.v1');const hash=await crypto.subtle.digest('SHA-256',new TextEncoder().encode(raw));return [...new Uint8Array(hash)].map(n=>n.toString(16).padStart(2,'0')).join('');})()`, true);
  const cipherBefore = await cipherHash();
  await touch('Record a change (optional)'); await touch('Other personal note'); await field('Your factual note', 'Synthetic41 retired owner draft.');
  const closed = await evaluate(client, `(async()=>{${moduleExpression}
    const old=admission.captureHealthDataWriteLease();globalThis.__change41OldLease=old;
    mod('/lib/consent/healthProcessingEpoch.ts').clearActiveHealthProcessingEpoch();
    try{await store.getOptionalChanges41(old);return 'UNEXPECTED_SUCCESS';}catch(error){return String(error.message);}})()`, true);
  assert.match(closed, /HEALTH_DATA_WRITE_ADMISSION_CLOSED|STALE/);
  await waitForCondition(client, `!document.body.innerText.includes('Synthetic41') && ![...document.querySelectorAll('input,textarea')].some(n=>String(n.value).includes('Synthetic41'))`, 30_000, 'revoked synthetic epoch masks text and draft');
  await capture('06-closed-consent-epoch-masked');
  const forged = await evaluate(client, `(async()=>{${moduleExpression}
    const health=mod('/lib/consent/healthProcessingEpoch.ts');health.setActiveHealthProcessingEpoch(${currentAuthority.epoch + 1},{ownerUserId:'change41-forged-owner',ownerBinding:'${'b'.repeat(64)}',accountGeneration:${currentAuthority.accountGeneration},identityGeneration:${currentAuthority.identityGeneration}});
    const result={};try{await store.getOptionalChanges41(admission.captureHealthDataWriteLease());result.newOwner='UNEXPECTED_SUCCESS';}catch(error){result.newOwner=String(error.message);}
    try{await store.getOptionalChanges41(globalThis.__change41OldLease);result.oldLease='UNEXPECTED_SUCCESS';}catch(error){result.oldLease=String(error.message);}return result;})()`, true);
  assert.match(forged.newOwner, /OWNER_MISMATCH|HEALTH_DATA_WRITE_ADMISSION_CLOSED/); assert.notEqual(forged.oldLease, 'UNEXPECTED_SUCCESS');
  assert.equal(await cipherHash(), cipherBefore); await capture('07-forged-owner-refused');
  writeJson('C41-hostile-authority-negatives.json', { fixture: 'deliberate synthetic closed epoch and forged owner; not positive account-switch qualification', closed, forged, ciphertextUnchanged: true });
  await client.send('Page.reload', { ignoreCache: false }); await acceptRelaunch();
  assert.deepEqual((await receipt('genuineOwnerReloadAfterDenial')).snapshot.events, beforeNavigation.snapshot.events);
  assert.ok(!(await evaluate(client, `[...document.querySelectorAll('input,textarea')].some(n=>String(n.value).includes('retired owner draft'))`)));
  let largeText = null;
  if (process.argv.includes('--change41-large-text')) {
    await evaluate(client, `(()=>{globalThis.__change41Styles=[];for(const n of document.querySelectorAll('div,span,input,textarea')){const s=getComputedStyle(n);if(n.childElementCount===0&&parseFloat(s.fontSize)>0){globalThis.__change41Styles.push([n,n.style.fontSize,n.style.lineHeight]);n.style.fontSize=(parseFloat(s.fontSize)*1.5)+'px';n.style.lineHeight='1.5';}}return true;})()`);
    try { await touch('Record a change (optional)'); await touch('No change to report'); await touch('Review this change');
      const captured = await capture('08-large-text-confirm-cancel'); largeText = { multiplier: 1.5, overflowX: captured.overflowX, nativeAccessibilityQualified: false };
      await touch('Cancel draft');
    } finally { await evaluate(client, `(()=>{for(const[n,font,line]of globalThis.__change41Styles??[]){n.style.fontSize=font;n.style.lineHeight=line;}delete globalThis.__change41Styles;return true;})()`); }
  }
  const requests = assertNoChangeNetwork41(client.events.slice(startEvent), [firstText, correctedText, failedText, 'Synthetic41 retired owner draft.']);
  const origin = await evaluate(client, 'location.origin'); assert.ok(requests.every((request) => request.origin === origin || request.origin === 'null'), 'Optional flow issued a nonlocal request.');
  writeJson('C41-network-metadata.json', requests); await guard();
  const sourceAfter = sourceHashes(); assert.deepEqual(sourceAfter, sourceBefore, 'Source changed during optional browser run.');
  writeJson('C41-source-hashes.json', { before: sourceBefore, after: sourceAfter, stable: true });
  const summary = { verdict: 'PASS', surface: 'Real Chrome CDP Expo web', viewport: await evaluate(client, '({width:innerWidth,height:innerHeight})'),
    syntheticOwner: true, noPro: true, revision: 5, laterCheckoff, duplicateTouchOutcome, largeText,
    observed: ['honest-existing-free-first-session', 'empty-distinct-from-affirmative-none', 'draft-and-cancel-no-event', 'chosen-local-date', 'explicit-confirmation-only',
      'immutable-correction-lineage', 'append-retraction', 'one-key-v4-preserves-original-completion-bytes', 'injected-storage-refusal', 'real-retry-single-event-with-second-touch-ownership-guard',
      'actual-browser-back-forward', 'tab-reentry', 'refresh-reload', 'deliberate-closed-epoch-masking', 'forged-owner-refusal', 'genuine-persisted-owner-reload', 'no-note-network-content'],
    limitations: ['browser is not signed native iPhone or VoiceOver', 'faults and hostile authority transitions are synthetic negatives', 'no clinical, owner, release or whole-app acceptance'],
    release: 'NO_GO', sourceCandidateOnly: true };
  writeJson('C41-summary.json', summary); return summary;
}
