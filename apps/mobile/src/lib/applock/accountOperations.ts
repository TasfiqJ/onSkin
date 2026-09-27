import {
  runAccountGenerationOperation,
  type AccountGenerationLease,
} from '@/lib/auth/accountGeneration';

import {
  authenticateAppLock,
  canUseAppLock,
  invalidatePendingAppLockAuthentication,
  type AppLockAuthenticationRequestGuard,
  type AppLockAuthenticationToken,
  type AppLockAuthStatus,
} from './authenticate';
import {
  clearMalformedAppLockPreference,
  readAppLockPreference,
  setAppLockEnabledStored,
  type AppLockPreferenceReadResult,
} from './store';

export type AppLockUnlockAttemptResult =
  | { status: AppLockAuthStatus; repaired: false }
  | { status: 'success'; repaired: true }
  | { status: 'reset_failed'; repaired: false };

export type AppLockPreferenceSaveResult =
  | { status: 'saved'; enabled: boolean }
  | { status: 'not_authenticated' | 'unavailable' }
  | { status: 'write_uncertain'; preference: AppLockPreferenceReadResult };

/** Detach an API without AbortSignal support as soon as its account lease is
 * invalidated. The underlying native/storage promise may settle later, but it
 * can no longer publish into the next owner generation. */
function awaitAccountGenerationLease<T>(
  lease: AccountGenerationLease,
  operation: () => PromiseLike<T>,
): Promise<T> {
  try {
    lease.assertCurrent();
  } catch (error) {
    return Promise.reject(error);
  }

  return new Promise<T>((resolve, reject) => {
    let settled = false;
    const finish = (callback: () => void) => {
      if (settled) return;
      settled = true;
      lease.signal.removeEventListener('abort', onAbort);
      callback();
    };
    const onAbort = () =>
      finish(() => {
        try {
          lease.assertCurrent();
          reject(new Error('ACCOUNT_GENERATION_CHANGED'));
        } catch (error) {
          reject(error);
        }
      });

    lease.signal.addEventListener('abort', onAbort, { once: true });
    if (lease.signal.aborted) {
      onAbort();
      return;
    }

    let pending: PromiseLike<T>;
    try {
      pending = operation();
    } catch (error) {
      finish(() => reject(error));
      return;
    }
    void Promise.resolve(pending).then(
      (value) => {
        try {
          lease.assertCurrent();
          finish(() => resolve(value));
        } catch (error) {
          finish(() => reject(error));
        }
      },
      (error: unknown) => finish(() => reject(error)),
    );
  });
}

async function readPreferenceWithLease(
  lease: AccountGenerationLease,
): Promise<AppLockPreferenceReadResult> {
  try {
    return await awaitAccountGenerationLease(lease, readAppLockPreference);
  } catch {
    // A real account-boundary cancellation must still escape. Unexpected store
    // failures become an honest retry-only typed result for the current owner.
    lease.assertCurrent();
    return { status: 'unavailable', enabled: null, reason: 'storage_unavailable' };
  }
}

async function authenticateWithLease(
  lease: AccountGenerationLease,
  promptMessage: string,
  token?: AppLockAuthenticationToken,
  isRequestCurrent?: AppLockAuthenticationRequestGuard,
): Promise<AppLockAuthStatus> {
  const onAbort = () => invalidatePendingAppLockAuthentication();
  lease.signal.addEventListener('abort', onAbort, { once: true });
  if (lease.signal.aborted) onAbort();
  try {
    return await awaitAccountGenerationLease(lease, () => {
      if (token && isRequestCurrent) {
        return authenticateAppLock(promptMessage, token, isRequestCurrent);
      }
      if (token) return authenticateAppLock(promptMessage, token);
      if (isRequestCurrent) return authenticateAppLock(promptMessage, undefined, isRequestCurrent);
      return authenticateAppLock(promptMessage);
    });
  } finally {
    lease.signal.removeEventListener('abort', onAbort);
  }
}

function requestIsCurrent(guard?: AppLockAuthenticationRequestGuard): boolean {
  return guard?.() ?? true;
}

/** Read and synchronously publish the preference inside one owner generation. */
export function readAppLockPreferenceForCurrentAccount(
  publish: (result: AppLockPreferenceReadResult) => void,
): Promise<AppLockPreferenceReadResult> {
  return runAccountGenerationOperation(async (lease) => {
    const result = await readPreferenceWithLease(lease);
    lease.assertCurrent();
    publish(result);
    return result;
  });
}

/**
 * Keep native authentication and the optional destructive repair under the
 * generation that opened the prompt. A stale prompt can therefore never reset
 * the next account's preference or publish an unlock into its provider.
 */
export function attemptAppUnlockForCurrentAccount(input: {
  promptMessage: string;
  repairRequired: boolean;
  authenticationToken?: AppLockAuthenticationToken;
  isInteractionCurrent?: AppLockAuthenticationRequestGuard;
  publish: (result: AppLockUnlockAttemptResult) => void;
}): Promise<AppLockUnlockAttemptResult> {
  return runAccountGenerationOperation(async (lease) => {
    if (!requestIsCurrent(input.isInteractionCurrent)) {
      return { status: 'not_authenticated', repaired: false };
    }
    const status = await authenticateWithLease(
      lease,
      input.promptMessage,
      input.authenticationToken,
      input.isInteractionCurrent,
    );
    if (status !== 'success') {
      const result = { status, repaired: false } as const;
      lease.assertCurrent();
      if (requestIsCurrent(input.isInteractionCurrent)) input.publish(result);
      return result;
    }

    if (input.repairRequired) {
      if (!requestIsCurrent(input.isInteractionCurrent)) {
        return { status: 'not_authenticated', repaired: false };
      }
      try {
        lease.assertCurrent();
        await awaitAccountGenerationLease(lease, clearMalformedAppLockPreference);
      } catch {
        // An account-boundary cancellation must remain a cancellation. Only a
        // failure that still belongs to this generation may become reset UI.
        lease.assertCurrent();
        if (!requestIsCurrent(input.isInteractionCurrent)) {
          return { status: 'reset_failed', repaired: false };
        }
        const readback = await readPreferenceWithLease(lease);
        const result =
          readback.status === 'absent'
            ? ({ status: 'success', repaired: true } as const)
            : ({ status: 'reset_failed', repaired: false } as const);
        lease.assertCurrent();
        if (requestIsCurrent(input.isInteractionCurrent)) input.publish(result);
        return result;
      }
    }

    const result = { status: 'success', repaired: input.repairRequired } as const;
    lease.assertCurrent();
    if (requestIsCurrent(input.isInteractionCurrent)) input.publish(result);
    return result;
  });
}

/**
 * Bind readiness, native confirmation, the strict atomic write, and state
 * publication to the account that initiated the setting change.
 */
export function setAppLockPreferenceForCurrentAccount(input: {
  enabled: boolean;
  authenticationToken?: AppLockAuthenticationToken;
  isInteractionCurrent?: AppLockAuthenticationRequestGuard;
  publish: (result: AppLockPreferenceSaveResult) => void;
}): Promise<AppLockPreferenceSaveResult> {
  return runAccountGenerationOperation(async (lease) => {
    if (!requestIsCurrent(input.isInteractionCurrent)) {
      return { status: 'not_authenticated' };
    }
    if (input.enabled) {
      const ready = await awaitAccountGenerationLease(lease, canUseAppLock);
      if (!requestIsCurrent(input.isInteractionCurrent)) {
        return { status: 'not_authenticated' };
      }
      if (!ready) {
        const result = { status: 'unavailable' } as const;
        lease.assertCurrent();
        if (requestIsCurrent(input.isInteractionCurrent)) input.publish(result);
        return result;
      }

    }

    const authStatus = await authenticateWithLease(
      lease,
      input.enabled ? 'Confirm to enable app lock' : 'Confirm to disable app lock',
      input.authenticationToken,
      input.isInteractionCurrent,
    );
    if (authStatus !== 'success') {
      const result = { status: authStatus } as const;
      lease.assertCurrent();
      if (requestIsCurrent(input.isInteractionCurrent)) input.publish(result);
      return result;
    }

    if (!requestIsCurrent(input.isInteractionCurrent)) {
      return { status: 'not_authenticated' };
    }
    let result: AppLockPreferenceSaveResult;
    try {
      lease.assertCurrent();
      await awaitAccountGenerationLease(lease, () => setAppLockEnabledStored(input.enabled));
      result = { status: 'saved', enabled: input.enabled };
    } catch (writeError) {
      lease.assertCurrent();
      if (!requestIsCurrent(input.isInteractionCurrent)) throw writeError;
      const readback = await readPreferenceWithLease(lease);
      if (readback.status === 'available' && readback.enabled === input.enabled) {
        result = { status: 'saved', enabled: input.enabled };
      } else if (
        readback.status === 'unavailable' ||
        readback.status === 'corrupt' ||
        readback.status === 'unsupported_version'
      ) {
        result = { status: 'write_uncertain', preference: readback };
      } else {
        throw writeError;
      }
    }
    lease.assertCurrent();
    if (requestIsCurrent(input.isInteractionCurrent)) input.publish(result);
    return result;
  });
}
