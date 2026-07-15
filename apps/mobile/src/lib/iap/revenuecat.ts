import type { PlanId } from '@onskin/types';
import { Platform } from 'react-native';
import type {
  CustomerInfo,
  CustomerInfoUpdateListener,
  IntroEligibility,
  PurchasesOfferings,
  PurchasesPackage,
  PurchasesWinBackOffer,
  Store as RevenueCatStore,
} from 'react-native-purchases';

import type { StoredEntitlement } from '@/features/subscription/entitlement';
import { PLANS } from '@/features/subscription/plans';
import {
  awaitAccountGenerationLease,
  type AccountGenerationLease,
} from '@/lib/auth/accountGeneration';
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
import {
  mapRevenueCatTrialEligibility,
  type TrialEligibility,
} from '@/lib/iap/revenuecatTrialEligibility';
import {
  comparableWinBackPercentOff,
  revenueCatOfferDurationLabel,
  revenueCatPeriodLabel,
} from '@/lib/iap/revenuecatWinBackTerms';
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
  trialEligibility: TrialEligibility;
  introLabel: string | null;
  canPurchase: boolean;
};

export type WinBackOfferView = {
  offerId: string;
  productId: string;
  packageId: string;
  offeringId: string;
  priceLabel: string;
  originalPriceLabel: string | null;
  percentOff: number | null;
  periodLabel: string;
  offerDurationLabel: string;
  renewalPriceLabel: string;
  renewalPeriodLabel: 'year' | 'month';
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
  pending?: boolean;
  purchaseMayHaveCompleted?: boolean;
  offerUnavailable?: boolean;
  productId?: string;
  packageId?: string;
  offeringId?: string;
  priceLabel?: string;
  purchasePriceLabel?: string;
  purchasePeriodLabel?: string;
  offerDurationLabel?: string;
  renewalPriceLabel?: string;
  renewalPeriodLabel?: 'year' | 'month';
  customerInfo?: CustomerInfo;
};

type NativePurchaseResult = {
  customerInfo: CustomerInfo;
  productIdentifier: string;
};

type RevenueCatAdapter = RevenueCatIdentityAdapter & {
  addCustomerInfoUpdateListener: (listener: CustomerInfoUpdateListener) => void;
  getCustomerInfo: () => Promise<CustomerInfo>;
  invalidateCustomerInfoCache: () => Promise<void>;
  checkTrialOrIntroductoryPriceEligibility: (
    productIds: string[],
  ) => Promise<Record<string, IntroEligibility>>;
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
  paymentPendingErrorCode: string;
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
let customerInfoRefreshFlight:
  | Readonly<{
      appUserId: string;
      generation: number;
      promise: Promise<CustomerInfo | null>;
    }>
  | null = null;
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
const TRUSTED_VERIFICATION_RESULTS = new Set(['VERIFIED', 'VERIFIED_ON_DEVICE']);

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

type RevenueCatVerificationValue = string | null | undefined;

function verificationIsTrusted(value: RevenueCatVerificationValue): boolean {
  if (TRUSTED_VERIFICATION_RESULTS.has(value ?? '')) return true;
  return env.appEnvironment === 'development' &&
    (value === 'NOT_REQUESTED' || value === undefined || value === null);
}

function customerInfoVerification(customerInfo: CustomerInfo): RevenueCatVerificationValue {
  return (
    customerInfo.entitlements as CustomerInfo['entitlements'] & {
      verification?: string;
    }
  ).verification;
}

function entitlementVerification(info: ReturnType<typeof entitlementInfo>): RevenueCatVerificationValue {
  return (info as (NonNullable<typeof info> & { verification?: string }) | null)?.verification;
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
  trialEligibility: TrialEligibility,
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
    trialEligibility,
    introLabel:
      trialDays && trialEligibility === 'eligible' ? `${trialDays} days free` : null,
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
    trialEligibility: 'unknown',
    introLabel: null,
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
            entitlementVerificationMode:
              Purchases.ENTITLEMENT_VERIFICATION_MODE.INFORMATIONAL,
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
      invalidateCustomerInfoCache: () =>
        runDeletionTracked(() => Purchases.invalidateCustomerInfoCache()),
      checkTrialOrIntroductoryPriceEligibility: (productIds) =>
        runDeletionTracked(() =>
          Purchases.checkTrialOrIntroductoryPriceEligibility(productIds),
        ),
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
      paymentPendingErrorCode: Purchases.PURCHASES_ERROR_CODE.PAYMENT_PENDING_ERROR,
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

async function trialEligibilityForPackages(
  context: RevenueCatOperationContext,
  packages: PurchasesPackage[],
): Promise<Map<string, TrialEligibility>> {
  const unknown = new Map(
    packages.map((pack) => [pack.product.identifier, 'unknown' as const]),
  );
  if (Platform.OS !== 'ios') return unknown;
  const adapter = await requireConfigured(context, 'trial eligibility');
  if (!adapter) return unknown;

  try {
    const productIds = [...new Set(packages.map((pack) => pack.product.identifier))];
    const response = await ownerCoordinator.runRead(
      ownerContext(context),
      loadRevenueCatIdentityAdapter,
      (current) => current.checkTrialOrIntroductoryPriceEligibility(productIds),
    );
    context.lease.assertCurrent();
    return new Map(
      productIds.map((productId) => [
        productId,
        mapRevenueCatTrialEligibility(Platform.OS, response[productId]?.status),
      ]),
    );
  } catch {
    context.lease.assertCurrent();
    return unknown;
  }
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

  const periodLabel = revenueCatPeriodLabel(offer);
  const offerDurationLabel = revenueCatOfferDurationLabel(offer);
  if (!periodLabel || !offerDurationLabel) return null;
  const percentOff = comparableWinBackPercentOff({
    offerPeriod: offer.period,
    standardPeriod: pack.product.subscriptionPeriod,
    offerPrice: offer.price,
    standardPrice: pack.product.price,
  });

  return {
    offerId: offer.identifier,
    productId: pack.product.identifier,
    packageId: pack.identifier,
    offeringId: pack.presentedOfferingContext?.offeringIdentifier ?? pack.offeringIdentifier,
    priceLabel: offer.priceString,
    originalPriceLabel: percentOff === null ? null : pack.product.priceString,
    percentOff,
    periodLabel,
    offerDurationLabel,
    renewalPriceLabel: pack.product.priceString,
    renewalPeriodLabel: periodLabelFor('annual', pack),
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

  const [trialEligibility, winBack] = await Promise.all([
    trialEligibilityForPackages(context, [annual, monthly]),
    winBackViewForPackage(context, annual),
  ]);
  context.lease.assertCurrent();

  return {
    status: 'available',
    offeringId: current.identifier,
    annual: packageToView(
      'annual',
      annual,
      true,
      trialEligibility.get(annual.product.identifier) ?? 'unknown',
    ),
    monthly: packageToView(
      'monthly',
      monthly,
      true,
      trialEligibility.get(monthly.product.identifier) ?? 'unknown',
    ),
    winBack,
  };
}

export type RevenueCatEntitlementClassification =
  | Readonly<{
      status: 'trusted';
      entitlement: StoredEntitlement | null;
      emptyEvidence: Readonly<{
        verifiedAt: string;
        managementUrl: string | null;
        storeUserId: string;
      }> | null;
    }>
  | Readonly<{
      status: 'untrusted';
      reason: 'failed' | 'not_requested' | 'unsupported';
    }>;

function effectiveAccessExpiration(
  customerInfo: CustomerInfo,
  info: NonNullable<ReturnType<typeof entitlementInfo>>,
): string | null {
  const subscriptionInfo =
    customerInfo.subscriptionsByProductIdentifier[info.productIdentifier];
  const requestTime = Date.parse(customerInfo.requestDate);
  const expirationTime = info.expirationDate
    ? Date.parse(info.expirationDate)
    : Number.NaN;
  const graceTime = subscriptionInfo?.gracePeriodExpiresDate
    ? Date.parse(subscriptionInfo.gracePeriodExpiresDate)
    : Number.NaN;

  if (!info.isActive) return info.expirationDate;
  if (Number.isFinite(requestTime)) {
    const futureBoundaries = [expirationTime, graceTime].filter(
      (time) => Number.isFinite(time) && time > requestTime,
    );
    if (futureBoundaries.length > 0) {
      return new Date(Math.max(...futureBoundaries)).toISOString();
    }
  }
  if (info.expirationDate && !Number.isFinite(expirationTime)) {
    // Preserve malformed provider bytes so the strict cache boundary rejects
    // them instead of silently converting them into an unbounded grant.
    return info.expirationDate;
  }
  // RevenueCat can report active billing-recovery access without a usable
  // future boundary. The verifiedAt proof cap closes this within 72 hours.
  return null;
}

export function classifyRevenueCatEntitlement(
  customerInfo: CustomerInfo,
  configuredAppUserId: string,
): RevenueCatEntitlementClassification {
  assertAppUserId(configuredAppUserId);
  const info = entitlementInfo(customerInfo);
  const overallVerification = customerInfoVerification(customerInfo);
  const selectedVerification = entitlementVerification(info);
  if (overallVerification === 'FAILED' || selectedVerification === 'FAILED') {
    return { status: 'untrusted', reason: 'failed' };
  }
  if (
    !verificationIsTrusted(overallVerification) ||
    (info !== null && !verificationIsTrusted(selectedVerification))
  ) {
    return { status: 'untrusted', reason: 'not_requested' };
  }
  if (!info) {
    return {
      status: 'trusted',
      entitlement: null,
      emptyEvidence: {
        verifiedAt: customerInfo.requestDate,
        managementUrl: safeExternalHttpsUrl(customerInfo.managementURL),
        storeUserId: configuredAppUserId,
      },
    };
  }
  if (
    (info.periodType !== null &&
      info.periodType !== undefined &&
      mapPeriod(info.periodType) === null) ||
    (info.store !== null && info.store !== undefined && mapStore(info.store) === null)
  ) {
    return { status: 'untrusted', reason: 'unsupported' };
  }
  const subscriptionInfo = customerInfo.subscriptionsByProductIdentifier[info.productIdentifier];
  const expiresAt = effectiveAccessExpiration(customerInfo, info);
  const mappedPeriod = mapPeriod(info.periodType);
  if (
    info.isActive &&
    (mappedPeriod === 'trial' || mappedPeriod === 'intro' || mappedPeriod === 'prepaid') &&
    expiresAt === null
  ) {
    return { status: 'untrusted', reason: 'unsupported' };
  }

  return {
    status: 'trusted',
    entitlement: {
      tier: info.identifier === 'pro_plus' ? 'pro_plus' : 'pro',
      isActive: info.isActive,
      periodType: mappedPeriod,
      store: mapStore(info.store),
      productId: info.productIdentifier ?? null,
      expiresAt,
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
      storeUserId: configuredAppUserId,
      priceLabel: null,
    },
    emptyEvidence: null,
  };
}

function hasTrustedActiveEntitlement(
  customerInfo: CustomerInfo,
  configuredAppUserId: string,
): boolean {
  const result = classifyRevenueCatEntitlement(customerInfo, configuredAppUserId);
  return result.status === 'trusted' && Boolean(result.entitlement?.isActive);
}

/**
 * Opens the native StoreKit/Play purchase sheet. Production never returns a stub;
 * callers must grant access only from returned CustomerInfo.
 */
export async function purchasePackage(
  context: RevenueCatOperationContext,
  plan: PlanId,
  assertCanDispatch?: () => void,
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

  let nativeDispatchStarted = false;
  try {
    const result = await ownerCoordinator.runHazard(
      ownerContext(context),
      'purchase',
      loadRevenueCatIdentityAdapter,
      (current) => {
        assertCanDispatch?.();
        nativeDispatchStarted = true;
        return current.purchasePackage(selectedPackage);
      },
    );
    if (result.productIdentifier !== selectedPackage.product.identifier) {
      return {
        purchased: false,
        productId: result.productIdentifier,
        customerInfo: result.customerInfo,
        purchaseMayHaveCompleted: true,
      };
    }
    return {
      purchased: hasTrustedActiveEntitlement(result.customerInfo, context.appUserId),
      productId: result.productIdentifier,
      packageId: selectedPackage.identifier,
      offeringId:
        selectedPackage.presentedOfferingContext?.offeringIdentifier ??
        selectedPackage.offeringIdentifier,
      priceLabel: selectedPackage.product.priceString,
      purchasePriceLabel: selectedPackage.product.priceString,
      purchasePeriodLabel: periodLabelFor(plan, selectedPackage),
      renewalPriceLabel: selectedPackage.product.priceString,
      renewalPeriodLabel: periodLabelFor(plan, selectedPackage),
      customerInfo: result.customerInfo,
    };
  } catch (error) {
    if (!nativeDispatchStarted) throw error;
    const purchasesError = error as { code?: string; userCancelled?: boolean };
    if (
      purchasesError.userCancelled ||
      purchasesError.code === adapter.purchaseCancelledErrorCode
    ) {
      return { purchased: false, cancelled: true };
    }
    if (
      adapter.paymentPendingErrorCode &&
      purchasesError.code === adapter.paymentPendingErrorCode
    ) {
      return { purchased: false, pending: true };
    }
    return { purchased: false, purchaseMayHaveCompleted: true };
  }
}

export async function purchaseWinBackPackage(
  context: RevenueCatOperationContext,
  assertCanDispatch?: () => void,
): Promise<PurchaseResult> {
  const adapter = await requireConfigured(context, 'win-back purchase');
  if (!adapter) return { purchased: false };

  const offerings = cachedOfferingsFor(context) ?? (await fetchOfferings(context));
  const annualPackage = offerings ? findPackage(offerings, 'annual') : null;
  if (!annualPackage || Platform.OS !== 'ios') return { purchased: false, offerUnavailable: true };

  let offers: PurchasesWinBackOffer[] | undefined;
  let nativeDispatchStarted = false;
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
      (current) => {
        assertCanDispatch?.();
        nativeDispatchStarted = true;
        return current.purchasePackageWithWinBackOffer(annualPackage, winBackOffer);
      },
    );
    if (result.productIdentifier !== annualPackage.product.identifier) {
      return {
        purchased: false,
        productId: result.productIdentifier,
        customerInfo: result.customerInfo,
        purchaseMayHaveCompleted: true,
      };
    }
    return {
      purchased: hasTrustedActiveEntitlement(result.customerInfo, context.appUserId),
      productId: result.productIdentifier,
      packageId: annualPackage.identifier,
      offeringId:
        annualPackage.presentedOfferingContext?.offeringIdentifier ??
        annualPackage.offeringIdentifier,
      priceLabel: annualPackage.product.priceString,
      purchasePriceLabel: winBackOffer.priceString,
      purchasePeriodLabel: revenueCatPeriodLabel(winBackOffer) ?? undefined,
      offerDurationLabel: revenueCatOfferDurationLabel(winBackOffer) ?? undefined,
      renewalPriceLabel: annualPackage.product.priceString,
      renewalPeriodLabel: periodLabelFor('annual', annualPackage),
      customerInfo: result.customerInfo,
    };
  } catch (error) {
    if (!nativeDispatchStarted) throw error;
    const purchasesError = error as { code?: string; userCancelled?: boolean };
    if (
      purchasesError.userCancelled ||
      purchasesError.code === adapter.purchaseCancelledErrorCode
    ) {
      return { purchased: false, cancelled: true };
    }
    if (
      adapter.paymentPendingErrorCode &&
      purchasesError.code === adapter.paymentPendingErrorCode
    ) {
      return { purchased: false, pending: true };
    }
    return { purchased: false, purchaseMayHaveCompleted: true };
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
  return {
    restored: hasTrustedActiveEntitlement(customerInfo, context.appUserId),
    customerInfo,
  };
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

/** Owner-fenced, single-flight network refresh used by explicit recovery Retry. */
export async function refreshCustomerInfo(
  context: RevenueCatOperationContext,
): Promise<CustomerInfo | null> {
  const active = customerInfoRefreshFlight;
  if (
    active &&
    active.appUserId === context.appUserId &&
    active.generation === context.lease.generation
  ) {
    return awaitAccountGenerationLease(context.lease, () => active.promise);
  }

  const promise = (async () => {
    const adapter = await requireConfigured(context, 'customer info refresh');
    if (!adapter) return null;
    return ownerCoordinator.runRead(
      ownerContext(context),
      loadRevenueCatIdentityAdapter,
      async (current) => {
        await current.invalidateCustomerInfoCache();
        context.lease.assertCurrent();
        return current.getCustomerInfo();
      },
    );
  })();
  const flight = {
    appUserId: context.appUserId,
    generation: context.lease.generation,
    promise,
  } as const;
  customerInfoRefreshFlight = flight;
  try {
    return await awaitAccountGenerationLease(context.lease, () => promise);
  } finally {
    if (customerInfoRefreshFlight === flight) customerInfoRefreshFlight = null;
  }
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
