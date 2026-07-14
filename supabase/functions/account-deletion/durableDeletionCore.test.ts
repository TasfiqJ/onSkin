import {
  assertDeletionOperationTransition,
  assertDeletionStepTransition,
  classifyDeletionStepLease,
  DELETION_CAPABILITY_HEX_LENGTH,
  DELETION_IDEMPOTENCY_DIGEST_CONTEXT,
  DELETION_STATUS_CAPABILITY_DIGEST_CONTEXT,
  type DeletionOperationState,
  type DeletionStepKind,
  type DeletionStepState,
  DurableDeletionCoreError,
  generateDeletionCapability,
  generateDeletionIntakeTokens,
  hashDeletionCapability,
  hashDeletionIdempotencyKey,
  mapPublicDeletionStatus,
  MAX_DELETION_STATUS_POLL_SECONDS,
  MIN_DELETION_STATUS_POLL_SECONDS,
  resolveDeletionAttempt,
  validateDeletionIntakeTokens,
  verifyDeletionCapability,
} from './durableDeletionCore.ts';

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(message);
}

function assertDeepEqual(actual: unknown, expected: unknown, message: string): void {
  assert(JSON.stringify(actual) === JSON.stringify(expected), message);
}

function assertCoreError(operation: () => unknown, code: DurableDeletionCoreError['code']): void {
  try {
    operation();
  } catch (error) {
    assert(error instanceof DurableDeletionCoreError, 'expected DurableDeletionCoreError.');
    assert(error.code === code, `expected ${code}, received ${error.code}.`);
    assert(error.message === code, 'core errors must contain only a stable code.');
    return;
  }
  throw new Error(`expected ${code}.`);
}

Deno.test(
  'deletion capabilities are 256-bit canonical values stored only as SHA-256 digests',
  async () => {
    const capability = generateDeletionCapability();
    assert(
      capability.length === DELETION_CAPABILITY_HEX_LENGTH && /^[0-9a-f]{64}$/.test(capability),
      'expected a canonical 256-bit lowercase-hex capability.',
    );

    const knownCapability = '0'.repeat(64);
    const digest = await hashDeletionCapability(knownCapability);
    assert(/^[0-9a-f]{64}$/.test(digest), 'expected a canonical digest.');
    assert(
      await verifyDeletionCapability(knownCapability, digest),
      'expected the capability to verify.',
    );
    assert(
      !(await verifyDeletionCapability(`${'0'.repeat(63)}1`, digest)),
      'a different capability must fail verification.',
    );
    for (const invalid of [
      '',
      '0'.repeat(63),
      '0'.repeat(65),
      'A'.repeat(64),
      'g'.repeat(64),
      ` ${'0'.repeat(64)}`,
    ]) {
      assert(
        !(await verifyDeletionCapability(invalid, digest)),
        'invalid capability must fail closed.',
      );
    }
    assert(
      !(await verifyDeletionCapability(knownCapability, 'not-a-digest')),
      'an invalid stored digest must fail closed.',
    );
  },
);

Deno.test('capability and idempotency digests match schema domain separation', async () => {
  const token = '0'.repeat(64);
  assert(
    DELETION_STATUS_CAPABILITY_DIGEST_CONTEXT === 'onskin-account-deletion-status-capability:v1:',
    'capability context must remain byte-for-byte aligned with schema48.',
  );
  assert(
    DELETION_IDEMPOTENCY_DIGEST_CONTEXT === 'onskin-account-deletion-intake-idempotency:v1:',
    'idempotency context must remain byte-for-byte aligned with schema48.',
  );
  const capabilityDigest = await hashDeletionCapability(token);
  const idempotencyDigest = await hashDeletionIdempotencyKey(token);
  const directDigest = async (context: string): Promise<string> => {
    const digest = await crypto.subtle.digest(
      'SHA-256',
      new TextEncoder().encode(`${context}${token}`),
    );
    return [...new Uint8Array(digest)].map((byte) => byte.toString(16).padStart(2, '0')).join('');
  };
  assert(
    capabilityDigest === (await directDigest(DELETION_STATUS_CAPABILITY_DIGEST_CONTEXT)),
    'capability hashing must match schema48 exactly.',
  );
  assert(
    capabilityDigest !== idempotencyDigest,
    'the same raw token must have different domain-separated digests.',
  );
  assert(
    capabilityDigest === '45261e1c52312304b28a7c891e7e1c3254a28c87b58c28632e2134d3bc495ac7',
    'capability hashing must match the fixed schema-compatible vector.',
  );
  assert(
    idempotencyDigest === (await directDigest(DELETION_IDEMPOTENCY_DIGEST_CONTEXT)),
    'idempotency hashing must match schema48 exactly.',
  );
  assert(
    idempotencyDigest === 'c5f8ebd5933348dfeda845e8834df5189ad53f8c34efb33d65b4a40c2ec139c0',
    'idempotency hashing must match the fixed schema-compatible vector.',
  );
});

Deno.test('intake tokens are independently random, canonical, validated, and unequal', () => {
  const generated = generateDeletionIntakeTokens();
  assert(/^[0-9a-f]{64}$/.test(generated.idempotencyKey), 'expected a canonical idempotency key.');
  assert(
    /^[0-9a-f]{64}$/.test(generated.statusCapability),
    'expected a canonical status capability.',
  );
  assert(
    generated.idempotencyKey !== generated.statusCapability,
    'the two intake secrets must be independent.',
  );
  assertDeepEqual(
    validateDeletionIntakeTokens(generated),
    generated,
    'valid intake tokens must round-trip exactly.',
  );

  const valid = {
    idempotencyKey: '01'.repeat(32),
    statusCapability: '02'.repeat(32),
  };
  for (const invalid of [
    null,
    {},
    { ...valid, idempotencyKey: valid.statusCapability },
    { ...valid, idempotencyKey: 'A'.repeat(64) },
    { ...valid, statusCapability: '0'.repeat(63) },
    { ...valid, statusCapability: 1 },
    { ...valid, extra: true },
  ]) {
    assertCoreError(() => validateDeletionIntakeTokens(invalid), 'DELETION_INTAKE_TOKENS_INVALID');
  }
});

Deno.test('invalid secret errors contain only stable codes', async () => {
  const secret = 'customer-secret-capability-material';
  try {
    await hashDeletionCapability(secret);
  } catch (error) {
    assert(error instanceof DurableDeletionCoreError, 'expected a typed core error.');
    assert(error.code === 'DELETION_CAPABILITY_INVALID', 'expected the stable capability code.');
    assert(!error.message.includes(secret), 'the error must not echo capability material.');
    assert(!JSON.stringify(error).includes(secret), 'serialized errors must not echo secrets.');
    return;
  }
  throw new Error('expected invalid capability rejection.');
});

Deno.test('invalid idempotency keys fail with an identifier-free stable code', async () => {
  const secret = 'invalid-idempotency-secret';
  try {
    await hashDeletionIdempotencyKey(secret);
  } catch (error) {
    assert(error instanceof DurableDeletionCoreError, 'expected a typed core error.');
    assert(
      error.code === 'DELETION_IDEMPOTENCY_KEY_INVALID',
      'expected the stable idempotency code.',
    );
    assert(!error.message.includes(secret), 'the error must not echo idempotency material.');
    return;
  }
  throw new Error('expected invalid idempotency rejection.');
});

Deno.test('operation transitions are exhaustive, recovery-aware, and fail closed', () => {
  const states: DeletionOperationState[] = [
    'pending',
    'running',
    'ready_to_finalize',
    'action_required',
  ];
  const advanced = new Set([
    'pending:running',
    'pending:action_required',
    'running:ready_to_finalize',
    'running:action_required',
    'ready_to_finalize:action_required',
    'action_required:running',
    'action_required:ready_to_finalize',
  ]);
  for (const from of states) {
    for (const to of states) {
      if (from === to) {
        assert(
          assertDeletionOperationTransition(from, to) === 'idempotent',
          `${from} replay should be idempotent.`,
        );
      } else if (advanced.has(`${from}:${to}`)) {
        assert(
          assertDeletionOperationTransition(from, to) === 'advanced',
          `${from} -> ${to} should advance.`,
        );
      } else {
        assertCoreError(
          () => assertDeletionOperationTransition(from, to),
          'DELETION_TRANSITION_INVALID',
        );
      }
    }
  }
  assertCoreError(
    () => assertDeletionOperationTransition('unknown' as DeletionOperationState, 'pending'),
    'DELETION_TRANSITION_INVALID',
  );
  assertCoreError(
    () => assertDeletionOperationTransition('pending', 'unknown' as DeletionOperationState),
    'DELETION_TRANSITION_INVALID',
  );
});

Deno.test('network and transactional step transition graphs are exhaustive', () => {
  const states: DeletionStepState[] = [
    'pending',
    'leased',
    'request_started',
    'ambiguous',
    'succeeded',
    'action_required',
  ];
  const expectedByKind: Record<DeletionStepKind, Set<string>> = {
    network: new Set([
      'pending:leased',
      'pending:action_required',
      'leased:pending',
      'leased:request_started',
      'leased:action_required',
      'request_started:pending',
      'request_started:ambiguous',
      'request_started:succeeded',
      'request_started:action_required',
      'ambiguous:succeeded',
      'ambiguous:action_required',
    ]),
    transactional: new Set([
      'pending:leased',
      'pending:action_required',
      'leased:pending',
      'leased:succeeded',
      'leased:action_required',
    ]),
  };

  for (const kind of ['network', 'transactional'] as const) {
    for (const from of states) {
      for (const to of states) {
        const impossibleTransactionalState =
          kind === 'transactional' &&
          (from === 'request_started' ||
            from === 'ambiguous' ||
            to === 'request_started' ||
            to === 'ambiguous');
        if (impossibleTransactionalState) {
          assertCoreError(
            () => assertDeletionStepTransition(kind, from, to),
            'DELETION_TRANSITION_INVALID',
          );
        } else if (from === to) {
          assert(
            assertDeletionStepTransition(kind, from, to) === 'idempotent',
            `${kind} ${from} replay should be idempotent.`,
          );
        } else if (expectedByKind[kind].has(`${from}:${to}`)) {
          assert(
            assertDeletionStepTransition(kind, from, to) === 'advanced',
            `${kind} ${from} -> ${to} should advance.`,
          );
        } else {
          assertCoreError(
            () => assertDeletionStepTransition(kind, from, to),
            'DELETION_TRANSITION_INVALID',
          );
        }
      }
    }
  }

  assertCoreError(
    () => assertDeletionStepTransition('provider' as DeletionStepKind, 'pending', 'leased'),
    'DELETION_TRANSITION_INVALID',
  );
  assertCoreError(
    () => assertDeletionStepTransition('network', 'unknown' as DeletionStepState, 'succeeded'),
    'DELETION_TRANSITION_INVALID',
  );
  assertCoreError(
    () => assertDeletionStepTransition('network', 'ambiguous', 'pending'),
    'DELETION_TRANSITION_INVALID',
  );
});

Deno.test('leases preserve the dispatch boundary and ambiguous reconciliation-only state', () => {
  const base = {
    kind: 'network' as const,
    nowMs: 10_000,
    attemptCount: 1,
    maxAttempts: 5,
  };
  assertDeepEqual(
    classifyDeletionStepLease({
      ...base,
      state: 'leased',
      leaseExpiresAtMs: 9_999,
    }),
    { kind: 'claimable' },
    'an expired pre-dispatch lease may be reclaimed.',
  );
  assertDeepEqual(
    classifyDeletionStepLease({
      ...base,
      state: 'request_started',
      leaseExpiresAtMs: 9_999,
    }),
    { kind: 'mark_ambiguous' },
    'a crash after request-start must never become a fresh claim.',
  );
  assertDeepEqual(
    classifyDeletionStepLease({ ...base, state: 'ambiguous' }),
    { kind: 'reconciliation_required' },
    'an ambiguous provider dispatch must remain reconciliation-only.',
  );
  assertDeepEqual(
    classifyDeletionStepLease({
      ...base,
      state: 'leased',
      leaseExpiresAtMs: 10_001,
    }),
    { kind: 'lease_active', leaseExpiresAtMs: 10_001 },
    'an active lease must not be stolen.',
  );
  assertDeepEqual(
    classifyDeletionStepLease({
      ...base,
      state: 'pending',
      nextAttemptAtMs: 20_000,
    }),
    { kind: 'not_due', retryAtMs: 20_000 },
    'backoff must be respected.',
  );
  assertDeepEqual(
    classifyDeletionStepLease({ ...base, state: 'ambiguous', attemptCount: 5 }),
    { kind: 'attempts_exhausted' },
    'exhausted reconciliation must require operator handling.',
  );
  assertDeepEqual(
    classifyDeletionStepLease({
      ...base,
      kind: 'transactional',
      state: 'leased',
      leaseExpiresAtMs: 9_999,
    }),
    { kind: 'claimable' },
    'an expired transactional lease is safely reclaimable.',
  );
});

Deno.test('lease classification rejects every unknown or impossible runtime value', () => {
  const valid = {
    kind: 'network' as const,
    state: 'pending' as const,
    nowMs: 10_000,
    attemptCount: 1,
    maxAttempts: 5,
  };
  for (const invalid of [
    { ...valid, kind: 'provider' },
    { ...valid, state: 'unknown' },
    { ...valid, nowMs: Number.NaN },
    { ...valid, attemptCount: -1 },
    { ...valid, attemptCount: 6 },
    { ...valid, maxAttempts: 0 },
    { ...valid, kind: 'transactional', state: 'ambiguous' },
    { ...valid, state: 'leased' },
  ]) {
    assertCoreError(
      () => classifyDeletionStepLease(invalid as never),
      'DELETION_LEASE_INPUT_INVALID',
    );
  }
});

Deno.test('attempt outcomes encode safe retry and reconciliation without redispatch', () => {
  const common = {
    kind: 'network' as const,
    attemptCount: 1,
    maxAttempts: 5,
    retryAtMs: 20_000,
  };
  assertDeepEqual(
    resolveDeletionAttempt({
      ...common,
      phase: 'pre_dispatch',
      signal: 'transport_failure',
      retrySafety: 'safe',
    }),
    {
      nextState: 'pending',
      resultCode: 'STEP_RETRY_SCHEDULED',
      retryAtMs: 20_000,
    },
    'a failure before dispatch may be retried.',
  );
  assertDeepEqual(
    resolveDeletionAttempt({
      ...common,
      phase: 'post_dispatch',
      signal: 'transport_failure',
      retrySafety: 'unsafe',
    }),
    { nextState: 'ambiguous', resultCode: 'STEP_DISPATCH_AMBIGUOUS' },
    'a lost unsafe response must reconcile.',
  );
  assertDeepEqual(
    resolveDeletionAttempt({
      ...common,
      phase: 'post_dispatch',
      signal: 'transport_failure',
      retrySafety: 'safe',
    }),
    {
      nextState: 'pending',
      resultCode: 'STEP_RETRY_SCHEDULED',
      retryAtMs: 20_000,
    },
    'a documented idempotent network operation may retry after a lost response.',
  );
  assertDeepEqual(
    resolveDeletionAttempt({
      ...common,
      phase: 'reconciliation',
      signal: 'retryable',
      retrySafety: 'safe',
    }),
    {
      nextState: 'ambiguous',
      resultCode: 'STEP_RECONCILIATION_SCHEDULED',
      retryAtMs: 20_000,
    },
    'reconciliation backoff must stay ambiguous rather than reopening dispatch.',
  );
  assertDeepEqual(
    resolveDeletionAttempt({
      ...common,
      phase: 'reconciliation',
      signal: 'succeeded',
      retrySafety: 'safe',
    }),
    { nextState: 'succeeded', resultCode: 'STEP_SUCCEEDED' },
    'reconciliation may attest the prior side effect.',
  );
  assertDeepEqual(
    resolveDeletionAttempt({
      ...common,
      kind: 'transactional',
      phase: 'transaction',
      signal: 'retryable',
      retrySafety: 'safe',
    }),
    {
      nextState: 'pending',
      resultCode: 'STEP_RETRY_SCHEDULED',
      retryAtMs: 20_000,
    },
    'a rolled-back transactional step is safely retryable.',
  );
});

Deno.test('attempt resolution rejects unknown and contradictory runtime combinations', () => {
  const valid = {
    kind: 'network' as const,
    phase: 'post_dispatch' as const,
    signal: 'retryable' as const,
    retrySafety: 'safe' as const,
    attemptCount: 1,
    maxAttempts: 5,
    retryAtMs: 20_000,
  };
  for (const invalid of [
    { ...valid, kind: 'provider' },
    { ...valid, phase: 'unknown' },
    { ...valid, signal: 'unknown' },
    { ...valid, retrySafety: 'maybe' },
    { ...valid, attemptCount: 0 },
    { ...valid, attemptCount: 6 },
    { ...valid, kind: 'network', phase: 'transaction' },
    { ...valid, kind: 'transactional', phase: 'post_dispatch' },
    {
      ...valid,
      kind: 'transactional',
      phase: 'transaction',
      retrySafety: 'unsafe',
    },
    {
      ...valid,
      kind: 'transactional',
      phase: 'transaction',
      signal: 'unattested',
    },
    { ...valid, phase: 'pre_dispatch', signal: 'succeeded' },
    {
      ...valid,
      phase: 'pre_dispatch',
      signal: 'retryable',
      retrySafety: 'unsafe',
    },
    { ...valid, phase: 'reconciliation', retrySafety: 'unsafe' },
  ]) {
    assertCoreError(
      () => resolveDeletionAttempt(invalid as never),
      'DELETION_ATTEMPT_INPUT_INVALID',
    );
  }
});

Deno.test('public status exposes only approved opaque lifecycle phases', () => {
  for (const [operationState, status, phase] of [
    ['pending', 'pending', 'queued'],
    ['running', 'pending', 'processing'],
    ['ready_to_finalize', 'pending', 'processing'],
    ['action_required', 'delayed', 'delayed'],
  ] as const) {
    assertDeepEqual(
      mapPublicDeletionStatus({
        kind: 'operation',
        operationState,
        phase,
        nextPollAfterSeconds: MIN_DELETION_STATUS_POLL_SECONDS,
      }),
      {
        httpStatus: 202,
        body: {
          status,
          phase,
          nextPollAfterSeconds: MIN_DELETION_STATUS_POLL_SECONDS,
        },
      },
      `expected ${operationState} to map to ${phase}.`,
    );
  }
  for (const phase of ['local_erasing', 'provider_verifying'] as const) {
    assertDeepEqual(
      mapPublicDeletionStatus({
        kind: 'operation',
        operationState: 'running',
        phase,
        nextPollAfterSeconds: 5,
      }),
      {
        httpStatus: 202,
        body: { status: 'pending', phase, nextPollAfterSeconds: 5 },
      },
      `${phase} must remain an approved provider-opaque phase.`,
    );
  }
  assertDeepEqual(
    mapPublicDeletionStatus({ kind: 'receipt', receiptState: 'completed' }),
    { httpStatus: 200, body: { status: 'completed' } },
    'completed receipts must return 200.',
  );
  assertDeepEqual(
    mapPublicDeletionStatus({
      kind: 'receipt',
      receiptState: 'completed',
      notice: 'remove_apple_authorization',
    }),
    {
      httpStatus: 200,
      body: { status: 'completed', notice: 'remove_apple_authorization' },
    },
    'the nonblocking Apple notice must survive terminal status.',
  );
  assertDeepEqual(
    mapPublicDeletionStatus({
      kind: 'receipt',
      receiptState: 'action_required',
      nextPollAfterSeconds: MAX_DELETION_STATUS_POLL_SECONDS,
    }),
    {
      httpStatus: 202,
      body: {
        status: 'delayed',
        phase: 'delayed',
        nextPollAfterSeconds: MAX_DELETION_STATUS_POLL_SECONDS,
      },
    },
    'internal operator handling must remain a nonblocking delayed status.',
  );
  assertDeepEqual(
    mapPublicDeletionStatus({ kind: 'not_found' }),
    { httpStatus: 404, body: { status: 'invalid' } },
    'invalid capabilities must not reveal account existence.',
  );
  assertDeepEqual(
    mapPublicDeletionStatus({ kind: 'expired' }),
    { httpStatus: 410, body: { status: 'expired' } },
    'expired receipts must return 410.',
  );
  assert(
    MAX_DELETION_STATUS_POLL_SECONDS > MIN_DELETION_STATUS_POLL_SECONDS,
    'the polling interval bounds must be ordered.',
  );
});

Deno.test(
  'public status mapping fails closed for unknown states, extra keys, and poll values',
  () => {
    const valid = {
      kind: 'operation' as const,
      operationState: 'running' as const,
      phase: 'processing' as const,
      nextPollAfterSeconds: 5,
    };
    for (const invalid of [
      null,
      { kind: 'unknown' },
      { ...valid, operationState: 'unknown' },
      { ...valid, phase: 'posthog_deleting' },
      { ...valid, operationState: 'pending', phase: 'provider_verifying' },
      { ...valid, operationState: 'action_required', phase: 'processing' },
      { ...valid, internalProvider: 'posthog' },
      { ...valid, nextPollAfterSeconds: MIN_DELETION_STATUS_POLL_SECONDS - 1 },
      { ...valid, nextPollAfterSeconds: MAX_DELETION_STATUS_POLL_SECONDS + 1 },
      { ...valid, nextPollAfterSeconds: 5.5 },
      { kind: 'receipt', receiptState: 'completed', notice: 'internal_notice' },
      { kind: 'receipt', receiptState: 'completed', extra: true },
      { kind: 'not_found', extra: true },
    ]) {
      assertCoreError(
        () => mapPublicDeletionStatus(invalid as never),
        'DELETION_PUBLIC_STATUS_INVALID',
      );
    }
  },
);
