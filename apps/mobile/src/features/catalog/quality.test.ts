import { describe, expect, it } from 'vitest';

import { isRecommendationEligible, scoreCatalogProduct } from './quality';

describe('catalog quality model', () => {
  it('marks fully reviewed source-approved products as recommendation eligible', () => {
    const quality = scoreCatalogProduct({
      hasName: true,
      hasBrand: true,
      hasBarcode: true,
      hasCategory: true,
      isSunscreen: false,
      hasPrintedExpiry: false,
      ingredientTokenCount: 12,
      unmatchedIngredientCount: 0,
      ingredientParseConfidence: 0.94,
      productReviewStatus: 'reviewed',
      sourceReviewStatus: 'legal_approved',
      sourceProductionApproved: true,
      unresolvedCorrectionCount: 0,
      sourceAgeDays: 20,
    });

    expect(quality.grade).toBe('verified');
    expect(isRecommendationEligible(quality)).toBe(true);
  });

  it('blocks recommendation eligibility when corrections are open', () => {
    const quality = scoreCatalogProduct({
      hasName: true,
      hasBrand: true,
      hasBarcode: true,
      hasCategory: true,
      isSunscreen: false,
      hasPrintedExpiry: false,
      ingredientTokenCount: 10,
      unmatchedIngredientCount: 0,
      ingredientParseConfidence: 0.93,
      productReviewStatus: 'reviewed',
      sourceReviewStatus: 'legal_approved',
      sourceProductionApproved: true,
      unresolvedCorrectionCount: 1,
      sourceAgeDays: 10,
    });

    expect(quality.blockers).toContain('unresolved_corrections');
    expect(quality.recommendationEligible).toBe(false);
  });

  it('keeps sunscreen without sourced expiry below verified', () => {
    const quality = scoreCatalogProduct({
      hasName: true,
      hasBrand: true,
      hasBarcode: true,
      hasCategory: true,
      isSunscreen: true,
      hasPrintedExpiry: false,
      ingredientTokenCount: 10,
      unmatchedIngredientCount: 0,
      ingredientParseConfidence: 0.95,
      productReviewStatus: 'reviewed',
      sourceReviewStatus: 'legal_approved',
      sourceProductionApproved: true,
      unresolvedCorrectionCount: 0,
      sourceAgeDays: 10,
    });

    expect(quality.grade).not.toBe('verified');
    expect(quality.warnings).toContain('sunscreen_expiry_requires_label_or_manufacturer_source');
  });
});

