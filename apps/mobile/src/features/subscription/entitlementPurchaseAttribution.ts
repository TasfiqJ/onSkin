import type { StoredEntitlement } from './entitlement';

export type RevenueCatActionAttribution = Readonly<{
  productId?: string;
  packageId?: string;
  offeringId?: string;
  priceLabel?: string;
  purchasePriceLabel?: string;
  renewalPriceLabel?: string;
}>;

/**
 * Commercial action metadata is trustworthy only when the native product and
 * classified CustomerInfo entitlement describe the same non-null product.
 * Restore/listener paths omit productId and therefore publish proof without
 * claiming that a specific purchase action produced it.
 */
export function prepareRevenueCatActionProof(
  entitlement: StoredEntitlement,
  attribution: RevenueCatActionAttribution,
): Readonly<{ entitlement: StoredEntitlement; actionProductMatched: boolean }> {
  const actionProductMatched =
    attribution.productId === undefined ||
    (entitlement.productId !== null && entitlement.productId === attribution.productId);
  if (!actionProductMatched || attribution.productId === undefined) {
    return { entitlement, actionProductMatched };
  }

  return {
    actionProductMatched: true,
    entitlement: {
      ...entitlement,
      packageId: attribution.packageId ?? entitlement.packageId ?? null,
      offeringId: attribution.offeringId ?? entitlement.offeringId ?? null,
      priceLabel:
        (entitlement.willRenew
          ? attribution.renewalPriceLabel ?? attribution.priceLabel
          : attribution.purchasePriceLabel ?? attribution.priceLabel) ??
        entitlement.priceLabel ??
        null,
    },
  };
}
