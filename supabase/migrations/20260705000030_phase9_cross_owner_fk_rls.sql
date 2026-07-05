-- =============================================================================
-- Phase 9 cross-owner FK hardening
-- =============================================================================
-- RLS policies must protect both the row owner and any user-owned foreign keys.
-- These policies close modified-client paths where a caller could create an owned
-- child row that points at another user's product, Ask turn, or private community
-- question if they ever learned a UUID.

drop policy if exists "routine_steps_insert_own" on public.routine_steps;
create policy "routine_steps_insert_own" on public.routine_steps
  for insert to authenticated
  with check (
    public.owns_routine(routine_id)
    and (user_product_id is null or public.owns_user_product(user_product_id))
  );

drop policy if exists "routine_steps_update_own" on public.routine_steps;
create policy "routine_steps_update_own" on public.routine_steps
  for update to authenticated
  using (public.owns_routine(routine_id))
  with check (
    public.owns_routine(routine_id)
    and (user_product_id is null or public.owns_user_product(user_product_id))
  );

drop policy if exists "cycle_nights_insert_own" on public.cycle_nights;
create policy "cycle_nights_insert_own" on public.cycle_nights
  for insert to authenticated
  with check (
    public.owns_cycle(cycle_id)
    and (user_product_id is null or public.owns_user_product(user_product_id))
  );

drop policy if exists "cycle_nights_update_own" on public.cycle_nights;
create policy "cycle_nights_update_own" on public.cycle_nights
  for update to authenticated
  using (public.owns_cycle(cycle_id))
  with check (
    public.owns_cycle(cycle_id)
    and (user_product_id is null or public.owns_user_product(user_product_id))
  );

create or replace function public.owns_ask_turn_audit(p_turn_audit_id uuid)
returns boolean
language sql
security definer
set search_path = ''
stable
as $$
  select exists (
    select 1
      from public.ask_turn_audit t
      join public.ask_sessions s on s.id = t.session_id
     where t.id = p_turn_audit_id
       and s.user_id = (select auth.uid())
  );
$$;
revoke all on function public.owns_ask_turn_audit(uuid) from public, anon;
grant execute on function public.owns_ask_turn_audit(uuid) to authenticated;

drop policy if exists "ask_safety_audit_select_own" on public.ask_safety_audit;
create policy "ask_safety_audit_select_own" on public.ask_safety_audit
  for select to authenticated
  using (
    (select auth.uid()) = user_id
    and public.owns_ask_turn_audit(turn_audit_id)
  );

drop policy if exists "ask_safety_audit_insert_own" on public.ask_safety_audit;
create policy "ask_safety_audit_insert_own" on public.ask_safety_audit
  for insert to authenticated
  with check (
    (select auth.uid()) = user_id
    and public.owns_ask_turn_audit(turn_audit_id)
  );

drop policy if exists "ask_safety_audit_delete_own" on public.ask_safety_audit;
create policy "ask_safety_audit_delete_own" on public.ask_safety_audit
  for delete to authenticated
  using (
    (select auth.uid()) = user_id
    and public.owns_ask_turn_audit(turn_audit_id)
  );

drop policy if exists "community_reports_insert_own" on public.community_reports;
create policy "community_reports_insert_own" on public.community_reports
  for insert to authenticated
  with check (
    (select auth.uid()) = reporter_id
    and exists (
      select 1
        from public.community_questions q
       where q.id = community_reports.question_id
         and (
           q.user_id = (select auth.uid())
           or (
             q.moderation_state = 'approved'
             and not exists (
               select 1
                 from public.community_blocks b
                where b.user_id = (select auth.uid())
                  and b.blocked_handle = q.anon_handle
             )
           )
         )
    )
  );
