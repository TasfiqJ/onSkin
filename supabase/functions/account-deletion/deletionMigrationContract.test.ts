const MIGRATION_URL = new URL(
  '../../migrations/20260713000043_account_deletion_resumable.sql',
  import.meta.url,
);

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(message);
}

function normalize(sql: string): string {
  return sql.toLowerCase().replace(/\s+/g, ' ');
}

Deno.test('account deletion migration keeps a durable capability receipt', async () => {
  const sql = normalize(await Deno.readTextFile(MIGRATION_URL));

  for (const fragment of [
    'create table public.account_deletion_requests',
    'user_id uuid,',
    'user_hash text not null unique',
    'user_lookup_hash text not null unique',
    "next_step text not null default 'revenuecat'",
    'revenuecat_result text check',
    'alter table public.account_deletion_requests enable row level security',
    'initiating_session_id uuid',
    'completion_token_hash text not null unique',
    "next_step = 'complete' and user_id is null and initiating_session_id is null",
  ]) {
    assert(sql.includes(fragment), `missing durable receipt contract: ${fragment}`);
  }
  assert(
    !sql.includes('references auth.users') &&
      !sql.includes('foreign key (user_id) references auth'),
    'deletion receipt must survive auth.users deletion.',
  );
  assert(
    !sql.includes(
      'grant execute on function public.account_deletion_claim(uuid, text, boolean, uuid, uuid, text) to authenticated',
    ),
    'authenticated clients must not claim service deletion workers.',
  );
});

Deno.test(
  'account deletion migration exposes workers to service role and one terminal capability',
  async () => {
    const sql = normalize(await Deno.readTextFile(MIGRATION_URL));
    const rpcSignatures = [
      'public.account_deletion_preflight(uuid, text)',
      'public.account_deletion_claim(uuid, text, boolean, uuid, uuid, text)',
      'public.account_deletion_begin_apple_attempt(uuid, uuid, uuid)',
      'public.account_deletion_checkpoint(uuid, uuid, uuid, text, text)',
      'public.account_deletion_record_failure(uuid, uuid, uuid, text, text)',
      'public.erase_account_database_state(uuid, uuid, uuid)',
    ];

    for (const signature of rpcSignatures) {
      assert(
        sql.includes(`revoke all on function ${signature} from public, anon, authenticated`),
        `missing client revoke for ${signature}.`,
      );
      assert(
        sql.includes(`grant execute on function ${signature} to service_role`),
        `missing service-role grant for ${signature}.`,
      );
    }
    const completionSignature = 'public.account_deletion_completion_status(text)';
    assert(
      sql.includes(
        `revoke all on function ${completionSignature} from public, anon, authenticated`,
      ),
      'terminal completion capability must reset default client grants first.',
    );
    assert(
      sql.includes(
        `grant execute on function ${completionSignature} to anon, authenticated, service_role`,
      ),
      'terminal completion capability must remain callable after auth deletion.',
    );
    assert(
      !sql.includes(`grant execute on function ${completionSignature} to public`),
      'terminal completion capability must never be granted to PUBLIC.',
    );
    assert(sql.includes('for update'), 'state transitions must lock the durable request row.');
    assert(sql.includes('lease_expires_at'), 'state transitions require an expiring lease.');
    assert(
      !/lease_expires_at\s*(?:<=|>=|=|<|>)\s*now\(\)/.test(sql) &&
        !/lease_expires_at\s*=\s*now\(\)\s*\+/.test(sql),
      'lease decisions must use wall-clock time, not PostgreSQL transaction-start now().',
    );
    assert(
      sql.includes("lease_expires_at = clock_timestamp() + interval '10 minutes'") &&
        sql.includes('v_request.lease_expires_at <= clock_timestamp()') &&
        sql.includes('v_request.lease_expires_at > clock_timestamp()'),
      'claim, renewal, and expiry checks must share wall-clock lease semantics.',
    );
    assert(
      sql.includes(
        "p_apple_required and deletion.next_step in ('apple_in_progress', 'providers_final', 'auth')",
      ),
      'a fresh Apple retry credential must reclaim failed/expired attempts before auth deletion.',
    );
    assert(
      sql.includes("v_request.next_step = 'apple_in_progress' or v_request.lease_token <>") &&
        sql.includes("raise exception 'account_deletion_in_progress'"),
      'an active Apple attempt lease must reject every concurrent recovery claim.',
    );
    assert(
      !sql.includes("if v_request.next_step = 'apple_in_progress' then return query"),
      'apple_in_progress must not remain a terminal unrecoverable claim state.',
    );
    assert(
      sql.includes("raise exception 'account_deletion_apple_reauthorization_required'"),
      'Apple recovery must fail closed when the fresh credential was not preflighted.',
    );
    assert(
      sql.includes('create or replace function public.account_deletion_preflight(') &&
        sql.includes('from auth.identities as identity') &&
        sql.includes("identity.provider = 'apple'"),
      'claim must re-read Apple identity under the account lock after read-only preflight.',
    );
    assert(
      sql.includes('account_deletion_state_conflict'),
      'stale workers must fail with an explicit state conflict.',
    );
    assert(
      sql.includes('p_session_id uuid') &&
        sql.includes('v_request.initiating_session_id is distinct from p_session_id') &&
        sql.includes("raise exception 'account_deletion_session_mismatch'"),
      'claims must remain bound to the verified initiating auth session.',
    );
    assert(
      sql.includes("completion_token_hash ~ '^t_[0-9a-f]{64}$'") &&
        sql.includes('v_request.completion_token_hash is distinct from p_completion_token_hash') &&
        sql.includes("deletion.next_step = 'complete'"),
      'opaque completion lookup must be high-entropy, claim-bound, and complete-only.',
    );
    assert(
      sql.includes("set next_step = 'apple_in_progress'") &&
        sql.includes('apple_attempt_started_at = now()') &&
        sql.includes('and deletion.lease_token = p_lease_token'),
      'Apple must enter a durable non-replayable in-progress state before provider I/O.',
    );
  },
);

Deno.test('wall-clock lease model expires a worker that waited past its deadline', () => {
  const transactionStartedAtMs = 1_000;
  const leaseExpiresAtMs = 2_000;
  const lockAcquiredAtMs = 2_500;

  const transactionStartNowWouldAuthorize = transactionStartedAtMs < leaseExpiresAtMs;
  const wallClockAuthorizes = lockAcquiredAtMs < leaseExpiresAtMs;

  assert(
    transactionStartNowWouldAuthorize,
    'the model must reproduce PostgreSQL now() retaining the pre-wait timestamp.',
  );
  assert(
    !wallClockAuthorizes,
    'clock_timestamp() must reject work after the lease expired while waiting.',
  );
});

Deno.test('account deletion migration freezes direct owner and photo object writes', async () => {
  const sql = normalize(await Deno.readTextFile(MIGRATION_URL));

  for (const fragment of [
    'reject_owned_write_during_account_deletion',
    'reject_parent_owned_write_during_account_deletion',
    'pg_advisory_xact_lock',
    'photos_account_deletion_freeze_insert',
    'photos_account_deletion_freeze_delete',
    'photos_objects_account_deletion_freeze_insert',
    'photos_objects_account_deletion_freeze_delete',
    'as restrictive for insert to authenticated',
    'account_deletion_write_allowed()',
    'before insert or update or delete on public.%i',
    "'routine_steps:routine_id:routines:id:user_id'",
    "'cycle_nights:cycle_id:cycles:id:user_id'",
    "'ask_turn_audit:session_id:ask_sessions:id:user_id'",
    "case when tg_op <> 'insert' then pg_catalog.to_jsonb(old)",
    "case when tg_op <> 'delete' then pg_catalog.to_jsonb(new)",
    'reject_auth_write_during_account_deletion',
    'reject_auth_session_write_during_account_deletion',
    'before update on auth.users',
    'before insert or update or delete on auth.identities',
    'before insert or update on auth.sessions',
    'reject_auth_refresh_token_write_during_account_deletion',
    'before insert or update on auth.refresh_tokens',
    "v_new - 'revoked' - 'updated_at'",
    'v_is_revocation_only',
    'v_initiating_session_id',
    "v_new ->> 'session_id' = v_initiating_session_id::text",
    "v_new ->> 'id' = v_initiating_session_id::text",
    "'app.account_deletion_auth_delete_user_id'",
  ]) {
    assert(sql.includes(fragment), `missing deletion freeze contract: ${fragment}`);
  }
  assert(
    sql.split(
      'where deletion.user_lookup_hash = public.account_deletion_lookup_hash(v_user_id)',
    ).length -
      1 >=
      3,
    'direct, parent, and Storage/RLS freezes must match the retained owner tombstone.',
  );
  assert(
    !sql.includes("where deletion.user_id = v_user_id and deletion.next_step <> 'complete'"),
    'completed deletion must not reopen writes for a still-valid access JWT.',
  );
});

Deno.test('completed owner tombstone denies a still-valid access JWT', () => {
  const deletedOwnerId = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
  const lookupHash = (userId: string) => `lookup:${userId}`;
  const completedReceipt = {
    userId: null,
    userLookupHash: lookupHash(deletedOwnerId),
    nextStep: 'complete',
  };
  const writeAllowed =
    completedReceipt.userLookupHash !== lookupHash(deletedOwnerId);

  assert(completedReceipt.userId === null, 'model must reproduce the terminal receipt.');
  assert(completedReceipt.nextStep === 'complete', 'model must be terminal.');
  assert(!writeAllowed, 'retained lookup tombstone must reject the stale owner bearer.');
});

Deno.test(
  'account deletion database RPC covers every current direct auth-owned table',
  async () => {
    const sql = normalize(await Deno.readTextFile(MIGRATION_URL));
    const directlyOwnedTables = [
      ['profiles', 'id'],
      ['skin_profiles', 'user_id'],
      ['user_products', 'user_id'],
      ['routines', 'user_id'],
      ['routine_completions', 'user_id'],
      ['photos', 'user_id'],
      ['consents', 'user_id'],
      ['notification_preferences', 'user_id'],
      ['routine_conflicts', 'user_id'],
      ['active_ramp', 'user_id'],
      ['shelf_scans', 'user_id'],
      ['cycles', 'user_id'],
      ['streak_freezes', 'user_id'],
      ['notification_log', 'user_id'],
      ['recommendation_preferences', 'user_id'],
      ['recommendations', 'user_id'],
      ['commerce_click_events', 'user_id'],
      ['community_blocks', 'user_id'],
      ['community_questions', 'user_id'],
      ['community_reactions', 'user_id'],
      ['community_reports', 'reporter_id'],
      ['photo_trend', 'user_id'],
      ['ask_sessions', 'user_id'],
      ['ask_safety_audit', 'user_id'],
      ['catalog_corrections', 'user_id'],
      ['catalog_lookup_events', 'user_id'],
      ['reverse_trial_grants', 'user_id'],
    ] as const;

    for (const [table, ownerColumn] of directlyOwnedTables) {
      assert(
        sql.includes(`delete from public.${table} where ${ownerColumn} = p_user_id`),
        `database erase omits public.${table}.`,
      );
      assert(sql.includes(`'${table}:${ownerColumn}'`), `write freeze omits public.${table}.`);
    }
    assert(
      sql.includes('delete from public.entitlements where user_id = p_user_id') &&
        sql.includes('suppress_deleted_entitlement_projection'),
      'service-linked entitlement writes must be suppressed while database erasure still deletes rows.',
    );
    assert(
      sql.includes('delete from public.obf_contribution_queue') &&
        sql.includes('or correction_id in ('),
      'nullable contribution queue ownership must be erased, not orphaned.',
    );
    assert(
      sql.includes('update public.subscriptions_events') &&
        sql.includes('payload = pg_catalog.jsonb_build_object(') &&
        sql.includes('transferred_from = null') &&
        sql.includes('transferred_to = null') &&
        sql.includes('account_deletion_suppressed = true'),
      'retained provider audit rows must have account identifiers scrubbed.',
    );
    assert(
      !sql.includes('delete from auth.users') && !sql.includes('delete from auth.identities'),
      'database RPC must leave the auth identity for the final coordinator step.',
    );
  },
);

Deno.test('auth delete is guarded by the locked ready lease and finalizes atomically', async () => {
  const sql = normalize(await Deno.readTextFile(MIGRATION_URL));

  for (const fragment of [
    'create or replace function public.guard_account_deletion_before_auth_delete()',
    'before delete on auth.users',
    "pg_catalog.hashtextextended('account-deletion:' || old.id::text, 0)",
    'where deletion.user_id = old.id for update',
    "v_request.next_step <> 'auth'",
    'v_request.lease_expires_at <= clock_timestamp()',
    "raise exception 'account_deletion_auth_not_ready'",
    'create or replace function public.finalize_account_deletion_after_auth_delete()',
    'after delete on auth.users',
    "set next_step = 'complete'",
    'user_id = null',
    'completed_at = now()',
    "and deletion.next_step = 'auth'",
    "and v_request.next_step = 'complete'",
    "raise exception 'auth_delete_not_confirmed'",
  ]) {
    assert(sql.includes(fragment), `missing auth crash-safety contract: ${fragment}`);
  }
  assert(
    !sql.includes('auth_deleted_incomplete') && !sql.includes("when 'auth' then 'complete'"),
    'out-of-order auth deletion must roll back; no checkpoint or partial state may claim completion.',
  );
  assert(
    !sql.includes('example.invalid') && !sql.includes('test_fixture'),
    'live-test cleanup must use the deletion state machine, never a shipped auth-guard bypass.',
  );
});

Deno.test(
  'session revocation and final providers are durable before guarded auth deletion',
  async () => {
    const sql = normalize(await Deno.readTextFile(MIGRATION_URL));

    for (const fragment of [
      "'sessions', 'apple',",
      "'apple_in_progress', 'providers_final', 'auth', 'complete'",
      "when 'database' then 'sessions'",
      "when 'sessions' then 'apple'",
      "when 'apple' then 'providers_final'",
      "when 'apple_in_progress' then 'providers_final'",
      "when 'providers_final' then 'auth'",
      "p_expected_step = 'sessions' and p_result <> 'revoked'",
      "p_expected_step = 'providers_final' and p_result <> 'reconciled'",
      'sessions_completed_at',
      'providers_final_completed_at',
    ]) {
      assert(sql.includes(fragment), `missing final reconciliation contract: ${fragment}`);
    }
  },
);

Deno.test('RevenueCat writes are minimized before, during, and after deletion', async () => {
  const sql = normalize(await Deno.readTextFile(MIGRATION_URL));

  for (const fragment of [
    'create or replace function public.suppress_deleted_revenuecat_identity()',
    "pg_catalog.hashtextextended('account-deletion:revenuecat-events', 0)",
    "pg_catalog.hashtextextended('account-deletion:' || v_user_id::text, 0)",
    'deletion.user_lookup_hash = public.account_deletion_lookup_hash(v_user_id)',
    'deletion.user_hash = v_candidate',
    'new.user_id := null',
    'new.resolved_user_id := null',
    'new.app_user_id := null',
    'new.original_app_user_id := null',
    'new.aliases := null',
    'new.transferred_from := null',
    'new.transferred_to := null',
    'new.account_deletion_suppressed := true',
    "new.processing_status := 'account_deleted'",
    'new.projection_applied := false',
    'create or replace function public.suppress_deleted_entitlement_projection()',
  ]) {
    assert(sql.includes(fragment), `missing late RevenueCat contract: ${fragment}`);
  }
  assert(
    sql.split('account-deletion:revenuecat-events').length - 1 >= 3,
    'RevenueCat events, claims, and erasure must share a globally ordered race lock.',
  );
});

Deno.test('order-report relinking is prevented between and after deletion', async () => {
  const sql = normalize(await Deno.readTextFile(MIGRATION_URL));

  for (const fragment of [
    'create table public.account_deletion_click_tombstones',
    "'c_' || pg_catalog.md5('account-deletion:click:' || click.click_token)",
    'create or replace function public.suppress_deleted_order_click_token()',
    'from public.commerce_click_events as click',
    'from public.account_deletion_click_tombstones as tombstone',
    'new.click_token := null',
    'trg_order_attributions_account_deletion_suppress',
  ]) {
    assert(sql.includes(fragment), `missing late order-attribution contract: ${fragment}`);
  }
  assert(
    sql.includes('click_token_hash text primary key') &&
      !sql.includes('create table public.account_deletion_click_tombstones ( click_token text'),
    'late-order tombstones must never retain raw click tokens.',
  );
});
