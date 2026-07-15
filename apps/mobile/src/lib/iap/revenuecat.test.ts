import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

const REVENUECAT_SOURCE = fileURLToPath(new URL('./revenuecat.ts', import.meta.url));

describe('RevenueCat identity boundary', () => {
  it('seals local provider access behind the drain without creating an anonymous customer', () => {
    const source = readFileSync(REVENUECAT_SOURCE, 'utf8');

    expect(source).toContain('export async function resetRevenueCatIdentity');
    expect(source).toContain("accountPublicationController.beginDrain('account_boundary')");
    expect(source).toContain('async function rawSealRevenueCatIdentity');
    expect(source).not.toContain('Purchases.logOut(');
    expect(source).not.toContain('Purchases.configure({ apiKey });');
    expect(source).toContain('appUserID: appUserId');
    expect(source).toContain('Purchases.ENTITLEMENT_VERIFICATION_MODE.INFORMATIONAL');
    expect(source).toContain('await Purchases.logIn(appUserId);');
    expect(source).toContain('configuredBinding = null');
    expect(source).toContain('configurePromise = null');
    expect(source).toContain('cachedOfferings = null');
  });

  it('gates every provider-facing flow and rejects stale result writes', () => {
    const source = readFileSync(REVENUECAT_SOURCE, 'utf8');

    for (const kind of [
      'configure',
      'offering',
      'purchase',
      'restore',
      'customer_info',
      'listener',
      'entitlement_write',
      'manage_subscription',
    ]) {
      expect(source).toContain(`'${kind}'`);
    }
    expect(source).toContain('ticket.assertCurrent()');
    expect(source).toContain('assertRevenueCatResultCurrent(result)');
    expect(source).toContain('ACCOUNT_PUBLICATION_STOREKIT_COMPLETION_UNCONFIRMED');
    expect(source).toContain('registerProviderListener(ticket');
    expect(source).toContain('await listener(customerInfo);');
  });

  it('rechecks publication authority after every lazy RevenueCat module load', () => {
    const source = readFileSync(REVENUECAT_SOURCE, 'utf8');
    const lazyLoads = source.match(/const Purchases = await loadPurchases\(\);/g) ?? [];
    const guardedLazyLoads =
      source.match(
        /const Purchases = await loadPurchases\(\);\r?\n\s+ticket\.assertCurrent\(\);/g,
      ) ?? [];

    expect(lazyLoads).toHaveLength(2);
    expect(guardedLazyLoads).toHaveLength(lazyLoads.length);
  });
});
