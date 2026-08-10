import type { FunctionalTag, IngredientSubflag } from '@layerwell/types';

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
  // Hydrating / barrier support
  'hyaluronic acid': [{ tag: 'humectant' }],
  'sodium hyaluronate': [{ tag: 'humectant' }],
  glycerin: [{ tag: 'humectant' }],
  panthenol: [{ tag: 'humectant' }, { tag: 'barrier' }],
  'beta-glucan': [{ tag: 'humectant' }, { tag: 'barrier' }],
  // Barrier / soothing
  'ceramide np': [{ tag: 'ceramide' }, { tag: 'barrier' }],
  ceramide: [{ tag: 'ceramide' }, { tag: 'barrier' }],
};

const LABEL_ALIASES: { pattern: RegExp; defs: TagDef[] }[] = [
  // Front-label shorthand used by manual/onboarding entry before catalog seed.
  { pattern: /\bretinoids?\b/i, defs: [{ tag: 'retinoid' }] },
  { pattern: /\bhydroxypinacolone\s+retinoate\b/i, defs: [{ tag: 'retinoid' }] },
  { pattern: /\bglycolic\b/i, defs: [{ tag: 'aha' }] },
  { pattern: /\blactic\b/i, defs: [{ tag: 'aha' }] },
  { pattern: /\bmandelic\b/i, defs: [{ tag: 'aha' }] },
  { pattern: /\baha\b/i, defs: [{ tag: 'aha' }] },
  { pattern: /\bsalicylic\b/i, defs: [{ tag: 'bha' }] },
  { pattern: /\bbha\b/i, defs: [{ tag: 'bha' }] },
  { pattern: /\bvit(?:amin)?[\s-]*c\b/i, defs: [{ tag: 'vitamin_c' }] },
  { pattern: /\bsunscreens?\b/i, defs: [{ tag: 'sunscreen' }] },
  { pattern: /\bsun\s+screens?\b/i, defs: [{ tag: 'sunscreen' }] },
  { pattern: /\bsunblocks?\b/i, defs: [{ tag: 'sunscreen' }] },
  { pattern: /\bspf(?:\s*\d{1,3})?\b/i, defs: [{ tag: 'sunscreen' }] },
];

export type TaggedIngredient = { tag: FunctionalTag; subflag?: IngredientSubflag };

function dedupeTagDefs(defs: TagDef[]): TagDef[] {
  const seen = new Set<string>();
  return defs.filter((def) => {
    const key = `${def.tag}:${def.subflag ?? ''}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

/** Resolve a single ingredient name to its functional tags (case/space tolerant). */
export function tagsForIngredient(name: string): TaggedIngredient[] {
  const key = name.trim().toLowerCase();
  if (DICTIONARY[key]) return DICTIONARY[key];
  const matches: TagDef[] = [];
  // loose contains-match for compound names ("ceramide np, ceramide ap")
  for (const [dictKey, defs] of Object.entries(DICTIONARY)) {
    if (key.includes(dictKey)) matches.push(...defs);
  }
  for (const alias of LABEL_ALIASES) {
    if (alias.pattern.test(key)) matches.push(...alias.defs);
  }
  return dedupeTagDefs(matches);
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
