import { categoryLabel, usesPrintedExpiry } from './categories';
import type { ShelfProduct } from './store';

export const SHELF_META_SEPARATOR = '\u00A0\u00B7 ';

function keepTogether(text: string): string {
  return text.replace(/ /g, '\u00A0');
}

function monthLabel(iso: string | null): string | null {
  if (!iso) return null;
  const [y, m, d] = iso.split('-').map(Number);
  return new Date(y!, (m ?? 1) - 1, d ?? 1).toLocaleDateString('en-US', { month: 'short' });
}

/** The honest mono metadata line under a product name (docs/04 §5.2). */
export function formatShelfMetaLine(p: ShelfProduct): string {
  const parts: (string | null | undefined)[] = [];
  parts.push(
    p.brand ??
      (p.addedVia === 'manual' ? keepTogether('added by hand') : categoryLabel(p.category)),
  );
  if (!p.isOpened) parts.push('unopened');
  else if (p.openedAt) parts.push(keepTogether(`opened ${monthLabel(p.openedAt)}`));
  else parts.push(keepTogether('no date set'));
  if (usesPrintedExpiry(p.category) && p.expiryDate) {
    parts.push(keepTogether('printed expiry'));
  } else if (p.paoMonths != null) {
    const fromLabel = p.paoSource === 'label' || p.paoSource === 'catalog';
    parts.push(
      fromLabel ? keepTogether(`${p.paoMonths} mo PAO`) : keepTogether(`est. ${p.paoMonths} mo`),
    );
  }
  return parts.filter(Boolean).join(SHELF_META_SEPARATOR);
}
