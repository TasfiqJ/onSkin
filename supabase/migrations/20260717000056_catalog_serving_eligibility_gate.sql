-- =============================================================================
-- 0056 · Fail-closed production catalog serving eligibility
-- =============================================================================
-- A catalog row is not safe to serve merely because it is not explicitly
-- blocked. Barcode lookup, indexed search, recommendation reads, and direct
-- authenticated catalog reads must all require the same positive source,
-- product-review, quality, and correction evidence.

-- User reports are untrusted intake, not global serving authority.  These
-- audit columns are new in this migration, so no legacy client-written status
-- can masquerade as an operator-reviewed hold.  Only the sealed review RPC
-- below can populate them after direct service/authenticated UPDATE is revoked.
alter table public.catalog_corrections
  add column if not exists operator_reviewed_at timestamptz,
  add column if not exists operator_reviewed_by text,
  add column if not exists operator_review_note text;

create index if not exists catalog_corrections_product_operator_hold_idx
  on public.catalog_corrections (product_id, operator_reviewed_at)
  where product_id is not null
    and status in ('triaged', 'accepted')
    and operator_reviewed_at is not null;

-- Product rollback must not require a reporter's live health-processing epoch.
-- PostgreSQL implements ON DELETE SET NULL as a nested UPDATE on the child.
-- Preserve the correction/audit record while permitting only that exact
-- referential detach: product_id becomes NULL, every other value is unchanged,
-- and the referenced parent has already disappeared. A direct UPDATE remains
-- trigger depth 1 and therefore continues through the normal epoch guard.
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

-- Direct authenticated catalog reads need the same live, cross-owner
-- correction check as the service RPCs.  Keep the predicate in the unexposed
-- `private` schema so PostgREST callers cannot use it as an eligibility oracle
-- for arbitrary product ids.  The authenticated role may execute it only from
-- stored RLS policy expressions because that role has no USAGE on `private`.
create or replace function private.catalog_source_is_production_approved(
  p_source_id uuid
)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.catalog_sources as source
    where source.id = p_source_id
      and source.production_approved is true
      and source.review_status = 'legal_approved'
      and nullif(pg_catalog.btrim(source.reviewed_by), '') is not null
      and source.reviewed_at is not null
      and source.reviewed_at <= pg_catalog.now()
      and (
        source.requires_attribution is false
        or (
          nullif(pg_catalog.btrim(source.attribution_text), '') is not null
          and nullif(pg_catalog.btrim(source.attribution_url), '') is not null
        )
      )
  )
$$;

revoke all on function private.catalog_source_is_production_approved(uuid)
  from public, anon, authenticated, service_role;
grant execute on function private.catalog_source_is_production_approved(uuid)
  to authenticated;

create or replace function private.catalog_product_is_servable(
  p_product_id uuid
)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.products as product
    join public.catalog_sources as source
      on source.id = product.source_id
     and source.source_key = product.source
     and source.production_approved is true
     and source.review_status = 'legal_approved'
     and nullif(pg_catalog.btrim(source.reviewed_by), '') is not null
     and source.reviewed_at is not null
     and source.reviewed_at <= pg_catalog.now()
     and (
       source.requires_attribution is false
       or (
         nullif(pg_catalog.btrim(source.attribution_text), '') is not null
         and nullif(pg_catalog.btrim(source.attribution_url), '') is not null
       )
     )
    where product.id = p_product_id
      and product.region = 'US'
      and product.status = 'active'
      and product.review_status = 'reviewed'
      and product.last_reviewed_at is not null
      and product.last_reviewed_at <= pg_catalog.now()
      and product.quality_grade in ('verified', 'usable')
      and product.recommendation_eligible is true
      and product.unresolved_correction_count = 0
      and nullif(pg_catalog.btrim(product.source_ref), '') is not null
      and product.source_snapshot_date is not null
      and product.source_snapshot_date <= current_date
      and not exists (
        select 1
        from public.catalog_corrections as correction
        where correction.product_id = product.id
          and correction.status in ('triaged', 'accepted')
          and correction.operator_reviewed_at is not null
          and correction.operator_reviewed_at <= pg_catalog.now()
          and nullif(pg_catalog.btrim(correction.operator_reviewed_by), '') is not null
          and nullif(pg_catalog.btrim(correction.operator_review_note), '') is not null
      )
  )
$$;

revoke all on function private.catalog_product_is_servable(uuid)
  from public, anon, authenticated, service_role;
grant execute on function private.catalog_product_is_servable(uuid)
  to authenticated;

create or replace function private.catalog_ingredient_list_is_servable(
  p_ingredient_list_id uuid,
  p_product_id uuid
)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.product_ingredient_lists as ingredient_list
    where ingredient_list.id = p_ingredient_list_id
      and ingredient_list.product_id = p_product_id
      and ingredient_list.review_status = 'reviewed'
      and private.catalog_source_is_production_approved(ingredient_list.source_id)
      and private.catalog_product_is_servable(ingredient_list.product_id)
  )
$$;

revoke all on function private.catalog_ingredient_list_is_servable(uuid, uuid)
  from public, anon, authenticated, service_role;
grant execute on function private.catalog_ingredient_list_is_servable(uuid, uuid)
  to authenticated;

-- A user-owned correction is untrusted intake. Do not let a PostgREST caller
-- bypass Edge minimization, choose workflow/operator fields, or manufacture an
-- availability attack against reviewed products. The service-only RPC fixes
-- the status to `open`, rechecks the exact health epoch and account state, and
-- applies an account-serialized intake limit. Open rows never become global
-- holds until the separate operator-review RPC records explicit audit evidence.
create or replace function public.submit_catalog_correction(
  p_user_id uuid,
  p_expected_health_epoch bigint,
  p_product_id uuid,
  p_barcode text,
  p_correction_type text,
  p_description text,
  p_proposed_payload jsonb,
  p_client_context jsonb
)
returns table (
  id uuid,
  status text,
  created_at timestamptz
)
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v_now timestamptz := pg_catalog.now();
  v_id uuid;
  v_created_at timestamptz;
begin
  if p_user_id is null
     or p_expected_health_epoch is null
     or p_expected_health_epoch < 1
     or p_expected_health_epoch is distinct from public._request_health_processing_epoch()
     or not public.account_write_allowed(p_user_id) then
    raise exception 'CATALOG_REPORT_AUTHORITY_INVALID' using errcode = '42501';
  end if;

  perform public._assert_health_processing_epoch_locked(
    p_user_id,
    p_expected_health_epoch
  );

  if p_product_id is not null
     and not exists (
       select 1 from public.products as product where product.id = p_product_id
     ) then
    raise exception 'CATALOG_REPORT_PRODUCT_INVALID' using errcode = '22023';
  end if;

  if (p_barcode is not null and p_barcode !~ '^[0-9]{8,14}$')
     or p_correction_type is null
     or p_correction_type not in (
       'wrong_match',
       'missing_product',
       'ingredient_issue',
       'duplicate',
       'source_issue',
       'expiry_issue',
       'category_issue'
     )
     or (
       p_description is not null
       and (
         p_description is distinct from pg_catalog.btrim(p_description)
         or pg_catalog.length(p_description) < 1
         or pg_catalog.length(p_description) > 500
       )
     )
     or pg_catalog.jsonb_typeof(p_proposed_payload) is distinct from 'object'
     or pg_catalog.jsonb_typeof(p_client_context) is distinct from 'object'
     or pg_catalog.pg_column_size(p_proposed_payload) > 4096
     or pg_catalog.pg_column_size(p_client_context) > 4096
     or exists (
       select 1
       from pg_catalog.jsonb_object_keys(p_proposed_payload) as key(value)
       where key.value not in (
         'productName',
         'brand',
         'barcode',
         'category',
         'ingredientsText',
         'sourceUrl',
         'sourceName',
         'defaultPaoMonths',
         'qualityIssue',
         'suggestedCorrection'
       )
     )
     or exists (
       select 1
       from pg_catalog.jsonb_object_keys(p_client_context) as key(value)
       where key.value not in (
         'addedVia',
         'quality',
         'source',
         'platform',
         'appVersion',
         'buildNumber',
         'route'
       )
     ) then
    raise exception 'CATALOG_REPORT_INPUT_INVALID' using errcode = '22023';
  end if;

  -- account_write_allowed() and the health assertion hold the owner advisory
  -- lock, so concurrent requests cannot race this fixed-window count.
  if (
    select count(*)
    from public.catalog_corrections as correction
    where correction.user_id = p_user_id
      and correction.created_at >= v_now - interval '15 minutes'
  ) >= 20 then
    raise exception 'CATALOG_REPORT_RATE_LIMITED' using errcode = 'P0001';
  end if;

  insert into public.catalog_corrections as correction (
    user_id,
    product_id,
    barcode,
    correction_type,
    status,
    description,
    proposed_payload,
    client_context,
    assigned_to,
    resolved_by,
    resolution_note,
    source_id,
    operator_reviewed_at,
    operator_reviewed_by,
    operator_review_note
  ) values (
    p_user_id,
    p_product_id,
    p_barcode,
    p_correction_type,
    'open',
    p_description,
    p_proposed_payload,
    p_client_context,
    null,
    null,
    null,
    null,
    null,
    null,
    null
  )
  returning correction.id, correction.created_at
    into v_id, v_created_at;

  return query select v_id, 'open'::text, v_created_at;
end;
$$;

comment on function public.submit_catalog_correction(
  uuid, bigint, uuid, text, text, text, jsonb, jsonb
) is
  'Service-only, exact-health-epoch-bound catalog correction intake.';

revoke all on function public.submit_catalog_correction(
  uuid, bigint, uuid, text, text, text, jsonb, jsonb
) from public, anon, authenticated;
grant execute on function public.submit_catalog_correction(
  uuid, bigint, uuid, text, text, text, jsonb, jsonb
) to service_role;

-- The operator lane is the sole way to convert untrusted intake into a global
-- catalog hold.  It is exact-health-epoch bound because correction details are
-- user-owned health-adjacent data, and every hold carries a bounded operational
-- reviewer alias, note, and database timestamp.  `accepted` remains held until
-- a later reviewed transition closes it after the catalog row is repaired.
create or replace function public.review_catalog_correction(
  p_correction_id uuid,
  p_expected_health_epoch bigint,
  p_review_status text,
  p_reviewed_by text,
  p_review_note text
)
returns table (
  id uuid,
  status text,
  operator_reviewed_at timestamptz
)
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v_initial_user_id uuid;
  v_correction public.catalog_corrections%rowtype;
  v_now timestamptz := pg_catalog.now();
begin
  if p_correction_id is null
     or p_expected_health_epoch is null
     or p_expected_health_epoch < 1
     or p_review_status is null
     or p_review_status not in ('triaged', 'accepted', 'rejected', 'closed')
     or p_reviewed_by is null
     or p_reviewed_by is distinct from pg_catalog.btrim(p_reviewed_by)
     or p_reviewed_by !~ '^[A-Za-z0-9][A-Za-z0-9._@:+/-]{2,199}$'
     or p_review_note is null
     or p_review_note is distinct from pg_catalog.btrim(p_review_note)
     or pg_catalog.length(p_review_note) not between 1 and 1000
     or not pg_catalog.isfinite(v_now) then
    raise exception 'CATALOG_CORRECTION_REVIEW_INPUT_INVALID' using errcode = '22023';
  end if;

  select correction.user_id
    into v_initial_user_id
    from public.catalog_corrections as correction
   where correction.id = p_correction_id;
  if not found then
    raise exception 'CATALOG_CORRECTION_REVIEW_NOT_FOUND' using errcode = '22023';
  end if;

  if p_expected_health_epoch is distinct from public._request_health_processing_epoch()
     or not public.account_write_allowed(v_initial_user_id) then
    raise exception 'CATALOG_CORRECTION_REVIEW_AUTHORITY_INVALID' using errcode = '42501';
  end if;
  perform public._assert_health_processing_epoch_locked(
    v_initial_user_id,
    p_expected_health_epoch
  );

  select correction.*
    into v_correction
    from public.catalog_corrections as correction
   where correction.id = p_correction_id
     and correction.user_id = v_initial_user_id
   for update;
  if not found then
    raise exception 'CATALOG_CORRECTION_REVIEW_NOT_FOUND' using errcode = '22023';
  end if;

  if not (
    (v_correction.status = 'open'
      and p_review_status in ('triaged', 'rejected', 'closed'))
    or (v_correction.status = 'triaged'
      and p_review_status in ('accepted', 'rejected', 'closed'))
    or (v_correction.status = 'accepted' and p_review_status = 'closed')
  ) then
    raise exception 'CATALOG_CORRECTION_REVIEW_TRANSITION_INVALID' using errcode = '55000';
  end if;

  update public.catalog_corrections as correction
     set status = p_review_status,
         assigned_to = case
           when p_review_status in ('triaged', 'accepted') then p_reviewed_by
           else correction.assigned_to
         end,
         resolved_by = case
           when p_review_status in ('rejected', 'closed') then p_reviewed_by
           else correction.resolved_by
         end,
         resolution_note = p_review_note,
         operator_reviewed_at = v_now,
         operator_reviewed_by = p_reviewed_by,
         operator_review_note = p_review_note,
         updated_at = v_now
   where correction.id = p_correction_id
  returning correction.id, correction.status, correction.operator_reviewed_at
    into id, status, operator_reviewed_at;

  return next;
end;
$$;

comment on function public.review_catalog_correction(uuid, bigint, text, text, text) is
  'Service-only audited transition from untrusted intake to an operator-reviewed catalog hold or resolution.';

revoke all on function public.review_catalog_correction(uuid, bigint, text, text, text)
  from public, anon, authenticated;
grant execute on function public.review_catalog_correction(uuid, bigint, text, text, text)
  to service_role;

-- The denormalized product projection counts only operator-audited holds. An
-- ordinary `open` report therefore enters the queue without giving one account
-- a cross-user product takedown primitive.
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

  update public.products as product
     set unresolved_correction_count = (
       select count(*)::int
       from public.catalog_corrections as correction
       where correction.product_id = p_product_id
         and correction.status in ('triaged', 'accepted')
         and correction.operator_reviewed_at is not null
         and correction.operator_reviewed_at <= pg_catalog.now()
         and nullif(pg_catalog.btrim(correction.operator_reviewed_by), '') is not null
         and nullif(pg_catalog.btrim(correction.operator_review_note), '') is not null
     ),
     recommendation_eligible =
       product.quality_grade in ('verified', 'usable')
       and product.review_status = 'reviewed'
       and product.status = 'active'
       and (
         select count(*)
         from public.catalog_corrections as correction
         where correction.product_id = p_product_id
           and correction.status in ('triaged', 'accepted')
           and correction.operator_reviewed_at is not null
           and correction.operator_reviewed_at <= pg_catalog.now()
           and nullif(pg_catalog.btrim(correction.operator_reviewed_by), '') is not null
           and nullif(pg_catalog.btrim(correction.operator_review_note), '') is not null
       ) = 0
   where product.id = p_product_id;
end;
$$;

revoke all on function public.refresh_product_correction_count(uuid)
  from public, anon, authenticated, service_role;

with operator_holds as (
  select product.id,
         count(correction.id)::int as hold_count
  from public.products as product
  left join public.catalog_corrections as correction
    on correction.product_id = product.id
   and correction.status in ('triaged', 'accepted')
   and correction.operator_reviewed_at is not null
   and correction.operator_reviewed_at <= pg_catalog.now()
   and nullif(pg_catalog.btrim(correction.operator_reviewed_by), '') is not null
   and nullif(pg_catalog.btrim(correction.operator_review_note), '') is not null
  group by product.id
)
update public.products as product
   set unresolved_correction_count = operator_holds.hold_count,
       recommendation_eligible =
         product.quality_grade in ('verified', 'usable')
         and product.review_status = 'reviewed'
         and product.status = 'active'
         and operator_holds.hold_count = 0
  from operator_holds
 where operator_holds.id = product.id;

drop policy if exists "catalog_corrections_insert_own" on public.catalog_corrections;
drop policy if exists "catalog_corrections_update_own" on public.catalog_corrections;
revoke insert, update, delete on public.catalog_corrections
  from public, anon, authenticated;
revoke insert, update, delete on public.catalog_corrections from service_role;

create or replace view public.catalog_servable_products
with (security_invoker = true)
as
select
  p.id,
  p.barcode,
  p.name,
  p.brand,
  p.category,
  p.region,
  p.default_pao_months,
  p.source,
  p.source_id as catalog_source_id,
  p.source_ref,
  p.source_url,
  p.source_snapshot_date,
  p.quality_grade,
  p.review_status,
  p.data_quality_score,
  p.ingredient_parse_status,
  p.ingredient_parse_confidence,
  jsonb_build_object(
    'id', cs.id,
    'display_name', cs.display_name,
    'source_key', cs.source_key,
    'attribution_text', cs.attribution_text,
    'attribution_url', cs.attribution_url
  ) as catalog_sources,
  coalesce(
    (
      select jsonb_agg(
        jsonb_build_object(
          'pao_months', freshness.pao_months,
          'pao_source', freshness.pao_source,
          'expiry_date', freshness.expiry_date,
          'expiry_source', freshness.expiry_source,
          'region', freshness.region,
          'source_id', freshness.source_id,
          'review_status', freshness.review_status,
          'created_at', freshness.created_at
        )
        order by freshness.created_at desc, freshness.id
      )
      from public.product_pao_expiry as freshness
      join public.catalog_sources as freshness_source
        on freshness_source.id = freshness.source_id
       and freshness_source.production_approved is true
       and freshness_source.review_status = 'legal_approved'
       and nullif(pg_catalog.btrim(freshness_source.reviewed_by), '') is not null
       and freshness_source.reviewed_at is not null
       and freshness_source.reviewed_at <= pg_catalog.now()
       and (
         freshness_source.requires_attribution is false
         or (
           nullif(pg_catalog.btrim(freshness_source.attribution_text), '') is not null
           and nullif(pg_catalog.btrim(freshness_source.attribution_url), '') is not null
         )
       )
      where freshness.product_id = p.id
        and freshness.review_status = 'reviewed'
        and nullif(pg_catalog.btrim(freshness.reviewed_by), '') is not null
        and freshness.region = p.region
    ),
    '[]'::jsonb
  ) as product_pao_expiry
from public.products as p
join public.catalog_sources as cs
  on cs.id = p.source_id
 and cs.source_key = p.source
 and cs.production_approved is true
 and cs.review_status = 'legal_approved'
 and nullif(pg_catalog.btrim(cs.reviewed_by), '') is not null
 and cs.reviewed_at is not null
 and cs.reviewed_at <= pg_catalog.now()
 and (
   cs.requires_attribution is false
   or (
     nullif(pg_catalog.btrim(cs.attribution_text), '') is not null
     and nullif(pg_catalog.btrim(cs.attribution_url), '') is not null
   )
 )
where p.region = 'US'
  and p.status = 'active'
  and p.review_status = 'reviewed'
  and p.last_reviewed_at is not null
  and p.last_reviewed_at <= pg_catalog.now()
  and p.quality_grade in ('verified', 'usable')
  and p.recommendation_eligible is true
  and p.unresolved_correction_count = 0
  and nullif(pg_catalog.btrim(p.source_ref), '') is not null
  and p.source_snapshot_date is not null
  and p.source_snapshot_date <= current_date
  and not exists (
    select 1
    from public.catalog_corrections as correction
    where correction.product_id = p.id
      and correction.status in ('triaged', 'accepted')
      and correction.operator_reviewed_at is not null
      and correction.operator_reviewed_at <= pg_catalog.now()
      and nullif(pg_catalog.btrim(correction.operator_reviewed_by), '') is not null
      and nullif(pg_catalog.btrim(correction.operator_review_note), '') is not null
  );

comment on view public.catalog_servable_products is
  'Service-only positive eligibility boundary for production catalog responses.';

revoke all on public.catalog_servable_products
  from public, anon, authenticated, service_role;

-- The exact barcode mapping itself must also have completed review. Returning
-- zero rows is intentional for every ineligible or unknown match so the Edge
-- handler follows its existing no-match/manual-entry branch without leaking
-- the reason a candidate is held back.
create or replace function public.lookup_catalog_product_by_barcode(
  p_barcode text
)
returns table (
  id uuid,
  barcode text,
  name text,
  brand text,
  category text,
  region text,
  default_pao_months integer,
  source text,
  catalog_source_id uuid,
  source_ref text,
  source_url text,
  source_snapshot_date date,
  quality_grade text,
  review_status text,
  data_quality_score numeric,
  ingredient_parse_status text,
  ingredient_parse_confidence numeric,
  catalog_sources jsonb,
  product_pao_expiry jsonb
)
language sql
stable
security definer
set search_path = ''
as $$
  select
    product.id,
    product.barcode,
    product.name,
    product.brand,
    product.category,
    product.region,
    product.default_pao_months,
    product.source,
    product.catalog_source_id,
    product.source_ref,
    product.source_url,
    product.source_snapshot_date,
    product.quality_grade,
    product.review_status,
    product.data_quality_score,
    product.ingredient_parse_status,
    product.ingredient_parse_confidence,
    product.catalog_sources,
    product.product_pao_expiry
  from public.product_barcodes as mapping
  join public.catalog_sources as mapping_source
    on mapping_source.id = mapping.source_id
   and mapping_source.production_approved is true
   and mapping_source.review_status = 'legal_approved'
   and nullif(pg_catalog.btrim(mapping_source.reviewed_by), '') is not null
   and mapping_source.reviewed_at is not null
   and mapping_source.reviewed_at <= pg_catalog.now()
   and (
     mapping_source.requires_attribution is false
     or (
       nullif(pg_catalog.btrim(mapping_source.attribution_text), '') is not null
       and nullif(pg_catalog.btrim(mapping_source.attribution_url), '') is not null
     )
   )
  join public.catalog_servable_products as product
    on product.id = mapping.product_id
  where mapping.barcode = p_barcode
    and mapping.review_status = 'reviewed'
    and mapping.source_id = product.catalog_source_id
  limit 1
$$;

comment on function public.lookup_catalog_product_by_barcode(text) is
  'Service-only exact barcode lookup over legally and operationally eligible catalog rows.';

revoke all on function public.lookup_catalog_product_by_barcode(text)
  from public, anon, authenticated;
grant execute on function public.lookup_catalog_product_by_barcode(text)
  to service_role;

-- Replace the earlier broad Shelf search. Normalization and deterministic
-- ranking remain unchanged, but the query can only see the central servable
-- relation and therefore cannot drift to weaker eligibility semantics.
create or replace function public.search_catalog_products(
  p_query text,
  p_limit integer default 10
)
returns table (
  id uuid,
  barcode text,
  name text,
  brand text,
  category text,
  region text,
  default_pao_months integer,
  source text,
  catalog_source_id uuid,
  source_ref text,
  source_url text,
  source_snapshot_date date,
  quality_grade text,
  review_status text,
  data_quality_score numeric,
  ingredient_parse_status text,
  ingredient_parse_confidence numeric,
  catalog_sources jsonb,
  product_pao_expiry jsonb
)
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_query text;
  v_pattern text;
  v_limit integer := least(greatest(coalesce(p_limit, 10), 1), 20);
begin
  v_query := left(
    lower(
      regexp_replace(
        trim(
          replace(
            translate(coalesce(p_query, ''), '%_,()', '     '),
            chr(92),
            ' '
          )
        ),
        '[[:space:]]+',
        ' ',
        'g'
      )
    ),
    80
  );

  if char_length(v_query) < 2 then
    return;
  end if;

  v_pattern := '%' || v_query || '%';

  return query
  select
    product.id,
    product.barcode,
    product.name,
    product.brand,
    product.category,
    product.region,
    product.default_pao_months,
    product.source,
    product.catalog_source_id,
    product.source_ref,
    product.source_url,
    product.source_snapshot_date,
    product.quality_grade,
    product.review_status,
    product.data_quality_score,
    product.ingredient_parse_status,
    product.ingredient_parse_confidence,
    product.catalog_sources,
    product.product_pao_expiry
  from public.catalog_servable_products as product
  where lower(product.name) like v_pattern
     or lower(coalesce(product.brand, '')) like v_pattern
  order by product.data_quality_score desc, lower(product.name), product.id
  limit v_limit;
end;
$$;

comment on function public.search_catalog_products(text, integer) is
  'Service-only indexed substring search over legally and operationally eligible catalog rows.';

revoke all on function public.search_catalog_products(text, integer)
  from public, anon, authenticated;
grant execute on function public.search_catalog_products(text, integer)
  to service_role;

-- Close the direct authenticated REST bypass as well. The service-role RPCs
-- above and direct client policies both use the stronger live NOT EXISTS
-- correction check.  Product-linked child tables must independently carry a
-- reviewed, production-approved source so an eligible parent cannot launder a
-- held ingredient, concentration, barcode, or freshness row.
-- Source-review identities, timestamps, and free-form operator notes are not
-- a public catalog surface. Clients receive the bounded attribution object
-- embedded by the service-only lookup/search RPCs instead.
drop policy if exists "catalog_sources_read_all" on public.catalog_sources;
revoke select on public.catalog_sources from public, anon, authenticated;

drop policy if exists "products_read_all" on public.products;
drop policy if exists "products_read_servable" on public.products;
create policy "products_read_servable" on public.products
  for select to authenticated
  using (private.catalog_product_is_servable(id));

drop policy if exists "product_barcodes_read_all" on public.product_barcodes;
drop policy if exists "product_barcodes_read_servable" on public.product_barcodes;
create policy "product_barcodes_read_servable" on public.product_barcodes
  for select to authenticated
  using (
    review_status = 'reviewed'
    and private.catalog_source_is_production_approved(source_id)
    and private.catalog_product_is_servable(product_id)
    and exists (
      select 1
      from public.products as parent_product
      where parent_product.id = product_barcodes.product_id
        and parent_product.source_id = product_barcodes.source_id
    )
  );

drop policy if exists "product_ingredients_read_all" on public.product_ingredients;
drop policy if exists "product_ingredients_read_servable" on public.product_ingredients;
create policy "product_ingredients_read_servable" on public.product_ingredients
  for select to authenticated
  using (
    private.catalog_source_is_production_approved(source_id)
    and private.catalog_ingredient_list_is_servable(ingredient_list_id, product_id)
  );

drop policy if exists "product_ingredient_lists_read_all" on public.product_ingredient_lists;
drop policy if exists "product_ingredient_lists_read_servable" on public.product_ingredient_lists;
create policy "product_ingredient_lists_read_servable" on public.product_ingredient_lists
  for select to authenticated
  using (private.catalog_ingredient_list_is_servable(id, product_id));

drop policy if exists "product_ingredient_tokens_read_all" on public.product_ingredient_tokens;
drop policy if exists "product_ingredient_tokens_read_servable" on public.product_ingredient_tokens;
create policy "product_ingredient_tokens_read_servable" on public.product_ingredient_tokens
  for select to authenticated
  using (
    private.catalog_source_is_production_approved(source_id)
    and private.catalog_ingredient_list_is_servable(ingredient_list_id, product_id)
  );

drop policy if exists "product_active_bands_read_all" on public.product_active_bands;
drop policy if exists "product_active_bands_read_servable" on public.product_active_bands;
create policy "product_active_bands_read_servable" on public.product_active_bands
  for select to authenticated
  using (
    review_status = 'reviewed'
    and private.catalog_source_is_production_approved(source_id)
    and private.catalog_product_is_servable(product_id)
  );

drop policy if exists "product_pao_expiry_read_all" on public.product_pao_expiry;
drop policy if exists "product_pao_expiry_read_servable" on public.product_pao_expiry;
create policy "product_pao_expiry_read_servable" on public.product_pao_expiry
  for select to authenticated
  using (
    review_status = 'reviewed'
    and nullif(pg_catalog.btrim(reviewed_by), '') is not null
    and region = 'US'
    and private.catalog_source_is_production_approved(source_id)
    and private.catalog_product_is_servable(product_id)
  );

-- Preserve the legacy view shape without requiring its authenticated invoker
-- to read catalog_sources. The sealed helper performs the source/legal gate;
-- the base products RLS independently applies the same predicate.
create or replace view public.recommendable_catalog_products
with (security_invoker = true)
as
select p.*
from public.products as p
where private.catalog_product_is_servable(p.id);
