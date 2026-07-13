import * as FileSystem from 'expo-file-system/legacy';

import type { AccountGenerationLease } from '@/lib/auth/accountGeneration';
import {
  cleanupPlaintextStaging,
  lookupPlaintextStaging,
  markPlaintextStagingState,
  reservePlaintextStaging,
  type PlaintextStagingHandle,
  type PlaintextStagingPurpose,
} from '@/lib/storage/plaintextStaging';

export const CAPTURE_STAGING_FORMAT_UNSUPPORTED = 'CAPTURE_STAGING_FORMAT_UNSUPPORTED';
export const CAPTURE_STAGING_CLEANUP_FAILED = 'CAPTURE_STAGING_CLEANUP_FAILED';

export class CaptureStagingCleanupError extends Error {
  readonly retryCleanup: () => Promise<void>;

  constructor(retryCleanup: () => Promise<void>) {
    super(CAPTURE_STAGING_CLEANUP_FAILED);
    this.name = 'CaptureStagingCleanupError';
    this.retryCleanup = retryCleanup;
  }
}

export type CapturedPictureForStaging = {
  uri: string;
  width: number;
  height: number;
  format?: 'jpg' | 'png';
};

export type StagedPhotoCapture = {
  handle: PlaintextStagingHandle;
  width: number;
  height: number;
};

type CapturePurpose = 'label_capture_jpeg' | 'photo_capture_jpeg';

type CaptureStagingDependencies = {
  cleanup: (handle: PlaintextStagingHandle) => Promise<void>;
  lookup: (
    operationId: string,
    purpose: PlaintextStagingPurpose,
  ) => Promise<PlaintextStagingHandle | null>;
  markWritten: (handle: PlaintextStagingHandle) => Promise<void>;
  reserve: (purpose: PlaintextStagingPurpose) => Promise<PlaintextStagingHandle>;
  fileSystem: {
    deleteAsync: (uri: string, options: { idempotent: true }) => Promise<void>;
    moveAsync: (options: { from: string; to: string }) => Promise<void>;
  };
};

async function cleanupIngressAndHandle(
  deps: CaptureStagingDependencies,
  handle: PlaintextStagingHandle,
  ingressUri: string | null,
): Promise<void> {
  try {
    // Keep the journal reservation until native ingress is gone. If deleting
    // Camera/ImageManipulator output fails, startup/account scavenging retains
    // a durable signal that cleanup is still required.
    if (ingressUri) await deps.fileSystem.deleteAsync(ingressUri, { idempotent: true });
    await deps.cleanup(handle);
  } catch {
    throw new CaptureStagingCleanupError(() => cleanupIngressAndHandle(deps, handle, ingressUri));
  }
}

export function createCaptureStagingOperations(deps: CaptureStagingDependencies) {
  async function captureForPurpose(
    lease: AccountGenerationLease,
    purpose: CapturePurpose,
    takePicture: () => Promise<CapturedPictureForStaging>,
  ): Promise<StagedPhotoCapture> {
    const handle = await deps.reserve(purpose);
    let ingressUri: string | null = null;
    try {
      lease.assertCurrent();
      const picture = await takePicture();
      ingressUri = picture.uri;
      if (picture.format && picture.format !== 'jpg') {
        throw new Error(CAPTURE_STAGING_FORMAT_UNSUPPORTED);
      }

      // A real account boundary may begin while the native camera is saving.
      // Adopt or delete that output before asserting the lease again so owner
      // B cannot publish while owner A still has untracked camera plaintext.
      await deps.fileSystem.moveAsync({ from: picture.uri, to: handle.uri });
      ingressUri = null;
      await deps.markWritten(handle);
      lease.assertCurrent();
      return { handle, width: picture.width, height: picture.height };
    } catch (error) {
      await cleanupIngressAndHandle(deps, handle, ingressUri);
      throw error;
    }
  }

  return {
    captureForReview(
      lease: AccountGenerationLease,
      takePicture: () => Promise<CapturedPictureForStaging>,
    ): Promise<StagedPhotoCapture> {
      return captureForPurpose(lease, 'photo_capture_jpeg', takePicture);
    },

    captureLabelForReview(
      lease: AccountGenerationLease,
      takePicture: () => Promise<CapturedPictureForStaging>,
    ): Promise<StagedPhotoCapture> {
      return captureForPurpose(lease, 'label_capture_jpeg', takePicture);
    },

    resolveCapture(operationId: string): Promise<PlaintextStagingHandle | null> {
      return deps.lookup(operationId, 'photo_capture_jpeg');
    },

    cleanupCapture(handle: PlaintextStagingHandle): Promise<void> {
      return deps.cleanup(handle);
    },

    async withAnalysisJpeg<T>(
      createJpeg: () => Promise<string>,
      consumeJpeg: (uri: string) => Promise<T>,
    ): Promise<T> {
      const handle = await deps.reserve('photo_analysis_jpeg');
      let ingressUri: string | null = null;
      let result: T;
      let operationError: unknown = null;
      try {
        ingressUri = await createJpeg();
        await deps.fileSystem.moveAsync({ from: ingressUri, to: handle.uri });
        ingressUri = null;
        await deps.markWritten(handle);
        result = await consumeJpeg(handle.uri);
      } catch (error) {
        operationError = error;
      }

      try {
        await cleanupIngressAndHandle(deps, handle, ingressUri);
      } catch (cleanupError) {
        throw cleanupError;
      }
      if (operationError) throw operationError;
      return result!;
    },
  };
}

const operations = createCaptureStagingOperations({
  reserve: reservePlaintextStaging,
  lookup: lookupPlaintextStaging,
  markWritten: (handle) => markPlaintextStagingState(handle, 'plaintext_written'),
  cleanup: cleanupPlaintextStaging,
  fileSystem: FileSystem,
});

export function capturePhotoForReview(
  lease: AccountGenerationLease,
  takePicture: () => Promise<CapturedPictureForStaging>,
): Promise<StagedPhotoCapture> {
  return operations.captureForReview(lease, takePicture);
}

export function resolveCapturedPhoto(operationId: string): Promise<PlaintextStagingHandle | null> {
  return operations.resolveCapture(operationId);
}

export function cleanupCapturedPhoto(handle: PlaintextStagingHandle): Promise<void> {
  return operations.cleanupCapture(handle);
}

export function captureLabelForReview(
  lease: AccountGenerationLease,
  takePicture: () => Promise<CapturedPictureForStaging>,
): Promise<StagedPhotoCapture> {
  return operations.captureLabelForReview(lease, takePicture);
}

export function cleanupStagedCapture(handle: PlaintextStagingHandle): Promise<void> {
  return operations.cleanupCapture(handle);
}

export function withStagedPhotoAnalysisJpeg<T>(
  createJpeg: () => Promise<string>,
  consumeJpeg: (uri: string) => Promise<T>,
): Promise<T> {
  return operations.withAnalysisJpeg(createJpeg, consumeJpeg);
}
