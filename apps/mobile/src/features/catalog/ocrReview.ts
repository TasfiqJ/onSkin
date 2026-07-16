export const OCR_INGREDIENT_TEXT_MAX_LENGTH = 4_000;
export const OCR_PREVIEW_DEBOUNCE_MS = 200;
export const OCR_PREVIEW_ACTIVE_TOKEN_LIMIT = 64;

export function boundOcrIngredientText(value: string): string {
  if (value.length <= OCR_INGREDIENT_TEXT_MAX_LENGTH) return value;

  const bounded = value.slice(0, OCR_INGREDIENT_TEXT_MAX_LENGTH);
  const lastCodeUnit = bounded.charCodeAt(bounded.length - 1);
  const endsWithHighSurrogate = lastCodeUnit >= 0xd800 && lastCodeUnit <= 0xdbff;

  return endsWithHighSurrogate ? bounded.slice(0, -1) : bounded;
}

export function hasOcrIngredientText(value: string): boolean {
  return /\S/u.test(value);
}
