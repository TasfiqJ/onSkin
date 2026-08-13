export const ACCOUNT_DELETION_STEPS = [
  'revenuecat',
  'posthog',
  'storage',
  'database',
  'sessions',
  'apple',
  'providers_final',
  'auth',
] as const;

export type AccountDeletionStep = (typeof ACCOUNT_DELETION_STEPS)[number];
export type AccountDeletionAuxiliaryStep = 'apple_in_progress';
export type AccountDeletionNextStep =
  | AccountDeletionStep
  | AccountDeletionAuxiliaryStep
  | 'complete';
export type AccountDeletionCheckpointStep = AccountDeletionStep | 'apple_in_progress';

export type AccountDeletionState = {
  requestId: string;
  nextStep: AccountDeletionNextStep;
  appleRequired: boolean;
  appleResult: 'revoked' | 'skipped' | null;
  posthogResult: 'deleted' | 'already_absent' | 'skipped' | null;
};

export type AccountDeletionStateStore = {
  claim(input: {
    userId: string;
    userHash: string;
    appleRequired: boolean;
    sessionId: string;
    leaseToken: string;
    completionTokenHash: string;
  }): Promise<AccountDeletionState>;
  checkpoint(input: {
    requestId: string;
    userId: string;
    leaseToken: string;
    expectedStep: AccountDeletionCheckpointStep;
    result: string;
  }): Promise<AccountDeletionState>;
  beginAppleAttempt(input: {
    requestId: string;
    userId: string;
    leaseToken: string;
  }): Promise<AccountDeletionState>;
  recordFailure(input: {
    requestId: string;
    userId: string;
    leaseToken: string;
    expectedStep: AccountDeletionCheckpointStep;
    errorCode: string;
  }): Promise<void>;
};

export type AccountDeletionActions = {
  deleteRevenueCatSubscriber(): Promise<'deleted' | 'already_absent'>;
  deletePostHogPerson(): Promise<'deleted' | 'skipped'>;
  deletePhotoStorage(): Promise<'deleted'>;
  eraseDatabaseState(input: { requestId: string }): Promise<'deleted'>;
  revokeOtherAuthSessions(): Promise<'revoked'>;
  revokeAppleToken(authorizationCode: string): Promise<'revoked'>;
  reconcileProviders(): Promise<'reconciled'>;
  deleteAuthIdentity(): Promise<'deleted' | 'already_absent'>;
};

type RunAccountDeletionInput = {
  userId: string;
  userHash: string;
  appleRequired: boolean;
  appleAuthorizationCode?: string;
  sessionId: string;
  leaseToken: string;
  completionTokenHash: string;
  store: AccountDeletionStateStore;
  actions: AccountDeletionActions;
  errorCode: (error: unknown) => string;
};

export type AccountDeletionResult = {
  requestId: string;
  apple: 'revoked' | 'skipped';
  posthog: 'deleted' | 'already_absent' | 'skipped';
};

function executeStep(
  step: AccountDeletionStep,
  state: AccountDeletionState,
  input: RunAccountDeletionInput,
): Promise<string> {
  switch (step) {
    case 'revenuecat':
      return input.actions.deleteRevenueCatSubscriber();
    case 'posthog':
      return input.actions.deletePostHogPerson();
    case 'storage':
      return input.actions.deletePhotoStorage();
    case 'database':
      return input.actions.eraseDatabaseState({ requestId: state.requestId });
    case 'sessions':
      return input.actions.revokeOtherAuthSessions();
    case 'apple':
      throw new Error('ACCOUNT_DELETION_STATE_INVALID');
    case 'providers_final':
      return input.actions.reconcileProviders();
    case 'auth':
      throw new Error('ACCOUNT_DELETION_STATE_INVALID');
  }
}

function blockedStateError(state: AccountDeletionState): Error | null {
  if (state.nextStep === 'apple_in_progress') {
    return new Error('APPLE_REVOCATION_STATUS_UNKNOWN');
  }
  return null;
}

async function recordFailureBestEffort(
  input: RunAccountDeletionInput,
  state: AccountDeletionState,
  expectedStep: AccountDeletionCheckpointStep,
  error: unknown,
): Promise<void> {
  try {
    await input.store.recordFailure({
      requestId: state.requestId,
      userId: input.userId,
      leaseToken: input.leaseToken,
      expectedStep,
      errorCode: input.errorCode(error),
    });
  } catch {
    // Never replace the provider/action error with best-effort receipt logging.
  }
}

/**
 * Runs one deletion request to completion from its durable next-step checkpoint.
 *
 * Apple is deliberately after every retryable vendor/storage/database step. Its
 * single-use authorization code is preflighted before claim/freeze, and the
 * durable state moves to apple_in_progress before any Apple request. Other auth
 * sessions are revoked before Apple, and a retryable final provider reconciliation
 * follows Apple immediately before auth deletion. A failed or uncertain Apple
 * attempt never reuses that code: a later explicit request must supply a fresh
 * code, and claim may reclaim only a cleared or expired attempt lease. The
 * auth.users DELETE trigger is the only writer that completes the final auth step.
 */
export async function runAccountDeletionStateMachine(
  input: RunAccountDeletionInput,
): Promise<AccountDeletionResult> {
  const appleAuthorizationCode = input.appleAuthorizationCode?.trim();
  if (input.appleRequired && !appleAuthorizationCode) {
    throw new Error('APPLE_AUTHORIZATION_CODE_REQUIRED');
  }

  let state = await input.store.claim({
    userId: input.userId,
    userHash: input.userHash,
    appleRequired: input.appleRequired,
    sessionId: input.sessionId,
    leaseToken: input.leaseToken,
    completionTokenHash: input.completionTokenHash,
  });

  const blockedError = blockedStateError(state);
  if (blockedError) throw blockedError;

  while (state.nextStep !== 'complete') {
    const expectedStep = state.nextStep;
    if (expectedStep === 'apple_in_progress') {
      throw blockedStateError(state)!;
    }

    if (expectedStep === 'apple') {
      if (!state.appleRequired) {
        state = await input.store.checkpoint({
          requestId: state.requestId,
          userId: input.userId,
          leaseToken: input.leaseToken,
          expectedStep,
          result: 'skipped',
        });
        continue;
      }
      if (!appleAuthorizationCode) throw new Error('APPLE_AUTHORIZATION_CODE_REQUIRED');

      state = await input.store.beginAppleAttempt({
        requestId: state.requestId,
        userId: input.userId,
        leaseToken: input.leaseToken,
      });
      try {
        await input.actions.revokeAppleToken(appleAuthorizationCode);
      } catch {
        const unknown = new Error('APPLE_REVOCATION_STATUS_UNKNOWN');
        await recordFailureBestEffort(input, state, 'apple_in_progress', unknown);
        throw unknown;
      }

      try {
        state = await input.store.checkpoint({
          requestId: state.requestId,
          userId: input.userId,
          leaseToken: input.leaseToken,
          expectedStep: 'apple_in_progress',
          result: 'revoked',
        });
      } catch {
        const unknown = new Error('APPLE_REVOCATION_STATUS_UNKNOWN');
        await recordFailureBestEffort(input, state, 'apple_in_progress', unknown);
        throw unknown;
      }
      continue;
    }

    if (expectedStep === 'auth') {
      let result: 'deleted' | 'already_absent';
      try {
        result = await input.actions.deleteAuthIdentity();
      } catch (error) {
        // A lost GoTrue response can still mean the auth.users transaction
        // committed. Only the auth DELETE trigger may have completed the row;
        // this checkpoint is an idempotent read/ack, never a completion write.
        try {
          state = await input.store.checkpoint({
            requestId: state.requestId,
            userId: input.userId,
            leaseToken: input.leaseToken,
            expectedStep,
            result: 'already_absent',
          });
          continue;
        } catch {
          await recordFailureBestEffort(input, state, expectedStep, error);
          throw error;
        }
      }

      try {
        state = await input.store.checkpoint({
          requestId: state.requestId,
          userId: input.userId,
          leaseToken: input.leaseToken,
          expectedStep,
          result,
        });
      } catch (error) {
        await recordFailureBestEffort(input, state, expectedStep, error);
        throw error;
      }
      continue;
    }

    try {
      const result = await executeStep(expectedStep, state, input);
      state = await input.store.checkpoint({
        requestId: state.requestId,
        userId: input.userId,
        leaseToken: input.leaseToken,
        expectedStep,
        result,
      });
    } catch (error) {
      await recordFailureBestEffort(input, state, expectedStep, error);
      throw error;
    }
  }

  return {
    requestId: state.requestId,
    apple: state.appleResult ?? (state.appleRequired ? 'revoked' : 'skipped'),
    posthog: state.posthogResult ?? 'skipped',
  };
}
