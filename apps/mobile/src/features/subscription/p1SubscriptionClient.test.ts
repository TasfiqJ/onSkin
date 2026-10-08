import assert from 'node:assert/strict';
import { describe, it } from 'vitest';

import { deriveState, daysUntil } from './entitlement';
import { prepareRevenueCatActionProof } from './entitlementPurchaseAttribution';
import { standardStorePackage, exactIntroDays, isConfiguredPolicyUrl, subscriptionNetworkAvailable } from './clientPolicy';
import { advanceSubscriptionState, canFinishEmptyRestore, confirmedFreePlan, stateFromEntitlementSnapshot, stateWithoutServerEvidence } from './clientEntitlement';
import { currentBillingStatus, readClientBillingStatus, storeEntitlementExpiry } from './clientBilling';

const NOW = '2026-09-28T18:00:00.000Z';
const NOW_MS = Date.parse(NOW);
const END = '2026-10-28T18:00:00.000Z';
const GRACE = '2026-09-30T18:00:00.000Z';
const IDS = { annual: 'pro.annual', monthly: 'pro.monthly' };
const ent = (over = {}) => ({ tier: 'pro' as const, isActive: true, periodType: 'normal' as const,
  store: 'app_store' as const, productId: IDS.annual, expiresAt: END, willRenew: true,
  grantedAt: NOW, source: 'revenuecat' as const, ...over });
const snapshot = (over = {}) => ({ entitlement: ent(), effectiveNowISO: NOW,
  hasConflict: false, requiresUncachedRefresh: false, ...over });
const pack = (plan: 'annual' | 'monthly', product = {}) => ({ identifier: plan,
  offeringIdentifier: 'default', product: { identifier: IDS[plan], subscriptionPeriod: plan === 'annual' ? 'P1Y' : 'P1M',
    productCategory: 'SUBSCRIPTION', price: plan === 'annual' ? 49.99 : 9.99,
    priceString: plan === 'annual' ? '49,99 €' : '9,99 €', currencyCode: 'EUR', ...product } });
const offering = () => { const annual = pack('annual'), monthly = pack('monthly');
  return { identifier: 'default', annual, monthly, availablePackages: [annual, monthly] }; };
const info = (selected = {}, subscription = {}, extra = {}) => ({ requestDate: NOW,
  entitlements: { verification: 'VERIFIED', active: { pro: { identifier: 'pro', productIdentifier: IDS.annual,
    store: 'APP_STORE', verification: 'VERIFIED', isActive: true, expirationDate: END,
    willRenew: true, billingIssueDetectedAt: null, ...selected } }, all: {} },
  subscriptionsByProductIdentifier: { [IDS.annual]: { productIdentifier: IDS.annual, store: 'APP_STORE',
    gracePeriodExpiresDate: null, billingIssuesDetectedAt: null, ...subscription } }, ...extra });
const billing = (value: unknown, now = NOW_MS, expected: string | null = IDS.annual) =>
  readClientBillingStatus(value, 'pro', expected, Object.values(IDS), now);

describe('P1: exact store packages and localized labels', () => {
  for (const plan of ['annual', 'monthly'] as const) it(`admits exact ${plan} without cloning or price conversion`, () => {
    const current = offering(); const selected = standardStorePackage(current, plan, IDS);
    assert.equal(selected, current[plan]); assert.equal(selected?.product.priceString, current[plan].product.priceString);
  });
  for (const label of ['49,99 €', '￥7,000', '‏١٩٩٫٩٩ ر.س.‏', 'CA$69.99']) it(`preserves ${label} verbatim`, () => {
    const current = offering(); current.annual.product.priceString = label;
    assert.equal(standardStorePackage(current, 'annual', IDS)?.product.priceString, label);
  });
  for (const [name, override] of Object.entries({ wrongProduct: { identifier: 'other' }, wrongCadence: { subscriptionPeriod: 'P1W' },
    lifetime: { subscriptionPeriod: null }, consumable: { productCategory: 'NON_SUBSCRIPTION' },
    missingCategory: { productCategory: undefined }, missingPrice: { price: NaN }, zeroPrice: { price: 0 },
    negativePrice: { price: -1 }, infinitePrice: { price: Infinity }, blankLabel: { priceString: ' ' }, invalidCurrency: { currencyCode: 'usd' } })) {
    it(`rejects ${name}`, () => { const current = offering(); Object.assign(current.annual.product, override);
      assert.equal(standardStorePackage(current, 'annual', IDS), null); });
  }
  it('rejects a miswired annual slot even when another correct package exists', () => {
    const current = offering(); current.annual = current.monthly;
    assert.equal(standardStorePackage(current, 'annual', IDS), null);
  });
  it('rejects conflicting slot and available-package pricing', () => {
    const current = offering(); current.annual = { ...current.annual, product: { ...current.annual.product, price: 1 } };
    assert.equal(standardStorePackage(current, 'annual', IDS), null);
  });
  it('rejects duplicate products', () => { const current = offering(); current.availablePackages.push(pack('annual'));
    assert.equal(standardStorePackage(current, 'annual', IDS), null); });
  it('rejects missing current offering', () => assert.equal(standardStorePackage(null, 'annual', IDS), null));
  it('rejects identical configured product IDs', () => assert.equal(standardStorePackage(offering(), 'annual', { ...IDS, monthly: IDS.annual }), null));
  it('rejects a foreign offering context', () => { const current = offering(); current.annual.offeringIdentifier = 'other';
    assert.equal(standardStorePackage(current, 'annual', IDS), null); });
  for (const unit of ['MONTH', 'YEAR', '', 'UNKNOWN']) it(`does not invent day counts for ${unit}`, () => assert.equal(exactIntroDays(unit, 1), null));
  it('uses exact day/week trial counts', () => { assert.equal(exactIntroDays('WEEK', 2), 14); assert.equal(exactIntroDays('DAY', 7, 2), 14); });
  for (const n of [0, -1, NaN, Infinity, 1.5]) it(`rejects invalid introductory units ${n}`, () => assert.equal(exactIntroDays('DAY', n), null));
});

describe('P1: checkout dependencies', () => {
  for (const url of ['', ' ', 'http://policy.onskin.app/terms', 'https://example.com/privacy', 'https://user:pass@policy.onskin.app',
    'https://localhost/terms', 'https://127.0.0.1/terms', 'https://policy.test/terms', 'https://policy.onskin.app:8443/terms', ' https://policy.onskin.app/terms']) {
    it(`rejects unconfigured policy URL ${JSON.stringify(url)}`, () => assert.equal(isConfiguredPolicyUrl(url), false));
  }
  it('accepts public HTTPS configuration without claiming approval or reachability', () => assert.equal(isConfiguredPolicyUrl('https://policy.onskin.app/terms'), true));
  for (const state of [{}, { isConnected: true }, { isConnected: false, isInternetReachable: true },
    { isConnected: true, isInternetReachable: false }, { isConnected: true, isInternetReachable: null }]) {
    it(`does not admit offline/unknown network ${JSON.stringify(state)}`, () => assert.equal(subscriptionNetworkAvailable(state), false));
  }
  it('admits positively observed connectivity', () => assert.equal(subscriptionNetworkAvailable({ isConnected: true, isInternetReachable: true }), true));
});

describe('P1: entitlement fail-closed, expiry and recovery', () => {
  it('keeps ordinary finite store access', () => assert.equal(deriveState(ent(), NOW).isPro, true));
  for (const expiresAt of [null, '', 'invalid', 'not-a-date']) it(`rejects unknown active expiry ${expiresAt}`, () => {
    const state = deriveState(ent({ expiresAt }), NOW); assert.equal(state.isPro, false); assert.equal(state.evidenceStatus, 'invalid');
  });
  for (const over of [{ store: 'app_granted' }, { source: 'app_granted' }, { periodType: 'reverse_trial' }]) {
    it(`never grants a deferred source ${JSON.stringify(over)}`, () => {
      const state = deriveState(ent(over), NOW); assert.equal(state.isPro, false); assert.equal(state.inReverseTrial, false);
      assert.equal(deriveState(ent(over), NOW, 'unavailable').evidenceStatus, 'unavailable');
    });
  }
  it('treats cancellation as renewal-off, not immediate access loss', () => assert.equal(deriveState(ent({ willRenew: false }), NOW).isPro, true));
  it('expires at the exact endpoint without a network event', () => {
    const state = advanceSubscriptionState(deriveState(ent(), NOW), Date.parse(END));
    assert.equal(state.isPro, false); assert.equal(state.expired, true); assert.equal(state.evidenceStatus, 'expired');
  });
  it('does not revive expired state after a backward wall-clock change', () => {
    const expired = advanceSubscriptionState(deriveState(ent(), NOW), Date.parse(END));
    assert.equal(advanceSubscriptionState(expired, NOW_MS).isPro, false);
  });
  it('rejects an invalid local clock', () => { assert.equal(deriveState(ent(), 'invalid').isPro, false); assert.equal(daysUntil(END, 'invalid'), null); });
  it('conflicting evidence shows recovery, never confirmed free', () => {
    const data = stateFromEntitlementSnapshot(snapshot({ hasConflict: true }));
    assert.equal(data.isPro, false); assert.equal(data.evidenceStatus, 'invalid'); assert.equal(confirmedFreePlan({ data }), false);
  });
  for (const serverStatus of ['transport_error', 'rejected', 'ignored', 'unconfigured']) {
    it(`no cache plus ${serverStatus} is unknown, not free`, () => {
      const state = stateWithoutServerEvidence({ local: null, localStatus: 'absent', serverStatus, nowISO: NOW, development: false });
      assert.equal(state.isPro, false); assert.equal(state.evidenceStatus, 'unavailable');
    });
  }
  it('keeps verified cached access on transport failure only through its expiry', () => {
    const state = stateWithoutServerEvidence({ local: snapshot(), localStatus: 'available', serverStatus: 'transport_error', nowISO: NOW, development: false });
    assert.equal(state.isPro, true); assert.equal(state.evidenceStatus, 'reconciliation_due');
    assert.equal(advanceSubscriptionState(state, Date.parse(END)).isPro, false);
  });
  for (const serverStatus of ['rejected', 'blocked']) {
    it(`does not reuse cached Pro after authenticated publication is ${serverStatus}`, () => {
      const data = stateWithoutServerEvidence({ local: snapshot(), localStatus: 'available', serverStatus, nowISO: NOW, development: false });
      assert.equal(data.isPro, false);
      assert.equal(data.evidenceStatus, 'unavailable');
      assert.equal(confirmedFreePlan({ data }), false);
    });
  }
  it('a verified absent server projection plus absent local cache is free', () => {
    const data = stateWithoutServerEvidence({ local: null, localStatus: 'absent', serverStatus: 'absent', nowISO: NOW, development: false });
    assert.equal(confirmedFreePlan({ data }), true);
  });
  for (const flag of ['isPending', 'isLoading', 'isFetching', 'isError']) it(`does not sell while ${flag}`, () => {
    assert.equal(confirmedFreePlan({ data: deriveState(null, NOW), [flag]: true }), false);
  });
  it('a cursorless legacy-only snapshot requires recovery', () => {
    assert.equal(stateFromEntitlementSnapshot(snapshot({ entitlement: null, requiresUncachedRefresh: true })).evidenceStatus, 'unavailable');
  });
});

describe('P1: definitive empty Restore admission', () => {
  const accepted = () => ({ status: 'committed', disposition: 'applied', requiresUncachedRefresh: false,
    snapshot: { ...snapshot({ entitlement: null }), activeStoreEntitlement: null } });
  it('accepts only a durably committed verified empty restore', () => assert.equal(canFinishEmptyRestore('VERIFIED', false, accepted()), true));
  for (const v of ['VERIFIED_ON_DEVICE', 'NOT_REQUESTED', 'FAILED', 'UNKNOWN']) {
    it(`does not resolve a restore from ${v} empty`, () => assert.equal(canFinishEmptyRestore(v, false, accepted()), false));
  }
  for (const over of [{ status: 'ignored' }, { status: 'blocked' }, { status: 'conflict' }, { disposition: 'stale' }, { disposition: 'ignored' },
    { snapshot: null }, { requiresUncachedRefresh: true }]) {
    it(`does not resolve unconfirmed restore ${JSON.stringify(over)}`, () => assert.equal(canFinishEmptyRestore('VERIFIED', false, { ...accepted(), ...over }), false));
  }
  it('never calls an active result empty', () => assert.equal(canFinishEmptyRestore('VERIFIED', true, accepted()), false));
});

describe('P1: billing metadata is display-only and grace must be observed', () => {
  it('reports verified active renewal', () => assert.equal(billing(info()).kind, 'active'));
  it('reports renewal-off without deleting access', () => { const value = info({ willRenew: false });
    assert.equal(billing(value).kind, 'renewal_off'); assert.equal(storeEntitlementExpiry(value, 'pro'), END); });
  it('reports a billing issue without manufacturing grace', () => {
    assert.equal(billing(info({ billingIssueDetectedAt: NOW })).kind, 'billing_issue');
  });
  it('uses only the provider-reported grace endpoint', () => {
    const value = info({ billingIssueDetectedAt: NOW, expirationDate: '2026-09-28T17:00:00.000Z' }, { gracePeriodExpiresDate: GRACE });
    assert.equal(billing(value).kind, 'grace'); assert.equal(storeEntitlementExpiry(value, 'pro'), GRACE);
  });
  it('does not extend without a billing issue', () => assert.equal(storeEntitlementExpiry(info({}, { gracePeriodExpiresDate: '2027-01-01T00:00:00.000Z' }), 'pro'), END));
  it('does not extend from a wrong product', () => {
    const value = info({ billingIssueDetectedAt: NOW, expirationDate: NOW }, { productIdentifier: IDS.monthly, gracePeriodExpiresDate: GRACE });
    assert.equal(storeEntitlementExpiry(value, 'pro'), NOW); assert.notEqual(billing(value).kind, 'grace');
  });
  it('does not extend an inactive entitlement', () => {
    assert.equal(storeEntitlementExpiry(info({ isActive: false, billingIssueDetectedAt: NOW, expirationDate: NOW }, { gracePeriodExpiresDate: GRACE }), 'pro'), NOW);
  });
  it('does not extend from unsigned grace metadata', () => {
    const value = info({ billingIssueDetectedAt: NOW, expirationDate: NOW, verification: 'NOT_REQUESTED' }, { gracePeriodExpiresDate: GRACE });
    assert.equal(storeEntitlementExpiry(value, 'pro'), NOW); assert.equal(billing(value).kind, 'unknown');
  });
  it('does not extend from a future billing-issue timestamp', () => {
    const value = info({ billingIssueDetectedAt: GRACE, expirationDate: NOW }, { gracePeriodExpiresDate: GRACE });
    assert.equal(storeEntitlementExpiry(value, 'pro'), NOW);
  });
  it('does not turn missing expiry into lifetime access', () => assert.equal(storeEntitlementExpiry(info({ expirationDate: null }), 'pro'), null));
  it('reports inactive entitlement as ended', () => assert.equal(billing(info({ isActive: false })).kind, 'expired'));
  it('does not reuse stale metadata', () => assert.equal(billing(info(), NOW_MS + 300_001).kind, 'unknown'));
  it('does not use a future provider timestamp', () => assert.equal(billing(info(), NOW_MS - 1).kind, 'unknown'));
  it('does not show a different product as the customer plan', () => assert.equal(billing(info(), NOW_MS, IDS.monthly).kind, 'unknown'));
  it('ages a visible badge out without any provider event', () => assert.equal(currentBillingStatus(billing(info()), NOW_MS + 300_001).kind, 'unknown'));
  it('requires refresh at the observed grace boundary, never invents renewal', () => {
    const graceEnd = new Date(NOW_MS + 1000).toISOString();
    const status = billing(info({ billingIssueDetectedAt: NOW }, { gracePeriodExpiresDate: graceEnd }));
    assert.equal(status.kind, 'grace'); assert.equal(currentBillingStatus(status, NOW_MS + 1000).kind, 'unknown');
  });
});

// This pre-existing helper is deliberately reused by the P1 action boundary.
describe('P1: exact native-product price attribution', () => {
  it('does not assign a selected package price to a different entitlement product', () => {
    const original = ent({ priceLabel: 'existing' });
    const result = prepareRevenueCatActionProof(original, { productId: IDS.monthly, priceLabel: 'new' });
    assert.equal(result.actionProductMatched, false);
    assert.equal(result.entitlement, original);
  });
  it('does not infer purchase attribution from restore or listener results', () => {
    const original = ent({ priceLabel: null });
    const result = prepareRevenueCatActionProof(original, { priceLabel: 'unrelated offering' });
    assert.equal(result.actionProductMatched, true);
    assert.equal(result.entitlement, original);
  });
  it('preserves an exact localized renewal price for the purchased product', () => {
    const result = prepareRevenueCatActionProof(ent(), {
      productId: IDS.annual, priceLabel: '49,99 €', packageId: 'annual', offeringId: 'default',
    });
    assert.equal(result.actionProductMatched, true);
    assert.equal(result.entitlement.priceLabel, '49,99 €');
    assert.equal(result.entitlement.packageId, 'annual');
  });
  it('does not mistake an introductory purchase amount for a known renewal amount', () => {
    const result = prepareRevenueCatActionProof(ent(), {
      productId: IDS.annual, purchasePriceLabel: '9,99 €', renewalPriceLabel: '49,99 €',
    });
    assert.equal(result.entitlement.priceLabel, '49,99 €');
  });
});
