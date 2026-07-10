import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import type { TrendChangeState } from '@onskin/types';
import { describe, expect, it } from 'vitest';

import { TREND_COPY, trendNarrative } from './copy';

const FEATURE_DIR = fileURLToPath(new URL('./', import.meta.url));

function readFeatureSource(path: string): string {
  return readFileSync(`${FEATURE_DIR}/${path}`, 'utf8');
}

// Claim-safety guard EXTENDED to trend strings (docs/12 §6/§9, D-070). The copy is the
// regulated surface. Forbidden: any number-as-score/grade/%/skin-age/skin-health/star/
// letter rating; disease detection ("we detected acne/rosacea/melasma"); superiority
// ("dermatologist-grade"/"objective"/"more accurate than your eyes"); "improved/worse"
// as a verdict; structure/function claims; and "AI" in user-facing marketing. The OUTPUT
// narratives pass the FULL guard; disclosure/refusal copy that QUOTES banned terms to
// NEGATE them (e.g. "no score, no skin age", "nothing trains any AI", "never a number or
// grade") is exempt from the term-scan only (the Slice-20 NO_SCORE_COPY pattern).

const SCORE_NUMBER = [
  /\b\d+\s?%/,
  /\b\d+\s?\/\s?\d+\b/, // 85/100
  /\bskin\s*score\b/i,
  /\bscore\b/i,
  /\bskin\s*age\b/i,
  /\bskin\s*health\b/i,
  /\bgrade[ds]?\b/i,
  /\b\d+\s*stars?\b/i,
  /\b\d+\s+out\s+of\b/i,
];
const DISEASE = [
  /\bdetect(s|ed|ing)?\b/i,
  /\b(acne|rosacea|psoriasis|dermatitis|melasma|hyperpigmentation)\b/i,
];
const SUPERIORITY = [
  /\bdermatologist-grade\b/i,
  /\bmore\s+accurate\s+than\b/i,
  /\bobjective\b/i,
  /\bclinically\s+proven\b/i,
];
const VERDICT = [/\bimproved\b/i, /\bworse\b/i];
const STRUCTURE = [/\breduces?\s+inflammation\b/i, /\bheals?\b/i];
const AI_MARKETING = [/\bai\b/i];
const ALARM = [/\bdanger\w*/i, /!/];

// Disclosure/refusal strings that legitimately quote banned terms to NEGATE them.
const TERM_EXEMPT = new Set<string>([
  TREND_COPY.optIn.body, // "…never a number or grade."
  TREND_COPY.optIn.bullets[1]!, // "…Nothing trains any AI."
  TREND_COPY.optIn.bullets[2]!, // "No score, no 'skin age,' no grade…"
  TREND_COPY.consentLedgerBody, // "…no score or grade…"
]);

function collect(v: unknown, out: string[] = []): string[] {
  if (typeof v === 'string') out.push(v);
  else if (Array.isArray(v)) v.forEach((x) => collect(x, out));
  else if (v && typeof v === 'object') Object.values(v).forEach((x) => collect(x, out));
  return out;
}
function offenders(text: string, pats: RegExp[]): string[] {
  return pats.flatMap((re) => (text.match(re) ? [re.source] : []));
}

const STATES: TrendChangeState[] = [
  'consistent',
  'change_observed',
  'inconclusive_lighting',
  'insufficient_data',
];
const NARRATIVES = STATES.map((s) => trendNarrative(s, { n: 6, area: 'left cheek' }));
const ALL = [...collect(TREND_COPY), ...NARRATIVES];

describe('the OUTPUT narratives pass the FULL guard. Descriptive, no score, no detection', () => {
  for (const text of NARRATIVES) {
    it(`clean output: "${text.slice(0, 46)}…"`, () => {
      for (const pats of [
        SCORE_NUMBER,
        DISEASE,
        SUPERIORITY,
        VERDICT,
        STRUCTURE,
        AI_MARKETING,
        ALARM,
      ]) {
        expect(offenders(text, pats)).toEqual([]);
      }
    });
  }
});

describe('all trend copy is claim-safe (disclosure copy exempt only from the term-scan)', () => {
  for (const text of ALL) {
    if (!text) continue;
    it(`no disease/superiority/verdict/structure/alarm in: "${text.slice(0, 40)}…"`, () => {
      // Always enforced, even on the negation-disclosure strings.
      expect(offenders(text, DISEASE)).toEqual([]);
      expect(offenders(text, SUPERIORITY)).toEqual([]);
      expect(offenders(text, VERDICT)).toEqual([]);
      expect(offenders(text, STRUCTURE)).toEqual([]);
      expect(offenders(text, ALARM)).toEqual([]);
      // Score/number + "AI" terms are forbidden EXCEPT where the copy negates them.
      if (!TERM_EXEMPT.has(text)) {
        expect(offenders(text, SCORE_NUMBER)).toEqual([]);
        expect(offenders(text, AI_MARKETING)).toEqual([]);
      }
    });
  }
});

describe('the required stances are present (the no-score/no-upload/off-by-default promises)', () => {
  it('the opt-in states on-device, no-upload, no-score, and off-by-default', () => {
    const joined = TREND_COPY.optIn.bullets.join(' ').toLowerCase();
    expect(joined).toContain('entirely on your phone');
    expect(joined).toContain('uploaded');
    expect(joined).toContain('no score');
    expect(TREND_COPY.optIn.toggleHint.toLowerCase()).toContain('off by default');
  });
  it('the fairness floor states higher threshold for darker tones + redness-not-the-metric', () => {
    expect(TREND_COPY.fairness.monkNote.toLowerCase()).toContain('darker tones');
    expect(TREND_COPY.fairness.rednessTitle.toLowerCase()).toContain('redness is never');
  });
});

describe('trend analytics stays content-minimized', () => {
  it('does not send computed trend states as analytics props or state-specific events', () => {
    const source = readFeatureSource('TrendInsight.tsx');

    expect(source).toContain("track('trend_shown')");
    expect(source).not.toContain('change_state');
    expect(source).not.toContain('trend_inconclusive_lighting');
    expect(source).not.toContain('trend_consistency_celebrated');
  });
});

describe('the guard catches reintroduced violations', () => {
  it('rejects a score, a detection claim, a superiority claim, and "AI" marketing', () => {
    expect(offenders('Your skin score is 85/100', SCORE_NUMBER).length).toBeGreaterThan(0);
    expect(offenders('We detected acne on your cheek', DISEASE).length).toBeGreaterThan(0);
    expect(offenders('Dermatologist-grade analysis', SUPERIORITY).length).toBeGreaterThan(0);
    expect(offenders('AI skin analysis', AI_MARKETING).length).toBeGreaterThan(0);
  });
});
