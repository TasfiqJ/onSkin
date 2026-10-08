-- P2A-R2 publication regression. Run ONLY on an acknowledged fresh disposable
-- PostgreSQL/Supabase database after all migrations. No remote/provider action.
-- PGOPTIONS='-c c10.disposable_database=on' psql -X -v ON_ERROR_STOP=1 ... -f this-file
-- The separate native rehearsal covers genuine concurrent backends; this file
-- is also executable in PGlite as sequential SQL evidence, never concurrency.
do $$ begin
  if current_setting('c10.disposable_database', true) is distinct from 'on' then
    raise exception 'C10_DISPOSABLE_DATABASE_ACKNOWLEDGEMENT_REQUIRED';
  end if;
  if exists(select 1 from auth.users) or exists(select 1 from public.entitlements)
    or exists(select 1 from public.subscriptions_events)
    or to_regprocedure('public.c10_r2_assert(boolean,text)') is not null then
    raise exception 'C10_FRESH_DISPOSABLE_DATABASE_REQUIRED';
  end if;
end $$;
begin;
insert into auth.users(id) select ('00000000-0000-4000-8000-' || lpad(n::text,12,'0'))::uuid
 from generate_series(91,99) s(n);
insert into auth.sessions(id,user_id)
 select ('10000000-0000-4000-8000-' || lpad(n::text,12,'0'))::uuid,
 ('00000000-0000-4000-8000-' || lpad(n::text,12,'0'))::uuid from generate_series(91,99) s(n);
create function public.c10_r2_assert(p_ok boolean,p_label text) returns void
 language plpgsql as $$ begin if p_ok is distinct from true then raise exception '%',p_label; end if; end $$;
create function public.c10_r2_event(
 p_id text,p_type text,p_at timestamptz,
 p_owner text default '00000000-0000-4000-8000-000000000091',
 p_tx text default 'r2-tx',p_purchase timestamptz default now()-interval '2 days',
 p_expiry timestamptz default now()+interval '25 days',p_reason text default null,
 p_supported boolean default true,p_original text default 'r2-chain',
 p_payload_marker jsonb default null
) returns table(outcome text,projection_applied boolean,processing_status text)
 language sql set search_path='' as $$
 select * from public.process_revenuecat_webhook_event_guarded(
   p_id,p_type,array[p_owner],p_owner,null,null,null,null,
   'production','app_store','layerwell_pro_monthly','pro',p_expiry,p_purchase,
   p_at,clock_timestamp(),p_original,p_tx,'normal',
   p_type in ('INITIAL_PURCHASE','RENEWAL','UNCANCELLATION'),
   p_type <> 'EXPIRATION' and not(p_type='CANCELLATION' and p_reason='CUSTOMER_SUPPORT'),
   p_supported,(case when p_type='EXPIRATION' or(p_type='CANCELLATION' and p_reason='CUSTOMER_SUPPORT')
     then 300 when p_type in('INITIAL_PURCHASE','RENEWAL','REFUND_REVERSED','BILLING_ISSUE')
     then 200 else 100 end)::smallint,null,
   jsonb_build_object('event',jsonb_build_object('id',p_id,'type',p_type,'cancel_reason',p_reason),
      '_onskin_fact_v1',p_payload_marker),false,true,array[1::smallint],
   array[encode(sha256(convert_to('r2-test:'||p_owner,'UTF8')),'hex')],array[p_owner]);
$$;
grant execute on function public.c10_r2_event(text,text,timestamptz,text,text,timestamptz,timestamptz,text,boolean,text,jsonb)
 to service_role;

-- Direct and private write/version capability never reaches an authenticated
-- client. The existing no-argument reader retains its exact-session fence.
select public.c10_r2_assert(
 not has_schema_privilege('authenticated','revenuecat_publication','USAGE')
 and not has_schema_privilege('service_role','revenuecat_publication','USAGE')
 and not has_table_privilege('authenticated','revenuecat_publication.projections','INSERT')
 and not has_sequence_privilege('authenticated','revenuecat_publication.revision_sequence','USAGE')
 and has_function_privilege('authenticated','public.read_entitlement_projections()','EXECUTE')
 and not has_function_privilege('service_role','public._read_entitlement_projections_v0053_unfenced()','EXECUTE'),
 'R2_PUBLICATION_PRIVILEGE_BROKEN');

-- Disputed P,C,F prefix revokes immediately under a NEW SERVER revision even
-- though the real provider head remains the later cancellation.
set local role service_role;
select * from public.c10_r2_event('r2-p','RENEWAL',now()-interval '4 hours');
select * from public.c10_r2_event('r2-c','CANCELLATION',now()-interval '1 hour',p_reason=>'UNSUBSCRIBE');
reset role;
create temporary table c10_r2_before as select * from revenuecat_publication.projections;
set local role service_role;
select * from public.c10_r2_event('r2-f','CANCELLATION',now()-interval '3 hours',p_reason=>'CUSTOMER_SUPPORT');
reset role;
select public.c10_r2_assert(
 exists(select 1 from public.entitlements e join revenuecat_publication.projections p using(user_id)
 join c10_r2_before b using(user_id) where not e.is_active and not e.will_renew
 and e.rc_event_id='r2-c' and p.revision>b.revision and p.canonical->>'state'='inactive'),
 'R2_LATE_REFUND_NOT_PUBLISHED_IMMEDIATELY');
set local role service_role;
select * from public.c10_r2_event('r2-r','REFUND_REVERSED',now()-interval '2 hours');
reset role;
select public.c10_r2_assert(exists(select 1 from public.entitlements
 where is_active and not will_renew and rc_event_id='r2-c'),'R2_LATE_REVERSAL_LOST_RENEWAL_INTENTION');
create temporary table c10_r2_fixed as select * from revenuecat_publication.projections;
set local role service_role;
select * from public.c10_r2_event('r2-f','CANCELLATION',now()-interval '3 hours',p_reason=>'CUSTOMER_SUPPORT');
select * from public.c10_r2_event('r2-r','REFUND_REVERSED',now()-interval '2 hours');
select * from public.c10_r2_event('r2-c','CANCELLATION',now()-interval '1 hour',p_reason=>'UNSUBSCRIBE');
reset role;
select public.c10_r2_assert(not exists((select * from revenuecat_publication.projections except select * from c10_r2_fixed)
 union all(select * from c10_r2_fixed except select * from revenuecat_publication.projections)),
 'R2_DUPLICATE_BUMPED_OR_CHANGED_PUBLICATION');
select 'R2_LATE_FACT_REVISION_AND_DUPLICATE_PASS' as result;

-- Dependency receipts are reconsidered automatically; nobody resets a client
-- cache or resends R/C for them to start affecting the result.
set local role service_role;
select * from public.c10_r2_event('r2-dep-r','REFUND_REVERSED',now()-interval '1 hour',
 '00000000-0000-4000-8000-000000000092');
select * from public.c10_r2_event('r2-dep-c','CANCELLATION',now()-interval '2 hours',
 '00000000-0000-4000-8000-000000000092',p_reason=>'UNSUBSCRIBE');
select * from public.c10_r2_event('r2-dep-f','CANCELLATION',now()-interval '3 hours',
 '00000000-0000-4000-8000-000000000092',p_reason=>'CUSTOMER_SUPPORT');
reset role;
select public.c10_r2_assert(exists(select 1 from public.entitlements
 where user_id='00000000-0000-4000-8000-000000000092' and not is_active and will_renew is null),
 'R2_FIRST_SEEN_REFUND_GRANTED_PURCHASE_OR_RENEWAL');
set local role service_role;
select * from public.c10_r2_event('r2-dep-p','RENEWAL',now()-interval '4 hours',
 '00000000-0000-4000-8000-000000000092');
reset role;
select public.c10_r2_assert(exists(select 1 from public.entitlements
 where user_id='00000000-0000-4000-8000-000000000092' and is_active and not will_renew)
 and not exists(select 1 from public.subscriptions_events
 where rc_event_id in('r2-dep-r','r2-dep-c') and processing_status='error'),
 'R2_ACCEPTED_PREREQUISITE_DID_NOT_RECONSIDER_PENDING_FACTS');
select 'R2_AUTOMATIC_DEPENDENCY_RECONSIDERATION_PASS' as result;

-- Old-history JSON is not an admission token. Forged static markers, unsupported
-- events and payload lookalikes cannot create purchase proof for a reversal.
insert into public.subscriptions_events(rc_event_id,user_id,resolved_user_id,event_type,payload,
 received_at,provider_event_at,transaction_id,original_transaction_id,product_id,store,
 environment,processing_status,projection_priority,auth_verified)
 values('r2-forged-history','00000000-0000-4000-8000-000000000093',
 '00000000-0000-4000-8000-000000000093','RENEWAL',jsonb_build_object(
 'event',jsonb_build_object('type','RENEWAL','expiration_at_ms',extract(epoch from now()+interval '25 days')*1000),
 '_onskin_fact_v1',jsonb_build_object('version',1,'epoch','00000000-0000-0000-0000-000000000000',
 'expiration_at',now()+interval '25 days','purchased_at',now()-interval '2 days',
 'period_type','normal','will_renew',true)),now(),now()-interval '4 hours','r2-tx','r2-chain',
 'layerwell_pro_monthly','app_store','production','processed',200,true);
set local role service_role;
select * from public.c10_r2_event('r2-forged-f','CANCELLATION',now()-interval '3 hours',
 '00000000-0000-4000-8000-000000000093',p_reason=>'CUSTOMER_SUPPORT');
select * from public.c10_r2_event('r2-forged-r','REFUND_REVERSED',now()-interval '2 hours',
 '00000000-0000-4000-8000-000000000093');
select * from public.c10_r2_event('r2-unsupported-p','RENEWAL',now()-interval '4 hours',
 '00000000-0000-4000-8000-000000000093',p_supported=>false,
 p_payload_marker=>' {"version":1,"epoch":"forged"}'::jsonb);
reset role;
select public.c10_r2_assert(exists(select 1 from public.entitlements
 where user_id='00000000-0000-4000-8000-000000000093' and not is_active)
 and exists(select 1 from public.subscriptions_events where rc_event_id='r2-forged-r' and processing_status='error')
 and not exists(select 1 from public.subscriptions_events where rc_event_id='r2-unsupported-p' and payload?'_onskin_fact_v1'),
 'R2_HISTORICAL_OR_CALLER_MARKER_BECAME_POSITIVE_PROOF');
select 'R2_FACT_PROVENANCE_PASS' as result;

-- Atomic rollback occurs after the sidecar has been written, during receipt
-- finalization. The acknowledged retry must name exactly one committed body.
create function public.c10_r2_inject_failure() returns trigger language plpgsql as $$ begin
 if new.rc_event_id='r2-fail' and new.processing_status='processed'
 and current_setting('c10.r2_fail',true)='on' then raise exception using errcode='23514',message='R2_TEST_FAIL_AFTER_PUBLICATION'; end if;
 return new; end $$;
create trigger c10_r2_inject_failure before update on public.subscriptions_events
 for each row execute function public.c10_r2_inject_failure();
set local c10.r2_fail='on';
create temporary table c10_r2_before_failure as select * from revenuecat_publication.projections;
set local role service_role;
select * from public.c10_r2_event('r2-fail','EXPIRATION',now(),p_expiry=>now()+interval '1 day');
reset role;
select public.c10_r2_assert(not exists((select * from revenuecat_publication.projections except select * from c10_r2_before_failure)
 union all(select * from c10_r2_before_failure except select * from revenuecat_publication.projections))
 and exists(select 1 from public.subscriptions_events where rc_event_id='r2-fail'
 and error='REVENUECAT_ATOMIC_PROCESSING_FAILED:23514' and not(payload?'_onskin_fact_v1')),
 'R2_FAILED_TRANSACTION_PUBLISHED_OR_RETAINED_ADMISSION');
set local c10.r2_fail='off';
set local role service_role;
select * from public.c10_r2_event('r2-fail','EXPIRATION',now(),p_expiry=>now()+interval '1 day');
reset role;
select public.c10_r2_assert(exists(select 1 from revenuecat_publication.projections p
 join c10_r2_before_failure b using(user_id) where p.user_id='00000000-0000-4000-8000-000000000091'
 and p.revision>b.revision and p.canonical->>'state'='inactive'),
 'R2_ROLLBACK_RETRY_DID_NOT_PUBLISH_COMMITTED_CORRECTION');
select 'R2_AFTER_WRITE_ROLLBACK_PASS' as result;

-- Snapshot compatibility uses the existing writer and its actual provider
-- request watermark. The shared publisher guarantees revision participation.
set local role service_role;
select public.reconcile_revenuecat_entitlement_snapshot(
 '00000000-0000-4000-8000-000000000094',now(),'pro',true,
 'layerwell_pro_monthly',now()+interval '20 days','app_store','normal',true,
 now()-interval '2 days',null,'production',null,null);
reset role;
create temporary table c10_r2_snapshot as select * from revenuecat_publication.projections
 where user_id='00000000-0000-4000-8000-000000000094';
set local role service_role;
select public.reconcile_revenuecat_entitlement_snapshot(
 '00000000-0000-4000-8000-000000000094',now(),'pro',true,
 'layerwell_pro_monthly',now()+interval '20 days','app_store','normal',true,
 now()-interval '2 days',null,'production',null,null);
select * from public.c10_r2_event('r2-snapshot-old','RENEWAL',now()-interval '1 second',
 '00000000-0000-4000-8000-000000000094');
reset role;
select public.c10_r2_assert(exists(select 1 from revenuecat_publication.projections p
 join c10_r2_snapshot b using(user_id) where p.revision=b.revision and p.canonical=b.canonical
 and p.canonical->'row'->'cursor'->>'kind'='rc_snapshot'), 'R2_SNAPSHOT_DUPLICATE_OR_STALE_WEBHOOK_REGRESSED');
set local role service_role;
select * from public.c10_r2_event('r2-snapshot-new','RENEWAL',now()+interval '1 second',
 '00000000-0000-4000-8000-000000000094');
reset role;
select public.c10_r2_assert(exists(select 1 from revenuecat_publication.projections p
 join c10_r2_snapshot b using(user_id) where p.revision>b.revision
 and p.canonical->'row'->'cursor'->>'kind'='rc_webhook'), 'R2_POST_SNAPSHOT_PURCHASE_NOT_VERSIONED');
select 'R2_SHARED_SNAPSHOT_PUBLICATION_PASS' as result;

-- A privacy-only scrub leaves exact provider payload {} and the immutable
-- publication untouched. Row replacement never resets the durable sequence.
create temporary table c10_r2_before_scrub as select * from revenuecat_publication.projections;
update public.entitlements set store_user_id=null,raw_status='{}'::jsonb,updated_at=clock_timestamp()
 where user_id='00000000-0000-4000-8000-000000000094';
select public.c10_r2_assert(exists(select 1 from revenuecat_publication.projections p
 join c10_r2_before_scrub b using(user_id) where p.user_id='00000000-0000-4000-8000-000000000094'
 and p.revision=b.revision and p.canonical=b.canonical)
 and exists(select 1 from public.entitlements where user_id='00000000-0000-4000-8000-000000000094'
 and raw_status='{}'::jsonb),'R2_PRIVACY_SCRUB_CHANGED_PUBLICATION_OR_RETAINED_RAW_IDENTITIES');
create temporary table c10_r2_replacement as select * from public.entitlements
 where user_id='00000000-0000-4000-8000-000000000094';
delete from public.entitlements where user_id='00000000-0000-4000-8000-000000000094';
update c10_r2_replacement set is_active=false,will_renew=false,rc_event_id='r2-replaced',
 rc_event_at=now()+interval '2 seconds';
insert into public.entitlements select * from c10_r2_replacement;
select public.c10_r2_assert(exists(select 1 from revenuecat_publication.projections p
 join c10_r2_before_scrub b using(user_id) where p.user_id='00000000-0000-4000-8000-000000000094'
 and p.revision>b.revision and p.canonical->>'state'='inactive'),
 'R2_ROW_REPLACEMENT_RESET_OR_REUSED_REVISION');
select 'R2_PRIVACY_AND_REPLACEMENT_PASS' as result;

select set_config('request.jwt.claim.sub','00000000-0000-4000-8000-000000000094',true),
 set_config('request.jwt.claims','{"session_id":"10000000-0000-4000-8000-000000000094"}',true);
set local role authenticated;
select public.c10_r2_assert(public.read_entitlement_projections()->>'schema_version'='2'
 and public.read_entitlement_projections()->'store_projection'->'row'->'cursor'->>'kind'='server_projection'
 and public.read_entitlement_projections()->'store_projection'->'row'->'cursor'->>'stream_id'
 = '00000000-0000-4000-8000-000000000094'
 and jsonb_typeof(public.read_entitlement_projections()->'store_projection'->'row'->'cursor'->'revision')='string',
 'R2_AUTHENTICATED_DTO_OR_REVISION_WIRE_BROKEN');
reset role;
select 'R2_AUTHENTICATED_PUBLICATION_DTO_PASS' as result;
-- A pending accepted ID cannot be rebound or rewritten by a later delivery.
set local role service_role;
select * from public.c10_r2_event('r2-immutable-pending','REFUND_REVERSED',now()-interval '1 hour',
 '00000000-0000-4000-8000-000000000096');
reset role;
create temporary table c10_r2_pending_before as select * from public.subscriptions_events
 where rc_event_id='r2-immutable-pending';
set local role service_role;
select * from public.c10_r2_event('r2-immutable-pending','REFUND_REVERSED',now()-interval '1 hour',
 '00000000-0000-4000-8000-000000000097');
select * from public.c10_r2_event('r2-immutable-pending','REFUND_REVERSED',now()-interval '1 hour',
 '00000000-0000-4000-8000-000000000096',p_expiry=>now()+interval '28 days');
reset role;
select public.c10_r2_assert(not exists((select * from public.subscriptions_events where rc_event_id='r2-immutable-pending'
 except select * from c10_r2_pending_before) union all(select * from c10_r2_pending_before except
 select * from public.subscriptions_events where rc_event_id='r2-immutable-pending'))
 and not exists(select 1 from public.entitlements where user_id in(
 '00000000-0000-4000-8000-000000000096','00000000-0000-4000-8000-000000000097')),
 'R2_PENDING_ID_CHANGED_OWNER_OR_FACT');
select 'R2_PENDING_RECEIPT_IMMUTABILITY_PASS' as result;

-- Expiry passing while a reversal waits does not mint fresh paid proof. The
-- same published row stays immutable while time passes; a new refund settles
-- the now-expired pending reversal without requiring its provider retry.
do $$ declare
 v_expiry timestamptz:=clock_timestamp()+interval '300 milliseconds';
 v_before jsonb;
 v_revision bigint;
begin
 perform public.c10_r2_event('r2-expiring-p','RENEWAL',now()-interval '3 hours',
  '00000000-0000-4000-8000-000000000098',p_expiry=>v_expiry);
 perform public.c10_r2_event('r2-expiring-r','REFUND_REVERSED',now()-interval '1 hour',
  '00000000-0000-4000-8000-000000000098',p_expiry=>v_expiry);
 select canonical,revision into v_before,v_revision from revenuecat_publication.projections
  where user_id='00000000-0000-4000-8000-000000000098';
 perform pg_sleep(0.4);
 perform public.c10_r2_assert(exists(select 1 from revenuecat_publication.projections
  where user_id='00000000-0000-4000-8000-000000000098' and canonical=v_before and revision=v_revision),
  'R2_EXPIRY_REWROTE_ALREADY_PUBLISHED_REVISION');
 perform public.c10_r2_event('r2-expiring-f','CANCELLATION',now()-interval '2 hours',
  '00000000-0000-4000-8000-000000000098',p_expiry=>v_expiry,p_reason=>'CUSTOMER_SUPPORT');
 perform public.c10_r2_assert(exists(select 1 from public.entitlements
  where user_id='00000000-0000-4000-8000-000000000098' and not is_active)
  and exists(select 1 from public.subscriptions_events where rc_event_id='r2-expiring-r'
   and processing_status='stale' and error is null),'R2_EXPIRED_RETRY_RESTORED_PAID_ACCESS');
end $$;
select 'R2_FINITE_EXPIRY_DURING_DEPENDENCY_PASS' as result;

-- Retrying a previously accepted pending fact must not erase that fact if
-- the retry transaction fails before its final outcome is committed.
create function public.c10_r2_pending_retry_failure() returns trigger language plpgsql as $$ begin
 if new.rc_event_id='r2-retained-r' and new.processing_status='processing'
 and ((tg_op='UPDATE' and current_setting('c10.r2_pending_retry_fail',true)='on')
   or (tg_op='INSERT' and current_setting('c10.r2_pending_retry_fail',true)='claim')) then
  raise exception using errcode='23514',message='R2_TEST_PENDING_RETRY_FAILED';
 end if;
 return new; end $$;
create trigger c10_r2_pending_retry_failure before insert or update on public.subscriptions_events
 for each row execute function public.c10_r2_pending_retry_failure();
set local role service_role;
select * from public.c10_r2_event('r2-retained-r','REFUND_REVERSED',now()-interval '1 hour',
 '00000000-0000-4000-8000-000000000099');
reset role;
create temporary table c10_r2_accepted_pending as select payload from public.subscriptions_events
 where rc_event_id='r2-retained-r';
set local c10.r2_pending_retry_fail='on';
set local role service_role;
select * from public.c10_r2_event('r2-retained-r','REFUND_REVERSED',now()-interval '1 hour',
 '00000000-0000-4000-8000-000000000099');
reset role;
set local c10.r2_pending_retry_fail='off';
select public.c10_r2_assert(exists(select 1 from public.subscriptions_events e
 join c10_r2_accepted_pending p on p.payload=e.payload where e.rc_event_id='r2-retained-r'
 and e.processing_status='error' and e.error='REVENUECAT_LIFECYCLE_DEPENDENCY_PENDING'
 and e.processing_attempts=2),'R2_FAILED_PENDING_RETRY_ERASED_ACCEPTED_FACT');
set local c10.r2_pending_retry_fail='claim';
set local role service_role;
select * from public.c10_r2_event('r2-retained-r','REFUND_REVERSED',now()-interval '1 hour',
 '00000000-0000-4000-8000-000000000099');
reset role;
set local c10.r2_pending_retry_fail='off';
select public.c10_r2_assert(exists(select 1 from public.subscriptions_events e
 join c10_r2_accepted_pending p on p.payload=e.payload where e.rc_event_id='r2-retained-r'
 and e.processing_status='error' and e.error='REVENUECAT_LIFECYCLE_DEPENDENCY_PENDING'
 and e.processing_attempts=3),'R2_FAILED_DUPLICATE_CLAIM_ERASED_ACCEPTED_FACT');
set local role service_role;
select * from public.c10_r2_event('r2-retained-p','RENEWAL',now()-interval '4 hours',
 '00000000-0000-4000-8000-000000000099');
select * from public.c10_r2_event('r2-retained-f','CANCELLATION',now()-interval '3 hours',
 '00000000-0000-4000-8000-000000000099',p_reason=>'CUSTOMER_SUPPORT');
reset role;
select public.c10_r2_assert(exists(select 1 from public.entitlements
 where user_id='00000000-0000-4000-8000-000000000099' and is_active)
 and exists(select 1 from public.subscriptions_events where rc_event_id='r2-retained-r'
 and processing_status='stale' and error is null),'R2_FAILED_RETRY_OBLIGATION_NOT_AUTOMATICALLY_RESOLVED');
select 'R2_ACCEPTED_FACT_SURVIVES_RETRY_ROLLBACK_PASS' as result;

-- Deliberately exhaust only this disposable database's private sequence after
-- every ordinary case. Canonical decimal JSON stays lossless above JS safe int;
-- the next attempted write rolls back instead of cycling or reusing a version.
select setval('revenuecat_publication.revision_sequence',9223372036854775806,true);
set local role service_role;
select * from public.c10_r2_event('r2-max-p','RENEWAL',now()-interval '2 hours',
 '00000000-0000-4000-8000-000000000095');
select * from public.c10_r2_event('r2-overflow-f','CANCELLATION',now()-interval '1 hour',
 '00000000-0000-4000-8000-000000000095',p_reason=>'CUSTOMER_SUPPORT');
reset role;
select public.c10_r2_assert(exists(select 1 from revenuecat_publication.projections
 where user_id='00000000-0000-4000-8000-000000000095' and revision=9223372036854775807
 and canonical->>'state'='active')
 and exists(select 1 from public.subscriptions_events where rc_event_id='r2-overflow-f'
 and processing_status='error' and error='REVENUECAT_ATOMIC_PROCESSING_FAILED:2200H'
 and not(payload?'_onskin_fact_v1')),
 'R2_REVISION_OVERFLOW_REUSED_OR_ACKNOWLEDGED_UNCOMMITTED_STATE');
select set_config('request.jwt.claim.sub','00000000-0000-4000-8000-000000000095',true),
 set_config('request.jwt.claims','{"session_id":"10000000-0000-4000-8000-000000000095"}',true);
set local role authenticated;
select public.c10_r2_assert(public.read_entitlement_projections()->'store_projection'->'row'->'cursor'->>'revision'
 = '9223372036854775807','R2_BIGINT_REVISION_LOST_PRECISION');
reset role;
select 'R2_REVISION_OVERFLOW_AND_LOSSLESS_WIRE_PASS' as result;
commit;
select 'C10_WEBHOOK_PUBLICATION_SEQUENTIAL_REHEARSAL_PASS' as result;
