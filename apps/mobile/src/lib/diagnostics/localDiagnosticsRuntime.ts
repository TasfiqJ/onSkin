import * as Application from 'expo-application';
import Constants from 'expo-constants';
import * as Crypto from 'expo-crypto';
import { Paths } from 'expo-file-system';
import { Platform } from 'react-native';

import { readNotificationScheduleHealth, getPermissionStatus } from '@/features/notifications/deliver';
import { readPhotoMutationJournalDiagnostics } from '@/features/photos/store';
import { getAccountGeneration } from '@/lib/auth/accountGeneration';
import { env, isSupabaseConfigured } from '@/lib/env';
import {
  readCompletionQueue,
  readCompletionSyncDiagnostics,
} from '@/lib/offline/completionQueue';
import { readOperationTimingAggregates } from '@/lib/observability/operationTiming';
import { queryClient } from '@/lib/query/queryClient';

import type { LocalDiagnosticsDependencies } from './localDiagnostics';

type RuntimeDiagnosticsContext = Readonly<{
  userId: string | null;
  appLockEnabled: boolean;
  appUnlocked: boolean;
}>;

const CATALOG_GATEWAY_TIMEOUT_MS = 2_500;

function runtimeVersion(): string {
  const value = Constants.expoConfig?.runtimeVersion;
  return typeof value === 'string' ? value : 'unknown';
}

function symbolConfig(): 'not_recorded' | 'not_uploaded' | 'uploaded' {
  const value = Constants.expoConfig?.extra?.sentrySymbolsUploaded;
  return value === true ? 'uploaded' : value === false ? 'not_uploaded' : 'not_recorded';
}

async function accountGenerationPrefix(userId: string | null): Promise<'none' | string> {
  if (!userId) return 'none';
  const generation = getAccountGeneration();
  const digest = await Crypto.digestStringAsync(
    Crypto.CryptoDigestAlgorithm.SHA256,
    `local-diagnostics:v1:${generation}:${userId}`,
  );
  return digest.toLowerCase().slice(0, 8);
}

async function readOutboxDiagnostics() {
  const result = await readCompletionQueue();
  return {
    status: result.status,
    ready: result.items?.length ?? 0,
    inFlight: 0,
    dead: 0,
  };
}

function readQueryCacheDiagnostics() {
  const queries = queryClient.getQueryCache().getAll();
  return {
    total: queries.length,
    active: queries.filter((query) => query.isActive()).length,
    fetching: queries.filter((query) => query.state.fetchStatus === 'fetching').length,
    stale: queries.filter((query) => query.isStale()).length,
  };
}

async function readNotificationDiagnostics() {
  const [permission, schedule] = await Promise.all([
    getPermissionStatus().catch(() => 'unavailable' as const),
    readNotificationScheduleHealth(),
  ]);
  return { permission, schedule };
}

async function readCatalogEndpointDiagnostics(): Promise<
  'gateway_reachable' | 'gateway_unreachable' | 'not_configured'
> {
  if (!isSupabaseConfigured) return 'not_configured';
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), CATALOG_GATEWAY_TIMEOUT_MS);
  try {
    // Any HTTP response proves DNS/TLS/gateway reachability. This deliberately
    // sends no auth header, search text, barcode, product value, or account ID.
    await fetch(`${env.supabaseUrl.replace(/\/+$/, '')}/functions/v1/catalog-search`, {
      method: 'HEAD',
      signal: controller.signal,
    });
    return 'gateway_reachable';
  } catch {
    return 'gateway_unreachable';
  } finally {
    clearTimeout(timer);
  }
}

export function createLocalDiagnosticsDependencies(
  context: RuntimeDiagnosticsContext,
): LocalDiagnosticsDependencies {
  const dependencies: LocalDiagnosticsDependencies = {
    now: () => new Date(),
    readBuild: () => ({
      environment: env.appEnvironment,
      releaseVersion: Application.nativeApplicationVersion ?? Constants.expoConfig?.version ?? 'unknown',
      buildVersion: Application.nativeBuildVersion ?? 'unknown',
      runtimeVersion: runtimeVersion(),
      symbolConfig: symbolConfig(),
    }),
    readAccountGenerationPrefix: () => accountGenerationPrefix(context.userId),
    readVault: () => (context.appUnlocked ? 'ready' : 'locked'),
    readAppLock: () =>
      context.appLockEnabled ? (context.appUnlocked ? 'unlocked' : 'locked') : 'disabled',
    readOutbox: readOutboxDiagnostics,
    readLastSync: readCompletionSyncDiagnostics,
    readPhotoJournal: readPhotoMutationJournalDiagnostics,
    // Expo's web getter emits a warning before returning its unsupported
    // sentinel. Avoid touching it so the content-free fallback stays quiet.
    readStorageFreeSpace: () => (Platform.OS === 'web' ? Number.NaN : Paths.availableDiskSpace),
    readQueryCache: readQueryCacheDiagnostics,
    readNotifications: readNotificationDiagnostics,
    readCatalogEndpoint: readCatalogEndpointDiagnostics,
    readTimings: readOperationTimingAggregates,
  };

  if (
    typeof __DEV__ !== 'undefined' &&
    __DEV__ &&
    process.env.EXPO_PUBLIC_E2E_LOCAL_DIAGNOSTICS_FAILURES === 'all'
  ) {
    const fail = () => {
      throw new Error('E2E_LOCAL_DIAGNOSTICS_SOURCE_FAILURE');
    };
    return {
      now: fail,
      readBuild: fail,
      readAccountGenerationPrefix: fail,
      readVault: fail,
      readAppLock: fail,
      readOutbox: fail,
      readLastSync: fail,
      readPhotoJournal: fail,
      readStorageFreeSpace: fail,
      readQueryCache: fail,
      readNotifications: fail,
      readCatalogEndpoint: fail,
      readTimings: fail,
    };
  }

  return dependencies;
}
