import {
  catalogIntakeProvenance,
  lookupBarcode,
  type CatalogLookupResponse,
  type CatalogProductSummary,
} from '@/features/catalog/client';
import { sourceDisplayName } from '@/features/catalog/copy';
import { parseIngredientText } from '@/features/catalog/ingredientParser';
import {
  acceptReadyCatalogLookupAfterShelfSave,
  bindCatalogLookupToShelfProduct,
  type CatalogLookupCandidate,
  type ReadyCatalogLookup,
} from '@/lib/offline/catalogLookupQueue';

import { PRODUCT_CATEGORIES, type ProductCategory } from './categories';
import type { CatalogRecoveryToken, IntakeDraft } from './IntakeContext';

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export type CatalogRecoveryRevalidation =
  | { status: 'eligible'; product: CatalogProductSummary }
  | { status: 'changed' | 'gone' | 'unavailable' };

function normalizedNullableString(value: unknown): string | null {
  return typeof value === 'string' && value.trim() ? value.trim() : null;
}

function isStillEligibleProduct(
  product: CatalogProductSummary,
  candidate: CatalogLookupCandidate,
): boolean {
  const source = product.catalog_sources;
  return (
    product.id === candidate.productId &&
    product.barcode === candidate.barcode &&
    product.name.trim() === candidate.name &&
    normalizedNullableString(product.brand) === candidate.brand &&
    normalizedNullableString(product.category) === candidate.category &&
    typeof product.catalog_source_id === 'string' &&
    UUID_PATTERN.test(product.catalog_source_id) &&
    product.catalog_source_id === candidate.catalogSourceId &&
    typeof product.source === 'string' &&
    product.source.trim().length > 0 &&
    product.source === candidate.sourceKey &&
    source?.id === product.catalog_source_id &&
    source.source_key === product.source &&
    normalizedNullableString(source.display_name) === candidate.sourceDisplayName &&
    product.review_status === 'reviewed' &&
    product.quality_grade === candidate.qualityGrade
  );
}

/** Re-query only the app's first-party catalog and require the exact eligible product. */
export async function revalidateCatalogRecovery(
  ready: ReadyCatalogLookup,
  lookup: (barcode: string) => Promise<CatalogLookupResponse> = lookupBarcode,
): Promise<CatalogRecoveryRevalidation> {
  let response: CatalogLookupResponse;
  try {
    response = await lookup(ready.barcode);
  } catch {
    return { status: 'unavailable' };
  }

  if (response.result === 'offline' || response.result === 'error') {
    return { status: 'unavailable' };
  }
  if (response.result === 'no_match' || response.result === 'too_short') {
    return { status: 'gone' };
  }
  if (response.result !== 'matched' || !isStillEligibleProduct(response.product, ready.candidate)) {
    return { status: 'changed' };
  }
  return { status: 'eligible', product: response.product };
}

function intakeCategory(value: string | null): ProductCategory | null {
  return PRODUCT_CATEGORIES.some((category) => category.id === value)
    ? (value as ProductCategory)
    : null;
}

/** Build a new-product draft only after the recovery match has been revalidated. */
export function catalogRecoveryIntakePatch(
  product: CatalogProductSummary,
  token: CatalogRecoveryToken,
): Partial<IntakeDraft> {
  const provenance = catalogIntakeProvenance(product);
  const parsed = product.rawIngredientsText
    ? parseIngredientText(product.rawIngredientsText)
    : null;
  const ingredients = parsed?.tokens.map((item) => item.displayName) ?? [];
  return {
    name: product.name.trim(),
    brand: product.brand?.trim() || null,
    category: intakeCategory(product.category),
    barcode: token.barcode,
    catalogProductId: product.id,
    catalogSourceId: provenance.catalogSourceId,
    catalogSource: product.source,
    catalogSourceName: product.catalog_sources?.display_name ?? sourceDisplayName(product.source),
    catalogSourceRef: product.source_ref ?? null,
    catalogSourceUrl: product.source_url ?? null,
    catalogSourceSnapshotDate: product.source_snapshot_date ?? null,
    catalogMatchQuality:
      product.quality_grade === 'verified' || product.quality_grade === 'usable'
        ? product.quality_grade
        : null,
    dataQualityScore: product.data_quality_score ?? null,
    ingredientParseStatus: parsed?.status ?? product.ingredient_parse_status ?? null,
    ingredientParseConfidence: parsed?.confidence ?? product.ingredient_parse_confidence ?? null,
    parserVersion: parsed?.parserVersion ?? null,
    sourceDisclosureAckAt: new Date().toISOString(),
    ingredients,
    paoMonths: provenance.paoMonths,
    paoSource: provenance.paoSource,
    expiryDate: provenance.expiryDate,
    addedVia: 'barcode',
    catalogRecoveryToken: token,
  };
}

export type CatalogRecoveryShelfFields = {
  catalogProductId: string;
  catalogSourceId: string;
  catalogSource: string;
  catalogSourceName: string;
  catalogSourceRef: string | null;
  catalogSourceUrl: string | null;
  catalogSourceSnapshotDate: string | null;
  catalogMatchQuality: 'verified' | 'usable';
  dataQualityScore: number | null;
  sourceDisclosureAckAt: string;
  catalogName: string;
  catalogBrand: string | null;
  catalogCategory: string | null;
};

/** Catalog fields available after revalidation. Ingredients/freshness are intentionally absent. */
export function catalogRecoveryShelfFields(
  product: CatalogProductSummary,
): CatalogRecoveryShelfFields {
  return {
    catalogProductId: product.id!,
    catalogSourceId: product.catalog_source_id!,
    catalogSource: product.source!,
    catalogSourceName: product.catalog_sources?.display_name ?? sourceDisplayName(product.source),
    catalogSourceRef: product.source_ref ?? null,
    catalogSourceUrl: product.source_url ?? null,
    catalogSourceSnapshotDate: product.source_snapshot_date ?? null,
    catalogMatchQuality: product.quality_grade as 'verified' | 'usable',
    dataQualityScore: product.data_quality_score ?? null,
    sourceDisclosureAckAt: new Date().toISOString(),
    catalogName: product.name.trim(),
    catalogBrand: product.brand?.trim() || null,
    catalogCategory: product.category,
  };
}

type QueueFinalizationDependencies = {
  bind: typeof bindCatalogLookupToShelfProduct;
  acceptAfterShelfSave: typeof acceptReadyCatalogLookupAfterShelfSave;
};

const DEFAULT_FINALIZATION_DEPENDENCIES: QueueFinalizationDependencies = {
  bind: bindCatalogLookupToShelfProduct,
  acceptAfterShelfSave: acceptReadyCatalogLookupAfterShelfSave,
};

/**
 * Called only after the Shelf add has succeeded. A failed bind/consume escapes,
 * leaving the candidate durable for another explicit review attempt.
 */
export async function finalizeCatalogLookupAfterShelfSave(
  input: {
    ownerUserId: string;
    barcode: string | null;
    shelfProductId: string;
    recoveryToken: CatalogRecoveryToken | null;
  },
  dependencies: QueueFinalizationDependencies = DEFAULT_FINALIZATION_DEPENDENCIES,
): Promise<'none' | 'bound' | 'accepted'> {
  if (!input.barcode) return 'none';
  if (input.recoveryToken?.barcode === input.barcode && input.recoveryToken.productId) {
    const accepted = await dependencies.acceptAfterShelfSave({
      ownerUserId: input.ownerUserId,
      barcode: input.recoveryToken.barcode,
      productId: input.recoveryToken.productId,
      shelfProductId: input.shelfProductId,
    });
    return accepted ? 'accepted' : 'none';
  }
  const bound = await dependencies.bind({
    ownerUserId: input.ownerUserId,
    barcode: input.barcode,
    shelfProductId: input.shelfProductId,
  });
  return bound ? 'bound' : 'none';
}
