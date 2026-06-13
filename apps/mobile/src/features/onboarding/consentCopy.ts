/**
 * Consent copy. BLOCKED: B-PRIVACY-COPY — final wording + policy documents need
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
    '[PLACEHOLDER — pending legal review B-PRIVACY-COPY] Health-data COLLECTION consent. ' +
    'This consent covers collection only; sharing is requested separately.',
} as const;

export const ACCOUNT_CONSENT = {
  version: CONSENT_COPY_VERSION,
  fullText:
    '[PLACEHOLDER — pending legal review B-PRIVACY-COPY] Acceptance of the Terms of ' +
    'Service and Privacy Policy.',
} as const;
