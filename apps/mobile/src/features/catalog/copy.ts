import { BRAND } from '@/lib/brand';

import type { CatalogQualityGrade } from './quality';

export function catalogQualityLabel(
  grade: CatalogQualityGrade | string | null | undefined,
): string {
  switch (grade) {
    case 'verified':
      return 'Verified';
    case 'usable':
      return 'Usable';
    case 'limited':
      return 'Limited';
    case 'blocked':
      return 'Blocked';
    case 'manual':
      return 'Manual';
    default:
      return 'Unverified';
  }
}

export function catalogQualityCopy(grade: CatalogQualityGrade | string | null | undefined): string {
  switch (grade) {
    case 'verified':
      return 'Reviewed source, barcode, category, and ingredient parse.';
    case 'usable':
      return 'Good enough for shelf and routine use, with source disclosure.';
    case 'limited':
      return 'Useful for matching, not for product-specific recommendations.';
    case 'blocked':
      return 'Hidden from recommendations while a source or correction issue is open.';
    case 'manual':
      return 'Added by hand. It can support your shelf and routine, but not high-confidence product recommendations.';
    default:
      return 'Not reviewed yet. Add by hand or report an issue if it looks wrong.';
  }
}

export function sourceDisplayName(source: string | null | undefined): string {
  switch (source) {
    case 'open_beauty_facts':
      return 'Open Beauty Facts';
    case 'cosing':
      return 'CosIng';
    case 'curated':
      return BRAND.catalogCuratedSource;
    case 'brand_label':
      return 'Product label';
    case 'user_local':
      return 'Added by you';
    case 'internal_derived':
      return BRAND.catalogParserSource;
    default:
      return 'Unknown source';
  }
}

export const contributionBackCopy =
  'We use missing-product reports to improve the catalog. We do not promise external contribution until the source workflow is approved.';
