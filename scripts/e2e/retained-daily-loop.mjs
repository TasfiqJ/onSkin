import assert from 'node:assert/strict';

// Runs inside the maintained fresh-profile onboarding harness. No authority,
// consent, entitlement, corpus receipt, or local completion is fabricated here.
export async function dailyLoopFlow({ client, evaluate, retainedRoute, waitForText,
  waitForCondition, clickByText, scrollTextIntoView, captureStep, writeJson }) {
  const route = (path) => retainedRoute(client, path);
  const capture = (name) => captureStep(client, `M102-${name}`, { assertClean: false });
  const network = (offline) => client.send('Network.emulateNetworkConditions', {
    offline, latency: 0, downloadThroughput: -1, uploadThroughput: -1,
  });
  const checkbox = `Array.from(document.querySelectorAll('[role="checkbox"]')).find(n => n.getAttribute('aria-checked') !== 'true' && n.getAttribute('aria-disabled') !== 'true')`;
  const tapCheckbox = async (twice = false) => {
    const rect = await evaluate(client, `(() => { const n = ${checkbox}; if (!n) return null; n.scrollIntoView({block:'center'}); const r=n.getBoundingClientRect(); return {x:r.x+r.width/2,y:r.y+r.height/2}; })()`);
    assert(rect, 'No admitted actionable Today step');
    for (let i = 0; i < (twice ? 2 : 1); i++) {
      await client.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ ...rect, id: 1 }] });
      await client.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
    }
  };
  const privateRead = (key) => evaluate(client, `(async () => {
    const m=[...__r.getModules().values()].find(m=>/lib[\\\\/]storage[\\\\/]privateKV\\.ts$/.test(m.verboseName??''));
    if(!m) throw new Error('Actual encrypted store unavailable');
    return await m.publicModule.exports.getPrivateItem(${JSON.stringify(key)});
  })()`, true);
  const readCompletions = async () => JSON.parse(await privateRead('layerwell.completions.v1'));
  await route('/today?routine=AM');
  await waitForCondition(client, `${checkbox} !== undefined`, 30_000, 'admitted real AM checklist');
  await capture('01-am-ready');

  await network(true);
  const before = await evaluate(client, `localStorage.getItem('layerwell.completions.v1')`);
  await evaluate(client, `(() => { const original=Storage.prototype.setItem;
    globalThis.__M102_RESTORE_WRITE__=()=>{Storage.prototype.setItem=original;delete globalThis.__M102_RESTORE_WRITE__;};
    Storage.prototype.setItem=function(key,value){if(key==='layerwell.completions.v1')throw new DOMException('Synthetic write failure','QuotaExceededError');return original.call(this,key,value);};
  })()`);
  await tapCheckbox();
  await waitForText(client, "Check-offs aren't available right now.");
  assert.equal(await evaluate(client, `localStorage.getItem('layerwell.completions.v1')`), before);
  await capture('02-rejected-write-recovery');
  await evaluate(client, 'globalThis.__M102_RESTORE_WRITE__()');
  await clickByText(client, 'Try loading saved check-offs again');
  await waitForCondition(client, `${checkbox} !== undefined`, 30_000, 'retry reads durable state offline');
  await tapCheckbox(true);
  await waitForCondition(client, `document.querySelector('[role="checkbox"][aria-checked="true"]') !== null`, 30_000, 'durable offline check');
  const first = await readCompletions();
  assert.equal(first.sync.journal.filter((e) => e.kind === 'step').length, 1, 'Duplicate presses inserted multiple events');
  const checkedName = await evaluate(client, `document.querySelector('[role="checkbox"][aria-checked="true"]').getAttribute('aria-label')`);
  await clickByText(client, checkedName);
  assert.deepEqual((await readCompletions()).sync, first.sync, 'Retained append-only completion changed on undo attempt');
  await capture('03-offline-duplicate-append-only');

  // These are device-local preferences and OS reads, so visiting for the first
  // time while loaded offline must not leave a permanently blank paused query.
  await route('/settings/timing');
  await waitForText(client, 'Timing');
  await clickByText(client, 'Morning reminder time, 7:30 AM');
  await scrollTextIntoView(client, 'Morning reminder, 8:00 AM');
  await clickByText(client, 'Morning reminder, 8:00 AM');
  await waitForCondition(client, `document.querySelector('[aria-label="Morning reminder time, 8:00 AM"]') !== null`, 30_000, 'offline timing save');
  const prefs = JSON.parse(await privateRead('layerwell.notifPrefs.v1'));
  assert.equal(prefs.prefs.amTime, '08:00');
  assert.equal(prefs.prefs.amEnabled, false, 'Editing time opted into a purpose');
  assert.equal(prefs.prefs.liveActivityEnabled, false);
  await capture('04-offline-timing');

  await network(false);
  await client.send('Page.reload', { ignoreCache: true });
  await waitForText(client, 'Timing', 60_000);
  assert.equal(JSON.parse(await privateRead('layerwell.notifPrefs.v1')).prefs.amTime, '08:00');
  await route('/today?routine=AM');
  await waitForCondition(client, `document.querySelector('[role="checkbox"][aria-checked="true"]') !== null`, 30_000, 'reloaded saved AM progress');
  assert.deepEqual((await readCompletions()).sync, first.sync, 'Reload changed stable replay identities');
  await capture('05-reloaded-am');
  await route('/today?routine=PM');
  await waitForText(client, 'Evening');
  await capture('06-pm');
  await route('/routine/plan');
  await waitForText(client, 'routine');
  await capture('07-plan');
  await route('/cycle/settings');
  await waitForText(client, 'Save cycle');
  await capture('08-cycle');
  await route('/settings/notifications');
  await waitForText(client, 'Morning routine');
  await capture('09-web-reminder-availability');
  writeJson('M102-daily-loop.json', { verdict: 'pass', fixture: 'existing-development-corpus; real onboarding authority; synthetic local IO only',
    offlineMutation: true, rejectedWriteRetry: true, duplicateSingleEvent: true,
    undo: 'UNAVAILABLE_RETAINED_APPEND_ONLY', reloadStableIdentities: true,
    offlineTimingPersistsWithoutOptIn: true, nativeOS: 'NOT_RUN',
    offlineReload: 'NOT_RUN: Metro reload performed after reconnect; no installed-native cold-start claim' });
}
