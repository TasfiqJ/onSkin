import assert from 'node:assert/strict';
import { beforeEach, describe, it, vi } from 'vitest';

const h = vi.hoisted(() => ({
  calls: [] as string[],
  terms: 'https://policy.onskin.app/terms', privacy: 'https://policy.onskin.app/privacy',
  network: { isConnected: true, isInternetReachable: true } as { isConnected?: boolean; isInternetReachable?: boolean },
  networkThrows: false,
  server: { status: 'absent' } as Record<string, unknown>,
  local: { status: 'absent' } as Record<string, unknown>,
  merge: { status: 'blocked', snapshot: null } as Record<string, unknown>,
  staleOnCheck: 0, checks: 0,
}));
vi.mock('expo-network', () => ({ getNetworkStateAsync: async () => {
  h.calls.push('network'); if (h.networkThrows) throw Error('offline'); return h.network;
} }));
vi.mock('@/lib/env', () => ({ env: { get termsUrl() { return h.terms; }, get privacyUrl() { return h.privacy; } } }));
vi.mock('@/lib/auth/accountGeneration', () => ({ runAccountGenerationOperation: async (operation: (lease: unknown) => Promise<void>) => operation({
  signal: new AbortController().signal,
  assertCurrent: () => { h.checks++; if (h.checks === h.staleOnCheck) throw Error('STALE_OWNER'); },
}) }));
vi.mock('./store', () => ({
  entitlementOwnerContextForUser: async (user: string) => { h.calls.push(`owner:${user}`); return { ownerBinding: 'a'.repeat(64) }; },
  fetchServerEvidence: async () => { h.calls.push('server'); return h.server; },
  mergeEntitlementEvidenceBatch: async () => { h.calls.push('merge'); return h.merge; },
  readEntitlementSnapshot: async () => { h.calls.push('local'); return h.local; },
}));
// Keep this import after the hoisted fixtures so the dependency-only isolated runner
// can execute this same test body without installing React Native or an SDK.
// eslint-disable-next-line import/first
import { assertStandardPurchaseReady, assertSubscriptionCheckoutDependencies } from './purchasePreflight';

const NOW = '2026-09-28T18:00:00.000Z';
const entitlement = (over = {}) => ({ tier: 'pro', isActive: true, periodType: 'normal', store: 'app_store',
  source: 'revenuecat', productId: 'pro.annual', expiresAt: '2026-10-28T18:00:00.000Z', grantedAt: NOW, willRenew: true, ...over });
const snapshot = (over = {}) => ({ entitlement: null, effectiveNowISO: NOW, hasConflict: false, requiresUncachedRefresh: false, ...over });

describe('P1: actual purchase preflight with isolated service boundaries', () => {
  beforeEach(() => {
    h.calls.length = 0; h.terms = 'https://policy.onskin.app/terms'; h.privacy = 'https://policy.onskin.app/privacy';
    h.network = { isConnected: true, isInternetReachable: true }; h.networkThrows = false;
    h.server = { status: 'absent' }; h.local = { status: 'absent' }; h.merge = { status: 'blocked', snapshot: null };
    h.staleOnCheck = 0; h.checks = 0;
  });
  for (const key of ['terms', 'privacy'] as const) it(`missing ${key} rejects before any service work`, async () => {
    h[key] = ''; await assert.rejects(assertStandardPurchaseReady('owner-a'), /SUBSCRIPTION_POLICIES_UNAVAILABLE/);
    assert.deepEqual(h.calls, []);
  });
  it('valid policy URL shape alone does not claim service approval', async () => {
    await assert.doesNotReject(assertSubscriptionCheckoutDependencies()); assert.deepEqual(h.calls, ['network']);
  });
  for (const state of [{}, { isConnected: false }, { isConnected: true, isInternetReachable: false }]) it(`network ${JSON.stringify(state)} rejects before owner work`, async () => {
    h.network = state; await assert.rejects(assertStandardPurchaseReady('owner-a'), /SUBSCRIPTION_NETWORK_REQUIRED/);
    assert.deepEqual(h.calls, ['network']);
  });
  it('network exceptions do not admit a charge', async () => { h.networkThrows = true;
    await assert.rejects(assertStandardPurchaseReady('owner-a'), /SUBSCRIPTION_NETWORK_REQUIRED/); });
  it('verified absence plus empty local store allows an ordinary purchase', async () => {
    await assert.doesNotReject(assertStandardPurchaseReady('owner-a'));
    assert.deepEqual(h.calls, ['network', 'owner:owner-a', 'server', 'local']);
  });
  for (const status of ['blocked', 'transport_error', 'rejected', 'ignored', 'unconfigured']) it(`server ${status} never becomes a purchase authorization`, async () => {
    h.server = { status }; await assert.rejects(assertStandardPurchaseReady('owner-a'), /SUBSCRIPTION_ACCESS_UNCONFIRMED/);
    assert.equal(h.calls.includes('merge'), false);
  });
  for (const status of ['corrupt', 'foreign_owner', 'legacy_unbound', 'unsupported_version', 'unavailable']) it(`local ${status} is not repaired by server absence`, async () => {
    h.local = { status }; await assert.rejects(assertStandardPurchaseReady('owner-a'), /SUBSCRIPTION_ACCESS_UNCONFIRMED/);
  });
  it('existing paid access prevents another purchase', async () => {
    h.local = { status: 'available', snapshot: snapshot({ entitlement: entitlement() }) };
    await assert.rejects(assertStandardPurchaseReady('owner-a'), /SUBSCRIPTION_ALREADY_ACTIVE/);
  });
  it('a definite finite expiry may see standard options', async () => {
    h.local = { status: 'available', snapshot: snapshot({ entitlement: entitlement({ expiresAt: NOW }) }) };
    await assert.doesNotReject(assertStandardPurchaseReady('owner-a'));
  });
  for (const over of [{ hasConflict: true }, { requiresUncachedRefresh: true }, { entitlement: entitlement({ expiresAt: null }) }]) it(`rejects uncertain snapshot ${JSON.stringify(over)}`, async () => {
    h.local = { status: 'available', snapshot: snapshot(over) };
    await assert.rejects(assertStandardPurchaseReady('owner-a'), /SUBSCRIPTION_ACCESS_UNCONFIRMED/);
  });
  it('merge failure does not fall back to buying over old evidence', async () => {
    h.server = { status: 'evidence', evidence: [] }; h.local = { status: 'absent' };
    await assert.rejects(assertStandardPurchaseReady('owner-a'), /SUBSCRIPTION_ACCESS_UNCONFIRMED/);
  });
  it('admitted empty merge permits a normal purchase', async () => {
    h.server = { status: 'evidence', evidence: [] }; h.merge = { status: 'committed', snapshot: snapshot() };
    await assert.doesNotReject(assertStandardPurchaseReady('owner-a')); assert.equal(h.calls.includes('local'), false);
  });
  for (const check of [1, 2, 3, 4]) it(`owner invalidation at boundary ${check} aborts admission`, async () => {
    h.staleOnCheck = check; await assert.rejects(assertStandardPurchaseReady('owner-a'), /STALE_OWNER/);
  });
});
