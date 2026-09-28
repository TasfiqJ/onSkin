select
  count(*) filter (where jobname = 'account-deletion-work-lane')::integer
    as account_deletion_cron_jobs,
  count(*) filter (where jobname = 'health-consent-work-lane')::integer
    as health_consent_cron_jobs,
  count(*) filter (where jobname = 'apple-auth-work-lane')::integer
    as apple_auth_cron_jobs,
  count(*) filter (
    where jobname in (
      'account-deletion-work-lane',
      'health-consent-work-lane',
      'apple-auth-work-lane'
    )
  )::integer as relevant_cron_jobs,
  count(*)::integer as all_cron_jobs
from cron.job;
