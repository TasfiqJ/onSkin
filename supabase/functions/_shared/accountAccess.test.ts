import { preflightAccountAccess } from './accountAccess.ts';

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(message);
}

const userId = '00000000-0000-4000-8000-000000000001';

function client(data: unknown, error: unknown = null) {
  return {
    rpc(functionName: 'get_account_access_state') {
      assert(
        functionName === 'get_account_access_state',
        'the guard must call only the owner-derived access authority',
      );
      return Promise.resolve({ data, error });
    },
  };
}

Deno.test('account access accepts active Apple and non-Apple authority rows', async () => {
  const active = await preflightAccountAccess(
    client([{ user_id: userId, state: 'active', generation: '7' }]),
    userId,
  );
  assert(active.ok, 'active Apple lifecycle should pass');
  assert(active.snapshot.generation === '7', 'generation must remain an exact decimal string');

  const nonApple = await preflightAccountAccess(
    client([{ user_id: userId, state: 'not_applicable', generation: 0 }]),
    userId,
  );
  assert(nonApple.ok, 'non-Apple account should pass');
  assert(nonApple.snapshot.generation === '0', 'safe numeric generations should canonicalize');
});

Deno.test('account access rejects blocked lifecycle and stale exact session', async () => {
  const blocked = await preflightAccountAccess(
    client([{ user_id: userId, state: 'blocked', generation: '8' }]),
    userId,
  );
  assert(
    !blocked.ok && blocked.error === 'ACCOUNT_ACCESS_BLOCKED' && blocked.status === 403,
    'blocked Apple lifecycle must not authorize service-role work',
  );

  const staleSession = await preflightAccountAccess(
    client(null, { code: '28000', message: 'ACCOUNT_ACCESS_SESSION_REJECTED' }),
    userId,
  );
  assert(
    !staleSession.ok &&
      staleSession.error === 'ACCOUNT_ACCESS_UNAUTHORIZED' &&
      staleSession.status === 401,
    'a deleted or mismatched auth.sessions row must be unauthorized',
  );

  for (const error of [
    { code: '28000', message: 'private database detail' },
    { code: 'P0001', message: 'ACCOUNT_ACCESS_SESSION_REJECTED' },
  ]) {
    const unavailable = await preflightAccountAccess(client(null, error), userId);
    assert(
      !unavailable.ok && unavailable.error === 'ACCOUNT_ACCESS_UNAVAILABLE',
      'only the exact stable session rejection may map to 401',
    );
  }
});

Deno.test('account access pins state and generation across non-atomic work', async () => {
  const first = await preflightAccountAccess(
    client([{ user_id: userId, state: 'active', generation: '12' }]),
    userId,
  );
  assert(first.ok, 'initial authority should pass');

  const same = await preflightAccountAccess(
    client([{ user_id: userId, state: 'active', generation: 12 }]),
    userId,
    first.snapshot,
  );
  assert(same.ok, 'same canonical generation should remain authorized');

  for (const row of [
    { user_id: userId, state: 'active', generation: '13' },
    { user_id: userId, state: 'not_applicable', generation: '12' },
  ]) {
    const changed = await preflightAccountAccess(client([row]), userId, first.snapshot);
    assert(
      !changed.ok && changed.error === 'ACCOUNT_ACCESS_CHANGED' && changed.status === 409,
      'a credential lifecycle change must discard work admitted by the old generation',
    );
  }
});

Deno.test('account access fails closed on malformed or unavailable authority', async () => {
  const malformed: unknown[] = [
    null,
    [],
    [
      { user_id: userId, state: 'active', generation: '1' },
      { user_id: userId, state: 'active', generation: '1' },
    ],
    [{}],
    [{ user_id: '00000000-0000-4000-8000-000000000002', state: 'active', generation: '1' }],
    [{ user_id: userId, state: 'unknown', generation: '1' }],
    [{ user_id: userId, state: 'active', generation: '-1' }],
    [{ user_id: userId, state: 'active', generation: '01' }],
    [{ user_id: userId, state: 'active', generation: '9223372036854775808' }],
    [{ user_id: userId, state: 'active', generation: Number.MAX_SAFE_INTEGER + 1 }],
    [{ user_id: userId, state: 'active', generation: '1', extra: true }],
  ];
  for (const data of malformed) {
    const result = await preflightAccountAccess(client(data), userId);
    assert(
      !result.ok && result.error === 'ACCOUNT_ACCESS_UNAVAILABLE' && result.status === 503,
      'malformed authority must fail closed',
    );
  }

  const rpcFailure = await preflightAccountAccess(
    client(null, { code: 'PGRST000', message: 'private database detail' }),
    userId,
  );
  assert(
    !rpcFailure.ok && rpcFailure.error === 'ACCOUNT_ACCESS_UNAVAILABLE',
    'non-auth RPC errors must not escape',
  );

  const thrown = await preflightAccountAccess(
    { rpc: () => Promise.reject(new Error('private transport detail')) },
    userId,
  );
  assert(
    !thrown.ok && thrown.error === 'ACCOUNT_ACCESS_UNAVAILABLE',
    'transport errors must fail closed',
  );
});
