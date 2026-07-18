import { describe, expect, it, vi } from 'vitest';
import {
  cancelCatalogReportOperation,
  createCatalogReportOperation,
  editCatalogReportOperation,
  finishCatalogReportOperation,
  markCatalogReportOperationAttempted,
} from './reportOperation';

vi.mock('expo-crypto', () => ({
  randomUUID: () => 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
}));

const REQUEST_A = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
const REQUEST_B = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';

const baseInput = {
  correctionType: 'missing_product' as const,
  barcode: '012345678905',
  description: 'missing_product reported from barcode no-match',
};

describe('catalog report operation lifecycle', () => {
  it('keeps one request identity through an ambiguous retry and clears it on success', () => {
    const operation = createCatalogReportOperation(baseInput, () => REQUEST_A);
    const attempted = markCatalogReportOperationAttempted(operation);
    const ambiguous = finishCatalogReportOperation(attempted, {
      result: 'offline_or_withdrawn',
    });

    expect(ambiguous).toEqual({
      attempted: true,
      input: { reportRequestId: REQUEST_A, ...baseInput },
    });
    expect(cancelCatalogReportOperation(ambiguous)).toBe(ambiguous);
    expect(
      finishCatalogReportOperation(attempted, {
        result: 'success',
        correction: {
          id: '00000000-0000-4000-8000-000000000901',
          status: 'open',
          createdAt: '2026-07-18T12:00:00.000Z',
          created: true,
        },
      }),
    ).toBeNull();
  });

  it('reuses the request identity for preflight edits but rotates it after dispatch', () => {
    const operation = createCatalogReportOperation(baseInput, () => REQUEST_A);
    const preflightEdit = editCatalogReportOperation(
      operation,
      { ...baseInput, proposedPayload: { productName: 'Edited product' } },
      () => REQUEST_B,
    );
    expect(preflightEdit.input.reportRequestId).toBe(REQUEST_A);

    const postDispatchEdit = editCatalogReportOperation(
      markCatalogReportOperationAttempted(preflightEdit),
      { ...baseInput, proposedPayload: { productName: 'Another product' } },
      () => REQUEST_B,
    );
    expect(postDispatchEdit).toEqual({
      attempted: false,
      input: {
        reportRequestId: REQUEST_B,
        ...baseInput,
        proposedPayload: { productName: 'Another product' },
      },
    });
  });

  it('abandons only confirmations that were never dispatched', () => {
    const operation = createCatalogReportOperation(baseInput, () => REQUEST_A);
    expect(cancelCatalogReportOperation(operation)).toBeNull();
    expect(cancelCatalogReportOperation(markCatalogReportOperationAttempted(operation))).not.toBe(
      null,
    );
  });
});
