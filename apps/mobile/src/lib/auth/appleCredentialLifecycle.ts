import type { User } from '@supabase/supabase-js';
import * as AppleAuthentication from 'expo-apple-authentication';
import { AppState, Platform, type AppStateStatus } from 'react-native';

type RemovableSubscription = { remove: () => void };

export type AppleCredentialInvalidReason =
  | 'apple_subject_unavailable'
  | 'credential_not_found'
  | 'credential_revoked'
  | 'persisted_revocation'
  | 'revoked_notification';

export type AppleCredentialCheckBlockedReason =
  | 'credential_check_failed'
  | 'credential_state_unknown';

export type AppleCredentialCheckResult =
  | { status: 'blocked'; reason: AppleCredentialCheckBlockedReason }
  | { status: 'invalid'; reason: AppleCredentialInvalidReason }
  | { status: 'not_applicable' }
  | { status: 'valid' };

export type AppleCredentialLifecycleCallbacks = {
  onCredentialCheckBlocked: (reason: AppleCredentialCheckBlockedReason) => void | Promise<void>;
  onCredentialInvalid: (reason: AppleCredentialInvalidReason) => void | Promise<void>;
};

export type AppleCredentialLifecycleDependencies = {
  addAppStateListener: (listener: (state: AppStateStatus) => void) => RemovableSubscription;
  addRevokeListener: (listener: () => void) => RemovableSubscription;
  getCredentialState: (
    user: string,
  ) => Promise<AppleAuthentication.AppleAuthenticationCredentialState>;
  platformOS: string;
};

export type AppleCredentialCheckDependencies = Pick<
  AppleCredentialLifecycleDependencies,
  'getCredentialState' | 'platformOS'
>;

const defaultDependencies: AppleCredentialLifecycleDependencies = {
  addAppStateListener: (listener) => AppState.addEventListener('change', listener),
  addRevokeListener: AppleAuthentication.addRevokeListener,
  getCredentialState: AppleAuthentication.getCredentialStateAsync,
  platformOS: Platform.OS,
};

function nonEmptyString(value: unknown): string | null {
  if (typeof value !== 'string') return null;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}

function appMetadataIncludesApple(user: User): boolean {
  const provider = nonEmptyString(user.app_metadata?.provider);
  if (provider === 'apple') return true;
  const providers = user.app_metadata?.providers;
  return Array.isArray(providers) && providers.some((item) => item === 'apple');
}

export function hasAppleIdentity(user: User): boolean {
  return (
    appMetadataIncludesApple(user) ||
    user.identities?.some((identity) => identity.provider === 'apple') === true
  );
}

/**
 * Return the exact opaque Apple user identifier only when every Apple identity
 * on the authenticated Supabase user resolves to the same non-empty subject.
 */
export function getAppleCredentialSubject(user: User): string | null {
  const appleIdentities =
    user.identities?.filter((identity) => identity.provider === 'apple') ?? [];
  if (appleIdentities.length === 0) return null;

  const subjects = new Set<string>();
  for (const identity of appleIdentities) {
    const data = identity.identity_data as { sub?: unknown } | undefined;
    const subject = nonEmptyString(data?.sub) ?? nonEmptyString(identity.id);
    if (!subject) return null;
    subjects.add(subject);
  }
  return subjects.size === 1 ? [...subjects][0]! : null;
}

export function appleCredentialResultForState(
  state: AppleAuthentication.AppleAuthenticationCredentialState,
): AppleCredentialCheckResult {
  switch (state) {
    case AppleAuthentication.AppleAuthenticationCredentialState.AUTHORIZED:
    case AppleAuthentication.AppleAuthenticationCredentialState.TRANSFERRED:
      return { status: 'valid' };
    case AppleAuthentication.AppleAuthenticationCredentialState.REVOKED:
      return { status: 'invalid', reason: 'credential_revoked' };
    case AppleAuthentication.AppleAuthenticationCredentialState.NOT_FOUND:
      return { status: 'invalid', reason: 'credential_not_found' };
    default:
      return { status: 'blocked', reason: 'credential_state_unknown' };
  }
}

/**
 * Validate an authenticated Apple identity without mutating auth or app state.
 * Callers decide how to gate/retry blocked checks and how to invalidate a
 * confirmed revoked credential.
 */
export async function checkAppleCredentialForSession(
  user: User,
  dependencies: AppleCredentialCheckDependencies = defaultDependencies,
): Promise<AppleCredentialCheckResult> {
  if (dependencies.platformOS !== 'ios' || !hasAppleIdentity(user)) {
    return { status: 'not_applicable' };
  }

  const subject = getAppleCredentialSubject(user);
  if (!subject) return { status: 'invalid', reason: 'apple_subject_unavailable' };

  try {
    return appleCredentialResultForState(await dependencies.getCredentialState(subject));
  } catch {
    // Expo documents that this always fails on the iOS simulator. The caller
    // must keep account data gated and offer retry; an error is not proof of
    // revocation and must not be mislabeled as one.
    return { status: 'blocked', reason: 'credential_check_failed' };
  }
}

/**
 * Install only Apple's native revoke notification. AuthProvider owns startup
 * and foreground credential-state checks in its single publication state
 * machine so an independent AppState listener cannot race commerce admission.
 */
export function monitorAppleCredentialRevocation(
  user: User,
  callbacks: AppleCredentialLifecycleCallbacks,
  dependencies: AppleCredentialLifecycleDependencies = defaultDependencies,
): () => void {
  if (dependencies.platformOS !== 'ios' || !hasAppleIdentity(user)) return () => {};

  let stopped = false;
  let terminal = false;
  const invoke = (operation: () => void | Promise<void>) => {
    void Promise.resolve()
      .then(operation)
      .catch(() => {
        // AuthProvider retains the fail-closed recovery state.
      });
  };
  const invalidate = (reason: AppleCredentialInvalidReason) => {
    if (stopped || terminal) return;
    terminal = true;
    invoke(() => callbacks.onCredentialInvalid(reason));
  };
  const block = (reason: AppleCredentialCheckBlockedReason) => {
    if (stopped || terminal) return;
    terminal = true;
    invoke(() => callbacks.onCredentialCheckBlocked(reason));
  };

  let subscription: RemovableSubscription | null = null;
  try {
    subscription = dependencies.addRevokeListener(() => invalidate('revoked_notification'));
  } catch {
    block('credential_check_failed');
  }

  return () => {
    stopped = true;
    subscription?.remove();
  };
}

/**
 * Observe native Apple credential revocations and re-check at startup/foreground.
 * Expo documents both APIs as iOS/tvOS-only, so this deliberately does nothing
 * off iOS. A blocked check is terminal for this subscription because the caller
 * immediately gates and unmounts the authenticated tree before retrying.
 */
export function monitorAppleCredentialLifecycle(
  user: User,
  callbacks: AppleCredentialLifecycleCallbacks,
  dependencies: AppleCredentialLifecycleDependencies = defaultDependencies,
): () => void {
  if (dependencies.platformOS !== 'ios' || !hasAppleIdentity(user)) return () => {};

  let stopped = false;
  let terminal = false;
  let checkInFlight: Promise<void> | null = null;

  const invoke = (operation: () => void | Promise<void>) => {
    void Promise.resolve()
      .then(operation)
      .catch(() => {
        // AuthProvider owns the durable retry gate. Callback failures must not
        // escape an event emitter or reopen the authenticated tree.
      });
  };

  const invalidate = (reason: AppleCredentialInvalidReason) => {
    if (stopped || terminal) return;
    terminal = true;
    invoke(() => callbacks.onCredentialInvalid(reason));
  };

  const block = (reason: AppleCredentialCheckBlockedReason) => {
    if (stopped || terminal) return;
    terminal = true;
    invoke(() => callbacks.onCredentialCheckBlocked(reason));
  };

  const checkCredential = () => {
    if (stopped || terminal || checkInFlight) return checkInFlight;
    const check = checkAppleCredentialForSession(user, dependencies)
      .then((result) => {
        if (result.status === 'invalid') invalidate(result.reason);
        else if (result.status === 'blocked') block(result.reason);
      })
      .finally(() => {
        if (checkInFlight === check) checkInFlight = null;
      });
    checkInFlight = check;
    return check;
  };

  let revokeSubscription: RemovableSubscription | null = null;
  try {
    revokeSubscription = dependencies.addRevokeListener(() => {
      invalidate('revoked_notification');
    });
  } catch {
    block('credential_check_failed');
  }

  let appStateSubscription: RemovableSubscription | null = null;
  try {
    appStateSubscription = dependencies.addAppStateListener((state) => {
      if (state === 'active') void checkCredential();
    });
  } catch {
    block('credential_check_failed');
  }

  void checkCredential();

  return () => {
    stopped = true;
    revokeSubscription?.remove();
    appStateSubscription?.remove();
  };
}
