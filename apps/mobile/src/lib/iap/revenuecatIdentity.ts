import { createSerialTaskQueue } from '@/lib/serialTaskQueue';

export type RevenueCatIdentityAdapter = {
  configure: (appUserId: string) => void | Promise<void>;
  /** A supported async native read used to fence void-returning configure. */
  fenceIdentity: () => Promise<unknown>;
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
      canConfigure: () => boolean = () => true,
    ): Promise<void> {
      if (!canConfigure() || currentUserId === appUserId) return Promise.resolve();
      return run(async () => {
        if (!canConfigure() || currentUserId === appUserId) return;
        const adapter = await loadAdapter();
        if (!sdkConfigured) sdkConfigured = await adapter.isConfigured();
        // This is the last await before the native identity write. Recheck the
        // durable deletion gate in the same JS turn as configure/logIn so a
        // queued operation cannot start after deletion has been armed.
        if (!canConfigure()) return;
        if (!sdkConfigured) {
          await adapter.configure(appUserId);
          sdkConfigured = true;
        } else {
          await adapter.logIn(appUserId);
        }
        if (canConfigure()) currentUserId = appUserId;
      });
    },

    currentUserId: () => currentUserId,
    latest: () => latest,

    reset(loadAdapter: () => Promise<RevenueCatIdentityAdapter>): Promise<void> {
      return run(async () => {
        try {
          const adapter = await loadAdapter();
          if (!sdkConfigured) sdkConfigured = await adapter.isConfigured();
          if (sdkConfigured) {
            // RN Purchases.configure() returns void even though native setup can
            // continue. This ordered native read must resolve before logout so
            // deletion cannot overtake a configure already handed to the SDK.
            await adapter.fenceIdentity();
            if (!(await adapter.isAnonymous())) await adapter.logOut();
          }
        } finally {
          // logOut keeps the native SDK configured but moves it to an anonymous identity.
          currentUserId = null;
        }
      });
    },
  };
}
