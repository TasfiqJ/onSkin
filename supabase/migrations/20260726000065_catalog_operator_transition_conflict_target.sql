begin;

-- Per-schema default ACL revokes cannot subtract PostgreSQL's global default
-- EXECUTE grant. Make future migration-owner functions fail closed globally;
-- intentionally public RPCs must continue to receive explicit grants.
alter default privileges for role postgres
  revoke execute on functions from public;

-- 0063's transition RPC returns `item_kind` and `item_id` columns. In PL/pgSQL,
-- those output variables make `ON CONFLICT (item_kind, item_id)` ambiguous at
-- runtime. Repair both insert paths without rewriting already-applied history.
-- The guarded definition rewrite preserves the existing owner, signature,
-- SECURITY DEFINER posture, configuration, comment, and ACL.
do $migration$
declare
  v_transition constant regprocedure :=
    'catalog_operator_gateway.catalog_operator_transition(uuid,text,text,text,bigint,uuid,text,uuid,uuid,bigint,text,text,text)'::regprocedure;
  v_definition text;
  v_ambiguous constant text :=
    'on conflict (item_kind, item_id) do nothing';
  v_unambiguous constant text :=
    'on conflict on constraint catalog_operator_work_states_pkey do nothing';
  v_occurrences integer;
begin
  select pg_catalog.pg_get_functiondef(v_transition)
    into strict v_definition;

  v_occurrences := (
    pg_catalog.length(v_definition)
      - pg_catalog.length(pg_catalog.replace(v_definition, v_ambiguous, ''))
  ) / pg_catalog.length(v_ambiguous);

  if v_occurrences <> 2 then
    raise exception 'CATALOG_OPERATOR_TRANSITION_CONFLICT_TARGET_DRIFT'
      using errcode = '55000',
            detail = pg_catalog.format(
              'Expected exactly 2 ambiguous conflict targets; found %s.',
              v_occurrences
            );
  end if;

  execute pg_catalog.replace(
    v_definition,
    v_ambiguous,
    v_unambiguous
  );
end;
$migration$;

do $verification$
declare
  v_transition constant regprocedure :=
    'catalog_operator_gateway.catalog_operator_transition(uuid,text,text,text,bigint,uuid,text,uuid,uuid,bigint,text,text,text)'::regprocedure;
  v_definition text;
begin
  select pg_catalog.pg_get_functiondef(v_transition)
    into strict v_definition;

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
    raise exception 'CATALOG_OPERATOR_GLOBAL_FUNCTION_DEFAULT_ACL_DRIFT'
      using errcode = '42501';
  end if;

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
    raise exception 'CATALOG_OPERATOR_TRANSITION_CONFLICT_TARGET_REPAIR_FAILED'
      using errcode = '55000';
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
    raise exception 'CATALOG_OPERATOR_TRANSITION_SECURITY_POSTURE_DRIFT'
      using errcode = '42501';
  end if;
end;
$verification$;

commit;
