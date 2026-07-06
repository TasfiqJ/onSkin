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
});
