import {
  PublicationLeaseError,
  accountPublicationCapability,
  withAccountPublicationLease,
  type PublicationLeaseRpcClient,
} from './publicationLease.ts';

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(message);
}

const USER_ID = '10000000-0000-4000-8000-000000000001';
const SESSION_ID = '20000000-0000-4000-8000-000000000002';
const CAPABILITY = '11'.repeat(32);

type RpcCall = { name: string; args: Record<string, unknown> };

class LeaseRpc implements PublicationLeaseRpcClient {
  readonly calls: RpcCall[] = [];
  readonly statuses = new Map<string, string>([
    ['reserve_account_publication_lease', 'reserved'],
    ['activate_account_publication_lease', 'active'],
    ['renew_account_publication_lease', 'active'],
    ['release_account_publication_lease', 'released'],
  ]);
  errors = new Set<string>();

  rpc(name: string, args: Record<string, unknown>) {
    this.calls.push({ name, args });
    if (this.errors.has(name)) {
      return Promise.resolve({ data: null, error: { message: 'unavailable' } });
    }
    return Promise.resolve({ data: [{ status: this.statuses.get(name) }], error: null });
  }
}

function deterministic(bytes: Uint8Array): Uint8Array {
  bytes.fill(0x11);
  return bytes;
}

async function assertLeaseError(
  operation: () => Promise<unknown>,
  code: PublicationLeaseError['code'],
): Promise<void> {
  try {
    await operation();
  } catch (error) {
    assert(error instanceof PublicationLeaseError, 'expected a contained lease error.');
    assert(error.code === code, `expected ${code}; received ${error.code}.`);
    return;
  }
  throw new Error(`expected ${code}.`);
}

Deno.test('publication capability is exactly 256 bits of lowercase hex', () => {
  const capability = accountPublicationCapability(deterministic);
  assert(capability === CAPABILITY, 'capability bytes were not encoded exactly.');
  assert(/^[a-f0-9]{64}$/.test(capability), 'capability shape is not accepted by migration 0052.');
});

Deno.test(
  'reconciliation reserves, activates, renews, revalidates, and releases in order',
  async () => {
    const rpc = new LeaseRpc();
    const result = await withAccountPublicationLease({
      client: rpc,
      userId: USER_ID,
      sessionId: SESSION_ID,
      fillRandom: deterministic,
      operation: async ({ capability, renew }) => {
        assert(capability === CAPABILITY, 'operation received a different capability.');
        assert(
          rpc.calls.map((call) => call.name).join(',') ===
            'reserve_account_publication_lease,activate_account_publication_lease,renew_account_publication_lease',
          'provider operation started before acquisition and initial revalidation.',
        );
        await renew();
        return 'ok';
      },
    });

    assert(result === 'ok', 'operation result was lost.');
    assert(
      rpc.calls.map((call) => call.name).join(',') ===
        'reserve_account_publication_lease,activate_account_publication_lease,renew_account_publication_lease,renew_account_publication_lease,release_account_publication_lease',
      'lease lifecycle order changed.',
    );
    for (const call of rpc.calls.slice(0, 4)) {
      assert(call.args.p_user_id === USER_ID, 'lease user binding changed.');
      assert(call.args.p_session_id === SESSION_ID, 'lease session binding changed.');
      assert(call.args.p_capability === CAPABILITY, 'lease capability changed.');
    }
  },
);

Deno.test('a deletion race blocks the provider operation and still releases', async () => {
  for (const blockedAction of [
    'reserve_account_publication_lease',
    'activate_account_publication_lease',
    'renew_account_publication_lease',
  ]) {
    const rpc = new LeaseRpc();
    rpc.statuses.set(blockedAction, 'blocked');
    let providerCalled = false;
    await assertLeaseError(
      () =>
        withAccountPublicationLease({
          client: rpc,
          userId: USER_ID,
          sessionId: SESSION_ID,
          fillRandom: deterministic,
          operation: async () => {
            providerCalled = true;
          },
        }),
      'ACCOUNT_DELETION_IN_PROGRESS',
    );
    assert(!providerCalled, `${blockedAction} allowed provider recreation.`);
    assert(
      rpc.calls.at(-1)?.name === 'release_account_publication_lease',
      `${blockedAction} did not release an ambiguous acquisition.`,
    );
  }
});

Deno.test('renewal failure after provider response prevents projection commit', async () => {
  const rpc = new LeaseRpc();
  let providerCalled = false;
  let projectionCalled = false;
  await assertLeaseError(
    () =>
      withAccountPublicationLease({
        client: rpc,
        userId: USER_ID,
        sessionId: SESSION_ID,
        fillRandom: deterministic,
        operation: async ({ renew }) => {
          providerCalled = true;
          rpc.statuses.set('renew_account_publication_lease', 'lease_rejected');
          await renew();
          projectionCalled = true;
        },
      }),
    'ACCOUNT_PUBLICATION_LEASE_UNAVAILABLE',
  );
  assert(providerCalled, 'provider response phase was not exercised.');
  assert(!projectionCalled, 'an expired/rejected lease committed provider state.');
  assert(rpc.calls.at(-1)?.name === 'release_account_publication_lease', 'failure leaked lease.');
});

Deno.test('provider errors and timeouts release the active publication lease', async () => {
  for (const failure of [new Error('provider_error'), new DOMException('timeout', 'AbortError')]) {
    const rpc = new LeaseRpc();
    try {
      await withAccountPublicationLease({
        client: rpc,
        userId: USER_ID,
        sessionId: SESSION_ID,
        fillRandom: deterministic,
        operation: () => Promise.reject(failure),
      });
      throw new Error('expected provider failure.');
    } catch (error) {
      assert(error === failure, 'lease wrapper replaced the primary provider failure.');
    }
    assert(rpc.calls.at(-1)?.name === 'release_account_publication_lease', 'error leaked lease.');
  }
});

Deno.test('ambiguous reserve and release failures fail closed with TTL recovery', async () => {
  const reserveFailure = new LeaseRpc();
  reserveFailure.errors.add('reserve_account_publication_lease');
  await assertLeaseError(
    () =>
      withAccountPublicationLease({
        client: reserveFailure,
        userId: USER_ID,
        sessionId: SESSION_ID,
        fillRandom: deterministic,
        operation: async () => undefined,
      }),
    'ACCOUNT_PUBLICATION_LEASE_UNAVAILABLE',
  );
  assert(
    reserveFailure.calls.at(-1)?.name === 'release_account_publication_lease',
    'lost reserve response was not capability-released.',
  );

  const releaseFailure = new LeaseRpc();
  releaseFailure.errors.add('release_account_publication_lease');
  await assertLeaseError(
    () =>
      withAccountPublicationLease({
        client: releaseFailure,
        userId: USER_ID,
        sessionId: SESSION_ID,
        fillRandom: deterministic,
        operation: async () => 'provider-complete',
      }),
    'ACCOUNT_PUBLICATION_RELEASE_UNAVAILABLE',
  );
});
