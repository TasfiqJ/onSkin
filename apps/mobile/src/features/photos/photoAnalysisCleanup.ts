export type CaptureAnalysisControl = Readonly<{
  assertActive: () => void;
  signal: AbortSignal;
}>;

export class PhotoAnalysisCleanupError extends Error {
  readonly retryCleanup: () => Promise<void>;

  constructor(retryCleanup: () => Promise<void>, cause?: unknown) {
    super('PHOTO_ANALYSIS_PLAINTEXT_CLEANUP_REQUIRED', { cause });
    this.name = 'PhotoAnalysisCleanupError';
    this.retryCleanup = retryCleanup;
  }
}

export function isPhotoAnalysisCleanupError(error: unknown): error is PhotoAnalysisCleanupError {
  return error instanceof PhotoAnalysisCleanupError;
}
