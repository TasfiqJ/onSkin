begin;

create extension if not exists pgtap with schema extensions;
set local search_path = extensions, public, pg_catalog;

-- Forward-only 0069 -> 0070 rehearsal. The local gate withholds 0070, resets
-- through 0069, verifies the installed predecessor, and replaces the marker
-- below with the exact checked-in 0070 migration bytes.
select plan(13);

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
  '{"isCurrent": true, "reviewStatus": "draft_blocked"}'::jsonb,
  '0069 starts with the installed Ask predecessor as the current draft'
);

select is(
  (
    select count(*)
      from public.health_consent_copy_registry as registry
     where registry.consent_type = 'ask_layerwell'
       and registry.action = 'grant'
       and registry.consent_text_hash =
         '4bc7f130404b5d0d12aa52e0999efa72b1b68dd537fb90bbd708e60c561e1dcc'
  ),
  0::bigint,
  '0069 does not yet recognize the exact updated mobile Ask hash'
);

select is(
  pg_catalog.to_regclass('public.health_consent_copy_staging_events'),
  null::regclass,
  '0069 has no draft-staging evidence relation'
);

-- @@INCLUDE_EXACT_0070_MIGRATION@@

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
  '0070 preserves the predecessor as noncurrent draft history'
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
  '{"isCurrent": true, "reviewStatus": "draft_blocked"}'::jsonb,
  '0070 makes the exact mobile Ask tuple current without releasing it'
);

select is(
  (
    select pg_catalog.jsonb_build_object(
      'registryRows', count(*),
      'currentRows', count(*) filter (where registry.is_current),
      'currentDraftRows', count(*) filter (
        where registry.is_current and registry.review_status = 'draft_blocked'
      )
    )
      from public.health_consent_copy_registry as registry
  ),
  '{"registryRows": 16, "currentRows": 15, "currentDraftRows": 15}'::jsonb,
  '0070 adds history without changing the number or release status of current lanes'
);

select is(
  (
    select pg_catalog.jsonb_build_object(
      'previousHash', events.previous_consent_text_hash,
      'successorHash', events.successor_consent_text_hash,
      'successorStatus', events.successor_review_status,
      'changeReference', events.staging_change_reference,
      'stagedBy', events.staged_by,
      'evidenceHash', events.staging_evidence_hash
    )
      from public.health_consent_copy_staging_events as events
     where events.consent_type = 'ask_layerwell'
       and events.action = 'grant'
  ),
  pg_catalog.jsonb_build_object(
    'previousHash',
      '90cd7ec21799ed34a207bf1d6dc06220ff94f874af1cf9dbdce1a63db68f9e18',
    'successorHash',
      '4bc7f130404b5d0d12aa52e0999efa72b1b68dd537fb90bbd708e60c561e1dcc',
    'successorStatus', 'draft_blocked',
    'changeReference', 'DB-MIGRATION-20260726000070-ASK-DRAFT-ALIGNMENT',
    'stagedBy', 'migration:20260726000070',
    'evidenceHash',
      '4314f06805a15d98117914cca35a31d5bac6c6a21a2c5d122968975e9c2f7886'
  ),
  '0070 appends exact migration staging evidence distinct from review evidence'
);

select is(
  (select count(*) from public.health_consent_copy_review_events),
  0::bigint,
  '0070 invents no legal or privacy review event'
);

select is(
  (
    select count(*)
      from public.health_consent_copy_review_events as events
     where events.event_type in ('promotion', 'supersession')
       and events.consent_type = 'ask_layerwell'
       and events.action = 'grant'
  ),
  0::bigint,
  '0070 records neither promotion nor release supersession'
);

select ok(
  not exists (
    select 1
      from unnest(array['anon', 'authenticated', 'service_role']) as roles(name)
     where pg_catalog.has_function_privilege(
       roles.name,
       'public.stage_health_consent_copy_draft_successor(text,text,text,text,text,text,text,text,text)',
       'execute'
     )
  ),
  '0070 exposes no runtime draft-staging RPC authority'
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
  '0070 exposes no runtime staging-evidence table lane'
);

select ok(
  (
    select relations.relrowsecurity and relations.relforcerowsecurity
      from pg_catalog.pg_class as relations
     where relations.oid =
       'public.health_consent_copy_staging_events'::regclass
  )
    and exists (
      select 1
        from pg_catalog.pg_trigger as triggers
       where triggers.tgrelid =
         'public.health_consent_copy_staging_events'::regclass
         and triggers.tgname =
           'trg_health_consent_copy_staging_event_immutable'
         and not triggers.tgisinternal
    ),
  '0070 forces RLS and immutable-event enforcement on staging evidence'
);

select throws_ok(
  $$select public._assert_health_consent_copy_for_type(
    'ask_layerwell',
    'grant',
    'ask-advisor-2026-06-14-placeholder',
    '4bc7f130404b5d0d12aa52e0999efa72b1b68dd537fb90bbd708e60c561e1dcc'
  )$$,
  '55000',
  'HEALTH_CONSENT_COPY_NOT_RELEASED',
  '0070 leaves the exact updated Ask grant blocked pending genuine review'
);

select * from finish();
rollback;
