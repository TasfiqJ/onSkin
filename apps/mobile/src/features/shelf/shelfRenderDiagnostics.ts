export const SHELF_RENDER_DIAGNOSTICS_GLOBAL = '__LAYERWELL_SHELF_RENDER_DIAGNOSTICS__' as const;

export type ShelfRenderDiagnosticsSnapshot = Readonly<{
  archiveListCommits: number;
  archiveListDurationMaxMs: number;
  archiveListDurationTotalMs: number;
  archiveRowRenders: number;
  footerRenders: number;
  headerRenders: number;
  mainListCommits: number;
  mainListDurationMaxMs: number;
  mainListDurationTotalMs: number;
  productRowRenders: number;
}>;

type MutableShelfRenderDiagnostics = {
  -readonly [Key in keyof ShelfRenderDiagnosticsSnapshot]: ShelfRenderDiagnosticsSnapshot[Key];
};

type ShelfDiagnosticsGlobal = typeof globalThis & {
  __LAYERWELL_SHELF_RENDER_DIAGNOSTICS__?: MutableShelfRenderDiagnostics;
};

const EMPTY_DIAGNOSTICS: ShelfRenderDiagnosticsSnapshot = Object.freeze({
  archiveListCommits: 0,
  archiveListDurationMaxMs: 0,
  archiveListDurationTotalMs: 0,
  archiveRowRenders: 0,
  footerRenders: 0,
  headerRenders: 0,
  mainListCommits: 0,
  mainListDurationMaxMs: 0,
  mainListDurationTotalMs: 0,
  productRowRenders: 0,
});

function mutableDiagnostics(): MutableShelfRenderDiagnostics | null {
  if (typeof __DEV__ === 'undefined' || !__DEV__) return null;
  const root = globalThis as ShelfDiagnosticsGlobal;
  root.__LAYERWELL_SHELF_RENDER_DIAGNOSTICS__ ??= { ...EMPTY_DIAGNOSTICS };
  return root.__LAYERWELL_SHELF_RENDER_DIAGNOSTICS__;
}

function finiteDuration(durationMs: number): number {
  return Number.isFinite(durationMs) ? Math.max(0, durationMs) : 0;
}

function recordCommit(
  durationMs: number,
  commitKey: 'archiveListCommits' | 'mainListCommits',
  totalKey: 'archiveListDurationTotalMs' | 'mainListDurationTotalMs',
  maxKey: 'archiveListDurationMaxMs' | 'mainListDurationMaxMs',
): void {
  const diagnostics = mutableDiagnostics();
  if (!diagnostics) return;
  const duration = finiteDuration(durationMs);
  diagnostics[commitKey] += 1;
  diagnostics[totalKey] += duration;
  diagnostics[maxKey] = Math.max(diagnostics[maxKey], duration);
}

export function recordShelfMainListCommit(durationMs: number): void {
  recordCommit(durationMs, 'mainListCommits', 'mainListDurationTotalMs', 'mainListDurationMaxMs');
}

export function recordShelfArchiveListCommit(durationMs: number): void {
  recordCommit(
    durationMs,
    'archiveListCommits',
    'archiveListDurationTotalMs',
    'archiveListDurationMaxMs',
  );
}

export function recordShelfProductRowRender(): void {
  const diagnostics = mutableDiagnostics();
  if (diagnostics) diagnostics.productRowRenders += 1;
}

export function recordShelfArchiveRowRender(): void {
  const diagnostics = mutableDiagnostics();
  if (diagnostics) diagnostics.archiveRowRenders += 1;
}

export function recordShelfHeaderRender(): void {
  const diagnostics = mutableDiagnostics();
  if (diagnostics) diagnostics.headerRenders += 1;
}

export function recordShelfFooterRender(): void {
  const diagnostics = mutableDiagnostics();
  if (diagnostics) diagnostics.footerRenders += 1;
}

export function readShelfRenderDiagnostics(): ShelfRenderDiagnosticsSnapshot {
  const diagnostics = mutableDiagnostics();
  return diagnostics ? Object.freeze({ ...diagnostics }) : EMPTY_DIAGNOSTICS;
}

export function resetShelfRenderDiagnostics(): void {
  const diagnostics = mutableDiagnostics();
  if (!diagnostics) return;
  Object.assign(diagnostics, EMPTY_DIAGNOSTICS);
}
