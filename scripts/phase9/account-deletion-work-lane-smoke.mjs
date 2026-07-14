#!/usr/bin/env node
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const root = resolve(import.meta.dirname, '../..');
const sql = readFileSync(resolve(root, 'supabase/ops/account-deletion-work-lane.sql'), 'utf8');
const config = readFileSync(resolve(root, 'supabase/config.toml'), 'utf8');
const handler = readFileSync(
  resolve(root, 'supabase/functions/account-deletion/durableDeletionHttpHandler.ts'),
  'utf8',
);
const entrypoint = readFileSync(
  resolve(root, 'supabase/functions/account-deletion/index.ts'),
  'utf8',
);
const manifest = JSON.parse(
  readFileSync(resolve(root, 'supabase/functions/manifest.json'), 'utf8'),
);

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

assert(
  /^begin;[\s\S]*commit;\s*$/m.test(sql),
  'Scheduler provisioning must be one explicit transaction.',
);
for (const extension of ['pg_cron', 'pg_net', 'supabase_vault']) {
  assert(
    new RegExp(`create extension if not exists ${extension}`).test(sql),
    `Scheduler provisioning must enable ${extension}.`,
  );
}
assert(
  sql.includes("where name = 'account_deletion_project_url'") &&
    sql.includes("where name = 'account_deletion_worker_secret'"),
  'Cron must resolve the project origin and dedicated worker capability from named Vault entries.',
);
assert(
  sql.includes('ACCOUNT_DELETION_CRON_PROJECT_URL_INVALID') &&
    sql.includes('ACCOUNT_DELETION_CRON_WORKER_SECRET_INVALID') &&
    sql.includes("v_project_url !~ '^https://[a-z0-9]{20}\\.supabase\\.co$'") &&
    sql.includes("v_worker_secret !~ '^[a-f0-9]{64}$'"),
  'Provisioning must fail closed on missing, duplicate, or malformed Vault values.',
);
assert(
  sql.indexOf('$validate_account_deletion_work_lane$') <
    sql.indexOf('$replace_account_deletion_work_lane$') &&
    sql.indexOf('cron.unschedule(v_job_id)') < sql.indexOf('cron.schedule('),
  'Provisioning must validate first, then replace the named job idempotently before scheduling it.',
);
assert(
  sql.includes("'account-deletion-work-lane'") && sql.includes("'* * * * *'"),
  'The durable worker must run every minute under the canonical job name.',
);
assert(
  sql.includes("'/functions/v1/account-deletion'") &&
    sql.includes("'x-account-deletion-worker-secret'") &&
    sql.includes(`body := '{"action":"work"}'::jsonb`) &&
    sql.includes('timeout_milliseconds := 30000'),
  'Cron must call the exact work action with the dedicated header and a timeout beyond the 20-second worker budget.',
);
assert(
  !/['"](?:Authorization|apikey)['"]/i.test(sql) &&
    !/(?:sb_secret_|service_role|Bearer\s+[A-Za-z0-9_-]+)/i.test(sql) &&
    !/\b[a-f0-9]{64}\b/i.test(sql) &&
    !/https:\/\/[a-z0-9]{20}\.supabase\.co/i.test(sql),
  'The stored Cron command must not carry a general API credential, worker-secret literal, or concrete project origin.',
);

const accountDeletionConfig = config.match(
  /\[functions\.account-deletion\]([\s\S]*?)(?=\n\[|$)/,
)?.[1];
assert(
  accountDeletionConfig && /verify_jwt\s*=\s*false/.test(accountDeletionConfig),
  'The custom worker capability cannot reach a gateway that requires a user JWT.',
);
assert(
  /if \(parsed\.action === ['"]work['"]\)/.test(handler) &&
    handler.includes('x-account-deletion-worker-secret') &&
    handler.includes('constantTimeEqual(supplied, dependencies.workerSecret)') &&
    handler.includes('await dependencies.runWorker()'),
  'The Edge handler must authenticate and execute the work lane before user authentication.',
);
assert(
  handler.includes('if (result.created)') &&
    handler.includes('scheduleAcceleration(dependencies, result.operationId, user.id)') &&
    handler.includes('dependencies.accelerate(operationId, userId)') &&
    !handler.includes('const work = dependencies.runWorker().then'),
  'Authenticated intake may accelerate only its newly created operation, never the global queue or an idempotent replay.',
);
assert(
  entrypoint.includes('EdgeRuntime?: { waitUntil?:') &&
    entrypoint.includes('The promise has already started') &&
    entrypoint.includes('Cron lane remains'),
  'The request accelerator must remain explicitly subordinate to durable Cron.',
);

const deletionManifest = manifest.functions?.['account-deletion'];
assert(
  deletionManifest?.verifyJwt === false &&
    deletionManifest?.access === 'mixed' &&
    deletionManifest?.auth?.includes('dedicated worker secret') &&
    deletionManifest?.requiredSecrets?.some(
      (group) =>
        Array.isArray(group) && group.length === 1 && group[0] === 'ACCOUNT_DELETION_WORKER_SECRET',
    ),
  'The manifest must declare the mixed boundary and dedicated worker secret.',
);

console.log('PASS account-deletion durable work lane');
