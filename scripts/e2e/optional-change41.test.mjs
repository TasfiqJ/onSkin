import assert from 'node:assert/strict';
import test from 'node:test';
import { assertNoChangeNetwork41, assertOptionalHistory41 } from './optional-change41.mjs';

const original = { id: '41000000-0000-4000-8000-000000000001', ownerUserId: 'synthetic-a', observedOn: '2026-11-01',
  revision: 1, expectedRevision: 0, actor: 'owner', basis: 'owner_reported', kind: 'note', text: 'Synthetic statement.', targetEventId: null };
const correction = { ...original, id: '41000000-0000-4000-8000-000000000002', revision: 2, expectedRevision: 1,
  kind: 'correction', text: 'Synthetic correction.', targetEventId: original.id };
const snapshot = () => ({ revision: 2, events: [{ ...original }, { ...correction }] });

test('browser readback decisions accept exact owner immutable lineage and confirmed empty', () => {
  assertOptionalHistory41({ revision: 0, events: [] }, { revision: 0, owner: 'synthetic-a' });
  assertOptionalHistory41(snapshot(), { revision: 2, owner: 'synthetic-a', original, target: original });
});
for (const [label, alter] of [
  ['wrong owner', (value) => { value.events[1].ownerUserId = 'synthetic-b'; }],
  ['duplicate ID', (value) => { value.events[1].id = value.events[0].id; }],
  ['changed original text', (value) => { value.events[0].text = 'Silently overwritten'; }],
  ['wrong target', (value) => { value.events[1].targetEventId = 'unrelated'; }],
  ['wrong observed date', (value) => { value.events[1].observedOn = '2026-11-02'; }],
  ['missing event', (value) => { value.events.pop(); }],
  ['wrong revision predecessor', (value) => { value.events[1].expectedRevision = 0; }],
  ['machine observation substitution', (value) => { value.events[1].basis = 'machine_observed'; }],
]) test(`browser readback refuses ${label}`, () => {
  const value = snapshot(); alter(value);
  assert.throws(() => assertOptionalHistory41(value, { revision: 2, owner: 'synthetic-a', original, target: original }));
});

const request = (url, postData) => ({ method: 'Network.requestWillBeSent', params: { request: { method: 'POST', url, postData } } });
test('network evidence contains metadata only and refuses note content in body or URL', () => {
  const secret = 'Synthetic private text41';
  assert.deepEqual(assertNoChangeNetwork41([request('http://localhost:8285/test', '{}')], [secret]),
    [{ method: 'POST', origin: 'http://localhost:8285', path: '/test', hasBody: true }]);
  assert.throws(() => assertNoChangeNetwork41([request('http://localhost:8285/test', JSON.stringify({ note: secret }))], [secret]));
  assert.throws(() => assertNoChangeNetwork41([request('http://localhost:8285/test?note=' + encodeURIComponent(secret), '')], [secret]));
});
