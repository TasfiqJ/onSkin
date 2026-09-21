import type { Session, User } from '@supabase/supabase-js';
import { afterEach, describe, expect, it, vi } from 'vitest';

import {
  authenticateWithAppleCredential,
  authenticateWithProviderToken,
  requestEmailAccountCode,
  resendEmailAccountCode,
  verifyEmailAccountCode,
  type AccountUpgradeAuthClient,
  type PendingEmailAccountCode,
} from './accountUpgrade';

const remoteGateMocks = vi.hoisted(() => ({
  requireBinding: vi.fn((accessToken: string, subject: string) => ({
    accessToken,
    sessionId: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
    subject,
  })),
  runFresh: vi.fn(async <T>(operation: () => T | Promise<T>) => operation()),
  runApple: vi.fn(
    async <T>(_credentials: unknown, _binding: unknown, operation: () => T | Promise<T>) =>
      operation(),
  ),
  runIdentityUpgrade: vi.fn(async <T>(_binding: unknown, operation: () => T | Promise<T>) =>
    operation(),
  ),
}));

vi.mock('@/lib/supabase/remoteRequestGate', () => ({
  requireSupabaseRemoteSessionBinding: remoteGateMocks.requireBinding,
  runWithSupabaseFreshAuthPermit: remoteGateMocks.runFresh,
  runWithSupabaseAppleAuthBootstrapPermit: remoteGateMocks.runApple,
  runWithSupabaseIdentityUpgradePermit: remoteGateMocks.runIdentityUpgrade,
}));

const appleLifecycleMocks = vi.hoisted(() => ({
  capture: vi.fn(async () => ({
    status: 'active' as const,
    generation: 1,
    nextValidationAt: '2026-07-16T00:00:00.000Z',
  })),
}));

vi.mock('./appleAuthLifecycleClient', () => ({
  captureAppleAuthLifecycle: appleLifecycleMocks.capture,
}));

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

const APPLE_CREDENTIAL = Object.freeze({
  appleUser: 'apple-subject',
  authorizationCode: 'single-use-code',
  email: null,
  idToken: 'apple-id-token',
  nonce: 'a'.repeat(43),
});

const sessionByAuth = new WeakMap<AccountUpgradeAuthClient, Session | null>();

function explicitSession(auth: AccountUpgradeAuthClient): Session | null {
  const session = sessionByAuth.get(auth);
  if (session === undefined) throw new Error('Missing explicit test session.');
  return session;
}

function makeAuth(session: Session | null) {
  const spies = {
    getSession: vi.fn(async () => ({ data: { session }, error: null })),
    linkIdentity: vi.fn(),
    resend: vi.fn(),
    signInWithIdToken: vi.fn(),
    signInWithOtp: vi.fn(),
    updateUser: vi.fn(),
    verifyOtp: vi.fn(),
  };
  const auth = spies as unknown as AccountUpgradeAuthClient;
  sessionByAuth.set(auth, session);
  return { auth, spies };
}

afterEach(() => {
  vi.clearAllMocks();
  remoteGateMocks.requireBinding.mockImplementation((accessToken: string, subject: string) => ({
    accessToken,
    sessionId: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
    subject,
  }));
  remoteGateMocks.runFresh.mockImplementation(async (operation) => operation());
  remoteGateMocks.runApple.mockImplementation(async (_credentials, _binding, operation) =>
    operation(),
  );
  remoteGateMocks.runIdentityUpgrade.mockImplementation(async (_binding, operation) => operation());
  appleLifecycleMocks.capture.mockResolvedValue({
    status: 'active',
    generation: 1,
    nextValidationAt: '2026-07-16T00:00:00.000Z',
  });
});

describe('account upgrade', () => {
  it('links a provider token to the current anonymous user instead of signing in as a new user', async () => {
    const anonymousUser = makeUser('anon-user', true);
    const permanentUser = makeUser('anon-user', false);
    const { auth, spies } = makeAuth(makeSession(anonymousUser));
    spies.linkIdentity.mockResolvedValue({
      data: { session: makeSession(permanentUser), user: permanentUser },
      error: null,
    });

    await authenticateWithProviderToken(auth, explicitSession(auth), {
      provider: 'google',
      token: '  id-token  ',
    });

    expect(spies.linkIdentity).toHaveBeenCalledWith({ provider: 'google', token: 'id-token' });
    expect(spies.signInWithIdToken).not.toHaveBeenCalled();
    expect(remoteGateMocks.requireBinding).toHaveBeenCalledWith('access-token', 'anon-user');
    expect(remoteGateMocks.runIdentityUpgrade).toHaveBeenCalledWith(
      expect.objectContaining({ accessToken: 'access-token', subject: 'anon-user' }),
      expect.any(Function),
    );
    expect(spies.getSession).not.toHaveBeenCalled();
  });

  it('never falls back to a user-switching sign-in when provider linking fails', async () => {
    const { auth, spies } = makeAuth(makeSession(makeUser('anon-user', true)));
    spies.linkIdentity.mockResolvedValue({
      data: { session: null, user: null },
      error: new Error('Identity is already linked to another user'),
    });

    await expect(
      authenticateWithAppleCredential(auth, explicitSession(auth), APPLE_CREDENTIAL),
    ).rejects.toThrow('already linked');
    expect(spies.signInWithIdToken).not.toHaveBeenCalled();
  });

  it('passes the raw Apple nonce while linking the exact anonymous user', async () => {
    const anonymousUser = makeUser('anon-user', true);
    const permanentUser = makeUser('anon-user', false);
    const { auth, spies } = makeAuth(makeSession(anonymousUser));
    spies.linkIdentity.mockResolvedValue({
      data: { session: makeSession(permanentUser), user: permanentUser },
      error: null,
    });

    await authenticateWithAppleCredential(auth, explicitSession(auth), APPLE_CREDENTIAL);

    expect(spies.linkIdentity).toHaveBeenCalledWith({
      nonce: APPLE_CREDENTIAL.nonce,
      provider: 'apple',
      token: 'apple-id-token',
    });
    expect(spies.signInWithIdToken).not.toHaveBeenCalled();
    expect(remoteGateMocks.runApple).toHaveBeenCalledWith(
      {
        appleUser: 'apple-subject',
        authorizationCode: 'single-use-code',
        identityToken: 'apple-id-token',
        nonce: APPLE_CREDENTIAL.nonce,
      },
      expect.objectContaining({ accessToken: 'access-token', subject: 'anon-user' }),
      expect.any(Function),
    );
    expect(appleLifecycleMocks.capture).toHaveBeenCalledWith('access-token', {
      appleUser: 'apple-subject',
      authorizationCode: 'single-use-code',
      identityToken: 'apple-id-token',
      nonce: APPLE_CREDENTIAL.nonce,
    });
  });

  it('captures against the previous bearer when same-user linking returns no session token', async () => {
    const anonymousUser = makeUser('anon-user', true);
    const permanentUser = makeUser('anon-user', false);
    const { auth, spies } = makeAuth(makeSession(anonymousUser));
    spies.linkIdentity.mockResolvedValue({
      data: { session: null, user: permanentUser },
      error: null,
    });

    await authenticateWithAppleCredential(auth, explicitSession(auth), APPLE_CREDENTIAL);

    expect(appleLifecycleMocks.capture).toHaveBeenCalledWith('access-token', expect.any(Object));
    expect(spies.signInWithIdToken).not.toHaveBeenCalled();
  });

  it('uses normal provider sign-in when there is no anonymous session to preserve', async () => {
    const { auth, spies } = makeAuth(null);
    spies.signInWithIdToken.mockResolvedValue({
      data: { session: makeSession(makeUser('returning-user', false)), user: null },
      error: null,
    });

    await authenticateWithProviderToken(auth, explicitSession(auth), {
      provider: 'google',
      token: 'id-token',
    });

    expect(spies.signInWithIdToken).toHaveBeenCalledWith({
      provider: 'google',
      token: 'id-token',
    });
    expect(spies.linkIdentity).not.toHaveBeenCalled();
    expect(remoteGateMocks.runFresh).toHaveBeenCalledWith(expect.any(Function));
  });

  it('passes the raw Apple nonce through the signed-out sign-in lane', async () => {
    const { auth, spies } = makeAuth(null);
    spies.signInWithIdToken.mockResolvedValue({
      data: { session: makeSession(makeUser('returning-user', false)), user: null },
      error: null,
    });

    await authenticateWithAppleCredential(auth, explicitSession(auth), APPLE_CREDENTIAL);

    expect(spies.signInWithIdToken).toHaveBeenCalledWith({
      nonce: APPLE_CREDENTIAL.nonce,
      provider: 'apple',
      token: 'apple-id-token',
    });
    expect(spies.linkIdentity).not.toHaveBeenCalled();
    expect(appleLifecycleMocks.capture).toHaveBeenCalledWith('access-token', expect.any(Object));
  });

  it('rejects a blank Apple nonce before opening either Supabase auth lane', async () => {
    const { auth, spies } = makeAuth(null);

    await expect(
      authenticateWithAppleCredential(auth, explicitSession(auth), {
        ...APPLE_CREDENTIAL,
        nonce: '   ',
      }),
    ).rejects.toThrow('invalid credential');

    expect(remoteGateMocks.runApple).not.toHaveBeenCalled();
    expect(spies.linkIdentity).not.toHaveBeenCalled();
    expect(spies.signInWithIdToken).not.toHaveBeenCalled();
  });

  it('never treats a permanent active session as a signed-out provider lane', async () => {
    const { auth, spies } = makeAuth(makeSession(makeUser('current-user', false)));

    await expect(
      authenticateWithProviderToken(auth, explicitSession(auth), {
        provider: 'google',
        token: 'id-token',
      }),
    ).rejects.toThrow('cannot replace an existing authenticated account');

    expect(remoteGateMocks.runFresh).not.toHaveBeenCalled();
    expect(spies.linkIdentity).not.toHaveBeenCalled();
    expect(spies.signInWithIdToken).not.toHaveBeenCalled();
  });

  it('never treats a permanent active session as an Apple bootstrap lane', async () => {
    const { auth, spies } = makeAuth(makeSession(makeUser('current-user', false)));

    await expect(
      authenticateWithAppleCredential(auth, explicitSession(auth), APPLE_CREDENTIAL),
    ).rejects.toThrow('cannot replace an existing authenticated account');

    expect(remoteGateMocks.runApple).not.toHaveBeenCalled();
    expect(spies.linkIdentity).not.toHaveBeenCalled();
    expect(spies.signInWithIdToken).not.toHaveBeenCalled();
    expect(appleLifecycleMocks.capture).not.toHaveBeenCalled();
  });

  it('fails the whole Apple bootstrap when lifecycle capture fails after auth succeeds', async () => {
    const permanentUser = makeUser('returning-user', false);
    const { auth, spies } = makeAuth(null);
    spies.signInWithIdToken.mockResolvedValue({
      data: { session: makeSession(permanentUser), user: permanentUser },
      error: null,
    });
    appleLifecycleMocks.capture.mockRejectedValueOnce(
      new Error('APPLE_AUTH_LIFECYCLE_CAPTURE_FAILED'),
    );

    await expect(
      authenticateWithAppleCredential(auth, explicitSession(auth), APPLE_CREDENTIAL),
    ).rejects.toThrow('APPLE_AUTH_LIFECYCLE_CAPTURE_FAILED');

    expect(spies.signInWithIdToken).toHaveBeenCalledOnce();
    expect(appleLifecycleMocks.capture).toHaveBeenCalledOnce();
    expect(remoteGateMocks.runApple).toHaveBeenCalledOnce();
  });

  it('rejects a provider response that changes the anonymous user id', async () => {
    const { auth, spies } = makeAuth(makeSession(makeUser('anon-user', true)));
    const wrongUser = makeUser('different-user', false);
    spies.linkIdentity.mockResolvedValue({
      data: { session: makeSession(wrongUser), user: wrongUser },
      error: null,
    });

    await expect(
      authenticateWithProviderToken(auth, explicitSession(auth), {
        provider: 'google',
        token: 'id-token',
      }),
    ).rejects.toThrow('preserve the current authenticated user');
  });

  it('requests an email-change code against the same anonymous user', async () => {
    const anonymousUser = makeUser('anon-user', true);
    const { auth, spies } = makeAuth(makeSession(anonymousUser));
    spies.updateUser.mockResolvedValue({ data: { user: anonymousUser }, error: null });

    const pending = await requestEmailAccountCode(
      auth,
      explicitSession(auth),
      '  tas@example.com  ',
    );

    expect(spies.updateUser).toHaveBeenCalledWith({ email: 'tas@example.com' });
    expect(spies.signInWithOtp).not.toHaveBeenCalled();
    expect(remoteGateMocks.runIdentityUpgrade).toHaveBeenCalledWith(
      expect.objectContaining({ accessToken: 'access-token', subject: 'anon-user' }),
      expect.any(Function),
    );
    expect(spies.getSession).not.toHaveBeenCalled();
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

    const request = await requestEmailAccountCode(auth, explicitSession(auth), 'tas@example.com');

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

    await expect(
      requestEmailAccountCode(auth, explicitSession(auth), 'tas@example.com'),
    ).rejects.toThrow('already been registered');
    expect(spies.signInWithOtp).not.toHaveBeenCalled();
  });

  it('uses normal email OTP sign-in when there is no anonymous session', async () => {
    const { auth, spies } = makeAuth(null);
    spies.signInWithOtp.mockResolvedValue({ data: { messageId: 'message-id' }, error: null });

    const pending = await requestEmailAccountCode(auth, explicitSession(auth), 'tas@example.com');

    expect(spies.signInWithOtp).toHaveBeenCalledWith({
      email: 'tas@example.com',
      options: { shouldCreateUser: true },
    });
    expect(spies.updateUser).not.toHaveBeenCalled();
    expect(remoteGateMocks.runFresh).toHaveBeenCalledWith(expect.any(Function));
    expect(pending.kind).toBe('sign_in');
    if (pending.kind !== 'sign_in') throw new Error('Expected sign-in code request.');
    expect(pending.otpType).toBe('email');
  });

  it('resends a pending anonymous email change through the same-owner permit', async () => {
    const { auth, spies } = makeAuth(makeSession(makeUser('anon-user', true)));
    spies.resend.mockResolvedValue({ data: { user: null }, error: null });
    const pending: PendingEmailAccountCode = {
      email: 'tas@example.com',
      expectedUserId: 'anon-user',
      kind: 'anonymous_upgrade',
      otpType: 'email_change',
    };

    await resendEmailAccountCode(auth, explicitSession(auth), pending);

    expect(spies.resend).toHaveBeenCalledWith({ type: 'email_change', email: 'tas@example.com' });
    expect(remoteGateMocks.runIdentityUpgrade).toHaveBeenCalledWith(
      expect.objectContaining({ subject: 'anon-user' }),
      expect.any(Function),
    );
    expect(spies.signInWithOtp).not.toHaveBeenCalled();
    expect(spies.updateUser).not.toHaveBeenCalled();
  });

  it('refuses to resend after the anonymous owner changes', async () => {
    const { auth, spies } = makeAuth(makeSession(makeUser('different-user', true)));
    const pending: PendingEmailAccountCode = {
      email: 'tas@example.com',
      expectedUserId: 'anon-user',
      kind: 'anonymous_upgrade',
      otpType: 'email_change',
    };

    await expect(resendEmailAccountCode(auth, explicitSession(auth), pending)).rejects.toThrow(
      'no longer valid for the current session',
    );
    expect(spies.resend).not.toHaveBeenCalled();
    expect(spies.signInWithOtp).not.toHaveBeenCalled();
  });

  it('retains provider errors and never changes account lane after a rate-limited resend', async () => {
    const { auth, spies } = makeAuth(makeSession(makeUser('anon-user', true)));
    spies.resend.mockResolvedValue({ data: { user: null }, error: new Error('email rate limit') });
    const pending: PendingEmailAccountCode = {
      email: 'tas@example.com',
      expectedUserId: 'anon-user',
      kind: 'anonymous_upgrade',
      otpType: 'email_change',
    };

    await expect(resendEmailAccountCode(auth, explicitSession(auth), pending)).rejects.toThrow(
      'email rate limit',
    );
    expect(spies.signInWithOtp).not.toHaveBeenCalled();
  });

  it('resends a signed-out code only through the signed-out OTP lane', async () => {
    const { auth, spies } = makeAuth(null);
    spies.signInWithOtp.mockResolvedValue({ data: { messageId: 'resent' }, error: null });
    const pending: PendingEmailAccountCode = {
      email: 'tas@example.com',
      expectedUserId: null,
      kind: 'sign_in',
      otpType: 'email',
    };

    await resendEmailAccountCode(auth, explicitSession(auth), pending);

    expect(spies.signInWithOtp).toHaveBeenCalledWith({
      email: 'tas@example.com',
      options: { shouldCreateUser: true },
    });
    expect(spies.resend).not.toHaveBeenCalled();
  });

  it('does not resend a signed-out code after an account becomes active', async () => {
    const { auth, spies } = makeAuth(makeSession(makeUser('another-user', false)));
    const pending: PendingEmailAccountCode = {
      email: 'tas@example.com',
      expectedUserId: null,
      kind: 'sign_in',
      otpType: 'email',
    };

    await expect(resendEmailAccountCode(auth, explicitSession(auth), pending)).rejects.toThrow(
      'no longer valid for the current session',
    );
    expect(spies.signInWithOtp).not.toHaveBeenCalled();
    expect(spies.resend).not.toHaveBeenCalled();
  });

  it('does not dispatch an email-change resend when the owner permit is stale', async () => {
    const { auth, spies } = makeAuth(makeSession(makeUser('anon-user', true)));
    remoteGateMocks.requireBinding.mockImplementationOnce(() => {
      throw new Error('SUPABASE_REMOTE_REQUEST_BINDING_REJECTED');
    });
    const pending: PendingEmailAccountCode = {
      email: 'tas@example.com',
      expectedUserId: 'anon-user',
      kind: 'anonymous_upgrade',
      otpType: 'email_change',
    };

    await expect(resendEmailAccountCode(auth, explicitSession(auth), pending)).rejects.toThrow(
      'SUPABASE_REMOTE_REQUEST_BINDING_REJECTED',
    );
    expect(spies.resend).not.toHaveBeenCalled();
  });

  it('never treats a permanent active session as a signed-out OTP request lane', async () => {
    const { auth, spies } = makeAuth(makeSession(makeUser('current-user', false)));

    await expect(
      requestEmailAccountCode(auth, explicitSession(auth), 'tas@example.com'),
    ).rejects.toThrow('cannot replace an existing authenticated account');

    expect(remoteGateMocks.runFresh).not.toHaveBeenCalled();
    expect(spies.signInWithOtp).not.toHaveBeenCalled();
    expect(spies.updateUser).not.toHaveBeenCalled();
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

    await verifyEmailAccountCode(
      auth,
      explicitSession(auth),
      pending,
      'tas@example.com',
      ' 123456 ',
    );

    expect(spies.verifyOtp).toHaveBeenCalledWith({
      email: 'tas@example.com',
      token: '123456',
      type: 'email_change',
    });
    expect(remoteGateMocks.runIdentityUpgrade).toHaveBeenCalledWith(
      expect.objectContaining({ accessToken: 'access-token', subject: 'anon-user' }),
      expect.any(Function),
    );
    expect(spies.getSession).not.toHaveBeenCalled();
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
      verifyEmailAccountCode(auth, explicitSession(auth), pending, 'tas@example.com', '123456'),
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
      verifyEmailAccountCode(auth, explicitSession(auth), pending, 'tas@example.com', '123456'),
    ).rejects.toThrow('did not create a permanent identity');
  });

  it('uses the fresh-auth lane for a signed-out email-code verification', async () => {
    const permanentUser = makeUser('returning-user', false);
    const { auth, spies } = makeAuth(null);
    spies.verifyOtp.mockResolvedValue({
      data: { session: makeSession(permanentUser), user: permanentUser },
      error: null,
    });
    const pending: PendingEmailAccountCode = {
      email: 'tas@example.com',
      expectedUserId: null,
      kind: 'sign_in',
      otpType: 'email',
    };

    await verifyEmailAccountCode(auth, explicitSession(auth), pending, 'tas@example.com', '123456');

    expect(remoteGateMocks.runFresh).toHaveBeenCalledWith(expect.any(Function));
    expect(spies.verifyOtp).toHaveBeenCalledWith({
      email: 'tas@example.com',
      token: '123456',
      type: 'email',
    });
  });

  it('does not consume a signed-out code after another account becomes active', async () => {
    const { auth, spies } = makeAuth(makeSession(makeUser('foreign-user', false)));
    const pending: PendingEmailAccountCode = {
      email: 'tas@example.com',
      expectedUserId: null,
      kind: 'sign_in',
      otpType: 'email',
    };

    await expect(
      verifyEmailAccountCode(auth, explicitSession(auth), pending, 'tas@example.com', '123456'),
    ).rejects.toThrow('no longer valid for the current session');

    expect(remoteGateMocks.runFresh).not.toHaveBeenCalled();
    expect(spies.verifyOtp).not.toHaveBeenCalled();
  });

  it('does not dispatch a provider link after the exact-bound permit becomes stale', async () => {
    const { auth, spies } = makeAuth(makeSession(makeUser('anon-user', true)));
    remoteGateMocks.runIdentityUpgrade.mockRejectedValueOnce(
      new Error('SUPABASE_REMOTE_REQUEST_RESULT_STALE'),
    );

    await expect(
      authenticateWithProviderToken(auth, explicitSession(auth), {
        provider: 'google',
        token: 'id-token',
      }),
    ).rejects.toThrow('SUPABASE_REMOTE_REQUEST_RESULT_STALE');

    expect(spies.linkIdentity).not.toHaveBeenCalled();
    expect(spies.signInWithIdToken).not.toHaveBeenCalled();
  });

  it('does not dispatch an email update when the candidate owner binding is rejected', async () => {
    const { auth, spies } = makeAuth(makeSession(makeUser('anon-user', true)));
    remoteGateMocks.requireBinding.mockImplementationOnce(() => {
      throw new Error('SUPABASE_REMOTE_REQUEST_BINDING_REJECTED');
    });

    await expect(
      requestEmailAccountCode(auth, explicitSession(auth), 'tas@example.com'),
    ).rejects.toThrow('SUPABASE_REMOTE_REQUEST_BINDING_REJECTED');

    expect(spies.updateUser).not.toHaveBeenCalled();
    expect(spies.signInWithOtp).not.toHaveBeenCalled();
  });
});
