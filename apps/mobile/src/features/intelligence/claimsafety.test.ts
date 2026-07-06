import { describe, expect, it } from 'vitest';

import { STARTER_RULES, shippableRules } from './rules';

// Claim-safety + calm-copy regression guard (docs/02 §7.7, §9). In-app rule copy
// is a "claims surface" under the FD&C Act / FTC. It must stay COSMETIC and CALM.
// This guard survives every future rule edit; B-DERM-REVIEW/B-PRIVACY-COPY still
// own final wording, but no edit may reintroduce a drug claim or alarm word.

// Disease/drug-claim verbs (FD&C §201(g)/(i)). Never allowed in any rule copy.
const DRUG_CLAIMS = [
  /\btreats?\b/i,
  /\bcures?\b/i,
  /\bheals?\b/i,
  /\bdiagnos\w*/i,
  /\b(stimulate|stimulates|boost|boosts)\s+collagen\b/i,
  /\brepairs?\s+dna\b/i,
  /\bprevents?\s+(acne|breakouts|disease|wrinkles)\b/i,
];

// Non-calm / alarmist words. Banned in cosmetic-compatibility copy (§7.7:
// "no exclamation, no 'warning/danger/avoid'"). Safety copy defers calmly too.
const ALARM = [/\bdanger\w*/i, /\bharmful\b/i, /\bwarning\b/i, /\bavoid\b/i, /!/];

const PLACEMENT_OVERCLAIMS = [/\bwe('ve| have)?\s+(set|placed)\b/i, /\balready reflected\b/i];

function offenders(text: string, patterns: RegExp[]): string[] {
  return patterns.flatMap((re) => {
    const m = text.match(re);
    return m ? [m[0]] : [];
  });
}

function withDevFlag<T>(value: boolean, run: () => T): T {
  const runtime = globalThis as { __DEV__?: boolean };
  const previous = runtime.__DEV__;
  runtime.__DEV__ = value;
  try {
    return run();
  } finally {
    if (previous === undefined) delete runtime.__DEV__;
    else runtime.__DEV__ = previous;
  }
}

describe('claim-safety: no drug/disease verbs in rule copy (§9)', () => {
  for (const r of STARTER_RULES) {
    it(`${r.tagA} × ${r.tagB} (${r.interactionType}). Mechanism + resolution are cosmetic`, () => {
      expect(offenders(r.mechanism, DRUG_CLAIMS)).toEqual([]);
      expect(offenders(r.resolutionCopy, DRUG_CLAIMS)).toEqual([]);
    });
  }
});

describe('calm copy: no alarmist words (§7.7)', () => {
  for (const r of STARTER_RULES) {
    it(`${r.tagA} × ${r.tagB}. Mechanism + resolution are calm`, () => {
      expect(offenders(r.mechanism, ALARM)).toEqual([]);
      expect(offenders(r.resolutionCopy, ALARM)).toEqual([]);
    });
  }
});

describe('copy does not claim scheduling or safety action before the app has done it', () => {
  for (const r of STARTER_RULES) {
    it(`${r.tagA} × ${r.tagB}. Resolution avoids premature placement claims`, () => {
      expect(offenders(r.resolutionCopy, PLACEMENT_OVERCLAIMS)).toEqual([]);
    });
  }
});

describe('rule-set invariants', () => {
  it('every rule is unreviewed until B-DERM-REVIEW (reviewed_by = null)', () => {
    expect(STARTER_RULES.every((r) => r.reviewedBy === null)).toBe(true);
  });

  it('rule ids are unique', () => {
    const ids = STARTER_RULES.map((r) => r.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it('every safety rule defers to a clinician (avoid_refer) and is pregnancy-gated', () => {
    for (const r of STARTER_RULES.filter((x) => x.interactionType === 'safety')) {
      expect(r.resolutionType).toBe('avoid_refer');
      expect(r.appliesWhen?.pregnancy).toBe(true);
    }
  });

  it('no safety rule overstates evidence as "established" (§4.8. Caution, not proven harm)', () => {
    for (const r of STARTER_RULES.filter((x) => x.interactionType === 'safety')) {
      expect(r.evidenceLabel).not.toBe('established');
    }
  });
});

describe('B-DERM-REVIEW production rule gate', () => {
  it('withholds all starter rules in production until a reviewer is recorded', () => {
    withDevFlag(false, () => {
      expect(shippableRules()).toEqual([]);
    });
  });

  it('ships only reviewed rules in production', () => {
    const reviewed = { ...STARTER_RULES[0]!, reviewedBy: 'B-DERM-REVIEW' };
    const unreviewed = STARTER_RULES[1]!;

    withDevFlag(false, () => {
      expect(shippableRules([reviewed, unreviewed])).toEqual([reviewed]);
    });
  });

  it('keeps the full starter set available for development fixtures', () => {
    withDevFlag(true, () => {
      expect(shippableRules()).toHaveLength(STARTER_RULES.length);
    });
  });
});
