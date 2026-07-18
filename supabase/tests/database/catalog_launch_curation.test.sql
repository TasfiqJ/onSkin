begin;

create extension if not exists pgtap with schema extensions;
set local search_path = extensions, public, pg_catalog;

select plan(84);

create temp table cat03_test_state (
  state_key text primary key,
  value_uuid uuid,
  value_text text,
  value_json jsonb
);

create or replace function pg_temp.cat03_gtin14(p_ordinal integer)
returns text
language sql
immutable
set search_path = ''
as $$
  with value as (
    select '58' || pg_catalog.lpad(p_ordinal::text, 11, '0') as stem
  ), checksum as (
    select value.stem,
      pg_catalog.sum(
        pg_catalog.substr(value.stem, position.ordinal, 1)::integer *
        case when pg_catalog.mod(13 - position.ordinal, 2) = 0
          then 3 else 1 end
      )::integer as weighted_sum
    from value
    cross join pg_catalog.generate_series(1, 13) as position(ordinal)
    group by value.stem
  )
  select checksum.stem ||
    pg_catalog.mod(10 - pg_catalog.mod(checksum.weighted_sum, 10), 10)::text
  from checksum
$$;

create or replace function pg_temp.cat03_manifest(p_source text)
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
      else 'approved_offline_snapshot'
    end,
    'sourceKey', p_source,
    'sourceComponentId', case p_source
      when 'open_beauty_facts' then 'obf_odbl_component'
      else 'cosing_reference_component'
    end,
    'parserVersion', case p_source
      when 'open_beauty_facts' then 'phase4-obf-transform-v2'
      else 'phase4-cosing-transform-v2'
    end,
    'artifactKind', 'production',
    'territory', 'US',
    'snapshotDate', current_date,
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

create or replace function pg_temp.cat03_product_payload(
  p_ordinal integer,
  p_barcode text,
  p_category text
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
    'name', 'CAT-03 Launch ' || pg_catalog.lpad(p_ordinal::text, 4, '0'),
    'brand', 'CAT-03 Brand',
    'category', p_category,
    'ingredientsText', 'CAT03 INGREDIENT A, CAT03 INGREDIENT B',
    'source', 'open_beauty_facts',
    'sourceComponentId', 'obf_odbl_component',
    'sourceRef', p_barcode,
    'sourceUrl', 'https://world.openbeautyfacts.org/product/' || p_barcode,
    'sourceRecordModifiedDate', current_date,
    'sourceArtifactSha256', pg_catalog.repeat('a', 64),
    'qualityGrade', 'unverified',
    'reviewStatus', 'unreviewed',
    'sourceSnapshotDate', current_date,
    'region', 'US'
  )
$$;

create or replace function pg_temp.cat03_ingredient_payload(
  p_ordinal integer
)
returns jsonb
language sql
stable
set search_path = ''
as $$
  select pg_catalog.jsonb_build_object(
    'recordKind', 'ingredient',
    'canonicalKey', private.catalog_import_normalize_key(
      'CAT03 INGREDIENT ' || case p_ordinal when 1 then 'A' else 'B' end
    ),
    'inciName', 'CAT03 INGREDIENT ' || case p_ordinal when 1 then 'A' else 'B' end,
    'displayName', 'CAT03 Ingredient ' || case p_ordinal when 1 then 'A' else 'B' end,
    'casNumber', null,
    'ecNumber', null,
    'annexStatus', null,
    'sourceRef', 'CAT03-COSING-' || p_ordinal::text,
    'sourceRecordStatus', 'active',
    'glossaryDecision', 'EU_2025_1175',
    'source', 'cosing',
    'sourceComponentId', 'cosing_reference_component',
    'sourceUrl', 'https://ec.europa.eu/growth/tools-databases/cosing/reference.csv',
    'sourceArtifactSha256', pg_catalog.repeat('a', 64),
    'reviewStatus', 'unreviewed',
    'synonyms', '[]'::jsonb,
    'sourceSnapshotDate', current_date
  )
$$;

create or replace function pg_temp.cat03_begin_import(
  p_prefix text,
  p_source text,
  p_expected integer
)
returns jsonb
language sql
volatile
security definer
set search_path = ''
as $$
  select pg_catalog.to_jsonb(result)
  from public.begin_catalog_import(
    p_prefix || '.begin',
    p_source,
    case p_source when 'open_beauty_facts' then 'obf_export'
      else 'cosing_dictionary' end,
    current_date,
    'production',
    'US',
    case p_source when 'open_beauty_facts'
      then 'https://static.openbeautyfacts.org/data/open-beauty-facts.jsonl'
      else 'https://ec.europa.eu/growth/tools-databases/cosing/reference.csv' end,
    pg_catalog.repeat('a', 64),
    pg_temp.cat03_manifest(p_source),
    pg_catalog.repeat('b', 64),
    pg_catalog.repeat('c', 64),
    pg_catalog.repeat('d', 64),
    pg_catalog.repeat('e', 64),
    pg_catalog.repeat('f', 64),
    'docs/phase-4/catalog-import-qa.json',
    pg_catalog.repeat('0', 64),
    0,
    0,
    p_expected,
    case p_source when 'open_beauty_facts' then 'phase4-obf-transform-v2'
      else 'phase4-cosing-transform-v2' end
  ) as result
$$;

create or replace function pg_temp.cat03_stage_chunk(
  p_batch uuid,
  p_operation text,
  p_chunk integer,
  p_first integer,
  p_records jsonb
)
returns jsonb
language sql
volatile
security definer
set search_path = ''
as $$
  select pg_catalog.to_jsonb(result)
  from public.stage_catalog_import_chunk(
    p_batch, p_operation, p_chunk, p_first, p_records
  ) as result
$$;

create or replace function pg_temp.cat03_decisions(p_batch uuid)
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
  select pg_catalog.jsonb_agg(
    pg_catalog.jsonb_build_object(
      'recordOrdinal', staged.record_ordinal,
      'recordSha256', staged.record_sha256,
      'decision', 'accepted',
      'reason', 'Two-person production source and row evidence review passed.'
    ) order by staged.record_ordinal
  )
  from private.catalog_import_staged_records as staged
  where staged.batch_id = p_batch
    and staged.disposition = 'pending'
$$;

create or replace function pg_temp.cat03_complete_import(
  p_batch uuid,
  p_prefix text,
  p_expected integer
)
returns void
language plpgsql
volatile
security definer
set search_path = ''
as $$
begin
  perform 1 from public.finalize_catalog_import(
    p_batch, p_prefix || '.finalize', p_expected
  );
  perform 1 from public.verify_catalog_import(
    p_batch,
    p_prefix || '.verify',
    (select batch.records_sha256
     from public.catalog_import_batches as batch where batch.id = p_batch),
    pg_catalog.repeat('9', 64)
  );
  perform 1 from public.review_catalog_import(
    p_batch,
    p_prefix || '.review',
    pg_temp.cat03_decisions(p_batch),
    (select batch.candidates_sha256
     from public.catalog_import_batches as batch where batch.id = p_batch),
    private.catalog_import_batch_evidence_sha256(p_batch),
    pg_catalog.repeat('9', 64),
    array['cat03.import.review.alpha', 'cat03.import.review.beta']::text[],
    'CAT03-PRODUCTION-REVIEW-2026-07-17',
    pg_catalog.repeat('8', 64)
  );
  perform 1 from public.promote_catalog_import(
    p_batch,
    p_prefix || '.promote',
    'cat03.import.operator',
    'CAT03-PRODUCTION-REVIEW-2026-07-17',
    pg_catalog.repeat('8', 64)
  );
end;
$$;

create temp table cat03_product_fixture (
  ordinal integer primary key,
  barcode text not null unique,
  category_id text not null,
  category_code text not null,
  regulatory_classification text not null,
  source_payload jsonb not null,
  product_id uuid unique,
  staged_record_id uuid unique,
  ingredient_list_id uuid unique,
  normalized_payload jsonb,
  product_record_sha256 text unique
);

with fixture as (
  select
    series.ordinal,
    pg_temp.cat03_gtin14(series.ordinal) as barcode,
    case
      when series.ordinal = 2001 then 'cleanser'
      when series.ordinal % 6 = 1 then 'cleanser'
      when series.ordinal % 6 = 2 then 'serum'
      when series.ordinal % 6 = 3 then 'moisturiser_tube'
      when series.ordinal % 6 = 4 then 'spf'
      when series.ordinal % 6 = 5 then 'toner'
      else 'benzoyl_peroxide'
    end as category_id
  from pg_catalog.generate_series(1, 2001) as series(ordinal)
)
insert into cat03_product_fixture (
  ordinal, barcode, category_id, category_code,
  regulatory_classification, source_payload
)
select
  fixture.ordinal,
  fixture.barcode,
  fixture.category_id,
  case fixture.category_id
    when 'spf' then 'sunscreen'
    when 'benzoyl_peroxide' then 'acne_treatment'
    when 'moisturiser_tube' then 'moisturizer'
    else fixture.category_id
  end,
  case when fixture.category_id in ('spf', 'benzoyl_peroxide')
    then 'otc_drug' else 'cosmetic' end,
  pg_temp.cat03_product_payload(
    fixture.ordinal, fixture.barcode, fixture.category_id
  )
from fixture;

create temp table cat03_ingredient_fixture (
  ordinal integer primary key,
  source_payload jsonb not null,
  ingredient_id uuid unique,
  staged_record_id uuid unique,
  ingredient_record_sha256 text unique
);

insert into cat03_ingredient_fixture (ordinal, source_payload)
select ordinal, pg_temp.cat03_ingredient_payload(ordinal)
from pg_catalog.generate_series(1, 2) as ingredient(ordinal);

update public.catalog_sources
set production_approved = true,
    review_status = 'legal_approved',
    reviewed_by = 'cat03-source-reviewer',
    reviewed_at = pg_catalog.now(),
    updated_at = pg_catalog.now()
where source_key in ('open_beauty_facts', 'cosing');

update public.product_categories
set review_status = 'reviewed'
where id in (
  'benzoyl_peroxide', 'cleanser', 'moisturiser_tube',
  'serum', 'spf', 'toner'
);

insert into cat03_test_state (state_key, value_uuid)
select 'primary_batch',
  (pg_temp.cat03_begin_import(
    'cat03.production.obf', 'open_beauty_facts', 2001
  ) ->> 'batch_id')::uuid;

insert into cat03_test_state (state_key, value_uuid)
select 'dependency_batch',
  (pg_temp.cat03_begin_import(
    'cat03.production.cosing', 'cosing', 2
  ) ->> 'batch_id')::uuid;

select pg_temp.cat03_stage_chunk(
  (select value_uuid from cat03_test_state where state_key = 'primary_batch'),
  'cat03.production.obf.chunk.' || chunk.chunk_ordinal::text,
  chunk.chunk_ordinal,
  chunk.first_ordinal,
  (
    select pg_catalog.jsonb_agg(fixture.source_payload order by fixture.ordinal)
    from cat03_product_fixture as fixture
    where fixture.ordinal between chunk.first_ordinal and chunk.last_ordinal
  )
)
from (values
  (1, 1, 500),
  (2, 501, 1000),
  (3, 1001, 1500),
  (4, 1501, 2000),
  (5, 2001, 2001)
) as chunk(chunk_ordinal, first_ordinal, last_ordinal);

select pg_temp.cat03_stage_chunk(
  (select value_uuid from cat03_test_state where state_key = 'dependency_batch'),
  'cat03.production.cosing.chunk.1',
  1,
  1,
  (select pg_catalog.jsonb_agg(source_payload order by ordinal)
   from cat03_ingredient_fixture)
);

select pg_temp.cat03_complete_import(
  (select value_uuid from cat03_test_state where state_key = 'primary_batch'),
  'cat03.production.obf',
  2001
);

select pg_temp.cat03_complete_import(
  (select value_uuid from cat03_test_state where state_key = 'dependency_batch'),
  'cat03.production.cosing',
  2
);

update cat03_product_fixture as fixture
set product_id = product.id,
    staged_record_id = product.import_staged_record_id,
    ingredient_list_id = ingredient_list.id,
    normalized_payload = staged.normalized_payload,
    product_record_sha256 = staged.record_sha256
from public.products as product
join private.catalog_import_staged_records as staged
  on staged.id = product.import_staged_record_id
join public.product_ingredient_lists as ingredient_list
  on ingredient_list.product_id = product.id
where product.import_batch_id = (
    select value_uuid from cat03_test_state where state_key = 'primary_batch'
  )
  and product.barcode = fixture.barcode;

update cat03_ingredient_fixture as fixture
set ingredient_id = ingredient.id,
    staged_record_id = ingredient.import_staged_record_id,
    ingredient_record_sha256 = ingredient.import_record_sha256
from public.ingredients as ingredient
where ingredient.import_batch_id = (
    select value_uuid from cat03_test_state where state_key = 'dependency_batch'
  )
  and ingredient.inci_name = fixture.source_payload ->> 'inciName';

insert into cat03_test_state (state_key, value_uuid)
values ('brand_id', gen_random_uuid());

insert into public.brands (
  id, normalized_name, display_name, source_id, review_status
)
select
  state.value_uuid,
  private.catalog_import_normalize_label('CAT-03 Brand'),
  'CAT-03 Brand',
  source.id,
  'reviewed'
from cat03_test_state as state
cross join public.catalog_sources as source
where state.state_key = 'brand_id'
  and source.source_key = 'open_beauty_facts';

update public.products as product
set brand_id = (select value_uuid from cat03_test_state where state_key = 'brand_id'),
    category_id = fixture.category_id,
    review_status = case when fixture.ordinal = 2001
      then 'needs_review' else 'reviewed' end,
    data_quality_score = case when fixture.ordinal = 2001 then 50 else 99 end,
    ingredient_quality_score = case when fixture.ordinal = 2001 then 50 else 99 end,
    barcode_quality_score = case when fixture.ordinal = 2001 then 50 else 99 end,
    category_quality_score = case when fixture.ordinal = 2001 then 50 else 99 end,
    quality_grade = case when fixture.ordinal = 2001 then 'usable' else 'verified' end,
    recommendation_eligible = fixture.ordinal <= 2000,
    ingredient_parse_status = 'reviewed',
    ingredient_parse_confidence = 1,
    last_reviewed_at = pg_catalog.now()
from cat03_product_fixture as fixture
where product.id = fixture.product_id;

update public.product_barcodes as mapping
set review_status = 'reviewed', confidence = 1
from cat03_product_fixture as fixture
where mapping.product_id = fixture.product_id
  and mapping.barcode = fixture.barcode;

update public.product_ingredient_lists as ingredient_list
set parse_status = 'reviewed',
    parse_confidence = 1,
    token_count = 2,
    unmatched_count = 0,
    review_status = 'reviewed'
from cat03_product_fixture as fixture
where ingredient_list.id = fixture.ingredient_list_id;

update public.ingredients as ingredient
set review_status = 'reviewed', ingredient_quality_score = 99
from cat03_ingredient_fixture as fixture
where ingredient.id = fixture.ingredient_id;

insert into public.product_ingredient_tokens (
  id, ingredient_list_id, product_id, ingredient_id, position,
  raw_token, normalized_token, section, match_type,
  match_confidence, is_unmatched, source_id
)
select
  gen_random_uuid(),
  product.ingredient_list_id,
  product.product_id,
  ingredient.ingredient_id,
  ingredient.ordinal,
  ingredient.source_payload ->> 'inciName',
  private.catalog_import_normalize_key(
    ingredient.source_payload ->> 'inciName'
  ),
  'main',
  'exact',
  1,
  false,
  source.id
from cat03_product_fixture as product
cross join cat03_ingredient_fixture as ingredient
cross join public.catalog_sources as source
where source.source_key = 'cosing';

insert into public.product_ingredients (
  product_id, ingredient_id, position, ingredient_list_id, source_id,
  raw_token, normalized_token, match_type, match_confidence,
  is_unmatched, parser_version
)
select
  product.product_id,
  ingredient.ingredient_id,
  ingredient.ordinal,
  product.ingredient_list_id,
  source.id,
  ingredient.source_payload ->> 'inciName',
  private.catalog_import_normalize_key(
    ingredient.source_payload ->> 'inciName'
  ),
  'exact',
  1,
  false,
  'phase4-obf-transform-v2'
from cat03_product_fixture as product
cross join cat03_ingredient_fixture as ingredient
cross join public.catalog_sources as source
where source.source_key = 'cosing';

insert into cat03_test_state (state_key, value_uuid, value_text)
select 'test_product', fixture.product_id, fixture.barcode
from cat03_product_fixture as fixture
where fixture.ordinal = 1;

insert into cat03_test_state (state_key, value_uuid, value_text)
select 'successor_product', fixture.product_id, fixture.barcode
from cat03_product_fixture as fixture
where fixture.ordinal = 2001;

insert into cat03_test_state (state_key, value_text)
values ('alias_barcode', pg_temp.cat03_gtin14(9001));

-- CAT03-v1 seals every related barcode row but intentionally publishes only
-- products.barcode.  This reviewed alias is adversarial evidence that neither
-- membership, authenticated RLS, nor service lookup treats an alias as the
-- primary identity.
insert into public.product_barcodes (
  barcode, product_id, source_id, confidence, review_status
)
select
  alias.value_text,
  product.id,
  product.source_id,
  1,
  'reviewed'
from cat03_test_state as alias
cross join public.products as product
where alias.state_key = 'alias_barcode'
  and product.id = (
    select state.value_uuid from cat03_test_state as state
    where state.state_key = 'test_product'
  );

select pg_catalog.set_config(
  'app.cat03_test_product_id',
  (select value_uuid::text from cat03_test_state where state_key = 'test_product'),
  true
);
select pg_catalog.set_config(
  'app.cat03_successor_product_id',
  (select value_uuid::text from cat03_test_state where state_key = 'successor_product'),
  true
);
select pg_catalog.set_config(
  'app.cat03_test_barcode',
  (select value_text from cat03_test_state where state_key = 'test_product'),
  true
);
select pg_catalog.set_config(
  'app.cat03_successor_barcode',
  (select value_text from cat03_test_state where state_key = 'successor_product'),
  true
);
select pg_catalog.set_config(
  'app.cat03_alias_barcode',
  (select value_text from cat03_test_state where state_key = 'alias_barcode'),
  true
);

create temp table cat03_planned_records (
  campaign_id uuid not null,
  ordinal integer not null,
  record_id uuid not null,
  product_id uuid not null,
  source_id uuid not null,
  import_batch_id uuid not null,
  import_staged_record_id uuid not null,
  product_record_sha256 text not null,
  cat02_stage_record_sha256 text not null,
  cat02_database_normalized_record_sha256 text not null,
  source_approval_sha256 text not null,
  source_qa_sha256 text not null,
  served_state_mutation_root_sha256 text not null,
  dependency_memberships jsonb not null,
  cat02_membership_readback_sha256 text not null,
  cat02_membership_proof_sha256 text,
  cat02_database_observation_sha256 text,
  cat02_verifier_signature_set_sha256 text,
  cat02_production_integrity_set_sha256 text,
  curation_outcome_reviewer_signature_set_sha256 text,
  category_code text not null,
  barcode text not null,
  ingredient_list_id uuid not null,
  product_snapshot_sha256 text not null,
  dependency_sha256 text not null,
  manifest_entry_sha256 text not null,
  demand_priority_rank integer,
  demand_priority_commitment_sha256 text,
  regulatory_classification text not null,
  regulatory_review_evidence_sha256 text,
  regulatory_signature_set_sha256 text not null,
  activation_decision text not null,
  activation_planned_at timestamptz,
  offline_base_sealed_record_sha256 text not null,
  database_base_record_sha256 text not null,
  reviewed_record_mapping_sha256 text not null,
  database_activation_request_sha256 text,
  activation_signature_sha256 text,
  reviewer_signature_set_sha256 text not null,
  curation_record_sha256 text not null,
  primary key (campaign_id, product_id)
);

create or replace function pg_temp.cat03_artifact_sets()
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
  select pg_catalog.jsonb_agg(
    pg_catalog.jsonb_build_object(
      'batchId', batch.id,
      'batchEvidenceSha256',
        private.catalog_import_batch_evidence_sha256(batch.id),
      'recordsArtifactSha256', batch.records_sha256,
      'candidatesArtifactSha256', batch.candidates_sha256,
      'stageEnvelopeSha256',
        private.catalog_import_sha256_text('cat03-stage:' || batch.id::text),
      'databaseReceiptCompletionSha256',
        private.catalog_import_sha256_text('cat03-db-completion:' || batch.id::text),
      'promotionReceiptSha256',
        private.catalog_import_sha256_text('cat03-promotion:' || batch.id::text),
      'qaReportSha256', batch.qa_report_sha256,
      'artifactKind', batch.artifact_kind,
      'productionIntegrityEvidenceSha256',
        private.catalog_launch_curation_production_integrity_evidence_sha256(
          batch.id
        )
    ) order by batch.id
  )
  from public.catalog_import_batches as batch
  where batch.id in (
    select state.value_uuid
    from pg_temp.cat03_test_state as state
    where state.state_key in ('primary_batch', 'dependency_batch')
  )
$$;

create or replace function pg_temp.cat03_prepare_campaign(
  p_campaign_id uuid,
  p_release_id text,
  p_insert_records boolean default true
)
returns void
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v_product record;
  v_primary_batch public.catalog_import_batches%rowtype;
  v_secondary_batch public.catalog_import_batches%rowtype;
  v_artifact_sets jsonb := pg_temp.cat03_artifact_sets();
  v_primary_artifact jsonb;
  v_secondary_artifact jsonb;
  v_contributing_batch_ids uuid[];
  v_signed_policy text := private.catalog_import_sha256_text('cat03-signed-policy');
  v_policy text;
  v_beta text := private.catalog_import_sha256_text('cat03-beta:' || p_release_id);
  v_campaign_authority text :=
    private.catalog_import_sha256_text('cat03-campaign-authority:' || p_release_id);
  v_reviewer_ids text[] := array['cat03.catalog.quality', 'cat03.data.quality'];
  v_reviewer_evidence text[] := array[
    private.catalog_import_sha256_text('cat03-catalog-evidence'),
    private.catalog_import_sha256_text('cat03-data-evidence')
  ];
  v_database_review_signatures jsonb := pg_catalog.jsonb_build_array(
    pg_catalog.jsonb_build_object(
      'decisionRole', 'catalog_quality_reviewer',
      'reviewerId', 'cat03.catalog.quality',
      'trustRegistryKeyId', 'cat03-catalog-key',
      'algorithm', 'Ed25519',
      'signedAt', '2026-07-15T00:00:00.000Z',
      'valueBase64', 'Y2F0MDMtY2F0YWxvZy1zaWduYXR1cmU='
    ),
    pg_catalog.jsonb_build_object(
      'decisionRole', 'data_quality_reviewer',
      'reviewerId', 'cat03.data.quality',
      'trustRegistryKeyId', 'cat03-data-key',
      'algorithm', 'Ed25519',
      'signedAt', '2026-07-15T00:00:00.000Z',
      'valueBase64', 'Y2F0MDMtZGF0YS1zaWduYXR1cmU='
    ),
    pg_catalog.jsonb_build_object(
      'decisionRole', 'regulatory_reviewer',
      'reviewerId', 'cat03.regulatory.reviewer',
      'trustRegistryKeyId', 'cat03-regulatory-key',
      'algorithm', 'Ed25519',
      'signedAt', '2026-07-15T00:00:00.000Z',
      'valueBase64', 'Y2F0MDMtcmVndWxhdG9yeS1zaWduYXR1cmU='
    ),
    pg_catalog.jsonb_build_object(
      'decisionRole', 'privacy_release_verifier',
      'reviewerId', 'cat03.privacy.release',
      'trustRegistryKeyId', 'cat03-privacy-key',
      'algorithm', 'Ed25519',
      'signedAt', '2026-07-15T00:00:00.000Z',
      'valueBase64', 'Y2F0MDMtcHJpdmFjeS1zaWduYXR1cmU='
    )
  );
  v_outcome_reviewer_signature_set text := private.catalog_import_sha256_text(
    private.catalog_import_canonical_json(
      pg_catalog.jsonb_build_object(
        'contractId', 'catalog-curation-outcome-reviewer-signature-set-v1',
        'signatures', v_database_review_signatures
      )
    )
  );
  v_campaign_reviewer_signature text := private.catalog_import_sha256_text(
    private.catalog_import_canonical_json(
      pg_catalog.jsonb_build_object(
        'contractId', 'catalog-curation-database-reviewer-signature-set-v1',
        'signatures', pg_catalog.jsonb_build_array(
          v_database_review_signatures -> 0,
          v_database_review_signatures -> 1
        )
      )
    )
  );
  v_record_reviewer_signature text := private.catalog_import_sha256_text(
    private.catalog_import_canonical_json(
      pg_catalog.jsonb_build_object(
        'contractId', 'catalog-curation-record-reviewer-signature-set-v1',
        'signatures', pg_catalog.jsonb_build_array(
          v_database_review_signatures -> 0,
          v_database_review_signatures -> 1
        )
      )
    )
  );
  v_regulatory_signature text := private.catalog_import_sha256_text(
    private.catalog_import_canonical_json(
      pg_catalog.jsonb_build_object(
        'contractId', 'catalog-curation-regulatory-signature-set-v1',
        'signatures', pg_catalog.jsonb_build_array(
          v_database_review_signatures -> 2
        )
      )
    )
  );
  v_activation_signature text;
  v_activation_planned_at timestamptz := '2026-07-16T00:00:00.000Z';
  v_review_valid_until timestamptz := '2099-01-01T00:00:00.000Z';
  v_snapshot text;
  v_dependency text;
  v_mutation_root text;
  v_mutation_root_set text;
  v_regulatory_evidence text;
  v_memberships jsonb;
  v_membership_readback text;
  v_primary_database_normalized text;
  v_database_base text;
  v_offline_base text;
  v_mapping text;
  v_request text;
  v_curation text;
  v_record_set text;
  v_authorization_set text;
  v_membership_set text;
  v_membership_proof text;
  v_database_observation text;
  v_verifier_signature_set text;
  v_production_integrity_set text;
  v_manifest text;
  v_campaign_sha text;
  v_activation_decision text;
  v_rank integer;
  v_commitment text;
begin
  select batch.* into strict v_primary_batch
  from public.catalog_import_batches as batch
  where batch.id = (
    select state.value_uuid from pg_temp.cat03_test_state as state
    where state.state_key = 'primary_batch'
  );
  select batch.* into strict v_secondary_batch
  from public.catalog_import_batches as batch
  where batch.id = (
    select state.value_uuid from pg_temp.cat03_test_state as state
    where state.state_key = 'dependency_batch'
  );
  select pg_catalog.array_agg(batch_id order by batch_id)
    into strict v_contributing_batch_ids
  from pg_catalog.unnest(array[
    v_primary_batch.id, v_secondary_batch.id
  ]) as batch(batch_id);
  select artifact.value into strict v_primary_artifact
  from pg_catalog.jsonb_array_elements(v_artifact_sets) as artifact(value)
  where artifact.value ->> 'batchId' = v_primary_batch.id::text;
  select artifact.value into strict v_secondary_artifact
  from pg_catalog.jsonb_array_elements(v_artifact_sets) as artifact(value)
  where artifact.value ->> 'batchId' = v_secondary_batch.id::text;
  v_policy := private.catalog_launch_curation_target_policy_sha256(
    'verified', 95, 95, 95, 95, 0.98, 0.98, 1
  );
  delete from cat03_planned_records where campaign_id = p_campaign_id;

  for v_product in
    select fixture.*, product.source_id
    from cat03_product_fixture as fixture
    join public.products as product on product.id = fixture.product_id
    order by fixture.ordinal
  loop
    v_snapshot :=
      private.catalog_launch_curation_product_snapshot_sha256(v_product.product_id);
    v_dependency := private.catalog_launch_curation_dependency_sha256(
      v_product.product_id, v_product.ingredient_list_id
    );
    v_mutation_root :=
      private.catalog_launch_current_served_state_mutation_root_sha256(
        v_product.product_id
      );
    v_regulatory_evidence := case
      when v_product.regulatory_classification = 'cosmetic' then null
      else private.catalog_import_sha256_text(
        'cat03-regulatory-evidence:' || v_product.product_record_sha256
      )
    end;
    with targets as materialized (
      select
        'barcode_identity'::text as field_scope,
        'barcode'::text as entity_type,
        mapping.import_entity_id::text as entity_id,
        mapping.import_batch_id as batch_id,
        mapping.import_staged_record_id as staged_record_id
      from public.product_barcodes as mapping
      where mapping.product_id = v_product.product_id
        and mapping.barcode = v_product.barcode
      union all
      select
        scope.field_scope,
        'product',
        product.id::text,
        product.import_batch_id,
        product.import_staged_record_id
      from public.products as product
      cross join (values
        ('category'::text),
        ('regulatory_classification'::text)
      ) as scope(field_scope)
      where product.id = v_product.product_id
      union all
      select distinct
        'ingredients',
        'ingredient',
        ingredient.id::text,
        ingredient.import_batch_id,
        ingredient.import_staged_record_id
      from public.product_ingredient_tokens as token
      join public.product_ingredients as link
        on link.product_id = token.product_id
       and link.ingredient_list_id = token.ingredient_list_id
       and link.ingredient_id = token.ingredient_id
       and link.position = token.position
       and link.is_unmatched is false
      join public.ingredients as ingredient on ingredient.id = token.ingredient_id
      where token.product_id = v_product.product_id
        and token.ingredient_list_id = v_product.ingredient_list_id
        and token.is_unmatched is false
    ), authority as materialized (
      select
        target.*,
        staged.record_sha256 as stage_record_sha256,
        revision.projection_sha256,
        batch.source_approval_sha256,
        batch.qa_report_sha256 as source_qa_sha256,
        artifact.value as artifact,
        private.catalog_launch_curation_dependency_entity_sha256(
          v_product.product_record_sha256,
          target.field_scope,
          target.entity_type,
          target.entity_id,
          revision.projection_sha256
        ) as dependency_entity_sha256
      from targets as target
      join private.catalog_import_staged_records as staged
        on staged.id = target.staged_record_id
       and staged.batch_id = target.batch_id
      join private.catalog_import_entity_revisions as revision
        on revision.batch_id = target.batch_id
       and revision.staged_record_id = target.staged_record_id
       and revision.entity_type = target.entity_type
       and revision.entity_id = target.entity_id
       and revision.revision_action = 'inserted'
      join public.catalog_import_batches as batch on batch.id = target.batch_id
      cross join lateral (
        select declared.value
        from pg_catalog.jsonb_array_elements(v_artifact_sets)
          as declared(value)
        where declared.value ->> 'batchId' = target.batch_id::text
      ) as artifact
    ), normalized as materialized (
      select authority.*,
        private.catalog_launch_curation_membership_database_sha256(
          v_product.product_record_sha256,
          authority.field_scope,
          authority.dependency_entity_sha256,
          v_product.barcode,
          v_product.category_code,
          v_snapshot,
          v_dependency,
          v_product.regulatory_classification,
          v_regulatory_evidence,
          array['cat03.regulatory.reviewer']
        ) as database_normalized_sha256
      from authority
    )
    select pg_catalog.jsonb_agg(
      pg_catalog.jsonb_build_object(
        'fieldScope', normalized.field_scope,
        'dependencyEntitySha256', normalized.dependency_entity_sha256,
        'batchId', normalized.batch_id,
        'artifactSetSha256',
          private.catalog_launch_curation_cat02_artifact_sha256(
            normalized.artifact
          ),
        'cat02StageRecordSha256', normalized.stage_record_sha256,
        'cat02DatabaseNormalizedRecordSha256',
          normalized.database_normalized_sha256,
        'sourceApprovalSha256', normalized.source_approval_sha256,
        'sourceQaSha256', normalized.source_qa_sha256,
        'membershipEvidenceSha256',
          private.catalog_launch_curation_membership_evidence_sha256(
            v_product.product_id,
            v_product.ingredient_list_id,
            v_product.barcode,
            v_product.product_record_sha256,
            normalized.field_scope,
            normalized.dependency_entity_sha256,
            normalized.batch_id,
            private.catalog_launch_curation_cat02_artifact_sha256(
              normalized.artifact
            ),
            normalized.stage_record_sha256,
            normalized.database_normalized_sha256,
            normalized.source_approval_sha256,
            normalized.source_qa_sha256
          )
      ) order by normalized.field_scope,
        normalized.dependency_entity_sha256,
        normalized.batch_id
    ) into strict v_memberships
    from normalized;
    v_primary_database_normalized :=
      v_memberships -> 0 ->> 'cat02DatabaseNormalizedRecordSha256';
    v_membership_readback :=
      private.catalog_launch_curation_membership_readback_sha256(
        v_product.product_record_sha256, v_memberships
      );
    v_activation_decision := case
      when p_release_id = 'cat03-successor' and v_product.ordinal >= 2
        then 'approve_activation'
      when p_release_id <> 'cat03-successor' and v_product.ordinal <= 2000
        then 'approve_activation'
      else 'withhold_activation'
    end;
    v_rank := case
      when v_activation_decision <> 'approve_activation' then null
      when p_release_id = 'cat03-successor' then v_product.ordinal - 1
      else v_product.ordinal
    end;
    v_commitment := case when v_rank is null then null else
      private.catalog_import_sha256_text(
        'cat03-priority:' || v_product.product_record_sha256
      ) end;
    v_database_base :=
      private.catalog_launch_curation_database_base_record_sha256(
        p_release_id, v_signed_policy, v_beta, v_policy,
        v_primary_batch.candidates_sha256, v_product.product_id,
        v_product.source_id, v_primary_batch.id, v_product.staged_record_id,
        v_product.product_record_sha256, v_product.product_record_sha256,
        v_primary_database_normalized, v_primary_batch.source_approval_sha256,
        v_primary_batch.qa_report_sha256, v_memberships, v_membership_readback,
        v_product.category_code, v_product.barcode,
        v_product.ingredient_list_id, v_snapshot, v_dependency,
        v_mutation_root,
        v_rank, v_commitment, v_product.regulatory_classification,
        v_regulatory_evidence, array['cat03.regulatory.reviewer'],
        'cat03.curator'
      );
    v_offline_base := private.catalog_import_sha256_text(
      'cat03-offline-authority:' || p_release_id || ':' ||
        v_product.product_record_sha256 || ':' || v_database_base
    );
    v_mapping :=
      private.catalog_launch_curation_reviewed_record_mapping_sha256(
        p_release_id, v_product.product_record_sha256,
        v_mutation_root,
        v_offline_base, v_database_base
      );
    v_request := case when v_activation_decision = 'approve_activation' then
      private.catalog_launch_curation_activation_authorization_sha256(
        p_release_id, v_campaign_authority,
        v_outcome_reviewer_signature_set,
        v_product.product_record_sha256,
        v_mutation_root,
        v_offline_base, v_database_base, v_mapping,
        'cat03.activation.owner',
        'cat03.activate.' || p_release_id || '.' ||
          v_product.product_record_sha256,
        'initial_launch_catalog_activation',
        v_activation_planned_at
      )
      else null
    end;
    -- Model the contract's activationSignatureSha256 exactly: hash the
    -- decoded canonical 64-byte detached-signature payload, not its Base64 or
    -- hex transport representation.
    v_activation_signature := pg_catalog.encode(
      extensions.digest(
        pg_catalog.decode(
          private.catalog_import_sha256_text(
            'cat03-activation-signature-a:' || p_release_id || ':' ||
              v_product.product_record_sha256
          ) ||
          private.catalog_import_sha256_text(
            'cat03-activation-signature-b:' || p_release_id || ':' ||
              v_product.product_record_sha256
          ),
          'hex'
        ),
        'sha256'
      ),
      'hex'
    );
    v_curation := pg_catalog.repeat('0', 64);
    insert into cat03_planned_records (
      campaign_id, ordinal, record_id, product_id, source_id,
      import_batch_id, import_staged_record_id, product_record_sha256,
      cat02_stage_record_sha256, cat02_database_normalized_record_sha256,
      source_approval_sha256, source_qa_sha256,
      served_state_mutation_root_sha256, dependency_memberships,
      cat02_membership_readback_sha256,
      curation_outcome_reviewer_signature_set_sha256,
      category_code, barcode,
      ingredient_list_id, product_snapshot_sha256, dependency_sha256,
      manifest_entry_sha256, demand_priority_rank,
      demand_priority_commitment_sha256, regulatory_classification,
      regulatory_review_evidence_sha256, regulatory_signature_set_sha256,
      activation_decision, activation_planned_at,
      offline_base_sealed_record_sha256, database_base_record_sha256,
      reviewed_record_mapping_sha256, database_activation_request_sha256,
      activation_signature_sha256, reviewer_signature_set_sha256,
      curation_record_sha256
    ) values (
      p_campaign_id, v_product.ordinal,
      gen_random_uuid(),
      v_product.product_id, v_product.source_id, v_primary_batch.id,
      v_product.staged_record_id, v_product.product_record_sha256,
      v_product.product_record_sha256, v_primary_database_normalized,
      v_primary_batch.source_approval_sha256, v_primary_batch.qa_report_sha256,
      v_mutation_root, v_memberships, v_membership_readback,
      v_outcome_reviewer_signature_set, v_product.category_code,
      v_product.barcode, v_product.ingredient_list_id, v_snapshot, v_dependency,
      v_offline_base, v_rank, v_commitment,
      v_product.regulatory_classification, v_regulatory_evidence,
      v_regulatory_signature, v_activation_decision,
      case when v_activation_decision = 'approve_activation'
        then v_activation_planned_at else null end,
      v_offline_base, v_database_base, v_mapping, v_request,
      case when v_activation_decision = 'approve_activation'
        then v_activation_signature else null end,
      v_record_reviewer_signature, v_curation
    );
  end loop;

  select private.catalog_launch_curation_cat02_membership_set_sha256(
    pg_catalog.jsonb_agg(
      pg_catalog.jsonb_build_object(
        'productRecordSha256', planned.product_record_sha256
      ) || membership.value
      order by planned.product_record_sha256,
        membership.value ->> 'fieldScope',
        membership.value ->> 'dependencyEntitySha256',
        membership.value ->> 'batchId'
    )
  ) into strict v_membership_set
  from cat03_planned_records as planned
  cross join lateral pg_catalog.jsonb_array_elements(
    planned.dependency_memberships
  ) as membership(value)
  where planned.campaign_id = p_campaign_id;

  select private.catalog_launch_curation_served_state_mutation_root_set_sha256(
    pg_catalog.jsonb_agg(
      pg_catalog.jsonb_build_object(
        'productRecordSha256', planned.product_record_sha256,
        'servedStateMutationRootSha256',
          planned.served_state_mutation_root_sha256
      ) order by planned.product_record_sha256 collate pg_catalog."C"
    )
  ) into strict v_mutation_root_set
  from cat03_planned_records as planned
  where planned.campaign_id = p_campaign_id;

  v_production_integrity_set :=
    private.catalog_launch_curation_cat02_production_integrity_set_sha256(
      v_artifact_sets
    );
  v_database_observation := private.catalog_import_sha256_text(
    private.catalog_import_canonical_json(
      pg_catalog.jsonb_build_object(
        'projectRefSha256', private.catalog_import_sha256_text('cat03-project'),
        'schemaMigrationVersion', '20260717000058',
        'schemaMigrationSha256', private.catalog_import_sha256_text('cat03-0058'),
        'verificationQuerySha256',
          private.catalog_import_sha256_text('cat03-membership-query-v2'),
        'observationMode', 'live_database_exact_set_receipt',
        'observedArtifactSetSha256',
          private.catalog_launch_curation_cat02_artifact_set_sha256(
            v_artifact_sets
          ),
        'observedMembershipSetSha256', v_membership_set,
        'observedServedStateMutationRootSetSha256', v_mutation_root_set,
        'observedProductionIntegritySetSha256',
          v_production_integrity_set,
        'capturedAt', '2026-07-17T00:00:00.000Z',
        'promotedBatchCount', pg_catalog.jsonb_array_length(v_artifact_sets),
        'membershipRowCount', (
          select pg_catalog.sum(
            pg_catalog.jsonb_array_length(planned.dependency_memberships)
          )::integer
          from cat03_planned_records as planned
          where planned.campaign_id = p_campaign_id
        ),
        'missingMembershipCount', 0,
        'extraMembershipCount', 0,
        'mismatchedMembershipCount', 0,
        'allBatchesLivePromoted', true,
        'allBatchesProductionIntegrityVerified', true
      )
    )
  );
  v_verifier_signature_set := private.catalog_import_sha256_text(
    private.catalog_import_canonical_json(
      pg_catalog.jsonb_build_object(
        'contractId',
          'catalog-cat02-membership-verifier-signature-set-v1',
        'signatures', pg_catalog.jsonb_build_array(
          pg_catalog.jsonb_build_object(
            'decisionRole', 'cat02_database_membership_verifier',
            'reviewerId', 'cat03.cat02.verifier',
            'trustRegistryKeyId', 'cat03-cat02-verifier-key',
            'algorithm', 'Ed25519',
            'signedAt', '2026-07-17T00:00:00.000Z',
            'valueBase64', 'Y2F0MDMtY2F0MDItdmVyaWZpZXI='
          )
        )
      )
    )
  );
  v_membership_proof := private.catalog_import_sha256_text(
    private.catalog_import_canonical_json(
      pg_catalog.jsonb_build_object(
        'contractId', 'catalog-cat02-membership-proof-bridge-v1',
        'releaseId', p_release_id,
        'artifactSetSha256',
          private.catalog_launch_curation_cat02_artifact_set_sha256(
            v_artifact_sets
          ),
        'membershipSetSha256', v_membership_set,
        'databaseObservationSha256', v_database_observation,
        'verifierSignatureSetSha256', v_verifier_signature_set,
        'productionIntegritySetSha256', v_production_integrity_set
      )
    )
  );

  update cat03_planned_records as planned
  set cat02_membership_proof_sha256 = v_membership_proof,
      cat02_database_observation_sha256 = v_database_observation,
      cat02_verifier_signature_set_sha256 = v_verifier_signature_set,
      cat02_production_integrity_set_sha256 = v_production_integrity_set,
      curation_record_sha256 =
        private.catalog_launch_curation_record_sha256(
          planned.offline_base_sealed_record_sha256,
          planned.database_base_record_sha256,
          planned.reviewed_record_mapping_sha256,
          planned.served_state_mutation_root_sha256,
          v_membership_proof,
          v_database_observation,
          v_verifier_signature_set,
          v_production_integrity_set,
          v_outcome_reviewer_signature_set,
          planned.regulatory_review_evidence_sha256,
          array['cat03.regulatory.reviewer'],
          planned.regulatory_signature_set_sha256,
          v_reviewer_evidence,
          planned.reviewer_signature_set_sha256,
          planned.activation_decision,
          'cat03.activation.owner',
          planned.activation_planned_at,
          planned.database_activation_request_sha256,
          planned.activation_signature_sha256
        )
  where planned.campaign_id = p_campaign_id;

  select private.catalog_launch_curation_record_set_sha256(
    p_release_id,
    pg_catalog.jsonb_agg(
      pg_catalog.jsonb_build_object(
        'productRecordSha256', planned.product_record_sha256,
        'cat02StageRecordSha256', planned.cat02_stage_record_sha256,
        'cat02DatabaseNormalizedRecordSha256',
          planned.cat02_database_normalized_record_sha256,
        'sourceApprovalSha256', planned.source_approval_sha256,
        'sourceQaSha256', planned.source_qa_sha256,
        'servedStateMutationRootSha256',
          planned.served_state_mutation_root_sha256,
        'cat02MembershipReadbackSha256',
          planned.cat02_membership_readback_sha256,
        'offlineBaseSealedRecordSha256',
          planned.offline_base_sealed_record_sha256,
        'databaseBaseRecordSha256', planned.database_base_record_sha256,
        'reviewedRecordMappingSha256',
          planned.reviewed_record_mapping_sha256,
        'curationRecordSha256', planned.curation_record_sha256,
        'manifestEntrySha256', planned.manifest_entry_sha256,
        'databaseActivationRequestSha256',
          planned.database_activation_request_sha256,
        'activationSignatureSha256', planned.activation_signature_sha256
      ) order by planned.product_record_sha256, planned.record_id
    )
  ) into strict v_record_set
  from cat03_planned_records as planned
  where planned.campaign_id = p_campaign_id;

  select private.catalog_launch_curation_authorization_set_sha256(
    pg_catalog.jsonb_agg(
      pg_catalog.jsonb_build_object(
        'productRecordSha256', planned.product_record_sha256,
        'requestSha256', planned.database_activation_request_sha256
      ) order by planned.product_record_sha256, planned.record_id
    ) filter (where planned.activation_decision = 'approve_activation')
  ) into strict v_authorization_set
  from cat03_planned_records as planned
  where planned.campaign_id = p_campaign_id;

  select private.catalog_import_sha256_text(
    private.catalog_import_canonical_json(
      pg_catalog.jsonb_build_object(
        'contractId', 'catalog-launch-curation-offline-manifest-v1',
        'records', pg_catalog.jsonb_agg(
          pg_catalog.jsonb_build_object(
            'productRecordSha256', planned.product_record_sha256,
            'manifestEntrySha256', planned.manifest_entry_sha256
          ) order by planned.product_record_sha256
        )
      )
    )
  ) into strict v_manifest
  from cat03_planned_records as planned
  where planned.campaign_id = p_campaign_id;

  v_campaign_sha := private.catalog_launch_curation_campaign_sha256(
    p_release_id, v_campaign_authority, v_primary_batch.id,
    private.catalog_import_batch_evidence_sha256(v_primary_batch.id),
    v_primary_batch.records_sha256, v_primary_batch.candidates_sha256,
    private.catalog_launch_curation_cat02_artifact_set_sha256(v_artifact_sets),
    v_membership_set, v_membership_proof, v_database_observation,
    v_verifier_signature_set, v_production_integrity_set,
    v_outcome_reviewer_signature_set,
    v_contributing_batch_ids,
    private.catalog_launch_curation_contributing_batch_set_sha256(v_artifact_sets),
    v_signed_policy, v_policy, v_beta, v_manifest,
    private.catalog_import_sha256_text('cat03-trust-registry'),
    private.catalog_import_sha256_text('cat03-consent-state'),
    v_review_valid_until, 2001, 2000, 2000,
    '{"acne_treatment":333,"cleanser":334,"moisturizer":333,"serum":334,"sunscreen":333,"toner":333}'::jsonb,
    v_record_set, v_mutation_root_set, v_authorization_set, v_reviewer_ids,
    v_reviewer_evidence, v_campaign_reviewer_signature,
    'cat03.activation.owner'
  );

  insert into private.catalog_launch_curation_campaigns (
    id, operation_key, release_id, campaign_authority_sha256,
    import_batch_id, import_batch_evidence_sha256,
    import_records_sha256, import_candidates_sha256,
    cat02_artifact_sets, cat02_artifact_set_sha256,
    cat02_membership_set_sha256, cat02_membership_proof_sha256,
    cat02_database_observation_sha256,
    cat02_verifier_signature_set_sha256,
    cat02_production_integrity_set_sha256, contributing_batch_ids,
    contributing_batch_set_sha256, required_quality_grade,
    minimum_data_quality_score, minimum_ingredient_quality_score,
    minimum_barcode_quality_score, minimum_category_quality_score,
    minimum_parse_confidence, minimum_token_match_confidence,
    minimum_mapped_ingredient_count, signed_target_policy_sha256,
    eligibility_policy_sha256, beta_corpus_sha256,
    curation_manifest_sha256, trust_registry_sha256,
    corpus_consent_state_sha256, review_valid_until,
    expected_reviewed_record_count, expected_eligible_record_count,
    expected_prioritized_eligible_record_count,
    required_category_eligible_floors, expected_record_set_sha256,
    served_state_mutation_root_set_sha256,
    activation_authorization_set_sha256,
    curation_outcome_reviewer_signature_set_sha256, reviewer_ids,
    reviewer_evidence_sha256s, reviewer_signature_set_sha256,
    created_by, campaign_sha256
  ) values (
    p_campaign_id, 'cat03.campaign.' || p_release_id, p_release_id,
    v_campaign_authority, v_primary_batch.id,
    private.catalog_import_batch_evidence_sha256(v_primary_batch.id),
    v_primary_batch.records_sha256, v_primary_batch.candidates_sha256,
    v_artifact_sets,
    private.catalog_launch_curation_cat02_artifact_set_sha256(v_artifact_sets),
    v_membership_set, v_membership_proof, v_database_observation,
    v_verifier_signature_set, v_production_integrity_set,
    v_contributing_batch_ids,
    private.catalog_launch_curation_contributing_batch_set_sha256(v_artifact_sets),
    'verified', 95, 95, 95, 95, 0.98, 0.98, 1,
    v_signed_policy, v_policy, v_beta, v_manifest,
    private.catalog_import_sha256_text('cat03-trust-registry'),
    private.catalog_import_sha256_text('cat03-consent-state'),
    v_review_valid_until, 2001, 2000, 2000,
    '{"acne_treatment":333,"cleanser":334,"moisturizer":333,"serum":334,"sunscreen":333,"toner":333}'::jsonb,
    v_record_set, v_mutation_root_set, v_authorization_set,
    v_outcome_reviewer_signature_set, v_reviewer_ids,
    v_reviewer_evidence, v_campaign_reviewer_signature,
    'cat03.activation.owner', v_campaign_sha
  );

  if p_insert_records then
    insert into private.catalog_launch_curation_records (
      id, campaign_id, product_id, source_id, import_batch_id,
      import_staged_record_id, product_record_sha256,
      cat02_stage_record_sha256, cat02_database_normalized_record_sha256,
      source_approval_sha256, source_qa_sha256,
      served_state_mutation_root_sha256, dependency_memberships,
      cat02_membership_readback_sha256,
      cat02_membership_proof_sha256,
      cat02_database_observation_sha256,
      cat02_verifier_signature_set_sha256,
      cat02_production_integrity_set_sha256,
      curation_outcome_reviewer_signature_set_sha256,
      category_code, barcode,
      ingredient_list_id, product_snapshot_sha256, dependency_sha256,
      manifest_entry_sha256, demand_priority_rank,
      demand_priority_commitment_sha256, signed_target_policy_sha256,
      eligibility_policy_sha256, regulatory_classification,
      regulatory_review_evidence_sha256, regulatory_reviewer_ids,
      regulatory_signature_set_sha256, activation_decision,
      activation_operator_id, activation_planned_at,
      offline_base_sealed_record_sha256, database_base_record_sha256,
      reviewed_record_mapping_sha256, database_activation_request_sha256,
      activation_signature_sha256, reviewer_evidence_sha256s,
      reviewer_signature_set_sha256, curated_by, curation_record_sha256
    )
    select
      planned.record_id, planned.campaign_id, planned.product_id,
      planned.source_id, planned.import_batch_id,
      planned.import_staged_record_id, planned.product_record_sha256,
      planned.cat02_stage_record_sha256,
      planned.cat02_database_normalized_record_sha256,
      planned.source_approval_sha256, planned.source_qa_sha256,
      planned.served_state_mutation_root_sha256,
      planned.dependency_memberships,
      planned.cat02_membership_readback_sha256,
      planned.cat02_membership_proof_sha256,
      planned.cat02_database_observation_sha256,
      planned.cat02_verifier_signature_set_sha256,
      planned.cat02_production_integrity_set_sha256,
      planned.curation_outcome_reviewer_signature_set_sha256,
      planned.category_code,
      planned.barcode, planned.ingredient_list_id,
      planned.product_snapshot_sha256, planned.dependency_sha256,
      planned.manifest_entry_sha256, planned.demand_priority_rank,
      planned.demand_priority_commitment_sha256, v_signed_policy, v_policy,
      planned.regulatory_classification,
      planned.regulatory_review_evidence_sha256,
      array['cat03.regulatory.reviewer'],
      planned.regulatory_signature_set_sha256,
      planned.activation_decision, 'cat03.activation.owner',
      planned.activation_planned_at,
      planned.offline_base_sealed_record_sha256,
      planned.database_base_record_sha256,
      planned.reviewed_record_mapping_sha256,
      planned.database_activation_request_sha256,
      planned.activation_signature_sha256, v_reviewer_evidence,
      planned.reviewer_signature_set_sha256, 'cat03.curator',
      planned.curation_record_sha256
    from cat03_planned_records as planned
    where planned.campaign_id = p_campaign_id
    order by planned.product_record_sha256;
  end if;
end;
$$;

create or replace function pg_temp.cat03_insert_planned_records(
  p_campaign_id uuid
)
returns void
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v_signed_policy text := private.catalog_import_sha256_text(
    'cat03-signed-policy'
  );
  v_policy text := private.catalog_launch_curation_target_policy_sha256(
    'verified', 95, 95, 95, 95, 0.98, 0.98, 1
  );
  v_reviewer_evidence text[] := array[
    private.catalog_import_sha256_text('cat03-catalog-evidence'),
    private.catalog_import_sha256_text('cat03-data-evidence')
  ];
begin
  insert into private.catalog_launch_curation_records (
    id, campaign_id, product_id, source_id, import_batch_id,
    import_staged_record_id, product_record_sha256,
    cat02_stage_record_sha256, cat02_database_normalized_record_sha256,
    source_approval_sha256, source_qa_sha256,
    served_state_mutation_root_sha256, dependency_memberships,
    cat02_membership_readback_sha256,
    cat02_membership_proof_sha256,
    cat02_database_observation_sha256,
    cat02_verifier_signature_set_sha256,
    cat02_production_integrity_set_sha256,
    curation_outcome_reviewer_signature_set_sha256,
    category_code, barcode,
    ingredient_list_id, product_snapshot_sha256, dependency_sha256,
    manifest_entry_sha256, demand_priority_rank,
    demand_priority_commitment_sha256, signed_target_policy_sha256,
    eligibility_policy_sha256, regulatory_classification,
    regulatory_review_evidence_sha256, regulatory_reviewer_ids,
    regulatory_signature_set_sha256, activation_decision,
    activation_operator_id, activation_planned_at,
    offline_base_sealed_record_sha256, database_base_record_sha256,
    reviewed_record_mapping_sha256, database_activation_request_sha256,
    activation_signature_sha256, reviewer_evidence_sha256s,
    reviewer_signature_set_sha256, curated_by, curation_record_sha256
  )
  select
    planned.record_id, planned.campaign_id, planned.product_id,
    planned.source_id, planned.import_batch_id,
    planned.import_staged_record_id, planned.product_record_sha256,
    planned.cat02_stage_record_sha256,
    planned.cat02_database_normalized_record_sha256,
    planned.source_approval_sha256, planned.source_qa_sha256,
    planned.served_state_mutation_root_sha256,
    planned.dependency_memberships,
    planned.cat02_membership_readback_sha256,
    planned.cat02_membership_proof_sha256,
    planned.cat02_database_observation_sha256,
    planned.cat02_verifier_signature_set_sha256,
    planned.cat02_production_integrity_set_sha256,
    planned.curation_outcome_reviewer_signature_set_sha256,
    planned.category_code, planned.barcode, planned.ingredient_list_id,
    planned.product_snapshot_sha256, planned.dependency_sha256,
    planned.manifest_entry_sha256, planned.demand_priority_rank,
    planned.demand_priority_commitment_sha256, v_signed_policy, v_policy,
    planned.regulatory_classification,
    planned.regulatory_review_evidence_sha256,
    array['cat03.regulatory.reviewer'],
    planned.regulatory_signature_set_sha256,
    planned.activation_decision, 'cat03.activation.owner',
    planned.activation_planned_at,
    planned.offline_base_sealed_record_sha256,
    planned.database_base_record_sha256,
    planned.reviewed_record_mapping_sha256,
    planned.database_activation_request_sha256,
    planned.activation_signature_sha256, v_reviewer_evidence,
    planned.reviewer_signature_set_sha256, 'cat03.curator',
    planned.curation_record_sha256
  from cat03_planned_records as planned
  where planned.campaign_id = p_campaign_id
  order by planned.product_record_sha256;
end;
$$;

create or replace function pg_temp.cat03_stage_product(
  p_campaign_id uuid,
  p_product_id uuid
)
returns jsonb
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v_result jsonb;
begin
  select pg_catalog.to_jsonb(activation)
    into strict v_result
  from private.catalog_launch_curation_records as record
  join private.catalog_launch_curation_campaigns as campaign
    on campaign.id = record.campaign_id
  cross join lateral public.activate_catalog_launch_curation(
    record.id,
    'cat03.activate.' || campaign.release_id || '.' ||
      record.product_record_sha256,
    'cat03.activation.owner',
    'initial_launch_catalog_activation',
    record.curation_record_sha256,
    record.database_activation_request_sha256,
    record.activation_signature_sha256
  ) as activation
  where record.campaign_id = p_campaign_id
    and record.product_id = p_product_id;
  return v_result;
end;
$$;

create or replace function pg_temp.cat03_release_campaign(p_campaign_id uuid)
returns jsonb
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v_result jsonb;
begin
  select pg_catalog.to_jsonb(release)
    into strict v_result
  from private.catalog_launch_curation_campaigns as campaign
  cross join lateral public.release_catalog_launch_curation_campaign(
    campaign.id,
    'cat03.release.' || campaign.release_id || '.' ||
      campaign.campaign_authority_sha256,
    'cat03.activation.owner',
    'initial_launch_catalog_release',
    campaign.campaign_sha256,
    campaign.expected_record_set_sha256,
    campaign.served_state_mutation_root_set_sha256,
    campaign.activation_authorization_set_sha256
  ) as release
  where campaign.id = p_campaign_id;
  return v_result;
end;
$$;

create or replace function pg_temp.cat03_retire_campaign(p_campaign_id uuid)
returns jsonb
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v_result jsonb;
begin
  select pg_catalog.to_jsonb(retirement)
    into strict v_result
  from private.catalog_launch_curation_campaigns as campaign
  cross join lateral public.retire_catalog_launch_curation_campaign(
    campaign.id,
    'cat03.retire.' || campaign.release_id,
    'cat03.activation.owner',
    'manual_launch_retirement',
    campaign.campaign_sha256
  ) as retirement
  where campaign.id = p_campaign_id;
  return v_result;
end;
$$;

create or replace function pg_temp.cat03_timezone_hash_vector(
  p_campaign_id uuid
)
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
  select pg_catalog.jsonb_build_object(
    'productSnapshotSha256',
      private.catalog_launch_curation_product_snapshot_sha256(
        record.product_id
      ),
    'dependencySha256',
      private.catalog_launch_curation_dependency_sha256(
        record.product_id, record.ingredient_list_id
      ),
    'campaignSha256',
      private.catalog_launch_curation_campaign_sha256(
        campaign.release_id,
        campaign.campaign_authority_sha256,
        campaign.import_batch_id,
        campaign.import_batch_evidence_sha256,
        campaign.import_records_sha256,
        campaign.import_candidates_sha256,
        campaign.cat02_artifact_set_sha256,
        campaign.cat02_membership_set_sha256,
        campaign.cat02_membership_proof_sha256,
        campaign.cat02_database_observation_sha256,
        campaign.cat02_verifier_signature_set_sha256,
        campaign.cat02_production_integrity_set_sha256,
        campaign.curation_outcome_reviewer_signature_set_sha256,
        campaign.contributing_batch_ids,
        campaign.contributing_batch_set_sha256,
        campaign.signed_target_policy_sha256,
        campaign.eligibility_policy_sha256,
        campaign.beta_corpus_sha256,
        campaign.curation_manifest_sha256,
        campaign.trust_registry_sha256,
        campaign.corpus_consent_state_sha256,
        campaign.review_valid_until,
        campaign.expected_reviewed_record_count,
        campaign.expected_eligible_record_count,
        campaign.expected_prioritized_eligible_record_count,
        campaign.required_category_eligible_floors,
        campaign.expected_record_set_sha256,
        campaign.served_state_mutation_root_set_sha256,
        campaign.activation_authorization_set_sha256,
        campaign.reviewer_ids,
        campaign.reviewer_evidence_sha256s,
        campaign.reviewer_signature_set_sha256,
        campaign.created_by
      ),
    'activationAuthorizationSha256',
      private.catalog_launch_curation_activation_authorization_sha256(
        campaign.release_id,
        campaign.campaign_authority_sha256,
        campaign.curation_outcome_reviewer_signature_set_sha256,
        record.product_record_sha256,
        record.served_state_mutation_root_sha256,
        record.offline_base_sealed_record_sha256,
        record.database_base_record_sha256,
        record.reviewed_record_mapping_sha256,
        record.activation_operator_id,
        'cat03.activate.' || campaign.release_id || '.' ||
          record.product_record_sha256,
        'initial_launch_catalog_activation',
        record.activation_planned_at
      ),
    'curationRecordSha256',
      private.catalog_launch_curation_record_sha256(
        record.offline_base_sealed_record_sha256,
        record.database_base_record_sha256,
        record.reviewed_record_mapping_sha256,
        record.served_state_mutation_root_sha256,
        record.cat02_membership_proof_sha256,
        record.cat02_database_observation_sha256,
        record.cat02_verifier_signature_set_sha256,
        record.cat02_production_integrity_set_sha256,
        record.curation_outcome_reviewer_signature_set_sha256,
        record.regulatory_review_evidence_sha256,
        record.regulatory_reviewer_ids,
        record.regulatory_signature_set_sha256,
        record.reviewer_evidence_sha256s,
        record.reviewer_signature_set_sha256,
        record.activation_decision,
        record.activation_operator_id,
        record.activation_planned_at,
        record.database_activation_request_sha256,
        record.activation_signature_sha256
      ),
    'recordIsValid',
      private.catalog_launch_curation_record_is_valid(record.id),
    'productIsServable',
      private.catalog_product_is_servable(record.product_id),
    'ingredientIsServable',
      private.catalog_ingredient_is_servable((
        select token.ingredient_id
        from public.product_ingredient_tokens as token
        where token.product_id = record.product_id
          and token.ingredient_list_id = record.ingredient_list_id
          and token.ingredient_id is not null
        order by token.position
        limit 1
      )),
    'correctionProjectionSha256', private.catalog_import_sha256_text(
      private.catalog_import_canonical_json(
        private.catalog_launch_correction_serving_projection(
          '{"id":"58000000-0000-4000-8000-000000000099","product_id":"58000000-0000-4000-8000-000000000098","status":"triaged","operator_reviewed_at":"2026-07-17 12:00:00","operator_reviewed_by":"reviewer","operator_review_note":"present"}'::jsonb
        )
      )
    ),
    'mutationEventSha256',
      private.catalog_launch_served_state_mutation_event_sha256(
        '58000000-0000-4000-8000-000000000097'::uuid,
        record.product_id,
        7,
        'served_state_row_mutation',
        'public.products',
        record.product_id::text,
        'UPDATE',
        '2026-07-17 16:00:00+00'::timestamptz,
        pg_catalog.repeat('a', 64),
        pg_catalog.repeat('b', 64),
        pg_catalog.repeat('c', 64)
      )
  )
  from private.catalog_launch_curation_campaigns as campaign
  join private.catalog_launch_curation_records as record
    on record.campaign_id = campaign.id
   and record.activation_decision = 'approve_activation'
  where campaign.id = p_campaign_id
  order by record.product_record_sha256
  limit 1
$$;

create or replace function pg_temp.cat03_publication_seal_mutation_results(
  p_product_id uuid
)
returns jsonb
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v_result jsonb := '{}'::jsonb;
  v_source_id uuid;
  v_brand_id uuid;
  v_ingredient_list_id uuid;
  v_ingredient_id uuid;
  v_ingredient_source_id uuid;
begin
  select product.source_id, product.brand_id
    into strict v_source_id, v_brand_id
  from public.products as product
  where product.id = p_product_id;
  select ingredient_list.id into strict v_ingredient_list_id
  from public.product_ingredient_lists as ingredient_list
  where ingredient_list.product_id = p_product_id
    and ingredient_list.import_projection_status = 'active';
  select token.ingredient_id, ingredient.source_id
    into strict v_ingredient_id, v_ingredient_source_id
  from public.product_ingredient_tokens as token
  join public.ingredients as ingredient on ingredient.id = token.ingredient_id
  where token.product_id = p_product_id
    and token.ingredient_list_id = v_ingredient_list_id
  order by token.position
  limit 1;

  begin
    update public.products
       set default_pao_months = coalesce(default_pao_months, 0) + 1
     where id = p_product_id;
    v_result := v_result || pg_catalog.jsonb_build_object(
      'defaultPaoMutationStillServable',
      private.catalog_product_is_servable(p_product_id)
    );
    raise exception 'CAT03_TEST_ROLLBACK';
  exception when raise_exception then null;
  end;

  begin
    update public.catalog_sources
       set display_name = display_name || ' CAT03 drift'
     where id = v_source_id;
    v_result := v_result || pg_catalog.jsonb_build_object(
      'sourceDisplayMutationStillServable',
      private.catalog_product_is_servable(p_product_id)
    );
    raise exception 'CAT03_TEST_ROLLBACK';
  exception when raise_exception then null;
  end;

  begin
    update public.brands
       set website_url = coalesce(website_url, 'https://example.invalid') ||
         '/cat03-drift'
     where id = v_brand_id;
    v_result := v_result || pg_catalog.jsonb_build_object(
      'brandWebsiteMutationStillServable',
      private.catalog_product_is_servable(p_product_id)
    );
    raise exception 'CAT03_TEST_ROLLBACK';
  exception when raise_exception then null;
  end;

  begin
    update public.ingredients
       set restriction_summary = coalesce(restriction_summary, '') ||
         ' CAT03 drift'
     where id = v_ingredient_id;
    v_result := v_result || pg_catalog.jsonb_build_object(
      'ingredientSafetyMutationStillServable',
      private.catalog_product_is_servable(p_product_id)
    );
    raise exception 'CAT03_TEST_ROLLBACK';
  exception when raise_exception then null;
  end;

  begin
    update public.product_ingredient_tokens
       set raw_token = raw_token || ' CAT03 drift'
     where product_id = p_product_id
       and ingredient_list_id = v_ingredient_list_id
       and position = 1;
    v_result := v_result || pg_catalog.jsonb_build_object(
      'tokenMutationStillServable',
      private.catalog_product_is_servable(p_product_id)
    );
    raise exception 'CAT03_TEST_ROLLBACK';
  exception when raise_exception then null;
  end;

  begin
    delete from public.product_ingredients
     where product_id = p_product_id
       and ingredient_list_id = v_ingredient_list_id
       and position = 1;
    v_result := v_result || pg_catalog.jsonb_build_object(
      'linkDeletionStillServable',
      private.catalog_product_is_servable(p_product_id)
    );
    raise exception 'CAT03_TEST_ROLLBACK';
  exception when raise_exception then null;
  end;

  begin
    insert into public.ingredient_synonyms (
      ingredient_id, synonym, normalized_synonym, source_id, review_status
    ) values (
      v_ingredient_id,
      'CAT03 SEAL ADVERSARIAL ' || p_product_id::text,
      private.catalog_import_normalize_key(
        'CAT03 SEAL ADVERSARIAL ' || p_product_id::text
      ),
      v_ingredient_source_id,
      'reviewed'
    );
    v_result := v_result || pg_catalog.jsonb_build_object(
      'synonymInsertionStillServable',
      private.catalog_product_is_servable(p_product_id)
    );
    raise exception 'CAT03_TEST_ROLLBACK';
  exception when raise_exception then null;
  end;

  begin
    insert into public.product_active_bands (
      product_id, ingredient_id, tag, band, source_basis,
      evidence_note, source_id, review_status
    ) values (
      p_product_id, v_ingredient_id, 'cat03_seal_adversarial', '1-5%',
      'curated_review', 'CAT03 adversarial insertion',
      v_ingredient_source_id, 'reviewed'
    );
    v_result := v_result || pg_catalog.jsonb_build_object(
      'activeBandInsertionStillServable',
      private.catalog_product_is_servable(p_product_id)
    );
    raise exception 'CAT03_TEST_ROLLBACK';
  exception when raise_exception then null;
  end;

  begin
    insert into public.product_pao_expiry (
      product_id, pao_months, pao_source, region, evidence_note,
      source_id, reviewed_by, review_status
    ) values (
      p_product_id, 12, 'catalog', 'US', 'CAT03 adversarial insertion',
      v_source_id, 'cat03.pao.reviewer', 'reviewed'
    );
    v_result := v_result || pg_catalog.jsonb_build_object(
      'paoInsertionStillServable',
      private.catalog_product_is_servable(p_product_id)
    );
    raise exception 'CAT03_TEST_ROLLBACK';
  exception when raise_exception then null;
  end;

  return v_result;
end;
$$;

-- ---------------------------------------------------------------------------
-- Schema, privilege, and execution-boundary contract
-- ---------------------------------------------------------------------------

select is(
  (
    select count(*)
    from pg_catalog.pg_class as relation
    join pg_catalog.pg_namespace as namespace
      on namespace.oid = relation.relnamespace
    where namespace.nspname = 'private'
      and relation.relkind = 'r'
      and relation.relname = any(array[
        'catalog_launch_curation_campaigns',
        'catalog_launch_curation_records',
        'catalog_launch_curation_product_mutations',
        'catalog_launch_curation_events',
        'catalog_launch_curation_heads',
        'catalog_launch_curation_campaign_release_events',
        'catalog_launch_curation_campaign_release_heads'
      ])
  ),
  7::bigint,
  'CAT-03 installs all seven private launch-curation authority relations'
);

select is(
  (
    select count(*)
    from pg_catalog.pg_class as relation
    join pg_catalog.pg_namespace as namespace
      on namespace.oid = relation.relnamespace
    where namespace.nspname = 'private'
      and relation.relname = any(array[
        'catalog_launch_curation_campaigns',
        'catalog_launch_curation_records',
        'catalog_launch_curation_product_mutations',
        'catalog_launch_curation_events',
        'catalog_launch_curation_heads',
        'catalog_launch_curation_campaign_release_events',
        'catalog_launch_curation_campaign_release_heads'
      ])
      and relation.relrowsecurity
      and relation.relforcerowsecurity
  ),
  7::bigint,
  'all seven private authority relations enforce and force RLS'
);

select ok(
  not exists (
    select 1
    from (values ('anon'), ('authenticated'), ('service_role'))
      as role_matrix(role_name)
    cross join (values
      ('catalog_launch_curation_campaigns'),
      ('catalog_launch_curation_records'),
      ('catalog_launch_curation_product_mutations'),
      ('catalog_launch_curation_events'),
      ('catalog_launch_curation_heads'),
      ('catalog_launch_curation_campaign_release_events'),
      ('catalog_launch_curation_campaign_release_heads')
    ) as table_matrix(table_name)
    cross join (values
      ('SELECT'), ('INSERT'), ('UPDATE'), ('DELETE'),
      ('TRUNCATE'), ('REFERENCES'), ('TRIGGER')
    ) as privilege_matrix(privilege_name)
    where pg_catalog.has_table_privilege(
      role_matrix.role_name,
      pg_catalog.format('private.%I', table_matrix.table_name),
      privilege_matrix.privilege_name
    )
  ),
  'PUBLIC inheritance and anon/authenticated/service_role expose no private-table privilege'
);

set local role anon;
select throws_ok(
  $$select count(*) from private.catalog_launch_curation_campaigns$$,
  '42501',
  'permission denied for schema private',
  'anon cannot address a private campaign relation at runtime'
);
reset role;

set local role authenticated;
select throws_ok(
  $$select count(*) from private.catalog_launch_curation_records$$,
  '42501',
  'permission denied for schema private',
  'authenticated cannot address a private record relation at runtime'
);
reset role;

set local role service_role;
select throws_ok(
  $$select count(*) from private.catalog_launch_curation_heads$$,
  '42501',
  'permission denied for schema private',
  'service_role cannot bypass the private authority boundary at runtime'
);
reset role;

select ok(
  not exists (
    select 1
    from (values ('anon'), ('service_role')) as role_matrix(role_name)
    cross join (values
      ('products'),
      ('product_barcodes'),
      ('ingredients'),
      ('ingredient_synonyms'),
      ('ingredient_tag_assignments'),
      ('product_ingredient_lists'),
      ('product_ingredients'),
      ('product_ingredient_tokens'),
      ('product_active_bands'),
      ('product_pao_expiry'),
      ('brands'),
      ('ingredient_tags'),
      ('ingredient_pao_defaults')
    ) as table_matrix(table_name)
    where pg_catalog.has_table_privilege(
      role_matrix.role_name,
      pg_catalog.format('public.%I', table_matrix.table_name),
      'SELECT'
    )
  ),
  'PUBLIC/anon/service_role have no direct SELECT lane to catalog base or child relations'
);

select is(
  (
    select count(*)
    from (values
      ('products'),
      ('product_barcodes'),
      ('ingredients'),
      ('ingredient_synonyms'),
      ('ingredient_tag_assignments'),
      ('product_ingredient_lists'),
      ('product_ingredients'),
      ('product_ingredient_tokens'),
      ('product_active_bands'),
      ('product_pao_expiry'),
      ('brands')
    ) as table_matrix(table_name)
    where pg_catalog.has_table_privilege(
      'authenticated',
      pg_catalog.format('public.%I', table_matrix.table_name),
      'SELECT'
    )
  ),
  11::bigint,
  'authenticated retains SELECT only so positively gated catalog RLS can serve safe rows'
);

select ok(
  not exists (
    select 1
    from (values ('anon'), ('authenticated'), ('service_role'))
      as role_matrix(role_name)
    cross join (values
      ('catalog_sources'),
      ('product_categories'),
      ('ingredient_tag_definitions'),
      ('ingredient_tags'),
      ('ingredient_pao_defaults'),
      ('conflict_rules'),
      ('sequencing_rules'),
      ('creator_stacks'),
      ('creator_stack_items'),
      ('recommendable_catalog_products'),
      ('catalog_servable_products')
    ) as relation_matrix(relation_name)
    where pg_catalog.has_table_privilege(
      role_matrix.role_name,
      pg_catalog.format('public.%I', relation_matrix.relation_name),
      'SELECT'
    )
  )
  and not exists (
    select 1
    from pg_catalog.pg_policy as policy
    where policy.polname in (
      'conflict_rules_read_active',
      'sequencing_rules_read_active',
      'creator_stacks_select_active',
      'creator_stack_items_select_all'
    )
      and policy.polrelid in (
        'public.conflict_rules'::regclass,
        'public.sequencing_rules'::regclass,
        'public.creator_stacks'::regclass,
        'public.creator_stack_items'::regclass
      )
  ),
  'unreviewed source/tag/global clinical authorities and legacy views deny every API role and broad policy'
);

select ok(
  not exists (
    select 1
    from pg_catalog.pg_class as relation
    join pg_catalog.pg_namespace as namespace
      on namespace.oid = relation.relnamespace
    cross join lateral pg_catalog.aclexplode(
      coalesce(
        relation.relacl,
        pg_catalog.acldefault('r', relation.relowner)
      )
    ) as privilege
    where namespace.nspname = 'public'
      and relation.relname = any(array[
        'catalog_sources',
        'product_categories',
        'ingredient_tag_definitions',
        'ingredient_tags',
        'ingredient_pao_defaults',
        'conflict_rules',
        'sequencing_rules',
        'creator_stacks',
        'creator_stack_items',
        'recommendable_catalog_products',
        'catalog_servable_products'
      ])
      and privilege.grantee = 0
      and privilege.privilege_type = 'SELECT'
  ),
  'raw relation ACLs revoke inherited PUBLIC SELECT from every denied catalog/global surface'
);

select ok(
  pg_catalog.has_function_privilege(
    'service_role', 'public.lookup_catalog_product_by_barcode(text)', 'EXECUTE'
  )
    and pg_catalog.has_function_privilege(
      'service_role', 'public.search_catalog_products(text,integer)', 'EXECUTE'
    )
    and not pg_catalog.has_function_privilege(
      'anon', 'public.lookup_catalog_product_by_barcode(text)', 'EXECUTE'
    )
    and not pg_catalog.has_function_privilege(
      'authenticated', 'public.lookup_catalog_product_by_barcode(text)', 'EXECUTE'
    )
    and not pg_catalog.has_function_privilege(
      'anon', 'public.search_catalog_products(text,integer)', 'EXECUTE'
    )
    and not pg_catalog.has_function_privilege(
      'authenticated', 'public.search_catalog_products(text,integer)', 'EXECUTE'
    ),
  'only service_role can execute the bounded lookup and search lanes'
);

select ok(
  not exists (
    select 1
    from (values ('anon'), ('authenticated'), ('service_role'))
      as role_matrix(role_name)
    cross join (values
      ('public.activate_catalog_launch_curation(uuid,text,text,text,text,text,text)'),
      ('public.release_catalog_launch_curation_campaign(uuid,text,text,text,text,text,text,text)'),
      ('public.retire_catalog_launch_curation_campaign(uuid,text,text,text,text)'),
      ('public.retire_catalog_launch_curation(uuid,text,text,text,text)'),
      ('private.catalog_launch_curation_record_membership_payload_is_valid(uuid,jsonb)'),
      ('private.catalog_launch_curation_record_memberships_are_valid(uuid)')
    ) as function_matrix(function_name)
    where pg_catalog.has_function_privilege(
      role_matrix.role_name,
      function_matrix.function_name,
      'EXECUTE'
    )
  ),
  'lifecycle authorities and private membership validators are owner-only'
);

set local role service_role;
select throws_ok(
  $$select * from public.release_catalog_launch_curation_campaign(
    '58000000-0000-4000-8000-000000000080'::uuid,
    'cat03.release.denied.service-role',
    'cat03.activation.owner',
    'initial_launch_catalog_release',
    repeat('0', 64),
    repeat('0', 64),
    repeat('0', 64),
    repeat('0', 64)
  )$$,
  '42501',
  'permission denied for function release_catalog_launch_curation_campaign',
  'service_role cannot invoke the campaign lifecycle at runtime'
);
reset role;

set local role service_role;
select throws_ok(
  $$select count(*) from public.products$$,
  '42501',
  'permission denied for table products',
  'service_role cannot directly SELECT raw product rows'
);
reset role;

set local role authenticated;
select throws_ok(
  $$select reviewed_by, reviewed_at from public.catalog_sources$$,
  '42501',
  'permission denied for table catalog_sources',
  'authenticated cannot read source review identities or evidence directly'
);
reset role;

select is(
  (
    select count(*)
    from pg_catalog.pg_proc as function
    where function.oid = any(array[
      'public.lookup_catalog_product_by_barcode(text)'::regprocedure,
      'public.search_catalog_products(text,integer)'::regprocedure,
      'public.activate_catalog_launch_curation(uuid,text,text,text,text,text,text)'::regprocedure,
      'public.release_catalog_launch_curation_campaign(uuid,text,text,text,text,text,text,text)'::regprocedure,
      'public.retire_catalog_launch_curation_campaign(uuid,text,text,text,text)'::regprocedure,
      'public.retire_catalog_launch_curation(uuid,text,text,text,text)'::regprocedure
    ])
      and function.prosecdef
      and function.proconfig @> array['search_path=""']::text[]
      and (
        (function.oid = any(array[
          'public.lookup_catalog_product_by_barcode(text)'::regprocedure,
          'public.search_catalog_products(text,integer)'::regprocedure
        ]) and function.provolatile = 's')
        or
        (function.oid = any(array[
          'public.activate_catalog_launch_curation(uuid,text,text,text,text,text,text)'::regprocedure,
          'public.release_catalog_launch_curation_campaign(uuid,text,text,text,text,text,text,text)'::regprocedure,
          'public.retire_catalog_launch_curation_campaign(uuid,text,text,text,text)'::regprocedure,
          'public.retire_catalog_launch_curation(uuid,text,text,text,text)'::regprocedure
        ]) and function.provolatile = 'v')
      )
  ),
  6::bigint,
  'bounded reads and owner lifecycle functions are hardened security definers'
);

select ok(
  (
    select
      pg_catalog.position('dependencymemberships' in definition) > 0
      and pg_catalog.position('cat02membershipreadbacksha256' in definition) > 0
      and pg_catalog.position('manifestentrysha256' in definition) = 0
      and pg_catalog.position('offlinebasesealedrecordsha256' in definition) = 0
      and pg_catalog.position('signaturesetsha256' in definition) = 0
    from (
      select pg_catalog.lower(pg_catalog.pg_get_functiondef(
        'private.catalog_launch_curation_database_base_record_sha256(text,text,text,text,text,uuid,uuid,uuid,uuid,text,text,text,text,text,jsonb,text,text,text,uuid,text,text,text,integer,text,text,text,text[],text)'::regprocedure
      )) as definition
    ) as function_source
  ),
  'database base record binds CAT-02 membership without manifest/signature fixed-point cycles'
);

select is(
  private.catalog_launch_curation_target_policy_canonical_text(
    'verified', 95, 95, 95, 95, 0.98, 0.98, 1
  ),
  $policy${"contractId":"catalog-launch-db-eligibility-policy-v1","minimumBarcodeQualityScore":95.00,"minimumCategoryQualityScore":95.00,"minimumDataQualityScore":95.00,"minimumIngredientQualityScore":95.00,"minimumMappedIngredientCount":1,"minimumParseConfidence":0.9800,"minimumTokenMatchConfidence":0.9800,"regulatedCategoryMode":"qualified-review-required","requireBarcode":true,"requiredQualityGrade":"verified","territory":"US"}$policy$,
  'fixed-scale policy canonical UTF-8 text matches the frozen JavaScript golden'
);

select is(
  private.catalog_launch_curation_target_policy_sha256(
    'verified', 95, 95, 95, 95, 0.98, 0.98, 1
  ),
  '9b1fd33edaec8cf3c8582f3f9298ec9e70f5f4140b6426afb1e710eee4845e9d',
  'fixed-scale policy SHA-256 matches the frozen JavaScript golden'
);

select is(
  private.catalog_launch_curation_served_state_mutation_root_set_sha256(
    '[{"productRecordSha256":"9abcdef0123456789abcdef0123456789abcdef0123456789abcdef012345678","servedStateMutationRootSha256":"fedcba9876543210fedcba9876543210fedcba9876543210fedcba9876543210"}]'::jsonb
  ),
  '4324bbbddbfc58f0b62c50d1c80a95207321fe4e2fef3d603697605e1e85d3e5',
  'one-record mutation-root set SHA-256 matches the frozen JavaScript golden'
);

select is(
  private.catalog_launch_curation_served_state_mutation_root_set_sha256(
    '[{"productRecordSha256":"b158b7767ae4b3e3d860cd4b9ed4096bab22dd9fd8a36b1fb638fad57e9fa1b6","servedStateMutationRootSha256":"1987be70ed4b250c4d3580deb133b45955b0e910e71efc9239f1afb05b2f097a"},{"productRecordSha256":"a9dfbdb3499a116a047047a6e9c0bf4077a53e8dbf2f894d3c7bd6653c8cd5bc","servedStateMutationRootSha256":"9bbf6049ac0792b14d12f2c69b85eb4c49beddff6de1d72c7e15310b95569892"}]'::jsonb
  ),
  'f4a78f23347dd671722ee265c7191392c387370bf05afe2c875c5e11c3bf119f',
  'reversed two-record mutation-root set is C-sorted and matches the frozen JavaScript golden'
);

select throws_ok(
  $$select private.catalog_launch_curation_served_state_mutation_root_set_sha256(
    '[{"productRecordSha256":"9abcdef0123456789abcdef0123456789abcdef0123456789abcdef012345678","servedStateMutationRootSha256":"fedcba9876543210fedcba9876543210fedcba9876543210fedcba9876543210","unexpected":true}]'::jsonb
  )$$,
  '22023',
  'CATALOG_LAUNCH_CURATION_MUTATION_ROOT_SET_INVALID',
  'mutation-root sets reject extra fields instead of hashing an ambiguous shape'
);

select throws_ok(
  $$select private.catalog_launch_curation_served_state_mutation_root_set_sha256(
    '[{"productRecordSha256":"9abcdef0123456789abcdef0123456789abcdef0123456789abcdef012345678","servedStateMutationRootSha256":"fedcba9876543210fedcba9876543210fedcba9876543210fedcba9876543210"},{"productRecordSha256":"9abcdef0123456789abcdef0123456789abcdef0123456789abcdef012345678","servedStateMutationRootSha256":"0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef"}]'::jsonb
  )$$,
  '22023',
  'CATALOG_LAUNCH_CURATION_MUTATION_ROOT_SET_DUPLICATE',
  'mutation-root sets reject duplicate product-record authorities'
);

select ok(
  (
    select
      pg_catalog.position(
        'array_lower(contributing_batch_ids, 1) = 1' in definitions
      ) > 0
      and pg_catalog.position(
        'array_position(contributing_batch_ids, null::uuid) is null' in definitions
      ) > 0
      and pg_catalog.position('array_lower(reviewer_ids, 1) = 1' in definitions) > 0
      and pg_catalog.position(
        'array_lower(reviewer_evidence_sha256s, 1) = 1' in definitions
      ) > 0
    from (
      select pg_catalog.lower(pg_catalog.string_agg(
        pg_catalog.pg_get_constraintdef(constraint.oid), ' '
      )) as definitions
      from pg_catalog.pg_constraint as constraint
      where constraint.conrelid =
        'private.catalog_launch_curation_campaigns'::regclass
    ) as campaign_constraints
  ),
  'campaign batch/reviewer arrays reject sparse, null-bearing, or shifted bounds'
);

select ok(
  (
    select
      pg_catalog.position(
        'array_lower(regulatory_reviewer_ids, 1) = 1' in definitions
      ) > 0
      and pg_catalog.position(
        'array_lower(reviewer_evidence_sha256s, 1) = 1' in definitions
      ) > 0
      and pg_catalog.position('withhold_activation' in definitions) > 0
      and pg_catalog.position('regulatory_review_evidence_sha256 is null' in definitions) > 0
      and pg_catalog.position('demand_priority_rank is null' in definitions) > 0
    from (
      select pg_catalog.lower(pg_catalog.string_agg(
        pg_catalog.pg_get_constraintdef(constraint.oid), ' '
      )) as definitions
      from pg_catalog.pg_constraint as constraint
      where constraint.conrelid =
        'private.catalog_launch_curation_records'::regclass
    ) as record_constraints
  ),
  'record reviewer arrays and regulatory/priority/withhold conditionals are constrained'
);

-- This single-transaction pgTAP run can prove the identical advisory-key
-- order but cannot prove blocking behavior.  Deployment evidence must also
-- run a real two-session insert-versus-release race and retain both transcripts.
select ok(
  (
    select
      pg_catalog.position('productrow' in audit.product_definition) > 0
      and pg_catalog.position(
        'to_jsonb(product' in audit.product_definition
      ) > 0
      and pg_catalog.position(
        'fullproductsourcerow' in audit.dependency_definition
      ) > 0
      and pg_catalog.position(
        'fullreferencedsourcerows' in audit.dependency_definition
      ) > 0
      and pg_catalog.position(
        'fullimportbatchrow' in audit.dependency_definition
      ) > 0
      and pg_catalog.position(
        'fullstagedrecordrow' in audit.dependency_definition
      ) > 0
      and pg_catalog.position('fullbrandrow' in audit.dependency_definition) > 0
      and pg_catalog.position('fullcategoryrow' in audit.dependency_definition) > 0
      and pg_catalog.position('fullbarcoderows' in audit.dependency_definition) > 0
      and pg_catalog.position(
        'fullingredientlistrows' in audit.dependency_definition
      ) > 0
      and pg_catalog.position('fulltokenrows' in audit.dependency_definition) > 0
      and pg_catalog.position(
        'fullingredientlinkrows' in audit.dependency_definition
      ) > 0
      and pg_catalog.position(
        'fullmappedingredientrows' in audit.dependency_definition
      ) > 0
      and pg_catalog.position(
        'fullingredientsynonymrows' in audit.dependency_definition
      ) > 0
      and pg_catalog.position(
        'fullingredienttagassignmentrows' in audit.dependency_definition
      ) > 0
      and pg_catalog.position(
        'fullingredienttagdefinitionrows' in audit.dependency_definition
      ) > 0
      and pg_catalog.position(
        'fullactivebandrows' in audit.dependency_definition
      ) > 0
      and pg_catalog.position(
        'fullpaoexpiryrows' in audit.dependency_definition
      ) > 0
      and pg_catalog.position(
        'operatorholdrows' in audit.dependency_definition
      ) > 0
      and pg_catalog.position(
        'mapping.barcode = product.barcode' in audit.lookup_definition
      ) > 0
      and pg_catalog.position(
        'parent_product.barcode = product_barcodes.barcode'
        in audit.barcode_policy
      ) > 0
      and pg_catalog.position(
        'catalog-launch-curation-global' in audit.insert_guard_definition
      ) > 0
      and audit.insert_guard_is_volatile
      and pg_catalog.position(
        'catalog-launch-curation-global' in audit.insert_guard_definition
      ) < pg_catalog.position(
        'catalog-launch-curation-campaign:' in audit.insert_guard_definition
      )
      and pg_catalog.position(
        'catalog-launch-curation-campaign:' in audit.insert_guard_definition
      ) < pg_catalog.position(
        'catalog_launch_curation_campaign_release_events'
        in audit.insert_guard_definition
      )
      and pg_catalog.position(
        'catalog_launch_current_served_state_mutation_root_sha256'
        in audit.structural_definition
      ) > 0
      and pg_catalog.position(
        'current_date' in audit.structural_definition
      ) = 0
      and pg_catalog.position(
        'at time zone ''utc''' in audit.structural_definition
      ) > 0
      and pg_catalog.position(
        'current_date' in audit.ingredient_serving_definition
      ) = 0
      and pg_catalog.position(
        'at time zone ''utc''' in audit.ingredient_serving_definition
      ) > 0
      and pg_catalog.position(
        'current_date' in audit.product_serving_definition
      ) = 0
      and pg_catalog.position(
        'at time zone ''utc''' in audit.product_serving_definition
      ) > 0
      and pg_catalog.position(
        'catalog-launch-curation-global'
        in audit.mutation_writer_definition
      ) > 0
      and pg_catalog.position(
        'triaged' in audit.mutation_capture_definition
      ) > 0
      and pg_catalog.position(
        'accepted' in audit.mutation_capture_definition
      ) > 0
      and pg_catalog.position(
        'correctionid' in audit.correction_projection_definition
      ) > 0
      and pg_catalog.position(
        'reviewerpresent' in audit.correction_projection_definition
      ) > 0
      and pg_catalog.position(
        'notepresent' in audit.correction_projection_definition
      ) > 0
      and pg_catalog.position(
        'user_id' in audit.correction_projection_definition
      ) = 0
      and pg_catalog.position(
        'description' in audit.correction_projection_definition
      ) = 0
      and pg_catalog.position(
        'proposed_payload' in audit.correction_projection_definition
      ) = 0
      and audit.correction_projection_has_utc
      and audit.mutation_writer_is_volatile
      and audit.mutation_capture_is_volatile
      and (
        select count(*)
        from pg_catalog.pg_trigger as trigger_row
        where trigger_row.tgfoid =
            'private.capture_catalog_launch_served_state_mutation()'::regprocedure
          and not trigger_row.tgisinternal
      ) = 17
      and exists (
        select 1
        from pg_catalog.pg_trigger as trigger_row
        where trigger_row.tgrelid =
            'private.catalog_launch_curation_product_mutations'::regclass
          and trigger_row.tgname =
            'catalog_launch_curation_product_mutations_guard'
          and not trigger_row.tgisinternal
      )
    from (
      select
        pg_catalog.lower(pg_catalog.pg_get_functiondef(
          'private.catalog_launch_curation_product_snapshot(uuid)'::regprocedure
        )) as product_definition,
        pg_catalog.lower(pg_catalog.pg_get_functiondef(
          'private.catalog_launch_curation_dependency_snapshot(uuid,uuid)'::regprocedure
        )) as dependency_definition,
        pg_catalog.lower(pg_catalog.pg_get_functiondef(
          'public.lookup_catalog_product_by_barcode(text)'::regprocedure
        )) as lookup_definition,
        pg_catalog.lower(pg_catalog.pg_get_functiondef(
          'private.guard_catalog_launch_curation_record_insert()'::regprocedure
        )) as insert_guard_definition,
        pg_catalog.lower(pg_catalog.pg_get_functiondef(
          'private.catalog_launch_curation_record_is_structurally_valid(uuid)'::regprocedure
        )) as structural_definition,
        pg_catalog.lower(pg_catalog.pg_get_functiondef(
          'private.catalog_ingredient_is_servable(uuid)'::regprocedure
        )) as ingredient_serving_definition,
        pg_catalog.lower(pg_catalog.pg_get_functiondef(
          'private.catalog_product_is_servable(uuid)'::regprocedure
        )) as product_serving_definition,
        pg_catalog.lower(pg_catalog.pg_get_functiondef(
          'private.catalog_launch_append_product_mutations(uuid[],text,text,text,text,jsonb,jsonb)'::regprocedure
        )) as mutation_writer_definition,
        pg_catalog.lower(pg_catalog.pg_get_functiondef(
          'private.capture_catalog_launch_served_state_mutation()'::regprocedure
        )) as mutation_capture_definition,
        pg_catalog.lower(pg_catalog.pg_get_functiondef(
          'private.catalog_launch_correction_serving_projection(jsonb)'::regprocedure
        )) as correction_projection_definition,
        (
          select procedure.provolatile = 'v'
          from pg_catalog.pg_proc as procedure
          where procedure.oid =
            'private.guard_catalog_launch_curation_record_insert()'::regprocedure
        ) as insert_guard_is_volatile,
        (
          select procedure.provolatile = 'v'
          from pg_catalog.pg_proc as procedure
          where procedure.oid =
            'private.catalog_launch_append_product_mutations(uuid[],text,text,text,text,jsonb,jsonb)'::regprocedure
        ) as mutation_writer_is_volatile,
        (
          select procedure.provolatile = 'v'
          from pg_catalog.pg_proc as procedure
          where procedure.oid =
            'private.capture_catalog_launch_served_state_mutation()'::regprocedure
        ) as mutation_capture_is_volatile,
        (
          select pg_catalog.position(
            'timezone=utc' in pg_catalog.lower(
              pg_catalog.array_to_string(procedure.proconfig, ',')
            )
          ) > 0
          from pg_catalog.pg_proc as procedure
          where procedure.oid =
            'private.catalog_launch_correction_serving_projection(jsonb)'::regprocedure
        ) as correction_projection_has_utc,
        (
          select pg_catalog.lower(pg_catalog.pg_get_expr(
            policy.polqual, policy.polrelid
          ))
          from pg_catalog.pg_policy as policy
          where policy.polname = 'product_barcodes_read_servable'
            and policy.polrelid = 'public.product_barcodes'::regclass
        ) as barcode_policy
    ) as audit
  ),
  'publication seals, primary-only barcodes, lock ordering, and monotonic mutation roots are installed'
);

select ok(
  (
    select
      pg_catalog.position('2000' in definitions) > 0
      and pg_catalog.position('100' in definitions) > 0
      and pg_catalog.position('expected_eligible_record_count' in definitions) > 0
      and pg_catalog.position(
        'expected_prioritized_eligible_record_count' in definitions
      ) > 0
    from (
      select pg_catalog.lower(pg_catalog.string_agg(
        pg_catalog.pg_get_constraintdef(constraint.oid), ' '
      )) as definitions
      from pg_catalog.pg_constraint as constraint
      where constraint.conrelid =
        'private.catalog_launch_curation_campaigns'::regclass
    ) as campaign_constraints
  ),
  'campaign schema preserves the 2,000 eligible and 100 prioritized hard floors'
);

select ok(
  private.catalog_product_is_servable(
    (select value_uuid from cat03_test_state where state_key = 'test_product')
  ) is false,
  'mutable reviewed product state is never serving authority before a campaign head'
);

set local role service_role;
select is(
  pg_catalog.jsonb_build_object(
    'aliasLookup', (
      select count(*)
      from public.lookup_catalog_product_by_barcode(
        pg_catalog.current_setting('app.cat03_alias_barcode')
      )
    ),
    'lookup', (
      select count(*)
      from public.lookup_catalog_product_by_barcode(
        pg_catalog.current_setting('app.cat03_test_barcode')
      )
    ),
    'search', (
      select count(*)
      from public.search_catalog_products('launch 0001', 20)
    )
  ),
  '{"aliasLookup":0,"lookup":0,"search":0}'::jsonb,
  'bounded service reads expose no product before global release'
);
reset role;

set local role authenticated;
select is(
  pg_catalog.jsonb_build_object(
    'products', (
      select count(*) from public.products
      where id = pg_catalog.current_setting(
        'app.cat03_test_product_id'
      )::uuid
    ),
    'barcodes', (
      select count(*) from public.product_barcodes
      where barcode = pg_catalog.current_setting('app.cat03_test_barcode')
    ),
    'lists', (
      select count(*) from public.product_ingredient_lists
      where product_id = pg_catalog.current_setting(
        'app.cat03_test_product_id'
      )::uuid
    )
  ),
  '{"barcodes":0,"lists":0,"products":0}'::jsonb,
  'authenticated RLS exposes neither a product nor children before release'
);
reset role;

-- ---------------------------------------------------------------------------
-- Exact 2,001-review / 2,000-eligible primary campaign
-- ---------------------------------------------------------------------------

select pg_temp.cat03_prepare_campaign(
  '58000000-0000-4000-8000-000000000080',
  'cat03-primary',
  true
);

set local timezone = 'UTC';
insert into cat03_test_state (state_key, value_json)
values (
  'timezone_hash_vector_utc',
  pg_temp.cat03_timezone_hash_vector(
    '58000000-0000-4000-8000-000000000080'
  )
);
set local timezone = 'America/Toronto';
select is(
  pg_temp.cat03_timezone_hash_vector(
    '58000000-0000-4000-8000-000000000080'
  ),
  (select value_json from cat03_test_state
    where state_key = 'timezone_hash_vector_utc'),
  'hashes and record/product/ingredient serving decisions are session-TimeZone invariant'
);
set local timezone = 'UTC';

select is(
  (
    select pg_catalog.jsonb_build_object(
      'reviewed', campaign.expected_reviewed_record_count,
      'eligible', campaign.expected_eligible_record_count,
      'prioritized', campaign.expected_prioritized_eligible_record_count
    )
    from private.catalog_launch_curation_campaigns as campaign
    where campaign.id = '58000000-0000-4000-8000-000000000080'
  ),
  '{"eligible":2000,"prioritized":2000,"reviewed":2001}'::jsonb,
  'primary campaign seals exact reviewed, eligible, and prioritized counts'
);

select ok(
  (
    select
      pg_catalog.jsonb_array_length(campaign.cat02_artifact_sets) = 2
      and campaign.contributing_batch_ids = (
        select pg_catalog.array_agg(state.value_uuid order by state.value_uuid)
        from cat03_test_state as state
        where state.state_key in ('primary_batch', 'dependency_batch')
      )
      and campaign.cat02_artifact_set_sha256 =
        private.catalog_launch_curation_cat02_artifact_set_sha256(
          campaign.cat02_artifact_sets
        )
      and campaign.contributing_batch_set_sha256 =
        private.catalog_launch_curation_contributing_batch_set_sha256(
          campaign.cat02_artifact_sets
        )
      and campaign.cat02_production_integrity_set_sha256 =
        private.catalog_launch_curation_cat02_production_integrity_set_sha256(
          campaign.cat02_artifact_sets
        )
      and campaign.cat02_membership_proof_sha256 ~ '^[a-f0-9]{64}$'
      and campaign.cat02_database_observation_sha256 ~ '^[a-f0-9]{64}$'
      and campaign.cat02_verifier_signature_set_sha256 ~ '^[a-f0-9]{64}$'
      and private.catalog_launch_curation_cat02_artifact_sets_are_live(
        campaign.cat02_artifact_sets,
        campaign.contributing_batch_ids
      )
    from private.catalog_launch_curation_campaigns as campaign
    where campaign.id = '58000000-0000-4000-8000-000000000080'
  ),
  'campaign binds two live CAT-02 artifact chains and their sorted batch set'
);

select is(
  (
    select pg_catalog.jsonb_build_object(
      'reviewed', count(*),
      'approved', count(*) filter (
        where record.activation_decision = 'approve_activation'
      ),
      'withheld', count(*) filter (
        where record.activation_decision = 'withhold_activation'
      ),
      'prioritized', count(*) filter (
        where record.demand_priority_rank is not null
      )
    )
    from private.catalog_launch_curation_records as record
    where record.campaign_id = '58000000-0000-4000-8000-000000000080'
  ),
  '{"approved":2000,"prioritized":2000,"reviewed":2001,"withheld":1}'::jsonb,
  'the installed record ledger matches every exact campaign cardinality'
);

select ok(
  (
    select private.catalog_launch_curation_record_is_structurally_valid(record.id)
    from private.catalog_launch_curation_records as record
    where record.campaign_id = '58000000-0000-4000-8000-000000000080'
      and record.product_id = (
        select value_uuid from cat03_test_state
        where state_key = 'successor_product'
      )
  ),
  'the deliberately rejected review row still has complete structural authority'
);

select ok(
  (
    select private.catalog_launch_curation_record_is_valid(record.id) is false
    from private.catalog_launch_curation_records as record
    where record.campaign_id = '58000000-0000-4000-8000-000000000080'
      and record.product_id = (
        select value_uuid from cat03_test_state
        where state_key = 'successor_product'
      )
  ),
  'the rejected review row can never become positive serving authority'
);

select is(
  (
    select count(*)
    from private.catalog_launch_curation_records as record
    where record.campaign_id = '58000000-0000-4000-8000-000000000080'
      and private.catalog_launch_curation_record_is_structurally_valid(record.id)
  ),
  2001::bigint,
  'all reviewed rows independently revalidate their sealed structural contract'
);

select is(
  (
    select count(*)
    from private.catalog_launch_curation_records as record
    where record.campaign_id = '58000000-0000-4000-8000-000000000080'
      and record.activation_decision = 'approve_activation'
      and private.catalog_launch_curation_record_is_valid(record.id)
  ),
  2000::bigint,
  'all and only 2,000 approved records pass the positive live-quality predicate'
);

select is(
  (
    select pg_catalog.jsonb_build_object(
      'cosmeticNull', count(*) filter (
        where record.regulatory_classification = 'cosmetic'
          and record.regulatory_review_evidence_sha256 is null
      ),
      'regulatedBound', count(*) filter (
        where record.regulatory_classification <> 'cosmetic'
          and record.regulatory_review_evidence_sha256 is not null
      ),
      'invalid', count(*) filter (
        where (record.regulatory_classification = 'cosmetic')
          <> (record.regulatory_review_evidence_sha256 is null)
      )
    )
    from private.catalog_launch_curation_records as record
    where record.campaign_id = '58000000-0000-4000-8000-000000000080'
  ),
  '{"cosmeticNull":1335,"invalid":0,"regulatedBound":666}'::jsonb,
  'cosmetic rows omit regulatory evidence while every regulated row binds it'
);

select ok(
  not exists (
    select 1
    from private.catalog_launch_curation_records as record
    where record.campaign_id = '58000000-0000-4000-8000-000000000080'
      and (
        pg_catalog.jsonb_array_length(record.dependency_memberships) <> 5
        or (
          select count(distinct membership.value ->> 'dependencyEntitySha256')
          from pg_catalog.jsonb_array_elements(record.dependency_memberships)
            as membership(value)
        ) <> 5
        or (
          select pg_catalog.jsonb_agg(
            membership.value ->> 'fieldScope'
            order by membership.ordinality
          )
          from pg_catalog.jsonb_array_elements(record.dependency_memberships)
            with ordinality as membership(value, ordinality)
        ) <> '["barcode_identity","category","ingredients","ingredients","regulatory_classification"]'::jsonb
      )
  ),
  'every record binds the exact ordered scope/entity CAT-02 membership proof'
);

select is(
  (
    select pg_catalog.jsonb_build_object(
      'duplicate',
        private.catalog_launch_curation_record_membership_payload_is_valid(
          record.id,
          record.dependency_memberships ||
            pg_catalog.jsonb_build_array(record.dependency_memberships -> 2)
        ),
      'extra',
        private.catalog_launch_curation_record_membership_payload_is_valid(
          record.id,
          record.dependency_memberships || pg_catalog.jsonb_build_array(
            pg_catalog.jsonb_set(
              record.dependency_memberships -> 2,
              '{dependencyEntitySha256}',
              pg_catalog.to_jsonb(pg_catalog.repeat('f', 64))
            )
          )
        ),
      'omission',
        private.catalog_launch_curation_record_membership_payload_is_valid(
          record.id,
          record.dependency_memberships - 2
        ),
      'wrongBarcodeEvidenceAccepted',
        private.catalog_launch_curation_membership_evidence_sha256(
          record.product_id,
          record.ingredient_list_id,
          pg_catalog.current_setting('app.cat03_alias_barcode'),
          record.product_record_sha256,
          record.dependency_memberships -> 0 ->> 'fieldScope',
          record.dependency_memberships -> 0 ->> 'dependencyEntitySha256',
          (record.dependency_memberships -> 0 ->> 'batchId')::uuid,
          record.dependency_memberships -> 0 ->> 'artifactSetSha256',
          record.dependency_memberships -> 0 ->> 'cat02StageRecordSha256',
          record.dependency_memberships -> 0 ->>
            'cat02DatabaseNormalizedRecordSha256',
          record.dependency_memberships -> 0 ->> 'sourceApprovalSha256',
          record.dependency_memberships -> 0 ->> 'sourceQaSha256'
        ) is not null
        )
    from private.catalog_launch_curation_records as record
    where record.campaign_id = '58000000-0000-4000-8000-000000000080'
    order by record.product_record_sha256
    limit 1
  ),
  '{"duplicate":false,"extra":false,"omission":false,"wrongBarcodeEvidenceAccepted":false}'::jsonb,
  'the pure validators reject duplicate, extra, omitted, and non-primary barcode authorities'
);

select is(
  (
    select count(*)
    from private.catalog_launch_curation_records as record
    cross join lateral pg_catalog.jsonb_array_elements(
      record.dependency_memberships
    ) as membership(value)
    where record.campaign_id = '58000000-0000-4000-8000-000000000080'
      and membership.value ->> 'fieldScope' = 'ingredients'
      and (membership.value ->> 'batchId')::uuid = (
        select value_uuid from cat03_test_state
        where state_key = 'dependency_batch'
      )
  ),
  4002::bigint,
  'the secondary promoted batch supplies two exact ingredient authorities for every review'
);

select ok(
  (
    select campaign.cat02_membership_set_sha256 =
      private.catalog_launch_curation_campaign_membership_set_sha256(campaign.id)
    from private.catalog_launch_curation_campaigns as campaign
    where campaign.id = '58000000-0000-4000-8000-000000000080'
  ),
  'the campaign membership root recomputes from all 10,005 exact entity memberships'
);

select is(
  private.catalog_launch_curation_campaign_membership_batch_ids(
    '58000000-0000-4000-8000-000000000080'
  ),
  (
    select pg_catalog.array_agg(state.value_uuid order by state.value_uuid)
    from cat03_test_state as state
    where state.state_key in ('primary_batch', 'dependency_batch')
  ),
  'membership readback derives the same exact sorted contributing batch set'
);

select is(
  (
    select count(*)
    from private.catalog_launch_curation_records as record
    join private.catalog_launch_curation_campaigns as campaign
      on campaign.id = record.campaign_id
    where campaign.id = '58000000-0000-4000-8000-000000000080'
      and record.database_base_record_sha256 =
        private.catalog_launch_curation_database_base_record_sha256(
          campaign.release_id,
          campaign.signed_target_policy_sha256,
          campaign.beta_corpus_sha256,
          campaign.eligibility_policy_sha256,
          campaign.import_candidates_sha256,
          record.product_id,
          record.source_id,
          record.import_batch_id,
          record.import_staged_record_id,
          record.product_record_sha256,
          record.cat02_stage_record_sha256,
          record.cat02_database_normalized_record_sha256,
          record.source_approval_sha256,
          record.source_qa_sha256,
          record.dependency_memberships,
          record.cat02_membership_readback_sha256,
          record.category_code,
          record.barcode,
          record.ingredient_list_id,
          record.product_snapshot_sha256,
          record.dependency_sha256,
          record.demand_priority_rank,
          record.demand_priority_commitment_sha256,
          record.regulatory_classification,
          record.regulatory_review_evidence_sha256,
          record.regulatory_reviewer_ids,
          record.curated_by
        )
  ),
  2001::bigint,
  'every database base record recomputes from the canonical live snapshot'
);

select is(
  (
    select count(*)
    from private.catalog_launch_curation_records as record
    join private.catalog_launch_curation_campaigns as campaign
      on campaign.id = record.campaign_id
    where campaign.id = '58000000-0000-4000-8000-000000000080'
      and record.reviewed_record_mapping_sha256 =
        private.catalog_launch_curation_reviewed_record_mapping_sha256(
          campaign.release_id,
          record.product_record_sha256,
          record.offline_base_sealed_record_sha256,
          record.database_base_record_sha256
        )
  ),
  2001::bigint,
  'every offline-to-database reviewed-record mapping recomputes exactly'
);

with review_signatures as (
  select pg_catalog.jsonb_build_array(
    pg_catalog.jsonb_build_object(
      'decisionRole', 'catalog_quality_reviewer',
      'reviewerId', 'cat03.catalog.quality',
      'trustRegistryKeyId', 'cat03-catalog-key',
      'algorithm', 'Ed25519',
      'signedAt', '2026-07-15T00:00:00.000Z',
      'valueBase64', 'Y2F0MDMtY2F0YWxvZy1zaWduYXR1cmU='
    ),
    pg_catalog.jsonb_build_object(
      'decisionRole', 'data_quality_reviewer',
      'reviewerId', 'cat03.data.quality',
      'trustRegistryKeyId', 'cat03-data-key',
      'algorithm', 'Ed25519',
      'signedAt', '2026-07-15T00:00:00.000Z',
      'valueBase64', 'Y2F0MDMtZGF0YS1zaWduYXR1cmU='
    ),
    pg_catalog.jsonb_build_object(
      'decisionRole', 'regulatory_reviewer',
      'reviewerId', 'cat03.regulatory.reviewer',
      'trustRegistryKeyId', 'cat03-regulatory-key',
      'algorithm', 'Ed25519',
      'signedAt', '2026-07-15T00:00:00.000Z',
      'valueBase64', 'Y2F0MDMtcmVndWxhdG9yeS1zaWduYXR1cmU='
    ),
    pg_catalog.jsonb_build_object(
      'decisionRole', 'privacy_release_verifier',
      'reviewerId', 'cat03.privacy.release',
      'trustRegistryKeyId', 'cat03-privacy-key',
      'algorithm', 'Ed25519',
      'signedAt', '2026-07-15T00:00:00.000Z',
      'valueBase64', 'Y2F0MDMtcHJpdmFjeS1zaWduYXR1cmU='
    )
  ) as signatures
), expected as (
  select
    private.catalog_import_sha256_text(
      private.catalog_import_canonical_json(
        pg_catalog.jsonb_build_object(
          'contractId', 'catalog-curation-database-reviewer-signature-set-v1',
          'signatures', pg_catalog.jsonb_build_array(signatures -> 0, signatures -> 1)
        )
      )
    ) as campaign_signature_set,
    private.catalog_import_sha256_text(
      private.catalog_import_canonical_json(
        pg_catalog.jsonb_build_object(
          'contractId', 'catalog-curation-record-reviewer-signature-set-v1',
          'signatures', pg_catalog.jsonb_build_array(signatures -> 0, signatures -> 1)
        )
      )
    ) as record_signature_set,
    private.catalog_import_sha256_text(
      private.catalog_import_canonical_json(
        pg_catalog.jsonb_build_object(
          'contractId', 'catalog-curation-regulatory-signature-set-v1',
          'signatures', pg_catalog.jsonb_build_array(signatures -> 2)
        )
      )
    ) as regulatory_signature_set,
    private.catalog_import_sha256_text(
      private.catalog_import_canonical_json(
        pg_catalog.jsonb_build_object(
          'contractId', 'catalog-curation-outcome-reviewer-signature-set-v1',
          'signatures', signatures
        )
      )
    ) as outcome_signature_set
  from review_signatures
)
select ok(
  (
    select
      campaign.reviewer_signature_set_sha256 = expected.campaign_signature_set
      and campaign.curation_outcome_reviewer_signature_set_sha256 =
        expected.outcome_signature_set
      and pg_catalog.bool_and(
        record.reviewer_signature_set_sha256 = expected.record_signature_set
      )
      and pg_catalog.bool_and(
        record.curation_outcome_reviewer_signature_set_sha256 =
          expected.outcome_signature_set
      )
      and pg_catalog.bool_and(
        record.regulatory_signature_set_sha256 = expected.regulatory_signature_set
      )
    from private.catalog_launch_curation_campaigns as campaign
    join private.catalog_launch_curation_records as record
      on record.campaign_id = campaign.id
    cross join expected
    where campaign.id = '58000000-0000-4000-8000-000000000080'
    group by campaign.reviewer_signature_set_sha256,
      campaign.curation_outcome_reviewer_signature_set_sha256,
      expected.campaign_signature_set,
      expected.record_signature_set,
      expected.regulatory_signature_set,
      expected.outcome_signature_set
  ),
  'four outcome signatures and all role-filtered signature roots persist exactly'
);

select is(
  (
    select count(*)
    from private.catalog_launch_curation_records as record
    where record.campaign_id = '58000000-0000-4000-8000-000000000080'
      and record.curation_record_sha256 =
        private.catalog_launch_curation_record_sha256(
          record.offline_base_sealed_record_sha256,
          record.database_base_record_sha256,
          record.reviewed_record_mapping_sha256,
          record.cat02_membership_proof_sha256,
          record.cat02_database_observation_sha256,
          record.cat02_verifier_signature_set_sha256,
          record.cat02_production_integrity_set_sha256,
          record.curation_outcome_reviewer_signature_set_sha256,
          record.regulatory_review_evidence_sha256,
          record.regulatory_reviewer_ids,
          record.regulatory_signature_set_sha256,
          record.reviewer_evidence_sha256s,
          record.reviewer_signature_set_sha256,
          record.activation_decision,
          record.activation_operator_id,
          record.activation_planned_at,
          record.database_activation_request_sha256,
          record.activation_signature_sha256
        )
  ),
  2001::bigint,
  'final record digests bind reviewer, regulatory, decision, request, and signature authority'
);

select ok(
  (
    select campaign.expected_record_set_sha256 =
      private.catalog_launch_curation_campaign_record_set_sha256(campaign.id)
    from private.catalog_launch_curation_campaigns as campaign
    where campaign.id = '58000000-0000-4000-8000-000000000080'
  ),
  'the exact reviewed-record root recomputes from all 2,001 final records'
);

select ok(
  (
    select campaign.activation_authorization_set_sha256 =
      private.catalog_launch_curation_campaign_authorization_set_sha256(
        campaign.id
      )
    from private.catalog_launch_curation_campaigns as campaign
    where campaign.id = '58000000-0000-4000-8000-000000000080'
  ),
  'the activation authorization root recomputes from exactly 2,000 approved requests'
);

select ok(
  (
    select campaign.curation_manifest_sha256 =
      private.catalog_import_sha256_text(
        private.catalog_import_canonical_json(
          pg_catalog.jsonb_build_object(
            'contractId', 'catalog-launch-curation-offline-manifest-v1',
            'records', pg_catalog.jsonb_agg(
              pg_catalog.jsonb_build_object(
                'productRecordSha256', record.product_record_sha256,
                'manifestEntrySha256', record.manifest_entry_sha256
              ) order by record.product_record_sha256
            )
          )
        )
      )
    from private.catalog_launch_curation_campaigns as campaign
    join private.catalog_launch_curation_records as record
      on record.campaign_id = campaign.id
    where campaign.id = '58000000-0000-4000-8000-000000000080'
    group by campaign.curation_manifest_sha256
  ),
  'the campaign manifest root recomputes from every offline authority entry'
);

select is(
  (
    select pg_catalog.jsonb_object_agg(
      counts.category_code,
      counts.eligible_count
      order by counts.category_code
    )
    from (
      select record.category_code, count(*) as eligible_count
      from private.catalog_launch_curation_records as record
      where record.campaign_id = '58000000-0000-4000-8000-000000000080'
        and record.activation_decision = 'approve_activation'
      group by record.category_code
    ) as counts
  ),
  '{"acne_treatment":333,"cleanser":334,"moisturizer":333,"serum":334,"sunscreen":333,"toner":333}'::jsonb,
  'eligible records realize every exact required category floor'
);

select is(
  (
    select pg_catalog.jsonb_build_object(
      'count', count(*),
      'distinct', count(distinct record.demand_priority_rank),
      'minimum', min(record.demand_priority_rank),
      'maximum', max(record.demand_priority_rank)
    )
    from private.catalog_launch_curation_records as record
    where record.campaign_id = '58000000-0000-4000-8000-000000000080'
      and record.activation_decision = 'approve_activation'
  ),
  '{"count":2000,"distinct":2000,"maximum":2000,"minimum":1}'::jsonb,
  'the prioritized eligible set is exact, unique, and contiguous from one'
);

with staged as materialized (
  select pg_temp.cat03_stage_product(
    '58000000-0000-4000-8000-000000000080',
    (select value_uuid from cat03_test_state where state_key = 'test_product')
  ) as value
)
select ok(
  (
    select
      staged.value ->> 'replayed' = 'false'
      and staged.value ->> 'product_id' = record.product_id::text
      and staged.value ->> 'release_id' = campaign.release_id
      and staged.value ->> 'campaign_authority_sha256' =
        campaign.campaign_authority_sha256
      and staged.value ->> 'curation_outcome_reviewer_signature_set_sha256' =
        campaign.curation_outcome_reviewer_signature_set_sha256
      and staged.value ->> 'cat02_membership_proof_sha256' =
        record.cat02_membership_proof_sha256
      and staged.value ->> 'cat02_database_observation_sha256' =
        record.cat02_database_observation_sha256
      and staged.value ->> 'cat02_verifier_signature_set_sha256' =
        record.cat02_verifier_signature_set_sha256
      and staged.value ->> 'cat02_production_integrity_set_sha256' =
        record.cat02_production_integrity_set_sha256
      and staged.value ->> 'cat02_stage_record_sha256' =
        record.cat02_stage_record_sha256
      and staged.value ->> 'cat02_database_normalized_record_sha256' =
        record.cat02_database_normalized_record_sha256
      and staged.value ->> 'source_approval_sha256' = record.source_approval_sha256
      and staged.value ->> 'source_qa_sha256' = record.source_qa_sha256
      and staged.value ->> 'served_state_mutation_root_sha256' =
        record.served_state_mutation_root_sha256
      and staged.value -> 'dependency_memberships' = record.dependency_memberships
      and staged.value ->> 'cat02_membership_readback_sha256' =
        record.cat02_membership_readback_sha256
      and staged.value ->> 'database_base_record_sha256' =
        record.database_base_record_sha256
      and staged.value ->> 'reviewed_record_mapping_sha256' =
        record.reviewed_record_mapping_sha256
      and staged.value ->> 'database_activation_request_sha256' =
        record.database_activation_request_sha256
      and staged.value ->> 'activation_signature_sha256' =
        record.activation_signature_sha256
      and staged.value ->> 'event_receipt_sha256' = event.event_receipt_sha256
      and staged.value ->> 'head_sha256' = head.head_sha256
    from staged
    join private.catalog_launch_curation_records as record
      on record.product_id = (staged.value ->> 'product_id')::uuid
     and record.campaign_id = '58000000-0000-4000-8000-000000000080'
    join private.catalog_launch_curation_campaigns as campaign
      on campaign.id = record.campaign_id
    join private.catalog_launch_curation_events as event
      on event.id = (staged.value ->> 'curation_event_id')::uuid
    join private.catalog_launch_curation_heads as head
      on head.last_event_id = event.id
     and head.campaign_id = campaign.id
  ),
  'product staging returns the complete canonical authorization/event/head readback'
);

select ok(
  (
    select
      replay.value ->> 'replayed' = 'true'
      and replay.value ->> 'database_base_record_sha256' =
        record.database_base_record_sha256
      and replay.value ->> 'reviewed_record_mapping_sha256' =
        record.reviewed_record_mapping_sha256
      and replay.value ->> 'served_state_mutation_root_sha256' =
        record.served_state_mutation_root_sha256
      and replay.value ->> 'event_receipt_sha256' is not null
      and replay.value ->> 'head_sha256' is not null
    from (
      select pg_temp.cat03_stage_product(
        '58000000-0000-4000-8000-000000000080',
        (select value_uuid from cat03_test_state where state_key = 'test_product')
      ) as value
    ) as replay
    join private.catalog_launch_curation_records as record
      on record.product_id = (replay.value ->> 'product_id')::uuid
     and record.campaign_id = '58000000-0000-4000-8000-000000000080'
  ),
  'exact product staging replay is idempotent and preserves canonical readback'
);

select ok(
  private.catalog_product_is_servable(
    (select value_uuid from cat03_test_state where state_key = 'test_product')
  ) is false,
  'a staged product head remains non-serving until the one global campaign flip'
);

set local role service_role;
select is(
  pg_catalog.jsonb_build_object(
    'aliasLookup', (
      select count(*)
      from public.lookup_catalog_product_by_barcode(
        pg_catalog.current_setting('app.cat03_alias_barcode')
      )
    ),
    'lookup', (
      select count(*)
      from public.lookup_catalog_product_by_barcode(
        pg_catalog.current_setting('app.cat03_test_barcode')
      )
    ),
    'search', (
      select count(*)
      from public.search_catalog_products('launch 0001', 20)
    )
  ),
  '{"aliasLookup":0,"lookup":0,"search":0}'::jsonb,
  'bounded service reads cannot observe an individually staged product'
);
reset role;

select throws_ok(
  $$update private.catalog_launch_curation_heads
       set generation = generation
     where product_id = (
       select value_uuid from pg_temp.cat03_test_state
       where state_key = 'test_product'
     )
       and campaign_id = '58000000-0000-4000-8000-000000000080'::uuid$$,
  '55000',
  'CATALOG_LAUNCH_CURATION_HEAD_WRITE_FORBIDDEN',
  'direct product-head mutation cannot impersonate an owner lifecycle transition'
);

select pg_temp.cat03_prepare_campaign(
  '58000000-0000-4000-8000-000000000082',
  'cat03-incomplete',
  false
);

select throws_ok(
  $$select pg_temp.cat03_release_campaign(
    '58000000-0000-4000-8000-000000000082'::uuid
  )$$,
  '55000',
  'CATALOG_LAUNCH_CURATION_CAMPAIGN_RELEASE_GATE_CLOSED',
  'an incomplete campaign cannot pass the global release gate'
);

select throws_ok(
  $$select * from public.release_catalog_launch_curation_campaign(
    campaign.id,
    'cat03.release.' || campaign.release_id || '.' ||
      campaign.campaign_authority_sha256,
    'cat03.activation.owner',
    'initial_launch_catalog_release',
    campaign.campaign_sha256,
    repeat('0', 64),
    campaign.served_state_mutation_root_set_sha256,
    campaign.activation_authorization_set_sha256
  )
  from private.catalog_launch_curation_campaigns as campaign
  where campaign.id = '58000000-0000-4000-8000-000000000080'::uuid$$,
  '55000',
  'CATALOG_LAUNCH_CURATION_CAMPAIGN_RELEASE_GATE_CLOSED',
  'a substituted expected record-set root closes release atomically'
);

select ok(
  (
    select
      release.value ->> 'replayed' = 'false'
      and release.value ->> 'campaign_id' =
        '58000000-0000-4000-8000-000000000080'
      and release.value ->> 'head_generation' = '1'
      and release.value ->> 'cat02_membership_proof_sha256' =
        campaign.cat02_membership_proof_sha256
      and release.value ->> 'cat02_database_observation_sha256' =
        campaign.cat02_database_observation_sha256
      and release.value ->> 'cat02_verifier_signature_set_sha256' =
        campaign.cat02_verifier_signature_set_sha256
      and release.value ->> 'cat02_production_integrity_set_sha256' =
        campaign.cat02_production_integrity_set_sha256
      and release.value ->> 'curation_outcome_reviewer_signature_set_sha256' =
        campaign.curation_outcome_reviewer_signature_set_sha256
      and release.value ->> 'served_state_mutation_root_set_sha256' =
        campaign.served_state_mutation_root_set_sha256
    from (
      select pg_temp.cat03_release_campaign(
        '58000000-0000-4000-8000-000000000080'
      ) as value
    ) as release
    cross join private.catalog_launch_curation_campaigns as campaign
    where campaign.id = '58000000-0000-4000-8000-000000000080'
  ),
  'one exact primary release atomically opens the complete 2,000-product campaign'
);

select is(
  pg_catalog.jsonb_build_object(
    'campaign', (
      select head.campaign_id
      from private.catalog_launch_curation_campaign_release_heads as head
      where head.territory = 'US'
    ),
    'generation', (
      select head.generation
      from private.catalog_launch_curation_campaign_release_heads as head
      where head.territory = 'US'
    ),
    'state', (
      select head.state
      from private.catalog_launch_curation_campaign_release_heads as head
      where head.territory = 'US'
    ),
    'productHeads', (
      select count(*)
      from private.catalog_launch_curation_heads as head
      where head.campaign_id = '58000000-0000-4000-8000-000000000080'
        and head.state = 'active'
    ),
    'withheldHeads', (
      select count(*)
      from private.catalog_launch_curation_heads as head
      where head.campaign_id = '58000000-0000-4000-8000-000000000080'
        and head.product_id = (
          select value_uuid from cat03_test_state
          where state_key = 'successor_product'
        )
    )
  ),
  '{"campaign":"58000000-0000-4000-8000-000000000080","generation":1,"productHeads":2000,"state":"active","withheldHeads":0}'::jsonb,
  'primary release head and exact product-head set contain no rejected record'
);

set local role service_role;
select is(
  pg_catalog.jsonb_build_object(
    'aliasLookup', (
      select count(*)
      from public.lookup_catalog_product_by_barcode(
        pg_catalog.current_setting('app.cat03_alias_barcode')
      )
    ),
    'lookup', (
      select count(*)
      from public.lookup_catalog_product_by_barcode(
        pg_catalog.current_setting('app.cat03_test_barcode')
      )
    ),
    'search', (
      select count(*)
      from public.search_catalog_products('launch 0001', 20)
    )
  ),
  '{"aliasLookup":0,"lookup":1,"search":1}'::jsonb,
  'bounded service reads expose only the exact live primary barcode after release'
);
reset role;

set local role authenticated;
select is(
  pg_catalog.jsonb_build_object(
    'liveProduct', (
      select count(*) from public.products
      where id = pg_catalog.current_setting(
        'app.cat03_test_product_id'
      )::uuid
    ),
    'liveBarcode', (
      select count(*) from public.product_barcodes
      where barcode = pg_catalog.current_setting('app.cat03_test_barcode')
    ),
    'aliasBarcode', (
      select count(*) from public.product_barcodes
      where barcode = pg_catalog.current_setting('app.cat03_alias_barcode')
    ),
    'liveList', (
      select count(*) from public.product_ingredient_lists
      where product_id = pg_catalog.current_setting(
        'app.cat03_test_product_id'
      )::uuid
    ),
    'liveToken', (
      select count(*) from public.product_ingredient_tokens
      where product_id = pg_catalog.current_setting(
        'app.cat03_test_product_id'
      )::uuid
    ),
    'heldProduct', (
      select count(*) from public.products
      where id = pg_catalog.current_setting(
        'app.cat03_successor_product_id'
      )::uuid
    ),
    'heldList', (
      select count(*) from public.product_ingredient_lists
      where product_id = pg_catalog.current_setting(
        'app.cat03_successor_product_id'
      )::uuid
    )
  ),
  '{"aliasBarcode":0,"heldList":0,"heldProduct":0,"liveBarcode":1,"liveList":1,"liveProduct":1,"liveToken":2}'::jsonb,
  'authenticated RLS exposes live primary children, hides aliases, and withholds the rejected row'
);
reset role;

-- An operator-confirmed hold irreversibly invalidates every already-sealed
-- record for that product.  Closing the mutable correction row and restoring
-- its denormalized product projection cannot resurrect the old campaign; a
-- later campaign may recover only through a newly sealed record id.
insert into cat03_test_state (state_key, value_text)
select 'correction_root_before',
  private.catalog_launch_current_served_state_mutation_root_sha256(
    fixture.product_id
  )
from cat03_product_fixture as fixture
where fixture.ordinal = 2;

insert into auth.users (id)
values ('58000000-0000-4000-8000-000000000001')
on conflict (id) do nothing;
alter table public.catalog_corrections
  disable trigger trg_catalog_corrections_health_write;
insert into public.catalog_corrections (
  id, user_id, product_id, barcode, correction_type, status, description
) values (
  '58000000-0000-4000-8000-000000000090',
  '58000000-0000-4000-8000-000000000001',
  (select product_id from cat03_product_fixture where ordinal = 2),
  (select barcode from cat03_product_fixture where ordinal = 2),
  'wrong_match', 'open', 'CAT03 monotonic invalidation fixture.'
);
update public.catalog_corrections
   set status = 'triaged',
       assigned_to = 'cat03.correction.reviewer',
       resolution_note = 'Confirmed hold before repaired source review.',
       operator_reviewed_at = pg_catalog.now(),
       operator_reviewed_by = 'cat03.correction.reviewer',
       operator_review_note = 'Confirmed hold before repaired source review.',
       updated_at = pg_catalog.now()
 where id = '58000000-0000-4000-8000-000000000090';

insert into cat03_test_state (state_key, value_text)
select 'hold_irrelevant_root_before',
  private.catalog_launch_current_served_state_mutation_root_sha256(product_id)
from public.catalog_corrections
where id = '58000000-0000-4000-8000-000000000090';
update public.catalog_corrections
set description = 'Reporter text that is irrelevant to the serving hold.',
    proposed_payload = '{"untrusted":"personal-free-text"}'::jsonb,
    client_context = '{"device":"irrelevant"}'::jsonb
where id = '58000000-0000-4000-8000-000000000090';
insert into cat03_test_state (state_key, value_text)
select 'hold_irrelevant_root_after',
  private.catalog_launch_current_served_state_mutation_root_sha256(product_id)
from public.catalog_corrections
where id = '58000000-0000-4000-8000-000000000090';

select is(
  (select value_text from cat03_test_state
    where state_key = 'hold_irrelevant_root_after'),
  (select value_text from cat03_test_state
    where state_key = 'hold_irrelevant_root_before'),
  'irrelevant correction personal/free-text/JSON edits do not enter the mutation root'
);

insert into cat03_test_state (state_key, value_text)
select 'hold_projection_root_before',
  private.catalog_launch_current_served_state_mutation_root_sha256(product_id)
from public.catalog_corrections
where id = '58000000-0000-4000-8000-000000000090';
update public.catalog_corrections
set operator_reviewed_at = operator_reviewed_at - interval '1 second'
where id = '58000000-0000-4000-8000-000000000090';
insert into cat03_test_state (state_key, value_text)
select 'hold_projection_root_after',
  private.catalog_launch_current_served_state_mutation_root_sha256(product_id)
from public.catalog_corrections
where id = '58000000-0000-4000-8000-000000000090';

insert into cat03_test_state (state_key, value_text)
select 'hold_status_root_before',
  private.catalog_launch_current_served_state_mutation_root_sha256(product_id)
from public.catalog_corrections
where id = '58000000-0000-4000-8000-000000000090';
update public.catalog_corrections
set status = 'accepted'
where id = '58000000-0000-4000-8000-000000000090';
insert into cat03_test_state (state_key, value_text)
select 'hold_status_root_after',
  private.catalog_launch_current_served_state_mutation_root_sha256(product_id)
from public.catalog_corrections
where id = '58000000-0000-4000-8000-000000000090';

insert into cat03_test_state (state_key, value_text)
select 'hold_reviewer_root_before',
  private.catalog_launch_current_served_state_mutation_root_sha256(product_id)
from public.catalog_corrections
where id = '58000000-0000-4000-8000-000000000090';
update public.catalog_corrections
set operator_reviewed_by = null
where id = '58000000-0000-4000-8000-000000000090';
insert into cat03_test_state (state_key, value_text)
select 'hold_reviewer_root_absent',
  private.catalog_launch_current_served_state_mutation_root_sha256(product_id)
from public.catalog_corrections
where id = '58000000-0000-4000-8000-000000000090';
update public.catalog_corrections
set operator_reviewed_by = 'cat03.correction.reviewer'
where id = '58000000-0000-4000-8000-000000000090';
insert into cat03_test_state (state_key, value_text)
select 'hold_reviewer_root_restored',
  private.catalog_launch_current_served_state_mutation_root_sha256(product_id)
from public.catalog_corrections
where id = '58000000-0000-4000-8000-000000000090';

insert into cat03_test_state (state_key, value_text)
select 'hold_note_root_before',
  private.catalog_launch_current_served_state_mutation_root_sha256(product_id)
from public.catalog_corrections
where id = '58000000-0000-4000-8000-000000000090';
update public.catalog_corrections
set operator_review_note = null
where id = '58000000-0000-4000-8000-000000000090';
insert into cat03_test_state (state_key, value_text)
select 'hold_note_root_absent',
  private.catalog_launch_current_served_state_mutation_root_sha256(product_id)
from public.catalog_corrections
where id = '58000000-0000-4000-8000-000000000090';
update public.catalog_corrections
set operator_review_note = 'Confirmed hold before repaired source review.'
where id = '58000000-0000-4000-8000-000000000090';
insert into cat03_test_state (state_key, value_text)
select 'hold_note_root_restored',
  private.catalog_launch_current_served_state_mutation_root_sha256(product_id)
from public.catalog_corrections
where id = '58000000-0000-4000-8000-000000000090';

insert into cat03_test_state (state_key, value_text)
select 'hold_product_old_root_before',
  private.catalog_launch_current_served_state_mutation_root_sha256(product_id)
from cat03_product_fixture where ordinal = 2;
insert into cat03_test_state (state_key, value_text)
select 'hold_product_new_root_before',
  private.catalog_launch_current_served_state_mutation_root_sha256(product_id)
from cat03_product_fixture where ordinal = 3;
update public.catalog_corrections
set product_id = (
  select product_id from cat03_product_fixture where ordinal = 3
)
where id = '58000000-0000-4000-8000-000000000090';
insert into cat03_test_state (state_key, value_text)
select 'hold_product_old_root_moved',
  private.catalog_launch_current_served_state_mutation_root_sha256(product_id)
from cat03_product_fixture where ordinal = 2;
insert into cat03_test_state (state_key, value_text)
select 'hold_product_new_root_moved',
  private.catalog_launch_current_served_state_mutation_root_sha256(product_id)
from cat03_product_fixture where ordinal = 3;
update public.catalog_corrections
set product_id = (
  select product_id from cat03_product_fixture where ordinal = 2
)
where id = '58000000-0000-4000-8000-000000000090';
insert into cat03_test_state (state_key, value_text)
select 'hold_product_old_root_restored',
  private.catalog_launch_current_served_state_mutation_root_sha256(product_id)
from cat03_product_fixture where ordinal = 2;
insert into cat03_test_state (state_key, value_text)
select 'hold_product_new_root_restored',
  private.catalog_launch_current_served_state_mutation_root_sha256(product_id)
from cat03_product_fixture where ordinal = 3;

select ok(
  (select value_text from cat03_test_state
    where state_key = 'hold_projection_root_before') <>
  (select value_text from cat03_test_state
    where state_key = 'hold_projection_root_after')
  and (select value_text from cat03_test_state
    where state_key = 'hold_status_root_before') <>
  (select value_text from cat03_test_state
    where state_key = 'hold_status_root_after')
  and (select value_text from cat03_test_state
    where state_key = 'hold_reviewer_root_before') <>
  (select value_text from cat03_test_state
    where state_key = 'hold_reviewer_root_absent')
  and (select value_text from cat03_test_state
    where state_key = 'hold_reviewer_root_absent') <>
  (select value_text from cat03_test_state
    where state_key = 'hold_reviewer_root_restored')
  and (select value_text from cat03_test_state
    where state_key = 'hold_note_root_before') <>
  (select value_text from cat03_test_state
    where state_key = 'hold_note_root_absent')
  and (select value_text from cat03_test_state
    where state_key = 'hold_note_root_absent') <>
  (select value_text from cat03_test_state
    where state_key = 'hold_note_root_restored')
  and (select value_text from cat03_test_state
    where state_key = 'hold_product_old_root_before') <>
  (select value_text from cat03_test_state
    where state_key = 'hold_product_old_root_moved')
  and (select value_text from cat03_test_state
    where state_key = 'hold_product_new_root_before') <>
  (select value_text from cat03_test_state
    where state_key = 'hold_product_new_root_moved')
  and (select value_text from cat03_test_state
    where state_key = 'hold_product_old_root_moved') <>
  (select value_text from cat03_test_state
    where state_key = 'hold_product_old_root_restored')
  and (select value_text from cat03_test_state
    where state_key = 'hold_product_new_root_moved') <>
  (select value_text from cat03_test_state
    where state_key = 'hold_product_new_root_restored'),
  'every bounded correction projection lane advances each affected product root'
);

update public.catalog_corrections
   set status = 'closed',
       resolved_by = 'cat03.correction.reviewer',
       resolution_note = 'Repair completed; a new CAT03 campaign is required.',
       operator_reviewed_at = pg_catalog.now(),
       operator_reviewed_by = 'cat03.correction.reviewer',
       operator_review_note = 'Repair completed; a new CAT03 campaign is required.',
       updated_at = pg_catalog.now()
 where id = '58000000-0000-4000-8000-000000000090';
alter table public.catalog_corrections
  enable trigger trg_catalog_corrections_health_write;

insert into cat03_test_state (state_key, value_text)
select 'correction_root_after',
  private.catalog_launch_current_served_state_mutation_root_sha256(
    fixture.product_id
  )
from cat03_product_fixture as fixture
where fixture.ordinal = 2;

select ok(
  (select value_text from cat03_test_state
    where state_key = 'correction_root_before') <>
  (select value_text from cat03_test_state
    where state_key = 'correction_root_after')
  and private.catalog_product_is_servable(
    (select product_id from cat03_product_fixture where ordinal = 2)
  ) is false
  and (
    select count(*) = 10
    from private.catalog_launch_curation_product_mutations as mutation
    where mutation.product_id = (
        select product_id from cat03_product_fixture where ordinal = 2
      )
      and mutation.source_relation = 'public.catalog_corrections'
      and mutation.mutation_kind = 'operator_correction_hold'
  )
  and (
    select count(*) = 2
    from private.catalog_launch_curation_product_mutations as mutation
    where mutation.product_id = (
        select product_id from cat03_product_fixture where ordinal = 3
      )
      and mutation.source_relation = 'public.catalog_corrections'
      and mutation.mutation_kind = 'operator_correction_hold'
  ),
  'operator-confirmed correction hold then close advances the root and cannot resurrect serving'
);

-- A product with no curation record, token, or ingredient link proves the
-- shared source/batch mapper reaches products through active bands alone.
insert into public.products (
  id, name, source, source_ref, source_id, region, status, review_status
)
select
  '58000000-0000-4000-8000-000000000091',
  'CAT03 band-only pre-record fixture',
  'open_beauty_facts',
  'cat03-band-only',
  source.id,
  'US',
  'active',
  'unreviewed'
from public.catalog_sources as source
where source.source_key = 'open_beauty_facts';

insert into public.product_active_bands (
  id, product_id, ingredient_id, tag, band, source_basis,
  evidence_note, source_id, review_status
)
select
  '58000000-0000-4000-8000-000000000092',
  '58000000-0000-4000-8000-000000000091',
  ingredient.ingredient_id,
  'cat03_band_only',
  '1-5%',
  'curated_review',
  'Band-only source and batch propagation regression.',
  source.id,
  'reviewed'
from cat03_ingredient_fixture as ingredient
cross join public.catalog_sources as source
where ingredient.ordinal = 1
  and source.source_key = 'cosing';

insert into public.catalog_import_batches (
  id, source_id, batch_type, snapshot_date, artifact_uri, manifest,
  status, parser_version, created_by
)
select
  '58000000-0000-4000-8000-000000000093',
  source.id,
  'manual_review',
  date '2026-07-18',
  'cat03-test://isolated-band-lineage',
  '{"fixture":"cat03-isolated-band-lineage"}'::jsonb,
  'planned',
  'cat03-isolated-band-v1',
  'cat03.test'
from public.catalog_sources as source
where source.source_key = 'internal_derived';

insert into private.catalog_import_staged_records (
  id, batch_id, record_ordinal, record_kind, natural_key,
  source_payload, normalized_payload, record_sha256
) values (
  '58000000-0000-4000-8000-000000000094',
  '58000000-0000-4000-8000-000000000093',
  1,
  'ingredient',
  'cat03-isolated-band-synonym',
  '{"synonym":"CAT03 isolated band synonym"}'::jsonb,
  '{"normalizedSynonym":"cat03 isolated band synonym"}'::jsonb,
  'aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa'
);

insert into public.ingredient_synonyms (
  id, ingredient_id, synonym, normalized_synonym, source_id, review_status,
  import_batch_id, import_staged_record_id, import_record_ordinal,
  import_record_sha256, import_projection_status
)
select
  '58000000-0000-4000-8000-000000000095',
  ingredient.ingredient_id,
  'CAT03 isolated band synonym',
  'cat03 isolated band synonym',
  source.id,
  'reviewed',
  '58000000-0000-4000-8000-000000000093',
  '58000000-0000-4000-8000-000000000094',
  1,
  'aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa',
  'active'
from cat03_ingredient_fixture as ingredient
cross join public.catalog_sources as source
where ingredient.ordinal = 1
  and source.source_key = 'internal_derived';

insert into public.ingredient_tag_definitions (
  tag, label, tag_group, evidence_grade, consumer_copy,
  reviewed_by, review_status
) values (
  'cat03_isolated_band_route',
  'CAT03 isolated band route',
  'cat03_test',
  'A',
  'CAT03 test-only evidence route.',
  'cat03.test',
  'reviewed'
);
insert into public.ingredient_tag_assignments (
  id, ingredient_id, tag, evidence_label, source_id,
  parser_version, review_status
)
select
  '58000000-0000-4000-8000-000000000096',
  ingredient.ingredient_id,
  'cat03_isolated_band_route',
  'established',
  source.id,
  'cat03-isolated-band-v1',
  'reviewed'
from cat03_ingredient_fixture as ingredient
cross join public.catalog_sources as source
where ingredient.ordinal = 1
  and source.source_key = 'user_local';

insert into cat03_test_state (state_key, value_text)
select 'isolated_synonym_source_name', display_name
from public.catalog_sources where source_key = 'internal_derived';
insert into cat03_test_state (state_key, value_text)
values ('isolated_synonym_source_root_before',
  private.catalog_launch_current_served_state_mutation_root_sha256(
    '58000000-0000-4000-8000-000000000091'
  ));
update public.catalog_sources
set display_name = display_name || ' CAT03 synonym-to-band'
where source_key = 'internal_derived';
update public.catalog_sources
set display_name = (
  select value_text from cat03_test_state
  where state_key = 'isolated_synonym_source_name'
)
where source_key = 'internal_derived';
insert into cat03_test_state (state_key, value_text)
values ('isolated_synonym_source_root_after',
  private.catalog_launch_current_served_state_mutation_root_sha256(
    '58000000-0000-4000-8000-000000000091'
  ));

select ok(
  (select value_text from cat03_test_state
    where state_key = 'isolated_synonym_source_root_before') <>
  (select value_text from cat03_test_state
    where state_key = 'isolated_synonym_source_root_after'),
  'a source reachable only through a reviewed synonym advances the band-only root after exact restoration'
);

insert into cat03_test_state (state_key, value_text)
select 'isolated_assignment_source_name', display_name
from public.catalog_sources where source_key = 'user_local';
insert into cat03_test_state (state_key, value_text)
values ('isolated_assignment_source_root_before',
  private.catalog_launch_current_served_state_mutation_root_sha256(
    '58000000-0000-4000-8000-000000000091'
  ));
update public.catalog_sources
set display_name = display_name || ' CAT03 assignment-to-band'
where source_key = 'user_local';
update public.catalog_sources
set display_name = (
  select value_text from cat03_test_state
  where state_key = 'isolated_assignment_source_name'
)
where source_key = 'user_local';
insert into cat03_test_state (state_key, value_text)
values ('isolated_assignment_source_root_after',
  private.catalog_launch_current_served_state_mutation_root_sha256(
    '58000000-0000-4000-8000-000000000091'
  ));

select ok(
  (select value_text from cat03_test_state
    where state_key = 'isolated_assignment_source_root_before') <>
  (select value_text from cat03_test_state
    where state_key = 'isolated_assignment_source_root_after'),
  'a source reachable only through a reviewed tag assignment advances the band-only root after exact restoration'
);

insert into cat03_test_state (state_key, value_text)
values ('isolated_batch_root_before',
  private.catalog_launch_current_served_state_mutation_root_sha256(
    '58000000-0000-4000-8000-000000000091'
  ));
update public.catalog_import_batches
set status = 'running'
where id = '58000000-0000-4000-8000-000000000093';
update public.catalog_import_batches
set status = 'planned'
where id = '58000000-0000-4000-8000-000000000093';
insert into cat03_test_state (state_key, value_text)
values ('isolated_batch_root_after',
  private.catalog_launch_current_served_state_mutation_root_sha256(
    '58000000-0000-4000-8000-000000000091'
  ));

select ok(
  (select value_text from cat03_test_state
    where state_key = 'isolated_batch_root_before') <>
  (select value_text from cat03_test_state
    where state_key = 'isolated_batch_root_after'),
  'a batch reachable only through synonym lineage advances the band-only root after exact restoration'
);

insert into cat03_test_state (state_key, value_text)
values ('isolated_staged_root_before',
  private.catalog_launch_current_served_state_mutation_root_sha256(
    '58000000-0000-4000-8000-000000000091'
  ));
select pg_catalog.set_config(
  'onskin.catalog_import_transition', '0057-owner-transition', true
);
update private.catalog_import_staged_records
set disposition = 'pending',
    sealed_at = '2026-07-18T12:00:00.000000Z'::timestamptz
where id = '58000000-0000-4000-8000-000000000094';
select pg_catalog.set_config('onskin.catalog_import_transition', '', true);
insert into cat03_test_state (state_key, value_text)
values ('isolated_staged_root_after',
  private.catalog_launch_current_served_state_mutation_root_sha256(
    '58000000-0000-4000-8000-000000000091'
  ));

select ok(
  (select value_text from cat03_test_state
    where state_key = 'isolated_staged_root_before') <>
  (select value_text from cat03_test_state
    where state_key = 'isolated_staged_root_after'),
  'an allowed staged-row seal reachable only through synonym lineage advances the band-only root'
);

select ok(
  (
    select count(*) = 4
    from private.catalog_launch_curation_product_mutations as mutation
    where mutation.product_id =
        '58000000-0000-4000-8000-000000000091'::uuid
      and mutation.source_relation = 'public.catalog_sources'
      and mutation.source_row_key in (
        (select id::text from public.catalog_sources
          where source_key = 'internal_derived'),
        (select id::text from public.catalog_sources
          where source_key = 'user_local')
      )
  )
  and (
    select count(*) = 2
    from private.catalog_launch_curation_product_mutations as mutation
    where mutation.product_id =
        '58000000-0000-4000-8000-000000000091'::uuid
      and mutation.source_relation = 'public.catalog_import_batches'
      and mutation.source_row_key =
        '58000000-0000-4000-8000-000000000093'
  )
  and (
    select count(*) = 1
    from private.catalog_launch_curation_product_mutations as mutation
    where mutation.product_id =
        '58000000-0000-4000-8000-000000000091'::uuid
      and mutation.source_relation = 'private.catalog_import_staged_records'
      and mutation.source_row_key =
        '58000000-0000-4000-8000-000000000094'
  )
  and not exists (
    select 1 from public.product_ingredient_tokens as token
    where token.product_id = '58000000-0000-4000-8000-000000000091'::uuid
  )
  and not exists (
    select 1 from public.product_ingredients as link
    where link.product_id = '58000000-0000-4000-8000-000000000091'::uuid
  )
  and not exists (
    select 1
    from public.products as product
    join public.catalog_sources as source on source.id = product.source_id
    where product.id = '58000000-0000-4000-8000-000000000091'::uuid
      and source.source_key in ('internal_derived', 'user_local')
    union all
    select 1
    from public.product_active_bands as band
    join public.catalog_sources as source on source.id = band.source_id
    where band.product_id = '58000000-0000-4000-8000-000000000091'::uuid
      and source.source_key in ('internal_derived', 'user_local')
    union all
    select 1
    from public.product_active_bands as band
    join public.ingredients as ingredient on ingredient.id = band.ingredient_id
    join public.catalog_sources as source on source.id = ingredient.source_id
    where band.product_id = '58000000-0000-4000-8000-000000000091'::uuid
      and source.source_key in ('internal_derived', 'user_local')
  )
  and not exists (
    select 1
    from public.products as product
    where product.id = '58000000-0000-4000-8000-000000000091'::uuid
      and (
        product.import_batch_id =
          '58000000-0000-4000-8000-000000000093'::uuid
        or product.import_staged_record_id =
          '58000000-0000-4000-8000-000000000094'::uuid
      )
    union all
    select 1
    from public.product_active_bands as band
    join public.ingredients as ingredient on ingredient.id = band.ingredient_id
    where band.product_id = '58000000-0000-4000-8000-000000000091'::uuid
      and (
        ingredient.import_batch_id =
          '58000000-0000-4000-8000-000000000093'::uuid
        or ingredient.import_staged_record_id =
          '58000000-0000-4000-8000-000000000094'::uuid
      )
  ),
  'isolated synonym/tag/source/batch/staged routes reach a band-only pre-record product without direct, token, or link fallback'
);

delete from public.ingredient_tag_assignments
where id = '58000000-0000-4000-8000-000000000096';
delete from public.ingredient_tag_definitions
where tag = 'cat03_isolated_band_route';
delete from public.ingredient_synonyms
where id = '58000000-0000-4000-8000-000000000095';

insert into cat03_test_state (state_key, value_text)
select 'product_root_before',
  private.catalog_launch_current_served_state_mutation_root_sha256(product_id)
from cat03_product_fixture where ordinal = 4;
update public.products
set name = name || ' CAT03 exact restoration'
where id = (select product_id from cat03_product_fixture where ordinal = 4);
update public.products
set name = pg_catalog.regexp_replace(name, ' CAT03 exact restoration$', '')
where id = (select product_id from cat03_product_fixture where ordinal = 4);
insert into cat03_test_state (state_key, value_text)
select 'product_root_after',
  private.catalog_launch_current_served_state_mutation_root_sha256(product_id)
from cat03_product_fixture where ordinal = 4;

select ok(
  (select value_text from cat03_test_state where state_key = 'product_root_before') <>
  (select value_text from cat03_test_state where state_key = 'product_root_after'),
  'arbitrary full product-row mutation then exact restoration advances the root'
);

insert into cat03_test_state (state_key, value_text)
select 'dependency_root_before',
  private.catalog_launch_current_served_state_mutation_root_sha256(product_id)
from cat03_product_fixture where ordinal = 5;
update public.product_ingredient_tokens
set raw_token = raw_token || ' CAT03 exact restoration'
where product_id = (select product_id from cat03_product_fixture where ordinal = 5)
  and position = 1;
update public.product_ingredient_tokens
set raw_token = pg_catalog.regexp_replace(
  raw_token, ' CAT03 exact restoration$', ''
)
where product_id = (select product_id from cat03_product_fixture where ordinal = 5)
  and position = 1;
insert into cat03_test_state (state_key, value_text)
select 'dependency_root_after',
  private.catalog_launch_current_served_state_mutation_root_sha256(product_id)
from cat03_product_fixture where ordinal = 5;

select ok(
  (select value_text from cat03_test_state where state_key = 'dependency_root_before') <>
  (select value_text from cat03_test_state where state_key = 'dependency_root_after'),
  'arbitrary full dependency-row mutation then exact restoration advances the root'
);

select throws_ok(
  $$select pg_temp.cat03_insert_planned_records(
    '58000000-0000-4000-8000-000000000082'::uuid
  )$$,
  '55000',
  'CATALOG_LAUNCH_CURATION_SERVED_STATE_MUTATION_ROOT_STALE',
  'pre-mutation reviewer roots cannot be inserted after exact restoration'
);

select throws_ok(
  $$select pg_temp.cat03_release_campaign(
    '58000000-0000-4000-8000-000000000080'::uuid
  )$$,
  '22023',
  'CATALOG_LAUNCH_CURATION_CAMPAIGN_RELEASE_REPLAY_CHANGED',
  'released campaign replay rejects roots made stale by later mutations'
);

select is(
  pg_temp.cat03_publication_seal_mutation_results(
    pg_catalog.current_setting('app.cat03_test_product_id')::uuid
  ),
  '{
    "activeBandInsertionStillServable": false,
    "brandWebsiteMutationStillServable": false,
    "defaultPaoMutationStillServable": false,
    "ingredientSafetyMutationStillServable": false,
    "linkDeletionStillServable": false,
    "paoInsertionStillServable": false,
    "sourceDisplayMutationStillServable": false,
    "synonymInsertionStillServable": false,
    "tokenMutationStillServable": false
  }'::jsonb,
  'every product/dependency publication drift lane fails closed'
);

-- ---------------------------------------------------------------------------
-- Successor staging, atomic flip, and global retirement
-- ---------------------------------------------------------------------------

update public.products
set review_status = 'reviewed',
    data_quality_score = 99,
    ingredient_quality_score = 99,
    barcode_quality_score = 99,
    category_quality_score = 99,
    quality_grade = 'verified',
    recommendation_eligible = true,
    last_reviewed_at = pg_catalog.now()
where id = (
  select value_uuid from cat03_test_state where state_key = 'successor_product'
);

select pg_temp.cat03_prepare_campaign(
  '58000000-0000-4000-8000-000000000081',
  'cat03-successor',
  true
);

select is(
  (
    select pg_catalog.jsonb_build_object(
      'reviewed', count(*),
      'approved', count(*) filter (
        where record.activation_decision = 'approve_activation'
      ),
      'withheld', count(*) filter (
        where record.activation_decision = 'withhold_activation'
      ),
      'newProductValid', pg_catalog.bool_and(
        private.catalog_launch_curation_record_is_valid(record.id)
      ) filter (
        where record.product_id = (
          select value_uuid from cat03_test_state
          where state_key = 'successor_product'
        )
      ),
      'oldProductWithheld', pg_catalog.bool_and(
        record.activation_decision = 'withhold_activation'
      ) filter (
        where record.product_id = (
          select value_uuid from cat03_test_state
          where state_key = 'test_product'
        )
      )
    )
    from private.catalog_launch_curation_records as record
    where record.campaign_id = '58000000-0000-4000-8000-000000000081'
  ),
  '{"approved":2000,"newProductValid":true,"oldProductWithheld":true,"reviewed":2001,"withheld":1}'::jsonb,
  'successor replaces one held row while preserving exact 2,001/2,000 cardinality'
);

with staged as materialized (
  select pg_temp.cat03_stage_product(
    '58000000-0000-4000-8000-000000000081',
    (select value_uuid from cat03_test_state where state_key = 'successor_product')
  ) as value
)
select ok(
  (
    select
      staged.value ->> 'replayed' = 'false'
      and (
        select head.campaign_id =
          '58000000-0000-4000-8000-000000000080'::uuid
        from private.catalog_launch_curation_campaign_release_heads as head
        where head.territory = 'US'
      )
      and private.catalog_product_is_servable(
        (select value_uuid from cat03_test_state where state_key = 'test_product')
      ) is false
      and private.catalog_product_is_servable(
        (select value_uuid from cat03_test_state where state_key = 'successor_product')
      ) is false
    from staged
  ),
  'successor staging leaves the old release head selected but the stale-root campaign globally non-serving'
);

set local role authenticated;
select is(
  pg_catalog.jsonb_build_object(
    'oldProduct', (
      select count(*) from public.products
      where id = pg_catalog.current_setting(
        'app.cat03_test_product_id'
      )::uuid
    ),
    'successorProduct', (
      select count(*) from public.products
      where id = pg_catalog.current_setting(
        'app.cat03_successor_product_id'
      )::uuid
    ),
    'successorList', (
      select count(*) from public.product_ingredient_lists
      where product_id = pg_catalog.current_setting(
        'app.cat03_successor_product_id'
      )::uuid
    )
  ),
  '{"oldProduct":0,"successorList":0,"successorProduct":0}'::jsonb,
  'authenticated RLS denies both stale-campaign and successor-staged products before the global flip'
);
reset role;

select ok(
  (
    select
      release.value ->> 'replayed' = 'false'
      and release.value ->> 'campaign_id' =
        '58000000-0000-4000-8000-000000000081'
      and release.value ->> 'head_generation' = '2'
    from (
      select pg_temp.cat03_release_campaign(
        '58000000-0000-4000-8000-000000000081'
      ) as value
    ) as release
  ),
  'one successor release atomically flips the complete serving campaign'
);

select is(
  pg_catalog.jsonb_build_object(
    'campaign', (
      select head.campaign_id
      from private.catalog_launch_curation_campaign_release_heads as head
      where head.territory = 'US'
    ),
    'generation', (
      select head.generation
      from private.catalog_launch_curation_campaign_release_heads as head
      where head.territory = 'US'
    ),
    'primaryHeads', (
      select count(*) from private.catalog_launch_curation_heads as head
      where head.campaign_id = '58000000-0000-4000-8000-000000000080'
    ),
    'successorHeads', (
      select count(*) from private.catalog_launch_curation_heads as head
      where head.campaign_id = '58000000-0000-4000-8000-000000000081'
    ),
    'oldServable', private.catalog_product_is_servable(
      (select value_uuid from cat03_test_state where state_key = 'test_product')
    ),
    'newServable', private.catalog_product_is_servable(
      (select value_uuid from cat03_test_state where state_key = 'successor_product')
    ),
    'invalidatedProductRecovered', private.catalog_product_is_servable(
      (select product_id from cat03_product_fixture where ordinal = 2)
    ),
    'eventType', (
      select event.event_type
      from private.catalog_launch_curation_campaign_release_events as event
      join private.catalog_launch_curation_campaign_release_heads as head
        on head.last_event_id = event.id
      where head.territory = 'US'
    )
  ),
  '{"campaign":"58000000-0000-4000-8000-000000000081","eventType":"supersession","generation":2,"invalidatedProductRecovered":true,"newServable":true,"oldServable":false,"primaryHeads":2000,"successorHeads":2000}'::jsonb,
  'generation two recovers only through new records while preserving immutable historical heads'
);

set local role authenticated;
select is(
  pg_catalog.jsonb_build_object(
    'oldProduct', (
      select count(*) from public.products
      where id = pg_catalog.current_setting(
        'app.cat03_test_product_id'
      )::uuid
    ),
    'newProduct', (
      select count(*) from public.products
      where id = pg_catalog.current_setting(
        'app.cat03_successor_product_id'
      )::uuid
    ),
    'newBarcode', (
      select count(*) from public.product_barcodes
      where barcode = pg_catalog.current_setting(
        'app.cat03_successor_barcode'
      )
    ),
    'newList', (
      select count(*) from public.product_ingredient_lists
      where product_id = pg_catalog.current_setting(
        'app.cat03_successor_product_id'
      )::uuid
    )
  ),
  '{"newBarcode":1,"newList":1,"newProduct":1,"oldProduct":0}'::jsonb,
  'authenticated RLS observes the atomic successor swap with no mixed campaign rows'
);
reset role;

select pg_temp.cat03_retire_campaign(
  '58000000-0000-4000-8000-000000000081'
);

set local role authenticated;
select is(
  pg_catalog.jsonb_build_object(
    'oldProduct', (
      select count(*) from public.products
      where id = pg_catalog.current_setting(
        'app.cat03_test_product_id'
      )::uuid
    ),
    'newProduct', (
      select count(*) from public.products
      where id = pg_catalog.current_setting(
        'app.cat03_successor_product_id'
      )::uuid
    ),
    'newBarcode', (
      select count(*) from public.product_barcodes
      where barcode = pg_catalog.current_setting(
        'app.cat03_successor_barcode'
      )
    ),
    'newList', (
      select count(*) from public.product_ingredient_lists
      where product_id = pg_catalog.current_setting(
        'app.cat03_successor_product_id'
      )::uuid
    )
  ),
  '{"newBarcode":0,"newList":0,"newProduct":0,"oldProduct":0}'::jsonb,
  'campaign retirement immediately suppresses every authenticated product and child row'
);
reset role;

select * from finish();
rollback;
