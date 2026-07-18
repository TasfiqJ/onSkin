import { randomUUID } from 'expo-crypto';

import type { CatalogReportOutcome } from './client';
import {
  catalogReportHasValidRequestId,
  catalogReportTransportInput,
  type CatalogReportInput,
} from './reportTransport';

export type CatalogReportOperation = Readonly<{
  attempted: boolean;
  input: CatalogReportInput;
}>;

type RequestIdFactory = () => string;

function requestInput(
  input: CatalogReportInput,
  createRequestId: RequestIdFactory,
): CatalogReportInput {
  const candidate = catalogReportTransportInput({
    ...input,
    reportRequestId: createRequestId(),
  });
  if (!catalogReportHasValidRequestId(candidate)) {
    throw new Error('CATALOG_REPORT_REQUEST_ID_INVALID');
  }
  return candidate;
}

/** Start one explicit report intent with a cryptographically random replay identity. */
export function createCatalogReportOperation(
  input: CatalogReportInput,
  createRequestId: RequestIdFactory = randomUUID,
): CatalogReportOperation {
  return Object.freeze({ attempted: false, input: requestInput(input, createRequestId) });
}

/** Freeze the exact request body before the first irreversible dispatch. */
export function markCatalogReportOperationAttempted(
  operation: CatalogReportOperation,
): CatalogReportOperation {
  return operation.attempted ? operation : Object.freeze({ ...operation, attempted: true });
}

/**
 * Before dispatch, edits keep the same intent ID. After an ambiguous dispatch,
 * an edit is a new intent and must never reuse the prior request ID.
 */
export function editCatalogReportOperation(
  operation: CatalogReportOperation,
  input: CatalogReportInput,
  createRequestId: RequestIdFactory = randomUUID,
): CatalogReportOperation {
  if (operation.attempted) return createCatalogReportOperation(input, createRequestId);
  const candidate = catalogReportTransportInput({
    ...input,
    reportRequestId: operation.input.reportRequestId,
  });
  if (!catalogReportHasValidRequestId(candidate)) {
    throw new Error('CATALOG_REPORT_REQUEST_ID_INVALID');
  }
  return Object.freeze({ attempted: false, input: candidate });
}

/** Keep an ambiguous operation for a user retry; a confirmed receipt is terminal. */
export function finishCatalogReportOperation(
  operation: CatalogReportOperation,
  outcome: CatalogReportOutcome,
): CatalogReportOperation | null {
  return outcome.result === 'success' ||
    outcome.result === 'invalid_request' ||
    outcome.result === 'request_conflict'
    ? null
    : markCatalogReportOperationAttempted(operation);
}

/** Canceling an unsent confirmation abandons it; an attempted receipt stays retryable. */
export function cancelCatalogReportOperation(
  operation: CatalogReportOperation | null,
): CatalogReportOperation | null {
  return operation?.attempted ? operation : null;
}
