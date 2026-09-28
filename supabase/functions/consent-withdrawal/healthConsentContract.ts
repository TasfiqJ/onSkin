export type HealthConsentDisclosurePurpose = 'grant' | 'decline' | 'withdrawal';
export type HealthConsentCopyReviewStatus = 'draft_blocked' | 'approved';

export type HealthConsentDisclosureContract = Readonly<{
  version: string;
  grantTextHash: string;
  declineTextHash: string;
  withdrawalTextHash: string;
  reviewStatus: HealthConsentCopyReviewStatus;
}>;

/**
 * Published disclosure receipts accepted by the health-consent authority.
 *
 * Keep an older entry only while an installed client that displayed that exact
 * disclosure must remain supported. In particular, withdrawal must never
 * accept caller-invented evidence; supporting an older client means retaining
 * its exact version/hash tuple here and in the database authority.
 */
export const HEALTH_CONSENT_DISCLOSURE_CONTRACTS = Object.freeze(
  [
    Object.freeze({
      version: 'draft-v1-2026-07-10',
      grantTextHash:
        '7957a2811fff0e8cefc6f7180b751ec45688fe99421978eedae05b96c2f251fd',
      declineTextHash:
        '6a34a4d3b8086a0ee86951261f612c502bd4376bc8378cf22533b49817cdedea',
      withdrawalTextHash:
        '5200ef21982670cf73539d8a7d3e0f9c2219b40ee8d63be0a83d3e10043ba37f',
      reviewStatus: 'draft_blocked',
    }),
  ] satisfies readonly HealthConsentDisclosureContract[],
);

export const CURRENT_HEALTH_CONSENT_DISCLOSURE_CONTRACT =
  HEALTH_CONSENT_DISCLOSURE_CONTRACTS[0]!;

function expectedHash(
  contract: HealthConsentDisclosureContract,
  purpose: HealthConsentDisclosurePurpose,
): string {
  switch (purpose) {
    case 'grant':
      return contract.grantTextHash;
    case 'decline':
      return contract.declineTextHash;
    case 'withdrawal':
      return contract.withdrawalTextHash;
  }
}

export function healthConsentDisclosureMatches(
  purpose: HealthConsentDisclosurePurpose,
  version: string,
  consentTextHash: string,
): boolean {
  return HEALTH_CONSENT_DISCLOSURE_CONTRACTS.some(
    (contract) =>
      contract.version === version &&
      expectedHash(contract, purpose) === consentTextHash,
  );
}
