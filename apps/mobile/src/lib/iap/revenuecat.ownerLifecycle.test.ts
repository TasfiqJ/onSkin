import { afterEach, describe, expect, it, vi } from 'vitest';

import {
  AccountGenerationLeaseError,
  beginAccountGenerationBoundary,
  endAccountGenerationBoundary,
  runAccountGenerationOperation,
  waitForAccountGenerationOperationsToSettle,
} from '@/lib/auth/accountGeneration';

function deferred<T>() {
  let resolve!: (value: T | PromiseLike<T>) => void;
  const promise = new Promise<T>((done) => {
    resolve = done;
  });
  return { promise, resolve };
}

const mocks = vi.hoisted(() => {
  let anonymous = true;
  let configured = false;
  let userId = '$RCAnonymousID:initial';
  return {
    addCustomerInfoUpdateListener: vi.fn(),
    configure: vi.fn((configuration: { appUserID: string }) => {
      configured = true;
      anonymous = false;
      userId = configuration.appUserID;
    }),
    getAppUserID: vi.fn(async () => userId),
    getCustomerInfo: vi.fn(),
    getEligibleWinBackOffersForPackage: vi.fn(async () => undefined),
    getOfferings: vi.fn(),
    isAnonymous: vi.fn(async () => anonymous),
    isConfigured: vi.fn(async () => configured),
    logIn: vi.fn(async (nextUserId: string) => {
      anonymous = false;
      userId = nextUserId;
    }),
    logOut: vi.fn(async () => {
      anonymous = true;
      userId = '$RCAnonymousID:reset';
    }),
    purchasePackage: vi.fn(),
    purchasePackageWithWinBackOffer: vi.fn(),
    removeCustomerInfoUpdateListener: vi.fn(() => true),
    restorePurchases: vi.fn(),
    setLogLevel: vi.fn(async () => undefined),
    setNativeIdentity(nextUserId: string, nextAnonymous: boolean, nextConfigured = true) {
      userId = nextUserId;
      anonymous = nextAnonymous;
      configured = nextConfigured;
    },
    showManageSubscriptions: vi.fn(async () => undefined),
    vendorBlocked: false,
  };
});

vi.mock('react-native', () => ({ Platform: { OS: 'ios' } }));

vi.mock('@/lib/env', () => ({
  env: {
    appEnvironment: 'staging',
    revenueCatAndroidKey: '',
    revenueCatAnnualProductId: 'annual-product',
    revenueCatEntitlementId: 'pro',
    revenueCatIosKey: 'appl_test_key',
    revenueCatMonthlyProductId: 'monthly-product',
    revenueCatReverseTrialProductId: 'reverse-trial-product',
    revenueCatTestStoreKey: '',
  },
}));

vi.mock('@/lib/auth/accountDeletionVendorFreezeRuntime', () => ({
  accountDeletionVendorWritesBlocked: () => mocks.vendorBlocked,
}));

vi.mock('react-native-purchases', () => ({
  default: {
    LOG_LEVEL: { DEBUG: 'DEBUG', WARN: 'WARN' },
    PURCHASES_ERROR_CODE: { PURCHASE_CANCELLED_ERROR: 'PURCHASE_CANCELLED' },
    addCustomerInfoUpdateListener: mocks.addCustomerInfoUpdateListener,
    configure: mocks.configure,
    getAppUserID: mocks.getAppUserID,
    getCustomerInfo: mocks.getCustomerInfo,
    getEligibleWinBackOffersForPackage: mocks.getEligibleWinBackOffersForPackage,
    getOfferings: mocks.getOfferings,
    isAnonymous: mocks.isAnonymous,
    isConfigured: mocks.isConfigured,
    logIn: mocks.logIn,
    logOut: mocks.logOut,
    purchasePackage: mocks.purchasePackage,
    purchasePackageWithWinBackOffer: mocks.purchasePackageWithWinBackOffer,
    removeCustomerInfoUpdateListener: mocks.removeCustomerInfoUpdateListener,
    restorePurchases: mocks.restorePurchases,
    setLogLevel: mocks.setLogLevel,
    showManageSubscriptions: mocks.showManageSubscriptions,
  },
}));

let boundaryDepth = 0;

afterEach(() => {
  while (boundaryDepth > 0) {
    endAccountGenerationBoundary();
    boundaryDepth -= 1;
  }
  vi.useRealTimers();
  vi.unstubAllGlobals();
});

describe('RevenueCat facade owner lifecycle', () => {
  it('keeps reads in deletion drain while letting account isolation detach them', async () => {
    vi.stubGlobal('__DEV__', false);
    const {
      configureRevenueCat,
      getCustomerInfo,
      getSubscriptionOffering,
      resetRevenueCatIdentity,
      waitForRevenueCatOperationsToSettle,
    } = await import('./revenuecat');
    const ownerId = '11111111-1111-4111-8111-111111111111';

    await runAccountGenerationOperation((lease) =>
      configureRevenueCat({ appUserId: ownerId, lease }),
    );

    const offeringRead = deferred<{ current: null }>();
    mocks.getOfferings.mockReturnValueOnce(offeringRead.promise);
    const offering = runAccountGenerationOperation((lease) =>
      getSubscriptionOffering({ appUserId: ownerId, lease }),
    );
    await vi.waitFor(() => expect(mocks.getOfferings).toHaveBeenCalledOnce());

    mocks.vendorBlocked = true;
    let deletionDrainSettled = false;
    const deletionDrain = waitForRevenueCatOperationsToSettle().then(() => {
      deletionDrainSettled = true;
    });
    await Promise.resolve();
    expect(deletionDrainSettled).toBe(false);

    offeringRead.resolve({ current: null });
    await expect(offering).resolves.toMatchObject({ status: 'unavailable' });
    await deletionDrain;
    mocks.vendorBlocked = false;

    const customerRead = deferred<never>();
    mocks.getCustomerInfo.mockReturnValueOnce(customerRead.promise);
    const customer = runAccountGenerationOperation((lease) =>
      getCustomerInfo({ appUserId: ownerId, lease }),
    );
    await vi.waitFor(() => expect(mocks.getCustomerInfo).toHaveBeenCalledOnce());

    beginAccountGenerationBoundary();
    boundaryDepth += 1;
    await expect(customer).rejects.toBeInstanceOf(AccountGenerationLeaseError);
    await expect(waitForAccountGenerationOperationsToSettle()).resolves.toBeUndefined();
    await expect(resetRevenueCatIdentity()).resolves.toBeUndefined();
    expect(mocks.logOut).toHaveBeenCalledOnce();

    endAccountGenerationBoundary();
    boundaryDepth -= 1;
    customerRead.resolve({} as never);
    await expect(waitForRevenueCatOperationsToSettle()).resolves.toBeUndefined();
  });

  it('fails closed within a bound while a cold-start native-owner logout is pending', async () => {
    vi.stubGlobal('__DEV__', false);
    vi.useFakeTimers();
    const {
      prepareRevenueCatIdentityForSessionPublication,
      waitForRevenueCatOperationsToSettle,
    } = await import('./revenuecat');
    const nativeLogout = deferred<void>();
    mocks.setNativeIdentity('11111111-1111-4111-8111-111111111111', false);
    mocks.logOut.mockClear();
    mocks.logOut.mockImplementationOnce(async () => {
      await nativeLogout.promise;
      mocks.setNativeIdentity('$RCAnonymousID:publication-reset', true);
    });

    const publicationProof = prepareRevenueCatIdentityForSessionPublication(
      '22222222-2222-4222-8222-222222222222',
    );
    await vi.advanceTimersByTimeAsync(0);
    expect(mocks.logOut).toHaveBeenCalledOnce();

    const timedOut = expect(publicationProof).rejects.toThrow(
      'REVENUECAT_SESSION_PUBLICATION_TIMEOUT',
    );
    await vi.advanceTimersByTimeAsync(2_000);
    await timedOut;

    const retryProof = prepareRevenueCatIdentityForSessionPublication(
      '22222222-2222-4222-8222-222222222222',
    );
    await vi.advanceTimersByTimeAsync(0);
    expect(mocks.logOut).toHaveBeenCalledOnce();
    nativeLogout.resolve();
    await vi.advanceTimersByTimeAsync(0);
    await expect(retryProof).resolves.toBeUndefined();
    await waitForRevenueCatOperationsToSettle();
  });
});
