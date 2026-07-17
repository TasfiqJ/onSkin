begin;

create extension if not exists pgtap with schema extensions;
set local search_path = extensions, public, pg_catalog;

select plan(55);

select ok(
  not has_function_privilege(
    'anon', 'public.lookup_catalog_product_by_barcode(text)', 'execute'
  )
    and not has_function_privilege(
      'authenticated', 'public.lookup_catalog_product_by_barcode(text)', 'execute'
    )
    and has_function_privilege(
      'service_role', 'public.lookup_catalog_product_by_barcode(text)', 'execute'
    ),
  'exact barcode lookup is callable only by the service-role Edge lane'
);

select ok(
  not has_function_privilege(
    'anon', 'public.search_catalog_products(text,integer)', 'execute'
  )
    and not has_function_privilege(
      'authenticated', 'public.search_catalog_products(text,integer)', 'execute'
    )
    and has_function_privilege(
      'service_role', 'public.search_catalog_products(text,integer)', 'execute'
    ),
  'indexed search is callable only by the service-role Edge lane'
);

select ok(
  not has_function_privilege(
    'anon',
    'public.submit_catalog_correction(uuid,bigint,uuid,text,text,text,jsonb,jsonb)',
    'execute'
  )
    and not has_function_privilege(
      'authenticated',
      'public.submit_catalog_correction(uuid,bigint,uuid,text,text,text,jsonb,jsonb)',
      'execute'
    )
    and has_function_privilege(
      'service_role',
      'public.submit_catalog_correction(uuid,bigint,uuid,text,text,text,jsonb,jsonb)',
      'execute'
    )
    and not has_function_privilege(
      'authenticated',
      'public.review_catalog_correction(uuid,bigint,text,text,text)',
      'execute'
    )
    and has_function_privilege(
      'service_role',
      'public.review_catalog_correction(uuid,bigint,text,text,text)',
      'execute'
    )
    and not has_table_privilege(
      'authenticated', 'public.catalog_corrections', 'insert'
    )
    and not has_table_privilege(
      'authenticated', 'public.catalog_corrections', 'update'
    )
    and not has_table_privilege(
      'authenticated', 'public.catalog_corrections', 'delete'
    )
    and not has_table_privilege(
      'service_role', 'public.catalog_corrections', 'insert'
    )
    and not has_table_privilege(
      'service_role', 'public.catalog_corrections', 'update'
    )
    and not has_table_privilege(
      'service_role', 'public.catalog_corrections', 'delete'
    ),
  'correction intake and review are service-RPC-only and direct API-role DML is revoked'
);

select ok(
  (
    select count(*) = 2
    from pg_catalog.pg_proc as functions
    where functions.oid = any(array[
      'public.submit_catalog_correction(uuid,bigint,uuid,text,text,text,jsonb,jsonb)'::regprocedure,
      'public.review_catalog_correction(uuid,bigint,text,text,text)'::regprocedure
    ])
      and functions.prosecdef
      and functions.provolatile = 'v'
      and functions.proconfig @> array['search_path=""']::text[]
  ),
  'correction intake and review are volatile security-definer functions with empty search paths'
);

select is(
  (
    select count(*)
    from pg_catalog.pg_policies as policies
    where policies.schemaname = 'public'
      and policies.tablename = 'catalog_corrections'
      and policies.permissive = 'PERMISSIVE'
      and policies.cmd in ('INSERT', 'UPDATE', 'DELETE')
  ),
  0::bigint,
  'catalog corrections expose no direct authenticated mutation policy'
);

select pg_catalog.set_config('request.headers', '', true);
set local role service_role;
select throws_ok(
  $$select * from public.submit_catalog_correction(
    '56000000-0000-4000-8000-000000000001'::uuid,
    1::bigint,
    null::uuid,
    '012345678905',
    'missing_product',
    'Missing catalog product.',
    '{"productName":"Catalog RPC Fixture"}'::jsonb,
    '{"route":"catalog-report"}'::jsonb
  )$$,
  '55000',
  'HEALTH_PROCESSING_EPOCH_REQUIRED',
  'service correction intake rejects calls without the exact request epoch header'
);
reset role;

select ok(
  not has_table_privilege('anon', 'public.catalog_servable_products', 'select')
    and not has_table_privilege(
      'authenticated', 'public.catalog_servable_products', 'select'
    )
    and not has_table_privilege(
      'service_role', 'public.catalog_servable_products', 'select'
    ),
  'the central eligibility relation has no direct API-role read lane'
);

select ok(
  not has_table_privilege('anon', 'public.catalog_sources', 'select')
    and not has_table_privilege(
      'authenticated', 'public.catalog_sources', 'select'
    ),
  'client API roles cannot read source-review identities, timestamps, or free-form notes'
);

set local role authenticated;
select throws_ok(
  $$select reviewed_by, reviewed_at, notes from public.catalog_sources$$,
  '42501',
  'permission denied for table catalog_sources',
  'authenticated SQL cannot bypass the bounded source attribution returned by catalog RPCs'
);
reset role;

select ok(
  not has_schema_privilege('authenticated', 'private', 'usage')
    and has_function_privilege(
      'authenticated', 'private.catalog_source_is_production_approved(uuid)', 'execute'
    )
    and has_function_privilege(
      'authenticated', 'private.catalog_product_is_servable(uuid)', 'execute'
    )
    and has_function_privilege(
      'authenticated',
      'private.catalog_ingredient_list_is_servable(uuid,uuid)',
      'execute'
    )
    and not has_function_privilege(
      'anon', 'private.catalog_product_is_servable(uuid)', 'execute'
    )
    and not has_function_privilege(
      'service_role', 'private.catalog_product_is_servable(uuid)', 'execute'
    ),
  'catalog RLS predicates execute only inside stored authenticated policies in the unexposed private schema'
);

select is(
  (
    select count(*)
    from pg_catalog.pg_proc as functions
    where functions.oid = any(array[
      'private.catalog_source_is_production_approved(uuid)'::regprocedure,
      'private.catalog_product_is_servable(uuid)'::regprocedure,
      'private.catalog_ingredient_list_is_servable(uuid,uuid)'::regprocedure
    ])
      and functions.prosecdef
      and functions.provolatile = 's'
      and functions.proconfig @> array['search_path=""']::text[]
  ),
  3::bigint,
  'all private catalog predicates are stable security-definer functions with an empty search path'
);

set local role authenticated;
select throws_ok(
  $$select private.catalog_product_is_servable(
    '56000000-0000-4000-8000-000000000010'::uuid
  )$$,
  '42501',
  'permission denied for schema private',
  'authenticated SQL cannot address the private eligibility oracle directly'
);
reset role;

insert into auth.users (id)
values ('56000000-0000-4000-8000-000000000001');

set local role authenticated;
select throws_ok(
  $$insert into public.catalog_corrections (
    user_id, correction_type, status, description
  ) values (
    '56000000-0000-4000-8000-000000000001'::uuid,
    'missing_product',
    'open',
    'Direct insert bypass attempt.'
  )$$,
  '42501',
  'permission denied for table catalog_corrections',
  'authenticated callers cannot bypass correction intake with direct inserts'
);
select throws_ok(
  $$update public.catalog_corrections
    set status = 'closed'
    where user_id = '56000000-0000-4000-8000-000000000001'::uuid$$,
  '42501',
  'permission denied for table catalog_corrections',
  'authenticated callers cannot close serving holds with direct updates'
);
reset role;

-- Transaction-local legal-copy promotion mirrors the health lifecycle pgTAP
-- fixture. The file rolls back, so installed release truth remains unchanged.
do $$
begin
  perform *
  from public.promote_health_consent_copy_for_release(
    'health_data_collection',
    'grant',
    'draft-v1-2026-07-10',
    '7957a2811fff0e8cefc6f7180b751ec45688fe99421978eedae05b96c2f251fd',
    'PGTAP-CATALOG-REPORT-2026-07-17',
    'pgtap.catalog-gate',
    repeat('a', 64)
  );
end;
$$;

update public.health_processing_states as states
set state = 'active',
    epoch = 1,
    consent_version = registry.version,
    consent_text_hash = registry.consent_text_hash,
    withdrawal_requested_at = null,
    withdrawal_completed_at = null,
    updated_at = now()
from (
  select copy.version, copy.consent_text_hash
  from public.health_consent_copy_registry as copy
  where copy.consent_type = 'health_data_collection'
    and copy.action = 'grant'
    and copy.review_status = 'approved'
    and copy.is_current
  limit 1
) as registry
where states.user_id = '56000000-0000-4000-8000-000000000001';

select pg_catalog.set_config(
  'request.headers',
  '{"x-health-processing-epoch":"1"}',
  true
);
set local role service_role;
select lives_ok(
  $$select * from public.submit_catalog_correction(
    '56000000-0000-4000-8000-000000000001'::uuid,
    1::bigint,
    null::uuid,
    '012345678905',
    'missing_product',
    'Missing catalog product.',
    '{"productName":"Catalog RPC Fixture"}'::jsonb,
    '{"route":"catalog-report"}'::jsonb
  )$$,
  'service correction intake accepts one bounded report at an active exact epoch'
);
reset role;

select ok(
  exists (
    select 1
    from public.catalog_corrections as correction
    where correction.user_id = '56000000-0000-4000-8000-000000000001'
      and correction.product_id is null
      and correction.barcode = '012345678905'
      and correction.correction_type = 'missing_product'
      and correction.status = 'open'
      and correction.description = 'Missing catalog product.'
      and correction.proposed_payload =
        '{"productName":"Catalog RPC Fixture"}'::jsonb
      and correction.client_context = '{"route":"catalog-report"}'::jsonb
      and correction.assigned_to is null
      and correction.resolved_by is null
      and correction.resolution_note is null
      and correction.source_id is null
  ),
  'correction intake fixes workflow and operator-controlled fields server-side'
);

delete from public.catalog_corrections
where user_id = '56000000-0000-4000-8000-000000000001'
  and product_id is null
  and barcode = '012345678905';

update public.catalog_sources
set production_approved = true,
    review_status = 'legal_approved',
    reviewed_by = 'pgtap-catalog-gate',
    reviewed_at = now()
where source_key = 'curated';

insert into public.products (
  id,
  barcode,
  name,
  brand,
  category,
  source,
  source_id,
  status,
  review_status,
  quality_grade,
  recommendation_eligible,
  unresolved_correction_count,
  data_quality_score,
  source_ref,
  source_snapshot_date,
  last_reviewed_at
)
values (
  '56000000-0000-4000-8000-000000000010',
  '05600000000010',
  'Catalog Gate Serum',
  'Gate Brand',
  'serum',
  'curated',
  (select id from public.catalog_sources where source_key = 'curated'),
  'active',
  'reviewed',
  'verified',
  true,
  0,
  99,
  'curated:catalog-gate-serum',
  current_date,
  now()
);

insert into public.product_barcodes (
  barcode,
  product_id,
  source_id,
  confidence,
  review_status
)
values (
  '05600000000010',
  '56000000-0000-4000-8000-000000000010',
  (select id from public.catalog_sources where source_key = 'curated'),
  1,
  'reviewed'
);

insert into public.ingredients (
  id,
  inci_name,
  source,
  source_id,
  source_snapshot_date,
  review_status
)
values (
  '56000000-0000-4000-8000-000000000020',
  'CATALOG GATE INGREDIENT',
  'curated',
  (select id from public.catalog_sources where source_key = 'curated'),
  current_date,
  'reviewed'
);

insert into public.product_ingredient_lists (
  id,
  product_id,
  source_id,
  raw_text,
  parse_status,
  parse_confidence,
  token_count,
  source_snapshot_date,
  review_status
)
values
  (
    '56000000-0000-4000-8000-000000000030',
    '56000000-0000-4000-8000-000000000010',
    (select id from public.catalog_sources where source_key = 'curated'),
    'CATALOG GATE INGREDIENT',
    'reviewed',
    1,
    1,
    current_date,
    'reviewed'
  ),
  (
    '56000000-0000-4000-8000-000000000031',
    '56000000-0000-4000-8000-000000000010',
    (select id from public.catalog_sources where source_key = 'open_beauty_facts'),
    'HELD SOURCE INGREDIENT',
    'reviewed',
    1,
    1,
    current_date,
    'reviewed'
  );

insert into public.product_ingredient_tokens (
  id,
  ingredient_list_id,
  product_id,
  ingredient_id,
  position,
  raw_token,
  normalized_token,
  match_type,
  match_confidence,
  is_unmatched,
  source_id
)
values
  (
    '56000000-0000-4000-8000-000000000040',
    '56000000-0000-4000-8000-000000000030',
    '56000000-0000-4000-8000-000000000010',
    '56000000-0000-4000-8000-000000000020',
    1,
    'CATALOG GATE INGREDIENT',
    'catalog gate ingredient',
    'exact',
    1,
    false,
    (select id from public.catalog_sources where source_key = 'curated')
  ),
  (
    '56000000-0000-4000-8000-000000000041',
    '56000000-0000-4000-8000-000000000031',
    '56000000-0000-4000-8000-000000000010',
    '56000000-0000-4000-8000-000000000020',
    1,
    'HELD SOURCE INGREDIENT',
    'held source ingredient',
    'exact',
    1,
    false,
    (select id from public.catalog_sources where source_key = 'open_beauty_facts')
  );

insert into public.product_ingredients (
  product_id,
  ingredient_id,
  ingredient_list_id,
  source_id,
  raw_token,
  normalized_token,
  match_type,
  match_confidence
)
values (
  '56000000-0000-4000-8000-000000000010',
  '56000000-0000-4000-8000-000000000020',
  '56000000-0000-4000-8000-000000000030',
  (select id from public.catalog_sources where source_key = 'curated'),
  'CATALOG GATE INGREDIENT',
  'catalog gate ingredient',
  'exact',
  1
);

insert into public.product_active_bands (
  id,
  product_id,
  ingredient_id,
  tag,
  band,
  source_basis,
  source_id,
  review_status
)
values
  (
    '56000000-0000-4000-8000-000000000050',
    '56000000-0000-4000-8000-000000000010',
    '56000000-0000-4000-8000-000000000020',
    'catalog_gate',
    'unknown',
    'curated_review',
    (select id from public.catalog_sources where source_key = 'curated'),
    'reviewed'
  ),
  (
    '56000000-0000-4000-8000-000000000051',
    '56000000-0000-4000-8000-000000000010',
    '56000000-0000-4000-8000-000000000020',
    'catalog_gate_held',
    'unknown',
    'curated_review',
    (select id from public.catalog_sources where source_key = 'open_beauty_facts'),
    'reviewed'
  );

insert into public.product_pao_expiry (
  id,
  product_id,
  pao_months,
  pao_source,
  region,
  source_id,
  reviewed_by,
  review_status
)
values
  (
    '56000000-0000-4000-8000-000000000060',
    '56000000-0000-4000-8000-000000000010',
    12,
    'catalog',
    'US',
    (select id from public.catalog_sources where source_key = 'curated'),
    'pgtap-catalog-gate',
    'reviewed'
  ),
  (
    '56000000-0000-4000-8000-000000000061',
    '56000000-0000-4000-8000-000000000010',
    24,
    'catalog',
    'US',
    (select id from public.catalog_sources where source_key = 'open_beauty_facts'),
    'pgtap-catalog-gate',
    'reviewed'
  );

set local role service_role;
select is(
  (select count(*) from public.lookup_catalog_product_by_barcode('05600000000010')),
  1::bigint,
  'an exact barcode resolves when every positive eligibility gate is satisfied'
);
select is(
  (select count(*) from public.search_catalog_products('gate serum', 20)),
  1::bigint,
  'indexed search returns a fully eligible product'
);
select is(
  (
    select pg_catalog.jsonb_array_length(product_pao_expiry)
    from public.lookup_catalog_product_by_barcode('05600000000010')
  ),
  1,
  'catalog responses include only reviewed same-territory freshness evidence from an approved source'
);
select ok(
  coalesce(
    (
      select
        catalog_sources ?& array[
          'id',
          'display_name',
          'source_key',
          'attribution_text',
          'attribution_url'
        ]::text[]
        and catalog_sources - array[
          'id',
          'display_name',
          'source_key',
          'attribution_text',
          'attribution_url'
        ]::text[] = '{}'::jsonb
      from public.lookup_catalog_product_by_barcode('05600000000010')
    ),
    false
  ),
  'catalog RPCs expose exactly the safe attribution projection and no review metadata'
);
reset role;

update public.products
set region = 'CA'
where id = '56000000-0000-4000-8000-000000000010';
set local role service_role;
select is(
  (select count(*) from public.lookup_catalog_product_by_barcode('05600000000010')),
  0::bigint,
  'barcode lookup hides a product outside the signed US release territory'
);
select is(
  (select count(*) from public.search_catalog_products('gate serum', 20)),
  0::bigint,
  'search hides a product outside the signed US release territory'
);
reset role;

update public.products
set region = 'US',
    source_ref = null
where id = '56000000-0000-4000-8000-000000000010';
set local role service_role;
select is(
  (select count(*) from public.lookup_catalog_product_by_barcode('05600000000010')),
  0::bigint,
  'barcode lookup hides a product without row-level source provenance'
);
select is(
  (select count(*) from public.search_catalog_products('gate serum', 20)),
  0::bigint,
  'search hides a product without row-level source provenance'
);
reset role;

update public.products
set source_ref = 'curated:catalog-gate-serum'
where id = '56000000-0000-4000-8000-000000000010';

update public.product_barcodes
set source_id = (
  select id from public.catalog_sources where source_key = 'open_beauty_facts'
)
where barcode = '05600000000010';
set local role service_role;
select is(
  (select count(*) from public.lookup_catalog_product_by_barcode('05600000000010')),
  0::bigint,
  'barcode lookup hides a reviewed mapping whose own source is not production approved'
);
select is(
  (select count(*) from public.search_catalog_products('gate serum', 20)),
  1::bigint,
  'a held alias mapping does not suppress an independently eligible name search'
);
reset role;

update public.product_barcodes
set source_id = (
  select id from public.catalog_sources where source_key = 'curated'
)
where barcode = '05600000000010';

-- Supabase's hosted API bootstrap supplies these ordinary catalog SELECT
-- grants. Rehearse the migration-owned RLS predicates explicitly in pgTAP.
grant select on
  public.products,
  public.product_barcodes,
  public.product_ingredients,
  public.product_ingredient_lists,
  public.product_ingredient_tokens,
  public.product_active_bands,
  public.product_pao_expiry
to authenticated;

set local role authenticated;
select is(
  pg_catalog.jsonb_build_object(
    'products', (select count(*) from public.products),
    'barcodes', (select count(*) from public.product_barcodes),
    'ingredients', (select count(*) from public.product_ingredients),
    'ingredient_lists', (select count(*) from public.product_ingredient_lists),
    'ingredient_tokens', (select count(*) from public.product_ingredient_tokens),
    'active_bands', (select count(*) from public.product_active_bands),
    'freshness', (select count(*) from public.product_pao_expiry),
    'recommendable', (select count(*) from public.recommendable_catalog_products)
  ),
  '{"active_bands": 1, "barcodes": 1, "freshness": 1, "ingredient_lists": 1, "ingredient_tokens": 1, "ingredients": 1, "products": 1, "recommendable": 1}'::jsonb,
  'direct authenticated product, legacy recommendation, and child reads expose only independently approved evidence without source-table access'
);
reset role;

-- Prove parent binding independently from source approval: brand_label is
-- transaction-locally approved, but it is not this product's curated source.
update public.catalog_sources
set production_approved = true,
    review_status = 'legal_approved',
    reviewed_by = 'pgtap-catalog-gate',
    reviewed_at = now()
where source_key = 'brand_label';

update public.product_barcodes
set source_id = (
  select id from public.catalog_sources where source_key = 'brand_label'
)
where barcode = '05600000000010';

set local role authenticated;
select is(
  pg_catalog.jsonb_build_object(
    'product', (
      select count(*)
      from public.products
      where id = '56000000-0000-4000-8000-000000000010'
    ),
    'barcode', (
      select count(*)
      from public.product_barcodes
      where barcode = '05600000000010'
    )
  ),
  '{"barcode": 0, "product": 1}'::jsonb,
  'direct barcode RLS rejects an approved mapping source that differs from its eligible parent source'
);
reset role;

update public.product_barcodes
set source_id = (
  select id from public.catalog_sources where source_key = 'curated'
)
where barcode = '05600000000010';

update public.catalog_sources
set production_approved = false
where source_key = 'curated';
set local role service_role;
select is(
  (select count(*) from public.lookup_catalog_product_by_barcode('05600000000010')),
  0::bigint,
  'barcode lookup hides a source without production approval'
);
select is(
  (select count(*) from public.search_catalog_products('gate serum', 20)),
  0::bigint,
  'search hides a source without production approval'
);
reset role;

update public.catalog_sources
set production_approved = true,
    review_status = 'pending'
where source_key = 'curated';
set local role service_role;
select is(
  (select count(*) from public.lookup_catalog_product_by_barcode('05600000000010')),
  0::bigint,
  'barcode lookup hides a source without legal approval'
);
select is(
  (select count(*) from public.search_catalog_products('gate serum', 20)),
  0::bigint,
  'search hides a source without legal approval'
);
reset role;

update public.catalog_sources
set review_status = 'legal_approved'
where source_key = 'curated';

update public.products
set status = 'retired'
where id = '56000000-0000-4000-8000-000000000010';
set local role service_role;
select is(
  (select count(*) from public.search_catalog_products('gate serum', 20)),
  0::bigint,
  'search hides an inactive product'
);
reset role;

update public.products
set status = 'active',
    review_status = 'needs_review'
where id = '56000000-0000-4000-8000-000000000010';
set local role service_role;
select is(
  (select count(*) from public.search_catalog_products('gate serum', 20)),
  0::bigint,
  'search hides a product whose review is incomplete'
);
reset role;

update public.products
set review_status = 'reviewed',
    quality_grade = 'limited'
where id = '56000000-0000-4000-8000-000000000010';
set local role service_role;
select is(
  (select count(*) from public.search_catalog_products('gate serum', 20)),
  0::bigint,
  'search hides a product below usable quality'
);
reset role;

update public.products
set quality_grade = 'verified',
    recommendation_eligible = false
where id = '56000000-0000-4000-8000-000000000010';
set local role service_role;
select is(
  (select count(*) from public.search_catalog_products('gate serum', 20)),
  0::bigint,
  'search hides a product whose eligibility projection is closed'
);
reset role;

update public.products
set recommendation_eligible = true,
    unresolved_correction_count = 1
where id = '56000000-0000-4000-8000-000000000010';
set local role service_role;
select is(
  (select count(*) from public.lookup_catalog_product_by_barcode('05600000000010')),
  0::bigint,
  'barcode lookup hides a product with unresolved correction count'
);
reset role;

update public.products
set unresolved_correction_count = 0,
    recommendation_eligible = true
where id = '56000000-0000-4000-8000-000000000010';

-- This fixture is testing the catalog anti-join, not the separately covered
-- owner health-consent admission trigger. Disable only that admission trigger;
-- leave the correction-count trigger active so its projection is exercised.
alter table public.catalog_corrections
  disable trigger trg_catalog_corrections_health_write;
insert into public.catalog_corrections (
  id,
  user_id,
  product_id,
  correction_type,
  status,
  description
)
values (
  '56000000-0000-4000-8000-000000000030',
  '56000000-0000-4000-8000-000000000001',
  '56000000-0000-4000-8000-000000000010',
  'wrong_match',
  'open',
  'Adversarial live correction for the serving gate.'
);
alter table public.catalog_corrections
  enable trigger trg_catalog_corrections_health_write;

set local role service_role;
select is(
  (select count(*) from public.lookup_catalog_product_by_barcode('05600000000010')),
  1::bigint,
  'an untrusted open report cannot globally suppress exact barcode lookup'
);
select is(
  (select count(*) from public.search_catalog_products('gate serum', 20)),
  1::bigint,
  'an untrusted open report cannot globally suppress catalog search'
);
reset role;

set local role authenticated;
select is(
  (select count(*) from public.products where id = '56000000-0000-4000-8000-000000000010'),
  1::bigint,
  'an untrusted open report cannot suppress another caller direct catalog reads'
);
reset role;

set local role service_role;
select lives_ok(
  $$select * from public.review_catalog_correction(
    '56000000-0000-4000-8000-000000000030'::uuid,
    1::bigint,
    'triaged',
    'pgtap.catalog-reviewer',
    'Verified wrong-match evidence; hold pending catalog repair.'
  )$$,
  'the service review RPC can create one audited hold at the exact active epoch'
);
reset role;

select is(
  (
    select pg_catalog.jsonb_build_object(
      'status', correction.status,
      'reviewed', correction.operator_reviewed_at is not null,
      'reviewed_by', correction.operator_reviewed_by,
      'hold_count', product.unresolved_correction_count,
      'eligible', product.recommendation_eligible
    )
    from public.catalog_corrections as correction
    join public.products as product on product.id = correction.product_id
    where correction.product_id = '56000000-0000-4000-8000-000000000010'
  ),
  '{"eligible": false, "hold_count": 1, "reviewed": true, "reviewed_by": "pgtap.catalog-reviewer", "status": "triaged"}'::jsonb,
  'only the audited operator transition closes the serving projection'
);

-- Deliberately corrupt the denormalized projection. The live anti-join must
-- still prevent either serving path from leaking an operator-held product.
update public.products
set unresolved_correction_count = 0,
    recommendation_eligible = true
where id = '56000000-0000-4000-8000-000000000010';

set local role authenticated;
select is(
  pg_catalog.jsonb_build_object(
    'products', (select count(*) from public.products),
    'barcodes', (select count(*) from public.product_barcodes),
    'ingredients', (select count(*) from public.product_ingredients),
    'ingredient_lists', (select count(*) from public.product_ingredient_lists),
    'ingredient_tokens', (select count(*) from public.product_ingredient_tokens),
    'active_bands', (select count(*) from public.product_active_bands),
    'freshness', (select count(*) from public.product_pao_expiry)
  ),
  '{"active_bands": 0, "barcodes": 0, "freshness": 0, "ingredient_lists": 0, "ingredient_tokens": 0, "ingredients": 0, "products": 0}'::jsonb,
  'an operator-audited hold suppresses every direct product and child read even if projection state is corrupt'
);
reset role;

set local role service_role;
select is(
  (select count(*) from public.lookup_catalog_product_by_barcode('05600000000010')),
  0::bigint,
  'barcode lookup rechecks live operator holds instead of trusting stale projection state'
);
select is(
  (select count(*) from public.search_catalog_products('gate serum', 20)),
  0::bigint,
  'search rechecks live operator holds instead of trusting stale projection state'
);
reset role;

alter table public.catalog_corrections
  disable trigger trg_catalog_corrections_health_write;
update public.catalog_corrections
set status = 'closed'
where product_id = '56000000-0000-4000-8000-000000000010';
alter table public.catalog_corrections
  enable trigger trg_catalog_corrections_health_write;

update public.product_barcodes
set review_status = 'needs_review'
where barcode = '05600000000010';
set local role service_role;
select is(
  (select count(*) from public.lookup_catalog_product_by_barcode('05600000000010')),
  0::bigint,
  'barcode lookup hides an unreviewed barcode mapping'
);
select is(
  (select count(*) from public.search_catalog_products('gate serum', 20)),
  1::bigint,
  'mapping review does not suppress an otherwise eligible name search'
);
reset role;

update public.product_barcodes
set review_status = 'reviewed'
where barcode = '05600000000010';

set local role authenticated;
select is(
  (select count(*) from public.products where id = '56000000-0000-4000-8000-000000000010'),
  1::bigint,
  'direct authenticated product reads retain an eligible row'
);
select is(
  (select count(*) from public.product_barcodes where barcode = '05600000000010'),
  1::bigint,
  'direct authenticated barcode reads retain an eligible reviewed mapping'
);
reset role;

update public.catalog_sources
set production_approved = false
where source_key = 'curated';
set local role authenticated;
select is(
  (select count(*) from public.products where id = '56000000-0000-4000-8000-000000000010'),
  0::bigint,
  'direct authenticated product reads hide a source whose approval is withdrawn'
);
select is(
  (select count(*) from public.product_barcodes where barcode = '05600000000010'),
  0::bigint,
  'direct authenticated barcode reads cannot bypass withdrawn source approval'
);
reset role;

-- A caller cannot forge the FK-only correction detach directly or by nesting
-- it inside another trigger while the parent still exists. The actual parent
-- deletion needs no reporter epoch and preserves every correction/audit field.
select pg_catalog.set_config('request.headers', '', true);

select throws_ok(
  $$update public.catalog_corrections
       set product_id = null
     where id = '56000000-0000-4000-8000-000000000030'::uuid$$,
  '55000',
  'HEALTH_PROCESSING_EPOCH_REQUIRED',
  'a headerless direct correction detach remains health-epoch fenced'
);

create or replace function pg_temp.attempt_nested_catalog_detach()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  update public.catalog_corrections
     set product_id = null
   where id = '56000000-0000-4000-8000-000000000030'::uuid;
  return new;
end;
$$;

create temporary table catalog_detach_probe (id integer primary key);
create trigger trg_attempt_nested_catalog_detach
  after insert on catalog_detach_probe
  for each row execute function pg_temp.attempt_nested_catalog_detach();

select throws_ok(
  $$insert into catalog_detach_probe (id) values (1)$$,
  '55000',
  'HEALTH_PROCESSING_EPOCH_REQUIRED',
  'a nested correction detach cannot impersonate FK deletion while the parent exists'
);

create temporary table catalog_correction_before_product_delete
on commit drop
as
select pg_catalog.to_jsonb(correction) - 'product_id' as preserved_row
from public.catalog_corrections as correction
where correction.id = '56000000-0000-4000-8000-000000000030'::uuid;

select lives_ok(
  $$delete from public.products
     where id = '56000000-0000-4000-8000-000000000010'::uuid$$,
  'headerless catalog-administrator rollback can delete a product without the reporter epoch'
);

select ok(
  coalesce(
    (
      select correction.product_id is null
        and pg_catalog.to_jsonb(correction) - 'product_id' = before.preserved_row
      from public.catalog_corrections as correction
      cross join catalog_correction_before_product_delete as before
      where correction.id = '56000000-0000-4000-8000-000000000030'::uuid
    ),
    false
  ),
  'product rollback detaches but preserves the complete correction and operator-audit record'
);

select * from finish();
rollback;
