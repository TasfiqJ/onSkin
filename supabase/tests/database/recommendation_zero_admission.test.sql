begin;

create extension if not exists pgtap with schema extensions;
set local search_path = extensions, public, pg_catalog;

select plan(35);

select is(
  (select max(version) from supabase_migrations.schema_migrations),
  '20260926000078'::text,
  'CORE-06A recommendation zero admission remains intact through the current head'
);

select has_table(
  'private',
  'recommendation_admission_control',
  'the private recommendation admission singleton exists'
);

select is(
  (
    select pg_catalog.jsonb_build_object(
      'rows', count(*),
      'closedRows', count(*) filter (
        where control.singleton
          and control.admission_state = 'closed'
          and control.checkpoint = 'core06a_zero_admission'
          and control.reason_code = 'reviewed_corpus_not_admitted'
      )
    )
      from private.recommendation_admission_control as control
  ),
  '{"rows":1,"closedRows":1}'::jsonb,
  'the control is exactly one constrained closed checkpoint'
);

select ok(
  (
    select relations.relrowsecurity and relations.relforcerowsecurity
      from pg_catalog.pg_class as relations
     where relations.oid =
       'private.recommendation_admission_control'::regclass
  )
    and not exists (
      select 1
        from pg_catalog.pg_policies as policies
       where policies.schemaname = 'private'
         and policies.tablename = 'recommendation_admission_control'
    )
    and not exists (
      select 1
        from unnest(array['anon', 'authenticated', 'service_role']) as roles(name)
       where pg_catalog.has_table_privilege(
               roles.name,
               'private.recommendation_admission_control',
               'SELECT'
             )
          or pg_catalog.has_table_privilege(
               roles.name,
               'private.recommendation_admission_control',
               'INSERT'
             )
          or pg_catalog.has_table_privilege(
               roles.name,
               'private.recommendation_admission_control',
               'UPDATE'
             )
          or pg_catalog.has_table_privilege(
               roles.name,
               'private.recommendation_admission_control',
               'DELETE'
             )
    ),
  'the control has forced RLS, no policy, and no runtime table privilege'
);

select ok(
  exists (
    select 1
      from pg_catalog.pg_trigger as triggers
     where triggers.tgrelid =
       'private.recommendation_admission_control'::regclass
       and triggers.tgname = 'recommendation_admission_control_immutable'
       and not triggers.tgisinternal
       and triggers.tgenabled = 'O'
  ),
  'the singleton cannot be updated, deleted, or truncated in place'
);

select ok(
  exists (
    select 1
      from pg_catalog.pg_constraint as constraints
     where constraints.conrelid = 'public.products'::regclass
       and constraints.conname =
         'products_recommendation_eligibility_closed'
       and constraints.convalidated
       and pg_catalog.pg_get_constraintdef(constraints.oid)
         ilike '%recommendation_eligible IS FALSE%'
  ),
  'products carry a validated relational false-only eligibility constraint'
);

select is(
  (
    select count(*)
      from public.products as products
     where products.recommendation_eligible is not false
  ),
  0::bigint,
  'every product is recommendation-ineligible at the checkpoint'
);

select ok(
  exists (
    select 1
      from pg_catalog.pg_trigger as triggers
     where triggers.tgrelid = 'public.products'::regclass
       and triggers.tgname = 'products_recommendation_eligibility_closed'
       and not triggers.tgisinternal
       and triggers.tgenabled = 'O'
  )
    and pg_catalog.pg_get_functiondef(
      'private.force_recommendation_eligibility_closed()'::regprocedure
    ) ilike '%new.recommendation_eligible := false%',
  'every import or refresh assignment is coerced back to false'
);

select ok(
  pg_catalog.pg_get_functiondef(
    'public.refresh_product_correction_count(uuid)'::regprocedure
  ) ilike '%recommendation_eligible = false%'
    and pg_catalog.pg_get_functiondef(
      'public.refresh_product_correction_count(uuid)'::regprocedure
    ) not ilike '%quality_grade in%',
  'the current correction refresh explicitly preserves zero admission'
);

select ok(
  pg_catalog.pg_get_functiondef(
    'private.catalog_product_is_servable(uuid)'::regprocedure
  ) not ilike '%recommendation_eligible%'
    and pg_catalog.pg_get_functiondef(
      'private.catalog_product_is_servable(uuid)'::regprocedure
    ) ilike '%catalog_launch_curation_head_is_active%'
    and pg_catalog.pg_get_functiondef(
      'private.catalog_product_is_servable(uuid)'::regprocedure
    ) ilike '%catalog_operator_product_holds%',
  'Shelf serving remains independently CAT-03 and hold gated'
);

select ok(
  pg_catalog.pg_get_functiondef(
    'private.catalog_launch_curation_record_is_valid_v0058(uuid)'::regprocedure
  ) not ilike '%product.recommendation_eligible is true%'
    and pg_catalog.pg_get_functiondef(
      'private.catalog_launch_curation_campaign_record_validity(uuid)'::regprocedure
    ) not ilike '%product.recommendation_eligible is true%',
  'CAT-03 scalar and set-based live validators do not depend on recommendation admission'
);

select is(
  (
    select pg_catalog.array_agg(
      columns.column_name::text order by columns.ordinal_position
    )
      from information_schema.columns as columns
     where columns.table_schema = 'public'
       and columns.table_name = 'recommendable_catalog_products'
  ),
  array[
    'id',
    'name',
    'brand',
    'category',
    'product_type',
    'region',
    'quality_grade',
    'data_quality_score',
    'ingredient_quality_score'
  ]::text[],
  'the recommendation candidate projection has one exact column allowlist'
);

select is(
  (select count(*) from public.recommendable_catalog_products),
  0::bigint,
  'the recommendation candidate projection is empty while closed'
);

select ok(
  pg_catalog.has_table_privilege(
    'service_role',
    'public.recommendable_catalog_products',
    'SELECT'
  )
    and not pg_catalog.has_table_privilege(
      'anon',
      'public.recommendable_catalog_products',
      'SELECT'
    )
    and not pg_catalog.has_table_privilege(
      'authenticated',
      'public.recommendable_catalog_products',
      'SELECT'
    ),
  'only the service role can select the closed projection'
);

select ok(
  pg_catalog.pg_get_viewdef(
    'public.recommendable_catalog_products'::regclass,
    true
  ) ilike '%recommendation_admission_control%'
    and pg_catalog.pg_get_viewdef(
      'public.recommendable_catalog_products'::regclass,
      true
    ) ilike '%admission_state = ''open''%'
    and pg_catalog.pg_get_viewdef(
      'public.recommendable_catalog_products'::regclass,
      true
    ) !~* '(commission|affiliate|partnership|order_attributions)',
  'the exact projection is closed by control and contains no commerce input'
);

select ok(
  exists (
    select 1
      from pg_catalog.pg_constraint as constraints
     where constraints.conrelid = 'public.recommendations'::regclass
       and constraints.conname = 'recommendations_catalog_product_closed'
       and constraints.convalidated
       and pg_catalog.pg_get_constraintdef(constraints.oid)
         ilike '%catalog_product_id IS NULL%'
  ),
  'recommendation cache rows have a validated null-only catalog reference'
);

select is(
  (
    select count(*)
      from public.recommendations
     where catalog_product_id is not null
  ),
  0::bigint,
  'no catalog-linked recommendation cache row survives'
);

select ok(
  exists (
    select 1
      from pg_catalog.pg_trigger as triggers
     where triggers.tgrelid = 'public.recommendations'::regclass
       and triggers.tgname = 'recommendations_admission_control'
       and not triggers.tgisinternal
       and triggers.tgenabled = 'O'
  ),
  'the cache has an enabled admission-control write trigger'
);

select ok(
  (
    select functions.prosecdef
      and functions.proconfig @> array['search_path=""']::text[]
      from pg_catalog.pg_proc as functions
     where functions.oid =
       'private.guard_recommendation_cache_write()'::regprocedure
  )
    and pg_catalog.pg_get_functiondef(
      'private.guard_recommendation_cache_write()'::regprocedure
    ) ilike '%RECOMMENDATION_ADMISSION_CLOSED%',
  'the cache guard is a search-path-sealed definer with a stable closed error'
);

select is(
  (
    select pg_catalog.array_agg(
      policies.policyname || ':' || policies.cmd
      order by policies.policyname
    )
      from pg_catalog.pg_policies as policies
     where policies.schemaname = 'public'
       and policies.tablename = 'recommendations'
  ),
  array[
    'account_deletion_write_barrier_delete:DELETE',
    'account_deletion_write_barrier_insert:INSERT',
    'account_deletion_write_barrier_update:UPDATE',
    'apple_auth_read_barrier:SELECT',
    'health_processing_read_fence:SELECT',
    'recommendations_select_own:SELECT'
  ]::text[],
  'the cache retains exact read and restrictive account-lifecycle barriers without an owner write policy'
);

select ok(
  not exists (
    select 1
      from unnest(array[
        'public',
        'anon',
        'authenticated',
        'service_role'
      ]) as roles(name)
      cross join unnest(array[
        'INSERT',
        'UPDATE',
        'DELETE',
        'TRUNCATE',
        'TRIGGER',
        'REFERENCES'
      ]) as privileges(name)
     where pg_catalog.has_table_privilege(
       roles.name,
       'public.recommendations',
       privileges.name
     )
  )
    and pg_catalog.has_table_privilege(
      'authenticated',
      'public.recommendations',
      'SELECT'
    )
    and pg_catalog.has_table_privilege(
      'service_role',
      'public.recommendations',
      'SELECT'
    )
    and not pg_catalog.has_table_privilege(
      'anon',
      'public.recommendations',
      'SELECT'
    )
    and not pg_catalog.has_table_privilege(
      'public',
      'public.recommendations',
      'SELECT'
    ),
  'cache ACL exposes only exact authenticated/service reads and no unused privilege'
);

select is(
  (
    select pg_catalog.array_agg(
      policies.policyname || ':' || policies.cmd
      order by policies.policyname
    )
      from pg_catalog.pg_policies as policies
     where policies.schemaname = 'public'
       and policies.tablename = 'recommendation_preferences'
  ),
  array[
    'account_deletion_write_barrier_delete:DELETE',
    'account_deletion_write_barrier_insert:INSERT',
    'account_deletion_write_barrier_update:UPDATE',
    'apple_auth_read_barrier:SELECT',
    'health_processing_read_fence:SELECT',
    'recommendation_preferences_select_own:SELECT'
  ]::text[],
  'preferences retain exact read and restrictive account-lifecycle barriers without an owner write policy'
);

select ok(
  not exists (
    select 1
      from unnest(array[
        'public',
        'anon',
        'authenticated',
        'service_role'
      ]) as roles(name)
      cross join unnest(array[
        'INSERT',
        'UPDATE',
        'DELETE',
        'TRUNCATE',
        'TRIGGER',
        'REFERENCES'
      ]) as privileges(name)
     where pg_catalog.has_table_privilege(
       roles.name,
       'public.recommendation_preferences',
       privileges.name
     )
  )
    and pg_catalog.has_table_privilege(
      'authenticated',
      'public.recommendation_preferences',
      'SELECT'
    )
    and pg_catalog.has_table_privilege(
      'service_role',
      'public.recommendation_preferences',
      'SELECT'
    )
    and not pg_catalog.has_table_privilege(
      'anon',
      'public.recommendation_preferences',
      'SELECT'
    )
    and not pg_catalog.has_table_privilege(
      'public',
      'public.recommendation_preferences',
      'SELECT'
    ),
  'preference ACL exposes only exact authenticated/service reads and no unused privilege'
);

select ok(
  (
    select functions.prosecdef
      and functions.provolatile = 'v'
      and functions.proconfig @> array['search_path=""']::text[]
      from pg_catalog.pg_proc as functions
     where functions.oid =
       'public.set_recommendation_preferences(text[],text,text[])'::regprocedure
  ),
  'the exact owner preference RPC is a volatile search-path-sealed definer'
);

select ok(
  pg_catalog.has_function_privilege(
    'authenticated',
    'public.set_recommendation_preferences(text[],text,text[])',
    'EXECUTE'
  )
    and not pg_catalog.has_function_privilege(
      'anon',
      'public.set_recommendation_preferences(text[],text,text[])',
      'EXECUTE'
    )
    and not pg_catalog.has_function_privilege(
      'service_role',
      'public.set_recommendation_preferences(text[],text,text[])',
      'EXECUTE'
    ),
  'only authenticated owners can execute the preference RPC'
);

select ok(
  pg_catalog.pg_get_functiondef(
    'public.set_recommendation_preferences(text[],text,text[])'::regprocedure
  ) ilike '%_assert_current_health_session%'
    and pg_catalog.pg_get_functiondef(
      'public.set_recommendation_preferences(text[],text,text[])'::regprocedure
    ) ilike '%_assert_health_processing_active_locked%'
    and pg_catalog.pg_get_functiondef(
      'public.set_recommendation_preferences(text[],text,text[])'::regprocedure
    ) ilike '%_account_access_allowed%'
    and pg_catalog.pg_get_functiondef(
      'public.set_recommendation_preferences(text[],text,text[])'::regprocedure
    ) ilike '%on conflict on constraint recommendation_preferences_pkey%',
  'the preference RPC binds exact session, epoch, account access, and owner upsert'
);

select ok(
  not pg_catalog.has_table_privilege(
    'anon',
    'public.order_attributions',
    'SELECT'
  )
    and not pg_catalog.has_table_privilege(
      'authenticated',
      'public.order_attributions',
      'SELECT'
    )
    and not exists (
      select 1
        from pg_catalog.pg_policies as policies
       where policies.schemaname = 'public'
         and policies.tablename = 'order_attributions'
    ),
  'commission/order storage has no client privilege or policy'
);

select throws_ok(
  $$update private.recommendation_admission_control
       set established_at = pg_catalog.clock_timestamp()$$,
  '55000',
  'RECOMMENDATION_ADMISSION_CONTROL_MIGRATION_OWNED',
  'even the database owner cannot mutate the closed singleton in place'
);

insert into auth.users (id)
values ('71100000-0000-4000-8000-000000000001');
insert into auth.sessions (id, user_id)
values (
  '71110000-0000-4000-8000-000000000001',
  '71100000-0000-4000-8000-000000000001'
);

select throws_ok(
  $$insert into public.recommendations (
      user_id, trigger, product_type, catalog_product_id, fit_rationale
    ) values (
      '71100000-0000-4000-8000-000000000001',
      'gap',
      'spf',
      null,
      'Closed checkpoint'
    )$$,
  '55000',
  'RECOMMENDATION_ADMISSION_CLOSED',
  'no privileged cache publisher can bypass closed admission'
);

select throws_ok(
  $$select * from public.set_recommendation_preferences(
    array['vegan', 'vegan'],
    null,
    array[]::text[]
  )$$,
  '28000',
  'RECOMMENDATION_PREFERENCES_SESSION_REJECTED',
  'an unauthenticated caller is rejected before preference validation'
);

do $$
begin
  perform *
    from public.promote_health_consent_copy_for_release(
      'health_data_collection',
      'grant',
      'draft-v1-2026-07-10',
      '7957a2811fff0e8cefc6f7180b751ec45688fe99421978eedae05b96c2f251fd',
      'PGTAP-CORE06A-REVIEW-2026-07-26',
      'pgtap.db-owner',
      pg_catalog.repeat('6', 64)
    );
end;
$$;

update public.health_processing_states
   set state = 'active',
       epoch = 1,
       consent_version = 'draft-v1-2026-07-10',
       consent_text_hash =
         '7957a2811fff0e8cefc6f7180b751ec45688fe99421978eedae05b96c2f251fd',
       last_server_verified_at = pg_catalog.statement_timestamp()
 where user_id = '71100000-0000-4000-8000-000000000001';

set local role authenticated;
select pg_catalog.set_config(
  'request.jwt.claims',
  '{"sub":"71100000-0000-4000-8000-000000000001","role":"authenticated","session_id":"71110000-0000-4000-8000-000000000001"}',
  true
);
select pg_catalog.set_config(
  'request.headers',
  '{"x-health-processing-epoch":"1"}',
  true
);

select throws_ok(
  $$insert into public.recommendation_preferences (
      user_id, values_filters, budget_band, format_prefs
    ) values (
      '71100000-0000-4000-8000-000000000001',
      array['vegan'],
      'mid',
      array['gel']
    )$$,
  '42501',
  'permission denied for table recommendation_preferences',
  'an exact owner cannot bypass the preference RPC with table DML'
);

select throws_ok(
  $$select * from public.set_recommendation_preferences(
    array['vegan', 'vegan'],
    null,
    array[]::text[]
  )$$,
  '22023',
  'RECOMMENDATION_PREFERENCES_INVALID',
  'the owner RPC rejects a duplicated preference value'
);

select results_eq(
  $$select values_filters, budget_band, format_prefs
      from public.set_recommendation_preferences(
        array['fragrance_free', 'vegan'],
        'mid',
        array['gel', 'cream']
      )$$,
  $$values (
    array['fragrance_free', 'vegan']::text[],
    'mid'::text,
    array['gel', 'cream']::text[]
  )$$,
  'an exact current owner can atomically persist bounded preferences'
);

select results_eq(
  $$select values_filters, budget_band, format_prefs
      from public.set_recommendation_preferences(
        array[]::text[],
        null,
        array['fluid']
      )$$,
  $$values (
    array[]::text[],
    null::text,
    array['fluid']::text[]
  )$$,
  'the exact owner RPC replaces its singleton preference row'
);

select is(
  (
    select count(*)
      from public.recommendation_preferences
     where user_id = '71100000-0000-4000-8000-000000000001'
  ),
  1::bigint,
  'preference replacement never appends duplicate owner rows'
);

select * from finish();
rollback;
