\set ON_ERROR_STOP on

-- Minimal forward-upgrade rehearsal for an already-migrated CAT-03 database.
-- It executes the checked-in 0062 bytes, then proves the exact index and
-- trigger contracts without reproducing the full 2,001-record pgTAP corpus.
do $$
begin
  if not exists (select 1 from pg_catalog.pg_roles where rolname = 'anon') then
    create role anon nologin;
  end if;
  if not exists (
    select 1 from pg_catalog.pg_roles where rolname = 'authenticated'
  ) then
    create role authenticated nologin;
  end if;
  if not exists (
    select 1 from pg_catalog.pg_roles where rolname = 'service_role'
  ) then
    create role service_role nologin bypassrls;
  end if;
end;
$$;

create schema private;

create table private.catalog_import_staged_records (
  id uuid primary key,
  batch_id uuid not null,
  record_sha256 text not null,
  record_ordinal integer not null
);

create table private.catalog_import_entity_revisions (
  id uuid primary key,
  batch_id uuid not null,
  staged_record_id uuid,
  promotion_event_id uuid not null,
  entity_type text not null,
  entity_id text not null,
  revision_action text not null,
  projection_sha256 text not null
);

create table private.catalog_import_batch_effects (
  id uuid primary key,
  batch_id uuid not null,
  staged_record_id uuid,
  promotion_event_id uuid not null,
  entity_type text not null,
  entity_id text not null,
  effect_type text not null,
  after_sha256 text not null
);

create table private.catalog_launch_curation_campaigns (
  id uuid primary key,
  expected_reviewed_record_count integer not null,
  served_state_mutation_root_set_sha256 text not null
);

create table private.catalog_launch_curation_records (
  id uuid primary key,
  campaign_id uuid not null references private.catalog_launch_curation_campaigns (id),
  product_id uuid not null,
  import_staged_record_id uuid,
  served_state_mutation_root_sha256 text not null,
  structural_ok boolean not null default true
);

create table private.catalog_launch_curation_campaign_release_events (
  id uuid primary key,
  new_campaign_id uuid not null
    references private.catalog_launch_curation_campaigns (id)
);

create table private.rehearsal_0062_product_roots (
  product_id uuid primary key,
  mutation_root_sha256 text not null
);

create function private.catalog_launch_current_served_state_mutation_root_sha256(
  p_product_id uuid
)
returns text
language sql
stable
set search_path = ''
as $$
  select root.mutation_root_sha256
  from private.rehearsal_0062_product_roots as root
  where root.product_id = p_product_id
$$;

create function private.catalog_launch_curation_record_is_structurally_valid(
  p_record_id uuid
)
returns boolean
language sql
stable
set search_path = ''
as $$
  select coalesce((
    select record.structural_ok
    from private.catalog_launch_curation_records as record
    where record.id = p_record_id
  ), false)
$$;

create function private.catalog_launch_curation_record_is_valid(
  p_record_id uuid
)
returns boolean
language sql
stable
set search_path = ''
as $$
  select private.catalog_launch_curation_record_is_structurally_valid(
    p_record_id
  )
$$;

create function public.release_catalog_launch_curation_campaign(
  p_campaign_id uuid,
  p_operation_key text,
  p_actor text,
  p_reason_code text,
  p_expected_campaign_sha256 text,
  p_expected_record_set_sha256 text,
  p_expected_served_state_mutation_root_set_sha256 text,
  p_expected_authorization_set_sha256 text
)
returns table (
  campaign_id uuid,
  release_event_id uuid,
  head_generation integer,
  replayed boolean,
  cat02_membership_proof_sha256 text,
  cat02_database_observation_sha256 text,
  cat02_verifier_signature_set_sha256 text,
  cat02_production_integrity_set_sha256 text,
  curation_outcome_reviewer_signature_set_sha256 text,
  served_state_mutation_root_set_sha256 text
)
language sql
volatile
security definer
set search_path = ''
as $$
  select
    p_campaign_id,
    null::uuid,
    1,
    false,
    pg_catalog.repeat('1', 64),
    pg_catalog.repeat('2', 64),
    pg_catalog.repeat('3', 64),
    pg_catalog.repeat('4', 64),
    pg_catalog.repeat('5', 64),
    pg_catalog.repeat('6', 64)
  where false
$$;

create function
  private.catalog_launch_curation_campaign_stored_mutation_root_set_sha256(
    p_campaign_id uuid
  )
returns text
language sql
stable
set search_path = ''
as $$
  select pg_catalog.repeat(
    (pg_catalog.count(*)::integer % 10)::text,
    64
  )
  from private.catalog_launch_curation_records as record
  where record.campaign_id = p_campaign_id
$$;

-- 0062 replaces this exact 0058 signature. Function-body checking is disabled
-- only for this disposable fixture because the replacement's retained-
-- authority tables are exercised by the full pgTAP suite, while this rehearsal
-- is scoped to upgrade mechanics and the new statement guard.
set check_function_bodies = off;
create function private.catalog_launch_curation_membership_evidence_sha256(
  uuid, uuid, text, text, text, text, uuid, text, text, text, text, text
)
returns text
language sql
stable
security definer
set search_path = ''
as $$ select null::text $$;

grant execute on function
  private.catalog_launch_curation_membership_evidence_sha256(
    uuid, uuid, text, text, text, text, uuid, text, text, text, text, text
  )
  to authenticated, service_role;

do $$
begin
  if not pg_catalog.has_function_privilege(
    'anon',
    'private.catalog_launch_curation_membership_evidence_sha256(uuid,uuid,text,text,text,text,uuid,text,text,text,text,text)',
    'EXECUTE'
  )
    or not pg_catalog.has_function_privilege(
      'authenticated',
      'private.catalog_launch_curation_membership_evidence_sha256(uuid,uuid,text,text,text,text,uuid,text,text,text,text,text)',
      'EXECUTE'
    )
    or not pg_catalog.has_function_privilege(
      'service_role',
      'private.catalog_launch_curation_membership_evidence_sha256(uuid,uuid,text,text,text,text,uuid,text,text,text,text,text)',
      'EXECUTE'
    ) then
    raise exception 'CATALOG_0062_PRE_UPGRADE_EXECUTE_GRANT_MISSING';
  end if;
end
$$;

create function private.guard_catalog_launch_curation_record_insert()
returns trigger
language plpgsql
volatile
security definer
set search_path = ''
as $$
begin
  return new;
end;
$$;

create trigger catalog_launch_curation_records_insert_guard
  after insert on private.catalog_launch_curation_records
  for each row execute function
    private.guard_catalog_launch_curation_record_insert();

-- Execute the exact checked-in forward migration bytes.
\ir ../../supabase/migrations/20260722000062_catalog_curation_statement_guard.sql
set check_function_bodies = on;

do $$
declare
  v_membership_definition text := pg_catalog.lower(
    pg_catalog.pg_get_functiondef(
      'private.catalog_launch_curation_membership_evidence_sha256(uuid,uuid,text,text,text,text,uuid,text,text,text,text,text)'::regprocedure
    )
  );
  v_campaign_validity_definition text := pg_catalog.lower(
    pg_catalog.pg_get_functiondef(
      'private.catalog_launch_curation_campaign_record_validity(uuid)'::regprocedure
    )
  );
  v_release_definition text := pg_catalog.lower(
    pg_catalog.pg_get_functiondef(
      'public.release_catalog_launch_curation_campaign(uuid,text,text,text,text,text,text,text)'::regprocedure
    )
  );
  v_structural_wrapper_definition text := pg_catalog.lower(
    pg_catalog.pg_get_functiondef(
      'private.catalog_launch_curation_record_is_structurally_valid(uuid)'::regprocedure
    )
  );
begin
  if (
    select pg_catalog.count(*)
    from pg_catalog.pg_index as index_row
    where index_row.indexrelid in (
      'private.catalog_import_staged_records_batch_record_sha256_idx'::regclass,
      'private.catalog_import_entity_revisions_membership_authority_idx'::regclass,
      'private.catalog_import_batch_effects_membership_authority_idx'::regclass
    )
      and index_row.indisvalid
      and index_row.indisready
      and not index_row.indisunique
      and index_row.indpred is null
      and index_row.indexprs is null
  ) <> 3 then
    raise exception 'CATALOG_0062_EXACT_INDEX_METADATA_INVALID';
  end if;

  if pg_catalog.pg_get_indexdef(
       'private.catalog_import_staged_records_batch_record_sha256_idx'::regclass
     ) not like '%(batch_id, record_sha256)%'
     or pg_catalog.pg_get_indexdef(
       'private.catalog_import_entity_revisions_membership_authority_idx'::regclass
     ) not like
       '%(batch_id, staged_record_id, entity_type, entity_id, revision_action) INCLUDE (projection_sha256)%'
     or pg_catalog.pg_get_indexdef(
       'private.catalog_import_batch_effects_membership_authority_idx'::regclass
     ) not like
       '%(staged_record_id, batch_id, promotion_event_id, entity_type, entity_id, effect_type) INCLUDE (after_sha256)%' then
    raise exception 'CATALOG_0062_EXACT_INDEX_DEFINITION_INVALID';
  end if;

  if position(
       'staged.record_sha256 = p_cat02_stage_record_sha256'
       in v_membership_definition
     ) = 0 then
    raise exception 'CATALOG_0062_STAGED_DIGEST_PUSHDOWN_MISSING';
  end if;

  if position(
       'campaign_authority as materialized'
       in v_campaign_validity_definition
     ) = 0
     or position(
       'approved_sources as materialized'
       in v_campaign_validity_definition
     ) = 0
     or position(
       'structurally_valid_records as materialized'
       in v_campaign_validity_definition
     ) = 0
     or position(
       'live_valid_records as materialized'
       in v_campaign_validity_definition
     ) = 0
     or position(
       'cardinality(record.regulatory_reviewer_ids) = 1'
       in v_campaign_validity_definition
     ) = 0
     or position(
       'catalog_launch_curation_campaign_record_validity'
       in v_release_definition
     ) = 0
     or position(
       'release_catalog_launch_curation_campaign_v0058'
       in v_release_definition
     ) = 0
     or position(
       'catalog_launch_curation_release_validation_cache'
       in v_structural_wrapper_definition
     ) = 0
     or position('session_user' in v_structural_wrapper_definition) = 0 then
    raise exception 'CATALOG_0062_SET_VALIDATION_WRAPPER_INVALID';
  end if;

  if (
    select pg_catalog.count(*)
    from pg_catalog.pg_trigger as trigger_row
    where trigger_row.tgrelid =
        'private.catalog_launch_curation_records'::regclass
      and trigger_row.tgname in (
        'catalog_launch_curation_records_insert_guard',
        'catalog_launch_curation_records_insert_statement_guard'
      )
      and trigger_row.tgenabled = 'O'
      and not trigger_row.tgisinternal
  ) <> 2 or not exists (
    select 1
    from pg_catalog.pg_trigger as trigger_row
    where trigger_row.tgrelid =
        'private.catalog_launch_curation_records'::regclass
      and trigger_row.tgname =
        'catalog_launch_curation_records_insert_guard'
      and trigger_row.tgfoid =
        'private.guard_catalog_launch_curation_record_insert()'::regprocedure
      and (trigger_row.tgtype & 1) = 1
      and (trigger_row.tgtype & 2) = 0
      and (trigger_row.tgtype & 4) = 4
  ) or not exists (
    select 1
    from pg_catalog.pg_trigger as trigger_row
    where trigger_row.tgrelid =
        'private.catalog_launch_curation_records'::regclass
      and trigger_row.tgname =
        'catalog_launch_curation_records_insert_statement_guard'
      and trigger_row.tgfoid =
        'private.guard_catalog_launch_curation_record_insert_statement()'::regprocedure
      and (trigger_row.tgtype & 1) = 0
      and (trigger_row.tgtype & 2) = 0
      and (trigger_row.tgtype & 4) = 4
      and trigger_row.tgnewtable = 'inserted_catalog_curation_records'
      and trigger_row.tgoldtable is null
  ) then
    raise exception 'CATALOG_0062_TRIGGER_METADATA_INVALID';
  end if;

  if exists (
    select 1
    from pg_catalog.pg_proc as procedure
    cross join lateral pg_catalog.aclexplode(
      coalesce(
        procedure.proacl,
        pg_catalog.acldefault('f', procedure.proowner)
      )
    ) as privilege
    where procedure.oid in (
      'private.catalog_launch_curation_membership_evidence_sha256(uuid,uuid,text,text,text,text,uuid,text,text,text,text,text)'::regprocedure,
      'private.catalog_launch_curation_campaign_record_validity(uuid)'::regprocedure,
      'private.catalog_launch_curation_record_is_structurally_valid(uuid)'::regprocedure,
      'private.catalog_launch_curation_record_is_structurally_valid_v0058(uuid)'::regprocedure,
      'private.catalog_launch_curation_record_is_valid(uuid)'::regprocedure,
      'private.catalog_launch_curation_record_is_valid_v0058(uuid)'::regprocedure,
      'private.guard_catalog_launch_curation_record_insert()'::regprocedure,
      'private.guard_catalog_launch_curation_record_insert_statement()'::regprocedure,
      'public.release_catalog_launch_curation_campaign(uuid,text,text,text,text,text,text,text)'::regprocedure,
      'public.release_catalog_launch_curation_campaign_v0058(uuid,text,text,text,text,text,text,text)'::regprocedure
    )
      and privilege.grantee in (
        0,
        'anon'::regrole::oid,
        'authenticated'::regrole::oid,
        'service_role'::regrole::oid
      )
      and privilege.privilege_type = 'EXECUTE'
  ) then
    raise exception 'CATALOG_0062_GUARD_ACL_INVALID';
  end if;
end;
$$;

insert into private.catalog_launch_curation_campaigns (
  id, expected_reviewed_record_count, served_state_mutation_root_set_sha256
) values
  ('62000000-0000-4000-8000-000000000001', 2, pg_catalog.repeat('2', 64)),
  ('62000000-0000-4000-8000-000000000002', 1, pg_catalog.repeat('f', 64)),
  ('62000000-0000-4000-8000-000000000003', 1, pg_catalog.repeat('1', 64)),
  ('62000000-0000-4000-8000-000000000004', 1, pg_catalog.repeat('1', 64)),
  ('62000000-0000-4000-8000-000000000005', 1, pg_catalog.repeat('1', 64));

insert into private.rehearsal_0062_product_roots (
  product_id, mutation_root_sha256
)
select
  ('63000000-0000-4000-8000-' || pg_catalog.lpad(ordinal::text, 12, '0'))::uuid,
  pg_catalog.repeat('a', 64)
from pg_catalog.generate_series(1, 8) as fixture(ordinal);

insert into private.catalog_launch_curation_campaign_release_events (
  id, new_campaign_id
) values (
  '64000000-0000-4000-8000-000000000001',
  '62000000-0000-4000-8000-000000000004'
);

-- Empty INSERT ... SELECT is a bounded statement-level no-op.
insert into private.catalog_launch_curation_records (
  id, campaign_id, product_id, served_state_mutation_root_sha256
)
select
  '65000000-0000-4000-8000-000000000000',
  '62000000-0000-4000-8000-000000000001',
  '63000000-0000-4000-8000-000000000001',
  pg_catalog.repeat('a', 64)
where false;

-- A partial campaign is accepted without prematurely comparing its full root.
insert into private.catalog_launch_curation_records (
  id, campaign_id, product_id, served_state_mutation_root_sha256
) values (
  '65000000-0000-4000-8000-000000000001',
  '62000000-0000-4000-8000-000000000001',
  '63000000-0000-4000-8000-000000000001',
  pg_catalog.repeat('a', 64)
);

-- The exact expected count validates the stored mutation-root set once.
insert into private.catalog_launch_curation_records (
  id, campaign_id, product_id, served_state_mutation_root_sha256
) values (
  '65000000-0000-4000-8000-000000000002',
  '62000000-0000-4000-8000-000000000001',
  '63000000-0000-4000-8000-000000000002',
  pg_catalog.repeat('a', 64)
);

do $$
begin
  begin
    insert into private.catalog_launch_curation_records (
      id, campaign_id, product_id, served_state_mutation_root_sha256
    ) values (
      '65000000-0000-4000-8000-000000000003',
      '62000000-0000-4000-8000-000000000001',
      '63000000-0000-4000-8000-000000000003',
      pg_catalog.repeat('a', 64)
    );
    raise exception 'CATALOG_0062_OVERFLOW_ACCEPTED';
  exception when sqlstate '55000' then
    if sqlerrm <> 'CATALOG_LAUNCH_CURATION_SERVED_STATE_MUTATION_ROOT_SET_INVALID' then
      raise;
    end if;
  end;
  if (
    select pg_catalog.count(*)
    from private.catalog_launch_curation_records
    where campaign_id = '62000000-0000-4000-8000-000000000001'
  ) <> 2 then
    raise exception 'CATALOG_0062_OVERFLOW_NOT_ROLLED_BACK';
  end if;

  begin
    insert into private.catalog_launch_curation_records (
      id, campaign_id, product_id, served_state_mutation_root_sha256
    ) values (
      '65000000-0000-4000-8000-000000000004',
      '62000000-0000-4000-8000-000000000002',
      '63000000-0000-4000-8000-000000000004',
      pg_catalog.repeat('a', 64)
    );
    raise exception 'CATALOG_0062_ROOT_MISMATCH_ACCEPTED';
  exception when sqlstate '55000' then
    if sqlerrm <> 'CATALOG_LAUNCH_CURATION_SERVED_STATE_MUTATION_ROOT_SET_INVALID' then
      raise;
    end if;
  end;
  if exists (
    select 1 from private.catalog_launch_curation_records
    where campaign_id = '62000000-0000-4000-8000-000000000002'
  ) then
    raise exception 'CATALOG_0062_ROOT_MISMATCH_NOT_ROLLED_BACK';
  end if;

  begin
    insert into private.catalog_launch_curation_records (
      id, campaign_id, product_id, served_state_mutation_root_sha256
    ) values (
      '65000000-0000-4000-8000-000000000005',
      '62000000-0000-4000-8000-000000000003',
      '63000000-0000-4000-8000-000000000005',
      pg_catalog.repeat('b', 64)
    );
    raise exception 'CATALOG_0062_STALE_ROW_ROOT_ACCEPTED';
  exception when sqlstate '55000' then
    if sqlerrm <> 'CATALOG_LAUNCH_CURATION_SERVED_STATE_MUTATION_ROOT_STALE' then
      raise;
    end if;
  end;

  begin
    insert into private.catalog_launch_curation_records (
      id, campaign_id, product_id, served_state_mutation_root_sha256
    ) values (
      '65000000-0000-4000-8000-000000000006',
      '62000000-0000-4000-8000-000000000004',
      '63000000-0000-4000-8000-000000000006',
      pg_catalog.repeat('a', 64)
    );
    raise exception 'CATALOG_0062_RELEASED_CAMPAIGN_INSERT_ACCEPTED';
  exception when sqlstate '55000' then
    if sqlerrm <> 'CATALOG_LAUNCH_CURATION_RELEASED_CAMPAIGN_SEALED' then
      raise;
    end if;
  end;

  begin
    insert into private.catalog_launch_curation_records (
      id, campaign_id, product_id, served_state_mutation_root_sha256,
      structural_ok
    ) values (
      '65000000-0000-4000-8000-000000000007',
      '62000000-0000-4000-8000-000000000005',
      '63000000-0000-4000-8000-000000000007',
      pg_catalog.repeat('a', 64),
      false
    );
    raise exception 'CATALOG_0062_INVALID_ROW_AUTHORITY_ACCEPTED';
  exception when sqlstate '55000' then
    if sqlerrm <> 'CATALOG_LAUNCH_CURATION_RECORD_GATE_CLOSED' then
      raise;
    end if;
  end;

  if (
    select pg_catalog.count(*)
    from private.catalog_launch_curation_records
  ) <> 2 then
    raise exception 'CATALOG_0062_FAILED_ROW_MUTATION_SURVIVED';
  end if;

  if exists (
    select 1
    from (values
      ('65000000-0000-4000-8000-000000000001'::uuid),
      ('65000000-0000-4000-8000-000000000002'::uuid),
      ('65000000-0000-4000-8000-000000009999'::uuid)
    ) as fixture(record_id)
    where private.catalog_launch_curation_record_is_structurally_valid(
        fixture.record_id
      ) is distinct from
        private.catalog_launch_curation_record_is_structurally_valid_v0058(
          fixture.record_id
        )
       or private.catalog_launch_curation_record_is_valid(
        fixture.record_id
      ) is distinct from
        private.catalog_launch_curation_record_is_valid_v0058(
          fixture.record_id
        )
  ) then
    raise exception 'CATALOG_0062_SCALAR_FALLBACK_PARITY_INVALID';
  end if;
end;
$$;

-- Exercise both cache trust branches with their real session identities. The
-- migration-owner session must consume the transaction-local cache, while an
-- API session may neither execute the owner-only validators directly nor
-- influence them through a same-named temporary table and custom GUC.
begin;

create temporary table catalog_launch_curation_release_validation_cache (
  cache_key text not null,
  record_id uuid primary key,
  activation_decision text not null,
  structurally_valid boolean not null,
  live_valid boolean not null
) on commit drop;

insert into pg_temp.catalog_launch_curation_release_validation_cache (
  cache_key, record_id, activation_decision, structurally_valid, live_valid
) values (
  'catalog-0062-cache-session-proof',
  '65000000-0000-4000-8000-000000000001',
  'approve_activation',
  false,
  false
);

select pg_catalog.set_config(
  'app.catalog_launch_curation_release_validation_cache',
  'catalog-0062-cache-session-proof',
  true
);

do $$
declare
  v_release_owner name;
begin
  select role.rolname into strict v_release_owner
  from pg_catalog.pg_proc as procedure
  join pg_catalog.pg_roles as role on role.oid = procedure.proowner
  where procedure.oid =
    'public.release_catalog_launch_curation_campaign(uuid,text,text,text,text,text,text,text)'::regprocedure;

  if session_user <> v_release_owner
     or private.catalog_launch_curation_record_is_structurally_valid(
       '65000000-0000-4000-8000-000000000001'
     ) is not false
     or private.catalog_launch_curation_record_is_valid(
       '65000000-0000-4000-8000-000000000001'
     ) is not false
     or private.catalog_launch_curation_record_is_structurally_valid_v0058(
       '65000000-0000-4000-8000-000000000001'
     ) is not true then
    raise exception 'CATALOG_0062_MIGRATION_OWNER_CACHE_PATH_INVALID';
  end if;
end;
$$;

create function pg_temp.catalog_0062_api_cache_probe(p_record_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select
    not pg_catalog.has_function_privilege(
      session_user,
      'private.catalog_launch_curation_record_is_structurally_valid(uuid)',
      'EXECUTE'
    )
    and not pg_catalog.has_function_privilege(
      session_user,
      'private.catalog_launch_curation_record_is_valid(uuid)',
      'EXECUTE'
    )
    and private.catalog_launch_curation_record_is_structurally_valid(
      p_record_id
    ) is not distinct from
      private.catalog_launch_curation_record_is_structurally_valid_v0058(
        p_record_id
      )
    and private.catalog_launch_curation_record_is_valid(
      p_record_id
    ) is not distinct from
      private.catalog_launch_curation_record_is_valid_v0058(p_record_id)
$$;

revoke all on function pg_temp.catalog_0062_api_cache_probe(uuid) from public;
grant execute on function pg_temp.catalog_0062_api_cache_probe(uuid)
  to authenticated;

set session authorization authenticated;
select pg_catalog.set_config(
  'app.catalog_0062_api_cache_probe_result',
  pg_temp.catalog_0062_api_cache_probe(
    '65000000-0000-4000-8000-000000000001'
  )::text,
  true
);
reset session authorization;

do $$
begin
  if pg_catalog.current_setting(
    'app.catalog_0062_api_cache_probe_result', true
  ) is distinct from 'true' then
    raise exception 'CATALOG_0062_API_CACHE_POISONING_GUARD_INVALID';
  end if;
end;
$$;

rollback;

select 'catalog-curation-0062-upgrade-postgres-rehearsal: pass' as result;
