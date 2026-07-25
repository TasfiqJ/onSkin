import { describe, expect, it } from 'vitest';

import {
  canAcceptBarcodeFrame,
  isBarcodeScannerActive,
  isBarcodeScanTerminal,
  reduceBarcodeScanSession,
  type BarcodeLookupOutcome,
  type BarcodeScanState,
} from './barcodeScanSession';

type TestProduct = { id: string };

const IDLE: BarcodeScanState<TestProduct> = { kind: 'idle' };
const BARCODE = '012345678905';

function start(state: BarcodeScanState<TestProduct> = IDLE, barcode = BARCODE, attemptId = 1) {
  return reduceBarcodeScanSession(state, { type: 'lookup_started', barcode, attemptId });
}

function finish(
  state: BarcodeScanState<TestProduct>,
  outcome: BarcodeLookupOutcome<TestProduct>,
  barcode = BARCODE,
  attemptId = 1,
) {
  return reduceBarcodeScanSession(state, {
    type: 'lookup_finished',
    barcode,
    attemptId,
    outcome,
  });
}

describe('barcode scan session', () => {
  it('accepts exactly one synchronous lookup start from idle', () => {
    const lookingUp = start();

    expect(lookingUp).toEqual({ kind: 'looking_up', barcode: BARCODE, attemptId: 1 });
    expect(start(lookingUp)).toBe(lookingUp);
    expect(start(lookingUp, '4006381333931', 2)).toBe(lookingUp);
  });

  it('keeps invalid reads terminal until an explicit reset', () => {
    const invalid: BarcodeScanState<TestProduct> = reduceBarcodeScanSession(IDLE, {
      type: 'invalid',
      reason: 'Checksum failed.',
    });

    expect(invalid).toEqual({ kind: 'invalid', reason: 'Checksum failed.' });
    expect(isBarcodeScanTerminal(invalid)).toBe(true);
    expect(start(invalid)).toBe(invalid);
    expect(reduceBarcodeScanSession(invalid, { type: 'reset' })).toEqual(IDLE);
  });

  it.each([
    {
      outcome: {
        kind: 'matched',
        product: { id: 'product-1' },
        external: false,
      } satisfies BarcodeLookupOutcome<TestProduct>,
      expected: 'matched',
    },
    {
      outcome: { kind: 'no_match' } satisfies BarcodeLookupOutcome<TestProduct>,
      expected: 'no_match',
    },
    {
      outcome: { kind: 'offline' } satisfies BarcodeLookupOutcome<TestProduct>,
      expected: 'offline',
    },
    {
      outcome: {
        kind: 'error',
        reason: 'Lookup failed.',
      } satisfies BarcodeLookupOutcome<TestProduct>,
      expected: 'error',
    },
  ])('keeps $expected outcomes terminal until reset', ({ outcome, expected }) => {
    const terminal = finish(start(), outcome);

    expect(terminal.kind).toBe(expected);
    expect(isBarcodeScanTerminal(terminal)).toBe(true);
    expect(start(terminal)).toBe(terminal);
    expect(start(terminal, '4006381333931', 2)).toBe(terminal);
    expect(reduceBarcodeScanSession(terminal, { type: 'reset' })).toEqual(IDLE);
  });

  it('fences lookup completion and cancellation to the exact active barcode', () => {
    const lookingUp = start();

    expect(finish(lookingUp, { kind: 'no_match' }, '4006381333931')).toBe(lookingUp);
    expect(
      reduceBarcodeScanSession(lookingUp, {
        type: 'lookup_cancelled',
        barcode: '4006381333931',
        attemptId: 1,
      }),
    ).toBe(lookingUp);
    expect(
      reduceBarcodeScanSession(lookingUp, {
        type: 'lookup_cancelled',
        barcode: BARCODE,
        attemptId: 1,
      }),
    ).toEqual(IDLE);
  });

  it('does not let stale same-barcode work replace or reopen a newer attempt', () => {
    const oldLookup = start(IDLE, BARCODE, 1);
    const reset = reduceBarcodeScanSession(oldLookup, { type: 'reset' });
    const newLookup = start(reset, BARCODE, 2);

    expect(
      reduceBarcodeScanSession(newLookup, {
        type: 'lookup_cancelled',
        barcode: BARCODE,
        attemptId: 1,
      }),
    ).toBe(newLookup);
    expect(finish(newLookup, { kind: 'no_match' }, BARCODE, 1)).toBe(newLookup);
    expect(finish(newLookup, { kind: 'no_match' }, BARCODE, 2)).toEqual({
      kind: 'no_match',
      barcode: BARCODE,
    });
  });

  it('accepts the same barcode immediately after deliberate reset', () => {
    const terminal = finish(start(), { kind: 'no_match' });
    const reset = reduceBarcodeScanSession(terminal, { type: 'reset' });

    expect(start(reset, BARCODE, 2)).toEqual({
      kind: 'looking_up',
      barcode: BARCODE,
      attemptId: 2,
    });
  });

  it('activates camera frames only for an available, focused, idle session', () => {
    const lookingUp = start();
    const terminal = finish(lookingUp, { kind: 'offline' });

    expect(canAcceptBarcodeFrame(IDLE)).toBe(true);
    expect(isBarcodeScannerActive(IDLE, true, true)).toBe(true);
    expect(isBarcodeScannerActive(IDLE, false, true)).toBe(false);
    expect(isBarcodeScannerActive(IDLE, true, false)).toBe(false);
    expect(isBarcodeScannerActive(lookingUp, true, true)).toBe(false);
    expect(isBarcodeScannerActive(terminal, true, true)).toBe(false);
  });

  it('treats a camera start failure as a terminal error', () => {
    const failed = reduceBarcodeScanSession(IDLE, {
      type: 'camera_failed',
      reason: 'Camera could not start.',
    });

    expect(failed).toEqual({
      kind: 'error',
      barcode: '',
      reason: 'Camera could not start.',
    });
    expect(isBarcodeScanTerminal(failed)).toBe(true);
  });
});
