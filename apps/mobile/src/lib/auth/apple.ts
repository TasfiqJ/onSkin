import type { User } from '@supabase/supabase-js';
import * as AppleAuthentication from 'expo-apple-authentication';

function nonEmptyString(value: unknown): string | null {
  if (typeof value !== 'string') return null;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}

// Sign in with Apple. Mandatory on iOS once Google is offered (docs/01 §1,
// Apple Guideline 4.8). Returns the identity token for supabase signInWithIdToken.
// BLOCKED: B-APPLE. Needs the registered Service ID / capability to actually run.
export async function getAppleIdToken(): Promise<{ idToken: string; email: string | null } | null> {
  const credential = await AppleAuthentication.signInAsync({
    requestedScopes: [
      AppleAuthentication.AppleAuthenticationScope.FULL_NAME,
      AppleAuthentication.AppleAuthenticationScope.EMAIL,
    ],
  });
  const idToken = nonEmptyString(credential.identityToken);
  if (!idToken) return null;
  // NOTE: email is only returned on the FIRST authorization for a given Apple ID.
  return { idToken, email: nonEmptyString(credential.email) };
}

function getAppleSubject(user: User): string | null {
  const identity = user.identities?.find((item) => item.provider === 'apple');
  const data = identity?.identity_data as { sub?: unknown } | undefined;
  const subject = nonEmptyString(data?.sub);
  if (subject) return subject;
  const identityId = nonEmptyString(identity?.id);
  if (identityId) return identityId;
  return null;
}

export async function getAppleAuthorizationCodeForRevocation(user: User): Promise<string | null> {
  const appleUser = getAppleSubject(user);
  if (!appleUser) return null;
  if (!(await AppleAuthentication.isAvailableAsync())) return null;

  const credential = await AppleAuthentication.refreshAsync({ user: appleUser });
  return nonEmptyString(credential.authorizationCode);
}

export const isAppleAuthAvailable = AppleAuthentication.isAvailableAsync;
