import type { FunctionalTag } from '@onskin/types';
import { describe, expect, it } from 'vitest';

import { recTypeByKey, REC_TYPES, type RecType } from './catalog';
import { fitLabel, fitScore, type FitContext } from './fit';
import { DEFAULT_PREFERENCES } from './preferences';

// FIT-score fixtures (docs/09 §5/§6). The merit-only score: hard exclusions
// (pregnancy / would-add-a-conflict / refuted) first, then a weighted, explainable
// score over SIX inputs. And *** no commercial input *** (church and state, D-054).

function ctx(over: Partial<FitContext> = {}): FitContext {
  return {
    sensitivity: 'neutral',
    pregnancy: false,
    preferences: DEFAULT_PREFERENCES,
    ownedTags: new Set<FunctionalTag>(),
    conflictTags: new Set<FunctionalTag>(),
    trigger: 'gap',
    ...over,
  };
}

const mineralSpf = recTypeByKey('mineral_spf')!;
const retinoid = recTypeByKey('retinoid_serum')!;
const vitaminC = recTypeByKey('vitamin_c_serum')!;

describe('hard exclusions run first. Nothing unsafe is merely down-ranked', () => {
  it('pregnancy hard-excludes a pregnancy-unsafe active (retinoid)', () => {
    const r = fitScore(retinoid, ctx({ pregnancy: true }));
    expect(r.score).toBeNull();
    expect(r.excludedReason).toBe('pregnancy');
  });

  it('a pregnancy-safe active survives in pregnancy', () => {
    const r = fitScore(vitaminC, ctx({ pregnancy: true }));
    expect(r.score).not.toBeNull();
    expect(r.excludedReason).toBeNull();
  });

  it('a type whose tag would ADD a conflict is excluded (never recommend a new clash)', () => {
    const r = fitScore(vitaminC, ctx({ conflictTags: new Set<FunctionalTag>(['vitamin_c']) }));
    expect(r.score).toBeNull();
    expect(r.excludedReason).toBe('conflict');
  });

  it('a refuted-evidence type is never recommended', () => {
    const refuted: RecType = { ...mineralSpf, type: 'fake_refuted', evidenceLabel: 'refuted' };
    expect(fitScore(refuted, ctx()).score).toBeNull();
  });
});

describe('the soft score is weighted, explainable, and merit-only', () => {
  it('exposes exactly the SIX merit inputs. No seventh (commercial) input', () => {
    const r = fitScore(mineralSpf, ctx());
    expect(Object.keys(r.breakdown).sort()).toEqual(
      [
        'catalogQuality',
        'evidence',
        'needPriority',
        'preferenceMatch',
        'profileMatch',
        'simplicity',
      ].sort(),
    );
  });

  it('higher evidence scores higher, all else equal', () => {
    const established: RecType = { ...vitaminC, evidenceLabel: 'established' };
    const contested: RecType = { ...vitaminC, evidenceLabel: 'contested' };
    const hi = fitScore(established, ctx()).score ?? 0;
    const lo = fitScore(contested, ctx()).score ?? 0;
    expect(hi).toBeGreaterThan(lo);
  });

  it('the gap trigger out-prioritises the goal trigger for the same type', () => {
    const asGap = fitScore(vitaminC, ctx({ trigger: 'gap' })).score ?? 0;
    const asGoal = fitScore(vitaminC, ctx({ trigger: 'goal' })).score ?? 0;
    expect(asGap).toBeGreaterThan(asGoal);
  });

  it('penalises a non-sensitive-safe active on sensitive skin (without excluding it)', () => {
    const onSensitive = fitScore(retinoid, ctx({ sensitivity: 'sensitive' }));
    const onResistant = fitScore(retinoid, ctx({ sensitivity: 'resistant' }));
    expect(onSensitive.breakdown.profileMatch).toBe(0.5);
    expect(onResistant.breakdown.profileMatch).toBe(1.0);
    expect(onSensitive.score).not.toBeNull(); // offered, just lower
  });

  it('rewards a fragrance-free type when the user set a fragrance-free preference', () => {
    const withPref = fitScore(
      mineralSpf,
      ctx({ preferences: { values: ['fragrance_free'], budget: null, formats: [] } }),
    );
    const without = fitScore(mineralSpf, ctx());
    expect(withPref.breakdown.preferenceMatch).toBeGreaterThanOrEqual(
      without.breakdown.preferenceMatch,
    );
  });
});

describe('fitLabel is a calm, claim-safe text descriptor (never colour alone, §11)', () => {
  it('maps score bands to labels', () => {
    expect(fitLabel(0.9)).toBe('Strong fit');
    expect(fitLabel(0.65)).toBe('Good fit');
    expect(fitLabel(0.4)).toBe('Worth considering');
    expect(fitLabel(null)).toBe('Not a fit');
  });

  it('every shippable structural type scores a real number for a genuine gap', () => {
    for (const t of REC_TYPES.filter((x) => !x.medicalAdjacent)) {
      expect(fitScore(t, ctx({ trigger: 'gap' })).score).not.toBeNull();
    }
  });
});
