import { requireOptionalNativeModule } from 'expo';

import {
  ROUTINE_WIDGET_NATIVE_LIFECYCLE_VERSION,
  ROUTINE_WIDGET_NATIVE_UNAVAILABLE,
  decodeRoutineWidgetNativeAuthorityJSON,
  decodeRoutineWidgetNativeCloseAdmissionJSON,
  decodeRoutineWidgetNativeCleanupJSON,
  decodeRoutineWidgetNativeOutboxJSON,
  decodeRoutineWidgetNativePublicationJSON,
  decodeRoutineWidgetNativeQuiescenceJSON,
  decodeRoutineWidgetNativeReconciliationJSON,
  encodeRoutineWidgetNativeReconciliation,
  encodeRoutineWidgetNativeQuiescedReconciliation,
  encodeRoutineWidgetNativeTimeline,
  type RoutineWidgetNativeAuthority,
  type RoutineWidgetNativeAdmissionResult,
  type RoutineWidgetNativeCleanupResult,
  type RoutineWidgetNativeOutbox,
  type RoutineWidgetNativePublicationResult,
  type RoutineWidgetNativeQuiescenceResult,
  type RoutineWidgetNativeReconciliationResult,
  type RoutineWidgetTimelineEntry,
} from './nativeLifecycleContract';

type ExpoWidgetsLifecycleModule = Readonly<{
  layerwellWidgetLifecycleVersion?: unknown;
  layerwellWidgetLifecycleConfigured?: unknown;
  layerwellReadAuthorityJSON?: () => unknown;
  layerwellActivateOwnerGeneration?: (
    expectedAuthorityNonce: string,
    ownerGeneration: string,
  ) => unknown;
  layerwellPublishTimelineJSON?: (
    expectedAuthorityNonce: string,
    timelineJSON: string,
  ) => unknown;
  layerwellReadOutboxJSON?: (expectedAuthorityNonce: string) => unknown;
  layerwellCommitReconciliationJSON?: (json: string) => unknown;
  layerwellCommitQuiescedReconciliationJSON?: (json: string) => unknown;
  layerwellCloseAdmissionJSON?: () => unknown;
  layerwellQuiesceAdmissionJSON?: (
    expectedAuthorityNonce: string,
    ownerGeneration: string,
  ) => unknown;
  layerwellClearNativeState?: () => Promise<unknown>;
  layerwellReconcileActivities?: () => Promise<unknown>;
}>;

const nativeModule = requireOptionalNativeModule<ExpoWidgetsLifecycleModule>('ExpoWidgets');

function configuredModule(): ExpoWidgetsLifecycleModule | null {
  if (
    nativeModule?.layerwellWidgetLifecycleVersion !== ROUTINE_WIDGET_NATIVE_LIFECYCLE_VERSION ||
    nativeModule.layerwellWidgetLifecycleConfigured !== true
  ) {
    return null;
  }
  return nativeModule;
}

function definitivelyUnconfigured(): boolean {
  return (
    nativeModule === null ||
    nativeModule === undefined ||
    (nativeModule.layerwellWidgetLifecycleVersion === undefined &&
      nativeModule.layerwellWidgetLifecycleConfigured === undefined) ||
    (nativeModule.layerwellWidgetLifecycleVersion === ROUTINE_WIDGET_NATIVE_LIFECYCLE_VERSION &&
      nativeModule.layerwellWidgetLifecycleConfigured === false)
  );
}

function requiredMethod<Key extends keyof ExpoWidgetsLifecycleModule>(
  name: Key,
): NonNullable<ExpoWidgetsLifecycleModule[Key]> {
  const module = configuredModule();
  const method = module?.[name];
  if (typeof method !== 'function') throw new Error(ROUTINE_WIDGET_NATIVE_UNAVAILABLE);
  return method as NonNullable<ExpoWidgetsLifecycleModule[Key]>;
}

export function routineWidgetNativeStateConfigured(): boolean {
  return configuredModule() !== null;
}

export function readRoutineWidgetNativeAuthority(): RoutineWidgetNativeAuthority {
  const value = requiredMethod('layerwellReadAuthorityJSON')();
  return decodeRoutineWidgetNativeAuthorityJSON(value);
}

export function activateRoutineWidgetNativeOwner(input: {
  expectedAuthorityNonce: string;
  ownerGeneration: string;
}): RoutineWidgetNativeAuthority {
  const value = requiredMethod('layerwellActivateOwnerGeneration')(
    input.expectedAuthorityNonce,
    input.ownerGeneration,
  );
  return decodeRoutineWidgetNativeAuthorityJSON(value);
}

export function publishRoutineWidgetNativeTimeline(
  expectedAuthorityNonce: string,
  entries: readonly RoutineWidgetTimelineEntry[],
): RoutineWidgetNativePublicationResult {
  return decodeRoutineWidgetNativePublicationJSON(
    requiredMethod('layerwellPublishTimelineJSON')(
      expectedAuthorityNonce,
      encodeRoutineWidgetNativeTimeline(entries),
    ),
  );
}

export function readRoutineWidgetNativeOutbox(
  expectedAuthorityNonce: string,
): RoutineWidgetNativeOutbox {
  const value = requiredMethod('layerwellReadOutboxJSON')(expectedAuthorityNonce);
  return decodeRoutineWidgetNativeOutboxJSON(value);
}

export function commitRoutineWidgetNativeReconciliation(input: {
  acceptedTokens: readonly string[];
  expectedAuthorityNonce: string;
  expectedRevision: number;
  ownerGeneration: string;
  snapshotNonce: string;
}): RoutineWidgetNativeReconciliationResult {
  const value = requiredMethod('layerwellCommitReconciliationJSON')(
    encodeRoutineWidgetNativeReconciliation(input),
  );
  return decodeRoutineWidgetNativeReconciliationJSON(value);
}

export function commitRoutineWidgetNativeQuiescedReconciliation(input: {
  acceptedTokens: readonly string[];
  expectedAuthorityNonce: string;
  expectedRevision: number;
  ownerGeneration: string;
  quiescenceNonce: string;
  snapshotNonce: string;
}): RoutineWidgetNativeReconciliationResult {
  const value = requiredMethod('layerwellCommitQuiescedReconciliationJSON')(
    encodeRoutineWidgetNativeQuiescedReconciliation(input),
  );
  return decodeRoutineWidgetNativeReconciliationJSON(value);
}

export function closeRoutineWidgetNativeAdmission(): RoutineWidgetNativeAdmissionResult {
  if (definitivelyUnconfigured()) {
    return Object.freeze({ status: 'not_configured' });
  }
  return decodeRoutineWidgetNativeCloseAdmissionJSON(
    requiredMethod('layerwellCloseAdmissionJSON')(),
  );
}

export function quiesceRoutineWidgetNativeAdmission(input: {
  expectedAuthorityNonce: string;
  ownerGeneration: string;
}): RoutineWidgetNativeQuiescenceResult {
  if (definitivelyUnconfigured()) {
    return Object.freeze({ status: 'not_configured', outbox: null });
  }
  return decodeRoutineWidgetNativeQuiescenceJSON(
    requiredMethod('layerwellQuiesceAdmissionJSON')(
      input.expectedAuthorityNonce,
      input.ownerGeneration,
    ),
    input.expectedAuthorityNonce,
    input.ownerGeneration,
  );
}

export async function clearRoutineWidgetNativeState(): Promise<RoutineWidgetNativeCleanupResult> {
  if (definitivelyUnconfigured()) {
    return Object.freeze({ status: 'not_configured', authority: null, endedActivities: 0 });
  }
  closeRoutineWidgetNativeAdmission();
  return decodeRoutineWidgetNativeCleanupJSON(
    await requiredMethod('layerwellClearNativeState')(),
  );
}

export async function reconcileRoutineWidgetNativeActivities(): Promise<
  Readonly<{
    ended: number;
    kept: number;
  }>
> {
  const value = await requiredMethod('layerwellReconcileActivities')();
  if (
    typeof value !== 'object' ||
    value === null ||
    Array.isArray(value) ||
    !('ended' in value) ||
    !('kept' in value) ||
    typeof value.ended !== 'number' ||
    !Number.isSafeInteger(value.ended) ||
    value.ended < 0 ||
    typeof value.kept !== 'number' ||
    !Number.isSafeInteger(value.kept) ||
    value.kept < 0 ||
    Object.keys(value).sort().join(',') !== 'ended,kept'
  ) {
    throw new Error('ROUTINE_WIDGET_NATIVE_RESPONSE_INVALID');
  }
  return Object.freeze({ ended: value.ended, kept: value.kept });
}
