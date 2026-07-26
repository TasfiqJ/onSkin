\set ON_ERROR_STOP on

do $roles$
begin
  if not exists (
    select 1 from pg_catalog.pg_roles where rolname = 'anon'
  ) then
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
    create role service_role nologin;
  end if;
  if not exists (
    select 1 from pg_catalog.pg_roles where rolname = 'catalog_operator_edge'
  ) then
    create role catalog_operator_edge nologin;
  end if;
end;
$roles$;

create schema private;
create schema catalog_operator_gateway;

create table private.catalog_operator_work_states (
  item_kind text not null,
  item_id uuid not null,
  primary key (item_kind, item_id)
);

create or replace function catalog_operator_gateway.catalog_operator_transition(
  p_auth_session_id uuid,
  p_edge_environment text,
  p_source_revision text,
  p_edge_deployment_id text,
  p_control_generation bigint,
  p_operation_id uuid,
  p_item_kind text,
  p_item_id uuid,
  p_lease_id uuid,
  p_expected_version bigint,
  p_decision text,
  p_reason_code text,
  p_evidence_sha256 text
)
returns table (
  item_kind text,
  item_id uuid,
  item_version bigint,
  status text,
  hold_id uuid,
  repair_receipt_id uuid,
  event_id uuid
)
language plpgsql
volatile
security definer
set search_path = ''
set timezone = 'UTC'
as $function$
begin
  if p_item_kind = 'correction_report' then
    insert into private.catalog_operator_work_states (
      item_kind,
      item_id
    ) values (
      p_item_kind,
      p_item_id
    ) on conflict (item_kind, item_id) do nothing;
  else
    insert into private.catalog_operator_work_states (
      item_kind,
      item_id
    ) values (
      p_item_kind,
      p_item_id
    ) on conflict (item_kind, item_id) do nothing;
  end if;

  return query select
    p_item_kind,
    p_item_id,
    1::bigint,
    'open'::text,
    null::uuid,
    null::uuid,
    null::uuid;
end;
$function$;

revoke all on function catalog_operator_gateway.catalog_operator_transition(
  uuid, text, text, text, bigint, uuid, text, uuid, uuid, bigint, text, text, text
) from public, anon, authenticated, service_role, catalog_operator_edge;
grant execute on function catalog_operator_gateway.catalog_operator_transition(
  uuid, text, text, text, bigint, uuid, text, uuid, uuid, bigint, text, text, text
) to catalog_operator_edge;

\ir ../../supabase/migrations/20260726000065_catalog_operator_transition_conflict_target.sql

select *
from catalog_operator_gateway.catalog_operator_transition(
  gen_random_uuid(),
  'development',
  repeat('a', 40),
  '0065_rehearsal',
  2,
  gen_random_uuid(),
  'correction_report',
  '65000000-0000-4000-8000-000000000001',
  gen_random_uuid(),
  1,
  'triage',
  'wrong_match_confirmed',
  null
);

select *
from catalog_operator_gateway.catalog_operator_transition(
  gen_random_uuid(),
  'development',
  repeat('a', 40),
  '0065_rehearsal',
  2,
  gen_random_uuid(),
  'catalog_source',
  '65000000-0000-4000-8000-000000000002',
  gen_random_uuid(),
  1,
  'request_changes',
  'rights_gap',
  null
);

do $verification$
declare
  v_transition constant regprocedure :=
    'catalog_operator_gateway.catalog_operator_transition(uuid,text,text,text,bigint,uuid,text,uuid,uuid,bigint,text,text,text)'::regprocedure;
  v_definition text :=
    pg_catalog.pg_get_functiondef(
      'catalog_operator_gateway.catalog_operator_transition(uuid,text,text,text,bigint,uuid,text,uuid,uuid,bigint,text,text,text)'::regprocedure
    );
begin
  if v_definition like '%on conflict (item_kind, item_id) do nothing%'
    or (
      pg_catalog.length(v_definition)
        - pg_catalog.length(pg_catalog.replace(
          v_definition,
          'on conflict on constraint catalog_operator_work_states_pkey do nothing',
          ''
        ))
    ) / pg_catalog.length(
      'on conflict on constraint catalog_operator_work_states_pkey do nothing'
    ) <> 2
  then
    raise exception 'CORE01_0065_CONFLICT_TARGET_REPAIR_INVALID';
  end if;

  if (
    select pg_catalog.count(*) from private.catalog_operator_work_states
  ) <> 2 then
    raise exception 'CORE01_0065_BOTH_TRANSITION_PATHS_NOT_EXECUTABLE';
  end if;

  if not exists (
    select 1
    from pg_catalog.pg_proc as procedure
    where procedure.oid = v_transition
      and procedure.proowner = 'postgres'::regrole
      and procedure.prosecdef
      and procedure.provolatile = 'v'
      and procedure.proconfig @> array[
        'search_path=""',
        'TimeZone=UTC'
      ]::text[]
      and pg_catalog.has_function_privilege(
        'catalog_operator_edge',
        procedure.oid,
        'execute'
      )
      and not pg_catalog.has_function_privilege(
        'service_role',
        procedure.oid,
        'execute'
      )
      and not pg_catalog.has_function_privilege(
        'authenticated',
        procedure.oid,
        'execute'
      )
      and not pg_catalog.has_function_privilege(
        'anon',
        procedure.oid,
        'execute'
      )
  ) then
    raise exception 'CORE01_0065_TRANSITION_SECURITY_POSTURE_INVALID';
  end if;

  if not exists (
    select 1
    from pg_catalog.pg_default_acl as default_acl
    where default_acl.defaclrole = 'postgres'::regrole
      and default_acl.defaclnamespace = 0
      and default_acl.defaclobjtype = 'f'
      and not exists (
        select 1
        from pg_catalog.aclexplode(default_acl.defaclacl) as privilege
        where privilege.grantee = 0
          and privilege.privilege_type = 'EXECUTE'
      )
  ) then
    raise exception 'CORE01_0065_GLOBAL_FUNCTION_DEFAULT_ACL_INVALID';
  end if;
end;
$verification$;

select 'catalog-operator-0065-upgrade-postgres-rehearsal: pass' as result;
