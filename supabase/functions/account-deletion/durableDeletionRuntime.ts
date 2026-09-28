import { fetchWithTimeout } from '../_shared/fetch.ts';
import { readEdgeAppEnvironment } from '../_shared/env.ts';
import {
  buildRevenueCatIdentityTombstoneFamily,
  parseRevenueCatIdentityTombstoneKeyring,
} from '../_shared/revenueCatIdentityTombstone.ts';
import {
  appleVaultEnvelopeFromBytea,
  AppleVaultError,
  loadAppleVaultKeyring,
  openAppleRefreshToken,
} from '../_shared/appleVault.ts';
import { executeAppleDeletionStep } from './appleDeletionExecutor.ts';
import { createAppleDeletionNetwork } from './appleDeletionNetwork.ts';
import { executeAuthDeletionStep } from './authDeletionExecutor.ts';
import { createDeletionProviderJsonNetwork } from './deletionProviderNetwork.ts';
import {
  deletionPayloadEnvelopeFromByteaRpc,
  deletionPayloadEnvelopeToByteaRpc,
  loadDeletionPayloadKeyFromEnv,
  openDeletionPayload,
  sealDeletionPayload,
} from './durableDeletionCrypto.ts';
import {
  type DeletionRpcClient,
  DurableDeletionDatabaseGateway,
} from './durableDeletionDatabaseGateway.ts';
import { createDurableDeletionEncryptedStateStore } from './durableDeletionEncryptedStateStore.ts';
import {
  createAppleDeletionPayload,
  createAppleDeletionPayloadWithRevocationToken,
  decodeAppleDeletionPayload,
  encodeAppleDeletionPayload,
} from './durableDeletionPayloads.ts';
import {
  deletionIntakeOwnerHmac,
  deletionStatusLookupFromDatabaseRow,
  deletionSubjectHmac,
  loadDeletionReceiptHmacKey,
  verifiedAuthSessionClaimsFromJwt,
} from './durableDeletionRuntimeCore.ts';
import { hashDeletionCapability } from './durableDeletionCore.ts';
import {
  type DeletionAuthenticatedUser,
  type DurableDeletionHttpDependencies,
} from './durableDeletionHttpHandler.ts';
import {
  AccountDeletionWorkerCapacityError,
  type AccountDeletionStepExecutor,
  type AccountDeletionStepName,
  runAccountDeletionWorker,
} from './durableDeletionWorker.ts';
import { executePhotoStorageDeletionStep } from './photoStorageDeletionExecutor.ts';
import { createPostHogDeletionExecutor } from './postHogDeletionExecutor.ts';
import {
  ACCOUNT_DELETION_PROVIDER_RESPONSE_MAX_BYTES,
  requireAppleRevocationConfiguration,
} from './providerDeletion.ts';
import {
  createRevenueCatV2DeletionExecutor,
  deriveRevenueCatV2CredentialBinding,
  REVENUECAT_V2_MAX_NETWORK_TIMEOUT_MS,
} from './revenueCatV2DeletionExecutor.ts';
import { executeServiceRowsDeletionStep } from './serviceRowsDeletionExecutor.ts';
import { scrubAccountServiceRows } from './serviceRoleCleanup.ts';

const DAY_MS = 86_400_000;
const OPERATION_LIFETIME_MS = 29 * DAY_MS;
const RECEIPT_LIFETIME_MS = 29 * DAY_MS;
const TOMBSTONE_LIFETIME_MS = 824 * DAY_MS;
// A complete RevenueCat identity-family verification may require 67 bounded
// read-only requests (lookup + canonical + 64 aliases + aliases endpoint).
// Ninety seconds stays below the 120s DB claim lease and Supabase's documented
// 150s free-plan wall-clock/request-idle limit while allowing one whole round
// to remain bound to a single claim.
const WORKER_BUDGET_MS = 90_000;
const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;
const AUTHORITATIVE_AUTH_REJECTION_CODES = new Set([
  'bad_jwt',
  'no_authorization',
  'session_expired',
  'session_not_found',
  'unexpected_audience',
  'user_banned',
  'user_not_found',
]);

type RuntimeAuthUser = {
  id?: unknown;
  app_metadata?: unknown;
  identities?: unknown;
};

export type DurableDeletionRuntimeClient = DeletionRpcClient & {
  auth: {
    getUser(token: string): Promise<{ data: unknown; error: unknown }>;
    admin: {
      deleteUser(userId: string, shouldSoftDelete: false): Promise<unknown>;
      getUserById(userId: string): Promise<unknown>;
    };
  };
  storage: {
    from(bucket: 'photos'): {
      remove(paths: string[]): Promise<{ data?: unknown; error: unknown }>;
    };
  };
};

export type DurableDeletionRuntimeOptions = {
  client: DurableDeletionRuntimeClient;
  readEnvironment?: (name: string) => string | undefined;
  now?: () => number;
  schedule: (work: Promise<void>) => void;
};

export class DurableDeletionRuntimeError extends Error {
  constructor(
    public readonly code:
      | 'DELETION_RUNTIME_CONFIGURATION_INVALID'
      | 'DELETION_AUTHENTICATION_UNAVAILABLE',
  ) {
    super(code);
    this.name = 'DurableDeletionRuntimeError';
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

function isAuthoritativeAuthRejection(error: unknown): boolean {
  if (!isRecord(error)) return false;
  if (error.name === 'AuthSessionMissingError') return true;
  if (typeof error.code === 'string' && AUTHORITATIVE_AUTH_REJECTION_CODES.has(error.code)) {
    return true;
  }
  // Current and legacy GoTrue responses consistently reserve 401 for a bearer
  // that cannot authenticate. Other statuses and unknown shapes fail closed as
  // dependency unavailability rather than destroying a candidate session.
  return error.status === 401;
}

function authenticationUnavailable(): DurableDeletionRuntimeError {
  return new DurableDeletionRuntimeError('DELETION_AUTHENTICATION_UNAVAILABLE');
}

function envString(
  readEnvironment: (name: string) => string | undefined,
  name: string,
): string | undefined {
  const value = readEnvironment(name);
  return typeof value === 'string' && value.length > 0 ? value : undefined;
}

function requiredEnv(
  readEnvironment: (name: string) => string | undefined,
  name: string,
  maximum = 4_096,
): string {
  const value = envString(readEnvironment, name);
  if (value === undefined || value !== value.trim() || value.length > maximum) {
    throw new DurableDeletionRuntimeError('DELETION_RUNTIME_CONFIGURATION_INVALID');
  }
  return value;
}

function boundedInteger(
  value: string | undefined,
  fallback: number,
  minimum: number,
  maximum: number,
): number {
  if (value === undefined) return fallback;
  const parsed = Number(value);
  return Number.isSafeInteger(parsed) && parsed >= minimum && parsed <= maximum ? parsed : fallback;
}

function validAppleSubject(value: unknown): value is string {
  return (
    typeof value === 'string' &&
    value.length > 0 &&
    value.length <= 512 &&
    value === value.trim() &&
    !/[\u0000-\u001f\u007f]/u.test(value)
  );
}

function appleIdentity(user: RuntimeAuthUser): {
  linked: boolean;
  subject: string | null;
} {
  const metadata = isRecord(user.app_metadata) ? user.app_metadata : {};
  const providers = Array.isArray(metadata.providers) ? metadata.providers : [];
  const appleIdentities = Array.isArray(user.identities)
    ? user.identities.filter((identity) => isRecord(identity) && identity.provider === 'apple')
    : [];
  const linked =
    metadata.provider === 'apple' || providers.includes('apple') || appleIdentities.length > 0;
  const subjects = new Set<string>();
  for (const identity of appleIdentities) {
    if (!isRecord(identity)) continue;
    const identityData = isRecord(identity.identity_data) ? identity.identity_data : {};
    if (validAppleSubject(identityData.sub)) subjects.add(identityData.sub);
    if (validAppleSubject(identity.id)) subjects.add(identity.id);
  }
  return {
    linked,
    subject: subjects.size === 1 ? [...subjects][0] : null,
  };
}

function rpcRows(data: unknown): Record<string, unknown>[] {
  if (!Array.isArray(data) || data.some((row) => !isRecord(row))) {
    throw new DurableDeletionRuntimeError('DELETION_RUNTIME_CONFIGURATION_INVALID');
  }
  return data as Record<string, unknown>[];
}

async function rpcOrThrow(
  client: DeletionRpcClient,
  name: string,
  args: Record<string, unknown>,
): Promise<unknown> {
  const result = await client.rpc(name, args);
  if (!isRecord(result) || result.error !== null) {
    throw new DurableDeletionRuntimeError('DELETION_RUNTIME_CONFIGURATION_INVALID');
  }
  return result.data;
}

function postHogNoRecordingsEvidence(readEnvironment: (name: string) => string | undefined) {
  const evidence = envString(readEnvironment, 'POSTHOG_NO_RECORDINGS_EVIDENCE');
  const verifiedAt = envString(readEnvironment, 'POSTHOG_NO_RECORDINGS_VERIFIED_AT');
  if (
    evidence !== 'production_capture_disabled_and_storage_audited' ||
    verifiedAt === undefined ||
    !Number.isFinite(Date.parse(verifiedAt)) ||
    new Date(Date.parse(verifiedAt)).toISOString() !== verifiedAt
  ) {
    return undefined;
  }
  return {
    recordingsCollected: false,
    durable: true as const,
    evidence: 'production_capture_disabled_and_storage_audited' as const,
    verifiedAt,
  };
}

export async function createDurableDeletionRuntime(
  options: DurableDeletionRuntimeOptions,
): Promise<DurableDeletionHttpDependencies> {
  if (
    options === null ||
    typeof options !== 'object' ||
    options.client === null ||
    typeof options.client !== 'object' ||
    typeof options.client.rpc !== 'function' ||
    typeof options.schedule !== 'function' ||
    !(options.readEnvironment === undefined || typeof options.readEnvironment === 'function') ||
    !(options.now === undefined || typeof options.now === 'function')
  ) {
    throw new DurableDeletionRuntimeError('DELETION_RUNTIME_CONFIGURATION_INVALID');
  }
  const readEnvironment = options.readEnvironment ?? ((name: string) => Deno.env.get(name));
  const now = options.now ?? (() => Date.now());
  let appEnvironment: 'development' | 'staging' | 'production';
  let publicAppEnvironment: typeof appEnvironment | undefined;
  try {
    appEnvironment = readEdgeAppEnvironment(readEnvironment);
    publicAppEnvironment =
      readEnvironment('EXPO_PUBLIC_APP_ENV') === undefined ? undefined : appEnvironment;
  } catch {
    throw new DurableDeletionRuntimeError('DELETION_RUNTIME_CONFIGURATION_INVALID');
  }
  const gateway = new DurableDeletionDatabaseGateway(options.client);
  const payloadKey = await loadDeletionPayloadKeyFromEnv(readEnvironment);
  const receiptKey = await loadDeletionReceiptHmacKey(readEnvironment);
  const encryptedState = createDurableDeletionEncryptedStateStore({
    key: payloadKey,
    gateway,
  });
  const workerSecret = requiredEnv(readEnvironment, 'ACCOUNT_DELETION_WORKER_SECRET', 64);
  if (!/^[a-f0-9]{64}$/.test(workerSecret)) {
    throw new DurableDeletionRuntimeError('DELETION_RUNTIME_CONFIGURATION_INVALID');
  }

  const revenueCatProjectId = requiredEnv(readEnvironment, 'REVENUECAT_PROJECT_ID', 255);
  // RevenueCat explicitly documents that V1 keys do not work with REST API
  // V2. Requiring a separately named V2 key prevents a legacy key from
  // surviving deploy validation only to strand a deletion after intake.
  const revenueCatSecret = requiredEnv(readEnvironment, 'REVENUECAT_V2_SECRET_API_KEY', 1_000);
  const revenueCatProviderBudgetKey = await deriveRevenueCatV2CredentialBinding(revenueCatSecret);
  const tombstoneKeyring = parseRevenueCatIdentityTombstoneKeyring(
    requiredEnv(readEnvironment, 'REVENUECAT_IDENTITY_TOMBSTONE_HMAC_KEYS', 1_024),
    requiredEnv(readEnvironment, 'REVENUECAT_IDENTITY_TOMBSTONE_HMAC_CURRENT_VERSION', 5),
  );
  const providerTimeoutMs = boundedInteger(
    envString(readEnvironment, 'EDGE_EXTERNAL_FETCH_TIMEOUT_MS'),
    5_000,
    1_000,
    30_000,
  );
  const providerNetwork = createDeletionProviderJsonNetwork({
    maxResponseBytes: ACCOUNT_DELETION_PROVIDER_RESPONSE_MAX_BYTES,
    maxTimeoutMs: providerTimeoutMs,
    now,
    fetcher: fetchWithTimeout,
  });
  // A maximum family contains 66 customer reads plus one aliases read.
  // Fourteen-wide customer batches plus a ten-second per-call ceiling require
  // at most six network waves in total (60s),
  // retaining 30s of the 90s claim for quota RPCs and durable state writes.
  // Apple and PostHog keep the separately configured shared timeout.
  const revenueCatProviderNetwork = createDeletionProviderJsonNetwork({
    maxResponseBytes: ACCOUNT_DELETION_PROVIDER_RESPONSE_MAX_BYTES,
    maxTimeoutMs: Math.min(providerTimeoutMs, REVENUECAT_V2_MAX_NETWORK_TIMEOUT_MS),
    now,
    fetcher: fetchWithTimeout,
  });
  function revenueCatBudgetDomain(request: {
    url: string;
    init: RequestInit;
  }): 'customer-information' | 'project-configuration' {
    let url: URL;
    try {
      url = new URL(request.url);
    } catch {
      throw new DurableDeletionRuntimeError('DELETION_RUNTIME_CONFIGURATION_INVALID');
    }
    return url.pathname === '/v2/projects' ? 'project-configuration' : 'customer-information';
  }
  async function acquireRevenueCatProviderBudget(
    domain: 'customer-information' | 'project-configuration',
  ): Promise<void> {
    let allowed = false;
    try {
      allowed = await gateway.consumeRevenueCatProviderBudget(revenueCatProviderBudgetKey, domain);
    } catch {
      // A missing distributed quota decision must stop this worker slice,
      // not fan out unmetered calls or burn attempts across the backlog.
    }
    if (!allowed) {
      throw new AccountDeletionWorkerCapacityError('DELETION_WORKER_PROVIDER_CAPACITY_EXHAUSTED');
    }
  }

  let appleNetworkPromise: ReturnType<typeof createAppleDeletionNetwork> | null = null;
  function appleNetwork() {
    if (appleNetworkPromise === null) {
      appleNetworkPromise = createAppleDeletionNetwork({
        config: requireAppleRevocationConfiguration({
          teamId: envString(readEnvironment, 'APPLE_TEAM_ID'),
          keyId: envString(readEnvironment, 'APPLE_SIWA_KEY_ID'),
          clientId: envString(readEnvironment, 'APPLE_SIWA_CLIENT_ID'),
          nativeBundleId: envString(readEnvironment, 'APP_IOS_BUNDLE_IDENTIFIER'),
          privateKey: envString(readEnvironment, 'APPLE_SIWA_PRIVATE_KEY'),
        }),
        fetcher: fetchWithTimeout,
        now,
        timeoutMs: providerTimeoutMs,
        maxResponseBytes: ACCOUNT_DELETION_PROVIDER_RESPONSE_MAX_BYTES,
      });
    }
    return appleNetworkPromise;
  }

  let appleVaultKeyringPromise: ReturnType<typeof loadAppleVaultKeyring> | null = null;
  function appleVaultKeyring() {
    if (appleVaultKeyringPromise === null) {
      appleVaultKeyringPromise = loadAppleVaultKeyring(readEnvironment);
    }
    return appleVaultKeyringPromise;
  }

  const record = async (
    claim: Parameters<typeof gateway.markRequestStarted>[0] & {
      stepName: Parameters<typeof gateway.record>[0]['stepName'];
    },
    outcome: Parameters<typeof gateway.record>[0]['outcome'],
    resultCode: string,
    retryAt: string | null,
  ) => {
    await gateway.record({
      operationId: claim.operationId,
      stepName: claim.stepName,
      claimToken: claim.claimToken,
      outcome,
      resultCode,
      retryAt,
    });
  };

  const revenueCatExecutor = createRevenueCatV2DeletionExecutor({
    projectId: revenueCatProjectId,
    secretApiKey: revenueCatSecret,
    network: {
      reserveMutation: () => acquireRevenueCatProviderBudget('customer-information'),
      async execute(request, context) {
        if (context.requestBudgetReserved) {
          if (String(request.init.method) !== 'DELETE') {
            throw new DurableDeletionRuntimeError('DELETION_RUNTIME_CONFIGURATION_INVALID');
          }
        } else {
          await acquireRevenueCatProviderBudget(revenueCatBudgetDomain(request));
        }
        return await revenueCatProviderNetwork.execute(request, context);
      },
    },
    clock: { nowMs: now },
    maxRequests: 70,
    // Migration 0052 admits a second full-family absence round only after a
    // DB-clock 60-second interval. Match that floor locally as a liveness
    // optimization; the database remains the authoritative safety gate.
    retryDelayMs: 60_000,
    deadlineReserveMs: 500,
    stateStore: {
      load: (claim) => encryptedState.load(claim, 'revenuecat_delete'),
      persist: (claim, plaintext) => encryptedState.persist(claim, 'revenuecat_delete', plaintext),
    },
    gateway: {
      async establishIdentityBarrier(claim, snapshot) {
        if (snapshot.projectId !== revenueCatProjectId) {
          throw new DurableDeletionRuntimeError('DELETION_RUNTIME_CONFIGURATION_INVALID');
        }
        const family = await buildRevenueCatIdentityTombstoneFamily(
          snapshot.projectId,
          [
            snapshot.lookupCustomerId,
            ...(snapshot.canonicalCustomerId === null ? [] : [snapshot.canonicalCustomerId]),
            ...snapshot.aliases,
          ],
          tombstoneKeyring,
        );
        const rows = rpcRows(
          await rpcOrThrow(options.client, 'establish_revenuecat_deletion_identity_barrier', {
            p_operation_id: claim.operationId,
            p_claim_token: claim.claimToken,
            p_identity_hmac_key_version: family.keyVersion,
            p_identity_hmacs: family.identityHmacs,
            p_raw_identities: family.rawIdentities,
            p_expires_at: new Date(now() + TOMBSTONE_LIFETIME_MS).toISOString(),
          }),
        );
        const row = rows.length === 1 ? rows[0] : null;
        if (
          row === null ||
          row.established !== true ||
          row.tombstone_version !== 1 ||
          row.identity_count !== family.rawIdentities.length
        ) {
          throw new DurableDeletionRuntimeError('DELETION_RUNTIME_CONFIGURATION_INVALID');
        }
        return {
          established: true,
          tombstoneVersion: 1,
          identityCount: family.rawIdentities.length,
        };
      },
      async markRequestStarted(claim) {
        return { requestStartedAt: await gateway.markRequestStarted(claim) };
      },
      recordAbsenceObservation(claim) {
        return gateway.recordRevenueCatAbsenceObservation(claim);
      },
      recordOutcome(claim, outcome) {
        return record(
          claim,
          outcome.kind,
          outcome.resultCode,
          outcome.kind === 'retryable'
            ? outcome.retryAt
            : outcome.kind === 'ambiguous' && outcome.retryAt !== undefined
              ? outcome.retryAt
              : null,
        );
      },
      resetAbsenceObservations(claim) {
        return gateway.resetRevenueCatAbsenceObservations(claim);
      },
    },
  });

  const postHogExecutor = createPostHogDeletionExecutor({
    configuration: {
      appEnvironment,
      publicAppEnvironment,
      mobileKey: envString(readEnvironment, 'EXPO_PUBLIC_POSTHOG_KEY'),
      host: envString(readEnvironment, 'POSTHOG_API_HOST'),
      projectId: envString(readEnvironment, 'POSTHOG_PROJECT_ID'),
      personalApiKey: envString(readEnvironment, 'POSTHOG_PERSONAL_API_KEY'),
      captureShutdownAt: envString(readEnvironment, 'POSTHOG_CAPTURE_SHUTDOWN_AT'),
      minimumAbsenceIntervalSeconds: boundedInteger(
        envString(readEnvironment, 'POSTHOG_ABSENCE_INTERVAL_SECONDS'),
        60,
        1,
        86_400,
      ),
      maxNetworkRequestsPerInvocation: 20,
      noRecordingsEvidence: postHogNoRecordingsEvidence(readEnvironment),
    },
    clock: { nowMs: now },
    network: { sendJson: providerNetwork.sendJson },
    encryptedStateStore: {
      async load(input) {
        if (input.encryptedPayload === null) return null;
        const envelope = deletionPayloadEnvelopeFromByteaRpc(
          'posthog_delete',
          input.encryptedPayload,
        );
        return await openDeletionPayload({
          key: payloadKey,
          userId: input.userId,
          stepName: 'posthog_delete',
          serializedEnvelope: envelope,
        });
      },
      async save(input) {
        const envelope = await sealDeletionPayload({
          key: payloadKey,
          userId: input.userId,
          stepName: 'posthog_delete',
          plaintext: input.plaintext,
        });
        await gateway.updatePayload(
          input,
          deletionPayloadEnvelopeToByteaRpc('posthog_delete', envelope),
        );
      },
    },
    rpc: {
      async markRequestStarted(input) {
        return { requestStartedAt: await gateway.markRequestStarted(input) };
      },
      recordStep(input) {
        return gateway.record({
          operationId: input.operationId,
          stepName: input.stepName,
          claimToken: input.claimToken,
          outcome: input.outcome,
          resultCode: input.resultCode,
          retryAt: input.retryAt,
        });
      },
    },
  });

  const executors: Readonly<Record<AccountDeletionStepName, AccountDeletionStepExecutor>> = {
    apple_revoke: (claim, context) =>
      executeAppleDeletionStep(claim, context, {
        async loadPayload(value) {
          const plaintext = await encryptedState.load(value, 'apple_revoke');
          if (plaintext === null) throw new Error('APPLE_PAYLOAD_UNAVAILABLE');
          try {
            return decodeAppleDeletionPayload(plaintext);
          } finally {
            plaintext.fill(0);
          }
        },
        async savePayload(value, payload) {
          const plaintext = encodeAppleDeletionPayload(payload);
          try {
            await encryptedState.persist(value, 'apple_revoke', plaintext);
          } finally {
            plaintext.fill(0);
          }
        },
        markRequestStarted: async (value) => {
          await gateway.markRequestStarted(value);
        },
        record,
        async exchangeAuthorizationCode(code, expectedAppleSubject) {
          return await (await appleNetwork()).exchangeAuthorizationCode(code, expectedAppleSubject);
        },
        async revokeToken(token, tokenTypeHint) {
          return await (await appleNetwork()).revokeToken(token, tokenTypeHint);
        },
        now,
      }),
    revenuecat_delete: revenueCatExecutor,
    posthog_delete: postHogExecutor,
    photo_storage_delete: (claim, context) =>
      executePhotoStorageDeletionStep(claim, context, {
        listOwnedObjectNames: (userId, limit) => gateway.listPhotoObjects(userId, null, limit),
        countOwnedObjects: (userId) => gateway.countPhotoObjects(userId),
        async removeObjectNames(names) {
          const result = await options.client.storage.from('photos').remove(names);
          if (!isRecord(result) || result.error !== null) {
            throw new Error('PHOTO_STORAGE_REMOVE_RETRY');
          }
        },
        markRequestStarted: async (value) => {
          await gateway.markRequestStarted(value);
        },
        record,
        now,
      }),
    service_rows_scrub: (claim, context) =>
      executeServiceRowsDeletionStep(claim, context, {
        async scrub(userId) {
          await scrubAccountServiceRows(userId, options.client as never);
        },
        record,
        now,
      }),
    auth_user_delete: (claim, context) =>
      executeAuthDeletionStep(claim, context, {
        markRequestStarted: async (value) => {
          await gateway.markRequestStarted(value);
        },
        record,
        hardDeleteUser: (userId) => options.client.auth.admin.deleteUser(userId, false),
        lookupUser: (userId) => options.client.auth.admin.getUserById(userId),
        now,
      }),
  };

  async function accelerate(operationId: string, userId: string) {
    const deadlineAtMs = now() + WORKER_BUDGET_MS;
    const claim = await gateway.claimOperation(operationId, userId, 'dispatch');
    if (claim === null || now() >= deadlineAtMs) return;
    try {
      await executors[claim.stepName](claim, { deadlineAtMs });
    } catch (error) {
      if (error instanceof AccountDeletionWorkerCapacityError) {
        await gateway.deferRevenueCatProviderCapacity(
          claim,
          new Date(now() + 65_000).toISOString(),
        );
        return;
      }
      throw error;
    }
  }

  async function runWorker() {
    const deadlineAtMs = now() + WORKER_BUDGET_MS;
    return await runAccountDeletionWorker({
      gateway: {
        reapExpiredPublicationLeases: (limit) => gateway.reapExpiredPublicationLeases(limit),
        claimNext: (mode) => gateway.claimNext(mode),
        deferProviderCapacity: (claim) =>
          gateway.deferRevenueCatProviderCapacity(claim, new Date(now() + 65_000).toISOString()),
        listReadyToFinalize: (limit) => gateway.listReadyToFinalize(limit),
        async finalize(candidate) {
          await gateway.finalize({
            operationId: candidate.operationId,
            subjectHmac: await deletionSubjectHmac(receiptKey.key, candidate.userId),
            subjectHmacKeyVersion: receiptKey.keyVersion,
            receiptExpiresAt: new Date(now() + RECEIPT_LIFETIME_MS).toISOString(),
          });
        },
        async purgeExpiredArtifacts(limit) {
          await gateway.purgeExpiredArtifacts(limit);
          await rpcOrThrow(options.client, 'purge_expired_edge_rate_limits', {
            p_limit: limit,
          });
          await rpcOrThrow(options.client, 'purge_expired_revenuecat_identity_tombstones', {
            p_limit: limit,
          });
        },
      },
      executors,
      deadlineAtMs,
      maxClaims: 20,
      finalizationBatchSize: 20,
      maintenanceBatchSize: 100,
      now,
    });
  }

  return {
    workerSecret,
    maxBodyBytes: boundedInteger(
      envString(readEnvironment, 'USER_EDGE_BODY_MAX_BYTES'),
      16_384,
      1_024,
      65_536,
    ),
    async authenticate(token): Promise<DeletionAuthenticatedUser | null> {
      let result: { data: unknown; error: unknown };
      try {
        result = await options.client.auth.getUser(token);
      } catch {
        throw authenticationUnavailable();
      }
      if (!isRecord(result)) throw authenticationUnavailable();
      if (result.error !== null) {
        if (isAuthoritativeAuthRejection(result.error)) return null;
        throw authenticationUnavailable();
      }
      if (!isRecord(result.data) || !isRecord(result.data.user)) {
        throw authenticationUnavailable();
      }
      const user = result.data.user as RuntimeAuthUser;
      if (typeof user.id !== 'string' || !UUID_PATTERN.test(user.id)) {
        throw authenticationUnavailable();
      }
      const session = verifiedAuthSessionClaimsFromJwt(token, user.id);
      if (session === null) return null;
      const apple = appleIdentity(user);
      return {
        id: user.id,
        sessionId: session.sessionId,
        appleLinked: apple.linked,
        appleSubject: apple.subject,
      };
    },
    async consumeIntakeRateLimit(userId, sessionId) {
      return await gateway.consumeRateLimit({
        scope: 'account-deletion-intake',
        keyHash: await deletionIntakeOwnerHmac(receiptKey.key, userId),
        limit: 5,
        windowSeconds: 600,
        ownerUserId: userId,
        sessionId,
      });
    },
    async consumeStatusRateLimit(capability) {
      return await gateway.consumeRateLimit({
        scope: 'account-deletion-status',
        keyHash: await hashDeletionCapability(capability),
        limit: 60,
        windowSeconds: 60,
      });
    },
    barrierState: (userId, sessionId) => gateway.barrierState(userId, sessionId),
    reservePublicationLease: (userId, sessionId, capability) =>
      gateway.reservePublicationLease({ userId, sessionId, capability }),
    activatePublicationLease: (userId, sessionId, capability) =>
      gateway.activatePublicationLease({ userId, sessionId, capability }),
    renewPublicationLease: (userId, sessionId, capability) =>
      gateway.renewPublicationLease({ userId, sessionId, capability }),
    releasePublicationLease: (capability) => gateway.releasePublicationLease(capability),
    async begin(user, request) {
      const fallbackPayload = () =>
        createAppleDeletionPayload({
          appleLinked: user.appleLinked,
          ...(request.appleAuthorizationCode === undefined || user.appleSubject === null
            ? {}
            : {
                authorizationCode: request.appleAuthorizationCode,
                expectedAppleSubject: user.appleSubject,
              }),
        });
      let applePayload = fallbackPayload();
      if (user.appleLinked) {
        const retained = await gateway.appleDeletionVault(user.id, user.sessionId);
        if (retained !== null) {
          let refreshToken = '';
          try {
            const vault = await appleVaultKeyring();
            if (!vault.keys.has(retained.vaultKeyVersion)) {
              throw new AppleVaultError('APPLE_VAULT_DECRYPT_FAILED');
            }
            refreshToken = await openAppleRefreshToken({
              keyring: vault,
              userId: user.id,
              subjectHmac: retained.appleSubjectHmac,
              clientId: retained.clientId,
              envelope: appleVaultEnvelopeFromBytea(retained.encryptedRefreshToken),
            });
            applePayload = createAppleDeletionPayloadWithRevocationToken(refreshToken);
          } catch (error) {
            if (!(error instanceof AppleVaultError)) throw error;
            // A corrupt/unreadable retained credential must never withhold the
            // user's erasure request. Preserve the existing fresh-code path
            // when available, otherwise record the durable manual fallback.
            applePayload = fallbackPayload();
          } finally {
            refreshToken = '';
          }
        }
      }
      const plaintext = encodeAppleDeletionPayload(applePayload);
      let appleEncryptedPayload: string;
      try {
        const envelope = await sealDeletionPayload({
          key: payloadKey,
          userId: user.id,
          stepName: 'apple_revoke',
          plaintext,
        });
        appleEncryptedPayload = deletionPayloadEnvelopeToByteaRpc('apple_revoke', envelope);
      } finally {
        plaintext.fill(0);
      }
      const result = await gateway.begin({
        userId: user.id,
        sessionId: user.sessionId,
        idempotencyKey: request.idempotencyKey,
        capability: request.statusCapability,
        operationExpiresAt: new Date(now() + OPERATION_LIFETIME_MS).toISOString(),
        appleEncryptedPayload,
        revenueCatEncryptedPayload: null,
        postHogEncryptedPayload: null,
      });
      return {
        operationId: result.operationId,
        operationState: result.operationState,
        created: result.created,
      };
    },
    async status(capability) {
      const row = await gateway.status(capability);
      return deletionStatusLookupFromDatabaseRow(row);
    },
    accelerate,
    runWorker,
    schedule: options.schedule,
  };
}
