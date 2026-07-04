-- =============================================================================
-- 0027 · Phase 6 payments / entitlements hardening
-- =============================================================================
-- Additive-only production payments metadata. RevenueCat remains the store receipt
-- authority; Supabase mirrors subscription state for fast entitlement reads and
-- owns only app-granted, no-card reverse trials.

alter table public.entitlements
  add column if not exists source             text, -- 'revenuecat' | 'app_granted' | 'server'
  add column if not exists environment        text, -- 'production' | 'sandbox' | 'test_store' | 'development' | 'unknown'
  add column if not exists management_url     text,
  add column if not exists verified_at        timestamptz,
  add column if not exists package_id         text,
  add column if not exists store_user_id      text,
  add column if not exists last_reconciled_at timestamptz,
  add column if not exists raw_status         jsonb not null default '{}'::jsonb;

create table if not exists public.reverse_trial_grants (
  user_id    uuid primary key references auth.users (id) on delete cascade,
  granted_at timestamptz not null default now(),
  expires_at timestamptz not null,
  source     text not null default 'server',
  metadata   jsonb not null default '{}'::jsonb
);

alter table public.reverse_trial_grants enable row level security;

drop policy if exists "reverse_trial_grants_deny_client" on public.reverse_trial_grants;
create policy "reverse_trial_grants_deny_client" on public.reverse_trial_grants
  for all to authenticated
  using (false) with check (false);

alter table public.subscriptions_events
  add column if not exists app_user_id          text,
  add column if not exists original_app_user_id text,
  add column if not exists aliases              text[],
  add column if not exists resolved_user_id     uuid,
  add column if not exists environment          text,
  add column if not exists store                text,
  add column if not exists product_id           text,
  add column if not exists processed_at         timestamptz,
  add column if not exists processing_status    text,
  add column if not exists error                text,
  add column if not exists signature_verified   boolean,
  add column if not exists auth_verified        boolean;

create index if not exists subscriptions_events_resolved_user_id_idx
  on public.subscriptions_events (resolved_user_id, received_at desc);

create or replace function public.expire_app_granted_reverse_trials()
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  affected integer;
begin
  update public.entitlements
     set is_active = false,
         will_renew = false,
         updated_at = now(),
         last_reconciled_at = now()
   where store = 'app_granted'
     and period_type = 'reverse_trial'
     and is_active = true
     and expires_at is not null
     and expires_at <= now();

  get diagnostics affected = row_count;
  return affected;
end;
$$;
