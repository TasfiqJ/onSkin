import * as Crypto from 'expo-crypto';
import * as SecureStore from 'expo-secure-store';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import {
  ACCOUNT_DELETION_CLIENT_STATE_KEY,
  clearCompletedAccountDeletionState,
  isAccountActivityBlockedForDeletion,
  loadPendingAccountDeletion,
  markAccountDeletionAcceptedOrAmbiguous,
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

const FIRST_TOKEN = Uint8Array.from({ length: 32 }, (_, index) => index);
const SECOND_TOKEN = Uint8Array.from({ length: 32 }, (_, index) => 255 - index);

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

  it('persists two independent 256-bit tokens before activity remains blocked', async () => {
    const record = await preparePendingAccountDeletion(new Date('2026-07-13T20:00:00.000Z'));

    expect(record).toEqual({
      version: 1,
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

  it('reuses a valid pending record without rotating the status capability', async () => {
    const existing = {
      version: 1,
      state: 'accepted_or_ambiguous',
      createdAt: '2026-07-13T20:00:00.000Z',
      idempotencyKey: '01'.repeat(32),
      statusCapability: '02'.repeat(32),
    } as const;
    vi.mocked(SecureStore.getItemAsync).mockResolvedValue(JSON.stringify(existing));

    await expect(preparePendingAccountDeletion()).resolves.toEqual(existing);
    expect(Crypto.getRandomBytesAsync).not.toHaveBeenCalled();
    expect(SecureStore.setItemAsync).not.toHaveBeenCalled();
    expect(isAccountActivityBlockedForDeletion()).toBe(true);
  });

  it('marks a transport-ambiguous intake durably without changing either token', async () => {
    const prepared = {
      version: 1,
      state: 'prepared',
      createdAt: '2026-07-13T20:00:00.000Z',
      idempotencyKey: '01'.repeat(32),
      statusCapability: '02'.repeat(32),
    } as const;
    vi.mocked(SecureStore.getItemAsync).mockResolvedValue(JSON.stringify(prepared));

    const next = await markAccountDeletionAcceptedOrAmbiguous();

    expect(next).toEqual({ ...prepared, state: 'accepted_or_ambiguous' });
    expect(SecureStore.setItemAsync).toHaveBeenCalledWith(
      ACCOUNT_DELETION_CLIENT_STATE_KEY,
      JSON.stringify(next),
      { keychainAccessible: 'WHEN_UNLOCKED_THIS_DEVICE_ONLY' },
    );
    expect(isAccountActivityBlockedForDeletion()).toBe(true);
  });

  it('preserves malformed state and fails closed instead of rotating credentials', async () => {
    const malformed = JSON.stringify({
      version: 1,
      state: 'prepared',
      createdAt: '2026-07-13T20:00:00.000Z',
      idempotencyKey: 'not-random',
      statusCapability: '02'.repeat(32),
    });
    vi.mocked(SecureStore.getItemAsync).mockResolvedValue(malformed);

    await expect(loadPendingAccountDeletion()).rejects.toThrow(
      'ACCOUNT_DELETION_CLIENT_STATE_INVALID',
    );
    expect(SecureStore.setItemAsync).not.toHaveBeenCalled();
    expect(SecureStore.deleteItemAsync).not.toHaveBeenCalled();
    expect(isAccountActivityBlockedForDeletion()).toBe(true);
  });

  it('rolls back only a new in-memory barrier when secure persistence fails', async () => {
    vi.mocked(SecureStore.setItemAsync).mockRejectedValueOnce(new Error('keychain unavailable'));

    await expect(preparePendingAccountDeletion()).rejects.toThrow('keychain unavailable');
    expect(isAccountActivityBlockedForDeletion()).toBe(false);
    expect(SecureStore.deleteItemAsync).not.toHaveBeenCalled();
  });

  it('clears the barrier only after terminal capability deletion succeeds', async () => {
    vi.mocked(SecureStore.getItemAsync).mockResolvedValue(
      JSON.stringify({
        version: 1,
        state: 'accepted_or_ambiguous',
        createdAt: '2026-07-13T20:00:00.000Z',
        idempotencyKey: '01'.repeat(32),
        statusCapability: '02'.repeat(32),
      }),
    );
    await loadPendingAccountDeletion();
    vi.mocked(SecureStore.deleteItemAsync).mockRejectedValueOnce(new Error('delete failed'));

    await expect(clearCompletedAccountDeletionState()).rejects.toThrow('delete failed');
    expect(isAccountActivityBlockedForDeletion()).toBe(true);

    await clearCompletedAccountDeletionState();
    expect(isAccountActivityBlockedForDeletion()).toBe(false);
  });

  it('rejects extra fields, duplicate tokens, and noncanonical timestamps', () => {
    const base = {
      version: 1,
      state: 'prepared',
      createdAt: '2026-07-13T20:00:00.000Z',
      idempotencyKey: '01'.repeat(32),
      statusCapability: '02'.repeat(32),
    } as const;

    expect(() => parseAccountDeletionClientRecord({ ...base, userId: 'private' })).toThrow(
      'ACCOUNT_DELETION_CLIENT_STATE_INVALID',
    );
    expect(() =>
      parseAccountDeletionClientRecord({ ...base, statusCapability: base.idempotencyKey }),
    ).toThrow('ACCOUNT_DELETION_CLIENT_STATE_INVALID');
    expect(() =>
      parseAccountDeletionClientRecord({ ...base, createdAt: '2026-07-13 20:00:00Z' }),
    ).toThrow('ACCOUNT_DELETION_CLIENT_STATE_INVALID');
  });
});
