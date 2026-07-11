import type { PaoSource } from '@onskin/types';

// A changed number is not evidence by itself. Only an explicit confirmation that
// the user read the open-jar symbol may promote the source to `label`.
export function editedPaoSource(input: {
  currentMonths: number | null;
  currentSource: PaoSource;
  nextMonths: number;
  confirmedFromLabel: boolean;
}): PaoSource {
  if (input.confirmedFromLabel) return 'label';
  return input.currentMonths === input.nextMonths ? input.currentSource : 'unknown';
}
