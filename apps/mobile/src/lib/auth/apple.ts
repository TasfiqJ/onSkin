import type { User } from '@supabase/supabase-js';
import * as AppleAuthentication from 'expo-apple-authentication';

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
  if (!credential.identityToken) return null;
  // NOTE: email is only returned on the FIRST authorization for a given Apple ID.
  return { idToken: credential.identityToken, email: credential.email };
}

function getAppleSubject(user: User): string | null {
  const identity = user.identities?.find((item) => item.provider === 'apple');
  const data = identity?.identity_data as { sub?: unknown } | undefined;
  if (typeof data?.sub === 'string' && data.sub.length > 0) return data.sub;
  if (typeof identity?.id === 'string' && identity.id.length > 0) return identity.id;
  return null;
}

export async function getAppleAuthorizationCodeForRevocation(user: User): Promise<string | null> {
  const appleUser = getAppleSubject(user);
  if (!appleUser) return null;
  if (!(await AppleAuthentication.isAvailableAsync())) return null;

  const credential = await AppleAuthentication.refreshAsync({ user: appleUser });
  return credential.authorizationCode ?? null;
}

export const isAppleAuthAvailable = AppleAuthentication.isAvailableAsync;
