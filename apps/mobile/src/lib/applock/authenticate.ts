import * as LocalAuthentication from 'expo-local-authentication';

export type AppLockAuthStatus = 'success' | 'not_authenticated' | 'unavailable';

export async function authenticateAppLock(promptMessage: string): Promise<AppLockAuthStatus> {
  try {
    const result = await LocalAuthentication.authenticateAsync({ promptMessage });
    return result.success ? 'success' : 'not_authenticated';
  } catch {
    return 'unavailable';
  }
}

export async function canUseAppLock(): Promise<boolean> {
  try {
    const [hasHardware, isEnrolled] = await Promise.all([
      LocalAuthentication.hasHardwareAsync(),
      LocalAuthentication.isEnrolledAsync(),
    ]);
    return hasHardware && isEnrolled;
  } catch {
    return false;
  }
}
