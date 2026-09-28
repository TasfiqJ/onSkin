#!/usr/bin/env node
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const root = resolve(import.meta.dirname, '../..');
const read = (path) => readFileSync(resolve(root, path), 'utf8');
const sql = read('supabase/ops/apple-auth-work-lane.sql');
const config = read('supabase/config.toml');
const handler = read('supabase/functions/apple-auth-worker/httpHandler.ts');
const entrypoint = read('supabase/functions/apple-auth-worker/index.ts');
const core = read('supabase/functions/apple-auth-worker/core.ts');
const manifest = JSON.parse(read('supabase/functions/manifest.json'));

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

assert(
  /^begin;[\s\S]*commit;\s*$/m.test(sql),
  'Apple scheduler provisioning must be one explicit transaction.',
);
for (const extension of ['pg_cron', 'pg_net', 'supabase_vault']) {
  assert(
    new RegExp(`create extension if not exists ${extension}`).test(sql),
    `Apple scheduler provisioning must enable ${extension}.`,
  );
}
assert(
  sql.includes("where name = 'apple_auth_project_url'") &&
    sql.includes("where name = 'apple_auth_worker_secret'"),
  'Cron must resolve the project origin and dedicated worker capability from named Vault entries.',
);
assert(
  sql.includes('APPLE_AUTH_CRON_PROJECT_URL_INVALID') &&
    sql.includes('APPLE_AUTH_CRON_WORKER_SECRET_INVALID') &&
    sql.includes("v_project_url !~ '^https://[a-z0-9]{20}\\.supabase\\.co$'") &&
    sql.includes("v_worker_secret !~ '^[a-f0-9]{64}$'"),
  'Provisioning must fail closed on missing, duplicate, or malformed Vault values.',
);
assert(
  sql.indexOf('$validate_apple_auth_work_lane$') < sql.indexOf('$replace_apple_auth_work_lane$') &&
    sql.indexOf('cron.unschedule(v_job_id)') < sql.indexOf('cron.schedule('),
  'Provisioning must validate first, then replace the named job idempotently.',
);
assert(
  sql.includes("'apple-auth-work-lane'") && sql.includes("'* * * * *'"),
  'Apple validation must run every minute under the canonical job name.',
);
assert(
  sql.includes("'/functions/v1/apple-auth-worker'") &&
    sql.includes("'x-apple-auth-worker-secret'") &&
    sql.includes(`body := '{"action":"work"}'::jsonb`) &&
    sql.includes('timeout_milliseconds := 55000'),
  'Cron must call the exact work action with the dedicated header inside the function budget.',
);
assert(
  !/['"](?:Authorization|apikey)['"]/i.test(sql) &&
    !/(?:sb_secret_|service_role|Bearer\s+[A-Za-z0-9_-]+)/i.test(sql) &&
    !/\b[a-f0-9]{64}\b/i.test(sql) &&
    !/https:\/\/[a-z0-9]{20}\.supabase\.co/i.test(sql),
  'Stored Cron must not carry a general API credential, capability literal, or concrete project origin.',
);

const workerConfig = config.match(/\[functions\.apple-auth-worker\]([\s\S]*?)(?=\n\[|$)/)?.[1];
assert(
  workerConfig && /verify_jwt\s*=\s*false/.test(workerConfig),
  'The dedicated scheduler capability cannot reach a gateway requiring a user JWT.',
);
assert(
  /request\.headers\.get\(["']x-apple-auth-worker-secret["']\)/.test(handler) &&
    handler.includes('constantTimeEqual(supplied, dependencies.workerSecret)') &&
    /\(body as Record<string, unknown>\)\.action !== ["']work["']/.test(handler) &&
    handler.includes('await dependencies.runWorker()'),
  'The handler must authenticate an exact secret and exact request before service work.',
);
assert(
  /intEnv\(["']APPLE_AUTH_WORKER_CLAIM_LIMIT["'], 25, 1, 25\)/.test(entrypoint) &&
    entrypoint.includes('Math.min(externalFetchTimeoutMs(), 5_000)') &&
    core.includes('APPLE_AUTH_WORKER_CONCURRENCY = 5'),
  'Worker claim, provider timeout, and concurrency budgets must remain source-bounded.',
);

const workerManifest = manifest.functions?.['apple-auth-worker'];
assert(
  workerManifest?.verifyJwt === false &&
    workerManifest?.access === 'scheduled' &&
    workerManifest?.requiredSecrets?.some(
      (group) =>
        Array.isArray(group) && group.length === 1 && group[0] === 'APPLE_AUTH_WORKER_SECRET',
    ),
  'Manifest must declare the private scheduled boundary and dedicated worker secret.',
);

console.log('PASS Apple auth durable work lane');
