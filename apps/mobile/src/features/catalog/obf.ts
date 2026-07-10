import type { ProductCategory } from '@/features/shelf/categories';

import { normalizeBarcode, normalizeProductName } from './normalization';

export const OPEN_BEAUTY_FACTS_FIELDS = [
  'code',
  'product_name',
  'brands',
  'ingredients_text',
  'categories',
  'categories_tags',
  'last_modified_t',
] as const;

export type ObfProductRaw = {
  code?: string;
  product_name?: string;
  brands?: string;
  ingredients_text?: string;
  categories?: string;
  categories_tags?: string[];
  last_modified_t?: number;
};

export type OpenBeautyFactsUserAgentInput = {
  appName: string;
  version: string;
  contactEmail: string;
};

export type CatalogProductCandidate = {
  barcode: string;
  name: string;
  brand: string | null;
  category: ProductCategory | null;
  source: 'open_beauty_facts';
  sourceRef: string;
  sourceUrl: string;
  sourceSnapshotDate: string | null;
  rawIngredientsText: string | null;
  qualityGrade: 'limited' | 'unverified';
  rejectedReason: string | null;
};

const BEAUTY_TAGS = [
  'en:beauty',
  'en:cosmetics',
  'en:skin-care',
  'en:face-care',
  'en:moisturizers',
  'en:sunscreens',
  'en:cleansers',
  'en:serums',
  'en:toners',
];

const REJECT_TAGS = [
  'en:mouthwashes',
  'en:toothpastes',
  'en:oral-care',
  'en:shampoos',
  'en:hair-care',
];

export function buildOpenBeautyFactsUserAgent(input: OpenBeautyFactsUserAgentInput): string {
  const appName = input.appName.trim();
  const version = input.version.trim();
  const contactEmail = input.contactEmail.trim();
  if (!appName || !version || !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(contactEmail)) {
    throw new Error('Open Beauty Facts User-Agent needs app name, version, and contact email.');
  }
  return `${appName}/${version} (${contactEmail})`;
}

export function isBeautyCategoryCandidate(tags: string[] | undefined): boolean {
  const normalized = (tags ?? []).map((tag) => tag.toLowerCase());
  if (normalized.some((tag) => REJECT_TAGS.includes(tag))) return false;
  return normalized.some((tag) => BEAUTY_TAGS.includes(tag));
}

export function categoryFromObfTags(tags: string[] | undefined): ProductCategory | null {
  const normalized = (tags ?? []).map((tag) => tag.toLowerCase());
  if (normalized.some((tag) => tag.includes('sunscreen') || tag.includes('sun-protection')))
    return 'spf';
  if (normalized.some((tag) => tag.includes('cleanser'))) return 'cleanser';
  if (normalized.some((tag) => tag.includes('toner') || tag.includes('essence'))) return 'toner';
  if (normalized.some((tag) => tag.includes('serum'))) return 'serum';
  if (normalized.some((tag) => tag.includes('moisturizer') || tag.includes('moisturiser')))
    return 'moisturiser_tube';
  return null;
}

export function mapObfProduct(raw: ObfProductRaw): CatalogProductCandidate | null {
  const barcode = normalizeBarcode(raw.code);
  const name = normalizeProductName(raw.product_name);
  if (!barcode || !name) return null;

  const tags = raw.categories_tags ?? [];
  const isBeauty = isBeautyCategoryCandidate(tags);
  const snapshotDate =
    typeof raw.last_modified_t === 'number'
      ? new Date(raw.last_modified_t * 1000).toISOString().slice(0, 10)
      : null;

  return {
    barcode,
    name,
    brand: normalizeProductName(raw.brands),
    category: categoryFromObfTags(tags),
    source: 'open_beauty_facts',
    sourceRef: barcode,
    sourceUrl: `https://world.openbeautyfacts.org/product/${barcode}`,
    sourceSnapshotDate: snapshotDate,
    rawIngredientsText: raw.ingredients_text?.trim() || null,
    qualityGrade: isBeauty && raw.ingredients_text ? 'limited' : 'unverified',
    rejectedReason: isBeauty ? null : 'not_skin_care_category',
  };
}

export function sanitizeContributionPayload(input: {
  barcode?: string | null;
  productName?: string | null;
  brand?: string | null;
  ingredientsText?: string | null;
  categoriesTags?: string[] | null;
}): Record<string, unknown> {
  const barcode = normalizeBarcode(input.barcode);
  return {
    ...(barcode ? { code: barcode } : {}),
    ...(input.productName?.trim() ? { product_name: input.productName.trim() } : {}),
    ...(input.brand?.trim() ? { brands: input.brand.trim() } : {}),
    ...(input.ingredientsText?.trim() ? { ingredients_text: input.ingredientsText.trim() } : {}),
    ...(input.categoriesTags?.length ? { categories_tags: input.categoriesTags } : {}),
  };
}
