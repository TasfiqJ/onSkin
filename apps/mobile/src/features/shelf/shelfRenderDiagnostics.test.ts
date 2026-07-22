import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import {
  readShelfRenderDiagnostics,
  recordShelfArchiveListCommit,
  recordShelfArchiveRowRender,
  recordShelfFooterRender,
  recordShelfHeaderRender,
  recordShelfMainListCommit,
  recordShelfProductRowRender,
  resetShelfRenderDiagnostics,
} from './shelfRenderDiagnostics';

const runtime = globalThis as typeof globalThis & {
  __DEV__?: boolean;
  __ONSKIN_SHELF_RENDER_DIAGNOSTICS__?: unknown;
};
const originalDev = runtime.__DEV__;

describe('Shelf content-free render diagnostics', () => {
  beforeEach(() => {
    runtime.__DEV__ = true;
    delete runtime.__ONSKIN_SHELF_RENDER_DIAGNOSTICS__;
  });

  afterEach(() => {
    delete runtime.__ONSKIN_SHELF_RENDER_DIAGNOSTICS__;
    if (originalDev === undefined) delete runtime.__DEV__;
    else runtime.__DEV__ = originalDev;
  });

  it('counts only fixed list, row, header, and footer metrics', () => {
    recordShelfMainListCommit(1.25);
    recordShelfMainListCommit(2.75);
    recordShelfArchiveListCommit(3);
    recordShelfProductRowRender();
    recordShelfArchiveRowRender();
    recordShelfHeaderRender();
    recordShelfFooterRender();

    expect(readShelfRenderDiagnostics()).toEqual({
      archiveListCommits: 1,
      archiveListDurationMaxMs: 3,
      archiveListDurationTotalMs: 3,
      archiveRowRenders: 1,
      footerRenders: 1,
      headerRenders: 1,
      mainListCommits: 2,
      mainListDurationMaxMs: 2.75,
      mainListDurationTotalMs: 4,
      productRowRenders: 1,
    });
  });

  it('sanitizes profiler durations and returns immutable snapshots', () => {
    recordShelfMainListCommit(-1);
    recordShelfArchiveListCommit(Number.NaN);
    const snapshot = readShelfRenderDiagnostics();

    expect(snapshot).toMatchObject({
      archiveListDurationMaxMs: 0,
      archiveListDurationTotalMs: 0,
      mainListDurationMaxMs: 0,
      mainListDurationTotalMs: 0,
    });
    expect(Object.isFrozen(snapshot)).toBe(true);
  });

  it('resets without retaining names, IDs, rows, or product content', () => {
    recordShelfProductRowRender();
    recordShelfHeaderRender();
    resetShelfRenderDiagnostics();

    const snapshot = readShelfRenderDiagnostics();
    expect(Object.values(snapshot).every((value) => value === 0)).toBe(true);
    expect(Object.keys(snapshot).sort()).toEqual(
      [
        'archiveListCommits',
        'archiveListDurationMaxMs',
        'archiveListDurationTotalMs',
        'archiveRowRenders',
        'footerRenders',
        'headerRenders',
        'mainListCommits',
        'mainListDurationMaxMs',
        'mainListDurationTotalMs',
        'productRowRenders',
      ].sort(),
    );
  });

  it('does nothing outside development builds', () => {
    runtime.__DEV__ = false;
    recordShelfMainListCommit(2);
    recordShelfArchiveListCommit(2);
    recordShelfProductRowRender();
    recordShelfArchiveRowRender();
    recordShelfHeaderRender();
    recordShelfFooterRender();

    expect(Object.values(readShelfRenderDiagnostics()).every((value) => value === 0)).toBe(true);
    expect(runtime.__ONSKIN_SHELF_RENDER_DIAGNOSTICS__).toBeUndefined();
  });
});
