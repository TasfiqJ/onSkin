#!/usr/bin/env node
import { randomBytes, randomUUID } from 'node:crypto';
import { createClient } from '@supabase/supabase-js';

import {
  authUserMissing,
  block,
  envSnapshot,
  HarnessAssertionError,
  harnessErrorDetail,
  placeholderEnvValue,
  printResult,
  readScriptAppEnvironment,
  redactedErrorKind,
  resolveHostedSupabaseProjectTarget,
  strict,
  write,
} from './lib.mjs';

const errors = [];
const warnings = [];
const checks = [];
const env = envSnapshot();

const runLive = env.PHASE9_RUN_LIVE_EDGE_AUTH === 'true';
const appEnv = readScriptAppEnvironment();
const supabaseUrl = env.SUPABASE_URL;
const supabaseTarget = resolveHostedSupabaseProjectTarget(
  supabaseUrl,
  env.PHASE9_EXPECTED_SUPABASE_PROJECT_REF,
);
const publishableKey =
  env.SUPABASE_PUBLISHABLE_KEY ?? env.EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY ?? env.SUPABASE_ANON_KEY;
const secretKey = env.SUPABASE_SECRET_KEY ?? env.SUPABASE_SERVICE_ROLE_KEY;
const userEdgeBodyMaxBytes = intEnv('USER_EDGE_BODY_MAX_BYTES', 16384, 1024, 65536);
const requestTimeoutSeconds = intEnv('PHASE9_EDGE_AUTH_REQUEST_TIMEOUT_SECONDS', 20, 1, 60);
const responseMaxBytes = intEnv('PHASE9_EDGE_AUTH_RESPONSE_MAX_BYTES', 16384, 1024, 65536);
const evidenceContext = readEvidenceContext();

const accountDeletionFunction = 'account-deletion';
const accountDeletionWorkerHeader = 'x-account-deletion-worker-secret';
const accountDeletionTokenPattern = /^[a-f0-9]{64}$/;
const healthConsentWorkerFunction = 'health-consent-worker';
const healthConsentWorkerHeader = 'x-health-consent-worker-secret';

const userJwtFunctions = [
  'data-export',
  'subscription-grants',
  'subscription-reconciliation',
  'catalog-search',
  'catalog-lookup',
  'catalog-report',
  'consent-withdrawal',
];
const methodRestrictedFunctions = [accountDeletionFunction, ...userJwtFunctions];
const bodyLimitedFunctions = [
  accountDeletionFunction,
  ...userJwtFunctions.filter((functionName) => functionName !== 'data-export'),
];
const bearerProtectedFunctions = [accountDeletionFunction, ...userJwtFunctions];

const artifact = {
  status: runLive ? 'running' : 'not-run',
  sourceSha: evidenceContext.sourceSha,
  workflowRunId: evidenceContext.workflowRunId,
  workflowRunAttempt: evidenceContext.workflowRunAttempt,
  ref: evidenceContext.ref,
  actor: evidenceContext.actor,
  triggeringActor: evidenceContext.triggeringActor,
  repository: evidenceContext.repository,
  workflow: evidenceContext.workflow,
  event: evidenceContext.event,
  buildIds: evidenceContext.buildIds,
  appEnvironment: appEnv,
  expectedSupabaseProjectRef: supabaseTarget.expectedProjectRef,
  actualSupabaseProjectRef: supabaseTarget.actualProjectRef,
  supabaseHost: supabaseTarget.safeHost,
  userEdgeBodyMaxBytes,
  requestTimeoutSeconds,
  responseMaxBytes,
  accountDeletionPreflight: 'authenticated-live-clear-missing-invalid-stale',
  accountDeletionPositiveLifecycle: 'delegated-to-phase9-live-data-rights',
  accountDeletionAuthorizedWorker: 'delegated-to-reviewed-cron-evidence',
  healthConsentAuthorizedWorker: 'delegated-to-reviewed-cron-evidence',
  checks,
  warnings,
  errors,
};

const placeholder = placeholderEnvValue;

function intEnv(name, fallback, min, max) {
  const value = Number(env[name]);
  return Number.isInteger(value) && value >= min && value <= max ? value : fallback;
}

function readEvidenceContext() {
  const sourceSha = exactEvidenceValue(
    env.PHASE9_EVIDENCE_SOURCE_SHA ?? env.GITHUB_SHA,
    /^[a-f0-9]{40}$/i,
  );
  const workflowRunId = exactEvidenceValue(
    env.PHASE9_EVIDENCE_WORKFLOW_RUN_ID ?? env.GITHUB_RUN_ID,
    /^[1-9][0-9]{0,19}$/,
  );
  const workflowRunAttempt = exactEvidenceValue(
    env.PHASE9_EVIDENCE_WORKFLOW_RUN_ATTEMPT ?? env.GITHUB_RUN_ATTEMPT,
    /^[1-9][0-9]{0,5}$/,
  );
  const ref = exactEvidenceValue(
    env.PHASE9_EVIDENCE_REF ?? env.GITHUB_REF,
    /^refs\/(?:heads|tags|pull)\/[A-Za-z0-9._/-]{1,240}$/,
  );
  const actor = exactEvidenceValue(
    env.PHASE9_EVIDENCE_ACTOR ?? env.GITHUB_ACTOR,
    /^(?:[A-Za-z0-9](?:[A-Za-z0-9-]{0,38})|[A-Za-z0-9](?:[A-Za-z0-9-]{0,32})\[bot\])$/,
  );
  const triggeringActor = exactEvidenceValue(
    env.PHASE9_EVIDENCE_TRIGGERING_ACTOR ?? env.GITHUB_TRIGGERING_ACTOR,
    /^(?:[A-Za-z0-9](?:[A-Za-z0-9-]{0,38})|[A-Za-z0-9](?:[A-Za-z0-9-]{0,32})\[bot\])$/,
  );
  const repository = exactEvidenceValue(
    env.PHASE9_EVIDENCE_REPOSITORY ?? env.GITHUB_REPOSITORY,
    /^[A-Za-z0-9_.-]{1,100}\/[A-Za-z0-9_.-]{1,100}$/,
  );
  const workflow = exactEvidenceValue(
    env.PHASE9_EVIDENCE_WORKFLOW ?? env.GITHUB_WORKFLOW,
    /^[A-Za-z0-9][A-Za-z0-9 ._/-]{0,99}$/,
  );
  const event = exactEvidenceValue(
    env.PHASE9_EVIDENCE_EVENT ?? env.GITHUB_EVENT_NAME,
    /^workflow_dispatch$/,
  );
  const buildPattern =
    /^(?:[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}|https:\/\/expo\.dev\/accounts\/[A-Za-z0-9._-]+\/projects\/[A-Za-z0-9._-]+\/builds\/[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}\/?)$/i;
  const rawIosBuildId = String(env.PHASE5_IOS_BUILD_ID ?? '').trim();
  return {
    sourceSha,
    workflowRunId,
    workflowRunAttempt,
    ref,
    actor,
    triggeringActor,
    repository,
    workflow,
    event,
    buildIds: {
      ios: exactEvidenceValue(rawIosBuildId, buildPattern),
    },
    invalidBuildIds: [
      rawIosBuildId && !buildPattern.test(rawIosBuildId) ? 'PHASE5_IOS_BUILD_ID' : null,
    ].filter(Boolean),
  };
}

function exactEvidenceValue(value, pattern) {
  const text = String(value ?? '').trim();
  return text && pattern.test(text) ? text : null;
}

function assert(condition, message) {
  if (!condition) throw new HarnessAssertionError(message);
}

function record(name, status, detail = '') {
  checks.push({ name, status, detail });
}

function writeArtifacts(status) {
  if (status === 'pass' && strict && warnings.length > 0) status = 'fail';
  artifact.status = status;
  if (status === 'pass' || status === 'fail') artifact.ranAt = new Date().toISOString();
  write('docs/phase-9/generated/live-edge-auth.json', `${JSON.stringify(artifact, null, 2)}\n`);
  write(
    'docs/phase-9/generated/live-edge-auth.md',
    [
      '# Live Edge auth evidence',
      '',
      `- Status: ${artifact.status}`,
      `- Source SHA: ${artifact.sourceSha ?? 'not supplied'}`,
      `- Workflow run: ${artifact.workflowRunId ?? 'not supplied'}`,
      `- Workflow attempt: ${artifact.workflowRunAttempt ?? 'not supplied'}`,
      `- Ref: ${artifact.ref ?? 'not supplied'}`,
      `- Actor: ${artifact.actor ?? 'not supplied'}`,
      `- Triggering actor: ${artifact.triggeringActor ?? 'not supplied'}`,
      `- Repository: ${artifact.repository ?? 'not supplied'}`,
      `- Workflow: ${artifact.workflow ?? 'not supplied'}`,
      `- Event: ${artifact.event ?? 'not supplied'}`,
      `- iOS build ID: ${artifact.buildIds.ios ?? 'not supplied'}`,
      `- Environment: ${artifact.appEnvironment}`,
      `- Expected Supabase project ref: ${artifact.expectedSupabaseProjectRef ?? 'not configured'}`,
      `- Actual Supabase project ref: ${artifact.actualSupabaseProjectRef ?? 'not canonical'}`,
      `- Supabase host: ${artifact.supabaseHost ?? 'not configured'}`,
      `- Request timeout: ${artifact.requestTimeoutSeconds}s`,
      `- Response maximum: ${artifact.responseMaxBytes} bytes`,
      `- Account deletion preflight: ${artifact.accountDeletionPreflight}`,
      `- Positive account deletion lifecycle: ${artifact.accountDeletionPositiveLifecycle}`,
      `- Authorized account deletion worker: ${artifact.accountDeletionAuthorizedWorker}`,
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
    const message = harnessErrorDetail(error);
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
  const email = `phase9-edge-auth-${suffix}@example.invalid`;
  const password = `Phase9Edge-${suffix}-Password!`;
  const { data, error } = await admin.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
    user_metadata: { phase9_live_edge_auth: true },
  });
  if (error) throw error;
  if (!data.user)
    throw new HarnessAssertionError('Supabase did not return an Edge auth harness user.');

  const client = publicClient();
  const signedIn = await client.auth.signInWithPassword({ email, password });
  if (signedIn.error) throw signedIn.error;
  const token = signedIn.data.session?.access_token;
  assert(token, 'Supabase did not return a session access token.');
  return { id: data.user.id, email, token };
}

function defaultBody(functionName) {
  if (functionName === accountDeletionFunction) return accountDeletionBeginBody();
  if (functionName === 'subscription-grants') return { action: 'start_reverse_trial' };
  if (functionName === 'catalog-search') return { query: 'phase9' };
  if (functionName === 'catalog-lookup') return { barcode: '012345678905' };
  if (functionName === 'catalog-report')
    return { correctionType: 'wrong_match', barcode: '012345678905' };
  if (functionName === 'consent-withdrawal') {
    return {
      consentType: 'marketing',
      version: 'phase9-live-edge-auth',
      consentTextHash: '0'.repeat(64),
    };
  }
  return {};
}

function accountDeletionToken() {
  return randomBytes(32).toString('hex');
}

function accountDeletionBeginBody() {
  const idempotencyKey = accountDeletionToken();
  const statusCapability = accountDeletionToken();
  assert(
    accountDeletionTokenPattern.test(idempotencyKey) &&
      accountDeletionTokenPattern.test(statusCapability) &&
      idempotencyKey !== statusCapability,
    'account-deletion begin tokens must be independent canonical 256-bit values.',
  );
  return { action: 'begin', idempotencyKey, statusCapability };
}

function oversizedBody() {
  return JSON.stringify({ phase9OversizedBody: 'x'.repeat(userEdgeBodyMaxBytes + 1024) });
}

async function postFunction(
  functionName,
  { auth = 'missing', token = '', body = {}, rawBody, method = 'POST', extraHeaders = {} } = {},
) {
  const headers = {
    apikey: publishableKey,
    'Content-Type': 'application/json',
    ...extraHeaders,
  };
  if (auth === 'valid') headers.Authorization = `Bearer ${token}`;
  if (auth === 'invalid') headers.Authorization = `Bearer invalid-${randomUUID()}`;
  if (auth === 'raw') headers.Authorization = token;

  const request = {
    method,
    headers,
    credentials: 'omit',
    signal: AbortSignal.timeout(requestTimeoutSeconds * 1000),
  };
  if (method !== 'GET' && method !== 'HEAD') {
    request.body = rawBody ?? JSON.stringify(body);
  }

  const response = await fetch(functionUrl(functionName), request);
  return {
    status: response.status,
    text: await readBoundedResponseText(response, responseMaxBytes),
  };
}

async function readBoundedResponseText(response, maximumBytes) {
  const declaredLength = Number(response.headers.get('content-length'));
  if (Number.isFinite(declaredLength) && declaredLength > maximumBytes) {
    if (response.body) await response.body.cancel().catch(() => {});
    throw new HarnessAssertionError('Edge response exceeded the declared size limit.');
  }
  if (!response.body) return '';

  const reader = response.body.getReader();
  const chunks = [];
  let total = 0;
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    total += value.byteLength;
    if (total > maximumBytes) {
      await reader.cancel().catch(() => {});
      throw new HarnessAssertionError('Edge response exceeded the streamed size limit.');
    }
    chunks.push(value);
  }

  const bytes = new Uint8Array(total);
  let offset = 0;
  for (const chunk of chunks) {
    bytes.set(chunk, offset);
    offset += chunk.byteLength;
  }
  try {
    return new TextDecoder('utf-8', { fatal: true }).decode(bytes);
  } catch {
    throw new HarnessAssertionError('Edge response was not valid UTF-8.');
  }
}

async function liveUserExists(admin, userId) {
  const { data, error } = await admin.auth.admin.getUserById(userId);
  if (error) {
    if (authUserMissing({ data, error })) return false;
    throw error;
  }
  return Boolean(data?.user?.id);
}

async function getFunction(functionName, token) {
  const response = await postFunction(functionName, {
    auth: 'valid',
    token,
    method: 'GET',
  });
  return { status: response.status, text: response.text };
}

function parseJson(text) {
  try {
    return JSON.parse(text);
  } catch {
    return null;
  }
}

function exactObjectKeys(value, expectedKeys) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return false;
  const actual = Object.keys(value).sort();
  const expected = [...expectedKeys].sort();
  return actual.length === expected.length && actual.every((key, index) => key === expected[index]);
}

function parseAccountDeletionBegin(response) {
  assert(
    response.status === 202,
    `account-deletion authenticated begin expected HTTP 202, got ${response.status}.`,
  );
  const body = parseJson(response.text);
  const validQueued = body?.phase === 'queued' && body?.nextPollAfterSeconds === 2;
  const validDelayed = body?.phase === 'delayed' && body?.nextPollAfterSeconds === 60;
  assert(
    exactObjectKeys(body, ['status', 'phase', 'nextPollAfterSeconds']) &&
      body.status === 'accepted' &&
      (validQueued || validDelayed),
    'account-deletion begin did not return the exact asynchronous acceptance contract.',
  );
  return body;
}

const ACCOUNT_OWNER_SUBJECT_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;

function parseAccountDeletionPreflight(response, expectedStatus = 'clear', expectedOwnerSubject) {
  const body = parseJson(response.text);
  assert(
    response.status === 200,
    `account-deletion preflight expected HTTP 200, got ${response.status}.`,
  );
  const validOwnerBoundState =
    exactObjectKeys(body, ['status', 'ownerSubject']) &&
    body?.status === expectedStatus &&
    typeof body.ownerSubject === 'string' &&
    ACCOUNT_OWNER_SUBJECT_PATTERN.test(body.ownerSubject) &&
    (expectedOwnerSubject === undefined || body.ownerSubject === expectedOwnerSubject);
  assert(
    (expectedStatus === 'clear' || expectedStatus === 'active') && validOwnerBoundState,
    `account-deletion preflight did not return the exact ${expectedStatus} response contract.`,
  );
  return body.status;
}

function parseAccountDeletionStatus(response) {
  const body = parseJson(response.text);
  if (response.status === 200) {
    const hasNotice = Object.hasOwn(body ?? {}, 'notice');
    assert(
      exactObjectKeys(body, hasNotice ? ['status', 'notice'] : ['status']) &&
        body.status === 'completed' &&
        (!hasNotice || body.notice === 'remove_apple_authorization'),
      'account-deletion HTTP 200 did not return the exact completed receipt contract.',
    );
    return { kind: 'completed', httpStatus: 200, notice: body.notice ?? null };
  }
  if (response.status === 202) {
    const validPendingPhase =
      body?.status === 'pending' &&
      ['queued', 'processing', 'local_erasing', 'provider_verifying'].includes(body?.phase);
    const validDelayedPhase = body?.status === 'delayed' && body?.phase === 'delayed';
    assert(
      exactObjectKeys(body, ['status', 'phase', 'nextPollAfterSeconds']) &&
        (validPendingPhase || validDelayedPhase) &&
        Number.isSafeInteger(body.nextPollAfterSeconds) &&
        body.nextPollAfterSeconds >= 2 &&
        body.nextPollAfterSeconds <= 60,
      'account-deletion HTTP 202 did not return the exact pending/delayed contract.',
    );
    return {
      kind: body.status,
      httpStatus: 202,
      phase: body.phase,
      nextPollAfterSeconds: body.nextPollAfterSeconds,
    };
  }
  if (response.status === 404 && exactObjectKeys(body, ['status']) && body.status === 'invalid') {
    return { kind: 'invalid', httpStatus: 404 };
  }
  if (response.status === 410 && exactObjectKeys(body, ['status']) && body.status === 'expired') {
    return { kind: 'expired', httpStatus: 410 };
  }
  throw new HarnessAssertionError(
    `account-deletion status expected exact HTTP 200/202/404/410 semantics, got ${response.status}.`,
  );
}

function parseAccountDeletionWorker(response) {
  const body = parseJson(response.text);
  assert(
    response.status === 200 &&
      exactObjectKeys(body, ['status', 'claimsProcessed', 'finalized', 'deadlineReached']) &&
      body.status === 'worked' &&
      Number.isSafeInteger(body.claimsProcessed) &&
      body.claimsProcessed >= 0 &&
      Number.isSafeInteger(body.finalized) &&
      body.finalized >= 0 &&
      typeof body.deadlineReached === 'boolean',
    'account-deletion worker did not return the exact bounded aggregate contract.',
  );
  return body;
}

function verifyAccountDeletionResponseValidators() {
  parseAccountDeletionBegin({
    status: 202,
    text: JSON.stringify({ status: 'accepted', phase: 'queued', nextPollAfterSeconds: 2 }),
  });
  for (const fixture of [
    { status: 200, text: JSON.stringify({ status: 'completed' }) },
    {
      status: 202,
      text: JSON.stringify({
        status: 'pending',
        phase: 'provider_verifying',
        nextPollAfterSeconds: 30,
      }),
    },
    { status: 404, text: JSON.stringify({ status: 'invalid' }) },
    { status: 410, text: JSON.stringify({ status: 'expired' }) },
  ]) {
    parseAccountDeletionStatus(fixture);
  }
  parseAccountDeletionWorker({
    status: 200,
    text: JSON.stringify({
      status: 'worked',
      claimsProcessed: 0,
      finalized: 0,
      deadlineReached: false,
    }),
  });
  parseAccountDeletionPreflight(
    {
      status: 200,
      text: JSON.stringify({
        status: 'clear',
        ownerSubject: '22222222-2222-4222-8222-222222222222',
      }),
    },
    'clear',
    '22222222-2222-4222-8222-222222222222',
  );
  parseAccountDeletionPreflight(
    {
      status: 200,
      text: JSON.stringify({
        status: 'active',
        ownerSubject: '22222222-2222-4222-8222-222222222222',
      }),
    },
    'active',
    '22222222-2222-4222-8222-222222222222',
  );

  let rejectedLooseStatus = false;
  try {
    parseAccountDeletionStatus({
      status: 200,
      text: JSON.stringify({ status: 'completed', unexpected: true }),
    });
  } catch {
    rejectedLooseStatus = true;
  }
  assert(rejectedLooseStatus, 'account-deletion status validator accepted an unknown field.');
  let rejectedLoosePreflight = false;
  try {
    parseAccountDeletionPreflight({
      status: 200,
      text: JSON.stringify({
        status: 'clear',
        ownerSubject: '22222222-2222-4222-8222-222222222222',
        operationId: 'forbidden',
      }),
    });
  } catch {
    rejectedLoosePreflight = true;
  }
  assert(rejectedLoosePreflight, 'account-deletion preflight validator accepted lifecycle detail.');
  let rejectedOwnerlessActive = false;
  try {
    parseAccountDeletionPreflight(
      { status: 200, text: JSON.stringify({ status: 'active' }) },
      'active',
    );
  } catch {
    rejectedOwnerlessActive = true;
  }
  assert(
    rejectedOwnerlessActive,
    'account-deletion preflight validator accepted active without its authenticated owner.',
  );
  let rejectedOwnerlessClear = false;
  try {
    parseAccountDeletionPreflight({ status: 200, text: JSON.stringify({ status: 'clear' }) });
  } catch {
    rejectedOwnerlessClear = true;
  }
  assert(
    rejectedOwnerlessClear,
    'account-deletion preflight validator accepted clear without its authenticated owner.',
  );
}

async function postAccountDeletionStatus(capability) {
  return postFunction(accountDeletionFunction, {
    body: { action: 'status', capability },
  });
}

async function postAccountDeletionWorker(workerCredential) {
  return postFunction(accountDeletionFunction, {
    body: { action: 'work' },
    extraHeaders:
      workerCredential === undefined ? {} : { [accountDeletionWorkerHeader]: workerCredential },
  });
}

async function postHealthConsentWorker(workerCredential) {
  return postFunction(healthConsentWorkerFunction, {
    body: { action: 'work' },
    extraHeaders:
      workerCredential === undefined ? {} : { [healthConsentWorkerHeader]: workerCredential },
  });
}

function assertStatus(actual, expected, label) {
  assert(actual === expected, `${label}: expected HTTP ${expected}, got ${actual}.`);
}

function assertErrorCode(response, code, label) {
  const body = parseJson(response.text);
  assert(body?.error === code, `${label}: expected stable error ${code}.`);
}

function assertExactErrorCode(response, code, label) {
  const body = parseJson(response.text);
  assert(
    exactObjectKeys(body, ['error']) && body.error === code,
    `${label}: expected exact stable error ${code}.`,
  );
}

function assertMethodNotAllowed(response, label) {
  const body = parseJson(response.text);
  const code = body?.error;
  assert(
    code === 'method_not_allowed' || code === 'METHOD_NOT_ALLOWED',
    `${label}: expected stable method_not_allowed error.`,
  );
}

async function countRows(admin, table, column, value) {
  const { data, error } = await admin.from(table).select('id').eq(column, value);
  if (error) throw error;
  return (data ?? []).length;
}

async function main() {
  if (!runLive) {
    warnings.push(
      'Live Edge auth harness not run; set PHASE9_RUN_LIVE_EDGE_AUTH=true with staging credentials.',
    );
    writeArtifacts('not-run');
    printResult('Phase 9 live Edge auth', errors, warnings);
    return;
  }

  block(
    errors,
    env.APP_ENV === 'staging',
    'Live Edge auth requires the exact server-side APP_ENV=staging contract.',
  );
  block(
    errors,
    appEnv === 'staging',
    'Live Edge auth requires the effective app environment to be staging.',
  );
  block(errors, !placeholder(supabaseUrl), 'SUPABASE_URL is missing or placeholder.');
  block(
    errors,
    Boolean(supabaseTarget.expectedProjectRef),
    'PHASE9_EXPECTED_SUPABASE_PROJECT_REF must be the reviewed 20-character lowercase alphanumeric project ref.',
  );
  block(
    errors,
    supabaseTarget.valid,
    'SUPABASE_URL must exactly equal the canonical HTTPS origin for PHASE9_EXPECTED_SUPABASE_PROJECT_REF.',
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
    Boolean(evidenceContext.sourceSha),
    'Live Edge auth evidence requires an exact 40-character PHASE9_EVIDENCE_SOURCE_SHA or GITHUB_SHA.',
  );
  block(
    errors,
    env.GITHUB_ACTIONS !== 'true' ||
      Boolean(
        evidenceContext.workflowRunId &&
        evidenceContext.workflowRunAttempt &&
        evidenceContext.ref &&
        evidenceContext.actor &&
        evidenceContext.triggeringActor &&
        evidenceContext.repository &&
        evidenceContext.workflow &&
        evidenceContext.event,
      ),
    'GitHub live Edge auth evidence requires exact workflow run, attempt, and ref metadata.',
  );
  block(
    errors,
    evidenceContext.invalidBuildIds.length === 0,
    `Live Edge auth evidence rejected invalid build identifiers: ${evidenceContext.invalidBuildIds.join(', ')}.`,
  );
  if (errors.length > 0) {
    writeArtifacts('fail');
    printResult('Phase 9 live Edge auth', errors, warnings);
    return;
  }

  const admin = createClient(supabaseUrl, secretKey, {
    auth: { autoRefreshToken: false, persistSession: false, detectSessionInUrl: false },
  });
  let user = null;
  let stalePreflightUser = null;
  let stalePreflightUserDeleted = false;
  const correctionIds = [];

  try {
    user = await createLiveUser(admin);

    await runCheck(
      'account-deletion validators enforce exact 202 begin and 200/202/404/410 status contracts',
      async () => {
        verifyAccountDeletionResponseValidators();
      },
    );

    await runCheck(
      'account-deletion authenticated preflight returns only the exact owner-bound clear response',
      async () => {
        const response = await postFunction(accountDeletionFunction, {
          auth: 'valid',
          token: user.token,
          body: { action: 'preflight' },
        });
        assert(
          parseAccountDeletionPreflight(response, 'clear', user.id) === 'clear',
          'new live user did not receive the exact clear preflight state.',
        );
      },
    );

    await runCheck(
      'account-deletion preflight rejects missing and invalid bearer credentials',
      async () => {
        for (const auth of ['missing', 'invalid']) {
          const response = await postFunction(accountDeletionFunction, {
            auth,
            body: { action: 'preflight' },
          });
          assertStatus(response.status, 401, `account-deletion preflight ${auth} bearer`);
          assertExactErrorCode(
            response,
            'ACCOUNT_DELETION_SESSION_REJECTED',
            `account-deletion preflight ${auth} bearer`,
          );
        }
      },
    );

    await runCheck(
      'account-deletion preflight rejects a stale token after its Auth user is deleted',
      async () => {
        stalePreflightUser = await createLiveUser(admin);
        const { error } = await admin.auth.admin.deleteUser(stalePreflightUser.id);
        if (error) throw error;
        stalePreflightUserDeleted = true;
        const response = await postFunction(accountDeletionFunction, {
          auth: 'valid',
          token: stalePreflightUser.token,
          body: { action: 'preflight' },
        });
        assertStatus(response.status, 401, 'account-deletion preflight stale bearer');
        assertExactErrorCode(
          response,
          'ACCOUNT_DELETION_SESSION_REJECTED',
          'account-deletion preflight stale bearer',
        );
      },
    );

    await runCheck('user Edge Functions reject missing JWT', async () => {
      for (const functionName of bearerProtectedFunctions) {
        const response = await postFunction(functionName, {
          auth: 'missing',
          body: defaultBody(functionName),
        });
        assertStatus(response.status, 401, `${functionName} missing JWT`, response.text);
        if (functionName === accountDeletionFunction) {
          assertErrorCode(response, 'UNAUTHORIZED', 'account-deletion missing JWT');
        }
      }
    });

    await runCheck('user Edge Functions reject invalid JWT', async () => {
      for (const functionName of bearerProtectedFunctions) {
        const response = await postFunction(functionName, {
          auth: 'invalid',
          body: defaultBody(functionName),
        });
        assertStatus(response.status, 401, `${functionName} invalid JWT`, response.text);
        if (functionName === accountDeletionFunction) {
          assertErrorCode(response, 'UNAUTHORIZED', 'account-deletion invalid JWT');
        }
      }
    });

    await runCheck('user Edge Functions reject raw JWT without Bearer scheme', async () => {
      for (const functionName of bearerProtectedFunctions) {
        const response = await postFunction(functionName, {
          auth: 'raw',
          token: user.token,
          body: defaultBody(functionName),
        });
        assertStatus(response.status, 401, `${functionName} raw JWT`, response.text);
        if (functionName === accountDeletionFunction) {
          assertErrorCode(response, 'UNAUTHORIZED', 'account-deletion raw JWT');
        }
      }
      assert(
        await liveUserExists(admin, user.id),
        'raw-JWT account-deletion removed the live harness user.',
      );
      assert(
        (await countRows(admin, 'entitlements', 'user_id', user.id)) === 0,
        'raw-JWT subscription call wrote entitlement.',
      );
      assert(
        (await countRows(admin, 'reverse_trial_grants', 'user_id', user.id)) === 0,
        'raw-JWT subscription call wrote grant.',
      );
      assert(
        (await countRows(admin, 'catalog_lookup_events', 'user_id', user.id)) === 0,
        'raw-JWT catalog call wrote lookup event.',
      );
      assert(
        (await countRows(admin, 'consents', 'user_id', user.id)) === 0,
        'raw-JWT consent-withdrawal wrote consent.',
      );
    });

    await runCheck('user Edge Functions reject valid JWT non-POST methods', async () => {
      for (const functionName of methodRestrictedFunctions) {
        const response = await getFunction(functionName, user.token);
        assertStatus(response.status, 405, `${functionName} valid JWT GET`, response.text);
        assertMethodNotAllowed(response, `${functionName} valid JWT GET`);
      }
      assert(
        await liveUserExists(admin, user.id),
        'valid-JWT non-POST account-deletion removed the live harness user.',
      );
      assert(
        (await countRows(admin, 'entitlements', 'user_id', user.id)) === 0,
        'valid-JWT non-POST subscription call wrote entitlement.',
      );
      assert(
        (await countRows(admin, 'reverse_trial_grants', 'user_id', user.id)) === 0,
        'valid-JWT non-POST subscription call wrote grant.',
      );
      assert(
        (await countRows(admin, 'catalog_lookup_events', 'user_id', user.id)) === 0,
        'valid-JWT non-POST catalog call wrote lookup event.',
      );
      assert(
        (await countRows(admin, 'consents', 'user_id', user.id)) === 0,
        'valid-JWT non-POST consent-withdrawal wrote consent.',
      );
    });

    await runCheck('user Edge Functions reject oversized bodies before side effects', async () => {
      for (const functionName of bodyLimitedFunctions) {
        const response = await postFunction(functionName, {
          auth: 'valid',
          token: user.token,
          rawBody: oversizedBody(),
        });
        assertStatus(response.status, 413, `${functionName} oversized body`, response.text);
        assertErrorCode(
          response,
          functionName === accountDeletionFunction ? 'PAYLOAD_TOO_LARGE' : 'payload_too_large',
          `${functionName} oversized body`,
        );
      }
      assert(
        await liveUserExists(admin, user.id),
        'oversized body account-deletion removed the live harness user.',
      );
      assert(
        (await countRows(admin, 'entitlements', 'user_id', user.id)) === 0,
        'oversized body subscription call wrote entitlement.',
      );
      assert(
        (await countRows(admin, 'reverse_trial_grants', 'user_id', user.id)) === 0,
        'oversized body subscription call wrote grant.',
      );
      assert(
        (await countRows(admin, 'catalog_lookup_events', 'user_id', user.id)) === 0,
        'oversized body catalog call wrote lookup event.',
      );
      assert(
        (await countRows(admin, 'consents', 'user_id', user.id)) === 0,
        'oversized body consent-withdrawal wrote consent.',
      );
    });

    await runCheck(
      'account-deletion capability status is unauthenticated and returns exact 404 for a random miss',
      async () => {
        const outcome = parseAccountDeletionStatus(
          await postAccountDeletionStatus(accountDeletionToken()),
        );
        assert(
          outcome.kind === 'invalid' && outcome.httpStatus === 404,
          'random account-deletion capability did not return the exact invalid contract.',
        );
      },
    );

    await runCheck(
      'account-deletion worker rejects missing and wrong dedicated service credentials without work',
      async () => {
        // The real ACCOUNT_DELETION_WORKER_SECRET is deliberately never read or
        // sent by this auth-negative harness. Authorized work is global queue
        // mutation and belongs to reviewed Cron evidence.
        for (const [label, credential] of [
          ['missing', undefined],
          ['wrong', 'A'.repeat(64)],
        ]) {
          const response = await postAccountDeletionWorker(credential);
          assertStatus(response.status, 401, `account-deletion ${label} worker credential`);
          assertErrorCode(response, 'UNAUTHORIZED', `account-deletion ${label} worker credential`);
        }
      },
    );

    await runCheck(
      'health-consent worker rejects missing and wrong dedicated service credentials without work',
      async () => {
        // The real HEALTH_CONSENT_WORKER_SECRET is deliberately never read or
        // sent by this auth-negative harness. Authorized global queue work
        // belongs to reviewed Vault/Cron evidence.
        for (const [label, credential] of [
          ['missing', undefined],
          ['wrong', 'A'.repeat(64)],
        ]) {
          const response = await postHealthConsentWorker(credential);
          assertStatus(response.status, 401, `health-consent ${label} worker credential`);
          assertErrorCode(response, 'UNAUTHORIZED', `health-consent ${label} worker credential`);
        }
      },
    );

    await runCheck(
      'subscription-grants valid JWT rejects unknown action without grant',
      async () => {
        const response = await postFunction('subscription-grants', {
          auth: 'valid',
          token: user.token,
          body: { action: 'phase9_unknown_action' },
        });
        assertStatus(response.status, 400, 'subscription-grants unknown action', response.text);
        assertErrorCode(response, 'unknown_action', 'subscription-grants unknown action');
        assert(
          (await countRows(admin, 'entitlements', 'user_id', user.id)) === 0,
          'unknown subscription action wrote entitlement.',
        );
        assert(
          (await countRows(admin, 'reverse_trial_grants', 'user_id', user.id)) === 0,
          'unknown subscription action wrote grant.',
        );
      },
    );

    await runCheck(
      'subscription-reconciliation valid JWT rejects caller-selected authority without fetch',
      async () => {
        const response = await postFunction('subscription-reconciliation', {
          auth: 'valid',
          token: user.token,
          body: { p_user_id: user.id, request_date: new Date().toISOString() },
        });
        assertStatus(response.status, 400, 'subscription-reconciliation input', response.text);
        assertErrorCode(response, 'unexpected_input', 'subscription-reconciliation input');
        assert(
          (await countRows(admin, 'entitlements', 'user_id', user.id)) === 0,
          'caller-selected reconciliation wrote entitlement.',
        );
      },
    );

    await runCheck('catalog-search valid JWT returns too_short without lookup event', async () => {
      const response = await postFunction('catalog-search', {
        auth: 'valid',
        token: user.token,
        body: { query: 'x', limit: 10 },
      });
      assertStatus(response.status, 200, 'catalog-search too short', response.text);
      const body = parseJson(response.text);
      assert(
        body?.result === 'too_short',
        'catalog-search returned an unexpected response contract.',
      );
      assert(
        (await countRows(admin, 'catalog_lookup_events', 'user_id', user.id)) === 0,
        'too-short catalog search wrote lookup event.',
      );
    });

    await runCheck(
      'catalog-lookup valid JWT rejects invalid barcode without lookup event',
      async () => {
        const response = await postFunction('catalog-lookup', {
          auth: 'valid',
          token: user.token,
          body: { barcode: '123' },
        });
        assertStatus(response.status, 400, 'catalog-lookup invalid barcode', response.text);
        assertErrorCode(response, 'invalid_barcode', 'catalog-lookup invalid barcode');
        assert(
          (await countRows(admin, 'catalog_lookup_events', 'user_id', user.id)) === 0,
          'invalid catalog lookup wrote lookup event.',
        );
      },
    );

    await runCheck(
      'catalog-report valid JWT rejects malformed JSON and unknown fields',
      async () => {
        const badJson = await postFunction('catalog-report', {
          auth: 'valid',
          token: user.token,
          rawBody: 'not-json',
        });
        assertStatus(badJson.status, 400, 'catalog-report bad JSON', badJson.text);
        assertErrorCode(badJson, 'bad_json', 'catalog-report bad JSON');

        const unexpected = await postFunction('catalog-report', {
          auth: 'valid',
          token: user.token,
          body: { correctionType: 'wrong_match', barcode: '012345678905', shelfProductId: user.id },
        });
        assertStatus(unexpected.status, 400, 'catalog-report unexpected field', unexpected.text);
        assertErrorCode(unexpected, 'unexpected_field', 'catalog-report unexpected field');
      },
    );

    await runCheck('catalog-report valid JWT rejects invalid nested payload shapes', async () => {
      const invalidPayload = await postFunction('catalog-report', {
        auth: 'valid',
        token: user.token,
        body: { correctionType: 'wrong_match', proposedPayload: ['not-an-object'] },
      });
      assertStatus(
        invalidPayload.status,
        400,
        'catalog-report invalid proposedPayload',
        invalidPayload.text,
      );
      assertErrorCode(
        invalidPayload,
        'invalid_proposed_payload',
        'catalog-report invalid proposedPayload',
      );

      const invalidContext = await postFunction('catalog-report', {
        auth: 'valid',
        token: user.token,
        body: { correctionType: 'wrong_match', clientContext: ['not-an-object'] },
      });
      assertStatus(
        invalidContext.status,
        400,
        'catalog-report invalid clientContext',
        invalidContext.text,
      );
      assertErrorCode(
        invalidContext,
        'invalid_client_context',
        'catalog-report invalid clientContext',
      );
    });

    await runCheck('catalog-report valid JWT stores sanitized report payload only', async () => {
      const response = await postFunction('catalog-report', {
        auth: 'valid',
        token: user.token,
        body: {
          correctionType: 'wrong_match',
          barcode: '012345678905',
          description: 'phase9 catalog correction',
          proposedPayload: {
            productName: 'Phase9 cleanser',
            sourceUrl: 'https://example.org/catalog/product?token=must-not-persist',
            defaultPaoMonths: 12,
            suggestedCorrection: 'Use the reviewed catalog source',
          },
          clientContext: {
            route: 'phase9_live_edge_auth',
            platform: 'security',
          },
        },
      });
      assertStatus(response.status, 200, 'catalog-report sanitized payload', response.text);
      const body = parseJson(response.text);
      const correctionId = body?.correction?.id;
      assert(correctionId, 'catalog-report did not return a correction id.');
      correctionIds.push(correctionId);

      const { data, error } = await admin
        .from('catalog_corrections')
        .select('id,user_id,barcode,correction_type,description,proposed_payload,client_context')
        .eq('id', correctionId)
        .single();
      if (error) throw error;
      assert(data.user_id === user.id, 'catalog-report correction row belongs to the wrong user.');
      assert(
        data.correction_type === 'wrong_match',
        'catalog-report persisted the wrong correction type.',
      );
      assert(data.barcode === '012345678905', 'catalog-report persisted the wrong barcode.');
      assert(
        data.description === 'phase9 catalog correction',
        'catalog-report persisted the wrong description.',
      );
      assert(
        data.proposed_payload?.productName === 'Phase9 cleanser',
        'catalog-report dropped safe productName.',
      );
      assert(
        data.proposed_payload?.sourceUrl === 'https://example.org/catalog/product',
        'catalog-report did not strip sourceUrl query.',
      );
      assert(
        !JSON.stringify(data.proposed_payload).includes('must-not-persist'),
        'catalog-report persisted a URL query token.',
      );
      assert(
        data.client_context?.route === 'phase9_live_edge_auth',
        'catalog-report dropped safe route context.',
      );
      assert(
        data.client_context?.shelfProductId === undefined,
        'catalog-report persisted a local shelf product id.',
      );
    });
  } finally {
    if (user?.id) {
      if (correctionIds.length > 0) {
        const { error } = await admin.from('catalog_corrections').delete().in('id', correctionIds);
        if (error) errors.push(`Catalog correction cleanup failed: ${redactedErrorKind(error)}`);
      }
      for (const table of ['catalog_lookup_events', 'entitlements', 'reverse_trial_grants']) {
        const { error } = await admin.from(table).delete().eq('user_id', user.id);
        if (error) errors.push(`${table} cleanup failed: ${redactedErrorKind(error)}`);
      }
      for (const table of [
        'catalog_corrections',
        'catalog_lookup_events',
        'entitlements',
        'reverse_trial_grants',
      ]) {
        try {
          if ((await countRows(admin, table, 'user_id', user.id)) !== 0) {
            errors.push(`${table} cleanup left residual rows.`);
          }
        } catch (error) {
          errors.push(`${table} cleanup verification failed: ${redactedErrorKind(error)}`);
        }
      }
      const { error } = await admin.auth.admin.deleteUser(user.id);
      if (error) errors.push(`Edge auth user cleanup failed: ${redactedErrorKind(error)}`);
      else {
        try {
          if (await liveUserExists(admin, user.id)) {
            errors.push('Edge auth user cleanup left a residual Auth user.');
          }
        } catch (verifyError) {
          errors.push(
            `Edge auth user cleanup verification failed: ${redactedErrorKind(verifyError)}`,
          );
        }
      }
    }
    if (stalePreflightUser?.id && !stalePreflightUserDeleted) {
      const { error } = await admin.auth.admin.deleteUser(stalePreflightUser.id);
      if (error) errors.push(`Stale preflight user cleanup failed: ${redactedErrorKind(error)}`);
    }
  }

  writeArtifacts(errors.length > 0 || (strict && warnings.length > 0) ? 'fail' : 'pass');
  printResult('Phase 9 live Edge auth', errors, warnings);
}

main().catch((error) => {
  errors.push(harnessErrorDetail(error));
  writeArtifacts('fail');
  printResult('Phase 9 live Edge auth', errors, warnings);
});
