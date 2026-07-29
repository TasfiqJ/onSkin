import type { BudgetBand, ValuesFilter } from '@onskin/types';

// The user's values / format / budget filters (docs/09 §8). These are HONEST
// personalisation. Fragrance-free can shape current type guidance when the
// relevant type/Shelf facts exist. Budget, format, and the remaining values are
// retained for a later reviewed product-matching contract; they do not silently
// influence current output. Pure data type + defaults; the local-first store
// (store.ts) persists them and mirrors to Supabase best-effort.

export type RecPreferences = {
  values: ValuesFilter[];
  budget: BudgetBand | null;
  formats: RecommendationFormat[];
};

export const RECOMMENDATION_FORMATS = ['gel', 'cream', 'fluid', 'balm', 'oil'] as const;
export type RecommendationFormat = (typeof RECOMMENDATION_FORMATS)[number];

export const DEFAULT_PREFERENCES: RecPreferences = {
  values: [],
  budget: null,
  formats: [],
};
