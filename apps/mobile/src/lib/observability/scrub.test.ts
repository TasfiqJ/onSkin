import { describe, expect, it } from 'vitest';

import { sanitizeCapturedException, sanitizeObservabilityContext } from './scrub';

describe('observability context scrubber', () => {
  it('drops route, URL, query, product, barcode, OCR, note, photo, receipt, and free text fields', () => {
    expect(
      sanitizeObservabilityContext({
        screen: 'settings',
        routeParams: { productId: 'prod_123' },
        url: 'https://example.com/s/abc?share_id=123',
        query: 'barcode=0123456789012',
        productName: 'Night Retinol',
        barcode: '0123456789012',
        ocrText: 'ingredients list',
        note: 'stings after use',
        photoPath: 'file:///var/mobile/photo.jpg',
        receipt: 'MIIBIjANBg',
        freeText: 'skin profile concern',
        count: 2,
      }),
    ).toEqual({ screen: 'settings', count: 2 });
  });

  it('drops sensitive-looking values even when the key is otherwise safe', () => {
    expect(
      sanitizeObservabilityContext({
        source: 'https://example.com/path?token=secret',
        reason: 'person@example.com',
        stage: 'paywall',
        moment: new Date('2026-07-06T10:00:00.000Z'),
        nested: {
          mode: 'restore',
          capturedAt: new Date('2026-07-06T10:01:00.000Z'),
          message: 'receipt payload',
          value: 'ok',
        },
      }),
    ).toEqual({ stage: 'paywall', nested: { mode: 'restore', value: 'ok' } });
  });

  it('keeps only small integer counters from numeric context', () => {
    expect(
      sanitizeObservabilityContext({
        count: 2,
        retry: -1,
        elapsed: 10_000,
        lookupValue: 12_345_678_901,
        ratio: 0.91,
        oversized: 10_001,
        invalid: Number.POSITIVE_INFINITY,
        nested: {
          attempts: 3,
          derived: 0.42,
        },
      }),
    ).toEqual({ count: 2, retry: -1, elapsed: 10_000, nested: { attempts: 3 } });
  });

  it('redacts captured exception messages and sensitive names before vendor capture', () => {
    const raw = new TypeError('jwt=secret person@example.com file:///var/mobile/photo.jpg');
    raw.name = 'TypeError';

    const safe = sanitizeCapturedException(raw);

    expect(safe).toBeInstanceOf(Error);
    expect(safe).not.toBe(raw);
    expect(safe.name).toBe('TypeError');
    expect(safe.message).toBe('redacted_exception');
    expect(safe.message).not.toContain('jwt');
    expect(safe.stack ?? '').not.toContain('person@example.com');
    expect(safe.stack ?? '').not.toContain('photo.jpg');
  });

  it('falls back to a generic exception name when the original name is sensitive', () => {
    const raw = new Error('provider failed');
    raw.name = 'file:///data/user/0/token';

    expect(sanitizeCapturedException(raw).name).toBe('Error');
    expect(sanitizeCapturedException('plain string').name).toBe('string');
  });
});
