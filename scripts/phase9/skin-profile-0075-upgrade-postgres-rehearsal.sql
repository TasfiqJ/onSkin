\set ON_ERROR_STOP on

-- Runs only inside the disposable PostgreSQL rehearsal database. First execute
-- the exact historical 0064 upgrade fixture: it leaves a pre-0064 malformed
-- row and a post-0064 Layerwell + pre-rebrand-hash row in public.skin_profiles.
\ir skin-profile-0064-upgrade-postgres-rehearsal.sql

create temporary table core01_0075_before as
select id, pg_catalog.row_to_json(profile)::text as profile_json
from public.skin_profiles as profile;

-- Apply the exact forward migration bytes, never a test-only reimplementation.
\ir ../../supabase/migrations/20260921000075_skin_profile_quiz_contract_successor.sql

do $$
declare
  v_constraint_name text;
  v_rejected boolean := false;
begin
  if (
    select pg_catalog.count(*) from core01_0075_before
  ) <> 2 or exists (
    select 1
    from core01_0075_before as prior
    left join public.skin_profiles as current on current.id = prior.id
    where pg_catalog.row_to_json(current)::text is distinct from prior.profile_json
  ) then
    raise exception 'CORE01_0075_PRIOR_ROWS_CHANGED';
  end if;

  if (
    select convalidated
    from pg_catalog.pg_constraint
    where conrelid = 'public.skin_profiles'::pg_catalog.regclass
      and conname = 'skin_profiles_quiz_v2_provenance_coherent'
  ) is distinct from false then
    raise exception 'CORE01_0075_CONSTRAINT_VALIDATED_PRIOR_ROWS';
  end if;

  -- A previously admitted but canonically incoherent row stays stored under
  -- NOT VALID, while any new update of that still-incoherent tuple is denied.
  begin
    update public.skin_profiles
       set quiz_contract_id = quiz_contract_id
     where id = '64000000-0000-4000-8000-000000000002';
  exception when check_violation then
    get stacked diagnostics v_constraint_name = constraint_name;
    if v_constraint_name is distinct from
      'skin_profiles_quiz_v2_provenance_coherent' then
      raise exception 'CORE01_0075_WRONG_QUARANTINE_CHECK: %', v_constraint_name;
    end if;
    v_rejected := true;
  end;
  if not v_rejected then
    raise exception 'CORE01_0075_INCOHERENT_ROW_UPDATABLE';
  end if;
end;
$$;

create function pg_temp.core01_0075_try_copy(
  p_id uuid,
  p_contract_id text,
  p_content_version text,
  p_scoring_version text,
  p_content_sha256 text,
  p_scoring_sha256 text,
  p_contract_sha256 text
)
returns boolean
language plpgsql
set search_path = ''
as $$
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
  )
  select
    p_id,
    pg_catalog.gen_random_uuid(),
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
    p_contract_id,
    p_content_version,
    p_scoring_version,
    quiz_output_schema_version,
    p_content_sha256,
    p_scoring_sha256,
    p_contract_sha256,
    quiz_review_status,
    quiz_pole_tie_rule
  from public.skin_profiles
  where id = '64000000-0000-4000-8000-000000000002';
  return true;
exception when check_violation then
  return false;
end;
$$;

do $$
begin
  if pg_temp.core01_0075_try_copy(
    '75000000-0000-4000-8000-000000000001',
    'urn:layerwell:onboarding:skin-profile',
    'draft-2026-07-04',
    'draft-1',
    'be00ee6008ca03fbcb53e7256432cd044e6131e9aecd5bf90809b2a57cde39bb',
    'ffd16579edad35b21377244c41af69419248faa3f8f2238183c58a5a8893c893',
    '95022003f5dfa1fff5e95b846a9d48ef6ecc9dc97af341fb311afaa9aadd1c16'
  ) then
    raise exception 'CORE01_0075_INCOHERENT_NEW_ROW_ADMITTED';
  end if;

  if not pg_temp.core01_0075_try_copy(
    '75000000-0000-4000-8000-000000000002',
    'urn:routinekind:onboarding:skin-profile',
    'draft-2026-07-04',
    'draft-1',
    'be00ee6008ca03fbcb53e7256432cd044e6131e9aecd5bf90809b2a57cde39bb',
    'ffd16579edad35b21377244c41af69419248faa3f8f2238183c58a5a8893c893',
    '95022003f5dfa1fff5e95b846a9d48ef6ecc9dc97af341fb311afaa9aadd1c16'
  ) then
    raise exception 'CORE01_0075_OLD_CLIENT_REJECTED';
  end if;

  if not pg_temp.core01_0075_try_copy(
    '75000000-0000-4000-8000-000000000003',
    'urn:layerwell:onboarding:skin-profile',
    'draft-2026-07-04',
    'draft-1',
    '8398b025f7ebfa8cd823c180ba6d98475554b82651970b569c736d662c7c7f2f',
    'be3a05c5c9494d0976868c4d4e34c4c71fd01b8be19f9207e0198b930e1b982a',
    'c434e4f031d2d9d18218a0ccddcecf3fff182e8208367375aee16c574c814007'
  ) then
    raise exception 'CORE01_0075_INTERIM_CLIENT_REJECTED';
  end if;

  if not pg_temp.core01_0075_try_copy(
    '75000000-0000-4000-8000-000000000004',
    'urn:layerwell:onboarding:skin-profile',
    'draft-2026-09-21-layerwell',
    'draft-2',
    'f5169de7f1985063f97efc70cd740de4be63cada27f2041de36e0c864aa310e0',
    '7598479bfc4eff6e186e7aaafcb8959630ca4fbf7a49e65fe2c9554c7e8747ef',
    '4ba91e7339b91aebd0592f73624064bba7e6f3e5eab0b29913d411e8ab60e72c'
  ) then
    raise exception 'CORE01_0075_CURRENT_CLIENT_REJECTED';
  end if;

  if (
    select pg_catalog.count(*) from public.skin_profiles
  ) <> 5 then
    raise exception 'CORE01_0075_UNEXPECTED_ROW_COUNT';
  end if;
end;
$$;

select 'skin-profile-0075-upgrade-postgres-rehearsal: pass' as result;
