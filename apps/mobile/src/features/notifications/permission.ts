import * as Notifications from 'expo-notifications';
import { Platform } from 'react-native';

export type NotificationPermissionStatus =
  | 'granted'
  | 'denied'
  | 'undetermined'
  | 'unavailable';

export type NotificationPermissionSnapshot =
  | Readonly<{
      status: Exclude<NotificationPermissionStatus, 'unavailable'>;
      canAskAgain: boolean;
    }>
  | Readonly<{
      status: 'unavailable';
      canAskAgain: null;
      reason: 'bridge_failure' | 'invalid_response';
    }>;

export type NotificationPermissionRecoveryAction = 'request' | 'open_settings' | 'retry' | null;

export function notificationPermissionRecoveryAction(
  snapshot: NotificationPermissionSnapshot | undefined,
): NotificationPermissionRecoveryAction {
  if (!snapshot || snapshot.status === 'granted') return null;
  if (snapshot.status === 'unavailable') return 'retry';
  return snapshot.canAskAgain ? 'request' : 'open_settings';
}

export class NotificationPermissionUnavailableError extends Error {
  readonly code = 'NOTIFICATION_PERMISSION_UNAVAILABLE';

  constructor(readonly reason: 'bridge_failure' | 'invalid_response') {
    super('Notification permission status is unavailable.');
    this.name = 'NotificationPermissionUnavailableError';
  }
}

export class NotificationPermissionRequestUnavailableError extends Error {
  readonly code = 'NOTIFICATION_PERMISSION_REQUEST_UNAVAILABLE';

  constructor(readonly reason: 'bridge_failure' | 'invalid_response' | 'unresolved') {
    super('Notification permission request is unavailable.');
    this.name = 'NotificationPermissionRequestUnavailableError';
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

/**
 * Classify the complete Expo permission response. On iOS, authorization status
 * is authoritative because provisional and ephemeral access can deliver even
 * when the cross-platform `granted` flag is false.
 */
export function classifyNotificationPermission(value: unknown): NotificationPermissionSnapshot {
  if (
    !isRecord(value) ||
    typeof value.canAskAgain !== 'boolean' ||
    typeof value.granted !== 'boolean' ||
    (value.status !== 'granted' &&
      value.status !== 'denied' &&
      value.status !== 'undetermined') ||
    (value.status === 'granted' && value.granted !== true) ||
    (value.status !== 'granted' && value.granted !== false)
  ) {
    return { status: 'unavailable', canAskAgain: null, reason: 'invalid_response' };
  }

  if (Object.prototype.hasOwnProperty.call(value, 'ios')) {
    if (!isRecord(value.ios) || typeof value.ios.status !== 'number') {
      return { status: 'unavailable', canAskAgain: null, reason: 'invalid_response' };
    }
    switch (value.ios.status) {
      case 0:
        return { status: 'undetermined', canAskAgain: value.canAskAgain };
      case 1:
        return { status: 'denied', canAskAgain: value.canAskAgain };
      case 2:
      case 3:
      case 4:
        return { status: 'granted', canAskAgain: value.canAskAgain };
      default:
        return { status: 'unavailable', canAskAgain: null, reason: 'invalid_response' };
    }
  }

  if (value.status === 'granted' && value.granted === true) {
    return { status: 'granted', canAskAgain: value.canAskAgain };
  }
  if (value.status === 'denied' && value.granted === false) {
    return { status: 'denied', canAskAgain: value.canAskAgain };
  }
  if (value.status === 'undetermined' && value.granted === false) {
    return { status: 'undetermined', canAskAgain: value.canAskAgain };
  }
  return { status: 'unavailable', canAskAgain: null, reason: 'invalid_response' };
}

type DevelopmentPermissionFixture =
  | 'granted'
  | 'undetermined'
  | 'denied_retry'
  | 'denied_no_retry'
  | 'unavailable'
  | 'undetermined_then_granted'
  | 'unavailable_once_then_denied_no_retry';

let fixtureSignature: string | null = null;
let fixtureReads = 0;
let fixtureRequested = false;

function persistDevelopmentFixtureState(): void {
  if (!fixtureSignature || typeof globalThis.sessionStorage === 'undefined') return;
  try {
    globalThis.sessionStorage.setItem(
      `onskin-e2e-notification-permission:${fixtureSignature}`,
      JSON.stringify({ reads: fixtureReads, requested: fixtureRequested }),
    );
  } catch {
    // Deterministic fixtures remain usable when browser storage is unavailable.
  }
}

function developmentFixture(): DevelopmentPermissionFixture | null {
  if (typeof __DEV__ === 'undefined' || !__DEV__ || Platform.OS !== 'web') return null;
  const value = process.env.EXPO_PUBLIC_E2E_NOTIFICATION_PERMISSION?.trim().toLowerCase();
  if (
    value !== 'granted' &&
    value !== 'undetermined' &&
    value !== 'denied_retry' &&
    value !== 'denied_no_retry' &&
    value !== 'unavailable' &&
    value !== 'undetermined_then_granted' &&
    value !== 'unavailable_once_then_denied_no_retry'
  ) {
    fixtureSignature = null;
    fixtureReads = 0;
    fixtureRequested = false;
    return null;
  }
  if (value !== fixtureSignature) {
    fixtureSignature = value;
    fixtureReads = 0;
    fixtureRequested = false;
    try {
      const stored = globalThis.sessionStorage?.getItem(
        `onskin-e2e-notification-permission:${value}`,
      );
      if (stored) {
        const parsed = JSON.parse(stored) as { reads?: unknown; requested?: unknown };
        if (typeof parsed.reads === 'number' && Number.isSafeInteger(parsed.reads)) {
          fixtureReads = Math.max(0, parsed.reads);
        }
        if (typeof parsed.requested === 'boolean') fixtureRequested = parsed.requested;
      }
    } catch {
      fixtureReads = 0;
      fixtureRequested = false;
    }
  }
  return value;
}

function fixtureSnapshot(
  fixture: DevelopmentPermissionFixture,
  operation: 'read' | 'request',
): NotificationPermissionSnapshot {
  if (operation === 'request') {
    fixtureRequested = true;
    persistDevelopmentFixtureState();
  }
  if (fixture === 'granted' || (fixture === 'undetermined_then_granted' && fixtureRequested)) {
    return { status: 'granted', canAskAgain: true };
  }
  if (fixture === 'denied_retry') return { status: 'denied', canAskAgain: true };
  if (
    fixture === 'denied_no_retry' ||
    (fixture === 'unavailable_once_then_denied_no_retry' && fixtureReads > 0)
  ) {
    return { status: 'denied', canAskAgain: false };
  }
  if (fixture === 'unavailable' || fixture === 'unavailable_once_then_denied_no_retry') {
    fixtureReads += 1;
    persistDevelopmentFixtureState();
    return { status: 'unavailable', canAskAgain: null, reason: 'bridge_failure' };
  }
  return { status: 'undetermined', canAskAgain: true };
}

export async function getNotificationPermissionSnapshot(): Promise<NotificationPermissionSnapshot> {
  const fixture = developmentFixture();
  if (fixture) return fixtureSnapshot(fixture, 'read');
  try {
    return classifyNotificationPermission(await Notifications.getPermissionsAsync());
  } catch {
    return { status: 'unavailable', canAskAgain: null, reason: 'bridge_failure' };
  }
}

export async function requestNotificationPermissionSnapshot(): Promise<NotificationPermissionSnapshot> {
  const fixture = developmentFixture();
  if (fixture) return fixtureSnapshot(fixture, 'request');
  try {
    return classifyNotificationPermission(await Notifications.requestPermissionsAsync());
  } catch {
    return { status: 'unavailable', canAskAgain: null, reason: 'bridge_failure' };
  }
}
