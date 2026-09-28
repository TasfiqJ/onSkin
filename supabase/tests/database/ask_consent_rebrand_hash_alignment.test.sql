begin;

create extension if not exists pgtap with schema extensions;
set local search_path = extensions, public, pg_catalog;

select plan(12);

select is(
  (select count(*) from public.health_consent_copy_registry
    where consent_type = 'ask_layerwell' and action = 'grant'),
  3::bigint,
  'both historical Ask grant drafts remain alongside the corrected current draft'
);

select is(
  (select count(*) from public.health_consent_copy_registry
    where consent_type = 'ask_layerwell' and action = 'withdraw'),
  2::bigint,
  'the historical Ask withdrawal tuple remains alongside the corrected draft'
);

select is(
  (select consent_text_hash from public.health_consent_copy_registry
    where consent_type = 'ask_layerwell' and action = 'grant' and is_current),
  '242f45399eb0fc3a792124b641f733feae9bf8321291d7e2c49e2799b8623303'::text,
  'current Ask grant is hashed from the displayed Layerwell text'
);

select is(
  (select consent_text_hash from public.health_consent_copy_registry
    where consent_type = 'ask_layerwell' and action = 'withdraw' and is_current),
  '4d0b588ed43f4680adaf6e7699641c706e113bed7b9212b408532235e4fe1e57'::text,
  'current Ask withdrawal is hashed from the displayed Layerwell text'
);

select is(
  (select count(*) from public.health_consent_copy_registry
    where consent_type = 'ask_layerwell' and not is_current
      and consent_text_hash in (
        '90cd7ec21799ed34a207bf1d6dc06220ff94f874af1cf9dbdce1a63db68f9e18',
        '4bc7f130404b5d0d12aa52e0999efa72b1b68dd537fb90bbd708e60c561e1dcc',
        '5ef385c3e618e3a4167b7096b3d99ffe3d22468269f6d899a51527b7959c9aff'
      )),
  3::bigint,
  'all legacy Ask hashes remain immutable noncurrent history'
);

select is(
  (select count(*) from public.health_consent_copy_registry
    where consent_type = 'ask_layerwell' and review_status = 'draft_blocked'),
  5::bigint,
  'all Ask tuples remain draft blocked'
);

select is(
  (select count(*) from public.health_consent_copy_staging_events
    where consent_type = 'ask_layerwell'),
  3::bigint,
  'the correction appends two staging events without replacing 0070 history'
);

select is(
  (select count(*) from public.health_consent_copy_staging_events as events
    where events.consent_type = 'ask_layerwell'
      and events.staged_by = 'migration:20260921000074'
      and events.staging_evidence_hash =
        public._health_consent_copy_staging_evidence_hash(
          events.consent_type, events.action,
          events.previous_version, events.previous_consent_text_hash,
          events.successor_version, events.successor_consent_text_hash,
          events.staging_change_reference, events.staged_by
        )),
  2::bigint,
  'both new staging events have database-recomputed exact evidence digests'
);

select is(
  (select count(*) from public.health_consent_copy_review_events
    where consent_type = 'ask_layerwell'),
  0::bigint,
  'hash alignment creates no legal review, promotion, or release evidence'
);

select throws_ok(
  $$select public._assert_health_consent_copy_for_type(
    'ask_layerwell', 'grant', 'ask-advisor-2026-06-14-placeholder',
    '242f45399eb0fc3a792124b641f733feae9bf8321291d7e2c49e2799b8623303'
  )$$,
  '55000', 'HEALTH_CONSENT_COPY_NOT_RELEASED',
  'the exact new grant remains blocked pending genuine review'
);

select lives_ok(
  $$select public._assert_health_consent_copy_for_type(
    'ask_layerwell', 'withdraw', 'ask-advisor-2026-06-14-placeholder',
    '4d0b588ed43f4680adaf6e7699641c706e113bed7b9212b408532235e4fe1e57'
  )$$,
  'the exact new withdrawal can record a revocation'
);

select lives_ok(
  $$select public._assert_health_consent_copy_for_type(
    'ask_layerwell', 'withdraw', 'ask-advisor-2026-06-14-placeholder',
    '5ef385c3e618e3a4167b7096b3d99ffe3d22468269f6d899a51527b7959c9aff'
  )$$,
  'an old withdrawal receipt can still be replayed to completion'
);

select * from finish();
rollback;
