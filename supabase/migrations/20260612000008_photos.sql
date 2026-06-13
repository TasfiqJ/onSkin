-- =============================================================================
-- 0008 · photos (metadata) + private Storage bucket
-- =============================================================================
-- Privacy-first (docs/01 §3): local_only defaults TRUE — image bytes never leave
-- the device unless the user opts into cloud backup. NO faceprint/biometric
-- template is ever stored (BIPA avoidance). storage_path is NULL while local-only.
create table public.photos (
  id                   uuid primary key default gen_random_uuid(),
  user_id              uuid not null references auth.users (id) on delete cascade,
  storage_path         text,                       -- NULL when local_only
  taken_at             timestamptz not null default now(),
  lighting_score       numeric,
  alignment_score      numeric,
  local_only           boolean not null default true,
  face_region_redacted boolean not null default false,
  created_at           timestamptz not null default now()
);
create index photos_user_id_idx on public.photos (user_id);

alter table public.photos enable row level security;

-- Permissive owner policies.
create policy "photos_select_own" on public.photos
  for select to authenticated using ((select auth.uid()) = user_id);
create policy "photos_insert_own" on public.photos
  for insert to authenticated with check ((select auth.uid()) = user_id);
create policy "photos_update_own" on public.photos
  for update to authenticated using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);
create policy "photos_delete_own" on public.photos
  for delete to authenticated using ((select auth.uid()) = user_id);

-- RESTRICTIVE: anonymous users may NOT cloud-back a photo (local_only must stay
-- true). Restrictive policies AND with the permissive ones above; they must be
-- paired with a permissive policy that can return true (docs/01 §1).
create policy "photos_no_anon_cloud_backup_insert" on public.photos
  as restrictive for insert to authenticated
  with check (
    local_only = true
    or coalesce(((select auth.jwt()) ->> 'is_anonymous')::boolean, false) = false
  );
create policy "photos_no_anon_cloud_backup_update" on public.photos
  as restrictive for update to authenticated
  with check (
    local_only = true
    or coalesce(((select auth.jwt()) ->> 'is_anonymous')::boolean, false) = false
  );

-- Private Storage bucket for any opted-in cloud photos. Public buckets bypass
-- RLS on read — never use one for photos (docs/01 §3).
insert into storage.buckets (id, name, public)
values ('photos', 'photos', false)
on conflict (id) do nothing;

-- Object path convention: "<user_id>/<filename>". Scope by the first folder.
create policy "photos_objects_select_own" on storage.objects
  for select to authenticated
  using (bucket_id = 'photos' and (storage.foldername(name))[1] = (select auth.uid())::text);
create policy "photos_objects_insert_own" on storage.objects
  for insert to authenticated
  with check (bucket_id = 'photos' and (storage.foldername(name))[1] = (select auth.uid())::text);
create policy "photos_objects_update_own" on storage.objects
  for update to authenticated
  using (bucket_id = 'photos' and (storage.foldername(name))[1] = (select auth.uid())::text)
  with check (bucket_id = 'photos' and (storage.foldername(name))[1] = (select auth.uid())::text);
create policy "photos_objects_delete_own" on storage.objects
  for delete to authenticated
  using (bucket_id = 'photos' and (storage.foldername(name))[1] = (select auth.uid())::text);
