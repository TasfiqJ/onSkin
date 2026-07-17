import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

const provider = readFileSync(
  fileURLToPath(new URL('./AuthProvider.tsx', import.meta.url)),
  'utf8',
);

function functionSlice(startNeedle: string, endNeedle: string): string {
  const start = provider.indexOf(startNeedle);
  const end = provider.indexOf(endNeedle, start + startNeedle.length);
  expect(start).toBeGreaterThanOrEqual(0);
  expect(end).toBeGreaterThan(start);
  return provider.slice(start, end);
}

function expectDurableCleanupOrdering(source: string): void {
  const durableCleanup = source.indexOf('await clearRejectedSessionActivityDurably({');
  const mark = source.indexOf('markAuthDerivedCleanupRequired,', durableCleanup);
  const signOut = source.indexOf('async signOut() {', durableCleanup);
  const clearMarker = source.indexOf('clearAuthDerivedCleanupRequired,', durableCleanup);
  const storageClear = source.indexOf(
    'clearPersistedSession: clearPersistedSessionAfterRemoteDrain',
    durableCleanup,
  );

  expect(durableCleanup).toBeGreaterThanOrEqual(0);
  expect(mark).toBeGreaterThanOrEqual(0);
  expect(clearMarker).toBeGreaterThan(mark);
  expect(signOut).toBeGreaterThan(durableCleanup);
  expect(storageClear).toBeGreaterThan(signOut);
  expect(source).not.toContain("supabase.auth.signOut({ scope: 'local' })");
}

describe('AuthProvider durable auth-derived cleanup recovery', () => {
  it('includes native widget and encrypted action-capability kill lanes in the canonical dependency set', () => {
    const dependencies = functionSlice(
      'const revokedCredentialActivityDependencies = {',
      'const activeAccountDeletionOwnerProofDependencies = {',
    );
    expect(dependencies).toContain(
      'clearRoutineWidgetNativeState: clearRoutineWidgetLifecycleForPrivacy,',
    );
    expect(dependencies).toContain('clearRoutineWidgetActions,');
  });

  it('commits crash recovery before every forced sign-out and clears it only after cleanup', () => {
    expectDurableCleanupOrdering(
      functionSlice(
        'function handleAppleCredentialInvalid(',
        'function handleAppleCredentialCheckBlocked(',
      ),
    );
    expectDurableCleanupOrdering(
      functionSlice(
        'function handleRejectedSession()',
        'function handleAccountDeletionBarrierActive(',
      ),
    );
    expectDurableCleanupOrdering(
      functionSlice(
        'function handleAccountDeletionBarrierActive(',
        'function applySessionBoundary(',
      ),
    );
  });

  it('retries a persisted cleanup marker before reading or publishing a restored session', () => {
    const restore = functionSlice(
      'async function restoreSession()',
      'if (accountIsolationE2EFixture)',
    );
    const markerRead = restore.indexOf('await readAuthDerivedCleanupRequired()');
    const cleanup = restore.indexOf('await handleRejectedSession();', markerRead);
    const sessionRead = restore.indexOf('await readPersistedSupabaseSessionCandidate()');

    expect(markerRead).toBeGreaterThanOrEqual(0);
    expect(cleanup).toBeGreaterThan(markerRead);
    expect(sessionRead).toBeGreaterThan(cleanup);
  });
});
