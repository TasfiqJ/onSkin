import {
  type DeletionEncryptedStepName,
  deletionPayloadEnvelopeFromByteaRpc,
  deletionPayloadEnvelopeToByteaRpc,
  openDeletionPayload,
  sealDeletionPayload,
} from './durableDeletionCrypto.ts';
import type { DeletionClaimCasIdentity } from './durableDeletionDatabaseGateway.ts';
import type { AccountDeletionClaim } from './durableDeletionWorker.ts';

export type EncryptedDeletionStateGateway = {
  updatePayload(claim: DeletionClaimCasIdentity, encryptedPayload: string): Promise<void>;
};

export type DurableDeletionEncryptedStateStore = {
  load(
    claim: AccountDeletionClaim,
    expectedStepName: DeletionEncryptedStepName,
  ): Promise<Uint8Array | null>;
  persist(
    claim: AccountDeletionClaim,
    expectedStepName: DeletionEncryptedStepName,
    canonicalPlaintext: Uint8Array,
  ): Promise<void>;
};

export class DurableDeletionEncryptedStateStoreError extends Error {
  constructor(public readonly code: 'DELETION_STATE_STORE_CONTEXT_INVALID') {
    super(code);
    this.name = 'DurableDeletionEncryptedStateStoreError';
  }
}

function assertStep(
  claim: AccountDeletionClaim,
  expectedStepName: DeletionEncryptedStepName,
): void {
  if (claim.stepName !== expectedStepName) {
    throw new DurableDeletionEncryptedStateStoreError('DELETION_STATE_STORE_CONTEXT_INVALID');
  }
}

/** AES-GCM + bytea adapter shared by provider executors. */
export function createDurableDeletionEncryptedStateStore(options: {
  key: CryptoKey;
  gateway: EncryptedDeletionStateGateway;
}): DurableDeletionEncryptedStateStore {
  if (
    options === null ||
    typeof options !== 'object' ||
    !(options.key instanceof CryptoKey) ||
    options.gateway === null ||
    typeof options.gateway !== 'object' ||
    typeof options.gateway.updatePayload !== 'function'
  ) {
    throw new DurableDeletionEncryptedStateStoreError('DELETION_STATE_STORE_CONTEXT_INVALID');
  }
  return {
    async load(claim, expectedStepName) {
      assertStep(claim, expectedStepName);
      if (claim.encryptedPayload === null) return null;
      const envelope = deletionPayloadEnvelopeFromByteaRpc(
        expectedStepName,
        claim.encryptedPayload,
      );
      return await openDeletionPayload({
        key: options.key,
        userId: claim.userId,
        stepName: expectedStepName,
        serializedEnvelope: envelope,
      });
    },
    async persist(claim, expectedStepName, canonicalPlaintext) {
      assertStep(claim, expectedStepName);
      const envelope = await sealDeletionPayload({
        key: options.key,
        userId: claim.userId,
        stepName: expectedStepName,
        plaintext: canonicalPlaintext,
      });
      const bytea = deletionPayloadEnvelopeToByteaRpc(expectedStepName, envelope);
      await options.gateway.updatePayload(claim, bytea);
    },
  };
}
