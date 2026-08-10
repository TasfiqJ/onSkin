-- =============================================================================
-- 0026 · Phase 4 product and ingredient catalog
-- =============================================================================
-- Additive catalog hardening for docs/phase-4. This does not pretend the launch
-- catalog is cleared. Source review, ODbL review, CosIng review, curated-product
-- QA, and clinical/legal signoff remain launch blockers until recorded.

-- Existing starter catalog source enums were intentionally narrow. Phase 4 needs
-- explicit provenance for curated data, OBF, CosIng, brand labels, user-local
-- entries, and internal derived fields.
alter table public.products drop constraint if exists products_source_check;
alter table public.products
  add constraint products_source_check
  check (source in ('cosing', 'open_beauty_facts', 'curated', 'brand_label', 'user_local', 'internal_derived', 'user_contributed'));

alter table public.ingredients drop constraint if exists ingredients_source_check;
alter table public.ingredients
  add constraint ingredients_source_check
  check (source in ('cosing', 'open_beauty_facts', 'curated', 'brand_label', 'user_local', 'internal_derived', 'user_contributed'));

create table if not exists public.catalog_sources (
  id                   uuid primary key default gen_random_uuid(),
  source_key           text not null unique
    check (source_key in ('curated', 'open_beauty_facts', 'cosing', 'brand_label', 'user_local', 'internal_derived')),
  display_name         text not null,
  source_url           text,
  license_name         text,
  license_url          text,
  attribution_text     text,
  attribution_url      text,
  requires_attribution boolean not null default false,
  requires_share_alike boolean not null default false,
  allows_images        boolean not null default false,
  production_approved  boolean not null default false,
  review_status        text not null default 'pending'
    check (review_status in ('draft', 'pending', 'legal_approved', 'blocked')),
  reviewed_by          text,
  reviewed_at          timestamptz,
  notes                text,
  created_at           timestamptz not null default now(),
  updated_at           timestamptz not null default now()
);

create table if not exists public.catalog_import_batches (
  id              uuid primary key default gen_random_uuid(),
  source_id       uuid not null references public.catalog_sources (id) on delete restrict,
  batch_type      text not null
    check (batch_type in ('obf_export', 'obf_api_check', 'cosing_dictionary', 'curated_seed', 'brand_label', 'manual_review')),
  snapshot_date   date not null,
  artifact_uri    text,
  artifact_sha256 text,
  manifest        jsonb not null default '{}'::jsonb,
  status          text not null default 'planned'
    check (status in ('planned', 'running', 'succeeded', 'failed', 'blocked')),
  parser_version  text,
  product_count   int not null default 0 check (product_count >= 0),
  ingredient_count int not null default 0 check (ingredient_count >= 0),
  qa_report_uri   text,
  started_at      timestamptz,
  finished_at     timestamptz,
  created_by      text,
  created_at      timestamptz not null default now()
);
create index if not exists catalog_import_batches_source_idx
  on public.catalog_import_batches (source_id, snapshot_date desc);

create table if not exists public.brands (
  id              uuid primary key default gen_random_uuid(),
  normalized_name text not null unique,
  display_name    text not null,
  website_url     text,
  source_id       uuid references public.catalog_sources (id) on delete set null,
  review_status   text not null default 'unreviewed'
    check (review_status in ('unreviewed', 'needs_review', 'reviewed', 'blocked')),
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);
create index if not exists brands_display_name_idx on public.brands (display_name);

create table if not exists public.product_categories (
  id                    text primary key,
  label                 text not null,
  parent_id             text references public.product_categories (id) on delete set null,
  routine_role          text,
  default_pao_months    int check (default_pao_months is null or default_pao_months > 0),
  pao_source            text not null default 'unknown'
    check (pao_source in ('reviewed_category_default', 'label_required', 'unknown')),
  is_sunscreen          boolean not null default false,
  is_otc_drug_candidate boolean not null default false,
  review_status         text not null default 'unreviewed'
    check (review_status in ('unreviewed', 'needs_review', 'reviewed', 'blocked')),
  created_at            timestamptz not null default now()
);

alter table public.products
  add column if not exists brand_id uuid references public.brands (id) on delete set null,
  add column if not exists category_id text references public.product_categories (id) on delete set null,
  add column if not exists canonical_name text,
  add column if not exists display_name text,
  add column if not exists normalized_brand_name text,
  add column if not exists product_type text,
  add column if not exists region text not null default 'US',
  add column if not exists status text not null default 'active'
    check (status in ('active', 'retired', 'duplicate', 'blocked')),
  add column if not exists source_priority int not null default 100 check (source_priority >= 0),
  add column if not exists review_status text not null default 'unreviewed'
    check (review_status in ('unreviewed', 'needs_review', 'reviewed', 'blocked')),
  add column if not exists data_quality_score numeric(5,2) not null default 0
    check (data_quality_score >= 0 and data_quality_score <= 100),
  add column if not exists ingredient_quality_score numeric(5,2) not null default 0
    check (ingredient_quality_score >= 0 and ingredient_quality_score <= 100),
  add column if not exists barcode_quality_score numeric(5,2) not null default 0
    check (barcode_quality_score >= 0 and barcode_quality_score <= 100),
  add column if not exists category_quality_score numeric(5,2) not null default 0
    check (category_quality_score >= 0 and category_quality_score <= 100),
  add column if not exists quality_grade text not null default 'unverified'
    check (quality_grade in ('verified', 'usable', 'limited', 'unverified', 'blocked')),
  add column if not exists source_id uuid references public.catalog_sources (id) on delete set null,
  add column if not exists source_snapshot_date date,
  add column if not exists source_url text,
  add column if not exists formula_version text,
  add column if not exists variant_group_id uuid,
  add column if not exists replaces_product_id uuid references public.products (id) on delete set null,
  add column if not exists last_source_refresh_at timestamptz,
  add column if not exists ingredient_parse_status text not null default 'not_parsed'
    check (ingredient_parse_status in ('not_parsed', 'parsed', 'partial', 'failed', 'reviewed')),
  add column if not exists ingredient_parse_confidence numeric(5,2) not null default 0
    check (ingredient_parse_confidence >= 0 and ingredient_parse_confidence <= 1),
  add column if not exists parser_version text,
  add column if not exists unresolved_correction_count int not null default 0 check (unresolved_correction_count >= 0),
  add column if not exists recommendation_eligible boolean not null default false,
  add column if not exists last_reviewed_at timestamptz;

create index if not exists products_barcode_idx on public.products (barcode);
create index if not exists products_brand_id_idx on public.products (brand_id);
create index if not exists products_category_id_idx on public.products (category_id);
create index if not exists products_quality_idx on public.products (quality_grade, review_status, status);
create index if not exists products_source_snapshot_idx on public.products (source_id, source_snapshot_date desc);

create table if not exists public.product_barcodes (
  barcode       text primary key,
  product_id    uuid not null references public.products (id) on delete cascade,
  barcode_type  text not null default 'ean_upc',
  source_id     uuid references public.catalog_sources (id) on delete set null,
  confidence    numeric(5,2) not null default 1 check (confidence >= 0 and confidence <= 1),
  review_status text not null default 'unreviewed'
    check (review_status in ('unreviewed', 'needs_review', 'reviewed', 'blocked')),
  first_seen_at timestamptz not null default now(),
  last_seen_at  timestamptz not null default now()
);
create index if not exists product_barcodes_product_idx on public.product_barcodes (product_id);

alter table public.ingredients
  add column if not exists normalized_inci_name text,
  add column if not exists review_status text not null default 'unreviewed'
    check (review_status in ('unreviewed', 'needs_review', 'reviewed', 'blocked')),
  add column if not exists source_id uuid references public.catalog_sources (id) on delete set null,
  add column if not exists source_snapshot_date date,
  add column if not exists source_url text,
  add column if not exists ingredient_quality_score numeric(5,2) not null default 0
    check (ingredient_quality_score >= 0 and ingredient_quality_score <= 100),
  add column if not exists restriction_summary text;

alter table public.ingredient_synonyms
  add column if not exists normalized_synonym text,
  add column if not exists source_id uuid references public.catalog_sources (id) on delete set null,
  add column if not exists review_status text not null default 'unreviewed'
    check (review_status in ('unreviewed', 'needs_review', 'reviewed', 'blocked'));
create index if not exists ingredient_synonyms_normalized_idx
  on public.ingredient_synonyms (normalized_synonym);

create table if not exists public.ingredient_tag_definitions (
  tag            text primary key,
  label          text not null,
  tag_group      text not null,
  evidence_grade text check (evidence_grade in ('A', 'B', 'C')),
  consumer_copy  text,
  reviewed_by    text,
  review_status  text not null default 'unreviewed'
    check (review_status in ('unreviewed', 'needs_review', 'reviewed', 'blocked')),
  created_at     timestamptz not null default now()
);

create table if not exists public.ingredient_tag_assignments (
  id             uuid primary key default gen_random_uuid(),
  ingredient_id  uuid not null references public.ingredients (id) on delete cascade,
  tag            text not null references public.ingredient_tag_definitions (tag) on delete restrict,
  subflag        text,
  evidence_label text check (evidence_label in ('established', 'plausible', 'contested', 'refuted')),
  source_id      uuid references public.catalog_sources (id) on delete set null,
  parser_version text,
  review_status  text not null default 'unreviewed'
    check (review_status in ('unreviewed', 'needs_review', 'reviewed', 'blocked')),
  created_at     timestamptz not null default now()
);
create unique index if not exists ingredient_tag_assignments_unique_idx
  on public.ingredient_tag_assignments (ingredient_id, tag, coalesce(subflag, ''));
create index if not exists ingredient_tag_assignments_tag_idx
  on public.ingredient_tag_assignments (tag);

create table if not exists public.product_ingredient_lists (
  id                         uuid primary key default gen_random_uuid(),
  product_id                 uuid not null references public.products (id) on delete cascade,
  source_id                  uuid references public.catalog_sources (id) on delete set null,
  raw_text                   text not null,
  locale                     text not null default 'en',
  parse_status               text not null default 'not_parsed'
    check (parse_status in ('not_parsed', 'parsed', 'partial', 'failed', 'reviewed')),
  parse_confidence           numeric(5,2) not null default 0 check (parse_confidence >= 0 and parse_confidence <= 1),
  parser_version             text,
  token_count                int not null default 0 check (token_count >= 0),
  unmatched_count            int not null default 0 check (unmatched_count >= 0),
  active_section_found       boolean not null default false,
  inactive_section_found     boolean not null default false,
  may_contain_section_found  boolean not null default false,
  source_snapshot_date       date,
  review_status              text not null default 'unreviewed'
    check (review_status in ('unreviewed', 'needs_review', 'reviewed', 'blocked')),
  created_at                 timestamptz not null default now(),
  updated_at                 timestamptz not null default now()
);
create index if not exists product_ingredient_lists_product_idx
  on public.product_ingredient_lists (product_id, created_at desc);

create table if not exists public.product_ingredient_tokens (
  id                   uuid primary key default gen_random_uuid(),
  ingredient_list_id   uuid not null references public.product_ingredient_lists (id) on delete cascade,
  product_id           uuid not null references public.products (id) on delete cascade,
  ingredient_id        uuid references public.ingredients (id) on delete set null,
  position             int not null check (position > 0),
  raw_token            text not null,
  normalized_token     text not null,
  section              text not null default 'main'
    check (section in ('main', 'active', 'inactive', 'may_contain')),
  match_type           text not null default 'unknown'
    check (match_type in ('exact', 'synonym', 'fuzzy', 'manual', 'unknown')),
  match_confidence     numeric(5,2) not null default 0 check (match_confidence >= 0 and match_confidence <= 1),
  is_unmatched         boolean not null default true,
  tags                 text[] not null default '{}',
  concentration_band   text,
  source_id            uuid references public.catalog_sources (id) on delete set null,
  created_at           timestamptz not null default now()
);
create index if not exists product_ingredient_tokens_product_idx
  on public.product_ingredient_tokens (product_id, position);
create index if not exists product_ingredient_tokens_unmatched_idx
  on public.product_ingredient_tokens (is_unmatched) where is_unmatched;

alter table public.product_ingredients
  add column if not exists ingredient_list_id uuid references public.product_ingredient_lists (id) on delete set null,
  add column if not exists source_id uuid references public.catalog_sources (id) on delete set null,
  add column if not exists raw_token text,
  add column if not exists normalized_token text,
  add column if not exists match_type text
    check (match_type is null or match_type in ('exact', 'synonym', 'fuzzy', 'manual', 'unknown')),
  add column if not exists match_confidence numeric(5,2)
    check (match_confidence is null or (match_confidence >= 0 and match_confidence <= 1)),
  add column if not exists is_unmatched boolean not null default false,
  add column if not exists parser_version text,
  add column if not exists created_at timestamptz not null default now();
create index if not exists product_ingredients_list_idx
  on public.product_ingredients (ingredient_list_id);

create table if not exists public.product_active_bands (
  id                uuid primary key default gen_random_uuid(),
  product_id        uuid not null references public.products (id) on delete cascade,
  ingredient_id     uuid references public.ingredients (id) on delete set null,
  tag               text,
  band              text not null check (band in ('label_exact', '<=1%', '1-5%', '>5%', 'unknown')),
  exact_percent     numeric(6,3) check (exact_percent is null or exact_percent >= 0),
  source_basis      text not null default 'unknown'
    check (source_basis in ('label_percentage', 'brand_label', 'curated_review', 'regulatory', 'unknown')),
  evidence_note     text,
  source_id         uuid references public.catalog_sources (id) on delete set null,
  review_status     text not null default 'unreviewed'
    check (review_status in ('unreviewed', 'needs_review', 'reviewed', 'blocked')),
  created_at        timestamptz not null default now()
);
create index if not exists product_active_bands_product_idx
  on public.product_active_bands (product_id);

create table if not exists public.product_pao_expiry (
  id             uuid primary key default gen_random_uuid(),
  product_id     uuid not null references public.products (id) on delete cascade,
  pao_months     int check (pao_months is null or pao_months > 0),
  pao_source     text not null default 'unknown'
    check (pao_source in ('label', 'brand_label', 'catalog', 'category_default', 'unknown')),
  expiry_date    date,
  expiry_source  text not null default 'unknown'
    check (expiry_source in ('printed', 'label', 'manufacturer', 'pao_computed', 'unknown')),
  region         text not null default 'US',
  evidence_note  text,
  source_id      uuid references public.catalog_sources (id) on delete set null,
  reviewed_by    text,
  review_status  text not null default 'unreviewed'
    check (review_status in ('unreviewed', 'needs_review', 'reviewed', 'blocked')),
  created_at     timestamptz not null default now()
);
create index if not exists product_pao_expiry_product_idx
  on public.product_pao_expiry (product_id);

create table if not exists public.catalog_corrections (
  id                uuid primary key default gen_random_uuid(),
  user_id           uuid not null references auth.users (id) on delete cascade,
  product_id        uuid references public.products (id) on delete set null,
  barcode           text,
  correction_type   text not null
    check (correction_type in ('wrong_match', 'missing_product', 'ingredient_issue', 'duplicate', 'source_issue', 'expiry_issue', 'category_issue')),
  status            text not null default 'open'
    check (status in ('open', 'triaged', 'accepted', 'rejected', 'closed')),
  description       text,
  proposed_payload  jsonb not null default '{}'::jsonb,
  client_context    jsonb not null default '{}'::jsonb,
  assigned_to       text,
  resolved_by       text,
  resolution_note   text,
  source_id         uuid references public.catalog_sources (id) on delete set null,
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now()
);
create index if not exists catalog_corrections_user_idx
  on public.catalog_corrections (user_id, created_at desc);
create index if not exists catalog_corrections_product_open_idx
  on public.catalog_corrections (product_id, status) where product_id is not null;

create table if not exists public.obf_contribution_queue (
  id              uuid primary key default gen_random_uuid(),
  correction_id   uuid references public.catalog_corrections (id) on delete set null,
  user_id         uuid references auth.users (id) on delete set null,
  barcode         text,
  payload         jsonb not null default '{}'::jsonb,
  status          text not null default 'held'
    check (status in ('queued', 'held', 'exported', 'submitted', 'rejected', 'disabled')),
  hold_reason     text,
  source_snapshot jsonb not null default '{}'::jsonb,
  obf_response    jsonb,
  submitted_at    timestamptz,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);
create index if not exists obf_contribution_queue_status_idx
  on public.obf_contribution_queue (status, created_at);

create table if not exists public.catalog_quality_reports (
  id             uuid primary key default gen_random_uuid(),
  batch_id       uuid references public.catalog_import_batches (id) on delete set null,
  report_type    text not null default 'import_qa',
  generated_at   timestamptz not null default now(),
  metrics        jsonb not null default '{}'::jsonb,
  blocker_count  int not null default 0 check (blocker_count >= 0),
  warning_count  int not null default 0 check (warning_count >= 0),
  created_at     timestamptz not null default now()
);

create table if not exists public.catalog_lookup_events (
  id                 uuid primary key default gen_random_uuid(),
  user_id            uuid not null references auth.users (id) on delete cascade,
  lookup_type        text not null check (lookup_type in ('barcode', 'search', 'manual', 'ocr')),
  query              text,
  barcode            text,
  result             text not null check (result in ('matched', 'no_match', 'ambiguous', 'manual', 'offline')),
  matched_product_id uuid references public.products (id) on delete set null,
  source_key         text,
  quality_grade      text check (quality_grade is null or quality_grade in ('verified', 'usable', 'limited', 'unverified', 'blocked')),
  created_at         timestamptz not null default now()
);
create index if not exists catalog_lookup_events_user_idx
  on public.catalog_lookup_events (user_id, created_at desc);

alter table public.user_products
  add column if not exists catalog_source_id uuid references public.catalog_sources (id) on delete set null,
  add column if not exists catalog_match_quality text
    check (catalog_match_quality is null or catalog_match_quality in ('verified', 'usable', 'limited', 'unverified', 'blocked', 'manual')),
  add column if not exists catalog_source_snapshot_date date,
  add column if not exists discard_after date,
  add column if not exists discard_basis text
    check (discard_basis is null or discard_basis in ('printed_expiry', 'label_pao', 'catalog_pao', 'category_default', 'user_entered', 'unknown')),
  add column if not exists routine_slot text,
  add column if not exists source_disclosure_ack_at timestamptz;
create index if not exists user_products_catalog_quality_idx
  on public.user_products (user_id, catalog_match_quality);

-- Keep product-level correction state queryable for recommendation gates.
create or replace function public.refresh_product_correction_count(p_product_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if p_product_id is null then
    return;
  end if;

  update public.products
     set unresolved_correction_count = (
       select count(*)::int
         from public.catalog_corrections
        where product_id = p_product_id
          and status in ('open', 'triaged')
     ),
     recommendation_eligible =
       quality_grade in ('verified', 'usable')
       and review_status = 'reviewed'
       and status = 'active'
       and (
         select count(*)::int
           from public.catalog_corrections
          where product_id = p_product_id
            and status in ('open', 'triaged')
       ) = 0
   where id = p_product_id;
end;
$$;
revoke all on function public.refresh_product_correction_count(uuid) from public, anon, authenticated;

create or replace function public.trg_refresh_product_correction_count()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if tg_op = 'DELETE' then
    perform public.refresh_product_correction_count(old.product_id);
    return old;
  end if;

  perform public.refresh_product_correction_count(new.product_id);
  if tg_op = 'UPDATE' and old.product_id is not null and old.product_id is distinct from new.product_id then
    perform public.refresh_product_correction_count(old.product_id);
  end if;
  return new;
end;
$$;
revoke all on function public.trg_refresh_product_correction_count() from public, anon, authenticated;

drop trigger if exists trg_catalog_corrections_refresh_product on public.catalog_corrections;
create trigger trg_catalog_corrections_refresh_product
  after insert or update or delete on public.catalog_corrections
  for each row execute function public.trg_refresh_product_correction_count();

create or replace view public.recommendable_catalog_products
with (security_invoker = true)
as
select *
  from public.products
 where quality_grade in ('verified', 'usable')
   and review_status = 'reviewed'
   and status = 'active'
   and unresolved_correction_count = 0
   and recommendation_eligible = true;

grant select on public.recommendable_catalog_products to authenticated;

-- RLS. Global catalog records are readable by authenticated users, including
-- anonymous users who are already in the authenticated role. Import batches,
-- quality reports, and contribution queues intentionally have no client policy.
alter table public.catalog_sources enable row level security;
alter table public.catalog_import_batches enable row level security;
alter table public.brands enable row level security;
alter table public.product_categories enable row level security;
alter table public.product_barcodes enable row level security;
alter table public.ingredient_tag_definitions enable row level security;
alter table public.ingredient_tag_assignments enable row level security;
alter table public.product_ingredient_lists enable row level security;
alter table public.product_ingredient_tokens enable row level security;
alter table public.product_active_bands enable row level security;
alter table public.product_pao_expiry enable row level security;
alter table public.catalog_corrections enable row level security;
alter table public.obf_contribution_queue enable row level security;
alter table public.catalog_quality_reports enable row level security;
alter table public.catalog_lookup_events enable row level security;

drop policy if exists "catalog_sources_read_all" on public.catalog_sources;
create policy "catalog_sources_read_all" on public.catalog_sources
  for select to authenticated using (true);

drop policy if exists "brands_read_all" on public.brands;
create policy "brands_read_all" on public.brands
  for select to authenticated using (true);

drop policy if exists "product_categories_read_all" on public.product_categories;
create policy "product_categories_read_all" on public.product_categories
  for select to authenticated using (true);

drop policy if exists "product_barcodes_read_all" on public.product_barcodes;
create policy "product_barcodes_read_all" on public.product_barcodes
  for select to authenticated using (true);

drop policy if exists "ingredient_tag_definitions_read_all" on public.ingredient_tag_definitions;
create policy "ingredient_tag_definitions_read_all" on public.ingredient_tag_definitions
  for select to authenticated using (true);

drop policy if exists "ingredient_tag_assignments_read_all" on public.ingredient_tag_assignments;
create policy "ingredient_tag_assignments_read_all" on public.ingredient_tag_assignments
  for select to authenticated using (true);

drop policy if exists "product_ingredient_lists_read_all" on public.product_ingredient_lists;
create policy "product_ingredient_lists_read_all" on public.product_ingredient_lists
  for select to authenticated using (true);

drop policy if exists "product_ingredient_tokens_read_all" on public.product_ingredient_tokens;
create policy "product_ingredient_tokens_read_all" on public.product_ingredient_tokens
  for select to authenticated using (true);

drop policy if exists "product_active_bands_read_all" on public.product_active_bands;
create policy "product_active_bands_read_all" on public.product_active_bands
  for select to authenticated using (true);

drop policy if exists "product_pao_expiry_read_all" on public.product_pao_expiry;
create policy "product_pao_expiry_read_all" on public.product_pao_expiry
  for select to authenticated using (true);

drop policy if exists "catalog_corrections_select_own" on public.catalog_corrections;
create policy "catalog_corrections_select_own" on public.catalog_corrections
  for select to authenticated using ((select auth.uid()) = user_id);

drop policy if exists "catalog_corrections_insert_own" on public.catalog_corrections;
create policy "catalog_corrections_insert_own" on public.catalog_corrections
  for insert to authenticated with check ((select auth.uid()) = user_id);

drop policy if exists "catalog_corrections_update_own" on public.catalog_corrections;
create policy "catalog_corrections_update_own" on public.catalog_corrections
  for update to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

drop policy if exists "catalog_lookup_events_select_own" on public.catalog_lookup_events;
create policy "catalog_lookup_events_select_own" on public.catalog_lookup_events
  for select to authenticated using ((select auth.uid()) = user_id);

drop policy if exists "catalog_lookup_events_insert_own" on public.catalog_lookup_events;
create policy "catalog_lookup_events_insert_own" on public.catalog_lookup_events
  for insert to authenticated with check ((select auth.uid()) = user_id);

insert into public.catalog_sources (
  source_key,
  display_name,
  source_url,
  license_name,
  license_url,
  attribution_text,
  attribution_url,
  requires_attribution,
  requires_share_alike,
  allows_images,
  production_approved,
  review_status,
  notes
) values
  ('curated', 'Layerwell curated catalog', null, 'Internal review', null, 'Curated by Layerwell reviewers.', null, false, false, false, false, 'pending', 'Requires reviewer workflow and launch QA before product recommendations.'),
  ('open_beauty_facts', 'Open Beauty Facts', 'https://world.openbeautyfacts.org/', 'Open Database License / Database Contents License / CC BY-SA images', 'https://openfoodfacts.github.io/openfoodfacts-server/api/', 'Product data from Open Beauty Facts/Open Food Facts.', 'https://world.openbeautyfacts.org/', true, true, false, false, 'pending', 'Images disabled until image-rights and share-alike handling are approved. Bulk import must use exports, not API crawling.'),
  ('cosing', 'European Commission CosIng', 'https://single-market-economy.ec.europa.eu/sectors/cosmetics/cosmetic-ingredient-database_en', 'European Commission reuse review required', null, 'Ingredient names and regulatory references from CosIng when approved.', 'https://single-market-economy.ec.europa.eu/sectors/cosmetics/cosmetic-ingredient-database_en', true, false, false, false, 'pending', 'Informative only. An INCI name in CosIng is not an approval or safety claim.'),
  ('brand_label', 'Brand or product label', null, 'Label/manufacturer source', null, 'Ingredient or expiry data recorded from product label or manufacturer source.', null, false, false, false, false, 'pending', 'Requires reviewer/source capture before driving recommendations.'),
  ('user_local', 'User local entry', null, 'User-entered local shelf data', null, 'User-entered product information.', null, false, false, false, true, 'draft', 'Can power the user shelf, but not global catalog recommendations unless reviewed.'),
  ('internal_derived', 'Internal derived field', null, 'Derived from sourced inputs', null, 'Derived by Layerwell parser or quality model.', null, false, false, false, false, 'pending', 'Must store parser/model version and upstream source.')
on conflict (source_key) do update set
  display_name = excluded.display_name,
  source_url = excluded.source_url,
  license_name = excluded.license_name,
  license_url = excluded.license_url,
  attribution_text = excluded.attribution_text,
  attribution_url = excluded.attribution_url,
  requires_attribution = excluded.requires_attribution,
  requires_share_alike = excluded.requires_share_alike,
  allows_images = excluded.allows_images,
  production_approved = excluded.production_approved,
  review_status = excluded.review_status,
  notes = excluded.notes,
  updated_at = now();

insert into public.product_categories (
  id,
  label,
  routine_role,
  default_pao_months,
  pao_source,
  is_sunscreen,
  is_otc_drug_candidate,
  review_status
) values
  ('cleanser', 'Cleanser', 'cleanser', null, 'unknown', false, false, 'needs_review'),
  ('toner', 'Toner / essence', 'toner', null, 'unknown', false, false, 'needs_review'),
  ('vitamin_c_serum', 'Vitamin C serum', 'antioxidant', null, 'unknown', false, false, 'needs_review'),
  ('retinoid_serum', 'Retinol / retinoid serum', 'treatment', null, 'unknown', false, false, 'needs_review'),
  ('serum', 'Serum', 'hydrating_serum', null, 'unknown', false, false, 'needs_review'),
  ('moisturiser_tube', 'Moisturiser (tube)', 'moisturiser', null, 'unknown', false, false, 'needs_review'),
  ('moisturiser_jar', 'Moisturiser (jar)', 'moisturiser', null, 'unknown', false, false, 'needs_review'),
  ('eye_cream', 'Eye cream', 'eye', null, 'unknown', false, false, 'needs_review'),
  ('lash_brow', 'Lash / brow serum', 'treatment', null, 'unknown', false, false, 'needs_review'),
  ('mascara', 'Mascara / liquid eye', null, null, 'unknown', false, false, 'needs_review'),
  ('spf', 'Sunscreen (SPF)', 'spf', null, 'label_required', true, true, 'needs_review'),
  ('oil_balm', 'Oil / balm', 'oil', null, 'unknown', false, false, 'needs_review'),
  ('benzoyl_peroxide', 'Benzoyl peroxide product', 'treatment', null, 'unknown', false, true, 'needs_review'),
  ('other', 'Something else', null, null, 'unknown', false, false, 'needs_review')
on conflict (id) do update set
  label = excluded.label,
  routine_role = excluded.routine_role,
  default_pao_months = excluded.default_pao_months,
  pao_source = excluded.pao_source,
  is_sunscreen = excluded.is_sunscreen,
  is_otc_drug_candidate = excluded.is_otc_drug_candidate,
  review_status = excluded.review_status;

insert into public.ingredient_tag_definitions (tag, label, tag_group, evidence_grade, consumer_copy, review_status)
values
  ('retinoid', 'Retinoid', 'active_family', 'B', 'Retinoid-family ingredient.', 'needs_review'),
  ('aha', 'AHA', 'active_family', 'B', 'Alpha-hydroxy acid family.', 'needs_review'),
  ('bha', 'BHA', 'active_family', 'B', 'Beta-hydroxy acid family.', 'needs_review'),
  ('benzoyl_peroxide', 'Benzoyl peroxide', 'active_family', 'B', 'Benzoyl peroxide product family.', 'needs_review'),
  ('vitamin_c', 'Vitamin C', 'active_family', 'C', 'Vitamin C family.', 'needs_review'),
  ('niacinamide', 'Niacinamide', 'active_family', 'C', 'Niacinamide family.', 'needs_review'),
  ('copper_peptide', 'Copper peptide', 'active_family', 'C', 'Copper peptide family.', 'needs_review'),
  ('hydroquinone', 'Hydroquinone', 'active_family', 'C', 'Hydroquinone family.', 'needs_review'),
  ('sunscreen', 'Sunscreen filter', 'uv_filter', 'A', 'UV filter family.', 'needs_review'),
  ('physical_spf', 'Mineral UV filter', 'uv_filter', 'A', 'Mineral UV filter family.', 'needs_review'),
  ('chemical_spf', 'Organic UV filter', 'uv_filter', 'A', 'Organic UV filter family.', 'needs_review'),
  ('humectant', 'Humectant', 'supporting_ingredient', 'C', 'Water-binding ingredient family.', 'needs_review'),
  ('ceramide', 'Ceramide', 'barrier_support', 'C', 'Ceramide family.', 'needs_review'),
  ('barrier', 'Barrier support', 'barrier_support', 'C', 'Barrier-supporting ingredient family.', 'needs_review')
on conflict (tag) do update set
  label = excluded.label,
  tag_group = excluded.tag_group,
  evidence_grade = excluded.evidence_grade,
  consumer_copy = excluded.consumer_copy,
  review_status = excluded.review_status;
