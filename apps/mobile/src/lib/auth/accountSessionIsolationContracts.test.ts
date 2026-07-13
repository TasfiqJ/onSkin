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
    const supabaseClient = readSource('lib/supabase/client.ts');

    expect(provider).toContain('await prepareLocalDataForSession(');
    expect(provider).toContain('beginPrivateKVAccountBoundary();');
    expect(provider).toContain('beginAccountGenerationBoundary();');
    expect(provider).toContain('await waitForAccountGenerationOperationsToSettle();');
    expect(provider).toContain('await waitForPrivateKVWritesToSettle();');
    expect(provider).toContain('if (previousTransition) await previousTransition;');
    expect(provider).toContain('existing.effectEpoch === effectEpoch');
    expect(provider).toContain('return applySessionBoundary(nextSession, initialRestore);');
    expect(provider).toContain('retrySessionRestoreRef.current = restoreSession;');
    expect(provider).toContain('if (sessionError) throw sessionError;');
    expect(provider).toContain('invalidateLocalSupabaseSession()');
    expect(provider).not.toContain('clearPersistedSupabaseSession()');
    expect(provider).toContain('latestSessionForCompletedBoundary(');
    expect(provider).toContain(
      'void applySessionBoundary(accountIsolationE2EFixture.session, true);',
    );
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
    expect(actions).toContain('await completeLocalSignOut();');
    expect(actions).not.toContain('clearAccountIsolatedState');
    expect(supabaseClient).toContain('export async function clearPersistedSupabaseSession');
    expect(supabaseClient).toContain('export async function invalidateLocalSupabaseSession');
    expect(supabaseClient).toContain("supabase.auth.signOut({ scope: 'local' })");
    expect(supabaseClient.indexOf("supabase.auth.signOut({ scope: 'local' })")).toBeLessThan(
      supabaseClient.lastIndexOf('await clearPersistedSupabaseSession();'),
    );
    expect(supabaseClient).toContain('storageKey: authStorageKey');
  });
});
