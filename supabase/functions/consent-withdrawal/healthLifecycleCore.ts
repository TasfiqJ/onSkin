import { photoPathBelongsToUser } from '../_shared/storagePath.ts';
import {
  CURRENT_HEALTH_CONSENT_DISCLOSURE_CONTRACT,
  healthConsentDisclosureMatches,
} from './healthConsentContract.ts';

export const HEALTH_CONSENT_TYPE = 'health_data_collection' as const;
export const HEALTH_STORAGE_BATCH_SIZE = 100;
export const HEALTH_STORAGE_MAX_BATCHES_PER_REQUEST = 5;
export const HEALTH_CONSENT_COPY_VERSION = CURRENT_HEALTH_CONSENT_DISCLOSURE_CONTRACT.version;
export const HEALTH_CONSENT_GRANT_HASH = CURRENT_HEALTH_CONSENT_DISCLOSURE_CONTRACT.grantTextHash;
export const HEALTH_CONSENT_DECLINE_HASH =
  CURRENT_HEALTH_CONSENT_DISCLOSURE_CONTRACT.declineTextHash;
export const HEALTH_CONSENT_WITHDRAWAL_HASH =
  CURRENT_HEALTH_CONSENT_DISCLOSURE_CONTRACT.withdrawalTextHash;

export type HealthLifecycleState = 'unconsented' | 'active' | 'withdrawing' | 'withdrawn';

export type HealthLifecycleRequest =
  | {
      action: 'withdraw';
      consentType: typeof HEALTH_CONSENT_TYPE;
      expectedProcessingEpoch: number;
      idempotencyKey: string;
      version: string;
      consentTextHash: string;
    }
  | {
      action: 'decline';
      consentType: typeof HEALTH_CONSENT_TYPE;
      expectedProcessingEpoch: number;
      version: string;
      consentTextHash: string;
    }
  | {
      action: 'status' | 'retry';
      consentType: typeof HEALTH_CONSENT_TYPE;
    }
  | {
      action: 'reconsent';
      consentType: typeof HEALTH_CONSENT_TYPE;
      expectedProcessingEpoch: number;
      version: string;
      consentTextHash: string;
    };

export type HealthLifecycleRow = {
  user_id: string;
  state: HealthLifecycleState;
  epoch: number;
  operation_id: string | null;
  operation_state: string | null;
  result_code: string | null;
  server_verified_at: string;
  consent_version: string | null;
  consent_text_hash: string | null;
};

export type HealthLifecycleResult = {
  status: number;
  body: Record<string, unknown>;
};

type RpcResult = { data: unknown; error: unknown };

export type HealthLifecycleDependencies = {
  authenticatedUserId: string;
  begin: (
    request: Extract<HealthLifecycleRequest, { action: 'withdraw' }>,
  ) => PromiseLike<RpcResult>;
  readStatus: () => PromiseLike<RpcResult>;
  prepare: (operationId: string) => PromiseLike<RpcResult>;
  listStorage: (operationId: string, limit: number) => PromiseLike<RpcResult>;
  removeStorage: (paths: string[]) => PromiseLike<{ error: unknown }>;
  complete: (operationId: string) => PromiseLike<RpcResult>;
  reconsent: (
    request: Extract<HealthLifecycleRequest, { action: 'reconsent' }>,
  ) => PromiseLike<RpcResult>;
  decline: (
    request: Extract<HealthLifecycleRequest, { action: 'decline' }>,
  ) => PromiseLike<RpcResult>;
};

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;
const HASH_PATTERN = /^[a-f0-9]{64}$/;
const HEALTH_STATES = new Set<HealthLifecycleState>([
  'unconsented',
  'active',
  'withdrawing',
  'withdrawn',
]);
const OPERATION_STATES = new Set([
  'pending',
  'running',
  'storage_pending',
  'action_required',
  'completed',
]);
const PREPARED_OPERATION_STATES = new Set(['running', 'storage_pending', 'action_required']);
const ACTION_REQUIRED_RESULT_CODES = new Set([
  'UNSAFE_PHOTO_STORAGE_OWNERSHIP',
  'PROCESSOR_INVENTORY_MISMATCH',
]);
const RESULT_CODE_PATTERN = /^[A-Z0-9_]{1,64}$/;

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function hasExactKeys(value: Record<string, unknown>, expected: readonly string[]): boolean {
  const actual = Object.keys(value).sort();
  const wanted = [...expected].sort();
  return actual.length === wanted.length && actual.every((key, index) => key === wanted[index]);
}

function validVersion(value: unknown): value is string {
  return (
    typeof value === 'string' && value === value.trim() && value.length >= 1 && value.length <= 120
  );
}

function validHash(value: unknown): value is string {
  return typeof value === 'string' && HASH_PATTERN.test(value);
}

function validEpoch(value: unknown): value is number {
  return Number.isSafeInteger(value) && (value as number) >= 0;
}

function validActiveEpoch(value: unknown): value is number {
  return Number.isSafeInteger(value) && (value as number) >= 1;
}

function matchesConsentCopy(
  action: 'withdraw' | 'decline' | 'reconsent',
  version: unknown,
  consentTextHash: unknown,
): boolean {
  if (typeof version !== 'string' || typeof consentTextHash !== 'string') {
    return false;
  }
  return healthConsentDisclosureMatches(
    action === 'withdraw' ? 'withdrawal' : action === 'reconsent' ? 'grant' : 'decline',
    version,
    consentTextHash,
  );
}

export function parseHealthLifecycleRequest(value: unknown): HealthLifecycleRequest | null {
  if (!isRecord(value) || value.consentType !== HEALTH_CONSENT_TYPE) {
    return null;
  }
  const action = value.action;
  if (action === 'status' || action === 'retry') {
    if (!hasExactKeys(value, ['action', 'consentType'])) return null;
    return { action, consentType: HEALTH_CONSENT_TYPE };
  }
  if (action === 'withdraw') {
    if (
      !hasExactKeys(value, [
        'action',
        'consentType',
        'expectedProcessingEpoch',
        'idempotencyKey',
        'version',
        'consentTextHash',
      ]) ||
      !validActiveEpoch(value.expectedProcessingEpoch) ||
      !validHash(value.idempotencyKey) ||
      !validVersion(value.version) ||
      !validHash(value.consentTextHash) ||
      !matchesConsentCopy(action, value.version, value.consentTextHash)
    ) {
      return null;
    }
    return {
      action,
      consentType: HEALTH_CONSENT_TYPE,
      expectedProcessingEpoch: value.expectedProcessingEpoch,
      idempotencyKey: value.idempotencyKey,
      version: value.version,
      consentTextHash: value.consentTextHash,
    };
  }
  if (action === 'decline' || action === 'reconsent') {
    if (
      !hasExactKeys(value, [
        'action',
        'consentType',
        'expectedProcessingEpoch',
        'version',
        'consentTextHash',
      ]) ||
      !validEpoch(value.expectedProcessingEpoch) ||
      (action === 'decline' && value.expectedProcessingEpoch !== 0) ||
      !validVersion(value.version) ||
      !validHash(value.consentTextHash) ||
      !matchesConsentCopy(action, value.version, value.consentTextHash)
    ) {
      return null;
    }
    return {
      action,
      consentType: HEALTH_CONSENT_TYPE,
      expectedProcessingEpoch: value.expectedProcessingEpoch,
      version: value.version,
      consentTextHash: value.consentTextHash,
    };
  }
  return null;
}

function oneRow(data: unknown): Record<string, unknown> | null {
  if (isRecord(data)) return data;
  if (Array.isArray(data) && data.length === 1 && isRecord(data[0])) {
    return data[0];
  }
  return null;
}

function isoString(value: unknown): string | null {
  if (typeof value !== 'string' || Number.isNaN(Date.parse(value))) return null;
  return value;
}

export function parseHealthLifecycleRow(data: unknown): HealthLifecycleRow | null {
  const row = oneRow(data);
  if (!row) return null;
  if (
    !hasExactKeys(row, [
      'user_id',
      'state',
      'epoch',
      'operation_id',
      'operation_state',
      'result_code',
      'server_verified_at',
      'consent_version',
      'consent_text_hash',
    ]) ||
    typeof row.user_id !== 'string' ||
    !UUID_PATTERN.test(row.user_id) ||
    typeof row.state !== 'string' ||
    !HEALTH_STATES.has(row.state as HealthLifecycleState) ||
    !Number.isSafeInteger(row.epoch) ||
    (row.epoch as number) < 0 ||
    !(
      row.operation_id === null ||
      (typeof row.operation_id === 'string' && UUID_PATTERN.test(row.operation_id))
    ) ||
    !(
      row.operation_state === null ||
      (typeof row.operation_state === 'string' && OPERATION_STATES.has(row.operation_state))
    ) ||
    !(
      row.result_code === null ||
      (typeof row.result_code === 'string' && RESULT_CODE_PATTERN.test(row.result_code))
    ) ||
    !(row.consent_version === null || validVersion(row.consent_version)) ||
    !(row.consent_text_hash === null || validHash(row.consent_text_hash)) ||
    (row.consent_version === null) !== (row.consent_text_hash === null)
  ) {
    return null;
  }
  const verifiedAt = isoString(row.server_verified_at);
  if (!verifiedAt) return null;
  const state = row.state as HealthLifecycleState;
  const epoch = row.epoch as number;
  const operationId = row.operation_id as string | null;
  const operationState = row.operation_state as string | null;
  const resultCode = row.result_code as string | null;
  const consentVersion = row.consent_version as string | null;
  const consentTextHash = row.consent_text_hash as string | null;
  if (
    (state === 'unconsented' && epoch !== 0) ||
    (state !== 'unconsented' && epoch < 1) ||
    ((state === 'active' || state === 'unconsented') &&
      (operationId !== null || operationState !== null)) ||
    (state === 'active' && resultCode !== null) ||
    (state === 'unconsented' && resultCode !== null && resultCode !== 'HEALTH_CONSENT_DECLINED') ||
    ((state === 'withdrawing' || state === 'withdrawn') &&
      (operationId === null || operationState === null)) ||
    (state === 'withdrawn' &&
      (operationState !== 'completed' || resultCode !== 'HEALTH_WITHDRAWAL_COMPLETED')) ||
    (state === 'withdrawing' && operationState === 'completed') ||
    (state === 'active' &&
      (consentVersion !== HEALTH_CONSENT_COPY_VERSION ||
        consentTextHash !== HEALTH_CONSENT_GRANT_HASH)) ||
    (state !== 'active' && (consentVersion !== null || consentTextHash !== null))
  ) {
    return null;
  }
  return {
    user_id: row.user_id,
    state: row.state as HealthLifecycleState,
    epoch,
    operation_id: row.operation_id as string | null,
    operation_state: row.operation_state as string | null,
    result_code: resultCode,
    server_verified_at: verifiedAt,
    consent_version: consentVersion,
    consent_text_hash: consentTextHash,
  };
}

export type HealthLifecycleExportSnapshot = {
  state: HealthLifecycleState;
  processing_epoch: number;
  operation_state: string | null;
  result_code: string | null;
  consent_version: string | null;
  consent_text_hash: string | null;
  server_verified_at: string;
};

export function healthLifecycleExportSnapshot(
  row: HealthLifecycleRow,
): HealthLifecycleExportSnapshot {
  return {
    state: row.state,
    processing_epoch: row.epoch,
    operation_state: row.operation_state,
    result_code: row.result_code,
    consent_version: row.consent_version,
    consent_text_hash: row.consent_text_hash,
    server_verified_at: row.server_verified_at,
  };
}

export function healthPhotoPathBelongsToEpoch(
  userId: string,
  epoch: number,
  storagePath: string,
): boolean {
  if (!validActiveEpoch(epoch) || !photoPathBelongsToUser(userId, storagePath)) return false;
  return storagePath.split('/')[1] === `e${epoch}`;
}

export function healthPhotoPathSafeForWithdrawal(
  userId: string,
  epoch: number,
  storagePath: string,
): boolean {
  if (!validEpoch(epoch) || !photoPathBelongsToUser(userId, storagePath)) {
    return false;
  }
  if (healthPhotoPathBelongsToEpoch(userId, epoch, storagePath)) return true;
  return !/^e[1-9][0-9]*$/.test(storagePath.split('/')[1] ?? '');
}

function publicStatus(row: HealthLifecycleRow): Record<string, unknown> {
  return {
    state: row.state,
    processing_epoch: row.epoch,
    operation_id: row.operation_id,
    operation_state: row.operation_state,
    result_code: row.result_code,
    server_verified_at: row.server_verified_at,
    consent_version: row.consent_version,
    consent_text_hash: row.consent_text_hash,
  };
}

export type PreparedHealthWithdrawalRow = {
  operation_state: 'running' | 'storage_pending' | 'action_required';
  result_code: string;
  pending_storage_objects: number;
};

export function parsePreparedHealthWithdrawalRow(
  data: unknown,
): PreparedHealthWithdrawalRow | null {
  const row = oneRow(data);
  if (
    !row ||
    !hasExactKeys(row, ['operation_state', 'result_code', 'pending_storage_objects']) ||
    typeof row.operation_state !== 'string' ||
    !PREPARED_OPERATION_STATES.has(row.operation_state) ||
    typeof row.result_code !== 'string' ||
    !RESULT_CODE_PATTERN.test(row.result_code) ||
    !Number.isSafeInteger(row.pending_storage_objects) ||
    (row.pending_storage_objects as number) < 0
  ) {
    return null;
  }
  const operationState = row.operation_state as PreparedHealthWithdrawalRow['operation_state'];
  const resultCode = row.result_code;
  const pendingStorageObjects = row.pending_storage_objects as number;
  if (
    (operationState === 'running' &&
      (resultCode !== 'DATABASE_AND_PROCESSORS_RECONCILED' || pendingStorageObjects !== 0)) ||
    (operationState === 'storage_pending' &&
      (resultCode !== 'PHOTO_STORAGE_DELETION_PENDING' || pendingStorageObjects < 1)) ||
    (operationState === 'action_required' && !ACTION_REQUIRED_RESULT_CODES.has(resultCode))
  ) {
    return null;
  }
  return {
    operation_state: operationState,
    result_code: resultCode,
    pending_storage_objects: pendingStorageObjects,
  };
}

function retryable(row: HealthLifecycleRow, code = 'HEALTH_WITHDRAWAL_RETRY_REQUIRED') {
  return {
    status: 202,
    body: {
      withdrawn: false,
      retry_required: true,
      ...publicStatus(row),
      error: code,
    },
  } satisfies HealthLifecycleResult;
}

function parseStoragePaths(data: unknown, userId: string, epoch: number): string[] | null {
  if (!Array.isArray(data) || data.length > HEALTH_STORAGE_BATCH_SIZE) {
    return null;
  }
  const paths: string[] = [];
  for (const entry of data) {
    if (
      !isRecord(entry) ||
      Object.keys(entry).length !== 1 ||
      typeof entry.storage_path !== 'string'
    ) {
      return null;
    }
    if (!healthPhotoPathSafeForWithdrawal(userId, epoch, entry.storage_path)) {
      return null;
    }
    paths.push(entry.storage_path);
  }
  return new Set(paths).size === paths.length ? paths : null;
}

async function drainAndComplete(
  row: HealthLifecycleRow,
  dependencies: HealthLifecycleDependencies,
): Promise<HealthLifecycleResult> {
  if (!row.operation_id) {
    return {
      status: 409,
      body: { error: 'HEALTH_WITHDRAWAL_OPERATION_MISSING' },
    };
  }

  const prepared = await dependencies.prepare(row.operation_id);
  const preparedRow = parsePreparedHealthWithdrawalRow(prepared.data);
  if (prepared.error || !preparedRow) return retryable(row);
  if (preparedRow.operation_state === 'action_required') {
    const refreshed = await dependencies.readStatus();
    const refreshedRow = refreshed.error ? null : parseHealthLifecycleRow(refreshed.data);
    if (
      !refreshedRow ||
      refreshedRow.user_id !== row.user_id ||
      refreshedRow.epoch !== row.epoch ||
      refreshedRow.operation_id !== row.operation_id ||
      refreshedRow.state !== 'withdrawing' ||
      refreshedRow.operation_state !== 'action_required' ||
      refreshedRow.result_code !== preparedRow.result_code
    ) {
      return retryable(row);
    }
    return {
      status: 409,
      body: {
        withdrawn: false,
        retry_required: false,
        ...publicStatus(refreshedRow),
        error: 'HEALTH_WITHDRAWAL_ACTION_REQUIRED',
      },
    };
  }

  for (let batch = 0; batch < HEALTH_STORAGE_MAX_BATCHES_PER_REQUEST; batch += 1) {
    const listed = await dependencies.listStorage(row.operation_id, HEALTH_STORAGE_BATCH_SIZE);
    if (listed.error) return retryable(row);
    const paths = parseStoragePaths(listed.data, row.user_id, row.epoch);
    if (!paths) {
      return {
        status: 409,
        body: {
          withdrawn: false,
          error: 'HEALTH_WITHDRAWAL_STORAGE_ATTESTATION_INVALID',
        },
      };
    }
    if (paths.length === 0) {
      const completed = await dependencies.complete(row.operation_id);
      if (completed.error) return retryable(row);
      const completeRow = parseHealthLifecycleRow(completed.data);
      if (
        !completeRow ||
        completeRow.user_id !== row.user_id ||
        completeRow.epoch !== row.epoch ||
        completeRow.operation_id !== row.operation_id ||
        completeRow.state !== 'withdrawn'
      ) {
        return retryable(row);
      }
      return {
        status: 200,
        body: {
          withdrawn: true,
          retry_required: false,
          ...publicStatus(completeRow),
        },
      };
    }
    const removed = await dependencies.removeStorage(paths);
    if (removed.error) return retryable(row);
  }

  return retryable(row);
}

export async function runHealthLifecycle(
  request: HealthLifecycleRequest,
  dependencies: HealthLifecycleDependencies,
): Promise<HealthLifecycleResult> {
  if (request.action === 'status') {
    const status = await dependencies.readStatus();
    if (status.error) {
      return { status: 503, body: { error: 'HEALTH_DATA_LIFECYCLE_FAILED' } };
    }
    const row = parseHealthLifecycleRow(status.data);
    if (!row || row.user_id !== dependencies.authenticatedUserId) {
      return { status: 503, body: { error: 'HEALTH_DATA_LIFECYCLE_FAILED' } };
    }
    return { status: 200, body: publicStatus(row) };
  }

  if (request.action === 'decline') {
    const result = await dependencies.decline(request);
    if (result.error) {
      return {
        status: 409,
        body: { declined: false, error: 'HEALTH_DECLINE_REJECTED' },
      };
    }
    const row = parseHealthLifecycleRow(result.data);
    if (
      !row ||
      row.user_id !== dependencies.authenticatedUserId ||
      row.state !== 'unconsented' ||
      row.epoch !== request.expectedProcessingEpoch
    ) {
      return {
        status: 503,
        body: { declined: false, error: 'HEALTH_DATA_LIFECYCLE_FAILED' },
      };
    }
    return { status: 200, body: { declined: true, ...publicStatus(row) } };
  }

  if (request.action === 'reconsent') {
    const result = await dependencies.reconsent(request);
    if (result.error) {
      return {
        status: 409,
        body: { reconsented: false, error: 'HEALTH_RECONSENT_REJECTED' },
      };
    }
    const row = parseHealthLifecycleRow(result.data);
    if (
      !row ||
      row.user_id !== dependencies.authenticatedUserId ||
      row.state !== 'active' ||
      (row.epoch !== request.expectedProcessingEpoch &&
        row.epoch !== request.expectedProcessingEpoch + 1)
    ) {
      return {
        status: 503,
        body: { reconsented: false, error: 'HEALTH_DATA_LIFECYCLE_FAILED' },
      };
    }
    return { status: 200, body: { reconsented: true, ...publicStatus(row) } };
  }

  let row: HealthLifecycleRow | null;
  if (request.action === 'withdraw') {
    const begun = await dependencies.begin(request);
    if (begun.error) {
      return {
        status: 409,
        body: { withdrawn: false, error: 'HEALTH_WITHDRAWAL_REJECTED' },
      };
    }
    row = parseHealthLifecycleRow(begun.data);
    if (
      row &&
      (row.user_id !== dependencies.authenticatedUserId ||
        row.epoch !== request.expectedProcessingEpoch)
    ) {
      row = null;
    }
  } else {
    const status = await dependencies.readStatus();
    if (status.error) {
      return { status: 503, body: { error: 'HEALTH_DATA_LIFECYCLE_FAILED' } };
    }
    row = parseHealthLifecycleRow(status.data);
    if (row && row.user_id !== dependencies.authenticatedUserId) row = null;
    if (row?.state === 'withdrawn') {
      return {
        status: 200,
        body: { withdrawn: true, retry_required: false, ...publicStatus(row) },
      };
    }
    if (row?.state !== 'withdrawing') {
      return {
        status: 409,
        body: { withdrawn: false, error: 'HEALTH_WITHDRAWAL_NOT_ACTIVE' },
      };
    }
  }

  if (!row || row.state === 'active' || row.state === 'unconsented') {
    return {
      status: 503,
      body: { withdrawn: false, error: 'HEALTH_DATA_LIFECYCLE_FAILED' },
    };
  }
  if (row.state === 'withdrawn') {
    return {
      status: 200,
      body: { withdrawn: true, retry_required: false, ...publicStatus(row) },
    };
  }
  return drainAndComplete(row, dependencies);
}
