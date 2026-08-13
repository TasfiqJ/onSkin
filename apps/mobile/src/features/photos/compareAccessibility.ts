export const COMPARE_DIVIDER_DEFAULT_PERCENT = 52;
export const COMPARE_DIVIDER_STEP_PERCENT = 10;

export function normalizeCompareDividerPercent(value: number): number {
  if (!Number.isFinite(value)) return COMPARE_DIVIDER_DEFAULT_PERCENT;
  return Math.max(0, Math.min(100, Math.round(value)));
}

export function moveCompareDividerPercent(current: number, actionName: string): number {
  const normalized = normalizeCompareDividerPercent(current);
  if (actionName === 'increment') {
    return normalizeCompareDividerPercent(normalized + COMPARE_DIVIDER_STEP_PERCENT);
  }
  if (actionName === 'decrement') {
    return normalizeCompareDividerPercent(normalized - COMPARE_DIVIDER_STEP_PERCENT);
  }
  return normalized;
}

export function compareDividerValueText(value: number): string {
  return `${normalizeCompareDividerPercent(value)} percent of the before photo visible`;
}
