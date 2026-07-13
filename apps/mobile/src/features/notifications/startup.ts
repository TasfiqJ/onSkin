import * as Notifications from 'expo-notifications';
import { Platform } from 'react-native';

let configuration: Promise<void> | null = null;

async function configureNotificationRuntime(): Promise<void> {
  try {
    Notifications.setNotificationHandler({
      handleNotification: async () => ({
        shouldShowBanner: true,
        shouldShowList: true,
        shouldPlaySound: false,
        shouldSetBadge: false,
      }),
    });
    if (Platform.OS === 'android') {
      await Notifications.setNotificationChannelAsync('routine', {
        name: 'Routine reminders',
        importance: Notifications.AndroidImportance.DEFAULT,
      });
    }
  } catch {
    // Expo web and other unsupported runtimes must not block application startup.
  }
}

/** Minimal, idempotent root setup: notification handler plus calm Android channel. */
export function configureNotifications(): Promise<void> {
  configuration ??= configureNotificationRuntime();
  return configuration;
}
