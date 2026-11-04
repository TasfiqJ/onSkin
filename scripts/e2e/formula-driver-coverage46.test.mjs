import assert from 'node:assert/strict';
import test from 'node:test';
import {
  assertFormulaMessageVisible38,
  selectFormulaControl38,
  touchFormulaControl38,
} from './owned-bottle-formula38.mjs';

// Execute the actual driver's decisions with synthetic boundary IO. These are
// not DOM/layout/browser checks and do not replace the separate 20 Chrome cases.
const label = 'Confirm this bottle observation';
const path = '/shelf/formula-history';
function snapshot() {
  return { path, expectedPath: path, documentVisible: true, requestedLabel: label,
    requestedRole: 'button', exactCandidates: 1,
    target: { active: true, role: 'button', label, disabled: false,
      fullyVisible: true, hitOwned: true, rect: { x: 187.5, y: 285.5 } } };
}
const refusals = [
  ['wrong route', (s) => { s.path = '/shelf/other-unit'; }],
  ['background document', (s) => { s.documentVisible = false; }],
  ['missing accessible control', (s) => { s.exactCandidates = 0; }],
  ['duplicate accessible controls', (s) => { s.exactCandidates = 2; }],
  ['absent target', (s) => { s.target = null; }],
  ['retired target', (s) => { s.target.active = false; }],
  ['wrong accessible role', (s) => { s.target.role = 'checkbox'; }],
  ['changed accessible name', (s) => { s.target.label += ' later'; }],
  ['disabled target', (s) => { s.target.disabled = true; }],
  ['offscreen or clipped target', (s) => { s.target.fullyVisible = false; }],
  ['occluded target', (s) => { s.target.hitOwned = false; }],
  ['nonfinite horizontal coordinate', (s) => { s.target.rect.x = NaN; }],
  ['nonfinite vertical coordinate', (s) => { s.target.rect.y = Infinity; }],
];

test('formula selector returns only the exact current active target', () => {
  const current = snapshot();
  assert.equal(selectFormulaControl38(current), current.target);
});
for (const [reason, mutate] of refusals) {
  test(`formula selector refuses ${reason}`, () => {
    const current = snapshot(); mutate(current);
    assert.throws(() => selectFormulaControl38(current));
  });
}

test('formula feedback requires one visible alert', () => {
  assert.doesNotThrow(() => assertFormulaMessageVisible38({ matches: 1, visible: true }));
});
for (const [reason, receipt] of [
  ['missing alert', { matches: 0, visible: false }],
  ['duplicate alerts', { matches: 2, visible: true }],
  ['hidden, clipped or occluded alert', { matches: 1, visible: false }],
  ['absent receipt', undefined],
]) test(`formula feedback refuses ${reason}`, () => {
  assert.throws(() => assertFormulaMessageVisible38(receipt));
});

function driver() {
  const events = [], observations = [];
  const io = { label, path,
    guard: async () => { events.push('guard'); },
    inspect: async (name, options) => {
      observations.push({ name, options }); events.push('inspect'); return snapshot();
    },
    record: async (value) => { events.push('record'); assert.deepEqual(value, snapshot()); },
    send: async (method, params) => { events.push({ method, params }); },
  };
  return { events, observations, io };
}

test('formula touch rechecks authority and fresh target before ordered start/end', async () => {
  const d = driver();
  assert.deepEqual(await touchFormulaControl38(d.io), snapshot().target);
  assert.deepEqual(d.observations, [
    { name: label, options: { role: 'button', path, scroll: true } },
    { name: label, options: { role: 'button', path } },
  ]);
  assert.deepEqual(d.events, ['guard', 'inspect', 'guard', 'inspect', 'record',
    { method: 'Input.dispatchTouchEvent', params: { type: 'touchStart',
      touchPoints: [{ id: 1, force: 1, radiusX: 2, radiusY: 2, x: 187.5, y: 285.5 }] } },
    { method: 'Input.dispatchTouchEvent', params: { type: 'touchEnd', touchPoints: [] } },
  ]);
});

for (const phase of [1, 2]) test(`formula touch refuses retired authority at guard ${phase}`, async () => {
  const d = driver(); let guards = 0;
  d.io.guard = async () => { if (++guards === phase) throw new Error('retired authority'); };
  await assert.rejects(() => touchFormulaControl38(d.io), /retired authority/);
  assert.equal(d.observations.length, phase - 1);
  assert.equal(d.events.some((event) => typeof event === 'object'), false);
  assert.equal(d.events.includes('record'), false);
});

test('formula touch refuses a target occluded after scrolling without sending an event', async () => {
  const d = driver(); let inspections = 0, recorded;
  d.io.inspect = async () => {
    const current = snapshot(); if (++inspections === 2) current.target.hitOwned = false; return current;
  };
  d.io.record = async (value) => { recorded = value; };
  await assert.rejects(() => touchFormulaControl38(d.io), /occluded/);
  assert.equal(inspections, 2);
  assert.equal(recorded.target.hitOwned, false);
  assert.equal(d.events.some((event) => typeof event === 'object'), false);
});

for (const boundary of ['inspect', 'record']) test(`formula touch propagates ${boundary} failure without sending an event`, async () => {
  const d = driver(); d.io[boundary] = async () => { throw new Error(`${boundary} failed`); };
  await assert.rejects(() => touchFormulaControl38(d.io), new RegExp(`${boundary} failed`));
  assert.equal(d.events.some((event) => typeof event === 'object'), false);
});

for (const failure of ['touchStart', 'touchEnd']) test(`formula touch never succeeds after ${failure} dispatch failure`, async () => {
  const d = driver(), sent = [];
  d.io.send = async (method, params) => {
    sent.push({ method, params });
    if (params.type === failure) throw new Error(`${failure} failed`);
  };
  await assert.rejects(() => touchFormulaControl38(d.io), new RegExp(`${failure} failed`));
  assert.deepEqual(sent.map((event) => [event.method, event.params.type]),
    failure === 'touchStart' ? [['Input.dispatchTouchEvent', 'touchStart']] :
      [['Input.dispatchTouchEvent', 'touchStart'], ['Input.dispatchTouchEvent', 'touchEnd']]);
});
