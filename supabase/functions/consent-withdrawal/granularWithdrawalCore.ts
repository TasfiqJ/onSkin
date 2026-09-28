import { photoPathBelongsToUser } from '../_shared/storagePath.ts';
import type { EdgeAppEnvironment } from '../_shared/env.ts';
import { HEALTH_CONSENT_DISCLOSURE_CONTRACTS } from './healthConsentContract.ts';

export const GRANULAR_DB_MAX_ROWS_PER_SCOPE = 500;
export const GRANULAR_DB_BATCH_SIZE = 100;
export const GRANULAR_PHOTO_MAX_ROWS = 1_000;
export const GRANULAR_PHOTO_MAX_STORAGE_OBJECTS = 1_000;
export const GRANULAR_PHOTO_STORAGE_BATCH_SIZE = 100;
// Current and legacy photo contracts use user/file or user/e<epoch>/file.
// Four object segments leaves migration headroom without permitting a deeply
// nested namespace to consume an Edge deadline.
export const GRANULAR_PHOTO_MAX_STORAGE_DEPTH = 4;
export const GRANULAR_PHOTO_MAX_STORAGE_PREFIXES = 64;
export const GRANULAR_PHOTO_MAX_STORAGE_PAGE_REQUESTS = 128;
export const CONSENT_GRANT_COPY_PRODUCTION_ERROR =
  'CONSENT_GRANT_COPY_NOT_PRODUCTION_READY';

const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;
const STRONG_IDEMPOTENCY_KEY_PATTERN = /^[0-9a-f]{64}$/;
const SHA256_PATTERN = /^[0-9a-f]{64}$/;

export type HealthDependentConsentType =
  | 'photo_capture'
  | 'photo_cloud_backup'
  | 'photo_trend_insights'
  | 'ask_layerwell'
  | 'community_participation'
  | 'data_sharing';

export type GranularWithdrawalCopyContract = {
  version: string;
  text: string;
  hash: string;
  reviewStatus: 'draft_blocked' | 'approved';
};

/**
 * Server-accepted withdrawal receipts. These are deliberately exact and
 * fail-closed: a well-formed but different version/hash cannot append a false
 * receipt through this workflow. The copy remains visibly draft/placeholder
 * and therefore remains a launch blocker until the legal-copy gate replaces
 * all three fields together in Edge, mobile, and the database allowlist.
 */
export const CURRENT_GRANULAR_WITHDRAWAL_COPY_CONTRACT = Object.freeze({
  photo_capture: Object.freeze({
    version: 'draft-v1-2026-07-10',
    text:
      '[DRAFT. Pending legal review B-PRIVACY-COPY] Photo CAPTURE consent WITHDRAWN. ' +
      'On-device progress photos and related local health-purpose state must be deleted.',
    hash: '553229a2862dd3d280058e7413b3bc85795932dec2f6ca9bed420b7598e54c51',
    reviewStatus: 'draft_blocked',
  }),
  photo_cloud_backup: Object.freeze({
    version: 'draft-v1-2026-07-10',
    text:
      '[DRAFT. Pending legal review B-PRIVACY-COPY] Photo CLOUD-BACKUP consent WITHDRAWN. ' +
      'Owned cloud photo objects must be deleted before cloud metadata is relocalized.',
    hash: 'cd32873fec948532c00ed92b5052f5df95a59eef52faa5cc7e1f431e6ddd0113',
    reviewStatus: 'draft_blocked',
  }),
  photo_trend_insights: Object.freeze({
    version: 'photo-trend-insights-2026-06-13-placeholder',
    text: '[PLACEHOLDER photo_trend_insights withdrawal. B-PRIVACY-COPY]',
    hash: 'd6bd89ffbb0900784d4af6d8ae1501c7e10385eeba199e1bd8e932d957eec6ba',
    reviewStatus: 'draft_blocked',
  }),
  ask_layerwell: Object.freeze({
    version: 'ask-advisor-2026-06-14-placeholder',
    text: '[PLACEHOLDER ask_layerwell withdrawal. B-PRIVACY-COPY]',
    hash: '4d0b588ed43f4680adaf6e7699641c706e113bed7b9212b408532235e4fe1e57',
    reviewStatus: 'draft_blocked',
  }),
  community_participation: Object.freeze({
    version: 'community-participation-2026-06-13-placeholder',
    text: '[PLACEHOLDER community_participation withdrawal. B-PRIVACY-COPY]',
    hash: 'c6ac514c090e7ba197b3f66497aff3b8615c5ffdda7ed2e21eb81f62870aff2e',
    reviewStatus: 'draft_blocked',
  }),
  data_sharing: Object.freeze({
    version: 'commerce-consent-2026-06-13-placeholder',
    text: '[PLACEHOLDER commerce data-sharing withdrawal. B-PRIVACY-COPY]',
    hash: '91f4958177a5d38507536c281726094938df5675555547576b5d18e799bc89b4',
    reviewStatus: 'draft_blocked',
  }),
}) satisfies Readonly<
  Record<HealthDependentConsentType, GranularWithdrawalCopyContract>
>;

const HEALTH_DEPENDENT_CONSENT_TYPES = new Set<HealthDependentConsentType>(
  Object.keys(
    CURRENT_GRANULAR_WITHDRAWAL_COPY_CONTRACT,
  ) as HealthDependentConsentType[],
);

function copyIsApproved(contract: {
  readonly reviewStatus: 'draft_blocked' | 'approved';
}): boolean {
  return contract.reviewStatus === 'approved';
}

/**
 * This gate is invoked only for a new base-health grant/reconsent. Withdrawal,
 * decline, status, replay, and scheduled erasure must remain available even
 * when the next grant copy is still blocked for legal review.
 */
export function assertBaseHealthGrantCopyEnvironment(
  appEnvironment: EdgeAppEnvironment,
): void {
  if (
    appEnvironment === 'production' &&
    HEALTH_CONSENT_DISCLOSURE_CONTRACTS.some(
      (contract) => !copyIsApproved(contract),
    )
  ) {
    throw new Error(CONSENT_GRANT_COPY_PRODUCTION_ERROR);
  }
}

export type GranularWithdrawalRequest = {
  consentType: HealthDependentConsentType;
  version: string;
  consentTextHash: string;
  idempotencyKey: string;
  expectedProcessingEpoch: number;
  expectedConsentGeneration: number;
};

type DependencyResult = { data: unknown; error: unknown };
type CountDependencyResult = { count: number | null; error: unknown };

export type GranularWithdrawalOperation = {
  operationId: string;
  userId: string;
  consentType: HealthDependentConsentType;
  state: 'withdrawing' | 'withdrawn';
  processingEpoch: number;
  consentGeneration: number;
};

export type GranularWithdrawalDependencies = {
  authenticatedUserId: string;
  begin: (request: GranularWithdrawalRequest) => PromiseLike<DependencyResult>;
  cleanup: (
    operation: GranularWithdrawalOperation,
  ) => PromiseLike<Record<string, number | boolean>>;
  complete: (operationId: string) => PromiseLike<DependencyResult>;
};

export type GranularWithdrawalResult = {
  status: number;
  body: Record<string, unknown>;
};

const CLEANUP_RESULT_KEYS: Readonly<
  Record<HealthDependentConsentType, readonly string[]>
> = Object.freeze({
  photo_capture: Object.freeze([
    'remote_photo_rows_deleted',
    'storage_objects_removed',
    'skipped_storage_paths',
    'local_device_cleanup_claimed',
    'photo_trend_deleted',
  ]),
  photo_cloud_backup: Object.freeze([
    'photo_rows_relocalized',
    'storage_objects_removed',
    'skipped_storage_paths',
  ]),
  photo_trend_insights: Object.freeze(['photo_trend_deleted']),
  ask_layerwell: Object.freeze([
    'ask_safety_audit_deleted',
    'ask_turn_audit_deleted',
    'ask_sessions_deleted',
    'more_pending',
  ]),
  community_participation: Object.freeze([
    'community_reports_deleted',
    'community_reactions_deleted',
    'community_questions_deleted',
    'community_blocks_deleted',
  ]),
  data_sharing: Object.freeze([
    'order_attributions_detached',
    'commerce_click_events_deleted',
    'more_pending',
  ]),
});

export function granularCleanupReadyForCompletion(
  consentType: HealthDependentConsentType,
  value: unknown,
): value is Record<string, number | boolean> {
  if (!isRecord(value) || !exactKeys(value, CLEANUP_RESULT_KEYS[consentType])) {
    return false;
  }
  for (const [key, item] of Object.entries(value)) {
    if (key === 'local_device_cleanup_claimed') {
      if (item !== false) return false;
    } else if (key === 'skipped_storage_paths') {
      if (item !== 0) return false;
    } else if (key === 'more_pending') {
      if (item !== false) return false;
    } else if (!Number.isSafeInteger(item) || (item as number) < 0) {
      return false;
    }
  }
  return true;
}

export type BoundedRowDeleteDependencies = {
  listRows: (limit: number) => PromiseLike<DependencyResult>;
  deleteRows: (ids: readonly string[]) => PromiseLike<DependencyResult>;
  findRows: (ids: readonly string[]) => PromiseLike<DependencyResult>;
};

export type BoundedRowDeleteResult = {
  deleted: number;
  more_pending: boolean;
};

export type DataSharingCleanupDependencies = {
  listClickRows: (limit: number) => PromiseLike<DependencyResult>;
  listAttributionRows: (
    clickTokens: readonly string[],
    limit: number,
  ) => PromiseLike<DependencyResult>;
  detachAttributions: (ids: readonly string[]) => PromiseLike<DependencyResult>;
  findAttributions: (
    clickTokens: readonly string[],
  ) => PromiseLike<DependencyResult>;
  deleteClickRows: (ids: readonly string[]) => PromiseLike<DependencyResult>;
  findClickRows: (ids: readonly string[]) => PromiseLike<DependencyResult>;
};

export type DataSharingCleanupResult = {
  order_attributions_detached: number;
  commerce_click_events_deleted: number;
  more_pending: boolean;
};

export type AskLayerwellCleanupDependencies = {
  listSessionRows: (limit: number) => PromiseLike<DependencyResult>;
  listTurnRows: (
    sessionIds: readonly string[],
    limit: number,
  ) => PromiseLike<DependencyResult>;
  findSafetyRowsForTurns: (
    turnIds: readonly string[],
  ) => PromiseLike<DependencyResult>;
  deleteTurnRows: (ids: readonly string[]) => PromiseLike<DependencyResult>;
  findTurnRows: (ids: readonly string[]) => PromiseLike<DependencyResult>;
  deleteSessionRows: (ids: readonly string[]) => PromiseLike<DependencyResult>;
  findSessionRows: (ids: readonly string[]) => PromiseLike<DependencyResult>;
};

export type AskLayerwellCleanupResult = {
  ask_turn_audit_deleted: number;
  ask_sessions_deleted: number;
  more_pending: boolean;
};

export type GranularPhotoCloudCleanupDependencies = {
  countPhotoRows: () => PromiseLike<CountDependencyResult>;
  listPhotoRows: (limit: number) => PromiseLike<DependencyResult>;
  listVerifiedStoragePaths: () => PromiseLike<string[]>;
  removeStorage: (paths: string[]) => PromiseLike<{ error: unknown }>;
  relocalizePhotoRows: (
    ids: readonly string[],
  ) => PromiseLike<DependencyResult>;
};

export type GranularPhotoCloudCleanupResult = {
  photo_rows_relocalized: number;
  storage_objects_removed: number;
  skipped_storage_paths: 0;
};

export type GranularPhotoCaptureCleanupDependencies =
  & Omit<
    GranularPhotoCloudCleanupDependencies,
    'relocalizePhotoRows'
  >
  & {
    deletePhotoRows: (ids: readonly string[]) => PromiseLike<DependencyResult>;
  };

export type GranularPhotoCaptureCleanupResult = {
  remote_photo_rows_deleted: number;
  storage_objects_removed: number;
  skipped_storage_paths: 0;
  local_device_cleanup_claimed: false;
};

export class GranularCleanupError extends Error {
  constructor() {
    super('CONSENT_WITHDRAWAL_CLEANUP_FAILED');
    this.name = 'GranularCleanupError';
  }
}

export class GranularActionRequiredError extends Error {
  constructor() {
    super('CONSENT_WITHDRAWAL_ACTION_REQUIRED');
    this.name = 'GranularActionRequiredError';
  }
}

// Backward-compatible exported name used by focused tests and callers.
export class GranularPhotoCloudCleanupError extends GranularCleanupError {
  constructor() {
    super();
    this.name = 'GranularPhotoCloudCleanupError';
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

function exactKeys(
  value: Record<string, unknown>,
  keys: readonly string[],
): boolean {
  const actual = Object.keys(value).sort();
  const expected = [...keys].sort();
  return actual.length === expected.length &&
    actual.every((key, index) => key === expected[index]);
}

function positiveSafeInteger(value: unknown): value is number {
  return Number.isSafeInteger(value) && (value as number) >= 1;
}

function nonNegativeSafeInteger(value: unknown): value is number {
  return Number.isSafeInteger(value) && (value as number) >= 0;
}

function validUuid(value: unknown): value is string {
  return typeof value === 'string' && UUID_PATTERN.test(value);
}

function definiteRpcRejection(error: unknown): boolean {
  if (!isRecord(error) || typeof error.code !== 'string') return false;
  // PostgreSQL SQLSTATE (including P0001) and PostgREST gateway codes prove a
  // returned rejection. Fetch/transport failures are commonly normalized by
  // supabase-js into an error object with an empty code and remain ambiguous.
  return /^(?:[0-9A-Z]{5}|PGRST[0-9]{3})$/.test(error.code);
}

function fail(): never {
  throw new GranularCleanupError();
}

function photoFail(): never {
  throw new GranularPhotoCloudCleanupError();
}

function actionRequired(): never {
  throw new GranularActionRequiredError();
}

export function parseGranularWithdrawalRequest(
  value: unknown,
): GranularWithdrawalRequest | null {
  if (
    !isRecord(value) ||
    !exactKeys(value, [
      'consentType',
      'version',
      'consentTextHash',
      'idempotencyKey',
      'expectedProcessingEpoch',
      'expectedConsentGeneration',
    ])
  ) {
    return null;
  }

  if (
    typeof value.consentType !== 'string' ||
    !HEALTH_DEPENDENT_CONSENT_TYPES.has(
      value.consentType as HealthDependentConsentType,
    ) ||
    typeof value.version !== 'string' ||
    typeof value.consentTextHash !== 'string' ||
    typeof value.idempotencyKey !== 'string' ||
    !SHA256_PATTERN.test(value.consentTextHash) ||
    !STRONG_IDEMPOTENCY_KEY_PATTERN.test(value.idempotencyKey) ||
    !positiveSafeInteger(value.expectedProcessingEpoch) ||
    !nonNegativeSafeInteger(value.expectedConsentGeneration)
  ) {
    return null;
  }

  const consentType = value.consentType as HealthDependentConsentType;
  const contract = CURRENT_GRANULAR_WITHDRAWAL_COPY_CONTRACT[consentType];
  if (
    value.version !== contract.version ||
    value.consentTextHash !== contract.hash
  ) {
    return null;
  }

  return {
    consentType,
    version: value.version,
    consentTextHash: value.consentTextHash,
    idempotencyKey: value.idempotencyKey,
    expectedProcessingEpoch: value.expectedProcessingEpoch,
    expectedConsentGeneration: value.expectedConsentGeneration,
  };
}

function operationFromRpc(
  result: DependencyResult,
  request: GranularWithdrawalRequest,
  authenticatedUserId: string,
): GranularWithdrawalOperation | null {
  const row = Array.isArray(result.data) && result.data.length === 1
    ? result.data[0]
    : null;
  const expectedReturnedGeneration = request.expectedConsentGeneration + 1;
  if (
    result.error ||
    !isRecord(row) ||
    !exactKeys(row, [
      'operation_id',
      'user_id',
      'consent_type',
      'state',
      'processing_epoch',
      'consent_generation',
    ]) ||
    !validUuid(row.operation_id) ||
    !validUuid(row.user_id) ||
    row.user_id !== authenticatedUserId ||
    row.consent_type !== request.consentType ||
    (row.state !== 'withdrawing' && row.state !== 'withdrawn') ||
    row.processing_epoch !== request.expectedProcessingEpoch ||
    row.consent_generation !== expectedReturnedGeneration ||
    !positiveSafeInteger(row.consent_generation)
  ) {
    return null;
  }
  return {
    operationId: row.operation_id,
    userId: row.user_id,
    consentType: request.consentType,
    state: row.state,
    processingEpoch: row.processing_epoch,
    consentGeneration: row.consent_generation,
  };
}

function sameTerminalOperation(
  result: DependencyResult,
  begun: GranularWithdrawalOperation,
): GranularWithdrawalOperation | null {
  const row = Array.isArray(result.data) && result.data.length === 1
    ? result.data[0]
    : null;
  if (
    result.error ||
    !isRecord(row) ||
    !exactKeys(row, [
      'operation_id',
      'user_id',
      'consent_type',
      'state',
      'processing_epoch',
      'consent_generation',
    ]) ||
    row.operation_id !== begun.operationId ||
    row.user_id !== begun.userId ||
    row.consent_type !== begun.consentType ||
    row.state !== 'withdrawn' ||
    row.processing_epoch !== begun.processingEpoch ||
    row.consent_generation !== begun.consentGeneration
  ) {
    return null;
  }
  return { ...begun, state: 'withdrawn' };
}

function publicOperation(
  operation: GranularWithdrawalOperation,
): Record<string, unknown> {
  return {
    operation_id: operation.operationId,
    consent_type: operation.consentType,
    state: operation.state,
    processing_epoch: operation.processingEpoch,
    consent_generation: operation.consentGeneration,
  };
}

function retryResult(
  operation: GranularWithdrawalOperation,
  stage: 'cleanup' | 'completion',
): GranularWithdrawalResult {
  return {
    status: 202,
    body: {
      withdrawn: false,
      pending: true,
      retry_required: true,
      ...publicOperation(operation),
      state: 'withdrawing',
      stage,
      error: 'CONSENT_WITHDRAWAL_RETRY_REQUIRED',
    },
  };
}

export async function runGranularWithdrawalLifecycle(
  request: GranularWithdrawalRequest,
  dependencies: GranularWithdrawalDependencies,
): Promise<GranularWithdrawalResult> {
  let begunResult: DependencyResult;
  try {
    begunResult = await dependencies.begin(request);
  } catch {
    return {
      status: 202,
      body: {
        withdrawn: false,
        pending: true,
        retry_required: true,
        state_unknown: true,
        consent_type: request.consentType,
        stage: 'begin',
        error: 'CONSENT_WITHDRAWAL_BEGIN_OUTCOME_UNKNOWN',
      },
    };
  }
  if (begunResult.error) {
    if (!definiteRpcRejection(begunResult.error)) {
      return {
        status: 202,
        body: {
          withdrawn: false,
          pending: true,
          retry_required: true,
          state_unknown: true,
          consent_type: request.consentType,
          stage: 'begin',
          error: 'CONSENT_WITHDRAWAL_BEGIN_OUTCOME_UNKNOWN',
        },
      };
    }
    return {
      status: 409,
      body: {
        withdrawn: false,
        pending: false,
        retry_required: false,
        state_unknown: false,
        consent_type: request.consentType,
        stage: 'begin',
        error: 'CONSENT_WITHDRAWAL_BEGIN_REJECTED',
      },
    };
  }

  const begun = operationFromRpc(
    begunResult,
    request,
    dependencies.authenticatedUserId,
  );
  if (!begun) {
    return {
      status: 502,
      body: {
        withdrawn: false,
        pending: true,
        retry_required: true,
        state_unknown: true,
        consent_type: request.consentType,
        stage: 'begin',
        error: 'CONSENT_WITHDRAWAL_ATTESTATION_FAILED',
      },
    };
  }

  // A replay after a lost success response must not repeat destructive work.
  if (begun.state === 'withdrawn') {
    return {
      status: 200,
      body: {
        withdrawn: true,
        pending: false,
        retry_required: false,
        ...publicOperation(begun),
        replayed: true,
      },
    };
  }

  let cleanup: Record<string, number | boolean>;
  try {
    cleanup = await dependencies.cleanup(begun);
  } catch {
    // This authenticated lane has no worker lease, so it cannot truthfully
    // claim the database operation is action_required. The scheduled lane can
    // claim this still-pending operation and perform the durable transition.
    return retryResult(begun, 'cleanup');
  }
  if (!granularCleanupReadyForCompletion(begun.consentType, cleanup)) {
    return retryResult(begun, 'cleanup');
  }

  let completedResult: DependencyResult;
  try {
    completedResult = await dependencies.complete(begun.operationId);
  } catch {
    return retryResult(begun, 'completion');
  }
  const completed = sameTerminalOperation(completedResult, begun);
  if (!completed) return retryResult(begun, 'completion');

  return {
    status: 200,
    body: {
      withdrawn: true,
      pending: false,
      retry_required: false,
      ...publicOperation(completed),
      cleanup,
      replayed: false,
    },
  };
}

function attestIdRows(value: unknown, maximum: number): string[] {
  if (!Array.isArray(value) || value.length > maximum) fail();
  const ids: string[] = [];
  for (const row of value) {
    if (
      !isRecord(row) ||
      !exactKeys(row, ['id']) ||
      !validUuid(row.id)
    ) {
      fail();
    }
    ids.push(row.id);
  }
  if (new Set(ids).size !== ids.length) fail();
  return ids;
}

function attestExactIds(value: unknown, expectedIds: readonly string[]): void {
  const returned = attestIdRows(value, expectedIds.length);
  if (
    returned.length !== expectedIds.length ||
    returned.some((id) => !expectedIds.includes(id))
  ) {
    fail();
  }
}

export async function runBoundedRowDelete(
  dependencies: BoundedRowDeleteDependencies,
): Promise<BoundedRowDeleteResult> {
  const listed = await dependencies.listRows(
    GRANULAR_DB_MAX_ROWS_PER_SCOPE + 1,
  );
  if (listed.error) fail();
  const listedIds = attestIdRows(
    listed.data,
    GRANULAR_DB_MAX_ROWS_PER_SCOPE + 1,
  );
  const ids = listedIds.slice(0, GRANULAR_DB_MAX_ROWS_PER_SCOPE);

  for (let offset = 0; offset < ids.length; offset += GRANULAR_DB_BATCH_SIZE) {
    const batch = ids.slice(offset, offset + GRANULAR_DB_BATCH_SIZE);
    const deleted = await dependencies.deleteRows(batch);
    if (deleted.error) fail();
    attestExactIds(deleted.data, batch);
    const remaining = await dependencies.findRows(batch);
    if (
      remaining.error || attestIdRows(remaining.data, batch.length).length !== 0
    ) fail();
  }

  return {
    deleted: ids.length,
    more_pending: listedIds.length > GRANULAR_DB_MAX_ROWS_PER_SCOPE,
  };
}

type AskTurnRow = { id: string; sessionId: string };

function attestAskTurnRows(
  value: unknown,
  maximum: number,
  allowedSessionIds: readonly string[],
): AskTurnRow[] {
  if (!Array.isArray(value) || value.length > maximum) fail();
  const allowedSessions = new Set(allowedSessionIds);
  const rows: AskTurnRow[] = [];
  for (const row of value) {
    if (
      !isRecord(row) ||
      !exactKeys(row, ['id', 'session_id']) ||
      !validUuid(row.id) ||
      !validUuid(row.session_id) ||
      !allowedSessions.has(row.session_id)
    ) {
      fail();
    }
    rows.push({ id: row.id, sessionId: row.session_id });
  }
  if (new Set(rows.map((row) => row.id)).size !== rows.length) fail();
  return rows;
}

function attestExactAskTurnRows(
  value: unknown,
  expectedRows: readonly AskTurnRow[],
): void {
  const returned = attestAskTurnRows(
    value,
    expectedRows.length,
    expectedRows.map((row) => row.sessionId),
  );
  const expected = new Map(
    expectedRows.map((row) => [row.id, row.sessionId] as const),
  );
  if (
    returned.length !== expectedRows.length ||
    returned.some((row) => expected.get(row.id) !== row.sessionId)
  ) {
    fail();
  }
}

/**
 * Deletes the Ask graph child-first. Safety rows are handled by the caller
 * before entering this helper; the safety lookup prevents an invalid legacy
 * cross-owner child from being cascaded through a turn deletion.
 */
export async function runAskLayerwellCleanup(
  dependencies: AskLayerwellCleanupDependencies,
): Promise<AskLayerwellCleanupResult> {
  const listedSessions = await dependencies.listSessionRows(
    GRANULAR_DB_MAX_ROWS_PER_SCOPE + 1,
  );
  if (listedSessions.error) fail();
  const sessionInventory = attestIdRows(
    listedSessions.data,
    GRANULAR_DB_MAX_ROWS_PER_SCOPE + 1,
  );
  const sessionIds = sessionInventory.slice(
    0,
    GRANULAR_DB_MAX_ROWS_PER_SCOPE,
  );
  if (sessionIds.length === 0) {
    return {
      ask_turn_audit_deleted: 0,
      ask_sessions_deleted: 0,
      more_pending: false,
    };
  }

  const listedTurns = await dependencies.listTurnRows(
    sessionIds,
    GRANULAR_DB_MAX_ROWS_PER_SCOPE + 1,
  );
  if (listedTurns.error) fail();
  const turnInventory = attestAskTurnRows(
    listedTurns.data,
    GRANULAR_DB_MAX_ROWS_PER_SCOPE + 1,
    sessionIds,
  );
  const turns = turnInventory.slice(0, GRANULAR_DB_MAX_ROWS_PER_SCOPE);

  for (
    let offset = 0;
    offset < turns.length;
    offset += GRANULAR_DB_BATCH_SIZE
  ) {
    const batch = turns.slice(offset, offset + GRANULAR_DB_BATCH_SIZE);
    const batchIds = batch.map((row) => row.id);
    const safetyRows = await dependencies.findSafetyRowsForTurns(batchIds);
    if (safetyRows.error) fail();
    if (
      attestIdRows(safetyRows.data, GRANULAR_DB_BATCH_SIZE).length !== 0
    ) actionRequired();
    const deleted = await dependencies.deleteTurnRows(batchIds);
    if (deleted.error) fail();
    attestExactAskTurnRows(deleted.data, batch);
    const remaining = await dependencies.findTurnRows(batchIds);
    if (
      remaining.error ||
      attestAskTurnRows(
          remaining.data,
          batch.length,
          sessionIds,
        ).length !== 0
    ) {
      fail();
    }
  }

  if (turnInventory.length > GRANULAR_DB_MAX_ROWS_PER_SCOPE) {
    return {
      ask_turn_audit_deleted: turns.length,
      ask_sessions_deleted: 0,
      more_pending: true,
    };
  }

  const turnsAfterDelete = await dependencies.listTurnRows(sessionIds, 1);
  if (
    turnsAfterDelete.error ||
    attestAskTurnRows(turnsAfterDelete.data, 1, sessionIds).length !== 0
  ) {
    return {
      ask_turn_audit_deleted: turns.length,
      ask_sessions_deleted: 0,
      more_pending: true,
    };
  }

  for (
    let offset = 0;
    offset < sessionIds.length;
    offset += GRANULAR_DB_BATCH_SIZE
  ) {
    const batch = sessionIds.slice(offset, offset + GRANULAR_DB_BATCH_SIZE);
    const deleted = await dependencies.deleteSessionRows(batch);
    if (deleted.error) fail();
    attestExactIds(deleted.data, batch);
    const remaining = await dependencies.findSessionRows(batch);
    if (
      remaining.error ||
      attestIdRows(remaining.data, batch.length).length !== 0
    ) {
      fail();
    }
  }

  return {
    ask_turn_audit_deleted: turns.length,
    ask_sessions_deleted: sessionIds.length,
    more_pending: sessionInventory.length > GRANULAR_DB_MAX_ROWS_PER_SCOPE,
  };
}

type ClickRow = { id: string; clickToken: string | null };

function attestClickRows(value: unknown): ClickRow[] {
  if (
    !Array.isArray(value) || value.length > GRANULAR_DB_MAX_ROWS_PER_SCOPE + 1
  ) fail();
  const rows: ClickRow[] = [];
  for (const row of value) {
    if (
      !isRecord(row) ||
      !exactKeys(row, ['id', 'click_token']) ||
      !validUuid(row.id) ||
      !(
        row.click_token === null ||
        (typeof row.click_token === 'string' &&
          row.click_token.length >= 16 &&
          row.click_token.length <= 256 &&
          row.click_token === row.click_token.trim())
      )
    ) {
      fail();
    }
    rows.push({ id: row.id, clickToken: row.click_token });
  }
  if (new Set(rows.map((row) => row.id)).size !== rows.length) fail();
  return rows;
}

export async function runDataSharingCleanup(
  dependencies: DataSharingCleanupDependencies,
): Promise<DataSharingCleanupResult> {
  const listedClicks = await dependencies.listClickRows(
    GRANULAR_DB_MAX_ROWS_PER_SCOPE + 1,
  );
  if (listedClicks.error) fail();
  const clickInventory = attestClickRows(listedClicks.data);
  const clicks = clickInventory.slice(0, GRANULAR_DB_MAX_ROWS_PER_SCOPE);
  const clickIds = clicks.map((row) => row.id);
  const clickTokens = [
    ...new Set(
      clicks.map((row) => row.clickToken).filter((token): token is string =>
        token !== null
      ),
    ),
  ];

  let detachedCount = 0;
  if (clickTokens.length > 0) {
    const listedAttributions = await dependencies.listAttributionRows(
      clickTokens,
      GRANULAR_DB_MAX_ROWS_PER_SCOPE + 1,
    );
    if (listedAttributions.error) fail();
    const attributionInventory = attestIdRows(
      listedAttributions.data,
      GRANULAR_DB_MAX_ROWS_PER_SCOPE + 1,
    );
    const attributionIds = attributionInventory.slice(
      0,
      GRANULAR_DB_MAX_ROWS_PER_SCOPE,
    );
    for (
      let offset = 0;
      offset < attributionIds.length;
      offset += GRANULAR_DB_BATCH_SIZE
    ) {
      const batch = attributionIds.slice(
        offset,
        offset + GRANULAR_DB_BATCH_SIZE,
      );
      const detached = await dependencies.detachAttributions(batch);
      if (detached.error) fail();
      attestExactIds(detached.data, batch);
      detachedCount += batch.length;
    }

    // Never delete the source click rows until every matching attribution is
    // verifiably detached. A concurrent insert should be impossible behind the
    // durable database barrier; this read-back and completion RPC defend in depth.
    const remainingAttributions = await dependencies.findAttributions(
      clickTokens,
    );
    if (remainingAttributions.error) fail();
    const remainingIds = attestIdRows(
      remainingAttributions.data,
      GRANULAR_DB_MAX_ROWS_PER_SCOPE + 1,
    );
    if (remainingIds.length > 0) {
      return {
        order_attributions_detached: detachedCount,
        commerce_click_events_deleted: 0,
        more_pending: true,
      };
    }
  }

  for (
    let offset = 0;
    offset < clickIds.length;
    offset += GRANULAR_DB_BATCH_SIZE
  ) {
    const batch = clickIds.slice(offset, offset + GRANULAR_DB_BATCH_SIZE);
    const deleted = await dependencies.deleteClickRows(batch);
    if (deleted.error) fail();
    attestExactIds(deleted.data, batch);
    const remaining = await dependencies.findClickRows(batch);
    if (
      remaining.error || attestIdRows(remaining.data, batch.length).length !== 0
    ) fail();
  }

  return {
    order_attributions_detached: detachedCount,
    commerce_click_events_deleted: clickIds.length,
    more_pending: clickInventory.length > GRANULAR_DB_MAX_ROWS_PER_SCOPE,
  };
}

function attestCount(value: unknown): number {
  if (!Number.isSafeInteger(value) || (value as number) < 0) photoFail();
  // Cloud backup is unavailable in this build. More than this legacy-provider
  // bound is an explicit operator escalation, not an unbounded Edge invocation
  // or an endlessly retrying operation that can never make progress.
  if ((value as number) > GRANULAR_PHOTO_MAX_ROWS) actionRequired();
  return value as number;
}

function attestPhotoRows(value: unknown, userId: string): string[] {
  if (!Array.isArray(value) || value.length > GRANULAR_PHOTO_MAX_ROWS) {
    photoFail();
  }
  const ids: string[] = [];
  for (const row of value) {
    if (
      !isRecord(row) ||
      !exactKeys(row, ['id', 'storage_path']) ||
      typeof row.id !== 'string' ||
      !UUID_PATTERN.test(row.id) ||
      !(
        row.storage_path === null ||
        (typeof row.storage_path === 'string' &&
          photoPathBelongsToUser(userId, row.storage_path))
      )
    ) {
      photoFail();
    }
    ids.push(row.id);
  }
  if (new Set(ids).size !== ids.length) photoFail();
  return ids;
}

function attestStoragePaths(value: unknown, userId: string): string[] {
  if (
    !Array.isArray(value) || value.length > GRANULAR_PHOTO_MAX_STORAGE_OBJECTS
  ) photoFail();
  const paths: string[] = [];
  for (const path of value) {
    if (typeof path !== 'string' || !photoPathBelongsToUser(userId, path)) {
      photoFail();
    }
    paths.push(path);
  }
  if (new Set(paths).size !== paths.length) photoFail();
  return paths;
}

function attestMutatedPhotoRows(
  value: unknown,
  expectedIds: readonly string[],
): void {
  if (!Array.isArray(value) || value.length > GRANULAR_PHOTO_MAX_ROWS) {
    photoFail();
  }
  const ids: string[] = [];
  for (const row of value) {
    if (
      !isRecord(row) ||
      !exactKeys(row, ['id']) ||
      typeof row.id !== 'string' ||
      !UUID_PATTERN.test(row.id)
    ) {
      photoFail();
    }
    ids.push(row.id);
  }
  if (
    ids.length !== expectedIds.length ||
    new Set(ids).size !== ids.length ||
    ids.some((id) => !expectedIds.includes(id))
  ) {
    photoFail();
  }
}

const STORAGE_PROVIDER_BOUND_REASONS = [
  'OBJECT_LIMIT_EXCEEDED',
  'PATH_DEPTH_LIMIT_EXCEEDED',
  'PREFIX_LIMIT_EXCEEDED',
  'PAGE_REQUEST_LIMIT_EXCEEDED',
] as const;

async function verifiedStoragePaths(
  userId: string,
  dependencies: Pick<
    GranularPhotoCloudCleanupDependencies,
    'listVerifiedStoragePaths'
  >,
): Promise<string[]> {
  try {
    return attestStoragePaths(
      await dependencies.listVerifiedStoragePaths(),
      userId,
    );
  } catch (error) {
    if (
      error instanceof Error &&
      STORAGE_PROVIDER_BOUND_REASONS.some((reason) =>
        error.message.includes(reason)
      )
    ) {
      actionRequired();
    }
    photoFail();
  }
}

async function removeGranularPhotoRemoteResidue(
  userId: string,
  dependencies: Omit<
    GranularPhotoCloudCleanupDependencies,
    'relocalizePhotoRows'
  >,
): Promise<{ photoIds: string[]; removedStorageCount: number }> {
  if (!photoPathBelongsToUser(userId, `${userId}/ownership-check`)) photoFail();

  const counted = await dependencies.countPhotoRows();
  if (counted.error) photoFail();
  const photoRowCount = attestCount(counted.count);
  const photoRows = await dependencies.listPhotoRows(
    GRANULAR_PHOTO_MAX_ROWS + 1,
  );
  if (photoRows.error) photoFail();
  const photoIds = attestPhotoRows(photoRows.data, userId);
  if (photoIds.length !== photoRowCount) photoFail();

  const storagePaths = await verifiedStoragePaths(userId, dependencies);
  for (
    let offset = 0;
    offset < storagePaths.length;
    offset += GRANULAR_PHOTO_STORAGE_BATCH_SIZE
  ) {
    const batch = storagePaths.slice(
      offset,
      offset + GRANULAR_PHOTO_STORAGE_BATCH_SIZE,
    );
    let removed: { error: unknown };
    try {
      removed = await dependencies.removeStorage(batch);
    } catch {
      photoFail();
    }
    if (removed.error) photoFail();
  }

  if ((await verifiedStoragePaths(userId, dependencies)).length !== 0) {
    photoFail();
  }
  return { photoIds, removedStorageCount: storagePaths.length };
}

export async function runGranularPhotoCloudCleanup(
  userId: string,
  dependencies: GranularPhotoCloudCleanupDependencies,
): Promise<GranularPhotoCloudCleanupResult> {
  const { photoIds, removedStorageCount } =
    await removeGranularPhotoRemoteResidue(userId, dependencies);
  const relocalized = await dependencies.relocalizePhotoRows(photoIds);
  if (relocalized.error) photoFail();
  attestMutatedPhotoRows(relocalized.data, photoIds);

  // Re-attest after the metadata write as a final fail-closed guard against a
  // provider success response that did not actually remove every object.
  if ((await verifiedStoragePaths(userId, dependencies)).length !== 0) {
    photoFail();
  }

  return {
    photo_rows_relocalized: photoIds.length,
    storage_objects_removed: removedStorageCount,
    skipped_storage_paths: 0,
  };
}

export async function runGranularPhotoCaptureCleanup(
  userId: string,
  dependencies: GranularPhotoCaptureCleanupDependencies,
): Promise<GranularPhotoCaptureCleanupResult> {
  const { photoIds, removedStorageCount } =
    await removeGranularPhotoRemoteResidue(userId, dependencies);
  const deleted = await dependencies.deletePhotoRows(photoIds);
  if (deleted.error) photoFail();
  attestMutatedPhotoRows(deleted.data, photoIds);

  if ((await verifiedStoragePaths(userId, dependencies)).length !== 0) {
    photoFail();
  }

  return {
    remote_photo_rows_deleted: photoIds.length,
    storage_objects_removed: removedStorageCount,
    skipped_storage_paths: 0,
    local_device_cleanup_claimed: false,
  };
}
