import { requireOptionalNativeModule } from 'expo';

import { env } from '@/lib/env';

import {
  LABEL_OCR_CONTRACT_VERSION,
  LABEL_OCR_ENGINE,
  LABEL_OCR_NATIVE_UNAVAILABLE,
  LABEL_OCR_NATIVE_RESPONSE_INVALID,
  LABEL_OCR_RECOGNITION_LEVEL,
  LABEL_OCR_REQUEST_REVISION,
  LABEL_OCR_RUNS_ON_DEVICE,
  decodeLabelOcrNativeCancelReceiptJSON,
  decodeLabelOcrNativeResponseJSON,
  isManagedLabelPhotoUri,
  normalizeLabelOcrRequestId,
  type LabelOcrNativeAdapter,
  type LabelOcrNativeAvailability,
  type LabelOcrNativeCancelReceipt,
  type LabelOcrNativeResponse,
} from './contract';

type NativeLabelOcrModule = Readonly<{
  labelOcrContractVersion?: unknown;
  labelOcrConfigured?: unknown;
  labelOcrEngine?: unknown;
  labelOcrRequestRevision?: unknown;
  labelOcrRecognitionLevel?: unknown;
  labelOcrRunsOnDevice?: unknown;
  recognizeLabelTextJSON?: (managedPhotoUri: string, requestId: string) => Promise<unknown>;
  cancelLabelTextRecognitionJSON?: (requestId: string) => unknown;
}>;

function loadNativeModule(): NativeLabelOcrModule | null {
  try {
    return requireOptionalNativeModule<NativeLabelOcrModule>('NativeLabelOcr') ?? null;
  } catch {
    // A malformed native registry must degrade to manual entry instead of
    // crashing every route that imports the adapter.
    return null;
  }
}

const nativeModule = loadNativeModule();

function constantsAbsent(module: NativeLabelOcrModule | null): boolean {
  return (
    module === null ||
    (module.labelOcrContractVersion === undefined &&
      module.labelOcrConfigured === undefined &&
      module.labelOcrEngine === undefined &&
      module.labelOcrRequestRevision === undefined &&
      module.labelOcrRecognitionLevel === undefined &&
      module.labelOcrRunsOnDevice === undefined)
  );
}

function canonicalConstants(module: NativeLabelOcrModule): boolean {
  return (
    module.labelOcrContractVersion === LABEL_OCR_CONTRACT_VERSION &&
    module.labelOcrEngine === LABEL_OCR_ENGINE &&
    module.labelOcrRequestRevision === LABEL_OCR_REQUEST_REVISION &&
    module.labelOcrRecognitionLevel === LABEL_OCR_RECOGNITION_LEVEL &&
    module.labelOcrRunsOnDevice === LABEL_OCR_RUNS_ON_DEVICE
  );
}

export function labelOcrNativeAvailability(): LabelOcrNativeAvailability {
  if (!env.nativeOcrEnabled) return 'not_configured';
  try {
    if (constantsAbsent(nativeModule)) return 'unavailable';
    if (
      nativeModule !== null &&
      canonicalConstants(nativeModule) &&
      nativeModule.labelOcrConfigured === false
    ) {
      return 'unavailable';
    }
    if (
      nativeModule !== null &&
      canonicalConstants(nativeModule) &&
      nativeModule.labelOcrConfigured === true &&
      typeof nativeModule.recognizeLabelTextJSON === 'function' &&
      typeof nativeModule.cancelLabelTextRecognitionJSON === 'function'
    ) {
      return 'configured';
    }
    return 'misconfigured';
  } catch {
    return 'misconfigured';
  }
}

function configuredModule(): NativeLabelOcrModule {
  if (labelOcrNativeAvailability() !== 'configured' || nativeModule === null) {
    throw new Error(LABEL_OCR_NATIVE_UNAVAILABLE);
  }
  return nativeModule;
}

export async function recognizeLabelText(
  managedPhotoUri: string,
  requestId: string,
): Promise<LabelOcrNativeResponse> {
  if (
    !isManagedLabelPhotoUri(managedPhotoUri) ||
    normalizeLabelOcrRequestId(requestId) !== requestId
  ) {
    throw new Error(LABEL_OCR_NATIVE_RESPONSE_INVALID);
  }
  const method = configuredModule().recognizeLabelTextJSON;
  if (typeof method !== 'function') throw new Error(LABEL_OCR_NATIVE_UNAVAILABLE);
  return decodeLabelOcrNativeResponseJSON(await method(managedPhotoUri, requestId), requestId);
}

export async function cancelLabelTextRecognition(
  requestId: string,
): Promise<LabelOcrNativeCancelReceipt> {
  if (normalizeLabelOcrRequestId(requestId) !== requestId) {
    throw new Error(LABEL_OCR_NATIVE_RESPONSE_INVALID);
  }
  const method = configuredModule().cancelLabelTextRecognitionJSON;
  if (typeof method !== 'function') throw new Error(LABEL_OCR_NATIVE_UNAVAILABLE);
  return decodeLabelOcrNativeCancelReceiptJSON(await method(requestId), requestId);
}

export const labelOcrNativeAdapter: LabelOcrNativeAdapter = Object.freeze({
  availability: labelOcrNativeAvailability,
  recognize: recognizeLabelText,
  cancel: cancelLabelTextRecognition,
});
