import { describe, expect, it } from 'vitest';

import {
  ATTRIBUTION_PARAM,
  buildOutboundUrl,
  HEALTH_DENYLIST,
  isHealthSafePayload,
  urlLeaksHealthData,
  type ClickPayload,
} from './attribution';

// The attribution trust-guard (docs/10 §5/§7). The MHMDA research is decisive:
// inferred skincare-concern data is regulated consumer health data, and a "where to
// buy" hand-off must carry ONLY an opaque token. NEVER a health-adjacent attribute.
// This is the structural, tested guarantee (Doc 10's analogue of the docs/09
// "FIT score has no commercial input" test).

describe('the outbound URL carries ONLY an opaque token. Never skin data', () => {
  it('appends exactly one param (the opaque ref) to a clean base', () => {
    expect(buildOutboundUrl('https://example.com/p/1', 'tok123')).toBe('https://example.com/p/1?oref=tok123');
  });

  it('uses & when the base already has a query', () => {
    expect(buildOutboundUrl('https://example.com/p?x=1', 'tok123')).toBe('https://example.com/p?x=1&oref=tok123');
  });

  it('rejects unsafe external handoff URLs before adding the token', () => {
    expect(buildOutboundUrl('onskin://retailer/path', 'tok123')).toBeNull();
    expect(buildOutboundUrl('https://user:pass@example.com/p', 'tok123')).toBeNull();
    expect(buildOutboundUrl('http://example.com/p', 'tok123')).toBeNull();
  });

  it('the portion WE add is only the attribution param. No profile/concern/goal', () => {
    const base = 'https://example.com/p/demo';
    const final = buildOutboundUrl(base, 'opaque-abc');
    expect(final).not.toBeNull();
    if (!final) return;
    const delta = final.slice(base.length); // exactly what we appended
    expect(delta).toBe('?oref=opaque-abc');
    expect(urlLeaksHealthData(delta)).toBe(false);
    expect(ATTRIBUTION_PARAM).toBe('oref'); // deliberately not a "skin"-containing key
  });

  it('the structural guarantee: buildOutboundUrl accepts no profile/health argument', () => {
    // (url, token) only. Health data cannot be attached even by mistake.
    expect(buildOutboundUrl.length).toBe(2);
  });
});

describe('the health-leak detector catches a leaked attribute', () => {
  it('flags a URL carrying a concern/condition parameter', () => {
    expect(urlLeaksHealthData('https://r.example/p?concern=acne')).toBe(true);
    expect(urlLeaksHealthData('https://r.example/p?pregnancy=true')).toBe(true);
    expect(urlLeaksHealthData('https://r.example/p?baumann=DSPT')).toBe(true);
  });
  it('passes a clean opaque-token URL', () => {
    expect(urlLeaksHealthData('https://r.example/p?oref=opaque-token')).toBe(false);
  });
  it('the denylist covers the core MHMDA-sensitive terms', () => {
    for (const t of ['concern', 'acne', 'pregnan', 'profile', 'photo']) {
      expect(HEALTH_DENYLIST).toContain(t);
    }
  });
});

describe('the persisted click payload never carries surprise commerce data', () => {
  it('accepts the content-free click payload (token / type / source / consent)', () => {
    const payload: ClickPayload = { clickToken: 'opaque_123', productType: 'mineral_spf', source: 'none', consented: true };
    expect(isHealthSafePayload(payload as unknown as Record<string, unknown>)).toBe(true);
  });
  it('accepts a null product type for rail-level click attribution', () => {
    const payload: ClickPayload = { clickToken: 'opaque_123', productType: null, source: 'direct', consented: true };
    expect(isHealthSafePayload(payload as unknown as Record<string, unknown>)).toBe(true);
  });
  it('rejects any payload that smuggles a health-adjacent key', () => {
    expect(isHealthSafePayload({ clickToken: 'x', productType: null, source: 'none', consented: true, concern: 'acne' })).toBe(
      false,
    );
    expect(
      isHealthSafePayload({ clickToken: 'x', productType: null, source: 'none', consented: true, skin_profile: 'DSPT' }),
    ).toBe(false);
  });
  it('rejects extra partner identifiers even when the key is not health-adjacent', () => {
    expect(
      isHealthSafePayload({
        clickToken: 'opaque',
        productType: 'mineral_spf',
        source: 'none',
        consented: true,
        partnerUserId: 'abc123',
      }),
    ).toBe(false);
  });
  it('rejects raw URLs, emails, bad source buckets, and malformed product types', () => {
    expect(
      isHealthSafePayload({
        clickToken: 'https://retailer.example/ref',
        productType: 'mineral_spf',
        source: 'none',
        consented: true,
      }),
    ).toBe(false);
    expect(
      isHealthSafePayload({
        clickToken: 'opaque',
        productType: 'Mineral SPF',
        source: 'none',
        consented: true,
      }),
    ).toBe(false);
    expect(
      isHealthSafePayload({
        clickToken: 'opaque',
        productType: 'mineral_spf',
        source: 'unknown_partner',
        consented: true,
      }),
    ).toBe(false);
    expect(
      isHealthSafePayload({
        clickToken: 'opaque',
        productType: 'mineral_spf',
        source: 'none',
        consented: 'true',
      }),
    ).toBe(false);
  });
});
