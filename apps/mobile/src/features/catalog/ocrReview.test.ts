import { describe, expect, it } from 'vitest';

import {
  OCR_INGREDIENT_TEXT_MAX_LENGTH,
  OCR_PREVIEW_ACTIVE_TOKEN_LIMIT,
  OCR_PREVIEW_DEBOUNCE_MS,
  boundOcrIngredientText,
  hasOcrIngredientText,
} from './ocrReview';

describe('OCR ingredient review contract', () => {
  it('uses a short preview debounce without delaying the raw input', () => {
    expect(OCR_PREVIEW_DEBOUNCE_MS).toBe(200);
  });

  it("matches the external catalog lookup's 4,000-code-unit ceiling", () => {
    const input = `water, ${'a'.repeat(OCR_INGREDIENT_TEXT_MAX_LENGTH)}`;
    const bounded = boundOcrIngredientText(input);

    expect(bounded).toHaveLength(OCR_INGREDIENT_TEXT_MAX_LENGTH);
    expect(bounded).toBe(input.slice(0, OCR_INGREDIENT_TEXT_MAX_LENGTH));
  });

  it('does not split a surrogate pair at the input ceiling', () => {
    const prefix = 'a'.repeat(OCR_INGREDIENT_TEXT_MAX_LENGTH - 1);
    const bounded = boundOcrIngredientText(`${prefix}🙂 trailing text`);

    expect(bounded).toBe(prefix);
    expect(bounded).toHaveLength(OCR_INGREDIENT_TEXT_MAX_LENGTH - 1);
  });

  it('defines a 64-row active-token preview cap', () => {
    expect(OCR_PREVIEW_ACTIVE_TOKEN_LIMIT).toBe(64);
  });

  it('requires visible label text before continuing', () => {
    expect(hasOcrIngredientText('')).toBe(false);
    expect(hasOcrIngredientText(' \n\t ')).toBe(false);
    expect(hasOcrIngredientText(' Water ')).toBe(true);
  });
});
