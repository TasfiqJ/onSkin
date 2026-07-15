#!/usr/bin/env node
import { createHash, createHmac, randomBytes, randomUUID } from 'node:crypto';
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
  storageObjectMissing,
  strict,
  write,
} from './lib.mjs';

const errors = [];
const warnings = [];
const checks = [];
const samples = [];
const env = envSnapshot();

const runLive = env.PHASE9_RUN_LIVE_DATA_RIGHTS === 'true';
const allowDestructiveAccountDeletion = env.PHASE9_ALLOW_DESTRUCTIVE_ACCOUNT_DELETION === 'true';
const appEnv = readScriptAppEnvironment();
const supabaseUrl = env.SUPABASE_URL;
const supabaseTarget = resolveHostedSupabaseProjectTarget(
  supabaseUrl,
  env.PHASE9_EXPECTED_SUPABASE_PROJECT_REF,
);
const publishableKey =
  env.SUPABASE_PUBLISHABLE_KEY ?? env.EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY ?? env.SUPABASE_ANON_KEY;
const secretKey = env.SUPABASE_SECRET_KEY ?? env.SUPABASE_SERVICE_ROLE_KEY;
const dataExportRateLimitMax = intEnv('DATA_EXPORT_RATE_LIMIT_MAX', 5, 1, 100);
const dataExportRateLimitWindowSeconds = intEnv(
  'DATA_EXPORT_RATE_LIMIT_WINDOW_SECONDS',
  3600,
  60,
  86400,
);
const dataExportPhotoUrlTtlSeconds = intEnv('DATA_EXPORT_PHOTO_URL_TTL_SECONDS', 3600, 60, 3600);
const dataExportProbeBudget = intEnv(
  'PHASE9_DATA_EXPORT_RATE_LIMIT_PROBE_MAX',
  Math.min(dataExportRateLimitMax + 2, 102),
  2,
  110,
);
const runSignedUrlExpiryCheck = env.PHASE9_DATA_EXPORT_SIGNED_URL_EXPIRY_CHECK === 'true';
const signedUrlExpiryWaitSeconds = intEnv(
  'PHASE9_DATA_EXPORT_SIGNED_URL_EXPIRY_WAIT_SECONDS',
  Math.min(dataExportPhotoUrlTtlSeconds + 10, 3900),
  0,
  3900,
);
const accountDeletionPollTimeoutSeconds = intEnv(
  'PHASE9_ACCOUNT_DELETION_POLL_TIMEOUT_SECONDS',
  900,
  30,
  3600,
);
const accountDeletionMaxPolls = intEnv('PHASE9_ACCOUNT_DELETION_MAX_POLLS', 300, 1, 1000);
const accountDeletionRequestTimeoutSeconds = intEnv(
  'PHASE9_ACCOUNT_DELETION_REQUEST_TIMEOUT_SECONDS',
  20,
  1,
  60,
);
const evidenceContext = readEvidenceContext();

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
  dataExportRateLimitMax,
  dataExportRateLimitWindowSeconds,
  dataExportPhotoUrlTtlSeconds,
  dataExportProbeBudget,
  signedUrlExpiryCheck: runSignedUrlExpiryCheck,
  signedUrlExpiryWaitSeconds,
  destructiveAccountDeletionAuthorized: allowDestructiveAccountDeletion,
  accountDeletionPollTimeoutSeconds,
  accountDeletionMaxPolls,
  accountDeletionRequestTimeoutSeconds,
  checks,
  samples,
  warnings,
  errors,
};

const placeholder = placeholderEnvValue;

function intEnv(name, fallback, min, max) {
  const value = Number(env[name]);
  if (!Number.isInteger(value) || value < min || value > max) return fallback;
  return value;
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
  write('docs/phase-9/generated/live-data-rights.json', `${JSON.stringify(artifact, null, 2)}\n`);
  write(
    'docs/phase-9/generated/live-data-rights.md',
    [
      '# Live data rights evidence',
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
      `- Data export configured max: ${artifact.dataExportRateLimitMax}`,
      `- Data export configured window: ${artifact.dataExportRateLimitWindowSeconds}s`,
      `- Data export photo URL TTL: ${artifact.dataExportPhotoUrlTtlSeconds}s`,
      `- Data export probe budget: ${artifact.dataExportProbeBudget}`,
      `- Signed URL expiry check: ${artifact.signedUrlExpiryCheck ? 'enabled' : 'disabled'}`,
      `- Signed URL expiry wait: ${artifact.signedUrlExpiryWaitSeconds}s`,
      `- Destructive synthetic-account deletion: ${
        artifact.destructiveAccountDeletionAuthorized ? 'explicitly authorized' : 'not authorized'
      }`,
      `- Account deletion polling timeout: ${artifact.accountDeletionPollTimeoutSeconds}s`,
      `- Account deletion maximum polls: ${artifact.accountDeletionMaxPolls}`,
      `- Account deletion request timeout: ${artifact.accountDeletionRequestTimeoutSeconds}s`,
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
      '## Redacted Evidence Samples',
      samples.length
        ? samples
            .map((sample) => {
              if (sample.scope === 'data-export-photo-url-expiry') {
                return `- ${sample.scope}: ttl=${sample.ttlSeconds}s, waited=${sample.waitSeconds}s, before=${sample.beforeStatus}, after=${sample.afterStatus}`;
              }
              if (sample.scope === 'account-deletion') {
                return `- ${sample.scope}: polls=${sample.polls}, terminal_http=${sample.terminalHttpStatus}, auth_absent=${sample.authAbsent}, post_auth_receipt_replay=${sample.postAuthReceiptReplay}`;
              }
              return `- ${sample.scope}: count=${sample.requestCount}, window=${sample.windowSeconds}s, key=${sample.keyHashRedacted}`;
            })
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
    const message = harnessErrorDetail(error);
    record(name, 'fail', message);
    errors.push(`${name}: ${message}`);
  }
}

function publicClient() {
  return createClient(supabaseUrl, publishableKey, {
    global: { headers: { 'x-health-processing-epoch': '1' } },
    auth: { autoRefreshToken: false, persistSession: false, detectSessionInUrl: false },
  });
}

function functionUrl(name) {
  return `${supabaseUrl.replace(/\/+$/g, '')}/functions/v1/${name}`;
}

async function createLiveUser(admin, label, trackCreatedUser) {
  const suffix = `${Date.now()}-${randomUUID().slice(0, 8)}`;
  const email = `phase9-data-${label}-${suffix}@example.invalid`;
  const password = `Phase9Data-${suffix}-Password!`;
  const { data, error } = await admin.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
    user_metadata: { phase9_live_data_rights: true },
  });
  if (error) throw error;
  if (!data.user) throw new Error(`Supabase did not return a user for ${label}.`);
  trackCreatedUser({ id: data.user.id });

  const client = publicClient();
  const signedIn = await client.auth.signInWithPassword({ email, password });
  if (signedIn.error) throw signedIn.error;
  const token = signedIn.data.session?.access_token;
  assert(token, `Supabase did not return a session access token for ${label}.`);
  return { id: data.user.id, email, client, token };
}

async function insertOne(client, table, payload, select = '*') {
  const { data, error } = await client.from(table).insert(payload).select(select).single();
  if (error) throw error;
  return data;
}

async function upsertOne(client, table, payload, select = '*') {
  const { data, error } = await client.from(table).upsert(payload).select(select).single();
  if (error) throw error;
  return data;
}

function rows(bundle, key) {
  const value = bundle[key];
  assert(Array.isArray(value), `export field ${key} is not an array.`);
  return value;
}

const subscriptionIdentityFields = [
  'user_id',
  'resolved_user_id',
  'app_user_id',
  'original_app_user_id',
  'aliases',
  'transferred_from',
  'transferred_to',
];
const subscriptionArrayIdentityFields = ['aliases', 'transferred_from', 'transferred_to'];

function subscriptionEventContainsIdentity(row, userId) {
  return (
    row?.user_id === userId ||
    row?.resolved_user_id === userId ||
    row?.app_user_id === userId ||
    row?.original_app_user_id === userId ||
    subscriptionArrayIdentityFields.some(
      (field) => Array.isArray(row?.[field]) && row[field].includes(userId),
    )
  );
}

function assertNoSubscriptionIdentity(row, userId, label) {
  assert(row && typeof row === 'object', `${label}: subscription event row is missing.`);
  assert(
    !subscriptionEventContainsIdentity(row, userId),
    `${label}: deleted account remains in a subscription identity field.`,
  );
}

function assertExactArray(actual, expected, label) {
  assert(
    JSON.stringify(actual) === JSON.stringify(expected),
    `${label}: retained array order or membership changed.`,
  );
}

async function subscriptionEventById(admin, id, label) {
  const { data, error } = await admin
    .from('subscriptions_events')
    .select('*')
    .eq('id', id)
    .single();
  if (error) throw error;
  assert(data, `${label}: subscription event row is missing.`);
  return data;
}

function expectBundleHasOnlyUser(bundle, key, column, userId, otherUserId) {
  const value = rows(bundle, key);
  assert(
    value.some((row) => row?.[column] === userId),
    `export ${key} is missing caller row.`,
  );
  assert(
    !value.some((row) => row?.[column] === otherUserId),
    `export ${key} leaked another user's row.`,
  );
}

async function expectAdminRows(admin, table, column, value, expectedCount, label) {
  const { data, error } = await admin.from(table).select('*').eq(column, value);
  if (error) throw error;
  assert(
    (data ?? []).length === expectedCount,
    `${label}: expected ${expectedCount} row(s), got ${(data ?? []).length}.`,
  );
  return data ?? [];
}

async function userExists(admin, userId) {
  const result = await admin.auth.admin.getUserById(userId);
  if (authUserMissing(result)) return false;
  if (result.error) throw result.error;
  if (!result.data?.user) throw new Error('AUTH_USER_LOOKUP_INVALID');
  return true;
}

async function postDataExport(token) {
  const response = await fetch(functionUrl('data-export'), {
    method: 'POST',
    headers: {
      apikey: publishableKey,
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: '{}',
  });
  return {
    status: response.status,
    retryAfter: response.headers.get('retry-after'),
    text: await response.text(),
  };
}

function wait(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function parseJson(text) {
  try {
    return JSON.parse(text);
  } catch {
    return null;
  }
}

const ACCOUNT_DELETION_RESPONSE_MAX_BYTES = 4096;
const ACCOUNT_DELETION_TOKEN_PATTERN = /^[a-f0-9]{64}$/;

function exactObjectKeys(value, expectedKeys) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return false;
  const actual = Object.keys(value).sort();
  const expected = [...expectedKeys].sort();
  return actual.length === expected.length && actual.every((key, index) => key === expected[index]);
}

function accountDeletionToken() {
  return randomBytes(32).toString('hex');
}

async function readBoundedResponseText(response, maximumBytes) {
  const declaredLength = Number(response.headers.get('content-length'));
  if (Number.isFinite(declaredLength) && declaredLength > maximumBytes) {
    if (response.body) await response.body.cancel().catch(() => {});
    throw new HarnessAssertionError('account-deletion response exceeded the declared size limit.');
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
      throw new HarnessAssertionError(
        'account-deletion response exceeded the streamed size limit.',
      );
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
    throw new HarnessAssertionError('account-deletion response was not valid UTF-8.');
  }
}

async function accountDeletionResponse(response) {
  const text = await readBoundedResponseText(response, ACCOUNT_DELETION_RESPONSE_MAX_BYTES);
  const body = parseJson(text);
  assert(body !== null, 'account-deletion returned malformed or empty JSON.');
  return { status: response.status, body };
}

async function postAccountDeletionBegin(token, request) {
  const response = await fetch(functionUrl('account-deletion'), {
    method: 'POST',
    headers: {
      apikey: publishableKey,
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(request),
    credentials: 'omit',
    signal: AbortSignal.timeout(accountDeletionRequestTimeoutSeconds * 1000),
  });
  return accountDeletionResponse(response);
}

async function postAccountDeletionPreflight(token) {
  const response = await fetch(functionUrl('account-deletion'), {
    method: 'POST',
    headers: {
      apikey: publishableKey,
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ action: 'preflight' }),
    credentials: 'omit',
    signal: AbortSignal.timeout(accountDeletionRequestTimeoutSeconds * 1000),
  });
  return accountDeletionResponse(response);
}

// Deliberately capability-only: this request must remain usable after Auth is gone.
async function postAccountDeletionStatus(capability) {
  const response = await fetch(functionUrl('account-deletion'), {
    method: 'POST',
    headers: {
      apikey: publishableKey,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ action: 'status', capability }),
    credentials: 'omit',
    signal: AbortSignal.timeout(accountDeletionRequestTimeoutSeconds * 1000),
  });
  return accountDeletionResponse(response);
}

function parseAccountDeletionBegin(response) {
  assert(
    response.status === 202,
    `account-deletion begin expected HTTP 202, got ${response.status}.`,
  );
  assert(
    exactObjectKeys(response.body, ['status', 'phase', 'nextPollAfterSeconds']) &&
      response.body.status === 'accepted' &&
      (response.body.phase === 'queued' || response.body.phase === 'delayed') &&
      Number.isSafeInteger(response.body.nextPollAfterSeconds) &&
      response.body.nextPollAfterSeconds >= 2 &&
      response.body.nextPollAfterSeconds <= 60,
    'account-deletion begin did not return the exact accepted receipt contract.',
  );
  return {
    phase: response.body.phase,
    nextPollAfterSeconds: response.body.nextPollAfterSeconds,
  };
}

const ACCOUNT_OWNER_SUBJECT_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;

function assertActiveAccountDeletionPreflight(response, expectedOwnerSubject) {
  assert(
    response.status === 200 &&
      exactObjectKeys(response.body, ['status', 'ownerSubject']) &&
      response.body.status === 'active' &&
      typeof response.body.ownerSubject === 'string' &&
      ACCOUNT_OWNER_SUBJECT_PATTERN.test(response.body.ownerSubject) &&
      response.body.ownerSubject === expectedOwnerSubject,
    'account-deletion did not return the exact authenticated active-owner preflight contract.',
  );
}

function parseAccountDeletionStatus(response) {
  if (response.status === 200) {
    const hasNotice = Object.hasOwn(response.body, 'notice');
    assert(
      exactObjectKeys(response.body, hasNotice ? ['status', 'notice'] : ['status']) &&
        response.body.status === 'completed' &&
        (!hasNotice || response.body.notice === 'remove_apple_authorization'),
      'account-deletion returned an invalid completed receipt.',
    );
    return {
      kind: 'completed',
      httpStatus: 200,
      notice: hasNotice ? response.body.notice : null,
    };
  }
  if (response.status === 202) {
    assert(
      exactObjectKeys(response.body, ['status', 'phase', 'nextPollAfterSeconds']) &&
        (response.body.status === 'pending' || response.body.status === 'delayed') &&
        ['queued', 'processing', 'local_erasing', 'provider_verifying', 'delayed'].includes(
          response.body.phase,
        ) &&
        (response.body.status === 'delayed') === (response.body.phase === 'delayed') &&
        Number.isSafeInteger(response.body.nextPollAfterSeconds) &&
        response.body.nextPollAfterSeconds >= 2 &&
        response.body.nextPollAfterSeconds <= 60,
      'account-deletion returned an invalid pending receipt.',
    );
    return {
      kind: 'pending',
      httpStatus: 202,
      phase: response.body.phase,
      nextPollAfterSeconds: response.body.nextPollAfterSeconds,
    };
  }
  if (
    response.status === 404 &&
    exactObjectKeys(response.body, ['status']) &&
    response.body.status === 'invalid'
  ) {
    return { kind: 'invalid', httpStatus: 404 };
  }
  if (
    response.status === 410 &&
    exactObjectKeys(response.body, ['status']) &&
    response.body.status === 'expired'
  ) {
    return { kind: 'expired', httpStatus: 410 };
  }
  throw new HarnessAssertionError(
    `account-deletion status returned an unexpected HTTP/body contract (${response.status}).`,
  );
}

async function pollAccountDeletionToTerminal(admin, userId, capability, firstPollAfterSeconds) {
  const deadlineAt = Date.now() + accountDeletionPollTimeoutSeconds * 1000;
  let nextPollAfterSeconds = firstPollAfterSeconds;
  let authAbsent = false;

  for (let poll = 1; poll <= accountDeletionMaxPolls; poll += 1) {
    const delayMs = nextPollAfterSeconds * 1000;
    assert(
      Date.now() + delayMs <= deadlineAt,
      'account-deletion polling reached its configured wall-clock deadline.',
    );
    await wait(delayMs);

    const outcome = parseAccountDeletionStatus(await postAccountDeletionStatus(capability));
    if (!(await userExists(admin, userId))) authAbsent = true;

    if (outcome.kind === 'completed') {
      assert(
        authAbsent,
        'completed deletion receipt was returned while the Auth user still existed.',
      );

      // A second capability-only request after exact Auth absence proves that
      // the finite terminal receipt survives the account/JWT boundary.
      const replay = parseAccountDeletionStatus(await postAccountDeletionStatus(capability));
      assert(
        replay.kind === 'completed' && replay.notice === outcome.notice,
        'post-Auth capability replay did not return the same completed receipt.',
      );
      const terminal = {
        ...outcome,
        polls: poll + 1,
        authAbsent: true,
        postAuthReceiptReplay: true,
      };
      samples.push({
        scope: 'account-deletion',
        polls: terminal.polls,
        terminalHttpStatus: terminal.httpStatus,
        authAbsent: terminal.authAbsent,
        postAuthReceiptReplay: terminal.postAuthReceiptReplay,
      });
      return terminal;
    }
    if (outcome.kind === 'expired' || outcome.kind === 'invalid') {
      samples.push({
        scope: 'account-deletion',
        polls: poll,
        terminalHttpStatus: outcome.httpStatus,
        authAbsent,
        postAuthReceiptReplay: false,
      });
      return { ...outcome, polls: poll, authAbsent, postAuthReceiptReplay: false };
    }
    nextPollAfterSeconds = outcome.nextPollAfterSeconds;
  }

  throw new HarnessAssertionError('account-deletion polling reached its configured poll limit.');
}

function assertLocalPhotoExportDisclosure(bundle) {
  assert(
    typeof bundle?.local_only_photo_note === 'string' &&
      bundle.local_only_photo_note.includes(
        'Progress photo files and thumbnails are not included in this account export.',
      ) &&
      bundle.local_only_photo_note.includes('cloud backup is unavailable.'),
    'data-export is missing the current device-only Progress-photo exclusion note.',
  );
  const localDeviceExclusion = rows(bundle, 'exclusion_register').find(
    (entry) => entry?.data_class === 'local_device_files',
  );
  assert(
    typeof localDeviceExclusion?.reason === 'string' &&
      localDeviceExclusion.reason.includes(
        'Any server-side photo metadata rows are exported separately in photos.',
      ),
    'data-export does not distinguish device-only photo files from server-side photo metadata.',
  );
  const lifecycle = bundle?.health_consent_lifecycle;
  assert(
    lifecycle &&
      typeof lifecycle === 'object' &&
      ['unconsented', 'active', 'withdrawn'].includes(lifecycle.state) &&
      Number.isSafeInteger(lifecycle.processing_epoch) &&
      lifecycle.processing_epoch >= 0 &&
      !Object.hasOwn(lifecycle, 'operation_id') &&
      typeof lifecycle.server_verified_at === 'string' &&
      !Number.isNaN(Date.parse(lifecycle.server_verified_at)),
    'data-export is missing a sanitized terminal/active health lifecycle status.',
  );
  const lifecycleManifest = bundle?.manifest?.sources?.health_consent_lifecycle;
  assert(
    lifecycleManifest?.kind === 'derived' &&
      lifecycleManifest?.count === 1 &&
      lifecycleManifest?.complete === true &&
      /^sha256:[a-f0-9]{64}$/.test(lifecycleManifest?.checksum ?? ''),
    'data-export health lifecycle manifest is incomplete.',
  );
}

function assertDataExportRateLimited(response) {
  const body = parseJson(response.text);
  assert(response.status === 429, `data-export expected HTTP 429, got ${response.status}.`);
  assert(body?.error === 'RATE_LIMITED', 'data-export expected stable RATE_LIMITED body.');
  assert(
    /^\d+$/.test(response.retryAfter ?? ''),
    'data-export expected numeric Retry-After header.',
  );
}

async function assertSignedUrlExpiry(url) {
  const before = await fetch(url);
  assert(
    before.ok,
    `data-export photo signed URL was not downloadable before expiry; status ${before.status}.`,
  );
  await before.arrayBuffer();

  await wait(signedUrlExpiryWaitSeconds * 1000);

  const after = await fetch(url);
  if (after.body) await after.body.cancel().catch(() => {});
  assert(
    !after.ok,
    `data-export photo signed URL was still downloadable after ${signedUrlExpiryWaitSeconds}s; status ${after.status}.`,
  );
  samples.push({
    scope: 'data-export-photo-url-expiry',
    ttlSeconds: dataExportPhotoUrlTtlSeconds,
    waitSeconds: signedUrlExpiryWaitSeconds,
    beforeStatus: before.status,
    afterStatus: after.status,
  });
}

async function exhaustDataExportRateLimit(user) {
  for (let attempt = 1; attempt <= dataExportProbeBudget; attempt += 1) {
    const response = await postDataExport(user.token);
    if (response.status === 429) {
      assertDataExportRateLimited(response);
      return { attempts: attempt, retryAfter: response.retryAfter };
    }

    const body = parseJson(response.text);
    assert(
      response.status === 200,
      `data-export before limit expected 200, got ${response.status}.`,
    );
    assert(body?.user_id === user.id, 'data-export before limit returned the wrong user_id.');
    assert(
      body?.export_schema_version === 3,
      'data-export before limit returned the wrong export schema version.',
    );
    assertLocalPhotoExportDisclosure(body);
  }
  throw new Error(
    `data-export did not return 429 within ${dataExportProbeBudget} attempts; check deployed DATA_EXPORT_RATE_LIMIT_MAX.`,
  );
}

function keyHashFor(scope, userId) {
  return createHmac('sha256', secretKey).update(`${scope}|${userId}`).digest('hex');
}

function accountDeletionStatusRateLimitKey(capability) {
  return createHash('sha256')
    .update(`onskin-account-deletion-status-capability:v1:${capability}`)
    .digest('hex');
}

async function assertDataExportLimiterRow(admin, userId, attempts) {
  const keyHash = keyHashFor('data-export', userId);
  const { data, error } = await admin
    .from('edge_rate_limits')
    .select('scope,key_hash,window_seconds,request_count,updated_at')
    .eq('scope', 'data-export')
    .eq('key_hash', keyHash)
    .order('updated_at', { ascending: false })
    .limit(1);
  if (error) throw error;
  const row = data?.[0];
  assert(row, 'data-export: expected an edge_rate_limits row for the synthetic data-rights user.');
  assert(
    /^[a-f0-9]{64}$/.test(row.key_hash),
    'data-export: key_hash is not a 64-character lowercase hex digest.',
  );
  assert(
    !JSON.stringify(row).includes(userId),
    'data-export: edge_rate_limits row contains the raw user id.',
  );
  assert(
    row.request_count >= attempts,
    `data-export: request_count ${row.request_count} is lower than probe attempts ${attempts}.`,
  );
  assert(
    row.request_count >= dataExportRateLimitMax + 1,
    'data-export: request count did not exceed the configured max.',
  );
  assert(row.window_seconds >= 60, 'data-export: window_seconds must be at least 60.');
  samples.push({
    scope: 'data-export',
    keyHashRedacted: `${row.key_hash.slice(0, 8)}...${row.key_hash.slice(-4)}`,
    keyHashLength: row.key_hash.length,
    requestCount: row.request_count,
    windowSeconds: row.window_seconds,
  });
}

async function main() {
  if (!runLive) {
    warnings.push(
      'Live data-rights harness not run; set PHASE9_RUN_LIVE_DATA_RIGHTS=true with staging credentials.',
    );
    writeArtifacts('not-run');
    printResult('Phase 9 live data rights', errors, warnings);
    return;
  }

  block(
    errors,
    env.APP_ENV === 'staging',
    'Live data-rights requires the exact server-side APP_ENV=staging contract.',
  );
  block(
    errors,
    appEnv === 'staging',
    'Live data-rights requires the effective app environment to be staging.',
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
    allowDestructiveAccountDeletion,
    'Refusing the live durable account-deletion run without PHASE9_ALLOW_DESTRUCTIVE_ACCOUNT_DELETION=true.',
  );
  block(
    errors,
    dataExportProbeBudget > dataExportRateLimitMax,
    'PHASE9_DATA_EXPORT_RATE_LIMIT_PROBE_MAX must be greater than DATA_EXPORT_RATE_LIMIT_MAX.',
  );
  if (runSignedUrlExpiryCheck) {
    block(
      errors,
      dataExportPhotoUrlTtlSeconds <= 120,
      'DATA_EXPORT_PHOTO_URL_TTL_SECONDS must be 120 or lower for the live signed URL expiry check.',
    );
    block(
      errors,
      signedUrlExpiryWaitSeconds > dataExportPhotoUrlTtlSeconds,
      'PHASE9_DATA_EXPORT_SIGNED_URL_EXPIRY_WAIT_SECONDS must be greater than DATA_EXPORT_PHOTO_URL_TTL_SECONDS.',
    );
  }
  block(
    errors,
    Boolean(evidenceContext.sourceSha),
    'Live data-rights evidence requires an exact 40-character PHASE9_EVIDENCE_SOURCE_SHA or GITHUB_SHA.',
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
    'GitHub live data-rights evidence requires exact workflow run, attempt, and ref metadata.',
  );
  block(
    errors,
    evidenceContext.invalidBuildIds.length === 0,
    `Live data-rights evidence rejected invalid build identifiers: ${evidenceContext.invalidBuildIds.join(', ')}.`,
  );
  if (errors.length > 0) {
    writeArtifacts('fail');
    printResult('Phase 9 live data rights', errors, warnings);
    return;
  }

  const admin = createClient(supabaseUrl, secretKey, {
    auth: { autoRefreshToken: false, persistSession: false, detectSessionInUrl: false },
  });
  const users = [];
  const storagePaths = [];
  const externalOrderIds = [];
  const subscriptionEventIds = [];
  const accountDeletionRateLimitKeys = [];

  try {
    const userA = await createLiveUser(admin, 'a', (user) => users.push(user));
    const userB = await createLiveUser(admin, 'b', (user) => users.push(user));
    let callerPhotoSignedUrl = null;

    const seed = async (user, label) => {
      await upsertOne(user.client, 'profiles', {
        id: user.id,
        display_name: `Phase 9 Data ${label}`,
        units: 'metric',
      });
      const healthConsentVersion = 'draft-v1-2026-07-10';
      const healthConsentHash =
        '7957a2811fff0e8cefc6f7180b751ec45688fe99421978eedae05b96c2f251fd';
      const { data: consentRows, error: consentError } = await user.client.rpc(
        'grant_health_data_consent',
        {
          p_expected_epoch: 0,
          p_version: healthConsentVersion,
          p_consent_text_hash: healthConsentHash,
        },
      );
      if (consentError) throw consentError;
      const consent = Array.isArray(consentRows) ? consentRows[0] : null;
      assert(
        consent?.user_id === user.id && consent?.state === 'active' && consent?.epoch === 1,
        `health consent activation failed for ${label}.`,
      );
      const skinProfile = await insertOne(user.client, 'skin_profiles', {
        user_id: user.id,
        oily_dry: label === 'a' ? 1 : 2,
        sensitive_resistant: 2,
        fitzpatrick: 3,
        goals: [`phase9-data-${label}`],
        completed_at: new Date().toISOString(),
      });
      const product = await insertOne(user.client, 'user_products', {
        user_id: user.id,
        manual_name: `Phase 9 ${label} Cleanser`,
        manual_brand: 'Data Rights Smoke',
        opened_at: new Date().toISOString().slice(0, 10),
        pao_months: 12,
      });
      const routine = await insertOne(user.client, 'routines', {
        user_id: user.id,
        type: 'AM',
        name: `Phase 9 ${label} AM`,
      });
      const step = await insertOne(user.client, 'routine_steps', {
        routine_id: routine.id,
        user_product_id: product.id,
        step_order: 1,
        frequency: 'daily',
        instructions: `Phase 9 ${label} step`,
      });
      await insertOne(user.client, 'consents', {
        user_id: user.id,
        consent_type: 'photo_cloud_backup',
        granted: true,
        version: `phase9-data-${label}`,
        consent_text_hash: healthConsentHash,
      });
      await insertOne(user.client, 'consents', {
        user_id: user.id,
        consent_type: 'data_sharing',
        granted: true,
        version: `phase9-data-${label}`,
        consent_text_hash: healthConsentHash,
      });
      const completion = await insertOne(user.client, 'routine_completions', {
        user_id: user.id,
        routine_id: routine.id,
        step_id: step.id,
        completed_date: new Date().toISOString().slice(0, 10),
      });

      const photoPath = `${user.id}/e1/phase9-data-${label}-${randomUUID()}.bin`;
      storagePaths.push(photoPath);
      const upload = await user.client.storage
        .from('photos')
        .upload(photoPath, new Blob([`phase9 data rights ${label}`]), {
          contentType: 'application/octet-stream',
          upsert: false,
        });
      if (upload.error) throw upload.error;
      const photo = await insertOne(user.client, 'photos', {
        user_id: user.id,
        storage_path: photoPath,
        local_only: false,
        face_region_redacted: true,
      });

      const clickToken = `phase9-data-${label}-${randomUUID()}`;
      const click = await insertOne(user.client, 'commerce_click_events', {
        user_id: user.id,
        click_token: clickToken,
        product_type: 'cleanser',
        source: 'direct',
        consented: true,
      });
      const externalOrderId = `phase9-data-${label}-${randomUUID()}`;
      externalOrderIds.push(externalOrderId);
      const orderWrite = await admin.from('order_attributions').insert({
        external_order_id: externalOrderId,
        click_token: clickToken,
        order_amount_cents: 1299,
        commission_cents: 123,
        currency: 'USD',
        status: 'locked',
        transaction_date: new Date().toISOString(),
        record_updated_at: new Date().toISOString(),
      });
      if (orderWrite.error) throw orderWrite.error;

      const grantExpiresAt = new Date(Date.now() + 7 * 86_400_000).toISOString();
      const { error: grantError } = await admin.rpc('grant_app_granted_reverse_trial', {
        p_user_id: user.id,
        p_expires_at: grantExpiresAt,
        p_environment: appEnv === 'production' ? 'production' : 'development',
      });
      if (grantError) throw grantError;
      const { data: reverseTrialGrant, error: reverseTrialGrantError } = await admin
        .from('reverse_trial_grants')
        .select('user_id, granted_at, expires_at, source, metadata')
        .eq('user_id', user.id)
        .single();
      if (reverseTrialGrantError) throw reverseTrialGrantError;

      const snapshotAt = new Date();
      const { error: entitlementError } = await admin.rpc(
        'reconcile_revenuecat_entitlement_snapshot',
        {
          p_user_id: user.id,
          p_snapshot_at: snapshotAt.toISOString(),
          p_entitlement: 'pro',
          p_is_active: false,
          p_product_id: `phase9_data_${label}`,
          p_expires_at: new Date(snapshotAt.getTime() - 3_600_000).toISOString(),
          p_store: 'app_store',
          p_period_type: 'normal',
          p_will_renew: false,
          p_original_purchase_at: new Date(snapshotAt.getTime() - 30 * 86_400_000).toISOString(),
          p_offering_id: null,
          p_environment: 'sandbox',
          p_management_url: null,
          p_package_id: null,
        },
      );
      if (entitlementError) throw entitlementError;

      return {
        skinProfile,
        product,
        routine,
        step,
        consent,
        completion,
        photo,
        click,
        clickToken,
        externalOrderId,
        reverseTrialGrant,
      };
    };

    const seededA = await seed(userA, 'a');
    const seededB = await seed(userB, 'b');

    const seedSubscriptionEvent = async (label, identities) => {
      const now = new Date().toISOString();
      const event = await insertOne(admin, 'subscriptions_events', {
        rc_event_id: `phase9-data-rights-${label}-${randomUUID()}`,
        event_type: 'PHASE9_DATA_RIGHTS_FIXTURE',
        payload: { fixture: label, ingress_shape: 'sanitized' },
        received_at: now,
        environment: 'sandbox',
        store: 'app_store',
        product_id: 'phase9_data_rights_fixture',
        processed_at: now,
        processing_status: 'processed',
        signature_verified: true,
        auth_verified: true,
        provider_event_at: now,
        projection_applied: false,
        processing_attempts: 1,
        ...identities,
      });
      subscriptionEventIds.push(event.id);
      return event;
    };

    // The 0046 root/payload.event legacy sanitizer is a deployment-time
    // backfill and is covered by the migration contract test. These live rows
    // use the current sanitized ingress shape so the harness never recreates a
    // forbidden legacy payload after the migration has already run.
    const subscriptionFixtures = {
      aOnlyScalar: await seedSubscriptionEvent('a-only-scalar', {
        user_id: userA.id,
        resolved_user_id: userA.id,
        app_user_id: userA.id,
        original_app_user_id: userA.id,
      }),
      aliasOnly: await seedSubscriptionEvent('a-only-alias', {
        aliases: [userA.id],
      }),
      transferOnly: await seedSubscriptionEvent('a-only-transfer', {
        transferred_from: [userA.id],
        transferred_to: [userA.id],
      }),
      repeatedA: await seedSubscriptionEvent('repeated-a-shared', {
        resolved_user_id: userB.id,
        aliases: [userA.id, 'repeat-alias-1', userA.id, userB.id, userA.id, 'repeat-alias-2'],
        transferred_from: [userA.id, userA.id, 'repeat-from', userB.id, userA.id],
        transferred_to: ['repeat-to', userA.id, userB.id, userA.id, userA.id],
      }),
      sharedAB: await seedSubscriptionEvent('shared-a-b', {
        user_id: userA.id,
        resolved_user_id: userB.id,
        app_user_id: userA.id,
        original_app_user_id: userB.id,
        aliases: ['shared-alias-before', userA.id, userB.id, userA.id, 'shared-alias-after'],
        transferred_from: [userB.id, 'shared-from-before', userA.id, 'shared-from-after'],
        transferred_to: ['shared-to-before', userA.id, userB.id, 'shared-to-after', userA.id],
      }),
      bOnly: await seedSubscriptionEvent('b-only', {
        user_id: userB.id,
        resolved_user_id: userB.id,
        app_user_id: userB.id,
        original_app_user_id: userB.id,
        aliases: ['b-alias-before', userB.id, 'b-alias-after'],
        transferred_from: [userB.id, 'b-from-after'],
        transferred_to: ['b-to-before', userB.id],
      }),
    };
    const bOnlySubscriptionSnapshot = JSON.stringify(
      await subscriptionEventById(
        admin,
        subscriptionFixtures.bOnly.id,
        'B-only pre-deletion snapshot',
      ),
    );
    const providerAuditEventPrefix = `account_deletion_${createHash('sha256')
      .update(userA.id)
      .digest('base64url')
      .slice(0, 20)}_`;

    const malformedPhoto = await insertOne(
      admin,
      'photos',
      {
        user_id: userA.id,
        storage_path: seededB.photo.storage_path,
        local_only: false,
        face_region_redacted: true,
      },
      'id, user_id, storage_path',
    );

    await runCheck('data-export returns only caller data and safe service-role rows', async () => {
      const { data, error } = await userA.client.functions.invoke('data-export', {
        method: 'POST',
        body: { user_id: userB.id },
      });
      if (error) throw error;
      assert(data && typeof data === 'object', 'data-export did not return a JSON bundle.');
      assert(data.user_id === userA.id, 'data-export returned the wrong user_id.');
      assert(data.export_schema_version === 3, 'data-export schema version mismatch.');
      assertLocalPhotoExportDisclosure(data);

      expectBundleHasOnlyUser(data, 'skin_profiles', 'user_id', userA.id, userB.id);
      expectBundleHasOnlyUser(data, 'user_products', 'user_id', userA.id, userB.id);
      expectBundleHasOnlyUser(data, 'routines', 'user_id', userA.id, userB.id);
      expectBundleHasOnlyUser(data, 'routine_completions', 'user_id', userA.id, userB.id);
      expectBundleHasOnlyUser(data, 'consents', 'user_id', userA.id, userB.id);
      expectBundleHasOnlyUser(data, 'photos', 'user_id', userA.id, userB.id);
      expectBundleHasOnlyUser(data, 'commerce_click_events', 'user_id', userA.id, userB.id);
      expectBundleHasOnlyUser(data, 'entitlements', 'user_id', userA.id, userB.id);
      expectBundleHasOnlyUser(data, 'reverse_trial_grants', 'user_id', userA.id, userB.id);

      const reverseTrialRows = rows(data, 'reverse_trial_grants');
      assert(
        reverseTrialRows.length === 1,
        'export returned an unexpected reverse-trial row count.',
      );
      assert(
        reverseTrialRows[0]?.granted_at === seededA.reverseTrialGrant.granted_at,
        'export returned the wrong caller reverse-trial grant.',
      );
      assert(
        Object.keys(reverseTrialRows[0] ?? {}).every((key) =>
          ['user_id', 'granted_at', 'expires_at', 'source', 'metadata'].includes(key),
        ),
        'reverse-trial export returned a non-allowlisted column.',
      );
      const reverseTrialManifest = data.manifest?.sources?.reverse_trial_grants;
      assert(
        reverseTrialManifest?.scope === 'service_role_filtered' &&
          reverseTrialManifest.complete === true &&
          reverseTrialManifest.count === 1 &&
          reverseTrialManifest.count_before === 1 &&
          reverseTrialManifest.count_after === 1 &&
          /^sha256:[a-f0-9]{64}$/.test(reverseTrialManifest.checksum),
        'reverse-trial export manifest is incomplete or misclassified.',
      );
      assert(
        !data.export_coverage?.caller_rls_tables?.includes('reverse_trial_grants') &&
          data.export_coverage?.service_role_filtered_exports?.filter(
            (table) => table === 'reverse_trial_grants',
          ).length === 1,
        'reverse-trial export coverage is incomplete, duplicated, or misclassified.',
      );

      const subscriptionRows = rows(data, 'subscriptions_events');
      const expectedCallerSubscriptionIds = [
        subscriptionFixtures.aOnlyScalar.id,
        subscriptionFixtures.aliasOnly.id,
        subscriptionFixtures.transferOnly.id,
        subscriptionFixtures.repeatedA.id,
        subscriptionFixtures.sharedAB.id,
      ];
      for (const id of expectedCallerSubscriptionIds) {
        assert(
          subscriptionRows.some((row) => row.id === id),
          'subscription-event export omitted a caller-linked service row.',
        );
      }
      assert(
        !subscriptionRows.some((row) => row.id === subscriptionFixtures.bOnly.id),
        'subscription-event export leaked a B-only service row.',
      );
      const forbiddenSubscriptionExportFields = [...subscriptionIdentityFields, 'payload'];
      assert(
        subscriptionRows.every((row) =>
          forbiddenSubscriptionExportFields.every((field) => !Object.hasOwn(row, field)),
        ),
        'subscription-event export returned an identity or payload field.',
      );
      const subscriptionManifest = data.manifest?.sources?.subscriptions_events;
      assert(
        subscriptionManifest?.scope === 'service_role_filtered' &&
          subscriptionManifest.complete === true &&
          subscriptionManifest.count === subscriptionRows.length &&
          subscriptionManifest.count_before === subscriptionRows.length &&
          subscriptionManifest.count_after === subscriptionRows.length &&
          /^sha256:[a-f0-9]{64}$/.test(subscriptionManifest.checksum),
        'subscription-event export manifest is incomplete or misclassified.',
      );

      const orderRows = rows(data, 'order_attributions');
      assert(
        orderRows.some((row) => row.external_order_id === seededA.externalOrderId),
        'export missing caller order attribution.',
      );
      assert(
        !orderRows.some((row) => row.external_order_id === seededB.externalOrderId),
        'export leaked another user order attribution.',
      );
      assert(
        orderRows.every((row) => !Object.hasOwn(row, 'commission_cents')),
        'export leaked commission_cents.',
      );

      const photoUrls = rows(data, 'photo_download_urls');
      const callerPhotoUrl = photoUrls.find(
        (row) => row.id === seededA.photo.id && typeof row.url === 'string',
      );
      assert(callerPhotoUrl, 'export missing caller photo signed URL.');
      callerPhotoSignedUrl = callerPhotoUrl.url;
      assert(
        !photoUrls.some((row) => row.id === seededB.photo.id),
        'export leaked another user photo signed URL.',
      );
      assert(
        !photoUrls.some((row) => row.id === malformedPhoto.id),
        'export signed a malformed cross-user photo path.',
      );
      const photoUrlOmissions = rows(data, 'photo_download_url_omissions');
      assert(
        photoUrlOmissions.some(
          (row) => row.id === malformedPhoto.id && row.reason === 'INVALID_STORAGE_PATH',
        ),
        'export did not record omission for malformed cross-user photo path.',
      );
    });

    if (runSignedUrlExpiryCheck) {
      await runCheck('data-export photo signed URLs expire after configured TTL', async () => {
        assert(
          callerPhotoSignedUrl,
          'data-export did not capture a caller photo signed URL for expiry verification.',
        );
        await assertSignedUrlExpiry(callerPhotoSignedUrl);
      });
    } else {
      warnings.push(
        'Live data-export signed URL expiry evidence not run; set PHASE9_DATA_EXPORT_SIGNED_URL_EXPIRY_CHECK=true with a short staging DATA_EXPORT_PHOTO_URL_TTL_SECONDS.',
      );
    }

    await runCheck('data-export returns 429 after configured data-rights rate limit', async () => {
      const result = await exhaustDataExportRateLimit(userA);
      await assertDataExportLimiterRow(admin, userA.id, result.attempts);
    });

    await runCheck('edge_rate_limits stores keyed hashes only for data-export scope', async () => {
      const rateLimitSamples = samples.filter((sample) => sample.scope === 'data-export');
      assert(
        rateLimitSamples.length === 1,
        `expected one redacted data-export limiter sample, found ${rateLimitSamples.length}.`,
      );
      const sample = rateLimitSamples[0];
      assert(sample.scope === 'data-export', `unexpected limiter scope ${sample.scope}.`);
      assert(sample.keyHashLength === 64, 'data-export: key hash length must be 64.');
      assert(
        !sample.keyHashRedacted.includes(userA.id),
        'data-export: redacted hash includes raw user id.',
      );
      assert(
        sample.requestCount >= dataExportRateLimitMax + 1,
        'data-export: request count did not exceed configured max.',
      );
    });

    const deletionRequest = {
      action: 'begin',
      idempotencyKey: accountDeletionToken(),
      statusCapability: accountDeletionToken(),
    };
    accountDeletionRateLimitKeys.push({
      scope: 'account-deletion-status',
      keyHash: accountDeletionStatusRateLimitKey(deletionRequest.statusCapability),
    });
    assert(
      ACCOUNT_DELETION_TOKEN_PATTERN.test(deletionRequest.idempotencyKey) &&
        ACCOUNT_DELETION_TOKEN_PATTERN.test(deletionRequest.statusCapability) &&
        deletionRequest.idempotencyKey !== deletionRequest.statusCapability,
      'account-deletion harness did not generate independent 256-bit intake secrets.',
    );
    let acceptedDeletion = null;
    let terminalDeletion = null;
    let deletionBeginDispatched = false;
    let activeDeletionBarrierAttested = false;

    await runCheck('account-deletion accepts an authenticated durable begin request', async () => {
      // Once dispatch starts, even a lost response may follow a committed
      // intake. The next check must use the pre-generated capability either way.
      deletionBeginDispatched = true;
      const response = await postAccountDeletionBegin(userA.token, deletionRequest);
      acceptedDeletion = parseAccountDeletionBegin(response);
    });

    await runCheck(
      'account-deletion active preflight binds the same authenticated owner before Auth deletion',
      async () => {
        const response = await postAccountDeletionPreflight(userA.token);
        assertActiveAccountDeletionPreflight(response, userA.id);
        activeDeletionBarrierAttested = true;
      },
    );

    await runCheck(
      'capability-only account-deletion polling crosses Auth deletion and reaches a finite receipt',
      async () => {
        assert(
          deletionBeginDispatched,
          'account-deletion begin was never dispatched; status polling was not run.',
        );
        assert(
          activeDeletionBarrierAttested,
          'active owner-bound preflight was not attested before status polling.',
        );
        terminalDeletion = await pollAccountDeletionToTerminal(
          admin,
          userA.id,
          deletionRequest.statusCapability,
          acceptedDeletion?.nextPollAfterSeconds ?? 2,
        );
        assert(
          terminalDeletion.kind === 'completed',
          terminalDeletion.kind === 'expired'
            ? 'account-deletion capability returned the exact terminal 410 expired contract before completion could be proven.'
            : 'account-deletion capability did not return a completed terminal receipt.',
        );
      },
    );

    await runCheck(
      'completed account-deletion receipt gates caller erasure and other-user isolation checks',
      async () => {
        assert(
          terminalDeletion?.kind === 'completed' &&
            terminalDeletion.httpStatus === 200 &&
            terminalDeletion.authAbsent === true &&
            terminalDeletion.postAuthReceiptReplay === true,
          'residual checks are forbidden until terminal HTTP 200 completion is attested after Auth deletion.',
        );

        assert(!(await userExists(admin, userA.id)), 'deleted user still exists in auth.');
        assert(await userExists(admin, userB.id), 'account-deletion removed the wrong user.');

        await expectAdminRows(admin, 'profiles', 'id', userA.id, 0, 'deleted profile');
        await expectAdminRows(
          admin,
          'skin_profiles',
          'user_id',
          userA.id,
          0,
          'deleted skin profile',
        );
        await expectAdminRows(admin, 'user_products', 'user_id', userA.id, 0, 'deleted shelf');
        await expectAdminRows(admin, 'routines', 'user_id', userA.id, 0, 'deleted routine');
        await expectAdminRows(
          admin,
          'routine_completions',
          'user_id',
          userA.id,
          0,
          'deleted completion',
        );
        await expectAdminRows(admin, 'consents', 'user_id', userA.id, 0, 'deleted consent');
        await expectAdminRows(admin, 'photos', 'user_id', userA.id, 0, 'deleted photo metadata');
        await expectAdminRows(
          admin,
          'edge_rate_limits',
          'owner_user_id',
          userA.id,
          0,
          'deleted owner rate limits',
        );
        await expectAdminRows(
          admin,
          'commerce_click_events',
          'user_id',
          userA.id,
          0,
          'deleted commerce click',
        );
        await expectAdminRows(admin, 'entitlements', 'user_id', userA.id, 0, 'deleted entitlement');
        await expectAdminRows(
          admin,
          'reverse_trial_grants',
          'user_id',
          userA.id,
          0,
          'deleted reverse-trial grant',
        );

        await expectAdminRows(admin, 'profiles', 'id', userB.id, 1, 'other user profile retained');
        await expectAdminRows(
          admin,
          'skin_profiles',
          'id',
          seededB.skinProfile.id,
          1,
          'other user skin profile retained',
        );
        await expectAdminRows(
          admin,
          'photos',
          'id',
          seededB.photo.id,
          1,
          'other user photo metadata retained',
        );
        await expectAdminRows(
          admin,
          'reverse_trial_grants',
          'user_id',
          userB.id,
          1,
          'other user reverse-trial grant retained',
        );

        const accountOnlySubscriptionIds = [
          subscriptionFixtures.aOnlyScalar.id,
          subscriptionFixtures.aliasOnly.id,
          subscriptionFixtures.transferOnly.id,
        ];
        const { data: accountOnlyEvents, error: accountOnlyEventsError } = await admin
          .from('subscriptions_events')
          .select('id')
          .in('id', accountOnlySubscriptionIds);
        if (accountOnlyEventsError) throw accountOnlyEventsError;
        assert(
          (accountOnlyEvents ?? []).length === 0,
          'account-deletion retained an account-only subscription event.',
        );

        const repeatedAEvent = await subscriptionEventById(
          admin,
          subscriptionFixtures.repeatedA.id,
          'repeated-A shared event retained',
        );
        assertNoSubscriptionIdentity(repeatedAEvent, userA.id, 'repeated-A shared event');
        assert(
          subscriptionEventContainsIdentity(repeatedAEvent, userB.id),
          'repeated-A shared event lost the retained B owner.',
        );
        assertExactArray(
          repeatedAEvent.aliases,
          ['repeat-alias-1', userB.id, 'repeat-alias-2'],
          'repeated-A aliases',
        );
        assertExactArray(
          repeatedAEvent.transferred_from,
          ['repeat-from', userB.id],
          'repeated-A transferred_from',
        );
        assertExactArray(
          repeatedAEvent.transferred_to,
          ['repeat-to', userB.id],
          'repeated-A transferred_to',
        );

        const sharedEvent = await subscriptionEventById(
          admin,
          subscriptionFixtures.sharedAB.id,
          'shared A/B event retained',
        );
        assertNoSubscriptionIdentity(sharedEvent, userA.id, 'shared A/B event');
        assert(
          sharedEvent.user_id === null &&
            sharedEvent.resolved_user_id === userB.id &&
            sharedEvent.app_user_id === null &&
            sharedEvent.original_app_user_id === userB.id,
          'shared A/B event did not preserve only the expected scalar B owners.',
        );
        assertExactArray(
          sharedEvent.aliases,
          ['shared-alias-before', userB.id, 'shared-alias-after'],
          'shared A/B aliases',
        );
        assertExactArray(
          sharedEvent.transferred_from,
          [userB.id, 'shared-from-before', 'shared-from-after'],
          'shared A/B transferred_from',
        );
        assertExactArray(
          sharedEvent.transferred_to,
          ['shared-to-before', userB.id, 'shared-to-after'],
          'shared A/B transferred_to',
        );

        const bOnlyAfterDeletion = await subscriptionEventById(
          admin,
          subscriptionFixtures.bOnly.id,
          'B-only post-deletion snapshot',
        );
        assert(
          JSON.stringify(bOnlyAfterDeletion) === bOnlySubscriptionSnapshot,
          'account-deletion changed the byte-equivalent B-only subscription snapshot.',
        );

        const { data: providerAuditEvents, error: providerAuditEventsError } = await admin
          .from('subscriptions_events')
          .select('id')
          .like('rc_event_id', `${providerAuditEventPrefix}%`);
        if (providerAuditEventsError) throw providerAuditEventsError;
        for (const event of providerAuditEvents ?? []) subscriptionEventIds.push(event.id);
        assert(
          (providerAuditEvents ?? []).length === 0,
          'account-deletion created a synthetic provider audit subscription row.',
        );

        const ownerPhoto = await admin.storage.from('photos').download(seededA.photo.storage_path);
        assert(
          storageObjectMissing(ownerPhoto.error),
          'deleted user photo object absence was not proven by an exact not-found result.',
        );
        const otherPhoto = await admin.storage.from('photos').download(seededB.photo.storage_path);
        if (otherPhoto.error)
          throw new Error('account-deletion removed another user photo object.');

        const { data: ownerOrder, error: ownerOrderError } = await admin
          .from('order_attributions')
          .select('click_token')
          .eq('external_order_id', seededA.externalOrderId)
          .single();
        if (ownerOrderError) throw ownerOrderError;
        assert(
          ownerOrder.click_token === null,
          'deleted user order attribution click token was not scrubbed.',
        );

        const { data: otherOrder, error: otherOrderError } = await admin
          .from('order_attributions')
          .select('click_token')
          .eq('external_order_id', seededB.externalOrderId)
          .single();
        if (otherOrderError) throw otherOrderError;
        assert(
          otherOrder.click_token === seededB.clickToken,
          'account-deletion scrubbed another user order attribution.',
        );
      },
    );
  } finally {
    if (storagePaths.length > 0) {
      const { error } = await admin.storage.from('photos').remove(storagePaths);
      if (error) errors.push(`Storage cleanup failed: ${redactedErrorKind(error)}`);
      for (const path of storagePaths) {
        const remaining = await admin.storage.from('photos').download(path);
        if (!remaining.error) errors.push('Storage cleanup left a residual object.');
        else if (!storageObjectMissing(remaining.error)) {
          errors.push(`Storage cleanup verification failed: ${redactedErrorKind(remaining.error)}`);
        }
      }
    }
    for (const externalOrderId of externalOrderIds) {
      const { error } = await admin
        .from('order_attributions')
        .delete()
        .eq('external_order_id', externalOrderId);
      if (error) {
        errors.push(`Order cleanup failed: ${redactedErrorKind(error)}`);
        continue;
      }
      const { count, error: verifyError } = await admin
        .from('order_attributions')
        .select('*', { count: 'exact', head: true })
        .eq('external_order_id', externalOrderId);
      if (verifyError)
        errors.push(`Order cleanup verification failed: ${redactedErrorKind(verifyError)}`);
      else if (count !== 0) errors.push('Order cleanup left a residual row.');
    }
    const trackedSubscriptionEventIds = [...new Set(subscriptionEventIds)];
    if (trackedSubscriptionEventIds.length > 0) {
      const { error } = await admin
        .from('subscriptions_events')
        .delete()
        .in('id', trackedSubscriptionEventIds);
      if (error) {
        errors.push(`Subscription-event cleanup failed: ${redactedErrorKind(error)}`);
      } else {
        const { count, error: verifyError } = await admin
          .from('subscriptions_events')
          .select('*', { count: 'exact', head: true })
          .in('id', trackedSubscriptionEventIds);
        if (verifyError) {
          errors.push(
            `Subscription-event cleanup verification failed: ${redactedErrorKind(verifyError)}`,
          );
        } else if (count !== 0) {
          errors.push('Subscription-event cleanup left a residual row.');
        }
      }
    }
    for (const user of users) {
      if (!user?.id) continue;
      const keyHash = keyHashFor('data-export', user.id);
      const { error } = await admin
        .from('edge_rate_limits')
        .delete()
        .eq('scope', 'data-export')
        .eq('key_hash', keyHash);
      if (error) {
        errors.push(`Rate-limit cleanup failed: ${redactedErrorKind(error)}`);
        continue;
      }
      const { count, error: verifyError } = await admin
        .from('edge_rate_limits')
        .select('*', { count: 'exact', head: true })
        .eq('scope', 'data-export')
        .eq('key_hash', keyHash);
      if (verifyError) {
        errors.push(`Rate-limit cleanup verification failed: ${redactedErrorKind(verifyError)}`);
      } else if (count !== 0) {
        errors.push('Rate-limit cleanup left a residual row.');
      }
    }
    for (const entry of accountDeletionRateLimitKeys) {
      const { error } = await admin
        .from('edge_rate_limits')
        .delete()
        .eq('scope', entry.scope)
        .eq('key_hash', entry.keyHash);
      if (error) {
        errors.push(`Account-deletion rate-limit cleanup failed: ${redactedErrorKind(error)}`);
        continue;
      }
      const { count, error: verifyError } = await admin
        .from('edge_rate_limits')
        .select('*', { count: 'exact', head: true })
        .eq('scope', entry.scope)
        .eq('key_hash', entry.keyHash);
      if (verifyError) {
        errors.push(
          `Account-deletion rate-limit cleanup verification failed: ${redactedErrorKind(
            verifyError,
          )}`,
        );
      } else if (count !== 0) {
        errors.push('Account-deletion rate-limit cleanup left a residual row.');
      }
    }
    for (const user of users) {
      if (!user?.id) continue;
      let exists = false;
      try {
        exists = await userExists(admin, user.id);
      } catch (error) {
        errors.push(`User cleanup preflight failed: ${redactedErrorKind(error)}`);
        continue;
      }
      if (!exists) continue;
      const { error } = await admin.auth.admin.deleteUser(user.id);
      if (error) {
        errors.push(`User cleanup failed: ${redactedErrorKind(error)}`);
        continue;
      }
      try {
        if (await userExists(admin, user.id))
          errors.push('User cleanup left a residual Auth user.');
      } catch (verifyError) {
        errors.push(`User cleanup verification failed: ${redactedErrorKind(verifyError)}`);
      }
    }
  }

  writeArtifacts(errors.length > 0 || (strict && warnings.length > 0) ? 'fail' : 'pass');
  printResult('Phase 9 live data rights', errors, warnings);
}

main().catch((error) => {
  errors.push(harnessErrorDetail(error));
  writeArtifacts('fail');
  printResult('Phase 9 live data rights', errors, warnings);
});
