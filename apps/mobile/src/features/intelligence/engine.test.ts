import { describe, expect, it } from 'vitest';

import { detectConflicts, isReassuring, type EngineProduct, type EngineProfile } from './engine';
import { tagsForIngredientList } from './tags';

// Fixture tests for the conflict engine. Docs/02 §10: "every rule has a fixture
// test ... non-negotiable for a liability surface." These assert (tagged products
// + profile) -> (interaction type, computed severity, resolution).

function product(
  id: string,
  name: string,
  ingredients: string[],
  concentration?: 'low' | 'high',
): EngineProduct {
  const { tags, subflags } = tagsForIngredientList(ingredients);
  return { id, name, tags: [...tags], subflags: [...subflags], concentration };
}

const sensitive: EngineProfile = { sensitivity: 'sensitive', pregnancy: false };
const resistant: EngineProfile = { sensitivity: 'resistant', pregnancy: false };
const neutral: EngineProfile = { sensitivity: 'neutral', pregnancy: false };
const pregnant: EngineProfile = { sensitivity: 'neutral', pregnancy: true };

describe('the Maya worked example (docs/02 §4.2/§4.4/§7.3)', () => {
  it('dry+sensitive, Retinol 0.3% + Glycolic 7% -> Moderate / contested / alternate_nights', () => {
    const products = [
      product('p1', 'Retinol 0.3%', ['Retinol'], 'low'),
      product('p2', 'Glycolic 7%', ['Glycolic Acid'], 'low'),
    ];
    const conflicts = detectConflicts(products, sensitive);
    expect(conflicts).toHaveLength(1);
    const c = conflicts[0]!;
    expect(c.rule.interactionType).toBe('irritation');
    expect(c.rule.evidenceLabel).toBe('contested');
    expect(c.rule.resolutionType).toBe('alternate_nights');
    expect(c.computedSeverity).toBe('moderate'); // base mild + sensitive (+1)
  });
});

describe('niacinamide × vitamin C. Refuted myth, reassure not warn (§4.4 row 4 / §7.8)', () => {
  it('classifies as myth and is reassuring', () => {
    const products = [
      product('p1', 'Niacinamide 10%', ['Niacinamide']),
      product('p2', 'Vitamin C serum', ['Ascorbic Acid']),
    ];
    const conflicts = detectConflicts(products, neutral);
    const myth = conflicts.find((c) => c.rule.interactionType === 'myth');
    expect(myth).toBeDefined();
    expect(myth!.rule.evidenceLabel).toBe('refuted');
    expect(myth!.rule.evidenceGrade).toBeNull();
    expect(myth!.computedSeverity).toBe('none');
    expect(isReassuring(myth!)).toBe(true);
  });
});

describe('benzoyl peroxide × retinoid stability (§4.4 row 3 / 3b)', () => {
  it('flags simple retinol as moderate stability / separate_am_pm', () => {
    const products = [
      product('p1', 'BP wash', ['Benzoyl Peroxide']),
      product('p2', 'Retinol', ['Retinol']),
    ];
    const c = detectConflicts(products, neutral).find(
      (x) => x.rule.interactionType === 'stability',
    );
    expect(c).toBeDefined();
    expect(c!.computedSeverity).toBe('moderate');
    expect(c!.rule.resolutionType).toBe('separate_am_pm');
  });

  it('EXEMPTS adapalene (combination products exist)', () => {
    const products = [
      product('p1', 'BP wash', ['Benzoyl Peroxide']),
      product('p2', 'Adapalene gel', ['Adapalene']),
    ];
    const stability = detectConflicts(products, neutral).filter(
      (x) => x.rule.interactionType === 'stability',
    );
    expect(stability).toHaveLength(0);
  });
});

describe('safety: retinoid × pregnancy (§4.8)', () => {
  it('fires high / avoid_refer when pregnant', () => {
    const products = [product('p1', 'Retinol', ['Retinol'])];
    const c = detectConflicts(products, pregnant).find((x) => x.rule.interactionType === 'safety');
    expect(c).toBeDefined();
    expect(c!.computedSeverity).toBe('high');
    expect(c!.rule.resolutionType).toBe('avoid_refer');
    expect(c!.rule.evidenceLabel).toBe('contested'); // not "established". Caution, not demonstrated harm
    expect(c!.productBId).toBeNull(); // pregnancy is a pseudo-tag, not a product
  });

  it('does NOT fire when not pregnant', () => {
    const products = [product('p1', 'Retinol', ['Retinol'])];
    const c = detectConflicts(products, neutral).filter((x) => x.rule.interactionType === 'safety');
    expect(c).toHaveLength(0);
  });
});

describe('safety dose-gating: BHA × pregnancy only on high-dose (§4.8)', () => {
  it('does NOT fire on low-dose BHA', () => {
    const products = [product('p1', 'Gentle BHA toner', ['Salicylic Acid'], 'low')];
    const safety = detectConflicts(products, pregnant).filter(
      (x) => x.rule.tagA === 'bha' || x.rule.tagB === 'bha',
    );
    expect(safety.filter((s) => s.rule.interactionType === 'safety')).toHaveLength(0);
  });

  it('fires on high-dose BHA', () => {
    const products = [product('p1', 'Strong BHA peel', ['Salicylic Acid'], 'high')];
    const c = detectConflicts(products, pregnant).find(
      (x) =>
        x.rule.interactionType === 'safety' && (x.rule.tagA === 'bha' || x.rule.tagB === 'bha'),
    );
    expect(c).toBeDefined();
    expect(c!.computedSeverity).toBe('high'); // safety forced high
  });
});

describe('personalization (§4.7)', () => {
  it('resistant skin may co-use retinoid + BHA (no flag)', () => {
    const products = [
      product('p1', 'Retinol', ['Retinol']),
      product('p2', 'BHA', ['Salicylic Acid']),
    ];
    const irritation = detectConflicts(products, resistant).filter(
      (x) => x.rule.interactionType === 'irritation',
    );
    expect(irritation).toHaveLength(0);
  });

  it('high concentration + sensitive escalates retinoid × AHA to high', () => {
    const products = [
      product('p1', 'Retinol 1%', ['Retinol'], 'high'),
      product('p2', 'Glycolic 10%', ['Glycolic Acid'], 'high'),
    ];
    const c = detectConflicts(products, sensitive).find(
      (x) => x.rule.interactionType === 'irritation',
    );
    expect(c!.computedSeverity).toBe('high'); // mild +1 (conc) +1 (sensitive)
  });
});

describe('synergy (§4.1 #9/#11)', () => {
  it('vitamin C + sunscreen is surfaced positively', () => {
    const products = [
      product('p1', 'Vitamin C', ['Ascorbic Acid']),
      product('p2', 'Mineral SPF', ['Zinc Oxide']),
    ];
    const syn = detectConflicts(products, neutral).find(
      (x) => x.rule.interactionType === 'synergy',
    );
    expect(syn).toBeDefined();
    expect(isReassuring(syn!)).toBe(true);
    expect(syn!.rule.resolutionType).toBe('no_change');
  });
});

describe('ranking (§4.6). Safety first', () => {
  it('orders safety above irritation', () => {
    const products = [
      product('p1', 'Retinol', ['Retinol']),
      product('p2', 'Glycolic', ['Glycolic Acid']),
    ];
    const conflicts = detectConflicts(products, pregnant);
    expect(conflicts[0]!.rule.interactionType).toBe('safety');
  });
});
