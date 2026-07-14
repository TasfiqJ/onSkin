import type { User } from '@supabase/supabase-js';
import * as AppleAuthentication from 'expo-apple-authentication';

import { getAppleCredentialSubject } from './appleCredentialLifecycle';

function nonEmptyString(value: unknown): string | null {
  if (typeof value !== 'string') return null;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}

// Sign in with Apple. Mandatory on iOS once Google is offered (docs/01 §1,
// Apple Guideline 4.8). Returns the identity token for Supabase sign-in or
// same-user identity linking.
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

export async function getAppleAuthorizationCodeForRevocation(user: User): Promise<string | null> {
  const appleUser = getAppleCredentialSubject(user);
  if (!appleUser) return null;
  if (!(await AppleAuthentication.isAvailableAsync())) return null;

  const credential = await AppleAuthentication.refreshAsync({ user: appleUser });
  return nonEmptyString(credential.authorizationCode);
}

export const isAppleAuthAvailable = AppleAuthentication.isAvailableAsync;
