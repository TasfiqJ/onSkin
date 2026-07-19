import {
  LABEL_OCR_CONTRACT_VERSION,
  LABEL_OCR_NATIVE_RESPONSE_INVALID,
  LABEL_OCR_TIMEOUT_MS,
  isManagedLabelPhotoUri,
  isLabelOcrNativeTimeoutError,
  normalizeLabelOcrRequestId,
  type LabelOcrNativeAdapter,
  type LabelOcrNativeResponse,
} from './contract';
import { buildLabelOcrTranscript, type LabelOcrTranscript } from './transcript';

export type LabelOcrCancellationReason =
  | 'retake'
  | 'navigation'
  | 'manual_continue'
  | 'camera_failure'
  | 'dispose';

export type LabelOcrFailureReason =
  | 'not_configured'
  | 'unavailable'
  | 'misconfigured'
  | 'busy'
  | 'disposed'
  | 'invalid_request'
  | 'invalid_response'
  | 'recognition_failed';

type AttemptIdentity = Readonly<{
  requestId: string | null;
  captureGeneration: number;
}>;

export type LabelOcrAttemptResult =
  | (AttemptIdentity &
      Readonly<{
        status: 'recognized';
        transcript: LabelOcrTranscript;
      }>)
  | (AttemptIdentity & Readonly<{ status: 'no_text' }>)
  | (AttemptIdentity &
      Readonly<{
        status: 'cancelled';
        reason: LabelOcrCancellationReason | 'native';
      }>)
  | (AttemptIdentity & Readonly<{ status: 'timed_out' }>)
  | (AttemptIdentity & Readonly<{ status: 'failed'; reason: LabelOcrFailureReason }>);

export type LabelOcrCoordinatorSnapshot = Readonly<{
  state: 'idle' | 'running' | 'quarantined' | 'disposed';
  requestId: string | null;
  captureGeneration: number | null;
}>;

export type LabelOcrCoordinatorDependencies = Readonly<{
  adapter: LabelOcrNativeAdapter;
  createRequestId: () => string;
}>;

type ActiveAttempt = {
  requestId: string;
  managedPhotoUri: string;
  captureGeneration: number;
  coordinatorGeneration: number;
  publicSettled: boolean;
  nativeSettled: boolean;
  cancelIssued: boolean;
  cancelPromise: Promise<void> | null;
  timeout: ReturnType<typeof setTimeout> | null;
  resolvePublic: (result: LabelOcrAttemptResult) => void;
  resolveNativeDone: () => void;
  nativeDone: Promise<void>;
};

function immediateFailure(
  captureGeneration: number,
  reason: LabelOcrFailureReason,
): LabelOcrAttemptResult {
  return Object.freeze({ status: 'failed', requestId: null, captureGeneration, reason });
}

function validCaptureGeneration(value: unknown): value is number {
  return typeof value === 'number' && Number.isSafeInteger(value) && value > 0;
}

function responseBoundToAttempt(response: LabelOcrNativeResponse, lease: ActiveAttempt): boolean {
  return (
    response.schemaVersion === LABEL_OCR_CONTRACT_VERSION && response.requestId === lease.requestId
  );
}

export function createLabelOcrCoordinator(dependencies: LabelOcrCoordinatorDependencies) {
  let active: ActiveAttempt | null = null;
  let disposed = false;
  let coordinatorGeneration = 0;

  const settlePublic = (lease: ActiveAttempt, result: LabelOcrAttemptResult): void => {
    if (lease.publicSettled) return;
    lease.publicSettled = true;
    if (lease.timeout !== null) clearTimeout(lease.timeout);
    lease.timeout = null;
    lease.resolvePublic(Object.freeze(result));
  };

  const issueCancel = (lease: ActiveAttempt): Promise<void> => {
    if (lease.cancelIssued) return lease.cancelPromise ?? Promise.resolve();
    lease.cancelIssued = true;
    lease.cancelPromise = Promise.resolve()
      .then(() => dependencies.adapter.cancel(lease.requestId))
      .then((receipt) => {
        if (
          receipt.schemaVersion !== LABEL_OCR_CONTRACT_VERSION ||
          receipt.requestId !== lease.requestId ||
          (receipt.status !== 'cancel_requested' && receipt.status !== 'not_found')
        ) {
          throw new Error(LABEL_OCR_NATIVE_RESPONSE_INVALID);
        }
      })
      // A cancellation transport failure cannot authorize early photo deletion.
      // The native recognition promise remains quarantined until it truly settles.
      .catch(() => undefined);
    return lease.cancelPromise;
  };

  const finishNative = (lease: ActiveAttempt): void => {
    if (lease.nativeSettled) return;
    lease.nativeSettled = true;
    if (lease.timeout !== null) clearTimeout(lease.timeout);
    lease.timeout = null;
    if (active === lease) active = null;
    lease.resolveNativeDone();
  };

  const acceptNativeResponse = (lease: ActiveAttempt, response: LabelOcrNativeResponse): void => {
    if (
      lease.publicSettled ||
      active !== lease ||
      coordinatorGeneration !== lease.coordinatorGeneration
    ) {
      return;
    }

    if (!responseBoundToAttempt(response, lease)) {
      settlePublic(lease, {
        status: 'failed',
        requestId: lease.requestId,
        captureGeneration: lease.captureGeneration,
        reason: 'invalid_response',
      });
      return;
    }

    if (response.status === 'cancelled') {
      settlePublic(lease, {
        status: 'cancelled',
        requestId: lease.requestId,
        captureGeneration: lease.captureGeneration,
        reason: 'native',
      });
      return;
    }
    if (response.status === 'no_text') {
      settlePublic(lease, {
        status: 'no_text',
        requestId: lease.requestId,
        captureGeneration: lease.captureGeneration,
      });
      return;
    }

    try {
      const transcript = buildLabelOcrTranscript(response);
      if (transcript.text.length === 0) throw new Error(LABEL_OCR_NATIVE_RESPONSE_INVALID);
      settlePublic(lease, {
        status: 'recognized',
        requestId: lease.requestId,
        captureGeneration: lease.captureGeneration,
        transcript,
      });
    } catch {
      settlePublic(lease, {
        status: 'failed',
        requestId: lease.requestId,
        captureGeneration: lease.captureGeneration,
        reason: 'invalid_response',
      });
    }
  };

  const recognize = (input: {
    managedPhotoUri: string;
    captureGeneration: number;
  }): Promise<LabelOcrAttemptResult> => {
    const { captureGeneration, managedPhotoUri } = input;
    if (!validCaptureGeneration(captureGeneration) || !isManagedLabelPhotoUri(managedPhotoUri)) {
      return Promise.resolve(immediateFailure(captureGeneration, 'invalid_request'));
    }
    if (disposed) return Promise.resolve(immediateFailure(captureGeneration, 'disposed'));
    if (active !== null) return Promise.resolve(immediateFailure(captureGeneration, 'busy'));

    let availability: ReturnType<LabelOcrNativeAdapter['availability']>;
    try {
      availability = dependencies.adapter.availability();
    } catch {
      availability = 'misconfigured';
    }
    if (availability !== 'configured') {
      return Promise.resolve(immediateFailure(captureGeneration, availability));
    }

    let requestId: string | null = null;
    try {
      requestId = normalizeLabelOcrRequestId(dependencies.createRequestId());
    } catch {
      requestId = null;
    }
    if (requestId === null) {
      return Promise.resolve(immediateFailure(captureGeneration, 'invalid_request'));
    }

    let resolvePublic!: (result: LabelOcrAttemptResult) => void;
    const publicResult = new Promise<LabelOcrAttemptResult>((resolve) => {
      resolvePublic = resolve;
    });
    let resolveNativeDone!: () => void;
    const nativeDone = new Promise<void>((resolve) => {
      resolveNativeDone = resolve;
    });
    const generation = ++coordinatorGeneration;
    const lease: ActiveAttempt = {
      requestId,
      managedPhotoUri,
      captureGeneration,
      coordinatorGeneration: generation,
      publicSettled: false,
      nativeSettled: false,
      cancelIssued: false,
      cancelPromise: null,
      timeout: null,
      resolvePublic,
      resolveNativeDone,
      nativeDone,
    };
    active = lease;

    lease.timeout = setTimeout(() => {
      if (active !== lease || lease.publicSettled) return;
      coordinatorGeneration += 1;
      settlePublic(lease, {
        status: 'timed_out',
        requestId: lease.requestId,
        captureGeneration: lease.captureGeneration,
      });
      void issueCancel(lease);
    }, LABEL_OCR_TIMEOUT_MS);

    let nativeRecognition: Promise<LabelOcrNativeResponse>;
    try {
      nativeRecognition = Promise.resolve(
        dependencies.adapter.recognize(lease.managedPhotoUri, lease.requestId),
      );
    } catch (error) {
      nativeRecognition = Promise.reject(error);
    }
    void nativeRecognition
      .then((response) => acceptNativeResponse(lease, response))
      .catch((error: unknown) => {
        if (lease.publicSettled || active !== lease) return;
        if (isLabelOcrNativeTimeoutError(error)) {
          coordinatorGeneration += 1;
          settlePublic(lease, {
            status: 'timed_out',
            requestId: lease.requestId,
            captureGeneration: lease.captureGeneration,
          });
          void issueCancel(lease);
          return;
        }
        settlePublic(lease, {
          status: 'failed',
          requestId: lease.requestId,
          captureGeneration: lease.captureGeneration,
          reason:
            error instanceof Error && error.message === LABEL_OCR_NATIVE_RESPONSE_INVALID
              ? 'invalid_response'
              : 'recognition_failed',
        });
      })
      .finally(() => finishNative(lease));

    return publicResult;
  };

  const cancelLease = async (
    lease: ActiveAttempt,
    reason: LabelOcrCancellationReason,
  ): Promise<void> => {
    if (!lease.publicSettled) {
      coordinatorGeneration += 1;
      settlePublic(lease, {
        status: 'cancelled',
        requestId: lease.requestId,
        captureGeneration: lease.captureGeneration,
        reason,
      });
    }
    await issueCancel(lease);
  };

  const cancel = async (reason: LabelOcrCancellationReason): Promise<void> => {
    const lease = active;
    if (lease === null) return;
    await cancelLease(lease, reason);
  };

  const drain = (): Promise<void> => active?.nativeDone ?? Promise.resolve();

  const cancelAndDrain = async (reason: LabelOcrCancellationReason): Promise<void> => {
    const lease = active;
    if (lease === null) return;
    await cancelLease(lease, reason);
    await lease.nativeDone;
  };

  const dispose = async (): Promise<void> => {
    disposed = true;
    await cancelAndDrain('dispose');
  };

  const snapshot = (): LabelOcrCoordinatorSnapshot => {
    if (active !== null) {
      return Object.freeze({
        state: active.publicSettled ? 'quarantined' : 'running',
        requestId: active.requestId,
        captureGeneration: active.captureGeneration,
      });
    }
    return Object.freeze({
      state: disposed ? 'disposed' : 'idle',
      requestId: null,
      captureGeneration: null,
    });
  };

  return Object.freeze({ recognize, cancel, cancelAndDrain, drain, dispose, snapshot });
}
