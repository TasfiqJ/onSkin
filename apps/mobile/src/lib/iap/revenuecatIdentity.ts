import { createSerialTaskQueue } from '@/lib/serialTaskQueue';

export type RevenueCatIdentityAdapter = {
  configure: (appUserId: string) => void | Promise<void>;
  isAnonymous: () => Promise<boolean>;
  isConfigured: () => Promise<boolean>;
  logIn: (appUserId: string) => Promise<unknown>;
  logOut: () => Promise<unknown>;
};

export function createRevenueCatIdentityCoordinator() {
  const queue = createSerialTaskQueue();
  let currentUserId: string | null = null;
  let sdkConfigured = false;
  let latest: Promise<void> | null = null;

  const run = (task: () => Promise<void>): Promise<void> => {
    const operation = queue.run(task);
    latest = operation;
    return operation;
  };

  return {
    configureFor(
      appUserId: string,
      loadAdapter: () => Promise<RevenueCatIdentityAdapter>,
    ): Promise<void> {
      if (currentUserId === appUserId) return Promise.resolve();
      return run(async () => {
        if (currentUserId === appUserId) return;
        const adapter = await loadAdapter();
        if (!sdkConfigured) sdkConfigured = await adapter.isConfigured();
        if (!sdkConfigured) {
          await adapter.configure(appUserId);
          sdkConfigured = true;
        } else {
          await adapter.logIn(appUserId);
        }
        currentUserId = appUserId;
      });
    },

    currentUserId: () => currentUserId,
    latest: () => latest,

    reset(loadAdapter: () => Promise<RevenueCatIdentityAdapter>): Promise<void> {
      return run(async () => {
        try {
          const adapter = await loadAdapter();
          if (!sdkConfigured) sdkConfigured = await adapter.isConfigured();
          if (sdkConfigured && !(await adapter.isAnonymous())) await adapter.logOut();
        } finally {
          // logOut keeps the native SDK configured but moves it to an anonymous identity.
          currentUserId = null;
        }
      });
    },
  };
}
