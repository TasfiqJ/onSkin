import * as LocalAuthentication from 'expo-local-authentication';

export type AppLockAuthStatus = 'success' | 'not_authenticated' | 'unavailable';
export type AppLockAuthenticationToken = object;
export type AppLockAuthenticationRequestGuard = () => boolean;

export const APP_LOCK_FOREGROUND_RESULT_TIMEOUT_MS = 10_000;

export const PHOTO_TIMELINE_PROMPT = 'Unlock your photo timeline';

let lastGalleryFixture: string | undefined;
let galleryFixtureCalls = 0;
let authenticationInvalidationEpoch = 0;
let authenticationTail: Promise<void> = Promise.resolve();
type NativeAuthenticationAttempt = Readonly<{ token: AppLockAuthenticationToken }>;
let nativeAuthenticationAttempt: NativeAuthenticationAttempt | null = null;
let quarantinedNativeAuthenticationAttempt: NativeAuthenticationAttempt | null = null;
let appLockAuthenticationAppState = 'active';
let presentedAuthentication: Readonly<{
  token: AppLockAuthenticationToken;
  requestEpoch: number;
}> | null = null;
const activationWaiters = new Set<{
  requestEpoch: number;
  resolve: (active: boolean) => void;
}>();

function settleActivationWaiters(): void {
  for (const waiter of [...activationWaiters]) {
    const invalidated = waiter.requestEpoch !== authenticationInvalidationEpoch;
    if (!invalidated && appLockAuthenticationAppState !== 'active') continue;
    activationWaiters.delete(waiter);
    waiter.resolve(!invalidated);
  }
}

function waitForActiveAuthenticationResult(requestEpoch: number): Promise<boolean> {
  if (requestEpoch !== authenticationInvalidationEpoch) return Promise.resolve(false);
  if (appLockAuthenticationAppState === 'active') return Promise.resolve(true);

  return new Promise<boolean>((resolve) => {
    let timeout!: ReturnType<typeof setTimeout>;
    const waiter = {
      requestEpoch,
      resolve: (active: boolean) => {
        clearTimeout(timeout);
        resolve(active);
      },
    };
    timeout = setTimeout(() => {
      if (!activationWaiters.delete(waiter)) return;
      resolve(false);
    }, APP_LOCK_FOREGROUND_RESULT_TIMEOUT_MS);
    activationWaiters.add(waiter);
    settleActivationWaiters();
  });
}

/** Keep native success private until the provider confirms the app is active. */
export function updateAppLockAuthenticationAppState(appState: string): void {
  appLockAuthenticationAppState = appState;
  settleActivationWaiters();
}

/** The exact interaction whose native sheet is presented or awaiting foreground. */
export function getPresentedAppLockAuthenticationToken(): AppLockAuthenticationToken | null {
  return presentedAuthentication?.token ?? null;
}

async function runSerializedAuthentication<T>(operation: () => Promise<T>): Promise<T> {
  const previous = authenticationTail.catch(() => undefined);
  let release!: () => void;
  authenticationTail = new Promise<void>((resolve) => {
    release = resolve;
  });

  await previous;
  try {
    return await operation();
  } finally {
    release();
  }
}

/**
 * Invalidate the current or queued prompt. Android receives an explicit native
 * cancellation; every platform also discards a late result by epoch. The
 * A stale native promise may ignore cancellation indefinitely. Quarantine that
 * exact attempt so a new owner fails closed immediately instead of waiting in
 * the serialized queue or opening an overlapping native sheet. Only settlement
 * of the quarantined native promise clears the quarantine.
 */
export function invalidatePendingAppLockAuthentication(): void {
  authenticationInvalidationEpoch += 1;
  settleActivationWaiters();
  if (!nativeAuthenticationAttempt) return;
  quarantinedNativeAuthenticationAttempt = nativeAuthenticationAttempt;
  try {
    void LocalAuthentication.cancelAuthenticate().catch(() => undefined);
  } catch {
    // Quarantine is authoritative even if the native cancellation bridge throws.
  }
}

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

export async function authenticateAppLock(
  promptMessage: string,
  token: AppLockAuthenticationToken = Object.freeze({}),
  isRequestCurrent: AppLockAuthenticationRequestGuard = () => true,
): Promise<AppLockAuthStatus> {
  if (quarantinedNativeAuthenticationAttempt) return 'unavailable';
  const requestEpoch = authenticationInvalidationEpoch;
  return runSerializedAuthentication(async () => {
    if (quarantinedNativeAuthenticationAttempt) return 'unavailable';
    if (
      requestEpoch !== authenticationInvalidationEpoch ||
      appLockAuthenticationAppState !== 'active' ||
      !isRequestCurrent()
    ) {
      return 'not_authenticated';
    }

    const fixture = e2eAppLockAuthStatus(promptMessage);
    if (fixture) return fixture;

    const presentation = Object.freeze({ token, requestEpoch });
    const nativeAttempt = Object.freeze({ token });
    presentedAuthentication = presentation;
    let status: AppLockAuthStatus;
    try {
      nativeAuthenticationAttempt = nativeAttempt;
      try {
        const result = await LocalAuthentication.authenticateAsync({
          promptMessage,
          // Preserve phone PIN/passcode recovery if biometrics later become
          // unavailable. API 29 may briefly background for this OS-owned flow;
          // the provider preserves only this exact presented request once.
          disableDeviceFallback: false,
        });
        status = result.success ? 'success' : 'not_authenticated';
      } catch {
        status = 'unavailable';
      } finally {
        if (nativeAuthenticationAttempt === nativeAttempt) {
          nativeAuthenticationAttempt = null;
        }
        if (quarantinedNativeAuthenticationAttempt === nativeAttempt) {
          quarantinedNativeAuthenticationAttempt = null;
        }
      }
    } finally {
      if (presentedAuthentication === presentation) presentedAuthentication = null;
    }

    if (!(await waitForActiveAuthenticationResult(requestEpoch))) return 'not_authenticated';
    return requestEpoch === authenticationInvalidationEpoch && isRequestCurrent()
      ? status
      : 'not_authenticated';
  });
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
