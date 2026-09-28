import type { CuratorKind } from '@layerwell/types';

// Dormant stack shapes remain for compatibility, but COM-01A admits no stack
// corpus, including development or injected fixtures.

export type StackItem = {
  position: number;
  /** A docs/09 type-first key (catalog.ts), so the stack joins to where-to-buy. */
  productType: string;
  /** The product name shown in the stack (illustrative until B-CATALOG-SEED). */
  label: string;
  /** "Cleanse · fragrance-free". The role + a claim-safe note. */
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

export const STARTER_STACKS: CreatorStack[] = [];

/** Legacy review state retained without creating commerce admission. */
export const STACKS_REVIEWED = false;

export function shippableStacks(_stacks: CreatorStack[] = STARTER_STACKS): CreatorStack[] {
  return [];
}

export function stackBySlug(
  _slug: string,
  _stacks: CreatorStack[] = STARTER_STACKS,
): CreatorStack | undefined {
  return undefined;
}
