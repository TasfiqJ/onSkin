#!/usr/bin/env node
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const root = resolve(import.meta.dirname, '../..');
const read = (path) => readFileSync(resolve(root, path), 'utf8');
const sql = read('supabase/ops/health-consent-work-lane.sql');
const config = read('supabase/config.toml');
const handler = read('supabase/functions/health-consent-worker/httpHandler.ts');
const entrypoint = read('supabase/functions/health-consent-worker/index.ts');
const core = read('supabase/functions/health-consent-worker/workerCore.ts');
const dependentCore = read(
  'supabase/functions/health-consent-worker/dependentWorkerCore.ts',
);
const combinedCore = read(
  'supabase/functions/health-consent-worker/combinedWorkerCore.ts',
);
const dependentCleanup = read(
  'supabase/functions/consent-withdrawal/dependentCleanupRuntime.ts',
);
const manifest = JSON.parse(read('supabase/functions/manifest.json'));

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

assert(
  /^begin;[\s\S]*commit;\s*$/m.test(sql),
  'Health scheduler provisioning must be one explicit transaction.',
);
for (const extension of ['pg_cron', 'pg_net', 'supabase_vault']) {
  assert(
    new RegExp(`create extension if not exists ${extension}`).test(sql),
    `Health scheduler provisioning must enable ${extension}.`,
  );
}
assert(
  sql.includes("where name = 'health_consent_project_url'") &&
    sql.includes("where name = 'health_consent_worker_secret'"),
  'Health Cron must resolve its exact origin and dedicated capability from named Vault entries.',
);
assert(
  sql.includes('HEALTH_CONSENT_CRON_PROJECT_URL_INVALID') &&
    sql.includes('HEALTH_CONSENT_CRON_WORKER_SECRET_INVALID') &&
    sql.includes("v_project_url !~ '^https://[a-z0-9]{20}\\.supabase\\.co$'") &&
    sql.includes("v_worker_secret !~ '^[a-f0-9]{64}$'"),
  'Health scheduler provisioning must reject missing, duplicate, or malformed Vault values.',
);
assert(
  sql.indexOf('$validate_health_consent_work_lane$') <
      sql.indexOf('$replace_health_consent_work_lane$') &&
    sql.indexOf('cron.unschedule(v_job_id)') < sql.indexOf('cron.schedule('),
  'Health scheduler provisioning must validate before idempotently replacing the job.',
);
assert(
  sql.includes("'health-consent-work-lane'") && sql.includes("'* * * * *'"),
  'Health withdrawal recovery must run every minute under the canonical job name.',
);
assert(
  sql.includes("'/functions/v1/health-consent-worker'") &&
    sql.includes("'x-health-consent-worker-secret'") &&
    sql.includes(`body := '{"action":"work"}'::jsonb`) &&
    sql.includes('timeout_milliseconds := 55000'),
  'Health Cron must send the exact work action/header with timeout beyond the Edge budget.',
);
assert(
  !/['"](?:Authorization|apikey)['"]/i.test(sql) &&
    !/(?:sb_secret_|service_role|Bearer\s+[A-Za-z0-9_-]+)/i.test(sql) &&
    !/\b[a-f0-9]{64}\b/i.test(sql) &&
    !/https:\/\/[a-z0-9]{20}\.supabase\.co/i.test(sql),
  'Health Cron source must contain no general API key, secret literal, or concrete project origin.',
);

const workerConfig = config.match(
  /\[functions\.health-consent-worker\]([\s\S]*?)(?=\n\[|$)/,
)?.[1];
assert(
  workerConfig && /verify_jwt\s*=\s*false/.test(workerConfig),
  'The custom scheduler capability cannot reach a gateway requiring a user JWT.',
);
assert(
  handler.includes('x-health-consent-worker-secret') &&
    handler.includes(
      'constantTimeEqual(supplied, dependencies.workerSecret)',
    ) &&
    handler.includes("(body as Record<string, unknown>).action !== 'work'") &&
    handler.includes('await dependencies.runWorker()'),
  'The worker handler must authenticate the dedicated secret and exact work action.',
);
for (
  const rpc of [
    'claim_due_health_consent_withdrawals',
    'prepare_health_data_consent_withdrawal',
    'list_health_consent_storage_work',
    'complete_health_data_consent_withdrawal',
    'defer_health_consent_withdrawal',
    'claim_due_health_dependent_consent_withdrawals',
    'list_health_dependent_consent_storage_work',
    'complete_health_dependent_consent_withdrawal',
    'defer_health_dependent_consent_withdrawal',
    'mark_health_dependent_consent_withdrawal_action_required',
  ]
) {
  assert(
    entrypoint.includes(rpc),
    `Health worker entrypoint is missing ${rpc}.`,
  );
}
assert(
  entrypoint.includes('runHealthDependentCleanup(admin, operation)') &&
    dependentCore.includes('!await prepareDependentPhotoStorage(') &&
    dependentCore.includes('DEPENDENT_PROVIDER_BOUND_EXCEEDED') &&
    dependentCore.includes('DEPENDENT_STORAGE_OWNERSHIP_INVALID') &&
    dependentCore.includes('DEPENDENT_STORAGE_BOUND_EXCEEDED') &&
    dependentCore.includes('actionRequiredAttestation') &&
    combinedCore.includes('Promise.allSettled') &&
    combinedCore.includes("failedLanes.push('base')") &&
    combinedCore.includes("failedLanes.push('dependent')") &&
    dependentCleanup.includes('runAskOnSkinCleanup') &&
    dependentCleanup.includes('runGranularPhotoCaptureCleanup'),
  'Scheduled recovery must independently claim dependent withdrawals, reuse bounded cleanup, durably mark provider bounds, and isolate lane failures.',
);
assert(
  entrypoint.includes("admin.storage.from('photos').remove(paths)") &&
    core.includes('healthPhotoPathSafeForWithdrawal') &&
    core.includes('HEALTH_WORKER_BUDGET_EXHAUSTED') &&
    core.includes('HEALTH_STORAGE_WORK_REMAINS'),
  'Health worker must attest current-epoch or canonical legacy paths and durably yield bounded unfinished work.',
);

const definition = manifest.functions?.['health-consent-worker'];
assert(
  definition?.verifyJwt === false &&
    definition?.access === 'scheduled' &&
    definition?.auth === 'scheduler-secret' &&
    definition?.public === false &&
    definition?.requiredSecrets?.some(
      (group) =>
        Array.isArray(group) && group.length === 1 &&
        group[0] === 'HEALTH_CONSENT_WORKER_SECRET',
    ),
  'Manifest must declare the private scheduled boundary and dedicated secret.',
);

console.log('PASS health-consent durable work lane');
