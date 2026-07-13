import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

const AUTH_PROVIDER_SOURCE = fileURLToPath(new URL('./AuthProvider.tsx', import.meta.url));

describe('AuthProvider account-deletion vendor freeze contract', () => {
  it('hydrates the durable receipt before publishing a session or configuring RevenueCat', () => {
    const source = readFileSync(AUTH_PROVIDER_SOURCE, 'utf8');
    const boundaryBlock = source.indexOf('blockAccountDeletionVendorWritesUntilHydrated();');
    const reconcile = source.indexOf('await reconcileAccountDeletionCompletionReceipt();');
    const hydrate = source.indexOf(
      'await hydrateAccountDeletionVendorFreeze(resolvedTargetUserId);',
    );
    const publish = source.indexOf('setSession(latestPendingSession);', hydrate);
    const configureRevenueCat = source.indexOf('await configureRevenueCat(userId);', publish);

    expect(boundaryBlock).toBeGreaterThan(-1);
    expect(reconcile).toBeGreaterThan(boundaryBlock);
    expect(hydrate).toBeGreaterThan(reconcile);
    expect(publish).toBeGreaterThan(hydrate);
    expect(configureRevenueCat).toBeGreaterThan(publish);
  });

  it('forces a signed-out cleanup boundary after a terminal response-loss receipt', () => {
    const source = readFileSync(AUTH_PROVIDER_SOURCE, 'utf8');
    const reconcile = source.indexOf('await reconcileAccountDeletionCompletionReceipt();');
    const forceSignedOut = source.indexOf('resolvedSession = null;', reconcile);
    const invalidateLocalSession = source.indexOf(
      'await invalidateLocalSupabaseSession();',
      reconcile,
    );
    const prepare = source.indexOf('prepareLocalDataForSession(', reconcile);
    const forcedCleanup = source.indexOf('if (deletionCompleted && !result.cleared)', prepare);
    const publish = source.indexOf('setSession(latestPendingSession);', forcedCleanup);

    expect(reconcile).toBeGreaterThan(-1);
    expect(forceSignedOut).toBeGreaterThan(reconcile);
    expect(invalidateLocalSession).toBeGreaterThan(forceSignedOut);
    expect(prepare).toBeGreaterThan(invalidateLocalSession);
    expect(forcedCleanup).toBeGreaterThan(prepare);
    expect(publish).toBeGreaterThan(forcedCleanup);
  });
});
