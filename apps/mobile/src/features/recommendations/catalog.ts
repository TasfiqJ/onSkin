import type { EvidenceLabel, FunctionalTag, GoalId, SequencingRole } from '@onskin/types';

// The recommendable PRODUCT-TYPE catalog (docs/09 §5/§6). The engine is type-first:
// it recommends a *type* ("a mineral SPF 30+"), optionally surfacing specific
// products ranked by fit. Until the curated catalog lands (B-CATALOG-SEED) there
// are no specific products, so the engine degrades gracefully to type-first
// guidance — `example` is an ILLUSTRATIVE category note, never a catalog product.
//
// CHURCH AND STATE (docs/09 §3, D-054): every field here is about the user/skin or
// the evidence — there is NO commission / affiliate / brand-deal field. The FIT
// score (fit.ts) draws only from this and the profile, never from commerce.
//
// *** BLOCKED: B-DERM-REVIEW — the medically-adjacent entries (an active for a
// *** goal: retinoid, acids, vitamin C, azelaic, niacinamide) carry reviewedBy =
// *** null and are launch-gated exactly like the conflict matrix (rules.ts) and the
// *** PAO defaults (pao.ts). Structural routine-completeness types (a cleanser, a
// *** moisturiser, an SPF, a hydrating serum) are NOT drug claims and ship; the
// *** goal-active recommendations only surface in dev until clinical sign-off.

export type RecType = {
  /** Stable type key (matches recommendations.product_type). */
  type: string;
  role: SequencingRole;
  /** Functional tags the type carries — used for ownership detection + so the
   *  engine never recommends a type that would ADD a conflict to the shelf. */
  tags: FunctionalTag[];
  /** Type-first "What" label (docs/09 §6). */
  what: string;
  /** Illustrative category example — NOT a catalog product (B-CATALOG-SEED). */
  example: string | null;
  /** Goals this type can help with (claim-safe; concerns, not conditions). */
  goals: GoalId[];
  /** The docs/02-style evidence label for the type's relevance (§6). */
  evidenceLabel: EvidenceLabel;
  /** A calm, claim-safe one-line evidence note for the "how". */
  evidenceNote: string;
  /** An honest downside/flaw, surfaced in the "how" (Wirecutter honesty, §3/§6). */
  caveat: string | null;
  /** Safe to recommend for sensitive skin without a caution. */
  sensitiveSafe: boolean;
  /** Safe in pregnancy/breastfeeding. false => HARD-excluded for those profiles. */
  pregnancySafe: boolean;
  /** Carries a potent active => medically-adjacent => launch-gated (B-DERM-REVIEW).
   *  Structural routine-completeness types are not gated. */
  medicalAdjacent: boolean;
  /** Clinical sign-off marker (docs/02 §9 launch gate). null until B-DERM-REVIEW. */
  reviewedBy: string | null;
};

// Structural routine-completeness types (claim-safe; always shippable) ----------
const STRUCTURAL: RecType[] = [
  {
    type: 'mineral_spf',
    role: 'spf',
    tags: ['sunscreen', 'physical_spf'],
    what: 'A mineral SPF 30+',
    example: 'e.g. a zinc-based daily SPF 30',
    goals: ['anti_aging', 'even_tone', 'sensitivity'],
    evidenceLabel: 'established',
    evidenceNote: 'Daily SPF — broad consensus',
    caveat: 'Mineral SPF can leave a slight white cast',
    sensitiveSafe: true,
    pregnancySafe: true,
    medicalAdjacent: false,
    reviewedBy: null,
  },
  {
    type: 'daily_spf',
    role: 'spf',
    tags: ['sunscreen', 'chemical_spf'],
    what: 'A daily SPF 30+',
    example: 'e.g. a lightweight everyday SPF 30',
    goals: ['anti_aging', 'even_tone'],
    evidenceLabel: 'established',
    evidenceNote: 'Daily SPF — broad consensus',
    caveat: null,
    sensitiveSafe: false,
    pregnancySafe: true,
    medicalAdjacent: false,
    reviewedBy: null,
  },
  {
    type: 'ceramide_moisturiser',
    role: 'moisturiser',
    tags: ['ceramide', 'barrier'],
    what: 'A ceramide moisturiser',
    example: 'e.g. a fragrance-free ceramide cream',
    goals: ['hydration', 'barrier_repair', 'sensitivity'],
    evidenceLabel: 'established',
    evidenceNote: 'Barrier support — well established',
    caveat: null,
    sensitiveSafe: true,
    pregnancySafe: true,
    medicalAdjacent: false,
    reviewedBy: null,
  },
  {
    type: 'gentle_cleanser',
    role: 'cleanser',
    tags: [],
    what: 'A gentle cleanser',
    example: 'e.g. a non-stripping gel or cream cleanser',
    goals: ['sensitivity', 'barrier_repair'],
    evidenceLabel: 'established',
    evidenceNote: 'A clean, non-stripping base — well established',
    caveat: null,
    sensitiveSafe: true,
    pregnancySafe: true,
    medicalAdjacent: false,
    reviewedBy: null,
  },
  {
    type: 'fragrance_free_cleanser',
    role: 'cleanser',
    tags: [],
    what: 'A fragrance-free cleanser',
    example: 'e.g. a fragrance-free gel cleanser',
    goals: ['sensitivity'],
    evidenceLabel: 'established',
    evidenceNote: 'Fragrance-free suits reactive skin — well established',
    caveat: null,
    sensitiveSafe: true,
    pregnancySafe: true,
    medicalAdjacent: false,
    reviewedBy: null,
  },
  {
    type: 'hydrating_serum',
    role: 'hydrating_serum',
    tags: ['humectant'],
    what: 'A hydrating serum',
    example: 'e.g. a hyaluronic-acid or glycerin serum',
    goals: ['hydration'],
    evidenceLabel: 'plausible',
    evidenceNote: 'Humectants draw in water — plausible for hydration',
    caveat: null,
    sensitiveSafe: true,
    pregnancySafe: true,
    medicalAdjacent: false,
    reviewedBy: null,
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
    evidenceNote: 'Niacinamide — plausible for tone & barrier',
    caveat: null,
    sensitiveSafe: true,
    pregnancySafe: true,
    medicalAdjacent: true,
    reviewedBy: null,
  },
  {
    type: 'vitamin_c_serum',
    role: 'antioxidant',
    tags: ['vitamin_c'],
    what: 'A vitamin C serum',
    example: 'e.g. a stabilised morning vitamin C',
    goals: ['even_tone', 'anti_aging'],
    evidenceLabel: 'plausible',
    evidenceNote: 'Vitamin C — plausible for the look of uneven tone',
    caveat: 'Some pairings can destabilise it — best used in the morning',
    sensitiveSafe: true,
    pregnancySafe: true,
    medicalAdjacent: true,
    reviewedBy: null,
  },
  {
    type: 'azelaic_acid',
    role: 'treatment',
    tags: [],
    what: 'An azelaic acid',
    example: 'e.g. a 10% azelaic acid',
    goals: ['even_tone', 'clear_skin'],
    evidenceLabel: 'plausible',
    evidenceNote: 'Azelaic acid — plausible for tone, and pregnancy-friendly',
    caveat: 'Can tingle at first',
    sensitiveSafe: true,
    pregnancySafe: true,
    medicalAdjacent: true,
    reviewedBy: null,
  },
  {
    type: 'retinoid_serum',
    role: 'treatment',
    tags: ['retinoid'],
    what: 'A retinoid',
    example: 'e.g. a low-strength retinol to start',
    goals: ['anti_aging', 'clear_skin'],
    evidenceLabel: 'plausible',
    evidenceNote: 'Retinoids — among the better-studied actives for fine lines',
    caveat: 'Introduce slowly — can cause initial dryness or flaking',
    sensitiveSafe: false,
    pregnancySafe: false, // HARD exclusion in pregnancy/breastfeeding (docs/02 safety)
    medicalAdjacent: true,
    reviewedBy: null,
  },
  {
    type: 'bha_exfoliant',
    role: 'exfoliant',
    tags: ['bha'],
    what: 'A BHA exfoliant',
    example: 'e.g. a 2% salicylic acid, a couple of nights a week',
    goals: ['clear_skin'],
    evidenceLabel: 'plausible',
    evidenceNote: 'BHA — plausible for congestion-prone skin',
    caveat: 'Build up slowly to avoid over-exfoliating',
    sensitiveSafe: false,
    pregnancySafe: true, // low-dose cosmetic BHA generally fine; dose-gating lives in the conflict engine
    medicalAdjacent: true,
    reviewedBy: null,
  },
];

export const REC_TYPES: RecType[] = [...STRUCTURAL, ...GOAL_ACTIVES];

/**
 * Launch gate (B-DERM-REVIEW), mirroring `shippableRules()` / `reviewedCategoryPao()`.
 * In production, the medically-adjacent goal-active types are withheld until a
 * board-certified dermatologist signs off (reviewedBy set); the engine then
 * degrades to type-first STRUCTURAL guidance only. In dev the full set is used so
 * the layer is demoable. Structural routine-completeness types always ship — they
 * are routine-completeness, not drug claims.
 */
export const RECS_REVIEWED = false;

export function shippableRecTypes(types: RecType[] = REC_TYPES): RecType[] {
  const isDev = typeof __DEV__ !== 'undefined' && __DEV__;
  if (isDev) return types;
  return types.filter((t) => !t.medicalAdjacent || t.reviewedBy != null);
}

export function recTypeByKey(type: string, types: RecType[] = REC_TYPES): RecType | undefined {
  return types.find((t) => t.type === type);
}
