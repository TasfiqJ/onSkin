import type {
  PostHog,
  PostHogCustomAppProperties,
  PostHogPersistedProperty,
} from 'posthog-react-native';
import { describe, expect, it, vi } from 'vitest';

import {
  createPostHogRuntimeOptions,
  installPostHogQueueRetention,
  POSTHOG_RUNTIME_POLICY,
} from './posthogRuntimePolicy';

describe('PostHog runtime queue policy', () => {
  it('fixes bounded event batching, persistence, retry, and request timing', () => {
    const storage = { getItem: vi.fn(() => null), setItem: vi.fn() };
    const options = createPostHogRuntimeOptions(storage, false);

    expect(POSTHOG_RUNTIME_POLICY).toEqual({
      fetchRetryCount: 1,
      fetchRetryDelayMs: 1_000,
      flushAt: 20,
      flushIntervalMs: 30_000,
      maxBatchSize: 50,
      maxQueueSize: 256,
      requestTimeoutMs: 8_000,
    });
    expect(options).toMatchObject({
      customStorage: storage,
      disabled: false,
      fetchRetryCount: 1,
      fetchRetryDelay: 1_000,
      flushAt: 20,
      flushInterval: 30_000,
      maxBatchSize: 50,
      maxQueueSize: 256,
      persistence: 'file',
      requestTimeout: 8_000,
    });
  });

  it('keeps automatic lifecycle capture, replay, logs, errors, surveys, and flags off', () => {
    const options = createPostHogRuntimeOptions(
      { getItem: () => null, setItem: () => undefined },
      false,
    );

    expect(options).toMatchObject({
      captureAppLifecycleEvents: false,
      disableGeoip: true,
      disableRemoteFeatureFlags: true,
      disableSurveys: true,
      enableSessionReplay: false,
      errorTracking: {
        autocapture: false,
        exceptionSteps: { enabled: false, maxBytes: 0 },
      },
      preloadFeatureFlags: false,
      sendFeatureFlagEvent: false,
      setDefaultPersonProperties: false,
    });
    const beforeSend = options.logs?.beforeSend;
    expect(typeof beforeSend).toBe('function');
    if (typeof beforeSend !== 'function') throw new Error('missing PostHog log sanitizer');
    expect(beforeSend({ body: 'private log' } as never)).toBeNull();
    expect(options.logs).toMatchObject({
      maxBufferSize: 1,
      rateCap: { maxLogs: 0, windowMs: 30_000 },
    });
  });

  it('removes device names, locale, and timezone from default SDK metadata', () => {
    const options = createPostHogRuntimeOptions(
      { getItem: () => null, setItem: () => undefined },
      false,
    );
    expect(typeof options.customAppProperties).toBe('function');
    const sanitize = options.customAppProperties;
    if (typeof sanitize !== 'function') throw new Error('missing PostHog app-property sanitizer');

    expect(
      sanitize({
        $app_build: '42',
        $app_name: 'Private Name',
        $app_version: '1.2.3',
        $device_name: 'Jasim phone',
        $device_type: 'Mobile',
        $is_emulator: false,
        $locale: 'en-CA',
        $os_name: 'iOS',
        $os_version: '18.5',
        $timezone: 'America/Toronto',
      } satisfies PostHogCustomAppProperties),
    ).toEqual({
      $app_build: '42',
      $app_version: '1.2.3',
      $device_type: 'Mobile',
      $is_emulator: false,
      $os_name: 'iOS',
      $os_version: '18.5',
    });
    expect(
      sanitize({
        $app_build: 'private_product_name',
        $os_version: 'Jasim phone',
      }),
    ).toEqual({});
  });

  it('prunes the live in-memory queue before every SDK flush', async () => {
    const row = (timestamp: string, uuid: string) => ({
      message: {
        distinct_id: '018f0000-0000-7000-8000-000000000001',
        event: 'onboarding_started',
        properties: {
          $geoip_disable: true,
          $lib: 'posthog-react-native',
          $lib_version: '4.54.4',
        },
        timestamp,
        uuid,
      },
    });
    const fresh = row(
      '2026-07-21T12:00:00.000Z',
      '018f0000-0000-7000-8000-000000000003',
    );
    let queue: unknown = [
      row('2020-01-01T00:00:00.000Z', '018f0000-0000-7000-8000-000000000002'),
      fresh,
    ];
    let queueSeenBySdk: unknown;
    const posthog = {
      flush: vi.fn(async () => {
        queueSeenBySdk = queue;
      }),
      getPersistedProperty: vi.fn(() => queue),
      setPersistedProperty: vi.fn((_key, value) => {
        queue = value;
      }),
    } as unknown as PostHog;

    installPostHogQueueRetention(
      posthog,
      'queue' as PostHogPersistedProperty,
      () => Date.parse('2026-07-21T12:00:00.000Z'),
    );
    await posthog.flush();

    expect(queue).toEqual([fresh]);
    expect(queueSeenBySdk).toEqual([fresh]);
  });
});
