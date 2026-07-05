-- =============================================================================
-- Phase 9 photo metadata and community reference hardening
-- =============================================================================
-- Owner-only rows still need reference-level checks. A modified client must not
-- create photo metadata for another user's storage prefix, keep cloud paths on a
-- local-only photo, or react to unpublished editorial community notes.

create policy "photos_storage_path_owned_insert" on public.photos
  as restrictive for insert to authenticated
  with check (
    (
      local_only = true
      and storage_path is null
    )
    or (
      local_only = false
      and storage_path is not null
      and split_part(storage_path, '/', 1) = (select auth.uid())::text
    )
  );

create policy "photos_storage_path_owned_update" on public.photos
  as restrictive for update to authenticated
  with check (
    (
      local_only = true
      and storage_path is null
    )
    or (
      local_only = false
      and storage_path is not null
      and split_part(storage_path, '/', 1) = (select auth.uid())::text
    )
  );

drop policy if exists "community_reactions_insert_own" on public.community_reactions;
create policy "community_reactions_insert_own" on public.community_reactions
  for insert to authenticated
  with check (
    (select auth.uid()) = user_id
    and note_id is not null
    and exists (
      select 1
        from public.community_notes n
       where n.id = community_reactions.note_id
         and n.reviewed_by is not null
         and n.claim_safety_ok = true
    )
  );
