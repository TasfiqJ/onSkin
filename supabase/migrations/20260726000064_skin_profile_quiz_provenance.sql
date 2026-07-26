-- =============================================================================
-- 0064 - CORE-01 exact skin-profile quiz provenance
-- =============================================================================
-- The existing version-1 rows remain byte-for-byte legacy data. Version 2 is
-- admitted only when every stored output is tied to the exact current,
-- professionally unapproved quiz contract. Raw answers and answer hashes are
-- deliberately absent: the server retains only the user's profile outputs.

begin;

alter table public.skin_profiles
  add column dspt text,
  add column oily_dry_basis_points integer,
  add column sensitive_resistant_basis_points integer,
  add column pigmented_non_basis_points integer,
  add column wrinkled_tight_basis_points integer,
  add column quiz_contract_id text,
  add column quiz_content_version text,
  add column quiz_scoring_version text,
  add column quiz_output_schema_version integer,
  add column quiz_content_sha256 text,
  add column quiz_scoring_sha256 text,
  add column quiz_contract_sha256 text,
  add column quiz_review_status text,
  add column quiz_pole_tie_rule text;

alter table public.skin_profiles
  -- NOT VALID preserves any already-stored unknown-version row for an explicit
  -- cutover/remediation decision, while PostgreSQL still enforces the check on
  -- every new insert or update after this migration. New clients cannot invent
  -- a future schema version that no reader understands.
  add constraint skin_profiles_quiz_supported_version
  check (version in (1, 2))
  not valid,
  -- The pre-0064 schema did not reserve version 2, so an existing client- or
  -- attacker-written row may already use that value without provenance. Keep
  -- every v2 check NOT VALID for the same forward-upgrade reason: PostgreSQL
  -- enforces each check on all post-migration inserts/updates, while a legacy
  -- collision cannot abort deployment and remains invisible to exact readers
  -- pending explicit remediation.
  add constraint skin_profiles_quiz_v2_provenance_coherent
  check (
    coalesce(
      (
        version = 2
        and quiz_contract_id = 'urn:routinekind:onboarding:skin-profile'
        and quiz_content_version = 'draft-2026-07-04'
        and quiz_scoring_version = 'draft-1'
        and quiz_output_schema_version = 1
        and quiz_content_sha256 =
          'be00ee6008ca03fbcb53e7256432cd044e6131e9aecd5bf90809b2a57cde39bb'
        and quiz_scoring_sha256 =
          'ffd16579edad35b21377244c41af69419248faa3f8f2238183c58a5a8893c893'
        and quiz_contract_sha256 =
          '95022003f5dfa1fff5e95b846a9d48ef6ecc9dc97af341fb311afaa9aadd1c16'
        and quiz_review_status = 'launch-blocked'
        and quiz_pole_tie_rule =
          'raw_score_greater_than_or_equal_to_zero_uses_positive_pole'
        and dspt is not null
        and oily_dry_basis_points is not null
        and sensitive_resistant_basis_points is not null
        and pigmented_non_basis_points is not null
        and wrinkled_tight_basis_points is not null
      )
      or (
        version <> 2
        and dspt is null
        and oily_dry_basis_points is null
        and sensitive_resistant_basis_points is null
        and pigmented_non_basis_points is null
        and wrinkled_tight_basis_points is null
        and quiz_contract_id is null
        and quiz_content_version is null
        and quiz_scoring_version is null
        and quiz_output_schema_version is null
        and quiz_content_sha256 is null
        and quiz_scoring_sha256 is null
        and quiz_contract_sha256 is null
        and quiz_review_status is null
        and quiz_pole_tie_rule is null
      ),
      false
    )
  )
  not valid,
  add constraint skin_profiles_quiz_v2_scores_coherent
  check (
    version <> 2
    or coalesce(
      (
        oily_dry = any (array[-4, -2, -1, 0, 1, 2, 3]::integer[])
        and sensitive_resistant =
          any (array[-4, -2, -1, 0, 1, 2, 3, 4]::integer[])
        and pigmented_non =
          any (array[-4, -2, -1, 0, 1, 2, 3, 4]::integer[])
        and wrinkled_tight =
          any (array[-4, -2, -1, 0, 1, 2, 3, 4]::integer[])
        and oily_dry_basis_points = (oily_dry + 4) * 1250
        and sensitive_resistant_basis_points =
          (sensitive_resistant + 4) * 1250
        and pigmented_non_basis_points = (pigmented_non + 4) * 1250
        and wrinkled_tight_basis_points = (wrinkled_tight + 4) * 1250
        and dspt =
          (case when oily_dry >= 0 then 'O' else 'D' end)
          || (case when sensitive_resistant >= 0 then 'S' else 'R' end)
          || (case when pigmented_non >= 0 then 'P' else 'N' end)
          || (case when wrinkled_tight >= 0 then 'W' else 'T' end)
      ),
      false
    )
  )
  not valid,
  add constraint skin_profiles_quiz_v2_profile_coherent
  check (
    version <> 2
    or coalesce(
      (
        fitzpatrick between 1 and 6
        and monk_tone between 1 and 10
        and pregnancy_status in ('none', 'pregnant', 'breastfeeding', 'prefer_not')
        and completed_at is not null
        and pg_catalog.isfinite(completed_at)
        and pg_catalog.array_ndims(goals) = 1
        and pg_catalog.array_lower(goals, 1) = 1
        and pg_catalog.cardinality(goals) between 1 and 2
        and goals <@ array[
          'clear_skin',
          'even_tone',
          'hydration',
          'anti_aging',
          'sensitivity',
          'barrier_repair'
        ]::text[]
        and pg_catalog.array_position(goals, null) is null
        and (
          pg_catalog.cardinality(goals) = 1
          or goals[1] is distinct from goals[2]
        )
        and sensitivities in (
          array[]::text[],
          array['fragrance']::text[],
          array['essential_oils']::text[],
          array['alcohol']::text[],
          array['fragrance', 'essential_oils']::text[],
          array['fragrance', 'alcohol']::text[],
          array['essential_oils', 'alcohol']::text[],
          array['fragrance', 'essential_oils', 'alcohol']::text[]
        )
      ),
      false
    )
  )
  not valid;

commit;
