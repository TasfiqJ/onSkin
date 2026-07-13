import { describe, expect, it, vi } from 'vitest';

import {
  ACCOUNT_GENERATION_CHANGED,
  beginAccountGenerationBoundary,
  endAccountGenerationBoundary,
  runAccountGenerationOperation,
  waitForAccountGenerationOperationsToSettle,
  type AccountGenerationLease,
} from '@/lib/auth/accountGeneration';
import type {
  PlaintextStagingHandle,
  PlaintextStagingPurpose,
} from '@/lib/storage/plaintextStaging';

import {
  CAPTURE_STAGING_CLEANUP_FAILED,
  CaptureStagingCleanupError,
  createCaptureStagingOperations,
} from './captureStaging';

vi.mock('expo-file-system/legacy', () => ({
  deleteAsync: vi.fn(),
  moveAsync: vi.fn(),
}));

vi.mock('@/lib/storage/plaintextStaging', () => ({
  cleanupPlaintextStaging: vi.fn(),
  lookupPlaintextStaging: vi.fn(),
  markPlaintextStagingState: vi.fn(),
  reservePlaintextStaging: vi.fn(),
}));

const CAPTURE_HANDLE: PlaintextStagingHandle = {
  operationId: 'aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa',
  purpose: 'photo_capture_jpeg',
  uri: 'file://cache/private-plaintext-staging-v1/aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa.jpg',
};
const ANALYSIS_HANDLE: PlaintextStagingHandle = {
  operationId: 'bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb',
  purpose: 'photo_analysis_jpeg',
  uri: 'file://cache/private-plaintext-staging-v1/bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb.jpg',
};
const LABEL_HANDLE: PlaintextStagingHandle = {
  operationId: 'cccccccccccccccccccccccccccccccc',
  purpose: 'label_capture_jpeg',
  uri: 'file://cache/private-plaintext-staging-v1/cccccccccccccccccccccccccccccccc.jpg',
};

function fakeLease(): AccountGenerationLease {
  const controller = new AbortController();
  return {
    generation: 0,
    signal: controller.signal,
    assertCurrent: vi.fn(),
    beginBoundaryHandoff: vi.fn(() => () => undefined),
  };
}

function createHarness() {
  const files = new Set<string>();
  const order: string[] = [];
  const reserve = vi.fn(async (purpose: PlaintextStagingPurpose) => {
    order.push(`reserve:${purpose}`);
    if (purpose === 'photo_analysis_jpeg') return ANALYSIS_HANDLE;
    return purpose === 'label_capture_jpeg' ? LABEL_HANDLE : CAPTURE_HANDLE;
  });
  const cleanup = vi.fn(async (handle: PlaintextStagingHandle) => {
    order.push(`cleanup:${handle.purpose}`);
    files.delete(handle.uri);
  });
  const markWritten = vi.fn(async (handle: PlaintextStagingHandle) => {
    order.push(`mark:${handle.purpose}`);
  });
  const lookup = vi.fn(async (operationId: string, purpose: PlaintextStagingPurpose) =>
    operationId === CAPTURE_HANDLE.operationId && purpose === 'photo_capture_jpeg'
      ? CAPTURE_HANDLE
      : null,
  );
  const moveAsync = vi.fn(async ({ from, to }: { from: string; to: string }) => {
    order.push('move');
    files.delete(from);
    files.add(to);
  });
  const deleteAsync = vi.fn(async (uri: string) => {
    order.push('delete-ingress');
    files.delete(uri);
  });
  const operations = createCaptureStagingOperations({
    reserve,
    cleanup,
    lookup,
    markWritten,
    fileSystem: { moveAsync, deleteAsync },
  });
  return {
    cleanup,
    deleteAsync,
    files,
    lookup,
    markWritten,
    moveAsync,
    operations,
    order,
    reserve,
  };
}

describe('progress capture plaintext staging', () => {
  it('reserves before native capture, moves immediately, and returns only an opaque handle', async () => {
    const harness = createHarness();
    const cameraUri = 'file://cache/Camera/native-output.jpg';
    harness.files.add(cameraUri);

    const result = await harness.operations.captureForReview(fakeLease(), async () => {
      harness.order.push('take-picture');
      return { uri: cameraUri, width: 1200, height: 1600, format: 'jpg' };
    });

    expect(result).toEqual({ handle: CAPTURE_HANDLE, width: 1200, height: 1600 });
    expect(harness.order).toEqual([
      'reserve:photo_capture_jpeg',
      'take-picture',
      'move',
      'mark:photo_capture_jpeg',
    ]);
    expect(harness.files.has(cameraUri)).toBe(false);
    expect(harness.files.has(CAPTURE_HANDLE.uri)).toBe(true);
  });

  it('keeps an A-to-B boundary draining until delayed camera output is adopted and cleaned', async () => {
    const harness = createHarness();
    const cameraUri = 'file://cache/Camera/account-a.jpg';
    let releasePicture!: () => void;
    let markPictureStarted!: () => void;
    const pictureGate = new Promise<void>((resolve) => {
      releasePicture = resolve;
    });
    const pictureStarted = new Promise<void>((resolve) => {
      markPictureStarted = resolve;
    });
    let releaseCleanup!: () => void;
    const cleanupGate = new Promise<void>((resolve) => {
      releaseCleanup = resolve;
    });
    harness.cleanup.mockImplementationOnce(async () => {
      await cleanupGate;
      harness.files.delete(CAPTURE_HANDLE.uri);
    });

    const pending = runAccountGenerationOperation((lease) =>
      harness.operations.captureForReview(lease, async () => {
        markPictureStarted();
        await pictureGate;
        harness.files.add(cameraUri);
        return { uri: cameraUri, width: 1200, height: 1600, format: 'jpg' };
      }),
    );
    await pictureStarted;
    beginAccountGenerationBoundary();
    try {
      let drained = false;
      const drain = waitForAccountGenerationOperationsToSettle().then(() => {
        drained = true;
      });
      releasePicture();
      await vi.waitFor(() => expect(harness.cleanup).toHaveBeenCalledWith(CAPTURE_HANDLE));
      expect(drained).toBe(false);
      expect(harness.moveAsync).toHaveBeenCalledWith({
        from: cameraUri,
        to: CAPTURE_HANDLE.uri,
      });

      releaseCleanup();
      await expect(pending).rejects.toThrow(ACCOUNT_GENERATION_CHANGED);
      await drain;
      expect(drained).toBe(true);
      expect(harness.files.has(cameraUri)).toBe(false);
      expect(harness.files.has(CAPTURE_HANDLE.uri)).toBe(false);
    } finally {
      endAccountGenerationBoundary();
    }
  });

  it('deletes native ingress and releases the reservation when adoption fails', async () => {
    const harness = createHarness();
    const cameraUri = 'file://cache/Camera/failed-move.jpg';
    harness.files.add(cameraUri);
    harness.moveAsync.mockRejectedValueOnce(new Error('rename failed'));

    await expect(
      harness.operations.captureForReview(fakeLease(), async () => ({
        uri: cameraUri,
        width: 1200,
        height: 1600,
        format: 'jpg',
      })),
    ).rejects.toThrow('rename failed');

    expect(harness.cleanup).toHaveBeenCalledWith(CAPTURE_HANDLE);
    expect(harness.deleteAsync).toHaveBeenCalledWith(cameraUri, { idempotent: true });
    expect(harness.files.has(cameraUri)).toBe(false);
  });

  it('surfaces ingress cleanup failure and retains the journal reservation for scavenging', async () => {
    const harness = createHarness();
    const cameraUri = 'file://cache/Camera/undeletable.jpg';
    harness.files.add(cameraUri);
    harness.moveAsync.mockRejectedValueOnce(new Error('rename failed'));
    harness.deleteAsync.mockRejectedValueOnce(new Error('camera cache busy'));

    const failure = await harness.operations
      .captureForReview(fakeLease(), async () => ({
        uri: cameraUri,
        width: 1200,
        height: 1600,
        format: 'jpg',
      }))
      .then(
        () => null,
        (error: unknown) => error,
      );

    expect(failure).toBeInstanceOf(CaptureStagingCleanupError);
    expect((failure as Error).message).toBe(CAPTURE_STAGING_CLEANUP_FAILED);
    expect(harness.cleanup).not.toHaveBeenCalled();
    expect(harness.files.has(cameraUri)).toBe(true);

    await (failure as CaptureStagingCleanupError).retryCleanup();
    expect(harness.cleanup).toHaveBeenCalledWith(CAPTURE_HANDLE);
    expect(harness.files.has(cameraUri)).toBe(false);
  });

  it('uses a distinct journal purpose for a shelf label capture', async () => {
    const harness = createHarness();
    const cameraUri = 'file://cache/Camera/label-output.jpg';
    harness.files.add(cameraUri);

    await expect(
      harness.operations.captureLabelForReview(fakeLease(), async () => ({
        uri: cameraUri,
        width: 1600,
        height: 1200,
        format: 'jpg',
      })),
    ).resolves.toEqual({ handle: LABEL_HANDLE, width: 1600, height: 1200 });

    expect(harness.order).toEqual([
      'reserve:label_capture_jpeg',
      'move',
      'mark:label_capture_jpeg',
    ]);
    expect(harness.files.has(cameraUri)).toBe(false);
    expect(harness.files.has(LABEL_HANDLE.uri)).toBe(true);
  });

  it('journals analysis output and propagates cleanup failure', async () => {
    const harness = createHarness();
    const sampleUri = 'file://cache/ImageManipulator/sample.jpg';
    harness.cleanup.mockRejectedValueOnce(new Error('cache busy'));

    await expect(
      harness.operations.withAnalysisJpeg(
        async () => sampleUri,
        async (uri) => {
          expect(uri).toBe(ANALYSIS_HANDLE.uri);
          return 'measured';
        },
      ),
    ).rejects.toThrow(CAPTURE_STAGING_CLEANUP_FAILED);

    expect(harness.reserve).toHaveBeenCalledWith('photo_analysis_jpeg');
    expect(harness.markWritten).toHaveBeenCalledWith(ANALYSIS_HANDLE);
  });

  it('resolves capture IDs against the exact capture purpose', async () => {
    const harness = createHarness();

    await expect(harness.operations.resolveCapture(CAPTURE_HANDLE.operationId)).resolves.toEqual(
      CAPTURE_HANDLE,
    );
    expect(harness.lookup).toHaveBeenCalledWith(CAPTURE_HANDLE.operationId, 'photo_capture_jpeg');
  });
});
