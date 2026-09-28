import {
  NATIVE_AGE_ASSURANCE_UNAVAILABLE,
  type NativeAgeAssuranceAdapter,
  type NativeAgeAssuranceModuleAvailability,
  type NativeAgeAssuranceResponse,
} from './nativeAgeAssuranceContract';

export function nativeAgeAssuranceAvailability(): NativeAgeAssuranceModuleAvailability {
  return 'unavailable';
}

export async function requestNativeAgeAssurance(
  _requestId: string,
): Promise<NativeAgeAssuranceResponse> {
  throw new Error(NATIVE_AGE_ASSURANCE_UNAVAILABLE);
}

export const nativeAgeAssuranceAdapter: NativeAgeAssuranceAdapter = Object.freeze({
  availability: nativeAgeAssuranceAvailability,
  request: requestNativeAgeAssurance,
});
