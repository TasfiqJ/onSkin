/**
 * CORE-06A product-specific recommendation admission.
 *
 * Type-first and shelf-context guidance remain useful, but no catalog product is
 * admitted until the governed catalog/review/receipt pipeline exists. This
 * module is the only mobile boundary allowed to turn untrusted catalog
 * candidates into a product-specific recommendation or commerce target.
 */

export type ProductSpecificMode = 'closed';

/** This checkpoint deliberately admits zero catalog products. */
export const PRODUCT_SPECIFIC_MODE: ProductSpecificMode = 'closed';

export type CatalogProductAdmissionReasonCode =
  | 'product_specific_mode_closed'
  | 'candidate_envelope_invalid'
  | 'catalog_provenance_invalid'
  | 'catalog_quality_not_cleared'
  | 'catalog_review_not_cleared';

export type CatalogProductAdmissionRejection = {
  candidateIndex: number | null;
  reasonCode: CatalogProductAdmissionReasonCode;
};

export type AdmittedCatalogProduct = {
  kind: 'catalog_product';
  catalogProductId: string;
  productType: string;
  admissionReceiptId: string;
};

export type CatalogProductAdmissionResult = {
  productSpecificMode: ProductSpecificMode;
  admittedCatalogProducts: readonly AdmittedCatalogProduct[];
  rejections: readonly CatalogProductAdmissionRejection[];
};

/**
 * Fail-closed intake for every server, fixture, cache, or forged candidate.
 *
 * Candidate fields are intentionally not inspected while the mode is closed:
 * doing so could accidentally create a second, weaker admission path. The raw
 * count is retained only to make test/operator evidence explicit.
 */
export function admitCatalogRecommendationCandidates(raw: unknown): CatalogProductAdmissionResult {
  const candidateCount = Array.isArray(raw) ? raw.length : 1;
  return {
    productSpecificMode: PRODUCT_SPECIFIC_MODE,
    admittedCatalogProducts: [],
    rejections: Array.from({ length: candidateCount }, (_, candidateIndex) => ({
      candidateIndex: Array.isArray(raw) ? candidateIndex : null,
      reasonCode: 'product_specific_mode_closed' as const,
    })),
  };
}

export type TypeFirstRecommendationProvenance = {
  kind: 'type_first';
  productType: string;
  catalogProductId: null;
};

export type ShelfContextRecommendationProvenance = {
  kind: 'shelf_context';
  shelfProductId: string;
  catalogProductId: null;
};

export type CatalogProductRecommendationProvenance = {
  kind: 'catalog_product';
  productType: string;
  catalogProductId: string;
  admissionReceiptId: string;
};

export type RecommendationProvenance =
  | TypeFirstRecommendationProvenance
  | ShelfContextRecommendationProvenance
  | CatalogProductRecommendationProvenance;

/**
 * Runtime commerce boundary for CORE-06A. No shape, cache row, fixture, or
 * caller field can upgrade itself to authority; the successor must replace
 * this function with a receipt-bound exact-SKU verifier.
 */
export function isAdmittedCatalogProductProvenance(
  _value: unknown,
): _value is CatalogProductRecommendationProvenance {
  return false;
}

export function typeFirstProvenance(productType: string): TypeFirstRecommendationProvenance {
  return { kind: 'type_first', productType, catalogProductId: null };
}

export function shelfContextProvenance(
  shelfProductId: string,
): ShelfContextRecommendationProvenance {
  return { kind: 'shelf_context', shelfProductId, catalogProductId: null };
}
