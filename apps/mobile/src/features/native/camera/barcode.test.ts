import { describe, expect, it } from 'vitest';

import {
  ean13ChecksumIsValid,
  ean8ChecksumIsValid,
  expandUpcEToUpcA,
  gtinChecksumIsValid,
  manualBarcodeRequiresEightDigitFormat,
  normalizeCanonicalProductBarcode,
  normalizeManualBarcode,
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

  it('canonicalizes the leading-zero EAN-13 shape iOS emits for UPC-A', () => {
    expect(normalizeScannedBarcode('0036000291452', 'ean13')).toEqual({
      value: '0036000291452',
      type: 'upc_a',
      validChecksum: true,
      lookupValue: '036000291452',
    });
  });

  it('validates EAN-8 checksums', () => {
    expect(ean8ChecksumIsValid('96385074')).toBe(true);
    expect(ean8ChecksumIsValid('96385075')).toBe(false);
  });

  it('validates only defined canonical GTIN lengths including GTIN-14', () => {
    expect(gtinChecksumIsValid('10012345000017')).toBe(true);
    expect(gtinChecksumIsValid('10012345000018')).toBe(false);
    expect(gtinChecksumIsValid('123456789')).toBe(false);
    expect(normalizeManualBarcode('123456789')).toBeNull();
    expect(normalizeManualBarcode('1234567890')).toBeNull();
    expect(normalizeManualBarcode('12345678901')).toBeNull();
    expect(normalizeManualBarcode('10012345000017')).toMatchObject({
      lookupValue: '10012345000017',
      validChecksum: true,
    });
  });

  it('collapses fixed-length GTIN-14 padding without creating duplicate identities', () => {
    for (const [padded, canonical] of [
      ['00000096385074', '96385074'],
      ['00012345678905', '012345678905'],
      ['04006381333931', '4006381333931'],
      ['10012345000017', '10012345000017'],
    ]) {
      expect(normalizeCanonicalProductBarcode(padded)).toBe(canonical);
      expect(normalizeManualBarcode(padded)).toMatchObject({
        lookupValue: canonical,
        validChecksum: true,
      });
    }
  });

  it('rejects non-product barcode payloads', () => {
    expect(normalizeScannedBarcode('https://example.com', 'qr')).toBeNull();
  });

  it('expands UPC-E into the UPC-A catalog key and rejects a wrong supplied check digit', () => {
    expect(expandUpcEToUpcA('042526')).toBe('004252000061');
    expect(normalizeScannedBarcode('00425261', 'upc_e')).toEqual({
      value: '00425261',
      type: 'upc_e',
      validChecksum: true,
      lookupValue: '004252000061',
    });
    expect(normalizeScannedBarcode('00425262', 'upc_e')).toBeNull();
  });

  it('normalizes manually typed package numbers without accepting arbitrary short input', () => {
    expect(normalizeManualBarcode('0 36000-29145 2')).toMatchObject({
      lookupValue: '036000291452',
      validChecksum: true,
    });
    expect(normalizeManualBarcode('042526')).toBeNull();
    expect(normalizeManualBarcode('0042526')).toBeNull();
    expect(normalizeManualBarcode('12345')).toBeNull();
    expect(normalizeManualBarcode('lot 036000291452')).toBeNull();
    expect(normalizeManualBarcode('036000/291452')).toBeNull();
    expect(normalizeScannedBarcode('lot-036000291452', 'code128')).toBeNull();
    expect(normalizeScannedBarcode('036000291452', 'code128')).toBeNull();
    expect(expandUpcEToUpcA('lot042526')).toBeNull();
  });

  it('requires an explicit symbology choice for ambiguous manual eight-digit input', () => {
    expect(manualBarcodeRequiresEightDigitFormat('0042-5261')).toBe(true);
    expect(normalizeManualBarcode('00425261')).toBeNull();
    expect(normalizeManualBarcode('00425261', 'upc_e')).toMatchObject({
      type: 'upc_e',
      lookupValue: '004252000061',
    });
    expect(normalizeManualBarcode('96385074', 'ean8')).toMatchObject({
      type: 'ean8',
      lookupValue: '96385074',
      validChecksum: true,
    });
  });

  it('suppresses duplicate reads within the scan window', () => {
    expect(
      shouldSuppressDuplicate({ barcode: '4006381333931', atMs: 1000 }, '4006381333931', 2400),
    ).toBe(true);
    expect(
      shouldSuppressDuplicate({ barcode: '4006381333931', atMs: 1000 }, '4006381333931', 3000),
    ).toBe(false);
  });
});
