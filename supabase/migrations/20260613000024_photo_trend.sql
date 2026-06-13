-- =============================================================================
-- 0024 · AI trend analysis ("Changes in your own photos") — docs/12. On-device, NO score.
-- =============================================================================
-- The deferred, LAST build item, endorsed ONLY as an on-device, within-person,
-- descriptive, NO-NUMBER trend narration on the user's own guided photo series
-- (docs/06). The population "skin score" / "skin age" is KILLED OUTRIGHT (D-068):
-- there is NO score / grade / percentage column anywhere below, by construction.
--
-- *** EVERY SHIPPED PROMISE STAYS LITERALLY TRUE (D-069). *** This table holds only
-- ON-DEVICE-DERIVED abstract scalars (a structural/colour delta + the noise-floor
-- threshold + a change-state + a copy key) — NEVER an image, storage_path, faceprint,
-- or template. The SOURCE image stays local_only (docs/06, D-039); "photos never leave
-- your device / never train AI" (docs/06 line 177) is binary and survives only on-device.
-- A Supabase mirror, IF ever enabled, carries only these abstract deltas, under the
-- SEPARATE photo_trend_insights consent, never an image.
--
-- *** FAIRNESS IS A LAUNCH GATE (D-071, B-AI-FAIRNESS). *** mdc_threshold is
-- TONE-ADJUSTED (equal-or-higher for darker Monk bands), redness is never the metric,
-- and no public accuracy claim ships until a Monk-stratified cohort shows parity.

-- --- consent ledger extension: a NEW, separate, DEFAULT-OFF consent type (D-072) -----
-- The on-device-derived insight is still a HEALTH INFERENCE (MHMDA / GDPR Art. 9),
-- distinct from photo_capture / photo_cloud_backup; default-off, revocable; installed-
-- base users who onboarded under the "no AI grades" refusal are re-consented here.
alter table public.consents
  drop constraint consents_consent_type_check,
  add constraint consents_consent_type_check check (consent_type in (
    'account', 'health_data_collection', 'photo_capture',
    'photo_cloud_backup', 'marketing', 'data_sharing', 'community_participation',
    'photo_trend_insights'));

-- --- photo_trend — on-device within-person change state (LOCAL-FIRST; no image; no score)
create table public.photo_trend (
  id                 uuid primary key default gen_random_uuid(),
  user_id            uuid not null references auth.users (id) on delete cascade,
  series             text not null,                 -- 'front' | 'left' | 'right' | ... (mirrors photos.series)
  capture_session_id uuid,                           -- groups the compared captures (docs/06)
  delta_metric       numeric,                        -- SSIM/structural + colour/intensity delta on the registered pair
  mdc_threshold      numeric,                        -- per-user, TONE-ADJUSTED Minimal-Detectable-Change floor (§7)
  change_state       text not null
    check (change_state in ('consistent', 'change_observed', 'inconclusive_lighting', 'insufficient_data')),
  narrative_key      text,                            -- key into the externalised DESCRIPTIVE copy (NO number, NO grade)
  monk_tone_band     int,                             -- the user's Monk band, to apply the fairness-adjusted threshold
  computed_local_date date not null,
  created_at         timestamptz not null default now()
  -- *** NO score / grade / percentage / "skin age" column EXISTS, by construction (D-068/D-070).
  -- *** NO image / storage_path / faceprint / template column EXISTS — the source image stays local.
);
create index photo_trend_user_series_idx on public.photo_trend (user_id, series, computed_local_date);

alter table public.photo_trend enable row level security;
-- Owner-only RLS (docs/01 §3 pattern). Writes are local-first (the D-029 pattern); a
-- server mirror, IF ever enabled, is gated on the separate photo_trend_insights consent.
create policy "photo_trend_select_own" on public.photo_trend
  for select to authenticated using ((select auth.uid()) = user_id);
create policy "photo_trend_insert_own" on public.photo_trend
  for insert to authenticated with check ((select auth.uid()) = user_id);
create policy "photo_trend_update_own" on public.photo_trend
  for update to authenticated using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);
create policy "photo_trend_delete_own" on public.photo_trend
  for delete to authenticated using ((select auth.uid()) = user_id);

-- NOTE (deletion-on-revocation, docs/12 §8/§10): on photo_trend_insights consent
-- withdrawal an Edge Function / local task DELETES the user's photo_trend rows (no
-- retention exception, MHMDA / GDPR Art. 17); account deletion cascades from auth.users.
-- Derived trend state is EXCLUDED from any cloud backup. Deferred with B-AI-ONDEVICE.
