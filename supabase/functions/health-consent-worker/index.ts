// Durable scheduled completion lane for non-destructive health-data consent
// withdrawal. Gateway JWT verification is disabled because this private route
// authenticates a scheduler-held 256-bit secret and uses only service RPCs.
import { createClient } from 'jsr:@supabase/supabase-js@2';
import { stagingTrafficFreezeResponse } from '../_shared/stagingTrafficFreeze.ts';
import { readEdgeAppEnvironment } from '../_shared/env.ts';
import { readSupabaseSecretKey } from '../_shared/supabaseSecretKey.ts';
import { runHealthDependentCleanup } from '../consent-withdrawal/dependentCleanupRuntime.ts';
import { runHealthConsentWorkerLanes } from './combinedWorkerCore.ts';
import {
  DEPENDENT_WORKER_MAX_STORAGE_BATCHES,
  DEPENDENT_WORKER_STORAGE_BATCH_SIZE,
  runHealthDependentConsentWorker,
} from './dependentWorkerCore.ts';
import { createHealthConsentWorkerHttpHandler } from './httpHandler.ts';
import {
  HEALTH_WORKER_MAX_CLAIM_LIMIT,
  HEALTH_WORKER_MAX_RETRY_AFTER_SECONDS,
  HEALTH_WORKER_MIN_RETRY_AFTER_SECONDS,
  runHealthConsentWorker,
} from './workerCore.ts';

const supabaseUrl = Deno.env.get('SUPABASE_URL') ?? '';
const workerSecret = Deno.env.get('HEALTH_CONSENT_WORKER_SECRET') ?? '';
readEdgeAppEnvironment();

if (!/^https:\/\/[a-z0-9.-]+$/i.test(supabaseUrl)) {
  throw new Error('HEALTH_WORKER_CONFIGURATION_INVALID');
}

function intEnv(name: string, fallback: number, minimum: number, maximum: number): number {
  const value = Number(Deno.env.get(name));
  return Number.isSafeInteger(value) && value >= minimum && value <= maximum ? value : fallback;
}

const claimLimit = intEnv(
  'HEALTH_CONSENT_WORKER_CLAIM_LIMIT',
  10,
  1,
  HEALTH_WORKER_MAX_CLAIM_LIMIT,
);
const storageBatchSize = intEnv('HEALTH_CONSENT_WORKER_STORAGE_BATCH_SIZE', 100, 1, 100);
const maxStorageBatches = intEnv('HEALTH_CONSENT_WORKER_MAX_STORAGE_BATCHES', 5, 1, 100);
const budgetMs = intEnv('HEALTH_CONSENT_WORKER_BUDGET_MS', 45_000, 1_000, 55_000);
const retryAfterSeconds = intEnv(
  'HEALTH_CONSENT_WORKER_RETRY_AFTER_SECONDS',
  60,
  HEALTH_WORKER_MIN_RETRY_AFTER_SECONDS,
  HEALTH_WORKER_MAX_RETRY_AFTER_SECONDS,
);
const actionRequiredRetryAfterSeconds = intEnv(
  'HEALTH_CONSENT_WORKER_ACTION_REQUIRED_RETRY_AFTER_SECONDS',
  86_400,
  HEALTH_WORKER_MIN_RETRY_AFTER_SECONDS,
  HEALTH_WORKER_MAX_RETRY_AFTER_SECONDS,
);

// No generated database type is committed for Edge Functions.
// deno-lint-ignore no-explicit-any
const admin: any = createClient(supabaseUrl, readSupabaseSecretKey(), {
  auth: { persistSession: false, autoRefreshToken: false },
});

function randomClaimToken(): string {
  return Array.from(crypto.getRandomValues(new Uint8Array(32)), (byte) =>
    byte.toString(16).padStart(2, '0'),
  ).join('');
}

const handler = createHealthConsentWorkerHttpHandler({
  workerSecret,
  runWorker: () => {
    const deadlineAtMs = Date.now() + budgetMs;
    return runHealthConsentWorkerLanes({
      runBase: () =>
        runHealthConsentWorker({
          claimToken: randomClaimToken(),
          claimLimit,
          storageBatchSize,
          maxStorageBatches,
          retryAfterSeconds,
          actionRequiredRetryAfterSeconds,
          deadlineAtMs,
          now: Date.now,
          dependencies: {
            claim: (claimToken, limit) =>
              admin.rpc('claim_due_health_consent_withdrawals', {
                p_claim_token: claimToken,
                p_limit: limit,
              }),
            prepare: (operationId, claimToken) =>
              admin.rpc('prepare_health_data_consent_withdrawal', {
                p_operation_id: operationId,
                p_claim_token: claimToken,
              }),
            listStorage: (operationId, limit, claimToken) =>
              admin.rpc('list_health_consent_storage_work', {
                p_operation_id: operationId,
                p_limit: limit,
                p_claim_token: claimToken,
              }),
            removeStorage: (paths) => admin.storage.from('photos').remove(paths),
            complete: (operationId, claimToken) =>
              admin.rpc('complete_health_data_consent_withdrawal', {
                p_operation_id: operationId,
                p_claim_token: claimToken,
              }),
            defer: (operationId, claimToken, resultCode, delaySeconds) =>
              admin.rpc('defer_health_consent_withdrawal', {
                p_operation_id: operationId,
                p_claim_token: claimToken,
                p_result_code: resultCode,
                p_retry_after_seconds: delaySeconds,
              }),
          },
        }),
      runDependent: () =>
        runHealthDependentConsentWorker({
          claimToken: randomClaimToken(),
          claimLimit,
          storageBatchSize: DEPENDENT_WORKER_STORAGE_BATCH_SIZE,
          maxStorageBatches: DEPENDENT_WORKER_MAX_STORAGE_BATCHES,
          retryAfterSeconds,
          deadlineAtMs,
          now: Date.now,
          dependencies: {
            claim: (claimToken, limit) =>
              admin.rpc('claim_due_health_dependent_consent_withdrawals', {
                p_claim_token: claimToken,
                p_limit: limit,
              }),
            cleanup: (operation) => runHealthDependentCleanup(admin, operation),
            listStorage: (operationId, limit, claimToken) =>
              admin.rpc('list_health_dependent_consent_storage_work', {
                p_operation_id: operationId,
                p_limit: limit,
                p_claim_token: claimToken,
              }),
            removeStorage: (paths) => admin.storage.from('photos').remove(paths),
            complete: (operationId) =>
              admin.rpc('complete_health_dependent_consent_withdrawal', {
                p_operation_id: operationId,
              }),
            markActionRequired: (operationId, claimToken, resultCode) =>
              admin.rpc('mark_health_dependent_consent_withdrawal_action_required', {
                p_operation_id: operationId,
                p_claim_token: claimToken,
                p_result_code: resultCode,
              }),
            defer: (operationId, claimToken, resultCode, delaySeconds) =>
              admin.rpc('defer_health_dependent_consent_withdrawal', {
                p_operation_id: operationId,
                p_claim_token: claimToken,
                p_result_code: resultCode,
                p_retry_after_seconds: delaySeconds,
              }),
          },
        }),
    });
  },
});
Deno.serve((request) => stagingTrafficFreezeResponse() ?? handler(request));
