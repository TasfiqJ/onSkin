import type { Session, SupabaseClient } from '@supabase/supabase-js';

import {
  requireSupabaseRemoteSessionBinding,
  runWithSupabaseAppleAuthBootstrapPermit,
  runWithSupabaseFreshAuthPermit,
  runWithSupabaseIdentityUpgradePermit,
} from '@/lib/supabase/remoteRequestGate';

import type { AppleSignInCredential } from './apple';
import { captureAppleAuthLifecycle } from './appleAuthLifecycleClient';

export type AccountProviderCredential = { provider: 'google'; token: string };

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
const INVALID_APPLE_CREDENTIAL_ERROR = 'Sign in with Apple returned an invalid credential.';

function normalizeRequired(value: string, label: string): string {
  const normalized = value.trim();
  if (!normalized) throw new Error(`${label} is required.`);
  return normalized;
}

function normalizeAppleValue(value: string, maximum: number): string {
  const normalized = value.trim();
  if (
    normalized.length === 0 ||
    normalized.length > maximum ||
    /[\u0000-\u001f\u007f]/u.test(normalized)
  ) {
    throw new Error(INVALID_APPLE_CREDENTIAL_ERROR);
  }
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
  credentials: AccountProviderCredential,
): Promise<void> {
  const token = normalizeRequired(credentials.token, 'Provider token');
  const linkProviderIdentity = () => auth.linkIdentity({ provider: 'google', token });
  const signInWithProvider = () => auth.signInWithIdToken({ provider: 'google', token });
  const anonymousUserId = currentSession?.user.is_anonymous ? currentSession.user.id : null;

  if (anonymousUserId) {
    if (currentSession === null) throw new Error(IDENTITY_CHANGED_ERROR);
    const binding = requireSupabaseRemoteSessionBinding(
      currentSession.access_token,
      anonymousUserId,
    );
    const { data, error } = await runWithSupabaseIdentityUpgradePermit(binding, () =>
      linkProviderIdentity(),
    );
    if (error) throw error;
    assertSameUser(anonymousUserId, data, true);
    return;
  }
  if (currentSession !== null) throw new Error(ACTIVE_SESSION_SIGN_IN_ERROR);

  const { error } = await runWithSupabaseFreshAuthPermit(() => signInWithProvider());
  if (error) throw error;
}

/**
 * Apple is deliberately separate from generic provider auth: its one-use
 * authorization code must reach the sealed server vault before the deferred
 * Supabase session is eligible for publication.
 */
export async function authenticateWithAppleCredential(
  auth: AccountUpgradeAuthClient,
  currentSession: Session | null,
  credential: AppleSignInCredential,
): Promise<void> {
  const capture = Object.freeze({
    appleUser: normalizeAppleValue(credential.appleUser, 512),
    authorizationCode: normalizeAppleValue(credential.authorizationCode, 4_096),
    identityToken: normalizeAppleValue(credential.idToken, 16_384),
    nonce: normalizeAppleValue(credential.nonce, 43),
  });
  if (!/^[A-Za-z0-9_-]{43}$/u.test(capture.nonce)) {
    throw new Error(INVALID_APPLE_CREDENTIAL_ERROR);
  }

  const anonymousUserId = currentSession?.user.is_anonymous ? currentSession.user.id : null;
  if (currentSession !== null && anonymousUserId === null) {
    throw new Error(ACTIVE_SESSION_SIGN_IN_ERROR);
  }
  const previousBinding = anonymousUserId
    ? requireSupabaseRemoteSessionBinding(currentSession!.access_token, anonymousUserId)
    : undefined;

  await runWithSupabaseAppleAuthBootstrapPermit(capture, previousBinding, async () => {
    const authentication = anonymousUserId
      ? await auth.linkIdentity({
          nonce: capture.nonce,
          provider: 'apple',
          token: capture.identityToken,
        })
      : await auth.signInWithIdToken({
          nonce: capture.nonce,
          provider: 'apple',
          token: capture.identityToken,
        });
    if (authentication.error) throw authentication.error;

    if (anonymousUserId) {
      assertSameUser(anonymousUserId, authentication.data, true);
    } else {
      const authenticatedUser = authentication.data.user ?? authentication.data.session?.user;
      if (
        !authentication.data.session ||
        !authenticatedUser ||
        authentication.data.session.user.id !== authenticatedUser.id ||
        authenticatedUser.is_anonymous !== false
      ) {
        throw new Error(UPGRADE_INCOMPLETE_ERROR);
      }
    }

    const captureSession = authentication.data.session ?? currentSession;
    if (
      captureSession === null ||
      (anonymousUserId !== null && captureSession.user.id !== anonymousUserId)
    ) {
      throw new Error(IDENTITY_CHANGED_ERROR);
    }
    await captureAppleAuthLifecycle(captureSession.access_token, capture);
  });
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
