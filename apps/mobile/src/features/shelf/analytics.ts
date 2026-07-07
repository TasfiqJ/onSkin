import { track } from '@/lib/analytics/track';

export const PRODUCT_ADD_START_SOURCES = [
  'onboarding',
  'empty_scan',
  'empty_manual',
  'scan_fab',
  'scan_inline',
  'scan_label',
  'scan_search',
  'scan_manual',
  'miss_label',
  'miss_manual',
  'catalog_manual',
  'opened_recovery',
  'recommendation',
  'commerce',
  'share_scan',
  'share_manual',
] as const;

export type ProductAddStartSource = (typeof PRODUCT_ADD_START_SOURCES)[number];

export function trackProductAddStarted(source: ProductAddStartSource): void {
  track('product_add_started', { source });
}
