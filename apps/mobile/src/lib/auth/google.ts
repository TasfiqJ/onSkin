import { GoogleSignin } from '@react-native-google-signin/google-signin';

import { env } from '../env';

let configured = false;

// BLOCKED: B-GOOGLE. IosClientId + webClientId from env. The webClientId is the
// serverClientId used by Android's Credential Manager. Misconfigured SHA-1 /
// client-id is the notorious Android DEVELOPER_ERROR (docs/01 §1).
export function configureGoogleSignIn(): void {
  if (configured) return;
  GoogleSignin.configure({
    iosClientId: env.googleIosClientId || undefined,
    webClientId: env.googleWebClientId || undefined,
  });
  configured = true;
}

// v16 returns { type: 'success', data: User } | { type: 'cancelled' }.
export async function getGoogleIdToken(
  assertRequestCurrent: () => void = () => {},
): Promise<{ idToken: string; email: string } | null> {
  configureGoogleSignIn();
  await GoogleSignin.hasPlayServices({ showPlayServicesUpdateDialog: true });
  assertRequestCurrent();
  const response = await GoogleSignin.signIn();
  assertRequestCurrent();
  if (response.type !== 'success') return null; // cancelled
  const { idToken, user } = response.data;
  if (!idToken) return null;
  return { idToken, email: user.email };
}
