/**
 * A future public-link authority is separate from share-card publication
 * authority. It binds the complete hosted token lifecycle and safety policy.
 * This module intentionally defines no token generator, issuer, persistence,
 * network client, verifier, fixture override, or authority minting function.
 */
export type PublicConflictLinkAuthority = Readonly<{
  schemaVersion: 1;
  authorityId: string;
  decision: 'admitted';
  sharePublicationReceiptId: string;
  shareProjectionSha256: string;
  tokenPolicySha256: string;
  retentionPolicySha256: string;
  revocationPolicySha256: string;
  recipientPolicySha256: string;
  indexingPolicySha256: string;
  abuseResponsePolicySha256: string;
  incidentPolicySha256: string;
  privacyPolicySha256: string;
  deletionPolicySha256: string;
  market: string;
  allowedOrigins: readonly string[];
  notBefore: string;
  expiresAt: string;
  signature: Readonly<{
    algorithm: 'ed25519';
    keyId: string;
    value: string;
  }>;
}>;

export const PUBLIC_CONFLICT_LINK_ADMISSION_OPEN = false as const;

/**
 * CORE-07A admits no public conflict link. This gate is intentionally
 * independent from share-card admission.
 */
export function isPublicConflictLinkAdmitted(_authority?: unknown): false {
  return false;
}
