export const ASK_HISTORY_PAGE_SIZE = 16;
export const MAX_ASK_SCROLL_TO_LATEST_ATTEMPTS = 8;

export type AskLatestScrollProgress = {
  attempts: number;
  lastAttemptedHeight: number;
};

function safeMessageIndex(value: number): number {
  return Number.isFinite(value) ? Math.max(0, Math.floor(value)) : 0;
}

export function latestAskHistoryStart(messageCount: number): number {
  return Math.max(0, safeMessageIndex(messageCount) - ASK_HISTORY_PAGE_SIZE);
}

export function previousAskHistoryPage(currentStartIndex: number): {
  prependedMessages: number;
  visibleStartIndex: number;
} {
  const currentStart = safeMessageIndex(currentStartIndex);
  const visibleStartIndex = Math.max(0, currentStart - ASK_HISTORY_PAGE_SIZE);
  return {
    prependedMessages: currentStart - visibleStartIndex,
    visibleStartIndex,
  };
}

export function nextAskLatestScrollAttempt(
  progress: AskLatestScrollProgress,
  contentHeight: number,
): (AskLatestScrollProgress & { exhausted: boolean }) | null {
  if (
    !Number.isFinite(contentHeight) ||
    contentHeight <= 0 ||
    progress.lastAttemptedHeight === contentHeight ||
    progress.attempts >= MAX_ASK_SCROLL_TO_LATEST_ATTEMPTS
  ) {
    return null;
  }

  const attempts = progress.attempts + 1;
  return {
    attempts,
    exhausted: attempts >= MAX_ASK_SCROLL_TO_LATEST_ATTEMPTS,
    lastAttemptedHeight: contentHeight,
  };
}
