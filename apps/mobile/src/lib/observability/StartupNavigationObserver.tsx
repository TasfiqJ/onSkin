import { useRootNavigationState } from 'expo-router';
import { useEffect } from 'react';

import { markStartupPhase } from './operationTiming';

/** Records router readiness only after every secure startup gate has admitted
 * the route tree. It renders no UI and does not participate in authorization. */
export function StartupNavigationObserver() {
  const navigationState = useRootNavigationState();
  const navigationKey = navigationState?.key;

  useEffect(() => {
    if (navigationKey) markStartupPhase('navigation_ready');
  }, [navigationKey]);

  return null;
}
