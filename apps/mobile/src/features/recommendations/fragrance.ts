export type FragranceMarkerInput = Readonly<{
  name: string;
  ingredients: readonly string[];
}>;

export function isCurrentFragranceFreeRecommendationType(type: { type: string }): boolean {
  return type.type === 'fragrance_free_cleanser';
}

/**
 * Treat only an explicit saved fragrance/parfum/perfume marker as positive.
 * Negative label wording must never be inverted into a better-fit trigger.
 */
export function hasExplicitFragranceMarker(input: FragranceMarkerInput): boolean {
  return [input.name, ...input.ingredients].some((text) => {
    const normalized = text.trim().toLowerCase();
    if (!normalized) return false;
    if (
      /\b(?:fragrance|parfum|perfume)[ -]?free\b/u.test(normalized) ||
      /\b(?:no|without)\s+(?:added\s+)?(?:fragrance|parfum|perfume)\b/u.test(normalized)
    ) {
      return false;
    }
    return /\b(?:fragrance|parfum|perfume)\b/u.test(normalized);
  });
}
