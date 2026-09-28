import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

const AUTH_DIR = fileURLToPath(new URL('./', import.meta.url));
const provider = readFileSync(`${AUTH_DIR}/AuthProvider.tsx`, 'utf8');

describe('AuthProvider account deletion barrier integration', () => {
  it('preflights every candidate session before local ownership or session publication', () => {
    const start = provider.indexOf('function applySessionBoundary(');
    const end = provider.indexOf('applySessionBoundaryRef.current = applySessionBoundary;');
    const boundary = provider.slice(start, end);

    expect(boundary).toContain('nextSession !== null ||');
    expect(boundary.indexOf('fetchAccountDeletionBarrierState(')).toBeLessThan(
      boundary.indexOf('prepareLocalDataForSession('),
    );
    expect(boundary.indexOf('fetchAccountDeletionBarrierState(')).toBeLessThan(
      boundary.indexOf('setSession(latestPendingSession)'),
    );
    expect(boundary).toContain("if (barrierState.status === 'active') {");
    expect(boundary).toContain(
      'const localDataDecision = await activeAccountDeletionOwnsLocalData(',
    );
    expect(boundary).toContain('barrierState.ownerSubject,');
    expect(boundary).toContain('if (transitionSession.user.id !== barrierState.ownerSubject) {');
    expect(boundary).toContain('targetUserId = barrierState.ownerSubject;');
    expect(
      boundary.indexOf('if (transitionSession.user.id !== barrierState.ownerSubject) {'),
    ).toBeLessThan(boundary.indexOf('prepareLocalDataForSession('));
    expect(boundary.indexOf('targetUserId = barrierState.ownerSubject;')).toBeLessThan(
      boundary.indexOf('setSession(latestPendingSession)'),
    );
    expect(boundary).toContain('await handleRejectedSession();');
    expect(boundary).toContain('await handleAccountDeletionBarrierActive(localDataDecision);');
  });

  it('uses the canonical full ownership proof rather than reading the owner key alone', () => {
    expect(provider).toContain('const activeAccountDeletionOwnerProofDependencies = {');
    expect(provider).toContain('readLocalDataOwnership,');
    expect(provider).not.toContain('LOCAL_DATA_OWNER_HASH_KEY');
    expect(provider).not.toContain('AsyncStorage.getItem');
  });

  it('always rejects active-barrier Auth/vendor state but makes private cleanup owner-conditional', () => {
    const start = provider.indexOf('function handleAccountDeletionBarrierActive(');
    const end = provider.indexOf('function applySessionBoundary(', start);
    const boundary = provider.slice(start, end);

    expect(boundary).toContain(
      "let resumeAuthorizedPrivateCleanup = localDataDecision === 'clear';",
    );
    expect(boundary).toContain('await markLocalDataCleanupRequired();');
    expect(boundary).toContain('(await preserveLocalDataForForcedSignOut())');
    expect(boundary).toContain('accountDeletionLocalSignOutAttempted = true;');
    expect(boundary).not.toContain('supabase.auth.signOut(');
    expect(boundary.indexOf('await markLocalDataCleanupRequired();')).toBeLessThan(
      boundary.indexOf('await clearRejectedSessionActivityDurably({'),
    );
    expect(boundary.indexOf('(await preserveLocalDataForForcedSignOut())')).toBeLessThan(
      boundary.indexOf('await clearRejectedSessionActivityDurably({'),
    );
    expect(boundary).toContain('clearPersistedSession: clearPersistedSessionAfterRemoteDrain');
    expect(boundary).toContain(
      '...(resumeAuthorizedPrivateCleanup ? { clearAccountIsolatedState } : {}),',
    );
    expect(boundary).toContain(
      'clearAuthDerivedLocalActivity(revokedCredentialActivityDependencies)',
    );
    expect(boundary).toContain('accountDeletionBarrierBoundaryActive = false;');
    expect(boundary).toContain('releaseSessionBoundaryWriteLock();');
    expect(boundary).toContain('setSessionBoundaryError(false);');
    expect(boundary).toContain('retrySessionRestoreRef.current');
    expect(boundary).toContain('setSessionBoundaryError(true);');
    expect(boundary).not.toContain('prepareLocalDataForSession');
    expect(boundary).not.toContain('clearLocalPrivateData');
    expect(boundary).not.toMatch(/operationId|capability|providerState/);
  });

  it('finishes an exact 401 as signed out without erasing unattested owner-bound records', () => {
    const start = provider.indexOf('function handleRejectedSession()');
    const end = provider.indexOf('function handleAccountDeletionBarrierActive(', start);
    const boundary = provider.slice(start, end);

    expect(boundary).toContain(
      'const localDataAction = await preserveLocalDataForForcedSignOut();',
    );
    expect(
      boundary.indexOf('const localDataAction = await preserveLocalDataForForcedSignOut();'),
    ).toBeLessThan(boundary.indexOf('await clearRejectedSessionActivityDurably({'));
    expect(boundary).toContain('rejectedSessionLocalSignOutAttempted = true;');
    expect(boundary).not.toContain('supabase.auth.signOut(');
    expect(boundary).toContain('clearPersistedSession: clearPersistedSessionAfterRemoteDrain');
    expect(boundary).toContain(
      'clearAuthDerivedLocalActivity(revokedCredentialActivityDependencies)',
    );
    expect(boundary).toContain('releaseSessionBoundaryWriteLock();');
    expect(boundary).toContain('setSessionBoundaryError(false);');
    expect(boundary).toContain(
      "...(localDataAction === 'resume-cleanup' ? { clearAccountIsolatedState } : {}),",
    );
    expect(boundary).not.toContain('prepareLocalDataForSession');
    expect(boundary).not.toContain('clearLocalPrivateData');
  });

  it('ignores sign-out auth events while the rejection boundary owns cleanup', () => {
    expect(provider).toContain('if (accountDeletionBarrierBoundaryActive) return;');
    expect(provider).toContain('if (rejectedSessionBoundaryActive) return;');
    expect(provider).toContain('accountDeletionBarrierBoundaryActive = true;');
    expect(provider).toContain('accountDeletionBarrierBoundaryActive = false;');
  });
});
