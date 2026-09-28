import { beforeEach, describe, expect, it, vi } from 'vitest';

import { LABEL_OCR_NATIVE_RESPONSE_INVALID } from './contract';
import {
  cancelLabelTextRecognition,
  labelOcrNativeAvailability,
  recognizeLabelText,
} from './nativeAdapter.ios';

const REQUEST_ID = '10000000-0000-4000-8000-000000000001';
const MANAGED_URI =
  'file:///cache/catalog-label-photo-temp-00000000-0000-4000-8000-000000000001.jpg';

const mocks = vi.hoisted(() => ({
  env: { nativeOcrEnabled: true },
  values: {} as Record<string, unknown>,
  throwOnAccess: false,
  throwOnRequire: false,
}));

vi.mock('@/lib/env', () => ({ env: mocks.env }));
vi.mock('expo', () => ({
  requireOptionalNativeModule: () => {
    if (mocks.throwOnRequire) throw new Error('UNTRUSTED_NATIVE_REGISTRY_DETAIL');
    return new Proxy(
      {},
      {
        get: (_target, property) => {
          if (mocks.throwOnAccess) throw new Error('UNTRUSTED_NATIVE_GETTER_DETAIL');
          return mocks.values[String(property)];
        },
      },
    );
  },
}));

function configureNative(configured = true): void {
  Object.assign(mocks.values, {
    labelOcrContractVersion: 1,
    labelOcrConfigured: configured,
    labelOcrEngine: 'apple_vision_legacy',
    labelOcrRequestRevision: 3,
    labelOcrRecognitionLevel: 'accurate',
    labelOcrRunsOnDevice: true,
  });
}

function recognizedJSON(): string {
  return JSON.stringify({
    schemaVersion: 1,
    requestId: REQUEST_ID,
    status: 'recognized',
    truncated: false,
    observations: [
      {
        boundingBox: { x: 0.1, y: 0.1, width: 0.8, height: 0.1 },
        candidates: [{ text: 'Water', confidence: 0.92 }],
      },
    ],
  });
}

beforeEach(() => {
  mocks.env.nativeOcrEnabled = true;
  mocks.throwOnAccess = false;
  mocks.throwOnRequire = false;
  for (const key of Object.keys(mocks.values)) delete mocks.values[key];
});

describe('iOS native label OCR adapter', () => {
  it('fails closed on the release flag before inspecting native constants', () => {
    mocks.env.nativeOcrEnabled = false;
    mocks.values.labelOcrContractVersion = 999;
    expect(labelOcrNativeAvailability()).toBe('not_configured');
  });

  it('distinguishes an enabled missing module from malformed native constants', () => {
    expect(labelOcrNativeAvailability()).toBe('unavailable');

    configureNative();
    mocks.values.labelOcrEngine = 'unexpected_engine';
    expect(labelOcrNativeAvailability()).toBe('misconfigured');

    configureNative(false);
    expect(labelOcrNativeAvailability()).toBe('unavailable');
  });

  it('fails a throwing native constant getter into misconfigured without crashing render', () => {
    mocks.throwOnAccess = true;

    expect(labelOcrNativeAvailability()).toBe('misconfigured');
  });

  it('fails a throwing native registry lookup into unavailable without crashing import', async () => {
    mocks.throwOnRequire = true;
    vi.resetModules();

    const isolatedAdapter = await import('./nativeAdapter.ios');

    expect(isolatedAdapter.labelOcrNativeAvailability()).toBe('unavailable');
  });

  it('requires the exact six constants and both bridge methods', () => {
    configureNative();
    mocks.values.recognizeLabelTextJSON = vi.fn();
    expect(labelOcrNativeAvailability()).toBe('misconfigured');

    mocks.values.cancelLabelTextRecognitionJSON = vi.fn();
    expect(labelOcrNativeAvailability()).toBe('configured');
  });

  it('binds recognition and cancellation responses to the request ID', async () => {
    configureNative();
    const recognize = vi.fn(async () => recognizedJSON());
    const cancel = vi.fn(() =>
      JSON.stringify({ schemaVersion: 1, requestId: REQUEST_ID, status: 'cancel_requested' }),
    );
    mocks.values.recognizeLabelTextJSON = recognize;
    mocks.values.cancelLabelTextRecognitionJSON = cancel;

    await expect(recognizeLabelText(MANAGED_URI, REQUEST_ID)).resolves.toMatchObject({
      requestId: REQUEST_ID,
      status: 'recognized',
    });
    await expect(cancelLabelTextRecognition(REQUEST_ID)).resolves.toEqual({
      schemaVersion: 1,
      requestId: REQUEST_ID,
      status: 'cancel_requested',
    });
    expect(recognize).toHaveBeenCalledWith(MANAGED_URI, REQUEST_ID);
    expect(cancel).toHaveBeenCalledWith(REQUEST_ID);
  });

  it('rejects malformed or cross-request native results without leaking their contents', async () => {
    configureNative();
    mocks.values.recognizeLabelTextJSON = vi.fn(async () =>
      recognizedJSON().replace(REQUEST_ID, '20000000-0000-4000-8000-000000000002'),
    );
    mocks.values.cancelLabelTextRecognitionJSON = vi.fn(() =>
      JSON.stringify({ schemaVersion: 1, requestId: REQUEST_ID, status: 'cancel_requested' }),
    );

    await expect(recognizeLabelText(MANAGED_URI, REQUEST_ID)).rejects.toThrow(
      LABEL_OCR_NATIVE_RESPONSE_INVALID,
    );
    await expect(cancelLabelTextRecognition('not-a-request-id')).rejects.toThrow(
      LABEL_OCR_NATIVE_RESPONSE_INVALID,
    );
    expect(mocks.values.recognizeLabelTextJSON).toHaveBeenCalledTimes(1);

    await expect(recognizeLabelText('file:///cache/unmanaged.jpg', REQUEST_ID)).rejects.toThrow(
      LABEL_OCR_NATIVE_RESPONSE_INVALID,
    );
    expect(mocks.values.recognizeLabelTextJSON).toHaveBeenCalledTimes(1);
  });
});
