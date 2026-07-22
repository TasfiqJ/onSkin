begin;

-- The CAT-03 membership validator resolves every sealed dependency back to its
-- CAT-02 staged record by batch and record digest.  This exact index keeps that
-- owner-only validation lookup bounded for launch-sized campaigns.
create index catalog_import_staged_records_batch_record_sha256_idx
  on private.catalog_import_staged_records (batch_id, record_sha256);

comment on index private.catalog_import_staged_records_batch_record_sha256_idx is
  'CAT-03 exact CAT-02 membership readback by batch and sealed record digest.';

-- Curation planning resolves each retained dependency to the exact immutable
-- CAT-02 revision that produced it.  The legacy uniqueness key starts with
-- entity identity and revision number, so it cannot bound this batch/record
-- authority lookup as the import ledger grows.
create index catalog_import_entity_revisions_membership_authority_idx
  on private.catalog_import_entity_revisions (
    batch_id,
    staged_record_id,
    entity_type,
    entity_id,
    revision_action
  ) include (projection_sha256);

comment on index
  private.catalog_import_entity_revisions_membership_authority_idx is
  'CAT-03 exact retained-dependency authority lookup with covered projection digest.';

-- The retained-membership proof joins the exact staged record to its immutable
-- promotion effect.  The lifecycle uniqueness key starts with the campaign-wide
-- promotion id, which made PostgreSQL walk every earlier effect in a 2,001-row
-- batch before it could apply the staged-record join.  Lead with the record
-- identity so each proof remains bounded regardless of batch size.
create index catalog_import_batch_effects_membership_authority_idx
  on private.catalog_import_batch_effects (
    staged_record_id,
    batch_id,
    promotion_event_id,
    entity_type,
    entity_id,
    effect_type
  ) include (after_sha256);

comment on index
  private.catalog_import_batch_effects_membership_authority_idx is
  'CAT-03 exact retained-dependency promotion-effect lookup with covered digest.';

-- Apply the caller-sealed CAT-02 digest while resolving the staged record, not
-- only after materializing the full authority proof.  This is the same equality
-- the function already enforced at its return boundary; pushing it into the
-- join lets the exact batch/digest index above avoid a campaign-wide walk.
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
     and staged.record_sha256 = p_cat02_stage_record_sha256
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

-- Reassert owner-only execution after replacement instead of relying on the
-- pre-upgrade ACL having remained pristine.
revoke all on function
  private.catalog_launch_curation_membership_evidence_sha256(
    uuid, uuid, text, text, text, text, uuid, text, text, text, text, text
  )
  from public, anon, authenticated, service_role;

-- Preserve every per-row safety decision from 0058.  The campaign-wide root
-- comparison is intentionally absent here: recomputing a 2,001-record root for
-- every row made a single governed bulk insert quadratic.
create or replace function private.guard_catalog_launch_curation_record_insert()
returns trigger
language plpgsql
volatile
security definer
set search_path = ''
as $$
begin
  if tg_op <> 'INSERT' or tg_level <> 'ROW' then
    raise exception 'CATALOG_LAUNCH_CURATION_RECORD_GATE_CLOSED'
      using errcode = '55000';
  end if;

  -- Match release_catalog_launch_curation_campaign exactly: global first,
  -- then campaign.  The release-event check remains inside both locks, so an
  -- insert cannot pass concurrently with the campaign sealing transition.
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
    raise exception 'CATALOG_LAUNCH_CURATION_RELEASED_CAMPAIGN_SEALED'
      using errcode = '55000';
  end if;
  if new.served_state_mutation_root_sha256 is distinct from
       private.catalog_launch_current_served_state_mutation_root_sha256(
         new.product_id
       ) then
    raise exception 'CATALOG_LAUNCH_CURATION_SERVED_STATE_MUTATION_ROOT_STALE'
      using errcode = '55000';
  end if;
  if private.catalog_launch_curation_record_is_structurally_valid(new.id)
       is not true then
    raise exception 'CATALOG_LAUNCH_CURATION_RECORD_GATE_CLOSED'
      using errcode = '55000';
  end if;
  return new;
end;
$$;

-- AFTER STATEMENT transition-table validation observes the complete inserted
-- set.  It acquires the same global lock and then campaign locks in UUID order,
-- so one statement spanning multiple campaigns cannot introduce a lock-order
-- inversion.  Empty INSERT ... SELECT statements are intentional no-ops.
create or replace function
  private.guard_catalog_launch_curation_record_insert_statement()
returns trigger
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v_campaign_id uuid;
  v_expected_record_count integer;
  v_actual_record_count bigint;
  v_expected_mutation_root_set_sha256 text;
  v_actual_mutation_root_set_sha256 text;
begin
  if tg_op <> 'INSERT' or tg_level <> 'STATEMENT' then
    raise exception 'CATALOG_LAUNCH_CURATION_SERVED_STATE_MUTATION_ROOT_SET_INVALID'
      using errcode = '55000';
  end if;

  if not exists (select 1 from inserted_catalog_curation_records) then
    return null;
  end if;

  perform pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended('catalog-launch-curation-global', 0)
  );

  for v_campaign_id in
    select distinct inserted_record.campaign_id
    from inserted_catalog_curation_records as inserted_record
    order by inserted_record.campaign_id
  loop
    perform pg_catalog.pg_advisory_xact_lock(
      pg_catalog.hashtextextended(
        'catalog-launch-curation-campaign:' || v_campaign_id::text, 0
      )
    );

    select
      campaign.expected_reviewed_record_count,
      campaign.served_state_mutation_root_set_sha256
    into
      v_expected_record_count,
      v_expected_mutation_root_set_sha256
    from private.catalog_launch_curation_campaigns as campaign
    where campaign.id = v_campaign_id
    for share;

    if not found then
      raise exception 'CATALOG_LAUNCH_CURATION_CAMPAIGN_NOT_FOUND'
        using errcode = '55000';
    end if;
    if v_expected_record_count is null
       or v_expected_record_count < 1
       or v_expected_mutation_root_set_sha256 is null
       or v_expected_mutation_root_set_sha256 !~ '^[a-f0-9]{64}$' then
      raise exception 'CATALOG_LAUNCH_CURATION_SERVED_STATE_MUTATION_ROOT_SET_INVALID'
        using errcode = '55000';
    end if;

    select pg_catalog.count(*)
    into strict v_actual_record_count
    from private.catalog_launch_curation_records as record
    where record.campaign_id = v_campaign_id;

    if v_actual_record_count > v_expected_record_count then
      raise exception 'CATALOG_LAUNCH_CURATION_SERVED_STATE_MUTATION_ROOT_SET_INVALID'
        using errcode = '55000';
    end if;

    if v_actual_record_count = v_expected_record_count then
      v_actual_mutation_root_set_sha256 :=
        private.catalog_launch_curation_campaign_stored_mutation_root_set_sha256(
          v_campaign_id
        );
      if v_expected_mutation_root_set_sha256 is distinct from
           v_actual_mutation_root_set_sha256 then
        raise exception 'CATALOG_LAUNCH_CURATION_SERVED_STATE_MUTATION_ROOT_SET_INVALID'
          using errcode = '55000';
      end if;
    end if;
  end loop;

  return null;
end;
$$;

revoke all on function private.guard_catalog_launch_curation_record_insert()
  from public, anon, authenticated, service_role;
revoke all on function
  private.guard_catalog_launch_curation_record_insert_statement()
  from public, anon, authenticated, service_role;

drop trigger catalog_launch_curation_records_insert_guard
  on private.catalog_launch_curation_records;
create trigger catalog_launch_curation_records_insert_guard
  after insert on private.catalog_launch_curation_records
  for each row execute function
    private.guard_catalog_launch_curation_record_insert();

create trigger catalog_launch_curation_records_insert_statement_guard
  after insert on private.catalog_launch_curation_records
  referencing new table as inserted_catalog_curation_records
  for each statement execute function
    private.guard_catalog_launch_curation_record_insert_statement();

comment on function private.guard_catalog_launch_curation_record_insert() is
  'Per-row CAT-03 release sealing, live mutation-root, and structural authority guard.';
comment on function
  private.guard_catalog_launch_curation_record_insert_statement() is
  'Per-statement CAT-03 complete-count and sealed mutation-root-set guard in deterministic campaign lock order.';

-- Release-time validation used to invoke two SECURITY DEFINER predicates for
-- every record, and activation invoked the live predicate again for every
-- missing product head.  Validate the exact same predicates as one set so
-- campaign invariants and source approvals are materialized once.  The scalar
-- predicates remain the authority for ordinary one-record activation and
-- serving checks.
create or replace function
  private.catalog_launch_curation_campaign_record_validity(
    p_campaign_id uuid
  )
returns table (
  record_id uuid,
  activation_decision text,
  structurally_valid boolean,
  live_valid boolean
)
language sql
stable
security definer
set search_path = ''
as $$
  with campaign_authority as materialized (
    select
      campaign.*,
      campaign.territory = 'US'
        and campaign.review_valid_until > pg_catalog.now()
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
          ) as invariant_is_valid
    from private.catalog_launch_curation_campaigns as campaign
    where campaign.id = p_campaign_id
  ),
  approved_sources as materialized (
    select source.id as source_id
    from public.catalog_sources as source
    where private.catalog_source_is_production_approved(source.id)
  ),
  structurally_valid_records as materialized (
    select record.id as valid_record_id
    from private.catalog_launch_curation_records as record
    join campaign_authority as campaign
      on campaign.id = record.campaign_id
    join public.products as product on product.id = record.product_id
    join public.catalog_import_batches as batch
      on batch.id = record.import_batch_id
    join private.catalog_import_staged_records as staged
      on staged.id = record.import_staged_record_id
    join public.product_categories as category
      on category.id = product.category_id
    join public.product_ingredient_lists as ingredient_list
      on ingredient_list.id = record.ingredient_list_id
    where campaign.invariant_is_valid
      and record.served_state_mutation_root_sha256 =
        private.catalog_launch_current_served_state_mutation_root_sha256(
          record.product_id
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
      and record.eligibility_policy_sha256 =
        campaign.eligibility_policy_sha256
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
              'cat03.activate.' || campaign.release_id || '.' ||
                record.product_record_sha256,
              'initial_launch_catalog_activation',
              record.activation_planned_at
            )
          and record.activation_signature_sha256 is not null
        )
      )
      and batch.status = 'promoted'
      and batch.artifact_kind = 'production'
      and batch.territory = 'US'
      and batch.qa_blocker_count = 0
      and batch.qa_warning_count = 0
      and batch.source_approval_sha256 = record.source_approval_sha256
      and batch.qa_report_sha256 = record.source_qa_sha256
      and product.source_id = record.source_id
      and product.import_batch_id = record.import_batch_id
      and product.import_staged_record_id = record.import_staged_record_id
      and product.import_record_sha256 = record.product_record_sha256
      and product.import_record_ordinal = staged.record_ordinal
      and staged.batch_id = record.import_batch_id
      and staged.record_kind = 'product'
      and staged.disposition = 'accepted'
      and staged.sealed_at is not null
      and staged.record_sha256 = record.product_record_sha256
      and staged.record_sha256 = private.catalog_import_sha256_text(
        private.catalog_import_canonical_json(staged.normalized_payload)
      )
      and product.barcode = record.barcode
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
        (
          record.regulatory_classification = 'cosmetic'
          and category.is_sunscreen is false
          and category.is_otc_drug_candidate is false
          and record.regulatory_review_evidence_sha256 is null
        )
        or (
          record.regulatory_classification in (
            'otc_drug', 'combination_cosmetic_drug'
          )
          and category.is_otc_drug_candidate is true
          and record.regulatory_review_evidence_sha256 ~ '^[a-f0-9]{64}$'
        )
      )
      and pg_catalog.lower(record.regulatory_reviewer_ids[1]) <>
        pg_catalog.lower(record.curated_by)
      and not (record.regulatory_reviewer_ids[1] = any(campaign.reviewer_ids))
      and record.regulatory_signature_set_sha256 <>
        campaign.reviewer_signature_set_sha256
      and record.regulatory_signature_set_sha256 <>
        record.reviewer_signature_set_sha256
      and record.activation_operator_id <> record.regulatory_reviewer_ids[1]
      and not (record.activation_operator_id = any(campaign.reviewer_ids))
      and pg_catalog.lower(record.activation_operator_id) <>
        pg_catalog.lower(record.curated_by)
  ),
  live_valid_records as materialized (
    select record.id as valid_record_id
    from structurally_valid_records as structural
    join private.catalog_launch_curation_records as record
      on record.id = structural.valid_record_id
    join campaign_authority as campaign
      on campaign.id = record.campaign_id
    join public.products as product on product.id = record.product_id
    join public.catalog_sources as source on source.id = record.source_id
    join public.brands as brand on brand.id = product.brand_id
    join public.product_categories as category
      on category.id = product.category_id
    join public.product_barcodes as barcode_mapping
      on barcode_mapping.barcode = record.barcode
    join public.product_ingredient_lists as ingredient_list
      on ingredient_list.id = record.ingredient_list_id
    where record.activation_decision = 'approve_activation'
      and record.activation_planned_at <= pg_catalog.now()
      and campaign.beta_evidence_contract_id =
        'catalog-beta-shelf-corpus-v1'
      and product.import_projection_status = 'active'
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
      and product.ingredient_quality_score >=
        campaign.minimum_ingredient_quality_score
      and product.barcode_quality_score >= campaign.minimum_barcode_quality_score
      and product.category_quality_score >=
        campaign.minimum_category_quality_score
      and product.ingredient_parse_status = 'reviewed'
      and product.ingredient_parse_confidence >=
        campaign.minimum_parse_confidence
      and nullif(pg_catalog.btrim(product.parser_version), '') is not null
      and product.recommendation_eligible is true
      and product.unresolved_correction_count = 0
      and nullif(pg_catalog.btrim(product.source_ref), '') is not null
      and product.source_snapshot_date is not null
      and product.source_snapshot_date <=
        (pg_catalog.now() at time zone 'UTC')::date
      and source.source_key = product.source
      and exists (
        select 1 from approved_sources as approved
        where approved.source_id = source.id
      )
      and brand.review_status = 'reviewed'
      and exists (
        select 1 from approved_sources as approved
        where approved.source_id = brand.source_id
      )
      and brand.normalized_name =
        private.catalog_import_normalize_label(product.brand)
      and category.id = product.category
      and category.review_status = 'reviewed'
      and (
        record.regulatory_classification = 'cosmetic'
        or (
          record.regulatory_review_evidence_sha256 <>
            all(campaign.reviewer_evidence_sha256s)
          and record.regulatory_review_evidence_sha256 <>
            all(record.reviewer_evidence_sha256s)
        )
      )
      and record.regulatory_signature_set_sha256 ~ '^[a-f0-9]{64}$'
      and pg_catalog.cardinality(record.regulatory_reviewer_ids) = 1
      and (
        record.activation_decision = 'withhold_activation'
        or (
          record.database_activation_request_sha256 is distinct from
            record.regulatory_review_evidence_sha256
          and record.database_activation_request_sha256 <>
            all(campaign.reviewer_evidence_sha256s)
          and record.activation_signature_sha256 <>
            record.regulatory_signature_set_sha256
          and record.activation_signature_sha256 <>
            campaign.reviewer_signature_set_sha256
        )
      )
      and barcode_mapping.product_id = product.id
      and barcode_mapping.source_id = product.source_id
      and barcode_mapping.review_status = 'reviewed'
      and barcode_mapping.confidence = 1
      and barcode_mapping.import_batch_id = record.import_batch_id
      and barcode_mapping.import_staged_record_id =
        record.import_staged_record_id
      and barcode_mapping.import_record_ordinal = product.import_record_ordinal
      and barcode_mapping.import_record_sha256 = record.product_record_sha256
      and barcode_mapping.import_projection_status = 'active'
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
      and ingredient_list.import_staged_record_id =
        record.import_staged_record_id
      and ingredient_list.import_record_ordinal = product.import_record_ordinal
      and ingredient_list.import_record_sha256 = record.product_record_sha256
      and ingredient_list.import_projection_status = 'active'
      and exists (
        select 1 from approved_sources as approved
        where approved.source_id = ingredient_list.source_id
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
        left join public.ingredients as ingredient
          on ingredient.id = token.ingredient_id
        where token.product_id = product.id
          and token.ingredient_list_id = ingredient_list.id
          and (
            token.ingredient_id is null
            or token.is_unmatched is true
            or token.match_type not in ('exact', 'synonym', 'manual')
            or token.match_confidence < campaign.minimum_token_match_confidence
            or token.source_id is null
            or not exists (
              select 1 from approved_sources as approved
              where approved.source_id = token.source_id
            )
            or ingredient.id is null
            or ingredient.review_status <> 'reviewed'
            or ingredient.source_id is null
            or not exists (
              select 1 from approved_sources as approved
              where approved.source_id = ingredient.source_id
            )
            or ingredient.source_snapshot_date is null
            or ingredient.source_snapshot_date >
              (pg_catalog.now() at time zone 'UTC')::date
            or nullif(pg_catalog.btrim(coalesce(
              ingredient.cosing_ref,
              ingredient.source_url
            )), '') is null
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
                and link.match_confidence >=
                  campaign.minimum_token_match_confidence
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
            or not exists (
              select 1 from approved_sources as approved
              where approved.source_id = link.source_id
            )
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
            or not exists (
              select 1 from approved_sources as approved
              where approved.source_id = band.source_id
            )
            or not exists (
              select 1
              from public.ingredients as ingredient
              where ingredient.id = band.ingredient_id
                and ingredient.review_status = 'reviewed'
                and exists (
                  select 1 from approved_sources as approved
                  where approved.source_id = ingredient.source_id
                )
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
            or not exists (
              select 1 from approved_sources as approved
              where approved.source_id = freshness.source_id
            )
          )
      )
      and not exists (
        select 1
        from public.catalog_corrections as correction
        where correction.product_id = product.id
          and correction.status in ('triaged', 'accepted')
          and correction.operator_reviewed_at is not null
          and correction.operator_reviewed_at <= pg_catalog.now()
          and nullif(pg_catalog.btrim(
            correction.operator_reviewed_by
          ), '') is not null
          and nullif(pg_catalog.btrim(
            correction.operator_review_note
          ), '') is not null
      )
  )
  select
    record.id,
    record.activation_decision,
    structural.valid_record_id is not null,
    live.valid_record_id is not null
  from private.catalog_launch_curation_records as record
  left join structurally_valid_records as structural
    on structural.valid_record_id = record.id
  left join live_valid_records as live
    on live.valid_record_id = record.id
  where record.campaign_id = p_campaign_id
$$;

revoke all on function
  private.catalog_launch_curation_campaign_record_validity(uuid)
  from public, anon, authenticated, service_role;

-- Preserve the exact 0058 scalar validators under owner-only names. Existing
-- constraints keep their original function OIDs; ordinary calls to the public
-- names below delegate to these exact implementations unless the owner-only
-- release wrapper has installed a transaction-local validated-set cache.
alter function
  private.catalog_launch_curation_record_is_structurally_valid(uuid)
  rename to catalog_launch_curation_record_is_structurally_valid_v0058;
alter function private.catalog_launch_curation_record_is_valid(uuid)
  rename to catalog_launch_curation_record_is_valid_v0058;

revoke all on function
  private.catalog_launch_curation_record_is_structurally_valid_v0058(uuid)
  from public, anon, authenticated, service_role;
revoke all on function
  private.catalog_launch_curation_record_is_valid_v0058(uuid)
  from public, anon, authenticated, service_role;

create or replace function
  private.catalog_launch_curation_record_is_structurally_valid(
    p_curation_record_id uuid
  )
returns boolean
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_cache_key text := pg_catalog.current_setting(
    'app.catalog_launch_curation_release_validation_cache', true
  );
  v_cached boolean;
  v_rows bigint := 0;
  v_release_owner name;
begin
  select role.rolname
    into v_release_owner
  from pg_catalog.pg_proc as procedure
  join pg_catalog.pg_roles as role on role.oid = procedure.proowner
  where procedure.oid =
    'public.release_catalog_launch_curation_campaign(uuid,text,text,text,text,text,text,text)'::regprocedure;

  if nullif(v_cache_key, '') is not null
     and session_user = v_release_owner then
    begin
      execute
        'select cache.structurally_valid
           from pg_temp.catalog_launch_curation_release_validation_cache as cache
          where cache.cache_key = $1 and cache.record_id = $2'
        into v_cached
        using v_cache_key, p_curation_record_id;
      get diagnostics v_rows = row_count;
    exception when undefined_table or undefined_column then
      v_rows := 0;
    end;
    if v_rows = 1 then
      return coalesce(v_cached, false);
    end if;
  end if;

  return private.catalog_launch_curation_record_is_structurally_valid_v0058(
    p_curation_record_id
  );
end;
$$;

create or replace function private.catalog_launch_curation_record_is_valid(
  p_curation_record_id uuid
)
returns boolean
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_cache_key text := pg_catalog.current_setting(
    'app.catalog_launch_curation_release_validation_cache', true
  );
  v_cached boolean;
  v_rows bigint := 0;
  v_release_owner name;
begin
  select role.rolname
    into v_release_owner
  from pg_catalog.pg_proc as procedure
  join pg_catalog.pg_roles as role on role.oid = procedure.proowner
  where procedure.oid =
    'public.release_catalog_launch_curation_campaign(uuid,text,text,text,text,text,text,text)'::regprocedure;

  if nullif(v_cache_key, '') is not null
     and session_user = v_release_owner then
    begin
      execute
        'select cache.live_valid
           from pg_temp.catalog_launch_curation_release_validation_cache as cache
          where cache.cache_key = $1 and cache.record_id = $2'
        into v_cached
        using v_cache_key, p_curation_record_id;
      get diagnostics v_rows = row_count;
    exception when undefined_table or undefined_column then
      v_rows := 0;
    end;
    if v_rows = 1 then
      return coalesce(v_cached, false);
    end if;
  end if;

  return private.catalog_launch_curation_record_is_valid_v0058(
    p_curation_record_id
  );
end;
$$;

revoke all on function
  private.catalog_launch_curation_record_is_structurally_valid(uuid)
  from public, anon, authenticated, service_role;
revoke all on function private.catalog_launch_curation_record_is_valid(uuid)
  from public, anon, authenticated, service_role;

-- Keep the reviewed 0058 release transition byte-for-byte available behind an
-- owner-only name. The wrapper acquires the same global -> campaign locks,
-- materializes exact validity once, and lets the retained transition reuse it.
-- Runtime roles cannot forge the cache path: release and scalar validators are
-- owner-only, and cache reads additionally require the release owner's
-- session_user plus a random transaction-local key.
alter function public.release_catalog_launch_curation_campaign(
  uuid, text, text, text, text, text, text, text
)
  rename to release_catalog_launch_curation_campaign_v0058;

revoke all on function public.release_catalog_launch_curation_campaign_v0058(
  uuid, text, text, text, text, text, text, text
)
  from public, anon, authenticated, service_role;

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
  v_cache_key text := gen_random_uuid()::text;
  v_previous_cache_key text := pg_catalog.current_setting(
    'app.catalog_launch_curation_release_validation_cache', true
  );
begin
  -- Preserve 0058 input errors for a null campaign without attempting a null
  -- advisory lock.
  if p_campaign_id is null then
    return query
    select *
    from public.release_catalog_launch_curation_campaign_v0058(
      p_campaign_id,
      p_operation_key,
      p_actor,
      p_reason_code,
      p_expected_campaign_sha256,
      p_expected_record_set_sha256,
      p_expected_served_state_mutation_root_set_sha256,
      p_expected_authorization_set_sha256
    );
    return;
  end if;

  perform pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended('catalog-launch-curation-global', 0)
  );
  perform pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended(
      'catalog-launch-curation-campaign:' || p_campaign_id::text,
      0
    )
  );

  -- Replay performs no per-record activation loop, so retain its original
  -- checks directly and avoid building an unnecessary cache.
  if exists (
    select 1
    from private.catalog_launch_curation_campaign_release_events as event
    where event.operation_key = p_operation_key
  ) then
    return query
    select *
    from public.release_catalog_launch_curation_campaign_v0058(
      p_campaign_id,
      p_operation_key,
      p_actor,
      p_reason_code,
      p_expected_campaign_sha256,
      p_expected_record_set_sha256,
      p_expected_served_state_mutation_root_set_sha256,
      p_expected_authorization_set_sha256
    );
    return;
  end if;

  drop table if exists pg_temp.catalog_launch_curation_release_validation_cache;
  create temporary table catalog_launch_curation_release_validation_cache (
    cache_key text not null,
    record_id uuid primary key,
    activation_decision text not null,
    structurally_valid boolean not null,
    live_valid boolean not null
  ) on commit drop;

  insert into pg_temp.catalog_launch_curation_release_validation_cache (
    cache_key,
    record_id,
    activation_decision,
    structurally_valid,
    live_valid
  )
  select
    v_cache_key,
    validity.record_id,
    validity.activation_decision,
    validity.structurally_valid,
    validity.live_valid
  from private.catalog_launch_curation_campaign_record_validity(
    p_campaign_id
  ) as validity;

  perform pg_catalog.set_config(
    'app.catalog_launch_curation_release_validation_cache',
    v_cache_key,
    true
  );

  return query
  select *
  from public.release_catalog_launch_curation_campaign_v0058(
    p_campaign_id,
    p_operation_key,
    p_actor,
    p_reason_code,
    p_expected_campaign_sha256,
    p_expected_record_set_sha256,
    p_expected_served_state_mutation_root_set_sha256,
    p_expected_authorization_set_sha256
  );

  perform pg_catalog.set_config(
    'app.catalog_launch_curation_release_validation_cache',
    coalesce(v_previous_cache_key, ''),
    true
  );
  drop table if exists pg_temp.catalog_launch_curation_release_validation_cache;
  return;
exception when others then
  perform pg_catalog.set_config(
    'app.catalog_launch_curation_release_validation_cache',
    coalesce(v_previous_cache_key, ''),
    true
  );
  drop table if exists pg_temp.catalog_launch_curation_release_validation_cache;
  raise;
end;
$$;

comment on function public.release_catalog_launch_curation_campaign(
  uuid, text, text, text, text, text, text, text
) is
  'Migration-owner-only atomic US campaign release with one exact materialized validation pass and the retained 0058 transition/replay contract.';

revoke all on function public.release_catalog_launch_curation_campaign(
  uuid, text, text, text, text, text, text, text
)
  from public, anon, authenticated, service_role;

commit;
