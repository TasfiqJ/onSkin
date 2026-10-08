begin;

create extension if not exists pgtap with schema extensions;
set local search_path = extensions, public, pg_catalog;
select plan(82);

create function pg_temp.core05_shelf_payload(
  p_id text,
  p_name text default 'CORE-05 mirror product'
)
returns jsonb
language sql
immutable
as $$
  select pg_catalog.jsonb_build_object(
    'id', p_id,
    'catalog_product_id', null,
    'catalog_source_id', null,
    'catalog_match_quality', 'manual',
    'catalog_source_snapshot_date', null,
    'manual_name', p_name,
    'manual_brand', null,
    'barcode', null,
    'opened_at', null,
    'pao_months', null,
    'expiry_date', null,
    'is_opened', false,
    'pao_source', 'unknown',
    'expiry_source', 'unknown',
    'added_via', 'manual',
    'source_disclosure_ack_at', null,
    'status', 'active',
    'finished_at', null
  )
$$;

grant execute on function pg_temp.core05_shelf_payload(text, text)
  to authenticated;

select is(
  (select count(*) from supabase_migrations.schema_migrations),
  95::bigint,
  'CORE-05 sync bridge runs against the exact 95-migration source history'
);
select is(
  (select max(version) from supabase_migrations.schema_migrations),
  '20261007000079'::text,
  'the migration history retains the sync bridge through the current head'
);
select results_eq(
  $$select column_name::text collate "C"
      from information_schema.columns
     where table_schema = 'public'
       and table_name = 'shelf_product_identities'
     order by ordinal_position$$,
  $$values
      ('id'::text collate "C"),
      ('user_id'::text collate "C"),
      ('created_at'::text collate "C"),
      ('deleted_effective_at'::text collate "C"),
      ('deleted_received_at'::text collate "C")$$,
  'stable Shelf identity retains only owner, identity, and tombstone timing'
);
select results_eq(
  $$select column_name::text collate "C"
      from information_schema.columns
     where table_schema = 'private'
       and table_name = 'shelf_sync_operations'
     order by ordinal_position$$,
  $$values
      ('operation_id'::text collate "C"),
      ('user_id'::text collate "C"),
      ('request_sha256'::text collate "C"),
      ('state'::text collate "C"),
      ('result_code'::text collate "C"),
      ('created_at'::text collate "C"),
      ('finalized_at'::text collate "C")$$,
  'Shelf replay state is a minimized digest/outcome ledger without raw payload'
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
  and not pg_catalog.has_function_privilege(
    'service_role',
    'public.sync_shelf_product(text,text,text,text,jsonb)',
    'EXECUTE'
  ),
  'Shelf sync is an authenticated-only scalar entrypoint'
);
select ok(
  pg_catalog.has_function_privilege(
    'authenticated',
    'public.record_routine_completion(text,text,text,text,text,integer,text,text,text)',
    'EXECUTE'
  )
  and not pg_catalog.has_function_privilege(
    'anon',
    'public.record_routine_completion(text,text,text,text,text,integer,text,text,text)',
    'EXECUTE'
  )
  and not pg_catalog.has_function_privilege(
    'service_role',
    'public.record_routine_completion(text,text,text,text,text,integer,text,text,text)',
    'EXECUTE'
  ),
  'completion sync is an authenticated-only scalar entrypoint'
);
select ok(
  (
    select pg_catalog.bool_and(
      pg_catalog.has_function_privilege(
        'authenticated', procedure_identity, 'EXECUTE'
      )
      and not pg_catalog.has_function_privilege(
        'anon', procedure_identity, 'EXECUTE'
      )
      and not pg_catalog.has_function_privilege(
        'service_role', procedure_identity, 'EXECUTE'
      )
    )
      from (
        values
          (
            'public.export_shelf_product_identities_for_subject(timestamptz,uuid,integer)'
          ),
          (
            'public.export_shelf_sync_receipts_for_subject(timestamptz,uuid,integer)'
          ),
          (
            'public.export_routine_completion_sync_receipts_for_subject(timestamptz,uuid,integer)'
          )
      ) as exports(procedure_identity)
  ),
  'all health-sync exports are authenticated-only subject RPCs'
);
select ok(
  pg_catalog.pg_get_function_result(
    'public.export_shelf_product_identities_for_subject(timestamptz,uuid,integer)'::regprocedure
  ) ilike
    'TABLE(export_total_count bigint, id uuid, user_id uuid, created_at timestamp with time zone, deleted_effective_at timestamp with time zone, deleted_received_at timestamp with time zone)'
  and pg_catalog.pg_get_function_result(
    'public.export_shelf_sync_receipts_for_subject(timestamptz,uuid,integer)'::regprocedure
  ) ilike
    'TABLE(export_total_count bigint, operation_id uuid, user_id uuid, state text, result_code text, created_at timestamp with time zone, finalized_at timestamp with time zone)'
  and pg_catalog.pg_get_function_result(
    'public.export_routine_completion_sync_receipts_for_subject(timestamptz,uuid,integer)'::regprocedure
  ) ilike
    'TABLE(export_total_count bigint, event_id uuid, user_id uuid, state text, result_code text, created_at timestamp with time zone, finalized_at timestamp with time zone)'
  and pg_catalog.pg_get_functiondef(
    'public.export_shelf_sync_receipts_for_subject(timestamptz,uuid,integer)'::regprocedure
  ) not ilike '%request_sha256%'
  and pg_catalog.pg_get_functiondef(
    'public.export_routine_completion_sync_receipts_for_subject(timestamptz,uuid,integer)'::regprocedure
  ) not ilike '%request_sha256%',
  'export projections are exact and omit internal request fingerprints'
);
select ok(
  not pg_catalog.has_table_privilege(
    'authenticated', 'public.user_products', 'INSERT, UPDATE, DELETE'
  )
  and not pg_catalog.has_table_privilege(
    'authenticated', 'public.shelf_product_identities', 'INSERT, UPDATE, DELETE'
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
  'authenticated callers cannot bypass either sync authority with direct DML'
);
select ok(
  pg_catalog.obj_description(
    'public.record_routine_completion(text,text,text,text,text,integer,text,text,text)'::regprocedure,
    'pg_proc'
  ) ilike '%user%s routine-complete attestation%'
  and pg_catalog.obj_description(
    'public.record_routine_completion(text,text,text,text,text,integer,text,text,text)'::regprocedure,
    'pg_proc'
  ) ilike '%not objective proof%',
  'the PM marker is explicitly documented as user attestation, not objective proof'
);
select ok(
  pg_catalog.pg_get_functiondef(
    'public.sync_shelf_product(text,text,text,text,jsonb)'::regprocedure
  ) not ilike '%legacy_unverified_expiry_date%'
  and pg_catalog.pg_get_functiondef(
    'public.record_routine_completion(text,text,text,text,text,integer,text,text,text)'::regprocedure
  ) not ilike '%COMPLETION_DEPENDENCY_TERMINAL%',
  'SQL neither trusts the legacy expiry quarantine nor contains the client-only code'
);

insert into auth.users (id)
values
  ('69000000-0000-4000-8000-000000000001'),
  ('69000000-0000-4000-8000-000000000002'),
  ('69000000-0000-4000-8000-000000000004');
insert into auth.users (id, is_anonymous)
values ('69000000-0000-4000-8000-000000000003', true);
insert into auth.sessions (id, user_id)
values
  (
    '69001000-0000-4000-8000-000000000001',
    '69000000-0000-4000-8000-000000000001'
  ),
  (
    '69001000-0000-4000-8000-000000000002',
    '69000000-0000-4000-8000-000000000002'
  ),
  (
    '69001000-0000-4000-8000-000000000003',
    '69000000-0000-4000-8000-000000000003'
  ),
  (
    '69001000-0000-4000-8000-000000000004',
    '69000000-0000-4000-8000-000000000004'
  );

update public.health_processing_states
   set state = 'active',
       epoch = 1,
       consent_version = 'draft-v1-2026-07-10',
       consent_text_hash =
         '7957a2811fff0e8cefc6f7180b751ec45688fe99421978eedae05b96c2f251fd',
       last_server_verified_at = pg_catalog.statement_timestamp()
 where user_id = '69000000-0000-4000-8000-000000000001';
set local role authenticated;
select pg_catalog.set_config(
  'request.jwt.claims',
  '{"sub":"69000000-0000-4000-8000-000000000001","role":"authenticated","session_id":"69001000-0000-4000-8000-000000000001"}',
  true
);
select pg_catalog.set_config(
  'request.headers',
  '{"x-health-processing-epoch":"1"}',
  true
);
select throws_ok(
  $$select public.sync_shelf_product(
      '69010000-0000-4000-8000-000000000030',
      'delete',
      '2026-07-26T12:00:00.000Z',
      '69020000-0000-4000-8000-000000000030',
      null
    )$$,
  '55000',
  'HEALTH_PROCESSING_CONSENT_STALE',
  'Shelf sync rejects an exact draft-blocked health grant before retention'
);
select throws_ok(
  $$select public.record_routine_completion(
      '69030000-0000-4000-8000-000000000030',
      '69040000-0000-4000-8000-000000000030',
      'PM',
      null,
      null,
      null,
      '2026-07-26T12:00:00.000Z',
      '2026-07-26',
      'America/Toronto'
    )$$,
  '55000',
  'HEALTH_PROCESSING_CONSENT_STALE',
  'completion sync rejects an exact draft-blocked health grant before retention'
);
reset role;
select is(
  (
    select pg_catalog.count(*) from private.shelf_sync_operations
  ) + (
    select pg_catalog.count(*)
      from private.routine_completion_sync_operations
  ) + (
    select pg_catalog.count(*)
      from public.shelf_product_identities
     where user_id = '69000000-0000-4000-8000-000000000001'
  ) + (
    select pg_catalog.count(*)
      from public.routine_completions
     where user_id = '69000000-0000-4000-8000-000000000001'
  ),
  0::bigint,
  'draft-blocked sync attempts leave operation, identity, and completion state empty'
);

do $$
begin
  perform *
    from public.promote_health_consent_copy_for_release(
      'health_data_collection',
      'grant',
      'draft-v1-2026-07-10',
      '7957a2811fff0e8cefc6f7180b751ec45688fe99421978eedae05b96c2f251fd',
      'PGTAP-CORE05-0069-SYNC-2026-07-26',
      'pgtap.db-owner',
      repeat('6', 64)
    );
end;
$$;
update public.health_processing_states
   set state = 'active',
       epoch = 1,
       consent_version = 'draft-v1-2026-07-10',
       consent_text_hash =
         '7957a2811fff0e8cefc6f7180b751ec45688fe99421978eedae05b96c2f251fd',
       last_server_verified_at = pg_catalog.statement_timestamp()
 where user_id in (
   '69000000-0000-4000-8000-000000000001',
   '69000000-0000-4000-8000-000000000002',
   '69000000-0000-4000-8000-000000000003',
   '69000000-0000-4000-8000-000000000004'
 );

select pg_catalog.set_config(
  'test.core05_completed_at',
  pg_catalog.to_char(
    pg_catalog.date_trunc(
      'milliseconds',
      pg_catalog.statement_timestamp() - interval '1 hour'
    ) at time zone 'UTC',
    'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"'
  ),
  true
);
select pg_catalog.set_config(
  'test.core05_completed_date',
  (
    pg_catalog.current_setting('test.core05_completed_at')::timestamptz
      at time zone 'America/Toronto'
  )::date::text,
  true
);
select pg_catalog.set_config(
  'test.core05_enqueued_at',
  pg_catalog.to_char(
    pg_catalog.date_trunc(
      'milliseconds',
      pg_catalog.statement_timestamp() - interval '2 hours'
    ) at time zone 'UTC',
    'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"'
  ),
  true
);
select pg_catalog.set_config(
  'test.core05_pre_delete_at',
  pg_catalog.to_char(
    pg_catalog.date_trunc(
      'milliseconds',
      pg_catalog.current_setting('test.core05_enqueued_at')::timestamptz
        - interval '1 day'
    ) at time zone 'UTC',
    'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"'
  ),
  true
);
select pg_catalog.set_config(
  'test.core05_pre_delete_date',
  (
    pg_catalog.current_setting('test.core05_pre_delete_at')::timestamptz
      at time zone 'America/Toronto'
  )::date::text,
  true
);

set local role authenticated;
select pg_catalog.set_config(
  'request.jwt.claims',
  '{"sub":"69000000-0000-4000-8000-000000000001","role":"authenticated","session_id":"69001000-0000-4000-8000-000000000001"}',
  true
);
select pg_catalog.set_config(
  'request.headers',
  '{"x-health-processing-epoch":"1"}',
  true
);

select pg_catalog.set_config(
  'request.jwt.claims',
  '{"sub":"69000000-0000-4000-8000-000000000003","role":"authenticated","is_anonymous":true,"session_id":"69001000-0000-4000-8000-000000000003"}',
  true
);
select throws_ok(
  $$select * from public.export_shelf_product_identities_for_subject(
      null, null, 500
    )$$,
  '42501',
  'HEALTH_SYNC_EXPORT_OWNER_REQUIRED',
  'a signed anonymous session cannot use a health-sync export RPC'
);
reset role;

set local role service_role;
select throws_ok(
  $$select * from public.export_shelf_sync_receipts_for_subject(
      null, null, 500
    )$$,
  '42501',
  'permission denied for function export_shelf_sync_receipts_for_subject',
  'service role cannot bypass the authenticated-subject export boundary'
);
reset role;

set local role authenticated;
select pg_catalog.set_config(
  'request.jwt.claims',
  '{"sub":"69000000-0000-4000-8000-000000000001","role":"authenticated","session_id":"69001000-0000-4000-8000-000000000001"}',
  true
);
select throws_ok(
  $$select * from public.export_shelf_product_identities_for_subject(
      pg_catalog.statement_timestamp(),
      null,
      500
    )$$,
  '22023',
  'HEALTH_SYNC_EXPORT_INPUT_INVALID',
  'a partial export cursor is rejected before any sealed read'
);
select pg_catalog.set_config(
  'request.jwt.claims',
  '{"sub":"69000000-0000-4000-8000-000000000001","role":"authenticated","session_id":"69001000-0000-4000-8000-000000000099"}',
  true
);
select throws_ok(
  $$select * from public.export_shelf_product_identities_for_subject(
      null, null, 500
    )$$,
  '28000',
  'HEALTH_CONSENT_SESSION_REJECTED',
  'a stale or forged session cannot use a sealed export RPC'
);
select pg_catalog.set_config(
  'request.jwt.claims',
  '{"sub":"69000000-0000-4000-8000-000000000001","role":"authenticated","session_id":"69001000-0000-4000-8000-000000000001"}',
  true
);
select pg_catalog.set_config(
  'request.headers',
  '{"x-health-processing-epoch":"2"}',
  true
);
select throws_ok(
  $$select * from public.export_shelf_product_identities_for_subject(
      null, null, 500
    )$$,
  '55000',
  'HEALTH_PROCESSING_EPOCH_STALE',
  'an active subject export requires the exact current health-processing epoch'
);
select pg_catalog.set_config(
  'request.headers',
  '{"x-health-processing-epoch":"1"}',
  true
);

select is(
  public.sync_shelf_product(
    '69010000-0000-4000-8000-000000000001',
    'upsert',
    pg_catalog.current_setting('test.core05_enqueued_at'),
    'not-a-uuid',
    '{}'::jsonb
  ),
  pg_catalog.jsonb_build_object(
    'version', 1,
    'operation_id', '69010000-0000-4000-8000-000000000001',
    'status', 'terminal',
    'code', 'SHELF_PRODUCT_ID_INVALID'
  ),
  'invalid Shelf identity is an exact terminal response'
);
reset role;
select is(
  (select count(*) from private.shelf_sync_operations),
  0::bigint,
  'structurally invalid Shelf input is rejected before replay-ledger retention'
);

set local role authenticated;
select is(
  public.sync_shelf_product(
    '69010000-0000-4000-8000-000000000010',
    'upsert',
    '2026-99-99T99:99:99.999Z',
    '69020000-0000-4000-8000-000000000010',
    pg_temp.core05_shelf_payload(
      '69020000-0000-4000-8000-000000000010',
      'Malformed instant'
    )
  ) ->> 'code',
  'SHELF_PRODUCT_PAYLOAD_INVALID',
  'a syntactically shaped but impossible Shelf instant returns JSON, not an exception'
);
select is(
  public.sync_shelf_product(
    '69010000-0000-4000-8000-000000000011',
    'upsert',
    pg_catalog.current_setting('test.core05_enqueued_at'),
    '69020000-0000-4000-8000-000000000011',
    pg_temp.core05_shelf_payload(
      '69020000-0000-4000-8000-000000000011',
      'Exponent PAO'
    ) || '{"pao_months":1e1000}'::jsonb
  ) ->> 'code',
  'SHELF_PRODUCT_PAYLOAD_INVALID',
  'an exponent-expanded PAO cannot reach an unsafe integer cast'
);
select is(
  public.sync_shelf_product(
    '69010000-0000-4000-8000-000000000012',
    'upsert',
    pg_catalog.current_setting('test.core05_enqueued_at'),
    '69020000-0000-4000-8000-000000000012',
    '"scalar"'::jsonb
  ) ->> 'code',
  'SHELF_PRODUCT_PAYLOAD_INVALID',
  'a scalar Shelf payload returns exact terminal JSON without key enumeration'
);
select is(
  public.sync_shelf_product(
    '69010000-0000-4000-8000-000000000013',
    'upsert',
    pg_catalog.current_setting('test.core05_enqueued_at'),
    '69020000-0000-4000-8000-000000000013',
    '[]'::jsonb
  ) ->> 'code',
  'SHELF_PRODUCT_PAYLOAD_INVALID',
  'an array Shelf payload returns exact terminal JSON without key enumeration'
);
select is(
  public.sync_shelf_product(
    '69010000-0000-4000-8000-000000000014',
    'upsert',
    pg_catalog.current_setting('test.core05_enqueued_at'),
    '69020000-0000-4000-8000-000000000014',
    null
  ) ->> 'code',
  'SHELF_PRODUCT_PAYLOAD_INVALID',
  'a null upsert payload returns exact terminal JSON without key enumeration'
);
select is(
  public.record_routine_completion(
    '69030000-0000-4000-8000-000000000010',
    '69040000-0000-4000-8000-000000000010',
    'PM',
    null,
    null,
    null,
    '2026-99-99T99:99:99.999Z',
    '2026-99-99',
    'America/Toronto'
  ) ->> 'code',
  'COMPLETION_REQUEST_INVALID',
  'malformed completion instant/date values return exact terminal JSON'
);
select is(
  public.record_routine_completion(
    '69030000-0000-4000-8000-000000000011',
    '69040000-0000-4000-8000-000000000011',
    'PM',
    null,
    null,
    null,
    pg_catalog.current_setting('test.core05_completed_at'),
    pg_catalog.current_setting('test.core05_completed_date'),
    'Not/A_Real_Zone'
  ) ->> 'code',
  'COMPLETION_REQUEST_INVALID',
  'an unknown timezone returns exact terminal JSON before AT TIME ZONE'
);
reset role;
select is(
  (
    select count(*) from private.shelf_sync_operations
  ) + (
    select count(*) from private.routine_completion_sync_operations
  ) + (
    select count(*)
      from public.shelf_product_identities
     where user_id = '69000000-0000-4000-8000-000000000001'
  ) + (
    select count(*)
      from public.user_products
     where user_id = '69000000-0000-4000-8000-000000000001'
  ),
  0::bigint,
  'malformed time/date/timezone/PAO and non-object payloads retain no side effect'
);

set local role authenticated;
select is(
  public.sync_shelf_product(
    '69010000-0000-4000-8000-000000000020',
    'upsert',
    pg_catalog.current_setting('test.core05_enqueued_at'),
    '69020000-0000-4000-8000-000000000020',
    pg_temp.core05_shelf_payload(
      '69020000-0000-4000-8000-000000000020',
      'Terminal before delete'
    ) || pg_catalog.jsonb_build_object(
      'catalog_product_id',
      '69021000-0000-4000-8000-000000000020'
    )
  ) ->> 'code',
  'SHELF_PRODUCT_PROVENANCE_INVALID',
  'an incomplete catalog provenance upsert is terminal before identity creation'
);
select is(
  public.sync_shelf_product(
    '69010000-0000-4000-8000-000000000021',
    'delete',
    pg_catalog.current_setting('test.core05_enqueued_at'),
    '69020000-0000-4000-8000-000000000020',
    null
  ),
  pg_catalog.jsonb_build_object(
    'version', 1,
    'operation_id', '69010000-0000-4000-8000-000000000021',
    'status', 'accepted',
    'code', null
  ),
  'a missing-row delete wins and returns the exact accepted response'
);
reset role;
select results_eq(
  $$select
      identities.user_id,
      identities.deleted_effective_at,
      identities.deleted_received_at is not null,
      exists (
        select 1 from public.user_products where id = identities.id
      )
      from public.shelf_product_identities as identities
     where identities.id = '69020000-0000-4000-8000-000000000020'$$,
  $$values (
      '69000000-0000-4000-8000-000000000001'::uuid,
      pg_catalog.current_setting('test.core05_enqueued_at')::timestamptz,
      true,
      false
    )$$,
  'missing delete creates only a minimal owner tombstone and no active content'
);

set local role authenticated;
select is(
  public.sync_shelf_product(
    '69010000-0000-4000-8000-000000000021',
    'delete',
    pg_catalog.current_setting('test.core05_enqueued_at'),
    '69020000-0000-4000-8000-000000000020',
    null
  ) ->> 'status',
  'idempotent',
  'the deletion-wins operation is idempotent on exact replay'
);
select is(
  public.sync_shelf_product(
    '69010000-0000-4000-8000-000000000022',
    'upsert',
    pg_catalog.current_setting('test.core05_enqueued_at'),
    '69020000-0000-4000-8000-000000000020',
    pg_temp.core05_shelf_payload(
      '69020000-0000-4000-8000-000000000020',
      'Forbidden after missing delete'
    )
  ) ->> 'code',
  'SHELF_PRODUCT_OWNERSHIP_CONFLICT',
  'a later upsert cannot resurrect a deletion-wins tombstone'
);
select is(
  public.record_routine_completion(
    '69030000-0000-4000-8000-000000000020',
    '69040000-0000-4000-8000-000000000020',
    'PM',
    '69050000-0000-4000-8000-000000000020',
    '69020000-0000-4000-8000-000000000020',
    20,
    pg_catalog.current_setting('test.core05_pre_delete_at'),
    pg_catalog.current_setting('test.core05_pre_delete_date'),
    'America/Toronto'
  ) ->> 'status',
  'accepted',
  'a delayed step before a deletion-wins cutoff remains admissible'
);
select is(
  public.record_routine_completion(
    '69030000-0000-4000-8000-000000000021',
    '69040000-0000-4000-8000-000000000020',
    'PM',
    null,
    null,
    null,
    pg_catalog.current_setting('test.core05_pre_delete_at'),
    pg_catalog.current_setting('test.core05_pre_delete_date'),
    'America/Toronto'
  ) ->> 'status',
  'accepted',
  'the exact same-time PM attestation is accepted for a pre-cutoff delayed step'
);
select is(
  public.record_routine_completion(
    '69030000-0000-4000-8000-000000000022',
    '69040000-0000-4000-8000-000000000022',
    'PM',
    '69050000-0000-4000-8000-000000000022',
    '69020000-0000-4000-8000-000000000020',
    22,
    pg_catalog.current_setting('test.core05_completed_at'),
    pg_catalog.current_setting('test.core05_completed_date'),
    'America/Toronto'
  ) ->> 'code',
  'COMPLETION_AFTER_PRODUCT_DELETION',
  'a delayed step after a deletion-wins cutoff is terminal'
);

select is(
  public.sync_shelf_product(
    '69010000-0000-4000-8000-000000000002',
    'upsert',
    pg_catalog.current_setting('test.core05_enqueued_at'),
    '69020000-0000-4000-8000-000000000001',
    pg_temp.core05_shelf_payload(
      '69020000-0000-4000-8000-000000000001',
      'Primary mirror'
    )
  ),
  pg_catalog.jsonb_build_object(
    'version', 1,
    'operation_id', '69010000-0000-4000-8000-000000000002',
    'status', 'accepted',
    'code', null
  ),
  'a valid manual Shelf mirror is accepted with the exact response'
);
select ok(
  (
    select pg_catalog.jsonb_typeof(response) = 'object'
      and (select count(*) from pg_catalog.jsonb_object_keys(response)) = 4
      and pg_catalog.jsonb_typeof(response -> 'version') = 'number'
      and pg_catalog.jsonb_typeof(response -> 'operation_id') = 'string'
      and pg_catalog.jsonb_typeof(response -> 'status') = 'string'
      and pg_catalog.jsonb_typeof(response -> 'code') = 'null'
      from (
        select public.sync_shelf_product(
          '69010000-0000-4000-8000-000000000002',
          'upsert',
          pg_catalog.current_setting('test.core05_enqueued_at'),
          '69020000-0000-4000-8000-000000000001',
          pg_temp.core05_shelf_payload(
            '69020000-0000-4000-8000-000000000001',
            'Primary mirror'
          )
        ) as response
      ) as replay
  ),
  'Shelf responses have exactly four keys and exact JSON scalar types'
);
reset role;
select ok(
  exists (
    select 1
      from public.user_products as products
      join public.shelf_product_identities as identities
        on identities.id = products.id
       and identities.user_id = products.user_id
     where products.id = '69020000-0000-4000-8000-000000000001'
       and products.user_id = '69000000-0000-4000-8000-000000000001'
       and products.manual_name = 'Primary mirror'
       and products.legacy_unverified_expiry_date is null
  ),
  'Shelf acceptance writes same-owner active content without trusting quarantine'
);
select ok(
  exists (
    select 1
      from private.shelf_sync_operations as operations
     where operations.operation_id = '69010000-0000-4000-8000-000000000002'
       and operations.state = 'accepted'
       and operations.result_code is null
       and operations.request_sha256 ~ '^[0-9a-f]{64}$'
       and operations.request_sha256 not like '%Primary mirror%'
  ),
  'the accepted Shelf ledger retains a digest and outcome, never the raw name'
);

select pg_catalog.set_config(
  'test.core05_identity_export_total',
  (
    select pg_catalog.count(*)::text
      from public.shelf_product_identities as identity_row
     where identity_row.user_id =
       '69000000-0000-4000-8000-000000000001'
  ),
  true
);
set local role authenticated;
select ok(
  (
    select pg_catalog.bool_and(
      exported.user_id = '69000000-0000-4000-8000-000000000001'
      and exported.export_total_count =
        pg_catalog.current_setting(
          'test.core05_identity_export_total'
        )::bigint
    )
      from public.export_shelf_product_identities_for_subject(
        null, null, 500
      ) as exported
  ),
  'identity export derives the caller and reports the exact owner total'
);
select ok(
  (
    with first_row as (
      select exported.created_at, exported.operation_id,
             exported.export_total_count
        from public.export_shelf_sync_receipts_for_subject(
          null, null, 1
        ) as exported
    ),
    remaining as (
      select exported.*
        from first_row
        cross join lateral public.export_shelf_sync_receipts_for_subject(
          first_row.created_at, first_row.operation_id, 500
        ) as exported
    )
    select (select pg_catalog.count(*) from first_row) = 1
      and (
        select pg_catalog.count(*) from remaining
      ) = (
        select export_total_count - 1 from first_row
      )
      and (
        select pg_catalog.bool_and(
          (remaining.created_at, remaining.operation_id)
            > (first_row.created_at, first_row.operation_id)
          and remaining.export_total_count = first_row.export_total_count
        )
          from remaining
          cross join first_row
      )
  ),
  'receipt export keeps the pre-keyset total while advancing a strict keyset cursor'
);
select is(
  public.sync_shelf_product(
    '69010000-0000-4000-8000-000000000002',
    'upsert',
    pg_catalog.current_setting('test.core05_enqueued_at'),
    '69020000-0000-4000-8000-000000000001',
    pg_temp.core05_shelf_payload(
      '69020000-0000-4000-8000-000000000001',
      'Primary mirror'
    )
  ) ->> 'status',
  'idempotent',
  'an exact accepted Shelf replay is idempotent'
);
select is(
  public.sync_shelf_product(
    '69010000-0000-4000-8000-000000000002',
    'upsert',
    pg_catalog.current_setting('test.core05_enqueued_at'),
    '69020000-0000-4000-8000-000000000001',
    pg_temp.core05_shelf_payload(
      '69020000-0000-4000-8000-000000000001',
      'Changed replay'
    )
  ) ->> 'code',
  'SHELF_PRODUCT_OWNERSHIP_CONFLICT',
  'an operation ID rebound to different bytes is terminal'
);

select is(
  public.record_routine_completion(
    '69030000-0000-4000-8000-000000000001',
    '69040000-0000-4000-8000-000000000001',
    'PM',
    '69050000-0000-4000-8000-000000000001',
    '69020000-0000-4000-8000-000000000002',
    1,
    pg_catalog.current_setting('test.core05_completed_at'),
    pg_catalog.current_setting('test.core05_completed_date'),
    'America/Toronto'
  ) ->> 'code',
  'COMPLETION_PRODUCT_RETRY_LATER',
  'a completion whose Shelf identity has not arrived is retryable'
);
reset role;
select results_eq(
  $$select state, result_code
      from private.routine_completion_sync_operations
     where event_id = '69030000-0000-4000-8000-000000000001'$$,
  $$values ('pending'::text, null::text)$$,
  'retryable completion state remains pending without a fabricated terminal code'
);

set local role authenticated;
select is(
  public.sync_shelf_product(
    '69010000-0000-4000-8000-000000000003',
    'upsert',
    pg_catalog.current_setting('test.core05_enqueued_at'),
    '69020000-0000-4000-8000-000000000002',
    pg_temp.core05_shelf_payload(
      '69020000-0000-4000-8000-000000000002',
      'Arriving dependency'
    )
  ) ->> 'status',
  'accepted',
  'the missing Shelf dependency can arrive later'
);
select is(
  public.record_routine_completion(
    '69030000-0000-4000-8000-000000000001',
    '69040000-0000-4000-8000-000000000001',
    'PM',
    '69050000-0000-4000-8000-000000000001',
    '69020000-0000-4000-8000-000000000002',
    1,
    pg_catalog.current_setting('test.core05_completed_at'),
    pg_catalog.current_setting('test.core05_completed_date'),
    'America/Toronto'
  ) ->> 'status',
  'accepted',
  'the exact pending completion succeeds after its Shelf dependency arrives'
);
reset role;
select ok(
  exists (
    select 1
      from public.routine_completions as completions
      join public.routines as routines
        on routines.id = completions.routine_id
       and routines.user_id = completions.user_id
      join public.routine_steps as steps
        on steps.id = completions.step_id
       and steps.routine_id = completions.routine_id
      join public.shelf_product_identities as identities
        on identities.id = steps.user_product_id
       and identities.user_id = completions.user_id
     where completions.id = '69030000-0000-4000-8000-000000000001'
  ),
  'accepted step evidence preserves owner, routine, step, and product identity'
);

set local role authenticated;
select is(
  public.record_routine_completion(
    '69030000-0000-4000-8000-000000000002',
    '69040000-0000-4000-8000-000000000001',
    'PM',
    null,
    null,
    null,
    pg_catalog.current_setting('test.core05_completed_at'),
    pg_catalog.current_setting('test.core05_completed_date'),
    'America/Toronto'
  ) ->> 'status',
  'accepted',
  'a PM attestation is admitted only after exact same-time step evidence'
);
reset role;
select ok(
  exists (
    select 1
      from public.routine_completions
     where id = '69030000-0000-4000-8000-000000000002'
       and step_id is null
  ),
  'the admitted user attestation is stored as a routine-level marker'
);

select pg_catalog.set_config(
  'test.core05_authority_before',
  pg_catalog.jsonb_build_object(
    'profile', (
      select pg_catalog.to_jsonb(profiles)
        from public.profiles
       where profiles.id = '69000000-0000-4000-8000-000000000001'
    ),
    'freezes', (
      select coalesce(
        pg_catalog.jsonb_agg(
          pg_catalog.to_jsonb(freezes) order by freezes.applied_for_date
        ),
        '[]'::jsonb
      )
        from public.streak_freezes as freezes
       where freezes.user_id = '69000000-0000-4000-8000-000000000001'
    )
  )::text,
  true
);
set local role authenticated;
select is(
  public.record_routine_completion(
    '69030000-0000-4000-8000-000000000003',
    '69040000-0000-4000-8000-000000000099',
    'PM',
    null,
    null,
    null,
    pg_catalog.current_setting('test.core05_completed_at'),
    pg_catalog.current_setting('test.core05_completed_date'),
    'America/Toronto'
  ) ->> 'code',
  'COMPLETION_REQUEST_INVALID',
  'an orphan routine marker is terminal request-invalid'
);
reset role;
select is(
  pg_catalog.jsonb_build_object(
    'profile', (
      select pg_catalog.to_jsonb(profiles)
        from public.profiles
       where profiles.id = '69000000-0000-4000-8000-000000000001'
    ),
    'freezes', (
      select coalesce(
        pg_catalog.jsonb_agg(
          pg_catalog.to_jsonb(freezes) order by freezes.applied_for_date
        ),
        '[]'::jsonb
      )
        from public.streak_freezes as freezes
       where freezes.user_id = '69000000-0000-4000-8000-000000000001'
    )
  ),
  pg_catalog.current_setting('test.core05_authority_before')::jsonb,
  'orphan-marker rejection leaves timezone, profile cache, and freezes byte-stable'
);

set local role authenticated;
select is(
  public.record_routine_completion(
    '69030000-0000-4000-8000-000000000004',
    '69040000-0000-4000-8000-000000000001',
    'AM',
    '69050000-0000-4000-8000-000000000004',
    '69020000-0000-4000-8000-000000000002',
    4,
    pg_catalog.current_setting('test.core05_completed_at'),
    pg_catalog.current_setting('test.core05_completed_date'),
    'America/Toronto'
  ) ->> 'code',
  'COMPLETION_IDENTITY_CONFLICT',
  'rebinding an existing PM routine as AM is terminal identity conflict'
);
reset role;
select is(
  pg_catalog.jsonb_build_object(
    'profile', (
      select pg_catalog.to_jsonb(profiles)
        from public.profiles
       where profiles.id = '69000000-0000-4000-8000-000000000001'
    ),
    'freezes', (
      select coalesce(
        pg_catalog.jsonb_agg(
          pg_catalog.to_jsonb(freezes) order by freezes.applied_for_date
        ),
        '[]'::jsonb
      )
        from public.streak_freezes as freezes
       where freezes.user_id = '69000000-0000-4000-8000-000000000001'
    )
  ),
  pg_catalog.current_setting('test.core05_authority_before')::jsonb,
  'routine-identity rejection leaves profile/cache/freeze bytes unchanged'
);

set local role authenticated;
select is(
  public.record_routine_completion(
    '69030000-0000-4000-8000-000000000005',
    '69040000-0000-4000-8000-000000000001',
    'PM',
    '69050000-0000-4000-8000-000000000001',
    '69020000-0000-4000-8000-000000000002',
    1,
    pg_catalog.to_char(
      pg_catalog.current_setting('test.core05_completed_at')::timestamptz
        + interval '1 second',
      'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"'
    ),
    pg_catalog.current_setting('test.core05_completed_date'),
    'America/Toronto'
  ) ->> 'code',
  'COMPLETION_EVENT_CONFLICT',
  'a new event ID cannot bypass the null-safe semantic uniqueness key'
);
reset role;
select is(
  pg_catalog.jsonb_build_object(
    'profile', (
      select pg_catalog.to_jsonb(profiles)
        from public.profiles
       where profiles.id = '69000000-0000-4000-8000-000000000001'
    ),
    'freezes', (
      select coalesce(
        pg_catalog.jsonb_agg(
          pg_catalog.to_jsonb(freezes) order by freezes.applied_for_date
        ),
        '[]'::jsonb
      )
        from public.streak_freezes as freezes
       where freezes.user_id = '69000000-0000-4000-8000-000000000001'
    )
  ),
  pg_catalog.current_setting('test.core05_authority_before')::jsonb,
  'semantic-conflict rejection cannot mutate adherence authority'
);

set local role authenticated;
select is(
  public.sync_shelf_product(
    '69010000-0000-4000-8000-000000000004',
    'delete',
    pg_catalog.current_setting('test.core05_enqueued_at'),
    '69020000-0000-4000-8000-000000000002',
    null
  ) ->> 'status',
  'accepted',
  'Shelf deletion accepts a regressed requested cutoff'
);
reset role;
select results_eq(
  $$select
      identities.deleted_effective_at,
      identities.deleted_received_at is not null,
      exists (
        select 1 from public.user_products
         where id = identities.id
      ),
      exists (
        select 1 from public.routine_steps
         where user_product_id = identities.id
      )
      from public.shelf_product_identities as identities
     where identities.id = '69020000-0000-4000-8000-000000000002'$$,
  $$values (
      pg_catalog.current_setting('test.core05_completed_at')::timestamptz,
      true,
      false,
      true
    )$$,
  'delete normalizes to accepted completion time, removes content, and retains identity'
);

set local role authenticated;
select is(
  public.record_routine_completion(
    '69030000-0000-4000-8000-000000000006',
    '69040000-0000-4000-8000-000000000006',
    'PM',
    '69050000-0000-4000-8000-000000000006',
    '69020000-0000-4000-8000-000000000002',
    6,
    pg_catalog.current_setting('test.core05_completed_at'),
    pg_catalog.current_setting('test.core05_completed_date'),
    'America/Toronto'
  ) ->> 'status',
  'accepted',
  'historical evidence exactly at the tombstone cutoff remains admissible'
);
select is(
  public.record_routine_completion(
    '69030000-0000-4000-8000-000000000007',
    '69040000-0000-4000-8000-000000000007',
    'PM',
    '69050000-0000-4000-8000-000000000007',
    '69020000-0000-4000-8000-000000000002',
    7,
    pg_catalog.to_char(
      pg_catalog.current_setting('test.core05_completed_at')::timestamptz
        + interval '1 second',
      'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"'
    ),
    pg_catalog.current_setting('test.core05_completed_date'),
    'America/Toronto'
  ) ->> 'code',
  'COMPLETION_AFTER_PRODUCT_DELETION',
  'evidence after the normalized deletion cutoff is terminal'
);
select is(
  public.sync_shelf_product(
    '69010000-0000-4000-8000-000000000005',
    'upsert',
    pg_catalog.current_setting('test.core05_enqueued_at'),
    '69020000-0000-4000-8000-000000000002',
    pg_temp.core05_shelf_payload(
      '69020000-0000-4000-8000-000000000002',
      'Forbidden resurrection'
    )
  ) ->> 'code',
  'SHELF_PRODUCT_OWNERSHIP_CONFLICT',
  'a tombstoned stable identity cannot be resurrected by upsert'
);
select is(
  public.sync_shelf_product(
    '69010000-0000-4000-8000-000000000004',
    'delete',
    pg_catalog.current_setting('test.core05_enqueued_at'),
    '69020000-0000-4000-8000-000000000002',
    null
  ) ->> 'status',
  'idempotent',
  'an exact accepted delete replay is idempotent'
);
select is(
  public.sync_shelf_product(
    '69010000-0000-4000-8000-000000000006',
    'upsert',
    pg_catalog.current_setting('test.core05_enqueued_at'),
    '69020000-0000-4000-8000-000000000099',
    pg_temp.core05_shelf_payload(
      '69020000-0000-4000-8000-000000000099',
      'No legacy expiry key'
    ) || pg_catalog.jsonb_build_object(
      'legacy_unverified_expiry_date',
      pg_catalog.current_setting('test.core05_completed_date')
    )
  ) ->> 'code',
  'SHELF_PRODUCT_PAYLOAD_INVALID',
  'an attempted client legacy-expiry field is rejected as an extra payload key'
);

select throws_ok(
  $$insert into public.user_products (
      id, user_id, manual_name, is_opened, pao_source, expiry_source
    ) values (
      '69020000-0000-4000-8000-000000000099',
      '69000000-0000-4000-8000-000000000001',
      'Direct bypass',
      false,
      'unknown',
      'unknown'
    )$$,
  '42501',
  'permission denied for table user_products',
  'direct authenticated Shelf mutation is denied'
);

select pg_catalog.set_config(
  'request.jwt.claims',
  '{"sub":"69000000-0000-4000-8000-000000000002","role":"authenticated","session_id":"69001000-0000-4000-8000-000000000002"}',
  true
);
select is(
  public.sync_shelf_product(
    '69010000-0000-4000-8000-000000000007',
    'upsert',
    pg_catalog.current_setting('test.core05_enqueued_at'),
    '69020000-0000-4000-8000-000000000001',
    pg_temp.core05_shelf_payload(
      '69020000-0000-4000-8000-000000000001',
      'Cross-owner takeover'
    )
  ) ->> 'code',
  'SHELF_PRODUCT_OWNERSHIP_CONFLICT',
  'a second owner cannot take over a globally stable product identity'
);
select is(
  public.record_routine_completion(
    '69030000-0000-4000-8000-000000000008',
    '69040000-0000-4000-8000-000000000008',
    'PM',
    '69050000-0000-4000-8000-000000000008',
    '69020000-0000-4000-8000-000000000001',
    8,
    pg_catalog.current_setting('test.core05_completed_at'),
    pg_catalog.current_setting('test.core05_completed_date'),
    'America/Toronto'
  ) ->> 'code',
  'COMPLETION_IDENTITY_CONFLICT',
  'a second owner cannot complete against another owner product identity'
);
select is(
  public.sync_shelf_product(
    '69010000-0000-4000-8000-000000000023',
    'delete',
    pg_catalog.current_setting('test.core05_enqueued_at'),
    '69020000-0000-4000-8000-000000000020',
    null
  ) ->> 'code',
  'SHELF_PRODUCT_OWNERSHIP_CONFLICT',
  'a second owner cannot claim or delete a deletion-wins tombstone'
);
reset role;
select pg_catalog.set_config(
  'test.core05_user2_shelf_receipt_total',
  (
    select pg_catalog.count(*)::text
      from private.shelf_sync_operations as receipts
     where receipts.user_id =
       '69000000-0000-4000-8000-000000000002'
  ),
  true
);
select pg_catalog.set_config(
  'test.core05_user2_completion_receipt_total',
  (
    select pg_catalog.count(*)::text
      from private.routine_completion_sync_operations as receipts
     where receipts.user_id =
       '69000000-0000-4000-8000-000000000002'
  ),
  true
);
set local role authenticated;
select ok(
  (
    select pg_catalog.bool_and(
      exported.user_id = '69000000-0000-4000-8000-000000000002'
      and exported.export_total_count =
        pg_catalog.current_setting(
          'test.core05_user2_shelf_receipt_total'
        )::bigint
    )
      from public.export_shelf_sync_receipts_for_subject(
        null, null, 500
      ) as exported
  )
  and (
    select pg_catalog.bool_and(
      exported.user_id = '69000000-0000-4000-8000-000000000002'
      and exported.export_total_count =
        pg_catalog.current_setting(
          'test.core05_user2_completion_receipt_total'
        )::bigint
    )
      from public.export_routine_completion_sync_receipts_for_subject(
        null, null, 500
      ) as exported
  ),
  'a second subject can export only that subject''s own minimized receipts'
);
reset role;

insert into public.account_deletion_operations (
  id,
  user_id,
  idempotency_digest,
  capability_digest,
  expires_at
) values (
  '69060000-0000-4000-8000-000000000002',
  '69000000-0000-4000-8000-000000000002',
  repeat('a', 64),
  repeat('b', 64),
  pg_catalog.statement_timestamp() + interval '1 day'
);
insert into public.account_deletion_barriers (
  user_id,
  operation_id,
  expires_at
) values (
  '69000000-0000-4000-8000-000000000002',
  '69060000-0000-4000-8000-000000000002',
  pg_catalog.statement_timestamp() + interval '1 day'
);
set local role authenticated;
select throws_ok(
  $$select * from public.export_shelf_product_identities_for_subject(
      null, null, 500
    )$$,
  '42501',
  'ACCOUNT_ACCESS_DENIED',
  'an account-deletion barrier denies sealed health-sync export'
);
reset role;
delete from public.account_deletion_operations
 where id = '69060000-0000-4000-8000-000000000002';

set local role authenticated;
do $$
begin
  perform *
    from public.begin_health_data_consent_withdrawal(
      1,
      repeat('e', 64),
      'draft-v1-2026-07-10',
      '5200ef21982670cf73539d8a7d3e0f9c2219b40ee8d63be0a83d3e10043ba37f'
    );
end;
$$;
select throws_ok(
  $$select * from public.export_shelf_product_identities_for_subject(
      null, null, 500
    )$$,
  '55000',
  'HEALTH_SYNC_EXPORT_WITHDRAWAL_IN_PROGRESS',
  'the export owner lock and lifecycle gate reject an in-progress withdrawal'
);
reset role;
select pg_catalog.set_config(
  'test.core05_user2_withdrawal_operation',
  (
    select current_operation_id::text
      from public.health_processing_states
     where user_id = '69000000-0000-4000-8000-000000000002'
  ),
  true
);
set local role service_role;
do $$
begin
  perform *
    from public.claim_health_consent_withdrawal_for_owner(
      '69000000-0000-4000-8000-000000000002',
      pg_catalog.current_setting(
        'test.core05_user2_withdrawal_operation'
      )::uuid,
      repeat('f', 64)
    );
  perform *
    from public.prepare_health_data_consent_withdrawal(
      pg_catalog.current_setting(
        'test.core05_user2_withdrawal_operation'
      )::uuid,
      repeat('f', 64)
    );
  perform *
    from public.complete_health_data_consent_withdrawal(
      pg_catalog.current_setting(
        'test.core05_user2_withdrawal_operation'
      )::uuid,
      repeat('f', 64)
    );
end;
$$;
reset role;
insert into private.shelf_sync_operations (
  operation_id,
  user_id,
  request_sha256,
  state,
  result_code,
  finalized_at
) values (
  '69010000-0000-4000-8000-000000000099',
  '69000000-0000-4000-8000-000000000002',
  repeat('c', 64),
  'terminal',
  'SHELF_PRODUCT_OWNERSHIP_CONFLICT',
  pg_catalog.statement_timestamp()
);
set local role authenticated;
select throws_ok(
  $$select * from public.export_shelf_sync_receipts_for_subject(
      null, null, 500
    )$$,
  '55000',
  'HEALTH_SYNC_EXPORT_NONACTIVE_RESIDUE',
  'a withdrawn lifecycle fails closed if a sealed source has synthetic residue'
);
reset role;
delete from private.shelf_sync_operations
 where operation_id = '69010000-0000-4000-8000-000000000099';
set local role authenticated;
select is(
  (
    select pg_catalog.count(*)
      from public.export_shelf_sync_receipts_for_subject(
        null, null, 500
      )
  ),
  0::bigint,
  'a withdrawn lifecycle exports an exact verified zero for a clean sealed source'
);
reset role;

-- Synchronous withdrawal clears replay authority; the established service
-- worker path then proves identities and relational health data reach zero.
select pg_catalog.set_config(
  'request.jwt.claims',
  '{"sub":"69000000-0000-4000-8000-000000000001","role":"authenticated","session_id":"69001000-0000-4000-8000-000000000001"}',
  true
);
select lives_ok(
  $$select * from public.begin_health_data_consent_withdrawal(
      1,
      repeat('8', 64),
      'draft-v1-2026-07-10',
      '5200ef21982670cf73539d8a7d3e0f9c2219b40ee8d63be0a83d3e10043ba37f'
    )$$,
  'health consent withdrawal begins through the canonical owner RPC'
);
reset role;
select is(
  (
    select count(*)
      from private.shelf_sync_operations
     where user_id = '69000000-0000-4000-8000-000000000001'
  ) + (
    select count(*)
      from private.routine_completion_sync_operations
     where user_id = '69000000-0000-4000-8000-000000000001'
  ),
  0::bigint,
  'withdrawal synchronously erases both minimized replay ledgers'
);
select pg_catalog.set_config(
  'test.core05_withdrawal_operation',
  (
    select current_operation_id::text
      from public.health_processing_states
     where user_id = '69000000-0000-4000-8000-000000000001'
  ),
  true
);
set local role service_role;
select lives_ok(
  $$select * from public.claim_health_consent_withdrawal_for_owner(
      '69000000-0000-4000-8000-000000000001',
      pg_catalog.current_setting('test.core05_withdrawal_operation')::uuid,
      repeat('9', 64)
    );
    select * from public.prepare_health_data_consent_withdrawal(
      pg_catalog.current_setting('test.core05_withdrawal_operation')::uuid,
      repeat('9', 64)
    );
    select * from public.complete_health_data_consent_withdrawal(
      pg_catalog.current_setting('test.core05_withdrawal_operation')::uuid,
      repeat('9', 64)
    )$$,
  'the canonical service worker completes database health erasure'
);
reset role;
select ok(
  not public._health_relational_data_exists(
    '69000000-0000-4000-8000-000000000001'
  )
  and not exists (
    select 1
      from public.shelf_product_identities
     where user_id = '69000000-0000-4000-8000-000000000001'
  ),
  'zero-attestation proves stable identities and all relational health data erased'
);
set local role authenticated;
select pg_catalog.set_config(
  'request.jwt.claims',
  '{"sub":"69000000-0000-4000-8000-000000000001","role":"authenticated","session_id":"69001000-0000-4000-8000-000000000001"}',
  true
);
select is(
  (
    select pg_catalog.count(*)
      from public.export_shelf_product_identities_for_subject(
        null, null, 500
      )
  ) + (
    select pg_catalog.count(*)
      from public.export_shelf_sync_receipts_for_subject(
        null, null, 500
      )
  ) + (
    select pg_catalog.count(*)
      from public.export_routine_completion_sync_receipts_for_subject(
        null, null, 500
      )
  ),
  0::bigint,
  'all sealed health-sync exports verify exact zero after canonical withdrawal purge'
);
reset role;
do $$
begin
  perform *
    from public.close_health_consent_copy_for_emergency(
      'health_data_collection',
      'grant',
      'draft-v1-2026-07-10',
      '7957a2811fff0e8cefc6f7180b751ec45688fe99421978eedae05b96c2f251fd',
      'PGTAP-CORE05-0069-STALE-GRANT',
      'pgtap.db-owner',
      repeat('d', 64)
    );
end;
$$;
set local role authenticated;
select pg_catalog.set_config(
  'request.jwt.claims',
  '{"sub":"69000000-0000-4000-8000-000000000004","role":"authenticated","session_id":"69001000-0000-4000-8000-000000000004"}',
  true
);
select pg_catalog.set_config(
  'request.headers',
  '{"x-health-processing-epoch":"1"}',
  true
);
select throws_ok(
  $$select public.sync_shelf_product(
      '69010000-0000-4000-8000-000000000040',
      'delete',
      '2026-07-26T12:00:00.000Z',
      '69020000-0000-4000-8000-000000000040',
      null
    )$$,
  '55000',
  'HEALTH_PROCESSING_CONSENT_STALE',
  'Shelf sync rejects a formerly active epoch after its exact grant closes'
);
select throws_ok(
  $$select public.record_routine_completion(
      '69030000-0000-4000-8000-000000000040',
      '69040000-0000-4000-8000-000000000040',
      'PM',
      null,
      null,
      null,
      '2026-07-26T12:00:00.000Z',
      '2026-07-26',
      'America/Toronto'
    )$$,
  '55000',
  'HEALTH_PROCESSING_CONSENT_STALE',
  'completion sync rejects a formerly active epoch after its exact grant closes'
);
reset role;
select is(
  (
    select pg_catalog.count(*)
      from private.shelf_sync_operations
     where user_id = '69000000-0000-4000-8000-000000000004'
  ) + (
    select pg_catalog.count(*)
      from private.routine_completion_sync_operations
     where user_id = '69000000-0000-4000-8000-000000000004'
  ) + (
    select pg_catalog.count(*)
      from public.shelf_product_identities
     where user_id = '69000000-0000-4000-8000-000000000004'
  ) + (
    select pg_catalog.count(*)
      from public.routine_completions
     where user_id = '69000000-0000-4000-8000-000000000004'
  ),
  0::bigint,
  'closed-grant sync attempts leave operation, identity, and completion state empty'
);

select * from finish();
rollback;
