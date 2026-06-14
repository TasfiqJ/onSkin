import { scanClaimSafety, type ClaimSafetyResult } from '@/features/community/claimSafetyScan';

// The runtime claim-safety guard for Ask answers (docs/13 §4/§5). It REUSES the shipped
// guard (`scanClaimSafety`, docs/02/06/07/08/11) as a cheap pre-filter — drug/disease verb,
// dose, alarm — then ADDS the same forbidden-vocabulary nets the build-time
// `claimsafety.test.ts` enforces (disease-noun-as-diagnosis, superiority / AI-washing, skin
// score, and "AI" marketing), so the RUNTIME net matches the brand's full stated forbidden
// list rather than a subset. Substantive claims are TEMPLATE-BOUNDED from the deterministic
// engine + already-claim-safe copy (D-057), so this should never fire; if it ever does (a
// regression, or a future free-generated cloud claim), the caller refuses-over-guesses. The
// guard runs ONLY on the substantive `claim` sentence — product-name DATA (which may carry a
// "7%") is rendered in separate fields and is NOT scanned, avoiding false positives on data.

const EXTRA: { reason: string; re: RegExp }[] = [
  { reason: 'condition named as a diagnosis', re: /\b(acne|rosacea|psoriasis|dermatitis|melasma|eczema|hyperpigmentation)\b/i },
  { reason: 'superiority / AI-washing claim', re: /\bdermatologist-grade\b|\bmore\s+accurate\s+than\b|\bobjective\b|\bclinically\s+proven\b/i },
  { reason: 'skin score / rating', re: /\bskin\s*score\b|\bskin\s*age\b|\bskin\s*health\b|\b\d+\s?\/\s?\d+\b|\b\d+\s*stars?\b/i },
  { reason: 'AI marketing', re: /\bai\b/i },
];

export type GuardVerdict = ClaimSafetyResult;

/** Scan a substantive, template-bounded claim sentence. ok=true means it may render. */
export function guardClaim(claim: string): { ok: boolean; result: GuardVerdict } {
  const base = scanClaimSafety(claim);
  const extra = EXTRA.filter((c) => c.re.test(claim)).map((c) => c.reason);
  const reasons = [...base.reasons, ...extra];
  return { ok: reasons.length === 0, result: { flagged: reasons.length > 0, reasons } };
}
