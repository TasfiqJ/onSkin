import { GOALS, type FunctionalTag, type GoalId } from '@onskin/types';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { detectConflicts, type EngineProduct } from '@/features/intelligence/engine';
import { STARTER_RULES } from '@/features/intelligence/rules';

import { REC_TYPES } from './catalog';
import {
  BUDGET_LABEL,
  FORMAT_LABEL,
  GROUP_LABEL,
  REC_COPY,
  VALUES_LABEL,
  goalConcern,
  goalShort,
  whyCopy,
} from './copy';
import { recommend, type RecInput, type RecShelfItem } from './engine';
import { DEFAULT_PREFERENCES } from './preferences';

// Claim-safety guard for the recommendation copy (docs/09 §10, the Slice-11/20/21/22
// pattern). Recommendations are health-adjacent and must stay claim-safe: recommend
// for CONCERNS not CONDITIONS (no drug/disease verbs, no diagnosis), no alarm words,
// and. Because it must never feel like a storefront. NO manufactured urgency /
// scarcity / guilt. It scans the centralised copy AND the strings the engine
// actually produces over fixtures, so a non-compliant template can't slip through a
// builder. Apostrophe class is ['’] so the curly U+2019 the copy uses is caught.

const CONDITION_OR_DRUG = [
  /\btreats?\b/i,
  /\bcures?\b/i,
  /\bheals?\b/i,
  /\bdiagnos\w*/i,
  /\bprevents?\b/i,
  /\bclinically\s+proven\b/i,
  /\bstimulates?\s+collagen\b/i,
  /\brepairs?\s+dna\b/i,
  /\b(eczema|rosacea|psoriasis|dermatitis|melasma|acne)\b/i,
];
const ALARM = [/\bdanger\w*/i, /\bharmful\b/i, /\bwarning\b/i, /!/];
const URGENCY = [
  /\bdon['’]?t\s+miss\b/i,
  /\bhurry\b/i,
  /\blast\s+chance\b/i,
  /\bact\s+now\b/i,
  /\bonly\s+\d+\s+left\b/i,
  /\bselling\s+fast\b/i,
  /\blimited\s+time\b/i,
];
const GUILT = [/\byou['’]?ll\s+lose\b/i, /\bdon['’]?t\s+lose\b/i, /\byou\s+failed\b/i, /\bbuy\s+now\b/i];

function collect(v: unknown, out: string[] = []): string[] {
  if (typeof v === 'string') out.push(v);
  else if (typeof v === 'function') {
    try {
      out.push(String((v as (...a: unknown[]) => unknown)('your product')));
    } catch {
      /* fns needing a different arg shape are exercised explicitly below */
    }
  } else if (Array.isArray(v)) v.forEach((x) => collect(x, out));
  else if (v && typeof v === 'object') Object.values(v).forEach((x) => collect(x, out));
  return out;
}
function offenders(text: string, pats: RegExp[]): string[] {
  return pats.flatMap((re) => {
    const m = text.match(re);
    return m ? [m[0]] : [];
  });
}

const goalIds = GOALS.map((g) => g.id) as GoalId[];

// Explicitly exercise every builder with realistic args (claim-safe product/goal data).
const builderStrings: string[] = [
  ...goalIds.map(goalConcern),
  ...goalIds.map(goalShort),
  ...goalIds.map(whyCopy.gapSpf),
  whyCopy.gapSpf(null),
  whyCopy.gapMoisturiser,
  whyCopy.gapCleanser,
  whyCopy.routineCompletion,
  whyCopy.replacement('your vitamin C'),
  whyCopy.betterFit('your cleanser'),
  whyCopy.conflict('your retinol', 'your glycolic'),
  ...goalIds.map(whyCopy.goal),
  REC_COPY.todayCard.bodyMany(2),
];

// The strings the engine actually emits over representative fixtures.
function shelfItem(over: Partial<RecShelfItem> & { id: string; role: RecShelfItem['role'] }): RecShelfItem {
  return { name: over.id, tags: [], fragranced: false, expiring: false, ...over };
}
function engineStrings(): string[] {
  (globalThis as { __DEV__?: boolean }).__DEV__ = true;
  // A real conflict surfaces rule.resolutionCopy as the recommendation's how.evidence
  //. So exercise the conflict trigger end-to-end, on top of the gap/goal/replacement
  // and better-fit triggers, so EVERY engine-emitted string is scanned.
  const conflictShelf: EngineProduct[] = [
    { id: 'Retinol', name: 'Retinol 0.5%', tags: ['retinoid'] as FunctionalTag[] },
    { id: 'Glycolic', name: 'Glycolic 7%', tags: ['aha'] as FunctionalTag[] },
  ];
  const conflicts = detectConflicts(conflictShelf, { sensitivity: 'sensitive', pregnancy: false }, STARTER_RULES);
  const fixtures: RecInput[] = [
    {
      profile: { sensitivity: 'sensitive', pregnancy: false, goals: ['anti_aging', 'even_tone'] },
      shelf: [shelfItem({ id: 'Niacinamide', role: 'hydrating_serum', tags: ['niacinamide'] })],
      conflicts: [],
      preferences: { values: ['fragrance_free'], budget: 'mid', formats: [] },
      rules: STARTER_RULES,
    },
    {
      profile: { sensitivity: 'neutral', pregnancy: true, goals: ['clear_skin'] },
      shelf: [
        shelfItem({ id: 'Cleanser', role: 'cleanser' }),
        shelfItem({ id: 'Cream', role: 'moisturiser', tags: ['ceramide'] }),
        shelfItem({ id: 'SPF', role: 'spf', tags: ['sunscreen'], expiring: true }),
      ],
      conflicts: [],
      preferences: DEFAULT_PREFERENCES,
      rules: STARTER_RULES,
    },
    // better-fit (fragranced cleanser on sensitive skin) + a real conflict-resolution.
    {
      profile: { sensitivity: 'sensitive', pregnancy: false, goals: [] },
      shelf: [
        shelfItem({ id: 'Rose cleanser', role: 'cleanser', fragranced: true }),
        shelfItem({ id: 'Cream', role: 'moisturiser', tags: ['ceramide'] }),
        shelfItem({ id: 'SPF', role: 'spf', tags: ['sunscreen'] }),
        shelfItem({ id: 'Retinol 0.5%', role: 'treatment', tags: ['retinoid'] }),
        shelfItem({ id: 'Glycolic 7%', role: 'exfoliant', tags: ['aha'] }),
      ],
      conflicts,
      preferences: DEFAULT_PREFERENCES,
      rules: STARTER_RULES,
    },
  ];
  const out: string[] = [];
  for (const f of fixtures) {
    for (const r of recommend(f).recommendations) {
      out.push(r.what, r.why, r.group, r.footLabel, r.fitLabel, r.how.profile, r.how.gap, r.how.evidence, r.how.fit);
      if (r.caveat) out.push(r.caveat);
    }
  }
  return out;
}

beforeAll(() => {
  (globalThis as { __DEV__?: boolean }).__DEV__ = true;
});
afterAll(() => {
  delete (globalThis as { __DEV__?: boolean }).__DEV__;
});

const ALL = [
  ...collect(REC_COPY),
  ...Object.values(GROUP_LABEL),
  ...Object.values(VALUES_LABEL),
  ...Object.values(BUDGET_LABEL),
  ...Object.values(FORMAT_LABEL),
  ...REC_TYPES.flatMap((t) => [t.what, t.evidenceNote, t.caveat ?? '', t.example ?? '']),
  // Any conflict rule's resolutionCopy can surface as a recommendation's how.evidence
  // (engine.ts conflict trigger). Hold it to the recommendation claim-safety bar too.
  ...STARTER_RULES.map((r) => r.resolutionCopy),
  ...builderStrings,
  ...engineStrings(),
];

describe('recommendation copy is claim-safe (docs/09 §10). Concerns not conditions', () => {
  for (const text of ALL) {
    if (!text) continue;
    it(`no condition/drug · alarm · urgency · guilt in: "${text.slice(0, 44)}…"`, () => {
      expect(offenders(text, CONDITION_OR_DRUG)).toEqual([]);
      expect(offenders(text, ALARM)).toEqual([]);
      expect(offenders(text, URGENCY)).toEqual([]);
      expect(offenders(text, GUILT)).toEqual([]);
    });
  }
});

describe('the honest disclosures + the "you\'re set" stance are present (§3/§4)', () => {
  it('the affiliate disclosure states independence ("never affects what we recommend")', () => {
    expect(REC_COPY.card.disclosure.toLowerCase()).toContain('never affects what we recommend');
  });
  it('the engine can recommend NOTHING. The "you\'re set" copy exists and makes no sell', () => {
    expect(REC_COPY.youreSet.title.length).toBeGreaterThan(0);
    expect(offenders(REC_COPY.youreSet.body, [...URGENCY, ...GUILT])).toEqual([]);
    expect(offenders(REC_COPY.youreSet.bodyNoGoals, [...URGENCY, ...GUILT])).toEqual([]);
  });
  it('the production "you\'re set" copy does not claim goal coverage (goal recs are gated)', () => {
    // When goal actives are launch-gated (B-DERM-REVIEW), the engine cannot serve
    // goal recs, so the shown copy must not assert "matched to your goals".
    expect(REC_COPY.youreSet.bodyNoGoals.toLowerCase()).not.toContain('goal');
    expect(REC_COPY.youreSet.body.toLowerCase()).toContain('goal'); // the dev/reviewed variant may
  });
  it('the hub subtitle states the cardinal rule (ranked by fit/evidence, never commission)', () => {
    expect(REC_COPY.hub.subtitle.toLowerCase()).toContain('never by commission');
  });
});

describe('the guard catches reintroduced violations', () => {
  it('rejects a condition claim and a storefront sell', () => {
    expect(offenders('Treats acne fast', CONDITION_OR_DRUG).length).toBeGreaterThan(0);
    expect(offenders('Buy now. Only 2 left!', [...GUILT, ...URGENCY, ...ALARM]).length).toBeGreaterThan(0);
  });
});
