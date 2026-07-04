import type { BarcodeType } from 'expo-camera';

export const PRODUCT_BARCODE_TYPES: BarcodeType[] = ['ean13', 'upc_a', 'upc_e', 'ean8', 'code128'];

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

export function ean13ChecksumIsValid(value: string): boolean {
  const digits = digitsOnly(value);
  if (digits.length !== 13) return false;
  const expected = Number(digits[12]);
  const sum = digits
    .slice(0, 12)
    .split('')
    .reduce((acc, char, index) => acc + Number(char) * (index % 2 === 0 ? 1 : 3), 0);
  return (10 - (sum % 10)) % 10 === expected;
}

export function ean8ChecksumIsValid(value: string): boolean {
  const digits = digitsOnly(value);
  if (digits.length !== 8) return false;
  const expected = Number(digits[7]);
  const sum = digits
    .slice(0, 7)
    .split('')
    .reduce((acc, char, index) => acc + Number(char) * (index % 2 === 0 ? 3 : 1), 0);
  return (10 - (sum % 10)) % 10 === expected;
}

export function normalizeScannedBarcode(rawData: string, rawType?: string): NormalizedBarcode | null {
  const type = (rawType ?? 'unknown') as NormalizedBarcode['type'];
  const numeric = digitsOnly(rawData);
  if (!numeric) return null;

  if (type === 'ean13' || numeric.length === 13) {
    return {
      value: numeric,
      type: type === 'unknown' ? 'ean13' : type,
      validChecksum: ean13ChecksumIsValid(numeric),
      lookupValue: numeric,
    };
  }

  if (type === 'upc_a' || numeric.length === 12) {
    const ean13 = `0${numeric}`;
    return {
      value: numeric,
      type: type === 'unknown' ? 'upc_a' : type,
      validChecksum: ean13ChecksumIsValid(ean13),
      lookupValue: numeric,
    };
  }

  if (type === 'ean8' || numeric.length === 8) {
    return {
      value: numeric,
      type: type === 'unknown' ? 'ean8' : type,
      validChecksum: ean8ChecksumIsValid(numeric),
      lookupValue: numeric,
    };
  }

  if (type === 'upc_e' || numeric.length === 6 || numeric.length === 7) {
    return {
      value: numeric,
      type: type === 'unknown' ? 'upc_e' : type,
      validChecksum: null,
      lookupValue: numeric,
    };
  }

  if (type === 'code128') {
    return {
      value: numeric,
      type,
      validChecksum: null,
      lookupValue: numeric,
    };
  }

  return null;
}

export function shouldSuppressDuplicate(
  previous: DuplicateBarcodeGate | null,
  barcode: string,
  nowMs: number,
  windowMs = 1800,
): boolean {
  return Boolean(previous && previous.barcode === barcode && nowMs - previous.atMs < windowMs);
}
