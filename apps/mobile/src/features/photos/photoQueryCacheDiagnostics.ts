export const PHOTO_QUERY_CACHE_DIAGNOSTICS_GLOBAL =
  '__LAYERWELL_PHOTO_QUERY_CACHE_DIAGNOSTICS__' as const;

export type PhotoQueryCacheDiagnosticsSnapshot = Readonly<{
  queryExecutions: number;
}>;

type MutablePhotoQueryCacheDiagnostics = {
  -readonly [Key in keyof PhotoQueryCacheDiagnosticsSnapshot]: PhotoQueryCacheDiagnosticsSnapshot[Key];
};

type PhotoQueryDiagnosticsGlobal = typeof globalThis & {
  __LAYERWELL_PHOTO_QUERY_CACHE_DIAGNOSTICS__?: MutablePhotoQueryCacheDiagnostics;
};

const EMPTY_DIAGNOSTICS: PhotoQueryCacheDiagnosticsSnapshot = Object.freeze({
  queryExecutions: 0,
});

function mutableDiagnostics(): MutablePhotoQueryCacheDiagnostics | null {
  if (typeof __DEV__ === 'undefined' || !__DEV__) return null;
  const root = globalThis as PhotoQueryDiagnosticsGlobal;
  root.__LAYERWELL_PHOTO_QUERY_CACHE_DIAGNOSTICS__ ??= { ...EMPTY_DIAGNOSTICS };
  return root.__LAYERWELL_PHOTO_QUERY_CACHE_DIAGNOSTICS__;
}

export function recordPhotoQueryExecution(): void {
  const diagnostics = mutableDiagnostics();
  if (diagnostics) diagnostics.queryExecutions += 1;
}

export function readPhotoQueryCacheDiagnostics(): PhotoQueryCacheDiagnosticsSnapshot {
  const diagnostics = mutableDiagnostics();
  return diagnostics ? Object.freeze({ ...diagnostics }) : EMPTY_DIAGNOSTICS;
}

export function resetPhotoQueryCacheDiagnostics(): void {
  const diagnostics = mutableDiagnostics();
  if (diagnostics) Object.assign(diagnostics, EMPTY_DIAGNOSTICS);
}
