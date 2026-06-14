import type { ResolutionType } from '@onskin/types';

// Centralised, claim-safe "Ask OnSkin" copy (docs/13, the Slice-11..26 guard pattern).
// *** THE COPY IS THE REGULATED SURFACE (docs/13 §5/§10). *** Every user-facing string
// must be: worded for how skin LOOKS (cosmetic, "the appearance of"), NEVER a drug/
// disease claim ("treats/cures/heals/prevents/diagnoses" → FDA SaMD), NEVER a condition
// NAMED as a diagnosis, NEVER a dose, NEVER a superiority claim ("dermatologist-grade"/
// "more accurate than" → FTC AI-washing), NEVER alarm/urgency, and NEVER marketed as
// "AI" (a measured trust tax. Only the Art. 50 DISCLOSURE strings name the AI honestly,
// and they are exempt from the AI-marketing term-scan, like the Slice-24 pattern). The
// substantive ANSWER claims are TEMPLATE-BOUNDED from the deterministic engine, never
// free-generated (D-057); this module holds the static templates + the disclosure copy.
// Enforced by `claimsafety.test.ts`.

export const ASK_COPY = {
  home: {
    title: 'Ask OnSkin',
    pills: ['knows your shelf', 'evidence-grounded', 'private'] as const,
    intro:
      'Ask about your own shelf, routine and conflicts. I answer from OnSkin’s evidence base, and I’ll tell you when I don’t know.',
    groundedEyebrow: 'Grounded in your shelf right now',
    prompts: {
      conflict: 'Is there a conflict on my shelf?',
      tonight: 'What should I do tonight?',
      fit: 'Is this product a fit for me?',
    },
    inputPlaceholder: 'Ask about your shelf…',
    inputA11y: 'Ask a question about your shelf',
    // DISCLOSURE (EU AI Act Art. 50 / CA SB 243): names the AI honestly. Exempt from the
    // AI-marketing term-scan only. The marketing leads with independent/grounded/private.
    disclosureFooter: 'AI advisor · disclosed honestly · your context stays on this device',
  },
  // DISCLOSURE (Art. 50 / SB 243), verbatim & counsel-gated (B-AI-ASSISTANT-LEGAL). Names
  // the AI without implying medical authority, and without the empty "not medical advice"
  // disclaimer that does NOT downgrade risk (docs/13 §9/§10). AI-marketing-scan exempt.
  firstRunDisclosure:
    'Ask OnSkin is an AI advisor. It answers from OnSkin’s evidence-graded guidance and your own shelf. It isn’t a medical service, and it points you to a clinician for anything beyond skincare.',
  badges: {
    deterministic: 'answered by your conflict engine · $0',
    fitEngine: 'from your profile + the fit engine · $0',
    escalate: 'out of scope · escalate',
  },
  triad: {
    whyLabel: 'why',
    howLabel: 'how',
    whyShelf: 'Personalised to your shelf. Your own products, your own profile.',
    howConflict: 'From your conflict engine + the evidence card. Not a guess.',
    howFit: 'From your goal and shelf, scored by fit and evidence, never by commission.',
    howPlan: 'From your generated plan. Your products, in your sequence.',
  },
  recommendationNote: 'This is a recommendation, not a rule. Your routine, your call.',
  claimSafeNote: 'Worded for how skin looks, never a medical claim, never influenced by commission.',
  noConflicts: 'Nothing on your shelf clashes right now. You’re set.',
  tonight: {
    lead: 'Here’s tonight, in order:',
    exampleLead: 'Add your products and I’ll build tonight in order. Here’s an example for now:',
    cta: 'Open your plan',
    route: '/routine/plan',
    empty: 'I don’t see an evening routine yet. Add a product or two and I’ll sequence it for you.',
  },
  replenish: {
    lead: 'Here’s what your shelf says about what’s running low.',
    cta: 'Open replenishments',
    route: '/shelf/replenish',
    none: 'Nothing on your shelf is running low right now. You’re set.',
  },
  fit: {
    leadGoal: (concern: string, what: string): string =>
      `For your goal of ${concern}, an evidence-backed option to consider is ${what}.`,
    leadGeneric: (what: string): string => `An evidence-backed option worth considering for you is ${what}.`,
    youreSet:
      'Your routine looks complete. Most new products would be optional. Add one to your shelf and I’ll check it against your conflicts and fit.',
    deeperNote:
      'Want a deeper read in your own words? The fuller, evidence-grounded advisor is a Pro feature being set up.',
  },
  refuse: {
    unsupported:
      'I don’t have sourced information on that specific product yet, but I can tell you about its key ingredient if you add it to your shelf.',
    outOfScope: 'I don’t have sourced information on that yet.',
    groundedLocked:
      'I can answer about your own shelf, routine and conflicts today, for free. A deeper, evidence-grounded advisor that answers in your own words is part of OnSkin Pro.',
    groundedSetup:
      'I can answer about your own shelf, routine and conflicts today. The deeper, evidence-grounded advisor that answers broader questions in your own words is being set up.',
  },
  escalate: {
    eyebrow: 'out of scope · escalate',
    safetyEyebrow: 'safety · worth a clinician',
    body: 'That’s beyond what I can advise on. It’s worth seeing a board-certified dermatologist.',
    // No in-app dermatologist finder exists yet (deferred, B-DERM-REVIEW). Until one does, the
    // escalation is VERBAL only. We never route a medical escalation to a non-clinician
    // surface, because a misrouted CTA over-promises on the highest-stakes control (docs/13 §9).
    footnote: 'I won’t name conditions, give doses, or guess.',
  },
  privacy: {
    header: 'Before you start',
    title: 'Your context stays on your phone.',
    body: 'To answer in your own words, an abstracted summary of your question reaches a private language model. Here’s exactly what does and doesn’t leave.',
    keep: [
      'Your shelf, routine and all conflict logic run on-device.',
      'The cloud model is zero-retention and no-training, and no transcript is kept beyond a short, encrypted safety window you consent to.',
    ] as const,
    never: 'Never a raw photo, never a faceprint, never sold or shared.',
    consentLine: 'A separate ask_onskin consent. Distinct and revocable.',
    toggleLabel: 'Enable Ask OnSkin',
    toggleHint: 'Off by default',
    footer: 'Pro-gated · hard trial cap · the answers about your own shelf are always free',
  },
  // The consent-ledger body (placeholder copy. B-PRIVACY-COPY). The honest, stress-tested
  // posture (docs/13 §7): NOT "no transcript ever" but a short, consented safety window.
  consentLedgerBody:
    'On-device context · a minimised summary only, to a zero-retention, no-training cloud language layer · no transcript beyond a short, consented, encrypted safety window · never a photo, never sold, never used to train a model · revocable, and the safety window is deleted when you turn it off.',
  consentVersion: 'ask-onskin-2026-06-14-placeholder', // BLOCKED: B-PRIVACY-COPY
  // The wrong-answer feedback control (docs/13 §9. Content-free).
  feedback: {
    prompt: 'Was this helpful?',
    report: 'Report a problem',
    thanks: 'Thanks. That helps us improve the evidence behind this.',
  },
  // A calm Today entry (docs/13 §9. The first-session moat taste), never "AI" hype.
  todayCard: {
    title: 'Ask OnSkin',
    body: 'Evidence-grounded answers about your own shelf, and an honest “I don’t know.”',
  },
} as const;

/** Claim-safe resolution lead per resolution type (docs/02 §7.3, the appearance-only
 *  voice). The substantive interaction claim is the deterministic engine's; this only
 *  frames it. No drug/disease verb, no condition named, no dose. */
export const RESOLUTION_LEAD: Record<ResolutionType, string> = {
  alternate_nights: 'On the same night these can feel like a lot together on the skin',
  separate_am_pm: 'Used at the same time these can feel like a lot together on the skin',
  buffer: 'Back-to-back these can feel like a lot together on the skin',
  lower_frequency: 'Used too often together these can feel like a lot on the skin',
  no_change: 'These sit comfortably together',
  reassure: 'Good news. These sit comfortably together',
  avoid_refer: 'This one’s worth a word with your clinician',
};
