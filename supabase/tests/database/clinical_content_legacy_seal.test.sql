begin;

create extension if not exists pgtap with schema extensions;
set local search_path = extensions, public, pg_catalog;

select plan(26);

select is(
  (select count(*) from supabase_migrations.schema_migrations),
  95::bigint,
  'the clinical legacy seal runs against the exact 95-migration source history'
);

select is(
  (select max(version) from supabase_migrations.schema_migrations),
  '20261007000079'::text,
  'the migration history includes the legacy seal and reaches the current quiz-contract successor'
);

select is(
  (select count(*) from public.conflict_rules),
  13::bigint,
  '0066 preserves all thirteen historical conflict-rule fixtures'
);

select is(
  (select count(*) from public.sequencing_rules),
  10::bigint,
  '0066 preserves all ten historical sequencing-rule fixtures'
);

select is(
  (
    select count(*)
    from (
      select reviewed_by from public.conflict_rules
      union all
      select reviewed_by from public.sequencing_rules
    ) as legacy_content
    where legacy_content.reviewed_by is null
  ),
  23::bigint,
  'the preserved legacy rows remain explicitly unreviewed'
);

select is(
  (
    select count(*)
    from pg_catalog.pg_class as relation
    where relation.oid = any(array[
      'public.conflict_rules'::regclass,
      'public.sequencing_rules'::regclass
    ])
      and relation.relrowsecurity
      and relation.relforcerowsecurity
  ),
  2::bigint,
  'both legacy clinical-content relations have enabled and forced RLS'
);

select is(
  (
    select count(*)
    from pg_catalog.pg_policy as policy
    where policy.polrelid = any(array[
      'public.conflict_rules'::regclass,
      'public.sequencing_rules'::regclass
    ])
  ),
  0::bigint,
  'neither historical relation has a publication or mutation policy'
);

select ok(
  not exists (
    select 1
    from (values
      ('anon'),
      ('authenticated'),
      ('service_role')
    ) as api_role(role_name)
    cross join (values
      ('public.conflict_rules'::regclass),
      ('public.sequencing_rules'::regclass)
    ) as sealed_relation(relation_oid)
    cross join (values
      ('SELECT'),
      ('INSERT'),
      ('UPDATE'),
      ('DELETE'),
      ('TRUNCATE'),
      ('REFERENCES'),
      ('TRIGGER')
    ) as table_privilege(privilege_name)
    where pg_catalog.has_table_privilege(
      api_role.role_name,
      sealed_relation.relation_oid,
      table_privilege.privilege_name
    )
  ),
  'anon, authenticated, and service_role have none of all seven table privileges'
);

select ok(
  not exists (
    select 1
    from pg_catalog.pg_class as relation
    cross join lateral pg_catalog.aclexplode(
      coalesce(
        relation.relacl,
        pg_catalog.acldefault('r', relation.relowner)
      )
    ) as privilege
    where relation.oid = any(array[
      'public.conflict_rules'::regclass,
      'public.sequencing_rules'::regclass
    ])
      and privilege.grantee in (
        0,
        'anon'::regrole,
        'authenticated'::regrole,
        'service_role'::regrole
      )
  ),
  'raw ACLs contain no PUBLIC or API-role residue on either legacy relation'
);

select ok(
  exists (
    select 1
    from pg_catalog.pg_proc as procedure
    where procedure.oid =
      'private.guard_legacy_clinical_content_immutable()'::regprocedure
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
      and not exists (
        select 1
        from pg_catalog.aclexplode(
          coalesce(
            procedure.proacl,
            pg_catalog.acldefault('f', procedure.proowner)
          )
        ) as privilege
        where privilege.grantee = 0
          and privilege.privilege_type = 'EXECUTE'
      )
  ),
  'the owner guard is a private fail-closed definer with no API or PUBLIC execute'
);

select results_eq(
  $$select trigger.tgname::text collate "C"
      from pg_catalog.pg_trigger as trigger
     where trigger.tgrelid = any(array[
       'public.conflict_rules'::regclass,
       'public.sequencing_rules'::regclass
     ])
       and not trigger.tgisinternal
     order by trigger.tgname$$,
  $$values
    ('conflict_rules_legacy_immutable'::text collate "C"),
    ('sequencing_rules_legacy_immutable'::text collate "C")$$,
  'the two legacy relations have exactly the two intended user triggers'
);

select is(
  (
    select count(*)
    from pg_catalog.pg_trigger as trigger
    where trigger.tgrelid = any(array[
      'public.conflict_rules'::regclass,
      'public.sequencing_rules'::regclass
    ])
      and not trigger.tgisinternal
      and trigger.tgenabled = 'O'
      and trigger.tgfoid =
        'private.guard_legacy_clinical_content_immutable()'::regprocedure
      and pg_catalog.pg_get_triggerdef(trigger.oid, true)
        ~* 'BEFORE INSERT OR DELETE OR UPDATE OR TRUNCATE'
      and pg_catalog.pg_get_triggerdef(trigger.oid, true)
        ~* 'FOR EACH STATEMENT'
  ),
  2::bigint,
  'both owner-safe guards reject all four mutation statement classes'
);

select is(
  (
    select count(*)
    from pg_catalog.pg_trigger as trigger
    where trigger.tgrelid = any(array[
      'public.conflict_rules'::regclass,
      'public.sequencing_rules'::regclass
    ])
      and not trigger.tgisinternal
      and trigger.tgfoid <>
        'private.guard_legacy_clinical_content_immutable()'::regprocedure
  ),
  0::bigint,
  'no unrelated trigger mutation path is attached to either legacy relation'
);

select ok(
  not exists (
    select 1
    from pg_catalog.pg_proc as procedure
    join pg_catalog.pg_namespace as namespace
      on namespace.oid = procedure.pronamespace
    cross join lateral (
      select pg_catalog.pg_get_functiondef(procedure.oid) as definition
    ) as source
    where procedure.prokind in ('f', 'p')
      and procedure.prosecdef
      and namespace.nspname in ('public', 'private', 'catalog_operator_gateway')
      and source.definition ~* '(conflict_rules|sequencing_rules)'
      and (
        pg_catalog.has_function_privilege(
          'anon',
          procedure.oid,
          'EXECUTE'
        )
        or pg_catalog.has_function_privilege(
          'authenticated',
          procedure.oid,
          'EXECUTE'
        )
        or pg_catalog.has_function_privilege(
          'service_role',
          procedure.oid,
          'EXECUTE'
        )
      )
  ),
  'no API-executable SECURITY DEFINER function can bypass the legacy table seal'
);

select throws_ok(
  $$insert into public.conflict_rules (
      tag_a,
      tag_b,
      interaction_type,
      base_severity,
      evidence_label,
      mechanism,
      resolution_type,
      resolution_copy,
      source_citation
    ) values (
      '__audit_a__',
      '__audit_b__',
      'myth',
      'none',
      'refuted',
      'must remain impossible',
      'reassure',
      'must remain impossible',
      'test-only'
    )$$,
  '55000',
  'LEGACY_CLINICAL_CONTENT_IMMUTABLE',
  'the migration owner cannot insert a conflict rule directly'
);

select throws_ok(
  $$update public.conflict_rules
      set is_active = false
    where false$$,
  '55000',
  'LEGACY_CLINICAL_CONTENT_IMMUTABLE',
  'the migration owner cannot update conflict rules directly'
);

select throws_ok(
  $$delete from public.conflict_rules where false$$,
  '55000',
  'LEGACY_CLINICAL_CONTENT_IMMUTABLE',
  'the migration owner cannot delete conflict rules directly'
);

select throws_ok(
  $$truncate table public.conflict_rules cascade$$,
  '55000',
  'LEGACY_CLINICAL_CONTENT_IMMUTABLE',
  'the migration owner cannot truncate conflict rules or dependent conflict history'
);

select throws_ok(
  $$insert into public.sequencing_rules (
      role,
      base_priority
    ) values (
      '__audit__',
      999
    )$$,
  '55000',
  'LEGACY_CLINICAL_CONTENT_IMMUTABLE',
  'the migration owner cannot insert a sequencing rule directly'
);

select throws_ok(
  $$update public.sequencing_rules
      set is_active = false
    where false$$,
  '55000',
  'LEGACY_CLINICAL_CONTENT_IMMUTABLE',
  'the migration owner cannot update sequencing rules directly'
);

select throws_ok(
  $$delete from public.sequencing_rules where false$$,
  '55000',
  'LEGACY_CLINICAL_CONTENT_IMMUTABLE',
  'the migration owner cannot delete sequencing rules directly'
);

select throws_ok(
  $$truncate table public.sequencing_rules$$,
  '55000',
  'LEGACY_CLINICAL_CONTENT_IMMUTABLE',
  'the migration owner cannot truncate sequencing rules directly'
);

set local role service_role;
select throws_ok(
  $$truncate table public.conflict_rules cascade$$,
  '42501',
  'permission denied for table conflict_rules',
  'service_role cannot use its RLS bypass to truncate conflict rules'
);
reset role;

set local role authenticated;
select throws_ok(
  $$truncate table public.sequencing_rules$$,
  '42501',
  'permission denied for table sequencing_rules',
  'authenticated cannot truncate the sealed sequencing corpus'
);
reset role;

set local role authenticated;
select throws_ok(
  $$create trigger pgtap_untrusted_clinical_trigger
      before update on public.sequencing_rules
      for each row execute function
        pg_catalog.suppress_redundant_updates_trigger()$$,
  '42501',
  'permission denied for table sequencing_rules',
  'authenticated cannot attach an untrusted trigger to sequencing rules'
);
reset role;

select is(
  (
    select count(*)
    from (
      select id from public.conflict_rules
      union all
      select id from public.sequencing_rules
    ) as preserved_rows
  ),
  23::bigint,
  'all historical rule rows survive every denied owner and API mutation probe'
);

select * from finish();
rollback;
