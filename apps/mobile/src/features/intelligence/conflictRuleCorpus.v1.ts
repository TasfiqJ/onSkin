import type {
  ConflictSeverity,
  EvidenceGrade,
  EvidenceLabel,
  FunctionalTag,
  InteractionType,
  ResolutionType,
} from '@layerwell/types';

// Canonical bundled candidate corpus for the conflict matrix (docs/02 sections 4.4/4.8). IDs +
// The legacy ids stay aligned with the database fixture, but this TypeScript
// corpus is the only mobile source for rule content and presentation copy.
// It is deliberately draft_blocked and has no review receipts, so it admits
// zero production rules.
type CandidateConflictRuleRow = {
  id: string;
  tagA: FunctionalTag;
  tagB: FunctionalTag;
  interactionType: InteractionType;
  baseSeverity: ConflictSeverity;
  evidenceGrade: EvidenceGrade | null;
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

export type ConflictSafetyContext =
  | 'pregnant'
  | 'breastfeeding'
  | 'trying'
  | 'unknown'
  | 'prefer_not';

export type ConflictConstraint<T> =
  | { status: 'review_required' }
  | { status: 'not_applicable' }
  | { status: 'exact'; value: T };

export type ConflictParticipantApplicability = {
  moleculeIds: ConflictConstraint<readonly string[]>;
  finishedProductIds: ConflictConstraint<readonly string[]>;
  finishedFormulationIds: ConflictConstraint<readonly string[]>;
  concentration: ConflictConstraint<{
    unit: '%' | 'mg/ml' | 'unknown_unit';
    minInclusive: number | null;
    maxInclusive: number | null;
  }>;
  applicationAmount: ConflictConstraint<{
    unit: 'pea_sized' | 'drops' | 'ml' | 'unknown_unit';
    minInclusive: number | null;
    maxInclusive: number | null;
  }>;
  applicationArea: ConflictConstraint<readonly string[]>;
  frequencyPerWeek: ConflictConstraint<{ minInclusive: number; maxInclusive: number }>;
  durationDays: ConflictConstraint<{ minInclusive: number; maxInclusive: number | null }>;
  ph: ConflictConstraint<{ minInclusive: number; maxInclusive: number }>;
  vehicle: ConflictConstraint<readonly string[]>;
  occlusion: ConflictConstraint<boolean>;
  barrierCondition: ConflictConstraint<readonly ('intact' | 'compromised' | 'unknown')[]>;
  exposure: ConflictConstraint<'leave_on' | 'rinse_off'>;
};

export type ConflictApplicabilityConditions = {
  tagA: ConflictParticipantApplicability;
  tagB: ConflictParticipantApplicability;
  reproductiveContexts: ConflictConstraint<readonly ConflictSafetyContext[]>;
};

export type ConflictRuleApplicability = {
  reviewStatus: 'review_required' | 'reviewed';
  approvedConditions: ConflictApplicabilityConditions;
  severityBranches: readonly {
    branchId: string;
    severity: ConflictSeverity;
    conditions: ConflictApplicabilityConditions;
  }[];
  coUseSensitivity: null;
  concentration: 'any' | 'confirmed_high_or_unknown';
  safetyContexts: readonly ConflictSafetyContext[];
  ingredientScope: {
    mode: 'functional_tag' | 'named_molecules';
    tag: FunctionalTag | null;
    molecules: readonly string[];
    formulationExemptions: readonly {
      finishedFormulationId: string;
      scope: 'finished_formulation_only';
      evidenceRequired: true;
    }[];
  };
};

export type ConflictRuleCopy = {
  detailTitle: string;
  bannerTitle: string;
  bannerSubhead: string;
  severityLabel: string;
  evidenceLabel: string;
  interactionLabel: string;
  mechanism: string;
  resolution: string;
  sourceSummary: string;
  sourceLimitationTitle: string;
  sourceLimitationBody: string;
  primaryActionLabel: string;
  overrideActionLabel: string | null;
  askHeadline: string;
  askClaim: string;
  shareTitle: string;
  shareClaim: string;
  shareActionLabel: string;
};

export const CONFLICT_NON_VARIABLE_SEVERITY_LABEL =
  'Severity: varies by reviewed product context' as const;

export type ConflictRuleReplacement = { mode: 'none' } | { mode: 'defer_to_clinician' };

export type ConflictRuleContent = CandidateConflictRuleRow & {
  candidateDisposition: 'candidate_unreviewed' | 'held_unreviewed' | 'reviewed';
  pairKey: string;
  sourceIds: readonly string[];
  applicability: ConflictRuleApplicability;
  copy: ConflictRuleCopy;
  replacement: ConflictRuleReplacement;
};

export type ConflictRuleAdmission = {
  status: 'approved';
  corpusSha256: string;
  receiptIds: readonly [string, string, string];
  reviewerRoles: readonly [
    'board_certified_dermatologist',
    'cosmetic_chemist',
    'regulatory_counsel',
  ];
};

export type ConflictRule = ConflictRuleContent & {
  corpusSha256: string;
  ruleContentSha256: string;
  admission?: ConflictRuleAdmission;
};

const CANDIDATE_RULE_ROWS: CandidateConflictRuleRow[] = [
  {
    id: '00000000-0000-4000-8000-000000000001',
    tagA: 'retinoid',
    tagB: 'aha',
    interactionType: 'irritation',
    baseSeverity: 'mild',
    evidenceGrade: 'C',
    evidenceLabel: 'contested',
    mechanism:
      'Both speed surface turnover; used together they can over-exfoliate and stress the barrier, especially on sensitive skin. The idea that they cancel each other out is not well supported.',
    resolutionType: 'alternate_nights',
    resolutionCopy: 'Alternate nights. Keep retinol and your acid on different evenings.',
    appliesWhen: null,
    sourceCitation: "Paula's Choice; Westlake/London Derm; Glow Recipe (Dr. H. King)",
    ruleVersion: 1,
    reviewedBy: null,
  },
  {
    id: '00000000-0000-4000-8000-000000000002',
    tagA: 'retinoid',
    tagB: 'bha',
    interactionType: 'irritation',
    baseSeverity: 'mild',
    evidenceGrade: 'C',
    evidenceLabel: 'contested',
    mechanism: 'Using a retinoid and BHA together may compound irritation and barrier stress.',
    resolutionType: 'alternate_nights',
    resolutionCopy: 'Alternate nights. Keep your retinoid and BHA on different evenings.',
    appliesWhen: null,
    sourceCitation: "Glow Recipe (Dr. King); Paula's Choice",
    ruleVersion: 1,
    reviewedBy: null,
  },
  {
    id: '00000000-0000-4000-8000-000000000003',
    tagA: 'benzoyl_peroxide',
    tagB: 'retinoid',
    interactionType: 'stability',
    baseSeverity: 'moderate',
    evidenceGrade: 'C',
    evidenceLabel: 'established',
    mechanism:
      'Benzoyl peroxide can reduce stability for some retinoid molecules. Compatibility must be reviewed for the exact molecule and finished formulation.',
    resolutionType: 'separate_am_pm',
    resolutionCopy: 'Use benzoyl peroxide in the morning and your retinoid at night.',
    appliesWhen: null,
    sourceCitation: 'Martin et al., Br. J. Dermatol. 1998',
    ruleVersion: 1,
    reviewedBy: null,
  },
  {
    id: '00000000-0000-4000-8000-000000000004',
    tagA: 'niacinamide',
    tagB: 'vitamin_c',
    interactionType: 'myth',
    baseSeverity: 'none',
    evidenceGrade: null,
    evidenceLabel: 'refuted',
    mechanism:
      'A 1963 laboratory study examined nicotinamide and ascorbic acid under conditions that do not establish a routine-use incompatibility.',
    resolutionType: 'reassure',
    resolutionCopy: 'This draft rule does not require separation.',
    appliesWhen: null,
    sourceCitation: '1963 nicotinamide and ascorbic-acid laboratory study; review pending',
    ruleVersion: 1,
    reviewedBy: null,
  },
  {
    id: '00000000-0000-4000-8000-000000000005',
    tagA: 'vitamin_c',
    tagB: 'aha',
    interactionType: 'irritation',
    baseSeverity: 'mild',
    evidenceGrade: 'C',
    evidenceLabel: 'contested',
    mechanism:
      'Chemically compatible (both favour a low pH), but doubling up potent actives can increase irritation.',
    resolutionType: 'separate_am_pm',
    resolutionCopy: 'Use vitamin C in the morning and your acid in the evening.',
    appliesWhen: null,
    sourceCitation: 'Schweiger Derm (Dr. Sue Ann Wee); commercial C+AHA products',
    ruleVersion: 1,
    reviewedBy: null,
  },
  {
    id: '00000000-0000-4000-8000-000000000006',
    tagA: 'copper_peptide',
    tagB: 'vitamin_c',
    interactionType: 'stability',
    baseSeverity: 'mild',
    evidenceGrade: 'C',
    evidenceLabel: 'plausible',
    mechanism:
      'Copper can speed up vitamin C oxidation, so layering them together may make the vitamin C less effective over time.',
    resolutionType: 'separate_am_pm',
    resolutionCopy: 'Vitamin C in the morning, copper peptides at night.',
    appliesWhen: null,
    sourceCitation: 'cosmetic-chemistry consensus',
    ruleVersion: 1,
    reviewedBy: null,
  },
  {
    id: '00000000-0000-4000-8000-000000000007',
    tagA: 'copper_peptide',
    tagB: 'aha',
    interactionType: 'stability',
    baseSeverity: 'mild',
    evidenceGrade: 'C',
    evidenceLabel: 'plausible',
    mechanism: 'Low-pH acids can destabilise peptides, so they are best kept apart.',
    resolutionType: 'separate_am_pm',
    resolutionCopy: 'Keep copper peptides and acids in separate routines.',
    appliesWhen: null,
    sourceCitation: 'cosmetic-chemistry consensus',
    ruleVersion: 1,
    reviewedBy: null,
  },
  {
    id: '00000000-0000-4000-8000-000000000008',
    tagA: 'aha',
    tagB: 'bha',
    interactionType: 'irritation',
    baseSeverity: 'moderate',
    evidenceGrade: 'C',
    evidenceLabel: 'plausible',
    mechanism:
      'Stacking several exfoliating acids in one session raises the chance of over-exfoliation and a stressed barrier.',
    resolutionType: 'lower_frequency',
    resolutionCopy: 'Use just one acid per session. Let the others have their own night.',
    appliesWhen: null,
    sourceCitation: 'dermatology consensus',
    ruleVersion: 1,
    reviewedBy: null,
  },
  {
    id: '00000000-0000-4000-8000-000000000009',
    tagA: 'vitamin_c',
    tagB: 'sunscreen',
    interactionType: 'synergy',
    baseSeverity: 'none',
    evidenceGrade: 'C',
    evidenceLabel: 'plausible',
    mechanism: 'Antioxidant plus UV protection is a classic morning pairing.',
    resolutionType: 'no_change',
    resolutionCopy: 'A great morning pair. Vitamin C under your SPF.',
    appliesWhen: null,
    sourceCitation: 'dermatology consensus',
    ruleVersion: 1,
    reviewedBy: null,
  },
  {
    id: '00000000-0000-4000-8000-00000000000a',
    tagA: 'niacinamide',
    tagB: 'retinoid',
    interactionType: 'synergy',
    baseSeverity: 'none',
    evidenceGrade: 'C',
    evidenceLabel: 'plausible',
    mechanism:
      'Niacinamide supports the barrier and can temper the dryness some people get from a retinoid.',
    resolutionType: 'no_change',
    resolutionCopy: 'These complement each other. Niacinamide can ease retinoid dryness.',
    appliesWhen: null,
    sourceCitation: 'dermatology consensus',
    ruleVersion: 1,
    reviewedBy: null,
  },
  {
    id: '00000000-0000-4000-8000-00000000000b',
    tagA: 'retinoid',
    tagB: 'pregnancy',
    interactionType: 'safety',
    baseSeverity: 'high',
    evidenceGrade: 'C',
    evidenceLabel: 'contested',
    mechanism:
      'Many dermatologists suggest pausing topical retinoids during pregnancy, out of caution.',
    resolutionType: 'avoid_refer',
    resolutionCopy:
      'Many dermatologists suggest pausing retinoids during pregnancy. Please check with your doctor before using it.',
    appliesWhen: { pregnancy: true },
    sourceCitation: 'AAD-aligned expert consensus; dermatology pregnancy/lactation reviews',
    ruleVersion: 1,
    reviewedBy: null,
  },
  {
    id: '00000000-0000-4000-8000-00000000000c',
    tagA: 'bha',
    tagB: 'pregnancy',
    interactionType: 'safety',
    baseSeverity: 'moderate',
    evidenceGrade: 'C',
    evidenceLabel: 'contested',
    mechanism:
      'High-dose salicylic acid is on common pregnancy-caution lists; low-dose cosmetic BHA is generally considered fine.',
    resolutionType: 'avoid_refer',
    resolutionCopy:
      'High-strength salicylic acid is often paused in pregnancy. Please check with your doctor before using it.',
    appliesWhen: { pregnancy: true, requiresHighDose: true },
    sourceCitation: 'pregnancy-safe-skincare consensus',
    ruleVersion: 1,
    reviewedBy: null,
  },
  {
    id: '00000000-0000-4000-8000-00000000000d',
    tagA: 'hydroquinone',
    tagB: 'pregnancy',
    interactionType: 'safety',
    baseSeverity: 'high',
    evidenceGrade: 'C',
    evidenceLabel: 'contested',
    mechanism: 'Cosmetic hydroquinone use is generally paused during pregnancy.',
    resolutionType: 'avoid_refer',
    resolutionCopy:
      'Hydroquinone is usually paused during pregnancy. Please check with your doctor before using it.',
    appliesWhen: { pregnancy: true },
    sourceCitation: 'dermatology lactation reviews',
    ruleVersion: 1,
    reviewedBy: null,
  },
];

export type ConflictSourceRecord = {
  id: string;
  citation: string;
  retainedArtifactId: string | null;
  retainedArtifactRef: string | null;
  retainedArtifactSha256: string | null;
  reviewStatus: 'candidate_unreviewed' | 'held_unreviewed' | 'reviewed';
};

const SOURCE_REGISTRY: ConflictSourceRecord[] = [
  {
    id: 'src-retinoid-acids-candidate',
    citation: "Paula's Choice; Westlake/London Derm; Glow Recipe (Dr. H. King)",
    retainedArtifactId: null,
    retainedArtifactRef: null,
    retainedArtifactSha256: null,
    reviewStatus: 'candidate_unreviewed',
  },
  {
    id: 'src-bp-retinoid-martin-1998-candidate',
    citation: 'Martin et al., Br. J. Dermatol. 1998',
    retainedArtifactId: null,
    retainedArtifactRef: null,
    retainedArtifactSha256: null,
    reviewStatus: 'candidate_unreviewed',
  },
  {
    id: 'src-niacinamide-vitamin-c-1963-candidate',
    citation: '1963 nicotinamide and ascorbic-acid laboratory study; review pending',
    retainedArtifactId: null,
    retainedArtifactRef: null,
    retainedArtifactSha256: null,
    reviewStatus: 'candidate_unreviewed',
  },
  {
    id: 'src-vitamin-c-aha-candidate',
    citation: 'Schweiger Derm (Dr. Sue Ann Wee); commercial C+AHA products',
    retainedArtifactId: null,
    retainedArtifactRef: null,
    retainedArtifactSha256: null,
    reviewStatus: 'candidate_unreviewed',
  },
  {
    id: 'src-copper-peptide-candidate-held',
    citation: 'cosmetic-chemistry evidence packet pending',
    retainedArtifactId: null,
    retainedArtifactRef: null,
    retainedArtifactSha256: null,
    reviewStatus: 'held_unreviewed',
  },
  {
    id: 'src-dermatology-consensus-candidate',
    citation: 'dermatology consensus',
    retainedArtifactId: null,
    retainedArtifactRef: null,
    retainedArtifactSha256: null,
    reviewStatus: 'candidate_unreviewed',
  },
  {
    id: 'src-pregnancy-retinoid-candidate',
    citation: 'AAD-aligned expert consensus; dermatology pregnancy/lactation reviews',
    retainedArtifactId: null,
    retainedArtifactRef: null,
    retainedArtifactSha256: null,
    reviewStatus: 'candidate_unreviewed',
  },
  {
    id: 'src-pregnancy-bha-candidate',
    citation: 'pregnancy-safe-skincare consensus',
    retainedArtifactId: null,
    retainedArtifactRef: null,
    retainedArtifactSha256: null,
    reviewStatus: 'candidate_unreviewed',
  },
  {
    id: 'src-pregnancy-hydroquinone-candidate',
    citation: 'dermatology lactation reviews',
    retainedArtifactId: null,
    retainedArtifactRef: null,
    retainedArtifactSha256: null,
    reviewStatus: 'candidate_unreviewed',
  },
];

const SOURCE_IDS_BY_RULE_ID: Record<string, readonly string[]> = {
  '00000000-0000-4000-8000-000000000001': ['src-retinoid-acids-candidate'],
  '00000000-0000-4000-8000-000000000002': ['src-retinoid-acids-candidate'],
  '00000000-0000-4000-8000-000000000003': ['src-bp-retinoid-martin-1998-candidate'],
  '00000000-0000-4000-8000-000000000004': ['src-niacinamide-vitamin-c-1963-candidate'],
  '00000000-0000-4000-8000-000000000005': ['src-vitamin-c-aha-candidate'],
  '00000000-0000-4000-8000-000000000006': ['src-copper-peptide-candidate-held'],
  '00000000-0000-4000-8000-000000000007': ['src-copper-peptide-candidate-held'],
  '00000000-0000-4000-8000-000000000008': ['src-dermatology-consensus-candidate'],
  '00000000-0000-4000-8000-000000000009': ['src-dermatology-consensus-candidate'],
  '00000000-0000-4000-8000-00000000000a': ['src-dermatology-consensus-candidate'],
  '00000000-0000-4000-8000-00000000000b': ['src-pregnancy-retinoid-candidate'],
  '00000000-0000-4000-8000-00000000000c': ['src-pregnancy-bha-candidate'],
  '00000000-0000-4000-8000-00000000000d': ['src-pregnancy-hydroquinone-candidate'],
};

const HELD_RULE_IDS = new Set([
  '00000000-0000-4000-8000-000000000006',
  '00000000-0000-4000-8000-000000000007',
]);

function pairKey(tagA: FunctionalTag, tagB: FunctionalTag): string {
  return [tagA, tagB].sort().join('|');
}

function ingredientScopeFor(
  row: CandidateConflictRuleRow,
): ConflictRuleApplicability['ingredientScope'] {
  if (row.id === '00000000-0000-4000-8000-000000000003') {
    return {
      mode: 'named_molecules',
      tag: 'retinoid',
      molecules: ['tretinoin'],
      // No generic adapalene/encapsulation exemption. A future exemption must
      // name an exact validated finished formulation.
      formulationExemptions: [],
    };
  }
  return {
    mode: 'functional_tag',
    tag: null,
    molecules: [],
    formulationExemptions: [],
  };
}

function candidateConditionsFor(
  row: CandidateConflictRuleRow,
  safetyContexts: readonly ConflictSafetyContext[],
): ConflictApplicabilityConditions {
  const reviewRequired = { status: 'review_required' } as const;
  const notApplicable = { status: 'not_applicable' } as const;
  const participant = (tag: FunctionalTag): ConflictParticipantApplicability => {
    const defaultConstraint = tag === 'pregnancy' ? notApplicable : reviewRequired;
    return {
      moleculeIds:
        row.id === '00000000-0000-4000-8000-000000000003' && tag === 'retinoid'
          ? { status: 'exact', value: ['tretinoin'] }
          : defaultConstraint,
      finishedProductIds: defaultConstraint,
      finishedFormulationIds: defaultConstraint,
      concentration: defaultConstraint,
      applicationAmount: defaultConstraint,
      applicationArea: defaultConstraint,
      frequencyPerWeek: defaultConstraint,
      durationDays: defaultConstraint,
      ph: defaultConstraint,
      vehicle: defaultConstraint,
      occlusion: defaultConstraint,
      barrierCondition: defaultConstraint,
      exposure: defaultConstraint,
    };
  };
  return {
    tagA: participant(row.tagA),
    tagB: participant(row.tagB),
    reproductiveContexts:
      safetyContexts.length > 0
        ? { status: 'exact', value: safetyContexts }
        : { status: 'not_applicable' },
  };
}

const COPY_TAG_LABEL: Partial<Record<FunctionalTag, string>> = {
  retinoid: 'Retinoid',
  aha: 'AHA',
  bha: 'BHA',
  benzoyl_peroxide: 'Benzoyl peroxide',
  vitamin_c: 'Vitamin C',
  niacinamide: 'Niacinamide',
  copper_peptide: 'Copper peptides',
  hydroquinone: 'Hydroquinone',
  sunscreen: 'Sunscreen',
  pregnancy: 'Pregnancy',
};

function copyTagLabel(tag: FunctionalTag): string {
  return COPY_TAG_LABEL[tag] ?? tag;
}

function interactionLabel(interactionType: InteractionType): string {
  return `Interaction: ${interactionType}`;
}

function toRuleContent(row: CandidateConflictRuleRow): ConflictRuleContent {
  // Pregnancy and breastfeeding require distinct reviewed rows and copy.
  // This v1 candidate has pregnancy-tagged rows only. Other cautious contexts
  // remain unsupported_unreviewed rather than borrowing pregnancy guidance.
  const safetyContexts: readonly ConflictSafetyContext[] = row.appliesWhen?.pregnancy
    ? ['pregnant']
    : [];
  const detailTitle = `${copyTagLabel(row.tagA)} × ${copyTagLabel(row.tagB)}`;
  const sourceSummary = `${row.sourceCitation.replace(/[.\s]+$/u, '')}.`;
  return {
    ...row,
    candidateDisposition: HELD_RULE_IDS.has(row.id) ? 'held_unreviewed' : 'candidate_unreviewed',
    pairKey: pairKey(row.tagA, row.tagB),
    sourceIds: SOURCE_IDS_BY_RULE_ID[row.id] ?? [],
    applicability: {
      reviewStatus: 'review_required',
      approvedConditions: candidateConditionsFor(row, safetyContexts),
      severityBranches: [],
      coUseSensitivity: null,
      concentration: row.appliesWhen?.requiresHighDose ? 'confirmed_high_or_unknown' : 'any',
      safetyContexts,
      ingredientScope: ingredientScopeFor(row),
    },
    copy: {
      detailTitle,
      bannerTitle: detailTitle,
      bannerSubhead: row.resolutionCopy,
      severityLabel: `Severity: ${row.baseSeverity}`,
      evidenceLabel: `Evidence: ${row.evidenceLabel}`,
      interactionLabel: interactionLabel(row.interactionType),
      mechanism: row.mechanism,
      resolution: row.resolutionCopy,
      sourceSummary,
      sourceLimitationTitle: 'Source context',
      sourceLimitationBody: sourceSummary,
      primaryActionLabel:
        row.interactionType === 'safety' ? 'Review safety setting' : 'Acknowledge guidance',
      overrideActionLabel:
        row.interactionType === 'safety' ||
        row.interactionType === 'myth' ||
        row.interactionType === 'synergy'
          ? null
          : 'Choose use together',
      askHeadline: detailTitle,
      askClaim: row.resolutionCopy,
      shareTitle: detailTitle,
      shareClaim: row.resolutionCopy,
      shareActionLabel: 'Share guidance',
    },
    replacement:
      row.interactionType === 'safety' ? { mode: 'defer_to_clinician' } : { mode: 'none' },
  };
}

export type ConflictRuleCorpusContent = {
  schemaVersion: 1;
  corpusVersion: 1;
  targetJurisdictions: readonly string[];
  marketScopePolicyId: string;
  marketScopeSha256: string;
  profileContextContract: {
    storedValue: 'pregnant';
    semanticValue: 'pregnant_or_trying_combined';
    sourceDocumentPath: 'apps/mobile/src/features/onboarding/quizContract.ts';
    sourceDocumentSha256: string;
  };
  sources: readonly ConflictSourceRecord[];
  coverage: {
    absentPairOutcome: 'unsupported_unreviewed';
    reviewedCompatiblePairs: readonly string[];
  };
  rules: readonly ConflictRuleContent[];
};

export const CONFLICT_MARKET_SCOPE_POLICY = {
  claimsScope:
    'cosmetic_skincare_not_intended_for_diagnosis_cure_mitigation_prevention_or_treatment_subject_to_counsel_classification',
  excludedJurisdictions: ['CA', 'CA-QC'],
  legalGate: 'us_wave1_counsel_clearance_required',
  policyId: 'us-wave1-legal-market-gate-v1',
  sourceDocumentPath: 'docs/hugeToDo/US_WAVE1_PRIVACY_AND_CONSUMER_HEALTH_LAW_GATE.md',
  sourceDocumentSha256: '18d1f724a02f9abecd62411d18d923cd8988ba2e5adc6777aa7a6e1de9319f98',
  storefrontJurisdictions: ['US'],
} as const;

export const CONFLICT_PROFILE_CONTEXT_CONTRACT = {
  storedValue: 'pregnant',
  semanticValue: 'pregnant_or_trying_combined',
  sourceDocumentPath: 'apps/mobile/src/features/onboarding/quizContract.ts',
  sourceDocumentSha256: 'b22b1680f3efb2a038b672421d0e77f4fc274b440f0f52b7017acb43df56ac4c',
} as const;

export const CONFLICT_RULE_CORPUS_CONTENT: ConflictRuleCorpusContent = {
  schemaVersion: 1,
  corpusVersion: 1,
  // Wave 1 only. Canada/Quebec requires a future separately reviewed corpus.
  targetJurisdictions: ['US'],
  marketScopePolicyId: CONFLICT_MARKET_SCOPE_POLICY.policyId,
  marketScopeSha256: '0c0ab0545aca891383efc86a58c3245571bbd686ca411593a89770ad47a06bb7',
  profileContextContract: CONFLICT_PROFILE_CONTEXT_CONTRACT,
  sources: SOURCE_REGISTRY,
  coverage: {
    absentPairOutcome: 'unsupported_unreviewed',
    reviewedCompatiblePairs: [],
  },
  rules: CANDIDATE_RULE_ROWS.map(toRuleContent),
};

/** RFC-8785-style key ordering for the JSON-compatible corpus value. */
export function canonicalJson(value: unknown): string {
  if (value === null || typeof value === 'boolean' || typeof value === 'string') {
    return JSON.stringify(value);
  }
  if (typeof value === 'number') {
    if (!Number.isFinite(value)) throw new Error('CONFLICT_CORPUS_NON_FINITE_NUMBER');
    return JSON.stringify(value);
  }
  if (Array.isArray(value)) return `[${value.map(canonicalJson).join(',')}]`;
  if (typeof value === 'object') {
    const object = value as Record<string, unknown>;
    return `{${Object.keys(object)
      .sort()
      .map((key) => `${JSON.stringify(key)}:${canonicalJson(object[key])}`)
      .join(',')}}`;
  }
  throw new Error('CONFLICT_CORPUS_NON_JSON_VALUE');
}

function utf8Bytes(value: string): number[] {
  const bytes: number[] = [];
  for (const symbol of value) {
    const codePoint = symbol.codePointAt(0)!;
    if (codePoint <= 0x7f) bytes.push(codePoint);
    else if (codePoint <= 0x7ff) {
      bytes.push(0xc0 | (codePoint >>> 6), 0x80 | (codePoint & 0x3f));
    } else if (codePoint <= 0xffff) {
      bytes.push(
        0xe0 | (codePoint >>> 12),
        0x80 | ((codePoint >>> 6) & 0x3f),
        0x80 | (codePoint & 0x3f),
      );
    } else {
      bytes.push(
        0xf0 | (codePoint >>> 18),
        0x80 | ((codePoint >>> 12) & 0x3f),
        0x80 | ((codePoint >>> 6) & 0x3f),
        0x80 | (codePoint & 0x3f),
      );
    }
  }
  return bytes;
}

const SHA256_K = [
  0x428a2f98, 0x71374491, 0xb5c0fbcf, 0xe9b5dba5, 0x3956c25b, 0x59f111f1, 0x923f82a4, 0xab1c5ed5,
  0xd807aa98, 0x12835b01, 0x243185be, 0x550c7dc3, 0x72be5d74, 0x80deb1fe, 0x9bdc06a7, 0xc19bf174,
  0xe49b69c1, 0xefbe4786, 0x0fc19dc6, 0x240ca1cc, 0x2de92c6f, 0x4a7484aa, 0x5cb0a9dc, 0x76f988da,
  0x983e5152, 0xa831c66d, 0xb00327c8, 0xbf597fc7, 0xc6e00bf3, 0xd5a79147, 0x06ca6351, 0x14292967,
  0x27b70a85, 0x2e1b2138, 0x4d2c6dfc, 0x53380d13, 0x650a7354, 0x766a0abb, 0x81c2c92e, 0x92722c85,
  0xa2bfe8a1, 0xa81a664b, 0xc24b8b70, 0xc76c51a3, 0xd192e819, 0xd6990624, 0xf40e3585, 0x106aa070,
  0x19a4c116, 0x1e376c08, 0x2748774c, 0x34b0bcb5, 0x391c0cb3, 0x4ed8aa4a, 0x5b9cca4f, 0x682e6ff3,
  0x748f82ee, 0x78a5636f, 0x84c87814, 0x8cc70208, 0x90befffa, 0xa4506ceb, 0xbef9a3f7, 0xc67178f2,
] as const;

function rotateRight(value: number, shift: number): number {
  return (value >>> shift) | (value << (32 - shift));
}

function sha256Bytes(input: readonly number[]): string {
  const bytes = [...input];
  const bitLength = bytes.length * 8;
  bytes.push(0x80);
  while (bytes.length % 64 !== 56) bytes.push(0);
  for (let shift = 56; shift >= 0; shift -= 8) {
    bytes.push(Math.floor(bitLength / 2 ** shift) & 0xff);
  }

  const hash = [
    0x6a09e667, 0xbb67ae85, 0x3c6ef372, 0xa54ff53a, 0x510e527f, 0x9b05688c, 0x1f83d9ab, 0x5be0cd19,
  ];
  const words = new Array<number>(64).fill(0);

  for (let offset = 0; offset < bytes.length; offset += 64) {
    for (let i = 0; i < 16; i++) {
      const base = offset + i * 4;
      words[i] =
        ((bytes[base]! << 24) |
          (bytes[base + 1]! << 16) |
          (bytes[base + 2]! << 8) |
          bytes[base + 3]!) >>>
        0;
    }
    for (let i = 16; i < 64; i++) {
      const x = words[i - 15]!;
      const y = words[i - 2]!;
      const sigma0 = rotateRight(x, 7) ^ rotateRight(x, 18) ^ (x >>> 3);
      const sigma1 = rotateRight(y, 17) ^ rotateRight(y, 19) ^ (y >>> 10);
      words[i] = (words[i - 16]! + sigma0 + words[i - 7]! + sigma1) >>> 0;
    }

    let [a, b, c, d, e, f, g, h] = hash;
    for (let i = 0; i < 64; i++) {
      const sum1 = rotateRight(e!, 6) ^ rotateRight(e!, 11) ^ rotateRight(e!, 25);
      const choice = (e! & f!) ^ (~e! & g!);
      const temp1 = (h! + sum1 + choice + SHA256_K[i]! + words[i]!) >>> 0;
      const sum0 = rotateRight(a!, 2) ^ rotateRight(a!, 13) ^ rotateRight(a!, 22);
      const majority = (a! & b!) ^ (a! & c!) ^ (b! & c!);
      const temp2 = (sum0 + majority) >>> 0;
      h = g;
      g = f;
      f = e;
      e = (d! + temp1) >>> 0;
      d = c;
      c = b;
      b = a;
      a = (temp1 + temp2) >>> 0;
    }

    hash[0] = (hash[0]! + a!) >>> 0;
    hash[1] = (hash[1]! + b!) >>> 0;
    hash[2] = (hash[2]! + c!) >>> 0;
    hash[3] = (hash[3]! + d!) >>> 0;
    hash[4] = (hash[4]! + e!) >>> 0;
    hash[5] = (hash[5]! + f!) >>> 0;
    hash[6] = (hash[6]! + g!) >>> 0;
    hash[7] = (hash[7]! + h!) >>> 0;
  }

  return hash.map((word) => word!.toString(16).padStart(8, '0')).join('');
}

/** Dependency-free synchronous SHA-256 so admission is identical in Hermes and tests. */
export function sha256Hex(value: string): string {
  return sha256Bytes(utf8Bytes(value));
}

export function canonicalSha256(value: unknown): string {
  return sha256Hex(canonicalJson(value));
}

export type ConflictRuleCorpus = {
  status: 'draft_blocked' | 'approved';
  contentSha256: string;
  content: ConflictRuleCorpusContent;
};

export const CONFLICT_RULE_CORPUS: ConflictRuleCorpus = {
  status: 'draft_blocked',
  contentSha256: canonicalSha256(CONFLICT_RULE_CORPUS_CONTENT),
  content: CONFLICT_RULE_CORPUS_CONTENT,
};

export type ConflictReviewRole =
  | 'board_certified_dermatologist'
  | 'cosmetic_chemist'
  | 'pharmacist'
  | 'regulatory_counsel';

export type ConflictReviewScope =
  | 'clinical_safety_evidence_and_user_copy'
  | 'ingredient_compatibility_formulation_and_user_copy'
  | 'regulatory_claims_and_jurisdiction_clearance';

export type ConflictTrustedReviewAuthority = {
  authorityId: string;
  reviewerRole: ConflictReviewRole;
  reviewerIdentityKey: string;
  credentialEvidenceRef: string;
  publicKeyAlgorithm: 'Ed25519';
  publicKeyBase64: string;
  publicKeySha256: string;
  credentialEvidenceSha256: string;
};

// Launch blocker: no reviewer/counsel key becomes trusted by placing identity
// strings in a receipt. Trust roots require a separate reviewed code change.
export const CONFLICT_TRUSTED_REVIEW_AUTHORITIES: readonly ConflictTrustedReviewAuthority[] = [];
export const CONFLICT_TRUST_ROOT_BLOCKER =
  'empty_trust_registry_and_detached_signature_verifier_not_implemented' as const;

export type ConflictRuleReviewReceipt = {
  receiptId: string;
  authorityId: string;
  reviewerRole: ConflictReviewRole;
  reviewScope: ConflictReviewScope;
  reviewerIdentityKey: string;
  credentialEvidenceRef: string;
  credentialEvidenceSha256: string;
  independenceDisclosureRef: string;
  independenceDisclosureSha256: string;
  authorityPublicKeySha256: string;
  signedBodySha256: string;
  detachedSignatureBase64: string;
  corpusSha256: string;
  sourceRegistrySha256: string;
  exactRuleCount: number;
  targetJurisdictions: readonly string[];
  marketScopePolicyId: string;
  marketScopeSha256: string;
  marketScopeSourceDocumentPath: string;
  marketScopeSourceDocumentSha256: string;
  profileContextStoredValue: 'pregnant';
  profileContextSemanticValue: 'pregnant_or_trying_combined';
  profileContextSourceDocumentPath: 'apps/mobile/src/features/onboarding/quizContract.ts';
  profileContextSourceDocumentSha256: string;
  decision: 'approve' | 'reject';
  signedAt: string;
  expiresAt: string;
};

// Deliberately empty. Real protected evidence receipts must replace this only
// after the exact corpus hash has been independently reviewed.
export const CONFLICT_RULE_REVIEW_RECEIPTS: readonly ConflictRuleReviewReceipt[] = [];

export type AdmittedConflictRuleCorpus = {
  corpusSha256: string;
  rules: ConflictRule[];
  reviewedCompatiblePairs: readonly string[];
  receiptIds: readonly [string, string, string];
};

function immutableCopy<T>(value: T): T {
  if (Array.isArray(value)) {
    return Object.freeze(value.map((item) => immutableCopy(item))) as T;
  }
  if (value !== null && typeof value === 'object') {
    const copy = Object.fromEntries(
      Object.entries(value).map(([key, item]) => [key, immutableCopy(item)]),
    );
    return Object.freeze(copy) as T;
  }
  return value;
}

/**
 * Returns a detached, recursively frozen snapshot. Freezing alone never grants
 * runtime admission; only `admitConflictRuleCorpus` adds the result to the
 * module-private provenance registry.
 */
export function immutableConflictRuleCorpusSnapshot(
  corpus: AdmittedConflictRuleCorpus,
): AdmittedConflictRuleCorpus {
  return immutableCopy(corpus);
}

// Structural TypeScript objects are forgeable. Only this module can place an
// object identity into the runtime admission registry after signature checks.
const admittedCorpusInstances = new WeakSet<AdmittedConflictRuleCorpus>();

export function isRuntimeAdmittedConflictRuleCorpus(
  corpus: AdmittedConflictRuleCorpus | null | undefined,
): corpus is AdmittedConflictRuleCorpus {
  return Boolean(corpus && admittedCorpusInstances.has(corpus));
}

function hasSha256(value: string): boolean {
  return /^[a-f0-9]{64}$/u.test(value) && !/^0{64}$/u.test(value);
}

function decodeCanonicalBase64(value: string): number[] | null {
  if (
    value.trim() !== value ||
    value.length === 0 ||
    value.length % 4 !== 0 ||
    !/^[A-Za-z0-9+/]+={0,2}$/u.test(value)
  ) {
    return null;
  }
  const padding = value.endsWith('==') ? 2 : value.endsWith('=') ? 1 : 0;
  const unpadded = padding > 0 ? value.slice(0, -padding) : value;
  if (unpadded.includes('=')) return null;
  const alphabet = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/';
  const bytes: number[] = [];
  for (let offset = 0; offset < value.length; offset += 4) {
    const chars = value.slice(offset, offset + 4);
    const values = [...chars].map((character) =>
      character === '=' ? 0 : alphabet.indexOf(character),
    );
    if (values.some((entry) => entry < 0)) return null;
    const packed = (values[0]! << 18) | (values[1]! << 12) | (values[2]! << 6) | values[3]!;
    bytes.push((packed >>> 16) & 0xff);
    if (chars[2] !== '=') bytes.push((packed >>> 8) & 0xff);
    if (chars[3] !== '=') bytes.push(packed & 0xff);
  }
  let encoded = '';
  for (let offset = 0; offset < bytes.length; offset += 3) {
    const a = bytes[offset]!;
    const hasB = offset + 1 < bytes.length;
    const hasC = offset + 2 < bytes.length;
    const b = hasB ? bytes[offset + 1]! : 0;
    const c = hasC ? bytes[offset + 2]! : 0;
    const packed = (a << 16) | (b << 8) | c;
    encoded += alphabet[(packed >>> 18) & 0x3f];
    encoded += alphabet[(packed >>> 12) & 0x3f];
    encoded += hasB ? alphabet[(packed >>> 6) & 0x3f] : '=';
    encoded += hasC ? alphabet[packed & 0x3f] : '=';
  }
  return encoded === value ? bytes : null;
}

export function conflictEd25519PublicKeyFingerprint(publicKeyBase64: string): string | null {
  const bytes = decodeCanonicalBase64(publicKeyBase64);
  return bytes?.length === 32 ? sha256Bytes(bytes) : null;
}

export function isValidatedConflictReviewAuthority(
  authority: ConflictTrustedReviewAuthority,
): boolean {
  const fingerprint = conflictEd25519PublicKeyFingerprint(authority.publicKeyBase64);
  return (
    authority.publicKeyAlgorithm === 'Ed25519' &&
    fingerprint !== null &&
    hasSha256(authority.publicKeySha256) &&
    authority.publicKeySha256 === fingerprint
  );
}

export function hasIndependentConflictReviewAuthorities(
  authorities: readonly ConflictTrustedReviewAuthority[],
): boolean {
  return (
    authorities.length === 3 &&
    authorities.every(isValidatedConflictReviewAuthority) &&
    new Set(authorities.map((authority) => authority.publicKeySha256)).size === 3
  );
}

function hasEvidenceReference(value: string): boolean {
  const normalized = value.trim();
  return (
    normalized.length >= 12 &&
    !/(?:pending|placeholder|example|test-only|todo|tbd)/iu.test(normalized)
  );
}

function hasTimestamp(value: string): boolean {
  return /^\d{4}-\d{2}-\d{2}T/u.test(value) && Number.isFinite(Date.parse(value));
}

function conditionsAreReviewed(conditions: ConflictApplicabilityConditions): boolean {
  return (
    Object.values(conditions.tagA).every((constraint) => constraint.status !== 'review_required') &&
    Object.values(conditions.tagB).every((constraint) => constraint.status !== 'review_required') &&
    conditions.reproductiveContexts.status !== 'review_required'
  );
}

function hasExactReproductiveScope(
  conditions: ConflictApplicabilityConditions,
  allowedContexts: readonly ConflictSafetyContext[],
): boolean {
  if (conditions.reproductiveContexts.status !== 'exact') return false;
  const actual = [...conditions.reproductiveContexts.value].sort();
  const allowed = [...allowedContexts].sort();
  return (
    actual.length > 0 &&
    new Set(actual).size === actual.length &&
    canonicalJson(actual) === canonicalJson(allowed)
  );
}

function hasNonSafetyReproductiveScope(conditions: ConflictApplicabilityConditions): boolean {
  return conditions.reproductiveContexts.status === 'not_applicable';
}

function canonicalSeverityLabel(rule: ConflictRuleContent): string {
  const reviewedSeverities = new Set([
    rule.baseSeverity,
    ...rule.applicability.severityBranches.map((branch) => branch.severity),
  ]);
  return reviewedSeverities.size > 1
    ? CONFLICT_NON_VARIABLE_SEVERITY_LABEL
    : `Severity: ${rule.baseSeverity}`;
}

export function isConflictRuleCorpusContentValidForAdmission(
  content: ConflictRuleCorpusContent,
): boolean {
  const targetJurisdictions = [...content.targetJurisdictions].sort();
  if (
    content.schemaVersion !== 1 ||
    content.corpusVersion < 1 ||
    content.rules.length === 0 ||
    targetJurisdictions.length === 0 ||
    new Set(targetJurisdictions).size !== targetJurisdictions.length ||
    targetJurisdictions.some((jurisdiction) => !/^[A-Z]{2}$/u.test(jurisdiction)) ||
    canonicalJson(targetJurisdictions) !== canonicalJson(content.targetJurisdictions) ||
    content.coverage.reviewedCompatiblePairs.length !== 0 ||
    content.marketScopePolicyId !== CONFLICT_MARKET_SCOPE_POLICY.policyId ||
    content.marketScopeSha256 !== canonicalSha256(CONFLICT_MARKET_SCOPE_POLICY) ||
    canonicalJson(content.profileContextContract) !==
      canonicalJson(CONFLICT_PROFILE_CONTEXT_CONTRACT) ||
    canonicalJson(content.targetJurisdictions) !==
      canonicalJson(CONFLICT_MARKET_SCOPE_POLICY.storefrontJurisdictions)
  ) {
    return false;
  }
  const sourceIds = new Set(content.sources.map((source) => source.id));
  if (
    sourceIds.size !== content.sources.length ||
    content.sources.some(
      (source) =>
        source.reviewStatus !== 'reviewed' ||
        !source.retainedArtifactId ||
        !hasEvidenceReference(source.retainedArtifactId) ||
        !source.retainedArtifactRef ||
        !hasEvidenceReference(source.retainedArtifactRef) ||
        !source.retainedArtifactSha256 ||
        !hasSha256(source.retainedArtifactSha256),
    )
  ) {
    return false;
  }
  const ruleIds = new Set<string>();
  const interactionPairs = new Set<string>();
  for (const rule of content.rules) {
    if (
      rule.candidateDisposition !== 'reviewed' ||
      rule.reviewedBy !== null ||
      !Number.isInteger(rule.ruleVersion) ||
      rule.ruleVersion < 1 ||
      rule.pairKey !== pairKey(rule.tagA, rule.tagB) ||
      rule.sourceIds.length === 0 ||
      rule.sourceIds.some((sourceId) => !sourceIds.has(sourceId)) ||
      rule.copy.mechanism !== rule.mechanism ||
      rule.copy.resolution !== rule.resolutionCopy ||
      rule.copy.severityLabel !== canonicalSeverityLabel(rule) ||
      rule.copy.sourceSummary !== `${rule.sourceCitation.replace(/[.\s]+$/u, '')}.` ||
      Object.values(rule.copy).some((value) => typeof value === 'string' && value.trim() === '') ||
      rule.applicability.reviewStatus !== 'reviewed' ||
      !conditionsAreReviewed(rule.applicability.approvedConditions) ||
      new Set(rule.applicability.severityBranches.map((branch) => branch.branchId)).size !==
        rule.applicability.severityBranches.length ||
      rule.applicability.severityBranches.some(
        (branch) =>
          !hasEvidenceReference(branch.branchId) ||
          !conditionsAreReviewed(branch.conditions) ||
          (rule.interactionType === 'safety'
            ? !hasExactReproductiveScope(branch.conditions, rule.applicability.safetyContexts)
            : !hasNonSafetyReproductiveScope(branch.conditions)),
      ) ||
      rule.applicability.coUseSensitivity !== null ||
      (rule.interactionType === 'safety' &&
        (rule.applicability.safetyContexts.length !== 1 ||
          rule.applicability.safetyContexts[0] !== 'pregnant' ||
          !hasExactReproductiveScope(
            rule.applicability.approvedConditions,
            rule.applicability.safetyContexts,
          ))) ||
      (rule.interactionType !== 'safety' && rule.applicability.safetyContexts.length !== 0) ||
      (rule.interactionType !== 'safety' &&
        !hasNonSafetyReproductiveScope(rule.applicability.approvedConditions)) ||
      (rule.interactionType === 'safety' && rule.copy.overrideActionLabel !== null) ||
      (rule.applicability.ingredientScope.mode === 'named_molecules' &&
        (!rule.applicability.ingredientScope.tag ||
          rule.applicability.ingredientScope.molecules.length === 0)) ||
      (rule.applicability.ingredientScope.mode === 'functional_tag' &&
        (rule.applicability.ingredientScope.tag !== null ||
          rule.applicability.ingredientScope.molecules.length !== 0)) ||
      rule.applicability.ingredientScope.formulationExemptions.some(
        (exemption) =>
          exemption.scope !== 'finished_formulation_only' ||
          exemption.evidenceRequired !== true ||
          !hasEvidenceReference(exemption.finishedFormulationId),
      )
    ) {
      return false;
    }
    const interactionPair = `${rule.pairKey}|${rule.interactionType}`;
    if (ruleIds.has(rule.id) || interactionPairs.has(interactionPair)) return false;
    ruleIds.add(rule.id);
    interactionPairs.add(interactionPair);
  }
  return true;
}

export type ConflictReviewSignedBody = {
  receiptId: string;
  authorityId: string;
  reviewerRole: ConflictReviewRole;
  reviewScope: ConflictReviewScope;
  reviewerIdentityKey: string;
  credentialEvidenceRef: string;
  credentialEvidenceSha256: string;
  independenceDisclosureRef: string;
  independenceDisclosureSha256: string;
  authorityPublicKeySha256: string;
  corpusSha256: string;
  sourceRegistrySha256: string;
  exactSourceArtifacts: readonly {
    sourceId: string;
    citationSha256: string;
    retainedArtifactId: string | null;
    retainedArtifactRef: string | null;
    retainedArtifactSha256: string | null;
  }[];
  exactRuleCount: number;
  exactRuleHashes: readonly {
    ruleId: string;
    ruleVersion: number;
    ruleContentSha256: string;
  }[];
  targetJurisdictions: readonly string[];
  marketScopePolicyId: string;
  marketScopeSha256: string;
  marketScopeSourceDocumentPath: string;
  marketScopeSourceDocumentSha256: string;
  profileContextStoredValue: 'pregnant';
  profileContextSemanticValue: 'pregnant_or_trying_combined';
  profileContextSourceDocumentPath: 'apps/mobile/src/features/onboarding/quizContract.ts';
  profileContextSourceDocumentSha256: string;
  decision: 'approve' | 'reject';
  signedAt: string;
  expiresAt: string;
};

export function conflictReviewSignedBody(
  corpus: ConflictRuleCorpus,
  receipt: ConflictRuleReviewReceipt,
): ConflictReviewSignedBody {
  return {
    receiptId: receipt.receiptId,
    authorityId: receipt.authorityId,
    reviewerRole: receipt.reviewerRole,
    reviewScope: receipt.reviewScope,
    reviewerIdentityKey: receipt.reviewerIdentityKey,
    credentialEvidenceRef: receipt.credentialEvidenceRef,
    credentialEvidenceSha256: receipt.credentialEvidenceSha256,
    independenceDisclosureRef: receipt.independenceDisclosureRef,
    independenceDisclosureSha256: receipt.independenceDisclosureSha256,
    authorityPublicKeySha256: receipt.authorityPublicKeySha256,
    corpusSha256: corpus.contentSha256,
    sourceRegistrySha256: canonicalSha256(corpus.content.sources),
    exactSourceArtifacts: corpus.content.sources.map((source) => ({
      sourceId: source.id,
      citationSha256: sha256Hex(source.citation),
      retainedArtifactId: source.retainedArtifactId,
      retainedArtifactRef: source.retainedArtifactRef,
      retainedArtifactSha256: source.retainedArtifactSha256,
    })),
    exactRuleCount: corpus.content.rules.length,
    exactRuleHashes: corpus.content.rules.map((rule) => ({
      ruleId: rule.id,
      ruleVersion: rule.ruleVersion,
      ruleContentSha256: canonicalSha256(rule),
    })),
    targetJurisdictions: corpus.content.targetJurisdictions,
    marketScopePolicyId: corpus.content.marketScopePolicyId,
    marketScopeSha256: corpus.content.marketScopeSha256,
    marketScopeSourceDocumentPath: CONFLICT_MARKET_SCOPE_POLICY.sourceDocumentPath,
    marketScopeSourceDocumentSha256: CONFLICT_MARKET_SCOPE_POLICY.sourceDocumentSha256,
    profileContextStoredValue: corpus.content.profileContextContract.storedValue,
    profileContextSemanticValue: corpus.content.profileContextContract.semanticValue,
    profileContextSourceDocumentPath: corpus.content.profileContextContract.sourceDocumentPath,
    profileContextSourceDocumentSha256: corpus.content.profileContextContract.sourceDocumentSha256,
    decision: receipt.decision,
    signedAt: receipt.signedAt,
    expiresAt: receipt.expiresAt,
  };
}

function expectedReviewScope(role: ConflictReviewRole): ConflictReviewScope {
  if (role === 'board_certified_dermatologist') {
    return 'clinical_safety_evidence_and_user_copy';
  }
  if (role === 'regulatory_counsel') {
    return 'regulatory_claims_and_jurisdiction_clearance';
  }
  return 'ingredient_compatibility_formulation_and_user_copy';
}

function validReceiptMetadata(
  receipt: ConflictRuleReviewReceipt,
  corpus: ConflictRuleCorpus,
  now: Date,
): boolean {
  const signedAt = Date.parse(receipt.signedAt);
  const expiresAt = Date.parse(receipt.expiresAt);
  const signedBody = conflictReviewSignedBody(corpus, receipt);
  return (
    receipt.corpusSha256 === corpus.contentSha256 &&
    receipt.sourceRegistrySha256 === canonicalSha256(corpus.content.sources) &&
    receipt.exactRuleCount === corpus.content.rules.length &&
    canonicalJson(receipt.targetJurisdictions) ===
      canonicalJson(corpus.content.targetJurisdictions) &&
    receipt.marketScopePolicyId === corpus.content.marketScopePolicyId &&
    receipt.marketScopeSha256 === corpus.content.marketScopeSha256 &&
    receipt.marketScopeSourceDocumentPath === CONFLICT_MARKET_SCOPE_POLICY.sourceDocumentPath &&
    receipt.marketScopeSourceDocumentSha256 === CONFLICT_MARKET_SCOPE_POLICY.sourceDocumentSha256 &&
    receipt.profileContextStoredValue === corpus.content.profileContextContract.storedValue &&
    receipt.profileContextSemanticValue === corpus.content.profileContextContract.semanticValue &&
    receipt.profileContextSourceDocumentPath ===
      corpus.content.profileContextContract.sourceDocumentPath &&
    receipt.profileContextSourceDocumentSha256 ===
      corpus.content.profileContextContract.sourceDocumentSha256 &&
    receipt.reviewScope === expectedReviewScope(receipt.reviewerRole) &&
    receipt.decision === 'approve' &&
    hasEvidenceReference(receipt.receiptId) &&
    hasEvidenceReference(receipt.authorityId) &&
    hasEvidenceReference(receipt.reviewerIdentityKey) &&
    hasEvidenceReference(receipt.credentialEvidenceRef) &&
    hasSha256(receipt.credentialEvidenceSha256) &&
    hasEvidenceReference(receipt.independenceDisclosureRef) &&
    hasSha256(receipt.independenceDisclosureSha256) &&
    hasSha256(receipt.authorityPublicKeySha256) &&
    receipt.signedBodySha256 === canonicalSha256(signedBody) &&
    hasSha256(receipt.signedBodySha256) &&
    receipt.detachedSignatureBase64.trim().length >= 40 &&
    hasTimestamp(receipt.signedAt) &&
    hasTimestamp(receipt.expiresAt) &&
    signedAt <= now.getTime() &&
    expiresAt > now.getTime() &&
    expiresAt > signedAt
  );
}

function verifyDetachedReceiptSignature(
  _receipt: ConflictRuleReviewReceipt,
  _corpus: ConflictRuleCorpus,
  _authority: ConflictTrustedReviewAuthority,
): boolean {
  // No sound Ed25519 verifier is available in the current Hermes dependency
  // boundary. This explicit blocker is safer than accepting self-asserted hashes.
  return false;
}

function contentFromRuntimeRule(rule: ConflictRule): ConflictRuleContent {
  const {
    admission: _admission,
    corpusSha256: _corpusSha256,
    ruleContentSha256: _ruleSha,
    ...content
  } = rule;
  return content;
}

function hasSelfConsistentAdmission(rule: Partial<ConflictRule>): rule is ConflictRule {
  if (
    !rule.admission ||
    !rule.corpusSha256 ||
    !rule.ruleContentSha256 ||
    rule.admission.status !== 'approved' ||
    rule.admission.corpusSha256 !== rule.corpusSha256 ||
    rule.admission.receiptIds.length !== 3 ||
    rule.admission.reviewerRoles[0] !== 'board_certified_dermatologist' ||
    rule.admission.reviewerRoles[1] !== 'cosmetic_chemist' ||
    rule.admission.reviewerRoles[2] !== 'regulatory_counsel'
  ) {
    return false;
  }
  return canonicalSha256(contentFromRuntimeRule(rule as ConflictRule)) === rule.ruleContentSha256;
}

export function isRuleAdmittedByCorpus(
  rule: Partial<ConflictRule>,
  corpus: AdmittedConflictRuleCorpus | null,
): rule is ConflictRule {
  if (!isRuntimeAdmittedConflictRuleCorpus(corpus) || !hasSelfConsistentAdmission(rule)) {
    return false;
  }
  const canonicalRule = corpus.rules.find(
    (candidate) =>
      candidate.id === rule.id &&
      candidate.ruleVersion === rule.ruleVersion &&
      candidate.ruleContentSha256 === rule.ruleContentSha256,
  );
  return Boolean(
    canonicalRule &&
    rule.corpusSha256 === corpus.corpusSha256 &&
    canonicalJson(rule.admission!.receiptIds) === canonicalJson(corpus.receiptIds),
  );
}

export function isReviewedRule(rule: Partial<ConflictRule>): boolean {
  return isRuleAdmittedByCorpus(rule, shippableConflictRuleCorpus());
}

export function admitConflictRuleCorpus(
  corpus: ConflictRuleCorpus,
  receipts: readonly ConflictRuleReviewReceipt[],
  now: Date = new Date(),
): AdmittedConflictRuleCorpus | null {
  if (
    corpus.status !== 'approved' ||
    canonicalSha256(corpus.content) !== corpus.contentSha256 ||
    !isConflictRuleCorpusContentValidForAdmission(corpus.content) ||
    receipts.length !== 3 ||
    CONFLICT_TRUSTED_REVIEW_AUTHORITIES.length < 3 ||
    receipts.some((receipt) => !validReceiptMetadata(receipt, corpus, now))
  ) {
    return null;
  }

  const dermatologist = receipts.find(
    (receipt) => receipt.reviewerRole === 'board_certified_dermatologist',
  );
  const cosmeticChemist = receipts.find(
    (receipt) => receipt.reviewerRole === 'cosmetic_chemist',
  );
  const regulatoryCounsel = receipts.find(
    (receipt) => receipt.reviewerRole === 'regulatory_counsel',
  );
  const orderedReceipts =
    dermatologist && cosmeticChemist && regulatoryCounsel
      ? [dermatologist, cosmeticChemist, regulatoryCounsel]
      : [];
  const authorities = orderedReceipts.map((receipt) =>
    CONFLICT_TRUSTED_REVIEW_AUTHORITIES.find(
      (authority) =>
        authority.authorityId === receipt.authorityId &&
        authority.reviewerRole === receipt.reviewerRole &&
        authority.reviewerIdentityKey === receipt.reviewerIdentityKey &&
        authority.credentialEvidenceRef === receipt.credentialEvidenceRef &&
        isValidatedConflictReviewAuthority(authority) &&
        authority.publicKeySha256 === receipt.authorityPublicKeySha256 &&
        hasSha256(authority.credentialEvidenceSha256) &&
        authority.credentialEvidenceSha256 === receipt.credentialEvidenceSha256,
    ),
  );
  if (
    !dermatologist ||
    !cosmeticChemist ||
    !regulatoryCounsel ||
    new Set(orderedReceipts.map((receipt) => receipt.receiptId)).size !== 3 ||
    new Set(orderedReceipts.map((receipt) => receipt.authorityId)).size !== 3 ||
    new Set(orderedReceipts.map((receipt) => receipt.reviewerIdentityKey)).size !== 3 ||
    new Set(orderedReceipts.map((receipt) => receipt.credentialEvidenceRef)).size !== 3 ||
    new Set(orderedReceipts.map((receipt) => receipt.credentialEvidenceSha256)).size !== 3 ||
    new Set(orderedReceipts.map((receipt) => receipt.independenceDisclosureRef)).size !== 3 ||
    new Set(orderedReceipts.map((receipt) => receipt.independenceDisclosureSha256)).size !== 3 ||
    new Set(orderedReceipts.map((receipt) => receipt.authorityPublicKeySha256)).size !== 3 ||
    new Set(orderedReceipts.map((receipt) => receipt.signedBodySha256)).size !== 3 ||
    authorities.some((authority) => !authority) ||
    !hasIndependentConflictReviewAuthorities(
      authorities as readonly ConflictTrustedReviewAuthority[],
    ) ||
    orderedReceipts.some(
      (receipt, index) =>
        !verifyDetachedReceiptSignature(
          receipt,
          corpus,
          authorities[index] as ConflictTrustedReviewAuthority,
        ),
    )
  ) {
    return null;
  }

  const receiptIds = [
    dermatologist.receiptId,
    cosmeticChemist.receiptId,
    regulatoryCounsel.receiptId,
  ] as const;
  const reviewerRoles: ConflictRuleAdmission['reviewerRoles'] = [
    'board_certified_dermatologist',
    'cosmetic_chemist',
    'regulatory_counsel',
  ];
  const admission: ConflictRuleAdmission = {
    status: 'approved',
    corpusSha256: corpus.contentSha256,
    receiptIds,
    reviewerRoles,
  };
  const admitted = immutableConflictRuleCorpusSnapshot({
    corpusSha256: corpus.contentSha256,
    rules: corpus.content.rules.map((rule) => ({
      ...rule,
      corpusSha256: corpus.contentSha256,
      ruleContentSha256: canonicalSha256(rule),
      admission,
    })),
    reviewedCompatiblePairs: [...corpus.content.coverage.reviewedCompatiblePairs],
    receiptIds,
  });
  admittedCorpusInstances.add(admitted);
  return admitted;
}

export const STARTER_RULES: ConflictRule[] = CONFLICT_RULE_CORPUS_CONTENT.rules.map((rule) => ({
  ...rule,
  corpusSha256: CONFLICT_RULE_CORPUS.contentSha256,
  ruleContentSha256: canonicalSha256(rule),
}));

export function previewConflictRules(): ConflictRule[] {
  return [...STARTER_RULES];
}

export function shippableConflictRuleCorpus(): AdmittedConflictRuleCorpus | null {
  return admitConflictRuleCorpus(CONFLICT_RULE_CORPUS, CONFLICT_RULE_REVIEW_RECEIPTS);
}

/**
 * Compatibility selector used by existing mobile call sites. The optional
 * parameter is intentionally ignored: ad-hoc rows and reviewedBy strings
 * cannot bypass whole-corpus admission.
 */
export function shippableRules(_legacyRows?: readonly ConflictRule[]): ConflictRule[] {
  return [...(shippableConflictRuleCorpus()?.rules ?? [])];
}
