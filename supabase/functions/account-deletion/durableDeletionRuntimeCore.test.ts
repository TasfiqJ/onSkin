import {
  ACCOUNT_DELETION_APPLE_CODE_MAX_CHARS,
  accountDeletionRetryDelaySeconds,
  classifyAuthHardDeleteResult,
  classifyAuthUserLookupResult,
  constantTimeEqual,
  deletionIntakeOwnerHmac,
  deletionStatusLookupFromDatabaseRow,
  deletionSubjectHmac,
  DurableDeletionRuntimeCoreError,
  loadDeletionReceiptHmacKey,
  parseAccountDeletionRequest,
  validDeletionResultCode,
  verifiedAuthSessionClaimsFromJwt,
} from './durableDeletionRuntimeCore.ts';

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(message);
}

function assertDeepEqual(actual: unknown, expected: unknown, message = 'mismatch'): void {
  const left = JSON.stringify(actual);
  const right = JSON.stringify(expected);
  if (left !== right) throw new Error(`${message}: ${left} !== ${right}`);
}

function assertRuntimeError(action: () => unknown, expected: string): void {
  try {
    action();
  } catch (error) {
    assert(error instanceof DurableDeletionRuntimeCoreError, 'expected typed error');
    assert(error.code === expected, `expected ${expected}, got ${error.code}`);
    return;
  }
  throw new Error(`expected ${expected}`);
}

const IDEMPOTENCY = '11'.repeat(32);
const CAPABILITY = '22'.repeat(32);
const USER_ID = '11111111-1111-4111-8111-111111111111';
const LETTER_USER_ID = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
const SESSION_ID = '33333333-3333-4333-8333-333333333333';

function jwt(payload: Record<string, unknown>): string {
  const encode = (value: Record<string, unknown>) =>
    btoa(JSON.stringify(value)).replaceAll('+', '-').replaceAll('/', '_').replaceAll('=', '');
  return `${encode({ alg: 'ES256', typ: 'JWT' })}.${encode(payload)}.signature`;
}

Deno.test('request parser accepts only exact begin/preflight/status/work envelopes', () => {
  assertDeepEqual(parseAccountDeletionRequest({ action: 'preflight' }), { action: 'preflight' });
  assertDeepEqual(
    parseAccountDeletionRequest({
      action: 'begin',
      idempotencyKey: IDEMPOTENCY,
      statusCapability: CAPABILITY,
      appleAuthorizationCode: 'apple-code',
    }),
    {
      action: 'begin',
      idempotencyKey: IDEMPOTENCY,
      statusCapability: CAPABILITY,
      appleAuthorizationCode: 'apple-code',
    },
  );
  assertDeepEqual(
    parseAccountDeletionRequest({
      action: 'status',
      capability: CAPABILITY,
    }),
    { action: 'status', capability: CAPABILITY },
  );
  assertDeepEqual(parseAccountDeletionRequest({ action: 'work' }), {
    action: 'work',
  });
  for (const action of [
    'publication_reserve',
    'publication_activate',
    'publication_renew',
    'publication_release',
  ] as const) {
    assertDeepEqual(parseAccountDeletionRequest({ action, capability: CAPABILITY }), {
      action,
      capability: CAPABILITY,
    });
  }
});

Deno.test('request parser rejects token reuse, extras, controls, and oversized Apple codes', () => {
  const invalid: unknown[] = [
    null,
    {},
    { action: 'work', extra: true },
    { action: 'preflight', extra: true },
    { action: 'status', capability: CAPABILITY, extra: true },
    { action: 'status', capability: 'AB'.repeat(32) },
    { action: 'publication_reserve', capability: CAPABILITY, extra: true },
    { action: 'publication_activate', capability: 'AB'.repeat(32) },
    { action: 'publication_renew', capability: `${CAPABILITY}0` },
    { action: 'publication_release' },
    {
      action: 'begin',
      idempotencyKey: CAPABILITY,
      statusCapability: CAPABILITY,
    },
    {
      action: 'begin',
      idempotencyKey: IDEMPOTENCY,
      statusCapability: CAPABILITY,
      appleAuthorizationCode: ' leading',
    },
    {
      action: 'begin',
      idempotencyKey: IDEMPOTENCY,
      statusCapability: CAPABILITY,
      appleAuthorizationCode: 'bad\ncode',
    },
    {
      action: 'begin',
      idempotencyKey: IDEMPOTENCY,
      statusCapability: CAPABILITY,
      appleAuthorizationCode: 'a'.repeat(ACCOUNT_DELETION_APPLE_CODE_MAX_CHARS + 1),
    },
  ];
  for (const value of invalid) {
    assertRuntimeError(() => parseAccountDeletionRequest(value), 'DELETION_REQUEST_INVALID');
  }
});

Deno.test('verified Auth JWT claims bind canonical subject and session id', () => {
  assertDeepEqual(
    verifiedAuthSessionClaimsFromJwt(
      jwt({ sub: USER_ID, session_id: SESSION_ID, role: 'authenticated' }),
      USER_ID,
    ),
    { subject: USER_ID, sessionId: SESSION_ID },
  );
  for (const [token, expectedUserId] of [
    ['not-a-jwt', USER_ID],
    ['a.%%%%.c', USER_ID],
    [jwt({ sub: USER_ID }), USER_ID],
    [jwt({ sub: USER_ID, session_id: 'not-a-uuid' }), USER_ID],
    [jwt({ sub: LETTER_USER_ID.toUpperCase(), session_id: SESSION_ID }), LETTER_USER_ID],
    [
      jwt({
        sub: '22222222-2222-4222-8222-222222222222',
        session_id: SESSION_ID,
      }),
      USER_ID,
    ],
    [jwt({ sub: LETTER_USER_ID, session_id: SESSION_ID }), LETTER_USER_ID.toUpperCase()],
  ] as const) {
    assert(
      verifiedAuthSessionClaimsFromJwt(token, expectedUserId) === null,
      'malformed or misbound claims must reject the session',
    );
  }
});

Deno.test('constant-time comparison is exact without prefix acceptance', () => {
  assert(constantTimeEqual('worker-secret', 'worker-secret'), 'exact match');
  assert(!constantTimeEqual('worker-secret', 'worker-secreu'), 'different byte');
  assert(!constantTimeEqual('worker-secret', 'worker-secret-extra'), 'length');
  assert(!constantTimeEqual('', 'x'), 'empty mismatch');
});

Deno.test('Auth hard-delete classifier never redispatches an ambiguous outcome', () => {
  assert(
    classifyAuthHardDeleteResult({ data: { user: {} }, error: null }) === 'verify_absence',
    '200 success enters absence verification',
  );
  assert(
    classifyAuthHardDeleteResult({
      data: { user: null },
      error: { code: 'user_not_found', status: 404 },
    }) === 'verify_absence',
    'structured already-absent enters verification',
  );
  assert(
    classifyAuthHardDeleteResult({
      data: null,
      error: { code: 'validation_failed', status: 404 },
    }) === 'action_required',
    'bare 404 semantics are insufficient',
  );
  for (const result of [
    null,
    { data: null },
    { data: null, error: { status: 500 } },
    { data: null, error: new Error('transport') },
  ]) {
    assert(
      classifyAuthHardDeleteResult(result) === 'ambiguous',
      'unknown result must be ambiguous',
    );
  }
});

Deno.test('Auth GET reconciliation accepts only exact structured absence or UUID presence', () => {
  assert(
    classifyAuthUserLookupResult(
      {
        data: { user: null },
        error: { code: 'user_not_found', status: 404 },
      },
      USER_ID,
    ) === 'absent',
    'structured missing user is absent',
  );
  assert(
    classifyAuthUserLookupResult(
      {
        data: { user: { id: USER_ID } },
        error: null,
      },
      USER_ID,
    ) === 'present',
    'exact UUID is present',
  );
  assert(
    classifyAuthUserLookupResult(
      {
        data: { user: { id: '22222222-2222-4222-8222-222222222222' } },
        error: null,
      },
      USER_ID,
    ) === 'retryable',
    'mismatched body is not proof',
  );
  assert(
    classifyAuthUserLookupResult(
      {
        data: null,
        error: { code: 'forbidden', status: 403 },
      },
      USER_ID,
    ) === 'action_required',
    'deterministic auth failure needs configuration action',
  );
  assert(
    classifyAuthUserLookupResult({ data: null, error: { status: 503 } }, USER_ID) === 'retryable',
    'server failure is read-only retryable',
  );
});

Deno.test('retry schedule is bounded and validates attempts', () => {
  assertDeepEqual(
    [1, 2, 3, 4, 11, 99].map(accountDeletionRetryDelaySeconds),
    [5, 10, 20, 40, 3_600, 3_600],
  );
  assertRuntimeError(() => accountDeletionRetryDelaySeconds(0), 'DELETION_AUTH_RESULT_INVALID');
});

function statusRow(overrides: Record<string, unknown> = {}) {
  return {
    operation_id: USER_ID,
    operation_state: 'running',
    operation_expires_at: '2026-08-12T00:00:00.000Z',
    next_step_name: 'revenuecat_delete',
    next_step_status: 'ambiguous',
    attempt_count: 2,
    next_attempt_at: null,
    lease_expires_at: null,
    receipt_expires_at: null,
    apple_manual_revocation_required: null,
    ...overrides,
  };
}

Deno.test('database status rows map to opaque public lifecycle states', () => {
  assertDeepEqual(deletionStatusLookupFromDatabaseRow(null), {
    kind: 'not_found',
  });
  assertDeepEqual(deletionStatusLookupFromDatabaseRow(statusRow()), {
    kind: 'operation',
    operationState: 'running',
    phase: 'provider_verifying',
    nextPollAfterSeconds: 30,
  });
  assertDeepEqual(
    deletionStatusLookupFromDatabaseRow(
      statusRow({
        next_step_name: 'photo_storage_delete',
        next_step_status: 'pending',
      }),
    ),
    {
      kind: 'operation',
      operationState: 'running',
      phase: 'local_erasing',
      nextPollAfterSeconds: 3,
    },
  );
  assertDeepEqual(
    deletionStatusLookupFromDatabaseRow(
      statusRow({
        operation_state: 'completed',
        operation_id: null,
        operation_expires_at: null,
        next_step_name: null,
        next_step_status: null,
        attempt_count: null,
        receipt_expires_at: '2026-08-12T00:00:00.000Z',
        apple_manual_revocation_required: true,
      }),
    ),
    {
      kind: 'receipt',
      receiptState: 'completed',
      notice: 'remove_apple_authorization',
    },
  );
  assertDeepEqual(
    deletionStatusLookupFromDatabaseRow(
      statusRow({
        operation_state: 'expired',
        operation_id: null,
        operation_expires_at: null,
        next_step_name: null,
        next_step_status: null,
        attempt_count: null,
        receipt_expires_at: '2026-08-19T00:00:00.000Z',
        apple_manual_revocation_required: null,
      }),
    ),
    { kind: 'expired' },
  );
});

Deno.test('database status parsing rejects extra, malformed, or impossible rows', () => {
  for (const value of [
    statusRow({ extra: true }),
    statusRow({ operation_id: 'not-a-uuid' }),
    statusRow({ operation_state: 'unknown' }),
    statusRow({ operation_expires_at: null }),
    statusRow({ attempt_count: -1 }),
  ]) {
    assertRuntimeError(
      () => deletionStatusLookupFromDatabaseRow(value),
      'DELETION_STATUS_ROW_INVALID',
    );
  }
});

Deno.test(
  'receipt HMAC key is strict, nonextractable, versioned, and domain-separated',
  async () => {
    const material = 'ab'.repeat(32);
    const loaded = await loadDeletionReceiptHmacKey((name) =>
      name.endsWith('KEY_HEX') ? material : '7',
    );
    assert(!loaded.key.extractable, 'receipt key must not be extractable');
    assert(loaded.keyVersion === 7, 'key version must be retained');
    const first = await deletionSubjectHmac(loaded.key, USER_ID);
    const second = await deletionSubjectHmac(loaded.key, USER_ID);
    const intakeFirst = await deletionIntakeOwnerHmac(loaded.key, USER_ID);
    const intakeSecond = await deletionIntakeOwnerHmac(loaded.key, USER_ID);
    assert(first === second && /^[a-f0-9]{64}$/.test(first), 'stable HMAC');
    assert(
      intakeFirst === intakeSecond && /^[a-f0-9]{64}$/.test(intakeFirst),
      'stable owner intake HMAC',
    );
    assert(intakeFirst !== first, 'intake and receipt domains must differ');
    assert(!first.includes(USER_ID), 'receipt must not contain raw UUID');
    assert(!intakeFirst.includes(USER_ID), 'intake key must not contain raw UUID');
    const rawMessageKey = await crypto.subtle.importKey(
      'raw',
      new Uint8Array(32).fill(0xab),
      { name: 'HMAC', hash: 'SHA-256' },
      false,
      ['sign'],
    );
    const raw = new Uint8Array(
      await crypto.subtle.sign('HMAC', rawMessageKey, new TextEncoder().encode(USER_ID)),
    );
    const rawHex = [...raw].map((byte) => byte.toString(16).padStart(2, '0')).join('');
    assert(first !== rawHex, 'domain context must change the digest');
  },
);

Deno.test('receipt HMAC key/config rejects alternate encodings and invalid contexts', async () => {
  for (const [key, version] of [
    ['AB'.repeat(32), '1'],
    ['ab'.repeat(31), '1'],
    ['ab'.repeat(32), '0'],
    ['ab'.repeat(32), '32768'],
    ['ab'.repeat(32), '01'],
  ]) {
    try {
      await loadDeletionReceiptHmacKey((name) => (name.endsWith('KEY_HEX') ? key : version));
      throw new Error('expected rejection');
    } catch (error) {
      assert(
        error instanceof DurableDeletionRuntimeCoreError &&
          error.code === 'DELETION_RECEIPT_KEY_INVALID',
        'expected strict receipt key rejection',
      );
    }
  }
  const loaded = await loadDeletionReceiptHmacKey((name) =>
    name.endsWith('KEY_HEX') ? 'ab'.repeat(32) : '1',
  );
  try {
    await deletionSubjectHmac(loaded.key, 'not-a-uuid');
    throw new Error('expected rejection');
  } catch (error) {
    assert(
      error instanceof DurableDeletionRuntimeCoreError &&
        error.code === 'DELETION_RECEIPT_CONTEXT_INVALID',
      'invalid UUID must fail closed',
    );
  }
  try {
    await deletionIntakeOwnerHmac(loaded.key, 'not-a-uuid');
    throw new Error('expected rejection');
  } catch (error) {
    assert(
      error instanceof DurableDeletionRuntimeCoreError &&
        error.code === 'DELETION_RECEIPT_CONTEXT_INVALID',
      'invalid intake owner must fail closed',
    );
  }
});

Deno.test('result codes accept only finite identifier-free symbols', () => {
  assert(validDeletionResultCode('AUTH_USER_ABSENT'), 'valid result code');
  for (const value of ['', 'lowercase', 'HAS-DASH', 'A'.repeat(65), null]) {
    assert(!validDeletionResultCode(value), 'invalid result code');
  }
});
