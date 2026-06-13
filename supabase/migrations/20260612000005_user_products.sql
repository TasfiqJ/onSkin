-- =============================================================================
-- 0005 · user_products  (the shelf)
-- =============================================================================
-- expiry_computed = whichever is sooner of an explicit expiry_date and the
-- PAO-derived date (opened_at + pao_months). LEAST() ignores NULLs, so a missing
-- side just defers to the other (docs/01 §3).
create table public.user_products (
  id                 uuid primary key default gen_random_uuid(),
  user_id            uuid not null references auth.users (id) on delete cascade,
  catalog_product_id uuid references public.products (id) on delete set null,
  manual_name        text,
  manual_brand       text,
  barcode            text,
  opened_at          date,
  pao_months         int check (pao_months is null or pao_months > 0),
  expiry_date        date,
  expiry_computed    date generated always as (
    least(expiry_date, (opened_at + make_interval(months => pao_months))::date)
  ) stored,
  status             text not null default 'active' check (status in ('active', 'finished', 'discarded')),
  created_at         timestamptz not null default now(),
  updated_at         timestamptz not null default now()
);
create index user_products_user_id_idx on public.user_products (user_id);
create index user_products_catalog_idx on public.user_products (catalog_product_id);

alter table public.user_products enable row level security;

create policy "user_products_select_own" on public.user_products
  for select to authenticated
  using ((select auth.uid()) = user_id);

create policy "user_products_insert_own" on public.user_products
  for insert to authenticated
  with check ((select auth.uid()) = user_id);

create policy "user_products_update_own" on public.user_products
  for update to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

create policy "user_products_delete_own" on public.user_products
  for delete to authenticated
  using ((select auth.uid()) = user_id);

create trigger trg_user_products_updated_at
  before update on public.user_products
  for each row execute function public.set_updated_at();
