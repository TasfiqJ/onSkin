-- =============================================================================
-- 0010 · consents  (MHMDA / GDPR immutable audit ledger)
-- =============================================================================
-- IMMUTABLE & APPEND-ONLY (docs/01 §3): a revocation is a NEW row (granted=false),
-- never an UPDATE. Only SELECT + INSERT policies exist; with RLS on, UPDATE/DELETE
-- are denied. Consent types are unbundled — collection is "separate and distinct"
-- from sharing under MHMDA, and health data needs explicit GDPR Art. 9 consent.
create table public.consents (
  id                uuid primary key default gen_random_uuid(),
  user_id           uuid not null references auth.users (id) on delete cascade,
  consent_type      text not null check (consent_type in (
                      'account', 'health_data_collection', 'photo_capture',
                      'photo_cloud_backup', 'marketing', 'data_sharing')),
  granted           boolean not null,
  version           text not null,            -- policy/version the user agreed to
  consent_text_hash text,                      -- hash of the exact text shown
  granted_at        timestamptz not null default now(),
  revoked_at        timestamptz,
  ip                inet,
  user_agent        text
);
create index consents_user_id_idx on public.consents (user_id);
create index consents_user_type_idx on public.consents (user_id, consent_type);

alter table public.consents enable row level security;

create policy "consents_select_own" on public.consents
  for select to authenticated
  using ((select auth.uid()) = user_id);

create policy "consents_insert_own" on public.consents
  for insert to authenticated
  with check ((select auth.uid()) = user_id);

-- Hard immutability at the DB layer (not just policy absence): block any UPDATE
-- so even service-role code paths can't rewrite consent history — a revocation
-- must be a NEW row (docs/01 §3/§4). DELETE is intentionally NOT blocked so the
-- account-deletion FK cascade (auth.users -> consents) still works.
create or replace function public.consents_block_update()
returns trigger
language plpgsql
as $$
begin
  raise exception 'consents are append-only; record a new row to revoke';
end;
$$;

create trigger trg_consents_no_update
  before update on public.consents
  for each row execute function public.consents_block_update();
