import type { Session, SupabaseClient } from '@supabase/supabase-js';

import {
  requireSupabaseRemoteSessionBinding,
  runWithSupabaseFreshAuthPermit,
  runWithSupabaseIdentityUpgradePermit,
} from '@/lib/supabase/remoteRequestGate';

export type AccountProvider = 'apple' | 'google';

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
  'linkIdentity' | 'signInWithIdToken' | 'signInWithOtp' | 'updateUser' | 'verifyOtp'
>;

const IDENTITY_CHANGED_ERROR = 'Account upgrade could not preserve the current authenticated user.';
const UPGRADE_INCOMPLETE_ERROR = 'Account upgrade did not create a permanent identity.';
const STALE_EMAIL_CODE_ERROR = 'This email code is no longer valid for the current session.';
const ACTIVE_SESSION_SIGN_IN_ERROR =
  'Sign-in cannot replace an existing authenticated account. Sign out first.';

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

/**
 * Native provider tokens link to an active anonymous session. We deliberately
 * do not fall back to sign-in after a linking failure because that could switch
 * user IDs and orphan the local-first plan the user just created.
 */
export async function authenticateWithProviderToken(
  auth: AccountUpgradeAuthClient,
  currentSession: Session | null,
  credentials: { provider: AccountProvider; token: string },
): Promise<void> {
  const token = normalizeRequired(credentials.token, 'Provider token');
  const anonymousUserId = currentSession?.user.is_anonymous ? currentSession.user.id : null;

  if (anonymousUserId) {
    if (currentSession === null) throw new Error(IDENTITY_CHANGED_ERROR);
    const binding = requireSupabaseRemoteSessionBinding(
      currentSession.access_token,
      anonymousUserId,
    );
    const { data, error } = await runWithSupabaseIdentityUpgradePermit(binding, () =>
      auth.linkIdentity({
        provider: credentials.provider,
        token,
      }),
    );
    if (error) throw error;
    assertSameUser(anonymousUserId, data, true);
    return;
  }
  if (currentSession !== null) throw new Error(ACTIVE_SESSION_SIGN_IN_ERROR);

  const { error } = await runWithSupabaseFreshAuthPermit(() =>
    auth.signInWithIdToken({
      provider: credentials.provider,
      token,
    }),
  );
  if (error) throw error;
}

/**
 * Anonymous users attach email to their existing session and verify the email
 * change. Users without an anonymous session keep the normal OTP sign-in path.
 */
export async function requestEmailAccountCode(
  auth: AccountUpgradeAuthClient,
  currentSession: Session | null,
  emailInput: string,
): Promise<EmailAccountCodeRequest> {
  const email = normalizeRequired(emailInput, 'Email');
  const anonymousUserId = currentSession?.user.is_anonymous ? currentSession.user.id : null;

  if (anonymousUserId) {
    if (currentSession === null) throw new Error(IDENTITY_CHANGED_ERROR);
    const binding = requireSupabaseRemoteSessionBinding(
      currentSession.access_token,
      anonymousUserId,
    );
    const { data, error } = await runWithSupabaseIdentityUpgradePermit(binding, () =>
      auth.updateUser({ email }),
    );
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
  if (currentSession !== null) throw new Error(ACTIVE_SESSION_SIGN_IN_ERROR);

  const { error } = await runWithSupabaseFreshAuthPermit(() =>
    auth.signInWithOtp({
      email,
      options: { shouldCreateUser: true },
    }),
  );
  if (error) throw error;
  return { email, expectedUserId: null, kind: 'sign_in', otpType: 'email' };
}

export async function verifyEmailAccountCode(
  auth: AccountUpgradeAuthClient,
  currentSession: Session | null,
  pending: PendingEmailAccountCode,
  emailInput: string,
  tokenInput: string,
): Promise<void> {
  const email = normalizeRequired(emailInput, 'Email');
  const token = normalizeRequired(tokenInput, 'Email code');
  if (email !== pending.email) throw new Error(STALE_EMAIL_CODE_ERROR);

  if (pending.kind === 'anonymous_upgrade') {
    if (
      currentSession?.user.id !== pending.expectedUserId ||
      currentSession.user.is_anonymous !== true
    ) {
      throw new Error(STALE_EMAIL_CODE_ERROR);
    }
  } else if (currentSession !== null) {
    throw new Error(STALE_EMAIL_CODE_ERROR);
  }

  let verification: Awaited<ReturnType<AccountUpgradeAuthClient['verifyOtp']>>;
  if (pending.kind === 'anonymous_upgrade') {
    const binding = requireSupabaseRemoteSessionBinding(
      currentSession!.access_token,
      pending.expectedUserId,
    );
    verification = await runWithSupabaseIdentityUpgradePermit(binding, () =>
      auth.verifyOtp({ email, token, type: pending.otpType }),
    );
  } else {
    verification = await runWithSupabaseFreshAuthPermit(() =>
      auth.verifyOtp({ email, token, type: pending.otpType }),
    );
  }
  const { data, error } = verification;
  if (error) throw error;
  if (pending.kind === 'anonymous_upgrade') {
    assertSameUser(pending.expectedUserId, data, true);
  }
}
