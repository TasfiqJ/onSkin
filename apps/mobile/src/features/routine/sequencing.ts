import type { FunctionalTag, RoutinePhase, SequencingRole } from '@onskin/types';

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

export function isReviewedSequencingRule(rule: Pick<SequencingRule, 'reviewedBy'>): boolean {
  return typeof rule.reviewedBy === 'string' && rule.reviewedBy.trim().length > 0;
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

  const shippable: ShippableSequencingRules = {};

  for (const role of Object.keys(rules) as SequencingRole[]) {
    const rule = rules[role];
    if (rule?.role === role && (isDev || isReviewedSequencingRule(rule))) {
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
    return 'Use in the morning. Follow the product label directions.';
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
