import type { Session, User } from '@supabase/supabase-js';
import { describe, expect, it, vi } from 'vitest';

import {
  authSessionFingerprint,
  authenticateWithProviderToken,
  type AccountUpgradeAuthClient,
} from './accountUpgrade';
import { createAuthMutationFence } from './authMutationFence';

function deferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((resolvePromise) => {
    resolve = resolvePromise;
  });
  return { promise, resolve };
}

function makeUser(id: string, isAnonymous: boolean): User {
  return {
    app_metadata: {},
    aud: 'authenticated',
    created_at: '2026-07-15T00:00:00.000Z',
    id,
    is_anonymous: isAnonymous,
    user_metadata: {},
  };
}

function makeSession(user: User): Session {
  return {
    access_token: `access-${user.id}`,
    expires_at: 1_900_000_000,
    expires_in: 3_600,
    refresh_token: `refresh-${user.id}`,
    token_type: 'bearer',
    user,
  };
}

function makeAuth(getRawSession: () => Session | null) {
  const spies = {
    getSession: vi.fn(async () => ({ data: { session: getRawSession() }, error: null })),
    linkIdentity: vi.fn(),
    signInWithIdToken: vi.fn(),
    signInWithOtp: vi.fn(),
    updateUser: vi.fn(),
    verifyOtp: vi.fn(),
  };
  return {
    auth: spies as unknown as AccountUpgradeAuthClient,
    spies,
  };
}

describe('AuthProvider auth mutation fence', () => {
  it('keeps a newer B transition out of auth-js delayed identity-session capture', async () => {
    const fence = createAuthMutationFence();
    const ownerAAnonymous = makeSession(makeUser('owner-a', true));
    const ownerAPermanent = makeSession(makeUser('owner-a', false));
    const ownerB = makeSession(makeUser('owner-b', false));
    let rawSession: Session | null = ownerAAnonymous;
    let authEpoch = 7;
    const expectedEpoch = authEpoch;
    const internalCaptureStarted = deferred<void>();
    const allowInternalCapture = deferred<void>();
    const mutatedOwners: string[] = [];
    const { auth, spies } = makeAuth(() => rawSession);
    spies.linkIdentity.mockImplementationOnce(async () => {
      internalCaptureStarted.resolve();
      await allowInternalCapture.promise;
      const internallyCapturedSession = rawSession;
      if (internallyCapturedSession) mutatedOwners.push(internallyCapturedSession.user.id);
      return {
        data: { session: ownerAPermanent, user: ownerAPermanent.user },
        error: null,
      };
    });

    const providerMutation = fence.runExclusive(() =>
      authenticateWithProviderToken(
        auth,
        { provider: 'apple', token: 'owner-a-token' },
        authSessionFingerprint(ownerAAnonymous),
        () => {
          if (authEpoch !== expectedEpoch) throw new Error('provider request superseded');
        },
        (operation) => operation(),
      ),
    );
    await internalCaptureStarted.promise;

    let ownerBStarted = false;
    const ownerBTransition = fence.runExclusive(() => {
      ownerBStarted = true;
      rawSession = ownerB;
      authEpoch += 1;
    });
    await Promise.resolve();
    await Promise.resolve();

    expect(ownerBStarted).toBe(false);
    expect(rawSession?.user.id).toBe('owner-a');

    allowInternalCapture.resolve();
    await providerMutation;
    await ownerBTransition;

    expect(mutatedOwners).toEqual(['owner-a']);
    expect((rawSession as Session | null)?.user.id).toBe('owner-b');
  });

  it('keeps newer B behind a signed-out provider request until auth-js late local save settles', async () => {
    const fence = createAuthMutationFence();
    const providerSession = makeSession(makeUser('provider-owner', false));
    const ownerB = makeSession(makeUser('owner-b', false));
    let rawSession: Session | null = null;
    const lateSaveStarted = deferred<void>();
    const allowLateSave = deferred<void>();
    const { auth, spies } = makeAuth(() => rawSession);
    spies.signInWithIdToken.mockImplementationOnce(async () => {
      lateSaveStarted.resolve();
      await allowLateSave.promise;
      rawSession = providerSession;
      return { data: { session: providerSession, user: providerSession.user }, error: null };
    });

    const providerMutation = fence.runExclusive(() =>
      authenticateWithProviderToken(
        auth,
        { provider: 'google', token: 'provider-token' },
        authSessionFingerprint(null),
        () => {},
        (operation) => operation(),
      ),
    );
    await lateSaveStarted.promise;

    let ownerBStarted = false;
    const ownerBTransition = fence.runExclusive(() => {
      ownerBStarted = true;
      rawSession = ownerB;
    });
    await Promise.resolve();
    await Promise.resolve();
    expect(ownerBStarted).toBe(false);

    allowLateSave.resolve();
    await providerMutation;
    await ownerBTransition;

    expect((rawSession as Session | null)?.user.id).toBe('owner-b');
  });

  it('lets an older B transition finish first and invalidates A before any provider SDK call', async () => {
    const fence = createAuthMutationFence();
    const ownerA = makeSession(makeUser('owner-a', true));
    const ownerB = makeSession(makeUser('owner-b', false));
    let rawSession: Session | null = ownerA;
    let authEpoch = 11;
    const expectedEpoch = authEpoch;
    const releaseOwnerB = deferred<void>();
    const { auth, spies } = makeAuth(() => rawSession);

    const ownerBTransition = fence.runExclusive(async () => {
      await releaseOwnerB.promise;
      rawSession = ownerB;
      authEpoch += 1;
    });
    const providerMutation = fence.runExclusive(() =>
      authenticateWithProviderToken(
        auth,
        { provider: 'apple', token: 'late-owner-a-token' },
        authSessionFingerprint(ownerA),
        () => {
          if (authEpoch !== expectedEpoch) throw new Error('provider request superseded');
        },
        (operation) => operation(),
      ),
    );

    releaseOwnerB.resolve();
    await ownerBTransition;
    await expect(providerMutation).rejects.toThrow('provider request superseded');
    expect(spies.getSession).not.toHaveBeenCalled();
    expect(spies.linkIdentity).not.toHaveBeenCalled();
    expect(spies.signInWithIdToken).not.toHaveBeenCalled();
  });
});
