import {
  RevenueCatSnapshotError,
  buildRevenueCatCustomerInfoRequest,
  parseRevenueCatCustomerInfoSnapshot,
} from './reconciliationCore.ts';

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(message);
}

function assertSnapshotError(action: () => unknown, code: RevenueCatSnapshotError['code']): void {
  try {
    action();
  } catch (error) {
    assert(error instanceof RevenueCatSnapshotError, 'expected a contained snapshot error.');
    assert(error.code === code, `expected ${code}; received ${error.code}.`);
    return;
  }
  throw new Error(`expected ${code}.`);
}

const USER_ID = '10000000-0000-4000-8000-000000000001';
const NOW = Date.parse('2026-07-14T12:00:00.000Z');
type TestSubscriber = {
  entitlements: Record<string, Record<string, unknown>>;
  subscriptions: Record<string, Record<string, unknown>>;
  non_subscriptions: Record<string, Array<Record<string, unknown>>>;
  management_url?: unknown;
};

function response(overrides: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    request_date: '2026-07-14T11:59:30Z',
    request_date_ms: Date.parse('2026-07-14T11:59:30Z'),
    subscriber: {
      entitlements: {
        pro: {
          product_identifier: 'routinekind_pro_annual',
          purchase_date: '2026-07-01T12:00:00Z',
          expires_date: '2027-07-01T12:00:00Z',
          grace_period_expires_date: null,
        },
      },
      subscriptions: {
        routinekind_pro_annual: {
          expires_date: '2027-07-01T12:00:00Z',
          grace_period_expires_date: null,
          store: 'APP_STORE',
          period_type: 'NORMAL',
          is_sandbox: false,
          original_purchase_date: '2026-07-01T12:00:00Z',
          purchase_date: '2026-07-01T12:00:00Z',
          unsubscribe_detected_at: null,
        },
      },
      non_subscriptions: {},
      original_app_user_id: USER_ID,
      management_url: 'https://apps.apple.com/account/subscriptions',
    },
    ...overrides,
  };
}

Deno.test('RevenueCat reconciliation maps a fresh provider CustomerInfo snapshot', () => {
  const snapshot = parseRevenueCatCustomerInfoSnapshot(response(), USER_ID, NOW, 120_000);
  assert(snapshot.p_user_id === USER_ID, 'the server-derived subject changed.');
  assert(snapshot.p_snapshot_at === '2026-07-14T11:59:30.000Z', 'request_date was not used.');
  assert(snapshot.p_entitlement === 'pro' && snapshot.p_is_active, 'active pro was lost.');
  assert(snapshot.p_product_id === 'routinekind_pro_annual', 'product was not mapped.');
  assert(snapshot.p_store === 'app_store', 'store was not normalized.');
  assert(snapshot.p_environment === 'production', 'environment was not provider-derived.');
  assert(snapshot.p_will_renew, 'renewal state was not conservatively inferred.');
  assert(snapshot.p_offering_id === null && snapshot.p_package_id === null, 'IDs were invented.');
});

Deno.test('RevenueCat reconciliation uses grace expiry and prefers active pro_plus', () => {
  const body = response();
  const subscriber = body.subscriber as TestSubscriber;
  subscriber.entitlements.pro_plus = {
    product_identifier: 'routinekind_pro_plus',
    purchase_date: '2026-07-10T12:00:00Z',
    expires_date: '2026-07-14T11:00:00Z',
    grace_period_expires_date: '2026-07-16T12:00:00Z',
  };
  subscriber.subscriptions.routinekind_pro_plus = {
    expires_date: '2026-07-14T11:00:00Z',
    grace_period_expires_date: '2026-07-16T12:00:00Z',
    store: 'PLAY_STORE',
    period_type: 'TRIAL',
    is_sandbox: true,
    original_purchase_date: '2026-07-10T12:00:00Z',
    purchase_date: '2026-07-10T12:00:00Z',
    unsubscribe_detected_at: '2026-07-12T12:00:00Z',
  };
  const snapshot = parseRevenueCatCustomerInfoSnapshot(body, USER_ID, NOW, 120_000);
  assert(snapshot.p_entitlement === 'pro_plus', 'active pro_plus must win over pro.');
  assert(snapshot.p_expires_at === '2026-07-16T12:00:00.000Z', 'grace expiry was lost.');
  assert(snapshot.p_environment === 'sandbox', 'sandbox status was lost.');
  assert(!snapshot.p_will_renew, 'an unsubscribed subscription must not claim renewal.');
});

Deno.test('RevenueCat reconciliation represents an absent relevant entitlement as inactive', () => {
  const body = response();
  const subscriber = body.subscriber as TestSubscriber;
  subscriber.entitlements = {};
  subscriber.subscriptions = {};
  subscriber.non_subscriptions = {};
  subscriber.management_url = 'https://attacker.example/subscriptions';
  const snapshot = parseRevenueCatCustomerInfoSnapshot(body, USER_ID, NOW, 120_000);
  assert(snapshot.p_entitlement === null && !snapshot.p_is_active, 'absence must be inactive.');
  assert(
    snapshot.p_product_id === null && snapshot.p_store === null,
    'provider IDs were invented.',
  );
  assert(snapshot.p_management_url === null, 'an untrusted management URL escaped.');
});

Deno.test(
  'RevenueCat promotional authority remains provider-side and never becomes app_granted',
  () => {
    const body = response();
    const subscriber = body.subscriber as TestSubscriber;
    subscriber.subscriptions.routinekind_pro_annual.store = 'PROMOTIONAL';
    const snapshot = parseRevenueCatCustomerInfoSnapshot(body, USER_ID, NOW, 120_000);
    assert(snapshot.p_store === 'promotional', 'promotional store was misclassified.');
    assert(!snapshot.p_will_renew, 'a promotional entitlement must not claim renewal.');
  },
);

Deno.test('RevenueCat reconciliation accepts a product tied to non-subscription evidence', () => {
  const body = response();
  const subscriber = body.subscriber as TestSubscriber;
  subscriber.entitlements.pro = {
    product_identifier: 'routinekind_pro_lifetime',
    purchase_date: '2026-07-01T12:00:00Z',
    expires_date: null,
    grace_period_expires_date: null,
  };
  subscriber.subscriptions = {};
  subscriber.non_subscriptions.routinekind_pro_lifetime = [
    {
      id: 'lifetime-transaction',
      is_sandbox: false,
      purchase_date: '2026-07-01T12:00:00Z',
      store: 'APP_STORE',
    },
  ];

  const snapshot = parseRevenueCatCustomerInfoSnapshot(body, USER_ID, NOW, 120_000);
  assert(snapshot.p_product_id === 'routinekind_pro_lifetime', 'lifetime product was lost.');
  assert(snapshot.p_store === 'app_store' && snapshot.p_is_active, 'lifetime proof was lost.');
  assert(snapshot.p_period_type === null && !snapshot.p_will_renew, 'lifetime renewed.');
});

Deno.test('RevenueCat reconciliation rejects malformed positive product evidence', () => {
  const mutations: Array<(body: Record<string, unknown>) => void> = [
    (body) => {
      const subscriber = body.subscriber as TestSubscriber;
      delete subscriber.entitlements.pro.product_identifier;
    },
    (body) => {
      const subscriber = body.subscriber as TestSubscriber;
      subscriber.entitlements.pro.product_identifier = '   ';
    },
    (body) => {
      const subscriber = body.subscriber as TestSubscriber;
      subscriber.entitlements.pro.product_identifier = 'unmatched-product';
    },
    (body) => {
      const subscriber = body.subscriber as TestSubscriber;
      delete subscriber.subscriptions.routinekind_pro_annual.store;
    },
    (body) => {
      const subscriber = body.subscriber as TestSubscriber;
      subscriber.non_subscriptions.routinekind_pro_annual = [
        {
          id: 'contradictory-transaction',
          is_sandbox: false,
          purchase_date: '2026-07-01T12:00:00Z',
          store: 'APP_STORE',
        },
      ];
    },
    (body) => {
      const subscriber = body.subscriber as TestSubscriber;
      subscriber.entitlements.pro.expires_date = null;
      subscriber.subscriptions.routinekind_pro_annual.expires_date = '2026-07-14T11:00:00Z';
    },
    (body) => {
      const subscriber = body.subscriber as TestSubscriber;
      subscriber.entitlements.pro.purchase_date = '2026-07-02T12:00:00Z';
    },
    (body) => {
      const subscriber = body.subscriber as TestSubscriber;
      subscriber.subscriptions.routinekind_pro_annual.grace_period_expires_date =
        '2027-07-02T12:00:00Z';
    },
  ];

  for (const mutate of mutations) {
    const body = response();
    mutate(body);
    assertSnapshotError(
      () => parseRevenueCatCustomerInfoSnapshot(body, USER_ID, NOW, 120_000),
      'REVENUECAT_CUSTOMER_INFO_INVALID',
    );
  }
});

Deno.test('RevenueCat reconciliation requires exact root and subscriber fields', () => {
  for (const mutate of [
    (body: Record<string, unknown>) => delete body.request_date_ms,
    (body: Record<string, unknown>) => {
      delete (body.subscriber as Record<string, unknown>).subscriptions;
    },
    (body: Record<string, unknown>) => {
      delete (body.subscriber as Record<string, unknown>).non_subscriptions;
    },
    (body: Record<string, unknown>) => {
      (body.subscriber as Record<string, unknown>).management_url = 42;
    },
  ]) {
    const body = response();
    mutate(body);
    assertSnapshotError(
      () => parseRevenueCatCustomerInfoSnapshot(body, USER_ID, NOW, 120_000),
      'REVENUECAT_CUSTOMER_INFO_INVALID',
    );
  }
});

Deno.test('RevenueCat reconciliation rejects stale or fabricated watermark fields', () => {
  assertSnapshotError(
    () =>
      parseRevenueCatCustomerInfoSnapshot(
        response({ request_date: '2026-07-14T11:50:00Z' }),
        USER_ID,
        NOW,
        120_000,
      ),
    'REVENUECAT_CUSTOMER_INFO_STALE',
  );
  const camelCase = response({ request_date: undefined, requestDate: '2026-07-14T11:59:30Z' });
  assertSnapshotError(
    () => parseRevenueCatCustomerInfoSnapshot(camelCase, USER_ID, NOW, 120_000),
    'REVENUECAT_CUSTOMER_INFO_INVALID',
  );
  const observedAt = response({ request_date: undefined, observedAt: '2026-07-14T11:59:30Z' });
  assertSnapshotError(
    () => parseRevenueCatCustomerInfoSnapshot(observedAt, USER_ID, NOW, 120_000),
    'REVENUECAT_CUSTOMER_INFO_INVALID',
  );
});

Deno.test(
  'RevenueCat reconciliation rejects inconsistent clocks and unknown/app grant stores',
  () => {
    assertSnapshotError(
      () =>
        parseRevenueCatCustomerInfoSnapshot(
          response({ request_date_ms: Date.parse('2026-07-14T11:00:00Z') }),
          USER_ID,
          NOW,
          120_000,
        ),
      'REVENUECAT_CUSTOMER_INFO_INVALID',
    );
    for (const store of ['APP_GRANTED', 'UNREVIEWED_STORE']) {
      const body = response();
      const subscriber = body.subscriber as TestSubscriber;
      subscriber.subscriptions.routinekind_pro_annual.store = store;
      assertSnapshotError(
        () => parseRevenueCatCustomerInfoSnapshot(body, USER_ID, NOW, 120_000),
        'REVENUECAT_CUSTOMER_INFO_INVALID',
      );
    }
  },
);

Deno.test(
  'RevenueCat request is bound to the authenticated UUID and disables caching/redirects',
  () => {
    const request = buildRevenueCatCustomerInfoRequest(USER_ID, 'sk_secret_key');
    assert(request.url.endsWith(`/subscribers/${USER_ID}`), 'provider request subject changed.');
    assert(
      request.init.method === 'GET' && request.init.redirect === 'error',
      'request is unbounded.',
    );
    const headers = request.init.headers as Record<string, string>;
    assert(headers.Authorization === 'Bearer sk_secret_key', 'secret header changed.');
    assert(headers['Cache-Control'].includes('no-cache'), 'provider caching was not discouraged.');
  },
);
