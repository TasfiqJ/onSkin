export type CatalogQualityGrade = 'verified' | 'usable' | 'limited' | 'unverified' | 'blocked';
export type CatalogReviewStatus = 'unreviewed' | 'needs_review' | 'reviewed' | 'blocked';
export type CatalogSourceReviewStatus = 'draft' | 'pending' | 'legal_approved' | 'blocked';

export type CatalogProductQualityInput = {
  hasName: boolean;
  hasBrand: boolean;
  hasBarcode: boolean;
  hasCategory: boolean;
  isSunscreen: boolean;
  hasPrintedExpiry: boolean;
  ingredientTokenCount: number;
  unmatchedIngredientCount: number;
  ingredientParseConfidence: number;
  productReviewStatus: CatalogReviewStatus;
  sourceReviewStatus: CatalogSourceReviewStatus;
  sourceProductionApproved: boolean;
  unresolvedCorrectionCount: number;
  sourceAgeDays: number | null;
};

export type CatalogProductQuality = {
  grade: CatalogQualityGrade;
  dataQualityScore: number;
  ingredientQualityScore: number;
  barcodeQualityScore: number;
  categoryQualityScore: number;
  recommendationEligible: boolean;
  blockers: string[];
  warnings: string[];
};

function clampScore(value: number): number {
  return Math.max(0, Math.min(100, Math.round(value)));
}

export function scoreCatalogProduct(input: CatalogProductQualityInput): CatalogProductQuality {
  const blockers: string[] = [];
  const warnings: string[] = [];

  if (!input.hasName) blockers.push('missing_product_name');
  if (input.sourceReviewStatus === 'blocked') blockers.push('source_blocked');
  if (input.productReviewStatus === 'blocked') blockers.push('product_blocked');
  if (input.unresolvedCorrectionCount > 0) blockers.push('unresolved_corrections');

  if (!input.hasBrand) warnings.push('missing_brand');
  if (!input.hasCategory) warnings.push('missing_category');
  if (!input.hasBarcode) warnings.push('missing_barcode');
  if (input.ingredientTokenCount === 0) warnings.push('missing_ingredient_list');
  if (input.sourceAgeDays != null && input.sourceAgeDays > 365)
    warnings.push('source_older_than_one_year');
  if (input.isSunscreen && !input.hasPrintedExpiry)
    warnings.push('sunscreen_expiry_requires_label_or_manufacturer_source');

  const unknownRate =
    input.ingredientTokenCount > 0
      ? input.unmatchedIngredientCount / input.ingredientTokenCount
      : 1;
  const ingredientQualityScore = clampScore(
    input.ingredientTokenCount === 0
      ? 0
      : input.ingredientParseConfidence * 80 + (1 - Math.min(1, unknownRate)) * 20,
  );
  const barcodeQualityScore = input.hasBarcode ? 100 : 20;
  const categoryQualityScore = input.hasCategory
    ? input.isSunscreen && !input.hasPrintedExpiry
      ? 65
      : 100
    : 20;
  const identityScore =
    (input.hasName ? 35 : 0) +
    (input.hasBrand ? 25 : 0) +
    (input.hasBarcode ? 25 : 0) +
    (input.hasCategory ? 15 : 0);
  const dataQualityScore = clampScore(
    identityScore * 0.45 +
      ingredientQualityScore * 0.35 +
      barcodeQualityScore * 0.1 +
      categoryQualityScore * 0.1,
  );

  let grade: CatalogQualityGrade;
  if (
    blockers.includes('source_blocked') ||
    blockers.includes('product_blocked') ||
    !input.hasName
  ) {
    grade = 'blocked';
  } else if (
    input.productReviewStatus === 'reviewed' &&
    input.sourceReviewStatus === 'legal_approved' &&
    input.sourceProductionApproved &&
    input.unresolvedCorrectionCount === 0 &&
    dataQualityScore >= 90 &&
    ingredientQualityScore >= 85 &&
    input.hasBarcode &&
    input.hasBrand &&
    input.hasCategory &&
    (!input.isSunscreen || input.hasPrintedExpiry)
  ) {
    grade = 'verified';
  } else if (
    input.productReviewStatus === 'reviewed' &&
    input.sourceProductionApproved &&
    input.unresolvedCorrectionCount === 0 &&
    dataQualityScore >= 75 &&
    ingredientQualityScore >= 70 &&
    input.hasCategory
  ) {
    grade = 'usable';
  } else if (dataQualityScore >= 45 && input.hasName) {
    grade = 'limited';
  } else {
    grade = 'unverified';
  }

  const recommendationEligible =
    (grade === 'verified' || grade === 'usable') &&
    input.productReviewStatus === 'reviewed' &&
    input.sourceReviewStatus === 'legal_approved' &&
    input.sourceProductionApproved &&
    input.unresolvedCorrectionCount === 0 &&
    !blockers.length;

  return {
    grade,
    dataQualityScore,
    ingredientQualityScore,
    barcodeQualityScore,
    categoryQualityScore,
    recommendationEligible,
    blockers,
    warnings,
  };
}

export function isRecommendationEligible(
  quality: Pick<CatalogProductQuality, 'grade' | 'recommendationEligible'>,
): boolean {
  return (
    quality.recommendationEligible && (quality.grade === 'verified' || quality.grade === 'usable')
  );
}
