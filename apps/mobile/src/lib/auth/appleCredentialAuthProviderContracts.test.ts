import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

const AUTH_DIR = fileURLToPath(new URL('./', import.meta.url));

function source(name: string): string {
  return readFileSync(`${AUTH_DIR}/${name}`, 'utf8');
}

describe('AuthProvider Apple credential revocation integration', () => {
  it('registers the native lifecycle only for a published configured session', () => {
    const provider = source('AuthProvider.tsx');

    expect(provider).toContain('return monitorAppleCredentialRevocation(session.user, {');
    expect(provider).toContain('accountIsolationE2EFixture ||');
    expect(provider).toContain('!session?.user');
  });

  it('resumes only pre-authorized cleanup or preserves local data before sign-out', () => {
    const provider = source('AuthProvider.tsx');
    const start = provider.indexOf('function handleAppleCredentialInvalid(');
    const end = provider.indexOf('handleAppleCredentialInvalidRef.current =');
    const boundary = provider.slice(start, end);

    expect(start).toBeGreaterThan(-1);
    expect(end).toBeGreaterThan(start);
    expect(
      boundary.indexOf('persistInvalidationMarker: () => markAppleCredentialQuarantined()'),
    ).toBeLessThan(boundary.indexOf('async signOut() {'));
    expect(boundary).toContain('await revokeSupabaseRefreshTokens(invalidatedBinding);');
    expect(boundary).not.toContain('supabase.auth.signOut(');
    expect(boundary).toContain('clearRejectedSessionActivityDurably({');
    expect(boundary).toContain(
      'const localDataAction = await preserveLocalDataForForcedSignOut();',
    );
    expect(boundary).toContain(
      "...(localDataAction === 'resume-cleanup' ? { clearAccountIsolatedState } : {}),",
    );
    expect(boundary).toContain(
      'clearAuthDerivedLocalActivity(revokedCredentialActivityDependencies)',
    );
    expect(boundary).not.toContain('prepareLocalDataForSession');
    expect(boundary).not.toContain('clearLocalPrivateData');
  });

  it('honors durable quarantine before restore and clears it only inside a fresh owner boundary', () => {
    const provider = source('AuthProvider.tsx');
    const restoreStart = provider.indexOf('async function restoreSession()');
    const restore = provider.slice(
      restoreStart,
      provider.indexOf('if (accountIsolationE2EFixture)', restoreStart),
    );
    const apply = provider.slice(
      provider.indexOf('function applySessionBoundary('),
      provider.indexOf('applySessionBoundaryRef.current = applySessionBoundary;'),
    );

    expect(restore.indexOf('isAppleCredentialQuarantined()')).toBeLessThan(
      restore.indexOf('readPersistedSupabaseSessionCandidate()'),
    );
    expect(restore.indexOf('checkAppleCredentialForSession(restoredSession.user)')).toBeLessThan(
      restore.indexOf('applySessionBoundary(restoredSession, true)'),
    );
    const restoreEventGuard = provider.slice(
      provider.indexOf('if (initialSessionRestorePendingRef.current) {'),
      provider.indexOf('if (appleRevocationBoundaryActive) return;'),
    );
    expect(restoreEventGuard).toContain('initialSessionRestoreRereadRequested = true;');
    expect(restoreEventGuard).toContain('sessionChangeSeqRef.current += 1;');
    expect(restoreEventGuard).toContain('showSessionBoundary(null);');
    const authSubscription = provider.indexOf('supabase.auth.onAuthStateChange(');
    expect(authSubscription).toBeLessThan(
      provider.indexOf('void restoreSession();', authSubscription),
    );
    expect(apply.indexOf('prepareLocalDataForSession(')).toBeLessThan(
      apply.indexOf('clearAppleCredentialQuarantine()'),
    );
    expect(apply.indexOf('rescheduleReminders()')).toBeLessThan(
      apply.indexOf('clearAppleCredentialQuarantine()'),
    );
    expect(apply.indexOf('clearAppleCredentialQuarantine()')).toBeLessThan(
      apply.indexOf('setSession(latestPendingSession)'),
    );
  });

  it('keeps unknown and failed Apple checks behind the retryable session gate', () => {
    const provider = source('AuthProvider.tsx');
    const start = provider.indexOf('function handleAppleCredentialCheckBlocked(');
    const end = provider.indexOf(
      'handleAppleCredentialCheckBlockedRef.current = handleAppleCredentialCheckBlocked;',
    );
    const boundary = provider.slice(start, end);

    expect(boundary).toContain('showSessionBoundary(blockedSession);');
    expect(boundary).toContain('retrySessionRestoreRef.current =');
    expect(boundary).toContain('retryAppleCredentialCheck(blockedSession)');
    expect(boundary).toContain('setSessionBoundaryError(true);');
    expect(boundary).not.toContain('markAppleCredentialQuarantined()');
    expect(boundary).not.toContain("supabase.auth.signOut({ scope: 'global' })");
  });

  it('keeps Supabase refresh stopped without a published, ungated session', () => {
    const provider = source('AuthProvider.tsx');

    expect(provider).toContain('published &&');
    expect(provider).toContain('!sessionBoundaryActiveRef.current &&');
    expect(provider).toContain('hasActiveRevenueCatPublication(published.user.id');
    expect(provider).toContain('supabase.auth.stopAutoRefresh();');
    expect(provider).toContain('}, [accountIsolationE2EFixture]);');
  });
});
