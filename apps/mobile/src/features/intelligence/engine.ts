import type { ConflictSeverity, FunctionalTag, IngredientSubflag } from '@onskin/types';

import { STARTER_RULES, type ConflictRule } from './rules';

// The conflict / synergy engine (docs/02 §4). Pure, deterministic, testable ,
// the doc mandates a fixture test per rule for this liability surface (§10).
// Tag-based, both-orders matching; concentration- and sensitivity-modulated
// severity; sub-flag exemptions; safety via a profile-derived `pregnancy`
// pseudo-tag; resolution-first; reassurance for myths.

export type SensitivityLevel = 'sensitive' | 'resistant' | 'neutral';

export type EngineProduct = {
  id: string;
  name: string;
  tags: FunctionalTag[];
  subflags?: IngredientSubflag[];
  /** Coarse concentration band for modulation (docs/02 §4.2). */
  concentration?: 'low' | 'high';
};

export type EngineProfile = {
  sensitivity: SensitivityLevel;
  pregnancy: boolean;
};

export type DetectedConflict = {
  rule: ConflictRule;
  productAId: string | null;
  productBId: string | null;
  productAName: string | null;
  productBName: string | null;
  computedSeverity: ConflictSeverity;
};

const ORDER: ConflictSeverity[] = ['none', 'mild', 'moderate', 'high'];
const rank = (s: ConflictSeverity) => ORDER.indexOf(s);
function bump(s: ConflictSeverity, by: number): ConflictSeverity {
  const i = Math.min(ORDER.length - 1, Math.max(0, rank(s) + by));
  return ORDER[i]!;
}

/** Find a rule for an unordered tag pair (matches either order). */
export function findRule(
  rules: ConflictRule[],
  a: FunctionalTag,
  b: FunctionalTag,
): ConflictRule | undefined {
  return rules.find((r) => (r.tagA === a && r.tagB === b) || (r.tagA === b && r.tagB === a));
}

/** Computed severity after concentration + sensitivity modulation (docs/02 §4.2). */
export function modulateSeverity(
  rule: ConflictRule,
  profile: EngineProfile,
  highConcentration: boolean,
): ConflictSeverity {
  // Safety rules only fire via the pregnancy pseudo-tag; always maximally firm.
  if (rule.interactionType === 'safety') return 'high';

  let sev = rule.baseSeverity;
  if (
    (rule.interactionType === 'irritation' || rule.interactionType === 'stability') &&
    highConcentration
  ) {
    sev = bump(sev, 1);
  }
  if (rule.interactionType === 'irritation') {
    if (profile.sensitivity === 'sensitive') sev = bump(sev, 1);
    else if (profile.sensitivity === 'resistant') sev = bump(sev, -1);
  }
  return sev;
}

function isExempt(rule: ConflictRule, subflags: Set<IngredientSubflag | string>): boolean {
  const exempt = rule.appliesWhen?.subflagExempt;
  if (!exempt) return false;
  return exempt.some((e) => subflags.has(e));
}

/**
 * Shelf-level detection: every unordered pair of the user's active products,
 * plus each product against the `pregnancy` pseudo-product when applicable.
 * Resolution-awareness (already-separated pairs in a routine) is applied by the
 * scheduler layer, not here.
 */
export function detectConflicts(
  products: EngineProduct[],
  profile: EngineProfile,
  rules: ConflictRule[] = STARTER_RULES,
): DetectedConflict[] {
  const items: EngineProduct[] = [...products];
  if (profile.pregnancy) {
    items.push({ id: '__pregnancy__', name: 'Pregnancy', tags: ['pregnancy'] });
  }

  const seen = new Set<string>();
  const out: DetectedConflict[] = [];

  for (let i = 0; i < items.length; i++) {
    for (let j = i + 1; j < items.length; j++) {
      const a = items[i]!;
      const b = items[j]!;
      const subflags = new Set<IngredientSubflag | string>([
        ...(a.subflags ?? []),
        ...(b.subflags ?? []),
      ]);
      const highConc = a.concentration === 'high' || b.concentration === 'high';

      for (const tagA of a.tags) {
        for (const tagB of b.tags) {
          const rule = findRule(rules, tagA, tagB);
          if (!rule) continue;
          const key = `${rule.id}:${a.id}:${b.id}`;
          if (seen.has(key)) continue;
          if (isExempt(rule, subflags)) continue;

          // Co-use allowance: e.g. retinoid × BHA is tolerable on resistant/oily skin.
          if (rule.appliesWhen?.coUseIf === 'resistant' && profile.sensitivity === 'resistant')
            continue;

          // Dose-gated safety: high-dose salicylic × pregnancy only fires on a
          // high-concentration product (docs/02 §4.8. Low-dose BHA is fine).
          if (rule.appliesWhen?.requiresHighDose) {
            const real = a.id === '__pregnancy__' ? b : b.id === '__pregnancy__' ? a : null;
            if (!real || real.concentration !== 'high') continue;
          }

          const computedSeverity = modulateSeverity(rule, profile, highConc);
          seen.add(key);
          out.push({
            rule,
            productAId: a.id === '__pregnancy__' ? null : a.id,
            productBId: b.id === '__pregnancy__' ? null : b.id,
            productAName: a.id === '__pregnancy__' ? null : a.name,
            productBName: b.id === '__pregnancy__' ? null : b.name,
            computedSeverity,
          });
        }
      }
    }
  }

  // Rank: safety first, then severity desc, then by evidence (established first).
  const evidenceOrder = ['established', 'plausible', 'contested', 'refuted'];
  out.sort((x, y) => {
    const safety =
      Number(y.rule.interactionType === 'safety') - Number(x.rule.interactionType === 'safety');
    if (safety) return safety;
    const sev = rank(y.computedSeverity) - rank(x.computedSeverity);
    if (sev) return sev;
    return (
      evidenceOrder.indexOf(x.rule.evidenceLabel) - evidenceOrder.indexOf(y.rule.evidenceLabel)
    );
  });

  return out;
}

/** Positive/neutral interactions to surface as reassurance (docs/02 §4.1/§7.8). */
export function isReassuring(c: DetectedConflict): boolean {
  return c.rule.interactionType === 'myth' || c.rule.interactionType === 'synergy';
}
