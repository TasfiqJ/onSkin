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
};

// Mirrors supabase/migrations/...0014_sequencing_rules.sql.
export const SEQUENCING_RULES: Record<SequencingRole, SequencingRule> = {
  cleanser: { role: 'cleanser', basePriority: 10, amEligible: true, pmEligible: true, defaultPhase: 'either', notes: 'Start with a clean base.' },
  toner: { role: 'toner', basePriority: 20, amEligible: true, pmEligible: true, defaultPhase: 'either', notes: 'Optional. A hydrating or balancing layer.' },
  antioxidant: { role: 'antioxidant', basePriority: 30, amEligible: true, pmEligible: true, defaultPhase: 'am', notes: 'Vitamin C in the morning, under your SPF.' },
  hydrating_serum: { role: 'hydrating_serum', basePriority: 35, amEligible: true, pmEligible: true, defaultPhase: 'either', notes: 'A lightweight hydrating layer.' },
  treatment: { role: 'treatment', basePriority: 40, amEligible: false, pmEligible: true, defaultPhase: 'pm', notes: 'Apply to dry skin · pea-sized · avoid the eye area.' },
  exfoliant: { role: 'exfoliant', basePriority: 45, amEligible: false, pmEligible: true, defaultPhase: 'pm', notes: 'On exfoliation nights only.' },
  eye: { role: 'eye', basePriority: 50, amEligible: true, pmEligible: true, defaultPhase: 'either', notes: 'A gentle pat around the eye area.' },
  moisturiser: { role: 'moisturiser', basePriority: 60, amEligible: true, pmEligible: true, defaultPhase: 'either', notes: 'Seal everything in.' },
  oil: { role: 'oil', basePriority: 70, amEligible: false, pmEligible: true, defaultPhase: 'pm', notes: 'Optional. A final nourishing layer at night.' },
  spf: { role: 'spf', basePriority: 100, amEligible: true, pmEligible: false, defaultPhase: 'am', notes: 'Always the last morning step. Reapply through the day.' },
};

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

export type SequencedStep = {
  productId: string;
  name: string;
  role: SequencingRole;
  order: number;
  instruction: string;
};

/** Which phase(s) a role belongs to. `either` => appears in BOTH AM and PM
 *  (cleanser, moisturiser, toner). Resolution overrides (separate_am_pm) handled
 *  by the caller. */
export function phasesFor(role: SequencingRole): RoutinePhase[] {
  const rule = SEQUENCING_RULES[role];
  if (rule.defaultPhase === 'am') return ['am'];
  if (rule.defaultPhase === 'pm') return ['pm'];
  return ['am', 'pm'];
}

/** Order a set of products within one phase by the canonical priority. */
export function sequencePhase(products: ClassifiableProduct[], phase: 'am' | 'pm'): SequencedStep[] {
  const eligible = products
    .map((p) => ({ p, role: classifyRole(p) }))
    .filter((item): item is { p: ClassifiableProduct; role: SequencingRole } => item.role != null)
    .filter(({ role }) => {
      const rule = SEQUENCING_RULES[role];
      const inPhase = phasesFor(role).includes(phase);
      const phaseEligible = phase === 'am' ? rule.amEligible : rule.pmEligible;
      return inPhase && phaseEligible;
    })
    .sort((a, b) => SEQUENCING_RULES[a.role].basePriority - SEQUENCING_RULES[b.role].basePriority);

  return eligible.map(({ p, role }, i) => ({
    productId: p.id,
    name: p.name,
    role,
    order: (i + 1) * 10,
    instruction: SEQUENCING_RULES[role].notes,
  }));
}
