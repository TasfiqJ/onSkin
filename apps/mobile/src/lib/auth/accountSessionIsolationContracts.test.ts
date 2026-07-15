import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

const SRC_DIR = fileURLToPath(new URL('../../', import.meta.url));

function readSource(path: string): string {
  return readFileSync(`${SRC_DIR}/${path}`, 'utf8');
}

describe('account session isolation integration', () => {
  it('unmounts every data-bearing provider and route during account transitions', () => {
    const root = readSource('app/_layout.tsx');
    const gate = readSource('lib/auth/SessionBoundaryGate.tsx');

    expect(root).toContain("import { SessionBoundaryGate } from '@/lib/auth/SessionBoundaryGate';");
    expect(root.indexOf('<AuthProvider>')).toBeLessThan(root.indexOf('<SessionBoundaryGate>'));
    expect(root.indexOf('<SessionBoundaryGate>')).toBeLessThan(root.indexOf('<AppLockProvider>'));
    expect(root.indexOf('<SessionBoundaryGate>')).toBeLessThan(root.indexOf('<OfflineSync />'));
    expect(root.indexOf('<SessionBoundaryGate>')).toBeLessThan(
      root.indexOf('<Stack screenOptions={{ headerShown: false }} />'),
    );
    expect(gate).toContain('if (!initializing && !sessionBoundaryError) return children;');
    expect(gate).toContain("loading: 'Securing account data...'");
    expect(gate).toContain("eyebrow: 'Account access paused'");
    expect(gate).toContain(
      "body: 'Your account data is still locked. Try again to continue safely.'",
    );
    expect(gate).not.toContain('private data could not be cleared');
    expect(gate).toContain('accessibilityRole="alert"');
    expect(gate).toContain('void retrySessionBoundary()');
    expect(gate).toContain('min-h-[56px]');
  });

  it('drains private writes, clears query memory, and keeps failed cleanup gated', () => {
    const provider = readSource('lib/auth/AuthProvider.tsx');
    const isolation = readSource('lib/auth/localAccountIsolation.ts');
    const accountGeneration = readSource('lib/auth/accountGeneration.ts');
    const privateKV = readSource('lib/storage/privateKV.ts');
    const actions = readSource('features/settings/actions.ts');
    const deletionBarrier = readSource('features/settings/accountDeletionBarrier.ts');
    const entitlementStore = readSource('features/subscription/store.ts');
    const useEntitlement = readSource('features/subscription/useEntitlement.ts');
    const supabaseClient = readSource('lib/supabase/client.ts');

    expect(provider).toContain('await prepareLocalDataForSession(');
    expect(provider).toContain('beginPrivateKVAccountBoundary();');
    expect(provider).toContain('beginAccountGenerationBoundary();');
    expect(provider).toContain('await waitForAccountGenerationOperationsToSettle();');
    expect(provider).toContain('await waitForPrivateKVWritesToSettle();');
    expect(provider).toContain('if (previousTransition) await previousTransition;');
    expect(provider).toContain('retrySessionRestoreRef.current = restoreSession;');
    expect(provider).toContain('await readPersistedSupabaseSessionCandidate();');
    expect(provider).toContain('await clearPersistedSessionAfterRemoteDrain();');
    expect(provider).toContain('await awaitRemoteRequestAuthorityClosed();');
    expect(provider).toContain('latestSessionForCompletedBoundary(');
    expect(provider).toContain('setSessionBoundaryError(true);');
    expect(provider).toContain("router.replace('/');");
    expect(provider).toContain('activeUserIdRef.current === userId');
    expect(isolation.match(/queryCache\.clear\(\)/g)).toHaveLength(2);
    expect(isolation).toContain('dependencies.markCleanupRequired()');
    expect(isolation).toContain('dependencies.clearCleanupRequired()');
    expect(isolation).toContain('dependencies.clearPersistedPrivateData()');
    expect(isolation).toContain('beginAccountGenerationBoundary();');
    expect(isolation).toContain('waitForAccountGenerationOperationsToSettle()');
    expect(accountGeneration).toContain('controller.abort()');
    expect(accountGeneration).toContain('generation !== accountGeneration');
    expect(privateKV).toContain('PRIVATE_KV_WRITE_BLOCKED_ACCOUNT_BOUNDARY');
    expect(privateKV).toContain('generation !== accountBoundaryGeneration');
    expect(privateKV).toContain('return runAccountScopedPrivateOperation');
    const capture = actions.indexOf('runAccountGenerationOperation(async (lease) =>');
    const journalRead = actions.indexOf('assertStoreTransactionDeletionJournalReadable(');
    const intakeHold = actions.indexOf(
      'startDeletionIntakeHandoff(owner.user.id, owner.remoteBinding)',
    );
    const exactQuiescence = actions.indexOf('await quiescing.publicationQuiescence;');
    const durablePrepare = actions.indexOf(
      'preparePendingAccountDeletion(quiescing.owner.ownerBinding)',
    );
    const releaseHold = actions.indexOf('releasePreparedIntakeHold();');
    const transport = actions.indexOf('const result = await invokeAccountDeletionWithDeadline(');
    expect(capture).toBeGreaterThan(-1);
    expect(journalRead).toBeGreaterThan(capture);
    expect(intakeHold).toBeGreaterThan(journalRead);
    expect(exactQuiescence).toBeGreaterThan(intakeHold);
    expect(durablePrepare).toBeGreaterThan(exactQuiescence);
    expect(releaseHold).toBeGreaterThan(durablePrepare);
    expect(transport).toBeGreaterThan(releaseHold);
    expect(deletionBarrier).toContain(
      'return durableAccountActivityBlocked || deletionIntakeHoldCount > 0;',
    );
    expect(provider).toContain('subscribeToAccountDeletionIntakeHold((active) =>');
    expect(provider).toContain('if (accountDeletionIntakeBoundaryActiveRef.current)');
    expect(provider).toContain("if (event === 'TOKEN_REFRESHED') {");
    expect(provider).toContain('void Promise.resolve().then(() => handleRejectedSessionRef.current());');
    expect(actions).toContain('Authorization: `Bearer ${owner.accessToken}`');
    expect(actions).toContain('requestAccountDeletionRecovery();');
    expect(actions).not.toContain('await _completeLocalSignOut()');
    expect(actions).not.toContain('clearAccountIsolatedState');
    expect(
      entitlementStore.match(/runAccountGenerationOperation\(async \(lease\) =>/g),
    ).toHaveLength(2);
    expect(entitlementStore).toContain('fetchServerEvidence(context, lease.signal)');
    expect(entitlementStore).toContain('.abortSignal(signal)');
    expect(entitlementStore).toContain('signal: lease.signal');
    expect(useEntitlement).toContain(
      'queryFn: () =>\n      runAccountGenerationOperation(async (lease) =>',
    );
    expect(useEntitlement.match(/lease\.assertCurrent\(\);/g)?.length).toBeGreaterThanOrEqual(3);
    expect(supabaseClient).toContain('export async function clearPersistedSupabaseSession');
    expect(supabaseClient).toContain('storageKey: authStorageKey');
  });
});
