import { describe, expect, it, vi } from 'vitest';

import type { AccountProvider, AuthSessionFingerprint } from './accountUpgrade';
import {
  createProviderAuthTransitionTracker,
  createProviderSignInCoordinator,
  ProviderSignInInFlightError,
  ProviderSignInRequestSupersededError,
} from './providerSignIn';

function deferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((resolvePromise) => {
    resolve = resolvePromise;
  });
  return { promise, resolve };
}

function signedIn(
  userId: string,
  identity: 'anonymous' | 'permanent' = 'anonymous',
): AuthSessionFingerprint {
  return { identity, status: 'signed_in', userId };
}

function setup(initialSession: AuthSessionFingerprint = signedIn('owner-a')) {
  let authTransitionEpoch = 4;
  let publishedSession = initialSession;
  let sessionStable = true;
  const authenticate = vi.fn<
    (
      provider: AccountProvider,
      token: string,
      expectedSession: AuthSessionFingerprint,
      assertRequestCurrent: () => void,
    ) => Promise<void>
  >(async () => {});
  const dependencies = {
    authenticate,
    getAuthTransitionEpoch: () => authTransitionEpoch,
    getPublishedSessionFingerprint: () => publishedSession,
    isSessionStable: () => sessionStable,
  };
  const coordinator = createProviderSignInCoordinator();

  return {
    authenticate,
    coordinator,
    dependencies,
    setAuthTransitionEpoch(value: number) {
      authTransitionEpoch = value;
    },
    setPublishedSession(value: AuthSessionFingerprint) {
      publishedSession = value;
    },
    setSessionStable(value: boolean) {
      sessionStable = value;
    },
  };
}

describe('provider sign-in coordinator', () => {
  it('does not supersede a prompt for a same-owner token refresh', async () => {
    const fingerprint = signedIn('owner-a', 'permanent');
    const tracker = createProviderAuthTransitionTracker(fingerprint);
    const token = deferred<{ idToken: string } | null>();
    const authenticate = vi.fn(async () => {});
    const coordinator = createProviderSignInCoordinator();
    const dependencies = {
      authenticate,
      getAuthTransitionEpoch: tracker.getEpoch,
      getPublishedSessionFingerprint: () => fingerprint,
      isSessionStable: () => true,
    };
    const request = coordinator.run('google', async () => token.promise, dependencies);

    expect(tracker.observe(signedIn('owner-a', 'permanent'))).toBe(false);
    expect(tracker.getEpoch()).toBe(0);
    token.resolve({ idToken: 'refreshed-owner-token' });

    await expect(request).resolves.toBe(true);
    expect(authenticate).toHaveBeenCalledTimes(1);
  });

  it('rejects a delayed Apple token from owner A after auth transitions to owner B', async () => {
    const token = deferred<{ idToken: string } | null>();
    const setupResult = setup();
    const request = setupResult.coordinator.run(
      'apple',
      async (assertCurrent) => {
        const result = await token.promise;
        assertCurrent();
        return result;
      },
      setupResult.dependencies,
    );

    setupResult.setPublishedSession(signedIn('owner-b'));
    setupResult.setAuthTransitionEpoch(5);
    token.resolve({ idToken: 'late-apple-token' });

    await expect(request).rejects.toBeInstanceOf(ProviderSignInRequestSupersededError);
    expect(setupResult.authenticate).not.toHaveBeenCalled();
    expect(setupResult.coordinator.isInFlight()).toBe(false);
  });

  it('checks each delayed Google native await before accepting owner A token for owner B', async () => {
    const playServices = deferred<void>();
    const signIn = deferred<{ idToken: string } | null>();
    const setupResult = setup();
    const request = setupResult.coordinator.run(
      'google',
      async (assertCurrent) => {
        await playServices.promise;
        assertCurrent();
        const result = await signIn.promise;
        assertCurrent();
        return result;
      },
      setupResult.dependencies,
    );

    playServices.resolve();
    await playServices.promise;
    setupResult.setPublishedSession(signedIn('owner-b'));
    setupResult.setAuthTransitionEpoch(5);
    signIn.resolve({ idToken: 'late-google-token' });

    await expect(request).rejects.toBeInstanceOf(ProviderSignInRequestSupersededError);
    expect(setupResult.authenticate).not.toHaveBeenCalled();
  });

  it('installs one synchronous lock across Apple and Google prompts', async () => {
    const appleToken = deferred<{ idToken: string } | null>();
    const setupResult = setup();
    const requestAppleToken = vi.fn(async () => appleToken.promise);
    const requestGoogleToken = vi.fn(async () => ({ idToken: 'google-token' }));

    const appleRequest = setupResult.coordinator.run(
      'apple',
      requestAppleToken,
      setupResult.dependencies,
    );
    const googleRequest = setupResult.coordinator.run(
      'google',
      requestGoogleToken,
      setupResult.dependencies,
    );

    await expect(googleRequest).rejects.toBeInstanceOf(ProviderSignInInFlightError);
    expect(requestAppleToken).toHaveBeenCalledTimes(1);
    expect(requestGoogleToken).not.toHaveBeenCalled();
    expect(setupResult.authenticate).not.toHaveBeenCalled();

    appleToken.resolve(null);
    await expect(appleRequest).resolves.toBe(false);
    await expect(
      setupResult.coordinator.run('google', requestGoogleToken, setupResult.dependencies),
    ).resolves.toBe(true);
  });

  it('captures the exact session fingerprint before opening native provider UI', async () => {
    const setupResult = setup(signedIn('owner-a'));
    setupResult.authenticate.mockImplementationOnce(async (_provider, _token, expectedSession) => {
      expect(expectedSession).toEqual(signedIn('owner-a'));
    });

    await expect(
      setupResult.coordinator.run(
        'google',
        async () => {
          setupResult.setPublishedSession(signedIn('owner-b', 'permanent'));
          return { idToken: 'captured-token' };
        },
        setupResult.dependencies,
      ),
    ).resolves.toBe(true);
  });

  it('preserves same-owner success when the successful auth mutation advances the epoch', async () => {
    const setupResult = setup(signedIn('same-owner'));
    setupResult.authenticate.mockImplementationOnce(
      async (_provider, _token, expectedSession, assertRequestCurrent) => {
        expect(expectedSession).toEqual(signedIn('same-owner'));
        assertRequestCurrent();
        setupResult.setPublishedSession(signedIn('same-owner', 'permanent'));
        setupResult.setAuthTransitionEpoch(5);
      },
    );

    await expect(
      setupResult.coordinator.run(
        'apple',
        async () => ({ idToken: 'valid-token' }),
        setupResult.dependencies,
      ),
    ).resolves.toBe(true);
    expect(setupResult.authenticate).toHaveBeenCalledWith(
      'apple',
      'valid-token',
      signedIn('same-owner'),
      expect.any(Function),
    );
  });

  it('treats provider cancellation or a missing token as a no-op and releases the lock', async () => {
    const setupResult = setup();

    await expect(
      setupResult.coordinator.run('google', async () => null, setupResult.dependencies),
    ).resolves.toBe(false);
    expect(setupResult.authenticate).not.toHaveBeenCalled();
    expect(setupResult.coordinator.isInFlight()).toBe(false);
  });

  it('does not open native provider UI while a session boundary is active', async () => {
    const setupResult = setup();
    const requestToken = vi.fn(async () => ({ idToken: 'token' }));
    setupResult.setSessionStable(false);

    await expect(
      setupResult.coordinator.run('apple', requestToken, setupResult.dependencies),
    ).rejects.toBeInstanceOf(ProviderSignInRequestSupersededError);
    expect(requestToken).not.toHaveBeenCalled();
    expect(setupResult.authenticate).not.toHaveBeenCalled();
  });
});
