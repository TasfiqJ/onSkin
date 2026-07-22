import { describe, expect, it } from 'vitest';

import { sanitizeCapturedException, sanitizeObservabilityContext } from './scrub';

describe('observability context allowlist', () => {
  it('keeps only the sole fixed content-free context value', () => {
    expect(sanitizeObservabilityContext({ source: 'phase2-runbook' })).toEqual({
      source: 'phase2-runbook',
    });
    expect(sanitizeObservabilityContext({ source: 'settings' })).toEqual({});
    expect(sanitizeObservabilityContext({ customer_segment: 'literal' })).toEqual({});
  });

  it('drops nested, array, boolean, numeric, and app-supplied date values', () => {
    expect(
      sanitizeObservabilityContext({
        source: { value: 'phase2-runbook' },
        nested: { source: 'phase2-runbook' },
        values: ['phase2-runbook'],
        count: 2,
        enabled: true,
        moment: new Date('2026-07-06T10:00:00.000Z'),
      }),
    ).toEqual({});
  });

  it('drops URL, path, contact, health, and free-text values under approved or unknown keys', () => {
    for (const value of [
      'https://example.com/path?token=secret',
      'file:///var/mobile/photo.jpg',
      '/private/var/mobile/photo.jpg',
      'C:\\Users\\person\\photo.jpg',
      '\\\\server\\share',
      'person@example.com',
      '+1-416-555-0199',
      '123 Main Street',
      'eczema',
      'rosacea',
      'acne',
      'allergy',
      'medication',
      'breastfeeding',
      'my routine is broken',
    ]) {
      expect(sanitizeObservabilityContext({ source: value, unknown: value })).toEqual({});
    }
  });

  it('does not invoke accessors and contains hostile proxy traps', () => {
    let getterCalls = 0;
    const getter = Object.defineProperty({}, 'source', {
      enumerable: true,
      get: () => {
        getterCalls += 1;
        throw new Error('raw getter value');
      },
    });
    let proxyTrapCalls = 0;
    const proxy = new Proxy(
      {},
      {
        ownKeys: () => {
          proxyTrapCalls += 1;
          throw new Error('raw proxy value');
        },
      },
    );

    expect(() => sanitizeObservabilityContext(getter)).not.toThrow();
    expect(sanitizeObservabilityContext(getter)).toEqual({});
    expect(getterCalls).toBe(0);
    expect(() => sanitizeObservabilityContext(proxy)).not.toThrow();
    expect(sanitizeObservabilityContext(proxy)).toEqual({});
    expect(proxyTrapCalls).toBeGreaterThan(0);
  });
});

describe('captured exception sanitizer', () => {
  it('redacts messages and preserves only fixed built-in exception classes', () => {
    const raw = new TypeError('jwt=secret person@example.com file:///var/mobile/photo.jpg');
    Object.defineProperty(raw, 'stack', {
      configurable: true,
      value: [
        'TypeError: person@example.com',
        '    at eczemaDiagnosis (app:///index.jsbundle:120:14)',
        '    at privateFrame (file:///private/var/mobile/photo.js:9:2)',
        '    at moduleFn (webpack:///main.bundle:44:3)',
      ].join('\n'),
      writable: true,
    });
    const safe = sanitizeCapturedException(raw);

    expect(safe).toBeInstanceOf(Error);
    expect(safe).not.toBe(raw);
    expect(safe.name).toBe('TypeError');
    expect(safe.message).toBe('redacted_exception');
    expect(safe.stack).toBe(
      'TypeError: redacted_exception\n    at app:///index.jsbundle:120:14\n    at webpack:///main.bundle:44:3',
    );
    expect(safe.stack ?? '').not.toContain('person@example.com');
    expect(safe.stack ?? '').not.toContain('photo.jpg');
    expect(safe.stack ?? '').not.toContain('eczemaDiagnosis');
    expect(safe.stack ?? '').not.toContain('privateFrame');
  });

  it('falls back to Error for custom, health-bearing, primitive, or accessor names', () => {
    const custom = new Error('provider failed');
    custom.name = 'EczemaFlareError';
    const getter = Object.defineProperty(new Error('provider failed'), 'name', {
      get: () => {
        throw new Error('raw getter value');
      },
    });

    expect(sanitizeCapturedException(custom).name).toBe('Error');
    expect(sanitizeCapturedException('plain string').name).toBe('Error');
    expect(() => sanitizeCapturedException(getter)).not.toThrow();
    expect(sanitizeCapturedException(getter).name).toBe('Error');
  });

  it('classifies built-ins without invoking a hostile constructor accessor', () => {
    let constructorGetterCalls = 0;
    const hostile = Object.defineProperty(new TypeError('provider failed'), 'constructor', {
      get: () => {
        constructorGetterCalls += 1;
        throw new Error('raw constructor value');
      },
    });

    expect(() => sanitizeCapturedException(hostile)).not.toThrow();
    expect(sanitizeCapturedException(hostile).name).toBe('TypeError');
    expect(constructorGetterCalls).toBe(0);
  });

  it('does not invoke a hostile stack accessor or leak scrubber coordinates', () => {
    let stackGetterCalls = 0;
    const hostile = Object.defineProperty(new Error('provider failed'), 'stack', {
      configurable: true,
      get: () => {
        stackGetterCalls += 1;
        throw new Error('person@example.com');
      },
    });

    const safe = sanitizeCapturedException(hostile);
    expect(stackGetterCalls).toBe(0);
    expect(safe.stack).toBe('Error: redacted_exception');
    expect(safe.stack).not.toContain('scrub');
  });
});
