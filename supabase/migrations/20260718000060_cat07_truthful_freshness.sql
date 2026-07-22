begin;

-- Correct CAT-07 freshness provenance without rewriting the historical Shelf
-- migration. Sunscreen must use printed or product-specific reviewed data; an
-- unopened package without a printed date has no derived freshness date.

-- This legacy relation has no source, review, or reviewer columns. Its seeded
-- numbers were explicitly unreviewed and no runtime path reads it. Purge and
-- structurally seal it empty. Bounded product_categories rows remain editorial
-- metadata/future candidates, not current Shelf PAO authority.
delete from public.ingredient_pao_defaults;

drop policy if exists "ingredient_pao_defaults_read_all"
  on public.ingredient_pao_defaults;
alter table public.ingredient_pao_defaults enable row level security;
alter table public.ingredient_pao_defaults force row level security;
revoke all on table public.ingredient_pao_defaults
  from public, anon, authenticated, service_role;
alter table public.ingredient_pao_defaults
  drop constraint if exists ingredient_pao_defaults_legacy_empty,
  add constraint ingredient_pao_defaults_legacy_empty check (false);
comment on table public.ingredient_pao_defaults is
  'Sealed empty legacy compatibility relation. Bounded product_categories values are editorial metadata/future candidates, not current Shelf PAO authority.';

-- Catalog PAO is copied into an owner row as an admission-time evidence
-- snapshot. These identifiers intentionally have no foreign keys: later source
-- retirement or evidence removal must not rewrite the admitted claim or let an
-- owner row pin global catalog correction.
alter table public.user_products
  add column catalog_pao_evidence_id uuid,
  add column catalog_pao_source_id uuid,
  add column catalog_pao_region text,
  add column catalog_pao_recorded_at timestamptz,
  add column legacy_unverified_expiry_date date;

comment on column public.user_products.catalog_pao_evidence_id is
  'Server-stamped product_pao_expiry identity captured when a catalog PAO claim is admitted; deliberately not a foreign key.';
comment on column public.user_products.catalog_pao_source_id is
  'Server-stamped catalog source identity captured with catalog PAO evidence; deliberately not a foreign key.';
comment on column public.user_products.catalog_pao_region is
  'Server-stamped product/evidence region captured with catalog PAO evidence.';
comment on column public.user_products.catalog_pao_recorded_at is
  'Server timestamp at which a unique reviewed catalog PAO claim was admitted.';
comment on column public.user_products.legacy_unverified_expiry_date is
  'Retained non-actionable history for a catalog-linked expiry date whose physical lot/package was never bound; never drives expiry_computed.';

-- Apply the same engineering ceiling at every catalog admission table that can
-- feed a client freshness decision. Existing over-bound values are not treated
-- as evidence: product-specific rows retain any independently printed expiry
-- but lose the PAO claim, while category/product fallbacks are nulled and sent
-- back through review. This is an arithmetic and trust-boundary ceiling only;
-- it is not a regulatory limit or a statement of typical shelf life.
alter table public.product_pao_expiry
  drop constraint if exists product_pao_expiry_pao_months_check;
alter table public.product_categories
  drop constraint if exists product_categories_default_pao_months_check;
alter table public.products
  drop constraint if exists products_default_pao_months_check;

update public.product_pao_expiry
set pao_months = null,
    pao_source = 'unknown',
    expiry_source = case
      when expiry_date is not null
       and expiry_source in ('printed', 'label', 'manufacturer') then expiry_source
      else 'unknown'
    end
where pao_months > 120;

update public.product_pao_expiry
set expiry_source = 'unknown'
where expiry_source = 'pao_computed'
  and (
    pao_months is null
    or pao_months not between 1 and 120
    or pao_source not in ('label', 'brand_label', 'catalog')
  );

update public.product_categories
set default_pao_months = null,
    pao_source = 'unknown',
    review_status = case
      when review_status = 'reviewed' then 'needs_review'
      else review_status
    end
where default_pao_months > 120;

update public.products
set default_pao_months = null,
    review_status = case
      when review_status = 'reviewed' then 'needs_review'
      else review_status
    end,
    recommendation_eligible = case
      when review_status = 'reviewed' then false
      else recommendation_eligible
    end
where default_pao_months > 120;

alter table public.product_pao_expiry
  add constraint product_pao_expiry_pao_months_check
    check (pao_months is null or pao_months between 1 and 120),
  add constraint product_pao_expiry_pao_computed_coherent
    check (
      expiry_source <> 'pao_computed'
      or (
        pao_months between 1 and 120
        and pao_source in ('label', 'brand_label', 'catalog')
      )
    );
alter table public.product_categories
  add constraint product_categories_default_pao_months_check
    check (default_pao_months is null or default_pao_months between 1 and 120);
alter table public.products
  add constraint products_default_pao_months_check
    check (default_pao_months is null or default_pao_months between 1 and 120);

comment on constraint product_pao_expiry_pao_months_check
  on public.product_pao_expiry is
  '1..120 is a technical date-arithmetic and trust-boundary ceiling, not a regulatory or typical shelf-life claim.';
comment on constraint product_categories_default_pao_months_check
  on public.product_categories is
  '1..120 is a technical date-arithmetic and trust-boundary ceiling, not a regulatory or typical shelf-life claim.';
comment on constraint products_default_pao_months_check
  on public.products is
  '1..120 is a technical date-arithmetic and trust-boundary ceiling, not a regulatory or typical shelf-life claim.';

-- Catalog parent deletion invokes ON DELETE SET NULL as a nested UPDATE. The
-- general health-purpose guard normally requires a request epoch, which would
-- let an owner row pin a global catalog correction. Preserve every owner and
-- physical-package field, and bypass the epoch only for the exact nested FK
-- detach plus fields owned by the freshness triggers/generated expression.
create or replace function public._guard_direct_health_write()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_new_owner uuid;
  v_old_owner uuid;
begin
  if tg_table_schema = 'public'
     and tg_table_name = 'community_reports'
     and tg_op = 'UPDATE'
     and pg_catalog.pg_trigger_depth() > 1
     and nullif(pg_catalog.to_jsonb(old) ->> 'question_id', '') is not null
     and nullif(pg_catalog.to_jsonb(new) ->> 'question_id', '') is null
     and (pg_catalog.to_jsonb(old) - 'question_id')
       = (pg_catalog.to_jsonb(new) - 'question_id') then
    return new;
  end if;

  if tg_table_schema = 'public'
     and tg_table_name = 'catalog_corrections'
     and tg_name = 'trg_catalog_corrections_health_write'
     and tg_op = 'UPDATE'
     and pg_catalog.pg_trigger_depth() > 1
     and pg_catalog.array_length(tg_argv, 1) = 1
     and tg_argv[0] = 'user_id'
     and nullif(pg_catalog.to_jsonb(old) ->> 'product_id', '') is not null
     and nullif(pg_catalog.to_jsonb(new) ->> 'product_id', '') is null
     and (pg_catalog.to_jsonb(old) - 'product_id')
       = (pg_catalog.to_jsonb(new) - 'product_id')
     and not exists (
       select 1
       from public.products as parent_product
       where parent_product.id = (
         nullif(pg_catalog.to_jsonb(old) ->> 'product_id', '')
       )::uuid
     ) then
    return new;
  end if;

  if tg_table_schema = 'public'
     and tg_table_name = 'user_products'
     and tg_name = 'trg_user_products_health_write'
     and tg_op = 'UPDATE'
     and pg_catalog.pg_trigger_depth() > 1
     and pg_catalog.array_length(tg_argv, 1) = 1
     and tg_argv[0] = 'user_id'
     and (
       (
         old.catalog_product_id is not null
         and new.catalog_product_id is null
         and new.catalog_source_id is not distinct from old.catalog_source_id
         and not exists (
           select 1 from public.products as parent_product
           where parent_product.id = old.catalog_product_id
         )
       )
       or (
         old.catalog_source_id is not null
         and new.catalog_source_id is null
         and new.catalog_product_id is not distinct from old.catalog_product_id
         and not exists (
           select 1 from public.catalog_sources as parent_source
           where parent_source.id = old.catalog_source_id
         )
       )
     )
     and (
       pg_catalog.to_jsonb(old)
         - 'catalog_product_id'
         - 'catalog_source_id'
         - 'pao_months'
         - 'pao_source'
         - 'expiry_source'
         - 'expiry_computed'
         - 'catalog_pao_evidence_id'
         - 'catalog_pao_source_id'
         - 'catalog_pao_region'
         - 'catalog_pao_recorded_at'
     ) = (
       pg_catalog.to_jsonb(new)
         - 'catalog_product_id'
         - 'catalog_source_id'
         - 'pao_months'
         - 'pao_source'
         - 'expiry_source'
         - 'expiry_computed'
         - 'catalog_pao_evidence_id'
         - 'catalog_pao_source_id'
         - 'catalog_pao_region'
         - 'catalog_pao_recorded_at'
     ) then
    return new;
  end if;

  if pg_catalog.array_length(tg_argv, 1) not in (1, 2) then
    raise exception 'HEALTH_GUARD_CONFIGURATION_INVALID' using errcode = '55000';
  end if;

  begin
    v_new_owner := nullif(pg_catalog.to_jsonb(new) ->> tg_argv[0], '')::uuid;
    if tg_op = 'UPDATE' then
      v_old_owner := nullif(pg_catalog.to_jsonb(old) ->> tg_argv[0], '')::uuid;
    end if;
  exception when others then
    raise exception 'HEALTH_PROCESSING_OWNER_INVALID' using errcode = '22023';
  end;

  if tg_op = 'UPDATE' and v_old_owner is distinct from v_new_owner then
    raise exception 'HEALTH_PROCESSING_OWNER_IMMUTABLE' using errcode = '22023';
  end if;

  if pg_catalog.array_length(tg_argv, 1) = 2 then
    if not public._health_consent_type_protected(tg_argv[1]) then
      raise exception 'HEALTH_GUARD_CONFIGURATION_INVALID' using errcode = '55000';
    end if;
    perform public._assert_health_dependent_active_locked(v_new_owner, tg_argv[1]);
  else
    perform public._assert_health_processing_active_locked(v_new_owner);
  end if;
  return new;
end;
$$;

revoke all on function public._guard_direct_health_write()
  from public, anon, authenticated, service_role;

create or replace function private.resolve_catalog_pao_snapshot(
  p_catalog_product_id uuid,
  p_catalog_source_id uuid,
  p_pao_months integer
)
returns table (
  evidence_id uuid,
  source_id uuid,
  region text,
  match_count bigint
)
language sql
stable
security definer
set search_path = ''
as $$
  with eligible as (
    select
      freshness.id as evidence_id,
      freshness.source_id,
      freshness.region
    from public.product_pao_expiry as freshness
    join public.products as product
      on product.id = freshness.product_id
    join public.catalog_sources as source
      on source.id = freshness.source_id
    where p_catalog_product_id is not null
      and p_catalog_source_id is not null
      -- 120 months is only a technical arithmetic/trust-boundary ceiling. It
      -- is not a regulatory rule or a statement of typical product shelf life.
      and p_pao_months between 1 and 120
      and freshness.product_id = p_catalog_product_id
      and freshness.source_id = p_catalog_source_id
      and freshness.pao_months = p_pao_months
      and freshness.pao_months between 1 and 120
      and freshness.pao_source in ('label', 'brand_label', 'catalog')
      and freshness.review_status = 'reviewed'
      and nullif(pg_catalog.btrim(freshness.reviewed_by), '') is not null
      and freshness.region = product.region
      and freshness.source_id = product.source_id
      and product.source_id = p_catalog_source_id
      and source.source_key = product.source
      and product.review_status = 'reviewed'
      and private.catalog_product_is_servable(product.id)
      and private.catalog_source_is_production_approved(source.id)
  ), ranked as (
    select
      eligible.evidence_id,
      eligible.source_id,
      eligible.region,
      pg_catalog.count(*) over () as match_count
    from eligible
  )
  select ranked.evidence_id, ranked.source_id, ranked.region, ranked.match_count
  from ranked
  order by ranked.evidence_id
  limit 1
$$;

revoke all on function private.resolve_catalog_pao_snapshot(uuid, uuid, integer)
  from public, anon, authenticated, service_role;

alter table public.user_products
  drop constraint if exists user_products_expiry_source_coherent,
  drop constraint if exists user_products_pao_source_coherent,
  drop constraint if exists user_products_opened_state_coherent,
  drop constraint if exists user_products_catalog_pao_snapshot_coherent,
  drop constraint if exists user_products_expiry_quarantine_coherent,
  drop constraint if exists user_products_pao_months_check;

-- Migration backfills reduce or relabel existing health-purpose data without a
-- request-bound owner epoch. Disable only the admission trigger while the
-- transaction holds the migration-scoped table lock; it is restored before any
-- new invariant is installed and the transaction commits atomically.
alter table public.user_products
  disable trigger trg_user_products_health_write;

-- Values above 120 months exceed the single engineering ceiling used by every
-- admission path. Fail closed without touching opened_at or a printed date;
-- expiry_source is recomputed after all provenance repairs below.
update public.user_products
set pao_months = null,
    pao_source = 'unknown',
    catalog_pao_evidence_id = null,
    catalog_pao_source_id = null,
    catalog_pao_region = null,
    catalog_pao_recorded_at = null
where pao_months > 120;

-- A PAO number without a known source is not an eligible date candidate. Clear
-- the untrusted number so the generated expiry column cannot outrank a valid
-- printed date.
update public.user_products
set pao_months = null,
    pao_source = 'unknown'
where pao_source = 'unknown';

-- product_categories has no named reviewer, source snapshot, or retained
-- category-evidence identity. It therefore cannot authorize a health-purpose
-- Shelf estimate at launch. Quarantine every historical category_default claim;
-- the bounded catalog table remains editorial metadata, not Shelf evidence.
update public.user_products
set pao_months = null,
    pao_source = 'unknown'
where pao_source = 'category_default';

-- Backfill catalog provenance only when the same resolver used by new writes
-- finds exactly one reviewed, servable product-specific row. Ambiguous or
-- missing legacy claims fail closed below.
with unique_catalog_snapshot as (
  select
    shelf.id as shelf_id,
    snapshot.evidence_id,
    snapshot.source_id,
    snapshot.region
  from public.user_products as shelf
  cross join lateral private.resolve_catalog_pao_snapshot(
    shelf.catalog_product_id,
    shelf.catalog_source_id,
    shelf.pao_months
  ) as snapshot
  where shelf.pao_source = 'catalog'
    and snapshot.match_count = 1
)
update public.user_products as shelf
set catalog_pao_evidence_id = snapshot.evidence_id,
    catalog_pao_source_id = snapshot.source_id,
    catalog_pao_region = snapshot.region,
    catalog_pao_recorded_at = pg_catalog.statement_timestamp()
from unique_catalog_snapshot as snapshot
where shelf.id = snapshot.shelf_id;

update public.user_products
set pao_months = null,
    pao_source = 'unknown',
    catalog_pao_evidence_id = null,
    catalog_pao_source_id = null,
    catalog_pao_region = null,
    catalog_pao_recorded_at = null
where pao_source = 'catalog'
  and catalog_pao_evidence_id is null;

-- Earlier catalog intake copied a catalog-level expiry_date without binding it
-- to the user's physical lot/package. Retain that date for audit/recovery, but
-- remove it from the actionable field before recomputing expiry provenance.
update public.user_products
set legacy_unverified_expiry_date = expiry_date,
    expiry_date = null
where catalog_product_id is not null
  and expiry_date is not null;

update public.user_products
set expiry_source = case
  when is_opened = false and expiry_date is not null then 'printed'
  when is_opened = false then 'unknown'
  when expiry_computed is null then 'unknown'
  when expiry_date is not null and expiry_computed = expiry_date then 'printed'
  when pao_source = 'category_default' then 'estimated'
  when pao_source in ('label', 'catalog') then 'pao_computed'
  else 'unknown'
end;

alter table public.user_products
  enable trigger trg_user_products_health_write;

alter table public.user_products
  -- One engineering ceiling protects date arithmetic and the provenance trust
  -- boundary. 120 months is not a regulatory rule or typical shelf-life claim.
  add constraint user_products_pao_months_check
    check (pao_months is null or pao_months between 1 and 120),
  -- Mobile stores a device-local calendar date. Pin the server comparison to
  -- UTC and permit exactly its next calendar day so a user east of UTC is not
  -- rejected just after local midnight; day +2 remains invalid.
  add constraint user_products_opened_state_coherent
    check (
      (
        is_opened = true
        and opened_at is not null
        and opened_at <= ((pg_catalog.statement_timestamp() at time zone 'UTC')::date + 1)
      )
      or (is_opened = false and opened_at is null)
    ),
  add constraint user_products_pao_source_coherent
    check (
      (pao_months is null and pao_source = 'unknown')
      or (
        pao_months is not null
        and pao_source in ('label', 'catalog')
      )
    ),
  add constraint user_products_catalog_pao_snapshot_coherent
    check (
      (
        pao_source = 'catalog'
        and pao_months between 1 and 120
        and catalog_pao_evidence_id is not null
        and catalog_pao_source_id is not null
        and nullif(pg_catalog.btrim(catalog_pao_region), '') is not null
        and catalog_pao_recorded_at is not null
      )
      or (
        pao_source <> 'catalog'
        and catalog_pao_evidence_id is null
        and catalog_pao_source_id is null
        and catalog_pao_region is null
        and catalog_pao_recorded_at is null
      )
    ),
  add constraint user_products_expiry_quarantine_coherent
    check (
      expiry_date is null
      or legacy_unverified_expiry_date is null
    ),
  add constraint user_products_expiry_source_coherent
    check (
      expiry_source = case
        when is_opened = false and expiry_date is not null then 'printed'
        when is_opened = false then 'unknown'
        when expiry_computed is null then 'unknown'
        when expiry_date is not null and expiry_computed = expiry_date then 'printed'
        when pao_source = 'category_default' then 'estimated'
        when pao_source in ('label', 'catalog') then 'pao_computed'
        else 'unknown'
      end
    );

-- A catalog PAO snapshot is stamped only by the database. The app supplies the
-- product identity and month claim; zero or multiple eligible evidence rows are
-- both rejected. Once admitted, unrelated owner edits copy the complete OLD
-- snapshot without consulting mutable catalog state.
create or replace function private.guard_user_product_catalog_pao_snapshot()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_evidence_id uuid;
  v_source_id uuid;
  v_region text;
  v_match_count bigint;
begin
  -- A mirror retry may resend identities cached before an FK parent deletion.
  -- Once an admitted claim is detached, coerce any same-claim relink attempt
  -- back to NULL; the independent snapshot remains authoritative and a
  -- deliberate relink must start a new claim instead of restoring stale IDs.
  if tg_op = 'UPDATE'
     and old.pao_source = 'catalog'
     and new.pao_source = 'catalog'
     and new.pao_months is not distinct from old.pao_months then
    if old.catalog_product_id is null and new.catalog_product_id is not null then
      new.catalog_product_id := null;
    end if;
    if old.catalog_source_id is null and new.catalog_source_id is not null then
      new.catalog_source_id := null;
    end if;
  end if;

  -- This history field is database-owned. New/replacement units never inherit
  -- it, unrelated edits preserve it, and a newly confirmed exact physical date
  -- atomically clears it before the coherence CHECK runs.
  if tg_op = 'INSERT' then
    new.legacy_unverified_expiry_date := null;
  elsif new.catalog_product_id is distinct from old.catalog_product_id
        and new.catalog_product_id is not null then
    new.legacy_unverified_expiry_date := null;
  elsif old.expiry_date is null and new.expiry_date is not null then
    new.legacy_unverified_expiry_date := null;
  else
    new.legacy_unverified_expiry_date := old.legacy_unverified_expiry_date;
  end if;

  if new.pao_source <> 'catalog' then
    new.catalog_pao_evidence_id := null;
    new.catalog_pao_source_id := null;
    new.catalog_pao_region := null;
    new.catalog_pao_recorded_at := null;
    return new;
  end if;

  if tg_op = 'UPDATE' then
    if old.pao_source = 'catalog'
       and new.pao_months is not distinct from old.pao_months
       and (
         new.catalog_product_id is not distinct from old.catalog_product_id
         or (old.catalog_product_id is not null and new.catalog_product_id is null)
       )
       and (
         new.catalog_source_id is not distinct from old.catalog_source_id
         or (old.catalog_source_id is not null and new.catalog_source_id is null)
       ) then
      new.catalog_pao_evidence_id := old.catalog_pao_evidence_id;
      new.catalog_pao_source_id := old.catalog_pao_source_id;
      new.catalog_pao_region := old.catalog_pao_region;
      new.catalog_pao_recorded_at := old.catalog_pao_recorded_at;
      return new;
    end if;
  end if;

  select
    snapshot.evidence_id,
    snapshot.source_id,
    snapshot.region,
    snapshot.match_count
    into v_evidence_id, v_source_id, v_region, v_match_count
    from private.resolve_catalog_pao_snapshot(
      new.catalog_product_id,
      new.catalog_source_id,
      new.pao_months
    ) as snapshot;

  if v_match_count is distinct from 1 then
    raise exception 'USER_PRODUCT_CATALOG_PAO_EVIDENCE_INVALID'
      using errcode = '23514',
            constraint = 'user_products_catalog_pao_snapshot_valid';
  end if;

  new.catalog_pao_evidence_id := v_evidence_id;
  new.catalog_pao_source_id := v_source_id;
  new.catalog_pao_region := v_region;
  new.catalog_pao_recorded_at := pg_catalog.statement_timestamp();
  return new;
end;
$$;

revoke all on function private.guard_user_product_catalog_pao_snapshot()
  from public, anon, authenticated, service_role;

-- Category defaults are not launch evidence: product_categories lacks a named
-- reviewer/source snapshot and the served payload lacks an exact attestation.
-- Coerce every attempted category claim to unknown without touching opened or
-- physical-package dates. This also guarantees no Shelf row can pin a product,
-- category, or catalog-source lifecycle operation.
create or replace function private.guard_user_product_category_default_evidence()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.pao_source <> 'category_default' then
    return new;
  end if;

  new.pao_months := null;
  new.pao_source := 'unknown';
  new.expiry_source := case
    when new.expiry_date is not null then 'printed'
    else 'unknown'
  end;
  return new;
end;
$$;

revoke all on function private.guard_user_product_category_default_evidence()
  from public, anon, authenticated, service_role;

drop trigger if exists trg_user_products_catalog_pao_snapshot
  on public.user_products;
create trigger trg_user_products_catalog_pao_snapshot
  before insert or update on public.user_products
  for each row execute function private.guard_user_product_catalog_pao_snapshot();

drop trigger if exists trg_user_products_category_default_evidence
  on public.user_products;
create trigger trg_user_products_category_default_evidence
  before insert or update on public.user_products
  for each row execute function private.guard_user_product_category_default_evidence();

commit;
