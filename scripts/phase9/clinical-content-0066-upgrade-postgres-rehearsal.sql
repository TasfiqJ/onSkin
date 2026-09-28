\set ON_ERROR_STOP on

-- Focused forward-upgrade rehearsal for migration 0066. Supabase's historical
-- table defaults can leave TRUNCATE, REFERENCES, and TRIGGER behind after a
-- SELECT-only revoke, so this fixture recreates that exact pre-0066 exposure.
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

create table public.conflict_rules (
  id integer primary key,
  reviewed_by text
);

create table public.sequencing_rules (
  id integer primary key,
  reviewed_by text
);

create table public.routine_conflicts (
  id integer primary key,
  rule_id integer not null references public.conflict_rules (id)
);

insert into public.conflict_rules (id)
select value from pg_catalog.generate_series(1, 13) as value;

insert into public.sequencing_rules (id)
select value from pg_catalog.generate_series(1, 10) as value;

insert into public.routine_conflicts (id, rule_id)
values (1, 1), (2, 2);

alter table public.conflict_rules enable row level security;
alter table public.sequencing_rules enable row level security;

create policy "conflict_rules_read_active"
  on public.conflict_rules for select to authenticated using (true);
create policy "sequencing_rules_read_active"
  on public.sequencing_rules for select to authenticated using (true);

grant select, truncate, references, trigger
  on table public.conflict_rules, public.sequencing_rules
  to anon, authenticated, service_role;
revoke select
  on table public.conflict_rules, public.sequencing_rules
  from public, anon, authenticated, service_role;

-- Execute the exact source that will run on hosted databases.
\ir ../../supabase/migrations/20260726000066_legacy_clinical_content_immutability.sql

create function pg_temp.assert_legacy_clinical_rejected(p_statement text)
returns void
language plpgsql
set search_path = ''
as $function$
begin
  begin
    execute p_statement;
  exception when sqlstate '55000' then
    if sqlerrm is distinct from 'LEGACY_CLINICAL_CONTENT_IMMUTABLE' then
      raise exception 'CORE01_0066_UNSTABLE_REJECTION: %', sqlerrm;
    end if;
    return;
  end;

  raise exception 'CORE01_0066_OWNER_MUTATION_ACCEPTED: %', p_statement;
end;
$function$;

select pg_temp.assert_legacy_clinical_rejected(
  'insert into public.conflict_rules (id) values (14)'
);
select pg_temp.assert_legacy_clinical_rejected(
  'update public.conflict_rules set reviewed_by = null where false'
);
select pg_temp.assert_legacy_clinical_rejected(
  'delete from public.conflict_rules where false'
);
select pg_temp.assert_legacy_clinical_rejected(
  'truncate table public.conflict_rules cascade'
);
select pg_temp.assert_legacy_clinical_rejected(
  'insert into public.sequencing_rules (id) values (11)'
);
select pg_temp.assert_legacy_clinical_rejected(
  'update public.sequencing_rules set reviewed_by = null where false'
);
select pg_temp.assert_legacy_clinical_rejected(
  'delete from public.sequencing_rules where false'
);
select pg_temp.assert_legacy_clinical_rejected(
  'truncate table public.sequencing_rules'
);

do $verification$
declare
  v_guard constant regprocedure :=
    'private.guard_legacy_clinical_content_immutable()'::regprocedure;
begin
  if (
    select pg_catalog.count(*) from public.conflict_rules
  ) <> 13
  or (
    select pg_catalog.count(*) from public.sequencing_rules
  ) <> 10
  or (
    select pg_catalog.count(*) from public.routine_conflicts
  ) <> 2 then
    raise exception 'CORE01_0066_UPGRADE_DATA_NOT_PRESERVED';
  end if;

  if exists (
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
  ) then
    raise exception 'CORE01_0066_API_TABLE_PRIVILEGE_SURVIVED';
  end if;

  if (
    select pg_catalog.count(*)
    from pg_catalog.pg_class as relation
    where relation.oid = any(array[
      'public.conflict_rules'::regclass,
      'public.sequencing_rules'::regclass
    ])
      and relation.relrowsecurity
      and relation.relforcerowsecurity
  ) <> 2
  or exists (
    select 1
    from pg_catalog.pg_policy as policy
    where policy.polrelid = any(array[
      'public.conflict_rules'::regclass,
      'public.sequencing_rules'::regclass
    ])
  ) then
    raise exception 'CORE01_0066_RLS_POSTURE_INVALID';
  end if;

  if (
    select pg_catalog.count(*)
    from pg_catalog.pg_trigger as trigger
    where trigger.tgrelid = any(array[
      'public.conflict_rules'::regclass,
      'public.sequencing_rules'::regclass
    ])
      and trigger.tgfoid = v_guard
      and not trigger.tgisinternal
      and trigger.tgenabled = 'O'
      and pg_catalog.pg_get_triggerdef(trigger.oid, true)
        ~* 'BEFORE INSERT OR DELETE OR UPDATE OR TRUNCATE'
      and pg_catalog.pg_get_triggerdef(trigger.oid, true)
        ~* 'FOR EACH STATEMENT'
  ) <> 2 then
    raise exception 'CORE01_0066_TRIGGER_POSTURE_INVALID';
  end if;

  if not exists (
    select 1
    from pg_catalog.pg_proc as procedure
    where procedure.oid = v_guard
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
    raise exception 'CORE01_0066_GUARD_POSTURE_INVALID';
  end if;
end;
$verification$;

select 'clinical-content-0066-upgrade-postgres-rehearsal: pass' as result;
