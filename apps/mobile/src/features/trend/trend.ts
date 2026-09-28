/**
 * PHOTO-05 prerequisite quarantine.
 *
 * The former module contained descriptive threshold and tone-multiplier values
 * without a measurement or calibration authority. It was never a production
 * engine and must not be restored as one. Runtime receipt primitives live in
 * `receipt.ts`; every customer-facing Trend path remains closed.
 */
export const TREND_CANDIDATE_CLASSIFIER_QUARANTINED = true as const;
