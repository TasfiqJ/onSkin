begin;

create extension if not exists pgtap with schema extensions;
set local search_path = extensions, public, pg_catalog;

select plan(48);

select is(
  (select count(*) from supabase_migrations.schema_migrations),
  69::bigint,
  'CORE-01 runs against the exact 69-migration source history'
);

select is(
  (select max(version) from supabase_migrations.schema_migrations),
  '20260726000070'::text,
  'the migration history includes quiz provenance and reaches the Shelf/completion sync bridge head'
);

select results_eq(
  $$select
      column_name::text collate "C",
      data_type::text collate "C",
      is_nullable::text collate "C",
      (column_default is null)::boolean
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'skin_profiles'
      and column_name in (
        'dspt',
        'oily_dry_basis_points',
        'sensitive_resistant_basis_points',
        'pigmented_non_basis_points',
        'wrinkled_tight_basis_points',
        'quiz_contract_id',
        'quiz_content_version',
        'quiz_scoring_version',
        'quiz_output_schema_version',
        'quiz_content_sha256',
        'quiz_scoring_sha256',
        'quiz_contract_sha256',
        'quiz_review_status',
        'quiz_pole_tie_rule'
      )
    order by ordinal_position$$,
  $$values
    ('dspt'::text collate "C", 'text'::text collate "C", 'YES'::text collate "C", true),
    ('oily_dry_basis_points', 'integer', 'YES', true),
    ('sensitive_resistant_basis_points', 'integer', 'YES', true),
    ('pigmented_non_basis_points', 'integer', 'YES', true),
    ('wrinkled_tight_basis_points', 'integer', 'YES', true),
    ('quiz_contract_id', 'text', 'YES', true),
    ('quiz_content_version', 'text', 'YES', true),
    ('quiz_scoring_version', 'text', 'YES', true),
    ('quiz_output_schema_version', 'integer', 'YES', true),
    ('quiz_content_sha256', 'text', 'YES', true),
    ('quiz_scoring_sha256', 'text', 'YES', true),
    ('quiz_contract_sha256', 'text', 'YES', true),
    ('quiz_review_status', 'text', 'YES', true),
    ('quiz_pole_tie_rule', 'text', 'YES', true)$$,
  '0064 adds only the exact nullable, default-free derived-output and provenance columns'
);

select results_eq(
  $$select constraint_row.conname::text collate "C", constraint_row.convalidated
      from pg_catalog.pg_constraint as constraint_row
     where constraint_row.conrelid = 'public.skin_profiles'::pg_catalog.regclass
       and constraint_row.conname like 'skin_profiles_quiz_v2_%'
     order by constraint_row.conname$$,
  $$values
    ('skin_profiles_quiz_v2_profile_coherent'::text collate "C", false),
    ('skin_profiles_quiz_v2_provenance_coherent'::text, false),
    ('skin_profiles_quiz_v2_scores_coherent'::text, false)$$,
  'all three v2 checks enforce new writes without validating legacy rows during the forward migration'
);

select ok(
  (
    select pg_catalog.pg_get_constraintdef(constraint_row.oid)
      from pg_catalog.pg_constraint as constraint_row
     where constraint_row.conrelid = 'public.skin_profiles'::pg_catalog.regclass
       and constraint_row.conname = 'skin_profiles_quiz_v2_provenance_coherent'
  ) like '%urn:routinekind:onboarding:skin-profile%'
  and (
    select pg_catalog.pg_get_constraintdef(constraint_row.oid)
      from pg_catalog.pg_constraint as constraint_row
     where constraint_row.conrelid = 'public.skin_profiles'::pg_catalog.regclass
       and constraint_row.conname = 'skin_profiles_quiz_v2_provenance_coherent'
  ) like '%draft-2026-07-04%'
  and (
    select pg_catalog.pg_get_constraintdef(constraint_row.oid)
      from pg_catalog.pg_constraint as constraint_row
     where constraint_row.conrelid = 'public.skin_profiles'::pg_catalog.regclass
       and constraint_row.conname = 'skin_profiles_quiz_v2_provenance_coherent'
  ) like '%draft-1%'
  and (
    select pg_catalog.pg_get_constraintdef(constraint_row.oid)
      from pg_catalog.pg_constraint as constraint_row
     where constraint_row.conrelid = 'public.skin_profiles'::pg_catalog.regclass
       and constraint_row.conname = 'skin_profiles_quiz_v2_provenance_coherent'
  ) like '%be00ee6008ca03fbcb53e7256432cd044e6131e9aecd5bf90809b2a57cde39bb%'
  and (
    select pg_catalog.pg_get_constraintdef(constraint_row.oid)
      from pg_catalog.pg_constraint as constraint_row
     where constraint_row.conrelid = 'public.skin_profiles'::pg_catalog.regclass
       and constraint_row.conname = 'skin_profiles_quiz_v2_provenance_coherent'
  ) like '%ffd16579edad35b21377244c41af69419248faa3f8f2238183c58a5a8893c893%'
  and (
    select pg_catalog.pg_get_constraintdef(constraint_row.oid)
      from pg_catalog.pg_constraint as constraint_row
     where constraint_row.conrelid = 'public.skin_profiles'::pg_catalog.regclass
       and constraint_row.conname = 'skin_profiles_quiz_v2_provenance_coherent'
  ) like '%95022003f5dfa1fff5e95b846a9d48ef6ecc9dc97af341fb311afaa9aadd1c16%'
  and (
    select pg_catalog.pg_get_constraintdef(constraint_row.oid)
      from pg_catalog.pg_constraint as constraint_row
     where constraint_row.conrelid = 'public.skin_profiles'::pg_catalog.regclass
       and constraint_row.conname = 'skin_profiles_quiz_v2_provenance_coherent'
  ) like '%launch-blocked%'
  and (
    select pg_catalog.pg_get_constraintdef(constraint_row.oid)
      from pg_catalog.pg_constraint as constraint_row
     where constraint_row.conrelid = 'public.skin_profiles'::pg_catalog.regclass
       and constraint_row.conname = 'skin_profiles_quiz_v2_provenance_coherent'
  ) like '%raw_score_greater_than_or_equal_to_zero_uses_positive_pole%',
  'the database pins every current quiz contract value without implying professional approval'
);

select ok(
  not exists (
    select 1
      from information_schema.columns
     where table_schema = 'public'
       and table_name = 'skin_profiles'
       and (
         column_name like '%answer%'
         or column_name in ('quiz_answers', 'quiz_answer_sha256', 'quiz_answers_sha256')
       )
  ),
  'skin_profiles stores neither raw quiz answers nor answer hashes'
);

select is(
  (
    select pg_catalog.array_agg(index_row.indexname::text order by index_row.indexname)
      from pg_catalog.pg_indexes as index_row
     where index_row.schemaname = 'public'
       and index_row.tablename = 'skin_profiles'
  ),
  array['skin_profiles_pkey', 'skin_profiles_user_id_idx']::text[],
  '0064 adds no speculative skin-profile index'
);

select ok(
  (
    select relation.relrowsecurity and not relation.relforcerowsecurity
      from pg_catalog.pg_class as relation
     where relation.oid = 'public.skin_profiles'::pg_catalog.regclass
  ),
  'the existing enabled owner-scoped RLS posture remains unchanged'
);

select results_eq(
  $$select
      policyname::text collate "C",
      permissive::text collate "C",
      cmd::text collate "C"
      from pg_catalog.pg_policies
     where schemaname = 'public'
       and tablename = 'skin_profiles'
     order by policyname$$,
  $$values
    (
      'account_deletion_write_barrier_delete'::text collate "C",
      'RESTRICTIVE'::text collate "C",
      'DELETE'::text collate "C"
    ),
    ('account_deletion_write_barrier_insert', 'RESTRICTIVE', 'INSERT'),
    ('account_deletion_write_barrier_update', 'RESTRICTIVE', 'UPDATE'),
    ('apple_auth_read_barrier', 'RESTRICTIVE', 'SELECT'),
    ('health_processing_read_fence', 'RESTRICTIVE', 'SELECT'),
    ('skin_profiles_delete_own', 'PERMISSIVE', 'DELETE'),
    ('skin_profiles_insert_own', 'PERMISSIVE', 'INSERT'),
    ('skin_profiles_select_own', 'PERMISSIVE', 'SELECT'),
    ('skin_profiles_update_own', 'PERMISSIVE', 'UPDATE')$$,
  '0064 preserves the exact owner, deletion, consent, and Apple-session policy set'
);

create temporary table core01_skin_profiles
  (like public.skin_profiles including defaults including constraints)
  on commit drop;

create function pg_temp.core01_insert_v2(
  p_user_id uuid,
  p_oily_dry integer,
  p_sensitive_resistant integer,
  p_pigmented_non integer,
  p_wrinkled_tight integer,
  p_dspt text,
  p_oily_dry_basis_points integer,
  p_sensitive_resistant_basis_points integer,
  p_pigmented_non_basis_points integer,
  p_wrinkled_tight_basis_points integer,
  p_goals text[],
  p_sensitivities text[]
)
returns void
language sql
as $$
  insert into pg_temp.core01_skin_profiles (
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
    p_user_id,
    p_oily_dry,
    p_sensitive_resistant,
    p_pigmented_non,
    p_wrinkled_tight,
    3,
    5,
    p_sensitivities,
    'none',
    p_goals,
    '2026-07-26T00:00:00Z'::timestamptz,
    2,
    p_dspt,
    p_oily_dry_basis_points,
    p_sensitive_resistant_basis_points,
    p_pigmented_non_basis_points,
    p_wrinkled_tight_basis_points,
    'urn:routinekind:onboarding:skin-profile',
    'draft-2026-07-04',
    'draft-1',
    1,
    'be00ee6008ca03fbcb53e7256432cd044e6131e9aecd5bf90809b2a57cde39bb',
    'ffd16579edad35b21377244c41af69419248faa3f8f2238183c58a5a8893c893',
    '95022003f5dfa1fff5e95b846a9d48ef6ecc9dc97af341fb311afaa9aadd1c16',
    'launch-blocked',
    'raw_score_greater_than_or_equal_to_zero_uses_positive_pole'
  );
$$;

create function pg_temp.core01_check_rejected(p_statement text)
returns boolean
language plpgsql
as $$
begin
  execute p_statement;
  return false;
exception
  when check_violation then
    return true;
end;
$$;

select lives_ok(
  $$insert into pg_temp.core01_skin_profiles (
      user_id, oily_dry, sensitivities, goals, version
    ) values (
      '64000000-0000-4000-8000-000000000001', 987,
      array['legacy-free-form'], array['legacy-goal'], 1
    )$$,
  'an existing version-1 shape remains writable without backfill'
);

select results_eq(
  $$select
      version,
      oily_dry,
      pg_catalog.num_nonnulls(
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
      )::integer
    from pg_temp.core01_skin_profiles
    where user_id = '64000000-0000-4000-8000-000000000001'$$,
  $$values (1::integer, 987::integer, 0::integer)$$,
  'legacy values are preserved while every new field remains null'
);

select ok(
  pg_temp.core01_check_rejected(
    $$update pg_temp.core01_skin_profiles
         set quiz_contract_id = 'urn:routinekind:onboarding:skin-profile'
       where user_id = '64000000-0000-4000-8000-000000000001'$$
  ),
  'version 1 rejects a partially populated new provenance tuple'
);

select ok(
  pg_temp.core01_check_rejected(
    $$insert into pg_temp.core01_skin_profiles (user_id, version)
      values ('64000000-0000-4000-8000-000000000002', 3)$$
  ),
  'new rows cannot invent a future profile schema version'
);

select results_eq(
  $$select convalidated
      from pg_catalog.pg_constraint
     where conrelid = 'public.skin_profiles'::pg_catalog.regclass
       and conname = 'skin_profiles_quiz_supported_version'$$,
  $$values (false)$$,
  'the supported-version check preserves pre-migration unknown rows for explicit cutover remediation'
);

select lives_ok(
  $$select pg_temp.core01_insert_v2(
    '64000000-0000-4000-8000-000000000010',
    -4, -4, -4, -4, 'DRNT', 0, 0, 0, 0,
    array['clear_skin'], array[]::text[]
  )$$,
  'the exact minimum reachable raw scores and basis points are admitted'
);

select results_eq(
  $$select
      oily_dry, sensitive_resistant, pigmented_non, wrinkled_tight,
      dspt,
      oily_dry_basis_points, sensitive_resistant_basis_points,
      pigmented_non_basis_points, wrinkled_tight_basis_points
    from pg_temp.core01_skin_profiles
    where user_id = '64000000-0000-4000-8000-000000000010'$$,
  $$values (-4, -4, -4, -4, 'DRNT'::text, 0, 0, 0, 0)$$,
  'the minimum profile is retained exactly'
);

select lives_ok(
  $$select pg_temp.core01_insert_v2(
    '64000000-0000-4000-8000-000000000011',
    0, 0, 0, 0, 'OSPW', 5000, 5000, 5000, 5000,
    array['hydration'], array['essential_oils']
  )$$,
  'the exact zero-score tie profile is admitted'
);

select results_eq(
  $$select dspt, oily_dry_basis_points, sensitive_resistant_basis_points,
      pigmented_non_basis_points, wrinkled_tight_basis_points
    from pg_temp.core01_skin_profiles
    where user_id = '64000000-0000-4000-8000-000000000011'$$,
  $$values ('OSPW'::text, 5000, 5000, 5000, 5000)$$,
  'every zero-score tie resolves to the declared positive pole'
);

select lives_ok(
  $$select pg_temp.core01_insert_v2(
    '64000000-0000-4000-8000-000000000012',
    3, 4, 4, 4, 'OSPW', 8750, 10000, 10000, 10000,
    array['anti_aging', 'barrier_repair'],
    array['fragrance', 'essential_oils', 'alcohol']
  )$$,
  'the exact maximum reachable profile and largest canonical arrays are admitted'
);

select results_eq(
  $$select
      oily_dry, sensitive_resistant, pigmented_non, wrinkled_tight,
      dspt,
      oily_dry_basis_points, sensitive_resistant_basis_points,
      pigmented_non_basis_points, wrinkled_tight_basis_points
    from pg_temp.core01_skin_profiles
    where user_id = '64000000-0000-4000-8000-000000000012'$$,
  $$values (3, 4, 4, 4, 'OSPW'::text, 8750, 10000, 10000, 10000)$$,
  'the asymmetric oily/dry maximum and the other axis maxima remain exact'
);

select ok(
  pg_temp.core01_check_rejected(
    $$update pg_temp.core01_skin_profiles
         set quiz_contract_id = 'urn:routinekind:onboarding:other'
       where user_id = '64000000-0000-4000-8000-000000000010'$$
  ),
  'v2 rejects a different quiz contract identifier'
);

select ok(
  pg_temp.core01_check_rejected(
    $$update pg_temp.core01_skin_profiles
         set quiz_content_version = 'draft-other'
       where user_id = '64000000-0000-4000-8000-000000000010'$$
  ),
  'v2 rejects a different quiz content version'
);

select ok(
  pg_temp.core01_check_rejected(
    $$update pg_temp.core01_skin_profiles
         set quiz_scoring_version = 'draft-other'
       where user_id = '64000000-0000-4000-8000-000000000010'$$
  ),
  'v2 rejects a different quiz scoring version'
);

select ok(
  pg_temp.core01_check_rejected(
    $$update pg_temp.core01_skin_profiles
         set quiz_output_schema_version = 2
       where user_id = '64000000-0000-4000-8000-000000000010'$$
  ),
  'v2 rejects a different quiz output schema'
);

select ok(
  pg_temp.core01_check_rejected(
    $$update pg_temp.core01_skin_profiles
         set quiz_content_sha256 = repeat('0', 64)
       where user_id = '64000000-0000-4000-8000-000000000010'$$
  ),
  'v2 rejects a different quiz content hash'
);

select ok(
  pg_temp.core01_check_rejected(
    $$update pg_temp.core01_skin_profiles
         set quiz_scoring_sha256 = repeat('0', 64)
       where user_id = '64000000-0000-4000-8000-000000000010'$$
  ),
  'v2 rejects a different quiz scoring hash'
);

select ok(
  pg_temp.core01_check_rejected(
    $$update pg_temp.core01_skin_profiles
         set quiz_contract_sha256 = repeat('0', 64)
       where user_id = '64000000-0000-4000-8000-000000000010'$$
  ),
  'v2 rejects a different combined contract hash'
);

select ok(
  pg_temp.core01_check_rejected(
    $$update pg_temp.core01_skin_profiles
         set quiz_review_status = 'approved'
       where user_id = '64000000-0000-4000-8000-000000000010'$$
  ),
  'v2 cannot misrepresent the draft as professionally approved'
);

select ok(
  pg_temp.core01_check_rejected(
    $$update pg_temp.core01_skin_profiles
         set quiz_pole_tie_rule = 'negative_pole'
       where user_id = '64000000-0000-4000-8000-000000000010'$$
  ),
  'v2 rejects a different pole tie rule'
);

select ok(
  pg_temp.core01_check_rejected(
    $$update pg_temp.core01_skin_profiles
         set dspt = null
       where user_id = '64000000-0000-4000-8000-000000000010'$$
  ),
  'v2 rejects an incomplete derived-output tuple'
);

select ok(
  pg_temp.core01_check_rejected(
    $$update pg_temp.core01_skin_profiles
         set oily_dry = -3, oily_dry_basis_points = 1250
       where user_id = '64000000-0000-4000-8000-000000000010'$$
  ),
  'v2 rejects an unreachable oily/dry raw score'
);

select ok(
  pg_temp.core01_check_rejected(
    $$update pg_temp.core01_skin_profiles
         set sensitive_resistant = -3, sensitive_resistant_basis_points = 1250
       where user_id = '64000000-0000-4000-8000-000000000010'$$
  ),
  'v2 rejects an unreachable sensitive/resistant raw score'
);

select ok(
  pg_temp.core01_check_rejected(
    $$update pg_temp.core01_skin_profiles
         set pigmented_non = -3, pigmented_non_basis_points = 1250
       where user_id = '64000000-0000-4000-8000-000000000010'$$
  ),
  'v2 rejects an unreachable pigmented/non-pigmented raw score'
);

select ok(
  pg_temp.core01_check_rejected(
    $$update pg_temp.core01_skin_profiles
         set wrinkled_tight = -3, wrinkled_tight_basis_points = 1250
       where user_id = '64000000-0000-4000-8000-000000000010'$$
  ),
  'v2 rejects an unreachable wrinkled/tight raw score'
);

select ok(
  pg_temp.core01_check_rejected(
    $$update pg_temp.core01_skin_profiles
         set oily_dry_basis_points = 1
       where user_id = '64000000-0000-4000-8000-000000000010'$$
  ),
  'v2 rejects basis points that are not the exact raw-score projection'
);

select ok(
  pg_temp.core01_check_rejected(
    $$update pg_temp.core01_skin_profiles
         set dspt = 'OSPW'
       where user_id = '64000000-0000-4000-8000-000000000010'$$
  ),
  'v2 rejects a DSPT code inconsistent with negative raw scores'
);

select ok(
  pg_temp.core01_check_rejected(
    $$update pg_temp.core01_skin_profiles
         set dspt = 'DRNT'
       where user_id = '64000000-0000-4000-8000-000000000011'$$
  ),
  'v2 enforces the positive-pole DSPT rule at exact zero ties'
);

select ok(
  pg_temp.core01_check_rejected(
    $$update pg_temp.core01_skin_profiles
         set fitzpatrick = null
       where user_id = '64000000-0000-4000-8000-000000000010'$$
  ),
  'v2 requires the answered phototype output'
);

select ok(
  pg_temp.core01_check_rejected(
    $$update pg_temp.core01_skin_profiles
         set monk_tone = null
       where user_id = '64000000-0000-4000-8000-000000000010'$$
  ),
  'v2 requires the answered tone output'
);

select ok(
  pg_temp.core01_check_rejected(
    $$update pg_temp.core01_skin_profiles
         set pregnancy_status = null
       where user_id = '64000000-0000-4000-8000-000000000010'$$
  ),
  'v2 requires an exact pregnancy-status option'
);

select ok(
  pg_temp.core01_check_rejected(
    $$update pg_temp.core01_skin_profiles
         set completed_at = null
       where user_id = '64000000-0000-4000-8000-000000000010'$$
  ),
  'v2 requires a finite completion timestamp'
);

select ok(
  pg_temp.core01_check_rejected(
    $$update pg_temp.core01_skin_profiles
         set goals = array[]::text[]
       where user_id = '64000000-0000-4000-8000-000000000010'$$
  ),
  'v2 rejects an empty goal set'
);

select ok(
  pg_temp.core01_check_rejected(
    $$update pg_temp.core01_skin_profiles
         set goals = array['unreviewed_goal']
       where user_id = '64000000-0000-4000-8000-000000000010'$$
  ),
  'v2 rejects a goal outside the exact current six-goal vocabulary'
);

select ok(
  pg_temp.core01_check_rejected(
    $$update pg_temp.core01_skin_profiles
         set goals = array['clear_skin', 'clear_skin']
       where user_id = '64000000-0000-4000-8000-000000000010'$$
  ),
  'v2 rejects duplicate goals'
);

select ok(
  pg_temp.core01_check_rejected(
    $$update pg_temp.core01_skin_profiles
         set goals = array['clear_skin', 'hydration', 'sensitivity']
       where user_id = '64000000-0000-4000-8000-000000000010'$$
  ),
  'v2 rejects more than the current two-goal maximum'
);

select ok(
  pg_temp.core01_check_rejected(
    $$update pg_temp.core01_skin_profiles
         set sensitivities = array['unreviewed_sensitivity']
       where user_id = '64000000-0000-4000-8000-000000000010'$$
  ),
  'v2 rejects a sensitivity outside the exact current vocabulary'
);

select ok(
  pg_temp.core01_check_rejected(
    $$update pg_temp.core01_skin_profiles
         set sensitivities = array['fragrance', 'fragrance']
       where user_id = '64000000-0000-4000-8000-000000000010'$$
  ),
  'v2 rejects duplicate sensitivity outputs'
);

select ok(
  pg_temp.core01_check_rejected(
    $$update pg_temp.core01_skin_profiles
         set sensitivities = array['alcohol', 'fragrance']
       where user_id = '64000000-0000-4000-8000-000000000010'$$
  ),
  'v2 rejects non-canonical sensitivity ordering'
);

select * from finish();
rollback;
