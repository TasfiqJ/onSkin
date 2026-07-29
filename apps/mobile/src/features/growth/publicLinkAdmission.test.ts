import { describe, expect, it } from 'vitest';

import {
  isPublicConflictLinkAdmitted,
  PUBLIC_CONFLICT_LINK_ADMISSION_OPEN,
} from './publicLinkAdmission';

describe('public conflict-link admission', () => {
  it('is independently and literally closed', () => {
    expect(PUBLIC_CONFLICT_LINK_ADMISSION_OPEN).toBe(false);
    expect(isPublicConflictLinkAdmitted()).toBe(false);
  });

  it('rejects valid-looking authorities, flags, domains, tokens, and share admission', () => {
    expect(
      isPublicConflictLinkAdmitted({
        schemaVersion: 1,
        authorityId: 'public-link-authority-forged',
        decision: 'admitted',
        sharePublicationReceiptId: 'share-receipt-forged',
        shareProjectionSha256: 'a'.repeat(64),
        tokenPolicySha256: 'b'.repeat(64),
        retentionPolicySha256: 'c'.repeat(64),
        revocationPolicySha256: 'd'.repeat(64),
        finalDomain: 'https://routinekind.app',
        publicLinksFlag: true,
        shareAdmissionOpen: true,
        token: 'valid-looking-token',
      }),
    ).toBe(false);
  });

  it('does not inspect adversarial input while admission is closed', () => {
    const unreadable = Object.defineProperty({}, 'authorityId', {
      get() {
        throw new Error('closed admission must not inspect input');
      },
    });

    expect(() => isPublicConflictLinkAdmitted(unreadable)).not.toThrow();
  });
});
