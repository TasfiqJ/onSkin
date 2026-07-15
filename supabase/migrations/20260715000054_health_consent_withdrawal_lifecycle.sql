-- =============================================================================
-- B-HEALTH-CONSENT-WITHDRAWAL - durable, non-destructive health-purpose exit
-- =============================================================================
-- Health-purpose withdrawal is intentionally independent from account deletion.
-- It closes health processing first, removes health-purpose state, and preserves
-- Auth, billing, entitlements, store journals, and the account itself.

begin;

-- Health withdrawal removes an author's community question, but cross-owner
-- safety evidence belongs to the reporter/moderation purpose and must survive
-- detached from the deleted health-bearing UGC.
alter table public.community_moderation_events
  drop constraint community_moderation_events_question_id_fkey;
alter table public.community_moderation_events
  add constraint community_moderation_events_question_id_fkey
  foreign key (question_id) references public.community_questions (id)
  on delete set null;

alter table public.community_reports
  alter column question_id drop not null;
alter table public.community_reports
  drop constraint community_reports_question_id_fkey;
alter table public.community_reports
  add constraint community_reports_question_id_fkey
  foreign key (question_id) references public.community_questions (id)
  on delete set null;

-- -----------------------------------------------------------------------------
-- Durable state, idempotent operation, step receipts, and Storage work queue
-- -----------------------------------------------------------------------------

create table public.health_consent_withdrawal_operations (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  epoch bigint not null check (epoch >= 1),
  idempotency_digest text not null check (idempotency_digest ~ '^[a-f0-9]{64}$'),
  state text not null default 'pending'
    check (state in ('pending', 'running', 'storage_pending', 'action_required', 'completed')),
  attempt_count integer not null default 0 check (attempt_count between 0 and 1000),
  last_result_code text
    check (last_result_code is null or last_result_code ~ '^[A-Z0-9_]{1,64}$'),
  processor_inventory_version text not null default 'health-processors-v1'
    check (processor_inventory_version = 'health-processors-v1'),
  processor_inventory_hash text not null
    default '4f53cda18c2baa0c0354bb5f9a3ecbe5ed12ab4d8e11ba873c2f11161202b945'
    check (
      processor_inventory_hash
        = '4f53cda18c2baa0c0354bb5f9a3ecbe5ed12ab4d8e11ba873c2f11161202b945'
    ),
  next_attempt_at timestamptz not null default now(),
  worker_claim_digest text
    check (worker_claim_digest is null or worker_claim_digest ~ '^[a-f0-9]{64}$'),
  worker_lease_expires_at timestamptz,
  requested_at timestamptz not null default now(),
  completed_at timestamptz,
  updated_at timestamptz not null default now(),
  unique (id, user_id),
  unique (user_id, idempotency_digest),
  unique (user_id, epoch),
  check (pg_catalog.isfinite(requested_at) and pg_catalog.isfinite(updated_at)),
  check (pg_catalog.isfinite(next_attempt_at)),
  check (
    (worker_claim_digest is null and worker_lease_expires_at is null)
    or (
      worker_claim_digest is not null
      and worker_lease_expires_at is not null
      and pg_catalog.isfinite(worker_lease_expires_at)
    )
  ),
  check (
    (state = 'completed' and completed_at is not null and pg_catalog.isfinite(completed_at))
    or (state <> 'completed' and completed_at is null)
  )
);

create table public.health_processing_states (
  user_id uuid primary key references auth.users (id) on delete cascade,
  state text not null default 'unconsented'
    check (state in ('unconsented', 'active', 'withdrawing', 'withdrawn')),
  epoch bigint not null default 0 check (epoch >= 0),
  current_operation_id uuid,
  consent_version text check (
    consent_version is null or pg_catalog.length(consent_version) between 1 and 120
  ),
  consent_text_hash text
    check (consent_text_hash is null or consent_text_hash ~ '^[a-f0-9]{64}$'),
  withdrawal_requested_at timestamptz,
  withdrawal_completed_at timestamptz,
  last_server_verified_at timestamptz,
  -- Generic one-shot consent-receipt capability. Only the owning
  -- SECURITY DEFINER lifecycle RPC may populate these sealed fields. The
  -- consents BEFORE INSERT trigger atomically consumes the complete tuple;
  -- caller-settable GUCs are never receipt authority.
  receipt_capability_xid pg_catalog.xid8,
  receipt_capability_backend_pid integer,
  receipt_capability_consent_type text,
  receipt_capability_granted boolean,
  receipt_capability_version text,
  receipt_capability_text_hash text,
  receipt_capability_action text,
  receipt_capability_scope text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, current_operation_id),
  foreign key (current_operation_id, user_id)
    references public.health_consent_withdrawal_operations (id, user_id)
    on delete cascade,
  check (
    (consent_version is null and consent_text_hash is null)
    or (consent_version is not null and consent_text_hash is not null)
  ),
  check (
    withdrawal_requested_at is null or pg_catalog.isfinite(withdrawal_requested_at)
  ),
  check (
    withdrawal_completed_at is null
    or (
      withdrawal_requested_at is not null
      and pg_catalog.isfinite(withdrawal_completed_at)
      and withdrawal_completed_at >= withdrawal_requested_at
    )
  ),
  check (
    last_server_verified_at is null or pg_catalog.isfinite(last_server_verified_at)
  ),
  check (
    (
      receipt_capability_xid is null
      and receipt_capability_backend_pid is null
      and receipt_capability_consent_type is null
      and receipt_capability_granted is null
      and receipt_capability_version is null
      and receipt_capability_text_hash is null
      and receipt_capability_action is null
      and receipt_capability_scope is null
    )
    or (
      receipt_capability_xid is not null
      and receipt_capability_backend_pid is not null
      and receipt_capability_consent_type is not null
      and receipt_capability_granted is not null
      and receipt_capability_version is not null
      and receipt_capability_text_hash is not null
      and receipt_capability_action is not null
      and receipt_capability_scope is not null
      and receipt_capability_consent_type = any(array[
        'health_data_collection',
        'photo_capture',
        'photo_cloud_backup',
        'photo_trend_insights',
        'ask_onskin',
        'community_participation',
        'data_sharing'
      ]::text[])
      and receipt_capability_version = pg_catalog.btrim(receipt_capability_version)
      and pg_catalog.length(receipt_capability_version) between 1 and 120
      and receipt_capability_text_hash ~ '^[a-f0-9]{64}$'
      and receipt_capability_action = any(array[
        'base_grant',
        'base_decline',
        'base_withdrawal',
        'base_withdrawal_dependent',
        'dependent_grant',
        'dependent_withdrawal'
      ]::text[])
      and pg_catalog.length(receipt_capability_scope) between 1 and 512
    )
  ),
  check (
    (state = 'active' and current_operation_id is null and consent_version is not null)
    or (state = 'unconsented' and current_operation_id is null)
    or (state = 'withdrawing' and current_operation_id is not null)
    or (state = 'withdrawn' and current_operation_id is not null and withdrawal_completed_at is not null)
  )
);

-- Exact, server-owned disclosure-copy allowlist. Every row in this migration
-- is deliberately marked draft_blocked: exact matching is a security control,
-- not legal approval and not permission to ship placeholder copy.
create table public.health_consent_copy_registry (
  consent_type text not null,
  action text not null check (action in ('grant', 'decline', 'withdraw')),
  version text not null check (
    version = pg_catalog.btrim(version)
    and pg_catalog.length(version) between 1 and 120
  ),
  consent_text_hash text not null check (consent_text_hash ~ '^[a-f0-9]{64}$'),
  review_status text not null
    check (review_status in ('draft_blocked', 'approved')),
  is_current boolean not null default true,
  created_at timestamptz not null default now(),
  primary key (consent_type, action, version, consent_text_hash),
  check (
    consent_type = any(array[
      'health_data_collection',
      'photo_capture',
      'photo_cloud_backup',
      'photo_trend_insights',
      'ask_onskin',
      'community_participation',
      'data_sharing'
    ]::text[])
  ),
  check (
    (consent_type = 'health_data_collection')
    or action <> 'decline'
  )
);

-- History is append-only, but there can be at most one admission copy for a
-- consent type/action at a time. A partial unique index permits exact retired
-- tuples to remain recognizable for privacy exits without making them current
-- grant authority.
create unique index health_consent_copy_registry_one_current_idx
  on public.health_consent_copy_registry (consent_type, action)
  where is_current;

insert into public.health_consent_copy_registry (
  consent_type, action, version, consent_text_hash, review_status
) values
  ('health_data_collection', 'grant', 'draft-v1-2026-07-10',
    '7957a2811fff0e8cefc6f7180b751ec45688fe99421978eedae05b96c2f251fd', 'draft_blocked'),
  ('health_data_collection', 'decline', 'draft-v1-2026-07-10',
    '6a34a4d3b8086a0ee86951261f612c502bd4376bc8378cf22533b49817cdedea', 'draft_blocked'),
  ('health_data_collection', 'withdraw', 'draft-v1-2026-07-10',
    '5200ef21982670cf73539d8a7d3e0f9c2219b40ee8d63be0a83d3e10043ba37f', 'draft_blocked'),
  ('photo_capture', 'grant', 'draft-v1-2026-07-10',
    '2ed9ac0c1009327c08389040d0a1db05462c39102f8730038a90ecd62de8e8c2', 'draft_blocked'),
  ('photo_capture', 'withdraw', 'draft-v1-2026-07-10',
    '553229a2862dd3d280058e7413b3bc85795932dec2f6ca9bed420b7598e54c51', 'draft_blocked'),
  ('photo_cloud_backup', 'grant', 'draft-v1-2026-07-10',
    '3964f0829f0c5a1369b3e413d6edaa2585cda671333a6efb0d1f8d84d6f5e8b8', 'draft_blocked'),
  ('photo_cloud_backup', 'withdraw', 'draft-v1-2026-07-10',
    'cd32873fec948532c00ed92b5052f5df95a59eef52faa5cc7e1f431e6ddd0113', 'draft_blocked'),
  ('photo_trend_insights', 'grant', 'photo-trend-insights-2026-06-13-placeholder',
    '58997d5c3ef5098edf6544aa2752e6878765065831ddbf42c24a364ab36cd1aa', 'draft_blocked'),
  ('photo_trend_insights', 'withdraw', 'photo-trend-insights-2026-06-13-placeholder',
    'd6bd89ffbb0900784d4af6d8ae1501c7e10385eeba199e1bd8e932d957eec6ba', 'draft_blocked'),
  ('ask_onskin', 'grant', 'ask-advisor-2026-06-14-placeholder',
    '90cd7ec21799ed34a207bf1d6dc06220ff94f874af1cf9dbdce1a63db68f9e18', 'draft_blocked'),
  ('ask_onskin', 'withdraw', 'ask-advisor-2026-06-14-placeholder',
    '5ef385c3e618e3a4167b7096b3d99ffe3d22468269f6d899a51527b7959c9aff', 'draft_blocked'),
  ('community_participation', 'grant', 'community-participation-2026-06-13-placeholder',
    '416da3ba3cd3496c1008cff937b4d7ad0efa7093d40bcfed2636b480e603ca5e', 'draft_blocked'),
  ('community_participation', 'withdraw', 'community-participation-2026-06-13-placeholder',
    'c6ac514c090e7ba197b3f66497aff3b8615c5ffdda7ed2e21eb81f62870aff2e', 'draft_blocked'),
  ('data_sharing', 'grant', 'commerce-consent-2026-06-13-placeholder',
    'b02cf2e0dd7fa1a1e0be10122b9a363109b0d6adbd7d3c478c168ff811c17b7a', 'draft_blocked'),
  ('data_sharing', 'withdraw', 'commerce-consent-2026-06-13-placeholder',
    '91f4958177a5d38507536c281726094938df5675555547576b5d18e799bc89b4', 'draft_blocked');

-- Release approval is migration/operator evidence, never a client or runtime
-- service toggle. Current rows intentionally have no event and remain blocked.
-- A future reviewed migration must promote the exact registry tuple and append
-- this immutable evidence in the same transaction.
create table public.health_consent_copy_review_events (
  id uuid primary key default gen_random_uuid(),
  event_type text not null
    check (event_type in ('promotion', 'supersession', 'emergency_closure')),
  consent_type text not null,
  action text not null check (action in ('grant', 'decline', 'withdraw')),
  version text not null,
  consent_text_hash text not null check (consent_text_hash ~ '^[a-f0-9]{64}$'),
  from_status text not null check (from_status in ('draft_blocked', 'approved')),
  to_status text not null check (to_status in ('draft_blocked', 'approved')),
  from_is_current boolean not null,
  to_is_current boolean not null,
  successor_version text check (
    successor_version is null
    or (
      successor_version = pg_catalog.btrim(successor_version)
      and pg_catalog.length(successor_version) between 1 and 120
    )
  ),
  successor_consent_text_hash text check (
    successor_consent_text_hash is null
    or successor_consent_text_hash ~ '^[a-f0-9]{64}$'
  ),
  successor_review_status text
    check (successor_review_status is null
      or successor_review_status in ('draft_blocked', 'approved')),
  successor_is_current boolean,
  review_ticket text not null check (
    review_ticket = pg_catalog.btrim(review_ticket)
    and review_ticket ~ '^[A-Z0-9][A-Z0-9._:/-]{5,199}$'
  ),
  reviewed_by text not null check (
    reviewed_by = pg_catalog.btrim(reviewed_by)
    and reviewed_by ~ '^[A-Za-z0-9][A-Za-z0-9._@:+/-]{2,199}$'
  ),
  review_evidence_hash text not null
    check (review_evidence_hash ~ '^[a-f0-9]{64}$'),
  lifecycle_xid pg_catalog.xid8 not null,
  lifecycle_backend_pid integer not null,
  reviewed_at timestamptz not null default now(),
  foreign key (consent_type, action, version, consent_text_hash)
    references public.health_consent_copy_registry (
      consent_type, action, version, consent_text_hash
    )
    on update restrict on delete restrict,
  foreign key (
    consent_type, action, successor_version, successor_consent_text_hash
  ) references public.health_consent_copy_registry (
    consent_type, action, version, consent_text_hash
  ) on update restrict on delete restrict,
  check (pg_catalog.isfinite(reviewed_at)),
  check (
    (
      event_type = 'promotion'
      and action = 'grant'
      and from_status = 'draft_blocked'
      and to_status = 'approved'
      and from_is_current
      and to_is_current
      and successor_version is null
      and successor_consent_text_hash is null
      and successor_review_status is null
      and successor_is_current is null
    )
    or (
      event_type = 'supersession'
      and from_status = to_status
      and not to_is_current
      and successor_version is not null
      and successor_consent_text_hash is not null
      and successor_review_status is not null
      and successor_is_current
      and successor_review_status = (case
        when action = 'grant' then 'approved'
        else 'draft_blocked'
      end)
    )
    or (
      event_type = 'emergency_closure'
      and action = 'grant'
      and from_status = to_status
      and from_is_current
      and not to_is_current
      and successor_version is null
      and successor_consent_text_hash is null
      and successor_review_status is null
      and successor_is_current is null
    )
  )
);

create unique index health_consent_copy_review_promotion_once_idx
  on public.health_consent_copy_review_events (
    consent_type, action, version, consent_text_hash
  ) where event_type = 'promotion';
create unique index health_consent_copy_review_closure_once_idx
  on public.health_consent_copy_review_events (
    consent_type, action, version, consent_text_hash
  ) where event_type = 'emergency_closure';
create unique index health_consent_copy_review_successor_once_idx
  on public.health_consent_copy_review_events (
    consent_type, action, successor_version, successor_consent_text_hash
  ) where event_type = 'supersession';

create or replace function public._guard_health_consent_copy_review_event_immutable()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  raise exception 'HEALTH_CONSENT_COPY_REVIEW_EVENT_IMMUTABLE'
    using errcode = '55000';
end;
$$;

revoke all on function public._guard_health_consent_copy_review_event_immutable()
  from public, anon, authenticated, service_role;

create trigger trg_health_consent_copy_review_event_immutable
  before update or delete on public.health_consent_copy_review_events
  for each row execute function public._guard_health_consent_copy_review_event_immutable();

create or replace function public._guard_health_consent_copy_registry_lifecycle()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if tg_op = 'DELETE' then
    raise exception 'HEALTH_CONSENT_COPY_REGISTRY_IMMUTABLE'
      using errcode = '55000';
  end if;

  -- A lifecycle function stages a harmless non-current draft before its audit
  -- event exists. No insert may directly create live grant/exit authority.
  if tg_op = 'INSERT' then
    if new.review_status <> 'draft_blocked' or new.is_current then
      raise exception 'HEALTH_CONSENT_COPY_LIFECYCLE_EVIDENCE_REQUIRED'
        using errcode = '55000';
    end if;
    return new;
  end if;

  if new.consent_type <> old.consent_type
     or new.action <> old.action
     or new.version <> old.version
     or new.consent_text_hash <> old.consent_text_hash
     or new.created_at is distinct from old.created_at then
    raise exception 'HEALTH_CONSENT_COPY_REGISTRY_IMMUTABLE'
      using errcode = '55000';
  end if;
  if new is not distinct from old then
    return new;
  end if;
  if old.review_status = 'approved'
     and new.review_status <> 'approved' then
    raise exception 'HEALTH_CONSENT_COPY_APPROVAL_IMMUTABLE'
      using errcode = '55000';
  end if;

  -- Promotion changes only the review status of the exact current grant.
  if old.review_status = 'draft_blocked'
     and new.review_status = 'approved'
     and old.is_current
     and new.is_current
     and exists (
       select 1
         from public.health_consent_copy_review_events as events
        where events.event_type = 'promotion'
          and events.consent_type = new.consent_type
          and events.action = new.action
          and events.version = new.version
          and events.consent_text_hash = new.consent_text_hash
          and events.from_status = old.review_status
          and events.to_status = new.review_status
          and events.from_is_current = old.is_current
          and events.to_is_current = new.is_current
          and events.lifecycle_xid = pg_catalog.pg_current_xact_id()
          and events.lifecycle_backend_pid = pg_catalog.pg_backend_pid()
     ) then
    return new;
  end if;

  -- The exact current tuple can be retired only by a same-transaction
  -- supersession or emergency-closure event. Its approval is never rewritten.
  if new.review_status = old.review_status
     and old.is_current
     and not new.is_current
     and exists (
       select 1
         from public.health_consent_copy_review_events as events
        where events.event_type in ('supersession', 'emergency_closure')
          and events.consent_type = new.consent_type
          and events.action = new.action
          and events.version = new.version
          and events.consent_text_hash = new.consent_text_hash
          and events.from_status = old.review_status
          and events.to_status = new.review_status
          and events.from_is_current
          and not events.to_is_current
          and events.lifecycle_xid = pg_catalog.pg_current_xact_id()
          and events.lifecycle_backend_pid = pg_catalog.pg_backend_pid()
     ) then
    return new;
  end if;

  -- A staged successor becomes current only when the exact audit event names
  -- it. Grant successors are approved atomically; exit successors remain
  -- draft-labelled but are exact recognized privacy-exit copy.
  if old.review_status = 'draft_blocked'
     and not old.is_current
     and new.is_current
     and new.review_status = (case
       when new.action = 'grant' then 'approved'
       else 'draft_blocked'
     end)
     and exists (
       select 1
         from public.health_consent_copy_review_events as events
        where events.event_type = 'supersession'
          and events.consent_type = new.consent_type
          and events.action = new.action
          and events.successor_version = new.version
          and events.successor_consent_text_hash = new.consent_text_hash
          and events.successor_review_status = new.review_status
          and events.successor_is_current = new.is_current
          and events.lifecycle_xid = pg_catalog.pg_current_xact_id()
          and events.lifecycle_backend_pid = pg_catalog.pg_backend_pid()
     ) then
    return new;
  end if;

  raise exception 'HEALTH_CONSENT_COPY_LIFECYCLE_EVIDENCE_REQUIRED'
    using errcode = '55000';
end;
$$;

revoke all on function public._guard_health_consent_copy_registry_lifecycle()
  from public, anon, authenticated, service_role;

create trigger trg_health_consent_copy_registry_lifecycle
  before insert or update or delete on public.health_consent_copy_registry
  for each row execute function public._guard_health_consent_copy_registry_lifecycle();

create or replace function public.promote_health_consent_copy_for_release(
  p_consent_type text,
  p_action text,
  p_version text,
  p_consent_text_hash text,
  p_review_ticket text,
  p_reviewed_by text,
  p_review_evidence_hash text
)
returns table (
  review_event_id uuid,
  consent_type text,
  action text,
  version text,
  consent_text_hash text,
  review_status text,
  review_ticket text,
  reviewed_by text,
  review_evidence_hash text,
  reviewed_at timestamptz
)
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_copy public.health_consent_copy_registry%rowtype;
  v_event public.health_consent_copy_review_events%rowtype;
begin
  if p_consent_type is null
     or p_action is distinct from 'grant'
     or p_version is null or p_version <> pg_catalog.btrim(p_version)
     or pg_catalog.length(p_version) not between 1 and 120
     or p_consent_text_hash is null
     or p_consent_text_hash !~ '^[a-f0-9]{64}$'
     or p_review_ticket is null
     or p_review_ticket <> pg_catalog.btrim(p_review_ticket)
     or p_review_ticket !~ '^[A-Z0-9][A-Z0-9._:/-]{5,199}$'
     or p_reviewed_by is null
     or p_reviewed_by <> pg_catalog.btrim(p_reviewed_by)
     or p_reviewed_by !~ '^[A-Za-z0-9][A-Za-z0-9._@:+/-]{2,199}$'
     or p_review_evidence_hash is null
     or p_review_evidence_hash !~ '^[a-f0-9]{64}$' then
    raise exception 'HEALTH_CONSENT_COPY_PROMOTION_INPUT_INVALID'
      using errcode = '22023';
  end if;

  select registry.* into v_copy
    from public.health_consent_copy_registry as registry
   where registry.consent_type = p_consent_type
     and registry.action = p_action
     and registry.version = p_version
     and registry.consent_text_hash = p_consent_text_hash
     and registry.is_current
   for update;
  if v_copy.consent_type is null
     then
    raise exception 'HEALTH_CONSENT_COPY_PROMOTION_MISMATCH'
      using errcode = '22023';
  end if;

  if v_copy.review_status = 'approved' then
    select events.* into v_event
      from public.health_consent_copy_review_events as events
     where events.event_type = 'promotion'
       and events.consent_type = p_consent_type
       and events.action = p_action
       and events.version = p_version
       and events.consent_text_hash = p_consent_text_hash;
    if v_event.id is null
       or v_event.review_ticket <> p_review_ticket
       or v_event.reviewed_by <> p_reviewed_by
       or v_event.review_evidence_hash <> p_review_evidence_hash then
      raise exception 'HEALTH_CONSENT_COPY_PROMOTION_CONFLICT'
        using errcode = '55000';
    end if;
  else
    insert into public.health_consent_copy_review_events (
      event_type, consent_type, action, version, consent_text_hash,
      from_status, to_status, from_is_current, to_is_current,
      review_ticket, reviewed_by, review_evidence_hash,
      lifecycle_xid, lifecycle_backend_pid
    ) values (
      'promotion', p_consent_type, p_action, p_version, p_consent_text_hash,
      'draft_blocked', 'approved', true, true,
      p_review_ticket, p_reviewed_by,
      p_review_evidence_hash, pg_catalog.pg_current_xact_id(),
      pg_catalog.pg_backend_pid()
    ) returning * into v_event;

    update public.health_consent_copy_registry as registry
       set review_status = 'approved'
     where registry.consent_type = p_consent_type
       and registry.action = p_action
       and registry.version = p_version
       and registry.consent_text_hash = p_consent_text_hash
       and registry.review_status = 'draft_blocked'
       and registry.is_current;
    if not found then
      raise exception 'HEALTH_CONSENT_COPY_PROMOTION_CONFLICT'
        using errcode = '55000';
    end if;
  end if;

  return query
  select v_event.id, p_consent_type, p_action, p_version,
         p_consent_text_hash, 'approved'::text, v_event.review_ticket,
         v_event.reviewed_by, v_event.review_evidence_hash,
         v_event.reviewed_at;
end;
$$;

-- Deliberately migration-owner only. Runtime service_role is not a legal or
-- privacy review authority and receives no EXECUTE grant.
revoke all on function public.promote_health_consent_copy_for_release(
  text, text, text, text, text, text, text
) from public, anon, authenticated, service_role;

-- Replace the exact current tuple without erasing history. The successor is
-- staged non-current/draft, the audit event is appended, the predecessor is
-- retired, and only then is the successor activated. A grant successor is
-- approved in that same transaction; an exit successor remains truthfully
-- draft-labelled while still being an exact privacy-exit contract.
create or replace function public.supersede_health_consent_copy_for_release(
  p_consent_type text,
  p_action text,
  p_previous_version text,
  p_previous_consent_text_hash text,
  p_successor_version text,
  p_successor_consent_text_hash text,
  p_review_ticket text,
  p_reviewed_by text,
  p_review_evidence_hash text
)
returns table (
  lifecycle_event_id uuid,
  consent_type text,
  action text,
  previous_version text,
  previous_consent_text_hash text,
  successor_version text,
  successor_consent_text_hash text,
  successor_review_status text,
  successor_is_current boolean,
  review_ticket text,
  reviewed_by text,
  review_evidence_hash text,
  reviewed_at timestamptz
)
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_current public.health_consent_copy_registry%rowtype;
  v_previous public.health_consent_copy_registry%rowtype;
  v_event public.health_consent_copy_review_events%rowtype;
  v_successor_status text;
begin
  if p_consent_type is null
     or p_action is null or p_action not in ('grant', 'decline', 'withdraw')
     or p_previous_version is null
     or p_previous_version <> pg_catalog.btrim(p_previous_version)
     or pg_catalog.length(p_previous_version) not between 1 and 120
     or p_previous_consent_text_hash is null
     or p_previous_consent_text_hash !~ '^[a-f0-9]{64}$'
     or p_successor_version is null
     or p_successor_version <> pg_catalog.btrim(p_successor_version)
     or pg_catalog.length(p_successor_version) not between 1 and 120
     or p_successor_consent_text_hash is null
     or p_successor_consent_text_hash !~ '^[a-f0-9]{64}$'
     or (p_previous_version, p_previous_consent_text_hash)
          = (p_successor_version, p_successor_consent_text_hash)
     or p_review_ticket is null
     or p_review_ticket <> pg_catalog.btrim(p_review_ticket)
     or p_review_ticket !~ '^[A-Z0-9][A-Z0-9._:/-]{5,199}$'
     or p_reviewed_by is null
     or p_reviewed_by <> pg_catalog.btrim(p_reviewed_by)
     or p_reviewed_by !~ '^[A-Za-z0-9][A-Za-z0-9._@:+/-]{2,199}$'
     or p_review_evidence_hash is null
     or p_review_evidence_hash !~ '^[a-f0-9]{64}$' then
    raise exception 'HEALTH_CONSENT_COPY_SUPERSESSION_INPUT_INVALID'
      using errcode = '22023';
  end if;
  if (p_consent_type = 'health_data_collection' and p_action not in (
        'grant', 'decline', 'withdraw'
      ))
     or (p_consent_type <> 'health_data_collection' and (
       not public._health_consent_type_protected(p_consent_type)
       or p_action = 'decline'
     )) then
    raise exception 'HEALTH_CONSENT_COPY_SUPERSESSION_INPUT_INVALID'
      using errcode = '22023';
  end if;

  perform pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended(
      'health-consent-copy:v1:' || p_consent_type || ':' || p_action, 0
    )
  );

  select registry.* into v_current
    from public.health_consent_copy_registry as registry
   where registry.consent_type = p_consent_type
     and registry.action = p_action
     and registry.is_current
   for update;

  -- Exact replay after a committed response loss returns the original event.
  if v_current.version = p_successor_version
     and v_current.consent_text_hash = p_successor_consent_text_hash then
    select events.* into v_event
      from public.health_consent_copy_review_events as events
     where events.event_type = 'supersession'
       and events.consent_type = p_consent_type
       and events.action = p_action
       and events.version = p_previous_version
       and events.consent_text_hash = p_previous_consent_text_hash
       and events.successor_version = p_successor_version
       and events.successor_consent_text_hash = p_successor_consent_text_hash;
    if v_event.id is null
       or v_event.review_ticket <> p_review_ticket
       or v_event.reviewed_by <> p_reviewed_by
       or v_event.review_evidence_hash <> p_review_evidence_hash then
      raise exception 'HEALTH_CONSENT_COPY_SUPERSESSION_CONFLICT'
        using errcode = '55000';
    end if;
    return query select
      v_event.id, p_consent_type, p_action, p_previous_version,
      p_previous_consent_text_hash, p_successor_version,
      p_successor_consent_text_hash, v_event.successor_review_status,
      true, v_event.review_ticket, v_event.reviewed_by,
      v_event.review_evidence_hash, v_event.reviewed_at;
    return;
  end if;

  select registry.* into v_previous
    from public.health_consent_copy_registry as registry
   where registry.consent_type = p_consent_type
     and registry.action = p_action
     and registry.version = p_previous_version
     and registry.consent_text_hash = p_previous_consent_text_hash
   for update;
  if v_previous.consent_type is null
     or (
       v_current.consent_type is not null
       and (
         v_current.version <> p_previous_version
         or v_current.consent_text_hash <> p_previous_consent_text_hash
       )
     )
     or (
       not v_previous.is_current
       and (
         p_action <> 'grant'
         or v_current.consent_type is not null
         or not exists (
           select 1
             from public.health_consent_copy_review_events as events
            where events.event_type = 'emergency_closure'
              and events.consent_type = p_consent_type
              and events.action = p_action
              and events.version = p_previous_version
              and events.consent_text_hash = p_previous_consent_text_hash
         )
       )
     ) then
    raise exception 'HEALTH_CONSENT_COPY_SUPERSESSION_MISMATCH'
      using errcode = '22023';
  end if;
  if exists (
    select 1
      from public.health_consent_copy_registry as registry
     where registry.consent_type = p_consent_type
       and registry.action = p_action
       and registry.version = p_successor_version
       and registry.consent_text_hash = p_successor_consent_text_hash
  ) then
    raise exception 'HEALTH_CONSENT_COPY_SUPERSESSION_CONFLICT'
      using errcode = '55000';
  end if;

  v_successor_status := case
    when p_action = 'grant' then 'approved'
    else 'draft_blocked'
  end;
  insert into public.health_consent_copy_registry (
    consent_type, action, version, consent_text_hash, review_status, is_current
  ) values (
    p_consent_type, p_action, p_successor_version,
    p_successor_consent_text_hash, 'draft_blocked', false
  );

  insert into public.health_consent_copy_review_events (
    event_type, consent_type, action, version, consent_text_hash,
    from_status, to_status, from_is_current, to_is_current,
    successor_version, successor_consent_text_hash,
    successor_review_status, successor_is_current,
    review_ticket, reviewed_by, review_evidence_hash,
    lifecycle_xid, lifecycle_backend_pid
  ) values (
    'supersession', p_consent_type, p_action,
    p_previous_version, p_previous_consent_text_hash,
    v_previous.review_status, v_previous.review_status,
    v_previous.is_current, false,
    p_successor_version, p_successor_consent_text_hash,
    v_successor_status, true,
    p_review_ticket, p_reviewed_by, p_review_evidence_hash,
    pg_catalog.pg_current_xact_id(), pg_catalog.pg_backend_pid()
  ) returning * into v_event;

  if v_previous.is_current then
    update public.health_consent_copy_registry as registry
       set is_current = false
     where registry.consent_type = p_consent_type
       and registry.action = p_action
       and registry.version = p_previous_version
       and registry.consent_text_hash = p_previous_consent_text_hash
       and registry.is_current;
    if not found then
      raise exception 'HEALTH_CONSENT_COPY_SUPERSESSION_CONFLICT'
        using errcode = '55000';
    end if;
  end if;

  update public.health_consent_copy_registry as registry
     set review_status = v_successor_status,
         is_current = true
   where registry.consent_type = p_consent_type
     and registry.action = p_action
     and registry.version = p_successor_version
     and registry.consent_text_hash = p_successor_consent_text_hash
     and registry.review_status = 'draft_blocked'
     and not registry.is_current;
  if not found then
    raise exception 'HEALTH_CONSENT_COPY_SUPERSESSION_CONFLICT'
      using errcode = '55000';
  end if;

  return query select
    v_event.id, p_consent_type, p_action, p_previous_version,
    p_previous_consent_text_hash, p_successor_version,
    p_successor_consent_text_hash, v_successor_status, true,
    v_event.review_ticket, v_event.reviewed_by,
    v_event.review_evidence_hash, v_event.reviewed_at;
end;
$$;

revoke all on function public.supersede_health_consent_copy_for_release(
  text, text, text, text, text, text, text, text, text
) from public, anon, authenticated, service_role;

-- Emergency closure is deliberately grant-only. Privacy exit copy may be
-- superseded, but it must never be disabled: an old exact decline/withdrawal
-- must remain usable after a copy revision or client update lag.
create or replace function public.close_health_consent_copy_for_emergency(
  p_consent_type text,
  p_action text,
  p_version text,
  p_consent_text_hash text,
  p_review_ticket text,
  p_reviewed_by text,
  p_review_evidence_hash text
)
returns table (
  lifecycle_event_id uuid,
  consent_type text,
  action text,
  version text,
  consent_text_hash text,
  review_status text,
  is_current boolean,
  review_ticket text,
  reviewed_by text,
  review_evidence_hash text,
  reviewed_at timestamptz
)
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_copy public.health_consent_copy_registry%rowtype;
  v_event public.health_consent_copy_review_events%rowtype;
begin
  if p_consent_type is null
     or p_action is distinct from 'grant'
     or p_version is null or p_version <> pg_catalog.btrim(p_version)
     or pg_catalog.length(p_version) not between 1 and 120
     or p_consent_text_hash is null
     or p_consent_text_hash !~ '^[a-f0-9]{64}$'
     or p_review_ticket is null
     or p_review_ticket <> pg_catalog.btrim(p_review_ticket)
     or p_review_ticket !~ '^[A-Z0-9][A-Z0-9._:/-]{5,199}$'
     or p_reviewed_by is null
     or p_reviewed_by <> pg_catalog.btrim(p_reviewed_by)
     or p_reviewed_by !~ '^[A-Za-z0-9][A-Za-z0-9._@:+/-]{2,199}$'
     or p_review_evidence_hash is null
     or p_review_evidence_hash !~ '^[a-f0-9]{64}$' then
    raise exception 'HEALTH_CONSENT_COPY_CLOSURE_INPUT_INVALID'
      using errcode = '22023';
  end if;

  perform pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended(
      'health-consent-copy:v1:' || p_consent_type || ':' || p_action, 0
    )
  );
  select registry.* into v_copy
    from public.health_consent_copy_registry as registry
   where registry.consent_type = p_consent_type
     and registry.action = p_action
     and registry.version = p_version
     and registry.consent_text_hash = p_consent_text_hash
   for update;
  if v_copy.consent_type is null then
    raise exception 'HEALTH_CONSENT_COPY_CLOSURE_MISMATCH'
      using errcode = '22023';
  end if;

  select events.* into v_event
    from public.health_consent_copy_review_events as events
   where events.event_type = 'emergency_closure'
     and events.consent_type = p_consent_type
     and events.action = p_action
     and events.version = p_version
     and events.consent_text_hash = p_consent_text_hash;
  if v_event.id is not null then
    if v_event.review_ticket <> p_review_ticket
       or v_event.reviewed_by <> p_reviewed_by
       or v_event.review_evidence_hash <> p_review_evidence_hash then
      raise exception 'HEALTH_CONSENT_COPY_CLOSURE_CONFLICT'
        using errcode = '55000';
    end if;
    return query select
      v_event.id, p_consent_type, p_action, p_version,
      p_consent_text_hash, v_copy.review_status, false,
      v_event.review_ticket, v_event.reviewed_by,
      v_event.review_evidence_hash, v_event.reviewed_at;
    return;
  end if;
  if not v_copy.is_current then
    raise exception 'HEALTH_CONSENT_COPY_CLOSURE_MISMATCH'
      using errcode = '22023';
  end if;

  insert into public.health_consent_copy_review_events (
    event_type, consent_type, action, version, consent_text_hash,
    from_status, to_status, from_is_current, to_is_current,
    review_ticket, reviewed_by, review_evidence_hash,
    lifecycle_xid, lifecycle_backend_pid
  ) values (
    'emergency_closure', p_consent_type, p_action, p_version,
    p_consent_text_hash, v_copy.review_status, v_copy.review_status,
    true, false, p_review_ticket, p_reviewed_by, p_review_evidence_hash,
    pg_catalog.pg_current_xact_id(), pg_catalog.pg_backend_pid()
  ) returning * into v_event;

  update public.health_consent_copy_registry as registry
     set is_current = false
   where registry.consent_type = p_consent_type
     and registry.action = p_action
     and registry.version = p_version
     and registry.consent_text_hash = p_consent_text_hash
     and registry.is_current;
  if not found then
    raise exception 'HEALTH_CONSENT_COPY_CLOSURE_CONFLICT'
      using errcode = '55000';
  end if;

  return query select
    v_event.id, p_consent_type, p_action, p_version,
    p_consent_text_hash, v_copy.review_status, false,
    v_event.review_ticket, v_event.reviewed_by,
    v_event.review_evidence_hash, v_event.reviewed_at;
end;
$$;

revoke all on function public.close_health_consent_copy_for_emergency(
  text, text, text, text, text, text, text
) from public, anon, authenticated, service_role;

create table public.health_dependent_consent_operations (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  consent_type text not null,
  action text not null check (action in ('grant', 'withdraw')),
  idempotency_digest text not null check (idempotency_digest ~ '^[a-f0-9]{64}$'),
  expected_processing_epoch bigint not null check (expected_processing_epoch >= 1),
  expected_generation bigint not null check (expected_generation >= 0),
  consent_generation bigint not null check (
    consent_generation >= 1 and consent_generation = expected_generation + 1
  ),
  version text not null check (
    version = pg_catalog.btrim(version)
    and pg_catalog.length(version) between 1 and 120
  ),
  consent_text_hash text not null check (consent_text_hash ~ '^[a-f0-9]{64}$'),
  receipt_id uuid references public.consents (id) on delete cascade,
  state text not null default 'pending'
    check (state in ('pending', 'action_required', 'completed')),
  attempt_count integer not null default 0 check (attempt_count between 0 and 1000),
  last_result_code text
    check (last_result_code is null or last_result_code ~ '^[A-Z0-9_]{1,64}$'),
  next_attempt_at timestamptz not null default now(),
  worker_claim_digest text
    check (worker_claim_digest is null or worker_claim_digest ~ '^[a-f0-9]{64}$'),
  worker_lease_expires_at timestamptz,
  requested_at timestamptz not null default now(),
  completed_at timestamptz,
  updated_at timestamptz not null default now(),
  unique (id, user_id, consent_type),
  unique (user_id, idempotency_digest),
  check (
    consent_type = any(array[
      'photo_capture',
      'photo_cloud_backup',
      'photo_trend_insights',
      'ask_onskin',
      'community_participation',
      'data_sharing'
    ]::text[])
  ),
  check (
    (action = 'grant' and state = 'completed' and completed_at is not null)
    or (action = 'grant' and state = 'pending' and completed_at is null)
    or (action = 'withdraw' and state = 'pending' and completed_at is null)
    or (action = 'withdraw' and state = 'action_required' and completed_at is null)
    or (action = 'withdraw' and state = 'completed' and completed_at is not null)
  ),
  check (
    pg_catalog.isfinite(requested_at)
    and pg_catalog.isfinite(updated_at)
    and pg_catalog.isfinite(next_attempt_at)
    and (completed_at is null or pg_catalog.isfinite(completed_at))
    and (
      (worker_claim_digest is null and worker_lease_expires_at is null)
      or (
        worker_claim_digest is not null
        and worker_lease_expires_at is not null
        and pg_catalog.isfinite(worker_lease_expires_at)
      )
    )
  )
);

create table public.health_dependent_consent_states (
  user_id uuid not null references auth.users (id) on delete cascade,
  consent_type text not null,
  state text not null default 'unconsented'
    check (state in ('unconsented', 'active', 'withdrawing', 'withdrawn')),
  generation bigint not null default 0 check (generation >= 0),
  health_epoch bigint check (health_epoch is null or health_epoch >= 1),
  current_receipt_id uuid references public.consents (id) on delete set null,
  current_operation_id uuid,
  base_withdrawal_operation_id uuid,
  parent_withdrawal_operation_id uuid
    references public.health_dependent_consent_operations (id) on delete cascade,
  version text,
  consent_text_hash text,
  withdrawal_requested_at timestamptz,
  withdrawal_completed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (user_id, consent_type),
  foreign key (current_operation_id, user_id, consent_type)
    references public.health_dependent_consent_operations (id, user_id, consent_type)
    on delete cascade,
  foreign key (base_withdrawal_operation_id, user_id)
    references public.health_consent_withdrawal_operations (id, user_id)
    on delete cascade,
  check (
    consent_type = any(array[
      'photo_capture',
      'photo_cloud_backup',
      'photo_trend_insights',
      'ask_onskin',
      'community_participation',
      'data_sharing'
    ]::text[])
  ),
  check (
    (version is null and consent_text_hash is null)
    or (
      version is not null
      and version = pg_catalog.btrim(version)
      and pg_catalog.length(version) between 1 and 120
      and consent_text_hash ~ '^[a-f0-9]{64}$'
    )
  ),
  check (
    withdrawal_requested_at is null or pg_catalog.isfinite(withdrawal_requested_at)
  ),
  check (
    withdrawal_completed_at is null
    or (
      withdrawal_requested_at is not null
      and pg_catalog.isfinite(withdrawal_completed_at)
      and withdrawal_completed_at >= withdrawal_requested_at
    )
  ),
  check (
    (state = 'unconsented'
      and health_epoch is null
      and current_receipt_id is null
      and current_operation_id is null
      and base_withdrawal_operation_id is null
      and parent_withdrawal_operation_id is null
      and version is null
      and consent_text_hash is null
      and withdrawal_requested_at is null
      and withdrawal_completed_at is null)
    or (state = 'active'
      and health_epoch is not null
      and current_receipt_id is not null
      and current_operation_id is null
      and base_withdrawal_operation_id is null
      and parent_withdrawal_operation_id is null
      and version is not null
      and withdrawal_requested_at is null
      and withdrawal_completed_at is null)
    or (state = 'withdrawing'
      and health_epoch is not null
      and current_receipt_id is not null
      and ((current_operation_id is not null)::integer
        + (base_withdrawal_operation_id is not null)::integer
        + (parent_withdrawal_operation_id is not null)::integer) = 1
      and version is not null
      and withdrawal_requested_at is not null
      and withdrawal_completed_at is null)
    or (state = 'withdrawn'
      and health_epoch is not null
      and current_receipt_id is not null
      and ((current_operation_id is not null)::integer
        + (base_withdrawal_operation_id is not null)::integer
        + (parent_withdrawal_operation_id is not null)::integer) = 1
      and version is not null
      and withdrawal_requested_at is not null
      and withdrawal_completed_at is not null)
  )
);

create table public.health_consent_withdrawal_steps (
  operation_id uuid not null
    references public.health_consent_withdrawal_operations (id) on delete cascade,
  step_name text not null
    check (step_name in ('database_cleanup', 'photo_storage_delete', 'processor_reconciliation')),
  step_order smallint not null check (step_order in (10, 20, 30)),
  status text not null default 'pending'
    check (status in ('pending', 'running', 'action_required', 'succeeded')),
  attempt_count integer not null default 0 check (attempt_count between 0 and 1000),
  result_code text check (result_code is null or result_code ~ '^[A-Z0-9_]{1,64}$'),
  started_at timestamptz,
  completed_at timestamptz,
  updated_at timestamptz not null default now(),
  primary key (operation_id, step_name),
  unique (operation_id, step_order),
  check (
    (step_name = 'database_cleanup' and step_order = 10)
    or (step_name = 'photo_storage_delete' and step_order = 20)
    or (step_name = 'processor_reconciliation' and step_order = 30)
  ),
  check (started_at is null or pg_catalog.isfinite(started_at)),
  check (
    (status = 'succeeded' and completed_at is not null and pg_catalog.isfinite(completed_at))
    or (status <> 'succeeded' and completed_at is null)
  )
);

create index health_withdrawal_operations_owner_state_idx
  on public.health_consent_withdrawal_operations (user_id, state, requested_at desc);
create index health_withdrawal_operations_work_idx
  on public.health_consent_withdrawal_operations (updated_at, id)
  where state <> 'completed';
create index health_withdrawal_steps_work_idx
  on public.health_consent_withdrawal_steps (operation_id, step_order)
  where status <> 'succeeded';
create index health_dependent_consent_operations_owner_type_idx
  on public.health_dependent_consent_operations (
    user_id, consent_type, requested_at desc, id
  );
create index health_dependent_consent_operations_pending_idx
  on public.health_dependent_consent_operations (updated_at, id)
  where action = 'withdraw' and state = 'pending';

alter table public.health_consent_withdrawal_operations enable row level security;
alter table public.health_consent_withdrawal_operations force row level security;
alter table public.health_processing_states enable row level security;
alter table public.health_processing_states force row level security;
alter table public.health_consent_withdrawal_steps enable row level security;
alter table public.health_consent_withdrawal_steps force row level security;
alter table public.health_consent_copy_registry enable row level security;
alter table public.health_consent_copy_registry force row level security;
alter table public.health_consent_copy_review_events enable row level security;
alter table public.health_consent_copy_review_events force row level security;
alter table public.health_dependent_consent_operations enable row level security;
alter table public.health_dependent_consent_operations force row level security;
alter table public.health_dependent_consent_states enable row level security;
alter table public.health_dependent_consent_states force row level security;

revoke all on table public.health_consent_withdrawal_operations
  from public, anon, authenticated, service_role;
revoke all on table public.health_processing_states
  from public, anon, authenticated, service_role;
revoke all on table public.health_consent_withdrawal_steps
  from public, anon, authenticated, service_role;
revoke all on table public.health_consent_copy_registry
  from public, anon, authenticated, service_role;
revoke all on table public.health_consent_copy_review_events
  from public, anon, authenticated, service_role;
revoke all on table public.health_dependent_consent_operations
  from public, anon, authenticated, service_role;
revoke all on table public.health_dependent_consent_states
  from public, anon, authenticated, service_role;

-- -----------------------------------------------------------------------------
-- Shared owner serialization and health-publication admission
-- -----------------------------------------------------------------------------

create or replace function public._health_consent_token_digest(p_token text)
returns text
language sql
immutable
set search_path = ''
as $$
  select pg_catalog.encode(
    extensions.digest(
      pg_catalog.convert_to('health-consent-withdrawal:v1:' || p_token, 'UTF8'),
      'sha256'
    ),
    'hex'
  );
$$;

revoke all on function public._health_consent_token_digest(text)
  from public, anon, authenticated, service_role;

create or replace function public._assert_health_withdrawal_claim_locked(
  p_operation_id uuid,
  p_claim_token text
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_expected_digest text;
begin
  if p_claim_token is null or p_claim_token !~ '^[a-f0-9]{64}$' then
    raise exception 'HEALTH_WORKER_CLAIM_REJECTED' using errcode = '55000';
  end if;
  v_expected_digest := public._health_consent_token_digest(p_claim_token);
  if not exists (
    select 1
      from public.health_consent_withdrawal_operations as operations
     where operations.id = p_operation_id
       and operations.worker_claim_digest = v_expected_digest
       and operations.worker_lease_expires_at > pg_catalog.clock_timestamp()
  ) then
    raise exception 'HEALTH_WORKER_CLAIM_REJECTED' using errcode = '55000';
  end if;
end;
$$;

revoke all on function public._assert_health_withdrawal_claim_locked(uuid, text)
  from public, anon, authenticated, service_role;

create or replace function public._health_consent_type_protected(
  p_consent_type text
)
returns boolean
language sql
immutable
set search_path = ''
as $$
  select p_consent_type = any(array[
    'photo_capture',
    'photo_cloud_backup',
    'photo_trend_insights',
    'ask_onskin',
    'community_participation',
    'data_sharing'
  ]::text[]);
$$;

revoke all on function public._health_consent_type_protected(text)
  from public, anon, authenticated, service_role;

-- The server, rather than the caller, owns every exact draft-copy contract.
-- A future reviewed migration may replace a mapping; installed clients cannot
-- invent or cross-use a syntactically valid version/hash through PostgREST.
create or replace function public._assert_health_consent_copy_for_type(
  p_consent_type text,
  p_action text,
  p_version text,
  p_consent_text_hash text
)
returns void
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_review_status text;
  v_is_current boolean;
begin
  select registry.review_status, registry.is_current
    into v_review_status, v_is_current
    from public.health_consent_copy_registry as registry
   where registry.consent_type = p_consent_type
     and registry.action = p_action
     and registry.version = p_version
     and registry.consent_text_hash = p_consent_text_hash;
  if v_review_status is null then
    raise exception 'HEALTH_CONSENT_COPY_UNRECOGNIZED' using errcode = '22023';
  end if;
  if p_action = 'grant' then
    if not v_is_current then
      raise exception 'HEALTH_CONSENT_COPY_NOT_CURRENT' using errcode = '55000';
    end if;
    if v_review_status <> 'approved' then
      raise exception 'HEALTH_CONSENT_COPY_NOT_RELEASED' using errcode = '55000';
    end if;
  end if;
end;
$$;

revoke all on function public._assert_health_consent_copy_for_type(text, text, text, text)
  from public, anon, authenticated, service_role;

create or replace function public._assert_health_consent_copy(
  p_action text,
  p_version text,
  p_consent_text_hash text
)
returns void
language sql
stable
security definer
set search_path = ''
as $$
  select public._assert_health_consent_copy_for_type(
    'health_data_collection', p_action, p_version, p_consent_text_hash
  );
$$;

revoke all on function public._assert_health_consent_copy(text, text, text)
  from public, anon, authenticated, service_role;

create or replace function public._issue_health_consent_receipt_capability(
  p_user_id uuid,
  p_consent_type text,
  p_granted boolean,
  p_version text,
  p_consent_text_hash text,
  p_action text,
  p_scope text
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if p_user_id is null
     or p_consent_type is null
     or p_granted is null
     or p_version is null
     or p_version <> pg_catalog.btrim(p_version)
     or pg_catalog.length(p_version) not between 1 and 120
     or p_consent_text_hash is null
     or p_consent_text_hash !~ '^[a-f0-9]{64}$'
     or p_action is null
     or p_scope is null
     or pg_catalog.length(p_scope) not between 1 and 512 then
    raise exception 'HEALTH_CONSENT_CAPABILITY_INVALID' using errcode = '22023';
  end if;

  if not (
    (p_action = 'base_grant'
      and p_consent_type = 'health_data_collection'
      and p_granted
      and p_scope ~ '^base:grant:e[0-9]+$')
    or (p_action = 'base_decline'
      and p_consent_type = 'health_data_collection'
      and not p_granted
      and p_scope = 'base:decline:e0')
    or (p_action = 'base_withdrawal'
      and p_consent_type = 'health_data_collection'
      and not p_granted
      and p_scope ~ '^base:withdraw:e[1-9][0-9]*:[0-9a-f-]{36}$')
    or (p_action = 'base_withdrawal_dependent'
      and public._health_consent_type_protected(p_consent_type)
      and not p_granted
      and p_scope ~ (
        '^base:withdraw-dependent:' || p_consent_type
        || ':e[1-9][0-9]*:g[1-9][0-9]*:[0-9a-f-]{36}$'
      ))
    or (p_action = 'dependent_grant'
      and public._health_consent_type_protected(p_consent_type)
      and p_granted
      and p_scope ~ (
        '^dependent:grant:' || p_consent_type
        || ':e[1-9][0-9]*:g[1-9][0-9]*:[a-f0-9]{64}$'
      ))
    or (p_action = 'dependent_withdrawal'
      and public._health_consent_type_protected(p_consent_type)
      and not p_granted
      and p_scope ~ (
        '^dependent:withdraw:' || p_consent_type
        || ':e[1-9][0-9]*:g[1-9][0-9]*:[a-f0-9]{64}$'
      ))
  ) then
    raise exception 'HEALTH_CONSENT_CAPABILITY_SCOPE_INVALID' using errcode = '22023';
  end if;

  update public.health_processing_states as states
     set receipt_capability_xid = pg_catalog.pg_current_xact_id(),
         receipt_capability_backend_pid = pg_catalog.pg_backend_pid(),
         receipt_capability_consent_type = p_consent_type,
         receipt_capability_granted = p_granted,
         receipt_capability_version = p_version,
         receipt_capability_text_hash = p_consent_text_hash,
         receipt_capability_action = p_action,
         receipt_capability_scope = p_scope
   where states.user_id = p_user_id
     and states.receipt_capability_xid is null
     and states.receipt_capability_backend_pid is null
     and states.receipt_capability_consent_type is null
     and states.receipt_capability_granted is null
     and states.receipt_capability_version is null
     and states.receipt_capability_text_hash is null
     and states.receipt_capability_action is null
     and states.receipt_capability_scope is null;
  if not found then
    raise exception 'HEALTH_CONSENT_CAPABILITY_BUSY' using errcode = '55000';
  end if;
end;
$$;

revoke all on function public._issue_health_consent_receipt_capability(
  uuid, text, boolean, text, text, text, text
) from public, anon, authenticated, service_role;

create or replace function public._assert_health_consent_capability_cleared(
  p_user_id uuid
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if exists (
    select 1
      from public.health_processing_states as states
     where states.user_id = p_user_id
       and states.receipt_capability_xid is not null
  ) then
    raise exception 'HEALTH_CONSENT_CAPABILITY_NOT_CONSUMED' using errcode = '55000';
  end if;
end;
$$;

revoke all on function public._assert_health_consent_capability_cleared(uuid)
  from public, anon, authenticated, service_role;

create or replace function public._health_photo_path_belongs_to_user(
  p_user_id uuid,
  p_storage_path text
)
returns boolean
language sql
immutable
set search_path = ''
as $$
  select p_storage_path is not null
    and pg_catalog.length(p_storage_path) between 38 and 1024
    and p_storage_path like p_user_id::text || '/%'
    and p_storage_path !~ '(^|/)\.\.?(/|$)'
    and p_storage_path !~ '//'
    and p_storage_path ~ '^[A-Za-z0-9][A-Za-z0-9._-]{0,127}(/[A-Za-z0-9][A-Za-z0-9._-]{0,127})+$';
$$;

revoke all on function public._health_photo_path_belongs_to_user(uuid, text)
  from public, anon, authenticated, service_role;

create or replace function public._health_photo_path_belongs_to_epoch(
  p_user_id uuid,
  p_storage_path text,
  p_epoch bigint
)
returns boolean
language sql
immutable
set search_path = ''
as $$
  select public._health_photo_path_belongs_to_user(p_user_id, p_storage_path)
    and p_epoch >= 1
    and pg_catalog.split_part(p_storage_path, '/', 2) = 'e' || p_epoch::text;
$$;

revoke all on function public._health_photo_path_belongs_to_epoch(uuid, text, bigint)
  from public, anon, authenticated, service_role;

-- A withdrawal may also encounter a canonical pre-epoch object created by an
-- older app version. Such a path is safe to remove because fresh writes are
-- admitted only under the current e<epoch> namespace. A path carrying another
-- explicit epoch remains fail-closed so a stale operation can never target it.
create or replace function public._health_photo_path_safe_for_withdrawal(
  p_user_id uuid,
  p_storage_path text,
  p_epoch bigint
)
returns boolean
language sql
immutable
set search_path = ''
as $$
  select public._health_photo_path_belongs_to_user(p_user_id, p_storage_path)
    and p_epoch >= 0
    and (
      public._health_photo_path_belongs_to_epoch(
        p_user_id, p_storage_path, p_epoch
      )
      or pg_catalog.split_part(p_storage_path, '/', 2)
        !~ '^e[1-9][0-9]*$'
    );
$$;

revoke all on function public._health_photo_path_safe_for_withdrawal(uuid, text, bigint)
  from public, anon, authenticated, service_role;

create or replace function public._assert_current_health_session(p_user_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_session_text text := (select auth.jwt() ->> 'session_id');
  v_session_id uuid;
begin
  if p_user_id is null
     or v_session_text is null
     or v_session_text !~ '^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$' then
    raise exception 'HEALTH_CONSENT_SESSION_REJECTED' using errcode = '28000';
  end if;
  v_session_id := v_session_text::uuid;
  perform 1
    from auth.sessions as sessions
   where sessions.id = v_session_id and sessions.user_id = p_user_id
   for key share;
  if not found then
    raise exception 'HEALTH_CONSENT_SESSION_REJECTED' using errcode = '28000';
  end if;
end;
$$;

revoke all on function public._assert_current_health_session(uuid)
  from public, anon, authenticated, service_role;

create or replace function public._request_health_processing_epoch()
returns bigint
language plpgsql
stable
set search_path = ''
as $$
declare
  v_headers jsonb;
  v_epoch_header text;
  v_client_info text;
  v_client_info_segment text;
  v_client_info_epoch text;
  v_client_info_epoch_count integer := 0;
  v_epoch_text text;
begin
  begin
    v_headers := nullif(
      pg_catalog.current_setting('request.headers', true),
      ''
    )::jsonb;
  exception when others then
    raise exception 'HEALTH_PROCESSING_EPOCH_REQUIRED' using errcode = '55000';
  end;

  if v_headers is null or pg_catalog.jsonb_typeof(v_headers) <> 'object' then
    raise exception 'HEALTH_PROCESSING_EPOCH_REQUIRED' using errcode = '55000';
  end if;

  v_epoch_header := v_headers ->> 'x-onskin-health-epoch';
  v_client_info := v_headers ->> 'x-client-info';

  if v_epoch_header is not null
     and v_epoch_header !~ '^[1-9][0-9]{0,18}$' then
    raise exception 'HEALTH_PROCESSING_EPOCH_REQUIRED' using errcode = '55000';
  end if;

  -- Browser CORS does not admit an arbitrary REST header. The mobile client
  -- therefore appends one rigid metadata field to Supabase's already-admitted
  -- x-client-info header for PostgREST only. Treat any lookalike, alternative
  -- case, quoted value, whitespace around '=', or duplicate as an attempt to
  -- create an ambiguous authority channel.
  if v_client_info is not null
     and pg_catalog.strpos(
       pg_catalog.lower(v_client_info),
       'onskin-health-epoch'
     ) > 0 then
    foreach v_client_info_segment in array pg_catalog.regexp_split_to_array(
      v_client_info,
      ';'
    ) loop
      if pg_catalog.strpos(
        pg_catalog.lower(v_client_info_segment),
        'onskin-health-epoch'
      ) > 0 then
        v_client_info_segment := pg_catalog.btrim(v_client_info_segment, ' ');
        if v_client_info_segment !~ '^onskin-health-epoch=[1-9][0-9]{0,18}$' then
          raise exception 'HEALTH_PROCESSING_EPOCH_REQUIRED' using errcode = '55000';
        end if;
        v_client_info_epoch_count := v_client_info_epoch_count + 1;
        if v_client_info_epoch_count <> 1 then
          raise exception 'HEALTH_PROCESSING_EPOCH_REQUIRED' using errcode = '55000';
        end if;
        v_client_info_epoch := pg_catalog.substr(
          v_client_info_segment,
          pg_catalog.length('onskin-health-epoch=') + 1
        );
      end if;
    end loop;
  end if;

  -- A request is either a direct/native/Edge header request or a browser-safe
  -- PostgREST metadata request. Even equal values on both lanes are rejected
  -- so proxies cannot manufacture precedence or hide a conflicting duplicate.
  if v_epoch_header is not null and v_client_info_epoch is not null then
    raise exception 'HEALTH_PROCESSING_EPOCH_REQUIRED' using errcode = '55000';
  end if;
  v_epoch_text := coalesce(v_epoch_header, v_client_info_epoch);
  if v_epoch_text is null then
    raise exception 'HEALTH_PROCESSING_EPOCH_REQUIRED' using errcode = '55000';
  end if;

  begin
    return v_epoch_text::bigint;
  exception when numeric_value_out_of_range then
    raise exception 'HEALTH_PROCESSING_EPOCH_REQUIRED' using errcode = '55000';
  end;
end;
$$;

revoke all on function public._request_health_processing_epoch()
  from public, anon, authenticated, service_role;

-- Browser-safe exact dependent-generation carrier. Multiple distinct
-- protected types may be present for a compound future write (for example a
-- cloud photo needs capture plus backup); every marker must be canonical and a
-- type may appear only once. The expected type must be present exactly once.
create or replace function public._request_health_dependent_generation(
  p_expected_consent_type text
)
returns bigint
language plpgsql
stable
set search_path = ''
as $$
declare
  v_headers jsonb;
  v_client_info text;
  v_segment text;
  v_type text;
  v_generation_text text;
  v_expected_count integer := 0;
  v_expected_generation bigint;
  v_seen_types text[] := array[]::text[];
begin
  if not public._health_consent_type_protected(p_expected_consent_type) then
    raise exception 'HEALTH_DEPENDENT_CONSENT_TYPE_INVALID' using errcode = '22023';
  end if;
  begin
    v_headers := nullif(
      pg_catalog.current_setting('request.headers', true), ''
    )::jsonb;
  exception when others then
    raise exception 'HEALTH_DEPENDENT_GENERATION_REQUIRED' using errcode = '55000';
  end;
  if v_headers is null or pg_catalog.jsonb_typeof(v_headers) <> 'object'
     or v_headers ? 'x-onskin-consent-generation' then
    raise exception 'HEALTH_DEPENDENT_GENERATION_REQUIRED' using errcode = '55000';
  end if;
  v_client_info := v_headers ->> 'x-client-info';
  if v_client_info is null
     or pg_catalog.strpos(
       pg_catalog.lower(v_client_info), 'onskin-consent-generation'
     ) = 0 then
    raise exception 'HEALTH_DEPENDENT_GENERATION_REQUIRED' using errcode = '55000';
  end if;

  foreach v_segment in array pg_catalog.regexp_split_to_array(v_client_info, ';') loop
    if pg_catalog.strpos(
      pg_catalog.lower(v_segment), 'onskin-consent-generation'
    ) > 0 then
      v_segment := pg_catalog.btrim(v_segment, ' ');
      if v_segment !~ '^onskin-consent-generation=(photo_capture|photo_cloud_backup|photo_trend_insights|ask_onskin|community_participation|data_sharing):[1-9][0-9]{0,18}$' then
        raise exception 'HEALTH_DEPENDENT_GENERATION_REQUIRED' using errcode = '55000';
      end if;
      v_type := pg_catalog.split_part(
        pg_catalog.split_part(v_segment, '=', 2), ':', 1
      );
      v_generation_text := pg_catalog.split_part(v_segment, ':', 2);
      if v_type = any(v_seen_types) then
        raise exception 'HEALTH_DEPENDENT_GENERATION_REQUIRED' using errcode = '55000';
      end if;
      v_seen_types := pg_catalog.array_append(v_seen_types, v_type);
      if v_type = p_expected_consent_type then
        v_expected_count := v_expected_count + 1;
        begin
          v_expected_generation := v_generation_text::bigint;
        exception when numeric_value_out_of_range then
          raise exception 'HEALTH_DEPENDENT_GENERATION_REQUIRED' using errcode = '55000';
        end;
      end if;
    end if;
  end loop;
  if v_expected_count = 1 then
    return v_expected_generation;
  end if;
  raise exception 'HEALTH_DEPENDENT_GENERATION_REQUIRED' using errcode = '55000';
end;
$$;

revoke all on function public._request_health_dependent_generation(text)
  from public, anon, authenticated, service_role;

create or replace function public._assert_health_processing_epoch_locked(
  p_user_id uuid,
  p_expected_epoch bigint
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_state text;
  v_epoch bigint;
  v_consent_version text;
  v_consent_text_hash text;
begin
  if p_user_id is null or p_expected_epoch is null or p_expected_epoch < 1 then
    raise exception 'HEALTH_PROCESSING_OWNER_OR_EPOCH_INVALID' using errcode = '22023';
  end if;

  -- A row trigger may already hold a row lock. Never wait for the owner lock:
  -- fail fast so the lifecycle transaction can drain instead of deadlocking.
  if not pg_catalog.pg_try_advisory_xact_lock(
    public._account_deletion_advisory_key(p_user_id)
  ) then
    raise exception 'HEALTH_PROCESSING_BUSY' using errcode = '55P03';
  end if;

  if exists (
    select 1 from public.account_deletion_barriers as barriers
     where barriers.user_id = p_user_id
  ) then
    raise exception 'ACCOUNT_DELETION_IN_PROGRESS' using errcode = '55000';
  end if;

  select states.state,
         states.epoch,
         states.consent_version,
         states.consent_text_hash
    into v_state, v_epoch, v_consent_version, v_consent_text_hash
    from public.health_processing_states as states
   where states.user_id = p_user_id;
  if v_state is distinct from 'active' then
    raise exception 'HEALTH_PROCESSING_NOT_ACTIVE' using errcode = '55000';
  end if;
  if v_epoch is distinct from p_expected_epoch then
    raise exception 'HEALTH_PROCESSING_EPOCH_STALE' using errcode = '55000';
  end if;
  if not exists (
    select 1
      from public.health_consent_copy_registry as registry
     where registry.consent_type = 'health_data_collection'
       and registry.action = 'grant'
       and registry.version = v_consent_version
       and registry.consent_text_hash = v_consent_text_hash
       and registry.review_status = 'approved'
       and registry.is_current
  ) then
    raise exception 'HEALTH_PROCESSING_CONSENT_STALE' using errcode = '55000';
  end if;
end;
$$;

revoke all on function public._assert_health_processing_epoch_locked(uuid, bigint)
  from public, anon, authenticated, service_role;

create or replace function public._assert_health_dependent_generation_locked(
  p_user_id uuid,
  p_consent_type text,
  p_expected_epoch bigint,
  p_expected_generation bigint
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_state text;
  v_generation bigint;
  v_health_epoch bigint;
  v_version text;
  v_hash text;
begin
  if p_user_id is null
     or not public._health_consent_type_protected(p_consent_type)
     or p_expected_epoch is null or p_expected_epoch < 1
     or p_expected_generation is null or p_expected_generation < 1 then
    raise exception 'HEALTH_DEPENDENT_CONSENT_INPUT_INVALID' using errcode = '22023';
  end if;
  perform public._assert_health_processing_epoch_locked(
    p_user_id, p_expected_epoch
  );
  select states.state,
         states.generation,
         states.health_epoch,
         states.version,
         states.consent_text_hash
    into v_state, v_generation, v_health_epoch, v_version, v_hash
    from public.health_dependent_consent_states as states
   where states.user_id = p_user_id
     and states.consent_type = p_consent_type
   for key share;
  if v_state is distinct from 'active' then
    raise exception 'HEALTH_DEPENDENT_CONSENT_NOT_ACTIVE' using errcode = '55000';
  end if;
  if v_generation is distinct from p_expected_generation then
    raise exception 'HEALTH_DEPENDENT_CONSENT_GENERATION_STALE' using errcode = '55000';
  end if;
  if v_health_epoch is distinct from p_expected_epoch then
    raise exception 'HEALTH_DEPENDENT_CONSENT_EPOCH_STALE' using errcode = '55000';
  end if;
  perform public._assert_health_consent_copy_for_type(
    p_consent_type, 'grant', v_version, v_hash
  );
end;
$$;

revoke all on function public._assert_health_dependent_generation_locked(
  uuid, text, bigint, bigint
) from public, anon, authenticated, service_role;

create or replace function public._assert_health_dependent_active_locked(
  p_user_id uuid,
  p_consent_type text
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_epoch bigint := public._request_health_processing_epoch();
  v_generation bigint := public._request_health_dependent_generation(
    p_consent_type
  );
begin
  perform public._assert_health_dependent_generation_locked(
    p_user_id, p_consent_type, v_epoch, v_generation
  );
end;
$$;

revoke all on function public._assert_health_dependent_active_locked(uuid, text)
  from public, anon, authenticated, service_role;

create or replace function public.has_current_consent(p_consent_type text)
returns boolean
language sql
security definer
set search_path = ''
stable
as $$
  select case
    when public._health_consent_type_protected(p_consent_type) then
      exists (
        select 1
          from public.health_processing_states as base
          join public.health_dependent_consent_states as dependent
            on dependent.user_id = base.user_id
           and dependent.consent_type = p_consent_type
          join public.health_consent_copy_registry as base_registry
            on base_registry.consent_type = 'health_data_collection'
           and base_registry.action = 'grant'
           and base_registry.version = base.consent_version
           and base_registry.consent_text_hash = base.consent_text_hash
           and base_registry.review_status = 'approved'
           and base_registry.is_current
          join public.health_consent_copy_registry as registry
            on registry.consent_type = dependent.consent_type
           and registry.action = 'grant'
           and registry.version = dependent.version
           and registry.consent_text_hash = dependent.consent_text_hash
           and registry.review_status = 'approved'
           and registry.is_current
         where base.user_id = (select auth.uid())
           and base.state = 'active'
           and dependent.state = 'active'
           and dependent.health_epoch = base.epoch
           and (
             p_consent_type not in ('photo_cloud_backup', 'photo_trend_insights')
             or exists (
               select 1
                 from public.health_dependent_consent_states as capture
                 join public.health_consent_copy_registry as capture_registry
                   on capture_registry.consent_type = 'photo_capture'
                  and capture_registry.action = 'grant'
                  and capture_registry.version = capture.version
                  and capture_registry.consent_text_hash = capture.consent_text_hash
                  and capture_registry.review_status = 'approved'
                  and capture_registry.is_current
                where capture.user_id = base.user_id
                  and capture.consent_type = 'photo_capture'
                  and capture.state = 'active'
                  and capture.health_epoch = base.epoch
             )
           )
      )
    else coalesce((
      select consents.granted
        from public.consents as consents
       where consents.user_id = (select auth.uid())
         and consents.consent_type = p_consent_type
       order by consents.granted_at desc, consents.granted asc, consents.id desc
       limit 1
    ), false)
  end;
$$;

revoke all on function public.has_current_consent(text)
  from public, anon, authenticated, service_role;
grant execute on function public.has_current_consent(text) to authenticated;

create or replace function public._assert_health_processing_active_locked(p_user_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  perform public._assert_health_processing_epoch_locked(
    p_user_id,
    public._request_health_processing_epoch()
  );
end;
$$;

revoke all on function public._assert_health_processing_active_locked(uuid)
  from public, anon, authenticated, service_role;

create or replace function public._guard_direct_health_write()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_new_owner uuid;
  v_old_owner uuid;
begin
  -- An ON DELETE SET NULL referential action reaches this trigger as a nested
  -- UPDATE. Permit only that exact detach: the FK target becomes NULL and no
  -- reporter-owned value changes. Direct UPDATEs (trigger depth 1) still need
  -- the reporter's active health epoch, including service-role table writes.
  if tg_table_schema = 'public'
     and tg_table_name = 'community_reports'
     and tg_op = 'UPDATE'
     and pg_catalog.pg_trigger_depth() > 1
     and nullif(pg_catalog.to_jsonb(old) ->> 'question_id', '') is not null
     and nullif(pg_catalog.to_jsonb(new) ->> 'question_id', '') is null
     and (pg_catalog.to_jsonb(old) - 'question_id')
       = (pg_catalog.to_jsonb(new) - 'question_id') then
    return new;
  end if;

  if pg_catalog.array_length(tg_argv, 1) not in (1, 2) then
    raise exception 'HEALTH_GUARD_CONFIGURATION_INVALID' using errcode = '55000';
  end if;

  begin
    v_new_owner := nullif(pg_catalog.to_jsonb(new) ->> tg_argv[0], '')::uuid;
    if tg_op = 'UPDATE' then
      v_old_owner := nullif(pg_catalog.to_jsonb(old) ->> tg_argv[0], '')::uuid;
    end if;
  exception when others then
    raise exception 'HEALTH_PROCESSING_OWNER_INVALID' using errcode = '22023';
  end;

  if tg_op = 'UPDATE' and v_old_owner is distinct from v_new_owner then
    raise exception 'HEALTH_PROCESSING_OWNER_IMMUTABLE' using errcode = '22023';
  end if;

  if pg_catalog.array_length(tg_argv, 1) = 2 then
    if not public._health_consent_type_protected(tg_argv[1]) then
      raise exception 'HEALTH_GUARD_CONFIGURATION_INVALID' using errcode = '55000';
    end if;
    perform public._assert_health_dependent_active_locked(v_new_owner, tg_argv[1]);
  else
    perform public._assert_health_processing_active_locked(v_new_owner);
  end if;
  return new;
end;
$$;

revoke all on function public._guard_direct_health_write()
  from public, anon, authenticated, service_role;

create or replace function public._health_purge_context_active(p_user_id uuid)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
begin
  if p_user_id is null
     or pg_catalog.current_setting('onskin.health_purge', true)
       is distinct from p_user_id::text
     or not pg_catalog.pg_try_advisory_xact_lock(
       public._account_deletion_advisory_key(p_user_id)
     ) then
    return false;
  end if;
  return exists (
    select 1
      from public.health_processing_states as states
      join public.health_consent_withdrawal_operations as operations
        on operations.id = states.current_operation_id
       and operations.user_id = states.user_id
       and operations.epoch = states.epoch
      join public.health_consent_withdrawal_steps as steps
        on steps.operation_id = operations.id
       and steps.step_name = 'database_cleanup'
       and steps.status = 'running'
     where states.user_id = p_user_id
       and states.state = 'withdrawing'
       and operations.state = 'running'
  );
end;
$$;

revoke all on function public._health_purge_context_active(uuid)
  from public, anon, authenticated, service_role;

-- The owner-facing begin RPC publishes the read barrier before any asynchronous
-- cleanup. Profiles must remain readable as the account shell, so its two cached
-- health fields are zeroed in that same transaction under a narrowly attested
-- context rather than hiding the entire profile row.
create or replace function public._health_read_barrier_context_active(p_user_id uuid)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
begin
  if p_user_id is null
     or pg_catalog.current_setting('onskin.health_read_barrier', true)
       is distinct from p_user_id::text
     or not pg_catalog.pg_try_advisory_xact_lock(
       public._account_deletion_advisory_key(p_user_id)
     ) then
    return false;
  end if;
  return exists (
    select 1
      from public.health_processing_states as states
      join public.health_consent_withdrawal_operations as operations
        on operations.id = states.current_operation_id
       and operations.user_id = states.user_id
       and operations.epoch = states.epoch
      join public.health_consent_withdrawal_steps as steps
        on steps.operation_id = operations.id
       and steps.step_name = 'database_cleanup'
       and steps.status = 'pending'
     where states.user_id = p_user_id
       and states.state = 'withdrawing'
       and operations.state = 'pending'
  );
end;
$$;

revoke all on function public._health_read_barrier_context_active(uuid)
  from public, anon, authenticated, service_role;

-- Profiles are the preserved account shell, but their cached streak fields are
-- derived health-purpose state. Shell-only edits remain available while health
-- processing is closed. Auth/profile bootstrap may insert the zero-valued shell;
-- every nonzero insert or streak mutation requires the active request epoch.
create or replace function public._guard_profile_health_write()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if tg_op = 'INSERT' then
    if new.current_streak = 0 and new.longest_streak = 0 then
      return new;
    end if;
    perform public._assert_health_processing_active_locked(new.id);
    return new;
  end if;

  if old.id is distinct from new.id then
    raise exception 'HEALTH_PROCESSING_OWNER_IMMUTABLE' using errcode = '22023';
  end if;
  if old.current_streak is not distinct from new.current_streak
     and old.longest_streak is not distinct from new.longest_streak then
    return new;
  end if;
  if (
       public._health_purge_context_active(new.id)
       or public._health_read_barrier_context_active(new.id)
     )
     and new.current_streak = 0
     and new.longest_streak = 0 then
    return new;
  end if;

  perform public._assert_health_processing_active_locked(new.id);
  return new;
end;
$$;

revoke all on function public._guard_profile_health_write()
  from public, anon, authenticated, service_role;

-- Health erasure deletes completion rows in bulk and explicitly zeros the
-- cached streak once. Skip the legacy row-by-row recomputation during that
-- purge (which is otherwise quadratic), and skip it while Auth is cascading
-- the whole account. Normal owner-driven routine deletion still recomputes.
create or replace function public.on_completion_delete_streak()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if public._health_purge_context_active(old.user_id)
     or not exists (
       select 1 from auth.users as users where users.id = old.user_id
     )
     or (
       pg_catalog.pg_trigger_depth() > 1
       and exists (
         select 1
           from public.account_deletion_barriers as barriers
          where barriers.user_id = old.user_id
       )
     ) then
    return null;
  end if;
  if exists (select 1 from public.profiles as profiles where profiles.id = old.user_id) then
    perform public.recompute_streak(old.user_id);
  end if;
  return null;
end;
$$;

revoke all on function public.on_completion_delete_streak()
  from public, anon, authenticated, service_role;

create or replace function public._guard_photo_health_write()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_epoch bigint;
  v_capture_generation bigint;
  v_backup_generation bigint;
begin
  if tg_op = 'UPDATE'
     and pg_catalog.pg_trigger_depth() > 1
     and old.user_id = new.user_id
     and old.reference_photo_id is not null
     and new.reference_photo_id is null
     and (pg_catalog.to_jsonb(old) - 'reference_photo_id')
       = (pg_catalog.to_jsonb(new) - 'reference_photo_id') then
    -- Narrowly allow the self-FK ON DELETE SET NULL path used by health/account
    -- erasure. No health content or owner can change through this exception.
    return new;
  end if;
  if tg_op = 'UPDATE'
     and old.user_id = new.user_id
     and old.local_only is false
     and new.local_only is true
     and old.storage_path is not null
     and new.storage_path is null
     and (pg_catalog.to_jsonb(old) - array['local_only', 'storage_path'])
       = (pg_catalog.to_jsonb(new) - array['local_only', 'storage_path']) then
    -- Granular cloud-backup withdrawal is a monotonic privacy reduction. It
    -- may clear the remote pointer without reopening any health publisher.
    return new;
  end if;
  if tg_op = 'UPDATE' and old.user_id is distinct from new.user_id then
    raise exception 'HEALTH_PROCESSING_OWNER_IMMUTABLE' using errcode = '22023';
  end if;
  v_epoch := public._request_health_processing_epoch();
  v_capture_generation := public._request_health_dependent_generation(
    'photo_capture'
  );
  perform public._assert_health_dependent_generation_locked(
    new.user_id, 'photo_capture', v_epoch, v_capture_generation
  );
  if not new.local_only or new.storage_path is not null then
    v_backup_generation := public._request_health_dependent_generation(
      'photo_cloud_backup'
    );
    perform public._assert_health_dependent_generation_locked(
      new.user_id, 'photo_cloud_backup', v_epoch, v_backup_generation
    );
  end if;
  if new.storage_path is not null
     and not public._health_photo_path_belongs_to_epoch(
       new.user_id, new.storage_path, v_epoch
     ) then
    raise exception 'HEALTH_PHOTO_STORAGE_EPOCH_INVALID' using errcode = '22023';
  end if;
  return new;
end;
$$;

revoke all on function public._guard_photo_health_write()
  from public, anon, authenticated, service_role;

create or replace function public._guard_routine_step_health_write()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_owner uuid;
  v_old_owner uuid;
  v_epoch_text text;
  v_epoch bigint;
begin
  select routines.user_id into v_owner
    from public.routines as routines where routines.id = new.routine_id;
  if tg_op = 'UPDATE' then
    select routines.user_id into v_old_owner
      from public.routines as routines where routines.id = old.routine_id;
    if v_old_owner is distinct from v_owner then
      raise exception 'HEALTH_PROCESSING_OWNER_IMMUTABLE' using errcode = '22023';
    end if;
  end if;
  perform public._assert_health_processing_active_locked(v_owner);
  return new;
end;
$$;

revoke all on function public._guard_routine_step_health_write()
  from public, anon, authenticated, service_role;

create or replace function public._guard_cycle_night_health_write()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_owner uuid;
  v_old_owner uuid;
begin
  select cycles.user_id into v_owner
    from public.cycles as cycles where cycles.id = new.cycle_id;
  if tg_op = 'UPDATE' then
    select cycles.user_id into v_old_owner
      from public.cycles as cycles where cycles.id = old.cycle_id;
    if v_old_owner is distinct from v_owner then
      raise exception 'HEALTH_PROCESSING_OWNER_IMMUTABLE' using errcode = '22023';
    end if;
  end if;
  perform public._assert_health_processing_active_locked(v_owner);
  return new;
end;
$$;

revoke all on function public._guard_cycle_night_health_write()
  from public, anon, authenticated, service_role;

create or replace function public._guard_ask_turn_health_write()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_owner uuid;
  v_old_owner uuid;
begin
  select sessions.user_id into v_owner
    from public.ask_sessions as sessions where sessions.id = new.session_id;
  if tg_op = 'UPDATE' then
    select sessions.user_id into v_old_owner
      from public.ask_sessions as sessions where sessions.id = old.session_id;
    if v_old_owner is distinct from v_owner then
      raise exception 'HEALTH_PROCESSING_OWNER_IMMUTABLE' using errcode = '22023';
    end if;
  end if;
  perform public._assert_health_dependent_active_locked(v_owner, 'ask_onskin');
  return new;
end;
$$;

revoke all on function public._guard_ask_turn_health_write()
  from public, anon, authenticated, service_role;

create or replace function public._guard_photo_storage_health_write()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_owner uuid;
  v_old_owner uuid;
  v_epoch_text text;
  v_epoch bigint;
  v_capture_generation bigint;
  v_backup_generation bigint;
begin
  if tg_op = 'UPDATE' and old.bucket_id = 'photos' and new.bucket_id <> 'photos' then
    raise exception 'HEALTH_PHOTO_STORAGE_BUCKET_IMMUTABLE' using errcode = '22023';
  end if;
  if new.bucket_id <> 'photos' then
    return new;
  end if;

  begin
    v_owner := pg_catalog.split_part(new.name, '/', 1)::uuid;
    if tg_op = 'UPDATE' and old.bucket_id = 'photos' then
      v_old_owner := pg_catalog.split_part(old.name, '/', 1)::uuid;
    end if;
  exception when others then
    raise exception 'HEALTH_PROCESSING_OWNER_INVALID' using errcode = '22023';
  end;

  if not public._health_photo_path_belongs_to_user(v_owner, new.name) then
    raise exception 'HEALTH_PHOTO_STORAGE_PATH_INVALID' using errcode = '22023';
  end if;
  if not public._account_photo_storage_object_owned(
    v_owner,
    new.name,
    pg_catalog.to_jsonb(new) ->> 'owner',
    pg_catalog.to_jsonb(new) ->> 'owner_id'
  ) then
    raise exception 'HEALTH_PHOTO_STORAGE_OWNER_INVALID' using errcode = '22023';
  end if;
  if tg_op = 'UPDATE' and old.bucket_id = 'photos' and v_old_owner is distinct from v_owner then
    raise exception 'HEALTH_PROCESSING_OWNER_IMMUTABLE' using errcode = '22023';
  end if;

  v_epoch_text := pg_catalog.split_part(new.name, '/', 2);
  if v_epoch_text !~ '^e[1-9][0-9]{0,18}$' then
    raise exception 'HEALTH_PHOTO_STORAGE_EPOCH_INVALID' using errcode = '22023';
  end if;
  begin
    v_epoch := pg_catalog.substr(v_epoch_text, 2)::bigint;
  exception when numeric_value_out_of_range then
    raise exception 'HEALTH_PHOTO_STORAGE_EPOCH_INVALID' using errcode = '22023';
  end;
  if not public._health_photo_path_belongs_to_epoch(v_owner, new.name, v_epoch) then
    raise exception 'HEALTH_PHOTO_STORAGE_EPOCH_INVALID' using errcode = '22023';
  end if;
  v_capture_generation := public._request_health_dependent_generation(
    'photo_capture'
  );
  v_backup_generation := public._request_health_dependent_generation(
    'photo_cloud_backup'
  );
  perform public._assert_health_dependent_generation_locked(
    v_owner, 'photo_capture', v_epoch, v_capture_generation
  );
  perform public._assert_health_dependent_generation_locked(
    v_owner, 'photo_cloud_backup', v_epoch, v_backup_generation
  );
  return new;
end;
$$;

revoke all on function public._guard_photo_storage_health_write()
  from public, anon, authenticated, service_role;

-- Every direct health-purpose publisher, including service-role writers, passes
-- the same lock/state check. DELETE remains available for privacy cleanup.
create trigger trg_profiles_health_write
  before insert or update on public.profiles
  for each row execute function public._guard_profile_health_write();
create trigger trg_skin_profiles_health_write
  before insert or update on public.skin_profiles
  for each row execute function public._guard_direct_health_write('user_id');
create trigger trg_user_products_health_write
  before insert or update on public.user_products
  for each row execute function public._guard_direct_health_write('user_id');
create trigger trg_routines_health_write
  before insert or update on public.routines
  for each row execute function public._guard_direct_health_write('user_id');
create trigger trg_routine_steps_health_write
  before insert or update on public.routine_steps
  for each row execute function public._guard_routine_step_health_write();
create trigger trg_routine_completions_health_write
  before insert or update on public.routine_completions
  for each row execute function public._guard_direct_health_write('user_id');
create trigger trg_routine_conflicts_health_write
  before insert or update on public.routine_conflicts
  for each row execute function public._guard_direct_health_write('user_id');
create trigger trg_active_ramp_health_write
  before insert or update on public.active_ramp
  for each row execute function public._guard_direct_health_write('user_id');
create trigger trg_shelf_scans_health_write
  before insert or update on public.shelf_scans
  for each row execute function public._guard_direct_health_write('user_id');
create trigger trg_cycles_health_write
  before insert or update on public.cycles
  for each row execute function public._guard_direct_health_write('user_id');
create trigger trg_cycle_nights_health_write
  before insert or update on public.cycle_nights
  for each row execute function public._guard_cycle_night_health_write();
create trigger trg_streak_freezes_health_write
  before insert or update on public.streak_freezes
  for each row execute function public._guard_direct_health_write('user_id');
create trigger trg_notification_preferences_health_write
  before insert or update on public.notification_preferences
  for each row execute function public._guard_direct_health_write('user_id');
create trigger trg_notification_log_health_write
  before insert or update on public.notification_log
  for each row execute function public._guard_direct_health_write('user_id');
create trigger trg_photos_health_write
  before insert or update on public.photos
  for each row execute function public._guard_photo_health_write();
create trigger trg_recommendation_preferences_health_write
  before insert or update on public.recommendation_preferences
  for each row execute function public._guard_direct_health_write('user_id');
create trigger trg_recommendations_health_write
  before insert or update on public.recommendations
  for each row execute function public._guard_direct_health_write('user_id');
create trigger trg_catalog_corrections_health_write
  before insert or update on public.catalog_corrections
  for each row execute function public._guard_direct_health_write('user_id');
create trigger trg_catalog_lookup_events_health_write
  before insert or update on public.catalog_lookup_events
  for each row execute function public._guard_direct_health_write('user_id');
create trigger trg_community_blocks_health_write
  before insert or update on public.community_blocks
  for each row execute function public._guard_direct_health_write('user_id', 'community_participation');
create trigger trg_community_questions_health_write
  before insert or update on public.community_questions
  for each row execute function public._guard_direct_health_write('user_id', 'community_participation');
create trigger trg_community_reactions_health_write
  before insert or update on public.community_reactions
  for each row execute function public._guard_direct_health_write('user_id', 'community_participation');
create trigger trg_community_reports_health_write
  before insert or update on public.community_reports
  for each row execute function public._guard_direct_health_write('reporter_id', 'community_participation');
create trigger trg_photo_trend_health_write
  before insert or update on public.photo_trend
  for each row execute function public._guard_direct_health_write('user_id', 'photo_trend_insights');
create trigger trg_ask_sessions_health_write
  before insert or update on public.ask_sessions
  for each row execute function public._guard_direct_health_write('user_id', 'ask_onskin');
create trigger trg_ask_turn_audit_health_write
  before insert or update on public.ask_turn_audit
  for each row execute function public._guard_ask_turn_health_write();
create trigger trg_ask_safety_audit_health_write
  before insert or update on public.ask_safety_audit
  for each row execute function public._guard_direct_health_write('user_id', 'ask_onskin');
create trigger trg_photo_storage_health_write
  before insert or update on storage.objects
  for each row execute function public._guard_photo_storage_health_write();

-- Exact relational zero-attestation for the health-purpose deletion step.
-- Child and derived sources are named explicitly instead of relying only on
-- cascades, so a future FK change cannot silently weaken erasure completion.
create or replace function public._health_relational_data_exists(p_user_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select p_user_id is not null and (
    exists (select 1 from public.skin_profiles where user_id = p_user_id)
    or exists (select 1 from public.user_products where user_id = p_user_id)
    or exists (select 1 from public.shelf_scans where user_id = p_user_id)
    or exists (select 1 from public.routines where user_id = p_user_id)
    or exists (
      select 1 from public.routine_steps as steps
      join public.routines as routines on routines.id = steps.routine_id
      where routines.user_id = p_user_id
    )
    or exists (select 1 from public.routine_completions where user_id = p_user_id)
    or exists (select 1 from public.routine_conflicts where user_id = p_user_id)
    or exists (select 1 from public.active_ramp where user_id = p_user_id)
    or exists (select 1 from public.cycles where user_id = p_user_id)
    or exists (
      select 1 from public.cycle_nights as nights
      join public.cycles as cycles on cycles.id = nights.cycle_id
      where cycles.user_id = p_user_id
    )
    or exists (select 1 from public.streak_freezes where user_id = p_user_id)
    or exists (select 1 from public.notification_preferences where user_id = p_user_id)
    or exists (select 1 from public.notification_log where user_id = p_user_id)
    or exists (select 1 from public.photos where user_id = p_user_id)
    or exists (select 1 from public.recommendation_preferences where user_id = p_user_id)
    or exists (select 1 from public.recommendations where user_id = p_user_id)
    or exists (select 1 from public.catalog_corrections where user_id = p_user_id)
    or exists (select 1 from public.catalog_lookup_events where user_id = p_user_id)
    or exists (select 1 from public.commerce_click_events where user_id = p_user_id)
    or exists (
      select 1 from public.order_attributions as attributions
      join public.commerce_click_events as clicks
        on clicks.click_token = attributions.click_token
      where clicks.user_id = p_user_id
    )
    or exists (select 1 from public.community_blocks where user_id = p_user_id)
    or exists (select 1 from public.community_questions where user_id = p_user_id)
    or exists (select 1 from public.community_reactions where user_id = p_user_id)
    or exists (select 1 from public.community_reports where reporter_id = p_user_id)
    or exists (
      select 1 from public.community_reports as reports
      join public.community_questions as questions on questions.id = reports.question_id
      where questions.user_id = p_user_id
    )
    or exists (
      select 1 from public.community_moderation_events as events
      join public.community_questions as questions on questions.id = events.question_id
      where questions.user_id = p_user_id
    )
    or exists (select 1 from public.photo_trend where user_id = p_user_id)
    or exists (select 1 from public.ask_sessions where user_id = p_user_id)
    or exists (
      select 1 from public.ask_turn_audit as turns
      join public.ask_sessions as sessions on sessions.id = turns.session_id
      where sessions.user_id = p_user_id
    )
    or exists (select 1 from public.ask_safety_audit where user_id = p_user_id)
    or exists (select 1 from public.obf_contribution_queue where user_id = p_user_id)
    or exists (
      select 1 from public.profiles
       where id = p_user_id and (current_streak <> 0 or longest_streak <> 0)
    )
  );
$$;

revoke all on function public._health_relational_data_exists(uuid)
  from public, anon, authenticated, service_role;

-- This predicate is deliberately broader than the normal app export. It is
-- used only to keep a legacy, unconsented account closed until every known
-- health-purpose row (including explicitly owned Storage) has been reconciled.
create or replace function public._health_purpose_data_exists(p_user_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select p_user_id is not null and (
    public._health_relational_data_exists(p_user_id)
    or exists (
      select 1
        from storage.objects as objects
       where objects.bucket_id = 'photos'
         and (
           pg_catalog.split_part(objects.name, '/', 1) = p_user_id::text
           or pg_catalog.to_jsonb(objects) ->> 'owner' = p_user_id::text
           or pg_catalog.to_jsonb(objects) ->> 'owner_id' = p_user_id::text
         )
    )
  );
$$;

revoke all on function public._health_purpose_data_exists(uuid)
  from public, anon, authenticated, service_role;

-- -----------------------------------------------------------------------------
-- Immediate read barrier
-- -----------------------------------------------------------------------------
-- `private` is intentionally absent from PostgREST's exposed-schema list. The
-- authenticated role can execute this predicate only through stored RLS policy
-- expressions; it has no schema USAGE and therefore cannot address the helper
-- directly. Service-role cleanup/export clients bypass RLS as before.
create schema if not exists private;
revoke all on schema private from public, anon, authenticated, service_role;

create or replace function private.health_processing_read_allowed(p_row_owner uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  with caller as (
    select auth.uid() as user_id
  )
  select caller.user_id is not null
    and p_row_owner is not null
    and exists (
      select 1
        from public.health_processing_states as states
       where states.user_id = caller.user_id
         and states.state = 'active'
         and states.epoch = public._request_health_processing_epoch()
         and exists (
           select 1
             from public.health_consent_copy_registry as registry
            where registry.consent_type = 'health_data_collection'
              and registry.action = 'grant'
              and registry.version = states.consent_version
              and registry.consent_text_hash = states.consent_text_hash
              and registry.review_status = 'approved'
              and registry.is_current
         )
    )
    and (
      p_row_owner = caller.user_id
      or exists (
        select 1
          from public.health_processing_states as owner_states
         where owner_states.user_id = p_row_owner
           and owner_states.state = 'active'
           and exists (
             select 1
               from public.health_consent_copy_registry as owner_registry
              where owner_registry.consent_type = 'health_data_collection'
                and owner_registry.action = 'grant'
                and owner_registry.version = owner_states.consent_version
                and owner_registry.consent_text_hash = owner_states.consent_text_hash
                and owner_registry.review_status = 'approved'
                and owner_registry.is_current
           )
      )
    )
  from caller;
$$;

revoke all on function private.health_processing_read_allowed(uuid)
  from public, anon, authenticated, service_role;
grant execute on function private.health_processing_read_allowed(uuid)
  to authenticated;

create or replace function private.health_dependent_read_allowed(
  p_row_owner uuid,
  p_consent_type text
)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  with caller as (
    select auth.uid() as user_id
  )
  select public._health_consent_type_protected(p_consent_type)
    and private.health_processing_read_allowed(p_row_owner)
    and exists (
      select 1
        from public.health_processing_states as base
        join public.health_dependent_consent_states as dependent
          on dependent.user_id = base.user_id
         and dependent.consent_type = p_consent_type
        join public.health_consent_copy_registry as registry
          on registry.consent_type = dependent.consent_type
         and registry.action = 'grant'
         and registry.version = dependent.version
         and registry.consent_text_hash = dependent.consent_text_hash
         and registry.review_status = 'approved'
         and registry.is_current
       where base.user_id = caller.user_id
         and base.state = 'active'
         and dependent.state = 'active'
         and dependent.health_epoch = base.epoch
    )
    and (
      p_row_owner = caller.user_id
      or exists (
        select 1
          from public.health_processing_states as owner_base
          join public.health_dependent_consent_states as owner_dependent
            on owner_dependent.user_id = owner_base.user_id
           and owner_dependent.consent_type = p_consent_type
          join public.health_consent_copy_registry as owner_registry
            on owner_registry.consent_type = owner_dependent.consent_type
           and owner_registry.action = 'grant'
           and owner_registry.version = owner_dependent.version
           and owner_registry.consent_text_hash = owner_dependent.consent_text_hash
           and owner_registry.review_status = 'approved'
           and owner_registry.is_current
         where owner_base.user_id = p_row_owner
           and owner_base.state = 'active'
           and owner_dependent.state = 'active'
           and owner_dependent.health_epoch = owner_base.epoch
      )
    )
  from caller;
$$;

revoke all on function private.health_dependent_read_allowed(uuid, text)
  from public, anon, authenticated, service_role;
grant execute on function private.health_dependent_read_allowed(uuid, text)
  to authenticated;

-- These SECURITY DEFINER ownership predicates must remain executable by the
-- authenticated role because older child-table RLS policies call them. Bind
-- their direct RPC surface to the same read barrier so a caller holding a
-- previously known row UUID cannot use a boolean ownership probe to confirm
-- residual health data while withdrawal is pending.
create or replace function public.owns_routine(p_routine_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select private.health_processing_read_allowed((select auth.uid()))
    and exists (
      select 1
        from public.routines as routines
       where routines.id = p_routine_id
         and routines.user_id = (select auth.uid())
    );
$$;

create or replace function public.owns_user_product(p_product_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select private.health_processing_read_allowed((select auth.uid()))
    and exists (
      select 1
        from public.user_products as products
       where products.id = p_product_id
         and products.user_id = (select auth.uid())
    );
$$;

create or replace function public.owns_cycle(p_cycle_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select private.health_processing_read_allowed((select auth.uid()))
    and exists (
      select 1
        from public.cycles as cycles
       where cycles.id = p_cycle_id
         and cycles.user_id = (select auth.uid())
    );
$$;

create or replace function public.owns_photo(p_photo_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select private.health_dependent_read_allowed(
      (select auth.uid()), 'photo_capture'
    )
    and exists (
      select 1
        from public.photos as photos
       where photos.id = p_photo_id
         and photos.user_id = (select auth.uid())
         and (
           photos.local_only
           or private.health_dependent_read_allowed(
             (select auth.uid()), 'photo_cloud_backup'
           )
         )
    );
$$;

create or replace function public.owns_ask_turn_audit(p_turn_audit_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select private.health_dependent_read_allowed((select auth.uid()), 'ask_onskin')
    and exists (
      select 1
        from public.ask_turn_audit as turns
        join public.ask_sessions as sessions on sessions.id = turns.session_id
       where turns.id = p_turn_audit_id
         and sessions.user_id = (select auth.uid())
    );
$$;

revoke all on function public.owns_routine(uuid) from public, anon;
revoke all on function public.owns_user_product(uuid) from public, anon;
revoke all on function public.owns_cycle(uuid) from public, anon;
revoke all on function public.owns_photo(uuid) from public, anon;
revoke all on function public.owns_ask_turn_audit(uuid) from public, anon;
grant execute on function public.owns_routine(uuid) to authenticated;
grant execute on function public.owns_user_product(uuid) to authenticated;
grant execute on function public.owns_cycle(uuid) to authenticated;
grant execute on function public.owns_photo(uuid) to authenticated;
grant execute on function public.owns_ask_turn_audit(uuid) to authenticated;

create or replace function public.owns_consent(p_consent_id uuid)
returns boolean
language sql
security definer
set search_path = ''
stable
as $$
  select exists (
    select 1
      from public.health_dependent_consent_states as states
     where states.user_id = (select auth.uid())
       and states.consent_type = 'community_participation'
       and states.state = 'active'
       and states.current_receipt_id = p_consent_id
       and states.health_epoch = public._request_health_processing_epoch()
  );
$$;

revoke all on function public.owns_consent(uuid)
  from public, anon, service_role;
grant execute on function public.owns_consent(uuid) to authenticated;

-- Exact health-purpose owner/client inventory. Mixed-purpose profiles, the
-- immutable consent ledger, and billing entitlements remain readable; profile
-- streak caches are synchronously zeroed when the barrier is published.
create policy "health_processing_read_fence" on public.skin_profiles
  as restrictive for select to authenticated
  using (private.health_processing_read_allowed((select auth.uid())));
create policy "health_processing_read_fence" on public.user_products
  as restrictive for select to authenticated
  using (private.health_processing_read_allowed((select auth.uid())));
create policy "health_processing_read_fence" on public.routines
  as restrictive for select to authenticated
  using (private.health_processing_read_allowed((select auth.uid())));
create policy "health_processing_read_fence" on public.routine_steps
  as restrictive for select to authenticated
  using (private.health_processing_read_allowed((select auth.uid())));
create policy "health_processing_read_fence" on public.routine_completions
  as restrictive for select to authenticated
  using (private.health_processing_read_allowed((select auth.uid())));
create policy "health_processing_read_fence" on public.routine_conflicts
  as restrictive for select to authenticated
  using (private.health_processing_read_allowed((select auth.uid())));
create policy "health_processing_read_fence" on public.active_ramp
  as restrictive for select to authenticated
  using (private.health_processing_read_allowed((select auth.uid())));
create policy "health_processing_read_fence" on public.shelf_scans
  as restrictive for select to authenticated
  using (private.health_processing_read_allowed((select auth.uid())));
create policy "health_processing_read_fence" on public.cycles
  as restrictive for select to authenticated
  using (private.health_processing_read_allowed((select auth.uid())));
create policy "health_processing_read_fence" on public.cycle_nights
  as restrictive for select to authenticated
  using (private.health_processing_read_allowed((select auth.uid())));
create policy "health_processing_read_fence" on public.streak_freezes
  as restrictive for select to authenticated
  using (private.health_processing_read_allowed((select auth.uid())));
create policy "health_processing_read_fence" on public.notification_preferences
  as restrictive for select to authenticated
  using (private.health_processing_read_allowed((select auth.uid())));
create policy "health_processing_read_fence" on public.notification_log
  as restrictive for select to authenticated
  using (private.health_processing_read_allowed((select auth.uid())));
create policy "health_processing_read_fence" on public.photos
  as restrictive for select to authenticated
  using (
    private.health_dependent_read_allowed((select auth.uid()), 'photo_capture')
    and (
      local_only
      or private.health_dependent_read_allowed(
        (select auth.uid()), 'photo_cloud_backup'
      )
    )
  );
create policy "health_processing_read_fence" on public.recommendation_preferences
  as restrictive for select to authenticated
  using (private.health_processing_read_allowed((select auth.uid())));
create policy "health_processing_read_fence" on public.recommendations
  as restrictive for select to authenticated
  using (private.health_processing_read_allowed((select auth.uid())));
create policy "health_processing_read_fence" on public.catalog_corrections
  as restrictive for select to authenticated
  using (private.health_processing_read_allowed((select auth.uid())));
create policy "health_processing_read_fence" on public.catalog_lookup_events
  as restrictive for select to authenticated
  using (private.health_processing_read_allowed((select auth.uid())));
create policy "health_processing_read_fence" on public.commerce_click_events
  as restrictive for select to authenticated
  using (
    private.health_dependent_read_allowed((select auth.uid()), 'data_sharing')
  );
create policy "health_processing_read_fence" on public.community_blocks
  as restrictive for select to authenticated
  using (
    private.health_dependent_read_allowed(
      (select auth.uid()), 'community_participation'
    )
  );
create policy "health_processing_read_fence" on public.community_questions
  as restrictive for select to authenticated
  using (
    private.health_dependent_read_allowed(user_id, 'community_participation')
  );
create policy "health_processing_read_fence" on public.community_reactions
  as restrictive for select to authenticated
  using (
    private.health_dependent_read_allowed(
      (select auth.uid()), 'community_participation'
    )
  );
create policy "health_processing_read_fence" on public.community_reports
  as restrictive for select to authenticated
  using (
    private.health_dependent_read_allowed(
      (select auth.uid()), 'community_participation'
    )
  );
create policy "health_processing_read_fence" on public.photo_trend
  as restrictive for select to authenticated
  using (
    private.health_dependent_read_allowed(
      (select auth.uid()), 'photo_trend_insights'
    )
    and private.health_dependent_read_allowed(
      (select auth.uid()), 'photo_capture'
    )
  );
create policy "health_processing_read_fence" on public.ask_sessions
  as restrictive for select to authenticated
  using (
    private.health_dependent_read_allowed((select auth.uid()), 'ask_onskin')
  );
create policy "health_processing_read_fence" on public.ask_turn_audit
  as restrictive for select to authenticated
  using (
    private.health_dependent_read_allowed((select auth.uid()), 'ask_onskin')
  );
create policy "health_processing_read_fence" on public.ask_safety_audit
  as restrictive for select to authenticated
  using (
    private.health_dependent_read_allowed((select auth.uid()), 'ask_onskin')
  );
create policy "health_processing_read_fence" on storage.objects
  as restrictive for select to authenticated
  using (
    bucket_id <> 'photos'
    or (
      private.health_dependent_read_allowed((select auth.uid()), 'photo_capture')
      and private.health_dependent_read_allowed(
        (select auth.uid()), 'photo_cloud_backup'
      )
    )
  );

-- -----------------------------------------------------------------------------
-- Initial state and future-user initialization
-- -----------------------------------------------------------------------------

insert into public.health_processing_states (
  user_id,
  state,
  epoch,
  consent_version,
  consent_text_hash,
  last_server_verified_at
)
select
  users.id,
  case
    when latest.granted is true
      and latest.grant_released
      then 'active'
    else 'unconsented'
  end,
  case
    when latest.granted is true
      and latest.grant_released
      then 1
    else 0
  end,
  case
    when latest.granted is true
      and latest.grant_released
      then latest.version
    else null
  end,
  case
    when latest.granted is true
      and latest.grant_released
      then latest.consent_text_hash
    else null
  end,
  case
    when latest.granted is true
      and latest.grant_released
      then now()
    else null
  end
from auth.users as users
left join lateral (
  select consents.granted,
         consents.version,
         consents.consent_text_hash,
         exists (
           select 1
             from public.health_consent_copy_registry as registry
            where registry.consent_type = 'health_data_collection'
              and registry.action = 'grant'
              and registry.version = consents.version
              and registry.consent_text_hash = consents.consent_text_hash
              and registry.review_status = 'approved'
              and registry.is_current
         ) as grant_released
    from public.consents as consents
   where consents.user_id = users.id
     and consents.consent_type = 'health_data_collection'
   order by consents.granted_at desc, consents.granted asc, consents.id desc
   limit 1
) as latest on true
on conflict (user_id) do nothing;

-- A prior release could leave health rows behind without a usable consent
-- receipt. Such accounts enter the same durable cleanup lifecycle immediately;
-- a new grant is impossible until absence has been attested.
insert into public.health_consent_withdrawal_operations (
  user_id,
  epoch,
  idempotency_digest,
  state,
  last_result_code,
  requested_at,
  updated_at
)
select states.user_id,
       1,
       pg_catalog.encode(
         extensions.digest(
           pg_catalog.convert_to(
             'health-consent-legacy-cleanup:v1:' || states.user_id::text,
             'UTF8'
           ),
           'sha256'
         ),
         'hex'
       ),
       'pending',
       'LEGACY_HEALTH_DATA_DISCOVERED',
       now(),
       now()
  from public.health_processing_states as states
 where states.state = 'unconsented'
   and public._health_purpose_data_exists(states.user_id)
on conflict (user_id, epoch) do nothing;

insert into public.health_consent_withdrawal_steps (
  operation_id, step_name, step_order, status, updated_at
)
select operations.id, steps.step_name, steps.step_order, 'pending', now()
  from public.health_consent_withdrawal_operations as operations
 cross join (values
   ('database_cleanup'::text, 10::smallint),
   ('photo_storage_delete'::text, 20::smallint),
   ('processor_reconciliation'::text, 30::smallint)
 ) as steps(step_name, step_order)
 where operations.epoch = 1
   and operations.last_result_code = 'LEGACY_HEALTH_DATA_DISCOVERED'
on conflict (operation_id, step_name) do nothing;

update public.health_processing_states as states
   set state = 'withdrawing',
       epoch = operations.epoch,
       current_operation_id = operations.id,
       withdrawal_requested_at = operations.requested_at,
       updated_at = greatest(states.updated_at, operations.requested_at)
  from public.health_consent_withdrawal_operations as operations
 where operations.user_id = states.user_id
   and operations.epoch = 1
   and operations.last_result_code = 'LEGACY_HEALTH_DATA_DISCOVERED'
   and states.state = 'unconsented';

create or replace function public.initialize_health_processing_state()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.health_processing_states (user_id, state, epoch)
  values (new.id, 'unconsented', 0)
  on conflict (user_id) do nothing;
  perform public._ensure_health_dependent_consent_states(new.id);
  return new;
exception when others then
  -- As with handle_new_user, health-state initialization must never block Auth.
  return new;
end;
$$;

revoke all on function public.initialize_health_processing_state()
  from public, anon, authenticated, service_role;

create trigger on_auth_user_created_health_processing_state
  after insert on auth.users
  for each row execute function public.initialize_health_processing_state();

-- Every base or protected dependent receipt must consume the exact sealed
-- capability in the same transaction. The complete tuple is matched and
-- cleared atomically before the immutable ledger row can exist. A custom GUC,
-- table grant, or same-transaction second insert cannot supply authority.
create or replace function public._guard_health_consent_insert()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_action text;
  v_scope text;
begin
  if new.consent_type <> 'health_data_collection'
     and not public._health_consent_type_protected(new.consent_type) then
    return new;
  end if;

  with capability as (
    select states.user_id,
           states.receipt_capability_action as action,
           states.receipt_capability_scope as scope
      from public.health_processing_states as states
     where states.user_id = new.user_id
       and states.receipt_capability_xid = pg_catalog.pg_current_xact_id()
       and states.receipt_capability_backend_pid = pg_catalog.pg_backend_pid()
       and states.receipt_capability_consent_type = new.consent_type
       and states.receipt_capability_granted = new.granted
       and states.receipt_capability_version = new.version
       and states.receipt_capability_text_hash = new.consent_text_hash
     for update
  )
  update public.health_processing_states as states
     set receipt_capability_xid = null,
         receipt_capability_backend_pid = null,
         receipt_capability_consent_type = null,
         receipt_capability_granted = null,
         receipt_capability_version = null,
         receipt_capability_text_hash = null,
         receipt_capability_action = null,
         receipt_capability_scope = null
    from capability
   where states.user_id = capability.user_id
  returning capability.action,
            capability.scope
       into v_action, v_scope;
  if not found then
    raise exception 'HEALTH_CONSENT_RECEIPT_CAPABILITY_REQUIRED'
      using errcode = '42501';
  end if;

  if (v_action = 'base_grant'
       and (new.consent_type <> 'health_data_collection' or not new.granted))
     or (v_action = 'base_decline'
       and (new.consent_type <> 'health_data_collection' or new.granted))
     or (v_action = 'base_withdrawal'
       and (new.consent_type <> 'health_data_collection' or new.granted))
     or (v_action = 'base_withdrawal_dependent'
       and (not public._health_consent_type_protected(new.consent_type) or new.granted))
     or (v_action = 'dependent_grant'
       and (not public._health_consent_type_protected(new.consent_type) or not new.granted))
     or (v_action = 'dependent_withdrawal'
       and (not public._health_consent_type_protected(new.consent_type) or new.granted))
     or v_action is null
     or v_scope is null then
    raise exception 'HEALTH_CONSENT_RECEIPT_CAPABILITY_MISMATCH'
      using errcode = '42501';
  end if;

  perform public._assert_health_consent_copy_for_type(
    new.consent_type,
    case
      when v_action = 'base_decline' then 'decline'
      when new.granted then 'grant'
      else 'withdraw'
    end,
    new.version,
    new.consent_text_hash
  );
  return new;
end;
$$;

revoke all on function public._guard_health_consent_insert()
  from public, anon, authenticated, service_role;

create trigger trg_health_consent_rpc_only
  before insert on public.consents
  for each row execute function public._guard_health_consent_insert();

drop policy if exists "consents_insert_own" on public.consents;
create policy "consents_insert_own" on public.consents
  for insert to authenticated
  with check (
    (select auth.uid()) = user_id
    and consent_type <> 'health_data_collection'
    and consent_type <> all(array[
      'photo_capture',
      'photo_cloud_backup',
      'photo_trend_insights',
      'ask_onskin',
      'community_participation',
      'data_sharing'
    ]::text[])
  );

create or replace function public._ensure_health_dependent_consent_states(
  p_user_id uuid
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if p_user_id is null then
    raise exception 'HEALTH_DEPENDENT_CONSENT_OWNER_INVALID' using errcode = '22023';
  end if;
  insert into public.health_dependent_consent_states (
    user_id, consent_type, state, generation
  )
  select p_user_id, types.consent_type, 'unconsented', 0
    from unnest(array[
      'photo_capture',
      'photo_cloud_backup',
      'photo_trend_insights',
      'ask_onskin',
      'community_participation',
      'data_sharing'
    ]::text[]) as types(consent_type)
  on conflict on constraint health_dependent_consent_states_pkey do nothing;
end;
$$;

revoke all on function public._ensure_health_dependent_consent_states(uuid)
  from public, anon, authenticated, service_role;

-- Fail-closed upgrade for any pre-migration ledger history. Only an exact
-- current grant under an active exact base epoch becomes active. Unknown copy,
-- a latest refusal, or no receipt stays unconsented; history still advances the
-- monotonic generation so a stale installed client cannot recreate generation 0.
insert into public.health_dependent_consent_states (
  user_id, consent_type, state, generation
)
select users.id, types.consent_type, 'unconsented', 0
  from auth.users as users
 cross join unnest(array[
   'photo_capture',
   'photo_cloud_backup',
   'photo_trend_insights',
   'ask_onskin',
   'community_participation',
   'data_sharing'
 ]::text[]) as types(consent_type)
on conflict on constraint health_dependent_consent_states_pkey do nothing;

with receipt_counts as (
  select consents.user_id,
         consents.consent_type,
         count(*)::bigint as generation
    from public.consents as consents
   where public._health_consent_type_protected(consents.consent_type)
   group by consents.user_id, consents.consent_type
)
update public.health_dependent_consent_states as states
   set generation = receipt_counts.generation,
       updated_at = now()
  from receipt_counts
 where states.user_id = receipt_counts.user_id
   and states.consent_type = receipt_counts.consent_type;

with latest as (
  select distinct on (consents.user_id, consents.consent_type)
         consents.id,
         consents.user_id,
         consents.consent_type,
         consents.granted,
         consents.version,
         consents.consent_text_hash
    from public.consents as consents
   where public._health_consent_type_protected(consents.consent_type)
   order by consents.user_id, consents.consent_type,
            consents.granted_at desc, consents.granted asc, consents.id desc
)
update public.health_dependent_consent_states as states
   set state = 'active',
       health_epoch = base.epoch,
       current_receipt_id = latest.id,
       version = latest.version,
       consent_text_hash = latest.consent_text_hash,
       updated_at = now()
  from latest
  join public.health_processing_states as base
    on base.user_id = latest.user_id
   and base.state = 'active'
  join public.health_consent_copy_registry as registry
    on registry.consent_type = latest.consent_type
   and registry.action = 'grant'
   and registry.version = latest.version
   and registry.consent_text_hash = latest.consent_text_hash
   and registry.review_status = 'approved'
   and registry.is_current
 where states.user_id = latest.user_id
   and states.consent_type = latest.consent_type
   and latest.granted;

-- Persist the exact authority generation on each click token. The provider
-- order poller can then recheck the original owner/epoch/generation without a
-- caller JWT or mutable request header, and the existing FK prevents orphan or
-- post-withdrawal token recreation.
alter table public.commerce_click_events
  add column health_processing_epoch bigint,
  add column data_sharing_generation bigint;

update public.commerce_click_events as clicks
   set health_processing_epoch = dependent.health_epoch,
       data_sharing_generation = dependent.generation
  from public.health_dependent_consent_states as dependent
 where dependent.user_id = clicks.user_id
   and dependent.consent_type = 'data_sharing'
   and dependent.state = 'active';

update public.order_attributions as attributions
   set click_token = null
 where attributions.click_token in (
   select clicks.click_token
     from public.commerce_click_events as clicks
    where clicks.health_processing_epoch is null
       or clicks.data_sharing_generation is null
 );
delete from public.commerce_click_events as clicks
 where clicks.health_processing_epoch is null
    or clicks.data_sharing_generation is null;

alter table public.commerce_click_events
  alter column health_processing_epoch set not null,
  alter column data_sharing_generation set not null,
  add constraint commerce_click_events_health_processing_epoch_check
    check (health_processing_epoch >= 1),
  add constraint commerce_click_events_data_sharing_generation_check
    check (data_sharing_generation >= 1);

create or replace function public._guard_commerce_click_health_write()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_epoch bigint := public._request_health_processing_epoch();
  v_generation bigint := public._request_health_dependent_generation('data_sharing');
begin
  if tg_op = 'UPDATE' then
    if old.user_id is distinct from new.user_id then
      raise exception 'HEALTH_PROCESSING_OWNER_IMMUTABLE' using errcode = '22023';
    end if;
    if old.click_token is distinct from new.click_token
       or old.health_processing_epoch is distinct from new.health_processing_epoch
       or old.data_sharing_generation is distinct from new.data_sharing_generation then
      raise exception 'COMMERCE_CLICK_AUTHORITY_IMMUTABLE' using errcode = '22023';
    end if;
  elsif (new.health_processing_epoch is not null
      and new.health_processing_epoch <> v_epoch)
     or (new.data_sharing_generation is not null
      and new.data_sharing_generation <> v_generation) then
    raise exception 'COMMERCE_CLICK_AUTHORITY_INVALID' using errcode = '22023';
  end if;
  perform public._assert_health_dependent_generation_locked(
    new.user_id, 'data_sharing', v_epoch, v_generation
  );
  new.health_processing_epoch := v_epoch;
  new.data_sharing_generation := v_generation;
  return new;
end;
$$;

revoke all on function public._guard_commerce_click_health_write()
  from public, anon, authenticated, service_role;

create trigger trg_commerce_click_events_health_write
  before insert or update on public.commerce_click_events
  for each row execute function public._guard_commerce_click_health_write();

create or replace function public._guard_order_attribution_click_authority()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_owner uuid;
  v_epoch bigint;
  v_generation bigint;
begin
  if new.click_token is null then
    return new;
  end if;
  if tg_op = 'UPDATE'
     and old.click_token is not null
     and new.click_token is distinct from old.click_token then
    raise exception 'ORDER_ATTRIBUTION_CLICK_TOKEN_IMMUTABLE' using errcode = '22023';
  end if;
  select clicks.user_id,
         clicks.health_processing_epoch,
         clicks.data_sharing_generation
    into v_owner, v_epoch, v_generation
    from public.commerce_click_events as clicks
   where clicks.click_token = new.click_token
   for key share;
  if v_owner is null then
    raise exception 'ORDER_ATTRIBUTION_CLICK_TOKEN_UNKNOWN' using errcode = '23503';
  end if;
  perform public._assert_health_dependent_generation_locked(
    v_owner, 'data_sharing', v_epoch, v_generation
  );
  return new;
end;
$$;

revoke all on function public._guard_order_attribution_click_authority()
  from public, anon, authenticated, service_role;

create trigger trg_order_attributions_click_authority
  before insert or update on public.order_attributions
  for each row execute function public._guard_order_attribution_click_authority();

create or replace function public.get_health_dependent_consent_status(
  p_consent_type text
)
returns table (
  consent_type text,
  state text,
  generation bigint,
  health_epoch bigint,
  version text,
  consent_text_hash text
)
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user_id uuid := (select auth.uid());
begin
  if v_user_id is null then
    raise exception 'HEALTH_DEPENDENT_CONSENT_AUTH_REQUIRED' using errcode = '42501';
  end if;
  perform public._assert_current_health_session(v_user_id);
  if not public._health_consent_type_protected(p_consent_type) then
    raise exception 'HEALTH_DEPENDENT_CONSENT_TYPE_INVALID' using errcode = '22023';
  end if;

  perform pg_catalog.pg_advisory_xact_lock(
    public._account_deletion_advisory_key(v_user_id)
  );
  if exists (
    select 1 from public.account_deletion_barriers as barriers
     where barriers.user_id = v_user_id
  ) then
    raise exception 'ACCOUNT_DELETION_IN_PROGRESS' using errcode = '55000';
  end if;
  perform public._ensure_health_dependent_consent_states(v_user_id);

  return query
  select states.consent_type,
         states.state,
         states.generation,
         case
           -- Terminal dependent rows deliberately do not acquire a new epoch
           -- merely because the base purpose was re-opened.  The RPC still
           -- has to expose the current active base epoch as grant-CAS context,
           -- otherwise an initially unconsented (or later withdrawn) purpose
           -- could never be granted without direct table access.
           when states.state in ('unconsented', 'withdrawn')
                and base.state = 'active'
             then base.epoch
           else states.health_epoch
         end as health_epoch,
         states.version,
         states.consent_text_hash
    from public.health_dependent_consent_states as states
    join public.health_processing_states as base
      on base.user_id = states.user_id
   where states.user_id = v_user_id
     and states.consent_type = p_consent_type;
end;
$$;

revoke all on function public.get_health_dependent_consent_status(text)
  from public, anon, service_role;
grant execute on function public.get_health_dependent_consent_status(text)
  to authenticated;

-- A grant is a CAS over both base processing epoch and the dependent
-- generation. The durable idempotency operation makes response-loss retry
-- exact while refusing conflicting key reuse or an ABA replay after withdrawal.
create or replace function public.record_health_dependent_consent(
  p_expected_epoch bigint,
  p_expected_generation bigint,
  p_idempotency_key text,
  p_consent_type text,
  p_version text,
  p_consent_text_hash text
)
returns table (
  consent_type text,
  state text,
  generation bigint,
  health_epoch bigint,
  version text,
  consent_text_hash text
)
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user_id uuid := (select auth.uid());
  v_digest text;
  v_now timestamptz;
  v_state public.health_dependent_consent_states%rowtype;
  v_operation public.health_dependent_consent_operations%rowtype;
  v_next_generation bigint;
  v_consent_id uuid;
begin
  if v_user_id is null then
    raise exception 'HEALTH_DEPENDENT_CONSENT_AUTH_REQUIRED' using errcode = '42501';
  end if;
  perform public._assert_current_health_session(v_user_id);
  if p_expected_epoch is null or p_expected_epoch < 1
     or p_expected_generation is null or p_expected_generation < 0
     or p_idempotency_key is null or p_idempotency_key !~ '^[a-f0-9]{64}$'
     or not public._health_consent_type_protected(p_consent_type)
     or p_version is null
     or p_version <> pg_catalog.btrim(p_version)
     or pg_catalog.length(p_version) not between 1 and 120
     or p_consent_text_hash is null
     or p_consent_text_hash !~ '^[a-f0-9]{64}$' then
    raise exception 'HEALTH_DEPENDENT_CONSENT_INPUT_INVALID' using errcode = '22023';
  end if;
  v_digest := public._health_consent_token_digest(p_idempotency_key);

  perform pg_catalog.pg_advisory_xact_lock(
    public._account_deletion_advisory_key(v_user_id)
  );
  v_now := pg_catalog.clock_timestamp();
  if exists (
    select 1 from public.account_deletion_barriers as barriers
     where barriers.user_id = v_user_id
  ) then
    raise exception 'ACCOUNT_DELETION_IN_PROGRESS' using errcode = '55000';
  end if;
  perform public._ensure_health_dependent_consent_states(v_user_id);

  select states.* into v_state
    from public.health_dependent_consent_states as states
   where states.user_id = v_user_id
     and states.consent_type = p_consent_type
   for update;

  select operations.* into v_operation
    from public.health_dependent_consent_operations as operations
   where operations.user_id = v_user_id
     and operations.idempotency_digest = v_digest;
  if v_operation.id is not null then
    if v_operation.action <> 'grant'
       or v_operation.consent_type <> p_consent_type
       or v_operation.expected_processing_epoch <> p_expected_epoch
       or v_operation.expected_generation <> p_expected_generation
       or v_operation.version <> p_version
       or v_operation.consent_text_hash <> p_consent_text_hash then
      raise exception 'HEALTH_DEPENDENT_IDEMPOTENCY_KEY_REUSED' using errcode = '55000';
    end if;
    if v_operation.state <> 'completed'
       or v_state.state <> 'active'
       or v_state.generation <> v_operation.consent_generation
       or v_state.health_epoch <> v_operation.expected_processing_epoch
       or v_state.current_receipt_id is distinct from v_operation.receipt_id then
      raise exception 'HEALTH_DEPENDENT_IDEMPOTENT_REPLAY_STALE' using errcode = '55000';
    end if;
    return query
    select v_state.consent_type, v_state.state, v_state.generation,
           v_state.health_epoch, v_state.version, v_state.consent_text_hash;
    return;
  end if;

  -- Existing exact operations replay their committed receipt even if release
  -- approval changes later. New operations require the current exact reviewed
  -- copy before any base-state or dependency detail is exposed.
  perform public._assert_health_consent_copy_for_type(
    p_consent_type, 'grant', p_version, p_consent_text_hash
  );
  perform public._assert_health_processing_epoch_locked(
    v_user_id, p_expected_epoch
  );

  if p_consent_type in ('photo_cloud_backup', 'photo_trend_insights')
     and not exists (
       select 1
         from public.health_dependent_consent_states as capture
         join public.health_consent_copy_registry as registry
           on registry.consent_type = 'photo_capture'
          and registry.action = 'grant'
          and registry.version = capture.version
          and registry.consent_text_hash = capture.consent_text_hash
          and registry.review_status = 'approved'
          and registry.is_current
        where capture.user_id = v_user_id
          and capture.consent_type = 'photo_capture'
          and capture.state = 'active'
          and capture.health_epoch = p_expected_epoch
     ) then
    raise exception 'PHOTO_CAPTURE_CONSENT_REQUIRED' using errcode = '55000';
  end if;

  if v_state.generation <> p_expected_generation then
    raise exception 'HEALTH_DEPENDENT_CONSENT_GENERATION_STALE' using errcode = '55000';
  end if;
  if v_state.state = 'withdrawing' then
    raise exception 'HEALTH_DEPENDENT_WITHDRAWAL_NOT_COMPLETE' using errcode = '55000';
  end if;
  if v_state.state = 'active' then
    raise exception 'HEALTH_DEPENDENT_CONSENT_ALREADY_ACTIVE' using errcode = '55000';
  end if;
  if v_state.generation = 9223372036854775807 then
    raise exception 'HEALTH_DEPENDENT_GENERATION_EXHAUSTED' using errcode = '22003';
  end if;
  v_next_generation := v_state.generation + 1;

  insert into public.health_dependent_consent_operations (
    user_id, consent_type, action, idempotency_digest,
    expected_processing_epoch, expected_generation, consent_generation,
    version, consent_text_hash, state, requested_at, updated_at
  ) values (
    v_user_id, p_consent_type, 'grant', v_digest,
    p_expected_epoch, p_expected_generation, v_next_generation,
    p_version, p_consent_text_hash, 'pending', v_now, v_now
  ) returning * into v_operation;

  perform public._issue_health_consent_receipt_capability(
    v_user_id,
    p_consent_type,
    true,
    p_version,
    p_consent_text_hash,
    'dependent_grant',
    'dependent:grant:' || p_consent_type || ':e' || p_expected_epoch::text
      || ':g' || v_next_generation::text || ':' || v_digest
  );
  insert into public.consents (
    user_id,
    consent_type,
    granted,
    version,
    consent_text_hash,
    granted_at
  ) values (
    v_user_id,
    p_consent_type,
    true,
    p_version,
    p_consent_text_hash,
    v_now
  ) returning id into v_consent_id;
  perform public._assert_health_consent_capability_cleared(v_user_id);

  update public.health_dependent_consent_operations as operations
     set receipt_id = v_consent_id,
         state = 'completed',
         completed_at = v_now,
         updated_at = v_now
   where operations.id = v_operation.id;
  update public.health_dependent_consent_states as states
     set state = 'active',
         generation = v_next_generation,
         health_epoch = p_expected_epoch,
         current_receipt_id = v_consent_id,
         current_operation_id = null,
         base_withdrawal_operation_id = null,
         parent_withdrawal_operation_id = null,
         version = p_version,
         consent_text_hash = p_consent_text_hash,
         withdrawal_requested_at = null,
         withdrawal_completed_at = null,
         updated_at = v_now
   where states.user_id = v_user_id
     and states.consent_type = p_consent_type
     and states.generation = p_expected_generation;
  if not found then
    raise exception 'HEALTH_DEPENDENT_CONSENT_GENERATION_STALE' using errcode = '55000';
  end if;

  return query
  select states.consent_type, states.state, states.generation,
         states.health_epoch, states.version, states.consent_text_hash
    from public.health_dependent_consent_states as states
   where states.user_id = v_user_id
     and states.consent_type = p_consent_type;
end;
$$;

revoke all on function public.record_health_dependent_consent(
  bigint, bigint, text, text, text, text
)
  from public, anon, service_role;
grant execute on function public.record_health_dependent_consent(
  bigint, bigint, text, text, text, text
)
  to authenticated;

create or replace function public._health_dependent_residual_exists(
  p_user_id uuid,
  p_consent_type text
)
returns boolean
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  if p_user_id is null or not public._health_consent_type_protected(p_consent_type) then
    raise exception 'HEALTH_DEPENDENT_CONSENT_INPUT_INVALID' using errcode = '22023';
  end if;
  case p_consent_type
    when 'photo_capture' then
      return exists (
        select 1 from public.photos as photos where photos.user_id = p_user_id
      ) or exists (
        select 1 from public.photo_trend as trends where trends.user_id = p_user_id
      ) or exists (
        select 1
          from storage.objects as objects
         where objects.bucket_id = 'photos'
           and (
             pg_catalog.split_part(objects.name, '/', 1) = p_user_id::text
             or pg_catalog.to_jsonb(objects) ->> 'owner' = p_user_id::text
             or pg_catalog.to_jsonb(objects) ->> 'owner_id' = p_user_id::text
           )
      );
    when 'photo_cloud_backup' then
      return exists (
        select 1
          from public.photos as photos
         where photos.user_id = p_user_id
           and (not photos.local_only or photos.storage_path is not null)
      ) or exists (
        select 1
          from storage.objects as objects
         where objects.bucket_id = 'photos'
           and (
             pg_catalog.split_part(objects.name, '/', 1) = p_user_id::text
             or pg_catalog.to_jsonb(objects) ->> 'owner' = p_user_id::text
             or pg_catalog.to_jsonb(objects) ->> 'owner_id' = p_user_id::text
           )
      );
    when 'photo_trend_insights' then
      return exists (
        select 1 from public.photo_trend as trends where trends.user_id = p_user_id
      );
    when 'ask_onskin' then
      return exists (
        select 1 from public.ask_sessions as sessions where sessions.user_id = p_user_id
      ) or exists (
        select 1 from public.ask_safety_audit as audits where audits.user_id = p_user_id
      ) or exists (
        select 1
          from public.ask_turn_audit as turns
          join public.ask_sessions as sessions on sessions.id = turns.session_id
         where sessions.user_id = p_user_id
      );
    when 'community_participation' then
      return exists (
        select 1 from public.community_blocks as blocks where blocks.user_id = p_user_id
      ) or exists (
        select 1 from public.community_questions as questions where questions.user_id = p_user_id
      ) or exists (
        select 1 from public.community_reactions as reactions where reactions.user_id = p_user_id
      ) or exists (
        select 1 from public.community_reports as reports where reports.reporter_id = p_user_id
      );
    when 'data_sharing' then
      return exists (
        select 1
          from public.commerce_click_events as clicks
         where clicks.user_id = p_user_id
      ) or exists (
        select 1
          from public.order_attributions as attributions
          join public.commerce_click_events as clicks
            on clicks.click_token = attributions.click_token
         where clicks.user_id = p_user_id
      );
    else
      raise exception 'HEALTH_DEPENDENT_CONSENT_TYPE_INVALID' using errcode = '22023';
  end case;
end;
$$;

revoke all on function public._health_dependent_residual_exists(uuid, text)
  from public, anon, authenticated, service_role;

create or replace function public.begin_health_dependent_consent_withdrawal(
  p_expected_epoch bigint,
  p_expected_generation bigint,
  p_consent_type text,
  p_idempotency_key text,
  p_version text,
  p_consent_text_hash text
)
returns table (
  operation_id uuid,
  user_id uuid,
  consent_type text,
  state text,
  processing_epoch bigint,
  consent_generation bigint
)
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user_id uuid := (select auth.uid());
  v_digest text;
  v_now timestamptz;
  v_base_state text;
  v_base_epoch bigint;
  v_base_version text;
  v_base_hash text;
  v_state public.health_dependent_consent_states%rowtype;
  v_operation public.health_dependent_consent_operations%rowtype;
  v_next_generation bigint;
  v_consent_id uuid;
  v_child record;
  v_child_consent_id uuid;
begin
  if v_user_id is null then
    raise exception 'HEALTH_DEPENDENT_CONSENT_AUTH_REQUIRED' using errcode = '42501';
  end if;
  perform public._assert_current_health_session(v_user_id);
  if p_expected_epoch is null or p_expected_epoch < 1
     or p_expected_generation is null or p_expected_generation < 0
     or not public._health_consent_type_protected(p_consent_type)
     or p_idempotency_key is null or p_idempotency_key !~ '^[a-f0-9]{64}$'
     or p_version is null or p_version <> pg_catalog.btrim(p_version)
     or pg_catalog.length(p_version) not between 1 and 120
     or p_consent_text_hash is null
     or p_consent_text_hash !~ '^[a-f0-9]{64}$' then
    raise exception 'HEALTH_DEPENDENT_WITHDRAWAL_INPUT_INVALID' using errcode = '22023';
  end if;
  perform public._assert_health_consent_copy_for_type(
    p_consent_type, 'withdraw', p_version, p_consent_text_hash
  );
  v_digest := public._health_consent_token_digest(p_idempotency_key);

  perform pg_catalog.pg_advisory_xact_lock(
    public._account_deletion_advisory_key(v_user_id)
  );
  v_now := pg_catalog.clock_timestamp();
  if exists (
    select 1 from public.account_deletion_barriers as barriers
     where barriers.user_id = v_user_id
  ) then
    raise exception 'ACCOUNT_DELETION_IN_PROGRESS' using errcode = '55000';
  end if;
  select states.state, states.epoch, states.consent_version, states.consent_text_hash
    into v_base_state, v_base_epoch, v_base_version, v_base_hash
    from public.health_processing_states as states
   where states.user_id = v_user_id
   for update;
  if v_base_epoch is distinct from p_expected_epoch then
    raise exception 'HEALTH_PROCESSING_EPOCH_STALE' using errcode = '55000';
  end if;
  perform public._ensure_health_dependent_consent_states(v_user_id);
  select states.* into v_state
    from public.health_dependent_consent_states as states
   where states.user_id = v_user_id
     and states.consent_type = p_consent_type
   for update;

  select operations.* into v_operation
    from public.health_dependent_consent_operations as operations
   where operations.user_id = v_user_id
     and operations.idempotency_digest = v_digest;
  if v_operation.id is not null then
    if v_operation.action <> 'withdraw'
       or v_operation.consent_type <> p_consent_type
       or v_operation.expected_processing_epoch <> p_expected_epoch
       or v_operation.expected_generation <> p_expected_generation
       or v_operation.version <> p_version
       or v_operation.consent_text_hash <> p_consent_text_hash then
      raise exception 'HEALTH_DEPENDENT_IDEMPOTENCY_KEY_REUSED' using errcode = '55000';
    end if;
    if v_state.generation <> v_operation.consent_generation
       or v_state.health_epoch <> v_operation.expected_processing_epoch
       or v_state.current_operation_id is distinct from v_operation.id
       or v_state.state not in ('withdrawing', 'withdrawn') then
      raise exception 'HEALTH_DEPENDENT_IDEMPOTENT_REPLAY_STALE' using errcode = '55000';
    end if;
    return query
    select v_operation.id, v_user_id, v_operation.consent_type,
           v_state.state, v_operation.expected_processing_epoch,
           v_operation.consent_generation;
    return;
  end if;

  if v_base_state = 'active' then
    if not exists (
      select 1
        from public.health_consent_copy_registry as registry
       where registry.consent_type = 'health_data_collection'
         and registry.action = 'grant'
         and registry.version = v_base_version
         and registry.consent_text_hash = v_base_hash
         and registry.review_status = 'approved'
         and registry.is_current
    ) then
      raise exception 'HEALTH_PROCESSING_CONSENT_STALE' using errcode = '55000';
    end if;
  elsif v_base_state in ('withdrawing', 'withdrawn') then
    raise exception 'HEALTH_DEPENDENT_SUBSUMED_BY_BASE_WITHDRAWAL'
      using errcode = '55000';
  else
    raise exception 'HEALTH_PROCESSING_NOT_ACTIVE' using errcode = '55000';
  end if;

  if v_state.generation <> p_expected_generation then
    raise exception 'HEALTH_DEPENDENT_CONSENT_GENERATION_STALE' using errcode = '55000';
  end if;
  if v_state.state = 'withdrawing' then
    raise exception 'HEALTH_DEPENDENT_WITHDRAWAL_ALREADY_EXISTS' using errcode = '55000';
  end if;
  if v_state.state = 'withdrawn' then
    raise exception 'HEALTH_DEPENDENT_CONSENT_ALREADY_WITHDRAWN' using errcode = '55000';
  end if;
  if v_state.state = 'unconsented' then
    raise exception 'HEALTH_DEPENDENT_CONSENT_NOT_ACTIVE' using errcode = '55000';
  end if;
  if v_state.generation = 9223372036854775807 then
    raise exception 'HEALTH_DEPENDENT_GENERATION_EXHAUSTED' using errcode = '22003';
  end if;
  v_next_generation := v_state.generation + 1;

  insert into public.health_dependent_consent_operations (
    user_id, consent_type, action, idempotency_digest,
    expected_processing_epoch, expected_generation, consent_generation,
    version, consent_text_hash, state, requested_at, updated_at
  ) values (
    v_user_id, p_consent_type, 'withdraw', v_digest,
    p_expected_epoch, p_expected_generation, v_next_generation,
    p_version, p_consent_text_hash, 'pending', v_now, v_now
  ) returning * into v_operation;

  perform public._issue_health_consent_receipt_capability(
    v_user_id,
    p_consent_type,
    false,
    p_version,
    p_consent_text_hash,
    'dependent_withdrawal',
    'dependent:withdraw:' || p_consent_type || ':e' || p_expected_epoch::text
      || ':g' || v_next_generation::text || ':' || v_digest
  );
  insert into public.consents (
    user_id, consent_type, granted, version, consent_text_hash,
    granted_at, revoked_at
  ) values (
    v_user_id, p_consent_type, false, p_version, p_consent_text_hash,
    v_now, v_now
  ) returning id into v_consent_id;
  perform public._assert_health_consent_capability_cleared(v_user_id);

  update public.health_dependent_consent_operations as operations
     set receipt_id = v_consent_id,
         updated_at = v_now
   where operations.id = v_operation.id;
  update public.health_dependent_consent_states as states
     set state = 'withdrawing',
         generation = v_next_generation,
         health_epoch = p_expected_epoch,
         current_receipt_id = v_consent_id,
         current_operation_id = v_operation.id,
         base_withdrawal_operation_id = null,
         parent_withdrawal_operation_id = null,
         version = p_version,
         consent_text_hash = p_consent_text_hash,
         withdrawal_requested_at = v_now,
         withdrawal_completed_at = null,
         updated_at = v_now
   where states.user_id = v_user_id
     and states.consent_type = p_consent_type
     and states.generation = p_expected_generation;
  if not found then
    raise exception 'HEALTH_DEPENDENT_CONSENT_GENERATION_STALE' using errcode = '55000';
  end if;

  if p_consent_type = 'photo_capture' then
    for v_child in
      select child.consent_type,
             child.generation,
             registry.version,
             registry.consent_text_hash
        from public.health_dependent_consent_states as child
        join public.health_consent_copy_registry as registry
          on registry.consent_type = child.consent_type
         and registry.action = 'withdraw'
         and registry.is_current
       where child.user_id = v_user_id
         and child.consent_type in ('photo_cloud_backup', 'photo_trend_insights')
         and child.state = 'active'
       order by child.consent_type
       for update of child
    loop
      if v_child.generation = 9223372036854775807 then
        raise exception 'HEALTH_DEPENDENT_GENERATION_EXHAUSTED' using errcode = '22003';
      end if;
      perform public._issue_health_consent_receipt_capability(
        v_user_id,
        v_child.consent_type,
        false,
        v_child.version,
        v_child.consent_text_hash,
        'dependent_withdrawal',
        'dependent:withdraw:' || v_child.consent_type
          || ':e' || p_expected_epoch::text
          || ':g' || (v_child.generation + 1)::text || ':' || v_digest
      );
      insert into public.consents (
        user_id, consent_type, granted, version, consent_text_hash,
        granted_at, revoked_at
      ) values (
        v_user_id, v_child.consent_type, false,
        v_child.version, v_child.consent_text_hash, v_now, v_now
      ) returning id into v_child_consent_id;
      perform public._assert_health_consent_capability_cleared(v_user_id);
      update public.health_dependent_consent_states as child
         set state = 'withdrawing',
             generation = v_child.generation + 1,
             health_epoch = p_expected_epoch,
             current_receipt_id = v_child_consent_id,
             current_operation_id = null,
             base_withdrawal_operation_id = null,
             parent_withdrawal_operation_id = v_operation.id,
             version = v_child.version,
             consent_text_hash = v_child.consent_text_hash,
             withdrawal_requested_at = v_now,
             withdrawal_completed_at = null,
             updated_at = v_now
       where child.user_id = v_user_id
         and child.consent_type = v_child.consent_type
         and child.generation = v_child.generation;
      if not found then
        raise exception 'HEALTH_DEPENDENT_CONSENT_GENERATION_STALE' using errcode = '55000';
      end if;
    end loop;
  end if;

  return query
  select v_operation.id, v_user_id, p_consent_type, 'withdrawing'::text,
         p_expected_epoch, v_next_generation;
end;
$$;

revoke all on function public.begin_health_dependent_consent_withdrawal(
  bigint, bigint, text, text, text, text
) from public, anon, service_role;
grant execute on function public.begin_health_dependent_consent_withdrawal(
  bigint, bigint, text, text, text, text
) to authenticated;

create or replace function public.complete_health_dependent_consent_withdrawal(
  p_operation_id uuid
)
returns table (
  operation_id uuid,
  user_id uuid,
  consent_type text,
  state text,
  processing_epoch bigint,
  consent_generation bigint
)
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_operation public.health_dependent_consent_operations%rowtype;
  v_state public.health_dependent_consent_states%rowtype;
  v_now timestamptz;
begin
  if p_operation_id is null then
    raise exception 'HEALTH_DEPENDENT_OPERATION_REQUIRED' using errcode = '22023';
  end if;
  select operations.* into v_operation
    from public.health_dependent_consent_operations as operations
   where operations.id = p_operation_id;
  if v_operation.id is null or v_operation.action <> 'withdraw' then
    raise exception 'HEALTH_DEPENDENT_OPERATION_NOT_FOUND' using errcode = 'P0002';
  end if;

  perform pg_catalog.pg_advisory_xact_lock(
    public._account_deletion_advisory_key(v_operation.user_id)
  );
  v_now := pg_catalog.clock_timestamp();
  select operations.* into v_operation
    from public.health_dependent_consent_operations as operations
   where operations.id = p_operation_id
   for update;
  select states.* into v_state
    from public.health_dependent_consent_states as states
   where states.user_id = v_operation.user_id
     and states.consent_type = v_operation.consent_type
   for update;

  if v_operation.state = 'completed' then
    if v_state.state <> 'withdrawn'
       or v_state.generation <> v_operation.consent_generation
       or v_state.current_operation_id is distinct from v_operation.id then
      raise exception 'HEALTH_DEPENDENT_WITHDRAWAL_STATE_CONFLICT' using errcode = '55000';
    end if;
    return query
    select v_operation.id, v_operation.user_id, v_operation.consent_type,
           v_state.state, v_operation.expected_processing_epoch,
           v_operation.consent_generation;
    return;
  end if;

  if v_state.state <> 'withdrawing'
     or v_state.generation <> v_operation.consent_generation
     or v_state.health_epoch <> v_operation.expected_processing_epoch
     or v_state.current_operation_id is distinct from v_operation.id then
    raise exception 'HEALTH_DEPENDENT_WITHDRAWAL_STATE_CONFLICT' using errcode = '55000';
  end if;
  if public._health_dependent_residual_exists(
    v_operation.user_id, v_operation.consent_type
  ) then
    raise exception 'HEALTH_DEPENDENT_WITHDRAWAL_RESIDUAL' using errcode = '55000';
  end if;

  update public.health_dependent_consent_operations as operations
     set state = 'completed',
         last_result_code = 'DEPENDENT_WITHDRAWAL_COMPLETED',
         next_attempt_at = v_now,
         worker_claim_digest = null,
         worker_lease_expires_at = null,
         completed_at = v_now,
         updated_at = v_now
   where operations.id = v_operation.id;
  update public.health_dependent_consent_states as states
     set state = 'withdrawn',
         withdrawal_completed_at = v_now,
         updated_at = v_now
   where states.user_id = v_operation.user_id
     and states.consent_type = v_operation.consent_type
     and states.current_operation_id = v_operation.id
     and states.state = 'withdrawing';
  if not found then
    raise exception 'HEALTH_DEPENDENT_WITHDRAWAL_STATE_CONFLICT' using errcode = '55000';
  end if;
  if v_operation.consent_type = 'photo_capture' then
    update public.health_dependent_consent_states as child
       set state = 'withdrawn',
           withdrawal_completed_at = v_now,
           updated_at = v_now
     where child.user_id = v_operation.user_id
       and child.parent_withdrawal_operation_id = v_operation.id
       and child.consent_type in ('photo_cloud_backup', 'photo_trend_insights')
       and child.state = 'withdrawing';

    -- A child may already have begun its own withdrawal before capture closes.
    -- Preserve that original operation/idempotency binding during begin, then
    -- satisfy it from the stronger aggregate zero-attestation here.
    update public.health_dependent_consent_operations as child_operations
       set state = 'completed',
           last_result_code = 'PARENT_CAPTURE_WITHDRAWAL_COMPLETED',
           next_attempt_at = v_now,
           worker_claim_digest = null,
           worker_lease_expires_at = null,
           completed_at = v_now,
           updated_at = v_now
      from public.health_dependent_consent_states as child
     where child.user_id = v_operation.user_id
       and child.consent_type in ('photo_cloud_backup', 'photo_trend_insights')
       and child.state = 'withdrawing'
       and child.current_operation_id = child_operations.id
       and child_operations.action = 'withdraw'
       and child_operations.state <> 'completed';
    update public.health_dependent_consent_states as child
       set state = 'withdrawn',
           withdrawal_completed_at = v_now,
           updated_at = v_now
     where child.user_id = v_operation.user_id
       and child.consent_type in ('photo_cloud_backup', 'photo_trend_insights')
       and child.state = 'withdrawing'
       and child.current_operation_id is not null
       and exists (
         select 1
           from public.health_dependent_consent_operations as child_operations
          where child_operations.id = child.current_operation_id
            and child_operations.state = 'completed'
       );
  end if;

  return query
  select v_operation.id, v_operation.user_id, v_operation.consent_type,
         'withdrawn'::text, v_operation.expected_processing_epoch,
         v_operation.consent_generation;
end;
$$;

revoke all on function public.complete_health_dependent_consent_withdrawal(uuid)
  from public, anon, authenticated;
grant execute on function public.complete_health_dependent_consent_withdrawal(uuid)
  to service_role;

create or replace function public.claim_due_health_dependent_consent_withdrawals(
  p_claim_token text,
  p_limit integer default 10
)
returns table (
  operation_id uuid,
  user_id uuid,
  consent_type text,
  processing_epoch bigint,
  consent_generation bigint
)
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_digest text;
  v_now timestamptz := pg_catalog.clock_timestamp();
begin
  if p_claim_token is null or p_claim_token !~ '^[a-f0-9]{64}$'
     or p_limit is null or p_limit not between 1 and 100 then
    raise exception 'HEALTH_DEPENDENT_WORKER_INPUT_INVALID' using errcode = '22023';
  end if;
  v_digest := public._health_consent_token_digest(p_claim_token);

  -- A worker can disappear after committing the 1,000th lease but before it
  -- can defer that operation. Once that final lease expires, close the work
  -- durably instead of allowing an unbounded sequence of claims whose capped
  -- attempt counter can no longer advance.
  update public.health_dependent_consent_operations as operations
     set state = 'action_required',
         last_result_code = 'WORKER_RETRY_EXHAUSTED',
         next_attempt_at = v_now,
         worker_claim_digest = null,
         worker_lease_expires_at = null,
         updated_at = v_now
   where operations.action = 'withdraw'
     and operations.state = 'pending'
     and operations.attempt_count >= 1000
     and operations.next_attempt_at <= v_now
     and (
       operations.worker_claim_digest is null
       or operations.worker_lease_expires_at <= v_now
     )
     and exists (
       select 1
         from public.health_dependent_consent_states as states
        where states.user_id = operations.user_id
          and states.consent_type = operations.consent_type
          and states.current_operation_id = operations.id
          and states.state = 'withdrawing'
          and states.health_epoch = operations.expected_processing_epoch
          and states.generation = operations.consent_generation
     )
     and not exists (
       select 1
         from public.account_deletion_barriers as barriers
        where barriers.user_id = operations.user_id
     );

  return query
  with candidates as (
    select operations.id
      from public.health_dependent_consent_operations as operations
      join public.health_dependent_consent_states as states
        on states.user_id = operations.user_id
       and states.consent_type = operations.consent_type
       and states.current_operation_id = operations.id
       and states.state = 'withdrawing'
       and states.health_epoch = operations.expected_processing_epoch
       and states.generation = operations.consent_generation
     where operations.action = 'withdraw'
       and operations.state = 'pending'
       and operations.attempt_count < 1000
       and operations.next_attempt_at <= v_now
       and (
         operations.worker_claim_digest is null
         or operations.worker_lease_expires_at <= v_now
       )
       and not exists (
         select 1
           from public.account_deletion_barriers as barriers
          where barriers.user_id = operations.user_id
       )
     order by operations.next_attempt_at, operations.requested_at, operations.id
     limit p_limit
     for update of operations skip locked
  ), claimed as (
    update public.health_dependent_consent_operations as operations
       set worker_claim_digest = v_digest,
           worker_lease_expires_at = v_now + interval '5 minutes',
           attempt_count = least(operations.attempt_count + 1, 1000),
           last_result_code = null,
           updated_at = v_now
      from candidates
     where operations.id = candidates.id
    returning operations.id,
              operations.user_id,
              operations.consent_type,
              operations.expected_processing_epoch,
              operations.consent_generation
  )
  select claimed.id,
         claimed.user_id,
         claimed.consent_type,
         claimed.expected_processing_epoch,
         claimed.consent_generation
    from claimed
   order by claimed.id;
end;
$$;

revoke all on function public.claim_due_health_dependent_consent_withdrawals(text, integer)
  from public, anon, authenticated;
grant execute on function public.claim_due_health_dependent_consent_withdrawals(text, integer)
  to service_role;

-- Storage enumeration is owner-derived in the database so legacy rows whose
-- explicit owner metadata is authoritative are not silently missed by a
-- prefix-only client listing. As in the aggregate lane, only canonical current
-- epoch or canonical pre-epoch paths are released for automatic deletion;
-- conflicting/noncanonical evidence is an operator lane, never a cross-owner
-- delete guess.
create or replace function public.list_health_dependent_consent_storage_work(
  p_operation_id uuid,
  p_limit integer,
  p_claim_token text
)
returns table (storage_path text)
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_operation public.health_dependent_consent_operations%rowtype;
  v_digest text;
  v_now timestamptz;
  v_safe_owned_count bigint;
begin
  if p_operation_id is null
     or p_limit is null or p_limit not between 1 and 100
     or p_claim_token is null or p_claim_token !~ '^[a-f0-9]{64}$' then
    raise exception 'HEALTH_DEPENDENT_STORAGE_WORK_INPUT_INVALID'
      using errcode = '22023';
  end if;
  select operations.* into v_operation
    from public.health_dependent_consent_operations as operations
   where operations.id = p_operation_id;
  if v_operation.id is null then
    raise exception 'HEALTH_DEPENDENT_OPERATION_NOT_FOUND' using errcode = 'P0002';
  end if;
  perform pg_catalog.pg_advisory_xact_lock(
    public._account_deletion_advisory_key(v_operation.user_id)
  );
  v_now := pg_catalog.clock_timestamp();
  v_digest := public._health_consent_token_digest(p_claim_token);
  select operations.* into v_operation
    from public.health_dependent_consent_operations as operations
   where operations.id = p_operation_id
   for update;

  if v_operation.action <> 'withdraw'
     or v_operation.state <> 'pending'
     or v_operation.consent_type not in ('photo_capture', 'photo_cloud_backup')
     or v_operation.worker_claim_digest is distinct from v_digest
     or v_operation.worker_lease_expires_at is null
     or v_operation.worker_lease_expires_at <= v_now
     or not exists (
       select 1
         from public.health_dependent_consent_states as states
        where states.user_id = v_operation.user_id
          and states.consent_type = v_operation.consent_type
          and states.current_operation_id = v_operation.id
          and states.state = 'withdrawing'
          and states.health_epoch = v_operation.expected_processing_epoch
          and states.generation = v_operation.consent_generation
     ) then
    raise exception 'HEALTH_DEPENDENT_STORAGE_WORK_NOT_AVAILABLE'
      using errcode = '55000';
  end if;
  if exists (
    select 1 from public.account_deletion_barriers as barriers
     where barriers.user_id = v_operation.user_id
  ) then
    raise exception 'ACCOUNT_DELETION_IN_PROGRESS' using errcode = '55000';
  end if;

  if exists (
    select 1
      from storage.objects as objects
     where objects.bucket_id = 'photos'
       and (
         (
           public._account_photo_storage_object_owned(
             v_operation.user_id,
             objects.name,
             pg_catalog.to_jsonb(objects) ->> 'owner',
             pg_catalog.to_jsonb(objects) ->> 'owner_id'
           )
           and not public._health_photo_path_safe_for_withdrawal(
             v_operation.user_id,
             objects.name,
             v_operation.expected_processing_epoch
           )
         )
         or (
           (
             pg_catalog.split_part(objects.name, '/', 1) = v_operation.user_id::text
             or pg_catalog.to_jsonb(objects) ->> 'owner' = v_operation.user_id::text
             or pg_catalog.to_jsonb(objects) ->> 'owner_id' = v_operation.user_id::text
           )
           and not public._account_photo_storage_object_owned(
             v_operation.user_id,
             objects.name,
             pg_catalog.to_jsonb(objects) ->> 'owner',
             pg_catalog.to_jsonb(objects) ->> 'owner_id'
           )
         )
       )
  ) then
    raise exception 'HEALTH_DEPENDENT_STORAGE_WORK_PATH_INVALID'
      using errcode = '55000';
  end if;

  select count(*) into v_safe_owned_count
    from storage.objects as objects
   where objects.bucket_id = 'photos'
     and public._account_photo_storage_object_owned(
       v_operation.user_id,
       objects.name,
       pg_catalog.to_jsonb(objects) ->> 'owner',
       pg_catalog.to_jsonb(objects) ->> 'owner_id'
     )
     and public._health_photo_path_safe_for_withdrawal(
       v_operation.user_id,
       objects.name,
       v_operation.expected_processing_epoch
     );
  if v_safe_owned_count > 1000 then
    raise exception 'HEALTH_DEPENDENT_STORAGE_WORK_BOUND_EXCEEDED'
      using errcode = '55000';
  end if;

  return query
  select objects.name
    from storage.objects as objects
   where objects.bucket_id = 'photos'
     and public._account_photo_storage_object_owned(
       v_operation.user_id,
       objects.name,
       pg_catalog.to_jsonb(objects) ->> 'owner',
       pg_catalog.to_jsonb(objects) ->> 'owner_id'
     )
     and public._health_photo_path_safe_for_withdrawal(
       v_operation.user_id,
       objects.name,
       v_operation.expected_processing_epoch
     )
   order by objects.name
   limit p_limit;
end;
$$;

revoke all on function public.list_health_dependent_consent_storage_work(
  uuid, integer, text
) from public, anon, authenticated;
grant execute on function public.list_health_dependent_consent_storage_work(
  uuid, integer, text
) to service_role;

create or replace function public.defer_health_dependent_consent_withdrawal(
  p_operation_id uuid,
  p_claim_token text,
  p_result_code text,
  p_retry_after_seconds integer default 60
)
returns table (
  operation_id uuid,
  state text,
  result_code text,
  next_attempt_at timestamptz
)
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_operation public.health_dependent_consent_operations%rowtype;
  v_digest text;
  v_now timestamptz;
begin
  if p_operation_id is null
     or p_claim_token is null or p_claim_token !~ '^[a-f0-9]{64}$'
     or p_result_code is null or p_result_code !~ '^[A-Z0-9_]{1,64}$'
     or p_retry_after_seconds is null
     or p_retry_after_seconds not between 1 and 86400 then
    raise exception 'HEALTH_DEPENDENT_WORKER_INPUT_INVALID' using errcode = '22023';
  end if;
  select operations.* into v_operation
    from public.health_dependent_consent_operations as operations
   where operations.id = p_operation_id;
  if v_operation.id is null then
    raise exception 'HEALTH_DEPENDENT_OPERATION_NOT_FOUND' using errcode = 'P0002';
  end if;
  perform pg_catalog.pg_advisory_xact_lock(
    public._account_deletion_advisory_key(v_operation.user_id)
  );
  v_now := pg_catalog.clock_timestamp();
  v_digest := public._health_consent_token_digest(p_claim_token);
  select operations.* into v_operation
    from public.health_dependent_consent_operations as operations
   where operations.id = p_operation_id
   for update;

  -- A threshold transition may have committed while its HTTP response was
  -- lost. Return that exact durable truth instead of pretending it was a
  -- retryable deferral or requiring an impossible second live lease.
  if v_operation.action = 'withdraw'
     and v_operation.state = 'action_required'
     and v_operation.last_result_code = 'WORKER_RETRY_EXHAUSTED'
     and v_operation.attempt_count >= 1000
     and v_operation.worker_claim_digest is null
     and v_operation.worker_lease_expires_at is null
     and exists (
       select 1
         from public.health_dependent_consent_states as states
        where states.user_id = v_operation.user_id
          and states.consent_type = v_operation.consent_type
          and states.current_operation_id = v_operation.id
          and states.state = 'withdrawing'
          and states.health_epoch = v_operation.expected_processing_epoch
          and states.generation = v_operation.consent_generation
     ) then
    return query
    select v_operation.id, v_operation.state, v_operation.last_result_code,
           v_operation.next_attempt_at;
    return;
  end if;
  if v_operation.action <> 'withdraw'
     or v_operation.state <> 'pending'
     or v_operation.worker_claim_digest is distinct from v_digest
     or v_operation.worker_lease_expires_at is null
     or v_operation.worker_lease_expires_at <= v_now
     or not exists (
       select 1
         from public.health_dependent_consent_states as states
        where states.user_id = v_operation.user_id
          and states.consent_type = v_operation.consent_type
          and states.current_operation_id = v_operation.id
          and states.state = 'withdrawing'
          and states.health_epoch = v_operation.expected_processing_epoch
          and states.generation = v_operation.consent_generation
     ) then
    raise exception 'HEALTH_DEPENDENT_WORKER_CLAIM_REJECTED' using errcode = '55000';
  end if;
  update public.health_dependent_consent_operations as operations
     set state = case
           when operations.attempt_count >= 1000 then 'action_required'
           else operations.state
         end,
         last_result_code = case
           when operations.attempt_count >= 1000 then 'WORKER_RETRY_EXHAUSTED'
           else p_result_code
         end,
         next_attempt_at = v_now
           + pg_catalog.make_interval(secs => p_retry_after_seconds),
         worker_claim_digest = null,
         worker_lease_expires_at = null,
         updated_at = v_now
   where operations.id = p_operation_id
   returning operations.* into v_operation;

  return query
  select v_operation.id, v_operation.state, v_operation.last_result_code,
         v_operation.next_attempt_at;
end;
$$;

revoke all on function public.defer_health_dependent_consent_withdrawal(
  uuid, text, text, integer
) from public, anon, authenticated;
grant execute on function public.defer_health_dependent_consent_withdrawal(
  uuid, text, text, integer
) to service_role;

-- A bounded, explicitly allowlisted operator lane. Provider-bound rows that
-- exceed the automatic erasure contract must leave the due queue immediately;
-- treating them as a long retry would make the worker report and durable truth
-- disagree. Exact replay is accepted after response loss, but no other result
-- code can manufacture terminal operator state.
create or replace function public.mark_health_dependent_consent_withdrawal_action_required(
  p_operation_id uuid,
  p_claim_token text,
  p_result_code text
)
returns table (
  operation_id uuid,
  state text,
  result_code text
)
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_operation public.health_dependent_consent_operations%rowtype;
  v_digest text;
  v_now timestamptz;
begin
  if p_operation_id is null
     or p_claim_token is null or p_claim_token !~ '^[a-f0-9]{64}$'
     or p_result_code is null
     or p_result_code <> all(array[
       'DEPENDENT_PROVIDER_BOUND_EXCEEDED',
       'DEPENDENT_STORAGE_OWNERSHIP_INVALID',
       'DEPENDENT_STORAGE_BOUND_EXCEEDED'
     ]::text[]) then
    raise exception 'HEALTH_DEPENDENT_ACTION_REQUIRED_INPUT_INVALID'
      using errcode = '22023';
  end if;
  select operations.* into v_operation
    from public.health_dependent_consent_operations as operations
   where operations.id = p_operation_id;
  if v_operation.id is null then
    raise exception 'HEALTH_DEPENDENT_OPERATION_NOT_FOUND' using errcode = 'P0002';
  end if;
  perform pg_catalog.pg_advisory_xact_lock(
    public._account_deletion_advisory_key(v_operation.user_id)
  );
  v_now := pg_catalog.clock_timestamp();
  v_digest := public._health_consent_token_digest(p_claim_token);
  select operations.* into v_operation
    from public.health_dependent_consent_operations as operations
   where operations.id = p_operation_id
   for update;

  -- Truthful idempotent retry after the database committed but the response
  -- was lost. The original result remains terminal and non-reclaimable.
  if v_operation.action = 'withdraw'
     and v_operation.state = 'action_required'
     and v_operation.last_result_code = p_result_code
     and v_operation.worker_claim_digest is null
     and v_operation.worker_lease_expires_at is null
     and exists (
       select 1
         from public.health_dependent_consent_states as states
        where states.user_id = v_operation.user_id
          and states.consent_type = v_operation.consent_type
          and states.current_operation_id = v_operation.id
          and states.state = 'withdrawing'
          and states.health_epoch = v_operation.expected_processing_epoch
          and states.generation = v_operation.consent_generation
     ) then
    return query
    select v_operation.id, v_operation.state, v_operation.last_result_code;
    return;
  end if;

  if v_operation.action <> 'withdraw'
     or v_operation.state <> 'pending'
     or v_operation.worker_claim_digest is distinct from v_digest
     or v_operation.worker_lease_expires_at is null
     or v_operation.worker_lease_expires_at <= v_now
     or not exists (
       select 1
         from public.health_dependent_consent_states as states
        where states.user_id = v_operation.user_id
          and states.consent_type = v_operation.consent_type
          and states.current_operation_id = v_operation.id
          and states.state = 'withdrawing'
          and states.health_epoch = v_operation.expected_processing_epoch
          and states.generation = v_operation.consent_generation
     ) then
    raise exception 'HEALTH_DEPENDENT_WORKER_CLAIM_REJECTED' using errcode = '55000';
  end if;

  update public.health_dependent_consent_operations as operations
     set state = 'action_required',
         last_result_code = p_result_code,
         next_attempt_at = v_now,
         worker_claim_digest = null,
         worker_lease_expires_at = null,
         updated_at = v_now
   where operations.id = p_operation_id
   returning operations.* into v_operation;

  return query
  select v_operation.id, v_operation.state, v_operation.last_result_code;
end;
$$;

revoke all on function public.mark_health_dependent_consent_withdrawal_action_required(
  uuid, text, text
) from public, anon, authenticated;
grant execute on function public.mark_health_dependent_consent_withdrawal_action_required(
  uuid, text, text
) to service_role;

-- -----------------------------------------------------------------------------
-- Caller RPCs: status, grant/reconsent, and begin/retry
-- -----------------------------------------------------------------------------

create or replace function public.get_health_data_consent_status()
returns table (
  user_id uuid,
  state text,
  epoch bigint,
  operation_id uuid,
  operation_state text,
  result_code text,
  server_verified_at timestamptz,
  consent_version text,
  consent_text_hash text
)
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user_id uuid := (select auth.uid());
  v_now timestamptz := pg_catalog.clock_timestamp();
begin
  if v_user_id is null then
    raise exception 'HEALTH_CONSENT_AUTH_REQUIRED' using errcode = '42501';
  end if;
  perform public._assert_current_health_session(v_user_id);

  perform pg_catalog.pg_advisory_xact_lock(
    public._account_deletion_advisory_key(v_user_id)
  );
  if exists (
    select 1 from public.account_deletion_barriers as barriers
     where barriers.user_id = v_user_id
  ) then
    raise exception 'ACCOUNT_DELETION_IN_PROGRESS' using errcode = '55000';
  end if;

  insert into public.health_processing_states (user_id, state, epoch)
  values (v_user_id, 'unconsented', 0)
  on conflict on constraint health_processing_states_pkey do nothing;

  update public.health_processing_states as states
     set last_server_verified_at = v_now,
         updated_at = greatest(states.updated_at, v_now)
   where states.user_id = v_user_id;

  return query
  select states.user_id,
         states.state,
         states.epoch,
         states.current_operation_id,
         operations.state,
         operations.last_result_code,
         states.last_server_verified_at,
         case when states.state = 'active' then states.consent_version else null end,
         case when states.state = 'active' then states.consent_text_hash else null end
    from public.health_processing_states as states
    left join public.health_consent_withdrawal_operations as operations
      on operations.id = states.current_operation_id
   where states.user_id = v_user_id;
end;
$$;

revoke all on function public.get_health_data_consent_status()
  from public, anon, service_role;
grant execute on function public.get_health_data_consent_status()
  to authenticated;

create or replace function public.decline_initial_health_data_consent(
  p_expected_epoch bigint,
  p_version text,
  p_consent_text_hash text
)
returns table (
  user_id uuid,
  state text,
  epoch bigint,
  operation_id uuid,
  operation_state text,
  result_code text,
  server_verified_at timestamptz,
  consent_version text,
  consent_text_hash text
)
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user_id uuid := (select auth.uid());
  v_now timestamptz;
  v_state public.health_processing_states%rowtype;
  v_latest_granted boolean;
  v_latest_version text;
  v_latest_hash text;
begin
  if v_user_id is null then
    raise exception 'HEALTH_CONSENT_AUTH_REQUIRED' using errcode = '42501';
  end if;
  perform public._assert_current_health_session(v_user_id);
  if p_expected_epoch is null or p_expected_epoch <> 0
     or p_version is null
     or pg_catalog.length(pg_catalog.btrim(p_version)) not between 1 and 120
     or p_consent_text_hash is null
     or p_consent_text_hash !~ '^[a-f0-9]{64}$' then
    raise exception 'HEALTH_CONSENT_INPUT_INVALID' using errcode = '22023';
  end if;
  perform public._assert_health_consent_copy(
    'decline', p_version, p_consent_text_hash
  );

  perform pg_catalog.pg_advisory_xact_lock(
    public._account_deletion_advisory_key(v_user_id)
  );
  v_now := pg_catalog.clock_timestamp();
  if exists (
    select 1 from public.account_deletion_barriers as barriers
     where barriers.user_id = v_user_id
  ) then
    raise exception 'ACCOUNT_DELETION_IN_PROGRESS' using errcode = '55000';
  end if;

  insert into public.health_processing_states (user_id, state, epoch)
  values (v_user_id, 'unconsented', 0)
  on conflict on constraint health_processing_states_pkey do nothing;
  select states.* into v_state
    from public.health_processing_states as states
   where states.user_id = v_user_id
   for update;
  if v_state.epoch <> p_expected_epoch then
    raise exception 'HEALTH_PROCESSING_EPOCH_STALE' using errcode = '55000';
  end if;
  if v_state.state <> 'unconsented' then
    raise exception 'HEALTH_INITIAL_DECLINE_NOT_AVAILABLE' using errcode = '55000';
  end if;

  select consents.granted,
         pg_catalog.btrim(consents.version),
         consents.consent_text_hash
    into v_latest_granted, v_latest_version, v_latest_hash
    from public.consents as consents
   where consents.user_id = v_user_id
     and consents.consent_type = 'health_data_collection'
   order by consents.granted_at desc, consents.granted asc, consents.id desc
   limit 1;
  if v_latest_granted is distinct from false
     or v_latest_version is distinct from pg_catalog.btrim(p_version)
     or v_latest_hash is distinct from p_consent_text_hash then
    perform public._issue_health_consent_receipt_capability(
      v_user_id,
      'health_data_collection',
      false,
      pg_catalog.btrim(p_version),
      p_consent_text_hash,
      'base_decline',
      'base:decline:e0'
    );
    insert into public.consents (
      user_id, consent_type, granted, version, consent_text_hash, granted_at, revoked_at
    ) values (
      v_user_id,
      'health_data_collection',
      false,
      pg_catalog.btrim(p_version),
      p_consent_text_hash,
      v_now,
      v_now
    );
    perform public._assert_health_consent_capability_cleared(v_user_id);
  end if;

  update public.health_processing_states as states
     set last_server_verified_at = v_now,
         updated_at = v_now
   where states.user_id = v_user_id;
  return query
  select states.user_id,
         states.state,
         states.epoch,
         states.current_operation_id,
         null::text,
         'HEALTH_CONSENT_DECLINED'::text,
         states.last_server_verified_at,
         null::text,
         null::text
    from public.health_processing_states as states
   where states.user_id = v_user_id;
end;
$$;

revoke all on function public.decline_initial_health_data_consent(bigint, text, text)
  from public, anon, service_role;
grant execute on function public.decline_initial_health_data_consent(bigint, text, text)
  to authenticated;

create or replace function public.grant_health_data_consent(
  p_expected_epoch bigint,
  p_version text,
  p_consent_text_hash text
)
returns table (
  user_id uuid,
  state text,
  epoch bigint,
  operation_id uuid,
  operation_state text,
  result_code text,
  server_verified_at timestamptz,
  consent_version text,
  consent_text_hash text
)
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user_id uuid := (select auth.uid());
  v_now timestamptz;
  v_state public.health_processing_states%rowtype;
  v_operation_state text;
  v_next_epoch bigint;
begin
  if v_user_id is null then
    raise exception 'HEALTH_CONSENT_AUTH_REQUIRED' using errcode = '42501';
  end if;
  perform public._assert_current_health_session(v_user_id);
  if p_expected_epoch is null or p_expected_epoch < 0
     or p_version is null or pg_catalog.length(pg_catalog.btrim(p_version)) not between 1 and 120
     or p_consent_text_hash is null
     or p_consent_text_hash !~ '^[a-f0-9]{64}$' then
    raise exception 'HEALTH_CONSENT_INPUT_INVALID' using errcode = '22023';
  end if;
  perform pg_catalog.pg_advisory_xact_lock(
    public._account_deletion_advisory_key(v_user_id)
  );
  v_now := pg_catalog.clock_timestamp();

  if exists (
    select 1 from public.account_deletion_barriers as barriers
     where barriers.user_id = v_user_id
  ) then
    raise exception 'ACCOUNT_DELETION_IN_PROGRESS' using errcode = '55000';
  end if;

  insert into public.health_processing_states (user_id, state, epoch)
  values (v_user_id, 'unconsented', 0)
  on conflict on constraint health_processing_states_pkey do nothing;

  select states.* into v_state
    from public.health_processing_states as states
   where states.user_id = v_user_id
   for update;

  if v_state.state = 'active'
     and v_state.epoch > 0
     and v_state.epoch - 1 = p_expected_epoch
     and v_state.consent_version = pg_catalog.btrim(p_version)
     and v_state.consent_text_hash = p_consent_text_hash then
    update public.health_processing_states as states
       set last_server_verified_at = v_now,
           updated_at = v_now
     where states.user_id = v_user_id;
    return query
    select states.user_id,
           states.state,
           states.epoch,
           states.current_operation_id,
           null::text,
           null::text,
           states.last_server_verified_at,
           states.consent_version,
           states.consent_text_hash
      from public.health_processing_states as states
     where states.user_id = v_user_id;
    return;
  end if;

  -- A committed exact grant may be retried after response loss even if a
  -- future release migration has since closed/replaced that copy. Only a new
  -- epoch requires current release approval.
  perform public._assert_health_consent_copy(
    'grant', p_version, p_consent_text_hash
  );

  if v_state.epoch <> p_expected_epoch then
    raise exception 'HEALTH_PROCESSING_EPOCH_STALE' using errcode = '55000';
  end if;

  if v_state.state = 'withdrawing' then
    raise exception 'HEALTH_WITHDRAWAL_NOT_COMPLETE' using errcode = '55000';
  end if;
  if v_state.state = 'withdrawn' then
    select operations.state into v_operation_state
      from public.health_consent_withdrawal_operations as operations
     where operations.id = v_state.current_operation_id;
    if v_operation_state is distinct from 'completed' then
      raise exception 'HEALTH_WITHDRAWAL_NOT_COMPLETE' using errcode = '55000';
    end if;
  end if;

  if v_state.state = 'active' then
    if v_state.consent_version is distinct from pg_catalog.btrim(p_version)
       or v_state.consent_text_hash is distinct from p_consent_text_hash then
      -- Updating legal copy while data is live is a separate reviewed
      -- transition. It must never mint a new epoch over retained prior-epoch
      -- data through this initial/reconsent endpoint.
      raise exception 'HEALTH_CONSENT_ALREADY_ACTIVE' using errcode = '55000';
    end if;
    update public.health_processing_states as states
       set last_server_verified_at = v_now,
           updated_at = v_now
     where states.user_id = v_user_id;
  else
    if v_state.epoch = 9223372036854775807 then
      raise exception 'HEALTH_PROCESSING_EPOCH_EXHAUSTED' using errcode = '22003';
    end if;
    v_next_epoch := v_state.epoch + 1;
    perform public._issue_health_consent_receipt_capability(
      v_user_id,
      'health_data_collection',
      true,
      pg_catalog.btrim(p_version),
      p_consent_text_hash,
      'base_grant',
      'base:grant:e' || v_next_epoch::text
    );
    insert into public.consents (
      user_id, consent_type, granted, version, consent_text_hash, granted_at
    ) values (
      v_user_id,
      'health_data_collection',
      true,
      pg_catalog.btrim(p_version),
      p_consent_text_hash,
      v_now
    );
    perform public._assert_health_consent_capability_cleared(v_user_id);

    update public.health_processing_states as states
       set state = 'active',
           epoch = v_next_epoch,
           current_operation_id = null,
           consent_version = pg_catalog.btrim(p_version),
           consent_text_hash = p_consent_text_hash,
           withdrawal_requested_at = null,
           withdrawal_completed_at = null,
           last_server_verified_at = v_now,
           updated_at = v_now
     where states.user_id = v_user_id;
  end if;

  return query
  select states.user_id,
         states.state,
         states.epoch,
         states.current_operation_id,
         null::text,
         null::text,
         states.last_server_verified_at,
         states.consent_version,
         states.consent_text_hash
    from public.health_processing_states as states
   where states.user_id = v_user_id;
end;
$$;

revoke all on function public.grant_health_data_consent(bigint, text, text)
  from public, anon, service_role;
grant execute on function public.grant_health_data_consent(bigint, text, text)
  to authenticated;

create or replace function public.begin_health_data_consent_withdrawal(
  p_expected_epoch bigint,
  p_idempotency_key text,
  p_version text,
  p_consent_text_hash text
)
returns table (
  user_id uuid,
  state text,
  epoch bigint,
  operation_id uuid,
  operation_state text,
  result_code text,
  server_verified_at timestamptz,
  consent_version text,
  consent_text_hash text
)
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user_id uuid := (select auth.uid());
  v_digest text;
  v_now timestamptz;
  v_state public.health_processing_states%rowtype;
  v_operation public.health_consent_withdrawal_operations%rowtype;
  v_dependent record;
  v_dependent_consent_id uuid;
begin
  if v_user_id is null then
    raise exception 'HEALTH_CONSENT_AUTH_REQUIRED' using errcode = '42501';
  end if;
  perform public._assert_current_health_session(v_user_id);
  if p_expected_epoch is null or p_expected_epoch < 1
     or p_idempotency_key is null or p_idempotency_key !~ '^[a-f0-9]{64}$'
     or p_version is null or pg_catalog.length(pg_catalog.btrim(p_version)) not between 1 and 120
     or p_consent_text_hash is null or p_consent_text_hash !~ '^[a-f0-9]{64}$' then
    raise exception 'HEALTH_WITHDRAWAL_INPUT_INVALID' using errcode = '22023';
  end if;
  perform public._assert_health_consent_copy(
    'withdraw', p_version, p_consent_text_hash
  );

  v_digest := public._health_consent_token_digest(p_idempotency_key);
  perform pg_catalog.pg_advisory_xact_lock(
    public._account_deletion_advisory_key(v_user_id)
  );
  v_now := pg_catalog.clock_timestamp();

  if exists (
    select 1 from public.account_deletion_barriers as barriers
     where barriers.user_id = v_user_id
  ) then
    raise exception 'ACCOUNT_DELETION_IN_PROGRESS' using errcode = '55000';
  end if;

  insert into public.health_processing_states (user_id, state, epoch)
  values (v_user_id, 'unconsented', 0)
  on conflict on constraint health_processing_states_pkey do nothing;
  perform public._ensure_health_dependent_consent_states(v_user_id);

  select states.* into v_state
    from public.health_processing_states as states
   where states.user_id = v_user_id
   for update;

  if v_state.epoch <> p_expected_epoch then
    raise exception 'HEALTH_PROCESSING_EPOCH_STALE' using errcode = '55000';
  end if;

  select operations.* into v_operation
    from public.health_consent_withdrawal_operations as operations
   where operations.user_id = v_user_id
     and operations.idempotency_digest = v_digest;

  if v_operation.id is not null then
    if v_operation.epoch <> p_expected_epoch then
      raise exception 'HEALTH_IDEMPOTENCY_KEY_REUSED' using errcode = '55000';
    end if;
    if v_state.current_operation_id is distinct from v_operation.id
       or v_state.state not in ('withdrawing', 'withdrawn') then
      raise exception 'HEALTH_WITHDRAWAL_STATE_CONFLICT' using errcode = '55000';
    end if;
    update public.health_processing_states as states
       set last_server_verified_at = v_now,
           updated_at = v_now
     where states.user_id = v_user_id;
    return query
    select states.user_id,
           states.state,
           states.epoch,
           states.current_operation_id,
           operations.state,
           operations.last_result_code,
           states.last_server_verified_at,
           null::text,
           null::text
      from public.health_processing_states as states
      join public.health_consent_withdrawal_operations as operations
        on operations.id = states.current_operation_id
     where states.user_id = v_user_id;
    return;
  end if;

  if v_state.state in ('withdrawing', 'withdrawn') then
    raise exception 'HEALTH_WITHDRAWAL_ALREADY_EXISTS' using errcode = '55000';
  end if;
  if v_state.state <> 'active' then
    raise exception 'HEALTH_PROCESSING_NOT_ACTIVE' using errcode = '55000';
  end if;

  insert into public.health_consent_withdrawal_operations (
    user_id, epoch, idempotency_digest, state, requested_at, updated_at
  ) values (
    v_user_id, p_expected_epoch, v_digest, 'pending', v_now, v_now
  ) returning * into v_operation;

  insert into public.health_consent_withdrawal_steps (
    operation_id, step_name, step_order, status, updated_at
  ) values
    (v_operation.id, 'database_cleanup', 10, 'pending', v_now),
    (v_operation.id, 'photo_storage_delete', 20, 'pending', v_now),
    (v_operation.id, 'processor_reconciliation', 30, 'pending', v_now);

  update public.health_processing_states as states
     set state = 'withdrawing',
         current_operation_id = v_operation.id,
         consent_version = pg_catalog.btrim(p_version),
         consent_text_hash = p_consent_text_hash,
         withdrawal_requested_at = v_now,
         withdrawal_completed_at = null,
         last_server_verified_at = v_now,
         updated_at = v_now
   where states.user_id = v_user_id;

  perform pg_catalog.set_config(
    'onskin.health_read_barrier', v_user_id::text, true
  );
  update public.profiles
     set current_streak = 0,
         longest_streak = 0,
         updated_at = v_now
   where id = v_user_id
     and (current_streak <> 0 or longest_streak <> 0);
  perform pg_catalog.set_config('onskin.health_read_barrier', '', true);

  -- Append the exact base withdrawal receipt through the same sealed one-shot
  -- channel used by every dependent receipt.
  perform public._issue_health_consent_receipt_capability(
    v_user_id,
    'health_data_collection',
    false,
    pg_catalog.btrim(p_version),
    p_consent_text_hash,
    'base_withdrawal',
    'base:withdraw:e' || p_expected_epoch::text || ':' || v_operation.id::text
  );
  insert into public.consents (
    user_id, consent_type, granted, version, consent_text_hash,
    granted_at, revoked_at
  ) values (
    v_user_id, 'health_data_collection', false, pg_catalog.btrim(p_version),
    p_consent_text_hash, v_now, v_now
  );
  perform public._assert_health_consent_capability_cleared(v_user_id);

  -- Base withdrawal closes all six purpose-specific generations in the same
  -- owner lock and appends each type's own exact withdrawal copy. This is an
  -- aggregate privacy barrier, not cross-type reuse of the base disclosure.
  for v_dependent in
    select states.consent_type,
           states.generation,
           registry.version,
           registry.consent_text_hash
      from public.health_dependent_consent_states as states
      join public.health_consent_copy_registry as registry
        on registry.consent_type = states.consent_type
       and registry.action = 'withdraw'
       and registry.is_current
     where states.user_id = v_user_id
       and states.state = 'active'
     order by states.consent_type
     for update of states
  loop
    if v_dependent.generation = 9223372036854775807 then
      raise exception 'HEALTH_DEPENDENT_GENERATION_EXHAUSTED' using errcode = '22003';
    end if;
    perform public._issue_health_consent_receipt_capability(
      v_user_id,
      v_dependent.consent_type,
      false,
      v_dependent.version,
      v_dependent.consent_text_hash,
      'base_withdrawal_dependent',
      'base:withdraw-dependent:' || v_dependent.consent_type
        || ':e' || p_expected_epoch::text
        || ':g' || (v_dependent.generation + 1)::text
        || ':' || v_operation.id::text
    );
    insert into public.consents (
      user_id, consent_type, granted, version, consent_text_hash,
      granted_at, revoked_at
    ) values (
      v_user_id, v_dependent.consent_type, false,
      v_dependent.version, v_dependent.consent_text_hash, v_now, v_now
    ) returning id into v_dependent_consent_id;
    perform public._assert_health_consent_capability_cleared(v_user_id);

    update public.health_dependent_consent_states as states
       set state = 'withdrawing',
           generation = v_dependent.generation + 1,
           health_epoch = p_expected_epoch,
           current_receipt_id = v_dependent_consent_id,
           current_operation_id = null,
           base_withdrawal_operation_id = v_operation.id,
           parent_withdrawal_operation_id = null,
           version = v_dependent.version,
           consent_text_hash = v_dependent.consent_text_hash,
           withdrawal_requested_at = v_now,
           withdrawal_completed_at = null,
           updated_at = v_now
     where states.user_id = v_user_id
       and states.consent_type = v_dependent.consent_type
       and states.generation = v_dependent.generation;
    if not found then
      raise exception 'HEALTH_DEPENDENT_CONSENT_GENERATION_STALE' using errcode = '55000';
    end if;
  end loop;

  return query
  select states.user_id,
         states.state,
         states.epoch,
         states.current_operation_id,
         operations.state,
         operations.last_result_code,
         states.last_server_verified_at,
         null::text,
         null::text
    from public.health_processing_states as states
    join public.health_consent_withdrawal_operations as operations
      on operations.id = states.current_operation_id
   where states.user_id = v_user_id;
end;
$$;

revoke all on function public.begin_health_data_consent_withdrawal(bigint, text, text, text)
  from public, anon, service_role;
grant execute on function public.begin_health_data_consent_withdrawal(bigint, text, text, text)
  to authenticated;

-- Immediate owner-triggered cleanup and the scheduled worker share the same
-- short-lived per-operation capability. Only the JWT-verifying Edge service may
-- mint/renew the owner lane; authenticated clients cannot choose lease tokens or
-- keep a worker starved by renewing one indefinitely.
create or replace function public.claim_health_consent_withdrawal_for_owner(
  p_user_id uuid,
  p_operation_id uuid,
  p_claim_token text
)
returns table (operation_id uuid, user_id uuid, epoch bigint)
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_claim_digest text;
  v_operation public.health_consent_withdrawal_operations%rowtype;
  v_now timestamptz;
begin
  if p_user_id is null
     or p_operation_id is null
     or p_claim_token is null
     or p_claim_token !~ '^[a-f0-9]{64}$' then
    raise exception 'HEALTH_WORKER_CLAIM_INPUT_INVALID' using errcode = '22023';
  end if;
  v_claim_digest := public._health_consent_token_digest(p_claim_token);
  perform pg_catalog.pg_advisory_xact_lock(
    public._account_deletion_advisory_key(p_user_id)
  );
  v_now := pg_catalog.clock_timestamp();

  select operations.* into v_operation
    from public.health_consent_withdrawal_operations as operations
   where operations.id = p_operation_id
     and operations.user_id = p_user_id
   for update;
  if v_operation.id is null then
    raise exception 'HEALTH_WITHDRAWAL_OPERATION_NOT_FOUND' using errcode = 'P0002';
  end if;
  if exists (
    select 1 from public.account_deletion_barriers as barriers
     where barriers.user_id = p_user_id
  ) then
    raise exception 'ACCOUNT_DELETION_IN_PROGRESS' using errcode = '55000';
  end if;
  if v_operation.state = 'completed'
     or not exists (
       select 1 from public.health_processing_states as states
        where states.user_id = p_user_id
          and states.state = 'withdrawing'
          and states.current_operation_id = p_operation_id
          and states.epoch = v_operation.epoch
     ) then
    raise exception 'HEALTH_WITHDRAWAL_BARRIER_MISSING' using errcode = '55000';
  end if;
  if v_operation.state = 'action_required'
     and v_operation.last_result_code = 'WORKER_RETRY_EXHAUSTED'
     and v_operation.attempt_count >= 1000 then
    raise exception 'HEALTH_WITHDRAWAL_RETRY_EXHAUSTED' using errcode = '55000';
  end if;
  if v_operation.worker_claim_digest is not null
     and v_operation.worker_lease_expires_at > v_now
     and v_operation.worker_claim_digest <> v_claim_digest then
    raise exception 'HEALTH_WITHDRAWAL_CLAIM_ACTIVE' using errcode = '55P03';
  end if;

  update public.health_consent_withdrawal_operations as operations
     set worker_claim_digest = v_claim_digest,
         worker_lease_expires_at = v_now + interval '5 minutes',
         updated_at = v_now
   where operations.id = p_operation_id
   returning operations.id, operations.worker_lease_expires_at
     into v_operation.id, v_operation.worker_lease_expires_at;

  return query select v_operation.id, v_operation.user_id, v_operation.epoch;
end;
$$;

revoke all on function public.claim_health_consent_withdrawal_for_owner(uuid, uuid, text)
  from public, anon, authenticated;
grant execute on function public.claim_health_consent_withdrawal_for_owner(uuid, uuid, text)
  to service_role;

-- -----------------------------------------------------------------------------
-- Service worker RPCs: transactional database cleanup and Storage reconciliation
-- -----------------------------------------------------------------------------

create or replace function public.prepare_health_data_consent_withdrawal(
  p_operation_id uuid,
  p_claim_token text
)
returns table (
  operation_state text,
  result_code text,
  pending_storage_objects integer
)
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_operation public.health_consent_withdrawal_operations%rowtype;
  v_now timestamptz;
  v_invalid_paths integer := 0;
  v_pending integer := 0;
  v_database_succeeded boolean := false;
  v_processor_succeeded boolean := false;
begin
  if p_operation_id is null then
    raise exception 'HEALTH_WITHDRAWAL_OPERATION_REQUIRED' using errcode = '22023';
  end if;

  select operations.* into v_operation
    from public.health_consent_withdrawal_operations as operations
   where operations.id = p_operation_id;
  if v_operation.id is null then
    raise exception 'HEALTH_WITHDRAWAL_OPERATION_NOT_FOUND' using errcode = 'P0002';
  end if;

  perform pg_catalog.pg_advisory_xact_lock(
    public._account_deletion_advisory_key(v_operation.user_id)
  );
  v_now := pg_catalog.clock_timestamp();

  select operations.* into v_operation
    from public.health_consent_withdrawal_operations as operations
   where operations.id = p_operation_id
   for update;

  perform public._assert_health_withdrawal_claim_locked(
    p_operation_id, p_claim_token
  );

  if exists (
    select 1 from public.account_deletion_barriers as barriers
     where barriers.user_id = v_operation.user_id
  ) then
    raise exception 'ACCOUNT_DELETION_IN_PROGRESS' using errcode = '55000';
  end if;

  if v_operation.state = 'completed' then
    select count(*)::integer into v_pending
      from storage.objects as objects
     where objects.bucket_id = 'photos'
       and public._account_photo_storage_object_owned(
         v_operation.user_id,
         objects.name,
         pg_catalog.to_jsonb(objects) ->> 'owner',
         pg_catalog.to_jsonb(objects) ->> 'owner_id'
       );
    return query select v_operation.state, v_operation.last_result_code, v_pending;
    return;
  end if;

  if not exists (
    select 1 from public.health_processing_states as states
     where states.user_id = v_operation.user_id
       and states.state = 'withdrawing'
       and states.current_operation_id = p_operation_id
       and states.epoch = v_operation.epoch
  ) then
    raise exception 'HEALTH_WITHDRAWAL_BARRIER_MISSING' using errcode = '55000';
  end if;

  select exists (
    select 1 from public.health_consent_withdrawal_steps as steps
     where steps.operation_id = p_operation_id
       and steps.step_name = 'database_cleanup'
       and steps.status = 'succeeded'
  ) into v_database_succeeded;
  select exists (
    select 1 from public.health_consent_withdrawal_steps as steps
     where steps.operation_id = p_operation_id
       and steps.step_name = 'processor_reconciliation'
       and steps.status = 'succeeded'
  ) into v_processor_succeeded;

  update public.health_consent_withdrawal_operations as operations
     set state = 'running',
         last_result_code = null,
         updated_at = v_now
   where operations.id = p_operation_id;

  if not v_database_succeeded then
    update public.health_consent_withdrawal_steps as steps
       set status = 'running',
           attempt_count = least(steps.attempt_count + 1, 1000),
           started_at = coalesce(steps.started_at, v_now),
           completed_at = null,
           result_code = null,
           updated_at = v_now
     where steps.operation_id = p_operation_id
       and steps.step_name = 'database_cleanup';

    perform pg_catalog.set_config(
      'onskin.health_purge', v_operation.user_id::text, true
    );

    -- Break non-health business records' correlation to health-purpose events.
    update public.order_attributions as attributions
       set click_token = null
     where attributions.click_token in (
       select clicks.click_token
         from public.commerce_click_events as clicks
        where clicks.user_id = v_operation.user_id
     );
    delete from public.obf_contribution_queue where user_id = v_operation.user_id;

    -- Child/cross-owner references first; remaining children cascade from parents.
    delete from public.community_reports where reporter_id = v_operation.user_id;
    delete from public.community_reactions where user_id = v_operation.user_id;
    delete from public.community_questions where user_id = v_operation.user_id;
    delete from public.community_blocks where user_id = v_operation.user_id;
    delete from public.ask_safety_audit where user_id = v_operation.user_id;
    delete from public.ask_sessions where user_id = v_operation.user_id;
    delete from public.photo_trend where user_id = v_operation.user_id;
    delete from public.recommendations where user_id = v_operation.user_id;
    delete from public.recommendation_preferences where user_id = v_operation.user_id;
    delete from public.notification_log where user_id = v_operation.user_id;
    delete from public.notification_preferences where user_id = v_operation.user_id;
    delete from public.streak_freezes where user_id = v_operation.user_id;
    delete from public.routine_completions where user_id = v_operation.user_id;
    delete from public.routine_conflicts where user_id = v_operation.user_id;
    delete from public.active_ramp where user_id = v_operation.user_id;
    delete from public.cycles where user_id = v_operation.user_id;
    delete from public.routines where user_id = v_operation.user_id;
    delete from public.shelf_scans where user_id = v_operation.user_id;
    delete from public.user_products where user_id = v_operation.user_id;
    delete from public.photos where user_id = v_operation.user_id;
    delete from public.catalog_lookup_events where user_id = v_operation.user_id;
    delete from public.catalog_corrections where user_id = v_operation.user_id;
    delete from public.commerce_click_events where user_id = v_operation.user_id;
    delete from public.skin_profiles where user_id = v_operation.user_id;
    update public.profiles
       set current_streak = 0, longest_streak = 0, updated_at = v_now
     where id = v_operation.user_id;

    if public._health_relational_data_exists(v_operation.user_id) then
      raise exception 'HEALTH_WITHDRAWAL_DATABASE_RESIDUAL' using errcode = '55000';
    end if;
    perform pg_catalog.set_config('onskin.health_purge', '', true);

    update public.health_consent_withdrawal_steps as steps
       set status = 'succeeded',
           result_code = 'DATABASE_HEALTH_DATA_ABSENT',
           completed_at = v_now,
           updated_at = v_now
     where steps.operation_id = p_operation_id
       and steps.step_name = 'database_cleanup';
  end if;

  if v_operation.processor_inventory_version <> 'health-processors-v1'
     or v_operation.processor_inventory_hash <>
       '4f53cda18c2baa0c0354bb5f9a3ecbe5ed12ab4d8e11ba873c2f11161202b945' then
    update public.health_consent_withdrawal_steps as steps
       set status = 'action_required',
           attempt_count = least(steps.attempt_count + 1, 1000),
           started_at = coalesce(steps.started_at, v_now),
           completed_at = null,
           result_code = 'PROCESSOR_INVENTORY_MISMATCH',
           updated_at = v_now
     where steps.operation_id = p_operation_id
       and steps.step_name = 'processor_reconciliation';
    update public.health_consent_withdrawal_operations as operations
       set state = 'action_required',
           last_result_code = 'PROCESSOR_INVENTORY_MISMATCH',
           worker_claim_digest = null,
           worker_lease_expires_at = null,
           updated_at = v_now
     where operations.id = p_operation_id;
    return query
    select 'action_required'::text, 'PROCESSOR_INVENTORY_MISMATCH'::text, 0;
    return;
  end if;

  if not v_processor_succeeded then
    update public.health_consent_withdrawal_steps as steps
       set status = 'succeeded',
           attempt_count = least(steps.attempt_count + 1, 1000),
           started_at = coalesce(steps.started_at, v_now),
           result_code = 'PROCESSOR_INVENTORY_RECONCILED',
           completed_at = v_now,
           updated_at = v_now
     where steps.operation_id = p_operation_id
       and steps.step_name = 'processor_reconciliation';
  end if;

  -- Database and configured processors are reconciled even if one Storage row
  -- needs operator repair. Canonical pre-epoch paths remain safely drainable;
  -- explicit foreign epochs, noncanonical paths, or conflicting owner metadata
  -- fail closed. Retrying prepare after repair re-evaluates and resumes.
  select count(*)::integer into v_invalid_paths
    from storage.objects as objects
   where objects.bucket_id = 'photos'
     and (
       (
         public._account_photo_storage_object_owned(
           v_operation.user_id,
           objects.name,
           pg_catalog.to_jsonb(objects) ->> 'owner',
           pg_catalog.to_jsonb(objects) ->> 'owner_id'
         )
         and not public._health_photo_path_safe_for_withdrawal(
           v_operation.user_id, objects.name, v_operation.epoch
         )
       )
       or (
         (
           pg_catalog.split_part(objects.name, '/', 1) = v_operation.user_id::text
           or pg_catalog.to_jsonb(objects) ->> 'owner' = v_operation.user_id::text
           or pg_catalog.to_jsonb(objects) ->> 'owner_id' = v_operation.user_id::text
         )
         and not public._account_photo_storage_object_owned(
           v_operation.user_id,
           objects.name,
           pg_catalog.to_jsonb(objects) ->> 'owner',
           pg_catalog.to_jsonb(objects) ->> 'owner_id'
         )
       )
     );

  if v_invalid_paths > 0 then
    update public.health_consent_withdrawal_steps as steps
       set status = 'action_required',
           attempt_count = least(steps.attempt_count + 1, 1000),
           started_at = coalesce(steps.started_at, v_now),
           completed_at = null,
           result_code = 'UNSAFE_PHOTO_STORAGE_OWNERSHIP',
           updated_at = v_now
     where steps.operation_id = p_operation_id
       and steps.step_name = 'photo_storage_delete';
    update public.health_consent_withdrawal_operations as operations
       set state = 'action_required',
           last_result_code = 'UNSAFE_PHOTO_STORAGE_OWNERSHIP',
           next_attempt_at = v_now,
           worker_claim_digest = null,
           worker_lease_expires_at = null,
           updated_at = v_now
     where operations.id = p_operation_id;
    return query
    select 'action_required'::text,
           'UNSAFE_PHOTO_STORAGE_OWNERSHIP'::text,
           count(*)::integer
      from storage.objects as objects
     where objects.bucket_id = 'photos'
       and public._account_photo_storage_object_owned(
         v_operation.user_id,
         objects.name,
         pg_catalog.to_jsonb(objects) ->> 'owner',
         pg_catalog.to_jsonb(objects) ->> 'owner_id'
       );
    return;
  end if;

  select count(*)::integer into v_pending
    from storage.objects as objects
   where objects.bucket_id = 'photos'
     and public._account_photo_storage_object_owned(
       v_operation.user_id,
       objects.name,
       pg_catalog.to_jsonb(objects) ->> 'owner',
       pg_catalog.to_jsonb(objects) ->> 'owner_id'
     );

  if v_pending > 0 then
    update public.health_consent_withdrawal_steps as steps
       set status = 'running',
           attempt_count = least(steps.attempt_count + 1, 1000),
           started_at = coalesce(steps.started_at, v_now),
           completed_at = null,
           result_code = 'PHOTO_STORAGE_DELETION_PENDING',
           updated_at = v_now
     where steps.operation_id = p_operation_id
       and steps.step_name = 'photo_storage_delete'
       and steps.status <> 'succeeded';
  end if;

  update public.health_consent_withdrawal_operations as operations
     set state = case when v_pending > 0 then 'storage_pending' else 'running' end,
         last_result_code = case
           when v_pending > 0 then 'PHOTO_STORAGE_DELETION_PENDING'
           else 'DATABASE_AND_PROCESSORS_RECONCILED'
         end,
         next_attempt_at = case
           when v_pending > 0 then v_now + interval '1 minute'
           else v_now
         end,
         updated_at = v_now
   where operations.id = p_operation_id
   returning * into v_operation;

  return query select v_operation.state, v_operation.last_result_code, v_pending;
end;
$$;

revoke all on function public.prepare_health_data_consent_withdrawal(uuid, text)
  from public, anon, authenticated;
grant execute on function public.prepare_health_data_consent_withdrawal(uuid, text)
  to service_role;

create or replace function public.list_health_consent_storage_work(
  p_operation_id uuid,
  p_limit integer,
  p_claim_token text
)
returns table (storage_path text)
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_operation public.health_consent_withdrawal_operations%rowtype;
begin
  if p_operation_id is null or p_limit is null or p_limit not between 1 and 100 then
    raise exception 'HEALTH_STORAGE_WORK_INPUT_INVALID' using errcode = '22023';
  end if;

  select operations.* into v_operation
    from public.health_consent_withdrawal_operations as operations
   where operations.id = p_operation_id;
  if v_operation.id is null then
    raise exception 'HEALTH_WITHDRAWAL_OPERATION_NOT_FOUND' using errcode = 'P0002';
  end if;

  perform pg_catalog.pg_advisory_xact_lock(
    public._account_deletion_advisory_key(v_operation.user_id)
  );
  select operations.* into v_operation
    from public.health_consent_withdrawal_operations as operations
   where operations.id = p_operation_id
   for update;

  perform public._assert_health_withdrawal_claim_locked(
    p_operation_id, p_claim_token
  );

  if exists (
    select 1 from public.account_deletion_barriers as barriers
     where barriers.user_id = v_operation.user_id
  ) then
    raise exception 'ACCOUNT_DELETION_IN_PROGRESS' using errcode = '55000';
  end if;
  if v_operation.state not in ('running', 'storage_pending') then
    raise exception 'HEALTH_STORAGE_WORK_NOT_AVAILABLE' using errcode = '55000';
  end if;
  if not exists (
    select 1 from public.health_processing_states as states
     where states.user_id = v_operation.user_id
       and states.state = 'withdrawing'
       and states.current_operation_id = p_operation_id
       and states.epoch = v_operation.epoch
  ) then
    raise exception 'HEALTH_WITHDRAWAL_BARRIER_MISSING' using errcode = '55000';
  end if;
  if exists (
    select 1 from public.health_consent_withdrawal_steps as steps
     where steps.operation_id = p_operation_id
       and steps.step_name in ('database_cleanup', 'processor_reconciliation')
       and steps.status <> 'succeeded'
  ) then
    raise exception 'HEALTH_WITHDRAWAL_CLEANUP_NOT_RECONCILED' using errcode = '55000';
  end if;
  if exists (
    select 1 from storage.objects as objects
     where objects.bucket_id = 'photos'
       and (
         (
           public._account_photo_storage_object_owned(
             v_operation.user_id,
             objects.name,
             pg_catalog.to_jsonb(objects) ->> 'owner',
             pg_catalog.to_jsonb(objects) ->> 'owner_id'
           )
            and not public._health_photo_path_safe_for_withdrawal(
              v_operation.user_id, objects.name, v_operation.epoch
            )
         )
         or (
           (
             pg_catalog.split_part(objects.name, '/', 1) = v_operation.user_id::text
             or pg_catalog.to_jsonb(objects) ->> 'owner' = v_operation.user_id::text
             or pg_catalog.to_jsonb(objects) ->> 'owner_id' = v_operation.user_id::text
           )
           and not public._account_photo_storage_object_owned(
             v_operation.user_id,
             objects.name,
             pg_catalog.to_jsonb(objects) ->> 'owner',
             pg_catalog.to_jsonb(objects) ->> 'owner_id'
           )
         )
       )
  ) then
    raise exception 'HEALTH_STORAGE_WORK_PATH_INVALID' using errcode = '55000';
  end if;

  return query
  select objects.name
    from storage.objects as objects
   where objects.bucket_id = 'photos'
     and public._account_photo_storage_object_owned(
       v_operation.user_id,
       objects.name,
       pg_catalog.to_jsonb(objects) ->> 'owner',
       pg_catalog.to_jsonb(objects) ->> 'owner_id'
     )
     and public._health_photo_path_safe_for_withdrawal(
       v_operation.user_id, objects.name, v_operation.epoch
     )
   order by objects.name
   limit p_limit;
end;
$$;

revoke all on function public.list_health_consent_storage_work(uuid, integer, text)
  from public, anon, authenticated;
grant execute on function public.list_health_consent_storage_work(uuid, integer, text)
  to service_role;

create or replace function public.complete_health_data_consent_withdrawal(
  p_operation_id uuid,
  p_claim_token text
)
returns table (
  user_id uuid,
  state text,
  epoch bigint,
  operation_id uuid,
  operation_state text,
  result_code text,
  server_verified_at timestamptz,
  consent_version text,
  consent_text_hash text
)
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_operation public.health_consent_withdrawal_operations%rowtype;
  v_now timestamptz;
begin
  if p_operation_id is null then
    raise exception 'HEALTH_WITHDRAWAL_OPERATION_REQUIRED' using errcode = '22023';
  end if;
  select operations.* into v_operation
    from public.health_consent_withdrawal_operations as operations
   where operations.id = p_operation_id;
  if v_operation.id is null then
    raise exception 'HEALTH_WITHDRAWAL_OPERATION_NOT_FOUND' using errcode = 'P0002';
  end if;

  perform pg_catalog.pg_advisory_xact_lock(
    public._account_deletion_advisory_key(v_operation.user_id)
  );
  v_now := pg_catalog.clock_timestamp();

  select operations.* into v_operation
    from public.health_consent_withdrawal_operations as operations
   where operations.id = p_operation_id
   for update;

  perform public._assert_health_withdrawal_claim_locked(
    p_operation_id, p_claim_token
  );

  if exists (
    select 1 from public.account_deletion_barriers as barriers
     where barriers.user_id = v_operation.user_id
  ) then
    raise exception 'ACCOUNT_DELETION_IN_PROGRESS' using errcode = '55000';
  end if;

  if v_operation.state <> 'completed' then
    if not exists (
      select 1 from public.health_processing_states as states
       where states.user_id = v_operation.user_id
         and states.state = 'withdrawing'
         and states.current_operation_id = p_operation_id
         and states.epoch = v_operation.epoch
    ) then
      raise exception 'HEALTH_WITHDRAWAL_BARRIER_MISSING' using errcode = '55000';
    end if;
    if exists (
      select 1 from public.health_consent_withdrawal_steps as steps
       where steps.operation_id = p_operation_id
         and steps.step_name in ('database_cleanup', 'processor_reconciliation')
         and steps.status <> 'succeeded'
    ) then
      raise exception 'HEALTH_WITHDRAWAL_CLEANUP_NOT_RECONCILED' using errcode = '55000';
    end if;
    if public._health_relational_data_exists(v_operation.user_id) then
      raise exception 'HEALTH_WITHDRAWAL_DATABASE_RESIDUAL' using errcode = '55000';
    end if;
    if exists (
      select 1 from storage.objects as objects
       where objects.bucket_id = 'photos'
         and (
           pg_catalog.split_part(objects.name, '/', 1) = v_operation.user_id::text
           or pg_catalog.to_jsonb(objects) ->> 'owner' = v_operation.user_id::text
           or pg_catalog.to_jsonb(objects) ->> 'owner_id' = v_operation.user_id::text
         )
    ) then
      raise exception 'HEALTH_WITHDRAWAL_STORAGE_STILL_PRESENT' using errcode = '55000';
    end if;

    update public.health_consent_withdrawal_steps as steps
       set status = 'succeeded',
           attempt_count = least(steps.attempt_count + 1, 1000),
           started_at = coalesce(steps.started_at, v_now),
           result_code = 'PHOTO_STORAGE_ABSENCE_VERIFIED',
           completed_at = v_now,
           updated_at = v_now
     where steps.operation_id = p_operation_id
       and steps.step_name = 'photo_storage_delete'
       and steps.status <> 'succeeded';
    update public.health_consent_withdrawal_operations as operations
       set state = 'completed',
           last_result_code = 'HEALTH_WITHDRAWAL_COMPLETED',
           completed_at = v_now,
           next_attempt_at = v_now,
           worker_claim_digest = null,
           worker_lease_expires_at = null,
           updated_at = v_now
     where operations.id = p_operation_id
     returning * into v_operation;
    update public.health_processing_states as states
       set state = 'withdrawn',
           withdrawal_completed_at = v_now,
           last_server_verified_at = v_now,
           updated_at = v_now
     where states.user_id = v_operation.user_id
       and states.current_operation_id = p_operation_id
       and states.state = 'withdrawing'
       and states.epoch = v_operation.epoch;
    if not found then
      raise exception 'HEALTH_WITHDRAWAL_BARRIER_MISSING' using errcode = '55000';
    end if;
    update public.health_dependent_consent_states as dependent_states
       set state = 'withdrawn',
           withdrawal_completed_at = v_now,
           updated_at = v_now
     where dependent_states.user_id = v_operation.user_id
       and dependent_states.base_withdrawal_operation_id = p_operation_id
       and dependent_states.state = 'withdrawing'
       and dependent_states.health_epoch = v_operation.epoch;

    update public.health_dependent_consent_operations as dependent_operations
       set state = 'completed',
           last_result_code = 'PARENT_BASE_WITHDRAWAL_COMPLETED',
           next_attempt_at = v_now,
           worker_claim_digest = null,
           worker_lease_expires_at = null,
           completed_at = v_now,
           updated_at = v_now
      from public.health_dependent_consent_states as dependent_states
     where dependent_states.user_id = v_operation.user_id
       and dependent_states.state = 'withdrawing'
       and dependent_states.current_operation_id = dependent_operations.id
       and dependent_operations.action = 'withdraw'
       and dependent_operations.state <> 'completed';
    update public.health_dependent_consent_states as dependent_states
       set state = 'withdrawn',
           withdrawal_completed_at = v_now,
           updated_at = v_now
     where dependent_states.user_id = v_operation.user_id
       and dependent_states.state = 'withdrawing'
       and dependent_states.current_operation_id is not null
       and exists (
         select 1
           from public.health_dependent_consent_operations as dependent_operations
          where dependent_operations.id = dependent_states.current_operation_id
            and dependent_operations.state = 'completed'
       );
  else
    update public.health_processing_states as states
       set last_server_verified_at = v_now,
           updated_at = v_now
     where states.user_id = v_operation.user_id;
  end if;

  return query
  select states.user_id,
         states.state,
         states.epoch,
         states.current_operation_id,
         v_operation.state,
         v_operation.last_result_code,
         states.last_server_verified_at,
         null::text,
         null::text
    from public.health_processing_states as states
   where states.user_id = v_operation.user_id;
end;
$$;

revoke all on function public.complete_health_data_consent_withdrawal(uuid, text)
  from public, anon, authenticated;
grant execute on function public.complete_health_data_consent_withdrawal(uuid, text)
  to service_role;

create or replace function public.claim_due_health_consent_withdrawals(
  p_claim_token text,
  p_limit integer default 10
)
returns table (
  operation_id uuid,
  user_id uuid,
  epoch bigint
)
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_claim_digest text;
  v_now timestamptz := pg_catalog.clock_timestamp();
begin
  if p_claim_token is null or p_claim_token !~ '^[a-f0-9]{64}$'
     or p_limit is null or p_limit not between 1 and 25 then
    raise exception 'HEALTH_WORKER_CLAIM_INPUT_INVALID' using errcode = '22023';
  end if;
  v_claim_digest := public._health_consent_token_digest(p_claim_token);

  -- If the threshold claim committed but its worker disappeared before defer,
  -- the next scheduler pass closes it durably instead of issuing a 1,001st
  -- lease. This update and the claim CTE serialize on the operation row.
  update public.health_consent_withdrawal_operations as operations
     set state = 'action_required',
         last_result_code = 'WORKER_RETRY_EXHAUSTED',
         next_attempt_at = v_now,
         worker_claim_digest = null,
         worker_lease_expires_at = null,
         updated_at = v_now
   where operations.state in ('pending', 'running', 'storage_pending')
     and operations.attempt_count >= 1000
     and operations.next_attempt_at <= v_now
     and (
       operations.worker_claim_digest is null
       or operations.worker_lease_expires_at <= v_now
     )
     and exists (
       select 1 from public.health_processing_states as states
        where states.user_id = operations.user_id
          and states.state = 'withdrawing'
          and states.current_operation_id = operations.id
          and states.epoch = operations.epoch
     )
     and not exists (
       select 1 from public.account_deletion_barriers as barriers
        where barriers.user_id = operations.user_id
     );

  return query
  with candidates as (
    select operations.id
      from public.health_consent_withdrawal_operations as operations
     where operations.state in ('pending', 'running', 'storage_pending')
       and operations.attempt_count < 1000
       and operations.next_attempt_at <= v_now
       and (
         operations.worker_claim_digest is null
         or operations.worker_lease_expires_at <= v_now
       )
       and exists (
         select 1 from public.health_processing_states as states
          where states.user_id = operations.user_id
            and states.state = 'withdrawing'
            and states.current_operation_id = operations.id
            and states.epoch = operations.epoch
       )
       and not exists (
         select 1 from public.account_deletion_barriers as barriers
          where barriers.user_id = operations.user_id
       )
     order by operations.next_attempt_at, operations.requested_at, operations.id
     for update of operations skip locked
     limit p_limit
  ), claimed as (
    update public.health_consent_withdrawal_operations as operations
       set worker_claim_digest = v_claim_digest,
           worker_lease_expires_at = v_now + interval '5 minutes',
           attempt_count = operations.attempt_count + 1,
           updated_at = v_now
      from candidates
     where operations.id = candidates.id
     returning operations.id, operations.user_id, operations.epoch
  )
  select claimed.id, claimed.user_id, claimed.epoch
    from claimed
   order by claimed.id;
end;
$$;

revoke all on function public.claim_due_health_consent_withdrawals(text, integer)
  from public, anon, authenticated;
grant execute on function public.claim_due_health_consent_withdrawals(text, integer)
  to service_role;

create or replace function public.defer_health_consent_withdrawal(
  p_operation_id uuid,
  p_claim_token text,
  p_result_code text,
  p_retry_after_seconds integer
)
returns table (
  operation_id uuid,
  operation_state text,
  result_code text,
  next_attempt_at timestamptz
)
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_operation public.health_consent_withdrawal_operations%rowtype;
  v_claim_digest text;
  v_now timestamptz;
begin
  if p_operation_id is null
     or p_claim_token is null or p_claim_token !~ '^[a-f0-9]{64}$'
     or p_result_code is null or p_result_code !~ '^[A-Z0-9_]{1,64}$'
     or p_retry_after_seconds is null
     or p_retry_after_seconds not between 5 and 86400 then
    raise exception 'HEALTH_WORKER_DEFER_INPUT_INVALID' using errcode = '22023';
  end if;
  v_claim_digest := public._health_consent_token_digest(p_claim_token);

  select operations.* into v_operation
    from public.health_consent_withdrawal_operations as operations
   where operations.id = p_operation_id;
  if v_operation.id is null then
    raise exception 'HEALTH_WITHDRAWAL_OPERATION_NOT_FOUND' using errcode = 'P0002';
  end if;
  perform pg_catalog.pg_advisory_xact_lock(
    public._account_deletion_advisory_key(v_operation.user_id)
  );
  v_now := pg_catalog.clock_timestamp();
  if exists (
    select 1 from public.account_deletion_barriers as barriers
     where barriers.user_id = v_operation.user_id
  ) then
    raise exception 'ACCOUNT_DELETION_IN_PROGRESS' using errcode = '55000';
  end if;

  select operations.* into v_operation
    from public.health_consent_withdrawal_operations as operations
   where operations.id = p_operation_id
   for update;

  -- The threshold transition may have committed while its HTTP response was
  -- lost. Replaying the same attestation returns the exact durable terminal
  -- state/time without requiring a lease that was intentionally cleared.
  if v_operation.state = 'action_required'
     and v_operation.last_result_code = 'WORKER_RETRY_EXHAUSTED'
     and v_operation.attempt_count >= 1000
     and v_operation.worker_claim_digest is null
     and v_operation.worker_lease_expires_at is null
     and exists (
       select 1 from public.health_processing_states as states
        where states.user_id = v_operation.user_id
          and states.state = 'withdrawing'
          and states.current_operation_id = v_operation.id
          and states.epoch = v_operation.epoch
     ) then
    return query select v_operation.id, v_operation.state,
                        v_operation.last_result_code,
                        v_operation.next_attempt_at;
    return;
  end if;

  update public.health_consent_withdrawal_operations as operations
     set state = case
           when operations.attempt_count >= 1000 then 'action_required'
           else operations.state
         end,
         last_result_code = case
           when operations.attempt_count >= 1000 then 'WORKER_RETRY_EXHAUSTED'
           else p_result_code
         end,
         next_attempt_at = case
           when operations.attempt_count >= 1000 then v_now
           else v_now + pg_catalog.make_interval(secs => p_retry_after_seconds)
         end,
         worker_claim_digest = null,
         worker_lease_expires_at = null,
         updated_at = v_now
    where operations.id = p_operation_id
      and operations.state in ('pending', 'running', 'storage_pending')
      and operations.worker_claim_digest = v_claim_digest
      and operations.worker_lease_expires_at > v_now
   returning * into v_operation;
  if v_operation.id is null then
    raise exception 'HEALTH_WORKER_CLAIM_REJECTED' using errcode = '55000';
  end if;

  if v_operation.state = 'action_required' then
    update public.health_consent_withdrawal_steps as steps
       set status = 'action_required',
           result_code = 'WORKER_RETRY_EXHAUSTED',
           completed_at = null,
           updated_at = v_now
     where steps.operation_id = p_operation_id
       and steps.status <> 'succeeded';
  end if;

  return query select v_operation.id, v_operation.state,
                      v_operation.last_result_code,
                      v_operation.next_attempt_at;
end;
$$;

revoke all on function public.defer_health_consent_withdrawal(uuid, text, text, integer)
  from public, anon, authenticated;
grant execute on function public.defer_health_consent_withdrawal(uuid, text, text, integer)
  to service_role;

comment on table public.health_processing_states is
  'Service-only health-purpose admission state. Caller status is exposed only through an owner-derived RPC.';
comment on table public.health_consent_withdrawal_operations is
  'Durable non-account-deleting health withdrawal operations; removed with the Auth account.';
comment on function public.grant_health_data_consent(bigint, text, text) is
  'Atomically appends active health consent and opens a fresh processing epoch; terminal cleanup is required after withdrawal.';
comment on function public.begin_health_data_consent_withdrawal(bigint, text, text, text) is
  'Owner-derived, idempotent write barrier and immutable health-consent revocation.';
comment on function public.claim_due_health_consent_withdrawals(text, integer) is
  'Service-only SKIP LOCKED discovery with a hashed five-minute worker lease.';

commit;
