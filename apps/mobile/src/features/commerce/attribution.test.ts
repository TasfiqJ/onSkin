import { describe, expect, it } from 'vitest';

import {
  ATTRIBUTION_PARAM,
  buildOutboundUrl,
  HEALTH_DENYLIST,
  isHealthSafePayload,
  urlLeaksHealthData,
  type ClickPayload,
} from './attribution';

describe('COM-01A outbound attribution', () => {
  it('cannot construct a retailer URL from any URL or token', () => {
    expect(buildOutboundUrl('https://retailer.example/p/1', 'tok123')).toBeNull();
    expect(buildOutboundUrl('https://retailer.example/p?x=1', 'tok123')).toBeNull();
    expect(buildOutboundUrl('onskin://retailer/path', 'tok123')).toBeNull();
  });

  it('does not inspect adversarial URL or token inputs', () => {
    const value = new Proxy(
      {},
      {
        get() {
          throw new Error('outbound input was inspected');
        },
      },
    );

    expect(buildOutboundUrl(value as never, value as never)).toBeNull();
  });

  it('retains compatibility constants without using them to construct a tokenized URL', () => {
    expect(ATTRIBUTION_PARAM).toBe('oref');
    expect(HEALTH_DENYLIST).toContain('concern');
    expect(buildOutboundUrl.length).toBe(2);
  });
});

describe('health-leak diagnostics', () => {
  it('still detects health-adjacent terms for cleanup and safety auditing', () => {
    expect(urlLeaksHealthData('https://r.example/p?concern=acne')).toBe(true);
    expect(urlLeaksHealthData('https://r.example/p?pregnancy=true')).toBe(true);
    expect(urlLeaksHealthData('https://r.example/p?baumann=DSPT')).toBe(true);
    expect(urlLeaksHealthData('https://r.example/p?oref=opaque-token')).toBe(false);
  });
});

describe('COM-01A click payload admission', () => {
  it('rejects a formerly valid content-free click payload', () => {
    const payload: ClickPayload = {
      clickToken: 'opaque_123',
      productType: 'mineral_spf',
      source: 'none',
      consented: true,
    };

    expect(isHealthSafePayload(payload as unknown as Record<string, unknown>)).toBe(false);
  });

  it('does not inspect an adversarial payload', () => {
    const payload = new Proxy(
      {},
      {
        ownKeys() {
          throw new Error('click payload was inspected');
        },
        get() {
          throw new Error('click payload was inspected');
        },
      },
    );

    expect(isHealthSafePayload(payload)).toBe(false);
  });
});
