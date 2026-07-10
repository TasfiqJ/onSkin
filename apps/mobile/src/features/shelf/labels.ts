import type { PaoSource } from '@onskin/types';

// One consistent provenance label across every shelf surface (docs/04 §3/§5.6) ,
// the opened-date sheet, the product-detail freshness block, etc.. So the same
// product never describes its PAO source two different ways. Honest, never
// implying false precision.
export function paoSourceLabel(source: PaoSource): string {
  switch (source) {
    case 'label':
      return 'from label';
    case 'catalog':
      return 'from catalog';
    case 'category_default':
      return 'estimated';
    case 'unknown':
    default:
      return 'estimate';
  }
}
