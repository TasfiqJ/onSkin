import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import {
  readCatalogSearchRenderDiagnostics,
  recordCatalogSearchCancelled,
  recordCatalogSearchCardRender,
  recordCatalogSearchComposerCommit,
  recordCatalogSearchDraftChange,
  recordCatalogSearchDuplicateSubmit,
  recordCatalogSearchPublished,
  recordCatalogSearchResultsCommit,
  recordCatalogSearchStarted,
  resetCatalogSearchRenderDiagnostics,
} from './searchRenderDiagnostics';

const runtime = globalThis as typeof globalThis & {
  __DEV__?: boolean;
  __LAYERWELL_CATALOG_SEARCH_RENDER_DIAGNOSTICS__?: unknown;
};
const originalDev = runtime.__DEV__;

describe('catalog-search content-free render diagnostics', () => {
  beforeEach(() => {
    runtime.__DEV__ = true;
    delete runtime.__LAYERWELL_CATALOG_SEARCH_RENDER_DIAGNOSTICS__;
  });

  afterEach(() => {
    delete runtime.__LAYERWELL_CATALOG_SEARCH_RENDER_DIAGNOSTICS__;
    if (originalDev === undefined) delete runtime.__DEV__;
    else runtime.__DEV__ = originalDev;
  });

  it('counts fixed render, request-lifecycle, and duplicate-submit events', () => {
    recordCatalogSearchComposerCommit(1.25);
    recordCatalogSearchComposerCommit(2.75);
    recordCatalogSearchDraftChange();
    recordCatalogSearchDraftChange();
    recordCatalogSearchResultsCommit();
    recordCatalogSearchCardRender();
    recordCatalogSearchCardRender();
    recordCatalogSearchStarted();
    recordCatalogSearchCancelled();
    recordCatalogSearchPublished();
    recordCatalogSearchDuplicateSubmit();

    expect(readCatalogSearchRenderDiagnostics()).toEqual({
      composerCommits: 2,
      composerDurationTotalMs: 4,
      composerDurationMaxMs: 2.75,
      draftChanges: 2,
      resultsCommits: 1,
      cardRenders: 2,
      searchStarts: 1,
      cancellations: 1,
      publications: 1,
      duplicateSubmits: 1,
    });
  });

  it('sanitizes non-finite and negative profiler durations', () => {
    recordCatalogSearchComposerCommit(-1);
    recordCatalogSearchComposerCommit(Number.NaN);
    recordCatalogSearchComposerCommit(Number.POSITIVE_INFINITY);

    expect(readCatalogSearchRenderDiagnostics()).toMatchObject({
      composerCommits: 3,
      composerDurationTotalMs: 0,
      composerDurationMaxMs: 0,
    });
  });

  it('returns frozen snapshots that cannot mutate the live counters', () => {
    recordCatalogSearchDraftChange();
    const first = readCatalogSearchRenderDiagnostics();

    expect(Object.isFrozen(first)).toBe(true);
    expect(first).not.toBe(readCatalogSearchRenderDiagnostics());
    expect(readCatalogSearchRenderDiagnostics().draftChanges).toBe(1);
  });

  it('resets without retaining query, result, or product content', () => {
    recordCatalogSearchComposerCommit(3);
    recordCatalogSearchDraftChange();
    recordCatalogSearchStarted();
    recordCatalogSearchPublished();
    resetCatalogSearchRenderDiagnostics();

    const snapshot = readCatalogSearchRenderDiagnostics();
    expect(snapshot).toEqual({
      composerCommits: 0,
      composerDurationTotalMs: 0,
      composerDurationMaxMs: 0,
      draftChanges: 0,
      resultsCommits: 0,
      cardRenders: 0,
      searchStarts: 0,
      cancellations: 0,
      publications: 0,
      duplicateSubmits: 0,
    });
    expect(Object.keys(snapshot).sort()).toEqual([
      'cancellations',
      'cardRenders',
      'composerCommits',
      'composerDurationMaxMs',
      'composerDurationTotalMs',
      'draftChanges',
      'duplicateSubmits',
      'publications',
      'resultsCommits',
      'searchStarts',
    ]);
  });

  it('does nothing outside development builds', () => {
    runtime.__DEV__ = false;

    recordCatalogSearchComposerCommit(4);
    recordCatalogSearchDraftChange();
    recordCatalogSearchResultsCommit();
    recordCatalogSearchCardRender();
    recordCatalogSearchStarted();
    recordCatalogSearchCancelled();
    recordCatalogSearchPublished();
    recordCatalogSearchDuplicateSubmit();

    expect(readCatalogSearchRenderDiagnostics()).toEqual({
      composerCommits: 0,
      composerDurationTotalMs: 0,
      composerDurationMaxMs: 0,
      draftChanges: 0,
      resultsCommits: 0,
      cardRenders: 0,
      searchStarts: 0,
      cancellations: 0,
      publications: 0,
      duplicateSubmits: 0,
    });
    expect(runtime.__LAYERWELL_CATALOG_SEARCH_RENDER_DIAGNOSTICS__).toBeUndefined();
  });
});
