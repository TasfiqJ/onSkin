-- Make the best-effort routine-conflict mirror idempotent by canonical product
-- pair. Local encrypted state remains the V1 authority until B-SUPABASE and
-- B-ROUTINE-PERSIST close.

begin;

with ranked as (
  select
    id,
    first_value(id) over (
      partition by
        user_id,
        rule_id,
        least(product_a_id::text, product_b_id::text),
        greatest(product_a_id::text, product_b_id::text)
      order by
        rule_version desc nulls last,
        case
          when status in ('accepted', 'overridden')
            and user_choice in (
              'accept_suggested_timing',
              'keep_alternate_nights',
              'use_together'
            ) then 0
          else 1
        end,
        updated_at desc nulls last,
        created_at desc nulls last,
        id desc
    ) as keeper_id,
    first_value(id) over (
      partition by
        user_id,
        rule_id,
        least(product_a_id::text, product_b_id::text),
        greatest(product_a_id::text, product_b_id::text)
      order by
        rule_version desc nulls last,
        updated_at desc nulls last,
        created_at desc nulls last,
        id desc
    ) as newest_id
  from public.routine_conflicts
  where product_a_id is not null and product_b_id is not null
), groups as (
  select distinct keeper_id, newest_id from ranked
)
update public.routine_conflicts as keeper
set computed_severity = newest.computed_severity
from groups
join public.routine_conflicts as newest on newest.id = groups.newest_id
where keeper.id = groups.keeper_id and keeper.id <> newest.id;

with ranked as (
  select
    id,
    row_number() over (
      partition by
        user_id,
        rule_id,
        least(product_a_id::text, product_b_id::text),
        greatest(product_a_id::text, product_b_id::text)
      order by
        rule_version desc nulls last,
        case
          when status in ('accepted', 'overridden')
            and user_choice in (
              'accept_suggested_timing',
              'keep_alternate_nights',
              'use_together'
            ) then 0
          else 1
        end,
        updated_at desc nulls last,
        created_at desc nulls last,
        id desc
    ) as row_rank
  from public.routine_conflicts
  where product_a_id is not null and product_b_id is not null
)
delete from public.routine_conflicts as conflict
using ranked
where conflict.id = ranked.id and ranked.row_rank > 1;

update public.routine_conflicts
set
  product_a_id = least(product_a_id::text, product_b_id::text)::uuid,
  product_b_id = greatest(product_a_id::text, product_b_id::text)::uuid
where
  product_a_id is not null
  and product_b_id is not null
  and product_a_id::text > product_b_id::text;

-- Same-product rows are not valid conflict identities and would fail the
-- canonical-order constraint below. This table is a recomputable cache.
delete from public.routine_conflicts
where product_a_id is not null and product_a_id = product_b_id;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'routine_conflicts_choice_pair_canonical'
      and conrelid = 'public.routine_conflicts'::regclass
  ) then
    alter table public.routine_conflicts
      add constraint routine_conflicts_choice_pair_canonical
      check (
        product_a_id is null
        or product_b_id is null
        or product_a_id::text < product_b_id::text
      ) not valid;
  end if;
end
$$;

alter table public.routine_conflicts
  validate constraint routine_conflicts_choice_pair_canonical;

create unique index if not exists routine_conflicts_choice_identity_uidx
  on public.routine_conflicts (user_id, rule_id, product_a_id, product_b_id);

commit;
