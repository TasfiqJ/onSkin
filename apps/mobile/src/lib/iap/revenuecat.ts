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
import type { AccountGenerationLease } from '@/lib/auth/accountGeneration';
import { accountDeletionVendorWritesBlocked } from '@/lib/auth/accountDeletionVendorFreezeRuntime';
import { BRAND } from '@/lib/brand';
import { env } from '@/lib/env';
import {
  RevenueCatIdentityMismatchError,
  RevenueCatOperationBusyError,
  RevenueCatOperationFencedError,
  RevenueCatOwnerCoordinator,
  type RevenueCatIdentityAdapter,
  type RevenueCatOwnerContext,
  type RevenueCatOwnerStamp,
} from '@/lib/iap/revenuecatOwnerCoordinator';
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

type NativePurchaseResult = {
  customerInfo: CustomerInfo;
  productIdentifier: string;
};

type RevenueCatAdapter = RevenueCatIdentityAdapter & {
  addCustomerInfoUpdateListener: (listener: CustomerInfoUpdateListener) => void;
  getCustomerInfo: () => Promise<CustomerInfo>;
  getEligibleWinBackOffersForPackage: (
    pack: PurchasesPackage,
  ) => Promise<PurchasesWinBackOffer[] | undefined>;
  getOfferings: () => Promise<PurchasesOfferings>;
  purchasePackage: (pack: PurchasesPackage) => Promise<NativePurchaseResult>;
  purchasePackageWithWinBackOffer: (
    pack: PurchasesPackage,
    offer: PurchasesWinBackOffer,
  ) => Promise<NativePurchaseResult>;
  purchaseCancelledErrorCode: string;
  removeCustomerInfoUpdateListener: (listener: CustomerInfoUpdateListener) => boolean;
  restorePurchases: () => Promise<CustomerInfo>;
  showManageSubscriptions: () => Promise<void>;
};

type OwnerTaggedOfferings = {
  offerings: PurchasesOfferings;
  stamp: RevenueCatOwnerStamp;
};

let cachedOfferings: OwnerTaggedOfferings | null = null;
let adapterPromise: Promise<RevenueCatAdapter> | null = null;
const ownerCoordinator = new RevenueCatOwnerCoordinator();
const deletionOperationBarrier = createRevenueCatOperationBarrier(
  accountDeletionVendorWritesBlocked,
);

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const STORE_CHECKOUT_UNAVAILABLE_REASON =
  'Store checkout is unavailable right now. Please try again later.';
const PREVIEW_CHECKOUT_DISABLED_REASON =
  'Store checkout is unavailable in this preview. You can keep exploring.';
const REVENUECAT_SESSION_PUBLICATION_TIMEOUT_MS = 2_000;

export type RevenueCatOperationContext = Readonly<{
  appUserId: string;
  lease: AccountGenerationLease;
}>;

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

function runDeletionTracked<T>(operation: () => T | Promise<T>): Promise<T> {
  const tracked = deletionOperationBarrier.run(operation);
  return tracked ?? Promise.reject(new RevenueCatOperationFencedError());
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

function ownerContext(context: RevenueCatOperationContext): RevenueCatOwnerContext {
  assertAppUserId(context.appUserId);
  context.lease.assertCurrent();
  return context;
}

async function requireConfigured(context: RevenueCatOperationContext, action: string) {
  if (accountDeletionVendorWritesBlocked()) return null;
  if (!canUseRevenueCat()) {
    productionRequiresRevenueCat(action);
    return null;
  }
  await configureRevenueCat(context);
  context.lease.assertCurrent();
  if (accountDeletionVendorWritesBlocked()) return null;
  ownerCoordinator.stampFor(ownerContext(context));
  return loadRevenueCatIdentityAdapter();
}

async function loadRevenueCatIdentityAdapter(): Promise<RevenueCatAdapter> {
  if (adapterPromise) return adapterPromise;
  const loading = (async () => {
    const Purchases = await loadPurchases();
    const apiKey = revenueCatKey();
    assertRevenueCatKeyAllowed(apiKey);
    await Purchases.setLogLevel(__DEV__ ? Purchases.LOG_LEVEL.DEBUG : Purchases.LOG_LEVEL.WARN);
    return {
      addCustomerInfoUpdateListener: (listener) =>
        Purchases.addCustomerInfoUpdateListener(listener),
      configure: (appUserId, markNativeConfigureDispatched) =>
        runDeletionTracked(() => {
          Purchases.configure({
            apiKey,
            appUserID: appUserId,
            automaticDeviceIdentifierCollectionEnabled: false,
          });
          // Mark only after the barrier admitted the callback and the native
          // bridge call returned without throwing. A pre-dispatch barrier
          // rejection must not leave an impossible configure quarantine.
          markNativeConfigureDispatched();
        }),
      // These direct same-module bridge reads are ordered behind configure(),
      // remain callable while cleanup writes are blocked, and do not require a
      // network customer-info refresh. A genuinely unconfigured SDK resolves
      // false, allowing pre-dispatch barrier rejection to recover safely.
      fenceIdentity: async () => {
        const configured = await Purchases.isConfigured();
        if (configured) await Purchases.getAppUserID();
        return { configured };
      },
      getAppUserID: () => Purchases.getAppUserID(),
      getCustomerInfo: () => runDeletionTracked(() => Purchases.getCustomerInfo()),
      getEligibleWinBackOffersForPackage: (pack) =>
        runDeletionTracked(() => Purchases.getEligibleWinBackOffersForPackage(pack)),
      getOfferings: () => runDeletionTracked(() => Purchases.getOfferings()),
      isAnonymous: () => Purchases.isAnonymous(),
      isConfigured: () => Purchases.isConfigured(),
      logIn: (appUserId) => runDeletionTracked(() => Purchases.logIn(appUserId)),
      // Logout and its identity probes are cleanup operations and intentionally
      // remain available after the durable deletion write gate is armed.
      logOut: () => Purchases.logOut(),
      purchasePackage: (pack) =>
        runDeletionTracked(() => Purchases.purchasePackage(pack)),
      purchasePackageWithWinBackOffer: (pack, offer) =>
        runDeletionTracked(() => Purchases.purchasePackageWithWinBackOffer(pack, offer)),
      purchaseCancelledErrorCode: Purchases.PURCHASES_ERROR_CODE.PURCHASE_CANCELLED_ERROR,
      removeCustomerInfoUpdateListener: (listener) =>
        Purchases.removeCustomerInfoUpdateListener(listener),
      restorePurchases: () => runDeletionTracked(() => Purchases.restorePurchases()),
      showManageSubscriptions: () =>
        runDeletionTracked(() => Purchases.showManageSubscriptions()),
    } satisfies RevenueCatAdapter;
  })();
  adapterPromise = loading;
  try {
    return await loading;
  } catch (error) {
    if (adapterPromise === loading) adapterPromise = null;
    throw error;
  }
}

function cachedOfferingsFor(context: RevenueCatOperationContext): PurchasesOfferings | null {
  if (
    !cachedOfferings ||
    cachedOfferings.stamp.appUserId !== context.appUserId ||
    cachedOfferings.stamp.generation !== context.lease.generation ||
    !ownerCoordinator.isStampCurrent(cachedOfferings.stamp)
  ) {
    return null;
  }
  return cachedOfferings.offerings;
}

async function fetchOfferings(
  context: RevenueCatOperationContext,
): Promise<PurchasesOfferings | null> {
  const adapter = await requireConfigured(context, 'offerings');
  if (!adapter) return null;
  const existing = cachedOfferingsFor(context);
  if (existing) return existing;
  const offerings = await ownerCoordinator.runRead(
    ownerContext(context),
    loadRevenueCatIdentityAdapter,
    (current) => current.getOfferings(),
  );
  context.lease.assertCurrent();
  const stamp = ownerCoordinator.stampFor(ownerContext(context));
  cachedOfferings = { offerings, stamp };
  return offerings;
}

async function winBackViewForPackage(
  context: RevenueCatOperationContext,
  pack: PurchasesPackage,
): Promise<WinBackOfferView | null> {
  if (Platform.OS !== 'ios') return null;
  const adapter = await requireConfigured(context, 'win-back offers');
  if (!adapter) return null;

  let offers: PurchasesWinBackOffer[] | undefined;
  try {
    offers = await ownerCoordinator.runRead(
      ownerContext(context),
      loadRevenueCatIdentityAdapter,
      (current) => current.getEligibleWinBackOffersForPackage(pack),
    );
  } catch {
    context.lease.assertCurrent();
  }
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
export async function configureRevenueCat(context: RevenueCatOperationContext): Promise<void> {
  const owned = ownerContext(context);
  if (accountDeletionVendorWritesBlocked()) return;
  if (!canUseRevenueCat()) {
    productionRequiresRevenueCat('configuration');
    return;
  }
  await ownerCoordinator.configureFor(owned, loadRevenueCatIdentityAdapter);
}

async function resetRevenueCatSdkIdentity(): Promise<void> {
  cachedOfferings = null;
  try {
    if (!canUseRevenueCat()) return;
    await ownerCoordinator.reset(loadRevenueCatIdentityAdapter);
  } finally {
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
 * Fail-closed gate used by AuthProvider before publishing a restored or
 * switched session. The native SDK must be anonymous or already bound to the
 * exact session owner; a mismatched authenticated owner is logged out first.
 */
export async function prepareRevenueCatIdentityForSessionPublication(
  appUserId: string | null,
): Promise<void> {
  if (appUserId) assertAppUserId(appUserId);
  cachedOfferings = null;
  if (!canUseRevenueCat()) return;

  const proof = ownerCoordinator.prepareForSessionPublication(
    appUserId,
    loadRevenueCatIdentityAdapter,
  );
  let timeout: ReturnType<typeof setTimeout> | undefined;
  const deadline = new Promise<void>((_resolve, reject) => {
    timeout = setTimeout(
      () => reject(new Error('REVENUECAT_SESSION_PUBLICATION_TIMEOUT')),
      REVENUECAT_SESSION_PUBLICATION_TIMEOUT_MS,
    );
  });

  try {
    await Promise.race([proof, deadline]);
  } finally {
    if (timeout) clearTimeout(timeout);
    cachedOfferings = null;
  }
}

/**
 * Called only after the durable deletion gate is armed. No new asynchronous
 * subscriber operation can register. Identity hazards remain tracked beyond a
 * detached account owner, including the ordered native identity-state fence
 * and exact app-user proof that follow configure(), whose JavaScript API
 * returns void.
 */
export async function waitForRevenueCatOperationsToSettle(): Promise<void> {
  while (true) {
    await deletionOperationBarrier.waitForSettled();
    await ownerCoordinator.waitForNativeHazardsToSettle();
    if (
      deletionOperationBarrier.activeCount() === 0 &&
      ownerCoordinator.activeNativeCount() === 0
    ) {
      return;
    }
  }
}

export async function getSubscriptionOffering(
  context: RevenueCatOperationContext,
): Promise<SubscriptionOfferingView> {
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
    offerings = await fetchOfferings(context);
  } catch {
    context.lease.assertCurrent();
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
    winBack: await winBackViewForPackage(context, annual),
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
export async function purchasePackage(
  context: RevenueCatOperationContext,
  plan: PlanId,
): Promise<PurchaseResult> {
  const adapter = await requireConfigured(context, 'purchase');
  if (!adapter) return { purchased: false };

  const offerings = cachedOfferingsFor(context) ?? (await fetchOfferings(context));
  const selectedPackage = offerings ? findPackage(offerings, plan) : null;
  if (!selectedPackage) {
    throw new Error(
      `RevenueCat offering is missing the ${plan} package (${PLANS[plan].productId}).`,
    );
  }
  if (accountDeletionVendorWritesBlocked()) return { purchased: false };

  try {
    const result = await ownerCoordinator.runHazard(
      ownerContext(context),
      'purchase',
      loadRevenueCatIdentityAdapter,
      (current) => current.purchasePackage(selectedPackage),
    );
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
      purchasesError.code === adapter.purchaseCancelledErrorCode
    ) {
      return { purchased: false, cancelled: true };
    }
    throw error;
  }
}

export async function purchaseWinBackPackage(
  context: RevenueCatOperationContext,
): Promise<PurchaseResult> {
  const adapter = await requireConfigured(context, 'win-back purchase');
  if (!adapter) return { purchased: false };

  const offerings = cachedOfferingsFor(context) ?? (await fetchOfferings(context));
  const annualPackage = offerings ? findPackage(offerings, 'annual') : null;
  if (!annualPackage || Platform.OS !== 'ios') return { purchased: false, offerUnavailable: true };

  let offers: PurchasesWinBackOffer[] | undefined;
  try {
    offers = await ownerCoordinator.runRead(
      ownerContext(context),
      loadRevenueCatIdentityAdapter,
      (current) => current.getEligibleWinBackOffersForPackage(annualPackage),
    );
  } catch {
    context.lease.assertCurrent();
  }
  const winBackOffer = offers?.[0];
  if (!winBackOffer) return { purchased: false, offerUnavailable: true };
  if (accountDeletionVendorWritesBlocked()) return { purchased: false };

  try {
    const result = await ownerCoordinator.runHazard(
      ownerContext(context),
      'winback',
      loadRevenueCatIdentityAdapter,
      (current) => current.purchasePackageWithWinBackOffer(annualPackage, winBackOffer),
    );
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
      purchasesError.code === adapter.purchaseCancelledErrorCode
    ) {
      return { purchased: false, cancelled: true };
    }
    throw error;
  }
}

/** Re-syncs entitlements for reinstalls/device switches. */
export async function restorePurchases(
  context: RevenueCatOperationContext,
): Promise<{
  restored: boolean;
  customerInfo?: CustomerInfo;
}> {
  const adapter = await requireConfigured(context, 'restore');
  if (!adapter) return { restored: false };
  if (accountDeletionVendorWritesBlocked()) return { restored: false };

  const customerInfo = await ownerCoordinator.runHazard(
    ownerContext(context),
    'restore',
    loadRevenueCatIdentityAdapter,
    (current) => current.restorePurchases(),
  );
  return { restored: hasActiveEntitlement(customerInfo), customerInfo };
}

export async function getCustomerInfo(
  context: RevenueCatOperationContext,
): Promise<CustomerInfo | null> {
  const adapter = await requireConfigured(context, 'customer info');
  if (!adapter) return null;
  return ownerCoordinator.runRead(
    ownerContext(context),
    loadRevenueCatIdentityAdapter,
    (current) => current.getCustomerInfo(),
  );
}

export async function subscribeToCustomerInfoUpdates(
  context: RevenueCatOperationContext,
  listener: CustomerInfoUpdateListener,
): Promise<() => void> {
  if (accountDeletionVendorWritesBlocked() || !canUseRevenueCat()) return () => {};
  const adapter = await requireConfigured(context, 'customer info listener');
  if (!adapter) return () => {};
  if (accountDeletionVendorWritesBlocked()) return () => {};
  const stamp = ownerCoordinator.stampFor(ownerContext(context));
  let cleanup: (() => void) | null = null;
  const removeInstalledListener = () => {
    const installed = cleanup;
    if (installed) installed();
  };
  try {
    await ownerCoordinator.runRead(
      ownerContext(context),
      loadRevenueCatIdentityAdapter,
      async (current) => {
        const guarded: CustomerInfoUpdateListener = (customerInfo) => {
          if (
            accountDeletionVendorWritesBlocked() ||
            !ownerCoordinator.isStampCurrent(stamp)
          ) {
            return;
          }
          listener(customerInfo);
        };
        current.addCustomerInfoUpdateListener(guarded);
        cleanup = ownerCoordinator.registerListener(stamp, () => {
          current.removeCustomerInfoUpdateListener(guarded);
        });
      },
    );
    return cleanup ?? (() => {});
  } catch (error) {
    removeInstalledListener();
    throw error;
  }
}

export async function showNativeManageSubscriptions(
  context: RevenueCatOperationContext,
): Promise<boolean> {
  if (Platform.OS !== 'ios' || !canUseRevenueCat()) return false;
  try {
    const adapter = await requireConfigured(context, 'subscription management');
    if (!adapter) return false;
    await ownerCoordinator.runHazard(
      ownerContext(context),
      'manage',
      loadRevenueCatIdentityAdapter,
      (current) => current.showManageSubscriptions(),
    );
    return true;
  } catch (error) {
    context.lease.assertCurrent();
    if (
      error instanceof RevenueCatIdentityMismatchError ||
      error instanceof RevenueCatOperationBusyError ||
      error instanceof RevenueCatOperationFencedError
    ) {
      throw error;
    }
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
