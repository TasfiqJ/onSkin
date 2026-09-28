import type { BarcodeType } from 'expo-camera';

export const PRODUCT_BARCODE_TYPES: BarcodeType[] = ['ean13', 'upc_a', 'upc_e', 'ean8'];

export type ManualEightDigitBarcodeFormat = 'ean8' | 'upc_e';

export type NormalizedBarcode = {
  value: string;
  type: BarcodeType | 'unknown';
  validChecksum: boolean | null;
  lookupValue: string;
};

export type DuplicateBarcodeGate = {
  barcode: string;
  atMs: number;
};

function digitsOnly(raw: string): string {
  return raw.replace(/\D/g, '');
}

function hasOnlyNumericBarcodeFormatting(raw: string): boolean {
  const trimmed = raw.trim();
  return trimmed.length > 0 && /^[0-9 -]+$/.test(trimmed);
}

function upcACheckDigit(valueWithoutCheckDigit: string): string {
  const sum = valueWithoutCheckDigit
    .split('')
    .reduce((acc, char, index) => acc + Number(char) * (index % 2 === 0 ? 3 : 1), 0);
  return String((10 - (sum % 10)) % 10);
}

export function gtinChecksumIsValid(value: string): boolean {
  if (!hasOnlyNumericBarcodeFormatting(value)) return false;
  const digits = digitsOnly(value);
  if (![8, 12, 13, 14].includes(digits.length)) return false;
  const weighted = digits
    .split('')
    .reverse()
    .reduce((sum, char, index) => sum + Number(char) * (index % 2 === 0 ? 1 : 3), 0);
  return weighted % 10 === 0;
}

/** Expand the compressed UPC-E body into the 12-digit UPC-A value used by the catalog. */
export function expandUpcEToUpcA(value: string): string | null {
  if (!hasOnlyNumericBarcodeFormatting(value)) return null;
  const digits = digitsOnly(value);
  const hasNumberSystem = digits.length === 7 || digits.length === 8;
  const hasCheckDigit = digits.length === 8;
  if (![6, 7, 8].includes(digits.length)) return null;

  const numberSystem = hasNumberSystem ? digits[0]! : '0';
  if (numberSystem !== '0' && numberSystem !== '1') return null;
  const body = digits.slice(hasNumberSystem ? 1 : 0, hasNumberSystem ? 7 : 6);
  if (body.length !== 6) return null;

  const [d1, d2, d3, d4, d5, d6] = body;
  let withoutCheck: string;
  if (d6 === '0' || d6 === '1' || d6 === '2') {
    withoutCheck = `${numberSystem}${d1}${d2}${d6}0000${d3}${d4}${d5}`;
  } else if (d6 === '3') {
    withoutCheck = `${numberSystem}${d1}${d2}${d3}00000${d4}${d5}`;
  } else if (d6 === '4') {
    withoutCheck = `${numberSystem}${d1}${d2}${d3}${d4}00000${d5}`;
  } else {
    withoutCheck = `${numberSystem}${d1}${d2}${d3}${d4}${d5}0000${d6}`;
  }

  const checkDigit = upcACheckDigit(withoutCheck);
  if (hasCheckDigit && digits[7] !== checkDigit) return null;
  return `${withoutCheck}${checkDigit}`;
}

export function ean13ChecksumIsValid(value: string): boolean {
  if (!hasOnlyNumericBarcodeFormatting(value)) return false;
  const digits = digitsOnly(value);
  return digits.length === 13 && gtinChecksumIsValid(digits);
}

export function ean8ChecksumIsValid(value: string): boolean {
  if (!hasOnlyNumericBarcodeFormatting(value)) return false;
  const digits = digitsOnly(value);
  return digits.length === 8 && gtinChecksumIsValid(digits);
}

export function normalizeScannedBarcode(
  rawData: string,
  rawType?: string,
): NormalizedBarcode | null {
  if (!hasOnlyNumericBarcodeFormatting(rawData)) return null;
  const type = (rawType ?? 'unknown') as NormalizedBarcode['type'];
  const numeric = digitsOnly(rawData);
  if (!numeric) return null;

  // Code 128 commonly carries batch, lot, serial, or logistics identifiers.
  // Do not transmit it as a product GTIN without a strict GS1 parser.
  if (type === 'code128') return null;

  // expo-camera may return UPC-E as six compressed digits, number-system plus
  // body, or the complete eight digits. The catalog stores the equivalent
  // UPC-A value, so expand before the generic length-based branches.
  if (type === 'upc_e') {
    const lookupValue = expandUpcEToUpcA(numeric);
    if (!lookupValue) return null;
    return {
      value: numeric,
      type,
      validChecksum: numeric.length === 8 ? true : null,
      lookupValue,
    };
  }

  // iOS reports UPC-A as EAN-13 with a leading zero. The catalog canonicalizes
  // the equivalent GTIN as its 12-digit UPC-A key.
  if (
    (type === 'ean13' || type === 'unknown') &&
    numeric.length === 13 &&
    numeric.startsWith('0')
  ) {
    return {
      value: numeric,
      type: 'upc_a',
      validChecksum: ean13ChecksumIsValid(numeric),
      lookupValue: numeric.slice(1),
    };
  }

  if (type === 'ean13') {
    if (numeric.length !== 13) return null;
    return {
      value: numeric,
      type: 'ean13',
      validChecksum: ean13ChecksumIsValid(numeric),
      lookupValue: numeric,
    };
  }

  if (type === 'upc_a') {
    if (numeric.length !== 12) return null;
    const ean13 = `0${numeric}`;
    return {
      value: numeric,
      type: 'upc_a',
      validChecksum: ean13ChecksumIsValid(ean13),
      lookupValue: numeric,
    };
  }

  if (type === 'ean8') {
    if (numeric.length !== 8) return null;
    return {
      value: numeric,
      type: 'ean8',
      validChecksum: ean8ChecksumIsValid(numeric),
      lookupValue: numeric,
    };
  }

  if (numeric.length === 6 || numeric.length === 7) {
    const lookupValue = expandUpcEToUpcA(numeric);
    if (!lookupValue) return null;
    return {
      value: numeric,
      type: 'upc_e',
      validChecksum: null,
      lookupValue,
    };
  }

  if ([8, 12, 13, 14].includes(numeric.length)) {
    const validChecksum = gtinChecksumIsValid(numeric);
    const inferredType: NormalizedBarcode['type'] =
      numeric.length === 8
        ? 'ean8'
        : numeric.length === 12
          ? 'upc_a'
          : numeric.length === 13
            ? 'ean13'
            : 'unknown';
    return {
      value: numeric,
      type: inferredType,
      validChecksum,
      lookupValue: validChecksum ? (normalizeCanonicalProductBarcode(numeric) ?? numeric) : numeric,
    };
  }

  return null;
}

export function manualBarcodeRequiresEightDigitFormat(rawData: string): boolean {
  return hasOnlyNumericBarcodeFormatting(rawData) && digitsOnly(rawData).length === 8;
}

/** Validate and canonicalize a catalog/route GTIN without guessing UPC-E. */
export function normalizeCanonicalProductBarcode(rawData: string): string | null {
  if (!/^\d+$/.test(rawData) || !gtinChecksumIsValid(rawData)) return null;
  if (rawData.length === 14) {
    if (rawData.startsWith('000000')) return rawData.slice(6);
    if (rawData.startsWith('00')) return rawData.slice(2);
    if (rawData.startsWith('0')) return rawData.slice(1);
  }
  return rawData.length === 13 && rawData.startsWith('0') ? rawData.slice(1) : rawData;
}

/** Normalize digits typed from a package when the camera cannot read them. */
export function normalizeManualBarcode(
  rawData: string,
  eightDigitFormat?: ManualEightDigitBarcodeFormat | null,
): NormalizedBarcode | null {
  if (!hasOnlyNumericBarcodeFormatting(rawData)) return null;
  const numeric = digitsOnly(rawData);
  if (!numeric) return null;
  if (numeric.length === 8) {
    if (eightDigitFormat !== 'ean8' && eightDigitFormat !== 'upc_e') return null;
    return normalizeScannedBarcode(numeric, eightDigitFormat);
  }
  if (![12, 13, 14].includes(numeric.length)) return null;
  return normalizeScannedBarcode(numeric);
}

export function shouldSuppressDuplicate(
  previous: DuplicateBarcodeGate | null,
  barcode: string,
  nowMs: number,
  windowMs = 1800,
): boolean {
  return Boolean(previous && previous.barcode === barcode && nowMs - previous.atMs < windowMs);
}
