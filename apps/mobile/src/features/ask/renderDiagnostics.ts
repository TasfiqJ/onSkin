export const ASK_RENDER_DIAGNOSTICS_GLOBAL = '__LAYERWELL_ASK_RENDER_DIAGNOSTICS__' as const;

export type AskRenderDiagnosticsSnapshot = Readonly<{
  acceptedTurns: number;
  historyCommits: number;
  logicalMessages: number;
  messageRenders: number;
  visibleMessages: number;
}>;

type MutableAskRenderDiagnostics = {
  acceptedTurns: number;
  historyCommits: number;
  logicalMessages: number;
  messageRenders: number;
  visibleMessages: number;
};

type AskDiagnosticsGlobal = typeof globalThis & {
  __LAYERWELL_ASK_RENDER_DIAGNOSTICS__?: MutableAskRenderDiagnostics;
};

const EMPTY_DIAGNOSTICS: AskRenderDiagnosticsSnapshot = Object.freeze({
  acceptedTurns: 0,
  historyCommits: 0,
  logicalMessages: 0,
  messageRenders: 0,
  visibleMessages: 0,
});

function diagnosticsEnabled(): boolean {
  return typeof __DEV__ !== 'undefined' && __DEV__;
}

function mutableDiagnostics(): MutableAskRenderDiagnostics | null {
  if (!diagnosticsEnabled()) return null;
  const root = globalThis as AskDiagnosticsGlobal;
  root.__LAYERWELL_ASK_RENDER_DIAGNOSTICS__ ??= { ...EMPTY_DIAGNOSTICS };
  return root.__LAYERWELL_ASK_RENDER_DIAGNOSTICS__;
}

/** Content-free local counters for the human-simulated keystroke profile. */
export function recordAskHistoryCommit(): void {
  const diagnostics = mutableDiagnostics();
  if (diagnostics) diagnostics.historyCommits += 1;
}

export function recordAskMessageRender(): void {
  const diagnostics = mutableDiagnostics();
  if (diagnostics) diagnostics.messageRenders += 1;
}

export function recordAskAcceptedTurn(): void {
  const diagnostics = mutableDiagnostics();
  if (diagnostics) diagnostics.acceptedTurns += 1;
}

export function recordAskLogicalMessageCount(count: number): void {
  const diagnostics = mutableDiagnostics();
  if (diagnostics) {
    diagnostics.logicalMessages = Number.isFinite(count) ? Math.max(0, Math.floor(count)) : 0;
  }
}

export function recordAskVisibleMessageCount(count: number): void {
  const diagnostics = mutableDiagnostics();
  if (diagnostics) {
    diagnostics.visibleMessages = Number.isFinite(count) ? Math.max(0, Math.floor(count)) : 0;
  }
}

export function readAskRenderDiagnostics(): AskRenderDiagnosticsSnapshot {
  const diagnostics = mutableDiagnostics();
  return diagnostics ? { ...diagnostics } : EMPTY_DIAGNOSTICS;
}

export function resetAskRenderDiagnostics(): void {
  const diagnostics = mutableDiagnostics();
  if (!diagnostics) return;
  diagnostics.acceptedTurns = 0;
  diagnostics.historyCommits = 0;
  diagnostics.logicalMessages = 0;
  diagnostics.messageRenders = 0;
  diagnostics.visibleMessages = 0;
}
