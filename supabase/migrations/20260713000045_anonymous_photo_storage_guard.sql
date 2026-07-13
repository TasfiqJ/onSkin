-- Keep the Storage object boundary aligned with public.photos: signed anonymous
-- Auth users may keep photos local, but may not persist cloud photo bytes even if
-- a modified client writes a photo_cloud_backup consent row for itself.

begin;

drop policy if exists "photos_objects_insert_own" on storage.objects;
create policy "photos_objects_insert_own" on storage.objects
  for insert to authenticated
  with check (
    bucket_id = 'photos'
    and (storage.foldername(name))[1] = (select auth.uid())::text
    and public.has_current_consent('photo_cloud_backup')
    and coalesce(((select auth.jwt()) ->> 'is_anonymous')::boolean, false) = false
  );

drop policy if exists "photos_objects_update_own" on storage.objects;
create policy "photos_objects_update_own" on storage.objects
  for update to authenticated
  using (
    bucket_id = 'photos'
    and (storage.foldername(name))[1] = (select auth.uid())::text
  )
  with check (
    bucket_id = 'photos'
    and (storage.foldername(name))[1] = (select auth.uid())::text
    and public.has_current_consent('photo_cloud_backup')
    and coalesce(((select auth.jwt()) ->> 'is_anonymous')::boolean, false) = false
  );

commit;
