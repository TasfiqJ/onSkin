import { describe, expect, it } from 'vitest';

import {
  ASK_HISTORY_PAGE_SIZE,
  MAX_ASK_SCROLL_TO_LATEST_ATTEMPTS,
  latestAskHistoryStart,
  measuredAskPrependHeight,
  nextAskLatestScrollAttempt,
  previousAskHistoryPage,
} from './historyWindow';

describe('Ask chronological history window', () => {
  it('opens a 200-message transcript on its latest bounded page', () => {
    expect(ASK_HISTORY_PAGE_SIZE).toBe(16);
    expect(latestAskHistoryStart(200)).toBe(184);
    expect(200 - latestAskHistoryStart(200)).toBe(ASK_HISTORY_PAGE_SIZE);
  });

  it('keeps short transcripts complete', () => {
    expect(latestAskHistoryStart(0)).toBe(0);
    expect(latestAskHistoryStart(2)).toBe(0);
    expect(latestAskHistoryStart(16)).toBe(0);
  });

  it('resets an appended 202-message transcript to its latest 16 rows', () => {
    expect(latestAskHistoryStart(202)).toBe(186);
  });

  it('prepends one chronological page without changing logical cardinality', () => {
    expect(previousAskHistoryPage(184)).toEqual({
      prependedMessages: 16,
      visibleStartIndex: 168,
    });
  });

  it('bounds the final partial page and invalid indices', () => {
    expect(previousAskHistoryPage(8)).toEqual({
      prependedMessages: 8,
      visibleStartIndex: 0,
    });
    expect(previousAskHistoryPage(Number.NaN)).toEqual({
      prependedMessages: 0,
      visibleStartIndex: 0,
    });
  });

  it('deduplicates content heights and exhausts latest-scroll work after eight attempts', () => {
    let progress = { attempts: 0, lastAttemptedHeight: -1 };

    for (let attempt = 1; attempt <= MAX_ASK_SCROLL_TO_LATEST_ATTEMPTS; attempt += 1) {
      const next = nextAskLatestScrollAttempt(progress, attempt * 100);
      expect(next).toEqual({
        attempts: attempt,
        exhausted: attempt === MAX_ASK_SCROLL_TO_LATEST_ATTEMPTS,
        lastAttemptedHeight: attempt * 100,
      });
      progress = next!;
    }

    expect(nextAskLatestScrollAttempt(progress, 900)).toBeNull();
    expect(nextAskLatestScrollAttempt({ attempts: 1, lastAttemptedHeight: 100 }, 100)).toBeNull();
    expect(nextAskLatestScrollAttempt({ attempts: 7, lastAttemptedHeight: 3262 }, 0)).toBeNull();
    expect(nextAskLatestScrollAttempt({ attempts: 0, lastAttemptedHeight: -1 }, -1)).toBeNull();
    expect(nextAskLatestScrollAttempt({ attempts: 0, lastAttemptedHeight: -1 }, Number.NaN)).toBeNull();
  });

  it('allows the recovered positive height after a transient zero-height collapse', () => {
    expect(nextAskLatestScrollAttempt({ attempts: 7, lastAttemptedHeight: -1 }, 3262)).toEqual({
      attempts: MAX_ASK_SCROLL_TO_LATEST_ATTEMPTS,
      exhausted: true,
      lastAttemptedHeight: 3262,
    });
  });

  it('sums exact mixed row heights instead of averaging them', () => {
    expect(measuredAskPrependHeight([38, 426.5, 54, 401, 72, 389.25])).toBe(1380.75);
  });

  it('preserves repeated-page arithmetic with exact measured page totals', () => {
    const pages = [
      [38, 426.5, 54, 401],
      [72, 389.25, 38, 426.5],
      [54, 401, 72, 389.25],
    ];
    expect(pages.map(measuredAskPrependHeight)).toEqual([919.5, 925.75, 916.25]);
    expect(pages.map(measuredAskPrependHeight).reduce<number>((total, height) => total + height!, 0)).toBe(
      2761.5,
    );
  });

  it('waits for every finite positive row height before restoring the anchor', () => {
    expect(measuredAskPrependHeight([])).toBeNull();
    expect(measuredAskPrependHeight([38, 0, 54])).toBeNull();
    expect(measuredAskPrependHeight([38, -1, 54])).toBeNull();
    expect(measuredAskPrependHeight([38, Number.NaN, 54])).toBeNull();
  });
});
