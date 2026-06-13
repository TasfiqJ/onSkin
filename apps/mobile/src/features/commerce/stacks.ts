import type { CuratorKind } from '@onskin/types';

// Expert/derm-reviewed shoppable Stacks (docs/10 §4, Phase 2 concept; UI shipped now
// with in-house curated content). The research is decisive: expert/derm-curated
// content is more trusted than anonymous influencer content, and influencer stacks
// are a trust liability — so OnSkin's stacks are EDITORIAL/derm-reviewed, never
// anonymous. Ordered by the routine SEQUENCE (docs/03), never by commission (church
// and state). Stack content is medical-adjacent → launch-gated under B-DERM-REVIEW,
// exactly like the conflict matrix (rules.ts) and the rec types (catalog.ts).
//
// *** BLOCKED: B-DERM-REVIEW — reviewedBy is null on every stack. In production only
// *** reviewed stacks surface; in dev the demo stack is available so the surface is
// *** buildable/demoable. Product items reuse the docs/09 type catalog (type-first;
// *** specific products + retailers arrive with B-CATALOG-SEED).

export type StackItem = {
  position: number;
  /** A docs/09 type-first key (catalog.ts), so the stack joins to where-to-buy. */
  productType: string;
  /** The product name shown in the stack (illustrative until B-CATALOG-SEED). */
  label: string;
  /** "Cleanse · fragrance-free" — the role + a claim-safe note. */
  roleLabel: string;
};

export type CreatorStack = {
  slug: string;
  title: string;
  subtitle: string;
  curator: string;
  curatorKind: CuratorKind;
  reviewedBy: string | null;
  items: StackItem[];
};

export const STARTER_STACKS: CreatorStack[] = [
  {
    slug: 'sensitive-skin-starter-set',
    title: 'The sensitive-skin starter set',
    subtitle: 'Four products, in order.',
    curator: 'OnSkin editorial',
    curatorKind: 'derm',
    reviewedBy: null,
    items: [
      { position: 1, productType: 'fragrance_free_cleanser', label: 'Gentle gel cleanser', roleLabel: 'Cleanse · fragrance-free' },
      { position: 2, productType: 'niacinamide_serum', label: 'Niacinamide 5%', roleLabel: 'Treat · barrier-friendly' },
      { position: 3, productType: 'ceramide_moisturiser', label: 'Ceramide moisturiser', roleLabel: 'Moisturise · seals it in' },
      { position: 4, productType: 'mineral_spf', label: 'Mineral SPF 30', roleLabel: 'Protect · the AM finish' },
    ],
  },
];

/**
 * Launch gate (B-DERM-REVIEW), mirroring shippableRules() / shippableRecTypes(). In
 * production only stacks with a recorded clinical sign-off (reviewedBy) surface; in
 * dev the full set is used so the layer is demoable.
 */
export const STACKS_REVIEWED = false;

export function shippableStacks(stacks: CreatorStack[] = STARTER_STACKS): CreatorStack[] {
  const isDev = typeof __DEV__ !== 'undefined' && __DEV__;
  return isDev ? stacks : stacks.filter((s) => s.reviewedBy != null);
}

export function stackBySlug(slug: string, stacks: CreatorStack[] = STARTER_STACKS): CreatorStack | undefined {
  return shippableStacks(stacks).find((s) => s.slug === slug);
}
