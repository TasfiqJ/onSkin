import { requireOptionalNativeModule } from 'expo';

import {
  NATIVE_AGE_ASSURANCE_CONTRACT_VERSION,
  NATIVE_AGE_ASSURANCE_EXACT_BIRTH_DATE_COLLECTED,
  NATIVE_AGE_ASSURANCE_LAUNCH_BLOCKED,
  NATIVE_AGE_ASSURANCE_MINIMUM_AGE,
  NATIVE_AGE_ASSURANCE_MINIMUM_RUNTIME,
  NATIVE_AGE_ASSURANCE_MINIMUM_SDK,
  NATIVE_AGE_ASSURANCE_PROVIDER,
  NATIVE_AGE_ASSURANCE_REVIEW_STATUS,
  normalizeNativeAgeAssuranceRequestId,
  type NativeAgeAssuranceAdapter,
  type NativeAgeAssuranceModuleAvailability,
  type NativeAgeAssuranceResponse,
} from './nativeAgeAssuranceContract';

type NativeModule = Readonly<{
  ageAssuranceContractVersion?: unknown;
  ageAssuranceReviewStatus?: unknown;
  ageAssuranceProvider?: unknown;
  ageAssuranceMinimumAge?: unknown;
  ageAssuranceMinimumRuntime?: unknown;
  ageAssuranceMinimumSdk?: unknown;
  ageAssuranceExactBirthDateCollected?: unknown;
  requestDeclaredAgeRangeJSON?: (requestId: string) => Promise<unknown>;
}>;

function loadNativeModule(): NativeModule | null {
  try {
    return requireOptionalNativeModule<NativeModule>('NativeAgeAssurance') ?? null;
  } catch {
    return null;
  }
}

const nativeModule = loadNativeModule();

function constantsAbsent(module: NativeModule | null): boolean {
  return (
    module === null ||
    (module.ageAssuranceContractVersion === undefined &&
      module.ageAssuranceReviewStatus === undefined &&
      module.ageAssuranceProvider === undefined &&
      module.ageAssuranceMinimumAge === undefined &&
      module.ageAssuranceMinimumRuntime === undefined &&
      module.ageAssuranceMinimumSdk === undefined &&
      module.ageAssuranceExactBirthDateCollected === undefined)
  );
}

function exactConstants(module: NativeModule): boolean {
  return (
    module.ageAssuranceContractVersion === NATIVE_AGE_ASSURANCE_CONTRACT_VERSION &&
    module.ageAssuranceReviewStatus === NATIVE_AGE_ASSURANCE_REVIEW_STATUS &&
    module.ageAssuranceProvider === NATIVE_AGE_ASSURANCE_PROVIDER &&
    module.ageAssuranceMinimumAge === NATIVE_AGE_ASSURANCE_MINIMUM_AGE &&
    module.ageAssuranceMinimumRuntime === NATIVE_AGE_ASSURANCE_MINIMUM_RUNTIME &&
    module.ageAssuranceMinimumSdk === NATIVE_AGE_ASSURANCE_MINIMUM_SDK &&
    module.ageAssuranceExactBirthDateCollected === NATIVE_AGE_ASSURANCE_EXACT_BIRTH_DATE_COLLECTED
  );
}

export function nativeAgeAssuranceAvailability(): NativeAgeAssuranceModuleAvailability {
  try {
    if (constantsAbsent(nativeModule)) return 'unavailable';
    if (
      nativeModule === null ||
      !exactConstants(nativeModule) ||
      typeof nativeModule.requestDeclaredAgeRangeJSON !== 'function'
    ) {
      return 'misconfigured';
    }
    // The source exists for archive/sandbox validation, but current policy,
    // entitlement, toolchain, device, server-notification, and professional
    // evidence gates are not satisfied. No production caller may invoke it.
    return 'launch_blocked';
  } catch {
    return 'misconfigured';
  }
}

export async function requestNativeAgeAssurance(
  requestIdValue: string,
): Promise<NativeAgeAssuranceResponse> {
  const requestId = normalizeNativeAgeAssuranceRequestId(requestIdValue);
  if (requestId === null) {
    throw new Error(NATIVE_AGE_ASSURANCE_LAUNCH_BLOCKED);
  }
  if (nativeAgeAssuranceAvailability() !== 'launch_blocked' || nativeModule === null) {
    throw new Error(NATIVE_AGE_ASSURANCE_LAUNCH_BLOCKED);
  }

  // Literal closed gate. Enabling this call requires an explicit reviewed
  // source change bound to the final entitlement, archive, sandbox matrix,
  // RESCIND_CONSENT server path, privacy/legal decision, and device evidence.
  throw new Error(NATIVE_AGE_ASSURANCE_LAUNCH_BLOCKED);
}

export const nativeAgeAssuranceAdapter: NativeAgeAssuranceAdapter = Object.freeze({
  availability: nativeAgeAssuranceAvailability,
  request: requestNativeAgeAssurance,
});
