import type { EvidenceLabel, FunctionalTag, GoalId, SequencingRole } from '@layerwell/types';

import type { EngineProduct } from '@/features/intelligence/engine';

import { isCurrentGoalActiveReviewClearanceOpen } from './goalAdmission';

// The recommendable PRODUCT-TYPE catalog (docs/09 §5/§6). The engine is type-first:
// it recommends a *type* ("a mineral SPF 30+"), optionally surfacing specific
// products ranked by fit. Until the curated catalog lands (B-CATALOG-SEED) there
// are no specific products, so the engine degrades gracefully to type-first
// guidance. `example` is an ILLUSTRATIVE category note, never a catalog product.
//
// CHURCH AND STATE (docs/09 §3, D-054): every field here is about the user/skin or
// the evidence. There is NO commission / affiliate / brand-deal field. The FIT
// score (fit.ts) draws only from this and the profile, never from commerce.
//
// *** BLOCKED: B-DERM-REVIEW. Medically-adjacent goal actives are governed by the
// *** structured, current clearance in goalAdmission.ts. Catalog rows cannot
// *** self-authorize with an inline reviewer name. Structural routine-completeness
// *** types remain honest, type-first guidance.

export type RecType = {
  /** Stable type key (matches recommendations.product_type). */
  type: string;
  role: SequencingRole;
  /** Functional tags the type carries. Tags select candidate rules; exact
   * applicability facts decide or generically withhold the recommendation. */
  tags: FunctionalTag[];
  /**
   * Exact reviewed product/formulation facts. Type-first entries normally omit
   * these; an admitted rule that requires them then fails closed.
   */
  applicabilityFacts?: EngineProduct['applicabilityFacts'];
  /** Type-first "What" label (docs/09 §6). */
  what: string;
  /** Illustrative category example. NOT a catalog product (B-CATALOG-SEED). */
  example: string | null;
  /** Cosmetic-concern routing metadata; not product-specific or claim clearance. */
  goals: GoalId[];
  /** The docs/02-style evidence label for the type's relevance (§6). */
  evidenceLabel: EvidenceLabel;
  /** A restrained type-first evidence note; final claim clearance remains external. */
  evidenceNote: string;
  /** An honest downside/flaw, surfaced in the "how" (Wirecutter honesty, §3/§6). */
  caveat: string | null;
  /** Whether local type-first guidance avoids a built-in sensitivity caution. */
  sensitiveSafe: boolean;
  /** Conservative type-first reproductive gate; never product-specific safety clearance. */
  pregnancySafe: boolean;
  /** Carries a potent active => medically-adjacent => launch-gated (B-DERM-REVIEW).
   *  Structural routine-completeness types are not gated. */
  medicalAdjacent: boolean;
};

// Structural type-first guidance. It may render locally, but no catalog identity,
// product-specific commerce, or final launch/claim clearance follows from this list.
const STRUCTURAL: RecType[] = [
  {
    type: 'mineral_spf',
    role: 'spf',
    tags: ['sunscreen', 'physical_spf'],
    what: 'A mineral SPF 30+',
    example: 'e.g. a zinc-based daily SPF 30',
    goals: ['anti_aging', 'even_tone', 'sensitivity'],
    evidenceLabel: 'established',
    evidenceNote: 'Daily SPF. Broad consensus',
    caveat: 'Mineral SPF can leave a slight white cast',
    sensitiveSafe: true,
    pregnancySafe: true,
    medicalAdjacent: false,
  },
  {
    type: 'daily_spf',
    role: 'spf',
    tags: ['sunscreen', 'chemical_spf'],
    what: 'A daily SPF 30+',
    example: 'e.g. a lightweight everyday SPF 30',
    goals: ['anti_aging', 'even_tone'],
    evidenceLabel: 'established',
    evidenceNote: 'Daily SPF. Broad consensus',
    caveat: null,
    sensitiveSafe: false,
    pregnancySafe: true,
    medicalAdjacent: false,
  },
  {
    type: 'ceramide_moisturiser',
    role: 'moisturiser',
    tags: ['ceramide', 'barrier'],
    what: 'A ceramide moisturiser',
    example: 'e.g. a fragrance-free ceramide cream',
    goals: ['hydration', 'barrier_repair', 'sensitivity'],
    evidenceLabel: 'established',
    evidenceNote: 'Barrier support. Well established',
    caveat: null,
    sensitiveSafe: true,
    pregnancySafe: true,
    medicalAdjacent: false,
  },
  {
    type: 'gentle_cleanser',
    role: 'cleanser',
    tags: [],
    what: 'A gentle cleanser',
    example: 'e.g. a non-stripping gel or cream cleanser',
    goals: ['sensitivity', 'barrier_repair'],
    evidenceLabel: 'established',
    evidenceNote: 'A clean, non-stripping base. Well established',
    caveat: null,
    sensitiveSafe: true,
    pregnancySafe: true,
    medicalAdjacent: false,
  },
  {
    type: 'fragrance_free_cleanser',
    role: 'cleanser',
    tags: [],
    what: 'A fragrance-free cleanser',
    example: 'e.g. a fragrance-free gel cleanser',
    goals: ['sensitivity'],
    evidenceLabel: 'established',
    evidenceNote: 'Fragrance-free suits reactive skin. Well established',
    caveat: null,
    sensitiveSafe: true,
    pregnancySafe: true,
    medicalAdjacent: false,
  },
  {
    type: 'hydrating_serum',
    role: 'hydrating_serum',
    tags: ['humectant'],
    what: 'A hydrating serum',
    example: 'e.g. a hyaluronic-acid or glycerin serum',
    goals: ['hydration'],
    evidenceLabel: 'plausible',
    evidenceNote: 'Humectants draw in water. Plausible for hydration',
    caveat: null,
    sensitiveSafe: true,
    pregnancySafe: true,
    medicalAdjacent: false,
  },
];

// Goal-driven actives (medically-adjacent; launch-gated under B-DERM-REVIEW) -----
const GOAL_ACTIVES: RecType[] = [
  {
    type: 'niacinamide_serum',
    role: 'hydrating_serum',
    tags: ['niacinamide'],
    what: 'A niacinamide serum',
    example: 'e.g. a 5% niacinamide serum',
    goals: ['even_tone', 'clear_skin', 'sensitivity'],
    evidenceLabel: 'plausible',
    evidenceNote: 'Niacinamide. Plausible for tone & barrier',
    caveat: null,
    sensitiveSafe: true,
    pregnancySafe: true,
    medicalAdjacent: true,
  },
  {
    type: 'vitamin_c_serum',
    role: 'antioxidant',
    tags: ['vitamin_c'],
    what: 'A vitamin C serum',
    example: 'e.g. a stabilised morning vitamin C',
    goals: ['even_tone', 'anti_aging'],
    evidenceLabel: 'plausible',
    evidenceNote: 'Vitamin C. Plausible for the look of uneven tone',
    caveat: 'Some pairings can destabilise it. Best used in the morning',
    sensitiveSafe: true,
    pregnancySafe: true,
    medicalAdjacent: true,
  },
  {
    type: 'azelaic_acid',
    role: 'treatment',
    tags: [],
    what: 'An azelaic acid',
    example: 'e.g. a 10% azelaic acid',
    goals: ['even_tone', 'clear_skin'],
    evidenceLabel: 'plausible',
    evidenceNote: 'Azelaic acid. Plausible for tone, and pregnancy-friendly',
    caveat: 'Can tingle at first',
    sensitiveSafe: true,
    pregnancySafe: true,
    medicalAdjacent: true,
  },
  {
    type: 'retinoid_serum',
    role: 'treatment',
    tags: ['retinoid'],
    what: 'A retinoid',
    example: 'e.g. a low-strength retinol to start',
    goals: ['anti_aging', 'clear_skin'],
    evidenceLabel: 'plausible',
    evidenceNote: 'Retinoids. Among the better-studied actives for fine lines',
    caveat: 'Introduce slowly. Can cause initial dryness or flaking',
    sensitiveSafe: false,
    pregnancySafe: false, // HARD exclusion in pregnancy/breastfeeding (docs/02 safety)
    medicalAdjacent: true,
  },
  {
    type: 'bha_exfoliant',
    role: 'exfoliant',
    tags: ['bha'],
    what: 'A BHA exfoliant',
    example: 'e.g. a 2% salicylic acid, a couple of nights a week',
    goals: ['clear_skin'],
    evidenceLabel: 'plausible',
    evidenceNote: 'BHA. Plausible for congestion-prone skin',
    caveat: 'Build up slowly to avoid over-exfoliating',
    sensitiveSafe: false,
    pregnancySafe: true, // Category metadata only; goal-active admission remains closed.
    medicalAdjacent: true,
  },
];

export const REC_TYPES: RecType[] = [...STRUCTURAL, ...GOAL_ACTIVES];

/**
 * Launch gate (B-DERM-REVIEW), mirroring `shippableRules()`.
 * Medically-adjacent goal-active types are withheld until the governed review
 * corpus is current. Dev mode is not a review bypass.
 * Structural routine-completeness types may render locally as type-first guidance;
 * this is not product, claim, legal, sunscreen-category, or final launch clearance.
 */
export function shippableRecTypes(types: RecType[] = REC_TYPES): RecType[] {
  const goalReviewClearanceOpen = isCurrentGoalActiveReviewClearanceOpen();
  return types.filter((type) => !type.medicalAdjacent || goalReviewClearanceOpen);
}

/**
 * Whether goal-driven (medically-adjacent) recommendations can ship. False in
 * every environment until B-DERM-REVIEW, where the gate strips every goal active. The
 * "you're set" copy must NOT claim the routine is "matched to your goals" when
 * this is false, because the engine cannot serve goal recs then (docs/09 §4: the
 * honesty bug where the gate silently removes the only goal mechanism).
 */
export function goalRecsShippable(): boolean {
  return shippableRecTypes().some((t) => t.medicalAdjacent);
}

export function recTypeByKey(type: string, types: RecType[] = REC_TYPES): RecType | undefined {
  return types.find((t) => t.type === type);
}
