export const CAMERA_FAILURE_COPY = {
  progressUnavailableTitle: "Camera couldn't start",
  progressUnavailableBody:
    'Close and try again. Your photo timeline is unchanged, and nothing was saved.',
  progressCaptureTitle: "Photo wasn't captured",
  progressCaptureBody: 'Try again in a moment. Your timeline is unchanged.',
  progressSettingsTitle: 'Camera settings unavailable',
  progressSettingsBody:
    'Open Settings manually to enable camera access. Your timeline is unchanged.',
  shelfSettingsTitle: 'Camera settings unavailable',
  shelfSettingsBody:
    'Open Settings manually to enable camera access. Search, label scan, and manual add still work.',
  labelUnavailableTitle: "Camera couldn't start",
  labelUnavailableBody: 'Use manual text for now. You can still type or paste the ingredient list.',
  labelCaptureTitle: "Label wasn't captured",
  labelCaptureBody: 'Use manual text for now, or try the label photo again.',
} as const;

/**
 * User-safe camera permission operation failures. These messages intentionally
 * describe only the recoverable app state; native exception text and guesses
 * about the OS permission state must never reach route copy or analytics.
 */
export const CAMERA_PERMISSION_FAILURE_COPY = {
  refresh_failed: {
    title: 'Camera access could not be checked',
    body: 'Try checking again. You can continue with any option that does not use the camera.',
    retryLabel: 'Check camera again',
  },
  request_failed: {
    title: 'Camera access was not changed',
    body: 'Try the camera request again. You can continue with any option that does not use the camera.',
    retryLabel: 'Try camera access again',
  },
} as const;
