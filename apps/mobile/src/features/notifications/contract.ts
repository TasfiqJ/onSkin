import type { NotificationKind } from '@layerwell/types';

export const NOTIFICATION_CONTRACT_VERSION = 1 as const;

export const NOTIFICATION_CATEGORY = {
  billing: 'layerwell.billing.v1',
  progress: 'layerwell.progress.v1',
  routine: 'layerwell.routine.v1',
  shelf: 'layerwell.shelf.v1',
} as const;

export type NotificationDestination = 'progress' | 'shelf' | 'subscription' | 'today';

export type LocalNotificationData = Readonly<{
  destination: NotificationDestination;
  kind: NotificationKind | 'trial_ending';
  layerwellNotificationVersion: typeof NOTIFICATION_CONTRACT_VERSION;
}>;

const DESTINATION_ROUTE = {
  progress: '/(tabs)/progress',
  shelf: '/(tabs)/shelf',
  subscription: '/settings/subscription',
  today: '/(tabs)/today',
} as const;

const NOTIFICATION_DESTINATION: Record<NotificationKind, NotificationDestination> = {
  am_reminder: 'today',
  capture: 'progress',
  deescalation: 'today',
  pm_step: 'today',
  rampup: 'today',
  replenishment: 'shelf',
  winback: 'today',
};

const VALID_KINDS = new Set<LocalNotificationData['kind']>([
  ...Object.keys(NOTIFICATION_DESTINATION) as NotificationKind[],
  'trial_ending',
]);

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

export function notificationCategoryForKind(kind: NotificationKind): string {
  switch (NOTIFICATION_DESTINATION[kind]) {
    case 'progress':
      return NOTIFICATION_CATEGORY.progress;
    case 'shelf':
      return NOTIFICATION_CATEGORY.shelf;
    default:
      return NOTIFICATION_CATEGORY.routine;
  }
}

export function notificationDataForKind(kind: NotificationKind): LocalNotificationData {
  return {
    destination: NOTIFICATION_DESTINATION[kind],
    kind,
    layerwellNotificationVersion: NOTIFICATION_CONTRACT_VERSION,
  };
}

export function trialEndingNotificationData(): LocalNotificationData {
  return {
    destination: 'subscription',
    kind: 'trial_ending',
    layerwellNotificationVersion: NOTIFICATION_CONTRACT_VERSION,
  };
}

/**
 * Accept only the bounded first-party notification contract. Never interpret a
 * route, URL, product ID, or other attacker-controlled value from a local or
 * future remote payload.
 */
export function notificationRouteFromData(value: unknown): string | null {
  if (!isRecord(value)) return null;
  const keys = Object.keys(value).sort();
  if (
    keys.length !== 3 ||
    keys[0] !== 'destination' ||
    keys[1] !== 'kind' ||
    keys[2] !== 'layerwellNotificationVersion' ||
    value.layerwellNotificationVersion !== NOTIFICATION_CONTRACT_VERSION ||
    typeof value.kind !== 'string' ||
    !VALID_KINDS.has(value.kind as LocalNotificationData['kind']) ||
    typeof value.destination !== 'string' ||
    !(value.destination in DESTINATION_ROUTE)
  ) {
    return null;
  }

  const kind = value.kind as LocalNotificationData['kind'];
  const destination = value.destination as NotificationDestination;
  const expectedDestination =
    kind === 'trial_ending' ? 'subscription' : NOTIFICATION_DESTINATION[kind];
  return destination === expectedDestination ? DESTINATION_ROUTE[destination] : null;
}
