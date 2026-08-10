import type { FunctionalTag, RoutinePhase, SequencingRole } from '@layerwell/types';

import { canonicalSha256 } from '@/features/intelligence/conflictRuleCorpus.v1';

import {
  admitRoutineSequencingCorpus,
  isRuntimeAdmittedRoutineSequencingCorpus,
  ROUTINE_SEQUENCING_MARKET_SCOPE_POLICY,
  ROUTINE_SEQUENCING_REVIEW_RECEIPTS,
  type RoutineSequencingCandidateRule,
  type RoutineCadencePolicy,
  type RoutineGuidanceClaimId,
  type RoutineGuidanceCopy,
  type RoutineSequencingCorpus,
  type RoutineSequencingCorpusContent,
  type RoutineStopReferPolicy,
} from './routineSequencingCorpus.v1';

// Application-order sequencing (docs/03 §3). Deterministic + explainable. NOT an
// AI router. Thin→thick, low-pH-first, water-before-oil. The rules are DATA
// (mirrors the sequencing_rules seed by role) so they stay reviewable.

export type SequencingRule = {
  role: SequencingRole;
  basePriority: number;
  amEligible: boolean;
  pmEligible: boolean;
  defaultPhase: RoutinePhase;
  notes: string;
  ruleVersion: number;
  /** Detached clinical/cosmetic-chemistry sign-off. Null starter rows are dev-only. */
  reviewedBy: string | null;
};

export type ShippableSequencingRules = Partial<Record<SequencingRole, SequencingRule>>;

// Mirrors supabase/migrations/...0014_sequencing_rules.sql.
export const SEQUENCING_RULES: Record<SequencingRole, SequencingRule> = {
  cleanser: {
    role: 'cleanser',
    basePriority: 10,
    amEligible: true,
    pmEligible: true,
    defaultPhase: 'either',
    notes: 'Start with a clean base.',
    ruleVersion: 1,
    reviewedBy: null,
  },
  toner: {
    role: 'toner',
    basePriority: 20,
    amEligible: true,
    pmEligible: true,
    defaultPhase: 'either',
    notes: 'Optional. A hydrating or balancing layer.',
    ruleVersion: 1,
    reviewedBy: null,
  },
  antioxidant: {
    role: 'antioxidant',
    basePriority: 30,
    amEligible: true,
    pmEligible: true,
    defaultPhase: 'am',
    notes: 'Vitamin C in the morning, under your SPF.',
    ruleVersion: 1,
    reviewedBy: null,
  },
  hydrating_serum: {
    role: 'hydrating_serum',
    basePriority: 35,
    amEligible: true,
    pmEligible: true,
    defaultPhase: 'either',
    notes: 'A lightweight hydrating layer.',
    ruleVersion: 1,
    reviewedBy: null,
  },
  treatment: {
    role: 'treatment',
    basePriority: 40,
    amEligible: false,
    pmEligible: true,
    defaultPhase: 'pm',
    ruleVersion: 1,
    reviewedBy: null,
    notes: 'Apply to dry skin · pea-sized · avoid the eye area.',
  },
  exfoliant: {
    role: 'exfoliant',
    basePriority: 45,
    amEligible: false,
    pmEligible: true,
    defaultPhase: 'pm',
    notes: 'On exfoliation nights only.',
    ruleVersion: 1,
    reviewedBy: null,
  },
  eye: {
    role: 'eye',
    basePriority: 50,
    amEligible: true,
    pmEligible: true,
    defaultPhase: 'either',
    notes: 'A gentle pat around the eye area.',
    ruleVersion: 1,
    reviewedBy: null,
  },
  moisturiser: {
    role: 'moisturiser',
    basePriority: 60,
    amEligible: true,
    pmEligible: true,
    defaultPhase: 'either',
    notes: 'Seal everything in.',
    ruleVersion: 1,
    reviewedBy: null,
  },
  oil: {
    role: 'oil',
    basePriority: 70,
    amEligible: false,
    pmEligible: true,
    defaultPhase: 'pm',
    ruleVersion: 1,
    reviewedBy: null,
    notes: 'Optional. A final nourishing layer at night.',
  },
  spf: {
    role: 'spf',
    basePriority: 100,
    amEligible: true,
    pmEligible: false,
    defaultPhase: 'am',
    notes: 'Always the last morning step. Reapply through the day.',
    ruleVersion: 1,
    reviewedBy: null,
  },
};

export const ROUTINE_SEQUENCING_CORPUS_CONTENT: RoutineSequencingCorpusContent = {
  schemaVersion: 1,
  policyId: 'layerwell-routine-sequencing-v1',
  policyVersion: 1,
  targetJurisdictions: ['US'],
  marketScopePolicyId: ROUTINE_SEQUENCING_MARKET_SCOPE_POLICY.policyId,
  marketScopeSha256: canonicalSha256(ROUTINE_SEQUENCING_MARKET_SCOPE_POLICY),
  sources: [
    {
      sourceId: 'aad-skin-care-order-2026-07-26',
      title: 'Should I apply my skin care products in a certain order?',
      sourceUrl:
        'https://www.aad.org/public/everyday-care/skin-care-basics/care/apply-skin-care-certain-order',
      snapshotDate: '2026-07-26',
      retainedArtifactId: null,
      retainedArtifactRef: null,
      retainedArtifactSha256: null,
      propositions: [
        {
          propositionId: 'aad-general-product-order',
          statement: 'General cleanser, treatment, moisturiser, sunscreen ordering framework.',
        },
      ],
      reviewStatus: 'candidate_unreviewed',
    },
    {
      sourceId: 'aad-retinoid-use-2026-07-26',
      title: 'Retinoid or retinol?',
      sourceUrl:
        'https://www.aad.org/public/everyday-care/skin-care-secrets/anti-aging/retinoid-retinol',
      snapshotDate: '2026-07-26',
      retainedArtifactId: null,
      retainedArtifactRef: null,
      retainedArtifactSha256: null,
      propositions: [
        {
          propositionId: 'aad-retinoid-general-start-slow',
          statement:
            'General consumer guidance discusses gradual introduction, night use, and sun protection.',
        },
      ],
      reviewStatus: 'candidate_unreviewed',
    },
    {
      sourceId: 'apple-app-review-guidelines-2026-06-08',
      title: 'App Review Guidelines',
      sourceUrl: 'https://developer.apple.com/app-store/review/guidelines/',
      snapshotDate: '2026-07-26',
      retainedArtifactId: null,
      retainedArtifactRef: null,
      retainedArtifactSha256: null,
      propositions: [
        {
          propositionId: 'apple-medical-accuracy-review-boundary',
          statement:
            'Medical-app accuracy, methodology disclosure, and doctor-reminder review constraints.',
        },
      ],
      reviewStatus: 'candidate_unreviewed',
    },
    {
      sourceId: 'fda-general-wellness-guidance-2026-01',
      title: 'General Wellness: Policy for Low Risk Devices',
      sourceUrl:
        'https://www.fda.gov/regulatory-information/search-fda-guidance-documents/general-wellness-policy-low-risk-devices',
      snapshotDate: '2026-07-26',
      retainedArtifactId: null,
      retainedArtifactRef: null,
      retainedArtifactSha256: null,
      propositions: [
        {
          propositionId: 'fda-general-wellness-device-boundary',
          statement:
            'General-wellness device policy defines a regulatory boundary; it does not substantiate cosmetic guidance.',
        },
      ],
      reviewStatus: 'candidate_unreviewed',
    },
    {
      sourceId: 'ftc-health-products-compliance-guidance-2022-12',
      title: 'Health Products Compliance Guidance',
      sourceUrl:
        'https://www.ftc.gov/business-guidance/resources/health-products-compliance-guidance',
      snapshotDate: '2026-07-26',
      retainedArtifactId: null,
      retainedArtifactRef: null,
      retainedArtifactSha256: null,
      propositions: [
        {
          propositionId: 'ftc-claim-matched-substantiation-boundary',
          statement:
            'Health-related claims require claim-matched substantiation and review of the overall consumer impression.',
        },
      ],
      reviewStatus: 'candidate_unreviewed',
    },
  ],
  claimMappings: (
    [
      'sequencing.cleanser',
      'sequencing.toner',
      'sequencing.antioxidant',
      'sequencing.hydrating_serum',
      'sequencing.treatment',
      'sequencing.exfoliant',
      'sequencing.eye',
      'sequencing.moisturiser',
      'sequencing.oil',
      'sequencing.spf',
      'cadence.frequency_caps',
      'cadence.cycle_recovery_nights',
      'cadence.ramp',
      'cadence.phased_introduction',
      'cadence.recovery_windows',
      'copy.daily_am_instruction',
      'copy.phased_introduction_note',
      'copy.recovery_irritation',
      'copy.recovery_procedure',
      'copy.ramp_irritation',
    ] satisfies readonly RoutineGuidanceClaimId[]
  ).map((claimId) => ({
    claimId,
    // An official page about a topic is not enough to substantiate the exact
    // numbers and copy in this candidate. Reviewers must populate these exact
    // mappings against retained artifacts before admission can succeed.
    sourceIds: [],
    propositionIds: [],
  })),
  cadencePolicy: {
    candidateDisposition: 'draft_blocked',
    frequencyCapsPerWeek: {
      aha: { sensitive: 1, normal: 3, resistant: 4 },
      bha: { sensitive: 2, normal: 3, resistant: 7 },
      retinoid: { sensitive: 2, normal: 4, resistant: 7 },
    },
    cycleRecoveryNights: {
      classic: { betweenPushes: 0, trailing: 2 },
      gentle: { betweenPushes: 1, trailing: 1 },
      advanced: { betweenPushes: 0, trailing: 1 },
      custom: { betweenPushes: 1, trailing: 1 },
    },
    minimumBetweenRepeatedPotentSlotNights: 1,
    minimumRecoveryNightsPerCycle: 1,
    ramp: {
      sensitiveOrNormalStartPerWeek: 2,
      sensitiveOrNormalTargetPerWeek: 3,
      resistantStartPerWeek: 3,
      resistantTargetPerWeek: 4,
      otherActivePerWeek: 7,
      minimumPerWeek: 1,
      maximumPerWeek: 7,
      stepUpIncrementPerWeek: 1,
      irritationStepDownPerWeek: 1,
      minimumStableDaysBeforeOffer: 21,
    },
    phasedIntroductionDelayDays: 7,
    recoveryWindows: {
      procedureChoicesDays: [3, 5, 7],
      defaultProcedureDays: 5,
      irritationDays: 7,
    },
    stopRefer: {
      status: 'unavailable_pending_review',
      thresholds: [],
    },
  },
  copy: {
    dailyAmInstruction: 'Use in the morning. Follow the product label directions.',
    phasedIntroductionNoteTemplate:
      "We'll add your {productNames} next week, once your routine settles.",
    recoveryIrritationExplanation:
      'Your skin needs a break. Focus on gentle essentials until it feels settled.',
    recoveryProcedureExplanation:
      'Your cycle is paused while your skin recovers. Keep things simple and gentle.',
    rampIrritationExplanation:
      'We stepped your frequency down by one night per week. Keep your routine gentle until your skin feels comfortable again.',
  },
  rules: (Object.keys(SEQUENCING_RULES) as SequencingRole[]).map((role) => ({
    ...SEQUENCING_RULES[role],
    candidateDisposition: 'draft_blocked',
  })),
};

export const ROUTINE_SEQUENCING_CORPUS: RoutineSequencingCorpus = {
  status: 'draft_blocked',
  content: ROUTINE_SEQUENCING_CORPUS_CONTENT,
  contentSha256: canonicalSha256(ROUTINE_SEQUENCING_CORPUS_CONTENT),
};

function isDevelopmentRuntime(): boolean {
  return typeof __DEV__ !== 'undefined' && __DEV__;
}

function runtimeAdmittedRoutineSequencingCorpus() {
  const admitted = admitRoutineSequencingCorpus(
    ROUTINE_SEQUENCING_CORPUS,
    ROUTINE_SEQUENCING_REVIEW_RECEIPTS,
  );
  return isRuntimeAdmittedRoutineSequencingCorpus(admitted) ? admitted : null;
}

/**
 * The exact cadence object used by executable consumers. In production it can
 * only come from the branded, signed-corpus admission result. Development uses
 * the visibly draft candidate so tests and previews remain deterministic.
 */
export function shippableRoutineCadencePolicy(): RoutineCadencePolicy | null {
  const isDev = isDevelopmentRuntime();
  if (isDev && process.env.EXPO_PUBLIC_E2E_ROUTINE_CADENCE_REVIEW_GATE === 'closed') return null;
  if (isDev) return ROUTINE_SEQUENCING_CORPUS_CONTENT.cadencePolicy;
  return runtimeAdmittedRoutineSequencingCorpus()?.cadencePolicy ?? null;
}

/** Exact signed user-facing copy associated with the cadence corpus. */
export function shippableRoutineGuidanceCopy(): RoutineGuidanceCopy | null {
  const isDev = isDevelopmentRuntime();
  if (isDev && process.env.EXPO_PUBLIC_E2E_ROUTINE_CADENCE_REVIEW_GATE === 'closed') return null;
  if (isDev) return ROUTINE_SEQUENCING_CORPUS_CONTENT.copy;
  return runtimeAdmittedRoutineSequencingCorpus()?.copy ?? null;
}

/**
 * Stop/refer authority is intentionally independent of general cadence. A
 * cadence receipt cannot enable irritation/recovery while this returns null.
 */
export function shippableRoutineStopReferPolicy(): Extract<
  RoutineStopReferPolicy,
  { status: 'approved' }
> | null {
  const cadence = shippableRoutineCadencePolicy();
  return cadence?.stopRefer.status === 'approved' ? cadence.stopRefer : null;
}

export function routinePhasedIntroductionDelayDays(): number | null {
  return shippableRoutineCadencePolicy()?.phasedIntroductionDelayDays ?? null;
}

/**
 * Legacy `reviewedBy` metadata is retained only for database/source migration
 * compatibility. A free-text identity is never production publication
 * authority; exact signed corpus admission is required instead.
 */
export function isReviewedSequencingRule(_rule: Pick<SequencingRule, 'reviewedBy'>): boolean {
  return false;
}

function runtimeRuleFromCandidate(rule: RoutineSequencingCandidateRule): SequencingRule {
  const { candidateDisposition: _candidateDisposition, ...runtimeRule } = rule;
  return runtimeRule;
}

/**
 * Sequencing authority available to the current binary. Starter rules remain
 * explicit development fixtures; production receives only individually reviewed
 * rows, so a build flag cannot silently publish an unreviewed phase or instruction.
 */
export function shippableSequencingRules(
  rules: ShippableSequencingRules = SEQUENCING_RULES,
): ShippableSequencingRules {
  const isDev = typeof __DEV__ !== 'undefined' && __DEV__;
  const forceClosedForE2E =
    isDev && process.env.EXPO_PUBLIC_E2E_ROUTINE_SEQUENCING_REVIEW_GATE === 'closed';
  if (forceClosedForE2E) return {};

  if (!isDev) {
    // Ignore caller-supplied structural rules in production. Only this module's
    // exact, runtime-branded corpus can publish sequencing.
    const admitted = runtimeAdmittedRoutineSequencingCorpus();
    if (!admitted) return {};
    return Object.fromEntries(
      admitted.rules.map((rule) => [rule.role, runtimeRuleFromCandidate(rule)]),
    ) as ShippableSequencingRules;
  }

  const shippable: ShippableSequencingRules = {};

  for (const role of Object.keys(rules) as SequencingRole[]) {
    const rule = rules[role];
    if (rule?.role === role) {
      shippable[role] = rule;
    }
  }

  return shippable;
}

export type ClassifiableProduct = {
  id: string;
  name: string;
  tags: FunctionalTag[];
  category?: string | null;
};

const NAME_ROLES: { keyword: string; role: SequencingRole }[] = [
  { keyword: 'cleanser', role: 'cleanser' },
  { keyword: 'cleansing', role: 'cleanser' },
  { keyword: 'wash', role: 'cleanser' },
  { keyword: 'toner', role: 'toner' },
  { keyword: 'essence', role: 'toner' },
  { keyword: 'eye', role: 'eye' },
  { keyword: 'oil', role: 'oil' },
  { keyword: 'balm', role: 'oil' },
  { keyword: 'moistur', role: 'moisturiser' },
  { keyword: 'cream', role: 'moisturiser' },
  { keyword: 'lotion', role: 'moisturiser' },
];

const CATEGORY_ROLES: Record<string, SequencingRole | null> = {
  cleanser: 'cleanser',
  toner: 'toner',
  vitamin_c_serum: 'antioxidant',
  retinoid_serum: 'treatment',
  serum: 'hydrating_serum',
  moisturiser_tube: 'moisturiser',
  moisturiser_jar: 'moisturiser',
  eye_cream: 'eye',
  lash_brow: 'eye',
  mascara: 'eye',
  spf: 'spf',
  oil_balm: 'oil',
  benzoyl_peroxide: 'treatment',
  other: null,
};

/** Classify a product to a sequencing role. Active TAGS win over generic name
 *  keywords (a "glycolic toner" is an exfoliant, not a plain toner). */
export function classifyRole(product: ClassifiableProduct): SequencingRole | null {
  const tags = new Set(product.tags);
  if (tags.has('retinoid')) return 'treatment';
  if (tags.has('aha') || tags.has('bha')) return 'exfoliant';
  if (tags.has('benzoyl_peroxide') || tags.has('hydroquinone')) return 'treatment';
  if (tags.has('vitamin_c')) return 'antioxidant';
  if (tags.has('copper_peptide')) return 'treatment';
  if (tags.has('niacinamide')) return 'hydrating_serum';
  if (tags.has('humectant')) return 'hydrating_serum';
  if (tags.has('ceramide') || tags.has('barrier')) return 'moisturiser';
  if (tags.has('sunscreen') || tags.has('physical_spf') || tags.has('chemical_spf')) return 'spf';

  if (product.category) {
    const categoryRole = CATEGORY_ROLES[product.category];
    if (categoryRole !== undefined) return categoryRole;
  }

  const name = product.name.toLowerCase();
  for (const { keyword, role } of NAME_ROLES) {
    if (name.includes(keyword)) return role;
  }
  return null;
}

export type RoutineCadenceDisposition = 'stable' | 'daily_am' | 'cycle' | 'withheld';

/**
 * The cadence families currently defined by docs/05. A treatment role alone is
 * not enough evidence to invent timing: known cycle classes rotate at night,
 * benzoyl peroxide uses the documented AM default, and unsupported treatment
 * families remain withheld until an explicit reviewed cadence exists.
 */
export function routineCadenceDisposition(product: ClassifiableProduct): RoutineCadenceDisposition {
  const tags = new Set(product.tags);
  if (
    tags.has('retinoid') ||
    tags.has('aha') ||
    tags.has('bha') ||
    product.category === 'retinoid_serum'
  ) {
    return 'cycle';
  }
  if (tags.has('benzoyl_peroxide') || product.category === 'benzoyl_peroxide') {
    return 'daily_am';
  }

  const role = classifyRole(product);
  if (role === 'treatment' || role === 'exfoliant') return 'withheld';
  return 'stable';
}

export type SequencedStep = {
  productId: string;
  name: string;
  role: SequencingRole;
  cadence: Exclude<RoutineCadenceDisposition, 'withheld'>;
  order: number;
  instruction: string;
};

export function instructionFor(
  role: SequencingRole,
  cadence: Exclude<RoutineCadenceDisposition, 'withheld'>,
  rules: ShippableSequencingRules = shippableSequencingRules(),
): string | null {
  const rule = shippableSequencingRules(rules)[role];
  if (!rule) return null;
  if (cadence === 'daily_am') {
    return shippableRoutineGuidanceCopy()?.dailyAmInstruction ?? null;
  }
  return rule.notes;
}

/** Which phase(s) a role belongs to. `either` => appears in BOTH AM and PM
 *  (cleanser, moisturiser, toner). Resolution overrides (separate_am_pm) handled
 *  by the caller. */
export function phasesFor(
  role: SequencingRole,
  rules: ShippableSequencingRules = shippableSequencingRules(),
): RoutinePhase[] {
  const rule = shippableSequencingRules(rules)[role];
  if (!rule) return [];
  if (rule.defaultPhase === 'am') return ['am'];
  if (rule.defaultPhase === 'pm') return ['pm'];
  return ['am', 'pm'];
}

/** Order a set of products within one phase by the canonical priority. */
export function sequencePhase(
  products: ClassifiableProduct[],
  phase: 'am' | 'pm',
  rules: ShippableSequencingRules = shippableSequencingRules(),
): SequencedStep[] {
  const availableRules = shippableSequencingRules(rules);
  const eligible = products
    .map((p) => {
      const role = classifyRole(p);
      return {
        p,
        role,
        cadence: routineCadenceDisposition(p),
        rule: role ? availableRules[role] : undefined,
      };
    })
    .filter(
      (
        item,
      ): item is {
        p: ClassifiableProduct;
        role: SequencingRole;
        cadence: Exclude<RoutineCadenceDisposition, 'withheld'>;
        rule: SequencingRule;
      } => item.role != null && item.cadence !== 'withheld' && item.rule != null,
    )
    .filter(({ role, cadence, rule }) => {
      if (cadence === 'daily_am') return phase === 'am';
      const inPhase = phasesFor(role, availableRules).includes(phase);
      const phaseEligible = phase === 'am' ? rule.amEligible : rule.pmEligible;
      return inPhase && phaseEligible;
    })
    .sort((a, b) => a.rule.basePriority - b.rule.basePriority || a.p.id.localeCompare(b.p.id));

  return eligible.flatMap(({ p, role, cadence }, i) => {
    const instruction = instructionFor(role, cadence, availableRules);
    if (instruction == null) return [];
    return [
      {
        productId: p.id,
        name: p.name,
        role,
        cadence,
        order: (i + 1) * 10,
        instruction,
      },
    ];
  });
}
