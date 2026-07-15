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
import {
  isAccountActivityBlockedForDeletion,
  isAccountActivityDurablyBlockedForDeletion,
  subscribeToAccountDeletionActivityBlock,
} from '@/features/settings/accountDeletionBarrier';
import {
  AccountPublicationController,
  AccountPublicationControllerError,
  isAccountPublicationControllerError,
  type AccountPublicationDrainReason,
  type AccountPublicationSnapshot,
  type AccountPublicationTicket,
} from '@/lib/auth/accountPublicationController';
import {
  accountPublicationSessionBinding,
  type AccountPublicationSessionBinding,
} from '@/lib/auth/accountPublicationFence';
import { PLANS } from '@/features/subscription/plans';
import { BRAND } from '@/lib/brand';
import { env } from '@/lib/env';
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

type RevenueCatBinding = Readonly<{
  userId: string;
  generation: number;
}>;

type BoundOfferings = RevenueCatBinding & {
  value: PurchasesOfferings;
};

type RevenueCatResultKind = 'purchase' | 'restore' | 'customer_info' | 'listener';

type RevenueCatResultAuthority = Readonly<{
  kind: RevenueCatResultKind;
  ticket: AccountPublicationTicket;
}>;

let configuredBinding: RevenueCatBinding | null = null;
let configurePromise: { binding: RevenueCatBinding; completion: Promise<void> } | null = null;
let cachedOfferings: BoundOfferings | null = null;
let identityTransition = Promise.resolve();
const resultTickets = new WeakMap<object, RevenueCatResultAuthority>();

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

function serializeIdentityTransition<T>(operation: () => Promise<T>): Promise<T> {
  const completion = identityTransition.then(operation, operation);
  identityTransition = completion.then(
    () => undefined,
    () => undefined,
  );
  return completion;
}

/**
 * Seal every OnSkin-owned RevenueCat entry point without calling logOut().
 * RevenueCat documents that logOut creates a new anonymous customer and that
 * known-account switching should use logIn(nextKnownId) directly:
 * https://www.revenuecat.com/docs/customers/identifying-customers
 *
 * The publication lease cannot prove that a native SDK has no internal retry,
 * nor can it constrain old/tampered binaries. Those remain provider/operational
 * launch blockers; creating an untracked anonymous identity would not fix them.
 */
async function rawSealRevenueCatIdentity(): Promise<void> {
  return serializeIdentityTransition(async () => {
    configuredBinding = null;
    configurePromise = null;
    cachedOfferings = null;
  });
}

const accountPublicationController = new AccountPublicationController({
  isAccountActivityBlocked: isAccountActivityBlockedForDeletion,
  resetProviderIdentity: rawSealRevenueCatIdentity,
});

subscribeToAccountDeletionActivityBlock(() => {
  void accountPublicationController.beginDrain('account_deletion').catch(() => {
    // The deletion/root recovery gate retries the protected reset and release.
  });
});

function bindingForSession(userId: string, accessToken: string): AccountPublicationSessionBinding {
  const binding = accountPublicationSessionBinding(accessToken, userId);
  if (!binding) throw new Error('ACCOUNT_PUBLICATION_SESSION_REJECTED');
  return binding;
}

function bindResultToTicket<T extends object>(
  result: T,
  ticket: AccountPublicationTicket,
  kind: RevenueCatResultKind,
): T {
  resultTickets.set(result, { kind, ticket });
  return result;
}

export function assertRevenueCatResultCurrent(result: object): void {
  const authority = resultTickets.get(result);
  if (!authority) throw new Error('ACCOUNT_PUBLICATION_RESULT_STALE');
  try {
    authority.ticket.assertCurrent();
  } catch (error) {
    if (authority.kind === 'purchase' || authority.kind === 'restore') {
      throw new AccountPublicationControllerError(
        'ACCOUNT_PUBLICATION_STOREKIT_COMPLETION_UNCONFIRMED',
      );
    }
    throw error;
  }
}

export async function runRevenueCatResultWrite<T>(
  result: object,
  write: () => T | Promise<T>,
): Promise<T> {
  const authority = resultTickets.get(result);
  if (!authority) throw new Error('ACCOUNT_PUBLICATION_RESULT_STALE');
  assertRevenueCatResultCurrent(result);
  try {
    return await accountPublicationController.runOperation(
      'entitlement_write',
      async (ticket) => {
        if (
          ticket.generation !== authority.ticket.generation ||
          ticket.subject !== authority.ticket.subject ||
          ticket.sessionId !== authority.ticket.sessionId
        ) {
          throw new Error('ACCOUNT_PUBLICATION_RESULT_STALE');
        }
        assertRevenueCatResultCurrent(result);
        const value = await write();
        assertRevenueCatResultCurrent(result);
        return value;
      },
      authority.ticket.subject,
    );
  } catch (error) {
    if (
      (authority.kind === 'purchase' || authority.kind === 'restore') &&
      (isAccountPublicationControllerError(error, 'ACCOUNT_PUBLICATION_RESULT_STALE') ||
        isAccountPublicationControllerError(error, 'ACCOUNT_PUBLICATION_ADMISSION_CLOSED'))
    ) {
      throw new AccountPublicationControllerError(
        'ACCOUNT_PUBLICATION_STOREKIT_COMPLETION_UNCONFIRMED',
      );
    }
    throw error;
  }
}

export function isRevenueCatStoreKitCompletionUnconfirmed(error: unknown): boolean {
  return isAccountPublicationControllerError(
    error,
    'ACCOUNT_PUBLICATION_STOREKIT_COMPLETION_UNCONFIRMED',
  );
}

export function isRevenueCatStoreOperationCallerDetached(error: unknown): boolean {
  return isAccountPublicationControllerError(
    error,
    'ACCOUNT_PUBLICATION_STORE_OPERATION_CALLER_DETACHED',
  );
}

export function isRevenueCatStoreOperationInProgress(error: unknown): boolean {
  return isAccountPublicationControllerError(
    error,
    'ACCOUNT_PUBLICATION_STORE_OPERATION_IN_PROGRESS',
  );
}

/** RevenueCat bridges PAYMENT_PENDING_ERROR as a symbolic or numeric code. */
export function isRevenueCatPaymentPendingError(error: unknown): boolean {
  if (error === null || typeof error !== 'object' || Array.isArray(error)) return false;
  const code = (error as { code?: unknown }).code;
  return (
    code === 20 ||
    code === '20' ||
    code === 'PAYMENT_PENDING_ERROR' ||
    code === 'PaymentPendingError'
  );
}

export function isRevenueCatCancellationAmbiguous(error: unknown): boolean {
  if (error === null || typeof error !== 'object' || Array.isArray(error)) return false;
  const code = (error as { code?: unknown }).code;
  return code === 1 || code === '1' || code === 'PURCHASE_CANCELLED_ERROR';
}

export function revenueCatUnconfirmedStoreMessage(
  error: unknown,
  action: 'purchase' | 'restore',
): string | null {
  if (isRevenueCatStoreOperationCallerDetached(error)) {
    return 'The previous store operation is still settling and its outcome is not known yet. Do not retry or buy again. Keep the app open and wait for the status check.';
  }
  if (isRevenueCatStoreOperationInProgress(error)) {
    return 'A previous store operation is still settling. Do not start another purchase or Restore yet.';
  }
  if (!isRevenueCatStoreKitCompletionUnconfirmed(error)) return null;
  return action === 'purchase'
    ? 'The store may have completed this purchase, but we could not safely confirm it for this account. Do not buy again yet. Keep this account open and tap Restore purchases.'
    : 'The store may have restored a purchase, but we could not safely confirm it for this account. Keep this account open and try Restore purchases again.';
}

export function accountPublicationSnapshot(): AccountPublicationSnapshot {
  return accountPublicationController.snapshot();
}

/** Pure render-safe key material. Provider operations still enforce fresh authority. */
export function snapshotRevenueCatGenerationForUser(userId: string): number | null {
  const snapshot = accountPublicationController.snapshot();
  return snapshot.state === 'active' && snapshot.subject === userId ? snapshot.generation : null;
}

export function hasActiveRevenueCatPublication(userId: string, accessToken: string): boolean {
  const binding = accountPublicationSessionBinding(accessToken, userId);
  return binding !== null && accountPublicationController.isActiveFor(binding);
}

export function onRevenueCatPublicationClosed(
  listener: (reason: AccountPublicationDrainReason) => void,
): () => void {
  return accountPublicationController.addAdmissionClosedListener(listener);
}

export async function reserveRevenueCatPublication(
  userId: string,
  accessToken: string,
): Promise<AccountPublicationSnapshot> {
  return accountPublicationController.reserve(bindingForSession(userId, accessToken));
}

export async function activateRevenueCatPublication(
  userId: string,
  accessToken: string,
): Promise<AccountPublicationTicket> {
  return accountPublicationController.activate(bindingForSession(userId, accessToken));
}

export async function renewRevenueCatPublication(
  userId: string,
  accessToken: string,
): Promise<AccountPublicationTicket> {
  return accountPublicationController.renew(bindingForSession(userId, accessToken));
}

export function closeRevenueCatPublication(
  reason: AccountPublicationDrainReason = 'account_boundary',
): Promise<void> {
  return accountPublicationController.beginDrain(reason);
}

/** Pause new provider operations without invalidating an in-flight store ticket. */
export function pauseRevenueCatPublicationAdmission(): void {
  accountPublicationController.pauseAdmission();
}

/** Resume new operations only while the retained publication is still fresh. */
export function resumeRevenueCatPublicationAdmission(): boolean {
  return accountPublicationController.resumeAdmission();
}

/**
 * Close the exact authenticated owner's commerce publication before account
 * deletion creates any durable capability. This deliberately is not `async`:
 * subject/boundary mismatches must throw in the caller's final generation-
 * guarded action, while beginDrain closes admission synchronously.
 */
export function startRevenueCatDeletionQuiesce(expectedUserId: string): Promise<void> {
  assertAppUserId(expectedUserId);
  const before = accountPublicationController.snapshot();
  if (before.state === 'closed') {
    if (!isAccountActivityDurablyBlockedForDeletion()) {
      throw new AccountPublicationControllerError('ACCOUNT_PUBLICATION_BINDING_REJECTED');
    }
  } else if (before.subject !== expectedUserId) {
    throw new AccountPublicationControllerError('ACCOUNT_PUBLICATION_BINDING_REJECTED');
  }

  const completion = accountPublicationController.beginDrain('account_deletion');
  return completion.then(() => {
    const after = accountPublicationController.snapshot();
    if (after.state !== 'closed' || after.subject !== null || after.sessionId !== null) {
      throw new AccountPublicationControllerError('ACCOUNT_PUBLICATION_RESULT_STALE');
    }
  });
}

/**
 * Explicitly retries a protected reset/release after a bounded native-operation
 * quarantine. It remains fail-closed until every underlying SDK promise has
 * actually settled; callers must not infer safety from the caller-facing
 * StoreKit promise having already rejected.
 */
export function retryRevenueCatPublicationDrain(): Promise<void> {
  return accountPublicationController.retryDrain();
}

function entitlementInfo(customerInfo: CustomerInfo) {
  // Historical entries in `all` are not affirmative access authority. A
  // no-active result must take the conditional store-cache clear path so an
  // active server/app-granted reverse trial is not replaced by expired Store
  // history.
  const info = customerInfo.entitlements.active[env.revenueCatEntitlementId] ?? null;
  return info?.isActive ? info : null;
}

export type RevenueCatVerificationState =
  | 'FAILED'
  | 'NOT_REQUESTED'
  | 'VERIFIED'
  | 'VERIFIED_ON_DEVICE';

/**
 * Validate the aggregate Trusted Entitlements result before any mapper can
 * interpret active or empty access. Unknown future states fail closed instead
 * of being silently treated as a verified empty snapshot.
 */
export function revenueCatVerificationState(
  customerInfo: CustomerInfo,
): RevenueCatVerificationState {
  const verification: unknown = customerInfo.entitlements.verification;
  if (
    verification === 'FAILED' ||
    verification === 'NOT_REQUESTED' ||
    verification === 'VERIFIED' ||
    verification === 'VERIFIED_ON_DEVICE'
  ) {
    return verification;
  }
  throw new Error('REVENUECAT_ENTITLEMENT_VERIFICATION_UNKNOWN');
}

function hasActiveEntitlement(customerInfo: CustomerInfo): boolean {
  return entitlementInfo(customerInfo) !== null;
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

function ticketBinding(ticket: AccountPublicationTicket): RevenueCatBinding {
  return { userId: ticket.subject, generation: ticket.generation };
}

function bindingMatches(
  left: RevenueCatBinding | null,
  right: RevenueCatBinding,
): left is RevenueCatBinding {
  return left?.userId === right.userId && left.generation === right.generation;
}

async function requireConfigured(ticket: AccountPublicationTicket, action: string) {
  ticket.assertCurrent();
  if (!canUseRevenueCat()) {
    productionRequiresRevenueCat(action);
    return null;
  }
  const binding = ticketBinding(ticket);
  const pending = configurePromise;
  if (pending && bindingMatches(pending.binding, binding)) {
    await pending.completion;
  }
  ticket.assertCurrent();
  if (!bindingMatches(configuredBinding, binding)) throw new Error('REVENUECAT_NOT_CONFIGURED');
  const Purchases = await loadPurchases();
  ticket.assertCurrent();
  return Purchases;
}

async function fetchOfferings(
  ticket: AccountPublicationTicket,
): Promise<PurchasesOfferings | null> {
  const Purchases = await requireConfigured(ticket, 'offerings');
  if (!Purchases) return null;
  const binding = ticketBinding(ticket);
  if (bindingMatches(cachedOfferings, binding)) return cachedOfferings.value;
  const offerings = await Purchases.getOfferings();
  ticket.assertCurrent();
  cachedOfferings = { ...binding, value: offerings };
  return offerings;
}

async function winBackViewForPackage(
  ticket: AccountPublicationTicket,
  pack: PurchasesPackage,
): Promise<WinBackOfferView | null> {
  if (Platform.OS !== 'ios') return null;
  const Purchases = await requireConfigured(ticket, 'win-back offers');
  if (!Purchases) return null;

  const offers = await Purchases.getEligibleWinBackOffersForPackage(pack).catch(() => undefined);
  ticket.assertCurrent();
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
  assertAppUserId(appUserId);
  await accountPublicationController.runOperation(
    'configure',
    async (ticket) => {
      const binding = ticketBinding(ticket);
      if (bindingMatches(configuredBinding, binding)) return;
      const pending = configurePromise;
      if (pending && bindingMatches(pending.binding, binding)) {
        await pending.completion;
        ticket.assertCurrent();
        return;
      }

      const completion = serializeIdentityTransition(async () => {
        ticket.assertCurrent();
        if (!canUseRevenueCat()) {
          productionRequiresRevenueCat('configuration');
          return;
        }
        const Purchases = await loadPurchases();
        ticket.assertCurrent();
        const apiKey = revenueCatKey();
        assertRevenueCatKeyAllowed(apiKey);
        await Purchases.setLogLevel(__DEV__ ? Purchases.LOG_LEVEL.DEBUG : Purchases.LOG_LEVEL.WARN);
        ticket.assertCurrent();
        const isConfigured = await Purchases.isConfigured();
        ticket.assertCurrent();
        if (!isConfigured) {
          Purchases.configure({
            apiKey,
            appUserID: appUserId,
            automaticDeviceIdentifierCollectionEnabled: false,
            entitlementVerificationMode: Purchases.ENTITLEMENT_VERIFICATION_MODE.INFORMATIONAL,
          });
        } else if (configuredBinding?.userId !== appUserId) {
          await Purchases.logIn(appUserId);
        }
        ticket.assertCurrent();
        configuredBinding = binding;
        cachedOfferings = null;
      });
      configurePromise = { binding, completion };
      try {
        await completion;
      } finally {
        if (configurePromise?.completion === completion) configurePromise = null;
      }
    },
    appUserId,
  );
}

export async function resetRevenueCatIdentity(): Promise<void> {
  if (accountPublicationController.snapshot().state === 'closed') {
    await rawSealRevenueCatIdentity();
    return;
  }
  await accountPublicationController.beginDrain('account_boundary');
}

export async function getSubscriptionOffering(
  appUserId?: string,
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

  try {
    if (appUserId) await configureRevenueCat(appUserId);
    return await accountPublicationController.runOperation(
      'offering',
      async (ticket) => {
        const offerings = await fetchOfferings(ticket);
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
          winBack: await winBackViewForPackage(ticket, annual),
        };
      },
      appUserId,
    );
  } catch {
    return unavailableOffering(STORE_CHECKOUT_UNAVAILABLE_REASON);
  }
}

export function customerInfoToStoredEntitlement(
  customerInfo: CustomerInfo,
): StoredEntitlement | null {
  const verification = revenueCatVerificationState(customerInfo);
  if (verification === 'FAILED') {
    throw new Error('REVENUECAT_ENTITLEMENT_VERIFICATION_FAILED');
  }
  const info = entitlementInfo(customerInfo);
  if (!info) return null;
  if (info.verification === 'FAILED') {
    throw new Error('REVENUECAT_ENTITLEMENT_VERIFICATION_FAILED');
  }
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
    verifiedAt: verification === 'VERIFIED' ? customerInfo.requestDate : null,
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
type NativeStoreCallHooks = Readonly<{
  beforeNativeStoreCall: () => Promise<void>;
  markNativeCallStarted: () => void;
}>;

export async function purchasePackage(
  plan: PlanId,
  expectedSubject: string,
  nativeCall: NativeStoreCallHooks,
): Promise<PurchaseResult> {
  assertAppUserId(expectedSubject);
  return accountPublicationController.runOperation(
    'purchase',
    async (ticket) => {
      const Purchases = await requireConfigured(ticket, 'purchase');
      if (!Purchases) return bindResultToTicket({ purchased: false }, ticket, 'purchase');

      const offerings = await fetchOfferings(ticket);
      const selectedPackage = offerings ? findPackage(offerings, plan) : null;
      if (!selectedPackage) {
        throw new Error('REVENUECAT_OFFERING_UNAVAILABLE');
      }

      try {
        ticket.assertCurrent();
        await nativeCall.beforeNativeStoreCall();
        ticket.assertCurrent();
        nativeCall.markNativeCallStarted();
        const result = await Purchases.purchasePackage(selectedPackage);
        ticket.assertCurrent();
        return bindResultToTicket(
          {
            purchased: hasActiveEntitlement(result.customerInfo),
            productId: result.productIdentifier,
            packageId: selectedPackage.identifier,
            offeringId:
              selectedPackage.presentedOfferingContext?.offeringIdentifier ??
              selectedPackage.offeringIdentifier,
            priceLabel: selectedPackage.product.priceString,
            customerInfo: result.customerInfo,
          },
          ticket,
          'purchase',
        );
      } catch (error) {
        // React Native Purchases derives deprecated `userCancelled` from this
        // same code. RevenueCat documents that iOS may also use it when the item
        // is already owned. In either case this attempt made no new charge; the
        // caller still directs users who expected existing access to Restore.
        if (
          (error as { code?: unknown }).code ===
          Purchases.PURCHASES_ERROR_CODE.PURCHASE_CANCELLED_ERROR
        ) {
          return bindResultToTicket({ purchased: false, cancelled: true }, ticket, 'purchase');
        }
        throw error;
      }
    },
    expectedSubject,
  );
}

export async function purchaseWinBackPackage(
  expectedSubject: string,
  nativeCall: NativeStoreCallHooks,
): Promise<PurchaseResult> {
  assertAppUserId(expectedSubject);
  return accountPublicationController.runOperation(
    'purchase',
    async (ticket) => {
      const Purchases = await requireConfigured(ticket, 'win-back purchase');
      if (!Purchases) return bindResultToTicket({ purchased: false }, ticket, 'purchase');

      const offerings = await fetchOfferings(ticket);
      const annualPackage = offerings ? findPackage(offerings, 'annual') : null;
      if (!annualPackage || Platform.OS !== 'ios') {
        return bindResultToTicket({ purchased: false, offerUnavailable: true }, ticket, 'purchase');
      }

      const offers = await Purchases.getEligibleWinBackOffersForPackage(annualPackage).catch(
        () => undefined,
      );
      ticket.assertCurrent();
      const winBackOffer = offers?.[0];
      if (!winBackOffer) {
        return bindResultToTicket({ purchased: false, offerUnavailable: true }, ticket, 'purchase');
      }

      try {
        ticket.assertCurrent();
        await nativeCall.beforeNativeStoreCall();
        ticket.assertCurrent();
        nativeCall.markNativeCallStarted();
        const result = await Purchases.purchasePackageWithWinBackOffer(annualPackage, winBackOffer);
        ticket.assertCurrent();
        return bindResultToTicket(
          {
            purchased: hasActiveEntitlement(result.customerInfo),
            productId: result.productIdentifier,
            packageId: annualPackage.identifier,
            offeringId:
              annualPackage.presentedOfferingContext?.offeringIdentifier ??
              annualPackage.offeringIdentifier,
            priceLabel: winBackOffer.priceString,
            customerInfo: result.customerInfo,
          },
          ticket,
          'purchase',
        );
      } catch (error) {
        if (
          (error as { code?: unknown }).code ===
          Purchases.PURCHASES_ERROR_CODE.PURCHASE_CANCELLED_ERROR
        ) {
          return bindResultToTicket({ purchased: false, cancelled: true }, ticket, 'purchase');
        }
        throw error;
      }
    },
    expectedSubject,
  );
}

/** Re-syncs entitlements for reinstalls/device switches. */
export async function restorePurchases(
  expectedSubject: string,
  nativeCall: NativeStoreCallHooks,
): Promise<{
  restored: boolean;
  customerInfo?: CustomerInfo;
}> {
  assertAppUserId(expectedSubject);
  return accountPublicationController.runOperation(
    'restore',
    async (ticket) => {
      const Purchases = await requireConfigured(ticket, 'restore');
      if (!Purchases) return bindResultToTicket({ restored: false }, ticket, 'restore');
      ticket.assertCurrent();
      await nativeCall.beforeNativeStoreCall();
      ticket.assertCurrent();
      nativeCall.markNativeCallStarted();
      const customerInfo = await Purchases.restorePurchases();
      ticket.assertCurrent();
      return bindResultToTicket(
        { restored: hasActiveEntitlement(customerInfo), customerInfo },
        ticket,
        'restore',
      );
    },
    expectedSubject,
  );
}

export async function getCustomerInfo(): Promise<CustomerInfo | null> {
  return accountPublicationController.runOperation('customer_info', async (ticket) => {
    const Purchases = await requireConfigured(ticket, 'customer info');
    if (!Purchases) return null;
    const customerInfo = await Purchases.getCustomerInfo();
    ticket.assertCurrent();
    return bindResultToTicket(customerInfo, ticket, 'customer_info');
  });
}

/** Force a network-backed CustomerInfo read inside one owner-bound ticket. */
export async function getUncachedCustomerInfo(): Promise<CustomerInfo | null> {
  return accountPublicationController.runOperation('customer_info', async (ticket) => {
    const Purchases = await requireConfigured(ticket, 'uncached customer info');
    if (!Purchases) return null;
    await Purchases.invalidateCustomerInfoCache();
    ticket.assertCurrent();
    const customerInfo = await Purchases.getCustomerInfo();
    ticket.assertCurrent();
    return bindResultToTicket(customerInfo, ticket, 'customer_info');
  });
}

export async function subscribeToCustomerInfoUpdates(
  listener: (customerInfo: CustomerInfo) => void | Promise<void>,
  onListenerError?: (error: unknown, customerInfo: CustomerInfo) => void | Promise<void>,
): Promise<() => void> {
  if (!canUseRevenueCat()) return () => {};
  return accountPublicationController.runOperation('listener', async (ticket) => {
    const Purchases = await requireConfigured(ticket, 'customer info listener');
    if (!Purchases) return () => {};
    const listenerGeneration = ticket.generation;
    const wrapped: CustomerInfoUpdateListener = (customerInfo) => {
      const callback = accountPublicationController.runOperation(
        'listener',
        async (callbackTicket) => {
          if (callbackTicket.generation !== listenerGeneration) {
            throw new Error('ACCOUNT_PUBLICATION_RESULT_STALE');
          }
          bindResultToTicket(customerInfo, callbackTicket, 'listener');
          await listener(customerInfo);
        },
        ticket.subject,
      );
      void callback.catch((error: unknown) => {
        if (
          error instanceof AccountPublicationControllerError &&
          (error.code === 'ACCOUNT_PUBLICATION_ADMISSION_CLOSED' ||
            error.code === 'ACCOUNT_PUBLICATION_BINDING_REJECTED' ||
            error.code === 'ACCOUNT_PUBLICATION_RESULT_STALE')
        ) {
          // A closed/stale owner is an expected boundary outcome.
          return;
        }
        void Promise.resolve(onListenerError?.(error, customerInfo)).catch(() => {
          // The error channel is observational/recovery-only. It must never
          // escape the native event emitter or keep a drain from settling.
        });
      });
    };
    try {
      Purchases.addCustomerInfoUpdateListener(wrapped);
      return accountPublicationController.registerProviderListener(ticket, () => {
        Purchases.removeCustomerInfoUpdateListener(wrapped);
      });
    } catch (error) {
      try {
        Purchases.removeCustomerInfoUpdateListener(wrapped);
      } catch {
        // Preserve the registration error while still making the best possible
        // synchronous attempt to undo a partially registered native listener.
      }
      throw error;
    }
  });
}

export async function showNativeManageSubscriptions(): Promise<boolean> {
  if (Platform.OS !== 'ios' || !canUseRevenueCat()) return false;
  try {
    return await accountPublicationController.runOperation(
      'manage_subscription',
      async (ticket) => {
        const Purchases = await requireConfigured(ticket, 'manage subscriptions');
        if (!Purchases) return false;
        await Purchases.showManageSubscriptions();
        return true;
      },
    );
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
