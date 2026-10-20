import assert from 'node:assert/strict';

// Runs inside the maintained fresh-profile onboarding harness. No authority,
// consent, entitlement, corpus receipt, or local completion is fabricated here.
export async function dailyLoopFlow({ client, evaluate, retainedRoute, waitForText,
  waitForCondition, clickByText, scrollTextIntoView, fillByLabel, captureStep, writeJson }) {
  const route = (path) => retainedRoute(client, path);
  let target;
  const assertTarget = async () => {
    assert(target, 'No bound daily target');
    const actual = await evaluate(client, `(() => {
      const d=new Date();
      return {date:[d.getFullYear(),String(d.getMonth()+1).padStart(2,'0'),String(d.getDate()).padStart(2,'0')].join('-'),
        text:document.body.innerText};
    })()`);
    assert.equal(actual.date, target.date, 'Local day changed during this interaction; rerun with a fresh profile');
    assert(actual.text.toLowerCase().includes(target.dateLabel.toLowerCase()), 'Rendered Today date does not match the interaction target');
    assert(actual.text.includes(target.phase === 'AM' ? 'Morning routine' : 'Evening routine'), 'Rendered routine phase mismatch');
  };
  const enterToday = async (phase) => {
    await route(`/today?routine=${phase}`);
    // The existing development URL override is read by the clock on mount.
    // Reload EVERY phase entry, including saved-AM re-entry, before binding it.
    await client.send('Page.reload', { ignoreCache: true });
    await waitForText(client, phase === 'AM' ? 'Morning routine' : 'Evening routine', 60_000);
    target = await evaluate(client, `(() => {const d=new Date();return {
      phase:${JSON.stringify(phase)},
      date:[d.getFullYear(),String(d.getMonth()+1).padStart(2,'0'),String(d.getDate()).padStart(2,'0')].join('-'),
      dateLabel:d.toLocaleDateString('en-US',{weekday:'long',month:'long',day:'numeric'})};})()`);
    await assertTarget();
  };
  const capture = (name) => captureStep(client, `M102-${name}`, { assertClean: false });
  const network = (offline) => client.send('Network.emulateNetworkConditions', {
    offline, latency: 0, downloadThroughput: -1, uploadThroughput: -1,
  });
  const checkbox = `Array.from(document.querySelectorAll('[role="checkbox"]')).find(n => n.getAttribute('aria-checked') !== 'true' && n.getAttribute('aria-disabled') !== 'true')`;
  const tapCheckbox = async (twice = false) => {
    await assertTarget();
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
  await route('/shelf/manual');
  await waitForCondition(client, `document.querySelector('input[aria-label="Product name"]') !== null`, 30_000, 'manual name input');
  await fillByLabel(client, 'Product name', 'M102 synthetic moisturizer');
  await clickByText(client, 'Category');
  await clickByText(client, 'Category, Moisturiser (tube)');
  await clickByText(client, 'Continue');
  await waitForText(client, 'Not opened yet');
  await clickByText(client, 'Not opened yet');
  await scrollTextIntoView(client, 'Add to shelf');
  await clickByText(client, 'Add to shelf');
  await waitForText(client, 'M102 synthetic moisturizer');
  await capture('00-manual-plan-input');
  await enterToday('AM');
  await waitForCondition(client, `${checkbox} !== undefined`, 30_000, 'admitted real AM checklist');
  await capture('01-am-ready');

  await network(true);
  const before = await evaluate(client, `localStorage.getItem('layerwell.completions.v1')`);
  await assertTarget();
  await evaluate(client, `(() => { const original=Storage.prototype.setItem;
    globalThis.__M102_RESTORE_WRITE__=()=>{Storage.prototype.setItem=original;delete globalThis.__M102_RESTORE_WRITE__;};
    Storage.prototype.setItem=function(key,value){if(key==='layerwell.completions.v1')throw new DOMException('Synthetic write failure','QuotaExceededError');return original.call(this,key,value);};
  })()`);
  await tapCheckbox();
  await waitForText(client, "Check-offs aren't available right now.");
  assert.equal(await evaluate(client, `localStorage.getItem('layerwell.completions.v1')`), before);
  await capture('02-rejected-write-recovery');
  await evaluate(client, 'globalThis.__M102_RESTORE_WRITE__()');
  // The recovery surface still binds the same local day; it intentionally hides the routine.
  assert((await evaluate(client, 'document.body.innerText')).toLowerCase().includes(target.dateLabel.toLowerCase()));
  await clickByText(client, 'Try loading saved check-offs again');
  await waitForCondition(client, `${checkbox} !== undefined`, 30_000, 'retry reads durable state offline');
  await tapCheckbox(true);
  await waitForCondition(client, `document.querySelector('[role="checkbox"][aria-checked="true"]') !== null`, 30_000, 'durable offline check');
  const first = await readCompletions();
  assert.equal(first.sync.journal.filter((e) => e.kind === 'step').length, 1, 'Duplicate presses inserted multiple events');
  assert(first.days[target.date]?.every(key => key.startsWith('AM:')), 'AM write targeted the wrong phase/day');
  assert(first.sync.journal.every(e => e.completedDate === target.date && e.routineType === 'AM'), 'AM replay target mismatch');
  assert.equal(await evaluate(client, `document.querySelector('[role="checkbox"][aria-checked="true"]').getAttribute('aria-disabled')`), 'true');
  assert((await evaluate(client, 'document.body.innerText')).includes('Recorded - cannot undo'));
  // A disabled completed control is truthful; duplicate presses were already sent before settlement.
  assert.deepEqual((await readCompletions()).sync, first.sync, 'Retained append-only completion changed on undo attempt');
  await capture('03-offline-duplicate-append-only');

  // These are device-local preferences and OS reads, so visiting for the first
  // time while loaded offline must not leave a permanently blank paused query.
  await route('/settings/timing');
  await waitForText(client, 'Timing');
  const prefsBefore = await evaluate(client, `localStorage.getItem('layerwell.notifPrefs.v1')`);
  await evaluate(client, `(() => { const original=Storage.prototype.setItem;
    globalThis.__M102_RESTORE_PREFS__=()=>{Storage.prototype.setItem=original;delete globalThis.__M102_RESTORE_PREFS__;};
    Storage.prototype.setItem=function(key,value){if(key==='layerwell.notifPrefs.v1')throw new DOMException('Synthetic preference write failure','QuotaExceededError');return original.call(this,key,value);};
  })()`);
  await clickByText(client, 'Morning reminder time, 7:30 AM');
  await scrollTextIntoView(client, 'Morning reminder, 8:00 AM');
  await clickByText(client, 'Morning reminder, 8:00 AM');
  await waitForText(client, 'Your preferences may be saved, but reminders were not confirmed.');
  assert.equal(await evaluate(client, `localStorage.getItem('layerwell.notifPrefs.v1')`), prefsBefore);
  await capture('04a-offline-reminder-recovery');
  await evaluate(client, 'globalThis.__M102_RESTORE_PREFS__()');
  await clickByText(client, 'Try saving reminder preferences again');
  await waitForCondition(client, `document.querySelector('[aria-label="Morning reminder time, 8:00 AM"]') !== null`, 30_000, 'offline timing save');
  const prefs = JSON.parse(await privateRead('layerwell.notifPrefs.v1'));
  assert.equal(prefs.prefs.amTime, '08:00');
  assert.equal(prefs.prefs.amEnabled, false, 'Editing time opted into a purpose');
  assert.equal(prefs.prefs.liveActivityEnabled, false);
  await capture('04-offline-timing');

  // Current paid authority is deliberately unavailable. Exercise the actual
  // denial rather than inventing an entitlement to open these editors.
  const paidBoundary = async (path, name) => {
    const originalCycle = await evaluate(client, `localStorage.getItem('layerwell.cycle.v2')`);
    const originalOrder = await evaluate(client, `localStorage.getItem('layerwell.routineOrder.v1')`);
    await evaluate(client, `(() => { history.pushState({}, '', ${JSON.stringify(path)}); dispatchEvent(new PopStateEvent('popstate')); })()`);
    await waitForCondition(client, `/Subscribe to Pro|Pro-only screens hidden/.test(document.body.innerText)`, 30_000, 'truthful paid route boundary');
    await capture(name);
    assert.equal(await evaluate(client, `localStorage.getItem('layerwell.routineOrder.v1')`), originalOrder);
    assert.equal(await evaluate(client, `localStorage.getItem('layerwell.cycle.v2')`), originalCycle);
    await route('/settings/timing');
    await waitForText(client, 'Timing');
  };
  await paidBoundary('/routine/reorder?phase=am', '04c-reorder-paid-boundary');
  await paidBoundary('/cycle/settings', '04b-cycle-paid-boundary');

  await network(false);
  await route('/settings/timing');
  await waitForText(client, 'Timing');
  await client.send('Page.reload', { ignoreCache: true });
  await waitForText(client, 'Timing', 60_000);
  assert.equal(JSON.parse(await privateRead('layerwell.notifPrefs.v1')).prefs.amTime, '08:00');
  await enterToday('AM');
  await waitForCondition(client, `document.querySelector('[role="checkbox"][aria-checked="true"]') !== null`, 30_000, 'reloaded saved AM progress');
  assert.deepEqual((await readCompletions()).sync, first.sync, 'Reload changed stable replay identities');
  await capture('05-reloaded-am');
  await enterToday('PM');
  await waitForCondition(client, `${checkbox} !== undefined`, 30_000, 'admitted PM checklist');
  const pmCount = await evaluate(client, `document.querySelectorAll('[role="checkbox"]').length`);
  for (let i = 0; i < pmCount; i++) {
    await tapCheckbox(true);
    await waitForCondition(client, `document.querySelectorAll('[role="checkbox"][aria-checked="true"]').length === ${i + 1}`, 30_000, 'durable PM check');
  }
  const completedPM = await readCompletions();
  assert.equal(completedPM.sync.journal.filter(e=>e.kind==='routine_day').length, 1, 'PM must create exactly one routine-day marker');
  await assertTarget();
  assert(completedPM.days[target.date]?.some(key => key.startsWith('PM:')), 'PM write missing from target day');
  assert(completedPM.sync.journal.every(e => e.completedDate === target.date), 'Replay wrote a different day');
  await capture('06-pm');
  await paidBoundary('/routine/plan', '07-plan-paid-boundary');
  await route('/settings/notifications');
  await waitForText(client, 'Morning routine');
  await capture('09-web-reminder-availability');
  writeJson('M102-daily-loop.json', { verdict: 'pass', fixture: 'existing-development-corpus; real onboarding authority; synthetic local IO only',
    offlineMutation: true, rejectedWriteRetry: true, duplicateSingleEvent: true,
    targets: {localDate:target.date,phases:['AM','PM'],binding:'rendered heading/date plus encrypted days and journal readback'},
    undo: 'UNAVAILABLE_RETAINED_APPEND_ONLY', reloadStableIdentities: true,
    offlineTimingPersistsWithoutOptIn: true, routineReorder: 'BLOCKED_CURRENT_PAID_AUTHORITY', cycleSettings: 'BLOCKED_CURRENT_PAID_AUTHORITY', routinePlan: 'BLOCKED_CURRENT_PAID_AUTHORITY', pmDayMarker: true, nativeOS: 'NOT_RUN',
    offlineReload: 'NOT_RUN: Metro reload performed after reconnect; no installed-native cold-start claim' });
}
