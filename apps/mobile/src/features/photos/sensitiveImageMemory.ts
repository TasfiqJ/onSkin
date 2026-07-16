import { Image } from 'expo-image';
import {
  AppState,
  Platform,
  type AppStateStatus,
  type NativeEventSubscription,
} from 'react-native';

import { shouldPurgeSensitiveImagesForAppState } from './sensitiveImagePolicy';
import { purgeSensitiveImageCoordinator } from './sensitiveImageCoordinator';

type SensitiveImageLifecycleEvent = 'purge' | 'resume';
type SensitiveImageLifecycleListener = (event: SensitiveImageLifecycleEvent) => void;

const listeners = new Set<SensitiveImageLifecycleListener>();
let appStateSubscription: NativeEventSubscription | null = null;
let memoryWarningSubscription: NativeEventSubscription | null = null;
let previousAppState: AppStateStatus = AppState.currentState;
let lifecycleActive = previousAppState === 'active';
let clearInFlight: Promise<boolean> | null = null;
let purgeEpoch = 0;
let latestPurge: { epoch: number; clear: Promise<boolean> } | null = null;

function clearExpoImageMemory(): Promise<boolean> {
  if (Platform.OS === 'web') return Promise.resolve(true);
  if (clearInFlight) return clearInFlight;
  clearInFlight = Promise.resolve()
    .then(() => Image.clearMemoryCache())
    .catch(() => false)
    .finally(() => {
      clearInFlight = null;
    });
  return clearInFlight;
}

function notify(event: SensitiveImageLifecycleEvent): void {
  for (const listener of listeners) {
    try {
      listener(event);
    } catch {
      // A broken view subscriber cannot interrupt the privacy boundary. The
      // coordinator purge and native cache clear must still run.
    }
  }
}

function resumeAfterClear(epoch: number, clear: Promise<boolean>): void {
  void clear.then((cleared) => {
    if (!cleared) return;
    if (latestPurge?.epoch === epoch) latestPurge = null;
    if (purgeEpoch !== epoch || previousAppState !== 'active') return;
    if (lifecycleActive) return;
    lifecycleActive = true;
    notify('resume');
  });
}

function handleAppStateChange(nextState: AppStateStatus): void {
  const wasActive = previousAppState === 'active';
  previousAppState = nextState;
  if (shouldPurgeSensitiveImagesForAppState(nextState)) {
    void purgeSensitiveImageMemory();
    return;
  }
  if (!wasActive || !lifecycleActive) {
    const epoch = purgeEpoch;
    const clear = latestPurge?.clear ?? Promise.resolve(true);
    resumeAfterClear(epoch, clear);
  }
}

function ensureAppStateSubscription(): void {
  if (appStateSubscription) return;
  previousAppState = AppState.currentState;
  lifecycleActive = previousAppState === 'active' && latestPurge === null;
  appStateSubscription = AppState.addEventListener('change', handleAppStateChange);
  memoryWarningSubscription = AppState.addEventListener('memoryWarning', () => {
    void purgeSensitiveImageMemory();
  });
  if (shouldPurgeSensitiveImagesForAppState(previousAppState)) {
    void purgeSensitiveImageMemory();
  }
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
  return () => {
    listeners.delete(listener);
    releaseAppStateSubscriptionIfUnused();
  };
}

/** Synchronous admission guard used immediately before a decrypt request. */
export function isSensitiveImageLifecycleActive(): boolean {
  if (AppState.currentState !== 'active') return false;
  if (!appStateSubscription && latestPurge === null) return true;
  return lifecycleActive && previousAppState === 'active' && latestPurge === null;
}

/** Drop resolved data URIs owned by mounted views and clear expo-image's shared
 * decoded-memory cache. This function never touches disk; the startup migration
 * handles legacy disk residue before sensitive display. */
export function purgeSensitiveImageMemory(): Promise<boolean> {
  const epoch = ++purgeEpoch;
  lifecycleActive = false;
  notify('purge');
  purgeSensitiveImageCoordinator();
  const clear = clearExpoImageMemory();
  latestPurge = { epoch, clear };
  resumeAfterClear(epoch, clear);
  return clear;
}
