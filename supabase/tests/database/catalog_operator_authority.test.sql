begin;

create extension if not exists pgtap with schema extensions;
set local search_path = extensions, public, pg_catalog;

select no_plan();

select ok(
  to_regprocedure(
    'catalog_operator_gateway.catalog_operator_session(uuid,text,text,text,bigint,text)'
  ) is not null
    and to_regprocedure(
      'catalog_operator_gateway.catalog_operator_queue(uuid,text,text,text,bigint,text,timestamptz,uuid,integer)'
    ) is not null
    and to_regprocedure(
      'catalog_operator_gateway.catalog_operator_detail(uuid,text,text,text,bigint,text,uuid,uuid,bigint)'
    ) is not null
    and to_regprocedure(
      'catalog_operator_gateway.catalog_operator_claim(uuid,text,text,text,bigint,uuid,text,uuid,bigint)'
    ) is not null
    and to_regprocedure(
      'catalog_operator_gateway.catalog_operator_transition(uuid,text,text,text,bigint,uuid,text,uuid,uuid,bigint,text,text,text)'
    ) is not null
    and to_regprocedure(
      'catalog_operator_gateway.catalog_operator_release_hold(uuid,text,text,text,bigint,uuid,uuid,uuid,bigint,uuid,text)'
    ) is not null,
  'CAT-08 exposes exactly six bounded functions in the non-API gateway schema'
);

select ok(
  (
    select count(*) = 6
    from pg_catalog.pg_proc as procedure
    join pg_catalog.pg_namespace as namespace
      on namespace.oid = procedure.pronamespace
    where namespace.nspname = 'catalog_operator_gateway'
  )
  and (
    select count(*) = 6
    from pg_catalog.pg_proc as procedure
    where procedure.oid = any(array[
      'catalog_operator_gateway.catalog_operator_session(uuid,text,text,text,bigint,text)'::regprocedure,
      'catalog_operator_gateway.catalog_operator_queue(uuid,text,text,text,bigint,text,timestamptz,uuid,integer)'::regprocedure,
      'catalog_operator_gateway.catalog_operator_detail(uuid,text,text,text,bigint,text,uuid,uuid,bigint)'::regprocedure,
      'catalog_operator_gateway.catalog_operator_claim(uuid,text,text,text,bigint,uuid,text,uuid,bigint)'::regprocedure,
      'catalog_operator_gateway.catalog_operator_transition(uuid,text,text,text,bigint,uuid,text,uuid,uuid,bigint,text,text,text)'::regprocedure,
      'catalog_operator_gateway.catalog_operator_release_hold(uuid,text,text,text,bigint,uuid,uuid,uuid,bigint,uuid,text)'::regprocedure
    ])
      and procedure.prosecdef
      and procedure.provolatile = 'v'
      and procedure.proconfig @> array['search_path=""']::text[]
  ),
  'all six operator RPCs are volatile SECURITY DEFINER functions with empty search paths'
);

select ok(
  (
    select bool_and(
      has_function_privilege('catalog_operator_edge', procedure.oid, 'execute')
      and not has_function_privilege('service_role', procedure.oid, 'execute')
      and not has_function_privilege('authenticated', procedure.oid, 'execute')
      and not has_function_privilege('anon', procedure.oid, 'execute')
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
    )
    from pg_catalog.pg_proc as procedure
    where procedure.oid = any(array[
      'catalog_operator_gateway.catalog_operator_session(uuid,text,text,text,bigint,text)'::regprocedure,
      'catalog_operator_gateway.catalog_operator_queue(uuid,text,text,text,bigint,text,timestamptz,uuid,integer)'::regprocedure,
      'catalog_operator_gateway.catalog_operator_detail(uuid,text,text,text,bigint,text,uuid,uuid,bigint)'::regprocedure,
      'catalog_operator_gateway.catalog_operator_claim(uuid,text,text,text,bigint,uuid,text,uuid,bigint)'::regprocedure,
      'catalog_operator_gateway.catalog_operator_transition(uuid,text,text,text,bigint,uuid,text,uuid,uuid,bigint,text,text,text)'::regprocedure,
      'catalog_operator_gateway.catalog_operator_release_hold(uuid,text,text,text,bigint,uuid,uuid,uuid,bigint,uuid,text)'::regprocedure
    ])
  ),
  'only the dedicated Edge database role can execute the six gateway functions'
);

select ok(
  (
    select role.rolcanlogin
      and role.rolconnlimit = 8
      and not role.rolsuper
      and not role.rolinherit
      and not role.rolcreatedb
      and not role.rolcreaterole
      and not role.rolreplication
      and not role.rolbypassrls
    from pg_catalog.pg_roles as role
    where role.rolname = 'catalog_operator_edge'
  )
    and has_schema_privilege(
      'catalog_operator_edge', 'catalog_operator_gateway', 'usage'
    )
    and not has_any_column_privilege(
      'catalog_operator_edge', 'public.catalog_corrections', 'select'
    )
    and not has_schema_privilege(
      'catalog_operator_edge', 'auth', 'usage'
    )
    and not exists (
      select 1
      from pg_catalog.pg_auth_members as membership
      join pg_catalog.pg_roles as edge_role
        on edge_role.oid = membership.member
        or edge_role.oid = membership.roleid
      where edge_role.rolname = 'catalog_operator_edge'
    )
    and not exists (
      select 1
      from pg_catalog.pg_shdepend as dependency
      join pg_catalog.pg_roles as edge_role
        on edge_role.oid = dependency.refobjid
      where dependency.refclassid = 'pg_catalog.pg_authid'::regclass
        and dependency.deptype = 'o'
        and edge_role.rolname = 'catalog_operator_edge'
        and (
          dependency.dbid = 0
          or dependency.dbid = (
            select database.oid
            from pg_catalog.pg_database as database
            where database.datname = pg_catalog.current_database()
          )
        )
    ),
  'the dedicated login is nonsuperuser, membership/ownership-free, connection-limited, and has no raw or Auth-schema lane'
);

select ok(
  not exists (
    select 1
    from pg_catalog.pg_proc as procedure
    join pg_catalog.pg_namespace as namespace
      on namespace.oid = procedure.pronamespace
    where namespace.nspname in ('public', 'private')
      and has_function_privilege(
        'catalog_operator_edge', procedure.oid, 'execute'
      )
  )
    and not exists (
      select 1
      from pg_catalog.pg_class as relation
      join pg_catalog.pg_namespace as namespace
        on namespace.oid = relation.relnamespace
      where namespace.nspname in ('public', 'private', 'auth')
        and relation.relkind in ('r', 'p', 'v', 'm', 'f')
        and (
          has_table_privilege('catalog_operator_edge', relation.oid, 'select')
          or has_table_privilege('catalog_operator_edge', relation.oid, 'insert')
          or has_table_privilege('catalog_operator_edge', relation.oid, 'update')
          or has_table_privilege('catalog_operator_edge', relation.oid, 'delete')
          or (
            relation.relkind in ('r', 'p')
            and (
              has_table_privilege(
                'catalog_operator_edge', relation.oid, 'truncate'
              )
              or has_table_privilege(
                'catalog_operator_edge', relation.oid, 'references'
              )
              or has_table_privilege(
                'catalog_operator_edge', relation.oid, 'trigger'
              )
            )
          )
        )
    )
    and not exists (
      select 1
      from pg_catalog.pg_class as relation
      join pg_catalog.pg_namespace as namespace
        on namespace.oid = relation.relnamespace
      where namespace.nspname in ('public', 'private', 'auth')
        and relation.relkind = 'S'
        and (
          has_sequence_privilege(
            'catalog_operator_edge', relation.oid, 'usage'
          )
          or has_sequence_privilege(
            'catalog_operator_edge', relation.oid, 'select'
          )
          or has_sequence_privilege(
            'catalog_operator_edge', relation.oid, 'update'
          )
        )
    )
    and exists (
      select 1
      from pg_catalog.pg_default_acl as default_acl
      where default_acl.defaclrole = 'postgres'::regrole
        and default_acl.defaclnamespace = 0
        and default_acl.defaclobjtype = 'f'
    )
    and not exists (
      select 1
      from pg_catalog.pg_default_acl as default_acl
      left join pg_catalog.pg_namespace as namespace
        on namespace.oid = default_acl.defaclnamespace
      cross join lateral pg_catalog.aclexplode(
        default_acl.defaclacl
      ) as privilege
      where default_acl.defaclrole = 'postgres'::regrole
        and (
          default_acl.defaclnamespace = 0
          or namespace.nspname in (
            'public', 'private', 'catalog_operator_gateway'
          )
        )
        and default_acl.defaclobjtype = 'f'
        and privilege.grantee = 0
        and privilege.privilege_type = 'EXECUTE'
    ),
  'the dedicated login has no ambient function/table lane and future functions default closed'
);

select ok(
  not has_table_privilege('anon', 'public.catalog_corrections', 'select')
    and not has_table_privilege(
      'authenticated', 'public.catalog_corrections', 'select'
    )
    and not has_table_privilege(
      'service_role', 'public.catalog_corrections', 'select'
    )
    and not has_function_privilege(
      'service_role',
      'public.review_catalog_correction(uuid,bigint,text,text,text)',
      'execute'
    )
    and has_function_privilege(
      'service_role',
      'public.submit_catalog_correction(uuid,bigint,uuid,uuid,text,text,text,jsonb,jsonb)',
      'execute'
    )
    and not has_function_privilege(
      'service_role',
      'public.export_catalog_corrections_for_subject(uuid,timestamptz,uuid,integer)',
      'execute'
    )
    and has_function_privilege(
      'authenticated',
      'public.export_catalog_corrections_for_subject(uuid,timestamptz,uuid,integer)',
      'execute'
    ),
  'service_role retains bounded intake but loses report reads; authenticated subjects retain only their owner-bound export RPC'
);

select ok(
  pg_catalog.pg_get_functiondef(
    'public.export_catalog_corrections_for_subject(uuid,timestamptz,uuid,integer)'::regprocedure
  ) like '%v_caller_user_id <> p_user_id%'
    and pg_catalog.pg_get_functiondef(
      'public.export_catalog_corrections_for_subject(uuid,timestamptz,uuid,integer)'::regprocedure
    ) like '%public.account_access_allowed()%',
  'the correction export binds auth.uid ownership and exact live account lifecycle admission'
);

select is(
  (
    select count(*)
    from pg_catalog.pg_class as relation
    join pg_catalog.pg_namespace as namespace
      on namespace.oid = relation.relnamespace
    where namespace.nspname = 'private'
      and relation.relname in (
        'catalog_operator_grant_attestations',
        'catalog_operator_grants',
        'catalog_operator_capability_bindings',
        'catalog_operator_grant_revocations',
        'catalog_operator_runtime_control',
        'catalog_operator_runtime_control_history',
        'catalog_operator_sessions',
        'catalog_operator_rate_buckets',
        'catalog_operator_work_states',
        'catalog_operator_claims',
        'catalog_operator_operation_receipts',
        'catalog_operator_audit_events',
        'catalog_operator_product_holds',
        'catalog_operator_repair_authority_receipts',
        'catalog_operator_hold_events'
      )
      and relation.relrowsecurity
      and relation.relforcerowsecurity
  ),
  15::bigint,
  'every CAT-08 authority relation is private, RLS-enabled, and FORCE-RLS sealed'
);

select is(
  (
    select count(*)
    from pg_catalog.pg_policies as policy
    where policy.schemaname = 'private'
      and policy.tablename like 'catalog_operator_%'
  ),
  0::bigint,
  'CAT-08 private relations expose no RLS policy to API roles'
);

select ok(
  pg_catalog.pg_get_functiondef(
    'private.catalog_operator_current_auth(uuid,text,text,text,bigint)'::regprocedure
  ) like '%auth_session.user_id%'
    and pg_catalog.pg_get_functiondef(
      'private.catalog_operator_current_auth(uuid,text,text,text,bigint)'::regprocedure
    ) like '%auth_session.aal::text = ''aal2''%'
    and pg_catalog.pg_get_functiondef(
      'private.catalog_operator_current_auth(uuid,text,text,text,bigint)'::regprocedure
    ) ~* 'FROM auth.sessions'
    and pg_catalog.pg_get_functiondef(
      'private.catalog_operator_current_auth(uuid,text,text,text,bigint)'::regprocedure
    ) ~* '(FROM|JOIN)[[:space:]]+auth[.]mfa_factors'
    and pg_catalog.pg_get_functiondef(
      'private.catalog_operator_current_auth(uuid,text,text,text,bigint)'::regprocedure
    ) like '%is_anonymous%'
    and pg_catalog.pg_get_functiondef(
      'private.catalog_operator_current_auth(uuid,text,text,text,bigint)'::regprocedure
    ) like '%public.account_write_allowed(v_actor)%'
    and pg_catalog.pg_get_functiondef(
      'private.catalog_operator_current_auth(uuid,text,text,text,bigint)'::regprocedure
    ) like '%CATALOG_OPERATOR_ACCOUNT_ACCESS_DENIED%',
  'operator auth derives actor and exact factor from a live, nonanonymous AAL2 Auth session'
);

select ok(
  not exists (
    select 1
    from pg_catalog.pg_proc as procedure
    cross join lateral pg_catalog.unnest(
      coalesce(
        procedure.proargnames[1:procedure.pronargs],
        array[]::text[]
      )
    ) as argument(name)
    where procedure.oid = any(array[
      'catalog_operator_gateway.catalog_operator_session(uuid,text,text,text,bigint,text)'::regprocedure,
      'catalog_operator_gateway.catalog_operator_queue(uuid,text,text,text,bigint,text,timestamptz,uuid,integer)'::regprocedure,
      'catalog_operator_gateway.catalog_operator_detail(uuid,text,text,text,bigint,text,uuid,uuid,bigint)'::regprocedure,
      'catalog_operator_gateway.catalog_operator_claim(uuid,text,text,text,bigint,uuid,text,uuid,bigint)'::regprocedure,
      'catalog_operator_gateway.catalog_operator_transition(uuid,text,text,text,bigint,uuid,text,uuid,uuid,bigint,text,text,text)'::regprocedure,
      'catalog_operator_gateway.catalog_operator_release_hold(uuid,text,text,text,bigint,uuid,uuid,uuid,bigint,uuid,text)'::regprocedure
    ])
      and argument.name ~ '(actor|operator|reviewed_by|user_id)'
  ),
  'operator RPCs accept only an Auth session selector and never a caller-supplied actor alias'
);

select ok(
  pg_catalog.pg_get_functiondef(
    'catalog_operator_gateway.catalog_operator_session(uuid,text,text,text,bigint,text)'::regprocedure
  ) like '%interval ''10 minutes''%'
    and pg_catalog.pg_get_functiondef(
      'catalog_operator_gateway.catalog_operator_claim(uuid,text,text,text,bigint,uuid,text,uuid,bigint)'::regprocedure
    ) like '%interval ''5 minutes''%'
    and pg_catalog.pg_get_functiondef(
      'catalog_operator_gateway.catalog_operator_claim(uuid,text,text,text,bigint,uuid,text,uuid,bigint)'::regprocedure
    ) like '%pg_advisory_xact_lock%'
    and pg_catalog.pg_get_functiondef(
      'catalog_operator_gateway.catalog_operator_transition(uuid,text,text,text,bigint,uuid,text,uuid,uuid,bigint,text,text,text)'::regprocedure
    ) like '%CATALOG_OPERATOR_VERSION_CONFLICT%',
  'operator sessions and leases are short-lived and mutations are advisory-lock/CAS serialized'
);

select ok(
  pg_catalog.pg_get_functiondef(
    'catalog_operator_gateway.catalog_operator_session(uuid,text,text,text,bigint,text)'::regprocedure
  ) ~* '(?s)if p_budget_class = ''preflight'' then.*consume_catalog_operator_rate_budget.*return;'
    and pg_catalog.pg_get_functiondef(
      'catalog_operator_gateway.catalog_operator_session(uuid,text,text,text,bigint,text)'::regprocedure
    ) like '%for update%'
    and pg_catalog.pg_get_functiondef(
      'private.assert_catalog_operator(text,uuid,text,text,text,bigint)'::regprocedure
    ) like '%pg_catalog.unnest(%'
    and pg_catalog.pg_get_functiondef(
      'private.assert_catalog_operator(text,uuid,text,text,text,bigint)'::regprocedure
    ) like '%catalog-operator-session:%'
    and pg_catalog.pg_get_functiondef(
      'private.assert_catalog_operator(text,uuid,text,text,text,bigint)'::regprocedure
    ) like '%pg_catalog.pg_advisory_xact_lock(%'
    and pg_catalog.pg_get_functiondef(
      'private.assert_catalog_operator(text,uuid,text,text,text,bigint)'::regprocedure
    ) like '%for update%'
    and pg_catalog.pg_get_functiondef(
      'private.assert_catalog_operator(text,uuid,text,text,text,bigint)'::regprocedure
    ) not like '%revocation.revoked_at <= pg_catalog.now()%'
    and pg_catalog.pg_get_functiondef(
      'catalog_operator_gateway.catalog_operator_session(uuid,text,text,text,bigint,text)'::regprocedure
    ) not like '%revocation.revoked_at <= pg_catalog.now()%',
  'committed admission and actor/grant locks make grant issue/revocation checks immediate and linearizable'
);

select ok(
  pg_catalog.pg_get_functiondef(
    'private.serialize_catalog_operator_grant_insert()'::regprocedure
  ) like '%catalog-operator-session:%'
    and exists (
      select 1
      from pg_catalog.pg_trigger as trigger
      where trigger.tgrelid =
        'private.catalog_operator_grants'::regclass
        and trigger.tgname = 'catalog_operator_grants_serialize_insert'
        and not trigger.tgisinternal
    ),
  'grant insertion shares the actor advisory lock with session establishment and actions'
);

select ok(
  pg_catalog.pg_get_functiondef(
    'private.catalog_product_is_servable(uuid)'::regprocedure
  ) like '%private.catalog_operator_product_holds%'
    and pg_catalog.pg_get_functiondef(
      'private.catalog_product_is_servable(uuid)'::regprocedure
    ) not like '%public.catalog_corrections%',
  'the central serving predicate consults independent holds, not erasable reports'
);

select ok(
  pg_catalog.pg_get_functiondef(
    'private.catalog_launch_curation_dependency_snapshot(uuid,uuid)'::regprocedure
  ) like '%catalog_operator_product_holds%'
    and pg_catalog.pg_get_functiondef(
      'private.catalog_launch_curation_dependency_snapshot(uuid,uuid)'::regprocedure
    ) like '%dependency-snapshot-v3%',
  'CAT-03 dependency snapshots seal the independent hold set and count'
);

select ok(
  pg_catalog.pg_get_functiondef(
    'catalog_operator_gateway.catalog_operator_release_hold(uuid,text,text,text,bigint,uuid,uuid,uuid,bigint,uuid,text)'::regprocedure
  ) like '%CATALOG_OPERATOR_THIRD_PERSON_RELEASE_REQUIRED%'
    and pg_catalog.pg_get_functiondef(
      'catalog_operator_gateway.catalog_operator_release_hold(uuid,text,text,text,bigint,uuid,uuid,uuid,bigint,uuid,text)'::regprocedure
    ) like '%catalog_launch_curation_record_is_structurally_valid%'
    and pg_catalog.pg_get_functiondef(
      'catalog_operator_gateway.catalog_operator_release_hold(uuid,text,text,text,bigint,uuid,uuid,uuid,bigint,uuid,text)'::regprocedure
    ) like '%catalog_operator_append_hold_mutation%'
    and pg_catalog.pg_get_functiondef(
      'catalog_operator_gateway.catalog_operator_release_hold(uuid,text,text,text,bigint,uuid,uuid,uuid,bigint,uuid,text)'::regprocedure
    ) not like '%activate_catalog_launch_curation%',
  'hold release requires current CAT-02/CAT-03 proof, distinct people, advances served-state, and never auto-reactivates'
);

select ok(
  pg_catalog.pg_get_functiondef(
    'catalog_operator_gateway.catalog_operator_transition(uuid,text,text,text,bigint,uuid,text,uuid,uuid,bigint,text,text,text)'::regprocedure
  ) like '%catalog_operator_hold_lifecycle_actor_ids%'
    and pg_catalog.pg_get_functiondef(
      'catalog_operator_gateway.catalog_operator_transition(uuid,text,text,text,bigint,uuid,text,uuid,uuid,bigint,text,text,text)'::regprocedure
    ) like '%v_auth.actor_user_id = any(v_hold_lifecycle_actor_ids)%'
    and pg_catalog.pg_get_functiondef(
      'catalog_operator_gateway.catalog_operator_transition(uuid,text,text,text,bigint,uuid,text,uuid,uuid,bigint,text,text,text)'::regprocedure
    ) like '%CATALOG_OPERATOR_CURRENT_CAT02_CAT03_REPAIR_PROOF_REQUIRED%',
  'triage, disposition, repair attestation, and release identities are separated before proof can advance'
);

select ok(
  pg_catalog.pg_get_functiondef(
    'catalog_operator_gateway.catalog_operator_detail(uuid,text,text,text,bigint,text,uuid,uuid,bigint)'::regprocedure
  ) not like '%intake_health_epoch%'
    and pg_catalog.pg_get_functiondef(
      'catalog_operator_gateway.catalog_operator_detail(uuid,text,text,text,bigint,text,uuid,uuid,bigint)'::regprocedure
    ) not like '%intake_request_digest%'
    and pg_catalog.pg_get_functiondef(
      'catalog_operator_gateway.catalog_operator_detail(uuid,text,text,text,bigint,text,uuid,uuid,bigint)'::regprocedure
    ) not like '%client_context%'
    and pg_catalog.pg_get_functiondef(
      'catalog_operator_gateway.catalog_operator_detail(uuid,text,text,text,bigint,text,uuid,uuid,bigint)'::regprocedure
    ) like '%detail_viewed%',
  'operator detail excludes internal/report-owner context and appends an access audit event'
);

select ok(
  exists (
    select 1
    from pg_catalog.pg_trigger as trigger
    where trigger.tgrelid = 'public.catalog_corrections'::regclass
      and trigger.tgname = 'catalog_operator_correction_work_cleanup'
      and not trigger.tgisinternal
  )
    and not exists (
      select 1
      from pg_catalog.pg_trigger as trigger
      where trigger.tgrelid = 'public.catalog_corrections'::regclass
        and trigger.tgname = 'catalog_launch_mutation_operator_corrections'
        and not trigger.tgisinternal
    ),
  'report deletion cleans ephemeral operator work and no longer mutates served-state directly'
);

select ok(
  not has_function_privilege(
    'authenticated',
    'public.review_catalog_import(uuid,text,jsonb,text,text,text,text[],text,text)',
    'execute'
  )
    and not has_function_privilege(
      'authenticated',
      'public.promote_catalog_import(uuid,text,text,text,text)',
      'execute'
    )
    and not has_function_privilege(
      'authenticated',
      'public.rollback_catalog_import(uuid,text,text,text,text,text)',
      'execute'
    ),
  'source-review recommendations do not inherit CAT-02 approval, promotion, or rollback authority'
);

-- Direct PostgREST roles cannot invoke any operator RPC, even with a user JWT.
insert into auth.users (id, email, email_confirmed_at)
values
  (
    '63000000-0000-4000-8000-000000000001',
    'operator-one@example.test',
    pg_catalog.clock_timestamp()
  ),
  (
    '63000000-0000-4000-8000-000000000002',
    'operator-two@example.test',
    pg_catalog.clock_timestamp()
  ),
  (
    '63000000-0000-4000-8000-000000000003',
    'operator-three@example.test',
    pg_catalog.clock_timestamp()
  );

do $$
begin
  for i in 1..60 loop
    perform private.consume_catalog_operator_rate_budget(
      '63000000-0000-4000-8000-000000000001',
      'queue',
      false
    );
  end loop;
end;
$$;

select throws_ok(
  $$select private.consume_catalog_operator_rate_budget(
    '63000000-0000-4000-8000-000000000001', 'queue', false
  )$$,
  '54000',
  'CATALOG_OPERATOR_RATE_LIMITED',
  'the sixty-request queue budget denies request sixty-one'
);

select is(
  (
    select bucket.request_count
    from private.catalog_operator_rate_buckets as bucket
    where bucket.operator_user_id =
      '63000000-0000-4000-8000-000000000001'
      and bucket.budget_class = 'queue'
  ),
  60,
  'a denied request leaves the actor queue bucket pinned at its limit'
);

select lives_ok(
  $$select private.consume_catalog_operator_rate_budget(
    '63000000-0000-4000-8000-000000000002', 'queue', false
  )$$,
  'a separate actor has an independent queue budget'
);

select private.consume_catalog_operator_rate_budget(
  '63000000-0000-4000-8000-000000000002',
  'preflight',
  true
);
select ok(
  not exists (
    select 1
    from private.catalog_operator_rate_buckets as bucket
    where bucket.operator_user_id =
      '63000000-0000-4000-8000-000000000002'
      and bucket.budget_class = 'preflight'
  )
    and (
      select bucket.request_count = 1
      from private.catalog_operator_rate_buckets as bucket
      where bucket.operator_user_id =
        '63000000-0000-4000-8000-000000000002'
        and bucket.budget_class = 'all'
    ),
  'a separately committed preflight spends only the global attempt budget'
);

do $$
begin
  for i in 1..120 loop
    perform private.consume_catalog_operator_rate_budget(
      '63000000-0000-4000-8000-000000000003',
      'preflight',
      true
    );
  end loop;
end;
$$;
select throws_ok(
  $$select private.consume_catalog_operator_rate_budget(
    '63000000-0000-4000-8000-000000000003', 'preflight', true
  )$$,
  '54000',
  'CATALOG_OPERATOR_RATE_LIMITED',
  'the global attempt budget denies request one hundred twenty-one'
);

insert into private.catalog_operator_rate_buckets (
  operator_user_id, budget_class, window_start,
  window_seconds, request_count, expires_at
) values (
  '63000000-0000-4000-8000-000000000002',
  'detail',
  pg_catalog.date_bin(
    interval '15 minutes',
    pg_catalog.clock_timestamp(),
    '2001-01-01 00:00:00+00'::timestamptz
  ) - interval '2 hours',
  900,
  1,
  pg_catalog.date_bin(
    interval '15 minutes',
    pg_catalog.clock_timestamp(),
    '2001-01-01 00:00:00+00'::timestamptz
  ) - interval '1 hour'
);
select private.consume_catalog_operator_rate_budget(
  '63000000-0000-4000-8000-000000000002',
  'preflight',
  true
);
select ok(
  not exists (
    select 1
    from private.catalog_operator_rate_buckets as bucket
    where bucket.expires_at <= pg_catalog.now()
  ),
  'bounded rate admission purges expired ephemeral buckets'
);

set local role authenticated;
select pg_catalog.set_config(
  'request.jwt.claims',
  '{"sub":"63000000-0000-4000-8000-000000000001","role":"authenticated","aal":"aal1","session_id":"63100000-0000-4000-8000-000000000001","is_anonymous":false}',
  true
);
select throws_ok(
  $$select * from catalog_operator_gateway.catalog_operator_session(
    '63100000-0000-4000-8000-000000000001',
    'development', repeat('a', 40), 'local_cat08_test', 2, 'session'
  )$$,
  '42501',
  'permission denied for schema catalog_operator_gateway',
  'authenticated cannot bypass the Edge boundary through the session RPC'
);
select throws_ok(
  $$select * from catalog_operator_gateway.catalog_operator_queue(
    '63100000-0000-4000-8000-000000000001',
    'development', repeat('a', 40), 'local_cat08_test', 2, 'correction'
  )$$,
  '42501',
  'permission denied for schema catalog_operator_gateway',
  'authenticated cannot directly read an operator queue'
);
select throws_ok(
  $$select * from catalog_operator_gateway.catalog_operator_detail(
    '63100000-0000-4000-8000-000000000001',
    'development', repeat('a', 40), 'local_cat08_test', 2,
    'correction_report', gen_random_uuid(), gen_random_uuid(), 1
  )$$,
  '42501',
  'permission denied for schema catalog_operator_gateway',
  'authenticated cannot directly read operator detail'
);
select throws_ok(
  $$select * from catalog_operator_gateway.catalog_operator_claim(
    '63100000-0000-4000-8000-000000000001',
    'development', repeat('a', 40), 'local_cat08_test', 2,
    gen_random_uuid(), 'correction_report', gen_random_uuid(), 1
  )$$,
  '42501',
  'permission denied for schema catalog_operator_gateway',
  'authenticated cannot directly acquire an operator lease'
);
select throws_ok(
  $$select * from catalog_operator_gateway.catalog_operator_transition(
    '63100000-0000-4000-8000-000000000001',
    'development', repeat('a', 40), 'local_cat08_test', 2,
    gen_random_uuid(), 'correction_report', gen_random_uuid(),
    gen_random_uuid(), 1, 'triage', 'wrong_match_confirmed', null
  )$$,
  '42501',
  'permission denied for schema catalog_operator_gateway',
  'authenticated cannot directly mutate an operator workflow'
);
select throws_ok(
  $$select * from catalog_operator_gateway.catalog_operator_release_hold(
    '63100000-0000-4000-8000-000000000001',
    'development', repeat('a', 40), 'local_cat08_test', 2,
    gen_random_uuid(), gen_random_uuid(), gen_random_uuid(), 1,
    gen_random_uuid(), 'repair_verified_current'
  )$$,
  '42501',
  'permission denied for schema catalog_operator_gateway',
  'authenticated cannot directly release a hold'
);
reset role;

select ok(
  (
    select control.admission_state = 'frozen'
      and control.environment = 'unconfigured'
      and control.control_generation = 1
    from private.catalog_operator_runtime_control as control
    where control.singleton
  ),
  'operator admission starts frozen and unconfigured'
);

update private.catalog_operator_runtime_control
set control_generation = 2,
    admission_state = 'open',
    environment = 'development',
    source_revision = repeat('a', 40),
    edge_deployment_id = 'local_cat08_test',
    reason_code = 'deployment_cutover',
    change_receipt_sha256 = repeat('b', 64),
    changed_at = pg_catalog.clock_timestamp() + interval '1 millisecond'
where singleton;

select throws_ok(
  $$select * from private.catalog_operator_runtime_authority(
    'development', repeat('c', 40), 'local_cat08_test', 2
  )$$,
  '42501',
  'CATALOG_OPERATOR_RUNTIME_FROZEN_OR_MISMATCH',
  'a source revision mismatch fails closed at the database boundary'
);

insert into auth.sessions (id, user_id) values (
  '63100000-0000-4000-8000-000000000001',
  '63000000-0000-4000-8000-000000000001'
);
select throws_ok(
  $$select * from private.catalog_operator_current_auth(
    '63100000-0000-4000-8000-000000000001',
    'development', repeat('a', 40), 'local_cat08_test', 2
  )$$,
  '28000',
  'CATALOG_OPERATOR_AAL2_SESSION_REQUIRED',
  'the backend selector cannot elevate a real AAL1 Auth session'
);
select throws_ok(
  $$select * from private.catalog_operator_current_auth(
    '63100000-0000-4000-8000-000000000099',
    'development', repeat('a', 40), 'local_cat08_test', 2
  )$$,
  '28000',
  'CATALOG_OPERATOR_AAL2_SESSION_REQUIRED',
  'the backend selector cannot fabricate an Auth session'
);

-- State-machine fixtures use a transaction-local auth-context substitute so
-- they exercise CAT-08 itself without mutating Supabase-managed MFA tables.
create temp table cat08_test_auth (
  actor_user_id uuid primary key,
  auth_session_id uuid not null,
  mfa_factor_id uuid not null,
  operator_session_id uuid not null,
  grant_id uuid not null
);
create temp table cat08_test_state (
  state_key text primary key,
  value_uuid uuid,
  value_bigint bigint,
  value_text text
);
grant select, insert, update, delete on cat08_test_state to authenticated;
grant select, insert, update, delete on cat08_test_state to service_role;
grant select, insert, update, delete on cat08_test_state to catalog_operator_edge;

insert into auth.users (id) values
  ('63000000-0000-4000-8000-000000000010'),
  ('63000000-0000-4000-8000-000000000011'),
  ('63000000-0000-4000-8000-000000000012'),
  ('63000000-0000-4000-8000-000000000013'),
  ('63000000-0000-4000-8000-000000000014'),
  ('63000000-0000-4000-8000-000000000015'),
  ('63000000-0000-4000-8000-000000000016'),
  ('63000000-0000-4000-8000-000000000017'),
  ('63000000-0000-4000-8000-000000000018');

create or replace function pg_temp.cat08_provision(
  p_actor uuid,
  p_capabilities text[] default null,
  p_session_established_at timestamptz default null,
  p_session_expires_at timestamptz default null
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_now timestamptz := pg_catalog.clock_timestamp();
  v_attestation uuid := gen_random_uuid();
  v_grant uuid := gen_random_uuid();
  v_operator_session uuid := gen_random_uuid();
  v_auth_session uuid := gen_random_uuid();
  v_factor uuid := gen_random_uuid();
  v_capability text;
  v_capabilities text[];
  v_session_established_at timestamptz := coalesce(
    p_session_established_at, v_now
  );
  v_session_expires_at timestamptz := coalesce(
    p_session_expires_at, v_now + interval '9 minutes'
  );
begin
  select pg_catalog.array_agg(distinct capability order by capability)
    into v_capabilities
  from pg_catalog.unnest(coalesce(p_capabilities, array[
    'catalog_hold_release',
    'catalog_repair_attest',
    'catalog_hold_claim',
    'correction_claim',
    'correction_disposition',
    'correction_queue_read',
    'correction_triage',
    'source_claim',
    'source_queue_read',
    'source_review_record'
  ])) as requested(capability);

  insert into private.catalog_operator_grant_attestations (
    id, operator_user_id, attested_by_user_id,
    authority_receipt_sha256, evidence_sha256,
    attested_at, valid_until
  ) values (
    v_attestation, p_actor,
    '63000000-0000-4000-8000-000000000014',
    private.catalog_operator_sha256(
      pg_catalog.jsonb_build_object('actor', p_actor, 'kind', 'authority')
    ),
    private.catalog_operator_sha256(
      pg_catalog.jsonb_build_object('actor', p_actor, 'kind', 'evidence')
    ),
    v_now, v_now + interval '1 day'
  );
  insert into private.catalog_operator_grants (
    id, operator_user_id, attestation_id, issued_by_user_id,
    issued_at, valid_from, valid_until, grant_sha256
  ) values (
    v_grant, p_actor, v_attestation,
    '63000000-0000-4000-8000-000000000015',
    v_now, v_now, v_now + interval '1 day',
    private.catalog_operator_grant_sha256(
      p_actor, v_attestation,
      '63000000-0000-4000-8000-000000000015',
      v_now, v_now, v_now + interval '1 day'
    )
  );
  foreach v_capability in array v_capabilities loop
    insert into private.catalog_operator_capability_bindings (
      grant_id, capability, bound_at, binding_sha256
    ) values (
      v_grant, v_capability, v_now,
      private.catalog_operator_binding_sha256(
        v_grant, v_capability, v_now
      )
    );
  end loop;
  insert into private.catalog_operator_sessions (
    id, operator_user_id, auth_session_id, mfa_factor_id,
    grant_ids, capability_set_sha256, established_at, expires_at,
    runtime_control_generation, edge_environment, source_revision,
    edge_deployment_id
  ) values (
    v_operator_session, p_actor, v_auth_session, v_factor,
    array[v_grant],
    private.catalog_operator_sha256(pg_catalog.to_jsonb(v_capabilities)),
    v_session_established_at, v_session_expires_at,
    2, 'development', repeat('a', 40), 'local_cat08_test'
  );
  insert into pg_temp.cat08_test_auth values (
    p_actor, v_auth_session, v_factor, v_operator_session, v_grant
  );
end;
$$;

select pg_temp.cat08_provision('63000000-0000-4000-8000-000000000010');
select pg_temp.cat08_provision('63000000-0000-4000-8000-000000000011');
select pg_temp.cat08_provision('63000000-0000-4000-8000-000000000012');
select pg_temp.cat08_provision('63000000-0000-4000-8000-000000000013');
select pg_temp.cat08_provision(
  '63000000-0000-4000-8000-000000000016',
  array['correction_queue_read']
);
select pg_temp.cat08_provision(
  '63000000-0000-4000-8000-000000000017',
  null,
  pg_catalog.clock_timestamp() - interval '10 minutes',
  pg_catalog.clock_timestamp() - interval '1 minute'
);
insert into pg_temp.cat08_test_auth values (
  '63000000-0000-4000-8000-000000000018',
  '63100000-0000-4000-8000-000000000018',
  '63200000-0000-4000-8000-000000000018',
  '63300000-0000-4000-8000-000000000018',
  '63400000-0000-4000-8000-000000000018'
);

create or replace function private.catalog_operator_current_auth(
  p_auth_session_id uuid,
  p_edge_environment text,
  p_source_revision text,
  p_edge_deployment_id text,
  p_control_generation bigint
)
returns table (
  actor_user_id uuid,
  actor_email text,
  auth_session_id uuid,
  mfa_factor_id uuid,
  runtime_control_generation bigint,
  edge_environment text,
  source_revision text,
  edge_deployment_id text
)
language sql
volatile
security definer
set search_path = ''
as $$
  select fixture.actor_user_id,
         'operator-' || pg_catalog.right(fixture.actor_user_id::text, 2)
           || '@example.test',
         fixture.auth_session_id,
         fixture.mfa_factor_id,
         p_control_generation,
         p_edge_environment,
         p_source_revision,
         p_edge_deployment_id
  from pg_temp.cat08_test_auth as fixture
  where fixture.auth_session_id = p_auth_session_id
    and p_edge_environment = 'development'
    and p_source_revision = repeat('a', 40)
    and p_edge_deployment_id = 'local_cat08_test'
    and p_control_generation = 2
    and fixture.actor_user_id = nullif(
    pg_catalog.current_setting('test.catalog_operator_actor', true), ''
  )::uuid
$$;

create or replace function pg_temp.cat08_auth_session()
returns uuid
language sql
stable
security definer
set search_path = ''
as $$
  select fixture.auth_session_id
  from pg_temp.cat08_test_auth as fixture
  where fixture.actor_user_id = nullif(
    pg_catalog.current_setting('test.catalog_operator_actor', true), ''
  )::uuid
$$;
grant execute on function pg_temp.cat08_auth_session()
  to catalog_operator_edge;

-- Supabase CLI pgTAP connects as the fixed local `postgres` runner. It is
-- intentionally not a superuser, while production keeps the Edge login
-- membership-free. Add only the transaction-local membership needed for
-- SET ROLE after those invariants have been asserted above. Spell the runner
-- role explicitly: the pinned PostgreSQL 15.8 local image segfaults when a
-- GRANT role member is expressed as the CURRENT_USER role specification.
grant catalog_operator_edge to postgres;
grant usage on schema extensions to catalog_operator_edge;

set local role catalog_operator_edge;
select pg_catalog.set_config(
  'test.catalog_operator_actor',
  '63000000-0000-4000-8000-000000000018',
  true
);
select extensions.is(
  (
    select count(*)
    from catalog_operator_gateway.catalog_operator_session(
      '63100000-0000-4000-8000-000000000018',
      'development', repeat('a', 40), 'local_cat08_test', 2, 'preflight'
    )
  ),
  0::bigint,
  'a valid identity without an operator grant passes only a content-free preflight'
);
reset role;
select ok(
  (
    select bucket.request_count = 1
    from private.catalog_operator_rate_buckets as bucket
    where bucket.operator_user_id =
      '63000000-0000-4000-8000-000000000018'
      and bucket.budget_class = 'all'
  )
    and not exists (
      select 1
      from private.catalog_operator_rate_buckets as bucket
      where bucket.operator_user_id =
        '63000000-0000-4000-8000-000000000018'
        and bucket.budget_class <> 'all'
    )
    and not exists (
      select 1
      from private.catalog_operator_sessions as operator_session
      where operator_session.operator_user_id =
        '63000000-0000-4000-8000-000000000018'
    ),
  'ungranted preflight commits only the global budget and creates no work session'
);

-- Transaction-local compatibility shims keep the state-machine fixture terse.
-- They are SECURITY INVOKER and executable only by the dedicated role, so each
-- call still crosses the real schema-qualified gateway with the frozen runtime
-- tuple. The surrounding transaction rolls these test-only functions back.
create or replace function public.catalog_operator_session(uuid)
returns table (
  operator_session_id uuid,
  expires_at timestamptz,
  capabilities text[],
  operator_user_id uuid,
  operator_email text,
  edge_environment text,
  source_revision text,
  edge_deployment_id text,
  admission_state text,
  control_generation bigint
)
language sql
volatile
security invoker
set search_path = ''
as $$
  select *
  from catalog_operator_gateway.catalog_operator_session(
    $1, 'development', repeat('a', 40), 'local_cat08_test', 2, 'session'
  )
$$;

create or replace function public.catalog_operator_queue(
  uuid, text, timestamptz default null, uuid default null, integer default 25
)
returns table (
  item_kind text,
  item_id uuid,
  item_version bigint,
  status text,
  priority integer,
  created_at timestamptz,
  summary jsonb
)
language sql
volatile
security invoker
set search_path = ''
as $$
  select *
  from catalog_operator_gateway.catalog_operator_queue(
    $1, 'development', repeat('a', 40), 'local_cat08_test', 2,
    $2, $3, $4, $5
  )
$$;

create or replace function public.catalog_operator_detail(
  uuid, text, uuid, uuid, bigint
)
returns table (
  item_kind text,
  item_id uuid,
  item_version bigint,
  status text,
  detail jsonb
)
language sql
volatile
security invoker
set search_path = ''
as $$
  select *
  from catalog_operator_gateway.catalog_operator_detail(
    $1, 'development', repeat('a', 40), 'local_cat08_test', 2,
    $2, $3, $4, $5
  )
$$;

create or replace function public.catalog_operator_claim(
  uuid, uuid, text, uuid, bigint
)
returns table (
  item_kind text,
  item_id uuid,
  item_version bigint,
  lease_id uuid,
  lease_expires_at timestamptz,
  status text
)
language sql
volatile
security invoker
set search_path = ''
as $$
  select *
  from catalog_operator_gateway.catalog_operator_claim(
    $1, 'development', repeat('a', 40), 'local_cat08_test', 2,
    $2, $3, $4, $5
  )
$$;

create or replace function public.catalog_operator_transition(
  uuid, uuid, text, uuid, uuid, bigint, text, text, text
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
language sql
volatile
security invoker
set search_path = ''
as $$
  select *
  from catalog_operator_gateway.catalog_operator_transition(
    $1, 'development', repeat('a', 40), 'local_cat08_test', 2,
    $2, $3, $4, $5, $6, $7, $8, $9
  )
$$;

create or replace function public.catalog_operator_release_hold(
  uuid, uuid, uuid, uuid, bigint, uuid, text
)
returns table (
  hold_id uuid,
  item_version bigint,
  state text,
  released_at timestamptz,
  event_id uuid
)
language sql
volatile
security invoker
set search_path = ''
as $$
  select *
  from catalog_operator_gateway.catalog_operator_release_hold(
    $1, 'development', repeat('a', 40), 'local_cat08_test', 2,
    $2, $3, $4, $5, $6, $7
  )
$$;

revoke all on function public.catalog_operator_session(uuid)
  from public, anon, authenticated, service_role;
revoke all on function public.catalog_operator_queue(
  uuid, text, timestamptz, uuid, integer
) from public, anon, authenticated, service_role;
revoke all on function public.catalog_operator_detail(
  uuid, text, uuid, uuid, bigint
) from public, anon, authenticated, service_role;
revoke all on function public.catalog_operator_claim(
  uuid, uuid, text, uuid, bigint
) from public, anon, authenticated, service_role;
revoke all on function public.catalog_operator_transition(
  uuid, uuid, text, uuid, uuid, bigint, text, text, text
) from public, anon, authenticated, service_role;
revoke all on function public.catalog_operator_release_hold(
  uuid, uuid, uuid, uuid, bigint, uuid, text
) from public, anon, authenticated, service_role;
grant execute on function public.catalog_operator_session(uuid),
  public.catalog_operator_queue(uuid, text, timestamptz, uuid, integer),
  public.catalog_operator_detail(uuid, text, uuid, uuid, bigint),
  public.catalog_operator_claim(uuid, uuid, text, uuid, bigint),
  public.catalog_operator_transition(
    uuid, uuid, text, uuid, uuid, bigint, text, text, text
  ),
  public.catalog_operator_release_hold(
    uuid, uuid, uuid, uuid, bigint, uuid, text
  )
to catalog_operator_edge;

-- Authority is rechecked on every RPC: an issued session is not a cached
-- bypass for revocation, expiry, or a capability that was never bound.
insert into private.catalog_operator_grant_revocations (
  grant_id, revoked_by_user_id, reason_code, evidence_sha256, revoked_at
)
select fixture.grant_id,
       '63000000-0000-4000-8000-000000000014',
       'access_removed', repeat('d', 64),
       pg_catalog.clock_timestamp() + interval '1 day'
from pg_temp.cat08_test_auth as fixture
where fixture.actor_user_id = '63000000-0000-4000-8000-000000000013';

select ok(
  (
    select revocation.revoked_at <= pg_catalog.clock_timestamp()
    from private.catalog_operator_grant_revocations as revocation
    join pg_temp.cat08_test_auth as fixture
      on fixture.grant_id = revocation.grant_id
    where fixture.actor_user_id = '63000000-0000-4000-8000-000000000013'
  ),
  'a caller-supplied future revocation time is normalized to immediate server time'
);

insert into private.catalog_operator_claims (
  id, operation_id, item_kind, item_id, item_version,
  operator_user_id, operator_session_id, claimed_at, expires_at
)
select
  '63000000-0000-4000-8000-000000000180',
  '63000000-0000-4000-8000-000000000181',
  'catalog_source',
  '63000000-0000-4000-8000-000000000182',
  1,
  fixture.actor_user_id,
  fixture.operator_session_id,
  pg_catalog.clock_timestamp() - interval '4 minutes',
  pg_catalog.clock_timestamp() - interval '1 minute'
from pg_temp.cat08_test_auth as fixture
where fixture.actor_user_id = '63000000-0000-4000-8000-000000000016';

set local role catalog_operator_edge;
select pg_catalog.set_config(
  'test.catalog_operator_actor',
  '63000000-0000-4000-8000-000000000013', true
);
select extensions.throws_ok(
  $$select * from public.catalog_operator_queue(
    pg_temp.cat08_auth_session(), 'correction'
  )$$,
  '42501', 'CATALOG_OPERATOR_CAPABILITY_DENIED',
  'grant revocation takes effect immediately inside an issued work session'
);
select pg_catalog.set_config(
  'test.catalog_operator_actor',
  '63000000-0000-4000-8000-000000000017', true
);
select extensions.throws_ok(
  $$select * from public.catalog_operator_queue(
    pg_temp.cat08_auth_session(), 'correction'
  )$$,
  '42501', 'CATALOG_OPERATOR_CAPABILITY_DENIED',
  'an expired operator work session cannot authorize a queue read'
);
select pg_catalog.set_config(
  'test.catalog_operator_actor',
  '63000000-0000-4000-8000-000000000016', true
);
select extensions.throws_ok(
  $$select * from public.catalog_operator_queue(
    pg_temp.cat08_auth_session(), 'source_import'
  )$$,
  '42501', 'CATALOG_OPERATOR_CAPABILITY_DENIED',
  'a queue grant does not confer an unbound source capability'
);
reset role;
select ok(
  exists (
    select 1
    from private.catalog_operator_claims
    where id = '63000000-0000-4000-8000-000000000180'
  ),
  'a denied capability does not run expired-claim cleanup before authorization'
);
set local role catalog_operator_edge;
select extensions.lives_ok(
  $$select * from public.catalog_operator_queue(
    pg_temp.cat08_auth_session(), 'correction'
  )$$,
  'an exactly bound queue capability remains usable'
);
select extensions.lives_ok(
  $$select * from public.catalog_operator_queue(
    pg_temp.cat08_auth_session(), 'correction'
  )$$,
  'the authorized queue path remains usable while cleanup is due'
);
reset role;
select ok(
  not exists (
    select 1
    from private.catalog_operator_claims
    where id = '63000000-0000-4000-8000-000000000180'
  ),
  'a successful authority check runs bounded expired-claim cleanup'
);

insert into public.products (
  id, barcode, name, brand, category, source, source_id,
  status, review_status, quality_grade, recommendation_eligible,
  unresolved_correction_count, data_quality_score,
  source_ref, source_snapshot_date, last_reviewed_at
) values
  (
    '63000000-0000-4000-8000-000000000100',
    '4006381333931', 'CAT08 Accepted Product', 'CAT08 Brand', 'serum',
    'curated', (select id from public.catalog_sources where source_key = 'curated'),
    'active', 'reviewed', 'verified', false, 0, 99,
    'curated:cat08-accepted', current_date, pg_catalog.now()
  ),
  (
    '63000000-0000-4000-8000-000000000101',
    '5901234123457', 'CAT08 Rejected Product', 'CAT08 Brand', 'serum',
    'curated', (select id from public.catalog_sources where source_key = 'curated'),
    'active', 'reviewed', 'verified', false, 0, 99,
    'curated:cat08-rejected', current_date, pg_catalog.now()
  );

alter table public.catalog_corrections
  disable trigger trg_catalog_corrections_health_write;
insert into public.catalog_corrections (
  id, user_id, product_id, correction_type, status,
  description, proposed_payload, client_context
) values
  (
    '63000000-0000-4000-8000-000000000200',
    '63000000-0000-4000-8000-000000000001',
    '63000000-0000-4000-8000-000000000100',
    'wrong_match', 'open', 'Wrong match report.',
    '{"productName":"Expected product"}',
    '{"route":"catalog-report"}'
  ),
  (
    '63000000-0000-4000-8000-000000000201',
    '63000000-0000-4000-8000-000000000001',
    '63000000-0000-4000-8000-000000000101',
    'wrong_match', 'open', 'Second wrong match report.',
    '{"productName":"Other expected product"}',
    '{"route":"catalog-report"}'
  ),
  (
    '63000000-0000-4000-8000-000000000202',
    '63000000-0000-4000-8000-000000000002',
    null,
    'missing_product', 'open', 'Other owner sentinel report.',
    '{"productName":"Private sentinel"}',
    '{"route":"catalog-report"}'
  );
alter table public.catalog_corrections
  enable trigger trg_catalog_corrections_health_write;

set local role authenticated;
select pg_catalog.set_config(
  'request.jwt.claims',
  '{"sub":"63000000-0000-4000-8000-000000000001","role":"authenticated","aal":"aal1","session_id":"63100000-0000-4000-8000-000000000001","is_anonymous":false}',
  true
);
select is(
  (
    select count(*)
    from public.export_catalog_corrections_for_subject(
      '63000000-0000-4000-8000-000000000001', null, null, 500
    )
  ),
  2::bigint,
  'owner-scoped correction export returns the complete verified subject set'
);
select ok(
  not exists (
    select 1
    from public.export_catalog_corrections_for_subject(
      '63000000-0000-4000-8000-000000000001', null, null, 500
    )
    where id = '63000000-0000-4000-8000-000000000202'
       or user_id <> '63000000-0000-4000-8000-000000000001'
  ),
  'owner-scoped correction export cannot return another subject sentinel'
);
select ok(
  (
    select export_total_count = 2
      and id = '63000000-0000-4000-8000-000000000201'
    from public.export_catalog_corrections_for_subject(
      '63000000-0000-4000-8000-000000000001',
      (
        select created_at
        from public.export_catalog_corrections_for_subject(
          '63000000-0000-4000-8000-000000000001', null, null, 500
        )
        where id = '63000000-0000-4000-8000-000000000200'
      ),
      '63000000-0000-4000-8000-000000000200',
      1
    )
  ),
  'owner export total remains full while equal-time rows keyset-page by UUID'
);
select is(
  (
    select count(*)
    from public.export_catalog_corrections_for_subject(
      '63000000-0000-4000-8000-000000000001', null, null, 500
    )
  ),
  2::bigint,
  'owner export remains deterministic on a repeated first-page request'
);
select throws_ok(
  $$select * from public.export_catalog_corrections_for_subject(
    '63000000-0000-4000-8000-000000000002', null, null, 500
  )$$,
  '42501', 'CATALOG_CORRECTION_EXPORT_OWNER_REQUIRED',
  'an authenticated subject cannot export another subject report set'
);
select throws_ok(
  $$select * from public.export_catalog_corrections_for_subject(
    '63000000-0000-4000-8000-000000000001',
    pg_catalog.now(), null, 500
  )$$,
  '22023', 'CATALOG_CORRECTION_EXPORT_INPUT_INVALID',
  'owner export rejects a partial keyset cursor'
);
select ok(
  not exists (
    select 1
    from public.export_catalog_corrections_for_subject(
      '63000000-0000-4000-8000-000000000001', null, null, 1
    ) as exported
    cross join lateral pg_catalog.jsonb_object_keys(
      pg_catalog.to_jsonb(exported)
    ) as key(name)
    where key.name in (
      'assigned_to', 'resolved_by', 'resolution_note',
      'operator_reviewed_at', 'operator_reviewed_by',
      'operator_review_note', 'intake_request_id',
      'intake_health_epoch', 'intake_request_digest'
    )
  ),
  'owner export omits every internal intake and operator field'
);
select pg_catalog.set_config(
  'request.jwt.claims',
  '{"sub":"63000000-0000-4000-8000-000000000001","role":"authenticated","aal":"aal1","session_id":"63100000-0000-4000-8000-000000000099","is_anonymous":false}',
  true
);
select throws_ok(
  $$select * from public.export_catalog_corrections_for_subject(
    '63000000-0000-4000-8000-000000000001', null, null, 500
  )$$,
  '42501', 'CATALOG_CORRECTION_EXPORT_OWNER_REQUIRED',
  'a stale or fabricated auth session cannot call the owner export directly'
);
reset role;

-- Operator A claims, reads, and triages the first report.
set local role catalog_operator_edge;
select pg_catalog.set_config(
  'test.catalog_operator_actor',
  '63000000-0000-4000-8000-000000000010', true
);
select extensions.throws_ok(
  $$select * from public.catalog_operator_claim(
    pg_temp.cat08_auth_session(),
    '63000000-0000-4000-8000-00000000a090',
    'correction_report', '63000000-0000-4000-8000-000000000200', 2
  )$$,
  '40001', 'CATALOG_OPERATOR_VERSION_CONFLICT',
  'a stale expected version cannot acquire a lease'
);
insert into cat08_test_state (state_key, value_uuid, value_bigint, value_text)
select 'accepted_report_claim_a', lease_id, item_version, status
from public.catalog_operator_claim(
  pg_temp.cat08_auth_session(),
  '63000000-0000-4000-8000-00000000a001',
  'correction_report', '63000000-0000-4000-8000-000000000200', 1
);
select extensions.is(
  (
    select detail ? 'correctionType'
      and detail ? 'description'
      and not detail ? 'userId'
      and not detail ? 'clientContext'
      and not detail ? 'intakeHealthEpoch'
    from public.catalog_operator_detail(
      pg_temp.cat08_auth_session(),
      'correction_report',
      '63000000-0000-4000-8000-000000000200',
      (
        select value_uuid from cat08_test_state
        where state_key = 'accepted_report_claim_a'
      ),
      1
    )
  ),
  true,
  'claim-bound correction detail is useful but excludes reporter and internal intake fields'
);
select extensions.lives_ok(
  $$select * from public.catalog_operator_detail(
    pg_temp.cat08_auth_session(),
    'correction_report',
    '63000000-0000-4000-8000-000000000200',
    (
      select value_uuid from cat08_test_state
      where state_key = 'accepted_report_claim_a'
    ),
    1
  )$$,
  're-reading detail within the same live lease remains idempotent'
);
select extensions.is(
  (
    select lease_id
    from public.catalog_operator_claim(
      pg_temp.cat08_auth_session(),
      '63000000-0000-4000-8000-00000000a001',
      'correction_report', '63000000-0000-4000-8000-000000000200', 1
    )
  ),
  (select value_uuid from cat08_test_state
    where state_key = 'accepted_report_claim_a'),
  'an exact claim operation replay returns the original database lease'
);
select extensions.throws_ok(
  $$select * from public.catalog_operator_claim(
    pg_temp.cat08_auth_session(),
    '63000000-0000-4000-8000-00000000a001',
    'correction_report', '63000000-0000-4000-8000-000000000200', 2
  )$$,
  '55000', 'CATALOG_OPERATOR_OPERATION_CONFLICT',
  'reusing an operation ID with changed request bytes fails deterministically'
);
select extensions.throws_ok(
  $$select * from public.catalog_operator_transition(
    pg_temp.cat08_auth_session(),
    '63000000-0000-4000-8000-00000000a091',
    'correction_report', '63000000-0000-4000-8000-000000000200',
    '63000000-0000-4000-8000-00000000dead',
    1, 'triage', 'wrong_match_confirmed', null
  )$$,
  '55P03', 'CATALOG_OPERATOR_LEASE_INVALID',
  'a transition cannot use a wrong or unissued lease'
);
insert into cat08_test_state (state_key, value_uuid, value_bigint, value_text)
select 'accepted_hold', hold_id, item_version, status
from public.catalog_operator_transition(
  pg_temp.cat08_auth_session(),
  '63000000-0000-4000-8000-00000000a002',
  'correction_report', '63000000-0000-4000-8000-000000000200',
  (select value_uuid from cat08_test_state where state_key = 'accepted_report_claim_a'),
  1, 'triage', 'wrong_match_confirmed', null
);
select extensions.is(
  (
    select hold_id
    from public.catalog_operator_transition(
      pg_temp.cat08_auth_session(),
      '63000000-0000-4000-8000-00000000a002',
      'correction_report', '63000000-0000-4000-8000-000000000200',
      (select value_uuid from cat08_test_state
        where state_key = 'accepted_report_claim_a'),
      1, 'triage', 'wrong_match_confirmed', null
    )
  ),
  (select value_uuid from cat08_test_state where state_key = 'accepted_hold'),
  'an exact transition replay returns its original hold receipt after lease consumption'
);
reset role;

select is(
  (
    select count(*)
    from private.catalog_operator_audit_events as event
    where event.event_type = 'detail_viewed'
      and event.event_payload ->> 'leaseId' = (
        select value_uuid::text from cat08_test_state
        where state_key = 'accepted_report_claim_a'
      )
  ),
  1::bigint,
  'one lease can append at most one immutable detail-view audit event'
);
select ok(
  (
    select hold.state = 'active'
      and hold.version = 1
      and hold.triaged_by_user_id =
        '63000000-0000-4000-8000-000000000010'
      and hold.disposition is null
    from private.catalog_operator_product_holds as hold
    where hold.id = (
      select value_uuid from cat08_test_state where state_key = 'accepted_hold'
    )
  ),
  'triage creates a reporter-free active product hold attributed to the Auth-session user'
);
select is(
  (
    select unresolved_correction_count
    from public.products
    where id = '63000000-0000-4000-8000-000000000100'
  ),
  1,
  'triage closes the denormalized recommendation projection from independent holds'
);
select is(
  (
    select status from public.catalog_corrections
    where id = '63000000-0000-4000-8000-000000000200'
  ),
  'open',
  'the erasable reporter row is not repurposed as global hold authority'
);
select ok(
  exists (
    select 1
    from private.catalog_operator_audit_events as event
    where event.subject_kind = 'correction_workflow'
      and event.subject_id is null
      and event.product_id = '63000000-0000-4000-8000-000000000100'
      and event.event_type = 'correction_triage'
      and not (
        event.event_payload ?| array[
          'correctionId', 'userId', 'description', 'barcode'
        ]
      )
  ),
  'correction audit is immutable and contains no reporter identity or correction link'
);

-- The triager cannot provide the second-person disposition.
set local role catalog_operator_edge;
select pg_catalog.set_config(
  'test.catalog_operator_actor',
  '63000000-0000-4000-8000-000000000010', true
);
insert into cat08_test_state (state_key, value_uuid)
select 'accepted_report_claim_same', lease_id
from public.catalog_operator_claim(
  pg_temp.cat08_auth_session(),
  '63000000-0000-4000-8000-00000000a003',
  'correction_report', '63000000-0000-4000-8000-000000000200', 2
);
select extensions.throws_ok(
  $$select * from public.catalog_operator_transition(
    pg_temp.cat08_auth_session(),
    '63000000-0000-4000-8000-00000000a004',
    'correction_report', '63000000-0000-4000-8000-000000000200',
    (select value_uuid from cat08_test_state where state_key = 'accepted_report_claim_same'),
    2, 'accept', 'repair_required', null
  )$$,
  '42501', 'CATALOG_OPERATOR_SECOND_PERSON_REQUIRED',
  'the triage actor cannot accept the same report'
);
reset role;
delete from private.catalog_operator_claims
where id = (select value_uuid from cat08_test_state
  where state_key = 'accepted_report_claim_same');

-- Operator B is the distinct disposition actor.
set local role catalog_operator_edge;
select pg_catalog.set_config(
  'test.catalog_operator_actor',
  '63000000-0000-4000-8000-000000000011', true
);
insert into cat08_test_state (state_key, value_uuid)
select 'accepted_report_claim_b', lease_id
from public.catalog_operator_claim(
  pg_temp.cat08_auth_session(),
  '63000000-0000-4000-8000-00000000b001',
  'correction_report', '63000000-0000-4000-8000-000000000200', 2
);
select extensions.lives_ok(
  $$select * from public.catalog_operator_transition(
    pg_temp.cat08_auth_session(),
    '63000000-0000-4000-8000-00000000b002',
    'correction_report', '63000000-0000-4000-8000-000000000200',
    (select value_uuid from cat08_test_state where state_key = 'accepted_report_claim_b'),
    2, 'accept', 'repair_required', null
  )$$,
  'a distinct disposition operator may accept while the independent hold stays active'
);
reset role;

select ok(
  (
    select hold.state = 'active'
      and hold.version = 2
      and hold.disposition = 'accepted'
      and hold.disposition_by_user_id =
        '63000000-0000-4000-8000-000000000011'
    from private.catalog_operator_product_holds as hold
    where hold.id = (
      select value_uuid from cat08_test_state where state_key = 'accepted_hold'
    )
  ),
  'accepted is a distinct, role-separated disposition and does not release the hold'
);
set local role authenticated;
select pg_catalog.set_config(
  'request.jwt.claims',
  '{"sub":"63000000-0000-4000-8000-000000000001","role":"authenticated","aal":"aal1","session_id":"63100000-0000-4000-8000-000000000001","is_anonymous":false}',
  true
);
select ok(
  (
    select exported.status = 'accepted'
      and pg_catalog.isfinite(exported.updated_at)
    from public.export_catalog_corrections_for_subject(
      '63000000-0000-4000-8000-000000000001', null, null, 500
    ) as exported
    where exported.id = '63000000-0000-4000-8000-000000000200'
  ),
  'owner export reports authoritative operator status with its effective update time'
);
reset role;

-- Model a hold whose captured CAT-02/CAT-03 projection is stale without
-- manufacturing a replacement seal. This reaches the exact current-proof gate
-- while leaving the served product and launch authorities untouched.
update private.catalog_operator_product_holds as hold
set baseline_product_record_sha256 = repeat('f', 64),
    baseline_served_state_mutation_root_sha256 = repeat('f', 64)
where hold.id = (
  select value_uuid from cat08_test_state where state_key = 'accepted_hold'
);

-- The disposition actor cannot attest repair; a third actor reaches the exact
-- CAT-02/CAT-03 proof gate and fails because this fixture has no sealed proof.
set local role catalog_operator_edge;
select pg_catalog.set_config(
  'test.catalog_operator_actor',
  '63000000-0000-4000-8000-000000000011', true
);
insert into cat08_test_state (state_key, value_uuid)
select 'accepted_hold_claim_b', lease_id
from public.catalog_operator_claim(
  pg_temp.cat08_auth_session(),
  '63000000-0000-4000-8000-00000000b003',
  'product_hold',
  (select value_uuid from cat08_test_state where state_key = 'accepted_hold'),
  2
);
select extensions.throws_ok(
  $$select * from public.catalog_operator_transition(
    pg_temp.cat08_auth_session(),
    '63000000-0000-4000-8000-00000000b004', 'product_hold',
    (select value_uuid from cat08_test_state where state_key = 'accepted_hold'),
    (select value_uuid from cat08_test_state where state_key = 'accepted_hold_claim_b'),
    2, 'attest_repair', 'cat02_cat03_repair_verified', repeat('a', 64)
  )$$,
  '42501', 'CATALOG_OPERATOR_REPAIR_ATTESTATION_SEPARATION_REQUIRED',
  'the disposition actor cannot attest the repair'
);
reset role;
delete from private.catalog_operator_claims
where id = (select value_uuid from cat08_test_state
  where state_key = 'accepted_hold_claim_b');

set local role catalog_operator_edge;
select pg_catalog.set_config(
  'test.catalog_operator_actor',
  '63000000-0000-4000-8000-000000000012', true
);
insert into cat08_test_state (state_key, value_uuid)
select 'accepted_hold_claim_c', lease_id
from public.catalog_operator_claim(
  pg_temp.cat08_auth_session(),
  '63000000-0000-4000-8000-00000000c001',
  'product_hold',
  (select value_uuid from cat08_test_state where state_key = 'accepted_hold'),
  2
);
select extensions.throws_ok(
  $$select * from public.catalog_operator_transition(
    pg_temp.cat08_auth_session(),
    '63000000-0000-4000-8000-00000000c002', 'product_hold',
    (select value_uuid from cat08_test_state where state_key = 'accepted_hold'),
    (select value_uuid from cat08_test_state where state_key = 'accepted_hold_claim_c'),
    2, 'attest_repair', 'cat02_cat03_repair_verified', repeat('b', 64)
  )$$,
  '55000', 'CATALOG_OPERATOR_CURRENT_CAT02_CAT03_REPAIR_PROOF_REQUIRED',
  'a separated repair actor still cannot attest without exact current CAT-02/CAT-03 proof'
);
reset role;
delete from private.catalog_operator_claims
where id = (select value_uuid from cat08_test_state
  where state_key = 'accepted_hold_claim_c');

-- Rejected is a truthful disposition, not an automatic release or dead end.
set local role catalog_operator_edge;
select pg_catalog.set_config(
  'test.catalog_operator_actor',
  '63000000-0000-4000-8000-000000000010', true
);
insert into cat08_test_state (state_key, value_uuid)
select 'rejected_report_claim_a', lease_id
from public.catalog_operator_claim(
  pg_temp.cat08_auth_session(),
  '63000000-0000-4000-8000-00000000a011',
  'correction_report', '63000000-0000-4000-8000-000000000201', 1
);
insert into cat08_test_state (state_key, value_uuid)
select 'rejected_hold', hold_id
from public.catalog_operator_transition(
  pg_temp.cat08_auth_session(),
  '63000000-0000-4000-8000-00000000a012',
  'correction_report', '63000000-0000-4000-8000-000000000201',
  (select value_uuid from cat08_test_state where state_key = 'rejected_report_claim_a'),
  1, 'triage', 'wrong_match_confirmed', null
);
reset role;

set local role catalog_operator_edge;
select pg_catalog.set_config(
  'test.catalog_operator_actor',
  '63000000-0000-4000-8000-000000000011', true
);
insert into cat08_test_state (state_key, value_uuid)
select 'rejected_report_claim_b', lease_id
from public.catalog_operator_claim(
  pg_temp.cat08_auth_session(),
  '63000000-0000-4000-8000-00000000b011',
  'correction_report', '63000000-0000-4000-8000-000000000201', 2
);
select extensions.lives_ok(
  $$select * from public.catalog_operator_transition(
    pg_temp.cat08_auth_session(),
    '63000000-0000-4000-8000-00000000b012',
    'correction_report', '63000000-0000-4000-8000-000000000201',
    (select value_uuid from cat08_test_state where state_key = 'rejected_report_claim_b'),
    2, 'reject', 'not_reproducible', null
  )$$,
  'a distinct operator may reject a triaged report without silently releasing its product hold'
);
reset role;

select ok(
  (
    select hold.state = 'active'
      and hold.version = 2
      and hold.disposition = 'rejected'
      and hold.disposition_by_user_id =
        '63000000-0000-4000-8000-000000000011'
    from private.catalog_operator_product_holds as hold
    where hold.id = (
      select value_uuid from cat08_test_state where state_key = 'rejected_hold'
    )
  ),
  'rejected is recorded as a disposition while the independent hold remains active for proof-bound release'
);
select ok(
  exists (
    select 1 from private.catalog_operator_hold_events as event
    where event.hold_id = (
      select value_uuid from cat08_test_state where state_key = 'rejected_hold'
    ) and event.event_type = 'hold_rejected'
  ),
  'rejected disposition appends an immutable hold event'
);

-- Source/import review records a recommendation without mutating CAT-01/02.
insert into cat08_test_state (state_key, value_uuid, value_text)
select 'curated_review_before', id, review_status
from public.catalog_sources where source_key = 'curated';
set local role catalog_operator_edge;
select pg_catalog.set_config(
  'test.catalog_operator_actor',
  '63000000-0000-4000-8000-000000000010', true
);
insert into cat08_test_state (state_key, value_uuid)
select 'source_claim_a', lease_id
from public.catalog_operator_claim(
  pg_temp.cat08_auth_session(),
  '63000000-0000-4000-8000-00000000a021', 'catalog_source',
  (select value_uuid from cat08_test_state
    where state_key = 'curated_review_before'), 1
);
select extensions.lives_ok(
  $$select * from public.catalog_operator_transition(
    pg_temp.cat08_auth_session(),
    '63000000-0000-4000-8000-00000000a022', 'catalog_source',
    (select value_uuid from cat08_test_state
      where state_key = 'curated_review_before'),
    (select value_uuid from cat08_test_state where state_key = 'source_claim_a'),
    1, 'request_changes', 'rights_gap', null
  )$$,
  'source review can record a bounded recommendation through the operator RPC'
);
reset role;

select is(
  (select review_status from public.catalog_sources where source_key = 'curated'),
  (select value_text from cat08_test_state where state_key = 'curated_review_before'),
  'source recommendation does not rewrite CAT-01 legal/source authority'
);
select is(
  (
    select status from private.catalog_operator_work_states
    where item_kind = 'catalog_source'
      and item_id = (select id from public.catalog_sources where source_key = 'curated')
  ),
  'changes_requested',
  'source recommendation is retained in the separate immutable-audited work plane'
);

-- Reporter withdrawal removes personal report work but not the nonpersonal
-- product hold, its events, audit, or served-state root.
insert into cat08_test_state (state_key, value_text)
select 'accepted_root_before_delete',
  private.catalog_launch_current_served_state_mutation_root_sha256(
    '63000000-0000-4000-8000-000000000100'
  );
set local role catalog_operator_edge;
select pg_catalog.set_config(
  'test.catalog_operator_actor',
  '63000000-0000-4000-8000-000000000012', true
);
insert into cat08_test_state (state_key, value_uuid)
select 'withdrawal_claim', lease_id
from public.catalog_operator_claim(
  pg_temp.cat08_auth_session(),
  '63000000-0000-4000-8000-00000000c021',
  'correction_report', '63000000-0000-4000-8000-000000000200', 3
);
reset role;
revoke usage on schema extensions from catalog_operator_edge;
revoke catalog_operator_edge from postgres;

delete from public.catalog_corrections
where id = '63000000-0000-4000-8000-000000000200';

select is(
  (
    select count(*) from private.catalog_operator_work_states
    where item_kind = 'correction_report'
      and item_id = '63000000-0000-4000-8000-000000000200'
  ),
  0::bigint,
  'report deletion purges its ephemeral operator work state'
);
select is(
  (
    select count(*) from private.catalog_operator_claims
    where item_kind = 'correction_report'
      and item_id = '63000000-0000-4000-8000-000000000200'
  ),
  0::bigint,
  'report deletion purges its active ephemeral claim'
);
select ok(
  exists (
    select 1 from private.catalog_operator_product_holds as hold
    where hold.id = (
      select value_uuid from cat08_test_state where state_key = 'accepted_hold'
    ) and hold.state = 'active'
  )
    and exists (
      select 1 from private.catalog_operator_hold_events as event
      where event.hold_id = (
        select value_uuid from cat08_test_state where state_key = 'accepted_hold'
      )
    ),
  'report deletion preserves the reporter-free product hold and hold-event chain'
);
select is(
  private.catalog_launch_current_served_state_mutation_root_sha256(
    '63000000-0000-4000-8000-000000000100'
  ),
  (select value_text from cat08_test_state
    where state_key = 'accepted_root_before_delete'),
  'deleting the report itself does not mutate CAT-03 served-state once independent holds are authoritative'
);
select is(
  (
    select unresolved_correction_count from public.products
    where id = '63000000-0000-4000-8000-000000000100'
  ),
  1,
  'report deletion cannot clear the independent product hold projection'
);
select ok(
  not exists (
    select 1
    from private.catalog_operator_audit_events as event
    where event.subject_kind = 'correction_workflow'
      and event.subject_id is not null
  )
    and not exists (
      select 1
      from private.catalog_operator_operation_receipts as receipt
      where receipt.response::text like '%63000000-0000-4000-8000-000000000200%'
    ),
  'immutable CAT-08 evidence retains no correction ID link after reporter erasure'
);

select ok(
  (
    with ordered as (
      select event.chain_sequence,
             pg_catalog.row_number() over (
               order by event.chain_sequence
             ) as expected_sequence,
             event.previous_event_sha256,
             pg_catalog.lag(event.event_sha256) over (
               order by event.chain_sequence
             ) as expected_previous
      from private.catalog_operator_audit_events as event
      where event.subject_kind = 'correction_workflow'
        and event.subject_id is null
        and event.product_id = '63000000-0000-4000-8000-000000000100'
    )
    select count(*) >= 3
      and pg_catalog.bool_and(
        chain_sequence = expected_sequence
        and previous_event_sha256 is not distinct from expected_previous
      )
    from ordered
  ),
  'global correction audit uses a contiguous sequence and exact predecessor hashes independent of wall-clock or UUID order'
);

-- Immutable evidence must remain append-only even to the migration owner.
select throws_ok(
  $$delete from private.catalog_operator_hold_events where hold_id =
    (select value_uuid from cat08_test_state where state_key = 'accepted_hold')$$,
  '55000', 'CATALOG_OPERATOR_LEDGER_IMMUTABLE',
  'hold-event history rejects deletion'
);
select throws_ok(
  $$update private.catalog_operator_audit_events
       set reason_code = 'tampered'
     where subject_kind = 'correction_workflow'$$,
  '55000', 'CATALOG_OPERATOR_LEDGER_IMMUTABLE',
  'operator audit history rejects mutation'
);
select ok(
  exists (
    select 1
    from pg_catalog.pg_trigger as trigger
    where trigger.tgrelid =
      'private.catalog_operator_repair_authority_receipts'::regclass
      and trigger.tgname = 'catalog_operator_repair_receipts_immutable'
      and not trigger.tgisinternal
  ),
  'repair authority receipts have the immutable-ledger trigger installed'
);

select * from finish();
rollback;
