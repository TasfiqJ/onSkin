import {
  isRoutineExplainabilityCopyBindingImplemented,
  isRoutineStopReferEvaluatorImplemented,
} from './routineSequencingCorpus.v1';
import {
  shippableRoutineCadencePolicy,
  shippableRoutineStopReferPolicy,
  shippableSequencingRules,
  type ShippableSequencingRules,
} from './sequencing';

// Cadence, cycle variants, and ramp frequencies are draft fixtures. Development
// keeps them buildable, but production requires the exact runtime-branded
// sequencing/cadence corpus. A Boolean or environment flag cannot publish it.

/** True only when this runtime has at least one individually shippable role rule. */
export function canUseRoutineSequencing(
  rules: ShippableSequencingRules = shippableSequencingRules(),
): boolean {
  return Object.values(shippableSequencingRules(rules)).some((rule) => rule != null);
}

export function canUseRoutineCadence(): boolean {
  return shippableRoutineCadencePolicy() !== null;
}

/**
 * Recovery/irritation guidance needs an admitted stop/refer policy in addition
 * to cadence admission. The sole exception is an explicit development fixture
 * used by unit/E2E tests; it cannot be enabled in a production bundle.
 */
export function canUseRoutineRecovery(): boolean {
  const isDev = typeof __DEV__ !== 'undefined' && __DEV__;
  if (isDev && process.env.EXPO_PUBLIC_E2E_ROUTINE_RECOVERY_REVIEW_GATE === 'open_fixture') {
    return canUseRoutineCadence();
  }
  const stopReferPolicy = shippableRoutineStopReferPolicy();
  return stopReferPolicy !== null && isRoutineStopReferEvaluatorImplemented(stopReferPolicy);
}

/**
 * Why-tonight and phased-introduction contain claim-bearing causal copy beyond
 * the currently bound template. Keep them production-closed until every branch
 * is exact-corpus copy. Tests may opt into the explicitly named dev fixture.
 */
export function canUseRoutineExplainabilityCopy(): boolean {
  const isDev = typeof __DEV__ !== 'undefined' && __DEV__;
  if (isDev && process.env.EXPO_PUBLIC_E2E_ROUTINE_EXPLAINABILITY_COPY_GATE === 'open_fixture') {
    return canUseRoutineCadence();
  }
  return canUseRoutineCadence() && isRoutineExplainabilityCopyBindingImplemented();
}
