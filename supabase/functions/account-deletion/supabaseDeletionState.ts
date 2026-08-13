import type {
  AccountDeletionState,
  AccountDeletionStateStore,
  AccountDeletionStep,
} from './deletionCore.ts';

type RpcError = {
  message?: string;
};

type RpcResult = {
  data: unknown;
  error: RpcError | null;
};

type RpcClient = {
  rpc(name: string, args: Record<string, unknown>): PromiseLike<RpcResult>;
};

type StateRow = {
  request_id?: unknown;
  next_step?: unknown;
  apple_required?: unknown;
  apple_result?: unknown;
  posthog_result?: unknown;
};

type PreflightRow = {
  request_exists?: unknown;
  apple_required?: unknown;
  next_step?: unknown;
};

const NEXT_STEPS = new Set([
  'revenuecat',
  'posthog',
  'storage',
  'database',
  'sessions',
  'apple',
  'apple_in_progress',
  'providers_final',
  'auth',
  'complete',
]);

function rpcError(error: RpcError | null, fallbackCode: string): Error {
  const message = error?.message ?? '';
  const stateCode = message.match(/ACCOUNT_DELETION_[A-Z0-9_]+/)?.[0];
  return new Error(stateCode ?? fallbackCode);
}

function firstRow(data: unknown): StateRow | null {
  if (Array.isArray(data)) {
    const row = data[0];
    return row && typeof row === 'object' && !Array.isArray(row) ? (row as StateRow) : null;
  }
  return data && typeof data === 'object' && !Array.isArray(data) ? (data as StateRow) : null;
}

function parseState(data: unknown): AccountDeletionState {
  const row = firstRow(data);
  if (
    !row ||
    typeof row.request_id !== 'string' ||
    !NEXT_STEPS.has(String(row.next_step)) ||
    typeof row.apple_required !== 'boolean' ||
    (row.apple_result !== null &&
      row.apple_result !== 'revoked' &&
      row.apple_result !== 'skipped') ||
    (row.posthog_result !== null &&
      row.posthog_result !== 'deleted' &&
      row.posthog_result !== 'already_absent' &&
      row.posthog_result !== 'skipped')
  ) {
    throw new Error('ACCOUNT_DELETION_STATE_INVALID');
  }
  return {
    requestId: row.request_id,
    nextStep: String(row.next_step) as AccountDeletionState['nextStep'],
    appleRequired: row.apple_required,
    appleResult: row.apple_result as AccountDeletionState['appleResult'],
    posthogResult: row.posthog_result as AccountDeletionState['posthogResult'],
  };
}

export type AccountDeletionPreflight = {
  requestExists: boolean;
  appleRequired: boolean;
  nextStep: AccountDeletionState['nextStep'] | null;
};

function parsePreflight(data: unknown): AccountDeletionPreflight {
  const row = firstRow(data) as PreflightRow | null;
  if (
    !row ||
    typeof row.request_exists !== 'boolean' ||
    typeof row.apple_required !== 'boolean' ||
    (row.next_step !== null && !NEXT_STEPS.has(String(row.next_step)))
  ) {
    throw new Error('ACCOUNT_DELETION_STATE_INVALID');
  }
  return {
    requestExists: row.request_exists,
    appleRequired: row.apple_required,
    nextStep:
      row.next_step === null ? null : (String(row.next_step) as AccountDeletionState['nextStep']),
  };
}

export type SupabaseAccountDeletionStateStore = AccountDeletionStateStore & {
  preflight(input: { userId: string; userHash: string }): Promise<AccountDeletionPreflight>;
  eraseDatabaseState(input: {
    requestId: string;
    userId: string;
    leaseToken: string;
  }): Promise<void>;
  lookupCompleted(input: { completionTokenHash: string }): Promise<AccountDeletionState | null>;
};

export function createSupabaseAccountDeletionStateStore(
  supabase: RpcClient,
): SupabaseAccountDeletionStateStore {
  return {
    async preflight(input) {
      const { data, error } = await supabase.rpc('account_deletion_preflight', {
        p_user_id: input.userId,
        p_user_hash: input.userHash,
      });
      if (error) throw rpcError(error, 'ACCOUNT_DELETION_STATE_UNAVAILABLE');
      return parsePreflight(data);
    },

    async claim(input) {
      const { data, error } = await supabase.rpc('account_deletion_claim', {
        p_user_id: input.userId,
        p_user_hash: input.userHash,
        p_apple_required: input.appleRequired,
        p_session_id: input.sessionId,
        p_lease_token: input.leaseToken,
        p_completion_token_hash: input.completionTokenHash,
      });
      if (error) throw rpcError(error, 'ACCOUNT_DELETION_STATE_UNAVAILABLE');
      return parseState(data);
    },

    async checkpoint(input) {
      const { data, error } = await supabase.rpc('account_deletion_checkpoint', {
        p_request_id: input.requestId,
        p_user_id: input.userId,
        p_lease_token: input.leaseToken,
        p_expected_step: input.expectedStep,
        p_result: input.result,
      });
      if (error) throw rpcError(error, 'ACCOUNT_DELETION_STATE_UNAVAILABLE');
      return parseState(data);
    },

    async beginAppleAttempt(input) {
      const { data, error } = await supabase.rpc('account_deletion_begin_apple_attempt', {
        p_request_id: input.requestId,
        p_user_id: input.userId,
        p_lease_token: input.leaseToken,
      });
      if (error) throw rpcError(error, 'ACCOUNT_DELETION_STATE_UNAVAILABLE');
      return parseState(data);
    },

    async recordFailure(input) {
      const { error } = await supabase.rpc('account_deletion_record_failure', {
        p_request_id: input.requestId,
        p_user_id: input.userId,
        p_lease_token: input.leaseToken,
        p_expected_step: input.expectedStep,
        p_error_code: input.errorCode,
      });
      if (error) throw rpcError(error, 'ACCOUNT_DELETION_STATE_UNAVAILABLE');
    },

    async eraseDatabaseState(input) {
      const { error } = await supabase.rpc('erase_account_database_state', {
        p_request_id: input.requestId,
        p_user_id: input.userId,
        p_lease_token: input.leaseToken,
      });
      if (error) throw rpcError(error, 'DATABASE_ERASURE_FAILED');
    },

    async lookupCompleted(input) {
      const { data, error } = await supabase.rpc('account_deletion_completion_status', {
        p_completion_token_hash: input.completionTokenHash,
      });
      if (error) throw rpcError(error, 'ACCOUNT_DELETION_STATE_UNAVAILABLE');
      if (!firstRow(data)) return null;
      const state = parseState(data);
      if (state.nextStep !== 'complete') throw new Error('ACCOUNT_DELETION_STATE_INVALID');
      return state;
    },
  };
}

export const accountDeletionStateSteps = NEXT_STEPS as ReadonlySet<
  AccountDeletionStep | 'apple_in_progress' | 'complete'
>;
