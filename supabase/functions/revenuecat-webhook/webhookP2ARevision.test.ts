import { buildRevenueCatAtomicArgs, type RevenueCatEvent } from './webhookCore.ts';

function assert(value: unknown, message: string): asserts value {
  if (!value) throw new Error(message);
}
const products = { monthly: 'layerwell_pro_monthly', annual: 'layerwell_pro_annual' };
const at = Date.parse('2026-10-07T00:00:00Z');
const day = 86_400_000;
function event(overrides: Record<string, unknown> = {}): RevenueCatEvent {
  return {
    id: 'director-fixture',
    type: 'INITIAL_PURCHASE',
    app_user_id: '00000000-0000-4000-8000-000000000001',
    entitlement_ids: ['pro'],
    product_id: products.monthly,
    store: 'APP_STORE',
    environment: 'PRODUCTION',
    period_type: 'NORMAL',
    event_timestamp_ms: at,
    purchased_at_ms: at - day,
    expiration_at_ms: at + 30 * day,
    transaction_id: 'fixture-current-transaction',
    original_transaction_id: 'fixture-chain',
    ...overrides,
  } as RevenueCatEvent;
}
function map(input: RevenueCatEvent) {
  return buildRevenueCatAtomicArgs(
    input,
    { authVerified: true, signatureVerified: false },
    new Date(input.event_timestamp_ms!),
    products,
  );
}
// A strict field rejection OR an audit-only mapping is acceptable. What is not
// acceptable is creating a new paid row that the candidate's own transaction
// correspondence gate cannot later revoke. Does not require widening old rows.
for (const [name, transaction_id] of [
  ['missing', undefined],
  ['null', null],
  ['empty', ''],
  ['blank', '   '],
] as const) {
  Deno.test(`Director P2A: ${name} transaction cannot seed uncorrelatable paid authority`, () => {
    let mapped;
    try {
      mapped = map(event({ transaction_id }));
    } catch {
      return;
    }
    assert(
      !mapped.p_should_project,
      `A ${name} transaction admitted p_should_project=${mapped.p_should_project}, ` +
        `p_is_active=${mapped.p_is_active}, p_transaction_id=${JSON.stringify(mapped.p_transaction_id)}`,
    );
  });
}
Deno.test('Director P2A: valid transaction control still admits the configured purchase', () => {
  const mapped = map(event());
  assert(mapped.p_should_project && mapped.p_is_active, 'valid purchase rejected');
});
Deno.test('Director P2A: valid early Apple renewal control remains accepted', () => {
  const mapped = map(
    event({
      type: 'RENEWAL',
      purchased_at_ms: at + 23 * 3_600_000,
      expiration_at_ms: at + 31 * day,
    }),
  );
  assert(mapped.p_should_project && mapped.p_is_active, 'early renewal rejected');
});
// Exact relative times from RevenueCat's official CANCELLATION sample. Only
// identity, product and entitlement are rebound to the existing synthetic
// reviewed-catalog fixture. No actual provider/dashboard request is sent.
Deno.test('Director P2A: documented Apple cancellation timing is not silently audit-only', () => {
  const mapped = map(
    event({
      type: 'CANCELLATION',
      cancel_reason: 'UNSUBSCRIBE',
      event_timestamp_ms: 1601337615995,
      purchased_at_ms: 1601417766000,
      expiration_at_ms: 1602022566000,
    }),
  );
  assert(
    mapped.p_should_project && !mapped.p_will_renew,
    'The documented cancellation was discarded by the five-minute purchase-start limit',
  );
});
// The same transaction was legitimately admitted by the early renewal rule.
// Lifecycle events generated before its billing start must not disappear just
// because they are not named RENEWAL. The SQL must still check exact ownership
// and correspondence; these tests do not authorize uncorrelated future grants.
for (const [reason, expectedActive] of [
  ['UNSUBSCRIBE', true],
  ['CUSTOMER_SUPPORT', false],
] as const) {
  Deno.test(
    `Director P2A: ${reason} for an already-admitted early renewal reaches lifecycle projection`,
    () => {
      const common = { purchased_at_ms: at + 23 * 3_600_000, expiration_at_ms: at + 31 * day };
      assert(
        map(event({ ...common, type: 'RENEWAL' })).p_should_project,
        'precondition renewal rejected',
      );
      const mapped = map(
        event({
          ...common,
          id: `director-${reason}`,
          type: 'CANCELLATION',
          cancel_reason: reason,
          event_timestamp_ms: at + 60_000,
        }),
      );
      assert(
        mapped.p_should_project && mapped.p_is_active === expectedActive,
        `Accepted early-renewal transaction cannot apply ${reason}; p_should_project=${mapped.p_should_project}`,
      );
    },
  );
}
