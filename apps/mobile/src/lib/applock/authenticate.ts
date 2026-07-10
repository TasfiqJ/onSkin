import * as LocalAuthentication from 'expo-local-authentication';

export type AppLockAuthStatus = 'success' | 'not_authenticated' | 'unavailable';

export const PHOTO_TIMELINE_PROMPT = 'Unlock your photo timeline';

let lastGalleryFixture: string | undefined;
let galleryFixtureCalls = 0;

function e2eAppLockAuthStatus(promptMessage: string): AppLockAuthStatus | null {
  if (typeof __DEV__ === 'undefined' || !__DEV__) return null;

  const fixture = (
    promptMessage === PHOTO_TIMELINE_PROMPT
      ? process.env.EXPO_PUBLIC_E2E_APP_LOCK_GALLERY_AUTH ||
        process.env.EXPO_PUBLIC_E2E_APP_LOCK_AUTH
      : process.env.EXPO_PUBLIC_E2E_APP_LOCK_AUTH
  )
    ?.trim()
    .toLowerCase();
  if (promptMessage === PHOTO_TIMELINE_PROMPT && fixture !== lastGalleryFixture) {
    lastGalleryFixture = fixture;
    galleryFixtureCalls = 0;
  }
  if (promptMessage === PHOTO_TIMELINE_PROMPT && fixture === 'success_once') {
    const status = galleryFixtureCalls === 0 ? 'success' : 'not_authenticated';
    galleryFixtureCalls += 1;
    return status;
  }
  if (fixture === 'success' || fixture === 'not_authenticated' || fixture === 'unavailable') {
    return fixture;
  }

  return null;
}

function e2eAppLockReady(): boolean | null {
  if (typeof __DEV__ === 'undefined' || !__DEV__) return null;

  const fixture = process.env.EXPO_PUBLIC_E2E_APP_LOCK_READY?.trim().toLowerCase();
  if (fixture === '1' || fixture === 'true' || fixture === 'ready' || fixture === 'available') {
    return true;
  }
  if (fixture === '0' || fixture === 'false' || fixture === 'unavailable') {
    return false;
  }

  return null;
}

export async function authenticateAppLock(promptMessage: string): Promise<AppLockAuthStatus> {
  const fixture = e2eAppLockAuthStatus(promptMessage);
  if (fixture) return fixture;

  try {
    const result = await LocalAuthentication.authenticateAsync({ promptMessage });
    return result.success ? 'success' : 'not_authenticated';
  } catch {
    return 'unavailable';
  }
}

export async function canUseAppLock(): Promise<boolean> {
  const fixture = e2eAppLockReady();
  if (fixture !== null) return fixture;

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
