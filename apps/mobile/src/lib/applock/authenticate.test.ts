import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { PHOTO_COPY } from '@/features/photos/copy';
import { BRAND } from '@/lib/brand';

import {
  APP_LOCK_FOREGROUND_RESULT_TIMEOUT_MS,
  authenticateAppLock,
  canUseAppLock,
  getPresentedAppLockAuthenticationToken,
  invalidatePendingAppLockAuthentication,
  updateAppLockAuthenticationAppState,
} from './authenticate';

const SRC_DIR = fileURLToPath(new URL('../../', import.meta.url));
const runtime = globalThis as typeof globalThis & { __DEV__?: boolean };
const originalDev = runtime.__DEV__;

function readSource(path: string): string {
  return readFileSync(`${SRC_DIR}/${path}`, 'utf8');
}

const mocks = vi.hoisted(() => ({
  authenticateAsync: vi.fn(),
  cancelAuthenticate: vi.fn(),
  hasHardwareAsync: vi.fn(),
  isEnrolledAsync: vi.fn(),
}));

vi.mock('expo-local-authentication', () => ({
  authenticateAsync: mocks.authenticateAsync,
  cancelAuthenticate: mocks.cancelAuthenticate,
  hasHardwareAsync: mocks.hasHardwareAsync,
  isEnrolledAsync: mocks.isEnrolledAsync,
}));

describe('app lock local authentication', () => {
  beforeEach(() => {
    mocks.authenticateAsync.mockReset();
    mocks.cancelAuthenticate.mockReset();
    mocks.cancelAuthenticate.mockResolvedValue(undefined);
    mocks.hasHardwareAsync.mockReset();
    mocks.isEnrolledAsync.mockReset();
    updateAppLockAuthenticationAppState('active');
    if (originalDev === undefined) delete runtime.__DEV__;
    else runtime.__DEV__ = originalDev;
    delete process.env.EXPO_PUBLIC_E2E_APP_LOCK_AUTH;
    delete process.env.EXPO_PUBLIC_E2E_APP_LOCK_GALLERY_AUTH;
    delete process.env.EXPO_PUBLIC_E2E_APP_LOCK_READY;
  });

  afterEach(() => {
    vi.useRealTimers();
    updateAppLockAuthenticationAppState('active');
    if (originalDev === undefined) delete runtime.__DEV__;
    else runtime.__DEV__ = originalDev;
    delete process.env.EXPO_PUBLIC_E2E_APP_LOCK_AUTH;
    delete process.env.EXPO_PUBLIC_E2E_APP_LOCK_GALLERY_AUTH;
    delete process.env.EXPO_PUBLIC_E2E_APP_LOCK_READY;
  });

  it('returns success when the native prompt authenticates', async () => {
    mocks.authenticateAsync.mockResolvedValueOnce({ success: true });

    await expect(authenticateAppLock(BRAND.appLockPrompt)).resolves.toBe('success');

    expect(mocks.authenticateAsync).toHaveBeenCalledWith({
      promptMessage: BRAND.appLockPrompt,
      disableDeviceFallback: false,
    });
  });

  it('keeps cancellations quiet as not authenticated', async () => {
    mocks.authenticateAsync.mockResolvedValueOnce({ success: false, error: 'user_cancel' });

    await expect(authenticateAppLock(BRAND.appLockPrompt)).resolves.toBe('not_authenticated');
  });

  it('maps native prompt rejection to unavailable', async () => {
    mocks.authenticateAsync.mockRejectedValueOnce(new Error('native prompt unavailable'));

    await expect(authenticateAppLock(BRAND.appLockPrompt)).resolves.toBe('unavailable');
  });

  it('invalidates a late native success and requests best-effort cancellation', async () => {
    let resolveAuthentication!: (result: { success: boolean }) => void;
    mocks.authenticateAsync.mockReturnValueOnce(
      new Promise((resolve) => {
        resolveAuthentication = resolve;
      }),
    );

    const pending = authenticateAppLock(BRAND.appLockPrompt);
    await vi.waitFor(() => expect(mocks.authenticateAsync).toHaveBeenCalledOnce());
    invalidatePendingAppLockAuthentication();
    expect(mocks.cancelAuthenticate).toHaveBeenCalledOnce();

    resolveAuthentication({ success: true });
    await expect(pending).resolves.toBe('not_authenticated');
  });

  it('holds a prompt-owned native success through inactive until the app is active', async () => {
    const token = Object.freeze({ flow: 'inactive' });
    let resolveAuthentication!: (result: { success: boolean }) => void;
    mocks.authenticateAsync.mockReturnValueOnce(
      new Promise((resolve) => {
        resolveAuthentication = resolve;
      }),
    );

    let settled = false;
    const pending = authenticateAppLock(BRAND.appLockPrompt, token).then((status) => {
      settled = true;
      return status;
    });
    await vi.waitFor(() => expect(mocks.authenticateAsync).toHaveBeenCalledOnce());
    expect(getPresentedAppLockAuthenticationToken()).toBe(token);

    updateAppLockAuthenticationAppState('inactive');
    resolveAuthentication({ success: true });
    await Promise.resolve();
    await Promise.resolve();
    expect(settled).toBe(false);
    expect(getPresentedAppLockAuthenticationToken()).toBeNull();
    expect(mocks.cancelAuthenticate).not.toHaveBeenCalled();

    updateAppLockAuthenticationAppState('active');
    await expect(pending).resolves.toBe('success');
    expect(getPresentedAppLockAuthenticationToken()).toBeNull();
  });

  it('bounds a native result that never receives a foreground transition', async () => {
    vi.useFakeTimers();
    let resolveAuthentication!: (result: { success: boolean }) => void;
    mocks.authenticateAsync.mockReturnValueOnce(
      new Promise((resolve) => {
        resolveAuthentication = resolve;
      }),
    );

    const pending = authenticateAppLock(BRAND.appLockPrompt);
    await vi.advanceTimersByTimeAsync(0);
    expect(mocks.authenticateAsync).toHaveBeenCalledOnce();
    updateAppLockAuthenticationAppState('inactive');
    resolveAuthentication({ success: true });
    await vi.advanceTimersByTimeAsync(0);

    await vi.advanceTimersByTimeAsync(APP_LOCK_FOREGROUND_RESULT_TIMEOUT_MS);
    await expect(pending).resolves.toBe('not_authenticated');
    expect(getPresentedAppLockAuthenticationToken()).toBeNull();
  });

  it.each(['resolve', 'reject'] as const)(
    'quarantines an invalidated native prompt through its late %s, then permits recovery',
    async (lateOutcome) => {
      let resolveOwnerA!: (result: { success: boolean }) => void;
      let rejectOwnerA!: (error: Error) => void;
      const ownerAToken = Object.freeze({ owner: 'A' });
      mocks.authenticateAsync
        .mockReturnValueOnce(
          new Promise((resolve, reject) => {
            resolveOwnerA = resolve;
            rejectOwnerA = reject;
          }),
        )
        .mockResolvedValueOnce({ success: true });

      const ownerA = authenticateAppLock('Owner A', ownerAToken);
      await vi.waitFor(() => expect(mocks.authenticateAsync).toHaveBeenCalledOnce());
      expect(getPresentedAppLockAuthenticationToken()).toBe(ownerAToken);
      invalidatePendingAppLockAuthentication();

      await expect(authenticateAppLock('Owner B')).resolves.toBe('unavailable');
      expect(mocks.authenticateAsync).toHaveBeenCalledTimes(1);
      expect(getPresentedAppLockAuthenticationToken()).toBe(ownerAToken);

      if (lateOutcome === 'resolve') resolveOwnerA({ success: true });
      else rejectOwnerA(new Error('stale native rejection'));
      await expect(ownerA).resolves.toBe('not_authenticated');
      expect(getPresentedAppLockAuthenticationToken()).toBeNull();

      await expect(authenticateAppLock('Owner C')).resolves.toBe('success');
      expect(mocks.authenticateAsync).toHaveBeenCalledTimes(2);
      expect(mocks.authenticateAsync).toHaveBeenLastCalledWith({
        promptMessage: 'Owner C',
        disableDeviceFallback: false,
      });
    },
  );

  it('keeps quarantine when explicit native cancellation rejects', async () => {
    let resolveOwnerA!: (result: { success: boolean }) => void;
    mocks.authenticateAsync
      .mockReturnValueOnce(
        new Promise((resolve) => {
          resolveOwnerA = resolve;
        }),
      )
      .mockResolvedValueOnce({ success: true });
    mocks.cancelAuthenticate.mockRejectedValueOnce(new Error('native cancellation unavailable'));

    const ownerA = authenticateAppLock('Owner A');
    await vi.waitFor(() => expect(mocks.authenticateAsync).toHaveBeenCalledOnce());
    invalidatePendingAppLockAuthentication();
    await Promise.resolve();

    await expect(authenticateAppLock('Owner B')).resolves.toBe('unavailable');
    expect(mocks.cancelAuthenticate).toHaveBeenCalledOnce();
    expect(mocks.authenticateAsync).toHaveBeenCalledOnce();

    resolveOwnerA({ success: false });
    await expect(ownerA).resolves.toBe('not_authenticated');
    await expect(authenticateAppLock('Owner C')).resolves.toBe('success');
    expect(mocks.authenticateAsync).toHaveBeenCalledTimes(2);
  });

  it('still serializes same-owner prompts without opening overlapping native sheets', async () => {
    let resolveFirst!: (result: { success: boolean }) => void;
    let resolveSecond!: (result: { success: boolean }) => void;
    mocks.authenticateAsync
      .mockReturnValueOnce(
        new Promise((resolve) => {
          resolveFirst = resolve;
        }),
      )
      .mockReturnValueOnce(
        new Promise((resolve) => {
          resolveSecond = resolve;
        }),
      );

    const first = authenticateAppLock('Same owner first');
    await vi.waitFor(() => expect(mocks.authenticateAsync).toHaveBeenCalledOnce());
    const second = authenticateAppLock('Same owner second');
    await Promise.resolve();
    expect(mocks.authenticateAsync).toHaveBeenCalledOnce();

    resolveFirst({ success: true });
    await expect(first).resolves.toBe('success');
    await vi.waitFor(() => expect(mocks.authenticateAsync).toHaveBeenCalledTimes(2));

    resolveSecond({ success: true });
    await expect(second).resolves.toBe('success');
  });

  it('does not present a queued request whose interaction became stale', async () => {
    let resolveFirst!: (result: { success: boolean }) => void;
    mocks.authenticateAsync.mockReturnValueOnce(
      new Promise((resolve) => {
        resolveFirst = resolve;
      }),
    );
    let current = true;

    const first = authenticateAppLock('Owner A');
    await vi.waitFor(() => expect(mocks.authenticateAsync).toHaveBeenCalledOnce());
    const queued = authenticateAppLock('Stale queued owner', Object.freeze({}), () => current);
    current = false;

    resolveFirst({ success: true });
    await expect(first).resolves.toBe('success');
    await expect(queued).resolves.toBe('not_authenticated');
    expect(mocks.authenticateAsync).toHaveBeenCalledOnce();
  });

  it('discards native success when the request guard changes before publication', async () => {
    let resolveAuthentication!: (result: { success: boolean }) => void;
    mocks.authenticateAsync.mockReturnValueOnce(
      new Promise((resolve) => {
        resolveAuthentication = resolve;
      }),
    );
    let current = true;

    const pending = authenticateAppLock('Guarded owner', Object.freeze({}), () => current);
    await vi.waitFor(() => expect(mocks.authenticateAsync).toHaveBeenCalledOnce());
    current = false;
    resolveAuthentication({ success: true });

    await expect(pending).resolves.toBe('not_authenticated');
  });

  it('uses dev-only E2E auth and readiness fixtures without opening native auth', async () => {
    runtime.__DEV__ = true;
    process.env.EXPO_PUBLIC_E2E_APP_LOCK_AUTH = 'unavailable';
    process.env.EXPO_PUBLIC_E2E_APP_LOCK_READY = 'available';

    await expect(authenticateAppLock(BRAND.appLockPrompt)).resolves.toBe('unavailable');
    await expect(canUseAppLock()).resolves.toBe(true);

    expect(mocks.authenticateAsync).not.toHaveBeenCalled();
    expect(mocks.hasHardwareAsync).not.toHaveBeenCalled();
    expect(mocks.isEnrolledAsync).not.toHaveBeenCalled();
  });

  it('can keep the gallery locked after the dev-only global lock succeeds', async () => {
    runtime.__DEV__ = true;
    process.env.EXPO_PUBLIC_E2E_APP_LOCK_AUTH = 'success';
    process.env.EXPO_PUBLIC_E2E_APP_LOCK_GALLERY_AUTH = 'not_authenticated';

    await expect(authenticateAppLock(BRAND.appLockPrompt)).resolves.toBe('success');
    await expect(authenticateAppLock('Unlock your photo timeline')).resolves.toBe(
      'not_authenticated',
    );

    expect(mocks.authenticateAsync).not.toHaveBeenCalled();
  });

  it('supports a dev-only one-session gallery unlock followed by relock', async () => {
    runtime.__DEV__ = true;
    process.env.EXPO_PUBLIC_E2E_APP_LOCK_GALLERY_AUTH = 'success_once';

    await expect(authenticateAppLock('Unlock your photo timeline')).resolves.toBe('success');
    await expect(authenticateAppLock('Unlock your photo timeline')).resolves.toBe(
      'not_authenticated',
    );

    expect(mocks.authenticateAsync).not.toHaveBeenCalled();
  });

  it('ignores E2E app-lock fixtures outside dev builds', async () => {
    runtime.__DEV__ = false;
    process.env.EXPO_PUBLIC_E2E_APP_LOCK_AUTH = 'unavailable';
    process.env.EXPO_PUBLIC_E2E_APP_LOCK_GALLERY_AUTH = 'unavailable';
    process.env.EXPO_PUBLIC_E2E_APP_LOCK_READY = 'unavailable';
    mocks.authenticateAsync.mockResolvedValueOnce({ success: true });
    mocks.hasHardwareAsync.mockResolvedValueOnce(true);
    mocks.isEnrolledAsync.mockResolvedValueOnce(true);

    await expect(authenticateAppLock(BRAND.appLockPrompt)).resolves.toBe('success');
    await expect(canUseAppLock()).resolves.toBe(true);
  });

  it('checks hardware and enrollment without leaking native failures', async () => {
    mocks.hasHardwareAsync.mockResolvedValueOnce(true);
    mocks.isEnrolledAsync.mockResolvedValueOnce(true);
    await expect(canUseAppLock()).resolves.toBe(true);

    mocks.hasHardwareAsync.mockResolvedValueOnce(true);
    mocks.isEnrolledAsync.mockResolvedValueOnce(false);
    await expect(canUseAppLock()).resolves.toBe(false);

    mocks.hasHardwareAsync.mockRejectedValueOnce(new Error('native hardware check failed'));
    mocks.isEnrolledAsync.mockResolvedValueOnce(true);
    await expect(canUseAppLock()).resolves.toBe(false);
  });

  it('keeps lock overlays on the failure-handled helper', () => {
    const provider = readSource('lib/applock/AppLockProvider.tsx');
    const accountOperations = readSource('lib/applock/accountOperations.ts');
    const preferenceDecision = readSource('lib/applock/preferenceDecision.ts');
    const timelineGate = readSource('features/photos/PhotoTimelineLockGate.tsx');
    const youTab = readSource('app/(tabs)/you.tsx');

    expect(provider).toContain('attemptAppUnlockForCurrentAccount({');
    expect(provider).toContain('readAppLockPreferenceForCurrentAccount((result) =>');
    expect(provider).toContain('setAppLockPreferenceForCurrentAccount({');
    expect(provider).toContain('runSingleFlight(appUnlockLease.current');
    expect(provider).toContain('runSingleFlight(photoTimelineUnlockLease.current');
    expect(provider).toContain(
      'const [lockFeedback, setLockFeedback] = useState<string | null>(null);',
    );
    expect(provider).toContain('setLockFeedback(appLockUserMessage());');
    expect(provider).toContain(
      "preferenceRecovery === 'retry' ? retryPreferenceRead : authenticate",
    );
    expect(provider).toContain("'Unlock and reset app lock'");
    expect(provider).toContain('APP_LOCK_READ_COPY.retry');
    expect(provider).toContain('preferenceRecovery === null');
    expect(provider).toContain('interactionLifecycle.current.preservedLease === null');
    expect(provider).toContain('interactionLifecycle.current.preservedLease === interaction');
    expect(provider).toContain('promptMessage: PHOTO_TIMELINE_PROMPT');
    expect(provider).toContain('setPhotoTimelineUnlocked(false);');
    expect(provider).toContain('setLocked(true);');
    expect(provider).toContain('invalidatePendingAppLockAuthentication();');
    expect(provider).toContain('getPresentedAppLockAuthenticationToken()');
    expect(provider).toContain('transitionAppLockInteractionLifecycle(');
    expect(provider).toContain('updateAppLockAuthenticationAppState(s);');
    expect(provider).toContain('isAppLockInteractionLeaseCurrent(');
    expect(provider).toContain('authenticationToken: interaction');
    expect(provider).toContain('isInteractionCurrent: requestIsCurrent');
    expect(provider).toContain('preferenceReadInFlight.current = true;');
    expect(provider).toContain('setPreferenceRetrying(true);');
    expect(provider).toContain('enabledRef.current || settingMutationInFlight.current');
    expect(provider).toContain('const decision = decideAppLockPreference(result);');
    expect(provider).toContain('{loaded ? children : null}');
    expect(provider).toContain('showPrivacyShield || !loaded');
    expect(provider).toContain('accessibilityRole="alert"');
    expect(provider).toContain('accessibilityViewIsModal');
    expect(provider).toContain(
      "importantForAccessibility={hideAppContent ? 'no-hide-descendants' : 'auto'}",
    );
    expect(provider).toContain("pointerEvents: hideAppContent ? 'none' : 'auto'");
    expect(provider).not.toContain("Alert.alert('App lock'");
    expect(provider).not.toContain('LocalAuthentication.authenticateAsync');
    expect(provider).not.toContain('authenticateAppLock(');

    expect(accountOperations).toContain('runAccountGenerationOperation(async (lease) =>');
    expect(accountOperations).toContain('awaitAccountGenerationLease(lease');
    expect(accountOperations).toContain('clearMalformedAppLockPreference');
    expect(accountOperations).toContain('setAppLockEnabledStored(input.enabled)');
    expect(accountOperations).toContain('invalidatePendingAppLockAuthentication');

    expect(preferenceDecision).toContain('enabled: true');
    expect(preferenceDecision).toContain(
      "recovery: isRepairableAppLockPreferenceResult(result) ? 'repair' : 'retry'",
    );

    expect(timelineGate).toContain('unlockPhotoTimeline()');
    expect(timelineGate).toContain('locked && appUnlocked');
    expect(timelineGate).toContain('setLockFeedback(appLockUserMessage());');
    expect(timelineGate).toContain('accessibilityRole="alert"');
    expect(timelineGate).not.toContain("Alert.alert('Photo timeline locked'");
    expect(timelineGate).not.toContain('LocalAuthentication.authenticateAsync');

    expect(youTab).toContain('const YouSecuritySection = memo(');
    expect(youTab).toContain('const setAppLockChoice = useCallback(');
    expect(youTab).toContain('if (savingAppLockRef.current) return;');
    expect(youTab).toContain('recordYouAppLockStart();');
    expect(youTab).toContain('setAppLockFeedback(appLockUserMessage());');
    expect(youTab).not.toContain("Alert.alert('App lock'");

    const securityOwner = youTab.slice(
      youTab.indexOf('const YouSecuritySection = memo('),
      youTab.indexOf('const YouStaticUtilitySections = memo('),
    );
    expect(securityOwner.indexOf('if (savingAppLockRef.current) return;')).toBeLessThan(
      securityOwner.indexOf('savingAppLockRef.current = true;'),
    );
    expect(securityOwner.indexOf('savingAppLockRef.current = true;')).toBeLessThan(
      securityOwner.indexOf('recordYouAppLockStart();'),
    );
    expect(securityOwner.indexOf('recordYouAppLockStart();')).toBeLessThan(
      securityOwner.indexOf('await setLockEnabled(enabled);'),
    );
    expect(securityOwner.indexOf('await waitForDuplicateActivationFrame();')).toBeLessThan(
      securityOwner.indexOf('savingAppLockRef.current = false;'),
    );
  });

  it('keeps app-lock copy neutral across iOS and Android devices', () => {
    const youTab = readSource('app/(tabs)/you.tsx');
    const lockCopy = [PHOTO_COPY.lock.body, PHOTO_COPY.lock.unlock].join(' ');

    expect(lockCopy).toContain("phone's unlock");
    expect(lockCopy).not.toMatch(/\b(Face ID|Touch ID|iPhone|fingerprint)\b/i);
    expect(youTab).toContain('App lock');
    expect(youTab).toContain("phone's unlock");
    expect(youTab).not.toContain('Face ID app lock');
  });
});
