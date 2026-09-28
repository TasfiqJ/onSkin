import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import {
  readPhotoQueryCacheDiagnostics,
  recordPhotoQueryExecution,
  resetPhotoQueryCacheDiagnostics,
} from './photoQueryCacheDiagnostics';

const runtime = globalThis as typeof globalThis & {
  __DEV__?: boolean;
  __LAYERWELL_PHOTO_QUERY_CACHE_DIAGNOSTICS__?: unknown;
};
const originalDev = runtime.__DEV__;

describe('photo query cache diagnostics', () => {
  beforeEach(() => {
    runtime.__DEV__ = true;
    delete runtime.__LAYERWELL_PHOTO_QUERY_CACHE_DIAGNOSTICS__;
  });

  afterEach(() => {
    delete runtime.__LAYERWELL_PHOTO_QUERY_CACHE_DIAGNOSTICS__;
    if (originalDev === undefined) delete runtime.__DEV__;
    else runtime.__DEV__ = originalDev;
  });

  it('records only a content-free query execution count', () => {
    recordPhotoQueryExecution();
    recordPhotoQueryExecution();

    expect(readPhotoQueryCacheDiagnostics()).toEqual({ queryExecutions: 2 });
    expect(Object.isFrozen(readPhotoQueryCacheDiagnostics())).toBe(true);
  });

  it('resets the bounded schema without retaining query or photo content', () => {
    recordPhotoQueryExecution();
    resetPhotoQueryCacheDiagnostics();

    expect(readPhotoQueryCacheDiagnostics()).toEqual({ queryExecutions: 0 });
    expect(Object.keys(readPhotoQueryCacheDiagnostics())).toEqual(['queryExecutions']);
  });

  it('is a no-op outside development builds', () => {
    runtime.__DEV__ = false;
    recordPhotoQueryExecution();

    expect(readPhotoQueryCacheDiagnostics()).toEqual({ queryExecutions: 0 });
    expect(runtime.__LAYERWELL_PHOTO_QUERY_CACHE_DIAGNOSTICS__).toBeUndefined();
  });
});
