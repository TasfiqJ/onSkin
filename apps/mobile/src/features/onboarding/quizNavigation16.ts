/** One transition per rendered question; total is the final route sentinel. */
export function quizNavigation16(
  current: number,
  rendered: number,
  total: number,
  answered: boolean,
  direction: 'next' | 'back',
): number | null {
  if (current !== rendered || rendered < 0 || rendered >= total) return null;
  if (direction === 'back') return rendered > 0 ? rendered - 1 : null;
  return answered ? rendered + 1 : null;
}
