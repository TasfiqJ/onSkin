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
        nested: {
          mode: 'restore',
          message: 'receipt payload',
          value: 'ok',
        },
      }),
    ).toEqual({ stage: 'paywall', nested: { mode: 'restore', value: 'ok' } });
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
