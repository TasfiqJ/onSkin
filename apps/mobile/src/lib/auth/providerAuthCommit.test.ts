import type { Session, User } from '@supabase/supabase-js';
import { describe, expect, it, vi } from 'vitest';

import {
  authSessionFingerprint,
  authenticateWithProviderToken,
  type AccountUpgradeAuthClient,
} from './accountUpgrade';
import { createAuthMutationFence } from './authMutationFence';
import { createProviderAuthCommitCoordinator } from './providerAuthCommit';

function deferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((resolvePromise) => {
    resolve = resolvePromise;
  });
  return { promise, resolve };
}

function makeSession(isAnonymous: boolean): Session {
  const user: User = {
    app_metadata: {},
    aud: 'authenticated',
    created_at: '2026-07-15T00:00:00.000Z',
    id: 'owner-a',
    is_anonymous: isAnonymous,
    user_metadata: {},
  };
  return {
    access_token: 'access-owner-a',
    expires_at: 1_900_000_000,
    expires_in: 3_600,
    refresh_token: 'refresh-owner-a',
    token_type: 'bearer',
    user,
  };
}

function makeCoordinator() {
  let appActive = true;
  const authMutationFence = createAuthMutationFence();
  const startAutoRefresh = vi.fn();
  const stopAutoRefresh = vi.fn();
  const coordinator = createProviderAuthCommitCoordinator({
    authMutationFence,
    isAppActive: () => appActive,
    startAutoRefresh,
    stopAutoRefresh,
  });
  return {
    authMutationFence,
    coordinator,
    setAppActive(value: boolean) {
      appActive = value;
    },
    startAutoRefresh,
    stopAutoRefresh,
  };
}

describe('provider auth commit coordinator', () => {
  it('stops auto-refresh and drains a delayed refresh before linkIdentity starts', async () => {
    const session = makeSession(true);
    const permanentSession = makeSession(false);
    const refreshStarted = deferred<void>();
    const allowRefreshToSettle = deferred<void>();
    const linkIdentity = vi.fn(async () => ({
      data: { session: permanentSession, user: permanentSession.user },
      error: null,
    }));
    const auth = {
      getSession: vi.fn(async () => ({ data: { session }, error: null })),
      linkIdentity,
      signInWithIdToken: vi.fn(),
      signInWithOtp: vi.fn(),
      updateUser: vi.fn(),
      verifyOtp: vi.fn(),
    } as unknown as AccountUpgradeAuthClient;
    const setup = makeCoordinator();

    const commit = setup.coordinator.runExclusive(() =>
      authenticateWithProviderToken(
        auth,
        { provider: 'apple', token: 'provider-token' },
        authSessionFingerprint(session),
        () => {},
        async (operation) => {
          refreshStarted.resolve();
          await allowRefreshToSettle.promise;
          return operation();
        },
      ),
    );
    await refreshStarted.promise;

    expect(setup.stopAutoRefresh).toHaveBeenCalledTimes(1);
    expect(linkIdentity).not.toHaveBeenCalled();
    expect(setup.coordinator.isHeld()).toBe(true);

    allowRefreshToSettle.resolve();
    await commit;

    expect(linkIdentity).toHaveBeenCalledTimes(1);
    expect(setup.startAutoRefresh).toHaveBeenCalledTimes(1);
    expect(setup.coordinator.isHeld()).toBe(false);
  });

  it('suppresses AppState auto-refresh restart and newer auth work while SDK commit is held', async () => {
    const setup = makeCoordinator();
    const sdkStarted = deferred<void>();
    const allowSdkToSettle = deferred<void>();
    const commit = setup.coordinator.runExclusive(async () => {
      sdkStarted.resolve();
      await allowSdkToSettle.promise;
    });
    await sdkStarted.promise;

    let newerAuthStarted = false;
    const newerAuth = setup.authMutationFence.runExclusive(() => {
      newerAuthStarted = true;
    });
    setup.coordinator.handleAppStateChange('background');
    setup.coordinator.handleAppStateChange('active');
    await Promise.resolve();
    await Promise.resolve();

    expect(setup.startAutoRefresh).not.toHaveBeenCalled();
    expect(setup.stopAutoRefresh).toHaveBeenCalledTimes(3);
    expect(newerAuthStarted).toBe(false);

    allowSdkToSettle.resolve();
    await commit;
    await newerAuth;

    expect(setup.startAutoRefresh).toHaveBeenCalledTimes(1);
    expect(newerAuthStarted).toBe(true);
  });

  it('does not restart auto-refresh after commit settles in the background', async () => {
    const setup = makeCoordinator();
    setup.setAppActive(false);

    await setup.coordinator.runExclusive(async () => {});

    expect(setup.stopAutoRefresh).toHaveBeenCalledTimes(1);
    expect(setup.startAutoRefresh).not.toHaveBeenCalled();
  });
});
