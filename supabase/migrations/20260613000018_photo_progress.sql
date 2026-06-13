-- =============================================================================
-- 0018 · photos — guided photo-progress extensions (docs/06 §6)
-- =============================================================================
-- ADDITIVE columns on the existing privacy-first `photos` table (migration 0008).
-- The image BYTES still live on-device (local_uri) unless the user opts into cloud
-- backup; local_only stays the default. NO faceprint/biometric template is ever
-- stored — head_roll/yaw/pitch are COARSE pose angles captured for alignment QA,
-- not an identification template (BIPA avoidance, docs/00 §7, docs/01 §3, docs/06 §7).
-- Owner-only RLS (migration 0008) is UNCHANGED — no policy is weakened here.

alter table public.photos
  -- the baseline this shot aligns to (the ghost overlay); per-series reference.
  add column reference_photo_id uuid references public.photos (id) on delete set null,
  -- which capture series: 'front' default; power users add oblique/zone series.
  add column series              text not null default 'front',
  -- groups a multi-angle session (one capture sitting → many shots).
  add column capture_session_id  uuid,
  -- coarse head-pose at capture (alignment QA only — NOT a faceprint).
  add column head_roll           numeric,
  add column head_yaw            numeric,
  add column head_pitch          numeric,
  -- the user's LOCAL day (cadence/comparison; the D-012 tz-tolerant handling).
  -- default current_date keeps this a safe additive ALTER (the table is empty —
  -- no live DB yet, B-SUPABASE — but the default is correct for any future row).
  add column taken_local_date    date not null default current_date,
  -- consistency hint: shots are most comparable at the same time of day.
  add column time_of_day         text,                       -- 'morning' | 'evening'
  -- optional user note ("started retinol", "travel breakout").
  add column notes               text,
  -- on-device encrypted file path (NEVER synced while local_only = true).
  add column local_uri           text,
  add column is_encrypted        boolean not null default true;

-- Cadence/comparison reads are by (user, series, day) — index it (docs/06 §6).
create index photos_user_series_date_idx on public.photos (user_id, series, taken_local_date);

-- Defense in depth: a shot's reference must belong to the SAME owner. FKs only
-- check existence, not ownership (the D-014 pattern), so add a CHECK-style guard
-- via a restrictive policy that forbids pointing reference_photo_id at a row the
-- caller doesn't own. (NULL reference is always allowed.)
create or replace function public.owns_photo(p_photo_id uuid)
returns boolean
language sql
security definer
set search_path = public
stable
as $$
  select exists (
    select 1 from public.photos
    where id = p_photo_id and user_id = (select auth.uid())
  );
$$;
revoke all on function public.owns_photo(uuid) from public, anon;
grant execute on function public.owns_photo(uuid) to authenticated; -- invoked by RLS

create policy "photos_reference_owned_insert" on public.photos
  as restrictive for insert to authenticated
  with check (reference_photo_id is null or public.owns_photo(reference_photo_id));
create policy "photos_reference_owned_update" on public.photos
  as restrictive for update to authenticated
  with check (reference_photo_id is null or public.owns_photo(reference_photo_id));
