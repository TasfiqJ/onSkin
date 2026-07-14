import {
  ACCOUNT_DELETION_CLAIM_MODES,
  ACCOUNT_DELETION_STEP_NAMES,
  type AccountDeletionClaim,
  type AccountDeletionClaimMode,
  type ReadyAccountDeletion,
} from './durableDeletionWorker.ts';
import {
  type AccountDeletionStatusRow,
  deletionStatusLookupFromDatabaseRow,
} from './durableDeletionRuntimeCore.ts';

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;
const TOKEN_PATTERN = /^[a-f0-9]{64}$/;
const BYTEA_PATTERN = /^\\x[a-f0-9]+$/;

export type DeletionRpcResult = { data: unknown; error: unknown };
export type DeletionRpcClient = {
  rpc: (name: string, args: Record<string, unknown>) => Promise<DeletionRpcResult>;
};

export type BeginAccountDeletionInput = {
  userId: string;
  idempotencyKey: string;
  capability: string;
  operationExpiresAt: string;
  appleEncryptedPayload: string;
  revenueCatEncryptedPayload: string | null;
  postHogEncryptedPayload: string | null;
};

export type RecordDeletionStepInput = {
  operationId: string;
  stepName: AccountDeletionClaim['stepName'];
  claimToken: string;
  outcome: 'succeeded' | 'retryable' | 'ambiguous' | 'action_required';
  resultCode: string;
  retryAt: string | null;
};

export type DeletionClaimCasIdentity = Pick<
  AccountDeletionClaim,
  'operationId' | 'userId' | 'stepName' | 'claimMode' | 'claimToken'
>;

export class DurableDeletionDatabaseError extends Error {
  constructor(
    public readonly code:
      | 'DELETION_DATABASE_UNAVAILABLE'
      | 'DELETION_DATABASE_RESPONSE_INVALID'
      | 'DELETION_DATABASE_INPUT_INVALID',
  ) {
    super(code);
    this.name = 'DurableDeletionDatabaseError';
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

function hasExactKeys(value: Record<string, unknown>, keys: readonly string[]): boolean {
  const actual = Object.keys(value).sort();
  const expected = [...keys].sort();
  return actual.length === expected.length && actual.every((key, index) => key === expected[index]);
}

function oneRow(data: unknown): Record<string, unknown> {
  const row = Array.isArray(data) ? (data.length === 1 ? data[0] : null) : data;
  if (!isRecord(row)) {
    throw new DurableDeletionDatabaseError('DELETION_DATABASE_RESPONSE_INVALID');
  }
  return row;
}

function rows(data: unknown): Record<string, unknown>[] {
  if (!Array.isArray(data) || data.some((row) => !isRecord(row))) {
    throw new DurableDeletionDatabaseError('DELETION_DATABASE_RESPONSE_INVALID');
  }
  return data as Record<string, unknown>[];
}

function validIso(value: unknown): value is string {
  return typeof value === 'string' && Number.isFinite(Date.parse(value));
}

function validUuid(value: unknown): value is string {
  return typeof value === 'string' && UUID_PATTERN.test(value);
}

function validBytea(value: unknown): value is string {
  return (
    typeof value === 'string' &&
    value.length >= 4 &&
    value.length % 2 === 0 &&
    BYTEA_PATTERN.test(value)
  );
}

function validClaimIdentity(claim: unknown): claim is DeletionClaimCasIdentity {
  return (
    isRecord(claim) &&
    validUuid(claim.operationId) &&
    validUuid(claim.userId) &&
    ACCOUNT_DELETION_STEP_NAMES.includes(claim.stepName as never) &&
    ACCOUNT_DELETION_CLAIM_MODES.includes(claim.claimMode as never) &&
    typeof claim.claimToken === 'string' &&
    TOKEN_PATTERN.test(claim.claimToken)
  );
}

function nonNegativeSafeInteger(value: unknown): value is number {
  return typeof value === 'number' && Number.isSafeInteger(value) && value >= 0;
}

export class DurableDeletionDatabaseGateway {
  constructor(private readonly client: DeletionRpcClient) {
    if (!isRecord(client) || typeof client.rpc !== 'function') {
      throw new DurableDeletionDatabaseError('DELETION_DATABASE_INPUT_INVALID');
    }
  }

  private async call(name: string, args: Record<string, unknown>): Promise<unknown> {
    let result: DeletionRpcResult;
    try {
      result = await this.client.rpc(name, args);
    } catch {
      throw new DurableDeletionDatabaseError('DELETION_DATABASE_UNAVAILABLE');
    }
    if (!isRecord(result) || !hasExactKeys(result, ['data', 'error'])) {
      throw new DurableDeletionDatabaseError('DELETION_DATABASE_RESPONSE_INVALID');
    }
    if (result.error !== null) {
      throw new DurableDeletionDatabaseError('DELETION_DATABASE_UNAVAILABLE');
    }
    return result.data;
  }

  async begin(input: BeginAccountDeletionInput): Promise<{
    operationId: string;
    operationState: string;
    operationExpiresAt: string;
    created: boolean;
  }> {
    if (
      !isRecord(input) ||
      !hasExactKeys(input, [
        'userId',
        'idempotencyKey',
        'capability',
        'operationExpiresAt',
        'appleEncryptedPayload',
        'revenueCatEncryptedPayload',
        'postHogEncryptedPayload',
      ]) ||
      !validUuid(input.userId) ||
      !TOKEN_PATTERN.test(input.idempotencyKey) ||
      !TOKEN_PATTERN.test(input.capability) ||
      input.idempotencyKey === input.capability ||
      !validIso(input.operationExpiresAt) ||
      !validBytea(input.appleEncryptedPayload) ||
      !(
        input.revenueCatEncryptedPayload === null || validBytea(input.revenueCatEncryptedPayload)
      ) ||
      !(input.postHogEncryptedPayload === null || validBytea(input.postHogEncryptedPayload))
    ) {
      throw new DurableDeletionDatabaseError('DELETION_DATABASE_INPUT_INVALID');
    }
    const row = oneRow(
      await this.call('begin_account_deletion', {
        p_user_id: input.userId,
        p_idempotency_key: input.idempotencyKey,
        p_capability: input.capability,
        p_operation_expires_at: input.operationExpiresAt,
        p_apple_encrypted_credential: input.appleEncryptedPayload,
        p_revenuecat_encrypted_reconciliation: input.revenueCatEncryptedPayload,
        p_posthog_encrypted_reconciliation: input.postHogEncryptedPayload,
      }),
    );
    if (
      !hasExactKeys(row, ['operation_id', 'operation_state', 'operation_expires_at', 'created']) ||
      !validUuid(row.operation_id) ||
      typeof row.operation_state !== 'string' ||
      !['pending', 'running', 'ready_to_finalize', 'action_required'].includes(
        row.operation_state,
      ) ||
      !validIso(row.operation_expires_at) ||
      typeof row.created !== 'boolean'
    ) {
      throw new DurableDeletionDatabaseError('DELETION_DATABASE_RESPONSE_INVALID');
    }
    return {
      operationId: row.operation_id,
      operationState: row.operation_state,
      operationExpiresAt: row.operation_expires_at,
      created: row.created,
    };
  }

  async status(capability: string): Promise<AccountDeletionStatusRow | null> {
    if (!TOKEN_PATTERN.test(capability)) {
      throw new DurableDeletionDatabaseError('DELETION_DATABASE_INPUT_INVALID');
    }
    const result = rows(
      await this.call('get_account_deletion_status', {
        p_capability: capability,
      }),
    );
    if (result.length === 0) return null;
    if (result.length !== 1) {
      throw new DurableDeletionDatabaseError('DELETION_DATABASE_RESPONSE_INVALID');
    }
    try {
      deletionStatusLookupFromDatabaseRow(result[0]);
    } catch {
      throw new DurableDeletionDatabaseError('DELETION_DATABASE_RESPONSE_INVALID');
    }
    return result[0] as unknown as AccountDeletionStatusRow;
  }

  async barrierState(userId: string): Promise<'clear' | 'active'> {
    if (!validUuid(userId)) {
      throw new DurableDeletionDatabaseError('DELETION_DATABASE_INPUT_INVALID');
    }
    const result = await this.call('get_account_deletion_barrier_state', {
      p_user_id: userId,
    });
    if (result !== 'clear' && result !== 'active') {
      throw new DurableDeletionDatabaseError('DELETION_DATABASE_RESPONSE_INVALID');
    }
    return result;
  }

  async claimNext(
    mode: AccountDeletionClaimMode,
    leaseSeconds = 120,
  ): Promise<AccountDeletionClaim | null> {
    if (
      !ACCOUNT_DELETION_CLAIM_MODES.includes(mode) ||
      !Number.isSafeInteger(leaseSeconds) ||
      leaseSeconds < 15 ||
      leaseSeconds > 900
    ) {
      throw new DurableDeletionDatabaseError('DELETION_DATABASE_INPUT_INVALID');
    }
    const result = rows(
      await this.call('claim_next_account_deletion_step', {
        p_claim_mode: mode,
        p_lease_seconds: leaseSeconds,
      }),
    );
    if (result.length === 0) return null;
    if (result.length !== 1) {
      throw new DurableDeletionDatabaseError('DELETION_DATABASE_RESPONSE_INVALID');
    }
    const row = result[0];
    if (
      !hasExactKeys(row, [
        'operation_id',
        'user_id',
        'operation_state',
        'step_name',
        'step_status',
        'claim_mode',
        'claim_token',
        'attempt_count',
        'request_started_at',
        'lease_expires_at',
        'encrypted_payload',
      ]) ||
      !validUuid(row.operation_id) ||
      !validUuid(row.user_id) ||
      !['pending', 'running', 'action_required'].includes(String(row.operation_state)) ||
      !ACCOUNT_DELETION_STEP_NAMES.includes(row.step_name as never) ||
      row.step_status !== 'leased' ||
      !ACCOUNT_DELETION_CLAIM_MODES.includes(row.claim_mode as never) ||
      typeof row.claim_token !== 'string' ||
      !TOKEN_PATTERN.test(row.claim_token) ||
      typeof row.attempt_count !== 'number' ||
      !Number.isSafeInteger(row.attempt_count) ||
      row.attempt_count < 1 ||
      !(row.request_started_at === null || validIso(row.request_started_at)) ||
      !validIso(row.lease_expires_at) ||
      !(row.encrypted_payload === null || validBytea(row.encrypted_payload))
    ) {
      throw new DurableDeletionDatabaseError('DELETION_DATABASE_RESPONSE_INVALID');
    }
    return {
      operationId: row.operation_id,
      userId: row.user_id,
      operationState: row.operation_state as AccountDeletionClaim['operationState'],
      stepName: row.step_name as AccountDeletionClaim['stepName'],
      stepStatus: 'leased',
      claimMode: row.claim_mode as AccountDeletionClaimMode,
      claimToken: row.claim_token,
      attemptCount: row.attempt_count,
      requestStartedAt: row.request_started_at as string | null,
      leaseExpiresAt: row.lease_expires_at,
      encryptedPayload: row.encrypted_payload as string | null,
    };
  }

  /**
   * Claims at most one step from the operation that a just-committed intake
   * created. This is deliberately separate from the global Cron queue so an
   * authenticated intake cannot fan out work for unrelated accounts.
   */
  async claimOperation(
    operationId: string,
    userId: string,
    mode: AccountDeletionClaimMode,
    leaseSeconds = 120,
  ): Promise<AccountDeletionClaim | null> {
    if (
      !validUuid(operationId) ||
      !validUuid(userId) ||
      !ACCOUNT_DELETION_CLAIM_MODES.includes(mode) ||
      !Number.isSafeInteger(leaseSeconds) ||
      leaseSeconds < 15 ||
      leaseSeconds > 900
    ) {
      throw new DurableDeletionDatabaseError('DELETION_DATABASE_INPUT_INVALID');
    }
    const result = rows(
      await this.call('claim_account_deletion_step', {
        p_operation_id: operationId,
        p_claim_mode: mode,
        p_lease_seconds: leaseSeconds,
      }),
    );
    if (result.length !== 1) {
      throw new DurableDeletionDatabaseError('DELETION_DATABASE_RESPONSE_INVALID');
    }
    const row = result[0];
    if (
      !hasExactKeys(row, [
        'claimed',
        'operation_state',
        'step_name',
        'step_status',
        'claim_mode',
        'claim_token',
        'attempt_count',
        'request_started_at',
        'lease_expires_at',
        'encrypted_payload',
      ]) ||
      typeof row.claimed !== 'boolean' ||
      !['pending', 'running', 'action_required', 'ready_to_finalize'].includes(
        String(row.operation_state),
      )
    ) {
      throw new DurableDeletionDatabaseError('DELETION_DATABASE_RESPONSE_INVALID');
    }
    if (!row.claimed) return null;
    if (
      !['pending', 'running', 'action_required'].includes(String(row.operation_state)) ||
      !ACCOUNT_DELETION_STEP_NAMES.includes(row.step_name as never) ||
      row.step_status !== 'leased' ||
      !ACCOUNT_DELETION_CLAIM_MODES.includes(row.claim_mode as never) ||
      typeof row.claim_token !== 'string' ||
      !TOKEN_PATTERN.test(row.claim_token) ||
      !nonNegativeSafeInteger(row.attempt_count) ||
      row.attempt_count < 1 ||
      !(row.request_started_at === null || validIso(row.request_started_at)) ||
      !validIso(row.lease_expires_at) ||
      !(row.encrypted_payload === null || validBytea(row.encrypted_payload))
    ) {
      throw new DurableDeletionDatabaseError('DELETION_DATABASE_RESPONSE_INVALID');
    }
    return {
      operationId,
      userId,
      operationState: row.operation_state as AccountDeletionClaim['operationState'],
      stepName: row.step_name as AccountDeletionClaim['stepName'],
      stepStatus: 'leased',
      claimMode: row.claim_mode as AccountDeletionClaimMode,
      claimToken: row.claim_token,
      attemptCount: row.attempt_count,
      requestStartedAt: row.request_started_at as string | null,
      leaseExpiresAt: row.lease_expires_at,
      encryptedPayload: row.encrypted_payload as string | null,
    };
  }

  async markRequestStarted(claim: DeletionClaimCasIdentity): Promise<string> {
    if (!validClaimIdentity(claim)) {
      throw new DurableDeletionDatabaseError('DELETION_DATABASE_INPUT_INVALID');
    }
    const row = oneRow(
      await this.call('mark_account_deletion_step_request_started', {
        p_operation_id: claim.operationId,
        p_step_name: claim.stepName,
        p_claim_token: claim.claimToken,
      }),
    );
    if (
      !hasExactKeys(row, ['step_status', 'claim_mode', 'request_started_at', 'lease_expires_at']) ||
      row.step_status !== 'request_started' ||
      row.claim_mode !== claim.claimMode ||
      !validIso(row.request_started_at) ||
      !validIso(row.lease_expires_at)
    ) {
      throw new DurableDeletionDatabaseError('DELETION_DATABASE_RESPONSE_INVALID');
    }
    return row.request_started_at;
  }

  async updatePayload(claim: DeletionClaimCasIdentity, encryptedPayload: string): Promise<void> {
    if (!validClaimIdentity(claim) || !validBytea(encryptedPayload)) {
      throw new DurableDeletionDatabaseError('DELETION_DATABASE_INPUT_INVALID');
    }
    const row = oneRow(
      await this.call('update_account_deletion_step_payload', {
        p_operation_id: claim.operationId,
        p_step_name: claim.stepName,
        p_claim_token: claim.claimToken,
        p_encrypted_payload: encryptedPayload,
      }),
    );
    if (
      !hasExactKeys(row, [
        'step_status',
        'claim_mode',
        'request_started_at',
        'lease_expires_at',
        'encrypted_payload_octets',
        'encrypted_payload_digest',
        'payload_updated_at',
      ]) ||
      !['leased', 'request_started'].includes(String(row.step_status)) ||
      row.claim_mode !== claim.claimMode ||
      !validIso(row.lease_expires_at) ||
      !(row.request_started_at === null || validIso(row.request_started_at)) ||
      !nonNegativeSafeInteger(row.encrypted_payload_octets) ||
      typeof row.encrypted_payload_digest !== 'string' ||
      !TOKEN_PATTERN.test(row.encrypted_payload_digest) ||
      !validIso(row.payload_updated_at)
    ) {
      throw new DurableDeletionDatabaseError('DELETION_DATABASE_RESPONSE_INVALID');
    }
  }

  async record(input: RecordDeletionStepInput): Promise<void> {
    if (
      !isRecord(input) ||
      !hasExactKeys(input, [
        'operationId',
        'stepName',
        'claimToken',
        'outcome',
        'resultCode',
        'retryAt',
      ]) ||
      !validUuid(input.operationId) ||
      !ACCOUNT_DELETION_STEP_NAMES.includes(input.stepName) ||
      !TOKEN_PATTERN.test(input.claimToken) ||
      !['succeeded', 'retryable', 'ambiguous', 'action_required'].includes(input.outcome) ||
      !/^[A-Z0-9_]{1,64}$/.test(input.resultCode) ||
      !(input.retryAt === null || validIso(input.retryAt))
    ) {
      throw new DurableDeletionDatabaseError('DELETION_DATABASE_INPUT_INVALID');
    }
    const row = oneRow(
      await this.call('record_account_deletion_step', {
        p_operation_id: input.operationId,
        p_step_name: input.stepName,
        p_claim_token: input.claimToken,
        p_outcome: input.outcome,
        p_result_code: input.resultCode,
        p_retry_at: input.retryAt,
      }),
    );
    if (
      !hasExactKeys(row, ['operation_state', 'step_status', 'next_attempt_at']) ||
      !['pending', 'running', 'ready_to_finalize', 'action_required'].includes(
        String(row.operation_state),
      ) ||
      ![
        'pending',
        'leased',
        'request_started',
        'ambiguous',
        'succeeded',
        'action_required',
      ].includes(String(row.step_status)) ||
      !(row.next_attempt_at === null || validIso(row.next_attempt_at))
    ) {
      throw new DurableDeletionDatabaseError('DELETION_DATABASE_RESPONSE_INVALID');
    }
  }

  async listReadyToFinalize(limit: number): Promise<ReadyAccountDeletion[]> {
    if (!Number.isSafeInteger(limit) || limit < 1 || limit > 100) {
      throw new DurableDeletionDatabaseError('DELETION_DATABASE_INPUT_INVALID');
    }
    return rows(
      await this.call('list_account_deletions_ready_to_finalize', {
        p_limit: limit,
      }),
    ).map((row) => {
      if (
        !hasExactKeys(row, ['operation_id', 'user_id']) ||
        !validUuid(row.operation_id) ||
        !validUuid(row.user_id)
      ) {
        throw new DurableDeletionDatabaseError('DELETION_DATABASE_RESPONSE_INVALID');
      }
      return { operationId: row.operation_id, userId: row.user_id };
    });
  }

  async finalize(input: {
    operationId: string;
    subjectHmac: string;
    subjectHmacKeyVersion: number;
    receiptExpiresAt: string;
  }): Promise<void> {
    if (
      !isRecord(input) ||
      !hasExactKeys(input, [
        'operationId',
        'subjectHmac',
        'subjectHmacKeyVersion',
        'receiptExpiresAt',
      ]) ||
      !validUuid(input.operationId) ||
      !TOKEN_PATTERN.test(input.subjectHmac) ||
      !Number.isSafeInteger(input.subjectHmacKeyVersion) ||
      input.subjectHmacKeyVersion < 1 ||
      input.subjectHmacKeyVersion > 32_767 ||
      !validIso(input.receiptExpiresAt)
    ) {
      throw new DurableDeletionDatabaseError('DELETION_DATABASE_INPUT_INVALID');
    }
    const row = oneRow(
      await this.call('finalize_account_deletion', {
        p_operation_id: input.operationId,
        p_subject_hmac: input.subjectHmac,
        p_subject_hmac_key_version: input.subjectHmacKeyVersion,
        p_receipt_expires_at: input.receiptExpiresAt,
      }),
    );
    if (
      !hasExactKeys(row, [
        'completed',
        'completed_at',
        'expires_at',
        'apple_manual_revocation_required',
      ]) ||
      row.completed !== true ||
      !validIso(row.completed_at) ||
      !validIso(row.expires_at) ||
      typeof row.apple_manual_revocation_required !== 'boolean'
    ) {
      throw new DurableDeletionDatabaseError('DELETION_DATABASE_RESPONSE_INVALID');
    }
  }

  async listPhotoObjects(
    userId: string,
    afterName: string | null,
    limit: number,
  ): Promise<string[]> {
    if (
      !validUuid(userId) ||
      !(afterName === null || (typeof afterName === 'string' && afterName.length <= 1_024)) ||
      !Number.isSafeInteger(limit) ||
      limit < 1 ||
      limit > 1_000
    ) {
      throw new DurableDeletionDatabaseError('DELETION_DATABASE_INPUT_INVALID');
    }
    return rows(
      await this.call('list_account_photo_storage_objects', {
        p_user_id: userId,
        p_after_name: afterName,
        p_limit: limit,
      }),
    ).map((row) => {
      if (
        !hasExactKeys(row, ['object_name']) ||
        typeof row.object_name !== 'string' ||
        row.object_name.length === 0 ||
        row.object_name.length > 1_024
      ) {
        throw new DurableDeletionDatabaseError('DELETION_DATABASE_RESPONSE_INVALID');
      }
      return row.object_name;
    });
  }

  async countPhotoObjects(userId: string): Promise<number> {
    if (!validUuid(userId)) {
      throw new DurableDeletionDatabaseError('DELETION_DATABASE_INPUT_INVALID');
    }
    const data = await this.call('count_account_photo_storage_objects', {
      p_user_id: userId,
    });
    const value = typeof data === 'string' && /^\d+$/.test(data) ? Number(data) : data;
    if (typeof value !== 'number' || !Number.isSafeInteger(value) || value < 0) {
      throw new DurableDeletionDatabaseError('DELETION_DATABASE_RESPONSE_INVALID');
    }
    return value;
  }

  async purgeExpiredArtifacts(limit: number): Promise<void> {
    if (!Number.isSafeInteger(limit) || limit < 1 || limit > 1_000) {
      throw new DurableDeletionDatabaseError('DELETION_DATABASE_INPUT_INVALID');
    }
    const row = oneRow(
      await this.call('purge_expired_account_deletion_artifacts', {
        p_limit: limit,
      }),
    );
    if (
      !hasExactKeys(row, [
        'receipts_deleted',
        'operations_deleted',
        'encrypted_credentials_redacted',
        'active_accounts_retained',
        'operator_audits_deleted',
      ]) ||
      Object.values(row).some((value) => !nonNegativeSafeInteger(value))
    ) {
      throw new DurableDeletionDatabaseError('DELETION_DATABASE_RESPONSE_INVALID');
    }
  }

  async consumeRateLimit(args: {
    scope: string;
    keyHash: string;
    limit: number;
    windowSeconds: number;
    ownerUserId?: string;
  }): Promise<boolean> {
    const expectedKeys =
      args.ownerUserId === undefined
        ? ['scope', 'keyHash', 'limit', 'windowSeconds']
        : ['scope', 'keyHash', 'limit', 'windowSeconds', 'ownerUserId'];
    if (
      !isRecord(args) ||
      !hasExactKeys(args, expectedKeys) ||
      typeof args.scope !== 'string' ||
      !/^[a-z0-9_-]{1,64}$/.test(args.scope) ||
      !TOKEN_PATTERN.test(args.keyHash) ||
      !Number.isSafeInteger(args.limit) ||
      args.limit < 1 ||
      !Number.isSafeInteger(args.windowSeconds) ||
      args.windowSeconds < 1 ||
      !(args.ownerUserId === undefined || validUuid(args.ownerUserId))
    ) {
      throw new DurableDeletionDatabaseError('DELETION_DATABASE_INPUT_INVALID');
    }
    const data = await this.call('consume_edge_rate_limit', {
      p_scope: args.scope,
      p_key_hash: args.keyHash,
      p_limit: args.limit,
      p_window_seconds: args.windowSeconds,
      ...(args.ownerUserId === undefined ? {} : { p_owner_user_id: args.ownerUserId }),
    });
    if (typeof data !== 'boolean') {
      throw new DurableDeletionDatabaseError('DELETION_DATABASE_RESPONSE_INVALID');
    }
    return data;
  }
}
