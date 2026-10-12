-- DB06-ACL-R2A native regressions. Synthetic local fixtures; everything rolls back.
-- Expected ACL values bind the independently reproduced main@1b0fe747 baseline.
begin;
create extension if not exists pgtap with schema extensions;
set local search_path = extensions, public, pg_catalog;
select plan(730);
select is((select count(*) from pg_class c join pg_namespace n on n.oid=c.relnamespace where n.nspname='public' and c.relkind in ('r','p')),91::bigint,'exact reviewed 91-table inventory');

select ok(not has_table_privilege(r,'public.'||t,p),format('%s: %s denied on %s',r,p,t)) from unnest(array['account_deletion_click_tombstones','account_deletion_requests','active_ramp','ask_safety_audit','ask_sessions','ask_turn_audit','community_blocks','community_moderation_events','community_notes','community_questions','community_reactions','community_reports','community_topics','consents','cycle_nights','cycles','entitlements','growth_events','notification_log','notification_preferences','photo_trend','photos','reverse_trial_grants','routine_conflicts','skin_profiles','subscriptions_events','waitlist_signups']) t cross join unnest(array['anon','authenticated']) r cross join unnest(array['TRUNCATE','REFERENCES','TRIGGER']) p order by t,r,p;

select is((select jsonb_agg(to_jsonb(t) order by table_name,role,privilege) from (
select c.relname table_name,r.rolname role,p.privilege,has_table_privilege(r.oid,c.oid,p.privilege) allowed
from pg_class c join pg_namespace n on n.oid=c.relnamespace cross join pg_roles r
cross join (values ('SELECT'),('INSERT'),('UPDATE'),('DELETE'),('TRUNCATE'),('REFERENCES'),('TRIGGER'))p(privilege)
where n.nspname='public' and c.relkind in ('r','p') and r.rolname in ('anon','authenticated','service_role'))t),'[{"role":"anon","allowed":false,"privilege":"DELETE","table_name":"account_deletion_barriers"},{"role":"anon","allowed":false,"privilege":"INSERT","table_name":"account_deletion_barriers"},{"role":"anon","allowed":false,"privilege":"REFERENCES","table_name":"account_deletion_barriers"},{"role":"anon","allowed":false,"privilege":"SELECT","table_name":"account_deletion_barriers"},{"role":"anon","allowed":false,"privilege":"TRIGGER","table_name":"account_deletion_barriers"},{"role":"anon","allowed":false,"privilege":"TRUNCATE","table_name":"account_deletion_barriers"},{"role":"anon","allowed":false,"privilege":"UPDATE","table_name":"account_deletion_barriers"},{"role":"authenticated","allowed":false,"privilege":"DELETE","table_name":"account_deletion_barriers"},{"role":"authenticated","allowed":false,"privilege":"INSERT","table_name":"account_deletion_barriers"},{"role":"authenticated","allowed":false,"privilege":"REFERENCES","table_name":"account_deletion_barriers"},{"role":"authenticated","allowed":false,"privilege":"SELECT","table_name":"account_deletion_barriers"},{"role":"authenticated","allowed":false,"privilege":"TRIGGER","table_name":"account_deletion_barriers"},{"role":"authenticated","allowed":false,"privilege":"TRUNCATE","table_name":"account_deletion_barriers"},{"role":"authenticated","allowed":false,"privilege":"UPDATE","table_name":"account_deletion_barriers"},{"role":"service_role","allowed":false,"privilege":"DELETE","table_name":"account_deletion_barriers"},{"role":"service_role","allowed":false,"privilege":"INSERT","table_name":"account_deletion_barriers"},{"role":"service_role","allowed":false,"privilege":"REFERENCES","table_name":"account_deletion_barriers"},{"role":"service_role","allowed":false,"privilege":"SELECT","table_name":"account_deletion_barriers"},{"role":"service_role","allowed":false,"privilege":"TRIGGER","table_name":"account_deletion_barriers"},{"role":"service_role","allowed":false,"privilege":"TRUNCATE","table_name":"account_deletion_barriers"},{"role":"service_role","allowed":false,"privilege":"UPDATE","table_name":"account_deletion_barriers"},{"role":"anon","allowed":true,"privilege":"DELETE","table_name":"account_deletion_click_tombstones"},{"role":"anon","allowed":true,"privilege":"INSERT","table_name":"account_deletion_click_tombstones"},{"role":"anon","allowed":false,"privilege":"REFERENCES","table_name":"account_deletion_click_tombstones"},{"role":"anon","allowed":true,"privilege":"SELECT","table_name":"account_deletion_click_tombstones"},{"role":"anon","allowed":false,"privilege":"TRIGGER","table_name":"account_deletion_click_tombstones"},{"role":"anon","allowed":false,"privilege":"TRUNCATE","table_name":"account_deletion_click_tombstones"},{"role":"anon","allowed":true,"privilege":"UPDATE","table_name":"account_deletion_click_tombstones"},{"role":"authenticated","allowed":true,"privilege":"DELETE","table_name":"account_deletion_click_tombstones"},{"role":"authenticated","allowed":true,"privilege":"INSERT","table_name":"account_deletion_click_tombstones"},{"role":"authenticated","allowed":false,"privilege":"REFERENCES","table_name":"account_deletion_click_tombstones"},{"role":"authenticated","allowed":true,"privilege":"SELECT","table_name":"account_deletion_click_tombstones"},{"role":"authenticated","allowed":false,"privilege":"TRIGGER","table_name":"account_deletion_click_tombstones"},{"role":"authenticated","allowed":false,"privilege":"TRUNCATE","table_name":"account_deletion_click_tombstones"},{"role":"authenticated","allowed":true,"privilege":"UPDATE","table_name":"account_deletion_click_tombstones"},{"role":"service_role","allowed":true,"privilege":"DELETE","table_name":"account_deletion_click_tombstones"},{"role":"service_role","allowed":true,"privilege":"INSERT","table_name":"account_deletion_click_tombstones"},{"role":"service_role","allowed":true,"privilege":"REFERENCES","table_name":"account_deletion_click_tombstones"},{"role":"service_role","allowed":true,"privilege":"SELECT","table_name":"account_deletion_click_tombstones"},{"role":"service_role","allowed":true,"privilege":"TRIGGER","table_name":"account_deletion_click_tombstones"},{"role":"service_role","allowed":true,"privilege":"TRUNCATE","table_name":"account_deletion_click_tombstones"},{"role":"service_role","allowed":true,"privilege":"UPDATE","table_name":"account_deletion_click_tombstones"},{"role":"anon","allowed":false,"privilege":"DELETE","table_name":"account_deletion_operations"},{"role":"anon","allowed":false,"privilege":"INSERT","table_name":"account_deletion_operations"},{"role":"anon","allowed":false,"privilege":"REFERENCES","table_name":"account_deletion_operations"},{"role":"anon","allowed":false,"privilege":"SELECT","table_name":"account_deletion_operations"},{"role":"anon","allowed":false,"privilege":"TRIGGER","table_name":"account_deletion_operations"},{"role":"anon","allowed":false,"privilege":"TRUNCATE","table_name":"account_deletion_operations"},{"role":"anon","allowed":false,"privilege":"UPDATE","table_name":"account_deletion_operations"},{"role":"authenticated","allowed":false,"privilege":"DELETE","table_name":"account_deletion_operations"},{"role":"authenticated","allowed":false,"privilege":"INSERT","table_name":"account_deletion_operations"},{"role":"authenticated","allowed":false,"privilege":"REFERENCES","table_name":"account_deletion_operations"},{"role":"authenticated","allowed":false,"privilege":"SELECT","table_name":"account_deletion_operations"},{"role":"authenticated","allowed":false,"privilege":"TRIGGER","table_name":"account_deletion_operations"},{"role":"authenticated","allowed":false,"privilege":"TRUNCATE","table_name":"account_deletion_operations"},{"role":"authenticated","allowed":false,"privilege":"UPDATE","table_name":"account_deletion_operations"},{"role":"service_role","allowed":false,"privilege":"DELETE","table_name":"account_deletion_operations"},{"role":"service_role","allowed":false,"privilege":"INSERT","table_name":"account_deletion_operations"},{"role":"service_role","allowed":false,"privilege":"REFERENCES","table_name":"account_deletion_operations"},{"role":"service_role","allowed":false,"privilege":"SELECT","table_name":"account_deletion_operations"},{"role":"service_role","allowed":false,"privilege":"TRIGGER","table_name":"account_deletion_operations"},{"role":"service_role","allowed":false,"privilege":"TRUNCATE","table_name":"account_deletion_operations"},{"role":"service_role","allowed":false,"privilege":"UPDATE","table_name":"account_deletion_operations"},{"role":"anon","allowed":false,"privilege":"DELETE","table_name":"account_deletion_operator_recovery_audit"},{"role":"anon","allowed":false,"privilege":"INSERT","table_name":"account_deletion_operator_recovery_audit"},{"role":"anon","allowed":false,"privilege":"REFERENCES","table_name":"account_deletion_operator_recovery_audit"},{"role":"anon","allowed":false,"privilege":"SELECT","table_name":"account_deletion_operator_recovery_audit"},{"role":"anon","allowed":false,"privilege":"TRIGGER","table_name":"account_deletion_operator_recovery_audit"},{"role":"anon","allowed":false,"privilege":"TRUNCATE","table_name":"account_deletion_operator_recovery_audit"},{"role":"anon","allowed":false,"privilege":"UPDATE","table_name":"account_deletion_operator_recovery_audit"},{"role":"authenticated","allowed":false,"privilege":"DELETE","table_name":"account_deletion_operator_recovery_audit"},{"role":"authenticated","allowed":false,"privilege":"INSERT","table_name":"account_deletion_operator_recovery_audit"},{"role":"authenticated","allowed":false,"privilege":"REFERENCES","table_name":"account_deletion_operator_recovery_audit"},{"role":"authenticated","allowed":false,"privilege":"SELECT","table_name":"account_deletion_operator_recovery_audit"},{"role":"authenticated","allowed":false,"privilege":"TRIGGER","table_name":"account_deletion_operator_recovery_audit"},{"role":"authenticated","allowed":false,"privilege":"TRUNCATE","table_name":"account_deletion_operator_recovery_audit"},{"role":"authenticated","allowed":false,"privilege":"UPDATE","table_name":"account_deletion_operator_recovery_audit"},{"role":"service_role","allowed":false,"privilege":"DELETE","table_name":"account_deletion_operator_recovery_audit"},{"role":"service_role","allowed":false,"privilege":"INSERT","table_name":"account_deletion_operator_recovery_audit"},{"role":"service_role","allowed":false,"privilege":"REFERENCES","table_name":"account_deletion_operator_recovery_audit"},{"role":"service_role","allowed":false,"privilege":"SELECT","table_name":"account_deletion_operator_recovery_audit"},{"role":"service_role","allowed":false,"privilege":"TRIGGER","table_name":"account_deletion_operator_recovery_audit"},{"role":"service_role","allowed":false,"privilege":"TRUNCATE","table_name":"account_deletion_operator_recovery_audit"},{"role":"service_role","allowed":false,"privilege":"UPDATE","table_name":"account_deletion_operator_recovery_audit"},{"role":"anon","allowed":false,"privilege":"DELETE","table_name":"account_deletion_receipts"},{"role":"anon","allowed":false,"privilege":"INSERT","table_name":"account_deletion_receipts"},{"role":"anon","allowed":false,"privilege":"REFERENCES","table_name":"account_deletion_receipts"},{"role":"anon","allowed":false,"privilege":"SELECT","table_name":"account_deletion_receipts"},{"role":"anon","allowed":false,"privilege":"TRIGGER","table_name":"account_deletion_receipts"},{"role":"anon","allowed":false,"privilege":"TRUNCATE","table_name":"account_deletion_receipts"},{"role":"anon","allowed":false,"privilege":"UPDATE","table_name":"account_deletion_receipts"},{"role":"authenticated","allowed":false,"privilege":"DELETE","table_name":"account_deletion_receipts"},{"role":"authenticated","allowed":false,"privilege":"INSERT","table_name":"account_deletion_receipts"},{"role":"authenticated","allowed":false,"privilege":"REFERENCES","table_name":"account_deletion_receipts"},{"role":"authenticated","allowed":false,"privilege":"SELECT","table_name":"account_deletion_receipts"},{"role":"authenticated","allowed":false,"privilege":"TRIGGER","table_name":"account_deletion_receipts"},{"role":"authenticated","allowed":false,"privilege":"TRUNCATE","table_name":"account_deletion_receipts"},{"role":"authenticated","allowed":false,"privilege":"UPDATE","table_name":"account_deletion_receipts"},{"role":"service_role","allowed":false,"privilege":"DELETE","table_name":"account_deletion_receipts"},{"role":"service_role","allowed":false,"privilege":"INSERT","table_name":"account_deletion_receipts"},{"role":"service_role","allowed":false,"privilege":"REFERENCES","table_name":"account_deletion_receipts"},{"role":"service_role","allowed":false,"privilege":"SELECT","table_name":"account_deletion_receipts"},{"role":"service_role","allowed":false,"privilege":"TRIGGER","table_name":"account_deletion_receipts"},{"role":"service_role","allowed":false,"privilege":"TRUNCATE","table_name":"account_deletion_receipts"},{"role":"service_role","allowed":false,"privilege":"UPDATE","table_name":"account_deletion_receipts"},{"role":"anon","allowed":true,"privilege":"DELETE","table_name":"account_deletion_requests"},{"role":"anon","allowed":true,"privilege":"INSERT","table_name":"account_deletion_requests"},{"role":"anon","allowed":false,"privilege":"REFERENCES","table_name":"account_deletion_requests"},{"role":"anon","allowed":true,"privilege":"SELECT","table_name":"account_deletion_requests"},{"role":"anon","allowed":false,"privilege":"TRIGGER","table_name":"account_deletion_requests"},{"role":"anon","allowed":false,"privilege":"TRUNCATE","table_name":"account_deletion_requests"},{"role":"anon","allowed":true,"privilege":"UPDATE","table_name":"account_deletion_requests"},{"role":"authenticated","allowed":true,"privilege":"DELETE","table_name":"account_deletion_requests"},{"role":"authenticated","allowed":true,"privilege":"INSERT","table_name":"account_deletion_requests"},{"role":"authenticated","allowed":false,"privilege":"REFERENCES","table_name":"account_deletion_requests"},{"role":"authenticated","allowed":true,"privilege":"SELECT","table_name":"account_deletion_requests"},{"role":"authenticated","allowed":false,"privilege":"TRIGGER","table_name":"account_deletion_requests"},{"role":"authenticated","allowed":false,"privilege":"TRUNCATE","table_name":"account_deletion_requests"},{"role":"authenticated","allowed":true,"privilege":"UPDATE","table_name":"account_deletion_requests"},{"role":"service_role","allowed":true,"privilege":"DELETE","table_name":"account_deletion_requests"},{"role":"service_role","allowed":true,"privilege":"INSERT","table_name":"account_deletion_requests"},{"role":"service_role","allowed":true,"privilege":"REFERENCES","table_name":"account_deletion_requests"},{"role":"service_role","allowed":true,"privilege":"SELECT","table_name":"account_deletion_requests"},{"role":"service_role","allowed":true,"privilege":"TRIGGER","table_name":"account_deletion_requests"},{"role":"service_role","allowed":true,"privilege":"TRUNCATE","table_name":"account_deletion_requests"},{"role":"service_role","allowed":true,"privilege":"UPDATE","table_name":"account_deletion_requests"},{"role":"anon","allowed":false,"privilege":"DELETE","table_name":"account_deletion_steps"},{"role":"anon","allowed":false,"privilege":"INSERT","table_name":"account_deletion_steps"},{"role":"anon","allowed":false,"privilege":"REFERENCES","table_name":"account_deletion_steps"},{"role":"anon","allowed":false,"privilege":"SELECT","table_name":"account_deletion_steps"},{"role":"anon","allowed":false,"privilege":"TRIGGER","table_name":"account_deletion_steps"},{"role":"anon","allowed":false,"privilege":"TRUNCATE","table_name":"account_deletion_steps"},{"role":"anon","allowed":false,"privilege":"UPDATE","table_name":"account_deletion_steps"},{"role":"authenticated","allowed":false,"privilege":"DELETE","table_name":"account_deletion_steps"},{"role":"authenticated","allowed":false,"privilege":"INSERT","table_name":"account_deletion_steps"},{"role":"authenticated","allowed":false,"privilege":"REFERENCES","table_name":"account_deletion_steps"},{"role":"authenticated","allowed":false,"privilege":"SELECT","table_name":"account_deletion_steps"},{"role":"authenticated","allowed":false,"privilege":"TRIGGER","table_name":"account_deletion_steps"},{"role":"authenticated","allowed":false,"privilege":"TRUNCATE","table_name":"account_deletion_steps"},{"role":"authenticated","allowed":false,"privilege":"UPDATE","table_name":"account_deletion_steps"},{"role":"service_role","allowed":false,"privilege":"DELETE","table_name":"account_deletion_steps"},{"role":"service_role","allowed":false,"privilege":"INSERT","table_name":"account_deletion_steps"},{"role":"service_role","allowed":false,"privilege":"REFERENCES","table_name":"account_deletion_steps"},{"role":"service_role","allowed":false,"privilege":"SELECT","table_name":"account_deletion_steps"},{"role":"service_role","allowed":false,"privilege":"TRIGGER","table_name":"account_deletion_steps"},{"role":"service_role","allowed":false,"privilege":"TRUNCATE","table_name":"account_deletion_steps"},{"role":"service_role","allowed":false,"privilege":"UPDATE","table_name":"account_deletion_steps"},{"role":"anon","allowed":false,"privilege":"DELETE","table_name":"account_publication_leases"},{"role":"anon","allowed":false,"privilege":"INSERT","table_name":"account_publication_leases"},{"role":"anon","allowed":false,"privilege":"REFERENCES","table_name":"account_publication_leases"},{"role":"anon","allowed":false,"privilege":"SELECT","table_name":"account_publication_leases"},{"role":"anon","allowed":false,"privilege":"TRIGGER","table_name":"account_publication_leases"},{"role":"anon","allowed":false,"privilege":"TRUNCATE","table_name":"account_publication_leases"},{"role":"anon","allowed":false,"privilege":"UPDATE","table_name":"account_publication_leases"},{"role":"authenticated","allowed":false,"privilege":"DELETE","table_name":"account_publication_leases"},{"role":"authenticated","allowed":false,"privilege":"INSERT","table_name":"account_publication_leases"},{"role":"authenticated","allowed":false,"privilege":"REFERENCES","table_name":"account_publication_leases"},{"role":"authenticated","allowed":false,"privilege":"SELECT","table_name":"account_publication_leases"},{"role":"authenticated","allowed":false,"privilege":"TRIGGER","table_name":"account_publication_leases"},{"role":"authenticated","allowed":false,"privilege":"TRUNCATE","table_name":"account_publication_leases"},{"role":"authenticated","allowed":false,"privilege":"UPDATE","table_name":"account_publication_leases"},{"role":"service_role","allowed":false,"privilege":"DELETE","table_name":"account_publication_leases"},{"role":"service_role","allowed":false,"privilege":"INSERT","table_name":"account_publication_leases"},{"role":"service_role","allowed":false,"privilege":"REFERENCES","table_name":"account_publication_leases"},{"role":"service_role","allowed":false,"privilege":"SELECT","table_name":"account_publication_leases"},{"role":"service_role","allowed":false,"privilege":"TRIGGER","table_name":"account_publication_leases"},{"role":"service_role","allowed":false,"privilege":"TRUNCATE","table_name":"account_publication_leases"},{"role":"service_role","allowed":false,"privilege":"UPDATE","table_name":"account_publication_leases"},{"role":"anon","allowed":true,"privilege":"DELETE","table_name":"active_ramp"},{"role":"anon","allowed":true,"privilege":"INSERT","table_name":"active_ramp"},{"role":"anon","allowed":false,"privilege":"REFERENCES","table_name":"active_ramp"},{"role":"anon","allowed":true,"privilege":"SELECT","table_name":"active_ramp"},{"role":"anon","allowed":false,"privilege":"TRIGGER","table_name":"active_ramp"},{"role":"anon","allowed":false,"privilege":"TRUNCATE","table_name":"active_ramp"},{"role":"anon","allowed":true,"privilege":"UPDATE","table_name":"active_ramp"},{"role":"authenticated","allowed":true,"privilege":"DELETE","table_name":"active_ramp"},{"role":"authenticated","allowed":true,"privilege":"INSERT","table_name":"active_ramp"},{"role":"authenticated","allowed":false,"privilege":"REFERENCES","table_name":"active_ramp"},{"role":"authenticated","allowed":true,"privilege":"SELECT","table_name":"active_ramp"},{"role":"authenticated","allowed":false,"privilege":"TRIGGER","table_name":"active_ramp"},{"role":"authenticated","allowed":false,"privilege":"TRUNCATE","table_name":"active_ramp"},{"role":"authenticated","allowed":true,"privilege":"UPDATE","table_name":"active_ramp"},{"role":"service_role","allowed":true,"privilege":"DELETE","table_name":"active_ramp"},{"role":"service_role","allowed":true,"privilege":"INSERT","table_name":"active_ramp"},{"role":"service_role","allowed":true,"privilege":"REFERENCES","table_name":"active_ramp"},{"role":"service_role","allowed":true,"privilege":"SELECT","table_name":"active_ramp"},{"role":"service_role","allowed":true,"privilege":"TRIGGER","table_name":"active_ramp"},{"role":"service_role","allowed":true,"privilege":"TRUNCATE","table_name":"active_ramp"},{"role":"service_role","allowed":true,"privilege":"UPDATE","table_name":"active_ramp"},{"role":"anon","allowed":false,"privilege":"DELETE","table_name":"affiliate_links"},{"role":"anon","allowed":false,"privilege":"INSERT","table_name":"affiliate_links"},{"role":"anon","allowed":false,"privilege":"REFERENCES","table_name":"affiliate_links"},{"role":"anon","allowed":false,"privilege":"SELECT","table_name":"affiliate_links"},{"role":"anon","allowed":false,"privilege":"TRIGGER","table_name":"affiliate_links"},{"role":"anon","allowed":false,"privilege":"TRUNCATE","table_name":"affiliate_links"},{"role":"anon","allowed":false,"privilege":"UPDATE","table_name":"affiliate_links"},{"role":"authenticated","allowed":false,"privilege":"DELETE","table_name":"affiliate_links"},{"role":"authenticated","allowed":false,"privilege":"INSERT","table_name":"affiliate_links"},{"role":"authenticated","allowed":false,"privilege":"REFERENCES","table_name":"affiliate_links"},{"role":"authenticated","allowed":false,"privilege":"SELECT","table_name":"affiliate_links"},{"role":"authenticated","allowed":false,"privilege":"TRIGGER","table_name":"affiliate_links"},{"role":"authenticated","allowed":false,"privilege":"TRUNCATE","table_name":"affiliate_links"},{"role":"authenticated","allowed":false,"privilege":"UPDATE","table_name":"affiliate_links"},{"role":"service_role","allowed":false,"privilege":"DELETE","table_name":"affiliate_links"},{"role":"service_role","allowed":false,"privilege":"INSERT","table_name":"affiliate_links"},{"role":"service_role","allowed":false,"privilege":"REFERENCES","table_name":"affiliate_links"},{"role":"service_role","allowed":false,"privilege":"SELECT","table_name":"affiliate_links"},{"role":"service_role","allowed":false,"privilege":"TRIGGER","table_name":"affiliate_links"},{"role":"service_role","allowed":false,"privilege":"TRUNCATE","table_name":"affiliate_links"},{"role":"service_role","allowed":false,"privilege":"UPDATE","table_name":"affiliate_links"},{"role":"anon","allowed":false,"privilege":"DELETE","table_name":"apple_auth_capture_operations"},{"role":"anon","allowed":false,"privilege":"INSERT","table_name":"apple_auth_capture_operations"},{"role":"anon","allowed":false,"privilege":"REFERENCES","table_name":"apple_auth_capture_operations"},{"role":"anon","allowed":false,"privilege":"SELECT","table_name":"apple_auth_capture_operations"},{"role":"anon","allowed":false,"privilege":"TRIGGER","table_name":"apple_auth_capture_operations"},{"role":"anon","allowed":false,"privilege":"TRUNCATE","table_name":"apple_auth_capture_operations"},{"role":"anon","allowed":false,"privilege":"UPDATE","table_name":"apple_auth_capture_operations"},{"role":"authenticated","allowed":false,"privilege":"DELETE","table_name":"apple_auth_capture_operations"},{"role":"authenticated","allowed":false,"privilege":"INSERT","table_name":"apple_auth_capture_operations"},{"role":"authenticated","allowed":false,"privilege":"REFERENCES","table_name":"apple_auth_capture_operations"},{"role":"authenticated","allowed":false,"privilege":"SELECT","table_name":"apple_auth_capture_operations"},{"role":"authenticated","allowed":false,"privilege":"TRIGGER","table_name":"apple_auth_capture_operations"},{"role":"authenticated","allowed":false,"privilege":"TRUNCATE","table_name":"apple_auth_capture_operations"},{"role":"authenticated","allowed":false,"privilege":"UPDATE","table_name":"apple_auth_capture_operations"},{"role":"service_role","allowed":false,"privilege":"DELETE","table_name":"apple_auth_capture_operations"},{"role":"service_role","allowed":false,"privilege":"INSERT","table_name":"apple_auth_capture_operations"},{"role":"service_role","allowed":false,"privilege":"REFERENCES","table_name":"apple_auth_capture_operations"},{"role":"service_role","allowed":false,"privilege":"SELECT","table_name":"apple_auth_capture_operations"},{"role":"service_role","allowed":false,"privilege":"TRIGGER","table_name":"apple_auth_capture_operations"},{"role":"service_role","allowed":false,"privilege":"TRUNCATE","table_name":"apple_auth_capture_operations"},{"role":"service_role","allowed":false,"privilege":"UPDATE","table_name":"apple_auth_capture_operations"},{"role":"anon","allowed":false,"privilege":"DELETE","table_name":"apple_auth_lifecycles"},{"role":"anon","allowed":false,"privilege":"INSERT","table_name":"apple_auth_lifecycles"},{"role":"anon","allowed":false,"privilege":"REFERENCES","table_name":"apple_auth_lifecycles"},{"role":"anon","allowed":false,"privilege":"SELECT","table_name":"apple_auth_lifecycles"},{"role":"anon","allowed":false,"privilege":"TRIGGER","table_name":"apple_auth_lifecycles"},{"role":"anon","allowed":false,"privilege":"TRUNCATE","table_name":"apple_auth_lifecycles"},{"role":"anon","allowed":false,"privilege":"UPDATE","table_name":"apple_auth_lifecycles"},{"role":"authenticated","allowed":false,"privilege":"DELETE","table_name":"apple_auth_lifecycles"},{"role":"authenticated","allowed":false,"privilege":"INSERT","table_name":"apple_auth_lifecycles"},{"role":"authenticated","allowed":false,"privilege":"REFERENCES","table_name":"apple_auth_lifecycles"},{"role":"authenticated","allowed":false,"privilege":"SELECT","table_name":"apple_auth_lifecycles"},{"role":"authenticated","allowed":false,"privilege":"TRIGGER","table_name":"apple_auth_lifecycles"},{"role":"authenticated","allowed":false,"privilege":"TRUNCATE","table_name":"apple_auth_lifecycles"},{"role":"authenticated","allowed":false,"privilege":"UPDATE","table_name":"apple_auth_lifecycles"},{"role":"service_role","allowed":false,"privilege":"DELETE","table_name":"apple_auth_lifecycles"},{"role":"service_role","allowed":false,"privilege":"INSERT","table_name":"apple_auth_lifecycles"},{"role":"service_role","allowed":false,"privilege":"REFERENCES","table_name":"apple_auth_lifecycles"},{"role":"service_role","allowed":false,"privilege":"SELECT","table_name":"apple_auth_lifecycles"},{"role":"service_role","allowed":false,"privilege":"TRIGGER","table_name":"apple_auth_lifecycles"},{"role":"service_role","allowed":false,"privilege":"TRUNCATE","table_name":"apple_auth_lifecycles"},{"role":"service_role","allowed":false,"privilege":"UPDATE","table_name":"apple_auth_lifecycles"},{"role":"anon","allowed":false,"privilege":"DELETE","table_name":"apple_auth_server_events"},{"role":"anon","allowed":false,"privilege":"INSERT","table_name":"apple_auth_server_events"},{"role":"anon","allowed":false,"privilege":"REFERENCES","table_name":"apple_auth_server_events"},{"role":"anon","allowed":false,"privilege":"SELECT","table_name":"apple_auth_server_events"},{"role":"anon","allowed":false,"privilege":"TRIGGER","table_name":"apple_auth_server_events"},{"role":"anon","allowed":false,"privilege":"TRUNCATE","table_name":"apple_auth_server_events"},{"role":"anon","allowed":false,"privilege":"UPDATE","table_name":"apple_auth_server_events"},{"role":"authenticated","allowed":false,"privilege":"DELETE","table_name":"apple_auth_server_events"},{"role":"authenticated","allowed":false,"privilege":"INSERT","table_name":"apple_auth_server_events"},{"role":"authenticated","allowed":false,"privilege":"REFERENCES","table_name":"apple_auth_server_events"},{"role":"authenticated","allowed":false,"privilege":"SELECT","table_name":"apple_auth_server_events"},{"role":"authenticated","allowed":false,"privilege":"TRIGGER","table_name":"apple_auth_server_events"},{"role":"authenticated","allowed":false,"privilege":"TRUNCATE","table_name":"apple_auth_server_events"},{"role":"authenticated","allowed":false,"privilege":"UPDATE","table_name":"apple_auth_server_events"},{"role":"service_role","allowed":false,"privilege":"DELETE","table_name":"apple_auth_server_events"},{"role":"service_role","allowed":false,"privilege":"INSERT","table_name":"apple_auth_server_events"},{"role":"service_role","allowed":false,"privilege":"REFERENCES","table_name":"apple_auth_server_events"},{"role":"service_role","allowed":false,"privilege":"SELECT","table_name":"apple_auth_server_events"},{"role":"service_role","allowed":false,"privilege":"TRIGGER","table_name":"apple_auth_server_events"},{"role":"service_role","allowed":false,"privilege":"TRUNCATE","table_name":"apple_auth_server_events"},{"role":"service_role","allowed":false,"privilege":"UPDATE","table_name":"apple_auth_server_events"},{"role":"anon","allowed":true,"privilege":"DELETE","table_name":"ask_safety_audit"},{"role":"anon","allowed":true,"privilege":"INSERT","table_name":"ask_safety_audit"},{"role":"anon","allowed":false,"privilege":"REFERENCES","table_name":"ask_safety_audit"},{"role":"anon","allowed":true,"privilege":"SELECT","table_name":"ask_safety_audit"},{"role":"anon","allowed":false,"privilege":"TRIGGER","table_name":"ask_safety_audit"},{"role":"anon","allowed":false,"privilege":"TRUNCATE","table_name":"ask_safety_audit"},{"role":"anon","allowed":true,"privilege":"UPDATE","table_name":"ask_safety_audit"},{"role":"authenticated","allowed":true,"privilege":"DELETE","table_name":"ask_safety_audit"},{"role":"authenticated","allowed":true,"privilege":"INSERT","table_name":"ask_safety_audit"},{"role":"authenticated","allowed":false,"privilege":"REFERENCES","table_name":"ask_safety_audit"},{"role":"authenticated","allowed":true,"privilege":"SELECT","table_name":"ask_safety_audit"},{"role":"authenticated","allowed":false,"privilege":"TRIGGER","table_name":"ask_safety_audit"},{"role":"authenticated","allowed":false,"privilege":"TRUNCATE","table_name":"ask_safety_audit"},{"role":"authenticated","allowed":true,"privilege":"UPDATE","table_name":"ask_safety_audit"},{"role":"service_role","allowed":true,"privilege":"DELETE","table_name":"ask_safety_audit"},{"role":"service_role","allowed":true,"privilege":"INSERT","table_name":"ask_safety_audit"},{"role":"service_role","allowed":true,"privilege":"REFERENCES","table_name":"ask_safety_audit"},{"role":"service_role","allowed":true,"privilege":"SELECT","table_name":"ask_safety_audit"},{"role":"service_role","allowed":true,"privilege":"TRIGGER","table_name":"ask_safety_audit"},{"role":"service_role","allowed":true,"privilege":"TRUNCATE","table_name":"ask_safety_audit"},{"role":"service_role","allowed":true,"privilege":"UPDATE","table_name":"ask_safety_audit"},{"role":"anon","allowed":true,"privilege":"DELETE","table_name":"ask_sessions"},{"role":"anon","allowed":true,"privilege":"INSERT","table_name":"ask_sessions"},{"role":"anon","allowed":false,"privilege":"REFERENCES","table_name":"ask_sessions"},{"role":"anon","allowed":true,"privilege":"SELECT","table_name":"ask_sessions"},{"role":"anon","allowed":false,"privilege":"TRIGGER","table_name":"ask_sessions"},{"role":"anon","allowed":false,"privilege":"TRUNCATE","table_name":"ask_sessions"},{"role":"anon","allowed":true,"privilege":"UPDATE","table_name":"ask_sessions"},{"role":"authenticated","allowed":true,"privilege":"DELETE","table_name":"ask_sessions"},{"role":"authenticated","allowed":true,"privilege":"INSERT","table_name":"ask_sessions"},{"role":"authenticated","allowed":false,"privilege":"REFERENCES","table_name":"ask_sessions"},{"role":"authenticated","allowed":true,"privilege":"SELECT","table_name":"ask_sessions"},{"role":"authenticated","allowed":false,"privilege":"TRIGGER","table_name":"ask_sessions"},{"role":"authenticated","allowed":false,"privilege":"TRUNCATE","table_name":"ask_sessions"},{"role":"authenticated","allowed":true,"privilege":"UPDATE","table_name":"ask_sessions"},{"role":"service_role","allowed":true,"privilege":"DELETE","table_name":"ask_sessions"},{"role":"service_role","allowed":true,"privilege":"INSERT","table_name":"ask_sessions"},{"role":"service_role","allowed":true,"privilege":"REFERENCES","table_name":"ask_sessions"},{"role":"service_role","allowed":true,"privilege":"SELECT","table_name":"ask_sessions"},{"role":"service_role","allowed":true,"privilege":"TRIGGER","table_name":"ask_sessions"},{"role":"service_role","allowed":true,"privilege":"TRUNCATE","table_name":"ask_sessions"},{"role":"service_role","allowed":true,"privilege":"UPDATE","table_name":"ask_sessions"},{"role":"anon","allowed":true,"privilege":"DELETE","table_name":"ask_turn_audit"},{"role":"anon","allowed":true,"privilege":"INSERT","table_name":"ask_turn_audit"},{"role":"anon","allowed":false,"privilege":"REFERENCES","table_name":"ask_turn_audit"},{"role":"anon","allowed":true,"privilege":"SELECT","table_name":"ask_turn_audit"},{"role":"anon","allowed":false,"privilege":"TRIGGER","table_name":"ask_turn_audit"},{"role":"anon","allowed":false,"privilege":"TRUNCATE","table_name":"ask_turn_audit"},{"role":"anon","allowed":true,"privilege":"UPDATE","table_name":"ask_turn_audit"},{"role":"authenticated","allowed":true,"privilege":"DELETE","table_name":"ask_turn_audit"},{"role":"authenticated","allowed":true,"privilege":"INSERT","table_name":"ask_turn_audit"},{"role":"authenticated","allowed":false,"privilege":"REFERENCES","table_name":"ask_turn_audit"},{"role":"authenticated","allowed":true,"privilege":"SELECT","table_name":"ask_turn_audit"},{"role":"authenticated","allowed":false,"privilege":"TRIGGER","table_name":"ask_turn_audit"},{"role":"authenticated","allowed":false,"privilege":"TRUNCATE","table_name":"ask_turn_audit"},{"role":"authenticated","allowed":true,"privilege":"UPDATE","table_name":"ask_turn_audit"},{"role":"service_role","allowed":true,"privilege":"DELETE","table_name":"ask_turn_audit"},{"role":"service_role","allowed":true,"privilege":"INSERT","table_name":"ask_turn_audit"},{"role":"service_role","allowed":true,"privilege":"REFERENCES","table_name":"ask_turn_audit"},{"role":"service_role","allowed":true,"privilege":"SELECT","table_name":"ask_turn_audit"},{"role":"service_role","allowed":true,"privilege":"TRIGGER","table_name":"ask_turn_audit"},{"role":"service_role","allowed":true,"privilege":"TRUNCATE","table_name":"ask_turn_audit"},{"role":"service_role","allowed":true,"privilege":"UPDATE","table_name":"ask_turn_audit"},{"role":"anon","allowed":false,"privilege":"DELETE","table_name":"brands"},{"role":"anon","allowed":false,"privilege":"INSERT","table_name":"brands"},{"role":"anon","allowed":false,"privilege":"REFERENCES","table_name":"brands"},{"role":"anon","allowed":false,"privilege":"SELECT","table_name":"brands"},{"role":"anon","allowed":false,"privilege":"TRIGGER","table_name":"brands"},{"role":"anon","allowed":false,"privilege":"TRUNCATE","table_name":"brands"},{"role":"anon","allowed":false,"privilege":"UPDATE","table_name":"brands"},{"role":"authenticated","allowed":false,"privilege":"DELETE","table_name":"brands"},{"role":"authenticated","allowed":false,"privilege":"INSERT","table_name":"brands"},{"role":"authenticated","allowed":false,"privilege":"REFERENCES","table_name":"brands"},{"role":"authenticated","allowed":true,"privilege":"SELECT","table_name":"brands"},{"role":"authenticated","allowed":false,"privilege":"TRIGGER","table_name":"brands"},{"role":"authenticated","allowed":false,"privilege":"TRUNCATE","table_name":"brands"},{"role":"authenticated","allowed":false,"privilege":"UPDATE","table_name":"brands"},{"role":"service_role","allowed":false,"privilege":"DELETE","table_name":"brands"},{"role":"service_role","allowed":false,"privilege":"INSERT","table_name":"brands"},{"role":"service_role","allowed":false,"privilege":"REFERENCES","table_name":"brands"},{"role":"service_role","allowed":false,"privilege":"SELECT","table_name":"brands"},{"role":"service_role","allowed":false,"privilege":"TRIGGER","table_name":"brands"},{"role":"service_role","allowed":false,"privilege":"TRUNCATE","table_name":"brands"},{"role":"service_role","allowed":false,"privilege":"UPDATE","table_name":"brands"},{"role":"anon","allowed":false,"privilege":"DELETE","table_name":"catalog_active_imports"},{"role":"anon","allowed":false,"privilege":"INSERT","table_name":"catalog_active_imports"},{"role":"anon","allowed":false,"privilege":"REFERENCES","table_name":"catalog_active_imports"},{"role":"anon","allowed":false,"privilege":"SELECT","table_name":"catalog_active_imports"},{"role":"anon","allowed":false,"privilege":"TRIGGER","table_name":"catalog_active_imports"},{"role":"anon","allowed":false,"privilege":"TRUNCATE","table_name":"catalog_active_imports"},{"role":"anon","allowed":false,"privilege":"UPDATE","table_name":"catalog_active_imports"},{"role":"authenticated","allowed":false,"privilege":"DELETE","table_name":"catalog_active_imports"},{"role":"authenticated","allowed":false,"privilege":"INSERT","table_name":"catalog_active_imports"},{"role":"authenticated","allowed":false,"privilege":"REFERENCES","table_name":"catalog_active_imports"},{"role":"authenticated","allowed":false,"privilege":"SELECT","table_name":"catalog_active_imports"},{"role":"authenticated","allowed":false,"privilege":"TRIGGER","table_name":"catalog_active_imports"},{"role":"authenticated","allowed":false,"privilege":"TRUNCATE","table_name":"catalog_active_imports"},{"role":"authenticated","allowed":false,"privilege":"UPDATE","table_name":"catalog_active_imports"},{"role":"service_role","allowed":true,"privilege":"DELETE","table_name":"catalog_active_imports"},{"role":"service_role","allowed":true,"privilege":"INSERT","table_name":"catalog_active_imports"},{"role":"service_role","allowed":true,"privilege":"REFERENCES","table_name":"catalog_active_imports"},{"role":"service_role","allowed":true,"privilege":"SELECT","table_name":"catalog_active_imports"},{"role":"service_role","allowed":true,"privilege":"TRIGGER","table_name":"catalog_active_imports"},{"role":"service_role","allowed":true,"privilege":"TRUNCATE","table_name":"catalog_active_imports"},{"role":"service_role","allowed":true,"privilege":"UPDATE","table_name":"catalog_active_imports"},{"role":"anon","allowed":false,"privilege":"DELETE","table_name":"catalog_corrections"},{"role":"anon","allowed":false,"privilege":"INSERT","table_name":"catalog_corrections"},{"role":"anon","allowed":false,"privilege":"REFERENCES","table_name":"catalog_corrections"},{"role":"anon","allowed":false,"privilege":"SELECT","table_name":"catalog_corrections"},{"role":"anon","allowed":false,"privilege":"TRIGGER","table_name":"catalog_corrections"},{"role":"anon","allowed":false,"privilege":"TRUNCATE","table_name":"catalog_corrections"},{"role":"anon","allowed":false,"privilege":"UPDATE","table_name":"catalog_corrections"},{"role":"authenticated","allowed":false,"privilege":"DELETE","table_name":"catalog_corrections"},{"role":"authenticated","allowed":false,"privilege":"INSERT","table_name":"catalog_corrections"},{"role":"authenticated","allowed":false,"privilege":"REFERENCES","table_name":"catalog_corrections"},{"role":"authenticated","allowed":false,"privilege":"SELECT","table_name":"catalog_corrections"},{"role":"authenticated","allowed":false,"privilege":"TRIGGER","table_name":"catalog_corrections"},{"role":"authenticated","allowed":false,"privilege":"TRUNCATE","table_name":"catalog_corrections"},{"role":"authenticated","allowed":false,"privilege":"UPDATE","table_name":"catalog_corrections"},{"role":"service_role","allowed":false,"privilege":"DELETE","table_name":"catalog_corrections"},{"role":"service_role","allowed":false,"privilege":"INSERT","table_name":"catalog_corrections"},{"role":"service_role","allowed":false,"privilege":"REFERENCES","table_name":"catalog_corrections"},{"role":"service_role","allowed":false,"privilege":"SELECT","table_name":"catalog_corrections"},{"role":"service_role","allowed":false,"privilege":"TRIGGER","table_name":"catalog_corrections"},{"role":"service_role","allowed":false,"privilege":"TRUNCATE","table_name":"catalog_corrections"},{"role":"service_role","allowed":false,"privilege":"UPDATE","table_name":"catalog_corrections"},{"role":"anon","allowed":false,"privilege":"DELETE","table_name":"catalog_import_batch_receipts"},{"role":"anon","allowed":false,"privilege":"INSERT","table_name":"catalog_import_batch_receipts"},{"role":"anon","allowed":false,"privilege":"REFERENCES","table_name":"catalog_import_batch_receipts"},{"role":"anon","allowed":false,"privilege":"SELECT","table_name":"catalog_import_batch_receipts"},{"role":"anon","allowed":false,"privilege":"TRIGGER","table_name":"catalog_import_batch_receipts"},{"role":"anon","allowed":false,"privilege":"TRUNCATE","table_name":"catalog_import_batch_receipts"},{"role":"anon","allowed":false,"privilege":"UPDATE","table_name":"catalog_import_batch_receipts"},{"role":"authenticated","allowed":false,"privilege":"DELETE","table_name":"catalog_import_batch_receipts"},{"role":"authenticated","allowed":false,"privilege":"INSERT","table_name":"catalog_import_batch_receipts"},{"role":"authenticated","allowed":false,"privilege":"REFERENCES","table_name":"catalog_import_batch_receipts"},{"role":"authenticated","allowed":false,"privilege":"SELECT","table_name":"catalog_import_batch_receipts"},{"role":"authenticated","allowed":false,"privilege":"TRIGGER","table_name":"catalog_import_batch_receipts"},{"role":"authenticated","allowed":false,"privilege":"TRUNCATE","table_name":"catalog_import_batch_receipts"},{"role":"authenticated","allowed":false,"privilege":"UPDATE","table_name":"catalog_import_batch_receipts"},{"role":"service_role","allowed":true,"privilege":"DELETE","table_name":"catalog_import_batch_receipts"},{"role":"service_role","allowed":true,"privilege":"INSERT","table_name":"catalog_import_batch_receipts"},{"role":"service_role","allowed":true,"privilege":"REFERENCES","table_name":"catalog_import_batch_receipts"},{"role":"service_role","allowed":true,"privilege":"SELECT","table_name":"catalog_import_batch_receipts"},{"role":"service_role","allowed":true,"privilege":"TRIGGER","table_name":"catalog_import_batch_receipts"},{"role":"service_role","allowed":true,"privilege":"TRUNCATE","table_name":"catalog_import_batch_receipts"},{"role":"service_role","allowed":true,"privilege":"UPDATE","table_name":"catalog_import_batch_receipts"},{"role":"anon","allowed":false,"privilege":"DELETE","table_name":"catalog_import_batches"},{"role":"anon","allowed":false,"privilege":"INSERT","table_name":"catalog_import_batches"},{"role":"anon","allowed":false,"privilege":"REFERENCES","table_name":"catalog_import_batches"},{"role":"anon","allowed":false,"privilege":"SELECT","table_name":"catalog_import_batches"},{"role":"anon","allowed":false,"privilege":"TRIGGER","table_name":"catalog_import_batches"},{"role":"anon","allowed":false,"privilege":"TRUNCATE","table_name":"catalog_import_batches"},{"role":"anon","allowed":false,"privilege":"UPDATE","table_name":"catalog_import_batches"},{"role":"authenticated","allowed":false,"privilege":"DELETE","table_name":"catalog_import_batches"},{"role":"authenticated","allowed":false,"privilege":"INSERT","table_name":"catalog_import_batches"},{"role":"authenticated","allowed":false,"privilege":"REFERENCES","table_name":"catalog_import_batches"},{"role":"authenticated","allowed":false,"privilege":"SELECT","table_name":"catalog_import_batches"},{"role":"authenticated","allowed":false,"privilege":"TRIGGER","table_name":"catalog_import_batches"},{"role":"authenticated","allowed":false,"privilege":"TRUNCATE","table_name":"catalog_import_batches"},{"role":"authenticated","allowed":false,"privilege":"UPDATE","table_name":"catalog_import_batches"},{"role":"service_role","allowed":false,"privilege":"DELETE","table_name":"catalog_import_batches"},{"role":"service_role","allowed":false,"privilege":"INSERT","table_name":"catalog_import_batches"},{"role":"service_role","allowed":false,"privilege":"REFERENCES","table_name":"catalog_import_batches"},{"role":"service_role","allowed":false,"privilege":"SELECT","table_name":"catalog_import_batches"},{"role":"service_role","allowed":false,"privilege":"TRIGGER","table_name":"catalog_import_batches"},{"role":"service_role","allowed":false,"privilege":"TRUNCATE","table_name":"catalog_import_batches"},{"role":"service_role","allowed":false,"privilege":"UPDATE","table_name":"catalog_import_batches"},{"role":"anon","allowed":false,"privilege":"DELETE","table_name":"catalog_import_staged_products"},{"role":"anon","allowed":false,"privilege":"INSERT","table_name":"catalog_import_staged_products"},{"role":"anon","allowed":false,"privilege":"REFERENCES","table_name":"catalog_import_staged_products"},{"role":"anon","allowed":false,"privilege":"SELECT","table_name":"catalog_import_staged_products"},{"role":"anon","allowed":false,"privilege":"TRIGGER","table_name":"catalog_import_staged_products"},{"role":"anon","allowed":false,"privilege":"TRUNCATE","table_name":"catalog_import_staged_products"},{"role":"anon","allowed":false,"privilege":"UPDATE","table_name":"catalog_import_staged_products"},{"role":"authenticated","allowed":false,"privilege":"DELETE","table_name":"catalog_import_staged_products"},{"role":"authenticated","allowed":false,"privilege":"INSERT","table_name":"catalog_import_staged_products"},{"role":"authenticated","allowed":false,"privilege":"REFERENCES","table_name":"catalog_import_staged_products"},{"role":"authenticated","allowed":false,"privilege":"SELECT","table_name":"catalog_import_staged_products"},{"role":"authenticated","allowed":false,"privilege":"TRIGGER","table_name":"catalog_import_staged_products"},{"role":"authenticated","allowed":false,"privilege":"TRUNCATE","table_name":"catalog_import_staged_products"},{"role":"authenticated","allowed":false,"privilege":"UPDATE","table_name":"catalog_import_staged_products"},{"role":"service_role","allowed":true,"privilege":"DELETE","table_name":"catalog_import_staged_products"},{"role":"service_role","allowed":true,"privilege":"INSERT","table_name":"catalog_import_staged_products"},{"role":"service_role","allowed":true,"privilege":"REFERENCES","table_name":"catalog_import_staged_products"},{"role":"service_role","allowed":true,"privilege":"SELECT","table_name":"catalog_import_staged_products"},{"role":"service_role","allowed":true,"privilege":"TRIGGER","table_name":"catalog_import_staged_products"},{"role":"service_role","allowed":true,"privilege":"TRUNCATE","table_name":"catalog_import_staged_products"},{"role":"service_role","allowed":true,"privilege":"UPDATE","table_name":"catalog_import_staged_products"},{"role":"anon","allowed":false,"privilege":"DELETE","table_name":"catalog_import_versions"},{"role":"anon","allowed":false,"privilege":"INSERT","table_name":"catalog_import_versions"},{"role":"anon","allowed":false,"privilege":"REFERENCES","table_name":"catalog_import_versions"},{"role":"anon","allowed":false,"privilege":"SELECT","table_name":"catalog_import_versions"},{"role":"anon","allowed":false,"privilege":"TRIGGER","table_name":"catalog_import_versions"},{"role":"anon","allowed":false,"privilege":"TRUNCATE","table_name":"catalog_import_versions"},{"role":"anon","allowed":false,"privilege":"UPDATE","table_name":"catalog_import_versions"},{"role":"authenticated","allowed":false,"privilege":"DELETE","table_name":"catalog_import_versions"},{"role":"authenticated","allowed":false,"privilege":"INSERT","table_name":"catalog_import_versions"},{"role":"authenticated","allowed":false,"privilege":"REFERENCES","table_name":"catalog_import_versions"},{"role":"authenticated","allowed":false,"privilege":"SELECT","table_name":"catalog_import_versions"},{"role":"authenticated","allowed":false,"privilege":"TRIGGER","table_name":"catalog_import_versions"},{"role":"authenticated","allowed":false,"privilege":"TRUNCATE","table_name":"catalog_import_versions"},{"role":"authenticated","allowed":false,"privilege":"UPDATE","table_name":"catalog_import_versions"},{"role":"service_role","allowed":true,"privilege":"DELETE","table_name":"catalog_import_versions"},{"role":"service_role","allowed":true,"privilege":"INSERT","table_name":"catalog_import_versions"},{"role":"service_role","allowed":true,"privilege":"REFERENCES","table_name":"catalog_import_versions"},{"role":"service_role","allowed":true,"privilege":"SELECT","table_name":"catalog_import_versions"},{"role":"service_role","allowed":true,"privilege":"TRIGGER","table_name":"catalog_import_versions"},{"role":"service_role","allowed":true,"privilege":"TRUNCATE","table_name":"catalog_import_versions"},{"role":"service_role","allowed":true,"privilege":"UPDATE","table_name":"catalog_import_versions"},{"role":"anon","allowed":false,"privilege":"DELETE","table_name":"catalog_lookup_events"},{"role":"anon","allowed":false,"privilege":"INSERT","table_name":"catalog_lookup_events"},{"role":"anon","allowed":false,"privilege":"REFERENCES","table_name":"catalog_lookup_events"},{"role":"anon","allowed":false,"privilege":"SELECT","table_name":"catalog_lookup_events"},{"role":"anon","allowed":false,"privilege":"TRIGGER","table_name":"catalog_lookup_events"},{"role":"anon","allowed":false,"privilege":"TRUNCATE","table_name":"catalog_lookup_events"},{"role":"anon","allowed":false,"privilege":"UPDATE","table_name":"catalog_lookup_events"},{"role":"authenticated","allowed":false,"privilege":"DELETE","table_name":"catalog_lookup_events"},{"role":"authenticated","allowed":false,"privilege":"INSERT","table_name":"catalog_lookup_events"},{"role":"authenticated","allowed":false,"privilege":"REFERENCES","table_name":"catalog_lookup_events"},{"role":"authenticated","allowed":true,"privilege":"SELECT","table_name":"catalog_lookup_events"},{"role":"authenticated","allowed":false,"privilege":"TRIGGER","table_name":"catalog_lookup_events"},{"role":"authenticated","allowed":false,"privilege":"TRUNCATE","table_name":"catalog_lookup_events"},{"role":"authenticated","allowed":false,"privilege":"UPDATE","table_name":"catalog_lookup_events"},{"role":"service_role","allowed":false,"privilege":"DELETE","table_name":"catalog_lookup_events"},{"role":"service_role","allowed":false,"privilege":"INSERT","table_name":"catalog_lookup_events"},{"role":"service_role","allowed":false,"privilege":"REFERENCES","table_name":"catalog_lookup_events"},{"role":"service_role","allowed":true,"privilege":"SELECT","table_name":"catalog_lookup_events"},{"role":"service_role","allowed":false,"privilege":"TRIGGER","table_name":"catalog_lookup_events"},{"role":"service_role","allowed":false,"privilege":"TRUNCATE","table_name":"catalog_lookup_events"},{"role":"service_role","allowed":false,"privilege":"UPDATE","table_name":"catalog_lookup_events"},{"role":"anon","allowed":false,"privilege":"DELETE","table_name":"catalog_quality_reports"},{"role":"anon","allowed":false,"privilege":"INSERT","table_name":"catalog_quality_reports"},{"role":"anon","allowed":false,"privilege":"REFERENCES","table_name":"catalog_quality_reports"},{"role":"anon","allowed":false,"privilege":"SELECT","table_name":"catalog_quality_reports"},{"role":"anon","allowed":false,"privilege":"TRIGGER","table_name":"catalog_quality_reports"},{"role":"anon","allowed":false,"privilege":"TRUNCATE","table_name":"catalog_quality_reports"},{"role":"anon","allowed":false,"privilege":"UPDATE","table_name":"catalog_quality_reports"},{"role":"authenticated","allowed":false,"privilege":"DELETE","table_name":"catalog_quality_reports"},{"role":"authenticated","allowed":false,"privilege":"INSERT","table_name":"catalog_quality_reports"},{"role":"authenticated","allowed":false,"privilege":"REFERENCES","table_name":"catalog_quality_reports"},{"role":"authenticated","allowed":false,"privilege":"SELECT","table_name":"catalog_quality_reports"},{"role":"authenticated","allowed":false,"privilege":"TRIGGER","table_name":"catalog_quality_reports"},{"role":"authenticated","allowed":false,"privilege":"TRUNCATE","table_name":"catalog_quality_reports"},{"role":"authenticated","allowed":false,"privilege":"UPDATE","table_name":"catalog_quality_reports"},{"role":"service_role","allowed":false,"privilege":"DELETE","table_name":"catalog_quality_reports"},{"role":"service_role","allowed":false,"privilege":"INSERT","table_name":"catalog_quality_reports"},{"role":"service_role","allowed":false,"privilege":"REFERENCES","table_name":"catalog_quality_reports"},{"role":"service_role","allowed":false,"privilege":"SELECT","table_name":"catalog_quality_reports"},{"role":"service_role","allowed":false,"privilege":"TRIGGER","table_name":"catalog_quality_reports"},{"role":"service_role","allowed":false,"privilege":"TRUNCATE","table_name":"catalog_quality_reports"},{"role":"service_role","allowed":false,"privilege":"UPDATE","table_name":"catalog_quality_reports"},{"role":"anon","allowed":false,"privilege":"DELETE","table_name":"catalog_sources"},{"role":"anon","allowed":false,"privilege":"INSERT","table_name":"catalog_sources"},{"role":"anon","allowed":false,"privilege":"REFERENCES","table_name":"catalog_sources"},{"role":"anon","allowed":false,"privilege":"SELECT","table_name":"catalog_sources"},{"role":"anon","allowed":false,"privilege":"TRIGGER","table_name":"catalog_sources"},{"role":"anon","allowed":false,"privilege":"TRUNCATE","table_name":"catalog_sources"},{"role":"anon","allowed":false,"privilege":"UPDATE","table_name":"catalog_sources"},{"role":"authenticated","allowed":false,"privilege":"DELETE","table_name":"catalog_sources"},{"role":"authenticated","allowed":false,"privilege":"INSERT","table_name":"catalog_sources"},{"role":"authenticated","allowed":false,"privilege":"REFERENCES","table_name":"catalog_sources"},{"role":"authenticated","allowed":false,"privilege":"SELECT","table_name":"catalog_sources"},{"role":"authenticated","allowed":false,"privilege":"TRIGGER","table_name":"catalog_sources"},{"role":"authenticated","allowed":false,"privilege":"TRUNCATE","table_name":"catalog_sources"},{"role":"authenticated","allowed":false,"privilege":"UPDATE","table_name":"catalog_sources"},{"role":"service_role","allowed":false,"privilege":"DELETE","table_name":"catalog_sources"},{"role":"service_role","allowed":false,"privilege":"INSERT","table_name":"catalog_sources"},{"role":"service_role","allowed":false,"privilege":"REFERENCES","table_name":"catalog_sources"},{"role":"service_role","allowed":false,"privilege":"SELECT","table_name":"catalog_sources"},{"role":"service_role","allowed":false,"privilege":"TRIGGER","table_name":"catalog_sources"},{"role":"service_role","allowed":false,"privilege":"TRUNCATE","table_name":"catalog_sources"},{"role":"service_role","allowed":false,"privilege":"UPDATE","table_name":"catalog_sources"},{"role":"anon","allowed":false,"privilege":"DELETE","table_name":"commerce_click_events"},{"role":"anon","allowed":false,"privilege":"INSERT","table_name":"commerce_click_events"},{"role":"anon","allowed":false,"privilege":"REFERENCES","table_name":"commerce_click_events"},{"role":"anon","allowed":false,"privilege":"SELECT","table_name":"commerce_click_events"},{"role":"anon","allowed":false,"privilege":"TRIGGER","table_name":"commerce_click_events"},{"role":"anon","allowed":false,"privilege":"TRUNCATE","table_name":"commerce_click_events"},{"role":"anon","allowed":false,"privilege":"UPDATE","table_name":"commerce_click_events"},{"role":"authenticated","allowed":true,"privilege":"DELETE","table_name":"commerce_click_events"},{"role":"authenticated","allowed":false,"privilege":"INSERT","table_name":"commerce_click_events"},{"role":"authenticated","allowed":false,"privilege":"REFERENCES","table_name":"commerce_click_events"},{"role":"authenticated","allowed":true,"privilege":"SELECT","table_name":"commerce_click_events"},{"role":"authenticated","allowed":false,"privilege":"TRIGGER","table_name":"commerce_click_events"},{"role":"authenticated","allowed":false,"privilege":"TRUNCATE","table_name":"commerce_click_events"},{"role":"authenticated","allowed":false,"privilege":"UPDATE","table_name":"commerce_click_events"},{"role":"service_role","allowed":true,"privilege":"DELETE","table_name":"commerce_click_events"},{"role":"service_role","allowed":false,"privilege":"INSERT","table_name":"commerce_click_events"},{"role":"service_role","allowed":false,"privilege":"REFERENCES","table_name":"commerce_click_events"},{"role":"service_role","allowed":true,"privilege":"SELECT","table_name":"commerce_click_events"},{"role":"service_role","allowed":false,"privilege":"TRIGGER","table_name":"commerce_click_events"},{"role":"service_role","allowed":false,"privilege":"TRUNCATE","table_name":"commerce_click_events"},{"role":"service_role","allowed":false,"privilege":"UPDATE","table_name":"commerce_click_events"},{"role":"anon","allowed":true,"privilege":"DELETE","table_name":"community_blocks"},{"role":"anon","allowed":true,"privilege":"INSERT","table_name":"community_blocks"},{"role":"anon","allowed":false,"privilege":"REFERENCES","table_name":"community_blocks"},{"role":"anon","allowed":true,"privilege":"SELECT","table_name":"community_blocks"},{"role":"anon","allowed":false,"privilege":"TRIGGER","table_name":"community_blocks"},{"role":"anon","allowed":false,"privilege":"TRUNCATE","table_name":"community_blocks"},{"role":"anon","allowed":true,"privilege":"UPDATE","table_name":"community_blocks"},{"role":"authenticated","allowed":true,"privilege":"DELETE","table_name":"community_blocks"},{"role":"authenticated","allowed":true,"privilege":"INSERT","table_name":"community_blocks"},{"role":"authenticated","allowed":false,"privilege":"REFERENCES","table_name":"community_blocks"},{"role":"authenticated","allowed":true,"privilege":"SELECT","table_name":"community_blocks"},{"role":"authenticated","allowed":false,"privilege":"TRIGGER","table_name":"community_blocks"},{"role":"authenticated","allowed":false,"privilege":"TRUNCATE","table_name":"community_blocks"},{"role":"authenticated","allowed":true,"privilege":"UPDATE","table_name":"community_blocks"},{"role":"service_role","allowed":true,"privilege":"DELETE","table_name":"community_blocks"},{"role":"service_role","allowed":true,"privilege":"INSERT","table_name":"community_blocks"},{"role":"service_role","allowed":true,"privilege":"REFERENCES","table_name":"community_blocks"},{"role":"service_role","allowed":true,"privilege":"SELECT","table_name":"community_blocks"},{"role":"service_role","allowed":true,"privilege":"TRIGGER","table_name":"community_blocks"},{"role":"service_role","allowed":true,"privilege":"TRUNCATE","table_name":"community_blocks"},{"role":"service_role","allowed":true,"privilege":"UPDATE","table_name":"community_blocks"},{"role":"anon","allowed":true,"privilege":"DELETE","table_name":"community_moderation_events"},{"role":"anon","allowed":true,"privilege":"INSERT","table_name":"community_moderation_events"},{"role":"anon","allowed":false,"privilege":"REFERENCES","table_name":"community_moderation_events"},{"role":"anon","allowed":true,"privilege":"SELECT","table_name":"community_moderation_events"},{"role":"anon","allowed":false,"privilege":"TRIGGER","table_name":"community_moderation_events"},{"role":"anon","allowed":false,"privilege":"TRUNCATE","table_name":"community_moderation_events"},{"role":"anon","allowed":true,"privilege":"UPDATE","table_name":"community_moderation_events"},{"role":"authenticated","allowed":true,"privilege":"DELETE","table_name":"community_moderation_events"},{"role":"authenticated","allowed":true,"privilege":"INSERT","table_name":"community_moderation_events"},{"role":"authenticated","allowed":false,"privilege":"REFERENCES","table_name":"community_moderation_events"},{"role":"authenticated","allowed":true,"privilege":"SELECT","table_name":"community_moderation_events"},{"role":"authenticated","allowed":false,"privilege":"TRIGGER","table_name":"community_moderation_events"},{"role":"authenticated","allowed":false,"privilege":"TRUNCATE","table_name":"community_moderation_events"},{"role":"authenticated","allowed":true,"privilege":"UPDATE","table_name":"community_moderation_events"},{"role":"service_role","allowed":true,"privilege":"DELETE","table_name":"community_moderation_events"},{"role":"service_role","allowed":true,"privilege":"INSERT","table_name":"community_moderation_events"},{"role":"service_role","allowed":true,"privilege":"REFERENCES","table_name":"community_moderation_events"},{"role":"service_role","allowed":true,"privilege":"SELECT","table_name":"community_moderation_events"},{"role":"service_role","allowed":true,"privilege":"TRIGGER","table_name":"community_moderation_events"},{"role":"service_role","allowed":true,"privilege":"TRUNCATE","table_name":"community_moderation_events"},{"role":"service_role","allowed":true,"privilege":"UPDATE","table_name":"community_moderation_events"},{"role":"anon","allowed":true,"privilege":"DELETE","table_name":"community_notes"},{"role":"anon","allowed":true,"privilege":"INSERT","table_name":"community_notes"},{"role":"anon","allowed":false,"privilege":"REFERENCES","table_name":"community_notes"},{"role":"anon","allowed":true,"privilege":"SELECT","table_name":"community_notes"},{"role":"anon","allowed":false,"privilege":"TRIGGER","table_name":"community_notes"},{"role":"anon","allowed":false,"privilege":"TRUNCATE","table_name":"community_notes"},{"role":"anon","allowed":true,"privilege":"UPDATE","table_name":"community_notes"},{"role":"authenticated","allowed":true,"privilege":"DELETE","table_name":"community_notes"},{"role":"authenticated","allowed":true,"privilege":"INSERT","table_name":"community_notes"},{"role":"authenticated","allowed":false,"privilege":"REFERENCES","table_name":"community_notes"},{"role":"authenticated","allowed":true,"privilege":"SELECT","table_name":"community_notes"},{"role":"authenticated","allowed":false,"privilege":"TRIGGER","table_name":"community_notes"},{"role":"authenticated","allowed":false,"privilege":"TRUNCATE","table_name":"community_notes"},{"role":"authenticated","allowed":true,"privilege":"UPDATE","table_name":"community_notes"},{"role":"service_role","allowed":true,"privilege":"DELETE","table_name":"community_notes"},{"role":"service_role","allowed":true,"privilege":"INSERT","table_name":"community_notes"},{"role":"service_role","allowed":true,"privilege":"REFERENCES","table_name":"community_notes"},{"role":"service_role","allowed":true,"privilege":"SELECT","table_name":"community_notes"},{"role":"service_role","allowed":true,"privilege":"TRIGGER","table_name":"community_notes"},{"role":"service_role","allowed":true,"privilege":"TRUNCATE","table_name":"community_notes"},{"role":"service_role","allowed":true,"privilege":"UPDATE","table_name":"community_notes"},{"role":"anon","allowed":true,"privilege":"DELETE","table_name":"community_questions"},{"role":"anon","allowed":true,"privilege":"INSERT","table_name":"community_questions"},{"role":"anon","allowed":false,"privilege":"REFERENCES","table_name":"community_questions"},{"role":"anon","allowed":true,"privilege":"SELECT","table_name":"community_questions"},{"role":"anon","allowed":false,"privilege":"TRIGGER","table_name":"community_questions"},{"role":"anon","allowed":false,"privilege":"TRUNCATE","table_name":"community_questions"},{"role":"anon","allowed":true,"privilege":"UPDATE","table_name":"community_questions"},{"role":"authenticated","allowed":true,"privilege":"DELETE","table_name":"community_questions"},{"role":"authenticated","allowed":true,"privilege":"INSERT","table_name":"community_questions"},{"role":"authenticated","allowed":false,"privilege":"REFERENCES","table_name":"community_questions"},{"role":"authenticated","allowed":true,"privilege":"SELECT","table_name":"community_questions"},{"role":"authenticated","allowed":false,"privilege":"TRIGGER","table_name":"community_questions"},{"role":"authenticated","allowed":false,"privilege":"TRUNCATE","table_name":"community_questions"},{"role":"authenticated","allowed":true,"privilege":"UPDATE","table_name":"community_questions"},{"role":"service_role","allowed":true,"privilege":"DELETE","table_name":"community_questions"},{"role":"service_role","allowed":true,"privilege":"INSERT","table_name":"community_questions"},{"role":"service_role","allowed":true,"privilege":"REFERENCES","table_name":"community_questions"},{"role":"service_role","allowed":true,"privilege":"SELECT","table_name":"community_questions"},{"role":"service_role","allowed":true,"privilege":"TRIGGER","table_name":"community_questions"},{"role":"service_role","allowed":true,"privilege":"TRUNCATE","table_name":"community_questions"},{"role":"service_role","allowed":true,"privilege":"UPDATE","table_name":"community_questions"},{"role":"anon","allowed":true,"privilege":"DELETE","table_name":"community_reactions"},{"role":"anon","allowed":true,"privilege":"INSERT","table_name":"community_reactions"},{"role":"anon","allowed":false,"privilege":"REFERENCES","table_name":"community_reactions"},{"role":"anon","allowed":true,"privilege":"SELECT","table_name":"community_reactions"},{"role":"anon","allowed":false,"privilege":"TRIGGER","table_name":"community_reactions"},{"role":"anon","allowed":false,"privilege":"TRUNCATE","table_name":"community_reactions"},{"role":"anon","allowed":true,"privilege":"UPDATE","table_name":"community_reactions"},{"role":"authenticated","allowed":true,"privilege":"DELETE","table_name":"community_reactions"},{"role":"authenticated","allowed":true,"privilege":"INSERT","table_name":"community_reactions"},{"role":"authenticated","allowed":false,"privilege":"REFERENCES","table_name":"community_reactions"},{"role":"authenticated","allowed":true,"privilege":"SELECT","table_name":"community_reactions"},{"role":"authenticated","allowed":false,"privilege":"TRIGGER","table_name":"community_reactions"},{"role":"authenticated","allowed":false,"privilege":"TRUNCATE","table_name":"community_reactions"},{"role":"authenticated","allowed":true,"privilege":"UPDATE","table_name":"community_reactions"},{"role":"service_role","allowed":true,"privilege":"DELETE","table_name":"community_reactions"},{"role":"service_role","allowed":true,"privilege":"INSERT","table_name":"community_reactions"},{"role":"service_role","allowed":true,"privilege":"REFERENCES","table_name":"community_reactions"},{"role":"service_role","allowed":true,"privilege":"SELECT","table_name":"community_reactions"},{"role":"service_role","allowed":true,"privilege":"TRIGGER","table_name":"community_reactions"},{"role":"service_role","allowed":true,"privilege":"TRUNCATE","table_name":"community_reactions"},{"role":"service_role","allowed":true,"privilege":"UPDATE","table_name":"community_reactions"},{"role":"anon","allowed":true,"privilege":"DELETE","table_name":"community_reports"},{"role":"anon","allowed":true,"privilege":"INSERT","table_name":"community_reports"},{"role":"anon","allowed":false,"privilege":"REFERENCES","table_name":"community_reports"},{"role":"anon","allowed":true,"privilege":"SELECT","table_name":"community_reports"},{"role":"anon","allowed":false,"privilege":"TRIGGER","table_name":"community_reports"},{"role":"anon","allowed":false,"privilege":"TRUNCATE","table_name":"community_reports"},{"role":"anon","allowed":true,"privilege":"UPDATE","table_name":"community_reports"},{"role":"authenticated","allowed":true,"privilege":"DELETE","table_name":"community_reports"},{"role":"authenticated","allowed":true,"privilege":"INSERT","table_name":"community_reports"},{"role":"authenticated","allowed":false,"privilege":"REFERENCES","table_name":"community_reports"},{"role":"authenticated","allowed":true,"privilege":"SELECT","table_name":"community_reports"},{"role":"authenticated","allowed":false,"privilege":"TRIGGER","table_name":"community_reports"},{"role":"authenticated","allowed":false,"privilege":"TRUNCATE","table_name":"community_reports"},{"role":"authenticated","allowed":true,"privilege":"UPDATE","table_name":"community_reports"},{"role":"service_role","allowed":true,"privilege":"DELETE","table_name":"community_reports"},{"role":"service_role","allowed":true,"privilege":"INSERT","table_name":"community_reports"},{"role":"service_role","allowed":true,"privilege":"REFERENCES","table_name":"community_reports"},{"role":"service_role","allowed":true,"privilege":"SELECT","table_name":"community_reports"},{"role":"service_role","allowed":true,"privilege":"TRIGGER","table_name":"community_reports"},{"role":"service_role","allowed":true,"privilege":"TRUNCATE","table_name":"community_reports"},{"role":"service_role","allowed":true,"privilege":"UPDATE","table_name":"community_reports"},{"role":"anon","allowed":true,"privilege":"DELETE","table_name":"community_topics"},{"role":"anon","allowed":true,"privilege":"INSERT","table_name":"community_topics"},{"role":"anon","allowed":false,"privilege":"REFERENCES","table_name":"community_topics"},{"role":"anon","allowed":true,"privilege":"SELECT","table_name":"community_topics"},{"role":"anon","allowed":false,"privilege":"TRIGGER","table_name":"community_topics"},{"role":"anon","allowed":false,"privilege":"TRUNCATE","table_name":"community_topics"},{"role":"anon","allowed":true,"privilege":"UPDATE","table_name":"community_topics"},{"role":"authenticated","allowed":true,"privilege":"DELETE","table_name":"community_topics"},{"role":"authenticated","allowed":true,"privilege":"INSERT","table_name":"community_topics"},{"role":"authenticated","allowed":false,"privilege":"REFERENCES","table_name":"community_topics"},{"role":"authenticated","allowed":true,"privilege":"SELECT","table_name":"community_topics"},{"role":"authenticated","allowed":false,"privilege":"TRIGGER","table_name":"community_topics"},{"role":"authenticated","allowed":false,"privilege":"TRUNCATE","table_name":"community_topics"},{"role":"authenticated","allowed":true,"privilege":"UPDATE","table_name":"community_topics"},{"role":"service_role","allowed":true,"privilege":"DELETE","table_name":"community_topics"},{"role":"service_role","allowed":true,"privilege":"INSERT","table_name":"community_topics"},{"role":"service_role","allowed":true,"privilege":"REFERENCES","table_name":"community_topics"},{"role":"service_role","allowed":true,"privilege":"SELECT","table_name":"community_topics"},{"role":"service_role","allowed":true,"privilege":"TRIGGER","table_name":"community_topics"},{"role":"service_role","allowed":true,"privilege":"TRUNCATE","table_name":"community_topics"},{"role":"service_role","allowed":true,"privilege":"UPDATE","table_name":"community_topics"},{"role":"anon","allowed":false,"privilege":"DELETE","table_name":"conflict_choice_mirror_versions"},{"role":"anon","allowed":false,"privilege":"INSERT","table_name":"conflict_choice_mirror_versions"},{"role":"anon","allowed":false,"privilege":"REFERENCES","table_name":"conflict_choice_mirror_versions"},{"role":"anon","allowed":false,"privilege":"SELECT","table_name":"conflict_choice_mirror_versions"},{"role":"anon","allowed":false,"privilege":"TRIGGER","table_name":"conflict_choice_mirror_versions"},{"role":"anon","allowed":false,"privilege":"TRUNCATE","table_name":"conflict_choice_mirror_versions"},{"role":"anon","allowed":false,"privilege":"UPDATE","table_name":"conflict_choice_mirror_versions"},{"role":"authenticated","allowed":false,"privilege":"DELETE","table_name":"conflict_choice_mirror_versions"},{"role":"authenticated","allowed":false,"privilege":"INSERT","table_name":"conflict_choice_mirror_versions"},{"role":"authenticated","allowed":false,"privilege":"REFERENCES","table_name":"conflict_choice_mirror_versions"},{"role":"authenticated","allowed":false,"privilege":"SELECT","table_name":"conflict_choice_mirror_versions"},{"role":"authenticated","allowed":false,"privilege":"TRIGGER","table_name":"conflict_choice_mirror_versions"},{"role":"authenticated","allowed":false,"privilege":"TRUNCATE","table_name":"conflict_choice_mirror_versions"},{"role":"authenticated","allowed":false,"privilege":"UPDATE","table_name":"conflict_choice_mirror_versions"},{"role":"service_role","allowed":true,"privilege":"DELETE","table_name":"conflict_choice_mirror_versions"},{"role":"service_role","allowed":true,"privilege":"INSERT","table_name":"conflict_choice_mirror_versions"},{"role":"service_role","allowed":true,"privilege":"REFERENCES","table_name":"conflict_choice_mirror_versions"},{"role":"service_role","allowed":true,"privilege":"SELECT","table_name":"conflict_choice_mirror_versions"},{"role":"service_role","allowed":true,"privilege":"TRIGGER","table_name":"conflict_choice_mirror_versions"},{"role":"service_role","allowed":true,"privilege":"TRUNCATE","table_name":"conflict_choice_mirror_versions"},{"role":"service_role","allowed":true,"privilege":"UPDATE","table_name":"conflict_choice_mirror_versions"},{"role":"anon","allowed":false,"privilege":"DELETE","table_name":"conflict_rules"},{"role":"anon","allowed":false,"privilege":"INSERT","table_name":"conflict_rules"},{"role":"anon","allowed":false,"privilege":"REFERENCES","table_name":"conflict_rules"},{"role":"anon","allowed":false,"privilege":"SELECT","table_name":"conflict_rules"},{"role":"anon","allowed":false,"privilege":"TRIGGER","table_name":"conflict_rules"},{"role":"anon","allowed":false,"privilege":"TRUNCATE","table_name":"conflict_rules"},{"role":"anon","allowed":false,"privilege":"UPDATE","table_name":"conflict_rules"},{"role":"authenticated","allowed":false,"privilege":"DELETE","table_name":"conflict_rules"},{"role":"authenticated","allowed":false,"privilege":"INSERT","table_name":"conflict_rules"},{"role":"authenticated","allowed":false,"privilege":"REFERENCES","table_name":"conflict_rules"},{"role":"authenticated","allowed":false,"privilege":"SELECT","table_name":"conflict_rules"},{"role":"authenticated","allowed":false,"privilege":"TRIGGER","table_name":"conflict_rules"},{"role":"authenticated","allowed":false,"privilege":"TRUNCATE","table_name":"conflict_rules"},{"role":"authenticated","allowed":false,"privilege":"UPDATE","table_name":"conflict_rules"},{"role":"service_role","allowed":false,"privilege":"DELETE","table_name":"conflict_rules"},{"role":"service_role","allowed":false,"privilege":"INSERT","table_name":"conflict_rules"},{"role":"service_role","allowed":false,"privilege":"REFERENCES","table_name":"conflict_rules"},{"role":"service_role","allowed":false,"privilege":"SELECT","table_name":"conflict_rules"},{"role":"service_role","allowed":false,"privilege":"TRIGGER","table_name":"conflict_rules"},{"role":"service_role","allowed":false,"privilege":"TRUNCATE","table_name":"conflict_rules"},{"role":"service_role","allowed":false,"privilege":"UPDATE","table_name":"conflict_rules"},{"role":"anon","allowed":true,"privilege":"DELETE","table_name":"consents"},{"role":"anon","allowed":true,"privilege":"INSERT","table_name":"consents"},{"role":"anon","allowed":false,"privilege":"REFERENCES","table_name":"consents"},{"role":"anon","allowed":true,"privilege":"SELECT","table_name":"consents"},{"role":"anon","allowed":false,"privilege":"TRIGGER","table_name":"consents"},{"role":"anon","allowed":false,"privilege":"TRUNCATE","table_name":"consents"},{"role":"anon","allowed":true,"privilege":"UPDATE","table_name":"consents"},{"role":"authenticated","allowed":true,"privilege":"DELETE","table_name":"consents"},{"role":"authenticated","allowed":true,"privilege":"INSERT","table_name":"consents"},{"role":"authenticated","allowed":false,"privilege":"REFERENCES","table_name":"consents"},{"role":"authenticated","allowed":true,"privilege":"SELECT","table_name":"consents"},{"role":"authenticated","allowed":false,"privilege":"TRIGGER","table_name":"consents"},{"role":"authenticated","allowed":false,"privilege":"TRUNCATE","table_name":"consents"},{"role":"authenticated","allowed":true,"privilege":"UPDATE","table_name":"consents"},{"role":"service_role","allowed":true,"privilege":"DELETE","table_name":"consents"},{"role":"service_role","allowed":true,"privilege":"INSERT","table_name":"consents"},{"role":"service_role","allowed":true,"privilege":"REFERENCES","table_name":"consents"},{"role":"service_role","allowed":true,"privilege":"SELECT","table_name":"consents"},{"role":"service_role","allowed":true,"privilege":"TRIGGER","table_name":"consents"},{"role":"service_role","allowed":true,"privilege":"TRUNCATE","table_name":"consents"},{"role":"service_role","allowed":true,"privilege":"UPDATE","table_name":"consents"},{"role":"anon","allowed":false,"privilege":"DELETE","table_name":"creator_stack_items"},{"role":"anon","allowed":false,"privilege":"INSERT","table_name":"creator_stack_items"},{"role":"anon","allowed":false,"privilege":"REFERENCES","table_name":"creator_stack_items"},{"role":"anon","allowed":false,"privilege":"SELECT","table_name":"creator_stack_items"},{"role":"anon","allowed":false,"privilege":"TRIGGER","table_name":"creator_stack_items"},{"role":"anon","allowed":false,"privilege":"TRUNCATE","table_name":"creator_stack_items"},{"role":"anon","allowed":false,"privilege":"UPDATE","table_name":"creator_stack_items"},{"role":"authenticated","allowed":false,"privilege":"DELETE","table_name":"creator_stack_items"},{"role":"authenticated","allowed":false,"privilege":"INSERT","table_name":"creator_stack_items"},{"role":"authenticated","allowed":false,"privilege":"REFERENCES","table_name":"creator_stack_items"},{"role":"authenticated","allowed":false,"privilege":"SELECT","table_name":"creator_stack_items"},{"role":"authenticated","allowed":false,"privilege":"TRIGGER","table_name":"creator_stack_items"},{"role":"authenticated","allowed":false,"privilege":"TRUNCATE","table_name":"creator_stack_items"},{"role":"authenticated","allowed":false,"privilege":"UPDATE","table_name":"creator_stack_items"},{"role":"service_role","allowed":false,"privilege":"DELETE","table_name":"creator_stack_items"},{"role":"service_role","allowed":false,"privilege":"INSERT","table_name":"creator_stack_items"},{"role":"service_role","allowed":false,"privilege":"REFERENCES","table_name":"creator_stack_items"},{"role":"service_role","allowed":false,"privilege":"SELECT","table_name":"creator_stack_items"},{"role":"service_role","allowed":false,"privilege":"TRIGGER","table_name":"creator_stack_items"},{"role":"service_role","allowed":false,"privilege":"TRUNCATE","table_name":"creator_stack_items"},{"role":"service_role","allowed":false,"privilege":"UPDATE","table_name":"creator_stack_items"},{"role":"anon","allowed":false,"privilege":"DELETE","table_name":"creator_stacks"},{"role":"anon","allowed":false,"privilege":"INSERT","table_name":"creator_stacks"},{"role":"anon","allowed":false,"privilege":"REFERENCES","table_name":"creator_stacks"},{"role":"anon","allowed":false,"privilege":"SELECT","table_name":"creator_stacks"},{"role":"anon","allowed":false,"privilege":"TRIGGER","table_name":"creator_stacks"},{"role":"anon","allowed":false,"privilege":"TRUNCATE","table_name":"creator_stacks"},{"role":"anon","allowed":false,"privilege":"UPDATE","table_name":"creator_stacks"},{"role":"authenticated","allowed":false,"privilege":"DELETE","table_name":"creator_stacks"},{"role":"authenticated","allowed":false,"privilege":"INSERT","table_name":"creator_stacks"},{"role":"authenticated","allowed":false,"privilege":"REFERENCES","table_name":"creator_stacks"},{"role":"authenticated","allowed":false,"privilege":"SELECT","table_name":"creator_stacks"},{"role":"authenticated","allowed":false,"privilege":"TRIGGER","table_name":"creator_stacks"},{"role":"authenticated","allowed":false,"privilege":"TRUNCATE","table_name":"creator_stacks"},{"role":"authenticated","allowed":false,"privilege":"UPDATE","table_name":"creator_stacks"},{"role":"service_role","allowed":false,"privilege":"DELETE","table_name":"creator_stacks"},{"role":"service_role","allowed":false,"privilege":"INSERT","table_name":"creator_stacks"},{"role":"service_role","allowed":false,"privilege":"REFERENCES","table_name":"creator_stacks"},{"role":"service_role","allowed":false,"privilege":"SELECT","table_name":"creator_stacks"},{"role":"service_role","allowed":false,"privilege":"TRIGGER","table_name":"creator_stacks"},{"role":"service_role","allowed":false,"privilege":"TRUNCATE","table_name":"creator_stacks"},{"role":"service_role","allowed":false,"privilege":"UPDATE","table_name":"creator_stacks"},{"role":"anon","allowed":true,"privilege":"DELETE","table_name":"cycle_nights"},{"role":"anon","allowed":true,"privilege":"INSERT","table_name":"cycle_nights"},{"role":"anon","allowed":false,"privilege":"REFERENCES","table_name":"cycle_nights"},{"role":"anon","allowed":true,"privilege":"SELECT","table_name":"cycle_nights"},{"role":"anon","allowed":false,"privilege":"TRIGGER","table_name":"cycle_nights"},{"role":"anon","allowed":false,"privilege":"TRUNCATE","table_name":"cycle_nights"},{"role":"anon","allowed":true,"privilege":"UPDATE","table_name":"cycle_nights"},{"role":"authenticated","allowed":true,"privilege":"DELETE","table_name":"cycle_nights"},{"role":"authenticated","allowed":true,"privilege":"INSERT","table_name":"cycle_nights"},{"role":"authenticated","allowed":false,"privilege":"REFERENCES","table_name":"cycle_nights"},{"role":"authenticated","allowed":true,"privilege":"SELECT","table_name":"cycle_nights"},{"role":"authenticated","allowed":false,"privilege":"TRIGGER","table_name":"cycle_nights"},{"role":"authenticated","allowed":false,"privilege":"TRUNCATE","table_name":"cycle_nights"},{"role":"authenticated","allowed":true,"privilege":"UPDATE","table_name":"cycle_nights"},{"role":"service_role","allowed":true,"privilege":"DELETE","table_name":"cycle_nights"},{"role":"service_role","allowed":true,"privilege":"INSERT","table_name":"cycle_nights"},{"role":"service_role","allowed":true,"privilege":"REFERENCES","table_name":"cycle_nights"},{"role":"service_role","allowed":true,"privilege":"SELECT","table_name":"cycle_nights"},{"role":"service_role","allowed":true,"privilege":"TRIGGER","table_name":"cycle_nights"},{"role":"service_role","allowed":true,"privilege":"TRUNCATE","table_name":"cycle_nights"},{"role":"service_role","allowed":true,"privilege":"UPDATE","table_name":"cycle_nights"},{"role":"anon","allowed":true,"privilege":"DELETE","table_name":"cycles"},{"role":"anon","allowed":true,"privilege":"INSERT","table_name":"cycles"},{"role":"anon","allowed":false,"privilege":"REFERENCES","table_name":"cycles"},{"role":"anon","allowed":true,"privilege":"SELECT","table_name":"cycles"},{"role":"anon","allowed":false,"privilege":"TRIGGER","table_name":"cycles"},{"role":"anon","allowed":false,"privilege":"TRUNCATE","table_name":"cycles"},{"role":"anon","allowed":true,"privilege":"UPDATE","table_name":"cycles"},{"role":"authenticated","allowed":true,"privilege":"DELETE","table_name":"cycles"},{"role":"authenticated","allowed":true,"privilege":"INSERT","table_name":"cycles"},{"role":"authenticated","allowed":false,"privilege":"REFERENCES","table_name":"cycles"},{"role":"authenticated","allowed":true,"privilege":"SELECT","table_name":"cycles"},{"role":"authenticated","allowed":false,"privilege":"TRIGGER","table_name":"cycles"},{"role":"authenticated","allowed":false,"privilege":"TRUNCATE","table_name":"cycles"},{"role":"authenticated","allowed":true,"privilege":"UPDATE","table_name":"cycles"},{"role":"service_role","allowed":true,"privilege":"DELETE","table_name":"cycles"},{"role":"service_role","allowed":true,"privilege":"INSERT","table_name":"cycles"},{"role":"service_role","allowed":true,"privilege":"REFERENCES","table_name":"cycles"},{"role":"service_role","allowed":true,"privilege":"SELECT","table_name":"cycles"},{"role":"service_role","allowed":true,"privilege":"TRIGGER","table_name":"cycles"},{"role":"service_role","allowed":true,"privilege":"TRUNCATE","table_name":"cycles"},{"role":"service_role","allowed":true,"privilege":"UPDATE","table_name":"cycles"},{"role":"anon","allowed":false,"privilege":"DELETE","table_name":"edge_rate_limits"},{"role":"anon","allowed":false,"privilege":"INSERT","table_name":"edge_rate_limits"},{"role":"anon","allowed":false,"privilege":"REFERENCES","table_name":"edge_rate_limits"},{"role":"anon","allowed":false,"privilege":"SELECT","table_name":"edge_rate_limits"},{"role":"anon","allowed":false,"privilege":"TRIGGER","table_name":"edge_rate_limits"},{"role":"anon","allowed":false,"privilege":"TRUNCATE","table_name":"edge_rate_limits"},{"role":"anon","allowed":false,"privilege":"UPDATE","table_name":"edge_rate_limits"},{"role":"authenticated","allowed":false,"privilege":"DELETE","table_name":"edge_rate_limits"},{"role":"authenticated","allowed":false,"privilege":"INSERT","table_name":"edge_rate_limits"},{"role":"authenticated","allowed":false,"privilege":"REFERENCES","table_name":"edge_rate_limits"},{"role":"authenticated","allowed":false,"privilege":"SELECT","table_name":"edge_rate_limits"},{"role":"authenticated","allowed":false,"privilege":"TRIGGER","table_name":"edge_rate_limits"},{"role":"authenticated","allowed":false,"privilege":"TRUNCATE","table_name":"edge_rate_limits"},{"role":"authenticated","allowed":false,"privilege":"UPDATE","table_name":"edge_rate_limits"},{"role":"service_role","allowed":true,"privilege":"DELETE","table_name":"edge_rate_limits"},{"role":"service_role","allowed":true,"privilege":"INSERT","table_name":"edge_rate_limits"},{"role":"service_role","allowed":true,"privilege":"REFERENCES","table_name":"edge_rate_limits"},{"role":"service_role","allowed":true,"privilege":"SELECT","table_name":"edge_rate_limits"},{"role":"service_role","allowed":true,"privilege":"TRIGGER","table_name":"edge_rate_limits"},{"role":"service_role","allowed":true,"privilege":"TRUNCATE","table_name":"edge_rate_limits"},{"role":"service_role","allowed":true,"privilege":"UPDATE","table_name":"edge_rate_limits"},{"role":"anon","allowed":true,"privilege":"DELETE","table_name":"entitlements"},{"role":"anon","allowed":true,"privilege":"INSERT","table_name":"entitlements"},{"role":"anon","allowed":false,"privilege":"REFERENCES","table_name":"entitlements"},{"role":"anon","allowed":true,"privilege":"SELECT","table_name":"entitlements"},{"role":"anon","allowed":false,"privilege":"TRIGGER","table_name":"entitlements"},{"role":"anon","allowed":false,"privilege":"TRUNCATE","table_name":"entitlements"},{"role":"anon","allowed":true,"privilege":"UPDATE","table_name":"entitlements"},{"role":"authenticated","allowed":true,"privilege":"DELETE","table_name":"entitlements"},{"role":"authenticated","allowed":true,"privilege":"INSERT","table_name":"entitlements"},{"role":"authenticated","allowed":false,"privilege":"REFERENCES","table_name":"entitlements"},{"role":"authenticated","allowed":true,"privilege":"SELECT","table_name":"entitlements"},{"role":"authenticated","allowed":false,"privilege":"TRIGGER","table_name":"entitlements"},{"role":"authenticated","allowed":false,"privilege":"TRUNCATE","table_name":"entitlements"},{"role":"authenticated","allowed":true,"privilege":"UPDATE","table_name":"entitlements"},{"role":"service_role","allowed":false,"privilege":"DELETE","table_name":"entitlements"},{"role":"service_role","allowed":false,"privilege":"INSERT","table_name":"entitlements"},{"role":"service_role","allowed":false,"privilege":"REFERENCES","table_name":"entitlements"},{"role":"service_role","allowed":true,"privilege":"SELECT","table_name":"entitlements"},{"role":"service_role","allowed":false,"privilege":"TRIGGER","table_name":"entitlements"},{"role":"service_role","allowed":false,"privilege":"TRUNCATE","table_name":"entitlements"},{"role":"service_role","allowed":false,"privilege":"UPDATE","table_name":"entitlements"},{"role":"anon","allowed":true,"privilege":"DELETE","table_name":"growth_events"},{"role":"anon","allowed":true,"privilege":"INSERT","table_name":"growth_events"},{"role":"anon","allowed":false,"privilege":"REFERENCES","table_name":"growth_events"},{"role":"anon","allowed":true,"privilege":"SELECT","table_name":"growth_events"},{"role":"anon","allowed":false,"privilege":"TRIGGER","table_name":"growth_events"},{"role":"anon","allowed":false,"privilege":"TRUNCATE","table_name":"growth_events"},{"role":"anon","allowed":true,"privilege":"UPDATE","table_name":"growth_events"},{"role":"authenticated","allowed":true,"privilege":"DELETE","table_name":"growth_events"},{"role":"authenticated","allowed":true,"privilege":"INSERT","table_name":"growth_events"},{"role":"authenticated","allowed":false,"privilege":"REFERENCES","table_name":"growth_events"},{"role":"authenticated","allowed":true,"privilege":"SELECT","table_name":"growth_events"},{"role":"authenticated","allowed":false,"privilege":"TRIGGER","table_name":"growth_events"},{"role":"authenticated","allowed":false,"privilege":"TRUNCATE","table_name":"growth_events"},{"role":"authenticated","allowed":true,"privilege":"UPDATE","table_name":"growth_events"},{"role":"service_role","allowed":true,"privilege":"DELETE","table_name":"growth_events"},{"role":"service_role","allowed":true,"privilege":"INSERT","table_name":"growth_events"},{"role":"service_role","allowed":true,"privilege":"REFERENCES","table_name":"growth_events"},{"role":"service_role","allowed":true,"privilege":"SELECT","table_name":"growth_events"},{"role":"service_role","allowed":true,"privilege":"TRIGGER","table_name":"growth_events"},{"role":"service_role","allowed":true,"privilege":"TRUNCATE","table_name":"growth_events"},{"role":"service_role","allowed":true,"privilege":"UPDATE","table_name":"growth_events"},{"role":"anon","allowed":false,"privilege":"DELETE","table_name":"health_consent_copy_registry"},{"role":"anon","allowed":false,"privilege":"INSERT","table_name":"health_consent_copy_registry"},{"role":"anon","allowed":false,"privilege":"REFERENCES","table_name":"health_consent_copy_registry"},{"role":"anon","allowed":false,"privilege":"SELECT","table_name":"health_consent_copy_registry"},{"role":"anon","allowed":false,"privilege":"TRIGGER","table_name":"health_consent_copy_registry"},{"role":"anon","allowed":false,"privilege":"TRUNCATE","table_name":"health_consent_copy_registry"},{"role":"anon","allowed":false,"privilege":"UPDATE","table_name":"health_consent_copy_registry"},{"role":"authenticated","allowed":false,"privilege":"DELETE","table_name":"health_consent_copy_registry"},{"role":"authenticated","allowed":false,"privilege":"INSERT","table_name":"health_consent_copy_registry"},{"role":"authenticated","allowed":false,"privilege":"REFERENCES","table_name":"health_consent_copy_registry"},{"role":"authenticated","allowed":false,"privilege":"SELECT","table_name":"health_consent_copy_registry"},{"role":"authenticated","allowed":false,"privilege":"TRIGGER","table_name":"health_consent_copy_registry"},{"role":"authenticated","allowed":false,"privilege":"TRUNCATE","table_name":"health_consent_copy_registry"},{"role":"authenticated","allowed":false,"privilege":"UPDATE","table_name":"health_consent_copy_registry"},{"role":"service_role","allowed":false,"privilege":"DELETE","table_name":"health_consent_copy_registry"},{"role":"service_role","allowed":false,"privilege":"INSERT","table_name":"health_consent_copy_registry"},{"role":"service_role","allowed":false,"privilege":"REFERENCES","table_name":"health_consent_copy_registry"},{"role":"service_role","allowed":false,"privilege":"SELECT","table_name":"health_consent_copy_registry"},{"role":"service_role","allowed":false,"privilege":"TRIGGER","table_name":"health_consent_copy_registry"},{"role":"service_role","allowed":false,"privilege":"TRUNCATE","table_name":"health_consent_copy_registry"},{"role":"service_role","allowed":false,"privilege":"UPDATE","table_name":"health_consent_copy_registry"},{"role":"anon","allowed":false,"privilege":"DELETE","table_name":"health_consent_copy_review_events"},{"role":"anon","allowed":false,"privilege":"INSERT","table_name":"health_consent_copy_review_events"},{"role":"anon","allowed":false,"privilege":"REFERENCES","table_name":"health_consent_copy_review_events"},{"role":"anon","allowed":false,"privilege":"SELECT","table_name":"health_consent_copy_review_events"},{"role":"anon","allowed":false,"privilege":"TRIGGER","table_name":"health_consent_copy_review_events"},{"role":"anon","allowed":false,"privilege":"TRUNCATE","table_name":"health_consent_copy_review_events"},{"role":"anon","allowed":false,"privilege":"UPDATE","table_name":"health_consent_copy_review_events"},{"role":"authenticated","allowed":false,"privilege":"DELETE","table_name":"health_consent_copy_review_events"},{"role":"authenticated","allowed":false,"privilege":"INSERT","table_name":"health_consent_copy_review_events"},{"role":"authenticated","allowed":false,"privilege":"REFERENCES","table_name":"health_consent_copy_review_events"},{"role":"authenticated","allowed":false,"privilege":"SELECT","table_name":"health_consent_copy_review_events"},{"role":"authenticated","allowed":false,"privilege":"TRIGGER","table_name":"health_consent_copy_review_events"},{"role":"authenticated","allowed":false,"privilege":"TRUNCATE","table_name":"health_consent_copy_review_events"},{"role":"authenticated","allowed":false,"privilege":"UPDATE","table_name":"health_consent_copy_review_events"},{"role":"service_role","allowed":false,"privilege":"DELETE","table_name":"health_consent_copy_review_events"},{"role":"service_role","allowed":false,"privilege":"INSERT","table_name":"health_consent_copy_review_events"},{"role":"service_role","allowed":false,"privilege":"REFERENCES","table_name":"health_consent_copy_review_events"},{"role":"service_role","allowed":false,"privilege":"SELECT","table_name":"health_consent_copy_review_events"},{"role":"service_role","allowed":false,"privilege":"TRIGGER","table_name":"health_consent_copy_review_events"},{"role":"service_role","allowed":false,"privilege":"TRUNCATE","table_name":"health_consent_copy_review_events"},{"role":"service_role","allowed":false,"privilege":"UPDATE","table_name":"health_consent_copy_review_events"},{"role":"anon","allowed":false,"privilege":"DELETE","table_name":"health_consent_copy_staging_events"},{"role":"anon","allowed":false,"privilege":"INSERT","table_name":"health_consent_copy_staging_events"},{"role":"anon","allowed":false,"privilege":"REFERENCES","table_name":"health_consent_copy_staging_events"},{"role":"anon","allowed":false,"privilege":"SELECT","table_name":"health_consent_copy_staging_events"},{"role":"anon","allowed":false,"privilege":"TRIGGER","table_name":"health_consent_copy_staging_events"},{"role":"anon","allowed":false,"privilege":"TRUNCATE","table_name":"health_consent_copy_staging_events"},{"role":"anon","allowed":false,"privilege":"UPDATE","table_name":"health_consent_copy_staging_events"},{"role":"authenticated","allowed":false,"privilege":"DELETE","table_name":"health_consent_copy_staging_events"},{"role":"authenticated","allowed":false,"privilege":"INSERT","table_name":"health_consent_copy_staging_events"},{"role":"authenticated","allowed":false,"privilege":"REFERENCES","table_name":"health_consent_copy_staging_events"},{"role":"authenticated","allowed":false,"privilege":"SELECT","table_name":"health_consent_copy_staging_events"},{"role":"authenticated","allowed":false,"privilege":"TRIGGER","table_name":"health_consent_copy_staging_events"},{"role":"authenticated","allowed":false,"privilege":"TRUNCATE","table_name":"health_consent_copy_staging_events"},{"role":"authenticated","allowed":false,"privilege":"UPDATE","table_name":"health_consent_copy_staging_events"},{"role":"service_role","allowed":false,"privilege":"DELETE","table_name":"health_consent_copy_staging_events"},{"role":"service_role","allowed":false,"privilege":"INSERT","table_name":"health_consent_copy_staging_events"},{"role":"service_role","allowed":false,"privilege":"REFERENCES","table_name":"health_consent_copy_staging_events"},{"role":"service_role","allowed":false,"privilege":"SELECT","table_name":"health_consent_copy_staging_events"},{"role":"service_role","allowed":false,"privilege":"TRIGGER","table_name":"health_consent_copy_staging_events"},{"role":"service_role","allowed":false,"privilege":"TRUNCATE","table_name":"health_consent_copy_staging_events"},{"role":"service_role","allowed":false,"privilege":"UPDATE","table_name":"health_consent_copy_staging_events"},{"role":"anon","allowed":false,"privilege":"DELETE","table_name":"health_consent_withdrawal_operations"},{"role":"anon","allowed":false,"privilege":"INSERT","table_name":"health_consent_withdrawal_operations"},{"role":"anon","allowed":false,"privilege":"REFERENCES","table_name":"health_consent_withdrawal_operations"},{"role":"anon","allowed":false,"privilege":"SELECT","table_name":"health_consent_withdrawal_operations"},{"role":"anon","allowed":false,"privilege":"TRIGGER","table_name":"health_consent_withdrawal_operations"},{"role":"anon","allowed":false,"privilege":"TRUNCATE","table_name":"health_consent_withdrawal_operations"},{"role":"anon","allowed":false,"privilege":"UPDATE","table_name":"health_consent_withdrawal_operations"},{"role":"authenticated","allowed":false,"privilege":"DELETE","table_name":"health_consent_withdrawal_operations"},{"role":"authenticated","allowed":false,"privilege":"INSERT","table_name":"health_consent_withdrawal_operations"},{"role":"authenticated","allowed":false,"privilege":"REFERENCES","table_name":"health_consent_withdrawal_operations"},{"role":"authenticated","allowed":false,"privilege":"SELECT","table_name":"health_consent_withdrawal_operations"},{"role":"authenticated","allowed":false,"privilege":"TRIGGER","table_name":"health_consent_withdrawal_operations"},{"role":"authenticated","allowed":false,"privilege":"TRUNCATE","table_name":"health_consent_withdrawal_operations"},{"role":"authenticated","allowed":false,"privilege":"UPDATE","table_name":"health_consent_withdrawal_operations"},{"role":"service_role","allowed":false,"privilege":"DELETE","table_name":"health_consent_withdrawal_operations"},{"role":"service_role","allowed":false,"privilege":"INSERT","table_name":"health_consent_withdrawal_operations"},{"role":"service_role","allowed":false,"privilege":"REFERENCES","table_name":"health_consent_withdrawal_operations"},{"role":"service_role","allowed":false,"privilege":"SELECT","table_name":"health_consent_withdrawal_operations"},{"role":"service_role","allowed":false,"privilege":"TRIGGER","table_name":"health_consent_withdrawal_operations"},{"role":"service_role","allowed":false,"privilege":"TRUNCATE","table_name":"health_consent_withdrawal_operations"},{"role":"service_role","allowed":false,"privilege":"UPDATE","table_name":"health_consent_withdrawal_operations"},{"role":"anon","allowed":false,"privilege":"DELETE","table_name":"health_consent_withdrawal_steps"},{"role":"anon","allowed":false,"privilege":"INSERT","table_name":"health_consent_withdrawal_steps"},{"role":"anon","allowed":false,"privilege":"REFERENCES","table_name":"health_consent_withdrawal_steps"},{"role":"anon","allowed":false,"privilege":"SELECT","table_name":"health_consent_withdrawal_steps"},{"role":"anon","allowed":false,"privilege":"TRIGGER","table_name":"health_consent_withdrawal_steps"},{"role":"anon","allowed":false,"privilege":"TRUNCATE","table_name":"health_consent_withdrawal_steps"},{"role":"anon","allowed":false,"privilege":"UPDATE","table_name":"health_consent_withdrawal_steps"},{"role":"authenticated","allowed":false,"privilege":"DELETE","table_name":"health_consent_withdrawal_steps"},{"role":"authenticated","allowed":false,"privilege":"INSERT","table_name":"health_consent_withdrawal_steps"},{"role":"authenticated","allowed":false,"privilege":"REFERENCES","table_name":"health_consent_withdrawal_steps"},{"role":"authenticated","allowed":false,"privilege":"SELECT","table_name":"health_consent_withdrawal_steps"},{"role":"authenticated","allowed":false,"privilege":"TRIGGER","table_name":"health_consent_withdrawal_steps"},{"role":"authenticated","allowed":false,"privilege":"TRUNCATE","table_name":"health_consent_withdrawal_steps"},{"role":"authenticated","allowed":false,"privilege":"UPDATE","table_name":"health_consent_withdrawal_steps"},{"role":"service_role","allowed":false,"privilege":"DELETE","table_name":"health_consent_withdrawal_steps"},{"role":"service_role","allowed":false,"privilege":"INSERT","table_name":"health_consent_withdrawal_steps"},{"role":"service_role","allowed":false,"privilege":"REFERENCES","table_name":"health_consent_withdrawal_steps"},{"role":"service_role","allowed":false,"privilege":"SELECT","table_name":"health_consent_withdrawal_steps"},{"role":"service_role","allowed":false,"privilege":"TRIGGER","table_name":"health_consent_withdrawal_steps"},{"role":"service_role","allowed":false,"privilege":"TRUNCATE","table_name":"health_consent_withdrawal_steps"},{"role":"service_role","allowed":false,"privilege":"UPDATE","table_name":"health_consent_withdrawal_steps"},{"role":"anon","allowed":false,"privilege":"DELETE","table_name":"health_dependent_consent_operations"},{"role":"anon","allowed":false,"privilege":"INSERT","table_name":"health_dependent_consent_operations"},{"role":"anon","allowed":false,"privilege":"REFERENCES","table_name":"health_dependent_consent_operations"},{"role":"anon","allowed":false,"privilege":"SELECT","table_name":"health_dependent_consent_operations"},{"role":"anon","allowed":false,"privilege":"TRIGGER","table_name":"health_dependent_consent_operations"},{"role":"anon","allowed":false,"privilege":"TRUNCATE","table_name":"health_dependent_consent_operations"},{"role":"anon","allowed":false,"privilege":"UPDATE","table_name":"health_dependent_consent_operations"},{"role":"authenticated","allowed":false,"privilege":"DELETE","table_name":"health_dependent_consent_operations"},{"role":"authenticated","allowed":false,"privilege":"INSERT","table_name":"health_dependent_consent_operations"},{"role":"authenticated","allowed":false,"privilege":"REFERENCES","table_name":"health_dependent_consent_operations"},{"role":"authenticated","allowed":false,"privilege":"SELECT","table_name":"health_dependent_consent_operations"},{"role":"authenticated","allowed":false,"privilege":"TRIGGER","table_name":"health_dependent_consent_operations"},{"role":"authenticated","allowed":false,"privilege":"TRUNCATE","table_name":"health_dependent_consent_operations"},{"role":"authenticated","allowed":false,"privilege":"UPDATE","table_name":"health_dependent_consent_operations"},{"role":"service_role","allowed":false,"privilege":"DELETE","table_name":"health_dependent_consent_operations"},{"role":"service_role","allowed":false,"privilege":"INSERT","table_name":"health_dependent_consent_operations"},{"role":"service_role","allowed":false,"privilege":"REFERENCES","table_name":"health_dependent_consent_operations"},{"role":"service_role","allowed":false,"privilege":"SELECT","table_name":"health_dependent_consent_operations"},{"role":"service_role","allowed":false,"privilege":"TRIGGER","table_name":"health_dependent_consent_operations"},{"role":"service_role","allowed":false,"privilege":"TRUNCATE","table_name":"health_dependent_consent_operations"},{"role":"service_role","allowed":false,"privilege":"UPDATE","table_name":"health_dependent_consent_operations"},{"role":"anon","allowed":false,"privilege":"DELETE","table_name":"health_dependent_consent_states"},{"role":"anon","allowed":false,"privilege":"INSERT","table_name":"health_dependent_consent_states"},{"role":"anon","allowed":false,"privilege":"REFERENCES","table_name":"health_dependent_consent_states"},{"role":"anon","allowed":false,"privilege":"SELECT","table_name":"health_dependent_consent_states"},{"role":"anon","allowed":false,"privilege":"TRIGGER","table_name":"health_dependent_consent_states"},{"role":"anon","allowed":false,"privilege":"TRUNCATE","table_name":"health_dependent_consent_states"},{"role":"anon","allowed":false,"privilege":"UPDATE","table_name":"health_dependent_consent_states"},{"role":"authenticated","allowed":false,"privilege":"DELETE","table_name":"health_dependent_consent_states"},{"role":"authenticated","allowed":false,"privilege":"INSERT","table_name":"health_dependent_consent_states"},{"role":"authenticated","allowed":false,"privilege":"REFERENCES","table_name":"health_dependent_consent_states"},{"role":"authenticated","allowed":false,"privilege":"SELECT","table_name":"health_dependent_consent_states"},{"role":"authenticated","allowed":false,"privilege":"TRIGGER","table_name":"health_dependent_consent_states"},{"role":"authenticated","allowed":false,"privilege":"TRUNCATE","table_name":"health_dependent_consent_states"},{"role":"authenticated","allowed":false,"privilege":"UPDATE","table_name":"health_dependent_consent_states"},{"role":"service_role","allowed":false,"privilege":"DELETE","table_name":"health_dependent_consent_states"},{"role":"service_role","allowed":false,"privilege":"INSERT","table_name":"health_dependent_consent_states"},{"role":"service_role","allowed":false,"privilege":"REFERENCES","table_name":"health_dependent_consent_states"},{"role":"service_role","allowed":false,"privilege":"SELECT","table_name":"health_dependent_consent_states"},{"role":"service_role","allowed":false,"privilege":"TRIGGER","table_name":"health_dependent_consent_states"},{"role":"service_role","allowed":false,"privilege":"TRUNCATE","table_name":"health_dependent_consent_states"},{"role":"service_role","allowed":false,"privilege":"UPDATE","table_name":"health_dependent_consent_states"},{"role":"anon","allowed":false,"privilege":"DELETE","table_name":"health_processing_states"},{"role":"anon","allowed":false,"privilege":"INSERT","table_name":"health_processing_states"},{"role":"anon","allowed":false,"privilege":"REFERENCES","table_name":"health_processing_states"},{"role":"anon","allowed":false,"privilege":"SELECT","table_name":"health_processing_states"},{"role":"anon","allowed":false,"privilege":"TRIGGER","table_name":"health_processing_states"},{"role":"anon","allowed":false,"privilege":"TRUNCATE","table_name":"health_processing_states"},{"role":"anon","allowed":false,"privilege":"UPDATE","table_name":"health_processing_states"},{"role":"authenticated","allowed":false,"privilege":"DELETE","table_name":"health_processing_states"},{"role":"authenticated","allowed":false,"privilege":"INSERT","table_name":"health_processing_states"},{"role":"authenticated","allowed":false,"privilege":"REFERENCES","table_name":"health_processing_states"},{"role":"authenticated","allowed":false,"privilege":"SELECT","table_name":"health_processing_states"},{"role":"authenticated","allowed":false,"privilege":"TRIGGER","table_name":"health_processing_states"},{"role":"authenticated","allowed":false,"privilege":"TRUNCATE","table_name":"health_processing_states"},{"role":"authenticated","allowed":false,"privilege":"UPDATE","table_name":"health_processing_states"},{"role":"service_role","allowed":false,"privilege":"DELETE","table_name":"health_processing_states"},{"role":"service_role","allowed":false,"privilege":"INSERT","table_name":"health_processing_states"},{"role":"service_role","allowed":false,"privilege":"REFERENCES","table_name":"health_processing_states"},{"role":"service_role","allowed":false,"privilege":"SELECT","table_name":"health_processing_states"},{"role":"service_role","allowed":false,"privilege":"TRIGGER","table_name":"health_processing_states"},{"role":"service_role","allowed":false,"privilege":"TRUNCATE","table_name":"health_processing_states"},{"role":"service_role","allowed":false,"privilege":"UPDATE","table_name":"health_processing_states"},{"role":"anon","allowed":false,"privilege":"DELETE","table_name":"ingredient_pao_defaults"},{"role":"anon","allowed":false,"privilege":"INSERT","table_name":"ingredient_pao_defaults"},{"role":"anon","allowed":false,"privilege":"REFERENCES","table_name":"ingredient_pao_defaults"},{"role":"anon","allowed":false,"privilege":"SELECT","table_name":"ingredient_pao_defaults"},{"role":"anon","allowed":false,"privilege":"TRIGGER","table_name":"ingredient_pao_defaults"},{"role":"anon","allowed":false,"privilege":"TRUNCATE","table_name":"ingredient_pao_defaults"},{"role":"anon","allowed":false,"privilege":"UPDATE","table_name":"ingredient_pao_defaults"},{"role":"authenticated","allowed":false,"privilege":"DELETE","table_name":"ingredient_pao_defaults"},{"role":"authenticated","allowed":false,"privilege":"INSERT","table_name":"ingredient_pao_defaults"},{"role":"authenticated","allowed":false,"privilege":"REFERENCES","table_name":"ingredient_pao_defaults"},{"role":"authenticated","allowed":false,"privilege":"SELECT","table_name":"ingredient_pao_defaults"},{"role":"authenticated","allowed":false,"privilege":"TRIGGER","table_name":"ingredient_pao_defaults"},{"role":"authenticated","allowed":false,"privilege":"TRUNCATE","table_name":"ingredient_pao_defaults"},{"role":"authenticated","allowed":false,"privilege":"UPDATE","table_name":"ingredient_pao_defaults"},{"role":"service_role","allowed":false,"privilege":"DELETE","table_name":"ingredient_pao_defaults"},{"role":"service_role","allowed":false,"privilege":"INSERT","table_name":"ingredient_pao_defaults"},{"role":"service_role","allowed":false,"privilege":"REFERENCES","table_name":"ingredient_pao_defaults"},{"role":"service_role","allowed":false,"privilege":"SELECT","table_name":"ingredient_pao_defaults"},{"role":"service_role","allowed":false,"privilege":"TRIGGER","table_name":"ingredient_pao_defaults"},{"role":"service_role","allowed":false,"privilege":"TRUNCATE","table_name":"ingredient_pao_defaults"},{"role":"service_role","allowed":false,"privilege":"UPDATE","table_name":"ingredient_pao_defaults"},{"role":"anon","allowed":false,"privilege":"DELETE","table_name":"ingredient_synonyms"},{"role":"anon","allowed":false,"privilege":"INSERT","table_name":"ingredient_synonyms"},{"role":"anon","allowed":false,"privilege":"REFERENCES","table_name":"ingredient_synonyms"},{"role":"anon","allowed":false,"privilege":"SELECT","table_name":"ingredient_synonyms"},{"role":"anon","allowed":false,"privilege":"TRIGGER","table_name":"ingredient_synonyms"},{"role":"anon","allowed":false,"privilege":"TRUNCATE","table_name":"ingredient_synonyms"},{"role":"anon","allowed":false,"privilege":"UPDATE","table_name":"ingredient_synonyms"},{"role":"authenticated","allowed":false,"privilege":"DELETE","table_name":"ingredient_synonyms"},{"role":"authenticated","allowed":false,"privilege":"INSERT","table_name":"ingredient_synonyms"},{"role":"authenticated","allowed":false,"privilege":"REFERENCES","table_name":"ingredient_synonyms"},{"role":"authenticated","allowed":true,"privilege":"SELECT","table_name":"ingredient_synonyms"},{"role":"authenticated","allowed":false,"privilege":"TRIGGER","table_name":"ingredient_synonyms"},{"role":"authenticated","allowed":false,"privilege":"TRUNCATE","table_name":"ingredient_synonyms"},{"role":"authenticated","allowed":false,"privilege":"UPDATE","table_name":"ingredient_synonyms"},{"role":"service_role","allowed":false,"privilege":"DELETE","table_name":"ingredient_synonyms"},{"role":"service_role","allowed":false,"privilege":"INSERT","table_name":"ingredient_synonyms"},{"role":"service_role","allowed":false,"privilege":"REFERENCES","table_name":"ingredient_synonyms"},{"role":"service_role","allowed":false,"privilege":"SELECT","table_name":"ingredient_synonyms"},{"role":"service_role","allowed":false,"privilege":"TRIGGER","table_name":"ingredient_synonyms"},{"role":"service_role","allowed":false,"privilege":"TRUNCATE","table_name":"ingredient_synonyms"},{"role":"service_role","allowed":false,"privilege":"UPDATE","table_name":"ingredient_synonyms"},{"role":"anon","allowed":false,"privilege":"DELETE","table_name":"ingredient_tag_assignments"},{"role":"anon","allowed":false,"privilege":"INSERT","table_name":"ingredient_tag_assignments"},{"role":"anon","allowed":false,"privilege":"REFERENCES","table_name":"ingredient_tag_assignments"},{"role":"anon","allowed":false,"privilege":"SELECT","table_name":"ingredient_tag_assignments"},{"role":"anon","allowed":false,"privilege":"TRIGGER","table_name":"ingredient_tag_assignments"},{"role":"anon","allowed":false,"privilege":"TRUNCATE","table_name":"ingredient_tag_assignments"},{"role":"anon","allowed":false,"privilege":"UPDATE","table_name":"ingredient_tag_assignments"},{"role":"authenticated","allowed":false,"privilege":"DELETE","table_name":"ingredient_tag_assignments"},{"role":"authenticated","allowed":false,"privilege":"INSERT","table_name":"ingredient_tag_assignments"},{"role":"authenticated","allowed":false,"privilege":"REFERENCES","table_name":"ingredient_tag_assignments"},{"role":"authenticated","allowed":true,"privilege":"SELECT","table_name":"ingredient_tag_assignments"},{"role":"authenticated","allowed":false,"privilege":"TRIGGER","table_name":"ingredient_tag_assignments"},{"role":"authenticated","allowed":false,"privilege":"TRUNCATE","table_name":"ingredient_tag_assignments"},{"role":"authenticated","allowed":false,"privilege":"UPDATE","table_name":"ingredient_tag_assignments"},{"role":"service_role","allowed":false,"privilege":"DELETE","table_name":"ingredient_tag_assignments"},{"role":"service_role","allowed":false,"privilege":"INSERT","table_name":"ingredient_tag_assignments"},{"role":"service_role","allowed":false,"privilege":"REFERENCES","table_name":"ingredient_tag_assignments"},{"role":"service_role","allowed":false,"privilege":"SELECT","table_name":"ingredient_tag_assignments"},{"role":"service_role","allowed":false,"privilege":"TRIGGER","table_name":"ingredient_tag_assignments"},{"role":"service_role","allowed":false,"privilege":"TRUNCATE","table_name":"ingredient_tag_assignments"},{"role":"service_role","allowed":false,"privilege":"UPDATE","table_name":"ingredient_tag_assignments"},{"role":"anon","allowed":false,"privilege":"DELETE","table_name":"ingredient_tag_definitions"},{"role":"anon","allowed":false,"privilege":"INSERT","table_name":"ingredient_tag_definitions"},{"role":"anon","allowed":false,"privilege":"REFERENCES","table_name":"ingredient_tag_definitions"},{"role":"anon","allowed":false,"privilege":"SELECT","table_name":"ingredient_tag_definitions"},{"role":"anon","allowed":false,"privilege":"TRIGGER","table_name":"ingredient_tag_definitions"},{"role":"anon","allowed":false,"privilege":"TRUNCATE","table_name":"ingredient_tag_definitions"},{"role":"anon","allowed":false,"privilege":"UPDATE","table_name":"ingredient_tag_definitions"},{"role":"authenticated","allowed":false,"privilege":"DELETE","table_name":"ingredient_tag_definitions"},{"role":"authenticated","allowed":false,"privilege":"INSERT","table_name":"ingredient_tag_definitions"},{"role":"authenticated","allowed":false,"privilege":"REFERENCES","table_name":"ingredient_tag_definitions"},{"role":"authenticated","allowed":false,"privilege":"SELECT","table_name":"ingredient_tag_definitions"},{"role":"authenticated","allowed":false,"privilege":"TRIGGER","table_name":"ingredient_tag_definitions"},{"role":"authenticated","allowed":false,"privilege":"TRUNCATE","table_name":"ingredient_tag_definitions"},{"role":"authenticated","allowed":false,"privilege":"UPDATE","table_name":"ingredient_tag_definitions"},{"role":"service_role","allowed":false,"privilege":"DELETE","table_name":"ingredient_tag_definitions"},{"role":"service_role","allowed":false,"privilege":"INSERT","table_name":"ingredient_tag_definitions"},{"role":"service_role","allowed":false,"privilege":"REFERENCES","table_name":"ingredient_tag_definitions"},{"role":"service_role","allowed":false,"privilege":"SELECT","table_name":"ingredient_tag_definitions"},{"role":"service_role","allowed":false,"privilege":"TRIGGER","table_name":"ingredient_tag_definitions"},{"role":"service_role","allowed":false,"privilege":"TRUNCATE","table_name":"ingredient_tag_definitions"},{"role":"service_role","allowed":false,"privilege":"UPDATE","table_name":"ingredient_tag_definitions"},{"role":"anon","allowed":false,"privilege":"DELETE","table_name":"ingredient_tags"},{"role":"anon","allowed":false,"privilege":"INSERT","table_name":"ingredient_tags"},{"role":"anon","allowed":false,"privilege":"REFERENCES","table_name":"ingredient_tags"},{"role":"anon","allowed":false,"privilege":"SELECT","table_name":"ingredient_tags"},{"role":"anon","allowed":false,"privilege":"TRIGGER","table_name":"ingredient_tags"},{"role":"anon","allowed":false,"privilege":"TRUNCATE","table_name":"ingredient_tags"},{"role":"anon","allowed":false,"privilege":"UPDATE","table_name":"ingredient_tags"},{"role":"authenticated","allowed":false,"privilege":"DELETE","table_name":"ingredient_tags"},{"role":"authenticated","allowed":false,"privilege":"INSERT","table_name":"ingredient_tags"},{"role":"authenticated","allowed":false,"privilege":"REFERENCES","table_name":"ingredient_tags"},{"role":"authenticated","allowed":false,"privilege":"SELECT","table_name":"ingredient_tags"},{"role":"authenticated","allowed":false,"privilege":"TRIGGER","table_name":"ingredient_tags"},{"role":"authenticated","allowed":false,"privilege":"TRUNCATE","table_name":"ingredient_tags"},{"role":"authenticated","allowed":false,"privilege":"UPDATE","table_name":"ingredient_tags"},{"role":"service_role","allowed":false,"privilege":"DELETE","table_name":"ingredient_tags"},{"role":"service_role","allowed":false,"privilege":"INSERT","table_name":"ingredient_tags"},{"role":"service_role","allowed":false,"privilege":"REFERENCES","table_name":"ingredient_tags"},{"role":"service_role","allowed":false,"privilege":"SELECT","table_name":"ingredient_tags"},{"role":"service_role","allowed":false,"privilege":"TRIGGER","table_name":"ingredient_tags"},{"role":"service_role","allowed":false,"privilege":"TRUNCATE","table_name":"ingredient_tags"},{"role":"service_role","allowed":false,"privilege":"UPDATE","table_name":"ingredient_tags"},{"role":"anon","allowed":false,"privilege":"DELETE","table_name":"ingredients"},{"role":"anon","allowed":false,"privilege":"INSERT","table_name":"ingredients"},{"role":"anon","allowed":false,"privilege":"REFERENCES","table_name":"ingredients"},{"role":"anon","allowed":false,"privilege":"SELECT","table_name":"ingredients"},{"role":"anon","allowed":false,"privilege":"TRIGGER","table_name":"ingredients"},{"role":"anon","allowed":false,"privilege":"TRUNCATE","table_name":"ingredients"},{"role":"anon","allowed":false,"privilege":"UPDATE","table_name":"ingredients"},{"role":"authenticated","allowed":false,"privilege":"DELETE","table_name":"ingredients"},{"role":"authenticated","allowed":false,"privilege":"INSERT","table_name":"ingredients"},{"role":"authenticated","allowed":false,"privilege":"REFERENCES","table_name":"ingredients"},{"role":"authenticated","allowed":true,"privilege":"SELECT","table_name":"ingredients"},{"role":"authenticated","allowed":false,"privilege":"TRIGGER","table_name":"ingredients"},{"role":"authenticated","allowed":false,"privilege":"TRUNCATE","table_name":"ingredients"},{"role":"authenticated","allowed":false,"privilege":"UPDATE","table_name":"ingredients"},{"role":"service_role","allowed":false,"privilege":"DELETE","table_name":"ingredients"},{"role":"service_role","allowed":false,"privilege":"INSERT","table_name":"ingredients"},{"role":"service_role","allowed":false,"privilege":"REFERENCES","table_name":"ingredients"},{"role":"service_role","allowed":false,"privilege":"SELECT","table_name":"ingredients"},{"role":"service_role","allowed":false,"privilege":"TRIGGER","table_name":"ingredients"},{"role":"service_role","allowed":false,"privilege":"TRUNCATE","table_name":"ingredients"},{"role":"service_role","allowed":false,"privilege":"UPDATE","table_name":"ingredients"},{"role":"anon","allowed":false,"privilege":"DELETE","table_name":"mobile_outbox_receipts"},{"role":"anon","allowed":false,"privilege":"INSERT","table_name":"mobile_outbox_receipts"},{"role":"anon","allowed":false,"privilege":"REFERENCES","table_name":"mobile_outbox_receipts"},{"role":"anon","allowed":false,"privilege":"SELECT","table_name":"mobile_outbox_receipts"},{"role":"anon","allowed":false,"privilege":"TRIGGER","table_name":"mobile_outbox_receipts"},{"role":"anon","allowed":false,"privilege":"TRUNCATE","table_name":"mobile_outbox_receipts"},{"role":"anon","allowed":false,"privilege":"UPDATE","table_name":"mobile_outbox_receipts"},{"role":"authenticated","allowed":false,"privilege":"DELETE","table_name":"mobile_outbox_receipts"},{"role":"authenticated","allowed":false,"privilege":"INSERT","table_name":"mobile_outbox_receipts"},{"role":"authenticated","allowed":false,"privilege":"REFERENCES","table_name":"mobile_outbox_receipts"},{"role":"authenticated","allowed":false,"privilege":"SELECT","table_name":"mobile_outbox_receipts"},{"role":"authenticated","allowed":false,"privilege":"TRIGGER","table_name":"mobile_outbox_receipts"},{"role":"authenticated","allowed":false,"privilege":"TRUNCATE","table_name":"mobile_outbox_receipts"},{"role":"authenticated","allowed":false,"privilege":"UPDATE","table_name":"mobile_outbox_receipts"},{"role":"service_role","allowed":false,"privilege":"DELETE","table_name":"mobile_outbox_receipts"},{"role":"service_role","allowed":false,"privilege":"INSERT","table_name":"mobile_outbox_receipts"},{"role":"service_role","allowed":false,"privilege":"REFERENCES","table_name":"mobile_outbox_receipts"},{"role":"service_role","allowed":false,"privilege":"SELECT","table_name":"mobile_outbox_receipts"},{"role":"service_role","allowed":false,"privilege":"TRIGGER","table_name":"mobile_outbox_receipts"},{"role":"service_role","allowed":false,"privilege":"TRUNCATE","table_name":"mobile_outbox_receipts"},{"role":"service_role","allowed":false,"privilege":"UPDATE","table_name":"mobile_outbox_receipts"},{"role":"anon","allowed":true,"privilege":"DELETE","table_name":"notification_log"},{"role":"anon","allowed":false,"privilege":"INSERT","table_name":"notification_log"},{"role":"anon","allowed":false,"privilege":"REFERENCES","table_name":"notification_log"},{"role":"anon","allowed":true,"privilege":"SELECT","table_name":"notification_log"},{"role":"anon","allowed":false,"privilege":"TRIGGER","table_name":"notification_log"},{"role":"anon","allowed":false,"privilege":"TRUNCATE","table_name":"notification_log"},{"role":"anon","allowed":true,"privilege":"UPDATE","table_name":"notification_log"},{"role":"authenticated","allowed":true,"privilege":"DELETE","table_name":"notification_log"},{"role":"authenticated","allowed":false,"privilege":"INSERT","table_name":"notification_log"},{"role":"authenticated","allowed":false,"privilege":"REFERENCES","table_name":"notification_log"},{"role":"authenticated","allowed":true,"privilege":"SELECT","table_name":"notification_log"},{"role":"authenticated","allowed":false,"privilege":"TRIGGER","table_name":"notification_log"},{"role":"authenticated","allowed":false,"privilege":"TRUNCATE","table_name":"notification_log"},{"role":"authenticated","allowed":true,"privilege":"UPDATE","table_name":"notification_log"},{"role":"service_role","allowed":true,"privilege":"DELETE","table_name":"notification_log"},{"role":"service_role","allowed":true,"privilege":"INSERT","table_name":"notification_log"},{"role":"service_role","allowed":true,"privilege":"REFERENCES","table_name":"notification_log"},{"role":"service_role","allowed":true,"privilege":"SELECT","table_name":"notification_log"},{"role":"service_role","allowed":true,"privilege":"TRIGGER","table_name":"notification_log"},{"role":"service_role","allowed":true,"privilege":"TRUNCATE","table_name":"notification_log"},{"role":"service_role","allowed":true,"privilege":"UPDATE","table_name":"notification_log"},{"role":"anon","allowed":true,"privilege":"DELETE","table_name":"notification_preferences"},{"role":"anon","allowed":true,"privilege":"INSERT","table_name":"notification_preferences"},{"role":"anon","allowed":false,"privilege":"REFERENCES","table_name":"notification_preferences"},{"role":"anon","allowed":true,"privilege":"SELECT","table_name":"notification_preferences"},{"role":"anon","allowed":false,"privilege":"TRIGGER","table_name":"notification_preferences"},{"role":"anon","allowed":false,"privilege":"TRUNCATE","table_name":"notification_preferences"},{"role":"anon","allowed":true,"privilege":"UPDATE","table_name":"notification_preferences"},{"role":"authenticated","allowed":true,"privilege":"DELETE","table_name":"notification_preferences"},{"role":"authenticated","allowed":true,"privilege":"INSERT","table_name":"notification_preferences"},{"role":"authenticated","allowed":false,"privilege":"REFERENCES","table_name":"notification_preferences"},{"role":"authenticated","allowed":true,"privilege":"SELECT","table_name":"notification_preferences"},{"role":"authenticated","allowed":false,"privilege":"TRIGGER","table_name":"notification_preferences"},{"role":"authenticated","allowed":false,"privilege":"TRUNCATE","table_name":"notification_preferences"},{"role":"authenticated","allowed":true,"privilege":"UPDATE","table_name":"notification_preferences"},{"role":"service_role","allowed":true,"privilege":"DELETE","table_name":"notification_preferences"},{"role":"service_role","allowed":true,"privilege":"INSERT","table_name":"notification_preferences"},{"role":"service_role","allowed":true,"privilege":"REFERENCES","table_name":"notification_preferences"},{"role":"service_role","allowed":true,"privilege":"SELECT","table_name":"notification_preferences"},{"role":"service_role","allowed":true,"privilege":"TRIGGER","table_name":"notification_preferences"},{"role":"service_role","allowed":true,"privilege":"TRUNCATE","table_name":"notification_preferences"},{"role":"service_role","allowed":true,"privilege":"UPDATE","table_name":"notification_preferences"},{"role":"anon","allowed":false,"privilege":"DELETE","table_name":"obf_contribution_queue"},{"role":"anon","allowed":false,"privilege":"INSERT","table_name":"obf_contribution_queue"},{"role":"anon","allowed":false,"privilege":"REFERENCES","table_name":"obf_contribution_queue"},{"role":"anon","allowed":false,"privilege":"SELECT","table_name":"obf_contribution_queue"},{"role":"anon","allowed":false,"privilege":"TRIGGER","table_name":"obf_contribution_queue"},{"role":"anon","allowed":false,"privilege":"TRUNCATE","table_name":"obf_contribution_queue"},{"role":"anon","allowed":false,"privilege":"UPDATE","table_name":"obf_contribution_queue"},{"role":"authenticated","allowed":false,"privilege":"DELETE","table_name":"obf_contribution_queue"},{"role":"authenticated","allowed":false,"privilege":"INSERT","table_name":"obf_contribution_queue"},{"role":"authenticated","allowed":false,"privilege":"REFERENCES","table_name":"obf_contribution_queue"},{"role":"authenticated","allowed":false,"privilege":"SELECT","table_name":"obf_contribution_queue"},{"role":"authenticated","allowed":false,"privilege":"TRIGGER","table_name":"obf_contribution_queue"},{"role":"authenticated","allowed":false,"privilege":"TRUNCATE","table_name":"obf_contribution_queue"},{"role":"authenticated","allowed":false,"privilege":"UPDATE","table_name":"obf_contribution_queue"},{"role":"service_role","allowed":false,"privilege":"DELETE","table_name":"obf_contribution_queue"},{"role":"service_role","allowed":false,"privilege":"INSERT","table_name":"obf_contribution_queue"},{"role":"service_role","allowed":false,"privilege":"REFERENCES","table_name":"obf_contribution_queue"},{"role":"service_role","allowed":false,"privilege":"SELECT","table_name":"obf_contribution_queue"},{"role":"service_role","allowed":false,"privilege":"TRIGGER","table_name":"obf_contribution_queue"},{"role":"service_role","allowed":false,"privilege":"TRUNCATE","table_name":"obf_contribution_queue"},{"role":"service_role","allowed":false,"privilege":"UPDATE","table_name":"obf_contribution_queue"},{"role":"anon","allowed":false,"privilege":"DELETE","table_name":"order_attributions"},{"role":"anon","allowed":false,"privilege":"INSERT","table_name":"order_attributions"},{"role":"anon","allowed":false,"privilege":"REFERENCES","table_name":"order_attributions"},{"role":"anon","allowed":false,"privilege":"SELECT","table_name":"order_attributions"},{"role":"anon","allowed":false,"privilege":"TRIGGER","table_name":"order_attributions"},{"role":"anon","allowed":false,"privilege":"TRUNCATE","table_name":"order_attributions"},{"role":"anon","allowed":false,"privilege":"UPDATE","table_name":"order_attributions"},{"role":"authenticated","allowed":false,"privilege":"DELETE","table_name":"order_attributions"},{"role":"authenticated","allowed":false,"privilege":"INSERT","table_name":"order_attributions"},{"role":"authenticated","allowed":false,"privilege":"REFERENCES","table_name":"order_attributions"},{"role":"authenticated","allowed":false,"privilege":"SELECT","table_name":"order_attributions"},{"role":"authenticated","allowed":false,"privilege":"TRIGGER","table_name":"order_attributions"},{"role":"authenticated","allowed":false,"privilege":"TRUNCATE","table_name":"order_attributions"},{"role":"authenticated","allowed":false,"privilege":"UPDATE","table_name":"order_attributions"},{"role":"service_role","allowed":true,"privilege":"DELETE","table_name":"order_attributions"},{"role":"service_role","allowed":false,"privilege":"INSERT","table_name":"order_attributions"},{"role":"service_role","allowed":false,"privilege":"REFERENCES","table_name":"order_attributions"},{"role":"service_role","allowed":true,"privilege":"SELECT","table_name":"order_attributions"},{"role":"service_role","allowed":false,"privilege":"TRIGGER","table_name":"order_attributions"},{"role":"service_role","allowed":false,"privilege":"TRUNCATE","table_name":"order_attributions"},{"role":"service_role","allowed":false,"privilege":"UPDATE","table_name":"order_attributions"},{"role":"anon","allowed":true,"privilege":"DELETE","table_name":"photo_trend"},{"role":"anon","allowed":true,"privilege":"INSERT","table_name":"photo_trend"},{"role":"anon","allowed":false,"privilege":"REFERENCES","table_name":"photo_trend"},{"role":"anon","allowed":true,"privilege":"SELECT","table_name":"photo_trend"},{"role":"anon","allowed":false,"privilege":"TRIGGER","table_name":"photo_trend"},{"role":"anon","allowed":false,"privilege":"TRUNCATE","table_name":"photo_trend"},{"role":"anon","allowed":true,"privilege":"UPDATE","table_name":"photo_trend"},{"role":"authenticated","allowed":true,"privilege":"DELETE","table_name":"photo_trend"},{"role":"authenticated","allowed":true,"privilege":"INSERT","table_name":"photo_trend"},{"role":"authenticated","allowed":false,"privilege":"REFERENCES","table_name":"photo_trend"},{"role":"authenticated","allowed":true,"privilege":"SELECT","table_name":"photo_trend"},{"role":"authenticated","allowed":false,"privilege":"TRIGGER","table_name":"photo_trend"},{"role":"authenticated","allowed":false,"privilege":"TRUNCATE","table_name":"photo_trend"},{"role":"authenticated","allowed":true,"privilege":"UPDATE","table_name":"photo_trend"},{"role":"service_role","allowed":true,"privilege":"DELETE","table_name":"photo_trend"},{"role":"service_role","allowed":true,"privilege":"INSERT","table_name":"photo_trend"},{"role":"service_role","allowed":true,"privilege":"REFERENCES","table_name":"photo_trend"},{"role":"service_role","allowed":true,"privilege":"SELECT","table_name":"photo_trend"},{"role":"service_role","allowed":true,"privilege":"TRIGGER","table_name":"photo_trend"},{"role":"service_role","allowed":true,"privilege":"TRUNCATE","table_name":"photo_trend"},{"role":"service_role","allowed":true,"privilege":"UPDATE","table_name":"photo_trend"},{"role":"anon","allowed":false,"privilege":"DELETE","table_name":"photos"},{"role":"anon","allowed":true,"privilege":"INSERT","table_name":"photos"},{"role":"anon","allowed":false,"privilege":"REFERENCES","table_name":"photos"},{"role":"anon","allowed":true,"privilege":"SELECT","table_name":"photos"},{"role":"anon","allowed":false,"privilege":"TRIGGER","table_name":"photos"},{"role":"anon","allowed":false,"privilege":"TRUNCATE","table_name":"photos"},{"role":"anon","allowed":true,"privilege":"UPDATE","table_name":"photos"},{"role":"authenticated","allowed":false,"privilege":"DELETE","table_name":"photos"},{"role":"authenticated","allowed":true,"privilege":"INSERT","table_name":"photos"},{"role":"authenticated","allowed":false,"privilege":"REFERENCES","table_name":"photos"},{"role":"authenticated","allowed":true,"privilege":"SELECT","table_name":"photos"},{"role":"authenticated","allowed":false,"privilege":"TRIGGER","table_name":"photos"},{"role":"authenticated","allowed":false,"privilege":"TRUNCATE","table_name":"photos"},{"role":"authenticated","allowed":true,"privilege":"UPDATE","table_name":"photos"},{"role":"service_role","allowed":true,"privilege":"DELETE","table_name":"photos"},{"role":"service_role","allowed":true,"privilege":"INSERT","table_name":"photos"},{"role":"service_role","allowed":true,"privilege":"REFERENCES","table_name":"photos"},{"role":"service_role","allowed":true,"privilege":"SELECT","table_name":"photos"},{"role":"service_role","allowed":true,"privilege":"TRIGGER","table_name":"photos"},{"role":"service_role","allowed":true,"privilege":"TRUNCATE","table_name":"photos"},{"role":"service_role","allowed":true,"privilege":"UPDATE","table_name":"photos"},{"role":"anon","allowed":false,"privilege":"DELETE","table_name":"product_active_bands"},{"role":"anon","allowed":false,"privilege":"INSERT","table_name":"product_active_bands"},{"role":"anon","allowed":false,"privilege":"REFERENCES","table_name":"product_active_bands"},{"role":"anon","allowed":false,"privilege":"SELECT","table_name":"product_active_bands"},{"role":"anon","allowed":false,"privilege":"TRIGGER","table_name":"product_active_bands"},{"role":"anon","allowed":false,"privilege":"TRUNCATE","table_name":"product_active_bands"},{"role":"anon","allowed":false,"privilege":"UPDATE","table_name":"product_active_bands"},{"role":"authenticated","allowed":false,"privilege":"DELETE","table_name":"product_active_bands"},{"role":"authenticated","allowed":false,"privilege":"INSERT","table_name":"product_active_bands"},{"role":"authenticated","allowed":false,"privilege":"REFERENCES","table_name":"product_active_bands"},{"role":"authenticated","allowed":true,"privilege":"SELECT","table_name":"product_active_bands"},{"role":"authenticated","allowed":false,"privilege":"TRIGGER","table_name":"product_active_bands"},{"role":"authenticated","allowed":false,"privilege":"TRUNCATE","table_name":"product_active_bands"},{"role":"authenticated","allowed":false,"privilege":"UPDATE","table_name":"product_active_bands"},{"role":"service_role","allowed":false,"privilege":"DELETE","table_name":"product_active_bands"},{"role":"service_role","allowed":false,"privilege":"INSERT","table_name":"product_active_bands"},{"role":"service_role","allowed":false,"privilege":"REFERENCES","table_name":"product_active_bands"},{"role":"service_role","allowed":false,"privilege":"SELECT","table_name":"product_active_bands"},{"role":"service_role","allowed":false,"privilege":"TRIGGER","table_name":"product_active_bands"},{"role":"service_role","allowed":false,"privilege":"TRUNCATE","table_name":"product_active_bands"},{"role":"service_role","allowed":false,"privilege":"UPDATE","table_name":"product_active_bands"},{"role":"anon","allowed":false,"privilege":"DELETE","table_name":"product_barcodes"},{"role":"anon","allowed":false,"privilege":"INSERT","table_name":"product_barcodes"},{"role":"anon","allowed":false,"privilege":"REFERENCES","table_name":"product_barcodes"},{"role":"anon","allowed":false,"privilege":"SELECT","table_name":"product_barcodes"},{"role":"anon","allowed":false,"privilege":"TRIGGER","table_name":"product_barcodes"},{"role":"anon","allowed":false,"privilege":"TRUNCATE","table_name":"product_barcodes"},{"role":"anon","allowed":false,"privilege":"UPDATE","table_name":"product_barcodes"},{"role":"authenticated","allowed":false,"privilege":"DELETE","table_name":"product_barcodes"},{"role":"authenticated","allowed":false,"privilege":"INSERT","table_name":"product_barcodes"},{"role":"authenticated","allowed":false,"privilege":"REFERENCES","table_name":"product_barcodes"},{"role":"authenticated","allowed":true,"privilege":"SELECT","table_name":"product_barcodes"},{"role":"authenticated","allowed":false,"privilege":"TRIGGER","table_name":"product_barcodes"},{"role":"authenticated","allowed":false,"privilege":"TRUNCATE","table_name":"product_barcodes"},{"role":"authenticated","allowed":false,"privilege":"UPDATE","table_name":"product_barcodes"},{"role":"service_role","allowed":false,"privilege":"DELETE","table_name":"product_barcodes"},{"role":"service_role","allowed":false,"privilege":"INSERT","table_name":"product_barcodes"},{"role":"service_role","allowed":false,"privilege":"REFERENCES","table_name":"product_barcodes"},{"role":"service_role","allowed":false,"privilege":"SELECT","table_name":"product_barcodes"},{"role":"service_role","allowed":false,"privilege":"TRIGGER","table_name":"product_barcodes"},{"role":"service_role","allowed":false,"privilege":"TRUNCATE","table_name":"product_barcodes"},{"role":"service_role","allowed":false,"privilege":"UPDATE","table_name":"product_barcodes"},{"role":"anon","allowed":false,"privilege":"DELETE","table_name":"product_categories"},{"role":"anon","allowed":false,"privilege":"INSERT","table_name":"product_categories"},{"role":"anon","allowed":false,"privilege":"REFERENCES","table_name":"product_categories"},{"role":"anon","allowed":false,"privilege":"SELECT","table_name":"product_categories"},{"role":"anon","allowed":false,"privilege":"TRIGGER","table_name":"product_categories"},{"role":"anon","allowed":false,"privilege":"TRUNCATE","table_name":"product_categories"},{"role":"anon","allowed":false,"privilege":"UPDATE","table_name":"product_categories"},{"role":"authenticated","allowed":false,"privilege":"DELETE","table_name":"product_categories"},{"role":"authenticated","allowed":false,"privilege":"INSERT","table_name":"product_categories"},{"role":"authenticated","allowed":false,"privilege":"REFERENCES","table_name":"product_categories"},{"role":"authenticated","allowed":false,"privilege":"SELECT","table_name":"product_categories"},{"role":"authenticated","allowed":false,"privilege":"TRIGGER","table_name":"product_categories"},{"role":"authenticated","allowed":false,"privilege":"TRUNCATE","table_name":"product_categories"},{"role":"authenticated","allowed":false,"privilege":"UPDATE","table_name":"product_categories"},{"role":"service_role","allowed":false,"privilege":"DELETE","table_name":"product_categories"},{"role":"service_role","allowed":false,"privilege":"INSERT","table_name":"product_categories"},{"role":"service_role","allowed":false,"privilege":"REFERENCES","table_name":"product_categories"},{"role":"service_role","allowed":false,"privilege":"SELECT","table_name":"product_categories"},{"role":"service_role","allowed":false,"privilege":"TRIGGER","table_name":"product_categories"},{"role":"service_role","allowed":false,"privilege":"TRUNCATE","table_name":"product_categories"},{"role":"service_role","allowed":false,"privilege":"UPDATE","table_name":"product_categories"},{"role":"anon","allowed":false,"privilege":"DELETE","table_name":"product_ingredient_lists"},{"role":"anon","allowed":false,"privilege":"INSERT","table_name":"product_ingredient_lists"},{"role":"anon","allowed":false,"privilege":"REFERENCES","table_name":"product_ingredient_lists"},{"role":"anon","allowed":false,"privilege":"SELECT","table_name":"product_ingredient_lists"},{"role":"anon","allowed":false,"privilege":"TRIGGER","table_name":"product_ingredient_lists"},{"role":"anon","allowed":false,"privilege":"TRUNCATE","table_name":"product_ingredient_lists"},{"role":"anon","allowed":false,"privilege":"UPDATE","table_name":"product_ingredient_lists"},{"role":"authenticated","allowed":false,"privilege":"DELETE","table_name":"product_ingredient_lists"},{"role":"authenticated","allowed":false,"privilege":"INSERT","table_name":"product_ingredient_lists"},{"role":"authenticated","allowed":false,"privilege":"REFERENCES","table_name":"product_ingredient_lists"},{"role":"authenticated","allowed":true,"privilege":"SELECT","table_name":"product_ingredient_lists"},{"role":"authenticated","allowed":false,"privilege":"TRIGGER","table_name":"product_ingredient_lists"},{"role":"authenticated","allowed":false,"privilege":"TRUNCATE","table_name":"product_ingredient_lists"},{"role":"authenticated","allowed":false,"privilege":"UPDATE","table_name":"product_ingredient_lists"},{"role":"service_role","allowed":false,"privilege":"DELETE","table_name":"product_ingredient_lists"},{"role":"service_role","allowed":false,"privilege":"INSERT","table_name":"product_ingredient_lists"},{"role":"service_role","allowed":false,"privilege":"REFERENCES","table_name":"product_ingredient_lists"},{"role":"service_role","allowed":false,"privilege":"SELECT","table_name":"product_ingredient_lists"},{"role":"service_role","allowed":false,"privilege":"TRIGGER","table_name":"product_ingredient_lists"},{"role":"service_role","allowed":false,"privilege":"TRUNCATE","table_name":"product_ingredient_lists"},{"role":"service_role","allowed":false,"privilege":"UPDATE","table_name":"product_ingredient_lists"},{"role":"anon","allowed":false,"privilege":"DELETE","table_name":"product_ingredient_tokens"},{"role":"anon","allowed":false,"privilege":"INSERT","table_name":"product_ingredient_tokens"},{"role":"anon","allowed":false,"privilege":"REFERENCES","table_name":"product_ingredient_tokens"},{"role":"anon","allowed":false,"privilege":"SELECT","table_name":"product_ingredient_tokens"},{"role":"anon","allowed":false,"privilege":"TRIGGER","table_name":"product_ingredient_tokens"},{"role":"anon","allowed":false,"privilege":"TRUNCATE","table_name":"product_ingredient_tokens"},{"role":"anon","allowed":false,"privilege":"UPDATE","table_name":"product_ingredient_tokens"},{"role":"authenticated","allowed":false,"privilege":"DELETE","table_name":"product_ingredient_tokens"},{"role":"authenticated","allowed":false,"privilege":"INSERT","table_name":"product_ingredient_tokens"},{"role":"authenticated","allowed":false,"privilege":"REFERENCES","table_name":"product_ingredient_tokens"},{"role":"authenticated","allowed":true,"privilege":"SELECT","table_name":"product_ingredient_tokens"},{"role":"authenticated","allowed":false,"privilege":"TRIGGER","table_name":"product_ingredient_tokens"},{"role":"authenticated","allowed":false,"privilege":"TRUNCATE","table_name":"product_ingredient_tokens"},{"role":"authenticated","allowed":false,"privilege":"UPDATE","table_name":"product_ingredient_tokens"},{"role":"service_role","allowed":false,"privilege":"DELETE","table_name":"product_ingredient_tokens"},{"role":"service_role","allowed":false,"privilege":"INSERT","table_name":"product_ingredient_tokens"},{"role":"service_role","allowed":false,"privilege":"REFERENCES","table_name":"product_ingredient_tokens"},{"role":"service_role","allowed":false,"privilege":"SELECT","table_name":"product_ingredient_tokens"},{"role":"service_role","allowed":false,"privilege":"TRIGGER","table_name":"product_ingredient_tokens"},{"role":"service_role","allowed":false,"privilege":"TRUNCATE","table_name":"product_ingredient_tokens"},{"role":"service_role","allowed":false,"privilege":"UPDATE","table_name":"product_ingredient_tokens"},{"role":"anon","allowed":false,"privilege":"DELETE","table_name":"product_ingredients"},{"role":"anon","allowed":false,"privilege":"INSERT","table_name":"product_ingredients"},{"role":"anon","allowed":false,"privilege":"REFERENCES","table_name":"product_ingredients"},{"role":"anon","allowed":false,"privilege":"SELECT","table_name":"product_ingredients"},{"role":"anon","allowed":false,"privilege":"TRIGGER","table_name":"product_ingredients"},{"role":"anon","allowed":false,"privilege":"TRUNCATE","table_name":"product_ingredients"},{"role":"anon","allowed":false,"privilege":"UPDATE","table_name":"product_ingredients"},{"role":"authenticated","allowed":false,"privilege":"DELETE","table_name":"product_ingredients"},{"role":"authenticated","allowed":false,"privilege":"INSERT","table_name":"product_ingredients"},{"role":"authenticated","allowed":false,"privilege":"REFERENCES","table_name":"product_ingredients"},{"role":"authenticated","allowed":true,"privilege":"SELECT","table_name":"product_ingredients"},{"role":"authenticated","allowed":false,"privilege":"TRIGGER","table_name":"product_ingredients"},{"role":"authenticated","allowed":false,"privilege":"TRUNCATE","table_name":"product_ingredients"},{"role":"authenticated","allowed":false,"privilege":"UPDATE","table_name":"product_ingredients"},{"role":"service_role","allowed":false,"privilege":"DELETE","table_name":"product_ingredients"},{"role":"service_role","allowed":false,"privilege":"INSERT","table_name":"product_ingredients"},{"role":"service_role","allowed":false,"privilege":"REFERENCES","table_name":"product_ingredients"},{"role":"service_role","allowed":false,"privilege":"SELECT","table_name":"product_ingredients"},{"role":"service_role","allowed":false,"privilege":"TRIGGER","table_name":"product_ingredients"},{"role":"service_role","allowed":false,"privilege":"TRUNCATE","table_name":"product_ingredients"},{"role":"service_role","allowed":false,"privilege":"UPDATE","table_name":"product_ingredients"},{"role":"anon","allowed":false,"privilege":"DELETE","table_name":"product_pao_expiry"},{"role":"anon","allowed":false,"privilege":"INSERT","table_name":"product_pao_expiry"},{"role":"anon","allowed":false,"privilege":"REFERENCES","table_name":"product_pao_expiry"},{"role":"anon","allowed":false,"privilege":"SELECT","table_name":"product_pao_expiry"},{"role":"anon","allowed":false,"privilege":"TRIGGER","table_name":"product_pao_expiry"},{"role":"anon","allowed":false,"privilege":"TRUNCATE","table_name":"product_pao_expiry"},{"role":"anon","allowed":false,"privilege":"UPDATE","table_name":"product_pao_expiry"},{"role":"authenticated","allowed":false,"privilege":"DELETE","table_name":"product_pao_expiry"},{"role":"authenticated","allowed":false,"privilege":"INSERT","table_name":"product_pao_expiry"},{"role":"authenticated","allowed":false,"privilege":"REFERENCES","table_name":"product_pao_expiry"},{"role":"authenticated","allowed":true,"privilege":"SELECT","table_name":"product_pao_expiry"},{"role":"authenticated","allowed":false,"privilege":"TRIGGER","table_name":"product_pao_expiry"},{"role":"authenticated","allowed":false,"privilege":"TRUNCATE","table_name":"product_pao_expiry"},{"role":"authenticated","allowed":false,"privilege":"UPDATE","table_name":"product_pao_expiry"},{"role":"service_role","allowed":false,"privilege":"DELETE","table_name":"product_pao_expiry"},{"role":"service_role","allowed":false,"privilege":"INSERT","table_name":"product_pao_expiry"},{"role":"service_role","allowed":false,"privilege":"REFERENCES","table_name":"product_pao_expiry"},{"role":"service_role","allowed":false,"privilege":"SELECT","table_name":"product_pao_expiry"},{"role":"service_role","allowed":false,"privilege":"TRIGGER","table_name":"product_pao_expiry"},{"role":"service_role","allowed":false,"privilege":"TRUNCATE","table_name":"product_pao_expiry"},{"role":"service_role","allowed":false,"privilege":"UPDATE","table_name":"product_pao_expiry"},{"role":"anon","allowed":false,"privilege":"DELETE","table_name":"products"},{"role":"anon","allowed":false,"privilege":"INSERT","table_name":"products"},{"role":"anon","allowed":false,"privilege":"REFERENCES","table_name":"products"},{"role":"anon","allowed":false,"privilege":"SELECT","table_name":"products"},{"role":"anon","allowed":false,"privilege":"TRIGGER","table_name":"products"},{"role":"anon","allowed":false,"privilege":"TRUNCATE","table_name":"products"},{"role":"anon","allowed":false,"privilege":"UPDATE","table_name":"products"},{"role":"authenticated","allowed":false,"privilege":"DELETE","table_name":"products"},{"role":"authenticated","allowed":false,"privilege":"INSERT","table_name":"products"},{"role":"authenticated","allowed":false,"privilege":"REFERENCES","table_name":"products"},{"role":"authenticated","allowed":true,"privilege":"SELECT","table_name":"products"},{"role":"authenticated","allowed":false,"privilege":"TRIGGER","table_name":"products"},{"role":"authenticated","allowed":false,"privilege":"TRUNCATE","table_name":"products"},{"role":"authenticated","allowed":false,"privilege":"UPDATE","table_name":"products"},{"role":"service_role","allowed":false,"privilege":"DELETE","table_name":"products"},{"role":"service_role","allowed":false,"privilege":"INSERT","table_name":"products"},{"role":"service_role","allowed":false,"privilege":"REFERENCES","table_name":"products"},{"role":"service_role","allowed":false,"privilege":"SELECT","table_name":"products"},{"role":"service_role","allowed":false,"privilege":"TRIGGER","table_name":"products"},{"role":"service_role","allowed":false,"privilege":"TRUNCATE","table_name":"products"},{"role":"service_role","allowed":false,"privilege":"UPDATE","table_name":"products"},{"role":"anon","allowed":false,"privilege":"DELETE","table_name":"profiles"},{"role":"anon","allowed":false,"privilege":"INSERT","table_name":"profiles"},{"role":"anon","allowed":false,"privilege":"REFERENCES","table_name":"profiles"},{"role":"anon","allowed":true,"privilege":"SELECT","table_name":"profiles"},{"role":"anon","allowed":false,"privilege":"TRIGGER","table_name":"profiles"},{"role":"anon","allowed":false,"privilege":"TRUNCATE","table_name":"profiles"},{"role":"anon","allowed":false,"privilege":"UPDATE","table_name":"profiles"},{"role":"authenticated","allowed":false,"privilege":"DELETE","table_name":"profiles"},{"role":"authenticated","allowed":true,"privilege":"INSERT","table_name":"profiles"},{"role":"authenticated","allowed":false,"privilege":"REFERENCES","table_name":"profiles"},{"role":"authenticated","allowed":true,"privilege":"SELECT","table_name":"profiles"},{"role":"authenticated","allowed":false,"privilege":"TRIGGER","table_name":"profiles"},{"role":"authenticated","allowed":false,"privilege":"TRUNCATE","table_name":"profiles"},{"role":"authenticated","allowed":false,"privilege":"UPDATE","table_name":"profiles"},{"role":"service_role","allowed":false,"privilege":"DELETE","table_name":"profiles"},{"role":"service_role","allowed":false,"privilege":"INSERT","table_name":"profiles"},{"role":"service_role","allowed":false,"privilege":"REFERENCES","table_name":"profiles"},{"role":"service_role","allowed":true,"privilege":"SELECT","table_name":"profiles"},{"role":"service_role","allowed":false,"privilege":"TRIGGER","table_name":"profiles"},{"role":"service_role","allowed":false,"privilege":"TRUNCATE","table_name":"profiles"},{"role":"service_role","allowed":false,"privilege":"UPDATE","table_name":"profiles"},{"role":"anon","allowed":false,"privilege":"DELETE","table_name":"recommendation_preferences"},{"role":"anon","allowed":false,"privilege":"INSERT","table_name":"recommendation_preferences"},{"role":"anon","allowed":false,"privilege":"REFERENCES","table_name":"recommendation_preferences"},{"role":"anon","allowed":false,"privilege":"SELECT","table_name":"recommendation_preferences"},{"role":"anon","allowed":false,"privilege":"TRIGGER","table_name":"recommendation_preferences"},{"role":"anon","allowed":false,"privilege":"TRUNCATE","table_name":"recommendation_preferences"},{"role":"anon","allowed":false,"privilege":"UPDATE","table_name":"recommendation_preferences"},{"role":"authenticated","allowed":false,"privilege":"DELETE","table_name":"recommendation_preferences"},{"role":"authenticated","allowed":false,"privilege":"INSERT","table_name":"recommendation_preferences"},{"role":"authenticated","allowed":false,"privilege":"REFERENCES","table_name":"recommendation_preferences"},{"role":"authenticated","allowed":true,"privilege":"SELECT","table_name":"recommendation_preferences"},{"role":"authenticated","allowed":false,"privilege":"TRIGGER","table_name":"recommendation_preferences"},{"role":"authenticated","allowed":false,"privilege":"TRUNCATE","table_name":"recommendation_preferences"},{"role":"authenticated","allowed":false,"privilege":"UPDATE","table_name":"recommendation_preferences"},{"role":"service_role","allowed":false,"privilege":"DELETE","table_name":"recommendation_preferences"},{"role":"service_role","allowed":false,"privilege":"INSERT","table_name":"recommendation_preferences"},{"role":"service_role","allowed":false,"privilege":"REFERENCES","table_name":"recommendation_preferences"},{"role":"service_role","allowed":true,"privilege":"SELECT","table_name":"recommendation_preferences"},{"role":"service_role","allowed":false,"privilege":"TRIGGER","table_name":"recommendation_preferences"},{"role":"service_role","allowed":false,"privilege":"TRUNCATE","table_name":"recommendation_preferences"},{"role":"service_role","allowed":false,"privilege":"UPDATE","table_name":"recommendation_preferences"},{"role":"anon","allowed":false,"privilege":"DELETE","table_name":"recommendations"},{"role":"anon","allowed":false,"privilege":"INSERT","table_name":"recommendations"},{"role":"anon","allowed":false,"privilege":"REFERENCES","table_name":"recommendations"},{"role":"anon","allowed":false,"privilege":"SELECT","table_name":"recommendations"},{"role":"anon","allowed":false,"privilege":"TRIGGER","table_name":"recommendations"},{"role":"anon","allowed":false,"privilege":"TRUNCATE","table_name":"recommendations"},{"role":"anon","allowed":false,"privilege":"UPDATE","table_name":"recommendations"},{"role":"authenticated","allowed":false,"privilege":"DELETE","table_name":"recommendations"},{"role":"authenticated","allowed":false,"privilege":"INSERT","table_name":"recommendations"},{"role":"authenticated","allowed":false,"privilege":"REFERENCES","table_name":"recommendations"},{"role":"authenticated","allowed":true,"privilege":"SELECT","table_name":"recommendations"},{"role":"authenticated","allowed":false,"privilege":"TRIGGER","table_name":"recommendations"},{"role":"authenticated","allowed":false,"privilege":"TRUNCATE","table_name":"recommendations"},{"role":"authenticated","allowed":false,"privilege":"UPDATE","table_name":"recommendations"},{"role":"service_role","allowed":false,"privilege":"DELETE","table_name":"recommendations"},{"role":"service_role","allowed":false,"privilege":"INSERT","table_name":"recommendations"},{"role":"service_role","allowed":false,"privilege":"REFERENCES","table_name":"recommendations"},{"role":"service_role","allowed":true,"privilege":"SELECT","table_name":"recommendations"},{"role":"service_role","allowed":false,"privilege":"TRIGGER","table_name":"recommendations"},{"role":"service_role","allowed":false,"privilege":"TRUNCATE","table_name":"recommendations"},{"role":"service_role","allowed":false,"privilege":"UPDATE","table_name":"recommendations"},{"role":"anon","allowed":false,"privilege":"DELETE","table_name":"revenuecat_identity_tombstones"},{"role":"anon","allowed":false,"privilege":"INSERT","table_name":"revenuecat_identity_tombstones"},{"role":"anon","allowed":false,"privilege":"REFERENCES","table_name":"revenuecat_identity_tombstones"},{"role":"anon","allowed":false,"privilege":"SELECT","table_name":"revenuecat_identity_tombstones"},{"role":"anon","allowed":false,"privilege":"TRIGGER","table_name":"revenuecat_identity_tombstones"},{"role":"anon","allowed":false,"privilege":"TRUNCATE","table_name":"revenuecat_identity_tombstones"},{"role":"anon","allowed":false,"privilege":"UPDATE","table_name":"revenuecat_identity_tombstones"},{"role":"authenticated","allowed":false,"privilege":"DELETE","table_name":"revenuecat_identity_tombstones"},{"role":"authenticated","allowed":false,"privilege":"INSERT","table_name":"revenuecat_identity_tombstones"},{"role":"authenticated","allowed":false,"privilege":"REFERENCES","table_name":"revenuecat_identity_tombstones"},{"role":"authenticated","allowed":false,"privilege":"SELECT","table_name":"revenuecat_identity_tombstones"},{"role":"authenticated","allowed":false,"privilege":"TRIGGER","table_name":"revenuecat_identity_tombstones"},{"role":"authenticated","allowed":false,"privilege":"TRUNCATE","table_name":"revenuecat_identity_tombstones"},{"role":"authenticated","allowed":false,"privilege":"UPDATE","table_name":"revenuecat_identity_tombstones"},{"role":"service_role","allowed":false,"privilege":"DELETE","table_name":"revenuecat_identity_tombstones"},{"role":"service_role","allowed":false,"privilege":"INSERT","table_name":"revenuecat_identity_tombstones"},{"role":"service_role","allowed":false,"privilege":"REFERENCES","table_name":"revenuecat_identity_tombstones"},{"role":"service_role","allowed":false,"privilege":"SELECT","table_name":"revenuecat_identity_tombstones"},{"role":"service_role","allowed":false,"privilege":"TRIGGER","table_name":"revenuecat_identity_tombstones"},{"role":"service_role","allowed":false,"privilege":"TRUNCATE","table_name":"revenuecat_identity_tombstones"},{"role":"service_role","allowed":false,"privilege":"UPDATE","table_name":"revenuecat_identity_tombstones"},{"role":"anon","allowed":true,"privilege":"DELETE","table_name":"reverse_trial_grants"},{"role":"anon","allowed":true,"privilege":"INSERT","table_name":"reverse_trial_grants"},{"role":"anon","allowed":false,"privilege":"REFERENCES","table_name":"reverse_trial_grants"},{"role":"anon","allowed":true,"privilege":"SELECT","table_name":"reverse_trial_grants"},{"role":"anon","allowed":false,"privilege":"TRIGGER","table_name":"reverse_trial_grants"},{"role":"anon","allowed":false,"privilege":"TRUNCATE","table_name":"reverse_trial_grants"},{"role":"anon","allowed":true,"privilege":"UPDATE","table_name":"reverse_trial_grants"},{"role":"authenticated","allowed":true,"privilege":"DELETE","table_name":"reverse_trial_grants"},{"role":"authenticated","allowed":true,"privilege":"INSERT","table_name":"reverse_trial_grants"},{"role":"authenticated","allowed":false,"privilege":"REFERENCES","table_name":"reverse_trial_grants"},{"role":"authenticated","allowed":true,"privilege":"SELECT","table_name":"reverse_trial_grants"},{"role":"authenticated","allowed":false,"privilege":"TRIGGER","table_name":"reverse_trial_grants"},{"role":"authenticated","allowed":false,"privilege":"TRUNCATE","table_name":"reverse_trial_grants"},{"role":"authenticated","allowed":true,"privilege":"UPDATE","table_name":"reverse_trial_grants"},{"role":"service_role","allowed":false,"privilege":"DELETE","table_name":"reverse_trial_grants"},{"role":"service_role","allowed":false,"privilege":"INSERT","table_name":"reverse_trial_grants"},{"role":"service_role","allowed":true,"privilege":"REFERENCES","table_name":"reverse_trial_grants"},{"role":"service_role","allowed":true,"privilege":"SELECT","table_name":"reverse_trial_grants"},{"role":"service_role","allowed":true,"privilege":"TRIGGER","table_name":"reverse_trial_grants"},{"role":"service_role","allowed":false,"privilege":"TRUNCATE","table_name":"reverse_trial_grants"},{"role":"service_role","allowed":false,"privilege":"UPDATE","table_name":"reverse_trial_grants"},{"role":"anon","allowed":false,"privilege":"DELETE","table_name":"routine_completions"},{"role":"anon","allowed":false,"privilege":"INSERT","table_name":"routine_completions"},{"role":"anon","allowed":false,"privilege":"REFERENCES","table_name":"routine_completions"},{"role":"anon","allowed":true,"privilege":"SELECT","table_name":"routine_completions"},{"role":"anon","allowed":false,"privilege":"TRIGGER","table_name":"routine_completions"},{"role":"anon","allowed":false,"privilege":"TRUNCATE","table_name":"routine_completions"},{"role":"anon","allowed":false,"privilege":"UPDATE","table_name":"routine_completions"},{"role":"authenticated","allowed":false,"privilege":"DELETE","table_name":"routine_completions"},{"role":"authenticated","allowed":false,"privilege":"INSERT","table_name":"routine_completions"},{"role":"authenticated","allowed":false,"privilege":"REFERENCES","table_name":"routine_completions"},{"role":"authenticated","allowed":true,"privilege":"SELECT","table_name":"routine_completions"},{"role":"authenticated","allowed":false,"privilege":"TRIGGER","table_name":"routine_completions"},{"role":"authenticated","allowed":false,"privilege":"TRUNCATE","table_name":"routine_completions"},{"role":"authenticated","allowed":false,"privilege":"UPDATE","table_name":"routine_completions"},{"role":"service_role","allowed":false,"privilege":"DELETE","table_name":"routine_completions"},{"role":"service_role","allowed":false,"privilege":"INSERT","table_name":"routine_completions"},{"role":"service_role","allowed":false,"privilege":"REFERENCES","table_name":"routine_completions"},{"role":"service_role","allowed":true,"privilege":"SELECT","table_name":"routine_completions"},{"role":"service_role","allowed":false,"privilege":"TRIGGER","table_name":"routine_completions"},{"role":"service_role","allowed":false,"privilege":"TRUNCATE","table_name":"routine_completions"},{"role":"service_role","allowed":false,"privilege":"UPDATE","table_name":"routine_completions"},{"role":"anon","allowed":false,"privilege":"DELETE","table_name":"routine_conflicts"},{"role":"anon","allowed":false,"privilege":"INSERT","table_name":"routine_conflicts"},{"role":"anon","allowed":false,"privilege":"REFERENCES","table_name":"routine_conflicts"},{"role":"anon","allowed":true,"privilege":"SELECT","table_name":"routine_conflicts"},{"role":"anon","allowed":false,"privilege":"TRIGGER","table_name":"routine_conflicts"},{"role":"anon","allowed":false,"privilege":"TRUNCATE","table_name":"routine_conflicts"},{"role":"anon","allowed":false,"privilege":"UPDATE","table_name":"routine_conflicts"},{"role":"authenticated","allowed":false,"privilege":"DELETE","table_name":"routine_conflicts"},{"role":"authenticated","allowed":false,"privilege":"INSERT","table_name":"routine_conflicts"},{"role":"authenticated","allowed":false,"privilege":"REFERENCES","table_name":"routine_conflicts"},{"role":"authenticated","allowed":true,"privilege":"SELECT","table_name":"routine_conflicts"},{"role":"authenticated","allowed":false,"privilege":"TRIGGER","table_name":"routine_conflicts"},{"role":"authenticated","allowed":false,"privilege":"TRUNCATE","table_name":"routine_conflicts"},{"role":"authenticated","allowed":false,"privilege":"UPDATE","table_name":"routine_conflicts"},{"role":"service_role","allowed":true,"privilege":"DELETE","table_name":"routine_conflicts"},{"role":"service_role","allowed":true,"privilege":"INSERT","table_name":"routine_conflicts"},{"role":"service_role","allowed":true,"privilege":"REFERENCES","table_name":"routine_conflicts"},{"role":"service_role","allowed":true,"privilege":"SELECT","table_name":"routine_conflicts"},{"role":"service_role","allowed":true,"privilege":"TRIGGER","table_name":"routine_conflicts"},{"role":"service_role","allowed":true,"privilege":"TRUNCATE","table_name":"routine_conflicts"},{"role":"service_role","allowed":true,"privilege":"UPDATE","table_name":"routine_conflicts"},{"role":"anon","allowed":false,"privilege":"DELETE","table_name":"routine_steps"},{"role":"anon","allowed":false,"privilege":"INSERT","table_name":"routine_steps"},{"role":"anon","allowed":false,"privilege":"REFERENCES","table_name":"routine_steps"},{"role":"anon","allowed":true,"privilege":"SELECT","table_name":"routine_steps"},{"role":"anon","allowed":false,"privilege":"TRIGGER","table_name":"routine_steps"},{"role":"anon","allowed":false,"privilege":"TRUNCATE","table_name":"routine_steps"},{"role":"anon","allowed":false,"privilege":"UPDATE","table_name":"routine_steps"},{"role":"authenticated","allowed":false,"privilege":"DELETE","table_name":"routine_steps"},{"role":"authenticated","allowed":false,"privilege":"INSERT","table_name":"routine_steps"},{"role":"authenticated","allowed":false,"privilege":"REFERENCES","table_name":"routine_steps"},{"role":"authenticated","allowed":true,"privilege":"SELECT","table_name":"routine_steps"},{"role":"authenticated","allowed":false,"privilege":"TRIGGER","table_name":"routine_steps"},{"role":"authenticated","allowed":false,"privilege":"TRUNCATE","table_name":"routine_steps"},{"role":"authenticated","allowed":false,"privilege":"UPDATE","table_name":"routine_steps"},{"role":"service_role","allowed":false,"privilege":"DELETE","table_name":"routine_steps"},{"role":"service_role","allowed":false,"privilege":"INSERT","table_name":"routine_steps"},{"role":"service_role","allowed":false,"privilege":"REFERENCES","table_name":"routine_steps"},{"role":"service_role","allowed":true,"privilege":"SELECT","table_name":"routine_steps"},{"role":"service_role","allowed":false,"privilege":"TRIGGER","table_name":"routine_steps"},{"role":"service_role","allowed":false,"privilege":"TRUNCATE","table_name":"routine_steps"},{"role":"service_role","allowed":false,"privilege":"UPDATE","table_name":"routine_steps"},{"role":"anon","allowed":false,"privilege":"DELETE","table_name":"routines"},{"role":"anon","allowed":false,"privilege":"INSERT","table_name":"routines"},{"role":"anon","allowed":false,"privilege":"REFERENCES","table_name":"routines"},{"role":"anon","allowed":true,"privilege":"SELECT","table_name":"routines"},{"role":"anon","allowed":false,"privilege":"TRIGGER","table_name":"routines"},{"role":"anon","allowed":false,"privilege":"TRUNCATE","table_name":"routines"},{"role":"anon","allowed":false,"privilege":"UPDATE","table_name":"routines"},{"role":"authenticated","allowed":false,"privilege":"DELETE","table_name":"routines"},{"role":"authenticated","allowed":false,"privilege":"INSERT","table_name":"routines"},{"role":"authenticated","allowed":false,"privilege":"REFERENCES","table_name":"routines"},{"role":"authenticated","allowed":true,"privilege":"SELECT","table_name":"routines"},{"role":"authenticated","allowed":false,"privilege":"TRIGGER","table_name":"routines"},{"role":"authenticated","allowed":false,"privilege":"TRUNCATE","table_name":"routines"},{"role":"authenticated","allowed":false,"privilege":"UPDATE","table_name":"routines"},{"role":"service_role","allowed":false,"privilege":"DELETE","table_name":"routines"},{"role":"service_role","allowed":false,"privilege":"INSERT","table_name":"routines"},{"role":"service_role","allowed":false,"privilege":"REFERENCES","table_name":"routines"},{"role":"service_role","allowed":true,"privilege":"SELECT","table_name":"routines"},{"role":"service_role","allowed":false,"privilege":"TRIGGER","table_name":"routines"},{"role":"service_role","allowed":false,"privilege":"TRUNCATE","table_name":"routines"},{"role":"service_role","allowed":false,"privilege":"UPDATE","table_name":"routines"},{"role":"anon","allowed":false,"privilege":"DELETE","table_name":"sequencing_rules"},{"role":"anon","allowed":false,"privilege":"INSERT","table_name":"sequencing_rules"},{"role":"anon","allowed":false,"privilege":"REFERENCES","table_name":"sequencing_rules"},{"role":"anon","allowed":false,"privilege":"SELECT","table_name":"sequencing_rules"},{"role":"anon","allowed":false,"privilege":"TRIGGER","table_name":"sequencing_rules"},{"role":"anon","allowed":false,"privilege":"TRUNCATE","table_name":"sequencing_rules"},{"role":"anon","allowed":false,"privilege":"UPDATE","table_name":"sequencing_rules"},{"role":"authenticated","allowed":false,"privilege":"DELETE","table_name":"sequencing_rules"},{"role":"authenticated","allowed":false,"privilege":"INSERT","table_name":"sequencing_rules"},{"role":"authenticated","allowed":false,"privilege":"REFERENCES","table_name":"sequencing_rules"},{"role":"authenticated","allowed":false,"privilege":"SELECT","table_name":"sequencing_rules"},{"role":"authenticated","allowed":false,"privilege":"TRIGGER","table_name":"sequencing_rules"},{"role":"authenticated","allowed":false,"privilege":"TRUNCATE","table_name":"sequencing_rules"},{"role":"authenticated","allowed":false,"privilege":"UPDATE","table_name":"sequencing_rules"},{"role":"service_role","allowed":false,"privilege":"DELETE","table_name":"sequencing_rules"},{"role":"service_role","allowed":false,"privilege":"INSERT","table_name":"sequencing_rules"},{"role":"service_role","allowed":false,"privilege":"REFERENCES","table_name":"sequencing_rules"},{"role":"service_role","allowed":false,"privilege":"SELECT","table_name":"sequencing_rules"},{"role":"service_role","allowed":false,"privilege":"TRIGGER","table_name":"sequencing_rules"},{"role":"service_role","allowed":false,"privilege":"TRUNCATE","table_name":"sequencing_rules"},{"role":"service_role","allowed":false,"privilege":"UPDATE","table_name":"sequencing_rules"},{"role":"anon","allowed":false,"privilege":"DELETE","table_name":"shelf_mirror_versions"},{"role":"anon","allowed":false,"privilege":"INSERT","table_name":"shelf_mirror_versions"},{"role":"anon","allowed":false,"privilege":"REFERENCES","table_name":"shelf_mirror_versions"},{"role":"anon","allowed":false,"privilege":"SELECT","table_name":"shelf_mirror_versions"},{"role":"anon","allowed":false,"privilege":"TRIGGER","table_name":"shelf_mirror_versions"},{"role":"anon","allowed":false,"privilege":"TRUNCATE","table_name":"shelf_mirror_versions"},{"role":"anon","allowed":false,"privilege":"UPDATE","table_name":"shelf_mirror_versions"},{"role":"authenticated","allowed":false,"privilege":"DELETE","table_name":"shelf_mirror_versions"},{"role":"authenticated","allowed":false,"privilege":"INSERT","table_name":"shelf_mirror_versions"},{"role":"authenticated","allowed":false,"privilege":"REFERENCES","table_name":"shelf_mirror_versions"},{"role":"authenticated","allowed":false,"privilege":"SELECT","table_name":"shelf_mirror_versions"},{"role":"authenticated","allowed":false,"privilege":"TRIGGER","table_name":"shelf_mirror_versions"},{"role":"authenticated","allowed":false,"privilege":"TRUNCATE","table_name":"shelf_mirror_versions"},{"role":"authenticated","allowed":false,"privilege":"UPDATE","table_name":"shelf_mirror_versions"},{"role":"service_role","allowed":false,"privilege":"DELETE","table_name":"shelf_mirror_versions"},{"role":"service_role","allowed":false,"privilege":"INSERT","table_name":"shelf_mirror_versions"},{"role":"service_role","allowed":false,"privilege":"REFERENCES","table_name":"shelf_mirror_versions"},{"role":"service_role","allowed":false,"privilege":"SELECT","table_name":"shelf_mirror_versions"},{"role":"service_role","allowed":false,"privilege":"TRIGGER","table_name":"shelf_mirror_versions"},{"role":"service_role","allowed":false,"privilege":"TRUNCATE","table_name":"shelf_mirror_versions"},{"role":"service_role","allowed":false,"privilege":"UPDATE","table_name":"shelf_mirror_versions"},{"role":"anon","allowed":false,"privilege":"DELETE","table_name":"shelf_product_identities"},{"role":"anon","allowed":false,"privilege":"INSERT","table_name":"shelf_product_identities"},{"role":"anon","allowed":false,"privilege":"REFERENCES","table_name":"shelf_product_identities"},{"role":"anon","allowed":false,"privilege":"SELECT","table_name":"shelf_product_identities"},{"role":"anon","allowed":false,"privilege":"TRIGGER","table_name":"shelf_product_identities"},{"role":"anon","allowed":false,"privilege":"TRUNCATE","table_name":"shelf_product_identities"},{"role":"anon","allowed":false,"privilege":"UPDATE","table_name":"shelf_product_identities"},{"role":"authenticated","allowed":false,"privilege":"DELETE","table_name":"shelf_product_identities"},{"role":"authenticated","allowed":false,"privilege":"INSERT","table_name":"shelf_product_identities"},{"role":"authenticated","allowed":false,"privilege":"REFERENCES","table_name":"shelf_product_identities"},{"role":"authenticated","allowed":false,"privilege":"SELECT","table_name":"shelf_product_identities"},{"role":"authenticated","allowed":false,"privilege":"TRIGGER","table_name":"shelf_product_identities"},{"role":"authenticated","allowed":false,"privilege":"TRUNCATE","table_name":"shelf_product_identities"},{"role":"authenticated","allowed":false,"privilege":"UPDATE","table_name":"shelf_product_identities"},{"role":"service_role","allowed":false,"privilege":"DELETE","table_name":"shelf_product_identities"},{"role":"service_role","allowed":false,"privilege":"INSERT","table_name":"shelf_product_identities"},{"role":"service_role","allowed":false,"privilege":"REFERENCES","table_name":"shelf_product_identities"},{"role":"service_role","allowed":false,"privilege":"SELECT","table_name":"shelf_product_identities"},{"role":"service_role","allowed":false,"privilege":"TRIGGER","table_name":"shelf_product_identities"},{"role":"service_role","allowed":false,"privilege":"TRUNCATE","table_name":"shelf_product_identities"},{"role":"service_role","allowed":false,"privilege":"UPDATE","table_name":"shelf_product_identities"},{"role":"anon","allowed":false,"privilege":"DELETE","table_name":"shelf_scans"},{"role":"anon","allowed":false,"privilege":"INSERT","table_name":"shelf_scans"},{"role":"anon","allowed":false,"privilege":"REFERENCES","table_name":"shelf_scans"},{"role":"anon","allowed":false,"privilege":"SELECT","table_name":"shelf_scans"},{"role":"anon","allowed":false,"privilege":"TRIGGER","table_name":"shelf_scans"},{"role":"anon","allowed":false,"privilege":"TRUNCATE","table_name":"shelf_scans"},{"role":"anon","allowed":false,"privilege":"UPDATE","table_name":"shelf_scans"},{"role":"authenticated","allowed":false,"privilege":"DELETE","table_name":"shelf_scans"},{"role":"authenticated","allowed":false,"privilege":"INSERT","table_name":"shelf_scans"},{"role":"authenticated","allowed":false,"privilege":"REFERENCES","table_name":"shelf_scans"},{"role":"authenticated","allowed":false,"privilege":"SELECT","table_name":"shelf_scans"},{"role":"authenticated","allowed":false,"privilege":"TRIGGER","table_name":"shelf_scans"},{"role":"authenticated","allowed":false,"privilege":"TRUNCATE","table_name":"shelf_scans"},{"role":"authenticated","allowed":false,"privilege":"UPDATE","table_name":"shelf_scans"},{"role":"service_role","allowed":false,"privilege":"DELETE","table_name":"shelf_scans"},{"role":"service_role","allowed":false,"privilege":"INSERT","table_name":"shelf_scans"},{"role":"service_role","allowed":false,"privilege":"REFERENCES","table_name":"shelf_scans"},{"role":"service_role","allowed":false,"privilege":"SELECT","table_name":"shelf_scans"},{"role":"service_role","allowed":false,"privilege":"TRIGGER","table_name":"shelf_scans"},{"role":"service_role","allowed":false,"privilege":"TRUNCATE","table_name":"shelf_scans"},{"role":"service_role","allowed":false,"privilege":"UPDATE","table_name":"shelf_scans"},{"role":"anon","allowed":true,"privilege":"DELETE","table_name":"skin_profiles"},{"role":"anon","allowed":true,"privilege":"INSERT","table_name":"skin_profiles"},{"role":"anon","allowed":false,"privilege":"REFERENCES","table_name":"skin_profiles"},{"role":"anon","allowed":true,"privilege":"SELECT","table_name":"skin_profiles"},{"role":"anon","allowed":false,"privilege":"TRIGGER","table_name":"skin_profiles"},{"role":"anon","allowed":false,"privilege":"TRUNCATE","table_name":"skin_profiles"},{"role":"anon","allowed":false,"privilege":"UPDATE","table_name":"skin_profiles"},{"role":"authenticated","allowed":true,"privilege":"DELETE","table_name":"skin_profiles"},{"role":"authenticated","allowed":true,"privilege":"INSERT","table_name":"skin_profiles"},{"role":"authenticated","allowed":false,"privilege":"REFERENCES","table_name":"skin_profiles"},{"role":"authenticated","allowed":true,"privilege":"SELECT","table_name":"skin_profiles"},{"role":"authenticated","allowed":false,"privilege":"TRIGGER","table_name":"skin_profiles"},{"role":"authenticated","allowed":false,"privilege":"TRUNCATE","table_name":"skin_profiles"},{"role":"authenticated","allowed":false,"privilege":"UPDATE","table_name":"skin_profiles"},{"role":"service_role","allowed":true,"privilege":"DELETE","table_name":"skin_profiles"},{"role":"service_role","allowed":true,"privilege":"INSERT","table_name":"skin_profiles"},{"role":"service_role","allowed":true,"privilege":"REFERENCES","table_name":"skin_profiles"},{"role":"service_role","allowed":true,"privilege":"SELECT","table_name":"skin_profiles"},{"role":"service_role","allowed":true,"privilege":"TRIGGER","table_name":"skin_profiles"},{"role":"service_role","allowed":true,"privilege":"TRUNCATE","table_name":"skin_profiles"},{"role":"service_role","allowed":true,"privilege":"UPDATE","table_name":"skin_profiles"},{"role":"anon","allowed":false,"privilege":"DELETE","table_name":"streak_freezes"},{"role":"anon","allowed":false,"privilege":"INSERT","table_name":"streak_freezes"},{"role":"anon","allowed":false,"privilege":"REFERENCES","table_name":"streak_freezes"},{"role":"anon","allowed":true,"privilege":"SELECT","table_name":"streak_freezes"},{"role":"anon","allowed":false,"privilege":"TRIGGER","table_name":"streak_freezes"},{"role":"anon","allowed":false,"privilege":"TRUNCATE","table_name":"streak_freezes"},{"role":"anon","allowed":false,"privilege":"UPDATE","table_name":"streak_freezes"},{"role":"authenticated","allowed":false,"privilege":"DELETE","table_name":"streak_freezes"},{"role":"authenticated","allowed":false,"privilege":"INSERT","table_name":"streak_freezes"},{"role":"authenticated","allowed":false,"privilege":"REFERENCES","table_name":"streak_freezes"},{"role":"authenticated","allowed":true,"privilege":"SELECT","table_name":"streak_freezes"},{"role":"authenticated","allowed":false,"privilege":"TRIGGER","table_name":"streak_freezes"},{"role":"authenticated","allowed":false,"privilege":"TRUNCATE","table_name":"streak_freezes"},{"role":"authenticated","allowed":false,"privilege":"UPDATE","table_name":"streak_freezes"},{"role":"service_role","allowed":false,"privilege":"DELETE","table_name":"streak_freezes"},{"role":"service_role","allowed":false,"privilege":"INSERT","table_name":"streak_freezes"},{"role":"service_role","allowed":false,"privilege":"REFERENCES","table_name":"streak_freezes"},{"role":"service_role","allowed":true,"privilege":"SELECT","table_name":"streak_freezes"},{"role":"service_role","allowed":false,"privilege":"TRIGGER","table_name":"streak_freezes"},{"role":"service_role","allowed":false,"privilege":"TRUNCATE","table_name":"streak_freezes"},{"role":"service_role","allowed":false,"privilege":"UPDATE","table_name":"streak_freezes"},{"role":"anon","allowed":true,"privilege":"DELETE","table_name":"subscriptions_events"},{"role":"anon","allowed":true,"privilege":"INSERT","table_name":"subscriptions_events"},{"role":"anon","allowed":false,"privilege":"REFERENCES","table_name":"subscriptions_events"},{"role":"anon","allowed":true,"privilege":"SELECT","table_name":"subscriptions_events"},{"role":"anon","allowed":false,"privilege":"TRIGGER","table_name":"subscriptions_events"},{"role":"anon","allowed":false,"privilege":"TRUNCATE","table_name":"subscriptions_events"},{"role":"anon","allowed":true,"privilege":"UPDATE","table_name":"subscriptions_events"},{"role":"authenticated","allowed":true,"privilege":"DELETE","table_name":"subscriptions_events"},{"role":"authenticated","allowed":true,"privilege":"INSERT","table_name":"subscriptions_events"},{"role":"authenticated","allowed":false,"privilege":"REFERENCES","table_name":"subscriptions_events"},{"role":"authenticated","allowed":true,"privilege":"SELECT","table_name":"subscriptions_events"},{"role":"authenticated","allowed":false,"privilege":"TRIGGER","table_name":"subscriptions_events"},{"role":"authenticated","allowed":false,"privilege":"TRUNCATE","table_name":"subscriptions_events"},{"role":"authenticated","allowed":true,"privilege":"UPDATE","table_name":"subscriptions_events"},{"role":"service_role","allowed":false,"privilege":"DELETE","table_name":"subscriptions_events"},{"role":"service_role","allowed":false,"privilege":"INSERT","table_name":"subscriptions_events"},{"role":"service_role","allowed":false,"privilege":"REFERENCES","table_name":"subscriptions_events"},{"role":"service_role","allowed":true,"privilege":"SELECT","table_name":"subscriptions_events"},{"role":"service_role","allowed":false,"privilege":"TRIGGER","table_name":"subscriptions_events"},{"role":"service_role","allowed":false,"privilege":"TRUNCATE","table_name":"subscriptions_events"},{"role":"service_role","allowed":false,"privilege":"UPDATE","table_name":"subscriptions_events"},{"role":"anon","allowed":false,"privilege":"DELETE","table_name":"user_products"},{"role":"anon","allowed":false,"privilege":"INSERT","table_name":"user_products"},{"role":"anon","allowed":false,"privilege":"REFERENCES","table_name":"user_products"},{"role":"anon","allowed":true,"privilege":"SELECT","table_name":"user_products"},{"role":"anon","allowed":false,"privilege":"TRIGGER","table_name":"user_products"},{"role":"anon","allowed":false,"privilege":"TRUNCATE","table_name":"user_products"},{"role":"anon","allowed":false,"privilege":"UPDATE","table_name":"user_products"},{"role":"authenticated","allowed":false,"privilege":"DELETE","table_name":"user_products"},{"role":"authenticated","allowed":false,"privilege":"INSERT","table_name":"user_products"},{"role":"authenticated","allowed":false,"privilege":"REFERENCES","table_name":"user_products"},{"role":"authenticated","allowed":true,"privilege":"SELECT","table_name":"user_products"},{"role":"authenticated","allowed":false,"privilege":"TRIGGER","table_name":"user_products"},{"role":"authenticated","allowed":false,"privilege":"TRUNCATE","table_name":"user_products"},{"role":"authenticated","allowed":false,"privilege":"UPDATE","table_name":"user_products"},{"role":"service_role","allowed":false,"privilege":"DELETE","table_name":"user_products"},{"role":"service_role","allowed":false,"privilege":"INSERT","table_name":"user_products"},{"role":"service_role","allowed":false,"privilege":"REFERENCES","table_name":"user_products"},{"role":"service_role","allowed":true,"privilege":"SELECT","table_name":"user_products"},{"role":"service_role","allowed":false,"privilege":"TRIGGER","table_name":"user_products"},{"role":"service_role","allowed":false,"privilege":"TRUNCATE","table_name":"user_products"},{"role":"service_role","allowed":false,"privilege":"UPDATE","table_name":"user_products"},{"role":"anon","allowed":true,"privilege":"DELETE","table_name":"waitlist_signups"},{"role":"anon","allowed":true,"privilege":"INSERT","table_name":"waitlist_signups"},{"role":"anon","allowed":false,"privilege":"REFERENCES","table_name":"waitlist_signups"},{"role":"anon","allowed":true,"privilege":"SELECT","table_name":"waitlist_signups"},{"role":"anon","allowed":false,"privilege":"TRIGGER","table_name":"waitlist_signups"},{"role":"anon","allowed":false,"privilege":"TRUNCATE","table_name":"waitlist_signups"},{"role":"anon","allowed":true,"privilege":"UPDATE","table_name":"waitlist_signups"},{"role":"authenticated","allowed":true,"privilege":"DELETE","table_name":"waitlist_signups"},{"role":"authenticated","allowed":true,"privilege":"INSERT","table_name":"waitlist_signups"},{"role":"authenticated","allowed":false,"privilege":"REFERENCES","table_name":"waitlist_signups"},{"role":"authenticated","allowed":true,"privilege":"SELECT","table_name":"waitlist_signups"},{"role":"authenticated","allowed":false,"privilege":"TRIGGER","table_name":"waitlist_signups"},{"role":"authenticated","allowed":false,"privilege":"TRUNCATE","table_name":"waitlist_signups"},{"role":"authenticated","allowed":true,"privilege":"UPDATE","table_name":"waitlist_signups"},{"role":"service_role","allowed":true,"privilege":"DELETE","table_name":"waitlist_signups"},{"role":"service_role","allowed":true,"privilege":"INSERT","table_name":"waitlist_signups"},{"role":"service_role","allowed":true,"privilege":"REFERENCES","table_name":"waitlist_signups"},{"role":"service_role","allowed":true,"privilege":"SELECT","table_name":"waitlist_signups"},{"role":"service_role","allowed":true,"privilege":"TRIGGER","table_name":"waitlist_signups"},{"role":"service_role","allowed":true,"privilege":"TRUNCATE","table_name":"waitlist_signups"},{"role":"service_role","allowed":true,"privilege":"UPDATE","table_name":"waitlist_signups"}]'::jsonb,'all 1,911 effective privileges equal baseline with exactly 162 removals');

select is((select jsonb_agg(to_jsonb(t) order by owner,schema,object_type,grantee,privilege_type) from (
select pg_get_userbyid(d.defaclrole) owner,n.nspname schema,d.defaclobjtype object_type,
case when a.grantee=0 then 'PUBLIC' else pg_get_userbyid(a.grantee) end grantee,pg_get_userbyid(a.grantor) grantor,a.privilege_type,a.is_grantable
from pg_default_acl d left join pg_namespace n on n.oid=d.defaclnamespace cross join lateral aclexplode(d.defaclacl)a)t),'[{"owner":"postgres","schema":"public","grantee":"anon","grantor":"postgres","object_type":"S","is_grantable":false,"privilege_type":"SELECT"},{"owner":"postgres","schema":"public","grantee":"anon","grantor":"postgres","object_type":"S","is_grantable":false,"privilege_type":"UPDATE"},{"owner":"postgres","schema":"public","grantee":"anon","grantor":"postgres","object_type":"S","is_grantable":false,"privilege_type":"USAGE"},{"owner":"postgres","schema":"public","grantee":"authenticated","grantor":"postgres","object_type":"S","is_grantable":false,"privilege_type":"SELECT"},{"owner":"postgres","schema":"public","grantee":"authenticated","grantor":"postgres","object_type":"S","is_grantable":false,"privilege_type":"UPDATE"},{"owner":"postgres","schema":"public","grantee":"authenticated","grantor":"postgres","object_type":"S","is_grantable":false,"privilege_type":"USAGE"},{"owner":"postgres","schema":"public","grantee":"postgres","grantor":"postgres","object_type":"S","is_grantable":false,"privilege_type":"SELECT"},{"owner":"postgres","schema":"public","grantee":"postgres","grantor":"postgres","object_type":"S","is_grantable":false,"privilege_type":"UPDATE"},{"owner":"postgres","schema":"public","grantee":"postgres","grantor":"postgres","object_type":"S","is_grantable":false,"privilege_type":"USAGE"},{"owner":"postgres","schema":"public","grantee":"service_role","grantor":"postgres","object_type":"S","is_grantable":false,"privilege_type":"SELECT"},{"owner":"postgres","schema":"public","grantee":"service_role","grantor":"postgres","object_type":"S","is_grantable":false,"privilege_type":"UPDATE"},{"owner":"postgres","schema":"public","grantee":"service_role","grantor":"postgres","object_type":"S","is_grantable":false,"privilege_type":"USAGE"},{"owner":"postgres","schema":"public","grantee":"anon","grantor":"postgres","object_type":"f","is_grantable":false,"privilege_type":"EXECUTE"},{"owner":"postgres","schema":"public","grantee":"authenticated","grantor":"postgres","object_type":"f","is_grantable":false,"privilege_type":"EXECUTE"},{"owner":"postgres","schema":"public","grantee":"postgres","grantor":"postgres","object_type":"f","is_grantable":false,"privilege_type":"EXECUTE"},{"owner":"postgres","schema":"public","grantee":"service_role","grantor":"postgres","object_type":"f","is_grantable":false,"privilege_type":"EXECUTE"},{"owner":"postgres","schema":"public","grantee":"anon","grantor":"postgres","object_type":"r","is_grantable":false,"privilege_type":"DELETE"},{"owner":"postgres","schema":"public","grantee":"anon","grantor":"postgres","object_type":"r","is_grantable":false,"privilege_type":"INSERT"},{"owner":"postgres","schema":"public","grantee":"anon","grantor":"postgres","object_type":"r","is_grantable":false,"privilege_type":"SELECT"},{"owner":"postgres","schema":"public","grantee":"anon","grantor":"postgres","object_type":"r","is_grantable":false,"privilege_type":"UPDATE"},{"owner":"postgres","schema":"public","grantee":"authenticated","grantor":"postgres","object_type":"r","is_grantable":false,"privilege_type":"DELETE"},{"owner":"postgres","schema":"public","grantee":"authenticated","grantor":"postgres","object_type":"r","is_grantable":false,"privilege_type":"INSERT"},{"owner":"postgres","schema":"public","grantee":"authenticated","grantor":"postgres","object_type":"r","is_grantable":false,"privilege_type":"SELECT"},{"owner":"postgres","schema":"public","grantee":"authenticated","grantor":"postgres","object_type":"r","is_grantable":false,"privilege_type":"UPDATE"},{"owner":"postgres","schema":"public","grantee":"postgres","grantor":"postgres","object_type":"r","is_grantable":false,"privilege_type":"DELETE"},{"owner":"postgres","schema":"public","grantee":"postgres","grantor":"postgres","object_type":"r","is_grantable":false,"privilege_type":"INSERT"},{"owner":"postgres","schema":"public","grantee":"postgres","grantor":"postgres","object_type":"r","is_grantable":false,"privilege_type":"REFERENCES"},{"owner":"postgres","schema":"public","grantee":"postgres","grantor":"postgres","object_type":"r","is_grantable":false,"privilege_type":"SELECT"},{"owner":"postgres","schema":"public","grantee":"postgres","grantor":"postgres","object_type":"r","is_grantable":false,"privilege_type":"TRIGGER"},{"owner":"postgres","schema":"public","grantee":"postgres","grantor":"postgres","object_type":"r","is_grantable":false,"privilege_type":"TRUNCATE"},{"owner":"postgres","schema":"public","grantee":"postgres","grantor":"postgres","object_type":"r","is_grantable":false,"privilege_type":"UPDATE"},{"owner":"postgres","schema":"public","grantee":"service_role","grantor":"postgres","object_type":"r","is_grantable":false,"privilege_type":"DELETE"},{"owner":"postgres","schema":"public","grantee":"service_role","grantor":"postgres","object_type":"r","is_grantable":false,"privilege_type":"INSERT"},{"owner":"postgres","schema":"public","grantee":"service_role","grantor":"postgres","object_type":"r","is_grantable":false,"privilege_type":"REFERENCES"},{"owner":"postgres","schema":"public","grantee":"service_role","grantor":"postgres","object_type":"r","is_grantable":false,"privilege_type":"SELECT"},{"owner":"postgres","schema":"public","grantee":"service_role","grantor":"postgres","object_type":"r","is_grantable":false,"privilege_type":"TRIGGER"},{"owner":"postgres","schema":"public","grantee":"service_role","grantor":"postgres","object_type":"r","is_grantable":false,"privilege_type":"TRUNCATE"},{"owner":"postgres","schema":"public","grantee":"service_role","grantor":"postgres","object_type":"r","is_grantable":false,"privilege_type":"UPDATE"},{"owner":"postgres","schema":"storage","grantee":"anon","grantor":"postgres","object_type":"S","is_grantable":false,"privilege_type":"SELECT"},{"owner":"postgres","schema":"storage","grantee":"anon","grantor":"postgres","object_type":"S","is_grantable":false,"privilege_type":"UPDATE"},{"owner":"postgres","schema":"storage","grantee":"anon","grantor":"postgres","object_type":"S","is_grantable":false,"privilege_type":"USAGE"},{"owner":"postgres","schema":"storage","grantee":"authenticated","grantor":"postgres","object_type":"S","is_grantable":false,"privilege_type":"SELECT"},{"owner":"postgres","schema":"storage","grantee":"authenticated","grantor":"postgres","object_type":"S","is_grantable":false,"privilege_type":"UPDATE"},{"owner":"postgres","schema":"storage","grantee":"authenticated","grantor":"postgres","object_type":"S","is_grantable":false,"privilege_type":"USAGE"},{"owner":"postgres","schema":"storage","grantee":"postgres","grantor":"postgres","object_type":"S","is_grantable":false,"privilege_type":"SELECT"},{"owner":"postgres","schema":"storage","grantee":"postgres","grantor":"postgres","object_type":"S","is_grantable":false,"privilege_type":"UPDATE"},{"owner":"postgres","schema":"storage","grantee":"postgres","grantor":"postgres","object_type":"S","is_grantable":false,"privilege_type":"USAGE"},{"owner":"postgres","schema":"storage","grantee":"service_role","grantor":"postgres","object_type":"S","is_grantable":false,"privilege_type":"SELECT"},{"owner":"postgres","schema":"storage","grantee":"service_role","grantor":"postgres","object_type":"S","is_grantable":false,"privilege_type":"UPDATE"},{"owner":"postgres","schema":"storage","grantee":"service_role","grantor":"postgres","object_type":"S","is_grantable":false,"privilege_type":"USAGE"},{"owner":"postgres","schema":"storage","grantee":"anon","grantor":"postgres","object_type":"f","is_grantable":false,"privilege_type":"EXECUTE"},{"owner":"postgres","schema":"storage","grantee":"authenticated","grantor":"postgres","object_type":"f","is_grantable":false,"privilege_type":"EXECUTE"},{"owner":"postgres","schema":"storage","grantee":"postgres","grantor":"postgres","object_type":"f","is_grantable":false,"privilege_type":"EXECUTE"},{"owner":"postgres","schema":"storage","grantee":"service_role","grantor":"postgres","object_type":"f","is_grantable":false,"privilege_type":"EXECUTE"},{"owner":"postgres","schema":"storage","grantee":"anon","grantor":"postgres","object_type":"r","is_grantable":false,"privilege_type":"DELETE"},{"owner":"postgres","schema":"storage","grantee":"anon","grantor":"postgres","object_type":"r","is_grantable":false,"privilege_type":"INSERT"},{"owner":"postgres","schema":"storage","grantee":"anon","grantor":"postgres","object_type":"r","is_grantable":false,"privilege_type":"REFERENCES"},{"owner":"postgres","schema":"storage","grantee":"anon","grantor":"postgres","object_type":"r","is_grantable":false,"privilege_type":"SELECT"},{"owner":"postgres","schema":"storage","grantee":"anon","grantor":"postgres","object_type":"r","is_grantable":false,"privilege_type":"TRIGGER"},{"owner":"postgres","schema":"storage","grantee":"anon","grantor":"postgres","object_type":"r","is_grantable":false,"privilege_type":"TRUNCATE"},{"owner":"postgres","schema":"storage","grantee":"anon","grantor":"postgres","object_type":"r","is_grantable":false,"privilege_type":"UPDATE"},{"owner":"postgres","schema":"storage","grantee":"authenticated","grantor":"postgres","object_type":"r","is_grantable":false,"privilege_type":"DELETE"},{"owner":"postgres","schema":"storage","grantee":"authenticated","grantor":"postgres","object_type":"r","is_grantable":false,"privilege_type":"INSERT"},{"owner":"postgres","schema":"storage","grantee":"authenticated","grantor":"postgres","object_type":"r","is_grantable":false,"privilege_type":"REFERENCES"},{"owner":"postgres","schema":"storage","grantee":"authenticated","grantor":"postgres","object_type":"r","is_grantable":false,"privilege_type":"SELECT"},{"owner":"postgres","schema":"storage","grantee":"authenticated","grantor":"postgres","object_type":"r","is_grantable":false,"privilege_type":"TRIGGER"},{"owner":"postgres","schema":"storage","grantee":"authenticated","grantor":"postgres","object_type":"r","is_grantable":false,"privilege_type":"TRUNCATE"},{"owner":"postgres","schema":"storage","grantee":"authenticated","grantor":"postgres","object_type":"r","is_grantable":false,"privilege_type":"UPDATE"},{"owner":"postgres","schema":"storage","grantee":"postgres","grantor":"postgres","object_type":"r","is_grantable":false,"privilege_type":"DELETE"},{"owner":"postgres","schema":"storage","grantee":"postgres","grantor":"postgres","object_type":"r","is_grantable":false,"privilege_type":"INSERT"},{"owner":"postgres","schema":"storage","grantee":"postgres","grantor":"postgres","object_type":"r","is_grantable":false,"privilege_type":"REFERENCES"},{"owner":"postgres","schema":"storage","grantee":"postgres","grantor":"postgres","object_type":"r","is_grantable":false,"privilege_type":"SELECT"},{"owner":"postgres","schema":"storage","grantee":"postgres","grantor":"postgres","object_type":"r","is_grantable":false,"privilege_type":"TRIGGER"},{"owner":"postgres","schema":"storage","grantee":"postgres","grantor":"postgres","object_type":"r","is_grantable":false,"privilege_type":"TRUNCATE"},{"owner":"postgres","schema":"storage","grantee":"postgres","grantor":"postgres","object_type":"r","is_grantable":false,"privilege_type":"UPDATE"},{"owner":"postgres","schema":"storage","grantee":"service_role","grantor":"postgres","object_type":"r","is_grantable":false,"privilege_type":"DELETE"},{"owner":"postgres","schema":"storage","grantee":"service_role","grantor":"postgres","object_type":"r","is_grantable":false,"privilege_type":"INSERT"},{"owner":"postgres","schema":"storage","grantee":"service_role","grantor":"postgres","object_type":"r","is_grantable":false,"privilege_type":"REFERENCES"},{"owner":"postgres","schema":"storage","grantee":"service_role","grantor":"postgres","object_type":"r","is_grantable":false,"privilege_type":"SELECT"},{"owner":"postgres","schema":"storage","grantee":"service_role","grantor":"postgres","object_type":"r","is_grantable":false,"privilege_type":"TRIGGER"},{"owner":"postgres","schema":"storage","grantee":"service_role","grantor":"postgres","object_type":"r","is_grantable":false,"privilege_type":"TRUNCATE"},{"owner":"postgres","schema":"storage","grantee":"service_role","grantor":"postgres","object_type":"r","is_grantable":false,"privilege_type":"UPDATE"},{"owner":"postgres","schema":null,"grantee":"postgres","grantor":"postgres","object_type":"f","is_grantable":false,"privilege_type":"EXECUTE"},{"owner":"supabase_admin","schema":"extensions","grantee":"postgres","grantor":"supabase_admin","object_type":"S","is_grantable":true,"privilege_type":"SELECT"},{"owner":"supabase_admin","schema":"extensions","grantee":"postgres","grantor":"supabase_admin","object_type":"S","is_grantable":true,"privilege_type":"UPDATE"},{"owner":"supabase_admin","schema":"extensions","grantee":"postgres","grantor":"supabase_admin","object_type":"S","is_grantable":true,"privilege_type":"USAGE"},{"owner":"supabase_admin","schema":"extensions","grantee":"postgres","grantor":"supabase_admin","object_type":"f","is_grantable":true,"privilege_type":"EXECUTE"},{"owner":"supabase_admin","schema":"extensions","grantee":"postgres","grantor":"supabase_admin","object_type":"r","is_grantable":true,"privilege_type":"DELETE"},{"owner":"supabase_admin","schema":"extensions","grantee":"postgres","grantor":"supabase_admin","object_type":"r","is_grantable":true,"privilege_type":"INSERT"},{"owner":"supabase_admin","schema":"extensions","grantee":"postgres","grantor":"supabase_admin","object_type":"r","is_grantable":true,"privilege_type":"REFERENCES"},{"owner":"supabase_admin","schema":"extensions","grantee":"postgres","grantor":"supabase_admin","object_type":"r","is_grantable":true,"privilege_type":"SELECT"},{"owner":"supabase_admin","schema":"extensions","grantee":"postgres","grantor":"supabase_admin","object_type":"r","is_grantable":true,"privilege_type":"TRIGGER"},{"owner":"supabase_admin","schema":"extensions","grantee":"postgres","grantor":"supabase_admin","object_type":"r","is_grantable":true,"privilege_type":"TRUNCATE"},{"owner":"supabase_admin","schema":"extensions","grantee":"postgres","grantor":"supabase_admin","object_type":"r","is_grantable":true,"privilege_type":"UPDATE"},{"owner":"supabase_admin","schema":"graphql","grantee":"anon","grantor":"supabase_admin","object_type":"S","is_grantable":false,"privilege_type":"SELECT"},{"owner":"supabase_admin","schema":"graphql","grantee":"anon","grantor":"supabase_admin","object_type":"S","is_grantable":false,"privilege_type":"UPDATE"},{"owner":"supabase_admin","schema":"graphql","grantee":"anon","grantor":"supabase_admin","object_type":"S","is_grantable":false,"privilege_type":"USAGE"},{"owner":"supabase_admin","schema":"graphql","grantee":"authenticated","grantor":"supabase_admin","object_type":"S","is_grantable":false,"privilege_type":"SELECT"},{"owner":"supabase_admin","schema":"graphql","grantee":"authenticated","grantor":"supabase_admin","object_type":"S","is_grantable":false,"privilege_type":"UPDATE"},{"owner":"supabase_admin","schema":"graphql","grantee":"authenticated","grantor":"supabase_admin","object_type":"S","is_grantable":false,"privilege_type":"USAGE"},{"owner":"supabase_admin","schema":"graphql","grantee":"postgres","grantor":"supabase_admin","object_type":"S","is_grantable":false,"privilege_type":"SELECT"},{"owner":"supabase_admin","schema":"graphql","grantee":"postgres","grantor":"supabase_admin","object_type":"S","is_grantable":false,"privilege_type":"UPDATE"},{"owner":"supabase_admin","schema":"graphql","grantee":"postgres","grantor":"supabase_admin","object_type":"S","is_grantable":false,"privilege_type":"USAGE"},{"owner":"supabase_admin","schema":"graphql","grantee":"service_role","grantor":"supabase_admin","object_type":"S","is_grantable":false,"privilege_type":"SELECT"},{"owner":"supabase_admin","schema":"graphql","grantee":"service_role","grantor":"supabase_admin","object_type":"S","is_grantable":false,"privilege_type":"UPDATE"},{"owner":"supabase_admin","schema":"graphql","grantee":"service_role","grantor":"supabase_admin","object_type":"S","is_grantable":false,"privilege_type":"USAGE"},{"owner":"supabase_admin","schema":"graphql","grantee":"anon","grantor":"supabase_admin","object_type":"f","is_grantable":false,"privilege_type":"EXECUTE"},{"owner":"supabase_admin","schema":"graphql","grantee":"authenticated","grantor":"supabase_admin","object_type":"f","is_grantable":false,"privilege_type":"EXECUTE"},{"owner":"supabase_admin","schema":"graphql","grantee":"postgres","grantor":"supabase_admin","object_type":"f","is_grantable":false,"privilege_type":"EXECUTE"},{"owner":"supabase_admin","schema":"graphql","grantee":"service_role","grantor":"supabase_admin","object_type":"f","is_grantable":false,"privilege_type":"EXECUTE"},{"owner":"supabase_admin","schema":"graphql","grantee":"anon","grantor":"supabase_admin","object_type":"r","is_grantable":false,"privilege_type":"DELETE"},{"owner":"supabase_admin","schema":"graphql","grantee":"anon","grantor":"supabase_admin","object_type":"r","is_grantable":false,"privilege_type":"INSERT"},{"owner":"supabase_admin","schema":"graphql","grantee":"anon","grantor":"supabase_admin","object_type":"r","is_grantable":false,"privilege_type":"REFERENCES"},{"owner":"supabase_admin","schema":"graphql","grantee":"anon","grantor":"supabase_admin","object_type":"r","is_grantable":false,"privilege_type":"SELECT"},{"owner":"supabase_admin","schema":"graphql","grantee":"anon","grantor":"supabase_admin","object_type":"r","is_grantable":false,"privilege_type":"TRIGGER"},{"owner":"supabase_admin","schema":"graphql","grantee":"anon","grantor":"supabase_admin","object_type":"r","is_grantable":false,"privilege_type":"TRUNCATE"},{"owner":"supabase_admin","schema":"graphql","grantee":"anon","grantor":"supabase_admin","object_type":"r","is_grantable":false,"privilege_type":"UPDATE"},{"owner":"supabase_admin","schema":"graphql","grantee":"authenticated","grantor":"supabase_admin","object_type":"r","is_grantable":false,"privilege_type":"DELETE"},{"owner":"supabase_admin","schema":"graphql","grantee":"authenticated","grantor":"supabase_admin","object_type":"r","is_grantable":false,"privilege_type":"INSERT"},{"owner":"supabase_admin","schema":"graphql","grantee":"authenticated","grantor":"supabase_admin","object_type":"r","is_grantable":false,"privilege_type":"REFERENCES"},{"owner":"supabase_admin","schema":"graphql","grantee":"authenticated","grantor":"supabase_admin","object_type":"r","is_grantable":false,"privilege_type":"SELECT"},{"owner":"supabase_admin","schema":"graphql","grantee":"authenticated","grantor":"supabase_admin","object_type":"r","is_grantable":false,"privilege_type":"TRIGGER"},{"owner":"supabase_admin","schema":"graphql","grantee":"authenticated","grantor":"supabase_admin","object_type":"r","is_grantable":false,"privilege_type":"TRUNCATE"},{"owner":"supabase_admin","schema":"graphql","grantee":"authenticated","grantor":"supabase_admin","object_type":"r","is_grantable":false,"privilege_type":"UPDATE"},{"owner":"supabase_admin","schema":"graphql","grantee":"postgres","grantor":"supabase_admin","object_type":"r","is_grantable":false,"privilege_type":"DELETE"},{"owner":"supabase_admin","schema":"graphql","grantee":"postgres","grantor":"supabase_admin","object_type":"r","is_grantable":false,"privilege_type":"INSERT"},{"owner":"supabase_admin","schema":"graphql","grantee":"postgres","grantor":"supabase_admin","object_type":"r","is_grantable":false,"privilege_type":"REFERENCES"},{"owner":"supabase_admin","schema":"graphql","grantee":"postgres","grantor":"supabase_admin","object_type":"r","is_grantable":false,"privilege_type":"SELECT"},{"owner":"supabase_admin","schema":"graphql","grantee":"postgres","grantor":"supabase_admin","object_type":"r","is_grantable":false,"privilege_type":"TRIGGER"},{"owner":"supabase_admin","schema":"graphql","grantee":"postgres","grantor":"supabase_admin","object_type":"r","is_grantable":false,"privilege_type":"TRUNCATE"},{"owner":"supabase_admin","schema":"graphql","grantee":"postgres","grantor":"supabase_admin","object_type":"r","is_grantable":false,"privilege_type":"UPDATE"},{"owner":"supabase_admin","schema":"graphql","grantee":"service_role","grantor":"supabase_admin","object_type":"r","is_grantable":false,"privilege_type":"DELETE"},{"owner":"supabase_admin","schema":"graphql","grantee":"service_role","grantor":"supabase_admin","object_type":"r","is_grantable":false,"privilege_type":"INSERT"},{"owner":"supabase_admin","schema":"graphql","grantee":"service_role","grantor":"supabase_admin","object_type":"r","is_grantable":false,"privilege_type":"REFERENCES"},{"owner":"supabase_admin","schema":"graphql","grantee":"service_role","grantor":"supabase_admin","object_type":"r","is_grantable":false,"privilege_type":"SELECT"},{"owner":"supabase_admin","schema":"graphql","grantee":"service_role","grantor":"supabase_admin","object_type":"r","is_grantable":false,"privilege_type":"TRIGGER"},{"owner":"supabase_admin","schema":"graphql","grantee":"service_role","grantor":"supabase_admin","object_type":"r","is_grantable":false,"privilege_type":"TRUNCATE"},{"owner":"supabase_admin","schema":"graphql","grantee":"service_role","grantor":"supabase_admin","object_type":"r","is_grantable":false,"privilege_type":"UPDATE"},{"owner":"supabase_admin","schema":"graphql_public","grantee":"anon","grantor":"supabase_admin","object_type":"S","is_grantable":false,"privilege_type":"SELECT"},{"owner":"supabase_admin","schema":"graphql_public","grantee":"anon","grantor":"supabase_admin","object_type":"S","is_grantable":false,"privilege_type":"UPDATE"},{"owner":"supabase_admin","schema":"graphql_public","grantee":"anon","grantor":"supabase_admin","object_type":"S","is_grantable":false,"privilege_type":"USAGE"},{"owner":"supabase_admin","schema":"graphql_public","grantee":"authenticated","grantor":"supabase_admin","object_type":"S","is_grantable":false,"privilege_type":"SELECT"},{"owner":"supabase_admin","schema":"graphql_public","grantee":"authenticated","grantor":"supabase_admin","object_type":"S","is_grantable":false,"privilege_type":"UPDATE"},{"owner":"supabase_admin","schema":"graphql_public","grantee":"authenticated","grantor":"supabase_admin","object_type":"S","is_grantable":false,"privilege_type":"USAGE"},{"owner":"supabase_admin","schema":"graphql_public","grantee":"postgres","grantor":"supabase_admin","object_type":"S","is_grantable":false,"privilege_type":"SELECT"},{"owner":"supabase_admin","schema":"graphql_public","grantee":"postgres","grantor":"supabase_admin","object_type":"S","is_grantable":false,"privilege_type":"UPDATE"},{"owner":"supabase_admin","schema":"graphql_public","grantee":"postgres","grantor":"supabase_admin","object_type":"S","is_grantable":false,"privilege_type":"USAGE"},{"owner":"supabase_admin","schema":"graphql_public","grantee":"service_role","grantor":"supabase_admin","object_type":"S","is_grantable":false,"privilege_type":"SELECT"},{"owner":"supabase_admin","schema":"graphql_public","grantee":"service_role","grantor":"supabase_admin","object_type":"S","is_grantable":false,"privilege_type":"UPDATE"},{"owner":"supabase_admin","schema":"graphql_public","grantee":"service_role","grantor":"supabase_admin","object_type":"S","is_grantable":false,"privilege_type":"USAGE"},{"owner":"supabase_admin","schema":"graphql_public","grantee":"anon","grantor":"supabase_admin","object_type":"f","is_grantable":false,"privilege_type":"EXECUTE"},{"owner":"supabase_admin","schema":"graphql_public","grantee":"authenticated","grantor":"supabase_admin","object_type":"f","is_grantable":false,"privilege_type":"EXECUTE"},{"owner":"supabase_admin","schema":"graphql_public","grantee":"postgres","grantor":"supabase_admin","object_type":"f","is_grantable":false,"privilege_type":"EXECUTE"},{"owner":"supabase_admin","schema":"graphql_public","grantee":"service_role","grantor":"supabase_admin","object_type":"f","is_grantable":false,"privilege_type":"EXECUTE"},{"owner":"supabase_admin","schema":"graphql_public","grantee":"anon","grantor":"supabase_admin","object_type":"r","is_grantable":false,"privilege_type":"DELETE"},{"owner":"supabase_admin","schema":"graphql_public","grantee":"anon","grantor":"supabase_admin","object_type":"r","is_grantable":false,"privilege_type":"INSERT"},{"owner":"supabase_admin","schema":"graphql_public","grantee":"anon","grantor":"supabase_admin","object_type":"r","is_grantable":false,"privilege_type":"REFERENCES"},{"owner":"supabase_admin","schema":"graphql_public","grantee":"anon","grantor":"supabase_admin","object_type":"r","is_grantable":false,"privilege_type":"SELECT"},{"owner":"supabase_admin","schema":"graphql_public","grantee":"anon","grantor":"supabase_admin","object_type":"r","is_grantable":false,"privilege_type":"TRIGGER"},{"owner":"supabase_admin","schema":"graphql_public","grantee":"anon","grantor":"supabase_admin","object_type":"r","is_grantable":false,"privilege_type":"TRUNCATE"},{"owner":"supabase_admin","schema":"graphql_public","grantee":"anon","grantor":"supabase_admin","object_type":"r","is_grantable":false,"privilege_type":"UPDATE"},{"owner":"supabase_admin","schema":"graphql_public","grantee":"authenticated","grantor":"supabase_admin","object_type":"r","is_grantable":false,"privilege_type":"DELETE"},{"owner":"supabase_admin","schema":"graphql_public","grantee":"authenticated","grantor":"supabase_admin","object_type":"r","is_grantable":false,"privilege_type":"INSERT"},{"owner":"supabase_admin","schema":"graphql_public","grantee":"authenticated","grantor":"supabase_admin","object_type":"r","is_grantable":false,"privilege_type":"REFERENCES"},{"owner":"supabase_admin","schema":"graphql_public","grantee":"authenticated","grantor":"supabase_admin","object_type":"r","is_grantable":false,"privilege_type":"SELECT"},{"owner":"supabase_admin","schema":"graphql_public","grantee":"authenticated","grantor":"supabase_admin","object_type":"r","is_grantable":false,"privilege_type":"TRIGGER"},{"owner":"supabase_admin","schema":"graphql_public","grantee":"authenticated","grantor":"supabase_admin","object_type":"r","is_grantable":false,"privilege_type":"TRUNCATE"},{"owner":"supabase_admin","schema":"graphql_public","grantee":"authenticated","grantor":"supabase_admin","object_type":"r","is_grantable":false,"privilege_type":"UPDATE"},{"owner":"supabase_admin","schema":"graphql_public","grantee":"postgres","grantor":"supabase_admin","object_type":"r","is_grantable":false,"privilege_type":"DELETE"},{"owner":"supabase_admin","schema":"graphql_public","grantee":"postgres","grantor":"supabase_admin","object_type":"r","is_grantable":false,"privilege_type":"INSERT"},{"owner":"supabase_admin","schema":"graphql_public","grantee":"postgres","grantor":"supabase_admin","object_type":"r","is_grantable":false,"privilege_type":"REFERENCES"},{"owner":"supabase_admin","schema":"graphql_public","grantee":"postgres","grantor":"supabase_admin","object_type":"r","is_grantable":false,"privilege_type":"SELECT"},{"owner":"supabase_admin","schema":"graphql_public","grantee":"postgres","grantor":"supabase_admin","object_type":"r","is_grantable":false,"privilege_type":"TRIGGER"},{"owner":"supabase_admin","schema":"graphql_public","grantee":"postgres","grantor":"supabase_admin","object_type":"r","is_grantable":false,"privilege_type":"TRUNCATE"},{"owner":"supabase_admin","schema":"graphql_public","grantee":"postgres","grantor":"supabase_admin","object_type":"r","is_grantable":false,"privilege_type":"UPDATE"},{"owner":"supabase_admin","schema":"graphql_public","grantee":"service_role","grantor":"supabase_admin","object_type":"r","is_grantable":false,"privilege_type":"DELETE"},{"owner":"supabase_admin","schema":"graphql_public","grantee":"service_role","grantor":"supabase_admin","object_type":"r","is_grantable":false,"privilege_type":"INSERT"},{"owner":"supabase_admin","schema":"graphql_public","grantee":"service_role","grantor":"supabase_admin","object_type":"r","is_grantable":false,"privilege_type":"REFERENCES"},{"owner":"supabase_admin","schema":"graphql_public","grantee":"service_role","grantor":"supabase_admin","object_type":"r","is_grantable":false,"privilege_type":"SELECT"},{"owner":"supabase_admin","schema":"graphql_public","grantee":"service_role","grantor":"supabase_admin","object_type":"r","is_grantable":false,"privilege_type":"TRIGGER"},{"owner":"supabase_admin","schema":"graphql_public","grantee":"service_role","grantor":"supabase_admin","object_type":"r","is_grantable":false,"privilege_type":"TRUNCATE"},{"owner":"supabase_admin","schema":"graphql_public","grantee":"service_role","grantor":"supabase_admin","object_type":"r","is_grantable":false,"privilege_type":"UPDATE"},{"owner":"supabase_admin","schema":"public","grantee":"anon","grantor":"supabase_admin","object_type":"S","is_grantable":false,"privilege_type":"SELECT"},{"owner":"supabase_admin","schema":"public","grantee":"anon","grantor":"supabase_admin","object_type":"S","is_grantable":false,"privilege_type":"UPDATE"},{"owner":"supabase_admin","schema":"public","grantee":"anon","grantor":"supabase_admin","object_type":"S","is_grantable":false,"privilege_type":"USAGE"},{"owner":"supabase_admin","schema":"public","grantee":"authenticated","grantor":"supabase_admin","object_type":"S","is_grantable":false,"privilege_type":"SELECT"},{"owner":"supabase_admin","schema":"public","grantee":"authenticated","grantor":"supabase_admin","object_type":"S","is_grantable":false,"privilege_type":"UPDATE"},{"owner":"supabase_admin","schema":"public","grantee":"authenticated","grantor":"supabase_admin","object_type":"S","is_grantable":false,"privilege_type":"USAGE"},{"owner":"supabase_admin","schema":"public","grantee":"postgres","grantor":"supabase_admin","object_type":"S","is_grantable":false,"privilege_type":"SELECT"},{"owner":"supabase_admin","schema":"public","grantee":"postgres","grantor":"supabase_admin","object_type":"S","is_grantable":false,"privilege_type":"UPDATE"},{"owner":"supabase_admin","schema":"public","grantee":"postgres","grantor":"supabase_admin","object_type":"S","is_grantable":false,"privilege_type":"USAGE"},{"owner":"supabase_admin","schema":"public","grantee":"service_role","grantor":"supabase_admin","object_type":"S","is_grantable":false,"privilege_type":"SELECT"},{"owner":"supabase_admin","schema":"public","grantee":"service_role","grantor":"supabase_admin","object_type":"S","is_grantable":false,"privilege_type":"UPDATE"},{"owner":"supabase_admin","schema":"public","grantee":"service_role","grantor":"supabase_admin","object_type":"S","is_grantable":false,"privilege_type":"USAGE"},{"owner":"supabase_admin","schema":"public","grantee":"anon","grantor":"supabase_admin","object_type":"f","is_grantable":false,"privilege_type":"EXECUTE"},{"owner":"supabase_admin","schema":"public","grantee":"authenticated","grantor":"supabase_admin","object_type":"f","is_grantable":false,"privilege_type":"EXECUTE"},{"owner":"supabase_admin","schema":"public","grantee":"postgres","grantor":"supabase_admin","object_type":"f","is_grantable":false,"privilege_type":"EXECUTE"},{"owner":"supabase_admin","schema":"public","grantee":"service_role","grantor":"supabase_admin","object_type":"f","is_grantable":false,"privilege_type":"EXECUTE"},{"owner":"supabase_admin","schema":"public","grantee":"anon","grantor":"supabase_admin","object_type":"r","is_grantable":false,"privilege_type":"DELETE"},{"owner":"supabase_admin","schema":"public","grantee":"anon","grantor":"supabase_admin","object_type":"r","is_grantable":false,"privilege_type":"INSERT"},{"owner":"supabase_admin","schema":"public","grantee":"anon","grantor":"supabase_admin","object_type":"r","is_grantable":false,"privilege_type":"REFERENCES"},{"owner":"supabase_admin","schema":"public","grantee":"anon","grantor":"supabase_admin","object_type":"r","is_grantable":false,"privilege_type":"SELECT"},{"owner":"supabase_admin","schema":"public","grantee":"anon","grantor":"supabase_admin","object_type":"r","is_grantable":false,"privilege_type":"TRIGGER"},{"owner":"supabase_admin","schema":"public","grantee":"anon","grantor":"supabase_admin","object_type":"r","is_grantable":false,"privilege_type":"TRUNCATE"},{"owner":"supabase_admin","schema":"public","grantee":"anon","grantor":"supabase_admin","object_type":"r","is_grantable":false,"privilege_type":"UPDATE"},{"owner":"supabase_admin","schema":"public","grantee":"authenticated","grantor":"supabase_admin","object_type":"r","is_grantable":false,"privilege_type":"DELETE"},{"owner":"supabase_admin","schema":"public","grantee":"authenticated","grantor":"supabase_admin","object_type":"r","is_grantable":false,"privilege_type":"INSERT"},{"owner":"supabase_admin","schema":"public","grantee":"authenticated","grantor":"supabase_admin","object_type":"r","is_grantable":false,"privilege_type":"REFERENCES"},{"owner":"supabase_admin","schema":"public","grantee":"authenticated","grantor":"supabase_admin","object_type":"r","is_grantable":false,"privilege_type":"SELECT"},{"owner":"supabase_admin","schema":"public","grantee":"authenticated","grantor":"supabase_admin","object_type":"r","is_grantable":false,"privilege_type":"TRIGGER"},{"owner":"supabase_admin","schema":"public","grantee":"authenticated","grantor":"supabase_admin","object_type":"r","is_grantable":false,"privilege_type":"TRUNCATE"},{"owner":"supabase_admin","schema":"public","grantee":"authenticated","grantor":"supabase_admin","object_type":"r","is_grantable":false,"privilege_type":"UPDATE"},{"owner":"supabase_admin","schema":"public","grantee":"postgres","grantor":"supabase_admin","object_type":"r","is_grantable":false,"privilege_type":"DELETE"},{"owner":"supabase_admin","schema":"public","grantee":"postgres","grantor":"supabase_admin","object_type":"r","is_grantable":false,"privilege_type":"INSERT"},{"owner":"supabase_admin","schema":"public","grantee":"postgres","grantor":"supabase_admin","object_type":"r","is_grantable":false,"privilege_type":"REFERENCES"},{"owner":"supabase_admin","schema":"public","grantee":"postgres","grantor":"supabase_admin","object_type":"r","is_grantable":false,"privilege_type":"SELECT"},{"owner":"supabase_admin","schema":"public","grantee":"postgres","grantor":"supabase_admin","object_type":"r","is_grantable":false,"privilege_type":"TRIGGER"},{"owner":"supabase_admin","schema":"public","grantee":"postgres","grantor":"supabase_admin","object_type":"r","is_grantable":false,"privilege_type":"TRUNCATE"},{"owner":"supabase_admin","schema":"public","grantee":"postgres","grantor":"supabase_admin","object_type":"r","is_grantable":false,"privilege_type":"UPDATE"},{"owner":"supabase_admin","schema":"public","grantee":"service_role","grantor":"supabase_admin","object_type":"r","is_grantable":false,"privilege_type":"DELETE"},{"owner":"supabase_admin","schema":"public","grantee":"service_role","grantor":"supabase_admin","object_type":"r","is_grantable":false,"privilege_type":"INSERT"},{"owner":"supabase_admin","schema":"public","grantee":"service_role","grantor":"supabase_admin","object_type":"r","is_grantable":false,"privilege_type":"REFERENCES"},{"owner":"supabase_admin","schema":"public","grantee":"service_role","grantor":"supabase_admin","object_type":"r","is_grantable":false,"privilege_type":"SELECT"},{"owner":"supabase_admin","schema":"public","grantee":"service_role","grantor":"supabase_admin","object_type":"r","is_grantable":false,"privilege_type":"TRIGGER"},{"owner":"supabase_admin","schema":"public","grantee":"service_role","grantor":"supabase_admin","object_type":"r","is_grantable":false,"privilege_type":"TRUNCATE"},{"owner":"supabase_admin","schema":"public","grantee":"service_role","grantor":"supabase_admin","object_type":"r","is_grantable":false,"privilege_type":"UPDATE"},{"owner":"supabase_admin","schema":"realtime","grantee":"dashboard_user","grantor":"supabase_admin","object_type":"S","is_grantable":false,"privilege_type":"SELECT"},{"owner":"supabase_admin","schema":"realtime","grantee":"dashboard_user","grantor":"supabase_admin","object_type":"S","is_grantable":false,"privilege_type":"UPDATE"},{"owner":"supabase_admin","schema":"realtime","grantee":"dashboard_user","grantor":"supabase_admin","object_type":"S","is_grantable":false,"privilege_type":"USAGE"},{"owner":"supabase_admin","schema":"realtime","grantee":"postgres","grantor":"supabase_admin","object_type":"S","is_grantable":false,"privilege_type":"SELECT"},{"owner":"supabase_admin","schema":"realtime","grantee":"postgres","grantor":"supabase_admin","object_type":"S","is_grantable":false,"privilege_type":"UPDATE"},{"owner":"supabase_admin","schema":"realtime","grantee":"postgres","grantor":"supabase_admin","object_type":"S","is_grantable":false,"privilege_type":"USAGE"},{"owner":"supabase_admin","schema":"realtime","grantee":"dashboard_user","grantor":"supabase_admin","object_type":"f","is_grantable":false,"privilege_type":"EXECUTE"},{"owner":"supabase_admin","schema":"realtime","grantee":"postgres","grantor":"supabase_admin","object_type":"f","is_grantable":false,"privilege_type":"EXECUTE"},{"owner":"supabase_admin","schema":"realtime","grantee":"dashboard_user","grantor":"supabase_admin","object_type":"r","is_grantable":false,"privilege_type":"DELETE"},{"owner":"supabase_admin","schema":"realtime","grantee":"dashboard_user","grantor":"supabase_admin","object_type":"r","is_grantable":false,"privilege_type":"INSERT"},{"owner":"supabase_admin","schema":"realtime","grantee":"dashboard_user","grantor":"supabase_admin","object_type":"r","is_grantable":false,"privilege_type":"REFERENCES"},{"owner":"supabase_admin","schema":"realtime","grantee":"dashboard_user","grantor":"supabase_admin","object_type":"r","is_grantable":false,"privilege_type":"SELECT"},{"owner":"supabase_admin","schema":"realtime","grantee":"dashboard_user","grantor":"supabase_admin","object_type":"r","is_grantable":false,"privilege_type":"TRIGGER"},{"owner":"supabase_admin","schema":"realtime","grantee":"dashboard_user","grantor":"supabase_admin","object_type":"r","is_grantable":false,"privilege_type":"TRUNCATE"},{"owner":"supabase_admin","schema":"realtime","grantee":"dashboard_user","grantor":"supabase_admin","object_type":"r","is_grantable":false,"privilege_type":"UPDATE"},{"owner":"supabase_admin","schema":"realtime","grantee":"postgres","grantor":"supabase_admin","object_type":"r","is_grantable":false,"privilege_type":"DELETE"},{"owner":"supabase_admin","schema":"realtime","grantee":"postgres","grantor":"supabase_admin","object_type":"r","is_grantable":false,"privilege_type":"INSERT"},{"owner":"supabase_admin","schema":"realtime","grantee":"postgres","grantor":"supabase_admin","object_type":"r","is_grantable":false,"privilege_type":"REFERENCES"},{"owner":"supabase_admin","schema":"realtime","grantee":"postgres","grantor":"supabase_admin","object_type":"r","is_grantable":false,"privilege_type":"SELECT"},{"owner":"supabase_admin","schema":"realtime","grantee":"postgres","grantor":"supabase_admin","object_type":"r","is_grantable":false,"privilege_type":"TRIGGER"},{"owner":"supabase_admin","schema":"realtime","grantee":"postgres","grantor":"supabase_admin","object_type":"r","is_grantable":false,"privilege_type":"TRUNCATE"},{"owner":"supabase_admin","schema":"realtime","grantee":"postgres","grantor":"supabase_admin","object_type":"r","is_grantable":false,"privilege_type":"UPDATE"},{"owner":"supabase_admin","schema":"supabase_functions","grantee":"anon","grantor":"supabase_admin","object_type":"S","is_grantable":false,"privilege_type":"SELECT"},{"owner":"supabase_admin","schema":"supabase_functions","grantee":"anon","grantor":"supabase_admin","object_type":"S","is_grantable":false,"privilege_type":"UPDATE"},{"owner":"supabase_admin","schema":"supabase_functions","grantee":"anon","grantor":"supabase_admin","object_type":"S","is_grantable":false,"privilege_type":"USAGE"},{"owner":"supabase_admin","schema":"supabase_functions","grantee":"authenticated","grantor":"supabase_admin","object_type":"S","is_grantable":false,"privilege_type":"SELECT"},{"owner":"supabase_admin","schema":"supabase_functions","grantee":"authenticated","grantor":"supabase_admin","object_type":"S","is_grantable":false,"privilege_type":"UPDATE"},{"owner":"supabase_admin","schema":"supabase_functions","grantee":"authenticated","grantor":"supabase_admin","object_type":"S","is_grantable":false,"privilege_type":"USAGE"},{"owner":"supabase_admin","schema":"supabase_functions","grantee":"postgres","grantor":"supabase_admin","object_type":"S","is_grantable":false,"privilege_type":"SELECT"},{"owner":"supabase_admin","schema":"supabase_functions","grantee":"postgres","grantor":"supabase_admin","object_type":"S","is_grantable":false,"privilege_type":"UPDATE"},{"owner":"supabase_admin","schema":"supabase_functions","grantee":"postgres","grantor":"supabase_admin","object_type":"S","is_grantable":false,"privilege_type":"USAGE"},{"owner":"supabase_admin","schema":"supabase_functions","grantee":"service_role","grantor":"supabase_admin","object_type":"S","is_grantable":false,"privilege_type":"SELECT"},{"owner":"supabase_admin","schema":"supabase_functions","grantee":"service_role","grantor":"supabase_admin","object_type":"S","is_grantable":false,"privilege_type":"UPDATE"},{"owner":"supabase_admin","schema":"supabase_functions","grantee":"service_role","grantor":"supabase_admin","object_type":"S","is_grantable":false,"privilege_type":"USAGE"},{"owner":"supabase_admin","schema":"supabase_functions","grantee":"anon","grantor":"supabase_admin","object_type":"f","is_grantable":false,"privilege_type":"EXECUTE"},{"owner":"supabase_admin","schema":"supabase_functions","grantee":"authenticated","grantor":"supabase_admin","object_type":"f","is_grantable":false,"privilege_type":"EXECUTE"},{"owner":"supabase_admin","schema":"supabase_functions","grantee":"postgres","grantor":"supabase_admin","object_type":"f","is_grantable":false,"privilege_type":"EXECUTE"},{"owner":"supabase_admin","schema":"supabase_functions","grantee":"service_role","grantor":"supabase_admin","object_type":"f","is_grantable":false,"privilege_type":"EXECUTE"},{"owner":"supabase_admin","schema":"supabase_functions","grantee":"anon","grantor":"supabase_admin","object_type":"r","is_grantable":false,"privilege_type":"DELETE"},{"owner":"supabase_admin","schema":"supabase_functions","grantee":"anon","grantor":"supabase_admin","object_type":"r","is_grantable":false,"privilege_type":"INSERT"},{"owner":"supabase_admin","schema":"supabase_functions","grantee":"anon","grantor":"supabase_admin","object_type":"r","is_grantable":false,"privilege_type":"REFERENCES"},{"owner":"supabase_admin","schema":"supabase_functions","grantee":"anon","grantor":"supabase_admin","object_type":"r","is_grantable":false,"privilege_type":"SELECT"},{"owner":"supabase_admin","schema":"supabase_functions","grantee":"anon","grantor":"supabase_admin","object_type":"r","is_grantable":false,"privilege_type":"TRIGGER"},{"owner":"supabase_admin","schema":"supabase_functions","grantee":"anon","grantor":"supabase_admin","object_type":"r","is_grantable":false,"privilege_type":"TRUNCATE"},{"owner":"supabase_admin","schema":"supabase_functions","grantee":"anon","grantor":"supabase_admin","object_type":"r","is_grantable":false,"privilege_type":"UPDATE"},{"owner":"supabase_admin","schema":"supabase_functions","grantee":"authenticated","grantor":"supabase_admin","object_type":"r","is_grantable":false,"privilege_type":"DELETE"},{"owner":"supabase_admin","schema":"supabase_functions","grantee":"authenticated","grantor":"supabase_admin","object_type":"r","is_grantable":false,"privilege_type":"INSERT"},{"owner":"supabase_admin","schema":"supabase_functions","grantee":"authenticated","grantor":"supabase_admin","object_type":"r","is_grantable":false,"privilege_type":"REFERENCES"},{"owner":"supabase_admin","schema":"supabase_functions","grantee":"authenticated","grantor":"supabase_admin","object_type":"r","is_grantable":false,"privilege_type":"SELECT"},{"owner":"supabase_admin","schema":"supabase_functions","grantee":"authenticated","grantor":"supabase_admin","object_type":"r","is_grantable":false,"privilege_type":"TRIGGER"},{"owner":"supabase_admin","schema":"supabase_functions","grantee":"authenticated","grantor":"supabase_admin","object_type":"r","is_grantable":false,"privilege_type":"TRUNCATE"},{"owner":"supabase_admin","schema":"supabase_functions","grantee":"authenticated","grantor":"supabase_admin","object_type":"r","is_grantable":false,"privilege_type":"UPDATE"},{"owner":"supabase_admin","schema":"supabase_functions","grantee":"postgres","grantor":"supabase_admin","object_type":"r","is_grantable":false,"privilege_type":"DELETE"},{"owner":"supabase_admin","schema":"supabase_functions","grantee":"postgres","grantor":"supabase_admin","object_type":"r","is_grantable":false,"privilege_type":"INSERT"},{"owner":"supabase_admin","schema":"supabase_functions","grantee":"postgres","grantor":"supabase_admin","object_type":"r","is_grantable":false,"privilege_type":"REFERENCES"},{"owner":"supabase_admin","schema":"supabase_functions","grantee":"postgres","grantor":"supabase_admin","object_type":"r","is_grantable":false,"privilege_type":"SELECT"},{"owner":"supabase_admin","schema":"supabase_functions","grantee":"postgres","grantor":"supabase_admin","object_type":"r","is_grantable":false,"privilege_type":"TRIGGER"},{"owner":"supabase_admin","schema":"supabase_functions","grantee":"postgres","grantor":"supabase_admin","object_type":"r","is_grantable":false,"privilege_type":"TRUNCATE"},{"owner":"supabase_admin","schema":"supabase_functions","grantee":"postgres","grantor":"supabase_admin","object_type":"r","is_grantable":false,"privilege_type":"UPDATE"},{"owner":"supabase_admin","schema":"supabase_functions","grantee":"service_role","grantor":"supabase_admin","object_type":"r","is_grantable":false,"privilege_type":"DELETE"},{"owner":"supabase_admin","schema":"supabase_functions","grantee":"service_role","grantor":"supabase_admin","object_type":"r","is_grantable":false,"privilege_type":"INSERT"},{"owner":"supabase_admin","schema":"supabase_functions","grantee":"service_role","grantor":"supabase_admin","object_type":"r","is_grantable":false,"privilege_type":"REFERENCES"},{"owner":"supabase_admin","schema":"supabase_functions","grantee":"service_role","grantor":"supabase_admin","object_type":"r","is_grantable":false,"privilege_type":"SELECT"},{"owner":"supabase_admin","schema":"supabase_functions","grantee":"service_role","grantor":"supabase_admin","object_type":"r","is_grantable":false,"privilege_type":"TRIGGER"},{"owner":"supabase_admin","schema":"supabase_functions","grantee":"service_role","grantor":"supabase_admin","object_type":"r","is_grantable":false,"privilege_type":"TRUNCATE"},{"owner":"supabase_admin","schema":"supabase_functions","grantee":"service_role","grantor":"supabase_admin","object_type":"r","is_grantable":false,"privilege_type":"UPDATE"},{"owner":"supabase_auth_admin","schema":"auth","grantee":"dashboard_user","grantor":"supabase_auth_admin","object_type":"S","is_grantable":false,"privilege_type":"SELECT"},{"owner":"supabase_auth_admin","schema":"auth","grantee":"dashboard_user","grantor":"supabase_auth_admin","object_type":"S","is_grantable":false,"privilege_type":"UPDATE"},{"owner":"supabase_auth_admin","schema":"auth","grantee":"dashboard_user","grantor":"supabase_auth_admin","object_type":"S","is_grantable":false,"privilege_type":"USAGE"},{"owner":"supabase_auth_admin","schema":"auth","grantee":"postgres","grantor":"supabase_auth_admin","object_type":"S","is_grantable":false,"privilege_type":"SELECT"},{"owner":"supabase_auth_admin","schema":"auth","grantee":"postgres","grantor":"supabase_auth_admin","object_type":"S","is_grantable":false,"privilege_type":"UPDATE"},{"owner":"supabase_auth_admin","schema":"auth","grantee":"postgres","grantor":"supabase_auth_admin","object_type":"S","is_grantable":false,"privilege_type":"USAGE"},{"owner":"supabase_auth_admin","schema":"auth","grantee":"dashboard_user","grantor":"supabase_auth_admin","object_type":"f","is_grantable":false,"privilege_type":"EXECUTE"},{"owner":"supabase_auth_admin","schema":"auth","grantee":"postgres","grantor":"supabase_auth_admin","object_type":"f","is_grantable":false,"privilege_type":"EXECUTE"},{"owner":"supabase_auth_admin","schema":"auth","grantee":"dashboard_user","grantor":"supabase_auth_admin","object_type":"r","is_grantable":false,"privilege_type":"DELETE"},{"owner":"supabase_auth_admin","schema":"auth","grantee":"dashboard_user","grantor":"supabase_auth_admin","object_type":"r","is_grantable":false,"privilege_type":"INSERT"},{"owner":"supabase_auth_admin","schema":"auth","grantee":"dashboard_user","grantor":"supabase_auth_admin","object_type":"r","is_grantable":false,"privilege_type":"REFERENCES"},{"owner":"supabase_auth_admin","schema":"auth","grantee":"dashboard_user","grantor":"supabase_auth_admin","object_type":"r","is_grantable":false,"privilege_type":"SELECT"},{"owner":"supabase_auth_admin","schema":"auth","grantee":"dashboard_user","grantor":"supabase_auth_admin","object_type":"r","is_grantable":false,"privilege_type":"TRIGGER"},{"owner":"supabase_auth_admin","schema":"auth","grantee":"dashboard_user","grantor":"supabase_auth_admin","object_type":"r","is_grantable":false,"privilege_type":"TRUNCATE"},{"owner":"supabase_auth_admin","schema":"auth","grantee":"dashboard_user","grantor":"supabase_auth_admin","object_type":"r","is_grantable":false,"privilege_type":"UPDATE"},{"owner":"supabase_auth_admin","schema":"auth","grantee":"postgres","grantor":"supabase_auth_admin","object_type":"r","is_grantable":false,"privilege_type":"DELETE"},{"owner":"supabase_auth_admin","schema":"auth","grantee":"postgres","grantor":"supabase_auth_admin","object_type":"r","is_grantable":false,"privilege_type":"INSERT"},{"owner":"supabase_auth_admin","schema":"auth","grantee":"postgres","grantor":"supabase_auth_admin","object_type":"r","is_grantable":false,"privilege_type":"REFERENCES"},{"owner":"supabase_auth_admin","schema":"auth","grantee":"postgres","grantor":"supabase_auth_admin","object_type":"r","is_grantable":false,"privilege_type":"SELECT"},{"owner":"supabase_auth_admin","schema":"auth","grantee":"postgres","grantor":"supabase_auth_admin","object_type":"r","is_grantable":false,"privilege_type":"TRIGGER"},{"owner":"supabase_auth_admin","schema":"auth","grantee":"postgres","grantor":"supabase_auth_admin","object_type":"r","is_grantable":false,"privilege_type":"TRUNCATE"},{"owner":"supabase_auth_admin","schema":"auth","grantee":"postgres","grantor":"supabase_auth_admin","object_type":"r","is_grantable":false,"privilege_type":"UPDATE"}]'::jsonb,'exactly six postgres/public/client default ACL entries removed; R2B unchanged');

select is((select coalesce(jsonb_agg(to_jsonb(t) order by table_name,column_name),'[]'::jsonb) from (
select c.relname table_name,a.attname column_name,a.attacl::text raw_column_acl
from pg_class c join pg_namespace n on n.oid=c.relnamespace join pg_attribute a on a.attrelid=c.oid
where n.nspname='public' and c.relkind in ('r','p') and a.attnum>0 and not a.attisdropped and a.attacl is not null)t),'[{"table_name":"order_attributions","column_name":"click_token","raw_column_acl":"{service_role=w/postgres}"},{"table_name":"profiles","column_name":"avatar_path","raw_column_acl":"{authenticated=w/postgres}"},{"table_name":"profiles","column_name":"display_name","raw_column_acl":"{authenticated=w/postgres}"},{"table_name":"profiles","column_name":"locale","raw_column_acl":"{authenticated=w/postgres}"},{"table_name":"profiles","column_name":"units","raw_column_acl":"{authenticated=w/postgres}"}]'::jsonb,'all existing column ACLs remain unchanged');

insert into auth.users(id) values ('db06a211-0000-4000-8000-000000000001'),('db06a211-0000-4000-8000-000000000002');
insert into public.consents(id,user_id,consent_type,granted,version) values
('db06a212-0000-4000-8000-000000000001','db06a211-0000-4000-8000-000000000001','account',true,'DB06-ACL-R2A-REGRESSION'),
('db06a212-0000-4000-8000-000000000002','db06a211-0000-4000-8000-000000000002','account',true,'DB06-ACL-R2A-REGRESSION');
insert into public.waitlist_signups(email,source) values ('db06-r2a-one@example.invalid','DB06-ACL-R2A-REGRESSION'),('db06-r2a-two@example.invalid','DB06-ACL-R2A-REGRESSION');
insert into public.account_deletion_requests(request_id,user_id,initiating_session_id,completion_token_hash,user_hash,user_lookup_hash)
values ('db06a201-0000-4000-8000-000000000001','db06a211-0000-4000-8000-000000000001','db06a203-0000-4000-8000-000000000001','t_'||repeat('a',64),'u_'||repeat('a',32),'d_'||repeat('a',32));
insert into public.account_deletion_click_tombstones(click_token_hash,request_id)
values ('c_'||repeat('a',32),'db06a201-0000-4000-8000-000000000001');
create function pg_temp.db06_protected_counts() returns jsonb language plpgsql security invoker set search_path='' as $$
declare item record; n bigint; result jsonb='{}';begin
 for item in select c.relname from pg_catalog.pg_class c join pg_catalog.pg_namespace n on n.oid=c.relnamespace where n.nspname='public' and c.relkind in ('r','p') order by c.relname loop
  execute format('select count(*) from public.%I',item.relname) into n;
  result=result||jsonb_build_object(item.relname,n);
 end loop;
 return result;
end $$;
create temporary table db06_protected_before as select pg_temp.db06_protected_counts() counts;
create temporary table db06_triggers_before as select jsonb_agg(jsonb_build_object('oid',oid,'definition',pg_get_triggerdef(oid),'enabled',tgenabled) order by oid) definitions from pg_trigger;


set local role anon;

select throws_ok('truncate public.account_deletion_click_tombstones','42501','permission denied for table account_deletion_click_tombstones','anon TRUNCATE account_deletion_click_tombstones requires root-table ACL denial');

reset role;

select is(pg_temp.db06_protected_counts(),(select counts from db06_protected_before),'anon TRUNCATE account_deletion_click_tombstones independently preserves all 91 protected row counts');

set local role anon;

select throws_ok('truncate public.account_deletion_click_tombstones RESTRICT','42501','permission denied for table account_deletion_click_tombstones','anon TRUNCATE RESTRICT account_deletion_click_tombstones requires root-table ACL denial');

reset role;

select is(pg_temp.db06_protected_counts(),(select counts from db06_protected_before),'anon TRUNCATE RESTRICT account_deletion_click_tombstones independently preserves all 91 protected row counts');

set local role anon;

select throws_ok('truncate public.account_deletion_click_tombstones CASCADE','42501','permission denied for table account_deletion_click_tombstones','anon TRUNCATE CASCADE account_deletion_click_tombstones requires root-table ACL denial');

reset role;

select is(pg_temp.db06_protected_counts(),(select counts from db06_protected_before),'anon TRUNCATE CASCADE account_deletion_click_tombstones independently preserves all 91 protected row counts');

set local role anon;

select throws_ok('create trigger db06_r2a_forbidden before update on public.account_deletion_click_tombstones for each row when (false) execute function pg_catalog.suppress_redundant_updates_trigger()','42501','permission denied for table account_deletion_click_tombstones','anon unauthorized trigger denied on account_deletion_click_tombstones');

reset role;

select is((select jsonb_agg(jsonb_build_object('oid',oid,'definition',pg_get_triggerdef(oid),'enabled',tgenabled) order by oid) from pg_trigger),(select definitions from db06_triggers_before),'anon leaves every legitimate trigger unchanged on account_deletion_click_tombstones');

set local role anon;

select throws_ok('truncate public.account_deletion_requests','42501','permission denied for table account_deletion_requests','anon TRUNCATE account_deletion_requests requires root-table ACL denial');

reset role;

select is(pg_temp.db06_protected_counts(),(select counts from db06_protected_before),'anon TRUNCATE account_deletion_requests independently preserves all 91 protected row counts');

set local role anon;

select throws_ok('truncate public.account_deletion_requests RESTRICT','42501','permission denied for table account_deletion_requests','anon TRUNCATE RESTRICT account_deletion_requests requires root-table ACL denial');

reset role;

select is(pg_temp.db06_protected_counts(),(select counts from db06_protected_before),'anon TRUNCATE RESTRICT account_deletion_requests independently preserves all 91 protected row counts');

set local role anon;

select throws_ok('truncate public.account_deletion_requests CASCADE','42501','permission denied for table account_deletion_requests','anon TRUNCATE CASCADE account_deletion_requests requires root-table ACL denial');

reset role;

select is(pg_temp.db06_protected_counts(),(select counts from db06_protected_before),'anon TRUNCATE CASCADE account_deletion_requests independently preserves all 91 protected row counts');

set local role anon;

select throws_ok('create trigger db06_r2a_forbidden before update on public.account_deletion_requests for each row when (false) execute function pg_catalog.suppress_redundant_updates_trigger()','42501','permission denied for table account_deletion_requests','anon unauthorized trigger denied on account_deletion_requests');

reset role;

select is((select jsonb_agg(jsonb_build_object('oid',oid,'definition',pg_get_triggerdef(oid),'enabled',tgenabled) order by oid) from pg_trigger),(select definitions from db06_triggers_before),'anon leaves every legitimate trigger unchanged on account_deletion_requests');

set local role anon;

select throws_ok('truncate public.active_ramp','42501','permission denied for table active_ramp','anon TRUNCATE active_ramp requires root-table ACL denial');

reset role;

select is(pg_temp.db06_protected_counts(),(select counts from db06_protected_before),'anon TRUNCATE active_ramp independently preserves all 91 protected row counts');

set local role anon;

select throws_ok('truncate public.active_ramp RESTRICT','42501','permission denied for table active_ramp','anon TRUNCATE RESTRICT active_ramp requires root-table ACL denial');

reset role;

select is(pg_temp.db06_protected_counts(),(select counts from db06_protected_before),'anon TRUNCATE RESTRICT active_ramp independently preserves all 91 protected row counts');

set local role anon;

select throws_ok('truncate public.active_ramp CASCADE','42501','permission denied for table active_ramp','anon TRUNCATE CASCADE active_ramp requires root-table ACL denial');

reset role;

select is(pg_temp.db06_protected_counts(),(select counts from db06_protected_before),'anon TRUNCATE CASCADE active_ramp independently preserves all 91 protected row counts');

set local role anon;

select throws_ok('create trigger db06_r2a_forbidden before update on public.active_ramp for each row when (false) execute function pg_catalog.suppress_redundant_updates_trigger()','42501','permission denied for table active_ramp','anon unauthorized trigger denied on active_ramp');

reset role;

select is((select jsonb_agg(jsonb_build_object('oid',oid,'definition',pg_get_triggerdef(oid),'enabled',tgenabled) order by oid) from pg_trigger),(select definitions from db06_triggers_before),'anon leaves every legitimate trigger unchanged on active_ramp');

set local role anon;

select throws_ok('truncate public.ask_safety_audit','42501','permission denied for table ask_safety_audit','anon TRUNCATE ask_safety_audit requires root-table ACL denial');

reset role;

select is(pg_temp.db06_protected_counts(),(select counts from db06_protected_before),'anon TRUNCATE ask_safety_audit independently preserves all 91 protected row counts');

set local role anon;

select throws_ok('truncate public.ask_safety_audit RESTRICT','42501','permission denied for table ask_safety_audit','anon TRUNCATE RESTRICT ask_safety_audit requires root-table ACL denial');

reset role;

select is(pg_temp.db06_protected_counts(),(select counts from db06_protected_before),'anon TRUNCATE RESTRICT ask_safety_audit independently preserves all 91 protected row counts');

set local role anon;

select throws_ok('truncate public.ask_safety_audit CASCADE','42501','permission denied for table ask_safety_audit','anon TRUNCATE CASCADE ask_safety_audit requires root-table ACL denial');

reset role;

select is(pg_temp.db06_protected_counts(),(select counts from db06_protected_before),'anon TRUNCATE CASCADE ask_safety_audit independently preserves all 91 protected row counts');

set local role anon;

select throws_ok('create trigger db06_r2a_forbidden before update on public.ask_safety_audit for each row when (false) execute function pg_catalog.suppress_redundant_updates_trigger()','42501','permission denied for table ask_safety_audit','anon unauthorized trigger denied on ask_safety_audit');

reset role;

select is((select jsonb_agg(jsonb_build_object('oid',oid,'definition',pg_get_triggerdef(oid),'enabled',tgenabled) order by oid) from pg_trigger),(select definitions from db06_triggers_before),'anon leaves every legitimate trigger unchanged on ask_safety_audit');

set local role anon;

select throws_ok('truncate public.ask_sessions','42501','permission denied for table ask_sessions','anon TRUNCATE ask_sessions requires root-table ACL denial');

reset role;

select is(pg_temp.db06_protected_counts(),(select counts from db06_protected_before),'anon TRUNCATE ask_sessions independently preserves all 91 protected row counts');

set local role anon;

select throws_ok('truncate public.ask_sessions RESTRICT','42501','permission denied for table ask_sessions','anon TRUNCATE RESTRICT ask_sessions requires root-table ACL denial');

reset role;

select is(pg_temp.db06_protected_counts(),(select counts from db06_protected_before),'anon TRUNCATE RESTRICT ask_sessions independently preserves all 91 protected row counts');

set local role anon;

select throws_ok('truncate public.ask_sessions CASCADE','42501','permission denied for table ask_sessions','anon TRUNCATE CASCADE ask_sessions requires root-table ACL denial');

reset role;

select is(pg_temp.db06_protected_counts(),(select counts from db06_protected_before),'anon TRUNCATE CASCADE ask_sessions independently preserves all 91 protected row counts');

set local role anon;

select throws_ok('create trigger db06_r2a_forbidden before update on public.ask_sessions for each row when (false) execute function pg_catalog.suppress_redundant_updates_trigger()','42501','permission denied for table ask_sessions','anon unauthorized trigger denied on ask_sessions');

reset role;

select is((select jsonb_agg(jsonb_build_object('oid',oid,'definition',pg_get_triggerdef(oid),'enabled',tgenabled) order by oid) from pg_trigger),(select definitions from db06_triggers_before),'anon leaves every legitimate trigger unchanged on ask_sessions');

set local role anon;

select throws_ok('truncate public.ask_turn_audit','42501','permission denied for table ask_turn_audit','anon TRUNCATE ask_turn_audit requires root-table ACL denial');

reset role;

select is(pg_temp.db06_protected_counts(),(select counts from db06_protected_before),'anon TRUNCATE ask_turn_audit independently preserves all 91 protected row counts');

set local role anon;

select throws_ok('truncate public.ask_turn_audit RESTRICT','42501','permission denied for table ask_turn_audit','anon TRUNCATE RESTRICT ask_turn_audit requires root-table ACL denial');

reset role;

select is(pg_temp.db06_protected_counts(),(select counts from db06_protected_before),'anon TRUNCATE RESTRICT ask_turn_audit independently preserves all 91 protected row counts');

set local role anon;

select throws_ok('truncate public.ask_turn_audit CASCADE','42501','permission denied for table ask_turn_audit','anon TRUNCATE CASCADE ask_turn_audit requires root-table ACL denial');

reset role;

select is(pg_temp.db06_protected_counts(),(select counts from db06_protected_before),'anon TRUNCATE CASCADE ask_turn_audit independently preserves all 91 protected row counts');

set local role anon;

select throws_ok('create trigger db06_r2a_forbidden before update on public.ask_turn_audit for each row when (false) execute function pg_catalog.suppress_redundant_updates_trigger()','42501','permission denied for table ask_turn_audit','anon unauthorized trigger denied on ask_turn_audit');

reset role;

select is((select jsonb_agg(jsonb_build_object('oid',oid,'definition',pg_get_triggerdef(oid),'enabled',tgenabled) order by oid) from pg_trigger),(select definitions from db06_triggers_before),'anon leaves every legitimate trigger unchanged on ask_turn_audit');

set local role anon;

select throws_ok('truncate public.community_blocks','42501','permission denied for table community_blocks','anon TRUNCATE community_blocks requires root-table ACL denial');

reset role;

select is(pg_temp.db06_protected_counts(),(select counts from db06_protected_before),'anon TRUNCATE community_blocks independently preserves all 91 protected row counts');

set local role anon;

select throws_ok('truncate public.community_blocks RESTRICT','42501','permission denied for table community_blocks','anon TRUNCATE RESTRICT community_blocks requires root-table ACL denial');

reset role;

select is(pg_temp.db06_protected_counts(),(select counts from db06_protected_before),'anon TRUNCATE RESTRICT community_blocks independently preserves all 91 protected row counts');

set local role anon;

select throws_ok('truncate public.community_blocks CASCADE','42501','permission denied for table community_blocks','anon TRUNCATE CASCADE community_blocks requires root-table ACL denial');

reset role;

select is(pg_temp.db06_protected_counts(),(select counts from db06_protected_before),'anon TRUNCATE CASCADE community_blocks independently preserves all 91 protected row counts');

set local role anon;

select throws_ok('create trigger db06_r2a_forbidden before update on public.community_blocks for each row when (false) execute function pg_catalog.suppress_redundant_updates_trigger()','42501','permission denied for table community_blocks','anon unauthorized trigger denied on community_blocks');

reset role;

select is((select jsonb_agg(jsonb_build_object('oid',oid,'definition',pg_get_triggerdef(oid),'enabled',tgenabled) order by oid) from pg_trigger),(select definitions from db06_triggers_before),'anon leaves every legitimate trigger unchanged on community_blocks');

set local role anon;

select throws_ok('truncate public.community_moderation_events','42501','permission denied for table community_moderation_events','anon TRUNCATE community_moderation_events requires root-table ACL denial');

reset role;

select is(pg_temp.db06_protected_counts(),(select counts from db06_protected_before),'anon TRUNCATE community_moderation_events independently preserves all 91 protected row counts');

set local role anon;

select throws_ok('truncate public.community_moderation_events RESTRICT','42501','permission denied for table community_moderation_events','anon TRUNCATE RESTRICT community_moderation_events requires root-table ACL denial');

reset role;

select is(pg_temp.db06_protected_counts(),(select counts from db06_protected_before),'anon TRUNCATE RESTRICT community_moderation_events independently preserves all 91 protected row counts');

set local role anon;

select throws_ok('truncate public.community_moderation_events CASCADE','42501','permission denied for table community_moderation_events','anon TRUNCATE CASCADE community_moderation_events requires root-table ACL denial');

reset role;

select is(pg_temp.db06_protected_counts(),(select counts from db06_protected_before),'anon TRUNCATE CASCADE community_moderation_events independently preserves all 91 protected row counts');

set local role anon;

select throws_ok('create trigger db06_r2a_forbidden before update on public.community_moderation_events for each row when (false) execute function pg_catalog.suppress_redundant_updates_trigger()','42501','permission denied for table community_moderation_events','anon unauthorized trigger denied on community_moderation_events');

reset role;

select is((select jsonb_agg(jsonb_build_object('oid',oid,'definition',pg_get_triggerdef(oid),'enabled',tgenabled) order by oid) from pg_trigger),(select definitions from db06_triggers_before),'anon leaves every legitimate trigger unchanged on community_moderation_events');

set local role anon;

select throws_ok('truncate public.community_notes','42501','permission denied for table community_notes','anon TRUNCATE community_notes requires root-table ACL denial');

reset role;

select is(pg_temp.db06_protected_counts(),(select counts from db06_protected_before),'anon TRUNCATE community_notes independently preserves all 91 protected row counts');

set local role anon;

select throws_ok('truncate public.community_notes RESTRICT','42501','permission denied for table community_notes','anon TRUNCATE RESTRICT community_notes requires root-table ACL denial');

reset role;

select is(pg_temp.db06_protected_counts(),(select counts from db06_protected_before),'anon TRUNCATE RESTRICT community_notes independently preserves all 91 protected row counts');

set local role anon;

select throws_ok('truncate public.community_notes CASCADE','42501','permission denied for table community_notes','anon TRUNCATE CASCADE community_notes requires root-table ACL denial');

reset role;

select is(pg_temp.db06_protected_counts(),(select counts from db06_protected_before),'anon TRUNCATE CASCADE community_notes independently preserves all 91 protected row counts');

set local role anon;

select throws_ok('create trigger db06_r2a_forbidden before update on public.community_notes for each row when (false) execute function pg_catalog.suppress_redundant_updates_trigger()','42501','permission denied for table community_notes','anon unauthorized trigger denied on community_notes');

reset role;

select is((select jsonb_agg(jsonb_build_object('oid',oid,'definition',pg_get_triggerdef(oid),'enabled',tgenabled) order by oid) from pg_trigger),(select definitions from db06_triggers_before),'anon leaves every legitimate trigger unchanged on community_notes');

set local role anon;

select throws_ok('truncate public.community_questions','42501','permission denied for table community_questions','anon TRUNCATE community_questions requires root-table ACL denial');

reset role;

select is(pg_temp.db06_protected_counts(),(select counts from db06_protected_before),'anon TRUNCATE community_questions independently preserves all 91 protected row counts');

set local role anon;

select throws_ok('truncate public.community_questions RESTRICT','42501','permission denied for table community_questions','anon TRUNCATE RESTRICT community_questions requires root-table ACL denial');

reset role;

select is(pg_temp.db06_protected_counts(),(select counts from db06_protected_before),'anon TRUNCATE RESTRICT community_questions independently preserves all 91 protected row counts');

set local role anon;

select throws_ok('truncate public.community_questions CASCADE','42501','permission denied for table community_questions','anon TRUNCATE CASCADE community_questions requires root-table ACL denial');

reset role;

select is(pg_temp.db06_protected_counts(),(select counts from db06_protected_before),'anon TRUNCATE CASCADE community_questions independently preserves all 91 protected row counts');

set local role anon;

select throws_ok('create trigger db06_r2a_forbidden before update on public.community_questions for each row when (false) execute function pg_catalog.suppress_redundant_updates_trigger()','42501','permission denied for table community_questions','anon unauthorized trigger denied on community_questions');

reset role;

select is((select jsonb_agg(jsonb_build_object('oid',oid,'definition',pg_get_triggerdef(oid),'enabled',tgenabled) order by oid) from pg_trigger),(select definitions from db06_triggers_before),'anon leaves every legitimate trigger unchanged on community_questions');

set local role anon;

select throws_ok('truncate public.community_reactions','42501','permission denied for table community_reactions','anon TRUNCATE community_reactions requires root-table ACL denial');

reset role;

select is(pg_temp.db06_protected_counts(),(select counts from db06_protected_before),'anon TRUNCATE community_reactions independently preserves all 91 protected row counts');

set local role anon;

select throws_ok('truncate public.community_reactions RESTRICT','42501','permission denied for table community_reactions','anon TRUNCATE RESTRICT community_reactions requires root-table ACL denial');

reset role;

select is(pg_temp.db06_protected_counts(),(select counts from db06_protected_before),'anon TRUNCATE RESTRICT community_reactions independently preserves all 91 protected row counts');

set local role anon;

select throws_ok('truncate public.community_reactions CASCADE','42501','permission denied for table community_reactions','anon TRUNCATE CASCADE community_reactions requires root-table ACL denial');

reset role;

select is(pg_temp.db06_protected_counts(),(select counts from db06_protected_before),'anon TRUNCATE CASCADE community_reactions independently preserves all 91 protected row counts');

set local role anon;

select throws_ok('create trigger db06_r2a_forbidden before update on public.community_reactions for each row when (false) execute function pg_catalog.suppress_redundant_updates_trigger()','42501','permission denied for table community_reactions','anon unauthorized trigger denied on community_reactions');

reset role;

select is((select jsonb_agg(jsonb_build_object('oid',oid,'definition',pg_get_triggerdef(oid),'enabled',tgenabled) order by oid) from pg_trigger),(select definitions from db06_triggers_before),'anon leaves every legitimate trigger unchanged on community_reactions');

set local role anon;

select throws_ok('truncate public.community_reports','42501','permission denied for table community_reports','anon TRUNCATE community_reports requires root-table ACL denial');

reset role;

select is(pg_temp.db06_protected_counts(),(select counts from db06_protected_before),'anon TRUNCATE community_reports independently preserves all 91 protected row counts');

set local role anon;

select throws_ok('truncate public.community_reports RESTRICT','42501','permission denied for table community_reports','anon TRUNCATE RESTRICT community_reports requires root-table ACL denial');

reset role;

select is(pg_temp.db06_protected_counts(),(select counts from db06_protected_before),'anon TRUNCATE RESTRICT community_reports independently preserves all 91 protected row counts');

set local role anon;

select throws_ok('truncate public.community_reports CASCADE','42501','permission denied for table community_reports','anon TRUNCATE CASCADE community_reports requires root-table ACL denial');

reset role;

select is(pg_temp.db06_protected_counts(),(select counts from db06_protected_before),'anon TRUNCATE CASCADE community_reports independently preserves all 91 protected row counts');

set local role anon;

select throws_ok('create trigger db06_r2a_forbidden before update on public.community_reports for each row when (false) execute function pg_catalog.suppress_redundant_updates_trigger()','42501','permission denied for table community_reports','anon unauthorized trigger denied on community_reports');

reset role;

select is((select jsonb_agg(jsonb_build_object('oid',oid,'definition',pg_get_triggerdef(oid),'enabled',tgenabled) order by oid) from pg_trigger),(select definitions from db06_triggers_before),'anon leaves every legitimate trigger unchanged on community_reports');

set local role anon;

select throws_ok('truncate public.community_topics','42501','permission denied for table community_topics','anon TRUNCATE community_topics requires root-table ACL denial');

reset role;

select is(pg_temp.db06_protected_counts(),(select counts from db06_protected_before),'anon TRUNCATE community_topics independently preserves all 91 protected row counts');

set local role anon;

select throws_ok('truncate public.community_topics RESTRICT','42501','permission denied for table community_topics','anon TRUNCATE RESTRICT community_topics requires root-table ACL denial');

reset role;

select is(pg_temp.db06_protected_counts(),(select counts from db06_protected_before),'anon TRUNCATE RESTRICT community_topics independently preserves all 91 protected row counts');

set local role anon;

select throws_ok('truncate public.community_topics CASCADE','42501','permission denied for table community_topics','anon TRUNCATE CASCADE community_topics requires root-table ACL denial');

reset role;

select is(pg_temp.db06_protected_counts(),(select counts from db06_protected_before),'anon TRUNCATE CASCADE community_topics independently preserves all 91 protected row counts');

set local role anon;

select throws_ok('create trigger db06_r2a_forbidden before update on public.community_topics for each row when (false) execute function pg_catalog.suppress_redundant_updates_trigger()','42501','permission denied for table community_topics','anon unauthorized trigger denied on community_topics');

reset role;

select is((select jsonb_agg(jsonb_build_object('oid',oid,'definition',pg_get_triggerdef(oid),'enabled',tgenabled) order by oid) from pg_trigger),(select definitions from db06_triggers_before),'anon leaves every legitimate trigger unchanged on community_topics');

set local role anon;

select throws_ok('truncate public.consents','42501','permission denied for table consents','anon TRUNCATE consents requires root-table ACL denial');

reset role;

select is(pg_temp.db06_protected_counts(),(select counts from db06_protected_before),'anon TRUNCATE consents independently preserves all 91 protected row counts');

set local role anon;

select throws_ok('truncate public.consents RESTRICT','42501','permission denied for table consents','anon TRUNCATE RESTRICT consents requires root-table ACL denial');

reset role;

select is(pg_temp.db06_protected_counts(),(select counts from db06_protected_before),'anon TRUNCATE RESTRICT consents independently preserves all 91 protected row counts');

set local role anon;

select throws_ok('truncate public.consents CASCADE','42501','permission denied for table consents','anon TRUNCATE CASCADE consents requires root-table ACL denial');

reset role;

select is(pg_temp.db06_protected_counts(),(select counts from db06_protected_before),'anon TRUNCATE CASCADE consents independently preserves all 91 protected row counts');

set local role anon;

select throws_ok('create trigger db06_r2a_forbidden before update on public.consents for each row when (false) execute function pg_catalog.suppress_redundant_updates_trigger()','42501','permission denied for table consents','anon unauthorized trigger denied on consents');

reset role;

select is((select jsonb_agg(jsonb_build_object('oid',oid,'definition',pg_get_triggerdef(oid),'enabled',tgenabled) order by oid) from pg_trigger),(select definitions from db06_triggers_before),'anon leaves every legitimate trigger unchanged on consents');

set local role anon;

select throws_ok('truncate public.cycle_nights','42501','permission denied for table cycle_nights','anon TRUNCATE cycle_nights requires root-table ACL denial');

reset role;

select is(pg_temp.db06_protected_counts(),(select counts from db06_protected_before),'anon TRUNCATE cycle_nights independently preserves all 91 protected row counts');

set local role anon;

select throws_ok('truncate public.cycle_nights RESTRICT','42501','permission denied for table cycle_nights','anon TRUNCATE RESTRICT cycle_nights requires root-table ACL denial');

reset role;

select is(pg_temp.db06_protected_counts(),(select counts from db06_protected_before),'anon TRUNCATE RESTRICT cycle_nights independently preserves all 91 protected row counts');

set local role anon;

select throws_ok('truncate public.cycle_nights CASCADE','42501','permission denied for table cycle_nights','anon TRUNCATE CASCADE cycle_nights requires root-table ACL denial');

reset role;

select is(pg_temp.db06_protected_counts(),(select counts from db06_protected_before),'anon TRUNCATE CASCADE cycle_nights independently preserves all 91 protected row counts');

set local role anon;

select throws_ok('create trigger db06_r2a_forbidden before update on public.cycle_nights for each row when (false) execute function pg_catalog.suppress_redundant_updates_trigger()','42501','permission denied for table cycle_nights','anon unauthorized trigger denied on cycle_nights');

reset role;

select is((select jsonb_agg(jsonb_build_object('oid',oid,'definition',pg_get_triggerdef(oid),'enabled',tgenabled) order by oid) from pg_trigger),(select definitions from db06_triggers_before),'anon leaves every legitimate trigger unchanged on cycle_nights');

set local role anon;

select throws_ok('truncate public.cycles','42501','permission denied for table cycles','anon TRUNCATE cycles requires root-table ACL denial');

reset role;

select is(pg_temp.db06_protected_counts(),(select counts from db06_protected_before),'anon TRUNCATE cycles independently preserves all 91 protected row counts');

set local role anon;

select throws_ok('truncate public.cycles RESTRICT','42501','permission denied for table cycles','anon TRUNCATE RESTRICT cycles requires root-table ACL denial');

reset role;

select is(pg_temp.db06_protected_counts(),(select counts from db06_protected_before),'anon TRUNCATE RESTRICT cycles independently preserves all 91 protected row counts');

set local role anon;

select throws_ok('truncate public.cycles CASCADE','42501','permission denied for table cycles','anon TRUNCATE CASCADE cycles requires root-table ACL denial');

reset role;

select is(pg_temp.db06_protected_counts(),(select counts from db06_protected_before),'anon TRUNCATE CASCADE cycles independently preserves all 91 protected row counts');

set local role anon;

select throws_ok('create trigger db06_r2a_forbidden before update on public.cycles for each row when (false) execute function pg_catalog.suppress_redundant_updates_trigger()','42501','permission denied for table cycles','anon unauthorized trigger denied on cycles');

reset role;

select is((select jsonb_agg(jsonb_build_object('oid',oid,'definition',pg_get_triggerdef(oid),'enabled',tgenabled) order by oid) from pg_trigger),(select definitions from db06_triggers_before),'anon leaves every legitimate trigger unchanged on cycles');

set local role anon;

select throws_ok('truncate public.entitlements','42501','permission denied for table entitlements','anon TRUNCATE entitlements requires root-table ACL denial');

reset role;

select is(pg_temp.db06_protected_counts(),(select counts from db06_protected_before),'anon TRUNCATE entitlements independently preserves all 91 protected row counts');

set local role anon;

select throws_ok('truncate public.entitlements RESTRICT','42501','permission denied for table entitlements','anon TRUNCATE RESTRICT entitlements requires root-table ACL denial');

reset role;

select is(pg_temp.db06_protected_counts(),(select counts from db06_protected_before),'anon TRUNCATE RESTRICT entitlements independently preserves all 91 protected row counts');

set local role anon;

select throws_ok('truncate public.entitlements CASCADE','42501','permission denied for table entitlements','anon TRUNCATE CASCADE entitlements requires root-table ACL denial');

reset role;

select is(pg_temp.db06_protected_counts(),(select counts from db06_protected_before),'anon TRUNCATE CASCADE entitlements independently preserves all 91 protected row counts');

set local role anon;

select throws_ok('create trigger db06_r2a_forbidden before update on public.entitlements for each row when (false) execute function pg_catalog.suppress_redundant_updates_trigger()','42501','permission denied for table entitlements','anon unauthorized trigger denied on entitlements');

reset role;

select is((select jsonb_agg(jsonb_build_object('oid',oid,'definition',pg_get_triggerdef(oid),'enabled',tgenabled) order by oid) from pg_trigger),(select definitions from db06_triggers_before),'anon leaves every legitimate trigger unchanged on entitlements');

set local role anon;

select throws_ok('truncate public.growth_events','42501','permission denied for table growth_events','anon TRUNCATE growth_events requires root-table ACL denial');

reset role;

select is(pg_temp.db06_protected_counts(),(select counts from db06_protected_before),'anon TRUNCATE growth_events independently preserves all 91 protected row counts');

set local role anon;

select throws_ok('truncate public.growth_events RESTRICT','42501','permission denied for table growth_events','anon TRUNCATE RESTRICT growth_events requires root-table ACL denial');

reset role;

select is(pg_temp.db06_protected_counts(),(select counts from db06_protected_before),'anon TRUNCATE RESTRICT growth_events independently preserves all 91 protected row counts');

set local role anon;

select throws_ok('truncate public.growth_events CASCADE','42501','permission denied for table growth_events','anon TRUNCATE CASCADE growth_events requires root-table ACL denial');

reset role;

select is(pg_temp.db06_protected_counts(),(select counts from db06_protected_before),'anon TRUNCATE CASCADE growth_events independently preserves all 91 protected row counts');

set local role anon;

select throws_ok('create trigger db06_r2a_forbidden before update on public.growth_events for each row when (false) execute function pg_catalog.suppress_redundant_updates_trigger()','42501','permission denied for table growth_events','anon unauthorized trigger denied on growth_events');

reset role;

select is((select jsonb_agg(jsonb_build_object('oid',oid,'definition',pg_get_triggerdef(oid),'enabled',tgenabled) order by oid) from pg_trigger),(select definitions from db06_triggers_before),'anon leaves every legitimate trigger unchanged on growth_events');

set local role anon;

select throws_ok('truncate public.notification_log','42501','permission denied for table notification_log','anon TRUNCATE notification_log requires root-table ACL denial');

reset role;

select is(pg_temp.db06_protected_counts(),(select counts from db06_protected_before),'anon TRUNCATE notification_log independently preserves all 91 protected row counts');

set local role anon;

select throws_ok('truncate public.notification_log RESTRICT','42501','permission denied for table notification_log','anon TRUNCATE RESTRICT notification_log requires root-table ACL denial');

reset role;

select is(pg_temp.db06_protected_counts(),(select counts from db06_protected_before),'anon TRUNCATE RESTRICT notification_log independently preserves all 91 protected row counts');

set local role anon;

select throws_ok('truncate public.notification_log CASCADE','42501','permission denied for table notification_log','anon TRUNCATE CASCADE notification_log requires root-table ACL denial');

reset role;

select is(pg_temp.db06_protected_counts(),(select counts from db06_protected_before),'anon TRUNCATE CASCADE notification_log independently preserves all 91 protected row counts');

set local role anon;

select throws_ok('create trigger db06_r2a_forbidden before update on public.notification_log for each row when (false) execute function pg_catalog.suppress_redundant_updates_trigger()','42501','permission denied for table notification_log','anon unauthorized trigger denied on notification_log');

reset role;

select is((select jsonb_agg(jsonb_build_object('oid',oid,'definition',pg_get_triggerdef(oid),'enabled',tgenabled) order by oid) from pg_trigger),(select definitions from db06_triggers_before),'anon leaves every legitimate trigger unchanged on notification_log');

set local role anon;

select throws_ok('truncate public.notification_preferences','42501','permission denied for table notification_preferences','anon TRUNCATE notification_preferences requires root-table ACL denial');

reset role;

select is(pg_temp.db06_protected_counts(),(select counts from db06_protected_before),'anon TRUNCATE notification_preferences independently preserves all 91 protected row counts');

set local role anon;

select throws_ok('truncate public.notification_preferences RESTRICT','42501','permission denied for table notification_preferences','anon TRUNCATE RESTRICT notification_preferences requires root-table ACL denial');

reset role;

select is(pg_temp.db06_protected_counts(),(select counts from db06_protected_before),'anon TRUNCATE RESTRICT notification_preferences independently preserves all 91 protected row counts');

set local role anon;

select throws_ok('truncate public.notification_preferences CASCADE','42501','permission denied for table notification_preferences','anon TRUNCATE CASCADE notification_preferences requires root-table ACL denial');

reset role;

select is(pg_temp.db06_protected_counts(),(select counts from db06_protected_before),'anon TRUNCATE CASCADE notification_preferences independently preserves all 91 protected row counts');

set local role anon;

select throws_ok('create trigger db06_r2a_forbidden before update on public.notification_preferences for each row when (false) execute function pg_catalog.suppress_redundant_updates_trigger()','42501','permission denied for table notification_preferences','anon unauthorized trigger denied on notification_preferences');

reset role;

select is((select jsonb_agg(jsonb_build_object('oid',oid,'definition',pg_get_triggerdef(oid),'enabled',tgenabled) order by oid) from pg_trigger),(select definitions from db06_triggers_before),'anon leaves every legitimate trigger unchanged on notification_preferences');

set local role anon;

select throws_ok('truncate public.photo_trend','42501','permission denied for table photo_trend','anon TRUNCATE photo_trend requires root-table ACL denial');

reset role;

select is(pg_temp.db06_protected_counts(),(select counts from db06_protected_before),'anon TRUNCATE photo_trend independently preserves all 91 protected row counts');

set local role anon;

select throws_ok('truncate public.photo_trend RESTRICT','42501','permission denied for table photo_trend','anon TRUNCATE RESTRICT photo_trend requires root-table ACL denial');

reset role;

select is(pg_temp.db06_protected_counts(),(select counts from db06_protected_before),'anon TRUNCATE RESTRICT photo_trend independently preserves all 91 protected row counts');

set local role anon;

select throws_ok('truncate public.photo_trend CASCADE','42501','permission denied for table photo_trend','anon TRUNCATE CASCADE photo_trend requires root-table ACL denial');

reset role;

select is(pg_temp.db06_protected_counts(),(select counts from db06_protected_before),'anon TRUNCATE CASCADE photo_trend independently preserves all 91 protected row counts');

set local role anon;

select throws_ok('create trigger db06_r2a_forbidden before update on public.photo_trend for each row when (false) execute function pg_catalog.suppress_redundant_updates_trigger()','42501','permission denied for table photo_trend','anon unauthorized trigger denied on photo_trend');

reset role;

select is((select jsonb_agg(jsonb_build_object('oid',oid,'definition',pg_get_triggerdef(oid),'enabled',tgenabled) order by oid) from pg_trigger),(select definitions from db06_triggers_before),'anon leaves every legitimate trigger unchanged on photo_trend');

set local role anon;

select throws_ok('truncate public.photos','42501','permission denied for table photos','anon TRUNCATE photos requires root-table ACL denial');

reset role;

select is(pg_temp.db06_protected_counts(),(select counts from db06_protected_before),'anon TRUNCATE photos independently preserves all 91 protected row counts');

set local role anon;

select throws_ok('truncate public.photos RESTRICT','42501','permission denied for table photos','anon TRUNCATE RESTRICT photos requires root-table ACL denial');

reset role;

select is(pg_temp.db06_protected_counts(),(select counts from db06_protected_before),'anon TRUNCATE RESTRICT photos independently preserves all 91 protected row counts');

set local role anon;

select throws_ok('truncate public.photos CASCADE','42501','permission denied for table photos','anon TRUNCATE CASCADE photos requires root-table ACL denial');

reset role;

select is(pg_temp.db06_protected_counts(),(select counts from db06_protected_before),'anon TRUNCATE CASCADE photos independently preserves all 91 protected row counts');

set local role anon;

select throws_ok('create trigger db06_r2a_forbidden before update on public.photos for each row when (false) execute function pg_catalog.suppress_redundant_updates_trigger()','42501','permission denied for table photos','anon unauthorized trigger denied on photos');

reset role;

select is((select jsonb_agg(jsonb_build_object('oid',oid,'definition',pg_get_triggerdef(oid),'enabled',tgenabled) order by oid) from pg_trigger),(select definitions from db06_triggers_before),'anon leaves every legitimate trigger unchanged on photos');

set local role anon;

select throws_ok('truncate public.reverse_trial_grants','42501','permission denied for table reverse_trial_grants','anon TRUNCATE reverse_trial_grants requires root-table ACL denial');

reset role;

select is(pg_temp.db06_protected_counts(),(select counts from db06_protected_before),'anon TRUNCATE reverse_trial_grants independently preserves all 91 protected row counts');

set local role anon;

select throws_ok('truncate public.reverse_trial_grants RESTRICT','42501','permission denied for table reverse_trial_grants','anon TRUNCATE RESTRICT reverse_trial_grants requires root-table ACL denial');

reset role;

select is(pg_temp.db06_protected_counts(),(select counts from db06_protected_before),'anon TRUNCATE RESTRICT reverse_trial_grants independently preserves all 91 protected row counts');

set local role anon;

select throws_ok('truncate public.reverse_trial_grants CASCADE','42501','permission denied for table reverse_trial_grants','anon TRUNCATE CASCADE reverse_trial_grants requires root-table ACL denial');

reset role;

select is(pg_temp.db06_protected_counts(),(select counts from db06_protected_before),'anon TRUNCATE CASCADE reverse_trial_grants independently preserves all 91 protected row counts');

set local role anon;

select throws_ok('create trigger db06_r2a_forbidden before update on public.reverse_trial_grants for each row when (false) execute function pg_catalog.suppress_redundant_updates_trigger()','42501','permission denied for table reverse_trial_grants','anon unauthorized trigger denied on reverse_trial_grants');

reset role;

select is((select jsonb_agg(jsonb_build_object('oid',oid,'definition',pg_get_triggerdef(oid),'enabled',tgenabled) order by oid) from pg_trigger),(select definitions from db06_triggers_before),'anon leaves every legitimate trigger unchanged on reverse_trial_grants');

set local role anon;

select throws_ok('truncate public.routine_conflicts','42501','permission denied for table routine_conflicts','anon TRUNCATE routine_conflicts requires root-table ACL denial');

reset role;

select is(pg_temp.db06_protected_counts(),(select counts from db06_protected_before),'anon TRUNCATE routine_conflicts independently preserves all 91 protected row counts');

set local role anon;

select throws_ok('truncate public.routine_conflicts RESTRICT','42501','permission denied for table routine_conflicts','anon TRUNCATE RESTRICT routine_conflicts requires root-table ACL denial');

reset role;

select is(pg_temp.db06_protected_counts(),(select counts from db06_protected_before),'anon TRUNCATE RESTRICT routine_conflicts independently preserves all 91 protected row counts');

set local role anon;

select throws_ok('truncate public.routine_conflicts CASCADE','42501','permission denied for table routine_conflicts','anon TRUNCATE CASCADE routine_conflicts requires root-table ACL denial');

reset role;

select is(pg_temp.db06_protected_counts(),(select counts from db06_protected_before),'anon TRUNCATE CASCADE routine_conflicts independently preserves all 91 protected row counts');

set local role anon;

select throws_ok('create trigger db06_r2a_forbidden before update on public.routine_conflicts for each row when (false) execute function pg_catalog.suppress_redundant_updates_trigger()','42501','permission denied for table routine_conflicts','anon unauthorized trigger denied on routine_conflicts');

reset role;

select is((select jsonb_agg(jsonb_build_object('oid',oid,'definition',pg_get_triggerdef(oid),'enabled',tgenabled) order by oid) from pg_trigger),(select definitions from db06_triggers_before),'anon leaves every legitimate trigger unchanged on routine_conflicts');

set local role anon;

select throws_ok('truncate public.skin_profiles','42501','permission denied for table skin_profiles','anon TRUNCATE skin_profiles requires root-table ACL denial');

reset role;

select is(pg_temp.db06_protected_counts(),(select counts from db06_protected_before),'anon TRUNCATE skin_profiles independently preserves all 91 protected row counts');

set local role anon;

select throws_ok('truncate public.skin_profiles RESTRICT','42501','permission denied for table skin_profiles','anon TRUNCATE RESTRICT skin_profiles requires root-table ACL denial');

reset role;

select is(pg_temp.db06_protected_counts(),(select counts from db06_protected_before),'anon TRUNCATE RESTRICT skin_profiles independently preserves all 91 protected row counts');

set local role anon;

select throws_ok('truncate public.skin_profiles CASCADE','42501','permission denied for table skin_profiles','anon TRUNCATE CASCADE skin_profiles requires root-table ACL denial');

reset role;

select is(pg_temp.db06_protected_counts(),(select counts from db06_protected_before),'anon TRUNCATE CASCADE skin_profiles independently preserves all 91 protected row counts');

set local role anon;

select throws_ok('create trigger db06_r2a_forbidden before update on public.skin_profiles for each row when (false) execute function pg_catalog.suppress_redundant_updates_trigger()','42501','permission denied for table skin_profiles','anon unauthorized trigger denied on skin_profiles');

reset role;

select is((select jsonb_agg(jsonb_build_object('oid',oid,'definition',pg_get_triggerdef(oid),'enabled',tgenabled) order by oid) from pg_trigger),(select definitions from db06_triggers_before),'anon leaves every legitimate trigger unchanged on skin_profiles');

set local role anon;

select throws_ok('truncate public.subscriptions_events','42501','permission denied for table subscriptions_events','anon TRUNCATE subscriptions_events requires root-table ACL denial');

reset role;

select is(pg_temp.db06_protected_counts(),(select counts from db06_protected_before),'anon TRUNCATE subscriptions_events independently preserves all 91 protected row counts');

set local role anon;

select throws_ok('truncate public.subscriptions_events RESTRICT','42501','permission denied for table subscriptions_events','anon TRUNCATE RESTRICT subscriptions_events requires root-table ACL denial');

reset role;

select is(pg_temp.db06_protected_counts(),(select counts from db06_protected_before),'anon TRUNCATE RESTRICT subscriptions_events independently preserves all 91 protected row counts');

set local role anon;

select throws_ok('truncate public.subscriptions_events CASCADE','42501','permission denied for table subscriptions_events','anon TRUNCATE CASCADE subscriptions_events requires root-table ACL denial');

reset role;

select is(pg_temp.db06_protected_counts(),(select counts from db06_protected_before),'anon TRUNCATE CASCADE subscriptions_events independently preserves all 91 protected row counts');

set local role anon;

select throws_ok('create trigger db06_r2a_forbidden before update on public.subscriptions_events for each row when (false) execute function pg_catalog.suppress_redundant_updates_trigger()','42501','permission denied for table subscriptions_events','anon unauthorized trigger denied on subscriptions_events');

reset role;

select is((select jsonb_agg(jsonb_build_object('oid',oid,'definition',pg_get_triggerdef(oid),'enabled',tgenabled) order by oid) from pg_trigger),(select definitions from db06_triggers_before),'anon leaves every legitimate trigger unchanged on subscriptions_events');

set local role anon;

select throws_ok('truncate public.waitlist_signups','42501','permission denied for table waitlist_signups','anon TRUNCATE waitlist_signups requires root-table ACL denial');

reset role;

select is(pg_temp.db06_protected_counts(),(select counts from db06_protected_before),'anon TRUNCATE waitlist_signups independently preserves all 91 protected row counts');

set local role anon;

select throws_ok('truncate public.waitlist_signups RESTRICT','42501','permission denied for table waitlist_signups','anon TRUNCATE RESTRICT waitlist_signups requires root-table ACL denial');

reset role;

select is(pg_temp.db06_protected_counts(),(select counts from db06_protected_before),'anon TRUNCATE RESTRICT waitlist_signups independently preserves all 91 protected row counts');

set local role anon;

select throws_ok('truncate public.waitlist_signups CASCADE','42501','permission denied for table waitlist_signups','anon TRUNCATE CASCADE waitlist_signups requires root-table ACL denial');

reset role;

select is(pg_temp.db06_protected_counts(),(select counts from db06_protected_before),'anon TRUNCATE CASCADE waitlist_signups independently preserves all 91 protected row counts');

set local role anon;

select throws_ok('create trigger db06_r2a_forbidden before update on public.waitlist_signups for each row when (false) execute function pg_catalog.suppress_redundant_updates_trigger()','42501','permission denied for table waitlist_signups','anon unauthorized trigger denied on waitlist_signups');

reset role;

select is((select jsonb_agg(jsonb_build_object('oid',oid,'definition',pg_get_triggerdef(oid),'enabled',tgenabled) order by oid) from pg_trigger),(select definitions from db06_triggers_before),'anon leaves every legitimate trigger unchanged on waitlist_signups');

set local role authenticated;

select throws_ok('truncate public.account_deletion_click_tombstones','42501','permission denied for table account_deletion_click_tombstones','authenticated TRUNCATE account_deletion_click_tombstones requires root-table ACL denial');

reset role;

select is(pg_temp.db06_protected_counts(),(select counts from db06_protected_before),'authenticated TRUNCATE account_deletion_click_tombstones independently preserves all 91 protected row counts');

set local role authenticated;

select throws_ok('truncate public.account_deletion_click_tombstones RESTRICT','42501','permission denied for table account_deletion_click_tombstones','authenticated TRUNCATE RESTRICT account_deletion_click_tombstones requires root-table ACL denial');

reset role;

select is(pg_temp.db06_protected_counts(),(select counts from db06_protected_before),'authenticated TRUNCATE RESTRICT account_deletion_click_tombstones independently preserves all 91 protected row counts');

set local role authenticated;

select throws_ok('truncate public.account_deletion_click_tombstones CASCADE','42501','permission denied for table account_deletion_click_tombstones','authenticated TRUNCATE CASCADE account_deletion_click_tombstones requires root-table ACL denial');

reset role;

select is(pg_temp.db06_protected_counts(),(select counts from db06_protected_before),'authenticated TRUNCATE CASCADE account_deletion_click_tombstones independently preserves all 91 protected row counts');

set local role authenticated;

select throws_ok('create trigger db06_r2a_forbidden before update on public.account_deletion_click_tombstones for each row when (false) execute function pg_catalog.suppress_redundant_updates_trigger()','42501','permission denied for table account_deletion_click_tombstones','authenticated unauthorized trigger denied on account_deletion_click_tombstones');

reset role;

select is((select jsonb_agg(jsonb_build_object('oid',oid,'definition',pg_get_triggerdef(oid),'enabled',tgenabled) order by oid) from pg_trigger),(select definitions from db06_triggers_before),'authenticated leaves every legitimate trigger unchanged on account_deletion_click_tombstones');

set local role authenticated;

select throws_ok('truncate public.account_deletion_requests','42501','permission denied for table account_deletion_requests','authenticated TRUNCATE account_deletion_requests requires root-table ACL denial');

reset role;

select is(pg_temp.db06_protected_counts(),(select counts from db06_protected_before),'authenticated TRUNCATE account_deletion_requests independently preserves all 91 protected row counts');

set local role authenticated;

select throws_ok('truncate public.account_deletion_requests RESTRICT','42501','permission denied for table account_deletion_requests','authenticated TRUNCATE RESTRICT account_deletion_requests requires root-table ACL denial');

reset role;

select is(pg_temp.db06_protected_counts(),(select counts from db06_protected_before),'authenticated TRUNCATE RESTRICT account_deletion_requests independently preserves all 91 protected row counts');

set local role authenticated;

select throws_ok('truncate public.account_deletion_requests CASCADE','42501','permission denied for table account_deletion_requests','authenticated TRUNCATE CASCADE account_deletion_requests requires root-table ACL denial');

reset role;

select is(pg_temp.db06_protected_counts(),(select counts from db06_protected_before),'authenticated TRUNCATE CASCADE account_deletion_requests independently preserves all 91 protected row counts');

set local role authenticated;

select throws_ok('create trigger db06_r2a_forbidden before update on public.account_deletion_requests for each row when (false) execute function pg_catalog.suppress_redundant_updates_trigger()','42501','permission denied for table account_deletion_requests','authenticated unauthorized trigger denied on account_deletion_requests');

reset role;

select is((select jsonb_agg(jsonb_build_object('oid',oid,'definition',pg_get_triggerdef(oid),'enabled',tgenabled) order by oid) from pg_trigger),(select definitions from db06_triggers_before),'authenticated leaves every legitimate trigger unchanged on account_deletion_requests');

set local role authenticated;

select throws_ok('truncate public.active_ramp','42501','permission denied for table active_ramp','authenticated TRUNCATE active_ramp requires root-table ACL denial');

reset role;

select is(pg_temp.db06_protected_counts(),(select counts from db06_protected_before),'authenticated TRUNCATE active_ramp independently preserves all 91 protected row counts');

set local role authenticated;

select throws_ok('truncate public.active_ramp RESTRICT','42501','permission denied for table active_ramp','authenticated TRUNCATE RESTRICT active_ramp requires root-table ACL denial');

reset role;

select is(pg_temp.db06_protected_counts(),(select counts from db06_protected_before),'authenticated TRUNCATE RESTRICT active_ramp independently preserves all 91 protected row counts');

set local role authenticated;

select throws_ok('truncate public.active_ramp CASCADE','42501','permission denied for table active_ramp','authenticated TRUNCATE CASCADE active_ramp requires root-table ACL denial');

reset role;

select is(pg_temp.db06_protected_counts(),(select counts from db06_protected_before),'authenticated TRUNCATE CASCADE active_ramp independently preserves all 91 protected row counts');

set local role authenticated;

select throws_ok('create trigger db06_r2a_forbidden before update on public.active_ramp for each row when (false) execute function pg_catalog.suppress_redundant_updates_trigger()','42501','permission denied for table active_ramp','authenticated unauthorized trigger denied on active_ramp');

reset role;

select is((select jsonb_agg(jsonb_build_object('oid',oid,'definition',pg_get_triggerdef(oid),'enabled',tgenabled) order by oid) from pg_trigger),(select definitions from db06_triggers_before),'authenticated leaves every legitimate trigger unchanged on active_ramp');

set local role authenticated;

select throws_ok('truncate public.ask_safety_audit','42501','permission denied for table ask_safety_audit','authenticated TRUNCATE ask_safety_audit requires root-table ACL denial');

reset role;

select is(pg_temp.db06_protected_counts(),(select counts from db06_protected_before),'authenticated TRUNCATE ask_safety_audit independently preserves all 91 protected row counts');

set local role authenticated;

select throws_ok('truncate public.ask_safety_audit RESTRICT','42501','permission denied for table ask_safety_audit','authenticated TRUNCATE RESTRICT ask_safety_audit requires root-table ACL denial');

reset role;

select is(pg_temp.db06_protected_counts(),(select counts from db06_protected_before),'authenticated TRUNCATE RESTRICT ask_safety_audit independently preserves all 91 protected row counts');

set local role authenticated;

select throws_ok('truncate public.ask_safety_audit CASCADE','42501','permission denied for table ask_safety_audit','authenticated TRUNCATE CASCADE ask_safety_audit requires root-table ACL denial');

reset role;

select is(pg_temp.db06_protected_counts(),(select counts from db06_protected_before),'authenticated TRUNCATE CASCADE ask_safety_audit independently preserves all 91 protected row counts');

set local role authenticated;

select throws_ok('create trigger db06_r2a_forbidden before update on public.ask_safety_audit for each row when (false) execute function pg_catalog.suppress_redundant_updates_trigger()','42501','permission denied for table ask_safety_audit','authenticated unauthorized trigger denied on ask_safety_audit');

reset role;

select is((select jsonb_agg(jsonb_build_object('oid',oid,'definition',pg_get_triggerdef(oid),'enabled',tgenabled) order by oid) from pg_trigger),(select definitions from db06_triggers_before),'authenticated leaves every legitimate trigger unchanged on ask_safety_audit');

set local role authenticated;

select throws_ok('truncate public.ask_sessions','42501','permission denied for table ask_sessions','authenticated TRUNCATE ask_sessions requires root-table ACL denial');

reset role;

select is(pg_temp.db06_protected_counts(),(select counts from db06_protected_before),'authenticated TRUNCATE ask_sessions independently preserves all 91 protected row counts');

set local role authenticated;

select throws_ok('truncate public.ask_sessions RESTRICT','42501','permission denied for table ask_sessions','authenticated TRUNCATE RESTRICT ask_sessions requires root-table ACL denial');

reset role;

select is(pg_temp.db06_protected_counts(),(select counts from db06_protected_before),'authenticated TRUNCATE RESTRICT ask_sessions independently preserves all 91 protected row counts');

set local role authenticated;

select throws_ok('truncate public.ask_sessions CASCADE','42501','permission denied for table ask_sessions','authenticated TRUNCATE CASCADE ask_sessions requires root-table ACL denial');

reset role;

select is(pg_temp.db06_protected_counts(),(select counts from db06_protected_before),'authenticated TRUNCATE CASCADE ask_sessions independently preserves all 91 protected row counts');

set local role authenticated;

select throws_ok('create trigger db06_r2a_forbidden before update on public.ask_sessions for each row when (false) execute function pg_catalog.suppress_redundant_updates_trigger()','42501','permission denied for table ask_sessions','authenticated unauthorized trigger denied on ask_sessions');

reset role;

select is((select jsonb_agg(jsonb_build_object('oid',oid,'definition',pg_get_triggerdef(oid),'enabled',tgenabled) order by oid) from pg_trigger),(select definitions from db06_triggers_before),'authenticated leaves every legitimate trigger unchanged on ask_sessions');

set local role authenticated;

select throws_ok('truncate public.ask_turn_audit','42501','permission denied for table ask_turn_audit','authenticated TRUNCATE ask_turn_audit requires root-table ACL denial');

reset role;

select is(pg_temp.db06_protected_counts(),(select counts from db06_protected_before),'authenticated TRUNCATE ask_turn_audit independently preserves all 91 protected row counts');

set local role authenticated;

select throws_ok('truncate public.ask_turn_audit RESTRICT','42501','permission denied for table ask_turn_audit','authenticated TRUNCATE RESTRICT ask_turn_audit requires root-table ACL denial');

reset role;

select is(pg_temp.db06_protected_counts(),(select counts from db06_protected_before),'authenticated TRUNCATE RESTRICT ask_turn_audit independently preserves all 91 protected row counts');

set local role authenticated;

select throws_ok('truncate public.ask_turn_audit CASCADE','42501','permission denied for table ask_turn_audit','authenticated TRUNCATE CASCADE ask_turn_audit requires root-table ACL denial');

reset role;

select is(pg_temp.db06_protected_counts(),(select counts from db06_protected_before),'authenticated TRUNCATE CASCADE ask_turn_audit independently preserves all 91 protected row counts');

set local role authenticated;

select throws_ok('create trigger db06_r2a_forbidden before update on public.ask_turn_audit for each row when (false) execute function pg_catalog.suppress_redundant_updates_trigger()','42501','permission denied for table ask_turn_audit','authenticated unauthorized trigger denied on ask_turn_audit');

reset role;

select is((select jsonb_agg(jsonb_build_object('oid',oid,'definition',pg_get_triggerdef(oid),'enabled',tgenabled) order by oid) from pg_trigger),(select definitions from db06_triggers_before),'authenticated leaves every legitimate trigger unchanged on ask_turn_audit');

set local role authenticated;

select throws_ok('truncate public.community_blocks','42501','permission denied for table community_blocks','authenticated TRUNCATE community_blocks requires root-table ACL denial');

reset role;

select is(pg_temp.db06_protected_counts(),(select counts from db06_protected_before),'authenticated TRUNCATE community_blocks independently preserves all 91 protected row counts');

set local role authenticated;

select throws_ok('truncate public.community_blocks RESTRICT','42501','permission denied for table community_blocks','authenticated TRUNCATE RESTRICT community_blocks requires root-table ACL denial');

reset role;

select is(pg_temp.db06_protected_counts(),(select counts from db06_protected_before),'authenticated TRUNCATE RESTRICT community_blocks independently preserves all 91 protected row counts');

set local role authenticated;

select throws_ok('truncate public.community_blocks CASCADE','42501','permission denied for table community_blocks','authenticated TRUNCATE CASCADE community_blocks requires root-table ACL denial');

reset role;

select is(pg_temp.db06_protected_counts(),(select counts from db06_protected_before),'authenticated TRUNCATE CASCADE community_blocks independently preserves all 91 protected row counts');

set local role authenticated;

select throws_ok('create trigger db06_r2a_forbidden before update on public.community_blocks for each row when (false) execute function pg_catalog.suppress_redundant_updates_trigger()','42501','permission denied for table community_blocks','authenticated unauthorized trigger denied on community_blocks');

reset role;

select is((select jsonb_agg(jsonb_build_object('oid',oid,'definition',pg_get_triggerdef(oid),'enabled',tgenabled) order by oid) from pg_trigger),(select definitions from db06_triggers_before),'authenticated leaves every legitimate trigger unchanged on community_blocks');

set local role authenticated;

select throws_ok('truncate public.community_moderation_events','42501','permission denied for table community_moderation_events','authenticated TRUNCATE community_moderation_events requires root-table ACL denial');

reset role;

select is(pg_temp.db06_protected_counts(),(select counts from db06_protected_before),'authenticated TRUNCATE community_moderation_events independently preserves all 91 protected row counts');

set local role authenticated;

select throws_ok('truncate public.community_moderation_events RESTRICT','42501','permission denied for table community_moderation_events','authenticated TRUNCATE RESTRICT community_moderation_events requires root-table ACL denial');

reset role;

select is(pg_temp.db06_protected_counts(),(select counts from db06_protected_before),'authenticated TRUNCATE RESTRICT community_moderation_events independently preserves all 91 protected row counts');

set local role authenticated;

select throws_ok('truncate public.community_moderation_events CASCADE','42501','permission denied for table community_moderation_events','authenticated TRUNCATE CASCADE community_moderation_events requires root-table ACL denial');

reset role;

select is(pg_temp.db06_protected_counts(),(select counts from db06_protected_before),'authenticated TRUNCATE CASCADE community_moderation_events independently preserves all 91 protected row counts');

set local role authenticated;

select throws_ok('create trigger db06_r2a_forbidden before update on public.community_moderation_events for each row when (false) execute function pg_catalog.suppress_redundant_updates_trigger()','42501','permission denied for table community_moderation_events','authenticated unauthorized trigger denied on community_moderation_events');

reset role;

select is((select jsonb_agg(jsonb_build_object('oid',oid,'definition',pg_get_triggerdef(oid),'enabled',tgenabled) order by oid) from pg_trigger),(select definitions from db06_triggers_before),'authenticated leaves every legitimate trigger unchanged on community_moderation_events');

set local role authenticated;

select throws_ok('truncate public.community_notes','42501','permission denied for table community_notes','authenticated TRUNCATE community_notes requires root-table ACL denial');

reset role;

select is(pg_temp.db06_protected_counts(),(select counts from db06_protected_before),'authenticated TRUNCATE community_notes independently preserves all 91 protected row counts');

set local role authenticated;

select throws_ok('truncate public.community_notes RESTRICT','42501','permission denied for table community_notes','authenticated TRUNCATE RESTRICT community_notes requires root-table ACL denial');

reset role;

select is(pg_temp.db06_protected_counts(),(select counts from db06_protected_before),'authenticated TRUNCATE RESTRICT community_notes independently preserves all 91 protected row counts');

set local role authenticated;

select throws_ok('truncate public.community_notes CASCADE','42501','permission denied for table community_notes','authenticated TRUNCATE CASCADE community_notes requires root-table ACL denial');

reset role;

select is(pg_temp.db06_protected_counts(),(select counts from db06_protected_before),'authenticated TRUNCATE CASCADE community_notes independently preserves all 91 protected row counts');

set local role authenticated;

select throws_ok('create trigger db06_r2a_forbidden before update on public.community_notes for each row when (false) execute function pg_catalog.suppress_redundant_updates_trigger()','42501','permission denied for table community_notes','authenticated unauthorized trigger denied on community_notes');

reset role;

select is((select jsonb_agg(jsonb_build_object('oid',oid,'definition',pg_get_triggerdef(oid),'enabled',tgenabled) order by oid) from pg_trigger),(select definitions from db06_triggers_before),'authenticated leaves every legitimate trigger unchanged on community_notes');

set local role authenticated;

select throws_ok('truncate public.community_questions','42501','permission denied for table community_questions','authenticated TRUNCATE community_questions requires root-table ACL denial');

reset role;

select is(pg_temp.db06_protected_counts(),(select counts from db06_protected_before),'authenticated TRUNCATE community_questions independently preserves all 91 protected row counts');

set local role authenticated;

select throws_ok('truncate public.community_questions RESTRICT','42501','permission denied for table community_questions','authenticated TRUNCATE RESTRICT community_questions requires root-table ACL denial');

reset role;

select is(pg_temp.db06_protected_counts(),(select counts from db06_protected_before),'authenticated TRUNCATE RESTRICT community_questions independently preserves all 91 protected row counts');

set local role authenticated;

select throws_ok('truncate public.community_questions CASCADE','42501','permission denied for table community_questions','authenticated TRUNCATE CASCADE community_questions requires root-table ACL denial');

reset role;

select is(pg_temp.db06_protected_counts(),(select counts from db06_protected_before),'authenticated TRUNCATE CASCADE community_questions independently preserves all 91 protected row counts');

set local role authenticated;

select throws_ok('create trigger db06_r2a_forbidden before update on public.community_questions for each row when (false) execute function pg_catalog.suppress_redundant_updates_trigger()','42501','permission denied for table community_questions','authenticated unauthorized trigger denied on community_questions');

reset role;

select is((select jsonb_agg(jsonb_build_object('oid',oid,'definition',pg_get_triggerdef(oid),'enabled',tgenabled) order by oid) from pg_trigger),(select definitions from db06_triggers_before),'authenticated leaves every legitimate trigger unchanged on community_questions');

set local role authenticated;

select throws_ok('truncate public.community_reactions','42501','permission denied for table community_reactions','authenticated TRUNCATE community_reactions requires root-table ACL denial');

reset role;

select is(pg_temp.db06_protected_counts(),(select counts from db06_protected_before),'authenticated TRUNCATE community_reactions independently preserves all 91 protected row counts');

set local role authenticated;

select throws_ok('truncate public.community_reactions RESTRICT','42501','permission denied for table community_reactions','authenticated TRUNCATE RESTRICT community_reactions requires root-table ACL denial');

reset role;

select is(pg_temp.db06_protected_counts(),(select counts from db06_protected_before),'authenticated TRUNCATE RESTRICT community_reactions independently preserves all 91 protected row counts');

set local role authenticated;

select throws_ok('truncate public.community_reactions CASCADE','42501','permission denied for table community_reactions','authenticated TRUNCATE CASCADE community_reactions requires root-table ACL denial');

reset role;

select is(pg_temp.db06_protected_counts(),(select counts from db06_protected_before),'authenticated TRUNCATE CASCADE community_reactions independently preserves all 91 protected row counts');

set local role authenticated;

select throws_ok('create trigger db06_r2a_forbidden before update on public.community_reactions for each row when (false) execute function pg_catalog.suppress_redundant_updates_trigger()','42501','permission denied for table community_reactions','authenticated unauthorized trigger denied on community_reactions');

reset role;

select is((select jsonb_agg(jsonb_build_object('oid',oid,'definition',pg_get_triggerdef(oid),'enabled',tgenabled) order by oid) from pg_trigger),(select definitions from db06_triggers_before),'authenticated leaves every legitimate trigger unchanged on community_reactions');

set local role authenticated;

select throws_ok('truncate public.community_reports','42501','permission denied for table community_reports','authenticated TRUNCATE community_reports requires root-table ACL denial');

reset role;

select is(pg_temp.db06_protected_counts(),(select counts from db06_protected_before),'authenticated TRUNCATE community_reports independently preserves all 91 protected row counts');

set local role authenticated;

select throws_ok('truncate public.community_reports RESTRICT','42501','permission denied for table community_reports','authenticated TRUNCATE RESTRICT community_reports requires root-table ACL denial');

reset role;

select is(pg_temp.db06_protected_counts(),(select counts from db06_protected_before),'authenticated TRUNCATE RESTRICT community_reports independently preserves all 91 protected row counts');

set local role authenticated;

select throws_ok('truncate public.community_reports CASCADE','42501','permission denied for table community_reports','authenticated TRUNCATE CASCADE community_reports requires root-table ACL denial');

reset role;

select is(pg_temp.db06_protected_counts(),(select counts from db06_protected_before),'authenticated TRUNCATE CASCADE community_reports independently preserves all 91 protected row counts');

set local role authenticated;

select throws_ok('create trigger db06_r2a_forbidden before update on public.community_reports for each row when (false) execute function pg_catalog.suppress_redundant_updates_trigger()','42501','permission denied for table community_reports','authenticated unauthorized trigger denied on community_reports');

reset role;

select is((select jsonb_agg(jsonb_build_object('oid',oid,'definition',pg_get_triggerdef(oid),'enabled',tgenabled) order by oid) from pg_trigger),(select definitions from db06_triggers_before),'authenticated leaves every legitimate trigger unchanged on community_reports');

set local role authenticated;

select throws_ok('truncate public.community_topics','42501','permission denied for table community_topics','authenticated TRUNCATE community_topics requires root-table ACL denial');

reset role;

select is(pg_temp.db06_protected_counts(),(select counts from db06_protected_before),'authenticated TRUNCATE community_topics independently preserves all 91 protected row counts');

set local role authenticated;

select throws_ok('truncate public.community_topics RESTRICT','42501','permission denied for table community_topics','authenticated TRUNCATE RESTRICT community_topics requires root-table ACL denial');

reset role;

select is(pg_temp.db06_protected_counts(),(select counts from db06_protected_before),'authenticated TRUNCATE RESTRICT community_topics independently preserves all 91 protected row counts');

set local role authenticated;

select throws_ok('truncate public.community_topics CASCADE','42501','permission denied for table community_topics','authenticated TRUNCATE CASCADE community_topics requires root-table ACL denial');

reset role;

select is(pg_temp.db06_protected_counts(),(select counts from db06_protected_before),'authenticated TRUNCATE CASCADE community_topics independently preserves all 91 protected row counts');

set local role authenticated;

select throws_ok('create trigger db06_r2a_forbidden before update on public.community_topics for each row when (false) execute function pg_catalog.suppress_redundant_updates_trigger()','42501','permission denied for table community_topics','authenticated unauthorized trigger denied on community_topics');

reset role;

select is((select jsonb_agg(jsonb_build_object('oid',oid,'definition',pg_get_triggerdef(oid),'enabled',tgenabled) order by oid) from pg_trigger),(select definitions from db06_triggers_before),'authenticated leaves every legitimate trigger unchanged on community_topics');

set local role authenticated;

select throws_ok('truncate public.consents','42501','permission denied for table consents','authenticated TRUNCATE consents requires root-table ACL denial');

reset role;

select is(pg_temp.db06_protected_counts(),(select counts from db06_protected_before),'authenticated TRUNCATE consents independently preserves all 91 protected row counts');

set local role authenticated;

select throws_ok('truncate public.consents RESTRICT','42501','permission denied for table consents','authenticated TRUNCATE RESTRICT consents requires root-table ACL denial');

reset role;

select is(pg_temp.db06_protected_counts(),(select counts from db06_protected_before),'authenticated TRUNCATE RESTRICT consents independently preserves all 91 protected row counts');

set local role authenticated;

select throws_ok('truncate public.consents CASCADE','42501','permission denied for table consents','authenticated TRUNCATE CASCADE consents requires root-table ACL denial');

reset role;

select is(pg_temp.db06_protected_counts(),(select counts from db06_protected_before),'authenticated TRUNCATE CASCADE consents independently preserves all 91 protected row counts');

set local role authenticated;

select throws_ok('create trigger db06_r2a_forbidden before update on public.consents for each row when (false) execute function pg_catalog.suppress_redundant_updates_trigger()','42501','permission denied for table consents','authenticated unauthorized trigger denied on consents');

reset role;

select is((select jsonb_agg(jsonb_build_object('oid',oid,'definition',pg_get_triggerdef(oid),'enabled',tgenabled) order by oid) from pg_trigger),(select definitions from db06_triggers_before),'authenticated leaves every legitimate trigger unchanged on consents');

set local role authenticated;

select throws_ok('truncate public.cycle_nights','42501','permission denied for table cycle_nights','authenticated TRUNCATE cycle_nights requires root-table ACL denial');

reset role;

select is(pg_temp.db06_protected_counts(),(select counts from db06_protected_before),'authenticated TRUNCATE cycle_nights independently preserves all 91 protected row counts');

set local role authenticated;

select throws_ok('truncate public.cycle_nights RESTRICT','42501','permission denied for table cycle_nights','authenticated TRUNCATE RESTRICT cycle_nights requires root-table ACL denial');

reset role;

select is(pg_temp.db06_protected_counts(),(select counts from db06_protected_before),'authenticated TRUNCATE RESTRICT cycle_nights independently preserves all 91 protected row counts');

set local role authenticated;

select throws_ok('truncate public.cycle_nights CASCADE','42501','permission denied for table cycle_nights','authenticated TRUNCATE CASCADE cycle_nights requires root-table ACL denial');

reset role;

select is(pg_temp.db06_protected_counts(),(select counts from db06_protected_before),'authenticated TRUNCATE CASCADE cycle_nights independently preserves all 91 protected row counts');

set local role authenticated;

select throws_ok('create trigger db06_r2a_forbidden before update on public.cycle_nights for each row when (false) execute function pg_catalog.suppress_redundant_updates_trigger()','42501','permission denied for table cycle_nights','authenticated unauthorized trigger denied on cycle_nights');

reset role;

select is((select jsonb_agg(jsonb_build_object('oid',oid,'definition',pg_get_triggerdef(oid),'enabled',tgenabled) order by oid) from pg_trigger),(select definitions from db06_triggers_before),'authenticated leaves every legitimate trigger unchanged on cycle_nights');

set local role authenticated;

select throws_ok('truncate public.cycles','42501','permission denied for table cycles','authenticated TRUNCATE cycles requires root-table ACL denial');

reset role;

select is(pg_temp.db06_protected_counts(),(select counts from db06_protected_before),'authenticated TRUNCATE cycles independently preserves all 91 protected row counts');

set local role authenticated;

select throws_ok('truncate public.cycles RESTRICT','42501','permission denied for table cycles','authenticated TRUNCATE RESTRICT cycles requires root-table ACL denial');

reset role;

select is(pg_temp.db06_protected_counts(),(select counts from db06_protected_before),'authenticated TRUNCATE RESTRICT cycles independently preserves all 91 protected row counts');

set local role authenticated;

select throws_ok('truncate public.cycles CASCADE','42501','permission denied for table cycles','authenticated TRUNCATE CASCADE cycles requires root-table ACL denial');

reset role;

select is(pg_temp.db06_protected_counts(),(select counts from db06_protected_before),'authenticated TRUNCATE CASCADE cycles independently preserves all 91 protected row counts');

set local role authenticated;

select throws_ok('create trigger db06_r2a_forbidden before update on public.cycles for each row when (false) execute function pg_catalog.suppress_redundant_updates_trigger()','42501','permission denied for table cycles','authenticated unauthorized trigger denied on cycles');

reset role;

select is((select jsonb_agg(jsonb_build_object('oid',oid,'definition',pg_get_triggerdef(oid),'enabled',tgenabled) order by oid) from pg_trigger),(select definitions from db06_triggers_before),'authenticated leaves every legitimate trigger unchanged on cycles');

set local role authenticated;

select throws_ok('truncate public.entitlements','42501','permission denied for table entitlements','authenticated TRUNCATE entitlements requires root-table ACL denial');

reset role;

select is(pg_temp.db06_protected_counts(),(select counts from db06_protected_before),'authenticated TRUNCATE entitlements independently preserves all 91 protected row counts');

set local role authenticated;

select throws_ok('truncate public.entitlements RESTRICT','42501','permission denied for table entitlements','authenticated TRUNCATE RESTRICT entitlements requires root-table ACL denial');

reset role;

select is(pg_temp.db06_protected_counts(),(select counts from db06_protected_before),'authenticated TRUNCATE RESTRICT entitlements independently preserves all 91 protected row counts');

set local role authenticated;

select throws_ok('truncate public.entitlements CASCADE','42501','permission denied for table entitlements','authenticated TRUNCATE CASCADE entitlements requires root-table ACL denial');

reset role;

select is(pg_temp.db06_protected_counts(),(select counts from db06_protected_before),'authenticated TRUNCATE CASCADE entitlements independently preserves all 91 protected row counts');

set local role authenticated;

select throws_ok('create trigger db06_r2a_forbidden before update on public.entitlements for each row when (false) execute function pg_catalog.suppress_redundant_updates_trigger()','42501','permission denied for table entitlements','authenticated unauthorized trigger denied on entitlements');

reset role;

select is((select jsonb_agg(jsonb_build_object('oid',oid,'definition',pg_get_triggerdef(oid),'enabled',tgenabled) order by oid) from pg_trigger),(select definitions from db06_triggers_before),'authenticated leaves every legitimate trigger unchanged on entitlements');

set local role authenticated;

select throws_ok('truncate public.growth_events','42501','permission denied for table growth_events','authenticated TRUNCATE growth_events requires root-table ACL denial');

reset role;

select is(pg_temp.db06_protected_counts(),(select counts from db06_protected_before),'authenticated TRUNCATE growth_events independently preserves all 91 protected row counts');

set local role authenticated;

select throws_ok('truncate public.growth_events RESTRICT','42501','permission denied for table growth_events','authenticated TRUNCATE RESTRICT growth_events requires root-table ACL denial');

reset role;

select is(pg_temp.db06_protected_counts(),(select counts from db06_protected_before),'authenticated TRUNCATE RESTRICT growth_events independently preserves all 91 protected row counts');

set local role authenticated;

select throws_ok('truncate public.growth_events CASCADE','42501','permission denied for table growth_events','authenticated TRUNCATE CASCADE growth_events requires root-table ACL denial');

reset role;

select is(pg_temp.db06_protected_counts(),(select counts from db06_protected_before),'authenticated TRUNCATE CASCADE growth_events independently preserves all 91 protected row counts');

set local role authenticated;

select throws_ok('create trigger db06_r2a_forbidden before update on public.growth_events for each row when (false) execute function pg_catalog.suppress_redundant_updates_trigger()','42501','permission denied for table growth_events','authenticated unauthorized trigger denied on growth_events');

reset role;

select is((select jsonb_agg(jsonb_build_object('oid',oid,'definition',pg_get_triggerdef(oid),'enabled',tgenabled) order by oid) from pg_trigger),(select definitions from db06_triggers_before),'authenticated leaves every legitimate trigger unchanged on growth_events');

set local role authenticated;

select throws_ok('truncate public.notification_log','42501','permission denied for table notification_log','authenticated TRUNCATE notification_log requires root-table ACL denial');

reset role;

select is(pg_temp.db06_protected_counts(),(select counts from db06_protected_before),'authenticated TRUNCATE notification_log independently preserves all 91 protected row counts');

set local role authenticated;

select throws_ok('truncate public.notification_log RESTRICT','42501','permission denied for table notification_log','authenticated TRUNCATE RESTRICT notification_log requires root-table ACL denial');

reset role;

select is(pg_temp.db06_protected_counts(),(select counts from db06_protected_before),'authenticated TRUNCATE RESTRICT notification_log independently preserves all 91 protected row counts');

set local role authenticated;

select throws_ok('truncate public.notification_log CASCADE','42501','permission denied for table notification_log','authenticated TRUNCATE CASCADE notification_log requires root-table ACL denial');

reset role;

select is(pg_temp.db06_protected_counts(),(select counts from db06_protected_before),'authenticated TRUNCATE CASCADE notification_log independently preserves all 91 protected row counts');

set local role authenticated;

select throws_ok('create trigger db06_r2a_forbidden before update on public.notification_log for each row when (false) execute function pg_catalog.suppress_redundant_updates_trigger()','42501','permission denied for table notification_log','authenticated unauthorized trigger denied on notification_log');

reset role;

select is((select jsonb_agg(jsonb_build_object('oid',oid,'definition',pg_get_triggerdef(oid),'enabled',tgenabled) order by oid) from pg_trigger),(select definitions from db06_triggers_before),'authenticated leaves every legitimate trigger unchanged on notification_log');

set local role authenticated;

select throws_ok('truncate public.notification_preferences','42501','permission denied for table notification_preferences','authenticated TRUNCATE notification_preferences requires root-table ACL denial');

reset role;

select is(pg_temp.db06_protected_counts(),(select counts from db06_protected_before),'authenticated TRUNCATE notification_preferences independently preserves all 91 protected row counts');

set local role authenticated;

select throws_ok('truncate public.notification_preferences RESTRICT','42501','permission denied for table notification_preferences','authenticated TRUNCATE RESTRICT notification_preferences requires root-table ACL denial');

reset role;

select is(pg_temp.db06_protected_counts(),(select counts from db06_protected_before),'authenticated TRUNCATE RESTRICT notification_preferences independently preserves all 91 protected row counts');

set local role authenticated;

select throws_ok('truncate public.notification_preferences CASCADE','42501','permission denied for table notification_preferences','authenticated TRUNCATE CASCADE notification_preferences requires root-table ACL denial');

reset role;

select is(pg_temp.db06_protected_counts(),(select counts from db06_protected_before),'authenticated TRUNCATE CASCADE notification_preferences independently preserves all 91 protected row counts');

set local role authenticated;

select throws_ok('create trigger db06_r2a_forbidden before update on public.notification_preferences for each row when (false) execute function pg_catalog.suppress_redundant_updates_trigger()','42501','permission denied for table notification_preferences','authenticated unauthorized trigger denied on notification_preferences');

reset role;

select is((select jsonb_agg(jsonb_build_object('oid',oid,'definition',pg_get_triggerdef(oid),'enabled',tgenabled) order by oid) from pg_trigger),(select definitions from db06_triggers_before),'authenticated leaves every legitimate trigger unchanged on notification_preferences');

set local role authenticated;

select throws_ok('truncate public.photo_trend','42501','permission denied for table photo_trend','authenticated TRUNCATE photo_trend requires root-table ACL denial');

reset role;

select is(pg_temp.db06_protected_counts(),(select counts from db06_protected_before),'authenticated TRUNCATE photo_trend independently preserves all 91 protected row counts');

set local role authenticated;

select throws_ok('truncate public.photo_trend RESTRICT','42501','permission denied for table photo_trend','authenticated TRUNCATE RESTRICT photo_trend requires root-table ACL denial');

reset role;

select is(pg_temp.db06_protected_counts(),(select counts from db06_protected_before),'authenticated TRUNCATE RESTRICT photo_trend independently preserves all 91 protected row counts');

set local role authenticated;

select throws_ok('truncate public.photo_trend CASCADE','42501','permission denied for table photo_trend','authenticated TRUNCATE CASCADE photo_trend requires root-table ACL denial');

reset role;

select is(pg_temp.db06_protected_counts(),(select counts from db06_protected_before),'authenticated TRUNCATE CASCADE photo_trend independently preserves all 91 protected row counts');

set local role authenticated;

select throws_ok('create trigger db06_r2a_forbidden before update on public.photo_trend for each row when (false) execute function pg_catalog.suppress_redundant_updates_trigger()','42501','permission denied for table photo_trend','authenticated unauthorized trigger denied on photo_trend');

reset role;

select is((select jsonb_agg(jsonb_build_object('oid',oid,'definition',pg_get_triggerdef(oid),'enabled',tgenabled) order by oid) from pg_trigger),(select definitions from db06_triggers_before),'authenticated leaves every legitimate trigger unchanged on photo_trend');

set local role authenticated;

select throws_ok('truncate public.photos','42501','permission denied for table photos','authenticated TRUNCATE photos requires root-table ACL denial');

reset role;

select is(pg_temp.db06_protected_counts(),(select counts from db06_protected_before),'authenticated TRUNCATE photos independently preserves all 91 protected row counts');

set local role authenticated;

select throws_ok('truncate public.photos RESTRICT','42501','permission denied for table photos','authenticated TRUNCATE RESTRICT photos requires root-table ACL denial');

reset role;

select is(pg_temp.db06_protected_counts(),(select counts from db06_protected_before),'authenticated TRUNCATE RESTRICT photos independently preserves all 91 protected row counts');

set local role authenticated;

select throws_ok('truncate public.photos CASCADE','42501','permission denied for table photos','authenticated TRUNCATE CASCADE photos requires root-table ACL denial');

reset role;

select is(pg_temp.db06_protected_counts(),(select counts from db06_protected_before),'authenticated TRUNCATE CASCADE photos independently preserves all 91 protected row counts');

set local role authenticated;

select throws_ok('create trigger db06_r2a_forbidden before update on public.photos for each row when (false) execute function pg_catalog.suppress_redundant_updates_trigger()','42501','permission denied for table photos','authenticated unauthorized trigger denied on photos');

reset role;

select is((select jsonb_agg(jsonb_build_object('oid',oid,'definition',pg_get_triggerdef(oid),'enabled',tgenabled) order by oid) from pg_trigger),(select definitions from db06_triggers_before),'authenticated leaves every legitimate trigger unchanged on photos');

set local role authenticated;

select throws_ok('truncate public.reverse_trial_grants','42501','permission denied for table reverse_trial_grants','authenticated TRUNCATE reverse_trial_grants requires root-table ACL denial');

reset role;

select is(pg_temp.db06_protected_counts(),(select counts from db06_protected_before),'authenticated TRUNCATE reverse_trial_grants independently preserves all 91 protected row counts');

set local role authenticated;

select throws_ok('truncate public.reverse_trial_grants RESTRICT','42501','permission denied for table reverse_trial_grants','authenticated TRUNCATE RESTRICT reverse_trial_grants requires root-table ACL denial');

reset role;

select is(pg_temp.db06_protected_counts(),(select counts from db06_protected_before),'authenticated TRUNCATE RESTRICT reverse_trial_grants independently preserves all 91 protected row counts');

set local role authenticated;

select throws_ok('truncate public.reverse_trial_grants CASCADE','42501','permission denied for table reverse_trial_grants','authenticated TRUNCATE CASCADE reverse_trial_grants requires root-table ACL denial');

reset role;

select is(pg_temp.db06_protected_counts(),(select counts from db06_protected_before),'authenticated TRUNCATE CASCADE reverse_trial_grants independently preserves all 91 protected row counts');

set local role authenticated;

select throws_ok('create trigger db06_r2a_forbidden before update on public.reverse_trial_grants for each row when (false) execute function pg_catalog.suppress_redundant_updates_trigger()','42501','permission denied for table reverse_trial_grants','authenticated unauthorized trigger denied on reverse_trial_grants');

reset role;

select is((select jsonb_agg(jsonb_build_object('oid',oid,'definition',pg_get_triggerdef(oid),'enabled',tgenabled) order by oid) from pg_trigger),(select definitions from db06_triggers_before),'authenticated leaves every legitimate trigger unchanged on reverse_trial_grants');

set local role authenticated;

select throws_ok('truncate public.routine_conflicts','42501','permission denied for table routine_conflicts','authenticated TRUNCATE routine_conflicts requires root-table ACL denial');

reset role;

select is(pg_temp.db06_protected_counts(),(select counts from db06_protected_before),'authenticated TRUNCATE routine_conflicts independently preserves all 91 protected row counts');

set local role authenticated;

select throws_ok('truncate public.routine_conflicts RESTRICT','42501','permission denied for table routine_conflicts','authenticated TRUNCATE RESTRICT routine_conflicts requires root-table ACL denial');

reset role;

select is(pg_temp.db06_protected_counts(),(select counts from db06_protected_before),'authenticated TRUNCATE RESTRICT routine_conflicts independently preserves all 91 protected row counts');

set local role authenticated;

select throws_ok('truncate public.routine_conflicts CASCADE','42501','permission denied for table routine_conflicts','authenticated TRUNCATE CASCADE routine_conflicts requires root-table ACL denial');

reset role;

select is(pg_temp.db06_protected_counts(),(select counts from db06_protected_before),'authenticated TRUNCATE CASCADE routine_conflicts independently preserves all 91 protected row counts');

set local role authenticated;

select throws_ok('create trigger db06_r2a_forbidden before update on public.routine_conflicts for each row when (false) execute function pg_catalog.suppress_redundant_updates_trigger()','42501','permission denied for table routine_conflicts','authenticated unauthorized trigger denied on routine_conflicts');

reset role;

select is((select jsonb_agg(jsonb_build_object('oid',oid,'definition',pg_get_triggerdef(oid),'enabled',tgenabled) order by oid) from pg_trigger),(select definitions from db06_triggers_before),'authenticated leaves every legitimate trigger unchanged on routine_conflicts');

set local role authenticated;

select throws_ok('truncate public.skin_profiles','42501','permission denied for table skin_profiles','authenticated TRUNCATE skin_profiles requires root-table ACL denial');

reset role;

select is(pg_temp.db06_protected_counts(),(select counts from db06_protected_before),'authenticated TRUNCATE skin_profiles independently preserves all 91 protected row counts');

set local role authenticated;

select throws_ok('truncate public.skin_profiles RESTRICT','42501','permission denied for table skin_profiles','authenticated TRUNCATE RESTRICT skin_profiles requires root-table ACL denial');

reset role;

select is(pg_temp.db06_protected_counts(),(select counts from db06_protected_before),'authenticated TRUNCATE RESTRICT skin_profiles independently preserves all 91 protected row counts');

set local role authenticated;

select throws_ok('truncate public.skin_profiles CASCADE','42501','permission denied for table skin_profiles','authenticated TRUNCATE CASCADE skin_profiles requires root-table ACL denial');

reset role;

select is(pg_temp.db06_protected_counts(),(select counts from db06_protected_before),'authenticated TRUNCATE CASCADE skin_profiles independently preserves all 91 protected row counts');

set local role authenticated;

select throws_ok('create trigger db06_r2a_forbidden before update on public.skin_profiles for each row when (false) execute function pg_catalog.suppress_redundant_updates_trigger()','42501','permission denied for table skin_profiles','authenticated unauthorized trigger denied on skin_profiles');

reset role;

select is((select jsonb_agg(jsonb_build_object('oid',oid,'definition',pg_get_triggerdef(oid),'enabled',tgenabled) order by oid) from pg_trigger),(select definitions from db06_triggers_before),'authenticated leaves every legitimate trigger unchanged on skin_profiles');

set local role authenticated;

select throws_ok('truncate public.subscriptions_events','42501','permission denied for table subscriptions_events','authenticated TRUNCATE subscriptions_events requires root-table ACL denial');

reset role;

select is(pg_temp.db06_protected_counts(),(select counts from db06_protected_before),'authenticated TRUNCATE subscriptions_events independently preserves all 91 protected row counts');

set local role authenticated;

select throws_ok('truncate public.subscriptions_events RESTRICT','42501','permission denied for table subscriptions_events','authenticated TRUNCATE RESTRICT subscriptions_events requires root-table ACL denial');

reset role;

select is(pg_temp.db06_protected_counts(),(select counts from db06_protected_before),'authenticated TRUNCATE RESTRICT subscriptions_events independently preserves all 91 protected row counts');

set local role authenticated;

select throws_ok('truncate public.subscriptions_events CASCADE','42501','permission denied for table subscriptions_events','authenticated TRUNCATE CASCADE subscriptions_events requires root-table ACL denial');

reset role;

select is(pg_temp.db06_protected_counts(),(select counts from db06_protected_before),'authenticated TRUNCATE CASCADE subscriptions_events independently preserves all 91 protected row counts');

set local role authenticated;

select throws_ok('create trigger db06_r2a_forbidden before update on public.subscriptions_events for each row when (false) execute function pg_catalog.suppress_redundant_updates_trigger()','42501','permission denied for table subscriptions_events','authenticated unauthorized trigger denied on subscriptions_events');

reset role;

select is((select jsonb_agg(jsonb_build_object('oid',oid,'definition',pg_get_triggerdef(oid),'enabled',tgenabled) order by oid) from pg_trigger),(select definitions from db06_triggers_before),'authenticated leaves every legitimate trigger unchanged on subscriptions_events');

set local role authenticated;

select throws_ok('truncate public.waitlist_signups','42501','permission denied for table waitlist_signups','authenticated TRUNCATE waitlist_signups requires root-table ACL denial');

reset role;

select is(pg_temp.db06_protected_counts(),(select counts from db06_protected_before),'authenticated TRUNCATE waitlist_signups independently preserves all 91 protected row counts');

set local role authenticated;

select throws_ok('truncate public.waitlist_signups RESTRICT','42501','permission denied for table waitlist_signups','authenticated TRUNCATE RESTRICT waitlist_signups requires root-table ACL denial');

reset role;

select is(pg_temp.db06_protected_counts(),(select counts from db06_protected_before),'authenticated TRUNCATE RESTRICT waitlist_signups independently preserves all 91 protected row counts');

set local role authenticated;

select throws_ok('truncate public.waitlist_signups CASCADE','42501','permission denied for table waitlist_signups','authenticated TRUNCATE CASCADE waitlist_signups requires root-table ACL denial');

reset role;

select is(pg_temp.db06_protected_counts(),(select counts from db06_protected_before),'authenticated TRUNCATE CASCADE waitlist_signups independently preserves all 91 protected row counts');

set local role authenticated;

select throws_ok('create trigger db06_r2a_forbidden before update on public.waitlist_signups for each row when (false) execute function pg_catalog.suppress_redundant_updates_trigger()','42501','permission denied for table waitlist_signups','authenticated unauthorized trigger denied on waitlist_signups');

reset role;

select is((select jsonb_agg(jsonb_build_object('oid',oid,'definition',pg_get_triggerdef(oid),'enabled',tgenabled) order by oid) from pg_trigger),(select definitions from db06_triggers_before),'authenticated leaves every legitimate trigger unchanged on waitlist_signups');

create schema db06_r2a_ddl_control; grant usage,create on schema db06_r2a_ddl_control to anon,authenticated; create table db06_r2a_ddl_control.allowed_parent(id bigint primary key); grant references on table db06_r2a_ddl_control.allowed_parent to anon,authenticated;

set local role anon;

select lives_ok('create table db06_r2a_ddl_control.anon_positive(id bigint references db06_r2a_ddl_control.allowed_parent(id))','anon has usable permanent-schema CREATE and valid FK DDL control');

select lives_ok('create table db06_r2a_ddl_control.anon_account_deletion_click_tombstones(k1 text)','anon can create isolated permanent child for account_deletion_click_tombstones');

select throws_ok('alter table db06_r2a_ddl_control.anon_account_deletion_click_tombstones add foreign key(k1) references public.account_deletion_click_tombstones(click_token_hash)','42501','permission denied for table account_deletion_click_tombstones','anon REFERENCES denied on account_deletion_click_tombstones after successful CREATE');

select lives_ok('create table db06_r2a_ddl_control.anon_account_deletion_requests(k1 uuid)','anon can create isolated permanent child for account_deletion_requests');

select throws_ok('alter table db06_r2a_ddl_control.anon_account_deletion_requests add foreign key(k1) references public.account_deletion_requests(request_id)','42501','permission denied for table account_deletion_requests','anon REFERENCES denied on account_deletion_requests after successful CREATE');

select lives_ok('create table db06_r2a_ddl_control.anon_active_ramp(k1 uuid)','anon can create isolated permanent child for active_ramp');

select throws_ok('alter table db06_r2a_ddl_control.anon_active_ramp add foreign key(k1) references public.active_ramp(id)','42501','permission denied for table active_ramp','anon REFERENCES denied on active_ramp after successful CREATE');

select lives_ok('create table db06_r2a_ddl_control.anon_ask_safety_audit(k1 uuid)','anon can create isolated permanent child for ask_safety_audit');

select throws_ok('alter table db06_r2a_ddl_control.anon_ask_safety_audit add foreign key(k1) references public.ask_safety_audit(id)','42501','permission denied for table ask_safety_audit','anon REFERENCES denied on ask_safety_audit after successful CREATE');

select lives_ok('create table db06_r2a_ddl_control.anon_ask_sessions(k1 uuid)','anon can create isolated permanent child for ask_sessions');

select throws_ok('alter table db06_r2a_ddl_control.anon_ask_sessions add foreign key(k1) references public.ask_sessions(id)','42501','permission denied for table ask_sessions','anon REFERENCES denied on ask_sessions after successful CREATE');

select lives_ok('create table db06_r2a_ddl_control.anon_ask_turn_audit(k1 uuid)','anon can create isolated permanent child for ask_turn_audit');

select throws_ok('alter table db06_r2a_ddl_control.anon_ask_turn_audit add foreign key(k1) references public.ask_turn_audit(id)','42501','permission denied for table ask_turn_audit','anon REFERENCES denied on ask_turn_audit after successful CREATE');

select lives_ok('create table db06_r2a_ddl_control.anon_community_blocks(k1 uuid, k2 text)','anon can create isolated permanent child for community_blocks');

select throws_ok('alter table db06_r2a_ddl_control.anon_community_blocks add foreign key(k1, k2) references public.community_blocks(user_id, blocked_handle)','42501','permission denied for table community_blocks','anon REFERENCES denied on community_blocks after successful CREATE');

select lives_ok('create table db06_r2a_ddl_control.anon_community_moderation_events(k1 uuid)','anon can create isolated permanent child for community_moderation_events');

select throws_ok('alter table db06_r2a_ddl_control.anon_community_moderation_events add foreign key(k1) references public.community_moderation_events(id)','42501','permission denied for table community_moderation_events','anon REFERENCES denied on community_moderation_events after successful CREATE');

select lives_ok('create table db06_r2a_ddl_control.anon_community_notes(k1 uuid)','anon can create isolated permanent child for community_notes');

select throws_ok('alter table db06_r2a_ddl_control.anon_community_notes add foreign key(k1) references public.community_notes(id)','42501','permission denied for table community_notes','anon REFERENCES denied on community_notes after successful CREATE');

select lives_ok('create table db06_r2a_ddl_control.anon_community_questions(k1 uuid)','anon can create isolated permanent child for community_questions');

select throws_ok('alter table db06_r2a_ddl_control.anon_community_questions add foreign key(k1) references public.community_questions(id)','42501','permission denied for table community_questions','anon REFERENCES denied on community_questions after successful CREATE');

select lives_ok('create table db06_r2a_ddl_control.anon_community_reactions(k1 uuid)','anon can create isolated permanent child for community_reactions');

select throws_ok('alter table db06_r2a_ddl_control.anon_community_reactions add foreign key(k1) references public.community_reactions(id)','42501','permission denied for table community_reactions','anon REFERENCES denied on community_reactions after successful CREATE');

select lives_ok('create table db06_r2a_ddl_control.anon_community_reports(k1 uuid)','anon can create isolated permanent child for community_reports');

select throws_ok('alter table db06_r2a_ddl_control.anon_community_reports add foreign key(k1) references public.community_reports(id)','42501','permission denied for table community_reports','anon REFERENCES denied on community_reports after successful CREATE');

select lives_ok('create table db06_r2a_ddl_control.anon_community_topics(k1 uuid)','anon can create isolated permanent child for community_topics');

select throws_ok('alter table db06_r2a_ddl_control.anon_community_topics add foreign key(k1) references public.community_topics(id)','42501','permission denied for table community_topics','anon REFERENCES denied on community_topics after successful CREATE');

select lives_ok('create table db06_r2a_ddl_control.anon_consents(k1 uuid)','anon can create isolated permanent child for consents');

select throws_ok('alter table db06_r2a_ddl_control.anon_consents add foreign key(k1) references public.consents(id)','42501','permission denied for table consents','anon REFERENCES denied on consents after successful CREATE');

select lives_ok('create table db06_r2a_ddl_control.anon_cycle_nights(k1 uuid, k2 integer)','anon can create isolated permanent child for cycle_nights');

select throws_ok('alter table db06_r2a_ddl_control.anon_cycle_nights add foreign key(k1, k2) references public.cycle_nights(cycle_id, night_index)','42501','permission denied for table cycle_nights','anon REFERENCES denied on cycle_nights after successful CREATE');

select lives_ok('create table db06_r2a_ddl_control.anon_cycles(k1 uuid)','anon can create isolated permanent child for cycles');

select throws_ok('alter table db06_r2a_ddl_control.anon_cycles add foreign key(k1) references public.cycles(id)','42501','permission denied for table cycles','anon REFERENCES denied on cycles after successful CREATE');

select lives_ok('create table db06_r2a_ddl_control.anon_entitlements(k1 uuid)','anon can create isolated permanent child for entitlements');

select throws_ok('alter table db06_r2a_ddl_control.anon_entitlements add foreign key(k1) references public.entitlements(user_id)','42501','permission denied for table entitlements','anon REFERENCES denied on entitlements after successful CREATE');

select lives_ok('create table db06_r2a_ddl_control.anon_growth_events(k1 uuid)','anon can create isolated permanent child for growth_events');

select throws_ok('alter table db06_r2a_ddl_control.anon_growth_events add foreign key(k1) references public.growth_events(id)','42501','permission denied for table growth_events','anon REFERENCES denied on growth_events after successful CREATE');

select lives_ok('create table db06_r2a_ddl_control.anon_notification_log(k1 uuid)','anon can create isolated permanent child for notification_log');

select throws_ok('alter table db06_r2a_ddl_control.anon_notification_log add foreign key(k1) references public.notification_log(id)','42501','permission denied for table notification_log','anon REFERENCES denied on notification_log after successful CREATE');

select lives_ok('create table db06_r2a_ddl_control.anon_notification_preferences(k1 uuid)','anon can create isolated permanent child for notification_preferences');

select throws_ok('alter table db06_r2a_ddl_control.anon_notification_preferences add foreign key(k1) references public.notification_preferences(user_id)','42501','permission denied for table notification_preferences','anon REFERENCES denied on notification_preferences after successful CREATE');

select lives_ok('create table db06_r2a_ddl_control.anon_photo_trend(k1 uuid)','anon can create isolated permanent child for photo_trend');

select throws_ok('alter table db06_r2a_ddl_control.anon_photo_trend add foreign key(k1) references public.photo_trend(id)','42501','permission denied for table photo_trend','anon REFERENCES denied on photo_trend after successful CREATE');

select lives_ok('create table db06_r2a_ddl_control.anon_photos(k1 uuid)','anon can create isolated permanent child for photos');

select throws_ok('alter table db06_r2a_ddl_control.anon_photos add foreign key(k1) references public.photos(id)','42501','permission denied for table photos','anon REFERENCES denied on photos after successful CREATE');

select lives_ok('create table db06_r2a_ddl_control.anon_reverse_trial_grants(k1 uuid)','anon can create isolated permanent child for reverse_trial_grants');

select throws_ok('alter table db06_r2a_ddl_control.anon_reverse_trial_grants add foreign key(k1) references public.reverse_trial_grants(user_id)','42501','permission denied for table reverse_trial_grants','anon REFERENCES denied on reverse_trial_grants after successful CREATE');

select lives_ok('create table db06_r2a_ddl_control.anon_routine_conflicts(k1 uuid)','anon can create isolated permanent child for routine_conflicts');

select throws_ok('alter table db06_r2a_ddl_control.anon_routine_conflicts add foreign key(k1) references public.routine_conflicts(id)','42501','permission denied for table routine_conflicts','anon REFERENCES denied on routine_conflicts after successful CREATE');

select lives_ok('create table db06_r2a_ddl_control.anon_skin_profiles(k1 uuid)','anon can create isolated permanent child for skin_profiles');

select throws_ok('alter table db06_r2a_ddl_control.anon_skin_profiles add foreign key(k1) references public.skin_profiles(id)','42501','permission denied for table skin_profiles','anon REFERENCES denied on skin_profiles after successful CREATE');

select lives_ok('create table db06_r2a_ddl_control.anon_subscriptions_events(k1 uuid)','anon can create isolated permanent child for subscriptions_events');

select throws_ok('alter table db06_r2a_ddl_control.anon_subscriptions_events add foreign key(k1) references public.subscriptions_events(id)','42501','permission denied for table subscriptions_events','anon REFERENCES denied on subscriptions_events after successful CREATE');

select lives_ok('create table db06_r2a_ddl_control.anon_waitlist_signups(k1 uuid)','anon can create isolated permanent child for waitlist_signups');

select throws_ok('alter table db06_r2a_ddl_control.anon_waitlist_signups add foreign key(k1) references public.waitlist_signups(id)','42501','permission denied for table waitlist_signups','anon REFERENCES denied on waitlist_signups after successful CREATE');

reset role;

set local role authenticated;

select lives_ok('create table db06_r2a_ddl_control.authenticated_positive(id bigint references db06_r2a_ddl_control.allowed_parent(id))','authenticated has usable permanent-schema CREATE and valid FK DDL control');

select lives_ok('create table db06_r2a_ddl_control.authenticated_account_deletion_click_tombstones(k1 text)','authenticated can create isolated permanent child for account_deletion_click_tombstones');

select throws_ok('alter table db06_r2a_ddl_control.authenticated_account_deletion_click_tombstones add foreign key(k1) references public.account_deletion_click_tombstones(click_token_hash)','42501','permission denied for table account_deletion_click_tombstones','authenticated REFERENCES denied on account_deletion_click_tombstones after successful CREATE');

select lives_ok('create table db06_r2a_ddl_control.authenticated_account_deletion_requests(k1 uuid)','authenticated can create isolated permanent child for account_deletion_requests');

select throws_ok('alter table db06_r2a_ddl_control.authenticated_account_deletion_requests add foreign key(k1) references public.account_deletion_requests(request_id)','42501','permission denied for table account_deletion_requests','authenticated REFERENCES denied on account_deletion_requests after successful CREATE');

select lives_ok('create table db06_r2a_ddl_control.authenticated_active_ramp(k1 uuid)','authenticated can create isolated permanent child for active_ramp');

select throws_ok('alter table db06_r2a_ddl_control.authenticated_active_ramp add foreign key(k1) references public.active_ramp(id)','42501','permission denied for table active_ramp','authenticated REFERENCES denied on active_ramp after successful CREATE');

select lives_ok('create table db06_r2a_ddl_control.authenticated_ask_safety_audit(k1 uuid)','authenticated can create isolated permanent child for ask_safety_audit');

select throws_ok('alter table db06_r2a_ddl_control.authenticated_ask_safety_audit add foreign key(k1) references public.ask_safety_audit(id)','42501','permission denied for table ask_safety_audit','authenticated REFERENCES denied on ask_safety_audit after successful CREATE');

select lives_ok('create table db06_r2a_ddl_control.authenticated_ask_sessions(k1 uuid)','authenticated can create isolated permanent child for ask_sessions');

select throws_ok('alter table db06_r2a_ddl_control.authenticated_ask_sessions add foreign key(k1) references public.ask_sessions(id)','42501','permission denied for table ask_sessions','authenticated REFERENCES denied on ask_sessions after successful CREATE');

select lives_ok('create table db06_r2a_ddl_control.authenticated_ask_turn_audit(k1 uuid)','authenticated can create isolated permanent child for ask_turn_audit');

select throws_ok('alter table db06_r2a_ddl_control.authenticated_ask_turn_audit add foreign key(k1) references public.ask_turn_audit(id)','42501','permission denied for table ask_turn_audit','authenticated REFERENCES denied on ask_turn_audit after successful CREATE');

select lives_ok('create table db06_r2a_ddl_control.authenticated_community_blocks(k1 uuid, k2 text)','authenticated can create isolated permanent child for community_blocks');

select throws_ok('alter table db06_r2a_ddl_control.authenticated_community_blocks add foreign key(k1, k2) references public.community_blocks(user_id, blocked_handle)','42501','permission denied for table community_blocks','authenticated REFERENCES denied on community_blocks after successful CREATE');

select lives_ok('create table db06_r2a_ddl_control.authenticated_community_moderation_events(k1 uuid)','authenticated can create isolated permanent child for community_moderation_events');

select throws_ok('alter table db06_r2a_ddl_control.authenticated_community_moderation_events add foreign key(k1) references public.community_moderation_events(id)','42501','permission denied for table community_moderation_events','authenticated REFERENCES denied on community_moderation_events after successful CREATE');

select lives_ok('create table db06_r2a_ddl_control.authenticated_community_notes(k1 uuid)','authenticated can create isolated permanent child for community_notes');

select throws_ok('alter table db06_r2a_ddl_control.authenticated_community_notes add foreign key(k1) references public.community_notes(id)','42501','permission denied for table community_notes','authenticated REFERENCES denied on community_notes after successful CREATE');

select lives_ok('create table db06_r2a_ddl_control.authenticated_community_questions(k1 uuid)','authenticated can create isolated permanent child for community_questions');

select throws_ok('alter table db06_r2a_ddl_control.authenticated_community_questions add foreign key(k1) references public.community_questions(id)','42501','permission denied for table community_questions','authenticated REFERENCES denied on community_questions after successful CREATE');

select lives_ok('create table db06_r2a_ddl_control.authenticated_community_reactions(k1 uuid)','authenticated can create isolated permanent child for community_reactions');

select throws_ok('alter table db06_r2a_ddl_control.authenticated_community_reactions add foreign key(k1) references public.community_reactions(id)','42501','permission denied for table community_reactions','authenticated REFERENCES denied on community_reactions after successful CREATE');

select lives_ok('create table db06_r2a_ddl_control.authenticated_community_reports(k1 uuid)','authenticated can create isolated permanent child for community_reports');

select throws_ok('alter table db06_r2a_ddl_control.authenticated_community_reports add foreign key(k1) references public.community_reports(id)','42501','permission denied for table community_reports','authenticated REFERENCES denied on community_reports after successful CREATE');

select lives_ok('create table db06_r2a_ddl_control.authenticated_community_topics(k1 uuid)','authenticated can create isolated permanent child for community_topics');

select throws_ok('alter table db06_r2a_ddl_control.authenticated_community_topics add foreign key(k1) references public.community_topics(id)','42501','permission denied for table community_topics','authenticated REFERENCES denied on community_topics after successful CREATE');

select lives_ok('create table db06_r2a_ddl_control.authenticated_consents(k1 uuid)','authenticated can create isolated permanent child for consents');

select throws_ok('alter table db06_r2a_ddl_control.authenticated_consents add foreign key(k1) references public.consents(id)','42501','permission denied for table consents','authenticated REFERENCES denied on consents after successful CREATE');

select lives_ok('create table db06_r2a_ddl_control.authenticated_cycle_nights(k1 uuid, k2 integer)','authenticated can create isolated permanent child for cycle_nights');

select throws_ok('alter table db06_r2a_ddl_control.authenticated_cycle_nights add foreign key(k1, k2) references public.cycle_nights(cycle_id, night_index)','42501','permission denied for table cycle_nights','authenticated REFERENCES denied on cycle_nights after successful CREATE');

select lives_ok('create table db06_r2a_ddl_control.authenticated_cycles(k1 uuid)','authenticated can create isolated permanent child for cycles');

select throws_ok('alter table db06_r2a_ddl_control.authenticated_cycles add foreign key(k1) references public.cycles(id)','42501','permission denied for table cycles','authenticated REFERENCES denied on cycles after successful CREATE');

select lives_ok('create table db06_r2a_ddl_control.authenticated_entitlements(k1 uuid)','authenticated can create isolated permanent child for entitlements');

select throws_ok('alter table db06_r2a_ddl_control.authenticated_entitlements add foreign key(k1) references public.entitlements(user_id)','42501','permission denied for table entitlements','authenticated REFERENCES denied on entitlements after successful CREATE');

select lives_ok('create table db06_r2a_ddl_control.authenticated_growth_events(k1 uuid)','authenticated can create isolated permanent child for growth_events');

select throws_ok('alter table db06_r2a_ddl_control.authenticated_growth_events add foreign key(k1) references public.growth_events(id)','42501','permission denied for table growth_events','authenticated REFERENCES denied on growth_events after successful CREATE');

select lives_ok('create table db06_r2a_ddl_control.authenticated_notification_log(k1 uuid)','authenticated can create isolated permanent child for notification_log');

select throws_ok('alter table db06_r2a_ddl_control.authenticated_notification_log add foreign key(k1) references public.notification_log(id)','42501','permission denied for table notification_log','authenticated REFERENCES denied on notification_log after successful CREATE');

select lives_ok('create table db06_r2a_ddl_control.authenticated_notification_preferences(k1 uuid)','authenticated can create isolated permanent child for notification_preferences');

select throws_ok('alter table db06_r2a_ddl_control.authenticated_notification_preferences add foreign key(k1) references public.notification_preferences(user_id)','42501','permission denied for table notification_preferences','authenticated REFERENCES denied on notification_preferences after successful CREATE');

select lives_ok('create table db06_r2a_ddl_control.authenticated_photo_trend(k1 uuid)','authenticated can create isolated permanent child for photo_trend');

select throws_ok('alter table db06_r2a_ddl_control.authenticated_photo_trend add foreign key(k1) references public.photo_trend(id)','42501','permission denied for table photo_trend','authenticated REFERENCES denied on photo_trend after successful CREATE');

select lives_ok('create table db06_r2a_ddl_control.authenticated_photos(k1 uuid)','authenticated can create isolated permanent child for photos');

select throws_ok('alter table db06_r2a_ddl_control.authenticated_photos add foreign key(k1) references public.photos(id)','42501','permission denied for table photos','authenticated REFERENCES denied on photos after successful CREATE');

select lives_ok('create table db06_r2a_ddl_control.authenticated_reverse_trial_grants(k1 uuid)','authenticated can create isolated permanent child for reverse_trial_grants');

select throws_ok('alter table db06_r2a_ddl_control.authenticated_reverse_trial_grants add foreign key(k1) references public.reverse_trial_grants(user_id)','42501','permission denied for table reverse_trial_grants','authenticated REFERENCES denied on reverse_trial_grants after successful CREATE');

select lives_ok('create table db06_r2a_ddl_control.authenticated_routine_conflicts(k1 uuid)','authenticated can create isolated permanent child for routine_conflicts');

select throws_ok('alter table db06_r2a_ddl_control.authenticated_routine_conflicts add foreign key(k1) references public.routine_conflicts(id)','42501','permission denied for table routine_conflicts','authenticated REFERENCES denied on routine_conflicts after successful CREATE');

select lives_ok('create table db06_r2a_ddl_control.authenticated_skin_profiles(k1 uuid)','authenticated can create isolated permanent child for skin_profiles');

select throws_ok('alter table db06_r2a_ddl_control.authenticated_skin_profiles add foreign key(k1) references public.skin_profiles(id)','42501','permission denied for table skin_profiles','authenticated REFERENCES denied on skin_profiles after successful CREATE');

select lives_ok('create table db06_r2a_ddl_control.authenticated_subscriptions_events(k1 uuid)','authenticated can create isolated permanent child for subscriptions_events');

select throws_ok('alter table db06_r2a_ddl_control.authenticated_subscriptions_events add foreign key(k1) references public.subscriptions_events(id)','42501','permission denied for table subscriptions_events','authenticated REFERENCES denied on subscriptions_events after successful CREATE');

select lives_ok('create table db06_r2a_ddl_control.authenticated_waitlist_signups(k1 uuid)','authenticated can create isolated permanent child for waitlist_signups');

select throws_ok('alter table db06_r2a_ddl_control.authenticated_waitlist_signups add foreign key(k1) references public.waitlist_signups(id)','42501','permission denied for table waitlist_signups','authenticated REFERENCES denied on waitlist_signups after successful CREATE');

reset role;

create table public.db06_r2a_future_table_probe(id bigint primary key);

select is(pg_get_userbyid((select relowner from pg_class where oid='public.db06_r2a_future_table_probe'::regclass)),'postgres','future probe is actually created by postgres');

select is(has_table_privilege(r,'public.db06_r2a_future_table_probe',p),(r='service_role' or p in ('SELECT','INSERT','UPDATE','DELETE')),format('future postgres public table: %s %s exact expected default',r,p)) from unnest(array['anon','authenticated','service_role']) r cross join unnest(array['SELECT','INSERT','UPDATE','DELETE','TRUNCATE','REFERENCES','TRIGGER']) p order by r,p;

select * from finish();
rollback;
