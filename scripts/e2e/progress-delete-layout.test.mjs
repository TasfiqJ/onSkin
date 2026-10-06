import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import { assertReachableControl, EMPTY_STATUSES, VIEWPORTS } from './progress-delete-layout.mjs';

const label = 'Take my first photo';
const control = {
  label,
  text: label,
  fullyVisible: true,
  centerHittable: true,
  aboveDock: true,
  touchTarget: true,
  rect: { x: 24, y: 400, width: 312, height: 52 },
};
function snapshot() {
  return { horizontalOverflow: 0, dock: { y: 552 }, controls: [{ ...control }] };
}

test('requires every requested viewport and local/remote/none/unavailable status', () => {
  assert.deepEqual(VIEWPORTS, [
    [360, 640],
    [375, 667],
    [390, 844],
  ]);
  assert.deepEqual(EMPTY_STATUSES, ['local', 'remote', 'none', 'unavailable']);
});
test('accepts a fully visible, reachable, correctly sized control', () => {
  assert.deepEqual(assertReachableControl(snapshot(), label), control);
});
for (const field of ['fullyVisible', 'centerHittable', 'aboveDock', 'touchTarget']) {
  test(`fails a layout where ${field} is false rather than counting a partial control as evidence`, () => {
    const value = snapshot();
    value.controls[0][field] = false;
    assert.throws(() => assertReachableControl(value, label));
  });
}
test('rejects horizontal overflow, missing dock, missing or duplicate actions', () => {
  for (const change of [
    { horizontalOverflow: 1 },
    { dock: null },
    { controls: [] },
    { controls: [control, control] },
  ]) {
    assert.throws(() => assertReachableControl({ ...snapshot(), ...change }, label));
  }
});
test('runner uses existing visible consent/bootstrap and real app with no authority overrides', () => {
  const source = readFileSync(new URL('./progress-delete-layout.mjs', import.meta.url), 'utf8');
  const fixture = readFileSync(
    new URL('./progress-delete-layout-fixture.mjs', import.meta.url),
    'utf8',
  );
  assert.match(source, /clickByText\(client, 'I agree\. Continue'\)/);
  assert.match(source, /Page\.bringToFront/);
  assert.match(source, /Input\.dispatchTouchEvent/);
  assert.match(source, /assertReachableControl\(measured, 'Take my first photo'\)/);
  assert.match(fixture, /writePhotoDeleteJournal/);
  assert.match(fixture, /runCurrentHealthDataOperation/);
  assert.match(fixture, /document\.elementFromPoint/);
  assert.doesNotMatch(
    fixture,
    /setActiveHealthProcessingEpoch|setAgeVerified|localStorage\.setItem|PhotoStorageGate\s*=|ProGate\s*=/,
  );
});
