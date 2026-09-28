import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { AccountPublicationControllerError } from '@/lib/auth/accountPublicationController';

import {
  activateRevenueCatPublication,
  accountPublicationSnapshot,
  closeRevenueCatPublication,
  configureRevenueCat,
  customerInfoToStoredEntitlement,
  getCustomerInfo,
  getSubscriptionOffering,
  getUncachedCustomerInfo,
  purchasePackage,
  purchaseWinBackPackage,
  revenueCatUnconfirmedStoreMessage,
  reserveRevenueCatPublication,
  showRevenueCatInAppMessages,
  startRevenueCatDeletionQuiesce,
  subscribeToCustomerInfoUpdates,
} from './revenuecat';

const mocks = vi.hoisted(() => {
  let capability = 0;
  const purchases = {
    ENTITLEMENT_VERIFICATION_MODE: { INFORMATIONAL: 'INFORMATIONAL' },
    INTRO_ELIGIBILITY_STATUS: {
      INTRO_ELIGIBILITY_STATUS_ELIGIBLE: 2,
      INTRO_ELIGIBILITY_STATUS_INELIGIBLE: 1,
      INTRO_ELIGIBILITY_STATUS_NO_INTRO_OFFER_EXISTS: 3,
      INTRO_ELIGIBILITY_STATUS_UNKNOWN: 0,
    },
    LOG_LEVEL: { DEBUG: 'DEBUG', WARN: 'WARN' },
    IN_APP_MESSAGE_TYPE: {
      BILLING_ISSUE: 0,
      PRICE_INCREASE_CONSENT: 1,
      GENERIC: 2,
      WIN_BACK_OFFER: 3,
    },
    PURCHASES_ERROR_CODE: { PURCHASE_CANCELLED_ERROR: 'PURCHASE_CANCELLED_ERROR' },
    addCustomerInfoUpdateListener: vi.fn(),
    configure: vi.fn(),
    checkTrialOrIntroductoryPriceEligibility: vi.fn(),
    getCustomerInfo: vi.fn(),
    getEligibleWinBackOffersForPackage: vi.fn(),
    getOfferings: vi.fn(),
    isConfigured: vi.fn(),
    invalidateCustomerInfoCache: vi.fn(),
    logIn: vi.fn(),
    purchasePackage: vi.fn(),
    purchasePackageWithWinBackOffer: vi.fn(),
    removeCustomerInfoUpdateListener: vi.fn(),
    setLogLevel: vi.fn(),
    showInAppMessages: vi.fn(async (_messageTypes?: number[]) => {}),
  };
  return {
    nextCapability: () => {
      capability += 1;
      return capability.toString(16).padStart(64, '0');
    },
    durableDeletionBlock: false,
    iosWinBackEnabled: false,
    platformOs: 'ios',
    purchases,
  };
});

vi.mock('react-native', () => ({
  Platform: {
    get OS() {
      return mocks.platformOs;
    },
  },
}));
vi.mock('react-native-purchases', () => ({ default: mocks.purchases }));
// These are publication-controller tests. Real preflight policy and service
// ordering are exercised separately in p1PurchasePreflight.test.ts.
vi.mock('@/features/subscription/purchasePreflight', () => ({
  assertSubscriptionCheckoutDependencies: async () => {},
  assertStandardPurchaseReady: async () => {},
}));
vi.mock('@/features/settings/accountDeletionBarrier', () => ({
  isAccountActivityBlockedForDeletion: () => false,
  isAccountActivityDurablyBlockedForDeletion: () => mocks.durableDeletionBlock,
  subscribeToAccountDeletionActivityBlock: () => () => {},
}));
vi.mock('@/lib/env', () => ({
  env: {
    appEnvironment: 'production',
    revenueCatAndroidKey: 'goog_known_key',
    revenueCatEntitlementId: 'pro',
    revenueCatAnnualProductId: 'layerwell_pro_annual',
    revenueCatMonthlyProductId: 'layerwell_pro_monthly',
    revenueCatIosKey: 'appl_known_key',
    revenueCatTestStoreKey: '',
    get iosWinBackEnabled() {
      return mocks.iosWinBackEnabled;
    },
  },
}));
vi.mock('@/lib/auth/accountPublicationFence', () => ({
  accountPublicationSessionBinding: (accessToken: string, subject: string) => ({
    accessToken,
    sessionId: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
    subject,
  }),
  createAccountPublicationCapability: async () => mocks.nextCapability(),
  exchangeAccountPublicationFence: async (action: string) => {
    if (action === 'publication_reserve') return 'reserved';
    if (action === 'publication_release') return 'released';
    return 'active';
  },
}));

const USER_ID = '11111111-1111-4111-8111-111111111111';
const USER_B = '22222222-2222-4222-8222-222222222222';

beforeEach(() => {
  vi.stubGlobal('__DEV__', false);
  mocks.durableDeletionBlock = false;
  mocks.iosWinBackEnabled = false;
  mocks.platformOs = 'ios';
});

afterEach(async () => {
  await closeRevenueCatPublication('shutdown').catch(() => {});
  vi.clearAllMocks();
  vi.unstubAllGlobals();
});

describe('RevenueCat publication integration', () => {
  it('treats only an active RevenueCat entitlement as affirmative cache authority', () => {
    const expired = {
      identifier: 'pro',
      isActive: false,
      periodType: 'NORMAL',
      store: 'APP_STORE',
      productIdentifier: 'pro.expired',
      expirationDate: '2026-07-01T00:00:00.000Z',
      willRenew: false,
      originalPurchaseDate: '2026-06-01T00:00:00.000Z',
      isSandbox: false,
      verification: 'VERIFIED',
    };
    const active = {
      ...expired,
      isActive: true,
      productIdentifier: 'pro.active',
      expirationDate: '2026-08-01T00:00:00.000Z',
      willRenew: true,
    };
    const customerInfo = (
      activeEntitlements: Record<string, typeof active>,
      allEntitlements: Record<string, typeof expired>,
    ) =>
      ({
        entitlements: {
          active: activeEntitlements,
          all: allEntitlements,
          verification: 'VERIFIED',
        },
        subscriptionsByProductIdentifier: {},
        managementURL: null,
        requestDate: '2026-07-14T00:00:00.000Z',
        originalAppUserId: USER_ID,
      }) as unknown as Parameters<typeof customerInfoToStoredEntitlement>[0];

    expect(customerInfoToStoredEntitlement(customerInfo({}, { pro: expired }))).toBeNull();
    expect(
      customerInfoToStoredEntitlement(customerInfo({ pro: expired }, { pro: expired })),
    ).toBeNull();
    expect(
      customerInfoToStoredEntitlement(customerInfo({ pro: active }, { pro: expired })),
    ).toMatchObject({
      isActive: true,
      productId: 'pro.active',
      source: 'revenuecat',
    });
  });

  it('rejects failed Trusted Entitlements and trusts requestDate only for VERIFIED', () => {
    const active = {
      identifier: 'pro',
      isActive: true,
      periodType: 'NORMAL',
      store: 'APP_STORE',
      productIdentifier: 'pro.active',
      expirationDate: '2026-08-01T00:00:00.000Z',
      willRenew: true,
      originalPurchaseDate: '2026-06-01T00:00:00.000Z',
      isSandbox: false,
      verification: 'VERIFIED',
    };
    const customerInfo = (verification: string, store = 'APP_STORE') =>
      ({
        entitlements: {
          active: { pro: { ...active, store, verification } },
          all: { pro: { ...active, store, verification } },
          verification,
        },
        subscriptionsByProductIdentifier: {},
        managementURL: null,
        requestDate: '2026-07-14T00:00:00.000Z',
        originalAppUserId: USER_ID,
      }) as unknown as Parameters<typeof customerInfoToStoredEntitlement>[0];

    expect(customerInfoToStoredEntitlement(customerInfo('VERIFIED'))).toMatchObject({
      verifiedAt: '2026-07-14T00:00:00.000Z',
    });
    expect(customerInfoToStoredEntitlement(customerInfo('VERIFIED_ON_DEVICE'))).toMatchObject({
      isActive: true,
      verifiedAt: null,
    });
    expect(() => customerInfoToStoredEntitlement(customerInfo('NOT_REQUESTED'))).toThrow(
      'REVENUECAT_ENTITLEMENT_VERIFICATION_NOT_REQUESTED',
    );
    expect(() => customerInfoToStoredEntitlement(customerInfo('FAILED'))).toThrow(
      'REVENUECAT_ENTITLEMENT_VERIFICATION_FAILED',
    );
    const verified = customerInfo('VERIFIED');
    const divergent = {
      ...verified,
      entitlements: {
        ...verified.entitlements,
        active: {
          ...verified.entitlements.active,
          pro: { ...verified.entitlements.active.pro, verification: 'NOT_REQUESTED' },
        },
      },
    } as Parameters<typeof customerInfoToStoredEntitlement>[0];
    expect(() => customerInfoToStoredEntitlement(divergent)).toThrow(
      'REVENUECAT_ENTITLEMENT_VERIFICATION_MISMATCH',
    );
    expect(customerInfoToStoredEntitlement(customerInfo('VERIFIED', 'PROMOTIONAL'))).toMatchObject({
      isActive: true,
      productId: 'pro.active',
      source: 'revenuecat',
      store: 'promotional',
    });
  });

  it('uses truthful recovery copy when StoreKit completion crossed a closed boundary', () => {
    const error = new AccountPublicationControllerError(
      'ACCOUNT_PUBLICATION_STOREKIT_COMPLETION_UNCONFIRMED',
    );

    expect(revenueCatUnconfirmedStoreMessage(error, 'purchase')).toContain(
      'may have completed this purchase',
    );
    expect(revenueCatUnconfirmedStoreMessage(error, 'purchase')).toContain('Do not buy again yet');
    expect(revenueCatUnconfirmedStoreMessage(error, 'restore')).toContain(
      'may have restored a purchase',
    );
    expect(revenueCatUnconfirmedStoreMessage(new Error('offline'), 'purchase')).toBeNull();
    expect(
      revenueCatUnconfirmedStoreMessage(
        new AccountPublicationControllerError(
          'ACCOUNT_PUBLICATION_STORE_OPERATION_CALLER_DETACHED',
        ),
        'purchase',
      ),
    ).toContain('outcome is not known');
    expect(
      revenueCatUnconfirmedStoreMessage(
        new AccountPublicationControllerError('ACCOUNT_PUBLICATION_STORE_OPERATION_IN_PROGRESS'),
        'restore',
      ),
    ).toContain('still settling');
  });

  it('configures only with a known UUID, seals SDK admission, and retries known-ID login', async () => {
    mocks.purchases.isConfigured.mockResolvedValueOnce(false).mockResolvedValue(true);
    mocks.purchases.logIn.mockRejectedValueOnce(new Error('login unavailable')).mockResolvedValue({
      created: false,
    });

    await reserveRevenueCatPublication(USER_ID, 'session-token-1');
    await activateRevenueCatPublication(USER_ID, 'session-token-1');
    await configureRevenueCat(USER_ID);
    expect(mocks.purchases.configure).toHaveBeenCalledWith({
      apiKey: 'appl_known_key',
      appUserID: USER_ID,
      automaticDeviceIdentifierCollectionEnabled: false,
      shouldShowInAppMessagesAutomatically: false,
      entitlementVerificationMode: 'INFORMATIONAL',
    });
    expect(mocks.purchases.showInAppMessages).toHaveBeenCalledWith([0, 1, 2]);
    expect(mocks.purchases.showInAppMessages.mock.calls[0]?.[0]).not.toContain(3);

    await closeRevenueCatPublication('app_backgrounded');
    await expect(getCustomerInfo()).rejects.toMatchObject({
      code: 'ACCOUNT_PUBLICATION_ADMISSION_CLOSED',
    });
    expect(mocks.purchases.getCustomerInfo).not.toHaveBeenCalled();

    await reserveRevenueCatPublication(USER_ID, 'session-token-2');
    await activateRevenueCatPublication(USER_ID, 'session-token-2');
    await expect(configureRevenueCat(USER_ID)).rejects.toThrow('login unavailable');
    await expect(configureRevenueCat(USER_ID)).resolves.toBeUndefined();
    expect(mocks.purchases.logIn).toHaveBeenNthCalledWith(1, USER_ID);
    expect(mocks.purchases.logIn).toHaveBeenNthCalledWith(2, USER_ID);
    expect(mocks.purchases).not.toHaveProperty('logOut');
  });

  it('retries manual recovery messages without reconfiguring identity or invalidating offerings', async () => {
    const annual = {
      identifier: 'annual',
      offeringIdentifier: 'default',
      product: {
        identifier: 'layerwell_pro_annual',
        productCategory: 'SUBSCRIPTION',
        currencyCode: 'USD',
        price: 49.99,
        subscriptionPeriod: 'P1Y',
        title: 'Layerwell Pro Annual',
        priceString: 'US$49.99',
        pricePerMonthString: 'US$4.17',
        introPrice: null,
      },
    };
    const monthly = {
      identifier: 'monthly',
      offeringIdentifier: 'default',
      product: {
        identifier: 'layerwell_pro_monthly',
        productCategory: 'SUBSCRIPTION',
        currencyCode: 'USD',
        price: 9.99,
        subscriptionPeriod: 'P1M',
        title: 'Layerwell Pro Monthly',
        priceString: 'US$9.99',
        pricePerMonthString: 'US$9.99',
        introPrice: null,
      },
    };
    mocks.purchases.isConfigured.mockResolvedValue(false);
    mocks.purchases.showInAppMessages
      .mockRejectedValueOnce(new Error('message presentation unavailable'))
      .mockResolvedValueOnce(undefined);
    mocks.purchases.getOfferings.mockResolvedValue({
      current: { identifier: 'default', annual, monthly, availablePackages: [annual, monthly] },
    });

    await reserveRevenueCatPublication(USER_ID, 'session-token-message-retry');
    await activateRevenueCatPublication(USER_ID, 'session-token-message-retry');
    await expect(configureRevenueCat(USER_ID)).resolves.toBeUndefined();
    await expect(getSubscriptionOffering()).resolves.toMatchObject({ status: 'available' });
    await expect(showRevenueCatInAppMessages(USER_ID)).resolves.toBeUndefined();
    await expect(getSubscriptionOffering()).resolves.toMatchObject({ status: 'available' });

    expect(mocks.purchases.showInAppMessages.mock.calls).toEqual([[[0, 1, 2]], [[0, 1, 2]]]);
    expect(mocks.purchases.configure).toHaveBeenCalledOnce();
    expect(mocks.purchases.isConfigured).toHaveBeenCalledOnce();
    expect(mocks.purchases.logIn).not.toHaveBeenCalled();
    expect(mocks.purchases.getOfferings).toHaveBeenCalledTimes(2);
  });

  it('advertises an introductory trial only for an exact eligible App Store product result', async () => {
    const annual = {
      identifier: 'annual',
      offeringIdentifier: 'default',
      product: {
        identifier: 'layerwell_pro_annual',
        productCategory: 'SUBSCRIPTION',
        currencyCode: 'USD',
        price: 49.99,
        subscriptionPeriod: 'P1Y',
        title: 'Layerwell Pro Annual',
        priceString: '$49.99',
        pricePerMonthString: '$4.17',
        introPrice: {
          price: 0,
          periodUnit: 'DAY',
          periodNumberOfUnits: 14,
          cycles: 1,
        },
      },
    };
    const monthly = {
      identifier: 'monthly',
      offeringIdentifier: 'default',
      product: {
        identifier: 'layerwell_pro_monthly',
        productCategory: 'SUBSCRIPTION',
        currencyCode: 'USD',
        price: 9.99,
        subscriptionPeriod: 'P1M',
        title: 'Layerwell Pro Monthly',
        priceString: '$7.99',
        pricePerMonthString: '$7.99',
        introPrice: null,
      },
    };
    mocks.purchases.isConfigured.mockResolvedValue(false);
    mocks.purchases.getOfferings.mockResolvedValue({
      current: { identifier: 'default', annual, monthly, availablePackages: [annual, monthly] },
    });
    mocks.purchases.getEligibleWinBackOffersForPackage.mockResolvedValue([]);
    mocks.purchases.checkTrialOrIntroductoryPriceEligibility
      .mockResolvedValueOnce({ layerwell_pro_annual: { status: 2 } })
      .mockResolvedValueOnce({ layerwell_pro_annual: { status: 0 } });

    await reserveRevenueCatPublication(USER_ID, 'session-token-eligibility');
    await activateRevenueCatPublication(USER_ID, 'session-token-eligibility');

    await expect(getSubscriptionOffering(USER_ID)).resolves.toMatchObject({
      status: 'available',
      annual: { trialDays: 14, introLabel: '14 days free' },
      monthly: { trialDays: null, introLabel: null },
    });
    await expect(getSubscriptionOffering(USER_ID)).resolves.toMatchObject({
      status: 'available',
      annual: { trialDays: null, introLabel: null },
    });
    expect(mocks.purchases.checkTrialOrIntroductoryPriceEligibility).toHaveBeenNthCalledWith(1, [
      'layerwell_pro_annual',
    ]);
    expect(mocks.purchases.getEligibleWinBackOffersForPackage).not.toHaveBeenCalled();
  });

  it('returns disabled win-back purchase fallback before every provider and native call', async () => {
    await reserveRevenueCatPublication(USER_ID, 'session-token-disabled-win-back');
    await activateRevenueCatPublication(USER_ID, 'session-token-disabled-win-back');
    const nativeCall = {
      beforeNativeStoreCall: vi.fn(async () => {}),
      markNativeCallStarted: vi.fn(),
    };

    await expect(purchaseWinBackPackage(USER_ID, nativeCall)).resolves.toMatchObject({
      purchased: false,
      offerUnavailable: true,
    });

    expect(mocks.purchases.setLogLevel).not.toHaveBeenCalled();
    expect(mocks.purchases.isConfigured).not.toHaveBeenCalled();
    expect(mocks.purchases.configure).not.toHaveBeenCalled();
    expect(mocks.purchases.logIn).not.toHaveBeenCalled();
    expect(mocks.purchases.getOfferings).not.toHaveBeenCalled();
    expect(mocks.purchases.getEligibleWinBackOffersForPackage).not.toHaveBeenCalled();
    expect(mocks.purchases.purchasePackageWithWinBackOffer).not.toHaveBeenCalled();
    expect(nativeCall.beforeNativeStoreCall).not.toHaveBeenCalled();
    expect(nativeCall.markNativeCallStarted).not.toHaveBeenCalled();
  });

  it('keeps enabled win-back messages and purchases inert on non-iOS platforms', async () => {
    mocks.iosWinBackEnabled = true;
    mocks.platformOs = 'android';
    await reserveRevenueCatPublication(USER_ID, 'session-token-android-win-back');
    await activateRevenueCatPublication(USER_ID, 'session-token-android-win-back');
    const nativeCall = {
      beforeNativeStoreCall: vi.fn(async () => {}),
      markNativeCallStarted: vi.fn(),
    };

    await expect(purchaseWinBackPackage(USER_ID, nativeCall)).resolves.toMatchObject({
      purchased: false,
      offerUnavailable: true,
    });
    expect(mocks.purchases.setLogLevel).not.toHaveBeenCalled();
    expect(mocks.purchases.isConfigured).not.toHaveBeenCalled();
    expect(mocks.purchases.getOfferings).not.toHaveBeenCalled();
    expect(mocks.purchases.getEligibleWinBackOffersForPackage).not.toHaveBeenCalled();
    expect(mocks.purchases.purchasePackageWithWinBackOffer).not.toHaveBeenCalled();
    expect(nativeCall.beforeNativeStoreCall).not.toHaveBeenCalled();

    mocks.purchases.isConfigured.mockResolvedValue(false);
    await configureRevenueCat(USER_ID);
    expect(mocks.purchases.showInAppMessages).toHaveBeenCalledWith([0, 1, 2]);
    expect(mocks.purchases.showInAppMessages.mock.calls[0]?.[0]).not.toContain(3);
  });

  it('uses exact native eligibility and localized terms only in the governed enabled path', async () => {
    mocks.iosWinBackEnabled = true;
    const annual = {
      identifier: 'annual',
      offeringIdentifier: 'default',
      product: {
        identifier: 'layerwell_pro_annual',
        productCategory: 'SUBSCRIPTION',
        currencyCode: 'USD',
        price: 49.99,
        subscriptionPeriod: 'P1Y',
        title: 'Layerwell Pro Annual',
        priceString: 'US$49.99',
        pricePerMonthString: 'US$4.17',
        introPrice: null,
      },
    };
    const monthly = {
      identifier: 'monthly',
      offeringIdentifier: 'default',
      product: {
        identifier: 'layerwell_pro_monthly',
        productCategory: 'SUBSCRIPTION',
        currencyCode: 'USD',
        price: 9.99,
        subscriptionPeriod: 'P1M',
        title: 'Layerwell Pro Monthly',
        priceString: 'US$9.99',
        pricePerMonthString: 'US$9.99',
        introPrice: null,
      },
    };
    const nativeOffer = {
      identifier: 'native-win-back-2026',
      price: 34.99,
      priceString: 'US$34.99',
      cycles: 3,
      periodUnit: 'MONTH',
    };
    const customerInfo = {
      entitlements: { active: { pro: { isActive: true } } },
    };
    mocks.purchases.isConfigured.mockResolvedValue(false);
    mocks.purchases.getOfferings.mockResolvedValue({
      current: { identifier: 'default', annual, monthly, availablePackages: [annual, monthly] },
    });
    mocks.purchases.getEligibleWinBackOffersForPackage.mockResolvedValue([nativeOffer]);
    mocks.purchases.purchasePackageWithWinBackOffer.mockResolvedValue({
      customerInfo,
      productIdentifier: 'layerwell_pro_annual',
    });

    await reserveRevenueCatPublication(USER_ID, 'session-token-enabled-win-back');
    await activateRevenueCatPublication(USER_ID, 'session-token-enabled-win-back');
    await configureRevenueCat(USER_ID);

    expect(mocks.purchases.showInAppMessages).toHaveBeenCalledWith([0, 1, 2, 3]);
    await expect(getSubscriptionOffering()).resolves.toMatchObject({
      status: 'available',
      winBack: {
        offerId: 'native-win-back-2026',
        productId: 'layerwell_pro_annual',
        priceLabel: 'US$34.99',
        originalPriceLabel: 'US$49.99',
        percentOff: 30,
        periodLabel: '3 months',
        canPurchase: true,
      },
    });
    expect(mocks.purchases.getEligibleWinBackOffersForPackage).toHaveBeenCalledWith(annual);

    const nativeCall = {
      beforeNativeStoreCall: vi.fn(async () => {}),
      markNativeCallStarted: vi.fn(),
    };
    await expect(purchaseWinBackPackage(USER_ID, nativeCall)).resolves.toMatchObject({
      purchased: true,
      productId: 'layerwell_pro_annual',
      priceLabel: 'US$34.99',
    });
    expect(mocks.purchases.purchasePackageWithWinBackOffer).toHaveBeenCalledWith(
      annual,
      nativeOffer,
    );
    expect(nativeCall.beforeNativeStoreCall).toHaveBeenCalledOnce();
    expect(nativeCall.markNativeCallStarted).toHaveBeenCalledOnce();
  });

  it('rejects a foreign deletion quiesce synchronously and closes exact admission immediately', async () => {
    await reserveRevenueCatPublication(USER_ID, 'session-token-delete');
    await activateRevenueCatPublication(USER_ID, 'session-token-delete');

    expect(() => startRevenueCatDeletionQuiesce(USER_B)).toThrow(
      'ACCOUNT_PUBLICATION_BINDING_REJECTED',
    );
    const completion = startRevenueCatDeletionQuiesce(USER_ID);
    expect(accountPublicationSnapshot().state).toBe('draining');
    await expect(completion).resolves.toBeUndefined();
    expect(accountPublicationSnapshot()).toMatchObject({
      state: 'closed',
      subject: null,
      sessionId: null,
    });
  });

  it('never invokes the native SDK when authority closes during the awaited write-ahead hook', async () => {
    const pack = {
      identifier: 'annual',
      offeringIdentifier: 'default',
      product: {
        identifier: 'layerwell_pro_annual',
        productCategory: 'SUBSCRIPTION',
        currencyCode: 'USD',
        price: 49.99,
        subscriptionPeriod: 'P1Y',
        priceString: '$49.99',
      },
    };
    mocks.purchases.isConfigured.mockResolvedValue(false);
    mocks.purchases.getOfferings.mockResolvedValue({
      current: { identifier: 'default', annual: pack, monthly: null, availablePackages: [pack] },
    });
    await reserveRevenueCatPublication(USER_ID, 'session-token-hook');
    await activateRevenueCatPublication(USER_ID, 'session-token-hook');
    await configureRevenueCat(USER_ID);

    let releaseWriteAhead!: () => void;
    const writeAhead = new Promise<void>((resolve) => {
      releaseWriteAhead = resolve;
    });
    const hooks = {
      beforeNativeStoreCall: vi.fn(() => writeAhead),
      markNativeCallStarted: vi.fn(),
    };
    const purchase = purchasePackage('annual', USER_ID, hooks);
    await vi.waitFor(() => expect(hooks.beforeNativeStoreCall).toHaveBeenCalledOnce());

    const close = closeRevenueCatPublication('account_boundary');
    expect(accountPublicationSnapshot().state).toBe('draining');
    releaseWriteAhead();
    await expect(purchase).rejects.toMatchObject({
      code: 'ACCOUNT_PUBLICATION_STOREKIT_COMPLETION_UNCONFIRMED',
    });
    await expect(close).resolves.toBeUndefined();
    expect(hooks.markNativeCallStarted).not.toHaveBeenCalled();
    expect(mocks.purchases.purchasePackage).not.toHaveBeenCalled();
  });

  it('clears this attempt for the no-new-charge cancellation code without trusting its derived flag', async () => {
    const pack = {
      identifier: 'annual',
      offeringIdentifier: 'default',
      product: {
        identifier: 'layerwell_pro_annual',
        productCategory: 'SUBSCRIPTION',
        currencyCode: 'USD',
        price: 49.99,
        subscriptionPeriod: 'P1Y',
        priceString: '$49.99',
      },
    };
    mocks.purchases.isConfigured.mockResolvedValue(false);
    mocks.purchases.getOfferings.mockResolvedValue({
      current: { identifier: 'default', annual: pack, monthly: null, availablePackages: [pack] },
    });
    mocks.purchases.purchasePackage
      .mockRejectedValueOnce({ code: 'PURCHASE_CANCELLED_ERROR', userCancelled: false })
      .mockRejectedValueOnce({ code: 'PURCHASE_CANCELLED_ERROR', userCancelled: true });
    await reserveRevenueCatPublication(USER_ID, 'session-token-cancel');
    await activateRevenueCatPublication(USER_ID, 'session-token-cancel');
    await configureRevenueCat(USER_ID);

    for (let index = 0; index < 2; index += 1) {
      await expect(
        purchasePackage('annual', USER_ID, {
          beforeNativeStoreCall: vi.fn(async () => {}),
          markNativeCallStarted: vi.fn(),
        }),
      ).resolves.toMatchObject({ purchased: false, cancelled: true });
    }
    expect(mocks.purchases.purchasePackage).toHaveBeenCalledTimes(2);
  });

  it('removes a possibly partial native listener when native registration throws', async () => {
    const nativeError = new Error('native listener registration failed');
    mocks.purchases.isConfigured.mockResolvedValue(false);
    mocks.purchases.addCustomerInfoUpdateListener.mockImplementationOnce(() => {
      throw nativeError;
    });
    await reserveRevenueCatPublication(USER_ID, 'session-token-native-listener');
    await activateRevenueCatPublication(USER_ID, 'session-token-native-listener');
    await configureRevenueCat(USER_ID);

    await expect(subscribeToCustomerInfoUpdates(vi.fn())).rejects.toBe(nativeError);

    const wrapped = mocks.purchases.addCustomerInfoUpdateListener.mock.calls[0]?.[0];
    expect(wrapped).toEqual(expect.any(Function));
    expect(mocks.purchases.removeCustomerInfoUpdateListener).toHaveBeenCalledOnce();
    expect(mocks.purchases.removeCustomerInfoUpdateListener).toHaveBeenCalledWith(wrapped);
  });

  it('invalidates the SDK cache before a ticket-bound CustomerInfo refetch', async () => {
    const customerInfo = { requestDate: '2026-07-14T00:00:01.000Z' } as never;
    mocks.purchases.isConfigured.mockResolvedValue(false);
    mocks.purchases.invalidateCustomerInfoCache.mockResolvedValue(undefined);
    mocks.purchases.getCustomerInfo.mockResolvedValue(customerInfo);
    await reserveRevenueCatPublication(USER_ID, 'session-token-uncached');
    await activateRevenueCatPublication(USER_ID, 'session-token-uncached');
    await configureRevenueCat(USER_ID);

    await expect(getUncachedCustomerInfo()).resolves.toBe(customerInfo);
    expect(mocks.purchases.invalidateCustomerInfoCache).toHaveBeenCalledOnce();
    expect(mocks.purchases.getCustomerInfo).toHaveBeenCalledOnce();
    expect(mocks.purchases.invalidateCustomerInfoCache.mock.invocationCallOrder[0]).toBeLessThan(
      mocks.purchases.getCustomerInfo.mock.invocationCallOrder[0]!,
    );
  });

  it('reports listener persistence failures but ignores a typed closed boundary', async () => {
    const customerInfo = { requestDate: '2026-07-14T00:00:01.000Z' } as never;
    const persistenceError = new Error('encrypted write failed');
    const onListenerError = vi.fn();
    mocks.purchases.isConfigured.mockResolvedValue(false);
    await reserveRevenueCatPublication(USER_ID, 'session-token-listener-error');
    await activateRevenueCatPublication(USER_ID, 'session-token-listener-error');
    await configureRevenueCat(USER_ID);
    await subscribeToCustomerInfoUpdates(
      vi.fn(async () => {
        throw persistenceError;
      }),
      onListenerError,
    );
    const wrapped = mocks.purchases.addCustomerInfoUpdateListener.mock.calls[0]?.[0];
    expect(wrapped).toEqual(expect.any(Function));

    wrapped(customerInfo);
    await vi.waitFor(() =>
      expect(onListenerError).toHaveBeenCalledWith(persistenceError, customerInfo),
    );

    onListenerError.mockClear();
    await closeRevenueCatPublication('app_backgrounded');
    wrapped(customerInfo);
    await Promise.resolve();
    await Promise.resolve();
    expect(onListenerError).not.toHaveBeenCalled();
  });

  it('removes the native listener when controller registration loses authority', async () => {
    mocks.purchases.isConfigured.mockResolvedValue(false);
    await reserveRevenueCatPublication(USER_ID, 'session-token-controller-listener');
    await activateRevenueCatPublication(USER_ID, 'session-token-controller-listener');
    await configureRevenueCat(USER_ID);

    let close!: Promise<void>;
    mocks.purchases.addCustomerInfoUpdateListener.mockImplementationOnce(() => {
      close = closeRevenueCatPublication('app_backgrounded');
    });

    await expect(subscribeToCustomerInfoUpdates(vi.fn())).rejects.toMatchObject({
      code: 'ACCOUNT_PUBLICATION_RESULT_STALE',
    });
    await expect(close).resolves.toBeUndefined();

    const wrapped = mocks.purchases.addCustomerInfoUpdateListener.mock.calls[0]?.[0];
    expect(wrapped).toEqual(expect.any(Function));
    expect(mocks.purchases.removeCustomerInfoUpdateListener).toHaveBeenCalledOnce();
    expect(mocks.purchases.removeCustomerInfoUpdateListener).toHaveBeenCalledWith(wrapped);
  });
});
