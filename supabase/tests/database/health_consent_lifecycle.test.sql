begin;

create extension if not exists pgtap with schema extensions;
select plan(215);

-- Supabase API grants are hosted-bootstrap state rather than migration-owned.
-- Rehearse the trigger/RPC contract with only the table privileges the normal
-- authenticated API lane receives; sealed lifecycle tables remain ungranted.
grant select, insert, delete
  on public.profiles
  to authenticated;
grant update (display_name, avatar_path, locale, units)
  on public.profiles
  to authenticated;
grant select, insert, update, delete
  on public.skin_profiles, public.consents, public.photos, public.routines
  to authenticated;
grant select on public.entitlements, public.community_blocks, public.community_questions
  to authenticated;
grant select on storage.objects to authenticated;
-- Production owner policies still apply. This transaction-local permissive
-- policy contributes only a cross-owner control row so the restrictive health
-- fence can be observed independently of ordinary Storage ownership RLS.
create policy "pgtap_health_read_fence_control_select" on storage.objects
  for select to authenticated
  using (
    bucket_id = 'photos'
    and name = '70000000-0000-4000-8000-000000000003/e1/read-fence.bin'
  );
grant select on public.profiles to service_role;
grant insert on public.consents to service_role;
grant select, delete on public.skin_profiles to service_role;
grant select, delete on storage.objects to service_role;
grant select, update, delete
  on public.community_questions, public.community_reports
  to service_role;

insert into auth.users (id) values
  ('70000000-0000-4000-8000-000000000001'),
  ('70000000-0000-4000-8000-000000000002'),
  ('70000000-0000-4000-8000-000000000003'),
  ('70000000-0000-4000-8000-000000000004'),
  ('70000000-0000-4000-8000-000000000005');
insert into auth.sessions (id, user_id) values
  ('71000000-0000-4000-8000-000000000001', '70000000-0000-4000-8000-000000000001'),
  ('71000000-0000-4000-8000-000000000002', '70000000-0000-4000-8000-000000000002'),
  ('71000000-0000-4000-8000-000000000003', '70000000-0000-4000-8000-000000000003'),
  ('71000000-0000-4000-8000-000000000004', '70000000-0000-4000-8000-000000000004'),
  ('71000000-0000-4000-8000-000000000005', '70000000-0000-4000-8000-000000000005');

select ok(
  pg_catalog.pg_get_functiondef(
    'public._assert_health_dependent_generation_locked(uuid,text,bigint,bigint)'::regprocedure
  ) like '%_assert_health_processing_epoch_locked%'
  and pg_catalog.pg_get_functiondef(
    'public.begin_health_dependent_consent_withdrawal(bigint,bigint,text,text,text,text)'::regprocedure
  ) like '%pg_advisory_xact_lock%'
  and pg_catalog.pg_get_functiondef(
    'public.record_health_dependent_consent(bigint,bigint,text,text,text,text)'::regprocedure
  ) like '%pg_advisory_xact_lock%',
  'dependent writers and withdrawal share the serialized owner lifecycle lock'
);

select ok(
  pg_catalog.pg_get_functiondef(
    'public.list_health_dependent_consent_storage_work(uuid,integer,text)'::regprocedure
  ) like '%_health_photo_path_safe_for_withdrawal%'
  and pg_catalog.pg_get_functiondef(
    'public.list_health_dependent_consent_storage_work(uuid,integer,text)'::regprocedure
  ) like '%not public._account_photo_storage_object_owned%'
  and pg_catalog.pg_get_functiondef(
    'public.list_health_dependent_consent_storage_work(uuid,integer,text)'::regprocedure
  ) like '%owner_id%',
  'dependent Storage work releases only safe owner paths and rejects conflicting metadata evidence'
);

create or replace function public.pgtap_grant_health_dependent_consent(
  p_epoch bigint,
  p_consent_type text,
  p_idempotency_key text
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user_id uuid := (select auth.uid());
  v_generation bigint;
  v_version text;
  v_hash text;
  v_receipt_id uuid;
begin
  select states.generation
    into v_generation
    from public.health_dependent_consent_states as states
   where states.user_id = v_user_id
     and states.consent_type = p_consent_type;
  select registry.version, registry.consent_text_hash
    into v_version, v_hash
    from public.health_consent_copy_registry as registry
   where registry.consent_type = p_consent_type
     and registry.action = 'grant'
     and registry.is_current;
  perform *
    from public.record_health_dependent_consent(
      p_epoch,
      v_generation,
      p_idempotency_key,
      p_consent_type,
      v_version,
      v_hash
    );
  select states.current_receipt_id
    into v_receipt_id
    from public.health_dependent_consent_states as states
   where states.user_id = v_user_id
     and states.consent_type = p_consent_type;
  return v_receipt_id;
end;
$$;

create or replace function public.pgtap_health_headers(
  p_epoch bigint,
  p_consent_types text[] default array[]::text[]
)
returns text
language sql
stable
security definer
set search_path = ''
as $$
  select pg_catalog.jsonb_build_object(
    'x-health-processing-epoch', p_epoch::text,
    'x-client-info',
    'pgtap' || coalesce((
      select pg_catalog.string_agg(
        '; health-consent-generation=' || states.consent_type
          || ':' || states.generation::text,
        '' order by states.consent_type
      )
        from public.health_dependent_consent_states as states
       where states.user_id = (select auth.uid())
         and states.consent_type = any(p_consent_types)
    ), '')
  )::text;
$$;

-- Migration 0065 intentionally removes PostgreSQL's implicit PUBLIC EXECUTE
-- default for future migration-owner functions. These transaction-local pgTAP
-- helpers model authenticated client calls, so grant only that test role
-- explicitly instead of relying on the unsafe global default.
grant execute on function public.pgtap_grant_health_dependent_consent(bigint, text, text)
  to authenticated;
grant execute on function public.pgtap_health_headers(bigint, text[])
  to authenticated;

insert into public.entitlements (
  user_id,
  entitlement,
  is_active,
  product_id,
  source,
  rc_event_id,
  rc_event_at,
  rc_event_priority
)
values (
  '70000000-0000-4000-8000-000000000001',
  'pro',
  true,
  'test.health.read.fence',
  'revenuecat',
  'test-health-read-fence-entitlement',
  '2026-07-15 00:00:00+00',
  100
);

select pg_catalog.set_config(
  'request.headers',
  '{"x-client-info":"supabase-js/2.108.1; runtime=web; health-processing-epoch=1"}',
  true
);
select is(
  public._request_health_processing_epoch(),
  1::bigint,
  'the browser-safe x-client-info carrier yields the exact processing epoch'
);

select pg_catalog.set_config(
  'request.headers',
  '{"x-client-info":"sdk; health-processing-epoch=1; health-processing-epoch=1"}',
  true
);
select throws_ok(
  $$select public._request_health_processing_epoch()$$,
  '55000',
  'HEALTH_PROCESSING_EPOCH_REQUIRED',
  'duplicate browser carrier markers are rejected even when equal'
);

select pg_catalog.set_config(
  'request.headers',
  '{"x-health-processing-epoch":"1","x-client-info":"sdk; health-processing-epoch=2"}',
  true
);
select throws_ok(
  $$select public._request_health_processing_epoch()$$,
  '55000',
  'HEALTH_PROCESSING_EPOCH_REQUIRED',
  'conflicting dedicated and browser carrier values are rejected'
);

select pg_catalog.set_config(
  'request.headers',
  '{"x-health-processing-epoch":"1","x-client-info":"sdk; health-processing-epoch=1"}',
  true
);
select throws_ok(
  $$select public._request_health_processing_epoch()$$,
  '55000',
  'HEALTH_PROCESSING_EPOCH_REQUIRED',
  'two authority lanes are rejected even when their values are equal'
);

select pg_catalog.set_config(
  'request.headers',
  '{"x-client-info":"sdk; health-processing-epoch =1"}',
  true
);
select throws_ok(
  $$select public._request_health_processing_epoch()$$,
  '55000',
  'HEALTH_PROCESSING_EPOCH_REQUIRED',
  'whitespace-smuggled browser carrier markers are rejected'
);

select pg_catalog.set_config(
  'request.headers',
  '{"x-client-info":"sdk; health-processing-epoch=\"1\""}',
  true
);
select throws_ok(
  $$select public._request_health_processing_epoch()$$,
  '55000',
  'HEALTH_PROCESSING_EPOCH_REQUIRED',
  'quoted browser carrier values are rejected'
);

select pg_catalog.set_config(
  'request.headers',
  '{"x-client-info":"sdk; health-processing-epoch=9223372036854775808"}',
  true
);
select throws_ok(
  $$select public._request_health_processing_epoch()$$,
  '55000',
  'HEALTH_PROCESSING_EPOCH_REQUIRED',
  'browser carrier epochs outside PostgreSQL bigint are rejected'
);

select pg_catalog.set_config(
  'request.headers',
  '{"x-health-processing-epoch":"1, 1"}',
  true
);
select throws_ok(
  $$select public._request_health_processing_epoch()$$,
  '55000',
  'HEALTH_PROCESSING_EPOCH_REQUIRED',
  'coalesced duplicate dedicated headers are rejected'
);

select is(
  (select count(*) from public.health_consent_copy_registry
    where review_status = 'draft_blocked'),
  16::bigint,
  'installed current and historical disclosure copies are truthfully draft-blocked'
);

set local role authenticated;
select pg_catalog.set_config(
  'request.jwt.claims',
  '{"sub":"70000000-0000-4000-8000-000000000001","role":"authenticated","session_id":"71000000-0000-4000-8000-000000000001"}',
  true
);
select pg_catalog.set_config('request.headers', '{}', true);

select is(
  (select state from public.get_health_data_consent_status()),
  'unconsented'::text,
  'base status remains usable while grant copy is draft-blocked'
);
select is(
  (select state
     from public.get_health_dependent_consent_status('photo_capture')),
  'unconsented'::text,
  'dependent status remains usable while grant copy is draft-blocked'
);
select throws_ok(
  $$select * from public.grant_health_data_consent(
    0, 'draft-v1-2026-07-10',
    '7957a2811fff0e8cefc6f7180b751ec45688fe99421978eedae05b96c2f251fd'
  )$$,
  '55000',
  'HEALTH_CONSENT_COPY_NOT_RELEASED',
  'an authenticated caller cannot grant base health processing with exact draft copy'
);
select throws_ok(
  $$select * from public.record_health_dependent_consent(
    1, 0, repeat('1', 64), 'photo_capture', 'draft-v1-2026-07-10',
    '2ed9ac0c1009327c08389040d0a1db05462c39102f8730038a90ecd62de8e8c2'
  )$$,
  '55000', 'HEALTH_CONSENT_COPY_NOT_RELEASED',
  'exact draft photo-capture copy cannot create a dependent grant'
);
select throws_ok(
  $$select * from public.record_health_dependent_consent(
    1, 0, repeat('2', 64), 'photo_cloud_backup', 'draft-v1-2026-07-10',
    '3964f0829f0c5a1369b3e413d6edaa2585cda671333a6efb0d1f8d84d6f5e8b8'
  )$$,
  '55000', 'HEALTH_CONSENT_COPY_NOT_RELEASED',
  'exact draft cloud-backup copy cannot create a dependent grant'
);
select throws_ok(
  $$select * from public.record_health_dependent_consent(
    1, 0, repeat('3', 64), 'photo_trend_insights',
    'photo-trend-insights-2026-06-13-placeholder',
    '58997d5c3ef5098edf6544aa2752e6878765065831ddbf42c24a364ab36cd1aa'
  )$$,
  '55000', 'HEALTH_CONSENT_COPY_NOT_RELEASED',
  'exact draft trend copy cannot create a dependent grant'
);
select throws_ok(
  $$select * from public.record_health_dependent_consent(
    1, 0, repeat('4', 64), 'ask_layerwell',
    'ask-advisor-2026-06-14-placeholder',
    '4bc7f130404b5d0d12aa52e0999efa72b1b68dd537fb90bbd708e60c561e1dcc'
  )$$,
  '55000', 'HEALTH_CONSENT_COPY_NOT_RELEASED',
  'exact draft Ask copy cannot create a dependent grant'
);
select throws_ok(
  $$select * from public.record_health_dependent_consent(
    1, 0, repeat('5', 64), 'community_participation',
    'community-participation-2026-06-13-placeholder',
    '416da3ba3cd3496c1008cff937b4d7ad0efa7093d40bcfed2636b480e603ca5e'
  )$$,
  '55000', 'HEALTH_CONSENT_COPY_NOT_RELEASED',
  'exact draft community copy cannot create a dependent grant'
);
select throws_ok(
  $$select * from public.record_health_dependent_consent(
    1, 0, repeat('6', 64), 'data_sharing',
    'commerce-consent-2026-06-13-placeholder',
    'b02cf2e0dd7fa1a1e0be10122b9a363109b0d6adbd7d3c478c168ff811c17b7a'
  )$$,
  '55000', 'HEALTH_CONSENT_COPY_NOT_RELEASED',
  'exact draft data-sharing copy cannot create a dependent grant'
);
select throws_ok(
  $$select * from public.promote_health_consent_copy_for_release(
    'photo_capture', 'grant', 'draft-v1-2026-07-10',
    '2ed9ac0c1009327c08389040d0a1db05462c39102f8730038a90ecd62de8e8c2',
    'PGTAP-LEGAL-REVIEW-2026-07-15', 'pgtap.db-owner', repeat('a', 64)
  )$$,
  '42501',
  'permission denied for function promote_health_consent_copy_for_release',
  'authenticated runtime callers cannot promote disclosure copy'
);
reset role;
set local role anon;
select throws_ok(
  $$select * from public.promote_health_consent_copy_for_release(
    'photo_capture', 'grant', 'draft-v1-2026-07-10',
    '2ed9ac0c1009327c08389040d0a1db05462c39102f8730038a90ecd62de8e8c2',
    'PGTAP-LEGAL-REVIEW-2026-07-15', 'pgtap.db-owner', repeat('a', 64)
  )$$,
  '42501',
  'permission denied for function promote_health_consent_copy_for_release',
  'anonymous callers cannot promote disclosure copy'
);
reset role;
set local role service_role;
select throws_ok(
  $$select * from public.promote_health_consent_copy_for_release(
    'photo_capture', 'grant', 'draft-v1-2026-07-10',
    '2ed9ac0c1009327c08389040d0a1db05462c39102f8730038a90ecd62de8e8c2',
    'PGTAP-LEGAL-REVIEW-2026-07-15', 'pgtap.db-owner', repeat('a', 64)
  )$$,
  '42501',
  'permission denied for function promote_health_consent_copy_for_release',
  'runtime service authority is not legal-review authority'
);
reset role;
set local role authenticated;

select throws_ok(
  $$select * from public.decline_initial_health_data_consent(
    0, 'draft-v1-2026-07-10', repeat('f', 64)
  )$$,
  '22023',
  'HEALTH_CONSENT_COPY_UNRECOGNIZED',
  'direct authenticated RPC cannot invent an initial-decline receipt'
);

select lives_ok(
  $$select * from public.decline_initial_health_data_consent(
    0, 'draft-v1-2026-07-10',
    '6a34a4d3b8086a0ee86951261f612c502bd4376bc8378cf22533b49817cdedea'
  )$$,
  'initial decline is an atomic owner-derived lifecycle RPC'
);
reset role;

select is(
  (select state from public.health_processing_states where user_id = '70000000-0000-4000-8000-000000000001'),
  'unconsented',
  'initial decline leaves processing closed'
);
select is(
  (select count(*) from public.consents where user_id = '70000000-0000-4000-8000-000000000001' and consent_type = 'health_data_collection' and granted is false),
  1::bigint,
  'initial decline appends one immutable refusal receipt'
);

-- A legacy residual is never readable while the caller remains unconsented.
-- The write guard correctly requires reviewed current authority even for this
-- synthetic setup, so promote the exact base tuple with the same transaction-
-- local evidence used by the release-lifecycle rehearsal below.
do $$
begin
  perform * from public.promote_health_consent_copy_for_release(
    'health_data_collection', 'grant', 'draft-v1-2026-07-10',
    '7957a2811fff0e8cefc6f7180b751ec45688fe99421978eedae05b96c2f251fd',
    'PGTAP-LEGAL-REVIEW-2026-07-15', 'pgtap.db-owner', repeat('a', 64)
  );
end;
$$;
update public.health_processing_states
   set state = 'active',
       epoch = 1,
       consent_version = 'draft-v1-2026-07-10',
       consent_text_hash =
         '7957a2811fff0e8cefc6f7180b751ec45688fe99421978eedae05b96c2f251fd'
 where user_id = '70000000-0000-4000-8000-000000000001';
select pg_catalog.set_config('request.headers', '{"x-health-processing-epoch":"1"}', true);
insert into public.skin_profiles (user_id, goals)
values ('70000000-0000-4000-8000-000000000001', array['legacy-residual']);
update public.health_processing_states
   set state = 'unconsented',
       epoch = 0,
       consent_version = null,
       consent_text_hash = null,
       last_server_verified_at = null
 where user_id = '70000000-0000-4000-8000-000000000001';
set local role authenticated;
select is(
  (select count(*) from public.skin_profiles
    where user_id = '70000000-0000-4000-8000-000000000001'),
  0::bigint,
  'unconsented callers cannot read a legacy health residual'
);
reset role;
delete from public.skin_profiles
 where user_id = '70000000-0000-4000-8000-000000000001';
select pg_catalog.set_config('request.headers', '{}', true);

set local role authenticated;
select lives_ok(
  $$select * from public.decline_initial_health_data_consent(
    0, 'draft-v1-2026-07-10',
    '6a34a4d3b8086a0ee86951261f612c502bd4376bc8378cf22533b49817cdedea'
  )$$,
  'an identical initial decline retry is accepted'
);
reset role;
select is(
  (select count(*) from public.consents where user_id = '70000000-0000-4000-8000-000000000001' and consent_type = 'health_data_collection' and granted is false),
  1::bigint,
  'an identical initial decline retry does not duplicate the receipt'
);

-- Transaction-scoped migration-owner rehearsal only. The entire pgTAP file
-- rolls back, so installed registry truth remains draft_blocked. This proves
-- what a future reviewed SQL migration must record without creating a runtime
-- promotion bypass.
select throws_ok(
  $$select * from public.promote_health_consent_copy_for_release(
    'photo_capture', 'grant', 'draft-v1-2026-07-10', repeat('f', 64),
    'PGTAP-LEGAL-REVIEW-2026-07-15', 'pgtap.db-owner', repeat('a', 64)
  )$$,
  '22023',
  'HEALTH_CONSENT_COPY_PROMOTION_MISMATCH',
  'migration-owner promotion still rejects a non-registry hash'
);
select throws_ok(
  $$update public.health_consent_copy_registry
       set review_status = 'approved'
     where consent_type = 'photo_capture' and action = 'withdraw'$$,
  '55000',
  'HEALTH_CONSENT_COPY_LIFECYCLE_EVIDENCE_REQUIRED',
  'even the database owner cannot approve a row without same-transaction evidence'
);
select lives_ok(
  $$select promoted.*
      from (values
        ('health_data_collection'::text, 'draft-v1-2026-07-10'::text,
          '7957a2811fff0e8cefc6f7180b751ec45688fe99421978eedae05b96c2f251fd'::text),
        ('photo_capture', 'draft-v1-2026-07-10',
          '2ed9ac0c1009327c08389040d0a1db05462c39102f8730038a90ecd62de8e8c2'),
        ('photo_cloud_backup', 'draft-v1-2026-07-10',
          '3964f0829f0c5a1369b3e413d6edaa2585cda671333a6efb0d1f8d84d6f5e8b8'),
        ('photo_trend_insights', 'photo-trend-insights-2026-06-13-placeholder',
          '58997d5c3ef5098edf6544aa2752e6878765065831ddbf42c24a364ab36cd1aa'),
        ('ask_layerwell', 'ask-advisor-2026-06-14-placeholder',
          '4bc7f130404b5d0d12aa52e0999efa72b1b68dd537fb90bbd708e60c561e1dcc'),
        ('community_participation', 'community-participation-2026-06-13-placeholder',
          '416da3ba3cd3496c1008cff937b4d7ad0efa7093d40bcfed2636b480e603ca5e'),
        ('data_sharing', 'commerce-consent-2026-06-13-placeholder',
          'b02cf2e0dd7fa1a1e0be10122b9a363109b0d6adbd7d3c478c168ff811c17b7a')
      ) as copies(consent_type, version, consent_text_hash)
      cross join lateral public.promote_health_consent_copy_for_release(
        copies.consent_type,
        'grant',
        copies.version,
        copies.consent_text_hash,
        'PGTAP-LEGAL-REVIEW-2026-07-15',
        'pgtap.db-owner',
        repeat('a', 64)
      ) as promoted$$,
  'a migration owner can promote only seven exact grant tuples with review evidence'
);
select is(
  (select count(*) from public.health_consent_copy_review_events
    where action = 'grant'
      and from_status = 'draft_blocked'
      and to_status = 'approved'
      and review_ticket = 'PGTAP-LEGAL-REVIEW-2026-07-15'
      and reviewed_by = 'pgtap.db-owner'
      and review_evidence_hash = repeat('a', 64)),
  7::bigint,
  'every promoted grant has one exact immutable review event'
);
select results_eq(
  $$select review_status, count(*)
      from public.health_consent_copy_registry
     group by review_status
     order by review_status$$,
  $$values
    ('approved'::text, 7::bigint),
    ('draft_blocked'::text, 9::bigint)$$,
  'only grant rows are promoted; refusal and withdrawal copy remains draft truth'
);
select results_eq(
  $$select consent_type, review_status, review_ticket
      from public.promote_health_consent_copy_for_release(
        'photo_capture', 'grant', 'draft-v1-2026-07-10',
        '2ed9ac0c1009327c08389040d0a1db05462c39102f8730038a90ecd62de8e8c2',
        'PGTAP-LEGAL-REVIEW-2026-07-15', 'pgtap.db-owner', repeat('a', 64)
      )$$,
  $$values (
    'photo_capture'::text,
    'approved'::text,
    'PGTAP-LEGAL-REVIEW-2026-07-15'::text
  )$$,
  'an exact promotion replay returns its original audit truth'
);
select throws_ok(
  $$select * from public.promote_health_consent_copy_for_release(
    'photo_capture', 'grant', 'draft-v1-2026-07-10',
    '2ed9ac0c1009327c08389040d0a1db05462c39102f8730038a90ecd62de8e8c2',
    'PGTAP-LEGAL-REVIEW-2026-07-15', 'pgtap.db-owner', repeat('b', 64)
  )$$,
  '55000',
  'HEALTH_CONSENT_COPY_PROMOTION_CONFLICT',
  'a promoted tuple cannot be replayed with conflicting review evidence'
);
select throws_ok(
  $$update public.health_consent_copy_review_events
       set reviewed_by = 'mutated.reviewer'$$,
  '55000',
  'HEALTH_CONSENT_COPY_REVIEW_EVENT_IMMUTABLE',
  'review evidence cannot be rewritten after promotion'
);

set local role authenticated;
select throws_ok(
  $$select * from public.grant_health_data_consent(
    0, 'draft-v1-2026-07-10', repeat('e', 64)
  )$$,
  '22023',
  'HEALTH_CONSENT_COPY_UNRECOGNIZED',
  'direct authenticated RPC cannot invent a grant receipt'
);
select lives_ok(
  $$select * from public.grant_health_data_consent(
    0, 'draft-v1-2026-07-10',
    '7957a2811fff0e8cefc6f7180b751ec45688fe99421978eedae05b96c2f251fd'
  )$$,
  'fresh consent opens the first processing epoch'
);
reset role;
select ok(
  exists (
    select 1 from public.health_processing_states
     where user_id = '70000000-0000-4000-8000-000000000001'
       and state = 'active' and epoch = 1
  ),
  'the first processing epoch is active'
);

-- Dedicated dependent-lifecycle adversary owner. This proves exact copy,
-- generation CAS/idempotency, child cascade ordering, durable worker adoption,
-- and base-withdrawal subsumption without disturbing the broad owner-1 purge.
set local role authenticated;
select pg_catalog.set_config(
  'request.jwt.claims',
  '{"sub":"70000000-0000-4000-8000-000000000004","role":"authenticated","session_id":"71000000-0000-4000-8000-000000000004"}',
  true
);
select results_eq(
  $$select consent_type, state, generation, health_epoch
      from public.get_health_dependent_consent_status('photo_capture')$$,
  $$values ('photo_capture'::text, 'unconsented'::text, 0::bigint, null::bigint)$$,
  'dependent status exposes the exact initial generation without table access'
);
select lives_ok(
  $$select * from public.grant_health_data_consent(
    0, 'draft-v1-2026-07-10',
    '7957a2811fff0e8cefc6f7180b751ec45688fe99421978eedae05b96c2f251fd'
  )$$,
  'the adversary owner opens an exact base epoch'
);
select results_eq(
  $$select consent_type, state, generation, health_epoch
      from public.get_health_dependent_consent_status('photo_capture')$$,
  $$values ('photo_capture'::text, 'unconsented'::text, 0::bigint, 1::bigint)$$,
  'an unconsented purpose receives the active base epoch needed for its initial grant CAS'
);
select throws_ok(
  $$select * from public.record_health_dependent_consent(
    1, 0, repeat('7', 64), 'photo_capture', 'draft-v1-2026-07-10',
    '58997d5c3ef5098edf6544aa2752e6878765065831ddbf42c24a364ab36cd1aa'
  )$$,
  '22023',
  'HEALTH_CONSENT_COPY_UNRECOGNIZED',
  'a cross-type copy hash cannot authorize a dependent grant'
);
select lives_ok(
  $$select * from public.record_health_dependent_consent(
    1, 0, repeat('8', 64), 'photo_capture', 'draft-v1-2026-07-10',
    '2ed9ac0c1009327c08389040d0a1db05462c39102f8730038a90ecd62de8e8c2'
  )$$,
  'an exact generation-zero capture grant advances once'
);
select results_eq(
  $$select state, generation, health_epoch
      from public.record_health_dependent_consent(
        1, 0, repeat('8', 64), 'photo_capture', 'draft-v1-2026-07-10',
        '2ed9ac0c1009327c08389040d0a1db05462c39102f8730038a90ecd62de8e8c2'
      )$$,
  $$values ('active'::text, 1::bigint, 1::bigint)$$,
  'an identical idempotent grant retry returns the original generation'
);
select is(
  (select count(*) from public.consents
    where user_id = '70000000-0000-4000-8000-000000000004'
      and consent_type = 'photo_capture' and granted),
  1::bigint,
  'an idempotent grant retry appends no duplicate receipt'
);
select throws_ok(
  $$select * from public.record_health_dependent_consent(
    1, 0, repeat('8', 64), 'ask_layerwell',
    'ask-advisor-2026-06-14-placeholder',
    '4bc7f130404b5d0d12aa52e0999efa72b1b68dd537fb90bbd708e60c561e1dcc'
  )$$,
  '55000',
  'HEALTH_DEPENDENT_IDEMPOTENCY_KEY_REUSED',
  'conflicting cross-type idempotency reuse is rejected'
);
select lives_ok(
  $$select public.pgtap_grant_health_dependent_consent(
    1, 'photo_trend_insights', repeat('9', 64)
  )$$,
  'trend grant requires and observes active capture'
);
select lives_ok(
  $$select * from public.begin_health_dependent_consent_withdrawal(
    1, 1, 'photo_trend_insights', repeat('a', 64),
    'photo-trend-insights-2026-06-13-placeholder',
    'd6bd89ffbb0900784d4af6d8ae1501c7e10385eeba199e1bd8e932d957eec6ba'
  )$$,
  'trend withdrawal publishes its own durable barrier first'
);
reset role;
select pg_catalog.set_config(
  'test.owner4_trend_operation',
  (select current_operation_id::text
    from public.health_dependent_consent_states
   where user_id = '70000000-0000-4000-8000-000000000004'
     and consent_type = 'photo_trend_insights'),
  true
);
set local role authenticated;
select lives_ok(
  $$select * from public.begin_health_dependent_consent_withdrawal(
    1, 1, 'photo_capture', repeat('b', 64), 'draft-v1-2026-07-10',
    '553229a2862dd3d280058e7413b3bc85795932dec2f6ca9bed420b7598e54c51'
  )$$,
  'capture withdrawal closes after an independently withdrawing child'
);
reset role;
select pg_catalog.set_config(
  'test.owner4_capture_operation',
  (select current_operation_id::text
    from public.health_dependent_consent_states
   where user_id = '70000000-0000-4000-8000-000000000004'
     and consent_type = 'photo_capture'),
  true
);
update public.health_dependent_consent_operations
   set attempt_count = 999
 where id = pg_catalog.current_setting('test.owner4_capture_operation')::uuid;
select ok(
  exists (
    select 1
      from public.health_dependent_consent_states as states
     where states.user_id = '70000000-0000-4000-8000-000000000004'
       and states.consent_type = 'photo_trend_insights'
       and states.state = 'withdrawing'
       and states.current_operation_id =
         pg_catalog.current_setting('test.owner4_trend_operation')::uuid
       and states.parent_withdrawal_operation_id is null
  ),
  'capture begin preserves an already-withdrawing child original operation binding'
);
set local role service_role;
select is(
  (select count(*) from public.claim_due_health_dependent_consent_withdrawals(
    repeat('c', 64), 10
  ) where user_id = '70000000-0000-4000-8000-000000000004'),
  2::bigint,
  'the durable worker adopts both lost-device dependent operations'
);
select throws_ok(
  $$select * from public.mark_health_dependent_consent_withdrawal_action_required(
    pg_catalog.current_setting('test.owner4_trend_operation')::uuid,
    repeat('c', 64), 'DEPENDENT_CLEANUP_FAILED'
  )$$,
  '22023',
  'HEALTH_DEPENDENT_ACTION_REQUIRED_INPUT_INVALID',
  'a transient result code cannot manufacture durable operator state'
);
select results_eq(
  $$select operation_id, state, result_code
      from public.mark_health_dependent_consent_withdrawal_action_required(
        pg_catalog.current_setting('test.owner4_trend_operation')::uuid,
        repeat('c', 64), 'DEPENDENT_PROVIDER_BOUND_EXCEEDED'
      )$$,
  $$values (
    pg_catalog.current_setting('test.owner4_trend_operation')::uuid,
    'action_required'::text,
    'DEPENDENT_PROVIDER_BOUND_EXCEEDED'::text
  )$$,
  'an allowlisted provider-bound result atomically becomes durable action-required'
);
select results_eq(
  $$select operation_id, state, result_code
      from public.mark_health_dependent_consent_withdrawal_action_required(
        pg_catalog.current_setting('test.owner4_trend_operation')::uuid,
        repeat('c', 64), 'DEPENDENT_PROVIDER_BOUND_EXCEEDED'
      )$$,
  $$values (
    pg_catalog.current_setting('test.owner4_trend_operation')::uuid,
    'action_required'::text,
    'DEPENDENT_PROVIDER_BOUND_EXCEEDED'::text
  )$$,
  'an action-required transition truthfully replays after response loss'
);
reset role;
update public.health_dependent_consent_operations
   set worker_lease_expires_at = now() - interval '1 second',
       next_attempt_at = now()
 where id = pg_catalog.current_setting('test.owner4_capture_operation')::uuid;
set local role service_role;
select is(
  (select count(*) from public.claim_due_health_dependent_consent_withdrawals(
    repeat('d', 64), 10
  ) where user_id = '70000000-0000-4000-8000-000000000004'),
  0::bigint,
  'an expired thousandth dependent lease becomes durable action-required without a 1,001st claim'
);
select results_eq(
  $$select operation_id, state, result_code
      from public.defer_health_dependent_consent_withdrawal(
        pg_catalog.current_setting('test.owner4_capture_operation')::uuid,
        repeat('c', 64), 'DEPENDENT_CLEANUP_FAILED', 60
      )$$,
  $$values (
    pg_catalog.current_setting('test.owner4_capture_operation')::uuid,
    'action_required'::text,
    'WORKER_RETRY_EXHAUSTED'::text
  )$$,
  'the thousandth claimed attempt reports its durable terminal truth instead of a deferral'
);
select results_eq(
  $$select operation_id, state, result_code
      from public.defer_health_dependent_consent_withdrawal(
        pg_catalog.current_setting('test.owner4_capture_operation')::uuid,
        repeat('c', 64), 'DEPENDENT_CLEANUP_FAILED', 60
      )$$,
  $$values (
    pg_catalog.current_setting('test.owner4_capture_operation')::uuid,
    'action_required'::text,
    'WORKER_RETRY_EXHAUSTED'::text
  )$$,
  'retry exhaustion attestation truthfully replays after response loss'
);
select lives_ok(
  $$select * from public.complete_health_dependent_consent_withdrawal(
    pg_catalog.current_setting('test.owner4_capture_operation')::uuid
  )$$,
  'aggregate capture zero-attestation completes capture and the preserved child'
);
reset role;
select ok(
  (select count(*) from public.health_dependent_consent_states
    where user_id = '70000000-0000-4000-8000-000000000004'
      and consent_type in ('photo_capture', 'photo_trend_insights')
      and state = 'withdrawn') = 2
  and (select count(*) from public.health_dependent_consent_operations
    where user_id = '70000000-0000-4000-8000-000000000004'
      and action = 'withdraw' and state = 'completed') = 2,
  'capture completion terminally settles both original durable operations'
);
set local role authenticated;
select results_eq(
  $$select operation_id, state, consent_generation
      from public.begin_health_dependent_consent_withdrawal(
        1, 1, 'photo_trend_insights', repeat('a', 64),
        'photo-trend-insights-2026-06-13-placeholder',
        'd6bd89ffbb0900784d4af6d8ae1501c7e10385eeba199e1bd8e932d957eec6ba'
      )$$,
  $$values (
    pg_catalog.current_setting('test.owner4_trend_operation')::uuid,
    'withdrawn'::text,
    2::bigint
  )$$,
  'the original child key truthfully replays after aggregate completion'
);
reset role;
set local role service_role;
select is(
  (select count(*) from public.claim_due_health_dependent_consent_withdrawals(
    repeat('d', 64), 10
  ) where user_id = '70000000-0000-4000-8000-000000000004'),
  0::bigint,
  'no orphaned due child operation remains after aggregate completion'
);
reset role;
set local role authenticated;
select lives_ok(
  $$select * from public.record_health_dependent_consent(
    1, 2, repeat('d', 64), 'photo_capture', 'draft-v1-2026-07-10',
    '2ed9ac0c1009327c08389040d0a1db05462c39102f8730038a90ecd62de8e8c2'
  )$$,
  'fresh capture consent advances after terminal aggregate cleanup'
);
select throws_ok(
  $$select * from public.record_health_dependent_consent(
    1, 1, repeat('e', 64), 'photo_trend_insights',
    'photo-trend-insights-2026-06-13-placeholder',
    '58997d5c3ef5098edf6544aa2752e6878765065831ddbf42c24a364ab36cd1aa'
  )$$,
  '55000',
  'HEALTH_DEPENDENT_CONSENT_GENERATION_STALE',
  'a stale child grant loses the capture withdrawal ordering race'
);
select lives_ok(
  $$select * from public.record_health_dependent_consent(
    1, 2, repeat('f', 64), 'photo_trend_insights',
    'photo-trend-insights-2026-06-13-placeholder',
    '58997d5c3ef5098edf6544aa2752e6878765065831ddbf42c24a364ab36cd1aa'
  )$$,
  'fresh child consent must be separately regranted after capture reconsent'
);
select lives_ok(
  $$select public.pgtap_grant_health_dependent_consent(
    1, 'ask_layerwell', repeat('0', 64)
  )$$,
  'Ask consent opens independently for base-interleaving proof'
);
select lives_ok(
  $$select * from public.begin_health_dependent_consent_withdrawal(
    1, 1, 'ask_layerwell', repeat('c', 64),
    'ask-advisor-2026-06-14-placeholder',
    '5ef385c3e618e3a4167b7096b3d99ffe3d22468269f6d899a51527b7959c9aff'
  )$$,
  'a granular Ask withdrawal begins before base withdrawal'
);
reset role;
select pg_catalog.set_config(
  'test.owner4_ask_operation',
  (select current_operation_id::text
    from public.health_dependent_consent_states
   where user_id = '70000000-0000-4000-8000-000000000004'
     and consent_type = 'ask_layerwell'),
  true
);
set local role authenticated;
select lives_ok(
  $$select * from public.begin_health_data_consent_withdrawal(
    1, repeat('2', 64), 'draft-v1-2026-07-10',
    '5200ef21982670cf73539d8a7d3e0f9c2219b40ee8d63be0a83d3e10043ba37f'
  )$$,
  'base withdrawal subsumes active purposes without hijacking granular work'
);
reset role;
select pg_catalog.set_config(
  'test.owner4_base_operation',
  (select current_operation_id::text from public.health_processing_states
    where user_id = '70000000-0000-4000-8000-000000000004'),
  true
);
select ok(
  exists (
    select 1 from public.health_dependent_consent_states as states
     where states.user_id = '70000000-0000-4000-8000-000000000004'
       and states.consent_type = 'ask_layerwell'
       and states.current_operation_id =
         pg_catalog.current_setting('test.owner4_ask_operation')::uuid
       and states.base_withdrawal_operation_id is null
  ),
  'base begin preserves the earlier granular idempotency binding'
);
set local role service_role;
select lives_ok(
  $$select * from public.claim_health_consent_withdrawal_for_owner(
    '70000000-0000-4000-8000-000000000004',
    pg_catalog.current_setting('test.owner4_base_operation')::uuid,
    repeat('3', 64)
  )$$,
  'service worker claims the aggregate base operation'
);
select lives_ok(
  $$select * from public.prepare_health_data_consent_withdrawal(
    pg_catalog.current_setting('test.owner4_base_operation')::uuid,
    repeat('3', 64)
  )$$,
  'aggregate cleanup supplies the stronger zero-attestation'
);
select lives_ok(
  $$select * from public.complete_health_data_consent_withdrawal(
    pg_catalog.current_setting('test.owner4_base_operation')::uuid,
    repeat('3', 64)
  )$$,
  'base completion terminally settles preserved granular work only after zero'
);
reset role;
select ok(
  exists (
    select 1 from public.health_dependent_consent_operations as operations
     where operations.id =
       pg_catalog.current_setting('test.owner4_ask_operation')::uuid
       and operations.state = 'completed'
       and operations.last_result_code = 'PARENT_BASE_WITHDRAWAL_COMPLETED'
  )
  and not exists (
    select 1 from public.health_dependent_consent_operations as operations
     where operations.user_id = '70000000-0000-4000-8000-000000000004'
       and operations.action = 'withdraw'
       and operations.state in ('pending', 'action_required')
  ),
  'base completion leaves no due or orphaned dependent operation'
);
set local role authenticated;
select results_eq(
  $$select operation_id, state, consent_generation
      from public.begin_health_dependent_consent_withdrawal(
        1, 1, 'ask_layerwell', repeat('c', 64),
        'ask-advisor-2026-06-14-placeholder',
        '5ef385c3e618e3a4167b7096b3d99ffe3d22468269f6d899a51527b7959c9aff'
      )$$,
  $$values (
    pg_catalog.current_setting('test.owner4_ask_operation')::uuid,
    'withdrawn'::text,
    2::bigint
  )$$,
  'the original granular key truthfully replays after base completion'
);
select lives_ok(
  $$select * from public.grant_health_data_consent(
    1, 'draft-v1-2026-07-10',
    '7957a2811fff0e8cefc6f7180b751ec45688fe99421978eedae05b96c2f251fd'
  )$$,
  'a fresh base grant opens the next epoch without mutating terminal dependent history'
);
select results_eq(
  $$select state, generation, health_epoch
      from public.get_health_dependent_consent_status('ask_layerwell')$$,
  $$values ('withdrawn'::text, 2::bigint, 2::bigint)$$,
  'withdrawn status exposes fresh active base epoch context instead of stale row authority'
);
reset role;
select is(
  (select health_epoch
     from public.health_dependent_consent_states
    where user_id = '70000000-0000-4000-8000-000000000004'
      and consent_type = 'ask_layerwell'),
  1::bigint,
  'fresh base consent does not rewrite the withdrawn purpose historical epoch'
);

-- Cross-owner report/moderation evidence must survive removal of the health-UGC
-- author. A second question rehearses the pre-existing granular service delete,
-- which reaches the same ON DELETE SET NULL referential action without a health
-- purge marker or reporter epoch header.
update public.health_processing_states
   set state = 'active',
       epoch = 1,
       consent_version = 'draft-v1-2026-07-10',
       consent_text_hash =
         '7957a2811fff0e8cefc6f7180b751ec45688fe99421978eedae05b96c2f251fd',
       current_operation_id = null,
       last_server_verified_at = pg_catalog.clock_timestamp()
 where user_id = '70000000-0000-4000-8000-000000000003';
set local role authenticated;
select pg_catalog.set_config(
  'request.jwt.claims',
  '{"sub":"70000000-0000-4000-8000-000000000001","role":"authenticated","session_id":"71000000-0000-4000-8000-000000000001"}',
  true
);
select pg_catalog.set_config(
  'test.community_consent_a',
  public.pgtap_grant_health_dependent_consent(
    1, 'community_participation', repeat('1', 64)
  )::text,
  true
);
select pg_catalog.set_config(
  'request.jwt.claims',
  '{"sub":"70000000-0000-4000-8000-000000000003","role":"authenticated","session_id":"71000000-0000-4000-8000-000000000003"}',
  true
);
select pg_catalog.set_config(
  'test.community_consent_c',
  public.pgtap_grant_health_dependent_consent(
    1, 'community_participation', repeat('2', 64)
  )::text,
  true
);
select pg_catalog.set_config(
  'test.photo_capture_consent_c',
  public.pgtap_grant_health_dependent_consent(
    1, 'photo_capture', repeat('4', 64)
  )::text,
  true
);
select pg_catalog.set_config(
  'test.photo_backup_consent_c',
  public.pgtap_grant_health_dependent_consent(
    1, 'photo_cloud_backup', repeat('3', 64)
  )::text,
  true
);
reset role;
insert into public.community_topics (id, slug, title)
values (
  '73000000-0000-4000-8000-000000000010',
  'health-withdrawal-contract',
  'Health withdrawal contract'
);
select pg_catalog.set_config(
  'request.headers',
  '{"x-health-processing-epoch":"1","x-client-info":"pgtap; health-consent-generation=community_participation:1"}',
  true
);
insert into public.community_questions (
  id, user_id, topic_id, body, anon_handle, consent_grant_id
) values
  (
    '73000000-0000-4000-8000-000000000011',
    '70000000-0000-4000-8000-000000000001',
    '73000000-0000-4000-8000-000000000010',
    'Author one health-bearing question', 'anon-author-one',
    pg_catalog.current_setting('test.community_consent_a')::uuid
  ),
  (
    '73000000-0000-4000-8000-000000000012',
    '70000000-0000-4000-8000-000000000003',
    '73000000-0000-4000-8000-000000000010',
    'Granular deletion rehearsal', 'anon-author-three',
    pg_catalog.current_setting('test.community_consent_c')::uuid
  );
update public.community_questions
   set moderation_state = 'approved'
 where id = '73000000-0000-4000-8000-000000000011';
insert into public.community_reports (id, reporter_id, question_id, reason) values
  (
    '73000000-0000-4000-8000-000000000021',
    '70000000-0000-4000-8000-000000000003',
    '73000000-0000-4000-8000-000000000011',
    'cross-owner safety evidence'
  ),
  (
    '73000000-0000-4000-8000-000000000022',
    '70000000-0000-4000-8000-000000000001',
    '73000000-0000-4000-8000-000000000011',
    'author-owned report must be erased'
  ),
  (
    '73000000-0000-4000-8000-000000000023',
    '70000000-0000-4000-8000-000000000001',
    '73000000-0000-4000-8000-000000000012',
    'granular cross-owner detach rehearsal'
  );
insert into public.community_moderation_events (id, question_id, action, reason) values
  (
    '73000000-0000-4000-8000-000000000031',
    '73000000-0000-4000-8000-000000000011',
    'removed_after_report', 'preserve detached audit'
  ),
  (
    '73000000-0000-4000-8000-000000000032',
    '73000000-0000-4000-8000-000000000012',
    'removed_after_report', 'granular detached audit'
  );

select pg_catalog.set_config('request.headers', '{}', true);
set local role service_role;
select lives_ok(
  $$delete from public.community_questions
     where id = '73000000-0000-4000-8000-000000000012'$$,
  'granular service deletion can detach cross-owner safety evidence'
);
reset role;
select ok(
  exists (
    select 1 from public.community_reports
     where id = '73000000-0000-4000-8000-000000000023'
       and question_id is null
  )
    and exists (
      select 1 from public.community_moderation_events
       where id = '73000000-0000-4000-8000-000000000032'
         and question_id is null
    ),
  'granular deletion preserves reporter and moderation evidence as detached rows'
);
set local role service_role;
select throws_ok(
  $$update public.community_reports
       set reason = 'direct service mutation remains fenced'
     where id = '73000000-0000-4000-8000-000000000021'$$,
  '55000',
  'HEALTH_PROCESSING_EPOCH_REQUIRED',
  'ordinary report updates cannot misuse the narrow nested FK detach allowance'
);
reset role;
select pg_catalog.set_config('request.headers', '{}', true);

set local role authenticated;
select pg_catalog.set_config(
  'request.jwt.claims',
  '{"sub":"70000000-0000-4000-8000-000000000003","role":"authenticated","session_id":"71000000-0000-4000-8000-000000000003"}',
  true
);
select pg_catalog.set_config(
  'request.headers',
  public.pgtap_health_headers(1, array['community_participation']),
  true
);
select is(
  (select count(*) from public.community_questions
    where id = '73000000-0000-4000-8000-000000000011'),
  1::bigint,
  'an active viewer may read an approved question while its row owner is active'
);
reset role;
select pg_catalog.set_config(
  'request.jwt.claims',
  '{"sub":"70000000-0000-4000-8000-000000000001","role":"authenticated","session_id":"71000000-0000-4000-8000-000000000001"}',
  true
);

set local role authenticated;
select results_eq(
  $$select consent_version, consent_text_hash
      from public.get_health_data_consent_status()$$,
  $$values (
    'draft-v1-2026-07-10'::text,
    '7957a2811fff0e8cefc6f7180b751ec45688fe99421978eedae05b96c2f251fd'::text
  )$$,
  'active status exposes the bounded server-authoritative grant copy'
);
select lives_ok(
  $$select * from public.grant_health_data_consent(
    0, 'draft-v1-2026-07-10',
    '7957a2811fff0e8cefc6f7180b751ec45688fe99421978eedae05b96c2f251fd'
  )$$,
  'an exact active grant retry is idempotent'
);
select throws_ok(
  $$select * from public.grant_health_data_consent(
    1, 'draft-v1-2026-07-10', repeat('d', 64)
  )$$,
  '22023',
  'HEALTH_CONSENT_COPY_UNRECOGNIZED',
  'an active account cannot switch to caller-invented disclosure copy'
);
reset role;
select is(
  (select count(*) from public.consents
    where user_id = '70000000-0000-4000-8000-000000000001'
      and consent_type = 'health_data_collection' and granted is true),
  1::bigint,
  'active grant retries and rejected copy changes mint no receipt or epoch'
);

create or replace function public.pgtap_fail_dependent_consent_after_insert()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if pg_catalog.current_setting('pgtap.fail_dependent_insert', true) = '1'
     and new.consent_type = 'ask_layerwell'
     and new.granted then
    raise exception 'PGTAP_DEPENDENT_INSERT_FAILURE' using errcode = 'P0001';
  end if;
  return new;
end;
$$;
create trigger zz_pgtap_fail_dependent_consent_after_insert
  after insert on public.consents
  for each row execute function public.pgtap_fail_dependent_consent_after_insert();

set local role authenticated;
select pg_catalog.set_config('request.headers', '{}', true);
select throws_ok(
  $$insert into public.skin_profiles (user_id, goals)
    values ('70000000-0000-4000-8000-000000000001', array['blocked'])$$,
  '55000',
  'HEALTH_PROCESSING_EPOCH_REQUIRED',
  'health publication without an epoch is rejected'
);
select pg_catalog.set_config(
  'request.headers', '{"x-health-processing-epoch":"1"}', true
);
select lives_ok(
  $$insert into public.skin_profiles (
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
      '70000000-0000-4000-8000-000000000001',
      0, 0, 0, 0,
      3,
      5,
      array['fragrance'],
      'none',
      array['clear_skin'],
      '2026-07-26T00:00:00Z'::timestamptz,
      2,
      'OSPW',
      5000, 5000, 5000, 5000,
      'urn:layerwell:onboarding:skin-profile',
      'draft-2026-07-04',
      'draft-1',
      1,
      'be00ee6008ca03fbcb53e7256432cd044e6131e9aecd5bf90809b2a57cde39bb',
      'ffd16579edad35b21377244c41af69419248faa3f8f2238183c58a5a8893c893',
      '95022003f5dfa1fff5e95b846a9d48ef6ecc9dc97af341fb311afaa9aadd1c16',
      'launch-blocked',
      'raw_score_greater_than_or_equal_to_zero_uses_positive_pole'
    )$$,
  'an active authenticated owner can publish the exact current v2 profile through the real table'
);
select results_eq(
  $$select version, dspt, oily_dry_basis_points, quiz_contract_sha256,
      quiz_review_status
      from public.skin_profiles
     where user_id = '70000000-0000-4000-8000-000000000001'$$,
  $$values (
    2::integer,
    'OSPW'::text,
    5000::integer,
    '95022003f5dfa1fff5e95b846a9d48ef6ecc9dc97af341fb311afaa9aadd1c16'::text,
    'launch-blocked'::text
  )$$,
  'the owner reads the exact constrained v2 provenance row through real RLS and the health read fence'
);
select throws_ok(
  $$insert into public.routines (id, user_id, type, name) values (
      '74000000-0000-4000-8000-000000000001',
      '70000000-0000-4000-8000-000000000001',
      'AM',
      'Read-fence ownership probe'
  )$$,
  '42501',
  'new row violates row-level security policy for table "routines"',
  'the current sync bridge seals direct authenticated routine creation'
);
reset role;
insert into public.routines (id, user_id, type, name) values (
  '74000000-0000-4000-8000-000000000001',
  '70000000-0000-4000-8000-000000000001',
  'AM',
  'Read-fence ownership probe'
);
set local role authenticated;
select ok(
  public.owns_routine('74000000-0000-4000-8000-000000000001'),
  'the public ownership helper remains usable while health processing is active'
);
select lives_ok(
  $$select * from public.set_routine_adherence_timezone('America/Toronto')$$,
  'the exact-session adherence RPC may publish only a server-owned cache under the active epoch'
);
select pg_catalog.set_config(
  'request.jwt.claims',
  '{"sub":"70000000-0000-4000-8000-000000000001","role":"authenticated","session_id":"71000000-0000-4000-8000-000000000099"}',
  true
);
select throws_ok(
  $$select public.pgtap_grant_health_dependent_consent(
      1, 'photo_capture', repeat('6', 64)
    )$$,
  '28000',
  'HEALTH_CONSENT_SESSION_REJECTED',
  'a dependent grant rejects a JWT session that is not current for the owner'
);
select pg_catalog.set_config(
  'request.jwt.claims',
  '{"sub":"70000000-0000-4000-8000-000000000001","role":"authenticated","session_id":"71000000-0000-4000-8000-000000000001"}',
  true
);
select pg_catalog.set_config(
  'app.health_consent_rpc',
  '70000000-0000-4000-8000-000000000001',
  true
);
select throws_ok(
  $$insert into public.consents (
      user_id, consent_type, granted, version, consent_text_hash
    ) values (
      '70000000-0000-4000-8000-000000000001',
      'photo_cloud_backup', true, 'health-consent-v1', repeat('a', 64)
    )$$,
  '42501',
  'HEALTH_CONSENT_RECEIPT_CAPABILITY_REQUIRED',
  'an authenticated caller cannot spoof the legacy GUC to bypass the exact-epoch RPC'
);
reset role;
set local role service_role;
select throws_ok(
  $$insert into public.consents (
      user_id, consent_type, granted, version, consent_text_hash
    ) values (
      '70000000-0000-4000-8000-000000000001',
      'photo_capture', true, 'service-spoof-v1', repeat('5', 64)
    )$$,
  '42501',
  'HEALTH_CONSENT_RECEIPT_CAPABILITY_REQUIRED',
  'service role cannot spoof the legacy GUC to mint a dependent grant'
);
reset role;
select pg_catalog.set_config('app.health_consent_rpc', '', true);
set local role authenticated;
select lives_ok(
  $$select public.pgtap_grant_health_dependent_consent(
      1, 'photo_capture', repeat('b', 64)
    )$$,
  'the exact active epoch may append photo-capture consent first'
);
select lives_ok(
  $$select public.pgtap_grant_health_dependent_consent(
      1, 'photo_cloud_backup', repeat('a', 64)
    )$$,
  'the exact active epoch may append a separate dependent consent receipt'
);
select is(
  (select count(*) from public.consents
    where user_id = '70000000-0000-4000-8000-000000000001'
      and consent_type = 'photo_cloud_backup'
      and granted is true),
  1::bigint,
  'the epoch-bound dependent grant appends exactly one immutable receipt'
);
select pg_catalog.set_config('pgtap.fail_dependent_insert', '1', true);
select throws_ok(
  $$select public.pgtap_grant_health_dependent_consent(
      1, 'ask_layerwell', repeat('4', 64)
    )$$,
  'P0001',
  'PGTAP_DEPENDENT_INSERT_FAILURE',
  'a downstream insert failure rolls the sealed dependent-grant capability back'
);
reset role;
select pg_catalog.set_config('pgtap.fail_dependent_insert', '0', true);
select ok(
  exists (
    select 1
      from public.health_processing_states as states
     where states.user_id = '70000000-0000-4000-8000-000000000001'
       and states.receipt_capability_xid is null
       and states.receipt_capability_backend_pid is null
       and states.receipt_capability_consent_type is null
       and states.receipt_capability_action is null
  ),
  'an exception leaves no reusable dependent-grant capability'
);
drop trigger zz_pgtap_fail_dependent_consent_after_insert on public.consents;
drop function public.pgtap_fail_dependent_consent_after_insert();
set local role authenticated;
select lives_ok(
  $$select public.pgtap_grant_health_dependent_consent(
      1, 'ask_layerwell', repeat('4', 64)
    )$$,
  'the exact dependent grant can be retried after transaction rollback'
);
select throws_ok(
  $$insert into public.consents (
      user_id, consent_type, granted, version, consent_text_hash, revoked_at
    ) values (
      '70000000-0000-4000-8000-000000000001',
      'ask_layerwell', false, 'ask-advisor-2026-06-14-placeholder',
      '5ef385c3e618e3a4167b7096b3d99ffe3d22468269f6d899a51527b7959c9aff', now()
    )$$,
  '42501',
  'HEALTH_CONSENT_RECEIPT_CAPABILITY_REQUIRED',
  'even a protected false receipt requires the sealed withdrawal lifecycle'
);
select is(
  (select count(*) from public.consents
    where user_id = '70000000-0000-4000-8000-000000000001'
      and consent_type = 'ask_layerwell'
      and granted is false),
  0::bigint,
  'a rejected direct protected false receipt appends nothing'
);
reset role;
insert into public.account_deletion_operations (
  id,
  user_id,
  idempotency_digest,
  capability_digest,
  expires_at
) values (
  '76000000-0000-4000-8000-000000000001',
  '70000000-0000-4000-8000-000000000003',
  repeat('4', 64),
  repeat('5', 64),
  now() + interval '1 day'
);
insert into public.account_deletion_barriers (
  user_id,
  operation_id,
  expires_at
) values (
  '70000000-0000-4000-8000-000000000003',
  '76000000-0000-4000-8000-000000000001',
  now() + interval '1 day'
);
set local role authenticated;
select pg_catalog.set_config(
  'request.jwt.claims',
  '{"sub":"70000000-0000-4000-8000-000000000003","role":"authenticated","session_id":"71000000-0000-4000-8000-000000000003"}',
  true
);
select throws_ok(
  $$select public.pgtap_grant_health_dependent_consent(
      1, 'photo_capture', repeat('3', 64)
    )$$,
  '55000',
  'ACCOUNT_DELETION_IN_PROGRESS',
  'an account-deletion barrier prevents a new dependent grant'
);
reset role;
delete from public.account_deletion_operations
 where id = '76000000-0000-4000-8000-000000000001';
set local role authenticated;
select pg_catalog.set_config(
  'request.headers',
  public.pgtap_health_headers(
    1, array['photo_capture', 'photo_cloud_backup']
  ),
  true
);
select lives_ok(
  $$insert into storage.objects (bucket_id, name, owner, owner_id) values (
      'photos',
      '70000000-0000-4000-8000-000000000003/e1/read-fence.bin',
      '70000000-0000-4000-8000-000000000003',
      '70000000-0000-4000-8000-000000000003'
  )$$,
  'an active owner can publish an epoch-scoped photo object for read-fence rehearsal'
);
select lives_ok(
  $$insert into storage.objects (bucket_id, name, owner, owner_id)
    select 'photos',
           '70000000-0000-4000-8000-000000000003/e1/batch-'
             || pg_catalog.lpad(series.value::text, 4, '0') || '.bin',
           '70000000-0000-4000-8000-000000000003',
           '70000000-0000-4000-8000-000000000003'
      from pg_catalog.generate_series(1, 999) as series(value)$$,
  'the exact automatic Storage bound is admitted under one active generation'
);
select is(
  (select count(*) from storage.objects
    where bucket_id = 'photos'
      and pg_catalog.split_part(name, '/', 1) =
        '70000000-0000-4000-8000-000000000003'),
  1000::bigint,
  'exactly one thousand owned Storage objects remain eligible for bounded cleanup'
);
select lives_ok(
  $$select * from public.begin_health_dependent_consent_withdrawal(
    1, 1, 'photo_cloud_backup', repeat('5', 64), 'draft-v1-2026-07-10',
    'cd32873fec948532c00ed92b5052f5df95a59eef52faa5cc7e1f431e6ddd0113'
  )$$,
  'cloud-backup withdrawal publishes a barrier before Storage enumeration'
);
reset role;
select pg_catalog.set_config(
  'test.owner3_cloud_operation',
  (select current_operation_id::text
     from public.health_dependent_consent_states
    where user_id = '70000000-0000-4000-8000-000000000003'
      and consent_type = 'photo_cloud_backup'),
  true
);
set local role service_role;
select is(
  (select count(*) from public.claim_due_health_dependent_consent_withdrawals(
    repeat('6', 64), 10
  ) where operation_id =
      pg_catalog.current_setting('test.owner3_cloud_operation')::uuid),
  1::bigint,
  'the service worker claims the exact cloud Storage operation'
);
select is(
  (select count(*)
     from public.list_health_dependent_consent_storage_work(
       pg_catalog.current_setting('test.owner3_cloud_operation')::uuid,
       100,
       repeat('6', 64)
     )),
  100::bigint,
  'one thousand safe objects are released in a first bounded page of one hundred'
);
select pg_catalog.set_config('storage.allow_delete_query', 'true', true);
select lives_ok(
  $$delete from storage.objects
     where bucket_id = 'photos'
       and name in (
         select storage_path
           from public.list_health_dependent_consent_storage_work(
             pg_catalog.current_setting('test.owner3_cloud_operation')::uuid,
             100,
             repeat('6', 64)
           )
       )$$,
  'a Storage-API-attested transaction removes only the first listed page'
);
select pg_catalog.set_config('storage.allow_delete_query', 'false', true);
select is(
  (select count(*)
     from public.list_health_dependent_consent_storage_work(
       pg_catalog.current_setting('test.owner3_cloud_operation')::uuid,
       100,
       repeat('6', 64)
     )),
  100::bigint,
  'the next page remains bounded after one hundred exact deletions'
);
select results_eq(
  $$select operation_id, state, result_code
      from public.defer_health_dependent_consent_withdrawal(
        pg_catalog.current_setting('test.owner3_cloud_operation')::uuid,
        repeat('6', 64), 'DEPENDENT_WORKER_BUDGET_EXHAUSTED', 60
      )$$,
  $$values (
    pg_catalog.current_setting('test.owner3_cloud_operation')::uuid,
    'pending'::text,
    'DEPENDENT_WORKER_BUDGET_EXHAUSTED'::text
  )$$,
  'ordinary dependent deferral returns exact retryable pending truth'
);
reset role;
set local role authenticated;
select pg_catalog.set_config(
  'request.jwt.claims',
  '{"sub":"70000000-0000-4000-8000-000000000001","role":"authenticated","session_id":"71000000-0000-4000-8000-000000000001"}',
  true
);
select is(
  (select count(*) from storage.objects
    where bucket_id = 'photos'
      and name = '70000000-0000-4000-8000-000000000003/e1/read-fence.bin'),
  1::bigint,
  'an active viewer can read the Storage control row through the permissive rehearsal policy'
);
reset role;
set local role authenticated;
select throws_ok(
  $$select * from public.begin_health_data_consent_withdrawal(
    1, repeat('9', 64), 'draft-v1-2026-07-10', repeat('a', 64)
  )$$,
  '22023',
  'HEALTH_CONSENT_COPY_UNRECOGNIZED',
  'direct authenticated RPC cannot invent a withdrawal receipt'
);
select lives_ok(
  $$select * from public.begin_health_data_consent_withdrawal(
    1, repeat('b', 64), 'draft-v1-2026-07-10',
    '5200ef21982670cf73539d8a7d3e0f9c2219b40ee8d63be0a83d3e10043ba37f'
  )$$,
  'withdrawal atomically closes the active epoch'
);
select throws_ok(
  $$select public.pgtap_grant_health_dependent_consent(
      1, 'photo_capture', repeat('c', 64)
    )$$,
  '55000',
  'HEALTH_PROCESSING_NOT_ACTIVE',
  'a stale dependent-consent continuation cannot append after withdrawal'
);
reset role;
select ok(
  exists (
    select 1 from public.health_processing_states
     where user_id = '70000000-0000-4000-8000-000000000001'
       and state = 'withdrawing' and epoch = 1 and current_operation_id is not null
  ),
  'withdrawal publishes the durable processing barrier'
);
select pg_catalog.set_config(
  'test.health_operation_a',
  (select current_operation_id::text from public.health_processing_states where user_id = '70000000-0000-4000-8000-000000000001'),
  true
);
select ok(
  exists (select 1 from auth.users where id = '70000000-0000-4000-8000-000000000001'),
  'health withdrawal preserves the Auth account'
);

set local role authenticated;
select results_eq(
  $$select
      (select count(*)::integer from public.skin_profiles
        where user_id = '70000000-0000-4000-8000-000000000001'),
      (select count(*)::integer from public.community_questions
        where id = '73000000-0000-4000-8000-000000000011'),
      (select count(*)::integer from storage.objects
        where bucket_id = 'photos'
          and name = '70000000-0000-4000-8000-000000000003/e1/read-fence.bin')$$,
  $$values (0::integer, 0::integer, 0::integer)$$,
  'the committed begin barrier immediately hides database, shared-community, and photo Storage health data'
);
select ok(
  not public.owns_routine('74000000-0000-4000-8000-000000000001'),
  'a public security-definer ownership helper cannot probe caller-hidden residual health data'
);
select ok(
  exists (
    select 1 from public.profiles
     where id = '70000000-0000-4000-8000-000000000001'
       and current_streak = 0
       and longest_streak = 0
       and adherence_timezone is null
       and streak_reference_day is null
       and streak_algorithm_version = 0
  )
    and exists (
      select 1 from public.consents
       where user_id = '70000000-0000-4000-8000-000000000001'
    )
    and exists (
      select 1 from public.entitlements
       where user_id = '70000000-0000-4000-8000-000000000001'
         and is_active
    )
    and (
      select status.state from public.get_health_data_consent_status() as status
    ) = 'withdrawing',
  'account shell, policy ledger, billing entitlement, and lifecycle status remain readable after the barrier'
);
reset role;

set local role authenticated;
select pg_catalog.set_config(
  'request.jwt.claims',
  '{"sub":"70000000-0000-4000-8000-000000000003","role":"authenticated","session_id":"71000000-0000-4000-8000-000000000003"}',
  true
);
select is(
  (select count(*) from public.community_questions
    where id = '73000000-0000-4000-8000-000000000011'),
  0::bigint,
  'an active viewer cannot read an approved question once its row owner starts withdrawing'
);
reset role;
select pg_catalog.set_config(
  'request.jwt.claims',
  '{"sub":"70000000-0000-4000-8000-000000000001","role":"authenticated","session_id":"71000000-0000-4000-8000-000000000001"}',
  true
);

set local role service_role;
select results_eq(
  $$select
      (select count(*)::integer from public.skin_profiles
        where user_id = '70000000-0000-4000-8000-000000000001'),
      (select count(*)::integer from public.community_questions
        where id = '73000000-0000-4000-8000-000000000011'),
      (select count(*)::integer from storage.objects
        where bucket_id = 'photos'
          and name = '70000000-0000-4000-8000-000000000003/e1/read-fence.bin')$$,
  $$values (1::integer, 1::integer, 1::integer)$$,
  'service cleanup/export authority can still inspect caller-hidden health and Storage rows'
);
reset role;
select pass(
  'the active control owner Storage row remains outside the withdrawing owner cleanup inventory'
);

set local role authenticated;
select throws_ok(
  $$insert into public.consents (
      user_id, consent_type, granted, version, consent_text_hash, revoked_at
    ) values (
      '70000000-0000-4000-8000-000000000001',
      'health_data_collection', false, 'direct', repeat('d', 64), now()
  )$$,
  '42501',
  'HEALTH_CONSENT_RECEIPT_CAPABILITY_REQUIRED',
  'the authenticated trigger denies direct health revocation'
);
select throws_ok(
  $$insert into public.skin_profiles (user_id, goals)
    values ('70000000-0000-4000-8000-000000000001', array['late'])$$,
  '55000',
  'HEALTH_PROCESSING_NOT_ACTIVE',
  'delayed health publication is rejected after the barrier commits'
);
select pg_catalog.set_config(
  'app.health_purge', '70000000-0000-4000-8000-000000000001', true
);
select throws_ok(
  $$update public.profiles
       set current_streak = 1, longest_streak = 1
     where id = '70000000-0000-4000-8000-000000000001'$$,
  '42501',
  'permission denied for table profiles',
  'authenticated callers cannot spoof the transaction-local purge marker or reach server-owned cache columns'
);
select pg_catalog.set_config('app.health_purge', '', true);
select lives_ok(
  $$update public.profiles
       set display_name = 'Preserved shell'
     where id = '70000000-0000-4000-8000-000000000001'$$,
  'shell-only profile edits remain available during withdrawal'
);
select lives_ok(
  $$select * from public.begin_health_data_consent_withdrawal(
    1, repeat('b', 64), 'draft-v1-2026-07-10',
    '5200ef21982670cf73539d8a7d3e0f9c2219b40ee8d63be0a83d3e10043ba37f'
  )$$,
  'an identical withdrawal retry returns the durable operation'
);
reset role;
select is(
  (select count(*) from public.consents where user_id = '70000000-0000-4000-8000-000000000001' and consent_type = 'health_data_collection' and granted is false),
  2::bigint,
  'an identical withdrawal retry does not duplicate the revocation receipt'
);

set local role authenticated;
select throws_ok(
  $$select * from public.begin_health_data_consent_withdrawal(
    1, repeat('e', 64), 'draft-v1-2026-07-10',
    '5200ef21982670cf73539d8a7d3e0f9c2219b40ee8d63be0a83d3e10043ba37f'
  )$$,
  '55000',
  'HEALTH_WITHDRAWAL_ALREADY_EXISTS',
  'a second key cannot create a competing operation in the same epoch'
);
reset role;
select throws_ok(
  $$insert into public.consents (
      user_id, consent_type, granted, version, consent_text_hash, revoked_at
    ) values (
      '70000000-0000-4000-8000-000000000001',
      'health_data_collection', false, 'service-direct', repeat('d', 64), now()
  )$$,
  '42501',
  'HEALTH_CONSENT_RECEIPT_CAPABILITY_REQUIRED',
  'the trigger also denies an uncoupled privileged health revocation'
);

set local role service_role;
select pg_catalog.set_config(
  'app.health_purge', '70000000-0000-4000-8000-000000000001', true
);
select throws_ok(
  $$update public.profiles
       set current_streak = 1, longest_streak = 1
     where id = '70000000-0000-4000-8000-000000000001'$$,
  '42501',
  'permission denied for table profiles',
  'service-role writes cannot spoof the transaction-local purge marker or reach server-owned cache columns'
);
select pg_catalog.set_config('app.health_purge', '', true);
reset role;

set local role authenticated;
select throws_ok(
  $$select * from public.claim_health_consent_withdrawal_for_owner(
    '70000000-0000-4000-8000-000000000001',
    pg_catalog.current_setting('test.health_operation_a')::uuid,
    repeat('a', 64)
  )$$,
  '42501',
  'permission denied for function claim_health_consent_withdrawal_for_owner',
  'an authenticated client cannot directly mint an owner cleanup lease'
);
reset role;

set local role service_role;
select lives_ok(
  $$select * from public.claim_health_consent_withdrawal_for_owner(
    '70000000-0000-4000-8000-000000000001',
    pg_catalog.current_setting('test.health_operation_a')::uuid,
    repeat('a', 64)
  )$$,
  'the JWT-verifying service obtains the owner-lane cleanup capability'
);
select lives_ok(
  $$select * from public.claim_health_consent_withdrawal_for_owner(
    '70000000-0000-4000-8000-000000000001',
    pg_catalog.current_setting('test.health_operation_a')::uuid,
    repeat('a', 64)
  )$$,
  'the same service-issued token can renew after a lost response'
);
select throws_ok(
  $$select * from public.claim_health_consent_withdrawal_for_owner(
    '70000000-0000-4000-8000-000000000003',
    pg_catalog.current_setting('test.health_operation_a')::uuid,
    repeat('a', 64)
  )$$,
  'P0002',
  'HEALTH_WITHDRAWAL_OPERATION_NOT_FOUND',
  'the service cannot bind an operation to a foreign explicit owner'
);
select throws_ok(
  $$select * from public.claim_health_consent_withdrawal_for_owner(
    '70000000-0000-4000-8000-000000000001',
    pg_catalog.current_setting('test.health_operation_a')::uuid,
    repeat('f', 64)
  )$$,
  '55P03',
  'HEALTH_WITHDRAWAL_CLAIM_ACTIVE',
  'a different service-issued token cannot preempt an unexpired cleanup lease'
);
reset role;

set local role service_role;
select throws_ok(
  $$select * from public.prepare_health_data_consent_withdrawal(
    pg_catalog.current_setting('test.health_operation_a')::uuid,
    repeat('f', 64)
  )$$,
  '55000',
  'HEALTH_WORKER_CLAIM_REJECTED',
  'a stale or invented claim token cannot mutate withdrawal state'
);
reset role;

set local role service_role;
select lives_ok(
  $$select * from public.prepare_health_data_consent_withdrawal(
    pg_catalog.current_setting('test.health_operation_a')::uuid,
    repeat('a', 64)
  )$$,
  'the service worker purges database health state and discovers Storage work'
);
reset role;
select ok(
  not public._health_relational_data_exists(
    '70000000-0000-4000-8000-000000000001'
  ),
  'the canonical relational inventory is empty after database preparation'
);
select ok(
  not exists (
    select 1 from public.community_questions
     where id = '73000000-0000-4000-8000-000000000011'
  )
    and not exists (
      select 1 from public.community_reports
       where id in (
         '73000000-0000-4000-8000-000000000022',
         '73000000-0000-4000-8000-000000000023'
       )
    )
    and exists (
      select 1 from public.community_reports
       where id = '73000000-0000-4000-8000-000000000021'
         and reporter_id = '70000000-0000-4000-8000-000000000003'
         and question_id is null
    )
    and exists (
      select 1 from public.community_moderation_events
       where id = '73000000-0000-4000-8000-000000000031'
         and question_id is null
    ),
  'health purge erases the author and own reports while detaching cross-owner safety evidence'
);
select ok(
  exists (select 1 from auth.users where id = '70000000-0000-4000-8000-000000000001')
    and exists (select 1 from public.profiles where id = '70000000-0000-4000-8000-000000000001'),
  'database cleanup preserves the account and profile shell'
);
select results_eq(
  $$select current_streak, longest_streak, adherence_timezone,
      streak_reference_day, streak_algorithm_version
      from public.profiles
     where id = '70000000-0000-4000-8000-000000000001'$$,
  $$values (0::integer, 0::integer, null::text, null::date, 0::smallint)$$,
  'authorized purge clears every profile adherence authority field once'
);

set local role service_role;
select lives_ok(
  $$select * from public.prepare_health_data_consent_withdrawal(
    pg_catalog.current_setting('test.health_operation_a')::uuid,
    repeat('a', 64)
  )$$,
  'a Storage-pending preparation retry preserves succeeded step receipts'
);
select is(
  (select count(*) from public.list_health_consent_storage_work(
    pg_catalog.current_setting('test.health_operation_a')::uuid, 100, repeat('a', 64)
  )),
  0::bigint,
  'the worker attests exact Storage absence for the zero-object operation'
);
reset role;

-- Simulate an out-of-band residual arriving after the database step receipt.
-- Completion must re-attest relational absence instead of trusting step flags.
update public.health_processing_states
   set state = 'active',
       current_operation_id = null,
       consent_version = 'draft-v1-2026-07-10',
       consent_text_hash =
         '7957a2811fff0e8cefc6f7180b751ec45688fe99421978eedae05b96c2f251fd'
 where user_id = '70000000-0000-4000-8000-000000000001';
select pg_catalog.set_config('request.headers', '{"x-health-processing-epoch":"1"}', true);
insert into public.skin_profiles (user_id, goals)
values ('70000000-0000-4000-8000-000000000001', array['residual']);
update public.health_processing_states
   set state = 'withdrawing',
       current_operation_id =
         pg_catalog.current_setting('test.health_operation_a')::uuid,
       consent_version = 'draft-v1-2026-07-10',
       consent_text_hash =
         '5200ef21982670cf73539d8a7d3e0f9c2219b40ee8d63be0a83d3e10043ba37f'
 where user_id = '70000000-0000-4000-8000-000000000001';
set local role service_role;
select throws_ok(
  $$select * from public.complete_health_data_consent_withdrawal(
    pg_catalog.current_setting('test.health_operation_a')::uuid,
    repeat('a', 64)
  )$$,
  '55000',
  'HEALTH_WITHDRAWAL_DATABASE_RESIDUAL',
  'terminal completion blocks when relational zero-attestation finds a residual row'
);
reset role;
delete from public.skin_profiles
 where user_id = '70000000-0000-4000-8000-000000000001';

set local role service_role;
select lives_ok(
  $$select * from public.complete_health_data_consent_withdrawal(
    pg_catalog.current_setting('test.health_operation_a')::uuid,
    repeat('a', 64)
  )$$,
  'exact Storage absence completes withdrawal'
);
reset role;
select is(
  (select state from public.health_processing_states where user_id = '70000000-0000-4000-8000-000000000001'),
  'withdrawn',
  'terminal withdrawal remains independent from account deletion'
);

update public.health_processing_states
   set state = 'active',
       current_operation_id = null,
       consent_version = 'draft-v1-2026-07-10',
       consent_text_hash =
         '7957a2811fff0e8cefc6f7180b751ec45688fe99421978eedae05b96c2f251fd'
 where user_id = '70000000-0000-4000-8000-000000000001';
select pg_catalog.set_config('request.headers', '{"x-health-processing-epoch":"1"}', true);
insert into public.skin_profiles (user_id, goals)
values ('70000000-0000-4000-8000-000000000001', array['withdrawn-residual']);
update public.health_processing_states
   set state = 'withdrawn',
       current_operation_id =
         pg_catalog.current_setting('test.health_operation_a')::uuid,
       consent_version = 'draft-v1-2026-07-10',
       consent_text_hash =
         '5200ef21982670cf73539d8a7d3e0f9c2219b40ee8d63be0a83d3e10043ba37f'
 where user_id = '70000000-0000-4000-8000-000000000001';
set local role authenticated;
select is(
  (select count(*) from public.skin_profiles
    where user_id = '70000000-0000-4000-8000-000000000001'),
  0::bigint,
  'withdrawn callers cannot read an out-of-band health residual'
);
reset role;
delete from public.skin_profiles
 where user_id = '70000000-0000-4000-8000-000000000001';

set local role authenticated;
select lives_ok(
  $$select * from public.grant_health_data_consent(
    1, 'draft-v1-2026-07-10',
    '7957a2811fff0e8cefc6f7180b751ec45688fe99421978eedae05b96c2f251fd'
  )$$,
  'fresh post-erasure consent opens a new empty epoch'
);
reset role;
select ok(
  exists (
    select 1 from public.health_processing_states
     where user_id = '70000000-0000-4000-8000-000000000001'
       and state = 'active' and epoch = 2 and current_operation_id is null
  ),
  'reconsent advances rather than reusing the erased epoch'
);

set local role authenticated;
select pg_catalog.set_config('request.headers', '{"x-health-processing-epoch":"1"}', true);
select throws_ok(
  $$insert into public.skin_profiles (user_id, goals)
    values ('70000000-0000-4000-8000-000000000001', array['stale'])$$,
  '55000',
  'HEALTH_PROCESSING_EPOCH_STALE',
  'old-epoch publication remains rejected after reconsent'
);
select pg_catalog.set_config('request.headers', '{"x-health-processing-epoch":"2"}', true);
select lives_ok(
  $$insert into public.skin_profiles (user_id, goals)
    values ('70000000-0000-4000-8000-000000000001', array['fresh'])$$,
  'the fresh epoch accepts new data without resurrecting old rows'
);
select throws_ok(
  $$select * from public.begin_health_data_consent_withdrawal(
    1, repeat('1', 64), 'draft-v1-2026-07-10',
    '5200ef21982670cf73539d8a7d3e0f9c2219b40ee8d63be0a83d3e10043ba37f'
  )$$,
  '55000',
  'HEALTH_PROCESSING_EPOCH_STALE',
  'a delayed old-epoch withdrawal cannot erase the fresh epoch'
);
select throws_ok(
  $$select * from public.begin_health_data_consent_withdrawal(
    2, repeat('b', 64), 'draft-v1-2026-07-10',
    '5200ef21982670cf73539d8a7d3e0f9c2219b40ee8d63be0a83d3e10043ba37f'
  )$$,
  '55000',
  'HEALTH_IDEMPOTENCY_KEY_REUSED',
  'an old idempotency key cannot be reused in a new epoch'
);

reset role;
alter table public.consents disable trigger trg_health_consent_rpc_only;
insert into public.consents (
  user_id, consent_type, granted, version, consent_text_hash
) values (
  '70000000-0000-4000-8000-000000000002',
  'health_data_collection',
  true,
  'legacy-unapproved-copy',
  repeat('c', 64)
);
alter table public.consents enable trigger trg_health_consent_rpc_only;
update public.health_processing_states
   set state = 'active',
       epoch = 1,
       consent_version = 'legacy-unapproved-copy',
       consent_text_hash = repeat('c', 64),
       current_operation_id = null
 where user_id = '70000000-0000-4000-8000-000000000002';

set local role authenticated;
select pg_catalog.set_config(
  'request.jwt.claims',
  '{"sub":"70000000-0000-4000-8000-000000000002","role":"authenticated","session_id":"71000000-0000-4000-8000-000000000002"}',
  true
);
select pg_catalog.set_config('request.headers', '{"x-health-processing-epoch":"1"}', true);
select throws_ok(
  $$insert into public.skin_profiles (user_id, goals)
    values ('70000000-0000-4000-8000-000000000002', array['old-client'])$$,
  '55000',
  'HEALTH_PROCESSING_CONSENT_STALE',
  'a stale-copy legacy state cannot admit a tampered old-client health write'
);
select throws_ok(
  $$select public.pgtap_grant_health_dependent_consent(
      1, 'photo_capture', repeat('2', 64)
    )$$,
  '55000',
  'HEALTH_PROCESSING_CONSENT_STALE',
  'a stale base-health disclosure copy cannot authorize a dependent grant'
);
reset role;
update public.health_processing_states
   set state = 'unconsented',
       epoch = 0,
       consent_version = null,
       consent_text_hash = null,
       last_server_verified_at = null
 where user_id = '70000000-0000-4000-8000-000000000002';

set local role authenticated;
select lives_ok(
  $$select * from public.grant_health_data_consent(
    0, 'draft-v1-2026-07-10',
    '7957a2811fff0e8cefc6f7180b751ec45688fe99421978eedae05b96c2f251fd'
  )$$,
  'a second owner activates independently'
);
select lives_ok(
  $$with inserted as (
      insert into public.skin_profiles (user_id, goals)
      values ('70000000-0000-4000-8000-000000000002', array['legacy-cleanup'])
      returning user_id
    )
    select timezone.*
      from inserted
      cross join lateral public.set_routine_adherence_timezone(
        'America/Vancouver'
      ) as timezone$$,
  'second-owner health rows and server-owned adherence timezone are admitted under the exact grant'
);
select public.pgtap_grant_health_dependent_consent(
  1,
  'photo_capture',
  repeat('7', 64)
);
select public.pgtap_grant_health_dependent_consent(
  1,
  'photo_cloud_backup',
  repeat('9', 64)
);
select pg_catalog.set_config(
  'request.headers',
  public.pgtap_health_headers(
    1, array['photo_capture', 'photo_cloud_backup']
  ),
  true
);
insert into storage.objects (bucket_id, name, owner, owner_id) values (
  'photos',
  '70000000-0000-4000-8000-000000000002/e1/foreign-epoch.bin',
  '70000000-0000-4000-8000-000000000002',
  '70000000-0000-4000-8000-000000000002'
);
reset role;
update public.health_processing_states
   set epoch = 2
 where user_id = '70000000-0000-4000-8000-000000000002';
update public.health_dependent_consent_states
   set health_epoch = 2
 where user_id = '70000000-0000-4000-8000-000000000002'
   and consent_type in ('photo_capture', 'photo_cloud_backup')
   and state = 'active';
select ok(
  public._health_photo_path_safe_for_withdrawal(
    '70000000-0000-4000-8000-000000000002',
    '70000000-0000-4000-8000-000000000002/legacy-withdrawal.bin',
    2
  )
  and not public._health_photo_path_safe_for_withdrawal(
    '70000000-0000-4000-8000-000000000002',
    '70000000-0000-4000-8000-000000000002/e1/foreign-epoch.bin',
    2
  ),
  'canonical legacy paths are drainable while explicit foreign epochs fail closed'
);
set local role authenticated;
select pg_catalog.set_config(
  'request.headers',
  public.pgtap_health_headers(
    2, array['photo_capture', 'photo_cloud_backup']
  ),
  true
);
select lives_ok(
  $$insert into storage.objects (bucket_id, name, owner, owner_id) values (
      'photos',
      '70000000-0000-4000-8000-000000000002/e2/current-epoch.bin',
      '70000000-0000-4000-8000-000000000002',
      '70000000-0000-4000-8000-000000000002'
  )$$,
  'the newer active epoch admits only its exact Storage namespace'
);
select lives_ok(
  $$select * from public.begin_health_dependent_consent_withdrawal(
    2, 1, 'photo_cloud_backup', repeat('8', 64), 'draft-v1-2026-07-10',
    'cd32873fec948532c00ed92b5052f5df95a59eef52faa5cc7e1f431e6ddd0113'
  )$$,
  'a cloud withdrawal publishes its exact epoch-two Storage barrier'
);
reset role;
select pg_catalog.set_config(
  'test.owner2_cloud_operation',
  (select current_operation_id::text
     from public.health_dependent_consent_states
    where user_id = '70000000-0000-4000-8000-000000000002'
      and consent_type = 'photo_cloud_backup'),
  true
);
set local role service_role;
select is(
  (select count(*) from public.claim_due_health_dependent_consent_withdrawals(
    repeat('8', 64), 10
  ) where operation_id =
      pg_catalog.current_setting('test.owner2_cloud_operation')::uuid),
  1::bigint,
  'the worker claims the cloud operation before asking for Storage work'
);
select throws_ok(
  $$select * from public.list_health_dependent_consent_storage_work(
    pg_catalog.current_setting('test.owner2_cloud_operation')::uuid,
    100,
    repeat('8', 64)
  )$$,
  '55000',
  'HEALTH_DEPENDENT_STORAGE_WORK_PATH_INVALID',
  'an explicit foreign-epoch path is never released for automatic deletion'
);
select results_eq(
  $$select operation_id, state, result_code
      from public.mark_health_dependent_consent_withdrawal_action_required(
        pg_catalog.current_setting('test.owner2_cloud_operation')::uuid,
        repeat('8', 64), 'DEPENDENT_STORAGE_OWNERSHIP_INVALID'
      )$$,
  $$values (
    pg_catalog.current_setting('test.owner2_cloud_operation')::uuid,
    'action_required'::text,
    'DEPENDENT_STORAGE_OWNERSHIP_INVALID'::text
  )$$,
  'unsafe dependent Storage evidence becomes durable operator work'
);
select results_eq(
  $$select operation_id, state, result_code
      from public.mark_health_dependent_consent_withdrawal_action_required(
        pg_catalog.current_setting('test.owner2_cloud_operation')::uuid,
        repeat('8', 64), 'DEPENDENT_STORAGE_OWNERSHIP_INVALID'
      )$$,
  $$values (
    pg_catalog.current_setting('test.owner2_cloud_operation')::uuid,
    'action_required'::text,
    'DEPENDENT_STORAGE_OWNERSHIP_INVALID'::text
  )$$,
  'unsafe Storage operator attestation truthfully replays after response loss'
);
select is(
  (select count(*) from public.claim_due_health_dependent_consent_withdrawals(
    repeat('9', 64), 10
  ) where operation_id =
      pg_catalog.current_setting('test.owner2_cloud_operation')::uuid),
  0::bigint,
  'unsafe Storage operator work is not automatically reclaimed'
);
reset role;
set local role authenticated;
select lives_ok(
  $$select * from public.begin_health_data_consent_withdrawal(
    2, repeat('4', 64), 'draft-v1-2026-07-10',
    '5200ef21982670cf73539d8a7d3e0f9c2219b40ee8d63be0a83d3e10043ba37f'
  )$$,
  'a second owner creates independent durable work'
);
reset role;
select pg_catalog.set_config(
  'test.health_operation_b',
  (select current_operation_id::text from public.health_processing_states where user_id = '70000000-0000-4000-8000-000000000002'),
  true
);

set local role service_role;
select lives_ok(
  $$select * from public.claim_health_consent_withdrawal_for_owner(
    '70000000-0000-4000-8000-000000000002',
    pg_catalog.current_setting('test.health_operation_b')::uuid,
    repeat('5', 64)
  )$$,
  'the service claims only the second owner current withdrawal operation'
);
reset role;

set local role service_role;
select results_eq(
  $$select operation_state, result_code, pending_storage_objects
      from public.prepare_health_data_consent_withdrawal(
        pg_catalog.current_setting('test.health_operation_b')::uuid,
        repeat('5', 64)
      )$$,
  $$values (
    'action_required'::text,
    'UNSAFE_PHOTO_STORAGE_OWNERSHIP'::text,
    2::integer
  )$$,
  'an explicit foreign epoch fails closed only after database cleanup completes'
);
select throws_ok(
  $$select * from public.list_health_consent_storage_work(
    pg_catalog.current_setting('test.health_operation_b')::uuid, 100, repeat('5', 64)
  )$$,
  '55000',
  'HEALTH_WORKER_CLAIM_REJECTED',
  'action-required clears the lease so no later claimed call can mutate it'
);
reset role;
select results_eq(
  $$select
      (select count(*)::integer from public.skin_profiles
        where user_id = '70000000-0000-4000-8000-000000000002'),
      (select current_streak from public.profiles
        where id = '70000000-0000-4000-8000-000000000002'),
      (select longest_streak from public.profiles
        where id = '70000000-0000-4000-8000-000000000002'),
      (select adherence_timezone from public.profiles
        where id = '70000000-0000-4000-8000-000000000002'),
      (select streak_reference_day from public.profiles
        where id = '70000000-0000-4000-8000-000000000002'),
      (select streak_algorithm_version from public.profiles
        where id = '70000000-0000-4000-8000-000000000002')$$,
  $$values (
      0::integer, 0::integer, 0::integer, null::text, null::date, 0::smallint
    )$$,
  'recoverable Storage action-required never postpones the database health purge or leaves adherence residue'
);
select is(
  (select state from public.health_consent_withdrawal_operations
    where id = pg_catalog.current_setting('test.health_operation_b')::uuid),
  'action_required',
  'unsafe Storage ownership is durably visible for operator repair'
);
-- The hosted Storage service removes backend bytes first and sets this
-- transaction-local marker before its metadata DELETE. Rehearse that exact
-- post-byte-deletion transition; ordinary direct DELETE remains protected.
set local role service_role;
select pg_catalog.set_config('storage.allow_delete_query', 'true', true);
delete from storage.objects
 where bucket_id = 'photos'
   and name = '70000000-0000-4000-8000-000000000002/e1/foreign-epoch.bin';
select pg_catalog.set_config('storage.allow_delete_query', 'false', true);
reset role;

set local role service_role;
select lives_ok(
  $$select * from public.claim_health_consent_withdrawal_for_owner(
    '70000000-0000-4000-8000-000000000002',
    pg_catalog.current_setting('test.health_operation_b')::uuid,
    repeat('5', 64)
  )$$,
  'service owner-lane retry obtains a fresh capability after operator repair'
);
reset role;

set local role service_role;
select results_eq(
  $$select operation_state, result_code, pending_storage_objects
      from public.prepare_health_data_consent_withdrawal(
        pg_catalog.current_setting('test.health_operation_b')::uuid,
        repeat('5', 64)
      )$$,
  $$values (
    'storage_pending'::text,
    'PHOTO_STORAGE_DELETION_PENDING'::text,
    1::integer
  )$$,
  'removing the unsafe object makes action-required recoverable on retry'
);
select results_eq(
  $$select storage_path from public.list_health_consent_storage_work(
    pg_catalog.current_setting('test.health_operation_b')::uuid, 100, repeat('5', 64)
  )$$,
  $$values
    ('70000000-0000-4000-8000-000000000002/e2/current-epoch.bin'::text)$$,
  'only the canonical current-operation epoch path is released for deletion'
);
reset role;
update public.health_consent_withdrawal_operations
   set next_attempt_at = now()
 where id = pg_catalog.current_setting('test.health_operation_b')::uuid;
set local role service_role;
select is(
  (select count(*) from public.claim_due_health_consent_withdrawals(repeat('6', 64), 10)),
  0::bigint,
  'the scheduled worker cannot steal an unexpired owner cleanup lease'
);
reset role;
update public.health_consent_withdrawal_operations
   set worker_lease_expires_at = now() - interval '1 second',
       next_attempt_at = now(),
       attempt_count = 999
 where id = pg_catalog.current_setting('test.health_operation_b')::uuid;
set local role service_role;
select is(
  (select count(*) from public.claim_due_health_consent_withdrawals(repeat('6', 64), 10)),
  1::bigint,
  'the scheduled worker makes the thousandth and final automatic claim'
);
reset role;
select is(
  (select attempt_count
     from public.health_consent_withdrawal_operations
    where id = pg_catalog.current_setting('test.health_operation_b')::uuid),
  1000,
  'base withdrawal retry accounting advances atomically with the scheduler lease'
);
set local role service_role;
select throws_ok(
  $$select * from public.claim_health_consent_withdrawal_for_owner(
    '70000000-0000-4000-8000-000000000002',
    pg_catalog.current_setting('test.health_operation_b')::uuid,
    repeat('5', 64)
  )$$,
  '55P03',
  'HEALTH_WITHDRAWAL_CLAIM_ACTIVE',
  'the owner lane returns retryable contention during an active scheduler lease'
);
select throws_ok(
  $$select * from public.prepare_health_data_consent_withdrawal(
    pg_catalog.current_setting('test.health_operation_b')::uuid,
    repeat('5', 64)
  )$$,
  '55000',
  'HEALTH_WORKER_CLAIM_REJECTED',
  'after lease recovery the stale owner token cannot prepare the operation'
);
select results_eq(
  $$select operation_id, operation_state, result_code
      from public.defer_health_consent_withdrawal(
        pg_catalog.current_setting('test.health_operation_b')::uuid,
        repeat('6', 64), 'WORKER_RETRYABLE_FAILURE', 60
      )$$,
  $$values (
    pg_catalog.current_setting('test.health_operation_b')::uuid,
    'action_required'::text,
    'WORKER_RETRY_EXHAUSTED'::text
  )$$,
  'the thousandth claimed base attempt reports terminal action-required truth'
);
reset role;
select results_eq(
  $$select last_result_code, attempt_count
      from public.health_consent_withdrawal_operations
     where id = pg_catalog.current_setting('test.health_operation_b')::uuid$$,
  $$values ('WORKER_RETRY_EXHAUSTED'::text, 1000)$$,
  'retry exhaustion persists its deterministic result without a 1,001st attempt'
);
set local role service_role;
select results_eq(
  $$select operation_id, operation_state, result_code
      from public.defer_health_consent_withdrawal(
        pg_catalog.current_setting('test.health_operation_b')::uuid,
        repeat('6', 64), 'WORKER_RETRYABLE_FAILURE', 60
      )$$,
  $$values (
    pg_catalog.current_setting('test.health_operation_b')::uuid,
    'action_required'::text,
    'WORKER_RETRY_EXHAUSTED'::text
  )$$,
  'base retry-exhaustion attestation truthfully replays after response loss'
);
reset role;
select ok(
  exists (
    select 1 from public.health_consent_withdrawal_operations as operations
     where operations.user_id = '70000000-0000-4000-8000-000000000002'
       and operations.state = 'action_required'
       and operations.last_result_code = 'WORKER_RETRY_EXHAUSTED'
       and operations.worker_claim_digest is null
       and operations.worker_lease_expires_at is null
  ),
  'terminal base retry exhaustion clears the lease and leaves durable operator work'
);

-- A distinct owner proves the automatic provider bound is global to the
-- operation, not merely the page size: 1,001 objects are never partially
-- released before durable operator review.
set local role authenticated;
select pg_catalog.set_config(
  'request.jwt.claims',
  '{"sub":"70000000-0000-4000-8000-000000000005","role":"authenticated","session_id":"71000000-0000-4000-8000-000000000005"}',
  true
);
select lives_ok(
  $$select * from public.grant_health_data_consent(
    0, 'draft-v1-2026-07-10',
    '7957a2811fff0e8cefc6f7180b751ec45688fe99421978eedae05b96c2f251fd'
  )$$,
  'the provider-bound adversary opens one exact base epoch'
);
select lives_ok(
  $$select public.pgtap_grant_health_dependent_consent(
    1, 'photo_capture', repeat('a', 64)
  )$$,
  'the provider-bound adversary grants capture first'
);
select lives_ok(
  $$select public.pgtap_grant_health_dependent_consent(
    1, 'photo_cloud_backup', repeat('b', 64)
  )$$,
  'the provider-bound adversary grants cloud backup second'
);
select pg_catalog.set_config(
  'request.headers',
  public.pgtap_health_headers(
    1, array['photo_capture', 'photo_cloud_backup']
  ),
  true
);
select lives_ok(
  $$insert into storage.objects (bucket_id, name, owner, owner_id)
    select 'photos',
           '70000000-0000-4000-8000-000000000005/e1/bound-'
             || pg_catalog.lpad(series.value::text, 4, '0') || '.bin',
           '70000000-0000-4000-8000-000000000005',
           '70000000-0000-4000-8000-000000000005'
      from pg_catalog.generate_series(1, 1001) as series(value)$$,
  'one thousand and one exact owner objects create the provider-bound case'
);
select lives_ok(
  $$select * from public.begin_health_dependent_consent_withdrawal(
    1, 1, 'photo_cloud_backup', repeat('c', 64), 'draft-v1-2026-07-10',
    'cd32873fec948532c00ed92b5052f5df95a59eef52faa5cc7e1f431e6ddd0113'
  )$$,
  'the oversized cloud withdrawal still publishes its immediate barrier'
);
reset role;
select pg_catalog.set_config(
  'test.owner5_cloud_operation',
  (select current_operation_id::text
     from public.health_dependent_consent_states
    where user_id = '70000000-0000-4000-8000-000000000005'
      and consent_type = 'photo_cloud_backup'),
  true
);
set local role service_role;
select is(
  (select count(*) from public.claim_due_health_dependent_consent_withdrawals(
    repeat('d', 64), 10
  ) where operation_id =
      pg_catalog.current_setting('test.owner5_cloud_operation')::uuid),
  1::bigint,
  'the oversized cloud operation receives one worker lease'
);
select throws_ok(
  $$select * from public.list_health_dependent_consent_storage_work(
    pg_catalog.current_setting('test.owner5_cloud_operation')::uuid,
    100,
    repeat('d', 64)
  )$$,
  '55000',
  'HEALTH_DEPENDENT_STORAGE_WORK_BOUND_EXCEEDED',
  'one thousand and one objects release no automatic deletion page'
);
select results_eq(
  $$select operation_id, state, result_code
      from public.mark_health_dependent_consent_withdrawal_action_required(
        pg_catalog.current_setting('test.owner5_cloud_operation')::uuid,
        repeat('d', 64), 'DEPENDENT_STORAGE_BOUND_EXCEEDED'
      )$$,
  $$values (
    pg_catalog.current_setting('test.owner5_cloud_operation')::uuid,
    'action_required'::text,
    'DEPENDENT_STORAGE_BOUND_EXCEEDED'::text
  )$$,
  'the oversized provider scope becomes durable operator work'
);
select is(
  (select count(*) from storage.objects
    where bucket_id = 'photos'
      and pg_catalog.split_part(name, '/', 1) =
        '70000000-0000-4000-8000-000000000005'),
  1001::bigint,
  'bound refusal deletes none of the oversized owner scope'
);
select is(
  (select count(*) from public.claim_due_health_dependent_consent_withdrawals(
    repeat('e', 64), 10
  ) where operation_id =
      pg_catalog.current_setting('test.owner5_cloud_operation')::uuid),
  0::bigint,
  'provider-bound operator work is not automatically reclaimed'
);
reset role;

set local role authenticated;
select pg_catalog.set_config(
  'request.jwt.claims',
  '{"sub":"70000000-0000-4000-8000-000000000001","role":"authenticated","session_id":"71000000-0000-4000-8000-000000000001"}',
  true
);
select public.pgtap_grant_health_dependent_consent(
  2, 'photo_capture', repeat('e', 64)
);
select pg_catalog.set_config(
  'request.headers',
  public.pgtap_health_headers(2, array['photo_capture']),
  true
);
select lives_ok(
  $$insert into public.photos (id, user_id, local_only)
    values
      ('72000000-0000-4000-8000-000000000001', '70000000-0000-4000-8000-000000000001', true),
      ('72000000-0000-4000-8000-000000000002', '70000000-0000-4000-8000-000000000001', true)$$,
  'two fresh-epoch local photos are admitted for cascade rehearsal'
);
select lives_ok(
  $$update public.photos
       set reference_photo_id = '72000000-0000-4000-8000-000000000001'
     where id = '72000000-0000-4000-8000-000000000002'$$,
  'the owner may create a same-owner photo reference'
);
select lives_ok(
  $$select * from public.begin_health_data_consent_withdrawal(
    2, repeat('7', 64), 'draft-v1-2026-07-10',
    '5200ef21982670cf73539d8a7d3e0f9c2219b40ee8d63be0a83d3e10043ba37f'
  )$$,
  'the second epoch can enter withdrawal with a fresh key'
);
reset role;
select lives_ok(
  $$delete from auth.users where id = '70000000-0000-4000-8000-000000000001'$$,
  'hard account deletion composes with an in-flight health withdrawal and photo self-FK'
);
select ok(
  not exists (select 1 from public.health_processing_states where user_id = '70000000-0000-4000-8000-000000000001')
    and not exists (select 1 from public.health_consent_withdrawal_operations where user_id = '70000000-0000-4000-8000-000000000001')
    and not exists (select 1 from public.photos where user_id = '70000000-0000-4000-8000-000000000001'),
  'account deletion cascades all health lifecycle and photo rows'
);

-- Migration-owner-only disclosure lifecycle rehearsal. This pgTAP transaction
-- rolls back, so the installed 15 current tuples remain draft_blocked rows.
select throws_ok(
  $$update public.health_consent_copy_registry
       set is_current = false
     where consent_type = 'photo_capture'
       and action = 'grant'
       and is_current$$,
  '55000',
  'HEALTH_CONSENT_COPY_LIFECYCLE_EVIDENCE_REQUIRED',
  'even the migration owner cannot retire an approved current copy without same-xid evidence'
);
select results_eq(
  $$select successor_review_status, successor_is_current
      from public.supersede_health_consent_copy_for_release(
        'health_data_collection', 'withdraw',
        'draft-v1-2026-07-10',
        '5200ef21982670cf73539d8a7d3e0f9c2219b40ee8d63be0a83d3e10043ba37f',
        'health-withdraw-v2-2026-07-15', repeat('1', 64),
        'PGTAP-COPY-SUPERSESSION-EXIT', 'pgtap.db-owner', repeat('a', 64)
      )$$,
  $$values ('draft_blocked'::text, true)$$,
  'an audited exit-copy supersession activates one exact draft-labelled successor'
);
select lives_ok(
  $$select public._assert_health_consent_copy(
    'withdraw', 'draft-v1-2026-07-10',
    '5200ef21982670cf73539d8a7d3e0f9c2219b40ee8d63be0a83d3e10043ba37f'
  )$$,
  'the historical exact withdrawal copy remains recognized after supersession'
);
select results_eq(
  $$select successor_review_status, successor_is_current
      from public.supersede_health_consent_copy_for_release(
        'health_data_collection', 'grant',
        'draft-v1-2026-07-10',
        '7957a2811fff0e8cefc6f7180b751ec45688fe99421978eedae05b96c2f251fd',
        'health-grant-v2-2026-07-15', repeat('2', 64),
        'PGTAP-COPY-SUPERSESSION-GRANT', 'pgtap.db-owner', repeat('b', 64)
      )$$,
  $$values ('approved'::text, true)$$,
  'an audited grant supersession approves and activates only the exact successor'
);
select results_eq(
  $$select successor_review_status, successor_is_current
      from public.supersede_health_consent_copy_for_release(
        'health_data_collection', 'grant',
        'draft-v1-2026-07-10',
        '7957a2811fff0e8cefc6f7180b751ec45688fe99421978eedae05b96c2f251fd',
        'health-grant-v2-2026-07-15', repeat('2', 64),
        'PGTAP-COPY-SUPERSESSION-GRANT', 'pgtap.db-owner', repeat('b', 64)
      )$$,
  $$values ('approved'::text, true)$$,
  'an exact supersession replays its original audit truth after response loss'
);
select throws_ok(
  $$select public._assert_health_consent_copy(
    'grant', 'draft-v1-2026-07-10',
    '7957a2811fff0e8cefc6f7180b751ec45688fe99421978eedae05b96c2f251fd'
  )$$,
  '55000', 'HEALTH_CONSENT_COPY_NOT_CURRENT',
  'a historical approved grant cannot authorize a new processing epoch'
);
select lives_ok(
  $$select public._assert_health_consent_copy(
    'grant', 'health-grant-v2-2026-07-15', repeat('2', 64)
  )$$,
  'only the current approved exact grant authorizes new processing'
);
select results_eq(
  $$select review_status, is_current
      from public.close_health_consent_copy_for_emergency(
        'health_data_collection', 'grant',
        'health-grant-v2-2026-07-15', repeat('2', 64),
        'PGTAP-COPY-EMERGENCY-CLOSE', 'pgtap.db-owner', repeat('c', 64)
      )$$,
  $$values ('approved'::text, false)$$,
  'an audited emergency closure removes all current grant authority'
);
select results_eq(
  $$select review_status, is_current
      from public.close_health_consent_copy_for_emergency(
        'health_data_collection', 'grant',
        'health-grant-v2-2026-07-15', repeat('2', 64),
        'PGTAP-COPY-EMERGENCY-CLOSE', 'pgtap.db-owner', repeat('c', 64)
      )$$,
  $$values ('approved'::text, false)$$,
  'the exact emergency closure truthfully replays after response loss'
);
select throws_ok(
  $$select public._assert_health_consent_copy(
    'grant', 'health-grant-v2-2026-07-15', repeat('2', 64)
  )$$,
  '55000', 'HEALTH_CONSENT_COPY_NOT_CURRENT',
  'emergency closure deterministically blocks the formerly current grant'
);
select results_eq(
  $$select successor_review_status, successor_is_current
      from public.supersede_health_consent_copy_for_release(
        'health_data_collection', 'grant',
        'health-grant-v2-2026-07-15', repeat('2', 64),
        'health-grant-v3-2026-07-15', repeat('3', 64),
        'PGTAP-COPY-REOPEN-SUPERSESSION', 'pgtap.db-owner', repeat('d', 64)
      )$$,
  $$values ('approved'::text, true)$$,
  'a closed grant lane can reopen only through a newly reviewed exact successor'
);
select lives_ok(
  $$select public._assert_health_consent_copy(
    'grant', 'health-grant-v3-2026-07-15', repeat('3', 64)
  )$$,
  'the reviewed post-closure successor becomes the sole new-grant authority'
);

select * from finish();
rollback;
