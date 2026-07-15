import type { Session, User } from '@supabase/supabase-js';
import { describe, expect, it, vi } from 'vitest';

import {
  authSessionFingerprint,
  authenticateWithProviderToken as authenticateWithProviderTokenUnderLock,
  ProviderAuthSessionChangedError,
  requestEmailAccountCode,
  verifyEmailAccountCode,
  type AccountUpgradeAuthClient,
  type AccountProvider,
  type AuthSessionFingerprint,
  type PendingEmailAccountCode,
} from './accountUpgrade';

function makeUser(id: string, isAnonymous: boolean): User {
  return {
    app_metadata: {},
    aud: 'authenticated',
    created_at: '2026-07-10T00:00:00.000Z',
    id,
    is_anonymous: isAnonymous,
    user_metadata: {},
  };
}

function makeSession(user: User): Session {
  return {
    access_token: 'access-token',
    expires_at: 1_900_000_000,
    expires_in: 3_600,
    refresh_token: 'refresh-token',
    token_type: 'bearer',
    user,
  };
}

function makeAuth(session: Session | null) {
  const spies = {
    getSession: vi.fn(async () => ({ data: { session }, error: null })),
    linkIdentity: vi.fn(),
    signInWithIdToken: vi.fn(),
    signInWithOtp: vi.fn(),
    updateUser: vi.fn(),
    verifyOtp: vi.fn(),
  };
  return {
    auth: spies as unknown as AccountUpgradeAuthClient,
    expectedSession: authSessionFingerprint(session),
    spies,
  };
}

const assertRequestCurrent = () => {};

function authenticateWithProviderToken(
  auth: AccountUpgradeAuthClient,
  credentials: { provider: AccountProvider; token: string },
  expectedSession: AuthSessionFingerprint,
  assertCurrent: () => void,
): Promise<void> {
  return authenticateWithProviderTokenUnderLock(
    auth,
    credentials,
    expectedSession,
    assertCurrent,
    (operation) => operation(),
  );
}

describe('account upgrade', () => {
  it('links a provider token to the current anonymous user instead of signing in as a new user', async () => {
    const anonymousUser = makeUser('anon-user', true);
    const permanentUser = makeUser('anon-user', false);
    const { auth, expectedSession, spies } = makeAuth(makeSession(anonymousUser));
    spies.linkIdentity.mockResolvedValue({
      data: { session: makeSession(permanentUser), user: permanentUser },
      error: null,
    });

    await authenticateWithProviderToken(
      auth,
      { provider: 'google', token: '  id-token  ' },
      expectedSession,
      assertRequestCurrent,
    );

    expect(spies.linkIdentity).toHaveBeenCalledWith({ provider: 'google', token: 'id-token' });
    expect(spies.signInWithIdToken).not.toHaveBeenCalled();
  });

  it('never falls back to a user-switching sign-in when provider linking fails', async () => {
    const { auth, expectedSession, spies } = makeAuth(makeSession(makeUser('anon-user', true)));
    spies.linkIdentity.mockResolvedValue({
      data: { session: null, user: null },
      error: new Error('Identity is already linked to another user'),
    });

    await expect(
      authenticateWithProviderToken(
        auth,
        { provider: 'apple', token: 'id-token' },
        expectedSession,
        assertRequestCurrent,
      ),
    ).rejects.toThrow('already linked');
    expect(spies.signInWithIdToken).not.toHaveBeenCalled();
  });

  it('uses normal provider sign-in when there is no anonymous session to preserve', async () => {
    const { auth, expectedSession, spies } = makeAuth(null);
    spies.signInWithIdToken.mockResolvedValue({
      data: { session: makeSession(makeUser('returning-user', false)), user: null },
      error: null,
    });

    await authenticateWithProviderToken(
      auth,
      { provider: 'google', token: 'id-token' },
      expectedSession,
      assertRequestCurrent,
    );

    expect(spies.signInWithIdToken).toHaveBeenCalledWith({
      provider: 'google',
      token: 'id-token',
    });
    expect(spies.linkIdentity).not.toHaveBeenCalled();
  });

  it('rejects a provider response that changes the anonymous user id', async () => {
    const { auth, expectedSession, spies } = makeAuth(makeSession(makeUser('anon-user', true)));
    const wrongUser = makeUser('different-user', false);
    spies.linkIdentity.mockResolvedValue({
      data: { session: makeSession(wrongUser), user: wrongUser },
      error: null,
    });

    await expect(
      authenticateWithProviderToken(
        auth,
        { provider: 'google', token: 'id-token' },
        expectedSession,
        assertRequestCurrent,
      ),
    ).rejects.toThrow('preserve the current authenticated user');
  });

  it('rejects a changed owner before any provider mutation', async () => {
    const expectedSession = authSessionFingerprint(makeSession(makeUser('owner-a', true)));
    const { auth, spies } = makeAuth(makeSession(makeUser('owner-b', true)));

    await expect(
      authenticateWithProviderToken(
        auth,
        { provider: 'apple', token: 'late-token' },
        expectedSession,
        assertRequestCurrent,
      ),
    ).rejects.toBeInstanceOf(ProviderAuthSessionChangedError);

    expect(spies.linkIdentity).not.toHaveBeenCalled();
    expect(spies.signInWithIdToken).not.toHaveBeenCalled();
  });

  it('rejects an anonymous-to-permanent fingerprint change before provider mutation', async () => {
    const expectedSession = authSessionFingerprint(makeSession(makeUser('same-owner', true)));
    const { auth, spies } = makeAuth(makeSession(makeUser('same-owner', false)));

    await expect(
      authenticateWithProviderToken(
        auth,
        { provider: 'google', token: 'late-token' },
        expectedSession,
        assertRequestCurrent,
      ),
    ).rejects.toBeInstanceOf(ProviderAuthSessionChangedError);

    expect(spies.linkIdentity).not.toHaveBeenCalled();
    expect(spies.signInWithIdToken).not.toHaveBeenCalled();
  });

  it('rejects signed-out to signed-in session replacement before provider mutation', async () => {
    const expectedSession = authSessionFingerprint(null);
    const { auth, spies } = makeAuth(makeSession(makeUser('owner-b', false)));

    await expect(
      authenticateWithProviderToken(
        auth,
        { provider: 'google', token: 'late-signed-out-token' },
        expectedSession,
        assertRequestCurrent,
      ),
    ).rejects.toBeInstanceOf(ProviderAuthSessionChangedError);

    expect(spies.linkIdentity).not.toHaveBeenCalled();
    expect(spies.signInWithIdToken).not.toHaveBeenCalled();
  });

  it('rechecks request lifecycle after session lookup and before provider mutation', async () => {
    const session = makeSession(makeUser('owner-a', true));
    const { auth, expectedSession, spies } = makeAuth(session);
    let current = true;
    spies.getSession.mockImplementationOnce(async () => {
      current = false;
      return { data: { session }, error: null };
    });

    await expect(
      authenticateWithProviderToken(
        auth,
        { provider: 'apple', token: 'late-token' },
        expectedSession,
        () => {
          if (!current) throw new Error('request superseded');
        },
      ),
    ).rejects.toThrow('request superseded');

    expect(spies.linkIdentity).not.toHaveBeenCalled();
    expect(spies.signInWithIdToken).not.toHaveBeenCalled();
  });

  it('rechecks request lifecycle after waiting for the auth storage lock', async () => {
    const session = makeSession(makeUser('owner-a', true));
    const { auth, expectedSession, spies } = makeAuth(session);
    let current = true;

    await expect(
      authenticateWithProviderTokenUnderLock(
        auth,
        { provider: 'google', token: 'late-token' },
        expectedSession,
        () => {
          if (!current) throw new Error('request superseded while waiting for storage lock');
        },
        async (operation) => {
          current = false;
          return operation();
        },
      ),
    ).rejects.toThrow('superseded while waiting for storage lock');

    expect(spies.linkIdentity).not.toHaveBeenCalled();
    expect(spies.signInWithIdToken).not.toHaveBeenCalled();
  });

  it('requests an email-change code against the same anonymous user', async () => {
    const anonymousUser = makeUser('anon-user', true);
    const { auth, spies } = makeAuth(makeSession(anonymousUser));
    spies.updateUser.mockResolvedValue({ data: { user: anonymousUser }, error: null });

    const pending = await requestEmailAccountCode(auth, '  tas@example.com  ');

    expect(spies.updateUser).toHaveBeenCalledWith({ email: 'tas@example.com' });
    expect(spies.signInWithOtp).not.toHaveBeenCalled();
    expect(pending).toEqual({
      email: 'tas@example.com',
      expectedUserId: 'anon-user',
      kind: 'anonymous_upgrade',
      otpType: 'email_change',
    });
  });

  it('completes immediately when the project auto-confirms the same anonymous user', async () => {
    const anonymousUser = makeUser('anon-user', true);
    const permanentUser = makeUser('anon-user', false);
    const { auth, spies } = makeAuth(makeSession(anonymousUser));
    spies.updateUser.mockResolvedValue({ data: { user: permanentUser }, error: null });

    const request = await requestEmailAccountCode(auth, 'tas@example.com');

    expect(request).toEqual({
      email: 'tas@example.com',
      expectedUserId: 'anon-user',
      kind: 'anonymous_upgrade_complete',
    });
    expect(spies.verifyOtp).not.toHaveBeenCalled();
  });

  it('never falls back to OTP sign-in when an email cannot attach to the anonymous user', async () => {
    const { auth, spies } = makeAuth(makeSession(makeUser('anon-user', true)));
    spies.updateUser.mockResolvedValue({
      data: { user: null },
      error: new Error('A user with this email has already been registered'),
    });

    await expect(requestEmailAccountCode(auth, 'tas@example.com')).rejects.toThrow(
      'already been registered',
    );
    expect(spies.signInWithOtp).not.toHaveBeenCalled();
  });

  it('uses normal email OTP sign-in when there is no anonymous session', async () => {
    const { auth, spies } = makeAuth(null);
    spies.signInWithOtp.mockResolvedValue({ data: { messageId: 'message-id' }, error: null });

    const pending = await requestEmailAccountCode(auth, 'tas@example.com');

    expect(spies.signInWithOtp).toHaveBeenCalledWith({
      email: 'tas@example.com',
      options: { shouldCreateUser: true },
    });
    expect(spies.updateUser).not.toHaveBeenCalled();
    expect(pending.kind).toBe('sign_in');
    if (pending.kind !== 'sign_in') throw new Error('Expected sign-in code request.');
    expect(pending.otpType).toBe('email');
  });

  it('verifies an anonymous email upgrade with email_change and preserves the user id', async () => {
    const anonymousUser = makeUser('anon-user', true);
    const permanentUser = makeUser('anon-user', false);
    const { auth, spies } = makeAuth(makeSession(anonymousUser));
    spies.verifyOtp.mockResolvedValue({
      data: { session: makeSession(permanentUser), user: permanentUser },
      error: null,
    });
    const pending: PendingEmailAccountCode = {
      email: 'tas@example.com',
      expectedUserId: 'anon-user',
      kind: 'anonymous_upgrade',
      otpType: 'email_change',
    };

    await verifyEmailAccountCode(auth, pending, 'tas@example.com', ' 123456 ');

    expect(spies.verifyOtp).toHaveBeenCalledWith({
      email: 'tas@example.com',
      token: '123456',
      type: 'email_change',
    });
  });

  it('refuses to consume an anonymous upgrade code after the session changes', async () => {
    const { auth, spies } = makeAuth(makeSession(makeUser('different-user', false)));
    const pending: PendingEmailAccountCode = {
      email: 'tas@example.com',
      expectedUserId: 'anon-user',
      kind: 'anonymous_upgrade',
      otpType: 'email_change',
    };

    await expect(
      verifyEmailAccountCode(auth, pending, 'tas@example.com', '123456'),
    ).rejects.toThrow('no longer valid for the current session');
    expect(spies.verifyOtp).not.toHaveBeenCalled();
  });

  it('rejects an email verification response that is still anonymous', async () => {
    const anonymousUser = makeUser('anon-user', true);
    const { auth, spies } = makeAuth(makeSession(anonymousUser));
    spies.verifyOtp.mockResolvedValue({
      data: { session: makeSession(anonymousUser), user: anonymousUser },
      error: null,
    });
    const pending: PendingEmailAccountCode = {
      email: 'tas@example.com',
      expectedUserId: 'anon-user',
      kind: 'anonymous_upgrade',
      otpType: 'email_change',
    };

    await expect(
      verifyEmailAccountCode(auth, pending, 'tas@example.com', '123456'),
    ).rejects.toThrow('did not create a permanent identity');
  });
});
