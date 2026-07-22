import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, expect, it, vi } from 'vitest';

import { sanitizeSentryEvent } from './sentry';

vi.mock('@sentry/react-native', () => ({
  captureException: vi.fn(),
  init: vi.fn(),
  setTag: vi.fn(),
  setUser: vi.fn(),
}));

vi.mock('react-native', () => ({
  Platform: { OS: 'ios' },
}));

const SENTRY_SOURCE = fileURLToPath(new URL('./sentry.ts', import.meta.url));
const METRO_CONFIG_SOURCE = fileURLToPath(new URL('../../../metro.config.js', import.meta.url));

describe('Sentry privacy configuration', () => {
  it('keeps automatic sensitive capture surfaces disabled', () => {
    const source = readFileSync(SENTRY_SOURCE, 'utf8');
    const metroConfig = readFileSync(METRO_CONFIG_SOURCE, 'utf8');

    expect(metroConfig).toContain('includeWebReplay: false');
    expect(source).toContain('sendDefaultPii: false');
    expect(source).toContain('tracesSampleRate: 0');
    expect(source).toContain('enableCaptureFailedRequests: false');
    expect(source).toContain('attachScreenshot: false');
    expect(source).toContain('attachViewHierarchy: false');
    expect(source).toContain('maxBreadcrumbs: 0');
    expect(source).toContain('beforeBreadcrumb: () => null');
    expect(source).toContain('beforeSend: sanitizeSentryEvent');
    expect(source).toContain('request: undefined');
    expect(source).toContain('breadcrumbs: undefined');
    expect(source).toContain('contexts: undefined');
    expect(source).toContain('fingerprint: undefined');
    expect(source).toContain('debug_meta: sanitizeSentryDebugMeta');
    expect(source).toContain('sanitizeSentryStacktrace');
    expect(source).toContain('logentry: undefined');
    expect(source).toContain('measurements: undefined');
    expect(source).toContain('modules: undefined');
    expect(source).toContain('sdkProcessingMetadata: undefined');
    expect(source).toContain('server_name: undefined');
    expect(source).toContain('spans: undefined');
    expect(source).toContain('threads: undefined');
    expect(source).toContain('transaction: undefined');
    expect(source).toContain('transaction_info: undefined');
    expect(source).toContain("value: 'redacted_exception'");
    expect(source).not.toContain("env.appEnvironment === 'production' ? 0.05 : 0.1");
  });

  it('redacts automatic event payload fields before upload', () => {
    const event = {
      breadcrumbs: [{ message: 'opened /shelf/retinol?barcode=0123456789012' }],
      contexts: { route: { params: { productId: 'retinol' } } },
      debug_meta: { images: [{ code_file: 'file:///var/mobile/photo.js' }] },
      exception: {
        values: [
          {
            type: 'TypeError',
            value: 'jwt=secret person@example.com file:///var/mobile/photo.jpg',
          },
        ],
      },
      extra: {
        productName: 'Night Retinol',
        source: 'phase2-runbook',
        customer_segment: 'literal',
        nested: { mode: 'restore', url: 'https://example.com/?token=secret' },
      },
      fingerprint: ['/progress/photo-123'],
      logentry: {
        message: 'opened /ask?prompt=retinol',
        params: ['person@example.com'],
      },
      measurements: { cls: { value: 1 } },
      message: 'raw provider message with person@example.com',
      modules: { 'private-module': '1.0.0' },
      request: { url: 'https://api.example.com?token=secret' },
      sdkProcessingMetadata: { request: { url: 'https://example.com/?token=secret' } },
      server_name: 'person-iphone',
      spans: [{ description: '/progress/photo-123' }],
      tags: {
        app_environment: 'development',
        route: '/progress/photo-123',
      },
      threads: {
        values: [{ stacktrace: { frames: [{ filename: 'file:///var/mobile/photo.jpg' }] } }],
      },
      transaction: '/progress/photo-123',
      transaction_info: { source: 'route' },
      customer_contact: 'person@example.com',
      user: {
        email: 'person@example.com',
        id: 'u_1234567890abcdef1234567890abcdef',
      },
    } as unknown as Parameters<typeof sanitizeSentryEvent>[0];

    const safe = sanitizeSentryEvent(event);

    expect(safe.message).toBe('redacted_exception');
    expect(safe.breadcrumbs).toBeUndefined();
    expect(safe.contexts).toBeUndefined();
    expect(safe.debug_meta).toBeUndefined();
    expect(safe.fingerprint).toBeUndefined();
    expect(safe.logentry).toBeUndefined();
    expect(safe.measurements).toBeUndefined();
    expect(safe.modules).toBeUndefined();
    expect(safe.request).toBeUndefined();
    expect(safe.sdkProcessingMetadata).toBeUndefined();
    expect(safe.server_name).toBeUndefined();
    expect(safe.spans).toBeUndefined();
    expect(safe.threads).toBeUndefined();
    expect(safe.transaction).toBeUndefined();
    expect(safe.transaction_info).toBeUndefined();
    expect(safe).not.toHaveProperty('customer_contact');
    expect(safe.exception?.values).toEqual([{ type: 'TypeError', value: 'redacted_exception' }]);
    expect(safe.extra).toEqual({ source: 'phase2-runbook' });
    expect(safe.tags).toEqual({ app_environment: 'development' });
    expect(safe.user).toEqual({ id: 'u_1234567890abcdef1234567890abcdef' });
  });

  it('fails unknown, nested, and raw-looking tags and extra closed', () => {
    const safe = sanitizeSentryEvent({
      exception: { values: [{ type: 'EczemaFlareError', value: 'raw health detail' }] },
      extra: {
        source: 'https://example.com/?token=secret',
        unknown: 'person@example.com',
        nested: { source: 'phase2-runbook' },
        count: 10_001,
      },
      tags: {
        app_environment: 'person@example.com',
        route: '/progress/photo-123',
      },
    } as unknown as Parameters<typeof sanitizeSentryEvent>[0]);

    expect(safe.extra).toBeUndefined();
    expect(safe.tags).toBeUndefined();
    expect(safe.exception?.values).toEqual([{ type: 'Error', value: 'redacted_exception' }]);
  });

  it('does not invoke throwing event, tag, extra, user, or exception accessors', () => {
    const throwing = (key: string) =>
      Object.defineProperty({}, key, {
        enumerable: true,
        get: () => {
          throw new Error(`raw ${key}`);
        },
      });
    const event = {
      exception: throwing('values'),
      extra: throwing('source'),
      tags: throwing('app_environment'),
      user: throwing('id'),
    } as unknown as Parameters<typeof sanitizeSentryEvent>[0];

    expect(() => sanitizeSentryEvent(event)).not.toThrow();
    const safe = sanitizeSentryEvent(event);
    expect(safe.extra).toBeUndefined();
    expect(safe.tags).toBeUndefined();
    expect(safe.user).toBeUndefined();
    expect(safe.exception?.values).toEqual([{ type: 'Error', value: 'redacted_exception' }]);
  });

  it('preserves only content-free stack and Mach-O fields required for symbolication', () => {
    const safe = sanitizeSentryEvent({
      event_id: '1234567890abcdef1234567890abcdef',
      environment: 'production',
      release: 'com.onskin.app@1.2.3+42',
      dist: '42',
      platform: 'javascript',
      exception: {
        values: [
          {
            type: 'TypeError',
            value: 'raw provider detail',
            stacktrace: {
              frames: [
                {
                  filename: 'app:///index.jsbundle',
                  abs_path: 'app:///index.jsbundle',
                  function: 'renderRoutine',
                  module: 'pregnancy_profile',
                  lineno: 120,
                  colno: 14,
                  in_app: true,
                  vars: { email: 'person@example.com' },
                },
                {
                  filename: 'app:///person@example.com/eczema.js',
                  function: 'eczemaDiagnosis',
                  module: 'pregnancy_profile',
                  lineno: 2,
                },
                { filename: 'file:///var/mobile/private.js', lineno: 1 },
              ],
            },
          },
        ],
      },
      debug_meta: {
        images: [
          {
            type: 'macho',
            debug_id: '12345678-1234-1234-1234-1234567890ab',
            code_id: '1234567890abcdef',
            code_file: '/private/var/containers/Bundle/Application/UUID/OnSkin',
            image_addr: '0x100000000',
            image_size: 4096,
            raw_path: 'person@example.com',
          },
          {
            type: 'sourcemap',
            debug_id: 'abcdefab-1234-1234-1234-abcdefabcdef',
            code_file: 'app:///index.jsbundle',
            raw_path: 'person@example.com',
          },
        ],
      },
    } as unknown as Parameters<typeof sanitizeSentryEvent>[0]);

    expect(safe).toMatchObject({
      event_id: '1234567890abcdef1234567890abcdef',
      environment: 'production',
      release: 'com.onskin.app@1.2.3+42',
      dist: '42',
      platform: 'javascript',
      exception: {
        values: [
          {
            type: 'TypeError',
            value: 'redacted_exception',
            stacktrace: {
              frames: [
                {
                  filename: 'app:///index.jsbundle',
                  abs_path: 'app:///index.jsbundle',
                  lineno: 120,
                  colno: 14,
                  in_app: true,
                },
              ],
            },
          },
        ],
      },
      debug_meta: {
        images: [
          {
            type: 'macho',
            debug_id: '12345678-1234-1234-1234-1234567890ab',
            code_id: '1234567890abcdef',
            code_file: 'OnSkin',
            image_addr: '0x100000000',
            image_size: 4096,
          },
          {
            type: 'sourcemap',
            debug_id: 'abcdefab-1234-1234-1234-abcdefabcdef',
            code_file: 'app:///index.jsbundle',
          },
        ],
      },
    });
    expect(JSON.stringify(safe)).not.toMatch(
      /person@example\.com|private\.js|raw_path|vars|eczemaDiagnosis|pregnancy_profile/,
    );
  });

  it('preserves an allowed recovery image after more than 64 irrelevant images', () => {
    const safe = sanitizeSentryEvent({
      debug_meta: {
        images: [
          ...Array.from({ length: 65 }, (_, index) => ({
            type: 'elf',
            code_file: `/private/irrelevant-${index}`,
          })),
          {
            type: 'macho',
            debug_id: '12345678-1234-1234-1234-1234567890ab',
            image_addr: '0x100000000',
            image_size: 4096,
          },
          {
            type: 'sourcemap',
            debug_id: 'abcdefab-1234-1234-1234-abcdefabcdef',
            code_file: 'app:///index.jsbundle',
          },
        ],
      },
    } as unknown as Parameters<typeof sanitizeSentryEvent>[0]);

    expect(safe.debug_meta?.images).toEqual([
      {
        type: 'macho',
        debug_id: '12345678-1234-1234-1234-1234567890ab',
        image_addr: '0x100000000',
        image_size: 4096,
      },
      {
        type: 'sourcemap',
        code_file: 'app:///index.jsbundle',
        debug_id: 'abcdefab-1234-1234-1234-abcdefabcdef',
      },
    ]);
  });

  it('never reads or preserves unknown top-level accessors and fails hostile proxies closed', () => {
    let getterCalls = 0;
    const event = Object.defineProperty(
      { exception: { values: [{ type: 'Error' }] } },
      'customer_contact',
      {
        enumerable: true,
        get: () => {
          getterCalls += 1;
          return 'person@example.com';
        },
      },
    ) as unknown as Parameters<typeof sanitizeSentryEvent>[0];
    const proxy = new Proxy(
      {},
      {
        getOwnPropertyDescriptor: () => {
          throw new Error('raw proxy value');
        },
      },
    ) as Parameters<typeof sanitizeSentryEvent>[0];

    const safe = sanitizeSentryEvent(event);
    expect(getterCalls).toBe(0);
    expect(safe).not.toHaveProperty('customer_contact');
    expect(() => sanitizeSentryEvent(proxy)).not.toThrow();
    expect(JSON.stringify(sanitizeSentryEvent(proxy))).not.toContain('raw proxy value');
  });

  it('fails revoked exception and debug-image array proxies closed', () => {
    const exceptionValues = Proxy.revocable([], {});
    const debugImages = Proxy.revocable([], {});
    exceptionValues.revoke();
    debugImages.revoke();
    const event = {
      exception: { values: exceptionValues.proxy },
      debug_meta: { images: debugImages.proxy },
    } as unknown as Parameters<typeof sanitizeSentryEvent>[0];

    expect(() => sanitizeSentryEvent(event)).not.toThrow();
    expect(sanitizeSentryEvent(event)).toMatchObject({
      debug_meta: undefined,
      exception: { values: [{ type: 'Error', value: 'redacted_exception' }] },
    });
  });
});
