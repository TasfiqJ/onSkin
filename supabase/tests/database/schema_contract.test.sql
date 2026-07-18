begin;

create extension if not exists pgtap with schema extensions;
set local search_path = extensions, public, pg_catalog;

select plan(49);

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
  58::bigint,
  'all 58 repository migrations are recorded'
);

select is(
  (select max(version) from supabase_migrations.schema_migrations),
  '20260718000059'::text,
  'migration history reaches the catalog scan-minimization gate'
);

select is(
  (
    select count(*)
    from pg_class as relation
    join pg_namespace as namespace on namespace.oid = relation.relnamespace
    where namespace.nspname = 'public'
      and relation.relkind in ('r', 'p')
  ),
  80::bigint,
  'the migrated public schema has exactly 80 tables'
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
  80::bigint,
  'row level security is enabled on every public table'
);

select has_table('auth', 'users', 'the local Supabase Auth schema is present');
select has_table('storage', 'objects', 'the local Supabase Storage schema is present');
select has_table(
  'public',
  'account_publication_leases',
  'the final account-publication fence table is present'
);
select has_table(
  'public',
  'health_processing_states',
  'the health-purpose admission state is present'
);
select has_table(
  'public',
  'health_consent_withdrawal_operations',
  'durable health-withdrawal operations are present'
);
select has_table(
  'public',
  'health_consent_withdrawal_steps',
  'health-withdrawal step receipts are present'
);
select has_table(
  'public',
  'health_consent_copy_registry',
  'the exact server-owned health disclosure registry is present'
);
select has_table(
  'public',
  'health_consent_copy_review_events',
  'immutable disclosure release-review evidence is present'
);
select has_table(
  'public',
  'health_dependent_consent_operations',
  'durable dependent consent idempotency and worker operations are present'
);
select has_table(
  'public',
  'health_dependent_consent_states',
  'the per-purpose generation and withdrawal barrier projection is present'
);

select is(
  (select count(*)
     from public.health_consent_copy_registry
    where is_current and review_status = 'draft_blocked'),
  15::bigint,
  'all exact base and dependent copy contracts remain explicitly draft-blocked'
);
select is(
  (select count(*) from public.health_consent_copy_review_events),
  0::bigint,
  'the installed migration invents no legal or privacy approval event'
);

select ok(
  (select count(*)
     from pg_catalog.pg_class as relations
    where relations.oid = any(array[
      'public.health_consent_copy_registry'::regclass,
      'public.health_consent_copy_review_events'::regclass,
      'public.health_dependent_consent_operations'::regclass,
      'public.health_dependent_consent_states'::regclass
    ])
      and relations.relrowsecurity
      and relations.relforcerowsecurity) = 4,
  'every dependent lifecycle table has enabled and forced row-level security'
);

select ok(
  not exists (
    select 1
      from unnest(array['anon', 'authenticated', 'service_role']) as api_roles(role_name)
      cross join unnest(array[
        'public.health_consent_copy_registry',
        'public.health_consent_copy_review_events',
        'public.health_dependent_consent_operations',
        'public.health_dependent_consent_states'
      ]) as sealed_tables(table_name)
     where pg_catalog.has_table_privilege(
             api_roles.role_name, sealed_tables.table_name, 'SELECT'
           )
        or pg_catalog.has_table_privilege(
             api_roles.role_name, sealed_tables.table_name, 'INSERT'
           )
        or pg_catalog.has_table_privilege(
             api_roles.role_name, sealed_tables.table_name, 'UPDATE'
           )
        or pg_catalog.has_table_privilege(
             api_roles.role_name, sealed_tables.table_name, 'DELETE'
           )
  ),
  'dependent lifecycle tables expose no direct API-role data lane'
);

select ok(
  not has_function_privilege(
    'anon',
    'public.promote_health_consent_copy_for_release(text,text,text,text,text,text,text)',
    'execute'
  )
    and not has_function_privilege(
      'authenticated',
      'public.promote_health_consent_copy_for_release(text,text,text,text,text,text,text)',
      'execute'
    )
    and not has_function_privilege(
      'service_role',
      'public.promote_health_consent_copy_for_release(text,text,text,text,text,text,text)',
      'execute'
    )
    and not has_function_privilege(
      'anon',
      'public.supersede_health_consent_copy_for_release(text,text,text,text,text,text,text,text,text)',
      'execute'
    )
    and not has_function_privilege(
      'authenticated',
      'public.supersede_health_consent_copy_for_release(text,text,text,text,text,text,text,text,text)',
      'execute'
    )
    and not has_function_privilege(
      'service_role',
      'public.supersede_health_consent_copy_for_release(text,text,text,text,text,text,text,text,text)',
      'execute'
    )
    and not has_function_privilege(
      'anon',
      'public.close_health_consent_copy_for_emergency(text,text,text,text,text,text,text)',
      'execute'
    )
    and not has_function_privilege(
      'authenticated',
      'public.close_health_consent_copy_for_emergency(text,text,text,text,text,text,text)',
      'execute'
    )
    and not has_function_privilege(
      'service_role',
      'public.close_health_consent_copy_for_emergency(text,text,text,text,text,text,text)',
      'execute'
    ),
  'no runtime API role can promote, supersede, or emergency-close disclosure copy'
);

select ok(
  (select functions.prosecdef
            and functions.proconfig @> array['search_path=""']::text[]
     from pg_catalog.pg_proc as functions
    where functions.oid =
      'public.promote_health_consent_copy_for_release(text,text,text,text,text,text,text)'::regprocedure)
    and (select functions.prosecdef
                 and functions.proconfig @> array['search_path=""']::text[]
           from pg_catalog.pg_proc as functions
          where functions.oid =
            'public.supersede_health_consent_copy_for_release(text,text,text,text,text,text,text,text,text)'::regprocedure)
    and (select functions.prosecdef
                 and functions.proconfig @> array['search_path=""']::text[]
           from pg_catalog.pg_proc as functions
          where functions.oid =
            'public.close_health_consent_copy_for_emergency(text,text,text,text,text,text,text)'::regprocedure)
    and exists (
      select 1 from pg_catalog.pg_trigger
       where tgname = 'trg_health_consent_copy_registry_lifecycle'
         and not tgisinternal
    )
    and exists (
      select 1 from pg_catalog.pg_trigger
       where tgname = 'trg_health_consent_copy_review_event_immutable'
         and not tgisinternal
    ),
  'migration-owner copy lifecycle is exact, evidence-gated, immutable, and search-path sealed'
);

select ok(
  exists (
    select 1
      from pg_catalog.pg_indexes as indexes
     where indexes.schemaname = 'public'
       and indexes.tablename = 'health_consent_copy_registry'
       and indexes.indexname = 'health_consent_copy_registry_one_current_idx'
       and indexes.indexdef like 'CREATE UNIQUE INDEX%'
       and indexes.indexdef like '%WHERE is_current%'
  )
    and exists (
      select 1
        from information_schema.columns as columns
       where columns.table_schema = 'public'
         and columns.table_name = 'health_consent_copy_review_events'
         and columns.column_name = 'event_type'
    )
    and exists (
      select 1
        from information_schema.columns as columns
       where columns.table_schema = 'public'
         and columns.table_name = 'health_consent_copy_review_events'
         and columns.column_name = 'successor_consent_text_hash'
    ),
  'versioned copy history has one partial-unique current tuple and explicit lifecycle audit fields'
);

select ok(
  has_function_privilege(
    'authenticated', 'public.get_health_dependent_consent_status(text)', 'execute'
  )
    and has_function_privilege(
      'authenticated',
      'public.record_health_dependent_consent(bigint,bigint,text,text,text,text)',
      'execute'
    )
    and has_function_privilege(
      'authenticated',
      'public.begin_health_dependent_consent_withdrawal(bigint,bigint,text,text,text,text)',
      'execute'
    )
    and not has_function_privilege(
      'authenticated',
      'public.complete_health_dependent_consent_withdrawal(uuid)',
      'execute'
    )
    and not has_function_privilege(
      'authenticated',
      'public.claim_due_health_dependent_consent_withdrawals(text,integer)',
      'execute'
    )
    and not has_function_privilege(
      'authenticated',
      'public.defer_health_dependent_consent_withdrawal(uuid,text,text,integer)',
      'execute'
    )
    and not has_function_privilege(
      'authenticated',
      'public.list_health_dependent_consent_storage_work(uuid,integer,text)',
      'execute'
    )
    and not has_function_privilege(
      'authenticated',
      'public.mark_health_dependent_consent_withdrawal_action_required(uuid,text,text)',
      'execute'
    )
    and has_function_privilege(
      'service_role',
      'public.complete_health_dependent_consent_withdrawal(uuid)',
      'execute'
    )
    and has_function_privilege(
      'service_role',
      'public.claim_due_health_dependent_consent_withdrawals(text,integer)',
      'execute'
    )
    and has_function_privilege(
      'service_role',
      'public.defer_health_dependent_consent_withdrawal(uuid,text,text,integer)',
      'execute'
    )
    and has_function_privilege(
      'service_role',
      'public.list_health_dependent_consent_storage_work(uuid,integer,text)',
      'execute'
    )
    and has_function_privilege(
      'service_role',
      'public.mark_health_dependent_consent_withdrawal_action_required(uuid,text,text)',
      'execute'
    ),
  'dependent caller and service-worker RPC lanes are strictly separated'
);

select is(
  (
    select count(*)
      from unnest(array[
        'public.get_health_dependent_consent_status(text)'::regprocedure,
        'public.record_health_dependent_consent(bigint,bigint,text,text,text,text)'::regprocedure,
        'public.begin_health_dependent_consent_withdrawal(bigint,bigint,text,text,text,text)'::regprocedure,
        'public.complete_health_dependent_consent_withdrawal(uuid)'::regprocedure,
        'public.claim_due_health_dependent_consent_withdrawals(text,integer)'::regprocedure,
        'public.list_health_dependent_consent_storage_work(uuid,integer,text)'::regprocedure,
        'public.defer_health_dependent_consent_withdrawal(uuid,text,text,integer)'::regprocedure,
        'public.mark_health_dependent_consent_withdrawal_action_required(uuid,text,text)'::regprocedure
      ]) as contracts(function_oid)
      join pg_catalog.pg_proc as functions on functions.oid = contracts.function_oid
     where functions.prosecdef
       and functions.proconfig @> array['search_path=""']::text[]
  ),
  8::bigint,
  'all dependent lifecycle RPCs are security-definer functions with an empty search path'
);

select has_column(
  'public',
  'entitlements',
  'rc_cursor_state',
  'the RevenueCat projection records its cursor authority'
);
select has_column(
  'public',
  'entitlements',
  'rc_snapshot_at',
  'the RevenueCat projection records a provider snapshot watermark'
);
select has_column(
  'public',
  'entitlements',
  'rc_snapshot_fingerprint',
  'the RevenueCat projection detects equal-watermark conflicts'
);

select ok(
  has_function_privilege('authenticated', 'public.read_entitlement_projections()', 'execute')
    and not has_function_privilege('anon', 'public.read_entitlement_projections()', 'execute')
    and not has_function_privilege('service_role', 'public.read_entitlement_projections()', 'execute'),
  'the owner-derived projection read is authenticated-only'
);

select ok(
  exists (
    select 1
      from pg_catalog.pg_constraint as constraints
     where constraints.conrelid = 'public.edge_rate_limits'::regclass
       and constraints.conname = 'edge_rate_limits_scope_owner_classification'
       and pg_catalog.pg_get_constraintdef(constraints.oid)
         like '%subscription-reconciliation%'
  )
    and pg_catalog.pg_get_functiondef(
      'public._consume_edge_rate_limit_v0048_unbound(text,text,integer,integer,uuid)'::regprocedure
    ) like '%subscription-reconciliation%',
  'subscription reconciliation has an owner-scoped database rate-limit lane'
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

select ok(
  not has_table_privilege('anon', 'public.health_processing_states', 'select')
    and not has_table_privilege('authenticated', 'public.health_processing_states', 'select')
    and not has_table_privilege('service_role', 'public.health_processing_states', 'select')
    and not has_table_privilege('service_role', 'public.health_consent_withdrawal_operations', 'select')
    and not has_table_privilege('service_role', 'public.health_consent_withdrawal_steps', 'select'),
  'health lifecycle tables are sealed behind narrow RPCs'
);

select ok(
  has_function_privilege(
    'authenticated',
    'public.begin_health_data_consent_withdrawal(bigint,text,text,text)',
    'execute'
  )
    and has_function_privilege(
      'authenticated',
      'public.grant_health_data_consent(bigint,text,text)',
      'execute'
    )
    and has_function_privilege(
      'authenticated',
      'public.decline_initial_health_data_consent(bigint,text,text)',
      'execute'
    )
    and not has_function_privilege(
      'authenticated',
      'public.prepare_health_data_consent_withdrawal(uuid,text)',
      'execute'
    )
    and not has_function_privilege(
      'authenticated',
      'public.claim_health_consent_withdrawal_for_owner(uuid,uuid,text)',
      'execute'
    )
    and has_function_privilege(
      'service_role',
      'public.claim_health_consent_withdrawal_for_owner(uuid,uuid,text)',
      'execute'
    )
    and has_function_privilege(
      'service_role',
      'public.complete_health_data_consent_withdrawal(uuid,text)',
      'execute'
    )
    and has_function_privilege(
      'service_role',
      'public.claim_due_health_consent_withdrawals(text,integer)',
      'execute'
    )
    and not has_function_privilege(
      'authenticated',
      'public.defer_health_consent_withdrawal(uuid,text,text,integer)',
      'execute'
    ),
  'health lifecycle caller and worker RPC lanes are separated'
);

select ok(
  pg_catalog.pg_get_functiondef(
    'public._request_health_processing_epoch()'::regprocedure
  ) like '%x-health-processing-epoch%'
    and pg_catalog.pg_get_functiondef(
      'public._request_health_processing_epoch()'::regprocedure
    ) like '%x-client-info%'
    and exists (
      select 1 from pg_trigger
       where tgname = 'trg_photo_storage_health_write' and not tgisinternal
    )
    and exists (
      select 1 from pg_trigger
       where tgname = 'trg_routine_completions_health_write' and not tgisinternal
    ),
  'health writes require the current epoch across database and photo Storage'
);

select ok(
  exists (
    select 1
      from information_schema.columns
     where table_schema = 'public'
       and table_name = 'community_reports'
       and column_name = 'question_id'
       and is_nullable = 'YES'
  )
    and (
      select delete_rule
        from information_schema.referential_constraints
       where constraint_schema = 'public'
         and constraint_name = 'community_reports_question_id_fkey'
    ) = 'SET NULL'
    and (
      select delete_rule
        from information_schema.referential_constraints
       where constraint_schema = 'public'
         and constraint_name = 'community_moderation_events_question_id_fkey'
    ) = 'SET NULL',
  'community safety evidence detaches instead of cascading with an erased author question'
);

select results_eq(
  $$select schemaname, tablename
      from pg_catalog.pg_policies
     where policyname = 'health_processing_read_fence'
     order by schemaname, tablename$$,
  $$values
    ('public'::name, 'active_ramp'::name),
    ('public'::name, 'ask_safety_audit'::name),
    ('public'::name, 'ask_sessions'::name),
    ('public'::name, 'ask_turn_audit'::name),
    ('public'::name, 'catalog_lookup_events'::name),
    ('public'::name, 'commerce_click_events'::name),
    ('public'::name, 'community_blocks'::name),
    ('public'::name, 'community_questions'::name),
    ('public'::name, 'community_reactions'::name),
    ('public'::name, 'community_reports'::name),
    ('public'::name, 'cycle_nights'::name),
    ('public'::name, 'cycles'::name),
    ('public'::name, 'notification_log'::name),
    ('public'::name, 'notification_preferences'::name),
    ('public'::name, 'photo_trend'::name),
    ('public'::name, 'photos'::name),
    ('public'::name, 'recommendation_preferences'::name),
    ('public'::name, 'recommendations'::name),
    ('public'::name, 'routine_completions'::name),
    ('public'::name, 'routine_conflicts'::name),
    ('public'::name, 'routine_steps'::name),
    ('public'::name, 'routines'::name),
    ('public'::name, 'skin_profiles'::name),
    ('public'::name, 'streak_freezes'::name),
    ('public'::name, 'user_products'::name),
    ('storage'::name, 'objects'::name)$$,
  'the restrictive fence covers the exact health-purpose owner/client and photo Storage inventory'
);

select is(
  (
    select count(*)
      from pg_catalog.pg_policies
     where policyname = 'health_processing_read_fence'
       and permissive = 'RESTRICTIVE'
       and cmd = 'SELECT'
       and roles = array['authenticated'::name]
       and (
         qual like '%private.health_processing_read_allowed%'
         or qual like '%private.health_dependent_read_allowed%'
       )
  ),
  26::bigint,
  'every health read fence is restrictive, authenticated-only, and uses the sealed predicate'
);

select ok(
  (select count(*) = 0 from public.shelf_scans)
    and (select count(*) = 0 from public.obf_contribution_queue)
    and (
      select relation.relrowsecurity and relation.relforcerowsecurity
        from pg_class as relation
        join pg_namespace as namespace on namespace.oid = relation.relnamespace
       where namespace.nspname = 'public'
         and relation.relname = 'shelf_scans'
         and relation.relkind in ('r', 'p')
    )
    and (
      select relation.relrowsecurity and relation.relforcerowsecurity
        from pg_class as relation
        join pg_namespace as namespace on namespace.oid = relation.relnamespace
       where namespace.nspname = 'public'
         and relation.relname = 'obf_contribution_queue'
         and relation.relkind in ('r', 'p')
    )
    and not pg_catalog.has_table_privilege('anon', 'public.shelf_scans', 'SELECT')
    and not pg_catalog.has_table_privilege('anon', 'public.shelf_scans', 'INSERT')
    and not pg_catalog.has_table_privilege('authenticated', 'public.shelf_scans', 'SELECT')
    and not pg_catalog.has_table_privilege('authenticated', 'public.shelf_scans', 'INSERT')
    and not pg_catalog.has_table_privilege('service_role', 'public.shelf_scans', 'SELECT')
    and not pg_catalog.has_table_privilege('service_role', 'public.shelf_scans', 'INSERT')
    and not pg_catalog.has_table_privilege(
      'service_role', 'public.obf_contribution_queue', 'SELECT'
    )
    and not pg_catalog.has_table_privilege(
      'service_role', 'public.obf_contribution_queue', 'INSERT'
    )
    and not pg_catalog.has_function_privilege(
      'service_role',
      'public.enqueue_obf_contribution_for_correction(uuid)',
      'EXECUTE'
    )
    and not exists (
      select 1
        from pg_catalog.pg_policies
       where schemaname = 'public'
         and tablename = 'shelf_scans'
    )
    and not exists (
      select 1
        from pg_catalog.pg_policies
       where schemaname = 'public'
         and tablename = 'obf_contribution_queue'
    ),
  'legacy raw scan and external-contribution stores are purged, force-RLS sealed, policy-free, and inaccessible to every API role'
);

select ok(
  not exists (
    select 1
      from public.catalog_lookup_events
     where query is not null
        or barcode is not null
        or matched_product_id is not null
        or source_key is not null
        or quality_grade is not null
  )
    and exists (
      select 1
        from pg_catalog.pg_constraint as constraint_record
       where constraint_record.conrelid = 'public.catalog_lookup_events'::regclass
         and constraint_record.conname = 'catalog_lookup_events_minimized_identity'
         and constraint_record.contype = 'c'
         and constraint_record.convalidated
    )
    and exists (
      select 1
        from pg_catalog.pg_constraint as constraint_record
       where constraint_record.conrelid = 'public.products'::regclass
         and constraint_record.conname = 'products_reviewed_active_barcode_gtin'
         and constraint_record.contype = 'c'
         and constraint_record.convalidated
    )
    and exists (
      select 1
        from pg_catalog.pg_constraint as constraint_record
       where constraint_record.conrelid = 'public.product_barcodes'::regclass
         and constraint_record.conname = 'product_barcodes_reviewed_barcode_gtin'
         and constraint_record.contype = 'c'
         and constraint_record.convalidated
    )
    and exists (
      select 1
        from pg_catalog.pg_constraint as constraint_record
       where constraint_record.conrelid = 'public.catalog_lookup_events'::regclass
         and constraint_record.conname = 'catalog_lookup_events_created_at_finite'
         and constraint_record.contype = 'c'
         and constraint_record.convalidated
    )
    and exists (
      select 1
        from pg_catalog.pg_trigger as trigger_record
       where trigger_record.tgrelid = 'public.catalog_lookup_events'::regclass
         and trigger_record.tgname = 'trg_catalog_lookup_events_health_write'
         and not trigger_record.tgisinternal
    )
    and not pg_catalog.has_table_privilege(
      'authenticated', 'public.catalog_lookup_events', 'INSERT'
    )
    and not pg_catalog.has_table_privilege(
      'authenticated', 'public.catalog_lookup_events', 'TRUNCATE'
    )
    and not pg_catalog.has_table_privilege(
      'service_role', 'public.catalog_lookup_events', 'TRUNCATE'
    )
    and not pg_catalog.has_table_privilege(
      'service_role', 'public.catalog_lookup_events', 'TRIGGER'
    )
    and not pg_catalog.has_function_privilege(
      'authenticated',
      'public.record_catalog_lookup_event(uuid,bigint,text,text,integer,integer)',
      'EXECUTE'
    )
    and pg_catalog.has_function_privilege(
      'service_role',
      'public.record_catalog_lookup_event(uuid,bigint,text,text,integer,integer)',
      'EXECUTE'
    )
    and private.catalog_gtin_is_canonical('012345678905')
    and private.catalog_gtin_is_canonical('10012345000017')
    and not private.catalog_gtin_is_canonical('0036000291452')
    and not private.catalog_gtin_is_canonical('04006381333931')
    and not private.catalog_gtin_is_canonical('00012345678905')
    and not private.catalog_gtin_is_canonical('00000096385074')
    and not private.catalog_gtin_is_canonical('123456789')
    and not exists (
      select 1
        from public.products as product
       where product.status = 'active'
         and product.review_status = 'reviewed'
         and private.catalog_gtin_is_canonical(product.barcode) is not true
    )
    and not exists (
      select 1
        from public.product_barcodes as mapping
       where mapping.review_status = 'reviewed'
         and private.catalog_gtin_is_canonical(mapping.barcode) is not true
    ),
  'lookup analytics are identity-free and reviewed catalog lanes contain only canonical GTIN identities'
);

select ok(
  (
    select relation.relrowsecurity and relation.relforcerowsecurity
      from pg_class as relation
      join pg_namespace as namespace on namespace.oid = relation.relnamespace
     where namespace.nspname = 'public'
       and relation.relname = 'catalog_corrections'
       and relation.relkind in ('r', 'p')
  )
    and not pg_catalog.has_table_privilege(
      'authenticated', 'public.catalog_corrections', 'SELECT'
    )
    and not pg_catalog.has_table_privilege(
      'authenticated', 'public.catalog_corrections', 'TRUNCATE'
    )
    and not pg_catalog.has_table_privilege(
      'service_role', 'public.catalog_corrections', 'TRUNCATE'
    )
    and not pg_catalog.has_table_privilege(
      'service_role', 'public.catalog_corrections', 'TRIGGER'
    )
    and pg_catalog.has_table_privilege('service_role', 'public.catalog_corrections', 'SELECT')
    and exists (
      select 1
        from pg_catalog.pg_constraint as constraint_record
       where constraint_record.conrelid = 'public.catalog_corrections'::regclass
         and constraint_record.conname = 'catalog_corrections_barcode_gtin'
         and constraint_record.contype = 'c'
         and constraint_record.convalidated
    )
    and exists (
      select 1
        from pg_catalog.pg_constraint as constraint_record
       where constraint_record.conrelid = 'public.catalog_corrections'::regclass
         and constraint_record.conname = 'catalog_corrections_payloads_no_barcode'
         and constraint_record.contype = 'c'
         and constraint_record.convalidated
    )
    and exists (
      select 1
        from pg_catalog.pg_constraint as constraint_record
       where constraint_record.conrelid = 'public.catalog_corrections'::regclass
         and constraint_record.conname = 'catalog_corrections_description_sanitized'
         and constraint_record.contype = 'c'
         and constraint_record.convalidated
    )
    and exists (
      select 1
        from pg_catalog.pg_constraint as constraint_record
       where constraint_record.conrelid = 'public.catalog_corrections'::regclass
         and constraint_record.conname = 'catalog_corrections_created_at_finite'
         and constraint_record.contype = 'c'
         and constraint_record.convalidated
    )
    and exists (
      select 1
        from pg_catalog.pg_constraint as constraint_record
       where constraint_record.conrelid = 'public.catalog_corrections'::regclass
         and constraint_record.conname = 'catalog_corrections_intake_idempotency'
         and constraint_record.contype = 'c'
         and constraint_record.convalidated
    )
    and exists (
      select 1
        from pg_catalog.pg_indexes as index_record
       where index_record.schemaname = 'public'
         and index_record.tablename = 'catalog_corrections'
         and index_record.indexname = 'catalog_corrections_owner_request_uidx'
         and index_record.indexdef ~* 'unique index'
         and index_record.indexdef ~* 'intake_request_id is not null'
    )
    and not exists (
      select 1
        from pg_catalog.pg_policies
       where schemaname = 'public'
         and tablename = 'catalog_corrections'
    )
    and not exists (
      select 1
        from public.catalog_corrections as correction
       where correction.description is distinct from private.catalog_report_safe_text(
               'description', correction.description
             )
          or correction.proposed_payload is distinct from private.catalog_sanitize_report_object(
               correction.proposed_payload, 'proposed'
             )
          or correction.client_context is distinct from private.catalog_sanitize_report_object(
               correction.client_context, 'context'
             )
    ),
  'catalog correction operator fields are sealed from clients while sanitized service export remains available'
);

select ok(
  not pg_catalog.has_schema_privilege('anon', 'private', 'USAGE')
    and not pg_catalog.has_schema_privilege('authenticated', 'private', 'USAGE')
    and not pg_catalog.has_schema_privilege('service_role', 'private', 'USAGE')
    and not pg_catalog.has_function_privilege(
      'anon', 'private.health_processing_read_allowed(uuid)', 'EXECUTE'
    )
    and pg_catalog.has_function_privilege(
      'authenticated', 'private.health_processing_read_allowed(uuid)', 'EXECUTE'
    )
    and not pg_catalog.has_function_privilege(
      'service_role', 'private.health_processing_read_allowed(uuid)', 'EXECUTE'
    ),
  'the private read predicate has only the execution privilege stored authenticated policies require'
);

select is(
  (
    select count(*)
      from unnest(array[
        'public.owns_routine(uuid)'::regprocedure,
        'public.owns_user_product(uuid)'::regprocedure,
        'public.owns_cycle(uuid)'::regprocedure,
        'public.owns_photo(uuid)'::regprocedure,
        'public.owns_ask_turn_audit(uuid)'::regprocedure
      ]) as helpers(helper)
     where pg_catalog.pg_get_functiondef(helpers.helper)
       like any(array[
         '%private.health_processing_read_allowed%',
         '%private.health_dependent_read_allowed%'
       ])
  ),
  5::bigint,
  'authenticated security-definer ownership helpers cannot bypass the health read fence'
);

set local role authenticated;
select throws_ok(
  $$select private.health_processing_read_allowed(
    '70000000-0000-4000-8000-000000000001'::uuid
  )$$,
  '42501',
  'permission denied for schema private',
  'authenticated SQL cannot address the non-exposed private predicate directly'
);
reset role;

select * from finish();
rollback;
