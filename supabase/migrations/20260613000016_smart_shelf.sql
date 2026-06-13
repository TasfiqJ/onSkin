-- =============================================================================
-- 0016 · Smart Shelf  (docs/04 §2)
-- =============================================================================
-- Additive extensions to user_products (the shelf spine, defined in 0005) + a
-- small owner-only shelf_scans intake / contribute-back log. This does NOT
-- redefine user_products; it adds provenance, lifecycle, the on-device thumbnail,
-- and the explicit "unopened" state on top of it.
--
-- NOTE: created_at / updated_at already exist (migration 0005). docs/04 §2 lists
-- them in its ALTER for completeness, but they are NOT re-added here.

alter table public.user_products
  -- false = unopened: no PAO clock until it's opened (docs/04 §4.5).
  add column is_opened      boolean not null default true,
  -- set when status moves to finished/discarded (§5.7 archive).
  add column finished_at    date,
  -- the user's own label ("my night serum").
  add column nickname       text,
  -- freeform ("travel size", "samples").
  add column notes          text,
  -- LOCAL device path by default — on-device photo, cloud only on the same
  -- opt-in that governs progress photos (docs/04 §7, DECISIONS D-026).
  add column thumbnail_path text,
  -- PAO provenance so the UI can be honest about estimates (docs/04 §3, D-027).
  add column pao_source     text
    check (pao_source is null or pao_source in ('label', 'catalog', 'category_default', 'unknown')),
  -- expiry provenance (printed expiry vs PAO-computed vs estimated vs unknown).
  add column expiry_source  text
    check (expiry_source is null or expiry_source in ('printed', 'pao_computed', 'estimated', 'unknown')),
  -- which intake path created the row (analytics + funnel, docs/04 §9).
  add column added_via      text
    check (added_via is null or added_via in ('barcode', 'search', 'ocr', 'manual', 'onboarding'));

-- Powers the Expiring filter/sort: soonest expiry_computed within the active set
-- (docs/04 §5.4). user_products already has owner-only RLS (0005); new columns
-- inherit it.
create index user_products_user_status_expiry_idx
  on public.user_products (user_id, status, expiry_computed);

-- ---------------------------------------------------------------------------
-- shelf_scans — intake log for analytics + the ODbL contribute-back queue
-- (docs/04 §2/§4.6). Owner-only, exactly the docs/01 §3 RLS pattern.
-- ---------------------------------------------------------------------------
create table public.shelf_scans (
  id                 uuid primary key default gen_random_uuid(),
  user_id            uuid not null references auth.users (id) on delete cascade,
  barcode            text,
  matched_product_id uuid references public.products (id) on delete set null,  -- null = no catalog match
  result             text not null
    check (result in ('matched', 'no_match', 'ambiguous', 'offline_queued')),
  contributed_back   boolean not null default false,                            -- ODbL obligation satisfied?
  created_at         timestamptz not null default now()
);
create index shelf_scans_user_id_idx on public.shelf_scans (user_id);

alter table public.shelf_scans enable row level security;

create policy "shelf_scans_select_own" on public.shelf_scans
  for select to authenticated
  using ((select auth.uid()) = user_id);

create policy "shelf_scans_insert_own" on public.shelf_scans
  for insert to authenticated
  with check ((select auth.uid()) = user_id);

-- The contribute-back job flips contributed_back → true once a no-match product
-- is pushed to Open Beauty Facts (docs/04 §4.6). Owner-only UPDATE (D-028).
create policy "shelf_scans_update_own" on public.shelf_scans
  for update to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);
