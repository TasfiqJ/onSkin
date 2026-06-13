-- =============================================================================
-- 0003 · Ingredient / product catalog  (shared reference data)
-- =============================================================================
-- Schema is the SKETCH from docs/00 §2. The detailed spec is Document 2 (missing)
-- and the seed DATA is BLOCKED:
--   BLOCKED: B-CONFLICT-RULES — the 30–60 curated ingredient pairs (contested
--     dermatology evidence; each rule needs an evidence grade + non-alarmist
--     resolution + citation).
--   Seeding sources carry obligations: CosIng is "informative purpose, no legal
--     value"; Open Beauty Facts is ODbL (attribution + share-alike).
-- This is reference data shared by all users (no per-user rows), so reads are
-- open to authenticated; writes are service-role only (curated server-side).

create table public.ingredients (
  id         uuid primary key default gen_random_uuid(),
  inci_name  text not null,
  cas_number text,
  functions  text[] not null default '{}',
  source     text not null default 'cosing',
  created_at timestamptz not null default now()
);
create unique index ingredients_inci_name_key on public.ingredients (lower(inci_name));

create table public.products (
  id         uuid primary key default gen_random_uuid(),
  name       text not null,
  brand      text,
  barcode    text,
  source     text not null default 'openbeautyfacts',
  created_at timestamptz not null default now()
);
create index products_barcode_idx on public.products (barcode);

create table public.product_ingredients (
  product_id         uuid not null references public.products (id) on delete cascade,
  ingredient_id      uuid not null references public.ingredients (id) on delete cascade,
  position           int,
  concentration_band text,
  primary key (product_id, ingredient_id)
);

create table public.conflict_rules (
  id             uuid primary key default gen_random_uuid(),
  ingredient_a   uuid not null references public.ingredients (id) on delete cascade,
  ingredient_b   uuid not null references public.ingredients (id) on delete cascade,
  severity       text not null check (severity in ('low', 'moderate', 'high')),
  evidence_grade text not null check (evidence_grade in ('strong', 'moderate', 'limited', 'contested')),
  resolution     text not null,           -- non-alarmist resolution (never "never use")
  citation       text,
  created_at     timestamptz not null default now(),
  check (ingredient_a <> ingredient_b)
);
create index conflict_rules_a_idx on public.conflict_rules (ingredient_a);
create index conflict_rules_b_idx on public.conflict_rules (ingredient_b);

-- RLS: readable by any signed-in user (incl. anonymous); no client writes.
alter table public.ingredients enable row level security;
alter table public.products enable row level security;
alter table public.product_ingredients enable row level security;
alter table public.conflict_rules enable row level security;

create policy "ingredients_read_all" on public.ingredients
  for select to authenticated using (true);
create policy "products_read_all" on public.products
  for select to authenticated using (true);
create policy "product_ingredients_read_all" on public.product_ingredients
  for select to authenticated using (true);
create policy "conflict_rules_read_all" on public.conflict_rules
  for select to authenticated using (true);
