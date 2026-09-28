begin;

create extension if not exists pgtap with schema extensions;
set local search_path = extensions, public, pg_catalog;

select plan(13);

select is(
  (
    select convalidated
    from pg_catalog.pg_constraint
    where conrelid = 'public.skin_profiles'::pg_catalog.regclass
      and conname = 'skin_profiles_quiz_v2_provenance_coherent'
  ),
  false,
  'the successor keeps the non-validating forward-upgrade posture'
);

select ok(
  (
    select pg_catalog.pg_get_constraintdef(oid)
    from pg_catalog.pg_constraint
    where conrelid = 'public.skin_profiles'::pg_catalog.regclass
      and conname = 'skin_profiles_quiz_v2_provenance_coherent'
  ) like '%4ba91e7339b91aebd0592f73624064bba7e6f3e5eab0b29913d411e8ab60e72c%',
  'the database pins the exact newly versioned Layerwell combined digest'
);

create temporary table core01_quiz_successor
  (like public.skin_profiles including defaults including constraints)
  on commit drop;

create function pg_temp.core01_quiz_successor_accepts(
  p_contract_id text,
  p_content_version text,
  p_scoring_version text,
  p_content_sha256 text,
  p_scoring_sha256 text,
  p_contract_sha256 text,
  p_review_status text default 'launch-blocked',
  p_pole_tie_rule text default
    'raw_score_greater_than_or_equal_to_zero_uses_positive_pole'
)
returns boolean
language plpgsql
set search_path = ''
as $$
begin
  insert into pg_temp.core01_quiz_successor (
    user_id,
    oily_dry,
    sensitive_resistant,
    pigmented_non,
    wrinkled_tight,
    fitzpatrick,
    monk_tone,
    sensitivities,
    pregnancy_status,
    goals,
    completed_at,
    version,
    dspt,
    oily_dry_basis_points,
    sensitive_resistant_basis_points,
    pigmented_non_basis_points,
    wrinkled_tight_basis_points,
    quiz_contract_id,
    quiz_content_version,
    quiz_scoring_version,
    quiz_output_schema_version,
    quiz_content_sha256,
    quiz_scoring_sha256,
    quiz_contract_sha256,
    quiz_review_status,
    quiz_pole_tie_rule
  ) values (
    pg_catalog.gen_random_uuid(),
    0, 0, 0, 0,
    3,
    5,
    array[]::text[],
    'none',
    array['clear_skin']::text[],
    '2026-09-21T00:00:00Z'::timestamptz,
    2,
    'OSPW',
    5000, 5000, 5000, 5000,
    p_contract_id,
    p_content_version,
    p_scoring_version,
    1,
    p_content_sha256,
    p_scoring_sha256,
    p_contract_sha256,
    p_review_status,
    p_pole_tie_rule
  );
  return true;
exception when check_violation then
  return false;
end;
$$;

select ok(
  pg_temp.core01_quiz_successor_accepts(
    'urn:routinekind:onboarding:skin-profile',
    'draft-2026-07-04',
    'draft-1',
    'be00ee6008ca03fbcb53e7256432cd044e6131e9aecd5bf90809b2a57cde39bb',
    'ffd16579edad35b21377244c41af69419248faa3f8f2238183c58a5a8893c893',
    '95022003f5dfa1fff5e95b846a9d48ef6ecc9dc97af341fb311afaa9aadd1c16'
  ),
  'the exact pre-rebrand client tuple remains writable'
);

select ok(
  pg_temp.core01_quiz_successor_accepts(
    'urn:layerwell:onboarding:skin-profile',
    'draft-2026-07-04',
    'draft-1',
    '8398b025f7ebfa8cd823c180ba6d98475554b82651970b569c736d662c7c7f2f',
    'be3a05c5c9494d0976868c4d4e34c4c71fd01b8be19f9207e0198b930e1b982a',
    'c434e4f031d2d9d18218a0ccddcecf3fff182e8208367375aee16c574c814007'
  ),
  'the exact interim Layerwell client tuple remains writable'
);

select ok(
  pg_temp.core01_quiz_successor_accepts(
    'urn:layerwell:onboarding:skin-profile',
    'draft-2026-09-21-layerwell',
    'draft-2',
    'f5169de7f1985063f97efc70cd740de4be63cada27f2041de36e0c864aa310e0',
    '7598479bfc4eff6e186e7aaafcb8959630ca4fbf7a49e65fe2c9554c7e8747ef',
    '4ba91e7339b91aebd0592f73624064bba7e6f3e5eab0b29913d411e8ab60e72c'
  ),
  'the new exact Layerwell client tuple is writable'
);

select ok(
  not pg_temp.core01_quiz_successor_accepts(
    'urn:layerwell:onboarding:skin-profile',
    'draft-2026-07-04',
    'draft-1',
    'be00ee6008ca03fbcb53e7256432cd044e6131e9aecd5bf90809b2a57cde39bb',
    'ffd16579edad35b21377244c41af69419248faa3f8f2238183c58a5a8893c893',
    '95022003f5dfa1fff5e95b846a9d48ef6ecc9dc97af341fb311afaa9aadd1c16'
  ),
  'the incoherent 0064 rebrand pairing is not admitted for new writes'
);

select ok(
  not pg_temp.core01_quiz_successor_accepts(
    'urn:routinekind:onboarding:skin-profile',
    'draft-2026-07-04',
    'draft-1',
    '8398b025f7ebfa8cd823c180ba6d98475554b82651970b569c736d662c7c7f2f',
    'be3a05c5c9494d0976868c4d4e34c4c71fd01b8be19f9207e0198b930e1b982a',
    'c434e4f031d2d9d18218a0ccddcecf3fff182e8208367375aee16c574c814007'
  ),
  'a prior identity cannot borrow Layerwell hashes'
);

select ok(
  not pg_temp.core01_quiz_successor_accepts(
    'urn:layerwell:onboarding:skin-profile',
    'draft-2026-07-04',
    'draft-1',
    '8398b025f7ebfa8cd823c180ba6d98475554b82651970b569c736d662c7c7f2f',
    '7598479bfc4eff6e186e7aaafcb8959630ca4fbf7a49e65fe2c9554c7e8747ef',
    'c434e4f031d2d9d18218a0ccddcecf3fff182e8208367375aee16c574c814007'
  ),
  'hashes cannot be crossed between exact tuples'
);

select ok(
  not pg_temp.core01_quiz_successor_accepts(
    'urn:layerwell:onboarding:skin-profile',
    'draft-2026-07-04',
    'draft-1',
    'f5169de7f1985063f97efc70cd740de4be63cada27f2041de36e0c864aa310e0',
    '7598479bfc4eff6e186e7aaafcb8959630ca4fbf7a49e65fe2c9554c7e8747ef',
    '4ba91e7339b91aebd0592f73624064bba7e6f3e5eab0b29913d411e8ab60e72c'
  ),
  'new semantic hashes require new version labels'
);

select ok(
  not pg_temp.core01_quiz_successor_accepts(
    'urn:layerwell:onboarding:skin-profile',
    'draft-2026-09-21-layerwell',
    'draft-2',
    'f5169de7f1985063f97efc70cd740de4be63cada27f2041de36e0c864aa310e0',
    '7598479bfc4eff6e186e7aaafcb8959630ca4fbf7a49e65fe2c9554c7e8747ef',
    '4ba91e7339b91aebd0592f73624064bba7e6f3e5eab0b29913d411e8ab60e72c',
    'approved'
  ),
  'no tuple may claim professional approval'
);

select ok(
  not pg_temp.core01_quiz_successor_accepts(
    'urn:layerwell:onboarding:skin-profile',
    'draft-2026-09-21-layerwell',
    'draft-2',
    'f5169de7f1985063f97efc70cd740de4be63cada27f2041de36e0c864aa310e0',
    '7598479bfc4eff6e186e7aaafcb8959630ca4fbf7a49e65fe2c9554c7e8747ef',
    '4ba91e7339b91aebd0592f73624064bba7e6f3e5eab0b29913d411e8ab60e72c',
    'launch-blocked',
    'negative_pole'
  ),
  'the deterministic tie rule remains fixed'
);

select lives_ok(
  $$insert into pg_temp.core01_quiz_successor (user_id, version)
    values (pg_catalog.gen_random_uuid(), 1)$$,
  'legacy version 1 rows remain admissible without quiz provenance'
);

select is(
  (
    select count(*)
    from pg_temp.core01_quiz_successor
    where version = 2
  ),
  3::bigint,
  'only the three exact positive tuples were inserted'
);

select * from finish();
rollback;
