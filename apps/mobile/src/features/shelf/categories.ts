// Product categories for manual intake (docs/04 §4.4). The dropdown drives the
// default PAO via CATEGORY_PAO_DEFAULTS (docs/04 §3 waterfall step 2) and the
// safety-critical / printed-expiry exceptions. Labels are the UI strings.

export type ProductCategory =
  | 'cleanser'
  | 'toner'
  | 'vitamin_c_serum'
  | 'retinoid_serum'
  | 'serum'
  | 'moisturiser_tube'
  | 'moisturiser_jar'
  | 'eye_cream'
  | 'lash_brow'
  | 'mascara'
  | 'spf'
  | 'oil_balm'
  | 'benzoyl_peroxide'
  | 'other';

export const PRODUCT_CATEGORIES: { id: ProductCategory; label: string }[] = [
  { id: 'cleanser', label: 'Cleanser' },
  { id: 'toner', label: 'Toner / essence' },
  { id: 'vitamin_c_serum', label: 'Vitamin C serum' },
  { id: 'retinoid_serum', label: 'Retinol / retinoid serum' },
  { id: 'serum', label: 'Serum' },
  { id: 'moisturiser_tube', label: 'Moisturiser (tube)' },
  { id: 'moisturiser_jar', label: 'Moisturiser (jar)' },
  { id: 'eye_cream', label: 'Eye cream' },
  { id: 'lash_brow', label: 'Lash / brow serum' },
  { id: 'mascara', label: 'Mascara / liquid eye' },
  { id: 'spf', label: 'Sunscreen (SPF)' },
  { id: 'oil_balm', label: 'Oil / balm' },
  { id: 'benzoyl_peroxide', label: 'Acne treatment' },
  { id: 'other', label: 'Something else' },
];

const CATEGORY_LABEL = new Map(PRODUCT_CATEGORIES.map((c) => [c.id, c.label] as const));
export function categoryLabel(category: string | null | undefined): string | null {
  if (!category) return null;
  return CATEGORY_LABEL.get(category as ProductCategory) ?? category;
}

// Eye-area products + sunscreen are the genuinely higher-stakes exceptions
// (docs/04 §3): for these, an EXPIRED item gets the firmer "replace for safety"
// copy. Everything else stays calm ("time to replace").
const SAFETY_CRITICAL = new Set<ProductCategory>(['eye_cream', 'lash_brow', 'mascara', 'spf']);
export function isSafetyCriticalCategory(category: string | null | undefined): boolean {
  return !!category && SAFETY_CRITICAL.has(category as ProductCategory);
}

/** Sunscreen is an OTC drug carrying a regulated printed expiry. Prefer it over
 *  a PAO estimate (docs/04 §3). */
export function usesPrintedExpiry(category: string | null | undefined): boolean {
  return category === 'spf';
}
