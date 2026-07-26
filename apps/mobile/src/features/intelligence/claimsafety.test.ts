import { describe, expect, it } from 'vitest';

import {
  CONFLICT_RULE_CORPUS,
  CONFLICT_RULE_REVIEW_RECEIPTS,
  STARTER_RULES,
  isReviewedRule,
  shippableRules,
} from './rules';

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
      for (const text of Object.values(r.copy)) {
        if (text !== null) expect(offenders(text, DRUG_CLAIMS)).toEqual([]);
      }
    });
  }
});

describe('calm copy: no alarmist words (§7.7)', () => {
  for (const r of STARTER_RULES) {
    it(`${r.tagA} × ${r.tagB}. Mechanism + resolution are calm`, () => {
      for (const text of Object.values(r.copy)) {
        if (text !== null) expect(offenders(text, ALARM)).toEqual([]);
      }
    });
  }
});

describe('copy does not claim scheduling or safety action before the app has done it', () => {
  for (const r of STARTER_RULES) {
    it(`${r.tagA} × ${r.tagB}. Resolution avoids premature placement claims`, () => {
      expect(offenders(r.copy.resolution, PLACEMENT_OVERCLAIMS)).toEqual([]);
    });
  }
});

describe('rule-set invariants', () => {
  it('every rule is unreviewed until B-DERM-REVIEW (reviewed_by = null)', () => {
    expect(STARTER_RULES.every((r) => r.reviewedBy === null)).toBe(true);
    expect(STARTER_RULES.every((r) => r.admission === undefined)).toBe(true);
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

  it('derives all presentation copy from the canonical rule bytes', () => {
    for (const rule of STARTER_RULES) {
      expect(rule.copy.mechanism).toBe(rule.mechanism);
      expect(rule.copy.resolution).toBe(rule.resolutionCopy);
      expect(rule.sourceIds.length).toBeGreaterThan(0);
    }
  });
});

describe('exact-corpus professional review gate', () => {
  it('withholds the draft corpus in production', () => {
    withDevFlag(false, () => {
      expect(shippableRules()).toEqual([]);
    });
  });

  it('has no fabricated checked-in review evidence', () => {
    expect(CONFLICT_RULE_CORPUS.status).toBe('draft_blocked');
    expect(CONFLICT_RULE_REVIEW_RECEIPTS).toEqual([]);
  });

  it('does not treat an arbitrary legacy reviewedBy marker as professional admission', () => {
    const marked = { ...STARTER_RULES[0]!, reviewedBy: 'B-DERM-REVIEW' };
    expect(isReviewedRule(marked)).toBe(false);
    expect(shippableRules([marked])).toEqual([]);
  });

  it('keeps release selection closed in development too', () => {
    withDevFlag(true, () => {
      expect(shippableRules()).toEqual([]);
    });
  });
});
