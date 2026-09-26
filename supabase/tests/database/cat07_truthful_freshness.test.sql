begin;

create extension if not exists pgtap with schema extensions;
set local search_path = extensions, public, pg_catalog;

select plan(53);

select is(
  (select count(*) from supabase_migrations.schema_migrations),
  93::bigint,
  'CAT-07 behavior from 20260718000060 runs against the exact 93-migration source history'
);

select is(
  (select max(version) from supabase_migrations.schema_migrations),
  '20260926000077'::text,
  'CAT-07 remains effective through the current quiz-contract successor head'
);

select is(
  (select count(*) from public.ingredient_pao_defaults),
  0::bigint,
  'the unreviewed legacy PAO-default relation is exactly empty'
);

select ok(
  exists (
    select 1
    from pg_catalog.pg_class as relation
    where relation.oid = 'public.ingredient_pao_defaults'::pg_catalog.regclass
      and relation.relrowsecurity
      and relation.relforcerowsecurity
  )
  and exists (
    select 1
    from pg_catalog.pg_constraint
    where conrelid = 'public.ingredient_pao_defaults'::pg_catalog.regclass
      and conname = 'ingredient_pao_defaults_legacy_empty'
      and contype = 'c'
      and convalidated
      and pg_catalog.pg_get_expr(conbin, conrelid) = 'false'
  )
  and not exists (
    select 1
    from pg_catalog.pg_policy
    where polrelid = 'public.ingredient_pao_defaults'::pg_catalog.regclass
  ),
  'the legacy PAO relation is force-RLS sealed with an always-false constraint'
);

select throws_ok(
  $$insert into public.ingredient_pao_defaults (
      category, default_pao_months, rationale
    ) values ('serum', 9, 'must remain impossible')$$,
  '23514',
  'new row for relation "ingredient_pao_defaults" violates check constraint "ingredient_pao_defaults_legacy_empty"',
  'even a privileged write cannot repopulate the sealed legacy relation'
);

select ok(
  (
    select count(*)
    from pg_catalog.pg_constraint
    where (conrelid, conname) in (
      ('public.user_products'::pg_catalog.regclass, 'user_products_pao_months_check'),
      ('public.product_pao_expiry'::pg_catalog.regclass, 'product_pao_expiry_pao_months_check'),
      ('public.product_categories'::pg_catalog.regclass, 'product_categories_default_pao_months_check'),
      ('public.products'::pg_catalog.regclass, 'products_default_pao_months_check')
    )
      and contype = 'c'
      and convalidated
      and pg_catalog.pg_get_constraintdef(oid) like '%>= 1%'
      and pg_catalog.pg_get_constraintdef(oid) like '%<= 120%'
  ) = 4,
  'all four persisted PAO inputs share the 120-month technical ceiling'
);

select ok(
  (
    select pg_catalog.array_agg(column_name::text order by column_name)
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'user_products'
      and column_name in (
        'catalog_pao_evidence_id',
        'catalog_pao_recorded_at',
        'catalog_pao_region',
        'catalog_pao_source_id',
        'legacy_unverified_expiry_date'
      )
  ) = array[
    'catalog_pao_evidence_id',
    'catalog_pao_recorded_at',
    'catalog_pao_region',
    'catalog_pao_source_id',
    'legacy_unverified_expiry_date'
  ]::text[]
  and exists (
    select 1 from pg_catalog.pg_constraint
    where conrelid = 'public.user_products'::pg_catalog.regclass
      and conname = 'user_products_catalog_pao_snapshot_coherent'
      and contype = 'c'
      and convalidated
  )
  and not exists (
    select 1
    from pg_catalog.pg_constraint as constraint_row
    cross join lateral pg_catalog.unnest(constraint_row.conkey) as key_column(attnum)
    join pg_catalog.pg_attribute as attribute
      on attribute.attrelid = constraint_row.conrelid
     and attribute.attnum = key_column.attnum
    where constraint_row.conrelid = 'public.user_products'::pg_catalog.regclass
      and constraint_row.contype = 'f'
      and attribute.attname like 'catalog_pao_%'
  ),
  'server snapshot and legacy quarantine columns exist and snapshot IDs have no lifecycle-pinning FK'
);

select ok(
  exists (
    select 1 from pg_catalog.pg_constraint
    where conrelid = 'public.user_products'::pg_catalog.regclass
      and conname = 'user_products_pao_source_coherent'
      and pg_catalog.pg_get_constraintdef(oid) like '%label%catalog%'
      and pg_catalog.pg_get_constraintdef(oid) not like '%category_default%'
  )
  and exists (
    select 1 from pg_catalog.pg_constraint
    where conrelid = 'public.user_products'::pg_catalog.regclass
      and conname = 'user_products_opened_state_coherent'
      and pg_catalog.pg_get_constraintdef(oid) like '%statement_timestamp()%UTC%+ 1%'
  )
  and exists (
    select 1 from pg_catalog.pg_constraint
    where conrelid = 'public.user_products'::pg_catalog.regclass
      and conname = 'user_products_expiry_source_coherent'
  ),
  'Shelf provenance excludes unsnapshotted category defaults and UTC-bounds local opening dates'
);

select is(
  (
    select pg_catalog.array_agg(trigger.tgname order by trigger.tgname)
    from pg_catalog.pg_trigger as trigger
    where not trigger.tgisinternal
      and trigger.tgname in (
        'trg_user_products_catalog_pao_snapshot',
        'trg_user_products_category_default_evidence'
      )
  ),
  array[
    'trg_user_products_catalog_pao_snapshot',
    'trg_user_products_category_default_evidence'
  ]::name[],
  'CAT-07 installs only capture-time Shelf guards'
);

select ok(
  not exists (
    select 1
    from pg_catalog.pg_trigger as trigger
    where not trigger.tgisinternal
      and trigger.tgrelid in (
        'public.products'::pg_catalog.regclass,
        'public.product_categories'::pg_catalog.regclass,
        'public.catalog_sources'::pg_catalog.regclass,
        'public.product_pao_expiry'::pg_catalog.regclass
      )
      and trigger.tgname like '%category_default_evidence%'
  ),
  'Shelf rows install no product/category/source/evidence update or delete blocker'
);

select ok(
  pg_catalog.pg_get_functiondef(
    'private.resolve_catalog_pao_snapshot(uuid,uuid,integer)'::pg_catalog.regprocedure
  ) like '%freshness.pao_source in (''label'', ''brand_label'', ''catalog'')%'
  and pg_catalog.pg_get_functiondef(
    'private.resolve_catalog_pao_snapshot(uuid,uuid,integer)'::pg_catalog.regprocedure
  ) like '%freshness.source_id = p_catalog_source_id%'
  and pg_catalog.pg_get_functiondef(
    'private.resolve_catalog_pao_snapshot(uuid,uuid,integer)'::pg_catalog.regprocedure
  ) like '%pg_catalog.count(*) over ()%'
  and pg_catalog.pg_get_functiondef(
    'private.resolve_catalog_pao_snapshot(uuid,uuid,integer)'::pg_catalog.regprocedure
  ) like '%catalog_product_is_servable%'
  and pg_catalog.pg_get_functiondef(
    'private.resolve_catalog_pao_snapshot(uuid,uuid,integer)'::pg_catalog.regprocedure
  ) like '%catalog_source_is_production_approved%',
  'resolver binds source/product/month and counts exact reviewed product-specific evidence'
);

select ok(
  pg_catalog.pg_get_functiondef(
    'public._guard_direct_health_write()'::pg_catalog.regprocedure
  ) like '%tg_table_name = ''user_products''%'
  and pg_catalog.pg_get_functiondef(
    'public._guard_direct_health_write()'::pg_catalog.regprocedure
  ) like '%pg_trigger_depth() > 1%'
  and pg_catalog.pg_get_functiondef(
    'public._guard_direct_health_write()'::pg_catalog.regprocedure
  ) like '%to_jsonb(old) ->> ''catalog_product_id''%'
  and pg_catalog.pg_get_functiondef(
    'public._guard_direct_health_write()'::pg_catalog.regprocedure
  ) not like '%old.catalog_product_id%'
  and pg_catalog.pg_get_functiondef(
    'public._guard_direct_health_write()'::pg_catalog.regprocedure
  ) not like '%old.catalog_source_id%'
  and pg_catalog.pg_get_functiondef(
    'public._guard_direct_health_write()'::pg_catalog.regprocedure
  ) not like '%new.catalog_product_id%'
  and pg_catalog.pg_get_functiondef(
    'public._guard_direct_health_write()'::pg_catalog.regprocedure
  ) not like '%new.catalog_source_id%'
  and pg_catalog.pg_get_functiondef(
    'public._guard_direct_health_write()'::pg_catalog.regprocedure
  ) like '%legacy_unverified_expiry_date%' = false,
  'health guard has a row-shape-safe nested catalog-FK detach lane without exempting the physical legacy date'
);

alter table public.catalog_sources disable trigger user;
alter table public.product_pao_expiry disable trigger user;
alter table public.product_categories disable trigger user;
alter table public.products disable trigger user;
alter table public.products
  enable trigger products_recommendation_eligibility_closed;
alter table public.user_products disable trigger user;

insert into auth.users (id)
values ('60000000-0000-4000-8000-000000000001');

update public.catalog_sources
set production_approved = true,
    review_status = 'legal_approved',
    reviewed_by = 'Legal Reviewer CAT07',
    reviewed_at = pg_catalog.statement_timestamp() - interval '1 minute',
    requires_attribution = false
where source_key in ('internal_derived', 'curated');

insert into public.product_categories (
  id, label, default_pao_months, pao_source, is_sunscreen, review_status
) values
  (
    'cat07-reviewed-serum', 'CAT07 reviewed serum', 9,
    'reviewed_category_default', false, 'reviewed'
  ),
  (
    'cat07-sunscreen', 'CAT07 sunscreen', null,
    'label_required', true, 'reviewed'
  );

create or replace function private.catalog_launch_curation_head_is_active(
  p_product_id uuid
)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select p_product_id::text like '61000000-0000-4000-8000-%'
$$;

insert into public.products (
  id, barcode, name, category, category_id, source, source_id, source_ref,
  source_snapshot_date, region, status, review_status, quality_grade,
  recommendation_eligible, last_reviewed_at
) values
  ('61000000-0000-4000-8000-000000000001', '10000007', 'CAT07 label', 'serum', 'cat07-reviewed-serum', 'internal_derived', (select id from public.catalog_sources where source_key = 'internal_derived'), 'cat07-label', (pg_catalog.now() at time zone 'UTC')::date, 'US', 'active', 'reviewed', 'verified', false, pg_catalog.statement_timestamp() - interval '1 minute'),
  ('61000000-0000-4000-8000-000000000002', '10000014', 'CAT07 brand label', 'serum', 'cat07-reviewed-serum', 'internal_derived', (select id from public.catalog_sources where source_key = 'internal_derived'), 'cat07-brand-label', (pg_catalog.now() at time zone 'UTC')::date, 'US', 'active', 'reviewed', 'verified', false, pg_catalog.statement_timestamp() - interval '1 minute'),
  ('61000000-0000-4000-8000-000000000003', '10000021', 'CAT07 catalog', 'serum', 'cat07-reviewed-serum', 'internal_derived', (select id from public.catalog_sources where source_key = 'internal_derived'), 'cat07-catalog', (pg_catalog.now() at time zone 'UTC')::date, 'US', 'active', 'reviewed', 'verified', false, pg_catalog.statement_timestamp() - interval '1 minute'),
  ('61000000-0000-4000-8000-000000000004', '10000038', 'CAT07 ambiguous', 'serum', 'cat07-reviewed-serum', 'internal_derived', (select id from public.catalog_sources where source_key = 'internal_derived'), 'cat07-ambiguous', (pg_catalog.now() at time zone 'UTC')::date, 'US', 'active', 'reviewed', 'verified', false, pg_catalog.statement_timestamp() - interval '1 minute'),
  ('61000000-0000-4000-8000-000000000005', '10000045', 'CAT07 no match', 'serum', 'cat07-reviewed-serum', 'internal_derived', (select id from public.catalog_sources where source_key = 'internal_derived'), 'cat07-no-match', (pg_catalog.now() at time zone 'UTC')::date, 'US', 'active', 'reviewed', 'verified', false, pg_catalog.statement_timestamp() - interval '1 minute'),
  ('61000000-0000-4000-8000-000000000006', '10000052', 'CAT07 category quarantine', 'serum', 'cat07-reviewed-serum', 'internal_derived', (select id from public.catalog_sources where source_key = 'internal_derived'), 'cat07-category', (pg_catalog.now() at time zone 'UTC')::date, 'US', 'active', 'reviewed', 'verified', false, pg_catalog.statement_timestamp() - interval '1 minute'),
  ('61000000-0000-4000-8000-000000000007', '10000069', 'CAT07 source delete category', 'serum', 'cat07-reviewed-serum', 'internal_derived', (select id from public.catalog_sources where source_key = 'internal_derived'), 'cat07-source-delete', (pg_catalog.now() at time zone 'UTC')::date, 'US', 'active', 'reviewed', 'verified', false, pg_catalog.statement_timestamp() - interval '1 minute');

insert into public.product_pao_expiry (
  id, product_id, pao_months, pao_source, region, source_id,
  reviewed_by, review_status
) values
  ('63000000-0000-4000-8000-000000000001', '61000000-0000-4000-8000-000000000001', 12, 'label', 'US', (select id from public.catalog_sources where source_key = 'internal_derived'), 'Chemistry Reviewer CAT07', 'reviewed'),
  ('63000000-0000-4000-8000-000000000002', '61000000-0000-4000-8000-000000000002', 18, 'brand_label', 'US', (select id from public.catalog_sources where source_key = 'internal_derived'), 'Chemistry Reviewer CAT07', 'reviewed'),
  ('63000000-0000-4000-8000-000000000003', '61000000-0000-4000-8000-000000000003', 24, 'catalog', 'US', (select id from public.catalog_sources where source_key = 'internal_derived'), 'Chemistry Reviewer CAT07', 'reviewed'),
  ('63000000-0000-4000-8000-000000000004', '61000000-0000-4000-8000-000000000004', 6, 'label', 'US', (select id from public.catalog_sources where source_key = 'internal_derived'), 'Chemistry Reviewer CAT07', 'reviewed'),
  ('63000000-0000-4000-8000-000000000005', '61000000-0000-4000-8000-000000000004', 6, 'catalog', 'US', (select id from public.catalog_sources where source_key = 'internal_derived'), 'Chemistry Reviewer CAT07', 'reviewed'),
  ('63000000-0000-4000-8000-000000000006', '61000000-0000-4000-8000-000000000005', 9, 'category_default', 'US', (select id from public.catalog_sources where source_key = 'internal_derived'), 'Chemistry Reviewer CAT07', 'reviewed'),
  ('63000000-0000-4000-8000-000000000007', '61000000-0000-4000-8000-000000000005', 9, 'label', 'CA', (select id from public.catalog_sources where source_key = 'internal_derived'), 'Chemistry Reviewer CAT07', 'reviewed'),
  ('63000000-0000-4000-8000-000000000008', '61000000-0000-4000-8000-000000000005', 9, 'label', 'US', (select id from public.catalog_sources where source_key = 'internal_derived'), '   ', 'reviewed'),
  ('63000000-0000-4000-8000-000000000009', '61000000-0000-4000-8000-000000000005', 9, 'label', 'US', (select id from public.catalog_sources where source_key = 'curated'), 'Chemistry Reviewer CAT07', 'reviewed');

alter table public.user_products enable trigger trg_user_products_catalog_pao_snapshot;
alter table public.user_products enable trigger trg_user_products_category_default_evidence;

-- 0069 makes Shelf identity durable independently of mutable product content.
-- These privileged CAT-07 fixtures bypass runtime health admission, so stage
-- their minimal same-owner identities explicitly before inserting content.
alter table public.shelf_product_identities disable trigger user;
insert into public.shelf_product_identities (id, user_id)
select fixture.id, '60000000-0000-4000-8000-000000000001'::uuid
  from unnest(array[
    '64000000-0000-4000-8000-000000000001'::uuid,
    '64000000-0000-4000-8000-000000000002'::uuid,
    '64000000-0000-4000-8000-000000000003'::uuid,
    '64000000-0000-4000-8000-000000000004'::uuid,
    '64000000-0000-4000-8000-000000000006'::uuid,
    '64000000-0000-4000-8000-000000000007'::uuid,
    '64000000-0000-4000-8000-000000000008'::uuid
  ]) as fixture(id);
alter table public.shelf_product_identities enable trigger user;

select lives_ok(
  $$insert into public.user_products (
      id, user_id, catalog_product_id, catalog_source_id, manual_name,
      opened_at, is_opened, pao_months, pao_source, expiry_source,
      catalog_pao_evidence_id, catalog_pao_source_id, catalog_pao_region,
      catalog_pao_recorded_at
    ) values
      (
        '64000000-0000-4000-8000-000000000001',
        '60000000-0000-4000-8000-000000000001',
        '61000000-0000-4000-8000-000000000001',
        (select id from public.catalog_sources where source_key = 'internal_derived'),
        'catalog from label', '2024-01-15', true, 12, 'catalog', 'pao_computed',
        '63999999-0000-4000-8000-000000000001',
        '63999999-0000-4000-8000-000000000002', 'ZZ', '2000-01-01'
      ),
      (
        '64000000-0000-4000-8000-000000000002',
        '60000000-0000-4000-8000-000000000001',
        '61000000-0000-4000-8000-000000000002',
        (select id from public.catalog_sources where source_key = 'internal_derived'),
        'catalog from brand label', '2024-01-15', true, 18, 'catalog', 'pao_computed',
        null, null, null, null
      ),
      (
        '64000000-0000-4000-8000-000000000003',
        '60000000-0000-4000-8000-000000000001',
        '61000000-0000-4000-8000-000000000003',
        (select id from public.catalog_sources where source_key = 'internal_derived'),
        'catalog from catalog', '2024-01-15', true, 24, 'catalog', 'pao_computed',
        null, null, null, null
      )$$,
  'label, brand_label, and catalog product evidence all admit a Shelf catalog claim'
);

select is(
  (
    select pg_catalog.jsonb_object_agg(
      manual_name,
      pg_catalog.jsonb_build_object(
        'evidence', catalog_pao_evidence_id,
        'region', catalog_pao_region,
        'recorded', catalog_pao_recorded_at is not null
      )
    )
    from public.user_products
    where id in (
      '64000000-0000-4000-8000-000000000001',
      '64000000-0000-4000-8000-000000000002',
      '64000000-0000-4000-8000-000000000003'
    )
  ),
  '{
    "catalog from label":{"evidence":"63000000-0000-4000-8000-000000000001","region":"US","recorded":true},
    "catalog from brand label":{"evidence":"63000000-0000-4000-8000-000000000002","region":"US","recorded":true},
    "catalog from catalog":{"evidence":"63000000-0000-4000-8000-000000000003","region":"US","recorded":true}
  }'::jsonb,
  'the database stamps the exact evidence row for every admitted product-specific source type'
);

select ok(
  exists (
    select 1 from public.user_products
    where id = '64000000-0000-4000-8000-000000000001'
      and catalog_pao_evidence_id = '63000000-0000-4000-8000-000000000001'
      and catalog_pao_source_id = (
        select id from public.catalog_sources where source_key = 'internal_derived'
      )
      and catalog_pao_region = 'US'
      and catalog_pao_recorded_at > '2000-01-01'::timestamptz
  ),
  'client-spoofed snapshot fields are overwritten with server evidence'
);

select lives_ok(
  $$insert into public.user_products (
      id, user_id, manual_name, opened_at, is_opened, pao_months, pao_source,
      expiry_source, catalog_pao_evidence_id, catalog_pao_source_id,
      catalog_pao_region, catalog_pao_recorded_at
    ) values (
      '64000000-0000-4000-8000-000000000004',
      '60000000-0000-4000-8000-000000000001', 'label clears spoof',
      '2024-01-15', true, 12, 'label', 'pao_computed',
      '63999999-0000-4000-8000-000000000001',
      '63999999-0000-4000-8000-000000000002', 'ZZ', '2000-01-01'
    )$$,
  'a noncatalog write remains valid while the server clears spoofed catalog snapshot fields'
);

select ok(
  exists (
    select 1 from public.user_products
    where id = '64000000-0000-4000-8000-000000000004'
      and catalog_pao_evidence_id is null
      and catalog_pao_source_id is null
      and catalog_pao_region is null
      and catalog_pao_recorded_at is null
  ),
  'noncatalog rows cannot retain catalog snapshot material'
);

select throws_ok(
  $$insert into public.user_products (
      user_id, catalog_product_id, catalog_source_id, manual_name,
      opened_at, is_opened, pao_months, pao_source, expiry_source
    ) values (
      '60000000-0000-4000-8000-000000000001',
      '61000000-0000-4000-8000-000000000005',
      (select id from public.catalog_sources where source_key = 'internal_derived'),
      'zero eligible', '2024-01-15', true, 9, 'catalog', 'pao_computed'
    )$$,
  '23514',
  'USER_PRODUCT_CATALOG_PAO_EVIDENCE_INVALID',
  'zero eligible evidence rows reject a catalog claim'
);

select throws_ok(
  $$insert into public.user_products (
      user_id, catalog_product_id, catalog_source_id, manual_name,
      opened_at, is_opened, pao_months, pao_source, expiry_source
    ) values (
      '60000000-0000-4000-8000-000000000001',
      '61000000-0000-4000-8000-000000000004',
      (select id from public.catalog_sources where source_key = 'internal_derived'),
      'ambiguous evidence', '2024-01-15', true, 6, 'catalog', 'pao_computed'
    )$$,
  '23514',
  'USER_PRODUCT_CATALOG_PAO_EVIDENCE_INVALID',
  'two reviewed rows for the same product and months reject as ambiguous'
);

select throws_ok(
  $$insert into public.user_products (
      user_id, catalog_product_id, catalog_source_id, manual_name,
      opened_at, is_opened, pao_months, pao_source, expiry_source
    ) values (
      '60000000-0000-4000-8000-000000000001',
      '61000000-0000-4000-8000-000000000001',
      (select id from public.catalog_sources where source_key = 'curated'),
      'spoofed source', '2024-01-15', true, 12, 'catalog', 'pao_computed'
    )$$,
  '23514',
  'USER_PRODUCT_CATALOG_PAO_EVIDENCE_INVALID',
  'a client-supplied source identity must equal product and evidence source'
);

select throws_ok(
  $$insert into public.user_products (
      user_id, catalog_product_id, catalog_source_id, manual_name,
      opened_at, is_opened, pao_months, pao_source, expiry_source
    ) values (
      '60000000-0000-4000-8000-000000000001',
      '61000000-0000-4000-8000-000000000001',
      (select id from public.catalog_sources where source_key = 'internal_derived'),
      'spoofed months', '2024-01-15', true, 13, 'catalog', 'pao_computed'
    )$$,
  '23514',
  'USER_PRODUCT_CATALOG_PAO_EVIDENCE_INVALID',
  'a catalog month claim must exactly match one eligible evidence row'
);

select throws_ok(
  $$insert into public.user_products (
      user_id, manual_name, opened_at, is_opened,
      pao_months, pao_source, expiry_source
    ) values (
      '60000000-0000-4000-8000-000000000001', 'overbound Shelf PAO',
      '2024-01-15', true, 121, 'label', 'pao_computed'
    )$$,
  '23514',
  'new row for relation "user_products" violates check constraint "user_products_pao_months_check"',
  'Shelf PAO cannot exceed the 120-month engineering ceiling'
);

select throws_ok(
  $$insert into public.product_pao_expiry (
      product_id, pao_months, pao_source, region, source_id,
      reviewed_by, review_status
    ) values (
      '61000000-0000-4000-8000-000000000001', 121, 'label', 'US',
      (select id from public.catalog_sources where source_key = 'internal_derived'),
      'Chemistry Reviewer CAT07', 'reviewed'
    )$$,
  '23514',
  'new row for relation "product_pao_expiry" violates check constraint "product_pao_expiry_pao_months_check"',
  'catalog PAO evidence cannot persist above 120 months'
);

select throws_ok(
  $$insert into public.product_categories (
      id, label, default_pao_months, pao_source, is_sunscreen, review_status
    ) values (
      'cat07-overbound-category', 'overbound', 121,
      'reviewed_category_default', false, 'reviewed'
    )$$,
  '23514',
  'new row for relation "product_categories" violates check constraint "product_categories_default_pao_months_check"',
  'category editorial fallback cannot persist above 120 months'
);

select throws_ok(
  $$update public.products
       set default_pao_months = 121
     where id = '61000000-0000-4000-8000-000000000001'$$,
  '23514',
  'new row for relation "products" violates check constraint "products_default_pao_months_check"',
  'served product fallback cannot persist above 120 months'
);

select lives_ok(
  $$insert into public.user_products (
      id, user_id, catalog_product_id, catalog_source_id, manual_name,
      opened_at, is_opened, pao_months, pao_source, expiry_date, expiry_source
    ) values (
      '64000000-0000-4000-8000-000000000006',
      '60000000-0000-4000-8000-000000000001',
      '61000000-0000-4000-8000-000000000006',
      (select id from public.catalog_sources where source_key = 'internal_derived'),
      'category quarantined with physical date', '2024-01-15', true,
      9, 'category_default', '2031-06-15', 'estimated'
    )$$,
  'an attempted category estimate is safely admitted only after coercion to unknown'
);

select ok(
  exists (
    select 1 from public.user_products
    where id = '64000000-0000-4000-8000-000000000006'
      and pao_months is null
      and pao_source = 'unknown'
      and expiry_date = '2031-06-15'
      and expiry_computed = '2031-06-15'
      and expiry_source = 'printed'
  ),
  'category quarantine cannot drive freshness and preserves a new physical-package date'
);

select lives_ok(
  $$insert into public.user_products (
      id, user_id, catalog_product_id, catalog_source_id, manual_name,
      opened_at, is_opened, pao_months, pao_source, expiry_source
    ) values (
      '64000000-0000-4000-8000-000000000007',
      '60000000-0000-4000-8000-000000000001',
      '61000000-0000-4000-8000-000000000007',
      (select id from public.catalog_sources where source_key = 'internal_derived'),
      'category source lifecycle', '2024-01-15', true,
      9, 'category_default', 'estimated'
    )$$,
  'a second category attempt is also quarantined for source lifecycle testing'
);

select lives_ok(
  $$insert into public.user_products (
      id, user_id, manual_name, opened_at, is_opened,
      pao_months, pao_source, expiry_source
    ) values (
      '64000000-0000-4000-8000-000000000008',
      '60000000-0000-4000-8000-000000000001', 'local tomorrow',
      (pg_catalog.statement_timestamp() at time zone 'UTC')::date + 1,
      true, null, 'unknown', 'unknown'
    )$$,
  'device-local today may be one UTC calendar day ahead'
);

select throws_ok(
  $$insert into public.user_products (
      user_id, manual_name, opened_at, is_opened,
      pao_months, pao_source, expiry_source
    ) values (
      '60000000-0000-4000-8000-000000000001', 'future opening',
      (pg_catalog.statement_timestamp() at time zone 'UTC')::date + 2,
      true, null, 'unknown', 'unknown'
    )$$,
  '23514',
  'new row for relation "user_products" violates check constraint "user_products_opened_state_coherent"',
  'two UTC calendar days in the future remains rejected'
);

create temp table cat07_snapshot_before as
select
  id,
  catalog_pao_evidence_id,
  catalog_pao_source_id,
  catalog_pao_region,
  catalog_pao_recorded_at
from public.user_products
where id = '64000000-0000-4000-8000-000000000001';

alter table public.catalog_sources enable trigger user;
alter table public.product_pao_expiry enable trigger user;
alter table public.product_categories enable trigger user;
alter table public.products enable trigger user;

select lives_ok(
  $$delete from public.product_pao_expiry
     where id = '63000000-0000-4000-8000-000000000001'$$,
  'removing mutable evidence does not let a no-FK Shelf snapshot pin correction'
);

select lives_ok(
  $$update public.catalog_sources
       set production_approved = false,
           review_status = 'blocked'
     where source_key = 'internal_derived'$$,
  'catalog source retirement succeeds despite admitted Shelf snapshots'
);

select lives_ok(
  $$update public.products
       set review_status = 'needs_review',
           recommendation_eligible = false
     where id = '61000000-0000-4000-8000-000000000001'$$,
  'product correction succeeds despite an admitted Shelf snapshot'
);

select lives_ok(
  $$update public.user_products
       set manual_name = 'unrelated edit after retirement',
           notes = 'owner physical metadata survives'
     where id = '64000000-0000-4000-8000-000000000001'$$,
  'an unrelated owner edit preserves the admitted snapshot without revalidation'
);

select is(
  (
    select pg_catalog.to_jsonb(current_snapshot)
      - 'manual_name' - 'notes'
    from (
      select
        shelf.id,
        shelf.catalog_pao_evidence_id,
        shelf.catalog_pao_source_id,
        shelf.catalog_pao_region,
        shelf.catalog_pao_recorded_at
      from public.user_products as shelf
      where shelf.id = '64000000-0000-4000-8000-000000000001'
    ) as current_snapshot
  ),
  (
    select pg_catalog.to_jsonb(snapshot_before)
    from cat07_snapshot_before as snapshot_before
  ),
  'the complete server snapshot remains byte-for-byte stable after retirement and evidence removal'
);

select throws_ok(
  $$update public.user_products
       set pao_months = 13
     where id = '64000000-0000-4000-8000-000000000001'$$,
  '23514',
  'USER_PRODUCT_CATALOG_PAO_EVIDENCE_INVALID',
  'changing an admitted catalog claim revalidates against current evidence and fails closed'
);

select throws_ok(
  $$update public.user_products
       set catalog_source_id = (
         select id from public.catalog_sources where source_key = 'curated'
       )
     where id = '64000000-0000-4000-8000-000000000002'$$,
  '23514',
  'USER_PRODUCT_CATALOG_PAO_EVIDENCE_INVALID',
  'changing a nonnull catalog source identity revalidates and rejects spoofing'
);

select ok(
  exists (
    select 1 from public.user_products
    where id = '64000000-0000-4000-8000-000000000001'
      and pao_months = 12
      and pao_source = 'catalog'
  )
  and exists (
    select 1 from public.user_products
    where id = '64000000-0000-4000-8000-000000000002'
      and catalog_source_id = (
        select id from public.catalog_sources where source_key = 'internal_derived'
      )
  ),
  'failed changed-claim writes leave admitted rows unchanged'
);

select throws_ok(
  $$insert into public.user_products (
      user_id, catalog_product_id, catalog_source_id, manual_name,
      opened_at, is_opened, pao_months, pao_source, expiry_source
    ) values (
      '60000000-0000-4000-8000-000000000001',
      '61000000-0000-4000-8000-000000000001',
      (select id from public.catalog_sources where source_key = 'internal_derived'),
      'new after retirement', '2024-01-15', true, 12, 'catalog', 'pao_computed'
    )$$,
  '23514',
  'USER_PRODUCT_CATALOG_PAO_EVIDENCE_INVALID',
  'new claims cannot use retired source/product evidence'
);

select lives_ok(
  $$update public.products
       set category = 'sunscreen',
           category_id = 'cat07-sunscreen'
     where id = '61000000-0000-4000-8000-000000000007'$$,
  'global product/category correction is not pinned by a quarantined Shelf attempt'
);

select lives_ok(
  $$update public.product_categories
       set review_status = 'needs_review',
           default_pao_months = null,
           pao_source = 'unknown'
     where id = 'cat07-reviewed-serum'$$,
  'global category review correction is not pinned by Shelf rows'
);

select lives_ok(
  $$delete from public.product_categories
     where id = 'cat07-reviewed-serum'$$,
  'global category deletion succeeds and lets product FKs SET NULL'
);

-- Turn on the real health trigger only for parent deletion. No request health
-- epoch is installed, so success proves the exact nested FK lane rather than a
-- test bypass.
alter table public.user_products enable trigger trg_user_products_health_write;

select lives_ok(
  $$delete from public.products
     where id = '61000000-0000-4000-8000-000000000003'$$,
  'actual product DELETE survives nested Shelf FK SET NULL with the health guard enabled'
);

select ok(
  exists (
    select 1 from public.user_products
    where id = '64000000-0000-4000-8000-000000000003'
      and catalog_product_id is null
      and pao_months = 24
      and pao_source = 'catalog'
      and catalog_pao_evidence_id = '63000000-0000-4000-8000-000000000003'
      and catalog_pao_source_id is not null
      and catalog_pao_region = 'US'
      and catalog_pao_recorded_at is not null
  ),
  'product deletion preserves the admitted independent catalog PAO snapshot'
);

alter table public.user_products disable trigger trg_user_products_health_write;

select lives_ok(
  $$update public.user_products
       set catalog_product_id = '61000000-0000-4000-8000-000000000003'
     where id = '64000000-0000-4000-8000-000000000003'$$,
  'stale product relink from a mobile mirror replay is coerced back to NULL'
);

select ok(
  exists (
    select 1 from public.user_products
    where id = '64000000-0000-4000-8000-000000000003'
      and catalog_product_id is null
      and pao_months = 24
      and pao_source = 'catalog'
      and catalog_pao_evidence_id = '63000000-0000-4000-8000-000000000003'
      and catalog_pao_source_id is not null
      and catalog_pao_region = 'US'
      and catalog_pao_recorded_at is not null
  ),
  'stale product-id replay is coerced back to NULL while preserving the catalog PAO snapshot'
);

alter table public.user_products enable trigger trg_user_products_health_write;

select lives_ok(
  $$delete from public.products
     where id = '61000000-0000-4000-8000-000000000006'$$,
  'product DELETE also succeeds for a quarantined category attempt'
);

select ok(
  exists (
    select 1 from public.user_products
    where id = '64000000-0000-4000-8000-000000000006'
      and catalog_product_id is null
      and pao_months is null
      and pao_source = 'unknown'
      and expiry_date = '2031-06-15'
      and expiry_source = 'printed'
  ),
  'category quarantine and physical-package evidence survive product deletion without an estimate'
);

create temporary table cat07_stale_replay_ids as
select id as internal_derived_source_id
from public.catalog_sources
where source_key = 'internal_derived';

select lives_ok(
  $$delete from public.catalog_sources
     where source_key = 'internal_derived'$$,
  'actual source DELETE survives nested Shelf and catalog FK SET NULL operations'
);

select ok(
  exists (
    select 1 from public.user_products
    where id = '64000000-0000-4000-8000-000000000001'
      and catalog_product_id = '61000000-0000-4000-8000-000000000001'
      and catalog_source_id is null
      and pao_months = 12
      and pao_source = 'catalog'
      and catalog_pao_evidence_id = '63000000-0000-4000-8000-000000000001'
      and catalog_pao_source_id is not null
      and manual_name = 'unrelated edit after retirement'
      and notes = 'owner physical metadata survives'
  )
  and exists (
    select 1 from public.user_products
    where id = '64000000-0000-4000-8000-000000000007'
      and catalog_source_id is null
      and pao_months is null
      and pao_source = 'unknown'
  ),
  'source deletion preserves catalog snapshot history while category remains non-actionable'
);

alter table public.user_products disable trigger trg_user_products_health_write;

select lives_ok(
  $$update public.user_products
       set catalog_source_id = (select internal_derived_source_id from cat07_stale_replay_ids)
     where id = '64000000-0000-4000-8000-000000000001'$$,
  'stale source relink from a mobile mirror replay is coerced back to NULL'
);

select ok(
  exists (
    select 1 from public.user_products
    where id = '64000000-0000-4000-8000-000000000001'
      and catalog_product_id = '61000000-0000-4000-8000-000000000001'
      and catalog_source_id is null
      and pao_months = 12
      and pao_source = 'catalog'
      and catalog_pao_evidence_id = '63000000-0000-4000-8000-000000000001'
      and catalog_pao_source_id is not null
      and catalog_pao_region = 'US'
  ),
  'stale source-id replay is coerced back to NULL while preserving the catalog PAO snapshot'
);

alter table public.user_products enable trigger trg_user_products_health_write;

select ok(
  exists (
    select 1 from pg_catalog.pg_trigger
    where tgrelid = 'public.user_products'::pg_catalog.regclass
      and tgname = 'trg_user_products_health_write'
      and not tgisinternal
      and tgenabled = 'O'
  ),
  'the Shelf health-purpose admission trigger remains enabled after lifecycle tests'
);

alter table public.user_products enable trigger user;
alter table public.products enable trigger user;
alter table public.product_categories enable trigger user;
alter table public.product_pao_expiry enable trigger user;
alter table public.catalog_sources enable trigger user;

select * from finish();
rollback;
