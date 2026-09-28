import { BRAND } from '@/lib/brand';

export const APPLE_MANUAL_REVOCATION_URL = 'https://support.apple.com/en-us/102571';

export type AccountDeletionNotice = {
  kind: 'apple_manual_revocation';
  title: string;
  message: string;
  instructionUrl: typeof APPLE_MANUAL_REVOCATION_URL;
};

let pendingNotice: AccountDeletionNotice | null = null;
let pendingNoticeOrigin: 'runtime' | 'e2e' | null = null;
let e2eNoticeConsumed = false;

function appleManualRevocationNotice(): AccountDeletionNotice {
  return {
    kind: 'apple_manual_revocation',
    title: 'One Apple step remains',
    message: `Your ${BRAND.appName} account and data were deleted, but the Sign in with Apple connection could not be revoked automatically. On iPhone, open Settings, tap your name, tap Sign in with Apple, choose ${BRAND.appName}, then tap Delete.`,
    instructionUrl: APPLE_MANUAL_REVOCATION_URL,
  };
}

export function queueAppleManualRevocationNotice(): AccountDeletionNotice {
  pendingNotice = appleManualRevocationNotice();
  pendingNoticeOrigin = 'runtime';
  return pendingNotice;
}

export function peekAccountDeletionNotice(): AccountDeletionNotice | null {
  if (pendingNotice) return pendingNotice;
  if (
    typeof __DEV__ !== 'undefined' &&
    __DEV__ &&
    !e2eNoticeConsumed &&
    process.env.EXPO_PUBLIC_E2E_ACCOUNT_DELETION_NOTICE === 'apple_manual_revocation'
  ) {
    pendingNotice = appleManualRevocationNotice();
    pendingNoticeOrigin = 'e2e';
  }

  return pendingNotice;
}

export function acknowledgeAccountDeletionNotice(notice: AccountDeletionNotice): void {
  if (pendingNotice !== notice) return;
  if (pendingNoticeOrigin === 'e2e') e2eNoticeConsumed = true;
  pendingNotice = null;
  pendingNoticeOrigin = null;
}

export function consumeAccountDeletionNotice(): AccountDeletionNotice | null {
  const notice = peekAccountDeletionNotice();
  if (notice) acknowledgeAccountDeletionNotice(notice);
  return notice;
}

export function resetAccountDeletionNoticeForTests(): void {
  pendingNotice = null;
  pendingNoticeOrigin = null;
  e2eNoticeConsumed = false;
}
