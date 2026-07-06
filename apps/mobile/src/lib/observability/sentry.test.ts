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
    expect(source).toContain('transaction: undefined');
    expect(source).toContain("value: 'redacted_exception'");
    expect(source).not.toContain('env.appEnvironment === \'production\' ? 0.05 : 0.1');
  });

  it('redacts automatic event payload fields before upload', () => {
    const event = {
      breadcrumbs: [{ message: 'opened /shelf/retinol?barcode=0123456789012' }],
      contexts: { route: { params: { productId: 'retinol' } } },
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
      message: 'raw provider message with person@example.com',
      request: { url: 'https://api.example.com?token=secret' },
      tags: {
        app_environment: 'development',
        route: '/progress/photo-123',
      },
      transaction: '/progress/photo-123',
      user: {
        email: 'person@example.com',
        id: 'u_1234567890abcdef1234567890abcdef',
      },
    } as unknown as Parameters<typeof sanitizeSentryEvent>[0];

    const safe = sanitizeSentryEvent(event);

    expect(safe.message).toBe('redacted_exception');
    expect(safe.breadcrumbs).toBeUndefined();
    expect(safe.contexts).toBeUndefined();
    expect(safe.fingerprint).toBeUndefined();
    expect(safe.request).toBeUndefined();
    expect(safe.transaction).toBeUndefined();
    expect(safe.exception?.values).toEqual([{ type: 'TypeError', value: 'redacted_exception' }]);
    expect(safe.extra).toEqual({ source: 'settings', nested: { mode: 'restore' } });
    expect(safe.tags).toEqual({ app_environment: 'development' });
    expect(safe.user).toEqual({ id: 'u_1234567890abcdef1234567890abcdef' });
  });
});
