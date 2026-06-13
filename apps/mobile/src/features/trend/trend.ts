import type { TrendChangeState } from '@onskin/types';

// The within-person trend engine (docs/12 §6) — the noise floor + the change-state
// classification. *** It produces NO score, grade, or number. *** It only decides
// WHICH descriptive state to narrate. The actual `delta_metric` (image registration +
// SSIM/structural + colour/intensity delta on the user's own series) comes from the
// on-device CV engine, which needs a custom dev build + a validation spike
// (B-AI-ONDEVICE); here the pure classification + the fairness-adjusted noise floor are
// the tested logic. A general multimodal LLM is NEVER the engine (docs/12 §6).

/** Minimum captures in a series before any trend is offered (skin change is gradual,
 *  8–12 weeks; below this we honestly say "no clear change yet"). */
export const MIN_CAPTURES = 4;

/** A conservative base Minimal-Detectable-Change floor on the normalised delta metric
 *  (0..1). Calibrated per-device/per-user in the real engine (B-AI-ONDEVICE); this is
 *  the descriptive default. A change must EXCEED the (tone-adjusted) floor to surface. */
export const BASE_MDC = 0.12;

/**
 * Fairness adjustment (docs/12 §7, D-071): the MDC floor is set EQUAL-OR-HIGHER for
 * darker Monk tones, so a darker-skinned user is never handed a falsely confident
 * trend (erythema/colour signal is optically less reliable as melanin rises — physics,
 * not a tunable). Monk bands 1–10; unknown tone → conservative (higher).
 */
export function toneAdjustmentFactor(monkBand: number | null): number {
  if (monkBand == null) return 1.2; // unknown → conservative
  if (monkBand >= 8) return 1.4;
  if (monkBand >= 6) return 1.25;
  if (monkBand >= 4) return 1.1;
  return 1.0;
}

export function toneAdjustedMdc(monkBand: number | null, baseMdc: number = BASE_MDC): number {
  return baseMdc * toneAdjustmentFactor(monkBand);
}

export type ClassifyInput = {
  /** The on-device registered-pair delta (0..1), or null when not computable. */
  deltaMetric: number | null;
  /** Captures in the series so far. */
  captureCount: number;
  /** Whether the docs/06 lighting QA judged the pair comparable. */
  lightingConsistent: boolean;
  /** The user's Monk tone band (1–10), for the fairness-adjusted floor. */
  monkBand: number | null;
};

export type ClassifyResult = {
  changeState: TrendChangeState;
  /** The tone-adjusted MDC floor used (for the photo_trend row / transparency). */
  mdcThreshold: number;
};

/**
 * Classify the within-person change state — the ONLY output. Order matters: not enough
 * data → lighting un-comparable → (computable) below floor "consistent" vs above floor
 * "change_observed". The dominant failure mode is reporting NOISE as change, so the
 * floor is conservative and "consistent" is a celebrated, honest output (docs/12 §6).
 */
export function classifyChange(input: ClassifyInput): ClassifyResult {
  const mdcThreshold = toneAdjustedMdc(input.monkBand);
  if (input.captureCount < MIN_CAPTURES) return { changeState: 'insufficient_data', mdcThreshold };
  if (!input.lightingConsistent) return { changeState: 'inconclusive_lighting', mdcThreshold };
  if (input.deltaMetric == null) return { changeState: 'insufficient_data', mdcThreshold };
  if (Math.abs(input.deltaMetric) >= mdcThreshold) return { changeState: 'change_observed', mdcThreshold };
  return { changeState: 'consistent', mdcThreshold };
}

/** Is the change-state one that celebrates adherence (consistent) — for instrumentation. */
export function isCelebratedState(state: TrendChangeState): boolean {
  return state === 'consistent';
}
