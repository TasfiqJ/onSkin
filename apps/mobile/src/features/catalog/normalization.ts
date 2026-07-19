export function normalizeWhitespace(value: string): string {
  return value.normalize('NFC').replace(/\s+/gu, ' ').trim();
}

/** Normalize common label separators without compatibility-folding OCR text. */
export function normalizeIngredientSeparators(value: string): string {
  return value
    .normalize('NFC')
    .replace(/[，、،]/gu, ',')
    .replace(/[；؛]/gu, ';');
}

export function normalizeBarcode(value: string | null | undefined): string | null {
  if (!value) return null;
  const digits = value.replace(/\D/g, '');
  if (digits.length < 8 || digits.length > 14) return null;
  return digits;
}

export function normalizeBrandName(value: string | null | undefined): string | null {
  if (!value) return null;
  const normalized = normalizeWhitespace(value).toLowerCase();
  return normalized.length > 0 ? normalized : null;
}

export function normalizeProductName(value: string | null | undefined): string | null {
  if (!value) return null;
  const normalized = normalizeWhitespace(value);
  return normalized.length > 0 ? normalized : null;
}

const INGREDIENT_SYNONYMS: Record<string, string> = {
  'aqua / water / eau': 'water',
  'aqua/water/eau': 'water',
  aqua: 'water',
  eau: 'water',
  glycerine: 'glycerin',
  nicotinamide: 'niacinamide',
  'vitamin e': 'tocopherol',
};

export function normalizeIngredientToken(value: string): string {
  const withoutPercent = value.normalize('NFC').replace(/\b\d+(?:\.\d+)?\s*%/gu, ' ');
  const withoutDecorators = withoutPercent
    .replace(/\([^)]*\)/gu, ' ')
    .replace(/^\s*(?:[*•\-–—]+|\p{N}+[.)]\s+)/gu, ' ')
    .replace(/\b(?:ingredients?|inci|active ingredients?|inactive ingredients?)\b\s*:?\s*/giu, ' ');
  const normalized = normalizeWhitespace(
    withoutDecorators
      .toLowerCase()
      .replace(/[’']/gu, '')
      .replace(/[^\p{L}\p{M}\p{N}/+.,\-\s]/gu, ' ')
      .replace(/\s*,\s*/gu, ',')
      .replace(/\s*\/\s*/gu, ' / '),
  );
  return INGREDIENT_SYNONYMS[normalized] ?? normalized;
}

export function displayIngredientToken(value: string): string {
  const trimmed = normalizeWhitespace(value);
  if (/^ci\s+\d+/i.test(trimmed)) return trimmed.toUpperCase();
  return trimmed
    .toLowerCase()
    .replace(
      /(^|[\s/+\.\-])(\p{L}|\p{N})/gu,
      (_match, prefix: string, char: string) => `${prefix}${char.toUpperCase()}`,
    )
    .replace(/\bPh\b/gu, 'pH')
    .replace(/\bSpf\b/gu, 'SPF');
}

export function parsePercent(value: string): number | null {
  const match = value.match(/\b(\d+(?:\.\d+)?)\s*%/);
  if (!match) return null;
  const parsed = Number(match[1]);
  return Number.isFinite(parsed) ? parsed : null;
}
