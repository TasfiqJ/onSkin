import { afterEach, describe, expect, it, vi } from 'vitest';

import {
  LABEL_OCR_NATIVE_RESPONSE_INVALID,
  LABEL_OCR_TIMEOUT_MS,
  type LabelOcrNativeAdapter,
  type LabelOcrNativeCancelReceipt,
  type LabelOcrNativeResponse,
} from './contract';
import { createLabelOcrCoordinator } from './coordinator';

const REQUEST_IDS = [
  '10000000-0000-4000-8000-000000000001',
  '20000000-0000-4000-8000-000000000002',
] as const;
const MANAGED_URI =
  'file:///cache/catalog-label-photo-temp-00000000-0000-4000-8000-000000000001.jpg';

function deferred<T>() {
  let resolve!: (value: T) => void;
  let reject!: (reason?: unknown) => void;
  const promise = new Promise<T>((res, rej) => {
    resolve = res;
    reject = rej;
  });
  return { promise, resolve, reject };
}

function response(
  requestId: string,
  status: LabelOcrNativeResponse['status'] = 'recognized',
): LabelOcrNativeResponse {
  return {
    schemaVersion: 1,
    requestId,
    status,
    truncated: false,
    observations:
      status === 'recognized'
        ? [
            {
              boundingBox: { x: 0.1, y: 0.8, width: 0.8, height: 0.1 },
              candidates: [{ text: 'Water, Glycerin', confidence: 0.92 }],
            },
          ]
        : [],
  };
}

function receipt(requestId: string): LabelOcrNativeCancelReceipt {
  return { schemaVersion: 1, requestId, status: 'cancel_requested' };
}

function harness(
  options: {
    recognition?: Promise<LabelOcrNativeResponse>;
    cancellation?: Promise<LabelOcrNativeCancelReceipt>;
    availability?: ReturnType<LabelOcrNativeAdapter['availability']>;
  } = {},
) {
  let idIndex = 0;
  const adapter: LabelOcrNativeAdapter = {
    availability: vi.fn(() => options.availability ?? 'configured'),
    recognize: vi.fn(
      () => options.recognition ?? Promise.resolve(response(REQUEST_IDS[idIndex - 1]!)),
    ),
    cancel: vi.fn((requestId) => options.cancellation ?? Promise.resolve(receipt(requestId))),
  };
  const coordinator = createLabelOcrCoordinator({
    adapter,
    createRequestId: () => REQUEST_IDS[idIndex++]!,
  });
  return { adapter, coordinator };
}

afterEach(() => {
  vi.useRealTimers();
});

describe('label OCR coordinator', () => {
  it('returns an editable confidence-aware transcript for a bound current request', async () => {
    const test = harness();
    await expect(
      test.coordinator.recognize({ managedPhotoUri: MANAGED_URI, captureGeneration: 1 }),
    ).resolves.toMatchObject({
      status: 'recognized',
      requestId: REQUEST_IDS[0],
      captureGeneration: 1,
      transcript: { text: 'Water, Glycerin', confidenceCue: 'clear' },
    });
    expect(test.coordinator.snapshot()).toEqual({
      state: 'idle',
      requestId: null,
      captureGeneration: null,
    });
  });

  it.each(['not_configured', 'unavailable', 'misconfigured'] as const)(
    'does not call native recognition when availability is %s',
    async (availability) => {
      const test = harness({ availability });
      await expect(
        test.coordinator.recognize({ managedPhotoUri: MANAGED_URI, captureGeneration: 1 }),
      ).resolves.toMatchObject({ status: 'failed', reason: availability, requestId: null });
      expect(test.adapter.recognize).not.toHaveBeenCalled();
    },
  );

  it('rejects unmanaged photos and invalid generated request IDs before native work', async () => {
    const test = harness();
    await expect(
      test.coordinator.recognize({
        managedPhotoUri: 'file:///cache/not-managed.jpg',
        captureGeneration: 1,
      }),
    ).resolves.toMatchObject({ status: 'failed', reason: 'invalid_request' });

    const adapter = test.adapter;
    const invalidId = createLabelOcrCoordinator({ adapter, createRequestId: () => 'bad-id' });
    await expect(
      invalidId.recognize({ managedPhotoUri: MANAGED_URI, captureGeneration: 1 }),
    ).resolves.toMatchObject({ status: 'failed', reason: 'invalid_request' });
    expect(adapter.recognize).not.toHaveBeenCalled();
  });

  it('times out once, requests cancellation once, and quarantines until native truly settles', async () => {
    vi.useFakeTimers();
    const recognition = deferred<LabelOcrNativeResponse>();
    const test = harness({ recognition: recognition.promise });
    const attempt = test.coordinator.recognize({
      managedPhotoUri: MANAGED_URI,
      captureGeneration: 1,
    });

    await vi.advanceTimersByTimeAsync(LABEL_OCR_TIMEOUT_MS);
    await expect(attempt).resolves.toMatchObject({ status: 'timed_out' });
    expect(test.adapter.cancel).toHaveBeenCalledTimes(1);
    expect(test.coordinator.snapshot().state).toBe('quarantined');
    await expect(
      test.coordinator.recognize({ managedPhotoUri: MANAGED_URI, captureGeneration: 2 }),
    ).resolves.toMatchObject({ status: 'failed', reason: 'busy' });

    let drained = false;
    const drain = test.coordinator.drain().then(() => {
      drained = true;
    });
    await Promise.resolve();
    expect(drained).toBe(false);

    recognition.resolve(response(REQUEST_IDS[0], 'no_text'));
    await drain;
    expect(test.coordinator.snapshot().state).toBe('idle');
    expect(test.adapter.cancel).toHaveBeenCalledTimes(1);
  });

  it('maps a native timeout code to the same public timeout state before the JS deadline', async () => {
    const nativeTimeout = Object.assign(new Error('untrusted native details'), {
      code: 'E_LABEL_OCR_TIMEOUT',
    });
    const test = harness({ recognition: Promise.reject(nativeTimeout) });

    await expect(
      test.coordinator.recognize({ managedPhotoUri: MANAGED_URI, captureGeneration: 1 }),
    ).resolves.toMatchObject({
      status: 'timed_out',
      requestId: REQUEST_IDS[0],
      captureGeneration: 1,
    });
    await vi.waitFor(() => expect(test.adapter.cancel).toHaveBeenCalledTimes(1));
    expect(test.coordinator.snapshot().state).toBe('idle');
  });

  it('resolves manual cancellation once and ignores a late native result', async () => {
    const recognition = deferred<LabelOcrNativeResponse>();
    const test = harness({ recognition: recognition.promise });
    const attempt = test.coordinator.recognize({
      managedPhotoUri: MANAGED_URI,
      captureGeneration: 1,
    });

    await test.coordinator.cancel('retake');
    await test.coordinator.cancel('retake');
    await expect(attempt).resolves.toMatchObject({ status: 'cancelled', reason: 'retake' });
    expect(test.adapter.cancel).toHaveBeenCalledTimes(1);

    recognition.resolve(response(REQUEST_IDS[0]));
    await test.coordinator.drain();
    expect(test.coordinator.snapshot().state).toBe('idle');
  });

  it('maps trust-boundary failures to a stable non-sensitive reason', async () => {
    const adapter: LabelOcrNativeAdapter = {
      availability: () => 'configured',
      recognize: vi.fn(async () => {
        throw new Error(LABEL_OCR_NATIVE_RESPONSE_INVALID);
      }),
      cancel: vi.fn(async (requestId) => receipt(requestId)),
    };
    const coordinator = createLabelOcrCoordinator({
      adapter,
      createRequestId: () => REQUEST_IDS[0],
    });

    await expect(
      coordinator.recognize({ managedPhotoUri: MANAGED_URI, captureGeneration: 1 }),
    ).resolves.toEqual({
      status: 'failed',
      requestId: REQUEST_IDS[0],
      captureGeneration: 1,
      reason: 'invalid_response',
    });
  });

  it('drains the exact cancelled lease even if a new attempt starts in the await gap', async () => {
    const firstRecognition = deferred<LabelOcrNativeResponse>();
    const secondRecognition = deferred<LabelOcrNativeResponse>();
    const cancellation = deferred<LabelOcrNativeCancelReceipt>();
    let recognitionIndex = 0;
    const adapter: LabelOcrNativeAdapter = {
      availability: () => 'configured',
      recognize: vi.fn(() =>
        recognitionIndex++ === 0 ? firstRecognition.promise : secondRecognition.promise,
      ),
      cancel: vi.fn(() => cancellation.promise),
    };
    const ids = [...REQUEST_IDS];
    const coordinator = createLabelOcrCoordinator({
      adapter,
      createRequestId: () => ids.shift()!,
    });
    const firstAttempt = coordinator.recognize({
      managedPhotoUri: MANAGED_URI,
      captureGeneration: 1,
    });
    const cleanup = coordinator.cancelAndDrain('navigation');
    await expect(firstAttempt).resolves.toMatchObject({ status: 'cancelled' });

    firstRecognition.resolve(response(REQUEST_IDS[0], 'cancelled'));
    await vi.waitFor(() => expect(coordinator.snapshot().state).toBe('idle'));
    const secondAttempt = coordinator.recognize({
      managedPhotoUri: MANAGED_URI,
      captureGeneration: 2,
    });
    expect(coordinator.snapshot().state).toBe('running');

    cancellation.resolve(receipt(REQUEST_IDS[0]));
    await expect(cleanup).resolves.toBeUndefined();
    expect(coordinator.snapshot().state).toBe('running');

    secondRecognition.resolve(response(REQUEST_IDS[1], 'no_text'));
    await expect(secondAttempt).resolves.toMatchObject({ status: 'no_text' });
  });
});
