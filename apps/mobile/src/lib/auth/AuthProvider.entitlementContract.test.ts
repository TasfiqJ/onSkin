import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

const AUTH_PROVIDER_SOURCE = fileURLToPath(new URL('./AuthProvider.tsx', import.meta.url));

describe('AuthProvider entitlement query authority contract', () => {
  it('installs the owner-fenced listener before starting the initial CustomerInfo read', () => {
    const source = readFileSync(AUTH_PROVIDER_SOURCE, 'utf8');
    const configure = source.indexOf('await configureRevenueCat(revenueCatOwner);');
    const subscribe = source.indexOf('subscribeToCustomerInfoUpdates(revenueCatOwner', configure);
    const initialRead = source.indexOf(
      'const current = await getCustomerInfo(revenueCatOwner);',
      subscribe,
    );

    expect(configure).toBeGreaterThan(-1);
    expect(subscribe).toBeGreaterThan(configure);
    expect(initialRead).toBeGreaterThan(subscribe);
    expect(source.slice(subscribe, initialRead)).toContain('if (!canWriteForUser()) {');
    expect(source.slice(subscribe, initialRead)).toContain('cleanup();');
    expect(source).toContain('if (cleanup) cleanup();');
  });

  it('keeps listener publication and reminder reconciliation inside the captured generation', () => {
    const source = readFileSync(AUTH_PROVIDER_SOURCE, 'utf8');
    const listener = source.indexOf('subscribeToCustomerInfoUpdates(revenueCatOwner');
    const end = source.indexOf("devWarn('[revenuecat] configuration failed'", listener);
    const callback = source.slice(listener, end);

    expect(listener).toBeGreaterThan(-1);
    expect(end).toBeGreaterThan(listener);
    expect(callback).toContain('runAccountGenerationOperation(async (callbackLease)');
    expect(callback).toContain('callbackLease.generation !== listenerGeneration');
    expect(callback).toContain(
      'const callbackScope: OwnerQueryScope = { generation: callbackLease.generation };',
    );
    expect(callback).toContain(
      'await acceptTrustedRevenueCatEntitlement(classified.entitlement)',
    );
    expect(callback).toContain(
      'await acceptRevenueCatVerifiedEmpty(classified.emptyEvidence)',
    );
    expect(callback.indexOf('publishEntitlementQueryAcceptance(')).toBeLessThan(
      callback.indexOf('await queryClient.invalidateQueries({'),
    );
    expect(callback).toContain('deferEntitlementTrialReminder(callbackScope, published);');
    expect(callback.indexOf('publishEntitlementQueryAcceptance(')).toBeLessThan(
      callback.indexOf('deferEntitlementTrialReminder(callbackScope, published);'),
    );
    expect(callback).toContain('queryKey: ownerQueryPrefixes.entitlement(callbackScope)');
    expect(callback).toContain('callbackLease.assertCurrent();');
  });

  it('orders the initial snapshot through the same publisher and fail-soft reminder path', () => {
    const source = readFileSync(AUTH_PROVIDER_SOURCE, 'utf8');
    const start = source.indexOf('const current = await getCustomerInfo(revenueCatOwner);');
    const end = source.indexOf("devWarn('[revenuecat] initial entitlement update failed'", start);
    const initial = source.slice(start, end);

    expect(start).toBeGreaterThan(-1);
    expect(end).toBeGreaterThan(start);
    expect(initial).toContain(
      'await acceptTrustedRevenueCatEntitlement(classified.entitlement)',
    );
    expect(initial).toContain(
      'await acceptRevenueCatVerifiedEmpty(classified.emptyEvidence)',
    );
    expect(initial.indexOf('publishEntitlementQueryAcceptance(')).toBeLessThan(
      initial.indexOf('deferEntitlementTrialReminder(ownerScope, published);'),
    );
    expect(initial.indexOf('deferEntitlementTrialReminder(ownerScope, published);')).toBeLessThan(
      initial.indexOf('await queryClient.invalidateQueries({'),
    );
    expect(initial).toContain('lease.assertCurrent();');
    expect(initial).toContain('if (!canWriteForUser()) return;');
  });
});
