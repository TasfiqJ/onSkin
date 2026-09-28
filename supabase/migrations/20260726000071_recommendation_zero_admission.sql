-- =============================================================================
-- 0071 - CORE-06A recommendation zero-admission boundary
-- =============================================================================
-- Product-specific recommendations remain closed until a separately reviewed
-- recommendation corpus, claim policy, preference contract, and server
-- publisher are admitted. Shelf catalog lookup/search remains available through
-- the independent CAT-03 serving boundary.

begin;

-- A single private, migration-owned control row makes the closed checkpoint
-- explicit. Runtime roles cannot mutate or even read the control. Reopening
-- requires a new forward migration that replaces the closed-only constraint,
-- immutable guard, and dependent write/projection gates.
create table private.recommendation_admission_control (
  singleton boolean primary key default true check (singleton),
  admission_state text not null default 'closed'
    check (admission_state = 'closed'),
  checkpoint text not null
    check (checkpoint = 'core06a_zero_admission'),
  reason_code text not null
    check (reason_code = 'reviewed_corpus_not_admitted'),
  established_at timestamptz not null
    default pg_catalog.clock_timestamp()
    check (pg_catalog.isfinite(established_at))
);

insert into private.recommendation_admission_control (
  singleton,
  admission_state,
  checkpoint,
  reason_code
) values (
  true,
  'closed',
  'core06a_zero_admission',
  'reviewed_corpus_not_admitted'
);

alter table private.recommendation_admission_control
  enable row level security;
alter table private.recommendation_admission_control
  force row level security;

revoke all on table private.recommendation_admission_control
  from public, anon, authenticated, service_role;

create or replace function private.guard_recommendation_admission_control()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  raise exception 'RECOMMENDATION_ADMISSION_CONTROL_MIGRATION_OWNED'
    using errcode = '55000';
end;
$$;

create trigger recommendation_admission_control_immutable
  before update or delete or truncate
  on private.recommendation_admission_control
  for each statement
  execute function private.guard_recommendation_admission_control();

revoke all on function private.guard_recommendation_admission_control()
  from public, anon, authenticated, service_role;

-- The old product flag mixed Shelf catalog serving with recommendation
-- admission. Close it globally, coerce every legacy refresh/import publisher
-- back to false, and retain a relational invariant that cannot be bypassed by
-- a newly added publisher.
update public.products
   set recommendation_eligible = false
 where recommendation_eligible is distinct from false;

create or replace function private.force_recommendation_eligibility_closed()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  new.recommendation_eligible := false;
  return new;
end;
$$;

create trigger products_recommendation_eligibility_closed
  before insert or update of recommendation_eligible
  on public.products
  for each row
  execute function private.force_recommendation_eligibility_closed();

revoke all on function private.force_recommendation_eligibility_closed()
  from public, anon, authenticated, service_role;

alter table public.products
  add constraint products_recommendation_eligibility_closed
  check (recommendation_eligible is false);

-- Keep the current correction refresh useful for Shelf quality/hold state, but
-- remove its historical ability to reopen recommendation eligibility.
create or replace function public.refresh_product_correction_count(
  p_product_id uuid
)
returns void
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v_hold_count integer;
begin
  if p_product_id is null then
    return;
  end if;

  select count(*)::integer
    into v_hold_count
    from private.catalog_operator_product_holds as hold
   where hold.product_id = p_product_id
     and hold.state in ('active', 'repair_attested');

  update public.products as product
     set unresolved_correction_count = v_hold_count,
         recommendation_eligible = false
   where product.id = p_product_id;
end;
$$;

revoke all on function public.refresh_product_correction_count(uuid)
  from public, anon, authenticated, service_role;

-- Shelf catalog serving remains independently gated by exact legal/source,
-- quality, correction, hold, and CAT-03 release authority. It no longer reads
-- the recommendation-only flag.
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
     where product.id = p_product_id
       and product.region = 'US'
       and product.status = 'active'
       and product.review_status = 'reviewed'
       and product.last_reviewed_at is not null
       and product.last_reviewed_at <= pg_catalog.now()
       and product.quality_grade in ('verified', 'usable')
       and product.unresolved_correction_count = 0
       and nullif(pg_catalog.btrim(product.source_ref), '') is not null
       and product.source_snapshot_date is not null
       and product.source_snapshot_date <=
         (pg_catalog.now() at time zone 'UTC')::date
       and private.catalog_source_is_production_approved(product.source_id)
       and private.catalog_launch_curation_head_is_active(product.id)
       and not exists (
         select 1
           from private.catalog_operator_product_holds as hold
          where hold.product_id = product.id
            and hold.state in ('active', 'repair_attested')
       )
  )
$$;

revoke all on function private.catalog_product_is_servable(uuid)
  from public, anon, authenticated, service_role;
grant execute on function private.catalog_product_is_servable(uuid)
  to authenticated;

-- CAT-03 release validation used the same legacy product flag in both its
-- scalar live predicate and its set-based release cache. Preserve every other
-- reviewed CAT-03 invariant while removing exactly that one cross-domain
-- dependency. The guarded definition rewrite deliberately fails the migration
-- if an earlier validator has drifted instead of silently weakening a
-- different predicate.
do $$
declare
  v_function pg_catalog.regprocedure;
  v_definition text;
  v_legacy_predicate constant text :=
    'and product.recommendation_eligible is true';
  v_replacement constant text :=
    'and true /* CAT-03 catalog serving is independent from recommendation admission */';
  v_occurrences integer;
begin
  foreach v_function in array array[
    'private.catalog_launch_curation_record_is_valid_v0058(uuid)'::pg_catalog.regprocedure,
    'private.catalog_launch_curation_campaign_record_validity(uuid)'::pg_catalog.regprocedure
  ] loop
    select pg_catalog.pg_get_functiondef(v_function::oid)
      into strict v_definition;

    v_occurrences :=
      (
        pg_catalog.length(v_definition) -
        pg_catalog.length(
          pg_catalog.replace(v_definition, v_legacy_predicate, '')
        )
      ) / pg_catalog.length(v_legacy_predicate);

    if v_occurrences <> 1 then
      raise exception
        'RECOMMENDATION_CATALOG_VALIDATOR_PREDICATE_DRIFT:%:%',
        v_function::text,
        v_occurrences
        using errcode = '55000';
    end if;

    execute pg_catalog.replace(
      v_definition,
      v_legacy_predicate,
      v_replacement
    );
  end loop;
end;
$$;

-- Replace the legacy SELECT * relation with one exact, non-commercial,
-- service-only recommendation candidate shape. The closed singleton makes the
-- projection return zero rows even when Shelf has servable catalog products.
drop view public.recommendable_catalog_products;
create view public.recommendable_catalog_products
with (security_barrier = true)
as
select
  product.id,
  product.name,
  product.brand,
  product.category,
  product.product_type,
  product.region,
  product.quality_grade,
  product.data_quality_score,
  product.ingredient_quality_score
from public.products as product
where product.recommendation_eligible is true
  and private.catalog_product_is_servable(product.id)
  and exists (
    select 1
      from private.recommendation_admission_control as control
     where control.singleton
       and control.admission_state = 'open'
  );

comment on view public.recommendable_catalog_products is
  'Service-only exact recommendation candidate projection; CORE-06A is constrained closed and returns zero rows.';

revoke all on public.recommendable_catalog_products
  from public, anon, authenticated, service_role;
grant select on public.recommendable_catalog_products to service_role;

-- No legacy cache row has a server authority receipt: authenticated clients
-- could previously mint both catalog-linked and type-only free text. Purge the
-- entire untrusted cache rather than laundering its rationale/evidence fields
-- across the authority cutover. The owner data-export registry still reports
-- the now-empty relation truthfully.
delete from public.recommendations;

alter table public.recommendations
  add constraint recommendations_catalog_product_closed
  check (catalog_product_id is null);

create or replace function private.guard_recommendation_cache_write()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not exists (
    select 1
      from private.recommendation_admission_control as control
     where control.singleton
       and control.admission_state = 'open'
  ) then
    raise exception 'RECOMMENDATION_ADMISSION_CLOSED'
      using errcode = '55000';
  end if;
  return new;
end;
$$;

create trigger recommendations_admission_control
  before insert or update
  on public.recommendations
  for each row
  execute function private.guard_recommendation_cache_write();

revoke all on function private.guard_recommendation_cache_write()
  from public, anon, authenticated, service_role;

drop policy if exists "recommendations_insert_own" on public.recommendations;
drop policy if exists "recommendations_update_own" on public.recommendations;
drop policy if exists "recommendations_delete_own" on public.recommendations;
revoke all on public.recommendations
  from public, anon, authenticated, service_role;
grant select on public.recommendations to authenticated, service_role;

-- Recommendation preferences remain owner-readable health-purpose data. Direct
-- REST writes are replaced by one exact, session-bound owner RPC with bounded
-- closed vocabularies and the canonical health/account publication fence.
drop policy if exists "recommendation_preferences_insert_own"
  on public.recommendation_preferences;
drop policy if exists "recommendation_preferences_update_own"
  on public.recommendation_preferences;
drop policy if exists "recommendation_preferences_delete_own"
  on public.recommendation_preferences;
revoke all on public.recommendation_preferences
  from public, anon, authenticated, service_role;
grant select on public.recommendation_preferences
  to authenticated, service_role;

create or replace function public.set_recommendation_preferences(
  p_values_filters text[],
  p_budget_band text,
  p_format_prefs text[]
)
returns table (
  user_id uuid,
  values_filters text[],
  budget_band text,
  format_prefs text[],
  updated_at timestamptz
)
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v_user_id uuid := (select auth.uid());
begin
  if v_user_id is null then
    raise exception 'RECOMMENDATION_PREFERENCES_SESSION_REJECTED'
      using errcode = '28000';
  end if;

  if p_values_filters is null
     or p_format_prefs is null
     or (
       pg_catalog.cardinality(p_values_filters) > 0
       and pg_catalog.array_ndims(p_values_filters) is distinct from 1
     )
     or (
       pg_catalog.cardinality(p_format_prefs) > 0
       and pg_catalog.array_ndims(p_format_prefs) is distinct from 1
     )
     or pg_catalog.cardinality(p_values_filters) > 5
     or pg_catalog.cardinality(p_format_prefs) > 5
     or pg_catalog.array_position(p_values_filters, null) is not null
     or pg_catalog.array_position(p_format_prefs, null) is not null
     or not p_values_filters <@ array[
       'fragrance_free',
       'vegan',
       'cruelty_free',
       'non_comedogenic',
       'sustainable'
     ]::text[]
     or not p_format_prefs <@ array[
       'gel',
       'cream',
       'fluid',
       'balm',
       'oil'
     ]::text[]
     or (
       p_budget_band is not null
       and p_budget_band not in ('drugstore', 'mid', 'premium')
     )
     or (
       select count(*) <> count(distinct value)
         from pg_catalog.unnest(p_values_filters) as input(value)
     )
     or (
       select count(*) <> count(distinct value)
         from pg_catalog.unnest(p_format_prefs) as input(value)
     ) then
    raise exception 'RECOMMENDATION_PREFERENCES_INVALID'
      using errcode = '22023';
  end if;

  perform public._assert_current_health_session(v_user_id);
  perform public._assert_health_processing_active_locked(v_user_id);
  if not public._account_access_allowed(v_user_id) then
    raise exception 'ACCOUNT_ACCESS_DENIED' using errcode = '42501';
  end if;

  insert into public.recommendation_preferences as preferences (
    user_id,
    values_filters,
    budget_band,
    format_prefs,
    updated_at
  ) values (
    v_user_id,
    p_values_filters,
    p_budget_band,
    p_format_prefs,
    pg_catalog.clock_timestamp()
  )
  on conflict on constraint recommendation_preferences_pkey
  do update set
    values_filters = excluded.values_filters,
    budget_band = excluded.budget_band,
    format_prefs = excluded.format_prefs,
    updated_at = excluded.updated_at;

  return query
    select preferences.user_id,
           preferences.values_filters,
           preferences.budget_band,
           preferences.format_prefs,
           preferences.updated_at
      from public.recommendation_preferences as preferences
     where preferences.user_id = v_user_id;
end;
$$;

comment on function public.set_recommendation_preferences(text[], text, text[]) is
  'Exact-session owner preference write; direct table DML and recommendation admission remain closed.';

revoke all on function public.set_recommendation_preferences(
  text[], text, text[]
) from public, anon, authenticated, service_role;
grant execute on function public.set_recommendation_preferences(
  text[], text, text[]
) to authenticated;

-- Commission/order economics remain outside every recommendation surface.
-- Restate the deny boundary at this checkpoint so future default grants cannot
-- make the service-only relation client-readable.
revoke all on public.order_attributions
  from public, anon, authenticated;

commit;
