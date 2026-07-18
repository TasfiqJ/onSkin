import { describe, expect, it } from 'vitest';

import type { CatalogReportInput } from './client';
import {
  catalogReportDisclosureFields,
  catalogReportFeedback,
  catalogReportHasRequiredIdentity,
  catalogReportIdentityFields,
} from './reportPresentation';

describe('catalog report presentation contract', () => {
  it('derives the exact product identity fields from the report input', () => {
    expect(
      catalogReportIdentityFields({
        correctionType: 'wrong_match',
        productId: '00000000-0000-4000-8000-000000000123',
        barcode: '012345678905',
        proposedPayload: {
          productName: 'Barrier Serum',
          brand: 'Evidence Lab',
          category: 'serum',
          sourceName: 'Reviewed catalog',
          sourceUrl: 'https://catalog.example/products/123',
          qualityIssue: 'wrong_match',
        },
      }),
    ).toEqual([
      { label: 'Catalog product ID', value: '00000000-0000-4000-8000-000000000123' },
      { label: 'Barcode', value: '012345678905' },
      { label: 'Product name', value: 'Barrier Serum' },
      { label: 'Brand', value: 'Evidence Lab' },
      { label: 'Category', value: 'serum' },
      { label: 'Catalog source name', value: 'Reviewed catalog' },
      { label: 'Catalog source URL', value: 'https://catalog.example/products/123' },
      { label: 'Quality issue', value: 'wrong_match' },
    ]);
  });

  it('does not duplicate a top-level barcode from proposed payload disclosure', () => {
    expect(
      catalogReportIdentityFields({
        correctionType: 'missing_product',
        barcode: '012345678905',
        proposedPayload: { barcode: '012345678905', productName: 'Unknown product' },
      } as unknown as CatalogReportInput),
    ).toEqual([
      { label: 'Barcode', value: '012345678905' },
      { label: 'Product name', value: 'Unknown product' },
    ]);
  });

  it('previews the exact sanitized transport without dropping legitimate catalog names', () => {
    const input: CatalogReportInput = {
      correctionType: 'missing_product',
      description: 'missing_product reported from catalog search',
      proposedPayload: {
        productName: '  Photoderm   Aquafluide  ',
        brand: 'Image Skincare',
        sourceUrl: 'https://catalog.example/products/123?token=private#review',
      },
      clientContext: { addedVia: 'search', route: 'shelf_search' },
    };

    expect(catalogReportIdentityFields(input)).toEqual([
      { label: 'Product name', value: 'Photoderm Aquafluide' },
      { label: 'Brand', value: 'Image Skincare' },
      { label: 'Catalog source URL', value: 'https://catalog.example/products/123' },
    ]);
    expect(catalogReportDisclosureFields(input)).toEqual([
      { label: 'Selected issue', value: 'missing_product' },
      { label: 'Product name', value: 'Photoderm Aquafluide' },
      { label: 'Brand', value: 'Image Skincare' },
      { label: 'Catalog source URL', value: 'https://catalog.example/products/123' },
      { label: 'Report reason', value: 'missing_product reported from catalog search' },
      { label: 'Intake method', value: 'search' },
      { label: 'Intake route', value: 'shelf_search' },
    ]);
  });

  it('keeps the identity gate closed when sanitization removes the only unsafe identity', () => {
    expect(
      catalogReportIdentityFields({
        correctionType: 'missing_product',
        proposedPayload: { productName: 'user email test@example.com' },
      }),
    ).toEqual([]);
  });

  it('matches the Edge identity gate for product-name-only reports', () => {
    expect(
      catalogReportHasRequiredIdentity({
        correctionType: 'missing_product',
        proposedPayload: { productName: 'Photoderm Aquafluide' },
      }),
    ).toBe(true);
    expect(
      catalogReportHasRequiredIdentity({
        correctionType: 'missing_product',
        proposedPayload: { productName: 'Image Skincare Vital C' },
      }),
    ).toBe(true);
    expect(
      catalogReportHasRequiredIdentity({
        correctionType: 'missing_product',
        proposedPayload: { brand: 'Image Skincare' },
      }),
    ).toBe(false);
    expect(
      catalogReportHasRequiredIdentity({
        correctionType: 'wrong_match',
        productId: '00000000-0000-4000-8000-000000000123',
      }),
    ).toBe(false);
    expect(
      catalogReportHasRequiredIdentity({
        correctionType: 'wrong_match',
        productId: '00000000-0000-4000-8000-000000000123',
        proposedPayload: { productName: 'Photoderm Aquafluide' },
      }),
    ).toBe(true);
  });

  it('keeps every transport outcome truthful and distinct', () => {
    expect(catalogReportFeedback({ result: 'not_configured' })).toEqual({
      title: 'Report not sent',
      message: 'Catalog reporting is unavailable in this build, so nothing was sent.',
    });
    expect(catalogReportFeedback({ result: 'offline_or_withdrawn' }).message).toContain(
      "couldn't confirm delivery",
    );
    expect(catalogReportFeedback({ result: 'rate_limited' }).title).toBe('Try again later');
    expect(catalogReportFeedback({ result: 'error' }).message).toContain('No retry was queued');
    expect(
      catalogReportFeedback({
        result: 'success',
        correction: {
          id: '00000000-0000-4000-8000-000000000999',
          status: 'open',
          createdAt: '2026-07-18T12:00:00.000Z',
          created: true,
        },
      }).message,
    ).not.toMatch(/block|recommendation/i);
    expect(
      catalogReportFeedback({
        result: 'success',
        correction: {
          id: '00000000-0000-4000-8000-000000000999',
          status: 'triaged',
          createdAt: '2026-07-18T12:00:00.000Z',
          created: false,
        },
      }),
    ).toEqual({
      title: 'Report already received',
      message: 'No duplicate was created. The earlier report is currently triaged.',
    });
  });
});
