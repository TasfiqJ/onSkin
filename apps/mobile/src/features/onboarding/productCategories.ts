import type { ProductCategory } from '@/features/shelf/categories';

// Compact first-run shelf intake. These must stay aligned with the canonical shelf
// category IDs because they drive PAO defaults and shelf metadata.
export const ONBOARDING_PRODUCT_CATEGORIES: { id: ProductCategory; label: string }[] = [
  { id: 'cleanser', label: 'Cleanser' },
  { id: 'toner', label: 'Toner' },
  { id: 'serum', label: 'Serum' },
  { id: 'retinoid_serum', label: 'Treatment' },
  { id: 'moisturiser_tube', label: 'Moisturiser' },
  { id: 'spf', label: 'SPF' },
  { id: 'oil_balm', label: 'Oil / balm' },
];
