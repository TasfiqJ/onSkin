#!/usr/bin/env node
import { createClient } from '@supabase/supabase-js';

import {
  block,
  envSnapshot,
  placeholderEnvValue,
  printResult,
  readScriptAppEnvironment,
  write,
} from './lib.mjs';

const errors = [];
const warnings = [];
const checks = [];
const observations = [];
const env = envSnapshot();

const runLive = env.PHASE9_RUN_LIVE_ORDER_REPORT_POLL === 'true';
const appEnv = readScriptAppEnvironment();
const supabaseUrl = env.SUPABASE_URL ?? env.EXPO_PUBLIC_SUPABASE_URL;
const publishableKey =
  env.SUPABASE_PUBLISHABLE_KEY ?? env.EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY ?? env.SUPABASE_ANON_KEY;
const secretKey = env.SUPABASE_SECRET_KEY ?? env.SUPABASE_SERVICE_ROLE_KEY;
const COMMERCE_ADMISSION_CLOSED = 'COM-01A: commerce admission closed';

const artifact = {
  status: runLive ? 'running' : 'not-run',
  appEnvironment: appEnv,
  supabaseHost: safeHost(supabaseUrl),
  commerceAdmission: COMMERCE_ADMISSION_CLOSED,
  checks,
  observations,
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
    'docs/phase-9/generated/live-order-report-poll.json',
    `${JSON.stringify(artifact, null, 2)}\n`,
  );
  write(
    'docs/phase-9/generated/live-order-report-poll.md',
    [
      '# Live order-report-poll evidence',
      '',
      `- Status: ${artifact.status}`,
      `- Environment: ${artifact.appEnvironment}`,
      `- Supabase host: ${artifact.supabaseHost ?? 'not configured'}`,
      `- Commerce admission: ${artifact.commerceAdmission}`,
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
      '## Observations',
      observations.length
        ? observations
            .map(
              (item) => `- ${item.name}: HTTP ${item.status}${item.code ? ` (${item.code})` : ''}`,
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

async function callPoll({ method = 'POST', headers = {} } = {}) {
  const response = await fetch(functionUrl('order-report-poll'), {
    method,
    headers: {
      apikey: publishableKey,
      'Content-Type': 'application/json',
      ...headers,
    },
    body: method === 'GET' || method === 'HEAD' ? undefined : JSON.stringify({ phase9: true }),
  });
  const text = await response.text();
  const body = parseJson(text);
  return { status: response.status, text, body };
}

function parseJson(text) {
  try {
    return JSON.parse(text);
  } catch {
    return null;
  }
}

function assertStatus(actual, expected, label, text) {
  assert(
    actual === expected,
    `${label}: expected HTTP ${expected}, got ${actual}${text ? ` (${text.slice(0, 120)})` : ''}.`,
  );
}

function responseCode(response) {
  if (typeof response.body?.error === 'string') return response.body.error;
  if (typeof response.body?.skipped === 'string') return 'skipped';
  return '';
}

function observe(name, response) {
  observations.push({ name, status: response.status, code: responseCode(response) });
}

function assertClosedResponse(response, label) {
  observe(label, response);
  assertStatus(response.status, 200, label, response.text);
  assert(
    response.body !== null &&
      !Array.isArray(response.body) &&
      Object.keys(response.body).sort().join(',') === 'ok,skipped' &&
      response.body.ok === true &&
      response.body.skipped === COMMERCE_ADMISSION_CLOSED,
    `${label}: expected exact COM-01A inert response; got ${response.text.slice(0, 160)}.`,
  );
}

async function orderAttributionCount(admin) {
  const { count, error } = await admin
    .from('order_attributions')
    .select('id', { count: 'exact', head: true });
  if (error) throw error;
  return count ?? 0;
}

async function assertNoAttributionDelta(admin, before, label) {
  const after = await orderAttributionCount(admin);
  assert(
    after === before,
    `${label}: order_attributions count changed from ${before} to ${after}.`,
  );
}

async function main() {
  if (!runLive) {
    warnings.push(
      'Live order-report-poll harness not run; set PHASE9_RUN_LIVE_ORDER_REPORT_POLL=true with staging credentials.',
    );
    writeArtifacts('not-run');
    printResult('Phase 9 live order-report-poll', errors, warnings);
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
    appEnv !== 'production' || env.PHASE9_ALLOW_PRODUCTION_LIVE_ORDER_REPORT_POLL === 'true',
    'Refusing production order-report-poll tests without PHASE9_ALLOW_PRODUCTION_LIVE_ORDER_REPORT_POLL=true.',
  );
  if (errors.length > 0) {
    writeArtifacts('fail');
    printResult('Phase 9 live order-report-poll', errors, warnings);
    return;
  }

  const admin = createClient(supabaseUrl, secretKey, {
    auth: { autoRefreshToken: false, persistSession: false, detectSessionInUrl: false },
  });
  const before = await orderAttributionCount(admin);
  await runCheck('order-report-poll rejects non-POST before COM-01A inert response', async () => {
    const response = await callPoll({ method: 'GET' });
    observe('non-POST', response);
    assertStatus(response.status, 405, 'order-report-poll GET', response.text);
    assert(
      response.body !== null &&
        Object.keys(response.body).join(',') === 'error' &&
        response.body.error === 'method_not_allowed',
      `order-report-poll GET returned unexpected body: ${response.text.slice(0, 120)}.`,
    );
    await assertNoAttributionDelta(admin, before, 'non-POST');
  });

  await runCheck(
    'order-report-poll POST returns exact COM-01A inert response without credentials',
    async () => {
      const response = await callPoll();
      assertClosedResponse(response, 'credential-free POST');
      await assertNoAttributionDelta(admin, before, 'credential-free POST');
    },
  );

  await runCheck(
    'order-report-poll ignores fake provider and scheduler credentials under COM-01A',
    async () => {
      const response = await callPoll({
        headers: {
          Authorization: 'Bearer com-01a-must-remain-inert',
          'x-scheduler-secret': 'com-01a-must-remain-inert',
        },
      });
      assertClosedResponse(response, 'adversarial credential headers');
      await assertNoAttributionDelta(admin, before, 'adversarial credential headers');
    },
  );

  await runCheck('order-report-poll observations remain literal-zero commerce', async () => {
    assert(
      observations.filter((item) => item.name !== 'non-POST').every(
        (item) => item.status === 200 && item.code === 'skipped',
      ),
      'harness observed a POST response outside the exact COM-01A inert contract.',
    );
  });

  warnings.push(
    'Live evidence reaches the deployed Edge endpoint and compares attribution counts; it cannot directly capture provider egress. The source contract separately forbids provider code and credentials.',
  );

  writeArtifacts(errors.length > 0 ? 'fail' : 'pass');
  printResult('Phase 9 live order-report-poll', errors, warnings);
}

main().catch((error) => {
  errors.push(resultError(error));
  writeArtifacts('fail');
  printResult('Phase 9 live order-report-poll', errors, warnings);
});
