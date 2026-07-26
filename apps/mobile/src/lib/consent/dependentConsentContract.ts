import * as Crypto from 'expo-crypto';

export const HEALTH_DEPENDENT_CONSENT_TYPES = [
  'photo_capture',
  'photo_cloud_backup',
  'photo_trend_insights',
  'ask_onskin',
  'community_participation',
  'data_sharing',
] as const;

export type HealthDependentConsentType = (typeof HEALTH_DEPENDENT_CONSENT_TYPES)[number];
export type HealthDependentConsentLifecycleState =
  | 'unconsented'
  | 'active'
  | 'withdrawing'
  | 'withdrawn';
export type HealthDependentConsentCopyState = 'grant' | 'withdrawal';
export type HealthDependentConsentCopyReviewStatus = 'approved' | 'draft_blocked';

export type HealthDependentConsentCopy = Readonly<{
  version: string;
  text: string;
  sha256: string;
}>;

export type HealthDependentConsentCopyContract = Readonly<{
  grant: HealthDependentConsentCopy;
  withdrawal: HealthDependentConsentCopy;
}>;

const DRAFT_PHOTO_VERSION = 'draft-v1-2026-07-10';

export const HEALTH_DEPENDENT_CONSENT_COPY_RELEASE_BLOCKED =
  'HEALTH_DEPENDENT_CONSENT_COPY_RELEASE_BLOCKED';

export const HEALTH_DEPENDENT_CONSENT_COPY_REVIEW_STATUS = Object.freeze(
  Object.fromEntries(
    HEALTH_DEPENDENT_CONSENT_TYPES.map((type) => [
      type,
      Object.freeze({ grant: 'draft_blocked', withdrawal: 'draft_blocked' }),
    ]),
  ) as Record<
    HealthDependentConsentType,
    Readonly<Record<HealthDependentConsentCopyState, HealthDependentConsentCopyReviewStatus>>
  >,
);

/**
 * One exact mobile contract for every health-dependent consent receipt. These
 * drafts remain legal-review blocked, but a runtime may only accept the exact
 * version/text/hash triplet that was actually presented. Server registries are
 * statically checked against these values before release.
 */
export const HEALTH_DEPENDENT_CONSENT_COPY = Object.freeze({
  photo_capture: Object.freeze({
    grant: Object.freeze({
      version: DRAFT_PHOTO_VERSION,
      text:
        '[DRAFT. Pending legal review B-PRIVACY-COPY] Photo CAPTURE consent. Covers ' +
        'on-device capture and on-device storage only; this build does not offer cloud backup. ' +
        'No biometric faceprint/template is computed or stored. Device loss can mean photo loss.',
      sha256: '2ed9ac0c1009327c08389040d0a1db05462c39102f8730038a90ecd62de8e8c2',
    }),
    withdrawal: Object.freeze({
      version: DRAFT_PHOTO_VERSION,
      text:
        '[DRAFT. Pending legal review B-PRIVACY-COPY] Photo CAPTURE consent WITHDRAWN. ' +
        'On-device progress photos and related local health-purpose state must be deleted.',
      sha256: '553229a2862dd3d280058e7413b3bc85795932dec2f6ca9bed420b7598e54c51',
    }),
  }),
  photo_cloud_backup: Object.freeze({
    grant: Object.freeze({
      version: DRAFT_PHOTO_VERSION,
      text:
        '[DRAFT. Pending legal review B-PRIVACY / B-PRIVACY-COPY] Photo CLOUD-BACKUP ' +
        'consent. Separate and distinct from capture consent; uploads encrypted images to a ' +
        'private, owner-only bucket. Off until affirmatively enabled.',
      sha256: '3964f0829f0c5a1369b3e413d6edaa2585cda671333a6efb0d1f8d84d6f5e8b8',
    }),
    withdrawal: Object.freeze({
      version: DRAFT_PHOTO_VERSION,
      text:
        '[DRAFT. Pending legal review B-PRIVACY-COPY] Photo CLOUD-BACKUP consent WITHDRAWN. ' +
        'Owned cloud photo objects must be deleted before cloud metadata is relocalized.',
      sha256: 'cd32873fec948532c00ed92b5052f5df95a59eef52faa5cc7e1f431e6ddd0113',
    }),
  }),
  photo_trend_insights: Object.freeze({
    grant: Object.freeze({
      version: 'photo-trend-insights-2026-06-13-placeholder',
      text:
        '[PLACEHOLDER photo_trend_insights consent. B-PRIVACY-COPY] ' +
        'On-device only · your own photos comparing your own photos · nothing uploaded, nothing trains anything · no score or grade · revocable, and your trend state is deleted when you turn it off.',
      sha256: '58997d5c3ef5098edf6544aa2752e6878765065831ddbf42c24a364ab36cd1aa',
    }),
    withdrawal: Object.freeze({
      version: 'photo-trend-insights-2026-06-13-placeholder',
      text: '[PLACEHOLDER photo_trend_insights withdrawal. B-PRIVACY-COPY]',
      sha256: 'd6bd89ffbb0900784d4af6d8ae1501c7e10385eeba199e1bd8e932d957eec6ba',
    }),
  }),
  ask_onskin: Object.freeze({
    grant: Object.freeze({
      version: 'ask-advisor-2026-06-14-placeholder',
      text:
        '[PLACEHOLDER ask_onskin consent. B-PRIVACY-COPY] ' +
        'Cloud Ask is unavailable in this release. No shelf summary is sent to a cloud model until an approved provider, exact transmitted-field and retention disclosures, explicit permission, deletion controls, safety validation, and professional review are in place.',
      sha256: '4bc7f130404b5d0d12aa52e0999efa72b1b68dd537fb90bbd708e60c561e1dcc',
    }),
    withdrawal: Object.freeze({
      version: 'ask-advisor-2026-06-14-placeholder',
      text: '[PLACEHOLDER ask_onskin withdrawal. B-PRIVACY-COPY]',
      sha256: '5ef385c3e618e3a4167b7096b3d99ffe3d22468269f6d899a51527b7959c9aff',
    }),
  }),
  community_participation: Object.freeze({
    grant: Object.freeze({
      version: 'community-participation-2026-06-13-placeholder',
      text:
        '[PLACEHOLDER community_participation consent. B-PRIVACY-COPY] ' +
        'Posting a question shares skin-related information with our reviewers and, once approved, with other members. Anonymously. This is a separate, unbundled choice (MHMDA / GDPR), and you can withdraw it anytime.',
      sha256: '416da3ba3cd3496c1008cff937b4d7ad0efa7093d40bcfed2636b480e603ca5e',
    }),
    withdrawal: Object.freeze({
      version: 'community-participation-2026-06-13-placeholder',
      text: '[PLACEHOLDER community_participation withdrawal. B-PRIVACY-COPY]',
      sha256: 'c6ac514c090e7ba197b3f66497aff3b8615c5ffdda7ed2e21eb81f62870aff2e',
    }),
  }),
  data_sharing: Object.freeze({
    grant: Object.freeze({
      version: 'commerce-consent-2026-06-13-placeholder',
      text:
        '[PLACEHOLDER commerce data-sharing consent. B-PRIVACY-COPY] ' +
        'Opening a “where to buy” link shares a single anonymous click token with our affiliate partner, so a purchase can be credited. That’s it.',
      sha256: 'b02cf2e0dd7fa1a1e0be10122b9a363109b0d6adbd7d3c478c168ff811c17b7a',
    }),
    withdrawal: Object.freeze({
      version: 'commerce-consent-2026-06-13-placeholder',
      text: '[PLACEHOLDER commerce data-sharing withdrawal. B-PRIVACY-COPY]',
      sha256: '91f4958177a5d38507536c281726094938df5675555547576b5d18e799bc89b4',
    }),
  }),
} satisfies Record<HealthDependentConsentType, HealthDependentConsentCopyContract>);

const HEX_256 = /^[a-f0-9]{64}$/u;

export function isHealthDependentConsentType(
  value: unknown,
): value is HealthDependentConsentType {
  return (
    typeof value === 'string' &&
    (HEALTH_DEPENDENT_CONSENT_TYPES as readonly string[]).includes(value)
  );
}

export function consentCopyFor(
  type: HealthDependentConsentType,
  state: HealthDependentConsentCopyState,
): HealthDependentConsentCopy {
  return HEALTH_DEPENDENT_CONSENT_COPY[type][state];
}

/**
 * Draft/placeholder grant language is testable in development but is never a
 * shippable legal approval. Staging remains available for legal-review
 * evidence. Existing users must always remain able to withdraw in production,
 * even while replacement withdrawal copy is still awaiting review.
 */
export function assertHealthDependentConsentCopyReleaseAllowed(
  type: HealthDependentConsentType,
  action: HealthDependentConsentCopyState,
  appEnvironment: 'development' | 'staging' | 'production',
): void {
  if (
    action === 'grant' &&
    appEnvironment === 'production' &&
    HEALTH_DEPENDENT_CONSENT_COPY_REVIEW_STATUS[type].grant !== 'approved'
  ) {
    throw new Error(HEALTH_DEPENDENT_CONSENT_COPY_RELEASE_BLOCKED);
  }
}

export function isExactHealthDependentConsentCopy(params: {
  type: HealthDependentConsentType;
  state: HealthDependentConsentCopyState;
  version: unknown;
  consentTextHash: unknown;
}): boolean {
  const expected = consentCopyFor(params.type, params.state);
  return (
    params.version === expected.version &&
    params.consentTextHash === expected.sha256 &&
    HEX_256.test(expected.sha256)
  );
}

export async function hashConsentText(text: string): Promise<string> {
  return Crypto.digestStringAsync(Crypto.CryptoDigestAlgorithm.SHA256, text);
}

export async function assertConsentCopyIntegrity(
  type: HealthDependentConsentType,
  state: HealthDependentConsentCopyState,
): Promise<HealthDependentConsentCopy> {
  const copy = consentCopyFor(type, state);
  const actual = await hashConsentText(copy.text);
  if (!HEX_256.test(copy.sha256) || actual !== copy.sha256) {
    throw new Error('HEALTH_DEPENDENT_CONSENT_COPY_INVALID');
  }
  return copy;
}

export async function createConsentIdempotencyKey(): Promise<string> {
  const bytes = await Crypto.getRandomBytesAsync(32);
  return [...bytes].map((byte) => byte.toString(16).padStart(2, '0')).join('');
}
