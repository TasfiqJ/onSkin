export type BarcodeScanState<Product = unknown> =
  | { kind: 'idle' }
  | { kind: 'invalid'; reason: string }
  | { kind: 'looking_up'; barcode: string; attemptId: number }
  | { kind: 'matched'; barcode: string; product: Product; external: boolean }
  | { kind: 'no_match'; barcode: string }
  | { kind: 'offline'; barcode: string }
  | { kind: 'error'; barcode: string; reason: string };

export type BarcodeLookupOutcome<Product = unknown> =
  | { kind: 'matched'; product: Product; external: boolean }
  | { kind: 'no_match' }
  | { kind: 'offline' }
  | { kind: 'error'; reason: string };

export type BarcodeScanAction<Product = unknown> =
  | { type: 'reset' }
  | { type: 'invalid'; reason: string }
  | { type: 'camera_failed'; reason: string }
  | { type: 'lookup_started'; barcode: string; attemptId: number }
  | {
      type: 'lookup_finished';
      barcode: string;
      attemptId: number;
      outcome: BarcodeLookupOutcome<Product>;
    }
  | { type: 'lookup_cancelled'; barcode: string; attemptId: number };

export function canAcceptBarcodeFrame(state: BarcodeScanState): boolean {
  return state.kind === 'idle';
}

export function isBarcodeScanTerminal(state: BarcodeScanState): boolean {
  return (
    state.kind === 'invalid' ||
    state.kind === 'matched' ||
    state.kind === 'no_match' ||
    state.kind === 'offline' ||
    state.kind === 'error'
  );
}

export function isBarcodeScannerActive(
  state: BarcodeScanState,
  cameraAvailable: boolean,
  isFocused: boolean,
): boolean {
  return cameraAvailable && isFocused && canAcceptBarcodeFrame(state);
}

export function reduceBarcodeScanSession<Product>(
  state: BarcodeScanState<Product>,
  action: BarcodeScanAction<Product>,
): BarcodeScanState<Product> {
  switch (action.type) {
    case 'reset':
      return state.kind === 'idle' ? state : { kind: 'idle' };
    case 'invalid':
      return state.kind === 'idle' ? { kind: 'invalid', reason: action.reason } : state;
    case 'camera_failed':
      return state.kind === 'idle' ? { kind: 'error', barcode: '', reason: action.reason } : state;
    case 'lookup_started':
      return state.kind === 'idle'
        ? { kind: 'looking_up', barcode: action.barcode, attemptId: action.attemptId }
        : state;
    case 'lookup_cancelled':
      return state.kind === 'looking_up' &&
        state.barcode === action.barcode &&
        state.attemptId === action.attemptId
        ? { kind: 'idle' }
        : state;
    case 'lookup_finished':
      if (
        state.kind !== 'looking_up' ||
        state.barcode !== action.barcode ||
        state.attemptId !== action.attemptId
      ) {
        return state;
      }
      switch (action.outcome.kind) {
        case 'matched':
          return {
            kind: 'matched',
            barcode: action.barcode,
            product: action.outcome.product,
            external: action.outcome.external,
          };
        case 'no_match':
          return { kind: 'no_match', barcode: action.barcode };
        case 'offline':
          return { kind: 'offline', barcode: action.barcode };
        case 'error':
          return {
            kind: 'error',
            barcode: action.barcode,
            reason: action.outcome.reason,
          };
      }
  }
}
