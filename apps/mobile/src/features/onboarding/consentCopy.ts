/**
 * Consent copy. BLOCKED: B-PRIVACY-COPY. Final wording + policy documents need
 * counsel (MHMDA Consumer Health Data Privacy Policy, GDPR Art. 9). The visible
 * WHAT / WHY / NEVER strings are plain-language draft copy grounded in the source
 * docs; the ledger text remains clearly marked as pending legal review.
 */
export const CONSENT_COPY_VERSION = 'draft-v0-2026-07-05';

export const HEALTH_DATA_CONSENT = {
  version: CONSENT_COPY_VERSION,
  what: 'Your quiz answers, skin goals, sensitivities, and products you add.',
  why: 'To build your routine, check product conflicts, and adjust timing around your shelf.',
  never: 'Sold, shared for ads, or used to train AI.',
  footnote:
    'You can withdraw this consent in Settings. Account deletion removes collected health data.',
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
    'WITHDRAWN. Collected health data is to be deleted and the account closed.',
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
export const PHOTO_CAPTURE_CONSENT = {
  version: CONSENT_COPY_VERSION,
  what: 'Photos you choose to take with guided capture.',
  why: 'To build your private progress timeline on this device.',
  never:
    'Never uploaded automatically, sold, or used to train AI. You can choose to share a photo. Cloud backup is not available in this build.',
  footnote:
    'No faceprint or biometric template is stored. A lost phone can mean lost photos. You can withdraw anytime in Settings.',
  fullText:
    '[DRAFT. Pending legal review B-PRIVACY-COPY] Photo CAPTURE consent. Covers ' +
    'on-device capture and on-device storage only; this build does not offer cloud backup. ' +
    'No biometric faceprint/template is computed or stored. Device loss can mean photo loss.',
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
