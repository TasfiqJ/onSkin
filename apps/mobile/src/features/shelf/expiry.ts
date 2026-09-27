import { computeExpiry } from '@/features/intelligence/pao';

import type { ShelfProduct } from './store';

// The surfaced expiry for a product (docs/04 §3): whichever is sooner of the
// printed expiry and opened+PAO. Unopened items have no PAO clock. Only a
// printed shelf life, if any. Shared by the shelf list and the detail hub so the
// "best used by" date never diverges.
export function surfacedExpiry(
  p: Pick<
    ShelfProduct,
    'isOpened' | 'openedAt' | 'paoMonths' | 'expiryDate' | 'expirySource'
  >,
): string | null {
  if (p.expirySource === 'unknown') return null;
  if (p.expirySource === 'printed') return p.expiryDate ?? null;
  if (!p.isOpened) return null;
  return computeExpiry({ openedAt: p.openedAt, paoMonths: p.paoMonths, expiryDate: p.expiryDate });
}

export function isEstimatedExpiry(p: Pick<ShelfProduct, 'expirySource' | 'paoSource'>): boolean {
  return p.expirySource === 'estimated' && p.paoSource === 'category_default';
}

/** "Sep 2026" month/year label for a surfaced expiry (docs/04 §5.6). */
export function expiryMonthLabel(iso: string | null): string | null {
  if (!iso) return null;
  const [y, m, d] = iso.split('-').map(Number);
  return new Date(y!, (m ?? 1) - 1, d ?? 1).toLocaleDateString('en-US', {
    month: 'short',
    year: 'numeric',
  });
}
