import type { PaoSource } from '@onskin/types';

// Editing a PAO value should not make an estimate look label-backed unless the
// user actually changes the value from the prefilled source (docs/04 §3).
export function editedPaoSource(input: {
  currentMonths: number | null;
  currentSource: PaoSource;
  nextMonths: number;
}): PaoSource {
  return input.currentMonths === input.nextMonths ? input.currentSource : 'label';
}
