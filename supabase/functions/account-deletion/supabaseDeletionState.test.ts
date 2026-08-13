import { createSupabaseAccountDeletionStateStore } from './supabaseDeletionState.ts';

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(message);
}

async function assertRejectsCode(operation: () => Promise<unknown>, code: string): Promise<void> {
  try {
    await operation();
  } catch (error) {
    assert(error instanceof Error, 'expected Error rejection.');
    assert(error.message === code, `expected ${code}, received ${error.message}.`);
    return;
  }
  throw new Error(`expected ${code} rejection.`);
}

const VALID_ROW = {
  request_id: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
  next_step: 'storage',
  apple_required: true,
  apple_result: null,
  posthog_result: 'deleted',
};
const COMPLETION_TOKEN_HASH = `t_${'1'.repeat(64)}`;

Deno.test(
  'Supabase deletion preflight is read-only and preserves durable Apple state',
  async () => {
    const calls: Array<{ name: string; args: Record<string, unknown> }> = [];
    const store = createSupabaseAccountDeletionStateStore({
      rpc(name, args) {
        calls.push({ name, args });
        return Promise.resolve({
          data: [{ request_exists: true, apple_required: true, next_step: 'providers_final' }],
          error: null,
        });
      },
    });

    const preflight = await store.preflight({
      userId: '00000000-0000-4000-8000-000000000001',
      userHash: 'u_11111111111111111111111111111111',
    });

    assert(preflight.requestExists, 'durable request was not preserved.');
    assert(preflight.appleRequired, 'durable Apple requirement was not preserved.');
    assert(preflight.nextStep === 'providers_final', 'durable next step was not preserved.');
    assert(calls[0]?.name === 'account_deletion_preflight', 'unexpected preflight RPC.');
    assert(
      calls[0]?.args.p_user_id === '00000000-0000-4000-8000-000000000001',
      'preflight user id was not sent.',
    );
  },
);

Deno.test('Supabase deletion state store maps exact RPC arguments and state', async () => {
  const calls: Array<{ name: string; args: Record<string, unknown> }> = [];
  const store = createSupabaseAccountDeletionStateStore({
    rpc(name, args) {
      calls.push({ name, args });
      return Promise.resolve({ data: [VALID_ROW], error: null });
    },
  });

  const state = await store.claim({
    userId: '00000000-0000-4000-8000-000000000001',
    userHash: 'u_11111111111111111111111111111111',
    appleRequired: true,
    sessionId: '99999999-9999-4999-8999-999999999999',
    leaseToken: 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',
    completionTokenHash: COMPLETION_TOKEN_HASH,
  });

  assert(state.nextStep === 'storage', 'unexpected parsed step.');
  assert(state.posthogResult === 'deleted', 'unexpected parsed PostHog result.');
  assert(calls[0]?.name === 'account_deletion_claim', 'unexpected RPC name.');
  assert(
    calls[0]?.args.p_user_hash === 'u_11111111111111111111111111111111',
    'user hash was not sent.',
  );
  assert(
    calls[0]?.args.p_session_id === '99999999-9999-4999-8999-999999999999',
    'initiating session id was not sent.',
  );
  assert(
    calls[0]?.args.p_completion_token_hash === COMPLETION_TOKEN_HASH,
    'completion token hash was not sent.',
  );

  await store.beginAppleAttempt({
    requestId: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
    userId: '00000000-0000-4000-8000-000000000001',
    leaseToken: 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',
  });
  assert(calls[1]?.name === 'account_deletion_begin_apple_attempt', 'unexpected Apple RPC.');
  assert(
    calls[1]?.args.p_request_id === 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
    'Apple attempt request id was not sent.',
  );
});

Deno.test('Supabase deletion state store accepts transient receipt states', async () => {
  for (const nextStep of ['apple_in_progress', 'providers_final']) {
    const store = createSupabaseAccountDeletionStateStore({
      rpc() {
        return Promise.resolve({ data: [{ ...VALID_ROW, next_step: nextStep }], error: null });
      },
    });
    const state = await store.claim({
      userId: '00000000-0000-4000-8000-000000000001',
      userHash: 'u_11111111111111111111111111111111',
      appleRequired: true,
      sessionId: '99999999-9999-4999-8999-999999999999',
      leaseToken: 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',
      completionTokenHash: COMPLETION_TOKEN_HASH,
    });
    assert(state.nextStep === nextStep, `did not preserve ${nextStep}.`);
  }
});

Deno.test('Supabase deletion state store exposes only a strict terminal capability lookup', async () => {
  const calls: Array<{ name: string; args: Record<string, unknown> }> = [];
  const store = createSupabaseAccountDeletionStateStore({
    rpc(name, args) {
      calls.push({ name, args });
      return Promise.resolve({
        data: [{ ...VALID_ROW, next_step: 'complete', apple_result: 'revoked' }],
        error: null,
      });
    },
  });

  const completed = await store.lookupCompleted({
    completionTokenHash: COMPLETION_TOKEN_HASH,
  });

  assert(completed?.nextStep === 'complete', 'terminal receipt was not returned.');
  assert(calls[0]?.name === 'account_deletion_completion_status', 'unexpected lookup RPC.');
  assert(
    calls[0]?.args.p_completion_token_hash === COMPLETION_TOKEN_HASH,
    'terminal lookup omitted its capability hash.',
  );

  const absent = createSupabaseAccountDeletionStateStore({
    rpc() {
      return Promise.resolve({ data: [], error: null });
    },
  });
  assert(
    (await absent.lookupCompleted({ completionTokenHash: COMPLETION_TOKEN_HASH })) === null,
    'unknown capability must remain an authoritative no-receipt result.',
  );
});

Deno.test('Supabase deletion state store rejects malformed or future state', async () => {
  const store = createSupabaseAccountDeletionStateStore({
    rpc() {
      return Promise.resolve({
        data: [{ ...VALID_ROW, next_step: 'future_step' }],
        error: null,
      });
    },
  });

  await assertRejectsCode(
    () =>
      store.claim({
        userId: '00000000-0000-4000-8000-000000000001',
        userHash: 'u_11111111111111111111111111111111',
        appleRequired: true,
        sessionId: '99999999-9999-4999-8999-999999999999',
        leaseToken: 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',
        completionTokenHash: COMPLETION_TOKEN_HASH,
      }),
    'ACCOUNT_DELETION_STATE_INVALID',
  );
});

Deno.test('Supabase deletion state store preserves explicit state error codes', async () => {
  for (const code of [
    'ACCOUNT_DELETION_IN_PROGRESS',
    'ACCOUNT_DELETION_APPLE_REAUTHORIZATION_REQUIRED',
    'ACCOUNT_DELETION_SESSION_MISMATCH',
  ]) {
    const store = createSupabaseAccountDeletionStateStore({
      rpc() {
        return Promise.resolve({
          data: null,
          error: { message: `Postgres: ${code}` },
        });
      },
    });

    await assertRejectsCode(
      () =>
        store.claim({
          userId: '00000000-0000-4000-8000-000000000001',
          userHash: 'u_11111111111111111111111111111111',
          appleRequired: false,
          sessionId: '99999999-9999-4999-8999-999999999999',
          leaseToken: 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',
          completionTokenHash: COMPLETION_TOKEN_HASH,
        }),
      code,
    );
  }
});

Deno.test('Supabase deletion database RPC fails closed on unknown errors', async () => {
  const store = createSupabaseAccountDeletionStateStore({
    rpc() {
      return Promise.resolve({
        data: null,
        error: { message: 'connection unavailable' },
      });
    },
  });

  await assertRejectsCode(
    () =>
      store.eraseDatabaseState({
        requestId: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
        userId: '00000000-0000-4000-8000-000000000001',
        leaseToken: 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',
      }),
    'DATABASE_ERASURE_FAILED',
  );
});
