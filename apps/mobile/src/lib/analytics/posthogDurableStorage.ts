import type { PostHogCustomStorage } from 'posthog-react-native';

export interface PostHogStorageBackend {
  getItem(key: string): string | null | Promise<string | null>;
  setItem(key: string, value: string): void | Promise<void>;
}

export const ACCOUNT_DELETION_ANALYTICS_STORAGE_UNVERIFIED =
  'ACCOUNT_DELETION_ANALYTICS_STORAGE_UNVERIFIED';

async function loadPlatformStorageBackend(): Promise<PostHogStorageBackend> {
  const { Platform } = await import('react-native');

  // This mirrors the public storage choices used by posthog-react-native: the
  // Expo document directory on native mobile and AsyncStorage elsewhere. Using
  // the same key and backend lets the adapter drain queues written before this
  // deletion barrier was introduced.
  if (Platform.OS === 'ios' || Platform.OS === 'android') {
    const { File, Paths } = await import('expo-file-system');
    return {
      async getItem(key) {
        try {
          return await new File(Paths.document, key).text();
        } catch {
          return null;
        }
      },
      async setItem(key, value) {
        await new File(Paths.document, key).write(value);
      },
    };
  }

  const { default: AsyncStorage } = await import('@react-native-async-storage/async-storage');
  return AsyncStorage;
}

let platformStorageBackendPromise: Promise<PostHogStorageBackend> | null = null;

function getPlatformStorageBackend(): Promise<PostHogStorageBackend> {
  platformStorageBackendPromise ??= loadPlatformStorageBackend();
  return platformStorageBackendPromise;
}

const platformStorageBackend: PostHogStorageBackend = {
  async getItem(key) {
    return (await getPlatformStorageBackend()).getItem(key);
  },
  async setItem(key, value) {
    await (await getPlatformStorageBackend()).setItem(key, value);
  },
};

/**
 * A supported PostHog custom-storage adapter with two deletion guarantees:
 *
 * 1. Once deletion starts, even a storage read already in flight resolves as
 *    absent, so an async SDK preload cannot put owner-A queues back in memory.
 * 2. Writes are serialized and can be durably drained. Once sealed, late SDK
 *    callbacks cannot recreate telemetry after the deletion barrier resolves.
 */
export class DeletionAwarePostHogStorage implements PostHogCustomStorage {
  private deletionFrozen = false;
  private sealed = false;
  private writeTail: Promise<void> = Promise.resolve();
  private criticalWriteFailure: unknown;
  private readonly observedKeys = new Set<string>();
  private readonly criticalExpectedWrites = new Map<string, string>();

  constructor(private readonly backend: PostHogStorageBackend = platformStorageBackend) {}

  getItem(key: string): string | null | Promise<string | null> {
    this.observedKeys.add(key);
    const result = this.backend.getItem(key);
    if (result instanceof Promise) {
      return result.then((value) => (this.deletionFrozen ? null : value));
    }
    return this.deletionFrozen ? null : result;
  }

  setItem(key: string, value: string): void | Promise<void> {
    if (this.sealed) return;

    const criticalWrite = this.deletionFrozen;
    if (criticalWrite) this.criticalExpectedWrites.set(key, value);
    const write = this.writeTail
      .catch(() => undefined)
      .then(() => this.backend.setItem(key, value));
    this.writeTail = Promise.resolve(write);

    if (criticalWrite) {
      void this.writeTail.catch((error: unknown) => {
        this.criticalWriteFailure ??= error;
      });
    }

    return this.writeTail;
  }

  beginDeletionFreeze(): void {
    this.deletionFrozen = true;
    this.sealed = false;
    this.criticalWriteFailure = undefined;
    this.criticalExpectedWrites.clear();
  }

  seal(): void {
    this.sealed = true;
  }

  isSealed(): boolean {
    return this.sealed;
  }

  async drain(): Promise<void> {
    await this.writeTail.catch(() => undefined);
    if (this.criticalWriteFailure !== undefined) throw this.criticalWriteFailure;
    if (this.criticalExpectedWrites.size === 0) {
      throw new Error(ACCOUNT_DELETION_ANALYTICS_STORAGE_UNVERIFIED);
    }
    for (const key of this.observedKeys) {
      if (!this.criticalExpectedWrites.has(key)) {
        throw new Error(ACCOUNT_DELETION_ANALYTICS_STORAGE_UNVERIFIED);
      }
    }
    for (const [key, expected] of this.criticalExpectedWrites) {
      if ((await this.backend.getItem(key)) !== expected) {
        throw new Error(ACCOUNT_DELETION_ANALYTICS_STORAGE_UNVERIFIED);
      }
    }
  }
}

export function createDeletionAwarePostHogStorage(): DeletionAwarePostHogStorage {
  return new DeletionAwarePostHogStorage();
}
