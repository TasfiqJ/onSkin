import { transport } from './webhookHttp.fixture.ts';

function assert(value: unknown, message: string): asserts value {
  if (!value) throw new Error(message);
}

const fixtureEnv: Record<string, string> = {
  APP_ENV: 'development',
  DB06_TRAFFIC_FREEZE: 'open',
  SUPABASE_URL: 'http://127.0.0.1:54321',
  SUPABASE_SECRET_KEY: 'fixture-service-key',
  REVENUECAT_WEBHOOK_AUTH: 'fixture-only-authorization',
  REVENUECAT_PROJECT_ID: 'proj_fixture123',
  REVENUECAT_IDENTITY_TOMBSTONE_HMAC_KEYS: `1=${'11'.repeat(32)}`,
  REVENUECAT_IDENTITY_TOMBSTONE_HMAC_CURRENT_VERSION: '1',
  EXPO_PUBLIC_REVENUECAT_MONTHLY_PRODUCT_ID: 'layerwell_pro_monthly',
  EXPO_PUBLIC_REVENUECAT_ANNUAL_PRODUCT_ID: 'layerwell_pro_annual',
};
const clearEnv = [
  'EXPO_PUBLIC_APP_ENV',
  'SUPABASE_SECRET_KEYS',
  'SUPABASE_SERVICE_ROLE_KEY',
  'REVENUECAT_WEBHOOK_SIGNING_SECRET',
  'REVENUECAT_WEBHOOK_SIGNATURE_TOLERANCE_SECONDS',
  'REVENUECAT_WEBHOOK_MAX_BYTES',
];
const encoder = new TextEncoder();
let fixtureId = 0;
type Handler = (request: Request) => Promise<Response>;

function payload(change: Record<string, unknown> = {}) {
  const now = Date.now();
  return JSON.stringify({
    api_version: '1.0',
    event: {
      id: 'c10-http-fixture',
      type: 'INITIAL_PURCHASE',
      app_user_id: '00000000-0000-4000-8000-000000000001',
      original_app_user_id: '00000000-0000-4000-8000-000000000001',
      entitlement_ids: ['pro'],
      product_id: 'layerwell_pro_monthly',
      store: 'APP_STORE',
      environment: 'PRODUCTION',
      period_type: 'NORMAL',
      event_timestamp_ms: now,
      purchased_at_ms: now - 1_000,
      expiration_at_ms: now + 86_400_000,
      transaction_id: 'c10-http-transaction',
      original_transaction_id: 'c10-http-original',
      ...change,
    },
  });
}

async function withHandler(
  changes: Record<string, string | undefined>,
  test: (handler: Handler) => Promise<void>,
) {
  const names = [...new Set([...Object.keys(fixtureEnv), ...clearEnv, ...Object.keys(changes)])];
  const previous = new Map(names.map((name) => [name, Deno.env.get(name)]));
  const originalServe = Deno.serve;
  let handler: Handler | undefined;
  transport.calls.length = 0;
  transport.error = null;
  transport.reject = false;
  transport.data = [
    { outcome: 'processed', projection_applied: true, processing_status: 'processed' },
  ];
  try {
    for (const name of names) {
      const value = Object.hasOwn(changes, name) ? changes[name] : fixtureEnv[name];
      if (value === undefined) Deno.env.delete(name);
      else Deno.env.set(name, value);
    }
    Deno.serve = ((received: Handler) => {
      handler = received;
      return {};
    }) as unknown as typeof Deno.serve;
    await import(new URL(`./index.ts?http-fixture=${fixtureId++}`, import.meta.url).href);
    assert(handler, 'real index.ts did not register its handler');
    await test(handler);
  } finally {
    Deno.serve = originalServe;
    for (const [name, value] of previous) {
      if (value === undefined) Deno.env.delete(name);
      else Deno.env.set(name, value);
    }
  }
}

function request(body: BodyInit = payload(), extra: Record<string, string> = {}) {
  return new Request('http://localhost/revenuecat-webhook', {
    method: 'POST',
    body,
    headers: { Authorization: fixtureEnv.REVENUECAT_WEBHOOK_AUTH, ...extra },
  });
}

async function signature(
  body: Uint8Array,
  secret: string,
  timestamp = Math.floor(Date.now() / 1000),
) {
  const prefix = encoder.encode(`${timestamp}.`);
  const bytes = new Uint8Array(prefix.length + body.length);
  bytes.set(prefix);
  bytes.set(body, prefix.length);
  const key = await crypto.subtle.importKey(
    'raw',
    encoder.encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign'],
  );
  const hash = await crypto.subtle.sign('HMAC', key, bytes);
  const hex = [...new Uint8Array(hash)]
    .map((value) => value.toString(16).padStart(2, '0'))
    .join('');
  return `t=${timestamp},v1=${hex}`;
}

Deno.test(
  'C10 HTTP real handler persists verified intake through only the guarded RPC',
  async () => {
    await withHandler({}, async (handler) => {
      const response = await handler(request());
      assert(response.status === 200, 'valid request failed');
      assert(transport.calls.length === 1, 'request did not use one atomic RPC');
      const call = transport.calls[0];
      assert(
        call.functionName === 'process_revenuecat_webhook_event_guarded',
        'unguarded RPC called',
      );
      assert(
        call.args.p_auth_verified === true && call.args.p_signature_verified === false,
        'verification provenance changed',
      );
      assert(call.args.p_identity_hmacs.length > 0, 'identity barrier was not attached');
      assert(call.args.p_should_project, 'reviewed purchase was not projected');
    });
  },
);

for (const [name, buildRequest, expected] of [
  ['wrong method', () => new Request('http://localhost', { method: 'GET' }), 405],
  ['missing auth', () => new Request('http://localhost', { method: 'POST', body: payload() }), 401],
  ['wrong auth', () => request(payload(), { Authorization: 'wrong' }), 401],
  ['invalid JSON', () => request('{'), 400],
  ['missing event', () => request('{}'), 400],
  ['scalar event', () => request('{"event":7}'), 400],
  ['invalid owner shape', () => request(payload({ aliases: [7] })), 400],
  ['invalid product shape', () => request(payload({ product_id: 7 })), 400],
  ['invalid expiry shape', () => request(payload({ expiration_at_ms: 'tomorrow' })), 400],
  ['invalid entitlement shape', () => request(payload({ entitlement_ids: ['pro', 7] })), 400],
] as const) {
  Deno.test(`C10 HTTP ${name} writes nothing`, async () => {
    await withHandler({}, async (handler) => {
      const response = await handler(buildRequest());
      assert(
        response.status === expected,
        `${name}: expected ${expected}, received ${response.status}`,
      );
      assert(!transport.calls.length, `${name} reached persistence`);
    });
  });
}

for (const [name, changes] of [
  ['no verification', { REVENUECAT_WEBHOOK_AUTH: undefined }],
  ['no identity keys', { REVENUECAT_IDENTITY_TOMBSTONE_HMAC_KEYS: undefined }],
  ['invalid identity project', { REVENUECAT_PROJECT_ID: 'bad project' }],
  ['no product binding', { EXPO_PUBLIC_REVENUECAT_MONTHLY_PRODUCT_ID: undefined }],
  [
    'identical product binding',
    { EXPO_PUBLIC_REVENUECAT_ANNUAL_PRODUCT_ID: 'layerwell_pro_monthly' },
  ],
  ['staging freeze', { APP_ENV: 'staging', DB06_TRAFFIC_FREEZE: 'frozen' }],
] as const) {
  Deno.test(`C10 HTTP unavailable ${name} retries without writes`, async () => {
    await withHandler(changes, async (handler) => {
      const response = await handler(request());
      assert(response.status === 503, `${name} was not unavailable`);
      assert(!transport.calls.length, `${name} reached persistence`);
    });
  });
}

Deno.test('C10 HTTP bounded body rejects declared and streamed over-limit input', async () => {
  await withHandler({ REVENUECAT_WEBHOOK_MAX_BYTES: '1024' }, async (handler) => {
    for (const input of [request('x', { 'Content-Length': '2048' }), request('x'.repeat(1025))]) {
      const response = await handler(input);
      assert(response.status === 413, 'oversized body was accepted');
    }
    assert(!transport.calls.length, 'oversized body reached persistence');
  });
});

const signingSecret = 'fixture-only-hmac-signing-secret';
Deno.test('C10 HTTP HMAC-only and dual verification modes use fresh delivery time', async () => {
  for (const requireAuth of [false, true]) {
    await withHandler(
      {
        REVENUECAT_WEBHOOK_SIGNING_SECRET: signingSecret,
        REVENUECAT_WEBHOOK_AUTH: requireAuth ? fixtureEnv.REVENUECAT_WEBHOOK_AUTH : undefined,
      },
      async (handler) => {
        const body = encoder.encode(payload({ event_timestamp_ms: Date.now() - 86_400_000 }));
        const header = await signature(body, signingSecret);
        const response = await handler(request(body, { 'X-RevenueCat-Webhook-Signature': header }));
        assert(response.status === 200, 'legitimate delayed-event delivery was rejected');
        assert(
          transport.calls.length === 1 && transport.calls[0].args.p_signature_verified,
          'signed request lost verification',
        );
      },
    );
  }
});

Deno.test('C10 HTTP configured HMAC cannot be bypassed with Authorization alone', async () => {
  await withHandler({ REVENUECAT_WEBHOOK_SIGNING_SECRET: signingSecret }, async (handler) => {
    for (const header of [
      '',
      't=1,v1=bad',
      await signature(
        encoder.encode(payload()),
        signingSecret,
        Math.floor(Date.now() / 1000) - 600,
      ),
    ]) {
      const response = await handler(
        request(payload(), { 'X-RevenueCat-Webhook-Signature': header }),
      );
      assert(response.status === 401, 'missing, invalid, or stale HMAC was accepted');
    }
    assert(!transport.calls.length, 'bad HMAC reached persistence');
  });
});

Deno.test('C10 HTTP HMAC binds exact bytes before UTF-8/BOM decoding', async () => {
  await withHandler({ REVENUECAT_WEBHOOK_SIGNING_SECRET: signingSecret }, async (handler) => {
    const body = encoder.encode(payload());
    const header = await signature(body, signingSecret);
    const tampered = new Uint8Array(body.length + 3);
    tampered.set([0xef, 0xbb, 0xbf]);
    tampered.set(body, 3);
    const response = await handler(request(tampered, { 'X-RevenueCat-Webhook-Signature': header }));
    assert(
      response.status === 401,
      'unsigned byte mutation was accepted after TextDecoder normalized it',
    );
    assert(!transport.calls.length, 'byte-tampered request reached persistence');
  });
});

Deno.test('C10 HTTP out-of-contract evidence is audited without paid projection', async () => {
  for (const change of [
    { entitlement_ids: ['unrelated'] },
    { product_id: 'unknown_product' },
    { environment: 'UNKNOWN' },
  ]) {
    await withHandler({}, async (handler) => {
      transport.data = [
        { outcome: 'ignored', projection_applied: false, processing_status: 'ignored_event_type' },
      ];
      const response = await handler(request(payload(change)));
      assert(response.status === 200 && transport.calls.length === 1, 'audit evidence was dropped');
      assert(!transport.calls[0].args.p_should_project, 'unrelated evidence became paid authority');
    });
  }
});

Deno.test('C10 HTTP failed or ambiguous database responses request provider retry', async () => {
  for (const mode of [
    'rpc-error',
    'transport-loss',
    'error-row',
    'empty',
    'multiple',
    'inconsistent',
  ]) {
    await withHandler({}, async (handler) => {
      if (mode === 'rpc-error') transport.error = { message: 'fixture database failure' };
      if (mode === 'transport-loss') transport.reject = true;
      if (mode === 'error-row')
        transport.data = [
          { outcome: 'error', projection_applied: false, processing_status: 'error' },
        ];
      if (mode === 'empty') transport.data = [];
      if (mode === 'multiple') transport.data = [transport.data, transport.data].flat();
      if (mode === 'inconsistent')
        transport.data = [
          { outcome: 'processed', projection_applied: false, processing_status: 'processing' },
        ];
      const response = await handler(request());
      assert(response.status === 503, `${mode} was acknowledged as accepted`);
      assert((await response.text()) === 'processing failed', 'unstable database details escaped');
    });
  }
});

Deno.test(
  'C10 HTTP duplicate and deleted-owner outcomes preserve exact acknowledgement',
  async () => {
    for (const row of [
      { outcome: 'duplicate', projection_applied: true, processing_status: 'processed' },
      {
        outcome: 'suppressed_deleted_account',
        projection_applied: false,
        processing_status: 'suppressed_deleted_account',
      },
    ]) {
      await withHandler({}, async (handler) => {
        transport.data = [row];
        const response = await handler(request());
        assert(response.status === 200, 'terminal duplicate or suppression was rejected');
      });
    }
  },
);
