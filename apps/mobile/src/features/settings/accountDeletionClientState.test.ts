import * as Crypto from 'expo-crypto';
import * as SecureStore from 'expo-secure-store';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import {
  ACCOUNT_DELETION_CLIENT_STATE_KEY,
  canRetryAccountDeletionIntake,
  clearCompletedAccountDeletionState,
  commitCompletedAccountDeletion,
  commitUnresolvedAccountDeletion,
  isAccountActivityBlockedForDeletion,
  loadPendingAccountDeletion,
  markAccountDeletionIntakeState,
  markAccountDeletionRetryUnavailable,
  parseAccountDeletionClientRecord,
  preparePendingAccountDeletion,
  resetAccountDeletionClientStateForTests,
} from './accountDeletionClientState';

vi.mock('expo-crypto', () => ({
  getRandomBytesAsync: vi.fn(),
}));

vi.mock('expo-secure-store', () => ({
  WHEN_UNLOCKED_THIS_DEVICE_ONLY: 'WHEN_UNLOCKED_THIS_DEVICE_ONLY',
  isAvailableAsync: vi.fn(),
  getItemAsync: vi.fn(),
  setItemAsync: vi.fn(),
  deleteItemAsync: vi.fn(),
}));

const OWNER_A = 'a1'.repeat(32);
const OWNER_B = 'b2'.repeat(32);
const FIRST_TOKEN = Uint8Array.from({ length: 32 }, (_, index) => index);
const SECOND_TOKEN = Uint8Array.from({ length: 32 }, (_, index) => 255 - index);
const BASE_V2 = {
  version: 2,
  ownerBinding: OWNER_A,
  createdAt: '2026-07-13T20:00:00.000Z',
  idempotencyKey: '01'.repeat(32),
  statusCapability: '02'.repeat(32),
} as const;
const BASE_V1 = {
  version: 1,
  createdAt: '2026-07-13T20:00:00.000Z',
  idempotencyKey: '01'.repeat(32),
  statusCapability: '02'.repeat(32),
} as const;

describe('durable mobile account-deletion state', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    resetAccountDeletionClientStateForTests();
    vi.mocked(SecureStore.isAvailableAsync).mockResolvedValue(true);
    vi.mocked(SecureStore.getItemAsync).mockResolvedValue(null);
    vi.mocked(SecureStore.setItemAsync).mockResolvedValue();
    vi.mocked(SecureStore.deleteItemAsync).mockResolvedValue();
    vi.mocked(Crypto.getRandomBytesAsync)
      .mockResolvedValueOnce(FIRST_TOKEN)
      .mockResolvedValueOnce(SECOND_TOKEN);
  });

  it('persists an owner-bound v2 record and two independent 256-bit tokens', async () => {
    const record = await preparePendingAccountDeletion(
      OWNER_A,
      new Date('2026-07-13T20:00:00.000Z'),
    );

    expect(record).toEqual({
      version: 2,
      ownerBinding: OWNER_A,
      state: 'prepared',
      createdAt: '2026-07-13T20:00:00.000Z',
      idempotencyKey: Buffer.from(FIRST_TOKEN).toString('hex'),
      statusCapability: Buffer.from(SECOND_TOKEN).toString('hex'),
    });
    expect(SecureStore.setItemAsync).toHaveBeenCalledWith(
      ACCOUNT_DELETION_CLIENT_STATE_KEY,
      JSON.stringify(record),
      { keychainAccessible: 'WHEN_UNLOCKED_THIS_DEVICE_ONLY' },
    );
    expect(isAccountActivityBlockedForDeletion()).toBe(true);
  });

  it('reuses retry evidence only for the exact owner without rotating tokens', async () => {
    const existing = { ...BASE_V2, state: 'ambiguous' } as const;
    vi.mocked(SecureStore.getItemAsync).mockResolvedValue(JSON.stringify(existing));

    await expect(preparePendingAccountDeletion(OWNER_A)).resolves.toEqual(existing);
    expect(Crypto.getRandomBytesAsync).not.toHaveBeenCalled();
    expect(SecureStore.setItemAsync).not.toHaveBeenCalled();
    expect(isAccountActivityBlockedForDeletion()).toBe(true);
  });

  it('rejects a foreign owner without overwriting or rotating A evidence', async () => {
    const existing = { ...BASE_V2, state: 'invalid_retryable' } as const;
    const serialized = JSON.stringify(existing);
    vi.mocked(SecureStore.getItemAsync).mockResolvedValue(serialized);

    await expect(preparePendingAccountDeletion(OWNER_B)).rejects.toThrow(
      'ACCOUNT_DELETION_OWNER_MISMATCH',
    );
    expect(SecureStore.setItemAsync).not.toHaveBeenCalled();
    expect(SecureStore.deleteItemAsync).not.toHaveBeenCalled();
    expect(Crypto.getRandomBytesAsync).not.toHaveBeenCalled();
    expect(await SecureStore.getItemAsync(ACCOUNT_DELETION_CLIENT_STATE_KEY)).toBe(serialized);
  });

  it('marks a transport-ambiguous intake without changing owner or tokens', async () => {
    const prepared = { ...BASE_V2, state: 'prepared' } as const;
    vi.mocked(SecureStore.getItemAsync).mockResolvedValue(JSON.stringify(prepared));

    const next = await markAccountDeletionIntakeState('ambiguous', OWNER_A);

    expect(next).toEqual({ ...prepared, state: 'ambiguous' });
    expect(SecureStore.setItemAsync).toHaveBeenCalledWith(
      ACCOUNT_DELETION_CLIENT_STATE_KEY,
      JSON.stringify(next),
      { keychainAccessible: 'WHEN_UNLOCKED_THIS_DEVICE_ONLY' },
    );
  });

  it('separates explicit acceptance from ambiguity and never downgrades proof', async () => {
    const ambiguous = { ...BASE_V2, state: 'ambiguous' } as const;
    vi.mocked(SecureStore.getItemAsync).mockResolvedValue(JSON.stringify(ambiguous));

    await expect(markAccountDeletionIntakeState('accepted', OWNER_A)).resolves.toEqual({
      ...ambiguous,
      state: 'accepted',
    });

    vi.mocked(SecureStore.getItemAsync).mockResolvedValue(
      JSON.stringify({ ...ambiguous, state: 'accepted' }),
    );
    await expect(markAccountDeletionIntakeState('ambiguous', OWNER_A)).rejects.toThrow(
      'ACCOUNT_DELETION_CLIENT_STATE_INVALID',
    );

    await expect(markAccountDeletionIntakeState('accepted', OWNER_B)).rejects.toThrow(
      'ACCOUNT_DELETION_CLIENT_STATE_INVALID',
    );
  });

  it.each(['prepared', 'accepted_or_ambiguous', 'ambiguous', 'accepted', 'invalid_retryable'])(
    'migrates legacy v1 %s evidence to support-only without retry authority',
    (state) => {
      const normalized = parseAccountDeletionClientRecord({ ...BASE_V1, state });
      expect(normalized).toEqual({ ...BASE_V1, ownerBinding: null, state: 'invalid' });
      expect(canRetryAccountDeletionIntake(normalized)).toBe(false);
    },
  );

  it('keeps a legacy completed receipt usable for terminal finalization', async () => {
    vi.mocked(SecureStore.getItemAsync).mockResolvedValue(
      JSON.stringify({ ...BASE_V1, state: 'completed', notice: null }),
    );

    await expect(loadPendingAccountDeletion()).resolves.toEqual({
      ...BASE_V1,
      ownerBinding: null,
      state: 'completed',
      notice: null,
    });
    await expect(clearCompletedAccountDeletionState()).resolves.toBeUndefined();
  });

  it('rejects a syntactically upgraded legacy state in v2', () => {
    expect(() =>
      parseAccountDeletionClientRecord({
        ...BASE_V2,
        state: 'accepted_or_ambiguous',
      }),
    ).toThrow('ACCOUNT_DELETION_CLIENT_STATE_INVALID');
  });

  it('preserves malformed state and fails closed instead of rotating credentials', async () => {
    vi.mocked(SecureStore.getItemAsync).mockResolvedValue(
      JSON.stringify({
        ...BASE_V2,
        state: 'prepared',
        idempotencyKey: 'not-random',
      }),
    );

    await expect(loadPendingAccountDeletion()).rejects.toThrow(
      'ACCOUNT_DELETION_CLIENT_STATE_INVALID',
    );
    expect(SecureStore.setItemAsync).not.toHaveBeenCalled();
    expect(SecureStore.deleteItemAsync).not.toHaveBeenCalled();
    expect(isAccountActivityBlockedForDeletion()).toBe(true);
  });

  it('fails closed when secure persistence has an ambiguous outcome', async () => {
    vi.mocked(SecureStore.setItemAsync).mockRejectedValueOnce(new Error('keychain unavailable'));

    await expect(preparePendingAccountDeletion(OWNER_A)).rejects.toThrow('keychain unavailable');
    expect(isAccountActivityBlockedForDeletion()).toBe(true);
    expect(SecureStore.deleteItemAsync).not.toHaveBeenCalled();
  });

  it('opens activity only after a definitive successful null read', async () => {
    expect(isAccountActivityBlockedForDeletion()).toBe(true);

    await expect(loadPendingAccountDeletion()).resolves.toBeNull();
    expect(isAccountActivityBlockedForDeletion()).toBe(false);

    resetAccountDeletionClientStateForTests();
    vi.mocked(SecureStore.isAvailableAsync).mockRejectedValueOnce(new Error('keychain failed'));
    await expect(loadPendingAccountDeletion()).rejects.toThrow('keychain failed');
    expect(isAccountActivityBlockedForDeletion()).toBe(true);
  });

  it('clears the barrier only after terminal capability deletion succeeds', async () => {
    vi.mocked(SecureStore.getItemAsync).mockResolvedValue(
      JSON.stringify({ ...BASE_V2, state: 'completed', notice: null }),
    );
    await loadPendingAccountDeletion();
    vi.mocked(SecureStore.deleteItemAsync).mockRejectedValueOnce(new Error('delete failed'));

    await expect(clearCompletedAccountDeletionState()).rejects.toThrow('delete failed');
    expect(isAccountActivityBlockedForDeletion()).toBe(true);

    await clearCompletedAccountDeletionState();
    expect(isAccountActivityBlockedForDeletion()).toBe(false);
  });

  it('commits a terminal receipt without changing the owner or capability', async () => {
    const pending = { ...BASE_V2, state: 'accepted' } as const;
    vi.mocked(SecureStore.getItemAsync).mockResolvedValue(JSON.stringify(pending));

    const completed = await commitCompletedAccountDeletion('remove_apple_authorization');

    expect(completed).toEqual({
      ...pending,
      state: 'completed',
      notice: 'remove_apple_authorization',
    });
    expect(SecureStore.setItemAsync).toHaveBeenCalledWith(
      ACCOUNT_DELETION_CLIENT_STATE_KEY,
      JSON.stringify(completed),
      { keychainAccessible: 'WHEN_UNLOCKED_THIS_DEVICE_ONLY' },
    );
  });

  it.each([
    ['invalid', 'invalid_retryable'],
    ['expired', 'expired'],
  ] as const)(
    'retains owner and tokens for an unresolved %s receipt',
    async (state, expectedState) => {
      const pending = { ...BASE_V2, state: 'ambiguous' } as const;
      vi.mocked(SecureStore.getItemAsync).mockResolvedValue(JSON.stringify(pending));

      await expect(commitUnresolvedAccountDeletion(state)).resolves.toEqual({
        ...pending,
        state: expectedState,
      });
      expect(SecureStore.deleteItemAsync).not.toHaveBeenCalled();
      expect(isAccountActivityBlockedForDeletion()).toBe(true);
    },
  );

  it('relaunches a lost-before-send 404 only with the exact owner and tokens', async () => {
    let stored = JSON.stringify({ ...BASE_V2, state: 'ambiguous' });
    vi.mocked(SecureStore.getItemAsync).mockImplementation(async () => stored);
    vi.mocked(SecureStore.setItemAsync).mockImplementation(async (_key, value) => {
      stored = value;
    });

    const invalid = await commitUnresolvedAccountDeletion('invalid');
    expect(invalid.state).toBe('invalid_retryable');
    expect(canRetryAccountDeletionIntake(invalid)).toBe(true);

    resetAccountDeletionClientStateForTests();
    await expect(preparePendingAccountDeletion(OWNER_A)).resolves.toEqual(invalid);
    await expect(preparePendingAccountDeletion(OWNER_B)).rejects.toThrow(
      'ACCOUNT_DELETION_OWNER_MISMATCH',
    );
    expect(Crypto.getRandomBytesAsync).not.toHaveBeenCalled();
  });

  it('removes an impossible retry while retaining owner-bound support evidence', async () => {
    const retryable = { ...BASE_V2, state: 'invalid_retryable' } as const;
    vi.mocked(SecureStore.getItemAsync).mockResolvedValue(JSON.stringify(retryable));

    const unavailable = await markAccountDeletionRetryUnavailable();
    expect(unavailable).toEqual({ ...retryable, state: 'invalid' });
    expect(canRetryAccountDeletionIntake(unavailable)).toBe(false);
    expect(SecureStore.deleteItemAsync).not.toHaveBeenCalled();
  });

  it('refuses to clear a noncompleted capability record', async () => {
    vi.mocked(SecureStore.getItemAsync).mockResolvedValue(
      JSON.stringify({ ...BASE_V2, state: 'expired' }),
    );

    await expect(clearCompletedAccountDeletionState()).rejects.toThrow(
      'ACCOUNT_DELETION_CLIENT_STATE_INVALID',
    );
    expect(SecureStore.deleteItemAsync).not.toHaveBeenCalled();
    expect(isAccountActivityBlockedForDeletion()).toBe(true);
  });

  it('rejects extra fields, duplicate tokens, noncanonical timestamps, and bad owners', () => {
    const base = { ...BASE_V2, state: 'prepared' } as const;

    expect(() => parseAccountDeletionClientRecord({ ...base, userId: 'private' })).toThrow(
      'ACCOUNT_DELETION_CLIENT_STATE_INVALID',
    );
    expect(() =>
      parseAccountDeletionClientRecord({ ...base, statusCapability: base.idempotencyKey }),
    ).toThrow('ACCOUNT_DELETION_CLIENT_STATE_INVALID');
    expect(() =>
      parseAccountDeletionClientRecord({ ...base, createdAt: '2026-07-13 20:00:00Z' }),
    ).toThrow('ACCOUNT_DELETION_CLIENT_STATE_INVALID');
    expect(() => parseAccountDeletionClientRecord({ ...base, ownerBinding: 'owner-a' })).toThrow(
      'ACCOUNT_DELETION_CLIENT_STATE_INVALID',
    );
    expect(() => parseAccountDeletionClientRecord({ ...base, state: 'completed' })).toThrow(
      'ACCOUNT_DELETION_CLIENT_STATE_INVALID',
    );
    expect(() =>
      parseAccountDeletionClientRecord({ ...base, state: 'completed', notice: 'unexpected' }),
    ).toThrow('ACCOUNT_DELETION_CLIENT_STATE_INVALID');
  });
});
