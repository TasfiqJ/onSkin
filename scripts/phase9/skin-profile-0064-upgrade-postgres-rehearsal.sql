\set ON_ERROR_STOP on

-- Dedicated forward-upgrade rehearsal for migration 0064. The pre-0064
-- version column did not reserve version 2, so this fixture deliberately
-- stores a row that violates every new v2 contract before executing the exact
-- checked-in migration bytes.
create extension if not exists pgcrypto;

create table public.skin_profiles (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null,
  oily_dry integer,
  sensitive_resistant integer,
  pigmented_non integer,
  wrinkled_tight integer,
  fitzpatrick integer check (fitzpatrick between 1 and 6),
  monk_tone integer check (monk_tone between 1 and 10),
  sensitivities text[] not null default '{}',
  pregnancy_status text
    check (
      pregnancy_status in (
        'none',
        'pregnant',
        'breastfeeding',
        'prefer_not'
      )
    ),
  goals text[] not null default '{}',
  completed_at timestamptz,
  version integer not null default 1,
  created_at timestamptz not null default pg_catalog.now()
);

insert into public.skin_profiles (
  id,
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
  created_at
) values (
  '64000000-0000-4000-8000-000000000001',
  '64000000-0000-4000-8000-000000000101',
  987,
  -987,
  654,
  -654,
  3,
  5,
  array['legacy_free_form'],
  'none',
  array['legacy_free_form'],
  '2026-07-25 12:00:00+00',
  2,
  '2026-07-25 12:00:00+00'
);

-- Execute the exact source that will run on hosted databases.
\ir ../../supabase/migrations/20260726000064_skin_profile_quiz_provenance.sql

do $$
declare
  v_unvalidated_constraints text[];
begin
  if not exists (
    select 1
    from public.skin_profiles
    where id = '64000000-0000-4000-8000-000000000001'
      and version = 2
      and oily_dry = 987
      and sensitive_resistant = -987
      and pigmented_non = 654
      and wrinkled_tight = -654
      and sensitivities = array['legacy_free_form']::text[]
      and goals = array['legacy_free_form']::text[]
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
  ) then
    raise exception 'CORE01_0064_PREEXISTING_V2_ROW_NOT_PRESERVED';
  end if;

  select pg_catalog.array_agg(constraint_record.conname order by constraint_record.conname)
    into v_unvalidated_constraints
  from pg_catalog.pg_constraint as constraint_record
  where constraint_record.conrelid = 'public.skin_profiles'::regclass
    and constraint_record.conname = any (array[
      'skin_profiles_quiz_supported_version',
      'skin_profiles_quiz_v2_profile_coherent',
      'skin_profiles_quiz_v2_provenance_coherent',
      'skin_profiles_quiz_v2_scores_coherent'
    ]::text[])
    and not constraint_record.convalidated;

  if v_unvalidated_constraints is distinct from array[
    'skin_profiles_quiz_supported_version',
    'skin_profiles_quiz_v2_profile_coherent',
    'skin_profiles_quiz_v2_provenance_coherent',
    'skin_profiles_quiz_v2_scores_coherent'
  ]::text[] then
    raise exception
      'CORE01_0064_UPGRADE_CONSTRAINT_VALIDATION_POSTURE_INVALID: %',
      v_unvalidated_constraints;
  end if;
end;
$$;

create function pg_temp.assert_v2_check_rejected(
  p_id uuid,
  p_expected_constraint text,
  p_content_sha256 text default
    'be00ee6008ca03fbcb53e7256432cd044e6131e9aecd5bf90809b2a57cde39bb',
  p_oily_dry_basis_points integer default 5000,
  p_goals text[] default array['clear_skin']::text[]
)
returns void
language plpgsql
set search_path = ''
as $$
declare
  v_actual_constraint text;
begin
  begin
    insert into public.skin_profiles (
      id,
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
      p_id,
      '64000000-0000-4000-8000-000000000102',
      0,
      -1,
      2,
      -2,
      3,
      5,
      array[]::text[],
      'none',
      p_goals,
      '2026-07-26 12:00:00+00',
      2,
      'ORPT',
      p_oily_dry_basis_points,
      3750,
      7500,
      2500,
      'urn:layerwell:onboarding:skin-profile',
      'draft-2026-07-04',
      'draft-1',
      1,
      p_content_sha256,
      'ffd16579edad35b21377244c41af69419248faa3f8f2238183c58a5a8893c893',
      '95022003f5dfa1fff5e95b846a9d48ef6ecc9dc97af341fb311afaa9aadd1c16',
      'launch-blocked',
      'raw_score_greater_than_or_equal_to_zero_uses_positive_pole'
    );
  exception when check_violation then
    get stacked diagnostics v_actual_constraint = constraint_name;
    if v_actual_constraint is distinct from p_expected_constraint then
      raise exception
        'CORE01_0064_WRONG_CHECK_CONSTRAINT: expected %, received %',
        p_expected_constraint,
        v_actual_constraint;
    end if;
    return;
  end;

  delete from public.skin_profiles where id = p_id;
  raise exception
    'CORE01_0064_INVALID_V2_WRITE_ACCEPTED: %',
    p_expected_constraint;
end;
$$;

-- A fully coherent new v2 write remains admitted after the non-validating
-- forward upgrade.
insert into public.skin_profiles (
  id,
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
  '64000000-0000-4000-8000-000000000002',
  '64000000-0000-4000-8000-000000000102',
  0,
  -1,
  2,
  -2,
  3,
  5,
  array[]::text[],
  'none',
  array['clear_skin']::text[],
  '2026-07-26 12:00:00+00',
  2,
  'ORPT',
  5000,
  3750,
  7500,
  2500,
  'urn:layerwell:onboarding:skin-profile',
  'draft-2026-07-04',
  'draft-1',
  1,
  'be00ee6008ca03fbcb53e7256432cd044e6131e9aecd5bf90809b2a57cde39bb',
  'ffd16579edad35b21377244c41af69419248faa3f8f2238183c58a5a8893c893',
  '95022003f5dfa1fff5e95b846a9d48ef6ecc9dc97af341fb311afaa9aadd1c16',
  'launch-blocked',
  'raw_score_greater_than_or_equal_to_zero_uses_positive_pole'
);

-- Each independently testable v2 contract rejects a new malformed write even
-- though the constraint remains NOT VALID for the legacy collision.
select pg_temp.assert_v2_check_rejected(
  '64000000-0000-4000-8000-000000000003',
  'skin_profiles_quiz_v2_provenance_coherent',
  pg_catalog.repeat('0', 64)
);
select pg_temp.assert_v2_check_rejected(
  '64000000-0000-4000-8000-000000000004',
  'skin_profiles_quiz_v2_scores_coherent',
  p_oily_dry_basis_points => 5001
);
select pg_temp.assert_v2_check_rejected(
  '64000000-0000-4000-8000-000000000005',
  'skin_profiles_quiz_v2_profile_coherent',
  p_goals => array['legacy_free_form']::text[]
);

do $$
declare
  v_actual_constraint text;
begin
  begin
    insert into public.skin_profiles (
      id,
      user_id,
      version
    ) values (
      '64000000-0000-4000-8000-000000000006',
      '64000000-0000-4000-8000-000000000102',
      3
    );
  exception when check_violation then
    get stacked diagnostics v_actual_constraint = constraint_name;
    if v_actual_constraint is distinct from
      'skin_profiles_quiz_supported_version' then
      raise exception
        'CORE01_0064_WRONG_VERSION_CONSTRAINT: %',
        v_actual_constraint;
    end if;
    return;
  end;

  delete from public.skin_profiles
  where id = '64000000-0000-4000-8000-000000000006';
  raise exception 'CORE01_0064_UNKNOWN_VERSION_WRITE_ACCEPTED';
end;
$$;

do $$
begin
  if (
    select pg_catalog.count(*)
    from public.skin_profiles
  ) <> 2 then
    raise exception 'CORE01_0064_REJECTED_WRITE_SURVIVED';
  end if;
end;
$$;

select 'skin-profile-0064-upgrade-postgres-rehearsal: pass' as result;
