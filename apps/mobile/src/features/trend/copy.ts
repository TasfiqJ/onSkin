import type { TrendChangeState } from '@onskin/types';

// Centralised trend copy (docs/12 §6/§9, the Slice-11..25 guard pattern). *** THE COPY
// IS THE REGULATED SURFACE. *** It must be: descriptive, not evaluative or diagnostic
// (cosmetic verbs, "the look of…"); NEVER a number/score/grade/"skin age"/percentage/
// star-or-letter rating; NEVER disease/detection ("we detected acne/redness/…" → FDA
// SaMD); NEVER a superiority claim ("dermatologist-grade"/"objective"/"more accurate
// than your eyes" → FTC); NEVER "improved/worse" as a verdict; NEVER a structure/
// function claim; and NEVER marketed as "AI" (a measured trust penalty). The forbidden
// list is enforced by `claimsafety.test.ts` (extended to trend strings, D-070). The
// OUTPUT narratives pass the FULL guard; the disclosure/refusal copy that QUOTES banned
// terms to NEGATE them (e.g. "no score, no skin age") is exempt from the term-scan only.

export const TREND_COPY = {
  // Surface 02. The off-by-default opt-in. Honest engine framing: "your phone comparing
  // your own photos" (classical CV), NOT "AI". Default-off, separate Art. 9 consent.
  optIn: {
    title: 'Changes in your own photos',
    heading: 'Want your phone to read your own progress for you?',
    body: 'It compares your own guided photos over time and describes what changed. In words, never a number or grade.',
    bullets: [
      'Runs entirely on your phone. Your own photos comparing your own photos.',
      'No photo or result is ever uploaded. Nothing trains any AI.',
      'No score, no “skin age,” no grade, and you can turn it off anytime.',
    ],
    consentLine: 'A separate, distinct, revocable choice, never bundled with anything else.',
    toggleLabel: 'Read my progress',
    toggleHint: 'Off by default',
    saveFailedTitle: 'Choice not saved',
    saveFailedBody: 'We could not save that choice. Please try again.',
    footer: 'never default-on · installed base is re-consented, never silently enrolled',
    cta: 'Turn on reading my progress',
    decline: 'Not now',
  },
  // Surface 03. The calm output line. Surfaced ONLY above the MDC floor.
  output: {
    computedNote: 'Computed on this phone · nothing uploaded',
    afterCaptureTitle: 'After your capture',
    consistentChip: 'Consistent · adherence win',
    yourEyes: 'Your own eyes are the best judge. This is just a calm read of your own series.',
  },
  // Surface 04. The honest inconclusive states (the MDC floor).
  states: {
    floorEyebrow: 'When it won’t pretend',
    floorPrinciple:
      'The dominant failure mode is reporting noise as change. Below your own measurement-error floor, it says so honestly, and never invents a trend.',
  },
  // Surface 05. The fairness floor (Monk scale, redness-not-the-metric, the gate).
  fairness: {
    title: 'Calibrated to you',
    subtitle: 'A fairness floor, not a footnote',
    monkLabel: 'Your tone band',
    monkNote:
      'Your change threshold is set equal-or-higher for darker tones, so you are never handed a falsely confident trend.',
    rednessTitle: 'Redness is never the trend metric',
    rednessBody:
      'Colour signal is harder to read fairly across tones. Least reliable on a plain selfie. We follow texture and evenness instead.',
    gateLabel: 'Fairness check', // user-facing; the internal launch gate is B-AI-FAIRNESS
    gateNote: 'No “works for everyone” claim until a tone-stratified check shows parity. A bar the whole field has failed.',
    footer: 'higher threshold for darker tones · texture not redness · no claim until parity',
  },
  // The link from the preserved no-AI-score refusal screen into the opt-in.
  refusalLink: 'Prefer your phone to read your own progress? It’s optional, on-device, and off by default.',
  // Shown instead once opted in, so the screen does not invite enabling what is on.
  manageLink: 'Your phone is reading your own progress, on-device. Manage or turn it off.',
  // The consent-ledger body (placeholder copy. B-PRIVACY-COPY).
  consentLedgerBody:
    'On-device only · your own photos comparing your own photos · nothing uploaded, nothing trains anything · no score or grade · revocable, and your trend state is deleted when you turn it off.',
  consentVersion: 'photo-trend-insights-2026-06-13-placeholder', // BLOCKED: B-PRIVACY-COPY
} as const;

/** The descriptive narrative for a change-state. NO number, NO grade, NO verdict.
 *  These pass the FULL claim-safety guard. `n` = captures compared; `area` = a calm
 *  body-area phrase (e.g. "left cheek"). "Consistent" is framed as an adherence win. */
export function trendNarrative(state: TrendChangeState, opts: { n?: number; area?: string } = {}): string {
  const n = opts.n ?? 6;
  const area = opts.area ?? 'cheeks';
  switch (state) {
    case 'consistent':
      return `Based on your guided photos, your skin’s texture has looked consistent over your last ${n} captures.`;
    case 'change_observed':
      return `The look of evenness on your ${area} seems steadier since your first capture. Your own eyes are the best judge.`;
    case 'inconclusive_lighting':
      return 'Lighting varied too much between these to compare. Try capturing in similar light.';
    case 'insufficient_data':
      return 'No clear change to point to yet. Skin changes are usually gradual (8-12 weeks).';
  }
}
