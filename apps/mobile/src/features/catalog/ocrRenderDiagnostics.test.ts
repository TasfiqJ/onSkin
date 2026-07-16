import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import {
  readOcrReviewRenderDiagnostics,
  recordOcrCapturePanelRender,
  recordOcrDraftChange,
  recordOcrEditorCommit,
  recordOcrExactSubmission,
  recordOcrPreviewParse,
  recordOcrPreviewRender,
  recordOcrReviewScreenRender,
  resetOcrReviewRenderDiagnostics,
} from './ocrRenderDiagnostics';

const runtime = globalThis as typeof globalThis & {
  __DEV__?: boolean;
  __ONSKIN_OCR_REVIEW_RENDER_DIAGNOSTICS__?: unknown;
};
const originalDev = runtime.__DEV__;

describe('OCR review content-free diagnostics', () => {
  beforeEach(() => {
    runtime.__DEV__ = true;
    delete runtime.__ONSKIN_OCR_REVIEW_RENDER_DIAGNOSTICS__;
  });

  afterEach(() => {
    delete runtime.__ONSKIN_OCR_REVIEW_RENDER_DIAGNOSTICS__;
    if (originalDev === undefined) delete runtime.__DEV__;
    else runtime.__DEV__ = originalDev;
  });

  it('counts render, parse, draft, and exact-submit events', () => {
    recordOcrReviewScreenRender();
    recordOcrCapturePanelRender();
    recordOcrEditorCommit(1.25);
    recordOcrEditorCommit(2.75);
    recordOcrDraftChange();
    recordOcrPreviewParse();
    recordOcrPreviewRender();
    recordOcrExactSubmission();

    expect(readOcrReviewRenderDiagnostics()).toEqual({
      screenRenders: 1,
      capturePanelRenders: 1,
      editorCommits: 2,
      editorDurationTotalMs: 4,
      editorDurationMaxMs: 2.75,
      draftChanges: 1,
      previewParses: 1,
      previewRenders: 1,
      exactSubmissions: 1,
    });
  });

  it('sanitizes invalid profiler durations and returns frozen snapshots', () => {
    recordOcrEditorCommit(-1);
    recordOcrEditorCommit(Number.NaN);
    const snapshot = readOcrReviewRenderDiagnostics();

    expect(snapshot).toMatchObject({
      editorCommits: 2,
      editorDurationTotalMs: 0,
      editorDurationMaxMs: 0,
    });
    expect(Object.isFrozen(snapshot)).toBe(true);
  });

  it('resets without retaining label, ingredient, or image content', () => {
    recordOcrDraftChange();
    recordOcrPreviewParse();
    resetOcrReviewRenderDiagnostics();

    const snapshot = readOcrReviewRenderDiagnostics();
    expect(snapshot).toEqual({
      screenRenders: 0,
      capturePanelRenders: 0,
      editorCommits: 0,
      editorDurationTotalMs: 0,
      editorDurationMaxMs: 0,
      draftChanges: 0,
      previewParses: 0,
      previewRenders: 0,
      exactSubmissions: 0,
    });
    expect(Object.keys(snapshot).sort()).toEqual([
      'capturePanelRenders',
      'draftChanges',
      'editorCommits',
      'editorDurationMaxMs',
      'editorDurationTotalMs',
      'exactSubmissions',
      'previewParses',
      'previewRenders',
      'screenRenders',
    ]);
  });

  it('does nothing outside development builds', () => {
    runtime.__DEV__ = false;
    recordOcrReviewScreenRender();
    recordOcrCapturePanelRender();
    recordOcrEditorCommit(5);
    recordOcrDraftChange();
    recordOcrPreviewParse();
    recordOcrPreviewRender();
    recordOcrExactSubmission();

    expect(readOcrReviewRenderDiagnostics()).toEqual({
      screenRenders: 0,
      capturePanelRenders: 0,
      editorCommits: 0,
      editorDurationTotalMs: 0,
      editorDurationMaxMs: 0,
      draftChanges: 0,
      previewParses: 0,
      previewRenders: 0,
      exactSubmissions: 0,
    });
    expect(runtime.__ONSKIN_OCR_REVIEW_RENDER_DIAGNOSTICS__).toBeUndefined();
  });
});
