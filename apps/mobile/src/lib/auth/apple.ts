import * as AppleAuthentication from 'expo-apple-authentication';

// Sign in with Apple — mandatory on iOS once Google is offered (docs/01 §1,
// Apple Guideline 4.8). Returns the identity token for supabase signInWithIdToken.
// BLOCKED: B-APPLE — needs the registered Service ID / capability to actually run.
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

export const isAppleAuthAvailable = AppleAuthentication.isAvailableAsync;
