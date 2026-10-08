import {
  attachRevenueCatIdentityTombstoneLookup,
  buildRevenueCatAtomicArgs as buildAtomicArgs,
  compareProjectionOrder,
  extractRevenueCatAccountUuidCandidates,
  filterRevenueCatIdentitiesForActiveAccounts,
  persistRevenueCatEvent,
  type ProjectionOrder,
  type RevenueCatAtomicArgs,
  RevenueCatAtomicProcessingError,
  type RevenueCatAtomicResult,
  type RevenueCatEvent,
  RevenueCatIdentityInputError,
  type RevenueCatRpcClient,
} from './webhookCore.ts';
import { parseRevenueCatIdentityTombstoneKeyring } from '../_shared/revenueCatIdentityTombstone.ts';

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(message);
}

async function assertAtomicFailure(operation: () => Promise<unknown>): Promise<void> {
  try {
    await operation();
  } catch (error) {
    assert(error instanceof RevenueCatAtomicProcessingError, 'expected stable atomic failure.');
    assert(
      error.message === 'REVENUECAT_ATOMIC_PROCESSING_FAILED',
      'atomic failure exposed an unstable error.',
    );
    return;
  }
  throw new Error('expected atomic operation to fail.');
}

function assertIdentityInputFailure(
  operation: () => unknown,
  code: 'INVALID_REVENUECAT_IDENTITY_SHAPE' | 'INVALID_ACTIVE_ACCOUNT_SET',
  forbiddenValue?: string,
): void {
  try {
    operation();
  } catch (error) {
    assert(error instanceof RevenueCatIdentityInputError, 'expected stable identity input error.');
    assert(error.message === code, `expected ${code}, received ${error.message}.`);
    if (forbiddenValue) {
      assert(!error.message.includes(forbiddenValue), 'identity input error leaked raw input.');
    }
    return;
  }
  throw new Error('expected identity input operation to fail.');
}

const USER_ID = '00000000-0000-4000-8000-000000000001';
const verification = { signatureVerified: true, authVerified: true };

function buildRevenueCatAtomicArgs(
  input: RevenueCatEvent,
  verified: Parameters<typeof buildAtomicArgs>[1],
  receivedAt = new Date(),
) {
  return buildAtomicArgs(input, verified, receivedAt, {
    monthly: 'layerwell_pro_monthly',
    annual: 'layerwell_pro_annual',
  });
}

function event(
  id: string,
  type: string,
  eventTimestampMs: number,
  overrides: Partial<RevenueCatEvent> = {},
): RevenueCatEvent {
  return {
    id,
    type,
    event_timestamp_ms: eventTimestampMs,
    app_user_id: USER_ID,
    original_app_user_id: USER_ID,
    aliases: [USER_ID],
    entitlement_ids: ['pro'],
    product_id: 'layerwell_pro_annual',
    store: 'APP_STORE',
    environment: 'PRODUCTION',
    purchased_at_ms: eventTimestampMs - 1_000,
    expiration_at_ms: eventTimestampMs + 86_400_000,
    original_transaction_id: 'original-transaction',
    transaction_id: `transaction-${id}`,
    period_type: 'NORMAL',
    ...overrides,
  };
}

type AuditRow = {
  status: string;
  projectionApplied: boolean;
  attempts: number;
};

class AtomicReferenceRpc implements RevenueCatRpcClient {
  readonly calls: RevenueCatAtomicArgs[] = [];
  readonly events = new Map<string, AuditRow>();
  readonly knownUserIds = new Set([USER_ID]);
  projection: RevenueCatAtomicArgs | null = null;
  failNext = false;

  rpc(functionName: string, args: RevenueCatAtomicArgs) {
    assert(
      functionName === 'process_revenuecat_webhook_event_guarded',
      `unexpected RPC ${functionName}.`,
    );
    this.calls.push(structuredClone(args));

    const existingEvent = this.events.get(args.p_rc_event_id);
    if (
      existingEvent &&
      existingEvent.status !== 'error' &&
      existingEvent.status !== 'unresolved_user'
    ) {
      return Promise.resolve({
        data: [result('duplicate', existingEvent.projectionApplied, existingEvent.status)],
        error: null,
      });
    }

    const attempts = (existingEvent?.attempts ?? 0) + 1;
    if (this.failNext) {
      this.failNext = false;
      this.events.set(args.p_rc_event_id, {
        status: 'error',
        projectionApplied: false,
        attempts,
      });
      return Promise.resolve({
        data: [result('error', false, 'error')],
        error: null,
      });
    }

    const hasResolvedUser = args.p_user_candidates.some((candidate) =>
      this.knownUserIds.has(candidate),
    );
    let status = hasResolvedUser ? 'ignored_event_type' : 'unresolved_user';
    let projectionApplied = false;
    if (hasResolvedUser && args.p_should_project) {
      if (!this.projection || compareArgs(args, this.projection) > 0) {
        this.projection = structuredClone(args);
        status = 'processed';
        projectionApplied = true;
      } else {
        status = 'stale';
      }
    }

    this.events.set(args.p_rc_event_id, {
      status,
      projectionApplied,
      attempts,
    });
    const outcome =
      status === 'processed'
        ? 'processed'
        : status === 'stale'
          ? 'stale'
          : status === 'unresolved_user'
            ? 'unresolved'
            : 'ignored';
    return Promise.resolve({
      data: [result(outcome, projectionApplied, status)],
      error: null,
    });
  }
}

function result(
  outcome: RevenueCatAtomicResult['outcome'],
  projectionApplied: boolean,
  processingStatus: string,
): RevenueCatAtomicResult {
  return {
    outcome,
    projection_applied: projectionApplied,
    processing_status: processingStatus,
  };
}

function orderFor(args: RevenueCatAtomicArgs): ProjectionOrder {
  return {
    providerEventAt: args.p_provider_event_at,
    priority: args.p_projection_priority,
    eventId: args.p_rc_event_id,
  };
}

function compareArgs(left: RevenueCatAtomicArgs, right: RevenueCatAtomicArgs): number {
  return compareProjectionOrder(orderFor(left), orderFor(right));
}

Deno.test(
  'RevenueCat normalization uses provider time and deterministic reassignment candidates',
  () => {
    const args = buildRevenueCatAtomicArgs(
      event('transfer-event', '\t transfer \n', 1_700_000_000_000, {
        app_user_id: '00000000-0000-4000-8000-000000000009',
        original_app_user_id: '00000000-0000-4000-8000-000000000008',
        aliases: ['00000000-0000-4000-8000-000000000007', '00000000-0000-4000-8000-000000000006'],
        transferred_to: [
          '00000000-0000-4000-8000-000000000003',
          '00000000-0000-4000-8000-000000000002',
        ],
        transferred_from: ['00000000-0000-4000-8000-000000000004'],
      }),
      verification,
      new Date('2026-07-13T12:00:00.000Z'),
    );

    assert(
      JSON.stringify(args.p_user_candidates) ===
        JSON.stringify([
          '00000000-0000-4000-8000-000000000002',
          '00000000-0000-4000-8000-000000000003',
          '00000000-0000-4000-8000-000000000009',
          '00000000-0000-4000-8000-000000000008',
          '00000000-0000-4000-8000-000000000006',
          '00000000-0000-4000-8000-000000000007',
        ]),
      'transfer destination/direct/original/alias resolution order was not deterministic.',
    );
    assert(
      args.p_provider_event_at === '2023-11-14T22:13:20.000Z',
      'provider event time was not normalized.',
    );
    assert(args.p_event_type === 'TRANSFER', 'transfer event type was not trimmed and normalized.');
    assert(args.p_received_at === '2026-07-13T12:00:00.000Z', 'receipt time was not explicit.');
    assert(
      args.p_should_project === false,
      'transfer without reconciliation should be audit-only.',
    );
  },
);

Deno.test('RevenueCat promotional webhooks stay in the provider authority lane', () => {
  const args = buildRevenueCatAtomicArgs(
    event('promotional-provider-event', 'INITIAL_PURCHASE', 1_700_000_000_000, {
      store: 'PROMOTIONAL',
      product_id: 'rc_promo_pro_monthly',
    }),
    verification,
  );

  assert(args.p_store === 'promotional', 'provider promotional access was misclassified.');
});

Deno.test('RevenueCat owner UUIDs canonicalize ASCII boundary whitespace and case', () => {
  const canonical = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa4';
  const args = buildRevenueCatAtomicArgs(
    event('canonical-owner-event', 'RENEWAL', 1_700_000_000_000, {
      app_user_id: `\t${canonical.toUpperCase()}\n`,
      original_app_user_id: `\r${USER_ID}\f`,
      aliases: [` ${canonical.toUpperCase()} `, canonical, 'opaque-provider-alias'],
      transferred_from: [`\v${canonical.toUpperCase()}\t`],
      transferred_to: [`\n${USER_ID}\r`],
    }),
    verification,
  );

  assert(args.p_app_user_id === canonical, 'app user UUID was not canonicalized.');
  assert(args.p_original_app_user_id === USER_ID, 'original app user UUID was not canonicalized.');
  assert(
    JSON.stringify(args.p_aliases) === JSON.stringify([canonical, 'opaque-provider-alias']),
    'alias UUIDs were not canonicalized/deduplicated without changing opaque aliases.',
  );
  assert(
    JSON.stringify(args.p_transferred_from) === JSON.stringify([canonical]) &&
      JSON.stringify(args.p_transferred_to) === JSON.stringify([USER_ID]),
    'transfer UUIDs were not canonicalized.',
  );
  assert(
    (args.p_user_candidates as string[]).includes(canonical) &&
      (args.p_user_candidates as string[]).includes(USER_ID) &&
      !(args.p_user_candidates as string[]).includes('opaque-provider-alias'),
    'canonical owners were unavailable or an opaque provider alias became an Auth candidate.',
  );
});

Deno.test(
  'RevenueCat account UUID extraction is canonical, deduplicated, and globally sorted',
  () => {
    const first = '11111111-1111-4111-8111-111111111111';
    const second = '22222222-2222-4222-8222-222222222222';
    const third = '33333333-3333-4333-8333-333333333333';
    const fourth = '44444444-4444-4444-8444-444444444444';
    const fifth = '55555555-5555-4555-8555-555555555555';
    const candidates = extractRevenueCatAccountUuidCandidates({
      app_user_id: `\n${fifth.toUpperCase()}\t`,
      original_app_user_id: first,
      aliases: [fourth, second.toUpperCase(), '$RCAnonymousID:provider-owned', first],
      transferred_from: [third, second],
      transferred_to: [fifth, fourth],
    });

    assert(
      JSON.stringify(candidates) === JSON.stringify([first, second, third, fourth, fifth]),
      'lock inputs were not globally sorted canonical UUIDs.',
    );
    assert(
      !candidates.some((candidate) => candidate.includes('RCAnonymousID')),
      'provider-anonymous identity entered the account lock set.',
    );
  },
);

Deno.test(
  'RevenueCat embedded UUIDs are lock and suppression inputs but never semantic owners',
  () => {
    const embedded = '66666666-6666-4666-8666-666666666666';
    const providerIdentity = `$RCAnonymousID:${embedded.toUpperCase()}`;
    assert(
      JSON.stringify(
        extractRevenueCatAccountUuidCandidates({
          app_user_id: providerIdentity,
        }),
      ) === JSON.stringify([embedded]),
      'embedded UUID was omitted from the global lock set.',
    );
    const decision = filterRevenueCatIdentitiesForActiveAccounts(
      { type: 'RENEWAL', app_user_id: providerIdentity },
      [embedded],
    );
    assert(decision.outcome === 'persist', 'live embedded UUID was incorrectly suppressed.');
    assert(
      decision.userCandidates.length === 0,
      'embedded UUID alias was promoted to an entitlement owner.',
    );
    const args = buildRevenueCatAtomicArgs(
      event('embedded-owner-event', 'RENEWAL', 1_700_000_000_000, {
        app_user_id: providerIdentity,
        original_app_user_id: undefined,
        aliases: [],
      }),
      verification,
    );
    assert(
      args.p_user_candidates.length === 0,
      'embedded UUID entered the semantic database candidate list.',
    );
  },
);

Deno.test(
  'RevenueCat HMAC lookup covers exact and embedded identities across key versions',
  async () => {
    const embedded = '77777777-7777-4777-8777-777777777777';
    const providerIdentity = `$RCAnonymousID:${embedded}`;
    const webhookEvent = event('hmac-coverage', 'RENEWAL', 1_700_000_000_000, {
      app_user_id: providerIdentity,
      original_app_user_id: undefined,
      aliases: ['opaque-alias'],
    });
    const keyring = parseRevenueCatIdentityTombstoneKeyring(
      `1=${'11'.repeat(32)};2=${'22'.repeat(32)}`,
      '2',
    );
    const args = await attachRevenueCatIdentityTombstoneLookup(
      buildRevenueCatAtomicArgs(webhookEvent, verification),
      webhookEvent,
      'proj_test_123',
      keyring,
    );

    assert(
      args.p_identity_hmacs.length === 6 &&
        args.p_identity_hmac_key_versions.length === 6 &&
        args.p_identity_values.length === 6,
      'lookup did not cover three hash identities under both configured keys.',
    );
    assert(
      args.p_identity_values.filter((value) => value === providerIdentity).length === 4,
      'provider identity was not mapped to both its full and embedded-UUID HMACs.',
    );
    assert(
      new Set(args.p_identity_hmac_key_versions).size === 2 &&
        args.p_identity_hmacs.every((value) => /^[a-f0-9]{64}$/.test(value)),
      'lookup omitted a key version or emitted a malformed HMAC.',
    );
    assert(
      JSON.stringify(args.p_user_candidates) === JSON.stringify([]),
      'HMAC coverage changed semantic ownership.',
    );
  },
);

Deno.test(
  'RevenueCat active filtering strips every barred UUID and preserves semantic resolution order',
  () => {
    const barredApp = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa1';
    const activeOriginal = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbb2';
    const activeDestination = 'cccccccc-cccc-4ccc-8ccc-ccccccccccc3';
    const activeAlias = 'dddddddd-dddd-4ddd-8ddd-ddddddddddd4';
    const barredAlias = 'eeeeeeee-eeee-4eee-8eee-eeeeeeeeeee5';
    const decision = filterRevenueCatIdentitiesForActiveAccounts(
      {
        type: 'TRANSFER',
        app_user_id: ` ${barredApp.toUpperCase()} `,
        original_app_user_id: activeOriginal.toUpperCase(),
        aliases: [
          activeAlias.toUpperCase(),
          barredAlias,
          '$RCAnonymousID:retained-provider-alias',
          `$RCAnonymousID:${barredApp.toUpperCase()}`,
        ],
        transferred_from: [barredApp, '$RCAnonymousID:retained-source'],
        transferred_to: [activeDestination, barredAlias, activeOriginal],
      },
      [activeAlias, activeOriginal, activeDestination],
    );

    assert(decision.outcome === 'persist', 'mixed live/deleted event was incorrectly suppressed.');
    assert(
      JSON.stringify(decision.userCandidates) ===
        JSON.stringify([activeDestination, activeOriginal, activeAlias]),
      'live destination/app/original/alias resolution order was not preserved.',
    );
    assert(decision.identityFields.app_user_id === null, 'barred scalar UUID survived.');
    assert(
      decision.identityFields.original_app_user_id === activeOriginal,
      'active original UUID was not canonicalized and retained.',
    );
    assert(
      JSON.stringify(decision.identityFields.aliases) ===
        JSON.stringify(['$RCAnonymousID:retained-provider-alias', activeAlias]),
      'alias filtering did not preserve only safe opaque and active identities.',
    );
    assert(
      JSON.stringify(decision.identityFields.transferred_from) ===
        JSON.stringify(['$RCAnonymousID:retained-source']),
      'barred transfer source UUID survived.',
    );
    const serialized = JSON.stringify(decision).toLowerCase();
    assert(!serialized.includes(barredApp), 'barred app UUID leaked into the persisted result.');
    assert(
      !serialized.includes(barredAlias),
      'barred alias UUID leaked into the persisted result.',
    );
  },
);

Deno.test('RevenueCat live owner resolution preserves category and provider array order', () => {
  const destinationTwo = '20000000-0000-4000-8000-000000000002';
  const destinationOne = '10000000-0000-4000-8000-000000000001';
  const appUser = '30000000-0000-4000-8000-000000000003';
  const originalUser = '40000000-0000-4000-8000-000000000004';
  const aliasTwo = '60000000-0000-4000-8000-000000000006';
  const aliasOne = '50000000-0000-4000-8000-000000000005';
  const active = [appUser, originalUser, aliasOne, aliasTwo, destinationOne, destinationTwo];
  const decision = filterRevenueCatIdentitiesForActiveAccounts(
    {
      type: '\t transfer \r\n',
      app_user_id: appUser,
      original_app_user_id: originalUser,
      aliases: [aliasTwo, aliasOne, appUser],
      transferred_to: [destinationTwo, destinationOne, originalUser],
      transferred_from: [],
    },
    active,
  );

  assert(decision.outcome === 'persist', 'live transfer event was suppressed.');
  assert(
    JSON.stringify(decision.userCandidates) ===
      JSON.stringify([destinationTwo, destinationOne, originalUser, appUser, aliasTwo, aliasOne]),
    'resolution did not preserve transfer destination before app/original/aliases.',
  );
});

Deno.test('RevenueCat transfer destinations cannot own non-transfer events', () => {
  const destination = '20000000-0000-4000-8000-000000000002';
  const nonTransferEvent = {
    type: '\t renewal \r\n',
    app_user_id: '$RCAnonymousID:app',
    transferred_to: [destination],
  };
  const decision = filterRevenueCatIdentitiesForActiveAccounts(nonTransferEvent, [destination]);

  assert(decision.outcome === 'persist', 'live non-transfer audit was suppressed.');
  assert(
    decision.userCandidates.length === 0,
    'a transfer destination resolved ownership outside a TRANSFER event.',
  );
  assert(
    JSON.stringify(decision.identityFields.transferred_to) === JSON.stringify([destination]),
    'a non-transfer destination was not retained as filtered audit evidence.',
  );
  assert(
    JSON.stringify(extractRevenueCatAccountUuidCandidates(nonTransferEvent)) ===
      JSON.stringify([destination]),
    'a non-transfer destination was omitted from deletion locking/classification.',
  );

  const args = buildRevenueCatAtomicArgs(
    event('non-transfer-destination', '\t renewal \r\n', 1_700_000_000_000, {
      app_user_id: '$RCAnonymousID:app',
      original_app_user_id: undefined,
      aliases: [],
      transferred_from: [],
      transferred_to: [destination],
    }),
    verification,
  );
  assert(args.p_event_type === 'RENEWAL', 'non-transfer event type was not normalized.');
  assert(
    JSON.stringify(args.p_transferred_to) === JSON.stringify([destination]),
    'non-transfer destination was lost before database audit filtering.',
  );
  assert(
    !(args.p_user_candidates as string[]).includes(destination),
    'Edge semantic candidates promoted a non-transfer destination.',
  );
});

Deno.test(
  'RevenueCat all-barred account events return one identifier-free suppression result',
  () => {
    const barred = '99999999-9999-4999-8999-999999999999';
    const unrelatedActive = '77777777-7777-4777-8777-777777777777';
    const decision = filterRevenueCatIdentitiesForActiveAccounts(
      {
        app_user_id: barred,
        aliases: [barred.toUpperCase(), '$RCAnonymousID:must-not-revive-account'],
        transferred_from: [barred],
        transferred_to: [],
      },
      [unrelatedActive],
    );

    assert(
      JSON.stringify(decision) === JSON.stringify({ outcome: 'suppressed_deleted_account' }),
      'suppression result exposed event identity or unstable detail.',
    );
    assert(
      !JSON.stringify(decision).toLowerCase().includes(barred),
      'suppression result leaked a barred account UUID.',
    );
  },
);

Deno.test(
  'RevenueCat anonymous-only identities remain audit-only and cannot resolve Auth owners',
  () => {
    const unrelatedActive = '88888888-8888-4888-8888-888888888888';
    const decision = filterRevenueCatIdentitiesForActiveAccounts(
      {
        app_user_id: '$RCAnonymousID:app',
        original_app_user_id: ' provider-original ',
        aliases: ['$RCAnonymousID:alias', 'provider-alias'],
        transferred_from: ['$RCAnonymousID:source'],
        transferred_to: ['$RCAnonymousID:destination'],
      },
      [unrelatedActive],
    );

    assert(
      decision.outcome === 'persist',
      'anonymous-only event was treated as a deleted account.',
    );
    assert(decision.userCandidates.length === 0, 'anonymous identity could resolve an Auth owner.');
    assert(
      decision.identityFields.app_user_id === '$RCAnonymousID:app' &&
        decision.identityFields.original_app_user_id === ' provider-original ',
      'safe scalar provider identities were not preserved with existing semantics.',
    );
    assert(
      JSON.stringify(decision.identityFields.transferred_to) ===
        JSON.stringify(['$RCAnonymousID:destination']),
      'safe transfer provider identity was not preserved.',
    );
  },
);

Deno.test('RevenueCat UUID case variants deduplicate across fields and active results', () => {
  const canonical = 'abcdefab-cdef-4abc-8def-abcdefabcdef';
  const decision = filterRevenueCatIdentitiesForActiveAccounts(
    {
      app_user_id: canonical.toUpperCase(),
      original_app_user_id: `\t${canonical}\r`,
      aliases: [canonical, canonical.toUpperCase(), canonical],
      transferred_from: [canonical.toUpperCase(), canonical],
      transferred_to: [canonical, canonical.toUpperCase()],
    },
    [canonical.toUpperCase(), canonical],
  );

  assert(decision.outcome === 'persist', 'canonical active account was suppressed.');
  assert(
    JSON.stringify(decision.userCandidates) === JSON.stringify([canonical]),
    'semantic owner list retained UUID duplicates.',
  );
  assert(
    JSON.stringify(decision.identityFields.aliases) === JSON.stringify([canonical]) &&
      JSON.stringify(decision.identityFields.transferred_from) === JSON.stringify([canonical]) &&
      JSON.stringify(decision.identityFields.transferred_to) === JSON.stringify([canonical]),
    'structured identity arrays retained case-variant UUID duplicates.',
  );
});

Deno.test('RevenueCat identity runtime shapes and active account sets fail closed', () => {
  const malformedEvents: unknown[] = [
    null,
    [],
    { app_user_id: 42 },
    { app_user_id: ' \t\r ' },
    { original_app_user_id: {} },
    { aliases: {} },
    { aliases: ['provider-alias', 7] },
    { transferred_from: [null] },
    { transferred_to: [''] },
  ];
  for (const malformed of malformedEvents) {
    assertIdentityInputFailure(
      () => extractRevenueCatAccountUuidCandidates(malformed),
      'INVALID_REVENUECAT_IDENTITY_SHAPE',
    );
  }
  assertIdentityInputFailure(
    () =>
      buildRevenueCatAtomicArgs(
        event('malformed-handler-event', 'RENEWAL', 1_700_000_000_000, {
          aliases: ['safe-provider-alias', 7] as unknown as string[],
        }),
        verification,
      ),
    'INVALID_REVENUECAT_IDENTITY_SHAPE',
  );

  const privateMalformedValue = 'private-malformed-provider-value';
  assertIdentityInputFailure(
    () =>
      filterRevenueCatIdentitiesForActiveAccounts({ app_user_id: USER_ID }, [
        privateMalformedValue,
      ]),
    'INVALID_ACTIVE_ACCOUNT_SET',
    privateMalformedValue,
  );
  assertIdentityInputFailure(
    () => filterRevenueCatIdentitiesForActiveAccounts({ app_user_id: USER_ID }, {}),
    'INVALID_ACTIVE_ACCOUNT_SET',
  );
  assertIdentityInputFailure(
    () => filterRevenueCatIdentitiesForActiveAccounts({ app_user_id: USER_ID }, [7]),
    'INVALID_ACTIVE_ACCOUNT_SET',
  );
});

Deno.test('RevenueCat duplicate delivery produces one audit event and one projection', async () => {
  const rpc = new AtomicReferenceRpc();
  const args = buildRevenueCatAtomicArgs(
    event('same-event', 'INITIAL_PURCHASE', 1_700_000_000_000),
    verification,
  );

  const first = await persistRevenueCatEvent(rpc, args);
  const duplicate = await persistRevenueCatEvent(rpc, args);

  assert(first.outcome === 'processed', 'first event was not processed.');
  assert(duplicate.outcome === 'duplicate', 'second delivery was not a duplicate success.');
  assert(rpc.events.size === 1, 'duplicate inserted a second audit event.');
  assert(rpc.projection?.p_rc_event_id === 'same-event', 'duplicate changed the projection.');
});

Deno.test(
  'RevenueCat persistence accepts only the exact deleted-account suppression result',
  async () => {
    const args = buildRevenueCatAtomicArgs(
      event('suppression-event', 'RENEWAL', 1_700_000_000_000),
      verification,
    );
    const exactClient: RevenueCatRpcClient = {
      rpc(functionName) {
        assert(
          functionName === 'process_revenuecat_webhook_event_guarded',
          'persistence bypassed the deletion-aware RPC.',
        );
        return Promise.resolve({
          data: [result('suppressed_deleted_account', false, 'suppressed_deleted_account')],
          error: null,
        });
      },
    };
    const exact = await persistRevenueCatEvent(exactClient, args);
    assert(
      exact.outcome === 'suppressed_deleted_account',
      'exact suppression was not an acknowledged outcome.',
    );

    for (const malformed of [
      result('suppressed_deleted_account', true, 'suppressed_deleted_account'),
      result('suppressed_deleted_account', false, 'processed'),
    ]) {
      const malformedClient: RevenueCatRpcClient = {
        rpc() {
          return Promise.resolve({ data: [malformed], error: null });
        },
      };
      await assertAtomicFailure(() => persistRevenueCatEvent(malformedClient, args));
    }
  },
);

Deno.test('RevenueCat cancellation preserves finite access; Android pause is audit only', () => {
  const cancellation = buildRevenueCatAtomicArgs(
    event('cancel-event', 'CANCELLATION', 1_700_000_000_000),
    verification,
  );
  const pause = buildRevenueCatAtomicArgs(
    event('pause-event', 'SUBSCRIPTION_PAUSED', 1_700_000_001_000),
    verification,
  );
  const billingIssue = buildRevenueCatAtomicArgs(
    event('billing-event', 'BILLING_ISSUE', 1_700_000_002_000),
    verification,
  );

  assert(
    cancellation.p_is_active === true && cancellation.p_will_renew === false,
    'cancellation should stop renewal without revoking access.',
  );
  assert(
    pause.p_should_project === false,
    'Android-only scheduled pause entered the reviewed iOS projection.',
  );
  assert(
    billingIssue.p_is_active === true && billingIssue.p_will_renew === true,
    'billing issue should preserve access while store recovery remains possible.',
  );
});

Deno.test(
  'RevenueCat unresolved identity can be replayed after deterministic alias resolution',
  async () => {
    const rpc = new AtomicReferenceRpc();
    const delayedUserId = '00000000-0000-4000-8000-000000000099';
    const args = buildRevenueCatAtomicArgs(
      event('delayed-user-event', 'INITIAL_PURCHASE', 1_700_000_000_000, {
        app_user_id: delayedUserId,
        original_app_user_id: delayedUserId,
        aliases: [delayedUserId],
      }),
      verification,
    );

    const unresolved = await persistRevenueCatEvent(rpc, args);
    assert(unresolved.outcome === 'unresolved', 'missing owner was not audit-only.');
    assert(rpc.projection === null, 'unresolved owner received a projection.');

    rpc.knownUserIds.add(delayedUserId);
    const replay = await persistRevenueCatEvent(rpc, args);
    assert(replay.outcome === 'processed', 'resolved owner replay did not process.');
    assert(rpc.events.size === 1, 'identity replay duplicated the audit event.');
    assert(
      rpc.events.get('delayed-user-event')?.attempts === 2,
      'identity replay was not counted.',
    );
  },
);

Deno.test(
  'RevenueCat reordered delivery records stale events without regressing entitlement',
  async () => {
    const newer = buildRevenueCatAtomicArgs(
      event('newer-renewal', 'RENEWAL', 1_700_000_010_000),
      verification,
    );
    const older = buildRevenueCatAtomicArgs(
      event('older-expiration', 'EXPIRATION', 1_700_000_000_000),
      verification,
    );
    const rpc = new AtomicReferenceRpc();

    await persistRevenueCatEvent(rpc, newer);
    const stale = await persistRevenueCatEvent(rpc, older);

    assert(stale.outcome === 'stale', 'older reordered event was not recorded as stale.');
    assert(rpc.events.size === 2, 'stale event was lost from the audit log.');
    assert(
      rpc.projection?.p_rc_event_id === 'newer-renewal' && rpc.projection.p_is_active === true,
      'older expiration regressed a newer active entitlement.',
    );

    const sameTimeRenewal = buildRevenueCatAtomicArgs(
      event('same-time-renewal', 'RENEWAL', 1_700_000_020_000),
      verification,
    );
    const sameTimeExpiration = buildRevenueCatAtomicArgs(
      event('same-time-expiration', 'EXPIRATION', 1_700_000_020_000),
      verification,
    );
    const tieRpc = new AtomicReferenceRpc();
    await persistRevenueCatEvent(tieRpc, sameTimeExpiration);
    const tieStale = await persistRevenueCatEvent(tieRpc, sameTimeRenewal);
    assert(tieStale.outcome === 'stale', 'same-time lifecycle priority was not deterministic.');
    assert(tieRpc.projection?.p_is_active === false, 'same-time expiration did not win the tie.');
  },
);

Deno.test('RevenueCat atomic failure is retryable without a partial projection', async () => {
  const rpc = new AtomicReferenceRpc();
  const args = buildRevenueCatAtomicArgs(
    event('retry-event', 'INITIAL_PURCHASE', 1_700_000_000_000),
    verification,
  );
  rpc.failNext = true;

  await assertAtomicFailure(() => persistRevenueCatEvent(rpc, args));
  assert(rpc.projection === null, 'failed transaction left a partial entitlement projection.');
  assert(rpc.events.get('retry-event')?.status === 'error', 'failed event was not replayable.');

  const retry = await persistRevenueCatEvent(rpc, args);
  assert(retry.outcome === 'processed', 'same-id error retry did not process.');
  assert(rpc.events.size === 1, 'error retry duplicated the audit row.');
  assert(rpc.events.get('retry-event')?.attempts === 2, 'retry attempt was not counted.');
  const committedProjection = rpc.projection as RevenueCatAtomicArgs | null;
  assert(
    committedProjection?.p_rc_event_id === 'retry-event',
    'retry did not commit the projection.',
  );
});

Deno.test('RevenueCat handler delegates all persistence to the guarded atomic RPC', async () => {
  const atomicMigration = await Deno.readTextFile(
    new URL(
      '../../migrations/20260713000041_revenuecat_webhook_atomic_projection.sql',
      import.meta.url,
    ),
  );
  const guardMigration = await Deno.readTextFile(
    new URL(
      '../../migrations/20260713000049_revenuecat_deletion_barrier_guard.sql',
      import.meta.url,
    ),
  );
  const identityMigration = await Deno.readTextFile(
    new URL('../../migrations/20260713000051_revenuecat_identity_tombstones.sql', import.meta.url),
  );
  const handler = await Deno.readTextFile(new URL('./index.ts', import.meta.url));
  const core = await Deno.readTextFile(new URL('./webhookCore.ts', import.meta.url));
  const rpcArgs = buildRevenueCatAtomicArgs(
    event('contract-event', 'RENEWAL', 1_700_000_000_000),
    verification,
  );

  for (const required of [
    'create or replace function public.process_revenuecat_webhook_event',
    'on conflict (rc_event_id) do nothing',
    "when v_entitlement_user_id is null then 'stale'",
    'excluded.rc_event_at > entitlement_projection.rc_event_at',
    'excluded.rc_event_priority >',
    'pg_catalog.convert_to(excluded.rc_event_id',
    'exception when others then',
    "processing_status = 'error'",
    'security definer',
    "set search_path = ''",
    'to service_role',
  ]) {
    assert(
      atomicMigration.toLowerCase().includes(required),
      `atomic migration is missing: ${required}`,
    );
  }
  for (const argumentName of Object.keys(rpcArgs)) {
    assert(
      identityMigration.includes(`${argumentName} `),
      `guarded RPC argument ${argumentName} is missing from migration 0051.`,
    );
  }
  for (const required of [
    'create table public.revenuecat_identity_tombstones',
    'create or replace function public.establish_revenuecat_deletion_identity_barrier',
    'tombstone_version smallint',
    'identity_count integer',
    'p_identity_hmac_key_versions smallint[]',
    'p_identity_hmacs text[]',
    'p_identity_values text[]',
    'public._revenuecat_embedded_account_uuids(',
    'public._revenuecat_identity_tombstone_advisory_key(',
    'for v_lock_version, v_lock_hmac in',
    'pg_catalog.pg_advisory_xact_lock(',
    'v_tombstoned_values',
    'tombstones.expires_at > v_now',
    'from public.process_revenuecat_webhook_event_guarded(',
    'revoke insert, update, delete, truncate, references, trigger',
    'on table public.subscriptions_events from service_role',
    'on table public.entitlements from service_role',
  ]) {
    assert(
      identityMigration.toLowerCase().includes(required.toLowerCase()),
      `identity tombstone migration is missing: ${required}`,
    );
  }
  for (const required of [
    'create or replace function public.process_revenuecat_webhook_event_guarded',
    'raw_identities(value)',
    "coalesce(p_user_candidates, '{}'::text[])",
    "coalesce(p_aliases, '{}'::text[])",
    "coalesce(p_transferred_from, '{}'::text[])",
    "coalesce(p_transferred_to, '{}'::text[])",
    'array_agg(account_id order by account_id::text)',
    'foreach v_account_id in array v_all_account_ids loop',
    'pg_catalog.pg_advisory_xact_lock(',
    'public._account_deletion_advisory_key(v_account_id)',
    'from auth.users as users',
    'from public.account_deletion_barriers as barriers',
    'public._revenuecat_filter_identity_scalar(',
    'public._revenuecat_filter_identity_array(',
    "where v_event_type = 'TRANSFER'",
    "'suppressed_deleted_account'::text",
    'from public.process_revenuecat_webhook_event(',
    ') from public, anon, authenticated, service_role;',
    ') to service_role;',
  ]) {
    assert(
      guardMigration.toLowerCase().includes(required.toLowerCase()),
      `deletion guard migration is missing: ${required}`,
    );
  }
  assert(
    /client\.rpc\(\s*['"]process_revenuecat_webhook_event_guarded['"]/.test(core),
    'persistence did not select the guarded RPC.',
  );
  assert(
    !/client\.rpc\(\s*['"]process_revenuecat_webhook_event['"]/.test(core),
    'persistence retained a direct unguarded RPC path.',
  );
  assert(
    handler.includes('persistRevenueCatEvent(supabase, atomicArgs)'),
    'handler did not call the atomic RPC boundary.',
  );
  assert(
    handler.includes('attachRevenueCatIdentityTombstoneLookup(') &&
      handler.includes('REVENUECAT_IDENTITY_TOMBSTONE_HMAC_KEYS') &&
      handler.includes('REVENUECAT_IDENTITY_TOMBSTONE_HMAC_CURRENT_VERSION'),
    'handler did not authenticate every identity against the tombstone keyring.',
  );
  assert(
    !/\.from\(\s*['"]subscriptions_events['"]/.test(handler) &&
      !/\.from\(\s*['"]entitlements['"]/.test(handler),
    'handler retained a split event/projection write path.',
  );
  assert(
    /return json\(\s*['"]processing failed['"]\s*,\s*503\s*\)/.test(handler),
    'handler did not request provider retry after atomic failure.',
  );
});
