import { BRAND } from '@/lib/brand';

// Centralised, claim-safe Ask copy (docs/13, the Slice-11..26 guard pattern).
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
    title: BRAND.askName,
    pills: ['uses your shelf', 'shows its limits', 'on-device routine tools'] as const,
    intro:
      'Ask about your saved shelf and routine. Interaction guidance stays unavailable unless exact reviewed coverage exists.',
    groundedEyebrow: 'Uses your saved shelf context',
    prompts: {
      conflict: 'Is there a conflict on my shelf?',
      tonight: 'What should I do tonight?',
      fit: 'Is this product a fit for me?',
    },
    inputPlaceholder: 'Ask about your shelf…',
    inputA11y: 'Ask a question about your shelf',
    // DISCLOSURE (EU AI Act Art. 50 / CA SB 243): names the AI honestly. Exempt from the
    // AI-marketing term-scan only. The marketing leads with independent/grounded/private.
    disclosureFooter: 'Cloud Ask is unavailable in this release',
  },
  // DISCLOSURE (Art. 50 / SB 243), verbatim & counsel-gated (B-AI-ASSISTANT-LEGAL). Names
  // the AI without implying medical authority, and without the empty "not medical advice"
  // disclaimer that does NOT downgrade risk (docs/13 §9/§10). AI-marketing-scan exempt.
  firstRunDisclosure: `${BRAND.askName} uses deterministic on-device shelf and routine tools in this release. Cloud Ask is unavailable. It is not a medical service and will not answer medical questions.`,
  badges: {
    deterministic: 'shelf interaction status · $0',
    fitEngine: 'from your saved profile + shelf · $0',
    escalate: 'out of scope · escalate',
  },
  triad: {
    whyLabel: 'why',
    howLabel: 'how',
    whyShelf: 'Personalised to your shelf. Your own products, your own profile.',
    howConflict:
      'From exact admitted rules for the resolved product pair. Otherwise, guidance stays unavailable.',
    howFit: 'From your saved goal and shelf, never by commission.',
    howPlan: 'From your generated plan. Your products, in your sequence.',
  },
  recommendationNote: 'This is a recommendation, not a rule. Your routine, your call.',
  claimSafeNote:
    'Worded for how skin looks, never a medical claim, never influenced by commission.',
  noConflicts: 'Nothing on your shelf clashes right now. You’re set.',
  conflictCoverageUnavailable:
    'Interaction guidance requires completed independent professional review for these shelf pairs, so I cannot call them compatible.',
  noConflictPair:
    'There is not a product pair on your shelf to check yet. Add another product and I will check the pair.',
  emptyShelfConflict:
    'I do not see products on your shelf yet. Add them and I will check real pairs instead of guessing.',
  tonight: {
    lead: 'Here’s tonight, in order:',
    exampleLead: 'Add your products and I’ll build tonight in order. Here’s an example for now:',
    cta: 'Open your plan',
    route: '/routine/plan',
    empty: 'I don’t see an evening routine yet. Add a product or two and I’ll sequence it for you.',
  },
  replenish: {
    lead: 'Here’s what your shelf says needs a freshness or finished-product review.',
    cta: 'Review shelf suggestions',
    route: '/recommendations',
    none: 'No tracked freshness dates or finished products need review right now. You’re set.',
  },
  fit: {
    leadGoal: (concern: string, what: string): string =>
      `For your goal of ${concern}, a routine option to consider is ${what}.`,
    leadGeneric: (what: string): string => `A routine option worth considering for you is ${what}.`,
    youreSet:
      'Your routine looks complete. Most new products would be optional. Add one to your shelf and I’ll check it against your conflicts and fit.',
    deeperNote: 'Cloud Ask is not included in this release.',
  },
  refuse: {
    unsupported:
      'I don’t have sourced information on that specific product yet, but I can tell you about its key ingredient if you add it to your shelf.',
    outOfScope: 'I don’t have sourced information on that yet.',
    groundedLocked:
      'Cloud Ask is unavailable in this release. I can only use the deterministic on-device shelf and routine tools that are currently available.',
    groundedSetup:
      'Cloud Ask is unavailable in this release. No shelf summary is sent to a language model.',
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
    title: 'Cloud Ask is unavailable.',
    body:
      'No shelf summary is sent to a cloud model in this release. An approved provider, exact disclosures, explicit permission, deletion controls, safety validation, and professional review are required first.',
    keep: [
      'Available shelf and routine tools run on-device.',
      'No cloud language provider is configured for this release.',
    ] as const,
    never: 'No shelf summary or question is transmitted to a cloud model.',
    consentLine: 'The cloud feature cannot be enabled in this release.',
    toggleLabel: `${BRAND.askName} unavailable`,
    toggleHint: 'Unavailable',
    saveFailedTitle: 'Choice not saved',
    saveFailedBody: `We could not save that ${BRAND.askName} choice. Please try again.`,
    footer: 'Cloud Ask is not included in this release',
  },
  // The consent-ledger body is a placeholder until a provider and exact privacy contract exist.
  consentLedgerBody:
    'Cloud Ask is unavailable in this release. No shelf summary is sent to a cloud model until an approved provider, exact transmitted-field and retention disclosures, explicit permission, deletion controls, safety validation, and professional review are in place.',
  consentVersion: 'ask-advisor-2026-06-14-placeholder', // BLOCKED: B-PRIVACY-COPY
  // The wrong-answer feedback control (docs/13 §9. Content-free).
  feedback: {
    prompt: 'Was this helpful?',
    report: 'Report a problem',
    thanks: 'Thanks. That helps us improve this feature.',
  },
  // A calm Today entry (docs/13 §9. The first-session moat taste), never "AI" hype.
  todayCard: {
    title: BRAND.askName,
    body: 'On-device shelf and routine tools that show when guidance is unavailable.',
  },
} as const;
