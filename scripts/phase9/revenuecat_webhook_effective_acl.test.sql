-- CI-R3 native effective ACL and v0051 HMAC/tombstone source boundary.
-- psql -X -v ON_ERROR_STOP=1 "$DISPOSABLE_DB_URL" -f scripts/phase9/revenuecat_webhook_effective_acl.test.sql
begin;
do $verify$
declare
  delegate regprocedure := to_regprocedure('public.process_revenuecat_webhook_event(text,text,text[],text,text,text[],text[],text[],text,text,text,text,timestamptz,timestamptz,timestamptz,timestamptz,text,text,text,boolean,boolean,boolean,smallint,text,jsonb,boolean,boolean)');
  guard27 regprocedure := to_regprocedure('public.process_revenuecat_webhook_event_guarded(text,text,text[],text,text,text[],text[],text[],text,text,text,text,timestamptz,timestamptz,timestamptz,timestamptz,text,text,text,boolean,boolean,boolean,smallint,text,jsonb,boolean,boolean)');
  entry regprocedure := to_regprocedure('public.process_revenuecat_webhook_event_guarded(text,text,text[],text,text,text[],text[],text[],text,text,text,text,timestamptz,timestamptz,timestamptz,timestamptz,text,text,text,boolean,boolean,boolean,smallint,text,jsonb,boolean,boolean,smallint[],text[],text[])');
  routine record;
  role_name text;
  public_execute boolean;
  hmac_def text;
begin
  if delegate is null or guard27 is null or entry is null
     or delegate::oid=guard27::oid or guard27::oid=entry::oid then
    raise exception 'Missing or aliased exact RevenueCat webhook overload';
  end if;

  for routine in select p.oid,p.prosecdef,p.proconfig,p.proacl,p.proowner
                   from pg_catalog.pg_proc p where p.oid in (delegate::oid,guard27::oid,entry::oid)
  loop
    if routine.prosecdef is not true
       or not (coalesce(routine.proconfig,array[]::text[]) @> array['search_path=""']) then
      raise exception 'Untrusted SECURITY DEFINER: %',routine.oid::regprocedure;
    end if;
    select coalesce(bool_or(a.grantee=0 and a.privilege_type='EXECUTE'),false)
      into public_execute from pg_catalog.aclexplode(
        coalesce(routine.proacl,pg_catalog.acldefault('f',routine.proowner))) a;
    if public_execute then raise exception 'PUBLIC EXECUTE leak: %',routine.oid::regprocedure; end if;
    foreach role_name in array array['anon','authenticated'] loop
      if pg_catalog.has_function_privilege(role_name,routine.oid,'EXECUTE') then
        raise exception '% can EXECUTE %',role_name,routine.oid::regprocedure;
      end if;
    end loop;
    if routine.oid = delegate::oid and pg_catalog.has_function_privilege('service_role',routine.oid,'EXECUTE') then
      raise exception 'service_role bypasses raw27 private delegate';
    end if;
    if routine.oid = guard27::oid and pg_catalog.has_function_privilege('service_role',routine.oid,'EXECUTE') then
      raise exception 'service_role bypasses guarded27 HMAC/tombstone delegate';
    end if;
    if routine.oid = entry::oid and not pg_catalog.has_function_privilege('service_role',routine.oid,'EXECUTE') then
      raise exception 'guarded30 lacks service_role EXECUTE';
    end if;
  end loop;

  -- The 30-arg wrapper must continue consulting the identity tombstone set
  -- and delegate to the owner-private guarded27 after filtering. Merely
  -- granting guarded30 is insufficient if the guard implementation changes.
  select pg_catalog.pg_get_functiondef(entry::oid) into hmac_def;
  if position('p_identity_hmac_key_versions' in hmac_def)=0
    or position('p_identity_hmacs' in hmac_def)=0
    or position('p_identity_values' in hmac_def)=0
    or position('revenuecat_identity_tombstones' in hmac_def)=0
    or position('INVALID_REVENUECAT_IDENTITY_TOMBSTONE_LOOKUP' in hmac_def)=0
    or position('process_revenuecat_webhook_event_guarded(' in hmac_def)=0
    or position('suppressed_deleted_account' in hmac_def)=0 then
    raise exception 'HMAC/tombstone runtime wrapper is not the reviewed v0051 authority';
  end if;
  raise notice 'PASS: only HMAC-aware guarded30 executable by service_role; raw27/guarded27 private';
end;
$verify$;
rollback;
