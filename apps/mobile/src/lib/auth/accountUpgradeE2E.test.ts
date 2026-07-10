import { afterEach, describe, expect, it } from 'vitest';

import { ACCOUNT_UPGRADE_E2E_EMAIL_CODE, getAccountUpgradeE2EFixture } from './accountUpgradeE2E';

afterEach(() => {
  delete process.env.EXPO_PUBLIC_E2E_ACCOUNT_UPGRADE;
});

describe('account upgrade E2E fixture', () => {
  it('is available only for the explicit development fixture', () => {
    process.env.EXPO_PUBLIC_E2E_ACCOUNT_UPGRADE = 'email_same_user';

    expect(getAccountUpgradeE2EFixture(true)).toEqual({
      emailCode: ACCOUNT_UPGRADE_E2E_EMAIL_CODE,
      mode: 'email_same_user',
    });
    expect(getAccountUpgradeE2EFixture(false)).toBeNull();
  });

  it('stays off for missing or unknown fixture values', () => {
    expect(getAccountUpgradeE2EFixture(true)).toBeNull();
    process.env.EXPO_PUBLIC_E2E_ACCOUNT_UPGRADE = 'unknown';
    expect(getAccountUpgradeE2EFixture(true)).toBeNull();
  });
});
