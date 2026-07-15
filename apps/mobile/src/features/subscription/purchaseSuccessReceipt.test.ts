import { afterEach, describe, expect, it, vi } from 'vitest';

import {
  beginAccountGenerationBoundary,
  endAccountGenerationBoundary,
} from '@/lib/auth/accountGeneration';
import { createOwnerQueryScope } from '@/lib/query/queryKeys';

import { deriveState, type StoredEntitlement } from './entitlement';
import {
  consumePurchaseSuccessReceipt,
  mintPurchaseSuccessReceipt,
  PurchaseSuccessReceiptVault,
} from './purchaseSuccessReceipt';

vi.mock('expo-crypto', () => ({
  randomUUID: () => 'cccccccc-cccc-4ccc-8ccc-cccccccccccc',
}));

const NOW = '2026-07-15T12:00:00.000Z';
const NOW_MS = Date.parse(NOW);
const ID_A = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
const ID_B = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';
const ID_C = 'cccccccc-cccc-4ccc-8ccc-cccccccccccc';

function entitlement(overrides: Partial<StoredEntitlement> = {}): StoredEntitlement {
  return {
    tier: 'pro',
    isActive: true,
    periodType: 'trial',
    store: 'app_store',
    productId: 'onskin_pro_annual',
    expiresAt: '2026-07-29T12:00:00.000Z',
    willRenew: true,
    grantedAt: NOW,
    source: 'revenuecat',
    environment: 'production',
    verifiedAt: NOW,
    priceLabel: '$49.99',
    ...overrides,
  };
}

function commercialTerms(
  overrides: Partial<{
    purchasePriceLabel: string;
    purchasePeriodLabel: string;
    offerDurationLabel: string;
    renewalPriceLabel: string;
    renewalPeriodLabel: string;
  }> = {},
) {
  return {
    purchasePriceLabel: '$49.99',
    purchasePeriodLabel: 'year',
    offerDurationLabel: 'year',
    renewalPriceLabel: '$49.99',
    renewalPeriodLabel: 'year',
    ...overrides,
  };
}

describe('purchase success receipts', () => {
  let boundaryActive = false;

  afterEach(() => {
    if (boundaryActive) {
      endAccountGenerationBoundary();
      boundaryActive = false;
    }
  });

  it('mints once for this action proof only after it wins ordered publication', () => {
    const owner = createOwnerQueryScope();
    const accepted = entitlement();
    const published = deriveState(accepted, NOW, 'fresh');
    const id = mintPurchaseSuccessReceipt(owner, accepted, published, {
      action: 'purchase',
      completed: true,
      commercialTerms: commercialTerms(),
      nowMs: NOW_MS,
      appEnvironment: 'production',
      createId: () => ID_A,
    });

    expect(id).toBe(ID_A);
    expect(consumePurchaseSuccessReceipt(owner, id, NOW_MS + 1)).toEqual({
      action: 'purchase',
      inTrial: true,
      expiresAt: accepted.expiresAt,
      willRenew: true,
      purchasePriceLabel: null,
      purchasePeriodLabel: null,
      offerDurationLabel: null,
      renewalPriceLabel: '$49.99',
      renewalPeriodLabel: 'year',
    });
    expect(consumePurchaseSuccessReceipt(owner, id, NOW_MS + 2)).toBeNull();
  });

  it('fails soft when opaque receipt ID generation throws after verified purchase', () => {
    const owner = createOwnerQueryScope();
    const accepted = entitlement();

    expect(
      mintPurchaseSuccessReceipt(owner, accepted, deriveState(accepted, NOW, 'fresh'), {
        action: 'purchase',
        completed: true,
        commercialTerms: commercialTerms(),
        nowMs: NOW_MS,
        appEnvironment: 'production',
        createId: () => {
          throw new Error('secure randomness unavailable');
        },
      }),
    ).toBeNull();
  });

  it('does not mint when another proof wins, or for app-granted/pre-existing access', () => {
    const owner = createOwnerQueryScope();
    const accepted = entitlement();
    const newer = entitlement({
      productId: 'onskin_pro_monthly',
      verifiedAt: '2026-07-15T12:00:01.000Z',
    });

    expect(
      mintPurchaseSuccessReceipt(owner, accepted, deriveState(accepted, NOW, 'fresh'), {
        action: 'purchase',
        completed: false,
        commercialTerms: commercialTerms(),
        nowMs: NOW_MS,
        appEnvironment: 'production',
        createId: () => ID_A,
      }),
    ).toBeNull();

    expect(
      mintPurchaseSuccessReceipt(owner, accepted, deriveState(newer, NOW, 'fresh'), {
        action: 'purchase',
        completed: true,
        commercialTerms: commercialTerms(),
        nowMs: NOW_MS,
        appEnvironment: 'production',
        createId: () => ID_A,
      }),
    ).toBeNull();

    const appGrant = entitlement({
      periodType: 'reverse_trial',
      store: 'app_granted',
      productId: null,
      willRenew: false,
      source: 'app_granted',
    });
    expect(
      mintPurchaseSuccessReceipt(owner, appGrant, deriveState(appGrant, NOW, 'fresh'), {
        action: 'purchase',
        completed: true,
        commercialTerms: commercialTerms(),
        nowMs: NOW_MS,
        appEnvironment: 'production',
        createId: () => ID_B,
      }),
    ).toBeNull();
  });

  it('requires exact renewal metadata instead of synthesizing success copy', () => {
    const owner = createOwnerQueryScope();
    for (const [accepted, terms] of [
      [entitlement({ expiresAt: null }), commercialTerms()],
      [entitlement({ priceLabel: null }), commercialTerms()],
      [entitlement(), commercialTerms({ renewalPriceLabel: '' })],
      [entitlement(), commercialTerms({ renewalPeriodLabel: '' })],
    ] as const) {
      expect(
        mintPurchaseSuccessReceipt(owner, accepted, deriveState(accepted, NOW, 'fresh'), {
          action: 'purchase',
          completed: true,
          commercialTerms: terms,
          nowMs: NOW_MS,
          appEnvironment: 'production',
          createId: () => ID_A,
        }),
      ).toBeNull();
    }
  });

  it('keeps finite win-back price, billing interval, duration, and renewal separate', () => {
    const owner = createOwnerQueryScope();
    const accepted = entitlement({ periodType: 'normal', priceLabel: '$49.99' });
    const id = mintPurchaseSuccessReceipt(owner, accepted, deriveState(accepted, NOW, 'fresh'), {
      action: 'winback',
      completed: true,
      commercialTerms: commercialTerms({
        purchasePriceLabel: '$4.99',
        purchasePeriodLabel: 'month',
        offerDurationLabel: '3 months',
        renewalPriceLabel: '$49.99',
        renewalPeriodLabel: 'year',
      }),
      nowMs: NOW_MS,
      appEnvironment: 'production',
      createId: () => ID_B,
    });

    expect(consumePurchaseSuccessReceipt(owner, id, NOW_MS + 1)).toEqual({
      action: 'winback',
      inTrial: false,
      expiresAt: accepted.expiresAt,
      willRenew: true,
      purchasePriceLabel: '$4.99',
      purchasePeriodLabel: 'month',
      offerDurationLabel: '3 months',
      renewalPriceLabel: '$49.99',
      renewalPeriodLabel: 'year',
    });
  });

  it('rejects win-back success when the finite offer duration is missing', () => {
    const owner = createOwnerQueryScope();
    const accepted = entitlement({ periodType: 'normal', priceLabel: '$49.99' });

    expect(
      mintPurchaseSuccessReceipt(owner, accepted, deriveState(accepted, NOW, 'fresh'), {
        action: 'winback',
        completed: true,
        commercialTerms: commercialTerms({
          purchasePriceLabel: '$4.99',
          purchasePeriodLabel: 'month',
          offerDurationLabel: '',
        }),
        nowMs: NOW_MS,
        appEnvironment: 'production',
        createId: () => ID_B,
      }),
    ).toBeNull();
  });

  it('requires stored auto-renew attribution to match the standard renewal price', () => {
    const owner = createOwnerQueryScope();
    const wronglyAttributed = entitlement({
      periodType: 'normal',
      priceLabel: '$4.99',
    });

    expect(
      mintPurchaseSuccessReceipt(
        owner,
        wronglyAttributed,
        deriveState(wronglyAttributed, NOW, 'fresh'),
        {
          action: 'winback',
          completed: true,
          commercialTerms: commercialTerms({
            purchasePriceLabel: '$4.99',
            purchasePeriodLabel: 'month',
            offerDurationLabel: '3 months',
            renewalPriceLabel: '$49.99',
            renewalPeriodLabel: 'year',
          }),
          nowMs: NOW_MS,
          appEnvironment: 'production',
          createId: () => ID_B,
        },
      ),
    ).toBeNull();
  });

  it('attributes a non-renewing win-back proof to its offer price without renewal copy', () => {
    const owner = createOwnerQueryScope();
    const accepted = entitlement({
      periodType: 'normal',
      priceLabel: '$4.99',
      willRenew: false,
    });
    const id = mintPurchaseSuccessReceipt(owner, accepted, deriveState(accepted, NOW, 'fresh'), {
      action: 'winback',
      completed: true,
      commercialTerms: commercialTerms({
        purchasePriceLabel: '$4.99',
        purchasePeriodLabel: 'month',
        offerDurationLabel: '3 months',
        renewalPriceLabel: '$49.99',
        renewalPeriodLabel: 'year',
      }),
      nowMs: NOW_MS,
      appEnvironment: 'production',
      createId: () => ID_C,
    });

    expect(consumePurchaseSuccessReceipt(owner, id, NOW_MS + 1)).toMatchObject({
      action: 'winback',
      willRenew: false,
      purchasePriceLabel: '$4.99',
      renewalPriceLabel: null,
      renewalPeriodLabel: null,
    });
  });

  it('rejects an account-A receipt after the owner generation changes', () => {
    const ownerA = createOwnerQueryScope();
    const accepted = entitlement({ periodType: 'normal', priceLabel: '$49.99' });
    const id = mintPurchaseSuccessReceipt(ownerA, accepted, deriveState(accepted, NOW, 'fresh'), {
      action: 'winback',
      completed: true,
      commercialTerms: commercialTerms({
        purchasePriceLabel: '$29.99',
        purchasePeriodLabel: 'month',
        offerDurationLabel: '6 months',
        renewalPriceLabel: '$49.99',
      }),
      nowMs: NOW_MS,
      appEnvironment: 'production',
      createId: () => ID_B,
    });
    expect(id).toBe(ID_B);

    beginAccountGenerationBoundary();
    boundaryActive = true;
    endAccountGenerationBoundary();
    boundaryActive = false;
    const ownerB = createOwnerQueryScope();

    expect(consumePurchaseSuccessReceipt(ownerB, id, NOW_MS + 1)).toBeNull();
    expect(consumePurchaseSuccessReceipt(ownerA, id, NOW_MS + 1)).toBeNull();
  });

  it('keeps a verified non-renewing purchase honest instead of inventing renewal terms', () => {
    const owner = createOwnerQueryScope();
    const accepted = entitlement({ periodType: 'normal', willRenew: false });
    const id = mintPurchaseSuccessReceipt(owner, accepted, deriveState(accepted, NOW, 'fresh'), {
      action: 'purchase',
      completed: true,
      commercialTerms: commercialTerms({
        renewalPriceLabel: '',
        renewalPeriodLabel: '',
      }),
      nowMs: NOW_MS,
      appEnvironment: 'production',
      createId: () => ID_C,
    });

    expect(consumePurchaseSuccessReceipt(owner, id, NOW_MS + 1)).toMatchObject({
      willRenew: false,
      renewalPriceLabel: null,
      renewalPeriodLabel: null,
    });
  });

  it('bounds storage, TTL, clock rollback, IDs, and one-use consumption', () => {
    const vault = new PurchaseSuccessReceiptVault(100, 2);
    const payload = {
      action: 'winback',
      inTrial: false,
      expiresAt: '2026-08-15T12:00:00.000Z',
      willRenew: true,
      purchasePriceLabel: '$29.99',
      purchasePeriodLabel: 'month',
      offerDurationLabel: '6 months',
      renewalPriceLabel: '$49.99',
      renewalPeriodLabel: 'year',
    } as const;

    expect(
      vault.mint(1, payload, 1_000, () => {
        throw new Error('secure randomness unavailable');
      }),
    ).toBeNull();
    expect(vault.mint(1, payload, 1_000, () => 'not-an-id')).toBeNull();
    expect(vault.mint(1, payload, 1_000, () => ID_A)).toBe(ID_A);
    expect(vault.consume(1, ID_A, 999)).toBeNull();
    expect(vault.consume(1, ID_A, 1_001)).toBeNull();

    expect(vault.mint(1, payload, 2_000, () => ID_A)).toBe(ID_A);
    expect(vault.consume(1, ID_A, 2_100)).toBeNull();

    const bounded = new PurchaseSuccessReceiptVault(1_000, 2);
    expect(bounded.mint(1, payload, 3_000, () => ID_A)).toBe(ID_A);
    expect(bounded.mint(1, payload, 3_001, () => ID_B)).toBe(ID_B);
    expect(bounded.mint(1, payload, 3_002, () => ID_C)).toBe(ID_C);
    expect(bounded.consume(1, ID_A, 3_003)).toBeNull();
    expect(bounded.consume(1, ID_B, 3_003)).toEqual(payload);
    expect(bounded.consume(1, ID_C, 3_003)).toEqual(payload);
  });
});
