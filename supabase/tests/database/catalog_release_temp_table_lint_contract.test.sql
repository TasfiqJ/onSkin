begin;

create extension if not exists pgtap with schema extensions;
set local search_path = extensions, public, pg_catalog;

select plan(7);

select is(
  (select count(*) from supabase_migrations.schema_migrations),
  66::bigint,
  'the catalog release lint contract runs against the exact 66-migration source history'
);

select is(
  (select max(version) from supabase_migrations.schema_migrations),
  '20260726000067'::text,
  'the migration history reaches the exact temporary-table lint contract head'
);

select ok(
  (
    select
      procedure.proowner = 'postgres'::regrole
      and procedure.prosecdef
      and procedure.provolatile = 'v'
      and procedure.proconfig @> array['search_path=""']::text[]
    from pg_catalog.pg_proc as procedure
    where procedure.oid =
      'public.release_catalog_launch_curation_campaign(uuid,text,text,text,text,text,text,text)'::regprocedure
  ),
  'the exact migration-owner release wrapper retains its security posture'
);

select is(
  (
    select count(*)
    from pg_catalog.pg_proc as procedure
    join pg_catalog.pg_namespace as namespace
      on namespace.oid = procedure.pronamespace
    where namespace.nspname = 'public'
      and pg_catalog.lower(procedure.prosrc) like
        '%pragma:table: pg_temp.catalog_launch_curation_release_validation_cache%'
  ),
  1::bigint,
  'only the exact temporary-table wrapper carries the checker shape'
);

select ok(
  (
    select
      position(
        'create temporary table catalog_launch_curation_release_validation_cache'
        in pg_catalog.lower(pg_catalog.pg_get_functiondef(procedure.oid))
      ) > 0
      and position(
        'insert into pg_temp.catalog_launch_curation_release_validation_cache'
        in pg_catalog.lower(pg_catalog.pg_get_functiondef(procedure.oid))
      ) > 0
      and position(
        'release_catalog_launch_curation_campaign_v0058'
        in pg_catalog.lower(pg_catalog.pg_get_functiondef(procedure.oid))
      ) > 0
      and position(
        'plpgsql_check_pragma'
        in pg_catalog.lower(pg_catalog.pg_get_functiondef(procedure.oid))
      ) = 0
    from pg_catalog.pg_proc as procedure
    where procedure.oid =
      'public.release_catalog_launch_curation_campaign(uuid,text,text,text,text,text,text,text)'::regprocedure
  ),
  'the wrapper retains the governed runtime cache path without a linter-extension runtime dependency'
);

select ok(
  not exists (
    select 1
    from (values
      ('anon'),
      ('authenticated'),
      ('service_role')
    ) as api_role(role_name)
    where pg_catalog.has_function_privilege(
      api_role.role_name,
      'public.release_catalog_launch_curation_campaign(uuid,text,text,text,text,text,text,text)'::regprocedure,
      'EXECUTE'
    )
  ),
  'no API role can execute the migration-owner release wrapper'
);

select is(
  (
    select count(*)
    from pg_catalog.pg_proc as procedure
    where procedure.oid =
      'public.release_catalog_launch_curation_campaign(uuid,text,text,text,text,text,text,text)'::regprocedure
      and pg_catalog.lower(procedure.prosrc) like
        '%perform ''pragma:table: pg_temp.catalog_launch_curation_release_validation_cache%'
  ),
  1::bigint,
  'the checker directive is a harmless runtime string literal'
);

select * from finish();
rollback;
