begin;

create extension if not exists pgtap with schema extensions;
set local search_path = extensions, public, pg_catalog;

select plan(16);

select has_extension('citext', 'the case-insensitive email type dependency is installed');

select is(
  (
    select namespace.nspname
    from pg_extension as extension
    join pg_namespace as namespace on namespace.oid = extension.extnamespace
    where extension.extname = 'citext'
  ),
  'extensions'::name,
  'citext is installed in the pinned local image extension namespace'
);

select is(
  (
    select namespace.nspname
    from pg_extension as extension
    join pg_namespace as namespace on namespace.oid = extension.extnamespace
    where extension.extname = 'pgcrypto'
  ),
  'extensions'::name,
  'pgcrypto remains in the pinned local image extension namespace'
);

select is(
  (select count(*) from supabase_migrations.schema_migrations),
  51::bigint,
  'all 51 repository migrations are recorded'
);

select is(
  (select max(version) from supabase_migrations.schema_migrations),
  '20260713000052'::text,
  'migration history reaches the publication fence'
);

select is(
  (
    select count(*)
    from pg_class as relation
    join pg_namespace as namespace on namespace.oid = relation.relnamespace
    where namespace.nspname = 'public'
      and relation.relkind in ('r', 'p')
  ),
  70::bigint,
  'the migrated public schema has exactly 70 tables'
);

select is(
  (
    select count(*)
    from pg_class as relation
    join pg_namespace as namespace on namespace.oid = relation.relnamespace
    where namespace.nspname = 'public'
      and relation.relkind in ('r', 'p')
      and relation.relrowsecurity
  ),
  70::bigint,
  'row level security is enabled on every public table'
);

select has_table('auth', 'users', 'the local Supabase Auth schema is present');
select has_table('storage', 'objects', 'the local Supabase Storage schema is present');
select has_table(
  'public',
  'account_publication_leases',
  'the final account-publication fence table is present'
);

select is(
  (select count(*) from public.conflict_rules),
  13::bigint,
  'the reviewed starter conflict-rule fixture is seeded by migrations'
);

select is(
  (select count(*) from public.conflict_rules where reviewed_by is null),
  13::bigint,
  'starter conflict rules remain unreviewed and fail closed'
);

select is(
  (select count(*) from public.ingredient_pao_defaults),
  11::bigint,
  'the starter PAO defaults are seeded by migrations'
);

select is(
  (select count(*) from public.products),
  0::bigint,
  'the credential-free seed does not invent a production product catalog'
);

select ok(
  not has_table_privilege('anon', 'public.account_publication_leases', 'select')
    and not has_table_privilege('authenticated', 'public.account_publication_leases', 'select')
    and not has_table_privilege('service_role', 'public.account_publication_leases', 'select'),
  'the publication lease table is not directly readable by API roles'
);

select ok(
  not has_table_privilege('anon', 'public.account_deletion_operations', 'select')
    and not has_table_privilege('authenticated', 'public.account_deletion_operations', 'select')
    and not has_table_privilege('service_role', 'public.account_deletion_operations', 'select'),
  'the deletion operation table is not directly readable by API roles'
);

select * from finish();
rollback;
