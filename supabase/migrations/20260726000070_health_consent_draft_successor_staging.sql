-- ---------------------------------------------------------------------------
-- 0070 · migration-owned health-consent draft successor staging
-- ---------------------------------------------------------------------------
--
-- 0054 deliberately installed placeholder disclosure tuples as draft_blocked.
-- The Ask grant text later changed in the checked-in mobile contract without a
-- legal/privacy release. Preserve the installed tuple as immutable history and
-- stage the exact mobile tuple as the sole current draft. This migration does
-- not approve copy, append review evidence, or make a grant admissible.

begin;

create table public.health_consent_copy_staging_events (
  id uuid primary key default gen_random_uuid(),
  consent_type text not null,
  action text not null check (action in ('grant', 'decline', 'withdraw')),
  previous_version text not null check (
    previous_version = pg_catalog.btrim(previous_version)
    and pg_catalog.length(previous_version) between 1 and 120
  ),
  previous_consent_text_hash text not null
    check (previous_consent_text_hash ~ '^[a-f0-9]{64}$'),
  previous_review_status text not null
    check (previous_review_status = 'draft_blocked'),
  previous_from_is_current boolean not null check (previous_from_is_current),
  previous_to_is_current boolean not null check (not previous_to_is_current),
  successor_version text not null check (
    successor_version = pg_catalog.btrim(successor_version)
    and pg_catalog.length(successor_version) between 1 and 120
  ),
  successor_consent_text_hash text not null
    check (successor_consent_text_hash ~ '^[a-f0-9]{64}$'),
  successor_review_status text not null
    check (successor_review_status = 'draft_blocked'),
  successor_from_is_current boolean not null check (not successor_from_is_current),
  successor_to_is_current boolean not null check (successor_to_is_current),
  staging_change_reference text not null check (
    staging_change_reference = pg_catalog.btrim(staging_change_reference)
    and staging_change_reference ~ '^[A-Z0-9][A-Z0-9._:/-]{5,199}$'
  ),
  staged_by text not null check (
    staged_by = pg_catalog.btrim(staged_by)
    and staged_by ~ '^[A-Za-z0-9][A-Za-z0-9._@:+/-]{2,199}$'
  ),
  staging_evidence_hash text not null
    check (staging_evidence_hash ~ '^[a-f0-9]{64}$'),
  lifecycle_xid pg_catalog.xid8 not null,
  lifecycle_backend_pid integer not null,
  staged_at timestamptz not null default now(),
  foreign key (
    consent_type, action, previous_version, previous_consent_text_hash
  ) references public.health_consent_copy_registry (
    consent_type, action, version, consent_text_hash
  ) on update restrict on delete restrict,
  foreign key (
    consent_type, action, successor_version, successor_consent_text_hash
  ) references public.health_consent_copy_registry (
    consent_type, action, version, consent_text_hash
  ) on update restrict on delete restrict,
  check (pg_catalog.isfinite(staged_at)),
  check (
    (previous_version, previous_consent_text_hash)
      <> (successor_version, successor_consent_text_hash)
  ),
  unique (
    consent_type, action, previous_version, previous_consent_text_hash
  ),
  unique (
    consent_type, action, successor_version, successor_consent_text_hash
  )
);

comment on table public.health_consent_copy_staging_events is
  'Immutable migration evidence for draft-to-draft copy alignment only. Rows are not legal/privacy review or release approval.';
comment on column public.health_consent_copy_staging_events.staging_evidence_hash is
  'Database-verified SHA-256 of every length-prefixed UTF-8 draft-staging field; never an approval or review-evidence hash.';

alter table public.health_consent_copy_staging_events enable row level security;
alter table public.health_consent_copy_staging_events force row level security;
revoke all on table public.health_consent_copy_staging_events
  from public, anon, authenticated, service_role;

create or replace function public._guard_health_consent_copy_staging_event_immutable()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  raise exception 'HEALTH_CONSENT_COPY_STAGING_EVENT_IMMUTABLE'
    using errcode = '55000';
end;
$$;

revoke all on function public._guard_health_consent_copy_staging_event_immutable()
  from public, anon, authenticated, service_role;

create trigger trg_health_consent_copy_staging_event_immutable
  before update or delete on public.health_consent_copy_staging_events
  for each row
  execute function public._guard_health_consent_copy_staging_event_immutable();

-- Length-prefix every UTF-8 field so separators inside input values cannot
-- create ambiguous encodings. The stage function verifies the supplied digest
-- against this database-derived value before it can write any row.
create or replace function public._health_consent_copy_staging_evidence_hash(
  p_consent_type text,
  p_action text,
  p_previous_version text,
  p_previous_consent_text_hash text,
  p_successor_version text,
  p_successor_consent_text_hash text,
  p_staging_change_reference text,
  p_staged_by text
)
returns text
language sql
immutable
set search_path = ''
as $$
  select pg_catalog.encode(
    extensions.digest(
      pg_catalog.convert_to(
        'health-consent-draft-successor:v1'
        || '|' || pg_catalog.octet_length(
          pg_catalog.convert_to(p_consent_type, 'UTF8')
        )::text || ':' || p_consent_type
        || '|' || pg_catalog.octet_length(
          pg_catalog.convert_to(p_action, 'UTF8')
        )::text || ':' || p_action
        || '|' || pg_catalog.octet_length(
          pg_catalog.convert_to(p_previous_version, 'UTF8')
        )::text || ':' || p_previous_version
        || '|' || pg_catalog.octet_length(
          pg_catalog.convert_to(p_previous_consent_text_hash, 'UTF8')
        )::text || ':' || p_previous_consent_text_hash
        || '|' || pg_catalog.octet_length(
          pg_catalog.convert_to(p_successor_version, 'UTF8')
        )::text || ':' || p_successor_version
        || '|' || pg_catalog.octet_length(
          pg_catalog.convert_to(p_successor_consent_text_hash, 'UTF8')
        )::text || ':' || p_successor_consent_text_hash
        || '|' || pg_catalog.octet_length(
          pg_catalog.convert_to(p_staging_change_reference, 'UTF8')
        )::text || ':' || p_staging_change_reference
        || '|' || pg_catalog.octet_length(
          pg_catalog.convert_to(p_staged_by, 'UTF8')
        )::text || ':' || p_staged_by,
        'UTF8'
      ),
      'sha256'
    ),
    'hex'
  )
$$;

revoke all on function public._health_consent_copy_staging_evidence_hash(
  text, text, text, text, text, text, text, text
) from public, anon, authenticated, service_role;

-- Extend the 0054 registry guard with a narrowly distinct staging lane.
-- Review events remain the only way to approve, supersede approved copy, or
-- emergency-close copy. Staging events can only exchange one current
-- draft_blocked tuple for another current draft_blocked tuple.
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

  if new.review_status = old.review_status
     and old.is_current
     and not new.is_current
     and (
       exists (
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
       )
       or (
         old.review_status = 'draft_blocked'
         and exists (
           select 1
             from public.health_consent_copy_staging_events as events
            where events.consent_type = new.consent_type
              and events.action = new.action
              and events.previous_version = new.version
              and events.previous_consent_text_hash = new.consent_text_hash
              and events.previous_review_status = new.review_status
              and events.previous_from_is_current = old.is_current
              and events.previous_to_is_current = new.is_current
              and events.lifecycle_xid = pg_catalog.pg_current_xact_id()
              and events.lifecycle_backend_pid = pg_catalog.pg_backend_pid()
         )
       )
     ) then
    return new;
  end if;

  if old.review_status = 'draft_blocked'
     and not old.is_current
     and new.is_current
     and (
       (
         new.review_status = (case
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
         )
       )
       or (
         new.review_status = 'draft_blocked'
         and exists (
           select 1
             from public.health_consent_copy_staging_events as events
            where events.consent_type = new.consent_type
              and events.action = new.action
              and events.successor_version = new.version
              and events.successor_consent_text_hash = new.consent_text_hash
              and events.successor_review_status = new.review_status
              and events.successor_from_is_current = old.is_current
              and events.successor_to_is_current = new.is_current
              and events.lifecycle_xid = pg_catalog.pg_current_xact_id()
              and events.lifecycle_backend_pid = pg_catalog.pg_backend_pid()
         )
       )
     ) then
    return new;
  end if;

  raise exception 'HEALTH_CONSENT_COPY_LIFECYCLE_EVIDENCE_REQUIRED'
    using errcode = '55000';
end;
$$;

revoke all on function public._guard_health_consent_copy_registry_lifecycle()
  from public, anon, authenticated, service_role;

create or replace function public.stage_health_consent_copy_draft_successor(
  p_consent_type text,
  p_action text,
  p_previous_version text,
  p_previous_consent_text_hash text,
  p_successor_version text,
  p_successor_consent_text_hash text,
  p_staging_change_reference text,
  p_staged_by text,
  p_staging_evidence_hash text
)
returns table (
  staging_event_id uuid,
  consent_type text,
  action text,
  previous_version text,
  previous_consent_text_hash text,
  successor_version text,
  successor_consent_text_hash text,
  successor_review_status text,
  successor_is_current boolean,
  staging_change_reference text,
  staged_by text,
  staging_evidence_hash text,
  staged_at timestamptz
)
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_current public.health_consent_copy_registry%rowtype;
  v_previous public.health_consent_copy_registry%rowtype;
  v_event public.health_consent_copy_staging_events%rowtype;
  v_expected_staging_evidence_hash text;
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
     or p_staging_change_reference is null
     or p_staging_change_reference <> pg_catalog.btrim(p_staging_change_reference)
     or p_staging_change_reference !~ '^[A-Z0-9][A-Z0-9._:/-]{5,199}$'
     or p_staged_by is null
     or p_staged_by <> pg_catalog.btrim(p_staged_by)
     or p_staged_by !~ '^[A-Za-z0-9][A-Za-z0-9._@:+/-]{2,199}$'
     or p_staging_evidence_hash is null
     or p_staging_evidence_hash !~ '^[a-f0-9]{64}$'
     or (
       p_consent_type = 'health_data_collection'
       and p_action not in ('grant', 'decline', 'withdraw')
     )
     or (
       p_consent_type <> 'health_data_collection'
       and (
         not public._health_consent_type_protected(p_consent_type)
         or p_action = 'decline'
       )
     ) then
    raise exception 'HEALTH_CONSENT_COPY_DRAFT_STAGING_INPUT_INVALID'
      using errcode = '22023';
  end if;

  v_expected_staging_evidence_hash :=
    public._health_consent_copy_staging_evidence_hash(
      p_consent_type,
      p_action,
      p_previous_version,
      p_previous_consent_text_hash,
      p_successor_version,
      p_successor_consent_text_hash,
      p_staging_change_reference,
      p_staged_by
    );
  if p_staging_evidence_hash <> v_expected_staging_evidence_hash then
    raise exception 'HEALTH_CONSENT_COPY_DRAFT_STAGING_EVIDENCE_MISMATCH'
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

  if v_current.version = p_successor_version
     and v_current.consent_text_hash = p_successor_consent_text_hash
     and v_current.review_status = 'draft_blocked' then
    select events.* into v_event
      from public.health_consent_copy_staging_events as events
     where events.consent_type = p_consent_type
       and events.action = p_action
       and events.previous_version = p_previous_version
       and events.previous_consent_text_hash = p_previous_consent_text_hash
       and events.successor_version = p_successor_version
       and events.successor_consent_text_hash = p_successor_consent_text_hash;
    if v_event.id is null
       or v_event.staging_change_reference <> p_staging_change_reference
       or v_event.staged_by <> p_staged_by
       or v_event.staging_evidence_hash <> p_staging_evidence_hash then
      raise exception 'HEALTH_CONSENT_COPY_DRAFT_STAGING_CONFLICT'
        using errcode = '55000';
    end if;
    return query select
      v_event.id, p_consent_type, p_action, p_previous_version,
      p_previous_consent_text_hash, p_successor_version,
      p_successor_consent_text_hash, 'draft_blocked'::text, true,
      v_event.staging_change_reference, v_event.staged_by,
      v_event.staging_evidence_hash, v_event.staged_at;
    return;
  end if;

  if v_current.consent_type is null
     or v_current.version <> p_previous_version
     or v_current.consent_text_hash <> p_previous_consent_text_hash
     or v_current.review_status <> 'draft_blocked' then
    raise exception 'HEALTH_CONSENT_COPY_DRAFT_STAGING_MISMATCH'
      using errcode = '22023';
  end if;

  select registry.* into v_previous
    from public.health_consent_copy_registry as registry
   where registry.consent_type = p_consent_type
     and registry.action = p_action
     and registry.version = p_previous_version
     and registry.consent_text_hash = p_previous_consent_text_hash
   for update;

  if v_previous.consent_type is null
     or not v_previous.is_current
     or v_previous.review_status <> 'draft_blocked'
     or exists (
       select 1
         from public.health_consent_copy_registry as registry
        where registry.consent_type = p_consent_type
          and registry.action = p_action
          and registry.version = p_successor_version
          and registry.consent_text_hash = p_successor_consent_text_hash
     ) then
    raise exception 'HEALTH_CONSENT_COPY_DRAFT_STAGING_CONFLICT'
      using errcode = '55000';
  end if;

  insert into public.health_consent_copy_registry (
    consent_type, action, version, consent_text_hash, review_status, is_current
  ) values (
    p_consent_type, p_action, p_successor_version,
    p_successor_consent_text_hash, 'draft_blocked', false
  );

  insert into public.health_consent_copy_staging_events (
    consent_type, action,
    previous_version, previous_consent_text_hash,
    previous_review_status, previous_from_is_current, previous_to_is_current,
    successor_version, successor_consent_text_hash,
    successor_review_status, successor_from_is_current, successor_to_is_current,
    staging_change_reference, staged_by, staging_evidence_hash,
    lifecycle_xid, lifecycle_backend_pid
  ) values (
    p_consent_type, p_action,
    p_previous_version, p_previous_consent_text_hash,
    'draft_blocked', true, false,
    p_successor_version, p_successor_consent_text_hash,
    'draft_blocked', false, true,
    p_staging_change_reference, p_staged_by, p_staging_evidence_hash,
    pg_catalog.pg_current_xact_id(), pg_catalog.pg_backend_pid()
  ) returning * into v_event;

  update public.health_consent_copy_registry as registry
     set is_current = false
   where registry.consent_type = p_consent_type
     and registry.action = p_action
     and registry.version = p_previous_version
     and registry.consent_text_hash = p_previous_consent_text_hash
     and registry.review_status = 'draft_blocked'
     and registry.is_current;
  if not found then
    raise exception 'HEALTH_CONSENT_COPY_DRAFT_STAGING_CONFLICT'
      using errcode = '55000';
  end if;

  update public.health_consent_copy_registry as registry
     set is_current = true
   where registry.consent_type = p_consent_type
     and registry.action = p_action
     and registry.version = p_successor_version
     and registry.consent_text_hash = p_successor_consent_text_hash
     and registry.review_status = 'draft_blocked'
     and not registry.is_current;
  if not found then
    raise exception 'HEALTH_CONSENT_COPY_DRAFT_STAGING_CONFLICT'
      using errcode = '55000';
  end if;

  return query select
    v_event.id, p_consent_type, p_action, p_previous_version,
    p_previous_consent_text_hash, p_successor_version,
    p_successor_consent_text_hash, 'draft_blocked'::text, true,
    v_event.staging_change_reference, v_event.staged_by,
    v_event.staging_evidence_hash, v_event.staged_at;
end;
$$;

comment on function public.stage_health_consent_copy_draft_successor(
  text, text, text, text, text, text, text, text, text
) is
  'Migration-owner-only draft alignment. It cannot approve copy or append review/promotion evidence.';

revoke all on function public.stage_health_consent_copy_draft_successor(
  text, text, text, text, text, text, text, text, text
) from public, anon, authenticated, service_role;

do $$
begin
  perform *
    from public.stage_health_consent_copy_draft_successor(
      'ask_onskin',
      'grant',
      'ask-advisor-2026-06-14-placeholder',
      '90cd7ec21799ed34a207bf1d6dc06220ff94f874af1cf9dbdce1a63db68f9e18',
      'ask-advisor-2026-06-14-placeholder',
      '4bc7f130404b5d0d12aa52e0999efa72b1b68dd537fb90bbd708e60c561e1dcc',
      'DB-MIGRATION-20260726000070-ASK-DRAFT-ALIGNMENT',
      'migration:20260726000070',
      '32ccfdfeab34f099c63ccb3b5d6d53ddea955a978b020fdc18738b723a1a6649'
    );
end;
$$;

-- The newly current tuple remains intentionally unreleased. Existing
-- admission functions therefore reject it with HEALTH_CONSENT_COPY_NOT_RELEASED
-- until a separate, genuine review migration promotes the exact tuple.

commit;
