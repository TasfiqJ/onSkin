import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, expect, it, vi } from 'vitest';

import { sanitizeSentryEvent } from './sentry';

vi.mock('@sentry/react-native', () => ({
  captureException: vi.fn(),
  init: vi.fn(),
  setTag: vi.fn(),
}));

vi.mock('react-native', () => ({
  Platform: { OS: 'ios' },
}));

const SENTRY_SOURCE = fileURLToPath(new URL('./sentry.ts', import.meta.url));

describe('Sentry privacy configuration', () => {
  it('keeps automatic sensitive capture surfaces disabled', () => {
    const source = readFileSync(SENTRY_SOURCE, 'utf8');

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
    expect(source).toContain('debug_meta: undefined');
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
    expect(source).toContain('user: undefined');
    expect(source).not.toContain('Sentry.setUser');
    expect(source).not.toContain('pseudonymousUserId');
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
        source: 'settings',
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
    expect(safe.exception?.values).toEqual([{ type: 'TypeError', value: 'redacted_exception' }]);
    expect(safe.extra).toEqual({ source: 'settings', nested: { mode: 'restore' } });
    expect(safe.tags).toEqual({ app_environment: 'development' });
    expect(safe.user).toBeUndefined();
  });
});
