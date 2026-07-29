begin;

create extension if not exists pgtap with schema extensions;
set local search_path = extensions, public, pg_catalog;

-- Forward-only 0070 -> 0071 rehearsal. The local verifier withholds 0071,
-- resets through 0070, installs representative legacy recommendation state,
-- and replaces the include marker with the exact checked-in migration bytes.
select plan(19);

alter table public.products disable trigger user;
insert into public.products (
  id,
  name,
  recommendation_eligible
) values (
  '71000000-0000-4000-8000-000000000001',
  'Legacy recommendation candidate',
  true
);
alter table public.products enable trigger user;

insert into auth.users (id)
values ('71000000-0000-4000-8000-000000000010');

alter table public.recommendations disable trigger user;
insert into public.recommendations (
  id,
  user_id,
  trigger,
  product_type,
  catalog_product_id,
  fit_rationale
) values
  (
    '71000000-0000-4000-8000-000000000020',
    '71000000-0000-4000-8000-000000000010',
    'gap',
    'spf',
    '71000000-0000-4000-8000-000000000001',
    'Legacy catalog-linked cache row'
  ),
  (
    '71000000-0000-4000-8000-000000000021',
    '71000000-0000-4000-8000-000000000010',
    'gap',
    'moisturiser',
    null,
    'Legacy type-only cache row'
  );
alter table public.recommendations enable trigger user;

select is(
  (select max(version) from supabase_migrations.schema_migrations),
  '20260726000070'::text,
  'the upgrade fixture starts on exact migration 0070'
);

select is(
  (
    select recommendation_eligible
      from public.products
     where id = '71000000-0000-4000-8000-000000000001'
  ),
  true,
  '0070 can still carry the overloaded recommendation eligibility flag'
);

select is(
  (
    select count(*)
      from public.recommendations
     where catalog_product_id is not null
  ),
  1::bigint,
  '0070 can still carry a catalog-linked recommendation cache row'
);

-- @@INCLUDE_EXACT_0071_MIGRATION@@

select is(
  (
    select admission_state
      from private.recommendation_admission_control
     where singleton
  ),
  'closed'::text,
  '0071 installs exactly one closed recommendation admission control'
);

select is(
  (
    select pg_catalog.jsonb_build_object(
      'checkpoint', control.checkpoint,
      'reasonCode', control.reason_code
    )
      from private.recommendation_admission_control as control
     where control.singleton
  ),
  '{"checkpoint":"core06a_zero_admission","reasonCode":"reviewed_corpus_not_admitted"}'::jsonb,
  'the closed control records only the exact zero-admission checkpoint'
);

select is(
  (
    select recommendation_eligible
      from public.products
     where id = '71000000-0000-4000-8000-000000000001'
  ),
  false,
  '0071 closes every legacy product recommendation flag'
);

select is(
  (
    select count(*)
      from public.recommendations
     where catalog_product_id is not null
  ),
  0::bigint,
  '0071 purges every catalog-linked recommendation cache row'
);

select is(
  (
    select count(*)
      from public.recommendations
  ),
  0::bigint,
  '0071 also purges unreceipted type-only free-text cache rows'
);

update public.products
   set recommendation_eligible = true
 where id = '71000000-0000-4000-8000-000000000001';

select is(
  (
    select recommendation_eligible
      from public.products
     where id = '71000000-0000-4000-8000-000000000001'
  ),
  false,
  'the 0071 product trigger coerces a legacy refresh/import reopen attempt closed'
);

select lives_ok(
  $$select public.refresh_product_correction_count(
    '71000000-0000-4000-8000-000000000001'
  )$$,
  'the correction refresh remains operational at the closed checkpoint'
);

select is(
  (
    select recommendation_eligible
      from public.products
     where id = '71000000-0000-4000-8000-000000000001'
  ),
  false,
  'the correction refresh cannot reopen recommendation eligibility'
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
  '0071 replaces SELECT star with the exact recommendation projection'
);

select is(
  (select count(*) from public.recommendable_catalog_products),
  0::bigint,
  'the recommendation projection returns zero rows while admission is closed'
);

select ok(
  pg_catalog.pg_get_functiondef(
    'private.catalog_product_is_servable(uuid)'::regprocedure
  ) not ilike '%recommendation_eligible%',
  'Shelf product serving is independent from recommendation admission'
);

select throws_ok(
  $$insert into public.recommendations (
      user_id, trigger, product_type, catalog_product_id, fit_rationale
    ) values (
      '71000000-0000-4000-8000-000000000010',
      'replacement',
      'spf',
      null,
      'Unauthorized cache publisher'
    )$$,
  '55000',
  'RECOMMENDATION_ADMISSION_CLOSED',
  'the migration owner also cannot publish a recommendation while closed'
);

select ok(
  not exists (
    select 1
      from pg_catalog.pg_policies as policies
     where policies.schemaname = 'public'
       and policies.tablename = 'recommendations'
       and (
         policies.policyname in (
           'recommendations_insert_own',
           'recommendations_update_own',
           'recommendations_delete_own'
         )
         or (
           policies.permissive = 'PERMISSIVE'
           and policies.cmd in ('INSERT', 'UPDATE', 'DELETE', 'ALL')
         )
       )
  ),
  '0071 removes every permissive owner recommendation-cache write policy while retaining restrictive lifecycle barriers'
);

select ok(
  not exists (
    select 1
      from pg_catalog.pg_policies as policies
     where policies.schemaname = 'public'
       and policies.tablename = 'recommendation_preferences'
       and (
         policies.policyname in (
           'recommendation_preferences_insert_own',
           'recommendation_preferences_update_own',
           'recommendation_preferences_delete_own'
         )
         or (
           policies.permissive = 'PERMISSIVE'
           and policies.cmd in ('INSERT', 'UPDATE', 'DELETE', 'ALL')
         )
       )
  )
    and pg_catalog.has_function_privilege(
      'authenticated',
      'public.set_recommendation_preferences(text[],text,text[])',
      'execute'
    ),
  '0071 replaces permissive direct preference DML with one authenticated owner RPC while retaining restrictive lifecycle barriers'
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
        or pg_catalog.has_table_privilege(
          roles.name,
          'public.recommendation_preferences',
          privileges.name
        )
  ),
  '0071 removes every unused table privilege from both recommendation relations'
);

select ok(
  not pg_catalog.has_table_privilege(
    'authenticated',
    'public.order_attributions',
    'select'
  )
    and not exists (
      select 1
        from pg_catalog.pg_policies as policies
       where policies.schemaname = 'public'
         and policies.tablename = 'order_attributions'
         and policies.roles && array['authenticated'::name]
    ),
  '0071 exposes no commission/order relation to recommendation callers'
);

select * from finish();
rollback;
