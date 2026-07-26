import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

const SRC_DIR = fileURLToPath(new URL('../../', import.meta.url));

function readSource(path: string): string {
  return readFileSync(`${SRC_DIR}/${path}`, 'utf8');
}

describe('account publication AuthProvider integration', () => {
  it('attempts exact commerce activation before the sole local-session publication', () => {
    const provider = readSource('lib/auth/AuthProvider.tsx');
    const reserve = provider.indexOf('await reserveRevenueCatPublication(');
    const activate = provider.indexOf('await activateRevenueCatPublication(');
    const publish = provider.indexOf('setSession(latestPendingSession);');

    expect(reserve).toBeGreaterThan(-1);
    expect(activate).toBeGreaterThan(reserve);
    expect(publish).toBeGreaterThan(activate);
    expect(provider.match(/setSession\(latestPendingSession\)/g)).toHaveLength(1);
    expect(provider).toContain("priorState === 'inactive' && retainedPublication");
    expect(provider).toContain('setSession(current);');
    expect(provider).toContain('hasActiveRevenueCatPublication(targetUserId');
    expect(provider).toContain('commerce preflight unavailable; retaining local-only access');
  });

  it('reacquires both remote authorities and refreshes only near expiry before publication', () => {
    const provider = readSource('lib/auth/AuthProvider.tsx');
    const candidate = provider.indexOf(
      'let remoteBinding = await enterRemotePublicationCandidate(transitionSession);',
    );
    const refresh = provider.indexOf(
      'transitionSession = await refreshRemotePublicationCandidate(',
    );
    const preflight = provider.indexOf('barrierState = await fetchAccountDeletionBarrierState(');
    const reserve = provider.indexOf('await reserveRevenueCatPublication(');
    const remoteActivate = provider.indexOf('activateSupabaseRemoteRequest(');
    const publish = provider.indexOf('setSession(latestPendingSession);');

    expect(provider).toContain('const sameLocalSession = Boolean(');
    expect(provider).toContain('requiresControlledSessionRefresh(transitionSession)');
    expect(provider).toContain('runWithSupabaseAuthRefreshPermit(');
    expect(provider).toContain('refreshPersistedSupabaseSessionCandidate(');
    expect(candidate).toBeGreaterThan(-1);
    expect(refresh).toBeGreaterThan(candidate);
    expect(preflight).toBeGreaterThan(refresh);
    expect(reserve).toBeGreaterThan(preflight);
    expect(remoteActivate).toBeGreaterThan(reserve);
    expect(publish).toBeGreaterThan(remoteActivate);
    expect(provider).not.toContain('supabase.auth.refreshSession(');
  });

  it('closes on true background states and safely reacquires through controlled refresh', () => {
    const provider = readSource('lib/auth/AuthProvider.tsx');
    const boundary = provider.slice(
      provider.indexOf('function showSessionBoundary('),
      provider.indexOf('showSessionBoundaryRef.current = showSessionBoundary;'),
    );

    expect(provider).toContain('const handle = (state: AppStateStatus | null) =>');
    expect(provider).toContain("if (state === 'active') {");
    expect(provider).toContain('supabase.auth.stopAutoRefresh();');
    expect(provider).toContain("closeRevenueCatPublication('app_backgrounded')");
    expect(provider).toContain('closeRemoteRequestAuthorityRef.current();');
    expect(provider).toContain('const inFlight = boundaryInFlightRef.current?.promise;');
    expect(provider.indexOf('retryRevenueCatPublicationDrain()')).toBeLessThan(
      provider.indexOf('await applySessionBoundaryRef.current(retainedSession);'),
    );
    expect(provider).toContain('requiresControlledSessionRefresh(transitionSession)');
    expect(provider).toContain('refreshPersistedSupabaseSessionCandidate(');
    expect(provider).not.toContain('supabase.auth.refreshSession(');
    expect(provider).toContain('hasActiveRevenueCatPublication(published.user.id');
    expect(provider).toContain('scheduleControlledSessionRefresh(published);');
    expect(provider).not.toContain('supabase.auth.startAutoRefresh();');
    expect(provider.indexOf('hasActiveRevenueCatPublication(published.user.id')).toBeLessThan(
      provider.lastIndexOf('scheduleControlledSessionRefresh(published);'),
    );
    expect(boundary.indexOf('closeAnalyticsPublication();')).toBeGreaterThan(-1);
    expect(boundary.indexOf('closeAnalyticsPublication();')).toBeLessThan(
      boundary.indexOf('closeRemoteRequestAuthority({'),
    );
    expect(boundary.indexOf('closeAnalyticsPublication();')).toBeLessThan(
      boundary.indexOf('closeRevenueCatPublication(reason)'),
    );
  });

  it('tracks entitlement writes without passively resolving Store transaction safety', () => {
    const provider = readSource('lib/auth/AuthProvider.tsx');
    const entitlement = readSource('features/subscription/useEntitlement.ts');
    const offering = readSource('features/subscription/useSubscriptionOffering.ts');
    const revenueCat = readSource('lib/iap/revenuecat.ts');

    expect(provider).toContain(
      'runRevenueCatResultWrite(customerInfo, () => enqueueCustomerInfoWrite(customerInfo))',
    );
    expect(provider).toContain('cleanup = await subscribeToCustomerInfoUpdates(');
    const subscribe = provider.indexOf('cleanup = await subscribeToCustomerInfoUpdates(');
    const initialCustomerInfo = provider.indexOf('const current = await getCustomerInfo();');
    expect(subscribe).toBeGreaterThan(-1);
    expect(initialCustomerInfo).toBeGreaterThan(subscribe);
    expect(provider).toContain('let customerInfoWriteTail: Promise<void> = Promise.resolve();');
    expect(provider).toContain('const bufferedCustomerInfo: CustomerInfo[] = [];');
    expect(provider).toContain('await publishCustomerInfoEvidence({');
    expect(provider).toContain('const context = await entitlementOwnerContextForUser(userId);');
    expect(provider).toContain('getUncachedCustomerInfo()');
    expect(provider).toContain('result?.requiresUncachedRefresh');
    const durablePublish = provider.indexOf('const result = await publishCustomerInfoEvidence({');
    const reassert = provider.indexOf(
      'assertRevenueCatResultCurrent(customerInfo);',
      durablePublish,
    );
    expect(durablePublish).toBeGreaterThan(-1);
    expect(reassert).toBeGreaterThan(durablePublish);
    expect(provider).not.toContain('saveVerifiedEntitlement');
    expect(provider).not.toContain('clearStoreEntitlementIfRevenueCatVerifiedEmpty');
    expect(provider).not.toContain('resolveStoreTransactionNoticeFromVerifiedActiveEntitlement');
    expect(entitlement).toContain('return runRevenueCatResultWrite(input, async () => {');
    expect(entitlement).toContain('await scheduleTrialReminder();');
    expect(entitlement).toContain('await cancelTrialReminder();');
    expect(entitlement).toContain('const published = await publishCustomerInfoEvidence({');
    expect(entitlement).toContain('isDurablyAdmissibleStoreResult(');
    expect(entitlement).not.toContain('saveVerifiedEntitlement');
    expect(entitlement).not.toContain('clearStoreEntitlementIfRevenueCatVerifiedEmpty');
    expect(offering).not.toContain('configureRevenueCat');
    expect(offering).toContain('snapshotRevenueCatGenerationForUser(user.id)');
    expect(offering).not.toContain('activeRevenueCatGenerationForUser');
    expect(revenueCat).toContain('const snapshot = accountPublicationController.snapshot();');
    expect(revenueCat).not.toContain('customerInfo.entitlements.all[env.revenueCatEntitlementId]');
  });

  it('does not persist, log, or place the capability in a URL', () => {
    const fence = readSource('lib/auth/accountPublicationFence.ts');
    const controller = readSource('lib/auth/accountPublicationController.ts');
    const combined = `${fence}\n${controller}`;

    expect(combined).not.toMatch(/(?:AsyncStorage|SecureStore|privateKV).*capability/i);
    expect(combined).not.toMatch(/(?:console\.|devWarn|track\().*capability/i);
    expect(fence).toContain("new URL('/functions/v1/account-deletion', env.supabaseUrl)");
    expect(fence).not.toMatch(/new URL\([^\n]*capability/);
  });
});
