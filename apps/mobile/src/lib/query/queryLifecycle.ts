import { focusManager, onlineManager } from '@tanstack/react-query';
import * as Network from 'expo-network';
import { AppState, Platform } from 'react-native';

import { createQueryLifecycleCoordinator } from './queryLifecycleCore';

const coordinator = createQueryLifecycleCoordinator({
  platformOS: Platform.OS,
  appState: AppState,
  network: Network,
  focusManager,
  onlineManager,
});

/** Configure TanStack Query's mobile lifecycle sources exactly once. */
export function configureQueryLifecycle() {
  return coordinator.configure();
}
