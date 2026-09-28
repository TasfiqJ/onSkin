function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(message);
}

function compact(value: string): string {
  return value.replace(/--.*$/gm, ' ').replace(/\s+/g, ' ').trim();
}

const migrationUrl = new URL(
  '../../migrations/20260713000050_service_writer_deletion_barriers.sql',
  import.meta.url,
);
const laneMigrationUrl = new URL(
  '../../migrations/20260714000053_entitlement_authority_lanes.sql',
  import.meta.url,
);

Deno.test(
  'reverse-trial grant writes only its app authority lane after the account lock',
  async () => {
    const sql = compact(await Deno.readTextFile(laneMigrationUrl));
    const grantStart = sql.indexOf(
      'create or replace function public.grant_app_granted_reverse_trial( p_user_id uuid, p_expires_at timestamptz, p_environment text )',
    );
    const grantEnd = sql.indexOf(
      'create or replace function public.grant_app_granted_reverse_trial( p_user_id uuid, p_expires_at timestamptz, p_environment text, p_product_id text )',
    );
    const grant = sql.slice(grantStart, grantEnd);
    assert(grantStart >= 0 && grantEnd > grantStart, 'guarded three-argument grant is missing.');
    assert(
      grant.indexOf('public.account_write_allowed(p_user_id)') <
        grant.indexOf('from public.entitlements as entitlements'),
      'the account lock/check must precede the store-lane read.',
    );
    assert(
      !grant.includes('insert into public.entitlements') &&
        !grant.includes('update public.entitlements') &&
        !grant.includes('delete from public.entitlements'),
      'an app grant must never mutate the RevenueCat authority lane.',
    );
    assert(
      grant.includes("current_entitlement.rc_cursor_state = 'legacy_unknown'") &&
        grant.includes("raise exception 'STORE_ENTITLEMENT_RECONCILIATION_REQUIRED'"),
      'an unordered legacy store row must fail closed before granting.',
    );
    assert(
      grant.includes("raise exception 'ACCOUNT_DELETION_IN_PROGRESS' using errcode = 'P0001'"),
      'the grant must return the stable deletion conflict.',
    );
    assert(
      grant.indexOf('public.account_write_allowed(p_user_id)') <
        grant.indexOf('insert into public.reverse_trial_grants'),
      'the deletion check must precede the app-grant write.',
    );
    assert(
      grant.includes('null::text') && grant.includes('null::timestamptz'),
      'the compatibility return must not fabricate RevenueCat identifiers or cursors.',
    );
  },
);

Deno.test(
  'subscription-grants relies on derived expiry and calls only the guarded grant',
  async () => {
    const source = compact(await Deno.readTextFile(new URL('./index.ts', import.meta.url)));
    assert(
      !source.includes("supabase.rpc('expire_app_granted_reverse_trials')"),
      'derived app-grant expiry must not require a global mutation RPC.',
    );
    assert(
      source.includes("supabase.rpc('grant_app_granted_reverse_trial'"),
      'the account-scoped grant RPC must remain the only write entry point.',
    );
  },
);

Deno.test('service-writer migration narrows direct service table mutation', async () => {
  const sql = compact(await Deno.readTextFile(migrationUrl));
  for (const table of [
    'public.entitlements',
    'public.reverse_trial_grants',
    'public.obf_contribution_queue',
  ]) {
    assert(
      sql.includes(`revoke insert, update, delete, truncate on table ${table} from service_role`),
      `${table} direct mutation was not revoked.`,
    );
    assert(
      sql.includes(`grant select on table ${table} to service_role`),
      `${table} service export/reconciliation reads were not retained.`,
    );
  }
});

Deno.test('service-writer migration derives OBF work under the shared account lock', async () => {
  const sql = compact(await Deno.readTextFile(migrationUrl));
  const enqueueStart = sql.indexOf(
    'create or replace function public.enqueue_obf_contribution_for_correction',
  );
  const enqueueEnd = sql.indexOf(
    'revoke all on function public.enqueue_obf_contribution_for_correction',
  );
  const enqueue = sql.slice(enqueueStart, enqueueEnd);
  assert(enqueueStart >= 0 && enqueueEnd > enqueueStart, 'guarded OBF enqueue RPC is missing.');
  assert(
    enqueue.includes('public._account_deletion_advisory_key(v_initial_user_id)'),
    'OBF enqueue must take the shared account advisory lock.',
  );
  assert(
    enqueue.includes('from public.catalog_corrections as corrections') &&
      enqueue.includes('for key share'),
    'OBF ownership and payload must be re-read from the stored correction under lock.',
  );
  assert(
    enqueue.indexOf('from public.account_deletion_barriers as barriers') <
      enqueue.indexOf('insert into public.obf_contribution_queue'),
    'the deletion barrier check must precede queue insertion.',
  );
  assert(
    enqueue.includes("'outcome', 'account_deletion_in_progress', 'enqueued', false"),
    'active deletion must be a successful no-enqueue outcome.',
  );
});
