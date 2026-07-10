export const ACCOUNT_UPGRADE_E2E_EMAIL_CODE = '424242';

export type AccountUpgradeE2EFixture = {
  emailCode: string;
  mode: 'email_same_user';
};

function isDevRuntime(): boolean {
  return typeof __DEV__ !== 'undefined' && __DEV__;
}

export function getAccountUpgradeE2EFixture(
  isDev = isDevRuntime(),
): AccountUpgradeE2EFixture | null {
  if (!isDev) return null;
  const mode = process.env.EXPO_PUBLIC_E2E_ACCOUNT_UPGRADE?.trim().toLowerCase();
  if (mode !== 'email_same_user') return null;
  return { emailCode: ACCOUNT_UPGRADE_E2E_EMAIL_CODE, mode };
}
