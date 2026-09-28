/**
 * Normalize a numeric package identifier without silently deleting arbitrary
 * user input. Separators used for manual entry are accepted; letters,
 * punctuation, JSON numbers (which can lose leading zeroes), and identifiers
 * outside the supported GTIN/EAN/UPC length envelope are rejected. Valid
 * fixed-width padding collapses to one deterministic catalog identity.
 */
export function normalizeCatalogBarcode(value: unknown): string | null {
  if (typeof value !== 'string') return null;
  const trimmed = value.trim();
  if (!trimmed || !/^[0-9 -]+$/.test(trimmed)) return null;
  const digits = trimmed.replace(/[ -]/g, '');
  if (![8, 12, 13, 14].includes(digits.length)) return null;
  const weighted = digits
    .split('')
    .reverse()
    .reduce((sum, char, index) => sum + Number(char) * (index % 2 === 0 ? 1 : 3), 0);
  if (weighted % 10 !== 0) return null;
  if (digits.length === 14) {
    if (digits.startsWith('000000')) return digits.slice(6);
    if (digits.startsWith('00')) return digits.slice(2);
    if (digits.startsWith('0')) return digits.slice(1);
  }
  return digits.length === 13 && digits.startsWith('0') ? digits.slice(1) : digits;
}
