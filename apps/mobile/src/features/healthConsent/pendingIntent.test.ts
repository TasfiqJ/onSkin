import { beforeEach, describe, expect, it, vi } from 'vitest';

import {
  clearPendingHealthWithdrawalIntent,
  clearPendingHealthWithdrawalIntentByOwnerBinding,
  pendingHealthWithdrawalIntentParserForTests,
  preparePendingHealthWithdrawalIntent,
  preparePendingHealthWithdrawalIntentByOwnerBinding,
  readPendingHealthWithdrawalIntent,
  updatePendingHealthWithdrawalIntent,
} from './pendingIntent';

const OWNER_A = 'owner-a';
const OWNER_B = 'owner-b';
const BINDING_A = 'a1'.repeat(32);
const BINDING_B = 'b2'.repeat(32);
const KEY_A = '01'.repeat(32);
const KEY_B = '02'.repeat(32);

const mocks = vi.hoisted(() => ({
  storage: new Map<string, string>(),
}));

vi.mock('react-native', () => ({ Platform: { OS: 'web' } }));
vi.mock('expo-secure-store', () => ({
  WHEN_UNLOCKED_THIS_DEVICE_ONLY: 'when-unlocked',
  isAvailableAsync: vi.fn(async () => true),
  getItemAsync: vi.fn(),
  setItemAsync: vi.fn(),
  deleteItemAsync: vi.fn(),
}));
vi.mock('@react-native-async-storage/async-storage', () => ({
  default: {
    getItem: vi.fn(async (key: string) => mocks.storage.get(key) ?? null),
    setItem: vi.fn(async (key: string, value: string) => {
      mocks.storage.set(key, value);
    }),
    removeItem: vi.fn(async (key: string) => {
      mocks.storage.delete(key);
    }),
  },
}));
vi.mock('@/lib/auth/sessionOwner', () => ({
  localDataOwnerBinding: vi.fn(async (owner: string) =>
    owner === OWNER_A ? BINDING_A : BINDING_B,
  ),
}));

describe('durable health-withdrawal intent journal', () => {
  beforeEach(() => mocks.storage.clear());

  it('keeps owner journals isolated and clears only the requested owner', async () => {
    await preparePendingHealthWithdrawalIntent({
      ownerUserId: OWNER_A,
      processingEpoch: 2,
      idempotencyKey: KEY_A,
    });
    await preparePendingHealthWithdrawalIntent({
      ownerUserId: OWNER_B,
      processingEpoch: 7,
      idempotencyKey: KEY_B,
    });

    await clearPendingHealthWithdrawalIntent(OWNER_A, {
      processingEpoch: 2,
      idempotencyKey: KEY_A,
    });
    await expect(readPendingHealthWithdrawalIntent(OWNER_A)).resolves.toBeNull();
    await expect(readPendingHealthWithdrawalIntent(OWNER_B)).resolves.toMatchObject({
      processingEpoch: 7,
      idempotencyKey: KEY_B,
    });
  });

  it('reuses the first durable idempotency key for a concurrent retry', async () => {
    const first = await preparePendingHealthWithdrawalIntent({
      ownerUserId: OWNER_A,
      processingEpoch: 2,
      idempotencyKey: KEY_A,
    });
    const second = await preparePendingHealthWithdrawalIntent({
      ownerUserId: OWNER_A,
      processingEpoch: 2,
      idempotencyKey: KEY_B,
    });

    expect(second.idempotencyKey).toBe(first.idempotencyKey);
    expect(second.idempotencyKey).toBe(KEY_A);
  });

  it('persists a pre-intake boundary before assigning its first random key', async () => {
    const prepared = await preparePendingHealthWithdrawalIntentByOwnerBinding({
      ownerBinding: BINDING_A,
      processingEpoch: 2,
    });
    expect(prepared).toMatchObject({
      processingEpoch: 2,
      idempotencyKey: null,
      operationId: null,
      localCleanupComplete: false,
    });

    const keyed = await updatePendingHealthWithdrawalIntent({
      ownerUserId: OWNER_A,
      expectedProcessingEpoch: 2,
      expectedIdempotencyKey: null,
      idempotencyKey: KEY_A,
    });
    expect(keyed.idempotencyKey).toBe(KEY_A);

    await expect(
      updatePendingHealthWithdrawalIntent({
        ownerUserId: OWNER_A,
        expectedProcessingEpoch: 2,
        expectedIdempotencyKey: KEY_A,
        idempotencyKey: KEY_B,
      }),
    ).rejects.toThrow('HEALTH_WITHDRAWAL_PENDING_INTENT_INVALID');
  });

  it('fences stale updates and clears by exact terminal account-deletion binding', async () => {
    await preparePendingHealthWithdrawalIntent({
      ownerUserId: OWNER_A,
      processingEpoch: 2,
      idempotencyKey: KEY_A,
    });
    await expect(
      updatePendingHealthWithdrawalIntent({
        ownerUserId: OWNER_A,
        expectedProcessingEpoch: 3,
        expectedIdempotencyKey: KEY_A,
        localCleanupComplete: true,
      }),
    ).rejects.toThrow('HEALTH_WITHDRAWAL_PENDING_INTENT_INVALID');

    await clearPendingHealthWithdrawalIntentByOwnerBinding(BINDING_A);
    await expect(readPendingHealthWithdrawalIntent(OWNER_A)).resolves.toBeNull();
  });

  it('rejects expanded or malformed durable envelopes', () => {
    expect(() =>
      pendingHealthWithdrawalIntentParserForTests(
        JSON.stringify({ schemaVersion: 1, intents: {}, unexpected: true }),
      ),
    ).toThrow('HEALTH_WITHDRAWAL_PENDING_INTENT_INVALID');
    expect(() =>
      pendingHealthWithdrawalIntentParserForTests(
        JSON.stringify({ schemaVersion: 1, intents: { not_a_hash: {} } }),
      ),
    ).toThrow('HEALTH_WITHDRAWAL_PENDING_INTENT_INVALID');
  });
});
