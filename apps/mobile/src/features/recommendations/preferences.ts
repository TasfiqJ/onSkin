import type { BudgetBand, ValuesFilter } from '@onskin/types';

// The user's values / format / budget filters (docs/09 §8). These are HONEST
// personalisation. They constrain *what fits you*, not *what sells*. And they
// hard-constrain the candidate set (fit.ts). Pure data type + defaults; the
// local-first store (store.ts) persists them and mirrors to Supabase best-effort.

export type RecPreferences = {
  values: ValuesFilter[];
  budget: BudgetBand | null;
  formats: string[]; // 'gel' | 'cream' | 'fluid' | 'balm' | 'oil' | ...
};

export const DEFAULT_PREFERENCES: RecPreferences = {
  values: [],
  budget: null,
  formats: [],
};
