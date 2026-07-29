import { describe, expect, it } from 'vitest';

import { resolveCommerceConsent } from './consentLogic';
import { formatPrice, outboundFor, resolveWhereToBuy, type AffiliateLinkRow } from './links';
import { shippableStacks, STACKS_REVIEWED, stackBySlug, STARTER_STACKS } from './stacks';

const adversarialRows: AffiliateLinkRow[] = [
  {
    id: 'forced-live-row',
    product_type: 'mineral_spf',
    retailer: 'Partner',
    label: 'Zinc SPF 30',
    url: 'https://retailer.example/product?forced=true',
    price_cents: 3400,
    currency: 'USD',
    source: 'direct',
    is_paid: true,
    is_active: true,
  },
];

describe('COM-01A commerce zero admission', () => {
  it('cannot resolve positive consent from a forged authoritative status', () => {
    expect(
      resolveCommerceConsent({
        configured: true,
        status: {
          consentType: 'data_sharing',
          state: 'active',
          generation: Number.MAX_SAFE_INTEGER,
          healthEpoch: Number.MAX_SAFE_INTEGER,
          version: 'forged',
          consentTextHash: 'a'.repeat(64),
        },
        exactLocalReceipt: true,
      }),
    ).toBe(false);
  });

  it('does not inspect adversarial consent input', () => {
    const params = new Proxy(
      {},
      {
        get() {
          throw new Error('commerce consent input was inspected');
        },
      },
    );

    expect(resolveCommerceConsent(params as never)).toBe(false);
  });

  it('cannot resolve a retailer option from injected active rows', () => {
    expect(resolveWhereToBuy('mineral_spf', adversarialRows)).toEqual([]);
  });

  it('cannot build an outbound URL from a forged option', () => {
    expect(
      outboundFor(
        {
          id: 'forged',
          retailer: 'Partner',
          label: 'Injected option',
          url: 'https://retailer.example/product',
          priceCents: 3400,
          currency: 'USD',
          source: 'direct',
          isPaid: true,
        },
        'opaque-token',
      ),
    ).toBeNull();
  });

  it('cannot expose stacks through defaults, injected fixtures, or slug lookup', () => {
    const forcedStack = {
      slug: 'forced-live-stack',
      title: 'Forced',
      subtitle: 'Injected fixture',
      curator: 'Test',
      curatorKind: 'editorial' as const,
      reviewedBy: 'reviewer',
      items: [],
    };

    expect(STACKS_REVIEWED).toBe(false);
    expect(STARTER_STACKS).toEqual([]);
    expect(shippableStacks()).toEqual([]);
    expect(shippableStacks([forcedStack])).toEqual([]);
    expect(stackBySlug('forced-live-stack', [forcedStack])).toBeUndefined();
  });

  it('retains price formatting as a side-effect-free presentation helper', () => {
    expect(formatPrice(3400)).toBe('$34');
    expect(formatPrice(2999)).toBe('$29.99');
    expect(formatPrice(null)).toBeNull();
  });
});
