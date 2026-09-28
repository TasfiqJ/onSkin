begin;

create extension if not exists pgtap with schema extensions;
set local search_path = extensions, public, pg_catalog;

select plan(218);

create temp table cat02_test_state (
  state_key text primary key,
  value_uuid uuid,
  value_text text,
  value_json jsonb
);

-- SET ROLE changes the current database role even though this transaction's
-- temporary fixture state remains owned by the pgTAP session owner. Grant the
-- authenticated test role read-only access to that temporary relation so the
-- assertions can resolve fixture UUIDs without granting any production table
-- privilege.
grant select on table cat02_test_state to authenticated;

create or replace function pg_temp.cat02_manifest(
  p_source text,
  p_snapshot date default current_date
)
returns jsonb
language sql
stable
set search_path = ''
as $$
  select pg_catalog.jsonb_build_object(
    'schemaVersion', '1',
    'status', 'approved_transform',
    'importMode', case p_source
      when 'open_beauty_facts' then 'approved_offline_export'
      when 'cosing' then 'approved_offline_snapshot'
    end,
    'sourceKey', p_source,
    'sourceComponentId', case p_source
      when 'open_beauty_facts' then 'obf_odbl_component'
      when 'cosing' then 'cosing_reference_component'
    end,
    'parserVersion', case p_source
      when 'open_beauty_facts' then 'phase4-obf-transform-v2'
      when 'cosing' then 'phase4-cosing-transform-v2'
    end,
    'artifactKind', 'production',
    'territory', 'US',
    'snapshotDate', p_snapshot,
    'artifactSha256', pg_catalog.repeat('a', 64),
    'manifestSha256', pg_catalog.repeat('b', 64),
    'sourcePolicySha256', pg_catalog.repeat('c', 64),
    'sourceApprovalSha256', pg_catalog.repeat('d', 64),
    'transformSha256', pg_catalog.repeat('e', 64),
    'transformedPayloadSha256', pg_catalog.repeat('f', 64),
    'qaReportSha256', pg_catalog.repeat('0', 64),
    'qaStatus', 'pass'
  )
$$;

create or replace function pg_temp.cat02_begin_receipt(
  p_operation text,
  p_source text,
  p_expected integer default 1,
  p_artifact_kind text default 'production',
  p_territory text default 'US',
  p_blockers integer default 0,
  p_warnings integer default 0,
  p_artifact_uri text default null,
  p_qa_uri text default null
)
returns jsonb
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v_result jsonb;
  v_manifest jsonb := pg_temp.cat02_manifest(p_source, current_date);
begin
  v_manifest := pg_catalog.jsonb_set(v_manifest, '{artifactKind}', pg_catalog.to_jsonb(p_artifact_kind));
  v_manifest := pg_catalog.jsonb_set(v_manifest, '{territory}', pg_catalog.to_jsonb(p_territory));
  select pg_catalog.to_jsonb(result) into v_result
  from public.begin_catalog_import(
    p_operation,
    p_source,
    case p_source when 'open_beauty_facts' then 'obf_export' else 'cosing_dictionary' end,
    current_date,
    p_artifact_kind,
    p_territory,
    coalesce(p_artifact_uri, case p_source
      when 'open_beauty_facts' then 'https://static.openbeautyfacts.org/data/open-beauty-facts.jsonl'
      else 'https://ec.europa.eu/growth/tools-databases/cosing/reference.csv'
    end),
    pg_catalog.repeat('a', 64),
    v_manifest,
    pg_catalog.repeat('b', 64),
    pg_catalog.repeat('c', 64),
    pg_catalog.repeat('d', 64),
    pg_catalog.repeat('e', 64),
    pg_catalog.repeat('f', 64),
    coalesce(p_qa_uri, 'docs/phase-4/catalog-import-qa.json'),
    pg_catalog.repeat('0', 64),
    p_blockers,
    p_warnings,
    p_expected,
    case p_source
      when 'open_beauty_facts' then 'phase4-obf-transform-v2'
      else 'phase4-cosing-transform-v2'
    end
  ) as result;
  return v_result;
end;
$$;

create or replace function pg_temp.cat02_product(
  p_barcode text,
  p_name text default 'CAT-02 Product',
  p_brand text default 'CAT-02 Brand',
  p_category text default 'moisturiser_tube',
  p_ingredients text default 'Water, Glycerin',
  p_source_ref text default null
)
returns jsonb
language sql
stable
set search_path = ''
as $$
  select pg_catalog.jsonb_build_object(
    'recordKind', 'product',
    'canonicalKey', p_barcode,
    'barcode', p_barcode,
    'name', p_name,
    'brand', p_brand,
    'category', p_category,
    'ingredientsText', p_ingredients,
    'source', 'open_beauty_facts',
    'sourceComponentId', 'obf_odbl_component',
    'sourceRef', coalesce(p_source_ref, p_barcode),
    'sourceUrl', 'https://world.openbeautyfacts.org/product/' || p_barcode,
    'sourceRecordModifiedDate', current_date,
    'sourceArtifactSha256', pg_catalog.repeat('a', 64),
    'qualityGrade', 'unverified',
    'reviewStatus', 'unreviewed',
    'sourceSnapshotDate', current_date,
    'region', 'US'
  )
$$;

create or replace function pg_temp.cat02_ingredient(
  p_inci text,
  p_source_ref text,
  p_cas text default null,
  p_ec text default null,
  p_annex text default null,
  p_synonyms jsonb default '[]'::jsonb,
  p_display text default null
)
returns jsonb
language sql
stable
set search_path = ''
as $$
  select pg_catalog.jsonb_build_object(
    'recordKind', 'ingredient',
    'canonicalKey', private.catalog_import_normalize_key(p_inci),
    'inciName', p_inci,
    'displayName', coalesce(p_display, p_inci),
    'casNumber', p_cas,
    'ecNumber', p_ec,
    'annexStatus', p_annex,
    'sourceRef', p_source_ref,
    'sourceRecordStatus', 'active',
    'glossaryDecision', 'EU_2025_1175',
    'source', 'cosing',
    'sourceComponentId', 'cosing_reference_component',
    'sourceUrl', 'https://ec.europa.eu/growth/tools-databases/cosing/reference.csv',
    'sourceArtifactSha256', pg_catalog.repeat('a', 64),
    'reviewStatus', 'unreviewed',
    'synonyms', p_synonyms,
    'sourceSnapshotDate', current_date
  )
$$;

create or replace function pg_temp.cat02_stage(
  p_batch uuid,
  p_operation text,
  p_records jsonb
)
returns jsonb
language sql
volatile
security definer
set search_path = ''
as $$
  select pg_catalog.to_jsonb(result)
  from public.stage_catalog_import_chunk(p_batch, p_operation, 1, 1, p_records) as result
$$;

create or replace function pg_temp.cat02_finalize(
  p_batch uuid,
  p_operation text,
  p_expected integer default 1
)
returns jsonb
language sql
volatile
security definer
set search_path = ''
as $$
  select pg_catalog.to_jsonb(result)
  from public.finalize_catalog_import(p_batch, p_operation, p_expected) as result
$$;

create or replace function pg_temp.cat02_verify(
  p_batch uuid,
  p_operation text
)
returns jsonb
language sql
volatile
security definer
set search_path = ''
as $$
  select pg_catalog.to_jsonb(result)
  from public.verify_catalog_import(
    p_batch,
    p_operation,
    (select batches.records_sha256 from public.catalog_import_batches as batches where batches.id = p_batch),
    pg_catalog.repeat('9', 64)
  ) as result
$$;

create or replace function pg_temp.cat02_decisions(
  p_batch uuid,
  p_decision text default 'accepted'
)
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
  select pg_catalog.jsonb_agg(pg_catalog.jsonb_build_object(
    'recordOrdinal', records.record_ordinal,
    'recordSha256', records.record_sha256,
    'decision', coalesce(events.decision, p_decision),
    'reason', coalesce(events.reason, case p_decision
      when 'accepted' then 'Two-person source and row evidence review passed.'
      else 'Rejected by two-person source and row evidence review.'
    end)
  ) order by records.record_ordinal)
  from private.catalog_import_staged_records as records
  left join private.catalog_import_review_events as events
    on events.batch_id = records.batch_id and events.staged_record_id = records.id
  where records.batch_id = p_batch
    and (records.disposition = 'pending' or events.id is not null)
$$;

create or replace function pg_temp.cat02_review(
  p_batch uuid,
  p_operation text,
  p_decision text default 'accepted',
  p_expected_evidence_sha text default null,
  p_reviewers text[] default array['reviewer.alpha', 'reviewer.beta']::text[],
  p_expected_verification_sha text default null
)
returns jsonb
language sql
volatile
security definer
set search_path = ''
as $$
  select pg_catalog.to_jsonb(result)
  from public.review_catalog_import(
    p_batch,
    p_operation,
    pg_temp.cat02_decisions(p_batch, p_decision),
    (select batches.candidates_sha256 from public.catalog_import_batches as batches where batches.id = p_batch),
    coalesce(p_expected_evidence_sha, private.catalog_import_batch_evidence_sha256(p_batch)),
    coalesce(p_expected_verification_sha, pg_catalog.repeat('9', 64)),
    p_reviewers,
    'CAT02-REVIEW-2026-07-17',
    pg_catalog.repeat('8', 64)
  ) as result
$$;

create or replace function pg_temp.cat02_promote(
  p_batch uuid,
  p_operation text,
  p_operator text default 'operator.gamma'
)
returns jsonb
language sql
volatile
security definer
set search_path = ''
as $$
  select pg_catalog.to_jsonb(result)
  from public.promote_catalog_import(
    p_batch,
    p_operation,
    p_operator,
    'CAT02-REVIEW-2026-07-17',
    pg_catalog.repeat('8', 64)
  ) as result
$$;

create or replace function pg_temp.cat02_rollback(
  p_batch uuid,
  p_operation text,
  p_operator text default 'operator.delta',
  p_ticket text default 'CAT02-REVIEW-2026-07-17',
  p_evidence text default null
)
returns jsonb
language sql
volatile
security definer
set search_path = ''
as $$
  select pg_catalog.to_jsonb(result)
  from public.rollback_catalog_import(
    p_batch,
    p_operation,
    p_operator,
    p_ticket,
    coalesce(p_evidence, pg_catalog.repeat('8', 64)),
    'CAT-02 transactional rollback verification.'
  ) as result
$$;

create or replace function pg_temp.cat02_prepare_reviewed(
  p_prefix text,
  p_source text,
  p_records jsonb,
  p_reviewers text[] default array['reviewer.alpha', 'reviewer.beta']::text[]
)
returns uuid
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v_batch uuid;
begin
  v_batch := (pg_temp.cat02_begin_receipt(
    p_prefix || '.begin', p_source, pg_catalog.jsonb_array_length(p_records)
  ) ->> 'batch_id')::uuid;
  perform pg_temp.cat02_stage(v_batch, p_prefix || '.chunk', p_records);
  perform pg_temp.cat02_finalize(
    v_batch, p_prefix || '.finalize', pg_catalog.jsonb_array_length(p_records)
  );
  perform pg_temp.cat02_verify(v_batch, p_prefix || '.verify');
  perform pg_temp.cat02_review(
    v_batch, p_prefix || '.review', 'accepted', null, p_reviewers
  );
  return v_batch;
end;
$$;

-- Transaction-local source approval is test evidence only; rollback restores
-- the repository seed truth.
update public.catalog_sources
set production_approved = true,
    review_status = 'legal_approved',
    reviewed_by = 'cat02.source.owner',
    reviewed_at = pg_catalog.now() - interval '1 hour',
    attribution_text = coalesce(nullif(attribution_text, ''), 'CAT-02 source attribution.'),
    attribution_url = case source_key
      when 'open_beauty_facts' then 'https://world.openbeautyfacts.org/'
      when 'cosing' then 'https://single-market-economy.ec.europa.eu/sectors/cosmetics/cosmetic-ingredient-database_en'
      else attribution_url
    end
where source_key in ('open_beauty_facts', 'cosing');

select has_table('private', 'catalog_import_staged_records', 'CAT-02 has a private staging relation');
select has_table('private', 'catalog_import_review_events', 'CAT-02 has an immutable review ledger');
select has_table('private', 'catalog_import_promotion_events', 'CAT-02 has an immutable promotion/rollback ledger');
select has_column('public', 'catalog_import_batches', 'candidates_sha256', 'batches bind ordered source candidates');
select has_column('public', 'catalog_import_batches', 'reviewer_ids', 'batches retain the exact reviewer set');
select has_column('public', 'products', 'import_batch_id', 'products retain import lineage');
select has_column('public', 'ingredients', 'import_batch_id', 'ingredients retain import lineage');

select ok(
  (select count(*) from pg_catalog.pg_class as relations
   where relations.oid = any(array[
     'public.catalog_import_batches'::regclass,
     'public.catalog_quality_reports'::regclass,
     'public.catalog_sources'::regclass,
     'private.catalog_import_chunk_receipts'::regclass,
     'private.catalog_import_staged_records'::regclass,
     'private.catalog_import_review_events'::regclass,
     'private.catalog_import_conflicts'::regclass,
     'private.catalog_import_promotion_events'::regclass,
     'private.catalog_import_entity_revisions'::regclass,
     'private.catalog_import_batch_effects'::regclass
   ]) and relations.relrowsecurity and relations.relforcerowsecurity) = 10,
  'all lifecycle/source authority relations have enabled and forced RLS'
);

select ok(
  exists (
    select 1 from pg_catalog.pg_indexes
    where schemaname = 'public'
      and indexname = 'catalog_import_batches_finalize_operation_uidx'
      and indexdef ilike '%unique%where (finalize_operation_key is not null)%'
  ) and exists (
    select 1 from pg_catalog.pg_indexes
    where schemaname = 'public'
      and indexname = 'catalog_import_batches_verification_operation_uidx'
      and indexdef ilike '%unique%where (verification_operation_key is not null)%'
  ) and exists (
    select 1 from pg_catalog.pg_indexes
    where schemaname = 'public'
      and indexname = 'catalog_import_batches_review_operation_uidx'
      and indexdef ilike '%unique%where (review_operation_key is not null)%'
  ),
  'finalize, verify, and review operation keys have database-enforced global uniqueness'
);

select ok(
  not exists (
    select 1
    from pg_catalog.pg_proc as function
    cross join lateral pg_catalog.aclexplode(
      coalesce(
        function.proacl,
        pg_catalog.acldefault('f', function.proowner)
      )
    ) as privilege
    where function.oid =
      'public.stage_catalog_import_chunk(uuid,text,integer,integer,jsonb)'::regprocedure
      and privilege.grantee = 0
      and privilege.privilege_type = 'EXECUTE'
  )
  and not has_function_privilege(
    'anon',
    'public.stage_catalog_import_chunk(uuid,text,integer,integer,jsonb)',
    'execute'
  )
  and not has_function_privilege(
    'authenticated',
    'public.stage_catalog_import_chunk(uuid,text,integer,integer,jsonb)',
    'execute'
  )
  and has_function_privilege('service_role', 'public.begin_catalog_import(text,text,text,date,text,text,text,text,jsonb,text,text,text,text,text,text,text,integer,integer,integer,text)', 'execute')
  and has_function_privilege('service_role', 'public.stage_catalog_import_chunk(uuid,text,integer,integer,jsonb)', 'execute')
  and has_function_privilege('service_role', 'public.finalize_catalog_import(uuid,text,integer)', 'execute')
  and has_function_privilege('service_role', 'public.verify_catalog_import(uuid,text,text,text)', 'execute'),
  'PUBLIC, anon, and authenticated cannot execute staging while the service role retains the import lifecycle'
);

select ok(
  pg_catalog.strpos(
    pg_catalog.pg_get_functiondef(
      'public.stage_catalog_import_chunk(uuid,text,integer,integer,jsonb)'::regprocedure
    ),
    $$'benzoyl_peroxide'$$
  ) > 0,
  'the latest forward migration admits the signed benzoyl-peroxide category override at staging'
);

insert into cat02_test_state (state_key, value_uuid)
select 'benzoyl_override_batch', (receipt.value ->> 'batch_id')::uuid
from (
  select pg_temp.cat02_begin_receipt(
    'cat02.benzoyl-override.begin', 'open_beauty_facts', 1
  ) as value
) as receipt;

select lives_ok(
  $$select pg_temp.cat02_stage(
      (select value_uuid from cat02_test_state where state_key = 'benzoyl_override_batch'),
      'cat02.benzoyl-override.chunk',
      pg_catalog.jsonb_build_array(
        pg_temp.cat02_product(
          '12345670', 'CAT-02 Reviewed Benzoyl Product', 'CAT-02 Brand',
          'benzoyl_peroxide'
        )
      )
    )$$,
  'the service staging RPC accepts an evidence-reviewed benzoyl-peroxide candidate'
);

select is(
  (pg_temp.cat02_finalize(
    (select value_uuid from cat02_test_state where state_key = 'benzoyl_override_batch'),
    'cat02.benzoyl-override.finalize',
    1
  ) ->> 'batch_status'),
  'finalized'::text,
  'the benzoyl-peroxide candidate produces a complete finalized database receipt'
);

insert into cat02_test_state (state_key, value_uuid)
select 'unsupported_category_batch', (receipt.value ->> 'batch_id')::uuid
from (
  select pg_temp.cat02_begin_receipt(
    'cat02.unsupported-category.begin', 'open_beauty_facts', 1
  ) as value
) as receipt;

select throws_ok(
  $$select pg_temp.cat02_stage(
      (select value_uuid from cat02_test_state where state_key = 'unsupported_category_batch'),
      'cat02.unsupported-category.chunk',
      pg_catalog.jsonb_build_array(
        pg_temp.cat02_product(
          '87654325', 'CAT-02 Unsupported Category', 'CAT-02 Brand',
          'acne_treatment'
        )
      )
    )$$,
  '22023',
  'CATALOG_IMPORT_PRODUCT_RECORD_INVALID',
  'the staging RPC still rejects every unsupported category value'
);

select ok(
  not has_function_privilege('service_role', 'public.review_catalog_import(uuid,text,jsonb,text,text,text,text[],text,text)', 'execute')
  and not has_function_privilege('service_role', 'public.promote_catalog_import(uuid,text,text,text,text)', 'execute')
  and not has_function_privilege('service_role', 'public.rollback_catalog_import(uuid,text,text,text,text,text)', 'execute')
  and not has_function_privilege('authenticated', 'public.review_catalog_import(uuid,text,jsonb,text,text,text,text[],text,text)', 'execute')
  and not has_function_privilege('anon', 'public.promote_catalog_import(uuid,text,text,text,text)', 'execute'),
  'review, promotion, and rollback remain migration-owner-only pending CAT-08'
);

select ok(
  not exists (
    select 1
    from pg_catalog.unnest(array['public','anon','authenticated','service_role']::text[]) as roles(role_name)
    cross join pg_catalog.unnest(array[
      'SELECT','INSERT','UPDATE','DELETE','TRUNCATE','REFERENCES','TRIGGER'
    ]::text[]) as privileges(privilege_name)
    where pg_catalog.has_table_privilege(
      roles.role_name, 'public.catalog_sources', privileges.privilege_name
    )
  ),
  'API roles have no direct read, mutation, truncate, reference, or trigger lane to source authority'
);

select ok(
  not exists (
    select 1
    from pg_catalog.unnest(array['public','anon','authenticated','service_role']::text[]) as roles(role_name)
    cross join pg_catalog.unnest(array[
      'INSERT','UPDATE','DELETE','TRUNCATE','REFERENCES','TRIGGER'
    ]::text[]) as privileges(privilege_name)
    cross join pg_catalog.unnest(array[
      'public.products', 'public.product_barcodes', 'public.product_ingredient_lists',
      'public.product_ingredient_tokens', 'public.product_ingredients',
      'public.product_active_bands', 'public.product_pao_expiry',
      'public.ingredients', 'public.ingredient_synonyms', 'public.ingredient_tags',
      'public.ingredient_pao_defaults', 'public.brands', 'public.product_categories',
      'public.ingredient_tag_definitions', 'public.ingredient_tag_assignments'
    ]::text[]) as projections(table_name)
    where pg_catalog.has_table_privilege(
      roles.role_name, projections.table_name, privileges.privilege_name
    )
  ),
  'all API roles lack every global catalog mutation, truncate, reference, and trigger privilege'
);

select ok(
  not exists (
    select 1
    from pg_catalog.unnest(array['public','anon','authenticated','service_role']::text[]) as roles(role_name)
    cross join pg_catalog.unnest(array[
      'SELECT','INSERT','UPDATE','DELETE','TRUNCATE','REFERENCES','TRIGGER'
    ]::text[]) as privileges(privilege_name)
    cross join pg_catalog.unnest(array[
      'public.catalog_import_batches', 'public.catalog_quality_reports',
      'private.catalog_import_chunk_receipts', 'private.catalog_import_staged_records',
      'private.catalog_import_review_events', 'private.catalog_import_conflicts',
      'private.catalog_import_promotion_events', 'private.catalog_import_entity_revisions',
      'private.catalog_import_batch_effects'
    ]::text[]) as sealed(table_name)
    where pg_catalog.has_table_privilege(
      roles.role_name, sealed.table_name, privileges.privilege_name
    )
  ),
  'all API roles have zero direct privilege on every sealed lifecycle/evidence relation'
);

set local role service_role;
select throws_ok(
  $$select * from public.catalog_sources$$,
  '42501',
  'permission denied for table catalog_sources',
  'service role cannot directly read source approval rows'
);
select throws_ok(
  $$update public.catalog_sources set production_approved = false where source_key = 'cosing'$$,
  '42501',
  'permission denied for table catalog_sources',
  'service role cannot withdraw or forge source approval'
);
select throws_ok(
  $$truncate table public.products$$,
  '42501',
  'permission denied for table products',
  'service role cannot truncate global catalog projections'
);
reset role;

select is(
  private.catalog_import_canonical_json('{"z":["x",null],"a":"é"}'::jsonb),
  '{"a":"é","z":["x",null]}'::text,
  'database canonical JSON matches recursive lexicographic cross-runtime bytes'
);
select is(
  private.catalog_import_sha256_text(
    private.catalog_import_canonical_json('{"z":["x",null],"a":"é"}'::jsonb)
  ),
  '04c3e06db50d60a00f95ebc09b63c0b1ee0648b311379518ef0830c4c5b4f671'::text,
  'database canonical JSON SHA matches the independent UTF-8 runtime vector'
);

select is(
  array(
    select private.catalog_import_normalize_key('a' || pg_catalog.chr(codepoint) || 'b')
    from pg_catalog.unnest(array[
      9,10,11,12,13,32,160,5760,8192,8193,8194,8195,8196,8197,8198,
      8199,8200,8201,8202,8232,8233,8239,8287,12288,65279
    ]) as whitespace(codepoint)
  ),
  pg_catalog.array_fill('A B'::text, array[25]),
  'every explicit shared ECMAScript whitespace code point collapses identically'
);
select is(
  private.catalog_import_normalize_key(
    U&'  a\00A0\2028\2029\202F\3000\FEFF\0009\000Ab  '
  ),
  'A B'::text,
  'mixed shared whitespace runs collapse and trim to one ASCII space'
);
select is(private.catalog_import_normalize_key(U&'a\030A'), U&'\00C5', 'NFKC composes A-ring before casing');
select is(private.catalog_import_normalize_key(U&'\00E9'), U&'\00C9', 'ICU uppercases lower e-acute');
select is(private.catalog_import_normalize_key(U&'\00DF'), 'SS'::text, 'ICU casing matches JavaScript sharp-s expansion');
select is(
  array[
    private.catalog_import_normalize_key(U&'\0131'),
    private.catalog_import_normalize_key(U&'\0130')
  ],
  array['I'::text, U&'\0130'],
  'root ICU casing matches JavaScript dotted and dotless-i behavior'
);
select is(private.catalog_import_normalize_key(U&'\FF28\FF45\FF4C\FF4C\FF4F'), 'HELLO'::text, 'NFKC folds full-width text');

select throws_ok(
  $$select pg_temp.cat02_begin_receipt('cat02.invalid.fixture', 'open_beauty_facts', 1, 'fixture')$$,
  '22023', 'CATALOG_IMPORT_EVIDENCE_INVALID',
  'fixture artifacts cannot enter the production lifecycle'
);
select throws_ok(
  $$select pg_temp.cat02_begin_receipt('cat02.invalid.candidate', 'open_beauty_facts', 1, 'candidate')$$,
  '22023', 'CATALOG_IMPORT_EVIDENCE_INVALID',
  'candidate artifacts cannot enter the production lifecycle'
);
select throws_ok(
  $$select pg_temp.cat02_begin_receipt('cat02.invalid.nonus', 'open_beauty_facts', 1, 'production', 'CA')$$,
  '22023', 'CATALOG_IMPORT_EVIDENCE_INVALID',
  'non-US catalog evidence fails closed'
);
select throws_ok(
  $$select pg_temp.cat02_begin_receipt('cat02.invalid.qa-blocker', 'open_beauty_facts', 1, 'production', 'US', 1, 0)$$,
  '22023', 'CATALOG_IMPORT_EVIDENCE_INVALID',
  'QA blockers reject a batch before residue is created'
);
select throws_ok(
  $$select pg_temp.cat02_begin_receipt('cat02.invalid.qa-warning', 'open_beauty_facts', 1, 'production', 'US', 0, 1)$$,
  '22023', 'CATALOG_IMPORT_EVIDENCE_INVALID',
  'QA warnings reject a batch before residue is created'
);
select throws_ok(
  $$select pg_temp.cat02_begin_receipt('cat02.invalid.count', 'open_beauty_facts', 100001)$$,
  '22023', 'CATALOG_IMPORT_EVIDENCE_INVALID',
  '100001 records exceeds the offline and database owner-review bound'
);
select throws_ok(
  $$select pg_temp.cat02_begin_receipt(
    'cat02.invalid.artifact-uri', 'open_beauty_facts', 1, 'production', 'US', 0, 0,
    repeat('x', 2001)
  )$$,
  '22023', 'CATALOG_IMPORT_EVIDENCE_INVALID',
  'oversized artifact URIs are rejected'
);
select throws_ok(
  $$select pg_temp.cat02_begin_receipt(
    'cat02.invalid.qa-uri', 'open_beauty_facts', 1, 'production', 'US', 0, 0,
    null, repeat('q', 2049)
  )$$,
  '22023', 'CATALOG_IMPORT_EVIDENCE_INVALID',
  'oversized QA evidence URIs are rejected'
);

update public.catalog_sources set production_approved = false where source_key = 'cosing';
select throws_ok(
  $$select pg_temp.cat02_begin_receipt('cat02.invalid.unapproved', 'cosing')$$,
  '55000', 'CATALOG_IMPORT_SOURCE_NOT_APPROVED',
  'an unapproved source cannot begin even through the security-definer service lane'
);
update public.catalog_sources set production_approved = true where source_key = 'cosing';

select is(
  (select count(*) from public.catalog_import_batches where operation_key like 'cat02.invalid.%'),
  0::bigint,
  'all rejected begin attempts leave no batch residue'
);

-- Service-input bounds reject hostile records transactionally.
with receipt as (
  select pg_temp.cat02_begin_receipt('cat02.stage-invalid.product', 'open_beauty_facts') as value
)
insert into cat02_test_state (state_key, value_uuid, value_json)
select 'invalid_product_batch', (value ->> 'batch_id')::uuid, value from receipt;

select throws_ok(
  $$select pg_temp.cat02_stage(
    (select value_uuid from cat02_test_state where state_key = 'invalid_product_batch'),
    'cat02.stage-invalid.extra-key',
    pg_catalog.jsonb_build_array(
      pg_temp.cat02_product('990000000004') || '{"unexpected":"field"}'::jsonb
    )
  )$$,
  '22023', 'CATALOG_IMPORT_PRODUCT_RECORD_INVALID',
  'an extra product candidate key rejects the whole chunk'
);
select throws_ok(
  $$select pg_temp.cat02_stage(
    (select value_uuid from cat02_test_state where state_key = 'invalid_product_batch'),
    'cat02.stage-invalid.brand',
    pg_catalog.jsonb_build_array(
      pg_temp.cat02_product('990000000004', 'Bounded Product', repeat('b', 301))
    )
  )$$,
  '22023', 'CATALOG_IMPORT_PRODUCT_RECORD_INVALID',
  'an oversized product brand rejects the whole chunk'
);
select throws_ok(
  $$select pg_temp.cat02_stage(
    (select value_uuid from cat02_test_state where state_key = 'invalid_product_batch'),
    'cat02.stage-invalid.product-ecmascript-trim',
    pg_catalog.jsonb_build_array(
      pg_temp.cat02_product('990000000004', U&'\00A0Bounded Product')
    )
  )$$,
  '22023', 'CATALOG_IMPORT_PRODUCT_RECORD_INVALID',
  'direct staging rejects product text with ECMAScript edge whitespace instead of silently trimming signed bytes'
);
select throws_ok(
  $$select pg_temp.cat02_stage(
    (select value_uuid from cat02_test_state where state_key = 'invalid_product_batch'),
    'cat02.stage-invalid.product-control',
    pg_catalog.jsonb_build_array(
      pg_temp.cat02_product('990000000004', 'Bounded' || pg_catalog.chr(1) || 'Product')
    )
  )$$,
  '22023', 'CATALOG_IMPORT_PRODUCT_RECORD_INVALID',
  'direct staging rejects ASCII controls embedded in signed product text'
);
select throws_ok(
  $$select pg_temp.cat02_stage(
    (select value_uuid from cat02_test_state where state_key = 'invalid_product_batch'),
    'cat02.stage-invalid.ingredients-20001',
    pg_catalog.jsonb_build_array(
      pg_temp.cat02_product(
        '990000000004', 'Bounded Product', 'CAT-02 Brand', 'moisturiser_tube',
        pg_catalog.repeat('i', 20001)
      )
    )
  )$$,
  '22023', 'CATALOG_IMPORT_PRODUCT_RECORD_INVALID',
  'OBF ingredientsText rejects 20,001 characters'
);
select throws_ok(
  $$select pg_temp.cat02_stage(
    (select value_uuid from cat02_test_state where state_key = 'invalid_product_batch'),
    'cat02.stage-invalid.product-utf16-limit',
    pg_catalog.jsonb_build_array(
      pg_temp.cat02_product(
        '990000000004', pg_catalog.repeat(U&'\+01F600', 101)
      )
    )
  )$$,
  '22023', 'CATALOG_IMPORT_PRODUCT_RECORD_INVALID',
  'direct staging counts astral product text as two JavaScript UTF-16 code units'
);
select throws_ok(
  $$select pg_temp.cat02_stage(
    (select value_uuid from cat02_test_state where state_key = 'invalid_product_batch'),
    'cat02.stage-invalid.product-null-url',
    pg_catalog.jsonb_build_array(
      pg_temp.cat02_product('990000000004') || pg_catalog.jsonb_build_object('sourceUrl', null)
    )
  )$$,
  '22023', 'CATALOG_IMPORT_PRODUCT_RECORD_INVALID',
  'JSON null cannot bypass required product sourceUrl validation'
);
select throws_ok(
  $$select pg_temp.cat02_stage(
    (select value_uuid from cat02_test_state where state_key = 'invalid_product_batch'),
    'cat02.stage-invalid.product-null-modified',
    pg_catalog.jsonb_build_array(
      pg_temp.cat02_product('990000000004') || pg_catalog.jsonb_build_object('sourceRecordModifiedDate', null)
    )
  )$$,
  '22023', 'CATALOG_IMPORT_PRODUCT_RECORD_INVALID',
  'JSON null cannot bypass required product source-modified date validation'
);
select throws_ok(
  $$select pg_temp.cat02_stage(
    (select value_uuid from cat02_test_state where state_key = 'invalid_product_batch'),
    'cat02.stage-invalid.product-bad-calendar',
    pg_catalog.jsonb_build_array(
      pg_temp.cat02_product('990000000004') ||
        pg_catalog.jsonb_build_object('sourceRecordModifiedDate', '2026-02-31')
    )
  )$$,
  '22023', 'CATALOG_IMPORT_PRODUCT_RECORD_INVALID',
  'calendar-invalid product source date is rejected with the lifecycle error contract'
);
select throws_ok(
  $$select pg_temp.cat02_stage(
    (select value_uuid from cat02_test_state where state_key = 'invalid_product_batch'),
    'cat02.stage-invalid.product-future-modified',
    pg_catalog.jsonb_build_array(
      pg_temp.cat02_product('990000000004') ||
        pg_catalog.jsonb_build_object('sourceRecordModifiedDate', (current_date + 1)::text)
    )
  )$$,
  '22023', 'CATALOG_IMPORT_PRODUCT_RECORD_INVALID',
  'product modified date cannot postdate the source snapshot'
);
select throws_ok(
  $$select pg_temp.cat02_stage(
    (select value_uuid from cat02_test_state where state_key = 'invalid_product_batch'),
    'cat02.stage-invalid.product-null-review',
    pg_catalog.jsonb_build_array(
      pg_temp.cat02_product('990000000004') || pg_catalog.jsonb_build_object('reviewStatus', null)
    )
  )$$,
  '22023', 'CATALOG_IMPORT_PRODUCT_RECORD_INVALID',
  'JSON null cannot bypass required product review status validation'
);
select throws_ok(
  $$select pg_temp.cat02_stage(
    (select value_uuid from cat02_test_state where state_key = 'invalid_product_batch'),
    'cat02.stage-invalid.product-null-quality',
    pg_catalog.jsonb_build_array(
      pg_temp.cat02_product('990000000004') || pg_catalog.jsonb_build_object('qualityGrade', null)
    )
  )$$,
  '22023', 'CATALOG_IMPORT_PRODUCT_RECORD_INVALID',
  'JSON null cannot bypass required product quality grade validation'
);
select throws_ok(
  $$select pg_temp.cat02_stage(
    (select value_uuid from cat02_test_state where state_key = 'invalid_product_batch'),
    'cat02.stage-invalid.bytes',
    pg_catalog.jsonb_build_array(
      pg_temp.cat02_product('990000000004', repeat('n', 8388609))
    )
  )$$,
  '22023', 'CATALOG_IMPORT_CHUNK_INPUT_INVALID',
  'an over-8-MiB chunk is rejected before record processing'
);
select is(
  (select count(*) from private.catalog_import_staged_records
   where batch_id = (select value_uuid from cat02_test_state where state_key = 'invalid_product_batch')),
  0::bigint,
  'invalid product chunks leave no staged-row residue'
);
select lives_ok(
  $$select pg_temp.cat02_stage(
    (select value_uuid from cat02_test_state where state_key = 'invalid_product_batch'),
    'cat02.stage-valid.ingredients-20000',
    pg_catalog.jsonb_build_array(
      pg_temp.cat02_product(
        '990000000004', pg_catalog.repeat(U&'\+01F600', 100),
        'CAT-02 Brand', 'moisturiser_tube',
        pg_catalog.repeat('i', 20000)
      )
    )
  )$$,
  'OBF ingredientsText accepts 20,000 characters while product name accepts exactly 200 UTF-16 units'
);

with receipt as (
  select pg_temp.cat02_begin_receipt('cat02.stage-invalid.ingredient', 'cosing') as value
)
insert into cat02_test_state (state_key, value_uuid, value_json)
select 'invalid_ingredient_batch', (value ->> 'batch_id')::uuid, value from receipt;

select throws_ok(
  $$select pg_temp.cat02_stage(
    (select value_uuid from cat02_test_state where state_key = 'invalid_ingredient_batch'),
    'cat02.stage-invalid.display',
    pg_catalog.jsonb_build_array(
      pg_temp.cat02_ingredient('Bounded INCI', 'COSING:BOUND', null, null, null, '[]', repeat('d', 301))
    )
  )$$,
  '22023', 'CATALOG_IMPORT_INGREDIENT_RECORD_INVALID',
  'an oversized ingredient display name rejects the chunk'
);
select throws_ok(
  $$select pg_temp.cat02_stage(
    (select value_uuid from cat02_test_state where state_key = 'invalid_ingredient_batch'),
    'cat02.stage-invalid.synonym',
    pg_catalog.jsonb_build_array(
      pg_temp.cat02_ingredient(
        'Bounded INCI', 'COSING:BOUND', null, null, null,
        pg_catalog.jsonb_build_array(repeat('s', 301))
      )
    )
  )$$,
  '22023', 'CATALOG_IMPORT_INGREDIENT_SYNONYMS_INVALID',
  'an oversized individual synonym rejects the chunk'
);
select throws_ok(
  $$select pg_temp.cat02_stage(
    (select value_uuid from cat02_test_state where state_key = 'invalid_ingredient_batch'),
    'cat02.stage-invalid.synonym-ecmascript-trim',
    pg_catalog.jsonb_build_array(
      pg_temp.cat02_ingredient(
        'Bounded INCI', 'COSING:BOUND', null, null, null,
        pg_catalog.jsonb_build_array(U&'Bounded Alias\FEFF')
      )
    )
  )$$,
  '22023', 'CATALOG_IMPORT_INGREDIENT_SYNONYMS_INVALID',
  'direct staging rejects synonym edge whitespace instead of normalizing signed identity bytes'
);
select throws_ok(
  $$select pg_temp.cat02_stage(
    (select value_uuid from cat02_test_state where state_key = 'invalid_ingredient_batch'),
    'cat02.stage-invalid.ingredient-null-url',
    pg_catalog.jsonb_build_array(
      pg_temp.cat02_ingredient('Bounded INCI', 'COSING:BOUND') ||
        pg_catalog.jsonb_build_object('sourceUrl', null)
    )
  )$$,
  '22023', 'CATALOG_IMPORT_INGREDIENT_RECORD_INVALID',
  'JSON null cannot bypass required ingredient sourceUrl validation'
);
select throws_ok(
  $$select pg_temp.cat02_stage(
    (select value_uuid from cat02_test_state where state_key = 'invalid_ingredient_batch'),
    'cat02.stage-invalid.ingredient-null-review',
    pg_catalog.jsonb_build_array(
      pg_temp.cat02_ingredient('Bounded INCI', 'COSING:BOUND') ||
        pg_catalog.jsonb_build_object('reviewStatus', null)
    )
  )$$,
  '22023', 'CATALOG_IMPORT_INGREDIENT_RECORD_INVALID',
  'JSON null cannot bypass required ingredient review status validation'
);
select throws_ok(
  $$select pg_temp.cat02_stage(
    (select value_uuid from cat02_test_state where state_key = 'invalid_ingredient_batch'),
    'cat02.stage-invalid.ingredient-number-synonym',
    pg_catalog.jsonb_build_array(
      pg_temp.cat02_ingredient('Bounded INCI', 'COSING:BOUND', null, null, null, '[7]'::jsonb)
    )
  )$$,
  '22023', 'CATALOG_IMPORT_INGREDIENT_RECORD_INVALID',
  'non-string synonym JSON cannot be coerced into an identity'
);
select is(
  (select count(*) from private.catalog_import_staged_records
   where batch_id = (select value_uuid from cat02_test_state where state_key = 'invalid_ingredient_batch')),
  0::bigint,
  'invalid ingredient chunks leave no staged-row residue'
);

-- Same candidates with different begin provenance must not be review-swappable.
with receipt as (
  select pg_temp.cat02_begin_receipt(
    'cat02.provenance.good', 'open_beauty_facts', 1, 'production', 'US', 0, 0,
    'https://static.openbeautyfacts.org/data/approved.jsonl'
  ) as value
)
insert into cat02_test_state (state_key, value_uuid, value_json)
select 'provenance_good', (value ->> 'batch_id')::uuid, value from receipt;

with receipt as (
  select pg_temp.cat02_begin_receipt(
    'cat02.provenance.bad', 'open_beauty_facts', 1, 'production', 'US', 0, 0,
    'https://attacker.invalid/swapped.jsonl'
  ) as value
)
insert into cat02_test_state (state_key, value_uuid, value_json)
select 'provenance_bad', (value ->> 'batch_id')::uuid, value from receipt;

select lives_ok(
  $$select pg_temp.cat02_stage(
    (select value_uuid from cat02_test_state where state_key = 'provenance_good'),
    'cat02.provenance.good.chunk',
    pg_catalog.jsonb_build_array(pg_temp.cat02_product('990000000011', 'Provenance Product'))
  )$$,
  'approved-provenance candidate stages'
);
select lives_ok(
  $$select pg_temp.cat02_stage(
    (select value_uuid from cat02_test_state where state_key = 'provenance_bad'),
    'cat02.provenance.bad.chunk',
    pg_catalog.jsonb_build_array(pg_temp.cat02_product('990000000011', 'Provenance Product'))
  )$$,
  'same candidate bytes can stage under a separately declared batch before owner review'
);
select lives_ok(
  $$select pg_temp.cat02_finalize(
    (select value_uuid from cat02_test_state where state_key = 'provenance_good'),
    'cat02.provenance.good.finalize'
  )$$,
  'approved-provenance batch finalizes'
);
select lives_ok(
  $$select pg_temp.cat02_finalize(
    (select value_uuid from cat02_test_state where state_key = 'provenance_bad'),
    'cat02.provenance.bad.finalize'
  )$$,
  'swapped-provenance batch finalizes for fail-closed owner detection'
);
select is(
  (select batches.candidates_sha256 from public.catalog_import_batches as batches
   where batches.id = (select value_uuid from cat02_test_state where state_key = 'provenance_good')),
  (select batches.candidates_sha256 from public.catalog_import_batches as batches
   where batches.id = (select value_uuid from cat02_test_state where state_key = 'provenance_bad')),
  'candidate digest is intentionally identical for identical ordered source bytes'
);
select isnt(
  private.catalog_import_batch_evidence_sha256(
    (select value_uuid from cat02_test_state where state_key = 'provenance_good')
  ),
  private.catalog_import_batch_evidence_sha256(
    (select value_uuid from cat02_test_state where state_key = 'provenance_bad')
  ),
  'compact batch evidence digest changes when artifact provenance changes'
);
select lives_ok(
  $$select pg_temp.cat02_verify(
    (select value_uuid from cat02_test_state where state_key = 'provenance_good'),
    'cat02.provenance.good.verify'
  )$$,
  'approved-provenance batch verifies'
);
select lives_ok(
  $$select pg_temp.cat02_verify(
    (select value_uuid from cat02_test_state where state_key = 'provenance_bad'),
    'cat02.provenance.bad.verify'
  )$$,
  'swapped-provenance batch reaches owner gate without elevation'
);
select throws_ok(
  $$select pg_temp.cat02_review(
    (select value_uuid from cat02_test_state where state_key = 'provenance_bad'),
    'cat02.provenance.bad.review',
    'accepted',
    private.catalog_import_batch_evidence_sha256(
      (select value_uuid from cat02_test_state where state_key = 'provenance_good')
    )
  )$$,
  '55000', 'CATALOG_IMPORT_REVIEW_GATE_CLOSED',
  'owner review rejects same candidates bound to different begin provenance'
);
select is(
  (select count(*) from private.catalog_import_review_events
   where batch_id = (select value_uuid from cat02_test_state where state_key = 'provenance_bad')),
  0::bigint,
  'failed provenance swap leaves no review-event residue'
);

-- Verification evidence supplied by the service is independently owner-bound.
with receipt as (
  select pg_temp.cat02_begin_receipt('cat02.verify-fake.begin', 'open_beauty_facts') as value
)
insert into cat02_test_state (state_key, value_uuid, value_json)
select 'verify_fake', (value ->> 'batch_id')::uuid, value from receipt;
select lives_ok(
  $$select pg_temp.cat02_stage(
    (select value_uuid from cat02_test_state where state_key = 'verify_fake'),
    'cat02.verify-fake.chunk',
    pg_catalog.jsonb_build_array(pg_temp.cat02_product('990000000011', 'Verification Evidence Product'))
  )$$,
  'verification-evidence adversarial batch stages'
);
select lives_ok(
  $$select pg_temp.cat02_finalize(
    (select value_uuid from cat02_test_state where state_key = 'verify_fake'),
    'cat02.verify-fake.finalize'
  )$$,
  'verification-evidence adversarial batch finalizes'
);
select lives_ok(
  $$select * from public.verify_catalog_import(
    (select value_uuid from cat02_test_state where state_key = 'verify_fake'),
    'cat02.verify-fake.verify',
    (select records_sha256 from public.catalog_import_batches
     where id = (select value_uuid from cat02_test_state where state_key = 'verify_fake')),
    repeat('7', 64)
  )$$,
  'service can seal a syntactically valid evidence hash but cannot authorize review'
);
select throws_ok(
  $$select pg_temp.cat02_review(
    (select value_uuid from cat02_test_state where state_key = 'verify_fake'),
    'cat02.verify-fake.review', 'accepted', null,
    array['reviewer.alpha','reviewer.beta'], repeat('9', 64)
  )$$,
  '55000', 'CATALOG_IMPORT_REVIEW_GATE_CLOSED',
  'owner review rejects a service verification hash that differs from deterministic evidence'
);
select lives_ok(
  $$select pg_temp.cat02_review(
    (select value_uuid from cat02_test_state where state_key = 'verify_fake'),
    'cat02.verify-fake.review', 'accepted', null,
    array['reviewer.alpha','reviewer.beta'], repeat('7', 64)
  )$$,
  'owner review succeeds only with the exact expected verification-evidence hash'
);
select throws_ok(
  $$select pg_temp.cat02_review(
    (select value_uuid from cat02_test_state where state_key = 'verify_fake'),
    'cat02.verify-fake.review', 'accepted', null,
    array['reviewer.alpha','reviewer.beta'], repeat('6', 64)
  )$$,
  '22023', 'CATALOG_IMPORT_REVIEW_REPLAY_CHANGED',
  'changed verification evidence is rejected on review replay'
);

-- Main product lifecycle: exact replay, conservative promotion, serving hold,
-- user-FK preservation, retirement, and corrected natural-key reuse.
with receipt as (
  select pg_temp.cat02_begin_receipt('cat02.product.begin', 'open_beauty_facts') as value
)
insert into cat02_test_state (state_key, value_uuid, value_json)
select 'product_batch', (value ->> 'batch_id')::uuid, value from receipt;

select is(
  (pg_temp.cat02_begin_receipt('cat02.product.begin', 'open_beauty_facts') ->> 'replayed')::boolean,
  true,
  'exact begin replay is a stable no-op'
);
select throws_ok(
  $$select pg_temp.cat02_begin_receipt('cat02.product.begin', 'open_beauty_facts', 2)$$,
  '22023', 'CATALOG_IMPORT_OPERATION_REPLAY_CHANGED',
  'changed begin replay is rejected'
);

insert into cat02_test_state (state_key, value_json)
select 'product_stage', pg_temp.cat02_stage(
  (select value_uuid from cat02_test_state where state_key = 'product_batch'),
  'cat02.product.chunk',
  pg_catalog.jsonb_build_array(pg_temp.cat02_product('991234567899', 'CAT-02 Lifecycle Cream'))
);

select is(
  pg_catalog.jsonb_build_object(
    'keys', (select pg_catalog.array_agg(keys.key order by keys.key)
      from pg_catalog.jsonb_object_keys(
        (select value_json -> 'record_receipts' -> 0
         from cat02_test_state where state_key = 'product_stage')
      ) as keys(key)),
    'canonicalRecordHashMatches', (
      select receipt ->> 'recordSha256' = private.catalog_import_sha256_text(
        private.catalog_import_canonical_json(receipt -> 'normalizedPayload')
      )
      from (
        select value_json -> 'record_receipts' -> 0 as receipt
        from cat02_test_state where state_key = 'product_stage'
      ) as staged
    )
  ),
  pg_catalog.jsonb_build_object(
    'keys', array[
      'canonicalKey','disposition','normalizedPayload','recordKind',
      'recordOrdinal','recordSha256','sourcePayload'
    ]::text[],
    'canonicalRecordHashMatches', true
  ),
  'stage returns the exact expanded receipt and canonical normalized-record hash'
);
select is(
  pg_temp.cat02_stage(
    (select value_uuid from cat02_test_state where state_key = 'product_batch'),
    'cat02.product.chunk',
    pg_catalog.jsonb_build_array(pg_temp.cat02_product('991234567899', 'CAT-02 Lifecycle Cream'))
  ) - 'replayed',
  (select value_json - 'replayed' from cat02_test_state where state_key = 'product_stage'),
  'stage replay preserves the original database byte bindings'
);
select throws_ok(
  $$select pg_temp.cat02_stage(
    (select value_uuid from cat02_test_state where state_key = 'product_batch'),
    'cat02.product.chunk',
    pg_catalog.jsonb_build_array(pg_temp.cat02_product('991234567899', 'Changed Replay Product'))
  )$$,
  '22023', 'CATALOG_IMPORT_CHUNK_REPLAY_CHANGED',
  'changed stage replay is rejected'
);

insert into cat02_test_state (state_key, value_json)
select 'product_finalize', pg_temp.cat02_finalize(
  (select value_uuid from cat02_test_state where state_key = 'product_batch'),
  'cat02.product.finalize'
);
select is(
  (select value_json ->> 'batch_status' from cat02_test_state where state_key = 'product_finalize'),
  'finalized'::text,
  'conflict-free product batch finalizes'
);
select is(
  (select pg_catalog.array_agg(keys.key order by keys.key)
   from pg_catalog.jsonb_object_keys(
     (select value_json -> 'record_receipts' -> 0 from cat02_test_state where state_key = 'product_finalize')
   ) as keys(key)),
  array['canonicalKey','disposition','recordKind','recordOrdinal','recordSha256']::text[],
  'finalize returns only the exact minimal five-field record receipt'
);
select is(
  (select value_json ->> 'candidates_sha256' from cat02_test_state where state_key = 'product_finalize'),
  private.catalog_import_sha256_text(
    private.catalog_import_sha256_text(
      private.catalog_import_canonical_json(pg_temp.cat02_product('991234567899', 'CAT-02 Lifecycle Cream'))
    )
  ),
  'single-record candidates digest is the ordered fixed-width leaf chain'
);
select is(
  pg_temp.cat02_finalize(
    (select value_uuid from cat02_test_state where state_key = 'product_batch'),
    'cat02.product.finalize'
  ) - 'replayed',
  (select value_json - 'replayed' from cat02_test_state where state_key = 'product_finalize'),
  'finalize replay is byte-stable before later lifecycle transitions'
);

select throws_ok(
  $$select * from public.verify_catalog_import(
    (select value_uuid from cat02_test_state where state_key = 'product_batch'),
    'cat02.product.verify-wrong', repeat('1',64), repeat('9',64)
  )$$,
  '55000', 'CATALOG_IMPORT_VERIFY_GATE_CLOSED',
  'verification rejects a changed records digest'
);
select lives_ok(
  $$select pg_temp.cat02_verify(
    (select value_uuid from cat02_test_state where state_key = 'product_batch'),
    'cat02.product.verify'
  )$$,
  'exact database receipt evidence verifies the product batch'
);

select throws_ok(
  $$select * from public.review_catalog_import(
    (select value_uuid from cat02_test_state where state_key = 'product_batch'),
    'cat02.product.review-wrong-candidate',
    pg_temp.cat02_decisions((select value_uuid from cat02_test_state where state_key = 'product_batch')),
    repeat('1',64),
    private.catalog_import_batch_evidence_sha256(
      (select value_uuid from cat02_test_state where state_key = 'product_batch')
    ),
    repeat('9',64), array['reviewer.alpha','reviewer.beta'],
    'CAT02-REVIEW-2026-07-17', repeat('8',64)
  )$$,
  '55000', 'CATALOG_IMPORT_REVIEW_GATE_CLOSED',
  'owner review rejects a changed ordered-candidate digest'
);
select throws_ok(
  $$select * from public.review_catalog_import(
    (select value_uuid from cat02_test_state where state_key = 'product_batch'),
    'cat02.product.review-wrong-record',
    pg_catalog.jsonb_set(
      pg_temp.cat02_decisions((select value_uuid from cat02_test_state where state_key = 'product_batch')),
      '{0,recordSha256}', pg_catalog.to_jsonb(repeat('2',64))
    ),
    (select candidates_sha256 from public.catalog_import_batches where id =
      (select value_uuid from cat02_test_state where state_key = 'product_batch')),
    private.catalog_import_batch_evidence_sha256(
      (select value_uuid from cat02_test_state where state_key = 'product_batch')
    ),
    repeat('9',64), array['reviewer.alpha','reviewer.beta'],
    'CAT02-REVIEW-2026-07-17', repeat('8',64)
  )$$,
  '22023', 'CATALOG_IMPORT_REVIEW_DECISIONS_INCOMPLETE',
  'owner review rejects a decision bound to the wrong record hash'
);
select throws_ok(
  $$select * from public.review_catalog_import(
    (select value_uuid from cat02_test_state where state_key = 'product_batch'),
    'cat02.product.review-coerced-ordinal',
    pg_catalog.jsonb_set(
      pg_temp.cat02_decisions((select value_uuid from cat02_test_state where state_key = 'product_batch')),
      '{0,recordOrdinal}', pg_catalog.to_jsonb('1'::text)
    ),
    (select candidates_sha256 from public.catalog_import_batches where id =
      (select value_uuid from cat02_test_state where state_key = 'product_batch')),
    private.catalog_import_batch_evidence_sha256(
      (select value_uuid from cat02_test_state where state_key = 'product_batch')
    ),
    repeat('9',64), array['reviewer.alpha','reviewer.beta'],
    'CAT02-REVIEW-2026-07-17', repeat('8',64)
  )$$,
  '22023', 'CATALOG_IMPORT_REVIEW_DECISIONS_INCOMPLETE',
  'owner review rejects a string recordOrdinal instead of coercing it to integer evidence'
);
select throws_ok(
  $$select pg_temp.cat02_review(
    (select value_uuid from cat02_test_state where state_key = 'product_batch'),
    'cat02.product.review-wrong-evidence', 'accepted', repeat('3',64)
  )$$,
  '55000', 'CATALOG_IMPORT_REVIEW_GATE_CLOSED',
  'owner review rejects the wrong compact begin-evidence digest'
);
select throws_ok(
  $$select pg_temp.cat02_review(
    (select value_uuid from cat02_test_state where state_key = 'product_batch'),
    'cat02.product.review-duplicate-reviewers', 'accepted', null,
    array['reviewer.alpha','reviewer.alpha']
  )$$,
  '22023', 'CATALOG_IMPORT_REVIEW_INPUT_INVALID',
  'owner review requires two distinct signed reviewer aliases'
);
select throws_ok(
  $$select pg_temp.cat02_review(
    (select value_uuid from cat02_test_state where state_key = 'product_batch'),
    'cat02.product.review-uppercase-reviewer', 'accepted', null,
    array['Reviewer.alpha','reviewer.beta']
  )$$,
  '22023', 'CATALOG_IMPORT_REVIEW_INPUT_INVALID',
  'owner review rejects uppercase reviewer IDs outside the signed overlay grammar'
);
select throws_ok(
  $$select pg_temp.cat02_review(
    (select value_uuid from cat02_test_state where state_key = 'product_batch'),
    'cat02.product.review-at-reviewer', 'accepted', null,
    array['reviewer@alpha','reviewer.beta']
  )$$,
  '22023', 'CATALOG_IMPORT_REVIEW_INPUT_INVALID',
  'owner review rejects at-sign reviewer IDs outside the signed overlay grammar'
);
select throws_ok(
  $$select pg_temp.cat02_review(
    (select value_uuid from cat02_test_state where state_key = 'product_batch'),
    'cat02.product.review-slash-reviewer', 'accepted', null,
    array['reviewer/alpha','reviewer.beta']
  )$$,
  '22023', 'CATALOG_IMPORT_REVIEW_INPUT_INVALID',
  'owner review rejects slash reviewer IDs outside the signed overlay grammar'
);
select throws_ok(
  $$select pg_temp.cat02_review(
    (select value_uuid from cat02_test_state where state_key = 'product_batch'),
    'cat02.product.review-overlength-reviewer', 'accepted', null,
    array[repeat('a',129),'reviewer.beta']
  )$$,
  '22023', 'CATALOG_IMPORT_REVIEW_INPUT_INVALID',
  'owner review rejects reviewer IDs longer than the signed 128-character bound'
);
select throws_ok(
  $$select pg_temp.cat02_review(
    (select value_uuid from cat02_test_state where state_key = 'product_batch'),
    'cat02.product.review-combined-reviewers', 'accepted', null,
    array['a' || repeat('x',99),'b' || repeat('y',99)]
  )$$,
  '22023', 'CATALOG_IMPORT_REVIEW_INPUT_INVALID',
  'owner review rejects a combined reviewedBy identity longer than 200 characters'
);

insert into cat02_test_state (state_key, value_json)
select 'product_review', pg_temp.cat02_review(
  (select value_uuid from cat02_test_state where state_key = 'product_batch'),
  'cat02.product.review'
);
select is(
  (select reviewer_ids from public.catalog_import_batches
   where id = (select value_uuid from cat02_test_state where state_key = 'product_batch')),
  array['reviewer.alpha','reviewer.beta']::text[],
  'review stores the exact two-person reviewer set'
);

update public.catalog_sources set production_approved = false where source_key = 'open_beauty_facts';
select throws_ok(
  $$select pg_temp.cat02_promote(
    (select value_uuid from cat02_test_state where state_key = 'product_batch'),
    'cat02.product.promote-withdrawn'
  )$$,
  '55000', 'CATALOG_IMPORT_PROMOTION_GATE_CLOSED',
  'source withdrawal after review closes promotion'
);
select ok(
  not exists (
    select 1 from private.catalog_import_promotion_events
    where batch_id = (select value_uuid from cat02_test_state where state_key = 'product_batch')
  ) and not exists (
    select 1 from public.products
    where import_batch_id = (select value_uuid from cat02_test_state where state_key = 'product_batch')
  ),
  'withdrawn-source promotion failure leaves no audit or projection residue'
);
update public.catalog_sources set production_approved = true where source_key = 'open_beauty_facts';

select throws_ok(
  $$select pg_temp.cat02_promote(
    (select value_uuid from cat02_test_state where state_key = 'product_batch'),
    'cat02.product.promote-reviewer-a', 'reviewer.alpha'
  )$$,
  '55000', 'CATALOG_IMPORT_PROMOTION_GATE_CLOSED',
  'first reviewer cannot promote their own review'
);
select throws_ok(
  $$select pg_temp.cat02_promote(
    (select value_uuid from cat02_test_state where state_key = 'product_batch'),
    'cat02.product.promote-reviewer-b', 'reviewer.beta'
  )$$,
  '55000', 'CATALOG_IMPORT_PROMOTION_GATE_CLOSED',
  'second reviewer cannot promote their own review'
);
select throws_ok(
  $$select pg_temp.cat02_promote(
    (select value_uuid from cat02_test_state where state_key = 'product_batch'),
    'cat02.product.promote-reviewer-case', 'Reviewer.Alpha'
  )$$,
  '55000', 'CATALOG_IMPORT_PROMOTION_GATE_CLOSED',
  'case variants cannot bypass reviewer/operator separation'
);

insert into cat02_test_state (state_key, value_json)
select 'product_promote', pg_temp.cat02_promote(
  (select value_uuid from cat02_test_state where state_key = 'product_batch'),
  'cat02.product.promote', 'operator.gamma'
);
insert into cat02_test_state (state_key, value_uuid)
select 'product_id', products.id
from public.products as products
where products.import_batch_id = (select value_uuid from cat02_test_state where state_key = 'product_batch');

select ok(
  exists (
    select 1 from public.products as products
    where products.id = (select value_uuid from cat02_test_state where state_key = 'product_id')
      and products.review_status = 'needs_review'
      and products.quality_grade = 'unverified'
      and products.recommendation_eligible is false
      and products.import_projection_status = 'active'
  ) and exists (
    select 1 from public.product_barcodes as mappings
    where mappings.import_batch_id = (select value_uuid from cat02_test_state where state_key = 'product_batch')
      and mappings.review_status = 'needs_review'
  ) and exists (
    select 1 from public.product_ingredient_lists as lists
    where lists.import_batch_id = (select value_uuid from cat02_test_state where state_key = 'product_batch')
      and lists.review_status = 'needs_review'
  ),
  'promotion creates complete lineage but no review or recommendation elevation'
);

set local role authenticated;
select is(
  (select count(*) from public.products where id =
    (select value_uuid from cat02_test_state where state_key = 'product_id')),
  0::bigint,
  'newly promoted needs-review product is not directly servable'
);
reset role;

select is(
  (pg_temp.cat02_begin_receipt('cat02.product.begin', 'open_beauty_facts') ->> 'batch_status'),
  'running'::text,
  'begin replay returns its stable initial status after promotion'
);
select is(
  (pg_temp.cat02_finalize(
    (select value_uuid from cat02_test_state where state_key = 'product_batch'),
    'cat02.product.finalize'
  ) ->> 'batch_status'),
  'finalized'::text,
  'finalize replay returns its stable initial status after promotion'
);
select is(
  (pg_temp.cat02_verify(
    (select value_uuid from cat02_test_state where state_key = 'product_batch'),
    'cat02.product.verify'
  ) ->> 'batch_status'),
  'verified'::text,
  'verify replay returns its stable initial status after promotion'
);
select is(
  (pg_temp.cat02_review(
    (select value_uuid from cat02_test_state where state_key = 'product_batch'),
    'cat02.product.review'
  ) ->> 'batch_status'),
  'reviewed'::text,
  'review replay returns its stable initial status after promotion'
);
select is(
  (pg_temp.cat02_promote(
    (select value_uuid from cat02_test_state where state_key = 'product_batch'),
    'cat02.product.promote', 'operator.gamma'
  ) ->> 'replayed')::boolean,
  true,
  'promotion exact replay is an immutable no-op'
);

insert into auth.users (id) values ('57000000-0000-4000-8000-000000000001');
-- This fixture proves rollback preserves a pre-existing shelf reference; the
-- health-consent admission trigger is independently covered by its lifecycle
-- suite and is not the behavior under test here.
insert into cat02_test_state (state_key, value_uuid)
values ('shelf_product_id', pg_catalog.gen_random_uuid());
alter table public.shelf_product_identities
  disable trigger trg_shelf_product_identities_health_write;
insert into public.shelf_product_identities (id, user_id)
values (
  (select value_uuid from cat02_test_state where state_key = 'shelf_product_id'),
  '57000000-0000-4000-8000-000000000001'
);
alter table public.shelf_product_identities
  enable trigger trg_shelf_product_identities_health_write;
alter table public.user_products disable trigger trg_user_products_health_write;
insert into public.user_products (id, user_id, catalog_product_id, barcode)
values (
  (select value_uuid from cat02_test_state where state_key = 'shelf_product_id'),
  '57000000-0000-4000-8000-000000000001',
  (select value_uuid from cat02_test_state where state_key = 'product_id'),
  '991234567899'
);
alter table public.user_products enable trigger trg_user_products_health_write;

select throws_ok(
  $$update private.catalog_import_review_events
    set reason = 'History rewrite attempt.'
    where batch_id = (select value_uuid from cat02_test_state where state_key = 'product_batch')$$,
  '55000', 'CATALOG_IMPORT_LEDGER_IMMUTABLE',
  'review evidence cannot be updated'
);
select throws_ok(
  $$delete from private.catalog_import_promotion_events
    where batch_id = (select value_uuid from cat02_test_state where state_key = 'product_batch')$$,
  '55000', 'CATALOG_IMPORT_LEDGER_IMMUTABLE',
  'promotion evidence cannot be deleted'
);
select throws_ok(
  $$update private.catalog_import_staged_records
    set source_payload = source_payload || '{"tampered":"yes"}'::jsonb
    where batch_id = (select value_uuid from cat02_test_state where state_key = 'product_batch')$$,
  '55000', 'CATALOG_IMPORT_STAGED_RECORD_IMMUTABLE',
  'sealed staged source bytes cannot be changed'
);

-- CAT-02 review elevation alone cannot bypass the independent CAT-03 launch
-- curation head. Source withdrawal remains fail closed across every read lane.
update public.products
set review_status = 'reviewed', quality_grade = 'verified',
    recommendation_eligible = false, last_reviewed_at = pg_catalog.now()
where id = (select value_uuid from cat02_test_state where state_key = 'product_id');
update public.product_barcodes
set review_status = 'reviewed'
where import_batch_id = (select value_uuid from cat02_test_state where state_key = 'product_batch');
update public.product_ingredient_lists
set review_status = 'reviewed'
where import_batch_id = (select value_uuid from cat02_test_state where state_key = 'product_batch');

set local role authenticated;
select is(
  (select count(*) from public.products where id =
    (select value_uuid from cat02_test_state where state_key = 'product_id')),
  0::bigint,
  'review elevation alone cannot serve a product without an active CAT-03 head'
);
reset role;

update public.catalog_sources set production_approved = false where source_key = 'open_beauty_facts';
set local role authenticated;
select is(
  (select count(*) from public.products where id =
    (select value_uuid from cat02_test_state where state_key = 'product_id')),
  0::bigint,
  'source withdrawal keeps a CAT-03-uncurated product hidden from direct reads'
);
reset role;
set local role service_role;
select is(
  (select count(*) from public.lookup_catalog_product_by_barcode('991234567899')),
  0::bigint,
  'source withdrawal hides a previously curated product from exact lookup'
);
select is(
  (select count(*) from public.search_catalog_products('Lifecycle Cream', 10)),
  0::bigint,
  'source withdrawal hides a previously curated product from search'
);
reset role;
update public.catalog_sources set production_approved = true where source_key = 'open_beauty_facts';

select throws_ok(
  $$select pg_temp.cat02_rollback(
    (select value_uuid from cat02_test_state where state_key = 'product_batch'),
    'cat02.product.rollback-reviewer-a', 'reviewer.alpha'
  )$$,
  '55000', 'CATALOG_IMPORT_ROLLBACK_GATE_CLOSED',
  'first reviewer cannot roll back their own reviewed batch'
);
select throws_ok(
  $$select pg_temp.cat02_rollback(
    (select value_uuid from cat02_test_state where state_key = 'product_batch'),
    'cat02.product.rollback-reviewer-b', 'reviewer.beta'
  )$$,
  '55000', 'CATALOG_IMPORT_ROLLBACK_GATE_CLOSED',
  'second reviewer cannot roll back their own reviewed batch'
);
select throws_ok(
  $$select pg_temp.cat02_rollback(
    (select value_uuid from cat02_test_state where state_key = 'product_batch'),
    'cat02.product.rollback-reviewer-case', 'Reviewer.Beta'
  )$$,
  '55000', 'CATALOG_IMPORT_ROLLBACK_GATE_CLOSED',
  'case variants cannot bypass rollback separation'
);
select throws_ok(
  $$select pg_temp.cat02_rollback(
    (select value_uuid from cat02_test_state where state_key = 'product_batch'),
    'cat02.product.rollback-ticket', 'operator.delta', 'WRONG-TICKET'
  )$$,
  '55000', 'CATALOG_IMPORT_ROLLBACK_GATE_CLOSED',
  'rollback must bind the exact review ticket'
);
select throws_ok(
  $$select pg_temp.cat02_rollback(
    (select value_uuid from cat02_test_state where state_key = 'product_batch'),
    'cat02.product.rollback-evidence', 'operator.delta',
    'CAT02-REVIEW-2026-07-17', repeat('1',64)
  )$$,
  '55000', 'CATALOG_IMPORT_ROLLBACK_GATE_CLOSED',
  'rollback must bind the exact review evidence'
);

insert into cat02_test_state (state_key, value_json)
select 'product_rollback', pg_temp.cat02_rollback(
  (select value_uuid from cat02_test_state where state_key = 'product_batch'),
  'cat02.product.rollback', 'operator.delta'
);
select is(
  (pg_temp.cat02_rollback(
    (select value_uuid from cat02_test_state where state_key = 'product_batch'),
    'cat02.product.rollback', 'operator.delta'
  ) ->> 'replayed')::boolean,
  true,
  'rollback exact replay is an immutable no-op before gate re-evaluation'
);
select ok(
  (pg_temp.cat02_begin_receipt('cat02.product.begin', 'open_beauty_facts') ->> 'replayed')::boolean
  and pg_temp.cat02_begin_receipt('cat02.product.begin', 'open_beauty_facts') - 'replayed'
    = (select value_json - 'replayed' from cat02_test_state where state_key = 'product_batch'),
  'begin replay after retirement exactly preserves its immutable original begin receipt, not current status'
);
select is(
  pg_temp.cat02_stage(
    (select value_uuid from cat02_test_state where state_key = 'product_batch'),
    'cat02.product.chunk',
    pg_catalog.jsonb_build_array(pg_temp.cat02_product('991234567899', 'CAT-02 Lifecycle Cream'))
  ) - 'replayed',
  (select value_json - 'replayed' from cat02_test_state where state_key = 'product_stage'),
  'stage retry after retirement exactly reproduces its immutable original receipt'
);
select is(
  pg_temp.cat02_finalize(
    (select value_uuid from cat02_test_state where state_key = 'product_batch'),
    'cat02.product.finalize'
  ) - 'replayed',
  (select value_json - 'replayed' from cat02_test_state where state_key = 'product_finalize'),
  'finalize retry after retirement exactly reproduces its immutable original receipt'
);
select ok(
  (pg_temp.cat02_verify(
    (select value_uuid from cat02_test_state where state_key = 'product_batch'),
    'cat02.product.verify'
  ) ->> 'replayed')::boolean
  and (pg_temp.cat02_verify(
    (select value_uuid from cat02_test_state where state_key = 'product_batch'),
    'cat02.product.verify'
  ) ->> 'batch_status') = 'verified',
  'verify retry after retirement preserves the immutable verified receipt'
);
select is(
  pg_temp.cat02_review(
    (select value_uuid from cat02_test_state where state_key = 'product_batch'),
    'cat02.product.review'
  ) - 'replayed',
  (select value_json - 'replayed' from cat02_test_state where state_key = 'product_review'),
  'review retry after retirement exactly reproduces its immutable original receipt'
);

select ok(
  exists (
    select 1 from public.products as products
    where products.id = (select value_uuid from cat02_test_state where state_key = 'product_id')
      and products.import_batch_id = (select value_uuid from cat02_test_state where state_key = 'product_batch')
      and products.status = 'blocked'
      and products.import_projection_status = 'retired'
      and products.barcode is null
      and products.source_ref = 'retired:' || products.id::text
  ) and exists (
    select 1 from public.user_products as shelf
    where shelf.user_id = '57000000-0000-4000-8000-000000000001'
      and shelf.catalog_product_id = (select value_uuid from cat02_test_state where state_key = 'product_id')
  ),
  'rollback preserves catalog/user IDs and FKs while retiring natural keys'
);
select ok(
  (select count(*) from private.catalog_import_entity_revisions
   where batch_id = (select value_uuid from cat02_test_state where state_key = 'product_batch')
     and revision_action = 'retired') = 3
  and (select count(*) from private.catalog_import_batch_effects
   where batch_id = (select value_uuid from cat02_test_state where state_key = 'product_batch')
     and effect_type = 'retired') = 3,
  'rollback appends retirement revisions/effects for product, barcode, and ingredient list'
);

-- Even a mistaken later curation edit cannot resurrect a retired import batch.
update public.products
set status = 'active', review_status = 'reviewed', quality_grade = 'verified',
    recommendation_eligible = false, last_reviewed_at = pg_catalog.now(),
    barcode = '991234567899', source_ref = '991234567899',
    import_projection_status = 'active', retired_import_natural_key = null
where id = (select value_uuid from cat02_test_state where state_key = 'product_id');
update public.product_barcodes
set barcode = '991234567899', review_status = 'reviewed',
    import_projection_status = 'active', retired_import_natural_key = null
where import_batch_id = (select value_uuid from cat02_test_state where state_key = 'product_batch');

set local role authenticated;
select is(
  (select count(*) from public.products where id =
    (select value_uuid from cat02_test_state where state_key = 'product_id')),
  0::bigint,
  'retired batch status blocks direct product resurrection despite positive mutable fields'
);
reset role;
set local role service_role;
select is(
  (select count(*) from public.lookup_catalog_product_by_barcode('991234567899')),
  0::bigint,
  'retired batch status blocks exact-lookup resurrection'
);
select is(
  (select count(*) from public.search_catalog_products('Lifecycle Cream', 10)),
  0::bigint,
  'retired batch status blocks search resurrection'
);
reset role;

update public.products
set status = 'blocked', review_status = 'blocked', quality_grade = 'blocked',
    recommendation_eligible = false, barcode = null,
    source_ref = 'retired:' || id::text,
    import_projection_status = 'retired', retired_import_natural_key = '991234567899'
where id = (select value_uuid from cat02_test_state where state_key = 'product_id');
update public.product_barcodes
set barcode = 'retired:' || import_entity_id::text, review_status = 'blocked',
    import_projection_status = 'retired', retired_import_natural_key = '991234567899'
where import_batch_id = (select value_uuid from cat02_test_state where state_key = 'product_batch');

with receipt as (
  select pg_temp.cat02_begin_receipt('cat02.product-corrected.begin', 'open_beauty_facts') as value
)
insert into cat02_test_state (state_key, value_uuid, value_json)
select 'product_corrected', (value ->> 'batch_id')::uuid, value from receipt;
select lives_ok(
  $$select pg_temp.cat02_stage(
    (select value_uuid from cat02_test_state where state_key = 'product_corrected'),
    'cat02.product-corrected.chunk',
    pg_catalog.jsonb_build_array(pg_temp.cat02_product('991234567899', 'Corrected Lifecycle Cream'))
  )$$,
  'a later corrected product reuses the retired barcode/sourceRef'
);
select lives_ok(
  $$select pg_temp.cat02_finalize(
    (select value_uuid from cat02_test_state where state_key = 'product_corrected'),
    'cat02.product-corrected.finalize'
  )$$,
  'corrected product batch finalizes without treating retired keys as active conflicts'
);
select is(
  (select conflict_record_count from public.catalog_import_batches
   where id = (select value_uuid from cat02_test_state where state_key = 'product_corrected')),
  0,
  'corrected product has zero active destination conflicts'
);

update public.catalog_import_batches
set artifact_uri = 'https://tampered.invalid/evidence.jsonl'
where id = (select value_uuid from cat02_test_state where state_key = 'product_corrected');
select throws_ok(
  $$select pg_temp.cat02_verify(
    (select value_uuid from cat02_test_state where state_key = 'product_corrected'),
    'cat02.product-corrected.verify-tampered'
  )$$,
  '55000', 'CATALOG_IMPORT_VERIFY_GATE_CLOSED',
  'privileged batch-evidence mutation is detected before verification'
);
update public.catalog_import_batches
set artifact_uri = 'https://static.openbeautyfacts.org/data/open-beauty-facts.jsonl'
where id = (select value_uuid from cat02_test_state where state_key = 'product_corrected');
select lives_ok(
  $$select pg_temp.cat02_verify(
    (select value_uuid from cat02_test_state where state_key = 'product_corrected'),
    'cat02.product-corrected.verify'
  )$$,
  'restored exact evidence verifies the corrected product batch'
);
select lives_ok(
  $$select pg_temp.cat02_review(
    (select value_uuid from cat02_test_state where state_key = 'product_corrected'),
    'cat02.product-corrected.review'
  )$$,
  'corrected product receives complete two-person owner review'
);
select lives_ok(
  $$select pg_temp.cat02_promote(
    (select value_uuid from cat02_test_state where state_key = 'product_corrected'),
    'cat02.product-corrected.promote', 'operator.gamma'
  )$$,
  'corrected product promotes as a new truthful identity while history remains'
);
select isnt(
  (select id from public.products where import_batch_id =
    (select value_uuid from cat02_test_state where state_key = 'product_corrected')),
  (select value_uuid from cat02_test_state where state_key = 'product_id'),
  'corrected product uses a new catalog ID instead of rewriting retired history'
);

-- Out-of-enum CosIng rows remain traceable but can only be explicitly rejected.
with receipt as (
  select pg_temp.cat02_begin_receipt('cat02.annex-reject.begin', 'cosing') as value
)
insert into cat02_test_state (state_key, value_uuid, value_json)
select 'annex_reject', (value ->> 'batch_id')::uuid, value from receipt;
select lives_ok(
  $$select pg_temp.cat02_stage(
    (select value_uuid from cat02_test_state where state_key = 'annex_reject'),
    'cat02.annex-reject.chunk',
    pg_catalog.jsonb_build_array(
      pg_temp.cat02_ingredient('CAT02 Regulatory Unknown', 'CAT02:ANNEX:UNKNOWN', null, null, 'unmapped_future_status')
    )
  )$$,
  'bounded out-of-enum regulatory status is staged for traceable rejection'
);
select lives_ok(
  $$select pg_temp.cat02_finalize(
    (select value_uuid from cat02_test_state where state_key = 'annex_reject'),
    'cat02.annex-reject.finalize'
  )$$,
  'out-of-enum record seals without being silently dropped'
);
select lives_ok(
  $$select pg_temp.cat02_verify(
    (select value_uuid from cat02_test_state where state_key = 'annex_reject'),
    'cat02.annex-reject.verify'
  )$$,
  'out-of-enum record reaches explicit owner decision'
);
select throws_ok(
  $$select pg_temp.cat02_review(
    (select value_uuid from cat02_test_state where state_key = 'annex_reject'),
    'cat02.annex-reject.review-accept'
  )$$,
  '22023', 'CATALOG_IMPORT_REVIEW_DECISIONS_INCOMPLETE',
  'owner review cannot accept an out-of-enum annex status'
);
select lives_ok(
  $$select pg_temp.cat02_review(
    (select value_uuid from cat02_test_state where state_key = 'annex_reject'),
    'cat02.annex-reject.review', 'rejected'
  )$$,
  'owner review can explicitly reject the preserved regulatory row'
);
select ok(
  exists (
    select 1 from private.catalog_import_staged_records
    where batch_id = (select value_uuid from cat02_test_state where state_key = 'annex_reject')
      and disposition = 'rejected'
      and normalized_payload ->> 'annexStatus' = 'unmapped_future_status'
  ) and exists (
    select 1 from private.catalog_import_review_events
    where batch_id = (select value_uuid from cat02_test_state where state_key = 'annex_reject')
      and decision = 'rejected'
  ),
  'rejected regulatory payload and review event remain immutable evidence'
);
select throws_ok(
  $$select pg_temp.cat02_promote(
    (select value_uuid from cat02_test_state where state_key = 'annex_reject'),
    'cat02.annex-reject.promote'
  )$$,
  '55000', 'CATALOG_IMPORT_PROMOTION_GATE_CLOSED',
  'a fully rejected batch cannot promote'
);

-- Valid CosIng lifecycle and conservative ingredient projection.
with receipt as (
  select pg_temp.cat02_begin_receipt('cat02.ingredient.begin', 'cosing') as value
)
insert into cat02_test_state (state_key, value_uuid, value_json)
select 'ingredient_batch', (value ->> 'batch_id')::uuid, value from receipt;
insert into cat02_test_state (state_key, value_json)
select 'ingredient_stage', pg_temp.cat02_stage(
  (select value_uuid from cat02_test_state where state_key = 'ingredient_batch'),
  'cat02.ingredient.chunk',
  pg_catalog.jsonb_build_array(
    pg_temp.cat02_ingredient(
      'CAT02 Alpha Complex', 'CAT02:ALPHA:001', '1234567-89-0', '123-456-7',
      'restricted', '["CAT02 Alpha Alias","CAT02 A-Complex"]'::jsonb
    )
  )
);
select lives_ok(
  $$select pg_temp.cat02_finalize(
    (select value_uuid from cat02_test_state where state_key = 'ingredient_batch'),
    'cat02.ingredient.finalize'
  )$$,
  'valid CosIng batch finalizes'
);
select lives_ok(
  $$select pg_temp.cat02_verify(
    (select value_uuid from cat02_test_state where state_key = 'ingredient_batch'),
    'cat02.ingredient.verify'
  )$$,
  'valid CosIng batch verifies'
);
select lives_ok(
  $$select pg_temp.cat02_review(
    (select value_uuid from cat02_test_state where state_key = 'ingredient_batch'),
    'cat02.ingredient.review'
  )$$,
  'valid CosIng batch receives complete owner review'
);
select lives_ok(
  $$select pg_temp.cat02_promote(
    (select value_uuid from cat02_test_state where state_key = 'ingredient_batch'),
    'cat02.ingredient.promote', 'operator+ingredient'
  )$$,
  'plus-bearing independent operator alias promotes with JS/DB input parity'
);
insert into cat02_test_state (state_key, value_uuid)
select 'ingredient_id', ingredients.id
from public.ingredients as ingredients
where ingredients.import_batch_id = (select value_uuid from cat02_test_state where state_key = 'ingredient_batch');

select ok(
  exists (
    select 1 from public.ingredients as ingredients
    where ingredients.id = (select value_uuid from cat02_test_state where state_key = 'ingredient_id')
      and ingredients.review_status = 'needs_review'
      and ingredients.ingredient_quality_score = 0
      and ingredients.import_projection_status = 'active'
  ) and (select count(*) from public.ingredient_synonyms
    where import_batch_id = (select value_uuid from cat02_test_state where state_key = 'ingredient_batch')
      and review_status = 'needs_review' and import_projection_status = 'active') = 2,
  'ingredient promotion preserves complete lineage without curation elevation'
);
set local role authenticated;
select is(
  (select count(*) from public.ingredients where id =
    (select value_uuid from cat02_test_state where state_key = 'ingredient_id')),
  0::bigint,
  'newly promoted needs-review ingredient is not directly servable'
);
reset role;

update public.ingredients
set review_status = 'reviewed'
where id = (select value_uuid from cat02_test_state where state_key = 'ingredient_id');
update public.ingredient_synonyms
set review_status = 'reviewed'
where import_batch_id = (select value_uuid from cat02_test_state where state_key = 'ingredient_batch');
set local role authenticated;
select is(
  (select count(*) from public.ingredients where id =
    (select value_uuid from cat02_test_state where state_key = 'ingredient_id')),
  0::bigint,
  'review elevation alone cannot serve an ingredient without an active CAT-03 head'
);
select is(
  (select count(*) from public.ingredient_synonyms where ingredient_id =
    (select value_uuid from cat02_test_state where state_key = 'ingredient_id')),
  0::bigint,
  'reviewed synonyms remain hidden until their ingredient has an active CAT-03 head'
);
reset role;

-- Build one imported dependent product and one unrelated legacy product.
update public.products
set status = 'active', review_status = 'reviewed', quality_grade = 'verified',
    recommendation_eligible = false, last_reviewed_at = pg_catalog.now()
where import_batch_id = (select value_uuid from cat02_test_state where state_key = 'product_corrected');
update public.product_barcodes
set review_status = 'reviewed'
where import_batch_id = (select value_uuid from cat02_test_state where state_key = 'product_corrected');
update public.product_ingredient_lists
set review_status = 'reviewed'
where import_batch_id = (select value_uuid from cat02_test_state where state_key = 'product_corrected');

insert into public.product_ingredients (
  product_id, ingredient_id, position, concentration_band,
  ingredient_list_id, source_id, raw_token, normalized_token,
  match_type, match_confidence, is_unmatched, parser_version
)
select products.id,
  (select value_uuid from cat02_test_state where state_key = 'ingredient_id'),
  1, 'unknown', lists.id,
  (select id from public.catalog_sources where source_key = 'cosing'),
  'CAT02 Alpha Complex', 'CAT02 ALPHA COMPLEX', 'exact', 1, false,
  'phase4-cosing-transform-v2'
from public.products as products
join public.product_ingredient_lists as lists on lists.product_id = products.id
where products.import_batch_id = (select value_uuid from cat02_test_state where state_key = 'product_corrected');

insert into public.product_ingredient_tokens (
  ingredient_list_id, product_id, ingredient_id, position, raw_token,
  normalized_token, section, match_type, match_confidence, is_unmatched,
  source_id
)
select lists.id, products.id,
  (select value_uuid from cat02_test_state where state_key = 'ingredient_id'),
  1, 'CAT02 Alpha Complex', 'CAT02 ALPHA COMPLEX', 'main', 'exact', 1,
  false, (select id from public.catalog_sources where source_key = 'cosing')
from public.products as products
join public.product_ingredient_lists as lists on lists.product_id = products.id
where products.import_batch_id = (select value_uuid from cat02_test_state where state_key = 'product_corrected');

insert into public.product_active_bands (
  product_id, ingredient_id, tag, band, source_basis, evidence_note,
  source_id, review_status
)
select products.id,
  (select value_uuid from cat02_test_state where state_key = 'ingredient_id'),
  'cat02-active', '1-5%', 'curated_review', 'CAT-02 linked ingredient evidence.',
  (select id from public.catalog_sources where source_key = 'cosing'), 'reviewed'
from public.products as products
where products.import_batch_id = (select value_uuid from cat02_test_state where state_key = 'product_corrected');

insert into public.products (
  id, barcode, name, brand, category, canonical_name, display_name,
  normalized_brand_name, product_type, region, source, source_id,
  source_ref, source_url, source_snapshot_date, status, review_status,
  last_reviewed_at, quality_grade, recommendation_eligible,
  unresolved_correction_count
)
values (
  '57000000-0000-4000-8000-000000000010', '992345678900',
  'CAT02 Unrelated Product', 'CAT02 Brand', 'cleanser',
  'CAT02 Unrelated Product', 'CAT02 Unrelated Product', 'cat02 brand',
  'cleanser', 'US', 'open_beauty_facts',
  (select id from public.catalog_sources where source_key = 'open_beauty_facts'),
  '992345678900', 'https://world.openbeautyfacts.org/product/992345678900',
  current_date, 'active', 'reviewed', pg_catalog.now(), 'verified', false, 0
);
insert into public.product_barcodes (barcode, product_id, source_id, review_status)
values (
  '992345678900', '57000000-0000-4000-8000-000000000010',
  (select id from public.catalog_sources where source_key = 'open_beauty_facts'),
  'reviewed'
);

set local role authenticated;
select is(
  (select count(*) from public.products where id in (
    (select id from public.products where import_batch_id =
      (select value_uuid from cat02_test_state where state_key = 'product_corrected')),
    '57000000-0000-4000-8000-000000000010'::uuid
  )),
  0::bigint,
  'reviewed products remain hidden before CAT-03 publishes active heads'
);
select is(
  (select count(*) from public.product_ingredients where ingredient_id =
    (select value_uuid from cat02_test_state where state_key = 'ingredient_id')),
  0::bigint,
  'linked product-ingredient relation remains hidden without a CAT-03 head'
);
select ok(
  (select count(*) from public.product_ingredient_tokens where ingredient_id =
    (select value_uuid from cat02_test_state where state_key = 'ingredient_id')) = 0
  and (select count(*) from public.product_active_bands where ingredient_id =
    (select value_uuid from cat02_test_state where state_key = 'ingredient_id')) = 0,
  'linked parsed-token and active-band evidence remain hidden without a CAT-03 head'
);
reset role;

select lives_ok(
  $$select pg_temp.cat02_rollback(
    (select value_uuid from cat02_test_state where state_key = 'ingredient_batch'),
    'cat02.ingredient.rollback', 'operator.delta'
  )$$,
  'independent operator retires the imported ingredient batch'
);
select ok(
  exists (
    select 1 from public.ingredients
    where id = (select value_uuid from cat02_test_state where state_key = 'ingredient_id')
      and review_status = 'blocked' and import_projection_status = 'retired'
      and cas_number is null and ec_number is null and cosing_ref is null
  ) and (select count(*) from public.ingredient_synonyms
    where import_batch_id = (select value_uuid from cat02_test_state where state_key = 'ingredient_batch')
      and review_status = 'blocked' and import_projection_status = 'retired') = 2,
  'ingredient rollback tombstones alternate identities while preserving IDs and synonym rows'
);
select ok(
  exists (
    select 1 from public.products
    where import_batch_id = (select value_uuid from cat02_test_state where state_key = 'product_corrected')
      and status = 'active' and review_status = 'reviewed'
  ),
  'ingredient rollback does not mutate unrelated product rows'
);

set local role authenticated;
select is(
  (select count(*) from public.products where import_batch_id =
    (select value_uuid from cat02_test_state where state_key = 'product_corrected')),
  0::bigint,
  'retired linked ingredient hides the dependent product from direct reads'
);
select is(
  (select count(*) from public.product_ingredients where ingredient_id =
    (select value_uuid from cat02_test_state where state_key = 'ingredient_id')),
  0::bigint,
  'retired linked ingredient hides the relation itself'
);
select ok(
  (select count(*) from public.product_ingredient_tokens where ingredient_id =
    (select value_uuid from cat02_test_state where state_key = 'ingredient_id')) = 0
  and (select count(*) from public.product_active_bands where ingredient_id =
    (select value_uuid from cat02_test_state where state_key = 'ingredient_id')) = 0,
  'retired linked ingredient hides parsed-token and active-band evidence'
);
select is(
  (select count(*) from public.products where id = '57000000-0000-4000-8000-000000000010'),
  0::bigint,
  'ingredient rollback does not make an unrelated CAT-03-uncurated product servable'
);
reset role;
set local role service_role;
select is(
  (select count(*) from public.lookup_catalog_product_by_barcode('991234567899')),
  0::bigint,
  'retired linked ingredient hides dependent exact-barcode lookup'
);
select is(
  (select count(*) from public.search_catalog_products('Corrected Lifecycle Cream', 10)),
  0::bigint,
  'retired linked ingredient hides dependent product search'
);
select is(
  (select count(*) from public.lookup_catalog_product_by_barcode('992345678900')),
  0::bigint,
  'unrelated exact-barcode lookup remains closed without a CAT-03 head'
);
reset role;

with receipt as (
  select pg_temp.cat02_begin_receipt('cat02.ingredient-corrected.begin', 'cosing') as value
)
insert into cat02_test_state (state_key, value_uuid, value_json)
select 'ingredient_corrected', (value ->> 'batch_id')::uuid, value from receipt;
select lives_ok(
  $$select pg_temp.cat02_stage(
    (select value_uuid from cat02_test_state where state_key = 'ingredient_corrected'),
    'cat02.ingredient-corrected.chunk',
    pg_catalog.jsonb_build_array(
      pg_temp.cat02_ingredient(
        'CAT02 Alpha Complex', 'cat02:alpha:001', '1234567-89-0', '123-456-7',
        'restricted', '["CAT02 Alpha Alias","CAT02 A-Complex"]'::jsonb
      )
    )
  )$$,
  'corrected ingredient reuses retired canonical/sourceRef/CAS/EC/synonym identities'
);
select lives_ok(
  $$select pg_temp.cat02_finalize(
    (select value_uuid from cat02_test_state where state_key = 'ingredient_corrected'),
    'cat02.ingredient-corrected.finalize'
  )$$,
  'corrected ingredient finalizes without active-key conflicts'
);
select is(
  (select conflict_record_count from public.catalog_import_batches
   where id = (select value_uuid from cat02_test_state where state_key = 'ingredient_corrected')),
  0,
  'retired ingredient identities do not block corrected import'
);

-- Existing multi-match identities collapse deterministically into conflict
-- evidence instead of violating the ledger's own uniqueness constraint.
insert into public.ingredients (
  id, inci_name, display_name, cas_number, ec_number, cosing_ref,
  source, normalized_inci_name, review_status, source_id,
  source_snapshot_date, source_url
)
values
  (
    '57000000-0000-4000-8000-000000000020', 'CAT02 Existing Collision One',
    'CAT02 Existing Collision One', '7654321-11-2', '765-432-1', 'CAT02:MULTI:REF',
    'cosing', 'STALE CACHE ONE', 'needs_review',
    (select id from public.catalog_sources where source_key = 'cosing'),
    current_date, 'https://ec.europa.eu/growth/tools-databases/cosing/reference.csv'
  ),
  (
    '57000000-0000-4000-8000-000000000021', 'CAT02 Existing Collision Two',
    'CAT02 Existing Collision Two', '7654321-11-2', '765-432-1', 'cat02:multi:ref',
    'cosing', 'STALE CACHE TWO', 'needs_review',
    (select id from public.catalog_sources where source_key = 'cosing'),
    current_date, 'https://ec.europa.eu/growth/tools-databases/cosing/reference.csv'
  ),
  (
    '57000000-0000-4000-8000-000000000022', 'CAT02 Stale Canonical',
    'CAT02 Stale Canonical', null, null, 'CAT02:STALE:CANONICAL',
    'cosing', 'INTENTIONALLY WRONG CACHE', 'needs_review',
    (select id from public.catalog_sources where source_key = 'cosing'),
    current_date, 'https://ec.europa.eu/growth/tools-databases/cosing/reference.csv'
  );
insert into public.ingredient_synonyms (
  ingredient_id, synonym, normalized_synonym, source_id, review_status
)
values
  (
    '57000000-0000-4000-8000-000000000020', 'CAT02 Existing Alias',
    'INTENTIONALLY WRONG ALIAS CACHE',
    (select id from public.catalog_sources where source_key = 'cosing'), 'needs_review'
  ),
  (
    '57000000-0000-4000-8000-000000000022', 'CAT02 Stale Alias',
    'INTENTIONALLY WRONG STALE CACHE',
    (select id from public.catalog_sources where source_key = 'cosing'), 'needs_review'
  );

with receipt as (
  select pg_temp.cat02_begin_receipt('cat02.conflict.multi.begin', 'cosing') as value
)
insert into cat02_test_state (state_key, value_uuid)
select 'conflict_multi', (value ->> 'batch_id')::uuid from receipt;
select lives_ok(
  $$select pg_temp.cat02_stage(
    (select value_uuid from cat02_test_state where state_key = 'conflict_multi'),
    'cat02.conflict.multi.chunk',
    pg_catalog.jsonb_build_array(
      pg_temp.cat02_ingredient(
        'CAT02 New Collision Candidate', 'CaT02:MuLtI:ReF',
        '7654321-11-2', '765-432-1', null, '["cat02 existing alias"]'::jsonb
      )
    )
  )$$,
  'multi-dimensional existing-catalog collision stages'
);
select lives_ok(
  $$select pg_temp.cat02_finalize(
    (select value_uuid from cat02_test_state where state_key = 'conflict_multi'),
    'cat02.conflict.multi.finalize'
  )$$,
  'multiple existing entities per CAS/EC/sourceRef collapse without aborting finalization'
);
select ok(
  (select status from public.catalog_import_batches where id =
    (select value_uuid from cat02_test_state where state_key = 'conflict_multi')) = 'blocked'
  and (select count(*) from private.catalog_import_conflicts where batch_id =
    (select value_uuid from cat02_test_state where state_key = 'conflict_multi')) >= 4
  and (select count(distinct natural_key) from private.catalog_import_conflicts where batch_id =
    (select value_uuid from cat02_test_state where state_key = 'conflict_multi')) >= 4,
  'sourceRef, CAS, EC, and synonym collisions are independently sealed as conflicts'
);

with receipt as (
  select pg_temp.cat02_begin_receipt('cat02.conflict.stale-canonical.begin', 'cosing') as value
)
insert into cat02_test_state (state_key, value_uuid)
select 'conflict_stale_canonical', (value ->> 'batch_id')::uuid from receipt;
select lives_ok(
  $$select pg_temp.cat02_stage(
    (select value_uuid from cat02_test_state where state_key = 'conflict_stale_canonical'),
    'cat02.conflict.stale-canonical.chunk',
    pg_catalog.jsonb_build_array(
      pg_temp.cat02_ingredient('cat02   stale canonical', 'CAT02:STALE:NEW')
    )
  )$$,
  'stale-canonical-cache adversarial candidate stages'
);
select lives_ok(
  $$select pg_temp.cat02_finalize(
    (select value_uuid from cat02_test_state where state_key = 'conflict_stale_canonical'),
    'cat02.conflict.stale-canonical.finalize'
  )$$,
  'raw INCI authority detects a collision despite a stale nonempty normalized cache'
);
select is(
  (select status from public.catalog_import_batches where id =
    (select value_uuid from cat02_test_state where state_key = 'conflict_stale_canonical')),
  'blocked'::text,
  'stale normalized INCI cache cannot hide an existing canonical collision'
);

with receipt as (
  select pg_temp.cat02_begin_receipt('cat02.conflict.stale-synonym.begin', 'cosing') as value
)
insert into cat02_test_state (state_key, value_uuid)
select 'conflict_stale_synonym', (value ->> 'batch_id')::uuid from receipt;
select lives_ok(
  $$select pg_temp.cat02_stage(
    (select value_uuid from cat02_test_state where state_key = 'conflict_stale_synonym'),
    'cat02.conflict.stale-synonym.chunk',
    pg_catalog.jsonb_build_array(
      pg_temp.cat02_ingredient(
        'CAT02 New Stale Alias Owner', 'CAT02:STALE:ALIAS:NEW',
        null, null, null, '["cat02 stale alias"]'::jsonb
      )
    )
  )$$,
  'stale-synonym-cache adversarial candidate stages'
);
select lives_ok(
  $$select pg_temp.cat02_finalize(
    (select value_uuid from cat02_test_state where state_key = 'conflict_stale_synonym'),
    'cat02.conflict.stale-synonym.finalize'
  )$$,
  'raw synonym authority detects a collision despite a stale nonempty cache'
);
select is(
  (select status from public.catalog_import_batches where id =
    (select value_uuid from cat02_test_state where state_key = 'conflict_stale_synonym')),
  'blocked'::text,
  'stale normalized synonym cache cannot hide an existing synonym collision'
);

with receipt as (
  select pg_temp.cat02_begin_receipt('cat02.conflict.cross-domain.begin', 'cosing', 2) as value
)
insert into cat02_test_state (state_key, value_uuid)
select 'conflict_cross_domain', (value ->> 'batch_id')::uuid from receipt;
select lives_ok(
  $$select pg_temp.cat02_stage(
    (select value_uuid from cat02_test_state where state_key = 'conflict_cross_domain'),
    'cat02.conflict.cross-domain.chunk',
    pg_catalog.jsonb_build_array(
      pg_temp.cat02_ingredient(
        'CAT02 Cross Alpha', 'CAT02:CROSS:A', null, null, null,
        '["CAT02 Cross Beta"]'::jsonb
      ),
      pg_temp.cat02_ingredient('cat02 cross beta', 'CAT02:CROSS:B')
    )
  )$$,
  'within-batch canonical/synonym collision stages for deterministic routing'
);
select lives_ok(
  $$select pg_temp.cat02_finalize(
    (select value_uuid from cat02_test_state where state_key = 'conflict_cross_domain'),
    'cat02.conflict.cross-domain.finalize', 2
  )$$,
  'within-batch cross-domain collision finalizes as blocked rather than order-dependent'
);
select is(
  (select count(*) from private.catalog_import_staged_records
   where batch_id = (select value_uuid from cat02_test_state where state_key = 'conflict_cross_domain')
     and disposition = 'conflict'),
  2::bigint,
  'both canonical and synonym owners are marked conflicting'
);

-- Two independently reviewed batches are rechecked under the global
-- promotion lock across every uniqueness authority.
insert into cat02_test_state (state_key, value_uuid)
values (
  'toctou_cross_a', pg_temp.cat02_prepare_reviewed(
    'cat02.toctou.cross-a', 'cosing', pg_catalog.jsonb_build_array(
      pg_temp.cat02_ingredient(
        'CAT02 TOCTOU Cross A', 'CAT02:TOCTOU:CROSS:A', null, null, null,
        '["CAT02 TOCTOU Cross Key"]'::jsonb
      )
    )
  )
), (
  'toctou_cross_b', pg_temp.cat02_prepare_reviewed(
    'cat02.toctou.cross-b', 'cosing', pg_catalog.jsonb_build_array(
      pg_temp.cat02_ingredient('CAT02 TOCTOU Cross Key', 'CAT02:TOCTOU:CROSS:B')
    )
  )
);
select lives_ok(
  $$select pg_temp.cat02_promote(
    (select value_uuid from cat02_test_state where state_key = 'toctou_cross_b'),
    'cat02.toctou.cross-b.promote'
  )$$,
  'later canonical batch promotes first'
);
select throws_ok(
  $$select pg_temp.cat02_promote(
    (select value_uuid from cat02_test_state where state_key = 'toctou_cross_a'),
    'cat02.toctou.cross-a.promote'
  )$$,
  '23505', 'CATALOG_IMPORT_DESTINATION_CONFLICT',
  'accepted synonym cannot promote after another batch promotes that canonical INCI'
);

insert into cat02_test_state (state_key, value_uuid)
values (
  'toctou_converse_a', pg_temp.cat02_prepare_reviewed(
    'cat02.toctou.converse-a', 'cosing', pg_catalog.jsonb_build_array(
      pg_temp.cat02_ingredient('CAT02 TOCTOU Converse Key', 'CAT02:TOCTOU:CONVERSE:A')
    )
  )
), (
  'toctou_converse_b', pg_temp.cat02_prepare_reviewed(
    'cat02.toctou.converse-b', 'cosing', pg_catalog.jsonb_build_array(
      pg_temp.cat02_ingredient(
        'CAT02 TOCTOU Converse Owner', 'CAT02:TOCTOU:CONVERSE:B',
        null, null, null, '["CAT02 TOCTOU Converse Key"]'::jsonb
      )
    )
  )
);
select lives_ok(
  $$select pg_temp.cat02_promote(
    (select value_uuid from cat02_test_state where state_key = 'toctou_converse_b'),
    'cat02.toctou.converse-b.promote'
  )$$,
  'later synonym batch promotes first'
);
select throws_ok(
  $$select pg_temp.cat02_promote(
    (select value_uuid from cat02_test_state where state_key = 'toctou_converse_a'),
    'cat02.toctou.converse-a.promote'
  )$$,
  '23505', 'CATALOG_IMPORT_DESTINATION_CONFLICT',
  'accepted canonical cannot promote after another batch promotes that synonym'
);

insert into cat02_test_state (state_key, value_uuid)
values (
  'toctou_source_ref_a', pg_temp.cat02_prepare_reviewed(
    'cat02.toctou.source-ref-a', 'cosing', pg_catalog.jsonb_build_array(
      pg_temp.cat02_ingredient(
        'CAT02 TOCTOU Source Ref A', 'Case:Ref:901'
      )
    )
  )
), (
  'toctou_source_ref_b', pg_temp.cat02_prepare_reviewed(
    'cat02.toctou.source-ref-b', 'cosing', pg_catalog.jsonb_build_array(
      pg_temp.cat02_ingredient(
        'CAT02 TOCTOU Source Ref B', 'case:ref:901'
      )
    )
  )
);
select lives_ok(
  $$select pg_temp.cat02_promote(
    (select value_uuid from cat02_test_state where state_key = 'toctou_source_ref_a'),
    'cat02.toctou.source-ref-a.promote'
  )$$,
  'first case-normalized sourceRef batch promotes'
);
select throws_ok(
  $$select pg_temp.cat02_promote(
    (select value_uuid from cat02_test_state where state_key = 'toctou_source_ref_b'),
    'cat02.toctou.source-ref-b.promote'
  )$$,
  '23505', 'CATALOG_IMPORT_DESTINATION_CONFLICT',
  'case-normalized sourceRef alone is rechecked under the promotion lock'
);

insert into cat02_test_state (state_key, value_uuid)
values (
  'toctou_cas_a', pg_temp.cat02_prepare_reviewed(
    'cat02.toctou.cas-a', 'cosing', pg_catalog.jsonb_build_array(
      pg_temp.cat02_ingredient(
        'CAT02 TOCTOU CAS A', 'CAT02:TOCTOU:CAS:A', '2222222-33-4'
      )
    )
  )
), (
  'toctou_cas_b', pg_temp.cat02_prepare_reviewed(
    'cat02.toctou.cas-b', 'cosing', pg_catalog.jsonb_build_array(
      pg_temp.cat02_ingredient(
        'CAT02 TOCTOU CAS B', 'CAT02:TOCTOU:CAS:B', '2222222-33-4'
      )
    )
  )
);
select lives_ok(
  $$select pg_temp.cat02_promote(
    (select value_uuid from cat02_test_state where state_key = 'toctou_cas_a'),
    'cat02.toctou.cas-a.promote'
  )$$,
  'first duplicate-CAS batch promotes'
);
select throws_ok(
  $$select pg_temp.cat02_promote(
    (select value_uuid from cat02_test_state where state_key = 'toctou_cas_b'),
    'cat02.toctou.cas-b.promote'
  )$$,
  '23505', 'CATALOG_IMPORT_DESTINATION_CONFLICT',
  'CAS identity alone is rechecked under the promotion lock'
);

insert into cat02_test_state (state_key, value_uuid)
values (
  'toctou_ec_a', pg_temp.cat02_prepare_reviewed(
    'cat02.toctou.ec-a', 'cosing', pg_catalog.jsonb_build_array(
      pg_temp.cat02_ingredient(
        'CAT02 TOCTOU EC A', 'CAT02:TOCTOU:EC:A', null, '222-333-4'
      )
    )
  )
), (
  'toctou_ec_b', pg_temp.cat02_prepare_reviewed(
    'cat02.toctou.ec-b', 'cosing', pg_catalog.jsonb_build_array(
      pg_temp.cat02_ingredient(
        'CAT02 TOCTOU EC B', 'CAT02:TOCTOU:EC:B', null, '222-333-4'
      )
    )
  )
);
select lives_ok(
  $$select pg_temp.cat02_promote(
    (select value_uuid from cat02_test_state where state_key = 'toctou_ec_a'),
    'cat02.toctou.ec-a.promote'
  )$$,
  'first duplicate-EC batch promotes'
);
select throws_ok(
  $$select pg_temp.cat02_promote(
    (select value_uuid from cat02_test_state where state_key = 'toctou_ec_b'),
    'cat02.toctou.ec-b.promote'
  )$$,
  '23505', 'CATALOG_IMPORT_DESTINATION_CONFLICT',
  'EC identity alone is rechecked under the promotion lock'
);

insert into cat02_test_state (state_key, value_uuid)
values (
  'toctou_product_a', pg_temp.cat02_prepare_reviewed(
    'cat02.toctou.product-a', 'open_beauty_facts', pg_catalog.jsonb_build_array(
      pg_temp.cat02_product('993456789011', 'CAT02 TOCTOU Product A')
    )
  )
), (
  'toctou_product_b', pg_temp.cat02_prepare_reviewed(
    'cat02.toctou.product-b', 'open_beauty_facts', pg_catalog.jsonb_build_array(
      pg_temp.cat02_product('993456789011', 'CAT02 TOCTOU Product B')
    )
  )
);
select lives_ok(
  $$select pg_temp.cat02_promote(
    (select value_uuid from cat02_test_state where state_key = 'toctou_product_a'),
    'cat02.toctou.product-a.promote'
  )$$,
  'first same-barcode reviewed batch promotes'
);
select throws_ok(
  $$select pg_temp.cat02_promote(
    (select value_uuid from cat02_test_state where state_key = 'toctou_product_b'),
    'cat02.toctou.product-b.promote'
  )$$,
  '23505', 'CATALOG_IMPORT_DESTINATION_CONFLICT',
  'same barcode/sourceRef in a stale reviewed batch is rechecked under the promotion lock'
);
select ok(
  not exists (
    select 1 from private.catalog_import_promotion_events
    where batch_id in (
      (select value_uuid from cat02_test_state where state_key = 'toctou_cross_a'),
      (select value_uuid from cat02_test_state where state_key = 'toctou_converse_a'),
      (select value_uuid from cat02_test_state where state_key = 'toctou_source_ref_b'),
      (select value_uuid from cat02_test_state where state_key = 'toctou_cas_b'),
      (select value_uuid from cat02_test_state where state_key = 'toctou_ec_b'),
      (select value_uuid from cat02_test_state where state_key = 'toctou_product_b')
    )
  ) and not exists (
    select 1 from private.catalog_import_entity_revisions
    where batch_id in (
      (select value_uuid from cat02_test_state where state_key = 'toctou_cross_a'),
      (select value_uuid from cat02_test_state where state_key = 'toctou_converse_a'),
      (select value_uuid from cat02_test_state where state_key = 'toctou_source_ref_b'),
      (select value_uuid from cat02_test_state where state_key = 'toctou_cas_b'),
      (select value_uuid from cat02_test_state where state_key = 'toctou_ec_b'),
      (select value_uuid from cat02_test_state where state_key = 'toctou_product_b')
    )
  ),
  'all stale-batch promotion conflicts leave zero event/revision residue'
);

-- A failure after the promotion event and first projection insert still rolls
-- back the entire statement: no event, revision, effect, or projection leaks.
insert into cat02_test_state (state_key, value_uuid)
values (
  'midloop_batch', pg_temp.cat02_prepare_reviewed(
    'cat02.midloop', 'open_beauty_facts', pg_catalog.jsonb_build_array(
      pg_temp.cat02_product('994567890122', 'CAT02 Midloop First'),
      pg_temp.cat02_product('994567890139', 'CAT02 Midloop Second Fails')
    )
  )
);
alter table public.products
  add constraint cat02_test_midloop_fail
  check (name <> 'CAT02 Midloop Second Fails') not valid;
select throws_ok(
  $$select pg_temp.cat02_promote(
    (select value_uuid from cat02_test_state where state_key = 'midloop_batch'),
    'cat02.midloop.promote'
  )$$,
  '23514',
  'new row for relation "products" violates check constraint "cat02_test_midloop_fail"',
  'induced second-record projection failure aborts promotion'
);
select ok(
  not exists (select 1 from private.catalog_import_promotion_events where batch_id =
    (select value_uuid from cat02_test_state where state_key = 'midloop_batch'))
  and not exists (select 1 from private.catalog_import_entity_revisions where batch_id =
    (select value_uuid from cat02_test_state where state_key = 'midloop_batch'))
  and not exists (select 1 from private.catalog_import_batch_effects where batch_id =
    (select value_uuid from cat02_test_state where state_key = 'midloop_batch'))
  and not exists (select 1 from public.products where import_batch_id =
    (select value_uuid from cat02_test_state where state_key = 'midloop_batch')),
  'mid-loop exception leaves zero promotion/audit/projection residue'
);
alter table public.products drop constraint cat02_test_midloop_fail;
select lives_ok(
  $$select pg_temp.cat02_promote(
    (select value_uuid from cat02_test_state where state_key = 'midloop_batch'),
    'cat02.midloop.promote'
  )$$,
  'same reviewed batch promotes after the induced external constraint is removed'
);
select lives_ok(
  $$select pg_temp.cat02_rollback(
    (select value_uuid from cat02_test_state where state_key = 'midloop_batch'),
    'cat02.midloop.rollback'
  )$$,
  'one promoted batch can be retired independently'
);
select ok(
  exists (
    select 1 from public.products
    where import_batch_id = (select value_uuid from cat02_test_state where state_key = 'product_corrected')
      and import_projection_status = 'active'
  ) and exists (
    select 1 from public.products
    where import_batch_id = (select value_uuid from cat02_test_state where state_key = 'toctou_product_a')
      and import_projection_status = 'active'
  ),
  'rollback of batch A leaves later independent promoted batches untouched'
);

-- Global operation-key constraints reject cross-batch replays at each sealed
-- service/owner transition.
with receipt as (
  select pg_temp.cat02_begin_receipt('cat02.opkey.begin', 'open_beauty_facts') as value
)
insert into cat02_test_state (state_key, value_uuid)
select 'opkey_batch', (value ->> 'batch_id')::uuid from receipt;
select lives_ok(
  $$select pg_temp.cat02_stage(
    (select value_uuid from cat02_test_state where state_key = 'opkey_batch'),
    'cat02.opkey.chunk',
    pg_catalog.jsonb_build_array(pg_temp.cat02_product('995678901233', 'CAT02 Operation Key Product'))
  )$$,
  'operation-key batch stages'
);
select throws_ok(
  $$select pg_temp.cat02_finalize(
    (select value_uuid from cat02_test_state where state_key = 'opkey_batch'),
    'cat02.product-corrected.finalize'
  )$$,
  '22023', 'CATALOG_IMPORT_FINALIZE_REPLAY_CHANGED',
  'one finalize operation key cannot commit on two batches'
);
select lives_ok(
  $$select pg_temp.cat02_finalize(
    (select value_uuid from cat02_test_state where state_key = 'opkey_batch'),
    'cat02.opkey.finalize'
  )$$,
  'operation-key batch finalizes under its own key'
);
select throws_ok(
  $$select pg_temp.cat02_verify(
    (select value_uuid from cat02_test_state where state_key = 'opkey_batch'),
    'cat02.product-corrected.verify'
  )$$,
  '22023', 'CATALOG_IMPORT_VERIFY_REPLAY_CHANGED',
  'one verification operation key cannot commit on two batches'
);
select lives_ok(
  $$select pg_temp.cat02_verify(
    (select value_uuid from cat02_test_state where state_key = 'opkey_batch'),
    'cat02.opkey.verify'
  )$$,
  'operation-key batch verifies under its own key'
);
select throws_ok(
  $$select pg_temp.cat02_review(
    (select value_uuid from cat02_test_state where state_key = 'opkey_batch'),
    'cat02.product.review'
  )$$,
  '22023', 'CATALOG_IMPORT_REVIEW_REPLAY_CHANGED',
  'one review operation key cannot commit on two batches'
);

-- Ordered fixed-width leaves bind boundaries and record order without ever
-- constructing a whole-batch JSONB value.
select is(
  private.catalog_import_sha256_text(
    private.catalog_import_canonical_json('{"a":"1","b":"2"}'::jsonb)
  ),
  private.catalog_import_sha256_text(
    private.catalog_import_canonical_json('{"b":"2","a":"1"}'::jsonb)
  ),
  'candidate leaf digest is invariant to source object key presentation order'
);
select isnt(
  private.catalog_import_sha256_text(
    private.catalog_import_canonical_json('{"a":["1","2"]}'::jsonb)
  ),
  private.catalog_import_sha256_text(
    private.catalog_import_canonical_json('{"a":["2","1"]}'::jsonb)
  ),
  'candidate leaf digest preserves array order'
);
select isnt(
  private.catalog_import_sha256_text(
    private.catalog_import_sha256_text(private.catalog_import_canonical_json('{"a":"1"}'::jsonb)) ||
    private.catalog_import_sha256_text(private.catalog_import_canonical_json('{"b":"2"}'::jsonb))
  ),
  private.catalog_import_sha256_text(
    private.catalog_import_sha256_text(private.catalog_import_canonical_json('{"b":"2"}'::jsonb)) ||
    private.catalog_import_sha256_text(private.catalog_import_canonical_json('{"a":"1"}'::jsonb))
  ),
  'candidate leaf-chain digest changes when record order changes'
);
select isnt(
  private.catalog_import_sha256_text(
    private.catalog_import_sha256_text(private.catalog_import_canonical_json('{"a":null}'::jsonb))
  ),
  private.catalog_import_sha256_text(
    private.catalog_import_sha256_text(private.catalog_import_canonical_json('{"a":""}'::jsonb))
  ),
  'candidate leaf-chain digest distinguishes null from empty string'
);

-- Every immutable ledger relation rejects history edits.
select throws_ok(
  $$delete from private.catalog_import_conflicts where batch_id =
    (select value_uuid from cat02_test_state where state_key = 'conflict_multi')$$,
  '55000', 'CATALOG_IMPORT_LEDGER_IMMUTABLE',
  'conflict ledger rejects deletion'
);
select throws_ok(
  $$update private.catalog_import_entity_revisions set revision_action = 'retired'
    where batch_id = (select value_uuid from cat02_test_state where state_key = 'toctou_product_a')$$,
  '55000', 'CATALOG_IMPORT_LEDGER_IMMUTABLE',
  'entity revision ledger rejects updates'
);
select throws_ok(
  $$delete from private.catalog_import_batch_effects where batch_id =
    (select value_uuid from cat02_test_state where state_key = 'toctou_product_a')$$,
  '55000', 'CATALOG_IMPORT_LEDGER_IMMUTABLE',
  'batch-effect ledger rejects deletion'
);
select throws_ok(
  $$update private.catalog_import_chunk_receipts set chunk_ordinal = 99
    where batch_id = (select value_uuid from cat02_test_state where state_key = 'toctou_product_a')$$,
  '55000', 'CATALOG_IMPORT_LEDGER_IMMUTABLE',
  'chunk receipt ledger rejects updates'
);

select * from finish();
rollback;
