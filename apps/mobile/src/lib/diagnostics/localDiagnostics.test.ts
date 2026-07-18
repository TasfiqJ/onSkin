import { describe, expect, it, vi } from 'vitest';

import {
  classifyStorageFreeSpace,
  loadLocalDiagnostics,
  resolveLocalDiagnosticsAccess,
  type LocalDiagnosticsDependencies,
} from './localDiagnostics';

function dependencies(
  overrides: Partial<LocalDiagnosticsDependencies> = {},
): LocalDiagnosticsDependencies {
  return {
    now: () => new Date('2026-07-17T15:00:00.000Z'),
    readBuild: () => ({
      environment: 'development',
      releaseVersion: '0.1.0',
      buildVersion: '42',
      runtimeVersion: 'fingerprint:abc123',
      symbolConfig: 'uploaded',
    }),
    readAccountGenerationPrefix: async () => '0123abcd',
    readVault: () => 'ready',
    readAppLock: () => 'unlocked',
    readOutbox: async () => ({
      status: 'available',
      ready: 3,
      inFlight: 0,
      dead: 0,
    }),
    readLastSync: () => ({ result: 'pending', at: '2026-07-17T14:59:00.000Z' }),
    readPhotoJournal: async () => ({ status: 'available', count: 1 }),
    readStorageFreeSpace: () => 800 * 1024 * 1024,
    readQueryCache: () => ({ total: 9, active: 3, fetching: 1, stale: 4 }),
    readNotifications: async () => ({ permission: 'granted', schedule: 'healthy' }),
    readCatalogEndpoint: async () => 'gateway_reachable',
    readStartupPhases: () => [
      { phase: 'javascript_started', elapsedMs: 0.125 },
      { phase: 'navigation_ready', elapsedMs: 187.5 },
    ],
    readTimings: () => [
      {
        name: 'private_kv_read',
        count: 4,
        errorCount: 1,
        p50Ms: 2.5,
        p95Ms: 8.75,
      },
    ],
    ...overrides,
  };
}

describe('content-free local diagnostics', () => {
  it('allows only development-compiled development or staging builds', () => {
    expect(resolveLocalDiagnosticsAccess(true, 'development')).toBe(true);
    expect(resolveLocalDiagnosticsAccess(true, 'staging')).toBe(true);
    expect(resolveLocalDiagnosticsAccess(true, 'production')).toBe(false);
    expect(resolveLocalDiagnosticsAccess(false, 'development')).toBe(false);
    expect(resolveLocalDiagnosticsAccess(false, 'staging')).toBe(false);
  });

  it('builds the fixed allowlisted snapshot without private record values', async () => {
    const snapshot = await loadLocalDiagnostics(dependencies());

    expect(snapshot).toEqual({
      schemaVersion: 2,
      capturedAt: '2026-07-17T15:00:00.000Z',
      build: {
        environment: 'development',
        releaseVersion: '0.1.0',
        buildVersion: '42',
        runtimeVersion: 'fingerprint:abc123',
        symbolConfig: 'uploaded',
      },
      accountGenerationPrefix: '0123abcd',
      vault: 'ready',
      appLock: 'unlocked',
      outbox: {
        model: 'legacy_completion_queue',
        status: 'available',
        ready: 3,
        inFlight: 0,
        dead: 0,
      },
      lastSync: { result: 'pending', at: '2026-07-17T14:59:00.000Z' },
      photoJournal: { status: 'available', pending: 1 },
      storageFreeSpace: 'ample',
      queryCache: { total: 9, active: 3, fetching: 1, stale: 4 },
      notifications: { permission: 'granted', schedule: 'healthy' },
      catalogEndpoint: 'gateway_reachable',
      startupPhases: [
        { phase: 'javascript_started', elapsedMs: 0.13 },
        { phase: 'navigation_ready', elapsedMs: 187.5 },
      ],
      timings: [
        {
          name: 'private_kv_read',
          count: 4,
          errorCount: 1,
          p50Ms: 2.5,
          p95Ms: 8.75,
        },
      ],
    });

    const keys = JSON.stringify(snapshot);
    for (const forbiddenKey of [
      'userId',
      'token',
      'secret',
      'filename',
      'searchText',
      'photoId',
      'operationId',
    ]) {
      expect(keys).not.toContain(forbiddenKey);
    }
  });

  it('isolates every failing source and never serializes errors or injected private values', async () => {
    const forbidden = [
      'user-11111111-2222-3333-4444-555555555555',
      'service-role-secret',
      'progress-photo-private.jpg',
      'retinol search text',
    ];
    const fail = vi.fn(() => {
      throw new Error(forbidden.join('|'));
    });
    const snapshot = await loadLocalDiagnostics(
      dependencies({
        now: fail,
        readBuild: () => ({
          environment: 'production',
          releaseVersion: forbidden[0],
          buildVersion: forbidden[1],
          runtimeVersion: forbidden[2],
          symbolConfig: forbidden[3],
        }),
        readAccountGenerationPrefix: async () => forbidden[0],
        readVault: fail,
        readAppLock: fail,
        readOutbox: fail,
        readLastSync: fail,
        readPhotoJournal: fail,
        readStorageFreeSpace: fail,
        readQueryCache: fail,
        readNotifications: fail,
        readCatalogEndpoint: fail,
        readStartupPhases: () => [
          { phase: forbidden[3], elapsedMs: Number.POSITIVE_INFINITY },
        ],
        readTimings: () => [
          {
            name: forbidden[3],
            count: Number.MAX_SAFE_INTEGER,
            errorCount: Number.MAX_SAFE_INTEGER,
            p50Ms: Number.POSITIVE_INFINITY,
            p95Ms: Number.NaN,
          },
        ],
      } as unknown as Partial<LocalDiagnosticsDependencies>),
    );

    expect(snapshot).toMatchObject({
      capturedAt: '1970-01-01T00:00:00.000Z',
      build: {
        environment: 'development',
        releaseVersion: 'unknown',
        buildVersion: 'unknown',
        runtimeVersion: 'unknown',
        symbolConfig: 'not_recorded',
      },
      accountGenerationPrefix: 'unavailable',
      vault: 'unavailable',
      appLock: 'unavailable',
      outbox: { status: 'unavailable', ready: 0, inFlight: 0, dead: 0 },
      lastSync: { result: 'not_run', at: null },
      photoJournal: { status: 'unavailable', pending: 0 },
      storageFreeSpace: 'unavailable',
      queryCache: { total: 0, active: 0, fetching: 0, stale: 0 },
      notifications: { permission: 'unavailable', schedule: 'unavailable' },
      catalogEndpoint: 'gateway_unreachable',
      startupPhases: [],
      timings: [],
    });
    const serialized = JSON.stringify(snapshot);
    forbidden.forEach((value) => expect(serialized).not.toContain(value));
  });

  it('reports broad disk classes without exposing exact storage bytes', () => {
    expect(classifyStorageFreeSpace(99 * 1024 * 1024)).toBe('critical');
    expect(classifyStorageFreeSpace(100 * 1024 * 1024)).toBe('low');
    expect(classifyStorageFreeSpace(500 * 1024 * 1024)).toBe('ample');
    expect(classifyStorageFreeSpace(Number.NaN)).toBe('unavailable');
  });

  it('allowlists, deduplicates, bounds, and orders startup phases', async () => {
    const snapshot = await loadLocalDiagnostics(
      dependencies({
        readStartupPhases: () => [
          { phase: 'navigation_ready', elapsedMs: 35 },
          { phase: 'javascript_started', elapsedMs: -20 },
          { phase: 'navigation_ready', elapsedMs: 99 },
          { phase: 'private_route_name', elapsedMs: 1 },
        ],
      }),
    );

    expect(snapshot.startupPhases).toEqual([
      { phase: 'javascript_started', elapsedMs: 0 },
      { phase: 'navigation_ready', elapsedMs: 35 },
    ]);
  });

  it('bounds a source that never settles and still returns a safe snapshot', async () => {
    vi.useFakeTimers();
    try {
      const pending = loadLocalDiagnostics(
        dependencies({
          readPhotoJournal: () => new Promise(() => undefined),
        }),
      );

      await vi.advanceTimersByTimeAsync(3_000);

      await expect(pending).resolves.toMatchObject({
        photoJournal: { status: 'unavailable', pending: 0 },
      });
    } finally {
      vi.useRealTimers();
    }
  });
});
