export const CATALOG_SEARCH_RENDER_DIAGNOSTICS_GLOBAL =
  '__LAYERWELL_CATALOG_SEARCH_RENDER_DIAGNOSTICS__' as const;

export type CatalogSearchRenderDiagnosticsSnapshot = Readonly<{
  composerCommits: number;
  composerDurationTotalMs: number;
  composerDurationMaxMs: number;
  draftChanges: number;
  resultsCommits: number;
  cardRenders: number;
  searchStarts: number;
  cancellations: number;
  publications: number;
  duplicateSubmits: number;
}>;

type MutableCatalogSearchRenderDiagnostics = {
  composerCommits: number;
  composerDurationTotalMs: number;
  composerDurationMaxMs: number;
  draftChanges: number;
  resultsCommits: number;
  cardRenders: number;
  searchStarts: number;
  cancellations: number;
  publications: number;
  duplicateSubmits: number;
};

type CatalogSearchDiagnosticsGlobal = typeof globalThis & {
  __LAYERWELL_CATALOG_SEARCH_RENDER_DIAGNOSTICS__?: MutableCatalogSearchRenderDiagnostics;
};

const EMPTY_DIAGNOSTICS: CatalogSearchRenderDiagnosticsSnapshot = Object.freeze({
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

function diagnosticsEnabled(): boolean {
  return typeof __DEV__ !== 'undefined' && __DEV__;
}

function mutableDiagnostics(): MutableCatalogSearchRenderDiagnostics | null {
  if (!diagnosticsEnabled()) return null;
  const root = globalThis as CatalogSearchDiagnosticsGlobal;
  root.__LAYERWELL_CATALOG_SEARCH_RENDER_DIAGNOSTICS__ ??= { ...EMPTY_DIAGNOSTICS };
  return root.__LAYERWELL_CATALOG_SEARCH_RENDER_DIAGNOSTICS__;
}

function finiteDuration(durationMs: number): number {
  return Number.isFinite(durationMs) ? Math.max(0, durationMs) : 0;
}

/** Content-free local counters for the catalog-search keystroke profile. */
export function recordCatalogSearchComposerCommit(durationMs: number): void {
  const diagnostics = mutableDiagnostics();
  if (!diagnostics) return;

  const duration = finiteDuration(durationMs);
  diagnostics.composerCommits += 1;
  diagnostics.composerDurationTotalMs += duration;
  diagnostics.composerDurationMaxMs = Math.max(diagnostics.composerDurationMaxMs, duration);
}

export function recordCatalogSearchDraftChange(): void {
  const diagnostics = mutableDiagnostics();
  if (diagnostics) diagnostics.draftChanges += 1;
}

export function recordCatalogSearchResultsCommit(): void {
  const diagnostics = mutableDiagnostics();
  if (diagnostics) diagnostics.resultsCommits += 1;
}

export function recordCatalogSearchCardRender(): void {
  const diagnostics = mutableDiagnostics();
  if (diagnostics) diagnostics.cardRenders += 1;
}

export function recordCatalogSearchStarted(): void {
  const diagnostics = mutableDiagnostics();
  if (diagnostics) diagnostics.searchStarts += 1;
}

export function recordCatalogSearchCancelled(): void {
  const diagnostics = mutableDiagnostics();
  if (diagnostics) diagnostics.cancellations += 1;
}

export function recordCatalogSearchPublished(): void {
  const diagnostics = mutableDiagnostics();
  if (diagnostics) diagnostics.publications += 1;
}

export function recordCatalogSearchDuplicateSubmit(): void {
  const diagnostics = mutableDiagnostics();
  if (diagnostics) diagnostics.duplicateSubmits += 1;
}

export function readCatalogSearchRenderDiagnostics(): CatalogSearchRenderDiagnosticsSnapshot {
  const diagnostics = mutableDiagnostics();
  return diagnostics ? Object.freeze({ ...diagnostics }) : EMPTY_DIAGNOSTICS;
}

export function resetCatalogSearchRenderDiagnostics(): void {
  const diagnostics = mutableDiagnostics();
  if (!diagnostics) return;

  diagnostics.composerCommits = 0;
  diagnostics.composerDurationTotalMs = 0;
  diagnostics.composerDurationMaxMs = 0;
  diagnostics.draftChanges = 0;
  diagnostics.resultsCommits = 0;
  diagnostics.cardRenders = 0;
  diagnostics.searchStarts = 0;
  diagnostics.cancellations = 0;
  diagnostics.publications = 0;
  diagnostics.duplicateSubmits = 0;
}
