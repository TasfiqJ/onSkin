import { readFileSync } from 'node:fs';

import { describe, expect, it } from 'vitest';

const authProviderSource = readFileSync(new URL('./AuthProvider.tsx', import.meta.url), 'utf8');
const entitlementActionsSource = readFileSync(
  new URL('../../features/subscription/useEntitlement.ts', import.meta.url),
  'utf8',
);

describe('first-session E2E AuthProvider contracts', () => {
  it('claims durable local ownership before publishing the synthetic anonymous session', () => {
    const fixtureBranch = authProviderSource.indexOf('if (!isSupabaseConfigured) {');
    const claim = authProviderSource.indexOf(
      'await claimLocalDataOwnership(firstSessionE2EFixture.session.user.id)',
      fixtureBranch,
    );
    const publish = authProviderSource.indexOf(
      'setSession(firstSessionE2EFixture.session)',
      fixtureBranch,
    );

    expect(fixtureBranch).toBeGreaterThan(-1);
    expect(claim).toBeGreaterThan(fixtureBranch);
    expect(publish).toBeGreaterThan(claim);
  });

  it('does not resolve age activation before the synthetic owner is committed to consumers', () => {
    const fixtureBranch = authProviderSource.indexOf('if (!isSupabaseConfigured) {');
    const committed = authProviderSource.indexOf(
      'const committed = new Promise<void>',
      fixtureBranch,
    );
    const publish = authProviderSource.indexOf(
      'setSession(firstSessionE2EFixture.session)',
      fixtureBranch,
    );
    const awaitCommit = authProviderSource.indexOf('await committed', fixtureBranch);

    expect(committed).toBeGreaterThan(fixtureBranch);
    expect(publish).toBeGreaterThan(committed);
    expect(awaitCommit).toBeGreaterThan(publish);
  });

  it('does not attach the synthetic session to the RevenueCat publication bridge', () => {
    expect(authProviderSource).toMatch(
      /if\s*\(\s*!userId\s*\|\|\s*!accessToken\s*\|\|\s*initializing\s*\|\|\s*accountIsolationE2EFixture\s*\|\|\s*firstSessionE2EFixture\s*\)/u,
    );
  });

  it('retains the normal fail-closed subscription owner guard', () => {
    expect(entitlementActionsSource).toContain(
      "if (!user?.id) throw new Error('ENTITLEMENT_OWNER_USER_ID_REQUIRED');",
    );
  });
});
