import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

import { describe, expect, it } from 'vitest';

import {
  adoptLabelOcrSuggestion,
  advanceLabelOcrCapture,
  applyLabelOcrRecognition,
  beginLabelOcrReviewAttempt,
  createLabelOcrReviewState,
  editLabelOcrReviewText,
} from './reviewState';

const OCR_ROUTE = fileURLToPath(new URL('../../../app/shelf/ocr.tsx', import.meta.url));

describe('label OCR editable review fence', () => {
  it('auto-seeds untouched text for the current capture', () => {
    const captured = advanceLabelOcrCapture(createLabelOcrReviewState());
    const fence = beginLabelOcrReviewAttempt(captured);
    const recognized = applyLabelOcrRecognition(captured, fence, 'Cafe\u0301, 水');

    expect(recognized).toMatchObject({
      text: 'Café, 水',
      ownership: 'ocr_unedited',
      suggestion: null,
    });
  });

  it('never overwrites typing that occurs while recognition is in flight', () => {
    const captured = advanceLabelOcrCapture(createLabelOcrReviewState());
    const fence = beginLabelOcrReviewAttempt(captured);
    const typed = editLabelOcrReviewText(captured, 'My corrected INCI');
    const recognized = applyLabelOcrRecognition(typed, fence, 'Water, Glycerin');

    expect(recognized.text).toBe('My corrected INCI');
    expect(recognized.ownership).toBe('user_edited');
    expect(recognized.suggestion).toEqual({
      captureGeneration: 1,
      text: 'Water, Glycerin',
    });
    expect(adoptLabelOcrSuggestion(recognized)).toMatchObject({
      text: 'Water, Glycerin',
      ownership: 'ocr_unedited',
      suggestion: null,
    });
  });

  it('discards output from an earlier capture generation', () => {
    const first = advanceLabelOcrCapture(createLabelOcrReviewState());
    const staleFence = beginLabelOcrReviewAttempt(first);
    const second = advanceLabelOcrCapture(first);

    expect(applyLabelOcrRecognition(second, staleFence, 'Stale scan')).toBe(second);
  });

  it('clears unedited OCR output on retake but preserves user-owned corrections', () => {
    const first = advanceLabelOcrCapture(createLabelOcrReviewState());
    const recognized = applyLabelOcrRecognition(
      first,
      beginLabelOcrReviewAttempt(first),
      'Old unverified scan',
    );
    expect(advanceLabelOcrCapture(recognized)).toMatchObject({
      captureGeneration: 2,
      text: '',
      ownership: 'empty',
    });

    const corrected = editLabelOcrReviewText(recognized, 'User-checked ingredients');
    expect(advanceLabelOcrCapture(corrected)).toMatchObject({
      captureGeneration: 2,
      text: 'User-checked ingredients',
      ownership: 'user_edited',
    });
  });

  it('offers recognition as an explicit suggestion when text predated the attempt', () => {
    const typed = editLabelOcrReviewText(
      advanceLabelOcrCapture(createLabelOcrReviewState()),
      'Pasted label',
    );
    const fence = beginLabelOcrReviewAttempt(typed);
    const recognized = applyLabelOcrRecognition(typed, fence, 'Recognized label');

    expect(recognized.text).toBe('Pasted label');
    expect(recognized.suggestion?.text).toBe('Recognized label');
  });

  it('advances exactly once before every dev, simulated-failure, or native capture path', () => {
    const source = readFileSync(OCR_ROUTE, 'utf8');
    const advance = 'const captureReviewState = commitReviewState(advanceLabelOcrCapture);';
    const advanceIndex = source.indexOf(advance);

    expect(source.split(advance)).toHaveLength(2);
    expect(advanceIndex).toBeGreaterThan(source.indexOf('await labelPhotoStartupRef.current;'));
    expect(advanceIndex).toBeLessThan(source.indexOf('if (devOcrResult !== null)'));
    expect(advanceIndex).toBeLessThan(source.indexOf('if (simulateCaptureFailureOnce)'));
    expect(advanceIndex).toBeLessThan(source.indexOf('takePictureAsync'));
    expect(advanceIndex).toBeLessThan(source.indexOf('adoptCapturedPhoto(photo?.uri)'));
    expect(source).toContain('runDevOcrResult(devOcrResult, captureReviewState);');
    expect(source).toContain(
      'void recognizeManagedPhoto(lifecycle, managedUri, captureReviewState);',
    );
  });
});
