-- =============================================================================
-- 0020 · entitlements — subscription/reverse-trial/attribution extensions (docs/08 §8)
-- =============================================================================
-- ADDITIVE columns on the existing RevenueCat `entitlements` mirror (migration 0009).
-- The mirror stays SELECT owner-only / writes service-role only (RLS unchanged) —
-- the webhook AND the app-granted reverse-trial both write via the service role.
-- period_type distinguishes the app-granted reverse trial (no store txn, no
-- auto-renew) from a carded trial/subscription; the attribution columns enable the
-- LTV-by-channel analysis the model A/B is judged on (docs/08 §10/§11).

alter table public.entitlements
  add column store               text,    -- 'app_store' | 'play_store' | 'web' | 'app_granted'
  add column period_type         text,    -- 'reverse_trial' | 'trial' | 'intro' | 'normal'
  add column will_renew          boolean, -- from CustomerInfo (false after a cancellation, before expiry)
  add column original_purchase_at timestamptz,
  add column offering_id         text,    -- which RevenueCat offering/experiment the user saw (attribution)
  add column experiment_id       text,    -- paywall/price/model A/B assignment (analytics)
  add column acquisition_channel text;    -- attributed channel for LTV-by-channel (TikTok, ASA, organic, creator code)

-- No RLS change: SELECT owner-only (0009); writes remain service-role only. A
-- period_type='reverse_trial' row is app-granted (service-role Edge Function), so
-- clients still cannot self-grant Pro — the local-first store is the v1 cache only
-- (B-SUPABASE), reconciled from this mirror once the backend is live.
