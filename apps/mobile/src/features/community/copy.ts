// Centralised community copy (docs/11 §9, the Slice-11..24 guard pattern). All
// user-facing strings live here so claimsafety.test.ts scans them: claim-safe (cosmetic
// verbs only, "for the appearance of…", never "treats/cures"), calm (no urgency/guilt),
// and carrying the mandatory "not medical advice" stance. The register is a CALM
// REFERENCE LIBRARY, never a social feed.

export const COMMUNITY_COPY = {
  hub: {
    title: 'Skin Notes',
    subtitle: 'Myth vs evidence. Expert-written, evidence-graded, calm.',
    // The defining footer: it states what this ISN'T (a feed).
    libraryFooter:
      'a library, not a feed. No likes, no authors to follow, no ranking by popularity',
    eyebrow: 'SKIN NOTES',
  },
  card: {
    claimLabel: 'The claim',
    whyLabel: 'Why',
    evidenceGradeLabel: 'Evidence grade',
    reviewedByLead: 'Reviewed by a',
    sourceLead: 'Source:',
    // The mandatory claim-safe disclaimer on every note (Flo's "not medical advice").
    disclaimer: 'General cosmetic information. For the appearance of skin, not medical advice.',
    helped: 'This helped',
    share: 'Share note',
  },
  inContext: {
    eyebrow: 'SEEN THIS ONLINE?',
    from: 'From Skin Notes',
    read: 'Read the evidence',
  },
  ask: {
    title: 'Ask anonymously',
    phaseTag: 'Unavailable',
    postingAs: 'Posting as',
    handleNote: 'a random handle · no profile, no real name',
    claimSafePassed: 'Claim-safety check passed. No “treats/cures” or dosage language.',
    claimSafeFlagged:
      'We spotted wording we’ll look at closely. A person reviews every post before it appears.',
    ageGate: 'Age confirmed 16+ · faceprints never stored',
    consentRow: 'consent. Separate & unbundled',
    preModeration:
      'Question posting is unavailable in this release. No question is accepted or sent for review.',
    submit: 'Posting unavailable',
    // Phase-2 gating notice. Peer posting is deferred behind the moderation floor.
    deferredTitle: 'Question not sent',
    deferredBody:
      'Anonymous questions remain unavailable until moderation, reviewed consent, deletion, support, and appeal workflows are staffed and verified.',
  },
  consent: {
    title: 'Join Skin Notes safely',
    body: 'Posting a question shares skin-related information with our reviewers and, once approved, with other members. Anonymously. This is a separate, unbundled choice (MHMDA / GDPR), and you can withdraw it anytime.',
    allow: 'Anonymous. A random handle, never your name or photos',
    never: 'Never sold, shared with brands, or used to train anything',
    age: 'You confirm you’re 16 or older',
    cta: 'Allow & continue',
    decline: 'Not now',
    note: 'Withdraw anytime. Your questions are then deleted.',
  },
  peopleLikeYou: {
    eyebrow: 'PEOPLE LIKE YOU',
    title: 'For you',
    subtitle: 'An anonymised pattern, never a list of people.',
    phaseTag: 'Phase 2',
    aggregateNote:
      'No peer aggregate is available until a reviewed, consented dataset is large enough to support it.',
    nevers: [
      'Never a feed of strangers’ faces',
      'Never a comparison ranking or leaderboard',
      'Never a free-text health disclosure from a stranger',
    ],
    footer: 'Unavailable until real, reviewed aggregate evidence exists.',
  },
  settingsRow: 'Skin Notes',
  consentVersion: 'community-participation-2026-06-13-placeholder', // BLOCKED: B-PRIVACY-COPY
} as const;
