-- =============================================================================
-- 0022 · commerce / creator stacks (docs/10) — church-and-state, walled off
-- =============================================================================
-- The "where to buy" commerce layer, attached DOWNSTREAM of the independent
-- recommendation engine (docs/09). It joins to a product only by product_type /
-- catalog_product_id, AFTER ranking, and can never reorder a recommendation.
--
-- *** CHURCH AND STATE (docs/10 §9, D-058) ***
-- No commission / rate / affiliate field exists in any RANKING-PATH table
-- (products, ingredients, recommendations, the docs/09 engine). Commission data
-- lives ONLY in order_attributions, which is SERVICE-ROLE ONLY — clients can never
-- read it (RLS enabled, zero client policies). The ranking code imports nothing
-- from features/commerce. One-way join, after ranking.
--
-- NOTE: the doc's "physically separate Postgres schemas" is satisfied for v1 by
-- module-boundary + column-separation + RLS (one Supabase service role; all tables
-- in public, consistent with the prior 21 migrations). A true separate `commerce`
-- schema is a deferred infra hardening — the load-bearing guarantee (no commission
-- in ranking; the ranking path cannot read commission data) is delivered now.

-- --- 1. affiliate_links — catalog-level resolved "where to buy" links -----------
-- Rail-agnostic (the B-SHOPMY hedge): `source` discriminates the affiliate rail so
-- swapping ShopMy ⇄ Skimlinks/Sovrn/direct is a localised change. Client-readable
-- columns deliberately carry NO commission/rate (that lives only in
-- order_attributions, service-role) — only the disclosed price label.
create table public.affiliate_links (
  id                 uuid primary key default gen_random_uuid(),
  product_type       text not null,                                   -- the docs/09 type-first key
  catalog_product_id uuid references public.products (id),            -- optional specific product (B-CATALOG-SEED)
  retailer           text not null,
  label              text not null,                                   -- e.g. 'Zinc Mineral SPF 30'
  url                text not null,                                   -- the shopmy.us/p-<id> Pin or retailer deep link
  price_cents        integer,                                         -- disclosed price (illustrative until B-CATALOG-SEED)
  currency           text default 'USD',
  source             text not null default 'none'
    check (source in ('shopmy', 'skimlinks', 'direct', 'none')),
  is_paid            boolean not null default true,                   -- is it a commissionable ("paid") link (FTC)
  is_active          boolean not null default true,
  created_at         timestamptz not null default now()
);
create index affiliate_links_type_idx on public.affiliate_links (product_type) where is_active;

alter table public.affiliate_links enable row level security;
-- Catalog data: world-readable to authenticated (incl. anon), active rows only;
-- service-role write only (D-016 pattern). No commission column is exposed.
create policy "affiliate_links_select_active" on public.affiliate_links
  for select to authenticated using (is_active);

-- --- 2. creator_stacks — expert/derm-reviewed shoppable routines (Phase 2) ------
create table public.creator_stacks (
  id           uuid primary key default gen_random_uuid(),
  slug         text not null unique,
  title        text not null,
  subtitle     text,
  curator      text not null,                                         -- 'Layerwell editorial' | a named verified expert
  curator_kind text not null default 'editorial'
    check (curator_kind in ('editorial', 'derm', 'creator')),
  reviewed_by  text,                                                  -- B-DERM-REVIEW: null until clinical sign-off
  is_active    boolean not null default true,
  created_at   timestamptz not null default now()
);

alter table public.creator_stacks enable row level security;
create policy "creator_stacks_select_active" on public.creator_stacks
  for select to authenticated using (is_active);

create table public.creator_stack_items (
  id                 uuid primary key default gen_random_uuid(),
  stack_id           uuid not null references public.creator_stacks (id) on delete cascade,
  position           integer not null,
  product_type       text not null,
  catalog_product_id uuid references public.products (id),
  role_label         text not null,                                   -- 'Cleanse · fragrance-free'
  note               text,
  unique (stack_id, position)
);
create index creator_stack_items_stack_idx on public.creator_stack_items (stack_id);

alter table public.creator_stack_items enable row level security;
create policy "creator_stack_items_select_all" on public.creator_stack_items
  for select to authenticated using (true);

-- --- 3. commerce_click_events — per-user, owner-only click telemetry ------------
-- Written ONLY after the MHMDA commerce consent (data_sharing). Carries an OPAQUE
-- token and the product TYPE — never a health-adjacent attribute (no concern, goal,
-- skin axis, pregnancy, or photo column exists here, by design, docs/10 §5).
create table public.commerce_click_events (
  id                uuid primary key default gen_random_uuid(),
  user_id           uuid not null references auth.users (id) on delete cascade,
  click_token       text not null,                                    -- opaque; tied to no skin data
  product_type      text,
  affiliate_link_id uuid references public.affiliate_links (id),
  source            text not null default 'none',
  consented         boolean not null default false,
  created_at        timestamptz not null default now()
);
create index commerce_click_events_user_idx on public.commerce_click_events (user_id);

alter table public.commerce_click_events enable row level security;
create policy "commerce_click_events_select_own" on public.commerce_click_events
  for select to authenticated using ((select auth.uid()) = user_id);
create policy "commerce_click_events_insert_own" on public.commerce_click_events
  for insert to authenticated with check ((select auth.uid()) = user_id);
create policy "commerce_click_events_delete_own" on public.commerce_click_events
  for delete to authenticated using ((select auth.uid()) = user_id);

-- --- 4. order_attributions — the polled ShopMy Order Report (commission data) ---
-- *** SERVICE-ROLE ONLY — the church-and-state wall at the row level. ***
-- RLS is enabled with NO client policies, so authenticated/anon clients can never
-- SELECT commission/order data; only the service role (the daily pg_cron → Edge
-- Function poll on recordUpdatedStartDate; no webhooks exist) reads/writes it.
create table public.order_attributions (
  id                 uuid primary key default gen_random_uuid(),
  external_order_id  text not null unique,                            -- ShopMy Order ID (idempotent upsert)
  click_token        text,                                            -- correlates to a commerce_click_event
  order_amount_cents integer,
  commission_cents   integer,                                         -- commission lives ONLY here (service-role)
  currency           text default 'USD',
  status             text not null default 'pending'
    check (status in ('pending', 'locked', 'returned')),
  transaction_date   timestamptz,
  record_updated_at  timestamptz,                                     -- the poll's incremental key
  created_at         timestamptz not null default now()
);
create index order_attributions_token_idx on public.order_attributions (click_token);
create index order_attributions_updated_idx on public.order_attributions (record_updated_at);

alter table public.order_attributions enable row level security;
-- (intentionally NO policies — service-role only; clients are denied by default.)
