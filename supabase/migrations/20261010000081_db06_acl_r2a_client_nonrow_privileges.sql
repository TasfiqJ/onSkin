-- DB06-ACL-R2A: review-only partial ACL correction after the 96-migration baseline.
-- R2B (supabase_admin defaults), DB06 source approval and release gates stay OPEN.
begin;

do $authority$
begin
  if current_user <> 'postgres' or session_user <> 'postgres'
     or (select rolsuper from pg_catalog.pg_roles where rolname = current_user) then
    raise exception 'DB06_ACL_R2A_UNPROVEN_MIGRATION_ACTOR';
  end if;
  -- Schema defaults add to global defaults: a scoped revoke cannot negate a
  -- global grant. Refuse that unreviewed state instead of broadening this fix.
  if exists (
    select 1 from pg_catalog.pg_default_acl
    where defaclrole = 'postgres'::regrole
      and defaclobjtype = 'r' and defaclnamespace = 0
  ) then
    raise exception 'DB06_ACL_R2A_UNREVIEWED_GLOBAL_TABLE_DEFAULTS';
  end if;
end
$authority$;

revoke truncate, references, trigger on table
  public.account_deletion_click_tombstones,
  public.account_deletion_requests,
  public.active_ramp,
  public.ask_safety_audit,
  public.ask_sessions,
  public.ask_turn_audit,
  public.community_blocks,
  public.community_moderation_events,
  public.community_notes,
  public.community_questions,
  public.community_reactions,
  public.community_reports,
  public.community_topics,
  public.consents,
  public.cycle_nights,
  public.cycles,
  public.entitlements,
  public.growth_events,
  public.notification_log,
  public.notification_preferences,
  public.photo_trend,
  public.photos,
  public.reverse_trial_grants,
  public.routine_conflicts,
  public.skin_profiles,
  public.subscriptions_events,
  public.waitlist_signups
from anon, authenticated;

alter default privileges for role postgres in schema public
  revoke truncate, references, trigger on tables from anon, authenticated;

do $postconditions$
begin
  if exists (
    select 1
    from pg_catalog.pg_class c
    join pg_catalog.pg_namespace n on n.oid = c.relnamespace
    cross join (values ('anon'), ('authenticated')) clients(role_name)
    cross join (values ('TRUNCATE'), ('REFERENCES'), ('TRIGGER')) rights(privilege_name)
    where n.nspname = 'public' and c.relkind in ('r', 'p')
      and pg_catalog.has_table_privilege(clients.role_name, c.oid, rights.privilege_name)
  ) then
    raise exception 'DB06_ACL_R2A_CLIENT_NONROW_PERMISSION_SURVIVES';
  end if;
  if exists (
    select 1
    from pg_catalog.pg_default_acl d
    cross join lateral pg_catalog.aclexplode(d.defaclacl) a
    where d.defaclrole = 'postgres'::regrole
      and d.defaclnamespace = 'public'::regnamespace and d.defaclobjtype = 'r'
      and a.grantee in ('anon'::regrole, 'authenticated'::regrole)
      and a.privilege_type in ('TRUNCATE', 'REFERENCES', 'TRIGGER')
  ) then
    raise exception 'DB06_ACL_R2A_POSTGRES_CLIENT_NONROW_DEFAULT_SURVIVES';
  end if;
end
$postconditions$;

commit;
