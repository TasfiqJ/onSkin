import { env } from '@/lib/env';

import {
  LABEL_OCR_CONTRACT_VERSION,
  LABEL_OCR_NATIVE_UNAVAILABLE,
  LABEL_OCR_NATIVE_RESPONSE_INVALID,
  normalizeLabelOcrRequestId,
  type LabelOcrNativeAdapter,
  type LabelOcrNativeAvailability,
  type LabelOcrNativeCancelReceipt,
  type LabelOcrNativeResponse,
} from './contract';

export function labelOcrNativeAvailability(): LabelOcrNativeAvailability {
  return env.nativeOcrEnabled ? 'unavailable' : 'not_configured';
}

export async function recognizeLabelText(
  _managedPhotoUri: string,
  _requestId: string,
): Promise<LabelOcrNativeResponse> {
  throw new Error(LABEL_OCR_NATIVE_UNAVAILABLE);
}

export async function cancelLabelTextRecognition(
  requestId: string,
): Promise<LabelOcrNativeCancelReceipt> {
  const normalizedRequestId = normalizeLabelOcrRequestId(requestId);
  if (normalizedRequestId === null) {
    throw new Error(LABEL_OCR_NATIVE_RESPONSE_INVALID);
  }
  return Object.freeze({
    schemaVersion: LABEL_OCR_CONTRACT_VERSION,
    requestId: normalizedRequestId,
    status: 'not_found',
  });
}

export const labelOcrNativeAdapter: LabelOcrNativeAdapter = Object.freeze({
  availability: labelOcrNativeAvailability,
  recognize: recognizeLabelText,
  cancel: cancelLabelTextRecognition,
});
