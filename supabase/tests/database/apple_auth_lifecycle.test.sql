begin;

create extension if not exists pgtap with schema extensions;
set local search_path = extensions, public, pg_catalog;

-- Keep this explicit so adding or removing a lifecycle guarantee requires a
-- deliberate review of the database contract.
select plan(114);

-- Supabase's hosted bootstrap owns ordinary API table grants. Rehearse the
-- owner-facing profile lane so the restrictive Apple read/write barriers are
-- observable without granting any access to the sealed lifecycle tables.
grant select, update on public.profiles to authenticated;

create or replace function public.pgtap_apple_profile_update(p_display_name text)
returns bigint
language plpgsql
set search_path = ''
as $$
declare
  v_count bigint;
begin
  update public.profiles
     set display_name = p_display_name
   where id = (select auth.uid());
  get diagnostics v_count = row_count;
  return v_count;
end;
$$;
grant execute on function public.pgtap_apple_profile_update(text) to authenticated;

insert into auth.users (id) values
  ('80000000-0000-4000-8000-000000000001'),
  ('80000000-0000-4000-8000-000000000002'),
  ('80000000-0000-4000-8000-000000000003'),
  ('80000000-0000-4000-8000-000000000004'),
  ('80000000-0000-4000-8000-000000000005'),
  ('80000000-0000-4000-8000-000000000006'),
  ('80000000-0000-4000-8000-000000000007'),
  ('80000000-0000-4000-8000-000000000008'),
  ('80000000-0000-4000-8000-000000000009'),
  ('80000000-0000-4000-8000-000000000010');

insert into auth.sessions (id, user_id) values
  ('81000000-0000-4000-8000-000000000001', '80000000-0000-4000-8000-000000000001'),
  ('81000000-0000-4000-8000-000000000002', '80000000-0000-4000-8000-000000000002'),
  ('81000000-0000-4000-8000-000000000003', '80000000-0000-4000-8000-000000000003'),
  ('81000000-0000-4000-8000-000000000004', '80000000-0000-4000-8000-000000000004'),
  ('81000000-0000-4000-8000-000000000005', '80000000-0000-4000-8000-000000000005'),
  ('81000000-0000-4000-8000-000000000006', '80000000-0000-4000-8000-000000000006'),
  ('81000000-0000-4000-8000-000000000007', '80000000-0000-4000-8000-000000000007'),
  ('81000000-0000-4000-8000-000000000008', '80000000-0000-4000-8000-000000000008'),
  ('81000000-0000-4000-8000-000000000009', '80000000-0000-4000-8000-000000000009'),
  ('81000000-0000-4000-8000-000000000010', '80000000-0000-4000-8000-000000000010');

-- User 2 deliberately remains non-Apple. Users 8 and 9 receive their Apple
-- identities later to exercise pre-identity terminal-event recovery.
insert into auth.identities (provider_id, user_id, identity_data, provider) values
  (
    'apple.subject.capture', '80000000-0000-4000-8000-000000000001',
    '{"sub":"apple.subject.capture"}'::jsonb, 'apple'
  ),
  (
    'apple.subject.worker', '80000000-0000-4000-8000-000000000003',
    '{"sub":"apple.subject.worker"}'::jsonb, 'apple'
  ),
  (
    'apple.subject.native', '80000000-0000-4000-8000-000000000004',
    '{"sub":"apple.subject.native"}'::jsonb, 'apple'
  ),
  (
    'apple.subject.failure', '80000000-0000-4000-8000-000000000005',
    '{"sub":"apple.subject.failure"}'::jsonb, 'apple'
  ),
  (
    'apple.subject.consent', '80000000-0000-4000-8000-000000000006',
    '{"sub":"apple.subject.consent"}'::jsonb, 'apple'
  ),
  (
    'apple.subject.legacy', '80000000-0000-4000-8000-000000000007',
    '{"sub":"apple.subject.legacy"}'::jsonb, 'apple'
  ),
  (
    'apple.subject.unlinked', '80000000-0000-4000-8000-000000000010',
    '{"sub":"apple.subject.unlinked"}'::jsonb, 'apple'
  ),
  (
    'alternate@example.invalid', '80000000-0000-4000-8000-000000000010',
    '{"sub":"alternate@example.invalid","email":"alternate@example.invalid"}'::jsonb,
    'email'
  );

-- This ordinary, non-health receipt is a positive control for the legacy
-- SECURITY DEFINER consent helper. Its underlying answer is true for user 1,
-- so false results before vaulting or after session deletion prove the new
-- account fence rather than an absent row.
insert into public.consents (
  user_id, consent_type, granted, version, consent_text_hash
) values (
  '80000000-0000-4000-8000-000000000001',
  'marketing', true, 'pgtap-apple-v1', repeat('a', 64)
);

-- ---------------------------------------------------------------------------
-- Sealed schema, grants, and restrictive read-fence shape
-- ---------------------------------------------------------------------------

select has_table(
  'public', 'apple_auth_lifecycles',
  'the sealed Apple credential lifecycle authority is installed'
);
select has_table(
  'public', 'apple_auth_capture_operations',
  'the one-use authorization-code dispatch ledger is installed'
);
select has_table(
  'public', 'apple_auth_server_events',
  'the replay-deduplicated Apple event ledger is installed'
);

select is(
  (
    select count(*)
      from pg_catalog.pg_class as relations
     where relations.oid = any(array[
       'public.apple_auth_lifecycles'::regclass,
       'public.apple_auth_capture_operations'::regclass,
       'public.apple_auth_server_events'::regclass
     ])
       and relations.relrowsecurity
       and relations.relforcerowsecurity
  ),
  3::bigint,
  'all Apple lifecycle tables enable and force RLS'
);

select ok(
  not exists (
    select 1
      from unnest(array['anon', 'authenticated', 'service_role']) as roles(role_name)
      cross join unnest(array[
        'public.apple_auth_lifecycles',
        'public.apple_auth_capture_operations',
        'public.apple_auth_server_events'
      ]) as tables(table_name)
     where pg_catalog.has_table_privilege(roles.role_name, tables.table_name, 'SELECT')
        or pg_catalog.has_table_privilege(roles.role_name, tables.table_name, 'INSERT')
        or pg_catalog.has_table_privilege(roles.role_name, tables.table_name, 'UPDATE')
        or pg_catalog.has_table_privilege(roles.role_name, tables.table_name, 'DELETE')
  ),
  'no API role, including service_role, can directly access Apple lifecycle rows'
);

select ok(
  not exists (
    select 1
      from unnest(array['anon', 'authenticated', 'service_role']) as roles(role_name)
     where pg_catalog.has_sequence_privilege(
       roles.role_name, 'public.apple_auth_server_events_id_seq', 'SELECT'
     )
        or pg_catalog.has_sequence_privilege(
          roles.role_name, 'public.apple_auth_server_events_id_seq', 'USAGE'
        )
        or pg_catalog.has_sequence_privilege(
          roles.role_name, 'public.apple_auth_server_events_id_seq', 'UPDATE'
        )
  ),
  'the Apple event identity sequence is sealed from every API role'
);

select ok(
  pg_catalog.has_function_privilege(
    'authenticated', 'public.account_access_allowed()', 'EXECUTE'
  )
    and pg_catalog.has_function_privilege(
      'authenticated', 'public.get_account_access_state()', 'EXECUTE'
    )
    and not pg_catalog.has_function_privilege(
      'authenticated',
      'public.begin_apple_auth_capture(uuid,uuid,uuid,text,text[],text[],text,text)',
      'EXECUTE'
    )
    and pg_catalog.has_function_privilege(
      'service_role',
      'public.begin_apple_auth_capture(uuid,uuid,uuid,text,text[],text[],text,text)',
      'EXECUTE'
    )
    and pg_catalog.has_function_privilege(
      'service_role',
      'public.apply_apple_auth_server_event(text,text,text[],text[],text,text,text,timestamptz,text)',
      'EXECUTE'
    )
    and pg_catalog.has_function_privilege(
      'service_role',
      'public.complete_apple_auth_validation(uuid,bigint,text,text,text,bytea,text)',
      'EXECUTE'
    )
    and not pg_catalog.has_function_privilege(
      'authenticated',
      'public.complete_apple_auth_validation(uuid,bigint,text,text,text,bytea,text)',
      'EXECUTE'
    )
    and pg_catalog.has_function_privilege(
      'service_role', 'public.get_apple_auth_deletion_vault(uuid,uuid)', 'EXECUTE'
    )
    and not pg_catalog.has_function_privilege(
      'authenticated', 'public.get_apple_auth_deletion_vault(uuid,uuid)', 'EXECUTE'
    )
    and not pg_catalog.has_function_privilege(
      'service_role', 'public._apple_auth_claim_digest(text)', 'EXECUTE'
    ),
  'only the narrow authenticated preflight and service lifecycle RPC lanes are executable'
);

select is(
  (
    select count(*)
      from unnest(array[
        'public.has_current_consent(text)',
        'public.owns_routine(uuid)',
        'public.owns_user_product(uuid)',
        'public.owns_cycle(uuid)',
        'public.owns_photo(uuid)',
        'public.owns_ask_turn_audit(uuid)',
        'public.owns_consent(uuid)'
      ]) as helpers(signature)
     where pg_catalog.has_function_privilege('authenticated', helpers.signature, 'EXECUTE')
       and not pg_catalog.has_function_privilege('anon', helpers.signature, 'EXECUTE')
       and not pg_catalog.has_function_privilege('service_role', helpers.signature, 'EXECUTE')
  ),
  7::bigint,
  'all seven boolean helper RPCs expose exactly the authenticated callable surface'
);

select is(
  (
    select count(*)
      from unnest(array[
        'public.has_current_consent(text)',
        'public.owns_routine(uuid)',
        'public.owns_user_product(uuid)',
        'public.owns_cycle(uuid)',
        'public.owns_photo(uuid)',
        'public.owns_ask_turn_audit(uuid)',
        'public.owns_consent(uuid)'
      ]) as helpers(signature)
     where pg_catalog.pg_get_functiondef(helpers.signature::regprocedure)
       like '%account_access_allowed()%'
  ),
  7::bigint,
  'every boolean helper branches through the exact-session account fence'
);

select ok(
  not exists (
    select 1
      from unnest(array['anon', 'authenticated', 'service_role']) as roles(role_name)
      cross join unnest(array[
        'public.consents_block_update()',
        'public._guard_revenuecat_entitlement_cursor_v0053()',
        'public._read_entitlement_projections_v0053_unfenced()'
      ]) as internals(signature)
     where pg_catalog.has_function_privilege(
       roles.role_name, internals.signature, 'EXECUTE'
     )
  ),
  'consent/entitlement trigger internals and the unfenced projection are non-callable'
);

select is(
  (
    select count(*)
      from pg_catalog.pg_policies
     where schemaname = 'public'
       and policyname = 'apple_auth_read_barrier'
       and permissive = 'RESTRICTIVE'
       and cmd = 'SELECT'
       and roles = array['authenticated']::name[]
       and qual like '%account_access_allowed%'
  ),
  28::bigint,
  'all 28 client-readable canonical owner tables have the restrictive Apple read barrier while sealed scan/correction relations remain policy-free'
);

select is(
  (
    select count(*)
      from pg_catalog.pg_policies
     where schemaname = 'storage'
       and tablename = 'objects'
       and policyname = 'apple_auth_read_barrier'
       and permissive = 'RESTRICTIVE'
       and cmd = 'SELECT'
       and roles = array['authenticated']::name[]
       and qual like '%account_access_allowed%'
       and qual like '%photos%'
  ),
  1::bigint,
  'private photo reads share the exact-session Apple account fence'
);

select ok(
  not exists (
    select 1
      from information_schema.columns
     where table_schema = 'public'
       and table_name in ('apple_auth_capture_operations', 'apple_auth_server_events')
       and column_name ~ '(authorization_code|identity_token|nonce|refresh_token|apple_subject$|email$|jti$|payload$)'
  ),
  'capture and event ledgers expose no raw Apple code, token, nonce, subject, email, jti, or payload column'
);

select is(
  (
    select data_type::text
      from information_schema.columns
     where table_schema = 'public'
       and table_name = 'apple_auth_lifecycles'
       and column_name = 'encrypted_refresh_token'
  ),
  'bytea'::text,
  'the retained Apple refresh credential is an opaque encrypted byte envelope'
);

set local role service_role;
select throws_ok(
  $$select count(*) from public.apple_auth_lifecycles$$,
  '42501',
  'permission denied for table apple_auth_lifecycles',
  'service_role cannot bypass the sealed lifecycle table through SQL'
);
reset role;

-- ---------------------------------------------------------------------------
-- Exact-session admission and fail-closed Apple bootstrap
-- ---------------------------------------------------------------------------

set local role authenticated;
select pg_catalog.set_config(
  'request.jwt.claims',
  '{"sub":"80000000-0000-4000-8000-000000000002","role":"authenticated","session_id":"81000000-0000-4000-8000-000000000002"}',
  true
);
select ok(
  public.account_access_allowed(),
  'a current non-Apple session remains admitted'
);
select is(
  (select state from public.get_account_access_state()),
  'not_applicable'::text,
  'the authenticated preflight distinguishes non-Apple accounts'
);
select is(
  (
    select count(*)
      from public.profiles
     where id = '80000000-0000-4000-8000-000000000002'
  ),
  1::bigint,
  'a current non-Apple owner can still read the account shell'
);

select pg_catalog.set_config(
  'request.jwt.claims',
  '{"sub":"80000000-0000-4000-8000-000000000002","role":"authenticated","session_id":"81000000-0000-4000-8000-000000000099"}',
  true
);
select ok(
  not public.account_access_allowed(),
  'a syntactically valid but nonexistent session is denied immediately'
);
select throws_ok(
  $$select * from public.get_account_access_state()$$,
  '28000',
  'ACCOUNT_ACCESS_SESSION_REJECTED',
  'preflight rejects a stale or forged session id'
);

-- A lifecycle must outlive the mutable Auth identity list. Reproduce an Apple
-- owner unlinking Apple, reaching a terminal lifecycle, and then acquiring a
-- new session through the retained alternate provider.
reset role;
insert into public.apple_auth_lifecycles (
  user_id, apple_subject_hmac, subject_hmac_key_version, client_id, state,
  encrypted_refresh_token, vault_key_version, last_validated_at, next_validation_at
) values (
  '80000000-0000-4000-8000-000000000010', repeat('f', 63) || 'e', 'unlink-v1',
  'com.layerwell.app', 'active', decode('01', 'hex'), 'vault-v1',
  clock_timestamp(), clock_timestamp() + interval '1 day'
);
delete from auth.identities
 where user_id = '80000000-0000-4000-8000-000000000010'
   and provider = 'apple';
update public.apple_auth_lifecycles
   set state = 'revoked', generation = generation + 1,
       encrypted_refresh_token = null, vault_key_version = null,
       next_validation_at = null, last_failure_code = 'APPLE_INVALID_GRANT'
 where user_id = '80000000-0000-4000-8000-000000000010';
delete from auth.sessions
 where id = '81000000-0000-4000-8000-000000000010';
insert into auth.sessions (id, user_id) values (
  '81000000-0000-4000-8000-000000000011',
  '80000000-0000-4000-8000-000000000010'
);
set local role authenticated;
select pg_catalog.set_config(
  'request.jwt.claims',
  '{"sub":"80000000-0000-4000-8000-000000000010","role":"authenticated","session_id":"81000000-0000-4000-8000-000000000011"}',
  true
);
select ok(
  not public.account_access_allowed(),
  'an unlinked terminal Apple lifecycle denies a new alternate-provider session'
);
select is(
  (select state || ':' || generation::text from public.get_account_access_state()),
  'blocked:2'::text,
  'preflight keeps the unlinked terminal lifecycle authoritative'
);
select is(
  (
    select count(*)
      from public.profiles
     where id = '80000000-0000-4000-8000-000000000010'
  ),
  0::bigint,
  'the restrictive read barrier hides an unlinked terminal Apple owner'
);

select pg_catalog.set_config(
  'request.jwt.claims',
  '{"sub":"80000000-0000-4000-8000-000000000001","role":"authenticated","session_id":"81000000-0000-4000-8000-000000000001"}',
  true
);
select ok(
  not public.account_access_allowed(),
  'an Apple identity without a completed server vault fails closed'
);
select ok(
  not public.has_current_consent('marketing'),
  'an unvaulted Apple session cannot probe an otherwise-current consent receipt'
);
select is(
  (select state from public.get_account_access_state()),
  'blocked'::text,
  'preflight reports an unvaulted Apple account as blocked'
);
select is(
  (
    select count(*)
      from public.profiles
     where id = '80000000-0000-4000-8000-000000000001'
  ),
  0::bigint,
  'the restrictive read barrier hides an unvaulted Apple account shell'
);
select is(
  public.pgtap_apple_profile_update('must-not-publish'),
  0::bigint,
  'the canonical write barrier rejects an unvaulted Apple account'
);
reset role;

set local role service_role;
select is(
  public.begin_apple_auth_capture(
    '82000000-0000-4000-8000-000000000007',
    '80000000-0000-4000-8000-000000000007',
    '81000000-0000-4000-8000-000000000007',
    'apple.subject.legacy', array[repeat('b', 64)], array['subject-v2'],
    repeat('7', 64), 'com.layerwell.app'
  ),
  'reserved'::text,
  'the pre-lifecycle owner can reserve a capture before terminal evidence wins the race'
);
select ok(
  public.mark_apple_auth_capture_exchange_started(
    '82000000-0000-4000-8000-000000000007',
    '80000000-0000-4000-8000-000000000007',
    '81000000-0000-4000-8000-000000000007'
  ),
  'the race fixture commits exchange_started before the terminal event arrives'
);
select is(
  public.begin_apple_auth_capture(
    '82000000-0000-4000-8000-000000000001',
    '80000000-0000-4000-8000-000000000001',
    '81000000-0000-4000-8000-000000000001',
    'apple.subject.capture', array[repeat('a', 64)], array['v1'], repeat('1', 64),
    'com.layerwell.app'
  ),
  'reserved'::text,
  'a verified identity and exact live session reserve one authorization-code digest'
);
select is(
  public.begin_apple_auth_capture(
    '82000000-0000-4000-8000-000000000001',
    '80000000-0000-4000-8000-000000000001',
    '81000000-0000-4000-8000-000000000001',
    'apple.subject.capture', array[repeat('a', 64)], array['v1'], repeat('1', 64),
    'com.layerwell.app'
  ),
  'reserved'::text,
  'an exact reservation replay is idempotent before exchange starts'
);
select throws_ok(
  $$select public.begin_apple_auth_capture(
    '82000000-0000-4000-8000-000000000002',
    '80000000-0000-4000-8000-000000000001',
    '81000000-0000-4000-8000-000000000001',
    'apple.subject.capture', array[repeat('a', 64)], array['v1'], repeat('1', 64),
    'com.layerwell.app'
  )$$,
  '23505',
  'APPLE_AUTH_CAPTURE_REPLAY_REJECTED',
  'one authorization-code digest cannot be reserved under another operation'
);
select throws_ok(
  $$select public.begin_apple_auth_capture(
    '82000000-0000-4000-8000-000000000002',
    '80000000-0000-4000-8000-000000000001',
    '81000000-0000-4000-8000-000000000001',
    'apple.subject.wrong', array[repeat('a', 64)], array['v1'], repeat('2', 64),
    'com.layerwell.app'
  )$$,
  '22023',
  'APPLE_AUTH_CAPTURE_REJECTED',
  'capture rejects a subject that does not match the Apple Auth identity'
);
select throws_ok(
  $$select public.begin_apple_auth_capture(
    '82000000-0000-4000-8000-000000000002',
    '80000000-0000-4000-8000-000000000001',
    '81000000-0000-4000-8000-000000000099',
    'apple.subject.capture', array[repeat('a', 64)], array['v1'], repeat('2', 64),
    'com.layerwell.app'
  )$$,
  '28000',
  'APPLE_AUTH_CAPTURE_SESSION_REJECTED',
  'capture rejects a stale session even when the identity is genuine'
);
select ok(
  public.mark_apple_auth_capture_exchange_started(
    '82000000-0000-4000-8000-000000000001',
    '80000000-0000-4000-8000-000000000001',
    '81000000-0000-4000-8000-000000000001'
  ),
  'the one-use code is durably marked before Apple exchange'
);
select ok(
  not public.mark_apple_auth_capture_exchange_started(
    '82000000-0000-4000-8000-000000000001',
    '80000000-0000-4000-8000-000000000001',
    '81000000-0000-4000-8000-000000000001'
  ),
  'a started code exchange cannot be marked for a second dispatch'
);
select is(
  (
    select result.state || ':' || result.generation::text
      from public.complete_apple_auth_capture(
        '82000000-0000-4000-8000-000000000001',
        '80000000-0000-4000-8000-000000000001',
        '81000000-0000-4000-8000-000000000001',
        decode('01020304', 'hex'), 'vault-v1'
      ) as result
  ),
  'active:1'::text,
  'successful exchange completion atomically activates generation one'
);
select throws_ok(
  $$select * from public.complete_apple_auth_capture(
    '82000000-0000-4000-8000-000000000001',
    '80000000-0000-4000-8000-000000000001',
    '81000000-0000-4000-8000-000000000001',
    decode('01020304', 'hex'), 'vault-v1'
  )$$,
  'P0001',
  'APPLE_AUTH_CAPTURE_STATE_REJECTED',
  'a succeeded capture cannot complete twice'
);
reset role;

select ok(
  exists (
    select 1
      from public.apple_auth_lifecycles
     where user_id = '80000000-0000-4000-8000-000000000001'
       and state = 'active'
       and generation = 1
       and encrypted_refresh_token = decode('01020304', 'hex')
       and vault_key_version = 'vault-v1'
       and last_validated_at > clock_timestamp() - interval '1 minute'
       and next_validation_at between
         last_validated_at + interval '24 hours'
         and last_validated_at + interval '26 hours 1 second'
  ),
  'the active vault persists only the encrypted envelope and bounded daily validation schedule'
);
select is(
  (
    select state
      from public.apple_auth_capture_operations
     where id = '82000000-0000-4000-8000-000000000001'
  ),
  'succeeded'::text,
  'the one-use capture ledger records terminal success'
);

set local role authenticated;
select pg_catalog.set_config(
  'request.jwt.claims',
  '{"sub":"80000000-0000-4000-8000-000000000001","role":"authenticated","session_id":"81000000-0000-4000-8000-000000000001"}',
  true
);
select ok(
  public.account_access_allowed(),
  'the same exact session is admitted after vault activation'
);
select ok(
  public.has_current_consent('marketing'),
  'the fenced consent helper preserves its existing result for an admitted session'
);
select is(
  (select state || ':' || generation::text from public.get_account_access_state()),
  'active:1'::text,
  'preflight returns active lifecycle generation one'
);
select is(
  public.pgtap_apple_profile_update('vault-active'),
  1::bigint,
  'the canonical write lane opens only after vault activation'
);
reset role;

delete from auth.sessions where id = '81000000-0000-4000-8000-000000000001';
set local role authenticated;
select ok(
  not public.account_access_allowed(),
  'deleting the exact server session immediately closes an already-issued JWT'
);
select is(
  (
    select count(*)
      from public.profiles
     where id = '80000000-0000-4000-8000-000000000001'
  ),
  0::bigint,
  'a stale JWT cannot read canonical owner data after server session deletion'
);
select is(
  (
    select count(*)
      from (values
        (public.has_current_consent('marketing')),
        (public.owns_routine('83000000-0000-4000-8000-000000000001')),
        (public.owns_user_product('83000000-0000-4000-8000-000000000002')),
        (public.owns_cycle('83000000-0000-4000-8000-000000000003')),
        (public.owns_photo('83000000-0000-4000-8000-000000000004')),
        (public.owns_ask_turn_audit('83000000-0000-4000-8000-000000000005')),
        (public.owns_consent('83000000-0000-4000-8000-000000000006'))
      ) as helper_results(is_owned)
     where helper_results.is_owned
  ),
  0::bigint,
  'all seven boolean helper RPCs return false for a deleted-session Apple JWT'
);
select throws_ok(
  $$select * from public.get_account_access_state()$$,
  '28000',
  'ACCOUNT_ACCESS_SESSION_REJECTED',
  'preflight fails closed after exact-session deletion'
);
select throws_ok(
  $$select public.read_entitlement_projections()$$,
  '28000',
  'ACCOUNT_ACCESS_DENIED',
  'the entitlement projection rejects a deleted-session Apple JWT'
);
select throws_ok(
  $$select * from public.get_health_data_consent_status()$$,
  '28000',
  'HEALTH_CONSENT_SESSION_REJECTED',
  'the base health status RPC rejects a deleted-session Apple JWT'
);
select throws_ok(
  $$select * from public.get_health_dependent_consent_status('photo_capture')$$,
  '28000',
  'HEALTH_CONSENT_SESSION_REJECTED',
  'the dependent health status RPC rejects a deleted-session Apple JWT'
);
reset role;
insert into auth.sessions (id, user_id) values (
  '81000000-0000-4000-8000-000000000001',
  '80000000-0000-4000-8000-000000000001'
);

-- ---------------------------------------------------------------------------
-- Worker claims, ambiguous retry, and the 72-hour hard ceiling
-- ---------------------------------------------------------------------------

insert into public.apple_auth_lifecycles (
  user_id, apple_subject_hmac, subject_hmac_key_version, client_id, state,
  generation, encrypted_refresh_token, vault_key_version, last_validated_at,
  next_validation_at
) values (
  '80000000-0000-4000-8000-000000000003', repeat('c', 64), 'v1',
  'com.layerwell.app', 'active', 4, decode('0304', 'hex'), 'vault-v1',
  clock_timestamp() - interval '1 hour', clock_timestamp() - interval '1 minute'
);

set local role service_role;
select is(
  (
    select count(*)
      from public.claim_due_apple_auth_validations(repeat('b', 64), 10)
     where user_id = '80000000-0000-4000-8000-000000000003'
       and generation = 4
       and encrypted_refresh_token = decode('0304', 'hex')
  ),
  1::bigint,
  'the worker claims a due encrypted vault through the narrow RPC'
);
select is(
  (select count(*) from public.claim_due_apple_auth_validations(repeat('8', 64), 10)),
  0::bigint,
  'an active validation lease prevents a concurrent second claim'
);
select ok(
  not public.complete_apple_auth_validation(
    '80000000-0000-4000-8000-000000000003', 4, repeat('9', 64),
    repeat('4', 64), 'subject-v2', decode('0405', 'hex'), 'vault-v2'
  ),
  'a worker cannot rotate a vault under another claim capability'
);
select ok(
  public.complete_apple_auth_validation(
    '80000000-0000-4000-8000-000000000003', 4, repeat('b', 64),
    repeat('3', 64), 'subject-v2', decode('0506', 'hex'), 'vault-v2'
  ),
  'the exact worker claim capability atomically rotates and completes validation'
);
reset role;

select ok(
  exists (
    select 1
      from public.apple_auth_lifecycles
     where user_id = '80000000-0000-4000-8000-000000000003'
       and state = 'active'
       and validation_claim_digest is null
       and validation_lease_expires_at is null
       and validation_attempt_count = 0
       and last_failure_code is null
       and apple_subject_hmac = repeat('3', 64)
       and subject_hmac_key_version = 'subject-v2'
       and encrypted_refresh_token = decode('0506', 'hex')
       and vault_key_version = 'vault-v2'
       and next_validation_at > clock_timestamp() + interval '23 hours 59 minutes'
  ),
  'successful validation atomically stores the rotated vault and schedules the next daily check'
);

update public.apple_auth_lifecycles
   set next_validation_at = clock_timestamp() - interval '1 minute'
 where user_id = '80000000-0000-4000-8000-000000000003';
set local role service_role;
select is(
  (select count(*) from public.claim_due_apple_auth_validations(repeat('b', 64), 1)),
  1::bigint,
  'the same deterministic capability can claim a later due lease'
);
select throws_ok(
  $$select public.defer_apple_auth_validation(
    '80000000-0000-4000-8000-000000000003', 4, repeat('b', 64),
    'APPLE_NETWORK_FAILED', 60
  )$$,
  '22023',
  'APPLE_AUTH_VALIDATION_DEFER_REJECTED',
  'ambiguous validation cannot be retried more aggressively than one day'
);
select is(
  public.defer_apple_auth_validation(
    '80000000-0000-4000-8000-000000000003', 4, repeat('b', 64),
    'APPLE_NETWORK_FAILED', 86400
  ),
  'deferred'::text,
  'an ambiguous provider failure defers the vault for a full day'
);
reset role;

select ok(
  exists (
    select 1
      from public.apple_auth_lifecycles
     where user_id = '80000000-0000-4000-8000-000000000003'
       and state = 'active'
       and validation_claim_digest is null
       and validation_lease_expires_at is null
       and last_failure_code = 'APPLE_NETWORK_FAILED'
       and next_validation_at > clock_timestamp() + interval '23 hours 59 minutes'
  ),
  'a deferred validation remains active but is not immediately reclaimable'
);

update public.apple_auth_lifecycles
   set last_validated_at = clock_timestamp() - interval '73 hours',
       next_validation_at = clock_timestamp() - interval '1 minute'
 where user_id = '80000000-0000-4000-8000-000000000003';
set local role service_role;
select is(
  (select count(*) from public.claim_due_apple_auth_validations(repeat('8', 64), 1)),
  1::bigint,
  'the worker claims a vault that has crossed the hard validation ceiling'
);
select is(
  public.defer_apple_auth_validation(
    '80000000-0000-4000-8000-000000000003', 4, repeat('8', 64),
    'APPLE_NETWORK_FAILED', 86400
  ),
  'blocked'::text,
  'an ambiguous result after 72 hours blocks the lifecycle instead of extending trust'
);
reset role;

select ok(
  exists (
    select 1
      from public.apple_auth_lifecycles
     where user_id = '80000000-0000-4000-8000-000000000003'
       and state = 'action_required'
       and generation = 5
       and encrypted_refresh_token is null
       and vault_key_version is null
       and next_validation_at is null
       and last_failure_code = 'APPLE_VALIDATION_STALE'
  ),
  'the hard ceiling destroys the vault and increments the lifecycle generation'
);
select is(
  (
    select count(*) from auth.sessions
     where user_id = '80000000-0000-4000-8000-000000000003'
  ),
  0::bigint,
  'hard-ceiling failure removes every Supabase session for the owner'
);

-- ---------------------------------------------------------------------------
-- Signed event replay, ordering, rotation candidates, and terminal fencing
-- ---------------------------------------------------------------------------

set local role service_role;
select throws_ok(
  $$select * from public.apply_apple_auth_server_event(
    repeat('5', 64), repeat('5', 64),
    array[repeat('a', 64), repeat('3', 64)], array['v1', 'subject-v2'],
    null, 'com.layerwell.app',
    'email-disabled', clock_timestamp(), null
  )$$,
  'P0001',
  'APPLE_AUTH_EVENT_SUBJECT_AMBIGUOUS',
  'rotation candidates that match multiple owners are rejected as ambiguous'
);
select throws_ok(
  $$select * from public.apply_apple_auth_server_event(
    repeat('5', 64), repeat('6', 64),
    array[repeat('a', 64), repeat('3', 64)], array['v1'],
    null, 'com.layerwell.app',
    'email-disabled', clock_timestamp(), null
  )$$,
  '22023',
  'APPLE_AUTH_EVENT_REJECTED',
  'subject aliases and key-version candidates must have exact matching cardinality'
);
select is(
  (
    select result_code
      from public.apply_apple_auth_server_event(
        repeat('1', 64), repeat('a', 64), array[repeat('a', 64)], array['v1'],
        null, 'com.layerwell.app',
        'email-disabled', '2026-07-15 12:00:00+00', repeat('7', 64)
      )
  ),
  'applied'::text,
  'a verified newer email-disabled event updates the relay state'
);
select is(
  (
    select result_code
      from public.apply_apple_auth_server_event(
        repeat('1', 64), repeat('a', 64), array[repeat('a', 64)], array['v1'],
        null, 'com.layerwell.app',
        'email-disabled', '2026-07-15 12:00:00+00', repeat('7', 64)
      )
  ),
  'duplicate'::text,
  'an exact signed event replay is idempotently deduplicated'
);
select is(
  (
    select result_code
      from public.apply_apple_auth_server_event(
        repeat('2', 64), repeat('b', 64), array[repeat('a', 64)], array['v1'],
        null, 'com.layerwell.app',
        'email-enabled', '2026-07-15 11:59:59+00', repeat('6', 64)
      )
  ),
  'stale'::text,
  'an older relay-email event cannot overwrite newer provider state'
);
select is(
  (
    select result_code
      from public.apply_apple_auth_server_event(
        repeat('3', 64), repeat('c', 64), array[repeat('a', 64)], array['v1'],
        null, 'com.layerwell.app',
        'unknown', '2026-07-15 12:01:00+00', null
      )
  ),
  'ignored_unknown'::text,
  'a validly signed unknown flat event is quarantined without lifecycle mutation'
);
select is(
  (
    select result_code
      from public.apply_apple_auth_server_event(
        repeat('a', 63) || '1', repeat('b', 63) || '1',
        array[repeat('1', 64)], array['v0'], null, 'com.layerwell.app',
        'unknown', '2026-07-15 12:01:30+00', null
      )
  ),
  'ignored_unknown'::text,
  'a signed unknown event without an owner is quarantined rather than misclassified'
);
reset role;
select ok(
  exists (
    select 1 from public.apple_auth_server_events
     where jti_hmac = repeat('a', 63) || '1'
       and user_id is null
       and event_type = 'unknown'
       and result_code = 'ignored_unknown'
  ),
  'ownerless unknown-event evidence remains a keyed non-activating ledger row'
);
set local role service_role;
select is(
  (
    select result_code
      from public.apply_apple_auth_server_event(
        repeat('4', 64), repeat('d', 64), array[repeat('e', 64)], array['v0'],
        null, 'com.layerwell.app',
        'email-disabled', '2026-07-15 12:02:00+00', repeat('5', 64)
      )
  ),
  'unknown_subject'::text,
  'a valid event for an unknown keyed subject is recorded without owner disclosure'
);
reset role;

select ok(
  exists (
    select 1
      from public.apple_auth_lifecycles
     where user_id = '80000000-0000-4000-8000-000000000001'
       and relay_email_state = 'disabled'
       and relay_email_hmac = repeat('7', 64)
       and state = 'active'
       and generation = 1
  ),
  'event ordering preserves the newest relay state without changing access generation'
);
select is(
  (
    select count(*)
      from public.apple_auth_server_events
     where jti_hmac = repeat('1', 64)
       and payload_hmac = repeat('a', 64)
  ),
  1::bigint,
  'event replay creates exactly one sealed ledger row'
);
select ok(
  exists (
    select 1
      from public.apple_auth_server_events
     where jti_hmac = repeat('4', 64)
       and apple_subject_hmac = repeat('e', 64)
       and user_id is null
       and result_code = 'unknown_subject'
  ),
  'unknown-subject evidence stores only keyed aliases and no owner mapping'
);

set local role service_role;
select throws_ok(
  $$select * from public.get_apple_auth_deletion_vault(
    '80000000-0000-4000-8000-000000000001',
    '81000000-0000-4000-8000-000000000099'
  )$$,
  '28000',
  'ACCOUNT_DELETION_SESSION_REJECTED',
  'deletion vault handoff rejects a stale or foreign session id'
);
select is(
  (
    select apple_subject_hmac || ':' || client_id || ':'
      || encode(encrypted_refresh_token, 'hex') || ':' || vault_key_version
      || ':' || generation::text
      from public.get_apple_auth_deletion_vault(
        '80000000-0000-4000-8000-000000000001',
        '81000000-0000-4000-8000-000000000001'
      )
  ),
  repeat('a', 64) || ':com.layerwell.app:01020304:vault-v1:1',
  'the exact live session can hand the encrypted vault to deletion intake'
);
select is(
  (
    select operation_state || ':' || created::text
      from public.begin_account_deletion(
        '80000000-0000-4000-8000-000000000001',
        '81000000-0000-4000-8000-000000000001',
        repeat('8', 64), repeat('9', 64),
        clock_timestamp() + interval '29 days',
        decode('aa55', 'hex'), null, null
      )
  ),
  'pending:true'::text,
  'durable deletion intake commits before retiring the reusable Apple vault'
);
select is(
  (
    select count(*)
      from public.get_apple_auth_deletion_vault(
        '80000000-0000-4000-8000-000000000001',
        '81000000-0000-4000-8000-000000000001'
      )
  ),
  0::bigint,
  'the session-bound vault handoff is empty after durable deletion intake'
);
reset role;

select ok(
  exists (
    select 1
      from public.apple_auth_lifecycles
     where user_id = '80000000-0000-4000-8000-000000000001'
       and state = 'action_required'
       and generation = 2
       and encrypted_refresh_token is null
       and vault_key_version is null
       and last_failure_code = 'APPLE_ACCOUNT_DELETION_STARTED'
  ),
  'deletion intake atomically retires the active Apple credential authority'
);
select ok(
  (select count(*) from public.account_deletion_operations
    where user_id = '80000000-0000-4000-8000-000000000001') = 1
    and (select count(*) from public.account_deletion_barriers
      where user_id = '80000000-0000-4000-8000-000000000001') = 1
    and (
      select count(*) from public.account_deletion_steps as steps
      join public.account_deletion_operations as operations
        on operations.id = steps.operation_id
      where operations.user_id = '80000000-0000-4000-8000-000000000001'
    ) = 6
    and exists (
      select 1
        from public.account_deletion_steps as steps
        join public.account_deletion_operations as operations
          on operations.id = steps.operation_id
       where operations.user_id = '80000000-0000-4000-8000-000000000001'
         and steps.step_name = 'apple_revoke'
         and steps.status = 'pending'
         and steps.encrypted_payload = decode('aa55', 'hex')
    ),
  'deletion intake persists one barrier and the complete six-step encrypted work graph'
);

set local role service_role;
select is(
  (
    select result_code
      from public.apply_apple_auth_server_event(
        repeat('6', 64), repeat('e', 64), array[repeat('a', 64)], array['v1'],
        'apple.subject.capture', 'com.layerwell.app',
        'account-deleted', '2026-07-15 12:03:00+00', null
      )
  ),
  'applied'::text,
  'a verified account-deleted event terminally fences the Apple lifecycle'
);
reset role;

select ok(
  exists (
    select 1
      from public.apple_auth_lifecycles
     where user_id = '80000000-0000-4000-8000-000000000001'
       and state = 'account_deleted'
       and generation = 3
       and encrypted_refresh_token is null
       and vault_key_version is null
       and next_validation_at is null
       and last_failure_code = 'APPLE_EVENT_ACCOUNT_DELETED'
  ),
  'account deletion preserves the retired vault and advances the generation exactly once more'
);
select is(
  (
    select count(*) from auth.sessions
     where user_id = '80000000-0000-4000-8000-000000000001'
  ),
  0::bigint,
  'account-deleted notification invalidates every Supabase session'
);
select ok(
  (select count(*) from public.account_deletion_operations
    where user_id = '80000000-0000-4000-8000-000000000001') = 1
    and (select count(*) from public.account_deletion_barriers
      where user_id = '80000000-0000-4000-8000-000000000001') = 1
    and exists (
      select 1
        from public.account_deletion_steps as steps
        join public.account_deletion_operations as operations
          on operations.id = steps.operation_id
       where operations.user_id = '80000000-0000-4000-8000-000000000001'
         and steps.step_name = 'apple_revoke'
         and steps.status = 'succeeded'
         and steps.result_code = 'APPLE_AUTHORIZATION_TERMINATED'
         and steps.encrypted_payload is null
    ),
  'terminal Apple events reuse an existing durable deletion operation and attest the Apple step'
);

insert into public.apple_auth_lifecycles (
  user_id, apple_subject_hmac, subject_hmac_key_version, client_id, state,
  generation, encrypted_refresh_token, vault_key_version, last_validated_at,
  next_validation_at
) values (
  '80000000-0000-4000-8000-000000000006', repeat('f', 64), 'v1',
  'com.layerwell.app', 'active', 2, decode('0607', 'hex'), 'vault-v1',
  clock_timestamp(), clock_timestamp() + interval '24 hours'
);
set local role service_role;
select is(
  (
    select result_code
      from public.apply_apple_auth_server_event(
        repeat('7', 64), repeat('f', 64), array[repeat('f', 64)], array['v1'],
        'apple.subject.consent', 'com.layerwell.app',
        'consent-revoked', '2026-07-15 12:04:00+00', null
      )
  ),
  'applied'::text,
  'a verified consent-revoked event terminally revokes Apple access'
);
reset role;
select ok(
  exists (
    select 1
      from public.apple_auth_lifecycles
     where user_id = '80000000-0000-4000-8000-000000000006'
       and state = 'revoked'
       and generation = 3
       and encrypted_refresh_token is null
       and last_failure_code = 'APPLE_EVENT_CONSENT_REVOKED'
  )
    and not exists (
      select 1 from auth.sessions
       where user_id = '80000000-0000-4000-8000-000000000006'
    ),
  'consent revocation destroys the vault and all owner sessions'
);
select ok(
  (select count(*) from public.account_deletion_operations
    where user_id = '80000000-0000-4000-8000-000000000006') = 1
    and (select count(*) from public.account_deletion_barriers
      where user_id = '80000000-0000-4000-8000-000000000006') = 1
    and (
      select count(*) from public.account_deletion_steps as steps
      join public.account_deletion_operations as operations
        on operations.id = steps.operation_id
      where operations.user_id = '80000000-0000-4000-8000-000000000006'
    ) = 6
    and exists (
      select 1
        from public.account_deletion_steps as steps
        join public.account_deletion_operations as operations
          on operations.id = steps.operation_id
       where operations.user_id = '80000000-0000-4000-8000-000000000006'
         and steps.step_name = 'apple_revoke'
         and steps.status = 'succeeded'
         and steps.result_code = 'APPLE_AUTHORIZATION_TERMINATED'
         and steps.encrypted_payload is null
    ),
  'a terminal Apple event creates one complete durable deletion graph when none exists'
);

set local role service_role;
select is(
  (
    select result_code
      from public.apply_apple_auth_server_event(
        repeat('8', 64), repeat('8', 64), array[repeat('b', 64)], array['subject-v2'],
        'apple.subject.legacy', 'com.layerwell.app',
        'account-deleted', '2026-07-15 12:05:00+00', null
      )
  ),
  'applied'::text,
  'a terminal event resolves an existing Apple identity before its first lifecycle capture'
);
reset role;
select ok(
  exists (
    select 1
      from public.apple_auth_lifecycles
     where user_id = '80000000-0000-4000-8000-000000000007'
       and apple_subject_hmac = repeat('b', 64)
       and subject_hmac_key_version = 'subject-v2'
       and client_id = 'com.layerwell.app'
       and state = 'account_deleted'
       and generation = 1
       and encrypted_refresh_token is null
       and vault_key_version is null
       and next_validation_at is null
       and last_failure_code = 'APPLE_EVENT_ACCOUNT_DELETED'
  ),
  'the race bridge creates only a terminal keyed lifecycle with no reusable credential'
);
select ok(
  not exists (
    select 1 from auth.sessions
     where user_id = '80000000-0000-4000-8000-000000000007'
  )
    and (select count(*) from public.account_deletion_operations
      where user_id = '80000000-0000-4000-8000-000000000007') = 1
    and (select count(*) from public.account_deletion_barriers
      where user_id = '80000000-0000-4000-8000-000000000007') = 1
    and (
      select count(*) from public.account_deletion_steps as steps
      join public.account_deletion_operations as operations
        on operations.id = steps.operation_id
      where operations.user_id = '80000000-0000-4000-8000-000000000007'
    ) = 6
    and exists (
      select 1
        from public.account_deletion_steps as steps
        join public.account_deletion_operations as operations
          on operations.id = steps.operation_id
       where operations.user_id = '80000000-0000-4000-8000-000000000007'
         and steps.step_name = 'apple_revoke'
         and steps.status = 'succeeded'
         and steps.result_code = 'APPLE_AUTHORIZATION_TERMINATED'
    ),
  'the pre-capture terminal event destroys sessions and queues the complete deletion graph'
);
select ok(
  exists (
    select 1
      from public.apple_auth_server_events as events
     where events.jti_hmac = repeat('8', 64)
       and events.user_id = '80000000-0000-4000-8000-000000000007'
       and events.result_code = 'applied'
       and pg_catalog.strpos(pg_catalog.to_jsonb(events)::text, 'apple.subject.legacy') = 0
  ),
  'the terminal-event ledger maps the owner without persisting the raw Apple subject'
);
set local role service_role;
select throws_ok(
  $$select * from public.complete_apple_auth_capture(
    '82000000-0000-4000-8000-000000000007',
    '80000000-0000-4000-8000-000000000007',
    '81000000-0000-4000-8000-000000000007',
    decode('0708', 'hex'), 'vault-v2'
  )$$,
  '28000',
  'APPLE_AUTH_CAPTURE_SESSION_REJECTED',
  'the deletion barrier prevents a losing capture completion from reactivating the account'
);
select is(
  (
    select result_code
      from public.apply_apple_auth_server_event(
        repeat('9', 64), repeat('9', 64), array[repeat('c', 64)], array['subject-v2'],
        'apple.subject.late', 'com.layerwell.app',
        'consent-revoked', '2026-07-15 12:06:00+00', null
      )
  ),
  'unknown_subject'::text,
  'a terminal event remains privacy-preserving when no Apple identity exists yet'
);
reset role;

insert into auth.identities (provider_id, user_id, identity_data, provider) values (
  'apple.subject.late', '80000000-0000-4000-8000-000000000008',
  '{"sub":"apple.subject.late"}'::jsonb, 'apple'
);
set local role service_role;
select is(
  public.begin_apple_auth_capture(
    '82000000-0000-4000-8000-000000000008',
    '80000000-0000-4000-8000-000000000008',
    '81000000-0000-4000-8000-000000000008',
    'apple.subject.late', array[repeat('c', 64)], array['subject-v2'],
    repeat('6', 64), 'com.layerwell.app'
  ),
  'blocked'::text,
  'first capture reconciles pre-identity terminal evidence without dispatching the one-use code'
);
select is(
  (
    select result_code
      from public.apply_apple_auth_server_event(
        repeat('9', 64), repeat('9', 64), array[repeat('c', 64)], array['subject-v2'],
        'apple.subject.late', 'com.layerwell.app',
        'consent-revoked', '2026-07-15 12:06:00+00', null
      )
  ),
  'duplicate'::text,
  'a later exact Apple duplicate is idempotent after capture-time reconciliation'
);
reset role;
select ok(
  exists (
    select 1 from public.apple_auth_lifecycles
     where user_id = '80000000-0000-4000-8000-000000000008'
       and state = 'revoked'
       and generation = 1
       and encrypted_refresh_token is null
  )
    and exists (
      select 1 from public.apple_auth_server_events
       where jti_hmac = repeat('9', 64)
         and user_id = '80000000-0000-4000-8000-000000000008'
         and result_code = 'applied'
    )
    and not exists (
      select 1 from auth.sessions
       where user_id = '80000000-0000-4000-8000-000000000008'
    )
    and (select count(*) from public.account_deletion_steps as steps
      join public.account_deletion_operations as operations
        on operations.id = steps.operation_id
      where operations.user_id = '80000000-0000-4000-8000-000000000008') = 6
    and (select count(*) from public.apple_auth_server_events
      where jti_hmac = repeat('9', 64)) = 1
    and (select count(*) from public.apple_auth_capture_operations
      where user_id = '80000000-0000-4000-8000-000000000008') = 0,
  'reconciliation maps one ledger row, fences access, and queues one durable deletion graph'
);

set local role service_role;
select is(
  (
    select result_code
      from public.apply_apple_auth_server_event(
        repeat('0', 64), repeat('0', 64), array[repeat('0', 64)], array['subject-v2'],
        'apple.subject.replay', 'com.layerwell.app',
        'account-deleted', '2026-07-15 12:07:00+00', null
      )
  ),
  'unknown_subject'::text,
  'pre-identity terminal evidence is initially recorded only as keyed unknown metadata'
);
reset role;
insert into auth.identities (provider_id, user_id, identity_data, provider) values (
  'apple.subject.replay', '80000000-0000-4000-8000-000000000009',
  '{"sub":"apple.subject.replay"}'::jsonb, 'apple'
);
set local role service_role;
select is(
  (
    select result_code
      from public.apply_apple_auth_server_event(
        repeat('0', 64), repeat('0', 64), array[repeat('0', 64)], array['subject-v2'],
        'apple.subject.replay', 'com.layerwell.app',
        'account-deleted', '2026-07-15 12:07:00+00', null
      )
  ),
  'applied'::text,
  'an exact signed duplicate opportunistically promotes unknown evidence after identity commit'
);
select is(
  (
    select result_code
      from public.apply_apple_auth_server_event(
        repeat('0', 64), repeat('0', 64), array[repeat('0', 64)], array['subject-v2'],
        'apple.subject.replay', 'com.layerwell.app',
        'account-deleted', '2026-07-15 12:07:00+00', null
      )
  ),
  'duplicate'::text,
  'a third exact delivery is idempotent after opportunistic promotion'
);
reset role;
select ok(
  exists (
    select 1 from public.apple_auth_lifecycles
     where user_id = '80000000-0000-4000-8000-000000000009'
       and state = 'account_deleted'
       and generation = 1
       and encrypted_refresh_token is null
  )
    and not exists (
      select 1 from auth.sessions
       where user_id = '80000000-0000-4000-8000-000000000009'
    )
    and (select count(*) from public.apple_auth_server_events
      where jti_hmac = repeat('0', 64)
        and user_id = '80000000-0000-4000-8000-000000000009'
        and result_code = 'applied') = 1
    and (select count(*) from public.account_deletion_operations
      where user_id = '80000000-0000-4000-8000-000000000009') = 1
    and (select count(*) from public.account_deletion_steps as steps
      join public.account_deletion_operations as operations
        on operations.id = steps.operation_id
      where operations.user_id = '80000000-0000-4000-8000-000000000009') = 6,
  'opportunistic promotion creates one terminal lifecycle and one deletion graph'
);

-- ---------------------------------------------------------------------------
-- Native credential invalidation, failed capture, finite purge, and regression
-- ---------------------------------------------------------------------------

insert into public.apple_auth_lifecycles (
  user_id, apple_subject_hmac, subject_hmac_key_version, client_id, state,
  generation, encrypted_refresh_token, vault_key_version, last_validated_at,
  next_validation_at
) values (
  '80000000-0000-4000-8000-000000000004', repeat('d', 64), 'v1',
  'com.layerwell.app', 'active', 1, decode('0405', 'hex'), 'vault-v1',
  clock_timestamp(), clock_timestamp() + interval '24 hours'
);
set local role service_role;
select ok(
  not public.invalidate_apple_auth_for_session(
    '80000000-0000-4000-8000-000000000004',
    '81000000-0000-4000-8000-000000000004',
    'apple.subject.wrong', 'APPLE_NATIVE_CREDENTIAL_INVALID'
  ),
  'native invalidation rejects a mismatched Apple subject'
);
select ok(
  not public.invalidate_apple_auth_for_session(
    '80000000-0000-4000-8000-000000000004',
    '81000000-0000-4000-8000-000000000099',
    'apple.subject.native', 'APPLE_NATIVE_CREDENTIAL_INVALID'
  ),
  'native invalidation rejects a stale session'
);
select ok(
  public.invalidate_apple_auth_for_session(
    '80000000-0000-4000-8000-000000000004',
    '81000000-0000-4000-8000-000000000004',
    'apple.subject.native', 'APPLE_NATIVE_CREDENTIAL_TRANSFERRED'
  ),
  'exact native TRANSFERRED evidence blocks the lifecycle and sessions'
);
reset role;
select ok(
  exists (
    select 1
      from public.apple_auth_lifecycles
     where user_id = '80000000-0000-4000-8000-000000000004'
       and state = 'action_required'
       and generation = 2
       and encrypted_refresh_token is null
       and last_failure_code = 'APPLE_NATIVE_CREDENTIAL_TRANSFERRED'
  )
    and not exists (
      select 1 from auth.sessions
       where user_id = '80000000-0000-4000-8000-000000000004'
    ),
  'native transfer destroys the vault and invalidates every owner session'
);

set local role service_role;
select is(
  public.begin_apple_auth_capture(
    '82000000-0000-4000-8000-000000000005',
    '80000000-0000-4000-8000-000000000005',
    '81000000-0000-4000-8000-000000000005',
    'apple.subject.failure', array[repeat('5', 64)], array['v1'], repeat('2', 64),
    'com.layerwell.app'
  ),
  'reserved'::text,
  'a second Apple owner can reserve an independent code digest'
);
select ok(
  public.fail_apple_auth_capture(
    '82000000-0000-4000-8000-000000000005',
    '80000000-0000-4000-8000-000000000005',
    'APPLE_NETWORK_FAILED'
  ),
  'a failed exchange records a bounded terminal failure code'
);
select ok(
  not public.fail_apple_auth_capture(
    '82000000-0000-4000-8000-000000000005',
    '80000000-0000-4000-8000-000000000005',
    'APPLE_NETWORK_FAILED'
  ),
  'a terminally failed capture cannot be failed twice'
);
select throws_ok(
  $$select public.purge_expired_apple_auth_artifacts(0)$$,
  '22023',
  'APPLE_AUTH_PURGE_LIMIT_REJECTED',
  'the purge worker rejects an unbounded or empty budget'
);
reset role;

update public.apple_auth_capture_operations
   set completed_at = clock_timestamp() - interval '25 hours'
 where id = '82000000-0000-4000-8000-000000000005';
set local role service_role;
select is(
  public.purge_expired_apple_auth_artifacts(10),
  1,
  'finite purge removes a terminal capture artifact after its 24-hour retention'
);
reset role;
select is(
  (
    select count(*) from public.apple_auth_capture_operations
     where id = '82000000-0000-4000-8000-000000000005'
  ),
  0::bigint,
  'purged authorization-code metadata is absent from the sealed ledger'
);

-- Regression: the RPC result must describe lifecycle mutation, not whether its
-- subsequent session cleanup happened to delete a row. User 5 has a valid
-- Apple identity and session but intentionally has no lifecycle row.
set local role service_role;
select ok(
  not public.invalidate_apple_auth_for_session(
    '80000000-0000-4000-8000-000000000005',
    '81000000-0000-4000-8000-000000000005',
    'apple.subject.failure', 'APPLE_NATIVE_CREDENTIAL_INVALID'
  ),
  'native invalidation reports false when no lifecycle row was mutated'
);
reset role;

select * from finish();
rollback;
