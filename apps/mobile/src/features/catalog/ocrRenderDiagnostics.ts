export const OCR_REVIEW_RENDER_DIAGNOSTICS_GLOBAL =
  '__ONSKIN_OCR_REVIEW_RENDER_DIAGNOSTICS__' as const;

export type OcrReviewRenderDiagnosticsSnapshot = Readonly<{
  screenRenders: number;
  capturePanelRenders: number;
  editorCommits: number;
  editorDurationTotalMs: number;
  editorDurationMaxMs: number;
  draftChanges: number;
  previewParses: number;
  previewRenders: number;
  exactSubmissions: number;
}>;

type MutableOcrReviewRenderDiagnostics = {
  screenRenders: number;
  capturePanelRenders: number;
  editorCommits: number;
  editorDurationTotalMs: number;
  editorDurationMaxMs: number;
  draftChanges: number;
  previewParses: number;
  previewRenders: number;
  exactSubmissions: number;
};

type OcrDiagnosticsGlobal = typeof globalThis & {
  __ONSKIN_OCR_REVIEW_RENDER_DIAGNOSTICS__?: MutableOcrReviewRenderDiagnostics;
};

const EMPTY_DIAGNOSTICS: OcrReviewRenderDiagnosticsSnapshot = Object.freeze({
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

function diagnosticsEnabled(): boolean {
  return typeof __DEV__ !== 'undefined' && __DEV__;
}

function mutableDiagnostics(): MutableOcrReviewRenderDiagnostics | null {
  if (!diagnosticsEnabled()) return null;
  const root = globalThis as OcrDiagnosticsGlobal;
  root.__ONSKIN_OCR_REVIEW_RENDER_DIAGNOSTICS__ ??= { ...EMPTY_DIAGNOSTICS };
  return root.__ONSKIN_OCR_REVIEW_RENDER_DIAGNOSTICS__;
}

function finiteDuration(durationMs: number): number {
  return Number.isFinite(durationMs) ? Math.max(0, durationMs) : 0;
}

export function recordOcrReviewScreenRender(): void {
  const diagnostics = mutableDiagnostics();
  if (diagnostics) diagnostics.screenRenders += 1;
}

export function recordOcrCapturePanelRender(): void {
  const diagnostics = mutableDiagnostics();
  if (diagnostics) diagnostics.capturePanelRenders += 1;
}

export function recordOcrEditorCommit(durationMs: number): void {
  const diagnostics = mutableDiagnostics();
  if (!diagnostics) return;
  const duration = finiteDuration(durationMs);
  diagnostics.editorCommits += 1;
  diagnostics.editorDurationTotalMs += duration;
  diagnostics.editorDurationMaxMs = Math.max(diagnostics.editorDurationMaxMs, duration);
}

export function recordOcrDraftChange(): void {
  const diagnostics = mutableDiagnostics();
  if (diagnostics) diagnostics.draftChanges += 1;
}

export function recordOcrPreviewParse(): void {
  const diagnostics = mutableDiagnostics();
  if (diagnostics) diagnostics.previewParses += 1;
}

export function recordOcrPreviewRender(): void {
  const diagnostics = mutableDiagnostics();
  if (diagnostics) diagnostics.previewRenders += 1;
}

export function recordOcrExactSubmission(): void {
  const diagnostics = mutableDiagnostics();
  if (diagnostics) diagnostics.exactSubmissions += 1;
}

export function readOcrReviewRenderDiagnostics(): OcrReviewRenderDiagnosticsSnapshot {
  const diagnostics = mutableDiagnostics();
  return diagnostics ? Object.freeze({ ...diagnostics }) : EMPTY_DIAGNOSTICS;
}

export function resetOcrReviewRenderDiagnostics(): void {
  const diagnostics = mutableDiagnostics();
  if (!diagnostics) return;
  Object.assign(diagnostics, EMPTY_DIAGNOSTICS);
}
