-- =============================================================================
-- 0069 · owner-derived Shelf + routine-completion sync authority
-- =============================================================================
-- This migration is a quiesced deployment boundary. The bounded lock timeout
-- prevents an online deploy from waiting indefinitely behind an old writer;
-- operators retry the whole transaction after bridge/withdrawal traffic drains.
begin;

set local lock_timeout = '30s';

lock table public.user_products in access exclusive mode;
lock table public.routines in access exclusive mode;
lock table public.routine_steps in access exclusive mode;
lock table public.routine_completions in access exclusive mode;

create schema if not exists private;
revoke all on schema private from public, anon, authenticated, service_role;

-- Fail closed before replacing the legacy product FK. A UUID foreign key proves
-- existence, not that a step and product have the same owner.
create or replace function private.assert_routine_step_product_legacy_integrity()
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if exists (
    select 1
      from public.routine_steps as steps
      join public.routines as routines on routines.id = steps.routine_id
      join public.user_products as products on products.id = steps.user_product_id
     where products.user_id is distinct from routines.user_id
  ) then
    raise exception 'ROUTINE_STEP_PRODUCT_LEGACY_OWNER_INVALID'
      using errcode = '23514';
  end if;
end;
$$;

revoke all on function private.assert_routine_step_product_legacy_integrity()
  from public, anon, authenticated, service_role;

select private.assert_routine_step_product_legacy_integrity();

-- Active product content remains in user_products. This relation retains only
-- the minimum stable identity needed by a queued historical completion after a
-- Shelf delete. It contains no name, barcode, catalog, PAO, or expiry payload.
create table public.shelf_product_identities (
  id uuid primary key,
  user_id uuid not null references auth.users (id) on delete cascade,
  created_at timestamptz not null default pg_catalog.statement_timestamp(),
  deleted_effective_at timestamptz,
  deleted_received_at timestamptz,
  constraint shelf_product_identities_tombstone_coherent check (
    (deleted_effective_at is null and deleted_received_at is null)
    or (
      deleted_effective_at is not null
      and deleted_received_at is not null
      and pg_catalog.isfinite(deleted_effective_at)
      and pg_catalog.isfinite(deleted_received_at)
    )
  )
);

create index shelf_product_identities_user_idx
  on public.shelf_product_identities (user_id, id);

insert into public.shelf_product_identities (id, user_id, created_at)
select products.id, products.user_id, products.created_at
  from public.user_products as products
order by products.user_id, products.id;

alter table public.user_products
  add constraint user_products_shelf_identity_fkey
  foreign key (id)
  references public.shelf_product_identities (id)
  on delete cascade
  deferrable initially immediate;

alter table public.routine_steps
  drop constraint routine_steps_user_product_id_fkey,
  add constraint routine_steps_user_product_id_fkey
  foreign key (user_product_id)
  references public.shelf_product_identities (id)
  on delete no action
  deferrable initially deferred;

-- Keep the owner relationship as a database invariant for privileged repair
-- tooling as well as for the RPC. The pre-cutover assertion above proves the
-- legacy rows before this deferred constraint trigger is installed.
create or replace function private.assert_routine_step_product_owner()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.user_product_id is not null
     and not exists (
       select 1
         from public.routines as routines
         join public.shelf_product_identities as identities
           on identities.id = new.user_product_id
          and identities.user_id = routines.user_id
        where routines.id = new.routine_id
     ) then
    raise exception 'ROUTINE_STEP_PRODUCT_OWNER_INVALID'
      using errcode = '23514';
  end if;
  return null;
end;
$$;

revoke all on function private.assert_routine_step_product_owner()
  from public, anon, authenticated, service_role;

create constraint trigger trg_routine_steps_product_owner
  after insert or update of routine_id, user_product_id
  on public.routine_steps
  deferrable initially immediate
  for each row execute function private.assert_routine_step_product_owner();

alter table public.shelf_product_identities enable row level security;
alter table public.shelf_product_identities force row level security;

create policy "shelf_product_identities_select_own"
  on public.shelf_product_identities
  for select to authenticated
  using ((select auth.uid()) = user_id);

create policy "shelf_product_identities_health_read_fence"
  on public.shelf_product_identities
  as restrictive for select to authenticated
  using (private.health_processing_read_allowed(user_id));

create policy "shelf_product_identities_apple_read_fence"
  on public.shelf_product_identities
  as restrictive for select to authenticated
  using (public.account_access_allowed());

revoke all on table public.shelf_product_identities
  from public, anon, authenticated, service_role;

-- API callers never address these ledgers. They retain a domain-separated
-- request digest and disposition, never the raw Shelf payload or completion
-- body. Consent withdrawal and account/Auth deletion erase them.
create table private.shelf_sync_operations (
  operation_id uuid primary key,
  user_id uuid not null references auth.users (id) on delete cascade,
  request_sha256 text not null check (request_sha256 ~ '^[0-9a-f]{64}$'),
  state text not null check (state in ('pending', 'accepted', 'terminal')),
  result_code text check (
    result_code is null
    or result_code in (
      'SHELF_PRODUCT_ID_INVALID',
      'SHELF_PRODUCT_PAYLOAD_INVALID',
      'SHELF_PRODUCT_PROVENANCE_INVALID',
      'SHELF_PRODUCT_OWNERSHIP_CONFLICT'
    )
  ),
  created_at timestamptz not null default pg_catalog.statement_timestamp(),
  finalized_at timestamptz,
  constraint shelf_sync_operations_state_coherent check (
    (state = 'pending' and result_code is null and finalized_at is null)
    or (state = 'accepted' and result_code is null and finalized_at is not null)
    or (state = 'terminal' and result_code is not null and finalized_at is not null)
  )
);

create index shelf_sync_operations_user_idx
  on private.shelf_sync_operations (user_id, created_at);

create table private.routine_completion_sync_operations (
  event_id uuid primary key,
  user_id uuid not null references auth.users (id) on delete cascade,
  request_sha256 text not null check (request_sha256 ~ '^[0-9a-f]{64}$'),
  state text not null check (state in ('pending', 'accepted', 'terminal')),
  result_code text check (
    result_code is null
    or result_code in (
      'COMPLETION_REQUEST_INVALID',
      'COMPLETION_EVENT_CONFLICT',
      'COMPLETION_IDENTITY_CONFLICT',
      'COMPLETION_AFTER_PRODUCT_DELETION'
    )
  ),
  created_at timestamptz not null default pg_catalog.statement_timestamp(),
  finalized_at timestamptz,
  constraint routine_completion_sync_operations_state_coherent check (
    (state = 'pending' and result_code is null and finalized_at is null)
    or (state = 'accepted' and result_code is null and finalized_at is not null)
    or (state = 'terminal' and result_code is not null and finalized_at is not null)
  )
);

create index routine_completion_sync_operations_user_idx
  on private.routine_completion_sync_operations (user_id, created_at);

revoke all on table private.shelf_sync_operations
  from public, anon, authenticated, service_role;
revoke all on table private.routine_completion_sync_operations
  from public, anon, authenticated, service_role;

-- ---------------------------------------------------------------------------
-- Canonical request helpers
-- ---------------------------------------------------------------------------

create or replace function private.sync_uuid_is_valid(p_value text)
returns boolean
language sql
immutable
security definer
set search_path = ''
as $$
  select p_value is not null
    and p_value ~ '^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$'
$$;

create or replace function private.sync_uuid_v4_is_valid(p_value text)
returns boolean
language sql
immutable
security definer
set search_path = ''
as $$
  select p_value is not null
    and p_value ~ '^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$'
$$;

create or replace function private.sync_date_is_valid(p_value text)
returns boolean
language plpgsql
immutable
security definer
set search_path = ''
as $$
declare
  v_date date;
begin
  if p_value is null or p_value !~ '^[0-9]{4}-[0-9]{2}-[0-9]{2}$' then
    return false;
  end if;
  begin
    v_date := p_value::date;
  exception when others then
    return false;
  end;
  return pg_catalog.to_char(v_date, 'YYYY-MM-DD') = p_value;
end;
$$;

create or replace function private.sync_instant_is_valid(p_value text)
returns boolean
language plpgsql
immutable
security definer
set search_path = ''
as $$
declare
  v_instant timestamptz;
begin
  if p_value is null
     or p_value !~ '^[0-9]{4}-[0-9]{2}-[0-9]{2}T[0-9]{2}:[0-9]{2}:[0-9]{2}\.[0-9]{3}Z$' then
    return false;
  end if;
  begin
    v_instant := p_value::timestamptz;
  exception when others then
    return false;
  end;
  return pg_catalog.isfinite(v_instant)
    and pg_catalog.to_char(
      v_instant at time zone 'UTC',
      'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"'
    ) = p_value;
end;
$$;

create or replace function private.sync_bounded_integer_is_valid(
  p_value text,
  p_minimum integer,
  p_maximum integer
)
returns boolean
language plpgsql
immutable
security definer
set search_path = ''
as $$
declare
  v_value integer;
begin
  if p_value is null
     or p_minimum is null
     or p_maximum is null
     or p_minimum > p_maximum
     or p_value !~ '^[0-9]{1,9}$' then
    return false;
  end if;
  begin
    v_value := p_value::integer;
  exception when others then
    return false;
  end;
  return v_value between p_minimum and p_maximum;
end;
$$;

create or replace function private.sync_sha256(p_domain text, p_body jsonb)
returns text
language sql
immutable
security definer
set search_path = ''
as $$
  select pg_catalog.encode(
    extensions.digest(
      pg_catalog.convert_to(p_domain || E'\n' || p_body::text, 'UTF8'),
      'sha256'
    ),
    'hex'
  )
$$;

create or replace function private.shelf_sync_response(
  p_operation_id text,
  p_status text,
  p_code text
)
returns jsonb
language sql
immutable
security definer
set search_path = ''
as $$
  select pg_catalog.jsonb_build_object(
    'version', 1,
    'operation_id', p_operation_id,
    'status', p_status,
    'code', p_code
  )
$$;

create or replace function private.completion_sync_response(
  p_event_id text,
  p_status text,
  p_code text
)
returns jsonb
language sql
immutable
security definer
set search_path = ''
as $$
  select pg_catalog.jsonb_build_object(
    'version', 1,
    'event_id', p_event_id,
    'status', p_status,
    'code', p_code
  )
$$;

create or replace function private.shelf_payload_is_valid(p_payload jsonb)
returns boolean
language plpgsql
immutable
security definer
set search_path = ''
as $$
begin
  if p_payload is null
     or pg_catalog.jsonb_typeof(p_payload) is distinct from 'object' then
    return false;
  end if;
  return (
  select pg_catalog.octet_length(p_payload::text) <= 8192
    and (
      select count(*) from pg_catalog.jsonb_object_keys(p_payload)
    ) = 18
    and p_payload ?& array[
      'id', 'catalog_product_id', 'catalog_source_id',
      'catalog_match_quality', 'catalog_source_snapshot_date',
      'manual_name', 'manual_brand', 'barcode', 'opened_at', 'pao_months',
      'expiry_date', 'is_opened', 'pao_source', 'expiry_source', 'added_via',
      'source_disclosure_ack_at', 'status', 'finished_at'
    ]
    and pg_catalog.jsonb_typeof(p_payload -> 'id') = 'string'
    and private.sync_uuid_v4_is_valid(p_payload ->> 'id')
    and pg_catalog.jsonb_typeof(p_payload -> 'manual_name') = 'string'
    and pg_catalog.length(p_payload ->> 'manual_name') between 1 and 120
    and pg_catalog.octet_length(p_payload ->> 'manual_name') <= 512
    and p_payload ->> 'manual_name' = pg_catalog.btrim(p_payload ->> 'manual_name')
    and p_payload ->> 'manual_name' !~ '[[:cntrl:]]'
    and (
      pg_catalog.jsonb_typeof(p_payload -> 'manual_brand') = 'null'
      or (
        pg_catalog.jsonb_typeof(p_payload -> 'manual_brand') = 'string'
        and pg_catalog.length(p_payload ->> 'manual_brand') between 1 and 120
        and pg_catalog.octet_length(p_payload ->> 'manual_brand') <= 512
        and p_payload ->> 'manual_brand' = pg_catalog.btrim(p_payload ->> 'manual_brand')
        and p_payload ->> 'manual_brand' !~ '[[:cntrl:]]'
      )
    )
    and (
      pg_catalog.jsonb_typeof(p_payload -> 'barcode') = 'null'
      or (
        pg_catalog.jsonb_typeof(p_payload -> 'barcode') = 'string'
        and p_payload ->> 'barcode' ~ '^(?:[0-9]{8}|[0-9]{12}|[0-9]{13}|[0-9]{14})$'
      )
    )
    and (
      pg_catalog.jsonb_typeof(p_payload -> 'catalog_product_id') = 'null'
      or (
        pg_catalog.jsonb_typeof(p_payload -> 'catalog_product_id') = 'string'
        and private.sync_uuid_is_valid(p_payload ->> 'catalog_product_id')
      )
    )
    and (
      pg_catalog.jsonb_typeof(p_payload -> 'catalog_source_id') = 'null'
      or (
        pg_catalog.jsonb_typeof(p_payload -> 'catalog_source_id') = 'string'
        and private.sync_uuid_is_valid(p_payload ->> 'catalog_source_id')
      )
    )
    and (
      pg_catalog.jsonb_typeof(p_payload -> 'catalog_match_quality') = 'null'
      or (
        pg_catalog.jsonb_typeof(p_payload -> 'catalog_match_quality') = 'string'
        and p_payload ->> 'catalog_match_quality'
          in ('verified', 'usable', 'limited', 'unverified', 'blocked', 'manual')
      )
    )
    and (
      pg_catalog.jsonb_typeof(p_payload -> 'catalog_source_snapshot_date') = 'null'
      or (
        pg_catalog.jsonb_typeof(p_payload -> 'catalog_source_snapshot_date') = 'string'
        and private.sync_date_is_valid(p_payload ->> 'catalog_source_snapshot_date')
      )
    )
    and (
      pg_catalog.jsonb_typeof(p_payload -> 'opened_at') = 'null'
      or (
        pg_catalog.jsonb_typeof(p_payload -> 'opened_at') = 'string'
        and private.sync_date_is_valid(p_payload ->> 'opened_at')
      )
    )
    and (
      pg_catalog.jsonb_typeof(p_payload -> 'expiry_date') = 'null'
      or (
        pg_catalog.jsonb_typeof(p_payload -> 'expiry_date') = 'string'
        and private.sync_date_is_valid(p_payload ->> 'expiry_date')
      )
    )
    and (
      pg_catalog.jsonb_typeof(p_payload -> 'finished_at') = 'null'
      or (
        pg_catalog.jsonb_typeof(p_payload -> 'finished_at') = 'string'
        and private.sync_date_is_valid(p_payload ->> 'finished_at')
      )
    )
    and (
      pg_catalog.jsonb_typeof(p_payload -> 'source_disclosure_ack_at') = 'null'
      or (
        pg_catalog.jsonb_typeof(p_payload -> 'source_disclosure_ack_at') = 'string'
        and private.sync_instant_is_valid(p_payload ->> 'source_disclosure_ack_at')
      )
    )
    and (
      pg_catalog.jsonb_typeof(p_payload -> 'pao_months') = 'null'
      or (
        pg_catalog.jsonb_typeof(p_payload -> 'pao_months') = 'number'
        and private.sync_bounded_integer_is_valid(
          p_payload ->> 'pao_months',
          1,
          120
        )
      )
    )
    and pg_catalog.jsonb_typeof(p_payload -> 'is_opened') = 'boolean'
    and pg_catalog.jsonb_typeof(p_payload -> 'pao_source') = 'string'
    and p_payload ->> 'pao_source'
      in ('label', 'catalog', 'category_default', 'unknown')
    and pg_catalog.jsonb_typeof(p_payload -> 'expiry_source') = 'string'
    and p_payload ->> 'expiry_source'
      in ('printed', 'pao_computed', 'estimated', 'unknown')
    and pg_catalog.jsonb_typeof(p_payload -> 'added_via') = 'string'
    and p_payload ->> 'added_via'
      in ('barcode', 'search', 'ocr', 'manual', 'onboarding')
    and pg_catalog.jsonb_typeof(p_payload -> 'status') = 'string'
    and p_payload ->> 'status' in ('active', 'finished', 'discarded')
  );
end;
$$;

create or replace function private.shelf_payload_provenance_is_valid(p_payload jsonb)
returns boolean
language sql
immutable
security definer
set search_path = ''
as $$
  select (
      (p_payload -> 'catalog_product_id') = 'null'::jsonb
      and (p_payload -> 'catalog_source_id') = 'null'::jsonb
      and (p_payload -> 'catalog_source_snapshot_date') = 'null'::jsonb
      and (
        (p_payload -> 'catalog_match_quality') = 'null'::jsonb
        or p_payload ->> 'catalog_match_quality' = 'manual'
      )
    )
    or (
      (p_payload -> 'catalog_product_id') <> 'null'::jsonb
      and (p_payload -> 'catalog_source_id') <> 'null'::jsonb
      and (p_payload -> 'catalog_source_snapshot_date') <> 'null'::jsonb
      and (p_payload -> 'source_disclosure_ack_at') <> 'null'::jsonb
      and p_payload ->> 'catalog_match_quality'
        in ('verified', 'usable', 'limited', 'unverified', 'blocked')
    )
$$;

revoke all on function private.sync_uuid_is_valid(text)
  from public, anon, authenticated, service_role;
revoke all on function private.sync_uuid_v4_is_valid(text)
  from public, anon, authenticated, service_role;
revoke all on function private.sync_date_is_valid(text)
  from public, anon, authenticated, service_role;
revoke all on function private.sync_instant_is_valid(text)
  from public, anon, authenticated, service_role;
revoke all on function private.sync_bounded_integer_is_valid(text, integer, integer)
  from public, anon, authenticated, service_role;
revoke all on function private.sync_sha256(text, jsonb)
  from public, anon, authenticated, service_role;
revoke all on function private.shelf_sync_response(text, text, text)
  from public, anon, authenticated, service_role;
revoke all on function private.completion_sync_response(text, text, text)
  from public, anon, authenticated, service_role;
revoke all on function private.shelf_payload_is_valid(jsonb)
  from public, anon, authenticated, service_role;
revoke all on function private.shelf_payload_provenance_is_valid(jsonb)
  from public, anon, authenticated, service_role;

-- Identity updates are a health-purpose write even when the active content row
-- has already been removed.
create or replace function private.guard_shelf_product_identity_health_write()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if tg_op = 'UPDATE' and old.user_id is distinct from new.user_id then
    raise exception 'HEALTH_PROCESSING_OWNER_IMMUTABLE' using errcode = '22023';
  end if;
  perform public._assert_health_processing_active_locked(new.user_id);
  return new;
end;
$$;

revoke all on function private.guard_shelf_product_identity_health_write()
  from public, anon, authenticated, service_role;

create trigger trg_shelf_product_identities_health_write
  before insert or update on public.shelf_product_identities
  for each row execute function private.guard_shelf_product_identity_health_write();

-- Existing withdrawal cleanup deletes routines before products. These two
-- statement/row hooks remove both already-tombstoned identities and the active
-- identities whose content is deleted by that established cleanup sequence.
create or replace function private.cleanup_tombstoned_shelf_identities_after_routine_delete()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_owner_text text := pg_catalog.current_setting('app.health_purge', true);
  v_owner uuid;
begin
  if v_owner_text is null
     or v_owner_text !~ '^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$' then
    return null;
  end if;
  v_owner := v_owner_text::uuid;
  delete from public.shelf_product_identities as identities
   where identities.user_id = v_owner
     and not exists (
       select 1 from public.user_products as products
        where products.id = identities.id
     )
     and not exists (
       select 1 from public.routine_steps as steps
        where steps.user_product_id = identities.id
     );
  return null;
end;
$$;

create or replace function private.cleanup_shelf_identity_after_content_delete()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if pg_catalog.pg_trigger_depth() > 1 then
    return null;
  end if;
  if public._health_purge_context_active(old.user_id)
     or not exists (select 1 from auth.users as users where users.id = old.user_id)
     or exists (
       select 1 from public.account_deletion_barriers as barriers
        where barriers.user_id = old.user_id
     ) then
    delete from public.shelf_product_identities as identities
     where identities.id = old.id
       and identities.user_id = old.user_id;
  end if;
  return null;
end;
$$;

revoke all on function private.cleanup_tombstoned_shelf_identities_after_routine_delete()
  from public, anon, authenticated, service_role;
revoke all on function private.cleanup_shelf_identity_after_content_delete()
  from public, anon, authenticated, service_role;

create trigger trg_routines_cleanup_tombstoned_shelf_identities
  after delete on public.routines
  for each statement
  execute function private.cleanup_tombstoned_shelf_identities_after_routine_delete();

create trigger trg_user_products_cleanup_shelf_identity
  after delete on public.user_products
  for each row execute function private.cleanup_shelf_identity_after_content_delete();

-- ---------------------------------------------------------------------------
-- Shelf mirror RPC
-- ---------------------------------------------------------------------------

create or replace function public.sync_shelf_product(
  p_operation_id text,
  p_operation_kind text,
  p_enqueued_at text,
  p_product_id text,
  p_payload jsonb
)
returns jsonb
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v_user_id uuid := (select auth.uid());
  v_operation_id uuid;
  v_product_id uuid;
  v_enqueued_at timestamptz;
  v_request_sha256 text;
  v_existing private.shelf_sync_operations%rowtype;
  v_identity public.shelf_product_identities%rowtype;
  v_inserted boolean := false;
  v_max_completion timestamptz;
  v_effective_delete timestamptz;
begin
  if v_user_id is null then
    raise exception 'SHELF_SYNC_SESSION_REJECTED' using errcode = '28000';
  end if;

  perform pg_catalog.pg_advisory_xact_lock(
    public._account_deletion_advisory_key(v_user_id)
  );
  perform public._assert_current_health_session(v_user_id);
  perform public._assert_health_processing_active_locked(v_user_id);
  if not public._account_access_allowed(v_user_id) then
    raise exception 'ACCOUNT_ACCESS_DENIED' using errcode = '42501';
  end if;

  if private.sync_uuid_v4_is_valid(p_operation_id) is not true then
    return private.shelf_sync_response(
      p_operation_id, 'terminal', 'SHELF_PRODUCT_PAYLOAD_INVALID'
    );
  end if;
  if private.sync_uuid_v4_is_valid(p_product_id) is not true then
    return private.shelf_sync_response(
      p_operation_id, 'terminal', 'SHELF_PRODUCT_ID_INVALID'
    );
  end if;
  if p_operation_kind is null
     or p_operation_kind not in ('upsert', 'delete') then
    return private.shelf_sync_response(
      p_operation_id, 'terminal', 'SHELF_PRODUCT_PAYLOAD_INVALID'
    );
  end if;
  if private.sync_instant_is_valid(p_enqueued_at) is not true then
    return private.shelf_sync_response(
      p_operation_id, 'terminal', 'SHELF_PRODUCT_PAYLOAD_INVALID'
    );
  end if;
  begin
    v_enqueued_at := p_enqueued_at::timestamptz;
  exception when others then
    return private.shelf_sync_response(
      p_operation_id, 'terminal', 'SHELF_PRODUCT_PAYLOAD_INVALID'
    );
  end;
  if v_enqueued_at > pg_catalog.statement_timestamp() + interval '1 day' then
    return private.shelf_sync_response(
      p_operation_id, 'terminal', 'SHELF_PRODUCT_PAYLOAD_INVALID'
    );
  end if;
  if (
       p_operation_kind = 'upsert'
       and (
         private.shelf_payload_is_valid(p_payload) is not true
         or p_payload ->> 'id' is distinct from p_product_id
       )
     )
     or (p_operation_kind = 'delete' and p_payload is not null) then
    return private.shelf_sync_response(
      p_operation_id, 'terminal', 'SHELF_PRODUCT_PAYLOAD_INVALID'
    );
  end if;

  v_operation_id := p_operation_id::uuid;
  v_product_id := p_product_id::uuid;
  v_request_sha256 := private.sync_sha256(
    'onskin/shelf-sync/v1',
    pg_catalog.jsonb_build_object(
      'operationId', p_operation_id,
      'operationKind', p_operation_kind,
      'enqueuedAt', p_enqueued_at,
      'productId', p_product_id,
      'payload', p_payload
    )
  );

  insert into private.shelf_sync_operations (
    operation_id, user_id, request_sha256, state
  ) values (
    v_operation_id, v_user_id, v_request_sha256, 'pending'
  )
  on conflict (operation_id) do nothing
  returning true into v_inserted;

  select operations.* into v_existing
    from private.shelf_sync_operations as operations
   where operations.operation_id = v_operation_id
   for update;

  if v_existing.user_id is distinct from v_user_id
     or v_existing.request_sha256 is distinct from v_request_sha256 then
    return private.shelf_sync_response(
      p_operation_id, 'terminal', 'SHELF_PRODUCT_OWNERSHIP_CONFLICT'
    );
  end if;
  if v_existing.state = 'accepted' then
    return private.shelf_sync_response(p_operation_id, 'idempotent', null);
  end if;
  if v_existing.state = 'terminal' then
    return private.shelf_sync_response(
      p_operation_id, 'terminal', v_existing.result_code
    );
  end if;

  if p_operation_kind = 'upsert'
     and private.shelf_payload_provenance_is_valid(p_payload) is not true then
    update private.shelf_sync_operations as operations
       set state = 'terminal',
           result_code = 'SHELF_PRODUCT_PROVENANCE_INVALID',
           finalized_at = pg_catalog.statement_timestamp()
     where operations.operation_id = v_operation_id;
    return private.shelf_sync_response(
      p_operation_id, 'terminal', 'SHELF_PRODUCT_PROVENANCE_INVALID'
    );
  end if;

  select identities.* into v_identity
    from public.shelf_product_identities as identities
   where identities.id = v_product_id
   for update;

  if v_identity.id is not null and v_identity.user_id is distinct from v_user_id then
    update private.shelf_sync_operations as operations
       set state = 'terminal',
           result_code = 'SHELF_PRODUCT_OWNERSHIP_CONFLICT',
           finalized_at = pg_catalog.statement_timestamp()
     where operations.operation_id = v_operation_id;
    return private.shelf_sync_response(
      p_operation_id, 'terminal', 'SHELF_PRODUCT_OWNERSHIP_CONFLICT'
    );
  end if;

  if p_operation_kind = 'delete' then
    if v_identity.id is null then
      begin
        -- Deletion wins even if an earlier upsert was terminal or never reached
        -- the server. Retain only the stable owner/tombstone identity so a
        -- delayed pre-cutoff completion can still reconcile and resurrection
        -- cannot occur.
        insert into public.shelf_product_identities (
          id,
          user_id,
          deleted_effective_at,
          deleted_received_at
        ) values (
          v_product_id,
          v_user_id,
          v_enqueued_at,
          pg_catalog.statement_timestamp()
        );
      exception when unique_violation then
        update private.shelf_sync_operations as operations
           set state = 'terminal',
               result_code = 'SHELF_PRODUCT_OWNERSHIP_CONFLICT',
               finalized_at = pg_catalog.statement_timestamp()
         where operations.operation_id = v_operation_id;
        return private.shelf_sync_response(
          p_operation_id, 'terminal', 'SHELF_PRODUCT_OWNERSHIP_CONFLICT'
        );
      end;
      v_identity.id := v_product_id;
      v_identity.user_id := v_user_id;
      v_identity.deleted_effective_at := v_enqueued_at;
    end if;
    if v_identity.deleted_effective_at is null then
      select pg_catalog.max(completions.completed_at)
        into v_max_completion
        from public.routine_steps as steps
        join public.routines as routines
          on routines.id = steps.routine_id
         and routines.user_id = v_user_id
        join public.routine_completions as completions
          on completions.step_id = steps.id
         and completions.routine_id = routines.id
         and completions.user_id = v_user_id
       where steps.user_product_id = v_product_id;

      v_effective_delete := greatest(
        v_enqueued_at,
        v_max_completion
      );
      update public.shelf_product_identities as identities
         set deleted_effective_at = v_effective_delete,
             deleted_received_at = pg_catalog.statement_timestamp()
       where identities.id = v_product_id
         and identities.user_id = v_user_id;

      -- Deleting active content intentionally cascades ephemeral ramp/conflict
      -- projections but no longer erases routine-step/completion identity.
      delete from public.user_products as products
       where products.id = v_product_id
         and products.user_id = v_user_id;
    end if;
  else
    if v_identity.id is not null and v_identity.deleted_effective_at is not null then
      update private.shelf_sync_operations as operations
         set state = 'terminal',
             result_code = 'SHELF_PRODUCT_OWNERSHIP_CONFLICT',
             finalized_at = pg_catalog.statement_timestamp()
       where operations.operation_id = v_operation_id;
      return private.shelf_sync_response(
        p_operation_id, 'terminal', 'SHELF_PRODUCT_OWNERSHIP_CONFLICT'
      );
    end if;

    begin
      if v_identity.id is null then
        begin
          insert into public.shelf_product_identities (id, user_id)
          values (v_product_id, v_user_id);
        exception when unique_violation then
          -- Owner locks serialize a user's queue but two different owners may
          -- race on a globally supplied product UUID. The loser is an ownership
          -- conflict, never a payload/provenance failure.
          update private.shelf_sync_operations as operations
             set state = 'terminal',
                 result_code = 'SHELF_PRODUCT_OWNERSHIP_CONFLICT',
                 finalized_at = pg_catalog.statement_timestamp()
           where operations.operation_id = v_operation_id;
          return private.shelf_sync_response(
            p_operation_id, 'terminal', 'SHELF_PRODUCT_OWNERSHIP_CONFLICT'
          );
        end;
      end if;

      if exists (
        select 1 from public.user_products as products
         where products.id = v_product_id
           and products.user_id is distinct from v_user_id
      ) then
        raise exception 'SHELF_PRODUCT_OWNER_INVALID' using errcode = '23514';
      end if;

      insert into public.user_products (
        id,
        user_id,
        catalog_product_id,
        catalog_source_id,
        catalog_match_quality,
        catalog_source_snapshot_date,
        manual_name,
        manual_brand,
        barcode,
        opened_at,
        pao_months,
        expiry_date,
        is_opened,
        pao_source,
        expiry_source,
        added_via,
        source_disclosure_ack_at,
        status,
        finished_at
      ) values (
        v_product_id,
        v_user_id,
        (p_payload ->> 'catalog_product_id')::uuid,
        (p_payload ->> 'catalog_source_id')::uuid,
        p_payload ->> 'catalog_match_quality',
        (p_payload ->> 'catalog_source_snapshot_date')::date,
        p_payload ->> 'manual_name',
        p_payload ->> 'manual_brand',
        p_payload ->> 'barcode',
        (p_payload ->> 'opened_at')::date,
        (p_payload ->> 'pao_months')::integer,
        (p_payload ->> 'expiry_date')::date,
        (p_payload ->> 'is_opened')::boolean,
        p_payload ->> 'pao_source',
        p_payload ->> 'expiry_source',
        p_payload ->> 'added_via',
        (p_payload ->> 'source_disclosure_ack_at')::timestamptz,
        p_payload ->> 'status',
        (p_payload ->> 'finished_at')::date
      )
      on conflict (id) do update
         set catalog_product_id = excluded.catalog_product_id,
             catalog_source_id = excluded.catalog_source_id,
             catalog_match_quality = excluded.catalog_match_quality,
             catalog_source_snapshot_date = excluded.catalog_source_snapshot_date,
             manual_name = excluded.manual_name,
             manual_brand = excluded.manual_brand,
             barcode = excluded.barcode,
             opened_at = excluded.opened_at,
             pao_months = excluded.pao_months,
             expiry_date = excluded.expiry_date,
             is_opened = excluded.is_opened,
             pao_source = excluded.pao_source,
             expiry_source = excluded.expiry_source,
             added_via = excluded.added_via,
             source_disclosure_ack_at = excluded.source_disclosure_ack_at,
             status = excluded.status,
             finished_at = excluded.finished_at
       where public.user_products.user_id = excluded.user_id;
    exception
      when foreign_key_violation or check_violation
        or not_null_violation or invalid_text_representation then
        update private.shelf_sync_operations as operations
           set state = 'terminal',
               result_code = 'SHELF_PRODUCT_PROVENANCE_INVALID',
               finalized_at = pg_catalog.statement_timestamp()
         where operations.operation_id = v_operation_id;
        return private.shelf_sync_response(
          p_operation_id, 'terminal', 'SHELF_PRODUCT_PROVENANCE_INVALID'
        );
    end;
  end if;

  update private.shelf_sync_operations as operations
     set state = 'accepted',
         result_code = null,
         finalized_at = pg_catalog.statement_timestamp()
   where operations.operation_id = v_operation_id;
  return private.shelf_sync_response(p_operation_id, 'accepted', null);
end;
$$;

revoke all on function public.sync_shelf_product(text, text, text, text, jsonb)
  from public, anon, service_role;
grant execute on function public.sync_shelf_product(text, text, text, text, jsonb)
  to authenticated;

-- ---------------------------------------------------------------------------
-- Routine completion RPC
-- ---------------------------------------------------------------------------

create or replace function public.record_routine_completion(
  p_event_id text,
  p_routine_id text,
  p_routine_type text,
  p_step_id text,
  p_user_product_id text,
  p_step_order integer,
  p_completed_at text,
  p_completed_date text,
  p_timezone text
)
returns jsonb
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v_user_id uuid := (select auth.uid());
  v_event_id uuid;
  v_routine_id uuid;
  v_step_id uuid;
  v_product_id uuid;
  v_completed_at timestamptz;
  v_completed_date date;
  v_request_sha256 text;
  v_existing private.routine_completion_sync_operations%rowtype;
  v_identity public.shelf_product_identities%rowtype;
  v_routine public.routines%rowtype;
  v_step public.routine_steps%rowtype;
  v_marker boolean;
  v_inserted boolean := false;
  v_write_stage text := 'none';
begin
  if v_user_id is null then
    raise exception 'COMPLETION_SYNC_SESSION_REJECTED' using errcode = '28000';
  end if;

  perform pg_catalog.pg_advisory_xact_lock(
    public._account_deletion_advisory_key(v_user_id)
  );
  perform public._assert_current_health_session(v_user_id);
  perform public._assert_health_processing_active_locked(v_user_id);
  if not public._account_access_allowed(v_user_id) then
    raise exception 'ACCOUNT_ACCESS_DENIED' using errcode = '42501';
  end if;

  v_marker := p_step_id is null
    and p_user_product_id is null
    and p_step_order is null;
  if private.sync_uuid_v4_is_valid(p_event_id) is not true
     or private.sync_uuid_v4_is_valid(p_routine_id) is not true
     or p_routine_type is null
     or p_routine_type not in ('AM', 'PM') then
    return private.completion_sync_response(
      p_event_id, 'terminal', 'COMPLETION_REQUEST_INVALID'
    );
  end if;
  if private.sync_instant_is_valid(p_completed_at) is not true
     or private.sync_date_is_valid(p_completed_date) is not true
     or private.routine_adherence_timezone_is_valid(p_timezone) is not true then
    return private.completion_sync_response(
      p_event_id, 'terminal', 'COMPLETION_REQUEST_INVALID'
    );
  end if;
  if (
       not v_marker
       and (
         private.sync_uuid_v4_is_valid(p_step_id) is not true
         or private.sync_uuid_v4_is_valid(p_user_product_id) is not true
         or p_step_order is null
         or p_step_order not between 1 and 100
       )
     )
     or (v_marker and p_routine_type <> 'PM') then
    return private.completion_sync_response(
      p_event_id, 'terminal', 'COMPLETION_REQUEST_INVALID'
    );
  end if;

  begin
    v_completed_at := p_completed_at::timestamptz;
    v_completed_date := p_completed_date::date;
  exception when others then
    return private.completion_sync_response(
      p_event_id, 'terminal', 'COMPLETION_REQUEST_INVALID'
    );
  end;
  if v_completed_at < pg_catalog.statement_timestamp() - interval '4 days'
     or v_completed_at > pg_catalog.statement_timestamp() + interval '1 day'
     or v_completed_date is distinct from
       (v_completed_at at time zone p_timezone)::date then
    return private.completion_sync_response(
      p_event_id, 'terminal', 'COMPLETION_REQUEST_INVALID'
    );
  end if;

  v_event_id := p_event_id::uuid;
  v_routine_id := p_routine_id::uuid;
  v_step_id := p_step_id::uuid;
  v_product_id := p_user_product_id::uuid;
  v_request_sha256 := private.sync_sha256(
    'onskin/routine-completion-sync/v1',
    pg_catalog.jsonb_build_object(
      'eventId', p_event_id,
      'routineId', p_routine_id,
      'routineType', p_routine_type,
      'stepId', p_step_id,
      'userProductId', p_user_product_id,
      'stepOrder', p_step_order,
      'completedAt', p_completed_at,
      'completedDate', p_completed_date,
      'timezone', p_timezone
    )
  );

  insert into private.routine_completion_sync_operations (
    event_id, user_id, request_sha256, state
  ) values (
    v_event_id, v_user_id, v_request_sha256, 'pending'
  )
  on conflict (event_id) do nothing
  returning true into v_inserted;

  select operations.* into v_existing
    from private.routine_completion_sync_operations as operations
   where operations.event_id = v_event_id
   for update;

  if v_existing.user_id is distinct from v_user_id
     or v_existing.request_sha256 is distinct from v_request_sha256 then
    return private.completion_sync_response(
      p_event_id, 'terminal', 'COMPLETION_EVENT_CONFLICT'
    );
  end if;
  if v_existing.state = 'accepted' then
    return private.completion_sync_response(p_event_id, 'idempotent', null);
  end if;
  if v_existing.state = 'terminal' then
    return private.completion_sync_response(
      p_event_id, 'terminal', v_existing.result_code
    );
  end if;

  if not v_marker then
    select identities.* into v_identity
      from public.shelf_product_identities as identities
     where identities.id = v_product_id
     for update;
    if v_identity.id is null then
      return private.completion_sync_response(
        p_event_id, 'retryable', 'COMPLETION_PRODUCT_RETRY_LATER'
      );
    end if;
    if v_identity.user_id is distinct from v_user_id then
      update private.routine_completion_sync_operations as operations
         set state = 'terminal',
             result_code = 'COMPLETION_IDENTITY_CONFLICT',
             finalized_at = pg_catalog.statement_timestamp()
       where operations.event_id = v_event_id;
      return private.completion_sync_response(
        p_event_id, 'terminal', 'COMPLETION_IDENTITY_CONFLICT'
      );
    end if;
    if v_identity.deleted_effective_at is not null
       and v_completed_at > v_identity.deleted_effective_at then
      update private.routine_completion_sync_operations as operations
         set state = 'terminal',
             result_code = 'COMPLETION_AFTER_PRODUCT_DELETION',
             finalized_at = pg_catalog.statement_timestamp()
       where operations.event_id = v_event_id;
      return private.completion_sync_response(
        p_event_id, 'terminal', 'COMPLETION_AFTER_PRODUCT_DELETION'
      );
    end if;
  end if;

  select routines.* into v_routine
    from public.routines as routines
   where routines.id = v_routine_id
   for update;
  if v_routine.id is not null
     and (
       v_routine.user_id is distinct from v_user_id
       or v_routine.type is distinct from p_routine_type
     ) then
    update private.routine_completion_sync_operations as operations
       set state = 'terminal',
           result_code = 'COMPLETION_IDENTITY_CONFLICT',
           finalized_at = pg_catalog.statement_timestamp()
     where operations.event_id = v_event_id;
    return private.completion_sync_response(
      p_event_id, 'terminal', 'COMPLETION_IDENTITY_CONFLICT'
    );
  end if;

  if v_marker then
    if v_routine.id is null
       or not exists (
         select 1
           from public.routine_completions as completions
          where completions.user_id = v_user_id
            and completions.routine_id = v_routine_id
            and completions.step_id is not null
            and completions.completed_date = v_completed_date
            and completions.completed_at = v_completed_at
       ) then
      update private.routine_completion_sync_operations as operations
         set state = 'terminal',
             result_code = 'COMPLETION_REQUEST_INVALID',
             finalized_at = pg_catalog.statement_timestamp()
       where operations.event_id = v_event_id;
      return private.completion_sync_response(
        p_event_id, 'terminal', 'COMPLETION_REQUEST_INVALID'
      );
    end if;
  else
    select steps.* into v_step
      from public.routine_steps as steps
     where steps.id = v_step_id
     for update;
    if v_step.id is not null
       and (
         v_step.routine_id is distinct from v_routine_id
         or v_step.user_product_id is distinct from v_product_id
         or v_step.step_order is distinct from p_step_order
       ) then
      update private.routine_completion_sync_operations as operations
         set state = 'terminal',
             result_code = 'COMPLETION_IDENTITY_CONFLICT',
             finalized_at = pg_catalog.statement_timestamp()
       where operations.event_id = v_event_id;
      return private.completion_sync_response(
        p_event_id, 'terminal', 'COMPLETION_IDENTITY_CONFLICT'
      );
    end if;
  end if;

  -- Only this RPC's digest ledger can establish idempotency. A pre-existing
  -- relational event ID or null-safe semantic uniqueness key is a conflict,
  -- including legacy rows that predate this ledger.
  if exists (
    select 1
      from public.routine_completions as completions
     where completions.id = v_event_id
        or (
          completions.user_id = v_user_id
          and completions.step_id is not distinct from v_step_id
          and completions.completed_date = v_completed_date
        )
  ) then
    update private.routine_completion_sync_operations as operations
       set state = 'terminal',
           result_code = 'COMPLETION_EVENT_CONFLICT',
           finalized_at = pg_catalog.statement_timestamp()
     where operations.event_id = v_event_id;
    return private.completion_sync_response(
      p_event_id, 'terminal', 'COMPLETION_EVENT_CONFLICT'
    );
  end if;

  -- Configure timezone and perform all relational writes in one exception
  -- subtransaction. A late uniqueness/FK race rolls the timezone/profile/cache
  -- mutation back before a terminal outcome is recorded.
  begin
    perform projection.current_streak
      from public.set_routine_adherence_timezone(p_timezone) as projection;

    if not v_marker then
      if v_routine.id is null then
        v_write_stage := 'routine';
        insert into public.routines (
          id, user_id, type, name, is_active
        ) values (
          v_routine_id, v_user_id, p_routine_type, null, true
        );
      end if;

      if v_step.id is null then
        v_write_stage := 'step';
        insert into public.routine_steps (
          id,
          routine_id,
          user_product_id,
          step_order,
          frequency,
          cycling_night,
          instructions
        ) values (
          v_step_id,
          v_routine_id,
          v_product_id,
          p_step_order,
          'daily',
          null,
          null
        );
      end if;
    end if;

    v_write_stage := 'completion';
    insert into public.routine_completions (
      id,
      user_id,
      routine_id,
      step_id,
      completed_at,
      completed_date
    ) values (
      v_event_id,
      v_user_id,
      v_routine_id,
      v_step_id,
      v_completed_at,
      v_completed_date
    );
  exception when unique_violation or foreign_key_violation then
    update private.routine_completion_sync_operations as operations
      set state = 'terminal',
          result_code = case
            when v_write_stage = 'completion' then 'COMPLETION_EVENT_CONFLICT'
            else 'COMPLETION_IDENTITY_CONFLICT'
          end,
          finalized_at = pg_catalog.statement_timestamp()
    where operations.event_id = v_event_id;
    return private.completion_sync_response(
      p_event_id,
      'terminal',
      case
        when v_write_stage = 'completion' then 'COMPLETION_EVENT_CONFLICT'
        else 'COMPLETION_IDENTITY_CONFLICT'
      end
    );
  end;

  update private.routine_completion_sync_operations as operations
     set state = 'accepted',
         result_code = null,
         finalized_at = pg_catalog.statement_timestamp()
   where operations.event_id = v_event_id;
  return private.completion_sync_response(p_event_id, 'accepted', null);
end;
$$;

revoke all on function public.record_routine_completion(
  text, text, text, text, text, integer, text, text, text
) from public, anon, service_role;
grant execute on function public.record_routine_completion(
  text, text, text, text, text, integer, text, text, text
) to authenticated;

comment on function public.record_routine_completion(
  text, text, text, text, text, integer, text, text, text
) is
  'Owner-derived completion intake. A PM row with null step/product/order is the user''s routine-complete attestation and is accepted only after an exact same-routine/date/time step row; it is not objective proof that skincare was performed.';

-- ---------------------------------------------------------------------------
-- Subject-bound data export
-- ---------------------------------------------------------------------------
-- The identity relation and replay ledgers are deliberately sealed from every
-- API role. Data-rights export therefore uses three narrow projections derived
-- exclusively from auth.uid(). The request digests remain internal integrity
-- metadata: exporting them would disclose a guessable fingerprint of deleted
-- health-purpose payloads without helping the subject understand the receipt.

create index shelf_product_identities_owner_export_keyset_idx
  on public.shelf_product_identities (user_id, created_at, id);

create index shelf_sync_operations_owner_export_keyset_idx
  on private.shelf_sync_operations (user_id, created_at, operation_id);

create index routine_completion_sync_owner_export_keyset_idx
  on private.routine_completion_sync_operations (user_id, created_at, event_id);

create or replace function private.authorize_health_sync_export_subject()
returns uuid
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v_user_id uuid := auth.uid();
  v_is_anonymous boolean;
  v_health_state text;
begin
  select coalesce(
           (pg_catalog.to_jsonb(account_user) ->> 'is_anonymous')::boolean,
           false
         )
    into v_is_anonymous
    from auth.users as account_user
   where account_user.id = v_user_id;

  if v_user_id is null
     or auth.jwt() ->> 'role' is distinct from 'authenticated'
     or coalesce(
          auth.jwt() ->> 'is_anonymous', 'false'
        ) is distinct from 'false'
     or v_is_anonymous is distinct from false then
    raise exception 'HEALTH_SYNC_EXPORT_OWNER_REQUIRED'
      using errcode = '42501';
  end if;

  perform pg_catalog.pg_advisory_xact_lock(
    public._account_deletion_advisory_key(v_user_id)
  );
  perform public._assert_current_health_session(v_user_id);
  if not public._account_access_allowed(v_user_id)
     or exists (
       select 1
         from public.account_deletion_barriers as barriers
        where barriers.user_id = v_user_id
     ) then
    raise exception 'ACCOUNT_ACCESS_DENIED' using errcode = '42501';
  end if;

  select states.state
    into v_health_state
    from public.health_processing_states as states
   where states.user_id = v_user_id;
  if v_health_state is null then
    raise exception 'HEALTH_SYNC_EXPORT_LIFECYCLE_UNAVAILABLE'
      using errcode = '55000';
  end if;
  if v_health_state = 'withdrawing' then
    raise exception 'HEALTH_SYNC_EXPORT_WITHDRAWAL_IN_PROGRESS'
      using errcode = '55000';
  end if;
  if v_health_state = 'active' then
    perform public._assert_health_processing_epoch_locked(
      v_user_id,
      public._request_health_processing_epoch()
    );
  end if;

  return v_user_id;
end;
$$;

revoke all on function private.authorize_health_sync_export_subject()
  from public, anon, authenticated, service_role;

create or replace function public.export_shelf_product_identities_for_subject(
  p_after_created_at timestamptz,
  p_after_id uuid,
  p_limit integer
)
returns table (
  export_total_count bigint,
  id uuid,
  user_id uuid,
  created_at timestamptz,
  deleted_effective_at timestamptz,
  deleted_received_at timestamptz
)
language plpgsql
volatile
security definer
set search_path = ''
set timezone = 'UTC'
as $$
declare
  v_user_id uuid;
  v_health_state text;
begin
  if p_limit is null or p_limit not between 1 and 500
     or ((p_after_created_at is null) <> (p_after_id is null))
     or (
       p_after_created_at is not null
       and not pg_catalog.isfinite(p_after_created_at)
     ) then
    raise exception 'HEALTH_SYNC_EXPORT_INPUT_INVALID'
      using errcode = '22023';
  end if;

  v_user_id := private.authorize_health_sync_export_subject();
  select states.state
    into v_health_state
    from public.health_processing_states as states
   where states.user_id = v_user_id;
  if v_health_state <> 'active' then
    if exists (
      select 1
        from public.shelf_product_identities as identity_row
       where identity_row.user_id = v_user_id
    ) then
      raise exception 'HEALTH_SYNC_EXPORT_NONACTIVE_RESIDUE'
        using errcode = '55000';
    end if;
    return;
  end if;

  return query
  with owned_rows as materialized (
    select pg_catalog.count(*) over () as total_count,
           identity_row.id,
           identity_row.user_id,
           identity_row.created_at,
           identity_row.deleted_effective_at,
           identity_row.deleted_received_at
      from public.shelf_product_identities as identity_row
     where identity_row.user_id = v_user_id
  )
  select owned.total_count,
         owned.id,
         owned.user_id,
         owned.created_at,
         owned.deleted_effective_at,
         owned.deleted_received_at
    from owned_rows as owned
   where p_after_created_at is null
      or (owned.created_at, owned.id) > (p_after_created_at, p_after_id)
   order by owned.created_at, owned.id
   limit p_limit;
end;
$$;

create or replace function public.export_shelf_sync_receipts_for_subject(
  p_after_created_at timestamptz,
  p_after_id uuid,
  p_limit integer
)
returns table (
  export_total_count bigint,
  operation_id uuid,
  user_id uuid,
  state text,
  result_code text,
  created_at timestamptz,
  finalized_at timestamptz
)
language plpgsql
volatile
security definer
set search_path = ''
set timezone = 'UTC'
as $$
declare
  v_user_id uuid;
  v_health_state text;
begin
  if p_limit is null or p_limit not between 1 and 500
     or ((p_after_created_at is null) <> (p_after_id is null))
     or (
       p_after_created_at is not null
       and not pg_catalog.isfinite(p_after_created_at)
     ) then
    raise exception 'HEALTH_SYNC_EXPORT_INPUT_INVALID'
      using errcode = '22023';
  end if;

  v_user_id := private.authorize_health_sync_export_subject();
  select states.state
    into v_health_state
    from public.health_processing_states as states
   where states.user_id = v_user_id;
  if v_health_state <> 'active' then
    if exists (
      select 1
        from private.shelf_sync_operations as receipt
       where receipt.user_id = v_user_id
    ) then
      raise exception 'HEALTH_SYNC_EXPORT_NONACTIVE_RESIDUE'
        using errcode = '55000';
    end if;
    return;
  end if;

  return query
  with owned_rows as materialized (
    select pg_catalog.count(*) over () as total_count,
           receipt.operation_id,
           receipt.user_id,
           receipt.state,
           receipt.result_code,
           receipt.created_at,
           receipt.finalized_at
      from private.shelf_sync_operations as receipt
     where receipt.user_id = v_user_id
  )
  select owned.total_count,
         owned.operation_id,
         owned.user_id,
         owned.state,
         owned.result_code,
         owned.created_at,
         owned.finalized_at
    from owned_rows as owned
   where p_after_created_at is null
      or (owned.created_at, owned.operation_id) > (p_after_created_at, p_after_id)
   order by owned.created_at, owned.operation_id
   limit p_limit;
end;
$$;

create or replace function public.export_routine_completion_sync_receipts_for_subject(
  p_after_created_at timestamptz,
  p_after_id uuid,
  p_limit integer
)
returns table (
  export_total_count bigint,
  event_id uuid,
  user_id uuid,
  state text,
  result_code text,
  created_at timestamptz,
  finalized_at timestamptz
)
language plpgsql
volatile
security definer
set search_path = ''
set timezone = 'UTC'
as $$
declare
  v_user_id uuid;
  v_health_state text;
begin
  if p_limit is null or p_limit not between 1 and 500
     or ((p_after_created_at is null) <> (p_after_id is null))
     or (
       p_after_created_at is not null
       and not pg_catalog.isfinite(p_after_created_at)
     ) then
    raise exception 'HEALTH_SYNC_EXPORT_INPUT_INVALID'
      using errcode = '22023';
  end if;

  v_user_id := private.authorize_health_sync_export_subject();
  select states.state
    into v_health_state
    from public.health_processing_states as states
   where states.user_id = v_user_id;
  if v_health_state <> 'active' then
    if exists (
      select 1
        from private.routine_completion_sync_operations as receipt
       where receipt.user_id = v_user_id
    ) then
      raise exception 'HEALTH_SYNC_EXPORT_NONACTIVE_RESIDUE'
        using errcode = '55000';
    end if;
    return;
  end if;

  return query
  with owned_rows as materialized (
    select pg_catalog.count(*) over () as total_count,
           receipt.event_id,
           receipt.user_id,
           receipt.state,
           receipt.result_code,
           receipt.created_at,
           receipt.finalized_at
      from private.routine_completion_sync_operations as receipt
     where receipt.user_id = v_user_id
  )
  select owned.total_count,
         owned.event_id,
         owned.user_id,
         owned.state,
         owned.result_code,
         owned.created_at,
         owned.finalized_at
    from owned_rows as owned
   where p_after_created_at is null
      or (owned.created_at, owned.event_id) > (p_after_created_at, p_after_id)
   order by owned.created_at, owned.event_id
   limit p_limit;
end;
$$;

comment on function public.export_shelf_product_identities_for_subject(
  timestamptz, uuid, integer
) is
  'Authenticated, non-anonymous, subject-derived and count-guarded keyset export of minimized Shelf identity/tombstone fields; nonactive lifecycle states succeed only after exact zero residue is verified.';
comment on function public.export_shelf_sync_receipts_for_subject(
  timestamptz, uuid, integer
) is
  'Authenticated, non-anonymous, subject-derived and count-guarded keyset export of Shelf sync disposition receipts; internal request fingerprints are excluded and nonactive lifecycle states require exact zero residue.';
comment on function public.export_routine_completion_sync_receipts_for_subject(
  timestamptz, uuid, integer
) is
  'Authenticated, non-anonymous, subject-derived and count-guarded keyset export of completion sync disposition receipts; internal request fingerprints are excluded and nonactive lifecycle states require exact zero residue.';

revoke all on function public.export_shelf_product_identities_for_subject(
  timestamptz, uuid, integer
) from public, anon, authenticated, service_role;
revoke all on function public.export_shelf_sync_receipts_for_subject(
  timestamptz, uuid, integer
) from public, anon, authenticated, service_role;
revoke all on function public.export_routine_completion_sync_receipts_for_subject(
  timestamptz, uuid, integer
) from public, anon, authenticated, service_role;

grant execute on function public.export_shelf_product_identities_for_subject(
  timestamptz, uuid, integer
) to authenticated;
grant execute on function public.export_shelf_sync_receipts_for_subject(
  timestamptz, uuid, integer
) to authenticated;
grant execute on function public.export_routine_completion_sync_receipts_for_subject(
  timestamptz, uuid, integer
) to authenticated;

-- ---------------------------------------------------------------------------
-- Seal every direct API mutation path. SELECT remains owner/read-fenced where
-- the app currently consumes it; all writes now pass through the two RPCs.
-- ---------------------------------------------------------------------------

revoke insert, update, delete, truncate, references, trigger
  on table public.user_products
  from public, anon, authenticated, service_role;
revoke insert, update, delete, truncate, references, trigger
  on table public.shelf_product_identities
  from public, anon, authenticated, service_role;
revoke insert, update, delete, truncate, references, trigger
  on table public.routines
  from public, anon, authenticated, service_role;
revoke insert, update, delete, truncate, references, trigger
  on table public.routine_steps
  from public, anon, authenticated, service_role;
revoke insert, update, delete, truncate, references, trigger
  on table public.routine_completions
  from public, anon, authenticated, service_role;

drop policy if exists "user_products_insert_own" on public.user_products;
drop policy if exists "user_products_update_own" on public.user_products;
drop policy if exists "user_products_delete_own" on public.user_products;
drop policy if exists "routines_insert_own" on public.routines;
drop policy if exists "routines_update_own" on public.routines;
drop policy if exists "routines_delete_own" on public.routines;
drop policy if exists "routine_steps_insert_own" on public.routine_steps;
drop policy if exists "routine_steps_update_own" on public.routine_steps;
drop policy if exists "routine_steps_delete_own" on public.routine_steps;
drop policy if exists "routine_completions_insert_own" on public.routine_completions;

-- Erase the minimized replay ledgers synchronously when health processing enters
-- withdrawal. Existing cleanup then deletes routines before products; the hooks
-- above remove both tombstoned and active stable identities.
create or replace function private.clear_routine_adherence_on_withdrawal()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  delete from private.shelf_sync_operations as operations
   where operations.user_id = new.user_id;
  delete from private.routine_completion_sync_operations as operations
   where operations.user_id = new.user_id;

  perform pg_catalog.set_config(
    'app.health_read_barrier', new.user_id::text, true
  );
  begin
    update public.profiles as profiles
       set current_streak = 0,
           longest_streak = 0,
           adherence_timezone = null,
           streak_reference_day = null,
           streak_algorithm_version = 0,
           updated_at = pg_catalog.statement_timestamp()
     where profiles.id = new.user_id
       and (
         profiles.current_streak <> 0
         or profiles.longest_streak <> 0
         or profiles.adherence_timezone is not null
         or profiles.streak_reference_day is not null
         or profiles.streak_algorithm_version <> 0
       );
  exception when others then
    perform pg_catalog.set_config('app.health_read_barrier', '', true);
    raise;
  end;
  perform pg_catalog.set_config('app.health_read_barrier', '', true);
  return null;
end;
$$;

revoke all on function private.clear_routine_adherence_on_withdrawal()
  from public, anon, authenticated, service_role;

-- Extend exact zero-attestation to the stable identities and minimized replay
-- rows. This deliberately duplicates the v0068 predicate so old cleanup callers
-- use the new function OID without code changes.
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
    or exists (select 1 from public.shelf_product_identities where user_id = p_user_id)
    or exists (select 1 from private.shelf_sync_operations where user_id = p_user_id)
    or exists (
      select 1 from private.routine_completion_sync_operations
       where user_id = p_user_id
    )
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
      select 1
        from public.profiles
       where id = p_user_id
         and (
           current_streak <> 0
           or longest_streak <> 0
           or adherence_timezone is not null
           or streak_reference_day is not null
           or streak_algorithm_version <> 0
         )
    )
  )
$$;

revoke all on function public._health_relational_data_exists(uuid)
  from public, anon, authenticated, service_role;

comment on table public.shelf_product_identities is
  'Minimal owner/product identity retained after Shelf content deletion so queued historical routine evidence can be validated; erased on health withdrawal/account deletion.';
comment on function public.sync_shelf_product(text, text, text, text, jsonb) is
  'Owner-derived authenticated Shelf v1 replay bridge. Raw request payload is never retained in its minimized operation ledger.';
comment on function public.record_routine_completion(
  text, text, text, text, text, integer, text, text, text
) is
  'Owner-derived authenticated completion v1 replay bridge. A PM row with null step/product/order is the user''s routine-complete attestation and is accepted only after an exact same-routine/date/time step row; it is not objective proof that skincare was performed.';

commit;
