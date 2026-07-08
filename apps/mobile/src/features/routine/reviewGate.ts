// B-DERM-REVIEW: cadence, cycle variants, and ramp frequencies are starting
// positions until clinical/cosmetic review signs off. Dev keeps them visible so
// the flow remains buildable; production withholds them until this flips.
export const ROUTINE_CADENCE_REVIEWED = false;

export function canUseRoutineCadence(): boolean {
  const isDev = typeof __DEV__ !== 'undefined' && __DEV__;
  const forceClosedForE2E =
    isDev && process.env.EXPO_PUBLIC_E2E_ROUTINE_CADENCE_REVIEW_GATE === 'closed';
  if (forceClosedForE2E) return false;
  return isDev || ROUTINE_CADENCE_REVIEWED;
}
