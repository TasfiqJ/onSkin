-- =============================================================================
-- 0003 · Ingredient / product catalog  (shared reference data)
-- =============================================================================
-- Schema per docs/02 §3 (the real spec; supersedes the docs/00 §2 sketch). These
-- catalog/rule tables are world-readable to authenticated users (incl. anonymous,
-- who do product intake during the pre-account quiz — docs/01 §2 step 6); writes
-- are service-role only. Conflict rules match on FUNCTIONAL TAGS, not INCI ids.
--   Seeding sources carry obligations (BLOCKED: B-CATALOG-SEED): CosIng
--     ("informative purpose, no legal value"); Open Beauty Facts (ODbL —
--     attribution + share-alike + contribute-back; API = 1 call/scan, bulk via dumps).
--   The conflict-rule DATA needs clinical sign-off (BLOCKED: B-DERM-REVIEW).

create table public.ingredients (
  id               uuid primary key default gen_random_uuid(),
  inci_name        text unique not null,          -- canonical key (Reg. 1223/2009 Art.19)
  display_name     text,                            -- friendly: "Vitamin C (L-Ascorbic Acid)"
  cas_number       text,
  ec_number        text,
  cosing_ref       text,                            -- provenance into CosIng
  annex_status     text check (annex_status in ('restricted', 'prohibited', 'preservative', 'uv_filter', 'colourant')),
  annex_conditions text,
  source           text not null default 'cosing' check (source in ('cosing', 'open_beauty_facts', 'curated', 'user_contributed')),
  imported_at      timestamptz not null default now()
);

create table public.ingredient_synonyms (           -- many spellings -> one ingredient
  id            uuid primary key default gen_random_uuid(),
  ingredient_id uuid not null references public.ingredients (id) on delete cascade,
  synonym       text not null unique
);
create index ingredient_synonyms_ingredient_idx on public.ingredient_synonyms (ingredient_id);

create table public.ingredient_tags (               -- functional families the engine matches on
  ingredient_id uuid not null references public.ingredients (id) on delete cascade,
  tag           text not null,                       -- 'aha','bha','retinoid','vitamin_c', ...
  subflag       text,                                -- 'adapalene','encapsulated','l_ascorbic_acid', ...
  primary key (ingredient_id, tag)
);
create index ingredient_tags_tag_idx on public.ingredient_tags (tag);

create table public.products (                       -- user_products.catalog_product_id -> here
  id                 uuid primary key default gen_random_uuid(),
  barcode            text unique,                     -- join key to user_products.barcode / scans
  name               text not null,
  brand              text,
  category           text,                            -- 'cleanser','serum','moisturiser','spf', ...
  default_pao_months int,                             -- from label, else category default (§6)
  is_curated         boolean not null default false,
  source             text not null default 'open_beauty_facts' check (source in ('cosing', 'open_beauty_facts', 'curated', 'user_contributed')),
  source_ref         text,
  imported_at        timestamptz not null default now()
);
create index products_search_idx on public.products
  using gin (to_tsvector('simple', coalesce(name, '') || ' ' || coalesce(brand, '')));

create table public.product_ingredients (            -- the join, with position + concentration band
  product_id         uuid not null references public.products (id) on delete cascade,
  ingredient_id      uuid not null references public.ingredients (id) on delete cascade,
  position           int,                             -- order in the INCI list (proxy for amount)
  concentration_band text,                            -- '<=1%','1-5%','>5%','unknown' | exact if curated
  primary key (product_id, ingredient_id)
);
create index product_ingredients_ingredient_idx on public.product_ingredients (ingredient_id);

-- The conflict / synergy matrix. Rules match on TAGS (families), not INCI ids.
create table public.conflict_rules (
  id               uuid primary key default gen_random_uuid(),
  tag_a            text not null,
  tag_b            text not null,
  interaction_type text not null check (interaction_type in ('irritation', 'stability', 'efficacy', 'synergy', 'safety', 'myth')),
  base_severity    text not null check (base_severity in ('none', 'mild', 'moderate', 'high')),
  evidence_grade   text check (evidence_grade in ('A', 'B', 'C')),                                  -- SORT-anchored; NULL = "—" (refuted myths, docs/02 §4.3)
  evidence_label   text not null check (evidence_label in ('established', 'plausible', 'contested', 'refuted')),
  mechanism        text not null,                     -- plain-language WHY (claim-safe)
  resolution_type  text not null check (resolution_type in ('separate_am_pm', 'alternate_nights', 'buffer', 'lower_frequency', 'no_change', 'reassure', 'avoid_refer')),
  resolution_copy  text not null,                     -- the calm, claim-safe suggestion shown to user
  applies_when     jsonb,                             -- modulators: {"sensitivity":"sensitive"} | {"pregnancy":true} | {"subflag_exempt":[...]}
  source_citation  text not null,
  rule_version     int  not null default 1,
  reviewed_by      text,                              -- 'derm:Dr X 2026-06' — NULL until B-DERM-REVIEW sign-off
  is_active        boolean not null default true,
  unique (tag_a, tag_b, interaction_type, rule_version)
);
create index conflict_rules_tags_idx on public.conflict_rules (tag_a, tag_b);

create table public.ingredient_pao_defaults (         -- category PAO fallbacks (§6)
  category           text primary key,
  default_pao_months int not null,
  rationale          text
);

-- RLS: catalog is non-personal — readable by any signed-in user (incl. anonymous,
-- who hold the 'authenticated' role with is_anonymous=true, docs/01 §1). No client
-- writes (service-role only). Only ACTIVE conflict rules are exposed to clients.
alter table public.ingredients enable row level security;
alter table public.ingredient_synonyms enable row level security;
alter table public.ingredient_tags enable row level security;
alter table public.products enable row level security;
alter table public.product_ingredients enable row level security;
alter table public.conflict_rules enable row level security;
alter table public.ingredient_pao_defaults enable row level security;

create policy "ingredients_read_all" on public.ingredients
  for select to authenticated using (true);
create policy "ingredient_synonyms_read_all" on public.ingredient_synonyms
  for select to authenticated using (true);
create policy "ingredient_tags_read_all" on public.ingredient_tags
  for select to authenticated using (true);
create policy "products_read_all" on public.products
  for select to authenticated using (true);
create policy "product_ingredients_read_all" on public.product_ingredients
  for select to authenticated using (true);
create policy "conflict_rules_read_active" on public.conflict_rules
  for select to authenticated using (is_active);
create policy "ingredient_pao_defaults_read_all" on public.ingredient_pao_defaults
  for select to authenticated using (true);
