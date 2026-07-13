import {
  buildRevenueCatAtomicArgs,
  compareProjectionOrder,
  persistRevenueCatEvent,
  type ProjectionOrder,
  type RevenueCatAtomicArgs,
  RevenueCatAtomicProcessingError,
  type RevenueCatAtomicResult,
  type RevenueCatEvent,
  type RevenueCatRpcClient,
} from './webhookCore.ts';

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

const USER_ID = '00000000-0000-4000-8000-000000000001';
const verification = { signatureVerified: true, authVerified: true };

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
    product_id: 'routinekind_pro_annual',
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
    assert(functionName === 'process_revenuecat_webhook_event', `unexpected RPC ${functionName}.`);
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
      event('transfer-event', 'TRANSFER', 1_700_000_000_000, {
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
    assert(args.p_received_at === '2026-07-13T12:00:00.000Z', 'receipt time was not explicit.');
    assert(
      args.p_should_project === false,
      'transfer without reconciliation should be audit-only.',
    );
  },
);

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
      (args.p_user_candidates as string[]).includes(USER_ID),
    'canonical owners were not available for Auth resolution.',
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

Deno.test('RevenueCat cancellation and pause preserve access until expiration', () => {
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
    pause.p_is_active === true && pause.p_will_renew === false,
    'scheduled pause should keep access until its later expiration.',
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

Deno.test('RevenueCat handler delegates all persistence to the atomic ordered RPC', async () => {
  const migration = await Deno.readTextFile(
    new URL(
      '../../migrations/20260713000041_revenuecat_webhook_atomic_projection.sql',
      import.meta.url,
    ),
  );
  const handler = await Deno.readTextFile(new URL('./index.ts', import.meta.url));
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
    assert(migration.toLowerCase().includes(required), `migration is missing: ${required}`);
  }
  for (const argumentName of Object.keys(rpcArgs)) {
    assert(
      migration.includes(`${argumentName} `),
      `RPC argument ${argumentName} is missing from the SQL signature.`,
    );
  }
  assert(
    handler.includes('persistRevenueCatEvent(supabase, atomicArgs)'),
    'handler did not call the atomic RPC boundary.',
  );
  assert(
    !handler.includes(".from('subscriptions_events')") &&
      !handler.includes(".from('entitlements')"),
    'handler retained a split event/projection write path.',
  );
  assert(
    handler.includes("return json('processing failed', 503)"),
    'handler did not request provider retry after atomic failure.',
  );
});
