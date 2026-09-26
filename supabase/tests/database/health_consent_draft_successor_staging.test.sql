begin;

create extension if not exists pgtap with schema extensions;
set local search_path = extensions, public, pg_catalog;

select plan(25);

select is(
  (select count(*) from supabase_migrations.schema_migrations
    where version in ('20260726000070', '20260921000074')),
  2::bigint,
  'historical and corrective draft-staging migrations are both installed'
);

select has_table(
  'public',
  'health_consent_copy_staging_events',
  'immutable draft-staging evidence is installed'
);

select is(
  (
    select pg_catalog.jsonb_build_object(
      'reviewStatus', registry.review_status,
      'isCurrent', registry.is_current
    )
      from public.health_consent_copy_registry as registry
     where registry.consent_type = 'ask_layerwell'
       and registry.action = 'grant'
       and registry.version = 'ask-advisor-2026-06-14-placeholder'
       and registry.consent_text_hash =
         '90cd7ec21799ed34a207bf1d6dc06220ff94f874af1cf9dbdce1a63db68f9e18'
  ),
  '{"isCurrent": false, "reviewStatus": "draft_blocked"}'::jsonb,
  'the predecessor Ask tuple remains immutable noncurrent draft history'
);

select is(
  (
    select pg_catalog.jsonb_build_object(
      'reviewStatus', registry.review_status,
      'isCurrent', registry.is_current
    )
      from public.health_consent_copy_registry as registry
     where registry.consent_type = 'ask_layerwell'
       and registry.action = 'grant'
       and registry.version = 'ask-advisor-2026-06-14-placeholder'
       and registry.consent_text_hash =
         '4bc7f130404b5d0d12aa52e0999efa72b1b68dd537fb90bbd708e60c561e1dcc'
  ),
  '{"isCurrent": false, "reviewStatus": "draft_blocked"}'::jsonb,
  'the 0070 Ask tuple remains noncurrent unreleased draft history'
);

select is(
  (
    select count(*)
      from public.health_consent_copy_registry as registry
     where registry.consent_type = 'ask_layerwell'
       and registry.action = 'grant'
       and registry.is_current
  ),
  1::bigint,
  'Ask grant copy has exactly one current tuple'
);

select is(
  (
    select count(*)
      from public.health_consent_copy_registry as registry
     where registry.consent_type = 'ask_layerwell'
       and registry.action = 'grant'
  ),
  2::bigint,
  'both Ask grant predecessors and the current successor are retained'
);

select is(
  (
    select pg_catalog.jsonb_build_object(
      'previousVersion', events.previous_version,
      'previousHash', events.previous_consent_text_hash,
      'previousStatus', events.previous_review_status,
      'previousFromCurrent', events.previous_from_is_current,
      'previousToCurrent', events.previous_to_is_current,
      'successorVersion', events.successor_version,
      'successorHash', events.successor_consent_text_hash,
      'successorStatus', events.successor_review_status,
      'successorFromCurrent', events.successor_from_is_current,
      'successorToCurrent', events.successor_to_is_current,
      'changeReference', events.staging_change_reference,
      'stagedBy', events.staged_by,
      'evidenceHash', events.staging_evidence_hash
    )
      from public.health_consent_copy_staging_events as events
     where events.consent_type = 'ask_layerwell'
       and events.action = 'grant'
       and events.staged_by = 'migration:20260726000070'
  ),
  pg_catalog.jsonb_build_object(
    'previousVersion', 'ask-advisor-2026-06-14-placeholder',
    'previousHash',
      '90cd7ec21799ed34a207bf1d6dc06220ff94f874af1cf9dbdce1a63db68f9e18',
    'previousStatus', 'draft_blocked',
    'previousFromCurrent', true,
    'previousToCurrent', false,
    'successorVersion', 'ask-advisor-2026-06-14-placeholder',
    'successorHash',
      '4bc7f130404b5d0d12aa52e0999efa72b1b68dd537fb90bbd708e60c561e1dcc',
    'successorStatus', 'draft_blocked',
    'successorFromCurrent', false,
    'successorToCurrent', true,
    'changeReference', 'DB-MIGRATION-20260726000070-ASK-DRAFT-ALIGNMENT',
    'stagedBy', 'migration:20260726000070',
    'evidenceHash',
      '4314f06805a15d98117914cca35a31d5bac6c6a21a2c5d122968975e9c2f7886'
  ),
  'staging retains exact immutable non-review evidence'
);

select is(
  public._health_consent_copy_staging_evidence_hash(
    'ask_layerwell',
    'grant',
    'ask-advisor-2026-06-14-placeholder',
    '90cd7ec21799ed34a207bf1d6dc06220ff94f874af1cf9dbdce1a63db68f9e18',
    'ask-advisor-2026-06-14-placeholder',
    '4bc7f130404b5d0d12aa52e0999efa72b1b68dd537fb90bbd708e60c561e1dcc',
    'DB-MIGRATION-20260726000070-ASK-DRAFT-ALIGNMENT',
    'migration:20260726000070'
  ),
  '4314f06805a15d98117914cca35a31d5bac6c6a21a2c5d122968975e9c2f7886'::text,
  'the database reproduces the exact length-prefixed UTF-8 staging digest'
);

select is(
  (
    select count(*)
      from public.health_consent_copy_review_events as events
     where events.consent_type = 'ask_layerwell'
       and events.action = 'grant'
       and (
         (
           events.version = 'ask-advisor-2026-06-14-placeholder'
           and events.consent_text_hash in (
             '90cd7ec21799ed34a207bf1d6dc06220ff94f874af1cf9dbdce1a63db68f9e18',
             '4bc7f130404b5d0d12aa52e0999efa72b1b68dd537fb90bbd708e60c561e1dcc'
           )
         )
         or (
           events.successor_version = 'ask-advisor-2026-06-14-placeholder'
           and events.successor_consent_text_hash =
             '4bc7f130404b5d0d12aa52e0999efa72b1b68dd537fb90bbd708e60c561e1dcc'
         )
       )
  ),
  0::bigint,
  'draft alignment creates no Ask review, promotion, or supersession event'
);

select is(
  (select count(*) from public.health_consent_copy_review_events),
  0::bigint,
  'the forward migration fabricates no review or approval evidence'
);

select ok(
  (
    select relations.relrowsecurity and relations.relforcerowsecurity
      from pg_catalog.pg_class as relations
     where relations.oid =
       'public.health_consent_copy_staging_events'::regclass
  ),
  'staging evidence has enabled and forced row-level security'
);

select ok(
  not exists (
    select 1
      from unnest(array['anon', 'authenticated', 'service_role']) as roles(name)
     where pg_catalog.has_table_privilege(
             roles.name,
             'public.health_consent_copy_staging_events',
             'SELECT'
           )
        or pg_catalog.has_table_privilege(
             roles.name,
             'public.health_consent_copy_staging_events',
             'INSERT'
           )
        or pg_catalog.has_table_privilege(
             roles.name,
             'public.health_consent_copy_staging_events',
             'UPDATE'
           )
        or pg_catalog.has_table_privilege(
             roles.name,
             'public.health_consent_copy_staging_events',
             'DELETE'
           )
  ),
  'no runtime role has direct staging-evidence privileges'
);

select ok(
  not has_function_privilege(
    'anon',
    'public.stage_health_consent_copy_draft_successor(text,text,text,text,text,text,text,text,text)',
    'execute'
  )
    and not has_function_privilege(
      'authenticated',
      'public.stage_health_consent_copy_draft_successor(text,text,text,text,text,text,text,text,text)',
      'execute'
    )
    and not has_function_privilege(
      'service_role',
      'public.stage_health_consent_copy_draft_successor(text,text,text,text,text,text,text,text,text)',
      'execute'
    )
    and not has_function_privilege(
      'anon',
      'public._health_consent_copy_staging_evidence_hash(text,text,text,text,text,text,text,text)',
      'execute'
    )
    and not has_function_privilege(
      'authenticated',
      'public._health_consent_copy_staging_evidence_hash(text,text,text,text,text,text,text,text)',
      'execute'
    )
    and not has_function_privilege(
      'service_role',
      'public._health_consent_copy_staging_evidence_hash(text,text,text,text,text,text,text,text)',
      'execute'
    ),
  'runtime roles have no draft-staging function authority'
);

select ok(
  (
    select functions.prosecdef
      and functions.proconfig @> array['search_path=""']::text[]
      from pg_catalog.pg_proc as functions
     where functions.oid =
       'public.stage_health_consent_copy_draft_successor(text,text,text,text,text,text,text,text,text)'::regprocedure
  ),
  'the migration-owner staging function is security-definer and search-path sealed'
);

set local role authenticated;
select throws_ok(
  $$select * from public.stage_health_consent_copy_draft_successor(
    'ask_layerwell', 'grant',
    'ask-advisor-2026-06-14-placeholder',
    '90cd7ec21799ed34a207bf1d6dc06220ff94f874af1cf9dbdce1a63db68f9e18',
    'ask-advisor-2026-06-14-placeholder',
    '4bc7f130404b5d0d12aa52e0999efa72b1b68dd537fb90bbd708e60c561e1dcc',
    'DB-MIGRATION-20260726000070-ASK-DRAFT-ALIGNMENT',
    'migration:20260726000070',
    '4314f06805a15d98117914cca35a31d5bac6c6a21a2c5d122968975e9c2f7886'
  )$$,
  '42501',
  'permission denied for function stage_health_consent_copy_draft_successor',
  'authenticated callers cannot stage disclosure copy'
);
reset role;

set local role anon;
select throws_ok(
  $$select * from public.stage_health_consent_copy_draft_successor(
    'ask_layerwell', 'grant',
    'ask-advisor-2026-06-14-placeholder',
    '90cd7ec21799ed34a207bf1d6dc06220ff94f874af1cf9dbdce1a63db68f9e18',
    'ask-advisor-2026-06-14-placeholder',
    '4bc7f130404b5d0d12aa52e0999efa72b1b68dd537fb90bbd708e60c561e1dcc',
    'DB-MIGRATION-20260726000070-ASK-DRAFT-ALIGNMENT',
    'migration:20260726000070',
    '4314f06805a15d98117914cca35a31d5bac6c6a21a2c5d122968975e9c2f7886'
  )$$,
  '42501',
  'permission denied for function stage_health_consent_copy_draft_successor',
  'anonymous callers cannot stage disclosure copy'
);
reset role;

set local role service_role;
select throws_ok(
  $$select * from public.stage_health_consent_copy_draft_successor(
    'ask_layerwell', 'grant',
    'ask-advisor-2026-06-14-placeholder',
    '90cd7ec21799ed34a207bf1d6dc06220ff94f874af1cf9dbdce1a63db68f9e18',
    'ask-advisor-2026-06-14-placeholder',
    '4bc7f130404b5d0d12aa52e0999efa72b1b68dd537fb90bbd708e60c561e1dcc',
    'DB-MIGRATION-20260726000070-ASK-DRAFT-ALIGNMENT',
    'migration:20260726000070',
    '4314f06805a15d98117914cca35a31d5bac6c6a21a2c5d122968975e9c2f7886'
  )$$,
  '42501',
  'permission denied for function stage_health_consent_copy_draft_successor',
  'runtime service authority is not migration staging authority'
);
reset role;

set local role authenticated;
select throws_ok(
  $$update public.health_consent_copy_registry
       set is_current = false
     where consent_type = 'ask_layerwell' and action = 'grant' and is_current$$,
  '42501',
  'permission denied for table health_consent_copy_registry',
  'authenticated direct registry mutation remains denied'
);
reset role;

set local role service_role;
select throws_ok(
  $$insert into public.health_consent_copy_staging_events (
      consent_type, action,
      previous_version, previous_consent_text_hash,
      previous_review_status, previous_from_is_current, previous_to_is_current,
      successor_version, successor_consent_text_hash,
      successor_review_status, successor_from_is_current, successor_to_is_current,
      staging_change_reference, staged_by, staging_evidence_hash,
      lifecycle_xid, lifecycle_backend_pid
    ) values (
      'ask_layerwell', 'grant',
      'ask-advisor-2026-06-14-placeholder', repeat('1', 64),
      'draft_blocked', true, false,
      'ask-advisor-2026-06-14-placeholder', repeat('2', 64),
      'draft_blocked', false, true,
      'DB-MIGRATION-UNAUTHORIZED', 'service:unauthorized', repeat('3', 64),
      pg_catalog.pg_current_xact_id(), pg_catalog.pg_backend_pid()
    )$$,
  '42501',
  'permission denied for table health_consent_copy_staging_events',
  'service callers cannot forge staging evidence with direct DML'
);
reset role;

select throws_ok(
  $$update public.health_consent_copy_staging_events
       set staged_by = 'migration:rewritten'$$,
  '55000',
  'HEALTH_CONSENT_COPY_STAGING_EVENT_IMMUTABLE',
  'staging evidence cannot be rewritten by the database owner'
);

select throws_ok(
  $$delete from public.health_consent_copy_staging_events$$,
  '55000',
  'HEALTH_CONSENT_COPY_STAGING_EVENT_IMMUTABLE',
  'staging evidence cannot be deleted by the database owner'
);

select throws_ok(
  $$select public._assert_health_consent_copy_for_type(
    'ask_layerwell',
    'grant',
    'ask-advisor-2026-06-14-placeholder',
    '242f45399eb0fc3a792124b641f733feae9bf8321291d7e2c49e2799b8623303'
  )$$,
  '55000',
  'HEALTH_CONSENT_COPY_NOT_RELEASED',
  'the exact current Ask draft still cannot authorize a grant'
);

select lives_ok(
  $$select * from public.stage_health_consent_copy_draft_successor(
    'ask_layerwell', 'grant',
    'ask-advisor-2026-06-14-placeholder',
    '4bc7f130404b5d0d12aa52e0999efa72b1b68dd537fb90bbd708e60c561e1dcc',
    'ask-advisor-2026-06-14-placeholder',
    '242f45399eb0fc3a792124b641f733feae9bf8321291d7e2c49e2799b8623303',
    'DB-MIGRATION-20260921000074-ASK-GRANT-HASH-CORRECTION',
    'migration:20260921000074',
    '50f4ef320dd7511dced84061726410b77a9d355ee083b59431544dc9c6beecbc'
  )$$,
  'an exact current migration replay returns the original staging truth'
);

select is(
  (
    select count(*)
      from public.health_consent_copy_staging_events
     where consent_type = 'ask_layerwell' and action = 'grant'
  ),
  3::bigint,
  'an exact replay appends no duplicate staging evidence'
);

select throws_ok(
  $$select * from public.stage_health_consent_copy_draft_successor(
    'ask_layerwell', 'grant',
    'ask-advisor-2026-06-14-placeholder',
    '90cd7ec21799ed34a207bf1d6dc06220ff94f874af1cf9dbdce1a63db68f9e18',
    'ask-advisor-2026-06-14-placeholder',
    '4bc7f130404b5d0d12aa52e0999efa72b1b68dd537fb90bbd708e60c561e1dcc',
    'DB-MIGRATION-20260726000070-ASK-DRAFT-ALIGNMENT',
    'migration:20260726000070',
    repeat('f', 64)
  )$$,
  '22023',
  'HEALTH_CONSENT_COPY_DRAFT_STAGING_EVIDENCE_MISMATCH',
  'a one-byte staging-evidence mutation fails before replay or writes'
);

select * from finish();
rollback;
