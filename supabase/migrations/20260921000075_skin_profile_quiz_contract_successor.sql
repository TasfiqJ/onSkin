-- =============================================================================
-- CORE-01: admit the exact Layerwell quiz contract without erasing old receipts
-- =============================================================================
-- Migration 0064 originally admitted RoutineKind + the be00/ffd1/9502 hashes.
-- The identity-only rebrand changed its checked-in ID to Layerwell but left
-- those old hashes in place. No canonical manifest can produce that pairing.
-- Deployed clients may also carry the intermediate Layerwell + 8398/be3a/c434
-- tuple with the old version labels. Preserve both honest historic client
-- tuples, but make the new client version explicit and keep mismatched pairs
-- closed. Existing incoherent rows remain untouched under NOT VALID; they are
-- not repaired or made eligible for the exact-current app reader.

begin;
set local lock_timeout = '5s';

alter table public.skin_profiles
  add constraint skin_profiles_quiz_v2_provenance_coherent_successor
  check (
    coalesce(
      (
        version = 2
        and (
          (
            quiz_contract_id = 'urn:routinekind:onboarding:skin-profile'
            and quiz_content_version = 'draft-2026-07-04'
            and quiz_scoring_version = 'draft-1'
            and quiz_content_sha256 =
              'be00ee6008ca03fbcb53e7256432cd044e6131e9aecd5bf90809b2a57cde39bb'
            and quiz_scoring_sha256 =
              'ffd16579edad35b21377244c41af69419248faa3f8f2238183c58a5a8893c893'
            and quiz_contract_sha256 =
              '95022003f5dfa1fff5e95b846a9d48ef6ecc9dc97af341fb311afaa9aadd1c16'
          )
          or (
            quiz_contract_id = 'urn:layerwell:onboarding:skin-profile'
            and quiz_content_version = 'draft-2026-07-04'
            and quiz_scoring_version = 'draft-1'
            and quiz_content_sha256 =
              '8398b025f7ebfa8cd823c180ba6d98475554b82651970b569c736d662c7c7f2f'
            and quiz_scoring_sha256 =
              'be3a05c5c9494d0976868c4d4e34c4c71fd01b8be19f9207e0198b930e1b982a'
            and quiz_contract_sha256 =
              'c434e4f031d2d9d18218a0ccddcecf3fff182e8208367375aee16c574c814007'
          )
          or (
            quiz_contract_id = 'urn:layerwell:onboarding:skin-profile'
            and quiz_content_version = 'draft-2026-09-21-layerwell'
            and quiz_scoring_version = 'draft-2'
            and quiz_content_sha256 =
              'f5169de7f1985063f97efc70cd740de4be63cada27f2041de36e0c864aa310e0'
            and quiz_scoring_sha256 =
              '7598479bfc4eff6e186e7aaafcb8959630ca4fbf7a49e65fe2c9554c7e8747ef'
            and quiz_contract_sha256 =
              '4ba91e7339b91aebd0592f73624064bba7e6f3e5eab0b29913d411e8ab60e72c'
          )
        )
        and quiz_output_schema_version = 1
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
  ) not valid;

alter table public.skin_profiles
  drop constraint skin_profiles_quiz_v2_provenance_coherent;

alter table public.skin_profiles
  rename constraint skin_profiles_quiz_v2_provenance_coherent_successor
  to skin_profiles_quiz_v2_provenance_coherent;

commit;
