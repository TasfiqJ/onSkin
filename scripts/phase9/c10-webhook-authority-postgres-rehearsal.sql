-- C-10/P2A-R2 webhook authority: native PostgreSQL regression.
-- Preserve the R1 authority cases; the late accepted purchase now publishes its
-- own proved renewal intention without resurrecting the first-seen refund.
-- The separate publication and permutation gates cover the new revision seam.
-- Run ONLY in a fresh disposable database after applying all repository
-- migrations, including 20261007000079_revenuecat_webhook_authority.sql.
-- Example (local PostgreSQL 15+ with dblink):
-- env -u PGHOST -u PGHOSTADDR -u PGSERVICE -u PGSERVICEFILE \
--   PGOPTIONS='-c c10.disposable_database=on' psql -X -v ON_ERROR_STOP=1 \
--   -h 127.0.0.1 -p 5432 -U postgres -d onskin_c10_review \
--   -f scripts/phase9/c10-webhook-authority-postgres-rehearsal.sql
-- Adjust the port only to an independently verified disposable local database;
-- never run this rehearsal against a hosted database.
-- The guard requires no account/payment data and explicit disposable-database
-- acknowledgement. Synthetic fixtures remain for inspection; drop that local
-- throwaway database after review. This script never resets a project database,
-- deploys a function, or contacts RevenueCat.
--
-- Single-session SQL was separately executed with actual PostgreSQL WASM;
-- the dblink section is a distinct native multi-session gate. Do not claim
-- concurrency passed unless its two explicit native PASS markers are present.

do $$
begin
  if current_setting('c10.disposable_database', true) is distinct from 'on' then
    raise exception 'C10_DISPOSABLE_DATABASE_ACKNOWLEDGEMENT_REQUIRED';
  end if;
  if exists(select 1 from auth.users)
     or exists(select 1 from public.entitlements)
     or exists(select 1 from public.subscriptions_events)
     or exists(select 1 from public.account_deletion_operations)
     or to_regprocedure('public.c10_assert(boolean,text)') is not null then
    raise exception 'C10_FRESH_DISPOSABLE_DATABASE_REQUIRED';
  end if;
end;
$$;

begin;
-- Fixture/regression: case-helpers.sql
-- Synthetic fixtures only. The product string is reused verbatim from the
-- repository's existing PostgreSQL entitlement rehearsals; this test does not
-- provision or approve a product. The live Edge admission contract is separate.
insert into auth.users(id)
select ('00000000-0000-4000-8000-' || lpad(number::text, 12, '0'))::uuid
from generate_series(1, 20) as fixture(number);

insert into auth.sessions(id, user_id)
select ('10000000-0000-4000-8000-' || lpad(number::text, 12, '0'))::uuid,
       ('00000000-0000-4000-8000-' || lpad(number::text, 12, '0'))::uuid
from generate_series(1, 20) as fixture(number);

create function public.c10_event(
  event_id text,
  app_user_id text default '00000000-0000-4000-8000-000000000001',
  aliases text[] default null,
  event_type text default 'RENEWAL',
  provider_at timestamptz default '2026-10-07T00:00:00Z',
  should_project boolean default true,
  active boolean default true,
  priority smallint default 200,
  transferred_to text[] default null,
  original_user_id text default null,
  transferred_from text[] default null,
  user_candidates text[] default null,
  transaction_id text default 'synthetic-transaction',
  expires_at timestamptz default '2027-10-07T00:00:00Z',
  cancel_reason text default null,
  will_renew boolean default null
)
returns table(outcome text, projection_applied boolean, processing_status text)
language sql
set search_path = ''
as $$
  with identities as (
    select distinct value from unnest(array[app_user_id, original_user_id]
      || coalesce(aliases, '{}'::text[])
      || coalesce(transferred_from, '{}'::text[])
      || coalesce(transferred_to, '{}'::text[])) as identity(value)
    where value is not null
  ), lookup as (
    select coalesce(array_agg(1::smallint order by value), '{}'::smallint[]) as versions,
           coalesce(array_agg(encode(sha256(convert_to('synthetic-c10:' || value, 'UTF8')), 'hex') order by value), '{}'::text[]) as hmacs,
           coalesce(array_agg(value order by value), '{}'::text[]) as identities
    from identities
  )
  select result.* from lookup cross join lateral public.process_revenuecat_webhook_event_guarded(
    event_id, event_type, coalesce(user_candidates, '{}'::text[]), app_user_id,
    original_user_id, aliases, transferred_from, transferred_to,
    'production', 'app_store', 'layerwell_pro_annual', 'pro',
    expires_at, '2026-10-01T00:00:00Z'::timestamptz,
    provider_at, '2026-10-07T00:00:01Z'::timestamptz,
    'synthetic-original-transaction', transaction_id, 'normal',
    coalesce(will_renew, active), active, should_project, priority, 'default',
    jsonb_build_object('event', jsonb_strip_nulls(jsonb_build_object(
      'id', event_id, 'type', event_type, 'cancel_reason', cancel_reason,
      'purchased_at_ms', extract(epoch from '2026-10-01T00:00:00Z'::timestamptz) * 1000,
      'expiration_at_ms', floor(extract(epoch from expires_at) * 1000)))),
    false, true, lookup.versions, lookup.hmacs, lookup.identities
  ) as result;
$$;

-- The fixture helper is SECURITY INVOKER: all tested service calls still have
-- to enter the actual service-only guarded overload.
grant execute on function public.c10_event(text,text,text[],text,timestamptz,boolean,boolean,smallint,text[],text,text[],text[],text,timestamptz,text,boolean) to service_role;

create function public.c10_assert(condition boolean, message text)
returns void language plpgsql as $$
begin
  if condition is distinct from true then
    raise exception using message = message;
  end if;
end;
$$;


-- Fixture/regression: owner-ambiguity.sql
-- One opaque RevenueCat identity refers to two distinct live account UUIDs.
-- Source candidate order cannot establish which account owns paid access.
-- Expected baseline failure: observed processed / first lexicographic alias.
set role service_role;
select * from public.c10_event(
  event_id => 'c10-ambiguous-aliases',
  app_user_id => '$RCAnonymousID:ambiguous-fixture',
  aliases => array['00000000-0000-4000-8000-000000000002',
                   '00000000-0000-4000-8000-000000000001']
);
reset role;
select rc_event_id, user_id, resolved_user_id, processing_status, projection_applied
from public.subscriptions_events where rc_event_id = 'c10-ambiguous-aliases';
select public.c10_assert(
  exists(select 1 from public.subscriptions_events
    where rc_event_id = 'c10-ambiguous-aliases'
      and processing_status = 'unresolved_user'
      and user_id is null and resolved_user_id is null and not projection_applied)
  and not exists(select 1 from public.entitlements),
  'C10_AMBIGUOUS_ALIASES_ASSIGNED_ARBITRARY_PAID_OWNER'
);

set role service_role;
select * from public.c10_event(
  event_id => 'c10-ambiguous-direct-original',
  app_user_id => '00000000-0000-4000-8000-000000000001',
  original_user_id => '00000000-0000-4000-8000-000000000002'
);
select * from public.c10_event(
  event_id => 'c10-ambiguous-transfer',
  app_user_id => '$RCAnonymousID:transfer-fixture',
  event_type => 'TRANSFER', should_project => false,
  active => false, priority => 0::smallint,
  transferred_to => array['00000000-0000-4000-8000-000000000002',
                           '00000000-0000-4000-8000-000000000001']
);
reset role;
select public.c10_assert(
  (select count(*) from public.subscriptions_events
    where rc_event_id in ('c10-ambiguous-direct-original', 'c10-ambiguous-transfer')
      and processing_status = 'unresolved_user'
      and user_id is null and resolved_user_id is null and not projection_applied) = 2
  and not exists(select 1 from public.entitlements),
  'C10_AMBIGUOUS_DIRECT_OR_TRANSFER_ASSIGNED_OWNER'
);
select 'C10_OWNER_AMBIGUITY_PASS' as result;


-- Fixture/regression: atomic-sequential.sql
set role service_role;
select * from public.c10_event(event_id => 'c10-initial', event_type => 'INITIAL_PURCHASE');
select * from public.c10_event(event_id => 'c10-initial', event_type => 'INITIAL_PURCHASE');
reset role;
select public.c10_assert(
  (select count(*) from public.subscriptions_events where rc_event_id = 'c10-initial') = 1
  and exists(select 1 from public.subscriptions_events where rc_event_id = 'c10-initial'
    and processing_status = 'processed' and projection_applied and processing_attempts = 1)
  and exists(select 1 from public.entitlements where rc_event_id = 'c10-initial'
    and is_active and rc_cursor_state = 'ordered'),
  'C10_INITIAL_OR_RESPONSE_LOSS_REPLAY_NOT_ATOMIC'
);

set role service_role;
select * from public.c10_event(event_id => 'c10-newer', provider_at => '2026-10-07T02:00:00Z');
select * from public.c10_event(event_id => 'c10-older-expiration', event_type => 'EXPIRATION',
  provider_at => '2026-10-07T01:00:00Z', active => false, priority => 300::smallint);
reset role;
select public.c10_assert(
  exists(select 1 from public.entitlements where rc_event_id = 'c10-newer' and is_active)
  and exists(select 1 from public.subscriptions_events where rc_event_id = 'c10-older-expiration'
    and processing_status = 'stale' and not projection_applied),
  'C10_OLDER_EXPIRATION_OVERWROTE_NEWER_AUTHORITY'
);

set role service_role;
select * from public.c10_event(event_id => 'c10-equal-expiration', event_type => 'EXPIRATION',
  provider_at => '2026-10-07T02:00:00Z', active => false, priority => 300::smallint);
select * from public.c10_event(event_id => 'c10-equal-purchase-z', event_type => 'INITIAL_PURCHASE',
  provider_at => '2026-10-07T02:00:00Z');
reset role;
select public.c10_assert(
  exists(select 1 from public.entitlements where rc_event_id = 'c10-equal-expiration' and not is_active),
  'C10_EQUAL_TIME_LIFECYCLE_PRIORITY_REVERSED'
);

-- Fail after the entitlement UPSERT, during the final audit UPDATE. The real
-- 0041 exception block must roll the projection back and preserve a retry row.
create function public.c10_fail_final_audit() returns trigger language plpgsql as $$
begin
  if new.rc_event_id = 'c10-atomic-failure'
     and new.processing_status = 'processed'
     and current_setting('c10.inject_failure', true) = 'true' then
    raise exception using errcode = '23514', message = 'C10_INJECTED_FINAL_AUDIT_FAILURE';
  end if;
  return new;
end;
$$;
create trigger c10_fail_final_audit before update on public.subscriptions_events
for each row execute function public.c10_fail_final_audit();
set c10.inject_failure = 'true';
set role service_role;
select * from public.c10_event(event_id => 'c10-atomic-failure', provider_at => '2026-10-07T03:00:00Z');
reset role;
select public.c10_assert(
  exists(select 1 from public.entitlements where rc_event_id = 'c10-equal-expiration' and not is_active)
  and exists(select 1 from public.subscriptions_events where rc_event_id = 'c10-atomic-failure'
    and processing_status = 'error' and not projection_applied and processing_attempts = 1
    and error = 'REVENUECAT_ATOMIC_PROCESSING_FAILED:23514'),
  'C10_FINAL_AUDIT_FAILURE_COMMITTED_PARTIAL_PROJECTION'
);
set c10.inject_failure = 'false';
set role service_role;
select * from public.c10_event(event_id => 'c10-atomic-failure', provider_at => '2026-10-07T03:00:00Z');
reset role;
select public.c10_assert(
  exists(select 1 from public.entitlements where rc_event_id = 'c10-atomic-failure' and is_active)
  and exists(select 1 from public.subscriptions_events where rc_event_id = 'c10-atomic-failure'
    and processing_status = 'processed' and projection_applied and processing_attempts = 2 and error is null),
  'C10_RETRYABLE_ERROR_NOT_REPLAYED_ATOMICALLY'
);

-- Exact public/private capability boundary remains unchanged.
select public.c10_assert(
  not has_function_privilege('service_role', 'public.process_revenuecat_webhook_event(text,text,text[],text,text,text[],text[],text[],text,text,text,text,timestamptz,timestamptz,timestamptz,timestamptz,text,text,text,boolean,boolean,boolean,smallint,text,jsonb,boolean,boolean)', 'execute')
  and not has_function_privilege('service_role', 'public.process_revenuecat_webhook_event_guarded(text,text,text[],text,text,text[],text[],text[],text,text,text,text,timestamptz,timestamptz,timestamptz,timestamptz,text,text,text,boolean,boolean,boolean,smallint,text,jsonb,boolean,boolean)', 'execute')
  and has_function_privilege('service_role', 'public.process_revenuecat_webhook_event_guarded(text,text,text[],text,text,text[],text[],text[],text,text,text,text,timestamptz,timestamptz,timestamptz,timestamptz,text,text,text,boolean,boolean,boolean,smallint,text,jsonb,boolean,boolean,smallint[],text[],text[])', 'execute')
  and not has_function_privilege('authenticated', 'public.process_revenuecat_webhook_event_guarded(text,text,text[],text,text,text[],text[],text[],text,text,text,text,timestamptz,timestamptz,timestamptz,timestamptz,text,text,text,boolean,boolean,boolean,smallint,text,jsonb,boolean,boolean,smallint[],text[],text[])', 'execute'),
  'C10_SQL_SERVICE_OR_PRIVATE_CAPABILITY_WIDENED'
);
select 'C10_ATOMIC_SEQUENTIAL_PASS' as result;


-- Fixture/regression: deletion-isolation.sql
-- Real effective v0052 publication-fenced deletion-identity RPC and v0051 HMAC
-- tombstone wrapper; the fixtures are synthetic, locally claimed operations.
set role service_role;
select * from public.c10_event(event_id => 'c10-r1-pending-before-deletion',
  app_user_id => '00000000-0000-4000-8000-000000000003', event_type => 'REFUND_REVERSED');
reset role;
select public.c10_assert(exists(select 1 from public.subscriptions_events
  where rc_event_id = 'c10-r1-pending-before-deletion' and processing_status = 'error'
    and not projection_applied), 'C10_R1_PENDING_DELETION_FIXTURE_MISSING');
insert into public.account_deletion_operations(
  id, user_id, state, expires_at, idempotency_digest, capability_digest
) values (
  '20000000-0000-4000-8000-000000000003', '00000000-0000-4000-8000-000000000003',
  'running', clock_timestamp() + interval '1 day', repeat('3',64), repeat('a',64)
);
insert into public.account_deletion_barriers(user_id, operation_id, expires_at)
values ('00000000-0000-4000-8000-000000000003', '20000000-0000-4000-8000-000000000003',
  clock_timestamp() + interval '1 day');
-- This is a synthetic completed publication drain in a disposable fixture.
-- Set it after barrier insertion because the real v0052 barrier trigger starts
-- a fresh drain and clears the prior settlement timestamps.
update public.account_deletion_operations
set publication_drain_started_at = now() - interval '6 minutes',
    publication_drained_at = now() - interval '6 minutes',
    publication_settle_not_before = now() - interval '1 minute'
where id = '20000000-0000-4000-8000-000000000003';
insert into public.account_deletion_steps(
  operation_id, step_name, step_order, status, lease_kind, claim_digest, lease_expires_at
) values (
  '20000000-0000-4000-8000-000000000003', 'revenuecat_delete', 20, 'leased', 'dispatch',
  public._account_deletion_claim_digest(repeat('3', 64)), clock_timestamp() + interval '1 hour'
);

-- Pre-existing shared-family evidence is scrubbed without changing a live
-- foreign account's projection tuple. 0053 explicitly permits this exact scrub.
insert into public.entitlements(
  user_id, entitlement, is_active, product_id, expires_at, rc_event_id, store,
  period_type, will_renew, source, environment, store_user_id, raw_status,
  rc_event_at, rc_event_priority
) values (
  '00000000-0000-4000-8000-000000000004', 'pro', true, 'layerwell_pro_annual',
  '2027-10-07T00:00:00Z', 'c10-foreign-family', 'app_store', 'normal', true,
  'revenuecat', 'production', '$RCAnonymousID:c10-deleted-family',
  '{"must_scrub":"synthetic"}', '2026-10-07T00:00:00Z', 200
);
set role service_role;
select * from public.establish_revenuecat_deletion_identity_barrier(
  '20000000-0000-4000-8000-000000000003', repeat('3',64), 1::smallint,
  array[
    encode(sha256(convert_to('synthetic-c10:00000000-0000-4000-8000-000000000003','UTF8')),'hex'),
    encode(sha256(convert_to('synthetic-c10:$RCAnonymousID:c10-deleted-family','UTF8')),'hex')
  ],
  array['00000000-0000-4000-8000-000000000003','$RCAnonymousID:c10-deleted-family'],
  clock_timestamp() + interval '30 days'
);
select * from public.c10_event(
  event_id => 'c10-late-deleted-uuid', app_user_id => '00000000-0000-4000-8000-000000000003'
);
select * from public.c10_event(
  event_id => 'c10-late-deleted-opaque', app_user_id => '$RCAnonymousID:c10-deleted-family'
);
select * from public.c10_event(event_id => 'c10-r1-pending-before-deletion',
  app_user_id => '00000000-0000-4000-8000-000000000003', event_type => 'REFUND_REVERSED');
select * from public.c10_event(event_id => 'c10-r1-deleted-opaque-reversal',
  app_user_id => '$RCAnonymousID:c10-deleted-family', event_type => 'REFUND_REVERSED');
reset role;
select public.c10_assert(
  not exists(select 1 from public.entitlements where user_id = '00000000-0000-4000-8000-000000000003')
  and not exists(select 1 from public.subscriptions_events
    where rc_event_id in ('c10-late-deleted-uuid','c10-late-deleted-opaque',
      'c10-r1-pending-before-deletion','c10-r1-deleted-opaque-reversal'))
  and exists(select 1 from public.entitlements where user_id = '00000000-0000-4000-8000-000000000004'
    and rc_event_id = 'c10-foreign-family' and is_active and store_user_id is null and raw_status = '{}'::jsonb),
  'C10_DELETED_FAMILY_REPUBLISHED_OR_FOREIGN_AUTHORITY_CHANGED'
);

set role service_role;
select * from public.c10_event(
  event_id => 'c10-mixed-deleted-live', app_user_id => '00000000-0000-4000-8000-000000000003',
  aliases => array['00000000-0000-4000-8000-000000000004','$RCAnonymousID:c10-deleted-family'],
  provider_at => '2026-10-07T04:00:00Z'
);
select * from public.c10_event(
  event_id => 'c10-single-live-transfer', app_user_id => '$RCAnonymousID:c10-deleted-family',
  event_type => 'TRANSFER', should_project => false, active => false, priority => 0::smallint,
  transferred_from => array['00000000-0000-4000-8000-000000000003'],
  transferred_to => array['00000000-0000-4000-8000-000000000004']
);
reset role;
select public.c10_assert(
  exists(select 1 from public.subscriptions_events where rc_event_id = 'c10-mixed-deleted-live'
    and user_id = '00000000-0000-4000-8000-000000000004'
    and resolved_user_id = '00000000-0000-4000-8000-000000000004'
    and processing_status = 'processed' and projection_applied
    and app_user_id is null and aliases = array['00000000-0000-4000-8000-000000000004'])
  and exists(select 1 from public.subscriptions_events where rc_event_id = 'c10-single-live-transfer'
    and user_id = '00000000-0000-4000-8000-000000000004'
    and processing_status = 'ignored_event_type' and not projection_applied
    and app_user_id is null and transferred_from is null
    and transferred_to = array['00000000-0000-4000-8000-000000000004'])
  and exists(select 1 from public.entitlements where user_id = '00000000-0000-4000-8000-000000000004'
    and rc_event_id = 'c10-mixed-deleted-live' and is_active),
  'C10_ACCEPTED_DELETED_PLUS_SOLE_LIVE_OWNER_BROKEN'
);

-- Anonymous-only provider IDs stay audit-only. A UUID supplied only by the
-- Edge candidate list never acquires semantic owner authority.
set role service_role;
select * from public.c10_event(event_id => 'c10-anonymous', app_user_id => '$RCAnonymousID:c10-unresolved');
select * from public.c10_event(event_id => 'c10-candidate-spoof', app_user_id => '$RCAnonymousID:c10-unresolved',
  user_candidates => array['00000000-0000-4000-8000-000000000005']);
reset role;
select public.c10_assert(
  (select count(*) from public.subscriptions_events where rc_event_id in ('c10-anonymous','c10-candidate-spoof')
    and user_id is null and resolved_user_id is null and processing_status = 'unresolved_user'
    and not projection_applied) = 2,
  'C10_OPAQUE_OR_CANDIDATE_ONLY_VALUE_RESOLVED_OWNER'
);
select 'C10_DELETION_ISOLATION_PASS' as result;


-- Fixture/regression: transaction-correspondence.sql
set role service_role;
select * from public.c10_event(event_id => 'c10-current-renewal',
  app_user_id => '00000000-0000-4000-8000-000000000007',
  event_type => 'RENEWAL', transaction_id => 'synthetic-new-renewal-transaction',
  provider_at => '2026-10-07T02:00:00Z');
select * from public.c10_event(event_id => 'c10-late-old-expiration',
  app_user_id => '00000000-0000-4000-8000-000000000007',
  event_type => 'EXPIRATION', transaction_id => 'synthetic-old-period-transaction',
  provider_at => '2026-10-07T03:00:00Z', expires_at => '2026-10-07T00:00:00Z',
  active => false, priority => 300::smallint);
reset role;
select public.c10_assert(
  exists(select 1 from public.entitlements
    where user_id = '00000000-0000-4000-8000-000000000007'
      and rc_event_id = 'c10-current-renewal'
      and rc_transaction_id = 'synthetic-new-renewal-transaction' and is_active),
  'C10_LATE_OLD_TRANSACTION_EXPIRATION_REVOKED_CURRENT_RENEWAL'
);
select 'C10_TRANSACTION_CORRESPONDENCE_PASS' as result;


-- Fixture/regression: renewal-intention.sql
set role service_role;
-- R1 requires purchase proof; the original fixture started with cancellation.
select * from public.c10_event(event_id => 'c10-renewal-intention-purchase',
  app_user_id => '00000000-0000-4000-8000-000000000008',
  event_type => 'INITIAL_PURCHASE', provider_at => '2026-10-06T23:00:00Z');
select * from public.c10_event(event_id => 'c10-cancelled-current',
  app_user_id => '00000000-0000-4000-8000-000000000008',
  event_type => 'CANCELLATION', will_renew => false,
  provider_at => '2026-10-07T00:00:00Z', priority => 100::smallint);
select * from public.c10_event(event_id => 'c10-extension-after-cancel',
  app_user_id => '00000000-0000-4000-8000-000000000008',
  event_type => 'SUBSCRIPTION_EXTENDED',
  provider_at => '2026-10-07T01:00:00Z', will_renew => true);
reset role;
select public.c10_assert(
  exists(select 1 from public.entitlements
    where user_id = '00000000-0000-4000-8000-000000000008'
      and rc_event_id = 'c10-extension-after-cancel' and is_active and not will_renew),
  'C10_EXTENSION_MANUFACTURED_RENEWAL_INTENTION'
);
select 'C10_RENEWAL_INTENTION_PASS' as result;


-- Fixture/regression: lifecycle-failure-order.sql
-- A refund may arrive before its older purchase. Its inactive watermark must
-- survive that replay; a genuinely later new renewal can still establish access.
set role service_role;
select * from public.c10_event(event_id => 'c10-refund-first',
  app_user_id => '00000000-0000-4000-8000-000000000009',
  event_type => 'CANCELLATION', cancel_reason => 'CUSTOMER_SUPPORT',
  provider_at => '2026-10-07T02:00:00Z', active => false, priority => 300::smallint);
select * from public.c10_event(event_id => 'c10-older-purchase-after-refund',
  app_user_id => '00000000-0000-4000-8000-000000000009',
  event_type => 'INITIAL_PURCHASE', provider_at => '2026-10-07T01:00:00Z');
reset role;
select public.c10_assert(
  exists(select 1 from public.entitlements where user_id = '00000000-0000-4000-8000-000000000009'
    and rc_event_id = 'c10-refund-first' and not is_active and will_renew is true)
  and exists(select 1 from public.subscriptions_events where rc_event_id = 'c10-older-purchase-after-refund'
    and processing_status = 'processed' and projection_applied),
  'C10_FIRST_REFUND_DROPPED_OR_OLDER_PURCHASE_RESURRECTED_ACCESS'
);
set role service_role;
select * from public.c10_event(event_id => 'c10-genuine-new-renewal',
  app_user_id => '00000000-0000-4000-8000-000000000009',
  event_type => 'RENEWAL', transaction_id => 'synthetic-genuine-new-renewal',
  provider_at => '2026-10-07T03:00:00Z');
reset role;
select public.c10_assert(
  exists(select 1 from public.entitlements where user_id = '00000000-0000-4000-8000-000000000009'
    and rc_event_id = 'c10-genuine-new-renewal' and is_active),
  'C10_REFUND_PREVENTED_GENUINE_LATER_RENEWAL'
);

-- A refund reversal can restore the exact refunded transaction without
-- changing whether auto-renewal had been cancelled before the refund.
set role service_role;
-- Establish the actual purchase whose cancellation/refund is being tested.
select * from public.c10_event(event_id => 'c10-refund-provenance-purchase',
  app_user_id => '00000000-0000-4000-8000-000000000010',
  event_type => 'INITIAL_PURCHASE', provider_at => '2026-10-06T23:00:00Z');
select * from public.c10_event(event_id => 'c10-user-cancellation',
  app_user_id => '00000000-0000-4000-8000-000000000010',
  event_type => 'CANCELLATION', cancel_reason => 'UNSUBSCRIBE', will_renew => false,
  provider_at => '2026-10-07T00:00:00Z', priority => 100::smallint);
select * from public.c10_event(event_id => 'c10-current-refund',
  app_user_id => '00000000-0000-4000-8000-000000000010',
  event_type => 'CANCELLATION', cancel_reason => 'CUSTOMER_SUPPORT',
  provider_at => '2026-10-07T01:00:00Z', active => false, priority => 300::smallint);
select * from public.c10_event(event_id => 'c10-current-refund-reversed',
  app_user_id => '00000000-0000-4000-8000-000000000010',
  event_type => 'REFUND_REVERSED', provider_at => '2026-10-07T02:00:00Z', will_renew => true);
reset role;
select public.c10_assert(
  exists(select 1 from public.entitlements where user_id = '00000000-0000-4000-8000-000000000010'
    and rc_event_id = 'c10-current-refund-reversed' and is_active and not will_renew),
  'C10_REFUND_REVERSAL_LOST_PRIOR_RENEWAL_INTENTION'
);

set role service_role;
select * from public.c10_event(event_id => 'c10-reversal-without-refund',
  app_user_id => '00000000-0000-4000-8000-000000000011',
  event_type => 'REFUND_REVERSED', provider_at => '2026-10-07T01:00:00Z');
select * from public.c10_event(event_id => 'c10-extension-without-purchase',
  app_user_id => '00000000-0000-4000-8000-000000000011',
  event_type => 'SUBSCRIPTION_EXTENDED', provider_at => '2026-10-07T02:00:00Z');
select * from public.c10_event(event_id => 'c10-billing-without-purchase',
  app_user_id => '00000000-0000-4000-8000-000000000011',
  event_type => 'BILLING_ISSUE', provider_at => '2026-10-07T03:00:00Z');
reset role;
select public.c10_assert(
  not exists(select 1 from public.entitlements where user_id = '00000000-0000-4000-8000-000000000011')
  and (select count(*) from public.subscriptions_events
    where rc_event_id in ('c10-extension-without-purchase','c10-billing-without-purchase')
      and processing_status = 'error' and not projection_applied
      and error = 'REVENUECAT_LIFECYCLE_DEPENDENCY_PENDING') = 2
  and exists(select 1 from public.subscriptions_events
    where rc_event_id = 'c10-reversal-without-refund'
      and processing_status = 'error' and not projection_applied
      and error = 'REVENUECAT_LIFECYCLE_DEPENDENCY_PENDING'),
  'C10_UNCORRELATED_LIFECYCLE_MANUFACTURED_ACCESS'
);

-- Billing-grace update and its associated cancellation must not shorten the
-- same transaction's known finite grace window or invent renewal intention.
set role service_role;
select * from public.c10_event(event_id => 'c10-billing-purchase',
  app_user_id => '00000000-0000-4000-8000-000000000012',
  event_type => 'INITIAL_PURCHASE', provider_at => '2026-10-07T00:00:00Z');
select * from public.c10_event(event_id => 'c10-billing-grace',
  app_user_id => '00000000-0000-4000-8000-000000000012',
  event_type => 'BILLING_ISSUE', provider_at => '2026-10-07T01:00:00Z',
  expires_at => '2027-10-10T00:00:00Z');
select * from public.c10_event(event_id => 'c10-billing-cancellation',
  app_user_id => '00000000-0000-4000-8000-000000000012',
  event_type => 'CANCELLATION', cancel_reason => 'BILLING_ERROR',
  provider_at => '2026-10-07T02:00:00Z',
  expires_at => '2027-10-07T00:00:00Z', will_renew => false, priority => 100::smallint);
reset role;
select public.c10_assert(
  exists(select 1 from public.entitlements where user_id = '00000000-0000-4000-8000-000000000012'
    and rc_event_id = 'c10-billing-cancellation' and is_active and will_renew
    and expires_at = '2027-10-10T00:00:00Z'),
  'C10_BILLING_CANCELLATION_SHORTENED_KNOWN_GRACE_OR_CHANGED_RENEWAL'
);
select 'C10_LIFECYCLE_FAILURE_ORDER_PASS' as result;

set role service_role;
select * from public.c10_event(event_id => 'c10-expiry-first',
  app_user_id => '00000000-0000-4000-8000-000000000002',
  event_type => 'EXPIRATION', provider_at => '2026-10-07T02:00:00Z',
  active => false, priority => 300::smallint);
reset role;
create temporary table c10_r2_expiry_publication_before as
 select * from revenuecat_publication.projections
 where user_id = '00000000-0000-4000-8000-000000000002';
set role service_role;
select * from public.c10_event(event_id => 'c10-purchase-after-expiry',
  app_user_id => '00000000-0000-4000-8000-000000000002',
  event_type => 'INITIAL_PURCHASE', provider_at => '2026-10-07T01:00:00Z');
select * from public.c10_event(event_id => 'c10-refund-again',
  app_user_id => '00000000-0000-4000-8000-000000000010',
  event_type => 'CANCELLATION', cancel_reason => 'CUSTOMER_SUPPORT',
  provider_at => '2026-10-07T03:00:00Z', active => false, priority => 300::smallint);
select * from public.c10_event(event_id => 'c10-refund-reversal-expired',
  app_user_id => '00000000-0000-4000-8000-000000000010',
  event_type => 'REFUND_REVERSED', provider_at => '2026-10-07T04:00:00Z',
  expires_at => '2026-10-01T00:00:00Z');
reset role;
select public.c10_assert(
  exists(select 1 from public.entitlements where user_id = '00000000-0000-4000-8000-000000000002'
    and rc_event_id = 'c10-expiry-first' and not is_active)
  and exists(select 1 from public.subscriptions_events where rc_event_id = 'c10-purchase-after-expiry'
    and processing_status = 'processed' and projection_applied)
  and exists(select 1 from revenuecat_publication.projections p
    join c10_r2_expiry_publication_before b using (user_id)
    where p.revision = b.revision and p.canonical = b.canonical)
  and exists(select 1 from public.entitlements where user_id = '00000000-0000-4000-8000-000000000010'
    and rc_event_id = 'c10-refund-again' and not is_active)
  and exists(select 1 from public.subscriptions_events where rc_event_id = 'c10-refund-reversal-expired'
    and processing_status = 'ignored_event_type' and not projection_applied),
  'C10_FIRST_EXPIRY_DROPPED_OR_EXPIRED_REVERSAL_RESTORED_ACCESS'
);
select 'C10_FIRST_EXPIRY_AND_EXPIRED_REVERSAL_PASS' as result;


-- Fixture/regression: grace-tie-order.sql
-- BILLING_ISSUE uses priority 200; its associated BILLING_ERROR cancellation
-- uses priority 100. Equal generated timestamps cannot let lexical IDs discard
-- the stronger finite grace evidence, in either delivery order.
set role service_role;
select * from public.c10_event(event_id => 'c10-grace-first-purchase',
  app_user_id => '00000000-0000-4000-8000-000000000013');
select * from public.c10_event(event_id => 'c10-cancel-first-purchase',
  app_user_id => '00000000-0000-4000-8000-000000000014');
select * from public.c10_event(event_id => 'c10-aa-grace-first',
  app_user_id => '00000000-0000-4000-8000-000000000013',
  event_type => 'BILLING_ISSUE', provider_at => '2026-10-07T06:00:00Z',
  expires_at => '2027-10-10T00:00:00Z', priority => 200::smallint);
select * from public.c10_event(event_id => 'c10-zz-cancel-second',
  app_user_id => '00000000-0000-4000-8000-000000000013',
  event_type => 'CANCELLATION', cancel_reason => 'BILLING_ERROR',
  provider_at => '2026-10-07T06:00:00Z', expires_at => '2027-10-07T00:00:00Z',
  priority => 100::smallint, will_renew => false);
select * from public.c10_event(event_id => 'c10-zz-cancel-first',
  app_user_id => '00000000-0000-4000-8000-000000000014',
  event_type => 'CANCELLATION', cancel_reason => 'BILLING_ERROR',
  provider_at => '2026-10-07T06:00:00Z', expires_at => '2027-10-07T00:00:00Z',
  priority => 100::smallint, will_renew => false);
select * from public.c10_event(event_id => 'c10-aa-grace-second',
  app_user_id => '00000000-0000-4000-8000-000000000014',
  event_type => 'BILLING_ISSUE', provider_at => '2026-10-07T06:00:00Z',
  expires_at => '2027-10-10T00:00:00Z', priority => 200::smallint);
reset role;
select public.c10_assert(
  (select count(*) from public.entitlements
    where user_id in ('00000000-0000-4000-8000-000000000013','00000000-0000-4000-8000-000000000014')
      and is_active and will_renew and rc_event_priority = 200
      and expires_at = '2027-10-10T00:00:00Z') = 2,
  'C10_EQUAL_TIMESTAMP_GRACE_DEPENDED_ON_DELIVERY_ORDER'
);
select 'C10_EQUAL_TIMESTAMP_BILLING_GRACE_BOTH_ORDERS_PASS' as result;


-- Fixture/regression: snapshot-compatibility.sql
-- The reconciliation function is called only as a compatibility fixture.
-- No reconciliation implementation is changed by C10/P2A.
set role service_role;
select public.reconcile_revenuecat_entitlement_snapshot(
  '00000000-0000-4000-8000-000000000005', clock_timestamp(), 'pro', true,
  'layerwell_pro_annual', '2027-10-07T00:00:00Z', 'app_store', 'normal', true,
  '2026-10-01T00:00:00Z', 'default', 'production', null, null
);
do $$
declare
  snapshot_at timestamptz;
begin
  select rc_snapshot_at into strict snapshot_at from public.entitlements
  where user_id = '00000000-0000-4000-8000-000000000005';
  perform public.c10_event(event_id => 'c10-pre-snapshot-renewal',
    app_user_id => '00000000-0000-4000-8000-000000000005',
    event_type => 'RENEWAL', provider_at => snapshot_at - interval '1 second');
  perform public.c10_event(event_id => 'c10-equal-snapshot-renewal',
    app_user_id => '00000000-0000-4000-8000-000000000005',
    event_type => 'RENEWAL', provider_at => snapshot_at);
  perform public.c10_event(event_id => 'c10-uncorrelated-post-snapshot-expiration',
    app_user_id => '00000000-0000-4000-8000-000000000005',
    event_type => 'EXPIRATION', provider_at => snapshot_at + interval '1 second',
    active => false, priority => 300::smallint);
  perform public.c10_assert(
    exists(select 1 from public.entitlements
      where user_id = '00000000-0000-4000-8000-000000000005'
        and rc_cursor_state = 'snapshot' and is_active and rc_snapshot_at = snapshot_at),
    'C10_OLDER_EQUAL_OR_UNCORRELATED_LIFECYCLE_OVERWROTE_SNAPSHOT'
  );
  perform public.c10_event(event_id => 'c10-post-snapshot-renewal',
    app_user_id => '00000000-0000-4000-8000-000000000005',
    event_type => 'RENEWAL', provider_at => snapshot_at + interval '2 seconds');
  perform public.c10_assert(
    exists(select 1 from public.entitlements
      where user_id = '00000000-0000-4000-8000-000000000005'
        and rc_cursor_state = 'ordered' and rc_snapshot_at is null
        and rc_event_id = 'c10-post-snapshot-renewal' and is_active),
    'C10_GENUINE_POST_SNAPSHOT_RENEWAL_DID_NOT_RESUME_ORDERED_CURSOR'
  );
end;
$$;
reset role;
select 'C10_SNAPSHOT_COMPATIBILITY_PASS' as result;


-- Fixture/regression: lock-proof.sql
create function public.c10_assert_intake_locks() returns trigger
language plpgsql security definer set search_path = '' as $$
declare
  v_value text;
  v_key bigint;
begin
  foreach v_value in array coalesce(string_to_array(
    nullif(current_setting('c10.expected_accounts', true), ''), ','), '{}'::text[]) loop
    v_key := public._account_deletion_advisory_key(v_value::uuid);
    if not exists(select 1 from pg_catalog.pg_locks as locks
      where locks.pid = pg_backend_pid() and locks.locktype = 'advisory'
        and locks.mode = 'ExclusiveLock' and locks.granted and locks.objsubid = 1
        and locks.classid::bigint = ((v_key >> 32) & 4294967295::bigint)
        and locks.objid::bigint = (v_key & 4294967295::bigint)) then
      raise exception 'C10_EXPECTED_ACCOUNT_LOCK_NOT_HELD';
    end if;
  end loop;
  foreach v_value in array coalesce(string_to_array(
    nullif(current_setting('c10.expected_identities', true), ''), ','), '{}'::text[]) loop
    v_key := public._revenuecat_identity_tombstone_advisory_key(1::smallint,
      encode(sha256(convert_to('synthetic-c10:' || v_value, 'UTF8')), 'hex'));
    if not exists(select 1 from pg_catalog.pg_locks as locks
      where locks.pid = pg_backend_pid() and locks.locktype = 'advisory'
        and locks.mode = 'ExclusiveLock' and locks.granted and locks.objsubid = 1
        and locks.classid::bigint = ((v_key >> 32) & 4294967295::bigint)
        and locks.objid::bigint = (v_key & 4294967295::bigint)) then
      raise exception 'C10_EXPECTED_IDENTITY_LOCK_NOT_HELD';
    end if;
  end loop;
  return new;
end;
$$;
create trigger c10_assert_intake_locks before insert on public.subscriptions_events
for each row execute function public.c10_assert_intake_locks();

set c10.expected_accounts = '00000000-0000-4000-8000-000000000001,00000000-0000-4000-8000-000000000002';
set c10.expected_identities = '00000000-0000-4000-8000-000000000001,00000000-0000-4000-8000-000000000002,$RCAnonymousID:c10-lock-proof';
set role service_role;
select * from public.c10_event(event_id => 'c10-lock-proof',
  app_user_id => '$RCAnonymousID:c10-lock-proof',
  aliases => array['00000000-0000-4000-8000-000000000002','00000000-0000-4000-8000-000000000001']);
reset role;
select public.c10_assert(
  exists(select 1 from public.subscriptions_events where rc_event_id = 'c10-lock-proof'
    and processing_status = 'unresolved_user' and error is null),
  'C10_EXPECTED_ACCOUNT_AND_HMAC_LOCKS_NOT_HELD_INSIDE_ATOMIC_INSERT'
);
reset c10.expected_accounts;
reset c10.expected_identities;
select 'C10_LOCKS_HELD_DURING_ATOMIC_INSERT_PASS' as result;

commit;

-- Native concurrency begins here. This section REQUIRES a real PostgreSQL
-- server with dblink and distinct backends. PGlite does not execute this gate.
create extension if not exists dblink with schema public;

-- This committed random sentinel proves every dblink target is the same
-- disposable database that passed preflight before any remote role/transaction
-- changes or writes. Connection defaults cannot redirect the rehearsal.
create table public.c10_rehearsal_target (
  singleton boolean primary key check (singleton),
  nonce uuid not null
);
insert into public.c10_rehearsal_target values (true, gen_random_uuid());

create function public.c10_overlap_duplicate() returns trigger
language plpgsql set search_path = '' as $$
begin
  if new.rc_event_id = 'c10-concurrent-duplicate' then
    perform pg_catalog.pg_sleep(0.3);
  end if;
  return new;
end;
$$;
create trigger c10_overlap_duplicate before insert on public.subscriptions_events
for each row execute function public.c10_overlap_duplicate();

do $$
declare
  v_host text := coalesce(inet_server_addr()::text,
    nullif(btrim(split_part(current_setting('unix_socket_directories'), ',', 1), ' "'), ''));
  v_conninfo text := 'dbname=' || quote_literal(current_database())
    || ' host=' || quote_literal(v_host)
    || ' port=' || current_setting('port')
    || ' user=' || quote_literal(session_user)
    || ' connect_timeout=5 options=''-c statement_timeout=8000''';
  v_expected_nonce uuid := (select nonce from public.c10_rehearsal_target where singleton);
  v_actual_nonce uuid;
  v_connection text;
  v_opened_connections text[] := '{}'::text[];
  v_first_pid integer;
  v_second_pid integer;
  v_saw_wait boolean := false;
  v_deadline timestamptz := clock_timestamp() + interval '5 seconds';
  v_first record;
  v_second record;
begin
  if v_host is null then
    raise exception 'C10_REHEARSAL_REQUIRES_EXPLICIT_SERVER_HOST_OR_SOCKET';
  end if;
  perform public.dblink_connect('c10_duplicate_first', v_conninfo);
  v_opened_connections := array_append(v_opened_connections, 'c10_duplicate_first');
  perform public.dblink_connect('c10_duplicate_second', v_conninfo);
  v_opened_connections := array_append(v_opened_connections, 'c10_duplicate_second');
  foreach v_connection in array v_opened_connections loop
    select nonce into strict v_actual_nonce from public.dblink(v_connection,
      'select nonce from public.c10_rehearsal_target where singleton') as target(nonce uuid);
    if v_actual_nonce is distinct from v_expected_nonce then
      raise exception 'C10_DBLINK_TARGET_DID_NOT_PASS_THIS_REHEARSAL_PREFLIGHT';
    end if;
  end loop;
  select pid into v_first_pid
    from public.dblink('c10_duplicate_first', 'select pg_backend_pid()') as remote(pid integer);
  select pid into v_second_pid
    from public.dblink('c10_duplicate_second', 'select pg_backend_pid()') as remote(pid integer);
  perform public.dblink_exec('c10_duplicate_first', 'set role service_role');
  perform public.dblink_exec('c10_duplicate_second', 'set role service_role');
  perform public.dblink_send_query('c10_duplicate_first', $query$
    select * from public.c10_event(event_id => 'c10-concurrent-duplicate',
      app_user_id => '00000000-0000-4000-8000-000000000018')
  $query$);
  perform public.dblink_send_query('c10_duplicate_second', $query$
    select * from public.c10_event(event_id => 'c10-concurrent-duplicate',
      app_user_id => '00000000-0000-4000-8000-000000000018')
  $query$);
  while public.dblink_is_busy('c10_duplicate_first') = 1
     or public.dblink_is_busy('c10_duplicate_second') = 1 loop
    v_saw_wait := v_saw_wait or exists(select 1 from pg_catalog.pg_locks
      where pid in (v_first_pid, v_second_pid) and locktype = 'advisory' and not granted);
    if clock_timestamp() > v_deadline then
      raise exception 'C10_CONCURRENT_DUPLICATE_TIMED_OUT';
    end if;
    perform pg_catalog.pg_sleep(0.005);
  end loop;
  select * into strict v_first from public.dblink_get_result('c10_duplicate_first')
    as result(outcome text, projection_applied boolean, processing_status text);
  select * into strict v_second from public.dblink_get_result('c10_duplicate_second')
    as result(outcome text, projection_applied boolean, processing_status text);
  perform public.dblink_disconnect('c10_duplicate_first');
  perform public.dblink_disconnect('c10_duplicate_second');
  perform public.c10_assert(
    v_saw_wait
    and ((v_first.outcome = 'processed' and v_second.outcome = 'duplicate')
      or (v_first.outcome = 'duplicate' and v_second.outcome = 'processed'))
    and (select count(*) from public.subscriptions_events
      where rc_event_id = 'c10-concurrent-duplicate' and processing_status = 'processed'
        and projection_applied and processing_attempts = 1) = 1
    and exists(select 1 from public.entitlements
      where user_id = '00000000-0000-4000-8000-000000000018'
        and rc_event_id = 'c10-concurrent-duplicate' and is_active),
    'C10_CONCURRENT_DUPLICATE_DID_NOT_SERIALIZE_TO_ONE_PROJECTION'
  );
exception when query_canceled or others then
  -- A failed assertion must not strand a deletion transaction or its locks.
  -- Only connections successfully opened by this block belong to its cleanup.
  foreach v_connection in array v_opened_connections loop
    if v_connection = any(coalesce(public.dblink_get_connections(), '{}'::text[])) then
      begin
        if public.dblink_is_busy(v_connection) = 1 then
          perform public.dblink_cancel_query(v_connection);
        end if;
        perform public.dblink_exec(v_connection, 'rollback', false);
      exception when query_canceled or others then
        null; -- Disconnect below still closes any transaction with pending results.
      end;
      begin
        perform public.dblink_disconnect(v_connection);
      exception when query_canceled or others then
        null; -- Preserve the original failure for the independent reviewer.
      end;
    end if;
  end loop;
  raise;
end;
$$;
select 'C10_NATIVE_CONCURRENT_DUPLICATE_PASS' as result;

-- Real publication-fenced identity deletion holds its HMAC locks before
-- commit. An opaque-only late webhook must wait and then suppress all writes.
insert into public.account_deletion_operations(
  id, user_id, state, expires_at, idempotency_digest, capability_digest
) values (
  '20000000-0000-4000-8000-000000000019', '00000000-0000-4000-8000-000000000019',
  'running', clock_timestamp() + interval '1 day', repeat('9',64), repeat('b',64)
);
insert into public.account_deletion_barriers(user_id, operation_id, expires_at)
values ('00000000-0000-4000-8000-000000000019', '20000000-0000-4000-8000-000000000019',
  clock_timestamp() + interval '1 day');
update public.account_deletion_operations
set publication_drain_started_at = now() - interval '6 minutes',
    publication_drained_at = now() - interval '6 minutes',
    publication_settle_not_before = now() - interval '1 minute'
where id = '20000000-0000-4000-8000-000000000019';
insert into public.account_deletion_steps(
  operation_id, step_name, step_order, status, lease_kind, claim_digest, lease_expires_at
) values (
  '20000000-0000-4000-8000-000000000019', 'revenuecat_delete', 20, 'leased', 'dispatch',
  public._account_deletion_claim_digest(repeat('9',64)), clock_timestamp() + interval '1 hour'
);

do $$
declare
  v_host text := coalesce(inet_server_addr()::text,
    nullif(btrim(split_part(current_setting('unix_socket_directories'), ',', 1), ' "'), ''));
  v_conninfo text := 'dbname=' || quote_literal(current_database())
    || ' host=' || quote_literal(v_host)
    || ' port=' || current_setting('port')
    || ' user=' || quote_literal(session_user)
    || ' connect_timeout=5 options=''-c statement_timeout=8000''';
  v_expected_nonce uuid := (select nonce from public.c10_rehearsal_target where singleton);
  v_actual_nonce uuid;
  v_connection text;
  v_opened_connections text[] := '{}'::text[];
  v_late_pid integer;
  v_saw_wait boolean := false;
  v_deadline timestamptz;
  v_established boolean;
  v_late record;
begin
  if v_host is null then
    raise exception 'C10_REHEARSAL_REQUIRES_EXPLICIT_SERVER_HOST_OR_SOCKET';
  end if;
  perform public.dblink_connect('c10_deleting', v_conninfo);
  v_opened_connections := array_append(v_opened_connections, 'c10_deleting');
  perform public.dblink_connect('c10_late', v_conninfo);
  v_opened_connections := array_append(v_opened_connections, 'c10_late');
  foreach v_connection in array v_opened_connections loop
    select nonce into strict v_actual_nonce from public.dblink(v_connection,
      'select nonce from public.c10_rehearsal_target where singleton') as target(nonce uuid);
    if v_actual_nonce is distinct from v_expected_nonce then
      raise exception 'C10_DBLINK_TARGET_DID_NOT_PASS_THIS_REHEARSAL_PREFLIGHT';
    end if;
  end loop;
  select pid into v_late_pid from public.dblink('c10_late', 'select pg_backend_pid()') as remote(pid integer);
  perform public.dblink_exec('c10_deleting', 'set role service_role');
  perform public.dblink_exec('c10_late', 'set role service_role');
  perform public.dblink_exec('c10_deleting', 'begin');
  select established into strict v_established
    from public.dblink('c10_deleting', $query$
      select * from public.establish_revenuecat_deletion_identity_barrier(
        '20000000-0000-4000-8000-000000000019', repeat('9',64), 1::smallint,
        array[
          encode(sha256(convert_to('synthetic-c10:00000000-0000-4000-8000-000000000019','UTF8')),'hex'),
          encode(sha256(convert_to('synthetic-c10:$RCAnonymousID:c10-native-late','UTF8')),'hex')
        ],
        array['00000000-0000-4000-8000-000000000019','$RCAnonymousID:c10-native-late'],
        clock_timestamp() + interval '30 days'
      )
    $query$) as result(established boolean, tombstone_version smallint, identity_count integer);
  perform public.dblink_send_query('c10_late', $query$
    select * from public.c10_event(event_id => 'c10-native-late',
      app_user_id => '$RCAnonymousID:c10-native-late')
  $query$);
  v_deadline := clock_timestamp() + interval '3 seconds';
  while not v_saw_wait and public.dblink_is_busy('c10_late') = 1 loop
    v_saw_wait := exists(select 1 from pg_catalog.pg_locks
      where pid = v_late_pid and locktype = 'advisory' and not granted);
    if clock_timestamp() > v_deadline then
      raise exception 'C10_LATE_WEBHOOK_DID_NOT_BLOCK_ON_DELETION';
    end if;
    perform pg_catalog.pg_sleep(0.005);
  end loop;
  perform public.dblink_exec('c10_deleting', 'commit');
  select * into strict v_late from public.dblink_get_result('c10_late')
    as result(outcome text, projection_applied boolean, processing_status text);
  perform public.dblink_disconnect('c10_deleting');
  perform public.dblink_disconnect('c10_late');
  perform public.c10_assert(
    v_established and v_saw_wait
    and v_late.outcome = 'suppressed_deleted_account'
    and not v_late.projection_applied
    and v_late.processing_status = 'suppressed_deleted_account'
    and not exists(select 1 from public.subscriptions_events where rc_event_id = 'c10-native-late')
    and not exists(select 1 from public.entitlements
      where user_id = '00000000-0000-4000-8000-000000000019'),
    'C10_NATIVE_LATE_WEBHOOK_REPUBLISHED_AFTER_DELETION_COMMIT'
  );
exception when query_canceled or others then
  -- A failed assertion must not strand a deletion transaction or its locks.
  -- Only connections successfully opened by this block belong to its cleanup.
  foreach v_connection in array v_opened_connections loop
    if v_connection = any(coalesce(public.dblink_get_connections(), '{}'::text[])) then
      begin
        if public.dblink_is_busy(v_connection) = 1 then
          perform public.dblink_cancel_query(v_connection);
        end if;
        perform public.dblink_exec(v_connection, 'rollback', false);
      exception when query_canceled or others then
        null; -- Disconnect below still closes any transaction with pending results.
      end;
      begin
        perform public.dblink_disconnect(v_connection);
      exception when query_canceled or others then
        null; -- Preserve the original failure for the independent reviewer.
      end;
    end if;
  end loop;
  raise;
end;
$$;
select 'C10_NATIVE_DELETION_WEBHOOK_SERIALIZATION_PASS' as result;
select 'C10_WEBHOOK_AUTHORITY_POSTGRES_REHEARSAL_PASS' as result;
