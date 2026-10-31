import assert from 'node:assert/strict';
import test from 'node:test';

import {
  assertFreeFirstSession35,
  continueAfterReminderChoice35,
} from './onboarding-first-session.mjs';

// Source-level checks of the actual driver decisions with synthetic boundary
// IO. These do not replace the separate real Chrome/Expo journey receipts.
const savedCopy = 'Reminders are off. Your choice was saved.';
const unconfirmedCopy =
  'Your off choice is saved, but delivery is unconfirmed. Existing reminders may remain. You can retry or continue with delivery unconfirmed.';
const unconfirmedLabel = 'Continue with delivery unconfirmed';
const productNames = ['Retinol 0.3% serum', 'Glycolic 7% toner', 'Mineral SPF 50'];

function button(label = 'Continue', overrides = {}) {
  return {
    label,
    role: 'button',
    disabled: false,
    hitOk: true,
    width: 327,
    height: 56,
    ...overrides,
  };
}

function savedChoice(overrides = {}) {
  return {
    path: '/onboarding/notifications',
    bodyText: `SETUP 4 OF 5 ${savedCopy} Continue Turn reminders off`,
    controls: [button()],
    persistedOff: true,
    sameOwner: true,
    currentConsent: true,
    ...overrides,
  };
}

function driver(choice) {
  const events = [];
  return {
    events,
    io: {
      async readChoice() {
        events.push('read saved choice');
        return choice;
      },
      async click(label) {
        events.push(`tap ${label}`);
        await Promise.resolve();
        events.push('tap completed');
      },
      async waitForAccount() {
        events.push('wait for Account');
      },
    },
  };
}

test('saved OFF requires the visible Continue tap before waiting for Account', async () => {
  const { io, events } = driver(savedChoice());
  assert.deepEqual(await continueAfterReminderChoice35(io), { deliveryUnconfirmed: false });
  assert.deepEqual(events, [
    'read saved choice',
    'tap Continue',
    'tap completed',
    'wait for Account',
  ]);
});

test('saved OFF with explicit delivery uncertainty uses its acknowledged fallback', async () => {
  const { io, events } = driver(
    savedChoice({ bodyText: unconfirmedCopy, controls: [button(unconfirmedLabel)] }),
  );
  assert.deepEqual(await continueAfterReminderChoice35(io), { deliveryUnconfirmed: true });
  assert.deepEqual(events, [
    'read saved choice',
    `tap ${unconfirmedLabel}`,
    'tap completed',
    'wait for Account',
  ]);
});

const refusedChoices = [
  ['auto-advance to Account', savedChoice({ path: '/onboarding/account' })],
  ['unrelated route', savedChoice({ path: '/today' })],
  ['missing route', savedChoice({ path: undefined })],
  ['OFF was not persisted', savedChoice({ persistedOff: false })],
  ['persistence is unknown', savedChoice({ persistedOff: undefined })],
  ['string persistence marker', savedChoice({ persistedOff: 'true' })],
  ['old owner', savedChoice({ sameOwner: false })],
  ['unknown owner', savedChoice({ sameOwner: undefined })],
  ['consent bypass', savedChoice({ currentConsent: false })],
  ['unknown consent', savedChoice({ currentConsent: undefined })],
  ['unsaved choice copy', savedChoice({ bodyText: 'Reminders are off.' })],
  ['initial soft ask', savedChoice({ bodyText: 'A gentle nudge at your routine times?' })],
  ['save failed', savedChoice({ bodyText: 'We could not save your reminder choice.' })],
  ['missing Continue', savedChoice({ controls: [button('Turn reminders off')] })],
  ['disabled Continue', savedChoice({ controls: [button('Continue', { disabled: true })] })],
  ['blocked Continue', savedChoice({ controls: [button('Continue', { hitOk: false })] })],
  ['uncertainty without its explicit action', savedChoice({ bodyText: unconfirmedCopy })],
  [
    'fallback action without explicit uncertainty',
    savedChoice({ bodyText: 'Reminders are unconfirmed.', controls: [button(unconfirmedLabel)] }),
  ],
  [
    'uncertainty fallback is disabled',
    savedChoice({
      bodyText: unconfirmedCopy,
      controls: [button(unconfirmedLabel, { disabled: true })],
    }),
  ],
  [
    'uncertainty fallback is blocked',
    savedChoice({
      bodyText: unconfirmedCopy,
      controls: [button(unconfirmedLabel, { hitOk: false })],
    }),
  ],
  [
    'uncertainty without persisted OFF',
    savedChoice({
      bodyText: unconfirmedCopy,
      controls: [button(unconfirmedLabel)],
      persistedOff: false,
    }),
  ],
  [
    'uncertainty after owner retirement',
    savedChoice({
      bodyText: unconfirmedCopy,
      controls: [button(unconfirmedLabel)],
      sameOwner: false,
    }),
  ],
  [
    'uncertainty after consent withdrawal',
    savedChoice({
      bodyText: unconfirmedCopy,
      controls: [button(unconfirmedLabel)],
      currentConsent: false,
    }),
  ],
  ['missing controls', savedChoice({ controls: undefined })],
  ['malformed choice', null],
];

for (const [name, choice] of refusedChoices) {
  test(`reminder continuation refuses ${name} before any navigation`, async () => {
    const { io, events } = driver(choice);
    await assert.rejects(() => continueAfterReminderChoice35(io));
    assert.deepEqual(events, ['read saved choice']);
  });
}

test('a failed durable read remains a failure and never taps Continue', async () => {
  const { io, events } = driver(savedChoice());
  const refusedRead = new Error('Synthetic encrypted preference read unavailable');
  io.readChoice = async () => {
    events.push('read failed');
    throw refusedRead;
  };
  await assert.rejects(() => continueAfterReminderChoice35(io), (error) => error === refusedRead);
  assert.deepEqual(events, ['read failed']);
});

test('a refused Continue tap never proceeds to the Account route assertion', async () => {
  const { io, events } = driver(savedChoice());
  const refusedTap = new Error('Synthetic label tap failed');
  io.click = async () => {
    events.push('tap refused');
    throw refusedTap;
  };
  await assert.rejects(() => continueAfterReminderChoice35(io), (error) => error === refusedTap);
  assert.deepEqual(events, ['read saved choice', 'tap refused']);
});

test('a missing Account arrival cannot be published as successful continuation', async () => {
  const { io, events } = driver(savedChoice());
  const routeFailure = new Error('Synthetic Account navigation timeout');
  io.waitForAccount = async () => {
    events.push('Account did not arrive');
    throw routeFailure;
  };
  await assert.rejects(() => continueAfterReminderChoice35(io), (error) => error === routeFailure);
  assert.deepEqual(events, [
    'read saved choice',
    'tap Continue',
    'tap completed',
    'Account did not arrive',
  ]);
});

function freeReceipt(overrides = {}) {
  return {
    sameOwner: true,
    currentConsent: true,
    proActive: false,
    products: [...productNames],
    ...overrides,
  };
}

test('free first-session receipt requires exactly the three products under current authority', () => {
  assert.doesNotThrow(() => assertFreeFirstSession35(freeReceipt(), productNames));
  assert.doesNotThrow(() =>
    assertFreeFirstSession35(freeReceipt({ products: [...productNames].reverse() }), productNames),
  );
});

const refusedReceipts = [
  ['old owner', freeReceipt({ sameOwner: false })],
  ['unknown owner', freeReceipt({ sameOwner: undefined })],
  ['consent bypass', freeReceipt({ currentConsent: false })],
  ['unknown consent', freeReceipt({ currentConsent: undefined })],
  ['forged Pro authority', freeReceipt({ proActive: true })],
  ['unknown paid authority', freeReceipt({ proActive: undefined })],
  ['coerced free authority', freeReceipt({ proActive: 0 })],
  ['a missing product', freeReceipt({ products: productNames.slice(0, 2) })],
  ['another owner product', freeReceipt({ products: ['Other owner product', ...productNames.slice(1)] })],
  ['duplicated products', freeReceipt({ products: [productNames[0], productNames[0], productNames[2]] })],
  ['an extra product', freeReceipt({ products: [...productNames, 'Unexpected product'] })],
  ['missing products', freeReceipt({ products: undefined })],
  ['malformed products', freeReceipt({ products: productNames.join(',') })],
  ['malformed receipt', null],
];

for (const [name, receipt] of refusedReceipts) {
  test(`free first-session receipt refuses ${name}`, () => {
    assert.throws(() => assertFreeFirstSession35(receipt, productNames));
  });
}
