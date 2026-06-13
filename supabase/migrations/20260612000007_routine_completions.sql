-- =============================================================================
-- 0007 · routine_completions  (append-only adherence log) + streaks
-- =============================================================================
create table public.routine_completions (
  id             uuid primary key default gen_random_uuid(),
  user_id        uuid not null references auth.users (id) on delete cascade,
  routine_id     uuid not null references public.routines (id) on delete cascade,
  step_id        uuid references public.routine_steps (id) on delete cascade,
  completed_at   timestamptz not null default now(),  -- when it was logged
  completed_date date not null,                        -- the day it counts for
  source         text not null default 'live' check (source in ('live', 'backfilled')),
  created_at     timestamptz not null default now(),
  -- Dedupe: a completion either exists for a (step, day) or it doesn't. NULLS
  -- NOT DISTINCT (PG15) so routine-level completions (step_id IS NULL) also dedupe.
  unique nulls not distinct (user_id, step_id, completed_date)
);
create index routine_completions_user_date_idx on public.routine_completions (user_id, completed_date);
-- Cover the cascade FKs (Supabase unindexed_foreign_keys advisor).
create index routine_completions_routine_id_idx on public.routine_completions (routine_id);
create index routine_completions_step_id_idx on public.routine_completions (step_id);

alter table public.routine_completions enable row level security;

-- APPEND-ONLY: only SELECT + INSERT policies. With RLS on and no UPDATE/DELETE
-- policy, updates/deletes are denied for authenticated users by default.
create policy "routine_completions_select_own" on public.routine_completions
  for select to authenticated
  using ((select auth.uid()) = user_id);

-- INSERT must prove ownership of BOTH the row (user_id) AND the referenced
-- routine/step (FKs only check existence, not ownership) — RLS review hardening.
create policy "routine_completions_insert_own" on public.routine_completions
  for insert to authenticated
  with check (
    (select auth.uid()) = user_id
    and public.owns_routine(routine_id)
    and (
      step_id is null
      or exists (
        select 1 from public.routine_steps s
        where s.id = step_id and public.owns_routine(s.routine_id)
      )
    )
  );

-- Streak-integrity guard (docs/01 §3 / §6): server authoritatively decides
-- `source`, rejects far-future dates, and caps backfill so completions can't be
-- backdated to fabricate a streak. completed_date is the user's LOCAL calendar
-- day; current_date is the server's UTC date — so we allow +1 day (users east of
-- UTC whose local day is already "tomorrow" in UTC) and ~48h of backfill behind.
-- See DECISIONS D-012: precise per-user-timezone validation is a later refinement.
create or replace function public.validate_completion()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.completed_date > current_date + 1 then
    raise exception 'completed_date is too far in the future';
  end if;
  if new.completed_date < current_date - 2 then
    raise exception 'backfill is limited to a ~48-hour window';
  end if;
  -- Server decides source; never trust the client value.
  new.source := case when new.completed_date < current_date then 'backfilled' else 'live' end;
  return new;
end;
$$;
revoke all on function public.validate_completion() from public, anon, authenticated;

create trigger trg_validate_completion
  before insert on public.routine_completions
  for each row execute function public.validate_completion();

-- Streaks: computed/authoritative from the log, cached on profiles for fast
-- reads (the hybrid recommended in docs/01 §3). Gaps-and-islands over distinct
-- completed_date. current_streak counts the run ending today or yesterday;
-- longest_streak is a non-decreasing personal best (DECISIONS D-011).
create or replace function public.recompute_streak(p_user_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_current int := 0;
  v_longest int := 0;
begin
  with days as (
    select distinct completed_date as d
    from public.routine_completions
    where user_id = p_user_id
  ),
  grp as (
    select d, (d - (row_number() over (order by d))::int) as island
    from days
  ),
  islands as (
    select island, count(*)::int as len, max(d) as last_day
    from grp
    group by island
  )
  select
    coalesce(max(len), 0),
    coalesce((select len from islands where last_day >= current_date - 1 order by last_day desc limit 1), 0)
  into v_longest, v_current
  from islands;

  update public.profiles
  set current_streak = coalesce(v_current, 0),
      longest_streak = greatest(longest_streak, coalesce(v_longest, 0)),
      updated_at = now()
  where id = p_user_id;
end;
$$;
revoke all on function public.recompute_streak(uuid) from public, anon, authenticated;

create or replace function public.on_completion_update_streak()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  perform public.recompute_streak(new.user_id);
  return null;
end;
$$;
revoke all on function public.on_completion_update_streak() from public, anon, authenticated;

create trigger trg_completion_streak
  after insert on public.routine_completions
  for each row execute function public.on_completion_update_streak();

-- Recompute on DELETE too (completions can be removed via ON DELETE CASCADE when
-- a routine/step is deleted) so the cached current_streak doesn't go stale. Skip
-- if the profile is already gone (e.g. the whole user is being cascade-deleted).
create or replace function public.on_completion_delete_streak()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if exists (select 1 from public.profiles where id = old.user_id) then
    perform public.recompute_streak(old.user_id);
  end if;
  return null;
end;
$$;
revoke all on function public.on_completion_delete_streak() from public, anon, authenticated;

create trigger trg_completion_streak_delete
  after delete on public.routine_completions
  for each row execute function public.on_completion_delete_streak();
