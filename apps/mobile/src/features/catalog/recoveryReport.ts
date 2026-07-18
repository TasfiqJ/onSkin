import { normalizeCanonicalProductBarcode } from '@/features/native/camera/barcode';

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export type BarcodeRecoveryReportInput = {
  correctionType: 'missing_product' | 'wrong_match';
  productId?: string;
  barcode: string;
  description: string;
  proposedPayload: Record<string, never>;
  clientContext: { addedVia: 'barcode'; route: 'shelf_no_match' };
};

/** Build the minimum evidence needed for an actionable barcode recovery report. */
export function barcodeRecoveryReportInput(input: {
  barcode: string | null;
  wrongProductId: string | null;
}): BarcodeRecoveryReportInput | null {
  const barcode = input.barcode ? normalizeCanonicalProductBarcode(input.barcode) : null;
  if (!barcode) return null;

  if (input.wrongProductId !== null) {
    const productId = input.wrongProductId.trim();
    if (!UUID_PATTERN.test(productId)) return null;
    return {
      correctionType: 'wrong_match',
      productId,
      barcode,
      description: 'wrong_match reported from barcode lookup result',
      proposedPayload: {},
      clientContext: { addedVia: 'barcode', route: 'shelf_no_match' },
    };
  }

  return {
    correctionType: 'missing_product',
    barcode,
    description: 'missing_product reported from barcode no-match',
    proposedPayload: {},
    clientContext: { addedVia: 'barcode', route: 'shelf_no_match' },
  };
}
