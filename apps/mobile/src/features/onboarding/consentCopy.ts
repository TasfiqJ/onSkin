/**
 * Consent copy. BLOCKED: B-PRIVACY-COPY. Final wording + policy documents need
 * counsel (MHMDA Consumer Health Data Privacy Policy, GDPR Art. 9). The visible
 * WHAT / WHY / NEVER strings are plain-language draft copy grounded in the source
 * docs; the ledger text remains clearly marked as pending legal review.
 */
export const CONSENT_COPY_VERSION = 'draft-v1-2026-07-10';
export const HEALTH_DATA_CONSENT_COPY_RELEASE_BLOCKED =
  'HEALTH_DATA_CONSENT_COPY_RELEASE_BLOCKED';
type HealthDataConsentCopyReviewStatus = 'approved' | 'draft_blocked';
export type HealthDataConsentCopyAction = 'grant' | 'withdrawal';

export const HEALTH_DATA_CONSENT_COPY_REVIEW_STATUS: Readonly<
  Record<'collection' | 'withdrawal', HealthDataConsentCopyReviewStatus>
> = Object.freeze({
  collection: 'draft_blocked',
  withdrawal: 'draft_blocked',
} as const);

/**
 * Staging is the exact legal-review surface. Production fails closed for new
 * grants only; an existing user must always be able to withdraw consent.
 */
export function assertHealthDataConsentCopyReleaseAllowed(
  action: HealthDataConsentCopyAction,
  appEnvironment: 'development' | 'staging' | 'production',
): void {
  if (
    action === 'grant' &&
    appEnvironment === 'production' &&
    HEALTH_DATA_CONSENT_COPY_REVIEW_STATUS.collection !== 'approved'
  ) {
    throw new Error(HEALTH_DATA_CONSENT_COPY_RELEASE_BLOCKED);
  }
}

export const HEALTH_DATA_CONSENT = {
  version: CONSENT_COPY_VERSION,
  what: 'Your quiz answers, skin goals, sensitivities, whether you are pregnant, breastfeeding, or trying to become pregnant, and products you add.',
  why: 'To build your routine, check product conflicts, and adjust timing around your shelf.',
  never: 'Sold, shared for ads, or used to train AI.',
  footnote:
    'You can withdraw in Settings. Withdrawal deletes health-purpose data while keeping your account and subscription; starting again requires fresh consent.',
  declineCta: "I don't agree",
  declinedTitle: 'No consent recorded',
  declinedBody:
    "We won't collect quiz health data unless you agree. The personalized quiz stays locked for now.",
  saveFailedTitle: 'Consent not saved',
  saveFailedBody:
    "We couldn't record your health-data choice. Please try again before starting the quiz.",
  // Exact text recorded + hashed into the immutable consents ledger.
  fullText:
    '[DRAFT. Pending legal review B-PRIVACY-COPY] Health-data COLLECTION consent. ' +
    'Covers quiz answers, skin goals, sensitivities, whether you are pregnant, breastfeeding, or trying to become pregnant, and added products. ' +
    'This consent covers collection only; sharing is requested separately.',
  declineText:
    '[DRAFT. Pending legal review B-PRIVACY-COPY] Health-data COLLECTION consent declined before quiz access.',
} as const;

// The exact text hashed into the ledger when a user WITHDRAWS health-data
// collection consent (docs/01: withdrawal must be as easy as granting).
// Recording the granted=false row is the durable proof; deletion is the effect.
export const HEALTH_DATA_WITHDRAWAL = {
  version: CONSENT_COPY_VERSION,
  fullText:
    '[DRAFT. Pending legal review B-PRIVACY-COPY] Health-data COLLECTION consent ' +
    'WITHDRAWN. Collected health-purpose data is to be deleted. The account, billing, ' +
    'subscription entitlement, App Lock setting, and store-transaction safety record are preserved.',
} as const;

export const ACCOUNT_CONSENT = {
  version: CONSENT_COPY_VERSION,
  saveFailedBody: "We couldn't record your account choice. Please try again before continuing.",
  fullText:
    '[DRAFT. Pending legal review B-PRIVACY-COPY] Acceptance of the Terms of ' +
    'Service and Privacy Policy.',
} as const;

/**
 * Photo CAPTURE consent. Requested at first camera use (docs/01, docs/06).
 * Skin photos are Art. 9 / MHMDA health-inference data: explicit, unbundled, and
 * separate from cloud backup. B-PRIVACY-COPY owns final wording.
 */
const PHOTO_CAPTURE_CONSENT_VERSION = 'draft-photo-v3-2026-07-14';
const PHOTO_CAPTURE_CONSENT_TITLE = 'Your photos stay on this phone.';
const PHOTO_CAPTURE_CONSENT_WHAT = 'Photos you choose to take with guided capture.';
const PHOTO_CAPTURE_CONSENT_WHY = 'To build your private progress timeline on this device.';
const PHOTO_CAPTURE_CONSENT_NEVER =
  'Never uploaded automatically, sold, or used to train AI. You can choose to share a photo. Cloud backup is not available in this build.';
const PHOTO_CAPTURE_CONSENT_FOOTNOTE =
  'No faceprint or biometric template is stored. A lost phone can mean lost photos. Choosing Not now keeps the camera closed.';

export const PHOTO_CAPTURE_CONSENT = {
  version: PHOTO_CAPTURE_CONSENT_VERSION,
  title: PHOTO_CAPTURE_CONSENT_TITLE,
  what: PHOTO_CAPTURE_CONSENT_WHAT,
  why: PHOTO_CAPTURE_CONSENT_WHY,
  never: PHOTO_CAPTURE_CONSENT_NEVER,
  footnote: PHOTO_CAPTURE_CONSENT_FOOTNOTE,
  // Exact disclosure text rendered by the capture gate and hashed into both
  // the local proof and consent ledger. Layout and the affirmative CTA are not
  // part of the disclosure, but every displayed disclosure word is sourced here.
  fullText: [
    PHOTO_CAPTURE_CONSENT_TITLE,
    `WHAT\n${PHOTO_CAPTURE_CONSENT_WHAT}`,
    `WHY\n${PHOTO_CAPTURE_CONSENT_WHY}`,
    `NEVER\n${PHOTO_CAPTURE_CONSENT_NEVER}`,
    PHOTO_CAPTURE_CONSENT_FOOTNOTE,
  ].join('\n\n'),
} as const;

/**
 * Reserved future CLOUD-BACKUP consent draft. It is intentionally not wired to
 * runtime UI or persistence until encrypted upload/restore/deletion exists.
 * B-PRIVACY / B-PRIVACY-COPY own final wording before any future exposure.
 */
export const PHOTO_CLOUD_BACKUP_CONSENT = {
  version: CONSENT_COPY_VERSION,
  what: 'An encrypted backup copy of your progress photos in your private cloud space.',
  why: 'So a lost or replaced phone does not mean losing your timeline.',
  never: 'Shared, sold, or used to train AI. Backup stays off until you choose it.',
  footnote: 'This is separate from photo capture. You can turn it off anytime.',
  fullText:
    '[DRAFT. Pending legal review B-PRIVACY / B-PRIVACY-COPY] Photo CLOUD-BACKUP ' +
    'consent. Separate and distinct from capture consent; uploads encrypted images to a ' +
    'private, owner-only bucket. Off until affirmatively enabled.',
} as const;
