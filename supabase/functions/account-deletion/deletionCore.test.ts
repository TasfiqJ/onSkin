import {
  ACCOUNT_DELETION_STEPS,
  type AccountDeletionActions,
  type AccountDeletionCheckpointStep,
  type AccountDeletionState,
  type AccountDeletionStateStore,
  type AccountDeletionStep,
  runAccountDeletionStateMachine,
} from './deletionCore.ts';

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(message);
}

async function assertRejectsCode(operation: () => Promise<unknown>, code: string): Promise<void> {
  try {
    await operation();
  } catch (error) {
    assert(error instanceof Error, 'expected an Error rejection.');
    assert(error.message === code, `expected ${code}, received ${error.message}.`);
    return;
  }
  throw new Error(`expected ${code} rejection.`);
}

const USER_ID = '00000000-0000-4000-8000-000000000001';
const USER_HASH = 'u_11111111111111111111111111111111';
const SESSION_ID = '99999999-9999-4999-8999-999999999999';
const COMPLETION_TOKEN_HASH = `t_${'1'.repeat(64)}`;

const NEXT_STEP = new Map<AccountDeletionCheckpointStep, AccountDeletionState['nextStep']>([
  ['revenuecat', 'posthog'],
  ['posthog', 'storage'],
  ['storage', 'database'],
  ['database', 'sessions'],
  ['sessions', 'apple'],
  ['apple', 'providers_final'],
  ['apple_in_progress', 'providers_final'],
  ['providers_final', 'auth'],
]);

class MemoryStateStore implements AccountDeletionStateStore {
  state: AccountDeletionState = {
    requestId: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
    nextStep: 'revenuecat',
    appleRequired: true,
    appleResult: null,
    posthogResult: null,
  };
  claimCalls = 0;
  initiatingSessionId = SESSION_ID;
  leaseToken: string | null = null;
  leaseActive = false;
  failureCode: string | null = null;
  failCheckpointOnceAt: AccountDeletionCheckpointStep | null = null;
  checkpointFailures = 0;
  loseCheckpointResponseAfterCommitOnceAt: AccountDeletionCheckpointStep | null = null;
  checkpointResponseLosses = 0;

  claim(input: {
    userId: string;
    userHash: string;
    appleRequired: boolean;
    sessionId: string;
    leaseToken: string;
    completionTokenHash?: string;
  }): Promise<AccountDeletionState> {
    this.claimCalls += 1;
    assert(input.userId === USER_ID, 'unexpected user id.');
    assert(input.userHash === USER_HASH, 'unexpected user hash.');
    if (input.sessionId !== this.initiatingSessionId) {
      return Promise.reject(new Error('ACCOUNT_DELETION_SESSION_MISMATCH'));
    }
    if (this.state.nextStep === 'complete') {
      return Promise.resolve({ ...this.state });
    }
    if (this.state.appleRequired && !input.appleRequired) {
      return Promise.reject(new Error('ACCOUNT_DELETION_APPLE_REAUTHORIZATION_REQUIRED'));
    }
    if (
      this.leaseToken &&
      this.leaseActive &&
      (this.state.nextStep === 'apple_in_progress' || this.leaseToken !== input.leaseToken)
    ) {
      return Promise.reject(new Error('ACCOUNT_DELETION_IN_PROGRESS'));
    }
    this.leaseToken = input.leaseToken;
    this.leaseActive = true;
    this.state.appleRequired ||= input.appleRequired;
    if (
      input.appleRequired &&
      (this.state.nextStep === 'apple_in_progress' ||
        this.state.nextStep === 'providers_final' ||
        this.state.nextStep === 'auth')
    ) {
      this.state.nextStep = 'apple';
      this.state.appleResult = null;
    }
    return Promise.resolve({ ...this.state });
  }

  beginAppleAttempt(input: {
    requestId: string;
    userId: string;
    leaseToken: string;
  }): Promise<AccountDeletionState> {
    assert(input.requestId === this.state.requestId, 'unexpected request id.');
    assert(input.userId === USER_ID, 'unexpected user id.');
    if (input.leaseToken !== this.leaseToken || !this.leaseActive) {
      return Promise.reject(new Error('ACCOUNT_DELETION_STATE_CONFLICT'));
    }
    assert(this.state.nextStep === 'apple', 'Apple attempt began outside the Apple step.');
    assert(this.state.appleRequired, 'Apple attempt began for a non-Apple account.');
    this.state.nextStep = 'apple_in_progress';
    return Promise.resolve({ ...this.state });
  }

  checkpoint(input: {
    requestId: string;
    userId: string;
    leaseToken: string;
    expectedStep: AccountDeletionCheckpointStep;
    result: string;
  }): Promise<AccountDeletionState> {
    assert(input.requestId === this.state.requestId, 'unexpected request id.');
    assert(input.userId === USER_ID, 'unexpected user id.');
    if (this.failCheckpointOnceAt === input.expectedStep && this.checkpointFailures === 0) {
      this.checkpointFailures += 1;
      return Promise.reject(new Error(`CHECKPOINT_FAILED_${input.expectedStep.toUpperCase()}`));
    }

    if (input.expectedStep === 'auth') {
      assert(
        this.state.nextStep === 'complete',
        'auth checkpoint attempted to complete without the auth DELETE trigger.',
      );
      return Promise.resolve({ ...this.state });
    }

    if (input.leaseToken !== this.leaseToken || !this.leaseActive) {
      return Promise.reject(new Error('ACCOUNT_DELETION_STATE_CONFLICT'));
    }
    assert(input.expectedStep === this.state.nextStep, 'checkpoint skipped or reordered a step.');
    if (input.expectedStep === 'apple' || input.expectedStep === 'apple_in_progress') {
      assert(input.result === 'revoked' || input.result === 'skipped', 'invalid Apple result.');
      this.state.appleResult = input.result;
    }
    if (input.expectedStep === 'posthog') {
      assert(input.result === 'deleted' || input.result === 'skipped', 'invalid PostHog result.');
      this.state.posthogResult = input.result;
    }
    this.state.nextStep = NEXT_STEP.get(input.expectedStep)!;
    if (
      this.loseCheckpointResponseAfterCommitOnceAt === input.expectedStep &&
      this.checkpointResponseLosses === 0
    ) {
      this.checkpointResponseLosses += 1;
      return Promise.reject(
        new Error(`CHECKPOINT_RESPONSE_LOST_${input.expectedStep.toUpperCase()}`),
      );
    }
    return Promise.resolve({ ...this.state });
  }

  recordFailure(input: {
    requestId: string;
    userId: string;
    leaseToken: string;
    expectedStep: AccountDeletionCheckpointStep;
    errorCode: string;
  }): Promise<void> {
    assert(input.requestId === this.state.requestId, 'unexpected request id.');
    assert(input.userId === USER_ID, 'unexpected user id.');
    if (this.state.nextStep === 'complete') return Promise.resolve();
    assert(input.expectedStep === this.state.nextStep, 'failure recorded against wrong step.');
    if (this.leaseToken === input.leaseToken) {
      this.leaseToken = null;
      this.leaseActive = false;
    }
    this.failureCode = input.errorCode;
    return Promise.resolve();
  }

  finalizeAuthDeletion(): void {
    if (this.state.nextStep !== 'auth' || !this.leaseToken || !this.leaseActive) {
      throw new Error('ACCOUNT_DELETION_AUTH_NOT_READY');
    }
    this.state.nextStep = 'complete';
    this.leaseToken = null;
    this.leaseActive = false;
  }

  expireLease(): void {
    this.leaseActive = false;
  }
}

type ActionHarness = {
  actions: AccountDeletionActions;
  calls: AccountDeletionStep[];
  effects: Set<AccountDeletionStep>;
  appleCodes: string[];
  failActionOnceAt: AccountDeletionStep | null;
  loseAuthResponseAfterCommit: boolean;
};

function actionsFor(store: MemoryStateStore): ActionHarness {
  const calls: AccountDeletionStep[] = [];
  const effects = new Set<AccountDeletionStep>();
  const appleCodes: string[] = [];
  const harness: ActionHarness = {
    calls,
    effects,
    appleCodes,
    failActionOnceAt: null,
    loseAuthResponseAfterCommit: false,
    actions: undefined as unknown as AccountDeletionActions,
  };
  const run = <T extends string>(step: AccountDeletionStep, result: T): Promise<T> => {
    calls.push(step);
    if (harness.failActionOnceAt === step && !effects.has(step)) {
      harness.failActionOnceAt = null;
      return Promise.reject(new Error(`ACTION_FAILED_${step.toUpperCase()}`));
    }
    effects.add(step);
    return Promise.resolve(result);
  };
  harness.actions = {
    deleteRevenueCatSubscriber: () => run('revenuecat', 'deleted'),
    deletePostHogPerson: () => run('posthog', 'deleted'),
    deletePhotoStorage: () => run('storage', 'deleted'),
    eraseDatabaseState: () => run('database', 'deleted'),
    revokeOtherAuthSessions: () => run('sessions', 'revoked'),
    revokeAppleToken: (authorizationCode) => {
      appleCodes.push(authorizationCode);
      return run('apple', 'revoked');
    },
    reconcileProviders: () => run('providers_final', 'reconciled'),
    async deleteAuthIdentity() {
      await run('auth', 'deleted');
      store.finalizeAuthDeletion();
      if (harness.loseAuthResponseAfterCommit) {
        throw new Error('AUTH_USER_DELETE_FAILED:RESPONSE_LOST');
      }
      return 'deleted';
    },
  };
  return harness;
}

function run(
  store: MemoryStateStore,
  harness: ActionHarness,
  attempt: number,
  appleRequired = true,
): Promise<unknown> {
  return runAccountDeletionStateMachine({
    userId: USER_ID,
    userHash: USER_HASH,
    appleRequired,
    appleAuthorizationCode: appleRequired ? `apple-code-${attempt}` : undefined,
    sessionId: SESSION_ID,
    leaseToken: `bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbb${attempt}`,
    completionTokenHash: COMPLETION_TOKEN_HASH,
    store,
    actions: harness.actions,
    errorCode: (error) => (error instanceof Error ? error.message.split(':')[0]! : String(error)),
  });
}

Deno.test('account deletion executes the durable dependency order with auth last', async () => {
  const store = new MemoryStateStore();
  const harness = actionsFor(store);

  const result = await run(store, harness, 1);

  assert(
    JSON.stringify(harness.calls) === JSON.stringify(ACCOUNT_DELETION_STEPS),
    `unexpected order: ${harness.calls.join(',')}`,
  );
  assert(store.state.nextStep === 'complete', 'expected a completion receipt.');
  assert(JSON.stringify(result).includes('"apple":"revoked"'), 'expected Apple result.');
});

Deno.test('account deletion retries only retry-safe action failures', async () => {
  const retrySafeSteps: AccountDeletionStep[] = [
    'revenuecat',
    'posthog',
    'storage',
    'database',
    'sessions',
    'providers_final',
    'auth',
  ];
  for (const step of retrySafeSteps) {
    const store = new MemoryStateStore();
    const harness = actionsFor(store);
    harness.failActionOnceAt = step;

    await assertRejectsCode(() => run(store, harness, 1), `ACTION_FAILED_${step.toUpperCase()}`);
    assert(store.state.nextStep === step, `${step} failure advanced its checkpoint.`);
    await run(store, harness, 2);
    assert(String(store.state.nextStep) === 'complete', `${step} failure did not converge.`);
  }
});

Deno.test('account deletion retries checkpoint loss for retry-safe steps', async () => {
  const retrySafeSteps: AccountDeletionCheckpointStep[] = [
    'revenuecat',
    'posthog',
    'storage',
    'database',
    'sessions',
    'providers_final',
  ];
  for (const step of retrySafeSteps) {
    const store = new MemoryStateStore();
    const harness = actionsFor(store);
    store.failCheckpointOnceAt = step;

    await assertRejectsCode(
      () => run(store, harness, 1),
      `CHECKPOINT_FAILED_${step.toUpperCase()}`,
    );
    assert(store.state.nextStep === step, `${step} checkpoint failure advanced state.`);
    await run(store, harness, 2);
    assert(String(store.state.nextStep) === 'complete', `${step} retry did not converge.`);
  }
});

Deno.test('Apple action failure requires a fresh code and then completes', async () => {
  const store = new MemoryStateStore();
  const harness = actionsFor(store);
  store.state.nextStep = 'apple';
  store.leaseToken = null;
  harness.failActionOnceAt = 'apple';

  await assertRejectsCode(() => run(store, harness, 1), 'APPLE_REVOCATION_STATUS_UNKNOWN');
  assert(String(store.state.nextStep) === 'apple_in_progress', 'Apple ambiguity was not durable.');
  assert(harness.appleCodes[0] === 'apple-code-1', 'first Apple attempt used wrong code.');

  await run(store, harness, 2);
  assert(String(store.state.nextStep) === 'complete', 'fresh Apple retry did not complete.');
  assert(
    JSON.stringify(harness.appleCodes) === JSON.stringify(['apple-code-1', 'apple-code-2']),
    'Apple retry did not use exactly one newly issued code.',
  );
});

Deno.test('Apple checkpoint failure recovers only with a fresh code', async () => {
  const store = new MemoryStateStore();
  const harness = actionsFor(store);
  store.state.nextStep = 'apple';
  store.failCheckpointOnceAt = 'apple_in_progress';

  await assertRejectsCode(() => run(store, harness, 1), 'APPLE_REVOCATION_STATUS_UNKNOWN');
  assert(harness.effects.has('apple'), 'Apple side effect did not occur before response loss.');
  assert(
    String(store.state.nextStep) === 'apple_in_progress',
    'ambiguous Apple state was not retained.',
  );

  await run(store, harness, 2);
  assert(String(store.state.nextStep) === 'complete', 'checkpoint retry did not converge.');
  assert(
    JSON.stringify(harness.appleCodes) === JSON.stringify(['apple-code-1', 'apple-code-2']),
    'checkpoint retry reused a single-use Apple code.',
  );
});

Deno.test('an active Apple attempt lease rejects a concurrent fresh claim', async () => {
  const store = new MemoryStateStore();
  const harness = actionsFor(store);
  store.state.nextStep = 'apple_in_progress';
  store.leaseToken = 'dddddddd-dddd-4ddd-8ddd-dddddddddddd';
  store.leaseActive = true;

  await assertRejectsCode(() => run(store, harness, 1), 'ACCOUNT_DELETION_IN_PROGRESS');

  assert(harness.appleCodes.length === 0, 'concurrent recovery consumed an Apple code.');
  assert(
    String(store.state.nextStep) === 'apple_in_progress',
    'concurrent recovery changed durable Apple state.',
  );
});

Deno.test('Apple recovery refuses a claim without reauthorization preflight', async () => {
  const store = new MemoryStateStore();
  store.state.nextStep = 'apple_in_progress';
  store.leaseToken = null;

  await assertRejectsCode(
    () =>
      store.claim({
        userId: USER_ID,
        userHash: USER_HASH,
        appleRequired: false,
        sessionId: SESSION_ID,
        leaseToken: 'eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee',
      }),
    'ACCOUNT_DELETION_APPLE_REAUTHORIZATION_REQUIRED',
  );
  assert(
    String(store.state.nextStep) === 'apple_in_progress',
    'unpreflighted Apple recovery changed durable state.',
  );
});

Deno.test('an expired Apple lease is reclaimed and rejects the stale checkpoint', async () => {
  const store = new MemoryStateStore();
  const staleLeaseToken = 'dddddddd-dddd-4ddd-8ddd-dddddddddddd';
  const freshLeaseToken = 'eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee';
  store.state.nextStep = 'apple_in_progress';
  store.leaseToken = staleLeaseToken;
  store.expireLease();

  const reclaimed = await store.claim({
    userId: USER_ID,
    userHash: USER_HASH,
    appleRequired: true,
    sessionId: SESSION_ID,
    leaseToken: freshLeaseToken,
  });
  assert(reclaimed.nextStep === 'apple', 'expired Apple attempt was not reclaimed atomically.');
  await store.beginAppleAttempt({
    requestId: reclaimed.requestId,
    userId: USER_ID,
    leaseToken: freshLeaseToken,
  });

  await assertRejectsCode(
    () =>
      store.checkpoint({
        requestId: reclaimed.requestId,
        userId: USER_ID,
        leaseToken: staleLeaseToken,
        expectedStep: 'apple_in_progress',
        result: 'revoked',
      }),
    'ACCOUNT_DELETION_STATE_CONFLICT',
  );
  const current = await store.checkpoint({
    requestId: reclaimed.requestId,
    userId: USER_ID,
    leaseToken: freshLeaseToken,
    expectedStep: 'apple_in_progress',
    result: 'revoked',
  });
  assert(current.nextStep === 'providers_final', 'current Apple worker could not checkpoint.');
});

Deno.test(
  'a retry after committed Apple checkpoint revokes only its fresh credential',
  async () => {
    const store = new MemoryStateStore();
    const harness = actionsFor(store);
    store.state.nextStep = 'apple';
    store.loseCheckpointResponseAfterCommitOnceAt = 'apple_in_progress';

    await assertRejectsCode(() => run(store, harness, 1), 'APPLE_REVOCATION_STATUS_UNKNOWN');
    assert(
      String(store.state.nextStep) === 'providers_final',
      'committed Apple checkpoint did not advance despite response loss.',
    );
    assert(
      JSON.stringify(harness.appleCodes) === JSON.stringify(['apple-code-1']),
      'first Apple credential was not consumed exactly once.',
    );

    // The SQL lease expires before another worker may claim this state. Claim
    // rewinds final provider reconciliation to Apple because the explicit retry
    // issued a new code.
    store.expireLease();
    await run(store, harness, 2);

    assert(String(store.state.nextStep) === 'complete', 'fresh Apple retry did not converge.');
    assert(
      JSON.stringify(harness.appleCodes) === JSON.stringify(['apple-code-1', 'apple-code-2']),
      `expected each fresh code exactly once, received ${harness.appleCodes.join(',')}.`,
    );
  },
);

Deno.test(
  'account deletion never consumes Apple authorization before database completion',
  async () => {
    const store = new MemoryStateStore();
    const harness = actionsFor(store);
    harness.failActionOnceAt = 'database';

    await assertRejectsCode(() => run(store, harness, 1), 'ACTION_FAILED_DATABASE');

    assert(harness.appleCodes.length === 0, 'Apple code was consumed before database completion.');
    assert(
      !harness.calls.includes('auth'),
      'auth identity was removed before database completion.',
    );
    assert(store.state.nextStep === 'database', 'database failure was not retryable.');
  },
);

Deno.test('missing Apple authorization aborts before durable claim or freeze', async () => {
  const store = new MemoryStateStore();
  const harness = actionsFor(store);

  await assertRejectsCode(
    () =>
      runAccountDeletionStateMachine({
        userId: USER_ID,
        userHash: USER_HASH,
        appleRequired: true,
        sessionId: SESSION_ID,
        leaseToken: 'cccccccc-cccc-4ccc-8ccc-cccccccccccc',
        completionTokenHash: COMPLETION_TOKEN_HASH,
        store,
        actions: harness.actions,
        errorCode: (error) => (error instanceof Error ? error.message : String(error)),
      }),
    'APPLE_AUTHORIZATION_CODE_REQUIRED',
  );

  assert(store.claimCalls === 0, 'missing Apple code created or froze a deletion request.');
  assert(harness.calls.length === 0, 'an action ran without Apple authorization.');
});

Deno.test('retry before Apple obtains and consumes only the fresh authorization code', async () => {
  const store = new MemoryStateStore();
  const harness = actionsFor(store);
  harness.failActionOnceAt = 'database';

  await assertRejectsCode(() => run(store, harness, 1), 'ACTION_FAILED_DATABASE');
  await run(store, harness, 2);

  assert(
    JSON.stringify(harness.appleCodes) === JSON.stringify(['apple-code-2']),
    `expected only fresh retry code, received ${harness.appleCodes.join(',')}.`,
  );
});

Deno.test(
  'final provider reconciliation retries with the initiating session and a fresh Apple code',
  async () => {
    const store = new MemoryStateStore();
    const harness = actionsFor(store);
    harness.failActionOnceAt = 'providers_final';

    await assertRejectsCode(() => run(store, harness, 1), 'ACTION_FAILED_PROVIDERS_FINAL');
    assert(store.state.nextStep === 'providers_final', 'final provider failure was not durable.');

    await run(store, harness, 2);

    assert(String(store.state.nextStep) === 'complete', 'final provider retry did not converge.');
    assert(
      harness.calls.filter((step) => step === 'sessions').length === 1,
      'retry revoked the preserved initiating session phase again.',
    );
    assert(
      harness.calls.filter((step) => step === 'providers_final').length === 2,
      'final provider reconciliation was not retried.',
    );
    assert(
      JSON.stringify(harness.appleCodes) === JSON.stringify(['apple-code-1', 'apple-code-2']),
      'provider retry did not revalidate Apple with a fresh single-use code.',
    );
  },
);

Deno.test(
  'delayed auth worker cannot delete after an expired lease is reclaimed to Apple',
  async () => {
    const store = new MemoryStateStore();
    const harness = actionsFor(store);
    const staleAuthLease = 'dddddddd-dddd-4ddd-8ddd-dddddddddddd';
    const recoveryLease = 'eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee';
    store.state.nextStep = 'auth';
    store.leaseToken = staleAuthLease;
    store.leaseActive = true;
    store.expireLease();

    const reclaimed = await store.claim({
      userId: USER_ID,
      userHash: USER_HASH,
      appleRequired: true,
      sessionId: SESSION_ID,
      leaseToken: recoveryLease,
      completionTokenHash: COMPLETION_TOKEN_HASH,
    });
    assert(reclaimed.nextStep === 'apple', 'worker B did not reclaim auth through Apple.');

    await assertRejectsCode(
      () => Promise.resolve().then(() => store.finalizeAuthDeletion()),
      'ACCOUNT_DELETION_AUTH_NOT_READY',
    );
    assert(
      String(store.state.nextStep) === 'apple',
      'delayed worker A destroyed the recovery state.',
    );
    assert(
      store.state.requestId === reclaimed.requestId,
      'delayed worker A discarded recovery id.',
    );

    await runAccountDeletionStateMachine({
      userId: USER_ID,
      userHash: USER_HASH,
      appleRequired: true,
      appleAuthorizationCode: 'apple-code-recovery',
      sessionId: SESSION_ID,
      leaseToken: recoveryLease,
      completionTokenHash: COMPLETION_TOKEN_HASH,
      store,
      actions: harness.actions,
      errorCode: (error) => (error instanceof Error ? error.message.split(':')[0]! : String(error)),
    });
    assert(String(store.state.nextStep) === 'complete', 'worker B recovery did not complete.');
    assert(
      JSON.stringify(harness.calls) === JSON.stringify(['apple', 'providers_final', 'auth']),
      `unexpected auth recovery order: ${harness.calls.join(',')}.`,
    );
  },
);

Deno.test('out-of-order or expired admin auth delete preserves the active receipt', async () => {
  const store = new MemoryStateStore();
  const requestId = store.state.requestId;
  store.state.nextStep = 'database';
  store.leaseToken = 'dddddddd-dddd-4ddd-8ddd-dddddddddddd';
  store.leaseActive = true;

  await assertRejectsCode(
    () => Promise.resolve().then(() => store.finalizeAuthDeletion()),
    'ACCOUNT_DELETION_AUTH_NOT_READY',
  );
  assert(store.state.nextStep === 'database', 'out-of-order auth delete advanced the receipt.');
  assert(store.state.requestId === requestId, 'out-of-order auth delete discarded recovery id.');

  store.state.nextStep = 'auth';
  store.expireLease();
  await assertRejectsCode(
    () => Promise.resolve().then(() => store.finalizeAuthDeletion()),
    'ACCOUNT_DELETION_AUTH_NOT_READY',
  );
  assert(store.state.nextStep === 'auth', 'expired auth delete advanced the receipt.');
  assert(store.state.requestId === requestId, 'expired auth delete discarded recovery id.');
});

Deno.test(
  'auth delete response loss is recovered from the atomic auth trigger receipt',
  async () => {
    const store = new MemoryStateStore();
    const harness = actionsFor(store);
    store.state.nextStep = 'auth';
    harness.loseAuthResponseAfterCommit = true;

    await run(store, harness, 1);

    assert(
      String(store.state.nextStep) === 'complete',
      'auth response loss did not leave a completion receipt.',
    );
    assert(
      harness.calls.filter((step) => step === 'auth').length === 1,
      'auth delete was replayed.',
    );
  },
);

Deno.test('auth checkpoint response loss leaves an atomic complete receipt', async () => {
  const store = new MemoryStateStore();
  const harness = actionsFor(store);
  store.state.nextStep = 'auth';
  store.failCheckpointOnceAt = 'auth';

  await assertRejectsCode(() => run(store, harness, 1), 'CHECKPOINT_FAILED_AUTH');
  assert(
    String(store.state.nextStep) === 'complete',
    'auth trigger receipt was rolled back with response loss.',
  );

  await run(store, harness, 2);
  assert(
    harness.calls.filter((step) => step === 'auth').length === 1,
    'completed auth delete replayed.',
  );
});

Deno.test('non-Apple deletion checkpoints a skip without requesting an Apple code', async () => {
  const store = new MemoryStateStore();
  store.state.appleRequired = false;
  const harness = actionsFor(store);

  const result = await run(store, harness, 1, false);

  assert(harness.appleCodes.length === 0, 'non-Apple account consumed an Apple code.');
  assert(JSON.stringify(result).includes('"apple":"skipped"'), 'missing Apple skip result.');
});

Deno.test('account deletion rejects a concurrent lease without executing an action', async () => {
  const store = new MemoryStateStore();
  const harness = actionsFor(store);
  store.leaseToken = 'dddddddd-dddd-4ddd-8ddd-dddddddddddd';
  store.leaseActive = true;

  await assertRejectsCode(() => run(store, harness, 1), 'ACCOUNT_DELETION_IN_PROGRESS');

  assert(harness.calls.length === 0, 'concurrent worker executed a deletion action.');
  assert(store.state.nextStep === 'revenuecat', 'concurrent worker changed state.');
});

Deno.test('account deletion rejects a retry from a different auth session', async () => {
  const store = new MemoryStateStore();
  const harness = actionsFor(store);

  await assertRejectsCode(
    () =>
      runAccountDeletionStateMachine({
        userId: USER_ID,
        userHash: USER_HASH,
        appleRequired: true,
        appleAuthorizationCode: 'apple-code-other-session',
        sessionId: '88888888-8888-4888-8888-888888888888',
        leaseToken: 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',
        completionTokenHash: COMPLETION_TOKEN_HASH,
        store,
        actions: harness.actions,
        errorCode: (error) => (error instanceof Error ? error.message : String(error)),
      }),
    'ACCOUNT_DELETION_SESSION_MISMATCH',
  );
  assert(harness.calls.length === 0, 'different session executed a deletion action.');
});
