-- Durable account-deletion scheduler provisioning for hosted Supabase.
--
-- This file intentionally contains no credential values. Before executing it,
-- create exactly one Vault secret for each name below through the private
-- Supabase Vault UI (or another approved, non-source-controlled operator path):
--
--   account_deletion_project_url
--     Exact hosted project origin, for example https://<project-ref>.supabase.co
--   account_deletion_worker_secret
--     The same exact 64-lowercase-hex value configured in the Edge secret
--     ACCOUNT_DELETION_WORKER_SECRET
--
-- Run as the project postgres owner only after migrations 0048-0051 and the
-- matching account-deletion function are deployed and the live negative auth
-- probe passes. The transaction fails before replacing the job when either
-- Vault value is absent or malformed.

begin;

create extension if not exists pg_cron;
create extension if not exists pg_net;
create extension if not exists supabase_vault cascade;

do $validate_account_deletion_work_lane$
declare
  v_project_url text;
  v_worker_secret text;
  v_project_url_count integer;
  v_worker_secret_count integer;
begin
  select count(*), min(decrypted_secret)
    into v_project_url_count, v_project_url
    from vault.decrypted_secrets
   where name = 'account_deletion_project_url';

  select count(*), min(decrypted_secret)
    into v_worker_secret_count, v_worker_secret
    from vault.decrypted_secrets
   where name = 'account_deletion_worker_secret';

  if v_project_url_count <> 1
     or v_project_url is null
     or v_project_url !~ '^https://[a-z0-9]{20}\.supabase\.co$' then
    raise exception 'ACCOUNT_DELETION_CRON_PROJECT_URL_INVALID';
  end if;

  if v_worker_secret_count <> 1
     or v_worker_secret is null
     or v_worker_secret !~ '^[a-f0-9]{64}$' then
    raise exception 'ACCOUNT_DELETION_CRON_WORKER_SECRET_INVALID';
  end if;
end;
$validate_account_deletion_work_lane$;

do $replace_account_deletion_work_lane$
declare
  v_job_id bigint;
begin
  for v_job_id in
    select jobid
      from cron.job
     where jobname = 'account-deletion-work-lane'
  loop
    perform cron.unschedule(v_job_id);
  end loop;
end;
$replace_account_deletion_work_lane$;

select cron.schedule(
  'account-deletion-work-lane',
  '*/2 * * * *',
  $account_deletion_cron$
    select net.http_post(
      url := (
        select decrypted_secret
          from vault.decrypted_secrets
         where name = 'account_deletion_project_url'
      ) || '/functions/v1/account-deletion',
      headers := jsonb_build_object(
        'Content-Type', 'application/json',
        'x-account-deletion-worker-secret', (
          select decrypted_secret
            from vault.decrypted_secrets
           where name = 'account_deletion_worker_secret'
        )
      ),
      body := '{"action":"work"}'::jsonb,
      timeout_milliseconds := 110000
    ) as request_id;
  $account_deletion_cron$
);

commit;
