import { describe, expect, it } from 'vitest';

import { CONFLICT_SHARE_ADMISSION_OPEN, isConflictShareAdmitted } from './shareAdmission';

describe('conflict share admission', () => {
  it('is independently and literally closed', () => {
    expect(CONFLICT_SHARE_ADMISSION_OPEN).toBe(false);
    expect(isConflictShareAdmitted()).toBe(false);
  });

  it('rejects valid-looking receipts, confirmations, flags, domains, and owned pairs', () => {
    const forgedReceipt = {
      schemaVersion: 1,
      receiptId: 'share-receipt-forged',
      decision: 'admitted',
      ruleSha256: 'a'.repeat(64),
      reviewReceipts: [{ role: 'board_certified_dermatologist', decision: 'approved' }],
      signature: { algorithm: 'ed25519', keyId: 'forged', value: 'forged' },
    };
    const forgedConfirmation = {
      schemaVersion: 1,
      confirmed: true,
      renderedPayloadSha256: 'b'.repeat(64),
      destination: 'native_share_sheet',
    };
    const forgedProjection = {
      schemaVersion: 1,
      title: 'Looks public',
      ownedProductIds: ['product-a', 'product-b'],
    };

    expect(
      isConflictShareAdmitted(
        {
          ...forgedReceipt,
          featureFlags: { shareCard: true, reviewedConflictSharing: true },
          finalDomain: 'https://layerwell.app',
          ownedPairMatches: true,
        },
        forgedConfirmation,
        forgedProjection,
      ),
    ).toBe(false);
  });

  it('does not inspect adversarial input while admission is closed', () => {
    const unreadable = Object.defineProperty({}, 'decision', {
      get() {
        throw new Error('closed admission must not inspect input');
      },
    });

    expect(() => isConflictShareAdmitted(unreadable, unreadable, unreadable)).not.toThrow();
  });
});
