import { BRAND } from '@/lib/brand';

// Standing "not medical advice" disclaimer (docs/02 §9). In-app copy is a "claims
// surface" under the FD&C Act / FTC, so a clear, persistent disclaimer appears in
// onboarding, in Settings, and contextually on the conflict-detail and any safety
// screens. Claim-safe and non-diagnostic. Final wording is a counsel item
// (B-LEGAL / B-PRIVACY-COPY); this shippable line mirrors the stance already used
// in the community layer (features/community/copy.ts).
export const NOT_MEDICAL_ADVICE = `${BRAND.appName} gives general information about cosmetic products and routines. It is not medical advice and is not intended to diagnose, treat, or cure any condition. For medical concerns, see a dermatologist.`;

/** Short one-liner for compact contextual footers (conflict detail, safety). */
export const NOT_MEDICAL_ADVICE_SHORT = 'General cosmetic information, not medical advice.';
