import { describe, expect, it } from 'vitest';

import { editedPaoSource } from './paoProvenance';

describe('PAO provenance editing', () => {
  it('preserves category-default provenance when the user taps the unchanged prefill', () => {
    expect(
      editedPaoSource({
        currentMonths: 6,
        currentSource: 'category_default',
        nextMonths: 6,
      }),
    ).toBe('category_default');
  });

  it('preserves catalog provenance when the user leaves the catalog value unchanged', () => {
    expect(
      editedPaoSource({
        currentMonths: 12,
        currentSource: 'catalog',
        nextMonths: 12,
      }),
    ).toBe('catalog');
  });

  it('marks changed PAO values as user-read from the label', () => {
    expect(
      editedPaoSource({
        currentMonths: 6,
        currentSource: 'category_default',
        nextMonths: 12,
      }),
    ).toBe('label');
  });
});
