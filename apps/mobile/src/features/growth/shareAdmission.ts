/**
 * A future share-publication receipt is a detached, immutable authority for one
 * exact reviewed public artifact. This module intentionally defines no issuer,
 * signer, parser, fixture override, or local minting path.
 */
export type ConflictShareReviewReceipt = Readonly<{
  role:
    | 'regulatory_claims_counsel'
    | 'privacy_security_reviewer'
    | 'board_certified_dermatologist'
    | 'cosmetic_chemist'
    | 'ip_content_rights_counsel'
    | 'release_signoff_operator';
  receiptId: string;
  reviewedArtifactSha256: string;
  decision: 'approved';
  expiresAt: string;
}>;

export type ConflictSharePublicationReceipt = Readonly<{
  schemaVersion: 1;
  receiptId: string;
  decision: 'admitted';
  corpusId: string;
  corpusVersion: string;
  corpusSha256: string;
  ruleId: string;
  ruleSha256: string;
  copySha256: string;
  citationSetSha256: string;
  projectionSha256: string;
  reviewReceipts: readonly ConflictShareReviewReceipt[];
  contentRightsReceiptId: string;
  contentRightsScopeSha256: string;
  allowedMarket: string;
  allowedTerritories: readonly string[];
  notBefore: string;
  expiresAt: string;
  signature: Readonly<{
    algorithm: 'ed25519';
    keyId: string;
    value: string;
  }>;
}>;

/**
 * A future confirmation must bind what the user previewed to the exact bytes
 * handed to the native destination. A generic button tap is not confirmation.
 * This module intentionally defines no confirmation recorder.
 */
export type ConflictSharePayloadConfirmation = Readonly<{
  schemaVersion: 1;
  sharePublicationReceiptId: string;
  projectionSha256: string;
  renderedPayloadSha256: string;
  destinationBehaviorSha256: string;
  destination: 'native_share_sheet';
  publicLinkIncluded: false;
  exactPayloadPreviewedAt: string;
  confirmed: true;
  confirmedAt: string;
}>;

export const CONFLICT_SHARE_ADMISSION_OPEN = false as const;

/**
 * CORE-07A is a zero-admission checkpoint. No receipt-looking object, feature
 * flag, final domain, owned pair, development fixture, or confirmation-looking
 * object can open sharing until a separately reviewed issuer and verifier ship.
 */
export function isConflictShareAdmitted(
  _receipt?: unknown,
  _confirmation?: unknown,
  _projection?: unknown,
): false {
  return false;
}
