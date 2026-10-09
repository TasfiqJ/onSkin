-- CI-R3 effective PostgreSQL three-overload authority: native pgTAP.
-- Run only after all 96 migrations on disposable PostgreSQL with service API roles.
begin;
create extension if not exists pgtap with schema extensions;
set local search_path = extensions, public, pg_catalog;
select plan(24);

create temp table _revenuecat_routines as
select
  'public.process_revenuecat_webhook_event(text,text,text[],text,text,text[],text[],text[],text,text,text,text,timestamptz,timestamptz,timestamptz,timestamptz,text,text,text,boolean,boolean,boolean,smallint,text,jsonb,boolean,boolean)'::text as expected_signature,
  'private'::text as purpose

union all
select
  'public.process_revenuecat_webhook_event_guarded(text,text,text[],text,text,text[],text[],text[],text,text,text,text,timestamptz,timestamptz,timestamptz,timestamptz,text,text,text,boolean,boolean,boolean,smallint,text,jsonb,boolean,boolean)'::text as expected_signature,
  'guarded27'::text as purpose

union all
select
  'public.process_revenuecat_webhook_event_guarded(text,text,text[],text,text,text[],text[],text[],text,text,text,text,timestamptz,timestamptz,timestamptz,timestamptz,text,text,text,boolean,boolean,boolean,smallint,text,jsonb,boolean,boolean,smallint[],text[],text[])'::text as expected_signature,
  'service'::text as purpose
;
select is((select count(*) from pg_catalog.pg_proc where oid = (select to_regprocedure(expected_signature) from _revenuecat_routines where purpose='private')),1::bigint,'exact private overload exists');
select is((select count(*) from pg_catalog.pg_proc where oid = (select to_regprocedure(expected_signature) from _revenuecat_routines where purpose='guarded27')),1::bigint,'exact guarded27 overload exists');
select is((select count(*) from pg_catalog.pg_proc where oid = (select to_regprocedure(expected_signature) from _revenuecat_routines where purpose='service')),1::bigint,'exact service overload exists');
select ok((select prosecdef from pg_catalog.pg_proc where oid = (select to_regprocedure(expected_signature) from _revenuecat_routines where purpose='private')),'private remains SECURITY DEFINER');
select ok((select prosecdef from pg_catalog.pg_proc where oid = (select to_regprocedure(expected_signature) from _revenuecat_routines where purpose='guarded27')),'guarded27 remains SECURITY DEFINER');
select ok((select prosecdef from pg_catalog.pg_proc where oid = (select to_regprocedure(expected_signature) from _revenuecat_routines where purpose='service')),'service remains SECURITY DEFINER');
select ok((select proconfig @> array['search_path=""'] from pg_catalog.pg_proc where oid = (select to_regprocedure(expected_signature) from _revenuecat_routines where purpose='private')),'private pins empty search_path');
select ok((select proconfig @> array['search_path=""'] from pg_catalog.pg_proc where oid = (select to_regprocedure(expected_signature) from _revenuecat_routines where purpose='guarded27')),'guarded27 pins empty search_path');
select ok((select proconfig @> array['search_path=""'] from pg_catalog.pg_proc where oid = (select to_regprocedure(expected_signature) from _revenuecat_routines where purpose='service')),'service pins empty search_path');
select ok(not pg_catalog.has_function_privilege('anon',(select to_regprocedure(expected_signature) from _revenuecat_routines where purpose='private'),'EXECUTE'),'anon cannot execute private');
select ok(not pg_catalog.has_function_privilege('authenticated',(select to_regprocedure(expected_signature) from _revenuecat_routines where purpose='private'),'EXECUTE'),'authenticated cannot execute private');
select ok(not pg_catalog.has_function_privilege('anon',(select to_regprocedure(expected_signature) from _revenuecat_routines where purpose='guarded27'),'EXECUTE'),'anon cannot execute guarded27');
select ok(not pg_catalog.has_function_privilege('authenticated',(select to_regprocedure(expected_signature) from _revenuecat_routines where purpose='guarded27'),'EXECUTE'),'authenticated cannot execute guarded27');
select ok(not pg_catalog.has_function_privilege('anon',(select to_regprocedure(expected_signature) from _revenuecat_routines where purpose='service'),'EXECUTE'),'anon cannot execute service');
select ok(not pg_catalog.has_function_privilege('authenticated',(select to_regprocedure(expected_signature) from _revenuecat_routines where purpose='service'),'EXECUTE'),'authenticated cannot execute service');
select ok(not pg_catalog.has_function_privilege('service_role',(select to_regprocedure(expected_signature) from _revenuecat_routines where purpose='private'),'EXECUTE'),'service_role cannot execute private');
select ok(not pg_catalog.has_function_privilege('service_role',(select to_regprocedure(expected_signature) from _revenuecat_routines where purpose='guarded27'),'EXECUTE'),'service_role cannot execute guarded27');
select ok(pg_catalog.has_function_privilege('service_role',(select to_regprocedure(expected_signature) from _revenuecat_routines where purpose='service'),'EXECUTE'),'service_role can execute service');
select ok(not exists (
  select 1 from pg_catalog.pg_proc p
  cross join lateral pg_catalog.aclexplode(coalesce(p.proacl,pg_catalog.acldefault('f',p.proowner))) a
  where p.oid=(select to_regprocedure(expected_signature) from _revenuecat_routines where purpose='private') and a.grantee=0 and a.privilege_type='EXECUTE'
), 'PUBLIC has no execution grant on private');
select ok(not exists (
  select 1 from pg_catalog.pg_proc p
  cross join lateral pg_catalog.aclexplode(coalesce(p.proacl,pg_catalog.acldefault('f',p.proowner))) a
  where p.oid=(select to_regprocedure(expected_signature) from _revenuecat_routines where purpose='guarded27') and a.grantee=0 and a.privilege_type='EXECUTE'
), 'PUBLIC has no execution grant on guarded27');
select ok(not exists (
  select 1 from pg_catalog.pg_proc p
  cross join lateral pg_catalog.aclexplode(coalesce(p.proacl,pg_catalog.acldefault('f',p.proowner))) a
  where p.oid=(select to_regprocedure(expected_signature) from _revenuecat_routines where purpose='service') and a.grantee=0 and a.privilege_type='EXECUTE'
), 'PUBLIC has no execution grant on service');
select is((select count(*) from pg_catalog.pg_proc where oid=(select to_regprocedure(expected_signature) from _revenuecat_routines where purpose='private') and proacl is not null),1::bigint,'private has a persisted explicit ACL');
select is((select count(*) from pg_catalog.pg_proc where oid=(select to_regprocedure(expected_signature) from _revenuecat_routines where purpose='guarded27') and proacl is not null),1::bigint,'guarded27 has a persisted explicit ACL');
select is((select count(*) from pg_catalog.pg_proc where oid=(select to_regprocedure(expected_signature) from _revenuecat_routines where purpose='service') and proacl is not null),1::bigint,'service has a persisted explicit ACL');

select * from finish();
rollback;
