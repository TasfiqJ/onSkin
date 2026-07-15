import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

const AUTH_PROVIDER_SOURCE = fileURLToPath(new URL('./AuthProvider.tsx', import.meta.url));

describe('AuthProvider account-deletion vendor freeze contract', () => {
  it('hydrates the durable receipt and proves the native owner before session publication', () => {
    const source = readFileSync(AUTH_PROVIDER_SOURCE, 'utf8');
    const boundaryBlock = source.indexOf('blockAccountDeletionVendorWritesUntilHydrated();');
    const reconcile = source.indexOf('await reconcileAccountDeletionCompletionReceipt();');
    const hydrate = source.indexOf(
      'const revenueCatFreezeState = await hydrateAccountDeletionVendorFreeze(',
    );
    const nativeOwnerProof = source.indexOf(
      'await prepareRevenueCatIdentityForSessionPublication(',
      hydrate,
    );
    const frozenRequiresAnonymous = source.indexOf(
      "revenueCatFreezeState === 'frozen' ? null : resolvedTargetUserId",
      nativeOwnerProof,
    );
    const publish = source.indexOf('setSession(latestPendingSession);', nativeOwnerProof);
    const configureRevenueCat = source.indexOf(
      'await configureRevenueCat(revenueCatOwner);',
      publish,
    );

    expect(boundaryBlock).toBeGreaterThan(-1);
    expect(reconcile).toBeGreaterThan(boundaryBlock);
    expect(hydrate).toBeGreaterThan(reconcile);
    expect(nativeOwnerProof).toBeGreaterThan(hydrate);
    expect(frozenRequiresAnonymous).toBeGreaterThan(nativeOwnerProof);
    expect(publish).toBeGreaterThan(frozenRequiresAnonymous);
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

  it('binds RevenueCat reads and listener writes to the published owner generation', () => {
    const source = readFileSync(AUTH_PROVIDER_SOURCE, 'utf8');
    const effect = source.indexOf('const revenueCatOwner = { appUserId: userId, lease } as const;');
    const configure = source.indexOf('await configureRevenueCat(revenueCatOwner);', effect);
    const listenerGeneration = source.indexOf(
      'const listenerGeneration = lease.generation;',
      configure,
    );
    const subscribe = source.indexOf(
      'subscribeToCustomerInfoUpdates(revenueCatOwner',
      listenerGeneration,
    );
    const callbackOperation = source.indexOf(
      'runAccountGenerationOperation(async (callbackLease)',
      subscribe,
    );
    const callbackOwnerCheck = source.indexOf(
      'callbackLease.generation !== listenerGeneration',
      callbackOperation,
    );
    const read = source.indexOf('await getCustomerInfo(revenueCatOwner);', callbackOwnerCheck);

    expect(effect).toBeGreaterThan(-1);
    expect(configure).toBeGreaterThan(effect);
    expect(listenerGeneration).toBeGreaterThan(configure);
    expect(subscribe).toBeGreaterThan(listenerGeneration);
    expect(callbackOperation).toBeGreaterThan(subscribe);
    expect(callbackOwnerCheck).toBeGreaterThan(callbackOperation);
    expect(read).toBeGreaterThan(callbackOwnerCheck);
  });
});
