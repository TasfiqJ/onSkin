import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { describe, expect, it } from 'vitest';

const requireFromTest = createRequire(import.meta.url);
const componentSource = readFileSync(
  requireFromTest.resolve('./NotificationPreferenceSyncStatus.tsx'),
  'utf8',
);
const notificationsRoute = readFileSync(
  requireFromTest.resolve('../../app/settings/notifications.tsx'),
  'utf8',
);
const timingRoute = readFileSync(requireFromTest.resolve('../../app/settings/timing.tsx'), 'utf8');

describe('notification preference sync status UI contract', () => {
  it('names every non-blocking state without conflating local/native save failure', () => {
    expect(componentSource).toContain('Saved locally');
    expect(componentSource).toContain('Syncing notification settings');
    expect(componentSource).toContain('Notification sync needs attention');
    expect(componentSource).toContain('controls stay usable while this finishes');
    expect(componentSource).toContain('still safe on this phone but could not sync');
    expect(componentSource).not.toContain('Notification change incomplete');
  });

  it('keeps status owner-scoped, entity-scoped, observable, and free of polling', () => {
    expect(componentSource).toContain('useAuth()');
    expect(componentSource).toContain('readNotificationPreferencesOutboxStatus');
    expect(componentSource).toContain('retryNotificationPreferencesOutbox');
    expect(componentSource).toContain('useSyncExternalStore(');
    expect(componentSource).not.toContain('setInterval(');
    expect(componentSource).not.toContain('setTimeout(');
  });

  it('renders one shared leaf on both notification preference routes', () => {
    expect(notificationsRoute).toContain('<NotificationPreferenceSyncStatus className="mb-4" />');
    expect(timingRoute).toContain('<NotificationPreferenceSyncStatus className="mb-4" />');
    expect(componentSource).toContain('accessibilityLabel="Syncing notification settings"');
    expect(componentSource).toContain('accessibilityState={{ busy: true }}');
    expect(componentSource).toContain('kind="error"');
    expect(componentSource).toContain('Try sync again');
  });

  it('keeps visual fixtures development-web-only', () => {
    expect(componentSource).toContain('EXPO_PUBLIC_E2E_NOTIFICATION_SYNC_STATUS');
    expect(componentSource).toContain("typeof __DEV__ === 'undefined' || !__DEV__");
    expect(componentSource).toContain("Platform.OS !== 'web'");
  });
});
