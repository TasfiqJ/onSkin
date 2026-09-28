import { describe, expect, it } from 'vitest';

import {
  NOTIFICATION_CATEGORY,
  notificationCategoryForKind,
  notificationDataForKind,
  notificationRouteFromData,
  trialEndingNotificationData,
} from './contract';

describe('notification contract', () => {
  it('keeps native category identifiers outside the private-storage namespace', () => {
    const categories = Object.values(NOTIFICATION_CATEGORY);
    expect(new Set(categories).size).toBe(categories.length);
    for (const category of categories) {
      expect(category).toMatch(/^layerwell-notification-[a-z]+-v1$/u);
      expect(category).not.toMatch(/^(?:layerwell|onskin)\./u);
    }
  });

  it('maps every local purpose to a fixed category and bounded destination', () => {
    expect(notificationCategoryForKind('pm_step')).toBe(NOTIFICATION_CATEGORY.routine);
    expect(notificationCategoryForKind('capture')).toBe(NOTIFICATION_CATEGORY.progress);
    expect(notificationCategoryForKind('replenishment')).toBe(NOTIFICATION_CATEGORY.shelf);
    expect(notificationRouteFromData(notificationDataForKind('pm_step'))).toBe('/(tabs)/today');
    expect(notificationRouteFromData(notificationDataForKind('capture'))).toBe(
      '/(tabs)/progress',
    );
    expect(notificationRouteFromData(notificationDataForKind('replenishment'))).toBe(
      '/(tabs)/shelf',
    );
    expect(notificationRouteFromData(trialEndingNotificationData())).toBe(
      '/settings/subscription',
    );
  });

  it.each([
    null,
    {},
    { destination: 'today', kind: 'pm_step' },
    {
      destination: 'today',
      kind: 'pm_step',
      layerwellNotificationVersion: 2,
    },
    {
      destination: 'subscription',
      kind: 'pm_step',
      layerwellNotificationVersion: 1,
    },
    {
      destination: 'today',
      kind: 'unknown',
      layerwellNotificationVersion: 1,
    },
    {
      destination: 'today',
      kind: 'pm_step',
      layerwellNotificationVersion: 1,
      route: '/settings/account',
    },
    {
      destination: 'https://attacker.invalid',
      kind: 'pm_step',
      layerwellNotificationVersion: 1,
    },
  ])('rejects malformed, mismatched, extended, or attacker-controlled payloads', (value) => {
    expect(notificationRouteFromData(value)).toBeNull();
  });
});
