import {
  buildRevenueCatAtomicArgs,
  persistRevenueCatEvent,
  RevenueCatAtomicProcessingError,
  type RevenueCatAtomicArgs,
  type RevenueCatEvent,
  type RevenueCatVerification,
} from './webhookCore.ts';

function assert(value: unknown, message: string): asserts value {
  if (!value) throw new Error(message);
}

// These are existing repository fixture IDs, not proposed production products.
const products = { monthly: 'layerwell_pro_monthly', annual: 'layerwell_pro_annual' };
const at = Date.parse('2026-10-07T00:00:00Z');
const day = 86_400_000;
const owner = '00000000-0000-4000-8000-000000000001';
const verification = { signatureVerified: true, authVerified: false };

function event(overrides: Record<string, unknown> = {}): RevenueCatEvent {
  return {
    id: 'c10-authority-event',
    type: 'INITIAL_PURCHASE',
    app_user_id: owner,
    entitlement_ids: ['pro'],
    product_id: products.monthly,
    store: 'APP_STORE',
    environment: 'PRODUCTION',
    period_type: 'NORMAL',
    event_timestamp_ms: at,
    purchased_at_ms: at - day,
    expiration_at_ms: at + 30 * day,
    transaction_id: 'c10-authority-transaction',
    original_transaction_id: 'c10-authority-chain',
    ...overrides,
  } as RevenueCatEvent;
}

// The explicit cast also lets these exact regressions run against the untouched
// baseline's three-argument mapper, which ignores the new product binding.
const build = buildRevenueCatAtomicArgs as (
  event: RevenueCatEvent,
  verification: RevenueCatVerification,
  receivedAt: Date,
  products?: { monthly: string; annual: string },
) => RevenueCatAtomicArgs;

function args(overrides: Record<string, unknown> = {}) {
  return build(event(overrides), verification, new Date(at), products);
}

for (const [name, change] of [
  ['missing entitlement', { entitlement_ids: undefined }],
  ['null entitlement', { entitlement_ids: null }],
  ['empty entitlements', { entitlement_ids: [] }],
  ['unrelated entitlement', { entitlement_ids: ['unrelated'] }],
  ['deferred Pro Plus', { entitlement_ids: ['pro_plus'] }],
  ['unknown product', { product_id: 'unrelated_subscription' }],
  ['missing product', { product_id: undefined }],
  ['unknown environment', { environment: 'FUTURE' }],
  ['missing environment', { environment: undefined }],
  ['contradictory sandbox flag', { environment: 'PRODUCTION', is_sandbox: true }],
  ['unknown store', { store: 'FUTURE_STORE' }],
  ['substring store', { store: 'NOT_APP_STORE' }],
  ['Mac store', { store: 'MAC_APP_STORE' }],
  ['Play store', { store: 'PLAY_STORE' }],
  ['web store', { store: 'STRIPE' }],
  ['provider promotion', { store: 'PROMOTIONAL' }],
  ['Test Store', { store: 'TEST_STORE' }],
  ['missing expiry', { expiration_at_ms: undefined }],
  ['unbounded expiry', { expiration_at_ms: null }],
  ['missing purchase time', { purchased_at_ms: undefined }],
  ['reversed paid window', { purchased_at_ms: at + 40 * day }],
  ['far-future initial purchase', { purchased_at_ms: at + 10 * day }],
  ['renewal beyond Apple early window', { type: 'RENEWAL', purchased_at_ms: at + 2 * day }],
  ['unknown period', { period_type: 'FUTURE' }],
  ['missing period', { period_type: undefined }],
  ['non-renewing purchase', { type: 'NON_RENEWING_PURCHASE' }],
  ['informative product change', { type: 'PRODUCT_CHANGE' }],
  ['Android pause', { type: 'SUBSCRIPTION_PAUSED' }],
  ['undocumented synthetic refund', { type: 'REFUND' }],
  ['unsupported event', { type: 'FUTURE_EVENT' }],
] as const) {
  Deno.test(`C10 audit-only: ${name} cannot create or replace paid authority`, () => {
    const mapped = args(change);
    assert(mapped.p_should_project === false, `${name} became a paid projection`);
  });
}

Deno.test('C10 a mapper without an explicit product binding fails closed', () => {
  const mapped = build(event(), verification, new Date(at));
  assert(!mapped.p_should_project, 'unconfigured products became paid authority');
});

for (const product of Object.values(products)) {
  for (const environment of ['PRODUCTION', 'SANDBOX']) {
    for (const period of ['NORMAL', 'TRIAL', 'INTRO']) {
      Deno.test(`C10 reviewed subscription ${product}/${environment}/${period}`, () => {
        const mapped = args({ product_id: product, environment, period_type: period });
        assert(mapped.p_should_project && mapped.p_is_active, 'reviewed store access was lost');
        assert(mapped.p_entitlement === 'pro', 'deferred tier was activated');
        assert(
          mapped.p_expiration_at === new Date(at + 30 * day).toISOString(),
          'finite expiry changed',
        );
      });
    }
  }
}

Deno.test('C10 unrelated entitlement labels do not override an explicit Pro mapping', () => {
  const mapped = args({ entitlement_ids: ['future_tier', 'pro', 'pro_plus'] });
  assert(
    mapped.p_should_project && mapped.p_entitlement === 'pro',
    'explicit Pro mapping changed tier',
  );
});

Deno.test('C10 ordinary cancellation keeps finite access and stops renewal', () => {
  const mapped = args({ type: 'CANCELLATION', cancel_reason: 'UNSUBSCRIBE' });
  assert(
    mapped.p_should_project && mapped.p_is_active && !mapped.p_will_renew,
    'cancellation revoked current access or promised renewal',
  );
});

Deno.test('C10 expiration cannot publish active access', () => {
  const mapped = args({ type: 'EXPIRATION', expiration_at_ms: at });
  assert(
    mapped.p_should_project && !mapped.p_is_active && !mapped.p_will_renew,
    'expiration granted access',
  );
});

Deno.test('C10 provider refund is CUSTOMER_SUPPORT cancellation and is inactive', () => {
  const mapped = args({ type: 'CANCELLATION', cancel_reason: 'CUSTOMER_SUPPORT' });
  assert(
    mapped.p_should_project && !mapped.p_is_active && mapped.p_projection_priority === 300,
    'actual provider refund retained paid access',
  );
});

Deno.test('C10 billing grace uses its explicit finite access bound', () => {
  const mapped = args({
    type: 'BILLING_ISSUE',
    purchased_at_ms: at - 30 * day,
    expiration_at_ms: at - day,
    grace_period_expiration_at_ms: at + 6 * day,
  });
  assert(
    mapped.p_should_project &&
      mapped.p_expiration_at === new Date(at + 6 * day).toISOString() &&
      mapped.p_projection_priority === 200,
    'valid billing grace was lost at the original paid expiry',
  );
});

for (const type of ['RENEWAL', 'UNCANCELLATION']) {
  Deno.test(`C10 ${type} preserves current finite subscription access`, () => {
    const mapped = args({ type });
    assert(
      mapped.p_should_project && mapped.p_is_active && mapped.p_will_renew,
      'subscription recovery was lost',
    );
  });
}

Deno.test('C10 Apple early renewal purchase timestamp remains valid', () => {
  const mapped = args({ type: 'RENEWAL', purchased_at_ms: at + day });
  assert(
    mapped.p_should_project && mapped.p_is_active,
    'Apple early renewal was incorrectly rejected',
  );
});

for (const [name, change] of [
  ['numeric store', { store: 7 }],
  ['numeric product', { product_id: 7 }],
  ['non-array entitlement IDs', { entitlement_ids: 'pro' }],
  ['mixed entitlement types', { entitlement_ids: ['pro', 7] }],
  ['string expiry', { expiration_at_ms: String(at + day) }],
  ['fractional expiry', { expiration_at_ms: at + 0.5 }],
  ['out-of-range expiry', { expiration_at_ms: Number.MAX_SAFE_INTEGER }],
  ['future event clock', { event_timestamp_ms: at + day }],
  ['negative event clock', { event_timestamp_ms: -1 }],
  ['string sandbox flag', { is_sandbox: 'false' }],
] as const) {
  Deno.test(`C10 malformed ${name} never reaches persistence`, () => {
    let rejected = false;
    try {
      args(change);
    } catch {
      rejected = true;
    }
    assert(rejected, `malformed ${name} was accepted`);
  });
}

Deno.test('C10 ambiguous RPC acknowledgements remain retryable', async () => {
  const valid = { outcome: 'processed', projection_applied: true, processing_status: 'processed' };
  for (const data of [
    [valid, valid],
    [{ ...valid, projection_applied: false }],
    [{ ...valid, processing_status: 'processing' }],
    [{ outcome: 'stale', projection_applied: true, processing_status: 'stale' }],
    [{ outcome: 'ignored', projection_applied: false, processing_status: 'processing' }],
    [{ outcome: 'duplicate', projection_applied: false, processing_status: 'processing' }],
    [],
    null,
  ]) {
    let rejected = false;
    try {
      await persistRevenueCatEvent({ rpc: () => Promise.resolve({ data, error: null }) }, args());
    } catch (error) {
      rejected = error instanceof RevenueCatAtomicProcessingError;
    }
    assert(rejected, 'ambiguous database response was acknowledged as accepted');
  }
});

Deno.test('C10 exact terminal RPC outcomes preserve existing replay semantics', async () => {
  for (const [outcome, projection_applied, processing_status] of [
    ['processed', true, 'processed'],
    ['stale', false, 'stale'],
    ['ignored', false, 'ignored_event_type'],
    ['unresolved', false, 'unresolved_user'],
    ['duplicate', true, 'processed'],
    ['duplicate', false, 'processed'],
    ['duplicate', false, 'stale'],
    ['duplicate', false, 'ignored_event_type'],
    ['suppressed_deleted_account', false, 'suppressed_deleted_account'],
  ] as const) {
    const row = { outcome, projection_applied, processing_status };
    const result = await persistRevenueCatEvent(
      { rpc: () => Promise.resolve({ data: [row], error: null }) },
      args(),
    );
    assert(result.outcome === outcome, 'valid terminal database response was rejected');
  }
});
