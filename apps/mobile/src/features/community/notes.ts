import type { CommunityNoteKind, EvidenceLabel } from '@layerwell/types';

import { colors } from '@/theme/tokens';

// The expert-seeded "myth vs evidence" corpus (docs/11 §4). NOT peer UGC. Editorial,
// dermatologist/cosmetic-chemist-authored, claim-safe (cosmetic verbs only, "for the
// appearance of…", never "treats/cures"), and evidence-graded with the docs/02 vocab.
// The content primitive is an EXTENSION of the recommendation engine, not a new social
// object: it reuses the four evidence-label pills (Established=ink, Plausible=greige,
// Contested=clay-tint, Refuted=sage) and the sage "good news" treatment for debunked
// myths.
//
// *** BLOCKED: B-DERM-REVIEW. ReviewedBy is null on every note. In production only
// *** clinically-reviewed AND claim-safe notes surface (NOTES_REVIEWED gate, mirroring
// *** shippableRules / shippableRecTypes / shippableStacks). In dev the seeded corpus is
// *** available so the layer is buildable/demoable. *** Expert recruitment + a
// *** substantial seeded corpus are first-class costs (B-EXPERT-NETWORK).

export type SkinTopic = {
  slug: string;
  title: string;
};

export type SkinNote = {
  id: string;
  topicSlug: string;
  kind: CommunityNoteKind;
  /** The claim/question (the card title). */
  title: string;
  /** A short one-line summary for the hub list. */
  summary: string;
  /** The claim, quoted, for the detail card. */
  claim: string;
  /** The claim-safe mechanism / why. */
  why: string;
  evidenceLabel: EvidenceLabel;
  evidenceGrade: 'A' | 'B' | 'C' | null; // SORT; null = refuted myth (docs/02 §4.3)
  /** A short calm verdict chip, e.g. "Safe to combine" / "Fewer is smarter". */
  verdict: string;
  authorCredential: string;
  sourceLabel: string;
  claimSafetyOk: boolean;
  reviewedBy: string | null; // B-DERM-REVIEW: null until clinical sign-off
};

export const SKIN_TOPICS: SkinTopic[] = [
  { slug: 'ingredient-myths', title: 'Ingredient myths' },
  { slug: 'sensitive-skin', title: 'Sensitive skin' },
  { slug: 'retinoids', title: 'Retinoids' },
  { slug: 'sunscreen', title: 'Sunscreen' },
];

const DERM = 'Board-certified dermatologist';
const CHEMIST = 'Cosmetic chemist';

export const SKIN_NOTES: SkinNote[] = [
  {
    id: 'note-niacinamide-vitc',
    topicSlug: 'ingredient-myths',
    kind: 'myth_vs_evidence',
    title: 'Can you use niacinamide with vitamin C?',
    summary:
      'The “they cancel out” claim comes from decades-old raw-ingredient research. Safe to combine.',
    claim: '“Niacinamide and vitamin C cancel each other out.”',
    why: 'The myth traces to decades-old studies on raw, unformulated ingredients at high heat. In modern formulas the two are widely used together and can support a brighter-looking, more even complexion.',
    evidenceLabel: 'refuted',
    evidenceGrade: null,
    verdict: 'Safe to combine',
    authorCredential: DERM,
    sourceLabel: 'Peer-reviewed formulation literature',
    claimSafetyOk: true,
    reviewedBy: null,
  },
  {
    id: 'note-retinol-thinning',
    topicSlug: 'retinoids',
    kind: 'myth_vs_evidence',
    title: 'Does retinol thin your skin?',
    summary: 'It thickens the deeper dermis over time; surface flaking early on is not thinning.',
    claim: '“Retinol thins your skin.”',
    why: 'Over time retinoids support a thicker, firmer-looking deeper layer. The flaking some people notice when starting is surface cell turnover settling in, not the skin becoming thinner.',
    evidenceLabel: 'refuted',
    evidenceGrade: null,
    verdict: 'The opposite, over time',
    authorCredential: DERM,
    sourceLabel: 'Dermatology consensus',
    claimSafetyOk: true,
    reviewedBy: null,
  },
  {
    id: 'note-glass-skin',
    topicSlug: 'sensitive-skin',
    kind: 'myth_vs_evidence',
    title: 'Is a 10-step “glass skin” routine better?',
    summary:
      'For sensitive skin, fewer and smarter usually beats more. Layering raises irritation risk.',
    claim: '“A 10-step ‘glass skin’ routine is better for your skin.”',
    why: 'For sensitive or reactive skin, more steps and more actives raise the chance of irritation. A short, considered routine. Cleanse, treat, moisturise, protect. Is usually kinder and just as effective.',
    evidenceLabel: 'contested',
    evidenceGrade: 'C',
    verdict: 'Fewer is often smarter',
    authorCredential: DERM,
    sourceLabel: 'Dermatology consensus; skinimalism literature',
    claimSafetyOk: true,
    reviewedBy: null,
  },
  {
    id: 'note-spf-waiting',
    topicSlug: 'sunscreen',
    kind: 'myth_vs_evidence',
    title: 'Do you have to wait between skincare steps?',
    summary: 'Mostly no. Layering onto slightly damp skin is fine for most routines.',
    claim: '“You must wait 20-30 minutes between every skincare step.”',
    why: 'For most everyday routines, layering products onto slightly damp skin works well. Long waits between steps aren’t needed for them to do their job.',
    evidenceLabel: 'refuted',
    evidenceGrade: null,
    verdict: 'Usually unnecessary',
    authorCredential: CHEMIST,
    sourceLabel: 'Cosmetic-chemistry consensus',
    claimSafetyOk: true,
    reviewedBy: null,
  },
  {
    id: 'note-diy-sunscreen',
    topicSlug: 'sunscreen',
    kind: 'myth_vs_evidence',
    title: 'Is homemade sunscreen as protective as store-bought?',
    summary: 'No. Homemade mixes can’t be measured for protection. Use a tested SPF.',
    claim: '“Homemade sunscreen protects as well as a store-bought SPF.”',
    why: 'A finished SPF is tested so its protection can be measured and relied on. A homemade mix can’t be, so the level of protection is unknown. A daily tested SPF is the dependable choice.',
    evidenceLabel: 'refuted',
    evidenceGrade: null,
    verdict: 'Use a tested SPF',
    authorCredential: DERM,
    sourceLabel: 'Dermatology consensus',
    claimSafetyOk: true,
    reviewedBy: null,
  },
  {
    id: 'note-natural-gentler',
    topicSlug: 'sensitive-skin',
    kind: 'myth_vs_evidence',
    title: 'Is “natural” always gentler for sensitive skin?',
    summary: 'Not necessarily. Some plant extracts and essential oils are common irritants.',
    claim: '“Natural ingredients are always gentler.”',
    why: '“Natural” isn’t the same as “gentle”. Some botanical extracts and essential oils are among the more common triggers for sensitive skin, while many lab-made ingredients are very well tolerated.',
    evidenceLabel: 'contested',
    evidenceGrade: 'C',
    verdict: 'Depends on the ingredient',
    authorCredential: DERM,
    sourceLabel: 'Dermatology consensus',
    claimSafetyOk: true,
    reviewedBy: null,
  },
];

/**
 * Launch gate (B-DERM-REVIEW), mirroring shippableRules() / shippableRecTypes() /
 * shippableStacks(). In production only clinically-reviewed notes surface; in dev the
 * full seeded corpus is used so the layer is demoable. A note must ALSO pass the
 * claim-safety guard (claimSafetyOk) to ship. The same belt-and-suspenders the
 * community_notes RLS enforces (reviewed_by IS NOT NULL AND claim_safety_ok).
 */
export const NOTES_REVIEWED = false;

export function shippableNotes(notes: SkinNote[] = SKIN_NOTES): SkinNote[] {
  const isDev = typeof __DEV__ !== 'undefined' && __DEV__;
  const claimSafe = notes.filter((n) => n.claimSafetyOk);
  return isDev ? claimSafe : claimSafe.filter((n) => n.reviewedBy != null);
}

export function noteById(id: string, notes: SkinNote[] = SKIN_NOTES): SkinNote | undefined {
  return shippableNotes(notes).find((n) => n.id === id);
}

/** Notes grouped by topic, in topic sort order (for the hub). */
export function notesByTopic(
  notes: SkinNote[] = SKIN_NOTES,
): { topic: SkinTopic; notes: SkinNote[] }[] {
  const shippable = shippableNotes(notes);
  return SKIN_TOPICS.map((topic) => ({
    topic,
    notes: shippable.filter((n) => n.topicSlug === topic.slug),
  })).filter((g) => g.notes.length > 0);
}

/** Map a docs/02 conflict rule's tag-pair to a Skin Note, so the trust layer can
 *  reinforce the recommendation/conflict "how" exactly where the doubt lands (§9.2).
 *  Order-independent. Returns a SHIPPABLE note id, or undefined. */
export function noteForTags(
  tagA: string,
  tagB: string,
  notes: SkinNote[] = SKIN_NOTES,
): string | undefined {
  const pair = new Set([tagA, tagB]);
  if (pair.has('niacinamide') && pair.has('vitamin_c')) {
    return shippableNotes(notes).find((n) => n.id === 'note-niacinamide-vitc')?.id;
  }
  return undefined;
}

/** The evidence-label pill (docs/02 vocab). Refuted=sage "good news", contested=clay,
 *  plausible=greige, established=ink. TEXT label + colours (never colour alone, §11). */
export function evidencePill(label: EvidenceLabel): { text: string; bg: string; fg: string } {
  switch (label) {
    case 'refuted':
      return { text: 'Refuted', bg: colors.sageTint, fg: colors.sage };
    case 'contested':
      return { text: 'Contested', bg: colors.clayTint, fg: colors.clayDeep };
    case 'plausible':
      return { text: 'Plausible', bg: colors.greigeChip, fg: colors.mutedStrong };
    case 'established':
      return { text: 'Established', bg: colors.ink, fg: colors.paper };
  }
}
