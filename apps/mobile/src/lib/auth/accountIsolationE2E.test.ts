import { afterEach, describe, expect, it } from 'vitest';

import { getAccountIsolationE2EFixture } from './accountIsolationE2E';

afterEach(() => {
  delete process.env.EXPO_PUBLIC_E2E_ACCOUNT_ISOLATION;
});

describe('account isolation E2E fixture', () => {
  it('provides a permanent synthetic session only in the explicit development mode', () => {
    process.env.EXPO_PUBLIC_E2E_ACCOUNT_ISOLATION = 'signout_clear_retry';

    const fixture = getAccountIsolationE2EFixture(true, 'development', false);

    expect(fixture).toMatchObject({
      clearDelayMs: 700,
      clearFailures: 2,
      mode: 'signout_clear_retry',
      session: {
        user: {
          email: 'tas.account-a.e2e@example.com',
          id: '00000000-0000-4000-8000-0000000000a1',
          is_anonymous: false,
        },
      },
    });
    expect(getAccountIsolationE2EFixture(false)).toBeNull();
    expect(getAccountIsolationE2EFixture(true, 'production', false)).toBeNull();
    expect(getAccountIsolationE2EFixture(true, 'development', true)).toBeNull();
  });

  it('stays disabled for missing or unknown values', () => {
    expect(getAccountIsolationE2EFixture(true)).toBeNull();
    process.env.EXPO_PUBLIC_E2E_ACCOUNT_ISOLATION = 'unknown';
    expect(getAccountIsolationE2EFixture(true)).toBeNull();
  });
});
