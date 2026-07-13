import type { PlanId } from '@onskin/types';
import { Platform } from 'react-native';
import type {
  CustomerInfo,
  CustomerInfoUpdateListener,
  PurchasesOfferings,
  PurchasesPackage,
  PurchasesWinBackOffer,
  Store as RevenueCatStore,
} from 'react-native-purchases';

import type { StoredEntitlement } from '@/features/subscription/entitlement';
import { PLANS } from '@/features/subscription/plans';
import { accountDeletionVendorWritesBlocked } from '@/lib/auth/accountDeletionVendorFreezeRuntime';
import { BRAND } from '@/lib/brand';
import { env } from '@/lib/env';
import {
  createRevenueCatIdentityCoordinator,
  type RevenueCatIdentityAdapter,
} from '@/lib/iap/revenuecatIdentity';
import { createRevenueCatOperationBarrier } from '@/lib/iap/revenuecatOperationBarrier';
import { safeExternalHttpsUrl } from '@/lib/navigation/externalUrl';

export type SubscriptionPackageView = {
  plan: PlanId;
  packageId: string;
  offeringId: string;
  productId: string;
  title: string;
  priceLabel: string;
  pricePerMonthLabel: string | null;
  periodLabel: 'year' | 'month';
  subscriptionPeriod: string | null;
  trialDays: number | null;
  introLabel: string | null;
  canPurchase: boolean;
};

export type WinBackOfferView = {
  offerId: string;
  productId: string;
  packageId: string;
  offeringId: string;
  priceLabel: string;
  originalPriceLabel: string;
  percentOff: number | null;
  periodLabel: string;
  canPurchase: boolean;
};

export type SubscriptionOfferingView =
  | {
      status: 'available';
      offeringId: string;
      annual: SubscriptionPackageView;
      monthly: SubscriptionPackageView;
      winBack: WinBackOfferView | null;
      reason?: never;
    }
  | {
      status: 'development_fallback';
      offeringId: 'development-fallback';
      annual: SubscriptionPackageView;
      monthly: SubscriptionPackageView;
      winBack: null;
      reason: string;
    }
  | {
      status: 'unavailable';
      offeringId: null;
      annual: null;
      monthly: null;
      winBack: null;
      reason: string;
    };

type PurchaseResult = {
  purchased: boolean;
  cancelled?: boolean;
  offerUnavailable?: boolean;
  productId?: string;
  packageId?: string;
  offeringId?: string;
  priceLabel?: string;
  customerInfo?: CustomerInfo;
};

let configurePromise: Promise<void> | null = null;
let cachedOfferings: PurchasesOfferings | null = null;
const identityCoordinator = createRevenueCatIdentityCoordinator();
const deletionOperationBarrier = createRevenueCatOperationBarrier(
  accountDeletionVendorWritesBlocked,
);

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const STORE_CHECKOUT_UNAVAILABLE_REASON =
  'Store checkout is unavailable right now. Please try again later.';
const PREVIEW_CHECKOUT_DISABLED_REASON =
  'Store checkout is unavailable in this preview. You can keep exploring.';

function revenueCatKey(): string {
  if (env.appEnvironment === 'development' && env.revenueCatTestStoreKey.length > 0) {
    return env.revenueCatTestStoreKey;
  }
  if (Platform.OS === 'ios') return env.revenueCatIosKey;
  if (Platform.OS === 'android') return env.revenueCatAndroidKey;
  return '';
}

function assertRevenueCatKeyAllowed(key: string): void {
  const looksLikeTestStore = /^test[_-]/i.test(key) || /test[_-]?store/i.test(key);
  if (env.appEnvironment === 'production' && looksLikeTestStore) {
    throw new Error('RevenueCat Test Store keys are not allowed in production builds.');
  }
}

function assertAppUserId(appUserId: string): void {
  if (!UUID_RE.test(appUserId) || appUserId.includes('@')) {
    throw new Error(
      'RevenueCat appUserID must be the authenticated Supabase UUID, never an email or device id.',
    );
  }
}

function isNativeStorePlatform(): boolean {
  return Platform.OS === 'ios' || Platform.OS === 'android';
}

function canUseRevenueCat(): boolean {
  return revenueCatKey().length > 0 && isNativeStorePlatform();
}

function productionRequiresRevenueCat(action: string): void {
  if (env.appEnvironment === 'production') {
    throw new Error(`RevenueCat is not configured for ${action} in a production build.`);
  }
}

async function loadPurchases() {
  const mod = await import('react-native-purchases');
  return mod.default;
}

function entitlementInfo(customerInfo: CustomerInfo) {
  return (
    customerInfo.entitlements.active[env.revenueCatEntitlementId] ??
    customerInfo.entitlements.all[env.revenueCatEntitlementId] ??
    null
  );
}

function hasActiveEntitlement(customerInfo: CustomerInfo): boolean {
  return Boolean(customerInfo.entitlements.active[env.revenueCatEntitlementId]);
}

function mapStore(store: RevenueCatStore | string | null | undefined): StoredEntitlement['store'] {
  if (!store) return null;
  switch (store) {
    case 'APP_STORE':
    case 'MAC_APP_STORE':
      return 'app_store';
    case 'PLAY_STORE':
      return 'play_store';
    case 'TEST_STORE':
      return 'test_store';
    case 'PROMOTIONAL':
      return 'app_granted';
    case 'STRIPE':
    case 'PADDLE':
    case 'RC_BILLING':
    case 'EXTERNAL':
      return 'web';
    default:
      return null;
  }
}

function mapPeriod(periodType: string | null | undefined): StoredEntitlement['periodType'] {
  const normalized = periodType?.toLowerCase();
  if (
    normalized === 'trial' ||
    normalized === 'intro' ||
    normalized === 'normal' ||
    normalized === 'prepaid'
  ) {
    return normalized;
  }
  return null;
}

function mapEnvironment(
  store: RevenueCatStore | string | null | undefined,
  isSandbox: boolean,
): StoredEntitlement['environment'] {
  if (store === 'TEST_STORE') return 'test_store';
  if (isSandbox) return 'sandbox';
  if (env.appEnvironment === 'development') return 'development';
  if (env.appEnvironment === 'production') return 'production';
  return 'unknown';
}

function periodDays(
  unit: string | undefined,
  units: number | undefined,
  cycles = 1,
): number | null {
  if (!unit || !units) return null;
  const total = units * cycles;
  if (unit === 'DAY') return total;
  if (unit === 'WEEK') return total * 7;
  if (unit === 'MONTH') return total * 30;
  if (unit === 'YEAR') return total * 365;
  return null;
}

function trialDaysForPackage(pack: PurchasesPackage): number | null {
  const intro = pack.product.introPrice;
  if (intro && intro.price === 0) {
    return periodDays(intro.periodUnit, intro.periodNumberOfUnits, intro.cycles) ?? null;
  }

  const freePhase = pack.product.defaultOption?.freePhase;
  if (freePhase) {
    return periodDays(
      freePhase.billingPeriod.unit,
      freePhase.billingPeriod.value,
      freePhase.billingCycleCount ?? 1,
    );
  }

  return null;
}

function periodLabelFor(plan: PlanId, pack: PurchasesPackage): 'year' | 'month' {
  const period = pack.product.subscriptionPeriod;
  if (period === 'P1M') return 'month';
  if (period === 'P1Y') return 'year';
  return plan === 'monthly' ? 'month' : 'year';
}

function packageToView(
  plan: PlanId,
  pack: PurchasesPackage,
  canPurchase: boolean,
): SubscriptionPackageView {
  const trialDays = trialDaysForPackage(pack);
  return {
    plan,
    packageId: pack.identifier,
    offeringId: pack.presentedOfferingContext?.offeringIdentifier ?? pack.offeringIdentifier,
    productId: pack.product.identifier,
    title: pack.product.title,
    priceLabel: pack.product.priceString,
    pricePerMonthLabel: pack.product.pricePerMonthString,
    periodLabel: periodLabelFor(plan, pack),
    subscriptionPeriod: pack.product.subscriptionPeriod,
    trialDays,
    introLabel: trialDays ? `${trialDays} days free` : null,
    canPurchase,
  };
}

function developmentFallbackPackage(plan: PlanId): SubscriptionPackageView {
  const p = PLANS[plan];
  return {
    plan,
    packageId: `development-${plan}`,
    offeringId: 'development-fallback',
    productId: p.productId,
    title: `${BRAND.proName} ${plan}`,
    priceLabel: p.priceLabel,
    pricePerMonthLabel: plan === 'annual' ? '$4.16' : null,
    periodLabel: p.unit,
    subscriptionPeriod: plan === 'annual' ? 'P1Y' : 'P1M',
    trialDays: p.trialDays || null,
    introLabel: p.trialDays ? `${p.trialDays} days free` : null,
    canPurchase: false,
  };
}

function unavailableOffering(reason: string): SubscriptionOfferingView {
  return {
    status: 'unavailable',
    offeringId: null,
    annual: null,
    monthly: null,
    winBack: null,
    reason,
  };
}

function findPackage(offerings: PurchasesOfferings, plan: PlanId): PurchasesPackage | null {
  const current = offerings.current;
  if (!current) return null;

  const standardPackage = plan === 'annual' ? current.annual : current.monthly;
  if (standardPackage) return standardPackage;

  const productId = PLANS[plan].productId;
  return current.availablePackages.find((pack) => pack.product.identifier === productId) ?? null;
}

async function requireConfigured(action: string) {
  if (accountDeletionVendorWritesBlocked()) return null;
  if (!canUseRevenueCat()) {
    productionRequiresRevenueCat(action);
    return null;
  }
  if (configurePromise) await configurePromise;
  if (accountDeletionVendorWritesBlocked()) return null;
  if (!identityCoordinator.currentUserId()) {
    productionRequiresRevenueCat(action);
    return null;
  }
  return loadPurchases();
}

async function loadRevenueCatIdentityAdapter(): Promise<RevenueCatIdentityAdapter> {
  const Purchases = await loadPurchases();
  const apiKey = revenueCatKey();
  assertRevenueCatKeyAllowed(apiKey);
  await Purchases.setLogLevel(__DEV__ ? Purchases.LOG_LEVEL.DEBUG : Purchases.LOG_LEVEL.WARN);
  return {
    configure: (appUserId) =>
      deletionOperationBarrier.run(() =>
        Purchases.configure({
          apiKey,
          appUserID: appUserId,
          automaticDeviceIdentifierCollectionEnabled: false,
        }),
      ) ?? Promise.resolve(),
    // This call intentionally bypasses the deletion write barrier: it is the
    // supported native completion fence for configure(), whose JS API returns
    // void, and performs no identity write of its own.
    fenceIdentity: () => Purchases.getCustomerInfo(),
    isAnonymous: () => Purchases.isAnonymous(),
    isConfigured: () => Purchases.isConfigured(),
    logIn: (appUserId) =>
      deletionOperationBarrier.run(() => Purchases.logIn(appUserId)) ?? Promise.resolve(),
    logOut: () => Purchases.logOut(),
  };
}

async function fetchOfferings(): Promise<PurchasesOfferings | null> {
  const Purchases = await requireConfigured('offerings');
  if (!Purchases) return null;
  const operation = deletionOperationBarrier.run(() => Purchases.getOfferings());
  if (!operation) return null;
  cachedOfferings = await operation;
  return cachedOfferings;
}

async function winBackViewForPackage(pack: PurchasesPackage): Promise<WinBackOfferView | null> {
  if (Platform.OS !== 'ios') return null;
  const Purchases = await requireConfigured('win-back offers');
  if (!Purchases) return null;

  const operation = deletionOperationBarrier.run(() =>
    Purchases.getEligibleWinBackOffersForPackage(pack),
  );
  const offers = operation ? await operation.catch(() => undefined) : undefined;
  const offer: PurchasesWinBackOffer | undefined = offers?.[0];
  if (!offer) return null;

  const percentOff =
    pack.product.price > 0
      ? Math.round(Math.max(0, 1 - offer.price / pack.product.price) * 100)
      : null;

  return {
    offerId: offer.identifier,
    productId: pack.product.identifier,
    packageId: pack.identifier,
    offeringId: pack.presentedOfferingContext?.offeringIdentifier ?? pack.offeringIdentifier,
    priceLabel: offer.priceString,
    originalPriceLabel: pack.product.priceString,
    percentOff,
    periodLabel:
      offer.cycles > 1
        ? `${offer.cycles} ${offer.periodUnit.toLowerCase()}s`
        : offer.periodUnit.toLowerCase(),
    canPurchase: true,
  };
}

/** Bind RevenueCat to the stable Supabase user id. Never configure with email or a device id. */
export async function configureRevenueCat(appUserId: string): Promise<void> {
  if (!appUserId) return;
  if (accountDeletionVendorWritesBlocked()) return;
  assertAppUserId(appUserId);
  if (!canUseRevenueCat()) {
    productionRequiresRevenueCat('configuration');
    return;
  }
  if (identityCoordinator.currentUserId() === appUserId) return;
  // Offering/package objects belong to the configured store identity.
  cachedOfferings = null;
  const operation = identityCoordinator.configureFor(
    appUserId,
    loadRevenueCatIdentityAdapter,
    () => !accountDeletionVendorWritesBlocked(),
  );

  configurePromise = operation;
  await operation;
}

async function resetRevenueCatSdkIdentity(): Promise<void> {
  try {
    if (!canUseRevenueCat()) return;
    const operation = identityCoordinator.reset(loadRevenueCatIdentityAdapter);
    configurePromise = operation;
    await operation;
  } finally {
    configurePromise = null;
    cachedOfferings = null;
  }
}

export async function freezeRevenueCatIdentityForAccountDeletion(): Promise<void> {
  await resetRevenueCatSdkIdentity();
}

export async function resetRevenueCatIdentity(): Promise<void> {
  await resetRevenueCatSdkIdentity();
}

/**
 * Called only after the durable deletion gate is armed. No new asynchronous
 * subscriber operation can register. The deletion-specific reset then performs
 * an ordered native customer-info read to fence configure(), whose JS API is
 * synchronous even though its native initialization can continue.
 */
export async function waitForRevenueCatOperationsToSettle(): Promise<void> {
  await deletionOperationBarrier.waitForSettled();
}

export async function getSubscriptionOffering(): Promise<SubscriptionOfferingView> {
  if (!canUseRevenueCat()) {
    if (env.appEnvironment === 'production') {
      return unavailableOffering(STORE_CHECKOUT_UNAVAILABLE_REASON);
    }
    return {
      status: 'development_fallback',
      offeringId: 'development-fallback',
      annual: developmentFallbackPackage('annual'),
      monthly: developmentFallbackPackage('monthly'),
      winBack: null,
      reason: PREVIEW_CHECKOUT_DISABLED_REASON,
    };
  }

  let offerings: PurchasesOfferings | null;
  try {
    offerings = await fetchOfferings();
  } catch {
    return unavailableOffering(STORE_CHECKOUT_UNAVAILABLE_REASON);
  }

  const current = offerings?.current ?? null;
  const annual = offerings ? findPackage(offerings, 'annual') : null;
  const monthly = offerings ? findPackage(offerings, 'monthly') : null;

  if (!current || !annual || !monthly) {
    return unavailableOffering(STORE_CHECKOUT_UNAVAILABLE_REASON);
  }

  return {
    status: 'available',
    offeringId: current.identifier,
    annual: packageToView('annual', annual, true),
    monthly: packageToView('monthly', monthly, true),
    winBack: await winBackViewForPackage(annual),
  };
}

export function customerInfoToStoredEntitlement(
  customerInfo: CustomerInfo,
): StoredEntitlement | null {
  const info = entitlementInfo(customerInfo);
  if (!info) return null;
  const subscriptionInfo = customerInfo.subscriptionsByProductIdentifier[info.productIdentifier];

  return {
    tier: info.identifier === 'pro_plus' ? 'pro_plus' : 'pro',
    isActive: info.isActive,
    periodType: mapPeriod(info.periodType),
    store: mapStore(info.store),
    productId: info.productIdentifier ?? null,
    expiresAt: info.expirationDate,
    willRenew: info.willRenew,
    grantedAt: info.originalPurchaseDate,
    source: 'revenuecat',
    environment: mapEnvironment(info.store, info.isSandbox),
    managementUrl: safeExternalHttpsUrl(
      customerInfo.managementURL ?? subscriptionInfo?.managementURL,
    ),
    verifiedAt: customerInfo.requestDate,
    offeringId: null,
    packageId: null,
    storeUserId: customerInfo.originalAppUserId,
    priceLabel: null,
  };
}

/**
 * Opens the native StoreKit/Play purchase sheet. Production never returns a stub;
 * callers must grant access only from returned CustomerInfo.
 */
export async function purchasePackage(plan: PlanId): Promise<PurchaseResult> {
  const Purchases = await requireConfigured('purchase');
  if (!Purchases) return { purchased: false };

  const offerings = cachedOfferings ?? (await fetchOfferings());
  const selectedPackage = offerings ? findPackage(offerings, plan) : null;
  if (!selectedPackage) {
    throw new Error(
      `RevenueCat offering is missing the ${plan} package (${PLANS[plan].productId}).`,
    );
  }
  if (accountDeletionVendorWritesBlocked()) return { purchased: false };

  try {
    const operation = deletionOperationBarrier.run(() =>
      Purchases.purchasePackage(selectedPackage),
    );
    if (!operation) return { purchased: false };
    const result = await operation;
    return {
      purchased: hasActiveEntitlement(result.customerInfo),
      productId: result.productIdentifier,
      packageId: selectedPackage.identifier,
      offeringId:
        selectedPackage.presentedOfferingContext?.offeringIdentifier ??
        selectedPackage.offeringIdentifier,
      priceLabel: selectedPackage.product.priceString,
      customerInfo: result.customerInfo,
    };
  } catch (error) {
    const purchasesError = error as { code?: string; userCancelled?: boolean };
    if (
      purchasesError.userCancelled ||
      purchasesError.code === Purchases.PURCHASES_ERROR_CODE.PURCHASE_CANCELLED_ERROR
    ) {
      return { purchased: false, cancelled: true };
    }
    throw error;
  }
}

export async function purchaseWinBackPackage(): Promise<PurchaseResult> {
  const Purchases = await requireConfigured('win-back purchase');
  if (!Purchases) return { purchased: false };

  const offerings = cachedOfferings ?? (await fetchOfferings());
  const annualPackage = offerings ? findPackage(offerings, 'annual') : null;
  if (!annualPackage || Platform.OS !== 'ios') return { purchased: false, offerUnavailable: true };

  const offerOperation = deletionOperationBarrier.run(() =>
    Purchases.getEligibleWinBackOffersForPackage(annualPackage),
  );
  const offers = offerOperation ? await offerOperation.catch(() => undefined) : undefined;
  const winBackOffer = offers?.[0];
  if (!winBackOffer) return { purchased: false, offerUnavailable: true };
  if (accountDeletionVendorWritesBlocked()) return { purchased: false };

  try {
    const operation = deletionOperationBarrier.run(() =>
      Purchases.purchasePackageWithWinBackOffer(annualPackage, winBackOffer),
    );
    if (!operation) return { purchased: false };
    const result = await operation;
    return {
      purchased: hasActiveEntitlement(result.customerInfo),
      productId: result.productIdentifier,
      packageId: annualPackage.identifier,
      offeringId:
        annualPackage.presentedOfferingContext?.offeringIdentifier ??
        annualPackage.offeringIdentifier,
      priceLabel: winBackOffer.priceString,
      customerInfo: result.customerInfo,
    };
  } catch (error) {
    const purchasesError = error as { code?: string; userCancelled?: boolean };
    if (
      purchasesError.userCancelled ||
      purchasesError.code === Purchases.PURCHASES_ERROR_CODE.PURCHASE_CANCELLED_ERROR
    ) {
      return { purchased: false, cancelled: true };
    }
    throw error;
  }
}

/** Re-syncs entitlements for reinstalls/device switches. */
export async function restorePurchases(): Promise<{
  restored: boolean;
  customerInfo?: CustomerInfo;
}> {
  const Purchases = await requireConfigured('restore');
  if (!Purchases) return { restored: false };
  if (accountDeletionVendorWritesBlocked()) return { restored: false };

  const operation = deletionOperationBarrier.run(() => Purchases.restorePurchases());
  if (!operation) return { restored: false };
  const customerInfo = await operation;
  return { restored: hasActiveEntitlement(customerInfo), customerInfo };
}

export async function getCustomerInfo(): Promise<CustomerInfo | null> {
  const Purchases = await requireConfigured('customer info');
  if (!Purchases) return null;
  const operation = deletionOperationBarrier.run(() => Purchases.getCustomerInfo());
  return operation ? await operation : null;
}

export async function subscribeToCustomerInfoUpdates(
  listener: CustomerInfoUpdateListener,
): Promise<() => void> {
  if (accountDeletionVendorWritesBlocked() || !canUseRevenueCat()) return () => {};
  const Purchases = await loadPurchases();
  if (accountDeletionVendorWritesBlocked()) return () => {};
  Purchases.addCustomerInfoUpdateListener(listener);
  return () => {
    Purchases.removeCustomerInfoUpdateListener(listener);
  };
}

export async function showNativeManageSubscriptions(): Promise<boolean> {
  if (Platform.OS !== 'ios' || !canUseRevenueCat()) return false;
  try {
    const Purchases = await loadPurchases();
    await Purchases.showManageSubscriptions();
    return true;
  } catch {
    return false;
  }
}

/** Deep-links to the OS subscription settings for fallback manage flows. */
export const MANAGE_SUBSCRIPTION_URL_IOS = 'https://apps.apple.com/account/subscriptions';
export const MANAGE_SUBSCRIPTION_URL_ANDROID =
  'https://play.google.com/store/account/subscriptions';

export const STUB_PRODUCTS = {
  annual: PLANS.annual.productId,
  monthly: PLANS.monthly.productId,
} as const;
