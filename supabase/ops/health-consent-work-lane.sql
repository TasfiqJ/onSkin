-- Durable health-consent withdrawal scheduler provisioning for hosted Supabase.
--
-- This file intentionally contains no credential values. Before executing it,
-- create exactly one Vault secret for each name through a private operator path:
--
--   health_consent_project_url
--     Exact hosted project origin, for example https://<project-ref>.supabase.co
--   health_consent_worker_secret
--     The same exact independent 64-lowercase-hex value configured in the Edge
--     secret HEALTH_CONSENT_WORKER_SECRET
--
-- Run as the project postgres owner only after migration 0054, the matching
-- health-consent-worker function, and its negative scheduler-auth probes pass.
-- The transaction validates Vault before replacing the existing Cron job.

begin;

create extension if not exists pg_cron;
create extension if not exists pg_net;
create extension if not exists supabase_vault cascade;

do $validate_health_consent_work_lane$
declare
  v_project_url text;
  v_worker_secret text;
  v_project_url_count integer;
  v_worker_secret_count integer;
begin
  select count(*), min(decrypted_secret)
    into v_project_url_count, v_project_url
    from vault.decrypted_secrets
   where name = 'health_consent_project_url';

  select count(*), min(decrypted_secret)
    into v_worker_secret_count, v_worker_secret
    from vault.decrypted_secrets
   where name = 'health_consent_worker_secret';

  if v_project_url_count <> 1
     or v_project_url is null
     or v_project_url !~ '^https://[a-z0-9]{20}\.supabase\.co$' then
    raise exception 'HEALTH_CONSENT_CRON_PROJECT_URL_INVALID';
  end if;

  if v_worker_secret_count <> 1
     or v_worker_secret is null
     or v_worker_secret !~ '^[a-f0-9]{64}$' then
    raise exception 'HEALTH_CONSENT_CRON_WORKER_SECRET_INVALID';
  end if;
end;
$validate_health_consent_work_lane$;

do $replace_health_consent_work_lane$
declare
  v_job_id bigint;
begin
  for v_job_id in
    select jobid
      from cron.job
     where jobname = 'health-consent-work-lane'
  loop
    perform cron.unschedule(v_job_id);
  end loop;
end;
$replace_health_consent_work_lane$;

select cron.schedule(
  'health-consent-work-lane',
  '* * * * *',
  $health_consent_cron$
    select net.http_post(
      url := (
        select decrypted_secret
          from vault.decrypted_secrets
         where name = 'health_consent_project_url'
      ) || '/functions/v1/health-consent-worker',
      headers := jsonb_build_object(
        'Content-Type', 'application/json',
        'x-health-consent-worker-secret', (
          select decrypted_secret
            from vault.decrypted_secrets
           where name = 'health_consent_worker_secret'
        )
      ),
      body := '{"action":"work"}'::jsonb,
      timeout_milliseconds := 55000
    ) as request_id;
  $health_consent_cron$
);

commit;
