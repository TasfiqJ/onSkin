-- Durable Sign in with Apple refresh-token validation scheduler for hosted
-- Supabase. This file contains no credential values.
--
-- Before executing it, create exactly one Vault secret for each name through a
-- private operator path:
--
--   apple_auth_project_url
--     Exact hosted project origin, for example https://<project-ref>.supabase.co
--   apple_auth_worker_secret
--     The same exact independent 64-lowercase-hex value configured in the Edge
--     secret APPLE_AUTH_WORKER_SECRET
--
-- Run as the project postgres owner only after migration 0055, all three Apple
-- lifecycle functions, and the worker's live negative-auth probes pass. The
-- transaction validates Vault before replacing the existing Cron job.

begin;

create extension if not exists pg_cron;
create extension if not exists pg_net;
create extension if not exists supabase_vault cascade;

do $validate_apple_auth_work_lane$
declare
  v_project_url text;
  v_worker_secret text;
  v_project_url_count integer;
  v_worker_secret_count integer;
begin
  select count(*), min(decrypted_secret)
    into v_project_url_count, v_project_url
    from vault.decrypted_secrets
   where name = 'apple_auth_project_url';

  select count(*), min(decrypted_secret)
    into v_worker_secret_count, v_worker_secret
    from vault.decrypted_secrets
   where name = 'apple_auth_worker_secret';

  if v_project_url_count <> 1
     or v_project_url is null
     or v_project_url !~ '^https://[a-z0-9]{20}\.supabase\.co$' then
    raise exception 'APPLE_AUTH_CRON_PROJECT_URL_INVALID';
  end if;

  if v_worker_secret_count <> 1
     or v_worker_secret is null
     or v_worker_secret !~ '^[a-f0-9]{64}$' then
    raise exception 'APPLE_AUTH_CRON_WORKER_SECRET_INVALID';
  end if;
end;
$validate_apple_auth_work_lane$;

do $replace_apple_auth_work_lane$
declare
  v_job_id bigint;
begin
  for v_job_id in
    select jobid
      from cron.job
     where jobname = 'apple-auth-work-lane'
  loop
    perform cron.unschedule(v_job_id);
  end loop;
end;
$replace_apple_auth_work_lane$;

select cron.schedule(
  'apple-auth-work-lane',
  '* * * * *',
  $apple_auth_cron$
    select net.http_post(
      url := (
        select decrypted_secret
          from vault.decrypted_secrets
         where name = 'apple_auth_project_url'
      ) || '/functions/v1/apple-auth-worker',
      headers := jsonb_build_object(
        'Content-Type', 'application/json',
        'x-apple-auth-worker-secret', (
          select decrypted_secret
            from vault.decrypted_secrets
           where name = 'apple_auth_worker_secret'
        )
      ),
      body := '{"action":"work"}'::jsonb,
      timeout_milliseconds := 55000
    ) as request_id;
  $apple_auth_cron$
);

commit;
