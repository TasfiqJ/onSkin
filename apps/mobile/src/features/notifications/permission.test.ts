import { beforeEach, describe, expect, it, vi } from 'vitest';

import {
  classifyNotificationPermission,
  getNotificationPermissionSnapshot,
  notificationPermissionRecoveryAction,
  requestNotificationPermissionSnapshot,
} from './permission';

const mocks = vi.hoisted(() => ({
  getPermissionsAsync: vi.fn(),
  requestPermissionsAsync: vi.fn(),
}));

vi.mock('expo-notifications', () => ({
  getPermissionsAsync: mocks.getPermissionsAsync,
  requestPermissionsAsync: mocks.requestPermissionsAsync,
}));

vi.mock('react-native', () => ({
  Platform: { OS: 'ios' },
}));

const base = {
  expires: 'never',
  canAskAgain: true,
};

describe('notification permission snapshots', () => {
  beforeEach(() => {
    mocks.getPermissionsAsync.mockReset();
    mocks.requestPermissionsAsync.mockReset();
  });

  it.each([
    [{ ...base, status: 'granted', granted: true }, 'granted'],
    [{ ...base, status: 'denied', granted: false }, 'denied'],
    [{ ...base, status: 'undetermined', granted: false }, 'undetermined'],
    [
      {
        ...base,
        status: 'undetermined',
        granted: false,
        ios: { status: 2 },
      },
      'granted',
    ],
    [
      {
        ...base,
        status: 'undetermined',
        granted: false,
        ios: { status: 3 },
      },
      'granted',
    ],
    [
      {
        ...base,
        status: 'undetermined',
        granted: false,
        ios: { status: 4 },
      },
      'granted',
    ],
    [
      {
        ...base,
        status: 'granted',
        granted: true,
        ios: { status: 1 },
      },
      'denied',
    ],
  ])('classifies complete Expo responses %#', (response, status) => {
    expect(classifyNotificationPermission(response)).toEqual({
      status,
      canAskAgain: true,
    });
  });

  it.each([
    null,
    {},
    { status: 'granted', granted: true },
    { ...base, ios: { status: 2 } },
    { ...base, status: 'granted', granted: false },
    { ...base, status: 'denied', granted: true },
    { ...base, status: 'denied', granted: true, ios: { status: 2 } },
    { ...base, status: 'granted', granted: true, ios: { status: 99 } },
    { ...base, status: 'granted', granted: true, ios: {} },
  ])('fails closed for a malformed response %#', (response) => {
    expect(classifyNotificationPermission(response)).toEqual({
      status: 'unavailable',
      canAskAgain: null,
      reason: 'invalid_response',
    });
  });

  it('preserves canAskAgain without inferring it from status', () => {
    expect(
      classifyNotificationPermission({
        ...base,
        status: 'denied',
        granted: false,
        canAskAgain: false,
      }),
    ).toEqual({ status: 'denied', canAskAgain: false });
    expect(
      classifyNotificationPermission({
        ...base,
        status: 'undetermined',
        granted: false,
        canAskAgain: false,
      }),
    ).toEqual({ status: 'undetermined', canAskAgain: false });
  });

  it.each([
    [undefined, null],
    [{ status: 'granted', canAskAgain: true }, null],
    [{ status: 'undetermined', canAskAgain: true }, 'request'],
    [{ status: 'denied', canAskAgain: true }, 'request'],
    [{ status: 'denied', canAskAgain: false }, 'open_settings'],
    [
      { status: 'unavailable', canAskAgain: null, reason: 'bridge_failure' },
      'retry',
    ],
  ] as const)('resolves the recovery action for permission state %#', (snapshot, action) => {
    expect(notificationPermissionRecoveryAction(snapshot)).toBe(action);
  });

  it.each(['read', 'request'] as const)(
    'returns a content-free unavailable snapshot when the %s bridge rejects',
    async (operation) => {
      const rawMessage = 'provider secret notification failure';
      const target =
        operation === 'read' ? mocks.getPermissionsAsync : mocks.requestPermissionsAsync;
      target.mockRejectedValueOnce(new Error(rawMessage));

      const result =
        operation === 'read'
          ? await getNotificationPermissionSnapshot()
          : await requestNotificationPermissionSnapshot();

      expect(result).toEqual({
        status: 'unavailable',
        canAskAgain: null,
        reason: 'bridge_failure',
      });
      expect(JSON.stringify(result)).not.toContain(rawMessage);
    },
  );
});
