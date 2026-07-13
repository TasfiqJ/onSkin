import {
  ACCOUNT_SERVICE_SCRUB_FAILED,
  ACCOUNT_SERVICE_SCRUB_RPC,
  scrubAccountServiceRows,
} from './serviceRoleCleanup.ts';

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(message);
}

async function assertRejectsStableCode(operation: () => Promise<unknown>): Promise<void> {
  try {
    await operation();
  } catch (error) {
    assert(error instanceof Error, 'expected an Error rejection.');
    assert(
      error.message === ACCOUNT_SERVICE_SCRUB_FAILED,
      `expected stable ${ACCOUNT_SERVICE_SCRUB_FAILED}, received ${error.message}.`,
    );
    return;
  }
  throw new Error(`expected ${ACCOUNT_SERVICE_SCRUB_FAILED} rejection.`);
}

const USER_ID = '00000000-0000-4000-8000-000000000001';

type RpcCall = { functionName: string; args: Record<string, unknown> };

function clientReturning(data: unknown, error: unknown = null, calls: RpcCall[] = []) {
  return {
    rpc(functionName: typeof ACCOUNT_SERVICE_SCRUB_RPC, args: { p_user_id: string }) {
      calls.push({ functionName, args });
      return Promise.resolve({ data, error });
    },
  };
}

function successfulResult(options?: {
  orderAttributions?: number;
  commerceClickEventsDeleted?: number;
  subscriptionEventsDeleted?: number;
  subscriptionEventsScrubbed?: number;
}) {
  return {
    complete: true,
    order_attributions_scrubbed: options?.orderAttributions ?? 2,
    commerce_click_events_deleted: options?.commerceClickEventsDeleted ?? 4,
    subscriptions_events_deleted: options?.subscriptionEventsDeleted ?? 3,
    subscriptions_events_scrubbed: options?.subscriptionEventsScrubbed ?? 1,
    residual_order_attributions: 0,
    residual_subscription_identities: 0,
  };
}

Deno.test(
  'account service cleanup calls the atomic RPC with only the verified user id',
  async () => {
    const calls: RpcCall[] = [];
    const result = await scrubAccountServiceRows(
      USER_ID,
      clientReturning(successfulResult(), null, calls),
    );

    assert(calls.length === 1, 'expected exactly one RPC call.');
    assert(
      calls[0]?.functionName === ACCOUNT_SERVICE_SCRUB_RPC,
      `expected ${ACCOUNT_SERVICE_SCRUB_RPC}.`,
    );
    assert(
      JSON.stringify(calls[0]?.args) === JSON.stringify({ p_user_id: USER_ID }),
      'expected only the verified user id RPC argument.',
    );
    assert(result.complete === true, 'expected the database completeness attestation.');
    assert(result.order_attributions_scrubbed === 2, 'expected the order scrub count.');
    assert(result.commerce_click_events_deleted === 4, 'expected the click deletion count.');
    assert(result.subscriptions_events_deleted === 3, 'expected the subscription delete count.');
    assert(result.subscriptions_events_scrubbed === 1, 'expected the subscription scrub count.');
  },
);

Deno.test('account service cleanup accepts a complete zero-count idempotent retry', async () => {
  const result = await scrubAccountServiceRows(
    USER_ID,
    clientReturning(
      successfulResult({
        orderAttributions: 0,
        commerceClickEventsDeleted: 0,
        subscriptionEventsDeleted: 0,
        subscriptionEventsScrubbed: 0,
      }),
    ),
  );

  assert(result.order_attributions_scrubbed === 0, 'expected a zero order retry count.');
  assert(result.commerce_click_events_deleted === 0, 'expected a zero click delete count.');
  assert(result.subscriptions_events_deleted === 0, 'expected a zero subscription delete count.');
  assert(result.subscriptions_events_scrubbed === 0, 'expected a zero subscription retry count.');
  assert(result.residual_order_attributions === 0, 'expected no residual order attribution.');
  assert(
    result.residual_subscription_identities === 0,
    'expected no residual subscription identity.',
  );
});

Deno.test(
  'account service cleanup hides thrown and returned RPC failures behind one stable code',
  async () => {
    await assertRejectsStableCode(() =>
      scrubAccountServiceRows(USER_ID, {
        rpc() {
          throw new Error('database connection and secret details');
        },
      }),
    );

    await assertRejectsStableCode(() =>
      scrubAccountServiceRows(
        USER_ID,
        clientReturning(successfulResult(), {
          message: 'sensitive database error',
        }),
      ),
    );
  },
);

Deno.test(
  'account service cleanup rejects null, array, incomplete, and malformed attestations',
  async () => {
    const malformedResults: unknown[] = [
      null,
      [successfulResult()],
      {},
      { ...successfulResult(), complete: false },
      { ...successfulResult(), extra: 'unattested' },
      { ...successfulResult(), order_attributions_scrubbed: -1 },
      { ...successfulResult(), order_attributions_scrubbed: 1.5 },
      {
        ...successfulResult(),
        order_attributions_scrubbed: Number.MAX_SAFE_INTEGER + 1,
      },
      { ...successfulResult(), subscriptions_events_scrubbed: '3' },
      { ...successfulResult(), commerce_click_events_deleted: -1 },
      { ...successfulResult(), subscriptions_events_deleted: -1 },
      { ...successfulResult(), residual_order_attributions: 1 },
      { ...successfulResult(), residual_subscription_identities: 1 },
    ];

    for (const data of malformedResults) {
      await assertRejectsStableCode(() => scrubAccountServiceRows(USER_ID, clientReturning(data)));
    }

    await assertRejectsStableCode(() =>
      scrubAccountServiceRows('', clientReturning(successfulResult())),
    );
  },
);

Deno.test(
  'account service scrub migration is atomic, service-only, indexed, and fail-closed',
  async () => {
    const migrationUrl = new URL(
      '../../migrations/20260713000046_account_service_row_scrub.sql',
      import.meta.url,
    );
    const sql = (await Deno.readTextFile(migrationUrl)).replace(/--.*$/gm, ' ');

    assert(/^\s*begin\s*;/i.test(sql), 'expected the migration to begin one transaction.');
    assert(/commit\s*;\s*$/i.test(sql), 'expected the migration to commit the transaction.');
    assert(
      /create\s+or\s+replace\s+function\s+public\.scrub_account_service_rows\s*\(\s*p_user_id\s+uuid\s*\)\s*returns\s+jsonb/i.test(
        sql,
      ),
      'expected the typed JSONB scrub RPC.',
    );
    assert(/security\s+definer/i.test(sql), 'expected a SECURITY DEFINER RPC.');
    assert(/set\s+search_path\s*=\s*''/i.test(sql), 'expected an empty fixed search path.');
    assert(
      /revoke\s+all\s+on\s+function\s+public\.scrub_account_service_rows\s*\(\s*uuid\s*\)\s+from\s+public\s*,\s*anon\s*,\s*authenticated\s*;/i.test(
        sql,
      ),
      'expected caller roles to be revoked.',
    );
    assert(
      /grant\s+execute\s+on\s+function\s+public\.scrub_account_service_rows\s*\(\s*uuid\s*\)\s+to\s+service_role\s*;/i.test(
        sql,
      ),
      'expected only the service role to receive RPC execution.',
    );
    assert(
      /create\s+unique\s+index[\s\S]*?on\s+public\.commerce_click_events\s*\(\s*click_token\s*\)/i.test(
        sql,
      ),
      'expected a unique click-token ownership invariant.',
    );

    for (const field of [
      'user_id',
      'resolved_user_id',
      'app_user_id',
      'original_app_user_id',
      'aliases',
      'transferred_from',
      'transferred_to',
    ]) {
      const qualifiedField = new RegExp(`event\\.${field}\\b`, 'i');
      assert(qualifiedField.test(sql), `expected scrub coverage for ${field}.`);
    }

    for (const field of ['user_id', 'resolved_user_id', 'app_user_id', 'original_app_user_id']) {
      const assignedField = new RegExp(`(?:set|,)\\s*${field}\\s*=\\s*case`, 'i');
      assert(assignedField.test(sql), `expected the scrub to mutate ${field}.`);
    }

    for (const field of ['aliases', 'transferred_from', 'transferred_to']) {
      const preservingRemoval = new RegExp(
        `${field}\\s*=\\s*case[\\s\\S]*?event\\.${field}\\s*@>\\s*array\\[v_user_id_text\\][\\s\\S]*?array_remove\\s*\\(\\s*event\\.${field}\\s*,\\s*v_user_id_text\\s*\\)[\\s\\S]*?else\\s+event\\.${field}`,
        'i',
      );
      assert(
        preservingRemoval.test(sql),
        `expected canonical owner-only removal without rebuilding unaffected ${field}.`,
      );
    }

    assert(
      /create\s+or\s+replace\s+function\s+public\._migration_0046_payload_owner_values/i.test(
        sql,
      ) &&
        /join\s+auth\.users\s+as\s+users[\s\S]*?users\.id::text\s*=\s*pg_catalog\.lower/i.test(
          sql,
        ) &&
        /LEGACY_SUBSCRIPTION_OWNER_BACKFILL_INCOMPLETE/i.test(sql),
      'expected live legacy owners to be normalized before payload replacement.',
    );
    assert(
      /create\s+or\s+replace\s+function\s+public\.canonical_subscription_owner_identity/i.test(
        sql,
      ) &&
        /pg_catalog\.btrim\s*\(\s*p_value\s*,\s*E'[^']*'/i.test(sql) &&
        /create\s+or\s+replace\s+function\s+public\.canonicalize_subscription_event_owners\s*\(\s*\)[\s\S]*?security\s+definer[\s\S]*?set\s+search_path\s*=\s*''/i.test(
          sql,
        ) &&
        /create\s+trigger\s+subscriptions_events_canonical_owner_identities/i.test(sql) &&
        /SUBSCRIPTION_OWNER_CANONICALIZATION_INCOMPLETE/i.test(sql) &&
        /event\.app_user_id\s*=\s*v_user_id_text/i.test(sql) &&
        /event\.aliases\s*@>\s*array\[v_user_id_text\]/i.test(sql),
      'expected enforced ASCII-whitespace/case canonicalization before indexable exact matching.',
    );
    assert(
      /legacy_missing_rc_event_id_/i.test(sql) &&
        /validate\s+constraint\s+subscriptions_events_rc_event_id_nonempty/i.test(sql) &&
        /LEGACY_SUBSCRIPTION_EVENT_ID_COLLISION_PREFLIGHT/i.test(sql),
      'expected NULL and blank legacy event ids to be repaired before mass updates.',
    );
    assert(
      /create\s+or\s+replace\s+function\s+public\._migration_0046_append_missing_text_values/i.test(
        sql,
      ) &&
        /from\s+unnest\s*\(\s*coalesce\s*\(\s*p_existing[\s\S]*?with\s+ordinality\s+as\s+existing/i.test(
          sql,
        ) &&
        /where\s+legacy_owners\.id\s*=\s*events\.id\s+and\s*\(/i.test(sql),
      'expected existing alias bytes to be preserved and unrelated rows to avoid normalization.',
    );
    for (const field of [
      'app_user_id',
      'original_app_user_id',
      'aliases',
      'transferred_from',
      'transferred_to',
    ]) {
      assert(
        new RegExp(`owner_keys[\\s\\S]*?'${field}'`, 'i').test(sql),
        `expected legacy owner extraction for ${field}.`,
      );
    }
    assert(
      /create\s+or\s+replace\s+function\s+public\._migration_0046_sanitized_payload/i.test(sql) &&
        /jsonb_object_agg\s*\(\s*key\s*,\s*value\s*\)/i.test(sql) &&
        /where\s+payload\s+is\s+distinct\s+from\s+public\._migration_0046_sanitized_payload\s*\(\s*payload\s*\)/i.test(
          sql,
        ),
      'expected every historical payload to be replaced with the typed current allowlist.',
    );
    assert(
      /LEGACY_SUBSCRIPTION_OWNER_FIXTURE_FAILED/i.test(sql) &&
        /LEGACY_SUBSCRIPTION_OWNER_MERGE_FIXTURE_FAILED/i.test(sql) &&
        /LEGACY_SUBSCRIPTION_PAYLOAD_FIXTURE_FAILED/i.test(sql) &&
        /SUBSCRIPTION_PAYLOAD_ALLOWLIST_INCOMPLETE/i.test(sql) &&
        /subscriber_attributes/i.test(sql) &&
        /entitlement_ids/i.test(sql),
      'expected executable legacy owner, nested-payload, and mixed-array rehearsal fixtures.',
    );
    assert(
      /delete\s+from\s+public\.subscriptions_events[\s\S]*?CUSTOMER_DELETION_REQUESTED[\s\S]*?account_deletion_/i.test(
        sql,
      ) && /LEGACY_ACCOUNT_DELETION_HASH_PURGE_INCOMPLETE/i.test(sql),
      'expected legacy deterministic deletion-hash audit rows to be purged fail-closed.',
    );
    assert(
      /create\s+temporary\s+table\s+migration_0046_legacy_deleted_identities/i.test(sql) &&
        /pg_catalog\.sha256/i.test(sql) &&
        /pg_catalog\.translate/i.test(sql) &&
        /account_deletion_/i.test(sql) &&
        /not\s+exists\s*\([\s\S]*?from\s+auth\.users\s+as\s+still_live/i.test(sql) &&
        /LEGACY_DELETED_SUBSCRIPTION_IDENTITY_SCRUB_INCOMPLETE/i.test(sql),
      'expected hash markers to recover only already-deleted UUIDs and scrub their legacy residue.',
    );

    for (const key of [
      'complete',
      'order_attributions_scrubbed',
      'commerce_click_events_deleted',
      'subscriptions_events_deleted',
      'subscriptions_events_scrubbed',
      'residual_order_attributions',
      'residual_subscription_identities',
    ]) {
      assert(new RegExp(`'${key}'`, 'i').test(sql), `expected RPC result key ${key}.`);
    }
    assert(
      /delete\s+from\s+public\.subscriptions_events\s+as\s+event[\s\S]*?not\s+exists\s*\([\s\S]*?from\s+auth\.users\s+as\s+other_user/i.test(
        sql,
      ),
      'expected account-only subscription events to be deleted while live shared owners are preserved.',
    );
    assert(
      /foreign\s+key\s*\(\s*click_token\s*\)[\s\S]*?references\s+public\.commerce_click_events\s*\(\s*click_token\s*\)[\s\S]*?on\s+delete\s+set\s+null/i.test(
        sql,
      ),
      'expected attribution tokens to detach when their owner click is deleted.',
    );
    assert(
      /delete\s+from\s+public\.commerce_click_events\s+as\s+click\s+where\s+click\.user_id\s*=\s*p_user_id/i.test(
        sql,
      ),
      'expected the service-row RPC to delete the verified account click rows.',
    );
    assert(
      /if\s+residual_order_attributions\s*<>\s*0\s+or\s+residual_subscription_identities\s*<>\s*0\s+then[\s\S]*?ACCOUNT_SERVICE_SCRUB_INCOMPLETE/i.test(
        sql,
      ),
      'expected residual rows to abort the RPC before completion.',
    );
  },
);
