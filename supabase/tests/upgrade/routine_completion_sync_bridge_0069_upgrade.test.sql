\set ON_ERROR_STOP on

-- Forward-only 0068 -> 0069 rehearsal. The local gate withholds 0069, resets
-- through the real 0068 history, seeds production-shaped legacy Shelf/routine
-- rows, and replaces the marker below with the exact checked-in 0069 bytes.
set client_min_messages = warning;
set search_path = extensions, public, pg_catalog;

set session_replication_role = replica;
insert into auth.users (id)
values
  ('69400000-0000-4000-8000-000000000001'),
  ('69400000-0000-4000-8000-000000000002');

insert into public.user_products (
  id,
  user_id,
  manual_name,
  is_opened,
  pao_source,
  expiry_source,
  added_via
)
values
  (
    '69410000-0000-4000-8000-000000000001',
    '69400000-0000-4000-8000-000000000001',
    '0069 legacy owner product',
    false,
    'unknown',
    'unknown',
    'manual'
  ),
  (
    '69410000-0000-4000-8000-000000000002',
    '69400000-0000-4000-8000-000000000002',
    '0069 legacy other product',
    false,
    'unknown',
    'unknown',
    'manual'
  );

insert into public.routines (id, user_id, type, name)
values (
  '69420000-0000-4000-8000-000000000001',
  '69400000-0000-4000-8000-000000000001',
  'PM',
  '0069 legacy routine'
);
insert into public.routine_steps (
  id, routine_id, user_product_id, step_order
)
values (
  '69430000-0000-4000-8000-000000000001',
  '69420000-0000-4000-8000-000000000001',
  '69410000-0000-4000-8000-000000000001',
  1
);
insert into public.routine_completions (
  id, user_id, routine_id, step_id, completed_at, completed_date
)
values (
  '69440000-0000-4000-8000-000000000001',
  '69400000-0000-4000-8000-000000000001',
  '69420000-0000-4000-8000-000000000001',
  '69430000-0000-4000-8000-000000000001',
  pg_catalog.statement_timestamp() - interval '1 hour',
  (pg_catalog.statement_timestamp() at time zone 'UTC')::date
);
set session_replication_role = origin;

do $$
begin
  if (
    select count(*)
      from public.user_products
     where user_id in (
       '69400000-0000-4000-8000-000000000001',
       '69400000-0000-4000-8000-000000000002'
     )
  ) <> 2
  or not exists (
    select 1
      from public.routine_steps
     where id = '69430000-0000-4000-8000-000000000001'
       and user_product_id = '69410000-0000-4000-8000-000000000001'
  ) then
    raise exception 'CORE05_0069_LEGACY_FIXTURE_INVALID';
  end if;
end;
$$;

-- @@INCLUDE_EXACT_0069_MIGRATION@@

set search_path = extensions, public, pg_catalog;
select plan(16);

select is(
  (select count(*) from public.shelf_product_identities),
  2::bigint,
  '0069 backfills one minimal stable identity per legacy Shelf row'
);
select results_eq(
  $$select id, user_id, deleted_effective_at, deleted_received_at
      from public.shelf_product_identities
     where id = '69410000-0000-4000-8000-000000000001'$$,
  $$values (
      '69410000-0000-4000-8000-000000000001'::uuid,
      '69400000-0000-4000-8000-000000000001'::uuid,
      null::timestamptz,
      null::timestamptz
    )$$,
  'the backfill retains identity and owner without inventing a tombstone'
);
select is(
  (
    select steps.user_product_id
      from public.routine_steps as steps
     where steps.id = '69430000-0000-4000-8000-000000000001'
  ),
  '69410000-0000-4000-8000-000000000001'::uuid,
  'the cutover preserves a legacy routine-step product identity'
);
select is(
  (
    select count(*)
      from public.routine_completions
     where id = '69440000-0000-4000-8000-000000000001'
  ),
  1::bigint,
  'the cutover preserves legacy completion evidence'
);
select ok(
  exists (
    select 1
      from pg_catalog.pg_constraint as constraints
     where constraints.conrelid = 'public.routine_steps'::regclass
       and constraints.conname = 'routine_steps_user_product_id_fkey'
       and constraints.confrelid = 'public.shelf_product_identities'::regclass
       and constraints.confdeltype = 'a'
       and constraints.condeferrable
       and constraints.condeferred
  ),
  'the routine-step product FK is deferred NO ACTION against stable identity'
);
select ok(
  exists (
    select 1
      from pg_catalog.pg_constraint as constraints
     where constraints.conrelid = 'public.user_products'::regclass
       and constraints.conname = 'user_products_shelf_identity_fkey'
       and constraints.confrelid = 'public.shelf_product_identities'::regclass
       and constraints.confdeltype = 'c'
       and constraints.condeferrable
       and not constraints.condeferred
  ),
  'active Shelf content is an immediate-safe cascading child of stable identity'
);
select ok(
  exists (
    select 1
      from pg_catalog.pg_trigger as triggers
     where triggers.tgrelid = 'public.routine_steps'::regclass
       and triggers.tgname = 'trg_routine_steps_product_owner'
       and triggers.tgconstraint <> 0
       and not triggers.tgisinternal
  ),
  'a deferred constraint trigger preserves the same-owner relationship'
);
select lives_ok(
  $$select private.assert_routine_step_product_legacy_integrity()$$,
  'the valid production-shaped legacy fixture passes the retained preflight'
);

set session_replication_role = replica;
insert into public.routine_steps (
  id, routine_id, user_product_id, step_order
)
values (
  '69430000-0000-4000-8000-000000000002',
  '69420000-0000-4000-8000-000000000001',
  '69410000-0000-4000-8000-000000000002',
  2
);
set session_replication_role = origin;
select throws_ok(
  $$select private.assert_routine_step_product_legacy_integrity()$$,
  '23514',
  'ROUTINE_STEP_PRODUCT_LEGACY_OWNER_INVALID',
  'the cutover preflight fails closed on a cross-owner legacy product'
);
set session_replication_role = replica;
delete from public.routine_steps
 where id = '69430000-0000-4000-8000-000000000002';
set session_replication_role = origin;

select ok(
  to_regprocedure(
    'public.sync_shelf_product(text,text,text,text,jsonb)'
  ) is not null,
  'the exact scalar Shelf RPC signature exists'
);
select ok(
  to_regprocedure(
    'public.record_routine_completion(text,text,text,text,text,integer,text,text,text)'
  ) is not null,
  'the exact scalar completion RPC signature exists'
);
select ok(
  pg_catalog.has_function_privilege(
    'authenticated',
    'public.sync_shelf_product(text,text,text,text,jsonb)',
    'EXECUTE'
  )
  and not pg_catalog.has_function_privilege(
    'anon',
    'public.sync_shelf_product(text,text,text,text,jsonb)',
    'EXECUTE'
  )
  and pg_catalog.has_function_privilege(
    'authenticated',
    'public.record_routine_completion(text,text,text,text,text,integer,text,text,text)',
    'EXECUTE'
  )
  and not pg_catalog.has_function_privilege(
    'anon',
    'public.record_routine_completion(text,text,text,text,text,integer,text,text,text)',
    'EXECUTE'
  ),
  'only authenticated API callers receive the two bridge entrypoints'
);
select ok(
  not pg_catalog.has_table_privilege(
    'authenticated', 'public.user_products', 'INSERT, UPDATE, DELETE'
  )
  and not pg_catalog.has_table_privilege(
    'authenticated', 'public.routines', 'INSERT, UPDATE, DELETE'
  )
  and not pg_catalog.has_table_privilege(
    'authenticated', 'public.routine_steps', 'INSERT, UPDATE, DELETE'
  )
  and not pg_catalog.has_table_privilege(
    'authenticated', 'public.routine_completions', 'INSERT, UPDATE, DELETE'
  ),
  '0069 seals all direct authenticated bridge-table mutation'
);
select ok(
  not pg_catalog.has_table_privilege(
    'service_role', 'private.shelf_sync_operations', 'SELECT'
  )
  and not pg_catalog.has_table_privilege(
    'service_role',
    'private.routine_completion_sync_operations',
    'SELECT'
  ),
  'the minimized replay ledgers remain private from API roles'
);
select ok(
  pg_catalog.pg_get_functiondef(
    'public.sync_shelf_product(text,text,text,text,jsonb)'::regprocedure
  ) not ilike '%legacy_unverified_expiry_date%'
  and pg_catalog.pg_get_functiondef(
    'public.sync_shelf_product(text,text,text,text,jsonb)'::regprocedure
  ) not ilike '%COMPLETION_DEPENDENCY_TERMINAL%',
  'the bridge neither trusts legacy expiry quarantine nor emits a client-only code'
);
select ok(
  pg_catalog.pg_get_functiondef(
    'public._health_relational_data_exists(uuid)'::regprocedure
  ) ilike '%shelf_product_identities%'
  and pg_catalog.pg_get_functiondef(
    'public._health_relational_data_exists(uuid)'::regprocedure
  ) ilike '%routine_completion_sync_operations%',
  'health zero-attestation includes identities and both minimized ledgers'
);

select * from finish();
