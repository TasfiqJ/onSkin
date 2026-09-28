import type { AccountDeletionClaim } from './durableDeletionWorker.ts';
import type { DurableAppleDeletionPayload } from './durableDeletionPayloads.ts';
import { applePayloadWithRevocationToken } from './durableDeletionPayloads.ts';
import {
  adaptAppleRevocationForDeletionStep,
  appleManualRevocationDisposition,
  type AppleRevokeResponse,
  classifyAppleRevokeResponse,
  classifyAppleRevokeTransportFailure,
} from './durableProviderDeletion.ts';
import { accountDeletionRetryDelaySeconds } from './durableDeletionRuntimeCore.ts';

export type AppleTokenExchangeResult = {
  token: string;
  tokenTypeHint: 'refresh_token' | 'access_token';
};

export type AppleDeletionExecutorDependencies = {
  loadPayload: (claim: AccountDeletionClaim) => Promise<DurableAppleDeletionPayload>;
  savePayload: (claim: AccountDeletionClaim, payload: DurableAppleDeletionPayload) => Promise<void>;
  markRequestStarted: (claim: AccountDeletionClaim) => Promise<void>;
  record: (
    claim: AccountDeletionClaim,
    outcome: 'succeeded' | 'retryable' | 'action_required',
    resultCode: string,
    retryAt: string | null,
  ) => Promise<void>;
  exchangeAuthorizationCode: (
    authorizationCode: string,
    expectedAppleSubject: string,
  ) => Promise<AppleTokenExchangeResult>;
  revokeToken: (
    token: string,
    tokenTypeHint: 'refresh_token' | 'access_token',
  ) => Promise<AppleRevokeResponse>;
  now: () => number;
};

export class AppleDeletionExecutorError extends Error {
  constructor(public readonly code: 'APPLE_EXECUTOR_INPUT_INVALID') {
    super(code);
    this.name = 'AppleDeletionExecutorError';
  }
}

function retryAt(dependencies: AppleDeletionExecutorDependencies, attemptCount: number): string {
  return new Date(
    dependencies.now() + accountDeletionRetryDelaySeconds(attemptCount) * 1_000,
  ).toISOString();
}

async function settleManual(
  claim: AccountDeletionClaim,
  dependencies: AppleDeletionExecutorDependencies,
): Promise<void> {
  const disposition = adaptAppleRevocationForDeletionStep(appleManualRevocationDisposition());
  await dependencies.record(claim, 'succeeded', disposition.resultCode, null);
}

/** Apple token revocation is idempotent; only this provider may safely retry it. */
export async function executeAppleDeletionStep(
  claim: AccountDeletionClaim,
  context: { deadlineAtMs: number },
  dependencies: AppleDeletionExecutorDependencies,
): Promise<void> {
  if (
    claim.stepName !== 'apple_revoke' ||
    !Number.isSafeInteger(context.deadlineAtMs) ||
    context.deadlineAtMs < 0 ||
    typeof dependencies.now !== 'function'
  ) {
    throw new AppleDeletionExecutorError('APPLE_EXECUTOR_INPUT_INVALID');
  }

  let payload: DurableAppleDeletionPayload;
  try {
    payload = await dependencies.loadPayload(claim);
  } catch {
    await dependencies.record(claim, 'action_required', 'APPLE_PAYLOAD_UNAVAILABLE', null);
    return;
  }

  if (payload.phase === 'not_linked') {
    await dependencies.record(claim, 'succeeded', 'APPLE_NOT_LINKED', null);
    return;
  }
  if (payload.phase === 'manual') {
    await settleManual(claim, dependencies);
    return;
  }
  if (dependencies.now() >= context.deadlineAtMs) {
    await dependencies.record(
      claim,
      'retryable',
      'APPLE_REVOKE_RETRY',
      retryAt(dependencies, claim.attemptCount),
    );
    return;
  }

  await dependencies.markRequestStarted(claim);

  if (payload.phase === 'authorization_code') {
    if (claim.claimMode === 'reconcile') {
      // The one-time exchange may have completed before a lost response. With
      // no persisted token there is no safe automatic replay; record the
      // truthful manual fallback and continue account erasure.
      await settleManual(claim, dependencies);
      return;
    }
    let transitioned: DurableAppleDeletionPayload;
    try {
      const exchanged = await dependencies.exchangeAuthorizationCode(
        payload.authorizationCode,
        payload.expectedAppleSubject,
      );
      transitioned = applePayloadWithRevocationToken(
        payload,
        exchanged.token,
        exchanged.tokenTypeHint,
      );
    } catch {
      await settleManual(claim, dependencies);
      return;
    }
    // Do not collapse an ambiguous durable-write result into manual success.
    // If this write committed before its response was lost, the expired lease
    // will reconcile the persisted revocation token. If it did not commit,
    // reconciliation sees the consumed one-time code and records the truthful
    // manual fallback without replaying the exchange.
    await dependencies.savePayload(claim, transitioned);
    payload = transitioned;
  }

  // Keep the network boundary exhaustively tied to a persisted revocation
  // token. Besides preserving TypeScript's narrowing across the async save,
  // this fails closed if a future payload phase is added without an explicit
  // executor policy.
  if (payload.phase !== 'revocation_token') {
    await dependencies.record(claim, 'action_required', 'APPLE_PAYLOAD_UNAVAILABLE', null);
    return;
  }

  if (dependencies.now() >= context.deadlineAtMs) {
    await dependencies.record(
      claim,
      'retryable',
      'APPLE_REVOKE_RETRY',
      retryAt(dependencies, claim.attemptCount),
    );
    return;
  }

  let disposition;
  try {
    const response = await dependencies.revokeToken(payload.revocationToken, payload.tokenTypeHint);
    disposition = adaptAppleRevocationForDeletionStep(classifyAppleRevokeResponse(response));
  } catch {
    const failure = classifyAppleRevokeTransportFailure('after_request_started');
    await dependencies.record(
      claim,
      'retryable',
      failure.resultCode,
      retryAt(dependencies, claim.attemptCount),
    );
    return;
  }
  if (disposition.kind === 'retryable') {
    await dependencies.record(
      claim,
      'retryable',
      disposition.resultCode,
      retryAt(dependencies, claim.attemptCount),
    );
    return;
  }
  await dependencies.record(claim, 'succeeded', disposition.resultCode, null);
}
