import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

const REVENUECAT_SOURCE = fileURLToPath(new URL('./revenuecat.ts', import.meta.url));

describe('RevenueCat identity boundary', () => {
  it('gates RevenueCat writes on the durable deletion receipt', () => {
    const source = readFileSync(REVENUECAT_SOURCE, 'utf8');

    expect(source).toContain('if (accountDeletionVendorWritesBlocked()) return null;');
    expect(source).toContain('export async function freezeRevenueCatIdentityForAccountDeletion');
    expect(source).toContain('export async function resetRevenueCatIdentity');
    expect(source).toContain('identityCoordinator.reset');
    expect(source).toContain('identityCoordinator.configureFor');
    expect(source).toContain('() => !accountDeletionVendorWritesBlocked()');
    expect(source).toContain('identityCoordinator.currentUserId()');
    expect(source).toContain('configurePromise = null');
    expect(source).toContain('cachedOfferings = null');
    expect(source).toContain('accountDeletionVendorWritesBlocked()');
    expect(source).not.toContain('let accountDeletionWritesFrozen');

    for (const [startNeedle, nativeWrite] of [
      [
        'export async function configureRevenueCat',
        'identityCoordinator.configureFor(',
      ],
      ['export async function purchasePackage', 'Purchases.purchasePackage(selectedPackage)'],
      [
        'export async function purchaseWinBackPackage',
        'Purchases.purchasePackageWithWinBackOffer',
      ],
      ['export async function restorePurchases', 'Purchases.restorePurchases()'],
    ]) {
      const start = source.indexOf(startNeedle);
      const write = source.indexOf(nativeWrite, start);
      const finalGate = source.lastIndexOf('accountDeletionVendorWritesBlocked()', write);
      expect(start).toBeGreaterThan(-1);
      expect(write).toBeGreaterThan(start);
      expect(finalGate).toBeGreaterThan(start);
      expect(finalGate).toBeLessThan(write);
    }
  });
});
