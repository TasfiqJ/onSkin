import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  digestStringAsync: vi.fn(async (_algorithm: string, value: string) =>
    value.endsWith('user-a') ? 'a'.repeat(64) : 'b'.repeat(64),
  ),
  getItem: vi.fn(async (key: string) => mocks.storage.get(key) ?? null),
  getRandomBytes: vi.fn(() => new Uint8Array(32).fill(0xcc)),
  removeItem: vi.fn(async (key: string) => {
    mocks.storage.delete(key);
  }),
  setItem: vi.fn(async (key: string, value: string) => {
    mocks.storage.set(key, value);
  }),
  storage: new Map<string, string>(),
}));

vi.mock('@react-native-async-storage/async-storage', () => ({
  default: {
    getItem: mocks.getItem,
    removeItem: mocks.removeItem,
    setItem: mocks.setItem,
  },
}));

vi.mock('expo-crypto', () => ({
  CryptoDigestAlgorithm: { SHA256: 'SHA-256' },
  digestStringAsync: mocks.digestStringAsync,
  getRandomBytes: mocks.getRandomBytes,
}));

async function loadFreezeModule() {
  return import('./accountDeletionVendorFreeze');
}

describe('durable account-deletion vendor freeze', () => {
  beforeEach(() => {
    vi.resetModules();
    mocks.digestStringAsync.mockClear();
    mocks.getRandomBytes.mockClear();
    mocks.getItem.mockClear();
    mocks.removeItem.mockClear();
    mocks.setItem.mockClear();
    mocks.storage.clear();
  });

  it('starts fail-closed and opens only after an authoritative no-receipt read', async () => {
    const freeze = await loadFreezeModule();

    expect(freeze.accountDeletionVendorWritesBlocked()).toBe(true);
    await expect(freeze.hydrateAccountDeletionVendorFreeze('user-a')).resolves.toBe('open');
    expect(freeze.accountDeletionVendorWritesBlocked()).toBe(false);
  });

  it('persists only a strict owner hash before reporting the freeze armed', async () => {
    const freeze = await loadFreezeModule();

    await freeze.hydrateAccountDeletionVendorFreeze('user-a');
    await expect(freeze.armAccountDeletionVendorFreeze('user-a')).resolves.toBe('c'.repeat(64));

    const raw = mocks.storage.get(freeze.ACCOUNT_DELETION_VENDOR_FREEZE_KEY);
    expect(raw).toBe(
      JSON.stringify({
        version: 2,
        state: 'pending',
        owner_hash: 'a'.repeat(64),
        completion_token: 'c'.repeat(64),
      }),
    );
    expect(raw).not.toContain('user-a');
    expect(freeze.accountDeletionVendorWritesBlocked()).toBe(true);
    expect(mocks.digestStringAsync).toHaveBeenCalledWith(
      'SHA-256',
      'routinekind:account-deletion-vendor-freeze:v1:user-a',
    );
  });

  it('accepts a native post-commit write rejection only after exact readback', async () => {
    const freeze = await loadFreezeModule();
    mocks.setItem.mockImplementationOnce(async (key: string, value: string) => {
      mocks.storage.set(key, value);
      throw new Error('native acknowledgement lost');
    });

    await expect(freeze.armAccountDeletionVendorFreeze('user-a')).resolves.toBe('c'.repeat(64));
    await expect(freeze.readAccountDeletionRecoveryCapability()).resolves.toEqual({
      state: 'pending',
      ownerHash: 'a'.repeat(64),
      completionToken: 'c'.repeat(64),
    });
  });

  it('rejects entropy-provider output that is not exactly 256 bits', async () => {
    const freeze = await loadFreezeModule();
    mocks.getRandomBytes.mockReturnValueOnce(new Uint8Array(31).fill(0xcc));

    await expect(freeze.armAccountDeletionVendorFreeze('user-a')).rejects.toThrow(
      'ACCOUNT_DELETION_VENDOR_FREEZE_TOKEN_INVALID',
    );
    expect(mocks.setItem).not.toHaveBeenCalled();
    expect(freeze.accountDeletionVendorWritesBlocked()).toBe(true);
  });

  it('survives force-quit/relaunch and rejects a different owner without changing bytes', async () => {
    let freeze = await loadFreezeModule();
    await freeze.armAccountDeletionVendorFreeze('user-a');
    const original = mocks.storage.get(freeze.ACCOUNT_DELETION_VENDOR_FREEZE_KEY);

    vi.resetModules();
    freeze = await loadFreezeModule();
    expect(freeze.accountDeletionVendorWritesBlocked()).toBe(true);
    mocks.setItem.mockClear();
    await expect(freeze.hydrateAccountDeletionVendorFreeze('user-a')).resolves.toBe('frozen');
    expect(freeze.accountDeletionVendorWritesBlocked()).toBe(true);
    await expect(freeze.armAccountDeletionVendorFreeze('user-a')).resolves.toBe('c'.repeat(64));
    expect(mocks.setItem).not.toHaveBeenCalled();
    expect(mocks.storage.get(freeze.ACCOUNT_DELETION_VENDOR_FREEZE_KEY)).toBe(original);

    vi.resetModules();
    freeze = await loadFreezeModule();
    await expect(freeze.hydrateAccountDeletionVendorFreeze('user-b')).rejects.toThrow(
      'ACCOUNT_DELETION_VENDOR_FREEZE_OWNER_MISMATCH',
    );
    expect(mocks.storage.get(freeze.ACCOUNT_DELETION_VENDOR_FREEZE_KEY)).toBe(original);
    expect(freeze.accountDeletionVendorWritesBlocked()).toBe(true);
  });

  it('keeps a pending owner receipt frozen while publishing a signed-out boundary', async () => {
    let freeze = await loadFreezeModule();
    await freeze.armAccountDeletionVendorFreeze('user-a');
    const original = mocks.storage.get(freeze.ACCOUNT_DELETION_VENDOR_FREEZE_KEY);

    vi.resetModules();
    freeze = await loadFreezeModule();
    await expect(freeze.hydrateAccountDeletionVendorFreeze(null)).resolves.toBe('frozen');

    expect(mocks.storage.get(freeze.ACCOUNT_DELETION_VENDOR_FREEZE_KEY)).toBe(original);
    expect(freeze.accountDeletionVendorWritesBlocked()).toBe(true);
  });

  it.each([
    ['not-json', 'ACCOUNT_DELETION_VENDOR_FREEZE_CORRUPT'],
    [
      JSON.stringify({ version: 3, state: 'pending', owner_hash: 'a'.repeat(64) }),
      'ACCOUNT_DELETION_VENDOR_FREEZE_VERSION_UNSUPPORTED',
    ],
    [
      JSON.stringify({
        version: 2,
        state: 'pending',
        owner_hash: 'a'.repeat(64),
        completion_token: 'c'.repeat(64),
        unexpected: true,
      }),
      'ACCOUNT_DELETION_VENDOR_FREEZE_CORRUPT',
    ],
  ])('preserves uncertain receipt bytes: %s', async (raw, expectedError) => {
    const freeze = await loadFreezeModule();
    mocks.storage.set(freeze.ACCOUNT_DELETION_VENDOR_FREEZE_KEY, raw);

    await expect(freeze.hydrateAccountDeletionVendorFreeze('user-a')).rejects.toThrow(
      expectedError,
    );

    expect(mocks.storage.get(freeze.ACCOUNT_DELETION_VENDOR_FREEZE_KEY)).toBe(raw);
    expect(mocks.setItem).not.toHaveBeenCalled();
    expect(mocks.removeItem).not.toHaveBeenCalled();
    expect(freeze.accountDeletionVendorWritesBlocked()).toBe(true);
  });

  it('preserves the receipt and stays blocked when storage is unavailable', async () => {
    const freeze = await loadFreezeModule();
    const raw = JSON.stringify({
      version: 2,
      state: 'pending',
      owner_hash: 'a'.repeat(64),
      completion_token: 'c'.repeat(64),
    });
    mocks.storage.set(freeze.ACCOUNT_DELETION_VENDOR_FREEZE_KEY, raw);
    mocks.getItem.mockRejectedValueOnce(new Error('storage unavailable'));

    await expect(freeze.hydrateAccountDeletionVendorFreeze('user-a')).rejects.toThrow(
      'ACCOUNT_DELETION_VENDOR_FREEZE_READ_FAILED',
    );
    expect(mocks.storage.get(freeze.ACCOUNT_DELETION_VENDOR_FREEZE_KEY)).toBe(raw);
    expect(freeze.accountDeletionVendorWritesBlocked()).toBe(true);
  });

  it('never proceeds when a new receipt cannot be persisted', async () => {
    const freeze = await loadFreezeModule();
    mocks.setItem.mockRejectedValueOnce(new Error('storage unavailable'));

    await expect(freeze.armAccountDeletionVendorFreeze('user-a')).rejects.toThrow(
      'ACCOUNT_DELETION_VENDOR_FREEZE_WRITE_FAILED',
    );
    expect(mocks.storage.has(freeze.ACCOUNT_DELETION_VENDOR_FREEZE_KEY)).toBe(false);
    expect(freeze.accountDeletionVendorWritesBlocked()).toBe(true);
  });

  it('never wildcard-clears a pending receipt after restart or owner repair cleanup', async () => {
    let freeze = await loadFreezeModule();
    await freeze.armAccountDeletionVendorFreeze('user-a');
    const raw = mocks.storage.get(freeze.ACCOUNT_DELETION_VENDOR_FREEZE_KEY);

    vi.resetModules();
    freeze = await loadFreezeModule();
    await expect(freeze.clearAccountDeletionVendorFreezeAfterCleanup()).resolves.toBeUndefined();

    expect(mocks.storage.get(freeze.ACCOUNT_DELETION_VENDOR_FREEZE_KEY)).toBe(raw);
    expect(mocks.removeItem).not.toHaveBeenCalled();
    expect(freeze.accountDeletionVendorWritesBlocked()).toBe(true);
  });

  it('clears only a backend-complete receipt after cleanup and proves removal', async () => {
    const freeze = await loadFreezeModule();
    await freeze.armAccountDeletionVendorFreeze('user-a');
    await freeze.markAccountDeletionBackendDeleted('user-a');
    const raw = mocks.storage.get(freeze.ACCOUNT_DELETION_VENDOR_FREEZE_KEY);
    expect(raw).toBe(
      JSON.stringify({
        version: 2,
        state: 'backend_deleted',
        owner_hash: 'a'.repeat(64),
        completion_token: 'c'.repeat(64),
      }),
    );
    mocks.removeItem.mockRejectedValueOnce(new Error('remove unavailable'));

    await expect(freeze.clearAccountDeletionVendorFreezeAfterCleanup()).rejects.toThrow(
      'ACCOUNT_DELETION_VENDOR_FREEZE_CLEAR_FAILED',
    );
    expect(mocks.storage.get(freeze.ACCOUNT_DELETION_VENDOR_FREEZE_KEY)).toBe(raw);
    expect(freeze.accountDeletionVendorWritesBlocked()).toBe(true);

    await expect(freeze.clearAccountDeletionVendorFreezeAfterCleanup()).resolves.toBeUndefined();
    expect(mocks.storage.has(freeze.ACCOUNT_DELETION_VENDOR_FREEZE_KEY)).toBe(false);
    expect(freeze.accountDeletionVendorWritesBlocked()).toBe(false);
  });

  it('does not authorize cleanup when backend completion cannot be persisted and verified', async () => {
    const freeze = await loadFreezeModule();
    await freeze.armAccountDeletionVendorFreeze('user-a');
    const pending = mocks.storage.get(freeze.ACCOUNT_DELETION_VENDOR_FREEZE_KEY);
    mocks.setItem.mockRejectedValueOnce(new Error('completion write unavailable'));

    await expect(freeze.markAccountDeletionBackendDeleted('user-a')).rejects.toThrow(
      'ACCOUNT_DELETION_VENDOR_FREEZE_COMPLETION_UNVERIFIED',
    );
    await expect(freeze.clearAccountDeletionVendorFreezeAfterCleanup()).resolves.toBeUndefined();

    expect(mocks.storage.get(freeze.ACCOUNT_DELETION_VENDOR_FREEZE_KEY)).toBe(pending);
    expect(mocks.removeItem).not.toHaveBeenCalled();
    expect(freeze.accountDeletionVendorWritesBlocked()).toBe(true);
  });

  it('accepts terminal capability authority only for the exact persisted token', async () => {
    const freeze = await loadFreezeModule();
    await freeze.armAccountDeletionVendorFreeze('user-a');
    const pending = mocks.storage.get(freeze.ACCOUNT_DELETION_VENDOR_FREEZE_KEY);

    await expect(
      freeze.markAccountDeletionBackendDeletedFromCompletion('d'.repeat(64)),
    ).rejects.toThrow('ACCOUNT_DELETION_VENDOR_FREEZE_COMPLETION_TOKEN_MISMATCH');
    expect(mocks.storage.get(freeze.ACCOUNT_DELETION_VENDOR_FREEZE_KEY)).toBe(pending);

    await expect(
      freeze.markAccountDeletionBackendDeletedFromCompletion('c'.repeat(64)),
    ).resolves.toBeUndefined();
    await expect(freeze.readAccountDeletionRecoveryCapability()).resolves.toEqual({
      state: 'backend_deleted',
      ownerHash: 'a'.repeat(64),
      completionToken: 'c'.repeat(64),
    });
  });

  it('does not let an older hydration reopen writes after arming begins', async () => {
    const freeze = await loadFreezeModule();
    let releaseRead!: (value: string | null) => void;
    mocks.getItem.mockImplementationOnce(
      () =>
        new Promise<string | null>((resolve) => {
          releaseRead = resolve;
        }),
    );

    const hydration = freeze.hydrateAccountDeletionVendorFreeze('user-a');
    const arming = freeze.armAccountDeletionVendorFreeze('user-a');
    await vi.waitFor(() => expect(releaseRead).toBeTypeOf('function'));
    releaseRead(null);

    await hydration;
    expect(freeze.accountDeletionVendorWritesBlocked()).toBe(true);
    await arming;
    expect(freeze.accountDeletionVendorWritesBlocked()).toBe(true);
    expect(mocks.storage.has(freeze.ACCOUNT_DELETION_VENDOR_FREEZE_KEY)).toBe(true);
  });

  it('does not let an older hydration reopen writes after a newer auth boundary starts', async () => {
    const freeze = await loadFreezeModule();
    let releaseRead!: (value: string | null) => void;
    mocks.getItem.mockImplementationOnce(
      () =>
        new Promise<string | null>((resolve) => {
          releaseRead = resolve;
        }),
    );

    const hydration = freeze.hydrateAccountDeletionVendorFreeze('user-a');
    await vi.waitFor(() => expect(releaseRead).toBeTypeOf('function'));
    freeze.blockAccountDeletionVendorWritesUntilHydrated();
    releaseRead(null);

    await expect(hydration).resolves.toBe('frozen');
    expect(freeze.accountDeletionVendorWritesBlocked()).toBe(true);
  });
});
