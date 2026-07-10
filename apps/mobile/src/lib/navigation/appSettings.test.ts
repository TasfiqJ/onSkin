import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { openAppSettings } from './appSettings';

const SRC_DIR = fileURLToPath(new URL('../../', import.meta.url));

function readSource(path: string): string {
  return readFileSync(`${SRC_DIR}/${path}`, 'utf8');
}

const mocks = vi.hoisted(() => ({
  openSettings: vi.fn(),
}));

vi.mock('react-native', () => ({
  Linking: {
    openSettings: mocks.openSettings,
  },
}));

describe('app settings opener', () => {
  beforeEach(() => {
    mocks.openSettings.mockReset();
    delete process.env.EXPO_PUBLIC_E2E_APP_SETTINGS_FAILURE;
  });

  it('opens the native settings surface', async () => {
    mocks.openSettings.mockResolvedValueOnce(undefined);

    await expect(openAppSettings()).resolves.toBe(true);

    expect(mocks.openSettings).toHaveBeenCalledTimes(1);
  });

  it('returns false when native settings cannot be opened', async () => {
    mocks.openSettings.mockRejectedValueOnce(new Error('settings unavailable'));

    await expect(openAppSettings()).resolves.toBe(false);
  });

  it('accepts route-specific options while leaving recovery UI to the route', async () => {
    mocks.openSettings.mockRejectedValueOnce(new Error('settings unavailable'));

    await expect(
      openAppSettings({
        failureTitle: 'Camera settings unavailable',
        failureMessage: 'Open Settings manually to enable camera access.',
      }),
    ).resolves.toBe(false);
  });

  it('supports the dev-only settings failure fixture for route-owned recovery', async () => {
    const globalWithDev = globalThis as typeof globalThis & { __DEV__?: boolean };
    const previousDev = globalWithDev.__DEV__;
    globalWithDev.__DEV__ = true;
    process.env.EXPO_PUBLIC_E2E_APP_SETTINGS_FAILURE = '1';

    try {
      await expect(
        openAppSettings({
          failureTitle: 'Camera settings unavailable',
          failureMessage: 'Open Settings manually to enable camera access.',
          alertOnFailure: false,
        }),
      ).resolves.toBe(false);
    } finally {
      if (previousDev === undefined) {
        delete globalWithDev.__DEV__;
      } else {
        globalWithDev.__DEV__ = previousDev;
      }
      delete process.env.EXPO_PUBLIC_E2E_APP_SETTINGS_FAILURE;
    }

    expect(mocks.openSettings).not.toHaveBeenCalled();
  });

  it('keeps the settings helper UI-free so routes own recovery feedback', () => {
    const source = readSource('lib/navigation/appSettings.ts');

    expect(source).toContain('EXPO_PUBLIC_E2E_APP_SETTINGS_FAILURE');
    expect(source).not.toContain('Alert.alert');
    expect(source).not.toContain('import { Alert');
  });
});
