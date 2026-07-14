export const LEGACY_POSTHOG_STORAGE_KEYS = ['.posthog-rn.json', '.posthog-rn-logs.json'] as const;

export type PostHogPersistenceCleanupDeps = {
  documentDirectory: string | null | undefined;
  deleteFile: (uri: string) => Promise<void>;
  fileExists: (uri: string) => Promise<boolean>;
  removeStorageKeys: (keys: readonly string[]) => Promise<void>;
  readStorageKeys: (
    keys: readonly string[],
  ) => Promise<readonly (readonly [string, string | null])[]>;
};

/**
 * Removes every persistence backend used by the installed PostHog React Native
 * SDK. Both backends are attempted because the SDK can fall back from Expo File
 * System to AsyncStorage on a supported-device or dependency change.
 */
export async function purgePostHogPersistenceWithDeps(
  deps: PostHogPersistenceCleanupDeps,
): Promise<void> {
  const operations: { label: string; promise: Promise<void> }[] = [];

  if (deps.documentDirectory) {
    for (const key of LEGACY_POSTHOG_STORAGE_KEYS) {
      operations.push({
        label: key === '.posthog-rn.json' ? 'events_file' : 'logs_file',
        promise: deps.deleteFile(`${deps.documentDirectory}${key}`),
      });
    }
  }

  operations.push({
    label: 'async_storage',
    promise: deps.removeStorageKeys(LEGACY_POSTHOG_STORAGE_KEYS),
  });

  const results = await Promise.allSettled(operations.map(({ promise }) => promise));
  const failed = results.flatMap((result, index) =>
    result.status === 'rejected' ? [operations[index]!.label] : [],
  );

  const verificationOperations: { label: string; promise: Promise<void> }[] = [];
  if (deps.documentDirectory) {
    for (const key of LEGACY_POSTHOG_STORAGE_KEYS) {
      const uri = `${deps.documentDirectory}${key}`;
      verificationOperations.push({
        label: key === '.posthog-rn.json' ? 'events_file_verify' : 'logs_file_verify',
        promise: deps.fileExists(uri).then((exists) => {
          if (exists) throw new Error('POSTHOG_LOCAL_FILE_REMAINS');
        }),
      });
    }
  }

  verificationOperations.push({
    label: 'async_storage_verify',
    promise: deps.readStorageKeys(LEGACY_POSTHOG_STORAGE_KEYS).then((entries) => {
      const valueByKey = new Map(entries);
      if (
        entries.length !== LEGACY_POSTHOG_STORAGE_KEYS.length ||
        LEGACY_POSTHOG_STORAGE_KEYS.some(
          (key) => !valueByKey.has(key) || valueByKey.get(key) !== null,
        )
      ) {
        throw new Error('POSTHOG_LOCAL_ASYNC_STORAGE_REMAINS');
      }
    }),
  });

  const verificationResults = await Promise.allSettled(
    verificationOperations.map(({ promise }) => promise),
  );
  failed.push(
    ...verificationResults.flatMap((result, index) =>
      result.status === 'rejected' ? [verificationOperations[index]!.label] : [],
    ),
  );

  if (failed.length > 0) {
    throw new Error(`POSTHOG_LOCAL_PURGE_FAILED:${failed.join(',')}`);
  }
}

export async function purgeLegacyPostHogPersistence(): Promise<void> {
  const [FileSystem, asyncStorageModule] = await Promise.all([
    import('expo-file-system/legacy'),
    import('@react-native-async-storage/async-storage'),
  ]);

  await purgePostHogPersistenceWithDeps({
    documentDirectory: FileSystem.documentDirectory,
    deleteFile: (uri) => FileSystem.deleteAsync(uri, { idempotent: true }),
    fileExists: (uri) => FileSystem.getInfoAsync(uri).then((info) => info.exists),
    removeStorageKeys: (keys) => asyncStorageModule.default.multiRemove([...keys]),
    readStorageKeys: (keys) => asyncStorageModule.default.multiGet([...keys]),
  });
}
