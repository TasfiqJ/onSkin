import { describe, expect, it } from 'vitest';

import {
  ean13ChecksumIsValid,
  ean8ChecksumIsValid,
  normalizeScannedBarcode,
  shouldSuppressDuplicate,
} from './barcode';

describe('barcode normalization', () => {
  it('validates EAN-13 checksums', () => {
    expect(ean13ChecksumIsValid('4006381333931')).toBe(true);
    expect(ean13ChecksumIsValid('4006381333932')).toBe(false);
  });

  it('validates UPC-A through the EAN-13 check digit rule', () => {
    const normalized = normalizeScannedBarcode('036000291452', 'upc_a');
    expect(normalized).toEqual({
      value: '036000291452',
      type: 'upc_a',
      validChecksum: true,
      lookupValue: '036000291452',
    });
  });

  it('validates EAN-8 checksums', () => {
    expect(ean8ChecksumIsValid('96385074')).toBe(true);
    expect(ean8ChecksumIsValid('96385075')).toBe(false);
  });

  it('rejects non-product barcode payloads', () => {
    expect(normalizeScannedBarcode('https://example.com', 'qr')).toBeNull();
  });

  it('suppresses duplicate reads within the scan window', () => {
    expect(shouldSuppressDuplicate({ barcode: '4006381333931', atMs: 1000 }, '4006381333931', 2400)).toBe(true);
    expect(shouldSuppressDuplicate({ barcode: '4006381333931', atMs: 1000 }, '4006381333931', 3000)).toBe(false);
  });
});
