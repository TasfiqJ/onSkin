import { beforeEach, describe, expect, it, vi } from 'vitest';

import { LABEL_OCR_NATIVE_RESPONSE_INVALID, LABEL_OCR_NATIVE_UNAVAILABLE } from './contract';
import {
  cancelLabelTextRecognition,
  labelOcrNativeAvailability,
  recognizeLabelText,
} from './nativeAdapter';

const REQUEST_ID = '10000000-0000-4000-8000-000000000001';

const mocks = vi.hoisted(() => ({ env: { nativeOcrEnabled: false } }));
vi.mock('@/lib/env', () => ({ env: mocks.env }));

beforeEach(() => {
  mocks.env.nativeOcrEnabled = false;
});

describe('non-iOS label OCR adapter', () => {
  it('stays disabled when the release flag is false and unavailable when enabled', () => {
    expect(labelOcrNativeAvailability()).toBe('not_configured');
    mocks.env.nativeOcrEnabled = true;
    expect(labelOcrNativeAvailability()).toBe('unavailable');
  });

  it('never performs recognition and returns only a request-bound cancellation no-op', async () => {
    await expect(recognizeLabelText('file:///anything.jpg', REQUEST_ID)).rejects.toThrow(
      LABEL_OCR_NATIVE_UNAVAILABLE,
    );
    await expect(cancelLabelTextRecognition(REQUEST_ID)).resolves.toEqual({
      schemaVersion: 1,
      requestId: REQUEST_ID,
      status: 'not_found',
    });
    await expect(cancelLabelTextRecognition('invalid')).rejects.toThrow(
      LABEL_OCR_NATIVE_RESPONSE_INVALID,
    );
  });
});
