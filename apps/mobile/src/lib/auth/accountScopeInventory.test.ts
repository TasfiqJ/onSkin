import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

const SRC_DIR = fileURLToPath(new URL('../../', import.meta.url));

function productionSources(directory = SRC_DIR): string[] {
  return readdirSync(directory).flatMap((name) => {
    const path = join(directory, name);
    if (statSync(path).isDirectory()) return productionSources(path);
    if (!/\.[cm]?[jt]sx?$/.test(name) || /\.(?:test|spec)\.[cm]?[jt]sx?$/.test(name)) {
      return [];
    }
    return [path];
  });
}

function normalized(path: string): string {
  return relative(SRC_DIR, path).replaceAll('\\', '/');
}

function source(path: string): string {
  return readFileSync(path, 'utf8');
}

const SUPABASE_CLIENT_FILES = [
  'features/commerce/store.ts',
  'features/commerce/useCommerce.ts',
  'features/onboarding/OnboardingContext.tsx',
  'features/onboarding/onboardingStatusQuery.ts',
  'features/photos/store.ts',
  'features/routine/useProgress.ts',
  'features/scheduler/profile.ts',
  'features/settings/actions.ts',
  'features/subscription/store.ts',
  'features/trend/consent.ts',
  'features/trend/useTrend.ts',
  'lib/network/edgeFunctions.ts',
  'lib/offline/completionQueue.ts',
  'lib/offline/outbox.ts',
] as const;

const ABORTABLE_ACCOUNT_DATA_FILES = SUPABASE_CLIENT_FILES.filter(
  (path) => path !== 'features/settings/actions.ts' && path !== 'lib/network/edgeFunctions.ts',
);

const RAW_DURABLE_STORAGE_FILES = [
  'features/photos/encryptedStorage.ts',
  'lib/analytics/posthogDurableStorage.ts',
  'lib/auth/accountDeletionVendorFreeze.ts',
  'lib/auth/accountIsolationE2E.ts',
  'lib/auth/sessionOwner.ts',
  'lib/storage/plaintextStaging.ts',
  'lib/storage/privateKV.ts',
  'lib/storage/privateKVContentKey.ts',
  'lib/storage/privateSecureStore.ts',
  'lib/supabase/largeSecureStore.ts',
] as const;

const RAW_FILE_SYSTEM_FILES = [
  'features/growth/shareCard.ts',
  'features/photos/analyzePhotoLighting.ts',
  'features/photos/captureStaging.ts',
  'features/photos/encryptedStorage.ts',
  'features/settings/actions.ts',
  'features/settings/localPrivateData.ts',
  'lib/analytics/posthogDurableStorage.ts',
  'lib/diagnostics/localDiagnosticsRuntime.ts',
  'lib/storage/plaintextStaging.ts',
] as const;

describe('account-sensitive production gateway inventory', () => {
  const files = productionSources();

  it('freezes every direct Supabase client owner and its account-generation boundary', () => {
    const directClientFiles = files
      .filter((path) => source(path).includes("from '@/lib/supabase/client'"))
      .map(normalized)
      .sort();

    expect(directClientFiles).toEqual([...SUPABASE_CLIENT_FILES].sort());

    for (const relativePath of SUPABASE_CLIENT_FILES) {
      if (relativePath === 'lib/network/edgeFunctions.ts') continue;
      const text = source(join(SRC_DIR, relativePath));
      expect(text, relativePath).toMatch(/run(?:AccountGeneration|OwnerQuery)Operation/);
      expect(text, relativePath).toContain('.assertCurrent()');
    }

    for (const relativePath of ABORTABLE_ACCOUNT_DATA_FILES) {
      expect(source(join(SRC_DIR, relativePath)), relativePath).toContain('.abortSignal(');
    }

    const edgeFunctions = source(join(SRC_DIR, 'lib/network/edgeFunctions.ts'));
    expect(edgeFunctions).toContain('runRequest');
    expect(edgeFunctions).toContain('ownerLease');
    expect(edgeFunctions).toContain('requireAuthenticatedAccountSession(ownerLease)');
    expect(edgeFunctions).toContain('signal,');

    const settingsActions = source(join(SRC_DIR, 'features/settings/actions.ts'));
    expect(settingsActions).toContain('runAccountGenerationOperation');
    expect(settingsActions).toContain('completeLocalSignOut');
  });

  it('keeps account-aware vendor runtimes behind their single owned adapters', () => {
    const postHogRuntimeFiles = files
      .filter((path) => source(path).includes("import('posthog-react-native')"))
      .map(normalized);
    const revenueCatRuntimeFiles = files
      .filter((path) => source(path).includes("import('react-native-purchases')"))
      .map(normalized);

    expect(postHogRuntimeFiles).toEqual(['lib/analytics/track.ts']);
    expect(revenueCatRuntimeFiles).toEqual(['lib/iap/revenuecat.ts']);

    const analytics = source(join(SRC_DIR, postHogRuntimeFiles[0]!));
    expect(analytics).toContain('runAccountGenerationOperation');
    expect(analytics).toContain('awaitAccountGenerationLease');
    expect(analytics).toContain('accountDeletionVendorWritesBlocked');

    const revenueCat = source(join(SRC_DIR, revenueCatRuntimeFiles[0]!));
    expect(revenueCat).toContain('RevenueCatOwnerCoordinator');
    expect(revenueCat).toContain('createRevenueCatOperationBarrier');
    expect(revenueCat).toContain('AccountGenerationLease');
  });

  it('freezes raw durable-storage and filesystem gateway ownership', () => {
    const rawStorageFiles = files
      .filter((path) => {
        const text = source(path);
        return (
          text.includes('@react-native-async-storage/async-storage') ||
          text.includes("from 'expo-secure-store'")
        );
      })
      .map(normalized)
      .sort();
    const rawFileSystemFiles = files
      .filter((path) => source(path).includes('expo-file-system'))
      .map(normalized)
      .sort();

    expect(rawStorageFiles).toEqual([...RAW_DURABLE_STORAGE_FILES].sort());
    expect(rawFileSystemFiles).toEqual([...RAW_FILE_SYSTEM_FILES].sort());

    const privateKV = source(join(SRC_DIR, 'lib/storage/privateKV.ts'));
    expect(privateKV).toContain('runAccountScopedPrivateRead');
    expect(privateKV).toContain('runAccountScopedPrivateMutation');
    expect(privateKV).toContain('beginPrivateKVAccountBoundary');

    const photos = source(join(SRC_DIR, 'features/photos/encryptedStorage.ts'));
    expect(photos).toContain('runAccountScopedPhotoRead');
    expect(photos).toContain('runAccountScopedPhotoMutation');
    expect(photos).toContain('beginEncryptedPhotoAccountBoundary');

    const sessionOwner = source(join(SRC_DIR, 'lib/auth/sessionOwner.ts'));
    expect(sessionOwner).toContain('LOCAL_DATA_OWNER_HASH_KEY');
    expect(sessionOwner).toContain('LOCAL_DATA_CLEANUP_REQUIRED_KEY');

    const secureStore = source(join(SRC_DIR, 'lib/storage/privateSecureStore.ts'));
    expect(secureStore).toContain('WHEN_UNLOCKED_THIS_DEVICE_ONLY');
  });
});
