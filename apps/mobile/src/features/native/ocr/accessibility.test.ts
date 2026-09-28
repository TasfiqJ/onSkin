import { describe, expect, it } from 'vitest';

import { labelOcrAccessibilityAnnouncement } from './accessibility';

describe('label OCR accessibility announcements', () => {
  it.each([
    ['disabled', null],
    ['idle', null],
    ['running', 'Reading the ingredient label.'],
    ['ready', 'Recognized label text is ready to review.'],
    [
      'no_text',
      'No readable label text was found. Retake the photo or enter ingredients manually.',
    ],
    ['timed_out', 'Label reading took too long. Retake the photo or continue with manual text.'],
    ['failed', 'The label was not read. Retake the photo or continue with manual text.'],
    ['misconfigured', 'Automatic label reading is unavailable. Continue with manual text.'],
  ] as const)('maps %s to a content-free announcement', (state, expected) => {
    expect(labelOcrAccessibilityAnnouncement(state)).toBe(expected);
  });

  it('never announces transcript contents, confidence, or percentages', () => {
    const states = ['running', 'ready', 'no_text', 'timed_out', 'failed', 'misconfigured'] as const;
    const announcements = states.map((state) => labelOcrAccessibilityAnnouncement(state)).join(' ');

    expect(announcements).not.toMatch(/Aqua|confidence|%/iu);
  });
});
