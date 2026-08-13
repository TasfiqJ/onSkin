// The grounded-turn gate (docs/13 §15). The DETERMINISTIC, on-device, $0 advisor (the
// moat taste. Conflict / routine / replenish answers about the user's own shelf) is
// ALWAYS free. Only the deeper, CLOUD-grounded language layer is Pro-gated, and within
// Pro it carries a hard TRIAL CAP (a small taste, then the paywall). Paid users are
// uncapped. Pure + unit-tested; mirrors the deriveState purity (docs/08 §4).

/** A small pre-paywall taste of grounded turns during the trial / reverse trial. */
export const ASK_TRIAL_GROUNDED_CAP = 5;

export type AskGateInput = {
  isPro: boolean;
  inTrial: boolean;
  inReverseTrial: boolean;
  /** Grounded (cloud) turns used in the current period. Deterministic turns never count. */
  groundedTurnsUsed: number;
  cap?: number;
};

export type AskGateResult = {
  /** Whether a CLOUD-grounded turn may proceed (deterministic answers ignore this). */
  groundedAllowed: boolean;
  capReached: boolean;
  /** Why a grounded turn is blocked. Drives the Pro upsell vs the trial-cap message. */
  reason: 'free_locked' | 'cap_reached' | null;
  /** Grounded turns left in the trial taste (null when uncapped / fully paid). */
  remaining: number | null;
};

/** Only trial-shaped Pro access consumes the private monthly turn journal. */
export function requiresTrialGroundedQuota(
  input: Pick<AskGateInput, 'isPro' | 'inTrial' | 'inReverseTrial'>,
): boolean {
  return input.isPro && (input.inTrial || input.inReverseTrial);
}

/** Do not mislabel unavailable cloud access as a free-user paywall decision. */
export function groundedReasonForCloudReadiness(
  gateReason: AskGateResult['reason'],
  cloudGateEnabled: boolean,
  cloudGroundingReady: boolean,
): AskGateResult['reason'] {
  return cloudGateEnabled && !cloudGroundingReady ? null : gateReason;
}

/** Decide whether a cloud-grounded turn is permitted (docs/13 §15). */
export function askGate(input: AskGateInput): AskGateResult {
  const cap = input.cap ?? ASK_TRIAL_GROUNDED_CAP;

  // Free users: the grounded layer is Pro. The deterministic advisor stays free.
  if (!input.isPro) {
    return { groundedAllowed: false, capReached: false, reason: 'free_locked', remaining: 0 };
  }

  // Trial / reverse-trial: a hard cap on the grounded taste.
  const capped = requiresTrialGroundedQuota(input);
  if (capped) {
    const remaining = Math.max(0, cap - input.groundedTurnsUsed);
    if (remaining <= 0) {
      return { groundedAllowed: false, capReached: true, reason: 'cap_reached', remaining: 0 };
    }
    return { groundedAllowed: true, capReached: false, reason: null, remaining };
  }

  // Fully paid: uncapped.
  return { groundedAllowed: true, capReached: false, reason: null, remaining: null };
}
