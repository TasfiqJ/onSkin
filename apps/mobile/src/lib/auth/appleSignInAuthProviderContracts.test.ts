import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

const AUTH_PROVIDER = fileURLToPath(new URL('./AuthProvider.tsx', import.meta.url));

describe('AuthProvider Apple sign-in contract', () => {
  it('keeps cancellation neutral and delegates the complete one-use credential', () => {
    const provider = readFileSync(AUTH_PROVIDER, 'utf8');
    const start = provider.indexOf('async signInWithApple()');
    const end = provider.indexOf('async signInWithGoogle()', start);
    const appleSignIn = provider.slice(start, end);

    expect(start).toBeGreaterThan(-1);
    expect(end).toBeGreaterThan(start);
    expect(appleSignIn).toContain('const result = await getAppleIdToken();');
    expect(appleSignIn).toContain('if (!result) return false;');
    expect(appleSignIn).toContain(
      'authenticateWithAppleCredential(supabase.auth, session, result)',
    );
    expect(appleSignIn).toContain('{ rejectSessionOnFailure: true }');
  });

  it('publishes a deferred Auth callback only after semantic success', () => {
    const provider = readFileSync(AUTH_PROVIDER, 'utf8');
    const start = provider.indexOf('const runFreshAuthentication = async');
    const end = provider.indexOf('const completeExplicitSignOut', start);
    const semanticBoundary = provider.slice(start, end);

    expect(start).toBeGreaterThan(-1);
    expect(end).toBeGreaterThan(start);
    expect(semanticBoundary).toContain('let completed = false;');
    expect(semanticBoundary).toContain('completed = true;');
    expect(semanticBoundary).toContain('if (!completed && options.rejectSessionOnFailure)');
    expect(semanticBoundary).toContain('await handleRejectedSessionRef.current();');
    expect(semanticBoundary.indexOf('completed = true;')).toBeLessThan(
      semanticBoundary.indexOf('applySessionBoundaryRef.current(deferred.session)'),
    );
  });
});
