-- =============================================================================
-- 0058 - Sealed launch-catalog curation authority
-- =============================================================================
-- CAT-02 promotion deliberately leaves imported rows needs_review/unverified.
-- A mutable product flag is never publication authority.  This migration adds
-- an immutable, hash-bound curation ledger and makes one exact active curation
-- head a positive requirement for every product-serving path.

create schema if not exists private;

-- The target policy is data, not an ambient setting.  Safe floors prevent a
-- later campaign from weakening the launch gate while its exact canonical hash
-- binds the thresholds reviewed outside the database.
create or replace function private.catalog_launch_curation_target_policy(
  p_required_quality_grade text,
  p_minimum_data_quality_score numeric,
  p_minimum_ingredient_quality_score numeric,
  p_minimum_barcode_quality_score numeric,
  p_minimum_category_quality_score numeric,
  p_minimum_parse_confidence numeric,
  p_minimum_token_match_confidence numeric,
  p_minimum_mapped_ingredient_count integer
)
returns jsonb
language sql
immutable
security definer
set search_path = ''
as $$
  select pg_catalog.jsonb_build_object(
    'contractId', 'catalog-launch-db-eligibility-policy-v1',
    'territory', 'US',
    'requiredQualityGrade', p_required_quality_grade,
    'minimumDataQualityScore', p_minimum_data_quality_score::numeric(5,2),
    'minimumIngredientQualityScore', p_minimum_ingredient_quality_score::numeric(5,2),
    'minimumBarcodeQualityScore', p_minimum_barcode_quality_score::numeric(5,2),
    'minimumCategoryQualityScore', p_minimum_category_quality_score::numeric(5,2),
    'minimumParseConfidence', p_minimum_parse_confidence::numeric(5,4),
    'minimumTokenMatchConfidence', p_minimum_token_match_confidence::numeric(5,4),
    'minimumMappedIngredientCount', p_minimum_mapped_ingredient_count,
    'requireBarcode', true,
    'regulatedCategoryMode', 'qualified-review-required'
  )
$$;

-- jsonb values retain PostgreSQL numeric scale today, but that storage detail
-- is not the cross-runtime contract. Build the exact UTF-8 policy bytes with
-- explicit 2/4-decimal tokens so JavaScript and PostgreSQL sign identical
-- numbers on every supported server version and locale.
create or replace function private.catalog_launch_curation_target_policy_canonical_text(
  p_required_quality_grade text,
  p_minimum_data_quality_score numeric,
  p_minimum_ingredient_quality_score numeric,
  p_minimum_barcode_quality_score numeric,
  p_minimum_category_quality_score numeric,
  p_minimum_parse_confidence numeric,
  p_minimum_token_match_confidence numeric,
  p_minimum_mapped_ingredient_count integer
)
returns text
language sql
immutable
security definer
set search_path = ''
as $$
  select '{"contractId":"catalog-launch-db-eligibility-policy-v1"'
    || ',"minimumBarcodeQualityScore":'
    || (p_minimum_barcode_quality_score::numeric(5,2))::text
    || ',"minimumCategoryQualityScore":'
    || (p_minimum_category_quality_score::numeric(5,2))::text
    || ',"minimumDataQualityScore":'
    || (p_minimum_data_quality_score::numeric(5,2))::text
    || ',"minimumIngredientQualityScore":'
    || (p_minimum_ingredient_quality_score::numeric(5,2))::text
    || ',"minimumMappedIngredientCount":'
    || p_minimum_mapped_ingredient_count::text
    || ',"minimumParseConfidence":'
    || (p_minimum_parse_confidence::numeric(5,4))::text
    || ',"minimumTokenMatchConfidence":'
    || (p_minimum_token_match_confidence::numeric(5,4))::text
    || ',"regulatedCategoryMode":"qualified-review-required"'
    || ',"requireBarcode":true'
    || ',"requiredQualityGrade":'
    || pg_catalog.to_jsonb(p_required_quality_grade)::text
    || ',"territory":"US"}'
$$;

create or replace function private.catalog_launch_curation_target_policy_sha256(
  p_required_quality_grade text,
  p_minimum_data_quality_score numeric,
  p_minimum_ingredient_quality_score numeric,
  p_minimum_barcode_quality_score numeric,
  p_minimum_category_quality_score numeric,
  p_minimum_parse_confidence numeric,
  p_minimum_token_match_confidence numeric,
  p_minimum_mapped_ingredient_count integer
)
returns text
language sql
immutable
security definer
set search_path = ''
as $$
  select private.catalog_import_sha256_text(
    private.catalog_launch_curation_target_policy_canonical_text(
      p_required_quality_grade,
      p_minimum_data_quality_score,
      p_minimum_ingredient_quality_score,
      p_minimum_barcode_quality_score,
      p_minimum_category_quality_score,
      p_minimum_parse_confidence,
      p_minimum_token_match_confidence,
      p_minimum_mapped_ingredient_count
    )
  )
$$;

create or replace function private.catalog_launch_curation_category_floors_are_valid(
  p_floors jsonb
)
returns boolean
language sql
immutable
security definer
set search_path = ''
as $$
  select coalesce(
    pg_catalog.jsonb_typeof(p_floors) = 'object'
    and p_floors ?& array[
      'acne_treatment', 'cleanser', 'moisturizer',
      'serum', 'sunscreen', 'toner'
    ]
    and (p_floors - array[
      'acne_treatment', 'cleanser', 'moisturizer',
      'serum', 'sunscreen', 'toner'
    ]::text[]) = '{}'::jsonb
    and pg_catalog.jsonb_typeof(p_floors -> 'acne_treatment') = 'number'
    and pg_catalog.jsonb_typeof(p_floors -> 'cleanser') = 'number'
    and pg_catalog.jsonb_typeof(p_floors -> 'moisturizer') = 'number'
    and pg_catalog.jsonb_typeof(p_floors -> 'serum') = 'number'
    and pg_catalog.jsonb_typeof(p_floors -> 'sunscreen') = 'number'
    and pg_catalog.jsonb_typeof(p_floors -> 'toner') = 'number'
    and (p_floors ->> 'acne_treatment')::integer > 0
    and (p_floors ->> 'cleanser')::integer > 0
    and (p_floors ->> 'moisturizer')::integer > 0
    and (p_floors ->> 'serum')::integer > 0
    and (p_floors ->> 'sunscreen')::integer > 0
    and (p_floors ->> 'toner')::integer > 0
    and (p_floors ->> 'acne_treatment')::numeric
      = (p_floors ->> 'acne_treatment')::integer
    and (p_floors ->> 'cleanser')::numeric = (p_floors ->> 'cleanser')::integer
    and (p_floors ->> 'moisturizer')::numeric = (p_floors ->> 'moisturizer')::integer
    and (p_floors ->> 'serum')::numeric = (p_floors ->> 'serum')::integer
    and (p_floors ->> 'sunscreen')::numeric = (p_floors ->> 'sunscreen')::integer
    and (p_floors ->> 'toner')::numeric = (p_floors ->> 'toner')::integer
    and (
      (p_floors ->> 'acne_treatment')::integer
      + (p_floors ->> 'cleanser')::integer
      + (p_floors ->> 'moisturizer')::integer
      + (p_floors ->> 'serum')::integer
      + (p_floors ->> 'sunscreen')::integer
      + (p_floors ->> 'toner')::integer
    ) >= 2000,
    false
  )
$$;

create or replace function private.catalog_launch_curation_cat02_artifact_sha256(
  p_artifact_set jsonb
)
returns text
language sql
immutable
security definer
set search_path = ''
as $$
  select private.catalog_import_sha256_text(
    private.catalog_import_canonical_json(
      pg_catalog.jsonb_build_object(
        'contractId', 'catalog-cat02-curation-artifact-set-v1',
        'artifactSet', p_artifact_set
      )
    )
  )
$$;

create or replace function private.catalog_launch_curation_cat02_artifact_set_sha256(
  p_artifact_sets jsonb
)
returns text
language sql
immutable
security definer
set search_path = ''
as $$
  select private.catalog_import_sha256_text(
    private.catalog_import_canonical_json(
      pg_catalog.jsonb_build_object(
        'contractId', 'catalog-cat02-curation-complete-artifact-set-v1',
        'artifactSets', p_artifact_sets
      )
    )
  )
$$;

create or replace function private.catalog_launch_curation_contributing_batch_set_sha256(
  p_artifact_sets jsonb
)
returns text
language sql
immutable
security definer
set search_path = ''
as $$
  select private.catalog_import_sha256_text(
    private.catalog_import_canonical_json(
      pg_catalog.jsonb_build_object(
        'contractId', 'catalog-cat02-contributing-batch-set-v1',
        'batches', p_artifact_sets
      )
    )
  )
$$;

create or replace function private.catalog_launch_curation_cat02_membership_set_sha256(
  p_members jsonb
)
returns text
language sql
immutable
security definer
set search_path = ''
as $$
  select private.catalog_import_sha256_text(
    private.catalog_import_canonical_json(
      pg_catalog.jsonb_build_object(
        'contractId', 'catalog-curation-cat02-membership-set-v1',
        'members', p_members
      )
    )
  )
$$;

create or replace function private.catalog_launch_curation_membership_readback_sha256(
  p_product_record_sha256 text,
  p_memberships jsonb
)
returns text
language sql
immutable
security definer
set search_path = ''
as $$
  select private.catalog_import_sha256_text(
    private.catalog_import_canonical_json(
      pg_catalog.jsonb_build_object(
        'contractId', 'catalog-cat02-membership-readback-v1',
        'productRecordSha256', p_product_record_sha256,
        'memberships', p_memberships
      )
    )
  )
$$;

create or replace function private.catalog_launch_curation_membership_database_sha256(
  p_product_record_sha256 text,
  p_field_scope text,
  p_dependency_entity_sha256 text,
  p_barcode text,
  p_category_code text,
  p_product_snapshot_sha256 text,
  p_dependency_sha256 text,
  p_regulatory_classification text,
  p_regulatory_review_evidence_sha256 text,
  p_regulatory_reviewer_ids text[]
)
returns text
language sql
immutable
security definer
set search_path = ''
as $$
  select private.catalog_import_sha256_text(
    private.catalog_import_canonical_json(
      pg_catalog.jsonb_build_object(
        'contractId',
          'catalog-launch-curation-cat02-database-normalized-record-v1',
        'productRecordSha256', p_product_record_sha256,
        'fieldScope', p_field_scope,
        'snapshot', case p_field_scope
          when 'barcode_identity' then pg_catalog.jsonb_build_object(
            'barcode', p_barcode,
            'dependencyEntitySha256', p_dependency_entity_sha256,
            'productSnapshotSha256', p_product_snapshot_sha256
          )
          when 'category' then pg_catalog.jsonb_build_object(
            'categoryCode', p_category_code,
            'dependencyEntitySha256', p_dependency_entity_sha256,
            'productSnapshotSha256', p_product_snapshot_sha256
          )
          when 'ingredients' then pg_catalog.jsonb_build_object(
            'dependencySha256', p_dependency_sha256,
            'dependencyEntitySha256', p_dependency_entity_sha256,
            'productSnapshotSha256', p_product_snapshot_sha256
          )
          when 'regulatory_classification' then pg_catalog.jsonb_build_object(
            'categoryCode', p_category_code,
            'dependencyEntitySha256', p_dependency_entity_sha256,
            'regulatoryClassification', p_regulatory_classification,
            'regulatoryReviewEvidenceSha256',
              p_regulatory_review_evidence_sha256,
            'regulatoryReviewerIds',
              pg_catalog.to_jsonb(p_regulatory_reviewer_ids)
          )
          else 'null'::jsonb
        end
      )
    )
  )
$$;

create or replace function private.catalog_launch_curation_dependency_entity_sha256(
  p_product_record_sha256 text,
  p_field_scope text,
  p_entity_type text,
  p_entity_id text,
  p_projection_sha256 text
)
returns text
language sql
immutable
security definer
set search_path = ''
as $$
  select private.catalog_import_sha256_text(
    private.catalog_import_canonical_json(
      pg_catalog.jsonb_build_object(
        'contractId', 'catalog-cat02-retained-dependency-entity-v1',
        'productRecordSha256', p_product_record_sha256,
        'fieldScope', p_field_scope,
        'entityType', p_entity_type,
        'entityId', p_entity_id,
        'projectionSha256', p_projection_sha256
      )
    )
  )
$$;

-- 0057 retains the database-owned chunk, review, promotion, effect, and
-- revision ledgers.  This digest is the canonical DB-side corroboration of a
-- contributing production batch.  External stage/completion/signature bytes
-- remain verified by the signed CAT-02 proof bound separately below.
create or replace function private.catalog_launch_curation_production_integrity_evidence_sha256(
  p_batch_id uuid
)
returns text
language sql
stable
security definer
set search_path = ''
as $$
  select private.catalog_import_sha256_text(
    private.catalog_import_canonical_json(
      pg_catalog.jsonb_build_object(
        'contractId',
          'catalog-cat02-production-batch-integrity-evidence-v1',
        'batchId', batch.id,
        'batchEvidenceSha256',
          private.catalog_import_batch_evidence_sha256(batch.id),
        'batchIntegrityVerified',
          private.catalog_import_batch_integrity(batch.id),
        'artifactKind', batch.artifact_kind,
        'territory', batch.territory,
        'status', batch.status,
        'recordsArtifactSha256', batch.records_sha256,
        'candidatesArtifactSha256', batch.candidates_sha256,
        'verificationEvidenceSha256', batch.verification_evidence_sha256,
        'reviewRequestSha256', batch.review_request_sha256,
        'reviewEvidenceSha256', batch.review_evidence_sha256,
        'chunkReceiptSetSha256', private.catalog_import_sha256_text(
          private.catalog_import_canonical_json(
            pg_catalog.jsonb_build_object(
              'contractId', 'catalog-cat02-retained-chunk-receipt-set-v1',
              'receipts', coalesce((
                select pg_catalog.jsonb_agg(
                  pg_catalog.jsonb_build_object(
                    'operationKey', receipt.operation_key,
                    'requestSha256', receipt.request_sha256,
                    'chunkOrdinal', receipt.chunk_ordinal,
                    'firstRecordOrdinal', receipt.first_record_ordinal,
                    'recordCount', receipt.record_count,
                    'chunkSha256', receipt.chunk_sha256
                  ) order by receipt.chunk_ordinal
                )
                from private.catalog_import_chunk_receipts as receipt
                where receipt.batch_id = batch.id
              ), '[]'::jsonb)
            )
          )
        ),
        'reviewEventSetSha256', private.catalog_import_sha256_text(
          private.catalog_import_canonical_json(
            pg_catalog.jsonb_build_object(
              'contractId', 'catalog-cat02-retained-review-event-set-v1',
              'events', coalesce((
                select pg_catalog.jsonb_agg(
                  pg_catalog.jsonb_build_object(
                    'stagedRecordSha256', staged.record_sha256,
                    'decision', review.decision,
                    'reviewTicket', review.review_ticket,
                    'reviewedBy', review.reviewed_by,
                    'reviewEvidenceSha256',
                      review.review_evidence_sha256,
                    'requestSha256', review.request_sha256
                  ) order by staged.record_ordinal
                )
                from private.catalog_import_review_events as review
                join private.catalog_import_staged_records as staged
                  on staged.id = review.staged_record_id
                 and staged.batch_id = review.batch_id
                where review.batch_id = batch.id
              ), '[]'::jsonb)
            )
          )
        ),
        'promotionReceiptSha256', private.catalog_import_sha256_text(
          private.catalog_import_canonical_json(
            pg_catalog.jsonb_build_object(
              'contractId', 'catalog-cat02-retained-promotion-event-v1',
              'event', pg_catalog.jsonb_build_object(
                'operationKey', promotion.operation_key,
                'requestSha256', promotion.request_sha256,
                'actor', promotion.actor,
                'reviewTicket', promotion.review_ticket,
                'reviewEvidenceSha256', promotion.review_evidence_sha256,
                'affectedEntityCount', promotion.affected_entity_count
              )
            )
          )
        ),
        'projectionReceiptSetSha256', private.catalog_import_sha256_text(
          private.catalog_import_canonical_json(
            pg_catalog.jsonb_build_object(
              'contractId',
                'catalog-cat02-retained-projection-receipt-set-v1',
              'projections', coalesce((
                select pg_catalog.jsonb_agg(
                  pg_catalog.jsonb_build_object(
                    'stagedRecordSha256', staged.record_sha256,
                    'entityType', revision.entity_type,
                    'entityId', revision.entity_id,
                    'revisionNumber', revision.revision_number,
                    'revisionAction', revision.revision_action,
                    'projectionSha256', revision.projection_sha256,
                    'effectType', effect.effect_type,
                    'beforeSha256', effect.before_sha256,
                    'afterSha256', effect.after_sha256
                  ) order by staged.record_ordinal,
                    revision.entity_type, revision.entity_id,
                    revision.revision_number
                )
                from private.catalog_import_entity_revisions as revision
                join private.catalog_import_batch_effects as effect
                  on effect.batch_id = revision.batch_id
                 and effect.staged_record_id = revision.staged_record_id
                 and effect.promotion_event_id = revision.promotion_event_id
                 and effect.entity_type = revision.entity_type
                 and effect.entity_id = revision.entity_id
                 and effect.effect_type = revision.revision_action
                 and effect.after_sha256 = revision.projection_sha256
                join private.catalog_import_staged_records as staged
                  on staged.id = revision.staged_record_id
                 and staged.batch_id = revision.batch_id
                where revision.batch_id = batch.id
              ), '[]'::jsonb)
            )
          )
        ),
        'promotedAt', pg_catalog.to_char(
          batch.promoted_at at time zone 'UTC',
          'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"'
        )
      )
    )
  )
  from public.catalog_import_batches as batch
  join private.catalog_import_promotion_events as promotion
    on promotion.batch_id = batch.id
   and promotion.event_type = 'promotion'
  where batch.id = p_batch_id
$$;

create or replace function private.catalog_launch_curation_cat02_production_integrity_set_sha256(
  p_artifact_sets jsonb
)
returns text
language sql
immutable
security definer
set search_path = ''
as $$
  select private.catalog_import_sha256_text(
    private.catalog_import_canonical_json(
      pg_catalog.jsonb_build_object(
        'contractId', 'catalog-cat02-production-batch-integrity-set-v1',
        'batches', coalesce((
          select pg_catalog.jsonb_agg(
            pg_catalog.jsonb_build_object(
              'batchId', artifact.value ->> 'batchId',
              'batchEvidenceSha256',
                artifact.value ->> 'batchEvidenceSha256',
              'productionIntegrityEvidenceSha256',
                artifact.value ->> 'productionIntegrityEvidenceSha256'
            ) order by artifact.value ->> 'batchId'
          )
          from pg_catalog.jsonb_array_elements(p_artifact_sets)
            as artifact(value)
        ), '[]'::jsonb)
      )
    )
  )
$$;

create or replace function private.catalog_launch_curation_cat02_artifact_sets_are_live(
  p_artifact_sets jsonb,
  p_contributing_batch_ids uuid[]
)
returns boolean
language plpgsql
stable
security definer
set search_path = ''
set timezone = 'UTC'
as $$
declare
  v_item record;
  v_batch_id uuid;
  v_previous_batch_id text;
begin
  if pg_catalog.jsonb_typeof(p_artifact_sets) <> 'array'
     or pg_catalog.jsonb_array_length(p_artifact_sets) < 1
     or pg_catalog.jsonb_array_length(p_artifact_sets) > 100000
     or pg_catalog.jsonb_array_length(p_artifact_sets)
       <> pg_catalog.cardinality(p_contributing_batch_ids) then
    return false;
  end if;
  for v_item in
    select artifact.value, artifact.ordinality
    from pg_catalog.jsonb_array_elements(p_artifact_sets)
      with ordinality as artifact(value, ordinality)
    order by artifact.ordinality
  loop
    if pg_catalog.jsonb_typeof(v_item.value) <> 'object'
       or not (v_item.value ?& array[
         'batchId', 'batchEvidenceSha256', 'recordsArtifactSha256',
         'candidatesArtifactSha256', 'stageEnvelopeSha256',
         'databaseReceiptCompletionSha256', 'promotionReceiptSha256',
         'qaReportSha256', 'artifactKind',
         'productionIntegrityEvidenceSha256'
       ])
       or (v_item.value - array[
         'batchId', 'batchEvidenceSha256', 'recordsArtifactSha256',
         'candidatesArtifactSha256', 'stageEnvelopeSha256',
         'databaseReceiptCompletionSha256', 'promotionReceiptSha256',
         'qaReportSha256', 'artifactKind',
         'productionIntegrityEvidenceSha256'
       ]::text[]) <> '{}'::jsonb
       or (v_item.value ->> 'batchId')
         !~ '^[a-f0-9]{8}-[a-f0-9]{4}-[1-8][a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$'
       or (v_item.value ->> 'batchEvidenceSha256') !~ '^[a-f0-9]{64}$'
       or (v_item.value ->> 'recordsArtifactSha256') !~ '^[a-f0-9]{64}$'
       or (v_item.value ->> 'candidatesArtifactSha256') !~ '^[a-f0-9]{64}$'
       or (v_item.value ->> 'stageEnvelopeSha256') !~ '^[a-f0-9]{64}$'
       or (v_item.value ->> 'databaseReceiptCompletionSha256')
         !~ '^[a-f0-9]{64}$'
       or (v_item.value ->> 'promotionReceiptSha256') !~ '^[a-f0-9]{64}$'
       or (v_item.value ->> 'qaReportSha256') !~ '^[a-f0-9]{64}$'
       or v_item.value ->> 'artifactKind' <> 'production'
       or (v_item.value ->> 'productionIntegrityEvidenceSha256')
         !~ '^[a-f0-9]{64}$' then
      return false;
    end if;
    v_batch_id := (v_item.value ->> 'batchId')::uuid;
    if v_batch_id <> p_contributing_batch_ids[v_item.ordinality::integer]
       or (v_previous_batch_id is not null
         and v_previous_batch_id >= v_batch_id::text) then
      return false;
    end if;
    v_previous_batch_id := v_batch_id::text;
    if not exists (
      select 1
      from public.catalog_import_batches as batch
      where batch.id = v_batch_id
        and batch.status = 'promoted'
        and batch.artifact_kind = 'production'
        and batch.territory = 'US'
        and batch.promoted_at is not null
        and batch.qa_blocker_count = 0
        and batch.qa_warning_count = 0
        and batch.accepted_record_count = batch.expected_record_count
        and batch.rejected_record_count = 0
        and batch.duplicate_record_count = 0
        and batch.conflict_record_count = 0
        and private.catalog_import_batch_integrity(batch.id)
        and private.catalog_source_is_production_approved(batch.source_id)
        and private.catalog_import_batch_evidence_sha256(batch.id)
          = v_item.value ->> 'batchEvidenceSha256'
        and batch.records_sha256 = v_item.value ->> 'recordsArtifactSha256'
        and batch.candidates_sha256 = v_item.value ->> 'candidatesArtifactSha256'
        and batch.qa_report_sha256 = v_item.value ->> 'qaReportSha256'
        and batch.artifact_kind = v_item.value ->> 'artifactKind'
        and private.catalog_launch_curation_production_integrity_evidence_sha256(
          batch.id
        ) = v_item.value ->> 'productionIntegrityEvidenceSha256'
        and (
          select count(*)
          from private.catalog_import_review_events as review
          join private.catalog_import_staged_records as staged
            on staged.id = review.staged_record_id
           and staged.batch_id = review.batch_id
          where review.batch_id = batch.id
            and review.decision = 'accepted'
            and review.review_ticket = batch.review_ticket
            and review.reviewed_by = batch.reviewed_by
            and review.review_evidence_sha256 = batch.review_evidence_sha256
            and review.request_sha256 = batch.review_request_sha256
            and staged.disposition = 'accepted'
        ) = batch.accepted_record_count
        and (
          select count(*)
          from private.catalog_import_promotion_events as promotion
          where promotion.batch_id = batch.id
            and promotion.event_type = 'promotion'
            and promotion.review_ticket = batch.review_ticket
            and promotion.review_evidence_sha256 = batch.review_evidence_sha256
            and promotion.request_sha256 = private.catalog_import_sha256_text(
              pg_catalog.jsonb_build_object(
                'batchId', batch.id,
                'operationKey', promotion.operation_key,
                'operator', promotion.actor,
                'reviewTicket', promotion.review_ticket,
                'reviewEvidenceSha256', promotion.review_evidence_sha256
              )::text
            )
            and promotion.affected_entity_count = (
              select count(*)
              from private.catalog_import_batch_effects as effect
              where effect.promotion_event_id = promotion.id
                and effect.batch_id = batch.id
            )
            and not exists (
              select 1
              from private.catalog_import_batch_effects as effect
              left join private.catalog_import_entity_revisions as revision
                on revision.batch_id = effect.batch_id
               and revision.staged_record_id = effect.staged_record_id
               and revision.promotion_event_id = effect.promotion_event_id
               and revision.entity_type = effect.entity_type
               and revision.entity_id = effect.entity_id
               and revision.revision_action = effect.effect_type
               and revision.projection_sha256 = effect.after_sha256
              where effect.promotion_event_id = promotion.id
                and effect.batch_id = batch.id
                and revision.id is null
            )
            and not exists (
              select 1
              from private.catalog_import_entity_revisions as revision
              left join private.catalog_import_batch_effects as effect
                on effect.batch_id = revision.batch_id
               and effect.staged_record_id = revision.staged_record_id
               and effect.promotion_event_id = revision.promotion_event_id
               and effect.entity_type = revision.entity_type
               and effect.entity_id = revision.entity_id
               and effect.effect_type = revision.revision_action
               and effect.after_sha256 = revision.projection_sha256
              where revision.promotion_event_id = promotion.id
                and revision.batch_id = batch.id
                and effect.id is null
            )
        ) = 1
    ) then
      return false;
    end if;
  end loop;
  return true;
exception when others then
  return false;
end;
$$;

-- Recompute one membership root exclusively from 0057 rows that survived the
-- production lifecycle.  Product/category/regulatory memberships resolve to
-- the promoted product projection, barcode identity resolves to its opaque
-- import entity, and ingredient membership resolves through the current
-- parsed token/link graph to the exact promoted CosIng ingredient projection.
create or replace function private.catalog_launch_curation_membership_evidence_sha256(
  p_product_id uuid,
  p_ingredient_list_id uuid,
  p_barcode text,
  p_product_record_sha256 text,
  p_field_scope text,
  p_dependency_entity_sha256 text,
  p_batch_id uuid,
  p_artifact_set_sha256 text,
  p_cat02_stage_record_sha256 text,
  p_cat02_database_normalized_record_sha256 text,
  p_source_approval_sha256 text,
  p_source_qa_sha256 text
)
returns text
language sql
stable
security definer
set search_path = ''
as $$
  with target as materialized (
    select distinct
      'barcode'::text as entity_type,
      mapping.import_entity_id::text as entity_id,
      mapping.import_batch_id as batch_id,
      mapping.import_staged_record_id as staged_record_id,
      mapping.import_record_sha256 as record_sha256,
      mapping.import_projection_status as projection_status
    from public.product_barcodes as mapping
    join public.products as barcode_product
      on barcode_product.id = mapping.product_id
     and barcode_product.barcode = mapping.barcode
    where p_field_scope = 'barcode_identity'
      and mapping.product_id = p_product_id
      and mapping.barcode = p_barcode
      and mapping.import_entity_id is not null
    union all
    select
      'product'::text,
      product.id::text,
      product.import_batch_id,
      product.import_staged_record_id,
      product.import_record_sha256,
      product.import_projection_status
    from public.products as product
    where p_field_scope in ('category', 'regulatory_classification')
      and product.id = p_product_id
    union all
    select distinct
      'ingredient'::text,
      ingredient.id::text,
      ingredient.import_batch_id,
      ingredient.import_staged_record_id,
      ingredient.import_record_sha256,
      ingredient.import_projection_status
    from public.product_ingredient_tokens as token
    join public.product_ingredients as link
      on link.product_id = token.product_id
     and link.ingredient_list_id = token.ingredient_list_id
     and link.ingredient_id = token.ingredient_id
     and link.position = token.position
     and link.is_unmatched is false
    join public.ingredients as ingredient on ingredient.id = token.ingredient_id
    where p_field_scope = 'ingredients'
      and token.product_id = p_product_id
      and token.ingredient_list_id = p_ingredient_list_id
      and token.is_unmatched is false
  ), authority as materialized (
    select
      staged.id as staged_record_id,
      staged.record_sha256 as staged_record_sha256,
      review.id as review_event_id,
      review.request_sha256 as review_request_sha256,
      review.review_evidence_sha256 as review_evidence_sha256,
      promotion.id as promotion_event_id,
      promotion.request_sha256 as promotion_request_sha256,
      target.entity_type,
      target.entity_id,
      revision.projection_sha256
    from target
    join public.catalog_import_batches as batch
      on batch.id = target.batch_id
     and batch.id = p_batch_id
     and batch.status = 'promoted'
     and batch.artifact_kind = 'production'
     and batch.territory = 'US'
     and batch.qa_blocker_count = 0
     and batch.qa_warning_count = 0
     and batch.source_approval_sha256 = p_source_approval_sha256
     and batch.qa_report_sha256 = p_source_qa_sha256
    join private.catalog_import_staged_records as staged
      on staged.id = target.staged_record_id
     and staged.batch_id = target.batch_id
     and staged.record_sha256 = target.record_sha256
     and staged.record_kind = case
       when p_field_scope = 'ingredients' then 'ingredient'
       else 'product'
     end
     and staged.disposition = 'accepted'
     and staged.sealed_at is not null
     and staged.record_sha256 = private.catalog_import_sha256_text(
       private.catalog_import_canonical_json(staged.normalized_payload)
     )
    join private.catalog_import_review_events as review
      on review.batch_id = batch.id
     and review.staged_record_id = staged.id
     and review.decision = 'accepted'
     and review.review_ticket = batch.review_ticket
     and review.reviewed_by = batch.reviewed_by
     and review.review_evidence_sha256 = batch.review_evidence_sha256
     and review.request_sha256 = batch.review_request_sha256
    join private.catalog_import_promotion_events as promotion
      on promotion.batch_id = batch.id
     and promotion.event_type = 'promotion'
     and promotion.review_ticket = batch.review_ticket
     and promotion.review_evidence_sha256 = batch.review_evidence_sha256
     and promotion.request_sha256 = private.catalog_import_sha256_text(
       pg_catalog.jsonb_build_object(
         'batchId', batch.id,
         'operationKey', promotion.operation_key,
         'operator', promotion.actor,
         'reviewTicket', promotion.review_ticket,
         'reviewEvidenceSha256', promotion.review_evidence_sha256
       )::text
     )
    join private.catalog_import_entity_revisions as revision
      on revision.batch_id = batch.id
     and revision.staged_record_id = staged.id
     and revision.promotion_event_id = promotion.id
     and revision.entity_type = target.entity_type
     and revision.entity_id = target.entity_id
     and revision.revision_action = 'inserted'
     and revision.projection_sha256 = private.catalog_import_sha256_text(
       revision.projection_snapshot::text
     )
    join private.catalog_import_batch_effects as effect
      on effect.batch_id = revision.batch_id
     and effect.staged_record_id = revision.staged_record_id
     and effect.promotion_event_id = revision.promotion_event_id
     and effect.entity_type = revision.entity_type
     and effect.entity_id = revision.entity_id
     and effect.effect_type = revision.revision_action
     and effect.after_sha256 = revision.projection_sha256
    where target.projection_status = 'active'
      and private.catalog_source_is_production_approved(batch.source_id)
  ), selected_authority as materialized (
    select authority.*
    from authority
    where p_dependency_entity_sha256 =
      private.catalog_launch_curation_dependency_entity_sha256(
        p_product_record_sha256,
        p_field_scope,
        authority.entity_type,
        authority.entity_id,
        authority.projection_sha256
      )
  )
  select private.catalog_import_sha256_text(
    private.catalog_import_canonical_json(
      pg_catalog.jsonb_build_object(
        'contractId', 'catalog-cat02-retained-membership-evidence-v1',
        'productRecordSha256', p_product_record_sha256,
        'fieldScope', p_field_scope,
        'dependencyEntitySha256', p_dependency_entity_sha256,
        'batchId', p_batch_id,
        'artifactSetSha256', p_artifact_set_sha256,
        'cat02StageRecordSha256', p_cat02_stage_record_sha256,
        'cat02DatabaseNormalizedRecordSha256',
          p_cat02_database_normalized_record_sha256,
        'sourceApprovalSha256', p_source_approval_sha256,
        'sourceQaSha256', p_source_qa_sha256,
        'retainedAuthority', pg_catalog.jsonb_build_object(
          'stagedRecordId', selected_authority.staged_record_id,
          'stagedRecordSha256', selected_authority.staged_record_sha256,
          'reviewEventId', selected_authority.review_event_id,
          'reviewRequestSha256', selected_authority.review_request_sha256,
          'reviewEvidenceSha256', selected_authority.review_evidence_sha256,
          'promotionEventId', selected_authority.promotion_event_id,
          'promotionRequestSha256', selected_authority.promotion_request_sha256,
          'entityType', selected_authority.entity_type,
          'entityId', selected_authority.entity_id,
          'projectionSha256', selected_authority.projection_sha256
        )
      )
    )
  )
  from selected_authority
  where selected_authority.staged_record_sha256 =
      p_cat02_stage_record_sha256
    and (select count(*) from selected_authority) = 1
$$;

create or replace function private.catalog_launch_curation_campaign_sha256(
  p_release_id text,
  p_campaign_authority_sha256 text,
  p_import_batch_id uuid,
  p_import_batch_evidence_sha256 text,
  p_import_records_sha256 text,
  p_import_candidates_sha256 text,
  p_cat02_artifact_set_sha256 text,
  p_cat02_membership_set_sha256 text,
  p_cat02_membership_proof_sha256 text,
  p_cat02_database_observation_sha256 text,
  p_cat02_verifier_signature_set_sha256 text,
  p_cat02_production_integrity_set_sha256 text,
  p_curation_outcome_reviewer_signature_set_sha256 text,
  p_contributing_batch_ids uuid[],
  p_contributing_batch_set_sha256 text,
  p_signed_target_policy_sha256 text,
  p_eligibility_policy_sha256 text,
  p_beta_corpus_sha256 text,
  p_curation_manifest_sha256 text,
  p_trust_registry_sha256 text,
  p_corpus_consent_state_sha256 text,
  p_review_valid_until timestamptz,
  p_expected_reviewed_record_count integer,
  p_expected_eligible_record_count integer,
  p_expected_prioritized_eligible_record_count integer,
  p_required_category_eligible_floors jsonb,
  p_expected_record_set_sha256 text,
  p_served_state_mutation_root_set_sha256 text,
  p_activation_authorization_set_sha256 text,
  p_reviewer_ids text[],
  p_reviewer_evidence_sha256s text[],
  p_reviewer_signature_set_sha256 text,
  p_created_by text
)
returns text
language sql
stable
security definer
set search_path = ''
as $$
  select private.catalog_import_sha256_text(
    private.catalog_import_canonical_json(
      pg_catalog.jsonb_build_object(
        'contractId', 'catalog-launch-curation-campaign-v1',
        'releaseId', p_release_id,
        'campaignAuthoritySha256', p_campaign_authority_sha256,
        'territory', 'US',
        'importBatchId', p_import_batch_id,
        'importBatchEvidenceSha256', p_import_batch_evidence_sha256,
        'importRecordsSha256', p_import_records_sha256,
        'importCandidatesSha256', p_import_candidates_sha256,
        'cat02ArtifactSetSha256', p_cat02_artifact_set_sha256,
        'cat02MembershipSetSha256', p_cat02_membership_set_sha256,
        'cat02MembershipProofSha256', p_cat02_membership_proof_sha256,
        'cat02DatabaseObservationSha256',
          p_cat02_database_observation_sha256,
        'cat02VerifierSignatureSetSha256',
          p_cat02_verifier_signature_set_sha256,
        'cat02ProductionIntegritySetSha256',
          p_cat02_production_integrity_set_sha256,
        'curationOutcomeReviewerSignatureSetSha256',
          p_curation_outcome_reviewer_signature_set_sha256,
        'contributingBatchIds', pg_catalog.to_jsonb(p_contributing_batch_ids),
        'contributingBatchSetSha256', p_contributing_batch_set_sha256,
        'signedTargetPolicyContractId', 'catalog-launch-target-policy-v1',
        'signedTargetPolicySha256', p_signed_target_policy_sha256,
        'eligibilityPolicySha256', p_eligibility_policy_sha256,
        'betaEvidenceContractId', 'catalog-beta-shelf-corpus-v1',
        'betaCorpusSha256', p_beta_corpus_sha256,
        'curationReviewContractId', 'catalog-curation-review-v1',
        'curationManifestSha256', p_curation_manifest_sha256,
        'trustRegistrySha256', p_trust_registry_sha256,
        'corpusConsentStateSha256', p_corpus_consent_state_sha256,
        'reviewValidUntil', pg_catalog.to_char(
          p_review_valid_until at time zone 'UTC',
          'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"'
        ),
        'expectedReviewedRecordCount', p_expected_reviewed_record_count,
        'expectedEligibleRecordCount', p_expected_eligible_record_count,
        'expectedPrioritizedEligibleRecordCount',
          p_expected_prioritized_eligible_record_count,
        'requiredCategoryEligibleFloors', p_required_category_eligible_floors,
        'expectedRecordSetSha256', p_expected_record_set_sha256,
        'servedStateMutationRootSetSha256',
          p_served_state_mutation_root_set_sha256,
        'activationAuthorizationSetSha256', p_activation_authorization_set_sha256,
        'reviewerRoles', pg_catalog.jsonb_build_array(
          'catalog_quality_reviewer',
          'data_quality_reviewer'
        ),
        'reviewerIds', pg_catalog.to_jsonb(p_reviewer_ids),
        'reviewerEvidenceSha256s', pg_catalog.to_jsonb(p_reviewer_evidence_sha256s),
        'reviewerSignatureSetSha256', p_reviewer_signature_set_sha256,
        'createdBy', p_created_by
      )
    )
  )
$$;

create or replace function private.catalog_launch_curation_record_set_sha256(
  p_release_id text,
  p_records jsonb
)
returns text
language sql
immutable
security definer
set search_path = ''
as $$
  select private.catalog_import_sha256_text(
    private.catalog_import_canonical_json(
      pg_catalog.jsonb_build_object(
        'contractId', 'catalog-launch-curation-database-record-set-v1',
        'releaseId', p_release_id,
        'records', p_records
      )
    )
  )
$$;

create or replace function private.catalog_launch_curation_authorization_set_sha256(
  p_requests jsonb
)
returns text
language sql
immutable
security definer
set search_path = ''
as $$
  select private.catalog_import_sha256_text(
    private.catalog_import_canonical_json(
      pg_catalog.jsonb_build_object(
        'contractId', 'catalog-launch-curation-activation-authorization-set-v1',
        'requests', p_requests
      )
    )
  )
$$;

create or replace function private.catalog_launch_curation_database_base_record_sha256(
  p_release_id text,
  p_signed_target_policy_sha256 text,
  p_beta_corpus_sha256 text,
  p_eligibility_policy_sha256 text,
  p_import_candidates_sha256 text,
  p_product_id uuid,
  p_source_id uuid,
  p_import_batch_id uuid,
  p_import_staged_record_id uuid,
  p_product_record_sha256 text,
  p_cat02_stage_record_sha256 text,
  p_cat02_database_normalized_record_sha256 text,
  p_source_approval_sha256 text,
  p_source_qa_sha256 text,
  p_dependency_memberships jsonb,
  p_cat02_membership_readback_sha256 text,
  p_category_code text,
  p_barcode text,
  p_ingredient_list_id uuid,
  p_product_snapshot_sha256 text,
  p_dependency_sha256 text,
  p_served_state_mutation_root_sha256 text,
  p_demand_priority_rank integer,
  p_demand_priority_commitment_sha256 text,
  p_regulatory_classification text,
  p_regulatory_review_evidence_sha256 text,
  p_regulatory_reviewer_ids text[],
  p_curated_by text
)
returns text
language sql
immutable
security definer
set search_path = ''
as $$
  select private.catalog_import_sha256_text(
    private.catalog_import_canonical_json(
      pg_catalog.jsonb_build_object(
        'contractId', 'catalog-launch-curation-database-base-record-v1',
        'releaseId', p_release_id,
        'targetPolicySha256', p_signed_target_policy_sha256,
        'betaShelfCorpusSha256', p_beta_corpus_sha256,
        'databaseEligibilityPolicySha256', p_eligibility_policy_sha256,
        'candidateSetSha256', p_import_candidates_sha256,
        'record', pg_catalog.jsonb_build_object(
          'territory', 'US',
          'productId', p_product_id,
          'sourceId', p_source_id,
          'importBatchId', p_import_batch_id,
          'importStagedRecordId', p_import_staged_record_id,
          'productRecordSha256', p_product_record_sha256,
          'cat02StageRecordSha256', p_cat02_stage_record_sha256,
          'cat02DatabaseNormalizedRecordSha256',
            p_cat02_database_normalized_record_sha256,
          'sourceApprovalSha256', p_source_approval_sha256,
          'sourceQaSha256', p_source_qa_sha256,
          'dependencyMemberships', p_dependency_memberships,
          'cat02MembershipReadbackSha256',
            p_cat02_membership_readback_sha256,
          'categoryCode', p_category_code,
          'barcode', p_barcode,
          'ingredientListId', p_ingredient_list_id,
          'productSnapshotSha256', p_product_snapshot_sha256,
          'dependencySha256', p_dependency_sha256,
          'servedStateMutationRootSha256',
            p_served_state_mutation_root_sha256,
          'demandPriorityRank', p_demand_priority_rank,
          'demandPriorityCommitmentSha256', p_demand_priority_commitment_sha256,
          'regulatoryClassification', p_regulatory_classification,
          'regulatoryReviewEvidenceSha256', p_regulatory_review_evidence_sha256,
          'regulatoryReviewerRole', 'regulatory_reviewer',
          'regulatoryReviewerIds', pg_catalog.to_jsonb(p_regulatory_reviewer_ids),
          'curatedBy', p_curated_by
        )
      )
    )
  )
$$;

create or replace function private.catalog_launch_curation_reviewed_record_mapping_sha256(
  p_release_id text,
  p_product_record_sha256 text,
  p_served_state_mutation_root_sha256 text,
  p_offline_base_sealed_record_sha256 text,
  p_database_base_record_sha256 text
)
returns text
language sql
immutable
security definer
set search_path = ''
as $$
  select private.catalog_import_sha256_text(
    private.catalog_import_canonical_json(
      pg_catalog.jsonb_build_object(
        'contractId', 'catalog-launch-curation-reviewed-record-mapping-v1',
        'releaseId', p_release_id,
        'productRecordSha256', p_product_record_sha256,
        'servedStateMutationRootSha256',
          p_served_state_mutation_root_sha256,
        'offlineBaseSealedRecordSha256', p_offline_base_sealed_record_sha256,
        'databaseBaseRecordSha256', p_database_base_record_sha256
      )
    )
  )
$$;

create or replace function private.catalog_launch_curation_activation_authorization_sha256(
  p_release_id text,
  p_campaign_authority_sha256 text,
  p_curation_outcome_reviewer_signature_set_sha256 text,
  p_product_record_sha256 text,
  p_served_state_mutation_root_sha256 text,
  p_offline_base_sealed_record_sha256 text,
  p_database_base_record_sha256 text,
  p_reviewed_record_mapping_sha256 text,
  p_activation_operator_id text,
  p_operation_key text,
  p_reason_code text,
  p_planned_at timestamptz
)
returns text
language sql
stable
security definer
set search_path = ''
as $$
  select private.catalog_import_sha256_text(
    private.catalog_import_canonical_json(
      pg_catalog.jsonb_build_object(
        'contractId', 'catalog-launch-curation-activation-authorization-v1',
        'releaseId', p_release_id,
        'campaignAuthoritySha256', p_campaign_authority_sha256,
        'curationOutcomeReviewerSignatureSetSha256',
          p_curation_outcome_reviewer_signature_set_sha256,
        'productRecordSha256', p_product_record_sha256,
        'servedStateMutationRootSha256',
          p_served_state_mutation_root_sha256,
        'offlineBaseSealedRecordSha256', p_offline_base_sealed_record_sha256,
        'databaseBaseRecordSha256', p_database_base_record_sha256,
        'reviewedRecordMappingSha256', p_reviewed_record_mapping_sha256,
        'activationDecision', 'approve_activation',
        'activationOperatorId', p_activation_operator_id,
        'activationOperatorRole', 'activation_operator',
        'operationKey', p_operation_key,
        'reasonCode', p_reason_code,
        'plannedAt', pg_catalog.to_char(
          p_planned_at at time zone 'UTC',
          'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"'
        )
      )
    )
  )
$$;

create or replace function private.catalog_launch_curation_record_sha256(
  p_offline_base_sealed_record_sha256 text,
  p_database_base_record_sha256 text,
  p_reviewed_record_mapping_sha256 text,
  p_served_state_mutation_root_sha256 text,
  p_cat02_membership_proof_sha256 text,
  p_cat02_database_observation_sha256 text,
  p_cat02_verifier_signature_set_sha256 text,
  p_cat02_production_integrity_set_sha256 text,
  p_curation_outcome_reviewer_signature_set_sha256 text,
  p_regulatory_review_evidence_sha256 text,
  p_regulatory_reviewer_ids text[],
  p_regulatory_signature_set_sha256 text,
  p_reviewer_evidence_sha256s text[],
  p_reviewer_signature_set_sha256 text,
  p_activation_decision text,
  p_activation_operator_id text,
  p_activation_planned_at timestamptz,
  p_database_activation_request_sha256 text,
  p_activation_signature_sha256 text
)
returns text
language sql
stable
security definer
set search_path = ''
as $$
  select private.catalog_import_sha256_text(
    private.catalog_import_canonical_json(
      pg_catalog.jsonb_build_object(
        'contractId', 'catalog-launch-curation-record-v1',
        'offlineRecordAuthorityContractId',
          'catalog-launch-curation-offline-reviewed-record-authority-v1',
        'offlineBaseSealedRecordSha256', p_offline_base_sealed_record_sha256,
        'databaseBaseRecordSha256', p_database_base_record_sha256,
        'reviewedRecordMappingSha256', p_reviewed_record_mapping_sha256,
        'servedStateMutationRootSha256',
          p_served_state_mutation_root_sha256,
        'reviewAuthority', pg_catalog.jsonb_build_object(
          'cat02MembershipProofSha256',
            p_cat02_membership_proof_sha256,
          'cat02DatabaseObservationSha256',
            p_cat02_database_observation_sha256,
          'cat02VerifierSignatureSetSha256',
            p_cat02_verifier_signature_set_sha256,
          'cat02ProductionIntegritySetSha256',
            p_cat02_production_integrity_set_sha256,
          'curationOutcomeReviewerSignatureSetSha256',
            p_curation_outcome_reviewer_signature_set_sha256,
          'regulatoryReviewerRole', 'regulatory_reviewer',
          'regulatoryReviewEvidenceSha256',
            p_regulatory_review_evidence_sha256,
          'regulatoryReviewerIds',
            pg_catalog.to_jsonb(p_regulatory_reviewer_ids),
          'regulatorySignatureSetSha256',
            p_regulatory_signature_set_sha256,
          'reviewerRoles', pg_catalog.jsonb_build_array(
            'catalog_quality_reviewer',
            'data_quality_reviewer'
          ),
          'reviewerEvidenceSha256s',
            pg_catalog.to_jsonb(p_reviewer_evidence_sha256s),
          'reviewerSignatureSetSha256',
            p_reviewer_signature_set_sha256
        ),
        'activationDecision', p_activation_decision,
        'activationOperatorRole', 'activation_operator',
        'activationOperatorId', p_activation_operator_id,
        'activationPlannedAt', case
          when p_activation_planned_at is null then null
          else pg_catalog.to_char(
            p_activation_planned_at at time zone 'UTC',
            'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"'
          )
        end,
        'databaseActivationRequestSha256', p_database_activation_request_sha256,
        'activationSignature', case
          when p_activation_signature_sha256 is null then null
          else pg_catalog.jsonb_build_object(
            'signerRole', 'activation_operator',
            'signerId', p_activation_operator_id,
            'signatureSha256', p_activation_signature_sha256
          )
        end
      )
    )
  )
$$;

create or replace function private.catalog_launch_curation_event_receipt_sha256(
  p_event_id uuid,
  p_product_id uuid,
  p_territory text,
  p_campaign_id uuid,
  p_event_type text,
  p_previous_curation_record_id uuid,
  p_new_curation_record_id uuid,
  p_generation integer,
  p_operation_key text,
  p_request_sha256 text,
  p_actor text,
  p_reason text,
  p_curation_record_sha256 text,
  p_campaign_sha256 text,
  p_signed_target_policy_sha256 text,
  p_eligibility_policy_sha256 text,
  p_database_activation_request_sha256 text,
  p_activation_signature_sha256 text,
  p_head_before_sha256 text
)
returns text
language sql
immutable
security definer
set search_path = ''
as $$
  select private.catalog_import_sha256_text(
    private.catalog_import_canonical_json(
      pg_catalog.jsonb_build_object(
        'contractId', 'catalog-launch-curation-event-receipt-v1',
        'eventId', p_event_id,
        'productId', p_product_id,
        'territory', p_territory,
        'campaignId', p_campaign_id,
        'eventType', p_event_type,
        'previousCurationRecordId', p_previous_curation_record_id,
        'newCurationRecordId', p_new_curation_record_id,
        'generation', p_generation,
        'operationKey', p_operation_key,
        'requestSha256', p_request_sha256,
        'actor', p_actor,
        'reason', p_reason,
        'curationRecordSha256', p_curation_record_sha256,
        'campaignSha256', p_campaign_sha256,
        'signedTargetPolicySha256', p_signed_target_policy_sha256,
        'eligibilityPolicySha256', p_eligibility_policy_sha256,
        'databaseActivationRequestSha256', p_database_activation_request_sha256,
        'activationSignatureSha256', p_activation_signature_sha256,
        'headBeforeSha256', p_head_before_sha256
      )
    )
  )
$$;

create or replace function private.catalog_launch_curation_head_sha256(
  p_product_id uuid,
  p_territory text,
  p_curation_record_id uuid,
  p_campaign_id uuid,
  p_generation integer,
  p_state text,
  p_last_event_id uuid
)
returns text
language sql
immutable
security definer
set search_path = ''
as $$
  select private.catalog_import_sha256_text(
    private.catalog_import_canonical_json(
      pg_catalog.jsonb_build_object(
        'contractId', 'catalog-launch-curation-head-v1',
        'productId', p_product_id,
        'territory', p_territory,
        'curationRecordId', p_curation_record_id,
        'campaignId', p_campaign_id,
        'generation', p_generation,
        'state', p_state,
        'lastEventId', p_last_event_id
      )
    )
  )
$$;

revoke all on function private.catalog_launch_curation_target_policy(
  text, numeric, numeric, numeric, numeric, numeric, numeric, integer
) from public, anon, authenticated, service_role;
revoke all on function private.catalog_launch_curation_target_policy_canonical_text(
  text, numeric, numeric, numeric, numeric, numeric, numeric, integer
) from public, anon, authenticated, service_role;
revoke all on function private.catalog_launch_curation_target_policy_sha256(
  text, numeric, numeric, numeric, numeric, numeric, numeric, integer
) from public, anon, authenticated, service_role;
revoke all on function private.catalog_launch_curation_category_floors_are_valid(jsonb)
  from public, anon, authenticated, service_role;
revoke all on function private.catalog_launch_curation_cat02_artifact_sha256(jsonb)
  from public, anon, authenticated, service_role;
revoke all on function private.catalog_launch_curation_cat02_artifact_set_sha256(jsonb)
  from public, anon, authenticated, service_role;
revoke all on function private.catalog_launch_curation_contributing_batch_set_sha256(jsonb)
  from public, anon, authenticated, service_role;
revoke all on function private.catalog_launch_curation_cat02_membership_set_sha256(jsonb)
  from public, anon, authenticated, service_role;
revoke all on function private.catalog_launch_curation_membership_readback_sha256(text, jsonb)
  from public, anon, authenticated, service_role;
revoke all on function private.catalog_launch_curation_membership_database_sha256(
  text, text, text, text, text, text, text, text, text, text[]
) from public, anon, authenticated, service_role;
revoke all on function private.catalog_launch_curation_dependency_entity_sha256(
  text, text, text, text, text
) from public, anon, authenticated, service_role;
revoke all on function private.catalog_launch_curation_production_integrity_evidence_sha256(
  uuid
) from public, anon, authenticated, service_role;
revoke all on function private.catalog_launch_curation_cat02_production_integrity_set_sha256(
  jsonb
) from public, anon, authenticated, service_role;
revoke all on function private.catalog_launch_curation_cat02_artifact_sets_are_live(
  jsonb, uuid[]
) from public, anon, authenticated, service_role;
revoke all on function private.catalog_launch_curation_membership_evidence_sha256(
  uuid, uuid, text, text, text, text, uuid, text, text, text, text, text
) from public, anon, authenticated, service_role;
revoke all on function private.catalog_launch_curation_campaign_sha256(
  text, text, uuid, text, text, text, text, text,
  text, text, text, text, text, uuid[], text,
  text, text, text, text,
  text, text, timestamptz, integer, integer, integer, jsonb,
  text, text, text, text[], text[], text, text
) from public, anon, authenticated, service_role;
revoke all on function private.catalog_launch_curation_record_set_sha256(text, jsonb)
  from public, anon, authenticated, service_role;
revoke all on function private.catalog_launch_curation_authorization_set_sha256(jsonb)
  from public, anon, authenticated, service_role;
revoke all on function private.catalog_launch_curation_database_base_record_sha256(
  text, text, text, text, text, uuid, uuid, uuid, uuid,
  text, text, text, text, text, jsonb, text, text, text, uuid,
  text, text, text, integer, text, text, text, text[], text
) from public, anon, authenticated, service_role;
revoke all on function private.catalog_launch_curation_reviewed_record_mapping_sha256(
  text, text, text, text, text
) from public, anon, authenticated, service_role;
revoke all on function private.catalog_launch_curation_record_sha256(
  text, text, text, text, text, text, text, text, text, text, text[], text, text[], text,
  text, text, timestamptz, text, text
) from public, anon, authenticated, service_role;
revoke all on function private.catalog_launch_curation_activation_authorization_sha256(
  text, text, text, text, text, text, text, text, text, text, text, timestamptz
) from public, anon, authenticated, service_role;
revoke all on function private.catalog_launch_curation_event_receipt_sha256(
  uuid, uuid, text, uuid, text, uuid, uuid, integer, text, text, text, text,
  text, text, text, text, text, text, text
) from public, anon, authenticated, service_role;
revoke all on function private.catalog_launch_curation_head_sha256(
  uuid, text, uuid, uuid, integer, text, uuid
) from public, anon, authenticated, service_role;

create table private.catalog_launch_curation_campaigns (
  id                                  uuid primary key default gen_random_uuid(),
  operation_key                       text not null unique
    check (operation_key ~ '^[A-Za-z0-9][A-Za-z0-9._:/-]{7,199}$'),
  release_id                          text not null unique
    check (release_id ~ '^[a-z0-9][a-z0-9._-]{2,99}$'),
  campaign_authority_sha256           text not null unique
    check (campaign_authority_sha256 ~ '^[a-f0-9]{64}$'),
  territory                           text not null default 'US' check (territory = 'US'),
  import_batch_id                     uuid not null
    references public.catalog_import_batches (id) on delete restrict,
  import_batch_evidence_sha256        text not null check (import_batch_evidence_sha256 ~ '^[a-f0-9]{64}$'),
  import_records_sha256               text not null check (import_records_sha256 ~ '^[a-f0-9]{64}$'),
  import_candidates_sha256            text not null check (import_candidates_sha256 ~ '^[a-f0-9]{64}$'),
  cat02_artifact_sets                 jsonb not null
    check (pg_catalog.jsonb_typeof(cat02_artifact_sets) = 'array'),
  cat02_artifact_set_sha256           text not null
    check (cat02_artifact_set_sha256 ~ '^[a-f0-9]{64}$'),
  cat02_membership_set_sha256         text not null
    check (cat02_membership_set_sha256 ~ '^[a-f0-9]{64}$'),
  cat02_membership_proof_sha256       text not null
    check (cat02_membership_proof_sha256 ~ '^[a-f0-9]{64}$'),
  cat02_database_observation_sha256   text not null
    check (cat02_database_observation_sha256 ~ '^[a-f0-9]{64}$'),
  cat02_verifier_signature_set_sha256 text not null
    check (cat02_verifier_signature_set_sha256 ~ '^[a-f0-9]{64}$'),
  cat02_production_integrity_set_sha256 text not null
    check (cat02_production_integrity_set_sha256 ~ '^[a-f0-9]{64}$'),
  contributing_batch_ids              uuid[] not null,
  contributing_batch_set_sha256       text not null
    check (contributing_batch_set_sha256 ~ '^[a-f0-9]{64}$'),
  required_quality_grade              text not null check (required_quality_grade in ('verified', 'usable')),
  minimum_data_quality_score          numeric(5,2) not null check (minimum_data_quality_score between 90 and 100),
  minimum_ingredient_quality_score    numeric(5,2) not null check (minimum_ingredient_quality_score between 90 and 100),
  minimum_barcode_quality_score       numeric(5,2) not null check (minimum_barcode_quality_score between 90 and 100),
  minimum_category_quality_score      numeric(5,2) not null check (minimum_category_quality_score between 90 and 100),
  minimum_parse_confidence            numeric(5,4) not null check (minimum_parse_confidence between 0.95 and 1),
  minimum_token_match_confidence      numeric(5,4) not null check (minimum_token_match_confidence between 0.95 and 1),
  minimum_mapped_ingredient_count     integer not null check (minimum_mapped_ingredient_count between 1 and 1000),
  signed_target_policy_contract_id    text not null default 'catalog-launch-target-policy-v1'
    check (signed_target_policy_contract_id = 'catalog-launch-target-policy-v1'),
  signed_target_policy_sha256         text not null check (signed_target_policy_sha256 ~ '^[a-f0-9]{64}$'),
  eligibility_policy_sha256           text not null check (eligibility_policy_sha256 ~ '^[a-f0-9]{64}$'),
  beta_evidence_contract_id           text not null default 'catalog-beta-shelf-corpus-v1'
    check (beta_evidence_contract_id = 'catalog-beta-shelf-corpus-v1'),
  beta_corpus_sha256                  text not null check (beta_corpus_sha256 ~ '^[a-f0-9]{64}$'),
  curation_review_contract_id         text not null default 'catalog-curation-review-v1'
    check (curation_review_contract_id = 'catalog-curation-review-v1'),
  curation_manifest_sha256            text not null check (curation_manifest_sha256 ~ '^[a-f0-9]{64}$'),
  trust_registry_sha256               text not null check (trust_registry_sha256 ~ '^[a-f0-9]{64}$'),
  corpus_consent_state_sha256         text not null check (corpus_consent_state_sha256 ~ '^[a-f0-9]{64}$'),
  review_valid_until                  timestamptz not null,
  expected_reviewed_record_count      integer not null
    check (expected_reviewed_record_count between 1 and 100000),
  expected_eligible_record_count      integer not null
    check (
      expected_eligible_record_count = 0
      or expected_eligible_record_count between 2000 and expected_reviewed_record_count
    ),
  expected_prioritized_eligible_record_count integer not null
    check (
      (expected_eligible_record_count = 0
        and expected_prioritized_eligible_record_count = 0)
      or (expected_prioritized_eligible_record_count
        between 100 and expected_eligible_record_count)
    ),
  required_category_eligible_floors  jsonb not null
    check (
      private.catalog_launch_curation_category_floors_are_valid(
        required_category_eligible_floors
      )
    ),
  expected_record_set_sha256          text not null
    check (expected_record_set_sha256 ~ '^[a-f0-9]{64}$'),
  served_state_mutation_root_set_sha256 text not null
    check (served_state_mutation_root_set_sha256 ~ '^[a-f0-9]{64}$'),
  activation_authorization_set_sha256 text not null
    check (activation_authorization_set_sha256 ~ '^[a-f0-9]{64}$'),
  curation_outcome_reviewer_signature_set_sha256 text not null
    check (curation_outcome_reviewer_signature_set_sha256 ~ '^[a-f0-9]{64}$'),
  reviewer_ids                        text[] not null,
  reviewer_evidence_sha256s           text[] not null,
  reviewer_signature_set_sha256       text not null check (reviewer_signature_set_sha256 ~ '^[a-f0-9]{64}$'),
  created_by                          text not null
    check (created_by ~ '^[A-Za-z0-9][A-Za-z0-9._@:+/-]{2,199}$'),
  campaign_sha256                     text not null unique check (campaign_sha256 ~ '^[a-f0-9]{64}$'),
  sealed_at                           timestamptz not null default now(),
  check (
    pg_catalog.array_ndims(contributing_batch_ids) = 1
    and pg_catalog.array_lower(contributing_batch_ids, 1) = 1
    and pg_catalog.cardinality(contributing_batch_ids) between 1 and 100000
    and pg_catalog.array_upper(contributing_batch_ids, 1)
      = pg_catalog.cardinality(contributing_batch_ids)
    and pg_catalog.array_position(contributing_batch_ids, null) is null
  ),
  check (
    cat02_artifact_set_sha256 =
      private.catalog_launch_curation_cat02_artifact_set_sha256(
        cat02_artifact_sets
      )
    and contributing_batch_set_sha256 =
      private.catalog_launch_curation_contributing_batch_set_sha256(
        cat02_artifact_sets
      )
    and cat02_production_integrity_set_sha256 =
      private.catalog_launch_curation_cat02_production_integrity_set_sha256(
        cat02_artifact_sets
      )
  ),
  check (
    pg_catalog.array_ndims(reviewer_ids) = 1
    and pg_catalog.array_lower(reviewer_ids, 1) = 1
    and pg_catalog.array_upper(reviewer_ids, 1) = 2
    and pg_catalog.array_position(reviewer_ids, null) is null
    and pg_catalog.cardinality(reviewer_ids) = 2
    and reviewer_ids[1] ~ '^[a-z0-9][a-z0-9._:-]{2,127}$'
    and reviewer_ids[2] ~ '^[a-z0-9][a-z0-9._:-]{2,127}$'
    and reviewer_ids[1] <> reviewer_ids[2]
  ),
  check (
    pg_catalog.array_ndims(reviewer_evidence_sha256s) = 1
    and pg_catalog.array_lower(reviewer_evidence_sha256s, 1) = 1
    and pg_catalog.array_upper(reviewer_evidence_sha256s, 1) = 2
    and pg_catalog.array_position(reviewer_evidence_sha256s, null) is null
    and pg_catalog.cardinality(reviewer_evidence_sha256s) = 2
    and reviewer_evidence_sha256s[1] ~ '^[a-f0-9]{64}$'
    and reviewer_evidence_sha256s[2] ~ '^[a-f0-9]{64}$'
    and reviewer_evidence_sha256s[1] <> reviewer_evidence_sha256s[2]
  ),
  check (
    eligibility_policy_sha256 =
      private.catalog_launch_curation_target_policy_sha256(
        required_quality_grade,
        minimum_data_quality_score,
        minimum_ingredient_quality_score,
        minimum_barcode_quality_score,
        minimum_category_quality_score,
        minimum_parse_confidence,
        minimum_token_match_confidence,
        minimum_mapped_ingredient_count
      )
  ),
  check (
    campaign_sha256 = private.catalog_launch_curation_campaign_sha256(
      release_id,
      campaign_authority_sha256,
      import_batch_id,
      import_batch_evidence_sha256,
      import_records_sha256,
      import_candidates_sha256,
      cat02_artifact_set_sha256,
      cat02_membership_set_sha256,
      cat02_membership_proof_sha256,
      cat02_database_observation_sha256,
      cat02_verifier_signature_set_sha256,
      cat02_production_integrity_set_sha256,
      curation_outcome_reviewer_signature_set_sha256,
      contributing_batch_ids,
      contributing_batch_set_sha256,
      signed_target_policy_sha256,
      eligibility_policy_sha256,
      beta_corpus_sha256,
      curation_manifest_sha256,
      trust_registry_sha256,
      corpus_consent_state_sha256,
      review_valid_until,
      expected_reviewed_record_count,
      expected_eligible_record_count,
      expected_prioritized_eligible_record_count,
      required_category_eligible_floors,
      expected_record_set_sha256,
      served_state_mutation_root_set_sha256,
      activation_authorization_set_sha256,
      reviewer_ids,
      reviewer_evidence_sha256s,
      reviewer_signature_set_sha256,
      created_by
    )
  )
);

create table private.catalog_launch_curation_records (
  id                                  uuid primary key default gen_random_uuid(),
  campaign_id                         uuid not null
    references private.catalog_launch_curation_campaigns (id) on delete restrict,
  product_id                          uuid not null references public.products (id) on delete restrict,
  source_id                           uuid not null references public.catalog_sources (id) on delete restrict,
  import_batch_id                     uuid not null
    references public.catalog_import_batches (id) on delete restrict,
  import_staged_record_id             uuid not null
    references private.catalog_import_staged_records (id) on delete restrict,
  product_record_sha256               text not null check (product_record_sha256 ~ '^[a-f0-9]{64}$'),
  cat02_stage_record_sha256           text not null
    check (cat02_stage_record_sha256 ~ '^[a-f0-9]{64}$'),
  cat02_database_normalized_record_sha256 text not null
    check (cat02_database_normalized_record_sha256 ~ '^[a-f0-9]{64}$'),
  source_approval_sha256              text not null
    check (source_approval_sha256 ~ '^[a-f0-9]{64}$'),
  source_qa_sha256                    text not null
    check (source_qa_sha256 ~ '^[a-f0-9]{64}$'),
  served_state_mutation_root_sha256   text not null
    check (served_state_mutation_root_sha256 ~ '^[a-f0-9]{64}$'),
  dependency_memberships              jsonb not null
    check (pg_catalog.jsonb_typeof(dependency_memberships) = 'array'),
  cat02_membership_readback_sha256    text not null
    check (cat02_membership_readback_sha256 ~ '^[a-f0-9]{64}$'),
  cat02_membership_proof_sha256       text not null
    check (cat02_membership_proof_sha256 ~ '^[a-f0-9]{64}$'),
  cat02_database_observation_sha256   text not null
    check (cat02_database_observation_sha256 ~ '^[a-f0-9]{64}$'),
  cat02_verifier_signature_set_sha256 text not null
    check (cat02_verifier_signature_set_sha256 ~ '^[a-f0-9]{64}$'),
  cat02_production_integrity_set_sha256 text not null
    check (cat02_production_integrity_set_sha256 ~ '^[a-f0-9]{64}$'),
  curation_outcome_reviewer_signature_set_sha256 text not null
    check (curation_outcome_reviewer_signature_set_sha256 ~ '^[a-f0-9]{64}$'),
  category_code                       text not null
    check (category_code in (
      'acne_treatment', 'cleanser', 'moisturizer', 'other',
      'serum', 'sunscreen', 'toner'
    )),
  barcode                             text not null check (barcode ~ '^[0-9]{8,14}$'),
  ingredient_list_id                  uuid not null
    references public.product_ingredient_lists (id) on delete restrict,
  product_snapshot_sha256             text not null check (product_snapshot_sha256 ~ '^[a-f0-9]{64}$'),
  dependency_sha256                   text not null check (dependency_sha256 ~ '^[a-f0-9]{64}$'),
  manifest_entry_sha256               text not null check (manifest_entry_sha256 ~ '^[a-f0-9]{64}$'),
  demand_priority_rank                integer check (demand_priority_rank is null or demand_priority_rank > 0),
  demand_priority_commitment_sha256   text
    check (demand_priority_commitment_sha256 is null or demand_priority_commitment_sha256 ~ '^[a-f0-9]{64}$'),
  signed_target_policy_sha256         text not null check (signed_target_policy_sha256 ~ '^[a-f0-9]{64}$'),
  eligibility_policy_sha256           text not null check (eligibility_policy_sha256 ~ '^[a-f0-9]{64}$'),
  regulatory_classification           text not null
    check (regulatory_classification in ('cosmetic', 'otc_drug', 'combination_cosmetic_drug')),
  regulatory_review_evidence_sha256   text
    check (regulatory_review_evidence_sha256 is null or regulatory_review_evidence_sha256 ~ '^[a-f0-9]{64}$'),
  regulatory_reviewer_ids             text[] not null,
  regulatory_signature_set_sha256     text not null check (regulatory_signature_set_sha256 ~ '^[a-f0-9]{64}$'),
  activation_decision                 text not null
    check (activation_decision in ('approve_activation', 'withhold_activation')),
  activation_operator_id              text not null
    check (activation_operator_id ~ '^[a-z0-9][a-z0-9._:-]{2,127}$'),
  activation_planned_at               timestamptz,
  offline_record_authority_contract_id text not null
    default 'catalog-launch-curation-offline-reviewed-record-authority-v1'
    check (
      offline_record_authority_contract_id =
        'catalog-launch-curation-offline-reviewed-record-authority-v1'
    ),
  offline_base_sealed_record_sha256   text not null unique
    check (offline_base_sealed_record_sha256 ~ '^[a-f0-9]{64}$'),
  database_base_record_sha256         text not null unique
    check (database_base_record_sha256 ~ '^[a-f0-9]{64}$'),
  reviewed_record_mapping_sha256      text not null unique
    check (reviewed_record_mapping_sha256 ~ '^[a-f0-9]{64}$'),
  database_activation_request_sha256   text
    check (database_activation_request_sha256 is null or database_activation_request_sha256 ~ '^[a-f0-9]{64}$'),
  activation_signature_sha256          text
    check (activation_signature_sha256 is null or activation_signature_sha256 ~ '^[a-f0-9]{64}$'),
  reviewer_evidence_sha256s           text[] not null,
  reviewer_signature_set_sha256       text not null check (reviewer_signature_set_sha256 ~ '^[a-f0-9]{64}$'),
  curated_by                          text not null
    check (curated_by ~ '^[A-Za-z0-9][A-Za-z0-9._@:+/-]{2,199}$'),
  curation_record_sha256              text not null unique check (curation_record_sha256 ~ '^[a-f0-9]{64}$'),
  sealed_at                           timestamptz not null default now(),
  unique (campaign_id, product_id),
  check (
    cat02_stage_record_sha256 = product_record_sha256
    and cat02_membership_readback_sha256 =
      private.catalog_launch_curation_membership_readback_sha256(
        product_record_sha256,
        dependency_memberships
      )
  ),
  check (
    pg_catalog.array_ndims(reviewer_evidence_sha256s) = 1
    and pg_catalog.array_lower(reviewer_evidence_sha256s, 1) = 1
    and pg_catalog.array_upper(reviewer_evidence_sha256s, 1) = 2
    and pg_catalog.array_position(reviewer_evidence_sha256s, null) is null
    and pg_catalog.cardinality(reviewer_evidence_sha256s) = 2
    and reviewer_evidence_sha256s[1] ~ '^[a-f0-9]{64}$'
    and reviewer_evidence_sha256s[2] ~ '^[a-f0-9]{64}$'
    and reviewer_evidence_sha256s[1] <> reviewer_evidence_sha256s[2]
  ),
  check (
    pg_catalog.array_ndims(regulatory_reviewer_ids) = 1
    and pg_catalog.array_lower(regulatory_reviewer_ids, 1) = 1
    and pg_catalog.array_upper(regulatory_reviewer_ids, 1) = 1
    and pg_catalog.array_position(regulatory_reviewer_ids, null) is null
    and pg_catalog.cardinality(regulatory_reviewer_ids) = 1
    and regulatory_reviewer_ids[1] ~ '^[a-z0-9][a-z0-9._:-]{2,127}$'
  ),
  check (
    (regulatory_classification = 'cosmetic' and regulatory_review_evidence_sha256 is null)
    or (regulatory_classification in ('otc_drug', 'combination_cosmetic_drug')
      and regulatory_review_evidence_sha256 is not null)
  ),
  check (
    (demand_priority_rank is null and demand_priority_commitment_sha256 is null)
    or (demand_priority_rank is not null
      and demand_priority_commitment_sha256 is not null
      and activation_decision = 'approve_activation')
  ),
  check (manifest_entry_sha256 = offline_base_sealed_record_sha256),
  check (
    (
      activation_decision = 'approve_activation'
      and activation_planned_at is not null
      and database_activation_request_sha256 is not null
      and activation_signature_sha256 is not null
    )
    or (
      activation_decision = 'withhold_activation'
      and activation_planned_at is null
      and database_activation_request_sha256 is null
      and activation_signature_sha256 is null
    )
  ),
  check (
    curation_record_sha256 = private.catalog_launch_curation_record_sha256(
      offline_base_sealed_record_sha256,
      database_base_record_sha256,
      reviewed_record_mapping_sha256,
      served_state_mutation_root_sha256,
      cat02_membership_proof_sha256,
      cat02_database_observation_sha256,
      cat02_verifier_signature_set_sha256,
      cat02_production_integrity_set_sha256,
      curation_outcome_reviewer_signature_set_sha256,
      regulatory_review_evidence_sha256,
      regulatory_reviewer_ids,
      regulatory_signature_set_sha256,
      reviewer_evidence_sha256s,
      reviewer_signature_set_sha256,
      activation_decision,
      activation_operator_id,
      activation_planned_at,
      database_activation_request_sha256,
      activation_signature_sha256
    )
  )
);

create unique index catalog_launch_curation_campaign_priority_rank_uidx
  on private.catalog_launch_curation_records (campaign_id, demand_priority_rank)
  where demand_priority_rank is not null;

create unique index catalog_launch_curation_campaign_priority_commitment_uidx
  on private.catalog_launch_curation_records (
    campaign_id, demand_priority_commitment_sha256
  )
  where demand_priority_commitment_sha256 is not null;

-- Every product has an append-only served-state generation, even before a
-- curation record exists. Reviewer-supplied roots bind the precise generation
-- they inspected. Any later catalog/dependency/authority mutation advances the
-- root permanently, so an exact byte-for-byte restoration cannot resurrect a
-- stale review.
create or replace function private.catalog_launch_served_state_mutation_root_sha256(
  p_product_id uuid,
  p_generation bigint,
  p_last_mutation_event_sha256 text
)
returns text
language sql
immutable
security definer
set search_path = ''
as $$
  select private.catalog_import_sha256_text(
    private.catalog_import_canonical_json(
      pg_catalog.jsonb_build_object(
        'contractId', 'catalog-launch-served-state-mutation-root-v1',
        'productId', p_product_id,
        'generation', p_generation,
        'lastMutationEventSha256', p_last_mutation_event_sha256
      )
    )
  )
$$;

create or replace function private.catalog_launch_served_state_mutation_event_sha256(
  p_event_id uuid,
  p_product_id uuid,
  p_generation bigint,
  p_mutation_kind text,
  p_source_relation text,
  p_source_row_key text,
  p_mutation_operation text,
  p_observed_at timestamptz,
  p_before_row_sha256 text,
  p_after_row_sha256 text,
  p_previous_served_state_mutation_root_sha256 text
)
returns text
language sql
immutable
security definer
set search_path = ''
as $$
  select private.catalog_import_sha256_text(
    private.catalog_import_canonical_json(
      pg_catalog.jsonb_build_object(
        'contractId', 'catalog-launch-served-state-mutation-event-v1',
        'eventId', p_event_id,
        'productId', p_product_id,
        'generation', p_generation,
        'mutationKind', p_mutation_kind,
        'sourceRelation', p_source_relation,
        'sourceRowKey', p_source_row_key,
        'mutationOperation', p_mutation_operation,
        'observedAt', pg_catalog.to_char(
          p_observed_at at time zone 'UTC',
          'YYYY-MM-DD"T"HH24:MI:SS.US"Z"'
        ),
        'beforeRowSha256', p_before_row_sha256,
        'afterRowSha256', p_after_row_sha256,
        'previousServedStateMutationRootSha256',
          p_previous_served_state_mutation_root_sha256
      )
    )
  )
$$;

revoke all on function private.catalog_launch_served_state_mutation_root_sha256(
  uuid, bigint, text
) from public, anon, authenticated, service_role;
revoke all on function private.catalog_launch_served_state_mutation_event_sha256(
  uuid, uuid, bigint, text, text, text, text, timestamptz, text, text, text
) from public, anon, authenticated, service_role;

create table private.catalog_launch_curation_product_mutations (
  id                                      uuid primary key,
  product_id                              uuid not null,
  generation                              bigint not null check (generation > 0),
  mutation_kind                           text not null check (mutation_kind in (
    'served_state_row_mutation', 'operator_correction_hold'
  )),
  source_relation                         text not null check (source_relation in (
    'public.products',
    'public.catalog_sources',
    'public.catalog_import_batches',
    'public.brands',
    'public.product_categories',
    'public.product_barcodes',
    'public.product_ingredient_lists',
    'public.product_ingredient_tokens',
    'public.product_ingredients',
    'public.ingredients',
    'public.ingredient_synonyms',
    'public.ingredient_tag_assignments',
    'public.ingredient_tag_definitions',
    'public.product_active_bands',
    'public.product_pao_expiry',
    'public.catalog_corrections',
    'private.catalog_import_staged_records'
  )),
  source_row_key                          text not null check (
    source_row_key = pg_catalog.btrim(source_row_key)
    and pg_catalog.length(source_row_key) between 1 and 500
  ),
  mutation_operation                      text not null check (
    mutation_operation in ('INSERT', 'UPDATE', 'DELETE')
  ),
  observed_at                             timestamptz not null
    check (pg_catalog.isfinite(observed_at)),
  before_row_sha256                       text check (
    before_row_sha256 is null or before_row_sha256 ~ '^[a-f0-9]{64}$'
  ),
  after_row_sha256                        text check (
    after_row_sha256 is null or after_row_sha256 ~ '^[a-f0-9]{64}$'
  ),
  previous_served_state_mutation_root_sha256 text not null check (
    previous_served_state_mutation_root_sha256 ~ '^[a-f0-9]{64}$'
  ),
  mutation_event_sha256                   text not null unique check (
    mutation_event_sha256 ~ '^[a-f0-9]{64}$'
  ),
  served_state_mutation_root_sha256       text not null unique check (
    served_state_mutation_root_sha256 ~ '^[a-f0-9]{64}$'
  ),
  unique (product_id, generation),
  check (
    (mutation_operation = 'INSERT' and before_row_sha256 is null
      and after_row_sha256 is not null)
    or (mutation_operation = 'UPDATE' and before_row_sha256 is not null
      and after_row_sha256 is not null
      and before_row_sha256 <> after_row_sha256)
    or (mutation_operation = 'DELETE' and before_row_sha256 is not null
      and after_row_sha256 is null)
  ),
  check (
    mutation_event_sha256 =
      private.catalog_launch_served_state_mutation_event_sha256(
        id, product_id, generation, mutation_kind, source_relation,
        source_row_key, mutation_operation, observed_at,
        before_row_sha256, after_row_sha256,
        previous_served_state_mutation_root_sha256
      )
  ),
  check (
    served_state_mutation_root_sha256 =
      private.catalog_launch_served_state_mutation_root_sha256(
        product_id, generation, mutation_event_sha256
      )
  )
);

create index catalog_launch_curation_product_mutations_product_idx
  on private.catalog_launch_curation_product_mutations
  (product_id, generation desc);

create or replace function private.catalog_launch_current_served_state_mutation_root_sha256(
  p_product_id uuid
)
returns text
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce(
    (
      select mutation.served_state_mutation_root_sha256
      from private.catalog_launch_curation_product_mutations as mutation
      where mutation.product_id = p_product_id
      order by mutation.generation desc
      limit 1
    ),
    private.catalog_launch_served_state_mutation_root_sha256(
      p_product_id, 0, null
    )
  )
$$;

revoke all on function private.catalog_launch_current_served_state_mutation_root_sha256(uuid)
  from public, anon, authenticated, service_role;

create or replace function private.guard_catalog_launch_curation_product_mutation_write()
returns trigger
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v_generation bigint := 0;
  v_previous_root text;
begin
  if tg_op <> 'INSERT' then
    raise exception 'CATALOG_LAUNCH_CURATION_PRODUCT_MUTATION_IMMUTABLE'
      using errcode = '55000';
  end if;
  perform pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended('catalog-launch-curation-global', 0)
  );
  select mutation.generation, mutation.served_state_mutation_root_sha256
    into v_generation, v_previous_root
  from private.catalog_launch_curation_product_mutations as mutation
  where mutation.product_id = new.product_id
  order by mutation.generation desc
  limit 1;
  if not found then
    v_generation := 0;
    v_previous_root :=
      private.catalog_launch_served_state_mutation_root_sha256(
        new.product_id, 0, null
      );
  end if;
  if new.generation <> v_generation + 1
     or new.previous_served_state_mutation_root_sha256 <> v_previous_root then
    raise exception 'CATALOG_LAUNCH_CURATION_PRODUCT_MUTATION_PREDECESSOR_INVALID'
      using errcode = '55000';
  end if;
  return new;
end;
$$;

revoke all on function private.guard_catalog_launch_curation_product_mutation_write()
  from public, anon, authenticated, service_role;

create trigger catalog_launch_curation_product_mutations_guard
  before insert or update or delete
  on private.catalog_launch_curation_product_mutations
  for each row execute function
    private.guard_catalog_launch_curation_product_mutation_write();

create or replace function private.catalog_launch_append_product_mutations(
  p_product_ids uuid[],
  p_mutation_kind text,
  p_source_relation text,
  p_source_row_key text,
  p_mutation_operation text,
  p_before_row jsonb,
  p_after_row jsonb
)
returns void
language plpgsql
volatile
security definer
set search_path = ''
set timezone = 'UTC'
as $$
declare
  v_product_id uuid;
  v_id uuid;
  v_generation bigint;
  v_previous_root text;
  v_event_sha256 text;
  v_root_sha256 text;
  v_before_sha256 text;
  v_after_sha256 text;
  v_now timestamptz := pg_catalog.clock_timestamp();
begin
  if p_product_ids is null or pg_catalog.cardinality(p_product_ids) = 0 then
    return;
  end if;
  if p_mutation_kind not in (
       'served_state_row_mutation', 'operator_correction_hold'
     )
     or p_source_relation not in (
       'public.products', 'public.catalog_sources',
       'public.catalog_import_batches', 'public.brands',
       'public.product_categories', 'public.product_barcodes',
       'public.product_ingredient_lists', 'public.product_ingredient_tokens',
       'public.product_ingredients', 'public.ingredients',
       'public.ingredient_synonyms', 'public.ingredient_tag_assignments',
       'public.ingredient_tag_definitions', 'public.product_active_bands',
       'public.product_pao_expiry', 'public.catalog_corrections',
       'private.catalog_import_staged_records'
     )
     or p_source_row_key is null
     or p_source_row_key <> pg_catalog.btrim(p_source_row_key)
     or pg_catalog.length(p_source_row_key) not between 1 and 500
     or p_mutation_operation not in ('INSERT', 'UPDATE', 'DELETE')
     or (p_mutation_operation = 'INSERT'
       and (p_before_row is not null or p_after_row is null))
     or (p_mutation_operation = 'UPDATE'
       and (p_before_row is null or p_after_row is null))
     or (p_mutation_operation = 'DELETE'
       and (p_before_row is null or p_after_row is not null)) then
    raise exception 'CATALOG_LAUNCH_CURATION_PRODUCT_MUTATION_INPUT_INVALID'
      using errcode = '22023';
  end if;

  v_before_sha256 := case when p_before_row is null then null else
    private.catalog_import_sha256_text(
      private.catalog_import_canonical_json(p_before_row)
    ) end;
  v_after_sha256 := case when p_after_row is null then null else
    private.catalog_import_sha256_text(
      private.catalog_import_canonical_json(p_after_row)
    ) end;
  if p_mutation_operation = 'UPDATE'
     and v_before_sha256 = v_after_sha256 then
    return;
  end if;

  -- This lock is shared with record insertion and campaign release. Therefore
  -- the mutation and the reviewer root comparison have one total order.
  perform pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended('catalog-launch-curation-global', 0)
  );
  for v_product_id in
    select distinct product_id
    from pg_catalog.unnest(p_product_ids) as product_ids(product_id)
    where product_id is not null
    order by product_id
  loop
    select mutation.generation,
      mutation.served_state_mutation_root_sha256
      into v_generation, v_previous_root
    from private.catalog_launch_curation_product_mutations as mutation
    where mutation.product_id = v_product_id
    order by mutation.generation desc
    limit 1;
    if not found then
      v_generation := 0;
      v_previous_root :=
        private.catalog_launch_served_state_mutation_root_sha256(
          v_product_id, 0, null
        );
    end if;
    v_generation := v_generation + 1;
    v_id := gen_random_uuid();
    v_event_sha256 :=
      private.catalog_launch_served_state_mutation_event_sha256(
        v_id, v_product_id, v_generation, p_mutation_kind,
        p_source_relation, p_source_row_key, p_mutation_operation, v_now,
        v_before_sha256, v_after_sha256, v_previous_root
      );
    v_root_sha256 :=
      private.catalog_launch_served_state_mutation_root_sha256(
        v_product_id, v_generation, v_event_sha256
      );
    insert into private.catalog_launch_curation_product_mutations (
      id, product_id, generation, mutation_kind, source_relation,
      source_row_key, mutation_operation, observed_at,
      before_row_sha256, after_row_sha256,
      previous_served_state_mutation_root_sha256,
      mutation_event_sha256, served_state_mutation_root_sha256
    ) values (
      v_id, v_product_id, v_generation, p_mutation_kind,
      p_source_relation, p_source_row_key, p_mutation_operation, v_now,
      v_before_sha256, v_after_sha256, v_previous_root,
      v_event_sha256, v_root_sha256
    );
  end loop;
end;
$$;

revoke all on function private.catalog_launch_append_product_mutations(
  uuid[], text, text, text, text, jsonb, jsonb
) from public, anon, authenticated, service_role;

-- Corrections originate from users and can contain arbitrary free text and
-- JSON. Only the bounded fields that decide the serving hold belong in CAT03
-- dependency/mutation evidence. This projection deliberately excludes the
-- reporter identity, barcode/type, description, proposed/client payloads,
-- assignee/resolver notes, source, and ambient created/updated timestamps.
create or replace function private.catalog_launch_correction_serving_projection(
  p_row jsonb
)
returns jsonb
language sql
immutable
security definer
set search_path = ''
set timezone = 'UTC'
as $$
  select case when p_row is null then null else
    pg_catalog.jsonb_build_object(
      'correctionId', p_row ->> 'id',
      'productId', p_row ->> 'product_id',
      'status', p_row ->> 'status',
      'operatorReviewedAt', case
        when nullif(p_row ->> 'operator_reviewed_at', '') is null then null
        else pg_catalog.to_char(
          (p_row ->> 'operator_reviewed_at')::timestamptz at time zone 'UTC',
          'YYYY-MM-DD"T"HH24:MI:SS.US"Z"'
        )
      end,
      'reviewerPresent',
        nullif(pg_catalog.btrim(p_row ->> 'operator_reviewed_by'), '')
          is not null,
      'notePresent',
        nullif(pg_catalog.btrim(p_row ->> 'operator_review_note'), '')
          is not null
    )
  end
$$;

revoke all on function private.catalog_launch_correction_serving_projection(jsonb)
  from public, anon, authenticated, service_role;

create or replace function private.catalog_launch_correction_is_operator_hold(
  p_row jsonb
)
returns boolean
language sql
stable
security definer
set search_path = ''
set timezone = 'UTC'
as $$
  select coalesce(
    p_row ->> 'status' in ('triaged', 'accepted')
    and nullif(p_row ->> 'operator_reviewed_at', '')::timestamptz
      <= pg_catalog.now()
    and nullif(pg_catalog.btrim(p_row ->> 'operator_reviewed_by'), '')
      is not null
    and nullif(pg_catalog.btrim(p_row ->> 'operator_review_note'), '')
      is not null,
    false
  )
$$;

revoke all on function private.catalog_launch_correction_is_operator_hold(jsonb)
  from public, anon, authenticated, service_role;

create or replace function private.capture_catalog_launch_served_state_mutation()
returns trigger
language plpgsql
volatile
security definer
set search_path = ''
set timezone = 'UTC'
as $$
declare
  v_old jsonb;
  v_new jsonb;
  v_relation text := tg_table_schema || '.' || tg_table_name;
  v_row_key text;
  v_kind text := 'served_state_row_mutation';
  v_product_ids uuid[];
  v_uuid_ids uuid[];
  v_text_ids text[];
begin
  if tg_op <> 'INSERT' then v_old := pg_catalog.to_jsonb(old); end if;
  if tg_op <> 'DELETE' then v_new := pg_catalog.to_jsonb(new); end if;
  -- A user-submitted/open correction is not trusted serving authority. Only
  -- an operator-confirmed hold enters the correction lane; any actual sibling
  -- product-row bookkeeping mutation is still captured by the product lane.
  if tg_table_name = 'catalog_corrections' then
    if not private.catalog_launch_correction_is_operator_hold(v_old)
       and not private.catalog_launch_correction_is_operator_hold(v_new) then
      if tg_op = 'DELETE' then return old; else return new; end if;
    end if;
    v_kind := 'operator_correction_hold';
    v_old := private.catalog_launch_correction_serving_projection(v_old);
    v_new := private.catalog_launch_correction_serving_projection(v_new);
  end if;

  if tg_op = 'UPDATE'
     and private.catalog_import_canonical_json(v_old) =
       private.catalog_import_canonical_json(v_new) then
    return new;
  end if;

  v_row_key := coalesce(
    v_new ->> 'id', v_old ->> 'id',
    v_new ->> 'correctionId', v_old ->> 'correctionId',
    v_new ->> 'barcode', v_old ->> 'barcode',
    v_new ->> 'tag', v_old ->> 'tag'
  );
  if tg_table_name = 'product_ingredients' then
    v_row_key := coalesce(v_new ->> 'product_id', v_old ->> 'product_id')
      || ':' || coalesce(v_new ->> 'ingredient_id', v_old ->> 'ingredient_id');
  end if;

  if tg_table_name = 'products' then
    v_product_ids := array[
      nullif(v_old ->> 'id', '')::uuid,
      nullif(v_new ->> 'id', '')::uuid
    ];
  elsif tg_table_name in (
    'product_barcodes', 'product_ingredient_lists',
    'product_ingredient_tokens', 'product_ingredients',
    'product_active_bands', 'product_pao_expiry'
  ) then
    v_product_ids := array[
      nullif(v_old ->> 'product_id', '')::uuid,
      nullif(v_new ->> 'product_id', '')::uuid
    ];
  elsif tg_table_name = 'catalog_corrections' then
    v_product_ids := array[
      nullif(v_old ->> 'productId', '')::uuid,
      nullif(v_new ->> 'productId', '')::uuid
    ];
  elsif tg_table_name = 'brands' then
    v_uuid_ids := array[
      nullif(v_old ->> 'id', '')::uuid,
      nullif(v_new ->> 'id', '')::uuid
    ];
    select pg_catalog.array_agg(distinct product.id)
      into v_product_ids
    from public.products as product
    where product.brand_id = any(v_uuid_ids);
  elsif tg_table_name = 'product_categories' then
    v_text_ids := array[v_old ->> 'id', v_new ->> 'id'];
    select pg_catalog.array_agg(distinct product.id)
      into v_product_ids
    from public.products as product
    where product.category_id = any(v_text_ids);
  elsif tg_table_name = 'ingredients' then
    v_uuid_ids := array[
      nullif(v_old ->> 'id', '')::uuid,
      nullif(v_new ->> 'id', '')::uuid
    ];
    select pg_catalog.array_agg(distinct impacted.product_id)
      into v_product_ids
    from (
      select link.product_id from public.product_ingredients as link
        where link.ingredient_id = any(v_uuid_ids)
      union select token.product_id from public.product_ingredient_tokens as token
        where token.ingredient_id = any(v_uuid_ids)
      union select band.product_id from public.product_active_bands as band
        where band.ingredient_id = any(v_uuid_ids)
    ) as impacted;
  elsif tg_table_name in ('ingredient_synonyms', 'ingredient_tag_assignments') then
    v_uuid_ids := array[
      nullif(v_old ->> 'ingredient_id', '')::uuid,
      nullif(v_new ->> 'ingredient_id', '')::uuid
    ];
    select pg_catalog.array_agg(distinct impacted.product_id)
      into v_product_ids
    from (
      select link.product_id from public.product_ingredients as link
        where link.ingredient_id = any(v_uuid_ids)
      union select token.product_id from public.product_ingredient_tokens as token
        where token.ingredient_id = any(v_uuid_ids)
      union select band.product_id from public.product_active_bands as band
        where band.ingredient_id = any(v_uuid_ids)
    ) as impacted;
  elsif tg_table_name = 'ingredient_tag_definitions' then
    v_text_ids := array[v_old ->> 'tag', v_new ->> 'tag'];
    select pg_catalog.array_agg(distinct impacted.product_id)
      into v_product_ids
    from (
      select token.product_id
      from public.product_ingredient_tokens as token
      where token.tags && v_text_ids
      union
      select link.product_id
      from public.ingredient_tag_assignments as assignment
      join public.product_ingredients as link
        on link.ingredient_id = assignment.ingredient_id
      where assignment.tag = any(v_text_ids)
      union
      select token.product_id
      from public.ingredient_tag_assignments as assignment
      join public.product_ingredient_tokens as token
        on token.ingredient_id = assignment.ingredient_id
      where assignment.tag = any(v_text_ids)
      union
      select band.product_id
      from public.ingredient_tag_assignments as assignment
      join public.product_active_bands as band
        on band.ingredient_id = assignment.ingredient_id
      where assignment.tag = any(v_text_ids)
      union
      select band.product_id from public.product_active_bands as band
      where band.tag = any(v_text_ids)
    ) as impacted;
  elsif tg_table_name = 'catalog_sources' then
    v_uuid_ids := array[
      nullif(v_old ->> 'id', '')::uuid,
      nullif(v_new ->> 'id', '')::uuid
    ];
    select pg_catalog.array_agg(distinct impacted.product_id)
      into v_product_ids
    from (
      select product.id as product_id from public.products as product
        where product.source_id = any(v_uuid_ids)
      union select product.id from public.products as product
        join public.brands as brand on brand.id = product.brand_id
        where brand.source_id = any(v_uuid_ids)
      union select mapping.product_id from public.product_barcodes as mapping
        where mapping.source_id = any(v_uuid_ids)
      union select ingredient_list.product_id
        from public.product_ingredient_lists as ingredient_list
        where ingredient_list.source_id = any(v_uuid_ids)
      union select token.product_id from public.product_ingredient_tokens as token
        where token.source_id = any(v_uuid_ids)
      union select link.product_id from public.product_ingredients as link
        where link.source_id = any(v_uuid_ids)
      union select band.product_id from public.product_active_bands as band
        where band.source_id = any(v_uuid_ids)
      union select freshness.product_id from public.product_pao_expiry as freshness
        where freshness.source_id = any(v_uuid_ids)
      union select link.product_id from public.ingredients as ingredient
        join public.product_ingredients as link on link.ingredient_id = ingredient.id
        where ingredient.source_id = any(v_uuid_ids)
      union select token.product_id from public.ingredients as ingredient
        join public.product_ingredient_tokens as token on token.ingredient_id = ingredient.id
        where ingredient.source_id = any(v_uuid_ids)
      union select band.product_id from public.ingredients as ingredient
        join public.product_active_bands as band on band.ingredient_id = ingredient.id
        where ingredient.source_id = any(v_uuid_ids)
      union select token.product_id from public.ingredient_synonyms as synonym
        join public.product_ingredient_tokens as token
          on token.ingredient_id = synonym.ingredient_id
        where synonym.source_id = any(v_uuid_ids)
      union select link.product_id from public.ingredient_synonyms as synonym
        join public.product_ingredients as link
          on link.ingredient_id = synonym.ingredient_id
        where synonym.source_id = any(v_uuid_ids)
      union select band.product_id from public.ingredient_synonyms as synonym
        join public.product_active_bands as band
          on band.ingredient_id = synonym.ingredient_id
        where synonym.source_id = any(v_uuid_ids)
      union select token.product_id from public.ingredient_tag_assignments as assignment
        join public.product_ingredient_tokens as token
          on token.ingredient_id = assignment.ingredient_id
        where assignment.source_id = any(v_uuid_ids)
      union select link.product_id from public.ingredient_tag_assignments as assignment
        join public.product_ingredients as link
          on link.ingredient_id = assignment.ingredient_id
        where assignment.source_id = any(v_uuid_ids)
      union select band.product_id from public.ingredient_tag_assignments as assignment
        join public.product_active_bands as band
          on band.ingredient_id = assignment.ingredient_id
        where assignment.source_id = any(v_uuid_ids)
    ) as impacted;
  elsif tg_table_name = 'catalog_import_batches' then
    v_uuid_ids := array[
      nullif(v_old ->> 'id', '')::uuid,
      nullif(v_new ->> 'id', '')::uuid
    ];
    select pg_catalog.array_agg(distinct impacted.product_id)
      into v_product_ids
    from (
      select product.id as product_id from public.products as product
        where product.import_batch_id = any(v_uuid_ids)
      union select mapping.product_id from public.product_barcodes as mapping
        where mapping.import_batch_id = any(v_uuid_ids)
      union select ingredient_list.product_id
        from public.product_ingredient_lists as ingredient_list
        where ingredient_list.import_batch_id = any(v_uuid_ids)
      union select link.product_id from public.ingredients as ingredient
        join public.product_ingredients as link on link.ingredient_id = ingredient.id
        where ingredient.import_batch_id = any(v_uuid_ids)
      union select token.product_id from public.ingredients as ingredient
        join public.product_ingredient_tokens as token on token.ingredient_id = ingredient.id
        where ingredient.import_batch_id = any(v_uuid_ids)
      union select band.product_id from public.ingredients as ingredient
        join public.product_active_bands as band on band.ingredient_id = ingredient.id
        where ingredient.import_batch_id = any(v_uuid_ids)
      union select token.product_id from public.ingredient_synonyms as synonym
        join public.product_ingredient_tokens as token
          on token.ingredient_id = synonym.ingredient_id
        where synonym.import_batch_id = any(v_uuid_ids)
      union select link.product_id from public.ingredient_synonyms as synonym
        join public.product_ingredients as link
          on link.ingredient_id = synonym.ingredient_id
        where synonym.import_batch_id = any(v_uuid_ids)
      union select band.product_id from public.ingredient_synonyms as synonym
        join public.product_active_bands as band
          on band.ingredient_id = synonym.ingredient_id
        where synonym.import_batch_id = any(v_uuid_ids)
      union select record.product_id
        from private.catalog_launch_curation_records as record
        join private.catalog_launch_curation_campaigns as campaign
          on campaign.id = record.campaign_id
        where record.import_batch_id = any(v_uuid_ids)
          or campaign.contributing_batch_ids && v_uuid_ids
          or exists (
            select 1
            from pg_catalog.jsonb_array_elements(record.dependency_memberships)
              as membership(value)
            where (membership.value ->> 'batchId')::uuid = any(v_uuid_ids)
          )
    ) as impacted;
  elsif tg_table_name = 'catalog_import_staged_records' then
    v_uuid_ids := array[
      nullif(v_old ->> 'id', '')::uuid,
      nullif(v_new ->> 'id', '')::uuid
    ];
    select pg_catalog.array_agg(distinct impacted.product_id)
      into v_product_ids
    from (
      select product.id as product_id from public.products as product
        where product.import_staged_record_id = any(v_uuid_ids)
      union select mapping.product_id from public.product_barcodes as mapping
        where mapping.import_staged_record_id = any(v_uuid_ids)
      union select ingredient_list.product_id
        from public.product_ingredient_lists as ingredient_list
        where ingredient_list.import_staged_record_id = any(v_uuid_ids)
      union select link.product_id from public.ingredients as ingredient
        join public.product_ingredients as link on link.ingredient_id = ingredient.id
        where ingredient.import_staged_record_id = any(v_uuid_ids)
      union select token.product_id from public.ingredients as ingredient
        join public.product_ingredient_tokens as token on token.ingredient_id = ingredient.id
        where ingredient.import_staged_record_id = any(v_uuid_ids)
      union select band.product_id from public.ingredients as ingredient
        join public.product_active_bands as band on band.ingredient_id = ingredient.id
        where ingredient.import_staged_record_id = any(v_uuid_ids)
      union select token.product_id from public.ingredient_synonyms as synonym
        join public.product_ingredient_tokens as token
          on token.ingredient_id = synonym.ingredient_id
        where synonym.import_staged_record_id = any(v_uuid_ids)
      union select link.product_id from public.ingredient_synonyms as synonym
        join public.product_ingredients as link
          on link.ingredient_id = synonym.ingredient_id
        where synonym.import_staged_record_id = any(v_uuid_ids)
      union select band.product_id from public.ingredient_synonyms as synonym
        join public.product_active_bands as band
          on band.ingredient_id = synonym.ingredient_id
        where synonym.import_staged_record_id = any(v_uuid_ids)
      union select record.product_id
        from private.catalog_launch_curation_records as record
        where record.import_staged_record_id = any(v_uuid_ids)
    ) as impacted;
  else
    raise exception 'CATALOG_LAUNCH_CURATION_MUTATION_TRIGGER_RELATION_UNSUPPORTED'
      using errcode = '55000';
  end if;

  perform private.catalog_launch_append_product_mutations(
    v_product_ids, v_kind, v_relation, v_row_key, tg_op, v_old, v_new
  );
  if tg_op = 'DELETE' then return old; end if;
  return new;
end;
$$;

revoke all on function private.capture_catalog_launch_served_state_mutation()
  from public, anon, authenticated, service_role;

create trigger catalog_launch_mutation_products
  after insert or update or delete on public.products
  for each row execute function private.capture_catalog_launch_served_state_mutation();
create trigger catalog_launch_mutation_sources
  after insert or update or delete on public.catalog_sources
  for each row execute function private.capture_catalog_launch_served_state_mutation();
create trigger catalog_launch_mutation_batches
  after insert or update or delete on public.catalog_import_batches
  for each row execute function private.capture_catalog_launch_served_state_mutation();
create trigger catalog_launch_mutation_brands
  after insert or update or delete on public.brands
  for each row execute function private.capture_catalog_launch_served_state_mutation();
create trigger catalog_launch_mutation_categories
  after insert or update or delete on public.product_categories
  for each row execute function private.capture_catalog_launch_served_state_mutation();
create trigger catalog_launch_mutation_barcodes
  after insert or update or delete on public.product_barcodes
  for each row execute function private.capture_catalog_launch_served_state_mutation();
create trigger catalog_launch_mutation_ingredient_lists
  after insert or update or delete on public.product_ingredient_lists
  for each row execute function private.capture_catalog_launch_served_state_mutation();
create trigger catalog_launch_mutation_ingredient_tokens
  after insert or update or delete on public.product_ingredient_tokens
  for each row execute function private.capture_catalog_launch_served_state_mutation();
create trigger catalog_launch_mutation_product_ingredients
  after insert or update or delete on public.product_ingredients
  for each row execute function private.capture_catalog_launch_served_state_mutation();
create trigger catalog_launch_mutation_ingredients
  after insert or update or delete on public.ingredients
  for each row execute function private.capture_catalog_launch_served_state_mutation();
create trigger catalog_launch_mutation_synonyms
  after insert or update or delete on public.ingredient_synonyms
  for each row execute function private.capture_catalog_launch_served_state_mutation();
create trigger catalog_launch_mutation_tag_assignments
  after insert or update or delete on public.ingredient_tag_assignments
  for each row execute function private.capture_catalog_launch_served_state_mutation();
create trigger catalog_launch_mutation_tag_definitions
  after insert or update or delete on public.ingredient_tag_definitions
  for each row execute function private.capture_catalog_launch_served_state_mutation();
create trigger catalog_launch_mutation_active_bands
  after insert or update or delete on public.product_active_bands
  for each row execute function private.capture_catalog_launch_served_state_mutation();
create trigger catalog_launch_mutation_pao_expiry
  after insert or update or delete on public.product_pao_expiry
  for each row execute function private.capture_catalog_launch_served_state_mutation();
create trigger catalog_launch_mutation_operator_corrections
  after insert or update or delete on public.catalog_corrections
  for each row execute function private.capture_catalog_launch_served_state_mutation();
create trigger catalog_launch_mutation_staged_records
  after insert or update or delete on private.catalog_import_staged_records
  for each row execute function private.capture_catalog_launch_served_state_mutation();

create or replace function private.catalog_launch_curation_served_state_mutation_root_set_sha256(
  p_roots jsonb
)
returns text
language plpgsql
immutable
security definer
set search_path = ''
as $$
declare
  v_root jsonb;
  v_normalized jsonb;
begin
  if p_roots is null or pg_catalog.jsonb_typeof(p_roots) <> 'array' then
    raise exception 'CATALOG_LAUNCH_CURATION_MUTATION_ROOT_SET_INVALID'
      using errcode = '22023';
  end if;
  for v_root in
    select item.value
    from pg_catalog.jsonb_array_elements(p_roots) as item(value)
  loop
    if pg_catalog.jsonb_typeof(v_root) <> 'object'
       or not (v_root ?& array[
         'productRecordSha256', 'servedStateMutationRootSha256'
       ])
       or (v_root - array[
         'productRecordSha256', 'servedStateMutationRootSha256'
       ]::text[]) <> '{}'::jsonb
       or pg_catalog.jsonb_typeof(v_root -> 'productRecordSha256') <> 'string'
       or pg_catalog.jsonb_typeof(
         v_root -> 'servedStateMutationRootSha256'
       ) <> 'string'
       or (v_root ->> 'productRecordSha256') !~ '^[a-f0-9]{64}$'
       or (v_root ->> 'servedStateMutationRootSha256') !~ '^[a-f0-9]{64}$'
    then
      raise exception 'CATALOG_LAUNCH_CURATION_MUTATION_ROOT_SET_INVALID'
        using errcode = '22023';
    end if;
  end loop;
  if (
    select pg_catalog.count(*) <> pg_catalog.count(
      distinct item.value ->> 'productRecordSha256'
    )
    from pg_catalog.jsonb_array_elements(p_roots) as item(value)
  ) then
    raise exception 'CATALOG_LAUNCH_CURATION_MUTATION_ROOT_SET_DUPLICATE'
      using errcode = '22023';
  end if;
  select coalesce(
    pg_catalog.jsonb_agg(
      item.value
      order by item.value ->> 'productRecordSha256' collate pg_catalog."C"
    ),
    '[]'::jsonb
  ) into v_normalized
  from pg_catalog.jsonb_array_elements(p_roots) as item(value);
  return private.catalog_import_sha256_text(
    private.catalog_import_canonical_json(
      pg_catalog.jsonb_build_object(
        'contractId',
          'catalog-launch-curation-served-state-mutation-root-set-v1',
        'roots', v_normalized
      )
    )
  );
end;
$$;

create or replace function private.catalog_launch_curation_campaign_stored_mutation_root_set_sha256(
  p_campaign_id uuid
)
returns text
language sql
stable
security definer
set search_path = ''
as $$
  select private.catalog_launch_curation_served_state_mutation_root_set_sha256(
    coalesce(
      pg_catalog.jsonb_agg(
        pg_catalog.jsonb_build_object(
          'productRecordSha256', record.product_record_sha256,
          'servedStateMutationRootSha256',
            record.served_state_mutation_root_sha256
        ) order by record.product_record_sha256 collate pg_catalog."C"
      ) filter (where record.id is not null),
      '[]'::jsonb
    )
  )
  from private.catalog_launch_curation_campaigns as campaign
  left join private.catalog_launch_curation_records as record
    on record.campaign_id = campaign.id
  where campaign.id = p_campaign_id
  group by campaign.id
$$;

create or replace function private.catalog_launch_curation_campaign_current_mutation_root_set_sha256(
  p_campaign_id uuid
)
returns text
language sql
stable
security definer
set search_path = ''
as $$
  select private.catalog_launch_curation_served_state_mutation_root_set_sha256(
    coalesce(
      pg_catalog.jsonb_agg(
        pg_catalog.jsonb_build_object(
          'productRecordSha256', record.product_record_sha256,
          'servedStateMutationRootSha256',
            private.catalog_launch_current_served_state_mutation_root_sha256(
              record.product_id
            )
        ) order by record.product_record_sha256 collate pg_catalog."C"
      ) filter (where record.id is not null),
      '[]'::jsonb
    )
  )
  from private.catalog_launch_curation_campaigns as campaign
  left join private.catalog_launch_curation_records as record
    on record.campaign_id = campaign.id
  where campaign.id = p_campaign_id
  group by campaign.id
$$;

revoke all on function private.catalog_launch_curation_served_state_mutation_root_set_sha256(jsonb)
  from public, anon, authenticated, service_role;
revoke all on function private.catalog_launch_curation_campaign_stored_mutation_root_set_sha256(uuid)
  from public, anon, authenticated, service_role;
revoke all on function private.catalog_launch_curation_campaign_current_mutation_root_set_sha256(uuid)
  from public, anon, authenticated, service_role;

create or replace function private.catalog_launch_curation_record_membership_payload_is_valid(
  p_curation_record_id uuid,
  p_dependency_memberships jsonb
)
returns boolean
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_record private.catalog_launch_curation_records%rowtype;
  v_campaign private.catalog_launch_curation_campaigns%rowtype;
  v_item record;
  v_artifact jsonb;
  v_batch_id uuid;
  v_scope text;
  v_sort_key text;
  v_previous_sort_key text;
  v_barcode_count integer := 0;
  v_category_count integer := 0;
  v_ingredients_count integer := 0;
  v_regulatory_count integer := 0;
  v_ingredient_graph_count integer;
begin
  select record.* into v_record
  from private.catalog_launch_curation_records as record
  where record.id = p_curation_record_id;
  if not found then
    return false;
  end if;
  select campaign.* into v_campaign
  from private.catalog_launch_curation_campaigns as campaign
  where campaign.id = v_record.campaign_id;
  if not found
     or pg_catalog.jsonb_typeof(p_dependency_memberships) <> 'array'
     or pg_catalog.jsonb_array_length(p_dependency_memberships)
       not between 4 and 512
     or not (v_record.import_batch_id = any(v_campaign.contributing_batch_ids)) then
    return false;
  end if;

  for v_item in
    select membership.value, membership.ordinality
    from pg_catalog.jsonb_array_elements(p_dependency_memberships)
      with ordinality as membership(value, ordinality)
    order by membership.ordinality
  loop
    if pg_catalog.jsonb_typeof(v_item.value) <> 'object'
       or not (v_item.value ?& array[
         'fieldScope', 'dependencyEntitySha256', 'batchId',
         'artifactSetSha256',
         'cat02StageRecordSha256', 'cat02DatabaseNormalizedRecordSha256',
         'sourceApprovalSha256', 'sourceQaSha256',
         'membershipEvidenceSha256'
       ])
       or (v_item.value - array[
         'fieldScope', 'dependencyEntitySha256', 'batchId',
         'artifactSetSha256',
         'cat02StageRecordSha256', 'cat02DatabaseNormalizedRecordSha256',
         'sourceApprovalSha256', 'sourceQaSha256',
         'membershipEvidenceSha256'
       ]::text[]) <> '{}'::jsonb
       or v_item.value ->> 'fieldScope' not in (
         'barcode_identity', 'category', 'ingredients',
         'regulatory_classification'
       )
       or (v_item.value ->> 'dependencyEntitySha256')
         !~ '^[a-f0-9]{64}$'
       or (v_item.value ->> 'batchId')
         !~ '^[a-f0-9]{8}-[a-f0-9]{4}-[1-8][a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$'
       or (v_item.value ->> 'artifactSetSha256') !~ '^[a-f0-9]{64}$'
       or (v_item.value ->> 'cat02StageRecordSha256') !~ '^[a-f0-9]{64}$'
       or (v_item.value ->> 'cat02DatabaseNormalizedRecordSha256')
         !~ '^[a-f0-9]{64}$'
       or (v_item.value ->> 'sourceApprovalSha256') !~ '^[a-f0-9]{64}$'
       or (v_item.value ->> 'sourceQaSha256') !~ '^[a-f0-9]{64}$'
       or (v_item.value ->> 'membershipEvidenceSha256')
         !~ '^[a-f0-9]{64}$' then
      return false;
    end if;
    v_scope := v_item.value ->> 'fieldScope';
    v_batch_id := (v_item.value ->> 'batchId')::uuid;
    v_sort_key := v_scope || ':' ||
      (v_item.value ->> 'dependencyEntitySha256') || ':' ||
      v_batch_id::text;
    if v_previous_sort_key is not null
       and v_previous_sort_key >= v_sort_key then
      return false;
    end if;
    v_previous_sort_key := v_sort_key;
    v_barcode_count := v_barcode_count +
      case when v_scope = 'barcode_identity' then 1 else 0 end;
    v_category_count := v_category_count +
      case when v_scope = 'category' then 1 else 0 end;
    v_ingredients_count := v_ingredients_count +
      case when v_scope = 'ingredients' then 1 else 0 end;
    v_regulatory_count := v_regulatory_count +
      case when v_scope = 'regulatory_classification' then 1 else 0 end;
    if not (v_batch_id = any(v_campaign.contributing_batch_ids)) then
      return false;
    end if;
    select artifact.value into v_artifact
    from pg_catalog.jsonb_array_elements(v_campaign.cat02_artifact_sets)
      as artifact(value)
    where artifact.value ->> 'batchId' = v_batch_id::text;
    if not found
       or v_item.value ->> 'artifactSetSha256' <>
         private.catalog_launch_curation_cat02_artifact_sha256(v_artifact)
       or v_item.value ->> 'cat02DatabaseNormalizedRecordSha256' <>
         private.catalog_launch_curation_membership_database_sha256(
           v_record.product_record_sha256,
           v_scope,
           v_item.value ->> 'dependencyEntitySha256',
           v_record.barcode,
           v_record.category_code,
           v_record.product_snapshot_sha256,
           v_record.dependency_sha256,
           v_record.regulatory_classification,
           v_record.regulatory_review_evidence_sha256,
           v_record.regulatory_reviewer_ids
         )
       or v_item.value ->> 'membershipEvidenceSha256' is distinct from
         private.catalog_launch_curation_membership_evidence_sha256(
           v_record.product_id,
           v_record.ingredient_list_id,
           v_record.barcode,
           v_record.product_record_sha256,
           v_scope,
           v_item.value ->> 'dependencyEntitySha256',
           v_batch_id,
           v_item.value ->> 'artifactSetSha256',
           v_item.value ->> 'cat02StageRecordSha256',
           v_item.value ->> 'cat02DatabaseNormalizedRecordSha256',
           v_item.value ->> 'sourceApprovalSha256',
           v_item.value ->> 'sourceQaSha256'
         )
       or not exists (
         select 1
         from public.catalog_import_batches as batch
         where batch.id = v_batch_id
           and batch.status = 'promoted'
           and batch.artifact_kind = 'production'
           and batch.territory = 'US'
           and batch.qa_blocker_count = 0
           and batch.qa_warning_count = 0
           and batch.source_approval_sha256
             = v_item.value ->> 'sourceApprovalSha256'
           and batch.qa_report_sha256 = v_item.value ->> 'sourceQaSha256'
           and private.catalog_source_is_production_approved(batch.source_id)
       )
       or (
         select count(*)
         from private.catalog_import_staged_records as staged
         where staged.batch_id = v_batch_id
           and staged.record_sha256
             = v_item.value ->> 'cat02StageRecordSha256'
           and staged.record_kind = case
             when v_scope = 'ingredients' then 'ingredient'
             else 'product'
           end
           and staged.disposition = 'accepted'
           and staged.sealed_at is not null
       ) <> 1 then
      return false;
    end if;
    if v_scope <> 'ingredients'
       and (
         v_batch_id <> v_record.import_batch_id
         or v_item.value ->> 'cat02StageRecordSha256'
           <> v_record.cat02_stage_record_sha256
         or v_item.value ->> 'sourceApprovalSha256'
           <> v_record.source_approval_sha256
         or v_item.value ->> 'sourceQaSha256' <> v_record.source_qa_sha256
         or not exists (
           select 1
           from private.catalog_import_staged_records as staged
           where staged.id = v_record.import_staged_record_id
             and staged.batch_id = v_batch_id
             and staged.record_kind = 'product'
             and staged.record_sha256 = v_record.cat02_stage_record_sha256
             and staged.disposition = 'accepted'
             and staged.sealed_at is not null
         )
       ) then
      return false;
    end if;
    if v_scope = 'barcode_identity'
       and v_item.value ->> 'cat02DatabaseNormalizedRecordSha256'
         <> v_record.cat02_database_normalized_record_sha256 then
      return false;
    end if;
  end loop;
  if v_barcode_count <> 1
     or v_category_count <> 1
     or v_regulatory_count <> 1
     or v_ingredients_count < 1 then
    return false;
  end if;
  select count(distinct ingredient.id)::integer
    into v_ingredient_graph_count
  from public.product_ingredient_tokens as token
  join public.product_ingredients as link
    on link.product_id = token.product_id
   and link.ingredient_list_id = token.ingredient_list_id
   and link.ingredient_id = token.ingredient_id
   and link.position = token.position
   and link.is_unmatched is false
  join public.ingredients as ingredient on ingredient.id = token.ingredient_id
  where token.product_id = v_record.product_id
    and token.ingredient_list_id = v_record.ingredient_list_id
    and token.is_unmatched is false;
  if v_ingredient_graph_count <> v_ingredients_count then
    return false;
  end if;
  return true;
exception when others then
  return false;
end;
$$;

create or replace function private.catalog_launch_curation_record_memberships_are_valid(
  p_curation_record_id uuid
)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce((
    select private.catalog_launch_curation_record_membership_payload_is_valid(
      record.id, record.dependency_memberships
    )
    from private.catalog_launch_curation_records as record
    where record.id = p_curation_record_id
  ),
    false
  )
$$;

create or replace function private.catalog_launch_curation_campaign_membership_set_sha256(
  p_campaign_id uuid
)
returns text
language sql
stable
security definer
set search_path = ''
as $$
  select private.catalog_launch_curation_cat02_membership_set_sha256(
    coalesce(
      pg_catalog.jsonb_agg(
        pg_catalog.jsonb_build_object(
          'productRecordSha256', record.product_record_sha256
        ) || membership.value
        order by record.product_record_sha256,
          membership.value ->> 'fieldScope',
          membership.value ->> 'dependencyEntitySha256',
          membership.value ->> 'batchId'
      ),
      '[]'::jsonb
    )
  )
  from private.catalog_launch_curation_records as record
  cross join lateral pg_catalog.jsonb_array_elements(
    record.dependency_memberships
  ) as membership(value)
  where record.campaign_id = p_campaign_id
$$;

create or replace function private.catalog_launch_curation_campaign_membership_batch_ids(
  p_campaign_id uuid
)
returns uuid[]
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce(
    pg_catalog.array_agg(distinct (membership.value ->> 'batchId')::uuid
      order by (membership.value ->> 'batchId')::uuid),
    array[]::uuid[]
  )
  from private.catalog_launch_curation_records as record
  cross join lateral pg_catalog.jsonb_array_elements(
    record.dependency_memberships
  ) as membership(value)
  where record.campaign_id = p_campaign_id
$$;

revoke all on function private.catalog_launch_curation_record_membership_payload_is_valid(uuid, jsonb)
  from public, anon, authenticated, service_role;
revoke all on function private.catalog_launch_curation_record_memberships_are_valid(uuid)
  from public, anon, authenticated, service_role;
revoke all on function private.catalog_launch_curation_campaign_membership_set_sha256(uuid)
  from public, anon, authenticated, service_role;
revoke all on function private.catalog_launch_curation_campaign_membership_batch_ids(uuid)
  from public, anon, authenticated, service_role;

create or replace function private.catalog_launch_curation_campaign_record_set_sha256(
  p_campaign_id uuid
)
returns text
language sql
stable
security definer
set search_path = ''
as $$
  select private.catalog_launch_curation_record_set_sha256(
    campaign.release_id,
    coalesce(
      pg_catalog.jsonb_agg(
        pg_catalog.jsonb_build_object(
          'productRecordSha256', record.product_record_sha256,
          'cat02StageRecordSha256', record.cat02_stage_record_sha256,
          'cat02DatabaseNormalizedRecordSha256',
            record.cat02_database_normalized_record_sha256,
          'sourceApprovalSha256', record.source_approval_sha256,
          'sourceQaSha256', record.source_qa_sha256,
          'servedStateMutationRootSha256',
            record.served_state_mutation_root_sha256,
          'cat02MembershipReadbackSha256',
            record.cat02_membership_readback_sha256,
          'offlineBaseSealedRecordSha256', record.offline_base_sealed_record_sha256,
          'databaseBaseRecordSha256', record.database_base_record_sha256,
          'reviewedRecordMappingSha256', record.reviewed_record_mapping_sha256,
          'curationRecordSha256', record.curation_record_sha256,
          'manifestEntrySha256', record.manifest_entry_sha256,
          'databaseActivationRequestSha256', record.database_activation_request_sha256,
          'activationSignatureSha256', record.activation_signature_sha256
        ) order by record.product_record_sha256, record.id
      ) filter (where record.id is not null),
      '[]'::jsonb
    )
  )
  from private.catalog_launch_curation_campaigns as campaign
  left join private.catalog_launch_curation_records as record
    on record.campaign_id = campaign.id
  where campaign.id = p_campaign_id
  group by campaign.release_id
$$;

create or replace function private.catalog_launch_curation_campaign_authorization_set_sha256(
  p_campaign_id uuid
)
returns text
language sql
stable
security definer
set search_path = ''
as $$
  select private.catalog_launch_curation_authorization_set_sha256(
    coalesce(
      pg_catalog.jsonb_agg(
        pg_catalog.jsonb_build_object(
          'productRecordSha256', record.product_record_sha256,
          'requestSha256', record.database_activation_request_sha256
        ) order by record.product_record_sha256, record.id
      ) filter (where record.activation_decision = 'approve_activation'),
      '[]'::jsonb
    )
  )
  from private.catalog_launch_curation_campaigns as campaign
  left join private.catalog_launch_curation_records as record
    on record.campaign_id = campaign.id
  where campaign.id = p_campaign_id
  group by campaign.release_id
$$;

revoke all on function private.catalog_launch_curation_campaign_record_set_sha256(uuid)
  from public, anon, authenticated, service_role;
revoke all on function private.catalog_launch_curation_campaign_authorization_set_sha256(uuid)
  from public, anon, authenticated, service_role;

create table private.catalog_launch_curation_events (
  id                                  uuid primary key default gen_random_uuid(),
  product_id                          uuid not null references public.products (id) on delete restrict,
  territory                           text not null check (territory = 'US'),
  campaign_id                         uuid not null
    references private.catalog_launch_curation_campaigns (id) on delete restrict,
  event_type                          text not null check (event_type in ('activation', 'supersession', 'retirement')),
  previous_curation_record_id         uuid references private.catalog_launch_curation_records (id) on delete restrict,
  new_curation_record_id              uuid references private.catalog_launch_curation_records (id) on delete restrict,
  generation                          integer not null check (generation > 0),
  operation_key                       text not null unique
    check (operation_key ~ '^[A-Za-z0-9][A-Za-z0-9._:/-]{7,199}$'),
  request_sha256                      text not null check (request_sha256 ~ '^[a-f0-9]{64}$'),
  actor                               text not null
    check (actor ~ '^[A-Za-z0-9][A-Za-z0-9._@:+/-]{2,199}$'),
  reason                              text not null check (reason = pg_catalog.btrim(reason) and pg_catalog.length(reason) between 8 and 500),
  curation_record_sha256              text not null check (curation_record_sha256 ~ '^[a-f0-9]{64}$'),
  campaign_sha256                     text not null check (campaign_sha256 ~ '^[a-f0-9]{64}$'),
  signed_target_policy_sha256         text not null check (signed_target_policy_sha256 ~ '^[a-f0-9]{64}$'),
  eligibility_policy_sha256           text not null check (eligibility_policy_sha256 ~ '^[a-f0-9]{64}$'),
  database_activation_request_sha256   text check (database_activation_request_sha256 is null or database_activation_request_sha256 ~ '^[a-f0-9]{64}$'),
  activation_signature_sha256          text check (activation_signature_sha256 is null or activation_signature_sha256 ~ '^[a-f0-9]{64}$'),
  head_before_sha256                  text check (head_before_sha256 is null or head_before_sha256 ~ '^[a-f0-9]{64}$'),
  event_receipt_sha256                text not null check (event_receipt_sha256 ~ '^[a-f0-9]{64}$'),
  head_after_sha256                   text not null check (head_after_sha256 ~ '^[a-f0-9]{64}$'),
  created_at                          timestamptz not null default now(),
  check (
    (event_type = 'activation' and previous_curation_record_id is null
      and new_curation_record_id is not null
      and database_activation_request_sha256 is not null
      and activation_signature_sha256 is not null
      and request_sha256 = database_activation_request_sha256)
    or (event_type = 'supersession' and previous_curation_record_id is not null
      and new_curation_record_id is not null
      and previous_curation_record_id <> new_curation_record_id
      and database_activation_request_sha256 is not null
      and activation_signature_sha256 is not null
      and request_sha256 = database_activation_request_sha256)
    or (event_type = 'retirement' and previous_curation_record_id is not null
      and new_curation_record_id is null
      and database_activation_request_sha256 is null
      and activation_signature_sha256 is null)
  ),
  check (
    event_receipt_sha256 = private.catalog_launch_curation_event_receipt_sha256(
      id, product_id, territory, campaign_id, event_type,
      previous_curation_record_id, new_curation_record_id, generation,
      operation_key, request_sha256, actor, reason,
      curation_record_sha256, campaign_sha256,
      signed_target_policy_sha256, eligibility_policy_sha256,
      database_activation_request_sha256, activation_signature_sha256,
      head_before_sha256
    )
  )
);

create unique index catalog_launch_curation_record_activation_uidx
  on private.catalog_launch_curation_events (new_curation_record_id)
  where new_curation_record_id is not null;

create table private.catalog_launch_curation_heads (
  product_id                          uuid not null references public.products (id) on delete restrict,
  territory                           text not null check (territory = 'US'),
  curation_record_id                  uuid not null
    references private.catalog_launch_curation_records (id) on delete restrict,
  campaign_id                         uuid not null
    references private.catalog_launch_curation_campaigns (id) on delete restrict,
  generation                          integer not null check (generation > 0),
  state                               text not null check (state in ('active', 'retired')),
  last_event_id                       uuid not null
    references private.catalog_launch_curation_events (id) on delete restrict,
  head_sha256                         text not null check (head_sha256 ~ '^[a-f0-9]{64}$'),
  activated_at                        timestamptz not null,
  retired_at                          timestamptz,
  primary key (product_id, territory, campaign_id),
  check (
    (state = 'active' and retired_at is null)
    or (state = 'retired' and retired_at is not null and retired_at >= activated_at)
  ),
  check (
    head_sha256 = private.catalog_launch_curation_head_sha256(
      product_id, territory, curation_record_id, campaign_id,
      generation, state, last_event_id
    )
  )
);

create or replace function private.catalog_launch_curation_campaign_release_head_sha256(
  p_territory text,
  p_campaign_id uuid,
  p_generation integer,
  p_state text,
  p_last_event_id uuid
)
returns text
language sql
immutable
security definer
set search_path = ''
as $$
  select private.catalog_import_sha256_text(
    private.catalog_import_canonical_json(
      pg_catalog.jsonb_build_object(
        'contractId', 'catalog-launch-curation-campaign-release-head-v1',
        'territory', p_territory,
        'campaignId', p_campaign_id,
        'generation', p_generation,
        'state', p_state,
        'lastEventId', p_last_event_id
      )
    )
  )
$$;

create or replace function private.catalog_launch_curation_campaign_release_receipt_sha256(
  p_event_id uuid,
  p_territory text,
  p_event_type text,
  p_previous_campaign_id uuid,
  p_new_campaign_id uuid,
  p_generation integer,
  p_operation_key text,
  p_request_sha256 text,
  p_actor text,
  p_reason text,
  p_campaign_sha256 text,
  p_campaign_authority_sha256 text,
  p_curation_outcome_reviewer_signature_set_sha256 text,
  p_cat02_membership_proof_sha256 text,
  p_cat02_database_observation_sha256 text,
  p_cat02_verifier_signature_set_sha256 text,
  p_cat02_production_integrity_set_sha256 text,
  p_record_set_sha256 text,
  p_served_state_mutation_root_set_sha256 text,
  p_authorization_set_sha256 text,
  p_head_before_sha256 text
)
returns text
language sql
immutable
security definer
set search_path = ''
as $$
  select private.catalog_import_sha256_text(
    private.catalog_import_canonical_json(
      pg_catalog.jsonb_build_object(
        'contractId', 'catalog-launch-curation-campaign-release-receipt-v1',
        'eventId', p_event_id,
        'territory', p_territory,
        'eventType', p_event_type,
        'previousCampaignId', p_previous_campaign_id,
        'newCampaignId', p_new_campaign_id,
        'generation', p_generation,
        'operationKey', p_operation_key,
        'requestSha256', p_request_sha256,
        'actor', p_actor,
        'reasonCode', p_reason,
        'campaignSha256', p_campaign_sha256,
        'campaignAuthoritySha256', p_campaign_authority_sha256,
        'curationOutcomeReviewerSignatureSetSha256',
          p_curation_outcome_reviewer_signature_set_sha256,
        'cat02MembershipProofSha256', p_cat02_membership_proof_sha256,
        'cat02DatabaseObservationSha256',
          p_cat02_database_observation_sha256,
        'cat02VerifierSignatureSetSha256',
          p_cat02_verifier_signature_set_sha256,
        'cat02ProductionIntegritySetSha256',
          p_cat02_production_integrity_set_sha256,
        'recordSetSha256', p_record_set_sha256,
        'servedStateMutationRootSetSha256',
          p_served_state_mutation_root_set_sha256,
        'authorizationSetSha256', p_authorization_set_sha256,
        'headBeforeSha256', p_head_before_sha256
      )
    )
  )
$$;

revoke all on function private.catalog_launch_curation_campaign_release_head_sha256(
  text, uuid, integer, text, uuid
) from public, anon, authenticated, service_role;
revoke all on function private.catalog_launch_curation_campaign_release_receipt_sha256(
  uuid, text, text, uuid, uuid, integer, text, text, text, text,
  text, text, text, text, text, text, text, text, text, text, text
) from public, anon, authenticated, service_role;

create table private.catalog_launch_curation_campaign_release_events (
  id                                  uuid primary key default gen_random_uuid(),
  territory                           text not null check (territory = 'US'),
  event_type                          text not null
    check (event_type in ('release', 'supersession', 'retirement')),
  previous_campaign_id                uuid
    references private.catalog_launch_curation_campaigns (id) on delete restrict,
  new_campaign_id                     uuid
    references private.catalog_launch_curation_campaigns (id) on delete restrict,
  generation                          integer not null check (generation > 0),
  operation_key                       text not null unique
    check (operation_key ~ '^[A-Za-z0-9][A-Za-z0-9._:/-]{7,199}$'),
  request_sha256                      text not null check (request_sha256 ~ '^[a-f0-9]{64}$'),
  actor                               text not null
    check (actor ~ '^[A-Za-z0-9][A-Za-z0-9._@:+/-]{2,199}$'),
  reason                              text not null
    check (reason = pg_catalog.btrim(reason) and pg_catalog.length(reason) between 8 and 100),
  campaign_sha256                     text not null check (campaign_sha256 ~ '^[a-f0-9]{64}$'),
  campaign_authority_sha256           text not null check (campaign_authority_sha256 ~ '^[a-f0-9]{64}$'),
  curation_outcome_reviewer_signature_set_sha256 text not null
    check (curation_outcome_reviewer_signature_set_sha256 ~ '^[a-f0-9]{64}$'),
  cat02_membership_proof_sha256       text not null
    check (cat02_membership_proof_sha256 ~ '^[a-f0-9]{64}$'),
  cat02_database_observation_sha256   text not null
    check (cat02_database_observation_sha256 ~ '^[a-f0-9]{64}$'),
  cat02_verifier_signature_set_sha256 text not null
    check (cat02_verifier_signature_set_sha256 ~ '^[a-f0-9]{64}$'),
  cat02_production_integrity_set_sha256 text not null
    check (cat02_production_integrity_set_sha256 ~ '^[a-f0-9]{64}$'),
  record_set_sha256                   text not null check (record_set_sha256 ~ '^[a-f0-9]{64}$'),
  served_state_mutation_root_set_sha256 text not null
    check (served_state_mutation_root_set_sha256 ~ '^[a-f0-9]{64}$'),
  authorization_set_sha256            text not null check (authorization_set_sha256 ~ '^[a-f0-9]{64}$'),
  head_before_sha256                  text check (head_before_sha256 is null or head_before_sha256 ~ '^[a-f0-9]{64}$'),
  event_receipt_sha256                text not null check (event_receipt_sha256 ~ '^[a-f0-9]{64}$'),
  head_after_sha256                   text not null check (head_after_sha256 ~ '^[a-f0-9]{64}$'),
  created_at                          timestamptz not null default now(),
  check (
    (event_type = 'release' and previous_campaign_id is null and new_campaign_id is not null)
    or (event_type = 'supersession' and previous_campaign_id is not null
      and new_campaign_id is not null and previous_campaign_id <> new_campaign_id)
    or (event_type = 'retirement' and previous_campaign_id is not null and new_campaign_id is null)
  ),
  check (
    event_receipt_sha256 = private.catalog_launch_curation_campaign_release_receipt_sha256(
      id, territory, event_type, previous_campaign_id, new_campaign_id,
      generation, operation_key, request_sha256, actor, reason,
      campaign_sha256, campaign_authority_sha256,
      curation_outcome_reviewer_signature_set_sha256,
      cat02_membership_proof_sha256,
      cat02_database_observation_sha256,
      cat02_verifier_signature_set_sha256,
      cat02_production_integrity_set_sha256,
      record_set_sha256,
      served_state_mutation_root_set_sha256,
      authorization_set_sha256, head_before_sha256
    )
  )
);

create unique index catalog_launch_curation_campaign_release_uidx
  on private.catalog_launch_curation_campaign_release_events (new_campaign_id)
  where new_campaign_id is not null;

create table private.catalog_launch_curation_campaign_release_heads (
  territory                           text primary key check (territory = 'US'),
  campaign_id                         uuid not null
    references private.catalog_launch_curation_campaigns (id) on delete restrict,
  generation                          integer not null check (generation > 0),
  state                               text not null check (state in ('active', 'retired')),
  last_event_id                       uuid not null
    references private.catalog_launch_curation_campaign_release_events (id) on delete restrict,
  head_sha256                         text not null check (head_sha256 ~ '^[a-f0-9]{64}$'),
  activated_at                        timestamptz not null,
  retired_at                          timestamptz,
  check (
    (state = 'active' and retired_at is null)
    or (state = 'retired' and retired_at is not null and retired_at >= activated_at)
  ),
  check (
    head_sha256 = private.catalog_launch_curation_campaign_release_head_sha256(
      territory, campaign_id, generation, state, last_event_id
    )
  )
);

comment on table private.catalog_launch_curation_campaigns is
  'Immutable CAT-03 campaign authority. Beta input is retained only as a privacy-minimized demand-corpus hash and never as product facts.';
comment on table private.catalog_launch_curation_records is
  'Immutable exact product/import/staged/dependency/reviewer curation authority.';
comment on table private.catalog_launch_curation_product_mutations is
  'Append-only per-product served-state mutation chain independent of curation-record existence; exact restoration advances the root.';
comment on table private.catalog_launch_curation_events is
  'Append-only activation, supersession, and retirement receipts.';
comment on table private.catalog_launch_curation_heads is
  'Guarded staged product authorization projection scoped to an exact campaign; it cannot serve before the campaign release flip.';
comment on table private.catalog_launch_curation_campaign_release_events is
  'Append-only receipts for the single atomic launch-campaign release, supersession, and retirement boundary.';
comment on table private.catalog_launch_curation_campaign_release_heads is
  'Guarded one-row US release projection; serving requires this exact active campaign.';

-- Exact product fields and every guidance-bearing dependency are hashed
-- independently.  The snapshots are private computation surfaces; only their
-- SHA-256 values are retained in the sealed curation record.
create or replace function private.catalog_launch_curation_product_snapshot(
  p_product_id uuid
)
returns jsonb
language sql
stable
security definer
set search_path = ''
set timezone = 'UTC'
as $$
  select pg_catalog.jsonb_build_object(
    'contractId', 'catalog-launch-curation-product-snapshot-v2',
    -- Full-row projection deliberately seals every present and future product
    -- column returned through authenticated RLS or a bounded serving RPC.
    'productRow', pg_catalog.to_jsonb(product)
  )
  from public.products as product
  where product.id = p_product_id
$$;

create or replace function private.catalog_launch_curation_product_snapshot_sha256(
  p_product_id uuid
)
returns text
language sql
stable
security definer
set search_path = ''
as $$
  select private.catalog_import_sha256_text(
    private.catalog_import_canonical_json(
      private.catalog_launch_curation_product_snapshot(p_product_id)
    )
  )
$$;

create or replace function private.catalog_launch_curation_dependency_snapshot(
  p_product_id uuid,
  p_ingredient_list_id uuid
)
returns jsonb
language sql
stable
security definer
set search_path = ''
set timezone = 'UTC'
as $$
  select pg_catalog.jsonb_build_object(
    'contractId', 'catalog-launch-curation-dependency-snapshot-v2',
    'source', (
      select pg_catalog.jsonb_build_object(
        'id', source.id,
        'sourceKey', source.source_key,
        'productionApproved', source.production_approved,
        'reviewStatus', source.review_status,
        'reviewedBy', source.reviewed_by,
        'reviewedAtUtc', case when source.reviewed_at is null then null else
          pg_catalog.to_char(
            source.reviewed_at at time zone 'UTC',
            'YYYY-MM-DD"T"HH24:MI:SS.US"Z"'
          )
        end,
        'requiresAttribution', source.requires_attribution,
        'attributionText', source.attribution_text,
        'attributionUrl', source.attribution_url
      )
      from public.products as product
      join public.catalog_sources as source on source.id = product.source_id
      where product.id = p_product_id
    ),
    'importBatch', (
      select pg_catalog.jsonb_build_object(
        'id', batch.id,
        'sourceId', batch.source_id,
        'status', batch.status,
        'artifactKind', batch.artifact_kind,
        'territory', batch.territory,
        'snapshotDate', batch.snapshot_date,
        'manifestSha256', batch.manifest_sha256,
        'sourcePolicySha256', batch.source_policy_sha256,
        'sourceApprovalSha256', batch.source_approval_sha256,
        'transformSha256', batch.transform_sha256,
        'transformedPayloadSha256', batch.transformed_payload_sha256,
        'qaReportSha256', batch.qa_report_sha256,
        'qaBlockerCount', batch.qa_blocker_count,
        'qaWarningCount', batch.qa_warning_count,
        'recordsSha256', batch.records_sha256,
        'candidatesSha256', batch.candidates_sha256,
        'batchEvidenceSha256', private.catalog_import_batch_evidence_sha256(batch.id)
      )
      from public.products as product
      join public.catalog_import_batches as batch on batch.id = product.import_batch_id
      where product.id = p_product_id
    ),
    'stagedRecord', (
      select pg_catalog.jsonb_build_object(
        'id', staged.id,
        'batchId', staged.batch_id,
        'recordOrdinal', staged.record_ordinal,
        'recordKind', staged.record_kind,
        'naturalKey', staged.natural_key,
        'recordSha256', staged.record_sha256,
        'disposition', staged.disposition,
        'sealedAtUtc', case when staged.sealed_at is null then null else
          pg_catalog.to_char(
            staged.sealed_at at time zone 'UTC',
            'YYYY-MM-DD"T"HH24:MI:SS.US"Z"'
          )
        end
      )
      from public.products as product
      join private.catalog_import_staged_records as staged
        on staged.id = product.import_staged_record_id
      where product.id = p_product_id
    ),
    'brand', (
      select pg_catalog.jsonb_build_object(
        'id', brand.id,
        'normalizedName', brand.normalized_name,
        'displayName', brand.display_name,
        'sourceId', brand.source_id,
        'reviewStatus', brand.review_status
      )
      from public.products as product
      join public.brands as brand on brand.id = product.brand_id
      where product.id = p_product_id
    ),
    'category', (
      select pg_catalog.jsonb_build_object(
        'id', category.id,
        'label', category.label,
        'routineRole', category.routine_role,
        'isSunscreen', category.is_sunscreen,
        'isOtcDrugCandidate', category.is_otc_drug_candidate,
        'reviewStatus', category.review_status
      )
      from public.products as product
      join public.product_categories as category on category.id = product.category_id
      where product.id = p_product_id
    ),
    'barcodes', coalesce((
      select pg_catalog.jsonb_agg(
        pg_catalog.jsonb_build_object(
          'barcode', mapping.barcode,
          'productId', mapping.product_id,
          'sourceId', mapping.source_id,
          'confidence', mapping.confidence,
          'reviewStatus', mapping.review_status,
          'importBatchId', mapping.import_batch_id,
          'importStagedRecordId', mapping.import_staged_record_id,
          'importRecordOrdinal', mapping.import_record_ordinal,
          'importRecordSha256', mapping.import_record_sha256,
          'importProjectionStatus', mapping.import_projection_status
        ) order by mapping.barcode collate pg_catalog."C"
      )
      from public.product_barcodes as mapping
      where mapping.product_id = p_product_id
    ), '[]'::jsonb),
    'ingredientLists', coalesce((
      select pg_catalog.jsonb_agg(
        pg_catalog.jsonb_build_object(
          'id', ingredient_list.id,
          'productId', ingredient_list.product_id,
          'sourceId', ingredient_list.source_id,
          'rawTextSha256', private.catalog_import_sha256_text(ingredient_list.raw_text),
          'locale', ingredient_list.locale,
          'parseStatus', ingredient_list.parse_status,
          'parseConfidence', ingredient_list.parse_confidence,
          'parserVersion', ingredient_list.parser_version,
          'tokenCount', ingredient_list.token_count,
          'unmatchedCount', ingredient_list.unmatched_count,
          'sourceSnapshotDate', ingredient_list.source_snapshot_date,
          'reviewStatus', ingredient_list.review_status,
          'importBatchId', ingredient_list.import_batch_id,
          'importStagedRecordId', ingredient_list.import_staged_record_id,
          'importRecordOrdinal', ingredient_list.import_record_ordinal,
          'importRecordSha256', ingredient_list.import_record_sha256,
          'importProjectionStatus', ingredient_list.import_projection_status
        ) order by ingredient_list.id
      )
      from public.product_ingredient_lists as ingredient_list
      where ingredient_list.product_id = p_product_id
    ), '[]'::jsonb),
    'tokens', coalesce((
      select pg_catalog.jsonb_agg(
        pg_catalog.jsonb_build_object(
          'id', token.id,
          'position', token.position,
          'ingredientId', token.ingredient_id,
          'rawTokenSha256', private.catalog_import_sha256_text(token.raw_token),
          'normalizedTokenSha256', private.catalog_import_sha256_text(token.normalized_token),
          'section', token.section,
          'matchType', token.match_type,
          'matchConfidence', token.match_confidence,
          'isUnmatched', token.is_unmatched,
          'tags', pg_catalog.to_jsonb(token.tags),
          'concentrationBand', token.concentration_band,
          'sourceId', token.source_id
        ) order by token.position, token.id
      )
      from public.product_ingredient_tokens as token
      where token.product_id = p_product_id
        and token.ingredient_list_id = p_ingredient_list_id
    ), '[]'::jsonb),
    'ingredientLinks', coalesce((
      select pg_catalog.jsonb_agg(
        pg_catalog.jsonb_build_object(
          'productId', link.product_id,
          'ingredientId', link.ingredient_id,
          'ingredientListId', link.ingredient_list_id,
          'position', link.position,
          'rawTokenSha256', private.catalog_import_sha256_text(link.raw_token),
          'normalizedTokenSha256', private.catalog_import_sha256_text(link.normalized_token),
          'matchType', link.match_type,
          'matchConfidence', link.match_confidence,
          'isUnmatched', link.is_unmatched,
          'parserVersion', link.parser_version,
          'sourceId', link.source_id
        ) order by link.position, link.ingredient_id
      )
      from public.product_ingredients as link
      where link.product_id = p_product_id
        and link.ingredient_list_id = p_ingredient_list_id
    ), '[]'::jsonb),
    'mappedIngredients', coalesce((
      select pg_catalog.jsonb_agg(
        pg_catalog.jsonb_build_object(
          'id', ingredient.id,
          'inciName', ingredient.inci_name,
          'normalizedInciName', ingredient.normalized_inci_name,
          'source', ingredient.source,
          'sourceId', ingredient.source_id,
          'sourceSnapshotDate', ingredient.source_snapshot_date,
          'sourceRef', coalesce(ingredient.cosing_ref, ingredient.source_url),
          'reviewStatus', ingredient.review_status,
          'ingredientQualityScore', ingredient.ingredient_quality_score,
          'importBatchId', ingredient.import_batch_id,
          'importStagedRecordId', ingredient.import_staged_record_id,
          'importRecordSha256', ingredient.import_record_sha256,
          'importProjectionStatus', ingredient.import_projection_status
        ) order by ingredient.id
      )
      from public.ingredients as ingredient
      where ingredient.id in (
        select token.ingredient_id
        from public.product_ingredient_tokens as token
        where token.product_id = p_product_id
          and token.ingredient_list_id = p_ingredient_list_id
          and token.ingredient_id is not null
      )
    ), '[]'::jsonb),
    'activeBands', coalesce((
      select pg_catalog.jsonb_agg(
        pg_catalog.jsonb_build_object(
          'id', band.id,
          'ingredientId', band.ingredient_id,
          'tag', band.tag,
          'band', band.band,
          'exactPercent', band.exact_percent,
          'sourceBasis', band.source_basis,
          'evidenceNoteSha256', case when band.evidence_note is null then null
            else private.catalog_import_sha256_text(band.evidence_note)
          end,
          'sourceId', band.source_id,
          'reviewStatus', band.review_status
        ) order by band.id
      )
      from public.product_active_bands as band
      where band.product_id = p_product_id
    ), '[]'::jsonb),
    'freshness', coalesce((
      select pg_catalog.jsonb_agg(
        pg_catalog.jsonb_build_object(
          'id', freshness.id,
          'paoMonths', freshness.pao_months,
          'paoSource', freshness.pao_source,
          'expiryDate', freshness.expiry_date,
          'expirySource', freshness.expiry_source,
          'region', freshness.region,
          'sourceId', freshness.source_id,
          'reviewedBy', freshness.reviewed_by,
          'reviewStatus', freshness.review_status
        ) order by freshness.id
      )
      from public.product_pao_expiry as freshness
      where freshness.product_id = p_product_id
    ), '[]'::jsonb),
    -- The full-row sets below are the fail-closed publication seal.  Manual
    -- projections above remain human-auditable, while to_jsonb(row) makes a
    -- newly added client-readable column impossible to omit accidentally.
    -- UTC is fixed at the function boundary so timestamptz JSON is stable.
    'fullProductSourceRow', (
      select pg_catalog.to_jsonb(source)
      from public.products as product
      join public.catalog_sources as source on source.id = product.source_id
      where product.id = p_product_id
    ),
    'fullReferencedSourceRows', coalesce((
      select pg_catalog.jsonb_agg(
        pg_catalog.to_jsonb(source) order by source.id
      )
      from public.catalog_sources as source
      where source.id in (
        select product.source_id
        from public.products as product
        where product.id = p_product_id
        union
        select brand.source_id
        from public.products as product
        join public.brands as brand on brand.id = product.brand_id
        where product.id = p_product_id
        union
        select mapping.source_id
        from public.product_barcodes as mapping
        where mapping.product_id = p_product_id
        union
        select ingredient_list.source_id
        from public.product_ingredient_lists as ingredient_list
        where ingredient_list.product_id = p_product_id
        union
        select token.source_id
        from public.product_ingredient_tokens as token
        where token.product_id = p_product_id
        union
        select link.source_id
        from public.product_ingredients as link
        where link.product_id = p_product_id
        union
        select ingredient.source_id
        from public.ingredients as ingredient
        where ingredient.id in (
          select token.ingredient_id
          from public.product_ingredient_tokens as token
          where token.product_id = p_product_id
            and token.ingredient_id is not null
          union
          select link.ingredient_id
          from public.product_ingredients as link
          where link.product_id = p_product_id
          union
          select band.ingredient_id
          from public.product_active_bands as band
          where band.product_id = p_product_id
            and band.ingredient_id is not null
        )
        union
        select synonym.source_id
        from public.ingredient_synonyms as synonym
        where synonym.ingredient_id in (
          select token.ingredient_id
          from public.product_ingredient_tokens as token
          where token.product_id = p_product_id
            and token.ingredient_id is not null
          union
          select link.ingredient_id
          from public.product_ingredients as link
          where link.product_id = p_product_id
          union
          select band.ingredient_id
          from public.product_active_bands as band
          where band.product_id = p_product_id
            and band.ingredient_id is not null
        )
        union
        select assignment.source_id
        from public.ingredient_tag_assignments as assignment
        where assignment.ingredient_id in (
          select token.ingredient_id
          from public.product_ingredient_tokens as token
          where token.product_id = p_product_id
            and token.ingredient_id is not null
          union
          select link.ingredient_id
          from public.product_ingredients as link
          where link.product_id = p_product_id
          union
          select band.ingredient_id
          from public.product_active_bands as band
          where band.product_id = p_product_id
            and band.ingredient_id is not null
        )
        union
        select band.source_id
        from public.product_active_bands as band
        where band.product_id = p_product_id
        union
        select freshness.source_id
        from public.product_pao_expiry as freshness
        where freshness.product_id = p_product_id
      )
    ), '[]'::jsonb),
    'fullImportBatchRow', (
      select pg_catalog.to_jsonb(batch)
      from public.products as product
      join public.catalog_import_batches as batch
        on batch.id = product.import_batch_id
      where product.id = p_product_id
    ),
    'fullStagedRecordRow', (
      select pg_catalog.to_jsonb(staged)
      from public.products as product
      join private.catalog_import_staged_records as staged
        on staged.id = product.import_staged_record_id
      where product.id = p_product_id
    ),
    'fullBrandRow', (
      select pg_catalog.to_jsonb(brand)
      from public.products as product
      join public.brands as brand on brand.id = product.brand_id
      where product.id = p_product_id
    ),
    'fullCategoryRow', (
      select pg_catalog.to_jsonb(category)
      from public.products as product
      join public.product_categories as category
        on category.id = product.category_id
      where product.id = p_product_id
    ),
    'fullBarcodeRows', coalesce((
      select pg_catalog.jsonb_agg(
        pg_catalog.to_jsonb(mapping)
        order by mapping.barcode collate pg_catalog."C"
      )
      from public.product_barcodes as mapping
      where mapping.product_id = p_product_id
    ), '[]'::jsonb),
    'fullIngredientListRows', coalesce((
      select pg_catalog.jsonb_agg(
        pg_catalog.to_jsonb(ingredient_list) order by ingredient_list.id
      )
      from public.product_ingredient_lists as ingredient_list
      where ingredient_list.product_id = p_product_id
    ), '[]'::jsonb),
    'fullTokenRows', coalesce((
      select pg_catalog.jsonb_agg(
        pg_catalog.to_jsonb(token)
        order by token.ingredient_list_id, token.position, token.id
      )
      from public.product_ingredient_tokens as token
      where token.product_id = p_product_id
    ), '[]'::jsonb),
    'fullIngredientLinkRows', coalesce((
      select pg_catalog.jsonb_agg(
        pg_catalog.to_jsonb(link)
        order by link.ingredient_list_id, link.position, link.ingredient_id
      )
      from public.product_ingredients as link
      where link.product_id = p_product_id
    ), '[]'::jsonb),
    'fullMappedIngredientRows', coalesce((
      select pg_catalog.jsonb_agg(
        pg_catalog.to_jsonb(ingredient) order by ingredient.id
      )
      from public.ingredients as ingredient
      where ingredient.id in (
        select token.ingredient_id
        from public.product_ingredient_tokens as token
        where token.product_id = p_product_id
          and token.ingredient_id is not null
        union
        select link.ingredient_id
        from public.product_ingredients as link
        where link.product_id = p_product_id
        union
        select band.ingredient_id
        from public.product_active_bands as band
        where band.product_id = p_product_id
          and band.ingredient_id is not null
      )
    ), '[]'::jsonb),
    'fullIngredientSynonymRows', coalesce((
      select pg_catalog.jsonb_agg(
        pg_catalog.to_jsonb(synonym)
        order by synonym.ingredient_id, synonym.id
      )
      from public.ingredient_synonyms as synonym
      where synonym.ingredient_id in (
        select token.ingredient_id
        from public.product_ingredient_tokens as token
        where token.product_id = p_product_id
          and token.ingredient_id is not null
        union
        select link.ingredient_id
        from public.product_ingredients as link
        where link.product_id = p_product_id
        union
        select band.ingredient_id
        from public.product_active_bands as band
        where band.product_id = p_product_id
          and band.ingredient_id is not null
      )
    ), '[]'::jsonb),
    'fullIngredientTagAssignmentRows', coalesce((
      select pg_catalog.jsonb_agg(
        pg_catalog.to_jsonb(assignment)
        order by assignment.ingredient_id,
          assignment.tag collate pg_catalog."C",
          coalesce(assignment.subflag, '') collate pg_catalog."C",
          assignment.id
      )
      from public.ingredient_tag_assignments as assignment
      where assignment.ingredient_id in (
        select token.ingredient_id
        from public.product_ingredient_tokens as token
        where token.product_id = p_product_id
          and token.ingredient_id is not null
        union
        select link.ingredient_id
        from public.product_ingredients as link
        where link.product_id = p_product_id
        union
        select band.ingredient_id
        from public.product_active_bands as band
        where band.product_id = p_product_id
          and band.ingredient_id is not null
      )
    ), '[]'::jsonb),
    'fullIngredientTagDefinitionRows', coalesce((
      select pg_catalog.jsonb_agg(
        pg_catalog.to_jsonb(definition)
        order by definition.tag collate pg_catalog."C"
      )
      from public.ingredient_tag_definitions as definition
      where definition.tag in (
        select assignment.tag
        from public.ingredient_tag_assignments as assignment
        where assignment.ingredient_id in (
          select token.ingredient_id
          from public.product_ingredient_tokens as token
          where token.product_id = p_product_id
            and token.ingredient_id is not null
          union
          select link.ingredient_id
          from public.product_ingredients as link
          where link.product_id = p_product_id
          union
          select band.ingredient_id
          from public.product_active_bands as band
          where band.product_id = p_product_id
            and band.ingredient_id is not null
        )
        union
        select band.tag
        from public.product_active_bands as band
        where band.product_id = p_product_id
          and band.tag is not null
        union
        select referenced_tag.tag
        from public.product_ingredient_tokens as token
        cross join lateral pg_catalog.unnest(token.tags)
          as referenced_tag(tag)
        where token.product_id = p_product_id
      )
    ), '[]'::jsonb),
    'fullActiveBandRows', coalesce((
      select pg_catalog.jsonb_agg(
        pg_catalog.to_jsonb(band) order by band.id
      )
      from public.product_active_bands as band
      where band.product_id = p_product_id
    ), '[]'::jsonb),
    'fullPaoExpiryRows', coalesce((
      select pg_catalog.jsonb_agg(
        pg_catalog.to_jsonb(freshness) order by freshness.id
      )
      from public.product_pao_expiry as freshness
      where freshness.product_id = p_product_id
    ), '[]'::jsonb),
    'operatorHoldRows', coalesce((
      select pg_catalog.jsonb_agg(
        private.catalog_launch_correction_serving_projection(
          pg_catalog.to_jsonb(correction)
        ) order by correction.id
      )
      from public.catalog_corrections as correction
      where correction.product_id = p_product_id
        and correction.status in ('triaged', 'accepted')
        and correction.operator_reviewed_at is not null
        and correction.operator_reviewed_at <= pg_catalog.now()
        and nullif(pg_catalog.btrim(correction.operator_reviewed_by), '')
          is not null
        and nullif(pg_catalog.btrim(correction.operator_review_note), '')
          is not null
    ), '[]'::jsonb),
    'operatorHoldCount', (
      select count(*)
      from public.catalog_corrections as correction
      where correction.product_id = p_product_id
        and correction.status in ('triaged', 'accepted')
        and correction.operator_reviewed_at is not null
        and correction.operator_reviewed_at <= pg_catalog.now()
        and nullif(pg_catalog.btrim(correction.operator_reviewed_by), '') is not null
        and nullif(pg_catalog.btrim(correction.operator_review_note), '') is not null
    )
  )
$$;

create or replace function private.catalog_launch_curation_dependency_sha256(
  p_product_id uuid,
  p_ingredient_list_id uuid
)
returns text
language sql
stable
security definer
set search_path = ''
as $$
  select private.catalog_import_sha256_text(
    private.catalog_import_canonical_json(
      private.catalog_launch_curation_dependency_snapshot(
        p_product_id, p_ingredient_list_id
      )
    )
  )
$$;

revoke all on function private.catalog_launch_curation_product_snapshot(uuid)
  from public, anon, authenticated, service_role;
revoke all on function private.catalog_launch_curation_product_snapshot_sha256(uuid)
  from public, anon, authenticated, service_role;
revoke all on function private.catalog_launch_curation_dependency_snapshot(uuid, uuid)
  from public, anon, authenticated, service_role;
revoke all on function private.catalog_launch_curation_dependency_sha256(uuid, uuid)
  from public, anon, authenticated, service_role;

-- Every reviewed row, including a rejected/withheld row, must still bind an
-- exact campaign, mapping, CAT-02 membership set, immutable database snapshot,
-- and review/signature authority.  Positive quality/serving gates are applied
-- separately below only to approve-activation rows.
create or replace function private.catalog_launch_curation_record_is_structurally_valid(
  p_curation_record_id uuid
)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce((
    select
      campaign.territory = 'US'
      and campaign.review_valid_until > pg_catalog.now()
      and record.served_state_mutation_root_sha256 =
        private.catalog_launch_current_served_state_mutation_root_sha256(
          record.product_id
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
      and campaign.eligibility_policy_sha256 =
        private.catalog_launch_curation_target_policy_sha256(
          campaign.required_quality_grade,
          campaign.minimum_data_quality_score,
          campaign.minimum_ingredient_quality_score,
          campaign.minimum_barcode_quality_score,
          campaign.minimum_category_quality_score,
          campaign.minimum_parse_confidence,
          campaign.minimum_token_match_confidence,
          campaign.minimum_mapped_ingredient_count
        )
      and campaign.campaign_sha256 =
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
        )
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
          record.served_state_mutation_root_sha256,
          record.demand_priority_rank,
          record.demand_priority_commitment_sha256,
          record.regulatory_classification,
          record.regulatory_review_evidence_sha256,
          record.regulatory_reviewer_ids,
          record.curated_by
        )
      and record.reviewed_record_mapping_sha256 =
        private.catalog_launch_curation_reviewed_record_mapping_sha256(
          campaign.release_id,
          record.product_record_sha256,
          record.served_state_mutation_root_sha256,
          record.offline_base_sealed_record_sha256,
          record.database_base_record_sha256
        )
      and record.curation_record_sha256 =
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
        )
      and record.manifest_entry_sha256 =
        record.offline_base_sealed_record_sha256
      and record.signed_target_policy_sha256 =
        campaign.signed_target_policy_sha256
      and record.eligibility_policy_sha256 = campaign.eligibility_policy_sha256
      and record.cat02_membership_proof_sha256 =
        campaign.cat02_membership_proof_sha256
      and record.cat02_database_observation_sha256 =
        campaign.cat02_database_observation_sha256
      and record.cat02_verifier_signature_set_sha256 =
        campaign.cat02_verifier_signature_set_sha256
      and record.cat02_production_integrity_set_sha256 =
        campaign.cat02_production_integrity_set_sha256
      and record.curation_outcome_reviewer_signature_set_sha256 =
        campaign.curation_outcome_reviewer_signature_set_sha256
      and record.cat02_stage_record_sha256 = record.product_record_sha256
      and record.cat02_membership_readback_sha256 =
        private.catalog_launch_curation_membership_readback_sha256(
          record.product_record_sha256,
          record.dependency_memberships
        )
      and private.catalog_launch_curation_record_memberships_are_valid(record.id)
      and (
        (record.activation_decision = 'withhold_activation'
          and record.activation_planned_at is null
          and record.database_activation_request_sha256 is null
          and record.activation_signature_sha256 is null)
        or (record.activation_decision = 'approve_activation'
          and record.activation_planned_at is not null
          and record.database_activation_request_sha256 =
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
              'cat03.activate.' || campaign.release_id || '.'
                || record.product_record_sha256,
              'initial_launch_catalog_activation',
              record.activation_planned_at
            )
          and record.activation_signature_sha256 is not null)
      )
      and batch.id = record.import_batch_id
      and batch.status = 'promoted'
      and batch.artifact_kind = 'production'
      and batch.territory = 'US'
      and batch.qa_blocker_count = 0
      and batch.qa_warning_count = 0
      and batch.source_approval_sha256 = record.source_approval_sha256
      and batch.qa_report_sha256 = record.source_qa_sha256
      and product.id = record.product_id
      and product.source_id = record.source_id
      and product.import_batch_id = record.import_batch_id
      and product.import_staged_record_id = record.import_staged_record_id
      and product.import_record_sha256 = record.product_record_sha256
      and product.import_record_ordinal = staged.record_ordinal
      and staged.id = record.import_staged_record_id
      and staged.batch_id = record.import_batch_id
      and staged.record_kind = 'product'
      and staged.disposition = 'accepted'
      and staged.sealed_at is not null
      and staged.record_sha256 = record.product_record_sha256
      and staged.record_sha256 = private.catalog_import_sha256_text(
        private.catalog_import_canonical_json(staged.normalized_payload)
      )
      and product.barcode = record.barcode
      and ingredient_list.id = record.ingredient_list_id
      and ingredient_list.product_id = record.product_id
      and record.product_snapshot_sha256 =
        private.catalog_launch_curation_product_snapshot_sha256(record.product_id)
      and record.dependency_sha256 =
        private.catalog_launch_curation_dependency_sha256(
          record.product_id,
          record.ingredient_list_id
        )
      and record.cat02_database_normalized_record_sha256 =
        private.catalog_launch_curation_membership_database_sha256(
          record.product_record_sha256,
          'barcode_identity',
          record.dependency_memberships -> 0 ->> 'dependencyEntitySha256',
          record.barcode,
          record.category_code,
          record.product_snapshot_sha256,
          record.dependency_sha256,
          record.regulatory_classification,
          record.regulatory_review_evidence_sha256,
          record.regulatory_reviewer_ids
        )
      and record.category_code = case
        when category.id = 'spf' then 'sunscreen'
        when category.id = 'benzoyl_peroxide' then 'acne_treatment'
        when category.id in ('moisturiser_tube', 'moisturiser_jar')
          then 'moisturizer'
        when category.id in ('cleanser', 'serum', 'toner', 'other')
          then category.id
        else 'other'
      end
      and (
        (record.regulatory_classification = 'cosmetic'
          and category.is_sunscreen is false
          and category.is_otc_drug_candidate is false
          and record.regulatory_review_evidence_sha256 is null)
        or (record.regulatory_classification in (
            'otc_drug', 'combination_cosmetic_drug'
          )
          and category.is_otc_drug_candidate is true
          and record.regulatory_review_evidence_sha256 ~ '^[a-f0-9]{64}$')
      )
      and pg_catalog.lower(record.regulatory_reviewer_ids[1])
        <> pg_catalog.lower(record.curated_by)
      and not (record.regulatory_reviewer_ids[1] = any(campaign.reviewer_ids))
      and record.regulatory_signature_set_sha256
        <> campaign.reviewer_signature_set_sha256
      and record.regulatory_signature_set_sha256
        <> record.reviewer_signature_set_sha256
      and record.activation_operator_id <> record.regulatory_reviewer_ids[1]
      and not (record.activation_operator_id = any(campaign.reviewer_ids))
      and pg_catalog.lower(record.activation_operator_id)
        <> pg_catalog.lower(record.curated_by)
    from private.catalog_launch_curation_records as record
    join private.catalog_launch_curation_campaigns as campaign
      on campaign.id = record.campaign_id
    join public.products as product on product.id = record.product_id
    join public.catalog_import_batches as batch on batch.id = record.import_batch_id
    join private.catalog_import_staged_records as staged
      on staged.id = record.import_staged_record_id
    join public.product_categories as category on category.id = product.category_id
    join public.product_ingredient_lists as ingredient_list
      on ingredient_list.id = record.ingredient_list_id
    where record.id = p_curation_record_id
  ), false)
$$;

revoke all on function private.catalog_launch_curation_record_is_structurally_valid(uuid)
  from public, anon, authenticated, service_role;

-- This predicate deliberately does not consult an active head.  It validates
-- an approved record against positive live serving state and is reused by
-- activation and by the final serving predicate without recursion.
create or replace function private.catalog_launch_curation_record_is_valid(
  p_curation_record_id uuid
)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce((
    select
      private.catalog_launch_curation_record_is_structurally_valid(record.id)
      and record.activation_decision = 'approve_activation'
      and record.activation_planned_at <= pg_catalog.now()
      and campaign.territory = 'US'
      and campaign.beta_evidence_contract_id = 'catalog-beta-shelf-corpus-v1'
      and campaign.eligibility_policy_sha256 =
        private.catalog_launch_curation_target_policy_sha256(
          campaign.required_quality_grade,
          campaign.minimum_data_quality_score,
          campaign.minimum_ingredient_quality_score,
          campaign.minimum_barcode_quality_score,
          campaign.minimum_category_quality_score,
          campaign.minimum_parse_confidence,
          campaign.minimum_token_match_confidence,
          campaign.minimum_mapped_ingredient_count
        )
      and campaign.campaign_sha256 = private.catalog_launch_curation_campaign_sha256(
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
      )
      and campaign.review_valid_until > pg_catalog.now()
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
        record.served_state_mutation_root_sha256,
        record.demand_priority_rank,
        record.demand_priority_commitment_sha256,
        record.regulatory_classification,
        record.regulatory_review_evidence_sha256,
        record.regulatory_reviewer_ids,
        record.curated_by
      )
      and record.reviewed_record_mapping_sha256 =
        private.catalog_launch_curation_reviewed_record_mapping_sha256(
          campaign.release_id,
          record.product_record_sha256,
          record.served_state_mutation_root_sha256,
          record.offline_base_sealed_record_sha256,
          record.database_base_record_sha256
        )
      and record.curation_record_sha256 = private.catalog_launch_curation_record_sha256(
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
      )
      and (
        (
          record.activation_decision = 'withhold_activation'
          and record.activation_planned_at is null
          and record.database_activation_request_sha256 is null
          and record.activation_signature_sha256 is null
        )
        or (
          record.activation_decision = 'approve_activation'
          and record.activation_planned_at is not null
          and record.database_activation_request_sha256 =
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
              'cat03.activate.' || campaign.release_id || '.' || record.product_record_sha256,
              'initial_launch_catalog_activation',
              record.activation_planned_at
            )
          and record.activation_signature_sha256 is not null
        )
      )
      and record.signed_target_policy_sha256 = campaign.signed_target_policy_sha256
      and record.eligibility_policy_sha256 = campaign.eligibility_policy_sha256
      and record.curation_outcome_reviewer_signature_set_sha256 =
        campaign.curation_outcome_reviewer_signature_set_sha256
      and batch.id = record.import_batch_id
      and batch.status = 'promoted'
      and batch.artifact_kind = 'production'
      and batch.territory = 'US'
      and batch.qa_blocker_count = 0
      and batch.qa_warning_count = 0
      and batch.source_approval_sha256 = record.source_approval_sha256
      and batch.qa_report_sha256 = record.source_qa_sha256
      and product.id = record.product_id
      and product.source_id = record.source_id
      and product.import_batch_id = record.import_batch_id
      and product.import_staged_record_id = record.import_staged_record_id
      and product.import_record_sha256 = record.product_record_sha256
      and product.import_record_ordinal = staged.record_ordinal
      and product.import_projection_status = 'active'
      and staged.id = record.import_staged_record_id
      and staged.batch_id = record.import_batch_id
      and staged.record_kind = 'product'
      and staged.disposition = 'accepted'
      and staged.sealed_at is not null
      and staged.record_sha256 = record.product_record_sha256
      and staged.record_sha256 = private.catalog_import_sha256_text(
        private.catalog_import_canonical_json(staged.normalized_payload)
      )
      and product.barcode = record.barcode
      and record.manifest_entry_sha256 = record.offline_base_sealed_record_sha256
      and product.region = 'US'
      and product.status = 'active'
      and product.review_status = 'reviewed'
      and product.last_reviewed_at is not null
      and product.last_reviewed_at <= pg_catalog.now()
      and product.quality_grade in ('verified', 'usable')
      and (
        campaign.required_quality_grade = 'usable'
        or product.quality_grade = 'verified'
      )
      and product.data_quality_score >= campaign.minimum_data_quality_score
      and product.ingredient_quality_score >= campaign.minimum_ingredient_quality_score
      and product.barcode_quality_score >= campaign.minimum_barcode_quality_score
      and product.category_quality_score >= campaign.minimum_category_quality_score
      and product.ingredient_parse_status = 'reviewed'
      and product.ingredient_parse_confidence >= campaign.minimum_parse_confidence
      and nullif(pg_catalog.btrim(product.parser_version), '') is not null
      and product.recommendation_eligible is true
      and product.unresolved_correction_count = 0
      and nullif(pg_catalog.btrim(product.source_ref), '') is not null
      and product.source_snapshot_date is not null
      and product.source_snapshot_date <=
        (pg_catalog.now() at time zone 'UTC')::date
      and source.id = record.source_id
      and source.source_key = product.source
      and private.catalog_source_is_production_approved(source.id)
      and brand.id = product.brand_id
      and brand.review_status = 'reviewed'
      and private.catalog_source_is_production_approved(brand.source_id)
      and brand.normalized_name = private.catalog_import_normalize_label(product.brand)
      and category.id = product.category_id
      and category.id = product.category
      and category.review_status = 'reviewed'
      and record.category_code = case
        when category.id = 'spf' then 'sunscreen'
        when category.id = 'benzoyl_peroxide' then 'acne_treatment'
        when category.id in ('moisturiser_tube', 'moisturiser_jar') then 'moisturizer'
        when category.id in ('cleanser', 'serum', 'toner', 'other') then category.id
        else 'other'
      end
      and (
        (
          record.regulatory_classification = 'cosmetic'
          and category.is_sunscreen is false
          and category.is_otc_drug_candidate is false
        )
        or (
          record.regulatory_classification = 'otc_drug'
          and category.is_otc_drug_candidate is true
        )
        or (
          record.regulatory_classification = 'combination_cosmetic_drug'
          and category.is_otc_drug_candidate is true
        )
      )
      and (
        (
          record.regulatory_classification = 'cosmetic'
          and record.regulatory_review_evidence_sha256 is null
        )
        or (
          record.regulatory_classification in ('otc_drug', 'combination_cosmetic_drug')
          and record.regulatory_review_evidence_sha256 ~ '^[a-f0-9]{64}$'
          and record.regulatory_review_evidence_sha256
            <> all(campaign.reviewer_evidence_sha256s)
          and record.regulatory_review_evidence_sha256
            <> all(record.reviewer_evidence_sha256s)
        )
      )
      and record.regulatory_signature_set_sha256 ~ '^[a-f0-9]{64}$'
      and pg_catalog.cardinality(record.regulatory_reviewer_ids) = 1
      and pg_catalog.lower(record.regulatory_reviewer_ids[1])
        <> pg_catalog.lower(record.curated_by)
      and not (
        record.regulatory_reviewer_ids[1] = any(campaign.reviewer_ids)
      )
      and record.regulatory_signature_set_sha256
        <> campaign.reviewer_signature_set_sha256
      and record.regulatory_signature_set_sha256
        <> record.reviewer_signature_set_sha256
      and record.activation_operator_id <> record.regulatory_reviewer_ids[1]
      and not (record.activation_operator_id = any(campaign.reviewer_ids))
      and pg_catalog.lower(record.activation_operator_id)
        <> pg_catalog.lower(record.curated_by)
      and (
        record.activation_decision = 'withhold_activation'
        or (
          record.database_activation_request_sha256
            is distinct from record.regulatory_review_evidence_sha256
          and record.database_activation_request_sha256
            <> all(campaign.reviewer_evidence_sha256s)
          and record.activation_signature_sha256
            <> record.regulatory_signature_set_sha256
          and record.activation_signature_sha256
            <> campaign.reviewer_signature_set_sha256
        )
      )
      and barcode_mapping.barcode = record.barcode
      and barcode_mapping.product_id = product.id
      and barcode_mapping.source_id = product.source_id
      and barcode_mapping.review_status = 'reviewed'
      and barcode_mapping.confidence = 1
      and barcode_mapping.import_batch_id = record.import_batch_id
      and barcode_mapping.import_staged_record_id = record.import_staged_record_id
      and barcode_mapping.import_record_ordinal = product.import_record_ordinal
      and barcode_mapping.import_record_sha256 = record.product_record_sha256
      and barcode_mapping.import_projection_status = 'active'
      and ingredient_list.id = record.ingredient_list_id
      and ingredient_list.product_id = product.id
      and ingredient_list.source_id = product.source_id
      and ingredient_list.review_status = 'reviewed'
      and ingredient_list.parse_status = 'reviewed'
      and ingredient_list.parse_confidence >= campaign.minimum_parse_confidence
      and nullif(pg_catalog.btrim(ingredient_list.parser_version), '') is not null
      and ingredient_list.parser_version = product.parser_version
      and ingredient_list.token_count >= campaign.minimum_mapped_ingredient_count
      and ingredient_list.unmatched_count = 0
      and ingredient_list.source_snapshot_date = product.source_snapshot_date
      and ingredient_list.import_batch_id = record.import_batch_id
      and ingredient_list.import_staged_record_id = record.import_staged_record_id
      and ingredient_list.import_record_ordinal = product.import_record_ordinal
      and ingredient_list.import_record_sha256 = record.product_record_sha256
      and ingredient_list.import_projection_status = 'active'
      and private.catalog_source_is_production_approved(ingredient_list.source_id)
      and record.product_snapshot_sha256
        = private.catalog_launch_curation_product_snapshot_sha256(product.id)
      and record.dependency_sha256
        = private.catalog_launch_curation_dependency_sha256(
          product.id, ingredient_list.id
        )
      and (
        select count(*)
        from public.product_ingredient_lists as all_lists
        where all_lists.product_id = product.id
          and all_lists.import_projection_status = 'active'
      ) = 1
      and (
        select count(*) = ingredient_list.token_count
          and count(distinct token.position) = ingredient_list.token_count
          and min(token.position) = 1
          and max(token.position) = ingredient_list.token_count
        from public.product_ingredient_tokens as token
        where token.product_id = product.id
          and token.ingredient_list_id = ingredient_list.id
      )
      and not exists (
        select 1
        from public.product_ingredient_tokens as token
        left join public.ingredients as ingredient on ingredient.id = token.ingredient_id
        where token.product_id = product.id
          and token.ingredient_list_id = ingredient_list.id
          and (
            token.ingredient_id is null
            or token.is_unmatched is true
            or token.match_type not in ('exact', 'synonym', 'manual')
            or token.match_confidence < campaign.minimum_token_match_confidence
            or token.source_id is null
            or private.catalog_source_is_production_approved(token.source_id) is not true
            or ingredient.id is null
            or ingredient.review_status <> 'reviewed'
            or ingredient.source_id is null
            or private.catalog_source_is_production_approved(ingredient.source_id) is not true
            or ingredient.source_snapshot_date is null
            or ingredient.source_snapshot_date >
              (pg_catalog.now() at time zone 'UTC')::date
            or nullif(pg_catalog.btrim(coalesce(ingredient.cosing_ref, ingredient.source_url)), '') is null
            or ingredient.import_batch_id is null
            or ingredient.import_staged_record_id is null
            or ingredient.import_record_ordinal is null
            or ingredient.import_record_sha256 is null
            or ingredient.import_projection_status <> 'active'
            or not exists (
              select 1
              from public.catalog_import_batches as ingredient_batch
              where ingredient_batch.id = ingredient.import_batch_id
                and ingredient_batch.source_id = ingredient.source_id
                and ingredient_batch.status = 'promoted'
                and ingredient_batch.artifact_kind = 'production'
                and ingredient_batch.territory = 'US'
                and ingredient_batch.qa_blocker_count = 0
                and ingredient_batch.qa_warning_count = 0
            )
            or not exists (
              select 1
              from private.catalog_import_staged_records as ingredient_stage
              where ingredient_stage.id = ingredient.import_staged_record_id
                and ingredient_stage.batch_id = ingredient.import_batch_id
                and ingredient_stage.record_ordinal =
                  ingredient.import_record_ordinal
                and ingredient_stage.record_kind = 'ingredient'
                and ingredient_stage.record_sha256 =
                  ingredient.import_record_sha256
                and ingredient_stage.disposition = 'accepted'
                and ingredient_stage.sealed_at is not null
                and ingredient_stage.record_sha256 =
                  private.catalog_import_sha256_text(
                    private.catalog_import_canonical_json(
                      ingredient_stage.normalized_payload
                    )
                  )
            )
            or not exists (
              select 1
              from public.product_ingredients as link
              where link.product_id = product.id
                and link.ingredient_list_id = ingredient_list.id
                and link.ingredient_id = token.ingredient_id
                and link.position = token.position
                and link.source_id = token.source_id
                and link.is_unmatched is false
                and link.match_type = token.match_type
                and link.match_confidence >= campaign.minimum_token_match_confidence
                and nullif(pg_catalog.btrim(link.parser_version), '') is not null
            )
          )
      )
      and not exists (
        select 1
        from public.product_ingredients as link
        where link.product_id = product.id
          and link.ingredient_list_id = ingredient_list.id
          and (
            link.is_unmatched is true
            or link.source_id is null
            or private.catalog_source_is_production_approved(link.source_id) is not true
            or not exists (
              select 1
              from public.product_ingredient_tokens as token
              where token.product_id = link.product_id
                and token.ingredient_list_id = link.ingredient_list_id
                and token.ingredient_id = link.ingredient_id
                and token.position = link.position
            )
          )
      )
      and not exists (
        select 1
        from public.product_active_bands as band
        where band.product_id = product.id
          and (
            band.review_status <> 'reviewed'
            or band.ingredient_id is null
            or band.source_id is null
            or band.source_basis = 'unknown'
            or nullif(pg_catalog.btrim(band.tag), '') is null
            or private.catalog_source_is_production_approved(band.source_id) is not true
            or not exists (
              select 1 from public.ingredients as ingredient
              where ingredient.id = band.ingredient_id
                and ingredient.review_status = 'reviewed'
                and private.catalog_source_is_production_approved(ingredient.source_id)
            )
          )
      )
      and not exists (
        select 1
        from public.product_pao_expiry as freshness
        where freshness.product_id = product.id
          and (
            freshness.review_status <> 'reviewed'
            or nullif(pg_catalog.btrim(freshness.reviewed_by), '') is null
            or freshness.region <> 'US'
            or freshness.source_id is null
            or private.catalog_source_is_production_approved(freshness.source_id) is not true
          )
      )
      and not exists (
        select 1
        from public.catalog_corrections as correction
        where correction.product_id = product.id
          and correction.status in ('triaged', 'accepted')
          and correction.operator_reviewed_at is not null
          and correction.operator_reviewed_at <= pg_catalog.now()
          and nullif(pg_catalog.btrim(correction.operator_reviewed_by), '') is not null
          and nullif(pg_catalog.btrim(correction.operator_review_note), '') is not null
      )
    from private.catalog_launch_curation_records as record
    join private.catalog_launch_curation_campaigns as campaign
      on campaign.id = record.campaign_id
    join public.products as product on product.id = record.product_id
    join public.catalog_import_batches as batch on batch.id = record.import_batch_id
    join private.catalog_import_staged_records as staged
      on staged.id = record.import_staged_record_id
    join public.catalog_sources as source on source.id = record.source_id
    join public.brands as brand on brand.id = product.brand_id
    join public.product_categories as category on category.id = product.category_id
    join public.product_barcodes as barcode_mapping on barcode_mapping.barcode = record.barcode
    join public.product_ingredient_lists as ingredient_list
      on ingredient_list.id = record.ingredient_list_id
    where record.id = p_curation_record_id
  ), false)
$$;

revoke all on function private.catalog_launch_curation_record_is_valid(uuid)
  from public, anon, authenticated, service_role;

create or replace function private.guard_catalog_launch_curation_immutable()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  raise exception 'CATALOG_LAUNCH_CURATION_LEDGER_IMMUTABLE' using errcode = '55000';
end;
$$;

create or replace function private.guard_catalog_launch_curation_campaign_insert()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if private.catalog_launch_curation_cat02_artifact_sets_are_live(
       new.cat02_artifact_sets,
       new.contributing_batch_ids
     ) is not true
     or not (new.import_batch_id = any(new.contributing_batch_ids))
     or not exists (
    select 1
    from public.catalog_import_batches as batch
    where batch.id = new.import_batch_id
      and batch.status = 'promoted'
      and batch.artifact_kind = 'production'
      and batch.territory = 'US'
      and batch.qa_blocker_count = 0
      and batch.qa_warning_count = 0
      and batch.records_sha256 = new.import_records_sha256
      and batch.candidates_sha256 = new.import_candidates_sha256
      and private.catalog_import_batch_evidence_sha256(batch.id)
        = new.import_batch_evidence_sha256
      and private.catalog_source_is_production_approved(batch.source_id)
  ) then
    raise exception 'CATALOG_LAUNCH_CURATION_CAMPAIGN_GATE_CLOSED' using errcode = '55000';
  end if;
  return new;
end;
$$;

create or replace function private.guard_catalog_launch_curation_record_insert()
returns trigger
language plpgsql
volatile
security definer
set search_path = ''
as $$
begin
  -- Match release_catalog_launch_curation_campaign exactly: global first,
  -- then campaign.  The release-event check is inside both locks, so an
  -- insert cannot pass concurrently with the campaign's sealing transition.
  perform pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended('catalog-launch-curation-global', 0)
  );
  perform pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended(
      'catalog-launch-curation-campaign:' || new.campaign_id::text, 0
    )
  );
  if exists (
       select 1
       from private.catalog_launch_curation_campaign_release_events as event
       where event.new_campaign_id = new.campaign_id
     ) then
    raise exception 'CATALOG_LAUNCH_CURATION_RELEASED_CAMPAIGN_SEALED' using errcode = '55000';
  end if;
  if new.served_state_mutation_root_sha256 <>
       private.catalog_launch_current_served_state_mutation_root_sha256(
         new.product_id
       ) then
    raise exception 'CATALOG_LAUNCH_CURATION_SERVED_STATE_MUTATION_ROOT_STALE'
      using errcode = '55000';
  end if;
  if private.catalog_launch_curation_record_is_structurally_valid(new.id)
       is not true then
    raise exception 'CATALOG_LAUNCH_CURATION_RECORD_GATE_CLOSED' using errcode = '55000';
  end if;
  if (
       select count(*)
       from private.catalog_launch_curation_records as record
       where record.campaign_id = new.campaign_id
     ) = (
       select campaign.expected_reviewed_record_count
       from private.catalog_launch_curation_campaigns as campaign
       where campaign.id = new.campaign_id
     )
     and (
       select campaign.served_state_mutation_root_set_sha256
       from private.catalog_launch_curation_campaigns as campaign
       where campaign.id = new.campaign_id
     ) <>
       private.catalog_launch_curation_campaign_stored_mutation_root_set_sha256(
         new.campaign_id
       ) then
    raise exception 'CATALOG_LAUNCH_CURATION_SERVED_STATE_MUTATION_ROOT_SET_INVALID'
      using errcode = '55000';
  end if;
  return new;
end;
$$;

create or replace function private.guard_catalog_launch_curation_event_write()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if tg_op <> 'INSERT'
     or pg_catalog.current_setting('app.catalog_launch_curation_transition', true)
       is distinct from '0058-owner-transition' then
    raise exception 'CATALOG_LAUNCH_CURATION_EVENT_WRITE_FORBIDDEN' using errcode = '55000';
  end if;
  return new;
end;
$$;

create or replace function private.guard_catalog_launch_curation_head_write()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if pg_catalog.current_setting('app.catalog_launch_curation_transition', true)
       is distinct from '0058-owner-transition'
     or tg_op = 'DELETE' then
    raise exception 'CATALOG_LAUNCH_CURATION_HEAD_WRITE_FORBIDDEN' using errcode = '55000';
  end if;

  if tg_op = 'INSERT' then
    if new.generation <> 1 or new.state <> 'active' or new.retired_at is not null then
      raise exception 'CATALOG_LAUNCH_CURATION_HEAD_TRANSITION_INVALID' using errcode = '55000';
    end if;
    return new;
  end if;

  if new.product_id <> old.product_id
     or new.territory <> old.territory
     or new.campaign_id <> old.campaign_id
     or new.generation <> old.generation + 1
     or new.last_event_id = old.last_event_id
     or not (
       (
         old.state = 'active' and new.state = 'retired'
         and new.curation_record_id = old.curation_record_id
         and new.campaign_id = old.campaign_id
         and new.activated_at = old.activated_at
         and new.retired_at is not null
       )
     ) then
    raise exception 'CATALOG_LAUNCH_CURATION_HEAD_TRANSITION_INVALID' using errcode = '55000';
  end if;
  return new;
end;
$$;

create or replace function private.guard_catalog_launch_curation_campaign_release_head_write()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if pg_catalog.current_setting('app.catalog_launch_curation_transition', true)
       is distinct from '0058-owner-transition'
     or tg_op = 'DELETE' then
    raise exception 'CATALOG_LAUNCH_CURATION_CAMPAIGN_HEAD_WRITE_FORBIDDEN' using errcode = '55000';
  end if;
  if tg_op = 'INSERT' then
    if new.generation <> 1 or new.state <> 'active' or new.retired_at is not null then
      raise exception 'CATALOG_LAUNCH_CURATION_CAMPAIGN_HEAD_TRANSITION_INVALID' using errcode = '55000';
    end if;
    return new;
  end if;
  if new.territory <> old.territory
     or new.generation <> old.generation + 1
     or new.last_event_id = old.last_event_id
     or not (
       (
         old.state = 'active' and new.state = 'active'
         and new.campaign_id <> old.campaign_id
         and new.retired_at is null
       )
       or (
         old.state = 'retired' and new.state = 'active'
         and new.campaign_id <> old.campaign_id
         and new.retired_at is null
       )
       or (
         old.state = 'active' and new.state = 'retired'
         and new.campaign_id = old.campaign_id
         and new.activated_at = old.activated_at
         and new.retired_at is not null
       )
     ) then
    raise exception 'CATALOG_LAUNCH_CURATION_CAMPAIGN_HEAD_TRANSITION_INVALID' using errcode = '55000';
  end if;
  return new;
end;
$$;

revoke all on function private.guard_catalog_launch_curation_immutable()
  from public, anon, authenticated, service_role;
revoke all on function private.guard_catalog_launch_curation_campaign_insert()
  from public, anon, authenticated, service_role;
revoke all on function private.guard_catalog_launch_curation_record_insert()
  from public, anon, authenticated, service_role;
revoke all on function private.guard_catalog_launch_curation_event_write()
  from public, anon, authenticated, service_role;
revoke all on function private.guard_catalog_launch_curation_head_write()
  from public, anon, authenticated, service_role;
revoke all on function private.guard_catalog_launch_curation_campaign_release_head_write()
  from public, anon, authenticated, service_role;

create trigger catalog_launch_curation_campaigns_immutable
  before update or delete on private.catalog_launch_curation_campaigns
  for each row execute function private.guard_catalog_launch_curation_immutable();
create trigger catalog_launch_curation_campaigns_insert_guard
  before insert on private.catalog_launch_curation_campaigns
  for each row execute function private.guard_catalog_launch_curation_campaign_insert();
create trigger catalog_launch_curation_records_immutable
  before update or delete on private.catalog_launch_curation_records
  for each row execute function private.guard_catalog_launch_curation_immutable();
create trigger catalog_launch_curation_records_insert_guard
  after insert on private.catalog_launch_curation_records
  for each row execute function private.guard_catalog_launch_curation_record_insert();
create trigger catalog_launch_curation_events_guard
  before insert or update or delete on private.catalog_launch_curation_events
  for each row execute function private.guard_catalog_launch_curation_event_write();
create trigger catalog_launch_curation_heads_guard
  before insert or update or delete on private.catalog_launch_curation_heads
  for each row execute function private.guard_catalog_launch_curation_head_write();
create trigger catalog_launch_curation_campaign_release_events_guard
  before insert or update or delete on private.catalog_launch_curation_campaign_release_events
  for each row execute function private.guard_catalog_launch_curation_event_write();
create trigger catalog_launch_curation_campaign_release_heads_guard
  before insert or update or delete on private.catalog_launch_curation_campaign_release_heads
  for each row execute function private.guard_catalog_launch_curation_campaign_release_head_write();

-- One owner-only transaction validates the exact sealed record, serializes all
-- launch-head changes, writes an append-only event, and advances the guarded
-- projection.  Exact retries return the original receipt; changed retries fail.
create or replace function public.activate_catalog_launch_curation(
  p_curation_record_id uuid,
  p_operation_key text,
  p_actor text,
  p_reason text,
  p_expected_curation_record_sha256 text,
  p_expected_database_activation_request_sha256 text,
  p_expected_activation_signature_sha256 text
)
returns table (
  product_id uuid,
  curation_event_id uuid,
  head_generation integer,
  replayed boolean,
  release_id text,
  campaign_authority_sha256 text,
  curation_outcome_reviewer_signature_set_sha256 text,
  cat02_membership_proof_sha256 text,
  cat02_database_observation_sha256 text,
  cat02_verifier_signature_set_sha256 text,
  cat02_production_integrity_set_sha256 text,
  product_record_sha256 text,
  cat02_stage_record_sha256 text,
  cat02_database_normalized_record_sha256 text,
  source_approval_sha256 text,
  source_qa_sha256 text,
  served_state_mutation_root_sha256 text,
  dependency_memberships jsonb,
  cat02_membership_readback_sha256 text,
  offline_base_sealed_record_sha256 text,
  database_base_record_sha256 text,
  reviewed_record_mapping_sha256 text,
  curation_record_sha256 text,
  database_activation_request_sha256 text,
  activation_signature_sha256 text,
  regulatory_review_evidence_sha256 text,
  regulatory_reviewer_ids text[],
  regulatory_signature_set_sha256 text,
  reviewer_evidence_sha256s text[],
  reviewer_signature_set_sha256 text,
  event_receipt_sha256 text,
  head_sha256 text
)
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v_record private.catalog_launch_curation_records%rowtype;
  v_campaign private.catalog_launch_curation_campaigns%rowtype;
  v_head private.catalog_launch_curation_heads%rowtype;
  v_existing_event private.catalog_launch_curation_events%rowtype;
  v_event_id uuid;
  v_event_type text;
  v_generation integer;
  v_request_sha256 text;
  v_event_receipt_sha256 text;
  v_head_before_sha256 text;
  v_head_after_sha256 text;
  v_previous_transition text := pg_catalog.current_setting(
    'app.catalog_launch_curation_transition', true
  );
  v_now timestamptz := pg_catalog.clock_timestamp();
begin
  if p_curation_record_id is null
     or p_operation_key is null
     or p_operation_key !~ '^[A-Za-z0-9][A-Za-z0-9._:/-]{7,199}$'
     or p_actor is null
     or p_actor !~ '^[A-Za-z0-9][A-Za-z0-9._@:+/-]{2,199}$'
     or p_reason is null
     or p_reason <> pg_catalog.btrim(p_reason)
     or pg_catalog.length(p_reason) not between 8 and 500
     or p_expected_curation_record_sha256 is null
     or p_expected_curation_record_sha256 !~ '^[a-f0-9]{64}$'
     or p_expected_database_activation_request_sha256 is null
     or p_expected_database_activation_request_sha256 !~ '^[a-f0-9]{64}$'
     or p_expected_activation_signature_sha256 is null
     or p_expected_activation_signature_sha256 !~ '^[a-f0-9]{64}$' then
    raise exception 'CATALOG_LAUNCH_CURATION_ACTIVATION_INPUT_INVALID' using errcode = '22023';
  end if;

  perform pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended('catalog-launch-curation-global', 0)
  );
  perform pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended(
      'catalog-launch-curation-record:' || p_curation_record_id::text, 0
    )
  );

  select record.* into v_record
  from private.catalog_launch_curation_records as record
  where record.id = p_curation_record_id
  for share;
  if not found then
    raise exception 'CATALOG_LAUNCH_CURATION_RECORD_NOT_FOUND' using errcode = '22023';
  end if;

  select campaign.* into v_campaign
  from private.catalog_launch_curation_campaigns as campaign
  where campaign.id = v_record.campaign_id
  for share;
  if not found then
    raise exception 'CATALOG_LAUNCH_CURATION_CAMPAIGN_NOT_FOUND' using errcode = '55000';
  end if;

  if v_record.activation_decision <> 'approve_activation'
     or v_record.activation_planned_at is null then
    raise exception 'CATALOG_LAUNCH_CURATION_ACTIVATION_GATE_CLOSED' using errcode = '55000';
  end if;
  v_request_sha256 :=
    private.catalog_launch_curation_activation_authorization_sha256(
      v_campaign.release_id,
      v_campaign.campaign_authority_sha256,
      v_campaign.curation_outcome_reviewer_signature_set_sha256,
      v_record.product_record_sha256,
      v_record.served_state_mutation_root_sha256,
      v_record.offline_base_sealed_record_sha256,
      v_record.database_base_record_sha256,
      v_record.reviewed_record_mapping_sha256,
      p_actor,
      p_operation_key,
      p_reason,
      v_record.activation_planned_at
    );

  select event.* into v_existing_event
  from private.catalog_launch_curation_events as event
  where event.operation_key = p_operation_key;
  if found then
    if v_existing_event.event_type not in ('activation', 'supersession')
       or v_existing_event.new_curation_record_id <> p_curation_record_id
       or v_existing_event.request_sha256 <> v_request_sha256
       or v_existing_event.curation_record_sha256 <> p_expected_curation_record_sha256
       or v_existing_event.database_activation_request_sha256
         <> p_expected_database_activation_request_sha256
       or v_existing_event.activation_signature_sha256
         <> p_expected_activation_signature_sha256 then
      raise exception 'CATALOG_LAUNCH_CURATION_ACTIVATION_REPLAY_CHANGED' using errcode = '22023';
    end if;
    select head.* into v_head
    from private.catalog_launch_curation_heads as head
    where head.product_id = v_existing_event.product_id
      and head.territory = v_existing_event.territory
      and head.campaign_id = v_existing_event.campaign_id;
    if not found
       or v_head.state <> 'active'
       or v_head.curation_record_id <> p_curation_record_id
       or v_head.generation <> v_existing_event.generation
       or v_head.last_event_id <> v_existing_event.id
       or v_head.head_sha256 <> v_existing_event.head_after_sha256
       or v_record.served_state_mutation_root_sha256 <>
         private.catalog_launch_current_served_state_mutation_root_sha256(
           v_record.product_id
         )
       or private.catalog_launch_curation_record_is_valid(v_record.id)
         is not true then
      raise exception 'CATALOG_LAUNCH_CURATION_ACTIVATION_REPLAY_STALE' using errcode = '55000';
    end if;
    return query select
      v_head.product_id,
      v_existing_event.id,
      v_head.generation,
      true,
      v_campaign.release_id,
      v_campaign.campaign_authority_sha256,
      v_campaign.curation_outcome_reviewer_signature_set_sha256,
      v_record.cat02_membership_proof_sha256,
      v_record.cat02_database_observation_sha256,
      v_record.cat02_verifier_signature_set_sha256,
      v_record.cat02_production_integrity_set_sha256,
      v_record.product_record_sha256,
      v_record.cat02_stage_record_sha256,
      v_record.cat02_database_normalized_record_sha256,
      v_record.source_approval_sha256,
      v_record.source_qa_sha256,
      v_record.served_state_mutation_root_sha256,
      v_record.dependency_memberships,
      v_record.cat02_membership_readback_sha256,
      v_record.offline_base_sealed_record_sha256,
      v_record.database_base_record_sha256,
      v_record.reviewed_record_mapping_sha256,
      v_record.curation_record_sha256,
      v_record.database_activation_request_sha256,
      v_record.activation_signature_sha256,
      v_record.regulatory_review_evidence_sha256,
      v_record.regulatory_reviewer_ids,
      v_record.regulatory_signature_set_sha256,
      v_record.reviewer_evidence_sha256s,
      v_record.reviewer_signature_set_sha256,
      v_existing_event.event_receipt_sha256,
      v_head.head_sha256;
    return;
  end if;

  if exists (
    select 1
    from private.catalog_launch_curation_events as event
    where event.new_curation_record_id = p_curation_record_id
  ) then
    raise exception 'CATALOG_LAUNCH_CURATION_RECORD_ALREADY_ACTIVATED' using errcode = '55000';
  end if;

  if v_record.curation_record_sha256 <> p_expected_curation_record_sha256
     or v_record.activation_operator_id <> p_actor
     or v_record.database_activation_request_sha256
       <> p_expected_database_activation_request_sha256
     or v_record.database_activation_request_sha256 <> v_request_sha256
     or p_expected_database_activation_request_sha256 <> v_request_sha256
     or v_record.activation_signature_sha256
       <> p_expected_activation_signature_sha256
     or private.catalog_launch_curation_record_is_valid(p_curation_record_id) is not true then
    raise exception 'CATALOG_LAUNCH_CURATION_ACTIVATION_GATE_CLOSED' using errcode = '55000';
  end if;
  if pg_catalog.lower(p_actor) = pg_catalog.lower(v_record.curated_by)
     or exists (
       select 1
       from pg_catalog.unnest(v_campaign.reviewer_ids) as reviewer(reviewer_id)
       where pg_catalog.lower(reviewer.reviewer_id) = pg_catalog.lower(p_actor)
     )
     or exists (
       select 1
       from pg_catalog.unnest(v_record.regulatory_reviewer_ids) as reviewer(reviewer_id)
       where pg_catalog.lower(reviewer.reviewer_id) = pg_catalog.lower(p_actor)
     ) then
    raise exception 'CATALOG_LAUNCH_CURATION_ACTIVATION_INDEPENDENCE_REQUIRED' using errcode = '55000';
  end if;

  perform pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended(
      'catalog-launch-curation-product:' || v_record.product_id::text || ':US', 0
    )
  );
  select head.* into v_head
  from private.catalog_launch_curation_heads as head
  where head.product_id = v_record.product_id
    and head.territory = 'US'
    and head.campaign_id = v_campaign.id
  for update;

  if found and v_head.state = 'active'
     and v_head.curation_record_id = p_curation_record_id then
    raise exception 'CATALOG_LAUNCH_CURATION_HEAD_CORRUPT' using errcode = '55000';
  end if;

  v_event_id := gen_random_uuid();
  v_head_before_sha256 := case when found then v_head.head_sha256 else null end;
  if not found then
    v_event_type := 'activation';
    v_generation := 1;
  elsif v_head.state = 'active' then
    v_event_type := 'supersession';
    v_generation := v_head.generation + 1;
  else
    v_event_type := 'activation';
    v_generation := v_head.generation + 1;
  end if;
  v_head_after_sha256 := private.catalog_launch_curation_head_sha256(
    v_record.product_id,
    'US',
    v_record.id,
    v_campaign.id,
    v_generation,
    'active',
    v_event_id
  );
  v_event_receipt_sha256 :=
    private.catalog_launch_curation_event_receipt_sha256(
      v_event_id,
      v_record.product_id,
      'US',
      v_campaign.id,
      v_event_type,
      case when v_event_type = 'supersession' then v_head.curation_record_id else null end,
      v_record.id,
      v_generation,
      p_operation_key,
      v_request_sha256,
      p_actor,
      p_reason,
      v_record.curation_record_sha256,
      v_campaign.campaign_sha256,
      v_campaign.signed_target_policy_sha256,
      v_campaign.eligibility_policy_sha256,
      v_record.database_activation_request_sha256,
      v_record.activation_signature_sha256,
      v_head_before_sha256
    );

  perform pg_catalog.set_config(
    'app.catalog_launch_curation_transition',
    '0058-owner-transition',
    true
  );
  insert into private.catalog_launch_curation_events (
    id, product_id, territory, campaign_id, event_type,
    previous_curation_record_id, new_curation_record_id, generation,
    operation_key, request_sha256, actor, reason,
    curation_record_sha256, campaign_sha256,
    signed_target_policy_sha256, eligibility_policy_sha256,
    database_activation_request_sha256, activation_signature_sha256,
    head_before_sha256, event_receipt_sha256, head_after_sha256, created_at
  ) values (
    v_event_id, v_record.product_id, 'US', v_campaign.id, v_event_type,
    case when v_event_type = 'supersession' then v_head.curation_record_id else null end,
    v_record.id, v_generation, p_operation_key, v_request_sha256,
    p_actor, p_reason, v_record.curation_record_sha256,
    v_campaign.campaign_sha256, v_campaign.signed_target_policy_sha256,
    v_campaign.eligibility_policy_sha256,
    v_record.database_activation_request_sha256,
    v_record.activation_signature_sha256, v_head_before_sha256,
    v_event_receipt_sha256, v_head_after_sha256, v_now
  );

  if v_head.product_id is null then
    insert into private.catalog_launch_curation_heads (
      product_id, territory, curation_record_id, campaign_id, generation,
      state, last_event_id, head_sha256, activated_at, retired_at
    ) values (
      v_record.product_id, 'US', v_record.id, v_campaign.id, v_generation,
      'active', v_event_id, v_head_after_sha256, v_now, null
    );
  else
    update private.catalog_launch_curation_heads as head
       set curation_record_id = v_record.id,
           campaign_id = v_campaign.id,
           generation = v_generation,
           state = 'active',
           last_event_id = v_event_id,
           head_sha256 = v_head_after_sha256,
           activated_at = v_now,
           retired_at = null
     where head.product_id = v_record.product_id
       and head.territory = 'US'
       and head.campaign_id = v_campaign.id;
  end if;
  perform pg_catalog.set_config(
    'app.catalog_launch_curation_transition',
    coalesce(v_previous_transition, ''),
    true
  );

  return query select
    v_record.product_id,
    v_event_id,
    v_generation,
    false,
    v_campaign.release_id,
    v_campaign.campaign_authority_sha256,
    v_campaign.curation_outcome_reviewer_signature_set_sha256,
    v_record.cat02_membership_proof_sha256,
    v_record.cat02_database_observation_sha256,
    v_record.cat02_verifier_signature_set_sha256,
    v_record.cat02_production_integrity_set_sha256,
    v_record.product_record_sha256,
    v_record.cat02_stage_record_sha256,
    v_record.cat02_database_normalized_record_sha256,
    v_record.source_approval_sha256,
    v_record.source_qa_sha256,
    v_record.served_state_mutation_root_sha256,
    v_record.dependency_memberships,
    v_record.cat02_membership_readback_sha256,
    v_record.offline_base_sealed_record_sha256,
    v_record.database_base_record_sha256,
    v_record.reviewed_record_mapping_sha256,
    v_record.curation_record_sha256,
    v_record.database_activation_request_sha256,
    v_record.activation_signature_sha256,
    v_record.regulatory_review_evidence_sha256,
    v_record.regulatory_reviewer_ids,
    v_record.regulatory_signature_set_sha256,
    v_record.reviewer_evidence_sha256s,
    v_record.reviewer_signature_set_sha256,
    v_event_receipt_sha256,
    v_head_after_sha256;
end;
$$;

comment on function public.activate_catalog_launch_curation(uuid, text, text, text, text, text, text)
  is 'Migration-owner-only replay-safe staging of one exact signed product authorization; returns the canonical authority, mapping, signature, event, and head readback needed for independent final-clear verification; staging alone never opens serving.';
revoke all on function public.activate_catalog_launch_curation(uuid, text, text, text, text, text, text)
  from public, anon, authenticated, service_role;

-- Product authorizations above are deliberately non-serving.  This single
-- campaign transition revalidates the complete sealed set and atomically opens
-- (or supersedes) the one US campaign release head.
create or replace function public.release_catalog_launch_curation_campaign(
  p_campaign_id uuid,
  p_operation_key text,
  p_actor text,
  p_reason_code text,
  p_expected_campaign_sha256 text,
  p_expected_record_set_sha256 text,
  p_expected_served_state_mutation_root_set_sha256 text,
  p_expected_authorization_set_sha256 text
)
returns table (
  campaign_id uuid,
  release_event_id uuid,
  head_generation integer,
  replayed boolean,
  cat02_membership_proof_sha256 text,
  cat02_database_observation_sha256 text,
  cat02_verifier_signature_set_sha256 text,
  cat02_production_integrity_set_sha256 text,
  curation_outcome_reviewer_signature_set_sha256 text,
  served_state_mutation_root_set_sha256 text
)
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v_campaign private.catalog_launch_curation_campaigns%rowtype;
  v_head private.catalog_launch_curation_campaign_release_heads%rowtype;
  v_existing_event private.catalog_launch_curation_campaign_release_events%rowtype;
  v_event_id uuid;
  v_event_type text;
  v_generation integer;
  v_reviewed_count integer;
  v_eligible_count integer;
  v_prioritized_eligible_count integer;
  v_record private.catalog_launch_curation_records%rowtype;
  v_request_sha256 text;
  v_record_set_sha256 text;
  v_stored_mutation_root_set_sha256 text;
  v_current_mutation_root_set_sha256 text;
  v_authorization_set_sha256 text;
  v_membership_set_sha256 text;
  v_head_before_sha256 text;
  v_head_after_sha256 text;
  v_event_receipt_sha256 text;
  v_previous_transition text := pg_catalog.current_setting(
    'app.catalog_launch_curation_transition', true
  );
  v_now timestamptz := pg_catalog.clock_timestamp();
begin
  if p_campaign_id is null
     or p_operation_key is null
     or p_operation_key !~ '^[A-Za-z0-9][A-Za-z0-9._:/-]{7,199}$'
     or p_actor is null
     or p_actor !~ '^[A-Za-z0-9][A-Za-z0-9._@:+/-]{2,199}$'
     or p_reason_code is null
     or p_reason_code <> pg_catalog.btrim(p_reason_code)
     or pg_catalog.length(p_reason_code) not between 8 and 100
     or p_expected_campaign_sha256 is null
     or p_expected_campaign_sha256 !~ '^[a-f0-9]{64}$'
     or p_expected_record_set_sha256 is null
     or p_expected_record_set_sha256 !~ '^[a-f0-9]{64}$'
     or p_expected_served_state_mutation_root_set_sha256 is null
     or p_expected_served_state_mutation_root_set_sha256
       !~ '^[a-f0-9]{64}$'
     or p_expected_authorization_set_sha256 is null
     or p_expected_authorization_set_sha256 !~ '^[a-f0-9]{64}$' then
    raise exception 'CATALOG_LAUNCH_CURATION_CAMPAIGN_RELEASE_INPUT_INVALID' using errcode = '22023';
  end if;

  perform pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended('catalog-launch-curation-global', 0)
  );
  perform pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended('catalog-launch-curation-campaign:' || p_campaign_id::text, 0)
  );
  select campaign.* into v_campaign
  from private.catalog_launch_curation_campaigns as campaign
  where campaign.id = p_campaign_id
  for share;
  if not found then
    raise exception 'CATALOG_LAUNCH_CURATION_CAMPAIGN_NOT_FOUND' using errcode = '22023';
  end if;

  v_record_set_sha256 :=
    private.catalog_launch_curation_campaign_record_set_sha256(v_campaign.id);
  v_stored_mutation_root_set_sha256 :=
    private.catalog_launch_curation_campaign_stored_mutation_root_set_sha256(
      v_campaign.id
    );
  v_current_mutation_root_set_sha256 :=
    private.catalog_launch_curation_campaign_current_mutation_root_set_sha256(
      v_campaign.id
    );
  v_authorization_set_sha256 :=
    private.catalog_launch_curation_campaign_authorization_set_sha256(v_campaign.id);
  v_membership_set_sha256 :=
    private.catalog_launch_curation_campaign_membership_set_sha256(v_campaign.id);
  v_request_sha256 := private.catalog_import_sha256_text(
    private.catalog_import_canonical_json(
      pg_catalog.jsonb_build_object(
        'contractId', 'catalog-launch-curation-campaign-release-request-v1',
        'releaseId', v_campaign.release_id,
        'campaignAuthoritySha256', v_campaign.campaign_authority_sha256,
        'curationOutcomeReviewerSignatureSetSha256',
          v_campaign.curation_outcome_reviewer_signature_set_sha256,
        'campaignSha256', v_campaign.campaign_sha256,
        'expectedReviewedRecordCount', v_campaign.expected_reviewed_record_count,
        'expectedEligibleRecordCount', v_campaign.expected_eligible_record_count,
        'expectedPrioritizedEligibleRecordCount',
          v_campaign.expected_prioritized_eligible_record_count,
        'requiredCategoryEligibleFloors',
          v_campaign.required_category_eligible_floors,
        'cat02ArtifactSetSha256', v_campaign.cat02_artifact_set_sha256,
        'cat02MembershipSetSha256', v_membership_set_sha256,
        'cat02MembershipProofSha256',
          v_campaign.cat02_membership_proof_sha256,
        'cat02DatabaseObservationSha256',
          v_campaign.cat02_database_observation_sha256,
        'cat02VerifierSignatureSetSha256',
          v_campaign.cat02_verifier_signature_set_sha256,
        'cat02ProductionIntegritySetSha256',
          v_campaign.cat02_production_integrity_set_sha256,
        'contributingBatchIds',
          pg_catalog.to_jsonb(v_campaign.contributing_batch_ids),
        'contributingBatchSetSha256',
          v_campaign.contributing_batch_set_sha256,
        'recordSetSha256', v_record_set_sha256,
        'servedStateMutationRootSetSha256',
          v_stored_mutation_root_set_sha256,
        'authorizationSetSha256', v_authorization_set_sha256,
        'operationKey', p_operation_key,
        'actor', p_actor,
        'reasonCode', p_reason_code
      )
    )
  );

  select event.* into v_existing_event
  from private.catalog_launch_curation_campaign_release_events as event
  where event.operation_key = p_operation_key;
  if found then
    if v_existing_event.event_type not in ('release', 'supersession')
       or v_existing_event.new_campaign_id <> p_campaign_id
       or v_existing_event.request_sha256 <> v_request_sha256
       or v_existing_event.campaign_sha256 <> p_expected_campaign_sha256
       or v_existing_event.curation_outcome_reviewer_signature_set_sha256 <>
         v_campaign.curation_outcome_reviewer_signature_set_sha256
       or v_existing_event.cat02_membership_proof_sha256 <>
         v_campaign.cat02_membership_proof_sha256
       or v_existing_event.cat02_database_observation_sha256 <>
         v_campaign.cat02_database_observation_sha256
       or v_existing_event.cat02_verifier_signature_set_sha256 <>
         v_campaign.cat02_verifier_signature_set_sha256
       or v_existing_event.cat02_production_integrity_set_sha256 <>
         v_campaign.cat02_production_integrity_set_sha256
       or v_existing_event.record_set_sha256 <> p_expected_record_set_sha256
       or v_existing_event.served_state_mutation_root_set_sha256 <>
         p_expected_served_state_mutation_root_set_sha256
       or v_existing_event.served_state_mutation_root_set_sha256 <>
         v_campaign.served_state_mutation_root_set_sha256
       or v_existing_event.served_state_mutation_root_set_sha256 <>
         v_stored_mutation_root_set_sha256
       or v_existing_event.served_state_mutation_root_set_sha256 <>
         v_current_mutation_root_set_sha256
       or v_existing_event.authorization_set_sha256
         <> p_expected_authorization_set_sha256 then
      raise exception 'CATALOG_LAUNCH_CURATION_CAMPAIGN_RELEASE_REPLAY_CHANGED' using errcode = '22023';
    end if;
    select head.* into v_head
    from private.catalog_launch_curation_campaign_release_heads as head
    where head.territory = 'US';
    if not found
       or v_head.state <> 'active'
       or v_head.campaign_id <> p_campaign_id
       or v_head.generation <> v_existing_event.generation
       or v_head.last_event_id <> v_existing_event.id
       or v_head.head_sha256 <> v_existing_event.head_after_sha256 then
      raise exception 'CATALOG_LAUNCH_CURATION_CAMPAIGN_RELEASE_REPLAY_STALE' using errcode = '55000';
    end if;
    return query select
      p_campaign_id, v_existing_event.id, v_head.generation, true,
      v_campaign.cat02_membership_proof_sha256,
      v_campaign.cat02_database_observation_sha256,
      v_campaign.cat02_verifier_signature_set_sha256,
      v_campaign.cat02_production_integrity_set_sha256,
      v_campaign.curation_outcome_reviewer_signature_set_sha256,
      v_campaign.served_state_mutation_root_set_sha256;
    return;
  end if;

  if exists (
    select 1 from private.catalog_launch_curation_campaign_release_events as event
    where event.new_campaign_id = p_campaign_id
  ) then
    raise exception 'CATALOG_LAUNCH_CURATION_CAMPAIGN_ALREADY_RELEASED' using errcode = '55000';
  end if;

  select
    count(*)::integer,
    count(*) filter (
      where record.activation_decision = 'approve_activation'
    )::integer,
    count(*) filter (
      where record.activation_decision = 'approve_activation'
        and record.demand_priority_rank is not null
    )::integer
    into v_reviewed_count, v_eligible_count, v_prioritized_eligible_count
  from private.catalog_launch_curation_records as record
  where record.campaign_id = v_campaign.id;
  if p_operation_key <>
       'cat03.release.' || v_campaign.release_id || '.' || v_campaign.campaign_authority_sha256
     or p_reason_code <> 'initial_launch_catalog_release'
     or v_campaign.campaign_sha256 <> p_expected_campaign_sha256
     or v_campaign.review_valid_until <= pg_catalog.now()
     or private.catalog_launch_curation_cat02_artifact_sets_are_live(
       v_campaign.cat02_artifact_sets,
       v_campaign.contributing_batch_ids
     ) is not true
     or v_campaign.cat02_membership_set_sha256 <> v_membership_set_sha256
     or v_campaign.cat02_production_integrity_set_sha256 <>
       private.catalog_launch_curation_cat02_production_integrity_set_sha256(
         v_campaign.cat02_artifact_sets
       )
     or v_campaign.contributing_batch_ids <>
       private.catalog_launch_curation_campaign_membership_batch_ids(
         v_campaign.id
       )
     or v_campaign.expected_reviewed_record_count <> v_reviewed_count
     or v_campaign.expected_eligible_record_count <> v_eligible_count
     or v_campaign.expected_prioritized_eligible_record_count
       <> v_prioritized_eligible_count
     or v_eligible_count < 2000
     or v_prioritized_eligible_count < 100
     or coalesce((
       select min(record.demand_priority_rank)
       from private.catalog_launch_curation_records as record
       where record.campaign_id = v_campaign.id
         and record.activation_decision = 'approve_activation'
         and record.demand_priority_rank is not null
     ), 0) <> 1
     or coalesce((
       select max(record.demand_priority_rank)
       from private.catalog_launch_curation_records as record
       where record.campaign_id = v_campaign.id
         and record.activation_decision = 'approve_activation'
         and record.demand_priority_rank is not null
     ), 0) <> v_prioritized_eligible_count
     or exists (
       select 1
       from pg_catalog.jsonb_each_text(
         v_campaign.required_category_eligible_floors
       ) as floor(category_code, minimum_count)
       where (
         select count(*)
         from private.catalog_launch_curation_records as record
         where record.campaign_id = v_campaign.id
           and record.activation_decision = 'approve_activation'
           and record.category_code = floor.category_code
       ) < floor.minimum_count::integer
     )
     or v_campaign.expected_record_set_sha256 <> v_record_set_sha256
     or p_expected_record_set_sha256 <> v_record_set_sha256
     or v_campaign.served_state_mutation_root_set_sha256 <>
       v_stored_mutation_root_set_sha256
     or v_stored_mutation_root_set_sha256 <>
       v_current_mutation_root_set_sha256
     or p_expected_served_state_mutation_root_set_sha256 <>
       v_stored_mutation_root_set_sha256
     or v_campaign.activation_authorization_set_sha256 <> v_authorization_set_sha256
     or p_expected_authorization_set_sha256 <> v_authorization_set_sha256
     or exists (
       select 1
       from private.catalog_launch_curation_records as record
       where record.campaign_id = v_campaign.id
         and private.catalog_launch_curation_record_is_structurally_valid(
           record.id
         ) is not true
     )
     or exists (
       select 1
       from private.catalog_launch_curation_records as record
       where record.campaign_id = v_campaign.id
         and record.activation_decision = 'approve_activation'
         and private.catalog_launch_curation_record_is_valid(record.id)
           is not true
     )
     or exists (
       select 1
       from private.catalog_launch_curation_records as record
       where record.campaign_id = v_campaign.id
         and record.activation_decision = 'approve_activation'
         and record.activation_operator_id <> p_actor
     ) then
    raise exception 'CATALOG_LAUNCH_CURATION_CAMPAIGN_RELEASE_GATE_CLOSED' using errcode = '55000';
  end if;

  -- The complete product-head set is staged inside this same transaction.
  -- Until the single release-head flip below, neither these rows nor any
  -- previously staged successor rows can affect a serving query.
  for v_record in
    select record.*
    from private.catalog_launch_curation_records as record
    where record.campaign_id = v_campaign.id
      and record.activation_decision = 'approve_activation'
    order by record.product_record_sha256, record.id
  loop
    if not exists (
      select 1
      from private.catalog_launch_curation_heads as head
      join private.catalog_launch_curation_events as event
        on event.id = head.last_event_id
       and event.new_curation_record_id = head.curation_record_id
       and event.campaign_id = head.campaign_id
       and event.request_sha256 = v_record.database_activation_request_sha256
       and event.event_receipt_sha256 =
         private.catalog_launch_curation_event_receipt_sha256(
           event.id, event.product_id, event.territory, event.campaign_id,
           event.event_type, event.previous_curation_record_id,
           event.new_curation_record_id, event.generation,
           event.operation_key, event.request_sha256, event.actor, event.reason,
           event.curation_record_sha256, event.campaign_sha256,
           event.signed_target_policy_sha256, event.eligibility_policy_sha256,
           event.database_activation_request_sha256,
           event.activation_signature_sha256, event.head_before_sha256
         )
      where head.product_id = v_record.product_id
        and head.territory = 'US'
        and head.campaign_id = v_campaign.id
        and head.curation_record_id = v_record.id
        and head.state = 'active'
    ) then
      perform 1
      from public.activate_catalog_launch_curation(
        v_record.id,
        'cat03.activate.' || v_campaign.release_id || '.'
          || v_record.product_record_sha256,
        p_actor,
        'initial_launch_catalog_activation',
        v_record.curation_record_sha256,
        v_record.database_activation_request_sha256,
        v_record.activation_signature_sha256
      );
    end if;
  end loop;

  if (
       select count(*)
       from private.catalog_launch_curation_heads as head
       where head.campaign_id = v_campaign.id
         and head.territory = 'US'
         and head.state = 'active'
     ) <> v_eligible_count
     or exists (
       select 1
       from private.catalog_launch_curation_records as record
       where record.campaign_id = v_campaign.id
         and record.activation_decision = 'approve_activation'
         and not exists (
           select 1
           from private.catalog_launch_curation_heads as head
           join private.catalog_launch_curation_events as event
             on event.id = head.last_event_id
            and event.product_id = head.product_id
            and event.territory = head.territory
            and event.campaign_id = head.campaign_id
            and event.new_curation_record_id = head.curation_record_id
            and event.generation = head.generation
            and event.request_sha256 = record.database_activation_request_sha256
            and event.curation_record_sha256 = record.curation_record_sha256
            and event.database_activation_request_sha256
              = record.database_activation_request_sha256
            and event.activation_signature_sha256
              = record.activation_signature_sha256
            and event.head_after_sha256 = head.head_sha256
            and event.event_receipt_sha256 =
              private.catalog_launch_curation_event_receipt_sha256(
                event.id, event.product_id, event.territory, event.campaign_id,
                event.event_type, event.previous_curation_record_id,
                event.new_curation_record_id, event.generation,
                event.operation_key, event.request_sha256, event.actor, event.reason,
                event.curation_record_sha256, event.campaign_sha256,
                event.signed_target_policy_sha256, event.eligibility_policy_sha256,
                event.database_activation_request_sha256,
                event.activation_signature_sha256, event.head_before_sha256
              )
           where head.product_id = record.product_id
             and head.territory = 'US'
             and head.campaign_id = v_campaign.id
             and head.curation_record_id = record.id
             and head.state = 'active'
         )
     )
     or exists (
       select 1
       from private.catalog_launch_curation_heads as head
       left join private.catalog_launch_curation_records as record
         on record.id = head.curation_record_id
       where head.campaign_id = v_campaign.id
         and (
           record.id is null
           or record.campaign_id <> v_campaign.id
           or record.activation_decision <> 'approve_activation'
         )
     ) then
    raise exception 'CATALOG_LAUNCH_CURATION_CAMPAIGN_RELEASE_HEAD_SET_INCOMPLETE'
      using errcode = '55000';
  end if;

  select head.* into v_head
  from private.catalog_launch_curation_campaign_release_heads as head
  where head.territory = 'US'
  for update;
  v_event_id := gen_random_uuid();
  v_head_before_sha256 := case when found then v_head.head_sha256 else null end;
  if not found or v_head.state = 'retired' then
    v_event_type := 'release';
    v_generation := coalesce(v_head.generation, 0) + 1;
  else
    v_event_type := 'supersession';
    v_generation := v_head.generation + 1;
  end if;
  v_head_after_sha256 := private.catalog_launch_curation_campaign_release_head_sha256(
    'US', v_campaign.id, v_generation, 'active', v_event_id
  );
  v_event_receipt_sha256 :=
    private.catalog_launch_curation_campaign_release_receipt_sha256(
      v_event_id, 'US', v_event_type,
      case when v_event_type = 'supersession' then v_head.campaign_id else null end,
      v_campaign.id, v_generation, p_operation_key, v_request_sha256,
      p_actor, p_reason_code, v_campaign.campaign_sha256,
      v_campaign.campaign_authority_sha256,
      v_campaign.curation_outcome_reviewer_signature_set_sha256,
      v_campaign.cat02_membership_proof_sha256,
      v_campaign.cat02_database_observation_sha256,
      v_campaign.cat02_verifier_signature_set_sha256,
      v_campaign.cat02_production_integrity_set_sha256,
      v_record_set_sha256,
      v_stored_mutation_root_set_sha256,
      v_authorization_set_sha256, v_head_before_sha256
    );
  perform pg_catalog.set_config(
    'app.catalog_launch_curation_transition', '0058-owner-transition', true
  );
  insert into private.catalog_launch_curation_campaign_release_events (
    id, territory, event_type, previous_campaign_id, new_campaign_id,
    generation, operation_key, request_sha256, actor, reason,
    campaign_sha256, campaign_authority_sha256,
    curation_outcome_reviewer_signature_set_sha256,
    cat02_membership_proof_sha256, cat02_database_observation_sha256,
    cat02_verifier_signature_set_sha256,
    cat02_production_integrity_set_sha256, record_set_sha256,
    served_state_mutation_root_set_sha256,
    authorization_set_sha256, head_before_sha256, event_receipt_sha256,
    head_after_sha256, created_at
  ) values (
    v_event_id, 'US', v_event_type,
    case when v_event_type = 'supersession' then v_head.campaign_id else null end,
    v_campaign.id, v_generation, p_operation_key, v_request_sha256,
    p_actor, p_reason_code, v_campaign.campaign_sha256,
    v_campaign.campaign_authority_sha256,
    v_campaign.curation_outcome_reviewer_signature_set_sha256,
    v_campaign.cat02_membership_proof_sha256,
    v_campaign.cat02_database_observation_sha256,
    v_campaign.cat02_verifier_signature_set_sha256,
    v_campaign.cat02_production_integrity_set_sha256, v_record_set_sha256,
    v_stored_mutation_root_set_sha256,
    v_authorization_set_sha256, v_head_before_sha256,
    v_event_receipt_sha256, v_head_after_sha256, v_now
  );
  if v_head.territory is null then
    insert into private.catalog_launch_curation_campaign_release_heads (
      territory, campaign_id, generation, state, last_event_id,
      head_sha256, activated_at, retired_at
    ) values (
      'US', v_campaign.id, v_generation, 'active', v_event_id,
      v_head_after_sha256, v_now, null
    );
  else
    update private.catalog_launch_curation_campaign_release_heads as head
       set campaign_id = v_campaign.id,
           generation = v_generation,
           state = 'active',
           last_event_id = v_event_id,
           head_sha256 = v_head_after_sha256,
           activated_at = v_now,
           retired_at = null
     where head.territory = 'US';
  end if;
  perform pg_catalog.set_config(
    'app.catalog_launch_curation_transition',
    coalesce(v_previous_transition, ''), true
  );
  return query select
    v_campaign.id, v_event_id, v_generation, false,
    v_campaign.cat02_membership_proof_sha256,
    v_campaign.cat02_database_observation_sha256,
    v_campaign.cat02_verifier_signature_set_sha256,
    v_campaign.cat02_production_integrity_set_sha256,
    v_campaign.curation_outcome_reviewer_signature_set_sha256,
    v_campaign.served_state_mutation_root_set_sha256;
end;
$$;

comment on function public.release_catalog_launch_curation_campaign(
  uuid, text, text, text, text, text, text, text
) is 'Migration-owner-only atomic release of one complete exact US campaign after every sealed record and staged authorization revalidates.';
revoke all on function public.release_catalog_launch_curation_campaign(
  uuid, text, text, text, text, text, text, text
) from public, anon, authenticated, service_role;

create or replace function public.retire_catalog_launch_curation_campaign(
  p_campaign_id uuid,
  p_operation_key text,
  p_actor text,
  p_reason_code text,
  p_expected_campaign_sha256 text
)
returns table (
  campaign_id uuid,
  release_event_id uuid,
  head_generation integer,
  replayed boolean,
  cat02_membership_proof_sha256 text,
  cat02_database_observation_sha256 text,
  cat02_verifier_signature_set_sha256 text,
  cat02_production_integrity_set_sha256 text,
  curation_outcome_reviewer_signature_set_sha256 text,
  served_state_mutation_root_set_sha256 text
)
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v_campaign private.catalog_launch_curation_campaigns%rowtype;
  v_head private.catalog_launch_curation_campaign_release_heads%rowtype;
  v_existing_event private.catalog_launch_curation_campaign_release_events%rowtype;
  v_event_id uuid;
  v_generation integer;
  v_request_sha256 text;
  v_record_set_sha256 text;
  v_mutation_root_set_sha256 text;
  v_authorization_set_sha256 text;
  v_head_after_sha256 text;
  v_event_receipt_sha256 text;
  v_previous_transition text := pg_catalog.current_setting(
    'app.catalog_launch_curation_transition', true
  );
  v_now timestamptz := pg_catalog.clock_timestamp();
begin
  if p_campaign_id is null
     or p_operation_key is null
     or p_operation_key !~ '^[A-Za-z0-9][A-Za-z0-9._:/-]{7,199}$'
     or p_actor is null
     or p_actor !~ '^[A-Za-z0-9][A-Za-z0-9._@:+/-]{2,199}$'
     or p_reason_code not in (
       'review_revoked', 'beta_corpus_withdrawn', 'consent_integrity_failure',
       'source_authority_revoked', 'manual_launch_retirement'
     )
     or p_expected_campaign_sha256 is null
     or p_expected_campaign_sha256 !~ '^[a-f0-9]{64}$' then
    raise exception 'CATALOG_LAUNCH_CURATION_CAMPAIGN_RETIREMENT_INPUT_INVALID' using errcode = '22023';
  end if;
  perform pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended('catalog-launch-curation-global', 0)
  );
  select campaign.* into v_campaign
  from private.catalog_launch_curation_campaigns as campaign
  where campaign.id = p_campaign_id
  for share;
  if not found then
    raise exception 'CATALOG_LAUNCH_CURATION_CAMPAIGN_NOT_FOUND' using errcode = '22023';
  end if;
  v_record_set_sha256 :=
    private.catalog_launch_curation_campaign_record_set_sha256(v_campaign.id);
  v_mutation_root_set_sha256 :=
    private.catalog_launch_curation_campaign_stored_mutation_root_set_sha256(
      v_campaign.id
    );
  v_authorization_set_sha256 :=
    private.catalog_launch_curation_campaign_authorization_set_sha256(v_campaign.id);
  v_request_sha256 := private.catalog_import_sha256_text(
    private.catalog_import_canonical_json(
      pg_catalog.jsonb_build_object(
        'contractId', 'catalog-launch-curation-campaign-retirement-request-v1',
        'releaseId', v_campaign.release_id,
        'campaignAuthoritySha256', v_campaign.campaign_authority_sha256,
        'curationOutcomeReviewerSignatureSetSha256',
          v_campaign.curation_outcome_reviewer_signature_set_sha256,
        'campaignSha256', v_campaign.campaign_sha256,
        'cat02MembershipProofSha256',
          v_campaign.cat02_membership_proof_sha256,
        'cat02DatabaseObservationSha256',
          v_campaign.cat02_database_observation_sha256,
        'cat02VerifierSignatureSetSha256',
          v_campaign.cat02_verifier_signature_set_sha256,
        'cat02ProductionIntegritySetSha256',
          v_campaign.cat02_production_integrity_set_sha256,
        'servedStateMutationRootSetSha256', v_mutation_root_set_sha256,
        'operationKey', p_operation_key,
        'actor', p_actor,
        'reasonCode', p_reason_code
      )
    )
  );
  select event.* into v_existing_event
  from private.catalog_launch_curation_campaign_release_events as event
  where event.operation_key = p_operation_key;
  if found then
    if v_existing_event.event_type <> 'retirement'
       or v_existing_event.previous_campaign_id <> p_campaign_id
       or v_existing_event.request_sha256 <> v_request_sha256
       or v_existing_event.campaign_sha256 <> p_expected_campaign_sha256
       or v_existing_event.curation_outcome_reviewer_signature_set_sha256 <>
         v_campaign.curation_outcome_reviewer_signature_set_sha256
       or v_existing_event.cat02_membership_proof_sha256 <>
         v_campaign.cat02_membership_proof_sha256
       or v_existing_event.cat02_database_observation_sha256 <>
         v_campaign.cat02_database_observation_sha256
       or v_existing_event.cat02_verifier_signature_set_sha256 <>
         v_campaign.cat02_verifier_signature_set_sha256
       or v_existing_event.cat02_production_integrity_set_sha256 <>
         v_campaign.cat02_production_integrity_set_sha256
       or v_existing_event.served_state_mutation_root_set_sha256 <>
         v_campaign.served_state_mutation_root_set_sha256
       or v_existing_event.served_state_mutation_root_set_sha256 <>
         v_mutation_root_set_sha256 then
      raise exception 'CATALOG_LAUNCH_CURATION_CAMPAIGN_RETIREMENT_REPLAY_CHANGED' using errcode = '22023';
    end if;
    select head.* into v_head
    from private.catalog_launch_curation_campaign_release_heads as head
    where head.territory = 'US';
    if not found or v_head.state <> 'retired'
       or v_head.campaign_id <> p_campaign_id
       or v_head.last_event_id <> v_existing_event.id
       or v_head.generation <> v_existing_event.generation then
      raise exception 'CATALOG_LAUNCH_CURATION_CAMPAIGN_RETIREMENT_REPLAY_STALE' using errcode = '55000';
    end if;
    return query select
      p_campaign_id, v_existing_event.id, v_head.generation, true,
      v_campaign.cat02_membership_proof_sha256,
      v_campaign.cat02_database_observation_sha256,
      v_campaign.cat02_verifier_signature_set_sha256,
      v_campaign.cat02_production_integrity_set_sha256,
      v_campaign.curation_outcome_reviewer_signature_set_sha256,
      v_campaign.served_state_mutation_root_set_sha256;
    return;
  end if;
  select head.* into v_head
  from private.catalog_launch_curation_campaign_release_heads as head
  where head.territory = 'US'
  for update;
  if not found or v_head.state <> 'active' or v_head.campaign_id <> p_campaign_id
     or v_campaign.campaign_sha256 <> p_expected_campaign_sha256 then
    raise exception 'CATALOG_LAUNCH_CURATION_CAMPAIGN_RETIREMENT_GATE_CLOSED' using errcode = '55000';
  end if;
  v_event_id := gen_random_uuid();
  v_generation := v_head.generation + 1;
  v_head_after_sha256 := private.catalog_launch_curation_campaign_release_head_sha256(
    'US', v_campaign.id, v_generation, 'retired', v_event_id
  );
  v_event_receipt_sha256 :=
    private.catalog_launch_curation_campaign_release_receipt_sha256(
      v_event_id, 'US', 'retirement', v_campaign.id, null,
      v_generation, p_operation_key, v_request_sha256, p_actor, p_reason_code,
      v_campaign.campaign_sha256, v_campaign.campaign_authority_sha256,
      v_campaign.curation_outcome_reviewer_signature_set_sha256,
      v_campaign.cat02_membership_proof_sha256,
      v_campaign.cat02_database_observation_sha256,
      v_campaign.cat02_verifier_signature_set_sha256,
      v_campaign.cat02_production_integrity_set_sha256,
      v_record_set_sha256, v_mutation_root_set_sha256,
      v_authorization_set_sha256, v_head.head_sha256
    );
  perform pg_catalog.set_config(
    'app.catalog_launch_curation_transition', '0058-owner-transition', true
  );
  insert into private.catalog_launch_curation_campaign_release_events (
    id, territory, event_type, previous_campaign_id, new_campaign_id,
    generation, operation_key, request_sha256, actor, reason,
    campaign_sha256, campaign_authority_sha256,
    curation_outcome_reviewer_signature_set_sha256,
    cat02_membership_proof_sha256, cat02_database_observation_sha256,
    cat02_verifier_signature_set_sha256,
    cat02_production_integrity_set_sha256, record_set_sha256,
    served_state_mutation_root_set_sha256,
    authorization_set_sha256, head_before_sha256, event_receipt_sha256,
    head_after_sha256, created_at
  ) values (
    v_event_id, 'US', 'retirement', v_campaign.id, null,
    v_generation, p_operation_key, v_request_sha256, p_actor, p_reason_code,
    v_campaign.campaign_sha256, v_campaign.campaign_authority_sha256,
    v_campaign.curation_outcome_reviewer_signature_set_sha256,
    v_campaign.cat02_membership_proof_sha256,
    v_campaign.cat02_database_observation_sha256,
    v_campaign.cat02_verifier_signature_set_sha256,
    v_campaign.cat02_production_integrity_set_sha256,
    v_record_set_sha256, v_mutation_root_set_sha256,
    v_authorization_set_sha256, v_head.head_sha256,
    v_event_receipt_sha256, v_head_after_sha256, v_now
  );
  update private.catalog_launch_curation_campaign_release_heads as head
     set generation = v_generation,
         state = 'retired',
         last_event_id = v_event_id,
         head_sha256 = v_head_after_sha256,
         retired_at = v_now
   where head.territory = 'US';
  perform pg_catalog.set_config(
    'app.catalog_launch_curation_transition',
    coalesce(v_previous_transition, ''), true
  );
  return query select
    v_campaign.id, v_event_id, v_generation, false,
    v_campaign.cat02_membership_proof_sha256,
    v_campaign.cat02_database_observation_sha256,
    v_campaign.cat02_verifier_signature_set_sha256,
    v_campaign.cat02_production_integrity_set_sha256,
    v_campaign.curation_outcome_reviewer_signature_set_sha256,
    v_campaign.served_state_mutation_root_set_sha256;
end;
$$;

comment on function public.retire_catalog_launch_curation_campaign(
  uuid, text, text, text, text
) is 'Migration-owner-only atomic invalidation of the active campaign for expiry, reviewer revocation, consent/corpus withdrawal, source revocation, or manual retirement.';
revoke all on function public.retire_catalog_launch_curation_campaign(
  uuid, text, text, text, text
) from public, anon, authenticated, service_role;

create or replace function public.retire_catalog_launch_curation(
  p_product_id uuid,
  p_operation_key text,
  p_actor text,
  p_reason text,
  p_expected_active_curation_record_sha256 text
)
returns table (
  product_id uuid,
  curation_event_id uuid,
  head_generation integer,
  replayed boolean
)
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v_record private.catalog_launch_curation_records%rowtype;
  v_campaign private.catalog_launch_curation_campaigns%rowtype;
  v_head private.catalog_launch_curation_heads%rowtype;
  v_release_head private.catalog_launch_curation_campaign_release_heads%rowtype;
  v_existing_event private.catalog_launch_curation_events%rowtype;
  v_event_id uuid;
  v_generation integer;
  v_request_sha256 text;
  v_event_receipt_sha256 text;
  v_head_after_sha256 text;
  v_previous_transition text := pg_catalog.current_setting(
    'app.catalog_launch_curation_transition', true
  );
  v_now timestamptz := pg_catalog.clock_timestamp();
begin
  if p_product_id is null
     or p_operation_key is null
     or p_operation_key !~ '^[A-Za-z0-9][A-Za-z0-9._:/-]{7,199}$'
     or p_actor is null
     or p_actor !~ '^[A-Za-z0-9][A-Za-z0-9._@:+/-]{2,199}$'
     or p_reason is null
     or p_reason <> pg_catalog.btrim(p_reason)
     or pg_catalog.length(p_reason) not between 8 and 500
     or p_expected_active_curation_record_sha256 is null
     or p_expected_active_curation_record_sha256 !~ '^[a-f0-9]{64}$' then
    raise exception 'CATALOG_LAUNCH_CURATION_RETIREMENT_INPUT_INVALID' using errcode = '22023';
  end if;

  v_request_sha256 := private.catalog_import_sha256_text(
    private.catalog_import_canonical_json(
      pg_catalog.jsonb_build_object(
        'contractId', 'catalog-launch-curation-retirement-request-v1',
        'productId', p_product_id,
        'operationKey', p_operation_key,
        'actor', p_actor,
        'reason', p_reason,
        'expectedActiveCurationRecordSha256', p_expected_active_curation_record_sha256
      )
    )
  );

  perform pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended('catalog-launch-curation-global', 0)
  );
  perform pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended(
      'catalog-launch-curation-product:' || p_product_id::text || ':US', 0
    )
  );

  select event.* into v_existing_event
  from private.catalog_launch_curation_events as event
  where event.operation_key = p_operation_key;
  if found then
    if v_existing_event.event_type <> 'retirement'
       or v_existing_event.product_id <> p_product_id
       or v_existing_event.request_sha256 <> v_request_sha256
       or v_existing_event.curation_record_sha256
         <> p_expected_active_curation_record_sha256 then
      raise exception 'CATALOG_LAUNCH_CURATION_RETIREMENT_REPLAY_CHANGED' using errcode = '22023';
    end if;
    select head.* into v_head
    from private.catalog_launch_curation_heads as head
    where head.product_id = p_product_id
      and head.territory = 'US'
      and head.campaign_id = v_existing_event.campaign_id;
    if not found
       or v_head.state <> 'retired'
       or v_head.generation <> v_existing_event.generation
       or v_head.last_event_id <> v_existing_event.id
       or v_head.head_sha256 <> v_existing_event.head_after_sha256
       or v_existing_event.event_receipt_sha256 <>
         private.catalog_launch_curation_event_receipt_sha256(
           v_existing_event.id, v_existing_event.product_id,
           v_existing_event.territory, v_existing_event.campaign_id,
           v_existing_event.event_type,
           v_existing_event.previous_curation_record_id,
           v_existing_event.new_curation_record_id,
           v_existing_event.generation, v_existing_event.operation_key,
           v_existing_event.request_sha256, v_existing_event.actor,
           v_existing_event.reason, v_existing_event.curation_record_sha256,
           v_existing_event.campaign_sha256,
           v_existing_event.signed_target_policy_sha256,
           v_existing_event.eligibility_policy_sha256,
           v_existing_event.database_activation_request_sha256,
           v_existing_event.activation_signature_sha256,
           v_existing_event.head_before_sha256
         ) then
      raise exception 'CATALOG_LAUNCH_CURATION_RETIREMENT_REPLAY_STALE' using errcode = '55000';
    end if;
    return query select p_product_id, v_existing_event.id,
      v_head.generation, true;
    return;
  end if;

  select release_head.* into v_release_head
  from private.catalog_launch_curation_campaign_release_heads as release_head
  where release_head.territory = 'US'
    and release_head.state = 'active'
  for update;
  if not found then
    raise exception 'CATALOG_LAUNCH_CURATION_ACTIVE_CAMPAIGN_NOT_FOUND' using errcode = '55000';
  end if;

  select head.* into v_head
  from private.catalog_launch_curation_heads as head
  where head.product_id = p_product_id
    and head.territory = 'US'
    and head.campaign_id = v_release_head.campaign_id
  for update;
  if not found or v_head.state <> 'active' then
    raise exception 'CATALOG_LAUNCH_CURATION_ACTIVE_HEAD_NOT_FOUND' using errcode = '55000';
  end if;

  select record.* into v_record
  from private.catalog_launch_curation_records as record
  where record.id = v_head.curation_record_id;
  select campaign.* into v_campaign
  from private.catalog_launch_curation_campaigns as campaign
  where campaign.id = v_head.campaign_id;
  if v_record.id is null
     or v_campaign.id is null
     or v_record.curation_record_sha256
       <> p_expected_active_curation_record_sha256 then
    raise exception 'CATALOG_LAUNCH_CURATION_RETIREMENT_GATE_CLOSED' using errcode = '55000';
  end if;

  v_event_id := gen_random_uuid();
  v_generation := v_head.generation + 1;
  v_head_after_sha256 := private.catalog_launch_curation_head_sha256(
    p_product_id,
    'US',
    v_record.id,
    v_campaign.id,
    v_generation,
    'retired',
    v_event_id
  );
  v_event_receipt_sha256 := private.catalog_launch_curation_event_receipt_sha256(
    v_event_id, p_product_id, 'US', v_campaign.id, 'retirement',
    v_record.id, null, v_generation, p_operation_key, v_request_sha256,
    p_actor, p_reason, v_record.curation_record_sha256,
    v_campaign.campaign_sha256, v_campaign.signed_target_policy_sha256,
    v_campaign.eligibility_policy_sha256, null, null, v_head.head_sha256
  );
  perform pg_catalog.set_config(
    'app.catalog_launch_curation_transition',
    '0058-owner-transition',
    true
  );
  insert into private.catalog_launch_curation_events (
    id, product_id, territory, campaign_id, event_type,
    previous_curation_record_id, new_curation_record_id, generation,
    operation_key, request_sha256, actor, reason,
    curation_record_sha256, campaign_sha256,
    signed_target_policy_sha256, eligibility_policy_sha256,
    database_activation_request_sha256, activation_signature_sha256,
    head_before_sha256, event_receipt_sha256, head_after_sha256, created_at
  ) values (
    v_event_id, p_product_id, 'US', v_campaign.id, 'retirement',
    v_record.id, null, v_generation, p_operation_key, v_request_sha256,
    p_actor, p_reason, v_record.curation_record_sha256,
    v_campaign.campaign_sha256, v_campaign.signed_target_policy_sha256,
    v_campaign.eligibility_policy_sha256, null, null, v_head.head_sha256,
    v_event_receipt_sha256, v_head_after_sha256, v_now
  );
  update private.catalog_launch_curation_heads as head
     set generation = v_generation,
         state = 'retired',
         last_event_id = v_event_id,
         head_sha256 = v_head_after_sha256,
         retired_at = v_now
   where head.product_id = p_product_id
     and head.territory = 'US'
     and head.campaign_id = v_release_head.campaign_id;
  perform pg_catalog.set_config(
    'app.catalog_launch_curation_transition',
    coalesce(v_previous_transition, ''),
    true
  );

  return query select p_product_id, v_event_id, v_generation, false;
end;
$$;

comment on function public.retire_catalog_launch_curation(uuid, text, text, text, text)
  is 'Migration-owner-only replay-safe non-destructive retirement of an exact active launch-catalog head.';
revoke all on function public.retire_catalog_launch_curation(uuid, text, text, text, text)
  from public, anon, authenticated, service_role;

-- One exact active head is now the central positive serving authority.  The
-- current row, last immutable event, campaign, sealed record, and every live
-- dependency must agree byte-for-byte.
create or replace function private.catalog_launch_curation_head_is_active(
  p_product_id uuid
)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select (
    select count(*)
    from private.catalog_launch_curation_heads as head
    join private.catalog_launch_curation_records as record
      on record.id = head.curation_record_id
     and record.product_id = head.product_id
    join private.catalog_launch_curation_campaigns as campaign
      on campaign.id = head.campaign_id
     and campaign.id = record.campaign_id
    join private.catalog_launch_curation_events as event
      on event.id = head.last_event_id
     and event.product_id = head.product_id
     and event.territory = head.territory
     and event.campaign_id = head.campaign_id
     and event.new_curation_record_id = head.curation_record_id
     and event.generation = head.generation
     and event.event_type in ('activation', 'supersession')
     and event.curation_record_sha256 = record.curation_record_sha256
     and event.campaign_sha256 = campaign.campaign_sha256
     and event.signed_target_policy_sha256 = campaign.signed_target_policy_sha256
     and event.eligibility_policy_sha256 = campaign.eligibility_policy_sha256
     and event.database_activation_request_sha256 = record.database_activation_request_sha256
     and event.activation_signature_sha256 = record.activation_signature_sha256
     and event.head_after_sha256 = head.head_sha256
     and event.event_receipt_sha256 =
       private.catalog_launch_curation_event_receipt_sha256(
         event.id, event.product_id, event.territory, event.campaign_id,
         event.event_type, event.previous_curation_record_id,
         event.new_curation_record_id, event.generation,
         event.operation_key, event.request_sha256, event.actor, event.reason,
         event.curation_record_sha256, event.campaign_sha256,
         event.signed_target_policy_sha256, event.eligibility_policy_sha256,
         event.database_activation_request_sha256,
         event.activation_signature_sha256, event.head_before_sha256
       )
    join private.catalog_launch_curation_campaign_release_heads as release_head
      on release_head.territory = head.territory
     and release_head.campaign_id = head.campaign_id
     and release_head.state = 'active'
     and release_head.retired_at is null
    join private.catalog_launch_curation_campaign_release_events as release_event
      on release_event.id = release_head.last_event_id
     and release_event.territory = release_head.territory
     and release_event.new_campaign_id = release_head.campaign_id
     and release_event.generation = release_head.generation
     and release_event.event_type in ('release', 'supersession')
     and release_event.campaign_sha256 = campaign.campaign_sha256
     and release_event.campaign_authority_sha256 = campaign.campaign_authority_sha256
     and release_event.curation_outcome_reviewer_signature_set_sha256 =
       campaign.curation_outcome_reviewer_signature_set_sha256
     and release_event.cat02_membership_proof_sha256 =
       campaign.cat02_membership_proof_sha256
     and release_event.cat02_database_observation_sha256 =
       campaign.cat02_database_observation_sha256
     and release_event.cat02_verifier_signature_set_sha256 =
       campaign.cat02_verifier_signature_set_sha256
     and release_event.cat02_production_integrity_set_sha256 =
       campaign.cat02_production_integrity_set_sha256
     and release_event.record_set_sha256 = campaign.expected_record_set_sha256
     and release_event.served_state_mutation_root_set_sha256 =
       campaign.served_state_mutation_root_set_sha256
     and campaign.served_state_mutation_root_set_sha256 =
       private.catalog_launch_curation_campaign_stored_mutation_root_set_sha256(
         campaign.id
       )
     and campaign.served_state_mutation_root_set_sha256 =
       private.catalog_launch_curation_campaign_current_mutation_root_set_sha256(
         campaign.id
       )
     and release_event.authorization_set_sha256 = campaign.activation_authorization_set_sha256
     and release_event.head_after_sha256 = release_head.head_sha256
     and release_event.event_receipt_sha256 =
       private.catalog_launch_curation_campaign_release_receipt_sha256(
         release_event.id, release_event.territory, release_event.event_type,
         release_event.previous_campaign_id, release_event.new_campaign_id,
         release_event.generation, release_event.operation_key,
         release_event.request_sha256, release_event.actor, release_event.reason,
         release_event.campaign_sha256, release_event.campaign_authority_sha256,
         release_event.curation_outcome_reviewer_signature_set_sha256,
         release_event.cat02_membership_proof_sha256,
         release_event.cat02_database_observation_sha256,
         release_event.cat02_verifier_signature_set_sha256,
         release_event.cat02_production_integrity_set_sha256,
         release_event.record_set_sha256,
         release_event.served_state_mutation_root_set_sha256,
         release_event.authorization_set_sha256,
         release_event.head_before_sha256
       )
    where head.product_id = p_product_id
      and head.territory = 'US'
      and head.state = 'active'
      and head.retired_at is null
      and campaign.review_valid_until > pg_catalog.now()
      and release_head.head_sha256 =
        private.catalog_launch_curation_campaign_release_head_sha256(
          release_head.territory, release_head.campaign_id,
          release_head.generation, release_head.state, release_head.last_event_id
        )
      and head.head_sha256 = private.catalog_launch_curation_head_sha256(
        head.product_id,
        head.territory,
        head.curation_record_id,
        head.campaign_id,
        head.generation,
        head.state,
        head.last_event_id
      )
      and private.catalog_launch_curation_record_is_valid(record.id)
  ) = 1
$$;

create or replace function private.catalog_ingredient_is_servable(
  p_ingredient_id uuid
)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.ingredients as ingredient
    join public.catalog_sources as source
      on source.id = ingredient.source_id
     and source.source_key = ingredient.source
    where ingredient.id = p_ingredient_id
      and ingredient.review_status = 'reviewed'
      and ingredient.source_snapshot_date is not null
      and ingredient.source_snapshot_date <=
        (pg_catalog.now() at time zone 'UTC')::date
      and nullif(pg_catalog.btrim(coalesce(ingredient.cosing_ref, ingredient.source_url)), '') is not null
      and private.catalog_source_is_production_approved(source.id)
      and (
        ingredient.import_batch_id is null
        or (
          ingredient.import_projection_status = 'active'
          and exists (
            select 1
            from public.catalog_import_batches as batch
            where batch.id = ingredient.import_batch_id
              and batch.status = 'promoted'
          )
        )
      )
      and exists (
        select 1
        from public.product_ingredient_tokens as token
        join private.catalog_launch_curation_records as record
          on record.product_id = token.product_id
         and record.ingredient_list_id = token.ingredient_list_id
        where token.ingredient_id = ingredient.id
          and token.is_unmatched is false
          and token.match_type in ('exact', 'synonym', 'manual')
          and private.catalog_launch_curation_head_is_active(token.product_id)
      )
  )
$$;

create or replace function private.catalog_product_is_servable(
  p_product_id uuid
)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.products as product
    where product.id = p_product_id
      and product.region = 'US'
      and product.status = 'active'
      and product.review_status = 'reviewed'
      and product.last_reviewed_at is not null
      and product.last_reviewed_at <= pg_catalog.now()
      and product.quality_grade in ('verified', 'usable')
      and product.recommendation_eligible is true
      and product.unresolved_correction_count = 0
      and nullif(pg_catalog.btrim(product.source_ref), '') is not null
      and product.source_snapshot_date is not null
      and product.source_snapshot_date <=
        (pg_catalog.now() at time zone 'UTC')::date
      and private.catalog_source_is_production_approved(product.source_id)
      and private.catalog_launch_curation_head_is_active(product.id)
      and not exists (
        select 1
        from public.catalog_corrections as correction
        where correction.product_id = product.id
          and correction.status in ('triaged', 'accepted')
          and correction.operator_reviewed_at is not null
          and correction.operator_reviewed_at <= pg_catalog.now()
          and nullif(pg_catalog.btrim(correction.operator_reviewed_by), '') is not null
          and nullif(pg_catalog.btrim(correction.operator_review_note), '') is not null
      )
  )
$$;

create or replace function private.catalog_ingredient_list_is_servable(
  p_ingredient_list_id uuid,
  p_product_id uuid
)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.product_ingredient_lists as ingredient_list
    join private.catalog_launch_curation_records as record
      on record.ingredient_list_id = ingredient_list.id
     and record.product_id = ingredient_list.product_id
    join private.catalog_launch_curation_heads as head
      on head.product_id = record.product_id
     and head.territory = 'US'
     and head.state = 'active'
     and head.curation_record_id = record.id
    where ingredient_list.id = p_ingredient_list_id
      and ingredient_list.product_id = p_product_id
      and ingredient_list.review_status = 'reviewed'
      and private.catalog_source_is_production_approved(ingredient_list.source_id)
      and private.catalog_product_is_servable(ingredient_list.product_id)
  )
$$;

create or replace function private.catalog_brand_is_servable(p_brand_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.brands as brand
    join public.products as product on product.brand_id = brand.id
    where brand.id = p_brand_id
      and brand.review_status = 'reviewed'
      and private.catalog_source_is_production_approved(brand.source_id)
      and private.catalog_product_is_servable(product.id)
  )
$$;

revoke all on function private.catalog_launch_curation_head_is_active(uuid)
  from public, anon, authenticated, service_role;
revoke all on function private.catalog_ingredient_is_servable(uuid)
  from public, anon, authenticated, service_role;
revoke all on function private.catalog_product_is_servable(uuid)
  from public, anon, authenticated, service_role;
revoke all on function private.catalog_ingredient_list_is_servable(uuid, uuid)
  from public, anon, authenticated, service_role;
revoke all on function private.catalog_brand_is_servable(uuid)
  from public, anon, authenticated, service_role;
grant execute on function private.catalog_ingredient_is_servable(uuid)
  to authenticated;
grant execute on function private.catalog_product_is_servable(uuid)
  to authenticated;
grant execute on function private.catalog_ingredient_list_is_servable(uuid, uuid)
  to authenticated;
grant execute on function private.catalog_brand_is_servable(uuid)
  to authenticated;

create or replace view public.catalog_servable_products
with (security_invoker = true)
as
select
  products.id,
  products.barcode,
  products.name,
  products.brand,
  products.category,
  products.region,
  products.default_pao_months,
  products.source,
  products.source_id as catalog_source_id,
  products.source_ref,
  products.source_url,
  products.source_snapshot_date,
  products.quality_grade,
  products.review_status,
  products.data_quality_score,
  products.ingredient_parse_status,
  products.ingredient_parse_confidence,
  pg_catalog.jsonb_build_object(
    'id', sources.id,
    'display_name', sources.display_name,
    'source_key', sources.source_key,
    'attribution_text', sources.attribution_text,
    'attribution_url', sources.attribution_url
  ) as catalog_sources,
  coalesce((
    select pg_catalog.jsonb_agg(
      pg_catalog.jsonb_build_object(
        'pao_months', freshness.pao_months,
        'pao_source', freshness.pao_source,
        'expiry_date', freshness.expiry_date,
        'expiry_source', freshness.expiry_source,
        'region', freshness.region,
        'source_id', freshness.source_id,
        'review_status', freshness.review_status,
        'created_at', freshness.created_at
      ) order by freshness.created_at desc, freshness.id
    )
    from public.product_pao_expiry as freshness
    where freshness.product_id = products.id
      and freshness.review_status = 'reviewed'
      and nullif(pg_catalog.btrim(freshness.reviewed_by), '') is not null
      and freshness.region = products.region
      and private.catalog_source_is_production_approved(freshness.source_id)
  ), '[]'::jsonb) as product_pao_expiry
from public.products as products
join public.catalog_sources as sources on sources.id = products.source_id
where private.catalog_product_is_servable(products.id);

comment on view public.catalog_servable_products is
  'Service-only catalog boundary requiring one exact active sealed CAT-03 curation head.';
revoke all on public.catalog_servable_products
  from public, anon, authenticated, service_role;

create or replace view public.recommendable_catalog_products
with (security_invoker = true)
as
select product.*
from public.products as product
where private.catalog_product_is_servable(product.id);

-- Re-declare both service read lanes in this forward migration so future
-- readers cannot mistake their earlier definitions for a weaker publication
-- boundary.  The only service-role execution retained is receipt-free product
-- serving through the exact active-head view.
create or replace function public.lookup_catalog_product_by_barcode(
  p_barcode text
)
returns table (
  id uuid,
  barcode text,
  name text,
  brand text,
  category text,
  region text,
  default_pao_months integer,
  source text,
  catalog_source_id uuid,
  source_ref text,
  source_url text,
  source_snapshot_date date,
  quality_grade text,
  review_status text,
  data_quality_score numeric,
  ingredient_parse_status text,
  ingredient_parse_confidence numeric,
  catalog_sources jsonb,
  product_pao_expiry jsonb
)
language sql
stable
security definer
set search_path = ''
as $$
  select
    product.id,
    product.barcode,
    product.name,
    product.brand,
    product.category,
    product.region,
    product.default_pao_months,
    product.source,
    product.catalog_source_id,
    product.source_ref,
    product.source_url,
    product.source_snapshot_date,
    product.quality_grade,
    product.review_status,
    product.data_quality_score,
    product.ingredient_parse_status,
    product.ingredient_parse_confidence,
    product.catalog_sources,
    product.product_pao_expiry
  from public.product_barcodes as mapping
  join public.catalog_servable_products as product
    on product.id = mapping.product_id
  where mapping.barcode = p_barcode
    and mapping.barcode = product.barcode
    and mapping.review_status = 'reviewed'
    and mapping.source_id = product.catalog_source_id
    and private.catalog_source_is_production_approved(mapping.source_id)
  limit 1
$$;

comment on function public.lookup_catalog_product_by_barcode(text) is
  'Service-only exact barcode lookup requiring one live exact CAT-03 curation head.';
revoke all on function public.lookup_catalog_product_by_barcode(text)
  from public, anon, authenticated, service_role;
grant execute on function public.lookup_catalog_product_by_barcode(text)
  to service_role;

create or replace function public.search_catalog_products(
  p_query text,
  p_limit integer default 10
)
returns table (
  id uuid,
  barcode text,
  name text,
  brand text,
  category text,
  region text,
  default_pao_months integer,
  source text,
  catalog_source_id uuid,
  source_ref text,
  source_url text,
  source_snapshot_date date,
  quality_grade text,
  review_status text,
  data_quality_score numeric,
  ingredient_parse_status text,
  ingredient_parse_confidence numeric,
  catalog_sources jsonb,
  product_pao_expiry jsonb
)
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_query text;
  v_pattern text;
  v_limit integer := least(greatest(coalesce(p_limit, 10), 1), 20);
begin
  v_query := pg_catalog.left(
    pg_catalog.lower(
      pg_catalog.regexp_replace(
        pg_catalog.btrim(
          pg_catalog.replace(
            pg_catalog.translate(coalesce(p_query, ''), '%_,()', '     '),
            pg_catalog.chr(92),
            ' '
          )
        ),
        '[[:space:]]+',
        ' ',
        'g'
      )
    ),
    80
  );
  if pg_catalog.char_length(v_query) < 2 then
    return;
  end if;
  v_pattern := '%' || v_query || '%';
  return query
  select
    product.id,
    product.barcode,
    product.name,
    product.brand,
    product.category,
    product.region,
    product.default_pao_months,
    product.source,
    product.catalog_source_id,
    product.source_ref,
    product.source_url,
    product.source_snapshot_date,
    product.quality_grade,
    product.review_status,
    product.data_quality_score,
    product.ingredient_parse_status,
    product.ingredient_parse_confidence,
    product.catalog_sources,
    product.product_pao_expiry
  from public.catalog_servable_products as product
  where pg_catalog.lower(product.name) like v_pattern
     or pg_catalog.lower(coalesce(product.brand, '')) like v_pattern
  order by product.data_quality_score desc,
    pg_catalog.lower(product.name), product.id
  limit v_limit;
end;
$$;

comment on function public.search_catalog_products(text, integer) is
  'Service-only catalog search requiring one live exact CAT-03 curation head.';
revoke all on function public.search_catalog_products(text, integer)
  from public, anon, authenticated, service_role;
grant execute on function public.search_catalog_products(text, integer)
  to service_role;

drop policy if exists "products_read_servable" on public.products;
create policy "products_read_servable" on public.products
  for select to authenticated using (private.catalog_product_is_servable(id));

drop policy if exists "product_barcodes_read_servable" on public.product_barcodes;
create policy "product_barcodes_read_servable" on public.product_barcodes
  for select to authenticated using (
    review_status = 'reviewed'
    and private.catalog_source_is_production_approved(source_id)
    and private.catalog_product_is_servable(product_id)
    and exists (
      select 1 from public.products as parent_product
      where parent_product.id = product_barcodes.product_id
        and parent_product.source_id = product_barcodes.source_id
        and parent_product.barcode = product_barcodes.barcode
    )
  );

drop policy if exists "ingredients_read_servable" on public.ingredients;
create policy "ingredients_read_servable" on public.ingredients
  for select to authenticated using (private.catalog_ingredient_is_servable(id));

drop policy if exists "ingredient_synonyms_read_servable" on public.ingredient_synonyms;
create policy "ingredient_synonyms_read_servable" on public.ingredient_synonyms
  for select to authenticated using (
    review_status = 'reviewed'
    and private.catalog_source_is_production_approved(source_id)
    and private.catalog_ingredient_is_servable(ingredient_id)
  );

drop policy if exists "product_ingredient_lists_read_servable" on public.product_ingredient_lists;
create policy "product_ingredient_lists_read_servable" on public.product_ingredient_lists
  for select to authenticated using (
    private.catalog_ingredient_list_is_servable(id, product_id)
  );

drop policy if exists "product_ingredients_read_servable" on public.product_ingredients;
create policy "product_ingredients_read_servable" on public.product_ingredients
  for select to authenticated using (
    private.catalog_source_is_production_approved(source_id)
    and private.catalog_ingredient_list_is_servable(ingredient_list_id, product_id)
    and private.catalog_ingredient_is_servable(ingredient_id)
  );

drop policy if exists "product_ingredient_tokens_read_servable" on public.product_ingredient_tokens;
create policy "product_ingredient_tokens_read_servable" on public.product_ingredient_tokens
  for select to authenticated using (
    private.catalog_source_is_production_approved(source_id)
    and private.catalog_ingredient_list_is_servable(ingredient_list_id, product_id)
    and ingredient_id is not null
    and private.catalog_ingredient_is_servable(ingredient_id)
  );

drop policy if exists "product_active_bands_read_servable" on public.product_active_bands;
create policy "product_active_bands_read_servable" on public.product_active_bands
  for select to authenticated using (
    review_status = 'reviewed'
    and private.catalog_source_is_production_approved(source_id)
    and private.catalog_product_is_servable(product_id)
    and ingredient_id is not null
    and private.catalog_ingredient_is_servable(ingredient_id)
  );

drop policy if exists "product_pao_expiry_read_servable" on public.product_pao_expiry;
create policy "product_pao_expiry_read_servable" on public.product_pao_expiry
  for select to authenticated using (
    review_status = 'reviewed'
    and nullif(pg_catalog.btrim(reviewed_by), '') is not null
    and region = 'US'
    and private.catalog_source_is_production_approved(source_id)
    and private.catalog_product_is_servable(product_id)
  );

drop policy if exists "brands_read_servable" on public.brands;
create policy "brands_read_servable" on public.brands
  for select to authenticated using (private.catalog_brand_is_servable(id));

drop policy if exists "ingredient_tag_assignments_read_servable" on public.ingredient_tag_assignments;
create policy "ingredient_tag_assignments_read_servable" on public.ingredient_tag_assignments
  for select to authenticated using (
    review_status = 'reviewed'
    and private.catalog_source_is_production_approved(source_id)
    and private.catalog_ingredient_is_servable(ingredient_id)
  );

-- Active-only is not reviewed publication authority. These global clinical
-- rule/content relations still contain (or could later receive) rows without
-- B-DERM evidence. The mobile launch uses production-gated bundled copies;
-- future database publication must install a separate evidence-bound global
-- authority instead of inheriting a CAT03 per-product mutation root.
drop policy if exists "conflict_rules_read_active" on public.conflict_rules;
drop policy if exists "sequencing_rules_read_active" on public.sequencing_rules;
drop policy if exists "creator_stacks_select_active" on public.creator_stacks;
drop policy if exists "creator_stack_items_select_all" on public.creator_stack_items;

-- Private curation authority is not an API surface. FORCE RLS is defense in
-- depth; there are intentionally no policies or service-role mutation grants.
alter table private.catalog_launch_curation_campaigns enable row level security;
alter table private.catalog_launch_curation_campaigns force row level security;
alter table private.catalog_launch_curation_records enable row level security;
alter table private.catalog_launch_curation_records force row level security;
alter table private.catalog_launch_curation_product_mutations enable row level security;
alter table private.catalog_launch_curation_product_mutations force row level security;
alter table private.catalog_launch_curation_events enable row level security;
alter table private.catalog_launch_curation_events force row level security;
alter table private.catalog_launch_curation_heads enable row level security;
alter table private.catalog_launch_curation_heads force row level security;
alter table private.catalog_launch_curation_campaign_release_events
  enable row level security;
alter table private.catalog_launch_curation_campaign_release_events
  force row level security;
alter table private.catalog_launch_curation_campaign_release_heads
  enable row level security;
alter table private.catalog_launch_curation_campaign_release_heads
  force row level security;

revoke all on table private.catalog_launch_curation_campaigns,
  private.catalog_launch_curation_records,
  private.catalog_launch_curation_product_mutations,
  private.catalog_launch_curation_events,
  private.catalog_launch_curation_heads,
  private.catalog_launch_curation_campaign_release_events,
  private.catalog_launch_curation_campaign_release_heads
from public, anon, authenticated, service_role;

-- Secret/service keys bypass RLS.  Remove every direct catalog serving grant,
-- including grants inherited through PUBLIC; the two bounded SECURITY DEFINER
-- lookup/search RPCs above are the only service read lanes.
revoke select on table public.products,
  public.product_barcodes,
  public.ingredients,
  public.ingredient_synonyms,
  public.ingredient_tag_assignments,
  public.product_ingredient_lists,
  public.product_ingredients,
  public.product_ingredient_tokens,
  public.product_active_bands,
  public.product_pao_expiry,
  public.brands
from public, anon, service_role;
grant select on table public.products,
  public.product_barcodes,
  public.ingredients,
  public.ingredient_synonyms,
  public.ingredient_tag_assignments,
  public.product_ingredient_lists,
  public.product_ingredients,
  public.product_ingredient_tokens,
  public.product_active_bands,
  public.product_pao_expiry,
  public.brands
to authenticated;
revoke select on table public.catalog_sources,
  public.product_categories,
  public.ingredient_tag_definitions,
  public.ingredient_tags,
  public.ingredient_pao_defaults,
  public.conflict_rules,
  public.sequencing_rules,
  public.creator_stacks,
  public.creator_stack_items
from public, anon, authenticated, service_role;
revoke select on public.recommendable_catalog_products
from public, anon, authenticated, service_role;
revoke all on schema private from public, anon, authenticated, service_role;
