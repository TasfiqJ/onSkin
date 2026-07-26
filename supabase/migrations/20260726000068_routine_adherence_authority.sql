-- =============================================================================
-- 0068 · Authoritative routine adherence, timezone, and calm-streak projection
-- =============================================================================
-- A completion only proves an adherence day when it is the idempotent
-- routine-level marker (step_id IS NULL). Partial step rows remain useful
-- check-off evidence but can never inflate the streak. The user's exact
-- PostgreSQL/IANA timezone determines the accepted local-date window and the
-- cache's reference day. Freezes and profile streak values are server-owned
-- projections of the append-only completion log.

begin;

lock table public.routine_completions in access exclusive mode;
lock table public.profiles in access exclusive mode;
lock table public.streak_freezes in access exclusive mode;

-- Fail the cutover before any rewrite if legacy privileged writes ever crossed
-- the routine/step ownership graph. Preserving such a row would let a foreign
-- routine cascade invoke another owner's adherence lifecycle.
create or replace function private.assert_routine_completion_legacy_integrity()
returns void
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  if exists (
    select 1
      from public.routine_completions as completions
      left join public.routines as routines
        on routines.id = completions.routine_id
      left join public.routine_steps as steps
        on steps.id = completions.step_id
     where routines.id is null
        or routines.user_id is distinct from completions.user_id
        or (
          completions.step_id is not null
          and (
            steps.id is null
            or steps.routine_id is distinct from completions.routine_id
          )
        )
  ) then
    raise exception 'ROUTINE_COMPLETION_LEGACY_INTEGRITY_INVALID'
      using errcode = '55000';
  end if;
end;
$$;

revoke all on function private.assert_routine_completion_legacy_integrity()
  from public, anon, authenticated, service_role;
select private.assert_routine_completion_legacy_integrity();

alter table public.profiles
  add column adherence_timezone text,
  add column streak_reference_day date,
  add column streak_algorithm_version smallint not null default 0;

-- A custom GUC is only an internal trigger context, never a privilege
-- boundary. Remove table-wide UPDATE authority and expose only the preserved
-- non-health profile shell columns. Even a caller that can set a matching
-- custom GUC cannot reach any projection column.
revoke update on table public.profiles
  from public, anon, authenticated, service_role;
revoke delete on table public.profiles
  from public, anon, authenticated, service_role;
revoke insert on table public.profiles
  from public, anon, service_role;
revoke truncate, references, trigger on table public.profiles
  from public, anon, authenticated, service_role;
grant update (display_name, avatar_path, locale, units)
  on table public.profiles to authenticated;

-- Legacy profile caches were computed from partial step rows and legacy freeze
-- rows were client-insertable. Neither is acceptable input to the new
-- authority, so cut over fail-closed instead of preserving unverifiable state.
alter table public.profiles disable trigger trg_profiles_health_write;
delete from public.streak_freezes;
update public.profiles
   set current_streak = 0,
       longest_streak = 0,
       adherence_timezone = null,
       streak_reference_day = null,
       streak_algorithm_version = 0,
       updated_at = pg_catalog.statement_timestamp();
alter table public.profiles enable trigger trg_profiles_health_write;

alter table public.profiles
  add constraint profiles_adherence_projection_check
  check (
    (
      streak_algorithm_version = 0
      and adherence_timezone is null
      and streak_reference_day is null
      and current_streak = 0
      and longest_streak = 0
    )
    or (
      streak_algorithm_version = 1
      and adherence_timezone is not null
      and adherence_timezone = pg_catalog.btrim(adherence_timezone)
      and pg_catalog.length(adherence_timezone) between 1 and 255
      and adherence_timezone !~ '[[:cntrl:]]'
      and streak_reference_day is not null
      and current_streak >= 0
      and longest_streak >= current_streak
    )
  );

alter table public.streak_freezes
  add constraint streak_freezes_source_auto_check
  check (source = 'auto');

drop policy if exists "streak_freezes_insert_own" on public.streak_freezes;
revoke insert, update, delete on table public.streak_freezes
  from public, anon, authenticated, service_role;
revoke truncate, references, trigger on table public.streak_freezes
  from public, anon, authenticated, service_role;

comment on column public.profiles.adherence_timezone is
  'Exact pg_timezone_names/IANA name used by server-side adherence validation; NULL means adherence is not configured.';
comment on column public.profiles.streak_reference_day is
  'User-local day through which the server-owned streak cache was projected.';
comment on column public.profiles.streak_algorithm_version is
  '0 is an unconfigured zero cache; 1 is the authoritative two-total-miss routine-marker projection.';
comment on table public.streak_freezes is
  'Server-owned materialized projection of missed dates absorbed by the current calm streak; never client-authored or purchased.';

-- Exact, case-sensitive catalog membership. There is deliberately no UTC
-- fallback: a missing, malformed, or retired timezone closes adherence writes.
create or replace function private.routine_adherence_timezone_is_valid(
  p_timezone text
)
returns boolean
language sql
stable
set search_path = ''
as $$
  select p_timezone is not null
    and p_timezone = pg_catalog.btrim(p_timezone)
    and pg_catalog.length(p_timezone) between 1 and 255
    and p_timezone !~ '[[:cntrl:]]'
    and exists (
      select 1
        from pg_catalog.pg_timezone_names as zones
       where zones.name = p_timezone
    );
$$;

revoke all on function private.routine_adherence_timezone_is_valid(text)
  from public, anon, authenticated, service_role;

create or replace function private.routine_adherence_reference_day(
  p_timezone text,
  p_at timestamptz
)
returns date
language plpgsql
stable
set search_path = ''
as $$
begin
  if p_at is null
     or not private.routine_adherence_timezone_is_valid(p_timezone) then
    raise exception 'ROUTINE_ADHERENCE_TIMEZONE_INVALID' using errcode = '22023';
  end if;
  return (p_at at time zone p_timezone)::date;
end;
$$;

revoke all on function private.routine_adherence_reference_day(text, timestamptz)
  from public, anon, authenticated, service_role;

-- Pure projection equivalent to the mobile two-total-missed-day algorithm.
-- Frozen dates use one canonical order: newest to oldest, matching the client.
-- Today is neutral. Future-tolerance rows are excluded. Best counts completed
-- routine days, not absorbed dates, and is later merged with the prior best.
create or replace function private.project_routine_adherence(
  p_completed_dates date[],
  p_reference_day date
)
returns table (
  projected_current_streak integer,
  projected_best_streak integer,
  projected_frozen_dates date[],
  projected_lapsed boolean
)
language plpgsql
immutable
set search_path = ''
as $$
declare
  v_days date[] := '{}'::date[];
  v_day_count integer := 0;
  v_index integer;
  v_day date;
  v_previous date;
  v_newer date;
  v_older date;
  v_gap integer;
  v_gap_offset integer;
  v_run integer := 0;
  v_used_freezes integer := 0;
  v_current integer := 0;
  v_best integer := 0;
  v_frozen date[] := '{}'::date[];
begin
  if p_reference_day is null then
    raise exception 'ROUTINE_ADHERENCE_REFERENCE_DAY_INVALID' using errcode = '22023';
  end if;

  select coalesce(pg_catalog.array_agg(distinct candidate.day order by candidate.day), '{}'::date[])
    into v_days
    from pg_catalog.unnest(coalesce(p_completed_dates, '{}'::date[]))
      as candidate(day)
   where candidate.day is not null
     and candidate.day <= p_reference_day;

  v_day_count := coalesce(pg_catalog.array_length(v_days, 1), 0);
  if v_day_count = 0 then
    return query select 0, 0, '{}'::date[], false;
    return;
  end if;

  -- Best streak, oldest to newest. The two-day forgiveness budget is total
  -- within a run, including separated single-day gaps.
  for v_index in 1..v_day_count loop
    v_day := v_days[v_index];
    if v_previous is null then
      v_run := 1;
      v_used_freezes := 0;
    else
      v_gap := v_day - v_previous - 1;
      if v_gap = 0 then
        v_run := v_run + 1;
      elsif v_used_freezes + v_gap <= 2 then
        v_used_freezes := v_used_freezes + v_gap;
        v_run := v_run + 1;
      else
        v_run := 1;
        v_used_freezes := 0;
      end if;
    end if;
    v_best := greatest(v_best, v_run);
    v_previous := v_day;
  end loop;

  -- Current streak, newest to oldest. A not-yet-completed reference day is
  -- neutral, while earlier trailing misses consume the same two-day budget.
  -- The 731-calendar-day window exactly matches the client's bounded scan.
  v_newer := v_days[v_day_count];
  v_gap := greatest(p_reference_day - v_newer - 1, 0);
  if v_gap <= 2 then
    v_current := 1;
    v_used_freezes := v_gap;
    if v_gap > 0 then
      for v_gap_offset in reverse v_gap..1 loop
        v_frozen := pg_catalog.array_append(v_frozen, v_newer + v_gap_offset);
      end loop;
    end if;

    if v_day_count > 1 then
      for v_index in reverse (v_day_count - 1)..1 loop
        v_older := v_days[v_index];
        exit when p_reference_day - v_older > 730;
        v_gap := v_newer - v_older - 1;
        exit when v_used_freezes + v_gap > 2;
        v_current := v_current + 1;
        v_used_freezes := v_used_freezes + v_gap;
        if v_gap > 0 then
          for v_gap_offset in reverse v_gap..1 loop
            v_frozen := pg_catalog.array_append(v_frozen, v_older + v_gap_offset);
          end loop;
        end if;
        v_newer := v_older;
      end loop;
    end if;
  end if;

  return query
  select v_current, v_best, v_frozen, v_current = 0;
end;
$$;

revoke all on function private.project_routine_adherence(date[], date)
  from public, anon, authenticated, service_role;

-- Profile health-derived fields are now wholly server-owned. Shell edits may
-- retain them unchanged. The only mutation lanes are an attested adherence
-- projection or the existing synchronous withdrawal/purge contexts.
create or replace function public._guard_profile_health_write()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_writer text := pg_catalog.current_setting(
    'app.routine_adherence_writer', true
  );
begin
  if tg_op = 'INSERT' then
    if new.current_streak = 0
       and new.longest_streak = 0
       and new.adherence_timezone is null
       and new.streak_reference_day is null
       and new.streak_algorithm_version = 0 then
      return new;
    end if;
    raise exception 'ROUTINE_ADHERENCE_CACHE_SERVER_OWNED' using errcode = '42501';
  end if;

  if old.id is distinct from new.id then
    raise exception 'HEALTH_PROCESSING_OWNER_IMMUTABLE' using errcode = '22023';
  end if;

  if old.current_streak is not distinct from new.current_streak
     and old.longest_streak is not distinct from new.longest_streak
     and old.adherence_timezone is not distinct from new.adherence_timezone
     and old.streak_reference_day is not distinct from new.streak_reference_day
     and old.streak_algorithm_version is not distinct from new.streak_algorithm_version then
    return new;
  end if;

  if (
       public._health_purge_context_active(new.id)
       or public._health_read_barrier_context_active(new.id)
     )
     and new.current_streak = 0
     and new.longest_streak = 0
     and new.adherence_timezone is null
     and new.streak_reference_day is null
     and new.streak_algorithm_version = 0 then
    return new;
  end if;

  if v_writer = new.id::text
     and new.streak_algorithm_version = 1
     and new.streak_reference_day is not null
     and new.current_streak >= 0
     and new.longest_streak >= new.current_streak
     and private.routine_adherence_timezone_is_valid(new.adherence_timezone) then
    perform public._assert_health_processing_active_locked(new.id);
    return new;
  end if;

  raise exception 'ROUTINE_ADHERENCE_CACHE_SERVER_OWNED' using errcode = '42501';
end;
$$;

revoke all on function public._guard_profile_health_write()
  from public, anon, authenticated, service_role;

-- This trigger adds a server-ownership fence for all freeze operations. It
-- composes with the existing health-write trigger on INSERT/UPDATE and admits
-- deletion only for recomputation, health erasure, or account/Auth cascades.
create or replace function private.guard_routine_adherence_freeze_write()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user_id uuid := case when tg_op = 'DELETE' then old.user_id else new.user_id end;
begin
  if pg_catalog.current_setting('app.routine_adherence_writer', true)
       = v_user_id::text then
    if tg_op <> 'DELETE' and new.source is distinct from 'auto' then
      raise exception 'ROUTINE_ADHERENCE_FREEZE_SOURCE_INVALID' using errcode = '22023';
    end if;
    return case when tg_op = 'DELETE' then old else new end;
  end if;

  if tg_op = 'DELETE'
     and (
       public._health_purge_context_active(v_user_id)
       or not exists (
         select 1 from auth.users as users where users.id = v_user_id
       )
       or exists (
         select 1
           from public.account_deletion_barriers as barriers
          where barriers.user_id = v_user_id
       )
     ) then
    return old;
  end if;

  raise exception 'ROUTINE_ADHERENCE_FREEZE_SERVER_OWNED' using errcode = '42501';
end;
$$;

revoke all on function private.guard_routine_adherence_freeze_write()
  from public, anon, authenticated, service_role;

drop trigger if exists trg_routine_adherence_freeze_server_owned
  on public.streak_freezes;
create trigger trg_routine_adherence_freeze_server_owned
  before insert or update or delete on public.streak_freezes
  for each row execute function private.guard_routine_adherence_freeze_write();

-- The internal writer is the single cache/freeze materialization lane. It
-- serializes with health withdrawal, account deletion, Apple invalidation, and
-- other owner-scoped publishers through the canonical advisory lock.
create or replace function private.recompute_routine_adherence(
  p_user_id uuid,
  p_timezone text,
  p_at timestamptz
)
returns table (
  current_streak integer,
  longest_streak integer,
  adherence_timezone text,
  reference_day date,
  frozen_dates date[],
  lapsed boolean,
  algorithm_version smallint
)
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v_reference_day date;
  v_completed_dates date[];
  v_projection record;
  v_prior_best integer;
begin
  if p_user_id is null then
    raise exception 'ROUTINE_ADHERENCE_OWNER_INVALID' using errcode = '22023';
  end if;

  -- Fail fast on owner contention before checking Apple/account state under the
  -- same re-entrant transaction lock.
  perform public._assert_health_processing_active_locked(p_user_id);
  if not public._account_access_allowed(p_user_id) then
    raise exception 'ACCOUNT_ACCESS_DENIED' using errcode = '42501';
  end if;

  v_reference_day := private.routine_adherence_reference_day(
    p_timezone,
    p_at
  );

  select coalesce(
           pg_catalog.array_agg(
             distinct completions.completed_date
             order by completions.completed_date
           ),
           '{}'::date[]
         )
    into v_completed_dates
    from public.routine_completions as completions
    join public.routines as routines
      on routines.id = completions.routine_id
     and routines.user_id = completions.user_id
   where completions.user_id = p_user_id
     and completions.step_id is null
     and completions.completed_date <= v_reference_day;

  -- Preserve the global completion -> profile -> freeze lock order used by the
  -- forward migration so a concurrent publisher cannot form a lock cycle.
  select profiles.longest_streak
    into v_prior_best
    from public.profiles as profiles
   where profiles.id = p_user_id
   for update;
  if not found then
    raise exception 'ROUTINE_ADHERENCE_PROFILE_MISSING' using errcode = '23503';
  end if;

  select projection.*
    into v_projection
    from private.project_routine_adherence(
      v_completed_dates,
      v_reference_day
    ) as projection;

  perform pg_catalog.set_config(
    'app.routine_adherence_writer', p_user_id::text, true
  );
  begin
    update public.profiles as profiles
       set current_streak = v_projection.projected_current_streak,
           longest_streak = greatest(
             v_prior_best,
             v_projection.projected_best_streak
           ),
           adherence_timezone = p_timezone,
           streak_reference_day = v_reference_day,
           streak_algorithm_version = 1,
           updated_at = pg_catalog.statement_timestamp()
     where profiles.id = p_user_id;

    delete from public.streak_freezes as freezes
     where freezes.user_id = p_user_id;
    insert into public.streak_freezes (
      user_id,
      applied_for_date,
      source
    )
    select p_user_id, frozen.day, 'auto'
      from pg_catalog.unnest(
        v_projection.projected_frozen_dates
      ) as frozen(day)
     order by frozen.day;
  exception when others then
    perform pg_catalog.set_config('app.routine_adherence_writer', '', true);
    raise;
  end;
  perform pg_catalog.set_config('app.routine_adherence_writer', '', true);

  return query
  select v_projection.projected_current_streak,
         greatest(
           v_prior_best,
           v_projection.projected_best_streak
         ),
         p_timezone,
         v_reference_day,
         v_projection.projected_frozen_dates,
         v_projection.projected_lapsed,
         1::smallint;
end;
$$;

revoke all on function private.recompute_routine_adherence(
  uuid, text, timestamptz
) from public, anon, authenticated, service_role;

-- Preserve the historical internal function name for trigger/dependency
-- compatibility, but do not expose a caller-controlled owner or clock to APIs.
create or replace function public.recompute_streak(p_user_id uuid)
returns void
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v_timezone text;
begin
  select profiles.adherence_timezone
    into v_timezone
    from public.profiles as profiles
   where profiles.id = p_user_id;
  if not private.routine_adherence_timezone_is_valid(v_timezone) then
    raise exception 'ROUTINE_ADHERENCE_TIMEZONE_REQUIRED' using errcode = '55000';
  end if;
  perform 1
    from private.recompute_routine_adherence(
      p_user_id,
      v_timezone,
      pg_catalog.statement_timestamp()
    );
end;
$$;

revoke all on function public.recompute_streak(uuid)
  from public, anon, authenticated, service_role;

-- Both public RPCs derive the owner from the current exact Auth session. The
-- request must also carry the active health epoch header enforced everywhere
-- else in the health-purpose write boundary.
create or replace function public.set_routine_adherence_timezone(
  p_timezone text
)
returns table (
  current_streak integer,
  longest_streak integer,
  adherence_timezone text,
  reference_day date,
  frozen_dates date[],
  lapsed boolean,
  algorithm_version smallint
)
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v_user_id uuid := (select auth.uid());
begin
  perform public._assert_current_health_session(v_user_id);
  return query
  select projection.*
    from private.recompute_routine_adherence(
      v_user_id,
      p_timezone,
      pg_catalog.statement_timestamp()
    ) as projection;
end;
$$;

revoke all on function public.set_routine_adherence_timezone(text)
  from public, anon, service_role;
grant execute on function public.set_routine_adherence_timezone(text)
  to authenticated;

create or replace function public.refresh_routine_adherence()
returns table (
  current_streak integer,
  longest_streak integer,
  adherence_timezone text,
  reference_day date,
  frozen_dates date[],
  lapsed boolean,
  algorithm_version smallint
)
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v_user_id uuid := (select auth.uid());
  v_timezone text;
begin
  perform public._assert_current_health_session(v_user_id);
  select profiles.adherence_timezone
    into v_timezone
    from public.profiles as profiles
   where profiles.id = v_user_id;
  if not private.routine_adherence_timezone_is_valid(v_timezone) then
    raise exception 'ROUTINE_ADHERENCE_TIMEZONE_REQUIRED' using errcode = '55000';
  end if;
  return query
  select projection.*
    from private.recompute_routine_adherence(
      v_user_id,
      v_timezone,
      pg_catalog.statement_timestamp()
    ) as projection;
end;
$$;

revoke all on function public.refresh_routine_adherence()
  from public, anon, service_role;
grant execute on function public.refresh_routine_adherence()
  to authenticated;

-- Completion evidence is append-only. Explicit ACL revocation closes the
-- service-role RLS-bypass path, while the trigger protects owner-level paths
-- from silently mutating evidence without a matching cache recomputation.
revoke update, delete on table public.routine_completions
  from public, anon, authenticated, service_role;
revoke truncate, references, trigger on table public.routine_completions
  from public, anon, authenticated, service_role;

create or replace function private.reject_routine_completion_update()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  raise exception 'ROUTINE_COMPLETION_IMMUTABLE' using errcode = '55000';
end;
$$;

revoke all on function private.reject_routine_completion_update()
  from public, anon, authenticated, service_role;

drop trigger if exists trg_routine_completion_immutable
  on public.routine_completions;
create trigger trg_routine_completion_immutable
  before update on public.routine_completions
  for each row execute function private.reject_routine_completion_update();

-- Validation uses the exact stored local day, keeps D-012's -2/+1 offline and
-- travel tolerance, and proves referenced routine/step ownership even for
-- privileged publishers. The server always decides the source classification.
create or replace function public.validate_completion()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_timezone text;
  v_reference_day date;
begin
  if not public._account_access_allowed(new.user_id) then
    raise exception 'ACCOUNT_ACCESS_DENIED' using errcode = '42501';
  end if;
  if not exists (
    select 1
      from public.routines as routines
     where routines.id = new.routine_id
       and routines.user_id = new.user_id
  ) then
    raise exception 'ROUTINE_COMPLETION_ROUTINE_OWNER_INVALID' using errcode = '23503';
  end if;
  if new.step_id is not null
     and not exists (
       select 1
         from public.routine_steps as steps
        where steps.id = new.step_id
          and steps.routine_id = new.routine_id
     ) then
    raise exception 'ROUTINE_COMPLETION_STEP_ROUTINE_INVALID' using errcode = '23503';
  end if;

  select profiles.adherence_timezone
    into v_timezone
    from public.profiles as profiles
   where profiles.id = new.user_id
     and profiles.streak_algorithm_version = 1;
  if not private.routine_adherence_timezone_is_valid(v_timezone) then
    raise exception 'ROUTINE_ADHERENCE_TIMEZONE_REQUIRED' using errcode = '55000';
  end if;
  v_reference_day := private.routine_adherence_reference_day(
    v_timezone,
    pg_catalog.statement_timestamp()
  );

  if new.completed_date > v_reference_day + 1 then
    raise exception 'ROUTINE_COMPLETION_FUTURE_LIMIT' using errcode = '22023';
  end if;
  if new.completed_date < v_reference_day - 2 then
    raise exception 'ROUTINE_COMPLETION_BACKFILL_LIMIT' using errcode = '22023';
  end if;
  if not pg_catalog.isfinite(new.completed_at)
     or new.completed_at < pg_catalog.statement_timestamp() - interval '4 days'
     or new.completed_at > pg_catalog.statement_timestamp() + interval '1 day' then
    raise exception 'ROUTINE_COMPLETION_TIMESTAMP_INVALID' using errcode = '22023';
  end if;
  new.source := case
    when new.completed_date < v_reference_day then 'backfilled'
    else 'live'
  end;
  -- completed_at is a bounded, user-attested original check-off instant.
  -- created_at alone is the server-authoritative receipt clock.
  new.created_at := pg_catalog.statement_timestamp();
  return new;
end;
$$;

revoke all on function public.validate_completion()
  from public, anon, authenticated, service_role;

drop policy if exists "routine_completions_insert_own"
  on public.routine_completions;
create policy "routine_completions_insert_own"
  on public.routine_completions
  for insert to authenticated
  with check (
    (select auth.uid()) = user_id
    and public.owns_routine(routine_id)
    and (
      step_id is null
      or exists (
        select 1
          from public.routine_steps as steps
         where steps.id = step_id
           and steps.routine_id = routine_completions.routine_id
      )
    )
  );

-- Recompute once per affected owner and statement, and only when a durable
-- routine-level marker changed. This avoids quadratic cascade work.
create or replace function public.on_completion_update_streak()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user_id uuid;
begin
  for v_user_id in
    select distinct completions.user_id
      from inserted_routine_completions as completions
     where completions.step_id is null
     order by completions.user_id
  loop
    perform public.recompute_streak(v_user_id);
  end loop;
  return null;
end;
$$;

revoke all on function public.on_completion_update_streak()
  from public, anon, authenticated, service_role;

create or replace function public.on_completion_delete_streak()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user_id uuid;
begin
  for v_user_id in
    select distinct completions.user_id
      from deleted_routine_completions as completions
     where completions.step_id is null
     order by completions.user_id
  loop
    if public._health_purge_context_active(v_user_id)
       or not exists (
         select 1 from auth.users as users where users.id = v_user_id
       )
       or exists (
         select 1
           from public.account_deletion_barriers as barriers
          where barriers.user_id = v_user_id
       ) then
      continue;
    end if;
    if exists (
      select 1 from public.profiles as profiles where profiles.id = v_user_id
    ) then
      perform public.recompute_streak(v_user_id);
    end if;
  end loop;
  return null;
end;
$$;

revoke all on function public.on_completion_delete_streak()
  from public, anon, authenticated, service_role;

drop trigger if exists trg_completion_streak on public.routine_completions;
create trigger trg_completion_streak
  after insert on public.routine_completions
  referencing new table as inserted_routine_completions
  for each statement execute function public.on_completion_update_streak();

drop trigger if exists trg_completion_streak_delete
  on public.routine_completions;
create trigger trg_completion_streak_delete
  after delete on public.routine_completions
  referencing old table as deleted_routine_completions
  for each statement execute function public.on_completion_delete_streak();

-- Publish the profile read barrier's new health fields synchronously with the
-- state transition. The legacy begin RPC's later zero update becomes a no-op.
create or replace function private.clear_routine_adherence_on_withdrawal()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  perform pg_catalog.set_config(
    'app.health_read_barrier', new.user_id::text, true
  );
  begin
    update public.profiles as profiles
       set current_streak = 0,
           longest_streak = 0,
           adherence_timezone = null,
           streak_reference_day = null,
           streak_algorithm_version = 0,
           updated_at = pg_catalog.statement_timestamp()
     where profiles.id = new.user_id
       and (
         profiles.current_streak <> 0
         or profiles.longest_streak <> 0
         or profiles.adherence_timezone is not null
         or profiles.streak_reference_day is not null
         or profiles.streak_algorithm_version <> 0
       );
  exception when others then
    perform pg_catalog.set_config('app.health_read_barrier', '', true);
    raise;
  end;
  perform pg_catalog.set_config('app.health_read_barrier', '', true);
  return null;
end;
$$;

revoke all on function private.clear_routine_adherence_on_withdrawal()
  from public, anon, authenticated, service_role;

drop trigger if exists trg_health_withdrawal_clear_routine_adherence
  on public.health_processing_states;
create trigger trg_health_withdrawal_clear_routine_adherence
  after update of state on public.health_processing_states
  for each row
  when (old.state is distinct from new.state and new.state = 'withdrawing')
  execute function private.clear_routine_adherence_on_withdrawal();

-- Extend exact zero-attestation so a withdrawal cannot succeed while any new
-- adherence timezone/cache residue remains.
create or replace function public._health_relational_data_exists(p_user_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select p_user_id is not null and (
    exists (select 1 from public.skin_profiles where user_id = p_user_id)
    or exists (select 1 from public.user_products where user_id = p_user_id)
    or exists (select 1 from public.shelf_scans where user_id = p_user_id)
    or exists (select 1 from public.routines where user_id = p_user_id)
    or exists (
      select 1 from public.routine_steps as steps
      join public.routines as routines on routines.id = steps.routine_id
      where routines.user_id = p_user_id
    )
    or exists (select 1 from public.routine_completions where user_id = p_user_id)
    or exists (select 1 from public.routine_conflicts where user_id = p_user_id)
    or exists (select 1 from public.active_ramp where user_id = p_user_id)
    or exists (select 1 from public.cycles where user_id = p_user_id)
    or exists (
      select 1 from public.cycle_nights as nights
      join public.cycles as cycles on cycles.id = nights.cycle_id
      where cycles.user_id = p_user_id
    )
    or exists (select 1 from public.streak_freezes where user_id = p_user_id)
    or exists (select 1 from public.notification_preferences where user_id = p_user_id)
    or exists (select 1 from public.notification_log where user_id = p_user_id)
    or exists (select 1 from public.photos where user_id = p_user_id)
    or exists (select 1 from public.recommendation_preferences where user_id = p_user_id)
    or exists (select 1 from public.recommendations where user_id = p_user_id)
    or exists (select 1 from public.catalog_corrections where user_id = p_user_id)
    or exists (select 1 from public.catalog_lookup_events where user_id = p_user_id)
    or exists (select 1 from public.commerce_click_events where user_id = p_user_id)
    or exists (
      select 1 from public.order_attributions as attributions
      join public.commerce_click_events as clicks
        on clicks.click_token = attributions.click_token
      where clicks.user_id = p_user_id
    )
    or exists (select 1 from public.community_blocks where user_id = p_user_id)
    or exists (select 1 from public.community_questions where user_id = p_user_id)
    or exists (select 1 from public.community_reactions where user_id = p_user_id)
    or exists (select 1 from public.community_reports where reporter_id = p_user_id)
    or exists (
      select 1 from public.community_reports as reports
      join public.community_questions as questions on questions.id = reports.question_id
      where questions.user_id = p_user_id
    )
    or exists (
      select 1 from public.community_moderation_events as events
      join public.community_questions as questions on questions.id = events.question_id
      where questions.user_id = p_user_id
    )
    or exists (select 1 from public.photo_trend where user_id = p_user_id)
    or exists (select 1 from public.ask_sessions where user_id = p_user_id)
    or exists (
      select 1 from public.ask_turn_audit as turns
      join public.ask_sessions as sessions on sessions.id = turns.session_id
      where sessions.user_id = p_user_id
    )
    or exists (select 1 from public.ask_safety_audit where user_id = p_user_id)
    or exists (select 1 from public.obf_contribution_queue where user_id = p_user_id)
    or exists (
      select 1
        from public.profiles
       where id = p_user_id
         and (
           current_streak <> 0
           or longest_streak <> 0
           or adherence_timezone is not null
           or streak_reference_day is not null
           or streak_algorithm_version <> 0
         )
    )
  );
$$;

revoke all on function public._health_relational_data_exists(uuid)
  from public, anon, authenticated, service_role;

commit;
