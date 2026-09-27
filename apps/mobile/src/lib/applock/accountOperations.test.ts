import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import {
  beginAccountGenerationBoundary,
  endAccountGenerationBoundary,
  waitForAccountGenerationOperationsToSettle,
} from '@/lib/auth/accountGeneration';

import {
  attemptAppUnlockForCurrentAccount,
  readAppLockPreferenceForCurrentAccount,
  setAppLockPreferenceForCurrentAccount,
} from './accountOperations';

const mocks = vi.hoisted(() => ({
  authenticateAppLock: vi.fn(),
  canUseAppLock: vi.fn(),
  clearMalformedAppLockPreference: vi.fn(),
  invalidatePendingAppLockAuthentication: vi.fn(),
  readAppLockPreference: vi.fn(),
  setAppLockEnabledStored: vi.fn(),
}));

vi.mock('./authenticate', () => ({
  authenticateAppLock: mocks.authenticateAppLock,
  canUseAppLock: mocks.canUseAppLock,
  invalidatePendingAppLockAuthentication: mocks.invalidatePendingAppLockAuthentication,
}));

vi.mock('./store', () => ({
  clearMalformedAppLockPreference: mocks.clearMalformedAppLockPreference,
  readAppLockPreference: mocks.readAppLockPreference,
  setAppLockEnabledStored: mocks.setAppLockEnabledStored,
}));

type Deferred<T> = {
  promise: Promise<T>;
  resolve: (value: T) => void;
  reject: (error: unknown) => void;
};

function deferred<T>(): Deferred<T> {
  let resolve!: (value: T) => void;
  let reject!: (error: unknown) => void;
  const promise = new Promise<T>((resolvePromise, rejectPromise) => {
    resolve = resolvePromise;
    reject = rejectPromise;
  });
  return { promise, resolve, reject };
}

let boundaryActive = false;

async function crossBoundary<T>(operation: Promise<T>): Promise<void> {
  beginAccountGenerationBoundary();
  boundaryActive = true;
  await expect(operation).rejects.toMatchObject({ code: 'ACCOUNT_GENERATION_CHANGED' });
  await waitForAccountGenerationOperationsToSettle();
  endAccountGenerationBoundary();
  boundaryActive = false;
}

describe('account-bound App Lock operations', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.authenticateAppLock.mockResolvedValue('success');
    mocks.canUseAppLock.mockResolvedValue(true);
    mocks.clearMalformedAppLockPreference.mockResolvedValue(undefined);
    mocks.readAppLockPreference.mockResolvedValue({ status: 'absent', enabled: false });
    mocks.setAppLockEnabledStored.mockResolvedValue(undefined);
  });

  afterEach(() => {
    if (boundaryActive) {
      endAccountGenerationBoundary();
      boundaryActive = false;
    }
  });

  it('publishes a current-owner typed preference inside its generation', async () => {
    const publish = vi.fn();
    mocks.readAppLockPreference.mockResolvedValue({
      status: 'available',
      enabled: true,
      format: 'current',
    });

    await expect(readAppLockPreferenceForCurrentAccount(publish)).resolves.toEqual({
      status: 'available',
      enabled: true,
      format: 'current',
    });
    expect(publish).toHaveBeenCalledWith({
      status: 'available',
      enabled: true,
      format: 'current',
    });
  });

  it('discards an old-owner read that resolves after an account boundary', async () => {
    const pendingRead = deferred<{ status: 'absent'; enabled: false }>();
    const publish = vi.fn();
    mocks.readAppLockPreference.mockReturnValueOnce(pendingRead.promise);

    const operation = readAppLockPreferenceForCurrentAccount(publish);
    await vi.waitFor(() => expect(mocks.readAppLockPreference).toHaveBeenCalledOnce());
    await crossBoundary(operation);

    pendingRead.resolve({ status: 'absent', enabled: false });
    await Promise.resolve();
    expect(publish).not.toHaveBeenCalled();
  });

  it('maps an unexpected current-owner read rejection to typed retry-only state', async () => {
    const publish = vi.fn();
    mocks.readAppLockPreference.mockRejectedValueOnce(new Error('unexpected storage failure'));

    await expect(readAppLockPreferenceForCurrentAccount(publish)).resolves.toEqual({
      status: 'unavailable',
      enabled: null,
      reason: 'storage_unavailable',
    });
    expect(publish).toHaveBeenCalledWith({
      status: 'unavailable',
      enabled: null,
      reason: 'storage_unavailable',
    });
  });

  it('does not let delayed old-owner repair authentication reset the next owner', async () => {
    const pendingAuth = deferred<'success'>();
    const publish = vi.fn();
    mocks.authenticateAppLock.mockReturnValueOnce(pendingAuth.promise);

    const operation = attemptAppUnlockForCurrentAccount({
      promptMessage: 'Unlock',
      repairRequired: true,
      publish,
    });
    await vi.waitFor(() => expect(mocks.authenticateAppLock).toHaveBeenCalledOnce());
    await crossBoundary(operation);

    expect(mocks.invalidatePendingAppLockAuthentication).toHaveBeenCalled();
    pendingAuth.resolve('success');
    await Promise.resolve();
    expect(mocks.clearMalformedAppLockPreference).not.toHaveBeenCalled();
    expect(publish).not.toHaveBeenCalled();
  });

  it('does not publish an ordinary old-owner unlock after its prompt crosses the boundary', async () => {
    const pendingAuth = deferred<'success'>();
    const publish = vi.fn();
    mocks.authenticateAppLock.mockReturnValueOnce(pendingAuth.promise);

    const operation = attemptAppUnlockForCurrentAccount({
      promptMessage: 'Unlock',
      repairRequired: false,
      publish,
    });
    await vi.waitFor(() => expect(mocks.authenticateAppLock).toHaveBeenCalledOnce());
    await crossBoundary(operation);

    pendingAuth.resolve('success');
    await Promise.resolve();
    expect(publish).not.toHaveBeenCalled();
  });

  it('does not let delayed old-owner enable authentication write the next owner', async () => {
    const pendingAuth = deferred<'success'>();
    const publish = vi.fn();
    mocks.authenticateAppLock.mockReturnValueOnce(pendingAuth.promise);

    const operation = setAppLockPreferenceForCurrentAccount({ enabled: true, publish });
    await vi.waitFor(() => expect(mocks.authenticateAppLock).toHaveBeenCalledOnce());
    await crossBoundary(operation);

    pendingAuth.resolve('success');
    await Promise.resolve();
    expect(mocks.setAppLockEnabledStored).not.toHaveBeenCalled();
    expect(publish).not.toHaveBeenCalled();
  });

  it('does not continue from stale readiness into authentication or a write', async () => {
    const pendingReadiness = deferred<boolean>();
    const publish = vi.fn();
    mocks.canUseAppLock.mockReturnValueOnce(pendingReadiness.promise);

    const operation = setAppLockPreferenceForCurrentAccount({ enabled: true, publish });
    await vi.waitFor(() => expect(mocks.canUseAppLock).toHaveBeenCalledOnce());
    await crossBoundary(operation);

    pendingReadiness.resolve(true);
    await Promise.resolve();
    expect(mocks.authenticateAppLock).not.toHaveBeenCalled();
    expect(mocks.setAppLockEnabledStored).not.toHaveBeenCalled();
    expect(publish).not.toHaveBeenCalled();
  });

  it('does not continue from readiness after the provider interaction becomes stale', async () => {
    const pendingReadiness = deferred<boolean>();
    const publish = vi.fn();
    let current = true;
    mocks.canUseAppLock.mockReturnValueOnce(pendingReadiness.promise);

    const operation = setAppLockPreferenceForCurrentAccount({
      enabled: true,
      isInteractionCurrent: () => current,
      publish,
    });
    await vi.waitFor(() => expect(mocks.canUseAppLock).toHaveBeenCalledOnce());
    current = false;
    pendingReadiness.resolve(true);

    await expect(operation).resolves.toEqual({ status: 'not_authenticated' });
    expect(mocks.authenticateAppLock).not.toHaveBeenCalled();
    expect(mocks.setAppLockEnabledStored).not.toHaveBeenCalled();
    expect(publish).not.toHaveBeenCalled();
  });

  it('passes the provider guard to native auth and checks it before repair', async () => {
    const pendingAuth = deferred<'success'>();
    const publish = vi.fn();
    const token = Object.freeze({ flow: 'repair' });
    let current = true;
    const guard = () => current;
    mocks.authenticateAppLock.mockReturnValueOnce(pendingAuth.promise);

    const operation = attemptAppUnlockForCurrentAccount({
      promptMessage: 'Unlock',
      repairRequired: true,
      authenticationToken: token,
      isInteractionCurrent: guard,
      publish,
    });
    await vi.waitFor(() => expect(mocks.authenticateAppLock).toHaveBeenCalledOnce());
    expect(mocks.authenticateAppLock).toHaveBeenCalledWith('Unlock', token, guard);
    current = false;
    pendingAuth.resolve('success');

    await expect(operation).resolves.toEqual({ status: 'not_authenticated', repaired: false });
    expect(mocks.clearMalformedAppLockPreference).not.toHaveBeenCalled();
    expect(publish).not.toHaveBeenCalled();
  });

  it('does not publish a write that finishes after the provider interaction becomes stale', async () => {
    const pendingWrite = deferred<void>();
    const publish = vi.fn();
    let current = true;
    mocks.setAppLockEnabledStored.mockReturnValueOnce(pendingWrite.promise);

    const operation = setAppLockPreferenceForCurrentAccount({
      enabled: false,
      isInteractionCurrent: () => current,
      publish,
    });
    await vi.waitFor(() => expect(mocks.setAppLockEnabledStored).toHaveBeenCalledOnce());
    current = false;
    pendingWrite.resolve(undefined);

    await expect(operation).resolves.toEqual({ status: 'saved', enabled: false });
    expect(publish).not.toHaveBeenCalled();
  });

  it('publishes no unlock after a boundary interrupts an in-flight reset', async () => {
    const pendingReset = deferred<void>();
    const publish = vi.fn();
    mocks.clearMalformedAppLockPreference.mockReturnValueOnce(pendingReset.promise);

    const operation = attemptAppUnlockForCurrentAccount({
      promptMessage: 'Unlock',
      repairRequired: true,
      publish,
    });
    await vi.waitFor(() => expect(mocks.clearMalformedAppLockPreference).toHaveBeenCalledOnce());
    await crossBoundary(operation);

    pendingReset.resolve(undefined);
    await Promise.resolve();
    expect(publish).not.toHaveBeenCalled();
  });

  it('publishes no setting state after a boundary interrupts an in-flight write', async () => {
    const pendingWrite = deferred<void>();
    const publish = vi.fn();
    mocks.setAppLockEnabledStored.mockReturnValueOnce(pendingWrite.promise);

    const operation = setAppLockPreferenceForCurrentAccount({ enabled: false, publish });
    await vi.waitFor(() => expect(mocks.setAppLockEnabledStored).toHaveBeenCalledOnce());
    await crossBoundary(operation);

    pendingWrite.resolve(undefined);
    await Promise.resolve();
    expect(publish).not.toHaveBeenCalled();
  });

  it('keeps cancellation and unavailable authentication non-destructive', async () => {
    const publish = vi.fn();
    mocks.authenticateAppLock.mockResolvedValueOnce('not_authenticated');

    await expect(
      attemptAppUnlockForCurrentAccount({
        promptMessage: 'Unlock',
        repairRequired: true,
        publish,
      }),
    ).resolves.toEqual({ status: 'not_authenticated', repaired: false });
    expect(mocks.clearMalformedAppLockPreference).not.toHaveBeenCalled();

    mocks.authenticateAppLock.mockResolvedValueOnce('unavailable');
    await expect(
      attemptAppUnlockForCurrentAccount({
        promptMessage: 'Unlock',
        repairRequired: true,
        publish,
      }),
    ).resolves.toEqual({ status: 'unavailable', repaired: false });
    expect(mocks.clearMalformedAppLockPreference).not.toHaveBeenCalled();
  });

  it('reports a current-owner reset failure without unlocking or hiding recovery', async () => {
    const publish = vi.fn();
    mocks.clearMalformedAppLockPreference.mockRejectedValueOnce(new Error('reset failed'));
    mocks.readAppLockPreference.mockResolvedValueOnce({
      status: 'corrupt',
      enabled: null,
      reason: 'invalid_value',
    });

    await expect(
      attemptAppUnlockForCurrentAccount({
        promptMessage: 'Unlock',
        repairRequired: true,
        publish,
      }),
    ).resolves.toEqual({ status: 'reset_failed', repaired: false });
    expect(publish).toHaveBeenCalledWith({ status: 'reset_failed', repaired: false });
  });

  it('reconciles a reset that committed before its response was lost', async () => {
    const publish = vi.fn();
    mocks.clearMalformedAppLockPreference.mockRejectedValueOnce(new Error('response lost'));
    mocks.readAppLockPreference.mockResolvedValueOnce({ status: 'absent', enabled: false });

    await expect(
      attemptAppUnlockForCurrentAccount({
        promptMessage: 'Unlock',
        repairRequired: true,
        publish,
      }),
    ).resolves.toEqual({ status: 'success', repaired: true });
    expect(publish).toHaveBeenCalledWith({ status: 'success', repaired: true });
  });

  it('repairs and unlocks only after current-owner authentication succeeds', async () => {
    const publish = vi.fn();

    await expect(
      attemptAppUnlockForCurrentAccount({
        promptMessage: 'Unlock',
        repairRequired: true,
        publish,
      }),
    ).resolves.toEqual({ status: 'success', repaired: true });
    expect(mocks.clearMalformedAppLockPreference).toHaveBeenCalledOnce();
    expect(publish).toHaveBeenCalledWith({ status: 'success', repaired: true });
  });

  it('writes and publishes a current-owner setting only after successful confirmation', async () => {
    const publish = vi.fn();

    await expect(
      setAppLockPreferenceForCurrentAccount({ enabled: true, publish }),
    ).resolves.toEqual({ status: 'saved', enabled: true });
    expect(mocks.canUseAppLock).toHaveBeenCalledOnce();
    expect(mocks.authenticateAppLock).toHaveBeenCalledWith('Confirm to enable app lock');
    expect(mocks.setAppLockEnabledStored).toHaveBeenCalledWith(true);
    expect(publish).toHaveBeenCalledWith({ status: 'saved', enabled: true });
  });

  it.each([true, false])(
    'reconciles a %s write that committed before its response was lost',
    async (enabled) => {
      const publish = vi.fn();
      mocks.setAppLockEnabledStored.mockRejectedValueOnce(new Error('response lost'));
      mocks.readAppLockPreference.mockResolvedValueOnce({
        status: 'available',
        enabled,
        format: 'current',
      });

      await expect(setAppLockPreferenceForCurrentAccount({ enabled, publish })).resolves.toEqual({
        status: 'saved',
        enabled,
      });
      expect(publish).toHaveBeenCalledWith({ status: 'saved', enabled });
    },
  );

  it('publishes typed fail-closed state when write outcome cannot be read', async () => {
    const publish = vi.fn();
    const preference = {
      status: 'unavailable',
      enabled: null,
      reason: 'storage_unavailable',
    } as const;
    mocks.setAppLockEnabledStored.mockRejectedValueOnce(new Error('response lost'));
    mocks.readAppLockPreference.mockResolvedValueOnce(preference);

    await expect(
      setAppLockPreferenceForCurrentAccount({ enabled: false, publish }),
    ).resolves.toEqual({ status: 'write_uncertain', preference });
    expect(publish).toHaveBeenCalledWith({ status: 'write_uncertain', preference });
  });

  it('propagates a proven non-commit without publishing false success', async () => {
    const publish = vi.fn();
    const failure = new Error('write did not commit');
    mocks.setAppLockEnabledStored.mockRejectedValueOnce(failure);
    mocks.readAppLockPreference.mockResolvedValueOnce({
      status: 'available',
      enabled: true,
      format: 'current',
    });

    await expect(setAppLockPreferenceForCurrentAccount({ enabled: false, publish })).rejects.toBe(
      failure,
    );
    expect(publish).not.toHaveBeenCalled();
  });

  it('does not authenticate or write when device authentication is not ready', async () => {
    const publish = vi.fn();
    mocks.canUseAppLock.mockResolvedValueOnce(false);

    await expect(
      setAppLockPreferenceForCurrentAccount({ enabled: true, publish }),
    ).resolves.toEqual({ status: 'unavailable' });
    expect(mocks.authenticateAppLock).not.toHaveBeenCalled();
    expect(mocks.setAppLockEnabledStored).not.toHaveBeenCalled();
    expect(publish).toHaveBeenCalledWith({ status: 'unavailable' });
  });

  it.each(['not_authenticated', 'unavailable'] as const)(
    'does not write after enable authentication returns %s',
    async (status) => {
      const publish = vi.fn();
      mocks.authenticateAppLock.mockResolvedValueOnce(status);

      await expect(
        setAppLockPreferenceForCurrentAccount({ enabled: true, publish }),
      ).resolves.toEqual({ status });
      expect(mocks.setAppLockEnabledStored).not.toHaveBeenCalled();
      expect(publish).toHaveBeenCalledWith({ status });
    },
  );

  it('disables directly under the current owner lease without opening native auth', async () => {
    const publish = vi.fn();

    await expect(
      setAppLockPreferenceForCurrentAccount({ enabled: false, publish }),
    ).resolves.toEqual({ status: 'saved', enabled: false });
    expect(mocks.canUseAppLock).not.toHaveBeenCalled();
    expect(mocks.authenticateAppLock).not.toHaveBeenCalled();
    expect(mocks.setAppLockEnabledStored).toHaveBeenCalledWith(false);
    expect(publish).toHaveBeenCalledWith({ status: 'saved', enabled: false });
  });
});
