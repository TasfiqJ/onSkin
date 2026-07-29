-- =============================================================================
-- 0072 - COM-01A commerce zero-admission boundary
-- =============================================================================
-- No approved first-party paid-link rail, reviewed publication catalogue, or
-- provider correlation contract exists. Retain legacy rows for migration,
-- deletion, and future review, but make them non-publication state. Reopening
-- requires a later forward migration; a runtime flag, credential, consent row,
-- active catalogue row, or service configuration is not admission authority.

begin;

create table private.commerce_admission_control (
  singleton boolean primary key default true check (singleton),
  admission_state text not null default 'closed'
    check (admission_state = 'closed'),
  checkpoint text not null
    check (checkpoint = 'com01a_zero_admission'),
  reason_code text not null
    check (reason_code = 'approved_rail_not_admitted'),
  established_at timestamptz not null
    default pg_catalog.clock_timestamp()
    check (pg_catalog.isfinite(established_at))
);

insert into private.commerce_admission_control (
  singleton,
  admission_state,
  checkpoint,
  reason_code
) values (
  true,
  'closed',
  'com01a_zero_admission',
  'approved_rail_not_admitted'
);

alter table private.commerce_admission_control enable row level security;
alter table private.commerce_admission_control force row level security;

revoke all on table private.commerce_admission_control
  from public, anon, authenticated, service_role;

create or replace function private.guard_commerce_admission_control()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  raise exception 'COMMERCE_ADMISSION_CONTROL_MIGRATION_OWNED'
    using errcode = '55000';
end;
$$;

create trigger commerce_admission_control_immutable
  before update or delete or truncate
  on private.commerce_admission_control
  for each statement
  execute function private.guard_commerce_admission_control();

revoke all on function private.guard_commerce_admission_control()
  from public, anon, authenticated, service_role;

-- Active legacy rows are retained for loss-averse migration-owner review, but
-- no app/API role can publish them. Existing service authority is not broadened.
drop policy if exists "affiliate_links_select_active"
  on public.affiliate_links;
drop policy if exists "creator_stacks_select_active"
  on public.creator_stacks;
drop policy if exists "creator_stack_items_select_all"
  on public.creator_stack_items;

revoke all on table public.affiliate_links
  from public, anon, authenticated;
revoke all on table public.creator_stacks
  from public, anon, authenticated;
revoke all on table public.creator_stack_items
  from public, anon, authenticated;

-- Consent cannot authorize a feature whose rail is not admitted. Remove both
-- permissive insert policies and the table privilege. Preserve owner SELECT and
-- DELETE so installed-base data-rights and explicit cleanup continue to work.
drop policy if exists "commerce_click_events_insert_own"
  on public.commerce_click_events;
drop policy if exists "commerce_click_events_consent_insert"
  on public.commerce_click_events;

revoke all on table public.commerce_click_events
  from public, anon, authenticated;
grant select, delete on table public.commerce_click_events
  to authenticated;

create or replace function private.guard_commerce_click_publication()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  raise exception 'COMMERCE_ADMISSION_CLOSED'
    using errcode = '55000';
end;
$$;

create trigger commerce_click_events_admission_closed
  before insert or update
  on public.commerce_click_events
  for each row
  execute function private.guard_commerce_click_publication();

revoke all on function private.guard_commerce_click_publication()
  from public, anon, authenticated, service_role;

-- A stale deployed poller must not be able to keep publishing order economics
-- after the checked-in handler becomes inert. Remove every runtime table grant,
-- then return only the service-role reads/deletes needed by data rights and the
-- single-column UPDATE privilege needed to detach an installed-base click token.
-- The trigger also binds the row transition so column privilege cannot be used to
-- replace one identifier with another or to change any business field.
revoke all on table public.order_attributions
  from public, anon, authenticated, service_role;
grant select, delete on table public.order_attributions
  to service_role;
grant update (click_token) on table public.order_attributions
  to service_role;

create or replace function private.guard_order_attribution_publication()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if tg_op = 'UPDATE'
     and old.click_token is not null
     and new.click_token is null
     and (
       pg_catalog.to_jsonb(new) - 'click_token'
     ) = (
       pg_catalog.to_jsonb(old) - 'click_token'
     ) then
    return new;
  end if;

  raise exception 'COMMERCE_ORDER_ATTRIBUTION_PUBLICATION_CLOSED'
    using errcode = '55000';
end;
$$;

create trigger order_attributions_admission_closed
  before insert or update
  on public.order_attributions
  for each row
  execute function private.guard_order_attribution_publication();

revoke all on function private.guard_order_attribution_publication()
  from public, anon, authenticated, service_role;

comment on table private.commerce_admission_control is
  'Migration-owned COM-01A closed singleton; no runtime role can read or mutate it.';
comment on function private.guard_commerce_click_publication() is
  'Rejects every commerce click publication while COM-01A admission is closed; deletion remains available.';
comment on function private.guard_order_attribution_publication() is
  'Rejects attribution publication while COM-01A is closed; permits only an installed-base click token transition from non-null to null with every other field unchanged.';

commit;
