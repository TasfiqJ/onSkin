import * as Notifications from 'expo-notifications';
import { useRouter } from 'expo-router';
import { useEffect } from 'react';
import { Platform } from 'react-native';

import { runAccountGenerationOperation } from '@/lib/auth/accountGeneration';

import { notificationRouteFromData } from './contract';

/**
 * Routes only after the account/private-data/health gates have mounted this
 * host. Cold responses stay with Expo until those gates are ready. The payload
 * can select only one of the fixed, non-parameterized in-app destinations.
 */
export function NotificationResponseHost() {
  const router = useRouter();

  useEffect(() => {
    if (Platform.OS === 'web') return;
    let active = true;
    const handledIdentifiers = new Set<string>();

    const handle = (response: Notifications.NotificationResponse) => {
      if (!active || response.actionIdentifier !== Notifications.DEFAULT_ACTION_IDENTIFIER) {
        return;
      }
      const identifier = response.notification.request.identifier;
      if (identifier && handledIdentifiers.has(identifier)) return;
      const route = notificationRouteFromData(response.notification.request.content.data);
      if (!route) return;
      if (identifier) handledIdentifiers.add(identifier);
      void runAccountGenerationOperation((lease) => {
        // Registration in the account-generation drain happens before routing.
        // JavaScript cannot interleave a boundary between this synchronous
        // current-owner assertion and the navigation side effect.
        lease.assertCurrent();
        router.push(route as never);
        lease.assertCurrent();
      })
        .catch(() => undefined)
        // A recognized response fenced by an account boundary is consumed,
        // never retained for replay after the next owner mounts.
        .then(() => Notifications.clearLastNotificationResponseAsync())
        .catch(() => undefined);
    };

    const subscription = Notifications.addNotificationResponseReceivedListener(handle);
    void Notifications.getLastNotificationResponseAsync()
      .then((response) => {
        if (!active || !response) return;
        handle(response);
      })
      .catch(() => undefined);

    return () => {
      active = false;
      subscription.remove();
    };
  }, [router]);

  return null;
}
