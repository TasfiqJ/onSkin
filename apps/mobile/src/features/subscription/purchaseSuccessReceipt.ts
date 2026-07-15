import { randomUUID } from 'expo-crypto';

import { env, type AppEnvironment } from '@/lib/env';
import { isOwnerQueryScopeCurrent, type OwnerQueryScope } from '@/lib/query/queryKeys';

import type { StoredEntitlement, SubscriptionState } from './entitlement';
import { resolveEntitlementCacheRead } from './entitlementEvidence';

export const PURCHASE_SUCCESS_RECEIPT_TTL_MS = 60_000;
export const PURCHASE_SUCCESS_RECEIPT_CAPACITY = 16;

const OPAQUE_ID = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

type PurchaseSuccessReceiptBase = Readonly<{
  expiresAt: string;
  willRenew: boolean;
  renewalPriceLabel: string | null;
  renewalPeriodLabel: string | null;
}>;

export type PurchaseSuccessReceipt =
  | (PurchaseSuccessReceiptBase &
      Readonly<{
        action: 'purchase';
        inTrial: true;
        purchasePriceLabel: null;
        purchasePeriodLabel: null;
        offerDurationLabel: null;
      }>)
  | (PurchaseSuccessReceiptBase &
      Readonly<{
        action: 'purchase';
        inTrial: false;
        purchasePriceLabel: string;
        purchasePeriodLabel: string;
        offerDurationLabel: null;
      }>)
  | (PurchaseSuccessReceiptBase &
      Readonly<{
        action: 'winback';
        inTrial: false;
        purchasePriceLabel: string;
        purchasePeriodLabel: string;
        offerDurationLabel: string;
      }>);

export type PurchaseCommercialTerms = Readonly<{
  purchasePriceLabel?: string;
  purchasePeriodLabel?: string;
  offerDurationLabel?: string;
  renewalPriceLabel?: string;
  renewalPeriodLabel?: string;
}>;

type StoredReceipt = Readonly<{
  ownerGeneration: number;
  createdAtMs: number;
  payload: PurchaseSuccessReceipt;
}>;

function canonicalFutureTimestamp(value: string | null, nowMs: number): string | null {
  if (!value) return null;
  const parsed = Date.parse(value);
  if (!Number.isFinite(parsed) || new Date(parsed).toISOString() !== value || parsed <= nowMs) {
    return null;
  }
  return value;
}

function commercialLabel(value: string | null | undefined, maxLength = 128): string | null {
  const normalized = value?.trim() ?? '';
  if (!normalized || normalized.length > maxLength || /[\r\n\u0000]/.test(normalized)) {
    return null;
  }
  return normalized;
}

function receiptPayload(
  acceptedEntitlement: StoredEntitlement,
  publishedState: SubscriptionState,
  nowMs: number,
  appEnvironment: AppEnvironment,
  action: 'purchase' | 'winback',
  terms: PurchaseCommercialTerms,
): PurchaseSuccessReceipt | null {
  const nowISO = new Date(nowMs).toISOString();
  const acceptedState = resolveEntitlementCacheRead(
    { status: 'available', entitlement: acceptedEntitlement },
    nowISO,
    appEnvironment,
  );
  const actionProofWon =
    acceptedState.isPro &&
    publishedState.isPro &&
    acceptedState.evidenceIdentity !== null &&
    acceptedState.evidenceIdentity === publishedState.evidenceIdentity;
  const storeBacked =
    publishedState.store === 'app_store' ||
    publishedState.store === 'play_store' ||
    publishedState.store === 'web' ||
    publishedState.store === 'test_store';
  const expiresAt = canonicalFutureTimestamp(publishedState.expiresAt, nowMs);
  const acceptedPriceLabel = commercialLabel(acceptedEntitlement.priceLabel);
  const publishedPriceLabel = commercialLabel(publishedState.priceLabel);
  const purchasePriceLabel = commercialLabel(terms.purchasePriceLabel);
  const purchasePeriodLabel = commercialLabel(terms.purchasePeriodLabel, 64);
  const offerDurationLabel = commercialLabel(terms.offerDurationLabel, 64);
  const renewalPriceLabel = commercialLabel(terms.renewalPriceLabel);
  const renewalPeriodLabel = commercialLabel(terms.renewalPeriodLabel, 64);
  const willRenew = publishedState.willRenew;
  const inTrial = publishedState.inTrial;
  const storedPriceLabel = willRenew ? renewalPriceLabel : purchasePriceLabel;

  if (
    !actionProofWon ||
    !storeBacked ||
    !publishedState.productId ||
    !expiresAt ||
    !purchasePriceLabel ||
    !storedPriceLabel ||
    storedPriceLabel !== acceptedPriceLabel ||
    storedPriceLabel !== publishedPriceLabel ||
    willRenew === null ||
    (action === 'winback' && inTrial) ||
    (!inTrial && !purchasePeriodLabel) ||
    (action === 'winback' && !offerDurationLabel) ||
    (willRenew && (!renewalPriceLabel || !renewalPeriodLabel))
  ) {
    return null;
  }

  const renewal = {
    expiresAt,
    willRenew,
    renewalPriceLabel: willRenew ? renewalPriceLabel : null,
    renewalPeriodLabel: willRenew ? renewalPeriodLabel : null,
  };
  if (inTrial) {
    return {
      ...renewal,
      action: 'purchase',
      inTrial: true,
      purchasePriceLabel: null,
      purchasePeriodLabel: null,
      offerDurationLabel: null,
    };
  }
  if (!purchasePeriodLabel) return null;
  return action === 'winback'
    ? offerDurationLabel
      ? {
          ...renewal,
          action,
          inTrial: false,
          purchasePriceLabel,
          purchasePeriodLabel,
          offerDurationLabel,
        }
      : null
    : {
        ...renewal,
        action,
        inTrial: false,
        purchasePriceLabel,
        purchasePeriodLabel,
        offerDurationLabel: null,
      };
}

export class PurchaseSuccessReceiptVault {
  private readonly receipts = new Map<string, StoredReceipt>();

  constructor(
    private readonly ttlMs = PURCHASE_SUCCESS_RECEIPT_TTL_MS,
    private readonly capacity = PURCHASE_SUCCESS_RECEIPT_CAPACITY,
  ) {}

  private prune(nowMs: number) {
    for (const [id, receipt] of this.receipts) {
      if (nowMs - receipt.createdAtMs >= this.ttlMs) this.receipts.delete(id);
    }
    while (this.receipts.size >= this.capacity) {
      const oldest = this.receipts.keys().next().value as string | undefined;
      if (!oldest) break;
      this.receipts.delete(oldest);
    }
  }

  mint(
    ownerGeneration: number,
    payload: PurchaseSuccessReceipt,
    nowMs: number,
    createId: () => string,
  ): string | null {
    try {
      this.prune(nowMs);
      const id = createId().toLowerCase();
      if (!OPAQUE_ID.test(id) || this.receipts.has(id)) return null;
      this.receipts.set(id, { ownerGeneration, createdAtMs: nowMs, payload });
      return id;
    } catch {
      return null;
    }
  }

  /** Atomically removes before returning so refresh/back cannot replay success. */
  consume(ownerGeneration: number, id: string, nowMs: number): PurchaseSuccessReceipt | null {
    if (!OPAQUE_ID.test(id)) return null;
    const normalized = id.toLowerCase();
    const receipt = this.receipts.get(normalized);
    if (!receipt) return null;
    this.receipts.delete(normalized);
    if (
      receipt.ownerGeneration !== ownerGeneration ||
      nowMs - receipt.createdAtMs >= this.ttlMs ||
      nowMs < receipt.createdAtMs
    ) {
      return null;
    }
    return receipt.payload;
  }
}

const receiptVault = new PurchaseSuccessReceiptVault();

/** Mint only when this action's accepted proof is still the ordered cache winner. */
export function mintPurchaseSuccessReceipt(
  ownerScope: OwnerQueryScope,
  acceptedEntitlement: StoredEntitlement | null,
  publishedState: SubscriptionState,
  options: {
    action: 'purchase' | 'winback';
    completed: boolean;
    commercialTerms: PurchaseCommercialTerms;
    nowMs?: number;
    appEnvironment?: AppEnvironment;
    createId?: () => string;
  },
): string | null {
  if (!options.completed || !acceptedEntitlement || !isOwnerQueryScopeCurrent(ownerScope)) {
    return null;
  }
  const nowMs = options.nowMs ?? Date.now();
  const payload = receiptPayload(
    acceptedEntitlement,
    publishedState,
    nowMs,
    options.appEnvironment ?? env.appEnvironment,
    options.action,
    options.commercialTerms,
  );
  if (!payload || !isOwnerQueryScopeCurrent(ownerScope)) return null;
  try {
    return receiptVault.mint(ownerScope.generation, payload, nowMs, options.createId ?? randomUUID);
  } catch {
    // Receipt generation is auxiliary after native payment completion. Never
    // reject a completed purchase and invite a second charge.
    return null;
  }
}

export function consumePurchaseSuccessReceipt(
  ownerScope: OwnerQueryScope,
  id: string | null | undefined,
  nowMs = Date.now(),
): PurchaseSuccessReceipt | null {
  if (!id || !isOwnerQueryScopeCurrent(ownerScope)) return null;
  return receiptVault.consume(ownerScope.generation, id, nowMs);
}
