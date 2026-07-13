type RemoveSubscription = {
  remove: () => void;
};

export type QueryFocusManager = {
  setEventListener: (
    setup: (setFocused: (focused?: boolean) => void) => (() => void) | undefined,
  ) => void;
};

export type QueryOnlineManager = {
  setEventListener: (
    setup: (setOnline: (online: boolean) => void) => (() => void) | undefined,
  ) => void;
};

export type AppStateSource = {
  currentState: string | null;
  addEventListener: (event: 'change', listener: (state: string) => void) => RemoveSubscription;
};

export type NetworkState = {
  isConnected?: boolean;
  isInternetReachable?: boolean;
};

export type NetworkStateSource = {
  getNetworkStateAsync: () => Promise<NetworkState>;
  addNetworkStateListener: (listener: (state: NetworkState) => void) => RemoveSubscription;
};

export type QueryLifecycleDependencies = {
  platformOS: string;
  appState: AppStateSource;
  network: NetworkStateSource;
  focusManager: QueryFocusManager;
  onlineManager: QueryOnlineManager;
};

export type QueryLifecycleConfiguration = 'configured' | 'already-configured' | 'browser-managed';

/**
 * Prefer validated reachability when the platform provides it. Some platforms
 * only expose link connectivity; that is still more useful than assuming the
 * device is always online. An entirely unknown state leaves TanStack's prior
 * state unchanged instead of creating a false offline gate.
 */
export function networkStateToOnline(state: NetworkState): boolean | undefined {
  if (typeof state.isInternetReachable === 'boolean') return state.isInternetReachable;
  if (typeof state.isConnected === 'boolean') return state.isConnected;
  return undefined;
}

export function createQueryLifecycleCoordinator(deps: QueryLifecycleDependencies): {
  configure: () => QueryLifecycleConfiguration;
} {
  let configured = false;

  return {
    configure() {
      if (configured) return 'already-configured';
      configured = true;

      // TanStack already owns browser visibility and online/offline listeners.
      // Replacing them with React Native sources on web would weaken that path.
      if (deps.platformOS === 'web') return 'browser-managed';

      deps.focusManager.setEventListener((setFocused) => {
        let lastFocused: boolean | undefined;
        const publishFocused = (focused: boolean) => {
          if (focused === lastFocused) return;
          lastFocused = focused;
          setFocused(focused);
        };

        publishFocused(deps.appState.currentState === 'active');

        let subscription: RemoveSubscription | undefined;
        try {
          subscription = deps.appState.addEventListener('change', (state) => {
            publishFocused(state === 'active');
          });
        } catch {
          // The initial state remains authoritative if the runtime cannot add a
          // listener. Query execution must not crash during bootstrap.
        }

        return () => subscription?.remove();
      });

      deps.onlineManager.setEventListener((setOnline) => {
        let disposed = false;
        let eventVersion = 0;
        let lastOnline: boolean | undefined;
        let subscription: RemoveSubscription | undefined;

        const publishOnline = (online: boolean | undefined) => {
          if (disposed || online === undefined || online === lastOnline) return;
          lastOnline = online;
          setOnline(online);
        };

        const initialVersion = eventVersion;
        try {
          subscription = deps.network.addNetworkStateListener((state) => {
            eventVersion += 1;
            publishOnline(networkStateToOnline(state));
          });
        } catch {
          // A one-shot read below can still establish the current state.
        }

        // Subscribe before reading so a newer event always wins over a delayed
        // initial snapshot. Rejections leave TanStack's current state intact.
        void Promise.resolve()
          .then(() => deps.network.getNetworkStateAsync())
          .then((state) => {
            if (disposed || eventVersion !== initialVersion) return;
            publishOnline(networkStateToOnline(state));
          })
          .catch(() => {});

        return () => {
          disposed = true;
          subscription?.remove();
        };
      });

      return 'configured';
    },
  };
}
