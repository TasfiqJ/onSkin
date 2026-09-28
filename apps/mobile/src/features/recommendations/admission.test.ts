import { describe, expect, it } from 'vitest';

import {
  admitCatalogRecommendationCandidates,
  isAdmittedCatalogProductProvenance,
  PRODUCT_SPECIFIC_MODE,
  shelfContextProvenance,
  typeFirstProvenance,
  type CatalogProductAdmissionReasonCode,
} from './admission';

const CLOSED_REASON_CODES: readonly CatalogProductAdmissionReasonCode[] = [
  'product_specific_mode_closed',
  'candidate_envelope_invalid',
  'catalog_provenance_invalid',
  'catalog_quality_not_cleared',
  'catalog_review_not_cleared',
];

describe('CORE-06A product-specific recommendation admission', () => {
  it('publishes a closed mode and a closed-set reason-code vocabulary', () => {
    expect(PRODUCT_SPECIFIC_MODE).toBe('closed');
    expect(new Set(CLOSED_REASON_CODES).size).toBe(CLOSED_REASON_CODES.length);
  });

  it.each([
    ['undefined', undefined],
    ['null', null],
    ['primitive', 'catalog-product'],
    ['raw object', { id: 'product-1' }],
    [
      'forged approval',
      {
        kind: 'catalog_product',
        catalogProductId: '00000000-0000-4000-8000-000000000001',
        productType: 'mineral_spf',
        admissionReceiptId: 'forged-receipt',
        reviewStatus: 'approved',
      },
    ],
    [
      'apparently full candidate',
      {
        id: '00000000-0000-4000-8000-000000000001',
        productType: 'mineral_spf',
        sourceApproved: true,
        quality: 'verified',
        correctionsOpen: false,
        clinicalReceiptIds: ['derm', 'chemist', 'counsel'],
        commissionRate: 0,
      },
    ],
  ] as const)('admits zero catalog products for %s input', (_label, candidate) => {
    const result = admitCatalogRecommendationCandidates(candidate);
    expect(result).toEqual({
      productSpecificMode: 'closed',
      admittedCatalogProducts: [],
      rejections: [{ candidateIndex: null, reasonCode: 'product_specific_mode_closed' }],
    });
  });

  it('rejects every member of a candidate array without partial admission', () => {
    const result = admitCatalogRecommendationCandidates([
      { id: 'raw' },
      { id: 'forged', reviewStatus: 'approved' },
      { id: 'full', quality: 'verified', receiptIds: ['a', 'b', 'c'] },
    ]);
    expect(result.admittedCatalogProducts).toEqual([]);
    expect(result.rejections).toEqual([
      { candidateIndex: 0, reasonCode: 'product_specific_mode_closed' },
      { candidateIndex: 1, reasonCode: 'product_specific_mode_closed' },
      { candidateIndex: 2, reasonCode: 'product_specific_mode_closed' },
    ]);
  });

  it('is invariant when commercial metadata is permuted between full-looking candidates', () => {
    const editorial = [
      { id: 'a', quality: 'verified', commissionRate: 0.01, affiliate: false },
      { id: 'b', quality: 'verified', commissionRate: 0.99, affiliate: true },
    ];
    const permuted = [
      { ...editorial[0], commissionRate: 0.99, affiliate: true },
      { ...editorial[1], commissionRate: 0.01, affiliate: false },
    ];
    expect(admitCatalogRecommendationCandidates(permuted)).toEqual(
      admitCatalogRecommendationCandidates(editorial),
    );
  });

  it('never upgrades type-first, shelf-context, or forged catalog provenance to commerce', () => {
    expect(isAdmittedCatalogProductProvenance(typeFirstProvenance('mineral_spf'))).toBe(false);
    expect(isAdmittedCatalogProductProvenance(shelfContextProvenance('shelf-1'))).toBe(false);
    expect(
      isAdmittedCatalogProductProvenance({
        kind: 'catalog_product',
        productType: 'mineral_spf',
        catalogProductId: '00000000-0000-4000-8000-000000000001',
        admissionReceiptId: 'forged',
      }),
    ).toBe(false);
  });
});
