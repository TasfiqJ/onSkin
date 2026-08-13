#!/usr/bin/env node
import { createHmac, randomUUID } from 'node:crypto';
import { createClient } from '@supabase/supabase-js';

import {
  block,
  envSnapshot,
  placeholderEnvValue,
  printResult,
  readScriptAppEnvironment,
  redactedErrorKind,
  write,
} from './lib.mjs';
import { cleanupLiveTestAccounts } from './live-account-cleanup.mjs';

const errors = [];
const warnings = [];
const checks = [];
const samples = [];
const env = envSnapshot();

const runLive = env.PHASE9_RUN_LIVE_CATALOG_RATE_LIMIT === 'true';
const appEnv = readScriptAppEnvironment();
const supabaseUrl = env.SUPABASE_URL ?? env.EXPO_PUBLIC_SUPABASE_URL;
const publishableKey =
  env.SUPABASE_PUBLISHABLE_KEY ?? env.EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY ?? env.SUPABASE_ANON_KEY;
const secretKey = env.SUPABASE_SECRET_KEY ?? env.SUPABASE_SERVICE_ROLE_KEY;
const catalogRateLimitMax = intEnv('CATALOG_RATE_LIMIT_MAX', 120, 1, 1000);
const probeBudget = intEnv(
  'PHASE9_CATALOG_RATE_LIMIT_PROBE_MAX',
  Math.min(catalogRateLimitMax + 2, 1002),
  2,
  1100,
);

const artifact = {
  status: runLive ? 'running' : 'not-run',
  appEnvironment: appEnv,
  supabaseHost: safeHost(supabaseUrl),
  catalogRateLimitMax,
  probeBudget,
  checks,
  samples,
  warnings,
  errors,
};

function safeHost(value) {
  if (!value) return null;
  try {
    return new URL(value).host;
  } catch {
    return 'invalid-url';
  }
}

const placeholder = placeholderEnvValue;

function intEnv(name, fallback, min, max) {
  const value = Number(env[name]);
  if (!Number.isInteger(value) || value < min || value > max) return fallback;
  return value;
}

function resultError(error) {
  return error instanceof Error ? error.message : String(error);
}

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

function record(name, status, detail = '') {
  checks.push({ name, status, detail });
}

function writeArtifacts(status) {
  artifact.status = status;
  if (status === 'pass' || status === 'fail') artifact.ranAt = new Date().toISOString();
  write(
    'docs/phase-9/generated/live-catalog-rate-limit.json',
    `${JSON.stringify(artifact, null, 2)}\n`,
  );
  write(
    'docs/phase-9/generated/live-catalog-rate-limit.md',
    [
      '# Live catalog rate-limit evidence',
      '',
      `- Status: ${artifact.status}`,
      `- Environment: ${artifact.appEnvironment}`,
      `- Supabase host: ${artifact.supabaseHost ?? 'not configured'}`,
      `- Configured max: ${artifact.catalogRateLimitMax}`,
      `- Probe budget: ${artifact.probeBudget}`,
      '',
      '## Checks',
      checks.length
        ? checks
            .map(
              (check) =>
                `- ${check.status.toUpperCase()}: ${check.name}${check.detail ? ` - ${check.detail}` : ''}`,
            )
            .join('\n')
        : '- Not run.',
      '',
      '## Redacted Rate-Limit Samples',
      samples.length
        ? samples
            .map(
              (sample) =>
                `- ${sample.scope}: count=${sample.requestCount}, window=${sample.windowSeconds}s, key=${sample.keyHashRedacted}`,
            )
            .join('\n')
        : '- None.',
      '',
      '## Warnings',
      warnings.length ? warnings.map((warning) => `- ${warning}`).join('\n') : '- None.',
      '',
      '## Errors',
      errors.length ? errors.map((error) => `- ${error}`).join('\n') : '- None.',
      '',
    ].join('\n'),
  );
}

async function runCheck(name, fn) {
  try {
    await fn();
    record(name, 'pass');
  } catch (error) {
    const message = resultError(error);
    record(name, 'fail', message);
    errors.push(`${name}: ${message}`);
  }
}

function functionUrl(name) {
  return `${supabaseUrl.replace(/\/+$/g, '')}/functions/v1/${name}`;
}

function publicClient() {
  return createClient(supabaseUrl, publishableKey, {
    auth: { autoRefreshToken: false, persistSession: false, detectSessionInUrl: false },
  });
}

async function createLiveUser(admin) {
  const suffix = `${Date.now()}-${randomUUID().slice(0, 8)}`;
  const email = `phase9-catalog-limit-${suffix}@example.invalid`;
  const password = `Phase9Catalog-${suffix}-Password!`;
  const { data, error } = await admin.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
    user_metadata: { phase9_live_catalog_rate_limit: true },
  });
  if (error) throw error;
  if (!data.user) throw new Error('Supabase did not return a catalog rate-limit harness user.');

  const client = publicClient();
  const signedIn = await client.auth.signInWithPassword({ email, password });
  if (signedIn.error) throw signedIn.error;
  const token = signedIn.data.session?.access_token;
  assert(token, 'Supabase did not return a session access token.');
  return { id: data.user.id, client, token };
}

async function postFunction(functionName, token, body) {
  const response = await fetch(functionUrl(functionName), {
    method: 'POST',
    headers: {
      apikey: publishableKey,
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(body),
  });
  return {
    status: response.status,
    retryAfter: response.headers.get('retry-after'),
    text: await response.text(),
  };
}

function parseJson(text) {
  try {
    return JSON.parse(text);
  } catch {
    return null;
  }
}

function assertRateLimited(response, label) {
  const body = parseJson(response.text);
  assert(
    response.status === 429,
    `${label}: expected HTTP 429, got ${response.status} (${response.text.slice(0, 120)}).`,
  );
  assert(
    body?.error === 'rate_limited',
    `${label}: expected rate_limited body, got ${response.text.slice(0, 120)}.`,
  );
  assert(/^\d+$/.test(response.retryAfter ?? ''), `${label}: expected numeric Retry-After header.`);
}

async function exhaustCatalogScope({ functionName, label, token, body, allowedResponse }) {
  for (let attempt = 1; attempt <= probeBudget; attempt += 1) {
    const response = await postFunction(functionName, token, body);
    if (response.status === 429) {
      assertRateLimited(response, label);
      return { attempts: attempt, retryAfter: response.retryAfter };
    }
    allowedResponse(response, attempt);
  }
  throw new Error(
    `${label}: did not return 429 within ${probeBudget} attempts; check deployed CATALOG_RATE_LIMIT_MAX.`,
  );
}

function keyHashFor(scope, userId) {
  return createHmac('sha256', secretKey).update(`${scope}|${userId}`).digest('hex');
}

async function assertLimiterRow(admin, scope, userId, attempts) {
  const keyHash = keyHashFor(scope, userId);
  const { data, error } = await admin
    .from('edge_rate_limits')
    .select('scope,key_hash,window_seconds,request_count,updated_at')
    .eq('scope', scope)
    .eq('key_hash', keyHash)
    .order('updated_at', { ascending: false })
    .limit(1);
  if (error) throw error;
  const row = data?.[0];
  assert(row, `${scope}: expected an edge_rate_limits row for the synthetic user.`);
  assert(
    /^[a-f0-9]{64}$/.test(row.key_hash),
    `${scope}: key_hash is not a 64-character lowercase hex digest.`,
  );
  assert(
    !JSON.stringify(row).includes(userId),
    `${scope}: edge_rate_limits row contains the raw user id.`,
  );
  assert(
    row.request_count >= attempts,
    `${scope}: request_count ${row.request_count} is lower than probe attempts ${attempts}.`,
  );
  assert(row.window_seconds >= 60, `${scope}: window_seconds must be at least 60.`);
  samples.push({
    scope,
    keyHashRedacted: `${row.key_hash.slice(0, 8)}...${row.key_hash.slice(-4)}`,
    keyHashLength: row.key_hash.length,
    requestCount: row.request_count,
    windowSeconds: row.window_seconds,
  });
}

async function countRows(admin, table, column, value) {
  const { data, error } = await admin.from(table).select('id').eq(column, value);
  if (error) throw error;
  return (data ?? []).length;
}

async function main() {
  if (!runLive) {
    warnings.push(
      'Live catalog rate-limit harness not run; set PHASE9_RUN_LIVE_CATALOG_RATE_LIMIT=true with staging credentials.',
    );
    writeArtifacts('not-run');
    printResult('Phase 9 live catalog rate limit', errors, warnings);
    return;
  }

  block(
    errors,
    !placeholder(supabaseUrl),
    'SUPABASE_URL or EXPO_PUBLIC_SUPABASE_URL is missing or placeholder.',
  );
  block(
    errors,
    !placeholder(publishableKey),
    'SUPABASE_PUBLISHABLE_KEY or EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY is missing or placeholder.',
  );
  block(
    errors,
    !placeholder(secretKey),
    'SUPABASE_SECRET_KEY or SUPABASE_SERVICE_ROLE_KEY is missing or placeholder.',
  );
  block(
    errors,
    probeBudget > catalogRateLimitMax,
    'PHASE9_CATALOG_RATE_LIMIT_PROBE_MAX must be greater than CATALOG_RATE_LIMIT_MAX.',
  );
  block(
    errors,
    appEnv !== 'production' || env.PHASE9_ALLOW_PRODUCTION_LIVE_CATALOG_RATE_LIMIT === 'true',
    'Refusing production catalog rate-limit tests without PHASE9_ALLOW_PRODUCTION_LIVE_CATALOG_RATE_LIMIT=true.',
  );
  if (errors.length > 0) {
    writeArtifacts('fail');
    printResult('Phase 9 live catalog rate limit', errors, warnings);
    return;
  }

  const admin = createClient(supabaseUrl, secretKey, {
    auth: { autoRefreshToken: false, persistSession: false, detectSessionInUrl: false },
  });
  let user = null;

  try {
    user = await createLiveUser(admin);

    await runCheck('catalog-search returns 429 after configured user rate limit', async () => {
      const result = await exhaustCatalogScope({
        functionName: 'catalog-search',
        label: 'catalog-search',
        token: user.token,
        body: { query: 'x', limit: 10 },
        allowedResponse: (response) => {
          const parsed = parseJson(response.text);
          assert(
            response.status === 200,
            `catalog-search before limit expected 200, got ${response.status}.`,
          );
          assert(
            parsed?.result === 'too_short',
            `catalog-search before limit expected too_short, got ${response.text.slice(0, 120)}.`,
          );
        },
      });
      await assertLimiterRow(admin, 'catalog-search', user.id, result.attempts);
    });

    await runCheck('catalog-lookup returns 429 after configured user rate limit', async () => {
      const result = await exhaustCatalogScope({
        functionName: 'catalog-lookup',
        label: 'catalog-lookup',
        token: user.token,
        body: { barcode: '123' },
        allowedResponse: (response) => {
          const parsed = parseJson(response.text);
          assert(
            response.status === 400,
            `catalog-lookup before limit expected 400, got ${response.status}.`,
          );
          assert(
            parsed?.error === 'invalid_barcode',
            `catalog-lookup before limit expected invalid_barcode, got ${response.text.slice(0, 120)}.`,
          );
        },
      });
      await assertLimiterRow(admin, 'catalog-lookup', user.id, result.attempts);
    });

    await runCheck('catalog rate-limit probes avoid catalog telemetry writes', async () => {
      const count = await countRows(admin, 'catalog_lookup_events', 'user_id', user.id);
      assert(count === 0, `expected no catalog_lookup_events from safe probes, found ${count}.`);
    });

    await runCheck('edge_rate_limits stores keyed hashes only for catalog scopes', async () => {
      assert(
        samples.length === 2,
        `expected two redacted limiter samples, found ${samples.length}.`,
      );
      for (const sample of samples) {
        assert(
          ['catalog-search', 'catalog-lookup'].includes(sample.scope),
          `unexpected limiter scope ${sample.scope}.`,
        );
        assert(sample.keyHashLength === 64, `${sample.scope}: key hash length must be 64.`);
        assert(
          !sample.keyHashRedacted.includes(user.id),
          `${sample.scope}: redacted hash includes raw user id.`,
        );
        assert(
          sample.requestCount >= catalogRateLimitMax + 1,
          `${sample.scope}: request count did not exceed configured max.`,
        );
      }
    });
  } finally {
    if (user?.id) {
      const { error: lookupCleanup } = await admin
        .from('catalog_lookup_events')
        .delete()
        .eq('user_id', user.id);
      if (lookupCleanup)
        warnings.push(`Catalog lookup cleanup warning: ${redactedErrorKind(lookupCleanup)}`);
      await cleanupLiveTestAccounts({
        admin,
        users: [user],
        errors,
        label: 'Catalog rate-limit user cleanup',
        errorKind: redactedErrorKind,
      });
    }
  }

  writeArtifacts(errors.length > 0 ? 'fail' : 'pass');
  printResult('Phase 9 live catalog rate limit', errors, warnings);
}

main().catch((error) => {
  errors.push(resultError(error));
  writeArtifacts('fail');
  printResult('Phase 9 live catalog rate limit', errors, warnings);
});
