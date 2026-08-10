import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import {
  acknowledgeAccountDeletionNotice,
  APPLE_MANUAL_REVOCATION_URL,
  consumeAccountDeletionNotice,
  peekAccountDeletionNotice,
  queueAppleManualRevocationNotice,
  resetAccountDeletionNoticeForTests,
} from './accountDeletionNotice';

describe('account deletion completion notice', () => {
  beforeEach(() => {
    delete process.env.EXPO_PUBLIC_E2E_ACCOUNT_DELETION_NOTICE;
    resetAccountDeletionNoticeForTests();
  });

  afterEach(() => {
    delete process.env.EXPO_PUBLIC_E2E_ACCOUNT_DELETION_NOTICE;
    resetAccountDeletionNoticeForTests();
    vi.unstubAllGlobals();
  });

  it('queues one reviewed Apple manual-revocation instruction without user data', () => {
    queueAppleManualRevocationNotice();

    expect(consumeAccountDeletionNotice()).toEqual({
      kind: 'apple_manual_revocation',
      title: 'One Apple step remains',
      message:
        'Your Layerwell account and data were deleted, but the Sign in with Apple connection could not be revoked automatically. On iPhone, open Settings, tap your name, tap Sign in with Apple, choose Layerwell, then tap Delete.',
      instructionUrl: APPLE_MANUAL_REVOCATION_URL,
    });
    expect(consumeAccountDeletionNotice()).toBeNull();
  });

  it('does not synthesize a notice without an attested deletion outcome', () => {
    expect(consumeAccountDeletionNotice()).toBeNull();
  });

  it('keeps a pending notice stable until the committed screen acknowledges it', () => {
    const queued = queueAppleManualRevocationNotice();

    expect(peekAccountDeletionNotice()).toBe(queued);
    expect(peekAccountDeletionNotice()).toBe(queued);

    acknowledgeAccountDeletionNotice(queued);

    expect(peekAccountDeletionNotice()).toBeNull();
  });

  it('allows the manual fallback fixture only in development and only once', () => {
    process.env.EXPO_PUBLIC_E2E_ACCOUNT_DELETION_NOTICE = 'apple_manual_revocation';
    vi.stubGlobal('__DEV__', false);

    expect(peekAccountDeletionNotice()).toBeNull();

    vi.stubGlobal('__DEV__', true);
    const fixture = peekAccountDeletionNotice();
    expect(fixture).toEqual(expect.objectContaining({ kind: 'apple_manual_revocation' }));
    expect(peekAccountDeletionNotice()).toBe(fixture);

    acknowledgeAccountDeletionNotice(fixture!);

    expect(peekAccountDeletionNotice()).toBeNull();
  });
});
