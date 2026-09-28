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
    create role service_role nologin bypassrls;
  end if;
end;
$roles$;

create schema private;

create table private.catalog_launch_curation_campaign_release_events (
  operation_key text
);

create function private.catalog_launch_curation_campaign_record_validity(uuid)
returns table (
  record_id uuid,
  activation_decision text,
  structurally_valid boolean,
  live_valid boolean
)
language sql
stable
set search_path = ''
as $function$
  select null::uuid, null::text, false, false where false
$function$;

create function public.release_catalog_launch_curation_campaign_v0058(
  uuid,
  text,
  text,
  text,
  text,
  text,
  text,
  text
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
set search_path = ''
as $function$
  select
    null::uuid,
    null::uuid,
    0,
    false,
    null::text,
    null::text,
    null::text,
    null::text,
    null::text,
    null::text
$function$;

create function public.release_catalog_launch_curation_campaign(
  uuid,
  text,
  text,
  text,
  text,
  text,
  text,
  text
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
language plpgsql
volatile
security definer
set search_path = ''
as $function$
begin
  return query
  select *
  from public.release_catalog_launch_curation_campaign_v0058(
    null,
    null,
    null,
    null,
    null,
    null,
    null,
    null
  );
end;
$function$;

revoke all on function public.release_catalog_launch_curation_campaign(
  uuid,
  text,
  text,
  text,
  text,
  text,
  text,
  text
) from public, anon, authenticated, service_role;

\ir ../../supabase/migrations/20260726000067_catalog_release_temp_table_lint_contract.sql

do $verification$
declare
  v_release constant regprocedure :=
    'public.release_catalog_launch_curation_campaign(uuid,text,text,text,text,text,text,text)'::regprocedure;
begin
  if not exists (
    select 1
    from pg_catalog.pg_proc as procedure
    where procedure.oid = v_release
      and procedure.proowner = 'postgres'::regrole
      and procedure.prosecdef
      and procedure.provolatile = 'v'
      and procedure.proconfig @> array['search_path=""']::text[]
      and pg_catalog.lower(procedure.prosrc) like
        '%pragma:table: pg_temp.catalog_launch_curation_release_validation_cache%'
  ) then
    raise exception 'CORE02_0067_LINT_CONTRACT_INVALID';
  end if;

  if exists (
    select 1
    from (values
      ('anon'),
      ('authenticated'),
      ('service_role')
    ) as api_role(role_name)
    where pg_catalog.has_function_privilege(
      api_role.role_name,
      v_release,
      'EXECUTE'
    )
  ) then
    raise exception 'CORE02_0067_RELEASE_ACL_DRIFT';
  end if;
end;
$verification$;

select *
from public.release_catalog_launch_curation_campaign(
  null,
  null,
  null,
  null,
  null,
  null,
  null,
  null
);

select 'catalog-release-0067-lint-contract-postgres-rehearsal: pass' as result;
