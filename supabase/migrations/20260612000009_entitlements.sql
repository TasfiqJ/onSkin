-- =============================================================================
-- 0009 · entitlements (RevenueCat mirror) + subscriptions_events (raw log)
-- =============================================================================
-- Populated by the RevenueCat webhook -> Edge Function (service-role, bypasses
-- RLS). Clients may READ their own entitlement; they may never write it.
create table public.entitlements (
  user_id     uuid primary key references auth.users (id) on delete cascade,
  entitlement text check (entitlement in ('pro', 'pro_plus')),
  is_active   boolean not null default false,
  product_id  text,
  expires_at  timestamptz,
  rc_event_id text,
  updated_at  timestamptz not null default now()
);

alter table public.entitlements enable row level security;

-- SELECT owner-only. No INSERT/UPDATE/DELETE policy => denied for authenticated;
-- only the service-role webhook writes.
create policy "entitlements_select_own" on public.entitlements
  for select to authenticated
  using ((select auth.uid()) = user_id);

-- Raw webhook audit log (docs/01 §3). Idempotency key = RevenueCat event.id.
-- Service-role only. RLS is enabled and we add an explicit permissive deny so
-- there is a clear, documented policy (service-role bypasses RLS to write).
create table public.subscriptions_events (
  id          uuid primary key default gen_random_uuid(),
  rc_event_id text unique,                 -- dedupe (RC delivers at-least-once)
  user_id     uuid,
  event_type  text,
  payload     jsonb,
  received_at timestamptz not null default now()
);

alter table public.subscriptions_events enable row level security;

create policy "subscriptions_events_deny_client" on public.subscriptions_events
  for all to authenticated
  using (false) with check (false);
