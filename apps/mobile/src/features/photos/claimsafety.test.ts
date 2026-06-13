import { describe, expect, it } from 'vitest';

import { COACHING, LIGHTING_LABEL, MILESTONE_COPY, NO_SCORE_COPY, PHOTO_COPY, QUALITY_NOTE } from './copy';

// Claim-safety + calm-copy regression guard for the photo feature (docs/06 §8/§9,
// the Slice-11 pattern). Progress photos are the app's most sensitive surface; the
// stance is "no scores, no AI grades, your own eyes." This guard survives every
// future copy edit. Final marketing/consent wording is owned by counsel
// (B-PRIVACY / B-PRIVACY-COPY) — but no edit may reintroduce a score, grade, drug
// claim, or alarm word.

// Disease/drug-claim verbs (FD&C §201(g)/(i)) — never in any user-facing copy.
const DRUG_CLAIMS = [
  /\btreats?\b/i,
  /\bcures?\b/i,
  /\bheals?\b/i,
  /\bdiagnos\w*/i,
  /\b(stimulate|stimulates|boost|boosts)\s+collagen\b/i,
  /\brepairs?\s+dna\b/i,
  /\bprevents?\s+(acne|breakouts|disease|wrinkles)\b/i,
];

// Non-calm / alarmist words (docs/02 §7.7: no "warning/danger/avoid", no "!").
const ALARM = [/\bdanger\w*/i, /\bharmful\b/i, /\bwarning\b/i, /\bavoid\b/i, /!/];

// Affirmative SCORE/metric claims — the "false precision" docs/06 §8 bans. Targets
// the PATTERN of asserting a number/grade about the skin, NOT the calm REFUSAL of
// it ("no scores", "never scored"), so the everyday copy passes cleanly.
const SCORE_CLAIMS = [
  /\d+\s*%/, // any explicit percentage ("improved 23%", "23% clearer")
  /\bskin\s*age\b/i,
  /\bskin\s*score\b/i,
  /\bskin[-\s]?grade\b/i,
  /\bimproved\s+\d/i,
];

function collect(v: unknown, out: string[] = []): string[] {
  if (typeof v === 'string') out.push(v);
  else if (Array.isArray(v)) v.forEach((x) => collect(x, out));
  else if (v && typeof v === 'object') Object.values(v).forEach((x) => collect(x, out));
  return out;
}

function offenders(text: string, patterns: RegExp[]): string[] {
  return patterns.flatMap((re) => {
    const m = text.match(re);
    return m ? [m[0]] : [];
  });
}

// Everyday instructional/marketing/reassurance copy — must be clean of ALL three.
const EVERYDAY = [
  ...collect(PHOTO_COPY),
  ...collect(COACHING),
  ...collect(LIGHTING_LABEL),
  ...collect(QUALITY_NOTE),
  ...collect(MILESTONE_COPY),
];

describe('photo copy is claim-safe and calm (docs/06 §8/§9)', () => {
  for (const text of EVERYDAY) {
    it(`no drug claim · no alarm · no score in: "${text.slice(0, 48)}…"`, () => {
      expect(offenders(text, DRUG_CLAIMS)).toEqual([]);
      expect(offenders(text, ALARM)).toEqual([]);
      expect(offenders(text, SCORE_CLAIMS)).toEqual([]);
    });
  }
});

describe('the no-AI-score stance (docs/06 §8)', () => {
  // The refusal copy deliberately NAMES score/grade/skin-age to reject them, so it
  // is exempt from SCORE_CLAIMS — but it must still be calm and claim-free.
  for (const text of collect(NO_SCORE_COPY)) {
    it(`refusal copy stays calm + claim-free: "${text.slice(0, 48)}…"`, () => {
      expect(offenders(text, DRUG_CLAIMS)).toEqual([]);
      expect(offenders(text, ALARM)).toEqual([]);
    });
  }

  it('actually states the stance (no score / honest about limits)', () => {
    expect(NO_SCORE_COPY.title.toLowerCase()).toContain('score');
    const all = collect(NO_SCORE_COPY).join(' ').toLowerCase();
    expect(all).toContain('skin age'); // names it to refuse it
    expect(all).toContain('fairness-checked'); // the Phase-2 honesty (docs/06 §8)
  });
});
