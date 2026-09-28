import { describe, expect, it } from 'vitest';

import { barcodeRecoveryReportInput } from './recoveryReport';

describe('barcode recovery report contract', () => {
  it('builds an exact owner-scoped missing-product input from a normalized barcode', () => {
    expect(barcodeRecoveryReportInput({ barcode: '036000291452', wrongProductId: null })).toEqual({
      correctionType: 'missing_product',
      barcode: '036000291452',
      description: 'missing_product reported from barcode no-match',
      proposedPayload: {},
      clientContext: { addedVia: 'barcode', route: 'shelf_no_match' },
    });
  });

  it('preserves the reviewed product identity for a wrong-match report', () => {
    expect(
      barcodeRecoveryReportInput({
        barcode: '012345678905',
        wrongProductId: '00000000-0000-4000-8000-000000000044',
      }),
    ).toEqual({
      correctionType: 'wrong_match',
      productId: '00000000-0000-4000-8000-000000000044',
      barcode: '012345678905',
      description: 'wrong_match reported from barcode lookup result',
      proposedPayload: {},
      clientContext: { addedVia: 'barcode', route: 'shelf_no_match' },
    });
  });

  it('preserves a checksum-valid canonical EAN-8 scan without guessing UPC-E', () => {
    expect(barcodeRecoveryReportInput({ barcode: '96385074', wrongProductId: null })).toMatchObject(
      {
        correctionType: 'missing_product',
        barcode: '96385074',
      },
    );
  });

  it('refuses identifier-free or malformed reports instead of inventing evidence', () => {
    expect(barcodeRecoveryReportInput({ barcode: null, wrongProductId: null })).toBeNull();
    expect(barcodeRecoveryReportInput({ barcode: '12345', wrongProductId: null })).toBeNull();
    expect(
      barcodeRecoveryReportInput({ barcode: '012345678905', wrongProductId: 'not-a-uuid' }),
    ).toBeNull();
  });
});
