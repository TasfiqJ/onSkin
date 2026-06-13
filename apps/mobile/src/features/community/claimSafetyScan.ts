// The claim-safety scan for peer content (docs/11 §6). A FIRST-PASS FLAG, not the
// decision — human pre-moderation is authoritative, and an appeal path catches both
// failure modes (under-blocking a paraphrased "it healed my acne", over-blocking a
// legitimate post). Reuses the established regression-guard vocabulary (docs/02/06/07/
// 08/10): drug/disease verbs, dosage, alarm. Pure + tested; nothing reaches another
// user on the strength of this scan alone.
//
// (If an automated classifier is ever used as MORE than a flag, EU AI Act content-
// moderation obligations attach — re-verify; B-COMMUNITY-LEGAL.)

export type ClaimSafetyResult = { flagged: boolean; reasons: string[] };

const CHECKS: { reason: string; re: RegExp }[] = [
  // catch inflected forms — treat/treats/treated/treating, cure/cured, heal/healed, etc.
  { reason: 'drug or disease claim', re: /\b(treat|cure|heal|prevent)(s|d|ed|ing)?\b|\bdiagnos\w*/i },
  { reason: 'dosage amount', re: /\b\d+\s?(mg|ml|iu)\b|\b\d+\s?%/i },
  { reason: 'dosage frequency', re: /\b\d+\s+times?\s+(a|per)\s+day\b/i },
  { reason: 'alarm language', re: /\b(danger\w*|harmful|toxic|poison\w*)\b|!/i },
];

export function scanClaimSafety(body: string): ClaimSafetyResult {
  const reasons = CHECKS.filter((c) => c.re.test(body)).map((c) => c.reason);
  return { flagged: reasons.length > 0, reasons };
}
