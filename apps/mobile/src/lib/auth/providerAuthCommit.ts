import type { AppStateStatus } from 'react-native';

import type { AuthMutationFence } from './authMutationFence';

type ProviderAuthCommitDependencies = {
  authMutationFence: AuthMutationFence;
  isAppActive: () => boolean;
  startAutoRefresh: () => void;
  stopAutoRefresh: () => void;
};

export type ProviderAuthCommitCoordinator = {
  handleAppStateChange: (state: AppStateStatus) => void;
  isHeld: () => boolean;
  runExclusive: <T>(operation: () => T | Promise<T>) => Promise<T>;
};

/**
 * Extends the explicit auth-mutation fence across auth-js's internal session
 * capture/save window. Auto-refresh is stopped before the helper's public
 * exact-session read; its exact auth-storage lock then drains earlier refresh
 * work and excludes new capture/save work until the provider SDK settles.
 */
export function createProviderAuthCommitCoordinator(
  dependencies: ProviderAuthCommitDependencies,
): ProviderAuthCommitCoordinator {
  let held = false;

  return {
    handleAppStateChange(state) {
      if (state === 'active' && !held) dependencies.startAutoRefresh();
      else dependencies.stopAutoRefresh();
    },
    isHeld: () => held,
    runExclusive<T>(operation: () => T | Promise<T>): Promise<T> {
      return dependencies.authMutationFence.runExclusive(async () => {
        held = true;
        dependencies.stopAutoRefresh();
        try {
          return await operation();
        } finally {
          held = false;
          if (dependencies.isAppActive()) dependencies.startAutoRefresh();
        }
      });
    },
  };
}
