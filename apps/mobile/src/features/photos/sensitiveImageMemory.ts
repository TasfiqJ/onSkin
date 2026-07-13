import { Image } from 'expo-image';
import { AppState, type AppStateStatus, type NativeEventSubscription } from 'react-native';

import { shouldPurgeSensitiveImagesForAppState } from './sensitiveImagePolicy';

type SensitiveImageLifecycleEvent = 'purge' | 'resume';
type SensitiveImageLifecycleListener = (event: SensitiveImageLifecycleEvent) => void;

const listeners = new Set<SensitiveImageLifecycleListener>();
let appStateSubscription: NativeEventSubscription | null = null;
let memoryWarningSubscription: NativeEventSubscription | null = null;
let previousAppState: AppStateStatus = AppState.currentState;
let clearInFlight: Promise<boolean> | null = null;

function clearExpoImageMemory(): Promise<boolean> {
  if (clearInFlight) return clearInFlight;
  clearInFlight = Image.clearMemoryCache()
    .catch(() => false)
    .finally(() => {
      clearInFlight = null;
    });
  return clearInFlight;
}

function notify(event: SensitiveImageLifecycleEvent): void {
  for (const listener of listeners) listener(event);
}

function handleAppStateChange(nextState: AppStateStatus): void {
  const wasActive = previousAppState === 'active';
  previousAppState = nextState;
  if (shouldPurgeSensitiveImagesForAppState(nextState)) {
    notify('purge');
    void clearExpoImageMemory();
    return;
  }
  if (!wasActive) notify('resume');
}

function ensureAppStateSubscription(): void {
  if (appStateSubscription) return;
  previousAppState = AppState.currentState;
  appStateSubscription = AppState.addEventListener('change', handleAppStateChange);
  memoryWarningSubscription = AppState.addEventListener('memoryWarning', () => {
    notify('purge');
    void clearExpoImageMemory();
  });
}

function releaseAppStateSubscriptionIfUnused(): void {
  if (listeners.size > 0 || !appStateSubscription) return;
  appStateSubscription.remove();
  appStateSubscription = null;
  memoryWarningSubscription?.remove();
  memoryWarningSubscription = null;
}

export function subscribeToSensitiveImageLifecycle(
  listener: SensitiveImageLifecycleListener,
): () => void {
  listeners.add(listener);
  ensureAppStateSubscription();
  if (shouldPurgeSensitiveImagesForAppState(previousAppState)) listener('purge');
  return () => {
    listeners.delete(listener);
    releaseAppStateSubscriptionIfUnused();
  };
}

/** Drop resolved data URIs owned by mounted views and clear expo-image's shared
 * decoded-memory cache. This never creates or clears a disk cache; sensitive
 * PhotoImage instances use cachePolicy="none". */
export function purgeSensitiveImageMemory(): Promise<boolean> {
  notify('purge');
  return clearExpoImageMemory();
}
