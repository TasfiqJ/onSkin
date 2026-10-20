import * as Notifications from 'expo-notifications';
import { Platform } from 'react-native';

import { NOTIFICATION_CATEGORY } from './contract';

export type NotificationRuntimeConfiguration = 'ready' | 'unavailable';

let configuration: Promise<NotificationRuntimeConfiguration> | null = null;

async function configureNotificationRuntime(): Promise<NotificationRuntimeConfiguration> {
  let ready = true;
  try {
    Notifications.setNotificationHandler({
      handleNotification: async () => ({
        shouldShowBanner: true,
        shouldShowList: true,
        shouldPlaySound: false,
        shouldSetBadge: false,
      }),
    });
  } catch {
    // Expo web and other unsupported runtimes must not block application startup.
    ready = false;
  }
  if (Platform.OS === 'web') return 'unavailable';

  // Layerwell never uses app-icon badges. Clear any residue from an older build
  // before registering the exact local/future-remote category allowlist.
  if (!(await Notifications.setBadgeCountAsync(0).catch(() => false))) ready = false;
  const categoryResults = await Promise.allSettled(
    Object.values(NOTIFICATION_CATEGORY).map((identifier) =>
      Notifications.setNotificationCategoryAsync(identifier, []),
    ),
  );
  if (categoryResults.some((result) => result.status === 'rejected')) ready = false;

  if (Platform.OS === 'android') {
    try {
      await Notifications.setNotificationChannelAsync('routine', {
        name: 'Routine reminders',
        importance: Notifications.AndroidImportance.DEFAULT,
      });
    } catch {
      ready = false;
    }
  }
  return ready ? 'ready' : 'unavailable';
}

/** Minimal, idempotent root setup: notification handler plus calm Android channel. */
export function configureNotifications(): Promise<NotificationRuntimeConfiguration> {
  if (!configuration) {
    const attempt = configureNotificationRuntime().catch(() => 'unavailable' as const);
    configuration = attempt;
    void attempt.then((result) => {
      // One attempt per caller wave; ready and permanently unsupported web reuse.
      // A later native caller may retry only after the prior attempt settles.
      if (result === 'unavailable' && Platform.OS !== 'web' && configuration === attempt) {
        configuration = null;
      }
    });
  }
  return configuration;
}
