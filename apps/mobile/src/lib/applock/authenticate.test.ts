import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { PHOTO_COPY } from '@/features/photos/copy';
import { BRAND } from '@/lib/brand';

import { authenticateAppLock, canUseAppLock } from './authenticate';

const SRC_DIR = fileURLToPath(new URL('../../', import.meta.url));
const runtime = globalThis as typeof globalThis & { __DEV__?: boolean };
const originalDev = runtime.__DEV__;

function readSource(path: string): string {
  return readFileSync(`${SRC_DIR}/${path}`, 'utf8');
}

const mocks = vi.hoisted(() => ({
  authenticateAsync: vi.fn(),
  hasHardwareAsync: vi.fn(),
  isEnrolledAsync: vi.fn(),
}));

vi.mock('expo-local-authentication', () => ({
  authenticateAsync: mocks.authenticateAsync,
  hasHardwareAsync: mocks.hasHardwareAsync,
  isEnrolledAsync: mocks.isEnrolledAsync,
}));

describe('app lock local authentication', () => {
  beforeEach(() => {
    mocks.authenticateAsync.mockReset();
    mocks.hasHardwareAsync.mockReset();
    mocks.isEnrolledAsync.mockReset();
    if (originalDev === undefined) delete runtime.__DEV__;
    else runtime.__DEV__ = originalDev;
    delete process.env.EXPO_PUBLIC_E2E_APP_LOCK_AUTH;
    delete process.env.EXPO_PUBLIC_E2E_APP_LOCK_GALLERY_AUTH;
    delete process.env.EXPO_PUBLIC_E2E_APP_LOCK_READY;
  });

  afterEach(() => {
    if (originalDev === undefined) delete runtime.__DEV__;
    else runtime.__DEV__ = originalDev;
    delete process.env.EXPO_PUBLIC_E2E_APP_LOCK_AUTH;
    delete process.env.EXPO_PUBLIC_E2E_APP_LOCK_GALLERY_AUTH;
    delete process.env.EXPO_PUBLIC_E2E_APP_LOCK_READY;
  });

  it('returns success when the native prompt authenticates', async () => {
    mocks.authenticateAsync.mockResolvedValueOnce({ success: true });

    await expect(authenticateAppLock(BRAND.appLockPrompt)).resolves.toBe('success');

    expect(mocks.authenticateAsync).toHaveBeenCalledWith({ promptMessage: BRAND.appLockPrompt });
  });

  it('keeps cancellations quiet as not authenticated', async () => {
    mocks.authenticateAsync.mockResolvedValueOnce({ success: false, error: 'user_cancel' });

    await expect(authenticateAppLock(BRAND.appLockPrompt)).resolves.toBe('not_authenticated');
  });

  it('maps native prompt rejection to unavailable', async () => {
    mocks.authenticateAsync.mockRejectedValueOnce(new Error('native prompt unavailable'));

    await expect(authenticateAppLock(BRAND.appLockPrompt)).resolves.toBe('unavailable');
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
    const timelineGate = readSource('features/photos/PhotoTimelineLockGate.tsx');
    const youTab = readSource('app/(tabs)/you.tsx');

    expect(provider).toContain('authenticateAppLock(BRAND.appLockPrompt)');
    expect(provider).toContain('runSingleFlight(appUnlockLease.current');
    expect(provider).toContain('runSingleFlight(photoTimelineUnlockLease.current');
    expect(provider).toContain(
      'const [lockFeedback, setLockFeedback] = useState<string | null>(null);',
    );
    expect(provider).toContain('setLockFeedback(appLockUserMessage());');
    expect(provider).toContain('repairRequired={preferenceRepairRequired}');
    expect(provider).toContain("'Unlock and reset app lock'");
    expect(provider).toContain('await clearMalformedAppLockPreference();');
    expect(provider).toContain('!preferenceRepairRequired) void requestUnlock();');
    expect(provider).toContain('authenticateAppLock(PHOTO_TIMELINE_PROMPT)');
    expect(provider).toContain('setPhotoTimelineUnlocked(false);');
    expect(provider).toContain('setEnabledState(true);');
    expect(provider).toContain('setLocked(true);');
    expect(provider).toContain('{loaded ? children : null}');
    expect(provider).toContain('showPrivacyShield || !loaded');
    expect(provider).toContain('accessibilityRole="alert"');
    expect(provider).not.toContain("Alert.alert('App lock'");
    expect(provider).not.toContain('LocalAuthentication.authenticateAsync');

    expect(timelineGate).toContain('unlockPhotoTimeline()');
    expect(timelineGate).toContain('locked && appUnlocked');
    expect(timelineGate).toContain('setLockFeedback(appLockUserMessage());');
    expect(timelineGate).toContain('kind="error"');
    expect(timelineGate).toContain('title="Unlock unavailable"');
    expect(timelineGate).not.toContain("Alert.alert('Photo timeline locked'");
    expect(timelineGate).not.toContain('LocalAuthentication.authenticateAsync');

    expect(youTab).toContain('async function setAppLockChoice(enabled: boolean)');
    expect(youTab).toContain("key: 'app_lock'");
    expect(youTab).toContain("renderPrivacyFeedback('app_lock', 'security')");
    expect(youTab).not.toContain("Alert.alert('App lock'");
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
