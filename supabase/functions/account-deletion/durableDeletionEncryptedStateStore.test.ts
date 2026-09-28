import { loadDeletionPayloadKeyFromEnv } from './durableDeletionCrypto.ts';
import {
  createDurableDeletionEncryptedStateStore,
  DurableDeletionEncryptedStateStoreError,
} from './durableDeletionEncryptedStateStore.ts';
import type { AccountDeletionClaim } from './durableDeletionWorker.ts';

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(message);
}

function claim(stepName: 'revenuecat_delete' | 'posthog_delete'): AccountDeletionClaim {
  return {
    operationId: '11111111-1111-4111-8111-111111111111',
    userId: '22222222-2222-4222-8222-222222222222',
    operationState: 'running',
    stepName,
    stepStatus: 'leased',
    claimMode: 'dispatch',
    claimToken: 'ab'.repeat(32),
    attemptCount: 1,
    requestStartedAt: null,
    leaseExpiresAt: '2026-07-13T12:10:00.000Z',
    encryptedPayload: null,
  };
}

Deno.test('encrypted state store persists canonical bytea and opens it', async () => {
  const key = await loadDeletionPayloadKeyFromEnv(() => '01'.repeat(32));
  const holder: { stored: string | null } = { stored: null };
  const store = createDurableDeletionEncryptedStateStore({
    key,
    gateway: {
      updatePayload(_claim, encryptedPayload) {
        holder.stored = encryptedPayload;
        return Promise.resolve();
      },
    },
  });
  const original = claim('revenuecat_delete');
  const plaintext = new TextEncoder().encode('{"version":1}');
  await store.persist(original, 'revenuecat_delete', plaintext);
  assert(holder.stored?.startsWith('\\x'), 'canonical PostgreSQL bytea');
  const loaded = await store.load(
    { ...original, encryptedPayload: holder.stored },
    'revenuecat_delete',
  );
  assert(new TextDecoder().decode(loaded!) === '{"version":1}', 'authenticated plaintext');
});

Deno.test('encrypted state store preserves null and rejects step substitution', async () => {
  const key = await loadDeletionPayloadKeyFromEnv(() => '02'.repeat(32));
  let called = false;
  const store = createDurableDeletionEncryptedStateStore({
    key,
    gateway: {
      updatePayload() {
        called = true;
        return Promise.resolve();
      },
    },
  });
  const original = claim('posthog_delete');
  assert((await store.load(original, 'posthog_delete')) === null, 'null state');
  let code = '';
  try {
    await store.persist(original, 'revenuecat_delete', new TextEncoder().encode('x'));
  } catch (error) {
    code = error instanceof DurableDeletionEncryptedStateStoreError ? error.code : 'unexpected';
  }
  assert(code === 'DELETION_STATE_STORE_CONTEXT_INVALID', 'AAD context fixed');
  assert(!called, 'invalid substitution never persists');
});
