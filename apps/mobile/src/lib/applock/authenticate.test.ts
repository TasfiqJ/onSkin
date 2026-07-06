import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { PHOTO_COPY } from '@/features/photos/copy';

import { authenticateAppLock, canUseAppLock } from './authenticate';

const SRC_DIR = fileURLToPath(new URL('../../', import.meta.url));

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
  });

  it('returns success when the native prompt authenticates', async () => {
    mocks.authenticateAsync.mockResolvedValueOnce({ success: true });

    await expect(authenticateAppLock('Unlock OnSkin')).resolves.toBe('success');

    expect(mocks.authenticateAsync).toHaveBeenCalledWith({ promptMessage: 'Unlock OnSkin' });
  });

  it('keeps cancellations quiet as not authenticated', async () => {
    mocks.authenticateAsync.mockResolvedValueOnce({ success: false, error: 'user_cancel' });

    await expect(authenticateAppLock('Unlock OnSkin')).resolves.toBe('not_authenticated');
  });

  it('maps native prompt rejection to unavailable', async () => {
    mocks.authenticateAsync.mockRejectedValueOnce(new Error('native prompt unavailable'));

    await expect(authenticateAppLock('Unlock OnSkin')).resolves.toBe('unavailable');
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
    const progress = readSource('app/(tabs)/progress.tsx');

    expect(provider).toContain("authenticateAppLock('Unlock OnSkin')");
    expect(provider).toContain("Alert.alert('App lock', appLockUserMessage())");
    expect(provider).not.toContain('LocalAuthentication.authenticateAsync');

    expect(progress).toContain("authenticateAppLock('Unlock your photo timeline')");
    expect(progress).toContain("Alert.alert('Photo timeline locked', appLockUserMessage())");
    expect(progress).not.toContain('LocalAuthentication.authenticateAsync');
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
