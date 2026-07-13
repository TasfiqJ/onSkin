import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

const REVENUECAT_SOURCE = fileURLToPath(new URL('./revenuecat.ts', import.meta.url));

describe('RevenueCat identity boundary', () => {
  it('keeps an explicit account-boundary logout and cache reset', () => {
    const source = readFileSync(REVENUECAT_SOURCE, 'utf8');

    expect(source).toContain('export async function resetRevenueCatIdentity');
    expect(source).toContain('identityCoordinator.reset');
    expect(source).toContain('identityCoordinator.configureFor');
    expect(source).toContain('identityCoordinator.currentUserId()');
    expect(source).toContain('configurePromise = null');
    expect(source).toContain('cachedOfferings = null');
  });
});
