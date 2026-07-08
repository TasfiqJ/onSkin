import { beforeEach, describe, expect, it, vi } from 'vitest';

import { openAppSettings } from './appSettings';

const mocks = vi.hoisted(() => ({
  alerts: [] as unknown[][],
  openSettings: vi.fn(),
}));

vi.mock('react-native', () => ({
  Alert: {
    alert: (...args: unknown[]) => {
      mocks.alerts.push(args);
    },
  },
  Linking: {
    openSettings: mocks.openSettings,
  },
}));

describe('app settings opener', () => {
  beforeEach(() => {
    mocks.alerts = [];
    mocks.openSettings.mockReset();
    delete process.env.EXPO_PUBLIC_E2E_APP_SETTINGS_FAILURE;
  });

  it('opens the native settings surface', async () => {
    mocks.openSettings.mockResolvedValueOnce(undefined);

    await expect(openAppSettings()).resolves.toBe(true);

    expect(mocks.openSettings).toHaveBeenCalledTimes(1);
    expect(mocks.alerts).toEqual([]);
  });

  it('alerts when native settings cannot be opened', async () => {
    mocks.openSettings.mockRejectedValueOnce(new Error('settings unavailable'));

    await expect(openAppSettings()).resolves.toBe(false);

    expect(mocks.alerts[0]).toEqual([
      'Settings unavailable',
      "We couldn't open Settings. You can still use another path in the app.",
    ]);
  });

  it('supports route-specific failure copy', async () => {
    mocks.openSettings.mockRejectedValueOnce(new Error('settings unavailable'));

    await expect(
      openAppSettings({
        failureTitle: 'Camera settings unavailable',
        failureMessage: 'Open Settings manually to enable camera access.',
      }),
    ).resolves.toBe(false);

    expect(mocks.alerts[0]).toEqual([
      'Camera settings unavailable',
      'Open Settings manually to enable camera access.',
    ]);
  });

  it('can return failure without a native alert for route-owned recovery', async () => {
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
    expect(mocks.alerts).toEqual([]);
  });
});
