-- =============================================================================
-- Phase 9 consent-withdrawal enforcement
-- =============================================================================
-- Withdrawal must stop future collection/sharing even for a modified client. These
-- restrictive policies make the latest consent ledger row authoritative for writes
-- that create cloud photo, Ask, trend, commerce-sharing, or community signal data.

create or replace function public.has_current_consent(p_consent_type text)
returns boolean
language sql
security definer
set search_path = ''
stable
as $$
  select coalesce((
    select c.granted
      from public.consents c
     where c.user_id = (select auth.uid())
       and c.consent_type = p_consent_type
     order by c.granted_at desc, c.granted asc
     limit 1
  ), false);
$$;
revoke all on function public.has_current_consent(text) from public, anon;
grant execute on function public.has_current_consent(text) to authenticated;

create or replace function public.owns_consent(p_consent_id uuid)
returns boolean
language sql
security definer
set search_path = ''
stable
as $$
  select exists (
    select 1
      from public.consents c
     where c.id = p_consent_id
       and c.user_id = (select auth.uid())
       and c.consent_type = 'community_participation'
       and c.granted = true
       and public.has_current_consent('community_participation')
       and c.granted_at = (
         select max(c2.granted_at)
           from public.consents c2
          where c2.user_id = (select auth.uid())
            and c2.consent_type = 'community_participation'
       )
  );
$$;
revoke all on function public.owns_consent(uuid) from public, anon;
grant execute on function public.owns_consent(uuid) to authenticated;

create policy "photos_cloud_backup_consent_insert" on public.photos
  as restrictive for insert to authenticated
  with check (
    local_only = true
    or public.has_current_consent('photo_cloud_backup')
  );

create policy "photos_cloud_backup_consent_update" on public.photos
  as restrictive for update to authenticated
  with check (
    local_only = true
    or public.has_current_consent('photo_cloud_backup')
  );

drop policy if exists "photos_objects_insert_own" on storage.objects;
create policy "photos_objects_insert_own" on storage.objects
  for insert to authenticated
  with check (
    bucket_id = 'photos'
    and (storage.foldername(name))[1] = (select auth.uid())::text
    and public.has_current_consent('photo_cloud_backup')
  );

drop policy if exists "photos_objects_update_own" on storage.objects;
create policy "photos_objects_update_own" on storage.objects
  for update to authenticated
  using (bucket_id = 'photos' and (storage.foldername(name))[1] = (select auth.uid())::text)
  with check (
    bucket_id = 'photos'
    and (storage.foldername(name))[1] = (select auth.uid())::text
    and public.has_current_consent('photo_cloud_backup')
  );

create policy "commerce_click_events_consent_insert" on public.commerce_click_events
  as restrictive for insert to authenticated
  with check (
    consented = true
    and public.has_current_consent('data_sharing')
  );

create policy "photo_trend_consent_insert" on public.photo_trend
  as restrictive for insert to authenticated
  with check (public.has_current_consent('photo_trend_insights'));

create policy "photo_trend_consent_update" on public.photo_trend
  as restrictive for update to authenticated
  with check (public.has_current_consent('photo_trend_insights'));

create policy "community_reactions_consent_insert" on public.community_reactions
  as restrictive for insert to authenticated
  with check (public.has_current_consent('community_participation'));

create policy "ask_sessions_consent_insert" on public.ask_sessions
  as restrictive for insert to authenticated
  with check (public.has_current_consent('ask_onskin'));

create policy "ask_sessions_consent_update" on public.ask_sessions
  as restrictive for update to authenticated
  with check (public.has_current_consent('ask_onskin'));

create policy "ask_turn_audit_consent_insert" on public.ask_turn_audit
  as restrictive for insert to authenticated
  with check (public.has_current_consent('ask_onskin'));

create policy "ask_safety_audit_consent_insert" on public.ask_safety_audit
  as restrictive for insert to authenticated
  with check (public.has_current_consent('ask_onskin'));
