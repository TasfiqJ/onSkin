export function normalizeWhitespace(value: string): string {
  return value.replace(/\s+/g, ' ').trim();
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
  const withoutPercent = value.replace(/\b\d+(?:\.\d+)?\s*%/g, ' ');
  const withoutDecorators = withoutPercent
    .replace(/\([^)]*\)/g, ' ')
    .replace(/^[\s*•\-–—\d.]+/g, ' ')
    .replace(/\b(?:ingredients?|inci|active ingredients?|inactive ingredients?)\b\s*:?\s*/gi, ' ');
  const normalized = normalizeWhitespace(
    withoutDecorators
      .toLowerCase()
      .replace(/[’']/g, '')
      .replace(/[^a-z0-9/+.\-\s]/g, ' ')
      .replace(/\s*\/\s*/g, ' / '),
  );
  return INGREDIENT_SYNONYMS[normalized] ?? normalized;
}

export function displayIngredientToken(value: string): string {
  const trimmed = normalizeWhitespace(value);
  if (/^ci\s+\d+/i.test(trimmed)) return trimmed.toUpperCase();
  return trimmed
    .toLowerCase()
    .replace(/\b[a-z0-9]/g, (char) => char.toUpperCase())
    .replace(/\bPh\b/g, 'pH')
    .replace(/\bSpf\b/g, 'SPF');
}

export function parsePercent(value: string): number | null {
  const match = value.match(/\b(\d+(?:\.\d+)?)\s*%/);
  if (!match) return null;
  const parsed = Number(match[1]);
  return Number.isFinite(parsed) ? parsed : null;
}

