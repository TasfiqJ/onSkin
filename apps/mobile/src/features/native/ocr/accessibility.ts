export type LabelOcrAccessibilityState =
  | 'disabled'
  | 'idle'
  | 'running'
  | 'ready'
  | 'no_text'
  | 'timed_out'
  | 'failed'
  | 'misconfigured';

/** Generic status only: never announce label contents or confidence values. */
export function labelOcrAccessibilityAnnouncement(
  state: LabelOcrAccessibilityState,
): string | null {
  switch (state) {
    case 'running':
      return 'Reading the ingredient label.';
    case 'ready':
      return 'Recognized label text is ready to review.';
    case 'no_text':
      return 'No readable label text was found. Retake the photo or enter ingredients manually.';
    case 'timed_out':
      return 'Label reading took too long. Retake the photo or continue with manual text.';
    case 'failed':
      return 'The label was not read. Retake the photo or continue with manual text.';
    case 'misconfigured':
      return 'Automatic label reading is unavailable. Continue with manual text.';
    case 'disabled':
    case 'idle':
      return null;
  }
}
