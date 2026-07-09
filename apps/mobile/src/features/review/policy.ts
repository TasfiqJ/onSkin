export type ReviewValueMoment =
  | 'seven_checkoff_days'
  | 'data_export_success'
  | 'first_reviewed_conflict'
  | 'paid_conversion_success';

export type ReviewPromptState = {
  attemptedAt: string[];
};

export type ReviewPromptDecision =
  | { ok: true }
  | {
      ok: false;
      reason: 'disabled' | 'not_value_moment' | 'annual_cap' | 'cooldown';
    };

// Privacy controls and payment completion are tracked as moments, but they are
// not satisfaction moments. Native review prompts stay tied to product value.
const VALUE_MOMENTS = new Set<ReviewValueMoment>([
  'seven_checkoff_days',
  'first_reviewed_conflict',
]);

export const REVIEW_PROMPT_POLICY = {
  maxAttemptsPer365Days: 3,
  minDaysBetweenAttempts: 30,
  annualWindowDays: 365,
} as const;

function daysBetween(a: Date, b: Date): number {
  return Math.abs(a.getTime() - b.getTime()) / 86_400_000;
}

function validDates(state: ReviewPromptState): Date[] {
  return state.attemptedAt
    .map((value) => new Date(value))
    .filter((date) => !Number.isNaN(date.getTime()))
    .sort((a, b) => a.getTime() - b.getTime());
}

export function canRequestReviewPrompt(input: {
  enabled: boolean;
  moment: ReviewValueMoment;
  state: ReviewPromptState;
  now?: Date;
}): ReviewPromptDecision {
  if (!input.enabled) return { ok: false, reason: 'disabled' };
  if (!VALUE_MOMENTS.has(input.moment)) return { ok: false, reason: 'not_value_moment' };

  const now = input.now ?? new Date();
  const attempts = validDates(input.state);
  const attemptsInWindow = attempts.filter(
    (date) => daysBetween(date, now) <= REVIEW_PROMPT_POLICY.annualWindowDays,
  );
  if (attemptsInWindow.length >= REVIEW_PROMPT_POLICY.maxAttemptsPer365Days) {
    return { ok: false, reason: 'annual_cap' };
  }

  const last = attempts.at(-1);
  if (last && daysBetween(last, now) < REVIEW_PROMPT_POLICY.minDaysBetweenAttempts) {
    return { ok: false, reason: 'cooldown' };
  }

  return { ok: true };
}

export function recordReviewAttempt(
  state: ReviewPromptState,
  now: Date = new Date(),
): ReviewPromptState {
  const cutoff = now.getTime() - REVIEW_PROMPT_POLICY.annualWindowDays * 86_400_000;
  const attemptedAt = validDates(state)
    .filter((date) => date.getTime() >= cutoff)
    .map((date) => date.toISOString());
  attemptedAt.push(now.toISOString());
  return { attemptedAt };
}
