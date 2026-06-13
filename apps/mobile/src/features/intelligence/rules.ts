import type {
  ConflictSeverity,
  EvidenceGrade,
  EvidenceLabel,
  FunctionalTag,
  InteractionType,
  ResolutionType,
} from '@onskin/types';

// Bundled offline copy of the starter conflict matrix (docs/02 §4.4/§4.8). IDs +
// data MIRROR supabase/migrations/...0013_seed_intelligence.sql exactly so a
// routine_conflicts.rule_id is consistent whether detection runs from cached-DB
// rules or this offline fallback. At runtime the engine prefers rules fetched +
// cached from the DB (docs/02 §10); this is the fallback before the first fetch.
//
// *** BLOCKED: B-DERM-REVIEW — reviewed_by is null on every rule. Nothing here
// *** ships to users until a board-certified dermatologist + cosmetic chemist
// *** sign off (docs/02 §9). The matrix grows only via versioned reviewed events.
export type ConflictRule = {
  id: string;
  tagA: FunctionalTag;
  tagB: FunctionalTag;
  interactionType: InteractionType;
  baseSeverity: ConflictSeverity;
  evidenceGrade: EvidenceGrade | null; // null = "—" (refuted myths, docs/02 §4.3)
  evidenceLabel: EvidenceLabel;
  mechanism: string;
  resolutionType: ResolutionType;
  resolutionCopy: string;
  appliesWhen: {
    subflagExempt?: string[];
    pregnancy?: boolean;
    coUseIf?: string;
    requiresHighDose?: boolean;
  } | null;
  sourceCitation: string;
  ruleVersion: number;
  reviewedBy: string | null;
};

export const STARTER_RULES: ConflictRule[] = [
  {
    id: '00000000-0000-4000-8000-000000000001',
    tagA: 'retinoid', tagB: 'aha', interactionType: 'irritation', baseSeverity: 'mild',
    evidenceGrade: 'C', evidenceLabel: 'contested',
    mechanism:
      'Both speed surface turnover; used together they can over-exfoliate and stress the barrier, especially on sensitive skin. The idea that they cancel each other out is not well supported.',
    resolutionType: 'alternate_nights',
    resolutionCopy: 'Alternate nights — keep retinol and your acid on different evenings.',
    appliesWhen: null,
    sourceCitation: "Paula's Choice; Westlake/London Derm; Glow Recipe (Dr. H. King)",
    ruleVersion: 1, reviewedBy: null,
  },
  {
    id: '00000000-0000-4000-8000-000000000002',
    tagA: 'retinoid', tagB: 'bha', interactionType: 'irritation', baseSeverity: 'mild',
    evidenceGrade: 'C', evidenceLabel: 'contested',
    mechanism:
      'As with AHAs, combining can compound irritation; some dermatologists consider retinoid + BHA potentially complementary for oilier skin.',
    resolutionType: 'alternate_nights',
    resolutionCopy: 'Alternate nights — though oilier, resistant skin may tolerate co-use.',
    appliesWhen: { coUseIf: 'resistant' },
    sourceCitation: "Glow Recipe (Dr. King); Paula's Choice",
    ruleVersion: 1, reviewedBy: null,
  },
  {
    id: '00000000-0000-4000-8000-000000000003',
    tagA: 'benzoyl_peroxide', tagB: 'retinoid', interactionType: 'stability', baseSeverity: 'moderate',
    evidenceGrade: 'C', evidenceLabel: 'established',
    mechanism:
      'Benzoyl peroxide is an oxidiser and can break simple retinol/tretinoin down on contact. Adapalene and encapsulated retinoids resist this.',
    resolutionType: 'separate_am_pm',
    resolutionCopy: 'Use benzoyl peroxide in the morning and your retinoid at night.',
    appliesWhen: { subflagExempt: ['adapalene', 'encapsulated'] },
    sourceCitation: 'Martin et al., Br. J. Dermatol. 1998',
    ruleVersion: 1, reviewedBy: null,
  },
  {
    id: '00000000-0000-4000-8000-000000000004',
    tagA: 'niacinamide', tagB: 'vitamin_c', interactionType: 'myth', baseSeverity: 'none',
    evidenceGrade: null, evidenceLabel: 'refuted',
    mechanism:
      'The flushing fear came from a 1960s study using niacin (not niacinamide) under heat. Niacinamide is stable and the two are routinely combined; they can even complement each other (brightening + barrier support).',
    resolutionType: 'reassure',
    resolutionCopy: 'These work well together — no need to separate them.',
    appliesWhen: null,
    sourceCitation: 'Clinikally; dermatology consensus',
    ruleVersion: 1, reviewedBy: null,
  },
  {
    id: '00000000-0000-4000-8000-000000000005',
    tagA: 'vitamin_c', tagB: 'aha', interactionType: 'irritation', baseSeverity: 'mild',
    evidenceGrade: 'C', evidenceLabel: 'contested',
    mechanism:
      'Chemically compatible (both favour a low pH), but doubling up potent actives can increase irritation.',
    resolutionType: 'separate_am_pm',
    resolutionCopy: 'Use vitamin C in the morning and your acid in the evening.',
    appliesWhen: null,
    sourceCitation: 'Schweiger Derm (Dr. Sue Ann Wee); commercial C+AHA products',
    ruleVersion: 1, reviewedBy: null,
  },
  {
    id: '00000000-0000-4000-8000-000000000006',
    tagA: 'copper_peptide', tagB: 'vitamin_c', interactionType: 'stability', baseSeverity: 'mild',
    evidenceGrade: 'C', evidenceLabel: 'plausible',
    mechanism:
      'Copper can speed up vitamin C oxidation, so layering them together may make the vitamin C less effective over time.',
    resolutionType: 'separate_am_pm',
    resolutionCopy: 'Vitamin C in the morning, copper peptides at night.',
    appliesWhen: null,
    sourceCitation: 'cosmetic-chemistry consensus',
    ruleVersion: 1, reviewedBy: null,
  },
  {
    id: '00000000-0000-4000-8000-000000000007',
    tagA: 'copper_peptide', tagB: 'aha', interactionType: 'stability', baseSeverity: 'mild',
    evidenceGrade: 'C', evidenceLabel: 'plausible',
    mechanism: 'Low-pH acids can destabilise peptides, so they are best kept apart.',
    resolutionType: 'separate_am_pm',
    resolutionCopy: 'Keep copper peptides and acids in separate routines.',
    appliesWhen: null,
    sourceCitation: 'cosmetic-chemistry consensus',
    ruleVersion: 1, reviewedBy: null,
  },
  {
    id: '00000000-0000-4000-8000-000000000008',
    tagA: 'aha', tagB: 'bha', interactionType: 'irritation', baseSeverity: 'moderate',
    evidenceGrade: 'C', evidenceLabel: 'plausible',
    mechanism:
      'Stacking several exfoliating acids in one session raises the chance of over-exfoliation and a stressed barrier.',
    resolutionType: 'lower_frequency',
    resolutionCopy: 'Use just one acid per session — let the others have their own night.',
    appliesWhen: null,
    sourceCitation: 'dermatology consensus',
    ruleVersion: 1, reviewedBy: null,
  },
  {
    id: '00000000-0000-4000-8000-000000000009',
    tagA: 'vitamin_c', tagB: 'sunscreen', interactionType: 'synergy', baseSeverity: 'none',
    evidenceGrade: 'C', evidenceLabel: 'plausible',
    mechanism: 'Antioxidant plus UV protection is a classic morning pairing.',
    resolutionType: 'no_change',
    resolutionCopy: 'A great morning pair — vitamin C under your SPF.',
    appliesWhen: null,
    sourceCitation: 'dermatology consensus',
    ruleVersion: 1, reviewedBy: null,
  },
  {
    id: '00000000-0000-4000-8000-00000000000a',
    tagA: 'niacinamide', tagB: 'retinoid', interactionType: 'synergy', baseSeverity: 'none',
    evidenceGrade: 'C', evidenceLabel: 'plausible',
    mechanism:
      'Niacinamide supports the barrier and can temper the dryness some people get from a retinoid.',
    resolutionType: 'no_change',
    resolutionCopy: 'These complement each other — niacinamide can ease retinoid dryness.',
    appliesWhen: null,
    sourceCitation: 'dermatology consensus',
    ruleVersion: 1, reviewedBy: null,
  },
  {
    id: '00000000-0000-4000-8000-00000000000b',
    tagA: 'retinoid', tagB: 'pregnancy', interactionType: 'safety', baseSeverity: 'high',
    evidenceGrade: 'C', evidenceLabel: 'contested',
    mechanism:
      'Many dermatologists suggest pausing topical retinoids while pregnant or breastfeeding, out of caution.',
    resolutionType: 'avoid_refer',
    resolutionCopy:
      "Many dermatologists suggest pausing retinoids while pregnant or breastfeeding. This is a conversation for you and your doctor — we've set it aside for now and can suggest a gentler alternative.",
    appliesWhen: { pregnancy: true },
    sourceCitation: 'AAD-aligned expert consensus; dermatology pregnancy/lactation reviews',
    ruleVersion: 1, reviewedBy: null,
  },
  {
    id: '00000000-0000-4000-8000-00000000000c',
    tagA: 'bha', tagB: 'pregnancy', interactionType: 'safety', baseSeverity: 'moderate',
    evidenceGrade: 'C', evidenceLabel: 'contested',
    mechanism:
      'High-dose salicylic acid is on common pregnancy-caution lists; low-dose cosmetic BHA is generally considered fine.',
    resolutionType: 'avoid_refer',
    resolutionCopy:
      "High-strength salicylic acid is often paused in pregnancy. Please check with your doctor — we've set it aside for now.",
    appliesWhen: { pregnancy: true, requiresHighDose: true },
    sourceCitation: 'pregnancy-safe-skincare consensus',
    ruleVersion: 1, reviewedBy: null,
  },
  {
    id: '00000000-0000-4000-8000-00000000000d',
    tagA: 'hydroquinone', tagB: 'pregnancy', interactionType: 'safety', baseSeverity: 'high',
    evidenceGrade: 'C', evidenceLabel: 'contested',
    mechanism: 'Cosmetic hydroquinone use is generally avoided during pregnancy and breastfeeding.',
    resolutionType: 'avoid_refer',
    resolutionCopy:
      "Hydroquinone is usually paused in pregnancy and breastfeeding. Please check with your doctor — we've set it aside for now.",
    appliesWhen: { pregnancy: true },
    sourceCitation: 'dermatology lactation reviews',
    ruleVersion: 1, reviewedBy: null,
  },
];

/**
 * Rules safe to surface to real users. B-DERM-REVIEW launch gate: in production
 * builds only rules with a recorded clinical sign-off (`reviewedBy`) are shown;
 * in development the full starter set is used so the layer is buildable/demoable.
 */
export function shippableRules(rules: ConflictRule[] = STARTER_RULES): ConflictRule[] {
  const isDev = typeof __DEV__ !== 'undefined' && __DEV__;
  return isDev ? rules : rules.filter((r) => r.reviewedBy != null);
}
