import { afterEach, describe, expect, it } from 'vitest';

import { urlLeaksHealthData } from './attribution';
import { resolveCommerceConsent } from './consentLogic';
import { formatPrice, outboundFor, resolveWhereToBuy, type AffiliateLinkRow } from './links';
import { shippableStacks, STACKS_REVIEWED, stackBySlug, STARTER_STACKS } from './stacks';

// Commerce engine fixtures (docs/10 §5/§4). Rail-agnostic resolution, the
// church-and-state guarantee (no commission field anywhere a client can read or sort
// on), and the B-DERM-REVIEW launch gate on the expert/derm stacks.

afterEach(() => {
  delete (globalThis as { __DEV__?: boolean }).__DEV__;
});

const rows: AffiliateLinkRow[] = [
  { id: 'a', product_type: 'mineral_spf', retailer: 'Partner', label: 'Zinc SPF 30', url: 'https://x.example/a', price_cents: 3400, currency: 'USD', source: 'shopmy', is_paid: true, is_active: true },
  { id: 'b', product_type: 'mineral_spf', retailer: 'Other', label: 'Fluid SPF 30', url: 'https://x.example/b', price_cents: 2900, currency: 'USD', source: 'skimlinks', is_paid: true, is_active: false },
  { id: 'c', product_type: 'ceramide_moisturiser', retailer: 'Partner', label: 'Cream', url: 'https://x.example/c', price_cents: null, currency: 'USD', source: 'direct', is_paid: false, is_active: true },
  { id: 'd', product_type: 'mineral_spf', retailer: 'Bad', label: 'Unsafe link', url: 'onskin://commerce/callback', price_cents: null, currency: 'USD', source: 'direct', is_paid: false, is_active: true },
  { id: 'e', product_type: 'mineral_spf', retailer: 'Bad', label: 'Credentialed link', url: 'https://user:pass@x.example/e', price_cents: null, currency: 'USD', source: 'direct', is_paid: false, is_active: true },
];

describe('rail-agnostic resolution (the B-SHOPMY hedge)', () => {
  it('returns only active links for the requested product type, source-tagged', () => {
    const out = resolveWhereToBuy('mineral_spf', rows);
    expect(out.map((o) => o.id)).toEqual(['a']); // 'b' is inactive
    expect(out[0]!.source).toBe('shopmy');
  });

  it('filters malformed or credentialed retailer URLs before they reach the tap surface', () => {
    const out = resolveWhereToBuy('mineral_spf', rows);
    expect(out.map((o) => o.id)).not.toContain('d');
    expect(out.map((o) => o.id)).not.toContain('e');
  });

  it('returns [] for a type with no links. The honest empty state, never fabricated', () => {
    expect(resolveWhereToBuy('retinoid_serum', rows)).toEqual([]);
  });
});

describe('church and state. No commission/rate field exists in the client path (D-058)', () => {
  it('a resolved where-to-buy option carries only disclosed merit/price fields, never commission', () => {
    const opt = resolveWhereToBuy('mineral_spf', rows)[0]!;
    const keys = Object.keys(opt).join(' ').toLowerCase();
    for (const banned of ['commission', 'rate', 'payout', 'affiliate_rate', 'earnings']) {
      expect(keys).not.toContain(banned);
    }
  });
});

describe('the outbound link is health-safe (opaque token only)', () => {
  it('builds a URL with no health-adjacent attribute', () => {
    const opt = resolveWhereToBuy('mineral_spf', rows)[0]!;
    const url = outboundFor(opt, 'opaque-token');
    expect(url).not.toBeNull();
    if (!url) return;
    expect(url).toContain('oref=opaque-token');
    expect(urlLeaksHealthData(url.slice(opt.url.length))).toBe(false);
  });
});

describe('price formatting (illustrative until B-CATALOG-SEED)', () => {
  it('formats whole and fractional USD, and null', () => {
    expect(formatPrice(3400)).toBe('$34');
    expect(formatPrice(2999)).toBe('$29.99');
    expect(formatPrice(null)).toBeNull();
  });
});

describe('MHMDA consent precedence. A revocation re-locks (review fix, D-061)', () => {
  it('the ledger is authoritative when present: a revocation beats a stale local flag', () => {
    expect(resolveCommerceConsent(false, true)).toBe(false); // revoked in ledger, stale local=true → LOCKED
    expect(resolveCommerceConsent(true, false)).toBe(true); // granted in ledger
  });
  it('falls back to the local-first flag only when the ledger has no entry (offline)', () => {
    expect(resolveCommerceConsent(undefined, true)).toBe(true);
    expect(resolveCommerceConsent(undefined, false)).toBe(false);
  });
});

describe('expert/derm stacks are launch-gated under B-DERM-REVIEW', () => {
  it('STACKS_REVIEWED is false (parity with the conflict-matrix + rec-type gates)', () => {
    expect(STACKS_REVIEWED).toBe(false);
  });
  it('in production no unreviewed stack ships', () => {
    (globalThis as { __DEV__?: boolean }).__DEV__ = false;
    expect(shippableStacks()).toEqual([]);
  });
  it('in dev the demo starter stack is available, ordered, and editorial/derm-curated', () => {
    (globalThis as { __DEV__?: boolean }).__DEV__ = true;
    const stack = stackBySlug('sensitive-skin-starter-set');
    expect(stack).toBeTruthy();
    expect(stack!.curatorKind).toBe('derm');
    expect(stack!.items.map((i) => i.position)).toEqual([1, 2, 3, 4]); // routine order, not payout
    expect(stack!.reviewedBy).toBeNull(); // B-DERM-REVIEW
  });
  it('the starter stack items map to the docs/09 type catalogue (type-first)', () => {
    expect(STARTER_STACKS[0]!.items.map((i) => i.productType)).toContain('mineral_spf');
  });
});
