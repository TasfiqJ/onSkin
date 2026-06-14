import type { FunctionalTag, GoalId, SequencingRole } from '@onskin/types';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { detectConflicts, type EngineProduct } from '@/features/intelligence/engine';
import { STARTER_RULES } from '@/features/intelligence/rules';

import { RECS_REVIEWED, shippableRecTypes } from './catalog';
import { recommend, type RecInput, type RecProfile, type RecShelfItem } from './engine';
import { DEFAULT_PREFERENCES } from './preferences';

// Engine fixtures (docs/09 §4/§5). The six triggers + the honest "you're set",
// restrained and type-first. The engine recommends only on a genuine, profile-
// grounded need, prioritised safety/gap > replacement > conflict > better-fit > goal.

// In dev the full catalog (incl. launch-gated goal actives) is available. Mirror
// that here so the behavioural fixtures exercise the goal trigger. A dedicated test
// below asserts the production gate withholds them (B-DERM-REVIEW).
beforeAll(() => {
  (globalThis as { __DEV__?: boolean }).__DEV__ = true;
});
afterAll(() => {
  delete (globalThis as { __DEV__?: boolean }).__DEV__;
});

function item(over: Partial<RecShelfItem> & { id: string; role: SequencingRole }): RecShelfItem {
  return {
    name: over.name ?? over.id,
    tags: [],
    fragranced: false,
    expiring: false,
    finished: false,
    ...over,
  };
}

function input(over: Partial<RecInput> & { profile: RecProfile; shelf: RecShelfItem[] }): RecInput {
  return {
    conflicts: [],
    preferences: DEFAULT_PREFERENCES,
    rules: STARTER_RULES,
    ...over,
  };
}

const cleanser = item({ id: 'p_clean', name: 'Gentle cleanser', role: 'cleanser' });
const moisturiser = item({ id: 'p_moist', name: 'Ceramide cream', role: 'moisturiser', tags: ['ceramide'] });
const spf = item({ id: 'p_spf', name: 'Daily SPF 30', role: 'spf', tags: ['sunscreen'] });
const niacinamide = item({ id: 'p_niac', name: 'Niacinamide 5%', role: 'hydrating_serum', tags: ['niacinamide'] });

describe('gap-filling. A missing SPF is the highest-priority recommendation (§4.1)', () => {
  const res = recommend(
    input({ profile: { sensitivity: 'sensitive', pregnancy: false, goals: ['anti_aging'] }, shelf: [cleanser, moisturiser, niacinamide] }),
  );

  it('puts the SPF gap first, type-first, with a strong fit and an evidence dot', () => {
    const top = res.recommendations[0]!;
    expect(top.trigger).toBe('gap');
    expect(top.productType).toBe('mineral_spf'); // sensitive → mineral preferred
    expect(top.what).toBe('A mineral SPF 30+');
    expect(top.fitLabel).toBe('Strong fit');
    expect(top.footIsEvidence).toBe(true);
    expect(res.youreSet).toBe(false);
  });

  it('carries the what / why / how triad on every suggestion (§6. Explainability is mandatory)', () => {
    const top = res.recommendations[0]!;
    expect(top.why.toLowerCase()).toContain('spf');
    expect(top.how.profile.length).toBeGreaterThan(0);
    expect(top.how.gap.toLowerCase()).toContain('no spf');
    expect(top.how.evidence.length).toBeGreaterThan(0);
    expect(top.how.caveat).toBeTruthy(); // mineral SPF white-cast caveat (honest flaw)
  });

  it('is restrained. It does not re-recommend what is already owned, nor pad the list', () => {
    const types = res.recommendations.map((r) => r.productType);
    expect(types).not.toContain('niacinamide_serum'); // already owned
    expect(res.recommendations.length).toBeLessThanOrEqual(2); // gap + one goal active, no padding
  });
});

describe('goal-driven. Pregnancy swaps the active for a safe alternative (§8 hard exclusion)', () => {
  it('recommends vitamin C, never a retinoid, for an anti-aging goal in pregnancy', () => {
    const res = recommend(
      input({ profile: { sensitivity: 'neutral', pregnancy: true, goals: ['anti_aging'] }, shelf: [cleanser, moisturiser, spf] }),
    );
    const goalRec = res.recommendations.find((r) => r.trigger === 'goal');
    expect(goalRec?.productType).toBe('vitamin_c_serum');
    expect(res.recommendations.some((r) => r.productType === 'retinoid_serum')).toBe(false);
  });

  it('introduces only ONE goal active at a time (restraint, §4.5)', () => {
    const res = recommend(
      input({
        profile: { sensitivity: 'neutral', pregnancy: false, goals: ['anti_aging', 'clear_skin'] },
        shelf: [cleanser, moisturiser, spf],
      }),
    );
    expect(res.recommendations.filter((r) => r.trigger === 'goal').length).toBe(1);
  });
});

describe('the honest "you\'re set" seventh state (§4)', () => {
  it('recommends nothing when the routine is complete, conflict-free and goal-appropriate', () => {
    const res = recommend(
      input({ profile: { sensitivity: 'neutral', pregnancy: false, goals: [] }, shelf: [cleanser, moisturiser, spf] }),
    );
    expect(res.recommendations).toHaveLength(0);
    expect(res.youreSet).toBe(true);
  });
});

describe('conflict resolution. A non-conflicting alternative (§4.3)', () => {
  it('surfaces a de-conflicting option for an unresolved shelf clash', () => {
    const profile = { sensitivity: 'sensitive' as const, pregnancy: false, goals: [] as GoalId[] };
    const engineProducts: EngineProduct[] = [
      { id: 'p_ret', name: 'Retinol 0.5%', tags: ['retinoid'] as FunctionalTag[] },
      { id: 'p_aha', name: 'Glycolic 7%', tags: ['aha'] as FunctionalTag[] },
    ];
    const conflicts = detectConflicts(engineProducts, { sensitivity: 'sensitive', pregnancy: false }, STARTER_RULES);
    const res = recommend(
      input({
        profile,
        shelf: [
          cleanser,
          moisturiser,
          spf,
          item({ id: 'p_ret', name: 'Retinol 0.5%', role: 'treatment', tags: ['retinoid'] }),
          item({ id: 'p_aha', name: 'Glycolic 7%', role: 'exfoliant', tags: ['aha'] }),
        ],
        conflicts,
      }),
    );
    const conflictRec = res.recommendations.find((r) => r.trigger === 'conflict');
    expect(conflictRec).toBeTruthy();
    expect(conflictRec?.relatedRuleId).toBeTruthy();
    expect(conflictRec?.why).toMatch(/Retinol 0\.5%|Glycolic 7%/);
  });
});

describe('better-fit. A gentler alternative to a fragranced product (§4.4)', () => {
  it('offers a fragrance-free swap for sensitive skin, as an option (relatedProductId set)', () => {
    const fragranced = item({ id: 'p_fc', name: 'Rose cleanser', role: 'cleanser', fragranced: true });
    const res = recommend(
      input({
        profile: { sensitivity: 'sensitive', pregnancy: false, goals: [] },
        shelf: [fragranced, moisturiser, spf],
      }),
    );
    const bf = res.recommendations.find((r) => r.trigger === 'better_fit');
    expect(bf?.productType).toBe('fragrance_free_cleanser');
    expect(bf?.relatedProductId).toBe('p_fc');
    expect(bf?.footLabel).toBe('Better fit');
  });
});

describe('routine completion. A beginner gets a minimal starter routine (§4.6)', () => {
  it('recommends the three essentials, not a 10-step regimen', () => {
    const res = recommend(input({ profile: { sensitivity: 'neutral', pregnancy: false, goals: [] }, shelf: [] }));
    const roles = res.recommendations.map((r) => r.productType);
    expect(res.recommendations.every((r) => r.trigger === 'routine_completion')).toBe(true);
    expect(roles).toContain('mineral_spf');
    expect(roles.some((t) => t.includes('cleanser'))).toBe(true);
    expect(roles).toContain('ceramide_moisturiser');
    expect(res.recommendations.length).toBeLessThanOrEqual(3); // minimal
  });
});

describe('replacement. Only when genuinely depleted (§4.2)', () => {
  it('surfaces an expiring product, anchored to the shelf item', () => {
    const expiring = item({ id: 'p_vc', name: 'Vitamin C serum', role: 'antioxidant', tags: ['vitamin_c'], expiring: true });
    const res = recommend(
      input({ profile: { sensitivity: 'neutral', pregnancy: false, goals: [] }, shelf: [cleanser, moisturiser, spf, expiring] }),
    );
    const rep = res.recommendations.find((r) => r.trigger === 'replacement');
    expect(rep?.relatedProductId).toBe('p_vc');
    expect(rep?.what.toLowerCase()).toContain('running low');
    expect(rep?.footIsEvidence).toBe(false); // "From your shelf", not an evidence grade
  });
});

describe('dismissed suggestions never re-surface ("not for me")', () => {
  it('filters a dismissed recommendation by stable id', () => {
    const base = input({ profile: { sensitivity: 'sensitive', pregnancy: false, goals: ['anti_aging'] }, shelf: [cleanser, moisturiser, niacinamide] });
    const before = recommend(base);
    const dismissedId = before.recommendations[0]!.id;
    const after = recommend({ ...base, dismissed: new Set([dismissedId]) });
    expect(after.recommendations.some((r) => r.id === dismissedId)).toBe(false);
  });
});

describe('the launch gate withholds medically-adjacent goal actives in production (B-DERM-REVIEW)', () => {
  it('RECS_REVIEWED is false (parity with the conflict-matrix + PAO gates)', () => {
    expect(RECS_REVIEWED).toBe(false);
  });

  it('in production only structural routine-completeness types ship; goal actives are withheld', () => {
    const prev = (globalThis as { __DEV__?: boolean }).__DEV__;
    (globalThis as { __DEV__?: boolean }).__DEV__ = false;
    try {
      const shippable = shippableRecTypes();
      expect(shippable.every((t) => !t.medicalAdjacent)).toBe(true);
      expect(shippable.some((t) => t.role === 'spf')).toBe(true); // structural SPF still ships
      expect(shippable.some((t) => t.type === 'retinoid_serum')).toBe(false);
    } finally {
      (globalThis as { __DEV__?: boolean }).__DEV__ = prev;
    }
  });
});

describe('church and state. No commercial field exists in the ranking output (D-054)', () => {
  it('a recommendation carries only merit + explainability fields, never commerce', () => {
    const res = recommend(input({ profile: { sensitivity: 'sensitive', pregnancy: false, goals: ['anti_aging'] }, shelf: [cleanser, moisturiser, niacinamide] }));
    const rec = res.recommendations[0]!;
    const keys = Object.keys(rec).join(' ').toLowerCase();
    for (const banned of ['commission', 'affiliate', 'partnership', 'brand_deal', 'sponsor', 'payout', 'revenue']) {
      expect(keys).not.toContain(banned);
    }
  });
});
