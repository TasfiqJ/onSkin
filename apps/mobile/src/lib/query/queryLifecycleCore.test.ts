import { focusManager, onlineManager, QueryClient, QueryObserver } from '@tanstack/react-query';
import { afterEach, describe, expect, it, vi } from 'vitest';

import {
  createQueryLifecycleCoordinator,
  networkStateToOnline,
  type AppStateSource,
  type NetworkState,
  type NetworkStateSource,
  type QueryFocusManager,
  type QueryOnlineManager,
} from './queryLifecycleCore';

function createFocusManagerHarness() {
  let cleanup: (() => void) | undefined;
  const updates: (boolean | undefined)[] = [];
  const setEventListener: QueryFocusManager['setEventListener'] = (setup) => {
    cleanup?.();
    cleanup = setup((focused) => updates.push(focused));
  };
  const manager = {
    setEventListener: vi.fn(setEventListener),
  };

  return { manager, updates, replaceListener: () => manager.setEventListener(() => undefined) };
}

function createOnlineManagerHarness() {
  let cleanup: (() => void) | undefined;
  const updates: boolean[] = [];
  const setEventListener: QueryOnlineManager['setEventListener'] = (setup) => {
    cleanup?.();
    cleanup = setup((online) => updates.push(online));
  };
  const manager = {
    setEventListener: vi.fn(setEventListener),
  };

  return { manager, updates, replaceListener: () => manager.setEventListener(() => undefined) };
}

function createAppStateSource(currentState = 'active') {
  const listeners = new Set<(state: string) => void>();
  const remove = vi.fn();
  const appState: AppStateSource = {
    currentState,
    addEventListener: vi.fn((_event, listener) => {
      listeners.add(listener);
      return {
        remove: () => {
          listeners.delete(listener);
          remove();
        },
      };
    }),
  };

  return {
    appState,
    emit: (state: string) => listeners.forEach((listener) => listener(state)),
    remove,
  };
}

function createNetworkSource(
  initial: NetworkState | Promise<NetworkState> = { isConnected: true },
) {
  const listeners = new Set<(state: NetworkState) => void>();
  const remove = vi.fn();
  const network: NetworkStateSource = {
    getNetworkStateAsync: vi.fn(() => Promise.resolve(initial)),
    addNetworkStateListener: vi.fn((listener) => {
      listeners.add(listener);
      return {
        remove: () => {
          listeners.delete(listener);
          remove();
        },
      };
    }),
  };

  return {
    network,
    emit: (state: NetworkState) => listeners.forEach((listener) => listener(state)),
    remove,
  };
}

function createDeferred<T>() {
  let resolve!: (value: T) => void;
  let reject!: (reason?: unknown) => void;
  const promise = new Promise<T>((resolvePromise, rejectPromise) => {
    resolve = resolvePromise;
    reject = rejectPromise;
  });
  return { promise, resolve, reject };
}

function configureWithSources(
  appState = createAppStateSource(),
  network = createNetworkSource(),
  managers = {
    focus: createFocusManagerHarness(),
    online: createOnlineManagerHarness(),
  },
) {
  const coordinator = createQueryLifecycleCoordinator({
    platformOS: 'ios',
    appState: appState.appState,
    network: network.network,
    focusManager: managers.focus.manager,
    onlineManager: managers.online.manager,
  });
  return { coordinator, appState, network, managers };
}

async function flushPromises() {
  await Promise.resolve();
  await Promise.resolve();
  await Promise.resolve();
}

afterEach(() => {
  // Replacing listeners invokes the coordinator-owned cleanup installed on the
  // TanStack singletons. Reset explicit state for the next integration case.
  focusManager.setEventListener(() => undefined);
  onlineManager.setEventListener(() => undefined);
  focusManager.setFocused(undefined);
  onlineManager.setOnline(true);
});

describe('networkStateToOnline', () => {
  it('prefers validated reachability and falls back to link connectivity', () => {
    expect(networkStateToOnline({ isConnected: true, isInternetReachable: false })).toBe(false);
    expect(networkStateToOnline({ isConnected: false, isInternetReachable: true })).toBe(true);
    expect(networkStateToOnline({ isConnected: false })).toBe(false);
    expect(networkStateToOnline({})).toBeUndefined();
  });
});

describe('query lifecycle coordinator', () => {
  it('installs once, publishes only state transitions, and removes both listeners', async () => {
    const setup = configureWithSources();

    expect(setup.coordinator.configure()).toBe('configured');
    expect(setup.coordinator.configure()).toBe('already-configured');
    await flushPromises();

    expect(setup.managers.focus.manager.setEventListener).toHaveBeenCalledTimes(1);
    expect(setup.managers.online.manager.setEventListener).toHaveBeenCalledTimes(1);
    expect(setup.appState.appState.addEventListener).toHaveBeenCalledTimes(1);
    expect(setup.network.network.addNetworkStateListener).toHaveBeenCalledTimes(1);
    expect(setup.managers.focus.updates).toEqual([true]);
    expect(setup.managers.online.updates).toEqual([true]);

    setup.appState.emit('background');
    setup.appState.emit('background');
    setup.appState.emit('active');
    setup.network.emit({ isConnected: false, isInternetReachable: false });
    setup.network.emit({ isConnected: false, isInternetReachable: false });
    setup.network.emit({ isConnected: true, isInternetReachable: true });

    expect(setup.managers.focus.updates).toEqual([true, false, true]);
    expect(setup.managers.online.updates).toEqual([true, false, true]);

    setup.managers.focus.replaceListener();
    setup.managers.online.replaceListener();
    expect(setup.appState.remove).toHaveBeenCalledTimes(1);
    expect(setup.network.remove).toHaveBeenCalledTimes(1);
  });

  it('leaves browser lifecycle ownership with TanStack web listeners', () => {
    const appState = createAppStateSource();
    const network = createNetworkSource();
    const focus = createFocusManagerHarness();
    const online = createOnlineManagerHarness();
    const coordinator = createQueryLifecycleCoordinator({
      platformOS: 'web',
      appState: appState.appState,
      network: network.network,
      focusManager: focus.manager,
      onlineManager: online.manager,
    });

    expect(coordinator.configure()).toBe('browser-managed');
    expect(coordinator.configure()).toBe('already-configured');
    expect(focus.manager.setEventListener).not.toHaveBeenCalled();
    expect(online.manager.setEventListener).not.toHaveBeenCalled();
    expect(appState.appState.addEventListener).not.toHaveBeenCalled();
    expect(network.network.addNetworkStateListener).not.toHaveBeenCalled();
    expect(network.network.getNetworkStateAsync).not.toHaveBeenCalled();
  });

  it('does not let a delayed initial network read overwrite a newer event', async () => {
    const deferred = createDeferred<NetworkState>();
    const setup = configureWithSources(
      createAppStateSource(),
      createNetworkSource(deferred.promise),
    );

    setup.coordinator.configure();
    setup.network.emit({ isInternetReachable: false });
    deferred.resolve({ isInternetReachable: true });
    await flushPromises();

    expect(setup.managers.online.updates).toEqual([false]);
  });

  it('keeps the prior online state when the initial read rejects, then accepts events', async () => {
    const deferred = createDeferred<NetworkState>();
    const setup = configureWithSources(
      createAppStateSource(),
      createNetworkSource(deferred.promise),
    );

    setup.coordinator.configure();
    deferred.reject(new Error('network source unavailable'));
    await flushPromises();
    expect(setup.managers.online.updates).toEqual([]);

    setup.network.emit({ isConnected: false });
    expect(setup.managers.online.updates).toEqual([false]);
  });

  it('falls back to the one-shot network read when listener registration throws', async () => {
    const setup = configureWithSources();
    vi.mocked(setup.network.network.addNetworkStateListener).mockImplementation(() => {
      throw new Error('listener unavailable');
    });

    expect(() => setup.coordinator.configure()).not.toThrow();
    await flushPromises();
    expect(setup.managers.online.updates).toEqual([true]);
  });

  it('ignores a pending initial read after cleanup', async () => {
    const deferred = createDeferred<NetworkState>();
    const setup = configureWithSources(
      createAppStateSource(),
      createNetworkSource(deferred.promise),
    );

    setup.coordinator.configure();
    setup.managers.online.replaceListener();
    deferred.resolve({ isInternetReachable: false });
    await flushPromises();

    expect(setup.managers.online.updates).toEqual([]);
    expect(setup.network.remove).toHaveBeenCalledTimes(1);
  });
});

describe('TanStack query lifecycle integration', () => {
  it('refetches one stale active query once on a real foreground transition', async () => {
    const appState = createAppStateSource('active');
    const network = createNetworkSource({ isInternetReachable: true });
    const coordinator = createQueryLifecycleCoordinator({
      platformOS: 'ios',
      appState: appState.appState,
      network: network.network,
      focusManager,
      onlineManager,
    });
    coordinator.configure();

    const client = new QueryClient({
      defaultOptions: { queries: { retry: false, staleTime: 0 } },
    });
    client.mount();
    let activeFetches = 0;
    let inactiveFetches = 0;

    await client.fetchQuery({
      queryKey: ['inactive-lifecycle-proof'],
      queryFn: async () => ++inactiveFetches,
    });
    const observer = new QueryObserver(client, {
      queryKey: ['active-lifecycle-proof'],
      queryFn: async () => ++activeFetches,
    });
    const unsubscribe = observer.subscribe(() => {});

    await vi.waitFor(() => expect(activeFetches).toBe(1));
    await vi.waitFor(() => expect(observer.getCurrentResult().fetchStatus).toBe('idle'));
    appState.emit('background');
    appState.emit('active');
    await vi.waitFor(() => expect(activeFetches).toBe(2));
    appState.emit('active');
    await flushPromises();

    expect(activeFetches).toBe(2);
    expect(inactiveFetches).toBe(1);
    expect(client.getQueryCache().findAll()).toHaveLength(2);

    unsubscribe();
    client.unmount();
    client.clear();
  });

  it('resumes one paused active query once on a real reconnect transition', async () => {
    const queryKey = ['reconnect-lifecycle-proof'] as const;
    const appState = createAppStateSource('active');
    const network = createNetworkSource({ isInternetReachable: true });
    const coordinator = createQueryLifecycleCoordinator({
      platformOS: 'ios',
      appState: appState.appState,
      network: network.network,
      focusManager,
      onlineManager,
    });
    coordinator.configure();

    const client = new QueryClient({
      defaultOptions: { queries: { retry: false, staleTime: Infinity } },
    });
    client.mount();
    let fetches = 0;
    const observer = new QueryObserver(client, {
      queryKey,
      queryFn: async () => ++fetches,
    });
    const unsubscribe = observer.subscribe(() => {});
    await vi.waitFor(() => expect(fetches).toBe(1));
    await vi.waitFor(() => expect(observer.getCurrentResult().fetchStatus).toBe('idle'));

    network.emit({ isConnected: false, isInternetReachable: false });
    expect(onlineManager.isOnline()).toBe(false);
    const refetch = observer.refetch();
    // Query.fetch dispatches its paused state synchronously. Read the public
    // cache state instead of waiting for the observer's batched notification;
    // under a busy full-suite worker that notification can arrive after
    // waitFor's polling deadline even though the query is already paused.
    expect(client.getQueryState(queryKey)?.fetchStatus).toBe('paused');
    expect(fetches).toBe(1);

    network.emit({ isConnected: true, isInternetReachable: true });
    await refetch;
    await vi.waitFor(() => expect(fetches).toBe(2));
    network.emit({ isConnected: true, isInternetReachable: true });
    await flushPromises();
    expect(fetches).toBe(2);

    unsubscribe();
    client.unmount();
    client.clear();
  });
});
