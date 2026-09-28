begin;

-- Migration 0058 removed the active-row publication policies and every direct
-- API-role SELECT grant, but the Supabase table defaults left TRUNCATE,
-- REFERENCES, and TRIGGER on these historical relations. RLS does not govern
-- those whole-table privileges, and service_role has BYPASSRLS. Seal every
-- table privilege explicitly before installing owner-safe mutation guards.
drop policy if exists "conflict_rules_read_active" on public.conflict_rules;
drop policy if exists "sequencing_rules_read_active" on public.sequencing_rules;

alter table public.conflict_rules enable row level security;
alter table public.conflict_rules force row level security;
alter table public.sequencing_rules enable row level security;
alter table public.sequencing_rules force row level security;

revoke all privileges on table
  public.conflict_rules,
  public.sequencing_rules
from public, anon, authenticated, service_role;

-- The legacy rows are migration fixtures, not publication authority. Blocking
-- statement-level INSERT/UPDATE/DELETE/TRUNCATE also protects against direct
-- migration-owner edits, which FORCE RLS cannot stop for a BYPASSRLS owner.
-- A future reviewed, hash-bound corpus must use a separate private authority;
-- any deliberate legacy repair must be an explicit forward migration that
-- removes and restores this guard around the exact repair.
create or replace function private.guard_legacy_clinical_content_immutable()
returns trigger
language plpgsql
volatile
security definer
set search_path = ''
as $function$
begin
  raise exception 'LEGACY_CLINICAL_CONTENT_IMMUTABLE'
    using errcode = '55000';
end;
$function$;

revoke all on function private.guard_legacy_clinical_content_immutable()
  from public, anon, authenticated, service_role;

create trigger conflict_rules_legacy_immutable
  before insert or update or delete or truncate
  on public.conflict_rules
  for each statement execute function
    private.guard_legacy_clinical_content_immutable();

create trigger sequencing_rules_legacy_immutable
  before insert or update or delete or truncate
  on public.sequencing_rules
  for each statement execute function
    private.guard_legacy_clinical_content_immutable();

comment on function private.guard_legacy_clinical_content_immutable() is
  'Statement-level fail-closed guard for historical unreviewed clinical-content relations; reviewed publication requires a separate hash-bound authority.';

do $verification$
declare
  v_guard constant regprocedure :=
    'private.guard_legacy_clinical_content_immutable()'::regprocedure;
begin
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
    raise exception 'LEGACY_CLINICAL_CONTENT_API_ACL_DRIFT'
      using errcode = '42501';
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
    raise exception 'LEGACY_CLINICAL_CONTENT_RLS_DRIFT'
      using errcode = '42501';
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
    raise exception 'LEGACY_CLINICAL_CONTENT_TRIGGER_DRIFT'
      using errcode = '55000';
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
  ) then
    raise exception 'LEGACY_CLINICAL_CONTENT_GUARD_ACL_DRIFT'
      using errcode = '42501';
  end if;
end;
$verification$;

commit;
