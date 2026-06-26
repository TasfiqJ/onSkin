/**
 * Consent copy. BLOCKED: B-PRIVACY-COPY. Final wording + policy documents need
 * counsel (MHMDA Consumer Health Data Privacy Policy, GDPR Art. 9). The structure
 * (WHAT / WHY / NEVER, unbundled, withdrawable) follows the design spec, but the
 * text is a clearly-labelled placeholder. The `version` + the SHA-256 hash of
 * `fullText` recorded in the ledger are the real, shippable mechanism.
 */
export const CONSENT_COPY_VERSION = 'placeholder-v0-2026-06-12';

export const HEALTH_DATA_CONSENT = {
  version: CONSENT_COPY_VERSION,
  what: '[Placeholder] Quiz answers, skin goals, and products you add.',
  why: '[Placeholder] Only to build and adjust your routine.',
  never: '[Placeholder] Sold, shared, or used to train AI.',
  footnote: '[Placeholder] Withdraw anytime in Settings.',
  // Exact text recorded + hashed into the immutable consents ledger.
  fullText:
    '[PLACEHOLDER. Pending legal review B-PRIVACY-COPY] Health-data COLLECTION consent. ' +
    'This consent covers collection only; sharing is requested separately.',
} as const;

// The exact text hashed into the ledger when a user WITHDRAWS health-data
// collection consent (docs/01 §4: withdrawal must be as easy as granting).
// Recording the granted=false row is the durable proof; deletion is the effect.
export const HEALTH_DATA_WITHDRAWAL = {
  version: CONSENT_COPY_VERSION,
  fullText:
    '[PLACEHOLDER. Pending legal review B-PRIVACY-COPY] Health-data COLLECTION consent ' +
    'WITHDRAWN. Collected health data is to be deleted and the account closed.',
} as const;

export const ACCOUNT_CONSENT = {
  version: CONSENT_COPY_VERSION,
  fullText:
    '[PLACEHOLDER. Pending legal review B-PRIVACY-COPY] Acceptance of the Terms of ' +
    'Service and Privacy Policy.',
} as const;

/**
 * Photo CAPTURE consent. Requested at first camera use (docs/01 §4, docs/06 §7).
 * Skin photos are Art. 9 / MHMDA health-inference data → explicit, unbundled, and
 * SEPARATE from cloud backup. Placeholder copy; B-PRIVACY-COPY owns final wording.
 */
export const PHOTO_CAPTURE_CONSENT = {
  version: CONSENT_COPY_VERSION,
  what: '[Placeholder] Photos you take in guided capture.',
  why: '[Placeholder] Only to build your private on-device progress timeline.',
  never: '[Placeholder] Uploaded, shared, or used to train AI. They stay on this phone.',
  footnote: '[Placeholder] No faceprint is ever stored. Withdraw anytime in Settings.',
  fullText:
    '[PLACEHOLDER. Pending legal review B-PRIVACY-COPY] Photo CAPTURE consent. Covers ' +
    'on-device capture and on-device storage only; cloud backup is requested separately. ' +
    'No biometric faceprint/template is computed or stored.',
} as const;

/**
 * Photo CLOUD-BACKUP consent. A DISTINCT, off-by-default opt-in (docs/01 §4,
 * docs/06 §7): uploading special-category images off-device is higher-risk, so it
 * is never bundled with capture. Placeholder; B-PRIVACY / B-PRIVACY-COPY own final.
 */
export const PHOTO_CLOUD_BACKUP_CONSENT = {
  version: CONSENT_COPY_VERSION,
  what: '[Placeholder] An encrypted copy of your photos, backed up to your private cloud space.',
  why: '[Placeholder] So a lost or replaced phone doesn’t mean losing your timeline.',
  never: '[Placeholder] Shared, sold, or used to train AI. Encrypted, owner-only.',
  footnote: '[Placeholder] Off by default. A separate choice from capture. Turn off anytime.',
  fullText:
    '[PLACEHOLDER. Pending legal review B-PRIVACY / B-PRIVACY-COPY] Photo CLOUD-BACKUP ' +
    'consent. Separate and distinct from capture consent; uploads encrypted images to a ' +
    'private, owner-only bucket. Off until affirmatively enabled.',
} as const;
