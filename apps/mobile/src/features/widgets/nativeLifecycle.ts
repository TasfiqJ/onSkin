import {
  ROUTINE_WIDGET_NATIVE_UNAVAILABLE,
  type RoutineWidgetNativeAuthority,
  type RoutineWidgetNativeAdmissionResult,
  type RoutineWidgetNativeCleanupResult,
  type RoutineWidgetNativeOutbox,
  type RoutineWidgetNativePublicationResult,
  type RoutineWidgetNativeQuiescenceResult,
  type RoutineWidgetNativeReconciliationResult,
  type RoutineWidgetTimelineEntry,
} from './nativeLifecycleContract';

function unavailable(): never {
  throw new Error(ROUTINE_WIDGET_NATIVE_UNAVAILABLE);
}

export function routineWidgetNativeStateConfigured(): boolean {
  return false;
}

export function readRoutineWidgetNativeAuthority(): RoutineWidgetNativeAuthority {
  return unavailable();
}

export function activateRoutineWidgetNativeOwner(_input: {
  expectedAuthorityNonce: string;
  ownerGeneration: string;
}): RoutineWidgetNativeAuthority {
  return unavailable();
}

export function publishRoutineWidgetNativeTimeline(
  _expectedAuthorityNonce: string,
  _entries: readonly RoutineWidgetTimelineEntry[],
): RoutineWidgetNativePublicationResult {
  return unavailable();
}

export function readRoutineWidgetNativeOutbox(
  _expectedAuthorityNonce: string,
): RoutineWidgetNativeOutbox {
  return unavailable();
}

export function commitRoutineWidgetNativeReconciliation(_input: {
  acceptedTokens: readonly string[];
  expectedAuthorityNonce: string;
  expectedRevision: number;
  ownerGeneration: string;
  snapshotNonce: string;
}): RoutineWidgetNativeReconciliationResult {
  return unavailable();
}

export function commitRoutineWidgetNativeQuiescedReconciliation(_input: {
  acceptedTokens: readonly string[];
  expectedAuthorityNonce: string;
  expectedRevision: number;
  ownerGeneration: string;
  quiescenceNonce: string;
  snapshotNonce: string;
}): RoutineWidgetNativeReconciliationResult {
  return unavailable();
}

export function closeRoutineWidgetNativeAdmission(): RoutineWidgetNativeAdmissionResult {
  return Object.freeze({ status: 'not_configured' });
}

export function quiesceRoutineWidgetNativeAdmission(_input: {
  expectedAuthorityNonce: string;
  ownerGeneration: string;
}): RoutineWidgetNativeQuiescenceResult {
  return Object.freeze({ status: 'not_configured', outbox: null });
}

export async function clearRoutineWidgetNativeState(): Promise<RoutineWidgetNativeCleanupResult> {
  return Object.freeze({ status: 'not_configured', authority: null, endedActivities: 0 });
}

export async function reconcileRoutineWidgetNativeActivities(): Promise<
  Readonly<{
    ended: number;
    kept: number;
  }>
> {
  return unavailable();
}
