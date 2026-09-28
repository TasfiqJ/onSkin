begin;

-- plpgsql_check cannot statically resolve a pg_temp relation that is created
-- inside the same PL/pgSQL invocation. Its documented PRAGMA:TABLE directive
-- supplies an ephemeral checker-only relation shape. `PERFORM '<literal>'` is a
-- harmless constant expression at runtime, so this keeps the release wrapper
-- free of any production dependency on the plpgsql_check extension while still
-- allowing every other statement in the function to be linted.
create or replace function public.release_catalog_launch_curation_campaign(
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
language plpgsql
volatile
security definer
set search_path = ''
as $function$
declare
  v_cache_key text := gen_random_uuid()::text;
  v_previous_cache_key text := pg_catalog.current_setting(
    'app.catalog_launch_curation_release_validation_cache', true
  );
begin
  -- Checker-only shape for the runtime-created table below. The shorter
  -- literal PRAGMA syntax is intentionally used so hosted runtime does not
  -- require the plpgsql_check extension.
  perform 'PRAGMA:TABLE: pg_temp.catalog_launch_curation_release_validation_cache (cache_key text, record_id uuid, activation_decision text, structurally_valid boolean, live_valid boolean)';

  -- Preserve 0058 input errors for a null campaign without attempting a null
  -- advisory lock.
  if p_campaign_id is null then
    return query
    select *
    from public.release_catalog_launch_curation_campaign_v0058(
      p_campaign_id,
      p_operation_key,
      p_actor,
      p_reason_code,
      p_expected_campaign_sha256,
      p_expected_record_set_sha256,
      p_expected_served_state_mutation_root_set_sha256,
      p_expected_authorization_set_sha256
    );
    return;
  end if;

  perform pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended('catalog-launch-curation-global', 0)
  );
  perform pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended(
      'catalog-launch-curation-campaign:' || p_campaign_id::text,
      0
    )
  );

  -- Replay performs no per-record activation loop, so retain its original
  -- checks directly and avoid building an unnecessary cache.
  if exists (
    select 1
    from private.catalog_launch_curation_campaign_release_events as event
    where event.operation_key = p_operation_key
  ) then
    return query
    select *
    from public.release_catalog_launch_curation_campaign_v0058(
      p_campaign_id,
      p_operation_key,
      p_actor,
      p_reason_code,
      p_expected_campaign_sha256,
      p_expected_record_set_sha256,
      p_expected_served_state_mutation_root_set_sha256,
      p_expected_authorization_set_sha256
    );
    return;
  end if;

  drop table if exists pg_temp.catalog_launch_curation_release_validation_cache;
  create temporary table catalog_launch_curation_release_validation_cache (
    cache_key text not null,
    record_id uuid primary key,
    activation_decision text not null,
    structurally_valid boolean not null,
    live_valid boolean not null
  ) on commit drop;

  insert into pg_temp.catalog_launch_curation_release_validation_cache (
    cache_key,
    record_id,
    activation_decision,
    structurally_valid,
    live_valid
  )
  select
    v_cache_key,
    validity.record_id,
    validity.activation_decision,
    validity.structurally_valid,
    validity.live_valid
  from private.catalog_launch_curation_campaign_record_validity(
    p_campaign_id
  ) as validity;

  perform pg_catalog.set_config(
    'app.catalog_launch_curation_release_validation_cache',
    v_cache_key,
    true
  );

  return query
  select *
  from public.release_catalog_launch_curation_campaign_v0058(
    p_campaign_id,
    p_operation_key,
    p_actor,
    p_reason_code,
    p_expected_campaign_sha256,
    p_expected_record_set_sha256,
    p_expected_served_state_mutation_root_set_sha256,
    p_expected_authorization_set_sha256
  );

  perform pg_catalog.set_config(
    'app.catalog_launch_curation_release_validation_cache',
    coalesce(v_previous_cache_key, ''),
    true
  );
  drop table if exists pg_temp.catalog_launch_curation_release_validation_cache;
  return;
exception when others then
  perform pg_catalog.set_config(
    'app.catalog_launch_curation_release_validation_cache',
    coalesce(v_previous_cache_key, ''),
    true
  );
  drop table if exists pg_temp.catalog_launch_curation_release_validation_cache;
  raise;
end;
$function$;

comment on function public.release_catalog_launch_curation_campaign(
  uuid,
  text,
  text,
  text,
  text,
  text,
  text,
  text
) is
  'Migration-owner-only atomic US campaign release with one exact materialized validation pass, retained 0058 transition/replay contract, and checker-only ephemeral pg_temp shape.';

revoke all on function public.release_catalog_launch_curation_campaign(
  uuid,
  text,
  text,
  text,
  text,
  text,
  text,
  text
)
  from public, anon, authenticated, service_role;

do $verification$
declare
  v_release constant regprocedure :=
    'public.release_catalog_launch_curation_campaign(uuid,text,text,text,text,text,text,text)'::regprocedure;
  v_definition text;
begin
  select pg_catalog.lower(pg_catalog.pg_get_functiondef(procedure.oid))
  into v_definition
  from pg_catalog.pg_proc as procedure
  where procedure.oid = v_release;

  if v_definition is null
     or pg_catalog.strpos(
       v_definition,
       'pragma:table: pg_temp.catalog_launch_curation_release_validation_cache'
     ) = 0
     or pg_catalog.strpos(
       v_definition,
       'create temporary table catalog_launch_curation_release_validation_cache'
     ) = 0
     or pg_catalog.strpos(
       v_definition,
       'release_catalog_launch_curation_campaign_v0058'
     ) = 0
     or pg_catalog.strpos(v_definition, 'plpgsql_check_pragma') > 0 then
    raise exception 'CATALOG_RELEASE_TEMP_TABLE_LINT_SCOPE_INVALID'
      using errcode = '55000';
  end if;

  if not exists (
    select 1
    from pg_catalog.pg_proc as procedure
    where procedure.oid = v_release
      and procedure.proowner = 'postgres'::regrole
      and procedure.prosecdef
      and procedure.provolatile = 'v'
      and procedure.proconfig @> array['search_path=""']::text[]
      and not pg_catalog.has_function_privilege(
        'anon',
        procedure.oid,
        'EXECUTE'
      )
      and not pg_catalog.has_function_privilege(
        'authenticated',
        procedure.oid,
        'EXECUTE'
      )
      and not pg_catalog.has_function_privilege(
        'service_role',
        procedure.oid,
        'EXECUTE'
      )
  ) then
    raise exception 'CATALOG_RELEASE_TEMP_TABLE_LINT_POSTURE_INVALID'
      using errcode = '42501';
  end if;

  if (
    select pg_catalog.count(*)
    from pg_catalog.pg_proc as procedure
    join pg_catalog.pg_namespace as namespace
      on namespace.oid = procedure.pronamespace
    where namespace.nspname = 'public'
      and pg_catalog.lower(procedure.prosrc) like
        '%pragma:table: pg_temp.catalog_launch_curation_release_validation_cache%'
  ) <> 1 then
    raise exception 'CATALOG_RELEASE_TEMP_TABLE_LINT_EXCEPTION_NOT_EXACT'
      using errcode = '55000';
  end if;
end;
$verification$;

commit;
