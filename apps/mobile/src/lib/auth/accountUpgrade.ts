import type { Session, SupabaseClient } from '@supabase/supabase-js';

export type AccountProvider = 'apple' | 'google';

export type AuthSessionFingerprint =
  | { status: 'signed_out' }
  | {
      status: 'signed_in';
      userId: string;
      identity: 'anonymous' | 'permanent';
    };

export type PendingEmailAccountCode =
  | {
      email: string;
      expectedUserId: string;
      kind: 'anonymous_upgrade';
      otpType: 'email_change';
    }
  | {
      email: string;
      expectedUserId: null;
      kind: 'sign_in';
      otpType: 'email';
    };

export type EmailAccountCodeRequest =
  | PendingEmailAccountCode
  | {
      email: string;
      expectedUserId: string;
      kind: 'anonymous_upgrade_complete';
    };

export type AccountUpgradeAuthClient = Pick<
  SupabaseClient['auth'],
  'getSession' | 'linkIdentity' | 'signInWithIdToken' | 'signInWithOtp' | 'updateUser' | 'verifyOtp'
>;

export type AuthStorageMutationRunner = <T>(operation: () => Promise<T>) => Promise<T>;

const IDENTITY_CHANGED_ERROR = 'Account upgrade could not preserve the current authenticated user.';
const UPGRADE_INCOMPLETE_ERROR = 'Account upgrade did not create a permanent identity.';
const STALE_EMAIL_CODE_ERROR = 'This email code is no longer valid for the current session.';
export const PROVIDER_AUTH_SESSION_CHANGED = 'PROVIDER_AUTH_SESSION_CHANGED';

export class ProviderAuthSessionChangedError extends Error {
  readonly code = PROVIDER_AUTH_SESSION_CHANGED;

  constructor() {
    super(PROVIDER_AUTH_SESSION_CHANGED);
    this.name = 'ProviderAuthSessionChangedError';
  }
}

export function authSessionFingerprint(session: Session | null): AuthSessionFingerprint {
  if (!session) return Object.freeze({ status: 'signed_out' });
  return Object.freeze({
    status: 'signed_in',
    userId: session.user.id,
    identity: session.user.is_anonymous === true ? 'anonymous' : 'permanent',
  });
}

export function authSessionFingerprintMatches(
  expected: AuthSessionFingerprint,
  actual: AuthSessionFingerprint,
): boolean {
  if (expected.status !== actual.status) return false;
  if (expected.status === 'signed_out' || actual.status === 'signed_out') return true;
  return expected.userId === actual.userId && expected.identity === actual.identity;
}

function normalizeRequired(value: string, label: string): string {
  const normalized = value.trim();
  if (!normalized) throw new Error(`${label} is required.`);
  return normalized;
}

function assertSameUser(
  expectedUserId: string,
  data: {
    session: { user: { id: string; is_anonymous?: boolean } } | null;
    user: { id: string; is_anonymous?: boolean } | null;
  },
  requirePermanentIdentity: boolean,
): void {
  const user = data.user ?? data.session?.user ?? null;
  if (
    !user ||
    user.id !== expectedUserId ||
    (data.session !== null && data.session.user.id !== expectedUserId)
  ) {
    throw new Error(IDENTITY_CHANGED_ERROR);
  }

  if (requirePermanentIdentity && user.is_anonymous !== false) {
    throw new Error(UPGRADE_INCOMPLETE_ERROR);
  }
}

async function getCurrentSession(auth: AccountUpgradeAuthClient) {
  const { data, error } = await auth.getSession();
  if (error) throw error;
  return data.session;
}

/**
 * Native provider tokens link to an active anonymous session. We deliberately
 * do not fall back to sign-in after a linking failure because that could switch
 * user IDs and orphan the local-first plan the user just created.
 */
export async function authenticateWithProviderToken(
  auth: AccountUpgradeAuthClient,
  credentials: { provider: AccountProvider; token: string },
  expectedSession: AuthSessionFingerprint,
  assertRequestCurrent: () => void,
  runAuthStorageMutation: AuthStorageMutationRunner,
): Promise<void> {
  const token = normalizeRequired(credentials.token, 'Provider token');
  assertRequestCurrent();
  const currentSession = await getCurrentSession(auth);
  assertRequestCurrent();
  if (!authSessionFingerprintMatches(expectedSession, authSessionFingerprint(currentSession))) {
    throw new ProviderAuthSessionChangedError();
  }
  const anonymousUserId =
    expectedSession.status === 'signed_in' && expectedSession.identity === 'anonymous'
      ? expectedSession.userId
      : null;

  if (anonymousUserId) {
    await runAuthStorageMutation(async () => {
      // The manual auth-storage lock has drained earlier refresh/session work.
      // Keep the final assertion and SDK call in one turn while that exact lock
      // excludes newer capture/save work for the full native mutation.
      assertRequestCurrent();
      const link = auth.linkIdentity({
        provider: credentials.provider,
        token,
      });
      const { data, error } = await link;
      if (error) throw error;
      assertSameUser(anonymousUserId, data, true);
    });
    return;
  }

  await runAuthStorageMutation(async () => {
    assertRequestCurrent();
    const signIn = auth.signInWithIdToken({
      provider: credentials.provider,
      token,
    });
    const { error } = await signIn;
    if (error) throw error;
  });
}

/**
 * Anonymous users attach email to their existing session and verify the email
 * change. Users without an anonymous session keep the normal OTP sign-in path.
 */
export async function requestEmailAccountCode(
  auth: AccountUpgradeAuthClient,
  emailInput: string,
): Promise<EmailAccountCodeRequest> {
  const email = normalizeRequired(emailInput, 'Email');
  const currentSession = await getCurrentSession(auth);
  const anonymousUserId = currentSession?.user.is_anonymous ? currentSession.user.id : null;

  if (anonymousUserId) {
    const { data, error } = await auth.updateUser({ email });
    if (error) throw error;
    assertSameUser(anonymousUserId, { session: currentSession, user: data.user }, false);
    if (data.user?.is_anonymous === false) {
      return {
        email,
        expectedUserId: anonymousUserId,
        kind: 'anonymous_upgrade_complete',
      };
    }
    return {
      email,
      expectedUserId: anonymousUserId,
      kind: 'anonymous_upgrade',
      otpType: 'email_change',
    };
  }

  const { error } = await auth.signInWithOtp({
    email,
    options: { shouldCreateUser: true },
  });
  if (error) throw error;
  return { email, expectedUserId: null, kind: 'sign_in', otpType: 'email' };
}

export async function verifyEmailAccountCode(
  auth: AccountUpgradeAuthClient,
  pending: PendingEmailAccountCode,
  emailInput: string,
  tokenInput: string,
): Promise<void> {
  const email = normalizeRequired(emailInput, 'Email');
  const token = normalizeRequired(tokenInput, 'Email code');
  if (email !== pending.email) throw new Error(STALE_EMAIL_CODE_ERROR);

  if (pending.kind === 'anonymous_upgrade') {
    const currentSession = await getCurrentSession(auth);
    if (
      currentSession?.user.id !== pending.expectedUserId ||
      currentSession.user.is_anonymous !== true
    ) {
      throw new Error(STALE_EMAIL_CODE_ERROR);
    }
  }

  const { data, error } = await auth.verifyOtp({ email, token, type: pending.otpType });
  if (error) throw error;
  if (pending.kind === 'anonymous_upgrade') {
    assertSameUser(pending.expectedUserId, data, true);
  }
}
