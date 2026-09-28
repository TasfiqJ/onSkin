import { describe, expect, it } from 'vitest';

import type { ItemDetail } from './operatorApi';
import {
  canClaim,
  canReadQueue,
  leaseIsCurrent,
  releaseReceiptId,
  transitionOptionsFor,
} from './workflow';

const base: ItemDetail = {
  itemKind: 'correction_report',
  itemId: '5cb99441-cd91-4236-a9ad-3c733937a4e1',
  itemVersion: 2,
  status: 'open',
  detail: {},
};

describe('operator workflow policy', () => {
  it('hides queue and claim actions without the matching capability', () => {
    expect(canReadQueue('correction', new Set())).toBe(false);
    expect(canReadQueue('source_import', new Set(['source_queue_read']))).toBe(true);
    expect(canClaim('correction_report', new Set(['source_claim']))).toBe(false);
    expect(canClaim('import_batch', new Set(['source_claim']))).toBe(true);
    expect(canClaim('product_hold', new Set(['catalog_hold_release']))).toBe(false);
    expect(canClaim('product_hold', new Set(['catalog_hold_claim']))).toBe(true);
  });

  it('offers only status- and capability-valid correction decisions', () => {
    expect(transitionOptionsFor(base, new Set(['correction_triage']))).toHaveLength(7);
    expect(transitionOptionsFor(base, new Set(['correction_disposition']))).toEqual([]);
    expect(
      transitionOptionsFor(
        { ...base, status: 'triaged' },
        new Set(['correction_disposition']),
      ).map(({ decision, reasonCode }) => `${decision}:${reasonCode}`),
    ).toEqual([
      'accept:repair_required',
      'reject:not_reproducible',
      'reject:report_incorrect',
      'reject:insufficient_evidence',
    ]);
  });

  it('requires a current repair receipt and release capability', () => {
    const hold: ItemDetail = {
      ...base,
      itemKind: 'product_hold',
      status: 'repair_attested',
      detail: { repairReceiptId: '8AC66978-BE1E-4D8C-9EBB-B6D8DB7A87CF' },
    };
    expect(releaseReceiptId(hold, new Set(['catalog_repair_attest']))).toBeNull();
    expect(releaseReceiptId(hold, new Set(['catalog_hold_release']))).toBe(
      '8ac66978-be1e-4d8c-9ebb-b6d8db7a87cf',
    );
  });

  it('fails closed for expired and malformed leases', () => {
    expect(leaseIsCurrent('2026-07-22T12:00:01.000Z', Date.parse('2026-07-22T12:00:00Z'))).toBe(
      true,
    );
    expect(leaseIsCurrent('2026-07-22T12:00:00.000Z', Date.parse('2026-07-22T12:00:00Z'))).toBe(
      false,
    );
    expect(leaseIsCurrent('not-a-date', Date.now())).toBe(false);
  });
});
