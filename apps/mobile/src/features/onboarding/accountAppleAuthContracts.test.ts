import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

const ACCOUNT_ROUTE = fileURLToPath(new URL('../../app/onboarding/account.tsx', import.meta.url));

function accountSource(): string {
  return readFileSync(ACCOUNT_ROUTE, 'utf8');
}

describe('account-screen Apple authentication contracts', () => {
  it('renders the native Apple control only after the platform availability check succeeds', () => {
    const source = accountSource();

    expect(source).toContain("import { isAppleAuthAvailable } from '@/lib/auth/apple';");
    expect(source).toContain('void isAppleAuthAvailable()');
    expect(source).toContain("Platform.OS === 'ios' && appleAuthAvailable");
    expect(source).not.toContain("{Platform.OS === 'ios' ? (");
  });

  it('uses a synchronous admission ref and disables navigation during an auth operation', () => {
    const source = accountSource();
    const admissionCheck = source.indexOf('if (operationPendingRef.current) return;');
    const admissionClaim = source.indexOf('operationPendingRef.current = true;');
    const busyPublication = source.indexOf('setBusy(true);');

    expect(admissionCheck).toBeGreaterThan(-1);
    expect(admissionCheck).toBeLessThan(admissionClaim);
    expect(admissionClaim).toBeLessThan(busyPublication);
    expect(source).toContain("pointerEvents={busy ? 'none' : 'auto'}");
    expect(source).toContain('accessibilityState={{ disabled: busy }}');
    expect(source.match(/disabled={busy}/g)?.length).toBeGreaterThanOrEqual(3);
    expect(source.match(/if \(operationPendingRef\.current\) return;/g)).toHaveLength(3);
  });
});
