import { BRAND } from '@/lib/brand';

import type { CatalogReportOutcome } from './client';
import { catalogReportTransportInput, type CatalogReportInput } from './reportTransport';

export type CatalogReportFeedback = { title: string; message: string };
export type CatalogReportIdentityField = { label: string; value: string };

const PRODUCT_IDENTITY_LABELS = {
  productName: 'Product name',
  brand: 'Brand',
  category: 'Category',
  ingredientsText: 'Ingredient text',
  sourceName: 'Catalog source name',
  sourceUrl: 'Catalog source URL',
  defaultPaoMonths: 'PAO months',
  qualityIssue: 'Quality issue',
  suggestedCorrection: 'Suggested correction',
} as const;

const REPORT_CONTEXT_LABELS = {
  addedVia: 'Intake method',
  quality: 'Catalog quality',
  source: 'Catalog source',
  platform: 'Platform',
  appVersion: 'App version',
  buildNumber: 'Build number',
  route: 'Intake route',
} as const;

function displayValue(value: unknown): string | null {
  if (typeof value === 'string') return value.trim() || null;
  if (typeof value === 'number' && Number.isFinite(value)) return String(value);
  if (typeof value === 'boolean') return value ? 'yes' : 'no';
  return null;
}

/**
 * Keep the product identity list derived from the exact transport input so a
 * confirmation cannot drift away from what the report will send.
 */
export function catalogReportIdentityFields(
  input: CatalogReportInput,
): CatalogReportIdentityField[] {
  const transport = catalogReportTransportInput(input);
  const fields: CatalogReportIdentityField[] = [];
  const productId = displayValue(transport.productId);
  const barcode = displayValue(transport.barcode);
  if (productId) fields.push({ label: 'Catalog product ID', value: productId });
  if (barcode) fields.push({ label: 'Barcode', value: barcode });

  for (const [key, label] of Object.entries(PRODUCT_IDENTITY_LABELS)) {
    const payloadKey = key as keyof NonNullable<CatalogReportInput['proposedPayload']>;
    const value = displayValue(transport.proposedPayload?.[payloadKey]);
    if (value) fields.push({ label, value });
  }
  return fields;
}

/** Match the Edge report identity gate after applying the shared client sanitizer. */
export function catalogReportHasRequiredIdentity(input: CatalogReportInput): boolean {
  const transport = catalogReportTransportInput(input);
  const productId = displayValue(transport.productId);
  const barcode = displayValue(transport.barcode);
  const productName = displayValue(transport.proposedPayload?.productName);

  if (transport.correctionType === 'missing_product') {
    return Boolean(barcode || productName);
  }
  if (transport.correctionType === 'wrong_match') {
    return Boolean(productId && (barcode || productName));
  }
  return catalogReportIdentityFields(transport).length > 0;
}

/** Sanitized report-detail preview; the content-free transport retry ID is separate. */
export function catalogReportDisclosureFields(
  input: CatalogReportInput,
): CatalogReportIdentityField[] {
  const transport = catalogReportTransportInput(input);
  const fields: CatalogReportIdentityField[] = [
    { label: 'Selected issue', value: transport.correctionType },
    ...catalogReportIdentityFields(transport),
  ];
  const description = displayValue(transport.description);
  if (description) fields.push({ label: 'Report reason', value: description });
  for (const [key, label] of Object.entries(REPORT_CONTEXT_LABELS)) {
    const contextKey = key as keyof NonNullable<CatalogReportInput['clientContext']>;
    const value = displayValue(transport.clientContext?.[contextKey]);
    if (value) fields.push({ label, value });
  }
  return fields;
}

export function catalogReportFeedback(outcome: CatalogReportOutcome): CatalogReportFeedback {
  switch (outcome.result) {
    case 'success':
      return outcome.correction.created
        ? {
            title: 'Report sent',
            message: `Thanks. ${BRAND.appName}'s catalog-review team received this report for review.`,
          }
        : {
            title: 'Report already received',
            message: `No duplicate was created. The earlier report is currently ${outcome.correction.status}.`,
          };
    case 'not_configured':
      return {
        title: 'Report not sent',
        message: 'Catalog reporting is unavailable in this build, so nothing was sent.',
      };
    case 'offline_or_withdrawn':
      return {
        title: 'Report not sent',
        message:
          "We couldn't confirm delivery. Check your connection and health-data consent, then try again. No retry was queued on this device.",
      };
    case 'rate_limited':
      return {
        title: 'Try again later',
        message: `${BRAND.appName} did not accept a new report because the report limit was reached. Try again in about 15 minutes.`,
      };
    case 'retryable':
      return {
        title: 'Try again in a moment',
        message:
          'Another account, consent, or report update is finishing. Delivery was not confirmed. Trying again reuses this request receipt and cannot create a duplicate.',
      };
    case 'invalid_request':
      return {
        title: 'Report not sent',
        message: 'This report could not be validated. Close the confirmation and review it again.',
      };
    case 'request_conflict':
      return {
        title: 'Review before sending again',
        message:
          'This report request belongs to different report details or an earlier consent window. Nothing new was accepted. Open a new confirmation before sending again.',
      };
    case 'error':
      return {
        title: 'Report not sent',
        message:
          "We couldn't confirm delivery. No retry was queued on this device. Try again later.",
      };
  }
}
