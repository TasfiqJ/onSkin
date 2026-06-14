import type { FunctionalTag, IngredientSubflag } from '@onskin/types';

// Starter INCI → functional-tag dictionary (docs/02 §2.4). The AUTHORITATIVE
// mapping lives in the DB (ingredient_tags, populated by the CosIng/OBF seed , 
// BLOCKED: B-CATALOG-SEED). This client-side dictionary covers the ~handful of
// active families that actually drive conflicts, so manual-entry / OCR / curated
// products can be tagged and the engine works offline and pre-seed.
//
// The engine matches on TAGS, not specific molecules. It's the acid-ness and
// retinoid-ness that interact, not the brand ingredient.
type TagDef = { tag: FunctionalTag; subflag?: IngredientSubflag };

const DICTIONARY: Record<string, TagDef[]> = {
  // Retinoids
  retinol: [{ tag: 'retinoid' }],
  'retinyl palmitate': [{ tag: 'retinoid' }],
  retinaldehyde: [{ tag: 'retinoid' }],
  retinal: [{ tag: 'retinoid' }],
  tretinoin: [{ tag: 'retinoid', subflag: 'tretinoin' }],
  'retinoic acid': [{ tag: 'retinoid', subflag: 'tretinoin' }],
  adapalene: [{ tag: 'retinoid', subflag: 'adapalene' }],
  // AHAs
  'glycolic acid': [{ tag: 'aha' }],
  'lactic acid': [{ tag: 'aha' }],
  'mandelic acid': [{ tag: 'aha' }],
  'citric acid': [{ tag: 'aha' }],
  // BHA
  'salicylic acid': [{ tag: 'bha' }],
  'betaine salicylate': [{ tag: 'bha' }],
  // Benzoyl peroxide
  'benzoyl peroxide': [{ tag: 'benzoyl_peroxide' }],
  // Vitamin C
  'ascorbic acid': [{ tag: 'vitamin_c', subflag: 'l_ascorbic_acid' }],
  'l-ascorbic acid': [{ tag: 'vitamin_c', subflag: 'l_ascorbic_acid' }],
  '3-o-ethyl ascorbic acid': [{ tag: 'vitamin_c' }],
  'sodium ascorbyl phosphate': [{ tag: 'vitamin_c' }],
  'magnesium ascorbyl phosphate': [{ tag: 'vitamin_c' }],
  'ascorbyl glucoside': [{ tag: 'vitamin_c' }],
  // Niacinamide
  niacinamide: [{ tag: 'niacinamide' }],
  nicotinamide: [{ tag: 'niacinamide' }],
  // Copper peptides
  'copper tripeptide-1': [{ tag: 'copper_peptide' }],
  'copper peptide': [{ tag: 'copper_peptide' }],
  // Hydroquinone
  hydroquinone: [{ tag: 'hydroquinone' }],
  // Sunscreen filters
  'zinc oxide': [{ tag: 'sunscreen' }, { tag: 'physical_spf' }],
  'titanium dioxide': [{ tag: 'sunscreen' }, { tag: 'physical_spf' }],
  avobenzone: [{ tag: 'sunscreen' }, { tag: 'chemical_spf' }],
  octinoxate: [{ tag: 'sunscreen' }, { tag: 'chemical_spf' }],
  // Barrier / soothing
  'ceramide np': [{ tag: 'ceramide' }, { tag: 'barrier' }],
  ceramide: [{ tag: 'ceramide' }, { tag: 'barrier' }],
};

export type TaggedIngredient = { tag: FunctionalTag; subflag?: IngredientSubflag };

/** Resolve a single ingredient name to its functional tags (case/space tolerant). */
export function tagsForIngredient(name: string): TaggedIngredient[] {
  const key = name.trim().toLowerCase();
  if (DICTIONARY[key]) return DICTIONARY[key];
  // loose contains-match for compound names ("ceramide np, ceramide ap")
  for (const [dictKey, defs] of Object.entries(DICTIONARY)) {
    if (key.includes(dictKey)) return defs;
  }
  return [];
}

/** Resolve a product's whole ingredient list to a de-duplicated tag set + subflags. */
export function tagsForIngredientList(names: string[]): {
  tags: Set<FunctionalTag>;
  subflags: Set<IngredientSubflag>;
} {
  const tags = new Set<FunctionalTag>();
  const subflags = new Set<IngredientSubflag>();
  for (const name of names) {
    for (const def of tagsForIngredient(name)) {
      tags.add(def.tag);
      if (def.subflag) subflags.add(def.subflag);
    }
  }
  return { tags, subflags };
}
