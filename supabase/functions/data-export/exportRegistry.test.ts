import {
  buildDirectExportPlans,
  CALLER_RPC_OWNER_EXPORTS,
  CALLER_RLS_EXPORT_TABLES,
  type ExportTable,
  SERVICE_ONLY_EXPORT_DENYLIST,
  SERVICE_ROLE_DIRECT_USER_EXPORT_TABLES,
  SERVICE_ROLE_FILTERED_EXPORTS,
  SPECIAL_SERVICE_ROLE_FILTERED_EXPORTS,
  SUBSCRIPTION_EVENT_EXPORT_COLUMNS,
  subscriptionEventOwnerFilter,
  validateExportRegistry,
} from './exportRegistry.ts';
import { CATALOG_CORRECTION_EXPORT_COLUMNS } from './catalogCorrectionExportCore.ts';

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(message);
}

function assertThrowsReason(operation: () => unknown, reason: string): void {
  try {
    operation();
  } catch (error) {
    assert(error instanceof Error, 'expected an Error rejection.');
    assert(
      error.message.includes(reason),
      `expected rejection containing ${reason}, received ${error.message}.`,
    );
    return;
  }
  throw new Error(`expected ${reason} rejection.`);
}

const VERIFIED_USER_ID = '00000000-0000-4000-8000-000000000001';
const OTHER_USER_ID = '00000000-0000-4000-8000-000000000002';

Deno.test('actual export registry is duplicate-free and derives truthful coverage', () => {
  validateExportRegistry();

  assert(CALLER_RLS_EXPORT_TABLES.length === 28, 'expected all 28 active owner-client tables.');
  assert(
    new Set(CALLER_RLS_EXPORT_TABLES.map((item) => item.table)).size ===
      CALLER_RLS_EXPORT_TABLES.length,
    'caller registry contains a duplicate table.',
  );
  assert(
    JSON.stringify(SERVICE_ROLE_FILTERED_EXPORTS) ===
      JSON.stringify(['subscriptions_events', 'reverse_trial_grants', 'order_attributions']),
    'service-role coverage was not derived from the executed registries.',
  );
  assert(
    !CALLER_RLS_EXPORT_TABLES.some((item) => item.table === 'reverse_trial_grants'),
    'reverse-trial grants returned to the caller-RLS registry.',
  );
  assert(
    !CALLER_RLS_EXPORT_TABLES.some((item) => item.table === 'shelf_scans'),
    'sealed raw scan history returned to the caller-RLS registry.',
  );
  assert(
    !CALLER_RLS_EXPORT_TABLES.some((item) => item.table === 'catalog_corrections'),
    'sealed operator workflow returned to the caller-RLS registry.',
  );
  assert(
    !SERVICE_ROLE_DIRECT_USER_EXPORT_TABLES.some(
      (item) => item.table === 'obf_contribution_queue',
    ) && SERVICE_ONLY_EXPORT_DENYLIST.includes('obf_contribution_queue'),
    'purged contribution work returned to an executable export registry.',
  );
});

Deno.test('catalog correction export excludes every internal operator field', () => {
  assert(
    CALLER_RPC_OWNER_EXPORTS.includes('catalog_corrections'),
    'corrections must use the dedicated authenticated-owner RPC.',
  );
  assert(
    !SERVICE_ROLE_DIRECT_USER_EXPORT_TABLES.some((item) => item.table === 'catalog_corrections'),
    'corrections must never use raw service-role table selection.',
  );
  const columns = new Set<string>(CATALOG_CORRECTION_EXPORT_COLUMNS);
  for (const internal of [
    'assigned_to',
    'resolved_by',
    'resolution_note',
    'operator_reviewed_at',
    'operator_reviewed_by',
    'operator_review_note',
    'intake_request_id',
    'intake_health_epoch',
    'intake_request_digest',
    'export_total_count',
  ]) {
    assert(!columns.has(internal), `internal correction field leaked: ${internal}`);
  }
});

Deno.test('every canonical service-only table is rejected from the caller registry', () => {
  for (const table of SERVICE_ONLY_EXPORT_DENYLIST) {
    const mutant: ExportTable = {
      table,
      filter: { column: 'user_id', value: 'USER_ID' },
      scope: 'caller_rls',
      orderBy: ['id'],
    };
    assertThrowsReason(
      () =>
        validateExportRegistry({
          callerTables: [...CALLER_RLS_EXPORT_TABLES, mutant],
        }),
      `EXPORT_REGISTRY_SERVICE_ONLY_IN_CALLER:${table}`,
    );
  }
});

Deno.test('reverse-trial plan uses only the service-role client and verified-user filter', () => {
  const plans = buildDirectExportPlans(VERIFIED_USER_ID);
  const reverseTrialPlans = plans.filter((item) => item.table === 'reverse_trial_grants');
  assert(reverseTrialPlans.length === 1, 'expected exactly one reverse-trial export plan.');

  const plan = reverseTrialPlans[0];
  assert(
    plan.clientKind === 'service_role',
    'reverse-trial export must use the service-role client.',
  );
  assert(
    plan.scope === 'service_role_filtered',
    'reverse-trial manifest scope must be service-role.',
  );
  assert(plan.filter?.column === 'user_id', 'reverse-trial filter must target user_id.');
  assert(
    plan.filter?.value === VERIFIED_USER_ID,
    'reverse-trial filter must resolve from the verified caller identity.',
  );
  assert(
    plan.selectColumns === 'user_id, granted_at, expires_at, source, metadata',
    'reverse-trial output columns must remain explicitly allowlisted.',
  );

  const visibleRows = [
    { user_id: VERIFIED_USER_ID },
    {
      user_id: OTHER_USER_ID,
    },
  ].filter((row) => row[plan.filter!.column as 'user_id'] === plan.filter!.value);
  assert(visibleRows.length === 1, 'verified-user filter did not isolate one reverse-trial row.');
  assert(
    visibleRows[0]?.user_id === VERIFIED_USER_ID,
    "verified-user filter included another user's reverse-trial row.",
  );
});

Deno.test('direct service plans cannot use an unverified or non-service filter', () => {
  const reverseTrial = SERVICE_ROLE_DIRECT_USER_EXPORT_TABLES.find(
    (item) => item.table === 'reverse_trial_grants',
  );
  assert(reverseTrial, 'reverse-trial service plan is missing.');

  assertThrowsReason(
    () =>
      validateExportRegistry({
        directServiceTables: [{ ...reverseTrial, filter: null }],
        specialServiceTables: SPECIAL_SERVICE_ROLE_FILTERED_EXPORTS,
      }),
    'EXPORT_REGISTRY_UNVERIFIED_SERVICE_FILTER:reverse_trial_grants',
  );
  assertThrowsReason(
    () =>
      validateExportRegistry({
        directServiceTables: [{ ...reverseTrial, scope: 'caller_rls' }],
        specialServiceTables: SPECIAL_SERVICE_ROLE_FILTERED_EXPORTS,
      }),
    'EXPORT_REGISTRY_SERVICE_SCOPE:reverse_trial_grants',
  );
  assertThrowsReason(
    () =>
      validateExportRegistry({
        directServiceTables: [{ ...reverseTrial, selectColumns: undefined }],
        specialServiceTables: SPECIAL_SERVICE_ROLE_FILTERED_EXPORTS,
      }),
    'EXPORT_REGISTRY_SERVICE_COLUMNS_REQUIRED:reverse_trial_grants',
  );
});

Deno.test(
  'subscription event matching covers scalar and array identities without exporting them',
  () => {
    const filter = subscriptionEventOwnerFilter(VERIFIED_USER_ID);
    for (const predicate of [
      `user_id.eq.${VERIFIED_USER_ID}`,
      `resolved_user_id.eq.${VERIFIED_USER_ID}`,
      `app_user_id.eq.${VERIFIED_USER_ID}`,
      `original_app_user_id.eq.${VERIFIED_USER_ID}`,
      `aliases.cs.{${VERIFIED_USER_ID}}`,
      `transferred_from.cs.{${VERIFIED_USER_ID}}`,
      `transferred_to.cs.{${VERIFIED_USER_ID}}`,
    ]) {
      assert(filter.split(',').includes(predicate), `subscription filter is missing ${predicate}.`);
    }

    const exportedColumns = new Set<string>(SUBSCRIPTION_EVENT_EXPORT_COLUMNS);
    assert(
      JSON.stringify(SUBSCRIPTION_EVENT_EXPORT_COLUMNS) ===
        JSON.stringify([
          'id',
          'rc_event_id',
          'event_type',
          'received_at',
          'environment',
          'store',
          'product_id',
          'provider_event_at',
        ]),
      'subscription event allowlist drifted from reviewed schema fields.',
    );
    for (const privateColumn of [
      'user_id',
      'resolved_user_id',
      'app_user_id',
      'original_app_user_id',
      'aliases',
      'transferred_from',
      'transferred_to',
      'signature_verified',
      'auth_verified',
      'processing_status',
      'error',
      'payload',
    ]) {
      assert(
        !exportedColumns.has(privateColumn),
        `subscription export leaked owner/internal column ${privateColumn}.`,
      );
    }

    const legacyRow = {
      id: 'event-a',
      rc_event_id: 'provider-a',
      event_type: 'TRANSFER',
      received_at: '2026-07-13T00:00:00.000Z',
      environment: 'sandbox',
      store: 'app_store',
      product_id: 'annual',
      provider_event_at: '2026-07-13T00:00:00.000Z',
      payload: {
        event: {
          app_user_id: OTHER_USER_ID,
          aliases: [OTHER_USER_ID],
          transferred_to: [OTHER_USER_ID],
        },
      },
    };
    const projectedLegacyRow = Object.fromEntries(
      SUBSCRIPTION_EVENT_EXPORT_COLUMNS.map((column) => [column, legacyRow[column]]),
    );
    assert(
      !JSON.stringify(projectedLegacyRow).includes(OTHER_USER_ID),
      'subscription allowlist leaked an identity nested in a legacy raw payload.',
    );
  },
);
